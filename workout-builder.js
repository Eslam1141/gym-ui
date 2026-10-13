/* workout-builder.js — the "Build Your Own Plan" screen.
 *
 * Reads the `shape`, `shape2` and `tier` tags on every exercise across
 * DAYS_PREVIEW, DAYS_MALE, DAYS_FEMALE, DAYS_MALE_CAL and DAYS_FEMALE_CAL
 * (top-level `const`s declared in app.js, which loads first and non-deferred)
 * plus the MUSCLE_SHAPES catalog, and lets the user tap (or, on desktop,
 * drag) exercises into days while enforcing one exercise per muscle "shape"
 * PER DAY (canPlace()/shapesUsedForDay() — the same shape may appear on
 * different days, just not twice on the same day).
 *
 * The "easy" tier is a difficulty marker, not a "recommended" flag — it
 * means "an easier alternate exercise for this muscle area". Rows carry a
 * text "Easy" badge and the palette has an "Easy only" filter chip, so the
 * meaning isn't just implied by color (getEasyOnly()).
 *
 * Layout (docs/design/custom-plan-builder/spec.md): day tabs + a sticky day
 * tray with a "Review" sheet on phones; a sticky day panel (the drop target)
 * beside the palette from 1024px. Tap a row to add it, tap its check to
 * remove it (with Undo). A blocked row stays readable and says why.
 *
 * Renders into #coachBody — the same mount point coach.js's own screen
 * uses. coach.js's Coach screen calls GymWorkoutBuilder.open() and defines
 * window.GymWorkoutBuilderSave (called from this screen's Save button).
 * Loads after app.js and dom.js. No external deps.
 *
 * i18n/DOM helpers: h(), lang() and s() come from dom.js (window.GymDom);
 * this module keeps its own STR table.
 *
 * Public API: window.GymWorkoutBuilder = { open, exportAsWorkoutPlan }.
 * exportAsWorkoutPlan() -> { split: "Custom", days: [{day, exercises:
 * [{name, sets, reps, restSec}]}] } — the exact shape coach.js's
 * renderWorkout()/mapWorkout() already consume. Empty days are skipped.
 */
(function () {
  "use strict";

  // ---------------- i18n (same local pattern as coach.js/calendar.js) ----------------
  if (!window.GymDom) throw new Error("workout-builder.js: dom.js must load first");
  var h = GymDom.h, lang = GymDom.lang;
  var STR = {
    wbTitle: ["Build your plan", "ابنِ خطتك"],
    wbBack: ["Back", "رجوع"],
    wbEasy: ["Easy", "سهل"],
    wbNoExercisesYet: ["No exercises yet for this area", "لا توجد تمارين لهذه المنطقة بعد"],
    wbAddDay: ["Add day", "أضف يوم"],
    wbDayN: ["Day {n}", "اليوم {n}"],
    wbDayName: ["Day name", "اسم اليوم"],
    wbRemoveDay: ["Remove day", "إزالة اليوم"],
    wbRemove: ["Remove {name}", "إزالة {name}"],
    wbAdd: ["Add {name}", "إضافة {name}"],
    wbEmptyH: ["Add your first exercise", "أضف أول تمرين"],
    wbEmptyB: ["Tap + on any exercise below. It goes into the day you have selected.", "اضغط + على أي تمرين بالأسفل. يُضاف إلى اليوم المحدد."],
    wbSearch: ["Search exercises", "ابحث عن تمرين"],
    wbExercises: ["Exercises", "التمارين"],
    wbFilterAll: ["All", "الكل"],
    wbFilterEasyOnly: ["Easy only", "السهل فقط"],
    wbFilters: ["Filter exercises", "تصفية التمارين"],
    wbDropRejected: ["{area} is already in {day} ({name}). Remove it first, or add this on another day.", "{area} موجودة بالفعل في {day} ({name}). أزلها أولًا أو أضف هذا في يوم آخر."],
    wbRule: ["One exercise per muscle area each day. Different days can repeat an area.", "تمرين واحد لكل منطقة عضلية في اليوم. يمكن تكرار المنطقة في يوم آخر."],
    wbAreaUsed: ["{area} used", "{area} مستخدمة"],
    wbAddingTo: ["Adding to: {day}", "الإضافة إلى: {day}"],
    wbReview: ["Review", "مراجعة"],
    wbReviewTitle: ["Review {day}", "مراجعة {day}"],
    wbClose: ["Close", "إغلاق"],
    wbRemoved: ["Removed {name}", "تمت إزالة {name}"],
    wbUndo: ["Undo", "تراجع"],
    wbAnnounceAdded: ["Added {name} to {day}. {n}.", "أُضيف {name} إلى {day}. {n}."],
    wbAnnounceRemoved: ["Removed {name}. Undo available.", "تمت إزالة {name}. التراجع متاح."],
    wbSave: ["Save plan", "حفظ الخطة"],
    wbSaveHelp: ["Add at least one exercise to save", "أضف تمرينًا واحدًا على الأقل للحفظ"],
    wbSaveFull: ["Your 3 plan slots are full. Delete a plan in My plans to save this one.", "خانات الخطط الثلاث ممتلئة. احذف خطة من «خططي» لحفظ هذه."],
    wbOpenMyPlans: ["Open My plans", "افتح خططي"],
    wbNoEasy: ["No easy option for this area.", "لا يوجد خيار سهل لهذه المنطقة."],
    wbShowAll: ["Show all", "اعرض الكل"],
    wbNoResults: ["No exercise matches “{q}”.", "لا يوجد تمرين مطابق لـ “{q}”."],
    wbClearSearch: ["Clear search", "امسح البحث"],
    wbSkipped: ["{name} is empty and will be skipped.", "{name} فارغ وسيتم تخطيه."],
    wbWatch: ["Watch how: {name}", "شاهد الطريقة: {name}"],
    wbExerciseOne: ["exercise", "تمرين"],
    wbExerciseFew: ["exercises", "تمارين"],
    wbExerciseMany: ["exercises", "تمرين"],
    wbDayOne: ["day", "يوم"],
    wbDayMany: ["days", "أيام"]
  };
  var s = GymDom.makeT(STR);
  function fmt(key, vars) {
    return s(key).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }
  function exercisesWord(n) {
    if (n === 1) return s("wbExerciseOne");
    return n >= 2 && n <= 10 ? s("wbExerciseFew") : s("wbExerciseMany");
  }
  function exercisesLabel(n) { return n + " " + exercisesWord(n); }
  function daysLabel(n) { return n + " " + (n === 1 ? s("wbDayOne") : s("wbDayMany")); }

  // ---------------- exercise index, deduplicated by name ----------------
  // One entry per unique exercise (by `en` name) — the same exercise appears
  // under multiple ids/day-variants across the 5 day arrays, each tagged
  // identically, so dedupe by `en`.
  function buildExerciseIndex() {
    var byName = {};
    var order = [];
    [DAYS_PREVIEW, DAYS_MALE, DAYS_FEMALE, DAYS_MALE_CAL, DAYS_FEMALE_CAL].forEach(function (set) {
      set.forEach(function (day) {
        day.exercises.forEach(function (ex) {
          if (byName[ex.en]) return;
          byName[ex.en] = ex;
          order.push(ex.en);
        });
      });
    });
    return order.map(function (name) { return byName[name]; });
  }

  var EXERCISES = buildExerciseIndex();
  var SHAPE_BY_ID = {};
  var GROUPS = []; // [{ name, label, labelAr, shapes: [shape] }] in catalog order
  MUSCLE_SHAPES.forEach(function (shape) {
    SHAPE_BY_ID[shape.id] = shape;
    var g = GROUPS.filter(function (x) { return x.name === shape.group; })[0];
    if (!g) { g = { name: shape.group, labelAr: shape.groupAr, shapes: [] }; GROUPS.push(g); }
    g.shapes.push(shape);
  });
  function groupLabel(g) { return lang() === "ar" ? g.labelAr : g.name; }
  function shapeLabel(shape) { return lang() === "ar" ? shape.labelAr : shape.label; }
  function groupOfShape(id) {
    var shape = SHAPE_BY_ID[id];
    return shape ? GROUPS.filter(function (g) { return g.name === shape.group; })[0] : null;
  }

  // One entry per exercise under its primary shape. A dual-shape exercise
  // (shape2) shows both areas on its second line but is listed once.
  function exercisesForShape(shapeId, easyOnly) {
    return EXERCISES.filter(function (e) {
      if (e.shape !== shapeId) return false;
      if (easyOnly && e.tier !== "easy") return false;
      return true;
    });
  }

  // ---------------- easy-only filter (persisted; palette display only, doesn't affect placement rules) ----------------
  var EASY_FILTER_KEY = "gym_wb_easy_only";
  function getEasyOnly() {
    try { return localStorage.getItem(EASY_FILTER_KEY) === "1"; } catch (e) { return false; }
  }
  function setEasyOnly(v) {
    try { localStorage.setItem(EASY_FILTER_KEY, v ? "1" : "0"); } catch (e) {}
  }

  // ---------------- search (diacritic- and alef-insensitive) ----------------
  function norm(str) {
    return String(str || "").toLowerCase()
      .replace(/[ً-ٰٟـ]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .trim();
  }
  function areaText(ex) {
    var parts = [];
    [ex.shape, ex.shape2].forEach(function (id) {
      var shape = SHAPE_BY_ID[id];
      if (shape) parts.push(shape.label, shape.labelAr, shape.group, shape.groupAr);
    });
    return parts.join(" ");
  }
  function matches(ex, q) {
    if (!q) return true;
    var hay = norm(ex.en + " " + window.exName(ex) + " " + areaText(ex));
    return hay.indexOf(q) !== -1;
  }

  // ---------------- state ----------------
  var DAY_CAP = 7;
  var UNDO_MS = 5000;
  var REJECT_MS = 4000;
  var DRAFT_KEY = "gym_wb_draft"; // sessionStorage only; never synced

  var plan = null; // { days: [{ name, exercises: [exerciseObj, ...] }] } while the builder is open
  var selectedDayIndex = 0; // which day tap-to-add places into
  var query = ""; // normalized form of queryRaw, what matches() compares against
  var queryRaw = "";
  var openGroups = null; // Set of group names; null until first render picks the default
  var sheetOpen = false; // phone: Review sheet; tablet: inline panel
  var saveFailedMsg = false; // true after a Save click failed (3 saved-plan slots full)
  var lastRemoved = null; // { type:"ex"|"day", day, index, ex|dayObj, name }
  var undoTimer = 0;
  var rejectMsg = null; // string shown as role=alert
  var rejectTimer = 0;
  var liveMsg = ""; // announced once through the role=status region
  var focusKeyNext = null; // overrides "keep focus where it was" after the next render

  // ---------------- motion (motion.js / motion.css) ----------------
  // Every rerender() rebuilds the whole screen, so CSS transitions can't run
  // across a change. Instead each change sets a one-shot `fx` describing what
  // just happened; the next render tags only those elements, then clears it,
  // so unrelated rerenders (filter, rename, select) never replay anything.
  var fx = null; // { open, added:{day,ex,name}, newDay, reject, rejectRow, select, palette, saveErr, count, sheet, notice, group }
  function setFx(o) { fx = o; }
  function takeFx(key) { return fx && fx[key]; }
  function reduced() { return !window.GymMotion || GymMotion.reduced(); }

  // Play the exit animation on `el`, then run `done` (the real state change +
  // rerender). Reduced motion, or no element, skips straight to `done`.
  var OUT_MS = 280; // --dur-med; the timeout below is the fallback if animationend never fires
  function animateOut(el, done, cls) {
    cls = cls || "wb-out";
    if (!el || reduced()) { done(); return; }
    if (el.classList.contains(cls)) return; // a second tap while leaving
    el.classList.add(cls);
    var finished = false;
    function finish() { if (finished) return; finished = true; done(); }
    el.addEventListener("animationend", finish, { once: true });
    setTimeout(finish, OUT_MS + 80);
  }

  function closestEl(e, sel) { return e && e.currentTarget && e.currentTarget.closest ? e.currentTarget.closest(sel) : null; }

  // ---------------- layout mode ----------------
  var mqDesktop = window.matchMedia ? window.matchMedia("(min-width:1024px)") : null;
  var mqTablet = window.matchMedia ? window.matchMedia("(min-width:641px)") : null;
  function layoutMode() {
    if (mqDesktop && mqDesktop.matches) return "desktop";
    if (mqTablet && mqTablet.matches) return "tablet";
    return "phone";
  }
  function onModeChange() {
    if (document.querySelector(".wb-screen") && plan) rerender();
  }
  [mqDesktop, mqTablet].forEach(function (mq) {
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener("change", onModeChange);
    else if (mq.addListener) mq.addListener(onModeChange);
  });

  // ---------------- plan model + one-per-shape-per-day constraint ----------------
  function defaultDayName(n) { return fmt("wbDayN", { n: n }); }

  function newPlan() {
    return { days: [{ name: defaultDayName(1), exercises: [] }] };
  }

  // Shapes already used on ONE specific day — the constraint is per-day
  // (a back exercise on Day 1 and a different back exercise on Day 3 are
  // both fine; two back exercises on the same day are not).
  function shapesUsedForDay(dayIndex) {
    var used = {};
    var day = plan.days[dayIndex];
    if (!day) return used;
    day.exercises.forEach(function (e) {
      used[e.shape] = true;
      if (e.shape2) used[e.shape2] = true;
    });
    return used;
  }

  function canPlace(ex, dayIndex) {
    var used = shapesUsedForDay(dayIndex);
    if (used[ex.shape]) return false;
    if (ex.shape2 && used[ex.shape2]) return false;
    return true;
  }

  // The exercise already on `dayIndex` that holds the area `ex` needs, plus
  // the area's shape: { ex, shape } or null when `ex` can be placed.
  function blockingExerciseFor(ex, dayIndex) {
    var day = plan.days[dayIndex];
    if (!day) return null;
    var wanted = [ex.shape].concat(ex.shape2 ? [ex.shape2] : []);
    for (var i = 0; i < day.exercises.length; i++) {
      var held = day.exercises[i];
      var heldShapes = [held.shape].concat(held.shape2 ? [held.shape2] : []);
      for (var j = 0; j < wanted.length; j++) {
        if (heldShapes.indexOf(wanted[j]) !== -1) return { ex: held, shape: SHAPE_BY_ID[wanted[j]] };
      }
    }
    return null;
  }

  function indexInDay(ex, dayIndex) {
    var day = plan.days[dayIndex];
    if (!day) return -1;
    for (var i = 0; i < day.exercises.length; i++) if (day.exercises[i].en === ex.en) return i;
    return -1;
  }

  function placeExercise(dayIndex, ex) {
    if (!canPlace(ex, dayIndex)) return false;
    plan.days[dayIndex].exercises.push(ex);
    return true;
  }

  function removeExercise(dayIndex, exIndex) {
    plan.days[dayIndex].exercises.splice(exIndex, 1);
  }

  // Groups (not areas) present on a day, in catalog order — drives the chips.
  function coverageGroups(dayIndex) {
    var day = plan.days[dayIndex];
    var seen = {};
    if (day) day.exercises.forEach(function (e) {
      [e.shape, e.shape2].forEach(function (id) {
        var g = id && groupOfShape(id);
        if (g) seen[g.name] = true;
      });
    });
    return GROUPS.filter(function (g) { return seen[g.name]; });
  }

  function coverageCount(group, dayIndex) {
    var used = shapesUsedForDay(dayIndex);
    return group.shapes.filter(function (shape) { return used[shape.id]; }).length;
  }

  function areaLine(ex) {
    var names = [SHAPE_BY_ID[ex.shape], ex.shape2 && SHAPE_BY_ID[ex.shape2]].filter(Boolean).map(shapeLabel);
    return names.join(" + ");
  }

  function metaEl(ex) {
    return h("span", { class: "wb-ex-meta" }, h("bdi", {}, ex.sets + "×" + ex.reps), " · " + areaLine(ex));
  }

  // ---------------- notices: rejection message + undo ----------------
  function clearReject() {
    clearTimeout(rejectTimer);
    rejectMsg = null;
  }
  function showReject(text) {
    clearReject();
    rejectMsg = text;
    rejectTimer = setTimeout(function () {
      rejectMsg = null;
      var node = document.querySelector(".wb-reject");
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }, REJECT_MS);
  }
  function clearUndo() {
    clearTimeout(undoTimer);
    lastRemoved = null;
  }
  function offerUndo(info) {
    clearTimeout(undoTimer);
    lastRemoved = info;
    undoTimer = setTimeout(function () {
      var node = document.querySelector(".wb-undo");
      lastRemoved = null;
      if (!node || !node.parentNode) return;
      animateOut(node, function () { if (node.parentNode) node.parentNode.removeChild(node); });
    }, UNDO_MS);
  }

  function rejectionFor(ex, dayIndex) {
    var block = blockingExerciseFor(ex, dayIndex);
    if (!block) return "";
    return fmt("wbDropRejected", {
      area: shapeLabel(block.shape), day: plan.days[dayIndex].name, name: window.exName(block.ex)
    });
  }

  function doUndo() {
    var info = lastRemoved;
    if (!info) return;
    clearUndo();
    if (info.type === "day") {
      if (plan.days.length < DAY_CAP) {
        plan.days.splice(Math.min(info.index, plan.days.length), 0, info.dayObj);
        selectedDayIndex = Math.min(info.index, plan.days.length - 1);
      }
      setFx({ newDay: selectedDayIndex });
      rerender();
      return;
    }
    var day = plan.days[info.day];
    if (!day) { rerender(); return; }
    if (!canPlace(info.ex, info.day)) {
      showReject(rejectionFor(info.ex, info.day));
      setFx({ notice: true });
      rerender();
      return;
    }
    day.exercises.splice(Math.min(info.index, day.exercises.length), 0, info.ex);
    setFx({ added: { day: info.day, ex: Math.min(info.index, day.exercises.length - 1), name: info.ex.en }, count: true });
    rerender();
  }

  // ---------------- actions ----------------
  function addExerciseTo(dayIndex, ex) {
    if (!placeExercise(dayIndex, ex)) return false;
    clearReject();
    var day = plan.days[dayIndex];
    liveMsg = fmt("wbAnnounceAdded", { name: window.exName(ex), day: day.name, n: exercisesLabel(day.exercises.length) });
    setFx({ added: { day: dayIndex, ex: day.exercises.length - 1, name: ex.en }, count: true });
    return true;
  }

  // Remove one exercise, with Undo. `rowEl` (optional) plays the exit first.
  function removeWithUndo(dayIndex, exIndex, rowEl) {
    var ex = plan.days[dayIndex].exercises[exIndex];
    if (!ex) return;
    animateOut(rowEl, function () {
      clearReject();
      removeExercise(dayIndex, exIndex);
      offerUndo({ type: "ex", day: dayIndex, index: exIndex, ex: ex });
      liveMsg = fmt("wbAnnounceRemoved", { name: window.exName(ex) });
      setFx({ count: true, notice: true });
      rerender();
    });
  }

  function removeDayWithUndo(dayIndex) {
    var dayObj = plan.days[dayIndex];
    if (!dayObj || plan.days.length < 2) return;
    clearReject();
    plan.days.splice(dayIndex, 1);
    if (selectedDayIndex > dayIndex || selectedDayIndex >= plan.days.length) selectedDayIndex = Math.max(0, selectedDayIndex - 1);
    if (!dayObj.exercises.length) { clearUndo(); }
    else offerUndo({ type: "day", index: dayIndex, dayObj: dayObj });
    setFx({ select: true, notice: true });
    if (lastRemoved) liveMsg = fmt("wbAnnounceRemoved", { name: dayObj.name });
    if (plan.days.length < 2) sheetOpen = sheetOpen && layoutMode() !== "desktop";
    rerender();
  }

  function addDay() {
    if (plan.days.length >= DAY_CAP) return;
    plan.days.push({ name: defaultDayName(plan.days.length + 1), exercises: [] });
    selectedDayIndex = plan.days.length - 1;
    setFx({ newDay: selectedDayIndex, select: true });
    rerender();
  }

  function selectDay(i) {
    if (i === selectedDayIndex) return;
    selectedDayIndex = i;
    clearReject();
    setFx({ select: true });
    rerender();
  }

  // Shared by every drop target (the day panel, the tray, each tab). A rejected
  // drop flashes the same message as a rejected tap, naming what blocks it.
  function handleDrop(dayIndex, e) {
    e.preventDefault();
    var name = e.dataTransfer.getData("text/plain");
    var ex = EXERCISES.filter(function (x) { return x.en === name; })[0];
    if (!ex) return;
    if (addExerciseTo(dayIndex, ex)) {
      rerender();
    } else {
      showReject(rejectionFor(ex, dayIndex));
      setFx({ reject: dayIndex, notice: true });
      rerender();
    }
  }

  function dropTargetOn(dayIndex) {
    return {
      dragover: function (e) {
        e.preventDefault();
        if (!e.currentTarget.classList.contains("wb-drop-over")) e.currentTarget.classList.add("wb-drop-over");
      },
      dragleave: function (e) {
        if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
        e.currentTarget.classList.remove("wb-drop-over");
      },
      drop: function (e) { e.currentTarget.classList.remove("wb-drop-over"); handleDrop(dayIndex, e); }
    };
  }

  // ---------------- icons (currentColor, decorative) ----------------
  var ICONS = {
    play: '<path d="M8 5.5v13l11-6.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>',
    chevDown: '<path d="M6 9.5l6 6 6-6"/>',
    chevStart: '<path d="M15 5.5l-6.5 6.5 6.5 6.5"/>',
    chevEnd: '<path d="M9 5.5l6.5 6.5-6.5 6.5"/>'
  };
  function icon(name, cls) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", "wb-icon" + (cls ? " " + cls : ""));
    svg.innerHTML = ICONS[name];
    return svg;
  }

  // 44px "how is it done" button. Reuses app.js's #videoModal player; never
  // adds the exercise (stopPropagation keeps the row's own click handler out).
  function previewBtn(ex) {
    return h("button", {
      type: "button", class: "wb-preview", "aria-label": fmt("wbWatch", { name: window.exName(ex) }),
      on: { click: function (e) {
        e.stopPropagation();
        if (ex.vid && window.openVideoModal) window.openVideoModal(ex);
      } }
    }, icon("play"));
  }

  // ---------------- header ----------------
  function headEl() {
    return h("div", { class: "wb-head" },
      h("button", {
        type: "button", class: "wb-back", "aria-label": s("wbBack"), "data-fk": "back",
        on: { click: function () { discardDraft(); window.GymCoach && window.GymCoach.refresh(); } }
      }, icon("chevStart", "wb-mirror")),
      h("h2", {}, s("wbTitle")));
  }

  // ---------------- day tabs ----------------
  function tabsEl() {
    var tabs = plan.days.map(function (d, i) {
      var selected = i === selectedDayIndex;
      var cls = "wb-tab" + (selected ? " wb-tab-on" : "");
      if (takeFx("newDay") === i) cls += " wb-in";
      else if (selected && takeFx("select")) cls += " wb-picked";
      return h("button", {
        type: "button", role: "tab", class: cls, id: "wbTab" + i, "data-fk": "tab:" + i,
        "aria-selected": selected ? "true" : "false", tabindex: selected ? "0" : "-1",
        on: Object.assign({
          click: function () { selectDay(i); },
          keydown: function (e) { onTabKey(e, i); }
        }, dropTargetOn(i))
      }, h("span", { class: "wb-tab-name" }, d.name), h("span", { class: "wb-tab-count" }, d.exercises.length));
    });
    if (plan.days.length < DAY_CAP) {
      tabs.push(h("button", {
        type: "button", class: "wb-tab wb-tab-add", "data-fk": "addday", on: { click: addDay }
      }, icon("plus"), h("span", {}, s("wbAddDay"))));
    }
    return h("div", { class: "wb-tabs", role: "tablist", "aria-label": s("wbTitle") }, tabs);
  }

  function onTabKey(e, i) {
    var dir = document.documentElement.dir === "rtl" ? -1 : 1;
    var next = -1;
    if (e.key === "ArrowRight") next = i + dir;
    else if (e.key === "ArrowLeft") next = i - dir;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = plan.days.length - 1;
    if (next < 0 || next >= plan.days.length) return;
    e.preventDefault();
    focusKeyNext = "tab:" + next;
    selectDay(next);
  }

  // ---------------- coverage chips ----------------
  function covChipsEl(dayIndex, max) {
    var groups = coverageGroups(dayIndex);
    if (!groups.length) return null;
    var shown = max ? groups.slice(0, max) : groups;
    var chips = shown.map(function (g) { return h("span", { class: "wb-cov" }, groupLabel(g)); });
    if (max && groups.length > max) chips.push(h("span", { class: "wb-cov wb-cov-more" }, "+" + (groups.length - max)));
    return h("span", { class: "wb-covs" }, chips);
  }

  function ruleEl() {
    return h("p", { class: "wb-rule" }, icon("info"), h("span", {}, s("wbRule")));
  }

  // ---------------- notices (rejection alert + undo bar) ----------------
  function noticeEl() {
    var fresh = takeFx("notice");
    var rejected = takeFx("reject") !== undefined;
    var kids = [];
    if (rejectMsg) kids.push(h("p", { class: "wb-reject" + (fresh ? " wb-in" : ""), role: "alert" }, rejectMsg));
    if (lastRemoved) {
      var name = lastRemoved.type === "day" ? lastRemoved.dayObj.name : window.exName(lastRemoved.ex);
      kids.push(h("div", { class: "wb-undo" + (fresh ? " wb-in" : "") },
        h("span", {}, fmt("wbRemoved", { name: name })),
        h("button", { type: "button", class: "wb-undo-btn", "data-fk": "undo", on: { click: doUndo } }, s("wbUndo"))));
    }
    if (!kids.length) return null;
    return h("div", { class: "wb-notice" + (rejected ? " wb-shake" : "") }, kids);
  }

  // ---------------- day panel (desktop column, tablet inline, phone sheet) ----------------
  function panelEl(mode) {
    var day = plan.days[selectedDayIndex];
    var dayIndex = selectedDayIndex;
    var added = takeFx("added");
    var rows = day.exercises.map(function (ex, exIndex) {
      var isNew = added && added.day === dayIndex && added.ex === exIndex;
      return h("li", { class: "wb-placed-ex" + (isNew ? " wb-in" : "") },
        h("span", { class: "wb-placed-text" },
          h("span", { class: "wb-placed-name" }, window.exName(ex)),
          metaEl(ex)),
        previewBtn(ex),
        h("button", {
          type: "button", class: "wb-remove-btn", "data-fk": "rm:" + ex.en,
          "aria-label": fmt("wbRemove", { name: window.exName(ex) }),
          on: { click: function (e) { removeWithUndo(dayIndex, exIndex, closestEl(e, ".wb-placed-ex")); } }
        }, icon("x")));
    });
    var body = rows.length
      ? h("ul", { class: "wb-placed" }, rows)
      : h("div", { class: "wb-empty" }, h("p", { class: "wb-empty-h" }, s("wbEmptyH")), h("p", { class: "wb-empty-b" }, s("wbEmptyB")));
    var attrs = { class: "wb-panel" };
    if (mode === "desktop") {
      attrs.role = "tabpanel";
      attrs["aria-labelledby"] = "wbTab" + dayIndex;
      attrs.on = dropTargetOn(dayIndex);
    }
    return h("section", attrs,
      h("div", { class: "wb-panel-head" },
        h("input", {
          class: "wb-day-name", value: day.name, "aria-label": s("wbDayName"), "data-fk": "dayname",
          on: { input: function (e) { onRename(e.target.value); } }
        }),
        h("span", { class: "wb-panel-count" }, exercisesLabel(day.exercises.length))),
      ruleEl(),
      covChipsEl(dayIndex, 0),
      body,
      noticeEl(),
      plan.days.length > 1 ? h("button", {
        type: "button", class: "wb-remove-day", "data-fk": "rmday", on: { click: function () { removeDayWithUndo(dayIndex); } }
      }, s("wbRemoveDay")) : null);
  }

  function onRename(value) {
    var day = plan.days[selectedDayIndex];
    day.name = value;
    var tab = document.querySelector("#wbTab" + selectedDayIndex + " .wb-tab-name");
    if (tab) tab.textContent = value;
    var tray = document.querySelector(".wb-tray-name");
    if (tray) tray.textContent = value;
  }

  // ---------------- compact tray (phone + tablet) ----------------
  function trayEl(mode) {
    var day = plan.days[selectedDayIndex];
    var dayIndex = selectedDayIndex;
    var cls = "wb-tray";
    if (takeFx("select")) cls += " wb-picked";
    else if (takeFx("reject") === dayIndex) cls += " wb-shake";
    return h("div", { class: cls, on: dropTargetOn(dayIndex) },
      h("div", { class: "wb-tray-text" },
        h("span", { class: "wb-tray-name" }, day.name),
        h("span", { class: "wb-tray-count" }, exercisesLabel(day.exercises.length)),
        covChipsEl(dayIndex, 2)),
      h("button", {
        type: "button", class: "wb-review", "data-fk": "review",
        "aria-expanded": sheetOpen ? "true" : "false", "aria-haspopup": mode === "phone" ? "dialog" : null,
        on: { click: function () { toggleSheet(); } }
      }, h("span", {}, s("wbReview")), icon("chevDown", "wb-review-chev")));
  }

  function toggleSheet() {
    if (!sheetOpen) {
      sheetOpen = true;
      focusKeyNext = layoutMode() === "phone" ? "sheet" : "review";
      setFx({ sheet: true });
      rerender();
    } else closeSheet();
  }

  function closeSheet() {
    var sheet = document.querySelector(".wb-sheet");
    var scrim = document.querySelector(".wb-scrim");
    if (scrim) scrim.classList.add("wb-sheet-out");
    animateOut(sheet, function () {
      sheetOpen = false;
      focusKeyNext = "review";
      rerender();
    }, "wb-sheet-out");
  }

  function sheetEl() {
    var day = plan.days[selectedDayIndex];
    var fresh = takeFx("sheet");
    var sheet = h("div", {
      class: "wb-sheet" + (fresh ? " wb-sheet-in" : ""), role: "dialog", "aria-modal": "true",
      "aria-labelledby": "wbSheetTitle",
      on: {
        keydown: function (e) {
          if (e.key === "Escape") { e.preventDefault(); closeSheet(); return; }
          if (e.key !== "Tab") return;
          var f = Array.prototype.filter.call(sheet.querySelectorAll("button, input, [tabindex='0']"), function (n) { return !n.disabled; });
          if (!f.length) return;
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet.querySelector(".wb-sheet-title"))) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    },
      h("span", { class: "wb-sheet-grip", "aria-hidden": "true" }),
      h("div", { class: "wb-sheet-bar" },
        h("h3", { class: "wb-sheet-title", id: "wbSheetTitle", tabindex: "-1", "data-fk": "sheet" }, fmt("wbReviewTitle", { day: day.name })),
        h("button", {
          type: "button", class: "wb-sheet-close", "aria-label": s("wbClose"), "data-fk": "sheetclose", on: { click: closeSheet }
        }, icon("x"))),
      panelEl("phone"));
    return h("div", { class: "wb-sheet-wrap" },
      h("div", { class: "wb-scrim" + (fresh ? " wb-sheet-in" : ""), on: { click: closeSheet } }),
      sheet);
  }

  // ---------------- palette ----------------
  function chipEl(label, pressed, onClick, extra) {
    var attrs = { type: "button", class: "wb-chip" + (pressed ? " wb-chip-on" : ""), on: { click: onClick } };
    if (pressed !== null) attrs["aria-pressed"] = pressed ? "true" : "false";
    if (extra) Object.keys(extra).forEach(function (k) { attrs[k] = extra[k]; });
    return h("button", attrs, label);
  }

  function paletteHeadEl() {
    var easyOnly = getEasyOnly();
    var search = h("div", { class: "wb-search-wrap" },
      icon("search"),
      h("input", {
        type: "search", class: "wb-search", value: queryRaw, placeholder: s("wbSearch"), "aria-label": s("wbSearch"),
        enterkeyhint: "search", autocomplete: "off", "data-fk": "search",
        on: { input: function (e) { onSearch(e.target.value); } }
      }));
    var chips = [
      chipEl(s("wbFilterAll"), !easyOnly, function () { if (easyOnly) { setEasyOnly(false); setFx({ palette: true }); rerender(); } }, { "data-fk": "chip:all" }),
      chipEl(s("wbFilterEasyOnly"), easyOnly, function () { if (!easyOnly) { setEasyOnly(true); setFx({ palette: true }); rerender(); } }, { "data-fk": "chip:easy" })
    ];
    GROUPS.forEach(function (g) {
      // Group chips are shortcuts, not filters: they open that group and scroll to it.
      chips.push(chipEl(groupLabel(g), null, function () {
        queryRaw = ""; query = "";
        ensureOpen().add(g.name);
        focusKeyNext = "chip:g:" + g.name;
        setFx({ group: g.name, scrollTo: g.name });
        rerender();
      }, { "data-fk": "chip:g:" + g.name }));
    });
    return h("div", { class: "wb-pal-head" }, search, h("div", { class: "wb-chips", role: "group", "aria-label": s("wbFilters") }, chips));
  }

  function ensureOpen() {
    if (!openGroups) {
      var first = GROUPS.filter(function (g) { return coverageCount(g, selectedDayIndex) === 0; })[0] || GROUPS[0];
      openGroups = new Set([first.name]);
    }
    return openGroups;
  }

  function onSearch(value) {
    queryRaw = value;
    query = norm(value);
    var old = document.querySelector(".wb-groups");
    if (!old) return;
    var fresh = groupsEl();
    old.parentNode.replaceChild(fresh, old);
  }

  function exRowEl(ex) {
    var dayIndex = selectedDayIndex;
    var easy = ex.tier === "easy";
    var held = indexInDay(ex, dayIndex);
    var inDay = held >= 0;
    var block = !inDay ? blockingExerciseFor(ex, dayIndex) : null;
    var name = window.exName(ex);
    var justAdded = takeFx("added");
    var cls = "wb-ex" + (inDay ? " wb-ex-in" : "") + (block ? " wb-ex-blocked" : "");
    if (justAdded && justAdded.name === ex.en && inDay) cls += " wb-added-row";
    var whyId = "wbWhy" + EXERCISES.indexOf(ex);
    var rejectRow = takeFx("rejectRow") === ex.en;
    if (rejectRow) cls += " wb-shake";
    var mainAttrs = { type: "button", class: "wb-ex-main", "data-fk": "ex:" + ex.en };
    if (block) { mainAttrs["aria-disabled"] = "true"; mainAttrs["aria-describedby"] = whyId; }
    if (inDay) mainAttrs["aria-label"] = fmt("wbRemove", { name: name });
    else if (!block) mainAttrs["aria-label"] = fmt("wbAdd", { name: name });
    var glyph = inDay ? "check" : block ? "minus" : "plus";
    return h("div", {
      class: cls, draggable: "true", role: "listitem", "data-ex-name": ex.en,
      on: {
        click: function (e) {
          if (inDay) { removeWithUndo(dayIndex, held, null); return; }
          if (block) {
            showReject(rejectionFor(ex, dayIndex));
            focusKeyNext = "ex:" + ex.en;
            setFx({ rejectRow: ex.en, reject: dayIndex, notice: true });
            rerender();
            return;
          }
          if (addExerciseTo(dayIndex, ex)) { focusKeyNext = "ex:" + ex.en; rerender(); }
        },
        dragstart: function (e) {
          e.dataTransfer.setData("text/plain", ex.en);
          var row = e.currentTarget; // dim after the browser has taken the drag image
          setTimeout(function () { row.classList.add("wb-dragging"); }, 0);
        },
        dragend: function (e) { e.currentTarget.classList.remove("wb-dragging"); }
      }
    },
      h("button", mainAttrs,
        h("span", { class: "wb-ex-name" }, name, easy ? h("span", { class: "wb-badge-easy" }, s("wbEasy")) : null),
        metaEl(ex),
        block ? h("span", { class: "wb-ex-why", id: whyId }, icon("info"), h("span", {}, fmt("wbAreaUsed", { area: shapeLabel(block.shape) }))) : null),
      previewBtn(ex),
      h("span", { class: "wb-add", "aria-hidden": "true" }, icon(glyph)));
  }

  function groupEl(g, easyOnly, q) {
    var open = q ? true : ensureOpen().has(g.name);
    var covered = coverageCount(g, selectedDayIndex);
    var bodyId = "wbGroup-" + GROUPS.indexOf(g);
    var shapeEls = [];
    var hits = 0;
    g.shapes.forEach(function (shape) {
      var all = exercisesForShape(shape.id, false);
      var options = exercisesForShape(shape.id, easyOnly).filter(function (ex) { return matches(ex, q); });
      hits += options.length;
      var kids;
      if (options.length) kids = options.map(exRowEl);
      else if (q) return; // searching: hide areas with no hits
      else if (easyOnly && all.length) {
        kids = [h("p", { class: "wb-ex-empty" }, s("wbNoEasy") + " ",
          h("button", { type: "button", class: "wb-link", on: { click: function () { setEasyOnly(false); setFx({ palette: true }); rerender(); } } }, s("wbShowAll")))];
      } else kids = [h("p", { class: "wb-ex-empty" }, s("wbNoExercisesYet"))];
      shapeEls.push(h("div", { class: "wb-area" }, h("div", { class: "wb-area-label" }, shapeLabel(shape)), h("div", { role: "list" }, kids)));
    });
    if (q && !hits) return null;
    var bodyAttrs = { class: "wb-group-body", id: bodyId };
    if (!open) bodyAttrs.hidden = "";
    var body = h("div", bodyAttrs, shapeEls);
    var head = h("button", {
      type: "button", class: "wb-group-h", "aria-expanded": open ? "true" : "false", "aria-controls": bodyId,
      "data-fk": "grp:" + g.name,
      on: { click: function () {
        if (q) return;
        var set = ensureOpen();
        if (set.has(g.name)) set.delete(g.name); else set.add(g.name);
        focusKeyNext = "grp:" + g.name;
        if (set.has(g.name)) setFx({ group: g.name });
        rerender();
      } }
    }, icon("chevEnd", "wb-group-chev wb-mirror"), h("span", { class: "wb-group-name" }, groupLabel(g)),
      h("span", { class: "wb-group-count" + (covered ? " wb-group-count-on" : "") }, h("bdi", {}, covered + " / " + g.shapes.length)));
    return h("div", { class: "wb-group" + (open ? " wb-group-open" : ""), "data-group": g.name }, head, body);
  }

  function groupsEl() {
    var easyOnly = getEasyOnly();
    var els = GROUPS.map(function (g) { return groupEl(g, easyOnly, query); }).filter(Boolean);
    if (!els.length) {
      els = [h("div", { class: "wb-noresults", role: "status" },
        h("p", {}, fmt("wbNoResults", { q: queryRaw })),
        h("button", {
          type: "button", class: "wb-link", on: { click: function () {
            queryRaw = ""; query = ""; focusKeyNext = "search"; rerender();
          } }
        }, s("wbClearSearch")))];
    }
    return h("div", { class: "wb-groups" }, els);
  }

  function paletteEl() {
    var day = plan.days[selectedDayIndex];
    return h("div", { class: "wb-palette" },
      h("div", { class: "wb-pal-title" },
        h("h3", {}, s("wbExercises")),
        h("span", { class: "wb-adding" }, fmt("wbAddingTo", { day: day.name }))),
      paletteHeadEl(),
      groupsEl());
  }

  // ---------------- save bar ----------------
  function savedDays() { return plan.days.filter(function (d) { return d.exercises.length > 0; }); }
  function exerciseTotal() { return plan.days.reduce(function (n, d) { return n + d.exercises.length; }, 0); }

  function saveBarEl() {
    var total = exerciseTotal();
    var ready = total > 0;
    var empties = ready ? plan.days.filter(function (d) { return !d.exercises.length; }) : [];
    var kids = [
      h("button", {
        type: "button", class: "wb-save" + (ready ? "" : " wb-save-off"), "data-fk": "save",
        "aria-disabled": ready ? null : "true", "aria-describedby": ready ? null : "wbSaveHelp",
        on: { click: onSave }
      }, h("span", { class: "wb-save-label" }, s("wbSave")),
        ready ? h("span", { class: "wb-save-sum" }, daysLabel(savedDays().length) + " · " + exercisesLabel(total)) : null)
    ];
    if (!ready) kids.push(h("p", { class: "wb-save-help", id: "wbSaveHelp" }, s("wbSaveHelp")));
    else if (empties.length) kids.push(h("p", { class: "wb-save-help" }, empties.map(function (d) { return fmt("wbSkipped", { name: d.name }); }).join(" ")));
    if (saveFailedMsg) {
      kids.push(h("div", { class: "wb-save-err" + (takeFx("saveErr") ? " wb-shake" : ""), role: "alert" },
        icon("info"),
        h("p", {}, s("wbSaveFull") + " ",
          h("button", { type: "button", class: "wb-link", "data-fk": "myplans", on: { click: openMyPlans } }, s("wbOpenMyPlans")))));
    }
    return h("div", { class: "wb-savebar" }, kids);
  }

  function onSave() {
    if (!exerciseTotal() || !window.GymWorkoutBuilderSave) return;
    var ok = window.GymWorkoutBuilderSave(exportAsWorkoutPlan());
    if (ok) {
      saveFailedMsg = false; // navigates away (renderMyPlans) — no rerender here
      discardDraft();
    } else {
      saveFailedMsg = true;
      focusKeyNext = "save";
      setFx({ saveErr: true });
      rerender();
    }
  }

  // ---------------- draft kept across "Open My plans" ----------------
  function stashDraft() {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        sel: selectedDayIndex,
        days: plan.days.map(function (d) { return { name: d.name, ex: d.exercises.map(function (e) { return e.en; }) }; })
      }));
    } catch (e) {}
  }
  function discardDraft() {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }
  function takeDraft() {
    var raw = null;
    try { raw = sessionStorage.getItem(DRAFT_KEY); sessionStorage.removeItem(DRAFT_KEY); } catch (e) {}
    if (!raw) return null;
    try {
      var d = JSON.parse(raw);
      if (!d || !Array.isArray(d.days) || !d.days.length) return null;
      var days = d.days.slice(0, DAY_CAP).map(function (day) {
        return {
          name: String(day.name || ""),
          exercises: (day.ex || []).map(function (n) { return EXERCISES.filter(function (e) { return e.en === n; })[0]; }).filter(Boolean)
        };
      });
      return { plan: { days: days }, sel: Math.min(Math.max(+d.sel || 0, 0), days.length - 1) };
    } catch (e) { return null; }
  }

  function openMyPlans() {
    stashDraft();
    if (window.GymCoach && window.GymCoach.myPlans) window.GymCoach.myPlans();
  }

  // ---------------- mount (same pattern as coach.js's mount(): replaces #coachBody) ----------------
  // resetScroll is only true on the initial open() — every later rerender()
  // must NOT jump the page back to the top.
  function mount(el, resetScroll) {
    var body = document.getElementById("coachBody");
    if (!body) return;
    body.innerHTML = "";
    body.appendChild(el);
    if (resetScroll) { try { window.scrollTo(0, 0); } catch (e) {} }
  }

  // Effects that need the element in the DOM (stagger timing, pop restart,
  // sticky offsets, focus). Runs after mount; always clears `fx`.
  function playFx(root) {
    var f = fx;
    fx = null;
    var top = root.querySelector(".wb-top");
    if (top) root.style.setProperty("--wb-top-h", top.offsetHeight + "px");
    var tabs = root.querySelector(".wb-tabs");
    var on = root.querySelector(".wb-tab-on");
    if (tabs && on && tabs.scrollWidth > tabs.clientWidth + 1 && on.scrollIntoView) {
      try { on.scrollIntoView({ inline: "nearest", block: "nearest" }); } catch (e) {}
    }
    restoreFocus(root);
    var live = root.querySelector(".wb-live");
    if (live && liveMsg) { live.textContent = liveMsg; liveMsg = ""; }
    if (!f) return;
    if (f.scrollTo) {
      var g = root.querySelector('.wb-group[data-group="' + f.scrollTo + '"]');
      if (g && g.scrollIntoView) { try { g.scrollIntoView({ block: "start", behavior: "auto" }); } catch (e) {} }
    }
    if (!window.GymMotion) return;
    if (f.open) {
      GymMotion.enter(root.querySelector(".wb-head"), { max: 3 });
      GymMotion.enter(root.querySelector(".wb-groups"), { max: 6 });
    }
    if (f.palette) GymMotion.enter(root.querySelector(".wb-groups"), { max: 6 });
    if (f.group) {
      var gb = root.querySelector('.wb-group[data-group="' + f.group + '"] .wb-group-body');
      if (gb) GymMotion.enter(gb.querySelector("[role=list]") ? gb.querySelector("[role=list]") : gb, { max: 6 });
    }
    if (f.select) GymMotion.enter(root.querySelector(".wb-panel"), { max: 4 });
    if (f.count) GymMotion.pop(root.querySelector(".wb-tray-count") || root.querySelector(".wb-panel-count"));
  }

  var lastFocusKey = null;
  function rememberFocus() {
    var a = document.activeElement;
    var fk = a && a.getAttribute && a.getAttribute("data-fk");
    lastFocusKey = fk || null;
  }
  function restoreFocus(root) {
    var key = focusKeyNext || lastFocusKey;
    focusKeyNext = null;
    lastFocusKey = null;
    if (!key) return;
    var nodes = root.querySelectorAll("[data-fk]");
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute("data-fk") === key) {
        try { nodes[i].focus({ preventScroll: true }); } catch (e) {}
        return;
      }
    }
  }

  function rerender() {
    rememberFocus();
    var el = screenEl();
    mount(el, false);
    playFx(el);
  }

  function screenEl() {
    // Clamp selectedDayIndex before anything reads plan.days[selectedDayIndex].
    if (selectedDayIndex >= plan.days.length) selectedDayIndex = plan.days.length - 1;
    if (selectedDayIndex < 0) selectedDayIndex = 0;
    var mode = layoutMode();
    var day = plan.days[selectedDayIndex];
    var emptyDay = !day.exercises.length;
    var panelInPlace = mode === "desktop" || (mode === "tablet" && sheetOpen);
    if (mode === "desktop") sheetOpen = false;

    var topKids = [tabsEl()];
    if (mode !== "desktop") topKids.push(trayEl(mode));
    var top = h("div", { class: "wb-top" }, topKids);

    var sideKids = [top];
    if (panelInPlace) sideKids.push(panelEl(mode));
    sideKids.push(saveBarEl());
    var side = h("div", { class: "wb-side" }, sideKids);

    var main = [side];
    if (mode !== "desktop") {
      main.push(h("div", { class: "wb-hint" },
        emptyDay ? h("p", { class: "wb-rule" }, icon("info"), h("span", {}, s("wbEmptyB"))) : ruleEl(),
        !panelInPlace && !sheetOpen ? noticeEl() : null));
    }
    main.push(paletteEl());

    var kids = [headEl(), h("div", { class: "wb-layout wb-mode-" + mode }, main)];
    if (mode === "phone" && sheetOpen) kids.push(sheetEl());
    kids.push(h("div", { class: "wb-live", role: "status", "aria-live": "polite" }));
    return h("div", { class: "wb-screen" }, kids);
  }

  // ---------------- public API ----------------
  function open() {
    var draft = takeDraft();
    plan = draft ? draft.plan : newPlan();
    selectedDayIndex = draft ? draft.sel : 0;
    query = ""; queryRaw = "";
    openGroups = null;
    sheetOpen = false;
    saveFailedMsg = false;
    clearReject(); clearUndo();
    liveMsg = ""; focusKeyNext = null; lastFocusKey = null;
    setFx({ open: true });
    var el = screenEl();
    mount(el, true);
    playFx(el);
  }

  function exportAsWorkoutPlan() {
    return {
      split: "Custom",
      days: plan.days.filter(function (d) { return d.exercises.length > 0; }).map(function (d) {
        return {
          day: d.name,
          exercises: d.exercises.map(function (ex) {
            return { name: ex.en, sets: ex.sets, reps: ex.reps, restSec: ex.rest };
          })
        };
      })
    };
  }

  window.GymWorkoutBuilder = { open: open, exportAsWorkoutPlan: exportAsWorkoutPlan };
})();
