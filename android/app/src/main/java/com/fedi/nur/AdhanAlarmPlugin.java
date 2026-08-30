package com.fedi.nur;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// Schedules a second, independent set of native alarms alongside the existing
// LocalNotifications prayer notifications — these exist only to play the user's actual
// uploaded adhan audio (via AdhanRingService), which LocalNotifications' `sound` option
// can't do since it only accepts a bundled res/raw resource, never a filesystem path.
@CapacitorPlugin(name = "AdhanAlarm")
public class AdhanAlarmPlugin extends Plugin {

    static final String PREFS_NAME = "adhan_alarms";
    static final String PREFS_KEY_ALARMS = "alarms";

    @PluginMethod
    public void scheduleAdhanAlarms(PluginCall call) {
        JSArray alarms = call.getArray("alarms");
        if (alarms == null) {
            call.reject("Missing 'alarms' array");
            return;
        }

        Context context = getContext();
        cancelAll(context);

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        JSONArray toPersist = new JSONArray();
        long now = System.currentTimeMillis();

        try {
            for (int i = 0; i < alarms.length(); i++) {
                JSONObject alarm = alarms.getJSONObject(i);
                int id = alarm.getInt("id");
                long atMillis = alarm.getLong("atMillis");
                String prayerLabel = alarm.optString("prayerLabel", "");
                String soundPath = alarm.optString("soundPath", "");
                String soundMime = alarm.optString("soundMime", "");
                int volumePercent = alarm.optInt("volumePercent", 100);
                boolean flipToStop = alarm.optBoolean("flipToStop", true);

                if (atMillis <= now || soundPath.isEmpty()) continue;

                PendingIntent pendingIntent = buildPendingIntent(context, id, prayerLabel, soundPath, soundMime, volumePercent, flipToStop);
                if (alarmManager != null) {
                    scheduleExact(context, alarmManager, atMillis, pendingIntent);
                }

                JSONObject entry = new JSONObject();
                entry.put("id", id);
                entry.put("atMillis", atMillis);
                entry.put("prayerLabel", prayerLabel);
                entry.put("soundPath", soundPath);
                entry.put("soundMime", soundMime);
                entry.put("volumePercent", volumePercent);
                entry.put("flipToStop", flipToStop);
                toPersist.put(entry);
            }

            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(PREFS_KEY_ALARMS, toPersist.toString())
                .apply();

            call.resolve();
        } catch (JSONException e) {
            call.reject("Failed to schedule adhan alarms", e);
        }
    }

    @PluginMethod
    public void cancelAdhanAlarms(PluginCall call) {
        cancelAll(getContext());
        call.resolve();
    }

    // Kept in memory only (not SharedPreferences) — this is purely for the in-app preview
    // button in Adhan Settings while the screen is open, nothing here needs to survive the
    // app being killed. A web <audio> element is always routed through the Media stream, and
    // MediaPlayer.setVolume()/audio.volume can never exceed that stream's current system
    // level — same ceiling problem as the real adhan alarm, same fix: briefly move the actual
    // slider to the chosen percentage, then put it back when the preview stops.
    private Integer previousMediaVolume;

    @PluginMethod
    public void boostMediaVolume(PluginCall call) {
        int percent = call.getInt("percent", 100);
        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                previousMediaVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
                int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                int min = audioManager.getStreamMinVolume(AudioManager.STREAM_MUSIC);
                int target = Math.round(max * (Math.max(0, Math.min(100, percent)) / 100f));
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, Math.max(min, target), 0);
            }
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    @PluginMethod
    public void restoreMediaVolume(PluginCall call) {
        if (previousMediaVolume != null) {
            try {
                AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
                if (audioManager != null) {
                    audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, previousMediaVolume, 0);
                }
            } catch (Exception ignored) {
            }
            previousMediaVolume = null;
        }
        call.resolve();
    }

    // setAlarmClock (rather than setExactAndAllowWhileIdle) is what actually guarantees the
    // OS treats this as top-priority — exempt from Doze/battery-optimization entirely, and
    // one of the few documented, reliable exemptions from Android's foreground-service
    // background-start restrictions. Confirmed via device logs that setExactAndAllowWhileIdle
    // alone was NOT enough on this Samsung device: the alarm fired, but AdhanRingService's
    // startForegroundService() call was denied by the OS (ForegroundServiceStartNotAllowedException),
    // crashing the receiver silently in the background — exactly why the adhan never sounded.
    private static void scheduleExact(Context context, AlarmManager alarmManager, long atMillis, PendingIntent pendingIntent) {
        Intent showIntent = new Intent(context, MainActivity.class);
        showIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int showFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            showFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent showPendingIntent = PendingIntent.getActivity(context, 0, showIntent, showFlags);
        alarmManager.setAlarmClock(new AlarmManager.AlarmClockInfo(atMillis, showPendingIntent), pendingIntent);
    }

    static void cancelAll(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        try {
            JSONArray arr = new JSONArray(prefs.getString(PREFS_KEY_ALARMS, "[]"));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject entry = arr.getJSONObject(i);
                PendingIntent pendingIntent = buildPendingIntent(
                    context,
                    entry.getInt("id"),
                    entry.optString("prayerLabel", ""),
                    entry.optString("soundPath", ""),
                    entry.optString("soundMime", ""),
                    entry.optInt("volumePercent", 100),
                    entry.optBoolean("flipToStop", true)
                );
                if (alarmManager != null) alarmManager.cancel(pendingIntent);
            }
        } catch (JSONException ignored) {
        }
        prefs.edit().remove(PREFS_KEY_ALARMS).apply();
    }

    // Called by AdhanBootReceiver after a reboot clears every AlarmManager entry — re-arms
    // whatever is still in the future from the last persisted schedule, entirely natively.
    static void rearmFromPrefs(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        long now = System.currentTimeMillis();
        try {
            JSONArray arr = new JSONArray(prefs.getString(PREFS_KEY_ALARMS, "[]"));
            JSONArray stillFuture = new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject entry = arr.getJSONObject(i);
                long atMillis = entry.getLong("atMillis");
                if (atMillis <= now) continue;
                PendingIntent pendingIntent = buildPendingIntent(
                    context,
                    entry.getInt("id"),
                    entry.optString("prayerLabel", ""),
                    entry.optString("soundPath", ""),
                    entry.optString("soundMime", ""),
                    entry.optInt("volumePercent", 100),
                    entry.optBoolean("flipToStop", true)
                );
                if (alarmManager != null) scheduleExact(context, alarmManager, atMillis, pendingIntent);
                stillFuture.put(entry);
            }
            prefs.edit().putString(PREFS_KEY_ALARMS, stillFuture.toString()).apply();
        } catch (JSONException ignored) {
        }
    }

    private static PendingIntent buildPendingIntent(Context context, int id, String prayerLabel, String soundPath, String soundMime, int volumePercent, boolean flipToStop) {
        Intent intent = new Intent(context, AdhanAlarmReceiver.class);
        intent.setAction(AdhanAlarmReceiver.ACTION_RING);
        intent.putExtra(AdhanAlarmReceiver.EXTRA_ID, id);
        intent.putExtra(AdhanAlarmReceiver.EXTRA_PRAYER_LABEL, prayerLabel);
        intent.putExtra(AdhanAlarmReceiver.EXTRA_SOUND_PATH, soundPath);
        intent.putExtra(AdhanAlarmReceiver.EXTRA_SOUND_MIME, soundMime);
        intent.putExtra(AdhanAlarmReceiver.EXTRA_VOLUME_PERCENT, volumePercent);
        intent.putExtra(AdhanAlarmReceiver.EXTRA_FLIP_TO_STOP, flipToStop);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(context, id, intent, flags);
    }
}
