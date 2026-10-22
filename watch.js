/* watch.js — smartwatch data from Health Connect, Android app only.
 *
 *   Plan tab    ask card ("Do you have a smartwatch?") -> disclosure sheet ->
 *               Health Connect permission sheet -> "today" strip.
 *   Profile     "Watch & Health Connect" row: connect / manage / disconnect.
 *
 * Gate: the native Capacitor shell AND window.Capacitor.Plugins.Health (the
 * @capgo/capacitor-health plugin) AND Android 9+ AND a usable Health Connect.
 * On the web, in an APK without the plugin, or on Android 8 and below nothing
 * is rendered and nothing is stored. Every plugin call can reject; a failure
 * shows a calm message and never breaks the page.
 *
 * Privacy: watch data is read on demand, kept only in this phone's localStorage
 * and never sent anywhere (not gym-be, not the AI coach, not feedback or logs).
 * The keys are deliberately NOT gym_-prefixed: sync.js uploads every gym_* key.
 * sync.js's clearUserData() wipes the "etqwatch_" prefix on sign-out / account
 * switch, and privacy.js wipes all local data on account delete.
 *
 *   etqwatch_ask    "yes" | "no" | "later:<ms>"   the ask-card answer
 *   etqwatch_on     "1"                            connected and reading
 *   etqwatch_cache  {day, at, vals, denied}        last values shown
 *
 * Revocation: there is no callback when the user removes access in Health
 * Connect, so on every resume and Plan-tab show checkAuthorization() runs; values
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

  var KEY_ASK = "etqwatch_ask", KEY_ON = "etqwatch_on", KEY_CACHE = "etqwatch_cache";
  var TYPES = ["steps", "calories", "heartRate", "restingHeartRate", "sleep", "weight"];
  // which cached value each Health Connect type feeds
  var VAL_OF = { steps: "steps", calories: "kcal", heartRate: "avgHr", restingHeartRate: "rhr", sleep: "sleepMin", weight: "weightKg" };
  var ASK_AGAIN_MS = 7 * 24 * 3600 * 1000;
  var CACHE_MAX_MS = 30 * 24 * 3600 * 1000;
  var THROTTLE_MS = 60 * 1000;
  // Display-only daily goals for the rings on the strip (not user settings yet).
  var GOALS = { steps: 8000, kcal: 500 };
  var COUNT_MS = 800;      // first appearance: count up from 0 and fill the rings
  var DELTA_MS = 600;      // a refresh that changed a value: move from what is shown
  var PLAY_URL = "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";

  var STR = {
    // ---- ask card (B1) ----
    askTitle: ["Do you have a smartwatch?", "عندك ساعة ذكية؟"],
    askBody: ["Connect it to see your steps, sleep and heart rate next to your plan. It stays on your phone.",
      "اربطها لتشوف خطواتك ونومك ونبضك بجانب خطتك. وكل شيء يبقى على هاتفك."],
    askYes: ["Yes", "نعم"],
    askLater: ["Not now", "ليس الآن"],
    askNo: ["No", "لا"],

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
    stripTitle: ["From your watch today", "من ساعتك اليوم"],
    updated: ["Updated {time}", "آخر تحديث {time}"],
    stepsLbl: ["Steps", "الخطوات"],
    kcalLbl: ["Active kcal", "السعرات النشطة"],
    restHrLbl: ["Resting heart rate", "نبض الراحة"],
    sleepLbl: ["Last night's sleep", "نوم الليلة الماضية"],
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
    avgHr: ["avg {n} today", "المتوسط {n} اليوم"],
    cellNoData: ["No data", "لا توجد بيانات"],
    cellOff: ["Not allowed", "غير مسموح"],
    goalSteps: ["{pct}% of {goal}", "{pct}% من {goal}"],
    goalKcal: ["{pct}% of {goal} kcal", "{pct}% من {goal} سعرة"],
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
  function askDue() {
    var a = lsGet(KEY_ASK);
    if (!a) return true;
    if (a.indexOf("later:") === 0) return Date.now() - (Number(a.slice(6)) || 0) >= ASK_AGAIN_MS;
    return false;
  }
  function clearAll() {
    gen++;
    lsDel(KEY_ASK); lsDel(KEY_ON); lsDel(KEY_CACHE);
    last = null; lastRefresh = 0; inflight = null;
  }
  // Drop what was cached for types that are no longer allowed.
  function purgeDenied(denied) {
    if (!denied.length) return;
    var c = readCache();
    denied.forEach(function (t) {
      if (c) delete c.vals[VAL_OF[t]];
      if (last && last.vals) delete last.vals[VAL_OF[t]];
    });
    if (c) lsSet(KEY_CACHE, JSON.stringify(c));
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

  function stripEmpty(v) {
    return v.steps == null && v.kcal == null && v.rhr == null && v.avgHr == null && v.sleepMin == null;
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
      ? { status: "loading", vals: cached.vals, denied: cached.denied || [], at: cached.at }
      : { status: "loading", vals: cached ? { weightKg: cached.vals.weightKg } : {}, denied: [], at: 0 };
    if (!hadLast) renderAll();
    inflight = call("checkAuthorization", { read: TYPES }).then(function (a) {
      var ok = (a && a.readAuthorized) || [];
      var denied = TYPES.filter(function (t) { return ok.indexOf(t) < 0; });
      if (!ok.length) { lsDel(KEY_CACHE); return { status: "denied", vals: {}, denied: denied, at: 0, fresh: true }; }
      purgeDenied(denied);
      var due = force || Date.now() - lastRefresh >= THROTTLE_MS || /^(denied|error|loading)$/.test(last.status);
      if (!due) {
        var st = denied.length ? (stripEmpty(last.vals) ? "empty" : "partial") : (last.status === "partial" ? "ok" : last.status);
        return { status: st, vals: last.vals, denied: denied, at: last.at };
      }
      lastRefresh = Date.now();
      return readAll(ok).then(function (r) {
        // Carry the last weight over only while weight is still allowed (a revoked type must not come back from the cache).
        var vals = toVals(r.raw, ok.indexOf("weight") >= 0 && cached ? cached.vals : null);
        if (r.tried && r.failed === r.tried) return { status: "error", vals: last.vals, denied: denied, at: last.at };
        var status = stripEmpty(vals) ? "empty" : (denied.length ? "partial" : "ok");
        return { status: status, vals: vals, denied: denied, at: Date.now(), fresh: true };
      });
    }).catch(function () {
      return { status: "error", vals: last ? last.vals : {}, denied: [], at: last ? last.at : 0 };
    }).then(function (res) {
      if (myGen !== gen) return;
      last = res;
      if (res.fresh && res.status !== "denied") lsSet(KEY_CACHE, JSON.stringify({ day: dayKey, at: res.at, vals: res.vals, denied: res.denied }));
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
  function connect() {
    if (connecting) return Promise.resolve();
    connecting = true;
    return checkAvail(true).then(function (a) {
      avail = a;
      if (a === "none") { renderAll(); return; }
      if (a === "install") return openSheet("install");
      return openSheet("disclose").then(function (go) {
        if (!go) { if (!isOn()) lsSet(KEY_ASK, "later:" + Date.now()); return; }
        return authorize();
      });
    }).catch(function () { toast("connectErr"); }).then(function () {
      connecting = false;
      renderAll();
    });
  }

  function authorize() {
    return call("requestAuthorization", { read: TYPES }).then(function (r) {
      if (r && Array.isArray(r.readAuthorized)) return r.readAuthorized;
      return call("checkAuthorization", { read: TYPES }).then(function (a) { return (a && a.readAuthorized) || []; });
    }).then(function (ok) {
      if (!ok.length) { if (!isOn()) lsSet(KEY_ASK, "later:" + Date.now()); toast("notGranted"); return; }
      lsSet(KEY_ON, "1"); lsSet(KEY_ASK, "yes");
      last = null;
      toast("connected");
      return refresh(true);
    }, function () { toast("connectErr"); });
  }

  function disconnect() {
    gen++;
    lsDel(KEY_ON); lsDel(KEY_CACHE); lsSet(KEY_ASK, "no");
    last = null; lastRefresh = 0; inflight = null;
    renderAll();
    toast("disconnected");
  }

  function manage() {
    call("openHealthConnectSettings").catch(function () { toast("openErr"); });
  }

  // ---------------- sheet (the shared .syd bottom sheet) ----------------
  // kind: "disclose" (Continue resolves true), "install" and "confirm" (Disconnect resolves true)
  function openSheet(kind) {
    if (sheet) return Promise.resolve(false);
    return new Promise(function (resolve) {
      var opener = document.activeElement;
      var title = h("h2", { class: "syd-title", id: "wtTitle" },
        R(kind === "disclose" ? "discTitle" : kind === "install" ? "installHC" : "disconnectConfirmTitle"));
      var body, go, later;
      if (kind === "disclose") {
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
        var f = Array.prototype.filter.call(panel.querySelectorAll("button, a[href]"), function (n) { return !n.disabled && n.offsetParent !== null; });
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

  // ---- motion: count-up, goal rings, idle life (transform/opacity only) ----
  // shown/ring remember what is on screen, so a rebuild or a refresh animates
  // only the difference; t0 is when the strip first appeared with values.
  var anim = { shown: {}, ring: {}, t0: 0, epoch: 0, tasks: [] };
  var live = { card: null, io: null, inView: true };
  function staggerMs() {
    var v = getComputedStyle(document.documentElement).getPropertyValue("--dur-stagger").trim();
    var n = parseFloat(v);
    return isNaN(n) ? 90 : (/ms$/.test(v) ? n : n * 1000) * 2;
  }
  function calm() { return !!(window.GymMotion && GymMotion.reduced()); }
  function forgetAnim() { anim.shown = {}; anim.ring = {}; anim.t0 = 0; }
  function ease(p) { return 1 - Math.pow(1 - p, 4); }

  // One metric cell: icon (inside a goal ring when it has a goal), value, caption, sub line.
  // o: { key, ic, cap, n, fmt, unit, sub, goal, goalKey, off, i, cls, beat }
  function cell(o) {
    var step = staggerMs();
    var empty = o.n == null, quiet = calm();
    var entering = false, el = 0;
    if (!quiet && !empty) {
      if (!anim.t0) anim.t0 = performance.now();
      el = performance.now() - anim.t0;
      entering = el < COUNT_MS + 4 * step;
    }
    var to = empty ? null : o.n;
    var from = empty || quiet ? to : (anim.shown[o.key] != null ? anim.shown[o.key] : 0);
    var hasRing = !!o.goal && !empty && !o.off;
    var ringTo = hasRing ? Math.min(to / o.goal, 1) : null;     // capped at a full ring
    var ringFrom = !hasRing || quiet ? ringTo : (anim.ring[o.key] != null ? anim.ring[o.key] : 0);
    var goalText = function (v) { return s(o.goalKey, { pct: Math.round(v / o.goal * 100), goal: fmtInt(o.goal) }); };

    var numEl = h("span", { class: "wt-n" });
    // digits stay big; letters between them ("h", "m") drop to the unit style
    var put = function (v) {
      var txt = o.fmt(v);
      numEl.textContent = "";
      if (!o.units) { numEl.textContent = txt; return; }
      txt.split(/(\d+)/).forEach(function (part) {
        if (part) numEl.appendChild(/\d/.test(part) ? document.createTextNode(part) : h("span", { class: "wt-unit wt-unit-in" }, part));
      });
    };
    if (empty) numEl.textContent = "—"; else put(from);
    var subEl = hasRing ? h("div", { class: "wt-sub" }, goalText(from)) : (o.sub ? h("div", { class: "wt-sub" }, o.sub) : null);
    var ico = h("span", { class: "wt-ico" });
    var arc = null;
    if (hasRing) {
      arc = svgEl("circle", { class: "wt-ring-arc", cx: 14, cy: 14, r: 12, pathLength: 100, "stroke-dasharray": 100, "stroke-dashoffset": 100 - 100 * ringFrom });
      var ring = svgEl("svg", { class: "wt-ring", viewBox: "0 0 28 28", "aria-hidden": "true" });
      ring.appendChild(svgEl("circle", { class: "wt-ring-track", cx: 14, cy: 14, r: 12 }));
      ring.appendChild(arc);
      ico.appendChild(ring);
    }
    ico.appendChild(icon(o.ic));
    var node = h("div", { class: "wt-cell" + (empty ? " is-empty" : "") + (o.cls ? " " + o.cls : "") + (entering ? " wt-in" : ""), "data-key": o.key },
      ico,
      h("div", { class: "wt-val" }, numEl, !empty && o.unit ? h("span", { class: "wt-unit" }, o.unit) : null),
      h("div", { class: "wt-cap" }, o.cap),
      subEl);
    if (entering) node.style.animationDelay = (o.i * step - el) + "ms";
    if (o.beat && !empty) node.style.setProperty("--wt-beat", Math.min(1.6, Math.max(.8, 60 / o.beat)).toFixed(2) + "s");

    if (empty) { delete anim.shown[o.key]; delete anim.ring[o.key]; return node; }
    anim.shown[o.key] = from;
    if (hasRing) anim.ring[o.key] = ringFrom; else delete anim.ring[o.key];
    if (from !== to || ringFrom !== ringTo) {
      anim.tasks.push({
        node: node, from: from, to: to, rFrom: ringFrom, rTo: ringTo,
        delay: entering ? Math.max(0, o.i * step - el) : 0,
        dur: entering ? Math.max(300, COUNT_MS - Math.max(0, el - o.i * step)) : DELTA_MS,
        paint: function (v, r) {
          anim.shown[o.key] = v;
          put(v);
          if (subEl && hasRing) subEl.textContent = goalText(v);
          if (arc) { anim.ring[o.key] = r; arc.setAttribute("stroke-dashoffset", 100 - 100 * r); }
        }
      });
    }
    return node;
  }

  // One rAF loop for the whole strip; ends by itself, or when a newer render replaces it.
  function runTasks() {
    var tasks = anim.tasks, ep = anim.epoch;
    anim.tasks = [];
    if (!tasks.length) return;
    var t0 = performance.now();
    (function frame() {
      if (ep !== anim.epoch) return;
      var now = performance.now(), left = 0;
      tasks.forEach(function (k) {
        if (!k.node.isConnected) return;
        var p = Math.min(1, Math.max(0, (now - t0 - k.delay) / k.dur));
        if (p < 1) left++;
        var e = ease(p);
        k.paint(Math.round(k.from + (k.to - k.from) * e), k.rTo == null ? null : k.rFrom + (k.rTo - k.rFrom) * e);
      });
      if (left) requestAnimationFrame(frame);
    })();
  }

  // Idle life (heartbeat, moon drift) runs only while the strip is on screen, the
  // page is visible and motion is allowed; the CSS defines no animation otherwise.
  function syncLive() {
    if (live.card) live.card.classList.toggle("wt-live", !calm() && !document.hidden && live.inView);
  }
  function unbindLive() {
    if (live.io) { live.io.disconnect(); live.io = null; }
    live.card = null;
  }
  function bindLive(card) {
    unbindLive();
    live.card = card; live.inView = true;
    if (typeof IntersectionObserver === "function") {
      live.io = new IntersectionObserver(function (es) { live.inView = es[es.length - 1].isIntersecting; syncLive(); });
      live.io.observe(card);
    }
    syncLive();
  }

  function renderPlan() {
    var mount = document.getElementById("watchMount");
    if (!mount) return;
    mount.textContent = "";
    mount.hidden = true;
    anim.epoch++; anim.tasks = [];     // a newer paint supersedes any running count-up
    unbindLive();
    if (!active()) { forgetAnim(); return; }
    var node = null;
    if (isOn()) node = stripNode();
    else { forgetAnim(); if (askDue() && lsGet(KEY_ASK) !== "yes") node = askNode(); }
    if (!node) return;
    mount.appendChild(node);
    mount.hidden = false;
    if (node.querySelector(".wt-cell[data-key]")) { bindLive(node); runTasks(); }
  }

  function askNode() {
    return h("section", { class: "wt-card wt-ask", "aria-labelledby": "wtAskT" },
      h("div", { class: "wt-ask-head" },
        h("span", { class: "wt-badge" }, icon("watch", "wt-ic wt-ic-lg")),
        h("div", {},
          h("h3", { class: "wt-title", id: "wtAskT" }, R("askTitle")),
          h("p", { class: "wt-text" }, R("askBody")))),
      h("div", { class: "wt-actions" },
        btn(s("askYes"), "wt-btn-primary", connect, "wtAskYes"),
        btn(s("askLater"), "wt-btn-line", function () { lsSet(KEY_ASK, "later:" + Date.now()); renderAll(); }, "wtAskLater"),
        btn(s("askNo"), "wt-btn-quiet", function () { lsSet(KEY_ASK, "no"); renderAll(); }, "wtAskNo")));
  }

  function stripNode() {
    var st = last;
    var card = h("section", { class: "wt-card wt-strip", "aria-labelledby": "wtStripT" });
    var meta = st && st.at && st.status !== "denied" ? s("updated", { time: fmtTime(st.at) }) : (!st || st.status === "loading" ? s("loading") : "");
    card.appendChild(h("div", { class: "wt-strip-head" },
      h("h3", { class: "wt-title", id: "wtStripT" }, R("stripTitle")),
      h("span", { class: "wt-meta", role: "status", "aria-live": "polite" }, meta)));
    if (!st || (st.status === "loading" && !st.at)) {
      forgetAnim();
      card.appendChild(h("div", { class: "wt-grid wt-skel", "aria-hidden": "true" }, [0, 1, 2, 3].map(function () { return h("div", { class: "wt-cell wt-skel-cell" }); })));
      return card;
    }
    if (st.status === "denied") {
      forgetAnim();
      card.appendChild(h("p", { class: "wt-text wt-note", role: "status" }, R("accessRemoved")));
      card.appendChild(h("div", { class: "wt-actions" },
        btn(s("rowConnect"), "wt-btn-primary", connect, "wtReconnect"),
        btn(s("openSettings"), "wt-btn-line", manage, "wtOpenHc")));
      return card;
    }
    var v = st.vals || {};
    var off = function (t) { return st.denied.indexOf(t) >= 0; };
    var sub = function (t, hasValue) { return off(t) ? s("cellOff") : (hasValue ? null : s("cellNoData")); };
    var heartOff = off("restingHeartRate");
    var hrSub = heartOff ? s("cellOff") : (v.avgHr != null && !off("heartRate") ? s("avgHr", { n: v.avgHr }) : (v.rhr != null ? null : s("cellNoData")));
    card.appendChild(h("div", { class: "wt-grid" },
      cell({ key: "steps", ic: "steps", cap: s("stepsLbl"), n: v.steps, fmt: fmtInt, goal: GOALS.steps, goalKey: "goalSteps", off: off("steps"), sub: sub("steps", v.steps != null), i: 0 }),
      cell({ key: "kcal", ic: "kcal", cap: s("kcalLbl"), n: v.kcal, fmt: fmtInt, goal: GOALS.kcal, goalKey: "goalKcal", off: off("calories"), sub: sub("calories", v.kcal != null), i: 1 }),
      cell({ key: "rhr", ic: "heart", cap: s("restHrLbl"), n: v.rhr, fmt: String, unit: s("bpm"), sub: hrSub, i: 2, cls: "wt-heart", beat: v.avgHr || v.rhr }),
      cell({ key: "sleep", ic: "sleep", cap: s("sleepLbl"), n: v.sleepMin, fmt: fmtSleep, units: true, sub: sub("sleep", v.sleepMin != null), i: 3, cls: "wt-moon" })));
    if (v.rhr != null || v.avgHr != null) card.appendChild(h("p", { class: "wt-foot" }, R("hrNote")));
    if (st.status === "empty") {
      card.appendChild(h("p", { class: "wt-text wt-note" }, R("noData")));
      card.appendChild(h("div", { class: "wt-actions" }, btn(s("checkAgain"), "wt-btn-line", function () { refresh(true); }, "wtAgain")));
    } else if (st.status === "partial") {
      card.appendChild(h("p", { class: "wt-text wt-note" }, R("partial")));
      card.appendChild(h("div", { class: "wt-actions" }, btn(s("rowManage"), "wt-btn-line", manage, "wtManage")));
    } else if (st.status === "error") {
      card.appendChild(h("p", { class: "wt-text wt-note" }, R("readError")));
      card.appendChild(h("div", { class: "wt-actions" }, btn(s("tryAgain"), "wt-btn-line", function () { refresh(true); }, "wtRetry")));
    }
    return card;
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

  function renderAll() { renderPlan(); renderProfile(); }

  // ---------------- wiring ----------------
  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener("visibilitychange", function () {
      syncLive();
      if (!document.hidden && active() && isOn()) refresh(false);
    });
    try {   // "Remove animations" (data-reduce-motion) or the OS setting flipped: repaint calm / alive
      new MutationObserver(renderPlan).observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion"] });
      var mq = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq && mq.addEventListener) mq.addEventListener("change", renderPlan);
    } catch (e) {}
    function watchHidden(id, fn) {
      var n = document.getElementById(id);
      if (!n || typeof MutationObserver !== "function") return;
      new MutationObserver(function () { if (!n.hidden) fn(); }).observe(n, { attributes: true, attributeFilter: ["hidden"] });
    }
    watchHidden("screen-plan", function () { renderAll(); refresh(false); });
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

  window.GymWatch = { init: init, refresh: function () { return refresh(true); }, connect: connect };
  init();
})();
