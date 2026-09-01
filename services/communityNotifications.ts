// Local (device) notifications for challenges the user has joined. There is no
// FCM in this build — every reminder is a one-shot LocalNotifications entry,
// recomputed once per calendar day (same approach as the daily-goal reminder in
// useNotificationEngine.ts). Server-side / cross-device push is a later phase.

import { LocalNotifications } from '@capacitor/local-notifications';
import { COMMUNITY_CHALLENGE_ID_START, COMMUNITY_CHALLENGE_ID_END } from './notificationScheduler';
import type { GroupChallenge } from '../types';

const GUARD_KEY = 'nurCommunityChallengeNotifsDate';
const todayStr = () => new Date().toDateString();

// How many upcoming occurrences to queue per challenge.
const DAILY_LOOKAHEAD = 7;
const FRIDAY_LOOKAHEAD = 4;

const parseHhMm = (hhmm: string): [number, number] => {
  const [h, m] = hhmm.split(':').map(Number);
  return [Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0];
};

// Concrete future Dates for a challenge's schedule, skipping any already past
// and any after the challenge's end date.
const occurrencesFor = (challenge: GroupChallenge): Date[] => {
  if (challenge.notifyFrequency === 'none' || !challenge.notifyAt) return [];
  const [hh, mm] = parseHhMm(challenge.notifyAt);
  const now = new Date();
  const end = new Date(challenge.endsOn + 'T23:59:59');
  const out: Date[] = [];

  if (challenge.notifyFrequency === 'daily') {
    for (let i = 0; i < DAILY_LOOKAHEAD; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      d.setHours(hh, mm, 0, 0);
      if (d.getTime() > now.getTime() && d.getTime() <= end.getTime()) out.push(d);
    }
  } else if (challenge.notifyFrequency === 'fridays') {
    const d = new Date(now);
    d.setHours(hh, mm, 0, 0);
    // advance to the next Friday (getDay() === 5), today included if still ahead
    while (d.getDay() !== 5 || d.getTime() <= now.getTime()) {
      d.setDate(d.getDate() + 1);
      d.setHours(hh, mm, 0, 0);
    }
    for (let i = 0; i < FRIDAY_LOOKAHEAD; i++) {
      const f = new Date(d);
      f.setDate(f.getDate() + i * 7);
      if (f.getTime() <= end.getTime()) out.push(f);
    }
  }
  return out;
};

// Re-arm the whole 700-799 block from the current joined-challenge list. Called
// once per day from useNotificationEngine (guarded), and immediately after a
// join/leave so the schedule reflects the change without waiting for tomorrow.
export const syncChallengeNotifications = async (joined: GroupChallenge[], force = false): Promise<void> => {
  if (!force && localStorage.getItem(GUARD_KEY) === todayStr()) return;

  await LocalNotifications.cancel({
    notifications: Array.from(
      { length: COMMUNITY_CHALLENGE_ID_END - COMMUNITY_CHALLENGE_ID_START + 1 },
      (_, i) => ({ id: COMMUNITY_CHALLENGE_ID_START + i }),
    ),
  }).catch(() => {});

  let nextId = COMMUNITY_CHALLENGE_ID_START;
  const notifications: any[] = [];
  for (const c of joined) {
    for (const at of occurrencesFor(c)) {
      if (nextId > COMMUNITY_CHALLENGE_ID_END) break;
      notifications.push({
        id: nextId++,
        title: c.title,
        body: 'Time for your challenge today. Tap to log your progress.',
        schedule: { at },
        extra: { type: 'community', challengeId: c.id },
      });
    }
  }

  if (notifications.length) {
    await LocalNotifications.schedule({ notifications }).catch(err =>
      console.warn('[Nur] challenge notifications failed to schedule:', err),
    );
  }
  localStorage.setItem(GUARD_KEY, todayStr());
};

// Force a reschedule now (used right after join/leave).
export const rearmChallengeNotifications = (joined: GroupChallenge[]) => syncChallengeNotifications(joined, true);
