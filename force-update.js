/* force-update.js - makes old native shells update, and keeps long-open sessions fresh.
 * Spec: docs/superpowers/specs/2026-10-26-force-update-design.md
 *
 *  - Version logic: compare() / decide(). minAppVersion / latestAppVersion (GymAppConfig)
 *    apply only inside the native shell (window.GYM_APP_VERSION); a missing or unparseable
 *    value, or a failed config fetch, never blocks and never shows a banner.
 */
(function () {
  "use strict";

  // Dotted numeric versions: -1 / 0 / 1, or null when either side is empty or not numeric.
  // A missing part counts as 0 ("1.0" equals "1.0.0").
  function compare(a, b) {
    var re = /^\d+(\.\d+)*$/;
    a = String(a == null ? "" : a).trim();
    b = String(b == null ? "" : b).trim();
    if (!re.test(a) || !re.test(b)) return null;
    var x = a.split("."), y = b.split("."), n = Math.max(x.length, y.length);
    for (var i = 0; i < n; i++) {
      var p = parseInt(x[i] || "0", 10), q = parseInt(y[i] || "0", 10);
      if (p !== q) return p < q ? -1 : 1;
    }
    return 0;
  }

  // o: {native, version, min, latest, inWorkout, dismissed} -> "block" | "bar" | "banner" | "none".
  // "bar" is the in-workout stand-in for "block": the workout is never interrupted.
  function decide(o) {
    if (!o.native) return "none";
    if (compare(o.version, o.min) === -1) return o.inWorkout ? "bar" : "block";
    if (!o.inWorkout && o.dismissed !== o.latest && compare(o.version, o.latest) === -1) return "banner";
    return "none";
  }

  window.GymForceUpdate = { compare: compare, decide: decide };
})();
