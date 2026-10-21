/* survey.js — first-run survey for signed-in users (#survey).
 *
 * Opens once per account, when GET /me says onboardingCompleted:false.
 * One question per screen; answers go to PUT /api/v1/me/onboarding
 * (gym-be), then:
 *   - the matching starter plan is selected right away (sex x gym/home);
 *   - the coach form is filled from the answers (GymCoach.applySurvey);
 *   - "Build my AI plan" runs a normal coach assessment (its consent step
 *     and the 5-a-day limit apply as usual).
 * Guests never see it: they get a small sign-in hint on the Plan screen.
 *
 * Draft answers live in localStorage gym_survey_draft (local-only, wiped
 * on sign-out with the other gym_* keys). */
(function () {
  "use strict";

  var DRAFT_KEY = "gym_survey_draft";
  var LATER_KEY = "etq_survey_later";     // sessionStorage: "Later" tapped
  var HINT_KEY = "etq_guest_hint_closed"; // sessionStorage: guest hint closed

  var STR = {
    later: ["Later", "لاحقاً"],
    back: ["Back", "رجوع"],
    next: ["Next", "التالي"],
    stepOf: ["{n} of {t}", "{n} من {t}"],
    // goal
    qGoal: ["What's your main goal?", "ما هدفك الأساسي؟"],
    whyGoal: ["Sets your calories and training style.", "يحدد سعراتك وأسلوب تمرينك."],
    goal_lose_fat: ["Lose fat", "خسارة الدهون"],
    goal_gain_muscle: ["Build muscle", "بناء العضلات"],
    goal_recomp: ["Lose fat and build muscle", "خسارة دهون وبناء عضلات"],
    goal_maintain: ["Stay fit", "الحفاظ على لياقتي"],
    // sex
    qSex: ["Which plan fits you?", "أي خطة تناسبك؟"],
    whySex: ["Picks your exercise templates.", "يحدد قوالب تمارينك."],
    sex_male: ["Male", "رجالي"],
    sex_female: ["Female", "نسائي"],
    // age
    qAge: ["How old are you?", "كم عمرك؟"],
    whyAge: ["Used to estimate your daily calories.", "لتقدير سعراتك اليومية."],
    age: ["Age", "العمر"],
    years: ["years", "سنة"],
    errAge: ["Enter an age from 18 to 100.", "أدخل عمراً من 18 إلى 100."],
    errAgeMin: ["Etqadem is for people 18 and older.", "اتقدم للأشخاص من عمر 18 فما فوق."],
    // body
    qBody: ["Your height and weight", "طولك ووزنك"],
    whyBody: ["Saved to your profile. Change it any time.", "يُحفظ في ملفك. يمكنك تغييره في أي وقت."],
    height: ["Height", "الطول"],
    weight: ["Weight", "الوزن"],
    cm: ["cm", "سم"],
    kg: ["kg", "كجم"],
    errHeight: ["Height must be 120–230 cm.", "الطول بين 120 و230 سم."],
    errWeight: ["Weight must be 35–250 kg.", "الوزن بين 35 و250 كجم."],
    // experience
    qExp: ["How long have you trained?", "منذ متى وأنت تتمرن؟"],
    whyExp: ["Sets how hard your first weeks are.", "يحدد شدة أسابيعك الأولى."],
    exp_new: ["I'm new", "أنا مبتدئ"],
    exp_under_1y: ["Less than a year", "أقل من سنة"],
    exp_1_3y: ["1–3 years", "من 1 إلى 3 سنوات"],
    exp_3y_plus: ["3+ years", "أكثر من 3 سنوات"],
    // days
    qDays: ["Days a week you can train", "كم يوماً في الأسبوع تقدر تتمرن؟"],
    whyDays: ["Your plan fits this schedule.", "خطتك تناسب هذا الجدول."],
    // equipment
    qEquip: ["Where will you train?", "أين ستتمرن؟"],
    whyEquip: ["Picks exercises you can actually do.", "لاختيار تمارين تقدر تنفذها."],
    eq_full_gym: ["Gym", "جيم"],
    eq_home_minimal: ["Home, with some equipment", "البيت، مع بعض الأدوات"],
    eq_bodyweight: ["No equipment", "بدون أدوات"],
    // activity
    qAct: ["How active is your day?", "ما مدى نشاطك اليومي؟"],
    whyAct: ["Outside the gym. Adjusts your calories.", "خارج الجيم. يعدّل سعراتك."],
    act_sedentary: ["Mostly sitting", "جلوس معظم اليوم"],
    act_light: ["Some walking", "بعض المشي"],
    act_moderate: ["On my feet a lot", "واقف معظم اليوم"],
    act_active: ["Physical job", "عمل بدني"],
    act_athlete: ["Very active or sports", "نشاط عالٍ أو رياضة"],
    // diet
    qDiet: ["How do you like to eat?", "كيف تحب أن تأكل؟"],
    whyDiet: ["Shapes the meals the coach suggests.", "يشكّل الوجبات التي يقترحها المدرب."],
    diet_balanced: ["Balanced", "متوازن"],
    diet_high_protein: ["High protein", "بروتين عالٍ"],
    diet_low_carb: ["Low carb", "قليل الكربوهيدرات"],
    diet_keto: ["Keto", "كيتو"],
    diet_mediterranean: ["Mediterranean", "متوسطي"],
    diet_vegetarian: ["Vegetarian", "نباتي"],
    diet_vegan: ["Vegan", "نباتي صرف"],
    diet_halal: ["Halal focus", "حلال"],
    allergies: ["Food allergies (optional)", "حساسية من أطعمة (اختياري)"],
    allergiesPh: ["e.g. nuts, milk", "مثلاً: مكسرات، حليب"],
    // ramadan
    qRam: ["Fasting this Ramadan?", "هل ستصوم رمضان؟"],
    whyRam: ["We'll time meals and training around iftar.", "سنرتّب الوجبات والتمرين حول الإفطار."],
    yes: ["Yes", "نعم"],
    no: ["No", "لا"],
    // save + done
    saving: ["Saving your answers…", "جارٍ حفظ إجاباتك…"],
    saveErr: ["Couldn't save. Check your connection and try again.", "تعذّر الحفظ. تحقّق من الاتصال وحاول مجدداً."],
    retry: ["Try again", "حاول مجدداً"],
    doneTitle: ["You're all set", "كل شيء جاهز"],
    doneSub: ["Your starter plan is ready. The AI coach can tailor it to you.", "خطتك المبدئية جاهزة. والمدرب الذكي يقدر يفصّلها لك."],
    starter: ["Starter plan", "الخطة المبدئية"],
    styleGym: ["Gym", "جيم"],
    styleHome: ["Home / bodyweight", "منزلي / وزن الجسم"],
    daysN: ["{n} days a week", "{n} أيام في الأسبوع"],
    buildAi: ["Build my AI plan", "ابنِ خطتي بالذكاء الاصطناعي"],
    buildAiNote: ["Uses 1 of today's 5 coach plans.", "يستخدم 1 من 5 خطط متاحة اليوم."],
    startStarter: ["Start with the starter plan", "ابدأ بالخطة المبدئية"],
    // guest hint
    hintText: ["Sign in to get a plan built for you and a quick tour of each screen.", "سجّل الدخول لتحصل على خطة مبنية لك وجولة سريعة في كل شاشة."],
    hintBtn: ["Sign in", "تسجيل الدخول"],
    close: ["Close", "إغلاق"]
  };

  function lang() { return document.documentElement.lang === "ar" ? "ar" : "en"; }
  function s(k, vars) {
    var v = STR[k] ? STR[k][lang() === "ar" ? 1 : 0] : k;
    if (vars) Object.keys(vars).forEach(function (n) { v = v.replace("{" + n + "}", vars[n]); });
    return v;
  }
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "on") Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      (Array.isArray(c) ? c : [c]).forEach(function (x) {
        if (x != null && x !== false) el.appendChild(typeof x === "string" ? document.createTextNode(x) : x);
      });
    }
    return el;
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

  // Ramadan question only around Ramadan: Hijri month 8 (Sha'ban) or 9.
  function nearRamadan() {
    try {
      var fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "numeric" });
      if (fmt.resolvedOptions().calendar !== "islamic-umalqura") return false;
      var part = fmt.formatToParts(new Date()).filter(function (p) { return p.type === "month"; })[0];
      var m = part ? parseInt(part.value, 10) : NaN;
      return m === 8 || m === 9;
    } catch (e) { return false; }
  }

  // ---------------- steps ----------------
  // kind "choice": tap to answer and move on. kind "form": fields + Next.
  function choice(key, q, why, field, values, prefix, opts) {
    return { key: key, kind: "choice", q: q, why: why, field: field, values: values, prefix: prefix, opts: opts || {} };
  }
  function steps() {
    var list = [
      choice("goal", "qGoal", "whyGoal", "goal", ["lose_fat", "gain_muscle", "recomp", "maintain"], "goal_"),
      choice("sex", "qSex", "whySex", "sex", ["male", "female"], "sex_"),
      { key: "age", kind: "form", q: "qAge", why: "whyAge" },
      { key: "body", kind: "form", q: "qBody", why: "whyBody" },
      choice("experience", "qExp", "whyExp", "experience", ["new", "under_1y", "1_3y", "3y_plus"], "exp_"),
      choice("days", "qDays", "whyDays", "trainingDaysPerWeek", [2, 3, 4, 5, 6], "", { grid: true }),
      choice("equipment", "qEquip", "whyEquip", "equipment", ["full_gym", "home_minimal", "bodyweight"], "eq_"),
      choice("activity", "qAct", "whyAct", "activityLevel", ["sedentary", "light", "moderate", "active", "athlete"], "act_"),
      { key: "diet", kind: "form", q: "qDiet", why: "whyDiet" }
    ];
    if (nearRamadan()) list.push(choice("ramadan", "qRam", "whyRam", "ramadan", [true, false], "", { yesNo: true }));
    return list;
  }
  var DIETS = ["balanced", "high_protein", "low_carb", "keto", "mediterranean", "vegetarian", "vegan", "halal"];

  // ---------------- state ----------------
  var root = null;      // #survey
  var card = null;
  var state = null;     // { step, a: answers }
  var STEPS = [];
  var opening = false;
  var lastFocus = null;

  function loadDraft() {
    try {
      var d = JSON.parse(lsGet(DRAFT_KEY));
      if (d && typeof d === "object" && d.a) return d;
    } catch (e) {}
    return { step: 0, a: { dietPreference: "balanced", allergies: [] } };
  }
  function saveDraft() { lsSet(DRAFT_KEY, JSON.stringify(state)); }

  function isOpen() { return !!(root && !root.hidden); }

  function open() {
    if (isOpen() || opening) return;
    opening = true;
    STEPS = steps();
    state = loadDraft();
    if (!(state.step >= 0)) state.step = 0;
    if (state.step >= STEPS.length) state.step = STEPS.length - 1; // resume on the last question
    ensureRoot();
    lastFocus = document.activeElement;
    root.hidden = false;
    document.body.classList.add("survey-open");
    if (window.GymMotion && GymMotion.show) { root.hidden = true; GymMotion.show(root); }
    render(0);
    opening = false;
  }

  function close() {
    if (!root) return;
    document.body.classList.remove("survey-open");
    if (window.GymMotion && GymMotion.hide) GymMotion.hide(root); else root.hidden = true;
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }

  function later() {
    ssSet(LATER_KEY, "1");
    close();
  }

  function ensureRoot() {
    if (root) return;
    root = h("section", { id: "survey", class: "m-ovl", role: "dialog", "aria-modal": "true", "aria-labelledby": "svyQ", hidden: true });
    card = h("div", { class: "svy-card m-ovl-card" });
    root.appendChild(card);
    root.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); if (state && state.step < STEPS.length) later(); }
    });
    document.body.appendChild(root);
  }

  // dir: 1 forward, -1 back, 0 none
  function render(dir) {
    card.innerHTML = "";
    if (state.step >= STEPS.length) { renderSave(); return; }
    var st = STEPS[state.step];
    var total = STEPS.length;
    var pct = Math.round((state.step / total) * 100);

    var top = h("div", { class: "svy-top" },
      h("button", { type: "button", class: "svy-icon svy-back", "aria-label": s("back"), hidden: state.step === 0 ? true : null,
        on: { click: function () { go(-1); } } }),
      h("div", { class: "svy-progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(total),
        "aria-valuenow": String(state.step), "aria-label": s("stepOf", { n: state.step + 1, t: total }) },
        h("span", { class: "svy-progress-fill", style: "width:" + pct + "%" })),
      h("button", { type: "button", class: "svy-later", on: { click: later } }, s("later")));

    var body = h("div", { class: "svy-body" + (dir ? " svy-in" : ""), style: "--svy-dir:" + (dir || 1) },
      h("p", { class: "svy-count" }, s("stepOf", { n: state.step + 1, t: total })),
      h("h2", { class: "svy-q", id: "svyQ" }, s(st.q)),
      h("p", { class: "svy-why" }, s(st.why)),
      st.kind === "choice" ? renderChoice(st) : renderForm(st));

    card.appendChild(top);
    card.appendChild(body);
    var f = body.querySelector(".svy-opt.on") || body.querySelector("input, .svy-opt, button");
    if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
  }

  function go(delta) {
    state.step = Math.max(0, state.step + delta);
    saveDraft();
    render(delta);
  }

  function renderChoice(st) {
    var cur = state.a[st.field];
    var wrap = h("div", { class: "svy-opts" + (st.opts.grid ? " svy-grid" : ""), role: "radiogroup", "aria-labelledby": "svyQ" });
    st.values.forEach(function (v) {
      var label = st.opts.yesNo ? s(v ? "yes" : "no") : (st.prefix ? s(st.prefix + v) : String(v));
      var on = cur === v;
      wrap.appendChild(h("button", {
        type: "button", class: "svy-opt" + (on ? " on" : ""), role: "radio", "aria-checked": on ? "true" : "false",
        on: { click: function (e) {
          state.a[st.field] = v;
          wrap.querySelectorAll(".svy-opt").forEach(function (b) { b.classList.remove("on"); b.setAttribute("aria-checked", "false"); });
          e.currentTarget.classList.add("on");
          e.currentTarget.setAttribute("aria-checked", "true");
          saveDraft();
          // short beat so the tap registers visually before moving on
          setTimeout(function () { go(1); }, 180);
        } }
      }, h("span", { class: "svy-opt-label" }, label)));
    });
    return wrap;
  }

  function numField(id, labelKey, unitKey, value, min, max) {
    return h("label", { class: "svy-field", for: id },
      h("span", { class: "svy-label" }, s(labelKey)),
      h("span", { class: "svy-input-wrap" },
        h("input", { id: id, type: "number", inputmode: "decimal", min: String(min), max: String(max), step: "any",
          value: value == null ? "" : String(value), dir: "ltr" }),
        h("span", { class: "svy-unit" }, s(unitKey))));
  }

  function renderForm(st) {
    var err = h("p", { class: "svy-err", role: "alert" });
    var form = h("form", { class: "svy-form", novalidate: true });
    var check;
    if (st.key === "age") {
      form.appendChild(numField("svyAge", "age", "years", state.a.age, 18, 100));
      check = function () {
        var v = parseInt(form.querySelector("#svyAge").value, 10);
        if (!isFinite(v) || v > 100 || v < 1) return s("errAge");
        if (v < 18) return s("errAgeMin");
        state.a.age = v;
        return "";
      };
    } else if (st.key === "body") {
      form.appendChild(numField("svyH", "height", "cm", state.a.heightCm, 120, 230));
      form.appendChild(numField("svyW", "weight", "kg", state.a.weightKg, 35, 250));
      check = function () {
        var hc = parseFloat(form.querySelector("#svyH").value);
        var wk = parseFloat(form.querySelector("#svyW").value);
        if (!(hc >= 120 && hc <= 230)) return s("errHeight");
        if (!(wk >= 35 && wk <= 250)) return s("errWeight");
        state.a.heightCm = Math.round(hc);
        state.a.weightKg = Math.round(wk * 10) / 10;
        return "";
      };
    } else if (st.key === "diet") {
      var chips = h("div", { class: "svy-chips", role: "radiogroup", "aria-labelledby": "svyQ" });
      DIETS.forEach(function (d) {
        var on = (state.a.dietPreference || "balanced") === d;
        chips.appendChild(h("button", { type: "button", class: "svy-chip" + (on ? " on" : ""), role: "radio", "aria-checked": on ? "true" : "false",
          on: { click: function (e) {
            state.a.dietPreference = d;
            chips.querySelectorAll(".svy-chip").forEach(function (b) { b.classList.remove("on"); b.setAttribute("aria-checked", "false"); });
            e.currentTarget.classList.add("on");
            e.currentTarget.setAttribute("aria-checked", "true");
            saveDraft();
          } } }, s("diet_" + d)));
      });
      form.appendChild(chips);
      form.appendChild(h("label", { class: "svy-field", for: "svyAll" },
        h("span", { class: "svy-label" }, s("allergies")),
        h("input", { id: "svyAll", type: "text", maxlength: "300", placeholder: s("allergiesPh"),
          value: (state.a.allergies || []).join(", ") })));
      check = function () {
        state.a.allergies = form.querySelector("#svyAll").value.split(/[,،]/)
          .map(function (x) { return x.trim().slice(0, 40); }).filter(Boolean).slice(0, 10);
        if (!state.a.dietPreference) state.a.dietPreference = "balanced";
        return "";
      };
    }
    form.appendChild(err);
    form.appendChild(h("button", { type: "submit", class: "svy-next" }, s("next")));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = check();
      err.textContent = msg;
      if (msg) return;
      saveDraft();
      go(1);
    });
    return form;
  }

  // ---------------- save + done ----------------
  function payload() {
    var a = state.a;
    return {
      goal: a.goal, sex: a.sex, age: a.age, heightCm: a.heightCm, weightKg: a.weightKg,
      experience: a.experience, trainingDaysPerWeek: a.trainingDaysPerWeek, equipment: a.equipment,
      activityLevel: a.activityLevel, dietPreference: a.dietPreference || "balanced",
      allergies: a.allergies || [], ramadan: a.ramadan === true
    };
  }

  // First question still unanswered, or -1 when everything is filled in.
  function firstMissing() {
    var a = state.a;
    for (var i = 0; i < STEPS.length; i++) {
      var st = STEPS[i];
      if (st.kind === "choice" && a[st.field] === undefined) return i;
      if (st.key === "age" && !a.age) return i;
      if (st.key === "body" && (!a.heightCm || !a.weightKg)) return i;
    }
    return -1;
  }

  function renderSave() {
    var miss = firstMissing();
    if (miss !== -1) { state.step = miss; saveDraft(); render(-1); return; }
    card.appendChild(h("div", { class: "svy-body svy-center", role: "status" },
      h("div", { class: "coach-spin", "aria-hidden": "true" }),
      h("p", { class: "svy-why" }, s("saving"))));
    var body = payload();
    var req = window.GymHeader && GymHeader.api
      ? GymHeader.api("/me/onboarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : Promise.reject(new Error("no api"));
    req.then(function (res) {
      if (!res.ok) throw new Error("onboarding " + res.status);
      return res.json();
    }).then(function () {
      applyLocally(body);
      lsDel(DRAFT_KEY);
      if (window.GymHeader && GymHeader.setMe) GymHeader.setMe({ onboardingCompleted: true });
      renderDone(body);
    }).catch(function () {
      card.innerHTML = "";
      card.appendChild(h("div", { class: "svy-body svy-center" },
        h("p", { class: "svy-err", role: "alert" }, s("saveErr")),
        h("button", { type: "button", class: "svy-next", on: { click: function () { card.innerHTML = ""; renderSave(); } } }, s("retry")),
        h("button", { type: "button", class: "svy-ghost", on: { click: function () { state.step = STEPS.length - 1; render(-1); } } }, s("back"))));
    });
  }

  function styleFor(eq) { return eq === "full_gym" ? "gym" : "cal"; }

  // Starter plan + coach form, so both are ready before the user leaves.
  function applyLocally(a) {
    try { if (window.GymSetPlan) GymSetPlan(a.sex, styleFor(a.equipment)); } catch (e) {}
    try { if (window.GymCoach && GymCoach.applySurvey) GymCoach.applySurvey(a); } catch (e) {}
  }

  function renderDone(a) {
    card.innerHTML = "";
    var styleLabel = s(styleFor(a.equipment) === "gym" ? "styleGym" : "styleHome");
    card.appendChild(h("div", { class: "svy-body svy-in svy-done", style: "--svy-dir:1" },
      h("div", { class: "svy-check", "aria-hidden": "true" }),
      h("h2", { class: "svy-q", id: "svyQ" }, s("doneTitle")),
      h("p", { class: "svy-why" }, s("doneSub")),
      h("div", { class: "svy-summary" },
        h("span", { class: "svy-sum-label" }, s("starter")),
        h("span", { class: "svy-sum-val" }, s("sex_" + a.sex) + " · " + styleLabel),
        h("span", { class: "svy-sum-meta" }, s("goal_" + a.goal) + " · " + s("daysN", { n: a.trainingDaysPerWeek }))),
      h("button", { type: "button", class: "svy-next", on: { click: function () {
        close();
        if (window.GymUI && GymUI.navigate) GymUI.navigate("coach");
        if (window.GymCoach && GymCoach.runSurveyPlan) GymCoach.runSurveyPlan();
      } } }, s("buildAi")),
      h("p", { class: "svy-note" }, s("buildAiNote")),
      h("button", { type: "button", class: "svy-ghost", on: { click: function () {
        close();
        if (window.GymUI && GymUI.navigate) GymUI.navigate("plan");
      } } }, s("startStarter"))));
    var b = card.querySelector(".svy-next");
    if (b) try { b.focus({ preventScroll: true }); } catch (e) {}
  }

  // ---------------- triggers ----------------
  function maybeOpen() {
    var me = window.GymHeader && GymHeader.me ? GymHeader.me() : null;
    if (!me || me.onboardingCompleted !== false) return;
    if (!(window.GymHeader && GymHeader.isAuthed())) return;
    if (ssGet(LATER_KEY) === "1") return;
    if (document.body.classList.contains("onboarding-open")) return;
    open();
  }

  // ---------------- guest hint (Plan screen) ----------------
  function isGuest() {
    return lsGet("gym_anon") === "1" && !(window.GymHeader && GymHeader.isAuthed && GymHeader.isAuthed());
  }
  function renderHint() {
    var old = document.getElementById("guestHint");
    var show = isGuest() && ssGet(HINT_KEY) !== "1";
    if (!show) { if (old) old.remove(); return; }
    var hero = document.querySelector("#screen-plan header.hero");
    if (!hero) return;
    if (old) {
      if (old.getAttribute("data-lang") === lang()) return;
      old.remove();
    }
    var hint = h("div", { id: "guestHint", class: "guest-hint", role: "note", "data-lang": lang() },
      h("p", { class: "guest-hint-text" }, s("hintText")),
      h("button", { type: "button", class: "guest-hint-btn", on: { click: function () {
        if (window.GymUI && GymUI.promptSignIn) GymUI.promptSignIn();
      } } }, s("hintBtn")),
      h("button", { type: "button", class: "guest-hint-x", "aria-label": s("close"), on: { click: function () {
        ssSet(HINT_KEY, "1");
        hint.remove();
      } } }));
    hero.insertAdjacentElement("afterend", hint);
  }

  function init() {
    if (window.GymHeader && GymHeader.onChange) GymHeader.onChange(function () { maybeOpen(); renderHint(); });
    // The sign-in screen may still be up when /me lands; try again once it closes.
    new MutationObserver(function () { maybeOpen(); renderHint(); })
      .observe(document.body, { attributes: true, attributeFilter: ["class"] });
    // Re-translate on language change.
    new MutationObserver(function () {
      if (isOpen() && state) { if (state.step < STEPS.length) render(0); }
      renderHint();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    renderHint();
    maybeOpen();
  }

  window.GymSurvey = { open: open, close: close, isOpen: isOpen };

  // Deferred scripts run before DOMContentLoaded; wait for it so header.js
  // (GymHeader), coach.js and app.js have all loaded.
  if (document.readyState === "complete") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
