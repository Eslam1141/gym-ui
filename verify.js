/* verify.js - on-device rules for verified training days.
 *
 * A training day counts toward the streak only when it was trained set by set
 * with real time between ticks (gym-be judges the same evidence on arrival).
 * This file owns the device side: the 60 s gap between set ticks, the saved
 * workout-timer start, and the evidence a completion carries.
 *
 * State lives in gymday_verify (device-local, cleared on sign-out like the
 * other gymday_* keys, pruned to today and yesterday):
 *   { "date_dayId": { start, last, ticks: { exId: [ms | 0, ...] }, state } }
 * `last` is the latest *accepted* tick: un-ticking and refused ticks never move it. */
(function () {
  "use strict";

  var LS_KEY = "gymday_verify";
  var MIN_GAP_MS = 60000;
  var MAX_SETS = 10; // the client caps sets per exercise at 10 (app.js setCount)
  var HELD_REASONS = ["gap_too_short", "tick_before_timer", "missing_sets"];

  function readAll() {
    try {
      var v = JSON.parse(localStorage.getItem(LS_KEY));
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch (e) { return {}; }
  }

  function writeAll(all) {
    var keep = [window.GymDate.key(), window.GymDate.key(-1)];
    Object.keys(all).forEach(function (k) {
      if (!keep.some(function (d) { return k.indexOf(d + "_") === 0; })) delete all[k];
    });
    try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch (e) {}
  }

  function keyOf(date, dayId) { return date + "_" + dayId; }

  function entryOf(all, date, dayId) {
    var k = keyOf(date, dayId);
    if (!all[k]) all[k] = { start: 0, last: 0, ticks: {}, state: "" };
    return all[k];
  }

  // gym plans 50 min, home plans 30, anything else 30. Built-in gym plans must never fall to 30.
  function planOf(dayId) {
    var id = String(dayId || "");
    if (/^sp[3-6]g[mf]_/.test(id)) return "gym";
    if (/^sp[3-6]h[mf]_/.test(id)) return "home";
    if (/^[mf]_/.test(id)) return "gym";   // Classic gym days: m_upper, m_upperA, f_lowerA ...
    if (/^[mf]c_/.test(id)) return "home";  // Calisthenics: mc_push, fc_legs ...
    return "";
  }

  function minSeconds(plan) { return plan === "gym" ? 3000 : 1800; }

  function setCountOf(ex) { return Math.min(MAX_SETS, Math.max(1, parseInt(ex.sets, 10) || 1)); }

  function tryTick(date, dayId, exId, setIdx, nowMs) {
    var all = readAll();
    var e = entryOf(all, date, dayId);
    var gap = nowMs - e.last;
    if (e.last && gap < MIN_GAP_MS) return { ok: false, waitSec: Math.ceil((MIN_GAP_MS - gap) / 1000) };
    var arr = e.ticks[exId] || (e.ticks[exId] = []);
    while (arr.length <= setIdx) arr.push(0);
    arr[setIdx] = nowMs;
    e.last = nowMs;
    if (!e.start) e.start = nowMs;
    writeAll(all);
    return { ok: true };
  }

  function untick(date, dayId, exId, setIdx) {
    var all = readAll();
    var e = all[keyOf(date, dayId)];
    if (!e || !e.ticks[exId]) return;
    e.ticks[exId][setIdx] = 0;
    writeAll(all);
  }

  function clearExercise(date, dayId, exId) {
    var all = readAll();
    var e = all[keyOf(date, dayId)];
    if (!e || !e.ticks[exId]) return;
    delete e.ticks[exId];
    writeAll(all);
  }

  function hasTicks(date, dayId) {
    var e = readAll()[keyOf(date, dayId)];
    if (!e) return false;
    return Object.keys(e.ticks).some(function (id) { return e.ticks[id].some(function (ms) { return ms > 0; }); });
  }

  function exerciseTicked(date, dayId, exId) {
    var e = readAll()[keyOf(date, dayId)];
    return !!(e && e.ticks[exId] && e.ticks[exId].some(function (ms) { return ms > 0; }));
  }

  function timerStart(date, dayId) {
    var e = readAll()[keyOf(date, dayId)];
    return e && e.start ? e.start : 0;
  }

  function setTimerStart(date, dayId, ms) {
    var all = readAll();
    var e = entryOf(all, date, dayId);
    if (e.start) return;
    e.start = ms;
    writeAll(all);
  }

  function iso(ms) { return new Date(ms).toISOString(); }

  // kind: "live" | "save_yesterday"
  function evidence(date, dayId, kind) {
    var e = readAll()[keyOf(date, dayId)] || { start: 0, last: 0, ticks: {} };
    var exercises = window.GymApp && GymApp.dayExercises ? GymApp.dayExercises(dayId) : [];
    var sets = [];
    var lastTick = 0;
    exercises.forEach(function (ex) {
      var arr = e.ticks[ex.id] || [];
      for (var i = 0; i < setCountOf(ex); i++) {
        var ms = arr[i] || 0;
        if (ms > lastTick) lastTick = ms;
        sets.push({ ex: ex.id, set: i, at: ms ? iso(ms) : null });
      }
    });
    var out = {
      v: 1,
      kind: kind || "live",
      plan: planOf(dayId),
      timerStart: e.start ? iso(e.start) : null,
      elapsedSec: e.start ? Math.max(0, Math.round(((lastTick || Date.now()) - e.start) / 1000)) : 0,
      sets: sets
    };
    var swaps = window.GymSwap && GymSwap.swapsFor ? GymSwap.swapsFor(date, dayId) : [];
    if (swaps.length) out.swaps = swaps;
    return out;
  }

  // Mirrors gym-be workoutlog.Judge: hard failures -> pending, a short day -> flagged, else verified.
  function judge(ev) {
    var reasons = [];
    var start = ev.timerStart ? Date.parse(ev.timerStart) : 0;
    var times = [];
    var missing = false;
    (ev.sets || []).forEach(function (s) {
      if (s.at) times.push(Date.parse(s.at)); else missing = true;
    });
    times.sort(function (a, b) { return a - b; });
    if (ev.kind === "save_yesterday") reasons.push("save_yesterday");
    if (missing || !times.length) reasons.push("missing_sets");
    for (var i = 1; i < times.length; i++) {
      if (times[i] - times[i - 1] < MIN_GAP_MS) { reasons.push("gap_too_short"); break; }
    }
    if (times.length && (!start || times[0] < start)) reasons.push("tick_before_timer");
    var hard = reasons.some(function (r) { return HELD_REASONS.indexOf(r) !== -1; });
    if (ev.kind === "save_yesterday") return { state: "pending", reasons: reasons };
    if (hard) return { state: "pending", reasons: reasons };
    if (start && times.length && times[times.length - 1] - start < minSeconds(ev.plan) * 1000) {
      return { state: "flagged", reasons: ["short_duration"] };
    }
    return { state: "verified", reasons: [] };
  }

  function localState(date, dayId) {
    var e = readAll()[keyOf(date, dayId)];
    return e && e.state ? e.state : "";
  }

  function setLocalState(date, dayId, state) {
    var all = readAll();
    entryOf(all, date, dayId).state = state;
    writeAll(all);
  }

  window.GymVerify = {
    MIN_GAP_MS: MIN_GAP_MS,
    minSeconds: minSeconds,
    planOf: planOf,
    tryTick: tryTick,
    untick: untick,
    clearExercise: clearExercise,
    hasTicks: hasTicks,
    exerciseTicked: exerciseTicked,
    timerStart: timerStart,
    setTimerStart: setTimerStart,
    evidence: evidence,
    judge: judge,
    localState: localState,
    setLocalState: setLocalState
  };
})();
