/* muscle-art.js
   Original artwork, Etqadem, 2026. Not derived from third-party images.

   Hand-built anatomy figures (male / female, front / back) for the Plan tab.
   Every muscle is a short list of control points that is turned into a smooth
   closed path here, drawn once for the right half and mirrored. Volume comes
   from a radial gradient per muscle; fibre lines are generated between an
   origin edge and an insertion edge so they fan the way the real fibres do
   (pecs fan out from the sternum, lats converge on the armpit, quads run
   straight, and so on). The female figure re-uses the same muscles through a
   width profile (narrower shoulders and waist, wider hips) plus a bust line.

   Colours never appear in the markup: shapes use gradients whose stops read
   CSS variables (--mus-*, defined in styles.css), so a theme or persona switch
   recolours open cards without re-rendering.

   API (window.GymMuscleArt)
     REGIONS                      the 20 shape ids used by the workout catalogue
     viewOf(id)                   "front" | "back" | null
     closeup(id, {sex, secondary}) cropped SVG string with `id` lit (+ secondary
                                   in a lighter tint when it is on the same view)
     group(name, {sex})           cropped SVG string with every region of the group lit
     figure(view, {sex, lit})     the whole figure for one view
   Lit regions are <g class="ma-hi|ma-hi2" data-region="id">; the rest are ma-m.
*/
(function () {
  "use strict";

  var W = 200, H = 436;
  var REGIONS = ["chest_upper", "chest_mid", "chest_lower", "back_lats", "back_mid", "back_lower",
    "shoulder_front", "shoulder_side", "shoulder_rear", "biceps_long", "biceps_short", "triceps_long",
    "triceps_lateral", "quads", "hamstrings", "glutes", "calves", "core_upper", "core_lower", "core_obliques"];
  // Mirrors MUSCLE_SHAPES[].group in app.js (a test keeps the two in step).
  var GROUP = {
    chest_upper: "Chest", chest_mid: "Chest", chest_lower: "Chest",
    back_lats: "Back", back_mid: "Back", back_lower: "Back",
    shoulder_front: "Shoulders", shoulder_side: "Shoulders", shoulder_rear: "Shoulders",
    biceps_long: "Biceps", biceps_short: "Biceps", triceps_long: "Triceps", triceps_lateral: "Triceps",
    quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves",
    core_upper: "Core", core_lower: "Core", core_obliques: "Core"
  };
  // How much room each group's close-up leaves around the lit muscles (fraction
  // of their size) and the smallest crop edge, in figure units (the figure is
  // 200 x 436). Tight enough that the lit part fills a 64-72px thumbnail.
  var CROP = {
    Chest: [0.16, 100], Back: [0.2, 100, 1], Shoulders: [0.9, 78], Biceps: [0.6, 78], Triceps: [0.6, 78],
    Quads: [0.2, 92, 1], Hamstrings: [0.2, 92, 1], Glutes: [0.25, 86], Calves: [0.25, 84, 1], Core: [0.25, 90]
  };
  // Group tiles lean on one view; the first region of the group decides.
  var VIEWS = { front: {}, back: {} };

  // ---------------------------------------------------------------- geometry
  function f1(n) { return String(Math.round(n * 10) / 10); }
  function unit(dx, dy) { var l = Math.sqrt(dx * dx + dy * dy) || 1; return [dx / l, dy / l]; }

  // Smooth path through points [x, y, flag?]. flag 1 = sharp corner; "h" / "v"
  // = tangent forced horizontal / vertical (used where a shape meets the midline).
  function splineD(P, closed) {
    var n = P.length, i, d, tans = [], k = 0.34;
    function at(j) { return closed ? P[(j + n) % n] : P[Math.max(0, Math.min(n - 1, j))]; }
    for (i = 0; i < n; i++) {
      var p = P[i], a = at(i - 1), b = at(i + 1), t;
      if (p[2] === 1) t = [0, 0];
      else {
        var u1 = unit(p[0] - a[0], p[1] - a[1]), u2 = unit(b[0] - p[0], b[1] - p[1]);
        t = unit(u1[0] + u2[0], u1[1] + u2[1]);
        if (!closed && (i === 0 || i === n - 1)) t = i === 0 ? u2 : u1;
        if (p[2] === "h") t = [(b[0] - a[0]) >= 0 ? 1 : -1, 0];
        if (p[2] === "v") t = [0, (b[1] - a[1]) >= 0 ? 1 : -1];
      }
      tans.push(t);
    }
    d = "M" + f1(P[0][0]) + " " + f1(P[0][1]);
    var last = closed ? n : n - 1;
    for (i = 0; i < last; i++) {
      var p1 = P[i], p2 = P[(i + 1) % n], L = Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2)),
        t1 = tans[i], t2 = tans[(i + 1) % n];
      d += "C" + f1(p1[0] + t1[0] * L * k) + " " + f1(p1[1] + t1[1] * L * k) + " " +
        f1(p2[0] - t2[0] * L * k) + " " + f1(p2[1] - t2[1] * L * k) + " " + f1(p2[0]) + " " + f1(p2[1]);
    }
    return closed ? d + "Z" : d;
  }

  // A tapering ribbon around a centre line (sartorius, tendons, IT band).
  function strap(c, w0, w1) {
    var a = [], b = [], n = c.length, i;
    for (i = 0; i < n; i++) {
      var p = c[Math.max(0, i - 1)], q = c[Math.min(n - 1, i + 1)], u = unit(q[0] - p[0], q[1] - p[1]);
      var w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
      a.push([c[i][0] - u[1] * w, c[i][1] + u[0] * w]);
      b.push([c[i][0] + u[1] * w, c[i][1] - u[0] * w]);
    }
    return a.concat(b.reverse());
  }

  // ------------------------------------------------------------- placement
  // Female: same muscles through a width profile about the midline.
  var FEM = [[0, 0.93], [56, 0.9], [72, 0.86], [90, 0.86], [116, 0.87], [140, 0.89], [160, 0.85], [176, 0.92],
    [196, 1.08], [212, 1.17], [232, 1.12], [262, 1.05], [300, 0.99], [340, 0.96], [380, 0.93], [440, 0.92]];
  function sxAt(y) {
    var i;
    for (i = 1; i < FEM.length; i++) {
      if (y <= FEM[i][0]) {
        var a = FEM[i - 1], b = FEM[i], t = (y - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return FEM[FEM.length - 1][1];
  }
  // Arms hang from the shoulder joint, a little away from the body. Points are
  // authored for a vertical arm (x = out, y = down) and placed here.
  function armFrame(sex) {
    var fem = sex === "female", ox = fem ? 100 + 54 * sxAt(100) : 154, a = (fem ? -14 : -12) * Math.PI / 180;
    return { ox: ox, oy: 100, c: Math.cos(a), s: Math.sin(a), kx: fem ? 0.88 : 1, ky: fem ? 0.96 : 1 };
  }
  function place(sex, frame, p) {
    var x = p[0], y = p[1];
    if (frame === "arm") {
      var A = armFrame(sex), lx = x * A.kx, ly = y * A.ky;
      return [A.ox + lx * A.c - ly * A.s, A.oy + lx * A.s + ly * A.c];
    }
    return sex === "female" ? [100 + (x - 100) * sxAt(y), y] : [x, y];
  }
  function placeAll(sex, frame, P) {
    return P.map(function (p) { var q = place(sex, frame, p); return p.length > 2 ? [q[0], q[1], p[2]] : q; });
  }
  // Reversed so the reflected outline keeps the original winding (two halves that touch must union, not cancel).
  function mirror(P) { return P.map(function (p) { return p.length > 2 ? [W - p[0], p[1], p[2]] : [W - p[0], p[1]]; }).reverse(); }
  function bbox(P) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    P.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return [x0, y0, x1, y1];
  }
  function union(a, b) { return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; }
  function mirrorBox(b) { return [W - b[2], b[1], W - b[0], b[3]]; }
  function hits(a, b) { return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]; }

  // Fibre lines between an origin edge and an insertion edge, in the region's
  // own frame: [ox1,oy1,ox2,oy2, ix1,iy1,ix2,iy2, count, bow].
  function fibreD(sex, frame, fan, flip) {
    var n = fan[8], bow = fan[9] || 0, d = "", i;
    for (i = 0; i < n; i++) {
      var t = n === 1 ? 0.5 : i / (n - 1);
      var o = [fan[0] + (fan[2] - fan[0]) * t, fan[1] + (fan[3] - fan[1]) * t];
      var e = [fan[4] + (fan[6] - fan[4]) * t, fan[5] + (fan[7] - fan[5]) * t];
      var u = unit(e[0] - o[0], e[1] - o[1]), b = bow * (t * 2 - 1);
      var m = [(o[0] + e[0]) / 2 - u[1] * b, (o[1] + e[1]) / 2 + u[0] * b];
      var pts = placeAll(sex, frame, [o, m, e]);
      if (flip) pts = mirror(pts);
      d += "M" + f1(pts[0][0]) + " " + f1(pts[0][1]) + "Q" + f1(pts[1][0]) + " " + f1(pts[1][1]) + " " + f1(pts[2][0]) + " " + f1(pts[2][1]);
    }
    return d;
  }

  // ------------------------------------------------------------------ data
  // Right half of the figure as the viewer sees it, centre line at x = 100.
  // Parts: [frame|null, points]. "arm" points are in the arm's own frame.
  var SIL = {
    front: [
      [null, [[100, 6, "h"], [108, 6.8], [115, 11], [118.5, 20], [119, 30], [117.5, 41], [113, 50], [107, 56], [100, 58.5, "h"]]],
      [null, [[119, 27], [122.5, 26.5], [124, 33], [121.5, 39], [119, 38]]],
      [null, [[100, 55, 1], [108.5, 55], [110.5, 63], [114, 72], [124, 79], [138, 85], [150, 89], [156, 95], [152, 106], [146, 114],
        [142, 124], [138, 140], [135, 154], [133.5, 168], [136, 184], [141, 198], [144, 212], [145, 228], [145, 246], [144, 264],
        [141, 282], [137, 298], [135, 310], [136, 322], [141.5, 338], [141, 352], [135, 367], [130, 384], [126, 398], [126, 406, 1],
        [113.5, 406, 1], [113, 388], [113, 370], [110.5, 352], [109.5, 338], [110, 324], [109, 308], [108, 292], [106, 272], [104, 252],
        [102, 236], [101.2, 224], [100, 214, 1]]],
      ["arm", [[0, -9], [9, -8], [16, -2], [18.5, 8], [17.5, 22], [15, 36], [13.5, 48], [12, 58], [12.5, 66], [13.5, 76], [12, 90],
        [9.5, 104], [7.5, 114], [8, 121], [10.5, 130], [11.5, 142], [9.5, 153], [4, 159], [-2, 157], [-5, 147], [-6, 133],
        [-6.5, 120], [-6, 114], [-8, 102], [-10, 88], [-11, 74], [-11, 64], [-12, 52], [-13, 38], [-14, 22], [-13, 8], [-9, -4]]],
      [null, [[112.5, 402], [127, 402], [129, 414], [135, 424], [134, 429], [124, 431.5], [113, 431], [110.5, 423], [111.5, 411]]]
    ],
    back: [
      [null, [[100, 6, "h"], [108, 6.8], [115, 11], [118.5, 20], [119, 30], [117.5, 41], [113, 50], [107, 56], [100, 58.5, "h"]]],
      [null, [[119, 27], [122.5, 26.5], [124, 33], [121.5, 39], [119, 38]]],
      [null, [[100, 55, 1], [108.5, 55], [110.5, 63], [114, 72], [124, 79], [138, 85], [150, 89], [156, 95], [152, 106], [146, 114],
        [142, 124], [138, 140], [135, 154], [133.5, 168], [136, 184], [141, 198], [145, 212], [146, 228], [145, 246], [144, 264],
        [141, 282], [137, 298], [135, 310], [136, 322], [141.5, 338], [141, 352], [135, 367], [130, 384], [126, 398], [126, 406, 1],
        [113.5, 406, 1], [113, 388], [113, 370], [110.5, 352], [109.5, 338], [110, 324], [109, 308], [108, 292], [106, 272], [104, 252],
        [102, 236], [101.2, 224], [100, 214, 1]]],
      ["arm", [[0, -9], [9, -8], [16, -2], [18.5, 8], [17.5, 22], [15, 36], [13.5, 48], [12, 58], [12.5, 66], [13.5, 76], [12, 90],
        [9.5, 104], [7.5, 114], [8, 121], [10.5, 130], [11.5, 142], [9.5, 153], [4, 159], [-2, 157], [-5, 147], [-6, 133],
        [-6.5, 120], [-6, 114], [-8, 102], [-10, 88], [-11, 74], [-11, 64], [-12, 52], [-13, 38], [-14, 22], [-13, 8], [-9, -4]]],
      [null, [[114, 402], [126, 402], [127.5, 414], [126.5, 424], [122, 429], [116, 429], [113, 423], [112.5, 412]]]
    ]
  };

  // Muscles. ctx = context muscle (never lit). fan = fibre fans.
  // Order is paint order, back to front (deltoids sit over the arm muscles
  // and the pecs, as they do on a body).
  var DEF = {
    front: [
      { id: "adduct_f", ctx: 1, parts: [[null, [[101.6, 220], [109, 224], [117, 238], [120, 258], [116, 272], [109, 266], [104.5, 246], [101.6, 232]]]],
        fan: [[null, 102, 218, 112, 222, 106, 258, 114, 262, 5, 1]] },
      { id: "groin_f", ctx: 1, parts: [[null, [[101.6, 198, 1], [114, 198.5], [128, 200], [138, 206], [137, 213], [126, 216], [114, 219], [101.6, 221, 1]]]],
        fan: [[null, 101.6, 197, 136, 200, 101.6, 221, 126, 217, 6, 1.2]] },
      { id: "tfl_f", ctx: 1, parts: [[null, [[138, 206], [145.5, 209], [145.5, 226], [140, 238], [134, 226], [133, 214]]]],
        fan: [[null, 134, 206, 145, 208, 136, 232, 142, 232, 4, 0.5]] },
      { id: "sartorius", ctx: 1, parts: [[null, strap([[140, 210], [133, 228], [122, 254], [115, 278], [112, 298]], 4.4, 3)]] },
      { id: "tib_f", ctx: 1, parts: [[null, [[116, 326], [121, 322], [124, 340], [123, 368], [119, 394], [115, 398], [114, 372], [113, 344]]]],
        fan: [[null, 114, 326, 123, 324, 116, 392, 121, 388, 4, 0.5]] },
      { id: "calf_lat_f", ctx: 1, parts: [[null, [[126, 322], [135, 324], [139.5, 340], [137, 360], [130, 378], [126, 372], [127, 350], [125, 336]]]],
        fan: [[null, 126, 324, 136, 326, 128, 372, 134, 366, 4, 0.8]] },
      { id: "calf_med_f", ctx: 1, parts: [[null, [[109.5, 322], [113, 320], [114, 340], [114, 362], [112, 374], [110, 360], [108.5, 340]]]] },
      { id: "trap_f", ctx: 1, parts: [[null, [[108, 62], [116, 74], [130, 83], [147, 88.5], [151, 93], [136, 94], [120, 90], [108, 80]]]],
        fan: [[null, 108, 64, 108, 82, 150, 90, 138, 93, 6, 1.5]] },
      { id: "scm", ctx: 1, parts: [[null, strap([[111.5, 54], [110, 66], [106, 78], [103, 85]], 5.6, 3.4)]] },
      { id: "forearm_f", ctx: 1, parts: [
        ["arm", [[-10.5, 62], [-4, 63], [3, 70], [5, 92], [3.5, 114], [-2.5, 118], [-6, 108], [-9.5, 86]]],
        ["arm", [[3.5, 59], [11, 64], [12.5, 76], [10, 96], [6, 114], [4.5, 100], [3.8, 78]]]],
        fan: [["arm", -10, 62, 4, 62, -4, 117, 3, 117, 5, 0.6], ["arm", 4, 60, 12, 64, 5, 112, 9, 110, 4, 0.5]] },
      { id: "tri_f", ctx: 1, parts: [["arm", [[10, 24], [14.5, 30], [15, 46], [12.5, 59], [10.4, 50], [9.4, 36]]]] },
      { id: "biceps_short", parts: [["arm", [[-1.2, 16], [-6, 19], [-10.5, 30], [-11.2, 43], [-8.8, 54], [-3.5, 61], [-1, 58], [-0.6, 36]]]],
        fan: [["arm", -2, 15, -9, 20, -2, 59, -7, 57, 4, 1.3]] },
      { id: "biceps_long", parts: [["arm", [[1.2, 16], [6, 18], [10.5, 28], [11.5, 42], [9, 53], [3.5, 61], [1.4, 58], [0.8, 36]]]],
        fan: [["arm", 1.5, 15, 9, 19, 1.5, 59, 6, 59, 4, 1.3]] },
      { id: "quads", parts: [
        [null, [[121, 226], [127, 224], [131, 236], [131, 262], [129, 282], [125, 293], [120, 283], [118, 258], [118.5, 238]]],
        [null, [[132, 230], [139, 226], [144, 237], [145.5, 254], [143.5, 274], [138, 291], [131.5, 299], [128.5, 292], [130.5, 270], [132, 248]]],
        [null, [[116, 262], [121, 258], [124, 276], [126, 291], [124, 304], [117, 307], [111, 301], [108.5, 289], [109.5, 274], [112, 266]]]],
        fan: [[null, 119, 226, 130, 224, 121, 290, 127, 292, 5, 1], [null, 132, 228, 143, 228, 130, 296, 140, 292, 6, 1.6], [null, 110, 264, 123, 258, 113, 304, 124, 302, 5, 1.2]] },
      { id: "core_obliques", parts: [[null, [[121.5, 140], [129, 138.5], [134, 142], [134.5, 152], [132, 166], [133.5, 182], [138, 194], [131, 197.5], [124, 192], [121.8, 180], [121.8, 160], [121.5, 148]]]],
        fan: [[null, 124, 138, 136, 150, 122, 168, 126, 192, 7, 1.4]] },
      { id: "core_upper", parts: [
        [null, [[101.8, 139, 1], [108, 137.5], [116, 138.5], [119.5, 142], [119, 148], [115, 151], [108, 151.8], [101.8, 150.5, 1]]],
        [null, [[101.8, 153, 1], [108, 152.8], [117, 153], [119.5, 157], [118.5, 162], [114, 165], [108, 165.5], [101.8, 164.5, 1]]]],
        fan: [[null, 102, 138, 119, 138, 102, 165, 118, 166, 5, 0.8]] },
      { id: "core_lower", parts: [
        [null, [[101.8, 167, 1], [108, 166.8], [116, 167.5], [118.5, 172], [117, 177], [112, 180], [108, 180.5], [101.8, 179.5, 1]]],
        [null, [[101.8, 182, 1], [108, 181.8], [114, 182.5], [116.5, 187], [115, 192], [110, 195], [104, 195.5], [101.8, 194, 1]]]],
        fan: [[null, 102, 166, 117, 166, 102, 195, 114, 196, 5, 0.8]] },
      { id: "chest_lower", parts: [[null, [[101.6, 122.6, 1], [115, 124], [128, 122.8], [139, 116.5], [144, 112.5], [138, 124], [128, 130.5], [115, 134.5], [101.6, 133.5, 1]]]],
        fan: [[null, 101.6, 123, 101.6, 134, 146, 112, 138, 122, 5, 1]] },
      { id: "chest_mid", parts: [[null, [[101.6, 109, 1], [113, 110.6], [126, 111.2], [140, 109.8], [148, 106.8], [145, 112], [138, 118], [128, 121], [115, 122.5], [101.6, 121, 1]]]],
        fan: [[null, 101.6, 109, 101.6, 122, 148, 108, 142, 116, 6, 1.2]] },
      { id: "chest_upper", parts: [[null, [[101.6, 95, 1], [112, 91.5], [126, 92], [139, 95.5], [146, 101], [148.5, 106], [140, 108.2], [126, 109], [113, 108.4], [101.6, 107.6, 1]]]],
        fan: [[null, 102, 94, 134, 90, 148, 107, 148, 100, 7, 1.2]] },
      { id: "shoulder_side", parts: [["arm", [[3.8, -10.5], [10, -10.5], [17, -4], [19.5, 8], [18, 22], [13, 32], [5, 36], [4.2, 24], [4.2, 8]]]],
        fan: [["arm", 5, -11, 19, 0, 4, 36, 12, 35, 6, 1.4]] },
      { id: "shoulder_front", parts: [["arm", [[-14.5, 0], [-9, -7.5], [0, -11], [3, -10.5], [3.6, 8], [3.4, 24], [3, 34.5], [-5, 28], [-11, 16], [-14.5, 6]]]],
        fan: [["arm", -14, -6, 3, -11, -4, 30, 2, 34, 6, 1.2]] }
    ],
    back: [
      { id: "adduct_b", ctx: 1, parts: [[null, strap([[104, 232], [107, 252], [108, 276], [106, 298]], 4.5, 3.5)]] },
      { id: "itband", ctx: 1, parts: [[null, strap([[144, 214], [145, 240], [143, 268], [137, 300]], 4.5, 3.5)]] },
      { id: "extensor_b", ctx: 1, parts: [["arm", [[-10, 62], [0, 60], [9, 68], [11, 86], [8, 104], [4.5, 116], [-2.5, 118], [-6, 106], [-9.5, 84]]]],
        fan: [["arm", -9, 62, 9, 66, -2, 116, 5, 114, 6, 0.6]] },
      { id: "infra", ctx: 1, parts: [[null, [[127, 104], [142, 101], [147, 110], [142, 123], [132, 127], [126, 116]]]],
        fan: [[null, 126, 104, 126, 124, 144, 104, 142, 122, 5, 1]] },
      { id: "teres", ctx: 1, parts: [[null, [[130, 127], [142, 123], [147, 131], [144, 141], [134, 141]]]],
        fan: [[null, 130, 128, 134, 140, 146, 126, 144, 140, 4, 0.5]] },
      { id: "soleus", ctx: 1, parts: [[null, [[124, 358], [133, 352], [132, 374], [125, 394], [119.5, 394], [118.5, 372]]]],
        fan: [[null, 120, 358, 132, 354, 120, 392, 128, 388, 4, 0.5]] },
      { id: "back_lats", parts: [[null, [[119, 138], [130, 131], [139, 123], [146, 114.5], [144, 126], [141, 140], [138, 154], [135, 168], [132, 180], [126, 192], [117, 198], [112, 190], [114, 176], [114, 160], [115, 148]]]],
        fan: [[null, 114, 198, 115, 148, 146, 120, 144, 124, 9, -2.4]] },
      { id: "back_mid", parts: [[null, [[101.6, 97, 1], [112, 96.5], [122, 99], [125.5, 110], [124.5, 124], [119.5, 136], [111, 148], [104, 158], [101.6, 163, 1]]]],
        fan: [[null, 101.6, 98, 101.6, 160, 126, 104, 118, 144, 9, 1]] },
      { id: "back_lower", parts: [
        [null, [[101.6, 52, 1], [108, 56], [112, 68], [122, 78], [138, 85], [150, 91.5], [148, 97], [134, 96], [122, 95], [110, 93], [101.6, 96, 1]]],
        [null, [[101.6, 148, 1], [108, 150], [113, 158], [113.5, 174], [113, 190], [109, 200], [101.6, 204, 1]]]],
        fan: [[null, 104, 56, 104, 94, 150, 92, 137, 97, 8, 1.6], [null, 102, 148, 112, 148, 103, 202, 111, 200, 5, 0.8]] },
      { id: "glutes", parts: [
        [null, [[101.6, 200, 1], [112, 194], [128, 196], [142, 205], [145.5, 220], [140, 236], [128, 245], [114, 245], [104, 237], [101.6, 224, 1]]],
        [null, [[120, 190], [133, 187.5], [143, 197], [141, 203], [128, 197]]]],
        fan: [[null, 101.6, 200, 101.6, 228, 143, 208, 138, 236, 8, 2.2], [null, 120, 190, 126, 186, 136, 200, 142, 198, 4, 0.6]] },
      { id: "hamstrings", parts: [
        [null, [[129, 246], [140, 242], [143.5, 258], [140.5, 282], [133, 299], [127, 292], [126, 266]]],
        [null, [[108, 248], [122, 246], [126.5, 268], [124.5, 292], [118, 303], [111.5, 297], [108, 272]]]],
        fan: [[null, 128, 244, 141, 241, 128, 296, 136, 296, 6, 1.4], [null, 108, 246, 124, 246, 112, 300, 121, 300, 6, 1.2]] },
      { id: "calves", parts: [
        [null, [[108.5, 316], [120, 314.5], [125.5, 330], [125, 350], [119.5, 370], [114, 376], [109.5, 358], [108, 336]]],
        [null, [[125.5, 318], [135.5, 320], [139, 334], [137, 352], [130, 368], [126, 358], [126, 336]]]],
        fan: [[null, 108, 316, 124, 316, 119, 376, 119, 376, 7, 1.6], [null, 126, 318, 138, 320, 120, 374, 124, 370, 5, 1.2]] },
      { id: "triceps_long", parts: [["arm", [[-10.5, 10], [-3, 8], [2, 20], [3.2, 38], [1, 54], [-4.5, 57], [-9.5, 45], [-12, 26]]]],
        fan: [["arm", -11, 8, -1, 7, -7, 56, 0, 56, 5, 1.3]] },
      { id: "triceps_lateral", parts: [
        ["arm", [[4.5, 16], [11, 17], [14, 30], [13.5, 46], [9.5, 56], [4.5, 56], [3.8, 38], [3.6, 24]]],
        ["arm", [[-3.5, 56], [1.5, 58], [4.5, 63], [-1, 65], [-6, 61]]]],
        fan: [["arm", 4, 16, 13, 18, 5, 58, 11, 54, 5, 1.2]] },
      { id: "delt_side_b", ctx: 1, parts: [["arm", [[3.8, -10.5], [10, -10.5], [17, -4], [19.5, 8], [18, 22], [13, 32], [5, 36], [4.2, 24], [4.2, 8]]]],
        fan: [["arm", 5, -11, 19, 0, 4, 36, 12, 35, 6, 1.4]] },
      { id: "shoulder_rear", parts: [["arm", [[-14.5, 0], [-9, -7.5], [0, -11], [3, -10.5], [3.6, 8], [3.4, 24], [3, 34.5], [-5, 28], [-11, 16], [-14.5, 6]]]],
        fan: [["arm", -14, -6, 3, -11, -4, 30, 2, 34, 6, 1.2]] }
    ]
  };

  // Female hair: a cap and a top knot, so the head reads as a woman's at a glance.
  // Right-half outlines from the crown to the hairline; closed into one shape.
  var HAIR = {
    front: [[100, 3.5], [110, 4.5], [118, 11], [120.5, 22], [120, 30], [116.5, 23], [111, 17.5], [100, 16]],
    back: [[100, 3.5], [110, 4.5], [118, 11], [120.5, 24], [118, 38], [112, 47], [100, 50]]
  };
  var BUN = [[100, -2], [106.5, 0], [108.5, 5], [104.5, 9.5], [100, 10.5]];
  function whole(P) {   // right-half outline (centre-line points first and last) -> one closed outline
    var M = mirror(P);
    return P.concat(M.slice(1, M.length - 1));
  }

  // Thin lines drawn on top (bones, grooves): [frame, points, open?]
  var LINES = {
    front: [[null, [[138, 195], [126, 205], [112, 214], [101, 219]]], [null, [[103, 87.5], [118, 89], [134, 91], [150, 94.5]]], [null, [[100.2, 168.5], [101.5, 170.5], [100.2, 173]]]],
    back: [[null, [[124, 98.5], [136, 98], [148, 95]]]]
  };

  // ----------------------------------------------------------- build / cache
  var built = {};
  function build(sex, view) {
    var key = sex + view;
    if (built[key]) return built[key];
    var out = { sil: [], regs: [], lines: [], bust: null }, fem = sex === "female";

    SIL[view].forEach(function (part) {
      var P = placeAll(sex, part[0], part[1]), M = mirror(P), b = bbox(P);
      out.sil.push({ d: splineD(P, true) + splineD(M, true), box: union(b, mirrorBox(b)) });
    });

    DEF[view].forEach(function (def) {
      var halves = [], box = null, fibres = "", lowX = 1e9;
      def.parts.forEach(function (part) {
        var P = placeAll(sex, part[0], part[1]), b = bbox(P);
        lowX = Math.min(lowX, b[0]);
        halves.push({ r: splineD(P, true), l: splineD(mirror(P), true) });
        box = box ? union(box, b) : b;
      });
      var mid = lowX < 106;   // touches the centre line: both halves belong to one crop
      (def.fan || []).forEach(function (fan) {
        var spec = fan.slice(1), frame = fan[0];
        fibres += fibreD(sex, frame, spec, false) + fibreD(sex, frame, spec, true);
      });
      out.regs.push({ id: def.id, ctx: !!def.ctx, halves: halves, fibres: fibres, box: box, mid: mid,
        boxAll: union(box, mirrorBox(box)) });
    });

    LINES[view].forEach(function (ln) {
      var P = placeAll(sex, ln[0], ln[1]);
      out.lines.push({ d: splineD(P, false) + splineD(mirror(P), false), box: union(bbox(P), mirrorBox(bbox(P))) });
    });

    if (fem) {
      out.hair = splineD(whole(placeAll(sex, null, HAIR[view])), true) + splineD(whole(placeAll(sex, null, BUN)), true);
      out.hairBox = [80, -4, 120, 52];
    }
    if (fem && view === "front") {
      var under = placeAll(sex, null, [[103, 129], [110, 138], [120, 142], [133, 139.5], [141, 130], [144.5, 118]]);
      out.bust = splineD(under, false) + splineD(mirror(under), false);
      out.bustBox = [54, 114, 146, 148];
    }
    built[key] = out;
    return out;
  }

  var uid = 0;
  function gradDefs(p) {
    function g(id, a, b) {
      return '<radialGradient id="' + p + id + '" cx=".5" cy=".36" r=".78"><stop offset="0" style="stop-color:var(--mus-' + a +
        ')"/><stop offset="1" style="stop-color:var(--mus-' + b + ')"/></radialGradient>';
    }
    return "<defs>" + g("m", "m-hi", "m-lo") + g("h", "hi-a", "hi-b") + g("h2", "hi2-a", "hi2-b") +
      '<linearGradient id="' + p + 's" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--mus-skin-a)"/>' +
      '<stop offset="1" style="stop-color:var(--mus-skin-b)"/></linearGradient></defs>';
  }

  function regionSvg(p, r, cls, grad) {
    var id = r.id, s = '<g class="' + cls + '"' + (r.ctx ? "" : ' data-region="' + id + '"') + ">", clip = "", i, h;
    for (i = 0; i < r.halves.length; i++) {
      h = r.halves[i];
      s += '<path id="' + p + id + i + 'r" class="ma-sh" fill="url(#' + p + grad + ')" d="' + h.r + '"/>' +
        '<path id="' + p + id + i + 'l" class="ma-sh" fill="url(#' + p + grad + ')" d="' + h.l + '"/>';
      clip += '<use href="#' + p + id + i + 'r"/><use href="#' + p + id + i + 'l"/>';
    }
    if (r.fibres) {
      s += '<clipPath id="' + p + "c" + id + '">' + clip + '</clipPath><path class="ma-fb" clip-path="url(#' + p + "c" + id + ')" d="' + r.fibres + '"/>';
    }
    return s + "</g>";
  }

  // lit: {id: "ma-hi" | "ma-hi2"}; crop: [x, y, size] or null for the whole view
  function render(view, sex, lit, crop) {
    var V = build(sex, view), p = "ma" + (++uid) + "_", box = crop ? [crop[0], crop[1], crop[0] + crop[2], crop[1] + crop[2]] : null;
    var vb = crop ? f1(crop[0]) + " " + f1(crop[1]) + " " + f1(crop[2]) + " " + f1(crop[2]) : "0 0 " + W + " " + H;
    var out = '<svg class="ma-svg ma-' + sex + '" viewBox="' + vb + '" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">' + gradDefs(p);
    var sil = V.sil.filter(function (s) { return !box || hits(s.box, box); });
    sil.forEach(function (s) { out += '<path class="ma-out" d="' + s.d + '"/>'; });
    sil.forEach(function (s) { out += '<path class="ma-sil" fill="url(#' + p + 's)" d="' + s.d + '"/>'; });
    if (V.hair && (!box || hits(V.hairBox, box))) out += '<path class="ma-hair" d="' + V.hair + '"/>';
    V.regs.forEach(function (r) {
      if (box && !hits(r.boxAll, box)) return;
      var cls = lit[r.id] || (r.ctx ? "ma-m ma-ctx" : "ma-m");
      out += regionSvg(p, r, cls, lit[r.id] === "ma-hi" ? "h" : lit[r.id] === "ma-hi2" ? "h2" : "m");
    });
    V.lines.forEach(function (l) { if (!box || hits(l.box, box)) out += '<path class="ma-ln" d="' + l.d + '"/>'; });
    if (V.bust && (!box || hits(V.bustBox, box))) out += '<path class="ma-bust-s" d="' + V.bust + '"/><path class="ma-bust" d="' + V.bust + '"/>';
    return out + "</svg>";
  }

  // Square crop around a set of regions (viewer's right half; both halves when
  // the muscles sit on the centre line).
  function cropFor(sex, view, ids, group) {
    var V = build(sex, view), box = null, spec = CROP[group] || [0.3, 84];
    V.regs.forEach(function (r) {
      if (ids.indexOf(r.id) === -1) return;
      var b = r.mid || spec[2] ? r.boxAll : r.box;
      box = box ? union(box, b) : b;
    });
    if (!box) return null;
    var w = box[2] - box[0], h = box[3] - box[1], s = Math.max(spec[1], Math.max(w, h) * (1 + spec[0]));
    var x = (box[0] + box[2]) / 2 - s / 2, y = (box[1] + box[3]) / 2 - s / 2;
    x = Math.max(0, Math.min(W - s, x));
    y = Math.max(0, Math.min(H - s, y));
    return [x, y, s];
  }

  function viewOf(id) {
    for (var v in VIEWS) { if (DEF[v].some(function (d) { return d.id === id && !d.ctx; })) return v; }
    return null;
  }
  function sexOf(o) { return o && o.sex === "female" ? "female" : "male"; }

  function closeup(id, o) {
    var view = viewOf(id);
    if (!view) return "";
    var sex = sexOf(o), lit = {}, sec = o && o.secondary;
    if (sec && sec !== id && viewOf(sec) === view) lit[sec] = "ma-hi2";
    lit[id] = "ma-hi";
    return render(view, sex, lit, cropFor(sex, view, Object.keys(lit), GROUP[id]));
  }

  function group(name, o) {
    var ids = REGIONS.filter(function (r) { return GROUP[r] === name; });
    if (!ids.length) return "";
    var view = viewOf(ids[0]), sex = sexOf(o), lit = {};
    ids = ids.filter(function (r) { return viewOf(r) === view; });
    ids.forEach(function (r) { lit[r] = "ma-hi"; });
    return render(view, sex, lit, cropFor(sex, view, ids, name));
  }

  function figure(view, o) {
    if (!DEF[view]) return "";
    var lit = {};
    ((o && o.lit) || []).forEach(function (r) { if (viewOf(r) === view) lit[r] = "ma-hi"; });
    return render(view, sexOf(o), lit, null);
  }

  window.GymMuscleArt = { REGIONS: REGIONS, viewOf: viewOf, closeup: closeup, group: group, figure: figure };
})();
