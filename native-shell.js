/* native-shell.js — glue between the web app and the Capacitor Android shell
 * (native/). Every branch feature-detects, so in a browser / PWA this file
 * does nothing. Plugins are looked up when init() runs (not at parse time) so
 * tests can stub window.Capacitor after load and call GymNativeShell.init().
 *
 *  - App version: window.GYM_APP_VERSION = the app's versionName
 *    (@capacitor/app getInfo), read by feedback.js for context.appVersion.
 *    Unset on the web: there is no build-time version there.
 *  - Hardware Back: closes the top open sheet/dialog (.syd) or the ringing
 *    timer banner first, then the in-app Back stack (GymUI.back: previous
 *    tab / sub-screen), then history, then Plan, then (Back twice within 2 s
 *    on Plan, with a toast) exits the app.
 *  - Session store: window.GymSessionStore {get,set,clear} (read by sync.js)
 *    keeps the app-session refresh record in Android Keystore-backed storage
 *    (native SessionVault plugin). get() is synchronous: native pushes the value
 *    into the page with a document-start script (WebViewCompat
 *    .addDocumentStartJavaScript, scoped to the app's own origins and the top
 *    frame only) that sets window.__etqVault = "<record JSON>" ("" = empty
 *    vault). It is read once at parse time and deleted from window right away,
 *    so it exists before the deferred sync.js runs. There is deliberately no
 *    JavascriptInterface for it: those reach third-party iframes (YouTube).
 *    set/clear write through to the plugin in order (native re-registers the
 *    script then, for the next load). A leftover localStorage
 *    "gymauth_refresh" is moved into the vault. Not defined on the web, or if
 *    the marker is absent (a WebView without DOCUMENT_START_SCRIPT, or the
 *    plugin missing): sync.js then keeps using localStorage.
 *  - System bar icons: Capacitor core SystemBars.setStyle follows the APP theme
 *    (data-theme), not the phone's: dark app = style DARK (light icons), light
 *    app = style LIGHT (dark icons). Re-applied whenever data-theme changes.
 *  - Remove animations: html[data-reduce-motion="1"] mirrors Android's animator /
 *    transition animation scale = 0 (WebView does not set prefers-reduced-motion
 *    for it). Native sets window.__etqMotion (true/false) with the same document-start
 *    script (read once at parse time, then deleted) and keeps the attribute
 *    current by evaluateJavascript (page load, resume).
 *  - startUpdate(): Play In-App Updates immediate flow for the "Update required"
 *    page (force-update.js); see the function. Back is ignored while
 *    GymForceUpdate.isBlocking().
 *  - Deletes the superseded "rest-timer" notification channel (the timers
 *    use "timer-alarm" now); a no-op once it is gone.
 */
(function () {
  "use strict";
  var started = false;

  function cap() {
    var c = window.Capacitor;
    try {
      if (!c || typeof c.isNativePlatform !== "function" || !c.isNativePlatform()) return null;
    } catch (e) { return null; }
    return c;
  }
  function plugin(c, name) { return (c.Plugins && c.Plugins[name]) || null; }

  // ---- session store (see header) ----
  var LS_KEY = "gymauth_refresh";
  var sessionInstalled = false;

  function validRec(r) { return r && typeof r === "object" && typeof r.rt === "string" && r.rt ? r : null; }
  function parseRec(raw) {
    if (typeof raw !== "string" || !raw) return null;
    try { return validRec(JSON.parse(raw)); } catch (e) { return null; }
  }

  // Read at parse time, before anything else can look at it, then removed.
  var vaultMarker, motionMarker;
  try {
    vaultMarker = window.__etqVault; motionMarker = window.__etqMotion;
    delete window.__etqVault; delete window.__etqMotion;
  } catch (e) {}

  function installSessionStore() {
    if (sessionInstalled) return;
    var c = cap();
    if (!c) return;
    var vault = plugin(c, "SessionVault");
    // One-shot marker from the native document-start script; take it and remove it.
    var raw = vaultMarker;
    if (!vault || typeof raw !== "string") return; // keep sync.js's localStorage store
    sessionInstalled = true;

    var cache = parseRec(raw);

    // Writes are chained so a clear() right after a set() cannot be overtaken.
    var chain = Promise.resolve();
    function queue(fn) {
      chain = chain.then(function () {
        try { return Promise.resolve(fn()).catch(function () {}); } catch (e) {}
      });
      return chain;
    }
    function persist(rec) { return queue(function () { return vault.set({ value: JSON.stringify(rec) }); }); }

    // Migration: an older build (or a pre-vault session) left the token in localStorage.
    var legacy = null;
    try { legacy = parseRec(localStorage.getItem(LS_KEY)); } catch (e) {}
    var legacyPresent = false;
    try { legacyPresent = localStorage.getItem(LS_KEY) !== null; } catch (e) {}
    if (legacyPresent) {
      if (!cache && legacy) {
        cache = legacy;
        // Remove the plaintext copy once the vault has it. If the Keystore
        // refuses, drop it anyway: the session lives in memory until the app
        // closes, then the user signs in again. Plaintext on disk is worse.
        persist(legacy).then(function () { try { localStorage.removeItem(LS_KEY); } catch (e) {} });
      } else {
        try { localStorage.removeItem(LS_KEY); } catch (e) {}
      }
    }

    window.GymSessionStore = {
      get: function () { return cache ? { rt: cache.rt, rexp: cache.rexp, method: cache.method } : null; },
      set: function (rec) {
        var r = validRec(rec);
        if (!r) return;
        cache = { rt: r.rt, rexp: r.rexp, method: r.method };
        persist(cache);
      },
      clear: function () {
        cache = null;
        queue(function () { return vault.clear(); });
      }
    };
  }

  // Layers Back may dismiss, topmost first. Sheets handle Escape themselves
  // (focus trap, remembered answers), so reuse that rather than removing nodes.
  function openLayers() {
    var n = document.querySelectorAll(".syd:not(.m-out)").length;   // a sheet fading out is already closed
    var banner = document.getElementById("alarmBanner");
    if (banner && !banner.hidden) n++;
    if (window.GymChat && typeof GymChat.isOpen === "function" && GymChat.isOpen()) n++;   // its own Escape handler closes the photo menu first, then the chat
    return n;
  }
  // Layers with no Escape path of their own (or a native <dialog>, which only
  // reacts to a real key press): close them directly. Returns true if one closed.
  function closeOtherLayer() {
    var dlgs = document.querySelectorAll("dialog[open]:not(.m-out)");
    var dlg = dlgs[dlgs.length - 1];
    if (dlg) {
      var ev = new Event("cancel", { cancelable: true });
      dlg.dispatchEvent(ev);
      if (!ev.defaultPrevented && dlg.open) dlg.close();
      return true;
    }
    var scrim = document.querySelector(".wb-scrim");   // workout-builder bottom sheet
    if (scrim) { scrim.click(); return true; }
    var modals = ["calendarModal", "videoModal"];
    for (var i = 0; i < modals.length; i++) {
      var m = document.getElementById(modals[i]);
      var btn = m && !m.hidden && !m.classList.contains("m-out") && m.querySelector(".modal-close, .cal-modal-close");
      if (btn) { btn.click(); return true; }
    }
    return false;
  }
  function closeTopLayer() {
    if (closeOtherLayer()) return true;
    var before = openLayers();
    if (!before) return false;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    if (openLayers() < before) return true;
    // A sheet without an Escape handler: its backdrop tap closes it.
    var sheets = document.querySelectorAll(".syd:not(.m-out)");
    var top = sheets[sheets.length - 1];
    var backdrop = top && top.querySelector(".syd-backdrop");
    if (backdrop) backdrop.click();
    return true; // something was open: swallow this Back press either way
  }

  // Press-twice-to-exit on the home tab.
  var EXIT_WINDOW_MS = 2000;
  var exitArmedAt = 0;
  function exitHint() {
    return document.documentElement.lang === "ar" ? "اضغط رجوع مرة أخرى للخروج" : "Press back again to exit";
  }

  // true when the native App plugin took the exit.
  function exitApp() {
    var c = cap(), app = c && plugin(c, "App");
    if (!app || typeof app.exitApp !== "function") return false;
    app.exitApp();
    return true;
  }

  function handleBack(canGoBack) {
    // The non-dismissable "Update required" page: Back does nothing at all.
    try { if (window.GymForceUpdate && typeof GymForceUpdate.isBlocking === "function" && GymForceUpdate.isBlocking()) return; } catch (e) {}
    if (closeTopLayer()) return;
    var ui = window.GymUI;
    if (ui && typeof ui.back === "function" && ui.back()) { exitArmedAt = 0; return; }
    if (canGoBack) { window.history.back(); return; }
    if (ui && typeof ui.currentTab === "function" && ui.currentTab() !== "plan") {
      exitArmedAt = 0;
      ui.navigate("plan", { noPush: true });
      return;
    }
    var now = Date.now();
    if (exitArmedAt && now - exitArmedAt <= EXIT_WINDOW_MS) {
      exitArmedAt = 0;
      exitApp();
      return;
    }
    exitArmedAt = now;
    if (window.GymToast) GymToast.show({ message: exitHint(), duration: EXIT_WINDOW_MS });
  }

  // Google Play In-App Updates (immediate flow) via @capawesome/capacitor-app-update.
  // Resolves "started" once the Play flow ran (finished or cancelled by the user),
  // "unavailable" (no plugin, no update offered, immediate not allowed, or the
  // flow said NOT_AVAILABLE / NOT_ALLOWED / INFO_MISSING), "failed" (anything
  // thrown, a failed flow, or an unknown result). On sideloaded / non-Play installs
  // getAppUpdateInfo usually rejects ("failed"), or reports no update
  // ("unavailable"); both lead the web to the store fallback. Never rejects.
  // AppUpdateAvailability.UPDATE_AVAILABLE = 2 (the only value the plugin's
  // readyForUpdate accepts); AppUpdateResultCode OK = 0, CANCELED = 1, FAILED = 2,
  // NOT_AVAILABLE = 3, NOT_ALLOWED = 4, INFO_MISSING = 5.
  // One flow at a time: a second call while one is pending reuses its promise
  // (the plugin keeps a single saved call, so a second launch would orphan the first).
  var pendingUpdate = null;
  function startUpdate() {
    if (pendingUpdate) return pendingUpdate;
    pendingUpdate = new Promise(function (resolve) {
      try {
        var c = cap(), au = c && plugin(c, "AppUpdate");
        if (!au || typeof au.getAppUpdateInfo !== "function" || typeof au.performImmediateUpdate !== "function") { resolve("unavailable"); return; }
        Promise.resolve(au.getAppUpdateInfo()).then(function (info) {
          if (!info || info.updateAvailability !== 2) return "unavailable";
          if (info.immediateUpdateAllowed === false) return "unavailable";
          return Promise.resolve(au.performImmediateUpdate()).then(function (res) {
            var code = res && res.code;
            if (code === 0 || code === 1) return "started";
            if (code === 3 || code === 4 || code === 5) return "unavailable";
            return "failed";
          });
        }).then(resolve, function () { resolve("failed"); });
      } catch (e) { resolve("failed"); }
    });
    var clear = function () { pendingUpdate = null; };
    pendingUpdate.then(clear, clear);
    return pendingUpdate;
  }

  var barsWatching = false;
  function syncSystemBars() {
    var c = cap(), bars = c && plugin(c, "SystemBars");
    if (!bars || typeof bars.setStyle !== "function") return;
    var light = document.documentElement.dataset.theme === "light";
    try { Promise.resolve(bars.setStyle({ style: light ? "LIGHT" : "DARK" })).catch(function () {}); } catch (e) {}
  }
  function watchSystemBars() {
    syncSystemBars();
    if (barsWatching || typeof MutationObserver !== "function") return;
    barsWatching = true;
    new MutationObserver(syncSystemBars).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  // The logo links back to the web landing page; the Android app has none.
  function unwrapHomeLinks() {
    function run() {
      document.querySelectorAll("a.home-link").forEach(function (a) { a.replaceWith.apply(a, a.childNodes); });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
    else run();
  }

  function init() {
    if (started) return;
    var c = cap();
    if (!c) return;
    started = true;
    installSessionStore();
    unwrapHomeLinks();
    watchSystemBars();

    var app = plugin(c, "App");
    if (app) {
      try {
        if (typeof app.getInfo === "function") {
          Promise.resolve(app.getInfo()).then(function (info) {
            if (info && info.version) window.GYM_APP_VERSION = String(info.version);
          }).catch(function () {});
        }
        if (typeof app.addListener === "function") {
          app.addListener("backButton", function (ev) { handleBack(!!(ev && ev.canGoBack)); });
        }
      } catch (e) {}
    }

    try {
      var ln = plugin(c, "LocalNotifications");
      if (ln && typeof ln.deleteChannel === "function" && typeof c.getPlatform === "function" && c.getPlatform() === "android") {
        Promise.resolve(ln.deleteChannel({ id: "rest-timer" })).catch(function () {});
      }
    } catch (e) {}
  }

  // ---- "Remove animations" (see header): the Android shell mirrors the phone's
  // animation scale 0 into html[data-reduce-motion="1"] (motion.js / motion.css
  // key off it). The marker is read at parse time so the first paint is already
  // still; MainActivity re-sets or clears the attribute on every page load and
  // on resume. ----
  function syncReduceMotion() {
    try {
      if (typeof motionMarker !== "boolean") return;
      if (motionMarker) document.documentElement.setAttribute("data-reduce-motion", "1");
      else document.documentElement.removeAttribute("data-reduce-motion");
    } catch (e) {}
  }
  syncReduceMotion();

  window.GymNativeShell = { init: init, handleBack: handleBack, exitApp: exitApp, startUpdate: startUpdate };
  installSessionStore();
  init();
})();
