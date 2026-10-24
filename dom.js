/* dom.js — helpers shared by the screen modules (chat, checkin, coach, food,
 * workout-builder). Loaded with `defer` just before them in index.html, so
 * window.GymDom exists when their IIFEs run.
 *
 * h()      tiny element builder: h(tag, attrs, ...children)
 * lang()   "ar" | "en" for the screen modules' own STR tables
 * makeT()  builds a module's s(key) over its { key: [en, ar] } table
 * policyLink()  <a> to a section of the public /privacy page */
(function () {
  "use strict";

  // window.activeLang is checked first for parity with the old copies; it is
  // normally undefined (app.js declares `let activeLang`, which is not a
  // window property), so gym_lang decides.
  function lang() {
    try { if (window.activeLang === "ar") return "ar"; } catch (e) {}
    try { return localStorage.getItem("gym_lang") === "ar" ? "ar" : "en"; } catch (e) { return "en"; }
  }

  function makeT(STR) {
    return function s(k) {
      var e = STR[k];
      return e ? e[lang() === "ar" ? 1 : 0] : k;
    };
  }

  function h(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k === "on" && attrs[k]) {
          Object.keys(attrs[k]).forEach(function (ev) { node.addEventListener(ev, attrs[k][ev]); });
        } else if (attrs[k] != null && attrs[k] !== false) node.setAttribute(k, attrs[k]);
      });
    }
    var put = function (x) {
      if (x == null || x === false) return;
      if (typeof x === "string") node.appendChild(document.createTextNode(x));
      else if (x && x.nodeType) node.appendChild(x);
      else node.appendChild(document.createTextNode(String(x))); // numbers; odd model output in coach
    };
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (Array.isArray(c)) c.forEach(put);
      else put(c);
    }
    return node;
  }

  // newTab: for links inside a sheet or drawer, so the action in progress isn't lost.
  function policyLink(section, text, newTab) {
    return h("a", {
      class: "pol-link", href: "/privacy" + (section ? "#" + section : ""),
      target: newTab ? "_blank" : null, rel: newTab ? "noopener" : null
    }, text);
  }

  // Native modal dialogs keep Tab inside the page but not inside the dialog: after the last
  // control, focus leaves for the browser's own UI. Wrap it so a keyboard user stays in the sheet.
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || e.defaultPrevented) return;
    var open = document.querySelectorAll("dialog[open]");
    var dlg = null;
    for (var i = open.length - 1; i >= 0 && !dlg; i--) if (open[i].matches(":modal")) dlg = open[i];
    if (!dlg) return;
    var list = Array.prototype.filter.call(dlg.querySelectorAll(FOCUSABLE), function (n) { return n.getClientRects().length > 0; });
    if (!list.length) return;
    var at = list.indexOf(document.activeElement);
    if (!e.shiftKey && at === list.length - 1) { e.preventDefault(); list[0].focus(); }
    else if (e.shiftKey && at <= 0) { e.preventDefault(); list[list.length - 1].focus(); }
  });

  window.GymDom = { h: h, lang: lang, makeT: makeT, policyLink: policyLink };
})();
