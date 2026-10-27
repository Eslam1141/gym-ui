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

  // ---------------- rewarded videos ----------------
  var POLL_MS = 1000, POLL_MAX = 10; // wait up to ~10 s for gym-be to hear from Google
  var FETCH_TIMEOUT_MS = 8000;

  function str(key, params) {
    var out = typeof window.t === "function" ? window.t(key) : key;
    if (params) out = out.replace(/\{(\w+)\}/g, function (_, k) { return params[k] != null ? params[k] : ""; });
    return out;
  }
  function isAuthed() { return !!(window.GymSync && typeof GymSync.isSignedIn === "function" && GymSync.isSignedIn()); }
  function rewardedOn() { return canShowAds() && cfg().rewardedEnabled() && isAuthed(); }
  function localToday() { return window.GymDate.key(); }

  function api(method, path, body) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
    var headers = { "Authorization": "Bearer " + (window.GymSync && GymSync.token ? GymSync.token() : "") };
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

  // One rewarded video, start to finish. phase("loading" | "confirming") reports progress to the UI.
  // Resolves "granted" | "dismissed" | "unavailable" (409, 503, no fill, any error) | "unconfirmed".
  function redeem(kind, date, phase) {
    var b = bridge();
    if (!b) return Promise.resolve("unavailable");
    phase("loading");
    var body = { kind: kind };
    if (date) body.date = date;
    return api("POST", "/rewards/ticket", body).then(function (res) {
      if (res.status !== 201) return "unavailable";
      return res.json().then(function (t) {
        return Promise.resolve().then(function () {
          return b.showRewarded({ adUnitId: cfg().admobUnits().rewarded, customData: t.ticketId, userId: t.ssvUserId });
        }).then(function (r) {
          if (!r || r.rewarded !== true) return r && r.reason === "dismissed" ? "dismissed" : "unavailable";
          phase("confirming");
          return pollTicket(t.ticketId);
        });
      });
    }).catch(function () { return "unavailable"; });
  }

  var ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.2 16.6 4.9 12.3l-1.4 1.4 5.7 5.7L20.5 7.1l-1.4-1.4z"/></svg>';

  function failText(outcome) { return str(outcome === "unconfirmed" ? "adUnconfirmed" : "adNoVideo"); }

  // ---- coach: under the chat-limit message ----
  function offerCoachVideo(host) {
    if (!host || !rewardedOn()) return;
    getStatus().then(function (st) {
      if (!st || !(st.coachVideosLeftToday > 0) || !host.isConnected) return;
      var old = host.querySelector(".ad-offer");
      if (old) old.remove();
      var box = document.createElement("div");
      box.className = "ad-offer";
      box.setAttribute("aria-live", "polite");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ad-offer-btn";
      function idle() {
        btn.disabled = false;
        btn.innerHTML = ICON_PLAY + "<span></span>";
        btn.lastChild.textContent = str("adCoachWatch");
      }
      function note(cls, icon, text) {
        box.className = "ad-offer " + cls;
        box.innerHTML = (icon || "") + "<span></span>";
        box.lastChild.textContent = text;
      }
      idle();
      btn.onclick = function () {
        btn.disabled = true;
        redeem("coach_messages", "", function (p) { btn.lastChild.textContent = str(p === "loading" ? "adLoading" : "adConfirming"); }).then(function (r) {
          if (r === "granted") note("is-done", ICON_CHECK, str("adCoachGranted"));
          else if (r === "dismissed") idle();
          else note("is-note", "", failText(r));
        });
      };
      box.appendChild(btn);
      host.appendChild(box);
      host.scrollTop = host.scrollHeight;
    }).catch(function () { /* no offer: the normal limit text stands */ });
  }

  // ---- streak: a card under the rest card on Plan ----
  var saveInfo = null;     // streakSave from /rewards/status while eligible
  var saveState = "idle";  // idle | loading | confirming | done | none | unconfirmed
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
    var show = done || (saveInfo && saveInfo.eligible && rewardedOn() &&
      !(window.GymRest && GymRest.promptBusy && GymRest.promptBusy(saveInfo.date)));
    if (!show) { if (card) card.remove(); return; }
    if (!card) {
      card = document.createElement("div");
      panel.appendChild(card);
    }
    var busy = saveState === "loading" || saveState === "confirming";
    var failed = saveState === "none" || saveState === "unconfirmed";
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
      failed ? failText(saveState) :
      busy ? str(saveState === "loading" ? "adLoading" : "adConfirming") : str("adStreakMissed", { d: longDate(saveInfo.date) });
    var btn = card.querySelector(".ad-save-btn");
    if (!btn) return;
    btn.textContent = str("adWatch");
    btn.disabled = busy;
    btn.onclick = function () {
      redeem("streak_save", saveInfo.date, function (p) { saveState = p; renderSaveCard(); }).then(function (r) {
        if (r === "granted") {
          saveState = "done";
          saveInfo = null;
          if (window.GymCalendar && GymCalendar.reload) GymCalendar.reload();
          renderSaveCard();
          setTimeout(function () { saveState = "idle"; renderSaveCard(); }, SAVED_SHOWN_MS);
        } else {
          saveState = r === "dismissed" ? "idle" : r === "unconfirmed" ? "unconfirmed" : "none";
          renderSaveCard();
        }
      });
    };
  }

  var lastStatusAt = 0;
  function loadSaveStatus() {
    if (!rewardedOn() || Date.now() - lastStatusAt < 30000) return;
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

  window.GymAds = {
    isPremium: isPremium,
    canShowAds: canShowAds,
    start: function () {
      return start().then(function (ok) { refreshBanner(); wirePrivacyRow(); loadSaveStatus(); return ok; });
    },
    offerCoachVideo: offerCoachVideo,
    renderSaveCard: renderSaveCard,
    refreshBanner: refreshBanner
  };

  function init() {
    if (cfg()) cfg().ready.then(window.GymAds.start);
    new MutationObserver(refreshBanner).observe(document.body, { attributes: true, attributeFilter: ["data-tab"] });
    if (window.GymApp && GymApp.onWorkoutActive) GymApp.onWorkoutActive(refreshBanner);
    if (window.GymApp && GymApp.onWorkoutIdle) GymApp.onWorkoutIdle(refreshBanner);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { loadSaveStatus(); refreshBanner(); } });
    document.addEventListener("gym:authchange", function () { lastStatusAt = 0; window.GymAds.start(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
