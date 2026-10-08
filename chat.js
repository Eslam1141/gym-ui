/* chat.js — floating live nutrition/fitness chat bubble.
 *
 * A small circular "AI coach" button, visible on every screen except while
 * the workout timer is running, that opens a lightweight chat drawer backed
 * by POST /assistant/chat. Idle, it occasionally shows a short static tip
 * (no network call). Anonymous taps prompt sign-in, same as the Coach tab.
 *
 * Local keys (NOT synced — deliberately not gym_-prefixed, device-local):
 *   gymcoach_chat_history   the visible transcript (trimmed), restored on reopen;
 *                           gymcoach_ is wiped by sync.js on sign-out / account switch
 */
(function () {
  "use strict";

  var ASSIST_BASE = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "") + "/assistant";
  var CALL_TIMEOUT_MS = 30000;
  var HIST_KEY = "gymcoach_chat_history";
  var OLD_HIST_KEY = "gymchat_history"; // pre-rename key, survived sign-out (audit M4)
  var HIST_MAX = 30;      // kept for display
  var SEND_WINDOW = 8;    // most recent turns actually sent to the API
  var MSG_MAX = 600;      // mirrors the backend's per-message cap
  var TIP_FIRST_MS = 9000;
  var TIP_INTERVAL_MS = 75000;
  var TIP_SHOW_MS = 7000;   // auto-hide delay when the mouse never touches it
  var TIP_LEAVE_MS = 1200;  // grace delay once the cursor actually leaves it

  // ---------------- i18n ----------------
  if (!window.GymDom) throw new Error("chat.js: dom.js must load first");
  var h = GymDom.h, lang = GymDom.lang;
  var STR = {
    fabLabel: ["Ask the nutrition coach", "اسأل مدرّب التغذية"],
    title: ["Nutrition & fitness chat", "دردشة التغذية واللياقة"],
    placeholder: ["Ask a quick question…", "اسأل سؤالاً سريعاً…"],
    genPlan: ["Want a full plan? Generate one", "تريد خطة كاملة؟ أنشئ واحدة"],
    signInBody: ["Sign in to chat with your AI coach.", "سجّل الدخول للدردشة مع مدرّبك الذكي."],
    thinking: ["Thinking…", "يفكّر…"],
    quota: ["You've reached today's chat limit. Try again after {t}.", "بلغت حد الدردشة اليومي. حاول بعد {t}."],
    quotaGeneric: ["You've reached today's chat limit. Try again tomorrow.", "بلغت حد الدردشة اليومي. حاول مجدداً غداً."],
    err: ["Couldn't reach the coach. Try again.", "تعذّر الوصول إلى المدرّب. حاول مرة أخرى."],
    retry: ["Retry", "أعد المحاولة"],
    refused: ["Let's keep this to nutrition & training — for anything medical, please see a professional.",
      "لنُبقِ الحديث عن التغذية والتمرين — لأي أمر طبي، يُرجى مراجعة مختص."]
  };
  var s = GymDom.makeT(STR);
  function fmt(t, params) { return t.replace(/\{(\w+)\}/g, function (_, k) { return params[k] != null ? params[k] : ""; }); }

  var TIPS = [
    ["Protein at every meal helps curb cravings and preserves muscle in a deficit.", "تناول بروتين في كل وجبة يقلّل الرغبة الشديدة في الطعام ويحافظ على العضلات أثناء نقص السعرات."],
    ["Aim for 7–9 hours of sleep — recovery drives most of your progress.", "احرص على 7-9 ساعات نوم — الاستشفاء هو محرك معظم تقدّمك."],
    ["Progressive overload beats a perfect program: add a little weight or a rep each week.", "الزيادة التدريجية أهم من برنامج مثالي: أضف وزناً أو تكراراً بسيطاً كل أسبوع."],
    ["Hydration affects strength and focus — sip water through the day, not just at the gym.", "الترطيب يؤثر على القوة والتركيز — اشرب الماء طوال اليوم لا فقط في الجيم."],
    ["A short walk after meals can help blood sugar and digestion.", "المشي القصير بعد الوجبات يساعد سكر الدم والهضم."],
    ["Fiber-rich carbs (oats, veggies, legumes) keep you fuller for the same calories.", "الكارب الغني بالألياف (شوفان، خضار، بقوليات) يشبعك أكثر بنفس عدد السعرات."],
    ["Consistency beats intensity — a doable plan you repeat wins over a perfect one you quit.", "الثبات أهم من الشدة — خطة قابلة للتنفيذ تكررها أفضل من خطة مثالية تتوقف عنها."],
    ["Warm up the specific lift, not just cardio — light sets of the first exercise reduce injury risk.", "سخّن للتمرين المحدد لا الكارديو فقط — مجموعات خفيفة من أول تمرين تقلّل خطر الإصابة."]
  ];

  function mascotIcon() {
    return window.EtqademMascot
      ? EtqademMascot.create({ tone: "on-primary" })
      : document.createElementNS("http://www.w3.org/2000/svg", "svg");
  }

  function loadJSON(k, fb) { try { return JSON.parse(localStorage.getItem(k)) || fb; } catch (e) { return fb; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function authToken() { return window.GymSync && GymSync.token ? GymSync.token() : null; }
  function isAuthed() { return window.GymUI && GymUI.isAuthed && GymUI.isAuthed(); }

  function fetchTimeout(url, opts) {
    opts = opts || {};
    var c = new AbortController();
    var timer = setTimeout(function () { c.abort(); }, CALL_TIMEOUT_MS);
    opts.signal = c.signal;
    return fetch(url, opts).finally(function () { clearTimeout(timer); });
  }

  // ---------------- state ----------------
  // One-time migration: keep the old transcript only when a session is cached
  // for this tab (it is that user's own); otherwise it may belong to a
  // previous account, so drop it.
  (function migrateHistory() {
    try {
      var old = localStorage.getItem(OLD_HIST_KEY);
      if (old === null) return;
      if (sessionStorage.getItem("gymauth_session") && localStorage.getItem(HIST_KEY) === null) {
        localStorage.setItem(HIST_KEY, old);
      }
      localStorage.removeItem(OLD_HIST_KEY);
    } catch (e) {}
  })();
  var history = loadJSON(HIST_KEY, []); // [{role:'user'|'assistant', content}]
  var open = false;
  var sending = false;
  var tipTimer = null;
  var tipHideTimer = null;

  var fab, fabTip, chat, backdrop, closeBtn, msgsEl, announceEl, form, input, sendBtn, iconHost, titleEl;

  function els() {
    fab = document.getElementById("coachFab");
    fabTip = document.getElementById("coachFabTip");
    chat = document.getElementById("coachChat");
    backdrop = document.getElementById("coachChatBackdrop");
    closeBtn = document.getElementById("coachChatClose");
    msgsEl = document.getElementById("coachChatMsgs");
    announceEl = document.getElementById("coachChatAnnounce");
    form = document.getElementById("coachChatForm");
    input = document.getElementById("coachChatInput");
    sendBtn = document.getElementById("coachChatSend");
    iconHost = document.getElementById("coachChatIcon");
    titleEl = document.getElementById("coachChatTitle");
    return !!(fab && chat && form && input);
  }

  // Only steals focus back when the chat is still open AND the input was
  // the thing focused when the request that led here was sent — otherwise
  // this fires after the user has already closed the chat, tapped away, or
  // scrolled elsewhere, and yanking focus back to the input is jarring.
  // Also skipped entirely on coarse-pointer (touch) devices: programmatic
  // focus() there pops the on-screen keyboard back up mid-conversation,
  // which is worse than just leaving focus where the user left it.
  function isCoarsePointer() {
    try { return window.matchMedia && window.matchMedia("(pointer: coarse)").matches; } catch (e) { return false; }
  }
  function refocusInput(wasFocused) {
    if (!open || !wasFocused || isCoarsePointer()) return;
    try { input.focus({ preventScroll: true }); } catch (e) {}
  }

  function prefersReducedMotion() {
    try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }

  // Client-side typewriter for assistant replies (the backend returns the
  // full reply in one shot, it doesn't stream). Reveals `fullText` into
  // `el` a chunk at a time; speed adapts to length so a long reply doesn't
  // take forever. A click/tap on the bubble (or reduced-motion) jumps
  // straight to the full text. The screen-reader announcement is written
  // once, up front, into a separate aria-live region — NOT per character —
  // so assistive tech reads the reply once instead of once per glyph.
  // Tracks the in-progress typewriter's own finish()/cancel function (there
  // is ever at most one running — a new reply or a chat close must stop the
  // previous one) so closeChat() and the next sendMessage() can cut it off
  // instead of leaving its setInterval ticking pointlessly in the
  // background (harmless-but-wasteful while closed, and a visible
  // double-type glitch if it's still running into the next reply).
  var activeTypewriterCancel = null;
  function typeWriterReply(el, fullText) {
    if (activeTypewriterCancel) { activeTypewriterCancel(); activeTypewriterCancel = null; }
    if (announceEl) announceEl.textContent = fullText;
    if (prefersReducedMotion() || !fullText) {
      el.textContent = fullText;
      return;
    }
    var len = fullText.length;
    var totalMs = Math.min(1800, Math.max(300, len * 10)); // adaptive: fast for long replies, still visible for short ones
    var charsPerTick = Math.max(1, Math.ceil(len / (totalMs / 24))); // ~24ms ticks
    var i = 0;
    var timer = null;
    var finish = function () {
      if (timer == null) return;
      clearInterval(timer);
      timer = null;
      el.textContent = fullText;
      el.removeEventListener("click", finish);
      if (activeTypewriterCancel === finish) activeTypewriterCancel = null;
    };
    el.classList.add("coach-chat-msg-typing-tap");
    el.addEventListener("click", finish);
    activeTypewriterCancel = finish;
    timer = setInterval(function () {
      i += charsPerTick;
      if (i >= len) { finish(); return; }
      el.textContent = fullText.slice(0, i);
      scrollToBottom();
    }, 24);
  }

  // ---------------- timer-aware visibility ----------------
  // The FAB stays out of the way while a rest timer is actively shown —
  // #timerBar / #miniTimer already occupy that same bottom area.
  function timerActive() {
    var tb = document.getElementById("timerBar");
    var mt = document.getElementById("miniTimer");
    return !!((tb && tb.classList.contains("show")) || (mt && mt.classList.contains("show")));
  }
  function refreshFabVisibility() {
    if (!fab) return;
    var hide = open || timerActive() || document.body.classList.contains("onboarding-open");
    fab.hidden = hide;
    if (hide && fabTip) hideTip();
  }
  function watchTimers() {
    ["timerBar", "miniTimer"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !window.MutationObserver) return;
      new MutationObserver(refreshFabVisibility).observe(el, { attributes: true, attributeFilter: ["class"] });
    });
  }

  // ---------------- idle tips ----------------
  function showTip() {
    if (open || !fab || fab.hidden || !fabTip) return;
    var pick = TIPS[Math.floor(Math.random() * TIPS.length)];
    fabTip.textContent = pick[lang() === "ar" ? 1 : 0];
    fabTip.hidden = false;
    requestAnimationFrame(function () { fabTip.classList.add("show"); });
    if (tipHideTimer) clearTimeout(tipHideTimer);
    tipHideTimer = setTimeout(hideTip, TIP_SHOW_MS);
  }
  function hideTip() {
    if (!fabTip) return;
    fabTip.classList.remove("show");
    setTimeout(function () { if (!fabTip.classList.contains("show")) fabTip.hidden = true; }, 220);
  }
  // A mouse hovering the tip means the user is mid-read — pause the auto-hide
  // countdown entirely while hovered (no fixed cap: read at your own pace)
  // and only resume dismissing it a moment after the cursor actually leaves.
  function pauseTipHide() {
    if (tipHideTimer) { clearTimeout(tipHideTimer); tipHideTimer = null; }
  }
  function resumeTipHide() {
    if (tipHideTimer) clearTimeout(tipHideTimer);
    tipHideTimer = setTimeout(hideTip, TIP_LEAVE_MS);
  }
  function startTipCycle() {
    setTimeout(function () {
      showTip();
      tipTimer = setInterval(showTip, TIP_INTERVAL_MS);
    }, TIP_FIRST_MS);
  }

  // ---------------- drawer ----------------
  function renderStatic() {
    titleEl.textContent = s("title");
    iconHost.appendChild(mascotIcon());
    input.placeholder = s("placeholder");
    fab.setAttribute("aria-label", s("fabLabel"));
    fab.innerHTML = "";
    fab.appendChild(mascotIcon());
  }

  function bubble(role, text) {
    return h("div", { class: "coach-chat-msg " + role }, text);
  }
  function systemBubble(text, opts) {
    opts = opts || {};
    var kids = [text];
    if (opts.retry) {
      kids.push(h("button", { type: "button", class: "coach-chat-retry", on: { click: opts.retry } }, s("retry")));
    }
    return h.apply(null, ["div", { class: "coach-chat-msg system" }].concat(kids));
  }
  function typingBubble() {
    return h("div", { class: "coach-chat-msg assistant typing", id: "coachChatTyping" },
      h("span", {}), h("span", {}), h("span", {}));
  }

  function goToCoachForm() {
    closeChat();
    if (window.GymUI && GymUI.navigate) GymUI.navigate("coach");
    if (window.GymCoach && typeof GymCoach.newAssessment === "function") GymCoach.newAssessment();
  }

  function renderHistory() {
    msgsEl.innerHTML = "";
    if (!history.length) {
      msgsEl.appendChild(h("div", { class: "coach-chat-empty" },
        h("p", {}, s("placeholder")),
        h("button", { type: "button", class: "coach-link", on: { click: goToCoachForm } }, s("genPlan"))));
    }
    history.forEach(function (m) { msgsEl.appendChild(bubble(m.role, m.content)); });
    scrollToBottom();
  }
  function scrollToBottom() { try { msgsEl.scrollTop = msgsEl.scrollHeight; } catch (e) {} }

  function pushHistory(role, content) {
    history.push({ role: role, content: content });
    if (history.length > HIST_MAX) history = history.slice(history.length - HIST_MAX);
    saveJSON(HIST_KEY, history);
  }

  function openChat() {
    if (!isAuthed()) { if (window.GymUI) GymUI.promptSignIn(); return; }
    open = true;
    chat.hidden = false;
    requestAnimationFrame(function () { chat.classList.add("show"); });
    fab.setAttribute("aria-expanded", "true");
    refreshFabVisibility();
    renderHistory();
    setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }
  function closeChat() {
    open = false;
    if (activeTypewriterCancel) { activeTypewriterCancel(); activeTypewriterCancel = null; }
    chat.classList.remove("show");
    fab.setAttribute("aria-expanded", "false");
    setTimeout(function () { if (!open) chat.hidden = true; }, 220);
    refreshFabVisibility();
  }

  function setSending(v) {
    sending = v;
    sendBtn.disabled = v;
    input.disabled = v;
  }

  function sendMessage(text) {
    var token = authToken();
    if (!token) { if (window.GymUI) GymUI.promptSignIn(); return; }
    if (activeTypewriterCancel) { activeTypewriterCancel(); activeTypewriterCancel = null; } // this new send supersedes any still-typing previous reply
    var hadFocus = document.activeElement === input; // captured before setSending(true) below disables (and blurs) it
    pushHistory("user", text);
    msgsEl.querySelector(".coach-chat-empty") && (msgsEl.innerHTML = "");
    msgsEl.appendChild(bubble("user", text));
    scrollToBottom();
    setSending(true);
    msgsEl.appendChild(typingBubble());
    scrollToBottom();

    var recent = history.slice(-SEND_WINDOW).map(function (m) { return { role: m.role, content: m.content }; });
    var body = { lang: lang(), messages: recent };
    var profile = window.GymCoach && GymCoach.currentProfile ? GymCoach.currentProfile() : null;
    if (profile) body.profile = profile;
    var planSummary = window.GymCoach && GymCoach.planSummary ? GymCoach.planSummary() : "";
    if (planSummary) body.planSummary = planSummary;
    if (window.GymCoach && GymCoach.ramadan && GymCoach.ramadan()) body.ramadan = true; // omit when false: backend hash stays unchanged for normal plans

    fetchTimeout(ASSIST_BASE + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify(body)
    }).then(function (res) {
      var typing = document.getElementById("coachChatTyping");
      if (typing) typing.remove();
      if (res.status === 401) { setSending(false); if (window.GymUI) GymUI.promptSignIn(); return null; }
      if (res.status === 429) {
        // new Date(null) silently gives the Unix epoch, not a throw — an
        // absent/unreadable header must not render "Jan 1 1970".
        var reset = res.headers.get("X-RateLimit-Reset");
        var text = s("quotaGeneric");
        if (reset) {
          var d = new Date(reset);
          if (!isNaN(d.getTime())) text = fmt(s("quota"), { t: d.toLocaleString(lang() === "ar" ? "ar-EG" : "en-US") });
        }
        msgsEl.appendChild(systemBubble(text));
        scrollToBottom(); setSending(false); refocusInput(hadFocus);
        return null;
      }
      return res.json().then(function (b) { return { status: res.status, body: b }; })
        .catch(function () { return { status: res.status, body: null }; });
    }).then(function (r) {
      if (!r) return;
      setSending(false);
      var code = r.status === 403 && r.body && r.body.error && (r.body.error.code || r.body.error);
      if ((code === "account_blocked" || code === "account_removed") && window.GymHeader && GymHeader.onBlocked) GymHeader.onBlocked(code === "account_removed");
      if (r.status === 200 && r.body && r.body.reply) {
        pushHistory("assistant", r.body.reply);
        var replyEl = bubble("assistant", "");
        msgsEl.appendChild(replyEl);
        typeWriterReply(replyEl, r.body.reply);
        scrollToBottom();
      } else {
        if (window.console) console.warn("[chat] failed", r.status, r.body);
        msgsEl.appendChild(systemBubble(s("err"), { retry: function () { sendMessage(text); } }));
        scrollToBottom();
      }
      refocusInput(hadFocus);
    }).catch(function (err) {
      var typing = document.getElementById("coachChatTyping");
      if (typing) typing.remove();
      if (window.console) console.warn("[chat] error", err && err.message);
      setSending(false);
      msgsEl.appendChild(systemBubble(s("err"), { retry: function () { sendMessage(text); } }));
      scrollToBottom();
      refocusInput(hadFocus);
    });
  }

  function wire() {
    renderStatic();
    fab.addEventListener("click", function () {
      if (!isAuthed()) { if (window.GymUI) GymUI.promptSignIn(); return; }
      hideTip();
      openChat();
    });
    fabTip.addEventListener("click", function () {
      hideTip();
      if (!isAuthed()) { if (window.GymUI) GymUI.promptSignIn(); return; }
      openChat();
    });
    fabTip.addEventListener("mouseenter", pauseTipHide);
    fabTip.addEventListener("mouseleave", resumeTipHide);
    closeBtn.addEventListener("click", closeChat);
    backdrop.addEventListener("click", closeChat);
    document.addEventListener("keydown", function (e) { if (open && e.key === "Escape") closeChat(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) return;
      var v = (input.value || "").trim();
      if (!v) return;
      if (v.length > MSG_MAX) v = v.slice(0, MSG_MAX);
      input.value = "";
      sendMessage(v);
    });

    watchTimers();
    refreshFabVisibility();
    startTipCycle();

    document.addEventListener("gym:lang-changed", renderStatic);
    // Sign-out wipes the stored transcript (ui.js / sync.js, on a later tick):
    // re-read it so the previous user's messages leave memory and the DOM.
    document.addEventListener("gym:authchange", function (e) {
      if (e.detail) return;
      setTimeout(function () { history = loadJSON(HIST_KEY, []); renderHistory(); }, 0);
    });
  }

  function boot() {
    if (!els()) return;
    wire();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Lets other modules (the Coach tab's result screen) open the chat drawer
  // without needing to know anything about its internals.
  window.GymChat = { open: function () { openChat(); } };
})();
