import { registerPlugin, Capacitor } from '@capacitor/core';
import { PrayerTimes } from '../types';

// Thin wrapper around the native PrayerWidgetPlugin (android/app/src/main/java/com/fedi/nur)
// — pushes today's prayer times + the same location/Hijri-date subtitle used for the
// PrayerCountdown notification into SharedPreferences, for the home-screen widget
// (PrayerTimesWidgetProvider) to read. Same fire-and-forget, native-only pattern as
// services/prayerCountdown.ts.
interface PrayerWidgetPlugin {
    updateWidgetData(options: { times: PrayerTimes; subtitle: string }): Promise<void>;
}

const PrayerWidget = registerPlugin<PrayerWidgetPlugin>('PrayerWidget');

export const updateWidgetData = async (times: PrayerTimes, subtitle: string): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    await PrayerWidget.updateWidgetData({ times, subtitle }).catch(() => { });
};
