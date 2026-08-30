package com.fedi.nur;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// Android clears every AlarmManager alarm both on reboot AND whenever the app itself is
// updated/reinstalled (ACTION_MY_PACKAGE_REPLACED) — confirmed the hard way: a Maghrib alarm
// silently never fired because the app had been reinstalled shortly before it, and hadn't
// been reopened since (which is the only other place these get re-armed). The JS side only
// re-schedules when the app is next opened, which could be a while later within the rolling
// prayer window — so this re-arms both native alarm sets (adhan audio + the persistent
// countdown notification) from their last persisted schedules, fully natively, without
// needing the WebView to run or the user to remember to open the app after an update.
public class AdhanBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) return;
        AdhanAlarmPlugin.rearmFromPrefs(context);
        PrayerCountdownPlugin.rearmFromPrefs(context);
    }
}
