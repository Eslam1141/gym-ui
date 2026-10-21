/* notifications.js — bell + panel for the in-app notification inbox
 * (replaces the removed web-push opt-in; see calendar.js/service-worker.js).
 *
 * Renders its bell button into header.js's reserved GymHeader.slot("bell")
 * and builds its own panel + backdrop directly on document.body (no new
 * index.html markup needed beyond this file's own <script> tag).
 *
 * Data: GET /notifications?limit=50 -> {items:[{id,title,body,url,
 * createdAt,readAt?}], unreadCount}, newest first. Both the badge and the
 * panel read from the SAME cached response, refreshed on GymSync's existing
 * poll cadence (gym:synctick) — no separate timer, no separate "just the
 * count" request (see docs/specs/2026-09-23-in-app-notifications.md). */
(function () {
  "use strict";

  function str(key, params) {
    var out = (window.GymHeader && typeof GymHeader.str === "function")
      ? GymHeader.str(key, params)
      : ((typeof window.t === "function") ? window.t(key) : key);
    return out;
  }

  function isAuthed() { return !!(window.GymHeader && typeof GymHeader.isAuthed === "function" && GymHeader.isAuthed()); }

  function curLocale() {
    try { return document.documentElement.lang === "ar" ? "ar" : "en"; } catch (e) { return "en"; }
  }

  // ---------------- pure helper: relative time ----------------
  // No DOM/i18n-table dependency (takes locale as a param) so it can be
  // smoke-tested directly under plain node. Returns null for "just now" —
  // callers substitute the localized T string for that case.
  function relTime(iso, nowMs, locale) {
    var then = new Date(iso).getTime();
    if (isNaN(then)) return "";
    var now = typeof nowMs === "number" ? nowMs : Date.now();
    var diffSec = Math.round((then - now) / 1000); // negative = past
    if (Math.abs(diffSec) < 60) return null;
    var mins = Math.round(diffSec / 60);
    var hours = Math.round(diffSec / 3600);
    var days = Math.round(diffSec / 86400);
    var loc = locale || "en";
    try {
      if (typeof Intl !== "undefined" && Intl.RelativeTimeFormat) {
        var rtf = new Intl.RelativeTimeFormat(loc, { numeric: "auto" });
        if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
        if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
        return rtf.format(days, "day");
      }
    } catch (e) {}
    if (Math.abs(mins) < 60) return Math.abs(mins) + "m";
    if (Math.abs(hours) < 24) return Math.abs(hours) + "h";
    return Math.abs(days) + "d";
  }

  // ---------------- state ----------------
  var items = [];
  var unreadCount = 0;
  var shownCount = null; // last server-backed count painted; null until the first load
  var countKnown = false; // unreadCount came from the server (not the initial 0)
  var loadErr = false;
  var panelOpen = false;
  var fetchSeq = 0;

  var bellBtn, badgeEl, backdrop, panel, listEl, closeBtn, titleEl, readAllBtn, liveEl;

  var ICON_BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5S10.5 3.17 10.5 4v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1z"/></svg>';
  var ICON_CHEVRON = '<svg class="notif-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.4 5.6 15.8 12l-6.4 6.4-1.4-1.4 5-5-5-5z"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.41 4.3 19.7 2.89 18.29 9.17 12 2.89 5.71 4.3 4.3l6.29 6.29L16.89 4.3z"/></svg>';

  // ---------------- bell (built into header.js's slot) ----------------
  function build() {
    if (bellBtn && bellBtn.isConnected) return true;
    var slot = window.GymHeader && typeof GymHeader.slot === "function" ? GymHeader.slot("bell") : null;
    if (!slot) return false;
    slot.innerHTML =
      '<button type="button" class="tb-bell" id="tbBell" aria-haspopup="dialog" aria-expanded="false">' +
      ICON_BELL +
      '<span class="tb-bell-badge" id="tbBellBadge" hidden></span>' +
      '</button>';
    bellBtn = document.getElementById("tbBell");
    badgeEl = document.getElementById("tbBellBadge");
    bellBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (panelOpen) close(); else open();
    });
    return true;
  }

  function renderBadge() {
    if (!bellBtn && !build()) return;
    var rose = shownCount !== null && unreadCount > shownCount;
    shownCount = countKnown ? unreadCount : null;
    if (unreadCount > 0) {
      badgeEl.hidden = false;
      badgeEl.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
      bellBtn.setAttribute("aria-label", str("notifBellUnread", { n: unreadCount }));
      // Only a rise gets a cue (never first paint, never a read-down).
      if (rose && window.GymMotion) { GymMotion.pop(badgeEl); GymMotion.play(bellBtn, "m-swing"); }
    } else {
      badgeEl.hidden = true;
      badgeEl.textContent = "";
      bellBtn.setAttribute("aria-label", str("notifBell"));
    }
    renderReadAll();
  }

  // The header action only makes sense while something is unread.
  function renderReadAll() {
    if (readAllBtn) readAllBtn.hidden = !(unreadCount > 0 && !loadErr);
  }

  // ---------------- panel ----------------
  function buildPanel() {
    if (panel) return;
    backdrop = document.createElement("div");
    backdrop.className = "notif-backdrop";
    backdrop.hidden = true;
    backdrop.addEventListener("click", close);

    panel = document.createElement("div");
    panel.className = "notif-panel m-menu";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.innerHTML =
      '<div class="notif-panel-head">' +
      '  <span class="notif-panel-title" id="notifPanelTitle"></span>' +
      '  <button type="button" class="notif-readall" id="notifReadAllBtn" hidden></button>' +
      '  <button type="button" class="notif-close" id="notifCloseBtn">' + ICON_CLOSE + '</button>' +
      '</div>' +
      '<div class="notif-list" id="notifList"></div>' +
      '<span class="sr-only" id="notifLive" role="status" aria-live="polite"></span>';

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    titleEl = document.getElementById("notifPanelTitle");
    listEl = document.getElementById("notifList");
    closeBtn = document.getElementById("notifCloseBtn");
    readAllBtn = document.getElementById("notifReadAllBtn");
    liveEl = document.getElementById("notifLive");
    closeBtn.addEventListener("click", close);
    if (window.GymAct && typeof GymAct.bind === "function") GymAct.bind(readAllBtn, markAllRead, { cooldown: 400 });
    else readAllBtn.addEventListener("click", markAllRead);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panelOpen) close();
    });
  }

  function renderStrings() {
    if (!panel) return;
    panel.setAttribute("aria-label", str("notifTitle"));
    if (titleEl) titleEl.textContent = str("notifTitle");
    if (closeBtn) closeBtn.setAttribute("aria-label", str("notifClose"));
    if (readAllBtn) readAllBtn.textContent = str("notifReadAll");
    renderReadAll();
  }

  function clearList() {
    if (!listEl) return;
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
  }

  function renderState(text, withRetry) {
    clearList();
    var wrap = document.createElement("div");
    wrap.className = "notif-state";
    var p = document.createElement("p");
    p.textContent = text;
    wrap.appendChild(p);
    if (withRetry) {
      var retry = document.createElement("button");
      retry.type = "button";
      retry.className = "notif-retry";
      retry.textContent = str("notifRetry");
      retry.addEventListener("click", function () { fetchNotifications(); });
      wrap.appendChild(retry);
    }
    listEl.appendChild(wrap);
  }

  function renderList() {
    if (!listEl) return;
    if (loadErr) { renderState(str("notifLoadErr"), true); return; }
    if (!items.length) { renderState(str("notifEmpty"), false); return; }

    clearList();
    var nowMs = Date.now();
    var locale = curLocale();
    items.forEach(function (item) {
      var unread = !item.readAt;
      var row = document.createElement("button");
      row.type = "button";
      row.className = "notif-item" + (unread ? " unread" : "");
      row.dataset.id = item.id;

      if (unread) {
        var dot = document.createElement("span");
        dot.className = "notif-dot";
        dot.setAttribute("aria-label", str("notifUnreadDot"));
        row.appendChild(dot);
      }

      var body = document.createElement("span");
      body.className = "notif-item-body";

      var titleSpan = document.createElement("span");
      titleSpan.className = "notif-item-title";
      titleSpan.textContent = item.title || "";
      body.appendChild(titleSpan);

      if (item.body) {
        var textSpan = document.createElement("span");
        textSpan.className = "notif-item-text";
        textSpan.textContent = item.body;
        body.appendChild(textSpan);
      }

      var timeSpan = document.createElement("span");
      timeSpan.className = "notif-item-time";
      var rel = relTime(item.createdAt, nowMs, locale);
      timeSpan.textContent = rel === null ? str("notifJustNow") : rel;
      body.appendChild(timeSpan);

      row.appendChild(body);

      var hint = document.createElement("span");
      hint.className = "notif-item-hint";
      hint.textContent = str(hintKey(routeFor(item)));
      body.appendChild(hint);
      row.insertAdjacentHTML("beforeend", ICON_CHEVRON);
      row.addEventListener("click", function () { onItemTap(item); });
      listEl.appendChild(row);
    });
  }

  // ---------------- actions ----------------
  // ---------------- routing: what tapping a notification does ----------------
  // Contract with gym-be: url is "./#plan", "./#plan?day=YYYY-MM-DD",
  // "./#checkin" or "./#food|coach|profile". Notifications stored before that
  // (url "./") are recognised by their known EN/AR titles instead.
  var ROUTE_RE = /^#(plan|coach|food|profile|checkin)(?:\?(.*))?$/;
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  var LEGACY_TITLES = {
    plan: ["workout reminder", "تذكير بالتمرين", "no workout logged", "لم يسجل تمرين"],
    checkin: ["weekly check-in", "الفحص الاسبوعي", "تسجيل اسبوعي"]
  };

  function normTitle(t) {
    return String(t || "").toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")   // Arabic marks and tatweel
      .replace(/[\u0623\u0625\u0622]/g, "\u0627")      // alef variants
      .replace(/\s+/g, " ").trim();
  }

  function pad2(n) { return n < 10 ? "0" + n : String(n); }
  function yesterdayKey(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  // The hash of a same-origin url, "" when there is none, null when the url is
  // cross-origin or unparseable (never navigated to).
  function hashOf(url, base) {
    try {
      var u = new URL(url, base || window.location.href);
      if (u.origin !== (base ? new URL(base).origin : window.location.origin)) return null;
      return u.hash;
    } catch (e) { return null; }
  }

  // "#plan?day=2026-10-20", "#checkin", ... for a notification item.
  function routeFor(item, base) {
    var hash = item && item.url ? hashOf(item.url, base) : "";
    var m = hash ? ROUTE_RE.exec(hash) : null;
    if (m) return hash;
    var title = normTitle(item && item.title);
    if (LEGACY_TITLES.checkin.indexOf(title) !== -1) return "#checkin";
    if (LEGACY_TITLES.plan.indexOf(title) !== -1) {
      var day = yesterdayKey(item.createdAt);
      return day ? "#plan?day=" + day : "#plan";
    }
    return "#plan";
  }

  function parseRoute(hash) {
    var m = ROUTE_RE.exec(hash || "");
    if (!m) return null;
    var day = null;
    if (m[2]) {
      var q = new URLSearchParams(m[2]).get("day");
      if (q && DAY_RE.test(q)) day = q;
    }
    return { name: m[1], day: day };
  }

  function hintKey(hash) {
    var r = parseRoute(hash) || { name: "plan" };
    if (r.name === "plan") return r.day ? "notifHintDay" : "notifHintPlan";
    return { checkin: "notifHintCheckin", coach: "notifHintCoach", food: "notifHintFood", profile: "notifHintProfile" }[r.name];
  }

  function toast(key) {
    if (window.GymToast && typeof GymToast.show === "function") GymToast.show({ message: str(key), duration: 6500 });
  }

  function goPlan(day) {
    if (window.GymUI) GymUI.navigate("plan");
    if (day && window.GymCalendar && typeof GymCalendar.focusDay === "function") GymCalendar.focusDay(day);
  }

  // Moves the app to the screen a "#..." route names, without a page load.
  function routeTo(hash) {
    var r = parseRoute(hash);
    if (!r) return false;
    if (r.name === "plan") { goPlan(r.day); return true; }
    if (r.name === "checkin") {
      var opener = window.GymCheckin && typeof GymCheckin.open === "function" ? GymCheckin.open() : Promise.resolve("unavailable");
      opener.then(function (res) {
        if (res === "ok") return;
        goPlan(null);
        toast(res === "done" ? "notifCheckinDone" : res === "baseline" ? "notifCheckinBaseline" : "notifCheckinOff");
      });
      return true;
    }
    if (window.GymUI) GymUI.navigate(r.name);
    return true;
  }

  // A url from outside the panel (address bar, web-push click, native shell).
  function routeUrl(url) {
    var hash = hashOf(url);
    if (!hash) return false;
    return routeTo(hash);
  }

  // Run once the app shell is up; a signed-out start waits briefly for the
  // session so "#checkin" is not judged before sign-in restores.
  function routeFromLocation() {
    var hash = window.location.hash;
    if (!parseRoute(hash)) return;
    var go = function () {
      try { history.replaceState(history.state, "", window.location.pathname + window.location.search); } catch (e) {}
      routeTo(hash);
    };
    if (isAuthed() || hash.indexOf("#checkin") !== 0) { go(); return; }
    var done = false;
    var once = function () { if (done) return; done = true; document.removeEventListener("gym:authchange", once); go(); };
    document.addEventListener("gym:authchange", once);
    setTimeout(once, 3000);
  }

  function isSameOriginOtherPage(url) {
    try {
      var resolved = new URL(url, window.location.href);
      if (resolved.origin !== window.location.origin) return false;
      // "./" is this app (the index page), not another page.
      var dir = function (href) { return href.split("#")[0].split("?")[0].replace(/index\.html$/, ""); };
      return dir(resolved.href) !== dir(window.location.href);
    } catch (e) { return false; }
  }

  function onItemTap(item) {
    if (!item.readAt) {
      item.readAt = new Date().toISOString();
      unreadCount = Math.max(0, unreadCount - 1);
      renderBadge();
      renderList();
      if (isAuthed()) {
        GymHeader.api("/notifications/" + encodeURIComponent(item.id) + "/read", { method: "POST" })
          .catch(function () {});
      }
    }
    var url = item.url;
    close();
    var route = routeFor(item);
    if (url && !ROUTE_RE.test(hashOf(url) || "") && isSameOriginOtherPage(url)) { window.location.assign(url); return; }
    routeTo(route);
  }

  // Optimistic: flip everything loaded to read first, then tell the server.
  // /notifications/read-all may not be deployed yet (404) — then fall back to
  // the per-item endpoint for each loaded unread item. Any failure restores
  // the previous state and says so.
  function markAllRead() {
    if (!isAuthed() || unreadCount <= 0) return Promise.resolve();
    var prevCount = unreadCount;
    var seq = fetchSeq;
    var touched = items.filter(function (i) { return !i.readAt; });
    var stamp = new Date().toISOString();
    touched.forEach(function (i) { i.readAt = stamp; });
    unreadCount = 0;
    renderBadge();
    renderList();
    if (readAllBtn && document.activeElement === readAllBtn && closeBtn) closeBtn.focus();
    if (liveEl) liveEl.textContent = str("notifAllReadDone");

    function perItem() {
      return Promise.all(touched.map(function (i) {
        return GymHeader.api("/notifications/" + encodeURIComponent(i.id) + "/read", { method: "POST" })
          .then(function (res) { if (!res.ok) throw new Error("notifications " + res.status); });
      }));
    }
    return GymHeader.api("/notifications/read-all", { method: "POST" })
      .then(function (res) {
        if (res.status === 404) return perItem();
        if (!res.ok) throw new Error("notifications " + res.status);
      })
      .catch(function () {
        touched.forEach(function (i) { i.readAt = null; });
        if (seq === fetchSeq) {
          unreadCount = prevCount;
          renderBadge();
          if (panelOpen) renderList();
        } else {
          fetchNotifications();
        }
        if (liveEl) liveEl.textContent = "";
        if (window.GymToast && typeof GymToast.show === "function") GymToast.show({ message: str("notifAllReadErr") });
      });
  }

  // Which account the cached inbox belongs to — an account switch must not
  // show the previous user's notifications, even briefly.
  var loadedFor = null;
  function currentAccount() {
    var p = window.GymSync && typeof GymSync.profile === "function" ? GymSync.profile() : null;
    return (p && p.email) || null;
  }

  function resetInbox() {
    items = []; unreadCount = 0; shownCount = null; countKnown = false; loadErr = false; loadedFor = null;
    fetchSeq++; // drop any in-flight response for the previous account
  }

  function fetchNotifications() {
    if (!isAuthed()) {
      resetInbox();
      renderBadge();
      if (panelOpen) renderList();
      return Promise.resolve();
    }
    var seq = ++fetchSeq;
    return GymHeader.api("/notifications?limit=50")
      .then(function (res) {
        if (!res.ok) throw new Error("notifications " + res.status);
        return res.json();
      })
      .then(function (doc) {
        if (seq !== fetchSeq || !isAuthed()) return;
        loadedFor = currentAccount();
        countKnown = true;
        items = (doc && Array.isArray(doc.items)) ? doc.items : [];
        unreadCount = (doc && typeof doc.unreadCount === "number")
          ? doc.unreadCount
          : items.filter(function (i) { return !i.readAt; }).length;
        loadErr = false;
        renderBadge();
        if (panelOpen) renderList();
      })
      .catch(function () {
        if (seq !== fetchSeq || !isAuthed()) return;
        loadErr = true;
        renderBadge();
        if (panelOpen) renderList();
      });
  }

  function open() {
    if (!isAuthed()) return;
    buildPanel();
    panelOpen = true;
    if (window.GymMotion) GymMotion.show(panel); else panel.hidden = false;
    backdrop.hidden = false;
    if (bellBtn) bellBtn.setAttribute("aria-expanded", "true");
    renderStrings();
    renderList();
    fetchNotifications();
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    panelOpen = false;
    if (panel) { if (window.GymMotion) GymMotion.hide(panel); else panel.hidden = true; }
    if (backdrop) backdrop.hidden = true;
    if (bellBtn) { bellBtn.setAttribute("aria-expanded", "false"); bellBtn.focus(); }
  }

  // ---------------- wiring ----------------
  function onAuthChange() {
    if (!isAuthed()) {
      resetInbox();
      if (panelOpen) close();
      renderBadge();
      return;
    }
    var acct = currentAccount();
    if (loadedFor && acct && acct !== loadedFor) {
      resetInbox();
      if (panelOpen) renderList();
    }
    build();
    renderBadge();
    fetchNotifications();
  }

  function init() {
    build();
    renderBadge();
    document.addEventListener("gym:authchange", onAuthChange);
    document.addEventListener("gym:synctick", function (e) {
      // sign-in ticks are already covered by the gym:authchange that
      // precedes them — skip the duplicate request.
      var reason = e && e.detail;
      if (reason === "signin" || reason === "signin-migrate") return;
      if (isAuthed()) fetchNotifications();
    });
    // Language switches rewrite <html lang>; re-render our strings then.
    try {
      new MutationObserver(function () {
        renderBadge();
        if (panel) renderStrings();
        if (panelOpen) renderList();
      }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    } catch (e) {}
    if (isAuthed()) fetchNotifications();
    // After ui.js has restored the saved tab, so a deep link wins over it.
    if (document.readyState === "complete") setTimeout(routeFromLocation, 0);
    else window.addEventListener("load", function () { setTimeout(routeFromLocation, 0); });
  }

  // Exposed for a plain-node smoke test of the pure relTime() helper only;
  // no effect in the browser (this file is loaded as a plain <script>, not
  // a module, so `module` is undefined there).
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { relTime: relTime };
  }

  // Everything below touches the DOM/window and only runs in the browser.
  if (typeof window === "undefined") return;

  window.GymNotifications = {
    refresh: fetchNotifications,
    open: open,
    close: close,
    route: routeUrl
  };

  window.addEventListener("hashchange", function () { routeFromLocation(); });
  // A web-push click on an already-open window (service-worker.js).
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", function (e) {
      if (e.data && e.data.type === "gym:route" && typeof e.data.url === "string") routeUrl(e.data.url);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
