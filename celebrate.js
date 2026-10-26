/* celebrate.js — the short "well done" moment after a finished training day
 * and after taking a rest day (~3 s card with the coach mascot, then it
 * dismisses itself; a tap or Escape closes it early). It never blocks the page:
 * only the card takes pointer events and there is no focus trap.
 *
 * API: GymCelebrate.day(dayId, opts) - training day just completed (fires at most
 *                                  once per date + dayId, remembered in
 *                                  localStorage under gymcel_done). opts.held: the
 *                                  day goes to review, so no streak number.
 *                                  opts.durationSec: how long it took (timer start
 *                                  to the last tick); adds "Finished in 42 min".
 *      GymCelebrate.rest()      - rest day just saved
 *
 * Streak copy uses GymHeader.me(): currentStreak, +1 while todayDone is still
 * false. Signed out, or no /me yet -> a generic line without a number. */
(function () {
  "use strict";

  var LS_DONE = "gymcel_done";
  var SHOW_MS = 3200;
  var BURST = 12;

  var host = null, card = null, live = null, textEl = null, stage = null, emojiEl = null;
  var timer = null;

  function str(key, params) {
    var out = typeof window.t === "function" ? window.t(key) : key;
    // Arabic addresses women in the feminine form on the female plan: an
    // optional "<key>F" string overrides the default one.
    if (isAr() && document.documentElement.dataset.plan === "female" && typeof window.t === "function") {
      var f = window.t(key + "F");
      if (f !== key + "F") out = f;
    }
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

  // Returns the message and the name of its icon (ICONS below).
  function trainingText(n) {
    if (n < 2) return { text: str("celebDay1"), emoji: "muscle" };
    if (n === 2) return { text: str("celebDay2"), emoji: "fire" };
    if (n >= 7 && n % 7 === 0) {
      var w = n / 7;
      if (w === 1) return { text: str("celebWeek1"), emoji: "trophy" };
      if (w === 2) return { text: str("celebWeek2"), emoji: "medal" };
      return { text: str(w <= 10 ? "celebWeeks" : "celebWeeksMany", { w: num(w) }), emoji: "crown" };
    }
    return n <= 10 ? { text: str("celebHabit", { n: num(n) }), emoji: "sprout" }
                   : { text: str("celebHabitMany", { n: num(n) }), emoji: "rocket" };
  }

  // Our own pictures for the streak line: flat 24x24 shapes in the app's colour
  // tokens (see .ci in motion.css for the motion). Decorative, one per name
  // returned by trainingText() plus "battery" for rest.
  var NS = "http://www.w3.org/2000/svg";
  var ICONS = {
    muscle:
      '<g class="ci-lift"><rect x="7" y="11" width="10" height="2" rx="1" fill="var(--ink)"/>' +
      '<rect x="3.5" y="7" width="3.5" height="10" rx="1.4" fill="var(--primary-text)"/>' +
      '<rect x="17" y="7" width="3.5" height="10" rx="1.4" fill="var(--primary-text)"/>' +
      '<rect x="1.5" y="9.5" width="2" height="5" rx="1" fill="var(--ink)"/>' +
      '<rect x="20.5" y="9.5" width="2" height="5" rx="1" fill="var(--ink)"/></g>',
    fire:
      '<g class="ci-flame"><path d="M12 2.5c.6 3-1.2 4.4-2.8 6.2C7.6 10.5 6 12.3 6 15a6 6 0 0 0 12 0c0-2.2-1-3.9-2.2-5.2-.3 1.2-.9 2-1.8 2.4.5-3.6-.6-7.7-2-9.7z" fill="var(--danger)"/>' +
      '<path class="ci-core" d="M12 21a3.3 3.3 0 0 1-3.3-3.3c0-1.7 1.2-2.6 2-3.8.4-.6.6-1.3.5-2 1.7 1.2 4.1 3.2 4.1 5.8A3.3 3.3 0 0 1 12 21z" fill="var(--warn)"/></g>',
    sprout:
      '<rect x="6" y="20" width="12" height="2" rx="1" fill="var(--line-strong)"/>' +
      '<g class="ci-grow"><path d="M12 20.5V11" stroke="var(--success-text)" stroke-width="2" stroke-linecap="round" fill="none"/>' +
      '<path class="ci-leaf-a" d="M12 12c0-4 2.5-6.5 7-6.5 0 4-2.5 6.5-7 6.5z" fill="var(--success-text)"/>' +
      '<path class="ci-leaf-b" d="M12 15c0-3-2-5-5.5-5 0 3 2 5 5.5 5z" fill="var(--success)"/></g>',
    rocket:
      '<g class="ci-fly"><path class="ci-puff" d="M10 17.5h4L12 22z" fill="var(--warn)"/>' +
      '<path d="M7.5 12.5 4.5 16v3l3-1.5zM16.5 12.5l3 3.5v3l-3-1.5z" fill="var(--primary-text)"/>' +
      '<path d="M12 2c3 2.6 4.5 6 4.5 9.5V16h-9v-4.5C7.5 8 9 4.6 12 2z" fill="var(--ink)"/>' +
      '<circle cx="12" cy="9.5" r="1.8" fill="var(--primary-text)"/></g>',
    trophy:
      '<g class="ci-cup"><path d="M7 5.5H4.5c0 3 1 4.5 3 5M17 5.5h2.5c0 3-1 4.5-3 5" stroke="var(--warn)" stroke-width="1.6" stroke-linecap="round" fill="none"/>' +
      '<path d="M7 3.5h10v6a5 5 0 0 1-10 0z" fill="var(--warn)"/>' +
      '<path class="ci-shine" d="M9.5 5.5v3.5" stroke="var(--surface)" stroke-width="1.4" stroke-linecap="round" opacity=".45"/>' +
      '<rect x="11" y="14" width="2" height="3.2" fill="var(--warn)"/>' +
      '<rect x="8" y="17" width="8" height="3" rx="1.2" fill="var(--warn)"/></g>',
    medal:
      '<g class="ci-swing"><path d="M7.5 2h4l2 6.5-4 .5zM16.5 2h-4l-2 6.5 4 .5z" fill="var(--primary-text)"/>' +
      '<circle cx="12" cy="15" r="6.2" fill="var(--warn)"/>' +
      '<circle cx="12" cy="15" r="4.2" fill="none" stroke="var(--surface)" stroke-width="1" opacity=".35"/>' +
      '<path d="M12 11.8l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" fill="var(--surface)" opacity=".55"/></g>',
    crown:
      '<g class="ci-drop"><path d="M3 18.5 2.5 8l5 4.5L12 5l4.5 7.5 5-4.5L21 18.5z" fill="var(--warn)"/>' +
      '<rect x="3" y="18" width="18" height="3" rx="1.2" fill="var(--warn)"/>' +
      '<circle cx="12" cy="15" r="1.4" class="ci-gem" fill="var(--danger)"/>' +
      '<circle cx="7.2" cy="15.2" r="1" fill="var(--primary-text)"/><circle cx="16.8" cy="15.2" r="1" fill="var(--primary-text)"/></g>',
    battery:
      '<rect x="2.5" y="7" width="16.5" height="10" rx="2.6" fill="none" stroke="var(--ink)" stroke-width="1.8"/>' +
      '<rect x="20.2" y="10.5" width="2" height="3" rx=".8" fill="var(--ink)"/>' +
      '<rect class="ci-bar" style="--k:0" x="5" y="9.6" width="3" height="4.8" rx=".9" fill="var(--success-text)"/>' +
      '<rect class="ci-bar" style="--k:1" x="9" y="9.6" width="3" height="4.8" rx=".9" fill="var(--success-text)"/>' +
      '<rect class="ci-bar" style="--k:2" x="13" y="9.6" width="3" height="4.8" rx=".9" fill="var(--success-text)"/>'
  };

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
    emojiEl = document.createElement("span");
    emojiEl.className = "celebrate-emoji";
    emojiEl.setAttribute("aria-hidden", "true");
    textEl.appendChild(emojiEl);
    textEl.appendChild(document.createTextNode(""));
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
        dot.style.setProperty("--d", (i % 2 ? 66 : 50) + "px");
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

  // Created per celebration. Decorative (aria-hidden). Motion is CSS only, so
  // reduced motion leaves the same picture standing still.
  function setEmoji(name) {
    emojiEl.textContent = "";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "30");
    svg.setAttribute("height", "30");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", "ci ci-" + name);
    svg.innerHTML = ICONS[name];
    emojiEl.appendChild(svg);
  }

  function show(kind, message, emoji) {
    build();
    clearTimeout(timer);
    card.classList.remove("show", "is-day", "is-rest");
    textEl.lastChild.nodeValue = message;
    setEmoji(emoji);
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

  // "Finished in 42 min", or "Finished in 1 h 05 min" from an hour up.
  function tookText(sec) {
    var total = Math.max(1, Math.round(sec / 60));
    if (total < 60) return str("celebTook", { m: num(total) });
    var mm = (total % 60).toLocaleString(isAr() ? "ar-EG" : "en-US", { minimumIntegerDigits: 2 });
    return str("celebTookH", { h: num(Math.floor(total / 60)), m: mm });
  }

  function day(dayId, opts) {
    if (!claim(dayId || "day")) return;
    var m = opts && opts.held ? { text: str("celebHeld"), emoji: "muscle" } : trainingText(streakAfterToday());
    var text = opts && opts.durationSec > 0 ? m.text + ". " + tookText(opts.durationSec) : m.text;
    show("day", text, m.emoji);
    try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {}
  }

  function rest() { show("rest", str("celebRest"), "battery"); }

  window.GymCelebrate = { day: day, rest: rest };
})();
