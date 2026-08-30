import { registerPlugin, Capacitor } from '@capacitor/core';

// Thin wrapper around the native PrayerCountdownPlugin (android/app/src/main/java/com/fedi/nur)
// — a permanent status-bar notification showing the next prayer with a live countdown, or a
// live count-up once that prayer's time has arrived. Uses the system's own notification
// chronometer (ticks every second natively, no app process needs to stay alive) — this just
// tells it when to switch between counting down to `chronometerBaseMillis` and counting up
// from it. See hooks/useNotificationEngine.ts for how the day's events are built.
export interface PrayerCountdownEvent {
    id: number;
    atMillis: number; // when this event takes effect
    mode: 'countup' | 'countdown';
    label: string; // countup: the prayer that just started; countdown: the prayer being counted down to
    chronometerBaseMillis: number; // countup: equals atMillis; countdown: the target prayer's start time
}

interface PrayerCountdownPlugin {
    scheduleCountdown(options: { events: PrayerCountdownEvent[]; subtitle?: string }): Promise<void>;
    cancelCountdown(): Promise<void>;
}

const PrayerCountdown = registerPlugin<PrayerCountdownPlugin>('PrayerCountdown');

// No web implementation exists (native-only feature) — silently no-op outside Android instead
// of throwing, so this is safe to call unconditionally from shared React code.
// `subtitle` is a second line shown under the countdown (city/country + Hijri date) — it
// doesn't change per prayer transition, so it's just carried along and persisted natively.
export const scheduleCountdown = async (events: PrayerCountdownEvent[], subtitle?: string): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    await PrayerCountdown.scheduleCountdown({ events, subtitle }).catch(() => { });
};

export const cancelCountdown = async (): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    await PrayerCountdown.cancelCountdown().catch(() => { });
};
