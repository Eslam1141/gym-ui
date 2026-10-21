/* feedback.js — "Send feedback" sheet (signed in or guest).
 *
 * Opens from the avatar menu (header.js) and the signed-out prefs pill
 * (#feedbackBtn) through GymFeedback.open(). Reuses the .syd bottom-sheet
 * styles. POST /api/v1/feedback: Authorization only when signed in, email only
 * for guests. The unsent draft lives in localStorage (try/catch everywhere).
 * Everything the user typed is only ever put into the DOM as .value/.textContent. */
(function () {
  "use strict";

  var API_BASE = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var DRAFT_KEY = "gym_feedback_draft";
  var MAX = 2000;
  var TYPES = ["bug", "idea", "other"];
  var ICONS = { bug: "🐞", idea: "💡", other: "💬" };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var STR = {
    title: ["Send feedback", "ابعت رأيك"],
    typeLabel: ["What kind of feedback?", "نوع الرأي؟"],
    bug: ["Problem", "مشكلة"],
    idea: ["Idea", "فكرة"],
    other: ["Other", "حاجة تانية"],
    msgLabel: ["Your message", "رسالتك"],
    msgPh: ["Tell us what happened or what you'd like to see.", "احكيلنا إيه اللي حصل أو إيه اللي نفسك تشوفه."],
    emailLabel: ["Email (optional, if you want a reply)", "الإيميل (اختياري، لو عايز رد)"],
    policy: ["Privacy Policy", "سياسة الخصوصية"],
    send: ["Send", "ابعت"],
    sending: ["Sending…", "جارٍ الإرسال…"],
    cancel: ["Cancel", "إلغاء"],
    close: ["Close", "إغلاق"],
    thanks: ["Thanks! The team will read it.", "شكرًا! الفريق هيقرأ رأيك."],
    thanksF: ["Thanks! The team will read it.", "شكرًا ليكي! الفريق هيقرأ رأيك."],
    empty: ["Write a message first.", "اكتب رسالة الأول."],
    badEmail: ["That email doesn't look right.", "الإيميل ده شكله مش صح."],
    offline: ["You're offline. Your draft is saved, send it when you're back online.", "إنت أوفلاين. المسودة محفوظة، ابعتها لما النت يرجع."],
    rate: ["Too many messages. Try again in {n} minutes.", "رسايل كتير. جرّب تاني بعد {n} دقيقة."],
    tooBig: ["That message is too large to send.", "الرسالة كبيرة أوي ومينفعش تتبعت."],
    expired: ["Your session expired. Sign in again, your draft is saved.", "الجلسة انتهت. سجّل دخول تاني، المسودة محفوظة."],
    generic: ["Couldn't send. Try again.", "معرفناش نبعت. جرّب تاني."]
  };

  function lang() { return document.documentElement.lang === "ar" ? 1 : 0; }
  function s(key, params) {
    var v = STR[key] ? STR[key][lang()] : key;
    if (params) v = v.replace(/\{(\w+)\}/g, function (_, k) { return params[k] != null ? String(params[k]) : ""; });
    return v;
  }
  function thanks() {
    var fem = lang() === 1 && document.documentElement.dataset.plan === "female";
    return s(fem ? "thanksF" : "thanks");
  }

  function signedIn() { return !!(window.GymSync && GymSync.isSignedIn && GymSync.isSignedIn()); }
  function token() { return window.GymSync && GymSync.token ? GymSync.token() : null; }

  function readDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (d && typeof d === "object") {
        return {
          type: TYPES.indexOf(d.type) >= 0 ? d.type : "bug",
          message: typeof d.message === "string" ? d.message.slice(0, MAX) : "",
          email: typeof d.email === "string" ? d.email.slice(0, 254) : ""
        };
      }
    } catch (e) {}
    return { type: "bug", message: "", email: "" };
  }
  function writeDraft(d) {
    try {
      if (!d.message && !d.email) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch (e) {}
  }

  function platform() {
    try {
      var c = window.Capacitor;
      if (c && typeof c.getPlatform === "function") {
        var p = c.getPlatform();
        if (p === "android" || p === "ios") return p;
      }
    } catch (e) {}
    return "web";
  }
  function context() {
    var screen = "";
    try { screen = (window.GymUI && GymUI.currentTab && GymUI.currentTab()) || ""; } catch (e) {}
    var ctx = {
      platform: platform(),
      lang: document.documentElement.lang === "ar" ? "ar" : "en",
      screen: String(screen).slice(0, 64),
      userAgent: String(navigator.userAgent || "").slice(0, 256)
    };
    if (window.GYM_APP_VERSION) ctx.appVersion = String(window.GYM_APP_VERSION).slice(0, 32);
    return ctx;
  }

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var sheet = null;

  function open() {
    if (sheet) return;
    var opener = document.activeElement;
    var guest = !signedIn();
    var draft = readDraft();
    var type = draft.type;
    var busy = false;
    var done = false;

    var root = node("div", "syd fb m-ovl");
    root.id = "feedbackSheet";
    var backdrop = node("div", "syd-backdrop");
    var panel = node("div", "syd-panel fb-panel m-ovl-card");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "fbTitle");

    var title = node("h2", "syd-title", s("title"));
    title.id = "fbTitle";

    var form = node("form", "fb-form");
    form.noValidate = true;

    var group = node("div", "fb-types");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", s("typeLabel"));
    var chips = TYPES.map(function (t) {
      var b = node("button", "fb-chip");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.dataset.type = t;
      b.appendChild(node("span", "fb-chip-ico", ICONS[t]));
      b.appendChild(node("span", null, s(t)));
      b.addEventListener("click", function () { type = t; paintChips(); persist(); });
      group.appendChild(b);
      return b;
    });
    function paintChips() {
      chips.forEach(function (b) {
        var on = b.dataset.type === type;
        b.setAttribute("aria-checked", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
        b.classList.toggle("is-on", on);
      });
    }
    group.addEventListener("keydown", function (e) {
      var dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!dir) return;
      if (document.documentElement.dir === "rtl" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) dir = -dir;
      e.preventDefault();
      type = TYPES[(TYPES.indexOf(type) + dir + TYPES.length) % TYPES.length];
      paintChips(); persist();
      chips[TYPES.indexOf(type)].focus();
    });

    var msgLabel = node("label", "fb-label", s("msgLabel"));
    msgLabel.htmlFor = "fbMsg";
    var msg = node("textarea", "fb-text");
    msg.id = "fbMsg";
    msg.rows = 5;
    msg.maxLength = MAX;
    msg.placeholder = s("msgPh");
    msg.value = draft.message;
    msg.setAttribute("dir", "auto");
    var count = node("div", "fb-count");
    count.setAttribute("aria-hidden", "true");

    var email = null;
    var emailWrap = null;
    if (guest) {
      emailWrap = node("div", "fb-field");
      var emailLabel = node("label", "fb-label", s("emailLabel"));
      emailLabel.htmlFor = "fbEmail";
      email = node("input", "fb-input");
      email.id = "fbEmail";
      email.type = "email";
      email.autocomplete = "email";
      email.maxLength = 254;
      email.setAttribute("dir", "auto");
      email.value = draft.email;
      emailWrap.appendChild(emailLabel);
      emailWrap.appendChild(email);
    }

    var policy = node("p", "pol-line");
    var policyLink = node("a", "pol-link", s("policy"));
    policyLink.href = "/privacy#feedback";
    policyLink.target = "_blank";
    policyLink.rel = "noopener";
    policy.appendChild(policyLink);

    var status = node("p", "fb-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    var send = node("button", "syd-yes fb-send", s("send"));
    send.type = "submit";
    var cancel = node("button", "syd-no fb-cancel", s("cancel"));
    cancel.type = "button";
    var actions = node("div", "syd-actions");
    actions.appendChild(send);
    actions.appendChild(cancel);

    form.appendChild(group);
    form.appendChild(msgLabel);
    form.appendChild(msg);
    form.appendChild(count);
    if (emailWrap) form.appendChild(emailWrap);
    form.appendChild(policy);
    form.appendChild(status);
    form.appendChild(actions);

    panel.appendChild(title);
    panel.appendChild(form);
    root.appendChild(backdrop);
    root.appendChild(panel);

    function persist() {
      if (done) return;
      writeDraft({ type: type, message: msg.value, email: email ? email.value : "" });
    }
    function paintCount() {
      var n = msg.value.length;
      count.textContent = n + "/" + MAX;
      count.classList.toggle("is-full", n >= MAX);
      send.disabled = busy || !msg.value.trim();
    }
    function setStatus(text, isErr) {
      status.textContent = text || "";
      status.classList.toggle("is-err", !!isErr);
    }
    function setBusy(b) {
      busy = b;
      msg.readOnly = b;
      send.textContent = s(b ? "sending" : "send");
      paintCount();
    }
    msg.addEventListener("input", function () { paintCount(); persist(); setStatus(""); });
    if (email) email.addEventListener("input", function () { persist(); setStatus(""); });

    function close() {
      document.removeEventListener("keydown", onKey, true);
      GymMotion.hide(root, function () { root.remove(); });
      sheet = null;
      if (opener && opener.focus) try { opener.focus(); } catch (e) {}
    }
    function focusables() {
      return Array.prototype.filter.call(
        panel.querySelectorAll("button, textarea, input"),
        function (n) { return !n.disabled && n.tabIndex !== -1 && n.offsetParent !== null; }
      );
    }
    function onKey(e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); return; }
      if (e.key !== "Tab") return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
    cancel.addEventListener("click", close);
    backdrop.addEventListener("click", close);

    function success() {
      done = true;
      writeDraft({ message: "", email: "" });
      panel.textContent = "";
      var ok = node("div", "fb-done");
      var mark = node("div", "fb-done-mark", "✓");
      mark.setAttribute("aria-hidden", "true");
      var h = node("h2", "syd-title", thanks());
      h.id = "fbTitle";
      h.setAttribute("role", "status");
      var closeBtn = node("button", "syd-yes", s("close"));
      closeBtn.type = "button";
      closeBtn.addEventListener("click", close);
      ok.appendChild(mark);
      ok.appendChild(h);
      ok.appendChild(closeBtn);
      panel.appendChild(ok);
      closeBtn.focus();
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      var text = msg.value.trim();
      if (!text) { setStatus(s("empty"), true); msg.focus(); return; }
      var addr = email ? email.value.trim() : "";
      if (addr && !EMAIL_RE.test(addr)) { setStatus(s("badEmail"), true); email.focus(); return; }
      if (navigator.onLine === false) { setStatus(s("offline"), true); return; }

      var body = { type: type, message: text, context: context() };
      if (guest && addr) body.email = addr;
      var headers = { "Content-Type": "application/json" };
      var tok = guest ? null : token();
      if (tok) headers["Authorization"] = "Bearer " + tok;

      setBusy(true);
      setStatus("");
      fetch(API_BASE + "/feedback", { method: "POST", headers: headers, body: JSON.stringify(body) })
        .then(function (res) {
          if (res.status === 201) { success(); return; }
          return res.json().catch(function () { return null; }).then(function (j) {
            var m = j && j.error && j.error.message;
            if (res.status === 422) setStatus(m || s("generic"), true);
            else if (res.status === 429) {
              var secs = parseInt(res.headers.get("Retry-After"), 10);
              setStatus(s("rate", { n: Math.max(1, Math.ceil((secs > 0 ? secs : 60) / 60)) }), true);
            }
            else if (res.status === 413) setStatus(s("tooBig"), true);
            else if (res.status === 401) {
              // Same path coach.js uses on a dead token: the login screen. The draft stays.
              persist();
              close();
              if (window.GymUI && GymUI.promptSignIn) GymUI.promptSignIn();
              return;
            }
            else setStatus(s("generic"), true);
            setBusy(false);
          });
        })
        .catch(function () {
          setStatus(navigator.onLine === false ? s("offline") : s("generic"), true);
          setBusy(false);
        });
    });

    paintChips();
    paintCount();
    sheet = root;
    document.body.appendChild(root);
    GymMotion.show(root);
    document.addEventListener("keydown", onKey, true);
    msg.focus();
  }

  window.GymFeedback = { open: open, title: function () { return s("title"); } };

  function wirePill() {
    var b = document.getElementById("feedbackBtn");
    if (!b) return;
    b.setAttribute("aria-label", s("title"));
    b.title = s("title");
    if (!b.dataset.wired) { b.dataset.wired = "1"; b.addEventListener("click", open); }
  }
  wirePill();
  try {
    new MutationObserver(wirePill).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  } catch (e) {}
})();
