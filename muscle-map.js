/* muscle-map.js
   The weekly body map on the Plan tab: front and back figures (muscle-art.js) in
   which a muscle region lights half after its first session of the week and fully
   after its second.

   A session is a calendar day with at least one exercise ticked done (gym_checks,
   keyed "YYYY-MM-DD_dayId"), whichever plan it came from (Classic, built-in split,
   AI coach). Two exercises on one day, or two plans on one day, are still one
   session. Weeks run Saturday-Friday (GymDate.weekKey), like the rest days.

   An exercise counts for its shape and shape2 regions. Tags are read from the plan
   that is live now (GymApp.exerciseShapes) or from the copy remember() stored when
   the exercise was ticked, so replacing an AI plan or switching split mid-week
   keeps that week's ticks.

   API (window.GymMuscleMap)
     coverage(weekKey)            {regionId: 0|1|2} for the week starting weekKey
     remember(sessionKey, list)   store [{id, shape, shape2}] for a ticked session
     render(el, {sex})            draw / refresh the collapsible card into el
*/
(function () {
  "use strict";

  var LS_CHECKS = "gym_checks", LS_TAGS = "gym_mus_tags", LS_OPEN = "gym_map_open";
  var KEEP_DAYS = 21;
  var prev = null;   // levels at the last render, to pulse only regions that just rose

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }
  function regions() { return window.GymMuscleArt ? window.GymMuscleArt.REGIONS : []; }
  function app() { return window.GymApp || {}; }
  function tr(key) { return app().t ? app().t(key) : key; }
  function lang() { return app().lang ? app().lang() : "en"; }

  // ---------------------------------------------------------------- data
  function remember(sessionKey, list) {
    var tags = read(LS_TAGS) || {}, cut = window.GymDate.key(-KEEP_DAYS), cur = tags[sessionKey] || {};
    (list || []).forEach(function (e) {
      if (e && e.id && e.shape) cur[e.id] = e.shape2 ? [e.shape, e.shape2] : [e.shape];
    });
    tags[sessionKey] = cur;
    Object.keys(tags).forEach(function (k) { if (k.slice(0, 10) < cut) delete tags[k]; });
    try { localStorage.setItem(LS_TAGS, JSON.stringify(tags)); } catch (e) { /* storage full or blocked: live lookup still works */ }
  }

  function coverage(weekKey) {
    var checks = read(LS_CHECKS) || {}, tags = read(LS_TAGS) || {}, days = {}, out = {};
    var live = app().exerciseShapes;
    Object.keys(checks).forEach(function (key) {
      var m = /^(\d{4}-\d{2}-\d{2})_(.+)$/.exec(key), done = checks[key];
      if (!m || !done || window.GymDate.weekStart(m[1]) !== weekKey) return;
      Object.keys(done).forEach(function (exId) {
        if (done[exId] !== true) return;
        var ids = tags[key] && tags[key][exId], sh;
        if (!ids && live && (sh = live(m[2], exId))) ids = [sh.shape, sh.shape2];
        (ids || []).forEach(function (r) {
          if (!r) return;
          days[r] = days[r] || {};
          days[r][m[1]] = 1;   // one session per calendar day
        });
      });
    });
    regions().forEach(function (r) { out[r] = Math.min(2, Object.keys(days[r] || {}).length); });
    return out;
  }

  // ---------------------------------------------------------------- card
  function shapeName(id) {
    var s = (app().muscleShapes || []).filter(function (x) { return x.id === id; })[0];
    return s ? (lang() === "ar" ? s.labelAr : s.label) : id;
  }
  function stateWord(n) { return tr(n === 2 ? "mapTwiceIn" : n === 1 ? "mapOnceIn" : "mapNone"); }
  function regionText(id, n) { return tr("mapRegion").replace("{m}", shapeName(id)).replace("{s}", stateWord(n)); }
  function isOpen() { try { return localStorage.getItem(LS_OPEN) === "1"; } catch (e) { return false; } }

  function build(el) {
    el.innerHTML =
      '<details class="wm"><summary class="wm-sum"><span class="wm-title"></span><span class="wm-count"></span>' +
      '<svg class="wm-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg></summary>' +
      '<div class="wm-body"><div class="wm-figs"></div><p class="wm-name" aria-live="polite"></p>' +
      '<ul class="wm-legend"><li><i class="wm-sw wm-sw1" aria-hidden="true"></i><span class="wm-l1"></span></li>' +
      '<li><i class="wm-sw wm-sw2" aria-hidden="true"></i><span class="wm-l2"></span></li></ul></div></details>';
    var st = {
      det: el.firstChild, title: el.querySelector(".wm-title"), count: el.querySelector(".wm-count"),
      figs: el.querySelector(".wm-figs"), name: el.querySelector(".wm-name"),
      l1: el.querySelector(".wm-l1"), l2: el.querySelector(".wm-l2"), sel: "", sex: "male", levels: {}
    };
    st.det.open = isOpen();
    st.det.addEventListener("toggle", function () {
      try { localStorage.setItem(LS_OPEN, st.det.open ? "1" : "0"); } catch (e) { /* per-viewer convenience only */ }
      if (st.det.open) paint(st);
    });
    el.addEventListener("click", function (e) {
      var g = e.target.closest && e.target.closest("[data-region]");
      if (g) pick(st, g.getAttribute("data-region"));
    });
    el.addEventListener("keydown", function (e) {
      var g = e.target.closest && e.target.closest("[data-region]");
      if (!g) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(st, g.getAttribute("data-region")); return; }
      var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      var all = [].slice.call(el.querySelectorAll("[data-region]")), i = all.indexOf(g) + step;
      all[(i + all.length) % all.length].focus();
    });
    el._wm = st;
    return st;
  }

  function pick(st, id) {
    st.sel = id;
    st.figs.querySelectorAll("[data-region]").forEach(function (g) { g.classList.toggle("wm-sel", g.getAttribute("data-region") === id); });
    st.name.textContent = regionText(id, st.levels[id] || 0);
  }

  function paint(st) {
    var levels = st.levels, focus = document.activeElement && document.activeElement.getAttribute &&
      document.activeElement.getAttribute("data-region");
    var html = "";
    ["front", "back"].forEach(function (view) {
      html += '<figure class="wm-fig"><div class="wm-svg">' + window.GymMuscleArt.figure(view, { sex: st.sex, levels: levels }) +
        "</div><figcaption>" + tr(view === "back" ? "viewBack" : "viewFront") + "</figcaption></figure>";
    });
    st.figs.innerHTML = html;
    st.figs.querySelectorAll("svg").forEach(function (svg, i) {
      svg.removeAttribute("aria-hidden");
      svg.setAttribute("role", "group");
      svg.setAttribute("aria-label", tr(i ? "viewBack" : "viewFront"));
    });
    var stop = focus && st.figs.querySelector('[data-region="' + focus + '"]') ? focus : regions()[0];   // one tab stop; arrows move within
    st.figs.querySelectorAll("[data-region]").forEach(function (g) {
      var id = g.getAttribute("data-region"), n = levels[id] || 0;
      g.setAttribute("role", "button");
      g.setAttribute("tabindex", id === stop ? "0" : "-1");
      g.setAttribute("aria-label", regionText(id, n));
      g.classList.add("wm-r");
      if (id === st.sel) g.classList.add("wm-sel");
      if (prev && n > (prev[id] || 0)) {
        g.classList.add("wm-rise");
        g.addEventListener("animationend", function () { g.classList.remove("wm-rise"); }, { once: true });
      }
    });
    var f = focus && st.figs.querySelector('[data-region="' + focus + '"]');
    if (f) f.focus();
    st.name.textContent = st.sel ? regionText(st.sel, levels[st.sel] || 0) : tr("mapHint");
  }

  function render(el, opts) {
    if (!el || !window.GymMuscleArt) return;
    var st = el._wm || build(el), c = coverage(window.GymDate.weekKey()), two = 0, one = 0;
    st.sex = opts && opts.sex === "female" ? "female" : "male";
    st.levels = c;
    Object.keys(c).forEach(function (r) { if (c[r] === 2) two++; else if (c[r] === 1) one++; });
    st.title.textContent = tr("mapTitle");
    st.count.textContent = tr("mapSummary").replace("{two}", two).replace("{one}", one).replace("{n}", regions().length);
    st.l1.textContent = tr("mapOnce");
    st.l2.textContent = tr("mapTwice");
    if (st.det.open) paint(st);
    prev = c;
  }

  window.GymMuscleMap = { coverage: coverage, remember: remember, render: render };
})();
