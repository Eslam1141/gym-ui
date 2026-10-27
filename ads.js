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

  window.GymAds = {
    isPremium: isPremium,
    canShowAds: canShowAds,
    start: start,
    offerCoachVideo: function () {},
    refreshBanner: function () {}
  };

  function init() {
    if (cfg()) cfg().ready.then(start);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
