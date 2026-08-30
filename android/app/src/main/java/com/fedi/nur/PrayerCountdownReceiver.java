package com.fedi.nur;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.text.format.DateFormat;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.util.Date;

// Fired by AlarmManager at each prayer-start / countdown-cutoff transition to update the
// permanent "next prayer" status-bar notification. No Service involved — a plain ongoing
// notification persists on its own once posted (standard Android behavior, confirmed before
// building this), so this only ever needs to run the moment it takes to call notify().
//
// Uses a custom RemoteViews layout with a real Chronometer widget instead of
// Notification.Builder's simplified setUsesChronometer flag — the plain flag has no way to
// show a leading "+" while counting up (only "-" for counting down, automatically), but
// RemoteViews.setChronometer()/setChronometerCountDown() let the format string be fully
// custom ("+%s"/"-%s") while still ticking live via the system, no running process needed.
public class PrayerCountdownReceiver extends BroadcastReceiver {

    static final String ACTION_UPDATE = "com.fedi.nur.ACTION_UPDATE_PRAYER_COUNTDOWN";
    // Fired via the notification's own setDeleteIntent if the user swipes it away — ordinary
    // ongoing notifications (not backed by a live foreground service) can still be dismissed
    // on Android 14+, so this immediately puts it back instead of leaving it gone.
    static final String ACTION_REPOST = "com.fedi.nur.ACTION_REPOST_PRAYER_COUNTDOWN";

    static final String EXTRA_MODE = "mode"; // "countup" or "countdown"
    static final String EXTRA_LABEL = "label";
    static final String EXTRA_CHRONOMETER_BASE = "chronometerBaseMillis";
    static final String EXTRA_SUBTITLE = "subtitle";

    private static final String CHANNEL_ID = "prayer_countdown_channel";
    static final int NOTIFICATION_ID = 9922;

    // Last-known state, kept separately from PrayerCountdownPlugin's future-events list (which
    // only ever holds events still ahead of "now") so a dismiss-repost always has something
    // accurate to restore, no matter how much time has passed since it was first posted.
    private static final String LAST_STATE_PREFS = "prayer_countdown_current";
    private static final String PREF_MODE = "mode";
    private static final String PREF_LABEL = "label";
    private static final String PREF_BASE = "base";
    private static final String PREF_SUBTITLE = "subtitle";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        if (ACTION_REPOST.equals(intent.getAction())) {
            repostLastKnown(context);
            return;
        }

        String mode = intent.getStringExtra(EXTRA_MODE);
        String label = intent.getStringExtra(EXTRA_LABEL);
        long base = intent.getLongExtra(EXTRA_CHRONOMETER_BASE, System.currentTimeMillis());
        // Not carried on every alarm-triggered intent (it doesn't change per prayer transition)
        // — fall back to whatever was last persisted so it doesn't blank out on every tick.
        String subtitle = intent.getStringExtra(EXTRA_SUBTITLE);
        if (subtitle == null) {
            subtitle = context.getSharedPreferences(LAST_STATE_PREFS, Context.MODE_PRIVATE)
                .getString(PREF_SUBTITLE, "");
        }
        updateNotification(context, mode, label, base, subtitle);
    }

    // Shared by the alarm-triggered path above and PrayerCountdownPlugin (which calls this
    // directly to reflect "now" immediately when the app reschedules, instead of waiting for
    // the next alarm boundary).
    static void updateNotification(Context context, String mode, String label, long chronometerBaseMillis, String subtitle) {
        if (mode == null || label == null || label.isEmpty()) return;
        createChannelIfNeeded(context);

        context.getSharedPreferences(LAST_STATE_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(PREF_MODE, mode)
            .putString(PREF_LABEL, label)
            .putLong(PREF_BASE, chronometerBaseMillis)
            .putString(PREF_SUBTITLE, subtitle == null ? "" : subtitle)
            .apply();

        boolean countDown = "countdown".equals(mode);
        String title = countDown ? (label + " is next") : (label + " has started");
        String timeText = DateFormat.getTimeFormat(context).format(new Date(chronometerBaseMillis));

        // Chronometer's base is in SystemClock.elapsedRealtime() terms (time since boot), NOT
        // wall-clock epoch millis — passing the epoch time straight in produced nonsense like
        // "-496384:03:10". Convert by applying the current epoch↔elapsed offset to the target.
        long elapsedBase = android.os.SystemClock.elapsedRealtime()
            + (chronometerBaseMillis - System.currentTimeMillis());

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.notification_prayer_countdown);
        views.setTextViewText(R.id.prayer_countdown_title, title);
        views.setTextViewText(R.id.prayer_countdown_time, timeText);
        views.setChronometer(R.id.prayer_countdown_timer, elapsedBase, countDown ? "-%s" : "+%s", true);
        views.setChronometerCountDown(R.id.prayer_countdown_timer, countDown);
        views.setTextViewText(R.id.prayer_countdown_subtitle, subtitle == null ? "" : subtitle);

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentIntent = PendingIntent.getActivity(context, 0, openIntent, flags);

        Intent repostIntent = new Intent(context, PrayerCountdownReceiver.class);
        repostIntent.setAction(ACTION_REPOST);
        PendingIntent deleteIntent = PendingIntent.getBroadcast(context, 0, repostIntent, flags);

        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setCustomContentView(views)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setContentIntent(contentIntent)
            .setDeleteIntent(deleteIntent)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification);

        // Piggyback the home-screen widget's refresh on this same exact-alarm-triggered
        // transition. The widget's own countdown Chronometer has no alarm of its own — left
        // alone, it just keeps ticking past zero on whatever data was last drawn (up to
        // Android's 30-minute minimum periodic update) and visibly breaks once negative:
        // DateUtils.formatElapsedTime auto-prepends its own "-" for a negative value, which
        // then stacks with this class's own manual "-%s"/"+%s" format prefix into a "--"
        // instead of ever flipping cleanly to "+". Refreshing right here — at the same moment
        // the countdown would hit zero — means buildViews() recomputes a fresh, correct
        // countUp/countDown state before the stale Chronometer ever has a chance to go negative.
        PrayerTimesWidgetProvider.refreshAll(context);
    }

    private static void repostLastKnown(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(LAST_STATE_PREFS, Context.MODE_PRIVATE);
        String mode = prefs.getString(PREF_MODE, null);
        String label = prefs.getString(PREF_LABEL, null);
        long base = prefs.getLong(PREF_BASE, 0);
        String subtitle = prefs.getString(PREF_SUBTITLE, "");
        if (mode != null && label != null && base > 0) {
            updateNotification(context, mode, label, base, subtitle);
        }
    }

    // Used by PrayerCountdownPlugin.rearmFromPrefs, which doesn't have a fresh subtitle of its
    // own (it only re-arms alarms after reboot) — needs the last one this receiver persisted.
    static String getLastSubtitle(Context context) {
        return context.getSharedPreferences(LAST_STATE_PREFS, Context.MODE_PRIVATE)
            .getString(PREF_SUBTITLE, "");
    }

    // Used by PrayerTimesWidgetProvider so the widget's "next prayer" area shows exactly the
    // same countup/countdown state as the notification — same events, same cutoff windows —
    // instead of the widget re-deriving its own simpler (and inconsistent) version from the
    // raw prayer times.
    static String getLastMode(Context context) {
        return context.getSharedPreferences(LAST_STATE_PREFS, Context.MODE_PRIVATE).getString(PREF_MODE, null);
    }

    static String getLastLabel(Context context) {
        return context.getSharedPreferences(LAST_STATE_PREFS, Context.MODE_PRIVATE).getString(PREF_LABEL, null);
    }

    static long getLastBase(Context context) {
        return context.getSharedPreferences(LAST_STATE_PREFS, Context.MODE_PRIVATE).getLong(PREF_BASE, 0);
    }

    static void cancelNotification(Context context) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID);
        context.getSharedPreferences(LAST_STATE_PREFS, Context.MODE_PRIVATE).edit().clear().apply();
    }

    private static void createChannelIfNeeded(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null && manager.getNotificationChannel(CHANNEL_ID) == null) {
                // LOW importance + no sound: this updates several times a day and must never
                // pop up as a heads-up alert or make noise, it's ambient info only.
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Next Prayer", NotificationManager.IMPORTANCE_LOW
                );
                channel.setSound(null, null);
                manager.createNotificationChannel(channel);
            }
        }
    }
}
