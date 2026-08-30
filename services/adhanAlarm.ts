import { registerPlugin, Capacitor } from '@capacitor/core';

// Thin wrapper around the native AdhanAlarmPlugin (android/app/src/main/java/com/fedi/nur) —
// a second, independent alarm path that plays the user's actual uploaded adhan audio file,
// since @capacitor/local-notifications' `sound` option can only reference a bundled res/raw
// resource, never a filesystem path. See hooks/useNotificationEngine.ts for the caller.
export interface AdhanAlarmEntry {
    id: number;
    atMillis: number;
    prayerLabel: string;
    soundPath: string;
    soundMime: string;
    volumePercent: number;
    // Whether turning the phone face down while this adhan rings should silence it.
    flipToStop: boolean;
}

interface AdhanAlarmPlugin {
    scheduleAdhanAlarms(options: { alarms: AdhanAlarmEntry[] }): Promise<void>;
    cancelAdhanAlarms(): Promise<void>;
    boostMediaVolume(options: { percent: number }): Promise<void>;
    restoreMediaVolume(): Promise<void>;
}

const AdhanAlarm = registerPlugin<AdhanAlarmPlugin>('AdhanAlarm');

// No web implementation exists (native-only feature) — silently no-op outside Android
// instead of throwing, so this is safe to call unconditionally from shared React code.
export const scheduleAdhanAlarms = async (alarms: AdhanAlarmEntry[]): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    await AdhanAlarm.scheduleAdhanAlarms({ alarms }).catch(() => { });
};

export const cancelAdhanAlarms = async (): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    await AdhanAlarm.cancelAdhanAlarms().catch(() => { });
};

// Used only for the in-app preview button in Adhan Settings — a web <audio> element always
// plays through the Media stream, which (like the Alarm stream used for the real adhan) caps
// out at whatever the system's current Media volume is, regardless of the element's own
// `.volume`. Boosting the actual stream is the only way the preview can reflect the chosen
// Adhan Volume % rather than whatever the user last left Media volume at.
export const boostMediaVolume = async (percent: number): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    await AdhanAlarm.boostMediaVolume({ percent }).catch(() => { });
};

export const restoreMediaVolume = async (): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    await AdhanAlarm.restoreMediaVolume().catch(() => { });
};
