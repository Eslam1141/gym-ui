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
  var API_ROOT = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var FOODS_URL = API_ROOT + "/foods";
  var MEALS_URL = API_ROOT + "/meals";
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
    note: ["AI coach powered by Anthropic (US). Not medical advice.", "المدرّب الذكي يعمل بتقنية Anthropic (الولايات المتحدة). ليس نصيحة طبية."],
    privacy: ["Privacy", "الخصوصية"],
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
    pmTitle: ["Add these to today's log?", "إضافة هذه إلى سجل اليوم؟"],
    pmMatching: ["Finding it in the food catalog…", "جارٍ البحث عنه في قائمة الأطعمة…"],
    pmNotFound: ["Not found in the catalog. Add it manually in Food.", "غير موجود في القائمة. أضفه يدوياً من تبويب الطعام."],
    pmAdd: ["Add selected", "أضف المحدد"],
    pmAdding: ["Adding…", "جارٍ الإضافة…"],
    pmGrams: ["Grams for {name}", "الجرامات لـ {name}"],
    pmFailed: ["Couldn't add {n}. Check the amounts and try again.", "تعذّرت إضافة {n}. راجع الكميات وحاول مرة أخرى."],
    pmDone: ["Added {n} to today's log", "تمت إضافة {n} إلى سجل اليوم"],
    pmNone: ["Tick at least one item first.", "حدّد عنصراً واحداً على الأقل أولاً."],
    kcal: ["kcal", "سعرة"],
    gram: ["g", "جم"],
    slotbreakfast: ["Breakfast", "فطار"], slotlunch: ["Lunch", "غداء"], slotdinner: ["Dinner", "عشاء"],
    slotsnack: ["Snack", "سناك"], slotsuhoor: ["Suhoor", "سحور"], slotiftar: ["Iftar", "إفطار"],
    photoBtn: ["Add a meal photo", "أضف صورة وجبة"],
    photoTake: ["Take photo", "التقاط صورة"],
    photoPick: ["Choose from gallery", "اختيار من المعرض"],
    photoChip: ["Meal photo ready. Add a note if you like, then send.", "صورة الوجبة جاهزة. أضف ملاحظة إن أردت ثم أرسل."],
    photoRemove: ["Remove photo", "إزالة الصورة"],
    photoNote: ["Optional: portion size, cooking method or ingredients", "اختياري: حجم الحصة أو طريقة الطهي أو المكوّنات"],
    photoNotice: ["Your photo goes to Anthropic (US) to estimate calories. We don't save it, and Anthropic normally deletes it within 30 days. Photograph only your food: keep people, faces (especially children), medicines and documents out of the frame. Estimates can be well off, especially for oil, sauces and hidden ingredients.",
      "تُرسل صورتك إلى Anthropic (الولايات المتحدة) لتقدير السعرات الحرارية. لا نحتفظ بالصورة، وتحذفها Anthropic عادةً خلال 30 يومًا. صوّر طعامك فقط، وأبقِ الأشخاص والوجوه (خاصةً الأطفال) والأدوية والمستندات خارج الصورة. قد يختلف التقدير كثيرًا عن الواقع، خاصةً مع الزيوت والصلصات والمكوّنات غير الظاهرة."],
    photoTip: ["Sent to Anthropic (US) for an estimate; not saved by us. Food only, no people.", "تُرسل إلى Anthropic (الولايات المتحدة) للتقدير، ولا نحتفظ بها. الطعام فقط، من دون أشخاص."],
    photoFooter: ["Estimate from a photo. Check it before adding it to your log.", "تقدير من صورة؛ راجعه قبل إضافته إلى سجلك."],
    photoContinue: ["Continue", "متابعة"],
    photoCancel: ["Cancel", "إلغاء"],
    photoPlaceholder: ["📷 Meal photo", "📷 صورة وجبة"],
    photoAlt: ["Your meal photo", "صورة وجبتك"],
    photoAnalysing: ["Analysing your meal…", "جارٍ تحليل وجبتك…"],
    photoTotal: ["About {n} kcal", "حوالي {n} سعرة"],
    fitUnder: ["Under target", "أقل من هدفك"],
    fitUnderLeft: ["Under target, {n} kcal left", "أقل من هدفك، متبقي {n} سعرة"],
    fitOnTrack: ["On track", "على المسار"],
    fitOver: ["+{n} over", "+{n} زيادة"],
    fitOverGeneric: ["Over target", "أعلى من هدفك"],
    fitUnknown: ["Estimate only", "تقدير فقط"],
    photoNotFood: ["I couldn't see food in that photo. Try a closer shot.", "لم أستطع رؤية طعام في الصورة. جرّب لقطة أقرب."],
    photoLimit: ["You've used today's 5 meal photos. Try again tomorrow.", "استخدمت صور الوجبات الخمس المتاحة اليوم. حاول مجدداً غداً."],
    photoTooBig: ["That photo is too large. Try a smaller one.", "الصورة كبيرة جداً. جرّب صورة أصغر."],
    photoBadType: ["Use a JPEG, PNG or WebP photo.", "استخدم صورة بصيغة JPEG أو PNG أو WebP."],
    photoBadImg: ["Couldn't read that image. Try another photo.", "تعذّرت قراءة الصورة. جرّب صورة أخرى."],
    photoBusy: ["Meal analysis is unavailable right now. Try again in a bit.", "تحليل الوجبات غير متاح حالياً. حاول بعد قليل."],
    refused: ["Let's keep this to nutrition & training — for anything medical, please see a professional.",
      "لنُبقِ الحديث عن التغذية والتمرين — لأي أمر طبي، يُرجى مراجعة مختص."]
  };
  var s = GymDom.makeT(STR);
  var MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack", "suhoor", "iftar"]; // gym-be food.MealTypes
  var PM_MAX = 10;         // server cap on proposedMeals
  var FOOD_WAIT_MS = 4000; // never hold the chat request longer than this for the food brief
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
  var MEAL_PHOTO_ACK_KEY = "etq_mealphoto_ack";
  var PHOTO_IN_MAX = 15 * 1024 * 1024; // refuse absurd inputs before decoding
  var PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
  var pendingPhoto = null;   // { blob, url } chosen but not yet sent
  var thumbUrls = [];        // object URLs behind chat thumbnails; revoked when the thread is redrawn
  var history = loadJSON(HIST_KEY, []); // [{role:'user'|'assistant', content}]
  var open = false;
  var sending = false;
  var tipTimer = null;
  var tipHideTimer = null;

  var fab, fabTip, chat, backdrop, closeBtn, msgsEl, announceEl, form, input, sendBtn, iconHost, titleEl, noteEl;
  var photoBtn, photoMenu, photoTake, photoPick, photoCamera, photoGallery, photoChip, photoThumb, photoChipText, photoChipTip, photoRemove;
  var noticeEl, noticeText, noticeOk, noticeCancel, noticePolicy;

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
    noteEl = document.getElementById("coachChatNote");
    sendBtn = document.getElementById("coachChatSend");
    iconHost = document.getElementById("coachChatIcon");
    titleEl = document.getElementById("coachChatTitle");
    photoBtn = document.getElementById("coachPhotoBtn");
    photoMenu = document.getElementById("coachPhotoMenu");
    photoTake = document.getElementById("coachPhotoTake");
    photoPick = document.getElementById("coachPhotoPick");
    photoCamera = document.getElementById("coachPhotoCamera");
    photoGallery = document.getElementById("coachPhotoGallery");
    photoChip = document.getElementById("coachPhotoChip");
    photoThumb = document.getElementById("coachPhotoThumb");
    photoChipText = document.getElementById("coachPhotoChipText");
    photoChipTip = document.getElementById("coachPhotoChipTip");
    photoRemove = document.getElementById("coachPhotoRemove");
    noticeEl = document.getElementById("coachPhotoNotice");
    noticeText = document.getElementById("coachPhotoNoticeText");
    noticeOk = document.getElementById("coachPhotoNoticeOk");
    noticeCancel = document.getElementById("coachPhotoNoticeCancel");
    noticePolicy = document.getElementById("coachPhotoNoticePrivacy");
    return !!(fab && chat && form && input);
  }

  // The input is never disabled while a reply is pending (a disabled input
  // loses focus and Android closes the soft keyboard), and Send does not take
  // focus (see wire()). This is the safety net: if the input was focused when
  // the message was sent and the chat is still open, make sure it still is.
  function refocusInput(wasFocused) {
    if (!open || !wasFocused || document.activeElement === input) return;
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
    noteEl.textContent = s("note") + " ";
    noteEl.appendChild(GymDom.policyLink("ai-coach", s("privacy"), true));
    fab.setAttribute("aria-label", s("fabLabel"));
    fab.innerHTML = "";
    fab.appendChild(mascotIcon());
    photoBtn.setAttribute("aria-label", s("photoBtn"));
    photoTake.textContent = s("photoTake");
    photoPick.textContent = s("photoPick");
    photoRemove.setAttribute("aria-label", s("photoRemove"));
    photoChipText.textContent = s("photoChip");
    photoChipTip.textContent = s("photoTip");
    noticeText.textContent = s("photoNotice");
    noticePolicy.textContent = s("privacy");
    noticeOk.textContent = s("photoContinue");
    noticeCancel.textContent = s("photoCancel");
    if (pendingPhoto) input.placeholder = s("photoNote");
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

  function revokeThumbs() {
    thumbUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    thumbUrls = [];
  }
  function renderHistory() {
    revokeThumbs();
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
    // The AI Coach consent comes first; "Not now" leaves the chat closed.
    GymCoachConsent.ensure().then(function (ok) { if (ok) showChat(); });
  }
  function showChat() {
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
    closeMenu();
    if (activeTypewriterCancel) { activeTypewriterCancel(); activeTypewriterCancel = null; }
    chat.classList.remove("show");
    fab.setAttribute("aria-expanded", "false");
    setTimeout(function () { if (!open) chat.hidden = true; }, 320);   // after the panel's --dur-med slide-out
    refreshFabVisibility();
    // Hiding the panel would drop focus to <body>; hand it back to the opener.
    var ae = document.activeElement;
    if (!ae || ae === document.body || chat.contains(ae)) { try { fab.focus({ preventScroll: true }); } catch (e) {} }
  }

  function setSending(v) {
    sending = v;
    sendBtn.disabled = v; // submit is also ignored while sending; the input stays enabled so the keyboard stays up
  }

  function sendMessage(text) {
    var token = authToken();
    if (!token) { if (window.GymUI) GymUI.promptSignIn(); return; }
    if (activeTypewriterCancel) { activeTypewriterCancel(); activeTypewriterCancel = null; } // this new send supersedes any still-typing previous reply
    var hadFocus = document.activeElement === input;
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

    var foodP = window.GymFood && GymFood.foodToday ? GymFood.foodToday() : Promise.resolve("");
    var foodWait = new Promise(function (resolve) { setTimeout(function () { resolve(""); }, FOOD_WAIT_MS); });
    function post(payload) {
      if (!document.getElementById("coachChatTyping")) { msgsEl.appendChild(typingBubble()); scrollToBottom(); }
      return fetchTimeout(ASSIST_BASE + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify(payload)
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
      });
    }
    Promise.race([foodP, foodWait]).catch(function () { return ""; }).then(function (foodToday) {
      if (foodToday) body.foodToday = String(foodToday).slice(0, 2000);
      return GymCoachConsent.run(function () { return post(body); });
    }).then(function (r) {
      if (!r) { setSending(false); return; } // 401/429 already answered; "Not now" on a retry lands here too
      setSending(false);
      var code = r.status === 403 && r.body && r.body.error && (r.body.error.code || r.body.error);
      if ((code === "account_blocked" || code === "account_removed") && window.GymHeader && GymHeader.onBlocked) GymHeader.onBlocked(code === "account_removed");
      if (GymCoachConsent.isUnavailable(r)) {
        msgsEl.appendChild(systemBubble(GymCoachConsent.unavailableText(), { retry: function () { sendMessage(text); } }));
        scrollToBottom();
      } else if (r.status === 200 && r.body && r.body.reply) {
        pushHistory("assistant", r.body.reply);
        var replyEl = bubble("assistant", "");
        msgsEl.appendChild(replyEl);
        typeWriterReply(replyEl, r.body.reply);
        var card = proposedMealsCard(r.body.proposedMeals);
        if (card) msgsEl.appendChild(card);
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

  // ---------------- proposed meals (confirm card) ----------------
  // The coach only PROPOSES; nothing reaches the food log until the user taps
  // Add. All model text goes in through text nodes (GymDom.h), never innerHTML.
  function authHeaders(json) {
    var hd = { "Authorization": "Bearer " + authToken() };
    if (json) hd["Content-Type"] = "application/json";
    return hd;
  }
  function cleanProposals(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.slice(0, PM_MAX).forEach(function (p) {
      if (!p || typeof p.text !== "string" || !p.text.trim()) return;
      var grams = Math.round(Number(p.grams));
      var kcal = Math.round(Number(p.kcalApprox));
      out.push({
        text: p.text.trim().slice(0, 120),
        grams: grams >= 1 && grams <= 3000 ? grams : 100,
        kcal: kcal >= 0 ? kcal : 0,
        slot: MEAL_SLOTS.indexOf(p.slot) >= 0 ? p.slot : "snack"
      });
    });
    return out;
  }
  function searchQueries(text) {
    var plain = text.replace(/[\d.,/()\-+:;"'`~!?*]+/g, " ").replace(/\s+/g, " ").trim();
    var words = plain.split(" ").filter(Boolean);
    var qs = [plain.slice(0, 60)];
    if (words.length > 2) qs.push(words.slice(0, 2).join(" "));
    return qs.filter(function (q) { return q.length >= 2; });
  }
  // top catalog hit for the item text, or null
  function matchFood(text) {
    var qs = searchQueries(text);
    function next(i) {
      if (i >= qs.length) return Promise.resolve(null);
      return fetchTimeout(FOODS_URL + "?q=" + encodeURIComponent(qs[i]) + "&limit=1", { headers: authHeaders() })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (b) { return b && Array.isArray(b.foods) && b.foods[0] ? b.foods[0] : next(i + 1); });
    }
    return next(0).catch(function () { return null; });
  }
  function foodLabel(f) {
    var en = f.nameEn || "", ar = f.nameAr || "";
    return lang() === "ar" ? (ar || en) : (en || ar);
  }

  function proposedMealsCard(raw) {
    var items = cleanProposals(raw);
    if (!items.length) return null;
    var rows = [];
    var addBtn = h("button", { type: "button", class: "coach-chat-pm-add", disabled: "disabled" }, s("pmAdd"));
    var status = h("div", { class: "coach-chat-pm-status", role: "status", "aria-live": "polite" });
    var busy = false;

    function syncAdd() {
      addBtn.disabled = busy || !rows.some(function (r) { return r.food && r.check.checked; });
    }

    items.forEach(function (it, idx) {
      var row = { it: it, food: null, done: false };
      row.check = h("input", { type: "checkbox", disabled: "disabled", id: "pm-c-" + idx });
      row.grams = h("input", {
        type: "number", inputmode: "numeric", min: "1", max: "3000", step: "1", value: String(it.grams),
        class: "coach-chat-pm-grams", disabled: "disabled", "aria-label": fmt(s("pmGrams"), { name: it.text })
      });
      row.kcal = h("span", { class: "coach-chat-pm-kcal" });
      row.note = h("span", { class: "coach-chat-pm-note" }, s("pmMatching"));
      row.el = h("li", { class: "coach-chat-pm-item is-pending" },
        row.check,
        h("label", { class: "coach-chat-pm-main", for: "pm-c-" + idx },
          h("span", { class: "coach-chat-pm-text" }, it.text),
          h("span", { class: "coach-chat-pm-meta" }, s("slot" + it.slot) + "  ·  ", row.kcal),
          row.note),
        h("span", { class: "coach-chat-pm-gwrap" }, row.grams, h("span", { "aria-hidden": "true" }, s("gram"))));
      function paintKcal() {
        var g = Number(row.grams.value);
        var k = g > 0 ? Math.round(it.kcal * g / it.grams) : it.kcal;
        row.kcal.textContent = k + " " + s("kcal");
      }
      paintKcal();
      row.grams.addEventListener("input", paintKcal);
      row.check.addEventListener("change", syncAdd);
      rows.push(row);
    });

    var card = h("div", { class: "coach-chat-pm", role: "group", "aria-label": s("pmTitle") },
      h("div", { class: "coach-chat-pm-title" }, s("pmTitle")),
      h.apply(null, ["ul", { class: "coach-chat-pm-list" }].concat(rows.map(function (r) { return r.el; }))),
      status, addBtn);

    rows.forEach(function (row) {
      matchFood(row.it.text).then(function (food) {
        row.el.classList.remove("is-pending");
        if (!food) {
          row.el.classList.add("is-missing");
          row.note.textContent = s("pmNotFound");
          return;
        }
        row.food = food;
        row.note.textContent = foodLabel(food);
        row.check.disabled = false; row.check.checked = true;
        row.grams.disabled = false;
        syncAdd();
      });
    });

    function addSelected() {
      if (busy) return;
      var picked = rows.filter(function (r) { return r.food && r.check.checked && !r.done; });
      if (!picked.length) { status.textContent = s("pmNone"); return; }
      for (var i = 0; i < picked.length; i++) {
        var g = Number(picked[i].grams.value);
        if (!(g >= 1 && g <= 3000)) { picked[i].grams.focus(); status.textContent = fmt(s("pmFailed"), { n: picked[i].it.text }); return; }
      }
      busy = true; syncAdd();
      addBtn.textContent = s("pmAdding");
      status.textContent = "";
      var date = window.GymDate ? GymDate.key(0) : new Date().toISOString().slice(0, 10);
      var ok = 0, failed = [];
      picked.reduce(function (chain, row) {
        return chain.then(function () {
          return fetchTimeout(MEALS_URL, {
            method: "POST", headers: authHeaders(true),
            body: JSON.stringify({ date: date, mealType: row.it.slot, foodId: row.food.id, grams: Number(row.grams.value) })
          }).then(function (res) {
            if (res.status === 401) { if (window.GymUI) GymUI.promptSignIn(); throw new Error("401"); }
            if (!res.ok) throw new Error("meals " + res.status);
            ok++; row.done = true;
            row.check.checked = false; row.check.disabled = true; row.grams.disabled = true;
            row.el.classList.add("is-done");
          }).catch(function (e) { if (!(e && e.message === "401")) failed.push(row.it.text); });
        });
      }, Promise.resolve()).then(function () {
        busy = false;
        addBtn.textContent = s("pmAdd");
        syncAdd();
        if (ok) {
          if (window.GymFood && GymFood.reload) GymFood.reload();
          if (window.GymToast) GymToast.show({ message: fmt(s("pmDone"), { n: ok }) });
        }
        status.textContent = failed.length ? fmt(s("pmFailed"), { n: failed.join(", ") }) : "";
      });
    }
    addBtn.addEventListener("click", addSelected);
    return card;
  }

  // ---------------- meal photo ----------------
  // Photo -> POST {ASSIST_BASE}/meal-photo (multipart). The image is re-encoded
  // in the browser first (coach.js downscaleImage: <=1568px JPEG, no EXIF/GPS,
  // <=900 KB). The thumbnail in the thread is an object URL and is never
  // persisted: history keeps only a text placeholder.
  function closeMenu() {
    if (!photoMenu || photoMenu.hidden) return;
    photoMenu.hidden = true;
    photoBtn.setAttribute("aria-expanded", "false");
  }
  function hasCamera() {
    try { return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches); } catch (e) { return false; }
  }
  function clearPending() {
    if (pendingPhoto) { try { URL.revokeObjectURL(pendingPhoto.url); } catch (e) {} }
    pendingPhoto = null;
    photoChip.hidden = true;
    photoThumb.removeAttribute("src");
    input.placeholder = s("placeholder");
    noticeEl.hidden = true;
  }
  function photoError(key) {
    msgsEl.querySelector(".coach-chat-empty") && (msgsEl.innerHTML = "");
    msgsEl.appendChild(systemBubble(s(key)));
    scrollToBottom();
  }
  function onPhotoChosen(file) {
    if (!file) return;
    if (PHOTO_TYPES.indexOf(file.type) === -1) { photoError("photoBadType"); return; }
    if (file.size > PHOTO_IN_MAX) { photoError("photoTooBig"); return; }
    if (!window.GymCoach || !GymCoach.downscaleImage) { photoError("photoBadImg"); return; }
    GymCoach.downscaleImage(file).then(function (blob) {
      clearPending();
      pendingPhoto = { blob: blob, url: URL.createObjectURL(blob) };
      photoThumb.src = pendingPhoto.url;
      photoChip.hidden = false;
      input.placeholder = s("photoNote");
      try { input.focus({ preventScroll: true }); } catch (e) {}
    }, function (err) { photoError(err && err.message === "toobig" ? "photoTooBig" : "photoBadImg"); });
  }
  function wirePhoto() {
    photoBtn.addEventListener("click", function () {
      if (!isAuthed()) { if (window.GymUI) GymUI.promptSignIn(); return; }
      if (!hasCamera()) { photoGallery.click(); return; } // no camera to offer: one picker, no menu
      var showing = photoMenu.hidden;
      photoMenu.hidden = !showing;
      photoBtn.setAttribute("aria-expanded", showing ? "true" : "false");
      if (showing) photoTake.focus();
    });
    photoTake.addEventListener("click", function () { closeMenu(); photoCamera.click(); });
    photoPick.addEventListener("click", function () { closeMenu(); photoGallery.click(); });
    [photoCamera, photoGallery].forEach(function (inp) {
      inp.addEventListener("change", function () {
        var f = inp.files && inp.files[0];
        inp.value = ""; // choosing the same photo again must still fire change
        onPhotoChosen(f);
      });
    });
    photoRemove.addEventListener("click", clearPending);
    document.addEventListener("click", function (e) {
      if (!photoMenu.hidden && !photoMenu.contains(e.target) && !photoBtn.contains(e.target)) closeMenu();
    });
    noticeCancel.addEventListener("click", function () { noticeEl.hidden = true; });
    noticeOk.addEventListener("click", function () {
      try { localStorage.setItem(MEAL_PHOTO_ACK_KEY, "1"); } catch (e) {}
      noticeEl.hidden = true;
      sendPendingPhoto();
    });
  }
  function photoAcked() {
    try { return localStorage.getItem(MEAL_PHOTO_ACK_KEY) === "1"; } catch (e) { return false; }
  }
  function requestPhotoSend() {
    if (!authToken()) { if (window.GymUI) GymUI.promptSignIn(); return; }
    // The AI Coach consent sheet comes first; the photo notice follows once.
    GymCoachConsent.ensure().then(function (ok) {
      if (!ok) return;
      if (!photoAcked()) { noticeEl.hidden = false; noticeOk.focus(); return; }
      sendPendingPhoto();
    });
  }
  function sendPendingPhoto() {
    if (!pendingPhoto || sending) return;
    var photo = pendingPhoto.blob;
    var note = (input.value || "").trim().slice(0, 300);
    input.value = "";
    clearPending();
    sendPhoto(photo, note);
  }
  function fitBadge(r) {
    var left = typeof r.remainingKcal === "number" ? Math.round(r.remainingKcal) : null;
    if (r.fits === "under") return { cls: "under", text: left > 0 ? fmt(s("fitUnderLeft"), { n: left }) : s("fitUnder") };
    if (r.fits === "on_track") return { cls: "on_track", text: s("fitOnTrack") };
    if (r.fits === "over") return { cls: "over", text: left != null && left < 0 ? fmt(s("fitOver"), { n: -left }) : s("fitOverGeneric") };
    return { cls: "unknown", text: s("fitUnknown") };
  }
  function summaryRow(r) {
    var total = Math.round(Number(r.totalKcal));
    if (!(total >= 0)) return null;
    var fit = fitBadge(r);
    return h("div", { class: "coach-mp-sum" },
      h("span", { class: "coach-mp-total" }, fmt(s("photoTotal"), { n: total })),
      h("span", { class: "coach-mp-fit " + fit.cls }, fit.text));
  }
  function photoBubble(blob, note) {
    var url = URL.createObjectURL(blob);
    thumbUrls.push(url);
    return h("div", { class: "coach-chat-msg user has-photo" },
      h("img", { src: url, alt: s("photoAlt") }),
      note ? h("div", { class: "coach-chat-photo-note" }, note) : null);
  }
  function sendPhoto(blob, note) {
    var token = authToken();
    if (!token) { if (window.GymUI) GymUI.promptSignIn(); return; }
    if (activeTypewriterCancel) { activeTypewriterCancel(); activeTypewriterCancel = null; }
    var hadFocus = document.activeElement === input;
    pushHistory("user", s("photoPlaceholder") + (note ? " - " + note : ""));
    msgsEl.querySelector(".coach-chat-empty") && (msgsEl.innerHTML = "");
    msgsEl.appendChild(photoBubble(blob, note));
    setSending(true);
    var wait = typingBubble();
    wait.setAttribute("role", "status");
    wait.appendChild(h("span", { class: "sr-only" }, s("photoAnalysing")));
    msgsEl.appendChild(wait);
    scrollToBottom();

    // Only two numbers go with the photo (today's target and kcal eaten), never plan or food text.
    var kcalP = window.GymFood && GymFood.mealKcal ? GymFood.mealKcal() : Promise.resolve({});
    var kcalWait = new Promise(function (resolve) { setTimeout(function () { resolve({}); }, FOOD_WAIT_MS); });
    function done() { var t = document.getElementById("coachChatTyping"); if (t) t.remove(); setSending(false); refocusInput(hadFocus); }
    function fail(key, retryable) {
      done();
      msgsEl.appendChild(systemBubble(s(key), retryable ? { retry: function () { sendPhoto(blob, note); } } : undefined));
      scrollToBottom();
    }
    function post(kcal) {
      if (!document.getElementById("coachChatTyping")) { msgsEl.appendChild(wait); scrollToBottom(); }
      var fd = new FormData();
      fd.append("image", blob, "meal.jpg");
      fd.append("lang", lang());
      if (note) fd.append("note", note);
      if (kcal && kcal.targetKcal != null) fd.append("targetKcal", String(kcal.targetKcal));
      if (kcal && kcal.eatenKcal != null) fd.append("eatenKcal", String(kcal.eatenKcal));
      return fetchTimeout(ASSIST_BASE + "/meal-photo", { method: "POST", headers: { "Authorization": "Bearer " + token }, body: fd })
        .then(function (res) {
          return res.json().catch(function () { return null; }).then(function (b) { return { status: res.status, body: b }; });
        });
    }
    Promise.race([kcalP, kcalWait]).catch(function () { return {}; }).then(function (kcal) {
      // A 403 consent_required (consent withdrawn elsewhere) asks again, then sends once more.
      return GymCoachConsent.run(function () { return post(kcal); });
    }).then(function (r) {
      if (!r) { done(); return; } // "Not now" on the consent sheet
      if (r.status === 401) { done(); if (window.GymUI) GymUI.promptSignIn(); return; }
      if (r.status === 200) {
        var b = r.body;
        if (!b || typeof b.reply !== "string" || !b.reply) { fail("err", true); return; }
        done();
        pushHistory("assistant", b.reply);
        var replyEl = bubble("assistant", "");
        msgsEl.appendChild(replyEl);
        typeWriterReply(replyEl, b.reply);
        var sum = summaryRow(b);
        if (sum) msgsEl.appendChild(sum);
        // The model only guesses the slot; the card has no slot picker, so use the user's local time of day like the food log does.
        var slot = window.GymFood && GymFood.guessMealType ? GymFood.guessMealType() : null;
        var card = proposedMealsCard(!slot || !Array.isArray(b.meals) ? b.meals : b.meals.map(function (m) { return m && typeof m === "object" ? Object.assign({}, m, { slot: slot }) : m; }));
        if (card) msgsEl.appendChild(card);
        msgsEl.appendChild(h("p", { class: "coach-mp-foot" }, s("photoFooter")));
        scrollToBottom();
        return;
      }
      if (GymCoachConsent.isUnavailable(r)) {
        done();
        msgsEl.appendChild(systemBubble(GymCoachConsent.unavailableText(), { retry: function () { sendPhoto(blob, note); } }));
        scrollToBottom();
        return;
      }
      var res = r;
      if (res.status === 422) fail("photoNotFood", false);
      else if (res.status === 429) fail("photoLimit", false);
      else if (res.status === 413) fail("photoTooBig", false);
      else if (res.status === 415) fail("photoBadType", false);
      else if (res.status === 503) fail("photoBusy", true);
      else fail("err", true);
    }).catch(function (err) {
      if (window.console) console.warn("[chat] meal photo error", err && err.message);
      fail("err", true);
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
    document.addEventListener("keydown", function (e) { if (open && e.key === "Escape") { if (!photoMenu.hidden) closeMenu(); else closeChat(); } });
    // Tapping Send must not move focus off the input, or the soft keyboard
    // closes. Only mousedown: preventDefault on touchstart/pointerdown would
    // also cancel the tap's click (Chrome sends mousedown before the click).
    sendBtn.addEventListener("mousedown", function (e) { e.preventDefault(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) return;
      var v = (input.value || "").trim();
      if (pendingPhoto) { requestPhotoSend(); return; }
      if (!v) return;
      if (v.length > MSG_MAX) v = v.slice(0, MSG_MAX);
      input.value = "";
      sendMessage(v);
    });

    wirePhoto();
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
