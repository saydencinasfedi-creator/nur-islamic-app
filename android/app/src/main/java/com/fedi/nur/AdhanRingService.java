package com.fedi.nur;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;

import androidx.core.app.NotificationCompat;

import java.io.File;

// Foreground service that actually plays the adhan audio, started by AdhanAlarmReceiver when
// a scheduled alarm fires. Uses AudioAttributes.USAGE_ALARM so it plays through the alarm
// volume stream — independent of the Notification volume, which the user keeps muted for
// everyday notifications. USAGE_ALARM would normally bypass Do Not Disturb/Silent mode on its
// own, but per user request that's deliberately overridden here: if the phone is silenced or
// DND is on when the alarm fires, this skips playback entirely instead of interrupting anyway.
// Also per user request, the Alarm stream itself is temporarily set to the user's chosen
// Adhan Settings volume percentage right before playing (see boostAlarmVolume/restoreAlarmVolume)
// — MediaPlayer's own gain can never exceed the stream's current system volume, so "always at
// the chosen loudness regardless of whatever the Alarm slider is left at" requires actually
// moving that slider, restored the moment playback ends.
// No full-screen ringing UI here by design (that's a separate, already-deferred piece of
// work) — just the sound, with a "Stop" action on its own notification to dismiss it.
public class AdhanRingService extends Service implements SensorEventListener {

    private static final String CHANNEL_ID = "adhan_ring_channel";
    private static final int NOTIFICATION_ID = 9911;
    // Pure safety backstop: the adhan normally ends on its own when the recording finishes
    // (see setOnCompletionListener below). This only matters if the service somehow gets
    // stuck — comfortably longer than any realistic single adhan recording (4-5+ minutes).
    private static final long MAX_RING_DURATION_MS = 10 * 60 * 1000L;

    // "Flip to stop" gesture thresholds. Z axis of TYPE_GRAVITY / accelerometer is ~ +9.8
    // when the phone lies face up and ~ -9.8 when face down; the generous margins absorb
    // tilt from resting on an uneven surface.
    private static final float FACE_UP_Z = 6.0f;
    private static final float FACE_DOWN_Z = -7.0f;
    private static final long FACE_DOWN_HOLD_MS = 500L;

    private MediaPlayer mediaPlayer;
    private Handler cutoffHandler;
    private Runnable cutoffRunnable;
    // Set only while this instance has actually boosted the Alarm stream — remembered so
    // onDestroy() can put it back exactly where the user had it, never left permanently changed.
    private Integer previousAlarmVolume;

    // "Flip the phone face down to silence the adhan" — only wired up when the user has the
    // toggle on in Adhan Settings. sawFaceUp guards against an instant stop when the adhan
    // begins with the phone already resting face down (e.g. on a nightstand at night): the
    // user has to turn it face up first, then flip it, for the gesture to count.
    private SensorManager sensorManager;
    private Sensor flipSensor;
    private boolean sawFaceUp;
    private long faceDownSince;

    private static AdhanRingService activeInstance;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        activeInstance = this;

        String prayerLabel = intent != null ? intent.getStringExtra(AdhanAlarmReceiver.EXTRA_PRAYER_LABEL) : null;
        String soundPath = intent != null ? intent.getStringExtra(AdhanAlarmReceiver.EXTRA_SOUND_PATH) : null;
        int volumePercent = intent != null ? intent.getIntExtra(AdhanAlarmReceiver.EXTRA_VOLUME_PERCENT, 100) : 100;
        boolean flipToStop = intent == null || intent.getBooleanExtra(AdhanAlarmReceiver.EXTRA_FLIP_TO_STOP, true);

        createChannelIfNeeded();
        startForeground(NOTIFICATION_ID, buildNotification(prayerLabel));

        if (soundPath == null || soundPath.isEmpty() || isSilentOrDndActive()) {
            stopSelf();
            return START_NOT_STICKY;
        }

        boostAlarmVolume(volumePercent);

        try {
            // Directory.Data from @capacitor/filesystem maps to context.getFilesDir() on
            // Android, and soundPath is the relative path already stored alongside the
            // AdhanSound's metadata (e.g. "adhans/<uuid>.m4a").
            File file = new File(getFilesDir(), soundPath);
            mediaPlayer = new MediaPlayer();
            // USAGE_ALARM: plays on the device's separate Alarm volume, completely independent
            // of the Notification volume (which the user normally keeps muted/low day-to-day).
            // This is exactly what makes alarm-clock apps audible regardless of other sound
            // settings — the Alarm stream has its own dedicated slider (Settings > Sound, or
            // shown when adjusting volume during playback), set once and left alone, and
            // bypasses Do Not Disturb too.
            mediaPlayer.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            );
            mediaPlayer.setDataSource(Uri.fromFile(file).toString());
            mediaPlayer.setLooping(false);
            mediaPlayer.setVolume(1.0f, 1.0f);
            // Keep the CPU running while the screen is off so playback finishes and the
            // flip-to-stop sensor keeps getting events even on a locked phone.
            mediaPlayer.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK);
            mediaPlayer.setOnPreparedListener(MediaPlayer::start);
            // The adhan plays once and then stops itself — no looping, no lingering service.
            mediaPlayer.setOnCompletionListener(mp -> stopSelf());
            mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                stopSelf();
                return true;
            });
            mediaPlayer.prepareAsync();
        } catch (Exception e) {
            // File missing/moved/corrupt — fail silently, the visible LocalNotifications
            // prayer notification is independent and already fired regardless.
            stopSelf();
            return START_NOT_STICKY;
        }

        cutoffHandler = new Handler(Looper.getMainLooper());
        cutoffRunnable = this::stopSelf;
        cutoffHandler.postDelayed(cutoffRunnable, MAX_RING_DURATION_MS);

        if (flipToStop) {
            registerFlipListener();
        }

        return START_NOT_STICKY;
    }

    // Listens on the gravity/accelerometer sensor so turning the phone face down silences
    // the adhan, mirroring the "Stop" notification action. Torn down in onDestroy().
    private void registerFlipListener() {
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager == null) return;
        // Idempotent in case onStartCommand runs twice on the same instance.
        sensorManager.unregisterListener(this);
        sawFaceUp = false;
        faceDownSince = 0L;
        flipSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GRAVITY);
        if (flipSensor == null) {
            flipSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        }
        if (flipSensor != null) {
            sensorManager.registerListener(this, flipSensor, SensorManager.SENSOR_DELAY_UI);
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event == null || event.values.length < 3) return;
        float z = event.values[2];
        if (z > FACE_UP_Z) {
            sawFaceUp = true;
        }
        if (sawFaceUp && z < FACE_DOWN_Z) {
            if (faceDownSince == 0L) {
                faceDownSince = SystemClock.elapsedRealtime();
            } else if (SystemClock.elapsedRealtime() - faceDownSince >= FACE_DOWN_HOLD_MS) {
                stopSelf();
            }
        } else {
            faceDownSince = 0L;
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not needed — only the gravity vector matters here.
    }

    private Notification buildNotification(String prayerLabel) {
        Intent stopIntent = new Intent(this, AdhanAlarmReceiver.class);
        stopIntent.setAction(AdhanAlarmReceiver.ACTION_STOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent stopPendingIntent = PendingIntent.getBroadcast(this, 0, stopIntent, flags);

        String title = (prayerLabel != null && !prayerLabel.isEmpty() ? prayerLabel : "Prayer") + " — Adhan";
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText("Tap Stop to silence")
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .addAction(0, "Stop", stopPendingIntent)
            .build();
    }

    private void createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null && manager.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Adhan", NotificationManager.IMPORTANCE_HIGH
                );
                // The channel's own sound stays unset — MediaPlayer plays the actual adhan
                // audio directly, this notification is just the visible/dismissible control.
                channel.setSound(null, null);
                manager.createNotificationChannel(channel);
            }
        }
    }

    // Checked right before playing — the user wants the adhan to ignore their everyday muted
    // Notification volume, but still respect it when they've deliberately gone silent/DND
    // (a meeting, sleeping, etc.), unlike a real alarm clock which would ring regardless.
    private boolean isSilentOrDndActive() {
        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null && audioManager.getRingerMode() == AudioManager.RINGER_MODE_SILENT) {
            return true;
        }
        NotificationManager notificationManager = getSystemService(NotificationManager.class);
        return notificationManager != null
            && notificationManager.getCurrentInterruptionFilter() != NotificationManager.INTERRUPTION_FILTER_ALL;
    }

    // Independent of MediaPlayer's own gain: the Alarm stream's current level is always an
    // upper ceiling Android enforces regardless of app-side volume, so "always sounds at the
    // percentage chosen in Adhan Settings, no matter what the user left the slider at" requires
    // actually moving the system slider — temporarily, restored in onDestroy() the moment
    // playback stops either way.
    private void boostAlarmVolume(int percent) {
        try {
            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) return;
            previousAlarmVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
            int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            int min = audioManager.getStreamMinVolume(AudioManager.STREAM_ALARM);
            int target = Math.round(max * (Math.max(0, Math.min(100, percent)) / 100f));
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, Math.max(min, target), 0);
        } catch (Exception e) {
            previousAlarmVolume = null;
        }
    }

    private void restoreAlarmVolume() {
        if (previousAlarmVolume == null) return;
        try {
            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, previousAlarmVolume, 0);
            }
        } catch (Exception ignored) {
        }
        previousAlarmVolume = null;
    }

    static void stopRinging(Context context) {
        if (activeInstance != null) {
            activeInstance.stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        if (cutoffHandler != null && cutoffRunnable != null) {
            cutoffHandler.removeCallbacks(cutoffRunnable);
        }
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
            sensorManager = null;
        }
        if (mediaPlayer != null) {
            try {
                mediaPlayer.stop();
            } catch (IllegalStateException ignored) {
            }
            mediaPlayer.release();
            mediaPlayer = null;
        }
        restoreAlarmVolume();
        if (activeInstance == this) activeInstance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
