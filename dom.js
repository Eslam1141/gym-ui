/* dom.js — helpers shared by the screen modules (chat, checkin, coach, food,
 * workout-builder). Loaded with `defer` just before them in index.html, so
 * window.GymDom exists when their IIFEs run.
 *
 * h()      tiny element builder: h(tag, attrs, ...children)
 * lang()   "ar" | "en" for the screen modules' own STR tables
 * makeT()  builds a module's s(key) over its { key: [en, ar] } table */
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

  window.GymDom = { h: h, lang: lang, makeT: makeT };
})();
