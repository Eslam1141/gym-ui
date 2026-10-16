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
 *    (native SessionVault plugin). get() is synchronous: the value is read once
 *    at parse time through window.EtqSessionVault.getSync (a JS interface
 *    MainActivity installs before the page loads), so it exists before the
 *    deferred sync.js runs. set/clear write through to the plugin in order.
 *    A leftover localStorage "gymauth_refresh" is moved into the vault. Not
 *    defined on the web or if the native pieces are missing (sync.js then
 *    uses localStorage).
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

  function installSessionStore() {
    if (sessionInstalled) return;
    var c = cap();
    if (!c) return;
    var vault = plugin(c, "SessionVault");
    var sync = window.EtqSessionVault;
    if (!vault || !sync || typeof sync.getSync !== "function") return; // keep sync.js's localStorage store
    sessionInstalled = true;

    var cache = null;
    try { cache = parseRec(sync.getSync()); } catch (e) { cache = null; }

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
    var n = document.querySelectorAll(".syd").length;
    var banner = document.getElementById("alarmBanner");
    if (banner && !banner.hidden) n++;
    return n;
  }
  function closeTopLayer() {
    var before = openLayers();
    if (!before) return false;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    if (openLayers() < before) return true;
    // A sheet without an Escape handler: its backdrop tap closes it.
    var sheets = document.querySelectorAll(".syd");
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

  function handleBack(canGoBack) {
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
      var c = cap(), app = c && plugin(c, "App");
      if (app && typeof app.exitApp === "function") app.exitApp();
      return;
    }
    exitArmedAt = now;
    if (window.GymToast) GymToast.show({ message: exitHint(), duration: EXIT_WINDOW_MS });
  }

  function init() {
    if (started) return;
    var c = cap();
    if (!c) return;
    started = true;
    installSessionStore();

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

  window.GymNativeShell = { init: init, handleBack: handleBack };
  installSessionStore();
  init();
})();
