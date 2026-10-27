package com.etqadem.app;

import java.net.URI;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Builds the document-start script that hands the native session vault value
 * (and the "Remove animations" flag) to the app's own pages, and the origin
 * allow-list it is scoped to. Pure functions so they are unit-testable on the JVM.
 *
 * The script is registered with WebViewCompat.addDocumentStartJavaScript and an
 * origin allow-list, so it is never injected into a third-party frame (the
 * YouTube embeds); it also bails out unless it runs in the top frame.
 */
final class DocStartScript {
    private DocStartScript() {}

    /** Origin of the bundled offline page (capacitor.config.ts androidScheme: https). */
    static final String LOCAL_ORIGIN = "https://localhost";

    /**
     * @param vaultValue the stored session record JSON, or null/"" when empty
     *                   (the page still gets the marker "" so it knows the vault path is active)
     * @param reduceMotion Android "Remove animations" is on
     */
    static String build(String vaultValue, boolean reduceMotion) {
        return build(vaultValue, reduceMotion, false);
    }

    /** @param debuggable the APK is a debug build: the ads bridge then uses Google's test ad units only */
    static String build(String vaultValue, boolean reduceMotion, boolean debuggable) {
        return "(function(){try{if(window!==window.top)return;"
            + "window.__etqVault=" + quote(vaultValue == null ? "" : vaultValue) + ";"
            + "window.__etqMotion=" + (reduceMotion ? "true" : "false") + ";"
            + "window.__etqDebug=" + (debuggable ? "true" : "false") + ";"
            + "}catch(e){}})();";
    }

    /**
     * JS string literal, safe inside any script context: escapes quotes,
     * backslashes, control characters, U+2028/U+2029 (line terminators in
     * pre-ES2019 JS) and the characters &lt; &gt; &amp; and / so a script
     * closing tag can never appear in the output.
     */
    static String quote(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 2).append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                case '/': sb.append("\\/"); break;
                case '<': case '>': case '&': case ' ': case ' ':
                    sb.append(String.format("\\u%04x", (int) c)); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.append('"').toString();
    }

    /** scheme://host[:port] of a URL, lower-cased; null if it has no http(s) origin. */
    static String originOf(String url) {
        if (url == null) return null;
        try {
            URI u = new URI(url.trim());
            String scheme = u.getScheme();
            String host = u.getHost();
            if (scheme == null || host == null) return null;
            scheme = scheme.toLowerCase();
            if (!scheme.equals("https") && !scheme.equals("http")) return null;
            return scheme + "://" + host.toLowerCase() + (u.getPort() == -1 ? "" : ":" + u.getPort());
        } catch (Exception e) {
            return null;
        }
    }

    /** Origins that may receive the script: the app's server origin plus the bundled page. */
    static Set<String> allowedOrigins(String serverUrl) {
        Set<String> s = new LinkedHashSet<>();
        String o = originOf(serverUrl);
        if (o != null) s.add(o);
        s.add(LOCAL_ORIGIN);
        return Collections.unmodifiableSet(s);
    }
}
