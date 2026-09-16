// ---------------- DATA ----------------
// Shown to signed-out ("anonymous") users: one general full-body day.
// Mirrors data.preview in gym-be/internal/plans/plans.seed.json.
const DAYS_PREVIEW = [
  { id:"preview", label:"Full-Body Starter", muscles:"Full body", exercises:[
    {id:"pv_legpress", en:"Leg Press", sets:3, reps:"10-12", rest:120, vid:"nDh_BlnLCGc"},
    {id:"pv_dbbench", en:"Dumbbell Bench Press", sets:3, reps:"8-12", rest:90, vid:"Gf65Yy0-wGI"},
    {id:"pv_cablerow", en:"Seated Cable Row", sets:3, reps:"10-12", rest:90, vid:"8QuMq1GMMng"},
    {id:"pv_ohp", en:"Seated Dumbbell Shoulder Press", sets:3, reps:"10-12", rest:75, vid:"k6tzKisR3NY"},
    {id:"pv_legcurl", en:"Lying Leg Curl", sets:3, reps:"12-15", rest:60, vid:"bgfHeL6eR9Q"},
    {id:"pv_plank", en:"Plank (core)", sets:3, reps:"30-45s", rest:45, vid:"fWW5d1ZFhk4"},
  ]},
];
// 4-day split: Chest+Triceps / Back+Biceps / rest / repeat with different
// moves. Each day: 3 moves for the paired push/pull muscle, 2 for the other,
// 2 leg moves and 1 core move — the "B" days reuse the same pairing with a
// different exercise selection so the week doesn't repeat a single move.
// One exception: the catalog only has 5 unique chest-exercise videos (needs
// 6 for a fully-distinct A/B split), so Cable Chest Fly is the one move
// repeated between Chest & Triceps A and B — everything else across all 4
// days is unique.
const DAYS_MALE = [
  { id:"ct_a", label:"Chest & Triceps A", muscles:"Chest, Triceps, Legs, Core", exercises:[
    {id:"cta_bench", en:"Barbell Bench Press", sets:4, reps:"6-8", rest:150, vid:"0cXAp6WhSj4"},
    {id:"cta_incline", en:"Incline Dumbbell Press", sets:3, reps:"8-10", rest:120, vid:"8fXfwG4ftaQ"},
    {id:"cta_fly", en:"Cable Chest Fly", sets:3, reps:"12-15", rest:60, vid:"I-Ue34qLxc4"},
    {id:"cta_ohext", en:"Overhead Cable Triceps Extension", sets:3, reps:"10-15", rest:60, vid:"tPIWaCKWFF8"},
    {id:"cta_pushdown", en:"Cable Rope Pushdown", sets:3, reps:"12-15", rest:45, vid:"7OF77JMEXhM"},
    {id:"cta_squat", en:"Barbell Back Squat", sets:4, reps:"6-8", rest:150, vid:"tNUq6b5t11Q"},
    {id:"cta_legpress", en:"Leg Press", sets:3, reps:"10-12", rest:120, vid:"nDh_BlnLCGc"},
    {id:"cta_core", en:"Hanging Leg Raise (core)", sets:3, reps:"10-15", rest:45, vid:"0wSUjj5j1xo"},
  ]},
  { id:"bb_a", label:"Back & Biceps A", muscles:"Back, Biceps, Legs, Core", exercises:[
    {id:"bba_lat", en:"Lat Pulldown / Pull-up", sets:4, reps:"8-10", rest:120, vid:"bNmvKpJSWKM"},
    {id:"bba_csrow", en:"Chest-Supported Row", sets:4, reps:"8-10", rest:90, vid:"uhwcRYpkjvc"},
    {id:"bba_cablerow", en:"Seated Cable Row", sets:3, reps:"10-12", rest:75, vid:"8QuMq1GMMng"},
    {id:"bba_curl", en:"Barbell Curl", sets:3, reps:"10-12", rest:60, vid:"9_ijHhcwlkM"},
    {id:"bba_inclcurl", en:"Incline Dumbbell Curl", sets:3, reps:"10-12", rest:45, vid:"XhIsIcjIbCw"},
    {id:"bba_rdl", en:"Barbell Romanian Deadlift", sets:3, reps:"8-10", rest:90, vid:"zdip4iexlxg"},
    {id:"bba_legcurl", en:"Lying Leg Curl", sets:3, reps:"12-15", rest:60, vid:"bgfHeL6eR9Q"},
    {id:"bba_core", en:"Pallof Press (core)", sets:3, reps:"12/side", rest:45, vid:"P1H4IzD9rbQ"},
  ]},
  { id:"ct_b", label:"Chest & Triceps B", muscles:"Chest, Triceps, Legs, Core", exercises:[
    {id:"ctb_dbbench", en:"Dumbbell Bench Press", sets:3, reps:"8-10", rest:90, vid:"Gf65Yy0-wGI"},
    {id:"ctb_pushup", en:"Push-ups", sets:4, reps:"12-20", rest:60, vid:"wD1M-f69Yy8"},
    {id:"ctb_fly", en:"Cable Chest Fly", sets:3, reps:"12-15", rest:60, vid:"I-Ue34qLxc4"},
    {id:"ctb_dips", en:"Bench Dips", sets:3, reps:"12-18", rest:45, vid:"ekgvqS_4Ee4"},
    {id:"ctb_super", en:"Biceps + Triceps Superset", sets:3, reps:"12-15", rest:60, vid:"8UIbEovL-xU"},
    {id:"ctb_hack", en:"Hack Squat", sets:4, reps:"8-10", rest:120, vid:"g9i05umL5vc"},
    {id:"ctb_legext", en:"Leg Extension", sets:3, reps:"15-20", rest:60, vid:"iQ92TuvBqRo"},
    {id:"ctb_core", en:"Weighted Cable Crunch (core)", sets:3, reps:"12-15", rest:45, vid:"Bvhz7Rfnrr4"},
  ]},
  { id:"bb_b", label:"Back & Biceps B", muscles:"Back, Biceps, Legs, Core", exercises:[
    {id:"bbb_tbar", en:"T-Bar Row", sets:3, reps:"8-10", rest:90, vid:"1iQSSqin3ro"},
    {id:"bbb_onearm", en:"One-Arm Dumbbell Row", sets:3, reps:"12-15/arm", rest:45, vid:"H8jf3DwlIlo"},
    {id:"bbb_csdbrow", en:"Chest-Supported Dumbbell Row", sets:3, reps:"12-15", rest:45, vid:"09wri23R4SU"},
    {id:"bbb_hammer", en:"Hammer Curl", sets:3, reps:"12-15", rest:30, vid:"K9LiwcGuqA0"},
    {id:"bbb_super", en:"Biceps Curl + Triceps Extension (superset)", sets:3, reps:"12-15", rest:60, vid:"8UIbEovL-xU"},
    {id:"bbb_bss", en:"Bulgarian Split Squat", sets:3, reps:"10-12/leg", rest:75, vid:"uODWo4YqbT8"},
    {id:"bbb_seatcurl", en:"Seated Leg Curl", sets:3, reps:"12-15", rest:60, vid:"xdbEG3xGLI8"},
    {id:"bbb_core", en:"Plank (core)", sets:3, reps:"30-45s", rest:30, vid:"fWW5d1ZFhk4"},
  ]},
];

const DAYS_FEMALE = [
  { id:"f_lowerA", label:"Lower A", muscles:"Glutes & Quads", exercises:[
    {id:"fla_goblet", en:"Goblet Squat", sets:3, reps:"12-15", rest:60, vid:"0OWbS1WiUGU"},
    {id:"fla_rdl", en:"Dumbbell Romanian Deadlift", sets:3, reps:"12-15", rest:60, vid:"hu3jRvTc_po"},
    {id:"fla_lunge", en:"Reverse Lunge (Dumbbell)", sets:3, reps:"10-12/leg", rest:60, vid:"YXL_f378hLM"},
    {id:"fla_bridge", en:"Dumbbell Glute Bridge", sets:3, reps:"15-20", rest:45, vid:"12m6GW59LvQ"},
    {id:"fla_calf", en:"Standing Calf Raise", sets:3, reps:"15-20", rest:30, vid:"B30JglFGx8Y"},
    {id:"fla_deadbug", en:"Dead Bug (core)", sets:3, reps:"10-12/side", rest:30, vid:"XcYtWYMz39w"},
  ]},
  { id:"f_upperA", label:"Upper A", muscles:"Push focus", exercises:[
    {id:"fua_bench", en:"Dumbbell Bench Press", sets:3, reps:"10-12", rest:60, vid:"Gf65Yy0-wGI"},
    {id:"fua_row", en:"One-Arm Dumbbell Row", sets:3, reps:"12-15/arm", rest:45, vid:"H8jf3DwlIlo"},
    {id:"fua_press", en:"Seated Dumbbell Shoulder Press", sets:3, reps:"12-15", rest:45, vid:"k6tzKisR3NY"},
    {id:"fua_pullapart", en:"Band Pull-Apart", sets:3, reps:"15-20", rest:30, vid:"qi2y-eI_kuI"},
    {id:"fua_lateral", en:"Dumbbell Lateral Raise", sets:3, reps:"15-20", rest:30, vid:"Kl3LEzQ5Zqs"},
    {id:"fua_arms", en:"Biceps Curl + Triceps Extension (superset)", sets:3, reps:"12-15", rest:45, vid:"8UIbEovL-xU"},
  ]},
  { id:"f_lowerB", label:"Lower B", muscles:"Hamstrings & Glutes", exercises:[
    {id:"flb_sumo", en:"Dumbbell Sumo Squat", sets:3, reps:"12-15", rest:60, vid:"bRCjBCtBGIo"},
    {id:"flb_sldl", en:"Single-Leg Dumbbell RDL", sets:3, reps:"10-12/leg", rest:45, vid:"kQf5g0y0mO4"},
    {id:"flb_bss", en:"Bulgarian Split Squat", sets:3, reps:"10-12/leg", rest:60, vid:"uODWo4YqbT8"},
    {id:"flb_kickback", en:"Band Glute Kickback", sets:3, reps:"15-20/leg", rest:30, vid:"aw9WClmz5jw"},
    {id:"flb_calf", en:"Seated Calf Raise (Dumbbell)", sets:3, reps:"15-20", rest:30, vid:"NrHJPauB01I"},
    {id:"flb_legraise", en:"Lying Leg Raise (core)", sets:3, reps:"12-15", rest:30, vid:"jrSWj0huh5o"},
  ]},
  { id:"f_upperB", label:"Upper B", muscles:"Pull focus & core", exercises:[
    {id:"fub_incline", en:"Incline Dumbbell Press", sets:3, reps:"12-15", rest:60, vid:"8fXfwG4ftaQ"},
    {id:"fub_row", en:"Chest-Supported Dumbbell Row", sets:3, reps:"12-15", rest:45, vid:"09wri23R4SU"},
    {id:"fub_arnold", en:"Arnold Press", sets:3, reps:"12-15", rest:45, vid:"AjB-UXErljM"},
    {id:"fub_facepull", en:"Band Face Pull", sets:3, reps:"15-20", rest:30, vid:"C45c3fR4o28"},
    {id:"fub_hammer", en:"Hammer Curl", sets:3, reps:"12-15", rest:30, vid:"K9LiwcGuqA0"},
    {id:"fub_plank", en:"Plank (core)", sets:3, reps:"30-45s", rest:30, vid:"fWW5d1ZFhk4"},
  ]},
];

// ---- Military calisthenics: 3 days, no equipment (bands + a sturdy table). Shared moves, scaled reps. ----
const DAYS_MALE_CAL = [
  { id:"mc_push", label:"Push", muscles:"Push & Core", exercises:[
    {id:"mcp_pushup", en:"Push-ups", sets:4, reps:"12-20", rest:60, vid:"wD1M-f69Yy8"},
    {id:"mcp_pike", en:"Pike Push-ups", sets:3, reps:"8-12", rest:60, vid:"shEnAXgc9y4"},
    {id:"mcp_dips", en:"Bench Dips", sets:3, reps:"12-18", rest:45, vid:"ekgvqS_4Ee4"},
    {id:"mcp_plank", en:"Plank (core)", sets:3, reps:"45-60s", rest:30, vid:"fWW5d1ZFhk4"},
    {id:"mcp_hollow", en:"Hollow Body Hold", sets:3, reps:"25-40s", rest:30, vid:"Xk-JcNj6lfY"},
    {id:"mcp_mtn", en:"Mountain Climbers", sets:4, reps:"40s", rest:30, vid:"fpmWW6iXfes"},
  ]},
  { id:"mc_legs", label:"Legs", muscles:"Legs & Cardio", exercises:[
    {id:"mcl_squat", en:"Bodyweight Squats", sets:4, reps:"25-35", rest:45, vid:"3fl7uYmiMVw"},
    {id:"mcl_lunge", en:"Reverse Lunges", sets:3, reps:"12-16/leg", rest:45, vid:"ufjvjxrGyFM"},
    {id:"mcl_bridge", en:"Glute Bridge", sets:3, reps:"20-25", rest:30, vid:"12m6GW59LvQ"},
    {id:"mcl_jump", en:"Squat Jumps", sets:4, reps:"12-15", rest:45, vid:"dX9bNPQeQa8"},
    {id:"mcl_calf", en:"Standing Calf Raise", sets:3, reps:"25-30", rest:30, vid:"B30JglFGx8Y"},
    {id:"mcl_burpee", en:"Burpees", sets:5, reps:"10-15", rest:60, vid:"DNHWxCUp8MY"},
  ]},
  { id:"mc_pull", label:"Pull", muscles:"Pull & Total Body", exercises:[
    {id:"mcx_row", en:"Inverted Row (under a table)", sets:4, reps:"10-15", rest:60, vid:"VO-pt_XgFho"},
    {id:"mcx_pullapart", en:"Band Pull-Apart", sets:3, reps:"20-25", rest:30, vid:"qi2y-eI_kuI"},
    {id:"mcx_superman", en:"Superman", sets:3, reps:"15-20", rest:30, vid:"uexOGyxLr7E"},
    {id:"mcx_facepull", en:"Band Face Pull", sets:3, reps:"15-20", rest:30, vid:"C45c3fR4o28"},
    {id:"mcx_flutter", en:"Flutter Kicks", sets:4, reps:"40s", rest:30, vid:"pRZhSdw5Tqg"},
    {id:"mcx_bear", en:"Bear Crawl", sets:3, reps:"30s", rest:45, vid:"-9L3rTrYo4Q"},
  ]},
];

const DAYS_FEMALE_CAL = [
  { id:"fc_push", label:"Push", muscles:"Push & Core", exercises:[
    {id:"fcp_pushup", en:"Push-ups", sets:3, reps:"8-15", rest:60, vid:"wD1M-f69Yy8"},
    {id:"fcp_pike", en:"Pike Push-ups", sets:3, reps:"6-10", rest:60, vid:"shEnAXgc9y4"},
    {id:"fcp_dips", en:"Bench Dips", sets:3, reps:"8-12", rest:45, vid:"ekgvqS_4Ee4"},
    {id:"fcp_plank", en:"Plank (core)", sets:3, reps:"30-45s", rest:30, vid:"fWW5d1ZFhk4"},
    {id:"fcp_hollow", en:"Hollow Body Hold", sets:3, reps:"15-30s", rest:30, vid:"Xk-JcNj6lfY"},
    {id:"fcp_mtn", en:"Mountain Climbers", sets:3, reps:"30s", rest:30, vid:"fpmWW6iXfes"},
  ]},
  { id:"fc_legs", label:"Legs", muscles:"Legs & Cardio", exercises:[
    {id:"fcl_squat", en:"Bodyweight Squats", sets:3, reps:"20-30", rest:45, vid:"3fl7uYmiMVw"},
    {id:"fcl_lunge", en:"Reverse Lunges", sets:3, reps:"10-14/leg", rest:45, vid:"ufjvjxrGyFM"},
    {id:"fcl_bridge", en:"Glute Bridge", sets:3, reps:"15-20", rest:30, vid:"12m6GW59LvQ"},
    {id:"fcl_jump", en:"Squat Jumps", sets:3, reps:"8-12", rest:45, vid:"dX9bNPQeQa8"},
    {id:"fcl_calf", en:"Standing Calf Raise", sets:3, reps:"20-25", rest:30, vid:"B30JglFGx8Y"},
    {id:"fcl_burpee", en:"Burpees", sets:3, reps:"6-10", rest:60, vid:"DNHWxCUp8MY"},
  ]},
  { id:"fc_pull", label:"Pull", muscles:"Pull & Total Body", exercises:[
    {id:"fcx_row", en:"Inverted Row (under a table)", sets:3, reps:"6-12", rest:60, vid:"VO-pt_XgFho"},
    {id:"fcx_pullapart", en:"Band Pull-Apart", sets:3, reps:"15-20", rest:30, vid:"qi2y-eI_kuI"},
    {id:"fcx_superman", en:"Superman", sets:3, reps:"12-15", rest:30, vid:"uexOGyxLr7E"},
    {id:"fcx_facepull", en:"Band Face Pull", sets:3, reps:"15-20", rest:30, vid:"C45c3fR4o28"},
    {id:"fcx_flutter", en:"Flutter Kicks", sets:3, reps:"30s", rest:30, vid:"pRZhSdw5Tqg"},
    {id:"fcx_bear", en:"Bear Crawl", sets:3, reps:"20s", rest:45, vid:"-9L3rTrYo4Q"},
  ]},
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
  appTitle:["Muscle Building Plan","خطة بناء العضلات"],
  obTitle:["Your workout, everywhere","تمرينك في كل مكان"],
  obSub:["Plans, a rest timer, form videos and progress that follows you across devices.","خطط، مؤقّت راحة، فيديوهات أداء، وتقدّم يتابعك عبر أجهزتك."],
  obContinue:["Continue without an account","المتابعة بدون حساب"],
  obWhy:["Why sign in?","لماذا تسجّل الدخول؟"],
  obWhy1:["Keep progress across devices","احفظ تقدّمك عبر الأجهزة"],
  obWhy2:["All training days & important notes","كل أيام التمرين والملاحظات المهمة"],
  obWhy3:["A personalised AI coach","مدرّب ذكاء اصطناعي مخصّص"],
  anonLockTitle:["Sign in to unlock everything","سجّل الدخول لفتح كل المزايا"],
  anonLockBody:["The full multi-day plans, important notes, cross-device sync and the AI coach are free with a Google account.","الخطط الكاملة متعددة الأيام، الملاحظات المهمة، المزامنة بين الأجهزة، ومدرّب الذكاء الاصطناعي — كلها مجانية مع حساب جوجل."],
  anonSignIn:["Sign in with Google","سجّل الدخول عبر جوجل"],
  chooseTitle:["Choose your plan","اختر خطتك"],
  chooseSub:["You can switch anytime from the top of the app.","يمكنك التبديل في أي وقت من أعلى التطبيق."],
  chooseStyleTitle:["Choose your workout type","اختر نوع تمرينك"],
  back:["Back","رجوع"],
  male:["Male","رجالي"], maleSub:["4-day gym plan","خطة 4 أيام في الجيم"],
  female:["Female","نسائي"], femaleSub:["4-day home plan","خطة 4 أيام في المنزل"],
  styleGym:["Gym","جيم"], styleCal:["In-House / Bodyweight","منزلي / وزن الجسم"],
  langBtn:["العربية","English"],
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
  resetConfirm:["Reset today's checklist for this workout?","إعادة ضبط قائمة اليوم لهذا التمرين؟"],
  dayAlreadyDone:["This workout is already complete for today. Reset the checklist if you want to log it again.","اكتمل هذا التمرين لهذا اليوم بالفعل. أعد ضبط القائمة إذا أردت تسجيله مرة أخرى."],
  notesTitle:["Important Notes","ملاحظات مهمة"],
  skip:["Skip","تخطٍّ"],
  restTimer:["Rest — {name}","راحة — {name}"],
  exVideo:["Exercise video","فيديو التمرين"],
  settings:["Settings","الإعدادات"],
  planLabel:["Plan","الخطة"],
  programLabel:["Program","البرنامج"],
  langLabel:["Language","اللغة"],
  daysLabel:["Days","الأيام"],
  navPlan:["Plan","الخطة"],
  navCoach:["Coach","المدرّب"],
  navMore:["More","المزيد"],
  coachTitle:["AI Coach","المدرّب الذكي"],
  coachSub:["A diet & training plan built from your numbers","خطة تغذية وتمرين مبنية على أرقامك"],
  styleCoach:["Coach plan","خطة المدرّب"]
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

// ---------------- PLAN + STYLE + LANG STATE ----------------
let activePlan  = localStorage.getItem("gym_plan");                 // "male" | "female" | null (first run)
let activeStyle = localStorage.getItem("gym_style") || "gym";       // "gym" | "cal"
let activeLang  = localStorage.getItem("gym_lang")  || "en";        // "en" | "ar"

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

function t(key){ const e = T[key]; return e ? (e[activeLang === "ar" ? 1 : 0]) : key; }
function exName(ex){ return activeLang === "ar" ? (AR_EX[ex.en] || ex.en) : ex.en; }
function dayLabel(d){ return activeLang === "ar" ? (AR_DAY[d.label] || d.label) : d.label; }
function musLabel(d){ return activeLang === "ar" ? (AR_MUS[d.muscles] || d.muscles) : d.muscles; }
function notesKey(){ return (activePlan === "female" ? "female" : "male") + "_" + (activeStyle === "cal" ? "cal" : "gym"); }
function activeDayStoreKey(){ return "gym_active_day_" + (activePlan || "male") + "_" + activeStyle; }

// ---------------- STATE ----------------
const todayStr = new Date().toISOString().slice(0,10);
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
  if(!last || !last.dayId || last.date === todayStr) return; // nothing to do, or completed today (not "the day after" yet)
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

function sessionKey(dayId){ return todayStr + "_" + dayId; }

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
  return `<iframe src="${ytEmbedSrc(ex.vid,false)}" allow="accelerometer; encrypted-media; fullscreen; gyroscope; picture-in-picture" allowfullscreen></iframe>
          <button class="expand-btn" data-expand="${ex.id}" aria-label="Fullscreen">
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
    const lastText = last ? t("lastLog").replace("{w}", last.w).replace("{r}", last.r) : t("noLog");
    const nm = exName(ex);
    const hasVid = !!ex.vid; // coach-generated plans have no demo clip

    card.innerHTML = `
      <div class="ex-top">
        <div class="check ${done?'on':''}" data-id="${ex.id}">
          <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
        </div>
        <div class="ex-title">
          <div class="en">${nm}</div>
        </div>
      </div>
      <div class="ex-meta">
        <span><b>${ex.sets}</b> ${t("sets")}</span>
        <span><b>${ex.reps}</b> ${t("reps")}</span>
        <span><b>${ex.rest}s</b> ${t("rest")}</span>
      </div>
      <div class="ex-actions">
        <div class="log-box">
          <input type="number" inputmode="decimal" placeholder="${last?last.w:t('wtPH')}" data-w="${ex.id}" style="width:38px">
          <span class="unit">kg</span>
          <input type="number" inputmode="numeric" placeholder="${last?last.r:t('repPH')}" data-r="${ex.id}" style="width:32px">
        </div>
        <button class="btn-sm" data-save="${ex.id}">
          <svg viewBox="0 0 24 24"><path d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
          ${t("save")}
        </button>
        <button class="btn-sm rest" data-rest="${ex.rest}" data-name="${nm}">
          <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 11H8v-2h3V7h2z"/></svg>
          ${t("restBtn")}
        </button>
        ${hasVid ? `<button class="btn-sm video-toggle ${isOpen?'on':''}" data-video="${ex.id}">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          ${isOpen ? t('hideVideo') : t('video')}
        </button>` : ``}
      </div>
      ${hasVid ? `<div class="video-wrap ${isOpen?'open':''}" id="vwrap-${ex.id}">
        <div class="video-frame" id="vframe-${ex.id}">
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
      const card = el.closest(".ex-card");
      if(card) card.classList.toggle("done", on);
      updateProgress();
      // Record the moment this day's checklist *transitions* to complete
      // (not on every click once already complete) so applyDayRotation()
      // can auto-select the next day in rotation on a later day's visit.
      if(!wasComplete && isDayComplete(activeDay)){
        saveJSON("gymday_last_completed", { date: todayStr, dayId: activeDay });
      }
      if(window.GymCalendar && typeof window.GymCalendar.onCheckChanged === "function"){
        window.GymCalendar.onCheckChanged(activeDay, todayStr);
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
      const todayEntryIdx = weights[id].findIndex(e=>e.date===todayStr);
      const entry = { date: todayStr, w, r };
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
  progressPill.classList.toggle("done", done===total && total>0);
  barFill.style.width = total ? (done/total*100)+"%" : "0%";
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
  if(!isAnonMode() && !activePlan){
    document.getElementById("planChooser").hidden = false;
    document.body.style.overflow = "hidden";
  }
  renderAll();
};

document.getElementById("resetLink").onclick = ()=>{
  if(!confirm(t("resetConfirm"))) return;
  delete checks[sessionKey(activeDay)];
  saveJSON("gym_checks", checks);
  animateCards = true;
  renderAll();
};

// ---------------- EXPANDED VIDEO MODAL (stays on page) ----------------
const videoModal = document.getElementById("videoModal");
const modalFrame = document.getElementById("modalFrame");
const modalTitle = document.getElementById("modalTitle");

function openVideoModal(ex){
  // never leave a second player running underneath
  if(openVideoId){ closeInlineVideo(openVideoId); openVideoId = null; }
  modalTitle.textContent = exName(ex);
  modalFrame.innerHTML = `<iframe src="${ytEmbedSrc(ex.vid,true)}" allow="accelerometer; autoplay; encrypted-media; fullscreen; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
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
  if(isDayComplete(activeDay)){ alert(t("dayAlreadyDone")); return; }
  clearInterval(restInterval);
  let remaining = seconds;
  const total = seconds;
  timerLabel.textContent = t("restTimer").replace("{name}", name);
  timerBar.classList.add("show");
  renderRestTime(remaining, total);

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
  timerFill.style.width = Math.max(0,(remaining/total*100))+"%";
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

sessionBtn.onclick = ()=>{
  if(activeSession && activeSession.dayId === activeDay){
    const durationSec = sessionElapsedSec();
    sessions[activeDay] = sessions[activeDay] || [];
    sessions[activeDay].push({ date: todayStr, durationSec });
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
};

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
  document.querySelectorAll("[data-i18n-html]").forEach(el=>{ el.innerHTML = t(el.dataset.i18nHtml); });
  document.title = t("appTitle");
  document.getElementById("langBtn").textContent = t("langBtn");
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
}

// ---------------- PLAN + STYLE ----------------
function applyState(persist){
  if(activeStyle === "coach" && !loadJSON("gym_plans_custom", null)) activeStyle = "gym";
  ensureCoachStyleBtn();
  DAYS = pickDays();
  animateCards = true;
  document.documentElement.dataset.plan = activePlan || "male";
  const tc = document.querySelector('meta[name="theme-color"]');
  if(tc) tc.setAttribute("content", activePlan === "female" ? "#17121a" : "#0d1117");
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

// Plan chooser is two steps: Male/Female, then Gym/In-House — picking a
// plan used to jump straight to the workout, skipping the workout-type
// choice entirely (it silently kept whatever style was already set).
document.querySelectorAll("[data-choose]").forEach(b=>{
  b.onclick = ()=>{
    activePlan = b.dataset.choose;
    applyState(true);                // updates the plan behind the chooser live
    document.getElementById("pcStep1").hidden = true;
    document.getElementById("pcStep2").hidden = false;
  };
});
document.getElementById("pcBack").onclick = ()=>{
  document.getElementById("pcStep2").hidden = true;
  document.getElementById("pcStep1").hidden = false;
};
document.querySelectorAll("[data-choose-style]").forEach(b=>{
  b.onclick = ()=>{
    activeStyle = b.dataset.chooseStyle;
    applyState(true);
    document.getElementById("planChooser").hidden = true;
    document.body.style.overflow = "";
    window.scrollTo(0, 0);           // start at the top of the app, not mid-page
  };
});
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
document.getElementById("langBtn").onclick = ()=> applyLang(activeLang === "ar" ? "en" : "ar", true);

// ---------------- INIT ----------------
document.documentElement.lang = activeLang === "ar" ? "ar" : "en";
document.documentElement.dir  = activeLang === "ar" ? "rtl" : "ltr";
applyStaticI18n();
var _obDone = (function(){ try { return localStorage.getItem("gym_onboarded") === "1"; } catch(e){ return true; } })();
if(isAnonMode() || activePlan){
  applyState(false);
} else if(_obDone){
  document.getElementById("planChooser").hidden = false;
  document.body.style.overflow = "hidden"; // lock scroll behind the chooser
  applyState(false); // render behind the chooser (defaults to male / gym)
} else {
  // First run: ui.js shows #onboarding over the top; render the app behind it.
  applyState(false);
}
