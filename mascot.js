/* Etqadem coach mascot: one shared drawing for the chat FAB/header (chat.js)
   and the Coach hero/result (coach.js). It is the stair-climber logo's teal
   head with a headband and the logo's three steps, so it reads as the same
   family. All colours come from CSS custom properties (see .etq-mascot in
   styles.css), so it follows light/dark/auto and the women-plan accent.
   EtqademMascot.create({ size, tone, live }) returns a decorative <svg>
   (aria-hidden). tone "brand" (default) sits on a surface; tone "on-primary"
   sits on a --primary fill (FAB, chat header). live adds an occasional blink. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var BODY =
    '<rect class="m-step" x="6" y="52" width="16" height="10" rx="3"/>' +
    '<rect class="m-step" x="24" y="46" width="16" height="16" rx="3"/>' +
    '<rect class="m-step" x="42" y="40" width="16" height="22" rx="3"/>' +
    '<circle class="m-head" cx="27" cy="25" r="17"/>' +
    '<path class="m-band" d="M14.04 14H39.96L42.5 18H11.5Z"/>' +
    '<circle class="m-face m-eye" cx="21" cy="25" r="2.6"/>' +
    '<circle class="m-face m-eye" cx="33" cy="25" r="2.6"/>' +
    '<path class="m-smile" d="M20 32Q27 38 34 32"/>';

  function create(opts) {
    opts = opts || {};
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (opts.size) { svg.setAttribute("width", opts.size); svg.setAttribute("height", opts.size); }
    svg.setAttribute("class", "etq-mascot" +
      (opts.tone === "on-primary" ? " on-primary" : "") + (opts.live ? " is-live" : ""));
    svg.innerHTML = BODY;
    return svg;
  }

  window.EtqademMascot = { create: create };
})();
