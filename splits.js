/* splits.js - training splits by days per week (3/4/5/6), gym or home.
 *
 * Data-only templates plus a pure builder:
 *
 *   GymSplits.buildPlan({ days, where, sex, tools }) -> { days, week, gaps }
 *
 * `days` come out in the shape app.js already renders (id, label, muscles,
 * exercises[{id,en,sets,reps,rest,vid,shape,shape2?,tier,tools}]), plus
 * labelAr / musclesAr (app.js looks Arabic day labels up by English label, and
 * these split labels are not in AR_DAY / AR_MUS yet). `week` is a 7-slot array
 * (Mon first) of day ids with null for rest days, like WEEK_MALE in app.js.
 *
 * Only exercises that already exist in the app.js library are used, under their
 * existing ids, so weight logs carry over. Nothing here invents a video. When a
 * muscle part can't be trained with the ticked tools, the slot falls back to the
 * next-best part of the same muscle and the gap is returned in `gaps`.
 *
 * Loads in the browser (window.GymSplits) and in Node (module.exports), no DOM.
 */
(function (root) {
  "use strict";

  var DAYS = [3, 4, 5, 6];
  // 0 = Monday ... 6 = Sunday. The existing rest-day logic still applies.
  var WEEKDAYS = { 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

  var HOME_TOOLS = ["none", "dumbbell", "band", "bench", "table", "pullup_bar", "kettlebell", "jump_rope"];
  var GYM_TOOLS = HOME_TOOLS.concat(["barbell", "cable", "machine"]);

  // The 20 muscle regions (MUSCLE_SHAPES in app.js) and the muscle group each belongs to.
  var REGIONS = {
    chest_upper: "Chest", chest_mid: "Chest", chest_lower: "Chest",
    back_lats: "Back", back_mid: "Back", back_lower: "Back",
    shoulder_front: "Shoulders", shoulder_side: "Shoulders", shoulder_rear: "Shoulders",
    biceps_long: "Biceps", biceps_short: "Biceps",
    triceps_long: "Triceps", triceps_lateral: "Triceps",
    quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves",
    core_upper: "Core", core_lower: "Core", core_obliques: "Core"
  };

  // ---- library: the app.js exercises this module may schedule (one canonical id per move) ----
  // kind drives reps: compound 5-8 / 6-10, secondary 8-12, isolation 12-20,
  // endurance (bodyweight moves you can't load) 12-20, hold = seconds.
  function L(en, vid, shape, shape2, tier, tools, kind, reps, rest) {
    return { en: en, vid: vid, shape: shape, shape2: shape2, tier: tier, tools: tools, kind: kind, reps: reps, rest: rest };
  }
  var LIB = {
    mua_bench: L("Barbell Bench Press", "0cXAp6WhSj4", "chest_mid", null, "hard", ["barbell", "bench"], "compound", "5-8", 150),
    ctb_dbbench: L("Dumbbell Bench Press", "Gf65Yy0-wGI", "chest_mid", null, "medium", ["dumbbell", "bench"], "compound", "6-10", 90),
    ctb_pushup: L("Push-ups", "wD1M-f69Yy8", "chest_mid", null, "easy", ["none"], "secondary", "8-12", 60),
    cta_fly: L("Cable Chest Fly", "I-Ue34qLxc4", "chest_mid", null, "easy", ["cable"], "isolation", "12-15", 60),
    mub_incline: L("Incline Dumbbell Press", "8fXfwG4ftaQ", "chest_upper", null, "medium", ["dumbbell", "bench"], "compound", "6-10", 90),
    mua_pulldown: L("Lat Pulldown / Pull-up", "bNmvKpJSWKM", "back_lats", null, "medium", ["cable"], "compound", "6-10", 120),
    pv_cablerow: L("Seated Cable Row", "8QuMq1GMMng", "back_mid", null, "easy", ["cable"], "compound", "6-10", 90),
    mua_row: L("Chest-Supported Row", "uhwcRYpkjvc", "back_mid", null, "medium", ["machine"], "compound", "6-10", 90),
    bbb_tbar: L("T-Bar Row", "1iQSSqin3ro", "back_mid", null, "hard", ["machine"], "compound", "6-10", 90),
    mub_row: L("Chest-Supported Dumbbell Row", "09wri23R4SU", "back_mid", null, "easy", ["dumbbell", "bench"], "secondary", "8-12", 60),
    fua_row: L("One-Arm Dumbbell Row", "H8jf3DwlIlo", "back_mid", null, "medium", ["dumbbell"], "secondary", "8-12/arm", 45),
    mcx_row: L("Inverted Row (under a table)", "VO-pt_XgFho", "back_lats", null, "medium", ["table"], "secondary", "8-12", 60),
    mcx_superman: L("Superman", "uexOGyxLr7E", "back_lower", null, "easy", ["none"], "isolation", "12-15", 30),
    mua_ohp: L("Seated Dumbbell Shoulder Press", "k6tzKisR3NY", "shoulder_front", null, "medium", ["dumbbell", "bench"], "compound", "6-10", 90),
    mub_arnold: L("Arnold Press", "AjB-UXErljM", "shoulder_front", null, "medium", ["dumbbell"], "secondary", "8-12", 60),
    mcp_pike: L("Pike Push-ups", "XckEEwa1BPI", "shoulder_front", null, "medium", ["none"], "secondary", "8-12", 60),
    mua_lateral: L("Dumbbell Lateral Raise", "Kl3LEzQ5Zqs", "shoulder_side", null, "easy", ["dumbbell"], "isolation", "15-20", 30),
    mua_facepull: L("Band Face Pull", "JBpj9-3tP0c", "shoulder_rear", null, "easy", ["band"], "isolation", "15-20", 30),
    mub_pullapart: L("Band Pull-Apart", "qi2y-eI_kuI", "shoulder_rear", null, "easy", ["band"], "isolation", "15-20", 30),
    mua_curl: L("Barbell Curl", "ZQWL7omZh94", "biceps_short", null, "medium", ["barbell"], "secondary", "8-12", 60),
    bba_inclcurl: L("Incline Dumbbell Curl", "XhIsIcjIbCw", "biceps_long", null, "medium", ["dumbbell", "bench"], "isolation", "12-15", 45),
    mub_hammer: L("Hammer Curl", "K9LiwcGuqA0", "biceps_long", null, "medium", ["dumbbell"], "isolation", "12-15", 30),
    fua_arms: L("Biceps Curl + Triceps Extension (superset)", "8UIbEovL-xU", "biceps_short", "triceps_long", "medium", ["dumbbell"], "isolation", "12-15", 45),
    cta_ohext: L("Overhead Cable Triceps Extension", "tPIWaCKWFF8", "triceps_long", null, "medium", ["cable"], "isolation", "12-15", 45),
    mua_pushdown: L("Cable Rope Pushdown", "7OF77JMEXhM", "triceps_lateral", null, "easy", ["cable"], "isolation", "12-15", 45),
    mub_dips: L("Bench Dips", "ekgvqS_4Ee4", "triceps_lateral", null, "easy", ["bench"], "secondary", "8-12", 45),
    mla_squat: L("Barbell Back Squat", "tNUq6b5t11Q", "quads", null, "hard", ["barbell"], "compound", "5-8", 150),
    mlb_hack: L("Hack Squat", "g9i05umL5vc", "quads", null, "medium", ["machine"], "compound", "6-10", 120),
    mla_legpress: L("Leg Press", "nDh_BlnLCGc", "quads", null, "easy", ["machine"], "secondary", "8-12", 90),
    fla_goblet: L("Goblet Squat", "0OWbS1WiUGU", "quads", null, "easy", ["dumbbell"], "secondary", "8-12", 60),
    flb_sumo: L("Dumbbell Sumo Squat", "bRCjBCtBGIo", "quads", "glutes", "medium", ["dumbbell"], "secondary", "8-12", 60),
    mcl_squat: L("Bodyweight Squats", "3fl7uYmiMVw", "quads", null, "easy", ["none"], "endurance", "15-20", 45),
    bbb_bss: L("Bulgarian Split Squat", "uODWo4YqbT8", "quads", null, "hard", ["dumbbell", "bench"], "secondary", "8-12/leg", 75),
    fla_lunge: L("Reverse Lunge (Dumbbell)", "YXL_f378hLM", "quads", null, "medium", ["dumbbell"], "secondary", "8-12/leg", 60),
    mcl_lunge: L("Reverse Lunges", "ufjvjxrGyFM", "quads", null, "easy", ["none"], "endurance", "12-16/leg", 45),
    mlb_legext: L("Leg Extension", "iQ92TuvBqRo", "quads", null, "easy", ["machine"], "isolation", "12-15", 60),
    mla_rdl: L("Barbell Romanian Deadlift", "zdip4iexlxg", "hamstrings", "back_lower", "hard", ["barbell"], "compound", "6-10", 90),
    fla_rdl: L("Dumbbell Romanian Deadlift", "hu3jRvTc_po", "hamstrings", null, "medium", ["dumbbell"], "secondary", "8-12", 60),
    mlb_sldl: L("Single-Leg Dumbbell RDL", "kQf5g0y0mO4", "hamstrings", null, "hard", ["dumbbell"], "secondary", "8-12/leg", 45),
    mla_legcurl: L("Lying Leg Curl", "bgfHeL6eR9Q", "hamstrings", null, "easy", ["machine"], "isolation", "12-15", 60),
    mlb_seatcurl: L("Seated Leg Curl", "xdbEG3xGLI8", "hamstrings", null, "easy", ["machine"], "isolation", "12-15", 60),
    mla_bridge: L("Dumbbell Glute Bridge", "12m6GW59LvQ", "glutes", null, "easy", ["dumbbell"], "isolation", "15-20", 45),
    mcl_bridge: L("Glute Bridge", "12m6GW59LvQ", "glutes", null, "easy", ["none"], "endurance", "15-20", 30),
    mlb_kickback: L("Band Glute Kickback", "aw9WClmz5jw", "glutes", null, "easy", ["band"], "isolation", "15-20/leg", 30),
    mla_calf: L("Standing Calf Raise", "B30JglFGx8Y", "calves", null, "easy", ["none"], "isolation", "15-20", 30),
    mlb_calf: L("Seated Calf Raise (Dumbbell)", "NrHJPauB01I", "calves", null, "easy", ["dumbbell", "bench"], "isolation", "15-20", 30),
    mcp_plank: L("Plank (core)", "fWW5d1ZFhk4", "core_upper", null, "medium", ["none"], "hold", "30-45s", 30),
    mcp_hollow: L("Hollow Body Hold", "Xk-JcNj6lfY", "core_lower", "core_upper", "medium", ["none"], "hold", "20-30s", 30),
    mla_core: L("Hanging Leg Raise (core)", "0wSUjj5j1xo", "core_lower", null, "hard", ["pullup_bar"], "secondary", "8-12", 45),
    flb_legraise: L("Lying Leg Raise (core)", "jrSWj0huh5o", "core_lower", null, "medium", ["none"], "isolation", "12-15", 30),
    fla_deadbug: L("Dead Bug (core)", "XcYtWYMz39w", "core_lower", null, "easy", ["none"], "secondary", "8-12/side", 30),
    mcx_flutter: L("Flutter Kicks", "pRZhSdw5Tqg", "core_lower", "quads", "easy", ["none"], "hold", "30s", 30),
    mlb_core: L("Pallof Press (core)", "P1H4IzD9rbQ", "core_obliques", null, "medium", ["cable"], "secondary", "8-12/side", 45),
    nb_towelcurl: L("Towel Door Curl", "leaEyx33mHw", "biceps_short", "biceps_long", "easy", ["none"], "isolation", "12-15", 45),
    nb_diamond: L("Diamond Push-ups", "PPTj-MW2tcs", "triceps_lateral", null, "medium", ["none"], "secondary", "8-12", 60),
    nb_hinge1: L("Single-Leg Hip Hinge", "JQZqPsmeesc", "hamstrings", null, "medium", ["none"], "secondary", "8-12/leg", 45),
    nb_slidecurl: L("Towel Sliding Hamstring Curl", "cjtsLDniFpk", "hamstrings", null, "medium", ["none"], "secondary", "8-12", 60),
    mcx_bear: L("Bear Crawl", "-9L3rTrYo4Q", "core_obliques", "shoulder_front", "medium", ["none"], "hold", "30s", 45)
  };

  // ---- parts: one slot target each, with moves ranked best first. `f` re-ranks for the women's
  // versions (dumbbell-led, like DAYS_FEMALE); `fb` is the next-best part of the same muscle. ----
  var PARTS = {
    chest_upper: { r: ["mub_incline"], fb: ["chest_mid"] },
    chest_mid: { r: ["mua_bench", "ctb_dbbench", "ctb_pushup", "cta_fly"], fb: [] },
    back_lats: { r: ["mua_pulldown", "mcx_row"], fb: ["back_mid", "back_lower"] },
    back_mid: { r: ["pv_cablerow", "mua_row", "bbb_tbar", "mub_row", "fua_row", "mcx_row"], fb: ["back_lats", "back_lower"] },
    back_lower: { r: ["mcx_superman"], fb: [] },
    shoulder_front: { r: ["mua_ohp", "mub_arnold", "mcp_pike"], fb: [] },
    shoulder_side: { r: ["mua_lateral"], fb: ["shoulder_rear", "shoulder_front"] },
    shoulder_rear: { r: ["mua_facepull", "mub_pullapart"], fb: ["shoulder_side", "shoulder_front"] },
    biceps_long: { r: ["bba_inclcurl", "mub_hammer"], fb: ["biceps_short", "biceps_bw"] },
    biceps_short: { r: ["mua_curl", "fua_arms"], fb: ["biceps_long", "biceps_bw"] },
    biceps_bw: { r: ["nb_towelcurl"], fb: [] },
    // the biceps + triceps superset; with no dumbbell the builder splits the slot into biceps_any + triceps_any
    arms: { r: ["fua_arms"], fb: [] },
    biceps_any: { r: [], fb: ["biceps_short", "biceps_long", "biceps_bw"] },
    triceps_any: { r: [], fb: ["triceps_long", "triceps_lateral", "triceps_bw"] },
    triceps_long: { r: ["cta_ohext", "fua_arms"], fb: ["triceps_lateral", "triceps_bw"] },
    triceps_lateral: { r: ["mua_pushdown", "mub_dips"], fb: ["triceps_bw", "triceps_long"] },
    triceps_bw: { r: ["nb_diamond"], fb: [] },
    quads_squat: { r: ["mla_squat", "mlb_hack", "mla_legpress", "fla_goblet", "flb_sumo", "mcl_squat"], f: ["fla_goblet", "flb_sumo", "mla_legpress", "mlb_hack", "mla_squat", "mcl_squat"], fb: ["quads_uni"] },
    quads_uni: { r: ["bbb_bss", "fla_lunge", "mcl_lunge"], fb: ["quads_squat"] },
    quads_iso: { r: ["mlb_legext"], fb: ["quads_uni", "quads_squat"] },
    ham_hinge: { r: ["mla_rdl", "fla_rdl", "mlb_sldl"], f: ["fla_rdl", "mlb_sldl", "mla_rdl"], fb: ["ham_curl", "ham_hinge_bw"] },
    ham_curl: { r: ["mla_legcurl", "mlb_seatcurl"], fb: ["ham_hinge", "ham_curl_bw"] },
    ham_hinge_bw: { r: ["nb_hinge1"], fb: [] },
    ham_curl_bw: { r: ["nb_slidecurl"], fb: [] },
    glute_main: { r: ["mla_bridge", "mcl_bridge"], fb: ["glute_iso"] },
    glute_dual: { r: ["flb_sumo"], fb: ["glute_main", "glute_iso"] },
    glute_iso: { r: ["mlb_kickback", "mla_bridge", "mcl_bridge"], fb: ["glute_main"] },
    calf_stand: { r: ["mla_calf"], fb: ["calf_seat"] },
    calf_seat: { r: ["mlb_calf", "mla_calf"], fb: [] },
    core_upper: { r: ["mcp_plank", "mcp_hollow"], fb: ["core_lower"] },
    core_hollow: { r: ["mcp_hollow"], fb: ["core_upper", "core_lower"] },
    core_lower: { r: ["mla_core", "flb_legraise", "fla_deadbug", "mcp_hollow", "mcx_flutter"], fb: ["core_upper"] },
    core_obliques: { r: ["mlb_core", "mcx_bear"], fb: ["core_lower", "core_upper"] }
  };
  // The region (muscle tag) each part trains, for `gaps`.
  var PART_REGION = {
    chest_upper: "chest_upper", chest_mid: "chest_mid", back_lats: "back_lats", back_mid: "back_mid", back_lower: "back_lower",
    shoulder_front: "shoulder_front", shoulder_side: "shoulder_side", shoulder_rear: "shoulder_rear",
    biceps_long: "biceps_long", biceps_short: "biceps_short", triceps_long: "triceps_long", triceps_lateral: "triceps_lateral",
    quads_squat: "quads", quads_uni: "quads", quads_iso: "quads", ham_hinge: "hamstrings", ham_curl: "hamstrings",
    glute_main: "glutes", glute_dual: "glutes", glute_iso: "glutes", arms: "biceps_short", biceps_any: "biceps_short", triceps_any: "triceps_lateral", biceps_bw: "biceps_short", triceps_bw: "triceps_lateral", ham_hinge_bw: "hamstrings", ham_curl_bw: "hamstrings", core_hollow: "core_lower", calf_stand: "calves", calf_seat: "calves",
    core_upper: "core_upper", core_lower: "core_lower", core_obliques: "core_obliques"
  };

  // Moves the library does not have that would close a part (clips the owner must supply);
  // from tools/split-gaps.mjs. Used only to name the fix in `gaps`.
  function F(en, tools) { return { en: en, tools: tools }; }
  var FILLS = {
    chest_upper: [F("Decline (Feet-Elevated) Push-ups", ["none"])],
    back_lats: [F("Pull-ups", ["pullup_bar"]), F("Band Lat Pulldown", ["band"])],
    back_mid: [F("Doorway Towel Row", ["none"]), F("Band Row", ["band"])],
    shoulder_side: [F("Band Lateral Raise", ["band"])],
    shoulder_rear: [F("Prone Y-T Raise", ["none"]), F("Dumbbell Rear Delt Fly", ["dumbbell"])],
    biceps_long: [F("Band Curl", ["band"])],
    biceps_short: [F("Chin-ups", ["pullup_bar"]), F("Band Curl", ["band"])],
    biceps_any: [F("Band Curl", ["band"])],
    arms: [F("Band Curl", ["band"]), F("Dumbbell Overhead Triceps Extension", ["dumbbell"])],
    triceps_long: [F("Bodyweight Triceps Extension", ["table"]), F("Dumbbell Overhead Triceps Extension", ["dumbbell"]), F("Band Overhead Triceps Extension", ["band"])],
    triceps_lateral: [F("Band Triceps Pushdown", ["band"])],
    quads_iso: [F("Sissy Squat", ["none"])],
    ham_hinge: [F("Kettlebell Romanian Deadlift", ["kettlebell"])],
    calf_seat: [F("Bent-Knee Calf Raise (soleus)", ["none"])],
    core_obliques: [F("Side Plank", ["none"]), F("Band Pallof Press", ["band"])]
  };
  var REGION_FILLS = {
    chest_lower: [F("Hands-Elevated Push-ups", ["none"]), F("Chest Dips", ["machine"])]
  };
  // regions whose parts are named differently (hamstrings = hinge + curl, quads = squat/lunge/extension)
  REGION_FILLS.hamstrings = FILLS.ham_hinge;
  REGION_FILLS.quads = FILLS.quads_iso;
  REGION_FILLS.calves = FILLS.calf_seat;

  // ---- templates ----
  // A slot is "part:sets". The builder fills it with the best allowed move of that part,
  // rotating to the next-best move the plan hasn't used yet, so A/B days use different angles.
  // Women's versions (`f`) tweak the men's day: `sets` overrides, `add` slots, `drop` parts.
  // Budget (beginner volume): 8 exercises max per day on 3-day plans, 7 on 4/5/6-day plans;
  // every muscle group 8-14 working sets a week (hard cap 16). "arms" is one superset move that
  // trains biceps and triceps together; "core_hollow" trains upper and lower core in one move.
  var LOWER_A = ["quads_squat:4", "ham_hinge:3", "glute_main:4", "ham_curl:2", "calf_stand:4", "core_hollow:3", "core_obliques:2"];
  var LOWER_B = ["quads_uni:4", "ham_hinge:3", "glute_iso:4", "ham_curl:2", "calf_seat:4", "core_hollow:3", "core_obliques:2"];
  var LOWER_A_F = { sets: { quads_squat: 5, glute_main: 5, ham_curl: 3 } };
  var LOWER_B_F = { sets: { quads_uni: 5, glute_iso: 5, ham_curl: 3 } };
  var UPPER_AR = "صدر، ظهر، أكتاف، ذراعين";
  var LOWER_AR = "أمامية الفخذ، خلفية الفخذ، ألوية، سمانة، بطن";
  var PUSH_AR = "صدر، أكتاف، ترايسبس";
  var PULL_AR = "ظهر، أكتاف خلفية، بايسبس";
  var UPPER_EN = "Chest, Back, Shoulders, Arms", LOWER_EN = "Quads, Hamstrings, Glutes, Calves, Abs";
  var PUSH_EN = "Chest, Shoulders, Triceps", PULL_EN = "Back, Rear Delts, Biceps";
  var PUSH = ["chest_mid:3", "chest_upper:2", "shoulder_front:2", "shoulder_side:2", "triceps_long:2", "triceps_lateral:2"];
  var PULL_A = ["back_lats:2", "back_mid:2", "shoulder_rear:2", "biceps_long:2", "biceps_short:2", "back_lower:2"];
  var PULL_B = ["back_lats:2", "back_mid:2", "shoulder_rear:2", "biceps_long:2", "biceps_short:2"];
  function D(key, label, labelAr, en, ar, m, f) { return { key: key, label: label, labelAr: labelAr, muscles: en, musclesAr: ar, m: m, f: f }; }
  var TEMPLATES = {
    3: {
      days: [
        D("fullA", "Full Body A", "كامل الجسم أ", "Full body", "الجسم كامل",
          ["chest_mid:3", "back_lats:2", "quads_squat:4", "ham_hinge:4", "shoulder_side:4", "chest_upper:3", "calf_stand:4", "core_hollow:4"], { sets: { chest_mid: 2 } }),
        D("fullB", "Full Body B", "كامل الجسم ب", "Full body", "الجسم كامل",
          ["chest_mid:3", "back_mid:2", "ham_hinge:4", "glute_dual:4", "arms:4", "calf_seat:4", "core_hollow:4"], { sets: { chest_mid: 2, glute_dual: 5 } }),
        D("fullC", "Full Body C", "كامل الجسم ج", "Full body", "الجسم كامل",
          ["back_lats:2", "back_mid:2", "quads_uni:4", "glute_iso:4", "shoulder_front:3", "arms:4", "shoulder_rear:2", "chest_upper:3"], { sets: { glute_iso: 5 } })
      ]
    },
    4: {
      days: [
        D("upperA", "Upper A", "علوي أ", UPPER_EN, UPPER_AR,
          ["chest_mid:3", "back_lats:3", "back_mid:2", "shoulder_front:2", "shoulder_side:2", "arms:4", "chest_upper:3"]),
        D("lowerA", "Lower A", "سفلي أ", LOWER_EN, LOWER_AR, LOWER_A, LOWER_A_F),
        D("upperB", "Upper B", "علوي ب", UPPER_EN, UPPER_AR,
          ["chest_mid:4", "back_lats:3", "back_mid:2", "shoulder_front:2", "shoulder_side:2", "arms:4", "shoulder_rear:2"]),
        D("lowerB", "Lower B", "سفلي ب", LOWER_EN, LOWER_AR, LOWER_B, LOWER_B_F)
      ]
    },
    5: {
      days: [
        D("upper", "Upper", "علوي", UPPER_EN, UPPER_AR,
          ["chest_mid:3", "back_lats:2", "back_mid:2", "shoulder_front:2", "shoulder_side:2", "arms:4", "chest_upper:2"]),
        D("lower", "Lower", "سفلي", LOWER_EN, LOWER_AR, LOWER_A, LOWER_A_F),
        D("push", "Push", "دفع", PUSH_EN, PUSH_AR, PUSH),
        D("pull", "Pull", "سحب", PULL_EN, PULL_AR, ["back_lats:2", "back_mid:2", "shoulder_rear:2", "biceps_long:3", "biceps_short:3", "back_lower:2"]),
        D("legs", "Legs", "أرجل", LOWER_EN, LOWER_AR, LOWER_B, LOWER_B_F)
      ]
    },
    6: {
      days: [
        D("pushA", "Push A", "دفع أ", PUSH_EN, PUSH_AR, PUSH),
        D("pullA", "Pull A", "سحب أ", PULL_EN, PULL_AR, PULL_A),
        D("legsA", "Legs A", "أرجل أ", LOWER_EN, LOWER_AR, LOWER_A, LOWER_A_F),
        D("pushB", "Push B", "دفع ب", PUSH_EN, PUSH_AR, PUSH),
        D("pullB", "Pull B", "سحب ب", PULL_EN, PULL_AR, PULL_B),
        D("legsB", "Legs B", "أرجل ب", LOWER_EN, LOWER_AR, LOWER_B, LOWER_B_F)
      ]
    }
  };

  // ---- builder ----
  function fits(tools, have) {
    for (var i = 0; i < tools.length; i++) if (tools[i] !== "none" && have.indexOf(tools[i]) < 0) return false;
    return true;
  }
  function parseSlot(s) { var p = s.split(":"); return { part: p[0], sets: +p[1] }; }
  function daySlots(day, sex) {
    var slots = day.m.map(parseSlot);
    var f = sex === "female" ? day.f : null;
    if (!f) return slots;
    if (f.drop) slots = slots.filter(function (s) { return f.drop.indexOf(s.part) < 0; });
    if (f.sets) slots.forEach(function (s) { if (f.sets[s.part]) s.sets = f.sets[s.part]; });
    if (f.add) f.add.forEach(function (s) { slots.push(parseSlot(s)); });
    return slots;
  }
  function cheapestFill(part, have) {
    var list = FILLS[part] || [];
    var fit = list.filter(function (x) { return fits(x.tools, have); });
    return fit.length ? fit[0] : null;
  }
  function tickFor(part) {
    var list = FILLS[part] || [];
    for (var i = 0; i < list.length; i++) if (list[i].tools[0] !== "none") return { en: list[i].en, tools: list[i].tools };
    return null;
  }

  function buildPlan(o) {
    o = o || {};
    var days = DAYS.indexOf(+o.days) >= 0 ? +o.days : 4;
    var where = o.where === "home" ? "home" : "gym";
    var sex = o.sex === "female" ? "female" : "male";
    var have = where === "gym" ? GYM_TOOLS : HOME_TOOLS.filter(function (t) { return t === "none" || (o.tools || []).indexOf(t) >= 0; });
    var used = {}; // exercise id -> times scheduled in this plan
    var gaps = [];
    var out = [];

    function allowed(partId) {
      var p = PARTS[partId];
      var ids = (sex === "female" && p.f) || p.r;
      return ids.filter(function (id) { return fits(LIB[id].tools, have); });
    }
    function pickFrom(ids, dayEx) {
      var best = null;
      ids.forEach(function (id, rank) {
        if (dayEx.some(function (e) { return e.id === id; })) return;
        var score = (used[id] || 0) * 100 + rank;
        if (!best || score < best.score) best = { id: id, score: score };
      });
      return best && best.id;
    }
    function addEx(dayEx, id, sets) {
      var m = LIB[id];
      var ex = { id: id, en: m.en, sets: sets, reps: m.reps, rest: m.rest, vid: m.vid, shape: m.shape };
      if (m.shape2) ex.shape2 = m.shape2;
      ex.tier = m.tier;
      ex.tools = m.tools.slice();
      dayEx.push(ex);
      used[id] = (used[id] || 0) + 1;
    }
    function merge(dayEx, id, sets) {
      var ex = dayEx.filter(function (e) { return e.id === id; })[0];
      ex.sets = Math.min(ex.id === "fua_arms" ? 3 : 4, ex.sets + sets); // the superset counts for two groups
    }
    function gap(kind, dayKey, partId, usedId) {
      var fill = cheapestFill(partId, have);
      var tick = fill ? null : tickFor(partId);
      gaps.push({
        kind: kind, day: dayKey, part: partId, region: PART_REGION[partId], group: REGIONS[PART_REGION[partId]],
        used: usedId || null, needs: fill ? fill.en : (tick ? tick.en : null), tick: tick ? tick.tools : null
      });
    }

    TEMPLATES[days].days.forEach(function (dd) {
      var dayEx = [];
      var slots = [];
      daySlots(dd, sex).forEach(function (slot) {
        // no dumbbell for the biceps + triceps superset: train each on its own
        if (slot.part === "arms" && !allowed("arms").length) slots.push({ part: "biceps_any", sets: slot.sets }, { part: "triceps_any", sets: slot.sets });
        else slots.push(slot);
      });
      slots.forEach(function (slot) {
        var own = allowed(slot.part);
        if (own.length) {
          var id = pickFrom(own, dayEx);
          if (id) { addEx(dayEx, id, slot.sets); return; }
          // every move of this part is already in the day: fine if one covers the region, else add the sets to it
          var region = PART_REGION[slot.part];
          var cover = dayEx.filter(function (e) { return e.shape === region || e.shape2 === region; })[0];
          merge(dayEx, cover ? cover.id : own[0], slot.sets);
          return;
        }
        // nothing fits the tools: walk the next-best parts of the same muscle
        var seen = {}; seen[slot.part] = 1;
        var queue = PARTS[slot.part].fb.slice();
        while (queue.length) {
          var part = queue.shift();
          if (seen[part]) continue;
          seen[part] = 1;
          var cand = allowed(part);
          if (cand.length) {
            var pick = pickFrom(cand, dayEx);
            if (pick) addEx(dayEx, pick, slot.sets); else merge(dayEx, cand[0], slot.sets);
            gap("substituted", dd.key, slot.part, pick || cand[0]);
            return;
          }
          queue = queue.concat(PARTS[part].fb);
        }
        gap("unfilled", dd.key, slot.part, null);
      });
      out.push({
        id: "sp" + days + where[0] + sex[0] + "_" + dd.key, label: dd.label, labelAr: dd.labelAr,
        muscles: dd.muscles, musclesAr: dd.musclesAr, exercises: dayEx
      });
    });

    // regions the plan can't hit on two different days. "frequency": the tools reach it but the
    // per-day exercise cap leaves it on fewer than two days. "region": no move fits the tools.
    var reachable = {};
    Object.keys(LIB).forEach(function (id) {
      if (fits(LIB[id].tools, have)) [LIB[id].shape, LIB[id].shape2].forEach(function (r) { if (r) reachable[r] = 1; });
    });
    var hit = {};
    out.forEach(function (d) {
      d.exercises.forEach(function (e) {
        [e.shape, e.shape2].forEach(function (r) { if (r) (hit[r] = hit[r] || {})[d.id] = 1; });
      });
    });
    Object.keys(REGIONS).forEach(function (r) {
      var n = Object.keys(hit[r] || {}).length;
      if (n >= 2) return;
      if (reachable[r]) {
        gaps.push({ kind: "frequency", day: null, part: null, region: r, group: REGIONS[r], used: null, days: n, needs: null, tick: null });
        return;
      }
      var list = REGION_FILLS[r] || FILLS[r] || [];
      var fit = list.filter(function (x) { return fits(x.tools, have); })[0];
      var tick = fit ? null : list.filter(function (x) { return x.tools[0] !== "none"; })[0];
      gaps.push({ kind: "region", day: null, part: null, region: r, group: REGIONS[r], used: null, days: n, needs: fit ? fit.en : (tick ? tick.en : null), tick: tick ? tick.tools : null });
    });

    var week = [null, null, null, null, null, null, null];
    WEEKDAYS[days].forEach(function (wd, i) { week[wd] = out[i].id; });
    return { days: out, week: week, gaps: gaps };
  }

  var api = {
    DAYS: DAYS, WEEKDAYS: WEEKDAYS, HOME_TOOLS: HOME_TOOLS, REGIONS: REGIONS,
    templates: TEMPLATES, parts: PARTS, library: LIB, buildPlan: buildPlan
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.GymSplits = api;
})(typeof window !== "undefined" ? window : globalThis);
