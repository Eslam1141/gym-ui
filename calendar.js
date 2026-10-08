/* calendar.js — workout calendar (week strip + full-month expand) and the
 * training-days-of-week preference.
 *
 * Data source for "was this day completed": signed in -> GET
 * /workouts/complete (server, cross-device correct); signed out/offline ->
 * computed from gym_checks via window.GymApp.dayExercises() (app.js).
 * "Completed" == every exercise on that day's checklist is checked, matching
 * app.js's own updateProgress() (done === total) — not the session timer.
 */
(function () {
  "use strict";

  var API_BASE = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var FETCH_TIMEOUT_MS = 8000;

  // ---------------- i18n ----------------
  function lang() {
    try { if (window.activeLang === "ar") return "ar"; } catch (e) {}
    try { return localStorage.getItem("gym_lang") === "ar" ? "ar" : "en"; } catch (e) { return "en"; }
  }
  var STR = {
    calendarTitle: ["Workout Calendar", "تقويم التمرين"],
    expandLabel: ["Expand calendar", "توسيع التقويم"],
    closeLabel: ["Close", "إغلاق"],
    prevMonth: ["Previous month", "الشهر السابق"],
    nextMonth: ["Next month", "الشهر التالي"],
    noWorkout: ["No workout logged", "لم يُسجَّل تمرين"],
    completed: ["Completed", "مكتمل"],
    inProgress: ["{d}/{t} exercises checked", "{d}/{t} تمارين مؤشَّرة"],
    trainingDaysLabel: ["Training days", "أيام التمرين"],
    trainingDaysHint: ["Pick the days you plan to train, so a missed day gets a smarter reminder.", "اختر أيام التمرين حتى يكون تذكير اليوم الفائت أذكى."],
    trainingDaysSignIn: ["Sign in to set your training days.", "سجّل الدخول لتحديد أيام تمرينك."]
  };
  var DOW_SHORT = [
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]
  ];
  function s(k) { var e = STR[k]; return e ? e[lang() === "ar" ? 1 : 0] : k; }
  function fmt(t, params) { return t.replace(/\{(\w+)\}/g, function (_, k) { return params[k] != null ? params[k] : ""; }); }
  function dowShort(i) { return DOW_SHORT[lang() === "ar" ? 1 : 0][i]; }

  // ---------------- small helpers ----------------
  function isAuthed() { return !!(window.GymSync && typeof GymSync.isSignedIn === "function" && GymSync.isSignedIn()); }
  function authToken() { return window.GymSync && GymSync.token ? GymSync.token() : null; }
  function isAnon() { return window.GymUI && GymUI.isAnon && GymUI.isAnon(); }

  function fetchTimeout(url, opts) {
    opts = opts || {};
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
    opts.signal = ctrl.signal;
    return fetch(url, opts).finally(function () { clearTimeout(t); });
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtDate(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  // Local calendar date, from the shared GymDate helper (ui.js) so it matches
  // app.js's todayStr() — the gym_checks storage key — exactly. Evaluated on
  // every call, so it moves forward if the tab stays open past midnight.
  // todayDate() converts that key back into a local midnight Date so
  // weekday/month arithmetic still works.
  function todayKey() { return window.GymDate.key(); }
  function todayDate() {
    var p = todayKey().split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function dayExercises(dayId) {
    return (window.GymApp && window.GymApp.dayExercises) ? (window.GymApp.dayExercises(dayId) || []) : [];
  }

  // ---------------- completion data ----------------
  // Map<"YYYY-MM-DD", {complete:boolean, dayId:string}>
  //
  // The male-plan id migration (app.js's GymMigrations.maleV2) can leave a
  // single old-plan day's checks split across up to three new-plan dayIds
  // sharing the same date key prefix (an exercise's new day isn't always
  // its old day's slot). Each split key is only ever a *subset* of the
  // original day's checks, so more than one "YYYY-MM-DD_dayId" key can
  // legitimately exist for the same date. This map holds exactly one entry
  // per date (never double-counted — a date is a single calendar cell), and
  // among the candidates for a date it keeps the one with the most
  // exercises actually done (the best representative of what was trained
  // that day), preferring a genuinely complete one on a tie. It never
  // synthesizes a false "complete" for a split bucket that isn't.
  function computeLocalCompletion(from, to) {
    var map = {};
    var checks;
    try { checks = JSON.parse(localStorage.getItem("gym_checks")) || {}; } catch (e) { checks = {}; }
    Object.keys(checks).forEach(function (key) {
      if (key.length < 12 || key.charAt(10) !== "_") return;
      var date = key.slice(0, 10);
      if (date < from || date > to) return;
      var dayId = key.slice(11);
      var exercises = dayExercises(dayId);
      if (!exercises.length) return;
      var dayChecks = checks[key];
      if (!dayChecks || typeof dayChecks !== "object") return;
      var done = exercises.filter(function (ex) { return !!dayChecks[ex.id]; }).length;
      var complete = done === exercises.length;
      var existing = map[date];
      if (!existing || done > existing.done || (done === existing.done && complete && !existing.complete)) {
        map[date] = { complete: complete, dayId: dayId, done: done };
      }
    });
    return map;
  }

  function fetchServerCompletion(from, to) {
    var token = authToken();
    return fetchTimeout(API_BASE + "/workouts/complete?from=" + from + "&to=" + to + "&today=" + todayKey(), {
      headers: { "Authorization": "Bearer " + token }
    })
      .then(function (res) { if (!res.ok) throw new Error("workouts " + res.status); return res.json(); })
      .then(function (doc) {
        var map = {};
        (doc.records || []).forEach(function (r) { map[r.date] = { complete: true, dayId: r.dayId }; });
        if (window.GymRest) GymRest.setServer(from, to, doc.restDays, doc.restDaysLeftThisWeek);
        return map;
      })
      .catch(function () { return computeLocalCompletion(from, to); });
  }

  // Rest days (rest-days.js) are layered on top as { rest:true } entries.
  function getCompletionMap(from, to) {
    var p = isAuthed() ? fetchServerCompletion(from, to) : Promise.resolve(computeLocalCompletion(from, to));
    return p.then(function (map) { return window.GymRest ? GymRest.decorate(map, from, to) : map; });
  }

  // ---------------- POST-on-completion hook (called by app.js) ----------------
  var postedKeys = {}; // "date_dayId" -> true, in-session guard against duplicate POSTs

  // rest-days.js sends the local `today` and owns retry (offline queue); it
  // fires gym:workoutcomplete on success so header.js re-reads /me.
  function postCompletion(date, dayId) {
    var key = date + "_" + dayId;
    if (postedKeys[key] || !window.GymRest) return;
    postedKeys[key] = true;
    GymRest.submit(date, dayId).then(function (r) { if (r === "rejected") GymRest.notifyDropped(); });
  }

  // app.js calls this right after updateProgress() on every checkbox toggle.
  function onCheckChanged(dayId, date) {
    try {
      var exercises = dayExercises(dayId);
      if (!exercises.length) return;
      var checks = JSON.parse(localStorage.getItem("gym_checks") || "{}");
      var dayChecks = checks[date + "_" + dayId] || {};
      var done = exercises.filter(function (ex) { return !!dayChecks[ex.id]; }).length;
      if (isAuthed() && done === exercises.length) postCompletion(date, dayId);
      if (date === todayKey()) refreshStrip();
    } catch (e) {}
  }

  // ---------------- DOM refs (filled in mount()) ----------------
  var stripHost, stripDays, expandBtn;
  var modal, modalBackdrop, monthLabel, weekdayRow, grid, dayDetail, prevBtn, nextBtn, closeBtn;
  var trainingDaysHost;
  var viewYear, viewMonth; // month currently shown in the overlay (0-based month)

  var ICON_CHEVRON_L = '<svg viewBox="0 0 24 24"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
  var ICON_CHEVRON_R = '<svg viewBox="0 0 24 24"><path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24"><path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.41 4.3 19.7 2.89 18.29 9.17 12 2.89 5.71 4.3 4.3l6.29 6.29L16.89 4.3z"/></svg>';
  var ICON_EXPAND = '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z"/></svg>';

  // Weeks run Saturday-Friday (Egypt), matching the server's rest-day week.
  var WEEK_START = 6; // Date#getDay() of Saturday
  function weekOffset(d) { return (d.getDay() - WEEK_START + 7) % 7; }

  // ---------------- week strip ----------------
  function weekDatesFor(d) {
    var start = new Date(d);
    start.setDate(d.getDate() - weekOffset(d)); // back up to Saturday
    var out = [];
    for (var i = 0; i < 7; i++) {
      var day = new Date(start);
      day.setDate(start.getDate() + i);
      out.push(day);
    }
    return out;
  }

  function renderStrip(map) {
    if (!stripDays) return;
    var week = weekDatesFor(todayDate());
    var tKey = todayKey();
    stripDays.innerHTML = "";
    week.forEach(function (d) {
      var key = fmtDate(d);
      var entry = map[key];
      var btn = document.createElement("button");
      btn.type = "button";
      var rest = !!(entry && entry.rest && !entry.complete);
      btn.className = "cal-day-cell" + (entry && entry.complete ? " complete" : "") + (rest ? " rest" : "") + (key === tKey ? " today" : "");
      btn.dataset.date = key;
      btn.innerHTML =
        '<span class="cal-dow">' + dowShort(d.getDay()) + '</span>' +
        '<span class="cal-num">' + d.getDate() + '</span>' +
        (rest ? '<span class="cal-rest-mark" aria-hidden="true"></span><span class="sr-only">' + s("restBadge") + '</span>' : '');
      btn.onclick = function () { openModal(d); };
      stripDays.appendChild(btn);
    });
  }

  function refreshStrip() {
    if (!stripDays) return;
    updateStripI18n();
    var week = weekDatesFor(todayDate());
    getCompletionMap(fmtDate(week[0]), fmtDate(week[6])).then(function (map) {
      renderStrip(map);
      if (window.GymRest) GymRest.renderCard(map);
    });
  }

  // Re-applies translated text to the strip's static chrome (title, expand
  // button label) — renderStrip() only rebuilds the day cells, so without
  // this the header stays in whatever language was active at mount().
  function updateStripI18n() {
    if (!stripHost) return;
    var title = stripHost.querySelector(".cal-strip-title");
    if (title) title.textContent = s("calendarTitle");
    if (expandBtn) expandBtn.setAttribute("aria-label", s("expandLabel"));
  }

  // Re-applies translated text to the month overlay's static chrome.
  function updateModalI18n() {
    if (!modal) return;
    if (prevBtn) prevBtn.setAttribute("aria-label", s("prevMonth"));
    if (nextBtn) nextBtn.setAttribute("aria-label", s("nextMonth"));
    if (closeBtn) closeBtn.setAttribute("aria-label", s("closeLabel"));
  }

  // ---------------- month overlay ----------------
  function monthBounds(year, month) {
    var first = new Date(year, month, 1);
    var last = new Date(year, month + 1, 0);
    return { first: first, last: last };
  }

  function renderWeekdayRow() {
    if (!weekdayRow) return;
    weekdayRow.innerHTML = "";
    for (var i = 0; i < 7; i++) {
      var el = document.createElement("div");
      el.className = "cal-weekday";
      el.textContent = dowShort((i + WEEK_START) % 7);
      weekdayRow.appendChild(el);
    }
  }

  var monthReqSeq = 0; // guards against a stale response painting over a newer month

  function renderMonth() {
    if (!grid) return Promise.resolve(null);
    var loc = lang() === "ar" ? "ar-EG" : "en-US";
    if (monthLabel) {
      monthLabel.textContent = new Date(viewYear, viewMonth, 1).toLocaleDateString(loc, { month: "long", year: "numeric" });
    }
    var bounds = monthBounds(viewYear, viewMonth);
    var leading = weekOffset(bounds.first);
    var totalCells = Math.ceil((leading + bounds.last.getDate()) / 7) * 7;
    var tKey = todayKey();
    var reqId = ++monthReqSeq;
    var reqYear = viewYear, reqMonth = viewMonth;

    return getCompletionMap(fmtDate(bounds.first), fmtDate(bounds.last)).then(function (map) {
      // A newer renderMonth() call (e.g. the user tapped next/prev again
      // before this resolved) supersedes this response — don't paint a
      // stale month over whatever is now displayed.
      if (reqId !== monthReqSeq) return map;
      grid.innerHTML = "";
      for (var i = 0; i < totalCells; i++) {
        var dayNum = i - leading + 1;
        var cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cal-grid-cell";
        if (dayNum < 1 || dayNum > bounds.last.getDate()) {
          cell.className += " empty";
          cell.disabled = true;
          grid.appendChild(cell);
          continue;
        }
        var d = new Date(reqYear, reqMonth, dayNum);
        var key = fmtDate(d);
        var entry = map[key];
        if (entry && entry.complete) cell.className += " complete";
        else if (entry && entry.rest) cell.className += " rest";
        if (key === tKey) cell.className += " today";
        cell.textContent = String(dayNum);
        cell.dataset.date = key;
        cell.onclick = function () {
          grid.querySelectorAll(".cal-grid-cell.selected").forEach(function (c) { c.classList.remove("selected"); });
          this.classList.add("selected");
          renderDayDetail(this.dataset.date, map);
        };
        grid.appendChild(cell);
      }
      return map;
    });
  }

  function renderDayDetail(dateKey, map) {
    if (!dayDetail) return;
    var entry = map[dateKey];
    var loc = lang() === "ar" ? "ar-EG" : "en-US";
    var label = new Date(dateKey + "T00:00:00").toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });
    dayDetail.hidden = false;
    var controls = function (e) { if (window.GymRest) GymRest.renderDetailControls(dayDetail, dateKey, e); };

    if (!entry || (entry.rest && !entry.dayId)) {
      // Fall back to a local record for this exact date even when the map
      // came from the server (server only stores fully-complete days).
      var local = computeLocalCompletion(dateKey, dateKey)[dateKey];
      if (!local) {
        dayDetail.innerHTML = '<div class="cal-detail-date">' + label + '</div>' + (entry ? '' : '<div class="cal-detail-empty">' + s("noWorkout") + '</div>');
        controls(entry);
        return;
      }
      entry = local;
    }

    var exercises = dayExercises(entry.dayId);
    var checks = {};
    try { checks = JSON.parse(localStorage.getItem("gym_checks") || "{}")[dateKey + "_" + entry.dayId] || {}; } catch (e) {}

    var doneCount = entry.complete ? exercises.length : exercises.filter(function (ex) { return !!checks[ex.id]; }).length;
    var status = entry.complete
      ? '<span class="cal-detail-status done">' + s("completed") + '</span>'
      : '<span class="cal-detail-status">' + fmt(s("inProgress"), { d: doneCount, t: exercises.length }) + '</span>';

    var list = exercises.map(function (ex) {
      var on = entry.complete || !!checks[ex.id];
      return '<li class="' + (on ? "on" : "") + '">' + GymUI.esc(ex.en || ex.id) + '</li>';
    }).join("");

    dayDetail.innerHTML =
      '<div class="cal-detail-date">' + label + '</div>' +
      status +
      (exercises.length ? '<ul class="cal-detail-list">' + list + '</ul>' : '');
    controls(entry);
  }

  function openModal(focusDate) {
    if (!modal) return;
    var d = focusDate || todayDate();
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    renderWeekdayRow();
    if (dayDetail) { dayDetail.hidden = true; dayDetail.innerHTML = ""; }
    // Reuse the same completion-map fetch renderMonth() already issues for
    // this month instead of firing a second, identical request.
    renderMonth().then(function (map) {
      if (map && focusDate) renderDayDetail(fmtDate(focusDate), map);
    });
  }
  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  function shiftMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    else if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    if (dayDetail) { dayDetail.hidden = true; dayDetail.innerHTML = ""; }
    renderMonth();
  }

  // ---------------- training-days picker ----------------
  var trainingDays = []; // [] == "no preference set" (server default)

  function fetchTrainingDays() {
    var token = authToken();
    if (!token) return Promise.resolve([]);
    return fetchTimeout(API_BASE + "/me?today=" + todayKey(), { headers: { "Authorization": "Bearer " + token } })
      .then(function (res) { if (!res.ok) throw new Error("me " + res.status); return res.json(); })
      .then(function (doc) { return Array.isArray(doc.trainingDays) ? doc.trainingDays : []; })
      .catch(function () { return []; });
  }

  function putTrainingDays(days) {
    var token = authToken();
    if (!token) return;
    fetchTimeout(API_BASE + "/me/training-days", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ days: days })
    }).catch(function () {});
  }

  function renderTrainingDaysPicker() {
    if (!trainingDaysHost) return;
    if (!isAuthed()) {
      trainingDaysHost.innerHTML =
        '<div class="more-label">' + s("trainingDaysLabel") + '</div>' +
        '<p class="cal-more-hint">' + s("trainingDaysSignIn") + '</p>';
      return;
    }
    var selected = trainingDays.length ? trainingDays : [0, 1, 2, 3, 4, 5, 6]; // display default: all on
    trainingDaysHost.innerHTML =
      '<div class="more-label">' + s("trainingDaysLabel") + '</div>' +
      '<div class="cal-weekday-toggle" id="calTrainingDaysChips"></div>' +
      '<p class="cal-more-hint">' + s("trainingDaysHint") + '</p>';
    var chips = trainingDaysHost.querySelector("#calTrainingDaysChips");
    for (var i = 0; i < 7; i++) {
      (function (dow) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "cal-dow-chip" + (selected.indexOf(dow) !== -1 ? " on" : "");
        b.textContent = dowShort(dow);
        b.onclick = function () {
          var idx = trainingDays.indexOf(dow);
          if (idx === -1) trainingDays.push(dow); else trainingDays.splice(idx, 1);
          trainingDays.sort(function (a, b) { return a - b; });
          putTrainingDays(trainingDays);
          renderTrainingDaysPicker();
        };
        chips.appendChild(b);
      })(i);
    }
  }

  // ---------------- mount ----------------
  function mount() {
    stripHost = document.getElementById("calendarStrip");
    if (stripHost) {
      stripHost.innerHTML =
        '<div class="cal-strip">' +
        '  <div class="cal-strip-head">' +
        '    <span class="cal-strip-title">' + s("calendarTitle") + '</span>' +
        '    <button type="button" class="cal-expand-btn" id="calExpandBtn" aria-label="' + s("expandLabel") + '">' + ICON_EXPAND + '</button>' +
        '  </div>' +
        '  <div class="cal-strip-days" id="calStripDays"></div>' +
        '</div>';
      stripDays = document.getElementById("calStripDays");
      expandBtn = document.getElementById("calExpandBtn");
      if (expandBtn) expandBtn.onclick = function () { openModal(todayDate()); };
    }

    modal = document.getElementById("calendarModal");
    if (modal) {
      modalBackdrop = document.getElementById("calendarModalBackdrop");
      monthLabel = document.getElementById("calMonthLabel");
      weekdayRow = document.getElementById("calWeekdayRow");
      grid = document.getElementById("calGrid");
      dayDetail = document.getElementById("calDayDetail");
      prevBtn = document.getElementById("calMonthPrev");
      nextBtn = document.getElementById("calMonthNext");
      closeBtn = document.getElementById("calendarModalClose");
      if (prevBtn) prevBtn.innerHTML = ICON_CHEVRON_L;
      if (nextBtn) nextBtn.innerHTML = ICON_CHEVRON_R;
      if (closeBtn) closeBtn.innerHTML = ICON_CLOSE;
      if (prevBtn) { prevBtn.setAttribute("aria-label", s("prevMonth")); prevBtn.onclick = function () { shiftMonth(-1); }; }
      if (nextBtn) { nextBtn.setAttribute("aria-label", s("nextMonth")); nextBtn.onclick = function () { shiftMonth(1); }; }
      if (closeBtn) { closeBtn.setAttribute("aria-label", s("closeLabel")); closeBtn.onclick = closeModal; }
      if (modalBackdrop) modalBackdrop.onclick = closeModal;
    }

    trainingDaysHost = document.getElementById("moreTrainingDays");

    // One-time cleanup: web push was removed (notifyjob no longer sends
    // push; see notifications.js for the new in-app inbox). Any endpoint a
    // prior version cached is now meaningless — drop it so it doesn't
    // linger forever. gym_push_endpoint stays in sync.js's LOCAL_ONLY list
    // so a stale value elsewhere never syncs onto a device that already
    // cleared it.
    try { localStorage.removeItem("gym_push_endpoint"); } catch (e) {}

    refreshStrip();
    if (isAuthed()) {
      fetchTrainingDays().then(function (days) { trainingDays = days; renderTrainingDaysPicker(); });
    } else {
      renderTrainingDaysPicker();
    }
  }

  // Re-render everything that depends on auth/lang state — called after
  // sign-in/out (full refetch needed) and language switches (text only —
  // pass langOnly so a language toggle doesn't also re-fetch server state
  // that couldn't possibly have changed) via the rebuild hooks app.js and
  // ui.js already use.
  function refresh(langOnly) {
    refreshStrip();
    if (langOnly) {
      renderTrainingDaysPicker();
    } else if (isAuthed()) {
      fetchTrainingDays().then(function (days) { trainingDays = days; renderTrainingDaysPicker(); });
    } else {
      trainingDays = [];
      renderTrainingDaysPicker();
    }
    updateModalI18n();
    if (modal && !modal.hidden) { renderWeekdayRow(); renderMonth(); }
  }

  // Re-reads the strip and, if the month overlay is open, the grid and the
  // selected day's detail (after a rest day is marked/undone, etc.).
  function reload() {
    refreshStrip();
    if (!modal || modal.hidden) return;
    var sel = grid && grid.querySelector(".cal-grid-cell.selected");
    var selKey = sel ? sel.dataset.date : null;
    renderMonth().then(function (map) {
      if (!selKey || !map || !grid) return;
      var cell = grid.querySelector('.cal-grid-cell[data-date="' + selKey + '"]');
      if (cell) cell.classList.add("selected");
      renderDayDetail(selKey, map);
    });
  }

  window.GymCalendar = {
    onCheckChanged: onCheckChanged,
    refresh: refresh,
    reload: reload,
    localEntry: function (date) { return computeLocalCompletion(date, date)[date]; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
