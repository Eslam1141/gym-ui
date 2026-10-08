/* onboarding.js — small behaviours for the sign-in screen (#onboarding).
 * The decorative stage is pure SVG/CSS (onboarding.css); the only script
 * here is the password show/hide toggle used by auth-email.js's fields. */
(function () {
  "use strict";

  function init() {
    var ob = document.getElementById("onboarding");
    if (!ob) return;
    ob.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest(".ae-eye");
      if (!btn) return;
      var input = btn.parentNode.querySelector("input");
      if (!input) return;
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-pressed", show ? "true" : "false");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
