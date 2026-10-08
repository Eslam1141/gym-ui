/* workout-builder.js — the drag-and-drop "Build Your Own Plan" screen.
 *
 * Reads the `shape`, `shape2` and `tier` tags Task 1 added to every
 * exercise across DAYS_PREVIEW, DAYS_MALE, DAYS_FEMALE, DAYS_MALE_CAL and
 * DAYS_FEMALE_CAL (top-level `const`s declared in app.js, which loads
 * first and non-deferred, so they're already defined by the time this
 * deferred script runs) plus the MUSCLE_SHAPES catalog (also an app.js
 * const), and lets the user drag exercises into day cards while
 * enforcing one exercise per muscle "shape" PER DAY (canPlace()/
 * shapesUsedForDay() — the same shape may appear on different days,
 * just not twice on the same day).
 *
 * The "easy" tier (green-bordered palette chips) is a difficulty
 * marker, not a "recommended" flag — it means "an easier alternate
 * exercise for this muscle area". The palette shows an explicit legend
 * plus an "All exercises" / "Easy only" filter toggle so that meaning
 * isn't just implied by color (STR.wbLegendEasy / getEasyOnly()).
 *
 * Renders into #coachBody — the same mount point coach.js's own screen
 * uses. Task 3 (not yet done) wires an entry-point button inside the
 * Coach screen that calls GymWorkoutBuilder.open(), and defines
 * window.GymWorkoutBuilderSave (called from this screen's Save button).
 * Task 4 (not yet done) registers this file's <script> tag in index.html.
 * Loads after app.js (reads its DAYS_* and MUSCLE_SHAPES globals) and
 * after ui.js. No external deps.
 *
 * i18n/DOM helpers: h(), lang() and s() come from dom.js (window.GymDom,
 * shared with chat/checkin/coach/food); this module keeps its own STR table
 * and its own mount() into #coachBody, matching coach.js. app.js's string
 * table is a different object (`const T`, read via `t()`) used only for
 * static data-i18n HTML bindings.
 *
 * Public API: window.GymWorkoutBuilder = { open, exportAsWorkoutPlan }.
 * exportAsWorkoutPlan() -> { split: "Custom", days: [{day, exercises:
 * [{name, sets, reps, restSec}]}] } — the exact shape coach.js's
 * renderWorkout()/mapWorkout() already consume (coach.js:1045-1079).
 */
(function () {
  "use strict";

  // ---------------- i18n (same local pattern as coach.js/calendar.js) ----------------
  if (!window.GymDom) throw new Error("workout-builder.js: dom.js must load first");
  var h = GymDom.h, lang = GymDom.lang;
  var STR = {
    wbTitle: ["Build Your Own Plan", "ابنِ خطتك الخاصة"],
    wbEasy: ["easy", "سهل"],
    wbNoExercisesYet: ["No exercises yet for this area", "لا توجد تمارين لهذه المنطقة بعد"],
    wbAddDay: ["+ Add day", "+ أضف يوم"],
    wbRemoveDay: ["Remove day", "إزالة اليوم"],
    wbSaveBtn: ["Save this plan", "حفظ هذه الخطة"],
    wbSaveFull: ["Couldn't save — your 3 saved-plan slots are full. Delete one from My Plans first.", "تعذر الحفظ — خانات الحفظ الثلاث ممتلئة. احذف واحدة من \"خططي\" أولاً."],
    wbBack: ["Back", "رجوع"],
    wbLegendEasy: ["Green border = easier alternative for that muscle area", "الحد الأخضر = بديل أسهل لهذه المنطقة العضلية"],
    wbFilterAll: ["All exercises", "كل التمارين"],
    wbFilterEasyOnly: ["Easy only", "السهل فقط"],
    wbNoEasyForArea: ["No easy alternative here — switch to “All exercises”", "لا يوجد بديل سهل هنا — بدّل إلى “كل التمارين”"],
    wbExercisesShort: ["exercises", "تمارين"],
    wbDropRejected: ["Can't add — this day already has an exercise for that muscle area", "تعذّرت الإضافة — هذا اليوم يحتوي بالفعل على تمرين لهذه المنطقة العضلية"]
  };
  var s = GymDom.makeT(STR);

  // ---------------- exercise index, deduplicated by shape ----------------
  // one entry per unique exercise (by `en` name) — the same exercise
  // appears under multiple ids/day-variants across the 5 day arrays, but
  // each id is unique, so dedupe by `en` name instead (two different ids
  // for the same en name are the same exercise, tagged identically by
  // construction in Task 1).
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

  function exercisesForShape(shapeId, easyOnly) {
    return EXERCISES.filter(function (e) {
      if (e.shape !== shapeId && e.shape2 !== shapeId) return false;
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

  // ---------------- plan state + one-per-shape-per-day constraint ----------------
  var plan = null; // { days: [{ name, exercises: [exerciseObj, ...] }] } while the builder is open
  var selectedDayIndex = 0; // which day tap-to-add places into; clamped at the top of screenEl() whenever a day is removed
  var saveFailedMsg = false; // true after a Save click failed (3 saved-plan slots full); cleared on open()/successful save
  var dropRejectDayIndex = -1; // day index whose drop was just rejected by canPlace(); -1 = none. Drives a brief inline
  // message so a failed drag-drop (duplicate muscle area for that day) isn't silent — auto-clears after DROP_REJECT_MS.
  var DROP_REJECT_MS = 1800;

  function newPlan() {
    return { days: [{ name: "Day 1", exercises: [] }] };
  }

  // Shapes already used on ONE specific day — the constraint is per-day
  // (e.g. a back exercise on Day 1 and a different back exercise on Day 3
  // are both fine; two back exercises on the same day are not).
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

  function placeExercise(dayIndex, ex) {
    if (!canPlace(ex, dayIndex)) return false;
    plan.days[dayIndex].exercises.push(ex);
    return true;
  }

  function removeExercise(dayIndex, exIndex) {
    plan.days[dayIndex].exercises.splice(exIndex, 1);
  }

  // Shared by both drop targets (dayEl()'s own card and stickyDayEl()'s
  // compact bar). A rejected drop (canPlace() says no — that muscle area is
  // already used on this day) used to be silent, which reads as "the drag
  // just didn't work"; now it flashes an inline message under that day for
  // DROP_REJECT_MS.
  function handleDrop(dayIndex, e) {
    e.preventDefault();
    var name = e.dataTransfer.getData("text/plain");
    var ex = EXERCISES.filter(function (x) { return x.en === name; })[0];
    if (!ex) return;
    if (placeExercise(dayIndex, ex)) {
      dropRejectDayIndex = -1;
      rerender();
    } else {
      dropRejectDayIndex = dayIndex;
      rerender();
      setTimeout(function () {
        if (dropRejectDayIndex === dayIndex) { dropRejectDayIndex = -1; rerender(); }
      }, DROP_REJECT_MS);
    }
  }

  // ---------------- palette UI (grouped by muscle group, one section per shape) ----------------
  function paletteEl() {
    var easyOnly = getEasyOnly();
    var legend = h("div", { class: "wb-legend" },
      h("div", { class: "wb-legend-row" },
        h("span", { class: "wb-legend-swatch", "aria-hidden": "true" }),
        h("span", {}, s("wbLegendEasy"))),
      h("div", { class: "wb-filter-toggle", role: "group" },
        h("button", {
          type: "button", class: "wb-filter-btn" + (!easyOnly ? " active" : ""),
          "aria-pressed": easyOnly ? "false" : "true",
          on: { click: function () { if (easyOnly) { setEasyOnly(false); rerender(); } } }
        }, s("wbFilterAll")),
        h("button", {
          type: "button", class: "wb-filter-btn" + (easyOnly ? " active" : ""),
          "aria-pressed": easyOnly ? "true" : "false",
          on: { click: function () { if (!easyOnly) { setEasyOnly(true); rerender(); } } }
        }, s("wbFilterEasyOnly"))));
    var groups = {};
    MUSCLE_SHAPES.forEach(function (shape) {
      groups[shape.group] = groups[shape.group] || [];
      groups[shape.group].push(shape);
    });
    var sections = Object.keys(groups).map(function (groupName) {
      var shapeEls = groups[groupName].map(function (shape) {
        var options = exercisesForShape(shape.id, easyOnly);
        var hasAnyForShape = easyOnly ? exercisesForShape(shape.id, false).length > 0 : true;
        // Per-exercise, not per-section: a dual-tagged exercise (shape2 set)
        // must grey out here too once EITHER of its two shapes is used on
        // the selected day, even if this section's own shape.id is still
        // free there. canPlace(ex, selectedDayIndex) already checks both
        // ex.shape and ex.shape2 against that one day, so it's the correct
        // single source of truth for whether tapping this option would add
        // it to the currently-selected day. Drag stays enabled regardless
        // (dragstart is always attached below) since a drag can target any
        // day, not just the selected one — the real per-day check happens
        // in dayEl()'s drop handler via placeExercise().
        var optionEls = options.length
          ? options.map(function (ex) {
              var disabled = !canPlace(ex, selectedDayIndex);
              var onHandlers = { dragstart: function (e) { e.dataTransfer.setData("text/plain", ex.en); } };
              if (!disabled) onHandlers.click = function () { if (placeExercise(selectedDayIndex, ex)) rerender(); };
              return h("div", {
                class: "wb-ex" + (ex.tier === "easy" ? " wb-ex-easy" : "") + (disabled ? " wb-ex-disabled" : ""),
                draggable: "true",
                "data-ex-name": ex.en,
                on: onHandlers
              }, window.exName(ex) + (ex.tier === "easy" ? " (" + s("wbEasy") + ")" : ""));
            })
          : [h("div", { class: "wb-ex-empty" }, hasAnyForShape ? s("wbNoEasyForArea") : s("wbNoExercisesYet"))];
        return h("div", { class: "wb-shape" },
          h("div", { class: "wb-shape-label" }, lang() === "ar" ? shape.labelAr : shape.label),
          h.apply(null, ["div", { class: "wb-shape-options" }].concat(optionEls)));
      });
      // groups is keyed by the English `group` string; look up the Arabic
      // label from any shape entry in that group's own array rather than
      // building a second lookup table.
      var groupLabel = lang() === "ar" ? groups[groupName][0].groupAr : groupName;
      return h("div", { class: "wb-group" }, h("h4", {}, groupLabel), h.apply(null, ["div", {}].concat(shapeEls)));
    });
    return h.apply(null, ["div", { class: "wb-palette" }, legend].concat(sections));
  }

  // ---------------- day-builder UI (drop targets, day add/rename/remove) ----------------
  function dayEl(day, dayIndex) {
    var exList = day.exercises.map(function (ex, exIndex) {
      return h("div", { class: "wb-placed-ex" },
        h("span", {}, window.exName(ex)),
        h("button", { type: "button", class: "wb-remove-btn", on: { click: function () { removeExercise(dayIndex, exIndex); rerender(); } } }, "×"));
    });
    var isSelected = dayIndex === selectedDayIndex;
    // Tap-to-add target: tapping this header selects the day so the palette's
    // click-to-add chips (see paletteEl()) know where to place. Guarded on
    // an actual change so a click that merely focuses the already-selected
    // day's rename input doesn't rerender and steal focus mid-edit.
    var head = h("div", {
      class: "wb-day-head",
      on: { click: function () { if (selectedDayIndex !== dayIndex) { selectedDayIndex = dayIndex; rerender(); } } }
    },
      h("input", {
        class: "wb-day-name", value: day.name,
        on: { input: function (e) { day.name = e.target.value; } }
      }));
    return h("div", {
      class: "wb-day" + (isSelected ? " wb-day-selected" : ""),
      on: {
        dragover: function (e) { e.preventDefault(); },
        drop: function (e) { handleDrop(dayIndex, e); }
      }
    },
      head,
      h.apply(null, ["div", { class: "wb-day-list" }].concat(exList)),
      dropRejectDayIndex === dayIndex ? h("p", { class: "coach-err", role: "alert" }, s("wbDropRejected")) : null,
      plan.days.length > 1 ? h("button", {
        type: "button", class: "wb-remove-day", on: { click: function () { plan.days.splice(dayIndex, 1); rerender(); } }
      }, s("wbRemoveDay")) : null);
  }

  // Compact sticky bar for the currently-selected day: stays visible while
  // the (potentially long) palette above is scrolled, so the user can
  // drag/tap exercises into it without scrolling back up to find its real
  // card in daysEl(). It's a full drop target too (same drop handler as
  // the real day card), not just a label. Kept intentionally short (one
  // line) so it never permanently covers palette content.
  function stickyDayEl() {
    var day = plan.days[selectedDayIndex];
    if (!day) return null;
    return h("div", {
      class: "wb-sticky-day",
      on: {
        dragover: function (e) { e.preventDefault(); },
        drop: function (e) { handleDrop(selectedDayIndex, e); }
      }
    },
      h("span", { class: "wb-sticky-day-name" }, day.name),
      h("span", { class: "wb-sticky-day-count" }, day.exercises.length + " " + s("wbExercisesShort")));
  }

  function daysEl() {
    var dayEls = plan.days.map(function (d, i) { return dayEl(d, i); });
    var addBtn = h("button", {
      type: "button", class: "wb-add-day",
      on: { click: function () { plan.days.push({ name: "Day " + (plan.days.length + 1), exercises: [] }); rerender(); } }
    }, s("wbAddDay"));
    return h.apply(null, ["div", { class: "wb-days" }].concat(dayEls).concat([addBtn]));
  }

  // ---------------- mount (same pattern as coach.js's mount(): replaces #coachBody) ----------------
  // resetScroll is only true on the initial open() — every later rerender()
  // (drag-drop, day add/remove, filter toggle, …) must NOT jump the page
  // back to the top, or every drag becomes "scroll down again" (bug report).
  function mount(el, resetScroll) {
    var body = document.getElementById("coachBody");
    if (!body) return;
    body.innerHTML = "";
    body.appendChild(el);
    if (resetScroll) { try { window.scrollTo(0, 0); } catch (e) {} }
  }

  function rerender() {
    mount(screenEl(), false);
  }

  function screenEl() {
    // Clamp selectedDayIndex first, before anything below reads
    // plan.days[selectedDayIndex] — stickyDayEl() runs before daysEl() in
    // the children array below, so a clamp living only inside daysEl() (as
    // this used to be) left stickyDayEl() reading a stale/out-of-range
    // index for one render whenever a day was removed (e.g. the sticky bar
    // would blank out even though a valid day still exists at the clamped
    // index).
    if (selectedDayIndex >= plan.days.length) selectedDayIndex = plan.days.length - 1;
    if (selectedDayIndex < 0) selectedDayIndex = 0;
    var hasAnyExercise = plan.days.some(function (d) { return d.exercises.length > 0; });
    var children = [
      h("button", {
        type: "button", class: "coach-secondary",
        on: { click: function () { window.GymCoach && window.GymCoach.refresh(); } }
      }, s("wbBack")),
      h("h2", {}, s("wbTitle")),
      stickyDayEl(),
      h("div", { class: "wb-layout" }, paletteEl(), daysEl()),
      h("button", {
        type: "button", class: "coach-primary", disabled: !hasAnyExercise ? "disabled" : false,
        on: { click: function () {
          // Defensive: skip even if the disabled attribute is ever bypassed.
          if (!hasAnyExercise || !window.GymWorkoutBuilderSave) return;
          var ok = window.GymWorkoutBuilderSave(exportAsWorkoutPlan());
          if (ok) {
            saveFailedMsg = false; // navigates away (renderMyPlans) — no rerender here
          } else {
            saveFailedMsg = true;
            rerender();
          }
        } }
      }, s("wbSaveBtn"))
    ];
    if (saveFailedMsg) children.push(h("p", { class: "coach-err" }, s("wbSaveFull")));
    return h.apply(null, ["div", { class: "wb-screen" }].concat(children));
  }

  // ---------------- public API ----------------
  function open() {
    plan = newPlan();
    selectedDayIndex = 0;
    saveFailedMsg = false;
    dropRejectDayIndex = -1;
    mount(screenEl(), true);
  }

  function exportAsWorkoutPlan() {
    return {
      split: "Custom",
      days: plan.days.map(function (d) {
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
