/* food.js — the Food screen (Phase 3 / W2-B): local food catalog search +
 * per-user meal log, against gym-be's /foods and /meals (internal/food,
 * gym-be PR #13).
 *
 * Mirrors coach.js's shape: renders into #foodBody, owns its own small i18n
 * table (STR/s()/lang()) instead of reaching into app.js's global T (kept
 * separate so this file has zero overlap with the parallel rebrand branch's
 * edits inside app.js), its own tiny h() DOM helper, and exposes
 * window.GymFood.refresh() the same way ui.js already calls
 * window.GymCoach.refresh() on tab navigation and language switches.
 *
 * All API responses are per-user and per-date — nothing here is cached by
 * the service worker (API traffic is already excluded there) or mirrored
 * into localStorage; the backend is the source of truth for meals, unlike
 * the gym_-prefixed offline-first keys sync.js manages.
 *
 * Only two things are read from outside this file, both best-effort and
 * optional: window.GymSync.token()/isSignedIn() (auth) and
 * localStorage.gymcoach_last (the last AI assessment's computed macro
 * targets, if any — used only to draw a kcal progress bar; its absence
 * just means no target bar is shown). */
(function () {
  "use strict";

  var API_BASE = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var FOODS_URL = API_BASE + "/foods";
  var MEALS_URL = API_BASE + "/meals";
  var FETCH_TIMEOUT_MS = 15000;
  var SEARCH_DEBOUNCE_MS = 350;
  var MIN_QUERY_LEN = 2;

  // Canonical order — mirrors gym-be's food.MealTypes exactly (internal/food/food.go).
  var MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "suhoor", "iftar"];

  // ---------------- i18n ----------------
  function lang() {
    try { if (window.activeLang === "ar") return "ar"; } catch (e) {}
    try { return localStorage.getItem("gym_lang") === "ar" ? "ar" : "en"; } catch (e) { return "en"; }
  }
  var STR = {
    teaseTitle: ["Track your meals", "تابع وجباتك"],
    teaseBody: ["Search a local food catalog, log a portion and see your daily totals against your coach targets.",
      "ابحث في قائمة أطعمة محلية، سجّل وجبتك وشاهد إجماليك اليومي مقابل أهداف مدربك."],
    teaseB1: ["Egyptian & Gulf foods, in Arabic and English", "أطعمة مصرية وخليجية، بالعربية والإنجليزية"],
    teaseB2: ["Daily kcal, protein, carbs & fat totals", "إجمالي السعرات والبروتين والكارب والدهون يومياً"],
    teaseB3: ["Grouped by meal — breakfast, lunch, dinner & more", "مقسّمة حسب الوجبة — فطار، غداء، عشاء والمزيد"],
    signIn: ["Sign in with Google", "سجّل الدخول عبر جوجل"],
    prevDay: ["Previous day", "اليوم السابق"],
    nextDay: ["Next day", "اليوم التالي"],
    today: ["Today", "اليوم"],
    yesterday: ["Yesterday", "أمس"],
    tomorrow: ["Tomorrow", "غداً"],
    kcal: ["kcal", "سعرة"],
    gram: ["g", "جم"],
    protein: ["Protein", "بروتين"],
    carbs: ["Carbs", "كارب"],
    fat: ["Fat", "دهون"],
    approxNote: ["Some totals are estimated, not lab-measured", "بعض القيم تقديرية وليست مقاسة معملياً"],
    approxTag: ["est.", "تقديري"],
    searchLabel: ["Add a food", "أضف طعاماً"],
    searchPlaceholder: ["Search foods…", "ابحث عن طعام…"],
    searchHint: ["Type at least 2 characters", "اكتب حرفين على الأقل"],
    searching: ["Searching…", "جارٍ البحث…"],
    noResults: ["No foods found", "لا توجد نتائج"],
    searchError: ["Couldn't search right now", "تعذّر البحث الآن"],
    retry: ["Retry", "إعادة المحاولة"],
    perHundred: ["/100g", "/100جم"],
    addBtn: ["Add", "إضافة"],
    adding: ["Adding…", "جارٍ الإضافة…"],
    cancel: ["Cancel", "إلغاء"],
    gramsLabel: ["Grams", "الجرامات"],
    mealTypeLabel: ["Meal", "الوجبة"],
    gramsError: ["Enter 1–3000", "أدخل 1–3000"],
    addError: ["Couldn't add this — try again", "تعذّرت الإضافة — حاول مرة أخرى"],
    addInvalid: ["That food or amount isn't valid", "هذا الطعام أو الكمية غير صالحة"],
    emptyDay: ["No meals logged for this day yet", "لا توجد وجبات مسجّلة لهذا اليوم بعد"],
    mealsError: ["Couldn't load meals right now", "تعذّر تحميل الوجبات الآن"],
    deleteMeal: ["Delete", "حذف"],
    deleteError: ["Couldn't delete — try again", "تعذّر الحذف — حاول مرة أخرى"],
    breakfast: ["Breakfast", "فطار"],
    lunch: ["Lunch", "غداء"],
    dinner: ["Dinner", "عشاء"],
    snack: ["Snack", "سناك"],
    suhoor: ["Suhoor", "سحور"],
    iftar: ["Iftar", "إفطار"]
  };
  function s(k) {
    var e = STR[k];
    return e ? e[lang() === "ar" ? 1 : 0] : k;
  }

  // ---------------- tiny DOM helper (same shape as coach.js's) ----------------
  function h(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k === "on" && attrs[k]) {
          Object.keys(attrs[k]).forEach(function (ev) { node.addEventListener(ev, attrs[k][ev]); });
        } else if (attrs[k] != null && attrs[k] !== false) node.setAttribute(k, attrs[k]);
      });
    }
    var put = function (x) {
      if (x == null || x === false) return;
      if (typeof x === "string") node.appendChild(document.createTextNode(x));
      else if (x && x.nodeType) node.appendChild(x);
    };
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (Array.isArray(c)) c.forEach(put);
      else put(c);
    }
    return node;
  }
  function mount(el) {
    var body = document.getElementById("foodBody");
    if (!body) return;
    body.innerHTML = "";
    body.appendChild(el);
  }

  function chevron(flip) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "20"); svg.setAttribute("height", "20");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = flip
      ? '<path fill="currentColor" d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/>'
      : '<path fill="currentColor" d="M15.41 7.41 10.83 12l4.58 4.59L14 18l-6-6 6-6z"/>';
    return svg;
  }
  function trashIcon() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "18"); svg.setAttribute("height", "18");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = '<path fill="currentColor" d="M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H4V5h4l1-2z"/>';
    return svg;
  }

  // ---------------- network ----------------
  function fetchTimeout(url, opts) {
    opts = opts || {};
    var c = new AbortController();
    var timer = setTimeout(function () { c.abort(); }, FETCH_TIMEOUT_MS);
    opts.signal = c.signal;
    return fetch(url, opts).finally(function () { clearTimeout(timer); });
  }
  function authToken() {
    return window.GymSync && GymSync.token ? GymSync.token() : null;
  }

  // ---------------- state ----------------
  function todayStr(offsetDays) { return window.GymDate.key(offsetDays); }
  function guessMealType() {
    var hr = new Date().getHours();
    if (hr < 11) return "breakfast";
    if (hr < 16) return "lunch";
    if (hr < 21) return "dinner";
    return "snack";
  }

  var state = {
    date: todayStr(0),
    meals: [],
    loadingMeals: false,
    mealsError: false,
    deletingId: null,
    deleteError: false,
    query: "",
    results: [],
    searching: false,
    searchError: false,
    addingFood: null,
    addFieldError: null,
    saveError: null,
    saving: false,
    draftGrams: null,
    draftMealType: null
  };
  var lastLoadedDate = null;
  var lastUserSub = null;
  var lastKnownToday = todayStr(0);
  var searchTimer = null;
  var searchSeq = 0;
  var stateEpoch = 0; // bumped by resetUserState() so in-flight requests from a
                       // previous user (sign-out/switch) can't land after we've
                       // already moved on to the next one

  // Per-user cache key. gym_user_sub is sync.js's device-local record of the
  // signed-in account's JWT `sub`; it's cleared on sign-out (sync.js:554) and
  // rewritten on sign-in. We don't rely on sync.js's own account-switch reload
  // (acceptToken() only reloads when a DIFFERENT sub was already stored — a
  // sign-out that clears it first, followed by a different Google account,
  // leaves storedSub null and skips that reload entirely), so food.js tracks
  // the sub itself and wipes anything cached in memory whenever it changes,
  // including to/from signed-out.
  function currentUserSub() {
    try { return localStorage.getItem("gym_user_sub") || null; } catch (e) { return null; }
  }
  function resetUserState() {
    state.meals = [];
    state.loadingMeals = false;
    state.mealsError = false;
    state.deletingId = null;
    state.deleteError = false;
    state.query = "";
    state.results = [];
    state.searching = false;
    state.searchError = false;
    state.addingFood = null;
    state.addFieldError = null;
    state.saveError = null;
    state.saving = false;
    state.draftGrams = null;
    state.draftMealType = null;
    lastLoadedDate = null;
    searchSeq++; // invalidate any in-flight search started by the previous user
    stateEpoch++; // invalidate any in-flight load/search/add started by the previous user
  }

  function foodName(f) {
    var en = f.nameEn || "", ar = f.nameAr || "";
    return lang() === "ar" ? (ar || en) : (en || ar);
  }
  function servingHint(f) {
    var srv = f.serving;
    if (!srv || !srv.grams) return "";
    var label = lang() === "ar" ? srv.labelAr : srv.labelEn;
    return Math.round(srv.grams) + s("gram") + (label ? " (" + label + ")" : "");
  }
  function dateLabel(dateStr) {
    if (dateStr === todayStr(0)) return s("today");
    if (dateStr === todayStr(-1)) return s("yesterday");
    if (dateStr === todayStr(1)) return s("tomorrow");
    try {
      var d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString(lang() === "ar" ? "ar-EG" : "en-US", { weekday: "short", month: "short", day: "numeric" });
    } catch (e) { return dateStr; }
  }

  function targetInfo() {
    try {
      var raw = localStorage.getItem("gymcoach_last");
      if (!raw) return null;
      var last = JSON.parse(raw);
      if (last && last.computed && last.computed.targetKcal) return last.computed;
    } catch (e) {}
    return null;
  }

  function sumTotals(meals) {
    var t = { kcal: 0, protein: 0, carbs: 0, fat: 0, approximate: false };
    meals.forEach(function (m) {
      var n = m.nutrients || {};
      t.kcal += n.kcal || 0;
      t.protein += n.protein || 0;
      t.carbs += n.carbs || 0;
      t.fat += n.fat || 0;
      if (m.approximate) t.approximate = true;
    });
    return t;
  }

  // ---------------- network actions ----------------
  function loadMeals() {
    var myDate = state.date;
    var myEpoch = stateEpoch;
    lastLoadedDate = myDate;
    state.loadingMeals = true;
    state.mealsError = false;
    paintTotals(); paintMeals();
    var token = authToken();
    if (!token) {
      state.loadingMeals = false;
      if (window.GymUI) GymUI.promptSignIn();
      paintMeals();
      return;
    }
    fetchTimeout(MEALS_URL + "?date=" + encodeURIComponent(myDate), {
      headers: { "Authorization": "Bearer " + token }
    }).then(function (res) {
      if (res.status === 401) { if (window.GymUI) GymUI.promptSignIn(); return null; }
      if (!res.ok) throw new Error("meals GET " + res.status);
      return res.json();
    }).then(function (body) {
      // a later loadMeals() for a different date/user already superseded this
      if (myEpoch !== stateEpoch || myDate !== state.date) return;
      state.loadingMeals = false;
      if (!body) return;
      state.meals = Array.isArray(body.meals) ? body.meals : [];
      paintTotals(); paintMeals();
    }).catch(function () {
      if (myEpoch !== stateEpoch || myDate !== state.date) return;
      state.loadingMeals = false;
      state.mealsError = true;
      state.meals = [];
      paintTotals(); paintMeals();
    });
  }

  function runSearch(q) {
    var mySeq = ++searchSeq;
    state.searching = true;
    state.searchError = false;
    paintSearch();
    var token = authToken();
    if (!token) { state.searching = false; if (window.GymUI) GymUI.promptSignIn(); paintSearch(); return; }
    fetchTimeout(FOODS_URL + "?q=" + encodeURIComponent(q) + "&limit=20", {
      headers: { "Authorization": "Bearer " + token }
    }).then(function (res) {
      if (res.status === 401) { if (window.GymUI) GymUI.promptSignIn(); return null; }
      if (!res.ok) throw new Error("foods GET " + res.status);
      return res.json();
    }).then(function (body) {
      if (mySeq !== searchSeq) return; // a newer keystroke's search already superseded this
      state.searching = false;
      if (!body) return;
      state.results = Array.isArray(body.foods) ? body.foods : [];
      paintSearch();
    }).catch(function () {
      if (mySeq !== searchSeq) return;
      state.searching = false;
      state.searchError = true;
      state.results = [];
      paintSearch();
    });
  }

  function scheduleSearch() {
    if (searchTimer) clearTimeout(searchTimer);
    var q = state.query.trim();
    if (q.length < MIN_QUERY_LEN) {
      searchSeq++; // invalidate any in-flight search
      state.results = [];
      state.searching = false;
      state.searchError = false;
      paintSearch();
      return;
    }
    searchTimer = setTimeout(function () { runSearch(q); }, SEARCH_DEBOUNCE_MS);
  }

  function selectFood(food) {
    state.addingFood = food;
    state.addFieldError = null;
    state.saveError = null;
    state.draftGrams = String((food.serving && food.serving.grams) ? Math.round(food.serving.grams) : 100);
    state.draftMealType = guessMealType();
    paintSearch();
    var gramsEl = document.getElementById("foodGramsInput");
    if (gramsEl) gramsEl.focus();
  }
  function cancelAdd() {
    state.addingFood = null;
    state.addFieldError = null;
    state.saveError = null;
    state.saving = false;
    state.draftGrams = null;
    state.draftMealType = null;
    paintSearch();
    var input = document.getElementById("foodSearchInput");
    if (input) input.focus();
  }

  function confirmAdd() {
    var food = state.addingFood;
    if (!food || state.saving) return;
    var grams = parseFloat(state.draftGrams);
    if (!(grams >= 1 && grams <= 3000)) {
      state.addFieldError = s("gramsError");
      paintSearch();
      return;
    }
    var mealType = state.draftMealType || MEAL_TYPES[0];
    var myEpoch = stateEpoch;
    state.saving = true;
    state.addFieldError = null;
    state.saveError = null;
    paintSearch();
    var token = authToken();
    if (!token) { state.saving = false; if (window.GymUI) GymUI.promptSignIn(); paintSearch(); return; }
    fetchTimeout(MEALS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ date: state.date, mealType: mealType, foodId: food.id, grams: grams })
    }).then(function (res) {
      if (res.status === 401) { if (window.GymUI) GymUI.promptSignIn(); return null; }
      if (res.status === 422) return Promise.reject({ invalid: true });
      if (!res.ok) return Promise.reject({ invalid: false });
      return res.json();
    }).then(function (meal) {
      if (myEpoch !== stateEpoch) return; // superseded by a sign-out/user switch
      state.saving = false;
      if (!meal) { paintSearch(); return; }
      // Only splice into the currently-displayed day: the user may have
      // navigated to a different date while this POST was in flight.
      if (meal.date === state.date) {
        state.meals.push(meal);
        paintTotals(); paintMeals();
      }
      state.addingFood = null;
      state.draftGrams = null;
      state.draftMealType = null;
      state.query = "";
      state.results = [];
      var input = document.getElementById("foodSearchInput");
      if (input) input.value = "";
      paintSearch();
      if (input) input.focus();
    }).catch(function (err) {
      if (myEpoch !== stateEpoch) return;
      state.saving = false;
      state.saveError = (err && err.invalid) ? s("addInvalid") : s("addError");
      paintSearch();
    });
  }

  function deleteMeal(id) {
    if (state.deletingId) return;
    var idx = -1;
    for (var i = 0; i < state.meals.length; i++) { if (state.meals[i].id === id) { idx = i; break; } }
    if (idx === -1) return;
    state.deletingId = id;
    state.deleteError = false;
    paintMeals();
    var token = authToken();
    if (!token) { state.deletingId = null; if (window.GymUI) GymUI.promptSignIn(); paintMeals(); return; }
    fetchTimeout(MEALS_URL + "/" + encodeURIComponent(id), {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + token }
    }).then(function (res) {
      if (res.status === 401) { if (window.GymUI) GymUI.promptSignIn(); return Promise.reject({ silent: true }); }
      if (res.status !== 204 && res.status !== 404 && !res.ok) return Promise.reject({ silent: false });
    }).then(function () {
      var i = -1;
      for (var k = 0; k < state.meals.length; k++) { if (state.meals[k].id === id) { i = k; break; } }
      if (i !== -1) state.meals.splice(i, 1);
      state.deletingId = null;
      paintTotals(); paintMeals();
      focusMealsHost(); // the deleted row's button (and its focus) is gone
    }).catch(function (err) {
      state.deletingId = null;
      if (!(err && err.silent)) state.deleteError = true;
      paintMeals();
      focusMealsHost();
    });
  }
  function focusMealsHost() {
    // Only reclaim focus if it was actually dropped (innerHTML clearing the
    // removed button resets it to <body>) — don't steal it if the user has
    // since focused something else.
    if (document.activeElement && document.activeElement !== document.body) return;
    var host = document.getElementById("foodMealsHost");
    if (host) host.focus();
  }

  function shiftDate(delta) {
    var d = new Date(state.date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    var y = d.getFullYear(), m = ("0" + (d.getMonth() + 1)).slice(-2), day = ("0" + d.getDate()).slice(-2);
    state.date = y + "-" + m + "-" + day;
    state.query = "";
    state.results = [];
    state.addingFood = null;
    state.searchError = false;
    state.deleteError = false;
    state.saving = false;
    state.draftGrams = null;
    state.draftMealType = null;
    render();
    loadMeals();
  }

  // ---------------- painters (partial repaint — never touches the live
  // search <input> so typing never loses focus/caret) ----------------
  function statTile(label, value, unit) {
    return h("div", { class: "coach-stat" },
      h("div", { class: "coach-stat-v" }, String(Math.round(value || 0)), unit ? h("span", {}, " " + unit) : null),
      h("div", { class: "coach-stat-l" }, label));
  }

  function paintTotals() {
    var host = document.getElementById("foodTotalsHost");
    if (!host) return;
    host.innerHTML = "";
    var totals = sumTotals(state.meals);
    var target = targetInfo();
    var kids = [
      h("div", { class: "coach-stats" },
        statTile(s("kcal"), totals.kcal, s("kcal")),
        statTile(s("protein"), totals.protein, s("gram")),
        statTile(s("carbs"), totals.carbs, s("gram")),
        statTile(s("fat"), totals.fat, s("gram")))
    ];
    if (target && target.targetKcal) {
      var pct = Math.max(0, Math.min(100, Math.round((totals.kcal / target.targetKcal) * 100)));
      kids.push(h("div", { class: "food-progress" },
        // ⁦…⁩ (FSI/PDI) isolate the "N / N" ratio so the bidi
        // algorithm never reorders it inside an RTL (Arabic) paragraph —
        // without this, "248 / 2200" visually flips to "2200 / 248".
        h("div", { class: "food-progress-label" },
          "⁦" + Math.round(totals.kcal) + " / " + Math.round(target.targetKcal) + "⁩ " + s("kcal")),
        h("div", { class: "food-progress-track" },
          h("div", { class: "food-progress-fill", style: "--p:" + (pct / 100) }))));
    }
    if (totals.approximate) {
      kids.push(h("div", { class: "food-approx-note" }, s("approxNote")));
    }
    host.appendChild(h("div", { class: "food-totals card-fx" }, kids));
  }

  function mealRow(m) {
    var meta = Math.round(m.grams) + s("gram") + " · " + Math.round((m.nutrients && m.nutrients.kcal) || 0) + " " + s("kcal");
    if (m.approximate) meta += " · " + s("approxTag");
    return h("div", { class: "food-meal-row" },
      h("div", { class: "food-meal-info" },
        h("div", { class: "food-meal-name" }, foodName(m)),
        h("div", { class: "food-meal-meta" }, meta)),
      h("button", {
        type: "button", class: "food-del-btn", "aria-label": s("deleteMeal") + " " + foodName(m),
        disabled: state.deletingId === m.id,
        on: { click: function () { deleteMeal(m.id); } }
      }, trashIcon()));
  }

  function paintMeals() {
    var host = document.getElementById("foodMealsHost");
    if (!host) return;
    host.innerHTML = "";
    if (state.loadingMeals) {
      var rows = [];
      for (var i = 0; i < 3; i++) rows.push(h("div", { class: "skeleton", style: "height:52px;margin-bottom:10px" }));
      host.appendChild(h("div", {}, rows));
      return;
    }
    if (state.mealsError) {
      host.appendChild(h("div", { class: "food-error", role: "status", "aria-live": "polite" },
        h("span", {}, s("mealsError")),
        h("button", { type: "button", class: "coach-link", on: { click: loadMeals } }, s("retry"))));
      return;
    }
    if (state.deleteError) {
      host.appendChild(h("div", { class: "food-error", role: "status", "aria-live": "polite" }, s("deleteError")));
    }
    if (!state.meals.length) {
      host.appendChild(h("div", { class: "food-empty" }, s("emptyDay")));
      return;
    }
    var wrap = h("div", { class: "food-meal-groups" });
    MEAL_TYPES.forEach(function (mt) {
      var entries = state.meals.filter(function (m) { return m.mealType === mt; });
      if (!entries.length) return;
      wrap.appendChild(h("div", { class: "food-meal-group" },
        h("div", { class: "food-meal-group-title" }, s(mt)),
        h("div", { class: "food-meal-list" }, entries.map(mealRow))));
    });
    host.appendChild(wrap);
  }

  function resultRow(food) {
    var meta = Math.round((food.per100g && food.per100g.kcal) || 0) + " " + s("kcal") + s("perHundred");
    var srv = servingHint(food);
    if (srv) meta += " · " + srv;
    return h("button", {
      type: "button", class: "food-result-row",
      on: { click: function () { selectFood(food); } }
    }, h("div", { class: "food-result-name" }, foodName(food)),
       h("div", { class: "food-result-meta" }, meta));
  }

  function addPanel() {
    var food = state.addingFood;
    // Render from the draft in state, not fresh defaults — otherwise every
    // repaint (a validation error, a failed save) would silently discard
    // whatever grams/meal-type the user had already entered.
    var mealSelect = h("select", {
      id: "foodMealTypeSelect", class: "",
      on: { change: function (e) { state.draftMealType = e.target.value; } }
    },
      MEAL_TYPES.map(function (mt) {
        return h("option", { value: mt, selected: mt === state.draftMealType ? "selected" : false }, s(mt));
      }));
    var kids = [
      h("div", { class: "food-add-name" }, foodName(food)),
      h("div", { class: "coach-row" },
        h("div", { class: "coach-field" },
          h("label", { class: "coach-field-l", for: "foodGramsInput" }, s("gramsLabel")),
          h("input", {
            id: "foodGramsInput", type: "number", min: "1", max: "3000", step: "1", value: String(state.draftGrams),
            on: { input: function (e) { state.draftGrams = e.target.value; } }
          })),
        h("div", { class: "coach-field" },
          h("label", { class: "coach-field-l", for: "foodMealTypeSelect" }, s("mealTypeLabel")),
          mealSelect))
    ];
    if (state.addFieldError) kids.push(h("div", { class: "coach-err", role: "status", "aria-live": "polite" }, state.addFieldError));
    if (state.saveError) kids.push(h("div", { class: "coach-err", role: "status", "aria-live": "polite" }, state.saveError));
    kids.push(h("div", { class: "coach-row food-add-actions" },
      h("button", { type: "button", class: "coach-secondary", on: { click: cancelAdd } }, s("cancel")),
      h("button", {
        type: "button", class: "coach-primary", disabled: state.saving,
        on: { click: confirmAdd }
      }, state.saving ? s("adding") : s("addBtn"))));
    return h("div", { class: "food-add-panel" }, kids);
  }

  function paintSearch() {
    var host = document.getElementById("foodSearchResultsHost");
    if (!host) return;
    host.innerHTML = "";
    if (state.addingFood) { host.appendChild(addPanel()); return; }
    if (state.searching) {
      host.appendChild(h("div", { class: "food-search-hint", role: "status", "aria-live": "polite" }, s("searching")));
      return;
    }
    if (state.searchError) {
      host.appendChild(h("div", { class: "food-error", role: "status", "aria-live": "polite" },
        h("span", {}, s("searchError")),
        h("button", {
          type: "button", class: "coach-link",
          on: { click: function () { var q = state.query.trim(); if (q.length >= MIN_QUERY_LEN) runSearch(q); } }
        }, s("retry"))));
      return;
    }
    var q = state.query.trim();
    if (q.length < MIN_QUERY_LEN) {
      if (q.length > 0) host.appendChild(h("div", { class: "food-search-hint" }, s("searchHint")));
      return;
    }
    if (!state.results.length) {
      host.appendChild(h("div", { class: "food-search-hint", role: "status", "aria-live": "polite" }, s("noResults")));
      return;
    }
    host.appendChild(h("div", { class: "food-result-list" }, state.results.map(resultRow)));
  }

  function onSearchInput(e) {
    state.query = e.target.value;
    scheduleSearch();
  }

  // ---------------- teaser (signed-out) ----------------
  function renderTeaser() {
    var bullets = h("ul", { class: "coach-bullets" },
      h("li", {}, s("teaseB1")), h("li", {}, s("teaseB2")), h("li", {}, s("teaseB3")));
    var btn = h("button", {
      class: "coach-primary", type: "button",
      on: { click: function () { if (window.GymUI) GymUI.promptSignIn(); } }
    }, s("signIn"));
    mount(h("div", { class: "coach-teaser card-fx" },
      h("h2", {}, s("teaseTitle")),
      h("p", { class: "coach-tease-body" }, s("teaseBody")),
      bullets, btn));
  }

  // ---------------- full shell ----------------
  function render() {
    var shell = h("div", { class: "food-screen" },
      h("div", { class: "food-date-switch" },
        h("button", {
          type: "button", class: "coach-icon-btn food-date-btn prev", "aria-label": s("prevDay"),
          on: { click: function () { shiftDate(-1); } }
        }, chevron(false)),
        h("div", { class: "food-date-label" }, dateLabel(state.date)),
        h("button", {
          type: "button", class: "coach-icon-btn food-date-btn next", "aria-label": s("nextDay"),
          on: { click: function () { shiftDate(1); } }
        }, chevron(true))),
      h("div", { id: "foodTotalsHost" }),
      h("div", { class: "food-search card-fx" },
        h("div", { class: "coach-field" },
          h("label", { class: "coach-field-l", for: "foodSearchInput" }, s("searchLabel")),
          h("input", {
            id: "foodSearchInput", type: "search", inputmode: "search", autocomplete: "off",
            placeholder: s("searchPlaceholder"), value: state.query, maxlength: "64",
            on: { input: onSearchInput }
          })),
        h("div", { id: "foodSearchResultsHost" })),
      h("div", { id: "foodMealsHost", tabindex: "-1" }));
    mount(shell);
    paintTotals();
    paintSearch();
    paintMeals();
  }

  // ---------------- entry ----------------
  function refresh() {
    if (!document.getElementById("foodBody")) return;
    var authed = window.GymUI && GymUI.isAuthed && GymUI.isAuthed();
    var sub = authed ? currentUserSub() : null;
    if (sub !== lastUserSub) {
      // Sign-out or an account switch: sync.js's own reload-on-switch only
      // fires when a DIFFERENT sub was already stored (acceptToken() in
      // sync.js), so a sign-out (which clears gym_user_sub first) followed by
      // a different account never triggers it — wipe our own per-user cache
      // here so the next paint can't show one user's meals to another.
      resetUserState();
      lastUserSub = sub;
    }
    if (!authed) { renderTeaser(); return; }
    // If the tab was left open across midnight, "today" (and any date the
    // user hadn't navigated away from) should move forward with it.
    var freshToday = todayStr(0);
    if (freshToday !== lastKnownToday) {
      if (state.date === lastKnownToday) { state.date = freshToday; lastLoadedDate = null; }
      lastKnownToday = freshToday;
    }
    var needsLoad = (lastLoadedDate !== state.date);
    if (needsLoad) { state.loadingMeals = true; state.meals = []; }
    render();
    if (needsLoad) loadMeals();
  }

  // Re-tap on the active Food tab: retry only when the last meals load failed.
  function retryFailed() {
    if (state.mealsError && !state.loadingMeals && authToken()) loadMeals();
  }

  window.GymFood = { refresh: refresh, retryFailed: retryFailed };
})();
