package com.fedi.nur;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Pushes the day's prayer times + a subtitle (city/country + Hijri date, same string built
// for the PrayerCountdown notification) into SharedPreferences for the home-screen widget to
// read, then immediately refreshes every placed instance — mirrors the plugin -> SharedPreferences
// -> native-UI pattern PrayerCountdownPlugin already uses for the status-bar notification,
// just for AppWidgetProvider instead of a Notification.
@CapacitorPlugin(name = "PrayerWidget")
public class PrayerWidgetPlugin extends Plugin {

    static final String PREFS_NAME = "prayer_widget_data";
    static final String PREF_TIMES_JSON = "timesJson";
    static final String PREF_SUBTITLE = "subtitle";

    @PluginMethod
    public void updateWidgetData(PluginCall call) {
        JSObject times = call.getObject("times");
        if (times == null) {
            call.reject("Missing 'times' object");
            return;
        }
        String subtitle = call.getString("subtitle", "");

        Context context = getContext();
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(PREF_TIMES_JSON, times.toString())
            .putString(PREF_SUBTITLE, subtitle)
            .apply();

        PrayerTimesWidgetProvider.refreshAll(context);
        call.resolve();
    }
}
