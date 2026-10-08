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
  function pop(el) {
    if (!el || reduced()) return;
    el.classList.remove("m-pop");
    void el.offsetWidth;
    el.classList.add("m-pop");
  }

  window.GymMotion = { reduced: reduced, enter: enter, pop: pop };

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
