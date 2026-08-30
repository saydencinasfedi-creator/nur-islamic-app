package com.fedi.nur;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

// Fired either by AlarmManager at a prayer's scheduled time (ACTION_RING, extras carry the
// adhan file to play) or by the "Stop" action on AdhanRingService's own notification
// (ACTION_STOP). Kept separate from LocalNotifications entirely — this is a second, parallel
// native alarm whose only job is playing real adhan audio, since LocalNotifications' `sound`
// option can only reference a bundled res/raw resource, never a user-uploaded file path.
public class AdhanAlarmReceiver extends BroadcastReceiver {

    static final String ACTION_RING = "com.fedi.nur.ACTION_RING_ADHAN";
    static final String ACTION_STOP = "com.fedi.nur.ACTION_STOP_ADHAN";

    static final String EXTRA_ID = "id";
    static final String EXTRA_PRAYER_LABEL = "prayerLabel";
    static final String EXTRA_SOUND_PATH = "soundPath";
    static final String EXTRA_SOUND_MIME = "soundMime";
    static final String EXTRA_VOLUME_PERCENT = "volumePercent";
    static final String EXTRA_FLIP_TO_STOP = "flipToStop";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        if (ACTION_STOP.equals(intent.getAction())) {
            AdhanRingService.stopRinging(context);
            return;
        }

        String soundPath = intent.getStringExtra(EXTRA_SOUND_PATH);
        if (soundPath == null || soundPath.isEmpty()) return;

        Intent serviceIntent = new Intent(context, AdhanRingService.class);
        serviceIntent.putExtra(EXTRA_ID, intent.getIntExtra(EXTRA_ID, 0));
        serviceIntent.putExtra(EXTRA_PRAYER_LABEL, intent.getStringExtra(EXTRA_PRAYER_LABEL));
        serviceIntent.putExtra(EXTRA_SOUND_PATH, soundPath);
        serviceIntent.putExtra(EXTRA_SOUND_MIME, intent.getStringExtra(EXTRA_SOUND_MIME));
        serviceIntent.putExtra(EXTRA_VOLUME_PERCENT, intent.getIntExtra(EXTRA_VOLUME_PERCENT, 100));
        serviceIntent.putExtra(EXTRA_FLIP_TO_STOP, intent.getBooleanExtra(EXTRA_FLIP_TO_STOP, true));

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception e) {
            // Android denied the foreground-service start (e.g. background-start
            // restrictions) — silently skip the adhan sound rather than crash the receiver
            // and take the whole process down with it. The visible prayer notification from
            // LocalNotifications is independent and already fired regardless.
        }
    }
}
