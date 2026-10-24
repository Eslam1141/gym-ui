/* terms-update.js — records the Terms acceptance on the server and asks people who
 * agreed to an older version (or never saw one) to agree to the current one.
 *
 *   - Sign-up: ui.js's acceptTerms() writes gym_terms_ok = GymUI.termsVersion on the tap
 *     on a sign-in choice. Once the account exists this file POSTs
 *     /me/consents {type:"terms", textVersion, lang} and remembers it in gym_terms_synced.
 *     An older backend answers 400 for the unknown type: the local flag stays, we try
 *     once more on the next launch, and nobody is ever blocked.
 *   - Everyone else: a signed-in account whose server records lack this version, or a
 *     guest whose local flag is older, sees one "We've updated our Terms" sheet. The
 *     buttons are "Agree and continue" and "Not now" (asks again next launch); a signed-in
 *     person can also sign out or open the delete-account page. Nothing is pre-ticked.
 *     It never shows on the sign-in screen, and a fresh sign-up already carries the flag.
 *
 * The sheet is a native <dialog> (showModal): focus is trapped, Escape means "Not now",
 * and focus goes back to where it was. Text goes in through GymDom.h only. */
(function () {
  "use strict";

  if (!window.GymDom || !window.GymUI) throw new Error("terms-update.js: dom.js and ui.js must load first");
  var API_ROOT = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var TIMEOUT_MS = 15000;
  var OK_KEY = "gym_terms_ok";            // the version agreed to on this device
  var SYNCED_KEY = "gym_terms_synced";    // the version the server has a record for
  var VERSION = GymUI.termsVersion;
  var h = GymDom.h, lang = GymDom.lang;

  var STR = {
    title: ["We've updated our Terms", "حدّثنا شروط الاستخدام"],
    body: ["We've added a section on the AI coach: it's powered by Anthropic (US), its answers can be wrong, and it isn't medical advice. Please read the [Terms](/terms#ai-coach) and [Privacy Policy](/privacy). By tapping \"Agree and continue\", you accept them and confirm you're 18 or older.",
      "أضفنا قسمًا عن المدرّب الذكي: يعمل بتقنية Anthropic (الولايات المتحدة)، وقد تكون إجاباته خاطئة، وليس نصيحة طبية. يُرجى قراءة [شروط الاستخدام](/terms#ai-coach) و[سياسة الخصوصية](/privacy). وبالضغط على «أوافق وأتابع» فإنك تقبلهما وتؤكد أن عمرك 18 عامًا أو أكثر."],
    agree: ["Agree and continue", "أوافق وأتابع"],
    later: ["Not now", "ليس الآن"],
    signOut: ["Sign out", "تسجيل الخروج"],
    del: ["Delete my account", "حذف حسابي"]
  };
  var s = GymDom.makeT(STR);

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function token() { return window.GymSync && GymSync.token ? GymSync.token() : null; }
  function signedIn() { return !!token(); }
  function localOk() { return ls(OK_KEY) === VERSION; }
  function onLoginScreen() { return document.body.classList.contains("onboarding-open"); }

  function call(method, body) {
    var c = new AbortController();
    var timer = setTimeout(function () { c.abort(); }, TIMEOUT_MS);
    var opts = { method: method, headers: { "Authorization": "Bearer " + token() }, signal: c.signal };
    if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    return fetch(API_ROOT + "/me/consents", opts).finally(function () { clearTimeout(timer); });
  }
  // Tell the server. Resolves true once it has the record; a failure (old backend, offline) just resolves false.
  function record() {
    if (!signedIn()) return Promise.resolve(false);
    return call("POST", { type: "terms", textVersion: VERSION, lang: lang() === "ar" ? "ar" : "en" }).then(function (res) {
      if (res.ok) set(SYNCED_KEY, VERSION);
      return res.ok;
    }, function () { return false; });
  }
  // "yes" | "no" | "unknown" (the lookup failed: stay quiet, ask again next launch)
  function lookup() {
    return call("GET").then(function (res) {
      if (!res.ok) return "unknown";
      return res.json().then(function (d) {
        return ((d && d.consents) || []).some(function (c) {
          return c && c.type === "terms" && !c.withdrawnAt && c.textVersion === VERSION;
        }) ? "yes" : "no";
      }, function () { return "unknown"; });
    }, function () { return "unknown"; });
  }

  // "[text](url)" pieces of a translated sentence become links; the rest stays text.
  function rich(str) {
    var out = [], re = /\[([^\]]+)\]\(([^)]+)\)/g, last = 0, m;
    while ((m = re.exec(str))) {
      if (m.index > last) out.push(str.slice(last, m.index));
      out.push(h("a", { href: m[2], target: "_blank", rel: "noopener" }, m[1]));
      last = re.lastIndex;
    }
    if (last < str.length) out.push(str.slice(last));
    return out;
  }

  var dlg = null, dismissed = false, accountMode = false;
  function paint() {
    dlg.textContent = "";
    var actions = h("div", { class: "pv-actions" },
      h("button", { type: "button", class: "pv-btn", on: { click: later } }, s("later")),
      h("button", { type: "button", class: "pv-btn pv-btn-fill", on: { click: agree } }, s("agree")));
    var kids = [
      h("div", { class: "pv-sheet-grip", "aria-hidden": "true" }),
      h("h2", { class: "pv-sh-title", id: "tuTitle", tabindex: "-1" }, s("title")),
      h("p", { class: "cc-notice tu-body" }, rich(s("body"))),
      actions];
    if (accountMode) {
      kids.push(h("div", { class: "tu-links" },
        h("button", { type: "button", class: "tu-link", on: { click: signOut } }, s("signOut")),
        h("a", { class: "tu-link", href: "/delete-account", target: "_blank", rel: "noopener" }, s("del"))));
    }
    dlg.appendChild(h("div", {}, kids));
  }
  function build() {
    dlg = h("dialog", { class: "pv-sheet cc-sheet tu-sheet", "aria-labelledby": "tuTitle", on: {
      cancel: function (e) { e.preventDefault(); later(); },
      click: function (e) { if (e.target === dlg) later(); }
    } });
    document.body.appendChild(dlg);
    document.addEventListener("gym:lang-changed", function () { if (dlg.open) paint(); });
  }
  function show(account) {
    if (dismissed || (dlg && dlg.open)) return;
    accountMode = account;
    if (!dlg) build();
    paint();
    dlg.showModal();
    var t = dlg.querySelector("#tuTitle");
    if (t) t.focus({ preventScroll: true });
  }
  function close() { if (dlg && dlg.open) dlg.close(); }
  function later() { dismissed = true; close(); }
  function agree() {
    set(OK_KEY, VERSION);
    close();
    record();
  }
  function signOut() {
    dismissed = true;
    close();
    if (window.GymSync && GymSync.signOut) GymSync.signOut();
  }

  var checking = false, retried = false;
  function check() {
    if (dlg && dlg.open && onLoginScreen()) close();   // the sign-in screen came up (signed out): it carries the new line itself
    if (checking || dismissed || (dlg && dlg.open) || !GymUI.onboarded() || onLoginScreen()) return;
    if (signedIn()) {
      if (localOk()) {
        // Agreed here (a fresh sign-up, or a tap as a guest): make sure the server has it, once per launch.
        if (ls(SYNCED_KEY) !== VERSION && !retried) { retried = true; record(); }
        return;
      }
      checking = true;
      lookup().then(function (answer) {
        checking = false;
        if (answer === "yes") { set(OK_KEY, VERSION); set(SYNCED_KEY, VERSION); return; }
        // agreed on the sign-in screen while this was in flight
        if (localOk()) { record(); return; }
        if (answer === "no" && signedIn() && !onLoginScreen()) show(true);
      });
    } else if (GymUI.isAnon() && !localOk()) {
      show(false);
    }
  }

  function init() {
    document.addEventListener("gym:authchange", check);
    // The sign-in screen may still be fading out when the account appears; look again once it is gone.
    new MutationObserver(check).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    check();
  }
  window.GymTerms = { check: check };

  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);
})();
