/* watch-screen.js — the Watch tab (#screen-watch): today's dial, resting/average
 * heart rate and the last 7 days. All data and permissions live in watch.js
 * (window.GymWatch); this file only draws state() and calls connect / refresh /
 * manage / disconnect. Nothing here reads or writes anything but two
 * device-local, non-synced keys (etqwatch_tabseen, etqwatch_metric).
 *
 * The one memorable thing is the dial: three concentric rings (steps, active
 * kcal, sleep) that fill in turn while the steps count up in the centre. It
 * plays once per data change, not on every visit, and not at all under reduced
 * motion (GymMotion.reduced(): the OS setting or the app's "Remove animations").
 * Colour is never the only carrier: every ring has its own legend row with the
 * label, the value and the percent as text. */
(function () {
  "use strict";

  if (!window.GymWatch || !GymWatch.ui || !window.GymDom) return;
  var W = GymWatch, U = W.ui, h = GymDom.h;
  var s = U.s, R = U.R;

  U.add({
    wtToday: ["Today", "اليوم"],
    wtRefresh: ["Refresh watch data", "تحديث بيانات الساعة"],
    wtUpdating: ["Updating...", "جارٍ التحديث..."],
    wtKcal: ["Active kcal", "السعرات النشطة"],
    wtSleep: ["Sleep", "النوم"],
    wtSleepLast: ["Sleep last night", "نوم الليلة الماضية"],
    wtPct: ["{pct}% of {goal}", "{pct}% من {goal}"],
    wtPctKcal: ["{pct}% of {goal} kcal", "{pct}% من {goal} سعرة"],
    wtPctSleep: ["{pct}% of {goal} h", "{pct}% من {goal} ساعات"],
    wtGoalReached: ["Goal reached", "تم بلوغ الهدف"],
    wtAvgToday: ["Average today", "المتوسط اليوم"],
    wtLast7: ["Last 7 days", "آخر 7 أيام"],
    wtTabSteps: ["Steps", "الخطوات"],
    wtTabHr: ["Heart rate", "النبض"],
    wtTabList: ["Choose what the chart shows", "اختر ما يعرضه الرسم"],
    wtDays: ["Days of the week", "أيام الأسبوع"],
    wtGoalLine: ["Goal {n}", "الهدف {n}"],
    wtReadout: ["{day}: {value}", "{day}: {value}"],
    wtAvgSteps: ["Average {n} steps a day. Best day: {day}.", "المتوسط {n} خطوة في اليوم. أفضل يوم: {day}."],
    wtAvgKcal: ["Average {n} kcal a day. Best day: {day}.", "المتوسط {n} سعرة في اليوم. أفضل يوم: {day}."],
    wtAvgSleep: ["Average {n} a night. Best night: {day}.", "المتوسط {n} في الليلة. أفضل ليلة: {day}."],
    wtAvgHr: ["Average resting heart rate {n} bpm.", "متوسط نبض الراحة {n} نبضة/د."],
    wtTrained: ["Workout done", "تم التمرين"],
    wtTrainedRow: ["Days you finished a workout", "الأيام التي أنهيت فيها تمرينًا"],
    wtTabNoData: ["No {metric} data in the last 7 days", "لا توجد بيانات {metric} في آخر 7 أيام"],
    wtCaption: ["{metric}, last 7 days", "{metric}، آخر 7 أيام"],
    wtColDay: ["Day", "اليوم"],
    wtColValue: ["Value", "القيمة"],
    wtWebTitle: ["Watch data works in the Android app", "بيانات الساعة تعمل في تطبيق أندرويد"],
    wtWebBody: ["Health Connect, where your watch saves its data, is only on Android. Open Etqadem on your Android phone to connect.",
      "<span dir=\"ltr\">Health Connect</span> الذي تحفظ فيه ساعتك بياناتها متاح على أندرويد فقط. افتح اتقدم على هاتف أندرويد لتربطها."],
    wtOldTitle: ["Your phone can't share watch data", "هاتفك لا يدعم مشاركة بيانات الساعة"],
    wtOldBody: ["Watch data needs Android 9 or newer.", "بيانات الساعة تحتاج أندرويد 9 أو أحدث."],
    wtConnectTitle: ["Connect your watch", "اربط ساعتك"],
    wtConnectBody: ["Pick Connect to see your steps, sleep and heart rate here. It stays on your phone.",
      "اضغط «ربط» لتشوف خطواتك ونومك ونبضك هنا. وكل شيء يبقى على هاتفك."],
    wtWhy: ["Why we ask", "لماذا نطلب هذا"],
    wtPrivacyLine: ["Your watch data stays on this phone.", "تبقى بيانات ساعتك على هذا الهاتف."],
    wtDeniedTitle: ["Watch access was removed", "تم إلغاء إذن الساعة"],
    wtNew: ["new", "جديد"],
    wtDial: ["Today's steps, active calories and sleep", "خطوات اليوم والسعرات النشطة والنوم"]
  });

  var G = W.state().goals;
  var KEY_SEEN = U.keys.seen, KEY_METRIC = U.keys.metric;
  var ENTER_MS = 800, DELTA_MS = 600, ENTER_DELAY = 150, STAGGER_MS = 120;

  var screen = document.getElementById("screen-watch");
  var body = document.getElementById("watchBody");
  if (!screen || !body) return;

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsPut(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function calm() { return !!(window.GymMotion && GymMotion.reduced()); }
  function ltr(x) { return "<span dir=\"ltr\">" + x + "</span>"; }
  function locale() { return U.li() ? "ar-EG-u-nu-latn" : "en-US"; }
  function dayName(key, style) {
    var p = key.split("-");
    try { return new Intl.DateTimeFormat(locale(), { weekday: style }).format(new Date(+p[0], +p[1] - 1, +p[2])); }
    catch (e) { return key; }
  }

  // ---------------- nav dot: new until the tab is first opened ----------------
  function syncDot() {
    var b = document.querySelector('#appNav button[data-tab="watch"]');
    if (!b) return;
    var dot = b.querySelector(".nav-dot"), sr = b.querySelector(".wt-new-sr");
    if (ls(KEY_SEEN) === "1") { if (dot) dot.remove(); if (sr) sr.remove(); return; }
    if (!dot) b.appendChild(h("span", { class: "nav-dot", "aria-hidden": "true" }));
    if (!sr) { sr = h("span", { class: "sr-only wt-new-sr" }); b.appendChild(sr); }
    sr.textContent = " (" + s("wtNew") + ")";
  }

  // ---------------- metrics shown in the chart ----------------
  function metrics() {
    return [
      { id: "steps", col: "steps", perm: "steps", tab: "wtTabSteps", goal: G.steps, bar: true, avg: "wtAvgSteps" },
      { id: "kcal", col: "kcal", perm: "calories", tab: "wtKcal", goal: G.kcal, bar: true, avg: "wtAvgKcal" },
      { id: "sleep", col: "sleepMin", perm: "sleep", tab: "wtSleep", goal: G.sleepMin, bar: true, avg: "wtAvgSleep" },
      { id: "hr", col: "rhr", perm: "restingHeartRate", tab: "wtTabHr", goal: null, bar: false, avg: "wtAvgHr" }
    ];
  }
  function fmtVal(m, n) {
    if (n == null) return s("cellNoData");
    if (m.id === "steps") return s("planSteps", { n: U.fmtInt(n) });
    if (m.id === "kcal") return s("planKcal", { n: U.fmtInt(n) });
    if (m.id === "sleep") return U.fmtSleep(n);
    return U.fmtInt(n) + " " + s("bpm");
  }
  function goalText(m) { return m.id === "sleep" ? "8 " + s("hr") : U.fmtInt(m.goal); }

  // ---------------- animation: one rAF loop for the dial ----------------
  // shown/ring remember what is on screen, so a rebuild or a refresh animates
  // only the difference; a first value enters from 0.
  var anim = { shown: {}, ring: {}, epoch: 0, hit: {} };
  function forget() { anim.shown = {}; anim.ring = {}; drawnMetric = ""; }
  function ease(p) { return 1 - Math.pow(1 - p, 4); }
  function run(tasks) {
    var ep = anim.epoch;
    if (!tasks.length) return;
    var t0 = performance.now();
    (function frame() {
      if (ep !== anim.epoch) return;
      var now = performance.now(), left = 0;
      tasks.forEach(function (k) {
        var p = Math.min(1, Math.max(0, (now - t0 - k.delay) / k.dur));
        if (p < 1) left++;
        var e = ease(p);
        k.paint(Math.round(k.from + (k.to - k.from) * e), k.rFrom + (k.rTo - k.rFrom) * e);
      });
      if (left) requestAnimationFrame(frame);
    })();
  }

  // ---------------- idle life (heartbeat, moon): only while it can be seen ----------------
  var live = { io: null, inView: true };
  function syncLive() { body.classList.toggle("wt-live", !calm() && !document.hidden && live.inView && !screen.hidden); }
  if (typeof IntersectionObserver === "function") {
    live.io = new IntersectionObserver(function (es) { live.inView = es[es.length - 1].isIntersecting; syncLive(); });
    live.io.observe(body);
  }

  // ---------------- small builders ----------------
  var svgEl = U.svgEl;

  function dialSvg() {
    var svg = svgEl("svg", { class: "wt-dial-svg", viewBox: "0 0 168 168", "aria-hidden": "true", focusable: "false" });
    var arcs = {};
    [["steps", 72], ["kcal", 58], ["sleep", 44]].forEach(function (r) {
      svg.appendChild(svgEl("circle", { class: "wt-trk", cx: 84, cy: 84, r: r[1] }));
    });
    [["steps", 72], ["kcal", 58], ["sleep", 44]].forEach(function (r) {
      var a = svgEl("circle", { class: "wt-arc wt-arc-" + r[0], cx: 84, cy: 84, r: r[1], pathLength: 100, "stroke-dasharray": 100, "stroke-dashoffset": 100 });
      svg.appendChild(a);
      arcs[r[0]] = a;
    });
    svg.appendChild(svgEl("line", { class: "wt-tick", x1: 84, y1: 2, x2: 84, y2: 12 }));
    return { svg: svg, arcs: arcs };
  }

  function card(cls, id, kids) { return h("section", { class: "wt-card " + cls, id: id || null }, kids); }

  function ghost(pulse) {
    var d = dialSvg();
    return h("div", { class: "wt-dial wt-ghost" + (pulse ? " wt-skel" : ""), "aria-hidden": "true" }, d.svg);
  }

  function infoCard(id, title, bodyKey, actions, withDial) {
    return card("wt-info", id, [
      withDial ? ghost(false) : null,
      h("h2", { class: "wt-title wt-info-t" }, R(title)),
      h("p", { class: "wt-text wt-info-p" }, R(bodyKey)),
      actions && actions.length ? h("div", { class: "wt-actions wt-actions-c" }, actions) : null
    ]);
  }

  // ---------------- today: dial + legend ----------------
  function putNum(node, txt, units) {
    node.textContent = "";
    if (!units) { node.textContent = txt; return; }
    txt.split(/(\d+)/).forEach(function (part) {
      if (part) node.appendChild(/\d/.test(part) ? document.createTextNode(part) : h("span", { class: "wt-unit wt-unit-in" }, part));
    });
  }

  function todayCard(st, tasks) {
    var v = st.vals;
    var off = function (t) { return st.denied.indexOf(t) >= 0; };
    var defs = [
      { key: "steps", label: s("stepsLbl"), n: v.steps, goal: G.steps, off: off("steps"), fmt: U.fmtInt, unit: "", pct: "wtPct", gt: U.fmtInt(G.steps) },
      { key: "kcal", label: s("wtKcal"), n: v.kcal, goal: G.kcal, off: off("calories"), fmt: U.fmtInt, unit: "kcal", pct: "wtPctKcal", gt: U.fmtInt(G.kcal) },
      { key: "sleep", label: s("wtSleepLast"), n: v.sleepMin, goal: G.sleepMin, off: off("sleep"), fmt: U.fmtSleep, units: true, pct: "wtPctSleep", gt: "8" }
    ];
    var d = dialSvg();
    var centerN = h("span", { class: "wt-c-n", "aria-hidden": "true" });
    var quiet = calm();
    var labelParts = [];
    var rows = defs.map(function (o, idx) {
      var empty = o.n == null || o.off;
      var to = empty ? null : o.n;
      var first = anim.shown[o.key] == null;
      var from = empty || quiet ? to : (first ? 0 : anim.shown[o.key]);
      var rTo = empty ? null : Math.min(to / o.goal, 1);
      var rFrom = empty || quiet ? rTo : (first ? 0 : anim.ring[o.key]);
      var pctText = function (x) { return s(o.pct, { pct: Math.round(x / o.goal * 100), goal: o.gt }); };
      var numEl = h("span", { class: "wt-n", "aria-hidden": "true" });
      var subEl = h("span", { class: "wt-leg-s", "aria-hidden": "true" });
      var finalNum = empty ? (o.off ? s("cellOff") : s("cellNoData")) : o.fmt(to);
      var finalSub = empty ? (o.off ? s("cellOff") : s("cellNoData")) : pctText(to);
      if (empty) { numEl.textContent = "—"; subEl.textContent = finalSub; }
      else { putNum(numEl, o.fmt(from), o.units); subEl.textContent = pctText(from); d.arcs[o.key].setAttribute("stroke-dashoffset", 100 - 100 * rFrom); }
      var hit = !empty && to >= o.goal;
      var chip = null;
      if (hit) {
        var dayTag = o.key + GymDate.key();
        chip = h("span", { class: "wt-chip" + (anim.hit[dayTag] || quiet ? "" : " wt-chip-in") }, s("wtGoalReached"));
        anim.hit[dayTag] = 1;
      }
      labelParts.push(o.label + ": " + (empty ? finalNum : finalNum + (o.unit ? " " + o.unit : "")) + (empty ? "" : ", " + finalSub));
      var row = h("li", { class: "wt-leg" + (empty ? " is-empty" : ""), "data-key": o.key },
        h("span", { class: "wt-sw wt-sw-" + o.key, "aria-hidden": "true" }),
        h("span", { class: "wt-leg-main" },
          h("span", { class: "wt-leg-l" }, o.label),
          subEl, chip,
          empty ? null : h("span", { class: "sr-only" }, finalSub)),
        h("span", { class: "wt-leg-v" },
          numEl, empty || !o.unit ? null : h("span", { class: "wt-unit", "aria-hidden": "true" }, o.unit),
          h("span", { class: "sr-only" }, empty ? finalNum : finalNum + (o.unit ? " " + o.unit : ""))));
      if (o.key === "steps") {
        centerN.textContent = empty ? "—" : U.fmtInt(from);
        if (!empty && U.fmtInt(to).length > 5) centerN.classList.add("wt-c-sm");
      }
      if (empty) { delete anim.shown[o.key]; delete anim.ring[o.key]; return row; }
      anim.shown[o.key] = from; anim.ring[o.key] = rFrom;
      if (from !== to || rFrom !== rTo) {
        tasks.push({
          from: from, to: to, rFrom: rFrom, rTo: rTo,
          delay: first ? ENTER_DELAY + idx * STAGGER_MS : 0, dur: first ? ENTER_MS : DELTA_MS,
          paint: function (x, r) {
            anim.shown[o.key] = x; anim.ring[o.key] = r;
            putNum(numEl, o.fmt(x), o.units);
            subEl.textContent = pctText(x);
            d.arcs[o.key].setAttribute("stroke-dashoffset", 100 - 100 * r);
            if (o.key === "steps") centerN.textContent = U.fmtInt(x);
          }
        });
      }
      return row;
    });
    var dial = h("div", { class: "wt-dial", id: "wtDial", role: "img", "aria-label": labelParts.join(". ") + "." },
      d.svg,
      h("div", { class: "wt-center", "aria-hidden": "true" }, centerN, h("span", { class: "wt-c-l" }, s("stepsLbl"))));
    return card("wt-today", "wtToday", [dial, h("ul", { class: "wt-legend" }, rows)]);
  }

  function hrCards(st) {
    var v = st.vals, off = function (t) { return st.denied.indexOf(t) >= 0; };
    var item = function (key, label, n, isOff) {
      var empty = n == null || isOff;
      return h("div", { class: "wt-stat wt-heart" + (empty ? " is-empty" : ""), "data-key": key },
        h("span", { class: "wt-stat-l" }, U.icon("heart"), label),
        h("span", { class: "wt-stat-v" }, empty ? "—" : h("span", { class: "wt-n" }, String(n)),
          empty ? null : h("span", { class: "wt-unit" }, s("bpm"))),
        empty ? h("span", { class: "wt-leg-s" }, isOff ? s("cellOff") : s("cellNoData")) : null);
    };
    var beat = v.avgHr || v.rhr;
    var grid = h("div", { class: "wt-stats" },
      item("rhr", s("restHrLbl"), v.rhr, off("restingHeartRate")),
      item("avgHr", s("wtAvgToday"), v.avgHr, off("heartRate")));
    if (beat) grid.style.setProperty("--wt-beat", Math.min(1.4, Math.max(.5, 60 / beat)).toFixed(2) + "s");
    return [grid, v.rhr != null || v.avgHr != null ? h("p", { class: "wt-foot" }, R("hrNote")) : null];
  }

  // ---------------- last 7 days ----------------
  var metricId = ls(KEY_METRIC) || "steps";
  var sel = 6;                 // selected day index (0 = oldest, 6 = today)
  var drawnMetric = "";        // the metric whose bars/line already played their entrance
  var chartHost = null, tabsHost = null;

  function colHasData(st, m) {
    return st.denied.indexOf(m.perm) < 0 && !!st.week && st.week.some(function (d) { return d[m.col] != null; });
  }
  function currentMetric(st) {
    var all = metrics();
    var m = all.filter(function (x) { return x.id === metricId; })[0] || all[0];
    if (!colHasData(st, m)) { var alt = all.filter(function (x) { return colHasData(st, x); })[0]; if (alt) m = alt; }
    return m;
  }

  function trainedFlags(week) {
    var cal = window.GymCalendar;
    if (!cal || !cal.localEntry) return null;
    return week.map(function (d) { var e = cal.localEntry(d.d); return !!(e && e.complete); });
  }

  function readoutText(m, week, i) {
    var day = i === week.length - 1 ? s("wtToday") : dayName(week[i].d, "long");
    return s("wtReadout", { day: day, value: fmtVal(m, week[i][m.col]) });
  }

  function chartBody(st, m, animate) {
    var week = st.week, n = week.length;
    var vals = week.map(function (d) { return d[m.col]; });
    var present = vals.filter(function (x) { return x != null; });
    var rtl = U.li() === 1;
    var readout = h("p", { class: "wt-readout", id: "wtReadout", "aria-live": "polite" }, readoutText(m, week, sel));
    var plot = h("div", { class: "wt-plot" });
    var hits = [];
    var flags = trainedFlags(week);

    if (m.bar) {
      var top = Math.max(m.goal, Math.max.apply(null, present)) || 1;
      var goalPct = m.goal / top * 100;
      plot.appendChild(h("div", { class: "wt-goal", style: "bottom:" + goalPct.toFixed(1) + "%" },
        h("span", { class: "wt-goal-l" }, s("wtGoalLine", { n: goalText(m) }))));
      var bars = h("div", { class: "wt-bars" }, week.map(function (d, i) {
        var x = vals[i];
        return h("span", { class: "wt-col" }, x == null ? h("span", { class: "wt-gap" }) :
          h("span", { class: "wt-bar" + (i === n - 1 ? " is-today" : "") + (animate ? " wt-grow" : ""), style: "height:" + Math.max(2, x / top * 100).toFixed(1) + "%;--i:" + i }));
      }));
      plot.appendChild(bars);
    } else {
      var lo = Math.min.apply(null, present) - 3, hi = Math.max.apply(null, present) + 3;
      var span = Math.max(1, hi - lo);
      var pos = vals.map(function (x, i) {
        return x == null ? null : { i: i, xp: ((rtl ? n - 1 - i : i) + .5) / n * 100, yp: (x - lo) / span * 100 };
      });
      var d = "", pen = false;
      pos.forEach(function (p) {
        if (!p) { pen = false; return; }
        d += (pen ? " L" : " M") + (p.xp * 7).toFixed(1) + " " + (100 - p.yp).toFixed(1);
        pen = true;
      });
      var line = svgEl("svg", { class: "wt-line", viewBox: "0 0 700 100", preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" });
      line.appendChild(svgEl("path", { class: "wt-line-p" + (animate ? " wt-draw" : ""), d: d.trim(), pathLength: 1 }));
      plot.appendChild(line);
      pos.forEach(function (p, i) {
        var xp = (i + .5) / n * 100;           // inset-inline-start already mirrors in RTL
        if (!p) {
          plot.appendChild(h("span", { class: "wt-dot wt-dot-gap", style: "inset-inline-start:" + xp.toFixed(2) + "%;bottom:0" }));
          return;
        }
        plot.appendChild(h("span", { class: "wt-dot" + (i === n - 1 ? " is-today" : "") + (animate ? " wt-pop" : ""), style: "inset-inline-start:" + xp.toFixed(2) + "%;bottom:" + p.yp.toFixed(1) + "%;--i:" + i }));
      });
    }

    var labels = h("div", { class: "wt-days", "aria-hidden": "true" }, week.map(function (d, i) {
      return h("span", { class: "wt-dl" + (i === n - 1 ? " is-today" : "") }, dayName(d.d, "short"));
    }));
    var hitRow = h("div", { class: "wt-hits", role: "group", "aria-label": s("wtDays") }, week.map(function (d, i) {
      var b = h("button", {
        type: "button", class: "wt-hit" + (i === sel ? " is-sel" : ""), tabindex: i === sel ? "0" : "-1", "aria-pressed": i === sel ? "true" : "false",
        "aria-label": readoutText(m, week, i), "data-fid": "hit" + i
      });
      hits.push(b);
      return b;
    }));
    function pick(i, focus) {
      sel = Math.max(0, Math.min(n - 1, i));
      hits.forEach(function (b, k) {
        b.classList.toggle("is-sel", k === sel);
        b.setAttribute("aria-pressed", k === sel ? "true" : "false");
        b.tabIndex = k === sel ? 0 : -1;
      });
      chart.querySelectorAll(".wt-col").forEach(function (c, k) { c.classList.toggle("is-sel", k === sel); });
      chart.querySelectorAll(".wt-dot").forEach(function (c, k) { c.classList.toggle("is-sel", k === sel); });
      readout.textContent = readoutText(m, week, sel);
      if (focus) hits[sel].focus();
    }
    hits.forEach(function (b, i) {
      b.addEventListener("click", function () { pick(i, false); });
      b.addEventListener("keydown", function (e) {
        var step = e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
        if (e.key === "Home") { e.preventDefault(); pick(0, true); }
        else if (e.key === "End") { e.preventDefault(); pick(n - 1, true); }
        else if (step) { e.preventDefault(); pick(i + step, true); }
      });
    });
    var chart = h("div", { class: "wt-chart" + (m.bar ? "" : " is-line") }, plot, labels, hitRow);
    var cols = chart.querySelectorAll(".wt-col");
    if (cols[sel]) cols[sel].classList.add("is-sel");
    var dots = chart.querySelectorAll(".wt-dot");
    if (dots[sel]) dots[sel].classList.add("is-sel");

    // the same numbers as a table for screen readers (the drawing is aria-hidden)
    var table = h("table", { class: "sr-only" },
      h("caption", {}, s("wtCaption", { metric: s(m.tab) })),
      h("thead", {}, h("tr", {}, h("th", {}, s("wtColDay")), h("th", {}, s("wtColValue")), flags ? h("th", {}, s("wtTrained")) : null)),
      h("tbody", {}, week.map(function (d, i) {
        return h("tr", {}, h("td", {}, dayName(d.d, "long")), h("td", {}, fmtVal(m, vals[i])), flags ? h("td", {}, flags[i] ? s("wtTrained") : "") : null);
      })));

    var kids = [readout, chart];
    if (flags) {
      kids.push(h("button", { type: "button", class: "wt-trained", id: "wtTrained", "aria-label": s("wtTrainedRow") + ": " + week.map(function (d, i) { return flags[i] ? dayName(d.d, "long") : null; }).filter(Boolean).join(", "),
        on: { click: function () { if (window.GymUI) GymUI.navigate("plan"); } } },
      week.map(function (d, i) { return h("span", { class: "wt-tdot" + (flags[i] ? " is-on" : ""), title: flags[i] ? s("wtTrained") : null }); })));
    }
    if (present.length) {
      var avg = present.reduce(function (a, b) { return a + b; }, 0) / present.length;
      var best = m.bar ? vals.indexOf(Math.max.apply(null, present)) : -1;
      var fmtAvg = m.id === "sleep" ? U.fmtSleep(avg) : U.fmtInt(avg);
      kids.push(h("p", { class: "wt-sum" }, R(m.avg, { n: ltr(fmtAvg), day: best >= 0 ? (best === n - 1 ? s("wtToday") : dayName(week[best].d, "long")) : "" })));
    }
    kids.push(table);
    return kids;
  }

  function trendCard(st) {
    var all = metrics();
    var m = currentMetric(st);
    metricId = m.id;
    var week = st.week || [];
    // the chart grows in once per metric, not on every refresh or revisit
    var animate = !calm() && drawnMetric !== m.id && !!week.length;
    drawnMetric = m.id;

    var tabs = h("div", { class: "wt-mtabs", id: "wtMetricTabs", role: "tablist", "aria-label": s("wtTabList") }, all.map(function (x) {
      var on = x.id === m.id, ok = colHasData(st, x);
      return h("button", {
        type: "button", class: "wt-mtab" + (on ? " is-on" : ""), role: "tab", id: "wtTab-" + x.id, "aria-selected": on ? "true" : "false",
        "aria-controls": "wtPanel", tabindex: on ? "0" : "-1", "aria-disabled": ok ? null : "true", "data-fid": "tab-" + x.id,
        on: { click: function () { choose(x, ok); } }
      }, s(x.tab));
    }));
    function choose(x, ok) {
      if (!ok) {
        var r = body.querySelector("#wtReadout");
        if (r) r.textContent = s("wtTabNoData", { metric: s(x.tab) });
        return;
      }
      metricId = x.id; sel = 6; lsPut(KEY_METRIC, x.id);
      render(true, "tab-" + x.id);
    }
    tabs.addEventListener("keydown", function (e) {
      var k = e.key === "ArrowRight" ? (U.li() ? -1 : 1) : e.key === "ArrowLeft" ? (U.li() ? 1 : -1) : 0;
      if (!k) return;
      e.preventDefault();
      var i = all.indexOf(all.filter(function (x) { return x.id === m.id; })[0]);
      for (var t = 1; t <= all.length; t++) {
        var nx = all[(i + k * t + all.length * 2) % all.length];
        if (colHasData(st, nx)) { choose(nx, true); return; }
      }
    });

    var panel = h("div", { class: "wt-panel-chart", id: "wtPanel", role: "tabpanel", "aria-labelledby": "wtTab-" + m.id });
    if (week.length && colHasData(st, m)) chartBody(st, m, animate).forEach(function (k) { panel.appendChild(k); });
    else panel.appendChild(h("p", { class: "wt-readout", id: "wtReadout", "aria-live": "polite" }, s("wtTabNoData", { metric: s(m.tab) })));
    return card("wt-trend m-" + m.id, "wtTrend", [h("h2", { class: "wt-title" }, R("wtLast7")), tabs, panel]);
  }

  function footer(st) {
    return h("section", { class: "wt-priv", id: "wtPrivacy" },
      h("p", { class: "wt-foot" }, R("discNote")),
      h("p", { class: "wt-foot wt-lock" }, R("wtPrivacyLine")),
      h("div", { class: "wt-actions" },
        U.btn(s("rowManage"), "wt-btn-line", W.manage, "wtOpenHc"),
        U.btn(s("rowDisconnect"), "wt-btn-quiet wt-btn-danger", W.disconnect, "wtDisc")));
  }

  // ---------------- screen states ----------------
  var notice = "";            // "none": the permission screen was declined (inline note)
  var updating = false;

  function connectCard(st) {
    var connectBtn = U.btn(s("rowConnect"), "wt-btn-primary", function () {
      connectBtn.disabled = true;
      W.connect().then(function (r) { notice = r === "none" ? "none" : ""; render(true); });
    }, "wtConnect");
    if (st.connecting) connectBtn.disabled = true;
    return card("wt-info wt-connect", "wtConnectCard", [
      ghost(false),
      h("h2", { class: "wt-title wt-info-t" }, R("wtConnectTitle")),
      h("p", { class: "wt-text wt-info-p" }, R("wtConnectBody")),
      notice === "none" ? h("p", { class: "wt-text wt-note", role: "status" }, R("notGranted")) : null,
      h("div", { class: "wt-actions wt-actions-c" }, connectBtn, GymDom.policyLink(U.li() ? "ar-health-connect" : "health-connect", s("wtWhy"), true))
    ]);
  }

  function headRow(st) {
    var meta = updating || st.status === "loading" ? s("wtUpdating") : (st.at && st.status !== "denied" ? s("updated", { time: U.fmtTime(st.at) }) : "");
    var btn = h("button", { type: "button", class: "wt-refresh" + (updating ? " is-busy" : ""), id: "wtRefresh", "aria-label": s("wtRefresh"), "data-fid": "refresh", on: { click: function () {
      if (updating) return;
      updating = true; render(true, "refresh");
      W.refresh().then(function () { updating = false; render(true, "refresh"); }, function () { updating = false; render(true, "refresh"); });
    } } }, refreshIcon());
    return h("div", { class: "wt-head" },
      h("h2", { class: "wt-title" }, R("wtToday")),
      h("span", { class: "wt-meta", role: "status", "aria-live": "polite" }, meta), btn);
  }
  function refreshIcon() {
    var svg = svgEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", class: "wt-ic" });
    svg.appendChild(svgEl("path", { d: "M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" }));
    return svg;
  }

  var lastSig = "";
  function build(st) {
    var tasks = [];
    var kids = [];
    if (!st.plugin) { forget(); kids.push(infoCard("wtWebCard", "wtWebTitle", "wtWebBody", null, true)); return { kids: kids, tasks: tasks }; }
    if (st.avail === null) { forget(); kids.push(card("wt-info", "wtWait", [ghost(true)])); return { kids: kids, tasks: tasks, busy: true }; }
    if (st.avail === "none") { forget(); kids.push(infoCard("wtOldCard", "wtOldTitle", "wtOldBody", null, true)); return { kids: kids, tasks: tasks }; }
    if (st.avail === "install") {
      forget();
      kids.push(infoCard("wtInstallCard", "installHC", "installHCBody", [
        h("a", { class: "wt-btn wt-btn-primary wt-a", id: "wtInstallGo", href: U.playUrl, target: "_blank", rel: "noopener" }, R("installGo")),
        U.btn(s("checkAgain"), "wt-btn-line", function () { W.recheck(); }, "wtRecheck")
      ], true));
      return { kids: kids, tasks: tasks };
    }
    if (!st.on) { forget(); kids.push(connectCard(st)); return { kids: kids, tasks: tasks }; }

    var status = st.status;
    var anyToday = st.vals.steps != null || st.vals.kcal != null || st.vals.sleepMin != null || st.vals.rhr != null || st.vals.avgHr != null;
    if (status === "denied") {
      forget();
      kids.push(infoCard("wtDeniedCard", "wtDeniedTitle", "accessRemoved", [
        U.btn(s("rowConnect"), "wt-btn-primary", function () { W.connect(); }, "wtReconnect"),
        U.btn(s("openSettings"), "wt-btn-line", W.manage, "wtOpenHc")
      ], true));
      return { kids: kids, tasks: tasks };
    }
    if ((status === "loading" || status == null) && !st.at && !anyToday) {
      forget();
      kids.push(headRow(st), card("wt-info", "wtSkel", [ghost(true), h("p", { class: "wt-text wt-info-p" }, s("loading"))]));
      return { kids: kids, tasks: tasks, busy: true };
    }
    if (status === "empty") {
      forget();
      kids.push(headRow(st), card("wt-info", "wtEmptyCard", [ghost(false),
        h("p", { class: "wt-text wt-info-p" }, R("noData")),
        h("div", { class: "wt-actions wt-actions-c" }, U.btn(s("checkAgain"), "wt-btn-line", function () { W.refresh(); }, "wtAgain"))]));
      kids.push(footer(st));
      return { kids: kids, tasks: tasks };
    }
    kids.push(headRow(st), todayCard(st, tasks));
    hrCards(st).forEach(function (k) { if (k) kids.push(k); });
    if (status === "error") kids.push(h("div", { class: "wt-note-card" }, h("p", { class: "wt-text" }, R("readError")),
      h("div", { class: "wt-actions" }, U.btn(s("tryAgain"), "wt-btn-line", function () { W.refresh(); }, "wtRetry"))));
    else if (status === "partial") kids.push(h("div", { class: "wt-note-card" }, h("p", { class: "wt-text" }, R("partial")),
      h("div", { class: "wt-actions" }, U.btn(s("rowManage"), "wt-btn-line", W.manage, "wtManage"))));
    kids.push(trendCard(st), footer(st));
    return { kids: kids, tasks: tasks, dim: status === "error" };
  }

  function render(force, refocus) {
    if (screen.hidden) return;
    var st = W.state();
    var sig = JSON.stringify([st, U.li(), calm(), updating, notice, metricId, sel, ls(KEY_SEEN)]);
    if (!force && sig === lastSig) return;
    lastSig = sig;
    anim.epoch++;
    var had = document.activeElement && body.contains(document.activeElement) ? document.activeElement.getAttribute("data-fid") : null;
    var out = build(st);
    body.textContent = "";
    out.kids.forEach(function (k) { body.appendChild(k); });
    body.setAttribute("aria-busy", out.busy ? "true" : "false");
    body.classList.toggle("is-dim", !!out.dim);
    var want = refocus || had;
    if (want) { var f = body.querySelector('[data-fid="' + want + '"]'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }
    run(out.tasks);
    syncLive();
  }

  // ---------------- wiring ----------------
  function onShow() {
    lsPut(KEY_SEEN, "1");
    syncDot();
    lastSig = "";
    render(true);
    syncLive();
  }
  try {
    new MutationObserver(function () { if (!screen.hidden) onShow(); else { anim.epoch++; syncLive(); } })
      .observe(screen, { attributes: true, attributeFilter: ["hidden"] });
    new MutationObserver(function () { lastSig = ""; render(false); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion"] });
    var mq = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq && mq.addEventListener) mq.addEventListener("change", function () { render(false); });
  } catch (e) {}
  document.addEventListener("visibilitychange", syncLive);
  W.onChange(function () { syncDot(); render(false); });
  document.addEventListener("gym:authchange", function () { syncDot(); });
  syncDot();
  if (!screen.hidden) onShow();
})();
