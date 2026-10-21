/* motion.js — the app's shared motion + action-guard helpers.
 *
 * GymMotion   tiny helpers that drive motion.css (stagger entrance, pop).
 *             Motion is transform/opacity only; reduced-motion users get
 *             nothing animated (reduced() is the single source of truth).
 * GymAct      double-submit / double-click guards used by every action
 *             button (save, delete, sign-out, generate, complete...).
 *
 * Both are dependency-free and safe to call before the DOM is ready. */
(function () {
  "use strict";

  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() { return !!(mq && mq.matches); }

  function cssMs(name, fallback) {
    try {
      var raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      var ms = raw.indexOf("ms") !== -1 ? parseFloat(raw) : parseFloat(raw) * 1000;
      if (!isNaN(ms)) return ms;
    } catch (e) {}
    return fallback;
  }

  // Staggered entrance for the direct children of `container` (first `max`
  // only, so a long list never delays its tail). The class is removed once
  // the last child has landed so later re-renders do not replay it and the
  // cards' own hover/press transforms are never held by an animation.
  function enter(container, opts) {
    if (!container || reduced()) return;
    opts = opts || {};
    var max = opts.max || 12;
    var kids = container.children;
    var n = Math.min(kids.length, max);
    if (!n) return;
    for (var i = 0; i < n; i++) kids[i].style.setProperty("--i", i);
    container.classList.remove("m-enter");
    void container.offsetWidth; // restart if a previous run is still going
    container.classList.add("m-enter");
    clearTimeout(container._mEnterT);
    container._mEnterT = setTimeout(function () {
      container.classList.remove("m-enter");
      for (var j = 0; j < n; j++) if (kids[j]) kids[j].style.removeProperty("--i");
    }, cssMs("--dur-slow", 500) + n * cssMs("--dur-stagger", 45) + 60);
  }

  // One-shot "pop" (done checkmark, streak bump). Restarts if already running.
  function pop(el) { play(el, "m-pop"); }

  // One-shot class animation on `el` (restarts if already running).
  function play(el, cls) {
    if (!el || reduced()) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // show/hide: an overlay, popover or menu that animates in and out. The
  // element carries a static style class (.m-ovl or .m-menu, see motion.css)
  // and these helpers add .m-in / .m-out. hide() waits for the element's own
  // animationend (timeout fallback) before setting `hidden`, so the exit is
  // seen; reduced motion shows and hides instantly. `done` runs once hidden.
  function cancelHide(el) {
    clearTimeout(el._mHideT);
    if (el._mHideH) el.removeEventListener("animationend", el._mHideH);
    el._mHideH = el._mHideT = null;
  }
  function show(el) {
    if (!el) return;
    cancelHide(el);
    el.classList.remove("m-out", "m-in");
    el.hidden = false;
    if (reduced()) return;
    void el.offsetWidth;
    el.classList.add("m-in");
  }
  function hide(el, done) {
    if (!el || el._mHideH) return;
    if (el.hidden || reduced()) {
      el.classList.remove("m-in", "m-out");
      el.hidden = true;
      if (done) done();
      return;
    }
    function finish() {
      cancelHide(el);
      el.classList.remove("m-out");
      el.hidden = true;
      if (done) done();
    }
    el._mHideH = function (e) { if (e.target === el) finish(); };
    el.addEventListener("animationend", el._mHideH);
    el._mHideT = setTimeout(finish, 320);
    el.classList.remove("m-in");
    el.classList.add("m-out");
  }

  // ---- reveal: a block that opens/closes in the flow of the page ----
  // Animating height (or grid rows) re-lays the page out every frame. Instead
  // the block snaps to its new size at once and flip() slides everything that
  // sits below it from its old position to the new one with transform only;
  // the block itself fades/rises in (.m-reveal-in) or fades out first
  // (.m-reveal-out). `apply` makes the actual DOM change (add .open, unhide).
  function easeOut() {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim();
      if (v) return v;
    } catch (e) {}
    return "cubic-bezier(.16,1,.3,1)";
  }
  // The elements laid out after `el`: its later siblings and those of each
  // ancestor up to the screen, skipping anything out of flow, hidden or far
  // off screen (they would not be seen moving).
  function followers(el) {
    var out = [];
    var vh = window.innerHeight || 800;
    for (var n = el; n && n.parentElement && n !== document.body; n = n.parentElement) {
      if (n.classList && n.classList.contains("screen")) break;
      for (var sib = n.nextElementSibling; sib && out.length < 16; sib = sib.nextElementSibling) {
        if (sib.hidden) continue;
        var cs = getComputedStyle(sib);
        if (cs.display === "none" || cs.position === "fixed" || cs.position === "absolute") continue;
        var r = sib.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue;
        out.push(sib);
      }
    }
    return out;
  }
  function flip(el, apply) {
    if (!el || reduced()) { apply(); return; }
    var els = followers(el);
    var before = els.map(function (e) { return e.getBoundingClientRect().top; });
    apply();
    var dur = cssMs("--dur-med", 280), ease = easeOut();
    els.forEach(function (e, i) {
      var d = before[i] - e.getBoundingClientRect().top;
      if (Math.abs(d) < 1 || !e.animate) return;
      e.animate([{ transform: "translate3d(0," + d + "px,0)" }, { transform: "none" }],
        { duration: dur, easing: ease, fill: "backwards" });
    });
  }
  function cancelReveal(el) {
    clearTimeout(el._mRevT);
    if (el._mRevH) el.removeEventListener("animationend", el._mRevH);
    el._mRevH = el._mRevT = null;
    el.classList.remove("m-reveal-out");
  }
  function expand(el, apply) {
    if (!el) return;
    var closing = !!el._mRevH;
    cancelReveal(el);
    if (closing) { apply(); return; }
    flip(el, apply);
    play(el, "m-reveal-in");
  }
  function collapse(el, apply, done) {
    if (!el) return;
    function finish() {
      cancelReveal(el);
      el.classList.remove("m-reveal-in");
      flip(el, apply);
      if (done) done();
    }
    if (reduced()) { finish(); return; }
    if (el._mRevH) return;
    el._mRevH = function (e) { if (e.target === el) finish(); };
    el.addEventListener("animationend", el._mRevH);
    el._mRevT = setTimeout(finish, 320);
    el.classList.remove("m-reveal-in");
    el.classList.add("m-reveal-out");
  }

  // <dialog> exit: modal dialogs close natively with no exit, so play
  // .m-dlg-out (sheet + ::backdrop) and call close() afterwards.
  function closeDialog(dlg, done) {
    if (!dlg || !dlg.open || dlg._mClosing) return;
    function finish() {
      clearTimeout(dlg._mClosingT);
      dlg.removeEventListener("animationend", onEnd);
      dlg._mClosing = false;
      dlg.classList.remove("m-dlg-out");
      dlg.inert = false;
      if (dlg.open) dlg.close();
      if (done) done();
    }
    function onEnd(e) { if (e.target === dlg) finish(); }
    if (reduced()) { finish(); return; }
    dlg._mClosing = true;
    dlg.inert = true;
    dlg.addEventListener("animationend", onEnd);
    dlg._mClosingT = setTimeout(finish, 320);
    dlg.classList.add("m-dlg-out");
  }

  window.GymMotion = { reduced: reduced, enter: enter, pop: pop, play: play, show: show, hide: hide, cancel: cancelHide,
    flip: flip, expand: expand, collapse: collapse, closeDialog: closeDialog };

  // ---------------- action guards ----------------
  // once(fn, {cooldown}) wraps a handler so it cannot run again while the
  // previous call is in flight. If fn returns a promise the guard holds until
  // it settles; otherwise it holds for `cooldown` ms (default 0 = none), which
  // is how synchronous toggles (start/stop a session) swallow a double tap.
  function once(fn, opts) {
    var cooldown = (opts && opts.cooldown) || 0;
    var busy = false;
    function release() {
      if (cooldown) setTimeout(function () { busy = false; }, cooldown);
      else busy = false;
    }
    return function () {
      if (busy) return undefined;
      busy = true;
      var r;
      try { r = fn.apply(this, arguments); }
      catch (e) { busy = false; throw e; }
      if (r && typeof r.then === "function") r.then(release, release);
      else release();
      return r;
    };
  }

  // run(btn, fn): same guard, tied to a button. While in flight the button
  // carries aria-busy and .is-busy (CSS ignores pointer events and keeps
  // focus). Returns undefined when ignored, otherwise whatever fn returned.
  function run(btn, fn, opts) {
    if (btn && btn.getAttribute("aria-busy") === "true") return undefined;
    var cooldown = (opts && opts.cooldown) || 0;
    function clear() {
      if (btn) { btn.removeAttribute("aria-busy"); btn.classList.remove("is-busy"); }
    }
    function done() { if (cooldown) setTimeout(clear, cooldown); else clear(); }
    if (btn) { btn.setAttribute("aria-busy", "true"); btn.classList.add("is-busy"); }
    var r;
    try { r = fn(); } catch (e) { clear(); throw e; }
    if (r && typeof r.then === "function") r.then(done, done);
    else done();
    return r;
  }

  // bind(el, fn, opts): click listener that is guarded per element.
  function bind(el, fn, opts) {
    if (!el) return;
    el.addEventListener("click", function (e) {
      run(el, function () { return fn.call(el, e); }, opts);
    });
  }

  window.GymAct = { once: once, run: run, bind: bind };
})();
