/* auth-email.js — email/password/OTP sign-in for the onboarding screen.
 *
 * Talks to gym-be's pre-auth endpoints (POST {API}/auth/signup, verify-otp,
 * login, request-reset, reset-password) and, on success, hands the returned
 * gym-be JWT to sync.js (GymSync.signInWithToken) — sync.js stays the single
 * owner of the session, so everything built on GymSync.token()/isSignedIn()
 * works the same as after Google sign-in.
 *
 * Renders into #obStepEmail (a step inside #onboarding's .ob-step-stack);
 * ui.js's showObStep("email") shows it. Strings are registered into app.js's
 * global T table; every re-render reads them from there via tr()/t(), and
 * elements marked data-i18n get re-applied for free by app.js's own
 * applyStaticI18n() whenever the language toggles (it re-queries the DOM
 * live, so newly-rendered nodes are covered with no extra wiring here).
 * Nothing here is ever written under a gym_ key, so none of it syncs. The
 * password is only ever held in memory. */
(function () {
  "use strict";

  var API_BASE = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var FETCH_TIMEOUT_MS = 15000;
  var COOLDOWN_MS = 5 * 60 * 1000;          // gym-be: 1 email per address per 5 min
  var OTP_KEY = "gymauth_otp";              // sessionStorage: {email} of a sign-up awaiting its code
  var COOLDOWN_KEY = "gymauth_cooldown";    // sessionStorage: {email, until}

  var STR = {
    aeContinueEmail: ["Continue with email", "المتابعة بالبريد الإلكتروني"],
    aeLoginTitle: ["Log in with email", "تسجيل الدخول بالبريد الإلكتروني"],
    aeSignupTitle: ["Create your account", "أنشئ حسابك"],
    aeOtpTitle: ["Check your email", "تحقّق من بريدك الإلكتروني"],
    aeForgotTitle: ["Reset your password", "إعادة تعيين كلمة المرور"],
    aeResetTitle: ["Set a new password", "تعيين كلمة مرور جديدة"],
    aeEmail: ["Email", "البريد الإلكتروني"],
    aePassword: ["Password", "كلمة المرور"],
    aeNewPassword: ["New password", "كلمة المرور الجديدة"],
    aeConfirmPassword: ["Confirm new password", "تأكيد كلمة المرور الجديدة"],
    aePhone: ["Phone number", "رقم الهاتف"],
    aePwHint: ["At least 8 characters, with a letter and a number.", "8 أحرف على الأقل، تتضمن حرفًا ورقمًا."],
    aePhoneHint: ["Include your country code, e.g. ‎+201001234567.", "أدخل رمز الدولة، مثل ‎+201001234567."],
    aeLoginBtn: ["Log in", "تسجيل الدخول"],
    aeSignupBtn: ["Create account", "إنشاء الحساب"],
    aeVerifyBtn: ["Verify", "تحقّق"],
    aeSendLink: ["Send reset link", "إرسال رابط إعادة التعيين"],
    aeResetBtn: ["Save new password", "حفظ كلمة المرور الجديدة"],
    aeForgotLink: ["Forgot password?", "نسيت كلمة المرور؟"],
    aeToSignup: ["New here? Create an account", "جديد هنا؟ أنشئ حسابًا"],
    aeToLogin: ["Already have an account? Log in", "لديك حساب بالفعل؟ سجّل الدخول"],
    aeBackToLogin: ["Back to log in", "العودة لتسجيل الدخول"],
    aeBack: ["Other sign-in options", "خيارات تسجيل دخول أخرى"],
    aeOtpSent: ["We sent a 6-digit code to", "أرسلنا رمزًا من 6 أرقام إلى"],
    aeOtpCode: ["Verification code", "رمز التحقق"],
    aeOtpExpiry: ["The code expires in 10 minutes.", "تنتهي صلاحية الرمز خلال 10 دقائق."],
    aeOtpPwNeeded: ["Enter the password you chose at sign-up.", "أدخل كلمة المرور التي اخترتها عند التسجيل."],
    aeResend: ["Resend code", "إعادة إرسال الرمز"],
    aeResendIn: ["Resend available in", "إعادة الإرسال متاحة بعد"],
    aeResendNeedsSignup: ["To get a new code, fill in the sign-up form again.", "للحصول على رمز جديد، املأ نموذج التسجيل مرة أخرى."],
    aeChangeEmail: ["Use a different email", "استخدم بريدًا آخر"],
    aeCodeResent: ["A new code is on its way.", "رمز جديد في الطريق إليك."],
    aeForgotSub: ["Enter your account email and we'll send you a link to set a new password.", "أدخل بريد حسابك وسنرسل لك رابطًا لتعيين كلمة مرور جديدة."],
    aeForgotSent: ["If an account exists for that email, a reset link is on its way. Check your inbox (and spam).", "إذا كان هناك حساب بهذا البريد، فسيصلك رابط إعادة التعيين. تحقّق من بريدك (والرسائل غير المرغوب فيها)."],
    aeResetDone: ["Password updated. Log in with your new password.", "تم تحديث كلمة المرور. سجّل الدخول بكلمة المرور الجديدة."],
    aeExpired: ["Your session has expired. Please log in again.", "انتهت صلاحية جلستك. يُرجى تسجيل الدخول مجددًا."],
    aeWorking: ["Please wait…", "يُرجى الانتظار…"],
    aeErrNetwork: ["Couldn't reach the server. Check your connection and try again.", "تعذّر الاتصال بالخادم. تحقّق من اتصالك وحاول مجددًا."],
    aeErrRateLimit: ["Too many attempts. Please wait 5 minutes and try again.", "محاولات كثيرة جدًا. يُرجى الانتظار 5 دقائق ثم المحاولة مجددًا."],
    aeErrPhoneTaken: ["This phone number is already registered to another account.", "رقم الهاتف هذا مسجّل بالفعل لحساب آخر."],
    aeErrPhoneConflict: ["This account already has a different phone number on file. Use that number.", "هذا الحساب مسجّل برقم هاتف مختلف. استخدم ذلك الرقم."],
    aeErrUnavailable: ["Email sign-in isn't available yet. Please use Google or continue without signing in.", "تسجيل الدخول بالبريد الإلكتروني غير متاح بعد. استخدم Google أو تابع بدون تسجيل الدخول."],
    aeErrLogin: ["Wrong email or password — or this email hasn't been verified yet (finish sign-up with the emailed code).", "البريد الإلكتروني أو كلمة المرور غير صحيحة — أو لم يتم التحقق من هذا البريد بعد (أكمل التسجيل بالرمز المُرسل)."],
    aeErrOtp: ["That code is wrong or has expired, or the password doesn't match. Check it, or request a new code.", "الرمز غير صحيح أو منتهي الصلاحية، أو كلمة المرور غير مطابقة. تحقّق منه أو اطلب رمزًا جديدًا."],
    aeErrResetToken: ["This reset link is invalid or has expired. Request a new one.", "رابط إعادة التعيين غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا."],
    aeErrEmail: ["Enter a valid email address.", "أدخل بريدًا إلكترونيًا صالحًا."],
    aeErrPassword: ["Password must be at least 8 characters and include a letter and a number.", "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل وتتضمن حرفًا ورقمًا."],
    aeErrPhone: ["Enter your phone number with the country code, e.g. ‎+201001234567.", "أدخل رقم هاتفك مع رمز الدولة، مثل ‎+201001234567."],
    aeErrCode: ["Enter the 6-digit code from the email.", "أدخل الرمز المكوّن من 6 أرقام من البريد."],
    aeErrMismatch: ["The passwords don't match.", "كلمتا المرور غير متطابقتين."],
    aeErrPwRequired: ["Enter your password.", "أدخل كلمة المرور."],
    aeErrGeneric: ["Something went wrong. Please try again.", "حدث خطأ ما. يُرجى المحاولة مجددًا."],
    aeErrRemoved: ["This account was removed. Contact support if you think this is a mistake.", "تمت إزالة هذا الحساب. تواصل مع الدعم إذا كنت تعتقد أن هذا خطأ."],
    aeErrBlocked: ["This account has been disabled.", "تم تعطيل هذا الحساب."]
  };

  // Register into app.js's shared string table (a global `const T` from a
  // classic script — visible here by name, not as window.T). Never overwrite
  // a key app.js already defines.
  try {
    if (typeof T === "object" && T) {
      Object.keys(STR).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(T, k)) T[k] = STR[k]; });
    }
  } catch (e) {}
  // app.js (loaded earlier, non-deferred) already ran its own one-time
  // applyStaticI18n() during initial parse — before this deferred script got
  // a chance to add the keys above to T. Without this, the static
  // #obEmailBtn's data-i18n="aeContinueEmail" (index.html) would be stuck
  // showing the literal key instead of its label until the user happens to
  // toggle the language. Re-running it now (same function, just a second,
  // idempotent pass over every [data-i18n] node) catches it up immediately.
  try { if (typeof applyStaticI18n === "function") applyStaticI18n(); } catch (e) {}

  function isAr() { return (document.documentElement.getAttribute("lang") || "").toLowerCase().indexOf("ar") === 0; }
  function curLang() { return isAr() ? "ar" : "en"; }
  function tr(key) { var e = STR[key]; return e ? e[isAr() ? 1 : 0] : key; }

  // ---------------- pure helpers ----------------
  // Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits -> ASCII, so a
  // code/phone typed on an Arabic keyboard still validates.
  function asciiDigits(s) {
    return String(s == null ? "" : s).replace(/[٠-٩۰-۹]/g, function (c) {
      var n = c.charCodeAt(0);
      return String(n >= 0x06F0 ? n - 0x06F0 : n - 0x0660);
    });
  }
  function normEmail(s) { return String(s == null ? "" : s).trim(); }
  // "+20 100-123 4567", "(+20) 1001234567", "0020 100..." -> "+201001234567".
  function normPhone(s) {
    var p = asciiDigits(s).replace(/[\s\-().‎‏]/g, "");
    if (p.indexOf("00") === 0) p = "+" + p.slice(2);
    return p;
  }
  function normCode(s) { return asciiDigits(s).replace(/\s/g, ""); }
  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
  function validPassword(s) { return typeof s === "string" && s.length >= 8 && /[A-Za-z]/.test(s) && /[0-9]/.test(s); }
  function validPhone(s) { return /^\+[1-9]\d{7,14}$/.test(s); }   // same shape gym-be enforces
  function validOtp(s) { return /^\d{6}$/.test(s); }

  // Maps an api() result to a string key. ctx picks the 401 wording, since the
  // backend deliberately returns one generic 401 per flow.
  function errorKey(res, ctx) {
    var st = res && res.status, code = (res && res.code) || "", msg = ((res && res.message) || "").toLowerCase();
    if (!st) return "aeErrNetwork";
    if (st === 403 && code === "account_blocked") return "aeErrBlocked";
    if (st === 403 && code === "account_removed") return "aeErrRemoved";
    if (st === 429) return "aeErrRateLimit";
    if (st === 503) return "aeErrUnavailable";
    if (st === 409) {
      if (code === "phone_already_registered") return "aeErrPhoneTaken";
      if (code === "phone_conflict") return "aeErrPhoneConflict";
      return "aeErrGeneric";
    }
    if (st === 401) {
      if (ctx === "login") return "aeErrLogin";
      if (ctx === "otp") return "aeErrOtp";
      if (ctx === "reset") return "aeErrResetToken";
      return "aeErrGeneric";
    }
    if (st === 422) {
      if (msg.indexOf("phone") !== -1) return "aeErrPhone";
      if (msg.indexOf("password") !== -1) return "aeErrPassword";
      if (msg.indexOf("email") !== -1) return "aeErrEmail";
      return "aeErrGeneric";
    }
    return "aeErrGeneric";
  }

  // Localized message for an api() result, in the context of flow `ctx`
  // (picks the right 401 wording — see errorKey above).
  function errorText(res, ctx) { return tr(errorKey(res, ctx)); }

  // POST {API}/auth/<path>. Never rejects: resolves {ok, status, code,
  // message, data}; status 0 = network failure/timeout.
  function api(path, body) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var tm = ctrl ? setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS) : null;
    var opts = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(API_BASE + "/auth/" + path, opts)
      .then(function (res) {
        return res.text().then(function (txt) {
          var data = null;
          try { data = txt ? JSON.parse(txt) : null; } catch (e) {}
          var err = (data && data.error) || {};
          return { ok: res.ok, status: res.status, code: err.code || "", message: err.message || "", data: data };
        });
      })
      .catch(function () { return { ok: false, status: 0, code: "", message: "", data: null }; })
      .then(function (r) { if (tm) clearTimeout(tm); return r; });
  }

  // ---------------- small state ----------------
  function ssGet(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // In-memory only: what the OTP step needs to verify / resend.
  var pending = null;      // {email, password, phone}
  var resetToken = null;
  var view = null;
  var tick = null;

  function startCooldown(email) { ssSet(COOLDOWN_KEY, { email: email, until: Date.now() + COOLDOWN_MS }); }
  function cooldownLeft(email) {
    var c = ssGet(COOLDOWN_KEY);
    if (!c || c.email !== email) return 0;
    return Math.max(0, c.until - Date.now());
  }

  function fmtMMSS(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60), r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  // ---------------- tiny HTML builders ----------------
  // Every dynamic value that reaches innerHTML goes through one of these —
  // the only untrusted strings here are the email/phone the visitor just
  // typed (echoed back into the OTP view / field values).
  function escAttr(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
  function escHtml(s) { return escAttr(s).replace(/>/g, "&gt;"); }
  function el(id) { return document.getElementById(id); }

  function fieldHtml(id, type, labelKey, o) {
    o = o || {};
    var val = o.value ? ' value="' + escAttr(o.value) + '"' : "";
    var ac = o.ac ? ' autocomplete="' + o.ac + '"' : "";
    var cls = o.cls ? ' class="' + o.cls + '"' : "";
    var extra = o.extra || "";
    var hint = o.hintKey ? '<p class="ae-hint" data-i18n="' + o.hintKey + '">' + escHtml(tr(o.hintKey)) + '</p>' : "";
    // .ae-wrap positions the show/hide eye on password fields (onboarding.css,
    // toggled by onboarding.js).
    var isPw = type === "password";
    var eye = isPw ? '<button type="button" class="ae-eye" aria-pressed="false" data-i18n-aria="aeShowPw" aria-label="' + escAttr(typeof t === "function" ? t("aeShowPw") : "Show password") + '"></button>' : "";
    return '<label class="ae-field"><span id="' + id + 'Lbl" data-i18n="' + labelKey + '">' + escHtml(tr(labelKey)) + '</span>' +
      '<span class="ae-wrap' + (isPw ? ' ae-wrap-eye' : '') + '">' +
      '<input id="' + id + '" name="' + id + '" type="' + type + '" aria-labelledby="' + id + 'Lbl"' + cls + val + ac + extra + ' required>' + eye +
      '</span></label>' + hint;
  }
  function linkHtml(id, key) {
    return '<button type="button" id="' + id + '" class="ae-link" data-i18n="' + key + '">' + escHtml(tr(key)) + '</button>';
  }
  function errHtml(id) { return '<p class="ae-err" id="' + id + '" role="alert" aria-live="polite"></p>'; }
  function noticeHtml(msgKey) { return msgKey ? '<p class="ae-notice" data-i18n="' + msgKey + '">' + escHtml(tr(msgKey)) + '</p>' : ""; }
  function h2Html(key) { return '<h2 data-i18n="' + key + '">' + escHtml(tr(key)) + '</h2>'; }

  function setBusy(btn, busy) {
    if (!btn) return;
    btn.disabled = !!busy;
    if (busy) { if (!btn.dataset.aeLabel) btn.dataset.aeLabel = btn.textContent; btn.textContent = tr("aeWorking"); }
    else if (btn.dataset.aeLabel) { btn.textContent = btn.dataset.aeLabel; delete btn.dataset.aeLabel; }
  }
  function setErr(id, key) { var e = el(id); if (e) { e.className = "ae-err"; e.textContent = key ? tr(key) : ""; } }

  // ---------------- views ----------------
  function loginHtml(o) {
    o = o || {};
    return h2Html("aeLoginTitle") + noticeHtml(o.notice) +
      '<form id="aeLoginForm" novalidate>' +
        fieldHtml("aeLoginEmail", "email", "aeEmail", { value: o.email, ac: "email" }) +
        fieldHtml("aeLoginPassword", "password", "aePassword", { ac: "current-password" }) +
        errHtml("aeLoginErr") +
        '<button type="submit" id="aeLoginSubmit" class="ae-submit" data-i18n="aeLoginBtn">' + escHtml(tr("aeLoginBtn")) + '</button>' +
      '</form>' +
      '<div class="ae-links">' + linkHtml("aeForgotBtn", "aeForgotLink") + linkHtml("aeToSignupBtn", "aeToSignup") + linkHtml("aeBackBtn", "aeBack") + '</div>';
  }

  function signupHtml(o) {
    o = o || {};
    return h2Html("aeSignupTitle") +
      '<form id="aeSignupForm" novalidate>' +
        fieldHtml("aeSignupEmail", "email", "aeEmail", { value: o.email, ac: "email" }) +
        fieldHtml("aeSignupPassword", "password", "aePassword", { ac: "new-password", hintKey: "aePwHint" }) +
        fieldHtml("aeSignupPhone", "tel", "aePhone", { value: o.phone, ac: "tel", hintKey: "aePhoneHint" }) +
        errHtml("aeSignupErr") +
        '<button type="submit" id="aeSignupSubmit" class="ae-submit" data-i18n="aeSignupBtn">' + escHtml(tr("aeSignupBtn")) + '</button>' +
      '</form>' +
      '<div class="ae-links">' + linkHtml("aeToLoginBtn", "aeToLogin") + linkHtml("aeBackBtn", "aeBack") + '</div>';
  }

  function otpHtml(o) {
    o = o || {};
    var email = (pending && pending.email) || o.email || "";
    var needPw = !(pending && pending.password);
    var canResend = !!(pending && pending.password && pending.phone);
    var left = cooldownLeft(email);
    return h2Html("aeOtpTitle") +
      '<p class="ae-sub">' + escHtml(tr("aeOtpSent")) + ' <b><bdi dir="ltr">' + escHtml(email) + '</bdi></b></p>' +
      '<form id="aeOtpForm" novalidate>' +
        (needPw ? '<p class="ae-hint">' + escHtml(tr("aeOtpPwNeeded")) + '</p>' + fieldHtml("aeOtpPassword", "password", "aePassword", { ac: "current-password" }) : "") +
        fieldHtml("aeOtpCode", "text", "aeOtpCode", { ac: "one-time-code", cls: "ae-otp-input", extra: ' inputmode="numeric" pattern="[0-9]*" maxlength="6"' }) +
        '<p class="ae-hint">' + escHtml(tr("aeOtpExpiry")) + '</p>' +
        errHtml("aeOtpErr") +
        '<button type="submit" id="aeOtpSubmit" class="ae-submit" data-i18n="aeVerifyBtn">' + escHtml(tr("aeVerifyBtn")) + '</button>' +
      '</form>' +
      '<div class="ae-links">' +
        (canResend
          ? '<button type="button" id="aeResendBtn" class="ae-link"' + (left > 0 ? " disabled" : "") + '>' + escHtml(left > 0 ? (tr("aeResendIn") + " " + fmtMMSS(left)) : tr("aeResend")) + '</button>'
          : '<p class="ae-hint">' + escHtml(tr("aeResendNeedsSignup")) + '</p>') +
        linkHtml("aeChangeEmailBtn", "aeChangeEmail") +
      '</div>';
  }

  function forgotHtml(o) {
    o = o || {};
    if (o.sent) {
      return h2Html("aeForgotTitle") + noticeHtml("aeForgotSent") +
        '<div class="ae-links">' + linkHtml("aeBackToLoginBtn", "aeBackToLogin") + '</div>';
    }
    return h2Html("aeForgotTitle") + '<p class="ae-sub" data-i18n="aeForgotSub">' + escHtml(tr("aeForgotSub")) + '</p>' +
      '<form id="aeForgotForm" novalidate>' +
        fieldHtml("aeForgotEmail", "email", "aeEmail", { value: o.email, ac: "email" }) +
        errHtml("aeForgotErr") +
        '<button type="submit" id="aeForgotSubmit" class="ae-submit" data-i18n="aeSendLink">' + escHtml(tr("aeSendLink")) + '</button>' +
      '</form>' +
      '<div class="ae-links">' + linkHtml("aeBackToLoginBtn", "aeBackToLogin") + '</div>';
  }

  function resetHtml(o) {
    o = o || {};
    if (o.done) {
      return h2Html("aeResetTitle") + noticeHtml("aeResetDone") +
        '<div class="ae-links">' + linkHtml("aeBackToLoginBtn", "aeBackToLogin") + '</div>';
    }
    return h2Html("aeResetTitle") +
      '<form id="aeResetForm" novalidate>' +
        fieldHtml("aeResetPassword", "password", "aeNewPassword", { ac: "new-password", hintKey: "aePwHint" }) +
        fieldHtml("aeResetConfirm", "password", "aeConfirmPassword", { ac: "new-password" }) +
        errHtml("aeResetErr") +
        '<button type="submit" id="aeResetSubmit" class="ae-submit" data-i18n="aeResetBtn">' + escHtml(tr("aeResetBtn")) + '</button>' +
      '</form>' +
      '<div class="ae-links">' + linkHtml("aeToForgotBtn", "aeForgotLink") + '</div>';
  }

  // Countdown for the OTP view's resend button — separate from cooldownLeft()
  // itself so the button's label ticks live instead of only updating on the
  // next render() call.
  function startResendTick(email) {
    if (tick) { clearInterval(tick); tick = null; }
    tick = setInterval(function () {
      var btn = el("aeResendBtn");
      if (!btn) { clearInterval(tick); tick = null; return; }
      var left = cooldownLeft(email);
      if (left <= 0) {
        btn.disabled = false;
        btn.textContent = tr("aeResend");
        clearInterval(tick); tick = null;
      } else {
        btn.textContent = tr("aeResendIn") + " " + fmtMMSS(left);
      }
    }, 1000);
  }

  function wire(o) {
    o = o || {};
    var backBtn = el("aeBackBtn");
    if (backBtn) backBtn.onclick = function () { if (window.GymUI && typeof GymUI.showObStep === "function") GymUI.showObStep("choices"); };
    var backToLogin = el("aeBackToLoginBtn");
    if (backToLogin) backToLogin.onclick = function () { open("login"); };
    var toForgot = el("aeToForgotBtn");
    if (toForgot) toForgot.onclick = function () { open("forgot"); };

    if (view === "login") {
      el("aeForgotBtn").onclick = function () { open("forgot", { email: el("aeLoginEmail").value }); };
      el("aeToSignupBtn").onclick = function () { open("signup", { email: el("aeLoginEmail").value }); };
      el("aeLoginForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var email = normEmail(el("aeLoginEmail").value), password = el("aeLoginPassword").value;
        setErr("aeLoginErr", null);
        if (!validEmail(email)) return setErr("aeLoginErr", "aeErrEmail");
        if (!password) return setErr("aeLoginErr", "aeErrPwRequired");
        var btn = el("aeLoginSubmit");
        setBusy(btn, true);
        api("login", { email: email, password: password }).then(function (res) {
          setBusy(btn, false);
          if (res.ok && res.data && res.data.token) {
            // false = token rejected client-side (unparseable, or already
            // "expired" against a device clock that runs >1h fast) — say so
            // instead of silently leaving the form as if nothing happened.
            if (!acceptSession(res.data.token)) setErr("aeLoginErr", "aeErrGeneric");
          } else {
            el("aeLoginErr").className = "ae-err";
            el("aeLoginErr").textContent = errorText(res, "login");
          }
        });
      });
    } else if (view === "signup") {
      el("aeToLoginBtn").onclick = function () { open("login", { email: el("aeSignupEmail").value }); };
      el("aeSignupForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var email = normEmail(el("aeSignupEmail").value);
        var password = el("aeSignupPassword").value;
        var phone = normPhone(el("aeSignupPhone").value);
        setErr("aeSignupErr", null);
        if (!validEmail(email)) return setErr("aeSignupErr", "aeErrEmail");
        if (!validPassword(password)) return setErr("aeSignupErr", "aeErrPassword");
        if (!validPhone(phone)) return setErr("aeSignupErr", "aeErrPhone");
        if (cooldownLeft(email) > 0) return setErr("aeSignupErr", "aeErrRateLimit");
        var btn = el("aeSignupSubmit");
        setBusy(btn, true);
        api("signup", { email: email, password: password, phone: phone, lang: curLang() }).then(function (res) {
          setBusy(btn, false);
          if (res.status === 202) {
            pending = { email: email, password: password, phone: phone };
            ssSet(OTP_KEY, { email: email });
            startCooldown(email);
            open("otp");
          } else {
            el("aeSignupErr").className = "ae-err";
            el("aeSignupErr").textContent = errorText(res, "signup");
          }
        });
      });
    } else if (view === "otp") {
      var email = (pending && pending.email) || (ssGet(OTP_KEY) && ssGet(OTP_KEY).email) || "";
      el("aeOtpForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var code = normCode(el("aeOtpCode").value);
        var pwField = el("aeOtpPassword");
        var password = pwField ? pwField.value : (pending && pending.password);
        setErr("aeOtpErr", null);
        if (!validOtp(code)) return setErr("aeOtpErr", "aeErrCode");
        if (!password) return setErr("aeOtpErr", "aeErrPwRequired");
        var btn = el("aeOtpSubmit");
        setBusy(btn, true);
        api("verify-otp", { email: email, code: code, password: password }).then(function (res) {
          setBusy(btn, false);
          if (res.ok && res.data && res.data.token) {
            ssDel(OTP_KEY); pending = null;
            if (!acceptSession(res.data.token)) setErr("aeOtpErr", "aeErrGeneric");
          } else {
            el("aeOtpErr").className = "ae-err";
            el("aeOtpErr").textContent = errorText(res, "otp");
          }
        });
      });
      var resendBtn = el("aeResendBtn");
      if (resendBtn) {
        resendBtn.onclick = function () {
          if (cooldownLeft(email) > 0 || !pending || !pending.password || !pending.phone) return;
          resendBtn.disabled = true;
          api("signup", { email: pending.email, password: pending.password, phone: pending.phone, lang: curLang() }).then(function (res) {
            if (res.status === 202) {
              startCooldown(email);
              var errEl = el("aeOtpErr");
              if (errEl) { errEl.className = "ae-notice"; errEl.textContent = tr("aeCodeResent"); }
              startResendTick(email);
            } else {
              resendBtn.disabled = false;
              var errEl2 = el("aeOtpErr");
              if (errEl2) { errEl2.className = "ae-err"; errEl2.textContent = errorText(res, "signup"); }
            }
          });
        };
        startResendTick(email);
      }
      var changeBtn = el("aeChangeEmailBtn");
      if (changeBtn) changeBtn.onclick = function () { pending = null; ssDel(OTP_KEY); open("login"); };
    } else if (view === "forgot" && !o.sent) {
      el("aeForgotForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var email = normEmail(el("aeForgotEmail").value);
        setErr("aeForgotErr", null);
        if (!validEmail(email)) return setErr("aeForgotErr", "aeErrEmail");
        if (cooldownLeft(email) > 0) return setErr("aeForgotErr", "aeErrRateLimit");
        var btn = el("aeForgotSubmit");
        setBusy(btn, true);
        api("request-reset", { email: email, lang: curLang() }).then(function (res) {
          setBusy(btn, false);
          if (res.status === 202) { startCooldown(email); open("forgot", { sent: true }); }
          else { el("aeForgotErr").className = "ae-err"; el("aeForgotErr").textContent = errorText(res, "forgot"); }
        });
      });
    } else if (view === "reset" && !o.done) {
      el("aeResetForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var pw = el("aeResetPassword").value, pw2 = el("aeResetConfirm").value;
        setErr("aeResetErr", null);
        if (!validPassword(pw)) return setErr("aeResetErr", "aeErrPassword");
        if (pw !== pw2) return setErr("aeResetErr", "aeErrMismatch");
        if (!resetToken) return setErr("aeResetErr", "aeErrResetToken");
        var btn = el("aeResetSubmit");
        setBusy(btn, true);
        api("reset-password", { token: resetToken, newPassword: pw }).then(function (res) {
          setBusy(btn, false);
          if (res.ok) { resetToken = null; open("reset", { done: true }); }
          else { el("aeResetErr").className = "ae-err"; el("aeResetErr").textContent = errorText(res, "reset"); }
        });
      });
    }
  }

  // Hands a gym-be JWT to sync.js; on success wipes the rendered form so the
  // typed password doesn't linger in the (now hidden) onboarding DOM.
  function acceptSession(token) {
    var ok = !!(window.GymSync && typeof GymSync.signInWithToken === "function" && GymSync.signInWithToken(token));
    if (ok) {
      if (tick) { clearInterval(tick); tick = null; }
      var host = document.getElementById("obStepEmail");
      if (host) host.innerHTML = "";
      view = null;
    }
    return ok;
  }

  function render(o) {
    var host = document.getElementById("obStepEmail");
    if (!host) return;
    if (tick) { clearInterval(tick); tick = null; }
    var html;
    if (view === "signup") html = signupHtml(o);
    else if (view === "otp") html = otpHtml(o);
    else if (view === "forgot") html = forgotHtml(o);
    else if (view === "reset") html = resetHtml(o);
    else html = loginHtml(o);
    host.innerHTML = html;
    wire(o);
  }

  // Opens the email step of onboarding on this view. Safe to call whether or
  // not onboarding is currently shown at all (a live session-loss, or a
  // reset link opened while signed in/anon, both land here with the overlay
  // hidden) — it brings the overlay up first via GymUI.promptSignIn(), same
  // as any other "you need to sign in" entry point, then swaps to "email".
  function open(v, o) {
    view = v;
    render(o || {});
    try {
      var obEl = document.getElementById("onboarding");
      if (obEl && obEl.hidden && window.GymUI && typeof GymUI.promptSignIn === "function") GymUI.promptSignIn();
      if (window.GymUI && typeof GymUI.showObStep === "function") GymUI.showObStep("email");
    } catch (e) {}
  }

  // Runs on DOMContentLoaded, AFTER ui.js's own boot() (registered earlier,
  // during initial HTML parsing — listeners fire in registration order) has
  // already decided what onboarding shows. That's deliberate: boot() may
  // itself open onboarding on a plain "choices" step (a returning,
  // signed-out visitor); this only needs to override which STEP is active,
  // never whether the overlay is up at all.
  function initRoute() {
    try {
      var qs = new URLSearchParams(location.search);
      var tok = qs.get("reset_token");
      if (!tok && /\/reset-password$/.test(location.pathname)) tok = qs.get("token");
      if (tok) {
        resetToken = tok;
        try { history.replaceState(null, "", "./"); } catch (e) {}
        open("reset");
        return;
      }
    } catch (e) {}
    try {
      var method = lsGet("gymauth_method");
      var signedIn = !!(window.GymSync && typeof GymSync.isSignedIn === "function" && GymSync.isSignedIn());
      // A device whose last session was local (email/password): GIS can't
      // silently restore it (sync.js's shouldResolveSilently() already
      // knows this), so boot() would otherwise leave a returning visitor on
      // the generic Google/anon choices screen. Route straight to email
      // login instead, prefilled with the remembered address.
      if (!signedIn && method === "local") open("login", { email: lsGet("gymauth_email") || "" });
    } catch (e) {}
  }
  document.addEventListener("DOMContentLoaded", initRoute);

  window.GymAuthEmail = {
    onSessionExpired: function (email) { open("login", { email: email || lsGet("gymauth_email") || "", notice: "aeExpired" }); },
    open: function (v, o) { open(v, o); },
    _test: { normPhone: normPhone, normCode: normCode, normEmail: normEmail, validEmail: validEmail, validPassword: validPassword,
             validPhone: validPhone, validOtp: validOtp, errorKey: errorKey, errorText: errorText, tr: tr, curLang: curLang, STR: STR }
  };
})();
