/* ads.js - AdMob in the Android shell (shell >= 1.0.10 only; never on the web).
 *
 * Everything goes through window.GymNativeShell.ads (native-shell.js). Nothing here
 * asks for an ad unless ALL of these hold (GymAds.canShowAds): the bridge exists, the
 * server switch adsEnabled is on, Google's consent flow (UMP) says ads may be requested,
 * and the user is not Premium (isPremium() is a stub until Premium ships).
 *
 *  - Banner: a small native banner above the bottom nav on Food and More only, never
 *    during a workout or over an open sheet / dialog / the force-update screens.
 *    The page reserves its height (body.has-ad-banner, --ad-banner-h).
 *  - Rewarded video: +3 coach messages (offered under the chat-limit message, chat.js)
 *    and "save yesterday" for the streak (a card under the rest card, rest-days.js).
 *    The phone's "rewarded" event grants nothing: gym-be grants after Google's server
 *    callback, and we only poll the ticket until it says granted.
 *
 * An ad that fails to load never blocks anything. */
(function () {
  "use strict";

  var API_BASE = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var BANNER_TABS = { food: true, more: true };
  var RECHECK_MS = 1000; // while a banner is up, how often an overlay opening/closing is noticed

  function cfg() { return window.GymAppConfig; }
  function bridge() {
    var n = window.GymNativeShell;
    return n && n.ads && typeof n.ads.available === "function" && n.ads.available() ? n.ads : null;
  }

  // ---------------- gating ----------------
  var initP = null;   // one consent/init promise per bridge
  var consent = null; // { canRequestAds, privacyOptionsRequired } once init settled

  function isPremium() { return false; } // stub: Premium does not exist yet

  function canShowAds() {
    return !!(bridge() && cfg() && cfg().adsEnabled() && consent && consent.canRequestAds === true && !isPremium());
  }

  // Resolves once the gate is decided. Idempotent; init() is only called when the bridge exists and the switch is on.
  function start() {
    var b = bridge();
    if (!b || !cfg() || !cfg().adsEnabled()) return Promise.resolve(false);
    if (!initP) {
      initP = Promise.resolve().then(function () { return b.init(); }).then(function (r) {
        consent = { canRequestAds: !!(r && r.canRequestAds), privacyOptionsRequired: !!(r && r.privacyOptionsRequired) };
      }, function () { consent = { canRequestAds: false, privacyOptionsRequired: false }; });
    }
    return initP.then(function () { return canShowAds(); });
  }

  // ---------------- banner ----------------
  var bannerUp = false;   // the native banner is showing and the page has reserved its height
  var bannerBusy = false; // a showBanner() call is in flight
  var noFillUntil = 0;    // after a failed load, leave it alone this long (also reset by a tab change)
  var NO_FILL_BACKOFF_MS = 60000;
  var timer = null;
  var lastTab = "";

  function curTab() { return document.body.getAttribute("data-tab") || ""; }
  function typing() {
    var a = document.activeElement;
    return !!(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable));
  }
  function workoutBusy() { return !!(window.GymApp && GymApp.workoutInProgress && GymApp.workoutInProgress()); }
  function covered() {
    var fu = window.GymForceUpdate;
    return !!(fu && ((fu.overlayOpen && fu.overlayOpen()) || (fu.isBlocking && fu.isBlocking())));
  }
  function bannerWanted() {
    return canShowAds() && cfg().bannersEnabled() && !!BANNER_TABS[curTab()] && !workoutBusy() && !covered() && !typing();
  }

  // The banner sits directly above the bottom nav; on a wide screen the nav is a side rail and the margin is 0.
  function navMarginPx() {
    var nav = document.getElementById("appNav");
    if (!nav) return 0;
    var r = nav.getBoundingClientRect();
    return r.height > 0 && r.top > window.innerHeight / 2 ? Math.round(r.height) : 0;
  }

  function setReserved(px) {
    document.body.classList.toggle("has-ad-banner", px > 0);
    if (px > 0) document.body.style.setProperty("--ad-banner-h", px + "px");
    else document.body.style.removeProperty("--ad-banner-h");
  }

  function hideBanner() {
    if (!bannerUp) return;
    bannerUp = false;
    setReserved(0);
    var b = bridge();
    if (b) Promise.resolve().then(function () { return b.hideBanner(); }).catch(function () {});
  }

  function showBanner() {
    var b = bridge();
    if (!b || bannerUp || bannerBusy || Date.now() < noFillUntil) return;
    bannerBusy = true;
    Promise.resolve().then(function () {
      return b.showBanner({ adUnitId: cfg().admobUnits().banner, marginPx: navMarginPx() });
    }).then(function (r) {
      bannerBusy = false;
      bannerUp = true;
      if (!bannerWanted()) { hideBanner(); return; } // the screen changed while it loaded
      setReserved(Math.max(0, Math.round((r && r.heightPx) || 0)));
    }, function () {
      bannerBusy = false;
      noFillUntil = Date.now() + NO_FILL_BACKOFF_MS;
    });
  }

  function refreshBanner() {
    var tab = curTab();
    if (tab !== lastTab) { lastTab = tab; noFillUntil = 0; }
    if (bannerWanted()) showBanner(); else hideBanner();
    // Overlays and the keyboard open and close without any event we hear, so look again once a second,
    // but only while a banner could be on screen.
    var watch = canShowAds() && cfg().bannersEnabled() && !!BANNER_TABS[tab];
    if (watch && !timer) timer = setInterval(refreshBanner, RECHECK_MS);
    else if (!watch && timer) { clearInterval(timer); timer = null; }
  }

  window.GymAds = {
    isPremium: isPremium,
    canShowAds: canShowAds,
    start: function () { return start().then(function (ok) { refreshBanner(); return ok; }); },
    offerCoachVideo: function () {},
    refreshBanner: refreshBanner
  };

  function init() {
    if (cfg()) cfg().ready.then(window.GymAds.start);
    new MutationObserver(refreshBanner).observe(document.body, { attributes: true, attributeFilter: ["data-tab"] });
    if (window.GymApp && GymApp.onWorkoutActive) GymApp.onWorkoutActive(refreshBanner);
    if (window.GymApp && GymApp.onWorkoutIdle) GymApp.onWorkoutIdle(refreshBanner);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
