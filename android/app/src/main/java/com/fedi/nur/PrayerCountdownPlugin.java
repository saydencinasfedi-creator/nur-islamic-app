package com.fedi.nur;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// Schedules the transitions for the permanent "next prayer" status-bar notification — separate
// from AdhanAlarmPlugin (that one starts a foreground Service to play audio, which is why it
// needs setAlarmClock's foreground-service-start exemption). This one only ever reposts a
// notification via a plain BroadcastReceiver, which has no such restriction, so a simpler
// setExactAndAllowWhileIdle is enough.
@CapacitorPlugin(name = "PrayerCountdown")
public class PrayerCountdownPlugin extends Plugin {

    static final String PREFS_NAME = "prayer_countdown_events";
    static final String PREFS_KEY_EVENTS = "events";

    @PluginMethod
    public void scheduleCountdown(PluginCall call) {
        JSArray events = call.getArray("events");
        if (events == null) {
            call.reject("Missing 'events' array");
            return;
        }
        String subtitle = call.getString("subtitle", "");

        Context context = getContext();
        cancelAll(context);

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        JSONArray toPersist = new JSONArray();
        long now = System.currentTimeMillis();
        // The already-passed event with the latest atMillis — the state the notification
        // should reflect right now, without waiting for the next alarm to fire.
        JSONObject currentEvent = null;

        try {
            for (int i = 0; i < events.length(); i++) {
                JSONObject event = events.getJSONObject(i);
                long atMillis = event.getLong("atMillis");
                String label = event.optString("label", "");
                if (label.isEmpty()) continue;

                if (atMillis <= now) {
                    if (currentEvent == null || atMillis > currentEvent.getLong("atMillis")) {
                        currentEvent = event;
                    }
                    continue; // only future events get scheduled/persisted
                }

                int id = event.getInt("id");
                String mode = event.optString("mode", "countdown");
                long chronometerBase = event.optLong("chronometerBaseMillis", atMillis);

                PendingIntent pendingIntent = buildPendingIntent(context, id, mode, label, chronometerBase);
                if (alarmManager != null) {
                    scheduleExact(alarmManager, atMillis, pendingIntent);
                }

                JSONObject entry = new JSONObject();
                entry.put("id", id);
                entry.put("atMillis", atMillis);
                entry.put("mode", mode);
                entry.put("label", label);
                entry.put("chronometerBaseMillis", chronometerBase);
                toPersist.put(entry);
            }

            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(PREFS_KEY_EVENTS, toPersist.toString())
                .apply();

            if (currentEvent != null) {
                PrayerCountdownReceiver.updateNotification(
                    context,
                    currentEvent.optString("mode", "countdown"),
                    currentEvent.optString("label", ""),
                    currentEvent.optLong("chronometerBaseMillis", now),
                    subtitle
                );
            }

            call.resolve();
        } catch (JSONException e) {
            call.reject("Failed to schedule prayer countdown", e);
        }
    }

    @PluginMethod
    public void cancelCountdown(PluginCall call) {
        cancelAll(getContext());
        PrayerCountdownReceiver.cancelNotification(getContext());
        call.resolve();
    }

    private static void scheduleExact(AlarmManager alarmManager, long atMillis, PendingIntent pendingIntent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pendingIntent);
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, atMillis, pendingIntent);
        }
    }

    static void cancelAll(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        try {
            JSONArray arr = new JSONArray(prefs.getString(PREFS_KEY_EVENTS, "[]"));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject entry = arr.getJSONObject(i);
                PendingIntent pendingIntent = buildPendingIntent(
                    context,
                    entry.getInt("id"),
                    entry.optString("mode", "countdown"),
                    entry.optString("label", ""),
                    entry.optLong("chronometerBaseMillis", 0)
                );
                if (alarmManager != null) alarmManager.cancel(pendingIntent);
            }
        } catch (JSONException ignored) {
        }
        prefs.edit().remove(PREFS_KEY_EVENTS).apply();
    }

    // Called by AdhanBootReceiver after a reboot/app-update clears every AlarmManager entry —
    // re-arms whatever is still upcoming from the last persisted schedule, and immediately
    // reposts the notification for whatever event is now the "current" one.
    static void rearmFromPrefs(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        long now = System.currentTimeMillis();
        JSONObject currentEvent = null;
        try {
            JSONArray arr = new JSONArray(prefs.getString(PREFS_KEY_EVENTS, "[]"));
            JSONArray stillFuture = new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject entry = arr.getJSONObject(i);
                long atMillis = entry.getLong("atMillis");
                if (atMillis <= now) {
                    if (currentEvent == null || atMillis > currentEvent.getLong("atMillis")) {
                        currentEvent = entry;
                    }
                    continue;
                }
                PendingIntent pendingIntent = buildPendingIntent(
                    context,
                    entry.getInt("id"),
                    entry.optString("mode", "countdown"),
                    entry.optString("label", ""),
                    entry.optLong("chronometerBaseMillis", atMillis)
                );
                if (alarmManager != null) scheduleExact(alarmManager, atMillis, pendingIntent);
                stillFuture.put(entry);
            }
            prefs.edit().putString(PREFS_KEY_EVENTS, stillFuture.toString()).apply();
            if (currentEvent != null) {
                PrayerCountdownReceiver.updateNotification(
                    context,
                    currentEvent.optString("mode", "countdown"),
                    currentEvent.optString("label", ""),
                    currentEvent.optLong("chronometerBaseMillis", now),
                    PrayerCountdownReceiver.getLastSubtitle(context)
                );
            }
        } catch (JSONException ignored) {
        }
    }

    private static PendingIntent buildPendingIntent(Context context, int id, String mode, String label, long chronometerBase) {
        Intent intent = new Intent(context, PrayerCountdownReceiver.class);
        intent.setAction(PrayerCountdownReceiver.ACTION_UPDATE);
        intent.putExtra(PrayerCountdownReceiver.EXTRA_MODE, mode);
        intent.putExtra(PrayerCountdownReceiver.EXTRA_LABEL, label);
        intent.putExtra(PrayerCountdownReceiver.EXTRA_CHRONOMETER_BASE, chronometerBase);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(context, id, intent, flags);
    }
}
