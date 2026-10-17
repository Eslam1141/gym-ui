/* coach.js — the AI Coach screen (Track D).
 *
 * Renders into #coachBody. Anonymous/signed-out users see a teaser; signed-in
 * users get a profile form that POSTs to the gym-assistant service and a
 * rendered diet + workout plan. Loads after app.js (reads the global
 * activeLang / gym_plan) and after ui.js. No external deps.
 *
 * Local keys:
 *   gym_coach_form_draft  live form values (saved on every edit, restored on
 *     return) — gym_-prefixed and synced (sync.js), so a cleared/lost
 *     localStorage on one device can still recover the in-progress draft
 *     from the account on next sign-in, instead of losing it outright.
 *   gymcoach_last  last successful result (pinned so the screen reopens to
 *     it) — NOT synced (deliberately not gym_-prefixed): it's a cheap,
 *     re-derivable cache of the last AI answer, not user-authored input.
 */
(function () {
  "use strict";

  var API_ROOT = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var ASSIST_BASE = API_ROOT + "/assistant";
  // Must comfortably exceed the backend's own outer request deadline
  // (REQUEST_TIMEOUT, currently 80s in deploy/helm/gym-assistant/values.yaml)
  // or this abort fires before the backend's retry loop can succeed — a
  // want=both assessment's single Anthropic call takes ~2x as long as
  // either half alone, which is what pushed the old 45s value into that
  // exact race in production.
  var CALL_TIMEOUT_MS = 85000;
  var FORM_KEY = "gym_coach_form_draft"; // live form values (synced — see header)
  var LAST_KEY = "gymcoach_last";   // last result, for quick reopen (local only)
  var SAVED_KEY = "gym_coach_saved"; // gym_ prefix -> synced to the account
  var SAVED_MAX = 3;

  // ---------------- i18n ----------------
  if (!window.GymDom) throw new Error("coach.js: dom.js must load first");
  var h = GymDom.h, lang = GymDom.lang;
  // Version of the InBody consent wording (ibNotice + ibConsent below). Change it
  // whenever that text changes: everyone is then asked to agree again.
  var IB_CONSENT_TYPE = "inbody_ai";
  var IB_CONSENT_VERSION = "2026-10-16";

  var STR = {
    teaseTitle: ["Meet your AI coach", "تعرّف على مدرّبك الذكي"],
    teaseBody: ["A diet and training plan calculated from your body numbers and goal — then filled in by Claude. Free with a Google account.",
      "خطة تغذية وتمرين تُحسب من أرقام جسمك وهدفك، ثم يكملها كلود. مجانية مع حساب جوجل."],
    teaseB1: ["Calorie & macro targets from your stats", "أهداف السعرات والماكروز من بياناتك"],
    teaseB2: ["A weekly split for your equipment & days", "تقسيم أسبوعي حسب معدّاتك وأيامك"],
    teaseB3: ["Swap-friendly meals for your diet", "وجبات قابلة للتبديل حسب نظامك"],
    signIn: ["Sign in with Google", "سجّل الدخول عبر جوجل"],
    want: ["I want", "أريد"],
    wantBoth: ["Both", "الاثنين"], wantDiet: ["Diet", "تغذية"], wantWorkout: ["Workout", "تمرين"],
    grpYou: ["You", "أنت"],
    grpGoal: ["Goal", "الهدف"],
    grpTraining: ["Training", "التمرين"],
    grpDiet: ["Diet", "التغذية"],
    grpInBody: ["InBody / DEXA (optional)", "InBody / DEXA (اختياري)"],
    grpNotes: ["Anything else? (injuries, schedule…)", "أي شيء آخر؟ (إصابات، جدول…)"],
    age: ["Age", "العمر"], sex: ["Sex", "الجنس"],
    male: ["Male", "ذكر"], female: ["Female", "أنثى"],
    sexFromPlan: ["From your plan — change it on the Plan screen", "من خطتك — غيّرها من شاشة الخطة"],
    heightCm: ["Height", "الطول"], weightKg: ["Weight", "الوزن"],
    goal: ["Goal", "الهدف"],
    lose_fat: ["Lose fat", "خسارة دهون"], gain_muscle: ["Build muscle", "بناء عضل"],
    maintain: ["Maintain", "محافظة"], recomp: ["Recomposition", "إعادة تكوين"],
    goalHint: ["Check both to recomposition (lose fat while building muscle)", "اختر الاثنين لإعادة التكوين (خسارة دهون مع بناء عضل)"],
    activityLevel: ["Daily activity", "النشاط اليومي"],
    sedentary: ["Sedentary", "خامل"], light: ["Lightly active", "نشاط خفيف"],
    moderate: ["Moderately active", "نشاط متوسط"], active: ["Very active", "نشيط جداً"],
    athlete: ["Athlete", "رياضي"],
    trainingDaysPerWeek: ["Training days / week", "أيام التمرين / الأسبوع"],
    equipment: ["Equipment", "المعدّات"],
    full_gym: ["Full gym", "جيم كامل"], home_minimal: ["Home basics", "أساسيات منزلية"],
    bodyweight: ["Bodyweight only", "وزن الجسم فقط"],
    dietPreference: ["Eating style", "نمط الأكل"],
    balanced: ["Balanced", "متوازن"], high_protein: ["High protein", "بروتين عالٍ"],
    keto: ["Keto", "كيتو"], mediterranean: ["Mediterranean", "متوسطي"],
    vegetarian: ["Vegetarian", "نباتي"], vegan: ["Vegan", "نباتي صِرف"],
    halal: ["Halal", "حلال"], low_carb: ["Low carb", "قليل الكارب"],
    allergies: ["Allergies", "حساسية"], dislikes: ["Foods to avoid", "أطعمة يجب تجنّبها"],
    chipHint: ["Type and press Enter", "اكتب واضغط Enter"],
    bodyFatPct: ["Body fat %", "نسبة الدهون %"],
    skeletalMuscleMassKg: ["Skeletal muscle (kg)", "الكتلة العضلية (كجم)"],
    visceralFatLevel: ["Visceral fat level", "مستوى الدهون الحشوية"],
    bmrKcal: ["Measured BMR (kcal)", "معدل الأيض المُقاس (سعرة)"],
    notes: ["Notes", "ملاحظات"],
    ibTitle: ["Read numbers from a photo (optional)", "قراءة الأرقام من صورة (اختياري)"],
    ibNotice: ["We send your photo to Anthropic, our AI provider in the United States, only to read 5 numbers: body fat %, skeletal muscle mass, visceral fat level, BMR and weight. We don't save the photo. Anthropic normally deletes it within 30 days and doesn't use it to train AI. Only the numbers you keep in the form are saved, with your plan. You can type the numbers yourself instead.",
      "نرسل صورتك إلى شركة Anthropic، مزوّد الذكاء الاصطناعي لدينا في الولايات المتحدة الأمريكية، لقراءة 5 أرقام فقط: نسبة الدهون، والكتلة العضلية الهيكلية، ومستوى الدهون الحشوية، ومعدل الأيض الأساسي، والوزن. لا نحتفظ بالصورة، وتحذفها Anthropic عادةً خلال 30 يومًا ولا تستخدمها في تدريب الذكاء الاصطناعي. ولا يُحفظ إلا الأرقام التي تُبقيها في النموذج، وذلك مع خطتك. ويمكنك بدلًا من ذلك كتابة الأرقام بنفسك."],
    ibConsent: ["I agree to send this photo, which includes my health information, to Anthropic in the United States for this purpose. I can withdraw this at any time in More → Privacy & data.",
      "أوافق على إرسال هذه الصورة، التي تتضمن معلومات صحية عني، إلى شركة Anthropic في الولايات المتحدة الأمريكية لهذا الغرض، ويمكنني سحب هذه الموافقة في أي وقت من: المزيد ← الخصوصية والبيانات."],
    ibRepeat: ["Sent to Anthropic (US) to read the numbers; we don't save the photo. Crop out your name and ID.",
      "تُرسل إلى Anthropic (الولايات المتحدة) لقراءة الأرقام، ولا نحتفظ بالصورة. احذف اسمك ورقم هويتك من الصورة."],
    ibAgreedOn: ["You agreed on {d}.", "وافقت بتاريخ {d}."],
    ibAgreed: ["You agreed to this.", "لقد وافقت على ذلك."],
    ibWithdraw: ["Withdraw consent", "سحب الموافقة"],
    ibSaving: ["Saving your agreement…", "جارٍ حفظ موافقتك…"],
    ibConsentErr: ["Couldn't save your agreement, so photo upload is still off. Check your connection and try again.",
      "تعذّر حفظ موافقتك، لذلك ما زال رفع الصورة متوقفاً. تحقق من اتصالك وحاول مرة أخرى."],
    ibWithdrawn: ["Consent withdrawn. Photo upload is off until you agree again.", "تم سحب الموافقة. رفع الصور متوقف حتى توافق مرة أخرى."],
    ibWithdrawErr: ["Couldn't withdraw your consent. It's still active. Check your connection and try again.",
      "تعذّر سحب موافقتك وما زالت سارية. تحقق من اتصالك وحاول مرة أخرى."],
    ibNeedConsent: ["We need your agreement before we can read photos. Tick the box below to continue, or type the numbers yourself.",
      "نحتاج موافقتك قبل قراءة الصور. فعّل المربع أدناه للمتابعة، أو اكتب الأرقام بنفسك."],
    ibCrop: ["Keep only the results table. Your name, ID and phone number aren't needed. Crop the photo, or cover them before taking it.",
      "أبقِ جدول النتائج فقط؛ فلا حاجة إلى اسمك أو رقم هويتك أو رقم هاتفك. قصّ الصورة، أو غطِّها قبل التصوير."],
    ibChoose: ["Choose photo", "اختر صورة"],
    ibTypeInstead: ["Type numbers instead", "أكتب الأرقام بنفسي"],
    ibReading: ["Reading your photo…", "جارٍ قراءة صورتك…"],
    ibFilled: ["Filled {n} fields. Check these numbers against your printout. AI can misread them.",
      "تمت تعبئة {n} حقول. راجع هذه الأرقام وقارنها بورقة النتائج، فقد يخطئ الذكاء الاصطناعي في قراءتها."],
    ibNone: ["We couldn't find any numbers in that photo. Try a sharper, straight-on shot, or type them in.",
      "لم نجد أي أرقام في هذه الصورة. جرّب صورة أوضح ومن الأمام، أو اكتب الأرقام بنفسك."],
    ibFromPhoto: ["From photo", "من الصورة"],
    ibBadImg: ["That file couldn't be opened as an image.", "تعذّر فتح هذا الملف كصورة."],
    ibTooBig: ["That photo is too large. Try a smaller one.", "هذه الصورة كبيرة جداً. جرّب صورة أصغر."],
    ibErr415: ["Use a JPEG, PNG or WebP photo.", "استخدم صورة بصيغة JPEG أو PNG أو WebP."],
    ibErr422: ["We couldn't read that photo. Try a clearer, straight-on shot, or type the numbers in. This try used one of today's plan requests.",
      "لم نتمكن من قراءة الصورة. جرّب صورة أوضح ومن الأمام، أو اكتب الأرقام بنفسك. استُهلكت بهذه المحاولة إحدى طلبات الخطط اليوم."],
    ibErr429: ["You've reached today's limit for plans and photos. Try again tomorrow, or type the numbers in.",
      "بلغت حدّ اليوم للخطط والصور. حاول غداً، أو اكتب الأرقام بنفسك."],
    ibErr503: ["The photo reader is busy right now. Try again in a minute.", "قارئ الصور مشغول حالياً. حاول بعد دقيقة."],
    ibErrGen: ["Couldn't upload the photo. Check your connection and try again.", "تعذّر رفع الصورة. تحقق من اتصالك وحاول مرة أخرى."],
    resTips: ["Key tips", "نصائح أساسية"],
    ringLabel: ["Calories from protein {p}%, carbs {c}%, fat {f}%", "السعرات من البروتين {p}%، الكارب {c}%، الدهون {f}%"],
    generate: ["Generate my plan", "أنشئ خطتي"],
    generating: ["Building your plan… this can take 15–30s", "جارٍ بناء خطتك… قد تستغرق 15–30 ثانية"],
    wbEntryBtn: ["Customize your own plan", "خصص خطتك الخاصة"],
    // validation
    vRequired: ["Required", "مطلوب"],
    vRange: ["Enter {min}–{max}", "أدخل {min}–{max}"],
    vRangeU: ["Enter {min}–{max} {u}", "أدخل {min}–{max} {u}"],
    vAgeMin: ["Must be 16 or older", "يجب أن يكون العمر 16 عاماً فأكثر"],
    vInt: ["Whole number only", "رقم صحيح فقط"],
    vNotesMax: ["Max 300 characters", "الحد الأقصى 300 حرف"],
    vFixTop: ["Fill the required fields to continue", "أكمل الحقول المطلوبة للمتابعة"],
    // result
    resSummary: ["Summary", "الملخّص"],
    resTargets: ["Your numbers", "أرقامك"],
    bmi: ["BMI", "مؤشر الكتلة"], bmr: ["BMR", "الأيض الأساسي"], tdee: ["TDEE", "الحرق اليومي"],
    target: ["Target", "الهدف"], protein: ["Protein", "بروتين"], fat: ["Fat", "دهون"], carb: ["Carbs", "كارب"],
    bmiExplain: ["Body Mass Index — weight relative to height, used as a rough size category (not a body-fat measurement).",
      "مؤشر كتلة الجسم — الوزن مقارنة بالطول، يُستخدم كتصنيف تقريبي للحجم (وليس قياسًا مباشرًا لنسبة الدهون)."],
    bmrExplain: ["Basal Metabolic Rate — calories your body burns at complete rest just to keep you alive.",
      "معدل الأيض الأساسي — السعرات التي يحرقها جسمك وأنت في راحة تامة فقط للحفاظ على وظائف الحياة."],
    tdeeExplain: ["Total Daily Energy Expenditure — your BMR plus activity, i.e. all the calories you burn in a normal day.",
      "إجمالي الحرق اليومي — معدل الأيض الأساسي مضافًا إليه النشاط، أي كل السعرات التي تحرقها في يوم عادي."],
    targetExplain: ["Your daily calorie goal — TDEE adjusted up or down for your selected goal (fat loss, muscle gain, etc.).",
      "هدفك اليومي من السعرات — الحرق اليومي بعد تعديله صعودًا أو هبوطًا حسب هدفك المختار (خسارة دهون، بناء عضل، إلخ)."],
    proteinExplain: ["Daily protein target in grams — builds and preserves muscle; prioritized highest when losing fat.",
      "هدف البروتين اليومي بالجرام — يبني العضلات ويحافظ عليها، ويُعطى الأولوية القصوى عند خسارة الدهون."],
    fatExplain: ["Daily fat target in grams — supports hormones; kept steady regardless of your goal.",
      "هدف الدهون اليومي بالجرام — يدعم الهرمونات، ويبقى ثابتًا تقريبًا مهما كان هدفك."],
    carbExplain: ["Daily carb target in grams — whatever calories remain after protein and fat, mainly fuels training.",
      "هدف الكارب اليومي بالجرام — ما تبقى من السعرات بعد البروتين والدهون، ويُستخدم أساسًا كوقود للتمرين."],
    kcal: ["kcal", "سعرة"], gram: ["g", "جم"], perDay: ["/day", "/يوم"],
    resDiet: ["Diet plan", "خطة التغذية"], resWorkout: ["Workout plan", "خطة التمرين"],
    swaps: ["Easy swaps", "بدائل سهلة"], hydration: ["Water", "الماء"],
    liters: ["L", "لتر"], split: ["Split", "التقسيم"], progression: ["Progression", "التدرّج"],
    cardio: ["Cardio", "كارديو"], restS: ["rest", "راحة"], daysWk: ["days/week", "أيام/أسبوع"],
    disclaimers: ["Good to know", "معلومة مهمة"],
    btnNew: ["New assessment", "تقييم جديد"],
    btnDetail: ["More detail", "تفاصيل أكثر"],
    btnApply: ["Use workout as my plan", "استخدم التمرين كخطتي"],
    btnHistory: ["History", "السجل"],
    askCoach: ["Have a quick question? Chat with your coach", "لديك سؤال سريع؟ دردش مع مدرّبك"],
    applied: ["Added to your plans →", "أُضيفت إلى خططك ←"],
    quotaTitle: ["Daily limit reached", "بلغت الحد اليومي"],
    quotaBody: ["You've used today's assessments. Try again after {t}.", "لقد استخدمت تقييمات اليوم. حاول مجدداً بعد {t}."],
    quotaBodyGeneric: ["You've used today's assessments. Try again tomorrow.", "لقد استخدمت تقييمات اليوم. حاول مجدداً غداً."],
    errTitle: ["Couldn't reach the coach", "تعذّر الوصول إلى المدرّب"],
    errBody: ["The coach service isn't responding right now. Please try again in a moment.", "خدمة المدرّب لا تستجيب حالياً. يرجى المحاولة بعد قليل."],
    err502: ["The AI service is temporarily unavailable. Please try again shortly.", "خدمة الذكاء الاصطناعي غير متاحة مؤقتاً. حاول بعد قليل."],
    retry: ["Try again", "أعد المحاولة"],
    readyToast: ["Your plan is ready", "خطتك جاهزة"],
    readyOpen: ["View plan", "اعرض الخطة"],
    failToast: ["Couldn't build your plan", "تعذّر بناء خطتك"],
    failOpen: ["See why", "التفاصيل"],
    navReady: ["New plan ready", "خطة جديدة جاهزة"],
    refusedTitle: ["Let's keep this safe", "لنُبقِ الأمر آمناً"],
    histEmpty: ["No past assessments yet.", "لا توجد تقييمات سابقة بعد."],
    histOpen: ["Open", "افتح"],
    back: ["Back", "رجوع"],
    pdfTitle: ["Etqadem Coach plan", "خطة مدرّب اتقدم"],
    shareImage: ["Save Image", "حفظ كصورة"],
    saveAcct: ["Save to my plans", "حفظ في خططي"],
    savedTick: ["Saved ✓", "تم الحفظ ✓"],
    useAsWorkoutQ: ["Saved. Use this as your workout now?", "تم الحفظ. هل تريد استخدامها كتمرينك الآن؟"],
    useNow: ["Use it now", "استخدمها الآن"],
    notNow: ["Not now", "ليس الآن"],
    savedFull: ["Saved plans full ({n}/{n})", "الخطط المحفوظة ممتلئة ({n}/{n})"],
    myPlans: ["My plans", "خططي"],
    myPlansN: ["My plans ({n})", "خططي ({n})"],
    savedEmpty: ["No saved plans yet. Generate one, then \"Save to my plans\".", "لا خطط محفوظة بعد. أنشئ خطة ثم \"حفظ في خططي\"."],
    savedCap: ["You can keep up to {n} plans in your account.", "يمكنك الاحتفاظ بحتى {n} خطط في حسابك."],
    del: ["Delete", "حذف"],
    delConfirm: ["Delete this saved plan?", "حذف هذه الخطة المحفوظة؟"],
    ramadan: ["Ramadan mode", "وضع رمضان"],
    ramadanHint: ["Plan meals around suhoor & iftar and train around your fast",
      "خطط وجباتك حول السحور والإفطار ونظّم تمرينك حول صيامك"],
    ramadanSuggest: ["It's Ramadan — we've turned this on for you",
      "إنه رمضان — قمنا بتفعيل هذا الخيار لك"]
  };
  var s = GymDom.makeT(STR);

  function mount(el) {
    var body = document.getElementById("coachBody");
    if (!body) return;
    body.innerHTML = "";
    body.appendChild(el);
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  // Sub-screens register where Back returns to (GymUI's in-app Back stack,
  // used by the Android hardware Back). leave() is for their own Back buttons.
  function sub(fn) { if (window.GymUI && GymUI.pushSub) GymUI.pushSub(fn); }
  function leave() { if (window.GymUI && GymUI.dropSub) GymUI.dropSub(); refresh(); }
  // show() gets no arguments: as a click handler the first one would be the
  // MouseEvent (renderForm took it as saved form state and the button did nothing).
  function openSub(prev, show) { return function () { sub(prev); show(); }; }

  function loadJSON(k, fb) { try { return JSON.parse(localStorage.getItem(k)) || fb; } catch (e) { return fb; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  // write + tell the sync layer (so gym_ keys reach the account)
  function saveSynced(k, v) {
    saveJSON(k, v);
    try { if (window.GymSync && GymSync.onLocalWrite) GymSync.onLocalWrite(k); } catch (e) {}
  }

  // ---- saved plans (≤ SAVED_MAX, synced to the account) ----
  function loadSaved() {
    var a = loadJSON(SAVED_KEY, []);
    return Array.isArray(a) ? a.slice(0, SAVED_MAX) : [];
  }
  function isSaved(res) {
    var id = res && res.id;
    return !!id && loadSaved().some(function (p) { return p.result && p.result.id === id; });
  }
  function addSaved(res) {
    var arr = loadSaved();
    if (arr.length >= SAVED_MAX || isSaved(res)) return false;
    var copy = JSON.parse(JSON.stringify(res));
    delete copy._reqStrong;
    arr.push({ savedAt: Date.now(), result: copy });
    saveSynced(SAVED_KEY, arr.slice(0, SAVED_MAX));
    return true;
  }
  function removeSaved(idx) {
    var arr = loadSaved();
    arr.splice(idx, 1);
    saveSynced(SAVED_KEY, arr);
  }

  // Entry point for the custom workout builder (workout-builder.js) — wraps
  // its plain {split, days} shape into the same minimal "coach result"
  // object addSaved()/renderResult() already know how to store and render.
  // Only workoutPlan is populated; dietPlan/computed/summary are correctly
  // absent (renderResult already guards every section on presence — see
  // coach.js:897-901 — so an absent dietPlan/computed just means no
  // stats/diet section renders, which is exactly right for a workout-only
  // custom plan).
  window.GymWorkoutBuilderSave = function (workoutPlan) {
    var res = {
      id: "custom_" + Date.now(),
      createdAt: Date.now(),
      want: "workout",
      model: "Custom",
      workoutPlan: workoutPlan
    };
    if (addSaved(res)) {
      renderMyPlans();
      return true;
    }
    return false;
  };

  function fmtDate(ts) {
    try { return new Date(ts).toLocaleDateString(lang() === "ar" ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "numeric" }); }
    catch (e) { return ""; }
  }

  // ---- print / "download PDF" (browser's Save as PDF) — offline/CDN-failure
  // fallback for downloadResultImage() below. Logic unchanged from before. ----
  function downloadPdfFallback() {
    var prev = document.title, done = false;
    document.title = s("pdfTitle") + " — " + fmtDate(Date.now());
    var shut = Array.prototype.filter.call(document.querySelectorAll(".coach-result details"), function (d) { return !d.open; });
    shut.forEach(function (d) { d.open = true; }); // a closed <details> prints empty
    var restore = function () {
      if (done) return; done = true;
      shut.forEach(function (d) { d.open = false; });
      document.title = prev;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    setTimeout(function () { try { window.print(); } catch (e) {} }, 30);
    setTimeout(restore, 60000); // fallback if afterprint never fires
  }

  // App background to capture on — this app is dark-theme-only, so the
  // heading/body text is light-on-transparent; a hardcoded white capture
  // background left that text ~invisible. Read the real root background,
  // falling back to the app's known --bg if that's ever falsy/transparent
  // (e.g. an unusual UA default before styles.css applies).
  function exportBgColor() {
    try {
      var c = getComputedStyle(document.documentElement).backgroundColor;
      if (c && c !== "transparent" && c !== "rgba(0, 0, 0, 0)") return c;
    } catch (e) {}
    return "#0d1117";
  }

  // scale:2 on an unbounded-height result card (a full diet+workout plan can
  // be several thousand CSS px tall on a narrow phone) can exceed mobile
  // Safari's canvas-area ceiling (~16.7M px), past which iOS silently
  // returns a blank canvas instead of throwing — neither the success path
  // nor the catch/fallback would catch that. Clamp scale by measured area.
  function exportScale(card) {
    var w = card.scrollWidth, h = card.scrollHeight;
    if (!w || !h) return 2;
    return Math.max(1, Math.min(2, Math.sqrt(16000000 / (w * h))));
  }

  // ---- "Save Image" — screenshot the live result card via html2canvas
  // (CDN-loaded, see index.html) and download it as a PNG. Falls back to
  // downloadPdfFallback() if the CDN script didn't load or capture throws.
  //
  // Uses html2canvas's onclone to mutate a cloned, off-DOM copy of the card
  // before it's rasterized — mirroring what @media print already does for
  // the PDF fallback (hide the on-screen action/link button rows, show the
  // "Etqadem Coach plan — <date>" print-head title) without ever touching the
  // live page, so there's nothing to clean up even if capture rejects. ----
  var downloadResultImage = GymAct.once(function () { return downloadResultImageRaw(); }, { cooldown: 1500 });
  function downloadResultImageRaw() {
    var card = document.querySelector(".coach-result");
    if (!card || typeof html2canvas !== "function") { downloadPdfFallback(); return; }
    try {
      return html2canvas(card, {
        backgroundColor: exportBgColor(),
        scale: exportScale(card),
        onclone: function (clonedDoc, clonedCard) {
          var root = clonedCard || clonedDoc.querySelector(".coach-result");
          if (!root) return;
          root.querySelectorAll(".coach-actions, .coach-links").forEach(function (el) { el.style.display = "none"; });
          root.querySelectorAll("details").forEach(function (d) { d.open = true; }); // saved image carries the whole plan
          var head = root.querySelector(".coach-print-head");
          if (head) head.style.display = "block";
        }
      }).then(function (canvas) {
        canvas.toBlob(function (blob) {
          if (!blob) { downloadPdfFallback(); return; }
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url; a.download = "coach-plan-" + Date.now() + ".png";
          document.body.appendChild(a); a.click(); a.remove();
          // Defer revocation — Firefox/Safari can abort an in-flight
          // download if the blob URL is revoked synchronously right after
          // click() (Chromium tolerates it, but not everything does).
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        }, "image/png");
      }, function () { downloadPdfFallback(); });
    } catch (e) { downloadPdfFallback(); }
  }

  // ---------------- InBody photo -> prefill ----------------
  var IB_MAX_EDGE = 1568;          // px, long edge after re-encode
  var IB_MAX_BYTES = 880 * 1024;   // server takes <=900 KB; stay under
  var IB_IN_MAX = 15 * 1024 * 1024; // refuse absurd inputs before decoding
  var IB_TYPES = ["image/jpeg", "image/png", "image/webp"];
  var IB_QUALITY = [0.85, 0.7, 0.55, 0.4];
  // Testers only until consent is recorded server-side: off unless etq_ff_inbody === "1".
  function inbodyUploadOn() {
    try { return localStorage.getItem("etq_ff_inbody") === "1"; } catch (e) { return false; }
  }
  var ibConsented = false;   // mirrors the server record: an active inbody_ai consent for IB_CONSENT_VERSION
  var ibConsentedAt = "";    // grantedAt of that record
  var ibSync = null;         // repaints the open form's consent UI (set by renderForm, called by privacy.js's event)
  function consentUrl(suffix) { return API_ROOT + "/me/consents" + (suffix || ""); }
  function consentCall(method, suffix, body) {
    var opts = { method: method, headers: { "Authorization": "Bearer " + authToken() } };
    if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    return fetchTimeout(consentUrl(suffix), opts);
  }
  function activeInbodyConsent(list) {
    for (var i = 0; list && i < list.length; i++) {
      var c = list[i];
      if (c && c.type === IB_CONSENT_TYPE && !c.withdrawnAt && c.textVersion === IB_CONSENT_VERSION) return c;
    }
    return null;
  }
  // privacy.js withdrew the consent from More -> Privacy & data
  document.addEventListener("etq:inbody-consent-withdrawn", function () { ibConsented = false; ibConsentedAt = ""; if (ibSync) ibSync(); });
  function ibAnnounce() { document.dispatchEvent(new CustomEvent("etq:inbody-consent-changed", { detail: { granted: ibConsented } })); }
  var IB_FIELDS = ["bodyFatPct", "skeletalMuscleMassKg", "visceralFatLevel", "bmrKcal", "weightKg"];

  function decodeImage(file) {
    function viaImg() {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file), im = new Image();
        im.onload = function () { URL.revokeObjectURL(url); resolve(im); };
        im.onerror = function () { URL.revokeObjectURL(url); reject(new Error("decode")); };
        im.src = url;
      });
    }
    return window.createImageBitmap ? createImageBitmap(file).catch(viaImg) : viaImg();
  }
  // Re-encode through a canvas: long edge <= 1568px, JPEG q~0.85, stepping the
  // quality (then the size) down until it fits. A canvas export carries no
  // EXIF, so camera GPS/device data never leaves the phone.
  function downscaleImage(file) {
    return decodeImage(file).then(function (img) {
      var w = img.naturalWidth || img.width, ht = img.naturalHeight || img.height;
      if (!w || !ht) throw new Error("decode");
      var k = Math.min(1, IB_MAX_EDGE / Math.max(w, ht));
      function encode(cw, ch, qi) {
        var cv = document.createElement("canvas");
        cv.width = cw; cv.height = ch;
        var ctx = cv.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch); // PNG/WebP transparency -> white, not black
        ctx.drawImage(img, 0, 0, cw, ch);
        return new Promise(function (resolve) { cv.toBlob(resolve, "image/jpeg", IB_QUALITY[qi]); }).then(function (blob) {
          if (!blob) throw new Error("encode");
          if (blob.size <= IB_MAX_BYTES) return blob;
          if (qi + 1 < IB_QUALITY.length) return encode(cw, ch, qi + 1);
          if (cw > 640) return encode(Math.round(cw * 0.8), Math.round(ch * 0.8), IB_QUALITY.length - 1);
          throw new Error("toobig");
        });
      }
      return encode(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(ht * k)), 0)
        .finally(function () { if (img.close) img.close(); });
    });
  }

  // ---------------- field spec (drives render + validation) ----------------
  var ENUMS = {
    goal: ["lose_fat", "gain_muscle", "maintain", "recomp"],
    activityLevel: ["sedentary", "light", "moderate", "active", "athlete"],
    equipment: ["full_gym", "home_minimal", "bodyweight"],
    dietPreference: ["balanced", "high_protein", "keto", "mediterranean", "vegetarian", "vegan", "halal", "low_carb"]
  };
  // num fields: {min,max,int,unit}. required unless optional:true (InBody).
  var NUM = {
    age: { min: 16, max: 100, int: true, hardMin: 10 },
    heightCm: { min: 120, max: 230, unit: "cm" },
    weightKg: { min: 35, max: 250, unit: "kg", step: "0.1" },
    trainingDaysPerWeek: { min: 1, max: 6, int: true, unit: s("daysWk") },
    bodyFatPct: { min: 3, max: 60, unit: "%", step: "0.1", optional: true },
    skeletalMuscleMassKg: { min: 10, max: 80, unit: "kg", step: "0.1", optional: true },
    visceralFatLevel: { min: 1, max: 30, int: true, optional: true },
    bmrKcal: { min: 500, max: 5000, int: true, optional: true }
  };

  function planSex() {
    try {
      var p = localStorage.getItem("gym_plan");
      return p === "male" || p === "female" ? p : "";
    } catch (e) { return ""; }
  }

  function defaultState() {
    return {
      want: "both",
      age: "", sex: planSex() || "male",
      heightCm: "", weightKg: "",
      goal: "lose_fat", goalChecks: { lose_fat: true, gain_muscle: false, maintain: false },
      activityLevel: "moderate",
      trainingDaysPerWeek: "4", equipment: "full_gym",
      dietPreference: "balanced", allergies: [], dislikes: [],
      inbodyOpen: false, bodyFatPct: "", skeletalMuscleMassKg: "", visceralFatLevel: "", bmrKcal: "",
      notes: "",
      ramadan: false, ramadanAuto: "", ramadanManual: false
    };
  }
  // Is `date` (default: now) in Hijri month 9 (Ramadan)? Relies on the
  // Umm al-Qura calendar via Intl; browsers without it either throw or
  // silently fall back to another calendar, so we verify resolvedOptions()
  // actually gave us islamic-umalqura before trusting the month number —
  // any failure just means no auto-suggest, never a crash.
  function isHijriRamadan(date) {
    try {
      var fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "numeric" });
      if (fmt.resolvedOptions().calendar !== "islamic-umalqura") return false;
      var part = fmt.formatToParts(date || new Date()).filter(function (p) { return p.type === "month"; })[0];
      var month = part ? parseInt(part.value, 10) : NaN;
      return month === 9;
    } catch (e) { return false; }
  }
  // Hijri year-month key ("1448-9") the auto-suggest last fired for, so
  // unchecking the box sticks for the rest of that Ramadan instead of
  // re-flipping it back on at the next render.
  function hijriKey(date) {
    try {
      var fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric", month: "numeric" });
      if (fmt.resolvedOptions().calendar !== "islamic-umalqura") return "";
      var parts = fmt.formatToParts(date || new Date());
      var y = parts.filter(function (p) { return p.type === "year"; })[0];
      var m = parts.filter(function (p) { return p.type === "month"; })[0];
      return y && m ? (y.value + "-" + m.value) : "";
    } catch (e) { return ""; }
  }
  // goalChecks {lose_fat, gain_muscle, maintain} -> the single enum value the
  // API expects. Both fat-loss + muscle boxes checked together = recomp.
  function deriveGoal(checks) {
    if (checks.maintain) return "maintain";
    if (checks.lose_fat && checks.gain_muscle) return "recomp";
    if (checks.lose_fat) return "lose_fat";
    if (checks.gain_muscle) return "gain_muscle";
    return "";
  }
  function loadState() {
    var st = Object.assign(defaultState(), loadJSON(FORM_KEY, {}));
    var ps = planSex();
    if (ps) st.sex = ps;                       // plan is authoritative for sex
    if (["both", "diet", "workout"].indexOf(st.want) === -1) st.want = "both";
    ["allergies", "dislikes"].forEach(function (k) { if (!Array.isArray(st[k])) st[k] = []; });
    // reconcile goalChecks <-> goal (covers saved state from before the
    // checklist existed, or any drift between the two representations)
    if (!st.goalChecks || typeof st.goalChecks !== "object") {
      st.goalChecks = { lose_fat: st.goal === "lose_fat" || st.goal === "recomp",
        gain_muscle: st.goal === "gain_muscle" || st.goal === "recomp",
        maintain: st.goal === "maintain" };
    }
    ["lose_fat", "gain_muscle", "maintain"].forEach(function (k) { st.goalChecks[k] = !!st.goalChecks[k]; });
    st.goal = deriveGoal(st.goalChecks);
    st.ramadan = !!st.ramadan;
    st.ramadanManual = !!st.ramadanManual;
    st._ramadanSuggested = false;
    if (isHijriRamadan()) {
      var key = hijriKey();
      if (key && st.ramadanAuto !== key) {
        st.ramadan = true;
        st.ramadanAuto = key;
        st._ramadanSuggested = true;
        st.ramadanManual = false; // fresh auto-suggest for this Hijri month
      }
    } else if (st.ramadanAuto && st.ramadan && !st.ramadanManual) {
      // Ramadan ended and this "on" state came from the auto-suggest (never
      // touched by the user) — switch it back off so it doesn't stay on
      // indefinitely after Eid. A manual tick made outside Ramadan (tracked
      // via ramadanManual) is left alone.
      st.ramadan = false;
      saveSynced(FORM_KEY, st);
    }
    return st;
  }

  // ---------------- validation ----------------
  // Returns { errors: {field: msgKey|[msgKey,params]}, ok: bool }
  function validate(st) {
    var errors = {};
    Object.keys(NUM).forEach(function (name) {
      var spec = NUM[name];
      var raw = (st[name] == null ? "" : String(st[name])).trim();
      if (raw === "") { if (!spec.optional) errors[name] = ["vRequired"]; return; }
      var v = Number(raw);
      if (!isFinite(v)) { errors[name] = ["vRequired"]; return; }
      if (spec.int && !Number.isInteger(v)) { errors[name] = ["vInt"]; return; }
      if (name === "age" && v >= (spec.hardMin || 0) && v < spec.min) { errors[name] = ["vAgeMin"]; return; }
      if (v < spec.min || v > spec.max) {
        errors[name] = spec.unit ? ["vRangeU", { min: spec.min, max: spec.max, u: spec.unit }]
          : ["vRange", { min: spec.min, max: spec.max }];
      }
    });
    Object.keys(ENUMS).forEach(function (name) {
      if (name === "dietPreference" && st.want === "workout") return;
      if (ENUMS[name].indexOf(st[name]) === -1) errors[name] = ["vRequired"];
    });
    if (!(st.sex === "male" || st.sex === "female")) errors.sex = ["vRequired"];
    if ((st.notes || "").length > 300) errors.notes = ["vNotesMax"];
    return { errors: errors, ok: Object.keys(errors).length === 0 };
  }
  function msg(entry) {
    if (!entry) return "";
    var t = s(entry[0]), p = entry[1] || {};
    return t.replace(/\{(\w+)\}/g, function (_, k) { return p[k] != null ? p[k] : ""; });
  }

  // ---------------- network ----------------
  function fetchTimeout(url, opts) {
    opts = opts || {};
    var c = new AbortController();
    var timer = setTimeout(function () { c.abort(); }, CALL_TIMEOUT_MS);
    opts.signal = c.signal;
    return fetch(url, opts).finally(function () { clearTimeout(timer); });
  }
  function authToken() {
    return window.GymSync && GymSync.token ? GymSync.token() : null;
  }

  // ---------------- teaser ----------------
  function mascot(size, climb) {
    var svg = EtqademMascot.create({ size: size || 96, climb: !!climb });
    svg.setAttribute("class", svg.getAttribute("class") + " coach-pacer");
    return svg;
  }

  // small functional icon (e.g. for the "my plans" icon-button) — plain currentColor glyph.
  function plansIcon(size) {
    var px = size || 22;
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", px); svg.setAttribute("height", px);
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = '<path fill="currentColor" d="M7 3h10a2 2 0 0 1 2 2v16l-7-3-7 3V5a2 2 0 0 1 2-2z"/>';
    return svg;
  }

  function renderTeaser() {
    var bullets = h("ul", { class: "coach-bullets" },
      h("li", {}, s("teaseB1")), h("li", {}, s("teaseB2")), h("li", {}, s("teaseB3")));
    var btn = h("button", {
      class: "coach-primary", type: "button",
      on: { click: function () { if (window.GymUI) GymUI.promptSignIn(); } }
    }, s("signIn"));
    var card = h("div", { class: "coach-teaser card-fx" },
      mascot(112),
      h("h2", {}, s("teaseTitle")),
      h("p", { class: "coach-tease-body" }, s("teaseBody")),
      bullets, btn);
    mount(card);
  }

  // ---------------- form ----------------
  function numInput(name, value) {
    var spec = NUM[name];
    var a = { type: "number", inputmode: spec.int ? "numeric" : "decimal", name: name,
      value: value == null ? "" : value, min: spec.min, max: spec.max };
    if (spec.step) a.step = spec.step;
    else if (spec.int) a.step = "1";
    return h("input", a);
  }
  function selectInput(name, value) {
    var opts = ENUMS[name].map(function (v) {
      return h("option", { value: v, selected: v === value ? "selected" : false }, s(v));
    });
    return h.apply(null, ["select", { name: name }].concat(opts));
  }
  function field(labelKey, name, control, opts) {
    opts = opts || {};
    var lbl = h("span", { class: "coach-field-l" }, s(labelKey));
    if (opts.required) lbl.appendChild(h("span", { class: "req", "aria-hidden": "true" }, " *"));
    var fe = h("small", { class: "coach-fe", role: "alert", "data-fe": name || "" });
    var wrap = h("label", { class: "coach-field", "data-field": name || "" }, lbl, control, fe);
    if (opts.hint) wrap.appendChild(h("small", { class: "coach-hint" }, opts.hint));
    return wrap;
  }
  // same as field(), but wraps with <div> instead of <label> — for controls
  // (checkbox groups) that already contain their own nested <label>s.
  function fieldGroup(labelKey, name, control, opts) {
    opts = opts || {};
    var lbl = h("span", { class: "coach-field-l" }, s(labelKey));
    if (opts.required) lbl.appendChild(h("span", { class: "req", "aria-hidden": "true" }, " *"));
    var fe = h("small", { class: "coach-fe", role: "alert", "data-fe": name || "" });
    var wrap = h("div", { class: "coach-field", "data-field": name || "" }, lbl, control, fe);
    if (opts.hint) wrap.appendChild(h("small", { class: "coach-hint" }, opts.hint));
    return wrap;
  }
  // three checkboxes -> one goal enum. Checking Maintain clears the other
  // two (and vice versa); Lose fat + Build muscle together = recomposition.
  function goalChecklist(st, persist, refreshValidity) {
    var wrap = h("div", { class: "coach-goal-checks", role: "group", "aria-label": s("goal") });
    var order = ["lose_fat", "gain_muscle", "maintain"];
    var boxes = {};
    order.forEach(function (key) {
      var cb = h("input", { type: "checkbox", checked: st.goalChecks[key] ? "checked" : false });
      boxes[key] = cb;
      cb.addEventListener("change", function () {
        if (key === "maintain" && cb.checked) {
          boxes.lose_fat.checked = false; boxes.gain_muscle.checked = false;
          st.goalChecks.lose_fat = false; st.goalChecks.gain_muscle = false;
        } else if (key !== "maintain" && cb.checked) {
          boxes.maintain.checked = false; st.goalChecks.maintain = false;
        }
        st.goalChecks[key] = cb.checked;
        st.goal = deriveGoal(st.goalChecks);
        persist(); refreshValidity();
      });
      wrap.appendChild(h("label", { class: "coach-check" }, cb, h("span", {}, s(key))));
    });
    return wrap;
  }

  function chipsInput(name, values, onchange) {
    var arr = (values || []).slice();
    var wrap = h("div", { class: "coach-chips" });
    var input = h("input", { type: "text", placeholder: s("chipHint"), "data-chips": name });
    function redraw() {
      wrap.querySelectorAll(".coach-chip").forEach(function (c) { c.remove(); });
      arr.forEach(function (val, i) {
        var chip = h("span", { class: "coach-chip" }, val,
          h("button", { type: "button", "aria-label": "remove",
            on: { click: function () { arr.splice(i, 1); redraw(); if (onchange) onchange(arr.slice()); } } }, "×"));
        wrap.insertBefore(chip, input);
      });
      wrap._values = arr;
    }
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        var v = input.value.trim().replace(/,+$/, "");
        if (v && v.length <= 40 && arr.length < 10 && arr.indexOf(v) === -1) arr.push(v);
        input.value = "";
        redraw(); if (onchange) onchange(arr.slice());
      } else if (e.key === "Backspace" && !input.value && arr.length) {
        arr.pop(); redraw(); if (onchange) onchange(arr.slice());
      }
    });
    input.addEventListener("blur", function () {
      var v = input.value.trim().replace(/,+$/, "");
      if (v && v.length <= 40 && arr.length < 10 && arr.indexOf(v) === -1) { arr.push(v); input.value = ""; redraw(); if (onchange) onchange(arr.slice()); }
    });
    wrap.appendChild(input);
    redraw();
    return wrap;
  }

  function renderForm(preState) {
    var st = preState || loadState();
    var form = h("form", { class: "coach-form", novalidate: "novalidate" });

    function persist() { saveSynced(FORM_KEY, st); }
    function refreshValidity() {
      var v = validate(st);
      form.querySelectorAll("[data-field]").forEach(function (fEl) {
        var nm = fEl.getAttribute("data-field");
        var feEl = fEl.querySelector(".coach-fe");
        if (v.errors[nm]) { fEl.classList.add("bad"); if (feEl) feEl.textContent = msg(v.errors[nm]); }
        else { fEl.classList.remove("bad"); if (feEl) feEl.textContent = ""; }
      });
      submit.disabled = !v.ok;
      submit.classList.toggle("is-dim", !v.ok);
      topErr.hidden = v.ok;
      return v.ok;
    }
    // one delegated listener for every native control
    form.addEventListener("input", function (e) {
      var el = e.target;
      if (!el.name || !(el.name in st)) return;
      st[el.name] = el.value;
      persist(); refreshValidity();
    });
    form.addEventListener("change", function (e) {
      var el = e.target;
      if (!el.name || !(el.name in st)) return;
      st[el.name] = el.value;
      persist(); refreshValidity();
    });

    // want — segmented
    var wantWrap = h("div", { class: "seg", role: "group", "aria-label": s("want") });
    ["both", "diet", "workout"].forEach(function (w) {
      wantWrap.appendChild(h("button", {
        type: "button", "data-want": w, "aria-pressed": w === st.want ? "true" : "false",
        on: { click: function () {
          st.want = w;
          wantWrap.querySelectorAll("button").forEach(function (x) {
            x.setAttribute("aria-pressed", x.getAttribute("data-want") === w ? "true" : "false");
          });
          if (ibGroup) ibGroup.hidden = (w === "workout"); // InBody informs diet macros, not the workout
          if (dietGroup) dietGroup.hidden = (w === "workout"); // diet fields don't apply in workout-only mode
          persist();
        } }
      }, s(w === "both" ? "wantBoth" : w === "diet" ? "wantDiet" : "wantWorkout")));
    });
    var wantField = h("div", { class: "coach-field" }, h("span", { class: "coach-field-l" }, s("want")), wantWrap);
    var formHeaderRow = h("div", { class: "coach-form-header-row" }, wantField);
    var nSavedForHeader = loadSaved().length;
    if (nSavedForHeader > 0) {
      formHeaderRow.appendChild(h("button", {
        type: "button", class: "coach-icon-btn coach-myplans-icon",
        "aria-label": s("myPlansN").replace(/\{n\}/g, nSavedForHeader),
        title: s("myPlansN").replace(/\{n\}/g, nSavedForHeader),
        on: { click: renderMyPlans }
      }, [plansIcon(22)]));
    }
    form.appendChild(formHeaderRow);

    // sex control — locked to the plan when there is one
    var ps = planSex();
    var sexControl;
    if (ps) {
      st.sex = ps;
      sexControl = h("div", { class: "coach-locked" }, s(ps),
        h("input", { type: "hidden", name: "sex", value: ps }));
    } else {
      sexControl = h.apply(null, ["select", { name: "sex" },
        h("option", { value: "male", selected: st.sex === "male" ? "selected" : false }, s("male")),
        h("option", { value: "female", selected: st.sex === "female" ? "selected" : false }, s("female"))]);
    }

    // You
    form.appendChild(h("fieldset", { class: "coach-group" },
      h("legend", {}, s("grpYou")),
      h("div", { class: "coach-row" },
        field("age", "age", numInput("age", st.age), { required: true }),
        field("sex", "sex", sexControl, { required: !ps, hint: ps ? s("sexFromPlan") : "" })),
      h("div", { class: "coach-row" },
        field("heightCm", "heightCm", numInput("heightCm", st.heightCm), { required: true }),
        field("weightKg", "weightKg", numInput("weightKg", st.weightKg), { required: true }))));

    // Goal
    form.appendChild(h("fieldset", { class: "coach-group" },
      h("legend", {}, s("grpGoal")),
      fieldGroup("goal", "goal", goalChecklist(st, persist, refreshValidity), { required: true, hint: s("goalHint") }),
      field("activityLevel", "activityLevel", selectInput("activityLevel", st.activityLevel), { required: true })));

    // Training
    form.appendChild(h("fieldset", { class: "coach-group" },
      h("legend", {}, s("grpTraining")),
      h("div", { class: "coach-row" },
        field("trainingDaysPerWeek", "trainingDaysPerWeek", numInput("trainingDaysPerWeek", st.trainingDaysPerWeek), { required: true }),
        field("equipment", "equipment", selectInput("equipment", st.equipment), { required: true }))));

    // Ramadan mode — nameless checkbox (not part of the delegated
    // input/change listener above, which only handles st[el.name]); own
    // listener + persist(), auto-checked during Hijri month 9 by loadState().
    var ramadanCb = h("input", { type: "checkbox", checked: st.ramadan ? "checked" : false });
    var ramadanHintEl = h("small", { class: "coach-hint" }, st.ramadan && st._ramadanSuggested ? s("ramadanSuggest") : s("ramadanHint"));
    ramadanCb.addEventListener("change", function () {
      st.ramadan = ramadanCb.checked;
      st.ramadanManual = true; // explicit user choice — don't auto-clear this later
      st._ramadanSuggested = false; // manual toggle overrides the auto-suggest hint
      ramadanHintEl.textContent = s("ramadanHint");
      persist();
    });
    form.appendChild(h("fieldset", { class: "coach-group coach-ramadan" },
      h("label", { class: "coach-check" }, ramadanCb, h("span", {}, s("ramadan"))),
      ramadanHintEl));

    // Diet
    var allergies = chipsInput("allergies", st.allergies, function (a) { st.allergies = a; persist(); });
    var dislikes = chipsInput("dislikes", st.dislikes, function (a) { st.dislikes = a; persist(); });
    var dietGroup = h("fieldset", { class: "coach-group" },
      h("legend", {}, s("grpDiet")),
      field("dietPreference", "dietPreference", selectInput("dietPreference", st.dietPreference), { required: true }),
      field("allergies", "allergies", allergies),
      field("dislikes", "dislikes", dislikes));
    // diet preference/allergies/dislikes don't apply in workout-only mode
    dietGroup.hidden = st.want === "workout";
    form.appendChild(dietGroup);

    // InBody (collapsible, optional)
    var ibFile = h("input", { type: "file", id: "coachIbFile", class: "coach-ib-file", accept: IB_TYPES.join(",") });
    var ibStatus = h("p", { class: "coach-ib-status", role: "status", "aria-live": "polite" });
    var ibBusy = false;
    var ibConsentBusy = false, ibPending = ""; // ibPending: "grant" | "withdraw" while a request is in flight
    function ibGate() { ibFile.disabled = ibBusy || ibConsentBusy || !ibConsented; }
    function ibSay(text, kind) { ibStatus.textContent = text; ibStatus.className = "coach-ib-status" + (kind ? " is-" + kind : ""); }
    function ibClearMarks() {
      form.querySelectorAll(".is-prefilled").forEach(function (f) {
        f.classList.remove("is-prefilled");
        var t = f.querySelector(".coach-prefill-tag"); if (t) t.remove();
      });
    }
    function ibApply(data) {
      var n = 0;
      ibClearMarks();
      IB_FIELDS.forEach(function (k) {
        var v = Number(data && data[k]);
        if (data == null || data[k] == null || !isFinite(v)) return;
        v = (k === "visceralFatLevel" || k === "bmrKcal") ? Math.round(v) : round(v, 1);
        var input = form.querySelector('[name="' + k + '"]');
        if (!input) return;
        st[k] = String(v);
        input.value = st[k];
        var fEl = input.closest(".coach-field");
        if (fEl) {
          fEl.classList.add("is-prefilled");
          fEl.querySelector(".coach-field-l").appendChild(h("span", { class: "coach-prefill-tag" }, s("ibFromPhoto")));
        }
        n++;
      });
      persist(); refreshValidity();
      if (!n) { ibSay(s("ibNone"), "error"); return; }
      ibSay(msg(["ibFilled", { n: n }]), "ok");
    }
    function ibFail(status) {
      var key = status === 413 ? "ibTooBig" : status === 415 ? "ibErr415" : status === 422 ? "ibErr422"
        : status === 429 ? "ibErr429" : status === 503 ? "ibErr503" : "ibErrGen";
      ibSay(s(key), "error");
    }
    function ibUploadFile(file) {
      var token = authToken();
      if (!token) { if (window.GymUI) GymUI.promptSignIn(); return; }
      if (IB_TYPES.indexOf(file.type) === -1) { ibFail(415); return; }
      if (file.size > IB_IN_MAX) { ibFail(413); return; }
      ibBusy = true; ibGate();
      // The photo reader needs the AI Coach consent as well as its own.
      GymCoachConsent.ensure().then(function (ok) {
        if (!ok) { ibSay("", ""); return; }
        ibSay(s("ibReading"), "busy");
        return downscaleImage(file).then(function (blob) {
          return GymCoachConsent.run(function () {
            var fd = new FormData();
            fd.append("image", blob, "inbody.jpg");
            return fetchTimeout(ASSIST_BASE + "/inbody/extract", {
              method: "POST", headers: { "Authorization": "Bearer " + token }, body: fd
            }).then(function (res) {
              return res.json().catch(function () { return null; }).then(function (body) { return { status: res.status, body: body }; });
            });
          }, true);
        }).then(function (r) {
          if (!r) { ibSay("", ""); return; }
          if (r.status === 401) { ibSay("", ""); if (window.GymUI) GymUI.promptSignIn(); return; }
          if (r.status === 403) { ibSay("", ""); ibConsented = false; ibConsentedAt = ""; ibPaint(s("ibNeedConsent"), "error"); ibAgree.focus(); return; }
          if (GymCoachConsent.isUnavailable(r)) { ibSay(GymCoachConsent.unavailableText(), "error"); return; }
          if (r.status < 200 || r.status > 299 || !r.body) { ibFail(r.status === 200 ? 0 : r.status); return; }
          ibApply(r.body);
        });
      }).catch(function (err) {
        ibSay(s(err && err.message === "decode" ? "ibBadImg" : err && err.message === "toobig" ? "ibTooBig" : "ibErrGen"), "error");
      }).then(function () { ibBusy = false; ibGate(); });
    }
    ibFile.addEventListener("change", function () {
      var f = ibFile.files && ibFile.files[0];
      ibFile.value = ""; // picking the same photo again must fire change again
      if (f && !ibBusy) ibUploadFile(f);
    });
    // typing over a photo-filled value means the user has reviewed it
    form.addEventListener("input", function (e) {
      var fEl = e.target.closest && e.target.closest(".is-prefilled");
      if (!fEl) return;
      fEl.classList.remove("is-prefilled");
      var t = fEl.querySelector(".coach-prefill-tag"); if (t) t.remove();
    });
    var ibUpload = null, ibAgree = null, ibPaint = null;
    if (inbodyUploadOn()) {
      ibAgree = h("input", { type: "checkbox", id: "coachIbAgree" });
      var ibAgreedEl = h("span", { class: "coach-ib-agreed" });
      var ibWithdrawBtn = h("button", { type: "button", class: "coach-link", on: { click: function () { ibWithdraw(); } } }, s("ibWithdraw"));
      var ibMeta = h("p", { class: "coach-ib-repeat coach-ib-meta" }, ibAgreedEl, " ", ibWithdrawBtn);
      var ibMsg = h("p", { class: "coach-ib-cmsg", role: "status", "aria-live": "polite" });
      var ibAsk = h("div", { class: "coach-ib-ask" },
        h("p", { class: "coach-ib-notice" }, s("ibNotice")),
        h("label", { class: "coach-check coach-ib-agree", for: "coachIbAgree" }, ibAgree, h("span", {}, s("ibConsent"))),
        ibMeta, ibMsg);
      // text/kind: an optional message for the live region; the consent state itself comes from ibConsented.
      ibPaint = function (text, kind) {
        ibAgree.checked = ibPending ? ibPending === "grant" : ibConsented; // show the user's click while it is saved
        ibAgree.disabled = ibConsentBusy;
        ibMeta.hidden = !ibConsented;
        var when = ibConsented ? fmtDate(ibConsentedAt) : "";
        ibAgreedEl.textContent = when ? msg(["ibAgreedOn", { d: when }]) : s("ibAgreed");
        ibMsg.textContent = text || "";
        ibMsg.className = "coach-ib-cmsg" + (kind ? " is-" + kind : "");
        ibGate();
      };
      ibSync = function () { ibPaint(); };
      var ibWithdraw = function () {
        if (!ibConsented || ibConsentBusy) return;
        if (!authToken()) { ibPaint(s("ibWithdrawErr"), "error"); return; }
        ibConsentBusy = true; ibPending = "withdraw"; ibPaint();
        consentCall("DELETE", "/" + IB_CONSENT_TYPE).then(function (res) {
          if (!res.ok) throw new Error("withdraw");
          ibConsentBusy = false; ibPending = ""; ibConsented = false; ibConsentedAt = "";
          ibPaint(s("ibWithdrawn"), "ok"); ibAnnounce();
        }).catch(function () { ibConsentBusy = false; ibPending = ""; ibPaint(s("ibWithdrawErr"), "error"); });
      };
      var ibGrant = function () {
        if (!authToken()) { ibConsented = false; ibPaint(); if (window.GymUI) GymUI.promptSignIn(); return; }
        ibConsentBusy = true; ibPending = "grant"; ibPaint(s("ibSaving"), "busy");
        consentCall("POST", "", { type: IB_CONSENT_TYPE, textVersion: IB_CONSENT_VERSION, lang: lang() === "ar" ? "ar" : "en" })
          .then(function (res) {
            if (!res.ok) throw new Error("grant");
            return res.json().catch(function () { return null; });
          }).then(function (rec) {
            ibConsentBusy = false; ibPending = ""; ibConsented = true;
            ibConsentedAt = (rec && rec.grantedAt) || new Date().toISOString();
            ibPaint(); ibAnnounce();
          }).catch(function () { ibConsentBusy = false; ibPending = ""; ibConsented = false; ibPaint(s("ibConsentErr"), "error"); });
      };
      ibAgree.addEventListener("change", function () { if (ibAgree.checked) ibGrant(); else ibWithdraw(); });
      // On opening the form: is there an active record for this wording?
      if (authToken()) {
        ibConsentBusy = true;
        consentCall("GET", "").then(function (res) {
          if (!res.ok) throw new Error("get");
          return res.json();
        }).then(function (d) {
          var rec = activeInbodyConsent(d && d.consents);
          ibConsented = !!rec; ibConsentedAt = rec ? rec.grantedAt : "";
        }).catch(function () { ibConsented = false; ibConsentedAt = ""; })
          .then(function () { ibConsentBusy = false; ibPaint(); });
      } else { ibConsented = false; }
      ibUpload = h("div", { class: "coach-ib-upload" },
        h("h4", { class: "coach-ib-h" }, s("ibTitle")),
        ibAsk,
        h("p", { class: "coach-ib-crop" }, s("ibCrop")),
        h("div", { class: "coach-ib-btns" },
          ibFile,
          h("label", { class: "coach-ib-pick", for: "coachIbFile" }, s("ibChoose")),
          h("button", { type: "button", class: "coach-secondary coach-ib-type", on: { click: function () {
            ibUpload.hidden = true;
            var first = form.querySelector('input[name="bodyFatPct"]'); if (first) first.focus();
          } } }, s("ibTypeInstead"))),
        ibStatus);
      ibPaint();
    }
    var ibBody = h("div", { class: "coach-ib-body" },
      ibUpload,
      h("div", { class: "coach-row" },
        field("bodyFatPct", "bodyFatPct", numInput("bodyFatPct", st.bodyFatPct)),
        field("skeletalMuscleMassKg", "skeletalMuscleMassKg", numInput("skeletalMuscleMassKg", st.skeletalMuscleMassKg))),
      h("div", { class: "coach-row" },
        field("visceralFatLevel", "visceralFatLevel", numInput("visceralFatLevel", st.visceralFatLevel)),
        field("bmrKcal", "bmrKcal", numInput("bmrKcal", st.bmrKcal))));
    ibBody.hidden = !st.inbodyOpen;
    var ibToggle = h("button", {
      type: "button", class: "coach-ib-toggle", "aria-expanded": st.inbodyOpen ? "true" : "false",
      on: { click: function () {
        st.inbodyOpen = ibBody.hidden;
        ibBody.hidden = !ibBody.hidden;
        ibToggle.setAttribute("aria-expanded", st.inbodyOpen ? "true" : "false");
        persist();
      } }
    }, s("grpInBody"));
    // InBody informs diet/macro calc, not exercise selection — hide it in workout-only mode
    var ibGroup = h("fieldset", { class: "coach-group" }, ibToggle, ibBody);
    ibGroup.hidden = st.want === "workout";
    form.appendChild(ibGroup);

    // notes
    var notes = h("textarea", { name: "notes", maxlength: "300", rows: "3" });
    notes.value = st.notes || "";
    form.appendChild(h("fieldset", { class: "coach-group" },
      h("legend", {}, s("grpNotes")),
      field("notes", "notes", notes)));

    var topErr = h("p", { class: "coach-err", hidden: "hidden" }, s("vFixTop"));
    var submit = h("button", { type: "submit", class: "coach-primary" }, s("generate"));
    form.appendChild(topErr);
    form.appendChild(submit);
    // Entry point for the drag-and-drop custom workout builder
    // (workout-builder.js) — a sibling action to "Generate my plan" since
    // both live on the Coach screen and both end up mounting into the same
    // #coachBody. Always rendered, unconditionally: script defer order plus
    // a document.readyState fast-path elsewhere in this app means
    // renderForm() can run before workout-builder.js has registered
    // window.GymWorkoutBuilder on some cold-reload paths, and there's no
    // later re-render that would repair a button skipped here. Safety is
    // handled at the click-handler level instead (below), which already
    // null-checks window.GymWorkoutBuilder before calling it.
    form.appendChild(h("button", {
      type: "button", class: "coach-secondary",
      on: { click: function () { window.GymWorkoutBuilder && window.GymWorkoutBuilder.open(); } }
    }, s("wbEntryBtn")));

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!refreshValidity()) {
        var firstBad = form.querySelector(".coach-field.bad");
        if (firstBad && firstBad.scrollIntoView) firstBad.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      persist();
      runAssessment(buildRequest(st), false);
    });

    mount(h("div", {}, window.GymCheckin ? GymCheckin.renderCard() : null, form));
    refreshValidity();          // dim submit + show hints on first paint
  }

  function buildProfile(st) {
    var n = function (x) { return x === "" || x == null ? undefined : Number(x); };
    var profile = {
      age: parseInt(st.age, 10),
      sex: st.sex,
      heightCm: n(st.heightCm),
      weightKg: n(st.weightKg),
      goal: st.goal,
      activityLevel: st.activityLevel,
      trainingDaysPerWeek: parseInt(st.trainingDaysPerWeek, 10),
      equipment: st.equipment,
      dietPreference: st.dietPreference
    };
    if (st.allergies && st.allergies.length) profile.allergies = st.allergies;
    if (st.dislikes && st.dislikes.length) profile.dislikes = st.dislikes;
    if (st.notes) profile.notes = st.notes;
    var ib = {};
    ["bodyFatPct", "skeletalMuscleMassKg", "visceralFatLevel", "bmrKcal"].forEach(function (k) {
      if (st[k] !== "" && st[k] != null) ib[k] = n(st[k]);
    });
    if (Object.keys(ib).length) profile.inbody = ib;
    return profile;
  }
  function buildRequest(st) {
    var req = { want: st.want, lang: lang(), profile: buildProfile(st) };
    if (st.ramadan) req.ramadan = true; // omit when false: backend hash stays unchanged for normal plans
    return req;
  }
  // Current Ramadan-mode choice, for chat.js to add `ramadan:true` to its
  // own request without duplicating the form-state logic (out of scope here).
  function ramadanMode() {
    return !!loadState().ramadan;
  }
  // For the floating chat: the user's saved coach profile, only when it's
  // actually complete/valid — otherwise the chat just answers generally.
  function currentProfile() {
    var st = loadState();
    return validate(st).ok ? buildProfile(st) : null;
  }

  // Compact plain-text summary of the most recent result, for the floating
  // chat's context — so a follow-up question doesn't require re-explaining
  // the plan the coach itself just generated. Deliberately short (exercise
  // names + sets/reps, not full meal item lists) to keep the chat request
  // small. Returns "" when there's nothing to summarize.
  function planSummary() {
    var r = loadJSON(LAST_KEY, null);
    if (!r || !r.computed) return "";
    var c = r.computed;
    var lines = [];
    lines.push("Goal-driven target: ~" + Math.round(c.targetKcal || 0) + " kcal/day (protein " +
      Math.round(c.proteinG || 0) + "g, fat " + Math.round(c.fatG || 0) + "g, carbs " + Math.round(c.carbG || 0) + "g).");
    if (r.dietPlan) {
      var dp = r.dietPlan;
      var mealNames = (dp.meals || []).map(function (m) { return m.name; }).join(", ");
      lines.push("Diet (" + (dp.styleLabel || "") + "): " + mealNames + ".");
    }
    if (r.workoutPlan) {
      var wp = r.workoutPlan;
      lines.push("Workout split: " + (wp.split || "") + ", " + (wp.daysPerWeek || (wp.days || []).length) + " days/week.");
      (wp.days || []).forEach(function (d) {
        var exNames = (d.exercises || []).map(function (e) {
          return e.name + " " + (e.sets || "") + "x" + (e.reps || "");
        }).join(", ");
        lines.push((d.day || "Day") + ": " + exNames);
      });
    }
    return lines.join("\n");
  }

  // ---------------- run + result ----------------
  function renderLoading() {
    var rows = [];
    for (var i = 0; i < 4; i++) rows.push(h("div", { class: "skeleton", style: "height:56px;margin-bottom:10px" }));
    mount(h("div", { class: "coach-loading" },
      mascot(96, true),
      h("p", { class: "coach-ai-loading", role: "status" }, s("generating"),
        h("span", { class: "coach-dots", "aria-hidden": "true" }, h("i"), h("i"), h("i"))),
      h("div", {}, rows)));
  }

  // One assessment request at a time (GymAct.once holds until the promise settles).
  // `inflight` tracks it across tab switches: returning to Coach re-shows the
  // loading view, and a result that lands while the user is elsewhere is held
  // in `deferred` (painted on the next refresh) and announced by toast + nav dot.
  var inflight = false;
  var deferred = null;
  var runAssessment = GymAct.once(function (reqBody, strong) { return runAssessmentRaw(reqBody, strong); });
  function onCoach() { return document.body.getAttribute("data-tab") === "coach"; }
  function coachNavBtn() { return document.querySelector('#appNav button[data-tab="coach"]'); }
  function setWorking(on) {
    inflight = on;
    var b = coachNavBtn();
    if (!b) return;
    b.classList.toggle("is-working", on);
    if (on) b.setAttribute("aria-busy", "true"); else b.removeAttribute("aria-busy");
  }
  function setReadyDot(on) {
    var b = coachNavBtn();
    if (!b) return;
    var dot = b.querySelector(".nav-dot");
    if (on && !dot) {
      b.classList.add("has-update");
      b.appendChild(h("span", { class: "nav-dot" }, h("span", { class: "sr-only" }, s("navReady"))));
    } else if (!on && dot) {
      b.classList.remove("has-update");
      dot.remove();
    }
  }
  // navigate() flips data-tab inside the view transition, after refresh() ran,
  // so the dot clears off the attribute itself.
  new MutationObserver(function () { if (onCoach()) setReadyDot(false); })
    .observe(document.body, { attributes: true, attributeFilter: ["data-tab"] });
  // Paint `show` now when Coach is open; otherwise hold it for the return and
  // tell the user (toast with a button that opens Coach, plus the nav dot).
  function present(show, ok) {
    if (onCoach()) { show(); return; }
    deferred = show;
    setReadyDot(true);
    if (window.GymToast) {
      GymToast.show({
        message: s(ok ? "readyToast" : "failToast"),
        actionLabel: s(ok ? "readyOpen" : "failOpen"),
        onAction: function () { if (window.GymUI && GymUI.navigate) GymUI.navigate("coach"); },
        duration: 9000
      });
    }
  }
  function runAssessmentRaw(reqBody, strong) {
    var token = authToken();
    if (!token) { if (window.GymUI) GymUI.promptSignIn(); return; }
    var url = ASSIST_BASE + "/assessment" + (strong ? "?model=strong" : "");
    function post() {
      return fetchTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify(reqBody)
      }).then(function (res) {
        if (res.status === 401) { if (window.GymUI) GymUI.promptSignIn(); return null; }
        if (res.status === 429) { var reset = res.headers.get("X-RateLimit-Reset"); present(function () { renderQuota(reset); }, false); return null; }
        return res.json().then(function (body) { return { status: res.status, body: body }; })
          .catch(function () { return { status: res.status, body: null }; });
      });
    }
    // The AI Coach consent comes first; "Not now" leaves the form as it was.
    return GymCoachConsent.ensure().then(function (ok) {
      if (!ok) return;
      renderLoading();
      setWorking(true);
      return GymCoachConsent.run(post).then(function (r) {
        if (!r) return;
        handleAssessment(r, reqBody, strong);
      }).catch(function (err) {
        if (window.console) console.warn("[coach] assessment error", err && err.message);
        present(function () { renderError(reqBody, strong, 0); }, false);
      }).then(function () {
        setWorking(false);
        // 401 / sign-in prompts leave nothing to show: drop the stale loading view.
        if (onCoach() && document.querySelector("#coachBody .coach-ai-loading")) refresh();
      });
    });
  }
  function handleAssessment(r, reqBody, strong) {
    var code = r.status === 403 && r.body && r.body.error && (r.body.error.code || r.body.error);
    if ((code === "account_blocked" || code === "account_removed") && window.GymHeader && GymHeader.onBlocked) GymHeader.onBlocked(code === "account_removed");
    if (r.status === 200 && r.body) {
      r.body._reqStrong = strong;
      saveJSON(LAST_KEY, r.body);
      present(function () { renderResult(r.body); }, true);
    } else if (r.status === 422) {
      present(function () { renderRefusal((r.body && r.body.error && r.body.error.message) || ""); }, false);
    } else {
      if (window.console) console.warn("[coach] assessment failed", r.status, r.body);
      present(function () { renderError(reqBody, strong, GymCoachConsent.isUnavailable(r) ? "consent_unavailable" : r.status); }, false);
    }
  }

  // close any open tap-triggered tooltip when the user taps/clicks elsewhere
  document.addEventListener("click", function () {
    document.querySelectorAll(".coach-tip-btn.open").forEach(function (b) { b.classList.remove("open"); });
  });

  function statTile(labelKey, value, unit, explainKey, mod, sub) {
    var lbl = h("div", { class: "coach-stat-l" }, s(labelKey));
    if (explainKey) {
      var info = h("button", {
        type: "button", class: "coach-tip-btn", "aria-label": s(labelKey),
        on: { click: function (e) {
          e.stopPropagation();
          var open = !info.classList.contains("open");
          document.querySelectorAll(".coach-tip-btn.open").forEach(function (b) { b.classList.remove("open"); });
          if (open) info.classList.add("open");
        } }
      }, "i", h("span", { class: "coach-tip", role: "tooltip" }, s(explainKey)));
      lbl.appendChild(info);
    }
    return h("div", { class: "coach-stat" + (mod ? " " + mod : "") },
      h("div", { class: "coach-stat-v" }, String(value), unit ? h("span", {}, " " + unit) : null),
      lbl,
      sub ? h("div", { class: "coach-stat-sub" }, sub) : null);
  }

  // Donut of where the target calories come from (protein/carbs 4 kcal/g,
  // fat 9). Arcs grow in once on paint; reduced motion draws them finished.
  var SVG_NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function macroShares(c) {
    var kc = { p: (c.proteinG || 0) * 4, c: (c.carbG || 0) * 4, f: (c.fatG || 0) * 9 };
    var tot = kc.p + kc.c + kc.f;
    if (!(tot > 0)) return null;
    return { p: kc.p / tot, c: kc.c / tot, f: kc.f / tot };
  }
  function macroRing(sh) {
    var R = 46, C = 2 * Math.PI * R, GAP = 3.5;
    var pct = function (x) { return Math.round(x * 100); };
    var svg = svgEl("svg", { viewBox: "0 0 120 120", class: "coach-ring", role: "img",
      "aria-label": msg(["ringLabel", { p: pct(sh.p), c: pct(sh.c), f: pct(sh.f) }]) });
    svg.appendChild(svgEl("circle", { cx: 60, cy: 60, r: R, class: "coach-ring-track" }));
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var start = 0, arcs = [];
    ["p", "c", "f"].forEach(function (k) {
      var len = Math.max(0, sh[k] * C - GAP);
      var arc = svgEl("circle", { cx: 60, cy: 60, r: R, class: "coach-ring-arc coach-ring-" + k,
        transform: "rotate(-90 60 60)", "stroke-dashoffset": String(-start),
        "stroke-dasharray": reduce ? len + " " + (C - len) : "0 " + C });
      start += sh[k] * C;
      svg.appendChild(arc);
      arcs.push([arc, len]);
    });
    if (!reduce) {
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        arcs.forEach(function (a, i) {
          a[0].style.transitionDelay = (i * 140) + "ms";
          a[0].setAttribute("stroke-dasharray", a[1] + " " + (C - a[1]));
        });
      }); });
    }
    return svg;
  }

  function clip(t, n) {
    t = String(t == null ? "" : t).trim();
    if (t.length <= n) return t;
    var cut = t.slice(0, n), sp = cut.lastIndexOf(" ");
    return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-]+$/, "") + "…";
  }
  // 3-5 scannable bullets: up to 3 diet notes, then swaps, then whatever is left.
  function keyTips(r) {
    var dp = r.dietPlan || {}, wp = r.workoutPlan || {};
    var notes = (dp.notes || []).slice(), swaps = (dp.swaps || []).slice();
    var wnotes = (wp.notes || []).slice();
    var pool = [].concat(notes.splice(0, 3), swaps.splice(0, 2), notes, swaps, wnotes);
    var seen = {}, out = [];
    pool.forEach(function (t) {
      if (typeof t !== "string" || !t.trim() || seen[t] || out.length >= 5) return;
      seen[t] = 1; out.push(clip(t, 150));
    });
    if (out.length < 3 && dp.hydrationL) out.push(s("hydration") + ": " + dp.hydrationL + " " + s("liters"));
    return out;
  }

  // Collapsible section: <details> so long text stays reachable but out of the way.
  function details(title, bodyKids, opts) {
    opts = opts || {};
    var sum = h("summary", { class: "coach-details-sum" },
      h("span", { class: "coach-details-t" }, title),
      opts.meta ? h("span", { class: "coach-details-meta" }, opts.meta) : null);
    return h.apply(null, ["details", { class: "coach-details" + (opts.cls ? " " + opts.cls : ""), open: opts.open ? "open" : false }, sum]
      .concat([h.apply(null, ["div", { class: "coach-details-body" }].concat(bodyKids))]));
  }

  // Small standalone confirm modal, appended straight to <body> (not
  // #coachBody — that whole subtree gets replaced by mount(), which would
  // yank the modal out from under itself mid-interaction).
  function confirmUseAsWorkout(workoutPlan) {
    var overlay = h("div", { class: "coach-confirm-overlay" });
    function onKey(e) { if (e.key === "Escape") close(); }
    function close() { overlay.remove(); document.removeEventListener("keydown", onKey); }
    var no = h("button", { type: "button", class: "coach-secondary", on: { click: close } }, s("notNow"));
    var yes = h("button", {
      type: "button", class: "coach-primary", on: { click: function () {
        if (window.GymApplyCoachPlan) window.GymApplyCoachPlan(mapWorkout(workoutPlan));
        close();
        if (window.GymUI) GymUI.navigate("plan");
      } }
    }, s("useNow"));
    overlay.appendChild(h("div", { class: "coach-confirm-card" },
      h("p", {}, s("useAsWorkoutQ")),
      h("div", { class: "coach-confirm-actions" }, no, yes)));
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
  }

  function renderResult(r) {
    var c = r.computed || {};
    var sh = macroShares(c);
    var pct = function (k) { return sh ? Math.round(sh[k] * 100) + "%" : ""; };
    var ring = sh ? macroRing(sh) : null;
    var kcalTile = statTile("target", Math.round(c.targetKcal || 0), s("kcal") + s("perDay"), "targetExplain", "coach-stat--kcal");
    if (ring) kcalTile.insertBefore(h("div", { class: "coach-ring-wrap" }, ring), kcalTile.firstChild);
    var hero = h("div", { class: "coach-hero" },
      kcalTile,
      statTile("protein", Math.round(c.proteinG || 0), s("gram"), "proteinExplain", "coach-stat--macro coach-m-p", pct("p")),
      statTile("carb", Math.round(c.carbG || 0), s("gram"), "carbExplain", "coach-stat--macro coach-m-c", pct("c")),
      statTile("fat", Math.round(c.fatG || 0), s("gram"), "fatExplain", "coach-stat--macro coach-m-f", pct("f")));
    var chips = h("div", { class: "coach-chips" },
      statTile("bmi", round(c.bmi, 1), c.bmiClass ? (s(c.bmiClass) || c.bmiClass) : "", "bmiExplain", "coach-stat--chip"),
      statTile("bmr", Math.round(c.bmrKcal || 0), s("kcal"), "bmrExplain", "coach-stat--chip"),
      statTile("tdee", Math.round(c.tdeeKcal || 0), s("kcal"), "tdeeExplain", "coach-stat--chip"));
    var tips = r.dietPlan ? keyTips(r) : [];

    var sections = [
      h("div", { class: "coach-print-head" }, s("pdfTitle") + " — " + fmtDate(r.createdAt || Date.now())),
      h("div", { class: "coach-res-head" },
        mascot(48),
        h("div", {},
          h("div", { class: "coach-res-model" }, r.model || ""),
          h("h2", {}, s("resTargets"))))
    ];
    if (window.GymCheckin) sections.push(GymCheckin.renderCard());
    // stats (BMI/BMR/TDEE/macros) only make sense when a diet plan was generated;
    // also guards against a "both" response that came back missing dietPlan.
    if (r.want !== "workout" && r.dietPlan) { sections.push(hero); sections.push(chips); }
    if (tips.length && r.want !== "workout") {
      sections.push(h("section", { class: "coach-tips" },
        h("h3", {}, s("resTips")),
        h.apply(null, ["ul", {}].concat(tips.map(function (t) { return h("li", {}, t); })))));
    }
    if (r.summary) sections.push(details(s("resSummary"), [h("p", {}, r.summary)], { open: String(r.summary).length <= 180 }));
    if (r.dietPlan) sections.push(renderDiet(r.dietPlan));
    if (r.workoutPlan) sections.push(renderWorkout(r.workoutPlan, r.want === "workout" || !r.dietPlan));
    if (r.disclaimers && r.disclaimers.length) {
      sections.push(h("div", { class: "coach-disc" },
        h("h3", {}, s("disclaimers")),
        h.apply(null, ["ul", {}].concat(r.disclaimers.map(function (d) { return h("li", {}, d); })))));
    }

    // save-to-account button state
    var saved = isSaved(r);
    var full = !saved && loadSaved().length >= SAVED_MAX;
    var saveBtn = h("button", {
      type: "button", class: "coach-secondary", disabled: (saved || full) ? "disabled" : false,
      on: { click: function (e) {
        if (addSaved(r)) {
          e.target.textContent = s("savedTick"); e.target.disabled = true;
          if (r.workoutPlan && r.workoutPlan.days && r.workoutPlan.days.length) confirmUseAsWorkout(r.workoutPlan);
        }
      } }
    }, saved ? s("savedTick") : full ? s("savedFull").replace(/\{n\}/g, SAVED_MAX) : s("saveAcct"));

    var actions = h("div", { class: "coach-actions" },
      h("button", { type: "button", class: "coach-secondary", on: { click: openSub(refresh, renderForm) } }, s("btnNew")),
      r._reqStrong ? null : h("button", {
        type: "button", class: "coach-secondary",
        on: { click: function () { runAssessment(buildRequest(loadState()), true); } }
      }, s("btnDetail")),
      saveBtn,
      h("button", { type: "button", class: "coach-secondary", on: { click: downloadResultImage } }, s("shareImage")),
      (r.workoutPlan && r.workoutPlan.days && r.workoutPlan.days.length) ? h("button", {
        type: "button", class: "coach-primary",
        on: { click: function (e) {
          if (window.GymApplyCoachPlan) {
            window.GymApplyCoachPlan(mapWorkout(r.workoutPlan));
            e.target.textContent = s("applied"); e.target.disabled = true;
          }
        } }
      }, s("btnApply")) : null);

    var links = h("div", { class: "coach-links" },
      loadSaved().length ? h("button", {
        type: "button", class: "coach-icon-btn coach-myplans-icon",
        "aria-label": s("myPlansN").replace(/\{n\}/g, loadSaved().length),
        title: s("myPlansN").replace(/\{n\}/g, loadSaved().length),
        on: { click: renderMyPlans }
      }, [plansIcon(22)]) : null,
      h("button", { type: "button", class: "coach-link", on: { click: openSub(refresh, renderHistory) } }, s("btnHistory")),
      (window.GymChat && GymChat.open) ? h("button", {
        type: "button", class: "coach-link", on: { click: function () { GymChat.open(); } }
      }, s("askCoach")) : null);

    sections.push(actions);
    sections.push(links);
    mount(h.apply(null, ["div", { class: "coach-result" }].concat(sections)));
  }

  function wantKey(want) { return want === "diet" ? "wantDiet" : want === "workout" ? "wantWorkout" : "wantBoth"; }

  // A couple of quick-glance numbers so a card is useful before opening it —
  // whatever's available (My Plans has the full saved result; server history
  // list rows don't carry this, so those cards just show fewer facts).
  function planPreview(res) {
    var bits = [];
    if (res.computed && res.computed.targetKcal) bits.push(Math.round(res.computed.targetKcal) + " " + s("kcal") + s("perDay"));
    if (res.workoutPlan && res.workoutPlan.split) bits.push(res.workoutPlan.split);
    else if (res.dietPlan && res.dietPlan.styleLabel) bits.push(res.dietPlan.styleLabel);
    return bits;
  }

  // Shared card for both My Plans and History — was a single underlined
  // "Open" link in a thin text row; now an actual card with a date, a
  // want/model tag, an optional stat preview, and a real button.
  function planCard(opts) {
    var info = h("div", { class: "coach-plan-card-info" },
      h("div", { class: "coach-plan-card-date" }, opts.date),
      h("div", { class: "coach-tag" }, s(wantKey(opts.want)) + (opts.model ? "  ·  " + opts.model : "")));
    var top = h("div", { class: "coach-plan-card-top" }, info,
      opts.onDelete ? h("button", {
        type: "button", class: "coach-plan-card-del", "aria-label": s("del"),
        on: { click: opts.onDelete }
      }, "×") : null);
    var preview = opts.preview && opts.preview.length
      ? h("div", { class: "coach-plan-card-preview" }, opts.preview.join("  ·  ")) : null;
    return h("div", { class: "coach-plan-card card-fx" }, top, preview,
      h("button", { type: "button", class: "coach-secondary", on: { click: opts.onOpen } }, s("histOpen")));
  }

  function renderMyPlans() {
    var arr = loadSaved();
    var head = h("div", { class: "coach-myplans-head" },
      h("button", { type: "button", class: "coach-secondary", on: { click: leave } }, s("back")),
      h("h2", {}, s("myPlans")));
    var body;
    if (!arr.length) {
      body = h("div", { class: "coach-state card-fx" }, h("p", {}, s("savedEmpty")));
    } else {
      body = h("div", { class: "coach-plan-list" });
      arr.forEach(function (p, i) {
        var res = p.result || {};
        body.appendChild(planCard({
          date: fmtDate(p.savedAt), want: res.want, model: res.model, preview: planPreview(res),
          onOpen: function () { sub(renderMyPlans); renderResult(res); },
          onDelete: function () {
            if (window.confirm(s("delConfirm"))) { removeSaved(i); renderMyPlans(); }
          }
        }));
      });
    }
    mount(h("div", { class: "coach-myplans" }, head,
      h("p", { class: "coach-sub-line" }, s("savedCap").replace(/\{n\}/g, SAVED_MAX)),
      body));
  }

  // A diet item is either the old plain string (cached results from before
  // this field existed — never migrated, so must always be handled) or the
  // new { text, gramsApprox } shape. Always show a gram reference when one's
  // available, so nobody unfamiliar with the stated unit (oz, cups, ...) is
  // left guessing.
  function mealItemText(it) {
    if (it == null) return "";
    if (typeof it === "string") return it;
    var text = it.text != null ? it.text : String(it);
    var g = Number(it.gramsApprox);
    if (g > 0) text += " (~" + g + s("gram") + ")";
    return text;
  }

  function renderDiet(dp) {
    var kids = [h("h3", {}, s("resDiet"))];
    if (dp.styleLabel) kids.push(h("div", { class: "coach-tag" }, dp.styleLabel));
    var cards = (dp.meals || []).map(function (m) {
      return h("article", { class: "coach-mcard" },
        h("div", { class: "coach-mcard-top" },
          h("h4", {}, m.name),
          h("div", { class: "coach-mcard-kcal" }, h("b", {}, String(Math.round(m.kcal || 0))), " " + s("kcal"))),
        m.proteinG ? h("div", { class: "coach-mcard-prot" }, m.proteinG + " " + s("gram") + " " + s("protein")) : null,
        h.apply(null, ["ul", {}].concat((m.items || []).map(function (it) { return h("li", {}, mealItemText(it)); }))));
    });
    if (cards.length) kids.push(h.apply(null, ["div", { class: "coach-meals" }].concat(cards)));
    if (dp.hydrationL) kids.push(h("p", { class: "coach-sub-line" }, s("hydration") + ": " + dp.hydrationL + " " + s("liters")));
    if (dp.swaps && dp.swaps.length) kids.push(details(s("swaps"),
      [h.apply(null, ["ul", { class: "coach-notelist" }].concat(dp.swaps.map(function (x) { return h("li", {}, x); })))]));
    if (dp.notes && dp.notes.length) kids.push(details(s("notes"),
      [h.apply(null, ["ul", { class: "coach-notelist" }].concat(dp.notes.map(function (x) { return h("li", {}, x); })))]));
    return h.apply(null, ["div", { class: "coach-block" }].concat(kids));
  }

  function renderWorkout(wp, open) {
    var meta = [];
    if (wp.split) meta.push(s("split") + ": " + wp.split);
    if (wp.daysPerWeek) meta.push(wp.daysPerWeek + " " + s("daysWk"));
    var kids = [];
    (wp.days || []).forEach(function (d) {
      var ex = (d.exercises || []).map(function (e) {
        return h("div", { class: "coach-ex" },
          h("span", { class: "coach-ex-n" }, e.name),
          h("span", { class: "coach-ex-m" }, (e.sets || "") + " × " + (e.reps || "") + "  ·  " + (e.restSec || 0) + "s " + s("restS")));
      });
      kids.push(h.apply(null, ["div", { class: "coach-wday card-fx" }, h("b", {}, d.day || "")].concat(ex)));
    });
    if (wp.progression) kids.push(h("p", { class: "coach-sub-line" }, s("progression") + ": " + wp.progression));
    if (wp.cardio) kids.push(h("p", { class: "coach-sub-line" }, s("cardio") + ": " + wp.cardio));
    if (wp.notes && wp.notes.length) kids.push(h.apply(null, ["ul", { class: "coach-notelist" }].concat(wp.notes.map(function (x) { return h("li", {}, x); }))));
    return details(s("resWorkout"), kids, { open: open, meta: meta.join("  ·  "), cls: "coach-workout" });
  }

  function mapWorkout(wp) {
    return (wp.days || []).map(function (d, i) {
      return {
        id: "coach_" + i,
        label: d.day || ("Day " + (i + 1)),
        muscles: wp.split || "",
        exercises: (d.exercises || []).map(function (e, j) {
          var o = { id: "coach_" + i + "_" + j, en: e.name, sets: e.sets || 3, reps: e.reps || "", rest: e.restSec || 90 };
          var vid = window.GymExerciseVideo ? window.GymExerciseVideo(e.name) : "";
          if (vid) o.vid = vid;   // reuse the app's demo clip when the move matches
          return o;
        })
      };
    });
  }

  function renderQuota(resetIso) {
    // new Date(null) / new Date("") silently gives the Unix epoch, not a
    // throw — an absent/unreadable header must not render "Jan 1 1970".
    var body = s("quotaBodyGeneric");
    if (resetIso) {
      var d = new Date(resetIso);
      if (!isNaN(d.getTime())) {
        body = s("quotaBody").replace("{t}", d.toLocaleString(lang() === "ar" ? "ar-EG" : "en-US"));
      }
    }
    mount(h("div", { class: "coach-state card-fx" },
      h("h2", {}, s("quotaTitle")),
      h("p", {}, body),
      h("button", { type: "button", class: "coach-secondary", on: { click: function () { renderForm(); } } }, s("btnNew"))));
  }
  function renderError(reqBody, strong, status) {
    mount(h("div", { class: "coach-state card-fx" },
      h("h2", {}, s("errTitle")),
      h("p", {}, status === 502 ? s("err502") : status === "consent_unavailable" ? GymCoachConsent.unavailableText() : s("errBody")),
      h("div", { class: "coach-actions" },
        reqBody ? h("button", { type: "button", class: "coach-primary", on: { click: function () { runAssessment(reqBody, strong); } } }, s("retry")) : null,
        h("button", { type: "button", class: "coach-secondary", on: { click: function () { renderForm(); } } }, s("btnNew")))));
  }
  function renderRefusal(m) {
    mount(h("div", { class: "coach-state card-fx" },
      h("h2", {}, s("refusedTitle")),
      h("p", {}, m || s("errBody")),
      h("button", { type: "button", class: "coach-secondary", on: { click: function () { renderForm(); } } }, s("back"))));
  }

  function renderHistory() {
    var token = authToken();
    if (!token) { if (window.GymUI) GymUI.promptSignIn(); return; }
    // P-13 (skeleton loading, audit §4.6): list-shaped shimmer instead of a
    // bare spinner — matches the plan-card rows this list resolves into.
    var skelRows = [];
    for (var i = 0; i < 3; i++) skelRows.push(h("div", { class: "skeleton", style: "height:72px;margin-bottom:10px", "aria-hidden": "true" }));
    mount(h("div", { class: "coach-hist" }, h("div", { "aria-hidden": "true" }, skelRows)));
    fetchTimeout(ASSIST_BASE + "/history?limit=20", { headers: { "Authorization": "Bearer " + token } })
      .then(function (r) { return r.json(); }).then(function (doc) {
        var items = (doc && doc.items) || [];
        var body = items.length
          ? h.apply(null, ["div", { class: "coach-plan-list" }].concat(items.map(function (it) {
              var when = it.createdAt;
              try { when = new Date(it.createdAt).toLocaleDateString(lang() === "ar" ? "ar-EG" : "en-US", { month: "short", day: "numeric" }); } catch (e) {}
              return planCard({ date: when, want: it.want, model: it.model, onOpen: function () { sub(renderHistory); openHistory(it.id); } });
            })))
          : h("div", { class: "coach-state card-fx" }, h("p", {}, s("histEmpty")));
        mount(h("div", { class: "coach-hist" },
          h("button", { type: "button", class: "coach-secondary", on: { click: leave } }, s("back")),
          body));
      }).catch(function () { renderError(null, false, 0); });
  }
  function openHistory(id) {
    var token = authToken();
    if (!token) return;
    mount(h("div", { class: "coach-loading" }, h("div", { class: "coach-spin" })));
    fetchTimeout(ASSIST_BASE + "/assessment/" + encodeURIComponent(id), { headers: { "Authorization": "Bearer " + token } })
      .then(function (r) { return r.json(); }).then(function (body) {
        if (body && body.computed) renderResult(body); else renderError(null, false, 0);
      }).catch(function () { renderError(null, false, 0); });
  }

  function round(v, n) { var p = Math.pow(10, n || 0); return Math.round((parseFloat(v) || 0) * p) / p; }

  // ---------------- entry ----------------
  function refresh() {
    if (!document.getElementById("coachBody")) return;
    var authed = window.GymUI && GymUI.isAuthed && GymUI.isAuthed();
    if (!authed) { deferred = null; renderTeaser(); return; }
    if (inflight) { renderLoading(); return; }
    if (deferred) { var d = deferred; deferred = null; d(); return; }
    var last = loadJSON(LAST_KEY, null);
    if (last && last.computed) renderResult(last);
    else renderForm();
  }

  window.GymCoach = { refresh: refresh, currentProfile: currentProfile, newAssessment: openSub(refresh, renderForm), planSummary: planSummary, ramadan: ramadanMode, showResult: renderResult, myPlans: openSub(refresh, renderMyPlans) };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (document.body.getAttribute("data-tab") === "coach") refresh();
    });
  } else if (document.body.getAttribute("data-tab") === "coach") {
    refresh();
  }
})();
