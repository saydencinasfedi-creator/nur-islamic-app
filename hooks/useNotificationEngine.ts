import { useEffect, useRef } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../services/supabase';
import { listMyJoinedChallenges } from '../services/communityService';
import { syncChallengeNotifications } from '../services/communityNotifications';
import { NotificationType, PrayerTimes, PrayerName, PRAYER_NAMES } from '../types';
import { fetchPrayerTimes } from '../services/prayerService';
import { scheduleAdhanAlarms, cancelAdhanAlarms } from '../services/adhanAlarm';
import { scheduleCountdown, PrayerCountdownEvent } from '../services/prayerCountdown';
import { updateWidgetData } from '../services/prayerWidget';
import { formatHijriDateWithWeekday } from '../services/hijriDate';
import {
    computePrayerNotificationsForDay, computeGoalReminderTime,
    PRAYER_ID_RANGE_START, PRAYER_ID_RANGE_END,
    GOAL_REMINDER_LOCAL_ID, STREAK_LOCAL_ID, GOAL_COMPLETE_LOCAL_ID,
} from '../services/notificationScheduler';

// How long the persistent countdown notification keeps counting up ("elapsed since X started")
// before switching to counting down to the next prayer — 30 minutes for Maghrib since Isha
// follows much sooner than the other gaps, 60 minutes everywhere else.
const COUNTDOWN_CUTOFF_MINUTES: Record<PrayerName, number> = {
    Fajr: 60, Dhuhr: 60, Asr: 60, Maghrib: 30, Isha: 60,
};

// Builds the day's "countup at prayer start / countdown to whatever's next" event timeline
// for the persistent status-bar notification, from whichever days' PrayerTimes were already
// fetched for the LocalNotifications scheduling above (plus Sunrise, and one trailing day so
// the last prayer in the window has something to count down to after its own cutoff).
const buildCountdownEvents = (timesByOffset: Record<number, PrayerTimes>): PrayerCountdownEvent[] => {
    const offsets = Object.keys(timesByOffset).map(Number).sort((a, b) => a - b);
    const toMillis = (dayOffset: number, timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        const d = new Date();
        d.setDate(d.getDate() + dayOffset);
        d.setHours(h, m, 0, 0);
        return d.getTime();
    };

    const countups: { atMillis: number; label: string }[] = [];
    const countdownTriggers: number[] = []; // atMillis at which the notification should switch to counting down to whatever countup comes next

    for (const offset of offsets) {
        const times = timesByOffset[offset];
        for (const prayer of PRAYER_NAMES) {
            const timeStr = times[prayer];
            if (!timeStr) continue;
            const at = toMillis(offset, timeStr);
            countups.push({ atMillis: at, label: prayer });
            countdownTriggers.push(at + COUNTDOWN_CUTOFF_MINUTES[prayer] * 60000);
        }
        if (times.Sunrise) {
            countdownTriggers.push(toMillis(offset, times.Sunrise));
        }
    }

    countups.sort((a, b) => a.atMillis - b.atMillis);

    let nextId = 500; // well clear of prayer-notification ids (100-169), goal/streak ids (6-8), and AdhanRingService's own notification id (9911)
    const events: PrayerCountdownEvent[] = countups.map(c => ({
        id: nextId++,
        atMillis: c.atMillis,
        mode: 'countup',
        label: c.label,
        chronometerBaseMillis: c.atMillis,
    }));

    for (const atMillis of countdownTriggers) {
        const next = countups.find(c => c.atMillis > atMillis);
        if (!next) continue; // end of the fetched window — the next day's reschedule will cover it
        events.push({
            id: nextId++,
            atMillis,
            mode: 'countdown',
            label: next.label,
            chronometerBaseMillis: next.atMillis,
        });
    }

    return events;
};

const todayStr = () => new Date().toDateString();

// How many days of prayer alarms to keep scheduled ahead of time — so a day the user never
// opens the app still has its alarms already sitting in Android's AlarmManager, instead of
// only ever being (re)scheduled when the app happens to be opened that same day.
const PRAYER_WINDOW_DAYS = 3;

// Mounted once in App.tsx. Owns all interaction with the local-notifications plugin —
// scheduling real system-tray notifications for prayer times / the daily goal reminder,
// firing near-immediate ones for streak/achievement events, and mirroring whatever
// actually reaches the device back into the in-app panel via UserContext.
export const useNotificationEngine = () => {
    const {
        prayerTimes, location, prayerStreak, goalsTodayPercent, notifSettings, addNotification,
        adhanSounds, activeAdhanId, adhanPrayerEnabled, adhanVolumePercent, flipToStopAdhan,
    } = useUser();

    const { session } = useAuth();
    const lastStreak = useRef<number | null>(null);
    const lastGoalsComplete = useRef<boolean | null>(null);
    // Tracked separately from the once-per-day localStorage guard below, so switching the
    // active adhan sound, its volume, or its per-prayer toggles mid-day still re-arms the
    // native adhan alarms even though the prayer notifications themselves don't need to be.
    const lastAdhanConfigKey = useRef<string | undefined>(undefined);

    useEffect(() => {
        LocalNotifications.requestPermissions().catch(() => { });
    }, []);

    // Reflect notifications that actually reached the device (or were tapped) into the
    // in-app panel. Streak/achievement events are added directly where they're detected
    // below (the app is guaranteed open then), so they're skipped here to avoid duplicates.
    useEffect(() => {
        const receivedHandle = LocalNotifications.addListener('localNotificationReceived', (n) => {
            const type = (n.extra?.type as NotificationType) || 'prayer';
            if (type === 'streak') return;
            addNotification({ type, title: n.title, body: n.body });
        });
        const actionHandle = LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
            const n = e.notification;
            const type = (n.extra?.type as NotificationType) || 'prayer';
            if (type === 'streak') return;
            addNotification({ type, title: n.title, body: n.body });
        });
        return () => {
            receivedHandle.then(h => h.remove()).catch(() => { });
            actionHandle.then(h => h.remove()).catch(() => { });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Schedule prayer-time notifications for today + the next couple of days, once per
    // calendar day (re-armed whenever the app is next opened on a new day). Scheduling a
    // window ahead — rather than only today — means a day the user never opens the app
    // still fires its prayer alarms, since they were already queued in AlarmManager.
    useEffect(() => {
        if (!notifSettings.prayerTimes || !location) return;
        const key = 'nurPrayerNotifsScheduledDate';
        const alreadyScheduledToday = localStorage.getItem(key) === todayStr();
        const adhanConfigKey = JSON.stringify({ activeAdhanId, adhanPrayerEnabled, adhanVolumePercent, flipToStopAdhan });
        const adhanChanged = lastAdhanConfigKey.current !== adhanConfigKey;
        if (alreadyScheduledToday && !adhanChanged) return;

        let cancelled = false;

        (async () => {
            await LocalNotifications.cancel({
                notifications: Array.from(
                    { length: PRAYER_ID_RANGE_END - PRAYER_ID_RANGE_START + 1 },
                    (_, i) => ({ id: PRAYER_ID_RANGE_START + i })
                ),
            }).catch(() => { });

            const allNotifications = [];
            const timesByOffset: Record<number, PrayerTimes> = {};
            for (let dayOffset = 0; dayOffset < PRAYER_WINDOW_DAYS; dayOffset++) {
                const date = new Date();
                date.setDate(date.getDate() + dayOffset);
                const times = dayOffset === 0 && prayerTimes
                    ? prayerTimes
                    : await fetchPrayerTimes(location.latitude, location.longitude, date);
                if (!times) continue;
                timesByOffset[dayOffset] = times;
                allNotifications.push(...computePrayerNotificationsForDay(times, dayOffset));
            }
            if (cancelled) return;

            // One extra trailing day, purely so the last prayer in the window (Isha) has a
            // real "next prayer" (tomorrow's Fajr) for the countdown notification to target
            // once its own count-up cutoff passes.
            const trailingDate = new Date();
            trailingDate.setDate(trailingDate.getDate() + PRAYER_WINDOW_DAYS);
            const trailingTimes = location
                ? await fetchPrayerTimes(location.latitude, location.longitude, trailingDate).catch(() => null)
                : null;
            if (trailingTimes) timesByOffset[PRAYER_WINDOW_DAYS] = trailingTimes;
            if (cancelled) return;

            if (allNotifications.length > 0) {
                const result = await LocalNotifications.schedule({
                    notifications: allNotifications.map(n => ({
                        id: n.localId,
                        title: n.title,
                        body: n.body,
                        schedule: { at: n.at },
                        extra: { type: 'prayer' },
                    })),
                }).catch(err => {
                    console.warn('[Nur] failed to schedule prayer notifications:', err);
                    return null;
                });
                if (result?.warning) {
                    console.warn('[Nur] prayer notifications scheduled with warning:', result.warning.code, result.warning.message);
                }
            }

            // Real adhan audio is a separate native alarm path (LocalNotifications' `sound`
            // can't reference a user-uploaded file) — see services/adhanAlarm.ts. Prayers the
            // user turned off in Adhan Settings are simply left out, so they still get the
            // normal notification above, just no sound alarm.
            const activeSound = adhanSounds.find(s => s.id === activeAdhanId) ?? null;
            if (activeSound) {
                const enabledNotifications = allNotifications.filter(n => adhanPrayerEnabled[n.prayer]);
                await scheduleAdhanAlarms(enabledNotifications.map(n => ({
                    id: n.localId,
                    atMillis: n.at.getTime(),
                    prayerLabel: n.prayer,
                    soundPath: activeSound.filePath,
                    soundMime: activeSound.mimeType,
                    volumePercent: adhanVolumePercent,
                    flipToStop: flipToStopAdhan,
                })));
            } else {
                await cancelAdhanAlarms();
            }
            lastAdhanConfigKey.current = adhanConfigKey;

            // Persistent "next prayer" status-bar notification — independent of the adhan
            // sound entirely, always reflects all 5 prayers + Sunrise regardless of the
            // per-prayer adhan toggles above. The subtitle (city + Hijri date) lets the user
            // confirm at a glance that the countdown is using the right location/day.
            const subtitle = `${location.city}, ${location.country} • ${formatHijriDateWithWeekday(new Date())}`;
            await scheduleCountdown(buildCountdownEvents(timesByOffset), subtitle);

            // Keeps the home-screen widget (if placed) in sync with today's times whenever
            // they're recalculated here — same subtitle as the notification above.
            if (timesByOffset[0]) {
                await updateWidgetData(timesByOffset[0], subtitle);
            }

            if (!cancelled) localStorage.setItem(key, todayStr());
        })();

        return () => { cancelled = true; };
    }, [prayerTimes, location, notifSettings.prayerTimes, activeAdhanId, adhanSounds, adhanPrayerEnabled, adhanVolumePercent, flipToStopAdhan]);

    // Schedule the daily-goal reminder once per day; cancel it live once goals hit 100%.
    useEffect(() => {
        if (!notifSettings.dailyGoalReminder) return;
        const key = 'nurGoalReminderScheduledDate';
        if (localStorage.getItem(key) === todayStr()) return;

        LocalNotifications.schedule({
            notifications: [{
                id: GOAL_REMINDER_LOCAL_ID,
                title: 'Daily Goals',
                body: "You still have Daily Goals left to complete today.",
                schedule: { at: computeGoalReminderTime() },
                extra: { type: 'goal' },
            }],
        }).catch(() => { });
        localStorage.setItem(key, todayStr());
    }, [notifSettings.dailyGoalReminder]);

    useEffect(() => {
        if (goalsTodayPercent >= 100) {
            LocalNotifications.cancel({ notifications: [{ id: GOAL_REMINDER_LOCAL_ID }] }).catch(() => { });
        }
    }, [goalsTodayPercent]);

    // Community challenge reminders — re-armed once per calendar day (the guard
    // lives inside syncChallengeNotifications) from the user's joined challenges.
    useEffect(() => {
        if (!isSupabaseConfigured || !session) return;
        listMyJoinedChallenges()
            .then(joined => syncChallengeNotifications(joined))
            .catch(() => { });
    }, [session]);

    // Streak achievement — event-driven, fired the moment the streak goes up.
    useEffect(() => {
        if (!notifSettings.streakAchievements) return;
        if (lastStreak.current !== null && prayerStreak > lastStreak.current) {
            const body = `You're on a ${prayerStreak}-day prayer streak.`;
            addNotification({ type: 'streak', title: 'Streak up!', body });
            LocalNotifications.schedule({
                notifications: [{
                    id: STREAK_LOCAL_ID,
                    title: 'Streak up!',
                    body,
                    schedule: { at: new Date(Date.now() + 500) },
                    extra: { type: 'streak' },
                }],
            }).catch(() => { });
        }
        lastStreak.current = prayerStreak;
    }, [prayerStreak, notifSettings.streakAchievements]);

    // Daily goals fully completed — event-driven, fired once per day the moment it hits 100%.
    useEffect(() => {
        if (!notifSettings.streakAchievements) return;
        const isComplete = goalsTodayPercent >= 100;
        if (isComplete && lastGoalsComplete.current === false) {
            const body = "You've completed all your Daily Goals today.";
            addNotification({ type: 'streak', title: 'Daily Goals complete!', body });
            LocalNotifications.schedule({
                notifications: [{
                    id: GOAL_COMPLETE_LOCAL_ID,
                    title: 'Daily Goals complete!',
                    body,
                    schedule: { at: new Date(Date.now() + 500) },
                    extra: { type: 'streak' },
                }],
            }).catch(() => { });
        }
        lastGoalsComplete.current = isComplete;
    }, [goalsTodayPercent, notifSettings.streakAchievements]);
};
