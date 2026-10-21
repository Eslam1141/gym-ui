/* admin.js — Etqadem admin dashboard (admin.html only).
 * Reads the session sync.js stored in this tab's sessionStorage; never loads
 * sync.js. gym-be enforces admin rights on every call — this page only
 * reacts to 401/403. All API data is rendered with textContent. */
(function () {
  "use strict";
  var API_BASE = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var LANG = (function () { try { return localStorage.getItem("gym_lang") === "ar" ? "ar" : "en"; } catch (e) { return "en"; } })();
  var AR = LANG === "ar";

  var STR = {
    title: ["Admin dashboard", "لوحة الإدارة"],
    back: ["App", "التطبيق"],
    backAria: ["Back to app", "العودة إلى التطبيق"],
    tabOverview: ["Overview", "نظرة عامة"],
    tabUsers: ["Users", "المستخدمون"],
    tabRemoved: ["Removed users", "المستخدمون المحذوفون"],
    tabActivity: ["Activity", "النشاط"],
    noSession: ["Open this page from the app's avatar menu while signed in.", "افتح هذه الصفحة من قائمة الصورة الرمزية في التطبيق بعد تسجيل الدخول."],
    expired: ["Your session expired. Go back to the app, then open Admin again.", "انتهت جلستك. عد إلى التطبيق ثم افتح لوحة الإدارة مرة أخرى."],
    notAdmin: ["Not authorized. This page is for admins only.", "غير مصرح. هذه الصفحة للمسؤولين فقط."],
    loadErr: ["Could not load. Check your connection and try again.", "تعذر التحميل. تحقق من اتصالك وحاول مرة أخرى."],
    retry: ["Retry", "إعادة المحاولة"],
    loading: ["Loading…", "جارٍ التحميل…"],
    cTotal: ["Total users", "إجمالي المستخدمين"],
    cToday: ["New today", "جدد اليوم"],
    c7: ["New · 7 days", "جدد · 7 أيام"],
    c30: ["New · 30 days", "جدد · 30 يومًا"],
    cA7: ["Active · 7 days", "نشطون · 7 أيام"],
    cA30: ["Active · 30 days", "نشطون · 30 يومًا"],
    cBlocked: ["Blocked", "محظورون"],
    chartTitleW: ["New sign-ups per week — last 90 days", "الحسابات الجديدة أسبوعيًا — آخر 90 يومًا"],
    chartTitleD: ["New sign-ups per day — last 90 days", "الحسابات الجديدة يوميًا — آخر 90 يومًا"],
    chartHintW: ["Across is time, one bar per week; the date under a bar is that week's first day. Height is the number of new accounts. Tap a bar for its dates and count.",
      "الاتجاه الأفقي هو الزمن، وكل عمود يمثل أسبوعًا؛ التاريخ تحت العمود هو أول يوم في الأسبوع. الارتفاع هو عدد الحسابات الجديدة. اضغط على العمود لرؤية التواريخ والعدد."],
    chartHintD: ["Across is time, one bar per day, with the month marked underneath. Height is the number of new accounts. Tap a bar for its date and count.",
      "الاتجاه الأفقي هو الزمن، وكل عمود يمثل يومًا مع تسمية الشهر تحته. الارتفاع هو عدد الحسابات الجديدة. اضغط على العمود لرؤية التاريخ والعدد."],
    chartWeekly: ["Weekly", "أسبوعي"],
    chartDaily: ["Daily", "يومي"],
    chartView: ["Chart view", "عرض الرسم"],
    chartTip: ["{d}: {n}", "{d}: {n}"],
    chartSum: ["{n} sign-ups in total · Busiest day: {d} ({m}) · Today: {t}", "{n} تسجيلًا إجمالًا · أكثر يوم: {d} ({m}) · اليوم: {t}"],
    updated: ["Live · updated {t}", "مباشر · آخر تحديث {t}"],
    chartAlt: ["{n} signups in the last 90 days; busiest day {d} with {m}.", "{n} تسجيلًا في آخر 90 يومًا؛ أكثر يوم {d} بعدد {m}."],
    provTitle: ["Sign-in methods", "طرق تسجيل الدخول"],
    pGoogle: ["Google", "Google"],
    pPassword: ["E-mail", "البريد الإلكتروني"],
    pApple: ["Apple", "Apple"],
    pBoth: ["Both", "كلاهما"],
    dWeek: ["+{n} this week", "+{n} هذا الأسبوع"],
    dAvg: ["{p} vs weekly average", "{p} مقارنة بمتوسط الأسبوع"],
    dShare: ["{p} of all users", "{p} من كل المستخدمين"],
    search: ["Search by email or name", "ابحث بالبريد أو الاسم"],
    sortNew: ["Newest first", "الأحدث أولًا"],
    sortSeen: ["Recently active", "النشطون مؤخرًا"],
    colJoined: ["Joined", "انضم"],
    colSeen: ["Last active", "آخر نشاط"],
    colMethod: ["Sign-in", "الدخول"],
    blocked: ["Blocked", "محظور"],
    admin: ["Admin", "مسؤول"],
    none: ["No users found.", "لا يوجد مستخدمون."],
    prev: ["Previous", "السابق"],
    next: ["Next", "التالي"],
    pageOf: ["Page {p} of {n} · {t} users", "صفحة {p} من {n} · {t} مستخدم"],
    close: ["Close", "إغلاق"],
    kvEmail: ["Email", "البريد"], kvId: ["User ID", "معرّف المستخدم"], kvVerified: ["Email verified", "البريد موثّق"],
    kvStreak: ["Streak", "السلسلة"], kvDays: ["Days trained", "أيام التمرين"], kvWorkouts: ["Workouts logged", "التمارين المسجلة"],
    kvMeals: ["Meals logged", "الوجبات المسجلة"], kvBlockedAt: ["Blocked since", "محظور منذ"],
    yes: ["Yes", "نعم"], no: ["No", "لا"],
    editTitle: ["Edit profile", "تعديل الملف"],
    fName: ["Display name", "الاسم الظاهر"], fWeight: ["Weight (kg)", "الوزن (كجم)"], fHeight: ["Height (cm)", "الطول (سم)"],
    fVerified: ["Email verified", "البريد موثّق"],
    save: ["Save", "حفظ"], saved: ["Saved.", "تم الحفظ."],
    reset: ["Send password reset", "إرسال إعادة تعيين كلمة المرور"], resetSent: ["Reset email sent.", "تم إرسال بريد إعادة التعيين."],
    block: ["Block", "حظر"], unblock: ["Unblock", "إلغاء الحظر"],
    blockConfirm: ["Block {e}? They will be signed out everywhere.", "حظر {e}؟ سيتم تسجيل خروجه من كل مكان."],
    del: ["Delete account", "حذف الحساب"],
    delTitle: ["Delete this account permanently?", "حذف هذا الحساب نهائيًا؟"],
    delBody: ["This deletes the account and all its data (workouts, meals, photos, AI coach history). It cannot be undone. Type the user's email to confirm:", "سيؤدي هذا إلى حذف الحساب وكل بياناته (التمارين، الوجبات، الصور، سجل المدرب الذكي). لا يمكن التراجع. اكتب بريد المستخدم للتأكيد:"],
    delGo: ["Delete permanently", "حذف نهائي"], cancel: ["Cancel", "إلغاء"],
    deleted: ["Account deleted.", "تم حذف الحساب."],
    eCannotAdmin: ["Admin accounts can't be changed here.", "لا يمكن تعديل حسابات المسؤولين من هنا."],
    eNoPassword: ["This account signs in with Google only.", "هذا الحساب يسجّل الدخول عبر Google فقط."],
    eMismatch: ["The email doesn't match.", "البريد غير مطابق."],
    eAssistant: ["Couldn't delete AI coach data, so nothing was deleted. Try again later.", "تعذر حذف بيانات المدرب الذكي، لذلك لم يُحذف شيء. حاول لاحقًا."],
    eUnavailable: ["This action isn't configured on the server yet.", "هذا الإجراء غير مُعدّ على الخادم بعد."],
    eNotFound: ["User not found.", "المستخدم غير موجود."],
    eBlockedReset: ["This account is blocked, so no reset email was sent. Unblock it first.", "هذا الحساب محظور، لذلك لم يُرسل بريد إعادة التعيين. ألغِ الحظر أولًا."],
    fReason: ["Reason (optional)", "السبب (اختياري)"],
    rmNone: ["No removed users. Deleted accounts are listed here so they can't sign up again.", "لا يوجد مستخدمون محذوفون. تظهر الحسابات المحذوفة هنا لمنع إعادة تسجيلها."],
    rmBy: ["Deleted by {a}", "حذفه {a}"],
    rmReason: ["Reason: {r}", "السبب: {r}"],
    rmExpires: ["Block ends {d}", "ينتهي المنع {d}"],
    rmPageOf: ["Page {p}", "صفحة {p}"],
    reallow: ["Re-allow", "السماح مجددًا"],
    reallowTitle: ["Let this person sign up again?", "السماح لهذا الشخص بالتسجيل مجددًا؟"],
    reallowBody: ["They will be able to create a new account with this email. Their old data stays deleted.", "سيتمكن من إنشاء حساب جديد بهذا البريد. تبقى بياناته القديمة محذوفة."],
    reallowed: ["{e} can sign up again.", "يمكن لـ {e} التسجيل مجددًا."],
    eGeneric: ["Something went wrong. Try again.", "حدث خطأ. حاول مرة أخرى."],
    actBlock: ["blocked", "حظر"], actUnblock: ["unblocked", "ألغى حظر"], actEdit: ["edited", "عدّل"],
    actReallow: ["re-allowed sign-up for", "سمح مجددًا بتسجيل"],
    actDeletePartial: ["partially deleted (failed):", "حذف جزئيًا (فشل):"],
    actReset: ["sent a password reset to", "أرسل إعادة تعيين كلمة المرور إلى"], actDelete: ["deleted", "حذف"],
    noActivity: ["No admin actions yet.", "لا توجد إجراءات إدارية بعد."], more: ["Load more", "تحميل المزيد"]
  };
  function s(key, params) {
    var v = STR[key] ? STR[key][AR ? 1 : 0] : key;
    if (params) v = v.replace(/\{(\w+)\}/g, function (_, k) { return params[k] != null ? String(params[k]) : ""; });
    return v;
  }
  function addStrings(extra) { for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) STR[k] = extra[k]; }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k) || attrs[k] == null || attrs[k] === false) continue;
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    (children || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return "—";
    try { return d.toLocaleDateString(AR ? "ar" : "en", { year: "numeric", month: "short", day: "numeric" }); } catch (e) { return iso.slice(0, 10); }
  }
  function fmtNum(n) { try { return Number(n || 0).toLocaleString(AR ? "ar" : "en"); } catch (e) { return String(n || 0); } }
  var REDUCE = false;
  try { REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  // Overview cards: count from 0 to n (ease-out, ~0.9 s); final text is
  // exactly fmtNum(n). Reduced motion shows n at once.
  function countUp(node, n) {
    n = Number(n || 0);
    if (REDUCE || !n || !window.requestAnimationFrame) { node.textContent = fmtNum(n); return node; }
    node.textContent = fmtNum(0);
    var t0 = 0;
    requestAnimationFrame(function tick(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / 900);
      node.textContent = fmtNum(p < 1 ? Math.round(n * (1 - Math.pow(1 - p, 3))) : n);
      if (p < 1 && node.isConnected) requestAnimationFrame(tick);
    });
    return node;
  }

  // ---- session + api ----
  function session() {
    try {
      var x = JSON.parse(sessionStorage.getItem("gymauth_session"));
      if (x && x.token && x.exp && x.exp * 1000 > Date.now() + 30000) return x;
    } catch (e) {}
    return null;
  }
  function api(path, opts) {
    var sess = session();
    if (!sess) return Promise.resolve({ ok: false, status: 401, code: "no_session" });
    opts = opts || {};
    var headers = { "Authorization": "Bearer " + sess.token };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 15000);
    return fetch(API_BASE + "/admin" + path, {
      method: opts.method || "GET", headers: headers, signal: ctrl.signal,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      clearTimeout(timer);
      if (res.status === 204) return { ok: true, status: 204 };
      var ct = res.headers.get("Content-Type") || "";
      if (ct.indexOf("application/json") < 0) return { ok: res.ok, status: res.status, blob: res };
      return res.json().then(function (j) {
        if (res.ok) return { ok: true, status: res.status, data: j };
        return { ok: false, status: res.status, code: j && j.error && j.error.code, message: j && j.error && j.error.message };
      });
    }).catch(function () { clearTimeout(timer); return { ok: false, status: 0, code: "network" }; });
  }
  // Global auth failures replace the page with a message.
  function authFailed(r) {
    if (r.status === 401) { showMsg(session() ? "expired" : "noSession", true); return true; }
    if (r.status === 403 && (r.code === "forbidden" || r.code === "account_blocked" || r.code === "account_removed")) { showMsg("notAdmin", true); return true; }
    return false;
  }

  // ---- shell ----
  var main, state = { tab: "overview" };
  function showMsg(key, withLink) {
    document.getElementById("admTabs").hidden = true;
    main.textContent = "";
    main.appendChild(el("div", { class: "adm-msg" }, [
      el("p", { text: s(key) }),
      withLink ? el("a", { href: "./", text: s("back") }) : null
    ]));
  }
  function showError(retryFn) {
    main.textContent = "";
    main.appendChild(el("div", { class: "adm-msg" }, [
      el("p", { text: s("loadErr") }),
      el("button", { class: "adm-btn", text: s("retry"), onclick: retryFn })
    ]));
  }
  function setTab(tab) {
    state.tab = tab;
    ["overview", "users", "removed", "activity", "feedback"].forEach(function (t) {
      var b = document.querySelector('[data-tab="' + t + '"]');
      b.setAttribute("aria-selected", t === tab ? "true" : "false");
    });
    try { history.replaceState(null, "", "#" + tab); } catch (e) {}
    render(tab);
  }
  var views = {}; // tab -> function(main)
  function render(tab) {
    main.classList.remove("adm-quiet");
    main.textContent = "";
    main.appendChild(el("p", { class: "adm-msg", text: s("loading") }));
    views[tab](main);
  }

  // ---- overview ----
  var ICONS = {
    users: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.3c2 .8 3.5 2.6 3.5 5.7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="3.5"/><path d="M3 20c0-3.6 3-6 7-6 1.5 0 2.8.3 4 .9"/><path d="M19 14v6M16 17h6"/></svg>',
    cal7: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17M8 14h2M12 14h2M16 14h.01"/></svg>',
    cal30: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17M8 14h2M12 14h2M16 14h2M8 17h2M12 17h2"/></svg>',
    pulse: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.5-6 4 12 2.5-6H21"/></svg>',
    ban: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>'
  };
  views.overview = function () { loadOverview(false); };
  // quiet = live refresh: keep what's on screen if it fails, no loading
  // placeholder, no entrance animation or count-up.
  function loadOverview(quiet) {
    api("/stats").then(function (r) {
      if (authFailed(r)) return;
      if (state.tab !== "overview") return; // switched tabs while loading
      if (!r.ok) { if (!quiet) showError(function () { render("overview"); }); return; }
      var st = r.data;
      main.classList.toggle("adm-quiet", quiet);
      main.textContent = "";
      var tot = st.totalUsers || 0;
      var pctOf = function (n) { return tot ? Math.round(100 * n / tot) : 0; };
      var pcs = function (n) { return fmtNum(n) + "%"; };
      var share = function (n) { return n > 0 && pctOf(n) < 1 ? "<1%" : pcs(pctOf(n)); };
      // 7-day delta against the weekly average of the 23 days before it
      var prevWeek = (st.newUsers.d30 - st.newUsers.d7) / 23 * 7;
      var trend = prevWeek > 0 ? Math.round(100 * (st.newUsers.d7 - prevWeek) / prevWeek) : null;
      var cards = [
        ["cTotal", tot, "users", st.newUsers.d7 > 0 ? { t: s("dWeek", { n: fmtNum(st.newUsers.d7) }) } : null, "wide"],
        ["cToday", st.newUsers.today, "plus"],
        ["c7", st.newUsers.d7, "cal7", trend == null ? null : { t: s("dAvg", { p: (trend > 0 ? "+" : "") + pcs(trend) }), dir: trend > 0 ? "up" : trend < 0 ? "down" : "" }],
        ["c30", st.newUsers.d30, "cal30"],
        ["cA7", st.activeUsers.d7, "pulse", { t: s("dShare", { p: share(st.activeUsers.d7) }) }],
        ["cA30", st.activeUsers.d30, "pulse", { t: s("dShare", { p: share(st.activeUsers.d30) }) }],
        ["cBlocked", st.blockedUsers, "ban", st.blockedUsers ? { t: s("dShare", { p: share(st.blockedUsers) }) } : null, "warn"]
      ];
      var tiles = cards.map(function (c, i) {
        var num = quiet ? el("b", { text: fmtNum(c[1]) }) : countUp(el("b"), c[1]);
        var ico = el("span", { class: "adm-ico", "aria-hidden": "true" });
        ico.innerHTML = ICONS[c[2]];
        var tile = el("div", { class: "adm-tile adm-card" + (c[4] ? " adm-t-" + c[4] : "") }, [
          ico, num, el("span", { class: "adm-lbl", text: s(c[0]) }),
          c[3] ? el("i", { class: "adm-delta" + (c[3].dir ? " " + c[3].dir : ""), text: c[3].t }) : null
        ]);
        tile.style.setProperty("--i", i);
        return tile;
      });
      var series = st.signupsPerDay || [];
      var sum = series.reduce(function (a, d) { return a + d.count; }, 0);
      var peak = series.reduce(function (b, d) { return d.count > (b ? b.count : -1) ? d : b; }, null);
      var chartTile = el("section", { class: "adm-tile adm-section adm-t-chart" });
      var drawChart = function (mode) {
        chartTile.textContent = "";
        var weekly = mode === "week";
        [
          el("h2", { text: s(weekly ? "chartTitleW" : "chartTitleD") }),
          viewToggle(mode, drawChart),
          el("p", { class: "adm-hint", text: s(weekly ? "chartHintW" : "chartHintD") }),
          el("p", { class: "adm-sum", text: s("chartSum", { n: fmtNum(sum), d: peak ? peak.date : "—", m: peak ? fmtNum(peak.count) : 0, t: fmtNum(st.newUsers.today) }) }),
          chart(series, mode)
        ].forEach(function (n) { chartTile.appendChild(n); });
      };
      drawChart(chartMode());
      chartTile.style.setProperty("--i", cards.length);
      var p = st.providers, base = tot || (p.google + p.password + p.both) || 1;
      var provRows = [["pPassword", p.password + p.both], ["pGoogle", p.google + p.both], ["pBoth", p.both]];
      if (typeof p.apple === "number") provRows.splice(2, 0, ["pApple", p.apple]);
      var provTile = el("section", { class: "adm-tile adm-section adm-t-prov" }, [
        el("h2", { text: s("provTitle") }),
        el("div", { class: "adm-bars" }, provRows.map(function (x) {
          var share = Math.min(100, Math.round(100 * x[1] / base));
          var bar = el("i"); bar.style.width = share + "%";
          return el("div", null, [el("span", { text: s(x[0]) }), el("span", { class: "adm-track" }, [bar]), el("span", { text: fmtNum(x[1]) + " · " + fmtNum(share) + "%" })]);
        }))
      ]);
      provTile.style.setProperty("--i", cards.length + 1);
      main.appendChild(el("div", { class: "adm-grid" }, tiles.concat([chartTile, provTile])));
      stampUpdated();
    });
  }

  // ---- live refresh: overview and the users list re-fetch every 30 s while
  // the page is visible (and right away when it becomes visible again), so
  // the numbers track real users without a manual reload. Paused while a
  // user panel is open so nothing moves under an admin action.
  var LIVE_MS = 30000;
  function stampUpdated() {
    var u = document.getElementById("admUpdated");
    if (!u) return;
    var t;
    try { t = new Date().toLocaleTimeString(AR ? "ar" : "en", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
    catch (e) { t = new Date().toTimeString().slice(0, 8); }
    u.textContent = s("updated", { t: t });
  }
  function liveTick() {
    if (document.visibilityState === "hidden") return;
    var panel = document.getElementById("admPanel");
    if (panel && !panel.hidden) return;
    if (state.tab === "overview") loadOverview(true);
    else if (state.tab === "users") loadList(true);
    loadFbBadge();
  }
  // ---- sign-ups chart: HTML columns (labels stay readable at 375 px and RTL
  // just mirrors the flex row). "week" groups 7 days ending on the last day
  // of the series; "day" shows every day.
  function chartMode() {
    try { return localStorage.getItem("adm_chart_mode") === "day" ? "day" : "week"; } catch (e) { return "week"; }
  }
  function viewToggle(mode, redraw) {
    var box = el("div", { class: "adm-seg", role: "group", "aria-label": s("chartView") });
    [["week", "chartWeekly"], ["day", "chartDaily"]].forEach(function (o) {
      box.appendChild(el("button", {
        type: "button", "aria-pressed": o[0] === mode ? "true" : "false", text: s(o[1]),
        onclick: function () {
          try { localStorage.setItem("adm_chart_mode", o[0]); } catch (e) {}
          redraw(o[0]);
        }
      }));
    });
    return box;
  }
  function fmtShort(iso, monthOnly) {
    var a = String(iso).split("-"), d = new Date(Date.UTC(+a[0], +a[1] - 1, +a[2]));
    if (isNaN(d)) return iso;
    try { return d.toLocaleDateString(AR ? "ar" : "en", monthOnly ? { month: "short", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" }); }
    catch (e) { return iso; }
  }
  // buckets of 7 days, the last ending on the final day of the series
  function weekBuckets(series) {
    var out = [];
    for (var end = series.length; end > 0; end -= 7) {
      var start = Math.max(0, end - 7), c = 0;
      for (var i = start; i < end; i++) c += series[i].count;
      out.unshift({ from: series[start].date, to: series[end - 1].date, count: c });
    }
    return out;
  }
  // integer ticks 0..top, at most 4 intervals
  function niceTicks(max) {
    var step = 1;
    outer: for (var mag = 1; ; mag *= 10) {
      for (var k = 0; k < 3; k++) {
        step = [1, 2, 5][k] * mag;
        if (max / step <= 4) break outer;
      }
    }
    var top = Math.max(Math.ceil(max / step) * step, step * 2), ticks = [];
    for (var v = 0; v <= top; v += step) ticks.push(v);
    return ticks;
  }
  function chart(series, mode) {
    var weekly = mode === "week";
    var bars = weekly ? weekBuckets(series) : series.map(function (d) { return { from: d.date, to: d.date, count: d.count }; });
    var max = bars.reduce(function (m, b) { return Math.max(m, b.count); }, 0);
    var sum = series.reduce(function (a, d) { return a + d.count; }, 0);
    var peak = series.reduce(function (b, d) { return d.count > (b ? b.count : -1) ? d : b; }, null);
    var ticks = niceTicks(max), top = ticks[ticks.length - 1], n = bars.length;
    var wrap = el("div", { class: "adm-chart " + (weekly ? "is-week" : "is-day"), role: "img",
      "aria-label": s("chartAlt", { n: fmtNum(sum), d: peak ? peak.date : "—", m: peak ? fmtNum(peak.count) : 0 }) });
    var read = el("p", { class: "adm-read", "aria-hidden": "true" });
    var yax = el("div", { class: "adm-y" });
    var plot = el("div", { class: "adm-plot" });
    ticks.forEach(function (v) {
      var pos = (100 * v / top) + "%";
      var lab = el("span", { text: fmtNum(v) }); lab.style.bottom = pos; yax.appendChild(lab);
      var g = el("i", { class: "adm-gl" + (v === 0 ? " base" : "") }); g.style.bottom = pos; plot.appendChild(g);
    });
    var cols = el("div", { class: "adm-cols" });
    var xrow = el("div", { class: "adm-xrow" });
    var nonzero = bars.filter(function (b) { return b.count > 0; }).length;
    var peakBar = bars.reduce(function (b, d) { return d.count > (b ? b.count : -1) ? d : b; }, null);
    var firstMonth = -1, lastVal = -9;
    bars.forEach(function (b, i) {
      var range = b.from === b.to ? fmtShort(b.from) : fmtShort(b.from) + " – " + fmtShort(b.to);
      var tip = s("chartTip", { d: range, n: fmtNum(b.count) });
      var col = el("div", { class: "adm-col", title: tip, onclick: function () { read.textContent = tip; } });
      col.addEventListener("mouseenter", function () { read.textContent = tip; });
      var bar = el("i", { class: "bar" + (b.count ? "" : " zero") });
      if (b.count) bar.style.height = (100 * b.count / top) + "%";
      bar.style.setProperty("--i", i);
      col.appendChild(bar);
      if (b.count > 0 && (weekly || (nonzero <= 20 && i - lastVal >= 4) || b === peakBar)) {
        lastVal = i;
        var val = el("span", { class: "adm-val", text: fmtNum(b.count) });
        val.style.bottom = "calc(" + (100 * b.count / top) + "% + 3px)";
        col.appendChild(val);
      }
      cols.appendChild(col);
      var x = el("span", { class: "adm-xcell" });
      if (weekly) {
        x.appendChild(el("b", { class: "adm-x" + ((n - 1 - i) % 2 ? " alt" : "") + ((n - 1 - i) % 3 ? " alt3" : ""), text: fmtShort(b.from) }));
      } else if (b.from.slice(8) === "01" && n - i > 5) {
        x.appendChild(el("b", { class: "adm-x start", text: fmtShort(b.from, true) }));
        if (firstMonth < 0) firstMonth = i;
      }
      xrow.appendChild(x);
    });
    if (!weekly && firstMonth > 12) // first month start is far away: also label the opening day
      xrow.firstChild.appendChild(el("b", { class: "adm-x start", text: fmtShort(bars[0].from) }));
    plot.appendChild(cols);
    wrap.appendChild(el("div", { class: "adm-chart-body", "aria-hidden": "true" }, [yax, el("div", { class: "adm-chart-main" }, [plot, xrow])]));
    wrap.appendChild(read);
    return wrap;
  }

  // ---- users: shared helpers ----
  function errText(r) {
    switch (r.code) {
      case "cannot_modify_admin": return s("eCannotAdmin");
      case "no_password": return s("eNoPassword");
      case "confirm_mismatch": return s("eMismatch");
      case "assistant_delete_failed": return s("eAssistant");
      case "delete_unavailable": case "reset_unavailable": return s("eUnavailable");
      case "account_blocked": return s("eBlockedReset");
      case "not_found": return s("eNotFound");
      case "invalid_request": return r.message || s("eGeneric");
      default: return s("eGeneric");
    }
  }
  function provLabel(p) { return s(p === "google" ? "pGoogle" : p === "apple" ? "pApple" : p === "both" ? "pBoth" : "pPassword"); }
  var DEFAULT_AV = "icons/avatar-default.svg";
  function avatar(u, big) {
    var img = el("img", { class: "adm-av", alt: "", width: big ? 64 : 36, height: big ? 64 : 36, referrerpolicy: "no-referrer", loading: "lazy" });
    img.src = u.picture || DEFAULT_AV;
    img.addEventListener("error", function () { if (img.src.indexOf(DEFAULT_AV) < 0) img.src = DEFAULT_AV; });
    return img;
  }

  // ---- users: list view ----
  state.users = { q: "", sort: "created", page: 1 };
  var searchTimer = null;
  views.users = function () {
    var u = state.users;
    main.textContent = "";
    var input = el("input", { type: "search", placeholder: s("search"), "aria-label": s("search"), maxlength: "100", value: u.q });
    input.addEventListener("input", function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { u.q = input.value.trim(); u.page = 1; loadList(); }, 300);
    });
    var sel = el("select", { "aria-label": s("sortNew") }, [
      el("option", { value: "created", text: s("sortNew") }), el("option", { value: "lastSeen", text: s("sortSeen") })
    ]);
    sel.value = u.sort;
    sel.addEventListener("change", function () { u.sort = sel.value; u.page = 1; loadList(); });
    main.appendChild(el("div", { class: "adm-tools" }, [input, sel]));
    var host = el("div", { id: "admListHost" });
    main.appendChild(host);
    loadList();
  };
  var listSeq = 0;
  function loadList(quiet) {
    var u = state.users, seq = ++listSeq;
    var host = document.getElementById("admListHost");
    if (!host) return;
    var qs = "?page=" + u.page + "&pageSize=25&sort=" + encodeURIComponent(u.sort) + (u.q ? "&q=" + encodeURIComponent(u.q) : "");
    api("/users" + qs).then(function (r) {
      if (seq !== listSeq) return; // a newer search superseded this one
      if (authFailed(r)) return;
      if (quiet && !r.ok) return; // live refresh failed: keep the current list
      main.classList.toggle("adm-quiet", !!quiet);
      host.textContent = "";
      if (r.ok) stampUpdated();
      if (!r.ok) { host.appendChild(el("p", { class: "adm-err", role: "alert", text: s("loadErr") })); return; }
      var d = r.data;
      if (!d.users.length) { host.appendChild(el("p", { class: "adm-msg", text: s("none") })); return; }
      host.appendChild(el("div", { class: "adm-list" }, d.users.map(function (x, i) {
        var row = el("button", { type: "button", class: "adm-row", onclick: function () { openUser(x.id); } }, [
          avatar(x),
          el("span", null, [el("div", { class: "adm-email", text: x.email }), el("div", { class: "adm-sub", text: x.displayName || x.name || "" })]),
          el("span", { class: "adm-sub adm-col-hide", text: s("colJoined") + ": " + fmtDate(x.createdAt) }),
          el("span", { class: "adm-sub adm-col-hide", text: s("colSeen") + ": " + fmtDate(x.lastSeenAt) }),
          el("span", { class: "adm-sub adm-col-hide", text: provLabel(x.provider) }),
          x.blocked ? el("span", { class: "adm-badge blocked", text: s("blocked") }) : el("span")
        ]);
        row.style.setProperty("--i", Math.min(i, 12));
        return row;
      })));
      var pages = Math.max(1, Math.ceil(d.total / d.pageSize));
      host.appendChild(el("div", { class: "adm-pager" }, [
        el("button", { class: "adm-btn", text: s("prev"), disabled: u.page <= 1, onclick: function () { u.page--; loadList(); } }),
        el("span", { class: "adm-sub", text: s("pageOf", { p: u.page, n: pages, t: fmtNum(d.total) }) }),
        el("button", { class: "adm-btn", text: s("next"), disabled: u.page >= pages, onclick: function () { u.page++; loadList(); } })
      ]));
    });
  }

  // ---- users: detail panel + actions ----
  var panel, backdrop, lastFocus;
  function closePanel() {
    panel.hidden = true; backdrop.hidden = true; panel.textContent = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function openUser(id) {
    panel = document.getElementById("admPanel"); backdrop = document.getElementById("admPanelBackdrop");
    lastFocus = document.activeElement;
    panel.hidden = false; backdrop.hidden = false;
    backdrop.onclick = closePanel;
    panel.textContent = "";
    panel.appendChild(el("p", { class: "adm-msg", text: s("loading") }));
    api("/users/" + encodeURIComponent(id)).then(function (r) {
      if (authFailed(r)) { closePanel(); return; }
      if (!r.ok) { panel.textContent = ""; panel.appendChild(el("p", { class: "adm-err", text: errText(r) })); panel.appendChild(el("button", { class: "adm-btn", text: s("close"), onclick: closePanel })); return; }
      drawUser(r.data);
    });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel && !panel.hidden) closePanel(); });

  function drawUser(u) {
    panel.textContent = "";
    var status = el("p", { class: "adm-err", role: "status", "aria-live": "polite" });
    function done(r, okText) {
      if (authFailed(r)) { closePanel(); return false; }
      if (!r.ok) { status.className = "adm-err"; status.textContent = errText(r); return false; }
      status.className = "adm-ok"; status.textContent = okText || "";
      return true;
    }
    var img = avatar(u, true);
    if (u.hasPhoto) {
      api("/users/" + encodeURIComponent(u.id) + "/photo").then(function (r) {
        // data: URL, not blob: — CSP img-src doesn't allow blob: (same as header.js)
        if (r.ok && r.blob) r.blob.blob().then(function (b) {
          var fr = new FileReader();
          fr.onload = function () { img.src = fr.result; };
          fr.readAsDataURL(b);
        });
      });
    }
    var badges = el("div", null, [
      u.isAdmin ? el("span", { class: "adm-badge", text: s("admin") }) : null,
      u.blocked ? el("span", { class: "adm-badge blocked", text: s("blocked") }) : null,
      el("span", { class: "adm-badge", text: provLabel(u.provider) })
    ]);
    var kv = el("dl", { class: "adm-kv" });
    [["kvEmail", u.email], ["kvId", u.id], ["colJoined", fmtDate(u.createdAt)], ["colSeen", fmtDate(u.lastSeenAt)],
     ["kvVerified", s(u.emailVerified ? "yes" : "no")], ["kvStreak", fmtNum(u.currentStreak)], ["kvDays", fmtNum(u.totalDaysTrained)],
     ["kvWorkouts", fmtNum(u.workouts)], ["kvMeals", fmtNum(u.meals)], u.blocked ? ["kvBlockedAt", fmtDate(u.blockedAt)] : null
    ].forEach(function (p) { if (p) { kv.appendChild(el("dt", { text: s(p[0]) })); kv.appendChild(el("dd", { text: p[1] })); } });

    var fName = el("input", { type: "text", maxlength: "50", value: u.displayName || u.name || "" });
    var fW = el("input", { type: "number", min: "20", max: "400", step: "0.1", value: u.weightKg || "" });
    var fH = el("input", { type: "number", min: "50", max: "250", step: "0.1", value: u.heightCm || "" });
    var fV = el("input", { type: "checkbox" }); fV.checked = !!u.emailVerified;
    var form = el("form", { class: "adm-form" }, [
      el("h3", { text: s("editTitle") }),
      el("label", null, [s("fName"), fName]), el("label", null, [s("fWeight"), fW]), el("label", null, [s("fHeight"), fH]),
      u.provider !== "google" && !u.isAdmin ? el("label", null, [fV, " ", s("fVerified")]) : null,
      el("button", { class: "adm-btn primary", type: "submit", text: s("save") })
    ]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var body = {};
      if (fName.value.trim() !== (u.displayName || u.name || "")) body.displayName = fName.value.trim();
      if (fW.value !== "" && Number(fW.value) !== u.weightKg) body.weightKg = Number(fW.value);
      if (fH.value !== "" && Number(fH.value) !== u.heightCm) body.heightCm = Number(fH.value);
      if (fV.isConnected && fV.checked !== !!u.emailVerified) body.emailVerified = fV.checked;
      if (!Object.keys(body).length) { status.className = "adm-ok"; status.textContent = s("saved"); return; }
      api("/users/" + encodeURIComponent(u.id), { method: "PATCH", body: body }).then(function (r) {
        if (done(r, s("saved"))) { drawUser(r.data); loadList(); }
      });
    });

    var actions = el("div", { class: "adm-actions" });
    actions.appendChild(el("button", { type: "button", class: "adm-btn", "data-act": "workout-log", text: s("wlOpen"), onclick: function (e) { openWorkoutLog(u, e.currentTarget); } }));
    if (u.hasPassword) actions.appendChild(el("button", { class: "adm-btn", text: s("reset"), onclick: function () {
      api("/users/" + encodeURIComponent(u.id) + "/reset-password", { method: "POST", body: { lang: LANG } }).then(function (r) { done(r, s("resetSent")); });
    } }));
    if (!u.isAdmin) {
      actions.appendChild(el("button", { class: "adm-btn", text: s(u.blocked ? "unblock" : "block"), onclick: function () {
        if (!u.blocked && !window.confirm(s("blockConfirm", { e: u.email }))) return;
        api("/users/" + encodeURIComponent(u.id) + "/" + (u.blocked ? "unblock" : "block"), { method: "POST" }).then(function (r) {
          if (done(r)) { drawUser(r.data); loadList(); }
        });
      } }));
      actions.appendChild(el("button", { class: "adm-btn danger", text: s("del"), onclick: function () { deleteDialog(u, status); } }));
    }

    panel.appendChild(el("button", { class: "adm-btn", text: s("close"), onclick: closePanel, style: "float:inline-end" }));
    panel.appendChild(img);
    panel.appendChild(el("h2", { id: "admPanelTitle", text: u.displayName || u.name || u.email }));
    panel.appendChild(badges);
    panel.appendChild(kv);
    panel.appendChild(form);
    panel.appendChild(actions);
    panel.appendChild(status);
    panel.querySelector("button").focus();
  }

  function deleteDialog(u, status) {
    var input = el("input", { type: "email", autocomplete: "off", "aria-label": s("kvEmail") });
    var go = el("button", { class: "adm-btn danger", text: s("delGo"), disabled: true });
    var reason = el("textarea", { rows: "2", maxlength: "200", "aria-label": s("fReason"), placeholder: s("fReason") });
    var err = el("p", { class: "adm-err", role: "alert" });
    var box = el("div", { class: "adm-section", role: "alertdialog", "aria-labelledby": "admDelTitle" }, [
      el("h2", { id: "admDelTitle", text: s("delTitle") }),
      el("p", { text: s("delBody") }),
      el("p", null, [el("b", { text: u.email })]),
      input, reason, err,
      el("div", { class: "adm-actions" }, [go, el("button", { class: "adm-btn", text: s("cancel"), onclick: function () { box.remove(); } })])
    ]);
    input.addEventListener("input", function () {
      go.disabled = input.value.trim().toLowerCase() !== String(u.email || "").trim().toLowerCase();
    });
    go.addEventListener("click", function () {
      go.disabled = true;
      api("/users/" + encodeURIComponent(u.id), { method: "DELETE", body: { confirmEmail: input.value.trim(), reason: reason.value.trim() || undefined } }).then(function (r) {
        if (authFailed(r)) { closePanel(); return; }
        if (!r.ok) { err.textContent = errText(r); go.disabled = false; return; }
        closePanel();
        loadList();
        var note = el("p", { class: "adm-ok", role: "status", text: s("deleted") });
        main.insertBefore(note, main.firstChild);
        setTimeout(function () { note.remove(); }, 5000);
      });
    });
    panel.appendChild(box);
    input.focus();
  }

  // ---- removed users (tombstones) ----
  state.removed = { page: 1 };
  views.removed = function () {
    var p = state.removed, host = el("div");
    main.textContent = "";
    main.appendChild(host);
    function load() {
      api("/tombstones?page=" + p.page + "&pageSize=25").then(function (r) {
        if (authFailed(r)) return;
        host.textContent = "";
        if (!r.ok) {
          host.appendChild(el("p", { class: "adm-err", role: "alert", text: s("loadErr") }));
          host.appendChild(el("button", { class: "adm-btn", text: s("retry"), onclick: load }));
          return;
        }
        var ts = r.data.tombstones || [];
        if (!ts.length && p.page > 1) { p.page--; return load(); }
        if (!ts.length) { host.appendChild(el("p", { class: "adm-msg", text: s("rmNone") })); return; }
        host.appendChild(el("div", { class: "adm-list" }, ts.map(function (t) {
          var row = el("div", { class: "adm-row adm-tomb" });
          var btn = el("button", { type: "button", class: "adm-btn", text: s("reallow"), onclick: function () { reallowDialog(t, row, load); } });
          [el("span", null, [
            el("div", { class: "adm-email", text: t.email }),
            el("div", { class: "adm-sub", text: s("rmBy", { a: t.deletedBy || "—" }) + " · " + fmtDate(t.deletedAt) }),
            t.reason ? el("div", { class: "adm-sub", text: s("rmReason", { r: t.reason }) }) : null,
            t.expiresAt ? el("div", { class: "adm-sub", text: s("rmExpires", { d: fmtDate(t.expiresAt) }) }) : null
          ]), btn].forEach(function (c) { row.appendChild(c); });
          return row;
        })));
        // The API returns no total, so paging is prev/next on a full page.
        host.appendChild(el("div", { class: "adm-pager" }, [
          el("button", { class: "adm-btn", text: s("prev"), disabled: p.page <= 1, onclick: function () { p.page--; load(); } }),
          el("span", { class: "adm-sub", text: s("rmPageOf", { p: p.page }) }),
          el("button", { class: "adm-btn", text: s("next"), disabled: ts.length < 25, onclick: function () { p.page++; load(); } })
        ]));
      });
    }
    load();
  };
  function reallowDialog(t, row, reload) {
    if (row.nextSibling && row.nextSibling.className === "adm-section") return;
    var err = el("p", { class: "adm-err", role: "alert" });
    var go = el("button", { class: "adm-btn primary", text: s("reallow") });
    var box = el("div", { class: "adm-section", role: "alertdialog", "aria-labelledby": "admReTitle" }, [
      el("h2", { id: "admReTitle", text: s("reallowTitle") }),
      el("p", { text: s("reallowBody") }),
      el("p", null, [el("b", { text: t.email })]),
      err,
      el("div", { class: "adm-actions" }, [go, el("button", { class: "adm-btn", text: s("cancel"), onclick: function () { box.remove(); btn0.focus(); } })])
    ]);
    var btn0 = row.querySelector("button");
    go.addEventListener("click", function () {
      go.disabled = true;
      api("/tombstones", { method: "DELETE", body: { email: t.email } }).then(function (r) {
        if (authFailed(r)) return;
        // 404 means it is already cleared, which is the state we wanted.
        if (!r.ok && r.status !== 404) { err.textContent = errText(r); go.disabled = false; return; }
        box.remove();
        reload();
        var note = el("p", { class: "adm-ok", role: "status", text: s("reallowed", { e: t.email }) });
        note.tabIndex = -1;
        main.insertBefore(note, main.firstChild);
        note.focus();
        setTimeout(function () { note.remove(); }, 5000);
      });
    });
    row.parentNode.insertBefore(box, row.nextSibling);
    go.focus();
  }

  // ---- activity ----
  views.activity = function () {
    var page = 1, list = el("div", { class: "adm-audit" }), more = el("button", { class: "adm-btn", text: s("more") });
    var ACT = { block: "actBlock", unblock: "actUnblock", edit: "actEdit", reset_password: "actReset", delete: "actDelete", tombstone_clear: "actReallow", admin_delete_partial: "actDeletePartial" };
    function load() {
      more.disabled = true;
      api("/audit?page=" + page + "&pageSize=50").then(function (r) {
        if (authFailed(r)) return;
        if (!r.ok) { list.appendChild(el("p", { class: "adm-err", text: s("loadErr") })); more.disabled = false; return; }
        var es = r.data.entries || [];
        if (page === 1) { main.textContent = ""; main.appendChild(list); main.appendChild(more); }
        if (page === 1 && !es.length) { list.appendChild(el("p", { class: "adm-msg", text: s("noActivity") })); more.remove(); return; }
        es.forEach(function (e) {
          var when = new Date(e.at);
          var line = fmtDate(e.at) + " " + (isNaN(when) ? "" : when.toLocaleTimeString(AR ? "ar" : "en", { hour: "2-digit", minute: "2-digit" })) +
            " — " + e.adminEmail + " " + s(ACT[e.action] || "actEdit") + " " + (e.targetEmail || e.targetId);
          var fields = e.details ? Object.keys(e.details).join(", ") : "";
          list.appendChild(el("div", null, [line, fields ? el("div", { class: "adm-sub", text: fields }) : null]));
        });
        if (es.length < 50) more.remove(); else { page++; more.disabled = false; }
      });
    }
    more.addEventListener("click", load);
    load();
  };

  // ---- feedback ----
  // Every field here is user-controlled: textContent only, dir="auto" on free
  // text (bidi spoofing), white-space:pre-wrap in CSS, no href/src from data.
  addStrings({
    tabFeedback: ["Feedback", "الآراء"],
    fbAll: ["All", "الكل"],
    fbStatus: ["Status", "الحالة"],
    fbType: ["Type", "النوع"],
    fbNone: ["No feedback yet.", "لا توجد آراء بعد."],
    fbGuest: ["Guest", "زائر"],
    fbContext: ["Context", "السياق"],
    fbNote: ["Internal note (only admins see it)", "ملاحظة داخلية (للمسؤولين فقط)"],
    fbNoteSave: ["Save note", "حفظ الملاحظة"],
    fbNoteSaved: ["Note saved.", "تم حفظ الملاحظة."],
    fbStatusSaved: ["Status updated.", "تم تحديث الحالة."],
    fbPageOf: ["Page {p} of {n} · {t} items", "صفحة {p} من {n} · {t} عنصر"],
    st_new: ["New", "جديد"], st_in_progress: ["In progress", "قيد المعالجة"], st_done: ["Done", "تم"], st_wont_do: ["Won't do", "لن يُنفَّذ"],
    ty_bug: ["Problem", "مشكلة"], ty_idea: ["Idea", "فكرة"], ty_other: ["Other", "أخرى"],
    ctxPlatform: ["Platform", "المنصة"], ctxLang: ["Language", "اللغة"], ctxScreen: ["Screen", "الشاشة"],
    ctxVersion: ["App version", "إصدار التطبيق"], ctxUA: ["User agent", "المتصفح"]
  });
  var FB_STATUS = ["new", "in_progress", "done", "wont_do"];
  var FB_TYPES = ["bug", "idea", "other"];
  var FB_ICON = { bug: "🐞", idea: "💡", other: "💬" };
  state.feedback = { status: "", type: "", page: 1 };

  function fmtDateTime(iso) {
    var d = new Date(iso);
    if (!iso || isNaN(d)) return "—";
    try { return d.toLocaleString(AR ? "ar" : "en", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return iso; }
  }
  function setFbBadge(n) {
    var b = document.getElementById("fbBadge");
    if (!b) return;
    n = Math.max(0, Number(n) || 0);
    b.textContent = n > 99 ? "99+" : String(n);
    b.hidden = n === 0;
  }
  var fbNew = 0;
  function loadFbBadge() {
    return api("/feedback/count?status=new").then(function (r) {
      if (r.ok && r.data && typeof r.data.count === "number") { fbNew = r.data.count; setFbBadge(fbNew); }
    });
  }
  function bumpFbBadge(delta) { fbNew = Math.max(0, fbNew + delta); setFbBadge(fbNew); }

  views.feedback = function () {
    var f = state.feedback;
    main.textContent = "";
    function opt(list, prefix) {
      return [el("option", { value: "", text: s("fbAll") })].concat(list.map(function (v) { return el("option", { value: v, text: s(prefix + v) }); }));
    }
    var selStatus = el("select", { "aria-label": s("fbStatus") }, opt(FB_STATUS, "st_"));
    var selType = el("select", { "aria-label": s("fbType") }, opt(FB_TYPES, "ty_"));
    selStatus.value = f.status; selType.value = f.type;
    selStatus.addEventListener("change", function () { f.status = selStatus.value; f.page = 1; loadFeedback(); });
    selType.addEventListener("change", function () { f.type = selType.value; f.page = 1; loadFeedback(); });
    main.appendChild(el("div", { class: "adm-tools" }, [selStatus, selType]));
    main.appendChild(el("div", { id: "admFbHost" }));
    loadFeedback();
  };

  var fbSeq = 0;
  function loadFeedback() {
    var f = state.feedback, seq = ++fbSeq, host = document.getElementById("admFbHost");
    if (!host) return;
    var qs = "?page=" + f.page + "&pageSize=25" + (f.status ? "&status=" + encodeURIComponent(f.status) : "") + (f.type ? "&type=" + encodeURIComponent(f.type) : "");
    api("/feedback" + qs).then(function (r) {
      if (seq !== fbSeq || state.tab !== "feedback") return;
      if (authFailed(r)) return;
      host.textContent = "";
      if (!r.ok) {
        host.appendChild(el("p", { class: "adm-err", role: "alert", text: s("loadErr") }));
        host.appendChild(el("button", { class: "adm-btn", text: s("retry"), onclick: loadFeedback }));
        return;
      }
      var d = r.data;
      if (typeof d.newCount === "number") { fbNew = d.newCount; setFbBadge(fbNew); }
      var items = d.items || [];
      if (!items.length && f.page > 1) { f.page--; return loadFeedback(); }
      if (!items.length) { host.appendChild(el("p", { class: "adm-msg", text: s("fbNone") })); return; }
      host.appendChild(el("div", { class: "adm-list" }, items.map(function (it, i) {
        var card = feedbackCard(it);
        card.style.setProperty("--i", Math.min(i, 12));
        return card;
      })));
      var size = d.pageSize || 25, pages = Math.max(1, Math.ceil(d.total / size));
      host.appendChild(el("div", { class: "adm-pager" }, [
        el("button", { class: "adm-btn", text: s("prev"), disabled: f.page <= 1, onclick: function () { f.page--; loadFeedback(); } }),
        el("span", { class: "adm-sub", text: s("fbPageOf", { p: f.page, n: pages, t: fmtNum(d.total) }) }),
        el("button", { class: "adm-btn", text: s("next"), disabled: f.page >= pages, onclick: function () { f.page++; loadFeedback(); } })
      ]));
    });
  }

  function feedbackCard(it) {
    var type = FB_TYPES.indexOf(it.type) >= 0 ? it.type : "other";
    var status = FB_STATUS.indexOf(it.status) >= 0 ? it.status : "new";
    var saved = { status: status, note: it.adminNote || "" };
    var msgEl = el("p", { class: "adm-fb-msg", dir: "auto", text: it.message });
    var author;
    if (it.userId) author = (it.userName || "") + (it.userName && it.userEmail ? " " : "") + (it.userEmail ? "<" + it.userEmail + ">" : "");
    else author = s("fbGuest") + (it.email ? " " + it.email : "");
    var authorEl = el("bdi", { text: author || it.userId });
    var ico = el("span", { class: "adm-fb-ico", "aria-hidden": "true", text: FB_ICON[type] });
    var typeEl = el("span", { class: "adm-sub", text: s("ty_" + type) });
    var pill = el("span", { class: "adm-badge adm-st adm-st-" + status, text: s("st_" + status) });
    var head = el("div", { class: "adm-fb-head" }, [
      ico, typeEl, pill,
      el("span", { class: "adm-sub adm-fb-when", text: fmtDateTime(it.createdAt) }),
      el("span", { class: "adm-sub adm-fb-who" }, [authorEl])
    ]);

    var ctx = it.context && typeof it.context === "object" ? it.context : {};
    var kv = el("dl", { class: "adm-kv" });
    [["ctxPlatform", ctx.platform], ["ctxLang", ctx.lang], ["ctxScreen", ctx.screen], ["ctxVersion", ctx.appVersion], ["ctxUA", ctx.userAgent]].forEach(function (p) {
      if (p[1] == null || p[1] === "") return;
      kv.appendChild(el("dt", { text: s(p[0]) }));
      kv.appendChild(el("dd", { dir: "auto", text: String(p[1]) }));
    });
    var details = kv.childNodes.length ? el("details", { class: "adm-fb-ctx" }, [el("summary", { text: s("fbContext") }), kv]) : null;

    var msgState = el("p", { class: "adm-err", role: "status", "aria-live": "polite" });
    var sel = el("select", { "aria-label": s("fbStatus") }, FB_STATUS.map(function (v) { return el("option", { value: v, text: s("st_" + v) }); }));
    sel.value = status;
    var noteId = "fbNote" + it.id;
    var note = el("textarea", { id: noteId, rows: "2", maxlength: "2000", dir: "auto" });
    note.value = saved.note;
    var noteBtn = el("button", { type: "button", class: "adm-btn", text: s("fbNoteSave") });
    var noteLabel = el("label", { class: "adm-sub", for: noteId, text: s("fbNote") });

    function paintStatus(v) {
      pill.className = "adm-badge adm-st adm-st-" + v;
      pill.textContent = s("st_" + v);
    }
    sel.addEventListener("change", function () {
      var next = sel.value, prev = saved.status;
      if (next === prev) return;
      paintStatus(next);
      sel.disabled = true;
      bumpFbBadge((next === "new" ? 1 : 0) - (prev === "new" ? 1 : 0));
      msgState.textContent = "";
      api("/feedback/" + encodeURIComponent(it.id), { method: "PATCH", body: { status: next } }).then(function (r) {
        sel.disabled = false;
        if (authFailed(r)) return;
        if (!r.ok) {
          sel.value = prev; paintStatus(prev);
          bumpFbBadge((prev === "new" ? 1 : 0) - (next === "new" ? 1 : 0));
          msgState.className = "adm-err"; msgState.textContent = errText(r);
          return;
        }
        saved.status = next;
        msgState.className = "adm-ok"; msgState.textContent = s("fbStatusSaved");
        loadFbBadge();
      });
    });
    noteBtn.addEventListener("click", function () {
      var next = note.value.trim(), prev = saved.note;
      if (next === prev) { msgState.className = "adm-ok"; msgState.textContent = s("fbNoteSaved"); return; }
      noteBtn.disabled = true;
      msgState.textContent = "";
      api("/feedback/" + encodeURIComponent(it.id), { method: "PATCH", body: { adminNote: next } }).then(function (r) {
        noteBtn.disabled = false;
        if (authFailed(r)) return;
        if (!r.ok) {
          // Roll back to the last saved note; the failed text is not kept.
          note.value = prev;
          msgState.className = "adm-err"; msgState.textContent = errText(r);
          return;
        }
        saved.note = next; note.value = next;
        msgState.className = "adm-ok"; msgState.textContent = s("fbNoteSaved");
      });
    });

    return el("article", { class: "adm-section adm-fb" }, [
      head, msgEl, details,
      el("div", { class: "adm-fb-act" }, [sel]),
      noteLabel, note,
      el("div", { class: "adm-actions" }, [noteBtn]),
      msgState
    ]);
  }

  // ---- workout log (admin edits a user's completions / rest days) ----
  // Every server string here (dayId, addedBy, user name/email, error text) is
  // user- or admin-controlled: textContent only, dir="auto" on free text, no
  // href/src from data. admin.html doesn't load app.js, so the plan day ids
  // are listed here; tests/admin-workout-log.spec.js checks they still exist
  // in app.js.
  addStrings({
    wlOpen: ["Workout log", "سجل التمارين"],
    wlTitle: ["Workout log", "سجل التمارين"],
    wlClose: ["Close", "إغلاق"],
    wlPrev: ["Previous month", "الشهر السابق"],
    wlNext: ["Next month", "الشهر التالي"],
    wlStreak: ["Current streak", "السلسلة الحالية"],
    wlTotal: ["Days trained", "أيام التمرين"],
    wlRestLeft: ["Rest days left this week", "أيام الراحة المتبقية هذا الأسبوع"],
    wlLegend: ["Green: trained. Dashed: rest day. Outlined: today.", "أخضر: تمرين. متقطع: يوم راحة. بإطار: اليوم."],
    wlAdminMark: ["admin", "مسؤول"],
    wlLate: ["late", "متأخر"],
    wlStTrained: ["trained", "تمرين"],
    wlStRest: ["rest day", "يوم راحة"],
    wlStNone: ["nothing logged", "لا شيء مسجّل"],
    wlStToday: ["today", "اليوم"],
    wlStFuture: ["in the future", "في المستقبل"],
    wlListTitle: ["This month", "هذا الشهر"],
    wlListEmpty: ["Nothing logged this month. Pick a day above to add something.", "لا شيء مسجّل هذا الشهر. اختر يومًا أعلاه للإضافة."],
    wlRestRow: ["Rest day", "يوم راحة"],
    wlAddedBy: ["added by {a}", "أضافه {a}"],
    wlPick: ["Pick a day to see what's logged and change it.", "اختر يومًا لعرض ما سُجّل وتعديله."],
    wlFuture: ["This day hasn't happened yet, so nothing can be logged for it.", "لم يأتِ هذا اليوم بعد، لذلك لا يمكن تسجيل شيء له."],
    wlEntries: ["Logged on this day", "المسجّل في هذا اليوم"],
    wlReason: ["Reason (kept in the audit log)", "السبب (يُحفظ في سجل التدقيق)"],
    wlCount: ["{n} / 300", "{n} / 300"],
    wlReasonBad: ["Write a reason of 3 to 300 characters.", "اكتب سببًا من 3 إلى 300 حرف."],
    wlDayId: ["Workout day", "يوم التمرين"],
    wlOther: ["Other (type an id)…", "أخرى (اكتب معرّفًا)…"],
    wlOtherId: ["Day id", "معرّف اليوم"],
    wlIdBad: ["Use 1 to 64 letters, numbers, _ or -.", "استخدم من 1 إلى 64 حرفًا أو رقمًا أو _ أو -."],
    wlGrpCur: ["Men's plan", "خطة الرجال"],
    wlGrpLegacy: ["Men's plan (older)", "خطة الرجال (قديمة)"],
    wlGrpFem: ["Women's plan", "خطة النساء"],
    wlGrpCalM: ["Men's calisthenics", "كاليستنكس الرجال"],
    wlGrpCalF: ["Women's calisthenics", "كاليستنكس النساء"],
    wlMark: ["Mark complete", "تسجيل كمكتمل"],
    wlRemove: ["Remove completion", "إزالة الإكمال"],
    wlRemoveId: ["Remove {d}", "إزالة {d}"],
    wlAddRest: ["Add rest day", "إضافة يوم راحة"],
    wlRemoveRest: ["Remove rest day", "إزالة يوم الراحة"],
    wlConfirmRm: ["Remove {d} on {t}? The streak will be recalculated.", "إزالة {d} بتاريخ {t}؟ ستُعاد حساب السلسلة."],
    wlConfirmRest: ["Remove the rest day on {t}? The streak will be recalculated.", "إزالة يوم الراحة بتاريخ {t}؟ ستُعاد حساب السلسلة."],
    wlConfirmGo: ["Remove", "إزالة"],
    wlDoneMark: ["Marked complete.", "تم التسجيل كمكتمل."],
    wlDoneMarkExists: ["That day was already logged. Nothing changed.", "هذا اليوم مسجّل مسبقًا. لم يتغير شيء."],
    wlDoneRm: ["Completion removed.", "تمت إزالة الإكمال."],
    wlDoneRest: ["Rest day added.", "تمت إضافة يوم الراحة."],
    wlDoneRestExists: ["That day was already a rest day. Nothing changed.", "هذا اليوم يوم راحة مسبقًا. لم يتغير شيء."],
    wlDoneRestRm: ["Rest day removed.", "تمت إزالة يوم الراحة."],
    wlEFuture: ["That date is in the future.", "هذا التاريخ في المستقبل."],
    wlETrained: ["That day has a completed workout, so it can't be a rest day. Remove the completion first.", "في هذا اليوم تمرين مكتمل، فلا يمكن جعله يوم راحة. أزل الإكمال أولًا."],
    wlEGone: ["That entry no longer exists. The log was refreshed.", "هذا السجل لم يعد موجودًا. تم تحديث السجل."],
    wlEUser: ["User not found.", "المستخدم غير موجود."],
    wlLocked: ["Admins can't change their own log or another admin's.", "لا يمكن للمسؤولين تعديل سجلهم أو سجل مسؤول آخر."],
    wlELoad: ["Could not load this user's workout log.", "تعذر تحميل سجل تمارين هذا المستخدم."]
  });
  var WL_DAY_IDS = [
    ["wlGrpCur", ["m_upper", "m_lower", "m_backbi", "m_chesttri"]],
    ["wlGrpLegacy", ["m_upperA", "m_lowerA", "m_upperB", "m_lowerB"]],
    ["wlGrpFem", ["f_lowerA", "f_upperA", "f_lowerB", "f_upperB"]],
    ["wlGrpCalM", ["mc_push", "mc_legs", "mc_pull"]],
    ["wlGrpCalF", ["fc_push", "fc_legs", "fc_pull"]]
  ];
  var WL_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
  var WL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(y, m, d) { return y + "-" + p2(m + 1) + "-" + p2(d); }
  function localToday() { var d = new Date(); return ymd(d.getFullYear(), d.getMonth(), d.getDate()); }
  function dateLabel(key) {
    var a = key.split("-");
    try { return new Date(+a[0], +a[1] - 1, +a[2]).toLocaleDateString(AR ? "ar" : "en", { weekday: "short", year: "numeric", month: "short", day: "numeric" }); } catch (e) { return key; }
  }
  function monthLabel(y, m) {
    try { return new Date(y, m, 1).toLocaleDateString(AR ? "ar" : "en", { month: "long", year: "numeric" }); } catch (e) { return y + "-" + p2(m + 1); }
  }
  function wlErr(r, kind) {
    if (r.status === 404) return s(kind === "del" ? "wlEGone" : "wlEUser");
    switch (r.code) {
      case "date_in_future": return s("wlEFuture");
      case "already_trained": return s("wlETrained");
      case "cannot_modify_admin": return s("wlLocked");
      case "invalid_request": return r.message || s("eGeneric");
      default: return s("eGeneric");
    }
  }

  var wl; // the open workout-log dialog's state, or undefined
  function closeWorkoutLog() {
    if (!wl) return;
    var st = wl;
    wl = null;
    st.dlg.remove(); st.bd.remove();
    if (st.panelEl) st.panelEl.inert = false;
    if (st.opener && st.opener.isConnected && st.opener.focus) st.opener.focus();
  }
  function openWorkoutLog(u, opener) {
    if (wl) return;
    var t = localToday(), parts = t.split("-");
    var st = wl = { user: u, opener: opener, y: +parts[0], m: +parts[1] - 1, today: t, sel: null, data: null, seq: 0, panelEl: document.getElementById("admPanel") };
    var me = ((session() && session().profile && session().profile.email) || "").trim().toLowerCase();
    st.locked = !!u.isAdmin || (!!me && String(u.email || "").trim().toLowerCase() === me);
    st.panelEl.inert = true;
    var closeBtn = el("button", { type: "button", class: "adm-btn", text: s("wlClose"), onclick: closeWorkoutLog });
    var hasName = !!(u.displayName || u.name);
    var body = el("div", { class: "adm-log-body" });
    var dlg = el("div", { class: "adm-log", role: "dialog", "aria-modal": "true", "aria-labelledby": "admLogTitle", tabindex: "-1" }, [
      el("div", { class: "adm-log-head" }, [
        el("div", null, [
          el("h2", { id: "admLogTitle", text: s("wlTitle") }),
          el("p", { class: "adm-sub", dir: "auto", text: u.displayName || u.name || u.email || "" }),
          hasName ? el("p", { class: "adm-sub", dir: "auto", text: u.email || "" }) : null
        ]),
        closeBtn
      ]),
      body
    ]);
    var bd = el("div", { class: "adm-log-bd" });
    bd.addEventListener("click", closeWorkoutLog);
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); closeWorkoutLog(); return; }
      if (e.key !== "Tab") return;
      var f = Array.prototype.filter.call(dlg.querySelectorAll("button,input,select,textarea,[tabindex]"), function (n) {
        return !n.disabled && n.tabIndex >= 0 && n.offsetParent !== null;
      });
      if (!f.length) { e.preventDefault(); return; }
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dlg)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    st.dlg = dlg; st.bd = bd; st.body = body;
    document.body.appendChild(bd); document.body.appendChild(dlg);
    closeBtn.focus();
    loadWorkoutLog();
  }

  // note = {ok, text} to show after an action; refocus = move focus to the selected day afterwards.
  function loadWorkoutLog(note) {
    var st = wl, seq = ++st.seq;
    var last = new Date(st.y, st.m + 1, 0).getDate();
    var qs = "?from=" + ymd(st.y, st.m, 1) + "&to=" + ymd(st.y, st.m, last) + "&today=" + st.today;
    if (!st.data) { st.body.textContent = ""; st.body.appendChild(el("p", { class: "adm-msg", text: s("loading") })); }
    api("/users/" + encodeURIComponent(st.user.id) + "/workouts" + qs).then(function (r) {
      if (wl !== st || seq !== st.seq) return; // closed, or a newer month/refresh superseded this
      if (authFailed(r)) { closeWorkoutLog(); return; }
      if (!r.ok) {
        st.data = null;
        st.body.textContent = "";
        st.body.appendChild(el("p", { class: "adm-err", role: "alert", text: r.status === 404 ? s("wlEUser") : s("wlELoad") }));
        return;
      }
      var d = r.data || {};
      st.data = {
        records: (d.records || []).filter(function (x) { return x && WL_DATE_RE.test(x.date); }),
        restDays: (d.restDays || []).filter(function (x) { return x && WL_DATE_RE.test(x.date); }),
        streak: d.streak || {}
      };
      drawWorkoutLog(note);
    });
  }

  function drawWorkoutLog(note) {
    var st = wl, data = st.data, body = st.body;
    var hadFocus = body.contains(document.activeElement);
    body.textContent = "";
    var sk = data.streak;
    body.appendChild(el("dl", { class: "adm-log-sum" }, [["wlStreak", sk.currentStreak], ["wlTotal", sk.totalDaysTrained], ["wlRestLeft", sk.restDaysLeftThisWeek]].map(function (x) {
      return el("div", null, [el("dd", { text: fmtNum(x[1]) }), el("dt", { text: s(x[0]) })]);
    })));

    var byDate = {}, rest = {};
    data.records.forEach(function (x) { (byDate[x.date] = byDate[x.date] || []).push(x); });
    data.restDays.forEach(function (x) { rest[x.date] = x; });

    function shift(n) {
      st.m += n; if (st.m < 0) { st.m = 11; st.y--; } else if (st.m > 11) { st.m = 0; st.y++; }
      st.sel = null; st.data = null; st.navFocus = n < 0 ? "prev" : "next"; loadWorkoutLog();
    }
    body.appendChild(el("div", { class: "adm-log-nav" }, [
      el("button", { type: "button", class: "adm-btn", "data-nav": "prev", "aria-label": s("wlPrev"), text: AR ? "›" : "‹", onclick: function () { shift(-1); } }),
      el("h3", { id: "admLogMonth", class: "adm-log-month", "aria-live": "polite", text: monthLabel(st.y, st.m) }),
      el("button", { type: "button", class: "adm-btn", "data-nav": "next", "aria-label": s("wlNext"), text: AR ? "‹" : "›", onclick: function () { shift(1); } })
    ]));

    // Month grid: Monday first; roving tabindex, arrows move by day / week.
    var grid = el("div", { class: "adm-cal", role: "grid", "aria-labelledby": "admLogMonth" });
    var head = el("div", { class: "adm-cal-row", role: "row" });
    for (var i = 0; i < 7; i++) {
      var wd = "";
      try { wd = new Date(2024, 0, 1 + i).toLocaleDateString(AR ? "ar" : "en", { weekday: "short" }); } catch (e) {}
      head.appendChild(el("div", { class: "adm-cal-wd", role: "columnheader", text: wd }));
    }
    grid.appendChild(head);
    var monthKey = ymd(st.y, st.m, 1).slice(0, 7);
    var daysIn = new Date(st.y, st.m + 1, 0).getDate();
    var lead = (new Date(st.y, st.m, 1).getDay() + 6) % 7;
    var focusKey = st.sel || (st.today.slice(0, 7) === monthKey ? st.today : monthKey + "-01");
    var cells = [], row = null;
    function dayCell(day) {
      var key = ymd(st.y, st.m, day), recs = byDate[key] || [], isRest = !!rest[key], future = key > st.today;
      var adminMark = recs.some(function (x) { return x.source === "admin"; }) || (isRest && rest[key].source === "admin");
      var cls = "adm-cal-day" + (recs.length ? " is-done" : "") + (isRest && !recs.length ? " is-rest" : "") + (key === st.today ? " is-today" : "") + (future ? " is-future" : "") + (key === st.sel ? " is-sel" : "");
      var label = dateLabel(key) + ", " + (recs.length ? s("wlStTrained") : isRest ? s("wlStRest") : s("wlStNone")) +
        (key === st.today ? ", " + s("wlStToday") : "") + (future ? ", " + s("wlStFuture") : "") + (adminMark ? ", " + s("wlAdminMark") : "");
      var cell = el("div", { class: cls, role: "gridcell", tabindex: key === focusKey ? "0" : "-1", "data-date": key, "aria-label": label, "aria-selected": key === st.sel ? "true" : "false" }, [
        el("span", { class: "adm-cal-num", text: String(day) }),
        adminMark ? el("span", { class: "adm-cal-mark", text: s("wlAdminMark") }) : null
      ]);
      cell.addEventListener("click", function () { select(key); });
      cells.push(cell);
      return cell;
    }
    for (var c = 0; c < lead + daysIn; c++) {
      if (c % 7 === 0) { row = el("div", { class: "adm-cal-row", role: "row" }); grid.appendChild(row); }
      row.appendChild(c < lead ? el("div", { class: "adm-cal-pad", role: "gridcell", "aria-hidden": "true" }) : dayCell(c - lead + 1));
    }
    grid.addEventListener("keydown", function (e) {
      var cell = e.target.closest && e.target.closest("[data-date]");
      if (!cell) return;
      var idx = cells.indexOf(cell), step = 0, dir = AR ? -1 : 1;
      if (e.key === "ArrowRight") step = dir; else if (e.key === "ArrowLeft") step = -dir;
      else if (e.key === "ArrowDown") step = 7; else if (e.key === "ArrowUp") step = -7;
      else if (e.key === "Home") step = -idx; else if (e.key === "End") step = cells.length - 1 - idx;
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(cell.getAttribute("data-date")); return; }
      else return;
      e.preventDefault();
      var to = idx + step;
      if (to < 0 || to >= cells.length) return;
      cell.tabIndex = -1; cells[to].tabIndex = 0; cells[to].focus();
    });
    body.appendChild(grid);
    body.appendChild(el("p", { class: "adm-hint", text: s("wlLegend") }));

    // Day list for the month
    var items = [];
    data.records.forEach(function (x) { items.push({ date: x.date, rec: x }); });
    data.restDays.forEach(function (x) { items.push({ date: x.date, rest: x }); });
    items.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var list = el("ul", { class: "adm-log-list" });
    items.forEach(function (it) {
      var src = it.rec || it.rest;
      list.appendChild(el("li", null, [el("button", { type: "button", class: "adm-log-item", onclick: function () { select(it.date, true); } }, [
        el("span", { class: "adm-log-date", text: dateLabel(it.date) }),
        it.rec ? el("b", { dir: "auto", text: String(it.rec.dayId == null ? "" : it.rec.dayId) }) : el("b", { text: s("wlRestRow") }),
        src.source === "admin" ? el("span", { class: "adm-badge", text: s("wlAdminMark") }) : null,
        it.rec && it.rec.confirmedLate ? el("span", { class: "adm-badge", text: s("wlLate") }) : null,
        src.addedBy ? el("span", { class: "adm-sub", dir: "auto", text: s("wlAddedBy", { a: src.addedBy }) }) : null
      ])]));
    });
    body.appendChild(el("section", { class: "adm-section" }, [
      el("h3", { text: s("wlListTitle") }),
      items.length ? list : el("p", { class: "adm-sub", text: s("wlListEmpty") })
    ]));

    var pane = el("section", { class: "adm-section adm-log-pane", "aria-label": s("wlEntries") });
    body.appendChild(pane);

    function select(key, focusPane) {
      st.sel = key;
      cells.forEach(function (n) {
        var on = n.getAttribute("data-date") === key;
        n.classList.toggle("is-sel", on); n.setAttribute("aria-selected", on ? "true" : "false"); n.tabIndex = on ? 0 : -1;
      });
      drawPane(key, null);
      if (focusPane) { pane.tabIndex = -1; pane.focus(); }
    }

    function noteEl(n) { return n ? el("p", { class: n.ok ? "adm-ok" : "adm-err", role: n.ok ? "status" : "alert", text: n.text }) : null; }
    function drawPane(key, n) {
      pane.textContent = "";
      if (!key) { pane.appendChild(el("p", { class: "adm-sub", text: s("wlPick") })); pane.appendChild(noteEl(n)); return; }
      var recs = byDate[key] || [], restRow = rest[key], future = key > st.today;
      pane.appendChild(el("h3", { text: dateLabel(key) }));
      if (recs.length || restRow) {
        var ul = el("ul", { class: "adm-log-entries" });
        recs.forEach(function (x) {
          ul.appendChild(el("li", null, [el("b", { dir: "auto", text: String(x.dayId == null ? "" : x.dayId) }),
            x.source === "admin" ? el("span", { class: "adm-badge", text: s("wlAdminMark") }) : null,
            x.confirmedLate ? el("span", { class: "adm-badge", text: s("wlLate") }) : null,
            x.addedBy ? el("span", { class: "adm-sub", dir: "auto", text: s("wlAddedBy", { a: x.addedBy }) }) : null]));
        });
        if (restRow) ul.appendChild(el("li", null, [el("b", { text: s("wlRestRow") }),
          restRow.source === "admin" ? el("span", { class: "adm-badge", text: s("wlAdminMark") }) : null,
          restRow.addedBy ? el("span", { class: "adm-sub", dir: "auto", text: s("wlAddedBy", { a: restRow.addedBy }) }) : null]));
        pane.appendChild(ul);
      }
      if (future) { pane.appendChild(el("p", { class: "adm-sub", text: s("wlFuture") })); return; }
      if (st.locked) { pane.appendChild(el("p", { class: "adm-sub", "data-locked": "", text: s("wlLocked") })); return; }

      // One reason (with a live counter) covers whichever action is taken on this day.
      var reason = el("textarea", { id: "admLogReason", rows: "2", dir: "auto", "aria-describedby": "admLogCount admLogErr" });
      var count = el("span", { id: "admLogCount", class: "adm-sub", text: s("wlCount", { n: 0 }) });
      var err = el("p", { id: "admLogErr", class: "adm-err", role: "alert" });
      function reasonVal() { return reason.value.trim(); }
      reason.addEventListener("input", function () {
        var len = reasonVal().length;
        count.textContent = s("wlCount", { n: len });
        count.classList.toggle("adm-over", len > 300);
        if (err.textContent) err.textContent = "";
      });
      function reasonOk() {
        var len = reasonVal().length;
        if (len >= 3 && len <= 300) return true;
        err.textContent = s("wlReasonBad"); reason.focus(); return false;
      }
      pane.appendChild(el("div", { class: "adm-form" }, [
        el("label", { for: "admLogReason" }, [s("wlReason")]), reason,
        el("div", { class: "adm-log-count" }, [count]), err
      ]));

      var actions = el("div", { class: "adm-actions" });
      var confirmBox = el("div");
      function setBusy(b) { Array.prototype.forEach.call(pane.querySelectorAll("button"), function (x) { x.disabled = b; }); }
      function run(path, method, bodyObj, okKey, kind) {
        setBusy(true);
        api(path, { method: method, body: bodyObj }).then(function (r) {
          if (wl !== st) return;
          if (authFailed(r)) { closeWorkoutLog(); return; }
          if (r.ok) { loadWorkoutLog({ ok: true, text: s(r.status === 200 ? okKey + "Exists" : okKey), refocus: true }); return; }
          if (r.status === 404 && kind === "del") { loadWorkoutLog({ ok: false, text: wlErr(r, kind), refocus: true }); return; }
          setBusy(false);
          err.textContent = wlErr(r, kind);
        });
      }
      var base = "/users/" + encodeURIComponent(st.user.id);
      function confirmRemove(text, go) {
        if (!reasonOk()) return;
        confirmBox.textContent = "";
        var goBtn = el("button", { type: "button", class: "adm-btn danger", "data-act": "confirm", text: s("wlConfirmGo"), onclick: go });
        confirmBox.appendChild(el("div", { class: "adm-log-confirm", role: "alertdialog", "aria-label": text }, [
          el("p", { dir: "auto", text: text }),
          el("div", { class: "adm-actions" }, [goBtn, el("button", { type: "button", class: "adm-btn", text: s("cancel"), onclick: function () { confirmBox.textContent = ""; } })])
        ]));
        goBtn.focus();
      }

      if (!recs.length) {
        var sel = el("select", { id: "admLogDay" });
        WL_DAY_IDS.forEach(function (g) {
          sel.appendChild(el("optgroup", { label: s(g[0]) }, g[1].map(function (id) { return el("option", { value: id, text: id }); })));
        });
        sel.appendChild(el("option", { value: "", text: s("wlOther") }));
        var other = el("input", { id: "admLogOther", type: "text", maxlength: "64", dir: "ltr", autocomplete: "off" });
        var otherWrap = el("label", { for: "admLogOther", hidden: true }, [s("wlOtherId"), other]);
        sel.addEventListener("change", function () { otherWrap.hidden = sel.value !== ""; if (sel.value === "") other.focus(); });
        pane.appendChild(el("div", { class: "adm-form" }, [el("label", { for: "admLogDay" }, [s("wlDayId")]), sel, otherWrap]));
        actions.appendChild(el("button", { type: "button", class: "adm-btn primary", "data-act": "mark", text: s("wlMark"), onclick: function () {
          var id = sel.value || other.value.trim();
          if (!WL_ID_RE.test(id)) { err.textContent = s("wlIdBad"); (sel.value ? sel : other).focus(); return; }
          if (!reasonOk()) return;
          run(base + "/workouts", "POST", { date: key, dayId: id, reason: reasonVal() }, "wlDoneMark", "add");
        } }));
      }
      recs.forEach(function (x) {
        var id = String(x.dayId == null ? "" : x.dayId);
        actions.appendChild(el("button", { type: "button", class: "adm-btn danger", "data-act": "remove", text: recs.length > 1 ? s("wlRemoveId", { d: id }) : s("wlRemove"), onclick: function () {
          confirmRemove(s("wlConfirmRm", { d: id, t: dateLabel(key) }), function () {
            run(base + "/workouts/" + encodeURIComponent(key) + "/" + encodeURIComponent(id), "DELETE", { reason: reasonVal() }, "wlDoneRm", "del");
          });
        } }));
      });
      if (restRow) {
        actions.appendChild(el("button", { type: "button", class: "adm-btn danger", "data-act": "rest-remove", text: s("wlRemoveRest"), onclick: function () {
          confirmRemove(s("wlConfirmRest", { t: dateLabel(key) }), function () {
            run(base + "/rest-days/" + encodeURIComponent(key), "DELETE", { reason: reasonVal() }, "wlDoneRestRm", "del");
          });
        } }));
      } else {
        actions.appendChild(el("button", { type: "button", class: "adm-btn", "data-act": "rest-add", text: s("wlAddRest"), onclick: function () {
          if (!reasonOk()) return;
          run(base + "/rest-days", "POST", { date: key, reason: reasonVal() }, "wlDoneRest", "add");
        } }));
      }
      pane.appendChild(actions);
      pane.appendChild(confirmBox);
      pane.appendChild(noteEl(n));
    }

    if (st.sel && st.sel.slice(0, 7) === monthKey) drawPane(st.sel, note); else { st.sel = null; drawPane(null, note); }
    // Rebuilding the dialog drops focus; put it back on the selected day (or the month).
    var back = st.navFocus ? body.querySelector('[data-nav="' + st.navFocus + '"]') : (note && note.refocus) || hadFocus ? grid.querySelector('[tabindex="0"]') : null;
    st.navFocus = null;
    if (back) back.focus();
  }

  window.__admin = { api: api, s: s, addStrings: addStrings, el: el, fmtDate: fmtDate, fmtNum: fmtNum, authFailed: authFailed, showError: showError, views: views, wlDayIds: WL_DAY_IDS, render: render, state: state, AR: AR, API_BASE: API_BASE, session: session };

  function init() {
    document.documentElement.lang = LANG;
    document.documentElement.dir = AR ? "rtl" : "ltr";
    main = document.getElementById("admMain");
    document.getElementById("admTitle").textContent = s("title");
    var back = document.getElementById("admBack");
    back.textContent = "";
    var bi = el("span", { class: "adm-back-ico", "aria-hidden": "true" });
    bi.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
    back.appendChild(bi);
    back.appendChild(el("span", { text: s("back") }));
    back.setAttribute("aria-label", s("backAria"));
    document.getElementById("tabOverview").textContent = s("tabOverview");
    document.getElementById("tabUsers").textContent = s("tabUsers");
    document.getElementById("tabRemoved").textContent = s("tabRemoved");
    document.getElementById("tabActivity").textContent = s("tabActivity");
    document.getElementById("tabFeedback").insertBefore(document.createTextNode(s("tabFeedback")), document.getElementById("fbBadge"));
    document.title = "Etqadem — " + s("title");
    var sess = session();
    if (!sess) return showMsg("noSession", true);
    document.getElementById("admWho").textContent = (sess.profile && sess.profile.email) || "";
    document.getElementById("admTabs").hidden = false;
    document.getElementById("admTabs").addEventListener("click", function (e) {
      var t = e.target.closest("[data-tab]");
      if (t && t.getAttribute("data-tab") !== state.tab) setTab(t.getAttribute("data-tab"));
    });
    var h = (location.hash || "").slice(1);
    setTab(views[h] ? h : "overview");
    loadFbBadge();
    setInterval(liveTick, LIVE_MS);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") liveTick(); });
  }
  // Defer init until admin.js has registered every view (single file, so
  // DOMContentLoaded is enough: the whole script has run by then).
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else setTimeout(init, 0);
})();
