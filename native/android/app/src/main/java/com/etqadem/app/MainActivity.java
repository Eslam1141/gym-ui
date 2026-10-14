package com.etqadem.app;

import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    // A remote main-frame load that neither finishes nor errors (black-holed
    // network) never reaches Capacitor's errorPath. This watchdog gives up on
    // it and loads the bundled offline page instead.
    private static final long LOAD_TIMEOUT_MS = 7000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable watchdog;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() == null) return;
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
            }

            @Override
            public void onPageLoaded(WebView webView) {
                disarm();
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
    public void onDestroy() {
        disarm();
        super.onDestroy();
    }
}
