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
      row.addEventListener("click", function () { onItemTap(item); });
      listEl.appendChild(row);
    });
  }

  // ---------------- actions ----------------
  function isSameOriginOtherPage(url) {
    try {
      var resolved = new URL(url, window.location.href);
      if (resolved.origin !== window.location.origin) return false;
      var cur = window.location.href.split("#")[0];
      var tgt = resolved.href.split("#")[0];
      return tgt !== cur;
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
    if (url && isSameOriginOtherPage(url)) window.location.assign(url);
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
    close: close
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
