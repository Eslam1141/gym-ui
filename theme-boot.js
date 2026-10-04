/* theme-boot.js — resolves the colour theme before first paint.
 * Loaded synchronously from <head> (before styles.css) so a light-theme phone
 * never flashes the dark palette. Mode is stored as gym_theme:
 * "auto" | "light" | "dark" (missing = auto, which follows the OS setting).
 * app.js reuses window.GymTheme for the More-tab control and live OS changes.
 */
(function () {
  "use strict";
  var COLORS = {
    dark:  { male: "#10171f", female: "#1b1522" },
    light: { male: "#F3F0E8", female: "#F8F0F3" }
  };
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function mode() {
    var m = read("gym_theme");
    return m === "light" || m === "dark" ? m : "auto";
  }
  function resolve() {
    var m = mode();
    if (m !== "auto") return m;
    return mq && mq.matches ? "light" : "dark";
  }
  function apply(plan) {
    var root = document.documentElement;
    var persona = (plan || read("gym_plan")) === "female" ? "female" : "male";
    var theme = resolve();
    root.dataset.theme = theme;
    root.dataset.plan = persona;
    var tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute("content", COLORS[theme][persona]);
  }
  function setMode(m) {
    try {
      if (m === "auto") localStorage.removeItem("gym_theme");
      else localStorage.setItem("gym_theme", m);
    } catch (e) {}
    apply();
  }

  window.GymTheme = { mode: mode, setMode: setMode, apply: apply };
  apply();
  if (mq) {
    var onChange = function () {
      if (mode() === "auto") apply(document.documentElement.dataset.plan);
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
})();
