/* tour.js — short first-visit tips for each main screen (#tour).
 *
 * Signed-in users only. The first time they open Plan, Coach, Food or More,
 * a spotlight walks through 2-3 real controls with one line each. Seen
 * screens are stored in gym_tours_seen (synced, so a new device doesn't
 * repeat them). Never runs while the survey, sign-in screen, a dialog or a
 * workout is up. "Replay tips" in the avatar menu clears the list. */
(function () {
  "use strict";

  var SEEN_KEY = "gym_tours_seen";

  var STR = {
    skip: ["Skip", "تخطي"],
    next: ["Next", "التالي"],
    done: ["Got it", "تمام"],
    stepOf: ["{n} of {t}", "{n} من {t}"],
    planDays: ["Pick today's workout here.", "اختر تمرين اليوم من هنا."],
    planStart: ["Start the timer when you begin. It keeps running if you switch screens.", "شغّل المؤقت عند البدء. يستمر حتى لو انتقلت لشاشة أخرى."],
    planRest: ["Tick each set as you finish it and the rest timer starts. You can also tap Rest.", "علّم كل مجموعة عند إنهائها ليبدأ مؤقت الراحة. ويمكنك أيضاً الضغط على راحة."],
    coachForm: ["Your answers are here. Tap the button to get a diet and training plan.", "إجاباتك هنا. اضغط الزر لتحصل على خطة غذاء وتمرين."],
    foodTotals: ["Your calories and protein for the day.", "سعراتك وبروتينك لليوم."],
    foodSearch: ["Search local foods and log a portion.", "ابحث عن أكلات محلية وسجّل الكمية."],
    foodDate: ["Switch days to see or fix past meals.", "غيّر اليوم لترى وجبات سابقة أو تعدّلها."],
    morePlan: ["Switch between the male and female plans.", "بدّل بين الخطة الرجالية والنسائية."],
    moreStyle: ["Train at the gym or at home.", "تمرّن في الجيم أو في البيت."],
    moreDays: ["Pick your training days to get reminders.", "اختر أيام تمرينك لتصلك التذكيرات."]
  };

  // Each step: first matching visible selector wins; steps with no visible
  // target are dropped.
  var TOURS = {
    plan: [
      { sel: ["#dayTabs"], text: "planDays" },
      { sel: ["#sessionBtn"], text: "planStart" },
      { sel: ["#exList .ex-card [data-rest]", "#exList .ex-card"], text: "planRest" }
    ],
    coach: [
      { sel: ["#coachBody form .coach-primary", "#coachBody form", "#coachBody .coach-primary"], text: "coachForm" }
    ],
    food: [
      { sel: ["#foodTotalsHost > *", "#foodTotalsHost"], text: "foodTotals" },
      { sel: ["#foodSearchInput", "#foodBody .food-search"], text: "foodSearch" },
      { sel: ["#foodBody .food-date-switch"], text: "foodDate" }
    ],
    more: [
      { sel: ["#screen-more .plan-toggle"], text: "morePlan" },
      { sel: ["#styleToggle"], text: "moreStyle" },
      { sel: ["#moreTrainingDays > *", "#moreTrainingDays"], text: "moreDays" }
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
  function markSeen(tab) { var o = readSeen(); o[tab] = 1; writeSeen(o); }

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
    var defs = TOURS[tab];
    if (!defs || (run && run.tab === tab)) return false;
    var steps = [];
    defs.forEach(function (d) { var el = resolve(d); if (el) steps.push({ el: el, text: d.text }); });
    if (!steps.length) return false; // screen not ready yet
    build();
    run = { tab: tab, steps: steps, i: 0, lastFocus: document.activeElement };
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
    markSeen(run.tab);
    var back = run.lastFocus;
    run = null;
    root.hidden = true;
    document.body.classList.remove("tour-open");
    if (back && back.focus && document.body.contains(back)) try { back.focus({ preventScroll: true }); } catch (e) {}
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
    var tab = currentTab();
    if (!TOURS[tab] || readSeen()[tab]) { forced = false; return; }
    if (start(tab) || tries <= 0) forced = false;
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
    new MutationObserver(function () { if (run && run.tab !== currentTab()) end(); schedule(); })
      .observe(document.body, { attributes: true, attributeFilter: ["data-tab", "class"] });
    new MutationObserver(function () { if (run) show(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    if (window.GymHeader && GymHeader.onChange) GymHeader.onChange(function () { schedule(); });
    schedule(1200);
  }

  window.GymTour = { replay: replay, start: start, end: end };

  // Deferred scripts run before DOMContentLoaded; wait so header.js loads.
  if (document.readyState === "complete") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
