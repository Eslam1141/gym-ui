// Language for the public delete-account page. Deliberately NOT boot.js:
// that redirects signed-in visitors to the app, and this page must always
// open for everyone (no sign-in). No inline script: CSP allows 'self' only.
(function () {
  var d = document.documentElement;
  var lang = null;
  try { lang = localStorage.getItem("gym_lang"); } catch (e) {}
  if (lang !== "ar" && lang !== "en") lang = /^ar/i.test(navigator.language || "") ? "ar" : "en";

  function apply(l) {
    d.lang = l;
    d.dir = l === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-doc]").forEach(function (n) { n.hidden = n.getAttribute("data-doc") !== l; });
    document.querySelectorAll("[data-foot]").forEach(function (n) { n.hidden = n.getAttribute("data-foot") !== l; });
    var btn = document.getElementById("langBtn");
    btn.textContent = l === "ar" ? "English" : "العربية";
    btn.setAttribute("aria-label", l === "ar" ? "Switch to English" : "التبديل إلى العربية");
    document.title = l === "ar" ? "حذف حسابك في إتقدم | إتقدم" : "Delete your Etqadem account | Etqadem";
  }

  apply(lang);
  document.getElementById("langBtn").addEventListener("click", function () {
    lang = lang === "ar" ? "en" : "ar";
    try { localStorage.setItem("gym_lang", lang); } catch (e) {}
    apply(lang);
  });
})();
