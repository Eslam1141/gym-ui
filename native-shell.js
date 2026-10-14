/* native-shell.js — glue between the web app and the Capacitor Android shell
 * (native/). Every branch feature-detects, so in a browser / PWA this file
 * does nothing. Plugins are looked up when init() runs (not at parse time) so
 * tests can stub window.Capacitor after load and call GymNativeShell.init().
 *
 *  - App version: window.GYM_APP_VERSION = the app's versionName
 *    (@capacitor/app getInfo), read by feedback.js for context.appVersion.
 *    Unset on the web: there is no build-time version there.
 *  - Hardware Back: closes the top open sheet/dialog (.syd) or the ringing
 *    timer banner first, then goes back in history, then exits the app.
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

  function handleBack(canGoBack) {
    if (closeTopLayer()) return;
    if (canGoBack) { window.history.back(); return; }
    var c = cap(), app = c && plugin(c, "App");
    if (app && typeof app.exitApp === "function") app.exitApp();
  }

  function init() {
    if (started) return;
    var c = cap();
    if (!c) return;
    started = true;

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
  init();
})();
