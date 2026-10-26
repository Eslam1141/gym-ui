/* force-update.js - makes old native shells update, and keeps long-open sessions fresh.
 * Spec: docs/superpowers/specs/2026-10-26-force-update-design.md
 *
 *  - Version logic: compare() / decide(). minAppVersion / latestAppVersion (GymAppConfig)
 *    apply only inside the native shell (window.GYM_APP_VERSION); a missing or unparseable
 *    value, or a failed config fetch, never blocks and never shows a banner.
 *  - UI: a full-screen "Update required" page (cannot be dismissed), a slim bar instead of it
 *    while a workout is in progress, and a dismissible "new version" banner.
 *  - Update: GymNativeShell.startUpdate() (Play in-app update) when the shell has it, else the
 *    Play Store listing (market://, with the https URL shown as text).
 */
(function () {
  "use strict";

  // Dotted numeric versions: -1 / 0 / 1, or null when either side is empty or not numeric.
  // A missing part counts as 0 ("1.0" equals "1.0.0").
  function compare(a, b) {
    var re = /^\d+(\.\d+)*$/;
    a = String(a == null ? "" : a).trim();
    b = String(b == null ? "" : b).trim();
    if (!re.test(a) || !re.test(b)) return null;
    var x = a.split("."), y = b.split("."), n = Math.max(x.length, y.length);
    for (var i = 0; i < n; i++) {
      var p = parseInt(x[i] || "0", 10), q = parseInt(y[i] || "0", 10);
      if (p !== q) return p < q ? -1 : 1;
    }
    return 0;
  }

  // o: {native, version, min, latest, inWorkout, dismissed} -> "block" | "bar" | "banner" | "none".
  // "bar" is the in-workout stand-in for "block": the workout is never interrupted.
  function decide(o) {
    if (!o.native) return "none";
    if (compare(o.version, o.min) === -1) return o.inWorkout ? "bar" : "block";
    if (!o.inWorkout && o.dismissed !== o.latest && compare(o.version, o.latest) === -1) return "banner";
    return "none";
  }

  var APP_ID = "com.etqadem.app";
  var MARKET_URL = "market://details?id=" + APP_ID;
  var STORE_URL = "https://play.google.com/store/apps/details?id=" + APP_ID;
  var DISMISS_KEY = "gym_update_dismissed";
  var VERSION_POLL_MS = 250, VERSION_POLL_MAX_MS = 10000;

  var api = { compare: compare, decide: decide };
  var blocking = false;
  var els = null;        // the page, bar and banner, built on first use
  var inerted = [];      // body children made inert while the page is up

  function t(k) { return window.GymApp && window.GymApp.t ? window.GymApp.t(k) : k; }
  function isNative() {
    try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) { return false; }
  }
  function inWorkout() { return !!(window.GymApp && window.GymApp.workoutInProgress && window.GymApp.workoutInProgress()); }
  function dismissed() { try { return localStorage.getItem(DISMISS_KEY) || ""; } catch (e) { return ""; } }
  function cfg(name) { return window.GymAppConfig ? window.GymAppConfig[name]() : ""; }

  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function button(cls, onClick) {
    var b = el("button", cls, { type: "button" });
    b.addEventListener("click", onClick);
    return b;
  }

  // Update: Play in-app update through the native bridge; where that is missing (APK 1.0.8 and
  // older), unavailable or failed, open the Play Store listing and show its https URL as text.
  api.openUrl = function (url) { window.location.assign(url); };
  function startUpdate() {
    var shell = window.GymNativeShell;
    var run;
    try { run = shell && typeof shell.startUpdate === "function" ? shell.startUpdate() : "unavailable"; } catch (e) { run = "failed"; }
    return Promise.resolve(run).catch(function () { return "failed"; }).then(function (res) {
      if (res === "started") return;
      els.storeNote.hidden = false;
      try { api.openUrl(MARKET_URL); } catch (e) {}
    });
  }
  function onUpdate(ev) {
    var b = ev.currentTarget;
    b.disabled = true;
    startUpdate().then(function () { b.disabled = false; });
  }

  function build() {
    var page = el("div", "fu-page", { id: "force-update", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "fu-title", "aria-describedby": "fu-body", hidden: "" });
    var card = el("div", "fu-card");
    var logo = el("img", "fu-logo", { src: "icons/logo-etq.svg", alt: "", width: "88", height: "88" });
    var title = el("h2", "fu-title", { id: "fu-title" });
    var body = el("p", "fu-body", { id: "fu-body" });
    var update = button("fu-btn", onUpdate);
    var check = button("fu-link", onCheckAgain);
    var store = el("p", "fu-store", { hidden: "", "aria-live": "polite" });
    var storeText = el("span");
    var storeUrl = el("span", "fu-url", { dir: "ltr" });
    storeUrl.textContent = STORE_URL;
    store.appendChild(storeText);
    store.appendChild(storeUrl);
    [logo, title, body, update, check, store].forEach(function (n) { card.appendChild(n); });
    page.appendChild(card);

    var bar = el("div", "fu-bar", { id: "force-update-bar", role: "status", hidden: "" });

    var banner = el("div", "fu-banner", { id: "force-update-banner", role: "status", hidden: "" });
    var bannerText = el("span", "fu-banner-text");
    var bannerUpdate = button("fu-banner-btn", onUpdate);
    var bannerClose = button("fu-banner-x", onDismiss);
    bannerClose.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    [bannerText, bannerUpdate, bannerClose].forEach(function (n) { banner.appendChild(n); });

    document.body.insertBefore(banner, document.body.firstChild);
    document.body.insertBefore(bar, banner);
    document.body.appendChild(page);
    els = { page: page, bar: bar, banner: banner, title: title, body: body, update: update, check: check,
      storeNote: store, storeText: storeText, bannerText: bannerText, bannerUpdate: bannerUpdate, bannerClose: bannerClose };
  }

  function label() {
    els.title.textContent = t("fuTitle");
    els.body.textContent = t("fuBody");
    els.update.textContent = t("fuUpdate");
    els.check.textContent = t("fuCheck");
    els.storeText.textContent = t("fuStoreText") + " ";
    els.bar.textContent = t("fuBar");
    els.bannerText.textContent = t("fuBanner");
    els.bannerUpdate.textContent = t("fuUpdate");
    els.bannerClose.setAttribute("aria-label", t("notifClose"));
  }

  function setBlocking(on) {
    if (on === blocking) return;
    blocking = on;
    els.page.hidden = !on;
    if (on) {
      Array.prototype.forEach.call(document.body.children, function (c) {
        if (c !== els.page && !c.inert) { c.inert = true; inerted.push(c); }
      });
      els.update.focus();
    } else {
      inerted.forEach(function (c) { c.inert = false; });
      inerted = [];
      els.storeNote.hidden = true;
    }
  }

  function render(mode) {
    if (mode === "none" && !els) return;
    if (!els) build();
    label();
    els.bar.hidden = mode !== "bar";
    els.banner.hidden = mode !== "banner";
    setBlocking(mode === "block");
  }

  // Re-evaluates and renders. Called when the config is ready, while the native version is still
  // arriving, on resume, and when a workout ends.
  function check() {
    render(decide({
      native: isNative(),
      version: window.GYM_APP_VERSION || "",
      min: cfg("minAppVersion"),
      latest: cfg("latestAppVersion"),
      inWorkout: inWorkout(),
      dismissed: dismissed()
    }));
    return Promise.resolve();
  }
  function refreshAndCheck() {
    return (window.GymAppConfig ? window.GymAppConfig.refresh() : Promise.resolve()).then(check);
  }
  function onCheckAgain(ev) {
    var b = ev.currentTarget;
    b.disabled = true;
    refreshAndCheck().then(function () { b.disabled = false; });
  }
  function onDismiss() {
    try { localStorage.setItem(DISMISS_KEY, cfg("latestAppVersion")); } catch (e) {}
    check();
  }

  api.isBlocking = function () { return blocking; };
  api.check = check;

  function init() {
    if (window.GymAppConfig) window.GymAppConfig.ready.then(check);
    // window.GYM_APP_VERSION is set by native-shell.js once App.getInfo() resolves, usually after
    // the config; keep checking until it shows up.
    var waited = 0;
    var poll = setInterval(function () {
      waited += VERSION_POLL_MS;
      if (window.GYM_APP_VERSION) { clearInterval(poll); check(); }
      else if (waited >= VERSION_POLL_MAX_MS) clearInterval(poll);
    }, VERSION_POLL_MS);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refreshAndCheck(); });
    if (window.GymApp && window.GymApp.onWorkoutIdle) window.GymApp.onWorkoutIdle(check);
  }

  window.GymForceUpdate = api;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
