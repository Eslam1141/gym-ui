#!/usr/bin/env node
// Training-splits gap report: for every toolset x sex x split (3/4/5/6 days)
// it checks that each muscle PART can be trained from the exercises already in
// app.js, and names the missing move (= a demo video the owner must supply)
// for every part that cannot.
//
//   node tools/split-gaps.mjs > docs/split-gaps-2026-10-21.md
//
// No dependencies. Reads app.js as text; nothing is imported or executed.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "app.js"), "utf8");

// ---------- library (parsed from app.js) ----------
const lib = new Map(); // id -> {id,en,shape,shape2,tools}
const entry = /\{id:"([^"]+)", en:"([^"]+)"[^}]*?shape:"([a-z_0-9]+)"(?:, shape2:"([a-z_0-9]+)")?[^}]*?tools:\[([^\]]*)\]\}/g;
let entryCount = 0; // plan entries (the same id is reused across plans)
for (let m; (m = entry.exec(src)); ) {
  entryCount++;
  lib.set(m[1], { id: m[1], en: m[2], shape: m[3], shape2: m[4] || null, tools: [...m[5].matchAll(/"([^"]+)"/g)].map((x) => x[1]) });
}
const names = new Map(); // en -> first entry (one move may carry several ids)
for (const e of lib.values()) if (!names.has(e.en)) names.set(e.en, e);
const arBlock = src.slice(src.indexOf("const AR_EX = {"), src.indexOf("const AR_DAY"));
const AR_EX = Object.fromEntries([...arBlock.matchAll(/"([^"]+)":"([^"]+)"/g)].map((m) => [m[1], m[2]]));
const MUSCLE_TAGS = [...src.slice(src.indexOf("const MUSCLE_SHAPES")).matchAll(/\{ id:"([a-z_]+)", group:"([^"]+)"/g)].map((m) => m[1]).slice(0, 20);
if (MUSCLE_TAGS.length !== 20) throw new Error("expected 20 muscle tags, got " + MUSCLE_TAGS.length);

// ---------- splits.js cross-check ----------
// splits.js (the real builder) carries its own copy of the exercises it schedules; it must
// agree with the tags above, or the report and the generated plans would drift apart.
import { createRequire } from "node:module";
const Splits = createRequire(import.meta.url)(join(root, "splits.js"));
for (const [id, m] of Object.entries(Splits.library)) {
  const e = lib.get(id);
  if (!e || e.en !== m.en || e.shape !== m.shape || (e.shape2 || null) !== (m.shape2 || null) || e.tools.join() !== m.tools.join()) {
    throw new Error(`splits.js exercise ${id} disagrees with app.js`);
  }
}

// ---------- toolsets, sexes, splits ----------
const HOME = ["none", "dumbbell", "band", "bench", "table", "pullup_bar", "kettlebell", "jump_rope"];
const TOOLSETS = [
  { key: "bodyweight", label: "Bodyweight only", have: ["none"] },
  { key: "dumbbell", label: "Dumbbell", have: ["none", "dumbbell"] },
  { key: "band", label: "Band", have: ["none", "band"] },
  { key: "dbb", label: "Dumbbell + band + bench", have: ["none", "dumbbell", "band", "bench"] },
  { key: "home", label: "All home tools", have: HOME },
  { key: "gym", label: "Gym (everything)", have: [...HOME, "barbell", "cable", "machine"] }
];
const SEXES = ["male", "female"];
const SPLITS = [3, 4, 5, 6];
const fits = (tools, have) => tools.every((t) => have.includes(t));

// ---------- muscle PARTS ----------
// tag = the app's muscle tag (shape id) the part belongs to, so the report lines
// up with the 20 regions. P = moves whose main job is this part, S = helps only.
// Traps live under the "back_lower" tag ("Lower back / traps"), so they are
// split out here to be checked on their own.
const PARTS = [
  { id: "chest_upper", label: "Upper chest", tag: "chest_upper", P: ["mub_incline", "gm_declpush"], S: [] },
  { id: "chest_mid", label: "Mid chest", tag: "chest_mid", P: ["mua_bench", "ctb_dbbench", "ctb_pushup", "cta_fly", "gm_inclpush"], S: [], big: true },
  { id: "chest_lower", label: "Lower chest", tag: "chest_lower", P: ["gm_inclpush"], S: ["ctb_pushup"] },
  { id: "back_lats", label: "Back width (lats)", tag: "back_lats", P: ["mua_pulldown", "gm_pullup", "gm_bandpulldown", "gm_pullover"], S: ["mcx_row"], big: true },
  { id: "back_mid", label: "Back thickness (mid-back)", tag: "back_mid", P: ["mua_row", "pv_cablerow", "mub_row", "fua_row", "bbb_tbar", "mcx_row", "gm_towelrow"], S: [], big: true },
  { id: "back_lower", label: "Lower back (erectors)", tag: "back_lower", P: ["mcx_superman"], S: ["mla_rdl"] },
  { id: "traps", label: "Traps", tag: "back_lower", P: ["gm_yt"], S: ["mub_pullapart", "mua_facepull", "bbb_tbar"] },
  { id: "shoulder_front", label: "Front delts", tag: "shoulder_front", P: ["pv_ohp", "mub_arnold", "mcp_pike"], S: [] },
  { id: "shoulder_side", label: "Side delts", tag: "shoulder_side", P: ["mua_lateral", "gm_bandlat"], S: [] },
  { id: "shoulder_rear", label: "Rear delts", tag: "shoulder_rear", P: ["mua_facepull", "mub_pullapart", "gm_yt"], S: ["mub_row", "mua_row", "mcx_row"] },
  { id: "biceps_long", label: "Biceps long head", tag: "biceps_long", P: ["bba_inclcurl", "nb_towelcurl", "gm_bandcurl"], S: ["mub_hammer"] },
  { id: "biceps_short", label: "Biceps short head", tag: "biceps_short", P: ["mua_curl", "fua_arms", "nb_towelcurl", "gm_bandcurl"], S: [] },
  { id: "brachialis", label: "Brachialis", tag: "biceps_long", P: ["mub_hammer", "gm_bandrevcurl"], S: [] },
  { id: "triceps_long", label: "Triceps long head", tag: "triceps_long", P: ["cta_ohext", "fua_arms", "gm_bandohext"], S: [] },
  { id: "triceps_lateral", label: "Triceps lateral head", tag: "triceps_lateral", P: ["mua_pushdown", "mub_dips", "nb_diamond"], S: ["ctb_pushup"] },
  { id: "quads", label: "Quads (vasti, general)", tag: "quads", P: ["mla_squat", "mla_legpress", "mlb_hack", "fla_goblet", "flb_bss", "mcl_squat", "fla_lunge", "mcl_lunge", "flb_sumo", "mlb_legext"], S: ["mcl_jump", "mcl_burpee"], big: true, legs: true },
  { id: "quads_rectus", label: "Rectus femoris", tag: "quads", P: ["mlb_legext", "gm_sissy"], S: [] },
  { id: "ham_hinge", label: "Hamstrings: hip hinge", tag: "hamstrings", P: ["mla_rdl", "fla_rdl", "mlb_sldl", "nb_hinge1"], S: [], big: true, legs: true },
  { id: "ham_curl", label: "Hamstrings: knee bend", tag: "hamstrings", P: ["pv_legcurl", "mlb_seatcurl", "nb_slidecurl"], S: [], legs: true },
  { id: "glute_max", label: "Glute max", tag: "glutes", P: ["mcl_bridge", "mla_bridge", "mlb_kickback"], S: ["flb_sumo", "flb_bss", "mcl_jump", "mla_rdl"], big: true, glute: true },
  { id: "glute_med", label: "Glute medius (abduction)", tag: "glutes", P: ["gm_hipabd"], S: ["flb_bss", "mlb_sldl", "mcl_lunge", "fla_lunge"], glute: true },
  { id: "calf_gastro", label: "Calves: gastrocnemius", tag: "calves", P: ["mla_calf"], S: [] },
  { id: "calf_soleus", label: "Calves: soleus", tag: "calves", P: ["flb_calf", "gm_soleus"], S: [] },
  { id: "core_flexion", label: "Core: flexion (abs)", tag: "core_lower", P: ["mla_core", "flb_legraise", "mcx_flutter"], S: ["mcp_hollow"] },
  { id: "core_antiext", label: "Core: anti-extension", tag: "core_upper", P: ["mcp_plank", "fla_deadbug", "mcp_hollow"], S: ["mcp_mtn", "mcx_bear"] },
  { id: "core_antirot", label: "Core: anti-rotation (obliques)", tag: "core_obliques", P: ["mlb_core", "gm_sideplank"], S: ["mcx_bear"] }
];
for (const p of PARTS) for (const id of [...p.P, ...p.S]) if (!lib.has(id)) throw new Error(`part ${p.id}: unknown exercise id ${id}`);
for (const t of MUSCLE_TAGS) if (!PARTS.some((p) => p.tag === t)) throw new Error("muscle tag without a part: " + t);

// ---------- moves the library does not have (candidates for new videos) ----------
// closes = parts the move trains as its main job; adds = extra variety only.
const MISSING = [
  { en: "Chin-ups", tools: ["pullup_bar"], closes: ["back_lats", "biceps_short"], adds: ["brachialis"] },
  { en: "Hanging Knee Raise", tools: ["pullup_bar"], closes: [], adds: ["core_flexion"], note: "easier regression of Hanging Leg Raise" },
  { en: "Chest Dips", tools: ["machine"], closes: ["chest_lower", "triceps_lateral"], adds: [], note: "dip station or assisted-dip machine (gym upgrade)" },
  { en: "Bodyweight Triceps Extension", tools: ["table"], closes: ["triceps_long"], adds: [], note: "hands on a sturdy table edge, lower the head toward it" },
  { en: "Dumbbell Overhead Triceps Extension", tools: ["dumbbell"], closes: ["triceps_long"], adds: [] },
  { en: "Band Triceps Pushdown", tools: ["band"], closes: ["triceps_lateral"], adds: [] },
  { en: "Band Row", tools: ["band"], closes: ["back_mid"], adds: ["shoulder_rear"] },
  { en: "Band Chest Press", tools: ["band"], closes: ["chest_mid"], adds: [] },
  { en: "Band Pull-Through", tools: ["band"], closes: ["ham_hinge", "glute_max"], adds: [] },
  { en: "Band Pallof Press", tools: ["band"], closes: ["core_antirot"], adds: [] },
  { en: "Banded Lateral Walk", tools: ["band"], closes: ["glute_med"], adds: [], note: "Band Hip Abduction in the spec's list" },
  { en: "Kettlebell Swing", tools: ["kettlebell"], closes: ["ham_hinge", "glute_max"], adds: [] },
  { en: "Kettlebell Romanian Deadlift", tools: ["kettlebell"], closes: ["ham_hinge"], adds: [] },
  { en: "Kettlebell Overhead Press", tools: ["kettlebell"], closes: ["shoulder_front"], adds: [] },
  { en: "Kettlebell Goblet Squat", tools: ["kettlebell"], closes: ["quads"], adds: [], note: "skip if the owner accepts Goblet Squat done with a kettlebell" },
  { en: "Jump Rope", tools: ["jump_rope"], closes: [], adds: ["calf_gastro"], note: "conditioning; the Standing Calf Raise already covers calves" },
  { en: "Dumbbell Fly", tools: ["dumbbell", "bench"], closes: ["chest_mid"], adds: [] },
  { en: "Dumbbell Shrug", tools: ["dumbbell"], closes: ["traps"], adds: [] },
  { en: "Dumbbell Rear Delt Fly", tools: ["dumbbell"], closes: ["shoulder_rear"], adds: ["back_mid"] },
  { en: "Single-Leg Calf Raise", tools: ["none"], closes: [], adds: ["calf_gastro"] },
  { en: "Hip Abduction Machine", tools: ["machine"], closes: ["glute_med"], adds: [], note: "gym upgrade" },
  { en: "Barbell Hip Thrust", tools: ["barbell", "bench"], closes: ["glute_max"], adds: [], note: "gym upgrade" },
  { en: "Barbell Shrug", tools: ["barbell"], closes: ["traps"], adds: [], note: "gym upgrade (the Dumbbell Shrug already closes this)" },
  { en: "Preacher Curl", tools: ["machine"], closes: ["biceps_short"], adds: [], note: "gym upgrade" },
  { en: "Reverse Pec Deck (Rear Delt Fly)", tools: ["machine"], closes: ["shoulder_rear"], adds: [], note: "gym upgrade" },
  { en: "Cable Lateral Raise", tools: ["cable"], closes: ["shoulder_side"], adds: [], note: "gym upgrade" },
  { en: "Weighted Cable Crunch (core)", tools: ["cable"], closes: ["core_flexion"], adds: [], note: "gym upgrade" },
  { en: "Wide-grip Lat Pulldown", tools: ["cable"], closes: ["back_lats"], adds: [], note: "gym upgrade (a grip variant of the pulldown we already have)" }
];
const GYM_UPGRADE = new Set(MISSING.filter((m) => /gym upgrade/.test(m.note || "")).map((m) => m.en));
for (const m of MISSING) m.ar = AR_EX[m.en] || null;
const arOnly = Object.keys(AR_EX).filter((k) => !names.has(k));

// ---------- coverage engine ----------
const toolCost = (tools) => tools.filter((t) => t !== "none").length;
function movesFor(part, have) {
  const inKit = (id) => fits(lib.get(id).tools, have);
  return { P: part.P.filter(inKit), S: part.S.filter(inKit) };
}
// How many different primary moves a part wants, so a 5-6 day week does not
// repeat one move every session. Women's plans weight glutes and legs more.
function wanted(part, days, sex) {
  let n = 1;
  if (days >= 5 && part.big) n = 2;
  if (sex === "female") {
    if (part.glute && days >= 4) n += 1;
    if (part.legs && days >= 5) n += 1;
  }
  return n;
}
function cheapestFill(part, have) {
  const fit = MISSING.filter((m) => m.closes.includes(part.id) && fits(m.tools, have) && !GYM_UPGRADE.has(m.en));
  fit.sort((a, b) => toolCost(a.tools) - toolCost(b.tools));
  return fit[0] || null;
}
function needTool(part) {
  // No move fits this kit: the smallest extra tool that would make one fit.
  const opts = [
    ...part.P.map((id) => ({ tools: lib.get(id).tools, name: lib.get(id).en })),
    ...MISSING.filter((m) => m.closes.includes(part.id) && !GYM_UPGRADE.has(m.en)).map((m) => ({ tools: m.tools, name: m.en }))
  ].filter((o) => !o.tools.some((t) => ["barbell", "cable", "machine"].includes(t))).sort((a, b) => toolCost(a.tools) - toolCost(b.tools));
  return opts[0] || null;
}

const credit = new Map(); // move name -> {gaps:Set, thin:Set, kits:Set}
const bump = (name, kind, cell, kit) => {
  if (!credit.has(name)) credit.set(name, { gaps: new Set(), thin: new Set(), kits: new Set() });
  const c = credit.get(name); c[kind].add(cell); c.kits.add(kit);
};
const report = {}; // kit -> {gaps:[], thin:{sex:{days:[...]}}}
for (const ts of TOOLSETS) {
  const r = (report[ts.key] = { gaps: [], thin: [] });
  for (const part of PARTS) {
    const { P, S } = movesFor(part, ts.have);
    if (!P.length) {
      const fill = cheapestFill(part, ts.have);
      const g = { part, closest: S.map((id) => lib.get(id).en), fill, needs: fill ? null : needTool(part) };
      r.gaps.push(g);
      if (fill) bump(fill.en, "gaps", ts.key + "|" + part.id, ts.key);
      continue;
    }
    for (const sex of SEXES) {
      const byDays = SPLITS.map((d) => [d, wanted(part, d, sex)]).filter(([, w]) => P.length < w);
      if (!byDays.length) continue;
      const add = MISSING.filter((m) => (m.closes.includes(part.id) || m.adds.includes(part.id)) && fits(m.tools, ts.have) && !GYM_UPGRADE.has(m.en)).sort((a, b) => toolCost(a.tools) - toolCost(b.tools))[0] || null;
      r.thin.push({ part, sex, have: P.length, byDays, add });
      if (add) bump(add.en, "thin", ts.key + "|" + part.id + "|" + sex, ts.key);
    }
  }
}

// ---------- markdown ----------
const out = [];
const w = (s = "") => out.push(s);
const toolStr = (t) => t.join(" + ");
const exCount = lib.size, moveCount = names.size;
const tagCounts = {};
for (const e of names.values()) for (const t of e.tools) tagCounts[t] = (tagCounts[t] || 0) + 1;

w("# Training splits: gap report (2026-10-21)");
w();
w("Generated by `node tools/split-gaps.mjs` from the `tools` tags in `app.js`. Re-run it after adding a video and the gap disappears.");
w();
w("Approved clips (owner, 2026-10-22): all 19 are in the app, the 4 no-tool moves (`nb_*`) and the 15 gap moves (`gm_*`); see [approved-clips-2026-10-22.md](approved-clips-2026-10-22.md).");
w();
w("## How to read this");
w();
w(`- Library: ${entryCount} plan entries tagged, ${exCount} distinct ids, ${moveCount} distinct moves (the same id is reused across plans, and one move can carry several ids). Every entry now has a \`tools\` tag: what the move requires.`);
w(`- Moves per tool: ${Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(", ")}.`);
w(`- A **part** is a piece of a muscle (for example "Upper chest" or "Hamstrings: hip hinge"). The ${PARTS.length} parts map onto the app's 20 muscle tags; traps sit under the "Lower back / traps" tag, so they are checked on their own.`);
w("- **Gap**: no library move whose main job is that part fits the toolset. Nothing can be scheduled for it, whatever the split, so the builder would have to borrow from a neighbouring part. The move named under \"Fill with\" is the cheapest missing move that closes it.");
w("- **Thin**: the part has a move but fewer different moves than the split wants (a 5 or 6 day week should not repeat one move every session; women's plans want more glute and leg variety). Not a blocker.");
w("- Gaps do not depend on sex or on the number of days, only on the toolset. Variety depends on all three.");
w("- A part counts as closed when the library has a main move for it that fits the kit. `splits.js` schedules a gap move (`gm_*`) only where the kit leaves that slot empty or with a single move; kits that already have a good move keep it, so their plans do not change. Sissy Squat has no template slot yet, and Side-Lying Hip Abduction, Prone Y-T Raise and Bent-Knee Calf Raise are scheduled only in the kits that otherwise lack them.");
w(`- Kits: bodyweight is only \`none\`. Dumbbell, band and dumbbell + band + bench add to \`none\`. All home tools is ${HOME.filter((t) => t !== "none").join(", ")}. Gym is every tool, including barbell, cable and machine.`);
w("- Barbell, cable and machine moves never appear in a home kit; the Playwright test `tests/split-tools.spec.js` enforces that.");
w();
w("### Tagging calls worth a second look");
w();
w("- **Lat Pulldown / Pull-up** is tagged `cable`: the library clip is the pulldown. A pull-up bar is an alternative the clip does not show, so Pull-ups is its own library move (`pullup_bar`).");
w("- **Goblet Squat** is tagged `dumbbell`; a kettlebell does the same job (the \"Kettlebell Goblet Squat\" row below is optional if the owner is happy for the existing clip to serve both).");
w("- **Standing Calf Raise** is tagged `none`: it is already used bodyweight in the calisthenics plans (25-30 reps); a loaded version is not required.");
w("- **Bulgarian Split Squat** is tagged `dumbbell + bench`; unloaded on a chair it works, but the clip shows the loaded move.");
w("- **Pallof Press** is tagged `cable`; a band works too (listed as Band Pallof Press).");
w("- **Chest-Supported Row** and **T-Bar Row** are tagged `machine` (gym plate-loaded / supported row). The dumbbell version is a separate move (Chest-Supported Dumbbell Row, `dumbbell + bench`).");
w("- **Hanging Leg Raise** is tagged `pullup_bar`.");
w("- The inverted row is `table`; Decline Push-ups, Hands-Elevated Push-ups and the Doorway Towel Row assume household furniture and are tagged `none`.");
w();

for (const ts of TOOLSETS) {
  const r = report[ts.key];
  w(`## ${ts.label}`);
  w();
  w(`Tools: ${ts.have.join(", ")}.`);
  w();
  if (!r.gaps.length) w("**No gaps.** Every part has at least one move in this kit.");
  else {
    w(`### Gaps (${r.gaps.length}), all sexes and splits`);
    w();
    w("| Part | Closest today (helps, not main job) | Fill with |");
    w("| --- | --- | --- |");
    for (const g of r.gaps) {
      const closest = g.closest.length ? g.closest.join(", ") : "nothing";
      let fill;
      if (g.fill) fill = `**${g.fill.en}** (${toolStr(g.fill.tools)})`;
      else if (g.needs) fill = `No move fits this kit. Tick ${toolStr(g.needs.tools.filter((t) => t !== "none"))}: ${g.needs.name}`;
      else fill = "no candidate";
      w(`| ${g.part.label} | ${closest} | ${fill} |`);
    }
  }
  w();
  const thin = r.thin;
  if (thin.length) {
    w("### Thin variety");
    w();
    w("| Part | Sex | Moves we have | Wants more at | Add |");
    w("| --- | --- | --- | --- | --- |");
    for (const t of thin) {
      const { P } = movesFor(t.part, ts.have);
      const wants = t.byDays.map(([d, n]) => `${d} days (${n})`).join(", ");
      w(`| ${t.part.label} | ${t.sex} | ${P.length}: ${P.map((id) => lib.get(id).en).join(", ")} | ${wants} | ${t.add ? t.add.en : "-"} |`);
    }
    w();
  }
}

// ---------- videos needed ----------
const ranked = [...credit.entries()].map(([name, c]) => ({ name, m: MISSING.find((x) => x.en === name), gaps: c.gaps.size, thin: c.thin.size, kits: [...c.kits] }))
  .sort((a, b) => b.gaps - a.gaps || b.thin - a.thin || a.name.localeCompare(b.name));
const kitLabel = Object.fromEntries(TOOLSETS.map((t) => [t.key, t.label]));
w("## Videos needed");
w();
w("Deduplicated and ordered by how many gaps each move closes (a gap is one part in one toolset), then by how many thin-variety cells it improves. Each row is a clip the owner has to supply; nothing here has a video yet.");
w();
w("| # | Move (EN) | AR name today | Tools | Closes (gaps) | Gaps closed | Variety cells | Unblocks |");
w("| --- | --- | --- | --- | --- | --- | --- | --- |");
ranked.forEach((r, i) => {
  const parts = [...new Set([...credit.get(r.name).gaps].map((c) => PARTS.find((p) => p.id === c.split("|")[1]).label))];
  const extra = r.m.note ? ` (${r.m.note})` : "";
  w(`| ${i + 1} | ${r.m.en}${extra} | ${r.m.ar || "none yet"} | ${toolStr(r.m.tools)} | ${parts.join(", ") || "-"} | ${r.gaps} | ${r.thin} | ${r.kits.map((k) => kitLabel[k]).join("; ")} |`);
});
w();
const totalGaps = Object.values(report).reduce((n, r) => n + r.gaps.length, 0);
const unfillable = TOOLSETS.flatMap((ts) => report[ts.key].gaps.filter((g) => !g.fill).map((g) => `${ts.label}: ${g.part.label} (${g.needs ? "tick " + toolStr(g.needs.tools) : "no candidate"})`));
w(`Total gaps across the six kits: ${totalGaps}. Videos that close at least one: ${ranked.filter((r) => r.gaps).length}.`);
w();
if (unfillable.length) {
  w("### Gaps with no honest move for the kit (a tool tick closes them)");
  w();
  unfillable.forEach((u) => w(`- ${u}`));
  w();
}

w("## Gym upgrades (not gaps)");
w();
w("The gym kit has no unfilled part now that the approved bodyweight clips are in the app, but several parts rest on a single machine or a floor move. These are the spec's gym additions, kept as optional extras:");
w();
MISSING.filter((m) => GYM_UPGRADE.has(m.en) || m.en === "Chest Dips").forEach((m) => w(`- ${m.en} (${toolStr(m.tools)}): ${m.closes.map((id) => PARTS.find((p) => p.id === id).label).join(", ")}${m.ar ? `. Arabic name already in AR_EX: ${m.ar}` : ""}`));
w();

w("## Arabic names with no exercise or video");
w();
w("These have an Arabic name in `AR_EX` but no library exercise, so there is nothing to schedule and no clip to show:");
w();
arOnly.forEach((k) => {
  const m = MISSING.find((x) => x.en === k);
  const dup = k === "Biceps + Triceps Superset" ? "duplicate of the existing \"Biceps Curl + Triceps Extension (superset)\" entry, no video needed" : k === "Seated Calf Raise" ? "the library has the dumbbell version as \"Seated Calf Raise (Dumbbell)\"; this is an alias" : m ? "listed under Gym upgrades" : "";
  w(`- ${k}: ${AR_EX[k]}${dup ? ` (${dup})` : ""}`);
});
w();
process.stdout.write(out.join("\n"));
