/* ads.js - AdMob in the Android shell (shell >= 1.0.10 only; never on the web).
 *
 * Everything goes through window.GymNativeShell.ads (native-shell.js). Nothing here
 * asks for an ad unless ALL of these hold (GymAds.canShowAds): the bridge exists, the
 * server switch adsEnabled is on, Google's consent flow (UMP) says ads may be requested,
 * and the user is not Premium (isPremium() is a stub until Premium ships).
 *
 * The bridge's init() (which can pop Google's consent form) is never called at boot:
 * it runs lazily, the first time the user lands on Food or More or taps Watch, and never
 * while a workout or an overlay is up.
 *
 *  - Banner: a small native banner above the bottom nav on Food and More only, never
 *    during a workout or over an open sheet / dialog / the force-update screens.
 *    The page reserves its height (body.has-ad-banner, --ad-banner-h).
 *  - Rewarded video: +3 coach messages (offered under the daily chat-limit message,
 *    chat.js) and "save yesterday" for the streak (a card under the rest card, rest-days.js).
 *    Never during a workout. The phone's "rewarded" event grants nothing: gym-be grants
 *    after Google's server callback, and we only poll the ticket until it says granted.
 *
 * An ad that fails to load never blocks anything. */
(function () {
  "use strict";

  var API_BASE = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var BANNER_TABS = { food: true, more: true };
  var RECHECK_MS = 1000; // while a banner could be up, how often an overlay opening/closing is noticed

  function cfg() { return window.GymAppConfig; }
  function bridge() {
    var n = window.GymNativeShell;
    return n && n.ads && typeof n.ads.available === "function" && n.ads.available() ? n.ads : null;
  }
  function units() { return cfg() ? cfg().admobUnits() : { banner: "", rewarded: "" }; }

  // ---------------- gating ----------------
  var initP = null;   // one consent/init promise per bridge
  var consent = null; // { canRequestAds, privacyOptionsRequired } once init settled

  function isPremium() { return false; } // stub: Premium does not exist yet

  // Everything that can be known without asking Google: shell, server switch, not Premium.
  function adsPossible() { return !!(bridge() && cfg() && cfg().adsEnabled() && !isPremium()); }
  function canShowAds() { return adsPossible() && !!consent && consent.canRequestAds === true; }
  // Consent not asked yet counts as "maybe": the consent form runs on the first tap or visit.
  function consentOk() { return !consent || consent.canRequestAds === true; }

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

  // start() unless it would pop the consent form over a workout (or, unless allowed, an overlay).
  function lazyStart(overlayOk) {
    if (initP) return start();
    if (!adsPossible() || workoutBusy() || (!overlayOk && covered())) return Promise.resolve(false);
    return start().then(function (ok) { afterInit(); return ok; });
  }

  function afterInit() { refreshBanner(); wirePrivacyRow(); loadSaveStatus(); }

  // ---------------- banner ----------------
  var bannerUp = false;   // the native banner is showing and the page has reserved its height
  var bannerBusy = false; // a showBanner() call is in flight
  var noFillUntil = 0;    // after a failed load, leave it alone this long (also reset by a tab change)
  var NO_FILL_BACKOFF_MS = 60000;
  var timer = null;
  var lastTab = "";

  // A banner could be shown on this screen once consent is in (no workout / overlay / typing check).
  function bannerScreen() {
    return adsPossible() && cfg().bannersEnabled() && !!units().banner && !!BANNER_TABS[curTab()];
  }
  function bannerWanted() {
    return bannerScreen() && canShowAds() && !workoutBusy() && !covered() && !typing();
  }

  // The banner sits directly above the bottom nav; on a wide screen the nav is a side rail and the margin is 0.
  // The nav's own bottom padding is the system-bar inset, which the native banner adds again: leave it out.
  function navMarginPx() {
    var nav = document.getElementById("appNav");
    if (!nav) return 0;
    var r = nav.getBoundingClientRect();
    if (!(r.height > 0 && r.top > window.innerHeight / 2)) return 0;
    var pad = parseFloat(getComputedStyle(nav).paddingBottom) || 0;
    return Math.max(0, Math.round(r.height - pad));
  }

  function setReserved(px) {
    document.body.classList.toggle("has-ad-banner", px > 0);
    if (px > 0) document.body.style.setProperty("--ad-banner-h", px + "px");
    else document.body.style.removeProperty("--ad-banner-h");
    window.dispatchEvent(new Event("resize")); // the coach bubble re-clamps itself above the banner
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
      return b.showBanner({ adUnitId: units().banner, marginPx: navMarginPx() });
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
    // First visit to Food or More: this is when consent is asked (never at boot).
    var visit = adsPossible() && !!BANNER_TABS[tab] && (cfg().bannersEnabled() || cfg().rewardedEnabled());
    if (visit && !initP) lazyStart(false);
    if (bannerWanted()) showBanner(); else hideBanner();
    // Overlays and the keyboard open and close without any event we hear, so look again once a second,
    // but only while a banner could be on screen.
    if (bannerScreen() && !timer) timer = setInterval(refreshBanner, RECHECK_MS);
    else if (!bannerScreen() && timer) { clearInterval(timer); timer = null; }
  }

  // ---------------- rewarded videos ----------------
  var POLL_MS = 1000, POLL_MAX = 10; // wait up to ~10 s for gym-be to hear from Google
  var FETCH_TIMEOUT_MS = 8000;

  function str(key, params) {
    var out = typeof window.t === "function" ? window.t(key) : key;
    if (params) out = out.replace(/\{(\w+)\}/g, function (_, k) { return params[k] != null ? params[k] : ""; });
    return out;
  }
  function isAuthed() { return !!(window.GymSync && typeof GymSync.isSignedIn === "function" && GymSync.isSignedIn()); }
  function token() { return window.GymSync && GymSync.token ? GymSync.token() : null; }
  // A rewarded offer is possible now (before consent is known): never mid-workout, needs the unit and a signed-in session.
  function rewardedPossible(ignoreConsent) {
    return adsPossible() && cfg().rewardedEnabled() && !!units().rewarded && isAuthed() && !!token() && !workoutBusy() && (ignoreConsent || consentOk());
  }
  function localToday() { return window.GymDate.key(); }

  function api(method, path, body) {
    var tok = token();
    if (!tok) return Promise.reject(new Error("no token")); // signed out: never send "Bearer null"
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
    var headers = { "Authorization": "Bearer " + tok };
    if (body) headers["Content-Type"] = "application/json";
    return fetch(API_BASE + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal })
      .finally(function () { clearTimeout(timer); });
  }
  function getStatus() {
    return api("GET", "/rewards/status?today=" + localToday())
      .then(function (res) { if (!res.ok) throw new Error("status " + res.status); return res.json(); });
  }

  function pollTicket(id) {
    return new Promise(function (resolve) {
      var n = 0;
      function step() {
        api("GET", "/rewards/ticket/" + encodeURIComponent(id))
          .then(function (res) { return res.ok ? res.json() : null; })
          .catch(function () { return null; })
          .then(function (t) {
            if (t && t.status === "granted") return resolve("granted");
            if (t && t.status === "expired") return resolve("unconfirmed");
            if (++n >= POLL_MAX) return resolve("unconfirmed");
            setTimeout(step, POLL_MS);
          });
      }
      setTimeout(step, POLL_MS);
    });
  }

  // gym-be 409: {"error":"limit_reached"|"not_eligible","reason":"..."}. A cap reached is "limit"; any other
  // reason means the thing can't be done now ("ineligible").
  function conflictOutcome(kind, res) {
    return res.json().then(function (b) { return b || {}; }, function () { return {}; }).then(function (b) {
      var e = b.error && b.error.code ? b.error.code : b.error;
      if (e === "limit_reached" || (kind === "streak_save" && b.reason === "week_used")) return "limit";
      return kind === "streak_save" ? "ineligible" : "unavailable";
    });
  }

  // One rewarded video, start to finish. phase("loading" | "confirming") reports progress to the UI.
  // Resolves "granted" | "dismissed" | "blocked" (workout or overlay up: nothing happened) | "limit" | "ineligible"
  // | "unavailable" (503, no fill, consent refused, any error) | "unconfirmed".
  // A retry after a dismissed video gets the same pending ticket back from gym-be; we use whatever ticketId comes back.
  function redeem(kind, date, phase, overlayOk) {
    if (!adsPossible() || workoutBusy() || (!overlayOk && covered())) return Promise.resolve("blocked");
    phase("loading");
    return lazyStart(overlayOk).then(function (ok) {
      var b = bridge();
      if (!b || workoutBusy()) return "blocked";
      if (!ok) return "unavailable"; // consent refused, or a workout / overlay stopped the consent form
      var body = { kind: kind };
      if (date) body.date = date;
      return api("POST", "/rewards/ticket", body).then(function (res) {
        if (res.status === 409) return conflictOutcome(kind, res);
        if (res.status !== 201) return "unavailable";
        return res.json().then(function (t) {
          return Promise.resolve().then(function () {
            return b.showRewarded({ adUnitId: units().rewarded, customData: t.ticketId, userId: t.ssvUserId });
          }).then(function (r) {
            if (!r || r.rewarded !== true) return r && r.reason === "dismissed" ? "dismissed" : "unavailable";
            phase("confirming");
            return pollTicket(t.ticketId);
          });
        });
      });
    }).catch(function () { return "unavailable"; });
  }

  var ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.2 16.6 4.9 12.3l-1.4 1.4 5.7 5.7L20.5 7.1l-1.4-1.4z"/></svg>';

  function failText(outcome, kind) {
    if (outcome === "unconfirmed") return str("adUnconfirmed");
    if (outcome === "limit") return str(kind === "streak_save" ? "adLimitWeek" : "adLimitToday");
    return str("adNoVideo");
  }

  // ---- coach: under the daily chat-limit message ----
  // The per-minute throttle answers 429 too; only the daily quota (resets at the next UTC midnight) earns the offer.
  function isDailyQuota(resetHeader) {
    if (!resetHeader) return false;
    var d = new Date(resetHeader).getTime();
    if (isNaN(d)) return false;
    var now = new Date();
    var next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    return Math.abs(d - next) <= 2000;
  }

  var offerUI = null; // { box, paint } of the offer in the open chat, repainted on a language switch

  function offerCoachVideo(host, info) {
    if (!host || !isDailyQuota(info && info.reset) || !rewardedPossible()) return;
    getStatus().then(function (st) {
      if (!st || !(st.coachVideosLeftToday > 0) || !host.isConnected) return;
      var old = host.querySelector(".ad-offer");
      if (old) old.remove();
      var box = document.createElement("div");
      box.setAttribute("aria-live", "polite");
      var state = "idle"; // idle | loading | confirming | granted | <failure outcome>
      function paint() {
        box.innerHTML = "";
        if (state === "granted") {
          box.className = "ad-offer is-done";
          box.innerHTML = ICON_CHECK + "<span></span>";
          box.lastChild.textContent = str("adCoachGranted");
          return;
        }
        if (state !== "idle" && state !== "loading" && state !== "confirming") {
          box.className = "ad-offer is-note";
          box.textContent = failText(state, "coach_messages");
          return;
        }
        box.className = "ad-offer";
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ad-offer-btn";
        btn.innerHTML = ICON_PLAY + "<span></span>";
        btn.lastChild.textContent = str(state === "loading" ? "adLoading" : state === "confirming" ? "adConfirming" : "adCoachWatch");
        btn.disabled = state !== "idle";
        btn.onclick = function () {
          redeem("coach_messages", "", function (p) { state = p; paint(); }, true).then(function (r) {
            state = r === "granted" ? "granted" : r === "dismissed" || r === "blocked" ? "idle" : r;
            paint();
          });
        };
        box.appendChild(btn);
      }
      paint();
      offerUI = { box: box, paint: paint };
      host.appendChild(box);
      host.scrollTop = host.scrollHeight;
    }).catch(function () { /* no offer: the normal limit text stands */ });
  }

  // ---- streak: a card under the rest card on Plan ----
  var saveInfo = null;     // streakSave from /rewards/status while eligible
  var saveState = "idle";  // idle | loading | confirming | done | limit | unavailable | unconfirmed
  var SAVED_SHOWN_MS = 6000;

  function longDate(key) {
    var loc = document.documentElement.lang === "ar" ? "ar-EG" : "en-US";
    return new Date(key + "T00:00:00").toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });
  }

  function renderSaveCard() {
    var panel = document.querySelector("#calendarStrip .cal-strip");
    if (!panel) return;
    var card = panel.querySelector(".ad-save");
    var done = saveState === "done";
    var show = done || (saveInfo && saveInfo.eligible && rewardedPossible(saveState !== "idle") && // a refused consent still gets its message
      !(window.GymRest && GymRest.promptBusy && GymRest.promptBusy(saveInfo.date)));
    if (!show) { if (card) card.remove(); return; }
    if (!card) {
      card = document.createElement("div");
      panel.appendChild(card);
    }
    var busy = saveState === "loading" || saveState === "confirming";
    var failed = saveState === "limit" || saveState === "unavailable" || saveState === "unconfirmed";
    card.className = "ad-save" + (done ? " is-done" : "");
    if (done) {
      card.innerHTML = '<span class="ad-save-icon">' + ICON_CHECK + '</span><div class="ad-save-text" role="status"><span class="ad-save-title"></span></div>';
      card.querySelector(".ad-save-title").textContent = str("adStreakSaved");
      return;
    }
    card.innerHTML =
      '<span class="ad-save-icon">' + ICON_PLAY + '</span>' +
      '<div class="ad-save-text"><span class="ad-save-title"></span><span class="ad-save-sub" role="status"></span></div>' +
      (failed ? '' : '<button type="button" class="ad-save-btn"></button>');
    card.querySelector(".ad-save-title").textContent = str("adStreakTitle");
    card.querySelector(".ad-save-sub").textContent =
      failed ? failText(saveState, "streak_save") :
      busy ? str(saveState === "loading" ? "adLoading" : "adConfirming") : str("adStreakMissed", { d: longDate(saveInfo.date) });
    var btn = card.querySelector(".ad-save-btn");
    if (!btn) return;
    btn.textContent = str("adWatch");
    btn.disabled = busy;
    btn.onclick = function () {
      redeem("streak_save", saveInfo.date, function (p) { saveState = p; renderSaveCard(); }, false).then(function (r) {
        if (r === "granted") {
          saveState = "done";
          saveInfo = null;
          if (window.GymCalendar && GymCalendar.reload) GymCalendar.reload();
          if (window.GymHeader && GymHeader.refreshMe) GymHeader.refreshMe(); // the streak count in the top bar
          renderSaveCard();
          setTimeout(function () { saveState = "idle"; renderSaveCard(); }, SAVED_SHOWN_MS);
          return;
        }
        if (r === "ineligible") saveInfo = null; // the server says this day can't be saved: drop the card
        saveState = r === "dismissed" || r === "blocked" || r === "ineligible" ? "idle" : r;
        renderSaveCard();
      });
    };
  }

  var lastStatusAt = 0;
  function loadSaveStatus() {
    if (!rewardedPossible() || Date.now() - lastStatusAt < 30000) return;
    lastStatusAt = Date.now();
    getStatus().then(function (st) {
      saveInfo = st && st.streakSave && st.streakSave.eligible ? st.streakSave : null;
      if (saveState !== "done") saveState = "idle";
      renderSaveCard();
    }).catch(function () { lastStatusAt = 0; });
  }

  // ---- Settings: Privacy options (only when Google's consent flow says it is required) ----
  function wirePrivacyRow() {
    var row = document.getElementById("moreAdPrivacy");
    var btn = document.getElementById("adPrivacyBtn");
    if (!row || !btn) return;
    row.hidden = !(consent && consent.privacyOptionsRequired);
    btn.onclick = function () {
      var b = bridge();
      if (b) Promise.resolve().then(function () { return b.showPrivacyOptions(); }).catch(function () {});
    };
  }

  // Everything this file renders is rebuilt in the new language (app.js applyLang calls this).
  function refreshText() {
    renderSaveCard();
    if (offerUI && offerUI.box.isConnected) offerUI.paint();
  }

  // Re-evaluate everything against the current state; never asks for consent by itself.
  function recheck() { refreshBanner(); wirePrivacyRow(); loadSaveStatus(); renderSaveCard(); }

  window.GymAds = {
    isPremium: isPremium,
    canShowAds: canShowAds,
    // Run the consent/init step now (tests, hosts); the app itself starts lazily.
    start: function () { return start().then(function (ok) { afterInit(); return ok; }); },
    recheck: recheck,
    offerCoachVideo: offerCoachVideo,
    renderSaveCard: renderSaveCard,
    refreshBanner: refreshBanner,
    refreshText: refreshText
  };

  function init() {
    if (cfg()) cfg().ready.then(recheck);
    new MutationObserver(refreshBanner).observe(document.body, { attributes: true, attributeFilter: ["data-tab"] });
    function onWorkoutChange() { refreshBanner(); renderSaveCard(); loadSaveStatus(); }
    if (window.GymApp && GymApp.onWorkoutActive) GymApp.onWorkoutActive(onWorkoutChange);
    if (window.GymApp && GymApp.onWorkoutIdle) GymApp.onWorkoutIdle(onWorkoutChange);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { loadSaveStatus(); refreshBanner(); } });
    document.addEventListener("gym:authchange", function () { lastStatusAt = 0; recheck(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
