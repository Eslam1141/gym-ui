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
    back: ["← Back to app", "→ العودة إلى التطبيق"],
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
    chartTitle: ["Signups per day (last 90 days)", "التسجيلات يوميًا (آخر 90 يومًا)"],
    chartAlt: ["{n} signups in the last 90 days; busiest day {d} with {m}.", "{n} تسجيلًا في آخر 90 يومًا؛ أكثر يوم {d} بعدد {m}."],
    provTitle: ["Sign-in methods", "طرق تسجيل الدخول"],
    pGoogle: ["Google", "Google"],
    pPassword: ["Email & password", "البريد وكلمة المرور"],
    pBoth: ["Both", "كلاهما"],
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
    ["overview", "users", "removed", "activity"].forEach(function (t) {
      var b = document.querySelector('[data-tab="' + t + '"]');
      b.setAttribute("aria-selected", t === tab ? "true" : "false");
    });
    try { history.replaceState(null, "", "#" + tab); } catch (e) {}
    render(tab);
  }
  var views = {}; // tab -> function(main)
  function render(tab) {
    main.textContent = "";
    main.appendChild(el("p", { class: "adm-msg", text: s("loading") }));
    views[tab](main);
  }

  // ---- overview ----
  views.overview = function () {
    api("/stats").then(function (r) {
      if (authFailed(r)) return;
      if (!r.ok) return showError(function () { render("overview"); });
      var st = r.data;
      main.textContent = "";
      var cards = [
        ["cTotal", st.totalUsers], ["cToday", st.newUsers.today], ["c7", st.newUsers.d7], ["c30", st.newUsers.d30],
        ["cA7", st.activeUsers.d7], ["cA30", st.activeUsers.d30], ["cBlocked", st.blockedUsers]
      ];
      main.appendChild(el("div", { class: "adm-cards" }, cards.map(function (c, i) {
        var card = el("div", { class: "adm-card" }, [countUp(el("b"), c[1]), el("span", { text: s(c[0]) })]);
        card.style.setProperty("--i", i);
        return card;
      })));
      main.appendChild(el("section", { class: "adm-section" }, [el("h2", { text: s("chartTitle") }), chart(st.signupsPerDay || [])]));
      var p = st.providers, total = (p.google + p.password + p.both) || 1;
      main.appendChild(el("section", { class: "adm-section" }, [
        el("h2", { text: s("provTitle") }),
        el("div", { class: "adm-bars" }, [["pGoogle", p.google], ["pPassword", p.password], ["pBoth", p.both]].map(function (x) {
          var bar = el("i"); bar.style.width = Math.round(100 * x[1] / total) + "%";
          return el("div", null, [el("span", { text: s(x[0]) }), el("span", null, [bar]), el("span", { text: fmtNum(x[1]) })]);
        }))
      ]));
    });
  };
  function chart(series) {
    var W = 900, H = 180, pad = 22, n = series.length || 1;
    var max = series.reduce(function (m, d) { return Math.max(m, d.count); }, 0);
    var sum = series.reduce(function (a, d) { return a + d.count; }, 0);
    var peak = series.reduce(function (b, d) { return d.count > (b ? b.count : -1) ? d : b; }, null);
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("class", "adm-chart");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", s("chartAlt", { n: fmtNum(sum), d: peak ? peak.date : "—", m: peak ? peak.count : 0 }));
    if (AR) svg.setAttribute("transform", "scale(-1,1)"); // oldest on the right in RTL
    var bw = (W - pad * 2) / n;
    series.forEach(function (d, i) {
      var h = max ? Math.max(d.count ? 2 : 0, (H - pad * 2) * d.count / max) : 0;
      var r = document.createElementNS(NS, "rect");
      r.setAttribute("class", "bar");
      r.setAttribute("x", pad + i * bw + 1);
      r.setAttribute("y", H - pad - h);
      r.setAttribute("width", Math.max(1, bw - 2));
      r.setAttribute("height", h);
      r.style.setProperty("--i", i);
      var t = document.createElementNS(NS, "title");
      t.textContent = d.date + ": " + d.count;
      r.appendChild(t);
      svg.appendChild(r);
    });
    var lbl = document.createElementNS(NS, "text");
    lbl.setAttribute("x", pad); lbl.setAttribute("y", 14);
    lbl.textContent = "max " + max;
    if (!AR) svg.appendChild(lbl);
    return svg;
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
  function provLabel(p) { return s(p === "google" ? "pGoogle" : p === "both" ? "pBoth" : "pPassword"); }
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
  function loadList() {
    var u = state.users, seq = ++listSeq;
    var host = document.getElementById("admListHost");
    if (!host) return;
    var qs = "?page=" + u.page + "&pageSize=25&sort=" + encodeURIComponent(u.sort) + (u.q ? "&q=" + encodeURIComponent(u.q) : "");
    api("/users" + qs).then(function (r) {
      if (seq !== listSeq) return; // a newer search superseded this one
      if (authFailed(r)) return;
      host.textContent = "";
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

  window.__admin = { api: api, s: s, addStrings: addStrings, el: el, fmtDate: fmtDate, fmtNum: fmtNum, authFailed: authFailed, showError: showError, views: views, render: render, state: state, AR: AR, API_BASE: API_BASE, session: session };

  function init() {
    document.documentElement.lang = LANG;
    document.documentElement.dir = AR ? "rtl" : "ltr";
    main = document.getElementById("admMain");
    document.getElementById("admTitle").textContent = s("title");
    document.getElementById("admBack").textContent = s("back");
    document.getElementById("tabOverview").textContent = s("tabOverview");
    document.getElementById("tabUsers").textContent = s("tabUsers");
    document.getElementById("tabRemoved").textContent = s("tabRemoved");
    document.getElementById("tabActivity").textContent = s("tabActivity");
    document.title = "Etqadem — " + s("title");
    var sess = session();
    if (!sess) return showMsg("noSession", true);
    document.getElementById("admWho").textContent = (sess.profile && sess.profile.email) || "";
    document.getElementById("admTabs").hidden = false;
    document.getElementById("admTabs").addEventListener("click", function (e) {
      var t = e.target.closest("[data-tab]");
      if (t) setTab(t.getAttribute("data-tab"));
    });
    var h = (location.hash || "").slice(1);
    setTab(views[h] ? h : "overview");
  }
  // Defer init until admin.js has registered every view (single file, so
  // DOMContentLoaded is enough: the whole script has run by then).
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else setTimeout(init, 0);
})();
