/* watch.js — smartwatch data from Health Connect, Android app only.
 *
 *   Watch tab   (watch-screen.js) connect card -> disclosure sheet -> Health
 *               Connect permission sheet -> today's dial + the last 7 days.
 *   Plan tab    one line (steps and kcal) that opens the Watch tab.
 *   Profile     "Watch & Health Connect" row: connect / manage / disconnect.
 *
 * Gate: the native Capacitor shell AND window.Capacitor.Plugins.Health (the
 * @capgo/capacitor-health plugin) AND Android 9+ AND a usable Health Connect.
 * On the web, in an APK without the plugin, or on Android 8 and below nothing
 * is stored (the Watch tab then explains that watch data works in the Android app). Every plugin call can reject; a failure
 * shows a calm message and never breaks the page.
 *
 * Privacy: watch data is read on demand, kept only in this phone's localStorage
 * and never sent anywhere (not gym-be, not the AI coach, not feedback or logs).
 * The keys are deliberately NOT gym_-prefixed: sync.js uploads every gym_* key.
 * sync.js's clearUserData() wipes the "etqwatch_" prefix on sign-out / account
 * switch, and privacy.js wipes all local data on account delete.
 *
 *   etqwatch_ask    "yes" | "no" | "later:<ms>"   last connect answer (no longer drives any UI)
 *   etqwatch_on     "1"                            connected and reading
 *   etqwatch_cache  {day, at, vals, denied}        last values shown
 *   etqwatch_week   {day, at, days:[{d, steps, kcal, rhr, sleepMin} x7]}   the 7-day chart
 *   etqwatch_tabseen / etqwatch_metric             Watch-tab dot and chart choice (watch-screen.js)
 *
 * Revocation: there is no callback when the user removes access in Health
 * Connect, so on every resume and Plan/Watch-tab show checkAuthorization() runs; values
 * for types no longer allowed are dropped, and if none is left the whole cache
 * goes. The cache also expires after 30 days without a refresh.
 *
 * All user-facing copy is the STR table below (the lawyer's Part B text; keys
 * match watch-legal-text.md). **bold** and <span dir="ltr"> in a string are
 * rendered as elements by rich(); never as HTML. */
(function () {
  "use strict";

  if (!window.GymDom) throw new Error("watch.js: dom.js must load first");
  var h = GymDom.h;

  var KEY_ASK = "etqwatch_ask", KEY_ON = "etqwatch_on", KEY_CACHE = "etqwatch_cache", KEY_WEEK = "etqwatch_week";
  var KEY_SEEN = "etqwatch_tabseen", KEY_METRIC = "etqwatch_metric", KEY_GOALS = "etqwatch_goals";
  var TYPES = ["steps", "calories", "heartRate", "restingHeartRate", "sleep", "weight"];
  // which cached value each Health Connect type feeds
  var VAL_OF = { steps: "steps", calories: "kcal", heartRate: "avgHr", restingHeartRate: "rhr", sleep: "sleepMin", weight: "weightKg" };
  var CACHE_MAX_MS = 30 * 24 * 3600 * 1000;
  var THROTTLE_MS = 60 * 1000;
  // Daily goals the rings fill toward (sleep in minutes). The user's own values
  // live in KEY_GOALS; anything missing or out of range falls back to the default.
  var DEFAULT_GOALS = { steps: 8000, kcal: 500, sleepMin: 480 };
  var GOAL_RANGE = {
    steps: { min: 1000, max: 50000, step: 500 },
    kcal: { min: 100, max: 2000, step: 50 },
    sleepMin: { min: 240, max: 720, step: 30 }
  };
  var GOALS = Object.assign({}, DEFAULT_GOALS);
  function clampGoal(key, v) {
    var r = GOAL_RANGE[key], n = Number(v);
    if (v === "" || v == null || !isFinite(n)) return DEFAULT_GOALS[key];
    return Math.min(r.max, Math.max(r.min, Math.round(n / r.step) * r.step));
  }
  function loadGoals() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY_GOALS)); } catch (e) {}
    if (!saved || typeof saved !== "object") saved = {};
    Object.keys(DEFAULT_GOALS).forEach(function (k) { GOALS[k] = saved[k] == null ? DEFAULT_GOALS[k] : clampGoal(k, saved[k]); });
  }
  function setGoals(g) {
    Object.keys(DEFAULT_GOALS).forEach(function (k) { GOALS[k] = clampGoal(k, g && g[k]); });
    try { localStorage.setItem(KEY_GOALS, JSON.stringify(GOALS)); } catch (e) {}
    renderAll();
  }
  function resetGoals() {
    Object.assign(GOALS, DEFAULT_GOALS);
    try { localStorage.removeItem(KEY_GOALS); } catch (e) {}
    renderAll();
  }
  loadGoals();
  var DAYS = 7;
  var PLAY_URL = "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";

  var STR = {
    // ---- Watch tab / Plan link ----
    navWatch: ["Watch", "ساعتي"],
    planSteps: ["{n} steps", "{n} خطوة"],
    planKcal: ["{n} kcal", "{n} سعرة"],
    planAria: ["Watch: {parts}. Open", "ساعتي: {parts}. افتح"],
    askBody: ["Connect it to see your steps, sleep and heart rate next to your plan. It stays on your phone.",
      "اربطها لتشوف خطواتك ونومك ونبضك بجانب خطتك. وكل شيء يبقى على هاتفك."],

    // ---- prominent disclosure, shown BEFORE the Android permission screen (B2) ----
    discTitle: ["Show your watch data in Etqadem", "اعرض بيانات ساعتك في اتقدم"],
    discIntro: ["Etqadem can read some data from Health Connect, where your watch app saves it.",
      "يستطيع اتقدم قراءة بعض البيانات من <span dir=\"ltr\">Health Connect</span>، حيث يحفظها تطبيق ساعتك."],
    discB1: ["**What we read (read-only):** steps, active calories, heart rate, resting heart rate, sleep and weight.",
      "**ما نقرؤه (للقراءة فقط):** الخطوات، والسعرات النشطة، ونبض القلب، ونبض الراحة، والنوم، والوزن."],
    discB2: ["**Why:** to show your activity next to your plan. We don't use it to change your plan.",
      "**لماذا:** لنعرض نشاطك بجانب خطتك. ولا نستخدمها لتغيير خطتك."],
    discB3: ["**It stays on this phone.** We don't send it to our servers, the AI coach or anyone else. We never sell it or use it for ads.",
      "**تبقى على هذا الهاتف.** لا نرسلها إلى خوادمنا ولا إلى المدرّب الذكي ولا إلى أي جهة أخرى. ولا نبيعها ولا نستخدمها في الإعلانات."],
    discB4: ["**You're in control.** Next, Android will ask you to allow each type. Change or disconnect any time in Profile → Watch & Health Connect, or in Health Connect.",
      "**القرار قرارك.** بعد ذلك سيطلب منك أندرويد السماح بكل نوع على حدة. ويمكنك التغيير أو الفصل في أي وقت من الملف الشخصي ← الساعة الذكية و\u00A0<span dir=\"ltr\">Health Connect</span>، أو من <span dir=\"ltr\">Health Connect</span>."],
    discNote: ["Watch numbers are estimates, not medical advice.", "أرقام الساعة تقديرية وليست نصيحة طبية."],
    discContinue: ["Continue", "متابعة"],
    discNotNow: ["Not now", "ليس الآن"],
    discPrivacyLink: ["Read the privacy policy", "اقرأ سياسة الخصوصية"],

    // ---- Profile row (B3) ----
    rowTitle: ["Watch & Health Connect", "الساعة الذكية و\u00A0<span dir=\"ltr\">Health Connect</span>"],
    rowOff: ["Not connected", "غير متصلة"],
    rowOn: ["Connected. Last updated {time}", "متصلة. آخر تحديث {time}"],
    rowOnNow: ["Connected", "متصلة"],
    rowConnect: ["Connect", "ربط"],
    rowManage: ["Open Health Connect", "فتح <span dir=\"ltr\">Health Connect</span>"],
    manageHint: ["Then tap App permissions → Etqadem.", "ثم اضغط «أذونات التطبيقات» ← اتقدم."],
    rowDisconnect: ["Disconnect", "فصل الساعة"],
    disconnectConfirmTitle: ["Disconnect your watch?", "فصل الساعة؟"],
    disconnectConfirmBody: ["We'll stop reading and delete the watch values saved on this phone. To remove the permission completely, open Health Connect.",
      "سنتوقف عن القراءة ونحذف قيم الساعة المحفوظة على هذا الهاتف. ولإزالة الإذن تمامًا افتح <span dir=\"ltr\">Health Connect</span>."],
    cancel: ["Cancel", "إلغاء"],
    disconnected: ["Watch disconnected", "تم فصل الساعة"],
    latestWeight: ["Latest weight from your watch: {kg} kg", "آخر وزن من ساعتك: {kg} كجم"],

    // ---- today strip, empty states and errors (B4) ----
    updated: ["Updated {time}", "آخر تحديث {time}"],
    stepsLbl: ["Steps", "الخطوات"],
    goalsEdit: ["Edit goals", "تعديل الأهداف"],
    goalsTitle: ["Daily goals", "الأهداف اليومية"],
    goalsBody: ["The rings fill toward these. They stay on this phone.", "تمتلئ الحلقات نحو هذه الأهداف. وتبقى على هذا الهاتف."],
    goalsSteps: ["Steps a day", "الخطوات في اليوم"],
    goalsKcal: ["Active kcal a day", "السعرات النشطة في اليوم"],
    goalsSleep: ["Sleep a night (hours)", "النوم في الليلة (ساعات)"],
    goalsRange: ["{min} to {max}", "من {min} إلى {max}"],
    goalsLess: ["Lower: {label}", "تقليل: {label}"],
    goalsMore: ["Raise: {label}", "زيادة: {label}"],
    goalsSave: ["Save goals", "حفظ الأهداف"],
    goalsReset: ["Reset to defaults", "إعادة الأهداف الافتراضية"],
    kcalLbl: ["Active kcal", "السعرات النشطة"],
    restHrLbl: ["Resting heart rate", "نبض الراحة"],
    hrNote: ["Estimate from your watch. Not medical advice.", "تقدير من ساعتك. وليس نصيحة طبية."],
    noData: ["No data from your watch yet. Open your watch app to sync.", "لا توجد بيانات من ساعتك بعد. افتح تطبيق ساعتك للمزامنة."],
    partial: ["Some types are off. Open Health Connect, then tap App permissions → Etqadem to turn them on.", "بعض الأنواع غير مفعّلة. افتح <span dir=\"ltr\">Health Connect</span> ثم اضغط «أذونات التطبيقات» ← اتقدم لتفعيلها."],
    installHC: ["Install or update Health Connect", "تثبيت أو تحديث <span dir=\"ltr\">Health Connect</span>"],
    installHCBody: ["Your watch app saves data in Health Connect. Install it from Google Play, or update it if it's already there, then come back.",
      "يحفظ تطبيق ساعتك بياناته في <span dir=\"ltr\">Health Connect</span>. ثبّته من <span dir=\"ltr\">Google Play</span>، أو حدّثه إن كان مثبّتًا، ثم ارجع إلينا."],
    notGranted: ["No permission was given, so nothing will be read. You can connect later in Profile.", "لم تُمنح أي أذونات، لذلك لن نقرأ شيئًا. يمكنك الربط لاحقًا من الملف الشخصي."],
    accessRemoved: ["Access was removed in Health Connect, so we deleted the saved watch values. Connect again any time in Profile.",
      "أُزيل الإذن من <span dir=\"ltr\">Health Connect</span>، فحذفنا قيم الساعة المحفوظة. يمكنك الربط مجددًا في أي وقت من الملف الشخصي."],
    readError: ["Couldn't read your watch data. Try again in a moment.", "تعذّرت قراءة بيانات ساعتك. حاول مرة أخرى بعد قليل."],
    openSettings: ["Open Health Connect settings", "فتح إعدادات <span dir=\"ltr\">Health Connect</span>"],

    // ---- not in the lawyer's tables ----
    installGo: ["Open Google Play", "فتح <span dir=\"ltr\">Google Play</span>"],
    checkAgain: ["Check again", "تحقق مرة أخرى"],
    tryAgain: ["Try again", "حاول مرة أخرى"],
    loading: ["Reading your watch data...", "جارٍ قراءة بيانات ساعتك..."],
    bpm: ["bpm", "نبضة/د"],
    cellNoData: ["No data", "لا توجد بيانات"],
    cellOff: ["Not allowed", "غير مسموح"],
    hr: ["h", "س"],
    min: ["m", "د"],
    connected: ["Watch connected", "تم ربط الساعة"],
    connectErr: ["Couldn't connect to Health Connect. Try again in a moment.", "تعذّر الاتصال بـ<span dir=\"ltr\">Health Connect</span>. حاول بعد قليل."],
    openErr: ["Couldn't open Health Connect. Open it from your phone's settings.", "تعذّر فتح <span dir=\"ltr\">Health Connect</span>. افتحه من إعدادات هاتفك."]
  };

  function li() { return GymDom.lang() === "ar" ? 1 : 0; }
  function raw(key, params) {
    var e = STR[key];
    var v = e ? e[li()] : key;
    if (params) v = v.replace(/\{(\w+)\}/g, function (_, k) { return params[k] != null ? String(params[k]) : ""; });
    return v;
  }
  // plain text (toasts, labels)
  function s(key, params) {
    return raw(key, params).replace(/\*\*/g, "")
      .replace(/<span dir="ltr">(.+?)<\/span>/g, function (_, m) { return "\u2066" + m.replace(/ /g, "\u00A0") + "\u2069"; });
  }
  // **bold** and <span dir="ltr">…</span> to elements
  function rich(v) {
    var out = [], re = /\*\*(.+?)\*\*|<span dir="ltr">(.+?)<\/span>/g, at = 0, m;
    while ((m = re.exec(v))) {
      if (m.index > at) out.push(v.slice(at, m.index));
      out.push(m[1] != null ? h("strong", {}, rich(m[1])) : h("span", { dir: "ltr", class: "wt-ltr" }, m[2]));
      at = re.lastIndex;
    }
    if (at < v.length) out.push(v.slice(at));
    return out;
  }
  function R(key, params) { return rich(raw(key, params)); }

  // ---------------- device-local storage ----------------
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  // Older than 30 days (or unreadable): gone.
  function readCache() {
    var c = null;
    try { c = JSON.parse(lsGet(KEY_CACHE)); } catch (e) {}
    if (!c || typeof c !== "object" || !c.vals) { if (lsGet(KEY_CACHE) !== null) lsDel(KEY_CACHE); return null; }
    if (c.at && Date.now() - c.at > CACHE_MAX_MS) { lsDel(KEY_CACHE); return null; }
    return c;
  }
  function isOn() { return lsGet(KEY_ON) === "1"; }
  function clearAll() {
    gen++;
    lsDel(KEY_ASK); lsDel(KEY_ON); lsDel(KEY_CACHE); lsDel(KEY_WEEK); lsDel(KEY_SEEN); lsDel(KEY_METRIC);
    last = null; lastRefresh = 0; inflight = null;
  }

  // The last 7 local days, oldest first: [{d, steps, kcal, rhr, sleepMin}].
  // The cache is re-aligned to today, so a week cached yesterday shifts by one day.
  function dayKeys() {
    var out = [];
    for (var i = -(DAYS - 1); i <= 0; i++) out.push(GymDate.key(i));
    return out;
  }
  function blankDay(k) { return { d: k, steps: null, kcal: null, rhr: null, sleepMin: null }; }
  function weekHasData(days) {
    return !!days && days.some(function (x) { return x.steps != null || x.kcal != null || x.rhr != null || x.sleepMin != null; });
  }
  function readWeek() {
    var c = null;
    try { c = JSON.parse(lsGet(KEY_WEEK)); } catch (e) {}
    if (!c || typeof c !== "object" || !Array.isArray(c.days)) { if (lsGet(KEY_WEEK) !== null) lsDel(KEY_WEEK); return null; }
    if (c.at && Date.now() - c.at > CACHE_MAX_MS) { lsDel(KEY_WEEK); return null; }
    var by = {};
    c.days.forEach(function (x) { if (x && x.d) by[x.d] = x; });
    return dayKeys().map(function (k) { return Object.assign(blankDay(k), by[k] || {}); });
  }
  function writeWeek(week, at) {
    if (weekHasData(week)) lsSet(KEY_WEEK, JSON.stringify({ day: GymDate.key(), at: at, days: week }));
    else lsDel(KEY_WEEK);
  }

  // Drop what was cached for types that are no longer allowed.
  var COL_OF = { steps: "steps", calories: "kcal", restingHeartRate: "rhr", sleep: "sleepMin" };
  function purgeDenied(denied) {
    if (!denied.length) return;
    var c = readCache(), w = readWeek();
    denied.forEach(function (t) {
      if (c) delete c.vals[VAL_OF[t]];
      if (last && last.vals) delete last.vals[VAL_OF[t]];
      var col = COL_OF[t];
      if (col) {
        if (w) w.forEach(function (x) { x[col] = null; });
        if (last && last.week) last.week.forEach(function (x) { x[col] = null; });
      }
    });
    if (c) lsSet(KEY_CACHE, JSON.stringify(c));
    if (w) writeWeek(w, (last && last.at) || Date.now());
  }

  // ---------------- plugin ----------------
  function plugin() {
    var c = window.Capacitor;
    try {
      if (!c || typeof c.isNativePlatform !== "function" || !c.isNativePlatform()) return null;
    } catch (e) { return null; }
    var p = c.Plugins && c.Plugins.Health;
    return p && typeof p.isAvailable === "function" ? p : null;
  }
  function call(name, arg) {
    var p = plugin();
    if (!p || typeof p[name] !== "function") return Promise.reject(new Error("no health plugin"));
    try { return Promise.resolve(p[name](arg)); } catch (e) { return Promise.reject(e); }
  }

  function androidMajor() {
    var m = /Android\s+(\d+)/i.exec((navigator && navigator.userAgent) || "");
    return m ? Number(m[1]) : 0;   // 0 = unknown
  }

  // "ok" | "install" (Health Connect missing or needs an update) | "none" (hide the feature).
  // The plugin's "unavailable" covers both not-installed (Android 9-13) and
  // unsupported, so the Android version in the user agent decides.
  var availP = null;
  function checkAvail(force) {
    if (availP && !force) return availP;
    var major = androidMajor();
    if (major && major < 9) { availP = Promise.resolve("none"); return availP; }
    availP = call("isAvailable").then(function (r) {
      if (r && r.platform && r.platform !== "android") return "none";
      if (r && r.available) return "ok";
      if (major) return "install";
      var why = String((r && r.reason) || "");           // unknown version: fall back to the reason text
      if (/unsupported|not supported|sdk|android version/i.test(why) && !/install|update|provider|missing|not found/i.test(why)) return "none";
      return "install";
    }, function () { return "none"; });
    return availP;
  }

  // ---------------- state ----------------
  var gen = 0;            // bumped by clearAll(): a read that started before it is dropped
  var avail = null;       // resolved checkAvail() result for the screen
  var last = null;        // { status: loading|ok|partial|empty|denied|error, vals, denied, at }
  var lastRefresh = 0;
  var inflight = null;
  var connecting = false;
  var sheet = null;
  var wired = false;

  function active() { return !!plugin() && avail !== null && avail !== "none"; }

  function dayStart(offsetDays, hour) {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (offsetDays || 0), hour || 0, 0, 0, 0);
  }

  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function sumSamples(r) {
    var list = (r && r.samples) || [];
    var t = 0, any = false;
    list.forEach(function (x) { var n = num(x && x.value); if (n != null) { t += n; any = true; } });
    return any ? t : null;
  }
  function avgSamples(r) {
    var list = ((r && r.samples) || []).map(function (x) { return num(x && x.value); }).filter(function (n) { return n != null; });
    if (!list.length) return null;
    return list.reduce(function (a, b) { return a + b; }, 0) / list.length;
  }
  function latest(r) {
    var x = r && r.samples && r.samples[0];
    return x ? num(x.value) : null;
  }
  // Last night = sessions that ended after yesterday 18:00 (the read window);
  // the plugin has no sleep aggregation, so this sums the sessions' minutes.
  function sleepMinutes(r) {
    var total = 0, any = false;
    ((r && r.samples) || []).forEach(function (x) {
      if (!x || x.sleepState === "awake") return;
      var n = num(x.value);
      if (n == null && x.startDate && x.endDate) n = (Date.parse(x.endDate) - Date.parse(x.startDate)) / 60000;
      if (n != null && n > 0) { total += n; any = true; }
    });
    return any ? total : null;
  }

  // Each read is independent: one failing type leaves the rest intact. Resolves { ok, v }.
  function attempt(p) { return p.then(function (v) { return { ok: true, v: v }; }, function () { return { ok: false, v: null }; }); }

  function readAll(authorized) {
    var can = function (t) { return authorized.indexOf(t) >= 0; };
    var now = new Date().toISOString();
    var today = dayStart(0).toISOString();
    var agg = function (type, aggregation) {
      return call("queryAggregated", { dataType: type, startDate: today, endDate: now, bucket: "day", aggregation: aggregation });
    };
    var samples = function (type, start, limit) {
      return call("readSamples", { dataType: type, startDate: start.toISOString(), endDate: now, limit: limit, ascending: false });
    };
    var jobs = {};
    if (can("steps")) jobs.steps = attempt(agg("steps", "sum"));
    if (can("calories")) jobs.kcal = attempt(agg("calories", "sum"));
    if (can("heartRate")) jobs.avgHr = attempt(agg("heartRate", "average"));
    if (can("restingHeartRate")) jobs.rhr = attempt(samples("restingHeartRate", dayStart(-3), 1));
    if (can("sleep")) jobs.sleep = attempt(samples("sleep", dayStart(-1, 18), 20));
    if (can("weight")) jobs.weight = attempt(samples("weight", dayStart(-30), 1));
    // The 7-day chart: same permissions, one day bucket per day (the plugin skips
    // days with no data); no sleep aggregation exists, so sessions are read and
    // assigned to the day they ended.
    var weekAgg = function (type) {
      return call("queryAggregated", { dataType: type, startDate: dayStart(-(DAYS - 1)).toISOString(), endDate: now, bucket: "day", aggregation: "sum" });
    };
    if (can("steps")) jobs.wSteps = attempt(weekAgg("steps"));
    if (can("calories")) jobs.wKcal = attempt(weekAgg("calories"));
    if (can("restingHeartRate")) jobs.wRhr = attempt(samples("restingHeartRate", dayStart(-(DAYS - 1)), 30));
    if (can("sleep")) jobs.wSleep = attempt(samples("sleep", dayStart(-DAYS, 18), 200));
    var keys = Object.keys(jobs);
    return Promise.all(keys.map(function (k) { return jobs[k]; })).then(function (res) {
      var out = {}, failed = 0;
      keys.forEach(function (k, i) { out[k] = res[i].v; if (!res[i].ok) failed++; });
      return { raw: out, failed: failed, tried: keys.length };
    });
  }

  function whole(n) { return n == null ? null : Math.round(n); }
  function toVals(raw, prev) {
    var w = latest(raw.weight);
    return {
      steps: whole(sumSamples(raw.steps)),
      kcal: whole(sumSamples(raw.kcal)),
      rhr: whole(latest(raw.rhr)),
      avgHr: whole(avgSamples(raw.avgHr)),
      sleepMin: whole(sleepMinutes(raw.sleep)),
      weightKg: w != null ? Math.round(w * 10) / 10 : (prev && prev.weightKg != null ? prev.weightKg : null)
    };
  }

  function stripEmpty(v, week) {
    return v.steps == null && v.kcal == null && v.rhr == null && v.avgHr == null && v.sleepMin == null && !weekHasData(week);
  }

  function toWeek(raw, vals) {
    var days = dayKeys().map(blankDay);
    var t0 = dayStart(-(DAYS - 1)).getTime(), DAY = 86400000;
    var at = function (iso, round) {
      var t = Date.parse(iso);
      if (!isFinite(t)) return -1;
      var i = Math[round ? "round" : "floor"]((t - t0) / DAY);
      return i >= 0 && i < DAYS ? i : -1;
    };
    var agg = function (r, col) {
      ((r && r.samples) || []).forEach(function (x) {
        var n = num(x && x.value), i = x && x.startDate ? at(x.startDate, true) : -1;
        if (n != null && i >= 0) days[i][col] = (days[i][col] || 0) + Math.round(n);
      });
    };
    agg(raw.wSteps, "steps");
    agg(raw.wKcal, "kcal");
    ((raw.wRhr && raw.wRhr.samples) || []).forEach(function (x) {      // newest first: keep the first per day
      var n = num(x && x.value), i = x && x.startDate ? at(x.startDate) : -1;
      if (n != null && i >= 0 && days[i].rhr == null) days[i].rhr = Math.round(n);
    });
    ((raw.wSleep && raw.wSleep.samples) || []).forEach(function (x) {
      if (!x || x.sleepState === "awake") return;
      var m = num(x.value);
      if (m == null && x.startDate && x.endDate) m = (Date.parse(x.endDate) - Date.parse(x.startDate)) / 60000;
      var i = at(x.endDate || x.startDate);
      if (m != null && m > 0 && i >= 0) days[i].sleepMin = (days[i].sleepMin || 0) + Math.round(m);
    });
    var today = days[DAYS - 1];
    ["steps", "kcal", "sleepMin"].forEach(function (col) { if (today[col] == null && vals[col] != null) today[col] = vals[col]; });
    return days;
  }

  // Always re-checks what Health Connect still allows (cheap, and the only way
  // to notice a revoked permission). The data reads run when forced, or when
  // the last one is older than THROTTLE_MS.
  function refresh(force) {
    if (!active() || !isOn()) return Promise.resolve();
    if (inflight) return inflight;
    var myGen = gen;
    var cached = readCache();
    var dayKey = GymDate.key();
    var hadLast = !!last;
    if (!last) last = cached && cached.day === dayKey
      ? { status: "loading", vals: cached.vals, denied: cached.denied || [], at: cached.at, week: readWeek() }
      : { status: "loading", vals: cached ? { weightKg: cached.vals.weightKg } : {}, denied: [], at: 0, week: readWeek() };
    if (!hadLast) renderAll();
    inflight = call("checkAuthorization", { read: TYPES }).then(function (a) {
      var ok = (a && a.readAuthorized) || [];
      var denied = TYPES.filter(function (t) { return ok.indexOf(t) < 0; });
      if (!ok.length) { lsDel(KEY_CACHE); lsDel(KEY_WEEK); return { status: "denied", vals: {}, denied: denied, at: 0, week: null, fresh: true }; }
      purgeDenied(denied);
      var due = force || Date.now() - lastRefresh >= THROTTLE_MS || /^(denied|error|loading)$/.test(last.status);
      if (!due) {
        var st = denied.length ? (stripEmpty(last.vals, last.week) ? "empty" : "partial") : (last.status === "partial" ? "ok" : last.status);
        return { status: st, vals: last.vals, denied: denied, at: last.at, week: last.week };
      }
      lastRefresh = Date.now();
      return readAll(ok).then(function (r) {
        // Carry the last weight over only while weight is still allowed (a revoked type must not come back from the cache).
        var vals = toVals(r.raw, ok.indexOf("weight") >= 0 && cached ? cached.vals : null);
        if (r.tried && r.failed === r.tried) return { status: "error", vals: last.vals, denied: denied, at: last.at, week: last.week };
        var week = toWeek(r.raw, vals);
        var status = stripEmpty(vals, week) ? "empty" : (denied.length ? "partial" : "ok");
        return { status: status, vals: vals, denied: denied, at: Date.now(), week: week, fresh: true };
      });
    }).catch(function () {
      return { status: "error", vals: last ? last.vals : {}, denied: [], at: last ? last.at : 0, week: last ? last.week : null };
    }).then(function (res) {
      if (myGen !== gen) return;
      last = res;
      if (res.fresh && res.status !== "denied") {
        lsSet(KEY_CACHE, JSON.stringify({ day: dayKey, at: res.at, vals: res.vals, denied: res.denied }));
        writeWeek(res.week, res.at);
      }
    }).then(function () {
      inflight = null;
      renderAll();
    });
    return inflight;
  }

  // ---------------- connect flow ----------------
  function toast(key) { if (window.GymToast) GymToast.show({ message: s(key) }); }

  // The only way to the Android permission screen: the disclosure sheet first,
  // from the ask card and from Profile alike. Not now / Back / outside tap /
  // Escape all resolve false and never reach requestAuthorization.
  // Resolves "granted" | "none" (nothing allowed) | "cancel" | "install" | "error".
  function connect() {
    if (connecting) return Promise.resolve("cancel");
    connecting = true;
    var outcome = "cancel";
    return checkAvail(true).then(function (a) {
      avail = a;
      if (a === "none") { renderAll(); return; }
      if (a === "install") { outcome = "install"; return openSheet("install"); }
      return openSheet("disclose").then(function (go) {
        if (!go) { if (!isOn()) lsSet(KEY_ASK, "later:" + Date.now()); return; }
        return authorize().then(function (r) { outcome = r; });
      });
    }).catch(function () { outcome = "error"; toast("connectErr"); }).then(function () {
      connecting = false;
      renderAll();
      return outcome;
    });
  }

  // "Check again" on the install card: re-read whether Health Connect is usable now.
  function recheck() {
    return checkAvail(true).then(function (a) { avail = a; renderAll(); });
  }

  function authorize() {
    return call("requestAuthorization", { read: TYPES }).then(function (r) {
      if (r && Array.isArray(r.readAuthorized)) return r.readAuthorized;
      return call("checkAuthorization", { read: TYPES }).then(function (a) { return (a && a.readAuthorized) || []; });
    }).then(function (ok) {
      if (!ok.length) { if (!isOn()) lsSet(KEY_ASK, "later:" + Date.now()); toast("notGranted"); return "none"; }
      lsSet(KEY_ON, "1"); lsSet(KEY_ASK, "yes");
      last = null;
      toast("connected");
      return refresh(true).then(function () { return "granted"; });
    }, function () { toast("connectErr"); return "error"; });
  }

  function disconnect() {
    gen++;
    lsDel(KEY_ON); lsDel(KEY_CACHE); lsDel(KEY_WEEK); lsSet(KEY_ASK, "no");
    last = null; lastRefresh = 0; inflight = null;
    renderAll();
    toast("disconnected");
  }

  function manage() {
    call("openHealthConnectSettings").catch(function () { toast("openErr"); });
  }

  // ---------------- sheet (the shared .syd bottom sheet) ----------------
  // kind: "disclose" (Continue resolves true), "install" and "confirm" (Disconnect resolves true),
  // "goals" (Save or Reset to defaults resolves true; the goals are already stored)
  function openSheet(kind) {
    if (sheet) return Promise.resolve(false);
    return new Promise(function (resolve) {
      var opener = document.activeElement;
      var title = h("h2", { class: "syd-title", id: "wtTitle" },
        R(kind === "disclose" ? "discTitle" : kind === "install" ? "installHC" : "disconnectConfirmTitle"));
      var body, go, later;
      if (kind === "goals") {
        title.textContent = s("goalsTitle");
        var inputs = {};
        var rows = [["steps", "goalsSteps", 1], ["kcal", "goalsKcal", 1], ["sleepMin", "goalsSleep", 60]].map(function (d) {
          var key = d[0], r = GOAL_RANGE[key], div = d[2], label = s(d[1]), id = "wtGoal-" + key;
          var input = h("input", { type: "number", class: "wt-gf-in", id: id, inputmode: key === "sleepMin" ? "decimal" : "numeric",
            min: String(r.min / div), max: String(r.max / div), step: String(r.step / div), value: String(GOALS[key] / div), "aria-describedby": id + "-r" });
          inputs[key] = input;
          var tidy = function () { input.value = String(clampGoal(key, input.value === "" ? "" : Number(input.value) * div) / div); };
          var nudge = function (dir) {
            var cur = input.value === "" ? GOALS[key] : Number(input.value) * div;
            input.value = String(clampGoal(key, cur + dir * r.step) / div);
          };
          input.addEventListener("change", tidy);
          input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go.click(); } });
          var less = h("button", { type: "button", class: "wt-step", "aria-label": s("goalsLess", { label: label }), on: { click: function () { nudge(-1); } } }, "\u2212");
          var more = h("button", { type: "button", class: "wt-step", "aria-label": s("goalsMore", { label: label }), on: { click: function () { nudge(1); } } }, "+");
          return h("div", { class: "wt-gf-row" },
            h("label", { class: "wt-gf-l", for: id }, label),
            h("div", { class: "wt-stepper", dir: "ltr" }, less, input, more),
            h("span", { class: "wt-gf-r", id: id + "-r" },
              s("goalsRange", { min: fmtInt(r.min / div), max: fmtInt(r.max / div) })));
        });
        body = [h("p", { class: "syd-body wt-p" }, R("goalsBody")), h("div", { class: "wt-gf" }, rows),
          h("button", { type: "button", class: "wt-btn wt-btn-quiet", id: "wtGoalsReset", on: { click: function () { resetGoals(); close(true); } } }, R("goalsReset"))];
        go = h("button", { type: "button", class: "syd-yes", id: "wtGo" }, R("goalsSave"));
        later = h("button", { type: "button", class: "syd-no", id: "wtLater" }, R("cancel"));
        go.addEventListener("click", function () {
          setGoals({ steps: Number(inputs.steps.value), kcal: Number(inputs.kcal.value), sleepMin: Number(inputs.sleepMin.value) * 60 });
        });
      } else if (kind === "disclose") {
        body = [
          h("p", { class: "syd-body wt-p" }, R("discIntro")),
          h("ul", { class: "wt-pts" }, ["discB1", "discB2", "discB3", "discB4"].map(function (k) { return h("li", {}, R(k)); })),
          h("p", { class: "syd-body wt-p wt-fine" }, R("discNote")),
          h("p", { class: "pol-line" }, GymDom.policyLink(li() ? "ar-health-connect" : "health-connect", s("discPrivacyLink"), true))
        ];
        go = h("button", { type: "button", class: "syd-yes", id: "wtGo" }, R("discContinue"));
        later = h("button", { type: "button", class: "syd-no", id: "wtLater" }, R("discNotNow"));
      } else if (kind === "install") {
        body = [h("p", { class: "syd-body" }, R("installHCBody"))];
        go = h("a", { class: "syd-yes wt-a", id: "wtGo", href: PLAY_URL, target: "_blank", rel: "noopener" }, R("installGo"));
        later = h("button", { type: "button", class: "syd-no", id: "wtLater" }, R("discNotNow"));
      } else {
        body = [h("p", { class: "syd-body" }, R("disconnectConfirmBody"))];
        go = h("button", { type: "button", class: "syd-yes", id: "wtGo" }, R("rowDisconnect"));
        later = h("button", { type: "button", class: "syd-no", id: "wtLater" }, R("cancel"));
      }
      var panel = h("div", { class: "syd-panel wt-panel m-ovl-card", role: "dialog", "aria-modal": "true", "aria-labelledby": "wtTitle", tabindex: "-1" },
        title, body, h("div", { class: "syd-actions" }, go, later));
      var backdrop = h("div", { class: "syd-backdrop" });
      var root = h("div", { class: "syd wt-sheet m-ovl", id: "watchSheet" }, backdrop, panel);

      var closed = false;
      function close(result) {
        if (closed) return;
        closed = true;
        document.removeEventListener("keydown", onKey, true);
        sheet = null;
        GymMotion.hide(root, function () { root.remove(); });
        if (opener && opener.focus) try { opener.focus(); } catch (e) {}
        resolve(result);
      }
      function onKey(e) {
        if (e.key === "Escape") { e.stopPropagation(); close(false); return; }
        if (e.key !== "Tab") return;
        var f = Array.prototype.filter.call(panel.querySelectorAll("button, a[href], input"), function (n) { return !n.disabled && n.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && (document.activeElement === lastEl || !panel.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      }
      go.addEventListener("click", function () { close(kind !== "install"); });
      later.addEventListener("click", function () { close(false); });
      backdrop.addEventListener("click", function () { close(false); });
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(root);
      sheet = root;
      GymMotion.show(root);
      panel.focus();   // the dialog itself (no ring, see watch.css); the title is not interactive
    });
  }

  // ---------------- rendering ----------------
  var ICON = {
    steps: "M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7",
    kcal: "M13.5.7s.7 2.7.7 4.8c0 2.1-1.3 3.7-3.4 3.7-2.1 0-3.6-1.6-3.6-3.7l0-.4C5.2 7.5 4 10.6 4 14c0 4.4 3.6 8 8 8s8-3.6 8-8c0-5.4-2.6-10.2-6.5-13.3zM11.7 19c-1.8 0-3.2-1.4-3.2-3.1 0-1.6 1-2.8 2.8-3.1 1.8-.4 3.6-1.2 4.6-2.6.4 1.3.6 2.7.6 4 0 2.7-2.2 4.8-4.8 4.8z",
    heart: "m12 21.35-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
    sleep: "M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.4 5.4 0 0 1-4.4 2.26 5.4 5.4 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z",
    watch: "M8 2h8l1 4H7l1-4zm0 20 -1-4h10l-1 4H8zM7 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm4.2 3v3.6l2.4 1.5.8-1.2-1.7-1V9h-1.5z"
  };
  function icon(name, cls) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", cls || "wt-ic");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", ICON[name]);
    svg.appendChild(p);
    return svg;
  }

  function btn(label, cls, onClick, id) {
    return h("button", { type: "button", class: "wt-btn " + cls, id: id || null, on: { click: onClick } }, label);
  }

  function editGoals() { return openSheet("goals"); }
  function fmtInt(n) { return Math.round(n).toLocaleString("en-US"); }
  function fmtSleep(min) {
    var hrs = Math.floor(min / 60), m = Math.round(min % 60);
    if (m === 60) { hrs++; m = 0; }
    return hrs + " " + s("hr") + (m ? " " + m + " " + s("min") : "");
  }
  function fmtTime(ms) {
    try {
      return new Date(ms).toLocaleTimeString(li() ? "ar-EG-u-nu-latn" : "en-US", { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  }

  function svgEl(tag, attrs) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  // ---- Plan tab: one line that links to the Watch tab ----
  var MINI_C = 2 * Math.PI * 10;   // mini ring r=10: circumference for the dash offset
  function renderPlan() {
    var mount = document.getElementById("watchMount");
    if (!mount) return;
    mount.textContent = "";
    mount.hidden = true;
    var v = last && last.vals;
    if (!active() || !isOn() || !v || (v.steps == null && v.kcal == null)) return;
    var parts = [];
    if (v.steps != null) parts.push(s("planSteps", { n: fmtInt(v.steps) }));
    if (v.kcal != null) parts.push(s("planKcal", { n: fmtInt(v.kcal) }));
    var pct = v.steps != null ? Math.min(1, v.steps / GOALS.steps) : 0;
    var ring = svgEl("svg", { class: "wt-mini", viewBox: "0 0 24 24", "aria-hidden": "true" });
    ring.appendChild(svgEl("circle", { class: "wt-mini-track", cx: 12, cy: 12, r: 10 }));
    ring.appendChild(svgEl("circle", { class: "wt-mini-arc", cx: 12, cy: 12, r: 10, "stroke-dasharray": MINI_C.toFixed(2), "stroke-dashoffset": (MINI_C * (1 - pct)).toFixed(2) }));
    mount.appendChild(h("button", { type: "button", class: "wt-link", id: "wtPlanLink", "aria-label": s("planAria", { parts: parts.join(", ") }), on: { click: function () { if (window.GymUI) GymUI.navigate("watch"); } } },
      ring,
      h("span", { class: "wt-link-txt" }, parts.map(function (t) { return h("span", { class: "wt-link-part" }, t); })),
      h("span", { class: "wt-link-go", "aria-hidden": "true" }, s("navWatch"), h("span", { class: "wt-chev" }, "\u203A"))));
    mount.hidden = false;
  }

  function renderProfile() {
    var mount = document.getElementById("profWatchMount");
    if (!mount) return;
    mount.textContent = "";
    mount.hidden = true;
    if (!active()) return;
    var on = isOn();
    var removed = on && last && last.status === "denied";
    var cache = on && !removed ? readCache() : null;
    var weight = cache && cache.vals && cache.vals.weightKg != null ? cache.vals.weightKg : null;
    var at = (last && last.at) || (cache && cache.at) || 0;
    var desc = removed ? R("accessRemoved") : (on ? R(at ? "rowOn" : "rowOnNow", { time: fmtTime(at) }) : R("rowOff"));
    var actions;
    if (removed) actions = [btn(s("rowConnect"), "wt-btn-primary", connect, "wtProfConnect"), btn(s("openSettings"), "wt-btn-line", manage, "wtProfManage"), btn(s("rowDisconnect"), "wt-btn-quiet wt-btn-danger", askDisconnect, "wtProfDisc")];
    else if (on) actions = [btn(s("rowManage"), "wt-btn-line", manage, "wtProfManage"), btn(s("rowDisconnect"), "wt-btn-quiet wt-btn-danger", askDisconnect, "wtProfDisc")];
    else actions = [btn(s("rowConnect"), "wt-btn-primary", connect, "wtProfConnect")];
    mount.appendChild(h("section", { class: "more-group wt-prof", "aria-labelledby": "wtProfT" },
      h("div", { class: "more-label", id: "wtProfT" }, R("rowTitle")),
      h("div", { class: "wt-card" },
        h("p", { class: "wt-text" }, desc),
        weight != null ? h("p", { class: "wt-text wt-weight" }, s("latestWeight", { kg: weight })) : null,
        h("div", { class: "wt-actions" }, actions),
        on ? h("p", { class: "wt-text wt-hint" }, s("manageHint")) : null)));
    mount.hidden = false;
  }

  function askDisconnect() {
    openSheet("confirm").then(function (yes) { if (yes) disconnect(); });
  }

  var listeners = [];
  function renderAll() {
    renderPlan(); renderProfile();
    listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} });
  }
  function state() {
    var l = last;
    return {
      plugin: !!plugin(), avail: avail, on: isOn(), connecting: connecting,
      status: l ? l.status : (isOn() && active() ? "loading" : null),
      vals: l && l.vals ? Object.assign({}, l.vals) : {}, denied: l && l.denied ? l.denied.slice() : [], at: l ? l.at : 0,
      week: l && l.week ? l.week.map(function (x) { return Object.assign({}, x); }) : null,
      goals: Object.assign({}, GOALS)
    };
  }
  function onChange(fn) { if (typeof fn === "function") listeners.push(fn); }
  function disconnectAsk() { askDisconnect(); }

  // ---------------- wiring ----------------
  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && active() && isOn()) refresh(false);
    });
    function watchHidden(id, fn) {
      var n = document.getElementById(id);
      if (!n || typeof MutationObserver !== "function") return;
      new MutationObserver(function () { if (!n.hidden) fn(); }).observe(n, { attributes: true, attributeFilter: ["hidden"] });
    }
    watchHidden("screen-plan", function () { renderAll(); refresh(false); });
    watchHidden("screen-watch", function () { refresh(false); });
    watchHidden("screen-profile", function () { renderProfile(); refresh(false); });
    document.addEventListener("gym:authchange", function (e) {
      if (e && e.detail === false) { clearAll(); renderAll(); }
      else { last = null; lastRefresh = 0; if (active()) { renderAll(); refresh(true); } }
    });
    try {
      new MutationObserver(renderAll).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    } catch (e) {}
  }

  // Safe to call again (tests stub window.Capacitor after load): re-reads the
  // device state and repaints.
  function init() {
    readCache();   // drops a cache older than 30 days before anything paints it
    if (!plugin()) { avail = null; renderAll(); return Promise.resolve(); }
    wire();
    return checkAvail(true).then(function (a) {
      avail = a;
      renderAll();
      return refresh(true);
    });
  }

  window.GymWatch = {
    init: init, refresh: function () { return refresh(true); }, connect: connect,
    state: state, onChange: onChange, editGoals: editGoals, manage: manage, disconnect: disconnectAsk, recheck: recheck,
    // for watch-screen.js: shared copy and formatting, so the two files never drift
    ui: { add: function (t) { Object.keys(t).forEach(function (k) { STR[k] = t[k]; }); }, raw: raw, s: s, R: R, rich: rich, icon: icon, btn: btn, svgEl: svgEl, fmtInt: fmtInt, fmtSleep: fmtSleep, fmtTime: fmtTime, li: li, playUrl: PLAY_URL, keys: { seen: KEY_SEEN, metric: KEY_METRIC } }
  };
  init();
})();
