import { registerPlugin, Capacitor, PluginListenerHandle } from '@capacitor/core';

// Thin wrapper around the native CompassAccuracyPlugin (android/app/src/main/java/com/fedi/nur)
// — the web DeviceOrientationEvent API used for the actual Qibla heading (pages/Qibla.tsx)
// has no way to report magnetometer accuracy, only Android's native SensorManager does.
// No web implementation exists (native-only feature): `start`/`addListener` are safe no-ops
// off native platforms, so callers never see real accuracy data there (matches the app's own
// "browsers don't expose this" reality rather than faking a number).
export type CompassAccuracy = 0 | 1 | 2 | 3; // SensorManager.SENSOR_STATUS_UNRELIABLE..HIGH

interface CompassAccuracyPlugin {
    start(): Promise<void>;
    stop(): Promise<void>;
    addListener(
        eventName: 'accuracyChanged',
        listenerFunc: (data: { accuracy: CompassAccuracy }) => void
    ): Promise<PluginListenerHandle>;
}

const CompassAccuracyNative = registerPlugin<CompassAccuracyPlugin>('CompassAccuracy');

export const startCompassAccuracy = async (
    onChange: (accuracy: CompassAccuracy) => void
): Promise<PluginListenerHandle | null> => {
    if (!Capacitor.isNativePlatform()) return null;
    const handle = await CompassAccuracyNative.addListener('accuracyChanged', (data) => onChange(data.accuracy));
    await CompassAccuracyNative.start().catch(() => { });
    return handle;
};

export const stopCompassAccuracy = async (handle: PluginListenerHandle | null): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    await handle?.remove().catch(() => { });
    await CompassAccuracyNative.stop().catch(() => { });
};
