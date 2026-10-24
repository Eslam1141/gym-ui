/* net.js — connection awareness (window.GymNet).
 *
 * The app is offline-first: plan, workout timer, ticked sets, weights and the
 * rest timer all live on the phone and keep working with no network. This file
 * only tells the user where they stand and keeps server-only features honest.
 *
 *  - Reachability, not navigator.onLine (which says "online" on a captive
 *    Wi-Fi): a no-cors GET of <api>/healthz with a 4 s timeout. Any answer
 *    counts as reachable. Probes run when the browser reports a change, when
 *    sync/refresh fail (suspect()), and on a 5 s -> 30 s backoff while offline.
 *    A failure the browser still calls "online" is re-checked once before the
 *    UI changes, so a blip does not flash a banner.
 *  - Offline and usable (signed in, a saved session, or the guest preview):
 *    a small dismissible banner above the bottom nav. Never blocks the app.
 *  - Offline with no way in (never signed in, or the session ended): a full
 *    "You're offline" screen, retried on the 'online' event and by button.
 *  - Back online: sync, then a toast ("synced", or plainly that something is
 *    still unsynced).
 *  - Server-only controls carry data-needs-net: while offline a tap shows an
 *    inline "needs internet" note instead of starting a request that fails.
 *  - guardSignOut(): signing out with unsynced changes asks first.
 *
 * Events (document): gym:netchange, detail { online }. */
(function () {
  "use strict";

  var API_BASE = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var PROBE_TIMEOUT_MS = 4000;
  var RETRY_MS = [5000, 10000, 20000, 30000];

  var STR = {
    en: {
      screenTitle: "You're offline",
      screenBody: "Etqadem needs a connection to sign you in. Check your Wi-Fi or mobile data, then try again.",
      screenAuto: "We'll reconnect on our own when you're back online.",
      tryAgain: "Try again",
      checking: "Checking…",
      stillOffline: "Still offline. Check your Wi-Fi or mobile data.",
      banner: "You're offline. Your progress is saved on this phone and will sync when you're back online.",
      dismiss: "Dismiss",
      synced: "Back online, synced",
      partial: "Back online. Some changes aren't synced yet. We'll keep trying.",
      back: "Back online",
      needsTitle: "This needs internet",
      needsCoach: "The AI coach talks to our servers. Your plan and workout timer still work offline.",
      needsFood: "Your food log lives on our servers. It will load when you're back online.",
      needsNote: "Needs internet. Try again when you're back online.",
      confirmTitle: "Sign out with unsynced changes?",
      confirmBody: "You have changes not synced yet. Signing out now will remove them from this phone.",
      confirmYes: "Sign out anyway",
      confirmNo: "Stay signed in"
    },
    ar: {
      screenTitle: "أنت غير متصل بالإنترنت",
      screenBody: "يحتاج اتقدم إلى اتصال لتسجيل دخولك. تحقق من الواي فاي أو بيانات الهاتف ثم حاول مرة أخرى.",
      screenAuto: "سنعيد الاتصال تلقائيًا عند عودة الإنترنت.",
      tryAgain: "حاول مرة أخرى",
      checking: "جارٍ التحقق…",
      stillOffline: "ما زلت غير متصل. تحقق من الواي فاي أو بيانات الهاتف.",
      banner: "أنت غير متصل. تقدمك محفوظ على هذا الهاتف وستتم مزامنته عند عودة الاتصال.",
      dismiss: "إغلاق",
      synced: "عاد الاتصال وتمت المزامنة",
      partial: "عاد الاتصال. بعض التغييرات لم تتم مزامنتها بعد وسنواصل المحاولة.",
      back: "عاد الاتصال",
      needsTitle: "هذه الميزة تحتاج إلى إنترنت",
      needsCoach: "المدرب الذكي يتصل بخوادمنا. خطتك ومؤقت التمرين يعملان بدون إنترنت.",
      needsFood: "سجل الطعام محفوظ على خوادمنا وسيظهر عند عودة الاتصال.",
      needsNote: "تحتاج إلى إنترنت. حاول مرة أخرى عند عودة الاتصال.",
      confirmTitle: "تسجيل الخروج مع تغييرات غير متزامنة؟",
      confirmBody: "لديك تغييرات لم تتم مزامنتها بعد. تسجيل الخروج الآن سيزيلها من هذا الهاتف.",
      confirmYes: "تسجيل الخروج على أي حال",
      confirmNo: "البقاء مسجّلًا"
    }
  };
  function lang() { return document.documentElement.lang === "ar" ? "ar" : "en"; }
  function s(k) { return STR[lang()][k]; }
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // Our own mark, as a signal meter: the logo's three rising bars. Only the first
  // still has a link (solid, with the head sitting on it); the others are dashed.
  var ART = '<svg class="net-art" viewBox="0 0 160 120" width="160" height="120" aria-hidden="true" focusable="false">' +
    '<g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-dasharray="4 5" opacity=".55">' +
    '<rect x="62" y="68" width="32" height="40" rx="7"/><rect x="104" y="48" width="32" height="60" rx="7"/></g>' +
    '<rect class="net-art-on" x="20" y="88" width="32" height="20" rx="7"/>' +
    '<circle class="net-art-head" cx="36" cy="68" r="10"/></svg>';
  var ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M3 3l18 18M8.5 8.8A9 9 0 0 0 5 11.3M12 6a14 14 0 0 1 7 2.4M12 14a5 5 0 0 1 3.2 1.2M12 19.5h.01"/></svg>';

  var online = true;          // last known reachability
  var failures = 0;           // consecutive failed probes
  var probing = null;
  var retryTimer = null;
  var checkTimer = null;
  var dismissed = false;
  var banner = null, screen = null, screenBtn = null, screenMsg = null;

  function emit() {
    try { document.dispatchEvent(new CustomEvent("gym:netchange", { detail: { online: online } })); } catch (e) {}
  }

  // ---------------- reachability ----------------
  function probe() {
    if (probing) return probing;
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, PROBE_TIMEOUT_MS);
    probing = fetch(API_BASE + "/healthz?_=" + Date.now(), { mode: "no-cors", cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(function () { return true; }, function () { return false; })
      .then(function (ok) { clearTimeout(timer); probing = null; return ok; });
    return probing;
  }

  function scheduleRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(function () { retryTimer = null; check(); }, RETRY_MS[Math.min(failures, RETRY_MS.length) - 1] || RETRY_MS[0]);
  }

  function setOnline(ok) {
    if (ok) {
      failures = 0;
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      if (!online) { online = true; dismissed = false; render(); emit(); cameBack(); }
      return;
    }
    failures++;
    if (online) { online = false; dismissed = false; render(); emit(); }
    scheduleRetry();
  }

  // One probe. A failure while the browser still says "online" is confirmed by a
  // second probe 1.5 s later before it counts (a blip must not flash a banner).
  function check(confirmed) {
    return probe().then(function (ok) {
      if (!ok && online && navigator.onLine !== false && !confirmed) {
        return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return check(true); });
      }
      setOnline(ok);
      return ok;
    });
  }
  // Debounced entry for events that fire in bursts (online + visibilitychange).
  function checkSoon() {
    if (checkTimer) clearTimeout(checkTimer);
    checkTimer = setTimeout(function () { checkTimer = null; check(); }, 250);
  }
  // Something else (sync, a token refresh) just failed to reach the server.
  function suspect() { if (online) checkSoon(); }

  // ---------------- state of the app, for choosing the chrome ----------------
  function authed() { return !!(window.GymUI && GymUI.isAuthed && GymUI.isAuthed()); }
  function hasSession() { return !!(window.GymSync && GymSync.hasSession && GymSync.hasSession()); }
  // Offline with no way into the app: never signed in, or the session ended. A guest
  // preview or a saved session can still use the app, so they only get the banner.
  function blocked() { return !online && !authed() && !hasSession() && ls("gym_anon") !== "1"; }

  // ---------------- chrome ----------------
  function build() {
    banner = document.createElement("div");
    banner.id = "netBanner";
    banner.className = "net-banner";
    banner.hidden = true;
    banner.setAttribute("role", "status");
    banner.innerHTML = '<span class="net-banner-ic">' + ICON + '</span><p class="net-banner-msg"></p>' +
      '<button type="button" class="net-banner-x"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.41 4.3 19.7 2.89 18.29 9.17 12 2.89 5.71 4.3 4.3l6.29 6.29L16.89 4.3z"/></svg></button>';
    banner.querySelector(".net-banner-x").addEventListener("click", function () { dismissed = true; render(); });
    document.body.appendChild(banner);

    screen = document.createElement("section");
    screen.id = "netScreen";
    screen.className = "net-screen";
    screen.hidden = true;
    screen.setAttribute("role", "dialog");
    screen.setAttribute("aria-modal", "true");
    screen.setAttribute("aria-labelledby", "netScreenTitle");
    screen.innerHTML = '<div class="net-screen-inner">' + ART + '<h1 id="netScreenTitle" class="net-screen-title"></h1>' +
      '<p class="net-screen-body"></p><button type="button" class="net-screen-btn"></button>' +
      '<p class="net-screen-msg" role="status" aria-live="polite"></p></div>';
    screenBtn = screen.querySelector(".net-screen-btn");
    screenMsg = screen.querySelector(".net-screen-msg");
    screenBtn.addEventListener("click", function () {
      screenBtn.disabled = true; screenBtn.textContent = s("checking"); screenMsg.textContent = "";
      var started = Date.now();
      check().then(function (ok) {
        // Keep "Checking…" up long enough to read, so a fast failure doesn't look like nothing happened.
        setTimeout(function () {
          screenBtn.disabled = false; screenBtn.textContent = s("tryAgain");
          if (!ok) screenMsg.textContent = s("stillOffline");
        }, Math.max(0, 600 - (Date.now() - started)));
      });
    });
    document.body.appendChild(screen);
  }

  function paintText() {
    banner.querySelector(".net-banner-msg").textContent = s("banner");
    banner.querySelector(".net-banner-x").setAttribute("aria-label", s("dismiss"));
    screen.querySelector(".net-screen-title").textContent = s("screenTitle");
    screen.querySelector(".net-screen-body").textContent = s("screenBody") + " " + s("screenAuto");
    if (!screenBtn.disabled) screenBtn.textContent = s("tryAgain");
  }

  function render() {
    if (!banner) return;
    document.documentElement.toggleAttribute("data-offline", !online);
    if (online) document.querySelectorAll(".net-need").forEach(function (n) { n.remove(); });
    paintText();
    var full = blocked();
    var wasHidden = screen.hidden;
    screen.hidden = !full;
    document.body.classList.toggle("net-blocked", full);
    if (full && wasHidden) { screenMsg.textContent = ""; setTimeout(function () { screenBtn.focus(); }, 0); }
    banner.hidden = online || full || dismissed;
  }

  // ---------------- server-only features ----------------
  // A card for a tab whose content lives on the server (Coach, Food).
  function card(kind) {
    var d = document.createElement("div");
    d.className = "net-card";
    d.innerHTML = ART + '<h2 class="net-card-title"></h2><p class="net-card-body"></p><button type="button" class="net-screen-btn"></button>';
    d.querySelector(".net-card-title").textContent = s("needsTitle");
    d.querySelector(".net-card-body").textContent = s(kind === "food" ? "needsFood" : "needsCoach");
    var b = d.querySelector(".net-screen-btn");
    b.textContent = s("tryAgain");
    b.addEventListener("click", function () { b.disabled = true; check().then(function () { b.disabled = false; }); });
    return d;
  }

  // Inline note next to a control that needs the server. data-net-host marks the
  // container the note goes before (the chat form); otherwise it follows the control.
  function note(el) {
    var host = el.closest("[data-net-host]");
    var scope = host ? host.parentNode : el.parentNode;
    scope.querySelectorAll(".net-need").forEach(function (n) { n.remove(); });
    var p = document.createElement("p");
    p.className = "net-need";
    p.setAttribute("role", "status");
    p.textContent = s("needsNote");
    if (host) host.parentNode.insertBefore(p, host); else el.parentNode.insertBefore(p, el.nextSibling);
  }
  document.addEventListener("click", function (e) {
    if (online) return;
    var el = e.target.closest && e.target.closest("[data-needs-net]");
    if (!el) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    note(el);
  }, true);

  // ---------------- back online ----------------
  function toast(msg) { if (window.GymToast) GymToast.show({ message: msg, duration: 4500 }); }
  function cameBack() {
    // Repaint the tabs that were showing "needs internet".
    try { if (document.querySelector("#coachBody .net-card") && window.GymCoach) GymCoach.refresh(); } catch (e) {}
    try { if (document.querySelector("#foodBody .net-card") && window.GymFood) GymFood.refresh(); } catch (e) {}
    var account = !!ls("gym_user_sub");
    if (!account) { toast(s("back")); return; }
    // A saved session gets its access token back through sync.js's own online
    // handler; give that a moment, then sync and tell the truth about the result.
    var tries = 0;
    (function settle() {
      var sync = window.GymSync;
      if (sync && !sync.isSignedIn() && sync.hasSession() && tries++ < 20) { setTimeout(settle, 500); return; }
      Promise.resolve(sync && sync.isSignedIn() ? sync.syncNow("online") : false).then(function () {
        toast(sync && sync.hasUnsynced && sync.hasUnsynced() ? s("partial") : s("synced"));
      });
    })();
  }

  // ---------------- sign-out guard ----------------
  var confirmEl = null;
  function guardSignOut(go) {
    if (!(window.GymSync && GymSync.hasUnsynced && GymSync.hasUnsynced())) { go(); return; }
    if (confirmEl) return;
    var opener = document.activeElement;
    var sheet = document.createElement("div");
    sheet.className = "syd net-confirm";
    sheet.setAttribute("role", "alertdialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", "netConfirmTitle");
    sheet.setAttribute("aria-describedby", "netConfirmBody");
    sheet.innerHTML = '<div class="syd-backdrop"></div><div class="syd-panel"><h2 class="syd-title" id="netConfirmTitle"></h2>' +
      '<p class="syd-body" id="netConfirmBody"></p><div class="syd-actions">' +
      '<button type="button" class="syd-yes net-stay"></button><button type="button" class="syd-no net-leave"></button></div></div>';
    sheet.querySelector(".syd-title").textContent = s("confirmTitle");
    sheet.querySelector(".syd-body").textContent = s("confirmBody");
    var no = sheet.querySelector(".net-stay"), yes = sheet.querySelector(".net-leave");
    no.textContent = s("confirmNo");      // the safe choice is the filled, first button
    yes.textContent = s("confirmYes");
    function close() {
      document.removeEventListener("keydown", onKey, true);
      sheet.remove(); confirmEl = null;
      if (opener && opener.focus) opener.focus();
    }
    function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }
    document.addEventListener("keydown", onKey, true);
    no.addEventListener("click", close);
    sheet.querySelector(".syd-backdrop").addEventListener("click", close);
    yes.addEventListener("click", function () { close(); go(); });
    document.body.appendChild(sheet);
    confirmEl = sheet;
    no.focus();
  }

  // ---------------- init ----------------
  function init() {
    build();
    window.addEventListener("offline", function () { setOnline(false); });
    window.addEventListener("online", checkSoon);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && !online) checkSoon(); });
    document.addEventListener("gym:authchange", render);
    // The language toggle flips <html lang>: repaint the copy.
    new MutationObserver(function () { paintText(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    if (navigator.onLine === false) setOnline(false); else render();
    // ui.js has routed by now; re-evaluate whether the full screen is needed.
    setTimeout(render, 0);
  }

  window.GymNet = {
    isOnline: function () { return online; },
    isOffline: function () { return !online; },
    check: check,
    suspect: suspect,
    card: card,
    note: note,
    guardSignOut: guardSignOut
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
