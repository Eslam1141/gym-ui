package com.etqadem.app;

import android.content.Context;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Keystore-backed storage for the app-session refresh record
 * (see {@link SessionVault}). Web side: native-shell.js.
 *
 * Writes go through the plugin (set / clear, async). The web layer needs a
 * SYNCHRONOUS read before sync.js runs, which a plugin call cannot give, so
 * the same vault is also exposed as {@link Sync} (window.EtqSessionVault,
 * read-only getSync) via addJavascriptInterface, installed before the page loads.
 */
@CapacitorPlugin(name = "SessionVault")
public class SessionVaultPlugin extends Plugin {

    @PluginMethod
    public void get(PluginCall call) {
        JSObject res = new JSObject();
        String v = SessionVault.get(getContext());
        res.put("value", v == null ? JSObject.NULL : v);
        call.resolve(res);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String v = call.getString("value");
        if (v == null || v.isEmpty()) {
            call.reject("value is required");
            return;
        }
        if (SessionVault.set(getContext(), v)) call.resolve();
        else call.reject("keystore unavailable");
    }

    @PluginMethod
    public void clear(PluginCall call) {
        SessionVault.clear(getContext());
        call.resolve();
    }

    /** Synchronous read-only bridge, answers only for the app's own pages. */
    static final class Sync {
        private final Context ctx;
        private final WebView webView;
        private final String trustedHost;

        Sync(Context ctx, WebView webView, String serverUrl) {
            this.ctx = ctx.getApplicationContext();
            this.webView = webView;
            String h = null;
            try { h = serverUrl == null ? null : Uri.parse(serverUrl).getHost(); } catch (Exception ignored) {}
            this.trustedHost = h;
        }

        @JavascriptInterface
        public String getSync() {
            try {
                // Called on a WebView background thread: getUrl() must not be
                // used here, so the host check is against the URL the activity
                // last saw (updated on the main thread).
                String url = lastUrl;
                String host = url == null ? null : Uri.parse(url).getHost();
                if (host == null || !(host.equals("localhost") || host.equals(trustedHost))) return "";
                String v = SessionVault.get(ctx);
                return v == null ? "" : v;
            } catch (Throwable t) {
                return "";
            }
        }

        volatile String lastUrl;
    }
}
