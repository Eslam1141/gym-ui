/* watch.js — smartwatch data from Health Connect, Android app only.
 *
 *   Plan tab    ask card ("Do you have a smartwatch?") -> disclosure sheet ->
 *               Health Connect permission sheet -> "today" strip.
 *   Profile     "Watch & Health Connect" row: connect / manage / disconnect.
 *
 * Gate: the native Capacitor shell AND window.Capacitor.Plugins.Health (the
 * @capgo/capacitor-health plugin). On the web, or in an APK without the plugin,
 * nothing is rendered and nothing is stored. Every plugin call can reject; a
 * failure shows a calm message and never breaks the page.
 *
 * Privacy: watch data is read on demand, kept only in this phone's localStorage
 * and never sent anywhere (not gym-be, not the AI coach). The keys are
 * deliberately NOT gym_-prefixed: sync.js uploads every gym_* key. sync.js's
 * clearUserData() wipes the "etqwatch_" prefix on sign-out / account switch,
 * and privacy.js wipes all local data on account delete.
 *
 *   etqwatch_ask    "yes" | "no" | "later:<ms>"   the ask-card answer
 *   etqwatch_on     "1"                            connected and reading
 *   etqwatch_cache  {day, at, vals, denied}        last values shown
 *
 * All user-facing copy is the STR table below. The block marked LEGAL COPY is
 * the disclosure the lawyer's final wording replaces; keep the keys. */
(function () {
  "use strict";

  if (!window.GymDom) throw new Error("watch.js: dom.js must load first");
  var h = GymDom.h;

  var KEY_ASK = "etqwatch_ask", KEY_ON = "etqwatch_on", KEY_CACHE = "etqwatch_cache";
  var TYPES = ["steps", "calories", "heartRate", "restingHeartRate", "sleep", "weight"];
  var ASK_AGAIN_MS = 7 * 24 * 3600 * 1000;
  var THROTTLE_MS = 60 * 1000;
  var PLAY_URL = "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";

  var STR = {
    // ---- ask card ----
    askTitle: ["Do you have a smartwatch?", "هل عندك ساعة ذكية؟"],
    askBody: ["Connect it to see today's steps, calories and sleep next to your plan.",
      "اربطها لتشاهد خطواتك وسعراتك ونومك اليوم بجانب خطتك."],
    askYes: ["Yes, connect it", "نعم، اربطها"],
    askLater: ["Not now", "ليس الآن"],
    askNo: ["No watch", "لا أملك ساعة"],

    // ---- LEGAL COPY: disclosure shown before the Health Connect permission sheet ----
    discTitle: ["Connect your watch", "ربط ساعتك"],
    discLead: ["Etqadem can read your activity from Health Connect, the Android app your watch app syncs to.",
      "يمكن لاتقدم قراءة نشاطك من Health Connect، وهو تطبيق أندرويد الذي تتزامن معه تطبيقات الساعات."],
    discWhatLabel: ["What we read (read only)", "ما نقرؤه (قراءة فقط)"],
    discTypes: [["Steps", "Active calories", "Heart rate", "Resting heart rate", "Sleep", "Weight"],
      ["الخطوات", "السعرات النشطة", "معدل ضربات القلب", "معدل ضربات القلب أثناء الراحة", "النوم", "الوزن"]],
    discWhy: ["Why: to show today's steps, active calories, heart rate and last night's sleep next to your plan, and your latest weight in Profile.",
      "السبب: لعرض خطواتك وسعراتك النشطة ونبضك ونومك الليلة الماضية بجانب خطتك، وآخر وزن لك في الملف الشخصي."],
    discStays: ["This data stays on this phone. It is not sent to our servers or to the AI coach, and Etqadem never writes to Health Connect.",
      "تبقى هذه البيانات على هذا الهاتف. لا تُرسل إلى خوادمنا ولا إلى المدرّب الذكي، ولا تكتب اتقدم أي شيء في Health Connect."],
    discChange: ["You can disconnect any time in Profile, or remove access in Health Connect.",
      "يمكنك إيقاف الربط في أي وقت من الملف الشخصي، أو إزالة الصلاحيات من Health Connect."],
    discPolicy: ["Privacy Policy", "سياسة الخصوصية"],
    // ---- end LEGAL COPY ----
    discGo: ["Continue", "متابعة"],
    discLater: ["Not now", "ليس الآن"],

    // ---- Health Connect missing ----
    instTitle: ["Install Health Connect", "تثبيت Health Connect"],
    instBody: ["Your watch app shares data through Health Connect, and it isn't on this phone yet. Install it, then come back and tap Connect.",
      "تشارك تطبيقات الساعات بياناتها عبر Health Connect وهو غير مثبّت على هذا الهاتف. ثبّته ثم عُد واضغط ربط."],
    instGo: ["Open Google Play", "فتح Google Play"],
    instLater: ["Not now", "ليس الآن"],

    // ---- today strip ----
    stripTitle: ["From your watch", "من ساعتك"],
    updated: ["Updated {t}", "آخر تحديث {t}"],
    loading: ["Reading your watch data...", "جارٍ قراءة بيانات ساعتك..."],
    steps: ["Steps", "الخطوات"],
    kcal: ["Active kcal", "السعرات النشطة"],
    heart: ["Resting heart rate", "نبض الراحة"],
    sleep: ["Last night's sleep", "نوم الليلة الماضية"],
    bpm: ["bpm", "نبضة/د"],
    avgHr: ["avg {n} today", "المتوسط {n} اليوم"],
    noData: ["No data", "لا توجد بيانات"],
    offCell: ["Not allowed", "غير مسموح"],
    hr: ["h", "س"],
    min: ["m", "د"],
    emptyMsg: ["No data from your watch yet. Open your watch app so it can sync, then check again.",
      "لا توجد بيانات من ساعتك بعد. افتح تطبيق الساعة ليتزامن، ثم أعد التحقق."],
    checkAgain: ["Check again", "تحقق مرة أخرى"],
    deniedMsg: ["Etqadem doesn't have permission to read your watch data. Allow it in Health Connect.",
      "ليس لدى اتقدم إذن لقراءة بيانات ساعتك. اسمح بذلك من Health Connect."],
    partialMsg: ["Some data types are turned off.", "بعض أنواع البيانات متوقفة."],
    openHc: ["Open Health Connect", "فتح Health Connect"],
    errMsg: ["Couldn't read Health Connect. Try again in a moment.", "تعذّرت القراءة من Health Connect. حاول بعد قليل."],
    tryAgain: ["Try again", "حاول مرة أخرى"],

    // ---- Profile row ----
    rowTitle: ["Watch & Health Connect", "الساعة و Health Connect"],
    rowOff: ["Not connected. Show your watch's steps, calories and sleep next to your plan.",
      "غير مربوطة. اعرض خطوات ساعتك وسعراتها ونومها بجانب خطتك."],
    rowOn: ["Connected. Data stays on this phone.", "مربوطة. تبقى البيانات على هذا الهاتف."],
    rowDenied: ["Connected, but permission is off. Allow it in Health Connect.",
      "مربوطة، لكن الإذن متوقف. اسمح به من Health Connect."],
    rowWeight: ["Latest weight from your watch: {w} kg", "آخر وزن من ساعتك: {w} كجم"],
    connect: ["Connect", "ربط"],
    manage: ["Manage permissions", "إدارة الأذونات"],
    disconnect: ["Disconnect", "إيقاف الربط"],
    disconnected: ["Disconnected. Etqadem stopped reading and removed the saved values from this phone. To remove its access completely, open Health Connect.",
      "تم إيقاف الربط. توقفت اتقدم عن القراءة وحذفت القيم المحفوظة من هذا الهاتف. لإزالة صلاحياتها بالكامل افتح Health Connect."],

    // ---- toasts ----
    connected: ["Watch connected", "تم ربط الساعة"],
    notGranted: ["No access was given. You can connect any time from Profile.",
      "لم يُمنح أي إذن. يمكنك الربط في أي وقت من الملف الشخصي."],
    connectErr: ["Couldn't connect to Health Connect. Try again in a moment.",
      "تعذّر الاتصال بـ Health Connect. حاول بعد قليل."],
    openErr: ["Couldn't open Health Connect. Open it from your phone's settings.",
      "تعذّر فتح Health Connect. افتحه من إعدادات هاتفك."],
    close: ["Close", "إغلاق"]
  };

  var AR_LANG = 1;
  function li() { return GymDom.lang() === "ar" ? AR_LANG : 0; }
  function s(key, params) {
    var e = STR[key];
    var v = e ? e[li()] : key;
    if (params) v = v.replace(/\{(\w+)\}/g, function (_, k) { return params[k] != null ? String(params[k]) : ""; });
    return v;
  }

  // ---------------- device-local storage ----------------
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function readCache() {
    try {
      var c = JSON.parse(lsGet(KEY_CACHE));
      return c && typeof c === "object" && c.vals ? c : null;
    } catch (e) { return null; }
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
    last = null; lastRefresh = 0; inflight = null; discMsg = false;
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

  // "ok" | "install" (Health Connect missing/outdated) | "none" (hide the feature)
  var availP = null;
  function checkAvail(force) {
    if (availP && !force) return availP;
    availP = call("isAvailable").then(function (r) {
      if (r && r.available) return "ok";
      if (r && r.platform && r.platform !== "android") return "none";
      var why = String((r && r.reason) || "");
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
  var discMsg = false;    // Profile shows the "disconnected" explanation
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
    if (!list.length) return null;
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

  // Each read is independent: one failing or denied type leaves the rest intact.
  // Resolves { ok, v }.
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

  function refresh(force) {
    if (!active() || !isOn()) return Promise.resolve();
    if (inflight) return inflight;
    if (!force && Date.now() - lastRefresh < THROTTLE_MS) return Promise.resolve();
    lastRefresh = Date.now();
    var myGen = gen;
    var cached = readCache();
    var dayKey = GymDate.key();
    if (!last) last = cached && cached.day === dayKey
      ? { status: "loading", vals: cached.vals, denied: cached.denied || [], at: cached.at }
      : { status: "loading", vals: cached ? { weightKg: cached.vals.weightKg } : {}, denied: [], at: 0 };
    renderAll();
    inflight = call("checkAuthorization", { read: TYPES }).then(function (a) {
      var ok = (a && a.readAuthorized) || [];
      var denied = TYPES.filter(function (t) { return ok.indexOf(t) < 0; });
      if (!ok.length) return { status: "denied", vals: {}, denied: denied };
      return readAll(ok).then(function (r) {
        var vals = toVals(r.raw, cached && cached.vals);
        if (r.tried && r.failed === r.tried) return { status: "error", vals: last ? last.vals : {}, denied: denied, keep: true };
        var status = stripEmpty(vals) ? "empty" : (denied.length ? "partial" : "ok");
        return { status: status, vals: vals, denied: denied };
      });
    }).catch(function () {
      return { status: "error", vals: last ? last.vals : {}, denied: [], keep: true };
    }).then(function (res) {
      if (myGen !== gen) return;
      res.at = Date.now();
      if (res.keep) res.at = last ? last.at : 0;
      last = res;
      if (!res.keep) lsSet(KEY_CACHE, JSON.stringify({ day: dayKey, at: res.at, vals: res.vals, denied: res.denied }));
    }).then(function () {
      inflight = null;
      renderAll();
    });
    return inflight;
  }

  // ---------------- connect flow ----------------
  function toast(key) { if (window.GymToast) GymToast.show({ message: s(key) }); }

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
      if (!ok.length) { lsSet(KEY_ASK, "later:" + Date.now()); toast("notGranted"); return; }
      lsSet(KEY_ON, "1"); lsSet(KEY_ASK, "yes");
      discMsg = false; last = null;
      toast("connected");
      return refresh(true);
    }, function () { toast("connectErr"); });
  }

  function disconnect() {
    gen++;
    lsDel(KEY_ON); lsDel(KEY_CACHE); lsSet(KEY_ASK, "no");
    last = null; lastRefresh = 0; inflight = null; discMsg = true;
    renderAll();
  }

  function manage() {
    call("openHealthConnectSettings").catch(function () { toast("openErr"); });
  }

  // ---------------- sheet (the shared .syd bottom sheet) ----------------
  function openSheet(kind) {
    if (sheet) return Promise.resolve(false);
    return new Promise(function (resolve) {
      var opener = document.activeElement;
      var disclose = kind === "disclose";
      var title = h("h2", { class: "syd-title", id: "wtTitle", tabindex: "-1" }, s(disclose ? "discTitle" : "instTitle"));
      var body = [];
      var go;
      if (disclose) {
        var types = STR.discTypes[li()];
        body.push(
          h("p", { class: "syd-body wt-p" }, s("discLead")),
          h("div", { class: "wt-what" },
            h("div", { class: "wt-what-l" }, s("discWhatLabel")),
            h("ul", {}, types.map(function (t) { return h("li", {}, t); }))),
          h("p", { class: "syd-body wt-p" }, s("discWhy")),
          h("p", { class: "syd-body wt-p wt-strong" }, s("discStays")),
          h("p", { class: "syd-body wt-p" }, s("discChange")),
          h("p", { class: "pol-line" }, GymDom.policyLink(null, s("discPolicy"), true)));
        go = h("button", { type: "button", class: "syd-yes", id: "wtGo" }, s("discGo"));
      } else {
        body.push(h("p", { class: "syd-body" }, s("instBody")));
        go = h("a", { class: "syd-yes wt-a", id: "wtGo", href: PLAY_URL, target: "_blank", rel: "noopener" }, s("instGo"));
      }
      var later = h("button", { type: "button", class: "syd-no", id: "wtLater" }, s(disclose ? "discLater" : "instLater"));
      var panel = h("div", { class: "syd-panel wt-panel m-ovl-card", role: "dialog", "aria-modal": "true", "aria-labelledby": "wtTitle" },
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
      if (disclose) go.addEventListener("click", function () { close(true); });
      else go.addEventListener("click", function () { close(false); });
      later.addEventListener("click", function () { close(false); });
      backdrop.addEventListener("click", function () { close(false); });
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(root);
      sheet = root;
      GymMotion.show(root);
      title.focus();
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

  function cell(ic, caption, value, unit, sub) {
    return h("div", { class: "wt-cell" + (value == null ? " is-empty" : "") },
      icon(ic),
      h("div", { class: "wt-val" }, value == null ? "—" : value, value != null && unit ? h("span", { class: "wt-unit" }, unit) : null),
      h("div", { class: "wt-cap" }, caption),
      sub ? h("div", { class: "wt-sub" }, sub) : null);
  }

  function renderPlan() {
    var mount = document.getElementById("watchMount");
    if (!mount) return;
    mount.textContent = "";
    mount.hidden = true;
    if (!active()) return;
    var node = null;
    if (isOn()) node = stripNode();
    else if (askDue() && lsGet(KEY_ASK) !== "yes") node = askNode();
    if (!node) return;
    mount.appendChild(node);
    mount.hidden = false;
  }

  function askNode() {
    return h("section", { class: "wt-card wt-ask", "aria-labelledby": "wtAskT" },
      h("div", { class: "wt-ask-head" },
        h("span", { class: "wt-badge" }, icon("watch", "wt-ic wt-ic-lg")),
        h("div", {},
          h("h3", { class: "wt-title", id: "wtAskT" }, s("askTitle")),
          h("p", { class: "wt-text" }, s("askBody")))),
      h("div", { class: "wt-actions" },
        btn(s("askYes"), "wt-btn-primary", connect, "wtAskYes"),
        btn(s("askLater"), "wt-btn-line", function () { lsSet(KEY_ASK, "later:" + Date.now()); renderAll(); }, "wtAskLater"),
        btn(s("askNo"), "wt-btn-quiet", function () { lsSet(KEY_ASK, "no"); renderAll(); }, "wtAskNo")));
  }

  function stripNode() {
    var st = last;
    var card = h("section", { class: "wt-card wt-strip", "aria-labelledby": "wtStripT" });
    var meta = st && st.at && st.status !== "loading" ? s("updated", { t: fmtTime(st.at) }) : (st && st.status === "loading" && !st.at ? s("loading") : (st && st.at ? s("updated", { t: fmtTime(st.at) }) : ""));
    card.appendChild(h("div", { class: "wt-strip-head" },
      h("h3", { class: "wt-title", id: "wtStripT" }, s("stripTitle")),
      h("span", { class: "wt-meta", role: "status", "aria-live": "polite" }, meta)));
    if (!st || (st.status === "loading" && !st.at)) {
      card.appendChild(h("div", { class: "wt-grid wt-skel", "aria-hidden": "true" }, [0, 1, 2, 3].map(function () { return h("div", { class: "wt-cell wt-skel-cell" }); })));
      return card;
    }
    if (st.status === "denied") {
      card.appendChild(h("p", { class: "wt-text wt-note" }, s("deniedMsg")));
      card.appendChild(h("div", { class: "wt-actions" }, btn(s("openHc"), "wt-btn-line", manage, "wtOpenHc")));
      return card;
    }
    var v = st.vals || {};
    var off = function (t) { return st.denied.indexOf(t) >= 0; };
    var sub = function (t, hasValue) { return off(t) ? s("offCell") : (hasValue ? null : s("noData")); };
    var heartOff = off("restingHeartRate");
    card.appendChild(h("div", { class: "wt-grid" },
      cell("steps", s("steps"), v.steps != null ? fmtInt(v.steps) : null, null, sub("steps", v.steps != null)),
      cell("kcal", s("kcal"), v.kcal != null ? fmtInt(v.kcal) : null, null, sub("calories", v.kcal != null)),
      cell("heart", s("heart"), v.rhr != null ? String(v.rhr) : null, s("bpm"),
        heartOff ? s("offCell") : (v.avgHr != null && !off("heartRate") ? s("avgHr", { n: v.avgHr }) : (v.rhr != null ? null : s("noData")))),
      cell("sleep", s("sleep"), v.sleepMin != null ? fmtSleep(v.sleepMin) : null, null, sub("sleep", v.sleepMin != null))));
    if (st.status === "empty") {
      card.appendChild(h("p", { class: "wt-text wt-note" }, s("emptyMsg")));
      card.appendChild(h("div", { class: "wt-actions" }, btn(s("checkAgain"), "wt-btn-line", function () { refresh(true); }, "wtAgain")));
    } else if (st.status === "partial") {
      card.appendChild(h("p", { class: "wt-text wt-note" }, s("partialMsg")));
      card.appendChild(h("div", { class: "wt-actions" }, btn(s("manage"), "wt-btn-line", manage, "wtManage")));
    } else if (st.status === "error") {
      card.appendChild(h("p", { class: "wt-text wt-note" }, s("errMsg")));
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
    var denied = on && last && last.status === "denied";
    var cache = readCache();
    var weight = on && cache && cache.vals && cache.vals.weightKg != null ? cache.vals.weightKg : (last && last.vals && last.vals.weightKg);
    var desc = s(denied ? "rowDenied" : (on ? "rowOn" : "rowOff"));
    var actions = on
      ? [btn(s("manage"), "wt-btn-line", manage, "wtProfManage"), btn(s("disconnect"), "wt-btn-quiet wt-btn-danger", disconnect, "wtProfDisc")]
      : [btn(s("connect"), "wt-btn-primary", connect, "wtProfConnect")];
    mount.appendChild(h("section", { class: "more-group wt-prof", "aria-labelledby": "wtProfT" },
      h("div", { class: "more-label", id: "wtProfT" }, s("rowTitle")),
      h("div", { class: "wt-card" },
        h("p", { class: "wt-text" }, desc),
        on && weight != null ? h("p", { class: "wt-text wt-weight" }, s("rowWeight", { w: weight })) : null,
        !on && discMsg ? h("p", { class: "wt-text wt-note", role: "status" }, s("disconnected")) : null,
        h("div", { class: "wt-actions" }, actions))));
    mount.hidden = false;
  }

  function renderAll() { renderPlan(); renderProfile(); }

  // ---------------- wiring ----------------
  function visible(id) { var n = document.getElementById(id); return !!n && !n.hidden; }

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
