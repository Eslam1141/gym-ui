/* rest-days.js — rest days, the "save yesterday" prompt, and the completion
 * queue that backs both.
 *
 * Rest days (pairs with gym-be POST/DELETE /workouts/rest): a rest day keeps
 * the streak but adds nothing; max 2 per Saturday-Friday week; only the local
 * today or yesterday; not on a trained day. Signed in -> the server is the
 * source of truth (calendar.js feeds it from GET /workouts/complete). Signed
 * out / anonymous -> the same rules enforced locally in gymrest_days (no API).
 *
 * Save yesterday: on app open, if yesterday has partial local checks but no
 * completion or rest day, ask once whether the user finished it. Never asks
 * about older days; "No" is remembered per date.
 *
 * Completion queue: POST /workouts/complete always sends the client-local
 * `today`. A network/5xx failure queues the item (gymrest_pending); a
 * 400 date_out_of_window (the day fell out of the yesterday window while
 * offline) drops it instead of retrying forever.
 *
 * The gymrest_* keys are deliberately not gym_-prefixed: device-local, never
 * synced (same convention as gymday_last_completed). */
(function () {
  "use strict";

  var API_BASE = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var FETCH_TIMEOUT_MS = 8000;
  var MAX_PER_WEEK = 2;
  var LS_REST = "gymrest_days";
  var LS_DISMISSED = "gymrest_syd_dismissed";
  var LS_PENDING = "gymrest_pending";

  function str(key, params) {
    var out = typeof window.t === "function" ? window.t(key) : key;
    if (params) out = out.replace(/\{(\w+)\}/g, function (_, k) { return params[k] != null ? params[k] : ""; });
    return out;
  }

  // ---------------- small helpers ----------------
  function isAuthed() { return !!(window.GymSync && typeof GymSync.isSignedIn === "function" && GymSync.isSignedIn()); }
  function authToken() { return window.GymSync && GymSync.token ? GymSync.token() : null; }
  function today() { return window.GymDate.key(); }
  function yesterday() { return window.GymDate.key(-1); }

  function readJSON(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  function fetchTimeout(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers["Authorization"] = "Bearer " + authToken();
    opts.headers = headers;
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
    opts.signal = ctrl.signal;
    return fetch(API_BASE + path, opts).finally(function () { clearTimeout(timer); });
  }

  function errCode(res) {
    return res.json().then(function (b) { return (b && b.error && (b.error.code || b.error)) || ""; }, function () { return ""; });
  }

  function toast(message) {
    if (window.GymToast && typeof GymToast.show === "function") GymToast.show({ message: message, duration: 6500 });
  }

  // Saturday-Friday week containing `key` (the server derives it the same way).
  function weekStart(key) {
    var p = key.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7));
    return d.toISOString().slice(0, 10);
  }

  function isEditable(key) { return key === today() || key === yesterday(); }

  // ---------------- rest-day state ----------------
  var serverRest = [];     // rest dates the server reported (merged per fetched range)
  var serverLeft = null;   // restDaysLeftThisWeek from the server, null until known

  function localRest() { var l = readJSON(LS_REST, []); return Array.isArray(l) ? l : []; }
  function restList() { return isAuthed() ? serverRest : localRest(); }
  function isRest(key) { return restList().indexOf(key) !== -1; }

  function restLeft() {
    if (isAuthed()) return serverLeft == null ? MAX_PER_WEEK : serverLeft;
    var ws = weekStart(today());
    var used = localRest().filter(function (k) { return weekStart(k) === ws; }).length;
    return Math.max(0, MAX_PER_WEEK - used);
  }

  // calendar.js feeds each GET /workouts/complete?from&to response in here.
  function setServer(from, to, restDays, left) {
    serverRest = serverRest.filter(function (k) { return k < from || k > to; }).concat(restDays || []);
    if (typeof left === "number") serverLeft = left;
  }

  // Adds rest entries to a calendar completion map. Training wins: a date with
  // a completion is never shown as rest.
  function decorate(map, from, to) {
    restList().forEach(function (k) {
      if (k < from || k > to) return;
      var e = map[k];
      if (e && e.complete) return;
      if (e) e.rest = true; else map[k] = { complete: false, rest: true };
    });
    return map;
  }

  // Resolves { ok } or { ok:false, message }.
  function setRest(date, on) {
    if (!isEditable(date)) return Promise.resolve({ ok: false, message: str("restErrWindow") });
    if (!isAuthed()) return Promise.resolve(setRestLocal(date, on));
    var req = on
      ? fetchTimeout("/workouts/rest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: date })
        })
      : fetchTimeout("/workouts/rest/" + encodeURIComponent(date), { method: "DELETE" });
    return req.then(function (res) {
      if (res.ok) {
        return res.json().then(function (b) { return b || {}; }, function () { return {}; }).then(function (b) {
          serverRest = serverRest.filter(function (k) { return k !== date; });
          if (on) serverRest.push(date);
          if (typeof b.restDaysLeftThisWeek === "number") serverLeft = b.restDaysLeftThisWeek;
          changed();
          return { ok: true };
        });
      }
      return errCode(res).then(function (code) {
        var key = code === "rest_day_limit" ? "restErrLimit"
          : code === "already_trained" ? "restErrTrained"
          : code === "date_out_of_window" ? "restErrWindow" : "restErrNet";
        return { ok: false, message: str(key) };
      });
    }).catch(function () { return { ok: false, message: str("restErrNet") }; });
  }

  function setRestLocal(date, on) {
    var list = localRest().filter(function (k) { return k !== date; });
    if (on) {
      var entry = window.GymCalendar && GymCalendar.localEntry ? GymCalendar.localEntry(date) : null;
      if (entry && entry.complete) return { ok: false, message: str("restErrTrained") };
      var ws = weekStart(date);
      if (list.filter(function (k) { return weekStart(k) === ws; }).length >= MAX_PER_WEEK) {
        return { ok: false, message: str("restErrLimit") };
      }
      list.push(date);
    }
    list.sort();
    writeJSON(LS_REST, list.slice(-60));
    changed();
    return { ok: true };
  }

  // /me (streak, todayDone) depends on rest days, so header.js re-reads it.
  function changed() {
    try { document.dispatchEvent(new CustomEvent("gym:restchange")); } catch (e) {}
    if (window.GymCalendar && GymCalendar.reload) GymCalendar.reload();
  }

  function toggle(date, btn) {
    var on = !isRest(date);
    if (btn) btn.disabled = true;
    return setRest(date, on).then(function (r) {
      if (btn) btn.disabled = false;
      toast(r.ok ? str(on ? "restMarked" : "restRemoved") : r.message);
      return r;
    });
  }

  // ---------------- UI: today card (inside the week strip panel) ----------------
  var ICON_MOON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.7 14.4A8.5 8.5 0 0 1 9.6 3.3a.75.75 0 0 0-1-.9A10 10 0 1 0 21.6 15.4a.75.75 0 0 0-.9-1z"/></svg>';

  function actionButton(date, entry) {
    // null when nothing can be changed for this date (older day, or trained).
    if (!isEditable(date) || (entry && entry.complete)) return null;
    var rest = isRest(date);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rest-btn" + (rest ? " is-undo" : "");
    btn.textContent = str(rest ? "restUndo" : (date === today() ? "restTake" : "restMark"));
    if (!rest && restLeft() === 0) btn.disabled = true;
    btn.onclick = function () { toggle(date, btn); };
    return btn;
  }

  function leftText() { return str("restLeft", { n: restLeft() }); }

  var lastMap = null;

  function renderCard(map) {
    if (map) lastMap = map;
    else map = lastMap;
    var panel = document.querySelector("#calendarStrip .cal-strip");
    if (!panel) return;
    var card = panel.querySelector(".rest-card");
    if (!card) {
      card = document.createElement("div");
      card.className = "rest-card";
      panel.appendChild(card);
    }
    var tKey = today();
    var entry = map && map[tKey];
    var me = window.GymHeader && GymHeader.me ? GymHeader.me() : null;
    var trained = !!((entry && entry.complete) || (isAuthed() && me && me.todayDone === true));
    var rest = !trained && isRest(tKey);
    var state = trained ? "restTodayDone" : rest ? "restTodayRest" : "restTodayNone";

    card.className = "rest-card" + (rest ? " is-rest" : "") + (trained ? " is-done" : "");
    card.innerHTML = "";
    var text = document.createElement("div");
    text.className = "rest-card-text";
    text.innerHTML =
      '<span class="rest-card-state" role="status">' + (rest ? ICON_MOON : "") + '<span></span></span>' +
      '<span class="rest-card-left"></span>';
    text.querySelector(".rest-card-state span:last-child").textContent = str(state);
    text.querySelector(".rest-card-left").textContent = leftText() + ". " + str("restHint");
    card.appendChild(text);
    var btn = trained ? null : actionButton(tKey, entry);
    if (btn) card.appendChild(btn);
  }

  // Controls for the month overlay's day-detail panel (calendar.js).
  function renderDetailControls(host, date, entry) {
    var old = host.querySelector(".rest-detail");
    if (old) old.remove();
    var btn = actionButton(date, entry);
    var rest = isRest(date) && !(entry && entry.complete);
    if (!btn && !rest) return;
    var box = document.createElement("div");
    box.className = "rest-detail";
    if (rest) {
      var badge = document.createElement("span");
      badge.className = "cal-detail-status rest";
      badge.innerHTML = ICON_MOON + "<span></span>";
      badge.lastChild.textContent = str("restBadge");
      box.appendChild(badge);
    }
    if (btn) {
      box.appendChild(btn);
      var left = document.createElement("p");
      left.className = "cal-more-hint";
      left.textContent = leftText();
      box.appendChild(left);
    }
    host.appendChild(box);
  }

  // Rest days marked while signed out live in gymrest_days. After sign-in they
  // would be invisible (the server is the source of truth), so push the ones
  // still inside the today/yesterday window and drop the rest.
  var migrating = false;
  function migrateLocal() {
    var list = localRest();
    if (migrating || !isAuthed() || !list.length) return Promise.resolve();
    migrating = true;
    var keep = list.filter(isEditable);
    function next(i) {
      if (i >= keep.length) return Promise.resolve();
      return fetchTimeout("/workouts/rest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: keep[i] })
      }).then(function (res) { return res.ok || res.status < 500 ? next(i + 1) : Promise.reject(new Error("rest " + res.status)); });
    }
    return next(0).then(function () {
      try { localStorage.removeItem(LS_REST); } catch (e) {}
      changed();
    }, function () { /* offline: keep them, retry on the next signal */ })
      .finally(function () { migrating = false; });
  }

  // ---------------- completion queue ----------------
  var flushing = false;

  function queue() { var q = readJSON(LS_PENDING, []); return Array.isArray(q) ? q : []; }
  function enqueue(item) {
    var q = queue();
    if (q.some(function (x) { return x.date === item.date && x.dayId === item.dayId; })) return;
    q.push(item);
    writeJSON(LS_PENDING, q.slice(-30));
  }

  // Resolves "ok" | "queued" (will retry) | "rejected" (400, never retry).
  function send(item) {
    return fetchTimeout("/workouts/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: item.date, dayId: item.dayId, today: today() })
    }).then(function (res) {
      if (res.ok) {
        try { document.dispatchEvent(new CustomEvent("gym:workoutcomplete", { detail: { date: item.date, dayId: item.dayId } })); } catch (e) {}
        return "ok";
      }
      if (res.status === 400) return "rejected"; // date_out_of_window / invalid_request: retrying can't help
      return "queued";
    }).catch(function () { return "queued"; });
  }

  // Posts a completion; a retryable failure is queued instead of lost.
  function submit(date, dayId) {
    return send({ date: date, dayId: dayId }).then(function (r) {
      if (r === "queued") enqueue({ date: date, dayId: dayId });
      return r;
    });
  }

  function flushQueue() {
    if (flushing || !isAuthed()) return Promise.resolve();
    var q = queue();
    if (!q.length) return Promise.resolve();
    flushing = true;
    var dropped = false;
    function next(i) {
      if (i >= q.length) return Promise.resolve();
      return send(q[i]).then(function (r) {
        if (r === "queued") { q = q.slice(i); return "stop"; }
        if (r === "rejected") dropped = true;
        return next(i + 1);
      });
    }
    return next(0).then(function (stop) {
      writeJSON(LS_PENDING, stop === "stop" ? q : []);
      if (dropped) toast(str("queueDropped"));
    }).finally(function () { flushing = false; });
  }

  // ---------------- save-yesterday prompt ----------------
  var sheet = null;
  var resolvedFor = null;    // yesterday's key once we've asked or ruled it out
  var checking = false;

  function dismissedList() { var l = readJSON(LS_DISMISSED, []); return Array.isArray(l) ? l : []; }
  function dismiss(date) {
    var l = dismissedList();
    if (l.indexOf(date) === -1) l.push(date);
    writeJSON(LS_DISMISSED, l.slice(-14));
  }

  // Best partial day for `date`, or null. A fully checked day (any bucket)
  // means it was already completed, so nothing to ask.
  function partialFor(date) {
    var checks = readJSON("gym_checks", {});
    var best = null;
    var prefix = date + "_";
    for (var key in checks) {
      if (key.indexOf(prefix) !== 0) continue;
      var dayId = key.slice(prefix.length);
      var ex = window.GymApp && GymApp.dayExercises ? GymApp.dayExercises(dayId) : [];
      if (!ex.length || !checks[key]) continue;
      var done = ex.filter(function (e) { return !!checks[key][e.id]; }).length;
      if (done === ex.length) return null;
      if (done > 0 && (!best || done > best.done)) best = { dayId: dayId, done: done, total: ex.length };
    }
    return best;
  }

  function onboardingOpen() { var ob = document.getElementById("onboarding"); return !!ob && !ob.hidden; }

  // Has yesterday already been recorded (completion or rest)? Rejects when the
  // server can't be asked, so we retry on a later open instead of guessing.
  function alreadyRecorded(date) {
    if (!isAuthed()) return Promise.resolve(isRest(date));
    return fetchTimeout("/workouts/complete?from=" + date + "&to=" + date + "&today=" + today())
      .then(function (res) { if (!res.ok) throw new Error("workouts " + res.status); return res.json(); })
      .then(function (doc) {
        setServer(date, date, doc.restDays, doc.restDaysLeftThisWeek);
        return (doc.records || []).length > 0 || (doc.restDays || []).indexOf(date) !== -1;
      });
  }

  function maybePrompt() {
    var date = yesterday();
    if (checking || resolvedFor === date || sheet || onboardingOpen()) return;
    if (!isAuthed() && !(window.GymUI && GymUI.isAnon && GymUI.isAnon())) return;
    if (dismissedList().indexOf(date) !== -1) { resolvedFor = date; return; }
    var partial = partialFor(date);
    if (!partial) { resolvedFor = date; return; }
    if (queue().some(function (x) { return x.date === date; })) { resolvedFor = date; return; }
    checking = true;
    alreadyRecorded(date).then(function (recorded) {
      checking = false;
      if (recorded) { resolvedFor = date; return; }
      if (yesterday() !== date) return; // midnight passed while we asked
      resolvedFor = date;
      openSheet(date, partial);
    }, function () { checking = false; });
  }

  function openSheet(date, partial) {
    var dayName = window.GymApp && GymApp.dayName ? GymApp.dayName(partial.dayId) : "";
    sheet = document.createElement("div");
    sheet.id = "saveYdaySheet";
    sheet.className = "syd";
    sheet.innerHTML =
      '<div class="syd-backdrop"></div>' +
      '<div class="syd-panel" role="dialog" aria-modal="true" aria-labelledby="sydTitle" aria-describedby="sydBody">' +
      '<h2 id="sydTitle" class="syd-title"></h2>' +
      '<p id="sydBody" class="syd-body"></p>' +
      '<div class="syd-actions">' +
      '<button type="button" class="syd-yes"></button>' +
      '<button type="button" class="syd-no"></button>' +
      '</div></div>';
    var q = function (s) { return sheet.querySelector(s); };
    q(".syd-title").textContent = str("sydTitle");
    q(".syd-body").textContent = str("sydBody", { d: partial.done, t: partial.total, day: dayName });
    var yes = q(".syd-yes"), no = q(".syd-no");
    yes.textContent = str("sydYes");
    no.textContent = str("sydNo");

    function close() {
      document.removeEventListener("keydown", onKey, true);
      if (sheet) sheet.remove();
      sheet = null;
    }
    function onKey(e) {
      if (e.key === "Escape") { e.stopPropagation(); no.onclick(); return; }
      if (e.key !== "Tab") return;
      var first = yes, last = no;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    no.onclick = function () { dismiss(date); close(); };
    q(".syd-backdrop").onclick = no.onclick;
    yes.onclick = function () {
      yes.disabled = no.disabled = true;
      var run = isAuthed() ? submit(date, partial.dayId) : Promise.resolve("ok");
      run.then(function (r) {
        close();
        if (r === "rejected") { dismiss(date); toast(str("sydTooLate")); return; }
        if (window.GymApp && GymApp.markDayComplete) GymApp.markDayComplete(date, partial.dayId);
        toast(str("sydSaved"));
        if (window.GymCalendar && GymCalendar.reload) GymCalendar.reload();
      });
    };
    document.body.appendChild(sheet);
    document.addEventListener("keydown", onKey, true);
    yes.focus();
  }

  // ---------------- wiring ----------------
  function onSignal() { migrateLocal(); flushQueue(); maybePrompt(); }

  function init() {
    document.addEventListener("gym:authchange", function () { setTimeout(onSignal, 400); });
    document.addEventListener("gym:synctick", function () { flushQueue(); });
    window.addEventListener("online", function () { flushQueue(); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) onSignal(); });
    // The card reads todayDone from /me, which arrives after the strip.
    if (window.GymHeader && GymHeader.onChange) GymHeader.onChange(function () { renderCard(); });
    // Give session restore a moment so a signed-in user isn't treated as local.
    setTimeout(onSignal, 2500);
  }

  window.GymRest = {
    decorate: decorate,
    setServer: setServer,
    isRest: isRest,
    left: restLeft,
    renderCard: renderCard,
    renderDetailControls: renderDetailControls,
    submit: submit,
    flushQueue: flushQueue,
    maybePrompt: maybePrompt
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
