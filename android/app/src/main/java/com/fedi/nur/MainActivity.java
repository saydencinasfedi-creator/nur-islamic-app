package com.fedi.nur;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local (non-npm) plugins aren't auto-discovered — must be registered explicitly,
        // and before super.onCreate() so the bridge picks it up on this activity's launch.
        registerPlugin(AdhanAlarmPlugin.class);
        registerPlugin(PrayerCountdownPlugin.class);
        registerPlugin(PrayerWidgetPlugin.class);
        registerPlugin(CompassAccuracyPlugin.class);

        // True edge-to-edge: the WebView draws underneath the (hidden) status bar and the
        // camera-cutout area instead of Android auto-reserving that space, which is what
        // makes it possible for CSS env(safe-area-inset-top) to report the real cutout
        // height so the web layer can keep content clear of it.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        super.onCreate(savedInstanceState);
        hideStatusBar();
        // The fading scroll-position indicator on scroll is drawn natively by the Android
        // WebView itself (not a CSS `::-webkit-scrollbar`, which is already hidden in
        // index.css) — has to be turned off here instead.
        getBridge().getWebView().setVerticalScrollBarEnabled(false);
        getBridge().getWebView().setHorizontalScrollBarEnabled(false);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Android re-shows system bars whenever the window regains focus (e.g. after the
        // keyboard closes), so re-hide every time instead of only once in onCreate.
        if (hasFocus) {
            hideStatusBar();
        }
    }

    private void hideStatusBar() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        // Swiping from the top reveals it temporarily; it hides itself again afterwards
        // instead of staying shown until dismissed.
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.statusBars());
    }
}
