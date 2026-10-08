/* boot-loader.js — the animated logo loader (#bootLoader in index.html).
 * Loaded synchronously right after the #bootLoader markup, so the loader is
 * the first thing painted on every cold start. It stays up while anything
 * holds it, then fades out:
 *  - "boot":   ui.js releases it once boot() has routed (login vs app).
 *  - "signin": sync.js holds it from a sign-in until the first sync lands,
 *              so a fresh login opens on the user's real data.
 * Every hold carries its own cap, and a global backstop hides the loader
 * regardless, so a hung request or a script error can never trap the user.
 *
 * In the Capacitor app (etqadem-app) the native splash screen is kept up
 * until this loader has painted, then handed over (SplashScreen.hide), so
 * the launch reads as one continuous logo animation with no white flash.
 */
(function () {
  "use strict";
  var el = document.getElementById("bootLoader");
  var root = document.documentElement;
  var MIN_MS = 650;         // let the intro (steps rise, head drops) read on fast loads
  var BACKSTOP_MS = 12000;  // nothing may hold the loader longer than this
  var holds = {};
  var shownAt = Date.now();
  var hideTimer = null;
  var backstop = null;

  function hideNativeSplash() {
    try {
      var p = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen;
      if (p && typeof p.hide === "function") p.hide({ fadeOutDuration: 150 });
    } catch (e) {}
  }

  function lang() {
    try { return localStorage.getItem("gym_lang") === "ar" ? "ar" : "en"; } catch (e) { return "en"; }
  }

  function setLabel(key) {
    var cap = el && el.querySelector(".bl-caption");
    if (!cap) return;
    var text = {
      signin: { en: "Signing you in…", ar: "جارٍ تسجيل الدخول…" }
    }[key];
    cap.textContent = text ? text[lang()] : "";
  }

  function pending() {
    for (var k in holds) if (Object.prototype.hasOwnProperty.call(holds, k)) return true;
    return false;
  }

  function finish() {
    if (!el || pending()) return;
    if (hideTimer) return;
    var wait = Math.max(0, MIN_MS - (Date.now() - shownAt));
    hideTimer = setTimeout(function () {
      hideTimer = null;
      if (pending()) return;
      if (backstop) { clearTimeout(backstop); backstop = null; }
      root.classList.remove("boot-loading");
      el.classList.add("bl-out");
      el.setAttribute("aria-busy", "false");
      // Hidden after the fade so it stops intercepting taps and animating.
      setTimeout(function () { if (!pending()) el.hidden = true; }, 320);
    }, wait);
  }

  function hold(reason, capMs) {
    if (!el) return;
    if (holds[reason]) clearTimeout(holds[reason]);
    holds[reason] = setTimeout(function () { release(reason); }, capMs || 8000);
    if (el.hidden || el.classList.contains("bl-out")) {
      // Re-shown (a sign-in after the app was already open): replay the intro.
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      el.hidden = false;
      el.classList.remove("bl-out", "bl-play");
      void el.offsetWidth; // restart the CSS animations
      el.classList.add("bl-play");
      shownAt = Date.now();
    }
    root.classList.add("boot-loading");
    el.setAttribute("aria-busy", "true");
    setLabel(reason);
    armBackstop();
  }

  function release(reason) {
    if (holds[reason]) { clearTimeout(holds[reason]); delete holds[reason]; }
    finish();
  }

  function armBackstop() {
    if (backstop) clearTimeout(backstop);
    backstop = setTimeout(function () {
      backstop = null;
      for (var k in holds) if (Object.prototype.hasOwnProperty.call(holds, k)) clearTimeout(holds[k]);
      holds = {};
      finish();
    }, BACKSTOP_MS);
  }

  window.GymBoot = { hold: hold, release: release };

  if (!el) return;
  el.classList.add("bl-play");
  hold("boot", 10000);
  // Hand over from the native splash once this frame has actually painted.
  if (window.requestAnimationFrame) {
    requestAnimationFrame(function () { requestAnimationFrame(hideNativeSplash); });
  } else {
    setTimeout(hideNativeSplash, 50);
  }
})();
