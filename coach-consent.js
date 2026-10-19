/* coach-consent.js — the one "coach_ai" consent that gates every AI Coach
 * feature: plan generation, check-ins, chat and meal photos (the InBody photo
 * reader also needs it, on top of its own inbody_ai consent).
 *
 *   GymCoachConsent.ensure()  -> Promise<boolean>   true once the account has an
 *       active consent (shows the sheet when it doesn't). false = the user said
 *       "Not now", or isn't signed in (the sign-in prompt is shown instead).
 *   GymCoachConsent.run(fn)   -> Promise<result>    fn() resolves {status, body};
 *       a 403 consent_required clears the cache, asks, and runs fn once more.
 *   GymCoachConsent.isUnavailable(result)           503 consent_check_unavailable
 *   GymCoachConsent.unavailableText()               the friendly retry message
 *
 * The state is cached for the session and dropped on sign-in changes and on
 * withdrawal (privacy.js fires etq:coach-consent-withdrawn). If the lookup
 * itself fails we let the action through: the server gate is the authority and
 * answers 403/503 if we guessed wrong. Text goes in through GymDom.h only. */
(function () {
  "use strict";

  var API_ROOT = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var TIMEOUT_MS = 20000;
  // Version of the consent wording below (the lawyer review's textVersion).
  // Change it whenever that text changes: everyone is then asked to agree again.
  var CONSENT_TYPE = "coach_ai";
  var CONSENT_VERSION = "coach_ai.v1";

  if (!window.GymDom) throw new Error("coach-consent.js: dom.js must load first");
  var h = GymDom.h, lang = GymDom.lang;
  var STR = {
    title: ["Before you use the AI coach", "قبل استخدام المدرّب الذكي"],
    notice: ["Etqadem's AI coach is powered by Anthropic, an AI company in the United States. To build your plan, reply in the chat and estimate meals from photos, we send Anthropic only what the coach needs: your age, sex, height, weight, goal and activity level; any allergies, notes and InBody numbers you add; your calorie and macro targets; today's food log; your chat messages; meal photos you choose to send; and whether Ramadan mode is on. Some of this is health information. We don't send your name, email or account ID. Anthropic uses this data only to answer us and doesn't use it to train AI. It normally deletes it within 30 days. The coach's answers are estimates and general guidance, not medical advice. You can still use workouts and food logging without the AI coach.",
      "يعمل المدرّب الذكي في اتقدم بتقنية شركة Anthropic، وهي شركة ذكاء اصطناعي في الولايات المتحدة الأمريكية. ولإعداد خطتك والرد عليك في الدردشة وتقدير وجباتك من الصور، نرسل إلى Anthropic ما يحتاجه المدرّب فقط: عمرك وجنسك وطولك ووزنك وهدفك ومستوى نشاطك؛ وأي حساسية غذائية أو ملاحظات أو أرقام InBody تضيفها؛ وأهدافك من السعرات الحرارية والعناصر الغذائية؛ وسجل طعامك لليوم؛ ورسائلك في الدردشة؛ وصور الوجبات التي تختار إرسالها؛ وما إذا كان وضع رمضان مفعّلًا. وبعض هذه البيانات معلومات صحية. لا نرسل اسمك أو بريدك الإلكتروني أو معرّف حسابك. تستخدم Anthropic هذه البيانات للرد علينا فقط، ولا تستخدمها في تدريب الذكاء الاصطناعي، وتحذفها عادةً خلال 30 يومًا. إجابات المدرّب تقديرات وإرشادات عامة، وليست نصيحة طبية. ويمكنك مواصلة استخدام التمارين وتسجيل الطعام من دون المدرّب الذكي."],
    agree: ["I'm 18 or older, and I agree that Etqadem sends this information, including my health information, to Anthropic in the United States so the AI coach can work. I can withdraw this at any time in More → Privacy & data.",
      "عمري 18 عامًا أو أكثر، وأوافق على أن ترسل اتقدم هذه المعلومات، بما فيها معلوماتي الصحية، إلى شركة Anthropic في الولايات المتحدة الأمريكية لكي يعمل المدرّب الذكي. ويمكنني سحب هذه الموافقة في أي وقت من: المزيد ← الخصوصية والبيانات."],
    policy: ["Privacy Policy", "سياسة الخصوصية"],
    go: ["Turn on the AI coach", "تفعيل المدرّب الذكي"],
    saving: ["Saving…", "جارٍ الحفظ…"],
    cancel: ["Not now", "ليس الآن"],
    saveErr: ["Couldn't save your agreement, so the AI coach is still off. Check your connection and try again.",
      "تعذّر حفظ موافقتك، لذا ما زال المدرّب الذكي متوقفًا. تحقق من اتصالك وحاول مرة أخرى."],
    unavailable: ["The AI coach can't check your settings right now. Try again in a moment.",
      "تعذّر على المدرّب الذكي التحقق من إعداداتك الآن. حاول مرة أخرى بعد قليل."]
  };
  var s = GymDom.makeT(STR);

  var granted = false;   // session cache: an active coach_ai record for CONSENT_VERSION
  var asked = false;     // the sheet was shown during the latest ensure()
  var inflight = null;   // the one ensure() in progress, shared by concurrent callers

  function token() { return window.GymSync && GymSync.token ? GymSync.token() : null; }
  function call(method, suffix, body) {
    var c = new AbortController();
    var timer = setTimeout(function () { c.abort(); }, TIMEOUT_MS);
    var opts = { method: method, headers: { "Authorization": "Bearer " + token() }, signal: c.signal };
    if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    return fetch(API_ROOT + "/me/consents" + (suffix || ""), opts).finally(function () { clearTimeout(timer); });
  }
  function errCode(r) {
    var e = r && r.body && r.body.error;
    return e && (e.code || e);
  }
  // An error naming a different consent (inbody_ai) is not ours to ask for.
  function isRequired(r) {
    if (!r || r.status !== 403 || errCode(r) !== "consent_required") return false;
    var which = r.body.error.consent;
    return !which || which === CONSENT_TYPE;
  }
  function isUnavailable(r) { return !!r && r.status === 503 && errCode(r) === "consent_check_unavailable"; }

  // "yes" | "no" | "unknown" (the lookup failed: let the server decide)
  function lookup() {
    return call("GET", "").then(function (res) {
      if (!res.ok) return "unknown";
      return res.json().then(function (d) {
        var list = (d && d.consents) || [];
        return list.some(function (c) {
          return c && c.type === CONSENT_TYPE && !c.withdrawnAt && c.textVersion === CONSENT_VERSION;
        }) ? "yes" : "no";
      }, function () { return "unknown"; });
    }, function () { return "unknown"; });
  }

  var dlg = null, agreeBox, goBtn, cancelBtn, errEl, settle = null, busy = false;
  function buildSheet() {
    agreeBox = h("input", { type: "checkbox", id: "ccAgree" });
    errEl = h("p", { class: "pv-err", role: "alert" });
    goBtn = h("button", { type: "button", class: "pv-btn pv-btn-fill", on: { click: grant } }, s("go"));
    cancelBtn = h("button", { type: "button", class: "pv-btn", on: { click: function () { close(false); } } }, s("cancel"));
    agreeBox.addEventListener("change", function () { goBtn.disabled = busy || !agreeBox.checked; });
    dlg = h("dialog", { class: "pv-sheet cc-sheet", "aria-labelledby": "ccTitle", on: {
      cancel: function (e) { e.preventDefault(); if (!busy) close(false); },
      click: function (e) { if (e.target === dlg && !busy) close(false); }
    } },
      h("div", {},
        h("div", { class: "pv-sheet-grip", "aria-hidden": "true" }),
        h("h2", { class: "pv-sh-title", id: "ccTitle", tabindex: "-1" }, s("title")),
        h("p", { class: "cc-notice" }, s("notice")),
        h("p", { class: "pol-line" }, GymDom.policyLink("ai-coach", s("policy"), true)),
        h("label", { class: "coach-check cc-agree", for: "ccAgree" }, agreeBox, h("span", {}, s("agree"))),
        errEl,
        h("div", { class: "pv-actions" }, cancelBtn, goBtn)));
    document.body.appendChild(dlg);
  }
  function paintText() {
    dlg.querySelector("#ccTitle").textContent = s("title");
    dlg.querySelector(".cc-notice").textContent = s("notice");
    dlg.querySelector(".pol-link").textContent = s("policy");
    dlg.querySelector(".cc-agree span").textContent = s("agree");
    cancelBtn.textContent = s("cancel");
    goBtn.textContent = s("go");
  }
  function close(ok) {
    if (dlg && dlg.open) dlg.close();
    var done = settle; settle = null;
    if (done) done(ok);
  }
  function grant() {
    if (busy || !agreeBox.checked) return;
    if (!token()) { close(false); if (window.GymUI) GymUI.promptSignIn(); return; }
    busy = true; errEl.textContent = "";
    goBtn.disabled = true; cancelBtn.disabled = true; goBtn.textContent = s("saving");
    call("POST", "", { type: CONSENT_TYPE, textVersion: CONSENT_VERSION, lang: lang() === "ar" ? "ar" : "en" })
      .then(function (res) {
        if (!res.ok) throw new Error("save");
        granted = true;
        document.dispatchEvent(new CustomEvent("etq:coach-consent-changed", { detail: { granted: true } }));
        return true;
      }).catch(function () { errEl.textContent = s("saveErr"); return false; })
      .then(function (ok) {
        busy = false; cancelBtn.disabled = false; goBtn.textContent = s("go"); goBtn.disabled = !agreeBox.checked;
        if (ok) close(true);
      });
  }
  function showSheet() {
    asked = true;
    if (!dlg) buildSheet(); else paintText();
    agreeBox.checked = false; goBtn.disabled = true; errEl.textContent = "";
    return new Promise(function (resolve) {
      settle = resolve;
      dlg.showModal();
      dlg.querySelector("#ccTitle").focus();
    });
  }

  function ensure() {
    if (!token()) { if (window.GymUI) GymUI.promptSignIn(); return Promise.resolve(false); }
    if (granted) return Promise.resolve(true);
    if (inflight) return inflight;
    asked = false;
    inflight = lookup().then(function (state) {
      if (state === "yes") { granted = true; return true; }
      if (state === "unknown") return true;
      return showSheet();
    }).finally(function () { inflight = null; });
    return inflight;
  }

  // fn(): Promise<{status, body}> (or null when the caller already handled it).
  // ambiguous: the route's 403 doesn't say which consent is missing (InBody
  // needs two). Retry only if the sheet was needed and agreed to; otherwise
  // the 403 is the other consent's and goes back to the caller untouched.
  function run(fn, ambiguous) {
    return fn().then(function (r) {
      if (!isRequired(r)) return r;
      granted = false;
      return ensure().then(function (ok) {
        if (!ok) return null;
        return ambiguous && !asked ? r : fn();
      });
    });
  }

  function reset() { granted = false; }
  document.addEventListener("gym:authchange", reset);
  document.addEventListener("etq:coach-consent-withdrawn", reset);

  window.GymCoachConsent = {
    ensure: ensure, run: run, reset: reset,
    isRequired: isRequired, isUnavailable: isUnavailable,
    unavailableText: function () { return s("unavailable"); },
    version: CONSENT_VERSION
  };
})();
