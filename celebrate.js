/* celebrate.js — the short "well done" moment after a finished training day
 * and after taking a rest day (~3 s card with the coach mascot, then it
 * dismisses itself; a tap or Escape closes it early). It never blocks the page:
 * only the card takes pointer events and there is no focus trap.
 *
 * API: GymCelebrate.day(dayId)  - training day just completed (fires at most
 *                                  once per date + dayId, remembered in
 *                                  localStorage under gymcel_done)
 *      GymCelebrate.rest()      - rest day just saved
 *
 * Streak copy uses GymHeader.me(): currentStreak, +1 while todayDone is still
 * false. Signed out, or no /me yet -> a generic line without a number. */
(function () {
  "use strict";

  var LS_DONE = "gymcel_done";
  var SHOW_MS = 3200;
  var BURST = 8;

  var host = null, card = null, live = null, textEl = null, stage = null;
  var timer = null;

  function str(key, params) {
    var out = typeof window.t === "function" ? window.t(key) : key;
    if (params) out = out.replace(/\{(\w+)\}/g, function (_, k) { return params[k] != null ? params[k] : ""; });
    return out;
  }
  function isAr() { return document.documentElement.lang === "ar"; }
  function num(n) { return n.toLocaleString(isAr() ? "ar-EG" : "en-US"); }
  function today() { return window.GymDate.key(); }

  // ---------------- once-per-day memory ----------------
  function readDone() {
    try {
      var v = JSON.parse(localStorage.getItem(LS_DONE));
      return v && v.date === today() && Array.isArray(v.ids) ? v : null;
    } catch (e) { return null; }
  }
  function claim(dayId) {
    var cur = readDone() || { date: today(), ids: [] };
    if (cur.ids.indexOf(dayId) !== -1) return false;
    cur.ids.push(dayId);
    try { localStorage.setItem(LS_DONE, JSON.stringify(cur)); } catch (e) {}
    return true;
  }

  // ---------------- copy ----------------
  function streakAfterToday() {
    if (!(window.GymSync && GymSync.isSignedIn && GymSync.isSignedIn())) return 0;
    var me = window.GymHeader && GymHeader.me && GymHeader.me();
    if (!me || typeof me.currentStreak !== "number") return 0;
    return me.currentStreak + (me.todayDone === false ? 1 : 0);
  }

  function trainingText(n) {
    if (n < 2) return str("celebDay1");
    if (n === 2) return str("celebDay2");
    if (n >= 7 && n % 7 === 0) {
      var w = n / 7;
      if (w === 1) return str("celebWeek1");
      if (w === 2) return str("celebWeek2");
      return str(w <= 10 ? "celebWeeks" : "celebWeeksMany", { w: num(w) });
    }
    return str(n <= 10 ? "celebHabit" : "celebHabitMany", { n: num(n) });
  }

  // ---------------- DOM ----------------
  function build() {
    if (host) return;
    host = document.createElement("div");
    host.className = "celebrate";
    // The polite live region carries the announcement; the visual card is
    // aria-hidden so the text is not read twice.
    live = document.createElement("p");
    live.className = "sr-only";
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    card = document.createElement("div");
    card.className = "celebrate-card";
    card.setAttribute("aria-hidden", "true");
    stage = document.createElement("div");
    stage.className = "celebrate-stage";
    textEl = document.createElement("p");
    textEl.className = "celebrate-text";
    card.appendChild(stage);
    card.appendChild(textEl);
    card.addEventListener("click", dismiss);
    host.appendChild(live);
    host.appendChild(card);
    document.body.appendChild(host);
  }

  function fillStage(kind) {
    stage.textContent = "";
    var ring = document.createElement("span");
    ring.className = "celebrate-ring";
    stage.appendChild(ring);
    if (kind === "day") {
      for (var i = 0; i < BURST; i++) {
        var dot = document.createElement("span");
        dot.className = "celebrate-dot";
        dot.style.setProperty("--a", (i * 360 / BURST) + "deg");
        stage.appendChild(dot);
      }
    }
    var m = window.EtqademMascot ? EtqademMascot.create({ size: 64 }) : document.createElement("span");
    m.classList.add("celebrate-mascot");
    stage.appendChild(m);
  }

  function onKey(e) { if (e.key === "Escape") dismiss(); }

  function dismiss() {
    if (!card || !card.classList.contains("show")) return;
    clearTimeout(timer);
    document.removeEventListener("keydown", onKey);
    card.classList.remove("show");
  }

  function show(kind, message) {
    build();
    clearTimeout(timer);
    card.classList.remove("show", "is-day", "is-rest");
    textEl.textContent = message;
    live.textContent = "";
    fillStage(kind);
    card.classList.add("is-" + kind);
    // Reflow so the entrance animation restarts if a card was still up.
    void card.offsetWidth;
    card.classList.add("show");
    live.textContent = message;
    document.addEventListener("keydown", onKey);
    timer = setTimeout(dismiss, SHOW_MS);
  }

  function day(dayId) {
    if (!claim(dayId || "day")) return;
    show("day", trainingText(streakAfterToday()));
    try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {}
  }

  function rest() { show("rest", str("celebRest")); }

  window.GymCelebrate = { day: day, rest: rest };
})();
