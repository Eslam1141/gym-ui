package com.etqadem.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Keystore-backed storage for the app-session refresh record
 * (see {@link SessionVault}). Web side: native-shell.js.
 *
 * Writes go through the plugin (set / clear, async). There is no plugin read:
 * the web layer never needed one and it would be one more way to reach the
 * token. Capacitor's bridge (MessageHandler) accepts plugin calls only from the
 * main frame when it can use addWebMessageListener; when it cannot (see the
 * README note) it falls back to addJavascriptInterface("androidBridge"), which
 * every frame can post to, though replies still go only to the main frame.
 *
 * The web layer needs a SYNCHRONOUS read before sync.js runs, which a plugin
 * call cannot give. There is deliberately NO JavaScript interface for it
 * (those are injected into every frame, third-party iframes such as YouTube
 * included). Instead MainActivity pushes the value into the page with a
 * document-start script scoped to the app's origins (see {@link DocStartScript}),
 * and re-registers it after every successful set / clear below so the next
 * page load sees the new value.
 */
@CapacitorPlugin(name = "SessionVault")
public class SessionVaultPlugin extends Plugin {

    @PluginMethod
    public void set(PluginCall call) {
        String v = call.getString("value");
        if (v == null || v.isEmpty()) {
            call.reject("value is required");
            return;
        }
        if (SessionVault.set(getContext(), v)) {
            refreshScript();
            call.resolve();
        } else call.reject("keystore unavailable");
    }

    @PluginMethod
    public void clear(PluginCall call) {
        SessionVault.clear(getContext());
        refreshScript();
        call.resolve();
    }

    private void refreshScript() {
        if (getActivity() instanceof MainActivity) ((MainActivity) getActivity()).refreshDocStartScript();
    }
}
