package com.etqadem.app;

import android.app.NotificationManager;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

import java.util.Locale;

public class MainActivity extends BridgeActivity {
    // A remote main-frame load that neither finishes nor errors (black-holed
    // network) never reaches Capacitor's errorPath. This watchdog gives up on
    // it and loads the bundled offline page instead.
    private static final long LOAD_TIMEOUT_MS = 7000;

    private static volatile boolean foreground = false;

    /** True while the app is on screen (the in-app alarm rings then, not the native one). */
    static boolean isForeground() {
        return foreground;
    }

    // Back on the bundled offline page: Capacitor's JS bridge is not injected
    // there (remote-server mode), so the web code's press-twice-to-exit cannot
    // run. Handle it natively with the same pattern and copy.
    private static final long EXIT_WINDOW_MS = 2000;
    private long exitArmedAt = 0;

    /**
     * Android "Remove animations" (Developer options / Accessibility) sets the
     * animator and transition animation scales to 0, but the WebView does not
     * turn that into prefers-reduced-motion. The web app keys off
     * html[data-reduce-motion="1"] instead (motion.js, motion.css).
     */
    static boolean animationsRemoved(Context ctx) {
        try {
            android.content.ContentResolver cr = ctx.getContentResolver();
            return Settings.Global.getFloat(cr, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
                || Settings.Global.getFloat(cr, Settings.Global.TRANSITION_ANIMATION_SCALE, 1f) == 0f;
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** Synchronous read for native-shell.js, so the first paint is already still. */
    private static final class MotionBridge {
        private final Context ctx;
        MotionBridge(Context ctx) { this.ctx = ctx; }
        @JavascriptInterface
        public boolean reduced() { return animationsRemoved(ctx); }
    }

    /** Set or clear the attribute on the live page (page load, resume). */
    private void pushMotion() {
        if (getBridge() == null) return;
        final WebView wv = getBridge().getWebView();
        if (wv == null) return;
        final String js = animationsRemoved(this)
            ? "document.documentElement.setAttribute('data-reduce-motion','1')"
            : "document.documentElement.removeAttribute('data-reduce-motion')";
        wv.post(new Runnable() {
            @Override
            public void run() { wv.evaluateJavascript(js, null); }
        });
    }

    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable watchdog;
    private SessionVaultPlugin.Sync vaultSync;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TimerAlarmPlugin.class);
        registerPlugin(SessionVaultPlugin.class);
        TimerAlarmReceiver.ensureChannel(this);
        super.onCreate(savedInstanceState);
        if (getBridge() == null) return;
        // WebViewClient.onPageStarted only fires once the server starts
        // answering, so a black-holed first request never reaches it: arm
        // for the initial remote load right here.
        arm(getBridge().getWebView());
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = getBridge().getWebView();
                if (!isLocal(wv)) {
                    // Not the offline page: hand Back to Capacitor's own handler.
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                    return;
                }
                long now = System.currentTimeMillis();
                if (exitArmedAt != 0 && now - exitArmedAt <= EXIT_WINDOW_MS) {
                    exitArmedAt = 0;
                    finish();
                    return;
                }
                exitArmedAt = now;
                boolean ar = "ar".equals(Locale.getDefault().getLanguage());
                Toast.makeText(MainActivity.this,
                    ar ? "اضغط رجوع مرة أخرى للخروج" : "Press back again to exit",
                    Toast.LENGTH_SHORT).show();
            }
        });
        // Synchronous read of the Keystore-backed session record for
        // native-shell.js (must exist before sync.js runs; see SessionVaultPlugin).
        vaultSync = new SessionVaultPlugin.Sync(this, getBridge().getWebView(), getBridge().getServerUrl());
        vaultSync.lastUrl = getBridge().getServerUrl();
        getBridge().getWebView().addJavascriptInterface(vaultSync, "EtqSessionVault");
        getBridge().getWebView().addJavascriptInterface(new MotionBridge(this), "EtqMotion");
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView webView) {
                String u = webView.getUrl();
                if (vaultSync != null && u != null) vaultSync.lastUrl = u;
                arm(webView);
            }

            // First paint of the main frame = it is alive; a slow but healthy
            // load is left to finish (the web boot loader has its own cap).
            @Override
            public void onPageCommitVisible(WebView webView, String url) {
                disarm();
                pushMotion();
            }

            @Override
            public void onPageLoaded(WebView webView) {
                disarm();
                pushMotion();
            }

            @Override
            public void onReceivedError(WebView webView) {
                disarm();
            }
        });
    }

    private boolean isLocal(WebView webView) {
        String url = webView.getUrl();
        if (url == null) return false;
        String host = Uri.parse(url).getHost();
        return "localhost".equals(host);
    }

    private void arm(final WebView webView) {
        disarm();
        if (isLocal(webView)) return; // the bundled page cannot hang
        watchdog = new Runnable() {
            @Override
            public void run() {
                watchdog = null;
                if (isLocal(webView)) return;
                String errorUrl = getBridge().getErrorUrl();
                if (errorUrl != null) webView.loadUrl(errorUrl + "#timeout");
            }
        };
        handler.postDelayed(watchdog, LOAD_TIMEOUT_MS);
    }

    private void disarm() {
        if (watchdog != null) {
            handler.removeCallbacks(watchdog);
            watchdog = null;
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        foreground = true;
        // The user can flip "Remove animations" while the app is in the background.
        pushMotion();
        // Back in the app: stop a still-ringing timer notification (a pending
        // alarm, if the timer is still running, stays scheduled).
        ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).cancel(4242);
    }

    @Override
    public void onPause() {
        foreground = false;
        super.onPause();
    }

    @Override
    public void onDestroy() {
        disarm();
        super.onDestroy();
    }
}
