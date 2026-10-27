package com.etqadem.app;

import android.app.NotificationManager;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.webkit.ScriptHandler;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

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
    private ScriptHandler docStartHandler;

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
        // Hand the Keystore-backed session record and the reduced-motion flag
        // to the app's own pages before any page script runs (native-shell.js).
        // No JavascriptInterface: those reach every frame, YouTube included.
        refreshDocStartScript();
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView webView) {
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

    /**
     * (Re)registers the document-start script with the current vault value and
     * animation setting, scoped to the app's origins. Takes effect for the next
     * document load (the live page keeps its in-memory copy, and pushMotion()
     * updates its motion attribute). Safe to call from any thread.
     */
    void refreshDocStartScript() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() { registerDocStartScript(); }
        });
    }

    private void registerDocStartScript() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        // Unsupported WebView: no marker, the page keeps its localStorage session store.
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return;
        try {
            String script = DocStartScript.build(SessionVault.get(this), animationsRemoved(this),
                (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0);
            ScriptHandler next = WebViewCompat.addDocumentStartJavaScript(
                getBridge().getWebView(), script, DocStartScript.allowedOrigins(getBridge().getServerUrl()));
            if (docStartHandler != null) docStartHandler.remove();
            docStartHandler = next;
        } catch (RuntimeException e) {
            // Invalid origin rule or WebView gone: leave the previous script (or none) in place.
        }
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
        registerDocStartScript(); // keep the next page load's motion flag current
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
