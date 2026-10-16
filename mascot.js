/* Etqadem coach icon, "Pacer": the brand's three steps with an accent dot that
   climbs them. One shared drawing for the chat FAB/header (chat.js), the Coach
   hero/result (coach.js) and the celebration card (celebrate.js); the bottom-nav
   Coach icon in index.html uses the same markup. Colours and the climb animation
   live in styles.css (.etq-pacer), so it follows light/dark/auto, the women-plan
   accent, RTL and reduced motion.
   EtqademMascot.create({ size, tone, climb }) returns a decorative <svg>
   (aria-hidden). tone "on-primary" sits on a --primary fill (FAB, chat header).
   climb runs the hop animation (while a plan is generating); otherwise the dot
   rests on the top step. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var BODY =
    '<g class="p-art">' +
    '<rect class="p-step" style="--k:0" x="2" y="15" width="5" height="7" rx="1.5"/>' +
    '<rect class="p-step" style="--k:1" x="9.5" y="11" width="5" height="11" rx="1.5"/>' +
    '<rect class="p-step" style="--k:2" x="17" y="7" width="5" height="15" rx="1.5"/>' +
    '<circle class="p-dot" cx="4.5" cy="11.5" r="2"/>' +
    '</g>';

  function create(opts) {
    opts = opts || {};
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (opts.size) { svg.setAttribute("width", opts.size); svg.setAttribute("height", opts.size); }
    svg.setAttribute("class", "etq-pacer" +
      (opts.tone === "on-primary" ? " on-primary" : "") + (opts.climb ? " is-climbing" : ""));
    svg.innerHTML = BODY;
    return svg;
  }

  window.EtqademMascot = { create: create };
})();
