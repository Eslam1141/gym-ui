// ---------------- DATA ----------------
// Shown to signed-out ("anonymous") users: one general full-body day.
// Mirrors data.preview in gym-be/internal/plans/plans.seed.json.
const DAYS_PREVIEW = [
  { id:"preview", label:"Full-Body Starter", muscles:"Full body", exercises:[
    {id:"pv_legpress", en:"Leg Press", sets:3, reps:"10-12", rest:120, vid:"nDh_BlnLCGc", shape:"quads", tier:"easy", tools:["machine"]},
    {id:"pv_dbbench", en:"Dumbbell Bench Press", sets:3, reps:"8-12", rest:90, vid:"Gf65Yy0-wGI", shape:"chest_mid", tier:"medium", tools:["dumbbell", "bench"]},
    {id:"pv_cablerow", en:"Seated Cable Row", sets:3, reps:"10-12", rest:90, vid:"8QuMq1GMMng", shape:"back_mid", tier:"easy", tools:["cable"]},
    {id:"pv_ohp", en:"Seated Dumbbell Shoulder Press", sets:3, reps:"10-12", rest:75, vid:"k6tzKisR3NY", shape:"shoulder_front", tier:"medium", tools:["dumbbell", "bench"]},
    {id:"pv_legcurl", en:"Lying Leg Curl", sets:3, reps:"12-15", rest:60, vid:"bgfHeL6eR9Q", shape:"hamstrings", tier:"easy", tools:["machine"]},
    {id:"pv_plank", en:"Plank (core)", sets:3, reps:"30-45s", rest:45, vid:"fWW5d1ZFhk4", shape:"core_upper", tier:"medium", tools:["none"]},
  ]},
];
// 4-day split on a 7-day week (2026-10-14): Upper, Lower, rest, Back + Biceps +
// Calves, Chest + Triceps, rest, rest. Every exercise id below already existed
// in an earlier men's plan (this file's Upper/Lower A+B, kept as
// LEGACY_MALE_DAYS, or the pre-#44 Chest/Back split), so each user's weight
// log and "last time" hint stays linked to the same id. The pre-#44 ids
// (cta_*, ctb_*, bba_*, bbb_*) are the exact same move + video, reused
// instead of minting duplicates. The two back-to-back training days (Back +
// Biceps + Calves, then Chest + Triceps) share no movement.
const DAYS_MALE = [
  { id:"m_upper", label:"Upper", muscles:"Chest, Back, Shoulders", exercises:[
    {id:"mua_bench", en:"Barbell Bench Press", sets:4, reps:"6-8", rest:150, vid:"0cXAp6WhSj4", shape:"chest_mid", tier:"hard", tools:["barbell", "bench"]},
    {id:"mua_pulldown", en:"Lat Pulldown / Pull-up", sets:4, reps:"8-10", rest:120, vid:"bNmvKpJSWKM", shape:"back_lats", tier:"medium", tools:["cable"]},
    {id:"mua_ohp", en:"Seated Dumbbell Shoulder Press", sets:3, reps:"10-12", rest:75, vid:"k6tzKisR3NY", shape:"shoulder_front", tier:"medium", tools:["dumbbell", "bench"]},
    {id:"mua_row", en:"Chest-Supported Row", sets:4, reps:"8-10", rest:90, vid:"uhwcRYpkjvc", shape:"back_mid", tier:"medium", tools:["machine"]},
    {id:"mua_lateral", en:"Dumbbell Lateral Raise", sets:3, reps:"15-20", rest:30, vid:"Kl3LEzQ5Zqs", shape:"shoulder_side", tier:"easy", tools:["dumbbell"]},
    {id:"mua_facepull", en:"Band Face Pull", sets:3, reps:"15-20", rest:30, vid:"JBpj9-3tP0c", shape:"shoulder_rear", tier:"easy", tools:["band"]},
  ]},
  { id:"m_lower", label:"Lower", muscles:"Quads, Hamstrings, Glutes, Abs", exercises:[
    {id:"mla_squat", en:"Barbell Back Squat", sets:4, reps:"6-8", rest:150, vid:"tNUq6b5t11Q", shape:"quads", tier:"hard", tools:["barbell"]},
    {id:"mla_rdl", en:"Barbell Romanian Deadlift", sets:3, reps:"8-10", rest:90, vid:"zdip4iexlxg", shape:"hamstrings", shape2:"back_lower", tier:"hard", tools:["barbell"]},
    {id:"bbb_bss", en:"Bulgarian Split Squat", sets:3, reps:"10-12/leg", rest:75, vid:"uODWo4YqbT8", shape:"quads", tier:"hard", tools:["dumbbell", "bench"]},
    {id:"mla_legcurl", en:"Lying Leg Curl", sets:3, reps:"12-15", rest:60, vid:"bgfHeL6eR9Q", shape:"hamstrings", tier:"easy", tools:["machine"]},
    {id:"mlb_legext", en:"Leg Extension", sets:3, reps:"15-20", rest:60, vid:"iQ92TuvBqRo", shape:"quads", tier:"easy", tools:["machine"]},
    {id:"mla_bridge", en:"Dumbbell Glute Bridge", sets:3, reps:"15-20", rest:45, vid:"12m6GW59LvQ", shape:"glutes", tier:"easy", tools:["dumbbell"]},
    {id:"mla_core", en:"Hanging Leg Raise (core)", sets:3, reps:"10-15", rest:45, vid:"0wSUjj5j1xo", shape:"core_lower", tier:"hard", tools:["pullup_bar"]},
  ]},
  { id:"m_backbi", label:"Back + Biceps + Calves", muscles:"Back, Biceps, Calves", exercises:[
    {id:"mub_pulldown", en:"Lat Pulldown / Pull-up", sets:4, reps:"8-10", rest:120, vid:"bNmvKpJSWKM", shape:"back_lats", tier:"medium", tools:["cable"]},
    {id:"bbb_tbar", en:"T-Bar Row", sets:4, reps:"8-10", rest:90, vid:"1iQSSqin3ro", shape:"back_mid", tier:"hard", tools:["machine"]},
    {id:"mub_pullapart", en:"Band Pull-Apart", sets:3, reps:"15-20", rest:30, vid:"qi2y-eI_kuI", shape:"shoulder_rear", tier:"easy", tools:["band"]},
    {id:"bba_inclcurl", en:"Incline Dumbbell Curl", sets:3, reps:"10-12", rest:45, vid:"XhIsIcjIbCw", shape:"biceps_long", tier:"medium", tools:["dumbbell", "bench"]},
    {id:"mub_hammer", en:"Hammer Curl", sets:3, reps:"12-15", rest:30, vid:"K9LiwcGuqA0", shape:"biceps_long", tier:"medium", tools:["dumbbell"]},
    {id:"mla_calf", en:"Standing Calf Raise", sets:3, reps:"15-20", rest:30, vid:"B30JglFGx8Y", shape:"calves", tier:"easy", tools:["none"]},
    {id:"mlb_calf", en:"Seated Calf Raise (Dumbbell)", sets:3, reps:"15-20", rest:30, vid:"NrHJPauB01I", shape:"calves", tier:"easy", tools:["dumbbell", "bench"]},
  ]},
  { id:"m_chesttri", label:"Chest + Triceps", muscles:"Chest, Triceps", exercises:[
    {id:"ctb_dbbench", en:"Dumbbell Bench Press", sets:4, reps:"8-10", rest:90, vid:"Gf65Yy0-wGI", shape:"chest_mid", tier:"medium", tools:["dumbbell", "bench"]},
    {id:"mub_incline", en:"Incline Dumbbell Press", sets:3, reps:"8-10", rest:120, vid:"8fXfwG4ftaQ", shape:"chest_upper", tier:"medium", tools:["dumbbell", "bench"]},
    {id:"cta_fly", en:"Cable Chest Fly", sets:3, reps:"12-15", rest:60, vid:"I-Ue34qLxc4", shape:"chest_mid", tier:"easy", tools:["cable"]},
    {id:"ctb_pushup", en:"Push-ups", sets:3, reps:"12-20", rest:60, vid:"wD1M-f69Yy8", shape:"chest_mid", tier:"easy", tools:["none"]},
    {id:"cta_ohext", en:"Overhead Cable Triceps Extension", sets:3, reps:"10-15", rest:60, vid:"tPIWaCKWFF8", shape:"triceps_long", tier:"medium", tools:["cable"]},
    {id:"mua_pushdown", en:"Cable Rope Pushdown", sets:3, reps:"12-15", rest:45, vid:"7OF77JMEXhM", shape:"triceps_lateral", tier:"easy", tools:["cable"]},
  ]},
];
// The week the men's gym plan runs on, in order. A rest slot is a day to
// recover, not a workout; the app's own rest-day flow (rest-days.js) records it.
const WEEK_MALE = ["m_upper", "m_lower", null, "m_backbi", "m_chesttri", null, null];

// The Upper/Lower A+B days this plan replaced (2026-10-14). Kept only so a
// day id already in someone's history (gym_checks, completed-day records on
// the server, the calendar) still resolves its exercise list; never rendered
// as a tab. Old -> new day ids are in GymMigrations.maleV3.
// Upper/Lower A+B split (rewritten 2026-09-28 from a "user findings" pass —
// the previous 4-day version paired Chest+Triceps / Back+Biceps and tacked
// 2 leg moves onto EVERY day, so legs got hit 4x/week with no dedicated leg
// day while shoulders got no direct work at all. This version: compound
// lift first on every day, every major muscle group (chest, back, shoulders,
// arms, quads, hamstrings, glutes, calves) trained ~2x/week via a different
// exercise/angle each time (e.g. flat bench Upper A vs incline Upper B, back
// squat Lower A vs hack squat Lower B), push/pull kept 1:1 on both upper
// days, and no muscle is trained on every single day. Every exercise here
// already exists elsewhere in the catalog (has a real vid + an AR_EX/AR_DAY
// translation already) — nothing new to translate or source video for.
const LEGACY_MALE_DAYS = [
  { id:"m_upperA", label:"Upper A", muscles:"Chest, Back, Delts, Arms", exercises:[
    {id:"mua_bench", en:"Barbell Bench Press", sets:4, reps:"6-8", rest:150, vid:"0cXAp6WhSj4", shape:"chest_mid", tier:"hard", tools:["barbell", "bench"]},
    {id:"mua_pulldown", en:"Lat Pulldown / Pull-up", sets:4, reps:"8-10", rest:120, vid:"bNmvKpJSWKM", shape:"back_lats", tier:"medium", tools:["cable"]},
    {id:"mua_ohp", en:"Seated Dumbbell Shoulder Press", sets:3, reps:"10-12", rest:75, vid:"k6tzKisR3NY", shape:"shoulder_front", tier:"medium", tools:["dumbbell", "bench"]},
    {id:"mua_row", en:"Chest-Supported Row", sets:4, reps:"8-10", rest:90, vid:"uhwcRYpkjvc", shape:"back_mid", tier:"medium", tools:["machine"]},
    {id:"mua_lateral", en:"Dumbbell Lateral Raise", sets:3, reps:"15-20", rest:30, vid:"Kl3LEzQ5Zqs", shape:"shoulder_side", tier:"easy", tools:["dumbbell"]},
    {id:"mua_facepull", en:"Band Face Pull", sets:3, reps:"15-20", rest:30, vid:"JBpj9-3tP0c", shape:"shoulder_rear", tier:"easy", tools:["band"]},
    {id:"mua_curl", en:"Barbell Curl", sets:3, reps:"10-12", rest:60, vid:"ZQWL7omZh94", shape:"biceps_short", tier:"medium", tools:["barbell"]},
    {id:"mua_pushdown", en:"Cable Rope Pushdown", sets:3, reps:"12-15", rest:45, vid:"7OF77JMEXhM", shape:"triceps_lateral", tier:"easy", tools:["cable"]},
  ]},
  { id:"m_lowerA", label:"Lower A", muscles:"Quads, Glutes, Hamstrings, Abs", exercises:[
    {id:"mla_squat", en:"Barbell Back Squat", sets:4, reps:"6-8", rest:150, vid:"tNUq6b5t11Q", shape:"quads", tier:"hard", tools:["barbell"]},
    {id:"mla_rdl", en:"Barbell Romanian Deadlift", sets:3, reps:"8-10", rest:90, vid:"zdip4iexlxg", shape:"hamstrings", shape2:"back_lower", tier:"hard", tools:["barbell"]},
    {id:"mla_legpress", en:"Leg Press", sets:3, reps:"10-12", rest:120, vid:"nDh_BlnLCGc", shape:"quads", tier:"easy", tools:["machine"]},
    {id:"mla_legcurl", en:"Lying Leg Curl", sets:3, reps:"12-15", rest:60, vid:"bgfHeL6eR9Q", shape:"hamstrings", tier:"easy", tools:["machine"]},
    {id:"mla_bridge", en:"Dumbbell Glute Bridge", sets:3, reps:"15-20", rest:45, vid:"12m6GW59LvQ", shape:"glutes", tier:"easy", tools:["dumbbell"]},
    {id:"mla_calf", en:"Standing Calf Raise", sets:3, reps:"15-20", rest:30, vid:"B30JglFGx8Y", shape:"calves", tier:"easy", tools:["none"]},
    {id:"mla_core", en:"Hanging Leg Raise (core)", sets:3, reps:"10-15", rest:45, vid:"0wSUjj5j1xo", shape:"core_lower", tier:"hard", tools:["pullup_bar"]},
  ]},
  { id:"m_upperB", label:"Upper B", muscles:"Chest, Back, Delts, Arms", exercises:[
    {id:"mub_incline", en:"Incline Dumbbell Press", sets:3, reps:"8-10", rest:120, vid:"8fXfwG4ftaQ", shape:"chest_upper", tier:"medium", tools:["dumbbell", "bench"]},
    {id:"mub_pulldown", en:"Lat Pulldown / Pull-up", sets:4, reps:"8-10", rest:120, vid:"bNmvKpJSWKM", shape:"back_lats", tier:"medium", tools:["cable"]},
    {id:"mub_arnold", en:"Arnold Press", sets:3, reps:"12-15", rest:45, vid:"AjB-UXErljM", shape:"shoulder_front", tier:"medium", tools:["dumbbell"]},
    {id:"mub_row", en:"Chest-Supported Dumbbell Row", sets:3, reps:"12-15", rest:45, vid:"09wri23R4SU", shape:"back_mid", tier:"easy", tools:["dumbbell", "bench"]},
    {id:"mub_lateral", en:"Dumbbell Lateral Raise", sets:3, reps:"15-20", rest:30, vid:"Kl3LEzQ5Zqs", shape:"shoulder_side", tier:"easy", tools:["dumbbell"]},
    {id:"mub_pullapart", en:"Band Pull-Apart", sets:3, reps:"15-20", rest:30, vid:"qi2y-eI_kuI", shape:"shoulder_rear", tier:"easy", tools:["band"]},
    {id:"mub_hammer", en:"Hammer Curl", sets:3, reps:"12-15", rest:30, vid:"K9LiwcGuqA0", shape:"biceps_long", tier:"medium", tools:["dumbbell"]},
    {id:"mub_dips", en:"Bench Dips", sets:3, reps:"12-18", rest:45, vid:"ekgvqS_4Ee4", shape:"triceps_lateral", tier:"easy", tools:["bench"]},
  ]},
  { id:"m_lowerB", label:"Lower B", muscles:"Quads, Hamstrings, Calves", exercises:[
    {id:"mlb_hack", en:"Hack Squat", sets:4, reps:"8-10", rest:120, vid:"g9i05umL5vc", shape:"quads", tier:"medium", tools:["machine"]},
    {id:"mlb_sldl", en:"Single-Leg Dumbbell RDL", sets:3, reps:"10-12/leg", rest:45, vid:"kQf5g0y0mO4", shape:"hamstrings", tier:"hard", tools:["dumbbell"]},
    {id:"mlb_legext", en:"Leg Extension", sets:3, reps:"15-20", rest:60, vid:"iQ92TuvBqRo", shape:"quads", tier:"easy", tools:["machine"]},
    {id:"mlb_seatcurl", en:"Seated Leg Curl", sets:3, reps:"12-15", rest:60, vid:"xdbEG3xGLI8", shape:"hamstrings", tier:"easy", tools:["machine"]},
    {id:"mlb_kickback", en:"Band Glute Kickback", sets:3, reps:"15-20/leg", rest:30, vid:"aw9WClmz5jw", shape:"glutes", tier:"easy", tools:["band"]},
    {id:"mlb_calf", en:"Seated Calf Raise (Dumbbell)", sets:3, reps:"15-20", rest:30, vid:"NrHJPauB01I", shape:"calves", tier:"easy", tools:["dumbbell", "bench"]},
    {id:"mlb_core", en:"Pallof Press (core)", sets:3, reps:"12/side", rest:45, vid:"P1H4IzD9rbQ", shape:"core_obliques", tier:"medium", tools:["cable"]},
  ]},
];

const DAYS_FEMALE = [
  { id:"f_lowerA", label:"Lower A", muscles:"Glutes & Quads", exercises:[
    {id:"fla_goblet", en:"Goblet Squat", sets:3, reps:"12-15", rest:60, vid:"0OWbS1WiUGU", shape:"quads", tier:"easy", tools:["dumbbell"]},
    {id:"fla_rdl", en:"Dumbbell Romanian Deadlift", sets:3, reps:"12-15", rest:60, vid:"hu3jRvTc_po", shape:"hamstrings", tier:"medium", tools:["dumbbell"]},
    {id:"fla_lunge", en:"Reverse Lunge (Dumbbell)", sets:3, reps:"10-12/leg", rest:60, vid:"YXL_f378hLM", shape:"quads", tier:"medium", tools:["dumbbell"]},
    {id:"fla_bridge", en:"Dumbbell Glute Bridge", sets:3, reps:"15-20", rest:45, vid:"12m6GW59LvQ", shape:"glutes", tier:"easy", tools:["dumbbell"]},
    {id:"fla_calf", en:"Standing Calf Raise", sets:3, reps:"15-20", rest:30, vid:"B30JglFGx8Y", shape:"calves", tier:"easy", tools:["none"]},
    {id:"fla_deadbug", en:"Dead Bug (core)", sets:3, reps:"10-12/side", rest:30, vid:"XcYtWYMz39w", shape:"core_lower", tier:"easy", tools:["none"]},
  ]},
  { id:"f_upperA", label:"Upper A", muscles:"Push focus", exercises:[
    {id:"fua_bench", en:"Dumbbell Bench Press", sets:3, reps:"10-12", rest:60, vid:"Gf65Yy0-wGI", shape:"chest_mid", tier:"medium", tools:["dumbbell", "bench"]},
    {id:"fua_row", en:"One-Arm Dumbbell Row", sets:3, reps:"12-15/arm", rest:45, vid:"H8jf3DwlIlo", shape:"back_mid", tier:"medium", tools:["dumbbell"]},
    {id:"fua_press", en:"Seated Dumbbell Shoulder Press", sets:3, reps:"12-15", rest:45, vid:"k6tzKisR3NY", shape:"shoulder_front", tier:"medium", tools:["dumbbell", "bench"]},
    {id:"fua_pullapart", en:"Band Pull-Apart", sets:3, reps:"15-20", rest:30, vid:"qi2y-eI_kuI", shape:"shoulder_rear", tier:"easy", tools:["band"]},
    {id:"fua_lateral", en:"Dumbbell Lateral Raise", sets:3, reps:"15-20", rest:30, vid:"Kl3LEzQ5Zqs", shape:"shoulder_side", tier:"easy", tools:["dumbbell"]},
    {id:"fua_arms", en:"Biceps Curl + Triceps Extension (superset)", sets:3, reps:"12-15", rest:45, vid:"8UIbEovL-xU", shape:"biceps_short", shape2:"triceps_long", tier:"medium", tools:["dumbbell"]},
  ]},
  { id:"f_lowerB", label:"Lower B", muscles:"Hamstrings & Glutes", exercises:[
    {id:"flb_sumo", en:"Dumbbell Sumo Squat", sets:3, reps:"12-15", rest:60, vid:"bRCjBCtBGIo", shape:"quads", shape2:"glutes", tier:"medium", tools:["dumbbell"]},
    {id:"flb_sldl", en:"Single-Leg Dumbbell RDL", sets:3, reps:"10-12/leg", rest:45, vid:"kQf5g0y0mO4", shape:"hamstrings", tier:"hard", tools:["dumbbell"]},
    {id:"flb_bss", en:"Bulgarian Split Squat", sets:3, reps:"10-12/leg", rest:60, vid:"uODWo4YqbT8", shape:"quads", tier:"hard", tools:["dumbbell", "bench"]},
    {id:"flb_kickback", en:"Band Glute Kickback", sets:3, reps:"15-20/leg", rest:30, vid:"aw9WClmz5jw", shape:"glutes", tier:"easy", tools:["band"]},
    {id:"flb_calf", en:"Seated Calf Raise (Dumbbell)", sets:3, reps:"15-20", rest:30, vid:"NrHJPauB01I", shape:"calves", tier:"easy", tools:["dumbbell", "bench"]},
    {id:"flb_legraise", en:"Lying Leg Raise (core)", sets:3, reps:"12-15", rest:30, vid:"jrSWj0huh5o", shape:"core_lower", tier:"medium", tools:["none"]},
  ]},
  { id:"f_upperB", label:"Upper B", muscles:"Pull focus & core", exercises:[
    {id:"fub_incline", en:"Incline Dumbbell Press", sets:3, reps:"12-15", rest:60, vid:"8fXfwG4ftaQ", shape:"chest_upper", tier:"medium", tools:["dumbbell", "bench"]},
    {id:"fub_row", en:"Chest-Supported Dumbbell Row", sets:3, reps:"12-15", rest:45, vid:"09wri23R4SU", shape:"back_mid", tier:"easy", tools:["dumbbell", "bench"]},
    {id:"fub_arnold", en:"Arnold Press", sets:3, reps:"12-15", rest:45, vid:"AjB-UXErljM", shape:"shoulder_front", tier:"medium", tools:["dumbbell"]},
    {id:"fub_facepull", en:"Band Face Pull", sets:3, reps:"15-20", rest:30, vid:"JBpj9-3tP0c", shape:"shoulder_rear", tier:"easy", tools:["band"]},
    {id:"fub_hammer", en:"Hammer Curl", sets:3, reps:"12-15", rest:30, vid:"K9LiwcGuqA0", shape:"biceps_long", tier:"medium", tools:["dumbbell"]},
    {id:"fub_plank", en:"Plank (core)", sets:3, reps:"30-45s", rest:30, vid:"fWW5d1ZFhk4", shape:"core_upper", tier:"medium", tools:["none"]},
  ]},
];

// ---- Military calisthenics: 3 days, no equipment (bands + a sturdy table). Shared moves, scaled reps. ----
const DAYS_MALE_CAL = [
  { id:"mc_push", label:"Push", muscles:"Push & Core", exercises:[
    {id:"mcp_pushup", en:"Push-ups", sets:4, reps:"12-20", rest:60, vid:"wD1M-f69Yy8", shape:"chest_mid", tier:"easy", tools:["none"]},
    {id:"mcp_pike", en:"Pike Push-ups", sets:3, reps:"8-12", rest:60, vid:"XckEEwa1BPI", shape:"shoulder_front", tier:"medium", tools:["none"]},
    {id:"mcp_dips", en:"Bench Dips", sets:3, reps:"12-18", rest:45, vid:"ekgvqS_4Ee4", shape:"triceps_lateral", tier:"easy", tools:["bench"]},
    {id:"mcp_plank", en:"Plank (core)", sets:3, reps:"45-60s", rest:30, vid:"fWW5d1ZFhk4", shape:"core_upper", tier:"medium", tools:["none"]},
    {id:"mcp_hollow", en:"Hollow Body Hold", sets:3, reps:"25-40s", rest:30, vid:"Xk-JcNj6lfY", shape:"core_lower", shape2:"core_upper", tier:"medium", tools:["none"]},
    {id:"mcp_mtn", en:"Mountain Climbers", sets:4, reps:"40s", rest:30, vid:"fpmWW6iXfes", shape:"core_lower", shape2:"shoulder_front", tier:"medium", tools:["none"]},
  ]},
  { id:"mc_legs", label:"Legs", muscles:"Legs & Cardio", exercises:[
    {id:"mcl_squat", en:"Bodyweight Squats", sets:4, reps:"25-35", rest:45, vid:"3fl7uYmiMVw", shape:"quads", tier:"easy", tools:["none"]},
    {id:"mcl_lunge", en:"Reverse Lunges", sets:3, reps:"12-16/leg", rest:45, vid:"ufjvjxrGyFM", shape:"quads", tier:"easy", tools:["none"]},
    {id:"mcl_bridge", en:"Glute Bridge", sets:3, reps:"20-25", rest:30, vid:"12m6GW59LvQ", shape:"glutes", tier:"easy", tools:["none"]},
    {id:"mcl_jump", en:"Squat Jumps", sets:4, reps:"12-15", rest:45, vid:"dX9bNPQeQa8", shape:"quads", shape2:"glutes", tier:"hard", tools:["none"]},
    {id:"mcl_calf", en:"Standing Calf Raise", sets:3, reps:"25-30", rest:30, vid:"B30JglFGx8Y", shape:"calves", tier:"easy", tools:["none"]},
    {id:"mcl_burpee", en:"Burpees", sets:5, reps:"10-15", rest:60, vid:"DNHWxCUp8MY", shape:"quads", shape2:"chest_mid", tier:"hard", tools:["none"]},
  ]},
  { id:"mc_pull", label:"Pull", muscles:"Pull & Total Body", exercises:[
    {id:"mcx_row", en:"Inverted Row (under a table)", sets:4, reps:"10-15", rest:60, vid:"VO-pt_XgFho", shape:"back_lats", tier:"medium", tools:["table"]},
    {id:"mcx_pullapart", en:"Band Pull-Apart", sets:3, reps:"20-25", rest:30, vid:"qi2y-eI_kuI", shape:"shoulder_rear", tier:"easy", tools:["band"]},
    {id:"mcx_superman", en:"Superman", sets:3, reps:"15-20", rest:30, vid:"uexOGyxLr7E", shape:"back_lower", tier:"easy", tools:["none"]},
    {id:"mcx_facepull", en:"Band Face Pull", sets:3, reps:"15-20", rest:30, vid:"JBpj9-3tP0c", shape:"shoulder_rear", tier:"easy", tools:["band"]},
    {id:"mcx_flutter", en:"Flutter Kicks", sets:4, reps:"40s", rest:30, vid:"pRZhSdw5Tqg", shape:"core_lower", shape2:"quads", tier:"easy", tools:["none"]},
    {id:"mcx_bear", en:"Bear Crawl", sets:3, reps:"30s", rest:45, vid:"-9L3rTrYo4Q", shape:"core_obliques", shape2:"shoulder_front", tier:"medium", tools:["none"]},
  ]},
];

const DAYS_FEMALE_CAL = [
  { id:"fc_push", label:"Push", muscles:"Push & Core", exercises:[
    {id:"fcp_pushup", en:"Push-ups", sets:3, reps:"8-15", rest:60, vid:"wD1M-f69Yy8", shape:"chest_mid", tier:"easy", tools:["none"]},
    {id:"fcp_pike", en:"Pike Push-ups", sets:3, reps:"6-10", rest:60, vid:"XckEEwa1BPI", shape:"shoulder_front", tier:"medium", tools:["none"]},
    {id:"fcp_dips", en:"Bench Dips", sets:3, reps:"8-12", rest:45, vid:"ekgvqS_4Ee4", shape:"triceps_lateral", tier:"easy", tools:["bench"]},
    {id:"fcp_plank", en:"Plank (core)", sets:3, reps:"30-45s", rest:30, vid:"fWW5d1ZFhk4", shape:"core_upper", tier:"medium", tools:["none"]},
    {id:"fcp_hollow", en:"Hollow Body Hold", sets:3, reps:"15-30s", rest:30, vid:"Xk-JcNj6lfY", shape:"core_lower", shape2:"core_upper", tier:"medium", tools:["none"]},
    {id:"fcp_mtn", en:"Mountain Climbers", sets:3, reps:"30s", rest:30, vid:"fpmWW6iXfes", shape:"core_lower", shape2:"shoulder_front", tier:"medium", tools:["none"]},
  ]},
  { id:"fc_legs", label:"Legs", muscles:"Legs & Cardio", exercises:[
    {id:"fcl_squat", en:"Bodyweight Squats", sets:3, reps:"20-30", rest:45, vid:"3fl7uYmiMVw", shape:"quads", tier:"easy", tools:["none"]},
    {id:"fcl_lunge", en:"Reverse Lunges", sets:3, reps:"10-14/leg", rest:45, vid:"ufjvjxrGyFM", shape:"quads", tier:"easy", tools:["none"]},
    {id:"fcl_bridge", en:"Glute Bridge", sets:3, reps:"15-20", rest:30, vid:"12m6GW59LvQ", shape:"glutes", tier:"easy", tools:["none"]},
    {id:"fcl_jump", en:"Squat Jumps", sets:3, reps:"8-12", rest:45, vid:"dX9bNPQeQa8", shape:"quads", shape2:"glutes", tier:"hard", tools:["none"]},
    {id:"fcl_calf", en:"Standing Calf Raise", sets:3, reps:"20-25", rest:30, vid:"B30JglFGx8Y", shape:"calves", tier:"easy", tools:["none"]},
    {id:"fcl_burpee", en:"Burpees", sets:3, reps:"6-10", rest:60, vid:"DNHWxCUp8MY", shape:"quads", shape2:"chest_mid", tier:"hard", tools:["none"]},
  ]},
  { id:"fc_pull", label:"Pull", muscles:"Pull & Total Body", exercises:[
    {id:"fcx_row", en:"Inverted Row (under a table)", sets:3, reps:"6-12", rest:60, vid:"VO-pt_XgFho", shape:"back_lats", tier:"medium", tools:["table"]},
    {id:"fcx_pullapart", en:"Band Pull-Apart", sets:3, reps:"15-20", rest:30, vid:"qi2y-eI_kuI", shape:"shoulder_rear", tier:"easy", tools:["band"]},
    {id:"fcx_superman", en:"Superman", sets:3, reps:"12-15", rest:30, vid:"uexOGyxLr7E", shape:"back_lower", tier:"easy", tools:["none"]},
    {id:"fcx_facepull", en:"Band Face Pull", sets:3, reps:"15-20", rest:30, vid:"JBpj9-3tP0c", shape:"shoulder_rear", tier:"easy", tools:["band"]},
    {id:"fcx_flutter", en:"Flutter Kicks", sets:3, reps:"30s", rest:30, vid:"pRZhSdw5Tqg", shape:"core_lower", shape2:"quads", tier:"easy", tools:["none"]},
    {id:"fcx_bear", en:"Bear Crawl", sets:3, reps:"20s", rest:45, vid:"-9L3rTrYo4Q", shape:"core_obliques", shape2:"shoulder_front", tier:"medium", tools:["none"]},
  ]},
];

// ---- No-equipment moves for biceps, triceps and hamstrings (added 2026-10-22 for the training splits).
// Library-only: no plan lists this "day". There is no video yet (vid is empty on purpose, the card
// shows "Video coming soon" until the owner supplies a clip); never put a guessed video id here. ----
const DAYS_EXTRA = [
  { id:"x_library", label:"Library", muscles:"No-equipment biceps, triceps, hamstrings", exercises:[
    {id:"nb_towelcurl", en:"Towel Door Curl", sets:3, reps:"12-15", rest:45, vid:"leaEyx33mHw", shape:"biceps_short", shape2:"biceps_long", tier:"easy", tools:["none"]},
    {id:"nb_diamond", en:"Diamond Push-ups", sets:3, reps:"8-12", rest:60, vid:"PPTj-MW2tcs", shape:"triceps_lateral", tier:"medium", tools:["none"]},
    {id:"nb_hinge1", en:"Single-Leg Hip Hinge", sets:3, reps:"8-12/leg", rest:45, vid:"JQZqPsmeesc", shape:"hamstrings", tier:"medium", tools:["none"]},
    {id:"nb_slidecurl", en:"Towel Sliding Hamstring Curl", sets:3, reps:"8-12", rest:60, vid:"cjtsLDniFpk", shape:"hamstrings", tier:"medium", tools:["none"]},
  ]},
];

// ---- muscle "shapes" (sub-regions) for the custom workout builder ----
// id is referenced by every exercise's shape/shape2 field below.
const MUSCLE_SHAPES = [
  { id:"chest_upper", group:"Chest", groupAr:"صدر", label:"Upper chest", labelAr:"صدر علوي" },
  { id:"chest_mid", group:"Chest", groupAr:"صدر", label:"Mid chest", labelAr:"صدر أوسط" },
  { id:"chest_lower", group:"Chest", groupAr:"صدر", label:"Lower chest", labelAr:"صدر سفلي" },
  { id:"back_lats", group:"Back", groupAr:"ظهر", label:"Lats (width)", labelAr:"عضلات ظهرية (اتساع)" },
  { id:"back_mid", group:"Back", groupAr:"ظهر", label:"Mid-back / rhomboids (thickness)", labelAr:"وسط الظهر (سماكة)" },
  { id:"back_lower", group:"Back", groupAr:"ظهر", label:"Lower back / traps", labelAr:"أسفل الظهر / كتفية" },
  { id:"shoulder_front", group:"Shoulders", groupAr:"أكتاف", label:"Front delt", labelAr:"كتف أمامي" },
  { id:"shoulder_side", group:"Shoulders", groupAr:"أكتاف", label:"Side delt", labelAr:"كتف جانبي" },
  { id:"shoulder_rear", group:"Shoulders", groupAr:"أكتاف", label:"Rear delt", labelAr:"كتف خلفي" },
  { id:"biceps_long", group:"Biceps", groupAr:"بايسبس", label:"Long head (outer)", labelAr:"الرأس الطويل (خارجي)" },
  { id:"biceps_short", group:"Biceps", groupAr:"بايسبس", label:"Short head (inner)", labelAr:"الرأس القصير (داخلي)" },
  { id:"triceps_long", group:"Triceps", groupAr:"ترايسبس", label:"Long head", labelAr:"الرأس الطويل" },
  { id:"triceps_lateral", group:"Triceps", groupAr:"ترايسبس", label:"Lateral/medial head", labelAr:"الرأس الجانبي/الأوسط" },
  { id:"quads", group:"Quads", groupAr:"أمامية الفخذ", label:"Quads", labelAr:"أمامية الفخذ" },
  { id:"hamstrings", group:"Hamstrings", groupAr:"خلفية الفخذ", label:"Hamstrings", labelAr:"خلفية الفخذ" },
  { id:"glutes", group:"Glutes", groupAr:"ألوية", label:"Glutes", labelAr:"الألوية" },
  { id:"calves", group:"Calves", groupAr:"سمانة", label:"Calves", labelAr:"السمانة" },
  { id:"core_upper", group:"Core", groupAr:"بطن", label:"Upper abs", labelAr:"بطن علوي" },
  { id:"core_lower", group:"Core", groupAr:"بطن", label:"Lower abs", labelAr:"بطن سفلي" },
  { id:"core_obliques", group:"Core", groupAr:"بطن", label:"Obliques", labelAr:"عضلات جانبية (بطن)" },
];

// ---------------- i18n ----------------
const AR_EX = {
  "Barbell Bench Press":"بنش بريس بالبار","Incline Dumbbell Press":"بنش عالي بالدمبل","Cable Chest Fly":"تفتيح صدر بالكابل",
  "Cable Lateral Raise":"رفرفة جانبي بالكابل","Overhead Cable Triceps Extension":"تمديد ترايسبس خلف الرأس بالكابل","Cable Rope Pushdown":"دفع ترايسبس بالحبل",
  "Lat Pulldown / Pull-up":"سحب أمامي / عقلة","Chest-Supported Row":"تجديف بإسناد الصدر","Seated Cable Row":"تجديف بالكابل جالساً",
  "Reverse Pec Deck (Rear Delt Fly)":"تفتيح خلفي عكسي (باي دلت)","Barbell Curl":"مرجحة بايسبس بالبار","Incline Dumbbell Curl":"مرجحة بايسبس على بنش مائل",
  "Hanging Leg Raise (core)":"رفع الرجلين معلقاً (بطن)","Barbell Back Squat":"سكوات خلفي بالبار","Leg Press":"مكبس الأرجل",
  "Barbell Romanian Deadlift":"رفعة رومانية بالبار","Lying Leg Curl":"ثني الرجلين مستلقياً","Leg Extension":"تمديد الرجلين",
  "Standing Calf Raise":"رفع السمانة واقفاً","Dumbbell Bench Press":"بنش بريس بالدمبل","T-Bar Row":"تجديف تي-بار",
  "Seated Dumbbell Shoulder Press":"ضغط كتف بالدمبل جالساً","Wide-grip Lat Pulldown":"سحب أمامي قبضة واسعة","Dumbbell Lateral Raise":"رفرفة جانبي بالدمبل",
  "Biceps + Triceps Superset":"سوبرست بايسبس + ترايسبس","Pallof Press (core)":"ضغط بالوف (ثبات البطن)","Hack Squat":"هاك سكوات",
  "Bulgarian Split Squat":"سكوات بلغاري","Barbell Hip Thrust":"دفع الحوض بالبار","Seated Leg Curl":"ثني الرجلين جالساً",
  "Seated Calf Raise":"رفع السمانة جالساً","Weighted Cable Crunch (core)":"كرنش بالكابل بوزن (بطن)","Goblet Squat":"سكوات جوبلت",
  "Dumbbell Romanian Deadlift":"رفعة رومانية بالدمبل","Reverse Lunge (Dumbbell)":"طعن خلفي بالدمبل","Dumbbell Glute Bridge":"جسر الألوية بالدمبل",
  "Dead Bug (core)":"الحشرة الميتة (بطن)","One-Arm Dumbbell Row":"تجديف بذراع واحدة بالدمبل","Band Pull-Apart":"شد الحبل المطاطي",
  "Biceps Curl + Triceps Extension (superset)":"مرجحة بايسبس + تمديد ترايسبس (سوبرست)","Dumbbell Sumo Squat":"سكوات سومو بالدمبل",
  "Single-Leg Dumbbell RDL":"رفعة رومانية برجل واحدة بالدمبل","Band Glute Kickback":"رفس خلفي للألوية بالمطاط","Seated Calf Raise (Dumbbell)":"رفع السمانة جالساً بالدمبل",
  "Lying Leg Raise (core)":"رفع الرجلين مستلقياً (بطن)","Chest-Supported Dumbbell Row":"تجديف دمبل بإسناد الصدر",
  "Arnold Press":"ضغط أرنولد","Band Face Pull":"سحب للوجه بالمطاط","Hammer Curl":"مرجحة مطرقة","Plank (core)":"بلانك (بطن)",
  "Push-ups":"تمرين الضغط","Pike Push-ups":"ضغط بايك (كتف)","Bench Dips":"غطس على مقعد (ترايسبس)","Hollow Body Hold":"ثبات الجسم المجوف",
  "Mountain Climbers":"تسلق الجبل","Bodyweight Squats":"سكوات بوزن الجسم","Reverse Lunges":"طعن خلفي","Glute Bridge":"جسر الألوية",
  "Squat Jumps":"قفز سكوات","Burpees":"بيربي","Inverted Row (under a table)":"تجديف مقلوب (تحت طاولة)","Superman":"سوبرمان (أسفل الظهر)",
  "Flutter Kicks":"رفرفة الرجلين","Bear Crawl":"زحف الدب",
  "Towel Door Curl":"مرجحة بايسبس بمنشفة على الباب","Diamond Push-ups":"ضغط الماس (ترايسبس)","Single-Leg Hip Hinge":"ثني الورك برجل واحدة (خلفية الفخذ)",
  "Towel Sliding Hamstring Curl":"ثني الرجلين بالانزلاق على منشفة (خلفية الفخذ)"
};
const AR_DAY = {"Push":"دفع","Pull":"سحب","Legs":"أرجل","Upper":"علوي","Lower":"سفلي","Lower A":"سفلي أ","Upper A":"علوي أ","Lower B":"سفلي ب","Upper B":"علوي ب","Full-Body Starter":"تمرين شامل للمبتدئين",
  "Back + Biceps + Calves":"ظهر + بايسبس + سمانة","Chest + Triceps":"صدر + ترايسبس","Chest & Triceps A":"صدر وترايسبس أ","Back & Biceps A":"ظهر وبايسبس أ","Chest & Triceps B":"صدر وترايسبس ب","Back & Biceps B":"ظهر وبايسبس ب"};
const AR_MUS = {
  "Chest, Shoulders, Triceps":"صدر، أكتاف، ترايسبس","Back, Rear Delts, Biceps":"ظهر، أكتاف خلفية، بايسبس","Quads, Hamstrings, Calves":"أمامية الفخذ، خلفية الفخذ، سمانة",
  "Chest, Back, Delts, Arms":"صدر، ظهر، أكتاف، ذراعين","Chest, Back, Shoulders":"صدر، ظهر، أكتاف","Quads, Hamstrings, Glutes, Abs":"أمامية الفخذ، خلفية الفخذ، ألوية، بطن","Back, Biceps, Calves":"ظهر، بايسبس، سمانة","Chest, Triceps":"صدر، ترايسبس","Quads, Glutes, Hamstrings, Abs":"أمامية الفخذ، ألوية، خلفية الفخذ، بطن","Glutes & Quads":"ألوية وأمامية الفخذ",
  "Push focus":"تركيز الدفع","Hamstrings & Glutes":"خلفية الفخذ والألوية","Pull focus & core":"تركيز السحب والبطن",
  "Push & Core":"دفع وبطن","Legs & Cardio":"أرجل وكارديو","Pull & Total Body":"سحب وكامل الجسم",
  "Full body":"الجسم كامل",
  "Chest, Triceps, Legs, Core":"صدر، ترايسبس، أرجل، بطن","Back, Biceps, Legs, Core":"ظهر، بايسبس، أرجل، بطن"
};

// ---- exercise-name -> demo video lookup (reused for coach-generated plans) ----
function _normEx(s){ return String(s||"").toLowerCase().replace(/\(.*?\)/g," ").replace(/[^a-z0-9]+/g," ").trim(); }
// The AI coach names moves in its own words ("Bench Press", "Deadlift", "Push
// Ups"...) that rarely match our catalog's exact labels. Map the common
// generic/alternate names a model tends to use onto one of our real,
// already-verified demo clips so more of a generated plan gets a video.
const EX_ALIASES = {
  "bench press":"Barbell Bench Press", "chest press":"Barbell Bench Press", "flat bench press":"Barbell Bench Press",
  "incline bench press":"Incline Dumbbell Press", "incline press":"Incline Dumbbell Press",
  "push up":"Push-ups", "push ups":"Push-ups", "pushup":"Push-ups", "pushups":"Push-ups", "standard push up":"Push-ups",
  "squat":"Barbell Back Squat", "squats":"Bodyweight Squats", "bodyweight squat":"Bodyweight Squats", "air squat":"Bodyweight Squats",
  "back squat":"Barbell Back Squat", "goblet squats":"Goblet Squat",
  "deadlift":"Barbell Romanian Deadlift", "deadlifts":"Barbell Romanian Deadlift", "romanian deadlift":"Barbell Romanian Deadlift", "rdl":"Barbell Romanian Deadlift", "stiff leg deadlift":"Barbell Romanian Deadlift",
  "pull up":"Lat Pulldown / Pull-up", "pull ups":"Lat Pulldown / Pull-up", "pullup":"Lat Pulldown / Pull-up", "pullups":"Lat Pulldown / Pull-up", "chin up":"Lat Pulldown / Pull-up", "chin ups":"Lat Pulldown / Pull-up",
  "lat pulldown":"Lat Pulldown / Pull-up", "assisted pull up":"Lat Pulldown / Pull-up",
  "row":"Seated Cable Row", "cable row":"Seated Cable Row", "seated row":"Seated Cable Row",
  "bent over row":"Chest-Supported Row", "barbell row":"Chest-Supported Row", "bent over barbell row":"Chest-Supported Row",
  "dumbbell row":"One-Arm Dumbbell Row", "single arm dumbbell row":"One-Arm Dumbbell Row",
  "bicep curl":"Barbell Curl", "biceps curl":"Barbell Curl", "bicep curls":"Barbell Curl", "biceps curls":"Barbell Curl", "barbell bicep curl":"Barbell Curl", "curl":"Barbell Curl", "curls":"Barbell Curl",
  "dumbbell curl":"Incline Dumbbell Curl", "dumbbell bicep curl":"Incline Dumbbell Curl", "hammer curls":"Hammer Curl",
  "tricep extension":"Overhead Cable Triceps Extension", "triceps extension":"Overhead Cable Triceps Extension", "tricep extensions":"Overhead Cable Triceps Extension", "triceps extensions":"Overhead Cable Triceps Extension", "overhead tricep extension":"Overhead Cable Triceps Extension",
  "tricep pushdown":"Cable Rope Pushdown", "triceps pushdown":"Cable Rope Pushdown", "tricep pushdowns":"Cable Rope Pushdown", "triceps pushdowns":"Cable Rope Pushdown", "pushdown":"Cable Rope Pushdown", "pushdowns":"Cable Rope Pushdown", "rope pushdown":"Cable Rope Pushdown",
  "dips":"Bench Dips", "tricep dips":"Bench Dips", "dip":"Bench Dips",
  "shoulder press":"Seated Dumbbell Shoulder Press", "overhead press":"Seated Dumbbell Shoulder Press", "military press":"Seated Dumbbell Shoulder Press", "dumbbell shoulder press":"Seated Dumbbell Shoulder Press",
  "lateral raise":"Dumbbell Lateral Raise", "lateral raises":"Dumbbell Lateral Raise", "side raise":"Dumbbell Lateral Raise", "side raises":"Dumbbell Lateral Raise",
  "face pull":"Band Face Pull", "face pulls":"Band Face Pull",
  "leg curl":"Lying Leg Curl", "hamstring curl":"Lying Leg Curl", "leg extension":"Leg Extension", "leg extensions":"Leg Extension",
  "lunge":"Reverse Lunges", "lunges":"Reverse Lunges", "walking lunge":"Reverse Lunges", "walking lunges":"Reverse Lunges",
  "split squat":"Bulgarian Split Squat", "bulgarian split squats":"Bulgarian Split Squat", "rear foot elevated split squat":"Bulgarian Split Squat",
  "calf raise":"Standing Calf Raise", "calf raises":"Standing Calf Raise",
  "hip thrust":"Barbell Hip Thrust", "hip thrusts":"Barbell Hip Thrust", "glute bridge":"Glute Bridge", "glute bridges":"Glute Bridge",
  "plank":"Plank (core)", "planks":"Plank (core)", "side plank":"Plank (core)", "forearm plank":"Plank (core)",
  "crunch":"Weighted Cable Crunch (core)", "crunches":"Weighted Cable Crunch (core)", "sit up":"Weighted Cable Crunch (core)", "sit ups":"Weighted Cable Crunch (core)",
  "leg raise":"Hanging Leg Raise (core)", "leg raises":"Hanging Leg Raise (core)", "hanging leg raises":"Hanging Leg Raise (core)", "lying leg raise":"Hanging Leg Raise (core)",
  "mountain climber":"Mountain Climbers", "burpee":"Burpees",
  "chest fly":"Cable Chest Fly", "chest flys":"Cable Chest Fly", "chest flyes":"Cable Chest Fly", "dumbbell fly":"Cable Chest Fly", "pec deck":"Cable Chest Fly",
  "reverse lunge":"Reverse Lunges", "leg presses":"Leg Press", "hanging leg raise":"Hanging Leg Raise (core)", "lying leg raises":"Lying Leg Raise (core)",
  "dumbbell goblet squat":"Goblet Squat", "seated cable rows":"Seated Cable Row", "squat jump":"Squat Jumps", "bear crawls":"Bear Crawl"
};
const EX_VID = (function(){
  const m = {};
  [DAYS_PREVIEW, DAYS_MALE, LEGACY_MALE_DAYS, DAYS_FEMALE, DAYS_MALE_CAL, DAYS_FEMALE_CAL, DAYS_EXTRA].forEach(set=>{
    set.forEach(d=> d.exercises.forEach(ex=>{
      if(!ex.vid) return;
      m[_shapeKey(ex.en)] = ex.vid;
      const ar = AR_EX[ex.en]; if(ar) m[_shapeKey(ar)] = ex.vid;
    }));
  });
  Object.keys(EX_ALIASES).forEach(alias=>{
    const vid = m[_shapeKey(EX_ALIASES[alias])];
    if(vid) m[_shapeKey(alias)] = vid;
  });
  return m;
})();
// Exact normalised name (English or Arabic) or an EX_ALIASES alias, the same
// rules as GymExerciseShape: never a contains-match, so a move never borrows
// another move's clip. No match = "" (the card shows "Video coming soon").
window.GymExerciseVideo = function(name){
  const k = _shapeKey(name);
  return (k && EX_VID[k]) || "";
};
// ---- exercise-name -> muscle tags (AI-coach plans, and plans saved before they carried tags) ----
// Exact normalised name (English or Arabic) or an EX_ALIASES alias, never a
// contains-match: a wrong muscle lit up is worse than no picture.
// _normEx drops non-latin letters, which would collapse every Arabic name to ""; keep them here.
function _shapeKey(s){ return String(s||"").toLowerCase().replace(/\(.*?\)/g," ").replace(/[^a-z0-9\u0600-\u06FF]+/g," ").trim(); }
const EX_SHAPE_SKIP = { "side plank":1 }; // reuses the Plank video, but trains the obliques
// Generic names that don't say which head ("bicep curl", "tricep pushdown") train the whole muscle,
// not the one head of the clip they borrow. Named variations (hammer, overhead, rope) keep theirs.
const EX_WHOLE = { biceps:["biceps_long","biceps_short"], triceps:["triceps_long","triceps_lateral"] };
const EX_GENERIC = {
  "bicep curl":"biceps", "biceps curl":"biceps", "bicep curls":"biceps", "biceps curls":"biceps", "barbell bicep curl":"biceps",
  "dumbbell curl":"biceps", "dumbbell bicep curl":"biceps", "curl":"biceps", "curls":"biceps",
  "tricep extension":"triceps", "triceps extension":"triceps", "tricep extensions":"triceps", "triceps extensions":"triceps",
  "tricep pushdown":"triceps", "triceps pushdown":"triceps", "tricep pushdowns":"triceps", "triceps pushdowns":"triceps",
  "pushdown":"triceps", "pushdowns":"triceps", "dips":"triceps", "tricep dips":"triceps", "dip":"triceps"
};
const EX_SHAPE = (function(){
  const m = {};
  [DAYS_PREVIEW, DAYS_MALE, LEGACY_MALE_DAYS, DAYS_FEMALE, DAYS_MALE_CAL, DAYS_FEMALE_CAL, DAYS_EXTRA].forEach(set=>{
    set.forEach(d=> d.exercises.forEach(ex=>{
      if(!ex.shape) return;
      const tags = ex.shape2 ? {shape:ex.shape, shape2:ex.shape2} : {shape:ex.shape};
      if(!m[_shapeKey(ex.en)]) m[_shapeKey(ex.en)] = tags;
      const ar = AR_EX[ex.en]; if(ar && !m[_shapeKey(ar)]) m[_shapeKey(ar)] = tags;
    }));
  });
  Object.keys(EX_ALIASES).forEach(alias=>{
    const tags = m[_shapeKey(EX_ALIASES[alias])];
    const whole = EX_GENERIC[alias] && EX_WHOLE[EX_GENERIC[alias]];
    if(tags && !EX_SHAPE_SKIP[alias] && !m[_shapeKey(alias)]) m[_shapeKey(alias)] = whole ? {shape:whole[0], shape2:whole[1]} : tags;
  });
  return m;
})();
window.GymExerciseShape = function(name){
  const k = _shapeKey(name);
  const t = k ? EX_SHAPE[k] : null;
  return t ? Object.assign({}, t) : null;
};
const T = {
  appTitle:["Etqadem","اتقدم"],
  homeLink:["Etqadem home","الصفحة الرئيسية لاتقدم"],
  obTitle:["One step forward, every day.","اتقدم خطوة كل يوم"],
  obSub:["Your plan, logging, rest timer, form videos and AI coach — in one app.","خطتك، تسجيل تمارينك، مؤقت الراحة، فيديوهات الأداء ومدرّب ذكي — في تطبيق واحد."],
  obStart:["Start Changing Yourself","ابدأ بتغيير نفسك"],
  obContinue:["Continue without signing in","المتابعة بدون تسجيل الدخول"],
  fxTagline:["Every rep counts.","كل تكرار يُحسب."],
  aeShowPw:["Show password","إظهار كلمة المرور"],
  obWhy:["Why sign in?","لماذا تسجّل الدخول؟"],
  obWhy1:["Keep progress across devices","احفظ تقدّمك عبر الأجهزة"],
  obWhy2:["All training days & important notes","كل أيام التمرين والملاحظات المهمة"],
  obWhy3:["A personalised AI coach","مدرّب ذكاء اصطناعي مخصّص"],
  obLegal:["By continuing, you agree to our <a href=\"/terms\">Terms</a> and <a href=\"/privacy\">Privacy Policy</a> and confirm you're 18 or older.","بالمتابعة، أنت توافق على <a href=\"/terms\">شروط الاستخدام</a> و<a href=\"/privacy\">سياسة الخصوصية</a> وتؤكد أن عمرك 18 عامًا أو أكثر."],
  resolvingSession:["Resolving your session…","جارٍ التحقق من جلستك…"],
  anonLockTitle:["Sign in to unlock everything","سجّل الدخول لفتح كل المزايا"],
  anonLockBody:["Full plans, sync across devices and the AI coach — free with an account.","الخطط الكاملة، المزامنة بين أجهزتك، والمدرّب الذكي — مجاناً مع حساب."],
  anonSignIn:["Sign in with Google","سجّل الدخول عبر جوجل"],
  male:["Male","رجالي"],
  female:["Female","نسائي"],
  styleGym:["Gym","جيم"], styleCal:["In-House / Bodyweight","منزلي / وزن الجسم"],
  langBtn:["العربية","English"],
  // ---- top-right header / profile / notifications (header.js, profile.js, notifications.js) ----
  hdrStreak:["{n}-day streak","سلسلة {n} يوم"],
  hdrStreakPending:["{n}-day streak, today not trained yet","سلسلة {n} يوم، لم تتمرن اليوم بعد"],
  // ---- rest days + save-yesterday prompt (rest-days.js) ----
  restBadge:["Rest day","يوم راحة"],
  restTake:["Take a rest day","خذ يوم راحة"],
  restMark:["Mark as rest day","تحديد كيوم راحة"],
  restUndo:["Undo rest day","إلغاء يوم الراحة"],
  restTodayNone:["Today: not trained yet","اليوم: لم تتمرن بعد"],
  restTodayDone:["Today: trained","اليوم: تمرنت"],
  restTodayRest:["Today: rest day, streak kept","اليوم: يوم راحة، السلسلة محفوظة"],
  restLeft:["{n} of 2 rest days left","متبقي {n} من يومَي راحة"],
  restHint:["keeps your streak","يحافظ على سلسلتك"],
  weekRest:["Rest","راحة"],
  weekDayN:["Day {n}","اليوم {n}"],
  restPanelBody:["Day {n} of 7. Recovery is when training turns into strength. Nothing to log today.","اليوم {n} من 7. في الراحة يتحول التمرين إلى قوة. لا شيء لتسجيله اليوم."],
  restPanelNext:["Next up: {day}","التالي: {day}"],
  restMarked:["Rest day saved","تم حفظ يوم الراحة"],
  restRemoved:["Rest day removed","تم إلغاء يوم الراحة"],
  celebDay1:["Great job. See you tomorrow","عمل رائع. نشوفك بكرة إن شاء الله"],
  celebDay2:["Two days in a row. Keep it going","يومين ورا بعض، عاش يا كوتش"],
  celebHabit:["{n} days in a row. You're building a habit","{n} أيام، ربنا ما يقطعها عادة"],
  celebHabitMany:["{n} days in a row. You're building a habit","{n} يوم، ربنا ما يقطعها عادة"],
  celebWeek1:["A full week in a row. You deserve the best","أسبوع تمرين كامل، إنت تستاهل الأفضل"],
  celebWeek1F:["A full week in a row. You deserve the best","أسبوع تمرين كامل، إنتي تستاهلي الأفضل"],
  celebWeek2:["Two weeks in a row. That's commitment","أسبوعين تمرين متواصل، هو ده الالتزام"],
  celebWeeks:["{w} weeks in a row. That's commitment","{w} أسابيع تمرين متواصل، هو ده الالتزام"],
  celebWeeksMany:["{w} weeks in a row. That's commitment","{w} أسبوع تمرين متواصل، هو ده الالتزام"],
  celebRest:["Rest is part of training. Recharge and come back stronger","الراحة جزء من التدريب. اشحن طاقتك وارجع أقوى"],
  celebRestF:["Rest is part of training. Recharge and come back stronger","الراحة جزء من التدريب. اشحني طاقتك وارجعي أقوى"],
  restErrLimit:["You've used both rest days this week.","استخدمت يومَي الراحة لهذا الأسبوع."],
  restErrTrained:["You already trained that day.","لقد تمرنت في هذا اليوم بالفعل."],
  restErrWindow:["Only today and yesterday can be changed.","يمكن تغيير اليوم والأمس فقط."],
  restErrNet:["Couldn't save. Check your connection and try again.","تعذّر الحفظ. تحقق من الاتصال وحاول مرة أخرى."],
  sydTitle:["Did you finish yesterday's workout but forget to mark it?","هل أنهيت تمرين أمس ونسيت تسجيله؟"],
  sydBody:["You checked {d} of {t} exercises for {day}. Saving it keeps your streak going.","أنجزت {d} من {t} تمارين في {day}. حفظه يُبقي سلسلتك مستمرة."],
  sydYes:["Yes, save it","نعم، احفظه"],
  sydNo:["No, I didn't","لا، لم أنهِه"],
  sydSaved:["Yesterday's workout saved","تم حفظ تمرين أمس"],
  sydTooLate:["Yesterday's workout can't be saved any more.","لم يعد بالإمكان حفظ تمرين أمس."],
  sydSignIn:["Sign in to save yesterday's workout","سجّل دخولك عشان يتحفظ تمرين امبارح"],
  queueDropped:["A workout from an earlier day wasn't saved. Only today and yesterday can be recorded.","لم يُحفظ تمرين من يوم سابق. يمكن تسجيل اليوم والأمس فقط."],
  hdrAccountMenu:["Account menu","قائمة الحساب"],
  hdrGoProfile:["Go to profile","الذهاب إلى الملف الشخصي"],
  hdrAdmin:["Admin dashboard","لوحة الإدارة"],
  hdrBlocked:["This account has been disabled. Contact support if you think this is a mistake.","تم تعطيل هذا الحساب. تواصل مع الدعم إذا كنت تعتقد أن هذا خطأ."],
  hdrRemoved:["This account was removed. Contact support if you think this is a mistake.","تمت إزالة هذا الحساب. تواصل مع الدعم إذا كنت تعتقد أن هذا خطأ."],
  hdrSignOut:["Sign out","تسجيل الخروج"],
  hdrTips:["Replay tips","إعادة عرض النصائح"],
  notifBell:["Notifications","الإشعارات"],
  notifBellUnread:["Notifications, {n} unread","الإشعارات، {n} غير مقروءة"],
  notifTitle:["Notifications","الإشعارات"],
  notifClose:["Close","إغلاق"],
  notifEmpty:["No notifications yet. Workout reminders will show up here.","لا توجد إشعارات بعد. ستظهر تذكيرات التمرين هنا."],
  notifLoadErr:["Couldn't load notifications. Check your connection and try again.","تعذّر تحميل الإشعارات. تحقّق من الاتصال وحاول مرة أخرى."],
  notifRetry:["Try again","حاول مرة أخرى"],
  notifReadAll:["Mark all as read","تحديد الكل كمقروء"],
  notifAllReadDone:["All notifications marked as read","تم تحديد كل الإشعارات كمقروءة"],
  notifAllReadErr:["Couldn't mark notifications as read. Try again.","تعذّر تحديد الإشعارات كمقروءة. حاول مرة أخرى."],
  notifHintDay:["Log or rest","سجّل أو خذ راحة"],
  notifHintPlan:["Open plan","افتح الخطة"],
  notifHintCheckin:["Open check-in","افتح التسجيل الأسبوعي"],
  notifHintCoach:["Open coach","افتح المدرب"],
  notifHintFood:["Open food","افتح التغذية"],
  notifHintProfile:["Open profile","افتح الملف الشخصي"],
  notifCheckinDone:["This week's check-in is already done.","تم تسجيل هذا الأسبوع بالفعل."],
  notifCheckinBaseline:["Build your first plan to unlock weekly check-ins.","أنشئ خطتك الأولى لتفتح التسجيل الأسبوعي."],
  notifCheckinOff:["The check-in isn't available right now. Try again from Coach.","التسجيل الأسبوعي غير متاح الآن. حاول مرة أخرى من المدرب."],
  notifUnreadDot:["Unread","غير مقروء"],
  notifJustNow:["just now","الآن"],
  profTitle:["Profile","الملف الشخصي"],
  profSub:["Your photo, stats and progress","صورتك وبياناتك وتقدّمك"],
  profPhotoLabel:["Photo","الصورة"],
  profChangePhoto:["Change photo","تغيير الصورة"],
  profUploading:["Uploading…","جارٍ الرفع…"],
  profPhotoSaved:["✓ Photo updated","✓ تم تحديث الصورة"],
  profPhotoHint:["JPEG or PNG, up to 5 MB.","JPEG أو PNG، حتى 5 ميجابايت."],
  profPhotoType:["Please choose a JPEG or PNG image.","يرجى اختيار صورة بصيغة JPEG أو PNG."],
  profPhotoTooBig:["That photo is larger than 5 MB. Please choose a smaller one.","حجم الصورة أكبر من 5 ميجابايت. يرجى اختيار صورة أصغر."],
  profPhotoErr:["Couldn't upload the photo. Try again.","تعذّر رفع الصورة. حاول مرة أخرى."],
  profStatsLabel:["Your details","بياناتك"],
  profName:["Display name","الاسم الظاهر"],
  profWeight:["Weight (kg)","الوزن (كجم)"],
  profHeight:["Height (cm)","الطول (سم)"],
  profSave:["Save","حفظ"],
  profSaving:["Saving…","جارٍ الحفظ…"],
  profSaved:["✓ Saved","✓ تم الحفظ"],
  profNameErr:["Name must be 1–50 characters (Arabic letters count as two).","يجب ألا يتجاوز الاسم نحو 25 حرفاً عربياً (أو 50 حرفاً لاتينياً)."],
  profWeightErr:["Weight must be between 20 and 400 kg.","يجب أن يكون الوزن بين 20 و400 كجم."],
  profHeightErr:["Height must be between 50 and 250 cm.","يجب أن يكون الطول بين 50 و250 سم."],
  profSaveErr:["Couldn't save your details. Try again.","تعذّر حفظ بياناتك. حاول مرة أخرى."],
  profProgressLabel:["Progress","التقدّم"],
  profStreak:["Current streak","السلسلة الحالية"],
  profStreakDays:["{n}-day streak","سلسلة {n} يوم"],
  profStreakNone:["No active streak — finish today's workout to start one.","لا توجد سلسلة حالياً — أكمل تمرين اليوم لتبدأ واحدة."],
  profStreakPending:["Train today to keep your streak going.","تمرّن اليوم لتحافظ على سلسلتك."],
  profTotalDays:["Days trained","أيام التمرين"],
  profSignInPrompt:["Sign in to see your profile.","سجّل الدخول لعرض ملفك الشخصي."],
  profSignInBtn:["Sign in","تسجيل الدخول"],
  profLoadErr:["Couldn't load your profile. Try again later.","تعذّر تحميل ملفك الشخصي. حاول مرة أخرى لاحقاً."],
  profBack:["Back","رجوع"],
  installTip:["<b>Install the app:</b> browser menu → Add to Home Screen.","<b>ثبّت التطبيق:</b> قائمة المتصفح ← إضافة إلى الشاشة الرئيسية."],
  workoutTimer:["Workout Timer","مؤقّت التمرين"],
  notStarted:["Not started yet","لم يبدأ بعد"],
  startWorkout:["Start Workout","ابدأ التمرين"],
  endWorkout:["End Workout","أنهِ التمرين"],
  inProgress:["In progress…","جارٍ التنفيذ…"],
  pause:["Pause","إيقاف مؤقت"],
  resume:["Resume","استئناف"],
  paused:["Paused","متوقّف مؤقتاً"],
  lastSession:["Last {d} session: {n} min","آخر جلسة {d}: {n} دقيقة"],
  warmupTitle:["Warm-up","الإحماء"],
  warmupSum:["5 min cardio · mobility · ramp-up sets","5 دقائق كارديو · تحريك المفاصل · مجموعات تدرّج"],
  showSteps:["Show steps","عرض الخطوات"],
  video:["Video","فيديو"], hideVideo:["Hide video","إخفاء الفيديو"], videoSoon:["Video coming soon","الفيديو قريباً"],
  warmup1:["<b>Cardio</b> — 5 min easy, until a light sweat.","<b>كارديو</b> — 5 دقائق خفيفة حتى تعرق قليلاً."],
  warmup2:["<b>Mobility</b> — 5–8 slow reps: arm circles and band pull-aparts on upper days; leg swings and bodyweight squats on lower days.","<b>تحريك المفاصل</b> — 5–8 تكرارات بطيئة: تدوير الذراعين وشد المطاط في أيام العلوي؛ أرجحة الساق وسكوات بوزن الجسم في أيام السفلي."],
  warmup3:["<b>Ramp-up sets</b> — first lift only: bar ×10, ~50% ×5, ~70% ×3, ~85% ×1.","<b>مجموعات تدرّج</b> — للتمرين الأول فقط: بار فارغ ×10، ~50% ×5، ~70% ×3، ~85% ×1."],
  warmup4:["<b>Go.</b> Isolation moves need just one light set first.","<b>ابدأ.</b> تمارين العزل تكفيها مجموعة خفيفة واحدة قبلها."],
  viewFront:["Front","أمام"], viewBack:["Back","خلف"],
  mapTitle:["Muscles this week","عضلات هذا الأسبوع"],
  mapSummary:["{two} of {n} trained twice, {one} once","تم تدريب {two} من {n} مرتين و{one} مرة واحدة"],
  mapOnce:["Trained once","تم التدريب مرة واحدة"], mapTwice:["Trained twice","تم التدريب مرتين"], mapNone:["not trained yet","لم تُدرَّب بعد"],
  mapOnceIn:["trained once","تم التدريب مرة واحدة"], mapTwiceIn:["trained twice","تم التدريب مرتين"],
  mapRegion:["{m}, {s}","{m}، {s}"], mapHint:["Tap a muscle to see its name.","المس عضلة لمعرفة اسمها."],
  setsGroup:["Sets","المجموعات"], setLblReps:["Set {n} · {r} reps","المجموعة {n} · {r} تكرار"], setLblSec:["Set {n} · {r} sec","المجموعة {n} · {r} ث"], setLblRaw:["Set {n} · {r}","المجموعة {n} · {r}"],
  sets:["sets","مجموعات"], reps:["reps","تكرار"], rest:["rest","راحة"],
  save:["Save","حفظ"], saved:["✓ Saved","✓ تم الحفظ"], restBtn:["Rest","راحة"],
  lastLog:["Last: {w} kg × {r}","الأخير: {w} كجم × {r}"],
  noLog:["No log yet","لا يوجد سجل بعد"],
  wtPH:["wt","وزن"], repPH:["rep","عدد"],
  resetChecklist:["Reset today's checklist","إعادة ضبط قائمة اليوم"],
  resetToastMsg:["Today's checklist was reset.","تمت إعادة ضبط قائمة اليوم."],
  undo:["Undo","تراجع"],
  dayAlreadyDone:["Already done today. Reset the checklist to log it again.","تم إنجازه اليوم. أعِد ضبط القائمة لتسجيله مرة أخرى."],
  notesTitle:["Plan tips","نصائح الخطة"],
  skip:["Skip","تخطٍّ"],
  restTimer:["Rest — {name}","راحة — {name}"],
  restAdd:["Add 15 seconds","إضافة 15 ثانية"],
  restTenLeft:["10 seconds left","باقي 10 ثوانٍ"],
  restOverLive:["Rest is over","انتهت الراحة"],
  restOverTitle:["Rest is over","انتهت الراحة"],
  restOverBody:["Next set: {name}","المجموعة التالية: {name}"],
  timeLbl:["time","الوقت"],
  secPH:["time","وقت"], secUnit:["sec","ثانية"],
  exStart:["Start {n} s","ابدأ {n} ثانية"],
  exTimer:["Exercise timer — {name}","مؤقت التمرين — {name}"],
  exReady:["Get ready","استعد"],
  exGo:["Go","يلا"],
  exStop:["Stop","إيقاف"],
  exOverLive:["Time's up","انتهى الوقت"],
  exOverTitle:["Time's up","انتهى الوقت"],
  exOverBody:["{n} s filled in. Tap Save to log the set.","اتكتبت {n} ثانية في الخانة. دوس حفظ علشان تسجّل المجموعة."],
  exOverBodyF:["{n} s filled in. Tap Save to log the set.","اتكتبت {n} ثانية في الخانة. دوسي حفظ علشان تسجّلي المجموعة."],
  timeUp:["Time's up","انتهى الوقت"],
  alarmStop:["Stop","إيقاف"],
  alarmChannel:["Timer alarm","منبّه المؤقت"],
  preciseTitle:["Allow precise rest alerts?","تسمح بتنبيهات الراحة بالثانية؟"],
  preciseTitleF:["Allow precise rest alerts?","تسمحي بتنبيهات الراحة بالثانية؟"],
  preciseBody:["So your rest alert rings on time, even with the screen off.","ليرنّ تنبيه الراحة في وقته حتى والشاشة مطفأة."],
  preciseBodyF:["So your rest alert rings on time, even with the screen off.","ليرنّ تنبيه الراحة في وقته حتى والشاشة مطفأة."],
  preciseAllow:["Allow","اسمح"],
  preciseAllowF:["Allow","اسمحي"],
  preciseLater:["Not now","مش دلوقتي"],
  exVideo:["Exercise video","فيديو التمرين"],
  settings:["Settings","الإعدادات"],
  planLabel:["Plan","الخطة"],
  programLabel:["Program","البرنامج"],
  splitLabel:["Training split","تقسيم التمرين"],
  splitDays:["Days per week","أيام في الأسبوع"],
  splitClassic:["Classic","الكلاسيكي"],
  splitClassicNote:["Your current plan, unchanged. Pick a number of days to switch to a split.","خطتك الحالية كما هي. اختر عدد الأيام للتحويل إلى تقسيم."],
  splitDaysN:["{n} days","{n} أيام"],
  splitBest:["Best fit for your setup: {n} days.","الأنسب لتجهيزاتك: {n} أيام."],
  splitBestMark:["best fit","الأنسب"],
  splitWeekdays:["Training days: {d}","أيام التمرين: {d}"],
  splitWhere:["Where you train","مكان التمرين"],
  splitGym:["Gym","جيم"], splitHome:["Home","المنزل"],
  splitTools:["What you have at home","ما لديك في المنزل"],
  splitSumTitle:["What this split trains","ماذا يدرّب هذا التقسيم"],
  splitSum3:["Three full-body days: Full Body A, B and C. Every muscle is trained at least twice a week.","ثلاثة أيام لكامل الجسم: أ و ب و ج. كل عضلة تُدرَّب مرتين على الأقل أسبوعياً."],
  splitSum4:["Upper, Lower, Upper, Lower. Every muscle is trained twice a week.","علوي، سفلي، علوي، سفلي. كل عضلة تُدرَّب مرتين أسبوعياً."],
  splitSum5:["Upper, Lower, Push, Pull, Legs. Every muscle is trained twice a week, some more.","علوي، سفلي، دفع، سحب، أرجل. كل عضلة تُدرَّب مرتين أسبوعياً وبعضها أكثر."],
  splitSum6:["Push, Pull, Legs, twice over. Every muscle is trained twice a week.","دفع، سحب، أرجل، مرتين. كل عضلة تُدرَّب مرتين أسبوعياً."],
  splitHint:["Tick {tool} to cover {parts}.","فعّل {tool} لتغطية {parts}."],
  splitSaved:["Split updated","تم تحديث التقسيم"],
  toolsLbl:["Tools","الأدوات"],
  tool_none:["No equipment","بدون معدات"], tool_dumbbell:["Dumbbells","دمبل"], tool_band:["Resistance bands","أحزمة مقاومة"],
  tool_bench:["Bench or chair","بنش أو كرسي"], tool_table:["Sturdy table","طاولة ثابتة"], tool_pullup_bar:["Pull-up bar","بار عقلة"],
  tool_kettlebell:["Kettlebell","كيتل بيل"], tool_jump_rope:["Jump rope","حبل قفز"],
  tool_barbell:["Barbell","بار"], tool_cable:["Cable","كيبل"], tool_machine:["Machine","جهاز"],
  prefsLabel:["Display preferences","تفضيلات العرض"],
  themeToDark:["Switch to dark mode","التبديل إلى الوضع الداكن"], themeToLight:["Switch to light mode","التبديل إلى الوضع الفاتح"],
  menuThemeDark:["Dark mode","الوضع الداكن"], menuThemeLight:["Light mode","الوضع الفاتح"],
  premiumLabel:["Premium","بريميوم"],
  premiumTitle:["Etqadem Premium","اتقدم بريميوم"],
  premiumSub:["Coming soon","قريباً"],
  premiumPerk1:["Higher AI-coach limits","حدود أعلى لمحادثات المدرّب الذكي"],
  premiumPerk2:["Ramadan mode adjustments","تعديلات وضع رمضان"],
  premiumPerk3:["Priority support","دعم ذو أولوية"],
  premiumComingSoon:["Coming soon","قريباً"],
  daysLabel:["Days","الأيام"],
  navPlan:["Plan","الخطة"],
  navCoach:["Coach","المدرّب"],
  navFood:["Food","الطعام"],
  navMore:["More","المزيد"],
  coachTitle:["AI Coach","المدرّب الذكي"],
  coachSub:["A diet & training plan built from your numbers","خطة تغذية وتمرين مبنية على أرقامك"],
  styleCoach:["Coach plan","خطة المدرّب"],
  foodTitle:["Food","الطعام"],
  foodSub:["Log your meals and see today's totals","سجّل وجباتك وشاهد إجمالي اليوم"]
};
const NOTES = {
  male_gym:{ en:[
    "<b>Week:</b> Upper · Lower · rest · Back + Biceps + Calves · Chest + Triceps · rest · rest.",
    "<b>Progress:</b> hit the top of the rep range, then add weight.",
    "<b>Effort:</b> stop compound sets 1–3 reps short of failure.",
    "<b>Recover:</b> 7–9 h sleep; deload every 5–8 weeks.",
    "<b>Protein:</b> 1.6–2.2 g per kg body weight a day."
  ], ar:[
    "<b>الأسبوع:</b> علوي · سفلي · راحة · ظهر + بايسبس + سمانة · صدر + ترايسبس · راحة · راحة.",
    "<b>التدرّج:</b> عند بلوغ أعلى نطاق التكرار، زِد الوزن.",
    "<b>الجهد:</b> أوقف التمارين المركّبة قبل الفشل بـ1–3 تكرارات.",
    "<b>الاستشفاء:</b> نوم 7–9 ساعات؛ أسبوع تخفيف كل 5–8 أسابيع.",
    "<b>البروتين:</b> 1.6–2.2 جم لكل كجم من وزنك يومياً."
  ]},
  female_gym:{ en:[
    "<b>Week:</b> Sat Lower A · Sun Upper A · Tue Lower B · Wed Upper B.",
    "<b>Progress:</b> add reps first, then a little weight.",
    "<b>Steps:</b> 7–9k a day, plus 2–3 brisk walks a week.",
    "<b>Form first:</b> go light on single-leg moves until you're steady.",
    "<b>Protein:</b> ~1.6–2 g per kg body weight a day."
  ], ar:[
    "<b>الأسبوع:</b> السبت سفلي أ · الأحد علوي أ · الثلاثاء سفلي ب · الأربعاء علوي ب.",
    "<b>التدرّج:</b> زيدي التكرارات أولاً، ثم وزناً بسيطاً.",
    "<b>الخطوات:</b> 7–9 آلاف يومياً، مع 2–3 جلسات مشي سريع أسبوعياً.",
    "<b>الأداء أولاً:</b> ابدئي خفيفاً في تمارين الرجل الواحدة حتى تثبتي.",
    "<b>البروتين:</b> ~1.6–2 جم لكل كجم من وزنك يومياً."
  ]},
  male_cal:{ en:[
    "<b>Week:</b> Push · Legs · Pull, on non-consecutive days.",
    "<b>Circuit:</b> the listed rest is a maximum — keep moving.",
    "<b>Reps:</b> stop 1–2 clean reps short; add reps before difficulty.",
    "<b>Too easy?</b> Slow the lowering, then raise your feet.",
    "<b>No bar?</b> Do inverted rows under a sturdy table."
  ], ar:[
    "<b>الأسبوع:</b> دفع · أرجل · سحب، في أيام غير متتالية.",
    "<b>دوائر:</b> الراحة المذكورة حدّ أقصى — استمر في الحركة.",
    "<b>التكرارات:</b> توقّف قبل الفشل بـ1–2 تكرار؛ زِد التكرارات قبل الصعوبة.",
    "<b>سهل جداً؟</b> أبطئ النزول، ثم ارفع قدميك.",
    "<b>بدون عقلة؟</b> نفّذ التجديف المقلوب تحت طاولة ثابتة."
  ]},
  female_cal:{ en:[
    "<b>Week:</b> Push · Legs · Pull, on non-consecutive days.",
    "<b>Circuit:</b> the listed rest is a maximum — keep the pace up.",
    "<b>Scale it:</b> knee or bench push-ups until you can do 8 clean reps.",
    "<b>Steps:</b> 7–9k a day, plus 1–2 brisk walks a week.",
    "<b>No bar?</b> Do inverted rows under a sturdy table."
  ], ar:[
    "<b>الأسبوع:</b> دفع · أرجل · سحب، في أيام غير متتالية.",
    "<b>دوائر:</b> الراحة المذكورة حدّ أقصى — حافظي على الإيقاع.",
    "<b>حسب مستواكِ:</b> ضغط على الركبتين أو على مقعد حتى تؤدّي 8 تكرارات نظيفة.",
    "<b>الخطوات:</b> 7–9 آلاف يومياً، مع 1–2 جلسة مشي سريع أسبوعياً.",
    "<b>بدون عقلة؟</b> نفّذي التجديف المقلوب تحت طاولة ثابتة."
  ]}
};

// ---------------- DATA-DRIVEN MIGRATION: PR#44 male-plan id rewrite ----------------
// PR #44 (2026-09-28, commit 1bba5a6) replaced the old Chest&Triceps/
// Back&Biceps A/B split with an Upper/Lower A/B split and gave every
// DAYS_MALE day and exercise a brand-new id (e.g. ct_a -> m_upperA,
// cta_bench -> mua_bench). That orphaned any existing male-plan user's
// history in gym_checks/gym_weights/gym_sessions (all keyed by those ids)
// plus the remembered active-day tab — nothing in the new DAYS_MALE matches
// the old ids anymore. This is a data-driven, idempotent rewrite: for every
// old id that has a same-exercise counterpart in the new split (matched by
// exact `en` name + `vid`), its data is merged onto the new id, never
// overwriting data already sitting under the new id. Old ids with no
// counterpart (the rewrite genuinely dropped that exact move — e.g.
// cta_fly/Cable Chest Fly) are left exactly where they are — nothing is
// deleted, so a future reviewer can still find it.
//
// Exposed as window.GymMigrations.maleV2() (not a one-shot flag-gated IIFE)
// so it can be re-run whenever old-id data might exist: once here at boot,
// and again by sync.js after every server pull — a device still on an
// older app.js can push old-id data at any point, and that data needs
// migrating the moment it lands here, not just once on this device's first
// boot after the id rewrite shipped. Every write below only fires when old-
// id data is actually found unmerged, so a call that finds nothing to do
// is a fast no-op.
window.GymMigrations = window.GymMigrations || {};
window.GymMigrations.maleV2 = function migrateMaleIdsV2(){
  try {
    var DAY_MAP = { ct_a: "m_upperA", bb_a: "m_lowerA", ct_b: "m_upperB", bb_b: "m_lowerB" };
    var EX_MAP = {
      // ct_a (Chest & Triceps A) ->
      cta_bench: "mua_bench", cta_pushdown: "mua_pushdown", cta_squat: "mla_squat",
      cta_legpress: "mla_legpress", cta_core: "mla_core", cta_incline: "mub_incline",
      // cta_fly (Cable Chest Fly), cta_ohext (Overhead Cable Triceps Ext.): no counterpart, left in place.
      // bb_a (Back & Biceps A) ->
      bba_lat: "mua_pulldown", bba_csrow: "mua_row", bba_curl: "mua_curl",
      bba_rdl: "mla_rdl", bba_legcurl: "mla_legcurl", bba_core: "mlb_core",
      // bba_cablerow (Seated Cable Row), bba_inclcurl (Incline DB Curl): no counterpart.
      // ct_b (Chest & Triceps B) ->
      ctb_dips: "mub_dips", ctb_hack: "mlb_hack", ctb_legext: "mlb_legext",
      // ctb_dbbench, ctb_pushup, ctb_fly, ctb_super, ctb_core: no counterpart.
      // bb_b (Back & Biceps B) ->
      bbb_csdbrow: "mub_row", bbb_hammer: "mub_hammer", bbb_seatcurl: "mlb_seatcurl"
      // bbb_tbar, bbb_onearm, bbb_super, bbb_bss, bbb_core: no counterpart.
    };
    // Which new day each mapped exercise id now lives under — built from
    // DAYS_MALE itself (defined above) so this can never drift out of sync
    // with the map above.
    var EX_TO_NEW_DAY = {};
    DAYS_MALE.forEach(function(d){ d.exercises.forEach(function(ex){ EX_TO_NEW_DAY[ex.id] = d.id; }); });

    var touched = {}; // gym_* key -> true, so we know which sync meta timestamps to bump below

    // A corrupt/unexpected blob (null, a bare number/string, an array) must
    // yield a plain object here, never something Object.keys()/property
    // access on it could choke on downstream — fall back to {} for anything
    // that isn't a real non-array object.
    function readRaw(key){
      try {
        var v = JSON.parse(localStorage.getItem(key));
        return (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
      } catch(e){ return {}; }
    }
    function writeRaw(key, val){ localStorage.setItem(key, JSON.stringify(val)); touched[key] = true; }
    function mergeDateArray(oldArr, newArr){
      // Union two [{date,...}] arrays by date, keeping the existing
      // (new-id) entry on a same-date conflict — never overwrite new-id data.
      var byDate = {}; newArr.forEach(function(e){ if (e && e.date) byDate[e.date] = true; });
      var added = false;
      oldArr.forEach(function(e){
        if (!e || !e.date || byDate[e.date]) return;
        newArr.push(e); byDate[e.date] = true; added = true;
      });
      return added;
    }
    // Review fix (PR#48 HIGH): mergeDateArray() above appends migrated-in
    // old-id entries at the END, regardless of date, so a newer new-id entry
    // logged after #44 shipped ends up BEFORE an older migrated-in one.
    // lastLog()/lastSessionFor() read arr[arr.length-1] and the weight-input
    // placeholder uses that "last" entry, so Save-without-typing would log a
    // stale weight. Sort every migration-touched array back into date-
    // ascending order — and since this also repairs arrays #46's original
    // (pre-fix) one-shot run already left mis-ordered, it must run every
    // time on every mapped new-id array, not just ones this run just merged
    // into, and must only report a change when the order actually moved
    // (so the idempotent no-op case in review's run2 stays a no-op).
    function sortByDateAsc(arr){
      arr.sort(function(a, b){
        var ad = (a && a.date) || "", bd = (b && b.date) || "";
        return ad < bd ? -1 : ad > bd ? 1 : 0;
      });
    }
    function repairOrder(obj, newIds){
      var changed = false;
      newIds.forEach(function(id){
        var arr = obj[id];
        if (!Array.isArray(arr) || arr.length < 2) return;
        var before = arr.slice();
        sortByDateAsc(arr);
        for (var i = 0; i < arr.length; i++) { if (arr[i] !== before[i]) { changed = true; break; } }
      });
      return changed;
    }

    // ---- gym_weights: { exId: [ {date,...}, ... ] }, keyed by exercise only ----
    var weights = readRaw("gym_weights");
    var weightsChanged = false;
    Object.keys(EX_MAP).forEach(function(oldEx){
      var arr = weights[oldEx];
      if (!Array.isArray(arr) || !arr.length) return;
      var newEx = EX_MAP[oldEx];
      var existing = weights[newEx] || [];
      if (mergeDateArray(arr, existing)) { weights[newEx] = existing; weightsChanged = true; }
    });
    if (repairOrder(weights, Object.keys(EX_MAP).map(function(k){ return EX_MAP[k]; }))) weightsChanged = true;
    if (weightsChanged) writeRaw("gym_weights", weights);

    // ---- gym_sessions: { dayId: [ {date, durationSec}, ... ] } ----
    var sessions = readRaw("gym_sessions");
    var sessionsChanged = false;
    Object.keys(DAY_MAP).forEach(function(oldDay){
      var arr = sessions[oldDay];
      if (!Array.isArray(arr) || !arr.length) return;
      var newDay = DAY_MAP[oldDay];
      var existing = sessions[newDay] || [];
      if (mergeDateArray(arr, existing)) { sessions[newDay] = existing; sessionsChanged = true; }
    });
    if (repairOrder(sessions, Object.keys(DAY_MAP).map(function(k){ return DAY_MAP[k]; }))) sessionsChanged = true;
    if (sessionsChanged) writeRaw("gym_sessions", sessions);

    // ---- gym_checks: { "YYYY-MM-DD_dayId": { exId: bool } } ----
    // Note: an exercise's new day isn't always the same rotation slot as its
    // old day (e.g. cta_incline lived on ct_a but Incline DB Press is now on
    // m_upperB) — EX_TO_NEW_DAY (derived from the real DAYS_MALE data) is
    // the source of truth for where each migrated check lands, not DAY_MAP.
    var checks = readRaw("gym_checks");
    var checksChanged = false;
    Object.keys(checks).forEach(function(key){
      if (key.length < 12 || key.charAt(10) !== "_") return; // not a "YYYY-MM-DD_dayId" key
      var date = key.slice(0, 10);
      var dayChecks = checks[key];
      // A single bad entry (null, or hand-edited into a non-object) must
      // never abort the whole migration — skip just that entry and keep
      // going with the rest of gym_checks.
      if (!dayChecks || typeof dayChecks !== "object" || Array.isArray(dayChecks)) return;
      Object.keys(dayChecks).forEach(function(exId){
        var newEx = EX_MAP[exId];
        var newDay = newEx && EX_TO_NEW_DAY[newEx];
        if (!newDay) return;
        var newKey = date + "_" + newDay;
        checks[newKey] = checks[newKey] || {};
        if (checks[newKey][newEx] === undefined) { // never overwrite existing new-id data
          checks[newKey][newEx] = dayChecks[exId];
          checksChanged = true;
        }
      });
    });
    if (checksChanged) writeRaw("gym_checks", checks);

    // ---- remembered active-day tab (raw dayId string; only the "gym" style used DAYS_MALE) ----
    (function(){
      var key = "gym_active_day_male_gym";
      var v = localStorage.getItem(key);
      if (v && DAY_MAP[v]) { localStorage.setItem(key, DAY_MAP[v]); touched[key] = true; }
    })();
    // ---- pending day-rotation marker (device-local, not gym_-prefixed, never synced) ----
    try {
      var last = JSON.parse(localStorage.getItem("gymday_last_completed"));
      if (last && last.dayId && DAY_MAP[last.dayId]) {
        last.dayId = DAY_MAP[last.dayId];
        localStorage.setItem("gymday_last_completed", JSON.stringify(last));
      }
    } catch(e){}

    // ---- active in-progress session (LOCAL_ONLY in sync.js — never synced,
    // so it's rewritten in place with no meta bump) ----
    var sessionActiveChanged = false;
    try {
      var activeSess = JSON.parse(localStorage.getItem("gym_session_active"));
      if (activeSess && activeSess.dayId && DAY_MAP[activeSess.dayId]) {
        activeSess.dayId = DAY_MAP[activeSess.dayId];
        localStorage.setItem("gym_session_active", JSON.stringify(activeSess));
        sessionActiveChanged = true;
      }
    } catch(e){}

    // Sync-safe: bump gym_meta_updatedAt for every key rewritten above so a
    // later push actually sends the migrated data, WITHOUT letting the bump
    // itself win a last-write-wins race it has no business winning. Stamping
    // Date.now() here made a second device that migrates later (its own
    // clock, always "now") beat a first device's genuinely newer post-
    // migration workouts already on the server, clobbering them on that
    // second device's next push. Bumping the key's own last-known meta value
    // by +1 instead only beats a stale, equal-timestamp old-id server
    // snapshot (the actual goal), while still losing the normal LWW compare
    // in sync.js's applyMerged() (~line 294) to any remote write that is
    // genuinely newer than what this device last knew.
    //
    // Review fix (PR#48 MED): when a key has NO usable prior meta at all
    // (e.g. a male user whose gym_checks/gym_weights history predates
    // sync.js and never signed in), base was 0 and this used to write
    // meta[k]=1 (1970-01-01T00:00:00.001Z) — an artificially ancient
    // timestamp. sync.js's buildEntries() would otherwise backfill a
    // missing meta record to "now" so untouched local-only data wins on
    // first sign-in; stamping 1 instead defeats that backfill and lets any
    // pre-existing server copy for that key silently win, overwriting the
    // user's local-only history. Skip the bump entirely when there's no
    // usable prior meta and leave the key unset — buildEntries() (sync.js
    // ~line 252) backfills it to "now" itself.
    var syncKeys = Object.keys(touched).filter(function(k){ return k.indexOf("gym_") === 0 && k !== "gym_meta_updatedAt"; });
    if (syncKeys.length) {
      try {
        var meta = JSON.parse(localStorage.getItem("gym_meta_updatedAt")) || {};
        var metaChanged = false;
        syncKeys.forEach(function(k){
          var prior = meta[k];
          var hasUsablePrior = typeof prior === "number" && isFinite(prior) && prior > 0;
          if (!hasUsablePrior) return; // no prior record — let buildEntries() backfill to "now"
          meta[k] = prior + 1;
          metaChanged = true;
        });
        if (metaChanged) localStorage.setItem("gym_meta_updatedAt", JSON.stringify(meta));
      } catch(e){}
    }

    return weightsChanged || sessionsChanged || checksChanged || sessionActiveChanged || syncKeys.length > 0;
  } catch(e) {
    // A bad/unexpected blob must never break boot — leave data exactly as
    // found and let normal fallbacks (e.g. "day id not in DAYS -> DAYS[0]")
    // handle it, same as before this migration existed.
    try { if (window.console) console.error("[migrateMaleIdsV2] skipped:", e); } catch(e2){}
    return false;
  }
};
window.GymMigrations.maleV2();

// ---------------- DATA-DRIVEN MIGRATION: 4-day split (2026-10-14) ----------------
// Upper/Lower A+B became Upper, Lower, Back + Biceps + Calves, Chest + Triceps.
// Exercise ids were kept wherever the move still exists, so gym_weights needs
// no rewrite; old day ids still resolve through LEGACY_MALE_DAYS, so past
// gym_checks / gym_sessions / server records stay readable. What does need
// moving is state that points at the *current* day by id:
//   - the remembered tab, the pending-rotation marker, the in-progress session
//     (positional: Upper A->Upper, Lower A->Lower, Upper B->3rd day, Lower B->4th,
//     so a user mid-cycle lands on the same step of the rotation);
//   - today's checked exercises, re-filed under whichever new day now holds each
//     exercise id, so a half-finished workout keeps its ticks;
//   - Upper A / Lower A session timings, merged onto Upper / Lower (the
//     "last time" hint).
// Idempotent and re-run after every sync pull (see sync.js), like maleV2.
window.GymMigrations.maleV3 = function migrateMaleSplitV3(){
  try {
    var DAY_MAP = { m_upperA: "m_upper", m_lowerA: "m_lower", m_upperB: "m_backbi", m_lowerB: "m_chesttri" };
    var EX_TO_DAY = {};
    DAYS_MALE.forEach(function(d){ d.exercises.forEach(function(ex){ if(!EX_TO_DAY[ex.id]) EX_TO_DAY[ex.id] = d.id; }); });
    var touched = {};
    function readObj(key){
      try { var v = JSON.parse(localStorage.getItem(key)); return (v && typeof v === "object" && !Array.isArray(v)) ? v : {}; }
      catch(e){ return {}; }
    }
    function write(key, val){ localStorage.setItem(key, typeof val === "string" ? val : JSON.stringify(val)); touched[key] = true; }

    var activeKey = "gym_active_day_male_gym";
    var tab = localStorage.getItem(activeKey);
    if (tab && DAY_MAP[tab]) write(activeKey, DAY_MAP[tab]);

    var last = readObj("gymday_last_completed");
    if (last.dayId && DAY_MAP[last.dayId]) { last.dayId = DAY_MAP[last.dayId]; localStorage.setItem("gymday_last_completed", JSON.stringify(last)); }

    var live = readObj("gym_session_active");
    if (live.dayId && DAY_MAP[live.dayId]) { live.dayId = DAY_MAP[live.dayId]; localStorage.setItem("gym_session_active", JSON.stringify(live)); }

    var today = window.GymDate.key();
    var checks = readObj("gym_checks"), checksChanged = false;
    Object.keys(DAY_MAP).forEach(function(oldDay){
      var ticks = checks[today + "_" + oldDay];
      if (!ticks || typeof ticks !== "object" || Array.isArray(ticks)) return;
      Object.keys(ticks).forEach(function(exId){
        var newDay = EX_TO_DAY[exId];
        if (!newDay) return;
        var k = today + "_" + newDay;
        checks[k] = checks[k] || {};
        if (checks[k][exId] === undefined) { checks[k][exId] = ticks[exId]; checksChanged = true; }
      });
    });
    if (checksChanged) write("gym_checks", checks);

    var sessions = readObj("gym_sessions"), sessionsChanged = false;
    [["m_upperA", "m_upper"], ["m_lowerA", "m_lower"]].forEach(function(pair){
      var from = sessions[pair[0]];
      if (!Array.isArray(from) || !from.length) return;
      var to = sessions[pair[1]] = Array.isArray(sessions[pair[1]]) ? sessions[pair[1]] : [];
      var seen = {}; to.forEach(function(e){ if (e && e.date) seen[e.date] = true; });
      var added = false;
      from.forEach(function(e){ if (e && e.date && !seen[e.date]) { to.push(e); seen[e.date] = true; added = true; } });
      if (added) { to.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }); sessionsChanged = true; }
    });
    if (sessionsChanged) write("gym_sessions", sessions);

    // Sync-safe meta bump: +1 on a known timestamp only (same reasoning as maleV2).
    var syncKeys = Object.keys(touched);
    if (syncKeys.length) {
      var meta = readObj("gym_meta_updatedAt"), metaChanged = false;
      syncKeys.forEach(function(k){
        if (typeof meta[k] === "number" && isFinite(meta[k]) && meta[k] > 0) { meta[k] += 1; metaChanged = true; }
      });
      if (metaChanged) localStorage.setItem("gym_meta_updatedAt", JSON.stringify(meta));
    }
    return syncKeys.length > 0;
  } catch(e) {
    try { if (window.console) console.error("[migrateMaleSplitV3] skipped:", e); } catch(e2){}
    return false;
  }
};
window.GymMigrations.maleV3();

// ---------------- PLAN + STYLE + LANG STATE ----------------
let activePlan  = localStorage.getItem("gym_plan");                 // "male" | "female" | null (first run)
let activeStyle = localStorage.getItem("gym_style") || "gym";       // "gym" | "cal"
let activeLang  = localStorage.getItem("gym_lang")  || "en";        // "en" | "ar"

// Training split choice (gym_split, synced like the other prefs): days 0 = Classic (the plans
// below, untouched); 3-6 = the generated split from splits.js. where/tools are remembered
// either way. Nobody is moved: no pref means Classic.
function readSplit(){
  const s = loadJSON("gym_split", null) || {};
  const days = [3, 4, 5, 6].indexOf(+s.days) >= 0 ? +s.days : 0;
  const home = HOME_TOOL_KEYS;
  return { days, where: s.where === "home" ? "home" : "gym", tools: (Array.isArray(s.tools) ? s.tools : []).filter((k, i, a)=> home.indexOf(k) > 0 && a.indexOf(k) === i) };
}
const HOME_TOOL_KEYS = ["none", "dumbbell", "band", "bench", "table", "pullup_bar", "kettlebell", "jump_rope"];
let splitChoice = readSplit();
let splitCache = null; // { sig, plan } - the generated plan for the current choice + sex
function splitPlan(){
  if(!splitChoice.days || !window.GymSplits) return null;
  const sex = activePlan === "female" ? "female" : "male";
  const sig = [splitChoice.days, splitChoice.where, splitChoice.tools.join(), sex].join("|");
  if(!splitCache || splitCache.sig !== sig) splitCache = { sig, plan: GymSplits.buildPlan({ days: splitChoice.days, where: splitChoice.where, sex, tools: splitChoice.tools }) };
  return splitCache.plan;
}

// Theme (auto | light | dark) is a separate axis from the plan persona; both
// pick the palette in styles.css. theme-boot.js (loaded in <head>) resolves
// gym_theme before first paint, follows the OS in auto mode and owns the
// theme-color meta; this only re-applies it when the persona changes.
function applyTheme(){
  if(window.GymTheme) window.GymTheme.apply(activePlan);
}
function renderThemePrefs(){
  const b = document.getElementById("themeBtn");
  if(!b) return;
  const dark = document.documentElement.dataset.theme !== "light";
  b.setAttribute("aria-label", t(dark ? "themeToLight" : "themeToDark"));
  const lb = document.getElementById("langBtn");
  lb.textContent = t("langBtn");
  lb.lang = activeLang === "ar" ? "en" : "ar";
}

// Anonymous = chose "continue without an account" and not currently signed in.
function isAnonMode(){
  try {
    if(localStorage.getItem("gym_anon") !== "1") return false;
    return !(window.GymSync && typeof window.GymSync.isSignedIn === "function" && window.GymSync.isSignedIn());
  } catch(e){ return false; }
}
function pickDays(){
  if(isAnonMode()) return DAYS_PREVIEW;
  if(activeStyle === "coach"){
    const c = loadJSON("gym_plans_custom", null);
    if(c && c.length) return c;
  }
  const sp = activeStyle === "gym" ? splitPlan() : null;
  if(sp) return sp.days;
  const fem = activePlan === "female";
  if(activeStyle === "cal") return fem ? DAYS_FEMALE_CAL : DAYS_MALE_CAL;
  return fem ? DAYS_FEMALE : DAYS_MALE;
}
let DAYS = pickDays();

// Read-only accessor for calendar.js — DAYS is otherwise module-private, and
// the calendar needs a day's exercise list to compute done===total locally.
window.GymApp = window.GymApp || {};
// Read-only views for the muscle-art specs (and the Plan tab's tile/close-up code).
window.GymApp.muscleShapes = MUSCLE_SHAPES;
window.GymApp.allDaySets = function(){ return [DAYS_PREVIEW, DAYS_MALE, LEGACY_MALE_DAYS, DAYS_FEMALE, DAYS_MALE_CAL, DAYS_FEMALE_CAL, DAYS_EXTRA]; };
// A day by id: the active plan, the legacy plan, or - for a split day from an earlier choice this
// week (days/tools switched since) - rebuilt from its id, so its checks still count.
function findDay(dayId){
  const day = DAYS.find(d=>d.id===dayId) || LEGACY_MALE_DAYS.find(d=>d.id===dayId);
  if(day || !window.GymSplits) return day;
  const m = /^sp([3-6])([gh])([mf])_/.exec(dayId || "");
  if(!m) return undefined;
  const old = GymSplits.buildPlan({ days: +m[1], where: m[2] === "h" ? "home" : "gym", sex: m[3] === "f" ? "female" : "male", tools: splitChoice.tools });
  return old.days.find(d=>d.id===dayId);
}
window.GymApp.dayExercises = function(dayId){
  const day = findDay(dayId);
  return day ? day.exercises : [];
};
// Marks every exercise of a past day's checklist as done (rest-days.js "save
// yesterday"). Goes through the in-memory `checks` so the next toggle's
// saveJSON doesn't overwrite it with a stale copy.
window.GymApp.markDayComplete = function(date, dayId){
  const day = findDay(dayId);
  if(!day) return;
  const k = date + "_" + dayId;
  checks[k] = checks[k] || {};
  day.exercises.forEach(ex=>{ checks[k][ex.id] = true; });
  saveJSON("gym_checks", checks);
  rememberTags(k, day.exercises);
  refreshWeekMap();
};
// Strings and language for the weekly muscle map (muscle-map.js), and the tags of
// one exercise of a day in any plan we can still see (Classic, either persona,
// the AI plan). null when the plan that had it is gone: the map then falls back
// to the copy it stored when the exercise was ticked.
window.GymApp.t = t;
window.GymApp.lang = ()=> activeLang;
window.GymApp.exerciseShapes = function(dayId, exId){
  const custom = loadJSON("gym_plans_custom", null);
  const sets = window.GymApp.allDaySets().concat([DAYS], Array.isArray(custom) ? [custom] : []);
  for(const set of sets){
    const day = set.find(d=>d.id === dayId);
    const ex = day && (day.exercises || []).find(e=>e.id === exId);
    if(ex) return exShapes(ex);
  }
  return null;
};
// Localised day label for dayId (used by the save-yesterday sheet).
window.GymApp.dayName = function(dayId){
  const day = findDay(dayId);
  return day ? dayLabel(day) : "";
};

function t(key){ const e = T[key]; return e ? (e[activeLang === "ar" ? 1 : 0]) : key; }
function exName(ex){ return activeLang === "ar" ? (AR_EX[ex.en] || ex.en) : ex.en; }
function dayLabel(d){ return activeLang === "ar" ? (d.labelAr || AR_DAY[d.label] || d.label) : d.label; }
function musLabel(d){ return activeLang === "ar" ? (d.musclesAr || AR_MUS[d.muscles] || d.muscles) : d.muscles; }
function notesKey(){ return (activePlan === "female" ? "female" : "male") + "_" + (activeStyle === "cal" ? "cal" : "gym"); }
function activeDayStoreKey(){ return "gym_active_day_" + (activePlan || "male") + "_" + activeStyle; }

// ---------------- STATE ----------------
// Local calendar day, recomputed on every use so it survives midnight (see GymDate in ui.js).
function todayStr(){ return window.GymDate.key(); }
let activeDay = localStorage.getItem(activeDayStoreKey()) || DAYS[0].id;
if(!DAYS.some(d=>d.id===activeDay)) activeDay = DAYS[0].id;

// Auto-advance to the next day in rotation the day after a day was marked
// fully complete (gym-style plans only — DAYS_PREVIEW and AI-coach custom
// plans don't have a meaningful rotation to step through). This overrides
// the normal last-selected-tab restore for exactly this one load; manual
// tab taps still work exactly as before and simply override the suggestion.
// "gymday_last_completed" is deliberately NOT gym_-prefixed (see sync.js's
// LOCAL_ONLY convention / gymauth_session, gymcoach_form, gymchat_history)
// so it stays device-local and is never round-tripped through sync.
(function applyDayRotation(){
  const rotatable = (splitCache && DAYS === splitCache.plan.days) || DAYS === DAYS_MALE || DAYS === DAYS_FEMALE || DAYS === DAYS_MALE_CAL || DAYS === DAYS_FEMALE_CAL;
  if(!rotatable) return;
  const last = loadJSON("gymday_last_completed", null);
  if(!last || !last.dayId || last.date === todayStr()) return; // nothing to do, or completed today (not "the day after" yet)
  const idx = DAYS.findIndex(d=>d.id===last.dayId);
  if(idx === -1) return; // that day isn't part of the currently active plan
  activeDay = DAYS[(idx + 1) % DAYS.length].id;
  setPref(activeDayStoreKey(), activeDay);
  localStorage.removeItem("gymday_last_completed");
})();

// Index into WEEK_MALE while a rest slot is open on the Plan screen, else null.
// View-only: never persisted, activeDay keeps pointing at the last training day.
let restSlot = null;
// The 7-slot week for the men's gym plan; null for every other plan.
function weekSlots(){ return DAYS === DAYS_MALE ? WEEK_MALE : null; }

let openVideoId = null; // which exercise currently has an inline player mounted
const motionReduced = () => !!(window.GymMotion && GymMotion.reduced());
let animateCards = true; // replay the card entrance only on a real context change (day/plan/language)

function loadJSON(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch(e){ return fallback; }
}
function saveJSON(key, val){
  localStorage.setItem(key, JSON.stringify(val));
  notifySync(key);
}
// setPref writes a plain (already-string) gym_* value and notifies the sync layer.
function setPref(key, val){
  localStorage.setItem(key, val);
  notifySync(key);
}
// notifySync tells the optional offline-first sync layer (sync.js) that a
// gym_* key changed. No-op when sync.js is not loaded (GitHub Pages / file://).
function notifySync(key){
  if (key && key.indexOf("gym_") === 0 && key !== "gym_meta_updatedAt" &&
      window.GymSync && typeof window.GymSync.onLocalWrite === "function") {
    window.GymSync.onLocalWrite(key);
  }
}

let checks = loadJSON("gym_checks", {});
// Per-set ticks, keyed like gym_checks ("YYYY-MM-DD_dayId"): { exId: [bool, ...] }.
// Only today's keys are kept, so the sets start empty again on a new day.
let setChecks = loadJSON("gym_setchecks", {});
function saveSetChecks(){
  const today = todayStr() + "_";
  Object.keys(setChecks).forEach(k=>{ if(k.indexOf(today) !== 0) delete setChecks[k]; });
  saveJSON("gym_setchecks", setChecks);
}
function setCount(ex){ return Math.min(10, Math.max(1, parseInt(ex.sets, 10) || 1)); }
// Stored ticks, or all/none when the exercise was marked done another way
// (the big checkbox, "save yesterday") and has no per-set record.
function setState(key, ex, done){
  const n = setCount(ex), saved = (setChecks[key] || {})[ex.id];
  return Array.from({length:n}, (_, i)=> Array.isArray(saved) ? !!saved[i] : done);
}
function setLabel(ex, n){
  const reps = String(ex.reps == null ? "" : ex.reps).trim();
  const m = /^(\d+(?:\s*[-–]\s*\d+)?)\s*(?:s|secs?|seconds?)\b/i.exec(reps);
  const tpl = m ? "setLblSec" : (/^\d+(?:\s*[-–]\s*\d+)?$/.test(reps) ? "setLblReps" : "setLblRaw");
  return t(tpl).replace("{n}", n).replace("{r}", m ? m[1] : reps); // spoken label only; the visible chip is just the set number
}
function hapticTick(){
  try {
    const h = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Haptics;
    if(h && typeof h.impact === "function") h.impact({ style:"LIGHT" });
  } catch(e){}
}
let weights = loadJSON("gym_weights", {});
let sessions = loadJSON("gym_sessions", {});
let activeSession = loadJSON("gym_session_active", null);
// migrate the old { dayId, startTime } shape to the pausable model
if(activeSession && activeSession.segStart === undefined){
  const t0 = activeSession.startTime || Date.now();
  activeSession = { dayId: activeSession.dayId, startedAt: t0, running: true, accumSec: 0, segStart: t0 };
  saveJSON("gym_session_active", activeSession);
}

function sessionKey(dayId){ return todayStr() + "_" + dayId; }

// ---------------- RENDER ----------------
const exList = document.getElementById("exList");
const dayMuscles = document.getElementById("dayMuscles");
const dayMuscleTiles = document.getElementById("dayMuscleTiles");
const progressPill = document.getElementById("progressPill");
const barFill = document.getElementById("barFill");
const todayLabel = document.getElementById("todayLabel");

function renderDate(){
  const loc = activeLang === "ar" ? "ar-EG" : "en-US";
  todayLabel.textContent = new Date().toLocaleDateString(loc, { weekday:"long", day:"numeric", month:"long" });
}

function lastLog(exId){
  const arr = weights[exId];
  if(!arr || !arr.length) return null;
  return arr[arr.length-1];
}

function ytEmbedSrc(vid, autoplay){
  return `https://www.youtube-nocookie.com/embed/${vid}?rel=0&modestbranding=1&playsinline=1${autoplay ? '&autoplay=1' : ''}`;
}

const IC_SAVE = '<svg viewBox="0 0 24 24"><path d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>';
const IC_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
const IC_PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
function saveBtnInner(){ return IC_SAVE + " " + t("save"); }
function videoBtnInner(open){ return IC_PLAY + " " + (open ? t("hideVideo") : t("video")); }
function videoFrameInner(ex){
  return `<iframe src="${GymUI.esc(ytEmbedSrc(ex.vid,false))}" allow="accelerometer; encrypted-media; fullscreen; gyroscope; picture-in-picture" allowfullscreen></iframe>
          <button class="expand-btn" data-expand="${GymUI.esc(ex.id)}" aria-label="Fullscreen">
            <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z"/></svg>
          </button>`;
}
// Wires one expand (fullscreen) button. Must be called every time an
// .expand-btn is actually added to the DOM — it's created lazily inside
// videoFrameInner() (only once a video is toggled open), not up front with
// the rest of the exercise card, so the one-time querySelectorAll() wiring
// pass in renderExercises() misses it on a fresh open.
function wireExpandBtn(btn, ex){
  if(!btn || !ex) return;
  btn.onclick = (e)=>{
    e.stopPropagation();
    const frame = document.getElementById("vframe-" + ex.id);
    if(frame && frame.requestFullscreen){
      frame.requestFullscreen().catch(()=> openVideoModal(ex));
    } else if(frame && frame.webkitRequestFullscreen){
      frame.webkitRequestFullscreen();
    } else {
      openVideoModal(ex);
    }
  };
}
// tear an inline player down without rebuilding the list
function closeInlineVideo(id){
  const wrap  = document.getElementById("vwrap-" + id);
  const frame = document.getElementById("vframe-" + id);
  if(wrap)  GymMotion.collapse(wrap, ()=>wrap.classList.remove("open"));
  if(frame) frame.innerHTML = "";
  const btn = document.querySelector(`[data-video="${id}"]`);
  if(btn){ btn.classList.remove("on"); btn.innerHTML = videoBtnInner(false); }
}

function renderRestPanel(){
  const week = weekSlots();
  const n = restSlot + 1;
  let nextDay = null;
  for(let i = 1; i <= week.length && !nextDay; i++) nextDay = DAYS.find(d=>d.id === week[(restSlot + i) % week.length]);
  document.body.classList.add("rest-view");
  dayMuscles.textContent = t("restBadge");
  renderMuscleTiles(null);
  exList.innerHTML = "";
  const panel = document.createElement("section");
  panel.className = "rest-panel" + (animateCards && !motionReduced() ? " anim-in" : "");
  panel.setAttribute("aria-labelledby", "restPanelTitle");
  panel.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.7 14.4A8.5 8.5 0 0 1 9.6 3.3a.75.75 0 0 0-1-.9A10 10 0 1 0 21.6 15.4a.75.75 0 0 0-.9-1z"/></svg>' +
    '<h3 id="restPanelTitle"></h3><p class="rest-panel-body"></p><p class="rest-panel-next"></p>';
  panel.querySelector("h3").textContent = t("restBadge");
  panel.querySelector(".rest-panel-body").textContent = t("restPanelBody").replace("{n}", n);
  panel.querySelector(".rest-panel-next").textContent = nextDay ? t("restPanelNext").replace("{day}", dayLabel(nextDay)) : "";
  const act = window.GymRest && GymRest.actionButton ? GymRest.actionButton(todayStr(), null) : null;
  if(act) panel.appendChild(act);
  exList.appendChild(panel);
}

// ---- muscle pictures (muscle-art.js) ----
const SHAPE_BY_ID = {};
MUSCLE_SHAPES.forEach(s=>{ SHAPE_BY_ID[s.id] = s; });
// The anonymous preview always uses the male figure; signed-in plans follow the persona.
function figureSex(){ return !isAnonMode() && activePlan === "female" ? "female" : "male"; }
// {shape, shape2} for an exercise, or null when it has no known tag (no picture then).
function exShapes(ex){
  const id = v => String(v || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const s1 = id(ex.shape), s2 = id(ex.shape2);
  const known = v => !!(v && SHAPE_BY_ID[v]);
  if(known(s1)) return { shape: s1, shape2: known(s2) && s2 !== s1 ? s2 : "" };
  // Plans saved before tags existed: exact/alias name match, else no picture.
  const g = window.GymExerciseShape ? GymExerciseShape(ex.en) : null;
  return g ? { shape: g.shape, shape2: g.shape2 || "" } : null;
}
// Both heads of a two-part muscle (biceps, triceps) read as the muscle's own name.
function bothHeads(sh){
  const a = SHAPE_BY_ID[sh.shape], b = sh.shape2 && SHAPE_BY_ID[sh.shape2];
  return !!b && a.group === b.group && MUSCLE_SHAPES.filter(s=>s.group === a.group).length === 2;
}
function shapeText(sh){
  const name = id => activeLang === "ar" ? SHAPE_BY_ID[id].labelAr : SHAPE_BY_ID[id].label;
  if(bothHeads(sh)) return activeLang === "ar" ? SHAPE_BY_ID[sh.shape].groupAr : SHAPE_BY_ID[sh.shape].group;
  return name(sh.shape) + (sh.shape2 ? " \u00b7 " + name(sh.shape2) : "");
}
// Close-up picture + label chip for one exercise ("" + "" when untagged).
// settleIdx >= 0 plays the one-time settle entrance, staggered by that index.
function muscleBits(ex, settleIdx){
  const sh = window.GymMuscleArt ? exShapes(ex) : null;
  const svg = sh ? GymMuscleArt.closeup(sh.shape, { sex: figureSex(), secondary: sh.shape2 || undefined }) : "";
  if(!svg) return { pic:"", chip:"" };
  const text = GymUI.esc(shapeText(sh));
  const view = `<span class="ex-mus-view" aria-hidden="true">${t(GymMuscleArt.viewOf(sh.shape) === "back" ? "viewBack" : "viewFront")}</span>`;
  const settle = settleIdx >= 0 ? ` mus-settle" style="--i:${settleIdx}` : "";
  return { pic:`<span class="ex-mus${settle}" role="img" aria-label="${text}">${svg}${view}</span>`, chip:`<span class="ex-mus-chip">${text}</span>` };
}

// One tile per muscle group the day trains (catalog order); none for a rest day
// or a day whose exercises carry no known tag.
function renderMuscleTiles(day){
  const used = {};
  if(day && window.GymMuscleArt) day.exercises.forEach(ex=>{
    const sh = exShapes(ex);
    if(sh){ used[SHAPE_BY_ID[sh.shape].group] = 1; if(sh.shape2) used[SHAPE_BY_ID[sh.shape2].group] = 1; }
  });
  const sex = figureSex(), seen = {};
  let html = "";
  MUSCLE_SHAPES.forEach(s=>{
    if(!used[s.group] || seen[s.group]) return;
    seen[s.group] = 1;
    html += `<div class="mus-tile" data-group="${GymUI.esc(s.group)}">${GymMuscleArt.group(s.group, { sex })}<span>${GymUI.esc(activeLang === "ar" ? s.groupAr : s.group)}</span></div>`;
  });
  dayMuscleTiles.innerHTML = html;
  dayMuscleTiles.hidden = !html;
  if(html && animateCards && window.GymMotion) GymMotion.enter(dayMuscleTiles);   // no-op under reduced motion
}

// ---- weekly muscle map (muscle-map.js) ----
// Keep each ticked exercise's tags with the session, so a later plan switch can't orphan the tick.
function rememberTags(sessionKey, exercises){
  if(!window.GymMuscleMap) return;
  GymMuscleMap.remember(sessionKey, exercises.map(ex=>{ const sh = exShapes(ex); return sh && { id:ex.id, shape:sh.shape, shape2:sh.shape2 }; }).filter(Boolean));
}
function refreshWeekMap(){
  const host = document.getElementById("weekMap");
  if(host && window.GymMuscleMap) GymMuscleMap.render(host, { sex: figureSex() });
}

function renderExercises(){
  if(restSlot !== null && weekSlots()){ renderRestPanel(); return; }
  document.body.classList.remove("rest-view");
  const day = DAYS.find(d=>d.id===activeDay);
  dayMuscles.textContent = dayLabel(day) + " — " + musLabel(day);
  renderMuscleTiles(day);
  const key = sessionKey(day.id);
  const dayChecks = checks[key] || {};

  exList.innerHTML = "";
  const play = animateCards && !motionReduced(); // entrance only on a real context change, never under reduced motion
  day.exercises.forEach((ex, i)=>{
    const done = !!dayChecks[ex.id];
    const isOpen = openVideoId === ex.id;
    const card = document.createElement("div");
    card.className = "ex-card" + (done ? " done" : "") + (play ? " anim-in" : "");
    if(play){
      card.style.setProperty("--ci", Math.min(i, 8));   // stagger capped so a long list never delays its tail
      // A CSS animation restarts whenever its screen is shown again (display:none > block), which
      // replayed the cards on every return to Plan: drop the class once it has played.
      card.addEventListener("animationend", (e)=>{ if(e.target === card) card.classList.remove("anim-in"); });
    }

    const last = lastLog(ex.id);
    const esc = GymUI.esc;
    const lastText = esc(last ? t("lastLog").replace("{w}", last.w).replace("{r}", last.r) : t("noLog"));
    const nm = esc(exName(ex));
    const eid = esc(ex.id);
    // Plans saved before a clip matched (or whose name now matches an alias) get it here; none = "coming soon".
    if(!ex.vid){ const v = window.GymExerciseVideo ? GymExerciseVideo(ex.en) : ""; if(v) ex.vid = v; }
    const hasVid = !!ex.vid;
    const tsec = timedSeconds(ex.reps); // >0: a hold/interval measured in seconds, not reps
    const mus = muscleBits(ex, play && i < 8 ? i : -1); // only the first screenful animates

    card.innerHTML = `
      <div class="ex-top">
        <div class="check ${done?'on':''}" data-id="${eid}">
          <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
        </div>
        ${mus.pic}
        <div class="ex-title">
          <div class="en">${nm}</div>
          ${mus.chip}
        </div>
      </div>
      <div class="ex-meta">
        <span><b>${esc(ex.sets)}</b> ${t("sets")}</span>
        <span><b>${esc(ex.reps)}</b> ${t(tsec ? "timeLbl" : "reps")}</span>
        <span><b>${esc(ex.rest)}s</b> ${t("rest")}</span>
      </div>
      ${toolsLine(ex)}
      <div class="set-row" role="group" aria-label="${t("setsGroup")}">
        ${setState(key, ex, done).map((on, si)=>`<button type="button" class="set-chk${on?' on':''}" role="checkbox" aria-label="${esc(setLabel(ex, si + 1))}" aria-checked="${on}" data-set-ex="${eid}" data-set="${si}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
          <span class="set-num" aria-hidden="true">${si + 1}</span>
        </button>`).join("")}
      </div>
      <div class="ex-actions">
        ${tsec ? `<button class="btn-sm ex-start" data-extimer="${eid}" data-sec="${tsec}" data-name="${nm}">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          ${t("exStart").replace("{n}", "<bdi>" + tsec + "</bdi>")}
        </button>` : ``}
        <div class="log-box">
          <span class="log-field">
            <input type="number" inputmode="decimal" placeholder="${esc(last?last.w:t('wtPH'))}" data-w="${eid}">
            <span class="unit">kg</span>
          </span>
          <span class="log-field">
            <input type="number" inputmode="numeric" placeholder="${esc(last?last.r:t(tsec ? 'secPH' : 'repPH'))}" data-r="${eid}">
            <span class="unit">${t(tsec ? 'secUnit' : 'reps')}</span>
          </span>
        </div>
        <button class="btn-sm" data-save="${eid}">
          <svg viewBox="0 0 24 24"><path d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
          ${t("save")}
        </button>
        <button class="btn-sm rest" data-rest="${esc(ex.rest)}" data-name="${nm}">
          <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 11H8v-2h3V7h2z"/></svg>
          ${t("restBtn")}
        </button>
        ${hasVid ? `<button class="btn-sm video-toggle ${isOpen?'on':''}" data-video="${eid}">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          ${isOpen ? t('hideVideo') : t('video')}
        </button>` : `<span class="btn-sm video-soon" role="note" aria-disabled="true" aria-label="${esc(t("videoSoon"))}">${t("videoSoon")}</span>`}
      </div>
      ${hasVid ? `<div class="video-wrap ${isOpen?'open':''}" id="vwrap-${eid}">
        <div class="video-frame" id="vframe-${eid}">
          ${isOpen ? videoFrameInner(ex) : ''}
        </div>
      </div>` : ``}
      <div class="lastlog">${lastText}</div>
    `;
    exList.appendChild(card);
  });
  if(play) setTimeout(()=>exList.querySelectorAll(".mus-settle").forEach(e=>e.classList.remove("mus-settle")), 1200);
  animateCards = false;

  // --- checkbox: flip just this card, no list rebuild ---
  // Single path for "exercise done" so the big checkbox and the last set tick
  // share the same progress / streak / calendar side effects.
  function setExDone(id, on){
    const k = sessionKey(activeDay);
    const wasComplete = isDayComplete(activeDay);
    checks[k] = checks[k] || {};
    checks[k][id] = on;
    saveJSON("gym_checks", checks);
    if(on) rememberTags(k, (DAYS.find(d=>d.id === activeDay) || { exercises:[] }).exercises.filter(e=>e.id === id));
    refreshWeekMap();
    const el = exList.querySelector(`.check[data-id="${id}"]`);
    if(el){
      const was = el.classList.contains("on");
      el.classList.toggle("on", on);
      if(on && !was && window.GymMotion) GymMotion.pop(el);
      const card = el.closest(".ex-card");
      if(card) card.classList.toggle("done", on);
    }
    updateProgress();
    // Record the moment this day's checklist *transitions* to complete
    // (not on every click once already complete) so applyDayRotation()
    // can auto-select the next day in rotation on a later day's visit.
    if(!wasComplete && isDayComplete(activeDay)){
      saveJSON("gymday_last_completed", { date: todayStr(), dayId: activeDay });
      if(window.GymCelebrate) GymCelebrate.day(activeDay);
    }
    if(window.GymCalendar && typeof window.GymCalendar.onCheckChanged === "function"){
      window.GymCalendar.onCheckChanged(activeDay, todayStr());
    }
  }
  function paintSets(id, state){
    exList.querySelectorAll(`.set-chk[data-set-ex="${id}"]`).forEach((b, i)=>{
      b.classList.toggle("on", !!state[i]);
      b.setAttribute("aria-checked", String(!!state[i]));
    });
  }
  exList.querySelectorAll(".check").forEach(el=>{
    el.onclick = ()=>{
      const id = el.dataset.id;
      const k = sessionKey(activeDay);
      const on = !((checks[k] || {})[id]);
      const ex = day.exercises.find(x=>x.id===id);
      if(ex){
        const st = Array(setCount(ex)).fill(on);
        setChecks[k] = setChecks[k] || {};
        setChecks[k][id] = st;
        saveSetChecks();
        paintSets(id, st);
      }
      setExDone(id, on);
    };
  });

  // --- set checkboxes: all sets ticked = exercise done, untick one = not done ---
  exList.querySelectorAll(".set-chk").forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.setEx, i = +btn.dataset.set;
      const k = sessionKey(activeDay);
      const ex = day.exercises.find(x=>x.id===id);
      if(!ex) return;
      const st = setState(k, ex, !!(checks[k] || {})[id]);
      st[i] = !st[i];
      setChecks[k] = setChecks[k] || {};
      setChecks[k][id] = st;
      saveSetChecks();
      paintSets(id, st);
      if(st[i]){ hapticTick(); if(window.GymMotion) GymMotion.pop(btn); }
      if(st[i]){
        // same value the card's Rest button uses; restarts a running timer
        const restBtn = btn.closest(".ex-card").querySelector("[data-rest]");
        const rest = restBtn ? parseInt(restBtn.dataset.rest) : 0;
        if(rest > 0) startRestTimer(rest, restBtn.dataset.name);
      }
      const all = st.every(Boolean);
      if(all !== !!(checks[k] || {})[id]) setExDone(id, all);
    };
  });

  // --- save weight: update this card in place, no list rebuild ---
  exList.querySelectorAll("[data-save]").forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.save;
      const wInput = exList.querySelector(`[data-w="${id}"]`);
      const rInput = exList.querySelector(`[data-r="${id}"]`);
      const r = rInput.value || rInput.placeholder;
      const timed = timedSeconds((day.exercises.find(x=>x.id===id)||{}).reps) > 0;
      // holds are mostly bodyweight: no weight typed or remembered saves as 0 kg
      const w = wInput.value || (wInput.placeholder === t("wtPH") && timed ? "0" : wInput.placeholder);
      if(!w || w===t("wtPH")) return;
      weights[id] = weights[id] || [];
      const todayEntryIdx = weights[id].findIndex(e=>e.date===todayStr());
      const entry = { date: todayStr(), w, r };
      if(todayEntryIdx >= 0) weights[id][todayEntryIdx] = entry;
      else weights[id].push(entry);
      saveJSON("gym_weights", weights);
      btn.innerHTML = t("saved");
      const card = btn.closest(".ex-card");
      if(card){
        const ll = card.querySelector(".lastlog");
        if(ll) ll.textContent = t("lastLog").replace("{w}", w).replace("{r}", r);
      }
      wInput.value = ""; rInput.value = "";
      wInput.placeholder = w; rInput.placeholder = r;
      setTimeout(()=>{ btn.innerHTML = saveBtnInner(); }, 900);
    };
  });

  exList.querySelectorAll("[data-rest]").forEach(btn=>{
    btn.onclick = ()=> startRestTimer(parseInt(btn.dataset.rest), btn.dataset.name);
  });
  exList.querySelectorAll("[data-extimer]").forEach(btn=>{
    btn.onclick = ()=> startExerciseTimer(btn.dataset.extimer, parseInt(btn.dataset.sec), btn.dataset.name);
  });

  // --- video toggle: mount / unmount just this player ---
  exList.querySelectorAll("[data-video]").forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.video;
      const willOpen = openVideoId !== id;
      if(openVideoId && openVideoId !== id) closeInlineVideo(openVideoId);
      if(willOpen){
        openVideoId = id;
        const ex = day.exercises.find(x=>x.id===id);
        const wrap  = document.getElementById("vwrap-" + id);
        const frame = document.getElementById("vframe-" + id);
        frame.innerHTML = videoFrameInner(ex);
        GymMotion.expand(wrap, ()=>wrap.classList.add("open"));
        btn.classList.add("on");
        btn.innerHTML = videoBtnInner(true);
        wireExpandBtn(frame.querySelector("[data-expand]"), ex);
      } else {
        closeInlineVideo(id);
        openVideoId = null;
      }
    };
  });

  // --- expand: real fullscreen on the existing player; overlay fallback ---
  // (only reaches an [data-expand] button here when the card was rendered
  // with its video already open, e.g. after a day-tab switch — a *fresh*
  // open is wired directly in the data-video handler above instead, since
  // this pass runs once, before that button exists in the DOM.)
  exList.querySelectorAll("[data-expand]").forEach(btn=>{
    const ex = day.exercises.find(x=>x.id===btn.dataset.expand);
    wireExpandBtn(btn, ex);
  });
}

function renderNotes(){
  const list = document.getElementById("notesList");
  const arr = (NOTES[notesKey()] || NOTES.male_gym)[activeLang === "ar" ? "ar" : "en"];
  list.innerHTML = arr.map(li=>`<li>${li}</li>`).join("");
}

// Shared done/total computation for a day's checklist, reused by
// updateProgress() (active day's progress pill/bar) and isDayComplete()
// (blocking timer start / driving day-rotation) so the two never drift.
function dayProgress(dayId){
  const day = DAYS.find(d=>d.id===dayId);
  if(!day) return { done:0, total:0 };
  const dayChecks = checks[sessionKey(dayId)] || {};
  const total = day.exercises.length;
  const done = day.exercises.filter(ex=>dayChecks[ex.id]).length;
  return { done, total };
}
function isDayComplete(dayId){
  const { done, total } = dayProgress(dayId);
  return total>0 && done===total;
}
function updateProgress(){
  const { done, total } = dayProgress(activeDay);
  progressPill.textContent = `${done}/${total}`;
  const wasDone = progressPill.classList.contains("done");
  progressPill.classList.toggle("done", done===total && total>0);
  if(!wasDone && done===total && total>0 && window.GymMotion) GymMotion.pop(progressPill);
  barFill.style.setProperty("--p", total ? done/total : 0);
}

function renderAll(){
  renderTitle();
  renderDate();
  renderDayTabs();
  renderExercises();
  refreshWeekMap();
  updateProgress();
  updateSessionUI();
  renderNotes();
  applyAnonUI();
  renderSplitPanel();
}

// Lock everything except the single preview day for signed-out users.
function applyAnonUI(){
  const anon = isAnonMode();
  document.body.classList.toggle("anon-mode", anon);

  const dayTabs = document.getElementById("dayTabs");
  if(dayTabs) dayTabs.style.display = anon ? "none" : "";

  document.querySelectorAll("[data-plan-btn],[data-style-btn]").forEach(b=>{
    b.classList.toggle("locked", anon);
  });

  const notes = document.getElementById("notesBox");
  if(notes) notes.hidden = anon;

  let lock = document.getElementById("anonLock");
  if(anon){
    if(!lock){
      lock = document.createElement("div");
      lock.id = "anonLock";
      lock.className = "anon-lock";
      const ex = document.getElementById("exList");
      ex.parentNode.insertBefore(lock, ex.nextSibling);
    }
    lock.innerHTML =
      '<div class="lock-ico" aria-hidden="true">&#128274;</div>' +
      '<h3></h3><p></p>' +
      '<button class="anon-lock-btn"></button>';
    lock.querySelector("h3").textContent = t("anonLockTitle");
    lock.querySelector("p").textContent = t("anonLockBody");
    const btn = lock.querySelector(".anon-lock-btn");
    btn.textContent = t("anonSignIn");
    btn.onclick = ()=>{ if(window.GymUI) window.GymUI.promptSignIn(); };
  } else if(lock){
    lock.remove();
  }
}

// Re-pick the day set and re-render after an auth/anon state change (ui.js).
window.GymAppRebuild = function(){
  splitChoice = readSplit();
  DAYS = pickDays();
  restSlot = null;
  activeDay = localStorage.getItem(activeDayStoreKey()) || DAYS[0].id;
  if(!DAYS.some(d=>d.id===activeDay)) activeDay = DAYS[0].id;
  animateCards = true;
  renderAll();
};
// Taking or undoing a rest day swaps the button inside an open rest panel.
document.addEventListener("gym:restchange", ()=>{ if(restSlot !== null && weekSlots()) renderExercises(); });

// P1-8: no more blocking native confirm() — reset happens immediately, with
// an "Undo" toast (shared .gym-toast component, toast.js) instead of asking
// first. The data at risk is same-day checklist state, not history, so
// undo-after-the-fact is the right friction level (matches §4.6).
document.getElementById("resetLink").onclick = ()=>{
  const dayKey = sessionKey(activeDay);
  const prevChecks = checks[dayKey];
  const prevSets = setChecks[dayKey];
  if(prevChecks === undefined && prevSets === undefined) return; // nothing to reset
  delete checks[dayKey];
  delete setChecks[dayKey];
  saveJSON("gym_checks", checks);
  saveSetChecks();
  animateCards = true;
  renderAll();
  if(window.GymToast && typeof window.GymToast.show === "function"){
    window.GymToast.show({
      message: t("resetToastMsg"),
      actionLabel: t("undo"),
      onAction: ()=>{
        // Merge, don't replace: any exercise the user re-checked during the
        // undo window (checks[dayKey] was rebuilt fresh after the delete
        // above) would otherwise be silently clobbered by the stale
        // pre-reset snapshot. Post-reset entries win per-exercise since
        // they're the more recent user action.
        checks[dayKey] = Object.assign({}, prevChecks, checks[dayKey]);
        saveJSON("gym_checks", checks);
        if(prevSets) setChecks[dayKey] = Object.assign({}, prevSets, setChecks[dayKey]);
        saveSetChecks();
        animateCards = true;
        renderAll();
      }
    });
  }
};

// ---------------- EXPANDED VIDEO MODAL (stays on page) ----------------
const videoModal = document.getElementById("videoModal");
const modalFrame = document.getElementById("modalFrame");
const modalTitle = document.getElementById("modalTitle");

function openVideoModal(ex){
  // never leave a second player running underneath
  if(openVideoId){ closeInlineVideo(openVideoId); openVideoId = null; }
  modalTitle.textContent = exName(ex);
  modalFrame.innerHTML = `<iframe src="${GymUI.esc(ytEmbedSrc(ex.vid,true))}" allow="accelerometer; autoplay; encrypted-media; fullscreen; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  videoModal.classList.add("show");   // .show only hides the top bar (styles.css); GymMotion drives the visibility
  GymMotion.show(videoModal);
}
function closeVideoModal(){
  modalFrame.innerHTML = ""; // stop playback
  videoModal.classList.remove("show");
  GymMotion.hide(videoModal);
}
document.getElementById("modalClose").onclick = closeVideoModal;
videoModal.addEventListener("click", (e)=>{ if(e.target === videoModal) closeVideoModal(); });

// ---------------- REST TIMER (between sets) ----------------
// Counts down to a wall-clock end time, not by ticks: phones freeze
// setInterval while the screen is off, so on return the time left is
// recomputed and a rest that ended meanwhile alerts straight away. While it
// runs the screen is kept awake (Wake Lock), and in the native app a local
// notification is scheduled for the end time so it sounds with the screen off.
// The exercise timer (holds measured in seconds) shares this engine and the
// same dock: only one of the two runs at a time, starting one replaces the
// other. Its 3-2-1 "ready" phase counts down first, then the hold itself.
let restInterval = null, restRaf = 0;
let restEndAt = 0, restTotal = 0, restName = "";
let timerKind = "rest"; // "rest" | "ex"
let exId = "", exPhase = "", exTarget = 0; // exPhase: "ready" | "hold" | "" (idle)
let notifScheduled = false;
const timerBar = document.getElementById("timerBar");
const timerTime = document.getElementById("timerTime");
const timerLabel = document.getElementById("timerLabel");
const timerFill = document.getElementById("timerFill");
const timerLive = document.getElementById("timerLive");
const reduceMotionMQ = { get matches(){ return window.GymMotion ? GymMotion.reduced() : window.matchMedia("(prefers-reduced-motion: reduce)").matches; } };
const timerAddBtn = document.getElementById("timerAdd");
const timerSkipBtn = document.getElementById("timerSkip");
const REST_ADD_SECONDS = 15, REST_ENDING_SECONDS = 5, EX_READY_SECONDS = 3;
// A seconds-based target ("30s", "45 sec", "30-45s", "1 min") -> its upper
// bound in seconds, else 0. The upper bound is the goal; Stop logs a shorter
// hold, and +15 s extends a longer one.
function timedSeconds(reps){
  const m = /^\s*(\d+)(?:\s*[-\u2013]\s*(\d+))?\s*(s|secs?|seconds?|mins?|minutes?)\b/i.exec(String(reps == null ? "" : reps));
  if(!m) return 0;
  return parseInt(m[2] || m[1], 10) * (/^m/i.test(m[3]) ? 60 : 1);
}
// where the alert should sound: the end of the hold, even during the ready count
function finalEndAt(){ return exPhase === "ready" ? restEndAt + exTarget*1000 : restEndAt; }
function resetDock(kind){
  timerKind = kind;
  stopAlarm();
  clearInterval(restInterval);
  notifScheduled = false;
  cancelRestNotification();
  unlockBeep(); // inside the tap, so the alert isn't blocked by autoplay rules
  holdScreenAwake(true);
  timerBar.classList.remove("done", "ending", "ready");
  timerBar.classList.toggle("ex", kind === "ex");
  timerSkipBtn.setAttribute("aria-label", t(kind === "ex" ? "exStop" : "skip"));
}

function startRestTimer(seconds, name){
  if (isDayComplete(activeDay)) { alert(t("dayAlreadyDone")); return; }
  resetDock("rest");
  exPhase = "";
  timerAddBtn.disabled = false;
  restTotal = seconds;
  restName = name;
  restEndAt = Date.now() + seconds*1000;
  scheduleRestNotification(restEndAt, name);
  const label = t("restTimer").replace("{name}", name);
  timerBar.setAttribute("aria-label", label);
  timerLabel.textContent = name;
  timerBar.classList.remove("done", "ending");
  timerBar.classList.add("show");
  renderRestTime(seconds, restTotal);
  timerLive.textContent = `${label}, ${timerTime.textContent}`;
  restInterval = setInterval(restTick, 250);
  startRestRing();
}
function startExerciseTimer(id, seconds, name){
  if (isDayComplete(activeDay)) { alert(t("dayAlreadyDone")); return; }
  resetDock("ex");
  exId = id; exTarget = seconds; exPhase = "ready";
  restName = name;
  restTotal = EX_READY_SECONDS;
  restEndAt = Date.now() + EX_READY_SECONDS*1000;
  timerAddBtn.disabled = true; // +15 s means more hold time: only once the hold runs
  scheduleRestNotification(finalEndAt(), name);
  const label = t("exTimer").replace("{name}", name);
  timerBar.setAttribute("aria-label", label);
  timerLabel.textContent = t("exReady");
  timerBar.classList.add("show", "ready");
  renderRestTime(EX_READY_SECONDS, restTotal);
  timerLive.textContent = `${label}, ${t("exReady")}`;
  restInterval = setInterval(restTick, 250);
  startRestRing();
}
let readyShown = 0;
function restTick(){
  if(!restEndAt) return;
  if(exPhase === "ready" && restEndAt <= Date.now()){
    // ready count done: the hold starts exactly where the count ended
    exPhase = "hold";
    restTotal = exTarget;
    restEndAt += exTarget*1000;
    timerAddBtn.disabled = false;
    timerBar.classList.remove("ready");
    timerLabel.textContent = restName;
    timerLive.textContent = t("exGo");
    blip(1175, 0.5);
  }
  const remaining = Math.max(0, Math.ceil((restEndAt - Date.now())/1000));
  renderRestTime(remaining, restTotal);
  if(exPhase === "ready" && remaining !== readyShown){ readyShown = remaining; blip(660, 0.22); }
  if(remaining === 10 && exPhase !== "ready") timerLive.textContent = t("restTenLeft");
  if(remaining <= 0){
    const kind = timerKind, endedAt = restEndAt, held = exTarget;
    timerLive.textContent = t(kind === "ex" ? "exOverLive" : "restOverLive");
    timerBar.classList.add("done"); // the ring fills and pops while the widget leaves
    stopRestTimer();
    const sub = kind === "ex" ? preciseStr("exOverBody").replace("{n}", held) : t("restOverBody").replace("{name}", restName);
    if(kind === "ex") fillExerciseSeconds(exId, held);
    // Back from a long screen-off: the native alert already rang, so don't ring a second time.
    if(notifScheduled && Date.now() - endedAt > ALARM_LATE_MS){
      notifScheduled = false;
      offerPreciseAlerts();
      return;
    }
    if(!document.hidden) cancelRestNotification(); // alerting in-app; no second ring
    notifScheduled = false;
    startAlarm(sub);
  }
}
function stopRestTimer(){
  clearInterval(restInterval);
  cancelAnimationFrame(restRaf);
  restEndAt = 0;
  exPhase = "";
  readyShown = 0;
  timerBar.classList.remove("show", "ending", "ready");
  holdScreenAwake(false);
}
// Puts the seconds held into the card's reps field so the set can be saved.
function fillExerciseSeconds(id, secs){
  const input = exList.querySelector(`[data-r="${CSS.escape(id)}"]`);
  if(!input) return;
  input.value = secs;
  const field = input.closest(".log-field");
  if(!field) return;
  field.classList.add("filled");
  setTimeout(()=> field.classList.remove("filled"), 2400);
}
// The ring sweeps smoothly: while the page is visible it is repainted every
// frame from the wall-clock end time. Reduced motion keeps the once-a-second
// steps from renderRestTime instead.
function paintRestRing(){
  if(!restEndAt) return;
  timerFill.style.setProperty("--p", Math.max(0, Math.min(1, (restEndAt - Date.now())/(restTotal*1000))));
}
function startRestRing(){
  cancelAnimationFrame(restRaf);
  if(reduceMotionMQ.matches || document.hidden || !restEndAt) return;
  const frame = ()=>{
    if(!restEndAt) return;
    paintRestRing();
    restRaf = requestAnimationFrame(frame);
  };
  restRaf = requestAnimationFrame(frame);
}
document.addEventListener("visibilitychange", ()=>{
  if(document.hidden || !restEndAt) return;
  restTick();
  if(restEndAt){
    holdScreenAwake(true); // the browser drops the wake lock when hidden
    startRestRing();
  }
});
function renderRestTime(remaining, total){
  const m = Math.max(0,Math.floor(remaining/60)).toString().padStart(2,"0");
  const s = Math.max(0,remaining%60).toString().padStart(2,"0");
  timerTime.textContent = exPhase === "ready" ? String(remaining) : `${m}:${s}`;
  timerBar.classList.toggle("ending", exPhase !== "ready" && remaining > 0 && remaining <= REST_ENDING_SECONDS);
  timerFill.style.setProperty("--p", Math.max(0, remaining/total));
}
timerAddBtn.onclick = ()=>{
  if(!restEndAt || exPhase === "ready") return;
  restEndAt += REST_ADD_SECONDS*1000;
  restTotal += REST_ADD_SECONDS;
  if(exPhase === "hold") exTarget += REST_ADD_SECONDS;
  scheduleRestNotification(restEndAt, restName);
  restTick();
  paintRestRing();
};
timerSkipBtn.onclick = ()=>{
  // stopping a hold early still logs what was held
  if(timerKind === "ex" && exPhase === "hold" && restEndAt){
    const held = Math.round(exTarget - (restEndAt - Date.now())/1000);
    if(held >= 1) fillExerciseSeconds(exId, held);
  }
  stopRestTimer();
  cancelRestNotification();
};

let beepCtx = null;
function unlockBeep(){
  try{
    if(!beepCtx) beepCtx = new (window.AudioContext||window.webkitAudioContext)();
    if(beepCtx.state === "suspended") beepCtx.resume();
  }catch(e){}
}
// One short tone: used for the 3-2-1 ticks and, in bursts, the alarm.
function tone(freq, at, dur, vol, type){
  const ctx = beepCtx;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || "sine";
  o.frequency.value = freq;
  o.connect(g); g.connect(ctx.destination);
  const t0 = ctx.currentTime + at;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.015); // no click on the edges
  g.gain.setValueAtTime(vol, t0 + dur - 0.04);
  g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  o.start(t0);
  o.stop(t0 + dur);
}
function blip(freq, dur){
  try{ unlockBeep(); tone(freq, 0, dur > 0.3 ? dur : 0.12, 0.2); }catch(e){}
}

// ---- alarm: rings after either timer ends, until Stop or 30 s ----
// A two-tone pattern, four pulses then a pause, with a matching vibration,
// repeated every ALARM_CYCLE_MS. Synthesised, so no audio file is shipped.
const ALARM_CYCLE_MS = 2200, ALARM_MAX_MS = 30000, ALARM_LATE_MS = 3000;
const alarmBanner = document.getElementById("alarmBanner");
const alarmSubEl = document.getElementById("alarmSub");
let alarmActive = false, alarmCycleTimer = 0, alarmStopTimer = 0;
function alarmCycle(){
  if(navigator.vibrate) navigator.vibrate([450,150,450,150,450,150,450]);
  try{
    unlockBeep();
    [0, 1, 0, 1].forEach((hi, k)=> tone(hi ? 1175 : 880, k*0.3, 0.2, 0.5, "triangle"));
  }catch(e){}
}
function startAlarm(sub){
  if(alarmActive) return; // already ringing: never a second alarm on top
  alarmActive = true;
  document.getElementById("alarmTitle").textContent = t("timeUp");
  alarmSubEl.textContent = sub;
  document.getElementById("alarmStop").textContent = t("alarmStop");
  alarmBanner.hidden = false;
  alarmCycle();
  alarmCycleTimer = setInterval(alarmCycle, ALARM_CYCLE_MS);
  alarmStopTimer = setTimeout(stopAlarm, ALARM_MAX_MS);
}
function stopAlarm(){
  if(!alarmActive) return;
  alarmActive = false;
  clearInterval(alarmCycleTimer);
  clearTimeout(alarmStopTimer);
  if(navigator.vibrate) navigator.vibrate(0);
  alarmBanner.hidden = true;
  offerPreciseAlerts();
}
alarmBanner.onclick = stopAlarm;
document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && alarmActive) stopAlarm(); });

let screenLock = null;
async function holdScreenAwake(on){
  try{
    if(!on){ if(screenLock){ const l = screenLock; screenLock = null; await l.release(); } return; }
    if(screenLock && !screenLock.released) return;
    if(!navigator.wakeLock || document.hidden) return;
    const lock = await navigator.wakeLock.request("screen");
    if(restEndAt) screenLock = lock;
    else lock.release(); // skipped or ended while the request was pending
  }catch(e){ screenLock = null; } // denied (battery saver, unsupported WebView): the end-time math still covers it
}

// Native app only (Capacitor LocalNotifications): one pending "rest is over"
// alert, replaced on every start and cancelled on skip.
const REST_NOTIF_ID = 4242;
function restNotifier(){
  const c = window.Capacitor;
  try{
    if(!c || typeof c.isNativePlatform !== "function" || !c.isNativePlatform()) return null;
  }catch(e){ return null; }
  return (c.Plugins && c.Plugins.LocalNotifications) || null;
}
// Android shell only (native/android TimerAlarmPlugin): an exact, insistent
// alarm (sound loops up to 30 s, "Stop" action) used instead of a plain
// LocalNotification when present (exact when the exact-alarm permission is
// granted, else inexact: see offerPreciseAlerts).
function timerAlarmPlugin(){
  const c = window.Capacitor;
  try{
    if(!c || typeof c.isNativePlatform !== "function" || !c.isNativePlatform()) return null;
  }catch(e){ return null; }
  const p = c.Plugins && c.Plugins.TimerAlarm;
  return p && typeof p.schedule === "function" ? p : null;
}
async function scheduleRestNotification(endAt, name){
  const ln = restNotifier();
  if(!ln) return;
  try{
    let perm = await ln.checkPermissions();
    if(perm.display !== "granted") perm = await ln.requestPermissions();
    if(perm.display !== "granted") return;
    // One loud channel for both timers. Channel settings are frozen once
    // created, so the alarm sound lives under its own id (res/raw/timer_alarm.wav).
    await ln.createChannel({ id:"timer-alarm", name:t("alarmChannel"), importance:5, vibration:true, visibility:1, sound:"timer_alarm.wav" });
    await ln.cancel({ notifications:[{ id:REST_NOTIF_ID }] });
    if(endAt !== finalEndAt()) return; // skipped or restarted while we were asking
    const ta = timerAlarmPlugin();
    if(ta){
      const exT = timerKind === "ex";
      await ta.schedule({
        id: REST_NOTIF_ID, at: endAt,
        title: t(exT ? "exOverTitle" : "restOverTitle"),
        body: exT ? name : t("restOverBody").replace("{name}", name),
        stopLabel: t("alarmStop")
      });
      if(endAt === finalEndAt()) notifScheduled = true;
      return;
    }
    // The plugin defaults to an exact alarm and, on Android 12+ without the
    // "Alarms & reminders" permission, opens that system Settings screen from
    // schedule() itself. Never do that mid-workout: ask for exact only when
    // it is already allowed, else schedule the inexact (still Doze-safe) alarm.
    let exact = false;
    try{ exact = (await ln.checkExactNotificationSetting()).exact_alarm === "granted"; }catch(e){}
    if(endAt !== finalEndAt()) return;
    const ex = timerKind === "ex";
    await ln.schedule({ notifications:[{
      id: REST_NOTIF_ID,
      title: t(ex ? "exOverTitle" : "restOverTitle"),
      body: ex ? name : t("restOverBody").replace("{name}", name),
      channelId: "timer-alarm",
      sound: "timer_alarm.wav", // Android 7 and older ignore the channel
      isExactNotification: exact,
      schedule: { at: new Date(endAt), allowWhileIdle: true }
    }] });
    if(endAt === finalEndAt()) notifScheduled = true;
  }catch(e){}
}
function cancelRestNotification(){
  const ta = timerAlarmPlugin();
  if(ta && typeof ta.cancel === "function") try{ Promise.resolve(ta.cancel({ id:REST_NOTIF_ID })).catch(()=>{}); }catch(e){}
  const ln = restNotifier();
  if(ln) ln.cancel({ notifications:[{ id:REST_NOTIF_ID }] }).catch(()=>{});
}

// One-time opt-in for exact rest alarms (Android 14+ leaves them off by
// default). Offered after a rest ends, never on launch. The system Settings
// screen opens ONLY from the Allow tap below; nothing else may call
// changeExactNotificationSetting.
const PRECISE_KEY = "etq_precise_alerts_v1";
let preciseSheet = null, preciseAwaitingSettings = false;
function preciseAnswered(){
  try{ return !!localStorage.getItem(PRECISE_KEY); }catch(e){ return true; } // no storage: can't remember, so never nag
}
function preciseRemember(answer){
  try{ localStorage.setItem(PRECISE_KEY, answer); }catch(e){}
}
// Major Android version. UA client hints carry the real one (the classic UA
// string is frozen to "Android 10" in current WebViews), so use them first.
async function androidMajor(){
  try{
    const uad = navigator.userAgentData;
    if(uad && uad.getHighEntropyValues){
      const v = await uad.getHighEntropyValues(["platformVersion"]);
      const n = parseInt(v.platformVersion, 10);
      if(n > 0) return n;
    }
  }catch(e){}
  const m = /Android (\d+)/.exec(navigator.userAgent || "");
  return m ? parseInt(m[1], 10) : 0;
}
function preciseStr(key){
  const f = activeLang === "ar" && document.documentElement.dataset.plan === "female" ? T[key + "F"] : null;
  return f ? f[1] : t(key);
}
async function offerPreciseAlerts(){
  if(preciseSheet || preciseAnswered()) return;
  const ln = restNotifier();
  if(!ln || typeof ln.checkExactNotificationSetting !== "function") return;
  try{
    const c = window.Capacitor;
    if(typeof c.getPlatform !== "function" || c.getPlatform() !== "android") return;
    if(await androidMajor() < 14) return; // Android 14 = API 34
    if((await ln.checkExactNotificationSetting()).exact_alarm === "granted") return;
  }catch(e){ return; }
  // Let the finished-rest pop settle, and don't pile onto another dialog.
  setTimeout(() => {
    if(preciseSheet || preciseAnswered() || document.hidden || restEndAt || alarmActive || document.querySelector(".syd")) return;
    openPreciseSheet(ln);
  }, 900);
}
function openPreciseSheet(ln){
  const opener = document.activeElement;
  const el = document.createElement("div");
  el.className = "syd m-ovl";
  el.id = "preciseSheet";
  el.innerHTML =
    '<div class="syd-backdrop"></div>' +
    '<div class="syd-panel m-ovl-card" role="dialog" aria-modal="true" aria-labelledby="preTitle" aria-describedby="preBody">' +
    '<h2 id="preTitle" class="syd-title"></h2>' +
    '<p id="preBody" class="syd-body"></p>' +
    '<div class="syd-actions"><button type="button" class="syd-yes"></button><button type="button" class="syd-no"></button></div></div>';
  el.querySelector(".syd-title").textContent = preciseStr("preciseTitle");
  el.querySelector(".syd-body").textContent = preciseStr("preciseBody");
  const yes = el.querySelector(".syd-yes"), no = el.querySelector(".syd-no");
  yes.textContent = preciseStr("preciseAllow");
  no.textContent = preciseStr("preciseLater");
  function close(answer){
    document.removeEventListener("keydown", onKey, true);
    preciseRemember(answer);
    GymMotion.hide(el, ()=>el.remove());
    preciseSheet = null;
    if(opener && opener.focus) try{ opener.focus(); }catch(e){}
  }
  function onKey(e){
    if(e.key === "Escape"){ e.stopPropagation(); close("later"); return; }
    if(e.key !== "Tab") return;
    if(e.shiftKey && document.activeElement === yes){ e.preventDefault(); no.focus(); }
    else if(!e.shiftKey && document.activeElement === no){ e.preventDefault(); yes.focus(); }
  }
  no.onclick = () => close("later");
  el.querySelector(".syd-backdrop").onclick = () => close("later");
  yes.onclick = () => {
    close("allow");
    preciseAwaitingSettings = true;
    try{ Promise.resolve(ln.changeExactNotificationSetting()).catch(() => {}); }catch(e){}
  };
  document.body.appendChild(el);
  GymMotion.show(el);
  preciseSheet = el;
  document.addEventListener("keydown", onKey, true);
  yes.focus();
}
// Back from system Settings: re-check, so a timer running right now rings exactly.
document.addEventListener("visibilitychange", () => {
  if(document.hidden || !preciseAwaitingSettings) return;
  preciseAwaitingSettings = false;
  if(restEndAt) scheduleRestNotification(finalEndAt(), restName); // re-reads the setting
});

// ---------------- SESSION TIMER (whole workout) ----------------
const sessionCard = document.getElementById("sessionCard");
const sessionTimeEl = document.getElementById("sessionTime");
const sessionHintEl = document.getElementById("sessionHint");
const sessionBtn = document.getElementById("sessionBtn");
const sessionPauseBtn = document.getElementById("sessionPauseBtn");
const miniTimer = document.getElementById("miniTimer");
const miniLabel = document.getElementById("miniLabel");
const miniTime = document.getElementById("miniTime");
const miniPause = document.getElementById("miniPause");
let sessionInterval = null;

function fmtHMS(totalSec){
  const h = Math.floor(totalSec/3600).toString().padStart(2,"0");
  const m = Math.floor((totalSec%3600)/60).toString().padStart(2,"0");
  const s = Math.floor(totalSec%60).toString().padStart(2,"0");
  return `${h}:${m}:${s}`;
}

function lastSessionFor(dayId){
  const arr = sessions[dayId];
  if(!arr || !arr.length) return null;
  return arr[arr.length-1];
}

// elapsed seconds for the running session, honouring paused segments
function sessionElapsedSec(){
  if(!activeSession) return 0;
  let s = activeSession.accumSec || 0;
  if(activeSession.running && activeSession.segStart) s += (Date.now() - activeSession.segStart) / 1000;
  return Math.floor(s);
}

function renderSessionTime(){
  const txt = fmtHMS(sessionElapsedSec());
  sessionTimeEl.textContent = txt;
  miniTime.textContent = txt;
}

// show the floating timer once the session card has scrolled out of view
function updateMiniTimer(){
  const active = activeSession && activeSession.dayId === activeDay;
  if(!active){ miniTimer.classList.remove("show"); return; }
  const gone = sessionCard.getBoundingClientRect().bottom < 8;
  miniTimer.classList.toggle("show", gone);
}

function updateSessionUI(){
  clearInterval(sessionInterval);
  const isThisDayActive = activeSession && activeSession.dayId === activeDay;

  if(isThisDayActive){
    const running = !!activeSession.running;
    sessionCard.classList.add("active");
    sessionBtn.textContent = t("endWorkout");
    sessionBtn.classList.add("stop");
    sessionPauseBtn.hidden = false;
    sessionPauseBtn.textContent = running ? t("pause") : t("resume");
    sessionPauseBtn.classList.toggle("resumed", !running);
    sessionHintEl.textContent = running ? t("inProgress") : t("paused");

    miniLabel.textContent = dayLabel(DAYS.find(d=>d.id===activeDay));
    miniTimer.classList.toggle("paused", !running);
    miniPause.innerHTML = running ? IC_PAUSE : IC_PLAY;
    miniPause.setAttribute("aria-label", running ? t("pause") : t("resume"));

    renderSessionTime();
    if(running) sessionInterval = setInterval(renderSessionTime, 1000);
    updateMiniTimer();
  } else {
    sessionCard.classList.remove("active");
    sessionBtn.textContent = t("startWorkout");
    sessionBtn.classList.remove("stop");
    sessionPauseBtn.hidden = true;
    miniTimer.classList.remove("show");
    const last = lastSessionFor(activeDay);
    const dObj = DAYS.find(d=>d.id===activeDay);
    sessionTimeEl.textContent = "00:00:00";
    sessionHintEl.textContent = last
      ? t("lastSession").replace("{d}", dayLabel(dObj)).replace("{n}", Math.round(last.durationSec/60))
      : t("notStarted");
  }
}

function togglePauseSession(){
  if(!activeSession) return;
  if(activeSession.running){
    activeSession.accumSec = (activeSession.accumSec || 0) + (Date.now() - activeSession.segStart) / 1000;
    activeSession.running = false;
    activeSession.segStart = null;
  } else {
    activeSession.running = true;
    activeSession.segStart = Date.now();
  }
  saveJSON("gym_session_active", activeSession);
  updateSessionUI();
}
sessionPauseBtn.onclick = togglePauseSession;
miniPause.onclick = (e)=>{ e.stopPropagation(); togglePauseSession(); };
miniTimer.onclick = ()=>{
  try { window.scrollTo({ top:0, behavior:"smooth" }); }
  catch(e){ window.scrollTo(0,0); }
};

// Guarded: a double tap must not start-then-immediately-stop (or double-log) a session.
sessionBtn.onclick = GymAct.once(()=>{
  if(activeSession && activeSession.dayId === activeDay){
    const durationSec = sessionElapsedSec();
    sessions[activeDay] = sessions[activeDay] || [];
    sessions[activeDay].push({ date: todayStr(), durationSec });
    saveJSON("gym_sessions", sessions);
    activeSession = null;
    localStorage.removeItem("gym_session_active");
  } else {
    if(isDayComplete(activeDay)){
      alert(t("dayAlreadyDone"));
      return;
    }
    const now = Date.now();
    activeSession = { dayId: activeDay, startedAt: now, running: true, accumSec: 0, segStart: now };
    saveJSON("gym_session_active", activeSession);
  }
  updateSessionUI();
}, { cooldown: 500 });

// ---------------- INSTALL TIP ----------------
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
if(!isStandalone){
  document.getElementById("installTip").classList.add("show");
}

// ---------------- SERVICE WORKER ----------------
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("service-worker.js").catch(()=>{});
  });
}

// ---------------- PERSISTENT STORAGE ----------------
// Ask the browser not to auto-evict our data (iOS/Safari can clear it otherwise).
if(navigator.storage && navigator.storage.persist){
  navigator.storage.persist().catch(()=>{});
}

// Called by sync.js after it writes newer progress pulled from the server.
window.GymApplyExternalUpdate = function(){
  try { location.reload(); } catch(e){}
};

// A tab left open across local midnight: re-render and refresh the calendar so
// "today" moves on. Checked on return to the tab and on a slow timer (todayStr()
// itself is already live, so any write after midnight uses the new day).
let renderedDay = todayStr();
function checkDayRollover(){
  const now = todayStr();
  if(now === renderedDay) return;
  renderedDay = now;
  renderAll();
  if(window.GymCalendar) window.GymCalendar.refresh(true);
}
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) checkDayRollover(); });
window.addEventListener("focus", checkDayRollover);
setInterval(checkDayRollover, 30000);

// ---------------- WARM-UP VIDEO ----------------
const warmupBtn = document.getElementById("warmupVidBtn");
if(warmupBtn){
  warmupBtn.onclick = ()=>{
    const wrap = document.getElementById("warmupWrap");
    const frame = document.getElementById("warmupFrame");
    const open = !wrap.classList.contains("open") || wrap.classList.contains("m-reveal-out"); // a tap mid-close reopens
    if(open) GymMotion.expand(wrap, ()=>wrap.classList.add("open"));
    else GymMotion.collapse(wrap, ()=>wrap.classList.remove("open"));
    warmupBtn.classList.toggle("on", open);
    frame.innerHTML = open
      ? `<iframe src="${ytEmbedSrc('gDSRFzs6k_s', false)}" allow="accelerometer; encrypted-media; fullscreen; gyroscope; picture-in-picture" allowfullscreen></iframe>`
      : "";
    warmupBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> ${open ? t('hideVideo') : t('video')}`;
  };
}

// ---------------- BACK TO TOP ----------------
const toTopBtn = document.getElementById("toTop");
window.addEventListener("scroll", ()=>{
  toTopBtn.classList.toggle("show", window.scrollY > 260);
  updateMiniTimer();
}, { passive:true });
toTopBtn.onclick = ()=>{
  try { window.scrollTo({ top:0, behavior:"smooth" }); }
  catch(e){ window.scrollTo(0,0); }
};

// ---------------- i18n APPLY ----------------
function applyStaticI18n(){
  document.querySelectorAll("[data-i18n]").forEach(el=>{ el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach(el=>{ el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
  document.querySelectorAll("[data-i18n-html]").forEach(el=>{ el.innerHTML = t(el.dataset.i18nHtml); });
  document.title = t("appTitle");
  renderThemePrefs();
}
function applyLang(lang, persist){
  activeLang = lang;
  if(persist) setPref("gym_lang", lang);
  document.documentElement.lang = lang === "ar" ? "ar" : "en";
  document.documentElement.dir  = lang === "ar" ? "rtl" : "ltr";
  applyStaticI18n();
  animateCards = true;
  renderAll();
  try {
    if(window.GymCoach && typeof window.GymCoach.refresh === "function") window.GymCoach.refresh();
  } catch(e){ if(window.console) console.warn("coach re-render failed", e); }
  try {
    if(window.GymCalendar && typeof window.GymCalendar.refresh === "function") window.GymCalendar.refresh(true);
  } catch(e){ if(window.console) console.warn("calendar re-render failed", e); }
  try {
    if(window.GymFood && typeof window.GymFood.refresh === "function") window.GymFood.refresh();
  } catch(e){ if(window.console) console.warn("food re-render failed", e); }
  try {
    // P0-3: keep the Google Sign-In button's own language in sync with the
    // app's toggle instead of it silently staying on the browser/OS locale.
    if(window.GymSync && typeof window.GymSync.refreshLocale === "function") window.GymSync.refreshLocale(lang);
  } catch(e){ if(window.console) console.warn("google sign-in locale refresh failed", e); }
}

// ---------------- PLAN + STYLE ----------------
function applyState(persist){
  if(activeStyle === "coach" && !loadJSON("gym_plans_custom", null)) activeStyle = "gym";
  ensureCoachStyleBtn();
  DAYS = pickDays();
  restSlot = null;
  animateCards = true;
  document.documentElement.dataset.plan = activePlan || "male";
  applyTheme();
  activeDay = localStorage.getItem(activeDayStoreKey()) || DAYS[0].id;
  if(!DAYS.some(d=>d.id===activeDay)) activeDay = DAYS[0].id;
  openVideoId = null;
  document.querySelectorAll("[data-plan-btn]").forEach(b=> b.classList.toggle("on", b.dataset.planBtn === (activePlan || "male")));
  document.querySelectorAll("[data-style-btn]").forEach(b=> b.classList.toggle("on", b.dataset.styleBtn === activeStyle));
  if(persist && activePlan) setPref("gym_plan", activePlan);
  if(persist) setPref("gym_style", activeStyle);
  renderAll();
}

// ---------------- TRAINING SPLIT (More tab) ----------------
// Tool icons (24px outline). "none" is the bodyweight figure.
const TOOL_ICONS = {
  none: '<circle cx="12" cy="5" r="2"/><path d="M12 8v6m0 0-3 6m3-6 3 6M6.5 11 12 9.5l5.5 1.5"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  band: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="12" r="2.5"/><path d="M7.5 12c2-4.5 7-4.5 9 0M7.5 12c2 4.5 7 4.5 9 0"/>',
  bench: '<path d="M7 4v10h11M7 14v6M18 14v6M7 9h4"/>',
  table: '<path d="M3 8h18M6 8v12M18 8v12M6 14h12"/>',
  pullup_bar: '<path d="M4 20V5M20 20V5M4 7h16M9 7v4M15 7v4"/>',
  kettlebell: '<path d="M8.5 9V7.5a3.5 3.5 0 0 1 7 0V9"/><circle cx="12" cy="14.5" r="5.5"/>',
  jump_rope: '<rect x="5" y="3" width="3" height="5" rx="1"/><rect x="16" y="3" width="3" height="5" rx="1"/><path d="M6.5 8c-3 9 2 13 5.5 13s8.5-4 5.5-13"/>',
  barbell: '<path d="M2.5 12h19M5 7.5v9M8 6v12M16 6v12M19 7.5v9"/>',
  cable: '<path d="M12 3v7M8 21l4-11 4 11M9 21h6"/><circle cx="12" cy="3.5" r="1.5"/>',
  machine: '<rect x="4" y="3" width="4" height="18" rx="1"/><path d="M8 7h10v4H8M8 17h8M14 11v6"/>'
};
function toolIcon(k){ return `<svg class="tool-ic" viewBox="0 0 24 24" aria-hidden="true">${TOOL_ICONS[k] || ""}</svg>`; }
// The small "Tools" line on a split exercise card (Classic cards stay as they were).
function toolsLine(ex){
  if(!splitCache || DAYS !== splitCache.plan.days || !Array.isArray(ex.tools) || !ex.tools.length) return "";
  const names = ex.tools.map(k=>t("tool_" + k));
  return `<div class="ex-tools" role="group" aria-label="${GymUI.esc(t("toolsLbl") + ": " + names.join(", "))}">${ex.tools.map((k, i)=>`<span class="ex-tool">${toolIcon(k)}<span>${GymUI.esc(names[i])}</span></span>`).join("")}</div>`;
}

function saveSplit(patch){
  splitChoice = Object.assign({}, splitChoice, patch);
  saveJSON("gym_split", { days: splitChoice.days, where: splitChoice.where, tools: splitChoice.tools });
}
// A different day count that leaves strictly fewer tool-caused gaps ("region" gaps) than the current
// choice, or 0. Ties go to 4 days, then 5, 3, 6. Frequency gaps are ignored: they always favour 6.
function bestSplitDays(){
  if(!window.GymSplits) return 0;
  const sex = activePlan === "female" ? "female" : "male";
  const gaps = d=> GymSplits.buildPlan({ days: d, where: splitChoice.where, sex, tools: splitChoice.tools }).gaps.filter(g=>g.kind === "region").length;
  let best = 0, bestN = gaps(splitChoice.days);
  [4, 5, 3, 6].forEach(d=>{
    if(d === splitChoice.days) return;
    const n = gaps(d);
    if(n < bestN){ best = d; bestN = n; }
  });
  return best;
}
// "Mon · Wed · Fri" for a split's fixed training weekdays (buildPlan's `week`, Monday first).
function weekdayList(plan){
  const f = new Intl.DateTimeFormat(activeLang === "ar" ? "ar" : "en", { weekday:"short", timeZone:"UTC" });
  return plan.week.map((id, i)=> id ? f.format(new Date(Date.UTC(2024, 0, 1 + i))) : null).filter(Boolean).join(" · ");
}
// "Tick X to cover Y" lines for the tools that would close this plan's gaps.
function gapHints(plan){
  const by = {};
  plan.gaps.forEach(g=>{
    (g.tick || []).forEach(k=>{
      if(k === "none") return;
      (by[k] = by[k] || {})[g.region] = 1;
    });
  });
  const list = (arr)=> window.Intl && Intl.ListFormat ? new Intl.ListFormat(activeLang, { style:"long", type:"conjunction" }).format(arr) : arr.join(", ");
  return Object.keys(by).sort((a, b)=> Object.keys(by[b]).length - Object.keys(by[a]).length).slice(0, 2).map(k=>{
    const parts = Object.keys(by[k]).slice(0, 3).map(r=> SHAPE_BY_ID[r] ? (activeLang === "ar" ? SHAPE_BY_ID[r].labelAr : SHAPE_BY_ID[r].label) : r);
    return { tool: k, text: t("splitHint").replace("{tool}", t("tool_" + k)).replace("{parts}", list(parts)) };
  });
}

function renderSplitPanel(){
  const host = document.getElementById("splitPanel");
  if(!host || !window.GymSplits) return;
  const esc = GymUI.esc, c = splitChoice;
  const focusKey = document.activeElement && host.contains(document.activeElement) ? document.activeElement.dataset.spKey : null;
  const best = c.days ? bestSplitDays() : 0; // 0 = none better than the current choice
  const chip = (d)=>{
    const on = c.days === d, rec = d && d === best;
    const label = d ? t("splitDaysN").replace("{n}", d) : t("splitClassic");
    return `<button type="button" class="sp-chip${on ? " on" : ""}${rec ? " rec" : ""}" role="radio" aria-checked="${on}" data-sp-days="${d}" data-sp-key="d${d}" aria-label="${esc(label + (rec ? ", " + t("splitBestMark") : ""))}">${d ? d : esc(label)}</button>`;
  };
  let html = `<div class="sp-sub" id="spDaysLbl">${t("splitDays")}</div>
    <div class="sp-chips" role="radiogroup" aria-labelledby="spDaysLbl">${[0, 3, 4, 5, 6].map(chip).join("")}</div>`;
  if(!c.days){
    html += `<p class="sp-note">${t("splitClassicNote")}</p>`;
  } else {
    const plan = splitPlan();
    html += (best ? `<p class="sp-note">${t("splitBest").replace("{n}", "<bdi>" + best + "</bdi>")}</p>` : "") + `
      <div class="sp-sub" id="spWhereLbl">${t("splitWhere")}</div>
      <div class="plan-toggle" role="radiogroup" aria-labelledby="spWhereLbl">
        ${["gym", "home"].map(w=>`<button type="button" role="radio" aria-checked="${c.where === w}" class="${c.where === w ? "on" : ""}" data-sp-where="${w}" data-sp-key="w${w}">${t(w === "gym" ? "splitGym" : "splitHome")}</button>`).join("")}
      </div>`;
    if(c.where === "home"){
      html += `<div class="sp-sub" id="spToolsLbl">${t("splitTools")}</div>
        <div class="sp-tools" role="group" aria-labelledby="spToolsLbl">
          ${HOME_TOOL_KEYS.map(k=>{
            const on = k === "none" ? !c.tools.length : c.tools.indexOf(k) >= 0;
            return `<button type="button" class="sp-tool${on ? " on" : ""}" role="checkbox" aria-checked="${on}" data-sp-tool="${k}" data-sp-key="t${k}">${toolIcon(k)}<span>${esc(t("tool_" + k))}</span></button>`;
          }).join("")}
        </div>`;
    }
    const hints = gapHints(plan);
    html += `<div class="sp-hints" aria-live="polite">${hints.map(h=>`<p class="sp-hint">${toolIcon(h.tool)}<span>${esc(h.text)}</span></p>`).join("")}</div>
      <div class="sp-sum"><div class="sp-sub">${t("splitSumTitle")}</div><p>${t("splitSum" + c.days)}</p><p class="sp-wk">${t("splitWeekdays").replace("{d}", "<bdi>" + esc(weekdayList(plan)) + "</bdi>")}</p></div>`;
  }
  host.innerHTML = html;
  if(focusKey){ const f = host.querySelector(`[data-sp-key="${focusKey}"]`); if(f) f.focus(); }
}

// Applies a split choice (More tab now, the onboarding survey later) and re-renders. days 0 =
// Classic; 3-6 = a generated split, which also moves the user to the Gym program. Nothing is
// written until this is called, so nobody is moved on their own. Returns { days, week, gaps }
// for a split, or null for Classic.
function applySplitChoice(c){
  c = c || {};
  const patch = {};
  if("days" in c) patch.days = [3, 4, 5, 6].indexOf(+c.days) >= 0 ? +c.days : 0;
  if("where" in c) patch.where = c.where === "home" ? "home" : "gym";
  if("tools" in c) patch.tools = HOME_TOOL_KEYS.filter((k, i)=> i > 0 && (c.tools || []).indexOf(k) >= 0);
  saveSplit(patch);
  if(splitChoice.days && activeStyle !== "gym"){ activeStyle = "gym"; setPref("gym_style", activeStyle); }
  applyState(false);
  return splitPlan();
}
if(window.GymSplits) window.GymSplits.applyChoice = applySplitChoice; // splits.js missing (cache/network): Classic keeps working
(function wireSplitPanel(){
  const host = document.getElementById("splitPanel");
  if(!host) return;
  host.addEventListener("click", (e)=>{
    const b = e.target.closest("button");
    if(!b || !host.contains(b)) return;
    if(isAnonMode()){ if(window.GymUI) window.GymUI.promptSignIn(); return; }
    if(b.dataset.spDays !== undefined) applySplitChoice({ days: +b.dataset.spDays });
    else if(b.dataset.spWhere) applySplitChoice({ where: b.dataset.spWhere });
    else if(b.dataset.spTool){
      const k = b.dataset.spTool, cur = splitChoice.tools.slice();
      if(k === "none") applySplitChoice({ tools: [] });
      else applySplitChoice({ tools: cur.indexOf(k) >= 0 ? cur.filter(x=>x !== k) : cur.concat(k) });
    }
  });
})();

// ---------------- DAY TABS (always-visible chip strip on the Plan screen) ----------------
function renderDayTabs(){
  const list = document.getElementById("dayTabs");
  if(!list) return;
  list.innerHTML = "";
  const week = weekSlots();
  const slots = week ? week.map((id, i)=>({ i, day: id && DAYS.find(d=>d.id === id) })) : DAYS.map(d=>({ i: -1, day: d }));
  slots.forEach(slot=>{
    const d = slot.day;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "day-chip";
    if(d){
      b.textContent = dayLabel(d);
      if(week) b.setAttribute("aria-label", t("weekDayN").replace("{n}", slot.i + 1) + ": " + dayLabel(d));
    } else {
      b.classList.add("is-rest");
      b.textContent = t("weekRest");
      b.setAttribute("aria-label", t("weekDayN").replace("{n}", slot.i + 1) + ": " + t("weekRest"));
    }
    const on = d ? (restSlot === null && d.id === activeDay) : restSlot === slot.i;
    if(on){ b.classList.add("active"); b.setAttribute("aria-current","true"); }
    b.onclick = ()=>{
      if(on) return;
      if(d){
        restSlot = null;
        activeDay = d.id;
        setPref(activeDayStoreKey(), activeDay);
      } else {
        restSlot = slot.i;
      }
      openVideoId = null;
      animateCards = true;
      renderAll();
      const active = list.querySelector(".day-chip.active");
      if(active && active.scrollIntoView) active.scrollIntoView({ block:"nearest", inline:"center" });
      window.scrollTo(0, 0);
    };
    list.appendChild(b);
  });
  const active = list.querySelector(".day-chip.active");
  if(active && active.scrollIntoView) active.scrollIntoView({ block:"nearest", inline:"center" });
}

// Adds a "Coach plan" option to the Program toggle once the user has applied an
// AI-generated workout (gym_plans_custom). Wired here because the static
// [data-style-btn] handler below only runs over the buttons present at load.
function ensureCoachStyleBtn(){
  const wrap = document.getElementById("styleToggle");
  if(!wrap) return;
  const has = !!loadJSON("gym_plans_custom", null);
  let btn = wrap.querySelector('[data-style-btn="coach"]');
  if(has && !btn){
    btn = document.createElement("button");
    btn.setAttribute("data-style-btn", "coach");
    btn.textContent = t("styleCoach");
    btn.onclick = ()=> setStyle("coach");
    wrap.appendChild(btn);
  } else if(btn){
    btn.textContent = t("styleCoach");
  }
}

function setStyle(style){
  if(isAnonMode()){ if(window.GymUI) window.GymUI.promptSignIn(); return; }
  // A split belongs to the Gym program; the in-house and coach programs go back to Classic.
  if(style !== "gym" && splitChoice.days) saveSplit({ days: 0 });
  activeStyle = style;
  applyState(true);
  if(window.GymUI) window.GymUI.navigate("plan");
  else window.scrollTo(0, 0);
}

// Called by survey.js: pick the starter plan from the onboarding answers.
window.GymSetPlan = function(plan, style){
  if(plan !== "male" && plan !== "female") return;
  activePlan = plan;
  activeStyle = style === "cal" ? "cal" : "gym";
  applyState(true);
};

// Called by coach.js: store an AI workout as a selectable plan and switch to it.
window.GymApplyCoachPlan = function(days){
  if(!Array.isArray(days) || !days.length) return;
  saveJSON("gym_plans_custom", days);
  ensureCoachStyleBtn();
  setStyle("coach");
};

function renderTitle(){
  if(isAnonMode()){
    document.getElementById("appTitleEl").textContent = t("appTitle");
    document.title = t("appTitle");
    return;
  }
  const planWord  = t(activePlan === "female" ? "female" : "male");
  // An active split replaces the program word: "4 days · Home" (Classic keeps Gym / In-House).
  const styleWord = splitChoice.days
    ? t("splitDaysN").replace("{n}", splitChoice.days).replace(" ", " ") + " · " + t(splitChoice.where === "home" ? "splitHome" : "splitGym")
    : t(activeStyle === "cal" ? "styleCal" : "styleGym");
  const full = t("appTitle") + " · " + planWord + " · " + styleWord;
  document.getElementById("appTitleEl").textContent = full;
  document.title = full;
}

// Plan (Male/Female) and program (Gym/In-House) are switched from the More
// tab only. There is no first-run picker: until one is chosen the app runs
// the male/gym default (activePlan stays null, see INIT below).
document.querySelectorAll("[data-plan-btn]").forEach(b=>{
  b.onclick = ()=>{
    if(isAnonMode()){ if(window.GymUI) window.GymUI.promptSignIn(); return; }
    activePlan = b.dataset.planBtn;
    applyState(true);
    if(window.GymUI) window.GymUI.navigate("plan"); else window.scrollTo(0, 0);
  };
});
document.querySelectorAll("[data-style-btn]").forEach(b=>{
  b.onclick = ()=> setStyle(b.dataset.styleBtn);
});
// Theme switch (top bar): follows the phone until tapped, then stores an explicit light/dark.
function toggleTheme(){
  const dark = document.documentElement.dataset.theme !== "light";
  if(window.GymTheme) window.GymTheme.setMode(dark ? "light" : "dark");
  renderThemePrefs();
}
function toggleLang(){ applyLang(activeLang === "ar" ? "en" : "ar", true); }
// Shared by the floating pill (signed out) and the avatar menu (header.js, signed in).
window.GymPrefs = { toggleTheme, toggleLang };
document.getElementById("themeBtn").onclick = toggleTheme;
document.getElementById("langBtn").onclick = toggleLang;

// ---------------- INIT ----------------
document.documentElement.lang = activeLang === "ar" ? "ar" : "en";
document.documentElement.dir  = activeLang === "ar" ? "rtl" : "ltr";
applyStaticI18n();
// No plan picked yet renders the male/gym default without persisting it:
// writing gym_plan here would stamp a fresh local timestamp and win the
// next sync merge over the plan this account already saved server-side.
applyState(false);
