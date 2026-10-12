package com.vedixsolutions.pos;

import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Capacitor requires plugins to be registered before the bridge starts.
        registerPlugin(HardwarePlugin.class);

        super.onCreate(savedInstanceState);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (getBridge() != null && getBridge().getWebView() != null) {
            cookieManager.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
        }

        applySystemBarInsets();
    }

    // Android 15 enforces edge-to-edge, so the WebView is laid out behind the
    // status and navigation bars and the app's own header ends up underneath
    // the clock — visible but untappable. Padding the content view by the bar
    // insets keeps the page clear of them on every Android version, without
    // the web app needing to know it is running in a shell.
    private void applySystemBarInsets() {
        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        // The app header behind the status bar is light, so the clock and
        // icons need to be dark to stay readable.
        WindowInsetsControllerCompat controller =
            ViewCompat.getWindowInsetsController(getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(true);
            controller.setAppearanceLightNavigationBars(true);
        }
    }

    // The WebView holds cookies in memory and only guarantees writing them to
    // disk on an explicit flush. Without this the sign-in cookie dies with the
    // process, so closing the app logs the cashier out.
    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    public void onStop() {
        super.onStop();
        CookieManager.getInstance().flush();
    }
}
