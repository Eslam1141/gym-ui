// /privacy and /terms: language (one block at a time), the owner facts from
// privacy-facts.js, the Draft banner and anchor handling. Deliberately NOT
// boot.js (that redirects signed-in visitors to the app); the page must open
// for everyone. No inline script: CSP allows 'self' only.
//
// The Arabic block's ids carry an "ar-" prefix (so ids stay unique). Links
// always use the plain id (/privacy#ai-coach); this script scrolls to the
// block that is showing.
(function () {
  var d = document.documentElement;
  var facts = window.PRIVACY_FACTS || {};
  var lang = null;
  try { lang = localStorage.getItem("gym_lang"); } catch (e) {}
  if (lang !== "ar" && lang !== "en") lang = /^ar/i.test(navigator.language || "") ? "ar" : "en";

  function valueOf(key, l) {
    var v = facts[key];
    if (v && typeof v === "object") v = v[l];
    return v === undefined || v === null ? "" : String(v).trim();
  }

  // Fill the [PLACEHOLDER] tokens; returns the keys still unfilled.
  function renderFacts() {
    var missing = {};
    document.querySelectorAll("[data-fact]").forEach(function (n) {
      var key = n.getAttribute("data-fact");
      var l = n.closest("[data-doc]").getAttribute("data-doc");
      var v = valueOf(key, l);
      if (!v) { missing[key] = true; return; }
      n.classList.remove("is-todo");
      if (key === "PRIVACY_EMAIL") {
        var a = document.createElement("a");
        a.href = "mailto:" + v;
        a.textContent = v;
        n.textContent = "";
        n.appendChild(a);
      } else {
        n.textContent = v;
      }
    });
    // false = "doesn't apply": the line goes, and so does its placeholder.
    document.querySelectorAll("[data-optional]").forEach(function (n) {
      var key = n.getAttribute("data-optional");
      if (facts[key] === false) { n.hidden = true; delete missing[key]; }
    });
    var live = facts.FEEDBACK_TTL_LIVE === true;
    document.querySelectorAll("[data-ttl]").forEach(function (n) { n.hidden = (n.getAttribute("data-ttl") === "live") !== live; });
    return Object.keys(missing);
  }

  var unfilled = renderFacts();
  // data-draft-force on <body>: the page text itself is not final (the /terms scaffold).
  var isDraft = unfilled.length > 0 || document.body.hasAttribute("data-draft-force");
  d.classList.toggle("is-draft", isDraft);
  document.querySelectorAll("[data-draft]").forEach(function (n) { n.hidden = !isDraft; });

  function baseId(hash) { return decodeURIComponent((hash || "").replace(/^#/, "")).replace(/^ar-/, ""); }
  function targetFor(hash, l) {
    var id = baseId(hash);
    return id ? document.getElementById((l === "ar" ? "ar-" : "") + id) : null;
  }
  function toHash() {
    var t = targetFor(location.hash, lang);
    if (t) t.scrollIntoView();
  }

  var tocMq = window.matchMedia ? window.matchMedia("(min-width: 900px)") : null;
  function syncToc() {
    document.querySelectorAll(".toc details").forEach(function (det) { det.open = !!(tocMq && tocMq.matches); });
  }
  if (tocMq) { if (tocMq.addEventListener) tocMq.addEventListener("change", syncToc); else tocMq.addListener(syncToc); }

  function apply(l) {
    lang = l;
    d.lang = l;
    d.dir = l === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-doc]").forEach(function (n) { n.hidden = n.getAttribute("data-doc") !== l; });
    document.querySelectorAll("[data-foot]").forEach(function (n) { n.hidden = n.getAttribute("data-foot") !== l; });
    var btn = document.getElementById("langBtn");
    btn.textContent = l === "ar" ? "English" : "العربية";
    btn.setAttribute("aria-label", l === "ar" ? "Switch to English" : "التبديل إلى العربية");
    document.title = document.body.getAttribute("data-title-" + l) || document.title;
    syncToc();
    observe();
  }

  // Marks the contents entry of the section being read.
  var io = null;
  function observe() {
    if (!("IntersectionObserver" in window)) return;
    if (io) io.disconnect();
    var doc = document.querySelector('[data-doc="' + lang + '"]');
    var links = {};
    doc.querySelectorAll(".toc a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].removeAttribute("aria-current"); });
        var a = links[e.target.id];
        if (a) a.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-10% 0px -80% 0px" });
    doc.querySelectorAll(".sec").forEach(function (s) { io.observe(s); });
  }

  apply(lang);
  toHash();
  window.addEventListener("hashchange", toHash);
  document.getElementById("langBtn").addEventListener("click", function () {
    apply(lang === "ar" ? "en" : "ar");
    try { localStorage.setItem("gym_lang", lang); } catch (e) {}
    toHash();
  });
})();
