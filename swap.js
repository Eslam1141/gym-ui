/* swap.js - "Machine busy?": swap one exercise of today's day for another move
 * that trains the same muscle with the user's equipment.
 *
 * A swap is not a skip: the new move takes the original's slot and keeps its
 * sets / reps / rest, so the day is ticked and judged like any other. It is
 * only allowed before the first set of that exercise is ticked.
 *
 * State lives in gymday_swaps (device-local, cleared on sign-out like the
 * other gymday_* keys, pruned to today and yesterday):
 *   { "date_dayId": { originalExId: newExId } }
 * app.js asks for the swapped view of a day through GymSwap.expand(). */
(function () {
  "use strict";

  var LS_KEY = "gymday_swaps";
  var MAX_ALTERNATIVES = 5;
  var sheet = null;
  var opener = null;

  function str(key, params) {
    var out = typeof window.t === "function" ? window.t(key) : key;
    if (params) out = out.replace(/\{(\w+)\}/g, function (_, k) { return params[k] != null ? params[k] : ""; });
    return out;
  }

  function lib() { return (window.GymSplits && GymSplits.library) || {}; }

  function readAll() {
    try {
      var v = JSON.parse(localStorage.getItem(LS_KEY));
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch (e) { return {}; }
  }

  function writeAll(all) {
    var keep = [window.GymDate.key(), window.GymDate.key(-1)];
    Object.keys(all).forEach(function (k) {
      if (!keep.some(function (d) { return k.indexOf(d + "_") === 0; }) || !Object.keys(all[k]).length) delete all[k];
    });
    try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch (e) {}
  }

  function map(date, dayId) {
    var m = readAll()[date + "_" + dayId];
    return m && typeof m === "object" ? Object.assign({}, m) : {};
  }

  function swapsFor(date, dayId) {
    var m = map(date, dayId);
    return Object.keys(m).map(function (from) { return { from: from, to: m[from] }; });
  }

  // reps measured in seconds (a hold) vs counted: a swap keeps the original's reps, so it keeps the kind
  function isTimed(reps) { return /^\d+(?:\s*[-–]\s*\d+)?\s*(?:s|secs?|seconds?)\b/i.test(String(reps == null ? "" : reps).trim()); }

  function fits(tools, have) {
    if (!have) return true; // gym plans: any equipment
    return (tools || []).every(function (t) { return t === "none" || have.indexOf(t) !== -1; });
  }

  // `orig` (the plan's own exercise) with the library move `newId` in its place.
  function expand(orig, newId) {
    var m = lib()[newId];
    if (!m) return orig;
    var out = {
      id: newId, en: m.en, vid: m.vid, shape: m.shape, tier: m.tier, tools: (m.tools || []).slice(),
      sets: orig.sets, reps: orig.reps, rest: orig.rest, swapFrom: orig.swapFrom || { id: orig.id, en: orig.en }
    };
    if (m.shape2) out.shape2 = m.shape2;
    return out;
  }

  // Up to five library moves that share the exercise's primary muscle, fit the plan's equipment
  // and are not already in the day (as it is now, or as the plan has it: a move swapped out of a
  // slot stays reserved so undoing that swap can never put it in two slots). Same secondary muscle and same tier rank first.
  function alternatives(ex, dayId) {
    var L = lib();
    var have = window.GymApp && GymApp.swapTools ? GymApp.swapTools(dayId) : null;
    var inDay = {}, names = {};
    (window.GymApp && GymApp.dayExercises ? GymApp.dayExercises(dayId) : []).forEach(function (e) {
      inDay[e.id] = 1; names[e.en] = 1;
      if (e.swapFrom) { inDay[e.swapFrom.id] = 1; names[e.swapFrom.en] = 1; }
    });
    var out = [];
    Object.keys(L).forEach(function (id, order) {
      var m = L[id];
      if (m.shape !== ex.shape || id === ex.id || inDay[id] || names[m.en]) return;
      if (isTimed(m.reps) !== isTimed(ex.reps) || !fits(m.tools, have)) return;
      var score = (m.shape2 && m.shape2 === ex.shape2 ? 2 : 0) + (m.tier === ex.tier ? 1 : 0);
      out.push({ id: id, score: score, order: order });
    });
    out.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
    return out.slice(0, MAX_ALTERNATIVES).map(function (o) { return expand(ex, o.id); });
  }

  function inView(date, dayId, exId) {
    return (window.GymApp && GymApp.dayExercises ? GymApp.dayExercises(dayId, date) : []).some(function (e) { return e.id === exId; });
  }

  function locked(date, dayId, exId) { return !!(window.GymVerify && GymVerify.exerciseTicked(date, dayId, exId)); }

  // origExId is the plan's own exercise (the slot); false when the slot already has a tick.
  function apply(date, dayId, origExId, newExId) {
    if (!lib()[newExId]) return false;
    var all = readAll();
    var k = date + "_" + dayId;
    var cur = (all[k] || {})[origExId] || origExId;
    if (locked(date, dayId, cur)) return false;
    all[k] = Object.assign({}, all[k]);
    all[k][origExId] = newExId;
    writeAll(all);
    return true;
  }

  function undo(date, dayId, origExId) {
    var all = readAll();
    var k = date + "_" + dayId;
    var cur = (all[k] || {})[origExId];
    if (!cur || locked(date, dayId, cur)) return false;
    if (inView(date, dayId, origExId)) return false; // another slot already shows it
    delete all[k][origExId];
    writeAll(all);
    return true;
  }

  // ---------------- sheet ----------------
  function close() {
    var gone = sheet;
    sheet = null;
    document.removeEventListener("keydown", onKey, true);
    if (gone) GymMotion.hide(gone, function () { gone.remove(); });
    if (opener && document.contains(opener)) opener.focus();
    opener = null;
  }

  function onKey(e) {
    if (e.key === "Escape") { e.stopPropagation(); close(); return; }
    if (e.key !== "Tab" || !sheet) return;
    var f = sheet.querySelectorAll("button:not([disabled])");
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function thumb(vid) {
    var box = document.createElement("span");
    box.className = "swap-thumb";
    box.setAttribute("aria-hidden", "true");
    if (vid) {
      var img = document.createElement("img");
      img.loading = "lazy";
      img.alt = "";
      img.src = "https://i.ytimg.com/vi/" + encodeURIComponent(vid) + "/mqdefault.jpg";
      img.onerror = function () { img.remove(); };
      box.appendChild(img);
    }
    return box;
  }

  // slot: the exercise showing on the card now (the plan's move or an earlier swap);
  // origId: the plan's own move, whose slot it is.
  function open(slot, origId, dayId, onDone) {
    if (sheet) return;
    opener = document.activeElement;
    var date = window.GymDate.key();
    var list = alternatives(slot, dayId);
    sheet = document.createElement("div");
    sheet.id = "swapSheet";
    sheet.className = "syd m-ovl";
    sheet.innerHTML =
      '<div class="syd-backdrop"></div>' +
      '<div class="syd-panel swap-panel m-ovl-card" role="dialog" aria-modal="true" aria-labelledby="swapTitle">' +
      '<h2 id="swapTitle" class="syd-title"></h2>' +
      '<ul class="swap-list"></ul>' +
      '<p class="swap-none" hidden></p>' +
      '<div class="syd-actions"><button type="button" class="syd-no swap-cancel"></button></div></div>';
    var q = function (s) { return sheet.querySelector(s); };
    q(".syd-title").textContent = str("swapTitle", { name: GymApp.exName(slot) });
    q(".swap-cancel").textContent = str("cancel");
    var ul = q(".swap-list");
    if (!list.length) {
      var none = q(".swap-none");
      none.textContent = str("swapNone");
      none.hidden = false;
      ul.hidden = true;
    }
    list.forEach(function (alt) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "swap-opt";
      b.dataset.swapTo = alt.id;
      var txt = document.createElement("span");
      txt.className = "swap-opt-text";
      var n = document.createElement("span");
      n.className = "swap-opt-name";
      n.textContent = GymApp.exName(alt);
      var mus = document.createElement("span");
      mus.className = "swap-opt-mus";
      mus.textContent = GymApp.exMuscles(alt);
      txt.appendChild(n);
      txt.appendChild(mus);
      b.appendChild(thumb(alt.vid));
      b.appendChild(txt);
      b.onclick = function () {
        var ok = apply(date, dayId, origId, alt.id);
        if (ok && slot.id !== origId) GymVerify.clearExercise(date, dayId, slot.id);
        opener = ok ? null : opener; // the card is rebuilt; nothing to hand focus back to
        close();
        if (ok && onDone) onDone();
      };
      li.appendChild(b);
      ul.appendChild(li);
    });
    q(".swap-cancel").onclick = close;
    q(".syd-backdrop").onclick = close;
    document.body.appendChild(sheet);
    GymMotion.show(sheet);
    document.addEventListener("keydown", onKey, true);
    (q(".swap-opt") || q(".swap-cancel")).focus();
  }

  window.GymSwap = {
    map: map,
    swapsFor: swapsFor,
    alternatives: alternatives,
    expand: expand,
    apply: apply,
    undo: undo,
    inView: inView,
    open: open
  };
})();
