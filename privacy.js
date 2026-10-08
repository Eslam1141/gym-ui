/* privacy.js — More -> "Privacy & data": data export and self-service
 * account deletion (Google Play account-deletion policy, Egypt PDPL).
 *
 * Talks to gym-be: GET /me/export?format=zip (ZIP attachment, fetched with the
 * bearer token and saved as a blob) and DELETE /me with {"confirm":"DELETE"}.
 * DELETE /me answers 401 `reauth_required` when the token is older than
 * 10 minutes. That is NOT a lost session: this file reads error.code itself
 * and never routes through sync.js's 401 handler (which signs out), it asks
 * for a fresh sign-in inside the sheet and lets the user retry.
 *
 * Own string table (like auth-email.js), language from <html lang>. */
(function () {
  "use strict";

  var API_BASE = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var TIMEOUT_MS = 20000;
  var EXPORT_TIMEOUT_MS = 90000;   // the server may spend ~60s building the ZIP
  // Device prefs that survive a deletion (everything else is wiped).
  var KEEP_KEYS = { gym_lang: 1, gym_theme: 1 };

  var STR = {
    label: ["Privacy & data", "الخصوصية والبيانات"],
    dlTitle: ["Download my data", "تنزيل بياناتي"],
    dlDesc: ["A ZIP file with your profile, workouts, meals, progress, notifications and coach data.", "ملف ZIP يضم ملفك الشخصي وتمارينك ووجباتك وتقدمك وإشعاراتك وبيانات المدرب."],
    dlBtn: ["Download my data", "تنزيل بياناتي"],
    dlBusy: ["Preparing your file… this can take up to a minute.", "جارٍ تجهيز الملف… قد يستغرق الأمر حتى دقيقة."],
    dlOk: ["Your data was downloaded.", "تم تنزيل بياناتك."],
    dlErr502: ["We couldn't collect your coach data, so the export was stopped instead of giving you an incomplete file. Try again in a minute.", "تعذّر جمع بيانات المدرب، فتم إيقاف التصدير بدل تسليمك ملفًا ناقصًا. حاول مرة أخرى بعد دقيقة."],
    dlWarnAssistant: ["Your file was saved, but your AI coach data couldn't be included. Try again later to get it.", "تم حفظ الملف، لكن تعذّر تضمين بيانات المدرب الذكي. حاول مرة أخرى لاحقًا للحصول عليها."],
    dlWarnTruncated: ["Your file was saved. Your AI coach history was very large, so only the newest part is included and older items were left out. Check totalCount in the file.", "تم حفظ الملف. سجل المدرب الذكي كبير جدًا، لذلك يتضمن الملف الأحدث فقط وتم استبعاد العناصر الأقدم. راجع totalCount في الملف."],
    dlErrRate: ["You've reached the export limit. Try again in {t}.", "وصلت إلى حد التصدير. حاول مرة أخرى بعد {t}."],
    dlErrRateNoWait: ["You've reached the export limit. Try again in a few minutes.", "وصلت إلى حد التصدير. حاول مرة أخرى بعد بضع دقائق."],
    dlErrBusy: ["An export is already running. Try again in {t}.", "هناك عملية تصدير قيد التنفيذ بالفعل. حاول مرة أخرى بعد {t}."],
    dlErrBusyNoWait: ["An export is already running. Try again shortly.", "هناك عملية تصدير قيد التنفيذ بالفعل. حاول مرة أخرى بعد قليل."],
    dlErrCut: ["The download was interrupted, so no file was saved. Try again.", "انقطع التنزيل ولم يُحفظ أي ملف. حاول مرة أخرى."],
    tMin1: ["1 minute", "دقيقة"], tMin2: ["2 minutes", "دقيقتين"], tMinFew: ["{n} minutes", "{n} دقائق"], tMinMany: ["{n} minutes", "{n} دقيقة"],
    tSec1: ["1 second", "ثانية"], tSec2: ["2 seconds", "ثانيتين"], tSecFew: ["{n} seconds", "{n} ثوانٍ"], tSecMany: ["{n} seconds", "{n} ثانية"],
    dlErr503: ["Export isn't available right now. Try again later.", "التصدير غير متاح الآن. حاول لاحقًا."],
    errNet: ["No connection. Check your internet and try again.", "لا يوجد اتصال. تحقق من الإنترنت وحاول مرة أخرى."],
    errSession: ["Your session has expired. Sign in again, then retry.", "انتهت جلسة تسجيل الدخول. سجّل الدخول مرة أخرى ثم أعد المحاولة."],
    errGeneric: ["Something went wrong. Try again.", "حدث خطأ ما. حاول مرة أخرى."],
    delTitle: ["Delete my account", "حذف حسابي"],
    delDesc: ["Permanently remove your account and everything in it.", "احذف حسابك وكل ما فيه نهائيًا."],
    delBtn: ["Delete my account", "حذف حسابي"],
    shTitle: ["Delete your account?", "حذف حسابك؟"],
    shLead: ["This permanently deletes your Etqadem account and everything in it. It can't be undone.", "سيحذف هذا حسابك في إتقدم وكل ما فيه نهائيًا، ولا يمكن التراجع عنه."],
    shListLabel: ["What gets deleted", "ما الذي سيُحذف"],
    shI1: ["Workouts and rest days", "التمارين وأيام الراحة"],
    shI2: ["Meals", "الوجبات"],
    shI3: ["Progress and body stats", "التقدم وقياسات الجسم"],
    shI4: ["Coach plans and check-ins", "خطط المدرب والمتابعات"],
    shI5: ["Profile photo", "صورة الملف الشخصي"],
    shI6: ["Notifications", "الإشعارات"],
    shRetain: ["A short deletion record is kept for 30 days and an admin log for 1 year, so an old device can't bring the account back.", "نحتفظ بسجل حذف مختصر لمدة 30 يومًا وبسجل إداري لمدة سنة، حتى لا يعيد جهاز قديم الحساب."],
    shMore: ["Details", "التفاصيل"],
    shDlFirst: ["Download my data first", "نزّل بياناتي أولًا"],
    shInputL: ["Type DELETE to confirm", "اكتب DELETE للتأكيد"],
    shInputH: ["Capital letters, exactly as shown. In Arabic you can also type: حذف", "بأحرف إنجليزية كبيرة كما هي. يمكنك أيضًا كتابة: حذف"],
    cancel: ["Cancel", "إلغاء"],
    deleting: ["Deleting…", "جارٍ الحذف…"],
    delErr400: ["The confirmation wasn't accepted. Type DELETE and try again.", "لم يتم قبول التأكيد. اكتب DELETE وحاول مرة أخرى."],
    delErr502: ["We couldn't delete your coach data, so nothing was deleted. It's safe to try again.", "تعذّر حذف بيانات المدرب، لذلك لم يُحذف شيء. يمكنك المحاولة مرة أخرى بأمان."],
    delErr503: ["Deleting isn't available right now and nothing was deleted. Try again later.", "الحذف غير متاح الآن ولم يُحذف شيء. حاول لاحقًا."],
    delErrNet: ["No connection, so nothing was deleted. Check your internet and try again.", "لا يوجد اتصال، لذلك لم يُحذف شيء. تحقق من الإنترنت وحاول مرة أخرى."],
    raTitle: ["Sign in again to continue", "سجّل الدخول مرة أخرى للمتابعة"],
    raLead: ["For your security, confirm it's you before we delete the account. Nothing has been deleted yet.", "لحمايتك، أكّد أنك أنت قبل حذف الحساب. لم يُحذف شيء حتى الآن."],
    raGoogleOff: ["Google sign-in isn't available right now. Check your connection and try again.", "تسجيل الدخول بـ Google غير متاح الآن. تحقق من الاتصال وحاول مرة أخرى."],
    raEmail: ["Email", "البريد الإلكتروني"],
    raPassword: ["Password", "كلمة المرور"],
    raSubmit: ["Confirm and continue", "تأكيد ومتابعة"],
    raBusy: ["Checking…", "جارٍ التحقق…"],
    raBad: ["Wrong email or password.", "البريد الإلكتروني أو كلمة المرور غير صحيحة."],
    raDone: ["You're signed in again. Press Delete my account to finish.", "تم تسجيل دخولك مرة أخرى. اضغط حذف حسابي للإنهاء."],
    doneTitle: ["Your account was deleted", "تم حذف حسابك"],
    doneBody: ["Your data was removed from Etqadem and from this device. You're welcome to create a new account any time.", "تمت إزالة بياناتك من إتقدم ومن هذا الجهاز. يمكنك إنشاء حساب جديد في أي وقت."],
    doneBtn: ["Continue", "متابعة"]
  };

  function isAr() { return (document.documentElement.getAttribute("lang") || "").toLowerCase().indexOf("ar") === 0; }
  function tr(k) { var e = STR[k]; return e ? e[isAr() ? 1 : 0] : k; }
  function el(id) { return document.getElementById(id); }

  function signedIn() { return !!(window.GymSync && GymSync.isSignedIn && GymSync.isSignedIn()); }

  // ---------------- API ----------------
  // Resolves {status, res, code}; status 0 = network failure / timeout.
  function call(path, opts) {
    var token = window.GymSync && GymSync.token ? GymSync.token() : null;
    if (!token) return Promise.resolve({ status: 401, code: "unauthorized", res: null });
    var ctrl = new AbortController();
    opts = opts || {};
    var timer = setTimeout(function () { ctrl.abort(); }, opts.timeoutMs || TIMEOUT_MS);
    delete opts.timeoutMs;
    opts.headers = opts.headers || {};
    opts.headers["Authorization"] = "Bearer " + token;
    opts.signal = ctrl.signal;
    return fetch(API_BASE + path, opts)
      .then(function (res) {
        if (res.ok) return { status: res.status, code: "", res: res };
        return res.json().catch(function () { return null; }).then(function (b) {
          var e = b && b.error;
          return { status: res.status, code: (e && (e.code || e)) || "", res: res };
        });
      })
      .catch(function () { return { status: 0, code: "", res: null }; })
      .then(function (r) { clearTimeout(timer); return r; });
  }

  // ---------------- export ----------------
  function todayName() { return "etqadem-export-" + new Date().toISOString().slice(0, 10) + ".zip"; }

  function filenameFrom(res) {
    var cd = res.headers.get("Content-Disposition") || "";
    var m = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd) || /filename\s*=\s*"?([^";]+)"?/i.exec(cd);
    var name = "";
    if (m) { try { name = decodeURIComponent(m[1]); } catch (e) { name = m[1]; } }
    // Never let a header pick a path or a non-zip extension.
    name = name.replace(/^.*[\\/]/, "").trim();
    return /\.zip$/i.test(name) && name.length > 4 ? name : todayName();
  }

  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // Whole seconds from a Retry-After header (delta-seconds form), or 0.
  function retryAfterSec(res) {
    var v = res && res.headers ? parseInt(res.headers.get("Retry-After"), 10) : NaN;
    return v > 0 ? v : 0;
  }

  // prefix tMin / tSec; Arabic has dual (2) and few (3-10) forms, English reads 2+ as plural.
  function plural(prefix, n) {
    var k = n === 1 ? "1" : n === 2 ? "2" : (n >= 3 && n <= 10 ? "Few" : "Many");
    return tr(prefix + k).replace("{n}", n);
  }

  // Minutes rounded up; waits of a minute or less read in seconds when allowed.
  function waitText(sec, allowSeconds) {
    if (allowSeconds && sec <= 60) return plural("tSec", sec);
    return plural("tMin", Math.ceil(sec / 60));
  }

  // 429 messages carry a number, so they are built here rather than from one key.
  function rateLimitMsg(r) {
    var sec = retryAfterSec(r.res);
    if (r.code === "export_busy") return sec ? tr("dlErrBusy").replace("{t}", waitText(sec, true)) : tr("dlErrBusyNoWait");
    return sec ? tr("dlErrRate").replace("{t}", waitText(sec, false)) : tr("dlErrRateNoWait");
  }

  function exportErrorKey(r) {
    if (r.status === 0) return "errNet";
    if (r.status === 401) return "errSession";
    if (r.status === 502) return "dlErr502";
    if (r.status === 503) return "dlErr503";
    return "errGeneric";
  }

  // Fetches and saves the ZIP. Resolves {status, res, code, warn, interrupted}.
  function fetchExport() {
    return call("/me/export?format=zip", { timeoutMs: EXPORT_TIMEOUT_MS }).then(function (r) {
      if (r.status !== 200 || !r.res) return r;
      var res = r.res;
      return res.blob().then(function (blob) {
        saveBlob(blob, filenameFrom(res));
        r.warn = res.headers.get("X-Export-Assistant-Unavailable") === "1" ? "dlWarnAssistant"
          : res.headers.get("X-Export-Truncated") === "1" ? "dlWarnTruncated" : "";
        return r;
      }, function () { return { status: 0, interrupted: true }; });
    });
  }

  var exporting = false;
  // setStatus(kind, key, text?): where to report; used by the section and the sheet.
  function doExport(btns, setStatus) {
    if (exporting) return;
    exporting = true;
    btns.forEach(function (b) { b.disabled = true; b.setAttribute("aria-busy", "true"); b.classList.add("is-busy"); });
    setStatus("busy", "dlBusy");
    fetchExport().catch(function () { return { status: 0 }; }).then(function (r) {
      exporting = false;
      btns.forEach(function (b) { b.disabled = false; b.removeAttribute("aria-busy"); b.classList.remove("is-busy"); });
      if (r.status === 200) {
        if (r.warn) return setStatus("warn", r.warn);
        setStatus("ok", "dlOk");
        if (window.GymToast) GymToast.show({ message: tr("dlOk") });
      } else if (r.interrupted) {
        setStatus("err", "dlErrCut");
      } else if (r.status === 429) {
        setStatus("err", "errGeneric", rateLimitMsg(r));
      } else {
        setStatus("err", exportErrorKey(r));
      }
    });
  }

  // ---------------- wipe ----------------
  function wipeLocal() {
    try {
      var rm = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && !KEEP_KEYS[k]) rm.push(k);
      }
      rm.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    try {
      if (window.indexedDB && indexedDB.databases) {
        indexedDB.databases().then(function (list) {
          list.forEach(function (d) { if (d && d.name) indexedDB.deleteDatabase(d.name); });
        }).catch(function () {});
      }
    } catch (e) {}
    // The service worker never caches /api/ responses (see service-worker.js),
    // so its caches hold only the public app shell: nothing user-specific to drop.
  }

  function accountGone() {
    if (window.GymSync && GymSync.signOut) GymSync.signOut();
    wipeLocal();
    showDone();
  }

  // ---------------- section (More tab) ----------------
  var section = null;

  function buildSection() {
    var host = el("morePrivacy");
    if (!host || section) return;
    host.innerHTML =
      '<div class="more-label" data-pk="label"></div>' +
      '<div class="pv-card">' +
        '<div class="pv-row">' +
          '<div class="pv-text"><div class="pv-title" data-pk="dlTitle"></div><p class="pv-desc" data-pk="dlDesc"></p></div>' +
          '<button type="button" class="pv-btn" id="pvDownload"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a1 1 0 0 1 1 1v9.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.4L11 13.6V4a1 1 0 0 1 1-1zM5 19a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z"/></svg><span data-pk="dlBtn"></span></button>' +
          '<p class="pv-status" id="pvStatus" role="status" aria-live="polite"></p>' +
        '</div>' +
        '<div class="pv-row pv-row-danger">' +
          '<div class="pv-text"><div class="pv-title" data-pk="delTitle"></div><p class="pv-desc" data-pk="delDesc"></p></div>' +
          '<button type="button" class="pv-btn pv-btn-danger" id="pvDelete"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zM6 9h12l-1 11a2 2 0 0 1-2 1.8H9A2 2 0 0 1 7 20L6 9z"/></svg><span data-pk="delBtn"></span></button>' +
        '</div>' +
      '</div>';
    section = host;
    el("pvDownload").addEventListener("click", function () {
      doExport([el("pvDownload")], function (kind, key, text) { setStatus(el("pvStatus"), kind, key, text); });
    });
    el("pvDelete").addEventListener("click", openSheet);
    paint();
  }

  // text: an already-built message (waits with a number); it carries no
  // data-pk, so a language switch leaves it as is.
  function setStatus(node, kind, key, text) {
    if (!node) return;
    node.className = node.className.replace(/\s*is-(busy|ok|warn|err)/g, "") + " is-" + kind;
    if (text) { delete node.dataset.pk; node.textContent = text; return; }
    node.dataset.pk = key;
    node.textContent = tr(key);
  }

  function paintNode(root) {
    var nodes = root.querySelectorAll("[data-pk]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = tr(nodes[i].dataset.pk);
  }

  function paint() {
    if (section) { section.hidden = !signedIn(); paintNode(section); }
    if (sheet) paintNode(sheet);
    if (doneEl) paintNode(doneEl);
  }

  // ---------------- delete sheet ----------------
  var sheet = null;
  var view = "confirm";   // confirm | reauth
  var deleting = false;

  function matches(v) {
    v = (v || "").trim();
    return v === "DELETE" || v === "حذف";
  }

  function buildSheet() {
    if (sheet) return;
    sheet = document.createElement("dialog");
    sheet.className = "pv-sheet";
    sheet.setAttribute("aria-labelledby", "pvShTitle");
    sheet.innerHTML =
      '<div class="pv-sheet-grip" aria-hidden="true"></div>' +
      '<div id="pvConfirm">' +
        '<h2 id="pvShTitle" class="pv-sh-title" data-pk="shTitle"></h2>' +
        '<p class="pv-sh-lead" data-pk="shLead"></p>' +
        '<div class="pv-ledger" role="group" aria-labelledby="pvLedgerL">' +
          '<div class="pv-ledger-l" id="pvLedgerL" data-pk="shListLabel"></div>' +
          '<ul>' +
            '<li data-pk="shI1"></li><li data-pk="shI2"></li><li data-pk="shI3"></li>' +
            '<li data-pk="shI4"></li><li data-pk="shI5"></li><li data-pk="shI6"></li>' +
          '</ul>' +
        '</div>' +
        '<p class="pv-retain"><span data-pk="shRetain"></span> <a href="/delete-account" target="_blank" rel="noopener" data-pk="shMore"></a></p>' +
        '<button type="button" class="pv-link" id="pvShDl" data-pk="shDlFirst"></button>' +
        '<p class="pv-status" id="pvShStatus" role="status" aria-live="polite"></p>' +
        '<label class="pv-field" for="pvInput"><span data-pk="shInputL"></span>' +
          '<input id="pvInput" type="text" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" dir="ltr" aria-describedby="pvInputH">' +
        '</label>' +
        '<p class="pv-hint" id="pvInputH" data-pk="shInputH"></p>' +
        '<p class="pv-err" id="pvErr" role="alert"></p>' +
        '<div class="pv-actions">' +
          '<button type="button" class="pv-btn" id="pvCancel" data-pk="cancel"></button>' +
          '<button type="button" class="pv-btn pv-btn-fill" id="pvGo" disabled><span data-pk="delBtn"></span></button>' +
        '</div>' +
      '</div>' +
      '<div id="pvReauth" hidden>' +
        '<h2 class="pv-sh-title" data-pk="raTitle"></h2>' +
        '<p class="pv-sh-lead" data-pk="raLead"></p>' +
        '<div id="pvRaGoogle" hidden><div id="pvRaGBtn" class="pv-gbtn"></div><p class="pv-err" id="pvRaGErr"></p></div>' +
        '<form id="pvRaForm" class="pv-ra-form" hidden novalidate>' +
          '<label class="pv-field" for="pvRaEmail"><span data-pk="raEmail"></span><input id="pvRaEmail" type="email" readonly dir="ltr"></label>' +
          '<label class="pv-field" for="pvRaPw"><span data-pk="raPassword"></span><input id="pvRaPw" type="password" autocomplete="current-password" dir="ltr"></label>' +
          '<p class="pv-err" id="pvRaErr" role="alert"></p>' +
          '<button type="submit" class="pv-btn pv-btn-fill" id="pvRaGo" data-pk="raSubmit"></button>' +
        '</form>' +
        '<div class="pv-actions"><button type="button" class="pv-btn" id="pvRaCancel" data-pk="cancel"></button></div>' +
      '</div>';
    document.body.appendChild(sheet);

    var input = el("pvInput");
    input.addEventListener("input", function () {
      el("pvGo").disabled = deleting || !matches(input.value);
      el("pvErr").textContent = "";
    });
    el("pvCancel").addEventListener("click", closeSheet);
    el("pvRaCancel").addEventListener("click", closeSheet);
    el("pvGo").addEventListener("click", runDelete);
    el("pvShDl").addEventListener("click", function () {
      doExport([el("pvShDl")], function (kind, key, text) { setStatus(el("pvShStatus"), kind, key, text); });
    });
    el("pvRaForm").addEventListener("submit", reauthLocal);
    sheet.addEventListener("cancel", function (e) { if (deleting) e.preventDefault(); });
    sheet.addEventListener("click", function (e) { if (e.target === sheet && !deleting) closeSheet(); });
    paintNode(sheet);
  }

  function showView(v) {
    view = v;
    el("pvConfirm").hidden = v !== "confirm";
    el("pvReauth").hidden = v !== "reauth";
    var t = sheet.querySelector(v === "confirm" ? "#pvShTitle" : "#pvReauth .pv-sh-title");
    if (t) { t.tabIndex = -1; t.focus(); }
  }

  function openSheet() {
    buildSheet();
    el("pvInput").value = "";
    el("pvGo").disabled = true;
    el("pvErr").textContent = "";
    el("pvShStatus").textContent = ""; el("pvShStatus").className = "pv-status";
    showView("confirm");
    if (!sheet.open) sheet.showModal();
    el("pvInput").focus();
  }

  function closeSheet() {
    if (deleting) return;
    if (sheet && sheet.open) sheet.close();
  }

  function setDeleting(on) {
    deleting = on;
    var go = el("pvGo");
    go.setAttribute("aria-busy", on ? "true" : "false");
    go.classList.toggle("is-busy", on);
    go.firstChild.dataset.pk = on ? "deleting" : "delBtn";
    go.firstChild.textContent = tr(on ? "deleting" : "delBtn");
    go.disabled = on || !matches(el("pvInput").value);
    el("pvCancel").disabled = on;
    el("pvInput").readOnly = on;
  }

  function showErr(key) {
    var e = el("pvErr");
    e.dataset.pk = key; e.textContent = tr(key);
  }

  function runDelete() {
    if (deleting || !matches(el("pvInput").value)) return;
    el("pvErr").textContent = "";
    setDeleting(true);
    // Body is always the English literal, whatever the user typed.
    call("/me", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" })
    }).then(function (r) {
      setDeleting(false);
      // 403 account_removed / 404 not_found: an earlier tap (or another tab)
      // already deleted the account, so treat it as done and wipe.
      if (r.status === 204 || r.status === 404 || (r.status === 403 && r.code === "account_removed")) {
        if (sheet.open) sheet.close();
        accountGone();
        return;
      }
      // reauth_required must be checked before any generic 401 handling.
      if (r.status === 401 && r.code === "reauth_required") { startReauth(); return; }
      if (r.status === 0) return showErr("delErrNet");
      if (r.status === 400) return showErr("delErr400");
      if (r.status === 401) return showErr("errSession");
      if (r.status === 502) return showErr("delErr502");
      if (r.status === 503) return showErr("delErr503");
      showErr("errGeneric");
    });
  }

  // ---------------- re-authentication ----------------
  function startReauth() {
    showView("reauth");
    var method = window.GymSync && GymSync.authMethod ? GymSync.authMethod() : null;
    var g = el("pvRaGoogle"), f = el("pvRaForm");
    g.hidden = method === "local";
    f.hidden = method !== "local";
    el("pvRaGErr").textContent = ""; el("pvRaErr").textContent = "";
    if (method === "local") {
      var p = GymSync.profile();
      el("pvRaEmail").value = (p && p.email) || "";
      el("pvRaPw").value = "";
      el("pvRaPw").focus();
    } else {
      var box = el("pvRaGBtn");
      box.innerHTML = "";
      if (GymSync.renderGoogleButton && window.google && google.accounts && google.accounts.id) {
        GymSync.renderGoogleButton(box, { theme: "filled_black", size: "large", type: "standard", text: "signin_with", shape: "pill", logo_alignment: "left", width: 280 });
      } else {
        el("pvRaGErr").dataset.pk = "raGoogleOff";
        el("pvRaGErr").textContent = tr("raGoogleOff");
      }
    }
  }

  function reauthLocal(e) {
    e.preventDefault();
    var pw = el("pvRaPw").value, email = el("pvRaEmail").value;
    var btn = el("pvRaGo"), err = el("pvRaErr");
    err.textContent = "";
    if (!pw) { err.dataset.pk = "raBad"; err.textContent = tr("raBad"); return; }
    btn.disabled = true; btn.dataset.pk = "raBusy"; btn.textContent = tr("raBusy");
    fetch(API_BASE + "/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: pw })
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (b) { return { res: res, b: b }; });
    }).catch(function () { return null; }).then(function (r) {
      btn.disabled = false; btn.dataset.pk = "raSubmit"; btn.textContent = tr("raSubmit");
      if (!r) { err.dataset.pk = "errNet"; err.textContent = tr("errNet"); return; }
      if (r.res.ok && r.b && r.b.token && GymSync.signInWithToken(r.b.token)) { backToConfirm(); return; }
      var k = r.res.status === 401 ? "raBad" : "errGeneric";
      err.dataset.pk = k; err.textContent = tr(k);
    });
  }

  // sync.js emits this after any token is installed (Google button or login).
  function onTokenAccepted() {
    if (sheet && sheet.open && view === "reauth") backToConfirm();
  }

  function backToConfirm() {
    showView("confirm");
    var s = el("pvShStatus");
    s.className = "pv-status is-ok"; s.dataset.pk = "raDone"; s.textContent = tr("raDone");
    el("pvGo").disabled = !matches(el("pvInput").value);
    el("pvInput").focus();
  }

  // ---------------- "account deleted" screen ----------------
  var doneEl = null;
  function showDone() {
    if (!doneEl) {
      doneEl = document.createElement("div");
      doneEl.className = "pv-done";
      doneEl.setAttribute("role", "alertdialog");
      doneEl.setAttribute("aria-modal", "true");
      doneEl.setAttribute("aria-labelledby", "pvDoneT");
      doneEl.innerHTML =
        '<div class="pv-done-in">' +
          '<img src="icons/logo-etq.svg" width="56" height="56" alt="">' +
          '<h2 id="pvDoneT" data-pk="doneTitle" tabindex="-1"></h2>' +
          '<p data-pk="doneBody"></p>' +
          '<button type="button" class="pv-btn pv-btn-fill" id="pvDoneBtn" data-pk="doneBtn"></button>' +
        '</div>';
      document.body.appendChild(doneEl);
      el("pvDoneBtn").addEventListener("click", function () { location.reload(); });
    }
    paintNode(doneEl);
    doneEl.hidden = false;
    el("pvDoneT").focus();
  }

  // ---------------- boot ----------------
  function init() {
    buildSection();
    document.addEventListener("gym:authchange", paint);
    document.addEventListener("gym:tokenaccepted", onTokenAccepted);
    try {
      new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    } catch (e) {}
    paint();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.GymPrivacy = { wipeLocal: wipeLocal, _test: { matches: matches, filenameFrom: filenameFrom, waitText: waitText } };
})();
