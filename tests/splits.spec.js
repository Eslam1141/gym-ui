// splits.js: the 3/4/5/6-day training splits and their pure builder. The builder
// has no DOM, so most of this runs in plain Node; one test loads it in the app.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { openApp } = require("./helpers");

const root = path.join(__dirname, "..");
const S = require(path.join(root, "splits.js"));
const appSrc = fs.readFileSync(path.join(root, "app.js"), "utf8");

const HOME = S.HOME_TOOLS;
const KITS = [
  { key: "bodyweight only", where: "home", tools: ["none"] },
  { key: "dumbbell", where: "home", tools: ["dumbbell"] },
  { key: "band", where: "home", tools: ["band"] },
  { key: "dumbbell+band+bench", where: "home", tools: ["dumbbell", "band", "bench"] },
  { key: "all home tools", where: "home", tools: HOME },
  { key: "gym", where: "gym", tools: [] }
];
const REGIONS = Object.keys(S.REGIONS);
const cases = [];
for (const days of S.DAYS) for (const sex of ["male", "female"]) for (const kit of KITS) cases.push({ days, sex, kit, name: `${days}d ${sex} ${kit.key}` });
const build = (c) => S.buildPlan({ days: c.days, where: c.kit.where, sex: c.sex, tools: c.kit.tools });
const have = (c) => (c.kit.where === "gym" ? [...HOME, "barbell", "cable", "machine"] : c.kit.tools);

// Regions no library move in the toolset can train at all, per toolset (all splits and sexes
// agree). Each one is returned in `gaps` with the tool to tick. Since the 15 gap moves (2026-10-22)
// only the bodyweight kit has any: it has no move for lats, side delts or the triceps long head.
const EXPECTED_REGION_GAPS = {
  "bodyweight only": ["back_lats", "shoulder_side", "triceps_long"],
  dumbbell: [],
  band: [],
  "dumbbell+band+bench": [],
  "all home tools": [],
  gym: []
};
// New no-equipment moves (2026-10-22) and their owner-approved clips (2026-10-22).
const NEW_NB_CLIPS = { nb_towelcurl: "leaEyx33mHw", nb_diamond: "PPTj-MW2tcs", nb_hinge1: "JQZqPsmeesc", nb_slidecurl: "cjtsLDniFpk" };
// The 15 gap moves (2026-10-22): id -> [EN name, approved clip, tools, shape, shape2].
const GAP_MOVES = {
  gm_yt: ["Prone Y-T Raise", "X-b1S-rQc9k", ["none"], "shoulder_rear", null],
  gm_inclpush: ["Hands-Elevated Push-ups", "yAbg3_pJKvw", ["none"], "chest_lower", "chest_mid"],
  gm_hipabd: ["Side-Lying Hip Abduction", "-rDiQXjeXO0", ["none"], "glutes", null],
  gm_sissy: ["Sissy Squat", "_cWFxUEfV7o", ["none"], "quads", null],
  gm_sideplank: ["Side Plank", "44ND4bOB-T0", ["none"], "core_obliques", null],
  gm_declpush: ["Decline Push-ups", "xoX1nSewXgA", ["none"], "chest_upper", null],
  gm_soleus: ["Bent-Knee Calf Raise", "uJ7QH7pExh0", ["none"], "calves", null],
  gm_towelrow: ["Doorway Towel Row", "SkFBcrHVGn4", ["none"], "back_mid", null],
  gm_bandcurl: ["Resistance Band Curl", "AaA7Yj3zHiU", ["band"], "biceps_short", "biceps_long"],
  gm_bandpulldown: ["Resistance Band Lat Pulldown", "8zv8Pray4-w", ["band"], "back_lats", null],
  gm_pullup: ["Pull-ups", "I3K-IbszbuI", ["pullup_bar"], "back_lats", null],
  gm_bandlat: ["Band Lateral Raise", "iQlrRrZTrBs", ["band"], "shoulder_side", null],
  gm_bandohext: ["Band Overhead Triceps Extension", "Yi_zNoIsNcc", ["band"], "triceps_long", null],
  gm_bandrevcurl: ["Band Reverse-Grip Curl", "ze32_Pas8ho", ["band"], "biceps_long", null],
  gm_pullover: ["Dumbbell Pullover", "jQjWlIwG4sI", ["dumbbell"], "back_lats", null]
};

function stats(plan) {
  const regionDays = {}, groupSets = {}, groupDay = {};
  plan.days.forEach((d) => {
    const perDay = {};
    d.exercises.forEach((e) => {
      const regs = [e.shape, e.shape2].filter(Boolean);
      regs.forEach((r) => { (regionDays[r] = regionDays[r] || new Set()).add(d.id); });
      new Set(regs.map((r) => S.REGIONS[r])).forEach((g) => {
        groupSets[g] = (groupSets[g] || 0) + e.sets;
        perDay[g] = (perDay[g] || 0) + e.sets;
      });
    });
    Object.entries(perDay).forEach(([g, n]) => { groupDay[g] = Math.max(groupDay[g] || 0, n); });
  });
  return { regionDays, groupSets, groupDay };
}

test("shape: day ids, labels (EN + AR), weekdays and week layout", () => {
  expect(S.DAYS).toEqual([3, 4, 5, 6]);
  expect(S.WEEKDAYS).toEqual({ 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] });
  const keys = { 3: ["fullA", "fullB", "fullC"], 4: ["upperA", "lowerA", "upperB", "lowerB"], 5: ["upper", "lower", "push", "pull", "legs"], 6: ["pushA", "pullA", "legsA", "pushB", "pullB", "legsB"] };
  for (const days of S.DAYS) for (const where of ["gym", "home"]) for (const sex of ["male", "female"]) {
    const p = S.buildPlan({ days, where, sex, tools: ["none"] });
    expect(p.days.map((d) => d.id)).toEqual(keys[days].map((k) => `sp${days}${where[0]}${sex[0]}_${k}`));
    p.days.forEach((d) => {
      expect(d.label && d.labelAr && d.muscles && d.musclesAr, d.id).toBeTruthy();
      expect(/[؀-ۿ]/.test(d.labelAr) && /[؀-ۿ]/.test(d.musclesAr), d.id).toBe(true);
    });
    expect(p.week.length).toBe(7);
    expect(p.week.filter(Boolean)).toEqual(p.days.map((d) => d.id));
    S.WEEKDAYS[days].forEach((wd, i) => expect(p.week[wd]).toBe(p.days[i].id));
  }
});

test("exercise objects match the shape app.js renders", () => {
  const p = S.buildPlan({ days: 6, where: "gym", sex: "male" });
  p.days.forEach((d) => d.exercises.forEach((e) => {
    expect(Object.keys(e).filter((k) => !["shape2"].includes(k)).sort()).toEqual(["en", "id", "rest", "reps", "sets", "shape", "tier", "tools", "vid"].sort());
    expect(e.vid, e.id).toBeTruthy();
    if (NEW_NB_CLIPS[e.id]) expect(e.vid, e.id).toBe(NEW_NB_CLIPS[e.id]);
    expect(["easy", "medium", "hard"]).toContain(e.tier);
  }));
});

for (const c of cases) {
  test(`coverage: ${c.name}`, () => {
    const plan = build(c);
    const { regionDays, groupSets, groupDay } = stats(plan);
    const gapRegions = new Set(plan.gaps.filter((g) => g.kind === "region" || g.kind === "frequency").map((g) => g.region));
    const gapGroups = new Set(plan.gaps.map((g) => g.group));
    // every region on >=2 different days, or recorded in gaps
    REGIONS.forEach((r) => {
      const n = (regionDays[r] || new Set()).size;
      if (n >= 2) expect(gapRegions.has(r), `${r} is hit on ${n} days but listed as a gap`).toBe(false);
      else expect(gapRegions.has(r), `${r} hit on ${n} day(s) and not in gaps`).toBe(true);
    });
    // weekly sets per muscle group 8-14 (hard cap 16); a group with no move at all is a recorded gap
    new Set(Object.values(S.REGIONS)).forEach((g) => {
      const n = groupSets[g] || 0;
      if (n === 0) return expect(gapGroups.has(g), `${g} has no sets and no gap`).toBe(true);
      expect(n, `${g} sets/week`).toBeGreaterThanOrEqual(8);
      expect(n, `${g} sets/week (hard cap 16)`).toBeLessThanOrEqual(16);
      // the only known 15-16: home 6-day shoulders (Bear Crawl also counts as front delt)
      if (n > 14) expect(g === "Shoulders" && c.days === 6 && c.kit.where === "home", `${g} has ${n} sets/week`).toBe(true);
    });
    // no group over 10 sets in one session
    Object.entries(groupDay).forEach(([g, n]) => expect(n, `${g} in one day`).toBeLessThanOrEqual(10));
    // exercises per day: 8 on 3-day plans, 7 on 4/5/6-day plans
    plan.days.forEach((d) => expect(d.exercises.length, d.id).toBeLessThanOrEqual(c.days === 3 ? 8 : 7));
  });

  test(`tools and reps: ${c.name}`, () => {
    const plan = build(c);
    const ok = have(c);
    plan.days.forEach((d) => {
      expect(d.exercises.length, d.id).toBeGreaterThanOrEqual(2);
      const ids = d.exercises.map((e) => e.id);
      expect(new Set(ids).size, d.id + " repeats a move").toBe(ids.length);
      d.exercises.forEach((e) => {
        e.tools.forEach((t) => { if (t !== "none") expect(ok, `${e.id} needs ${t}`).toContain(t); });
        if (c.kit.where === "home") expect(e.tools.some((t) => ["barbell", "cable", "machine"].includes(t)), e.id).toBe(false);
        expect(e.sets).toBeGreaterThanOrEqual(2);
        expect(e.sets).toBeLessThanOrEqual(5);
        expect(S.REGIONS[e.shape], e.id).toBeTruthy();
        if (e.shape2) expect(S.REGIONS[e.shape2], e.id).toBeTruthy();
        const kind = S.library[e.id].kind;
        if (kind === "hold") return expect(e.reps).toMatch(/^\d+(-\d+)?s$/);
        const m = /^(\d+)-(\d+)(\/(leg|arm|side))?$/.exec(e.reps);
        expect(m, `${e.id} reps ${e.reps}`).toBeTruthy();
        const lo = +m[1], hi = +m[2];
        const span = { compound: [5, 10], secondary: [8, 12], isolation: [12, 20], endurance: [12, 20] }[kind];
        expect(lo, `${e.id} ${kind} ${e.reps}`).toBeGreaterThanOrEqual(span[0]);
        expect(hi, `${e.id} ${kind} ${e.reps}`).toBeLessThanOrEqual(span[1]);
      });
    });
  });
}

test("gaps per toolset are exactly the known ones, and every unfilled/substituted slot names its fix", () => {
  for (const kit of KITS) {
    const union = new Set();
    for (const days of S.DAYS) for (const sex of ["male", "female"]) {
      const p = S.buildPlan({ days, where: kit.where, sex, tools: kit.tools });
      p.gaps.filter((g) => g.kind === "region").forEach((g) => union.add(g.region));
      p.gaps.forEach((g) => {
        expect(["region", "frequency", "substituted", "unfilled"]).toContain(g.kind);
        expect(g.region && g.group, JSON.stringify(g)).toBeTruthy();
        // a fix is named (a clip to supply now) or a tool to tick; gym upgrades have neither
        if (g.kind !== "frequency" && (kit.where === "home" || g.kind !== "region")) expect(g.needs || g.tick || g.kind === "substituted", JSON.stringify(g)).toBeTruthy();
      });
    }
    expect([...union].sort(), kit.key).toEqual(EXPECTED_REGION_GAPS[kit.key]);
  }
});

// Regions the tools can reach but the per-day exercise cap leaves on fewer than two days
// ("frequency" gaps), gym toolset, as the union over men and women. 6-day PPL x2 has only back_lower.
const EXPECTED_GYM_FREQUENCY = {
  3: ["back_lower", "biceps_long", "chest_lower", "core_obliques", "shoulder_front", "shoulder_rear", "shoulder_side", "triceps_lateral"],
  4: ["back_lower", "biceps_long", "chest_lower", "chest_upper", "shoulder_rear", "triceps_lateral"],
  5: ["back_lower", "biceps_long", "chest_lower", "shoulder_rear", "triceps_lateral"],
  6: ["back_lower", "chest_lower"]
};
test("frequency gaps (exercise cap) are recorded, never faked", () => {
  for (const days of S.DAYS) {
    const union = new Set();
    for (const sex of ["male", "female"]) {
      S.buildPlan({ days, where: "gym", sex }).gaps.filter((g) => g.kind === "frequency").forEach((g) => {
        expect(g.days, JSON.stringify(g)).toBeLessThan(2);
        expect(g.needs || g.tick, JSON.stringify(g)).toBeFalsy();
        union.add(g.region);
      });
    }
    expect([...union].sort(), `${days}-day gym`).toEqual(EXPECTED_GYM_FREQUENCY[days]);
  }
});

test("bodyweight only: a full split, no empty day, gaps listed", () => {
  for (const days of S.DAYS) for (const sex of ["male", "female"]) {
    const p = S.buildPlan({ days, where: "home", sex, tools: ["none"] });
    expect(p.days.length).toBe(days);
    p.days.forEach((d) => expect(d.exercises.length, d.id).toBeGreaterThanOrEqual(2));
    p.days.forEach((d) => d.exercises.forEach((e) => expect(e.tools, e.id).toEqual(["none"])));
    // the no-equipment moves train biceps, triceps and hamstrings; only the triceps long head stays a gap
    const sets = stats(p).groupSets;
    ["Biceps", "Triceps", "Hamstrings"].forEach((g) => expect(sets[g] || 0, `${g} is trained`).toBeGreaterThanOrEqual(8));
    expect(p.gaps.some((g) => g.kind === "region" && g.region === "triceps_long")).toBe(true);
    expect(p.gaps.length).toBeGreaterThan(5);
    // an empty tools array and a missing one both mean bodyweight
    expect(S.buildPlan({ days, where: "home", sex, tools: [] })).toEqual(p);
    expect(S.buildPlan({ days, where: "home", sex })).toEqual(p);
  }
  // ticking a pull-up bar / table / bench starts to close the gaps
  const more = S.buildPlan({ days: 4, where: "home", sex: "male", tools: ["none", "table", "bench"] });
  const base = S.buildPlan({ days: 4, where: "home", sex: "male", tools: ["none"] });
  expect(more.gaps.length).toBeLessThan(base.gaps.length);
});

test("new no-equipment moves: in app.js with EN + AR names, approved clip, tools none", () => {
  Object.keys(NEW_NB_CLIPS).forEach((id) => {
    const m = S.library[id];
    expect(m && m.tools, id).toEqual(["none"]);
    expect(m.vid, id).toBe(NEW_NB_CLIPS[id]);
    const ar = appSrc.match(new RegExp(`"${m.en}":"([^"]+)"`));
    expect(ar && /[؀-ۿ]/.test(ar[1]), `${id} has no Arabic name in AR_EX`).toBe(true);
  });
});

test("15 gap moves: in app.js and splits.js with the approved clip, tools, shape tags and an Arabic name", () => {
  expect(Object.keys(GAP_MOVES)).toHaveLength(15);
  Object.entries(GAP_MOVES).forEach(([id, [en, vid, tools, shape, shape2]]) => {
    const m = S.library[id];
    expect(m, id).toBeTruthy();
    expect({ en: m.en, vid: m.vid, tools: m.tools, shape: m.shape, shape2: m.shape2 || null }, id).toEqual({ en, vid, tools, shape, shape2 });
    const line = appSrc.split("\n").find((l) => l.includes(`{id:"${id}"`));
    expect(line, `${id} is not in app.js`).toBeTruthy();
    expect(line, id).toContain(`en:"${en}"`);
    expect(line, id).toContain(`vid:"${vid}"`);
    const ar = appSrc.match(new RegExp(`"${en.replace(/[()]/g, "\\$&")}":"([^"]+)"`));
    expect(ar && /[؀-ۿ]/.test(ar[1]), `${id} has no Arabic name in AR_EX`).toBe(true);
  });
  // ids are unique across app.js
  Object.keys(GAP_MOVES).forEach((id) => expect(appSrc.split(`{id:"${id}"`).length - 1, id).toBe(1));
  // the owner's specific tool calls
  expect(S.library.gm_pullup.tools).toEqual(["pullup_bar"]);
  expect(S.library.gm_pullover.tools).toEqual(["dumbbell"]);
});

test("gap moves are used only where the kit lacked a move; gym plans did not change", () => {
  const used = {};
  for (const c of cases) build(c).days.forEach((d) => d.exercises.forEach((e) => {
    if (e.id.startsWith("gm_")) (used[e.id] = used[e.id] || new Set()).add(c.kit.key);
  }));
  // gym: no gap move, and the eight gym plans are exactly what they were before the gap moves
  Object.values(used).forEach((s) => expect(s.has("gym")).toBe(false));
  const parts = [];
  for (const days of S.DAYS) for (const sex of ["male", "female"]) S.buildPlan({ days, where: "gym", sex }).days.forEach((d) => parts.push(d.id + ":" + d.exercises.map((e) => e.id + "x" + e.sets).join(",")));
  expect(crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16)).toBe("9d9c7326214fd3b4");
  // every gap move is scheduled in at least one kit except Sissy Squat (no template slot yet)
  const unused = Object.keys(GAP_MOVES).filter((id) => !used[id]);
  expect(unused).toEqual(["gm_sissy"]);
  // band moves only in band kits, the pull-up only with a bar, pullover only with a dumbbell
  ["gm_bandcurl", "gm_bandlat", "gm_bandohext", "gm_bandrevcurl", "gm_bandpulldown"].forEach((id) => [...used[id]].forEach((k) => expect(["band", "dumbbell+band+bench"], `${id} in ${k}`).toContain(k)));
  expect([...used.gm_pullup]).toEqual(["all home tools"]);
  [...used.gm_pullover].forEach((k) => expect(["dumbbell", "dumbbell+band+bench"]).toContain(k));
  // what the bodyweight kit now schedules (it had the most gaps)
  const bw = new Set();
  for (const days of S.DAYS) for (const sex of ["male", "female"]) S.buildPlan({ days, where: "home", sex, tools: ["none"] }).days.forEach((d) => d.exercises.forEach((e) => bw.add(e.id)));
  ["gm_declpush", "gm_inclpush", "gm_towelrow", "gm_yt", "gm_hipabd", "gm_soleus", "gm_sideplank"].forEach((id) => expect(bw.has(id), id).toBe(true));
});

test("a pull-up bar closes the bodyweight lats gap by name, and pull-ups appear when the bar is ticked", () => {
  const gap = S.buildPlan({ days: 4, where: "home", sex: "male", tools: ["none"] }).gaps.find((g) => g.kind === "region" && g.region === "back_lats");
  expect(gap && gap.tick).toEqual(["pullup_bar"]);
  expect(gap.needs).toBe("Pull-ups");
  const withBar = S.buildPlan({ days: 4, where: "home", sex: "male", tools: ["pullup_bar"] });
  expect(withBar.gaps.some((g) => g.kind === "region" && g.region === "back_lats")).toBe(false);
  expect(withBar.days.some((d) => d.exercises.some((e) => e.id === "gm_pullup"))).toBe(true);
});

test("id reuse: one move, one id, across every split and sex", () => {
  const idByName = {}, nameById = {};
  for (const c of cases) build(c).days.forEach((d) => d.exercises.forEach((e) => {
    (idByName[e.en] = idByName[e.en] || new Set()).add(e.id);
    (nameById[e.id] = nameById[e.id] || new Set()).add(e.en);
  }));
  Object.entries(idByName).forEach(([n, s]) => expect([...s], n).toHaveLength(1));
  Object.entries(nameById).forEach(([id, s]) => expect([...s], id).toHaveLength(1));
  expect(Object.keys(idByName).length).toBeGreaterThan(40);
});

test("id reuse: every scheduled id is an existing app.js library exercise with identical data", () => {
  const entry = /\{id:"([^"]+)", en:"([^"]+)", sets:\d+, reps:"[^"]+", rest:\d+, vid:"([^"]*)", shape:"([a-z_0-9]+)"(?:, shape2:"([a-z_0-9]+)")?, tier:"(\w+)", tools:\[([^\]]*)\]\}/g;
  const lib = {};
  for (let m; (m = entry.exec(appSrc)); ) lib[m[1]] = { en: m[2], vid: m[3], shape: m[4], shape2: m[5] || null, tier: m[6], tools: [...m[7].matchAll(/"([^"]+)"/g)].map((x) => x[1]) };
  Object.entries(S.library).forEach(([id, m]) => {
    expect(lib[id], `${id} is not in app.js`).toBeTruthy();
    expect({ en: m.en, vid: m.vid, shape: m.shape, shape2: m.shape2, tier: m.tier, tools: m.tools }, id).toEqual(lib[id]);
  });
  // every ranked id exists in the splits library
  Object.entries(S.parts).forEach(([p, part]) => [...part.r, ...(part.f || []), ...(part.x || [])].forEach((id) => expect(S.library[id], `${p} -> ${id}`).toBeTruthy()));
});

test("women's versions weight glutes and legs more than the men's", () => {
  for (const days of S.DAYS) for (const kit of [KITS[3], KITS[4], KITS[5]]) {
    const m = stats(S.buildPlan({ days, where: kit.where, sex: "male", tools: kit.tools })).groupSets;
    const f = stats(S.buildPlan({ days, where: kit.where, sex: "female", tools: kit.tools })).groupSets;
    expect(f.Glutes, `${days}d ${kit.key} glutes`).toBeGreaterThan(m.Glutes);
    expect(f.Quads + f.Hamstrings + f.Glutes, `${days}d ${kit.key} lower body`).toBeGreaterThan(m.Quads + m.Hamstrings + m.Glutes);
  }
});

test("A and B days use different angles (no chest/back/leg move repeats within a split when alternatives exist)", () => {
  const p = S.buildPlan({ days: 4, where: "gym", sex: "male" });
  const ids = (k) => p.days.find((d) => d.id.endsWith(k)).exercises.map((e) => e.id);
  const shared = (a, b) => a.filter((x) => b.includes(x));
  // the two upper days share only moves with a single option (lateral raise, the biceps/triceps superset)
  expect(shared(ids("upperA"), ids("upperB")).sort()).toEqual(["fua_arms", "mua_lateral"]);
  expect(shared(ids("lowerA"), ids("lowerB"))).toEqual(["mcp_hollow"]);
});

test("classic untouched: DAYS_MALE, DAYS_FEMALE, DAYS_MALE_CAL, DAYS_FEMALE_CAL, LEGACY_MALE_DAYS are byte-identical", () => {
  const expected = { DAYS_MALE: "ce5620195b42297a", LEGACY_MALE_DAYS: "61edf51985a69897", DAYS_FEMALE: "0224e351ca1e9de6", DAYS_MALE_CAL: "d1719c4b32f90b5c", DAYS_FEMALE_CAL: "dcf2b9864d6e6358" };
  Object.entries(expected).forEach(([n, h]) => {
    const i = appSrc.indexOf(`const ${n} = [`);
    expect(i, n).toBeGreaterThan(-1);
    const block = appSrc.slice(i, appSrc.indexOf("\n];", i) + 3);
    expect(crypto.createHash("sha256").update(block).digest("hex").slice(0, 16), n).toBe(h);
  });
});

test("wiring: splits.js loads before app.js and ships (service worker, Dockerfile COPY and hash)", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  expect(html.indexOf('<script src="splits.js"></script>')).toBeGreaterThan(-1);
  expect(html.indexOf('<script src="splits.js"></script>')).toBeLessThan(html.indexOf('<script src="app.js"></script>'));
  expect(fs.readFileSync(path.join(root, "service-worker.js"), "utf8")).toContain('"./splits.js"');
  const docker = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  expect(docker.match(/\bsplits\.js\b/g) || []).toHaveLength(2); // COPY + HASH
});

test("loads in the app as window.GymSplits", async ({ browser }) => {
  const { context, page } = await openApp(browser, {});
  await page.waitForFunction(() => window.GymSplits && window.GymApp);
  const r = await page.evaluate(() => {
    const p = window.GymSplits.buildPlan({ days: 5, where: "gym", sex: "female" });
    return { days: p.days.map((d) => d.id), n: window.GymSplits.DAYS };
  });
  expect(r.n).toEqual([3, 4, 5, 6]);
  expect(r.days[0]).toBe("sp5gf_upper");
  await context.close();
});
