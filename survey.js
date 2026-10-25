/* survey.js — first-run survey for signed-in users (#survey).
 *
 * Opens once per account, when GET /me says onboardingCompleted:false.
 * Step 0 is a consent screen (lawyer review 2026-10-22): "Agree and continue"
 * records POST /me/consents {type:"onboarding"}; nothing is sent to the
 * server before that, and "Not now" sends nothing at all (the default
 * starter plan stays; the survey stops auto-opening and a card on the Plan
 * screen offers it again). One question per screen; answers go to
 * PUT /api/v1/me/onboarding (gym-be), which answers 403 consent_required
 * without an active consent (the consent screen then shows again), then:
 *   - the matching starter plan is selected right away (sex x gym/home);
 *   - the coach form is filled from the answers (GymCoach.applySurvey);
 *   - "Build my AI plan" runs a normal coach assessment (its consent step
 *     and the 5-a-day limit apply as usual).
 * Guests never see it: they get a small sign-in hint on the Plan screen.
 *
 * Allergies, Ramadan and Halal are deliberately not asked here (data
 * minimisation); the coach form keeps its own fields for them.
 *
 * Draft answers live in localStorage gym_survey_draft (local-only, wiped
 * on sign-out with the other gym_* keys). */
(function () {
  "use strict";

  var DRAFT_KEY = "gym_survey_draft";
  var DISMISS_KEY = "gym_survey_dismissed";     // "Not now" tapped: don't auto-open again (local only)
  var CARD_KEY = "gym_survey_card_closed";      // the Plan-screen "Set up your plan" card was closed (local only)
  // The consent wording below. Bump the version whenever that text or the
  // list of questions changes: everyone is then asked again.
  var CONSENT_TYPE = "onboarding";
  var CONSENT_VERSION = "onboarding.v1";
  var HINT_KEY = "etq_guest_hint_closed"; // sessionStorage: guest hint closed

  var STR = {
    later: ["Not now", "ليس الآن"],
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
    // home tools (only after "Home, with some equipment")
    qTools: ["What do you have at home?", "ماذا لديك في البيت؟"],
    whyTools: ["Pick all that apply. Pick nothing and we use bodyweight moves only.", "اختر كل ما عندك. وإن لم تختر شيئاً نستخدم تمارين وزن الجسم فقط."],
    tool_dumbbell: ["Dumbbells", "دمبل"],
    tool_band: ["Resistance bands", "أحزمة مقاومة"],
    tool_bench: ["Bench or chair", "بنش أو كرسي"],
    tool_table: ["Sturdy table", "طاولة ثابتة"],
    tool_pullup_bar: ["Pull-up bar", "بار عقلة"],
    tool_kettlebell: ["Kettlebell", "كيتل بيل"],
    tool_jump_rope: ["Jump rope", "حبل قفز"],
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
    whyDiet: ["Shapes the meals Etqadem Coach suggests.", "يشكّل الوجبات التي يقترحها المدرّب اتقدم."],
    diet_balanced: ["Balanced", "متوازن"],
    diet_high_protein: ["High protein", "بروتين عالٍ"],
    diet_low_carb: ["Low carb", "قليل الكربوهيدرات"],
    diet_keto: ["Keto", "كيتو"],
    diet_mediterranean: ["Mediterranean", "متوسطي"],
    diet_vegetarian: ["Vegetarian", "نباتي"],
    diet_vegan: ["Vegan", "نباتي صرف"],
    // inbody (optional)
    qIb: ["Have InBody results?", "عندك نتيجة InBody؟"],
    whyIb: ["Optional. Makes your calories more accurate.", "اختياري. يجعل حساب سعراتك أدق."],
    ibFat: ["Body fat", "نسبة الدهون"],
    ibSmm: ["Muscle mass", "الكتلة العضلية"],
    ibVisc: ["Visceral fat level", "مستوى الدهون الحشوية"],
    ibBmr: ["BMR", "معدل الأيض"],
    pct: ["%", "%"],
    kcal: ["kcal", "سعرة"],
    level: ["level", "مستوى"],
    ibPhoto: ["You can also read them from a photo later in Coach.", "تقدر كمان تقراها من صورة لاحقاً في المدرب."],
    skip: ["Skip", "تخطي"],
    errIb: ["Check the highlighted number.", "راجع الرقم المحدد."],
    // consent (step 0; wording from the 2026-10-22 lawyer review, section 4)
    cTitle: ["Before we start", "قبل أن نبدأ"],
    cLine1: ["A few quick questions about your goal, body and training. Some answers, like your weight, are health information.",
      "أسئلة سريعة عن هدفك وجسمك وتمرينك. بعض الإجابات، مثل وزنك، معلومات صحية."],
    cLine2: ["We save them to your account (on our servers outside your country) to pick your starter plan and fill in your coach form. Nothing goes to Etqadem Coach until you turn it on.",
      "نحفظها في حسابك (على خوادمنا خارج بلدك) لنختار خطتك المبدئية ونملأ نموذج المدرّب. ولا يُرسَل شيء إلى المدرّب اتقدم إلا بعد أن تشغّله."],
    cLine3: ["Not now? You can still use the app. You can withdraw any time in More → Privacy & data.",
      "لا تريد الآن؟ يمكنك استخدام التطبيق كالمعتاد. وتستطيع سحب موافقتك في أي وقت من المزيد ← الخصوصية والبيانات."],
    cStatement: ["I agree that Etqadem saves these answers, including health information, for these purposes.",
      "أوافق على أن يحفظ اتقدم هذه الإجابات، بما فيها المعلومات الصحية، لهذه الأغراض."],
    cLink: ["How we use your answers", "كيف نستخدم إجاباتك"],
    cAgree: ["Agree and continue", "أوافق وأتابع"],
    cSaving: ["Saving…", "جارٍ الحفظ…"],
    cErr: ["Couldn't save your choice. Check your connection and try again.", "تعذّر حفظ اختيارك. تحقّق من الاتصال وحاول مجددًا."],
    checking: ["One moment…", "لحظة…"],
    // save + done
    saving: ["Saving your answers…", "جارٍ حفظ إجاباتك…"],
    saveErr: ["Couldn't save. Check your connection and try again.", "تعذّر الحفظ. تحقّق من الاتصال وحاول مجدداً."],
    retry: ["Try again", "حاول مجدداً"],
    doneTitle: ["You're all set", "كل شيء جاهز"],
    doneSub: ["Your starter plan is ready. Etqadem Coach can tailor it to you.", "خطتك المبدئية جاهزة. والمدرّب اتقدم يقدر يفصّلها لك."],
    starter: ["Starter plan", "الخطة المبدئية"],
    styleGym: ["Gym", "جيم"],
    styleHome: ["Home / bodyweight", "منزلي / وزن الجسم"],
    daysN: ["{n} days a week", "{n} أيام في الأسبوع"],
    yourSplit: ["Your split", "تقسيمتك"],
    splitN: ["{n}-day split", "تقسيمة {n} أيام"],
    whereHome: ["Home", "المنزل"],
    buildAi: ["Build my AI plan", "ابنِ خطتي بالذكاء الاصطناعي"],
    buildAiNote: ["Uses 1 of today's 5 coach plans.", "يستخدم 1 من 5 خطط متاحة اليوم."],
    startStarter: ["Start with the starter plan", "ابدأ بالخطة المبدئية"],
    // Plan-screen card after "Not now"
    setupTitle: ["Set up your plan", "جهّز خطتك"],
    setupText: ["A few quick questions to tailor your starter plan.", "أسئلة سريعة لتناسب الخطة المبدئية هدفك وجسمك."],
    setupBtn: ["Start", "ابدأ"],
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
    // The tools question only exists for home training, and only when splits.js loaded.
    if (state && state.a.equipment === "home_minimal" && homeTools().length) {
      list.splice(list.indexOf(list.filter(function (x) { return x.key === "equipment"; })[0]) + 1, 0,
        { key: "tools", kind: "form", q: "qTools", why: "whyTools" });
    }
    list.push({ key: "inbody", kind: "form", q: "qIb", why: "whyIb" });
    return list;
  }
  // Same bounds as the coach form (coach.js FIELDS) and gym-assistant.
  var IB = [
    { k: "bodyFatPct", label: "ibFat", unit: "pct", min: 3, max: 60 },
    { k: "skeletalMuscleMassKg", label: "ibSmm", unit: "kg", min: 10, max: 80 },
    { k: "visceralFatLevel", label: "ibVisc", unit: "level", min: 1, max: 30, int: true },
    { k: "bmrKcal", label: "ibBmr", unit: "kcal", min: 500, max: 5000, int: true }
  ];
  // The home tools the split generator knows ("none" means no tools, so it is not a choice here).
  function homeTools() {
    var all = window.GymSplits && GymSplits.HOME_TOOLS;
    return Array.isArray(all) ? all.filter(function (k) { return k !== "none"; }) : [];
  }
  var DIETS = ["balanced", "high_protein", "low_carb", "keto", "mediterranean", "vegetarian", "vegan"];

  // ---------------- state ----------------
  var root = null;      // #survey
  var card = null;
  var state = null;     // { step, a: answers }
  var STEPS = [];
  var opening = false;
  var lastFocus = null;
  var view = "";        // "check" | "consent" | "q" | "save" | "done": what the card shows now
  var consented = false; // an active onboarding consent for CONSENT_VERSION (this session's cache)
  var redoConsent = null; // set when the PUT asked for the consent again: what to run after it

  function loadDraft() {
    try {
      var d = JSON.parse(lsGet(DRAFT_KEY));
      if (d && typeof d === "object" && d.a) return d;
    } catch (e) {}
    return { step: 0, a: { dietPreference: "balanced" } };
  }
  function saveDraft() { lsSet(DRAFT_KEY, JSON.stringify(state)); }

  function isOpen() { return !!(root && !root.hidden); }

  function open() {
    if (isOpen() || opening) return;
    opening = true;
    state = loadDraft();
    STEPS = steps();
    if (!(state.step >= 0)) state.step = 0;
    if (state.step >= STEPS.length) state.step = STEPS.length - 1; // resume on the last question
    ensureRoot();
    lastFocus = document.activeElement;
    root.hidden = false;
    document.body.classList.add("survey-open");
    if (window.GymMotion && GymMotion.show) { root.hidden = true; GymMotion.show(root); }
    begin();
    opening = false;
  }

  // Step 0: unless the account already has the consent, ask for it before
  // the first question. A failed lookup shows the consent screen (the POST
  // is what really records it).
  function begin() {
    if (consented) { render(0); return; }
    view = "check";
    card.innerHTML = "";
    card.appendChild(h("div", { class: "svy-body svy-center", role: "status" },
      h("div", { class: "coach-spin", "aria-hidden": "true" }),
      h("p", { class: "svy-why" }, s("checking"))));
    lookupConsent().then(function (yes) {
      if (!isOpen() || view !== "check") return;
      consented = yes;
      if (yes) render(0); else renderConsent(function () { render(1); });
    });
  }

  function consentApi(method, body) {
    var opts = { method: method };
    if (body) { opts.headers = { "Content-Type": "application/json" }; opts.body = JSON.stringify(body); }
    return window.GymHeader && GymHeader.api ? GymHeader.api("/me/consents", opts) : Promise.reject(new Error("no api"));
  }
  function lookupConsent() {
    return consentApi("GET").then(function (res) {
      if (!res.ok) return false;
      return res.json().then(function (d) {
        return ((d && d.consents) || []).some(function (c) {
          return c && c.type === CONSENT_TYPE && !c.withdrawnAt && c.textVersion === CONSENT_VERSION;
        });
      });
    }).catch(function () { return false; });
  }

  function close() {
    if (!root) return;
    document.body.classList.remove("survey-open");
    if (window.GymMotion && GymMotion.hide) GymMotion.hide(root); else root.hidden = true;
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
    view = "";
  }

  // "Not now": nothing is sent. The default starter plan stays, the survey
  // stops auto-opening, and the Plan screen shows a card to start it later.
  function later() {
    lsSet(DISMISS_KEY, "1");
    close();
    renderSetup();
  }

  function ensureRoot() {
    if (root) return;
    root = h("section", { id: "survey", class: "m-ovl", role: "dialog", "aria-modal": "true", "aria-labelledby": "svyQ", hidden: true });
    card = h("div", { class: "svy-card m-ovl-card" });
    root.appendChild(card);
    root.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); if (view === "consent" || view === "check" || (view === "q" && state && state.step < STEPS.length)) later(); }
    });
    document.body.appendChild(root);
  }

  // dir: 1 forward, -1 back, 0 none
  function render(dir) {
    card.innerHTML = "";
    view = "q";
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

  // next: what runs once the consent POST succeeded. A failed POST shows the error and stays here.
  function renderConsent(next) {
    view = "consent";
    redoConsent = next;
    card.innerHTML = "";
    var err = h("p", { class: "svy-err", role: "alert" });
    var agreeBtn = h("button", { type: "button", class: "svy-next", on: { click: function () {
      agreeBtn.disabled = true; notNow.disabled = true; agreeBtn.textContent = s("cSaving"); err.textContent = "";
      consentApi("POST", { type: CONSENT_TYPE, textVersion: CONSENT_VERSION, lang: lang() }).then(function (res) {
        if (!res.ok) throw new Error("consent " + res.status);
        consented = true;
        document.dispatchEvent(new CustomEvent("etq:onboarding-consent-changed", { detail: { granted: true } }));
        next();
      }).catch(function () {
        if (view !== "consent") return;
        err.textContent = s("cErr");
        agreeBtn.disabled = false; notNow.disabled = false; agreeBtn.textContent = s("cAgree");
        // the card keeps the user's place; focus returns to the retry button
        try { agreeBtn.focus({ preventScroll: true }); } catch (e) {}
      });
    } } }, s("cAgree"));
    var notNow = h("button", { type: "button", class: "svy-ghost", on: { click: later } }, s("later"));
    var link = h("a", { class: "svy-clink", href: "/privacy#" + (lang() === "ar" ? "ar-first-run" : "first-run"), target: "_blank", rel: "noopener" }, s("cLink"));
    card.appendChild(h("div", { class: "svy-body svy-in svy-consent", style: "--svy-dir:1" },
      h("h2", { class: "svy-q", id: "svyQ", tabindex: "-1" }, s("cTitle")),
      h("p", { class: "svy-clead" }, s("cLine1")),
      h("p", { class: "svy-cline" }, s("cLine2")),
      h("p", { class: "svy-cline" }, s("cLine3")),
      h("div", { class: "svy-cstate" },
        h("p", { class: "svy-cstate-text" }, s("cStatement")),
        link),
      err,
      agreeBtn,
      notNow));
    var t = card.querySelector("#svyQ");
    if (t) try { t.focus({ preventScroll: true }); } catch (e) {}
  }

  function go(delta) {
    if (state.a.equipment !== "home_minimal") delete state.a.homeTools;
    STEPS = steps();
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
    } else if (st.key === "inbody") {
      var ib = state.a.inbody || {};
      IB.forEach(function (f) { form.appendChild(numField("svyIb_" + f.k, f.label, f.unit, ib[f.k], f.min, f.max)); });
      form.appendChild(h("p", { class: "svy-note svy-note-start" }, s("ibPhoto")));
      check = function () {
        var out = {}, bad = "";
        IB.forEach(function (f) {
          var input = form.querySelector("#svyIb_" + f.k);
          input.removeAttribute("aria-invalid");
          var raw = input.value.trim();
          if (raw === "") return;
          var v = parseFloat(raw);
          if (!(v >= f.min && v <= f.max)) { input.setAttribute("aria-invalid", "true"); bad = bad || s("errIb"); return; }
          out[f.k] = f.int ? Math.round(v) : Math.round(v * 10) / 10;
        });
        if (bad) return bad;
        state.a.inbody = out;
        return "";
      };
    } else if (st.key === "tools") {
      var picked = Array.isArray(state.a.homeTools) ? state.a.homeTools.slice() : [];
      var tchips = h("div", { class: "svy-chips", role: "group", "aria-labelledby": "svyQ" });
      homeTools().forEach(function (k) {
        var on = picked.indexOf(k) !== -1;
        tchips.appendChild(h("button", { type: "button", class: "svy-chip" + (on ? " on" : ""), role: "checkbox", "aria-checked": on ? "true" : "false",
          on: { click: function (e) {
            var i = picked.indexOf(k);
            if (i === -1) picked.push(k); else picked.splice(i, 1);
            e.currentTarget.classList.toggle("on", i === -1);
            e.currentTarget.setAttribute("aria-checked", i === -1 ? "true" : "false");
            state.a.homeTools = picked.slice();
            saveDraft();
          } } }, s("tool_" + k)));
      });
      form.appendChild(tchips);
      check = function () { state.a.homeTools = picked.slice(); return ""; };
    } else if (st.key === "diet") {
      var chips = h("div", { class: "svy-chips", role: "radiogroup", "aria-labelledby": "svyQ" });
      DIETS.forEach(function (d) {
        var on = (DIETS.indexOf(state.a.dietPreference) === -1 ? "balanced" : state.a.dietPreference) === d;
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
      check = function () {
        if (DIETS.indexOf(state.a.dietPreference) === -1) state.a.dietPreference = "balanced";
        return "";
      };
    }
    form.appendChild(err);
    form.appendChild(h("button", { type: "submit", class: "svy-next" }, s("next")));
    if (st.key === "inbody") {
      form.appendChild(h("button", { type: "button", class: "svy-ghost", on: { click: function () {
        state.a.inbody = {};
        saveDraft();
        go(1);
      } } }, s("skip")));
    }
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
      activityLevel: a.activityLevel, dietPreference: DIETS.indexOf(a.dietPreference) === -1 ? "balanced" : a.dietPreference
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
      if (res.ok) return res.json();
      return res.json().catch(function () { return null; }).then(function (b) {
        var e = b && b.error;
        var err = new Error("onboarding " + res.status);
        err.consentRequired = res.status === 403 && !!e && (e.code || e) === "consent_required";
        throw err;
      });
    }).then(function () {
      var split = applyLocally(body, state.a.inbody);
      lsDel(DRAFT_KEY);
      lsDel(DISMISS_KEY);
      if (window.GymHeader && GymHeader.setMe) GymHeader.setMe({ onboardingCompleted: true });
      renderDone(body, split);
    }).catch(function (err) {
      if (err && err.consentRequired) {
        // The server has no active consent for us: ask again, then save.
        consented = false;
        renderConsent(function () { card.innerHTML = ""; renderSave(); });
        return;
      }
      card.innerHTML = "";
      card.appendChild(h("div", { class: "svy-body svy-center" },
        h("p", { class: "svy-err", role: "alert" }, s("saveErr")),
        h("button", { type: "button", class: "svy-next", on: { click: function () { card.innerHTML = ""; renderSave(); } } }, s("retry")),
        h("button", { type: "button", class: "svy-ghost", on: { click: function () { state.step = STEPS.length - 1; render(-1); } } }, s("back"))));
    });
  }

  function styleFor(eq) { return eq === "full_gym" ? "gym" : "cal"; }

  // Starter plan + coach form, so both are ready before the user leaves.
  // The optional InBody numbers are not in the PUT (gym-be's survey record doesn't hold them), but they
  // do reach the server: the coach form they are copied into is synced to the account (gym_coach_form_draft).
  // They are covered by the same onboarding consent as every other answer (the consent step comes first,
  // privacy policy 3.13 names them), and "Withdraw" clears them from the form like the rest.
  // Returns the generated split ({days: [day, ...], ...}) or null (2 days = Classic, or splits.js missing).
  // homeTools are not in the PUT; the split choice stores them on this device.
  function applyLocally(a, inbody) {
    var split = null;
    try { if (window.GymSetPlan) GymSetPlan(a.sex, styleFor(a.equipment)); } catch (e) {}
    try {
      if (window.GymSplits && GymSplits.applyChoice) {
        split = GymSplits.applyChoice({
          days: a.trainingDaysPerWeek,
          where: a.equipment === "full_gym" ? "gym" : "home",
          tools: a.equipment === "home_minimal" ? (state.a.homeTools || []) : []
        }) || null;
      }
    } catch (e) {}
    try { if (window.GymCoach && GymCoach.applySurvey) GymCoach.applySurvey(a, inbody); } catch (e) {}
    return split;
  }

  function renderDone(a, split) {
    card.innerHTML = "";
    view = "done";
    var styleLabel = s(styleFor(a.equipment) === "gym" ? "styleGym" : "styleHome");
    card.appendChild(h("div", { class: "svy-body svy-in svy-done", style: "--svy-dir:1" },
      h("div", { class: "svy-check", "aria-hidden": "true" }),
      h("h2", { class: "svy-q", id: "svyQ" }, s("doneTitle")),
      h("p", { class: "svy-why" }, s("doneSub")),
      h("div", { class: "svy-summary" },
        h("span", { class: "svy-sum-label" }, s(split ? "yourSplit" : "starter")),
        h("span", { class: "svy-sum-val" }, split
          ? s("splitN", { n: split.days.length }) + " · " + s(a.equipment === "full_gym" ? "styleGym" : "whereHome")
          : s("sex_" + a.sex) + " · " + styleLabel),
        h("span", { class: "svy-sum-meta" }, split
          ? s("goal_" + a.goal) + " · " + s("sex_" + a.sex)
          : s("goal_" + a.goal) + " · " + s("daysN", { n: a.trainingDaysPerWeek }))),
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
    if (lsGet(DISMISS_KEY) === "1") return;
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

  // ---------------- "Set up your plan" card (Plan screen, after "Not now") ----------------
  function renderSetup() {
    var old = document.getElementById("setupCard");
    var me = window.GymHeader && GymHeader.me ? GymHeader.me() : null;
    var show = !!(me && me.onboardingCompleted === false && window.GymHeader && GymHeader.isAuthed()
      && lsGet(DISMISS_KEY) === "1" && lsGet(CARD_KEY) !== "1");
    if (!show) { if (old) old.remove(); return; }
    var hero = document.querySelector("#screen-plan header.hero");
    if (!hero) return;
    if (old) {
      if (old.getAttribute("data-lang") === lang()) return;
      old.remove();
    }
    var cardEl = h("div", { id: "setupCard", class: "guest-hint setup-card", role: "note", "data-lang": lang() },
      h("div", { class: "guest-hint-text" },
        h("strong", { class: "setup-title" }, s("setupTitle")),
        h("span", { class: "setup-sub" }, s("setupText"))),
      h("button", { type: "button", class: "guest-hint-btn", on: { click: function () { open(); } } }, s("setupBtn")),
      h("button", { type: "button", class: "guest-hint-x", "aria-label": s("close"), on: { click: function () {
        lsSet(CARD_KEY, "1");
        cardEl.remove();
      } } }));
    hero.insertAdjacentElement("afterend", cardEl);
  }

  // More > Privacy & data > First-run answers > Withdraw (privacy.js) calls
  // this once the server deleted the consent and the answers: forget the
  // draft, clear what the survey filled into the coach form, and stay quiet
  // (no auto-open, no card). The starter plan stays.
  function afterWithdraw() {
    consented = false;
    lsDel(DRAFT_KEY);
    lsSet(DISMISS_KEY, "1");
    lsSet(CARD_KEY, "1");
    try { if (window.GymCoach && GymCoach.clearSurvey) GymCoach.clearSurvey(); } catch (e) {}
    if (window.GymHeader && GymHeader.setMe) GymHeader.setMe({ onboardingCompleted: false });
    renderSetup();
  }

  function init() {
    document.addEventListener("gym:authchange", function () { consented = false; });
    if (window.GymHeader && GymHeader.onChange) GymHeader.onChange(function () { maybeOpen(); renderHint(); renderSetup(); });
    // The sign-in screen may still be up when /me lands; try again once it closes.
    new MutationObserver(function () { maybeOpen(); renderHint(); renderSetup(); })
      .observe(document.body, { attributes: true, attributeFilter: ["class"] });
    // Re-translate on language change.
    new MutationObserver(function () {
      if (isOpen() && state) {
        if (view === "consent") renderConsent(redoConsent);
        else if (view === "q" && state.step < STEPS.length) render(0);
      }
      renderHint();
      renderSetup();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    renderHint();
    renderSetup();
    maybeOpen();
  }

  // tour.js: the tips wait while this is true (the survey will auto-open).
  function isPending() {
    var me = window.GymHeader && GymHeader.me ? GymHeader.me() : null;
    return !!(me && me.onboardingCompleted === false && lsGet(DISMISS_KEY) !== "1");
  }

  window.GymSurvey = { open: open, close: close, isOpen: isOpen, isPending: isPending, afterWithdraw: afterWithdraw };

  // Deferred scripts run before DOMContentLoaded; wait for it so header.js
  // (GymHeader), coach.js and app.js have all loaded.
  if (document.readyState === "complete") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
