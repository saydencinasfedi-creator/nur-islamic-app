package com.fedi.nur;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;
import android.text.format.DateFormat;
import android.widget.RemoteViews;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Date;

// Home-screen widget: a small date/location strip + the next prayer with a live countdown
// on top, all 5 prayers side by side underneath (the next one highlighted the same bright
// green). There's no native prayer-time calculation here — this only ever displays whatever
// PrayerWidgetPlugin last wrote to SharedPreferences from the JS side (see
// services/prayerService.ts + hooks/useNotificationEngine.ts), the same way
// PrayerCountdownReceiver displays what PrayerCountdownPlugin last wrote for the notification.
public class PrayerTimesWidgetProvider extends AppWidgetProvider {

    private static final String[] PRAYER_KEYS = { "Fajr", "Dhuhr", "Asr", "Maghrib", "Isha" };
    private static final int HIGHLIGHT_TEXT = 0xFF0B1F17;
    private static final int NORMAL_TEXT = 0xFFFFFFFF;
    private static final int NORMAL_LABEL_TEXT = 0xCCFFFFFF;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        RemoteViews views = buildViews(context);
        for (int appWidgetId : appWidgetIds) {
            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    // Called by PrayerWidgetPlugin right after it persists fresh data, so placed widgets
    // update immediately instead of waiting for Android's own (min 30-minute) update cycle.
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, PrayerTimesWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(provider);
        if (ids.length == 0) return;
        RemoteViews views = buildViews(context);
        for (int id : ids) {
            manager.updateAppWidget(id, views);
        }
    }

    private static RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_prayer_times);

        SharedPreferences prefs = context.getSharedPreferences(PrayerWidgetPlugin.PREFS_NAME, Context.MODE_PRIVATE);
        String timesJson = prefs.getString(PrayerWidgetPlugin.PREF_TIMES_JSON, null);
        String subtitle = prefs.getString(PrayerWidgetPlugin.PREF_SUBTITLE, "");

        int[] labelIds = { R.id.widget_label_fajr, R.id.widget_label_dhuhr, R.id.widget_label_asr, R.id.widget_label_maghrib, R.id.widget_label_isha };
        int[] timeIds = { R.id.widget_time_fajr, R.id.widget_time_dhuhr, R.id.widget_time_asr, R.id.widget_time_maghrib, R.id.widget_time_isha };
        int[] rowIds = { R.id.widget_row_fajr, R.id.widget_row_dhuhr, R.id.widget_row_asr, R.id.widget_row_maghrib, R.id.widget_row_isha };

        // Always highlighted — this area always shows whichever prayer is currently active.
        views.setInt(R.id.widget_next_prayer_area, "setBackgroundResource", R.drawable.widget_highlight);

        // Bottom row: just the 5 raw prayer times, independent of the countdown state below.
        if (timesJson == null) {
            for (int i = 0; i < PRAYER_KEYS.length; i++) {
                views.setTextViewText(labelIds[i], PRAYER_KEYS[i]);
                views.setTextViewText(timeIds[i], "--:--");
            }
        } else {
            try {
                JSONObject times = new JSONObject(timesJson);
                for (int i = 0; i < PRAYER_KEYS.length; i++) {
                    views.setTextViewText(labelIds[i], PRAYER_KEYS[i]);
                    views.setTextViewText(timeIds[i], formatTime(context, times.optString(PRAYER_KEYS[i], "")));
                }
            } catch (JSONException e) {
                for (int i = 0; i < PRAYER_KEYS.length; i++) {
                    views.setTextViewText(labelIds[i], PRAYER_KEYS[i]);
                    views.setTextViewText(timeIds[i], "--:--");
                }
            }
        }

        // Top area + which prayer to highlight: read from the exact same state
        // PrayerCountdownReceiver already maintains for the permanent notification (same
        // countup/countdown events, same per-prayer cutoff windows — see
        // hooks/useNotificationEngine.ts's buildCountdownEvents) instead of deriving a
        // separate, simpler version here that could disagree with what the notification shows.
        String label = PrayerCountdownReceiver.getLastLabel(context);
        String mode = PrayerCountdownReceiver.getLastMode(context);
        long base = PrayerCountdownReceiver.getLastBase(context);

        int highlightIndex = -1;
        if (label != null && base > 0) {
            views.setTextViewText(R.id.widget_subtitle, subtitle);
            views.setTextViewText(R.id.widget_next_label, label);
            boolean countUp = "countup".equals(mode);
            long elapsedBase = SystemClock.elapsedRealtime() + (base - System.currentTimeMillis());
            views.setChronometer(R.id.widget_next_chronometer, elapsedBase, countUp ? "+%s" : "-%s", true);
            views.setChronometerCountDown(R.id.widget_next_chronometer, !countUp);
            for (int i = 0; i < PRAYER_KEYS.length; i++) {
                if (PRAYER_KEYS[i].equals(label)) { highlightIndex = i; break; }
            }
        } else {
            views.setTextViewText(R.id.widget_subtitle, timesJson == null ? "Open Nur to load today's prayer times" : subtitle);
            views.setTextViewText(R.id.widget_next_label, "--");
        }

        for (int i = 0; i < rowIds.length; i++) {
            boolean highlight = i == highlightIndex;
            views.setInt(rowIds[i], "setBackgroundResource", highlight ? R.drawable.widget_highlight : 0);
            views.setTextColor(labelIds[i], highlight ? HIGHLIGHT_TEXT : NORMAL_LABEL_TEXT);
            views.setTextColor(timeIds[i], highlight ? HIGHLIGHT_TEXT : NORMAL_TEXT);
        }

        return finishViews(context, views);
    }

    private static RemoteViews finishViews(Context context, RemoteViews views) {
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, openIntent, flags));
        return views;
    }

    private static Date toToday(String hhmm) {
        String[] parts = hhmm.split(":");
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, Integer.parseInt(parts[0]));
        cal.set(Calendar.MINUTE, Integer.parseInt(parts[1]));
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        return cal.getTime();
    }

    private static String formatTime(Context context, String hhmm) {
        if (hhmm == null || hhmm.isEmpty()) return "--:--";
        try {
            return DateFormat.getTimeFormat(context).format(toToday(hhmm));
        } catch (Exception e) {
            return hhmm;
        }
    }
}
