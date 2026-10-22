/* tour.js — short tips for each main screen (#tour).
 *
 * Signed-in users only. The first time they open Plan, Coach, Food, Watch or
 * More, a spotlight walks through up to 6 real controls with one line each.
 * gym_tours_seen (synced, so a new device doesn't repeat them) is
 * { screen: version }: a screen is done once its stored version reaches
 * VERSION[screen]. A legacy 1 means "saw v1". Every step says which version
 * added it (since), so a returning user sees only the steps newer than what
 * they saw, once, and never more than one such screen per cold start. Never
 * runs while the survey, sign-in screen, a dialog or a workout is up.
 * "Replay tips" in the avatar menu clears the list. */
(function () {
  "use strict";

  var SEEN_KEY = "gym_tours_seen";
  var RET_KEY = "etqtour_ret";      // sessionStorage: a returning-user tour already ran this cold start
  var HINT_KEY = "etqtour_hint";    // localStorage (device): the "Tips live in your avatar menu" toast was shown

  // Bump a screen's number when it gains steps; give those steps since: <new number>.
  // "watch" is the connected Watch tab, "watchOff" the not-connected one.
  var VERSION = { plan: 2, coach: 2, food: 2, more: 2, watch: 1, watchOff: 1 };

  var STR = {
    skip: ["Skip", "تخطي"],
    next: ["Next", "التالي"],
    done: ["Got it", "تمام"],
    stepOf: ["{n} of {t}", "{n} من {t}"],
    planDays: ["Pick today's workout here. Your days follow your training split.", "اختر تمرين اليوم من هنا. وأيامك تتبع تقسيم التمرين الذي اخترته."],
    planStart: ["Start the timer when you begin. It keeps running if you switch screens.", "شغّل المؤقت عند البدء. يستمر حتى لو انتقلت لشاشة أخرى."],
    planRest: ["Tick each set when you finish it. The rest timer starts by itself.", "علّم كل مجموعة عند إنهائها. ويبدأ مؤقت الراحة تلقائيًا."],
    planMuscles: ["These are today's muscles. Tap one to jump to its exercises.", "هذه عضلات اليوم. اضغط على إحداها لتنتقل إلى تمارينها."],
    planRestDays: ["Tap a day to see or fix what you did. Mark up to 2 rest days a week and your streak stays safe.", "اضغط على يوم لترى ما أنجزته أو لتعدّله. سجّل حتى يومي راحة في الأسبوع وتبقى سلسلتك آمنة."],
    planMap: ["See which muscles you trained this week. Open it and tap a body part.", "شاهد العضلات التي تمرّنتها هذا الأسبوع. افتحها واضغط على جزء من الجسم."],
    planWatchTab: ["New: the Watch tab shows your steps, sleep and heart rate.", "جديد: تبويب ساعتي يعرض خطواتك ونومك ونبضك."],
    coachForm: ["Fill in your numbers, then tap the button. You get a diet and training plan.", "أدخل أرقامك ثم اضغط الزر. تحصل على خطة غذاء وتمرين."],
    coachBuild: ["Prefer your own plan? Build a workout yourself instead.", "تفضّل خطتك الخاصة؟ ابنِ تمرينك بنفسك بدل ذلك."],
    coachInbody: ["Have an InBody or DEXA printout? A photo of it fills in the numbers for you.", "عندك نتيجة InBody أو DEXA؟ صورة منها تملأ الأرقام لك."],
    coachBubble: ["Tap the bubble to chat with the coach from any screen. Drag it where it is out of your way.", "اضغط الفقاعة لتتحدث مع المدرب من أي شاشة. واسحبها إلى مكان لا يزعجك."],
    foodTotals: ["Your calories and protein for the day. They are measured against your Coach plan.", "سعراتك وبروتينك لليوم. وتُقاس مقابل خطتك في المدرب."],
    foodSearch: ["Search a food, enter the grams, choose the meal. Egyptian and Gulf foods are included.", "ابحث عن طعام وأدخل الجرامات واختر الوجبة. والأطعمة المصرية والخليجية موجودة."],
    foodDate: ["Switch days to see or fix past meals.", "غيّر اليوم لترى وجبات سابقة أو تعدّلها."],
    foodCoach: ["Skip the typing. Tell the coach what you ate, or send a photo, and it adds it here after you confirm.", "اختصر الكتابة. أخبر المدرب بما أكلته أو أرسل صورة، فيضيفه هنا بعد تأكيدك."],
    morePlan: ["Switch between the male and female plans.", "بدّل بين الخطة الرجالية والنسائية."],
    moreStyle: ["Train at the gym or at home.", "تمرّن في الجيم أو في البيت."],
    moreSplit: ["Choose how many days a week you train and what equipment you have. Your plan rebuilds to fit.", "اختر كم يومًا تتمرّن في الأسبوع وما المعدات المتاحة. وتُعاد خطتك لتناسبك."],
    moreDays: ["Pick your training days to get reminders.", "اختر أيام تمرينك لتصلك التذكيرات."],
    morePrivacy: ["Download or delete your data any time. Read the privacy policy and terms here.", "نزّل بياناتك أو احذفها في أي وقت. واقرأ سياسة الخصوصية والشروط هنا."],
    watchConnect: ["Connect your watch to fill this screen. It takes about a minute.", "اربط ساعتك لتمتلئ هذه الشاشة. يستغرق ذلك دقيقة تقريبًا."],
    watchDial: ["Your day at a glance: steps, active calories and sleep. The rings fill as you near each goal.", "يومك في لمحة: الخطوات والسعرات النشطة والنوم. وتمتلئ الحلقات كلما اقتربت من هدفك."],
    watchTrend: ["Switch between steps, calories, sleep and heart rate. Tap a bar to see that day.", "بدّل بين الخطوات والسعرات والنوم والنبض. واضغط على عمود لترى ذلك اليوم."],
    watchTrained: ["Dots mark the days you finished a workout, so you can compare them with your numbers.", "تعلّم النقاط الأيام التي أنهيت فيها تمرينًا، لتقارنها بأرقامك."],
    watchPrivacy: ["Your watch data stays on this phone. You can disconnect any time.", "تبقى بيانات ساعتك على هذا الهاتف. ويمكنك فصلها في أي وقت."],
    hint: ["Tips live in your avatar menu: Replay tips.", "تجد النصائح في قائمة صورتك: إعادة عرض النصائح."]
  };

  // Each step: first matching visible selector wins; steps with no visible
  // target are dropped. since: the VERSION that added it (default 1); only:
  // "new" = people who never saw the screen, "returning" = a version bump only;
  // once: explained on one screen per user, whichever they see first (the coach
  // bubble is on Plan and More; Food has its own line about logging meals).
  var BUBBLE = { sel: ["#coachFab"], text: "coachBubble", since: 2, once: "bubble" };
  var TOURS = {
    plan: [
      { sel: ["#dayTabs"], text: "planDays" },
      { sel: ["#sessionBtn"], text: "planStart" },
      { sel: ["#exList .ex-card .set-chk", "#exList .ex-card [data-rest]", "#exList .ex-card"], text: "planRest" },
      { sel: ["#dayMuscleTiles .mus-tile"], text: "planMuscles", since: 2 },
      { sel: ["#calendarStrip .cal-strip"], text: "planRestDays", since: 2 },
      { sel: ["#weekMap .wm-sum"], text: "planMap", since: 2, only: "returning" },
      { sel: ['#appNav [data-tab="watch"]'], text: "planWatchTab", since: 2, only: "returning" },
      BUBBLE
    ],
    coach: [
      { sel: ["#coachBody form .coach-primary", "#coachBody form", "#coachBody .coach-primary"], text: "coachForm" },
      { sel: ["#coachBody .coach-secondary"], text: "coachBuild", since: 2 },
      { sel: ["#coachBody .coach-ib-toggle"], text: "coachInbody", since: 2 }
    ],
    food: [
      { sel: ["#foodTotalsHost > *", "#foodTotalsHost"], text: "foodTotals" },
      { sel: ["#foodSearchInput", "#foodBody .food-search"], text: "foodSearch" },
      { sel: ["#foodBody .food-date-switch"], text: "foodDate" },
      { sel: ["#coachFab"], text: "foodCoach", since: 2 }
    ],
    more: [
      { sel: ["#screen-more .plan-toggle"], text: "morePlan" },
      { sel: ["#styleToggle"], text: "moreStyle" },
      { sel: ["#moreSplit"], text: "moreSplit", since: 2 },
      { sel: ["#moreTrainingDays > *", "#moreTrainingDays"], text: "moreDays" },
      { sel: ["#morePrivacy"], text: "morePrivacy", since: 2 },
      BUBBLE
    ],
    watchOff: [
      { sel: ["#wtConnectCard .wt-btn-primary"], text: "watchConnect" }
    ],
    watch: [
      { sel: ["#wtDial"], text: "watchDial" },
      { sel: ["#wtMetricTabs"], text: "watchTrend" },
      { sel: ["#wtTrained"], text: "watchTrained" },
      { sel: ["#wtPrivacy"], text: "watchPrivacy" }
    ]
  };

  function lang() { return document.documentElement.lang === "ar" ? "ar" : "en"; }
  function s(k, vars) {
    var v = STR[k] ? STR[k][lang() === "ar" ? 1 : 0] : k;
    if (vars) Object.keys(vars).forEach(function (n) { v = v.replace("{" + n + "}", vars[n]); });
    return v;
  }

  // ---------------- seen list (synced) ----------------
  function readSeen() {
    try { var o = JSON.parse(localStorage.getItem(SEEN_KEY)); return o && typeof o === "object" ? o : {}; }
    catch (e) { return {}; }
  }
  function writeSeen(o) {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(o)); } catch (e) {}
    try { if (window.GymSync && GymSync.onLocalWrite) GymSync.onLocalWrite(SEEN_KEY); } catch (e) {}
  }
  // Never lowers a stored version: the value is re-read first (sync may have
  // brought a newer one from another device), so an older build writing 1
  // cannot reset a 2.
  function markSeen(tab, version) {
    var o = readSeen();
    if (!(o[tab] >= version)) o[tab] = version;
    writeSeen(o);
  }

  // The steps this person should see on a screen, or null when it is done.
  // Never saw it: every step but the returning-only ones; saw an older
  // version: only the newer steps.
  function stepsFor(key) {
    var defs = TOURS[key], seen = readSeen(), cur = Number(seen[key]) || 0;
    if (!defs || cur >= VERSION[key]) return null;
    var steps = defs.filter(function (d) {
      if (d.once && seen[d.once]) return false;
      if (cur > 0) return (d.since || 1) > cur && d.only !== "new";
      return d.only !== "returning";
    });
    if (!steps.length) { markSeen(key, VERSION[key]); return null; }   // nothing new for this person
    return steps;
  }
  // A screen's tour key: the Watch tab has two (connected or not); none where it only explains.
  function tourKey() {
    var tab = currentTab();
    if (tab !== "watch") return tab;
    var w = window.GymWatch && GymWatch.state ? GymWatch.state() : null;
    if (!w) return null;
    if (w.on) return "watch";
    return w.plugin && w.avail === "ok" ? "watchOff" : null;
  }
  function session(k, v) {
    try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {}
    return null;
  }

  // ---------------- when it may run ----------------
  function authed() { return !!(window.GymHeader && GymHeader.isAuthed && GymHeader.isAuthed()); }
  function workoutRunning() {
    if (document.querySelector("#miniTimer.show, #timerBar.show")) return true;
    var card = document.getElementById("sessionCard");
    return !!(card && card.classList.contains("active"));
  }
  function surveyPending() {
    var sv = window.GymSurvey;
    if (!sv) return false;
    return typeof sv.isPending === "function" ? !!sv.isPending() : true;
  }
  function blocked(force) {
    var b = document.body.classList;
    if (b.contains("onboarding-open") || b.contains("survey-open")) return true;
    var me = window.GymHeader && GymHeader.me ? GymHeader.me() : null;
    if (!me) return true;                               // /me not loaded yet
    // The survey comes first, but only when this build has one that is about
    // to open: without survey.js every /me says onboardingCompleted:false
    // and the tips would never run.
    if (!force && me.onboardingCompleted === false && surveyPending()) return true;
    if (workoutRunning()) return true;
    // another sheet/dialog is open (consent, calendar, video, menus...)
    var ds = document.querySelectorAll('[role="dialog"], dialog[open], #videoModal.show, .tb-menu');
    for (var i = 0; i < ds.length; i++) {
      var d = ds[i];
      if (d.closest("#tour") || d.hidden || d.closest("[hidden]")) continue;
      if (visible(d)) return true;
    }
    return false;
  }
  function currentTab() { return document.body.getAttribute("data-tab") || "plan"; }

  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  }
  function resolve(step) {
    for (var i = 0; i < step.sel.length; i++) {
      var el = document.querySelector(step.sel[i]);
      if (visible(el)) return el;
    }
    return null;
  }

  // ---------------- UI ----------------
  var root, spot, card, textEl, countEl, skipBtn, nextBtn;
  var run = null; // { tab, steps:[{el,text}], i }

  function build() {
    if (root) return;
    root = document.createElement("div");
    root.id = "tour";
    root.hidden = true;
    root.innerHTML =
      '<div class="tour-spot" aria-hidden="true"></div>' +
      '<div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourText">' +
      '  <p class="tour-text" id="tourText"></p>' +
      '  <div class="tour-foot">' +
      '    <span class="tour-count"></span>' +
      '    <button type="button" class="tour-skip"></button>' +
      '    <button type="button" class="tour-next"></button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(root);
    spot = root.querySelector(".tour-spot");
    card = root.querySelector(".tour-card");
    textEl = root.querySelector(".tour-text");
    countEl = root.querySelector(".tour-count");
    skipBtn = root.querySelector(".tour-skip");
    nextBtn = root.querySelector(".tour-next");
    skipBtn.addEventListener("click", function () { end(); });
    nextBtn.addEventListener("click", function () { step(1); });
    // Taps outside the card are swallowed (the spotlight is a guide, not a
    // shortcut), except they don't trap: Escape and Skip always work.
    root.addEventListener("click", function (e) { if (e.target === root) e.stopPropagation(); });
    root.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); end(); }
      else if (e.key === "Tab") {           // keep focus on the two buttons
        e.preventDefault();
        (document.activeElement === nextBtn ? skipBtn : nextBtn).focus();
      }
    });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
  }

  function start(tab) {
    var defs = stepsFor(tab);
    if (!defs || (run && run.tab === tab)) return false;
    var steps = [];
    defs.forEach(function (d) { var el = resolve(d); if (el) steps.push({ el: el, text: d.text, once: d.once }); });
    if (!steps.length) return false; // screen not ready yet
    build();
    run = { tab: tab, screen: currentTab(), steps: steps, i: 0, lastFocus: document.activeElement };
    root.hidden = false;
    document.body.classList.add("tour-open");
    show();
    return true;
  }

  function show() {
    var st = run.steps[run.i];
    var last = run.i === run.steps.length - 1;
    textEl.textContent = s(st.text);
    countEl.textContent = run.steps.length > 1 ? s("stepOf", { n: run.i + 1, t: run.steps.length }) : "";
    skipBtn.textContent = s("skip");
    skipBtn.hidden = last;
    nextBtn.textContent = s(last ? "done" : "next");
    try { st.el.scrollIntoView({ block: "center", behavior: "instant" }); } catch (e) { st.el.scrollIntoView(); }
    card.classList.remove("tour-in");
    void card.offsetWidth;
    card.classList.add("tour-in");
    place();
    try { nextBtn.focus({ preventScroll: true }); } catch (e) {}
  }

  // Spotlight over the target; card below it, or above when there's no room.
  function place() {
    if (!run || !root || root.hidden) return;
    var el = run.steps[run.i].el;
    if (!document.body.contains(el)) { end(); return; }
    var r = el.getBoundingClientRect();
    var pad = 6;
    var vw = window.innerWidth, vh = window.innerHeight;
    var x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad);
    var w = Math.min(vw - 8, r.width + pad * 2), hgt = Math.min(vh - 8, r.height + pad * 2);
    spot.style.transform = "translate(" + x + "px," + y + "px)";
    spot.style.width = w + "px";
    spot.style.height = hgt + "px";

    var cw = Math.min(340, vw - 32);
    card.style.width = cw + "px";
    var ch = card.offsetHeight;
    var gap = 12;
    var below = y + hgt + gap;
    var top = below + ch <= vh - 16 ? below : Math.max(16, y - gap - ch);
    var center = x + w / 2;
    var left = Math.min(Math.max(16, center - cw / 2), vw - 16 - cw);
    card.style.top = top + "px";
    card.style.left = left + "px";
  }

  function step(d) {
    if (!run) return;
    if (run.i + d >= run.steps.length) { end(); return; }
    run.i += d;
    show();
  }

  // Finishing or skipping both count as seen.
  function end() {
    if (!run) return;
    markSeen(run.tab, VERSION[run.tab]);
    run.steps.forEach(function (st) { if (st.once) markSeen(st.once, 1); });
    var back = run.lastFocus;
    run = null;
    root.hidden = true;
    document.body.classList.remove("tour-open");
    if (back && back.focus && document.body.contains(back)) try { back.focus({ preventScroll: true }); } catch (e) {}
    hintOnce();
  }
  // After the first tour a person ever finishes: where the tips can be found again.
  function hintOnce() {
    try { if (localStorage.getItem(HINT_KEY)) return; localStorage.setItem(HINT_KEY, "1"); } catch (e) { return; }
    if (window.GymToast) GymToast.show({ message: s("hint") });
  }

  // ---------------- triggers ----------------
  var timer = null;
  // tries: how many more times to look again if something is in the way
  // (a menu still animating closed, a screen still rendering).
  // force (Replay tips): the user asked, so an unfinished survey doesn't
  // hold the tips back.
  var forced = false;
  function schedule(delay, tries) {
    clearTimeout(timer);
    timer = setTimeout(function () { maybeStart(tries == null ? 3 : tries); }, delay == null ? 700 : delay);
  }
  function maybeStart(tries) {
    if (run || !authed()) return;
    if (blocked(forced)) { if (tries > 0) schedule(500, tries - 1); else forced = false; return; }
    var tab = tourKey();
    if (!tab || !stepsFor(tab)) { forced = false; return; }
    // a returning user gets one screen's new steps per cold start, not all at once
    var returning = (Number(readSeen()[tab]) || 0) > 0;
    if (returning && !forced && session(RET_KEY)) return;
    if (start(tab)) { if (returning) session(RET_KEY, "1"); forced = false; }
    else if (tries <= 0) forced = false;
    else schedule(600, tries - 1);
  }

  // Avatar menu: show all tips again, starting with this screen.
  function replay() {
    if (run) end();
    writeSeen({});
    forced = true;
    schedule(300);
  }

  function init() {
    new MutationObserver(function () { if (run && run.screen !== currentTab()) end(); schedule(); })
      .observe(document.body, { attributes: true, attributeFilter: ["data-tab", "class"] });
    new MutationObserver(function () { if (run) show(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    if (window.GymHeader && GymHeader.onChange) GymHeader.onChange(function () { schedule(); });
    // the Watch tour waits for the screen to be drawn (connected or not)
    if (window.GymWatch && GymWatch.onChange) GymWatch.onChange(function () { if (currentTab() === "watch") schedule(); });
    schedule(1200);
  }

  window.GymTour = { replay: replay, start: start, end: end, record: markSeen };

  // Deferred scripts run before DOMContentLoaded; wait so header.js loads.
  if (document.readyState === "complete") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
