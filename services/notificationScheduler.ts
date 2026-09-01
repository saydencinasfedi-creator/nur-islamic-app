import { PrayerTimes, PrayerName, PRAYER_NAMES } from '../types';

export interface ScheduledPrayerNotification {
    localId: number;
    prayer: PrayerName;
    title: string;
    body: string;
    at: Date;
}

// Prayer notification ids are derived from (day offset, prayer) instead of a fixed 1-5 —
// scheduling several days ahead (see PRAYER_WINDOW_DAYS in useNotificationEngine.ts) means
// each day needs its own set of ids so tomorrow's alarms don't overwrite today's.
const PRAYER_INDEX: Record<PrayerName, number> = { Fajr: 0, Dhuhr: 1, Asr: 2, Maghrib: 3, Isha: 4 };

// Generous fixed range covering up to ~7 days ahead — cancelled as a whole block before every
// reschedule, so there's no need to track exactly which ids were used last time.
export const PRAYER_ID_RANGE_START = 100;
export const PRAYER_ID_RANGE_END = 169;

export const prayerNotificationId = (dayOffset: number, prayer: PrayerName): number =>
    PRAYER_ID_RANGE_START + dayOffset * 10 + PRAYER_INDEX[prayer];

export const GOAL_REMINDER_LOCAL_ID = 6;
export const STREAK_LOCAL_ID = 7;
export const GOAL_COMPLETE_LOCAL_ID = 8;
export const GOAL_REMINDER_HOUR = 20; // 8pm local

// Community challenge reminders (services/communityNotifications.ts) get the
// 700-799 block — cancelled as a whole before every reschedule.
export const COMMUNITY_CHALLENGE_ID_START = 700;
export const COMMUNITY_CHALLENGE_ID_END = 799;

// Prayer notifications for one specific day (dayOffset 0 = today, 1 = tomorrow, ...).
// Only returns prayers whose time is still ahead of now — matters for dayOffset 0, where
// some of today's prayers may have already passed.
export const computePrayerNotificationsForDay = (prayerTimes: PrayerTimes, dayOffset: number): ScheduledPrayerNotification[] => {
    const now = new Date();
    const result: ScheduledPrayerNotification[] = [];
    for (const prayer of PRAYER_NAMES) {
        const timeStr = prayerTimes[prayer];
        if (!timeStr) continue;
        const [hours, minutes] = timeStr.split(':').map(Number);
        const at = new Date(now);
        at.setDate(at.getDate() + dayOffset);
        at.setHours(hours, minutes, 0, 0);
        if (at.getTime() <= now.getTime()) continue;
        result.push({
            localId: prayerNotificationId(dayOffset, prayer),
            prayer,
            title: `${prayer} time`,
            body: `It's time for ${prayer} prayer.`,
            at,
        });
    }
    return result;
};

export const computeGoalReminderTime = (): Date => {
    const at = new Date();
    at.setHours(GOAL_REMINDER_HOUR, 0, 0, 0);
    return at;
};
