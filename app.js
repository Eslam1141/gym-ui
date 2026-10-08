// ---------------- DATA ----------------
// Shown to signed-out ("anonymous") users: one general full-body day.
// Mirrors data.preview in gym-be/internal/plans/plans.seed.json.
const DAYS_PREVIEW = [
  { id:"preview", label:"Full-Body Starter", muscles:"Full body", exercises:[
    {id:"pv_legpress", en:"Leg Press", sets:3, reps:"10-12", rest:120, vid:"nDh_BlnLCGc", shape:"quads", tier:"easy"},
    {id:"pv_dbbench", en:"Dumbbell Bench Press", sets:3, reps:"8-12", rest:90, vid:"Gf65Yy0-wGI", shape:"chest_mid", tier:"medium"},
    {id:"pv_cablerow", en:"Seated Cable Row", sets:3, reps:"10-12", rest:90, vid:"8QuMq1GMMng", shape:"back_mid", tier:"easy"},
    {id:"pv_ohp", en:"Seated Dumbbell Shoulder Press", sets:3, reps:"10-12", rest:75, vid:"k6tzKisR3NY", shape:"shoulder_front", tier:"medium"},
    {id:"pv_legcurl", en:"Lying Leg Curl", sets:3, reps:"12-15", rest:60, vid:"bgfHeL6eR9Q", shape:"hamstrings", tier:"easy"},
    {id:"pv_plank", en:"Plank (core)", sets:3, reps:"30-45s", rest:45, vid:"fWW5d1ZFhk4", shape:"core_upper", tier:"medium"},
  ]},
];
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
const DAYS_MALE = [
  { id:"m_upperA", label:"Upper A", muscles:"Chest, Back, Delts, Arms", exercises:[
    {id:"mua_bench", en:"Barbell Bench Press", sets:4, reps:"6-8", rest:150, vid:"0cXAp6WhSj4", shape:"chest_mid", tier:"hard"},
    {id:"mua_pulldown", en:"Lat Pulldown / Pull-up", sets:4, reps:"8-10", rest:120, vid:"bNmvKpJSWKM", shape:"back_lats", tier:"medium"},
    {id:"mua_ohp", en:"Seated Dumbbell Shoulder Press", sets:3, reps:"10-12", rest:75, vid:"k6tzKisR3NY", shape:"shoulder_front", tier:"medium"},
    {id:"mua_row", en:"Chest-Supported Row", sets:4, reps:"8-10", rest:90, vid:"uhwcRYpkjvc", shape:"back_mid", tier:"medium"},
    {id:"mua_lateral", en:"Dumbbell Lateral Raise", sets:3, reps:"15-20", rest:30, vid:"Kl3LEzQ5Zqs", shape:"shoulder_side", tier:"easy"},
    {id:"mua_facepull", en:"Band Face Pull", sets:3, reps:"15-20", rest:30, vid:"C45c3fR4o28", shape:"shoulder_rear", tier:"easy"},
    {id:"mua_curl", en:"Barbell Curl", sets:3, reps:"10-12", rest:60, vid:"9_ijHhcwlkM", shape:"biceps_short", tier:"medium"},
    {id:"mua_pushdown", en:"Cable Rope Pushdown", sets:3, reps:"12-15", rest:45, vid:"7OF77JMEXhM", shape:"triceps_lateral", tier:"easy"},
  ]},
  { id:"m_lowerA", label:"Lower A", muscles:"Quads, Glutes, Hamstrings, Abs", exercises:[
    {id:"mla_squat", en:"Barbell Back Squat", sets:4, reps:"6-8", rest:150, vid:"tNUq6b5t11Q", shape:"quads", tier:"hard"},
    {id:"mla_rdl", en:"Barbell Romanian Deadlift", sets:3, reps:"8-10", rest:90, vid:"zdip4iexlxg", shape:"hamstrings", shape2:"back_lower", tier:"hard"},
    {id:"mla_legpress", en:"Leg Press", sets:3, reps:"10-12", rest:120, vid:"nDh_BlnLCGc", shape:"quads", tier:"easy"},
    {id:"mla_legcurl", en:"Lying Leg Curl", sets:3, reps:"12-15", rest:60, vid:"bgfHeL6eR9Q", shape:"hamstrings", tier:"easy"},
    {id:"mla_bridge", en:"Dumbbell Glute Bridge", sets:3, reps:"15-20", rest:45, vid:"12m6GW59LvQ", shape:"glutes", tier:"easy"},
    {id:"mla_calf", en:"Standing Calf Raise", sets:3, reps:"15-20", rest:30, vid:"B30JglFGx8Y", shape:"calves", tier:"easy"},
    {id:"mla_core", en:"Hanging Leg Raise (core)", sets:3, reps:"10-15", rest:45, vid:"0wSUjj5j1xo", shape:"core_lower", tier:"hard"},
  ]},
  { id:"m_upperB", label:"Upper B", muscles:"Chest, Back, Delts, Arms", exercises:[
    {id:"mub_incline", en:"Incline Dumbbell Press", sets:3, reps:"8-10", rest:120, vid:"8fXfwG4ftaQ", shape:"chest_upper", tier:"medium"},
    {id:"mub_pulldown", en:"Lat Pulldown / Pull-up", sets:4, reps:"8-10", rest:120, vid:"bNmvKpJSWKM", shape:"back_lats", tier:"medium"},
    {id:"mub_arnold", en:"Arnold Press", sets:3, reps:"12-15", rest:45, vid:"AjB-UXErljM", shape:"shoulder_front", tier:"medium"},
    {id:"mub_row", en:"Chest-Supported Dumbbell Row", sets:3, reps:"12-15", rest:45, vid:"09wri23R4SU", shape:"back_mid", tier:"easy"},
    {id:"mub_lateral", en:"Dumbbell Lateral Raise", sets:3, reps:"15-20", rest:30, vid:"Kl3LEzQ5Zqs", shape:"shoulder_side", tier:"easy"},
    {id:"mub_pullapart", en:"Band Pull-Apart", sets:3, reps:"15-20", rest:30, vid:"qi2y-eI_kuI", shape:"shoulder_rear", tier:"easy"},
    {id:"mub_hammer", en:"Hammer Curl", sets:3, reps:"12-15", rest:30, vid:"K9LiwcGuqA0", shape:"biceps_short", tier:"medium"},
    {id:"mub_dips", en:"Bench Dips", sets:3, reps:"12-18", rest:45, vid:"ekgvqS_4Ee4", shape:"triceps_lateral", tier:"easy"},
  ]},
  { id:"m_lowerB", label:"Lower B", muscles:"Quads, Hamstrings, Calves", exercises:[
    {id:"mlb_hack", en:"Hack Squat", sets:4, reps:"8-10", rest:120, vid:"g9i05umL5vc", shape:"quads", tier:"medium"},
    {id:"mlb_sldl", en:"Single-Leg Dumbbell RDL", sets:3, reps:"10-12/leg", rest:45, vid:"kQf5g0y0mO4", shape:"hamstrings", tier:"hard"},
    {id:"mlb_legext", en:"Leg Extension", sets:3, reps:"15-20", rest:60, vid:"iQ92TuvBqRo", shape:"quads", tier:"easy"},
    {id:"mlb_seatcurl", en:"Seated Leg Curl", sets:3, reps:"12-15", rest:60, vid:"xdbEG3xGLI8", shape:"hamstrings", tier:"easy"},
    {id:"mlb_kickback", en:"Band Glute Kickback", sets:3, reps:"15-20/leg", rest:30, vid:"aw9WClmz5jw", shape:"glutes", tier:"easy"},
    {id:"mlb_calf", en:"Seated Calf Raise (Dumbbell)", sets:3, reps:"15-20", rest:30, vid:"NrHJPauB01I", shape:"calves", tier:"easy"},
    {id:"mlb_core", en:"Pallof Press (core)", sets:3, reps:"12/side", rest:45, vid:"P1H4IzD9rbQ", shape:"core_obliques", tier:"medium"},
  ]},
];

const DAYS_FEMALE = [
  { id:"f_lowerA", label:"Lower A", muscles:"Glutes & Quads", exercises:[
    {id:"fla_goblet", en:"Goblet Squat", sets:3, reps:"12-15", rest:60, vid:"0OWbS1WiUGU", shape:"quads", tier:"easy"},
    {id:"fla_rdl", en:"Dumbbell Romanian Deadlift", sets:3, reps:"12-15", rest:60, vid:"hu3jRvTc_po", shape:"hamstrings", tier:"medium"},
    {id:"fla_lunge", en:"Reverse Lunge (Dumbbell)", sets:3, reps:"10-12/leg", rest:60, vid:"YXL_f378hLM", shape:"quads", tier:"medium"},
    {id:"fla_bridge", en:"Dumbbell Glute Bridge", sets:3, reps:"15-20", rest:45, vid:"12m6GW59LvQ", shape:"glutes", tier:"easy"},
    {id:"fla_calf", en:"Standing Calf Raise", sets:3, reps:"15-20", rest:30, vid:"B30JglFGx8Y", shape:"calves", tier:"easy"},
    {id:"fla_deadbug", en:"Dead Bug (core)", sets:3, reps:"10-12/side", rest:30, vid:"XcYtWYMz39w", shape:"core_obliques", tier:"easy"},
  ]},
  { id:"f_upperA", label:"Upper A", muscles:"Push focus", exercises:[
    {id:"fua_bench", en:"Dumbbell Bench Press", sets:3, reps:"10-12", rest:60, vid:"Gf65Yy0-wGI", shape:"chest_mid", tier:"medium"},
    {id:"fua_row", en:"One-Arm Dumbbell Row", sets:3, reps:"12-15/arm", rest:45, vid:"H8jf3DwlIlo", shape:"back_mid", tier:"medium"},
    {id:"fua_press", en:"Seated Dumbbell Shoulder Press", sets:3, reps:"12-15", rest:45, vid:"k6tzKisR3NY", shape:"shoulder_front", tier:"medium"},
    {id:"fua_pullapart", en:"Band Pull-Apart", sets:3, reps:"15-20", rest:30, vid:"qi2y-eI_kuI", shape:"shoulder_rear", tier:"easy"},
    {id:"fua_lateral", en:"Dumbbell Lateral Raise", sets:3, reps:"15-20", rest:30, vid:"Kl3LEzQ5Zqs", shape:"shoulder_side", tier:"easy"},
    {id:"fua_arms", en:"Biceps Curl + Triceps Extension (superset)", sets:3, reps:"12-15", rest:45, vid:"8UIbEovL-xU", shape:"biceps_short", tier:"medium"},
  ]},
  { id:"f_lowerB", label:"Lower B", muscles:"Hamstrings & Glutes", exercises:[
    {id:"flb_sumo", en:"Dumbbell Sumo Squat", sets:3, reps:"12-15", rest:60, vid:"bRCjBCtBGIo", shape:"quads", tier:"medium"},
    {id:"flb_sldl", en:"Single-Leg Dumbbell RDL", sets:3, reps:"10-12/leg", rest:45, vid:"kQf5g0y0mO4", shape:"hamstrings", tier:"hard"},
    {id:"flb_bss", en:"Bulgarian Split Squat", sets:3, reps:"10-12/leg", rest:60, vid:"uODWo4YqbT8", shape:"quads", tier:"hard"},
    {id:"flb_kickback", en:"Band Glute Kickback", sets:3, reps:"15-20/leg", rest:30, vid:"aw9WClmz5jw", shape:"glutes", tier:"easy"},
    {id:"flb_calf", en:"Seated Calf Raise (Dumbbell)", sets:3, reps:"15-20", rest:30, vid:"NrHJPauB01I", shape:"calves", tier:"easy"},
    {id:"flb_legraise", en:"Lying Leg Raise (core)", sets:3, reps:"12-15", rest:30, vid:"jrSWj0huh5o", shape:"core_lower", tier:"medium"},
  ]},
  { id:"f_upperB", label:"Upper B", muscles:"Pull focus & core", exercises:[
    {id:"fub_incline", en:"Incline Dumbbell Press", sets:3, reps:"12-15", rest:60, vid:"8fXfwG4ftaQ", shape:"chest_upper", tier:"medium"},
    {id:"fub_row", en:"Chest-Supported Dumbbell Row", sets:3, reps:"12-15", rest:45, vid:"09wri23R4SU", shape:"back_mid", tier:"easy"},
    {id:"fub_arnold", en:"Arnold Press", sets:3, reps:"12-15", rest:45, vid:"AjB-UXErljM", shape:"shoulder_front", tier:"medium"},
    {id:"fub_facepull", en:"Band Face Pull", sets:3, reps:"15-20", rest:30, vid:"C45c3fR4o28", shape:"shoulder_rear", tier:"easy"},
    {id:"fub_hammer", en:"Hammer Curl", sets:3, reps:"12-15", rest:30, vid:"K9LiwcGuqA0", shape:"biceps_short", tier:"medium"},
    {id:"fub_plank", en:"Plank (core)", sets:3, reps:"30-45s", rest:30, vid:"fWW5d1ZFhk4", shape:"core_upper", tier:"medium"},
  ]},
];

// ---- Military calisthenics: 3 days, no equipment (bands + a sturdy table). Shared moves, scaled reps. ----
const DAYS_MALE_CAL = [
  { id:"mc_push", label:"Push", muscles:"Push & Core", exercises:[
    {id:"mcp_pushup", en:"Push-ups", sets:4, reps:"12-20", rest:60, vid:"wD1M-f69Yy8", shape:"chest_mid", tier:"easy"},
    {id:"mcp_pike", en:"Pike Push-ups", sets:3, reps:"8-12", rest:60, vid:"shEnAXgc9y4", shape:"shoulder_front", tier:"medium"},
    {id:"mcp_dips", en:"Bench Dips", sets:3, reps:"12-18", rest:45, vid:"ekgvqS_4Ee4", shape:"triceps_lateral", tier:"easy"},
    {id:"mcp_plank", en:"Plank (core)", sets:3, reps:"45-60s", rest:30, vid:"fWW5d1ZFhk4", shape:"core_upper", tier:"medium"},
    {id:"mcp_hollow", en:"Hollow Body Hold", sets:3, reps:"25-40s", rest:30, vid:"Xk-JcNj6lfY", shape:"core_upper", tier:"medium"},
    {id:"mcp_mtn", en:"Mountain Climbers", sets:4, reps:"40s", rest:30, vid:"fpmWW6iXfes", shape:"core_lower", tier:"medium"},
  ]},
  { id:"mc_legs", label:"Legs", muscles:"Legs & Cardio", exercises:[
    {id:"mcl_squat", en:"Bodyweight Squats", sets:4, reps:"25-35", rest:45, vid:"3fl7uYmiMVw", shape:"quads", tier:"easy"},
    {id:"mcl_lunge", en:"Reverse Lunges", sets:3, reps:"12-16/leg", rest:45, vid:"ufjvjxrGyFM", shape:"quads", tier:"easy"},
    {id:"mcl_bridge", en:"Glute Bridge", sets:3, reps:"20-25", rest:30, vid:"12m6GW59LvQ", shape:"glutes", tier:"easy"},
    {id:"mcl_jump", en:"Squat Jumps", sets:4, reps:"12-15", rest:45, vid:"dX9bNPQeQa8", shape:"quads", tier:"hard"},
    {id:"mcl_calf", en:"Standing Calf Raise", sets:3, reps:"25-30", rest:30, vid:"B30JglFGx8Y", shape:"calves", tier:"easy"},
    {id:"mcl_burpee", en:"Burpees", sets:5, reps:"10-15", rest:60, vid:"DNHWxCUp8MY", shape:"core_lower", tier:"hard"},
  ]},
  { id:"mc_pull", label:"Pull", muscles:"Pull & Total Body", exercises:[
    {id:"mcx_row", en:"Inverted Row (under a table)", sets:4, reps:"10-15", rest:60, vid:"VO-pt_XgFho", shape:"back_lats", tier:"medium"},
    {id:"mcx_pullapart", en:"Band Pull-Apart", sets:3, reps:"20-25", rest:30, vid:"qi2y-eI_kuI", shape:"shoulder_rear", tier:"easy"},
    {id:"mcx_superman", en:"Superman", sets:3, reps:"15-20", rest:30, vid:"uexOGyxLr7E", shape:"back_lower", tier:"easy"},
    {id:"mcx_facepull", en:"Band Face Pull", sets:3, reps:"15-20", rest:30, vid:"C45c3fR4o28", shape:"shoulder_rear", tier:"easy"},
    {id:"mcx_flutter", en:"Flutter Kicks", sets:4, reps:"40s", rest:30, vid:"pRZhSdw5Tqg", shape:"core_lower", tier:"easy"},
    {id:"mcx_bear", en:"Bear Crawl", sets:3, reps:"30s", rest:45, vid:"-9L3rTrYo4Q", shape:"core_obliques", tier:"medium"},
  ]},
];

const DAYS_FEMALE_CAL = [
  { id:"fc_push", label:"Push", muscles:"Push & Core", exercises:[
    {id:"fcp_pushup", en:"Push-ups", sets:3, reps:"8-15", rest:60, vid:"wD1M-f69Yy8", shape:"chest_mid", tier:"easy"},
    {id:"fcp_pike", en:"Pike Push-ups", sets:3, reps:"6-10", rest:60, vid:"shEnAXgc9y4", shape:"shoulder_front", tier:"medium"},
    {id:"fcp_dips", en:"Bench Dips", sets:3, reps:"8-12", rest:45, vid:"ekgvqS_4Ee4", shape:"triceps_lateral", tier:"easy"},
    {id:"fcp_plank", en:"Plank (core)", sets:3, reps:"30-45s", rest:30, vid:"fWW5d1ZFhk4", shape:"core_upper", tier:"medium"},
    {id:"fcp_hollow", en:"Hollow Body Hold", sets:3, reps:"15-30s", rest:30, vid:"Xk-JcNj6lfY", shape:"core_upper", tier:"medium"},
    {id:"fcp_mtn", en:"Mountain Climbers", sets:3, reps:"30s", rest:30, vid:"fpmWW6iXfes", shape:"core_lower", tier:"medium"},
  ]},
  { id:"fc_legs", label:"Legs", muscles:"Legs & Cardio", exercises:[
    {id:"fcl_squat", en:"Bodyweight Squats", sets:3, reps:"20-30", rest:45, vid:"3fl7uYmiMVw", shape:"quads", tier:"easy"},
    {id:"fcl_lunge", en:"Reverse Lunges", sets:3, reps:"10-14/leg", rest:45, vid:"ufjvjxrGyFM", shape:"quads", tier:"easy"},
    {id:"fcl_bridge", en:"Glute Bridge", sets:3, reps:"15-20", rest:30, vid:"12m6GW59LvQ", shape:"glutes", tier:"easy"},
    {id:"fcl_jump", en:"Squat Jumps", sets:3, reps:"8-12", rest:45, vid:"dX9bNPQeQa8", shape:"quads", tier:"hard"},
    {id:"fcl_calf", en:"Standing Calf Raise", sets:3, reps:"20-25", rest:30, vid:"B30JglFGx8Y", shape:"calves", tier:"easy"},
    {id:"fcl_burpee", en:"Burpees", sets:3, reps:"6-10", rest:60, vid:"DNHWxCUp8MY", shape:"core_lower", tier:"hard"},
  ]},
  { id:"fc_pull", label:"Pull", muscles:"Pull & Total Body", exercises:[
    {id:"fcx_row", en:"Inverted Row (under a table)", sets:3, reps:"6-12", rest:60, vid:"VO-pt_XgFho", shape:"back_lats", tier:"medium"},
    {id:"fcx_pullapart", en:"Band Pull-Apart", sets:3, reps:"15-20", rest:30, vid:"qi2y-eI_kuI", shape:"shoulder_rear", tier:"easy"},
    {id:"fcx_superman", en:"Superman", sets:3, reps:"12-15", rest:30, vid:"uexOGyxLr7E", shape:"back_lower", tier:"easy"},
    {id:"fcx_facepull", en:"Band Face Pull", sets:3, reps:"15-20", rest:30, vid:"C45c3fR4o28", shape:"shoulder_rear", tier:"easy"},
    {id:"fcx_flutter", en:"Flutter Kicks", sets:3, reps:"30s", rest:30, vid:"pRZhSdw5Tqg", shape:"core_lower", tier:"easy"},
    {id:"fcx_bear", en:"Bear Crawl", sets:3, reps:"20s", rest:45, vid:"-9L3rTrYo4Q", shape:"core_obliques", tier:"medium"},
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
  "Flutter Kicks":"رفرفة الرجلين","Bear Crawl":"زحف الدب"
};
const AR_DAY = {"Push":"دفع","Pull":"سحب","Legs":"أرجل","Upper":"علوي","Lower":"سفلي","Lower A":"سفلي أ","Upper A":"علوي أ","Lower B":"سفلي ب","Upper B":"علوي ب","Full-Body Starter":"تمرين شامل للمبتدئين",
  "Chest & Triceps A":"صدر وترايسبس أ","Back & Biceps A":"ظهر وبايسبس أ","Chest & Triceps B":"صدر وترايسبس ب","Back & Biceps B":"ظهر وبايسبس ب"};
const AR_MUS = {
  "Chest, Shoulders, Triceps":"صدر، أكتاف، ترايسبس","Back, Rear Delts, Biceps":"ظهر، أكتاف خلفية، بايسبس","Quads, Hamstrings, Calves":"أمامية الفخذ، خلفية الفخذ، سمانة",
  "Chest, Back, Delts, Arms":"صدر، ظهر، أكتاف، ذراعين","Quads, Glutes, Hamstrings, Abs":"أمامية الفخذ، ألوية، خلفية الفخذ، بطن","Glutes & Quads":"ألوية وأمامية الفخذ",
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
  "bicep curl":"Barbell Curl", "biceps curl":"Barbell Curl", "bicep curls":"Barbell Curl", "barbell bicep curl":"Barbell Curl",
  "dumbbell curl":"Incline Dumbbell Curl", "dumbbell bicep curl":"Incline Dumbbell Curl", "hammer curls":"Hammer Curl",
  "tricep extension":"Overhead Cable Triceps Extension", "triceps extension":"Overhead Cable Triceps Extension", "overhead tricep extension":"Overhead Cable Triceps Extension",
  "tricep pushdown":"Cable Rope Pushdown", "triceps pushdown":"Cable Rope Pushdown", "rope pushdown":"Cable Rope Pushdown",
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
  "chest fly":"Cable Chest Fly", "chest flys":"Cable Chest Fly", "chest flyes":"Cable Chest Fly", "dumbbell fly":"Cable Chest Fly", "pec deck":"Cable Chest Fly"
};
const EX_VID = (function(){
  const m = {};
  [DAYS_PREVIEW, DAYS_MALE, DAYS_FEMALE, DAYS_MALE_CAL, DAYS_FEMALE_CAL].forEach(set=>{
    set.forEach(d=> d.exercises.forEach(ex=>{
      if(!ex.vid) return;
      m[_normEx(ex.en)] = ex.vid;
      const ar = AR_EX[ex.en]; if(ar) m[_normEx(ar)] = ex.vid;
    }));
  });
  Object.keys(EX_ALIASES).forEach(alias=>{
    const vid = m[_normEx(EX_ALIASES[alias])];
    if(vid) m[_normEx(alias)] = vid;
  });
  return m;
})();
// Best-effort match: exact normalised name, else a contains match either way.
window.GymExerciseVideo = function(name){
  const n = _normEx(name);
  if(n.length < 4) return "";
  if(EX_VID[n]) return EX_VID[n];
  const keys = Object.keys(EX_VID);
  let hit = keys.find(k => k.length >= 6 && (n.indexOf(k) !== -1 || k.indexOf(n) !== -1));
  return hit ? EX_VID[hit] : "";
};
const T = {
  appTitle:["Etqadem","اتقدم"],
  obTitle:["Your AI coach, everywhere","مدرّبك الذكي في كل مكان"],
  obSub:["Plans, an AI coach that reads your InBody, a rest timer, form videos and progress that follows you across devices.","خطط، مدرّب ذكي يقرأ نتائج InBody، مؤقّت راحة، فيديوهات أداء، وتقدّم يتابعك عبر أجهزتك."],
  obStart:["Start Changing Yourself","ابدأ بتغيير نفسك"],
  obContinue:["Continue without signing in","المتابعة بدون تسجيل الدخول"],
  fxTagline:["Every rep counts.","كل تكرار يُحسب."],
  aeShowPw:["Show password","إظهار كلمة المرور"],
  obWhy:["Why sign in?","لماذا تسجّل الدخول؟"],
  obWhy1:["Keep progress across devices","احفظ تقدّمك عبر الأجهزة"],
  obWhy2:["All training days & important notes","كل أيام التمرين والملاحظات المهمة"],
  obWhy3:["A personalised AI coach","مدرّب ذكاء اصطناعي مخصّص"],
  resolvingSession:["Resolving your session…","جارٍ التحقق من جلستك…"],
  anonLockTitle:["Sign in to unlock everything","سجّل الدخول لفتح كل المزايا"],
  anonLockBody:["The full multi-day plans, important notes, cross-device sync and the AI coach are free with a Google account.","الخطط الكاملة متعددة الأيام، الملاحظات المهمة، المزامنة بين الأجهزة، ومدرّب الذكاء الاصطناعي — كلها مجانية مع حساب جوجل."],
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
  restLeft:["{n} of 2 rest days left this week","متبقي {n} من يومَي راحة هذا الأسبوع"],
  restHint:["A rest day keeps your streak but doesn't add to it.","يوم الراحة يحافظ على سلسلتك لكنه لا يضيف إليها."],
  restMarked:["Rest day saved","تم حفظ يوم الراحة"],
  restRemoved:["Rest day removed","تم إلغاء يوم الراحة"],
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
  queueDropped:["A workout from an earlier day wasn't saved. Only today and yesterday can be recorded.","لم يُحفظ تمرين من يوم سابق. يمكن تسجيل اليوم والأمس فقط."],
  hdrAccountMenu:["Account menu","قائمة الحساب"],
  hdrGoProfile:["Go to profile","الذهاب إلى الملف الشخصي"],
  hdrAdmin:["Admin dashboard","لوحة الإدارة"],
  hdrBlocked:["This account has been disabled. Contact support if you think this is a mistake.","تم تعطيل هذا الحساب. تواصل مع الدعم إذا كنت تعتقد أن هذا خطأ."],
  hdrRemoved:["This account was removed. Contact support if you think this is a mistake.","تمت إزالة هذا الحساب. تواصل مع الدعم إذا كنت تعتقد أن هذا خطأ."],
  hdrSignOut:["Sign out","تسجيل الخروج"],
  notifBell:["Notifications","الإشعارات"],
  notifBellUnread:["Notifications, {n} unread","الإشعارات، {n} غير مقروءة"],
  notifTitle:["Notifications","الإشعارات"],
  notifClose:["Close","إغلاق"],
  notifEmpty:["No notifications yet. Workout reminders will show up here.","لا توجد إشعارات بعد. ستظهر تذكيرات التمرين هنا."],
  notifLoadErr:["Couldn't load notifications. Check your connection and try again.","تعذّر تحميل الإشعارات. تحقّق من الاتصال وحاول مرة أخرى."],
  notifRetry:["Try again","حاول مرة أخرى"],
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
  installTip:['<b>Add this app to your home screen:</b> open your browser menu and choose "Add to Home Screen" so it opens like a regular app.','<b>أضِف التطبيق إلى الشاشة الرئيسية:</b> افتح قائمة المتصفح واختر "إضافة إلى الشاشة الرئيسية" ليعمل كتطبيق عادي.'],
  workoutTimer:["Workout Timer","مؤقّت التمرين"],
  notStarted:["Not started yet","لم يبدأ بعد"],
  startWorkout:["Start Workout","ابدأ التمرين"],
  endWorkout:["End Workout","أنهِ التمرين"],
  inProgress:["In progress…","جارٍ التنفيذ…"],
  pause:["Pause","إيقاف مؤقت"],
  resume:["Resume","استئناف"],
  paused:["Paused","متوقّف مؤقتاً"],
  lastSession:["Last {d} session: {n} min","آخر جلسة {d}: {n} دقيقة"],
  warmupTitle:["Warm-up — do this first","الإحماء — ابدأ به أولاً"],
  video:["Video","فيديو"], hideVideo:["Hide video","إخفاء الفيديو"],
  warmup1:["<b>Raise your temperature</b> — 5 min easy cardio (bike, incline walk or rower) until you break a light sweat.","<b>ارفع حرارة جسمك</b> — 5 دقائق كارديو خفيف (دراجة، مشي بميل، أو تجديف) حتى يتصبب عرق خفيف."],
  warmup2:["<b>Loosen the day's joints</b> — 5-8 slow reps each. Upper-body days: band pull-aparts, shoulder dislocates, arm circles, cat-cow. Lower-body days: leg swings front & side, hip circles, 10 bodyweight squats, walking lunges.","<b>حرّك مفاصل اليوم</b> — 5-8 تكرارات بطيئة لكل حركة. أيام الجزء العلوي: شد المطاط، تدوير الكتف والذراعين، القطة-البقرة. أيام الجزء السفلي: أرجحة الساق أماماً وجانباً، تدوير الورك، 10 سكوات بوزن الجسم، طعنات مشي."],
  warmup3:["<b>Ramp up the first lift only</b> — empty bar ×10, then ~50% ×5, ~70% ×3, ~85% ×1. Rest 60-90 s and stop each set well short of effort.","<b>تدرّج في التمرين الأول فقط</b> — بار فارغ ×10، ثم ~50% ×5، ~70% ×3، ~85% ×1. استرِح 60-90 ثانية وأوقف كل مجموعة قبل الإجهاد. (في الكاليسثينكس: مجموعة خفيفة واحدة من الحركة الأولى.)"],
  warmup4:["<b>Start working set 1.</b> Isolation moves (raises, curls, extensions) need just one light feeder set.","<b>ابدأ المجموعة الأولى الفعلية.</b> تمارين العزل (الرفرفة، المرجحة، التمديد) تحتاج مجموعة تحضيرية خفيفة واحدة فقط."],
  sets:["sets","مجموعات"], reps:["reps","تكرار"], rest:["rest","راحة"],
  save:["Save","حفظ"], saved:["✓ Saved","✓ تم الحفظ"], restBtn:["Rest","راحة"],
  lastLog:["Last: {w} kg × {r}","الأخير: {w} كجم × {r}"],
  noLog:["No log yet","لا يوجد سجل بعد"],
  wtPH:["wt","وزن"], repPH:["rep","عدد"],
  resetChecklist:["Reset today's checklist","إعادة ضبط قائمة اليوم"],
  resetToastMsg:["Today's checklist was reset.","تمت إعادة ضبط قائمة اليوم."],
  undo:["Undo","تراجع"],
  dayAlreadyDone:["This workout is already complete for today. Reset the checklist if you want to log it again.","اكتمل هذا التمرين لهذا اليوم بالفعل. أعد ضبط القائمة إذا أردت تسجيله مرة أخرى."],
  notesTitle:["Important Notes","ملاحظات مهمة"],
  skip:["Skip","تخطٍّ"],
  restTimer:["Rest — {name}","راحة — {name}"],
  exVideo:["Exercise video","فيديو التمرين"],
  settings:["Settings","الإعدادات"],
  planLabel:["Plan","الخطة"],
  programLabel:["Program","البرنامج"],
  prefsLabel:["Display preferences","تفضيلات العرض"],
  themeToDark:["Switch to dark mode","التبديل إلى الوضع الداكن"], themeToLight:["Switch to light mode","التبديل إلى الوضع الفاتح"],
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
    "<b>Weekly schedule:</b> Sat Legs · Sun Push · Mon Pull · Tue rest (football) · Wed Lower · Thu Upper · Fri rest. Every muscle 2×/week with 3-4 days between.",
    "<b>Progressive overload:</b> add a little weight or a rep once you hit the top of the rep range with clean form — beat last session's numbers (shown on each card).",
    "<b>Train close to failure:</b> stop compound sets 1-3 reps short; isolation moves 0-1.",
    "<b>Warm-up:</b> follow the warm-up card before your first set.",
    "<b>Core 3×/week:</b> hanging leg raise (Pull), Pallof press (Upper), cable crunch (Lower). Brace as if bracing for a punch.",
    "<b>Recover:</b> 7-9 h sleep. Football counts as leg load — keep it to Tuesday.",
    "<b>Deload</b> every 5-8 weeks: an easy week at ~⅔ the weight or half the sets.",
    "<b>Protein:</b> 1.6-2.2 g per kg body weight daily.",
    "Data is saved on this device only. Tap <b>Back up progress</b> every week or two."
  ], ar:[
    "<b>الجدول الأسبوعي:</b> السبت أرجل · الأحد دفع · الاثنين سحب · الثلاثاء راحة (كرة قدم) · الأربعاء سفلي · الخميس علوي · الجمعة راحة. كل عضلة مرتين أسبوعياً بفارق 3-4 أيام.",
    "<b>الزيادة التدريجية:</b> أضِف وزناً بسيطاً أو تكراراً عند بلوغ أعلى نطاق التكرار بأداء نظيف — تجاوز أرقام الجلسة السابقة (تظهر على كل بطاقة).",
    "<b>اقترب من الفشل:</b> أوقف تمارين المركّب قبل الفشل بـ1-3 تكرارات، وتمارين العزل بـ0-1.",
    "<b>الإحماء:</b> اتبع بطاقة الإحماء قبل مجموعتك الأولى.",
    "<b>البطن 3 مرات أسبوعياً:</b> رفع الرجلين معلقاً (سحب)، ضغط بالوف (علوي)، كرنش بالكابل (سفلي). شُدّ البطن كأنك تتلقى لكمة.",
    "<b>الاستشفاء:</b> نوم 7-9 ساعات. كرة القدم تُحسب حِملاً على الأرجل — اجعلها يوم الثلاثاء.",
    "<b>أسبوع تخفيف</b> كل 5-8 أسابيع: أسبوع سهل بثلثي الوزن أو نصف المجموعات تقريباً.",
    "<b>البروتين:</b> 1.6-2.2 جم لكل كجم من وزن الجسم يومياً.",
    "البيانات محفوظة على هذا الجهاز فقط. اضغط <b>نسخة احتياطية</b> كل أسبوع أو اثنين."
  ]},
  female_gym:{ en:[
    "<b>Weekly layout:</b> Sat Lower A · Sun Upper A · Tue Lower B · Wed Upper B. Other days: rest or a walk.",
    "<b>Goal — lean & tone:</b> the lifting keeps your muscle while a modest calorie deficit drives fat loss. Keep reps controlled.",
    "<b>Conditioning:</b> 7-9k steps a day plus 2-3 brisk/incline walks of 25-35 min. Optional 6-8 min finisher after Lower B or Upper B.",
    "<b>Progression:</b> add reps to the top of the range first, then a little weight. Keep 1-2 reps in reserve.",
    "<b>Form first:</b> single-leg moves are about control — go light until balance is steady.",
    "<b>Warm-up:</b> follow the warm-up card before your first set.",
    "<b>Nutrition:</b> follow your meal-timing plan; ~1.6-2 g protein per kg body weight daily.",
    "Data is saved on this device only. Tap <b>Back up progress</b> every week or two."
  ], ar:[
    "<b>التوزيع الأسبوعي:</b> السبت سفلي أ · الأحد علوي أ · الثلاثاء سفلي ب · الأربعاء علوي ب. باقي الأيام: راحة أو مشي.",
    "<b>الهدف — رشاقة وشدّ:</b> التمرين يحافظ على العضلات بينما عجز سعرات بسيط يحرق الدهون. حافظي على تحكّم في التكرارات.",
    "<b>الكارديو:</b> 7-9 آلاف خطوة يومياً مع 2-3 جلسات مشي سريع أو بميل 25-35 دقيقة. اختياري: خاتمة 6-8 دقائق بعد سفلي ب أو علوي ب.",
    "<b>التدرّج:</b> زيدي التكرارات لأعلى النطاق أولاً ثم وزناً بسيطاً. اتركي 1-2 تكرار احتياطياً.",
    "<b>الأداء أولاً:</b> تمارين الرجل الواحدة تتعلق بالتحكّم — ابدئي خفيفاً حتى يثبت التوازن.",
    "<b>الإحماء:</b> اتبعي بطاقة الإحماء قبل مجموعتك الأولى.",
    "<b>التغذية:</b> اتبعي خطة توقيت الوجبات؛ ~1.6-2 جم بروتين لكل كجم يومياً.",
    "البيانات محفوظة على هذا الجهاز فقط. اضغطي <b>نسخة احتياطية</b> كل أسبوع أو اثنين."
  ]},
  male_cal:{ en:[
    "<b>Weekly plan:</b> 3 days — Push · Legs · Pull. Run them on non-consecutive days (e.g. Sat / Mon / Wed).",
    "<b>Circuit style:</b> rest is short on purpose. The listed rest is the maximum, not a target — keep moving.",
    "<b>Reps:</b> take most sets close to failure but stop with 1-2 clean reps left. Add reps each week before adding difficulty.",
    "<b>Progress the hard moves:</b> when push-ups feel easy slow the lowering, then elevate the feet; for pike push-ups raise the hips higher.",
    "<b>Conditioning:</b> add a 20-30 min run, ruck or fast walk on 1-2 off days. Optional finisher: 5 rounds of 30 s burpees / 30 s rest.",
    "<b>Core is built in</b> (plank, hollow hold, flutter kicks, mountain climbers) — brace hard, don't hold your breath.",
    "<b>No pull-up bar needed:</b> inverted rows use a sturdy table edge; swap for band bent-over rows if that's easier.",
    "Data is saved on this device only. Back it up every week or two."
  ], ar:[
    "<b>الخطة الأسبوعية:</b> 3 أيام — دفع · أرجل · سحب. نفّذها في أيام غير متتالية (مثلاً السبت / الاثنين / الأربعاء).",
    "<b>أسلوب الدوائر:</b> الراحة قصيرة عن قصد. الراحة المذكورة حدّ أقصى وليست هدفاً — استمر في الحركة.",
    "<b>التكرارات:</b> اقترب من الفشل في معظم المجموعات مع ترك 1-2 تكرار نظيف. زِد التكرارات أسبوعياً قبل زيادة الصعوبة.",
    "<b>تدرّج في الحركات الصعبة:</b> عندما يسهل الضغط، أبطئ النزول ثم ارفع القدمين؛ ولضغط البايك ارفع الحوض أكثر.",
    "<b>الكارديو:</b> أضِف جري أو مشي سريع 20-30 دقيقة في يوم أو يومين راحة. اختياري: 5 جولات 30 ث بيربي / 30 ث راحة.",
    "<b>البطن مدمج</b> (بلانك، ثبات مجوف، رفرفة الرجلين، تسلق الجبل) — شُدّ البطن ولا تحبس نفسك.",
    "<b>لا حاجة لعقلة:</b> التجديف المقلوب يستخدم حافة طاولة ثابتة؛ بدّله بتجديف بالمطاط إن كان أسهل.",
    "البيانات محفوظة على هذا الجهاز فقط. اعمل نسخة احتياطية كل أسبوع أو اثنين."
  ]},
  female_cal:{ en:[
    "<b>Weekly plan:</b> 3 days — Push · Legs · Pull, on non-consecutive days (e.g. Sat / Mon / Wed).",
    "<b>Circuit style:</b> short rests on purpose — the listed rest is a maximum. Keep the pace up for the fat-loss effect.",
    "<b>Scale to your level:</b> drop to your knees or hands on a bench for push-ups until you can do 8+ clean reps; do step-back burpees with no jump.",
    "<b>Reps:</b> stop each set with 1-2 clean reps left; add reps weekly before making a move harder.",
    "<b>Conditioning:</b> 7-9k steps a day plus a 20-30 min brisk walk or light jog on 1-2 off days.",
    "<b>Core is built in</b> (plank, hollow hold, flutter kicks, mountain climbers) — brace, breathe, no yanking with the hip flexors.",
    "<b>No bar needed:</b> inverted rows use a sturdy table; a band bent-over row works too.",
    "Data is saved on this device only. Back it up every week or two."
  ], ar:[
    "<b>الخطة الأسبوعية:</b> 3 أيام — دفع · أرجل · سحب، في أيام غير متتالية (مثلاً السبت / الاثنين / الأربعاء).",
    "<b>أسلوب الدوائر:</b> الراحة قصيرة عن قصد — المذكور حدّ أقصى. حافظي على الإيقاع لتحقيق حرق الدهون.",
    "<b>عدّلي حسب مستواكِ:</b> انزلي على الركبتين أو ضعي اليدين على مقعد في الضغط حتى تؤدّي 8+ تكرارات نظيفة؛ ونفّذي البيربي بخطوة للخلف دون قفز.",
    "<b>التكرارات:</b> أنهي كل مجموعة وأنتِ تملكين 1-2 تكرار نظيف؛ زيدي التكرارات أسبوعياً قبل زيادة الصعوبة.",
    "<b>الكارديو:</b> 7-9 آلاف خطوة يومياً مع مشي سريع أو هرولة خفيفة 20-30 دقيقة في يوم أو يومين راحة.",
    "<b>البطن مدمج</b> (بلانك، ثبات مجوف، رفرفة الرجلين، تسلق الجبل) — شُدّي البطن، تنفّسي، دون شدّ بعضلات الورك.",
    "<b>لا حاجة لعقلة:</b> التجديف المقلوب يستخدم طاولة ثابتة؛ ويصلح أيضاً تجديف بالمطاط.",
    "البيانات محفوظة على هذا الجهاز فقط. اعملي نسخة احتياطية كل أسبوع أو اثنين."
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

// ---------------- PLAN + STYLE + LANG STATE ----------------
let activePlan  = localStorage.getItem("gym_plan");                 // "male" | "female" | null (first run)
let activeStyle = localStorage.getItem("gym_style") || "gym";       // "gym" | "cal"
let activeLang  = localStorage.getItem("gym_lang")  || "en";        // "en" | "ar"

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
  const fem = activePlan === "female";
  if(activeStyle === "cal") return fem ? DAYS_FEMALE_CAL : DAYS_MALE_CAL;
  return fem ? DAYS_FEMALE : DAYS_MALE;
}
let DAYS = pickDays();

// Read-only accessor for calendar.js — DAYS is otherwise module-private, and
// the calendar needs a day's exercise list to compute done===total locally.
window.GymApp = window.GymApp || {};
window.GymApp.dayExercises = function(dayId){
  const day = DAYS.find(d=>d.id===dayId);
  return day ? day.exercises : [];
};
// Marks every exercise of a past day's checklist as done (rest-days.js "save
// yesterday"). Goes through the in-memory `checks` so the next toggle's
// saveJSON doesn't overwrite it with a stale copy.
window.GymApp.markDayComplete = function(date, dayId){
  const day = DAYS.find(d=>d.id===dayId);
  if(!day) return;
  const k = date + "_" + dayId;
  checks[k] = checks[k] || {};
  day.exercises.forEach(ex=>{ checks[k][ex.id] = true; });
  saveJSON("gym_checks", checks);
};
// Localised day label for dayId (used by the save-yesterday sheet).
window.GymApp.dayName = function(dayId){
  const day = DAYS.find(d=>d.id===dayId);
  return day ? dayLabel(day) : "";
};

function t(key){ const e = T[key]; return e ? (e[activeLang === "ar" ? 1 : 0]) : key; }
function exName(ex){ return activeLang === "ar" ? (AR_EX[ex.en] || ex.en) : ex.en; }
function dayLabel(d){ return activeLang === "ar" ? (AR_DAY[d.label] || d.label) : d.label; }
function musLabel(d){ return activeLang === "ar" ? (AR_MUS[d.muscles] || d.muscles) : d.muscles; }
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
  const rotatable = DAYS === DAYS_MALE || DAYS === DAYS_FEMALE || DAYS === DAYS_MALE_CAL || DAYS === DAYS_FEMALE_CAL;
  if(!rotatable) return;
  const last = loadJSON("gymday_last_completed", null);
  if(!last || !last.dayId || last.date === todayStr()) return; // nothing to do, or completed today (not "the day after" yet)
  const idx = DAYS.findIndex(d=>d.id===last.dayId);
  if(idx === -1) return; // that day isn't part of the currently active plan
  activeDay = DAYS[(idx + 1) % DAYS.length].id;
  setPref(activeDayStoreKey(), activeDay);
  localStorage.removeItem("gymday_last_completed");
})();

let openVideoId = null; // which exercise currently has an inline player mounted
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
  if(wrap)  wrap.classList.remove("open");
  if(frame) frame.innerHTML = "";
  const btn = document.querySelector(`[data-video="${id}"]`);
  if(btn){ btn.classList.remove("on"); btn.innerHTML = videoBtnInner(false); }
}

function renderExercises(){
  const day = DAYS.find(d=>d.id===activeDay);
  dayMuscles.textContent = dayLabel(day) + " — " + musLabel(day);
  const key = sessionKey(day.id);
  const dayChecks = checks[key] || {};

  exList.innerHTML = "";
  day.exercises.forEach((ex, i)=>{
    const done = !!dayChecks[ex.id];
    const isOpen = openVideoId === ex.id;
    const card = document.createElement("div");
    card.className = "ex-card" + (done ? " done" : "") + (animateCards ? " anim-in" : "");
    if(animateCards) card.style.animationDelay = (i * 45) + "ms";

    const last = lastLog(ex.id);
    const esc = GymUI.esc;
    const lastText = esc(last ? t("lastLog").replace("{w}", last.w).replace("{r}", last.r) : t("noLog"));
    const nm = esc(exName(ex));
    const eid = esc(ex.id);
    const hasVid = !!ex.vid; // coach-generated plans have no demo clip

    card.innerHTML = `
      <div class="ex-top">
        <div class="check ${done?'on':''}" data-id="${eid}">
          <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
        </div>
        <div class="ex-title">
          <div class="en">${nm}</div>
        </div>
      </div>
      <div class="ex-meta">
        <span><b>${esc(ex.sets)}</b> ${t("sets")}</span>
        <span><b>${esc(ex.reps)}</b> ${t("reps")}</span>
        <span><b>${esc(ex.rest)}s</b> ${t("rest")}</span>
      </div>
      <div class="ex-actions">
        <div class="log-box">
          <span class="log-field">
            <input type="number" inputmode="decimal" placeholder="${esc(last?last.w:t('wtPH'))}" data-w="${eid}">
            <span class="unit">kg</span>
          </span>
          <span class="log-field">
            <input type="number" inputmode="numeric" placeholder="${esc(last?last.r:t('repPH'))}" data-r="${eid}">
            <span class="unit">${t('reps')}</span>
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
        </button>` : ``}
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
  animateCards = false;

  // --- checkbox: flip just this card, no list rebuild ---
  exList.querySelectorAll(".check").forEach(el=>{
    el.onclick = ()=>{
      const id = el.dataset.id;
      const k = sessionKey(activeDay);
      const wasComplete = isDayComplete(activeDay);
      checks[k] = checks[k] || {};
      checks[k][id] = !checks[k][id];
      saveJSON("gym_checks", checks);
      const on = !!checks[k][id];
      el.classList.toggle("on", on);
      if(on && window.GymMotion) GymMotion.pop(el);
      const card = el.closest(".ex-card");
      if(card) card.classList.toggle("done", on);
      updateProgress();
      // Record the moment this day's checklist *transitions* to complete
      // (not on every click once already complete) so applyDayRotation()
      // can auto-select the next day in rotation on a later day's visit.
      if(!wasComplete && isDayComplete(activeDay)){
        saveJSON("gymday_last_completed", { date: todayStr(), dayId: activeDay });
      }
      if(window.GymCalendar && typeof window.GymCalendar.onCheckChanged === "function"){
        window.GymCalendar.onCheckChanged(activeDay, todayStr());
      }
    };
  });

  // --- save weight: update this card in place, no list rebuild ---
  exList.querySelectorAll("[data-save]").forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.save;
      const wInput = exList.querySelector(`[data-w="${id}"]`);
      const rInput = exList.querySelector(`[data-r="${id}"]`);
      const w = wInput.value || wInput.placeholder;
      const r = rInput.value || rInput.placeholder;
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
        wrap.classList.add("open");
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
  updateProgress();
  updateSessionUI();
  renderNotes();
  applyAnonUI();
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
  DAYS = pickDays();
  activeDay = localStorage.getItem(activeDayStoreKey()) || DAYS[0].id;
  if(!DAYS.some(d=>d.id===activeDay)) activeDay = DAYS[0].id;
  animateCards = true;
  renderAll();
};

// P1-8: no more blocking native confirm() — reset happens immediately, with
// an "Undo" toast (shared .gym-toast component, toast.js) instead of asking
// first. The data at risk is same-day checklist state, not history, so
// undo-after-the-fact is the right friction level (matches §4.6).
document.getElementById("resetLink").onclick = ()=>{
  const dayKey = sessionKey(activeDay);
  const prevChecks = checks[dayKey];
  if(prevChecks === undefined) return; // nothing to reset
  delete checks[dayKey];
  saveJSON("gym_checks", checks);
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
  videoModal.classList.add("show");
}
function closeVideoModal(){
  modalFrame.innerHTML = ""; // stop playback
  videoModal.classList.remove("show");
}
document.getElementById("modalClose").onclick = closeVideoModal;
videoModal.addEventListener("click", (e)=>{ if(e.target === videoModal) closeVideoModal(); });

// ---------------- REST TIMER (between sets) ----------------
let restInterval = null;
const timerBar = document.getElementById("timerBar");
const timerTime = document.getElementById("timerTime");
const timerLabel = document.getElementById("timerLabel");
const timerFill = document.getElementById("timerFill");

function startRestTimer(seconds, name){
  if (isDayComplete(activeDay)) { alert(t("dayAlreadyDone")); return; }
  clearInterval(restInterval);
  let remaining = seconds;
  const total = seconds;
  timerLabel.textContent = t("restTimer").replace("{name}", name);
  timerBar.classList.add("show");
  // Jump to full without animating the bar back up from the previous timer.
  timerFill.style.transition = "none";
  renderRestTime(remaining, total);
  void timerFill.offsetWidth;
  timerFill.style.transition = "";

  restInterval = setInterval(()=>{
    remaining -= 1;
    renderRestTime(remaining, total);
    if(remaining <= 0){
      clearInterval(restInterval);
      timerBar.classList.remove("show");
      if(navigator.vibrate) navigator.vibrate([200,100,200]);
      beep();
    }
  }, 1000);
}
function renderRestTime(remaining, total){
  const m = Math.max(0,Math.floor(remaining/60)).toString().padStart(2,"0");
  const s = Math.max(0,remaining%60).toString().padStart(2,"0");
  timerTime.textContent = `${m}:${s}`;
  timerFill.style.setProperty("--p", Math.max(0, remaining/total));
}
document.getElementById("timerSkip").onclick = ()=>{
  clearInterval(restInterval);
  timerBar.classList.remove("show");
};
function beep(){
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  }catch(e){}
}

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
    const open = !wrap.classList.contains("open");
    wrap.classList.toggle("open", open);
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

// ---------------- DAY TABS (always-visible chip strip on the Plan screen) ----------------
function renderDayTabs(){
  const list = document.getElementById("dayTabs");
  if(!list) return;
  list.innerHTML = "";
  DAYS.forEach(d=>{
    const b = document.createElement("button");
    b.type = "button";
    b.className = "day-chip";
    b.textContent = dayLabel(d);
    if(d.id === activeDay){ b.classList.add("active"); b.setAttribute("aria-current","true"); }
    b.onclick = ()=>{
      if(d.id === activeDay) return;
      activeDay = d.id;
      setPref(activeDayStoreKey(), activeDay);
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
  activeStyle = style;
  applyState(true);
  if(window.GymUI) window.GymUI.navigate("plan");
  else window.scrollTo(0, 0);
}

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
  const styleWord = t(activeStyle === "cal" ? "styleCal" : "styleGym");
  const full = t("appTitle") + " · " + planWord + " · " + styleWord;
  document.getElementById("appTitleEl").textContent = full;
  document.title = t("appTitle") + " · " + planWord + " · " + styleWord;
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
document.getElementById("themeBtn").onclick = ()=>{
  const dark = document.documentElement.dataset.theme !== "light";
  if(window.GymTheme) window.GymTheme.setMode(dark ? "light" : "dark");
  renderThemePrefs();
};
document.getElementById("langBtn").onclick = ()=> applyLang(activeLang === "ar" ? "en" : "ar", true);

// ---------------- INIT ----------------
document.documentElement.lang = activeLang === "ar" ? "ar" : "en";
document.documentElement.dir  = activeLang === "ar" ? "rtl" : "ltr";
applyStaticI18n();
// No plan picked yet renders the male/gym default without persisting it:
// writing gym_plan here would stamp a fresh local timestamp and win the
// next sync merge over the plan this account already saved server-side.
applyState(false);
