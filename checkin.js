/* checkin.js — Weekly check-in widget + form (Batch B4).
 *
 * A small card that lives inside #coachBody, hooked in by two lines in
 * coach.js's renderForm()/renderResult() (GymCheckin.renderCard()). Mirrors
 * coach.js/food.js's shape: its own tiny i18n table (h/lang/s from dom.js), reads
 * window.GymSync.token()/window.GYM_API_BASE the same way coach.js does,
 * and hands off to coach.js's own screens (window.GymCoach.showResult /
 * .newAssessment / .refresh) instead of duplicating the result renderer.
 *
 * API: gym-assistant POST /assistant/checkin + GET /assistant/checkin/status
 * (gym-assistant docs/superpowers/plans/2026-09-27-weekly-checkins.md,
 * merged in gym-assistant PR #17/#19). Must load BEFORE coach.js (see
 * index.html) — coach.js's own refresh() can run synchronously as soon as
 * its script executes and calls window.GymCheckin.renderCard() right away.
 */
(function () {
  "use strict";

  var ASSIST_BASE = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "") + "/assistant";
  var STATUS_URL = ASSIST_BASE + "/checkin/status";
  var CHECKIN_URL = ASSIST_BASE + "/checkin";
  // Shared with coach.js's own LAST_KEY (its header comment already documents
  // this exact key as a stable, deliberately-not-gym_-prefixed local cache
  // that other files may read/write directly instead of importing coach.js).
  var LAST_KEY = "gymcoach_last";
  // The check-in call triggers the same model call as /assessment — reuse
  // coach.js's outer timeout so a slow-but-alive backend isn't aborted early.
  var CALL_TIMEOUT_MS = 85000;
  var STATUS_TIMEOUT_MS = 15000;
  var STATUS_TTL_MS = 30000;

  // ---------------- i18n ----------------
  if (!window.GymDom) throw new Error("checkin.js: dom.js must load first");
  var h = GymDom.h, lang = GymDom.lang;
  var STR = {
    cardTitle: ["Weekly check-in", "تسجيل أسبوعي"],
    dueBody: ["How did this week go? A quick check-in adjusts next week's plan.",
      "كيف كان أسبوعك؟ تسجيل سريع يعدّل خطة الأسبوع القادم."],
    dueBtn: ["Check in", "سجّل الآن"],
    doneTick: ["Checked in ✓", "تم التسجيل ✓"],
    doneBody: ["This week's check-in is done. The next one opens Monday.",
      "تم تسجيل هذا الأسبوع. يفتح التسجيل التالي يوم الاثنين."],
    needsBaselineTitle: ["Weekly check-in", "تسجيل أسبوعي"],
    needsBaselineBody: ["Build your first plan to unlock weekly check-ins.",
      "أنشئ خطتك الأولى لتفتح ميزة التسجيل الأسبوعي."],
    needsBaselineBtn: ["Build my plan", "أنشئ خطتي"],
    weightKg: ["Weight", "الوزن"], kg: ["kg", "كجم"],
    adherencePct: ["Adherence", "الالتزام"],
    adherenceHint: ["% of this week's planned workouts/diet you followed", "% مما التزمت به من خطة التمرين/التغذية هذا الأسبوع"],
    energy: ["Energy", "الطاقة"], energyLow: ["Low", "منخفضة"], energyHigh: ["High", "عالية"],
    soreness: ["Soreness", "التعب العضلي"], sorenessLow: ["None", "معدوم"], sorenessHigh: ["Very sore", "شديد"],
    notes: ["Notes (optional)", "ملاحظات (اختياري)"],
    formTitle: ["Weekly check-in", "تسجيل أسبوعي"],
    formLegend: ["This week", "هذا الأسبوع"],
    submitBtn: ["Submit check-in", "أرسل التسجيل"],
    submitting: ["Updating your plan… this can take up to 30s", "جارٍ تحديث خطتك… قد يستغرق حتى 30 ثانية"],
    cancelBtn: ["Cancel", "إلغاء"],
    back: ["Back", "رجوع"],
    vRequired: ["Required", "مطلوب"],
    vRange: ["Enter {min}–{max}", "أدخل {min}–{max}"],
    vRangeU: ["Enter {min}–{max} {u}", "أدخل {min}–{max} {u}"],
    vNotesMax: ["Max 300 characters", "الحد الأقصى 300 حرف"],
    vFixTop: ["Fill the required fields to continue", "أكمل الحقول المطلوبة للمتابعة"],
    errTitle: ["Couldn't reach the coach", "تعذّر الوصول إلى المدرّب"],
    errBody: ["The coach service isn't responding right now. Please try again in a moment.",
      "خدمة المدرّب لا تستجيب حالياً. يرجى المحاولة بعد قليل."],
    err502: ["The AI service is temporarily unavailable. Please try again shortly.",
      "خدمة الذكاء الاصطناعي غير متاحة مؤقتاً. حاول بعد قليل."],
    retry: ["Try again", "أعد المحاولة"],
    alreadyTitle: ["Already checked in", "تم التسجيل مسبقاً"],
    alreadyBody: ["You already submitted this week's check-in. The next one opens {t}.",
      "لقد أرسلت تسجيل هذا الأسبوع بالفعل. يفتح التسجيل التالي في {t}."],
    alreadyBodyGeneric: ["You already submitted this week's check-in. The next one opens next Monday.",
      "لقد أرسلت تسجيل هذا الأسبوع بالفعل. يفتح التسجيل التالي يوم الاثنين القادم."],
    quotaTitle: ["Daily limit reached", "بلغت الحد اليومي"],
    quotaBody: ["You've used today's assessments. Try again after {t}.", "لقد استخدمت تقييمات اليوم. حاول مجدداً بعد {t}."],
    quotaBodyGeneric: ["You've used today's assessments. Try again tomorrow.", "لقد استخدمت تقييمات اليوم. حاول مجدداً غداً."],
    refusedTitle: ["Let's keep this safe", "لنُبقِ الأمر آمناً"]
  };
  var s = GymDom.makeT(STR);
  function msg(entry) {
    if (!entry) return "";
    var t = s(entry[0]), p = entry[1] || {};
    return t.replace(/\{(\w+)\}/g, function (_, k) { return p[k] != null ? p[k] : ""; });
  }

  function mount(el) {
    var body = document.getElementById("coachBody");
    if (!body) return;
    body.innerHTML = "";
    body.appendChild(el);
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  // ---------------- network ----------------
  function authToken() {
    return window.GymSync && GymSync.token ? GymSync.token() : null;
  }
  function fetchTimeout(url, opts, ms) {
    opts = opts || {};
    var c = new AbortController();
    var timer = setTimeout(function () { c.abort(); }, ms || CALL_TIMEOUT_MS);
    opts.signal = c.signal;
    return fetch(url, opts).finally(function () { clearTimeout(timer); });
  }

  // ---------------- status (due / done / needs-baseline) ----------------
  // Cached briefly so re-rendering the coach screen (e.g. after a tab
  // switch) doesn't re-hit the network every time; invalidated immediately
  // after a successful/already-submitted response so the card never shows
  // stale "due" right after the user just checked in.
  var cachedStatus = null, cachedAt = 0, statusPromise = null;
  function fetchStatus() {
    var token = authToken();
    if (!token) return Promise.resolve(null);
    var now = Date.now();
    if (cachedStatus && (now - cachedAt) < STATUS_TTL_MS) return Promise.resolve(cachedStatus);
    if (statusPromise) return statusPromise;
    statusPromise = fetchTimeout(STATUS_URL, { headers: { "Authorization": "Bearer " + token } }, STATUS_TIMEOUT_MS)
      .then(function (res) {
        if (res.status === 401 || !res.ok) return undefined; // "couldn't load" — never cached
        return res.json().catch(function () { return undefined; });
      })
      .catch(function () { return undefined; })
      .then(function (body) {
        statusPromise = null;
        if (body !== undefined) { cachedStatus = body; cachedAt = Date.now(); }
        return body;
      });
    return statusPromise;
  }
  function setCachedStatus(patch) {
    cachedStatus = Object.assign({}, cachedStatus, patch);
    cachedAt = Date.now();
  }
  function hasLocalBaseline() {
    try { return !!localStorage.getItem(LAST_KEY); } catch (e) { return false; }
  }

  // ---------------- card ----------------
  function fillCard(el, kids) {
    el.innerHTML = "";
    kids.forEach(function (k) { if (k) el.appendChild(k); });
  }
  function cardKids(status) {
    if (!status.submitted && !status.latest && !hasLocalBaseline()) {
      return [
        h("div", { class: "checkin-card-head" }, h("h3", {}, s("needsBaselineTitle"))),
        h("p", { class: "checkin-card-body" }, s("needsBaselineBody")),
        h("button", {
          type: "button", class: "coach-secondary",
          on: { click: function () { if (window.GymCoach) GymCoach.newAssessment(); } }
        }, s("needsBaselineBtn"))
      ];
    }
    if (status.submitted) {
      var l = status.latest;
      var facts = [];
      if (l) {
        if (l.weightKg != null) facts.push(h("span", { class: "checkin-card-fact" }, s("weightKg") + ": " + round1(l.weightKg) + " " + s("kg")));
        if (l.adherencePct != null) facts.push(h("span", { class: "checkin-card-fact" }, s("adherencePct") + ": " + l.adherencePct + "%"));
      }
      return [
        h("div", { class: "checkin-card-head" },
          h("span", { class: "checkin-badge" }, s("doneTick")),
          h("h3", {}, s("cardTitle"))),
        h("p", { class: "checkin-card-body" }, s("doneBody")),
        facts.length ? h.apply(null, ["div", { class: "checkin-card-facts" }].concat(facts)) : null
      ];
    }
    return [
      h("div", { class: "checkin-card-head" }, h("h3", {}, s("cardTitle"))),
      h("p", { class: "checkin-card-body" }, s("dueBody")),
      h("button", { type: "button", class: "coach-primary", on: { click: openForm } }, s("dueBtn"))
    ];
  }
  function round1(v) { return Math.round((parseFloat(v) || 0) * 10) / 10; }

  // Called from coach.js's renderForm()/renderResult(). Returns a DOM node
  // (or null when signed out) that starts as a skeleton and fills itself in
  // once GET /checkin/status resolves — never blocks the caller's own mount().
  function renderCard() {
    if (!authToken()) return null;
    var el = h("div", { class: "checkin-card card-fx", "aria-live": "polite" },
      h("div", { class: "skeleton", style: "height:60px" }));
    fetchStatus().then(function (status) {
      if (!el.isConnected) return; // the screen moved on before this resolved
      if (!status) { el.remove(); return; } // offline/401/error: fail quiet, don't block the coach screen
      fillCard(el, cardKids(status));
    });
    return el;
  }

  // ---------------- form ----------------
  function numField(labelKey, name, opts) {
    var input = h("input", {
      type: "number", inputmode: opts.int ? "numeric" : "decimal", name: name,
      min: opts.min, max: opts.max, step: opts.step || (opts.int ? "1" : "0.1")
    });
    var lbl = h("span", { class: "coach-field-l" }, s(labelKey), h("span", { class: "req", "aria-hidden": "true" }, " *"));
    var fe = h("small", { class: "coach-fe", role: "alert", "data-fe": name });
    var wrap = h("label", { class: "coach-field", "data-field": name }, lbl, input, fe);
    if (opts.hint) wrap.appendChild(h("small", { class: "coach-hint" }, opts.hint));
    return { wrap: wrap, input: input };
  }
  function segField(labelKey, name, lowKey, highKey) {
    var seg = h("div", { class: "seg", role: "group", "aria-label": s(labelKey) });
    for (var i = 1; i <= 5; i++) {
      seg.appendChild(h("button", { type: "button", "data-val": String(i), "aria-pressed": "false" }, String(i)));
    }
    var lbl = h("span", { class: "coach-field-l" }, s(labelKey), h("span", { class: "req", "aria-hidden": "true" }, " *"));
    var hint = h("small", { class: "coach-hint" }, s(lowKey) + " → " + s(highKey));
    var fe = h("small", { class: "coach-fe", role: "alert", "data-fe": name });
    var wrap = h("div", { class: "coach-field", "data-field": name }, lbl, seg, hint, fe);
    return { wrap: wrap, seg: seg };
  }

  function openForm() {
    var st = { weightKg: "", adherencePct: "", energy: 0, soreness: 0, notes: "" };
    var form = h("form", { class: "coach-form", novalidate: "novalidate" });

    var weightF = numField("weightKg", "weightKg", { min: 35, max: 250, step: "0.1" });
    var adherenceF = numField("adherencePct", "adherencePct", { min: 0, max: 100, int: true, hint: s("adherenceHint") });
    var energyF = segField("energy", "energy", "energyLow", "energyHigh");
    var sorenessF = segField("soreness", "soreness", "sorenessLow", "sorenessHigh");
    var notesInput = h("textarea", { name: "notes", maxlength: "300", rows: "3" });
    var notesWrap = h("label", { class: "coach-field", "data-field": "notes" },
      h("span", { class: "coach-field-l" }, s("notes")), notesInput,
      h("small", { class: "coach-fe", role: "alert", "data-fe": "notes" }));

    function wireSeg(f, key) {
      f.seg.querySelectorAll("button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          st[key] = parseInt(btn.getAttribute("data-val"), 10);
          f.seg.querySelectorAll("button").forEach(function (b) {
            b.setAttribute("aria-pressed", b === btn ? "true" : "false");
          });
          refreshValidity();
        });
      });
    }
    wireSeg(energyF, "energy");
    wireSeg(sorenessF, "soreness");
    weightF.input.addEventListener("input", function () { st.weightKg = weightF.input.value; refreshValidity(); });
    adherenceF.input.addEventListener("input", function () { st.adherencePct = adherenceF.input.value; refreshValidity(); });
    notesInput.addEventListener("input", function () { st.notes = notesInput.value; refreshValidity(); });

    function validate() {
      var errors = {};
      var w = parseFloat(st.weightKg);
      if (st.weightKg === "" || isNaN(w)) errors.weightKg = ["vRequired"];
      else if (w < 35 || w > 250) errors.weightKg = ["vRangeU", { min: 35, max: 250, u: s("kg") }];
      var a = st.adherencePct === "" ? NaN : parseInt(st.adherencePct, 10);
      if (st.adherencePct === "" || isNaN(a)) errors.adherencePct = ["vRequired"];
      else if (a < 0 || a > 100) errors.adherencePct = ["vRange", { min: 0, max: 100 }];
      if (!st.energy) errors.energy = ["vRequired"];
      if (!st.soreness) errors.soreness = ["vRequired"];
      if (st.notes && st.notes.length > 300) errors.notes = ["vNotesMax"];
      return { ok: Object.keys(errors).length === 0, errors: errors };
    }
    function refreshValidity() {
      var v = validate();
      form.querySelectorAll("[data-field]").forEach(function (fEl) {
        var nm = fEl.getAttribute("data-field");
        var feEl = fEl.querySelector(".coach-fe");
        if (v.errors[nm]) { fEl.classList.add("bad"); if (feEl) feEl.textContent = msg(v.errors[nm]); }
        else { fEl.classList.remove("bad"); if (feEl) feEl.textContent = ""; }
      });
      return v.ok;
    }

    form.appendChild(h("fieldset", { class: "coach-group" },
      h("legend", {}, s("formLegend")),
      weightF.wrap, adherenceF.wrap, energyF.wrap, sorenessF.wrap, notesWrap));

    var topErr = h("p", { class: "coach-err", hidden: "hidden" }, s("vFixTop"));
    var cancel = h("button", {
      type: "button", class: "coach-secondary",
      on: { click: function () { if (window.GymCoach) GymCoach.refresh(); } }
    }, s("cancelBtn"));
    var submit = h("button", { type: "submit", class: "coach-primary" }, s("submitBtn"));
    form.appendChild(topErr);
    form.appendChild(h("div", { class: "coach-actions" }, cancel, submit));

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!refreshValidity()) {
        topErr.hidden = false;
        var firstBad = form.querySelector(".coach-field.bad");
        if (firstBad && firstBad.scrollIntoView) firstBad.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      topErr.hidden = true;
      submitCheckIn({
        lang: lang(),
        weightKg: parseFloat(st.weightKg),
        adherencePct: parseInt(st.adherencePct, 10),
        energy: st.energy,
        soreness: st.soreness,
        notes: st.notes || undefined,
        ramadan: (window.GymCoach && GymCoach.ramadan) ? GymCoach.ramadan() : false
      });
    });

    mount(h("div", {}, h("h2", { class: "checkin-form-title" }, s("formTitle")), form));
  }

  // ---------------- submit + result/error states ----------------
  function renderLoading() {
    mount(h("div", { class: "coach-loading" },
      h("div", { class: "coach-spin", "aria-hidden": "true" }),
      h("div", {}, s("submitting"))));
  }
  function stateScreen(titleKey, body, actions) {
    mount(h("div", { class: "coach-state card-fx" },
      h("h2", {}, s(titleKey)),
      h("p", {}, body),
      h.apply(null, ["div", { class: "coach-actions" }].concat(actions))));
  }
  function backBtn() {
    return h("button", { type: "button", class: "coach-secondary", on: { click: function () { if (window.GymCoach) GymCoach.refresh(); } } }, s("back"));
  }
  function resetBody(key, genericKey, resetIso) {
    if (resetIso) {
      var d = new Date(resetIso);
      if (!isNaN(d.getTime())) return msg([key, { t: d.toLocaleString(lang() === "ar" ? "ar-EG" : "en-US") }]);
    }
    return s(genericKey);
  }
  function renderRetry(bodyKey, reqBody) {
    stateScreen("errTitle", s(bodyKey), [
      h("button", { type: "button", class: "coach-primary", on: { click: function () { submitCheckIn(reqBody); } } }, s("retry")),
      backBtn()
    ]);
  }

  // One check-in request at a time (GymAct.once holds until the promise settles).
  var submitCheckIn = GymAct.once(function (reqBody) { return submitCheckInRaw(reqBody); });
  function submitCheckInRaw(reqBody) {
    var token = authToken();
    if (!token) { if (window.GymUI) GymUI.promptSignIn(); return; }
    renderLoading();
    return fetchTimeout(CHECKIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify(reqBody)
    }, CALL_TIMEOUT_MS).then(function (res) {
      if (res.status === 401) { if (window.GymUI) GymUI.promptSignIn(); return null; }
      var resetIso = res.headers.get("X-RateLimit-Reset");
      return res.json().catch(function () { return null; }).then(function (body) {
        return { status: res.status, body: body, reset: resetIso };
      });
    }).then(function (r) {
      if (!r) return;
      if (r.status === 200 && r.body) {
        try { localStorage.setItem(LAST_KEY, JSON.stringify(r.body)); } catch (e) {}
        setCachedStatus({
          submitted: true,
          latest: {
            weightKg: reqBody.weightKg, adherencePct: reqBody.adherencePct,
            energy: reqBody.energy, soreness: reqBody.soreness, notes: reqBody.notes || "",
            createdAt: new Date().toISOString(), resultId: r.body.id
          }
        });
        if (window.GymCoach && window.GymCoach.showResult) GymCoach.showResult(r.body);
        else stateScreen("cardTitle", s("doneBody"), [backBtn()]);
        return;
      }
      var code = r.body && r.body.error && r.body.error.code;
      if (r.status === 400 && code === "no_baseline") {
        stateScreen("needsBaselineTitle", s("needsBaselineBody"), [
          h("button", { type: "button", class: "coach-primary", on: { click: function () { if (window.GymCoach) GymCoach.newAssessment(); } } }, s("needsBaselineBtn")),
          backBtn()
        ]);
      } else if (r.status === 409) {
        setCachedStatus({ submitted: true });
        stateScreen("alreadyTitle", resetBody("alreadyBody", "alreadyBodyGeneric", r.reset), [backBtn()]);
      } else if (r.status === 422) {
        stateScreen("refusedTitle", (r.body && r.body.error && r.body.error.message) || s("errBody"), [backBtn()]);
      } else if (r.status === 429) {
        stateScreen("quotaTitle", resetBody("quotaBody", "quotaBodyGeneric", r.reset), [backBtn()]);
      } else if (r.status === 502) {
        renderRetry("err502", reqBody);
      } else {
        if (window.console) console.warn("[checkin] submit failed", r.status, r.body);
        renderRetry("errBody", reqBody);
      }
    }).catch(function (err) {
      if (window.console) console.warn("[checkin] submit error", err && err.message);
      renderRetry("errBody", reqBody);
    });
  }

  window.GymCheckin = { renderCard: renderCard };
})();
