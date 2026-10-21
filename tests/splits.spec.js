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

// Regions the current library cannot train on two different days, per toolset (all splits and
// sexes agree). Each one is returned in `gaps`; the owner supplies the missing clips.
const EXPECTED_REGION_GAPS = {
  "bodyweight only": ["back_lats", "back_mid", "biceps_long", "biceps_short", "chest_lower", "chest_upper", "hamstrings", "shoulder_rear", "shoulder_side", "triceps_lateral", "triceps_long"],
  dumbbell: ["back_lats", "chest_lower", "chest_upper", "shoulder_rear", "triceps_lateral"],
  band: ["back_lats", "back_mid", "biceps_long", "biceps_short", "chest_lower", "chest_upper", "hamstrings", "shoulder_side", "triceps_lateral", "triceps_long"],
  "dumbbell+band+bench": ["back_lats", "chest_lower"],
  "all home tools": ["chest_lower"],
  gym: ["chest_lower"]
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
    expect(["easy", "medium", "hard"]).toContain(e.tier);
  }));
});

for (const c of cases) {
  test(`coverage: ${c.name}`, () => {
    const plan = build(c);
    const { regionDays, groupSets, groupDay } = stats(plan);
    const gapRegions = new Set(plan.gaps.filter((g) => g.kind === "region").map((g) => g.region));
    const gapGroups = new Set(plan.gaps.map((g) => g.group));
    // every region on >=2 different days, or recorded in gaps
    REGIONS.forEach((r) => {
      const n = (regionDays[r] || new Set()).size;
      if (n >= 2) expect(gapRegions.has(r), `${r} is hit on ${n} days but listed as a gap`).toBe(false);
      else expect(gapRegions.has(r), `${r} hit on ${n} day(s) and not in gaps`).toBe(true);
    });
    // weekly sets per muscle group 8-20, or the group has a recorded gap
    new Set(Object.values(S.REGIONS)).forEach((g) => {
      const n = groupSets[g] || 0;
      if (n < 8 || n > 20) expect(gapGroups.has(g), `${g} has ${n} sets/week and no gap`).toBe(true);
      if (n > 20) throw new Error(`${g} has ${n} sets/week (over 20)`);
    });
    // no group over 10 sets in one session
    Object.entries(groupDay).forEach(([g, n]) => expect(n, `${g} in one day`).toBeLessThanOrEqual(10));
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
        expect(["region", "substituted", "unfilled"]).toContain(g.kind);
        expect(g.region && g.group, JSON.stringify(g)).toBeTruthy();
        // a fix is named (a clip to supply now) or a tool to tick; gym upgrades have neither
        if (kit.where === "home" || g.kind !== "region") expect(g.needs || g.tick || g.kind === "substituted", JSON.stringify(g)).toBeTruthy();
      });
    }
    expect([...union].sort(), kit.key).toEqual(EXPECTED_REGION_GAPS[kit.key]);
  }
});

test("bodyweight only: a full split, no empty day, gaps listed", () => {
  for (const days of S.DAYS) for (const sex of ["male", "female"]) {
    const p = S.buildPlan({ days, where: "home", sex, tools: ["none"] });
    expect(p.days.length).toBe(days);
    p.days.forEach((d) => expect(d.exercises.length, d.id).toBeGreaterThanOrEqual(2));
    p.days.forEach((d) => d.exercises.forEach((e) => expect(e.tools, e.id).toEqual(["none"])));
    // no biceps, triceps or hamstring move needs fewer than a tool tick: unfilled, not faked
    const unfilled = new Set(p.gaps.filter((g) => g.kind === "unfilled").map((g) => g.group));
    ["Biceps", "Triceps", "Hamstrings"].forEach((g) => expect(unfilled.has(g), g).toBe(true));
    expect(p.gaps.length).toBeGreaterThan(10);
    // an empty tools array and a missing one both mean bodyweight
    expect(S.buildPlan({ days, where: "home", sex, tools: [] })).toEqual(p);
    expect(S.buildPlan({ days, where: "home", sex })).toEqual(p);
  }
  // ticking a pull-up bar / table / bench starts to close the gaps
  const more = S.buildPlan({ days: 4, where: "home", sex: "male", tools: ["none", "table", "bench"] });
  const base = S.buildPlan({ days: 4, where: "home", sex: "male", tools: ["none"] });
  expect(more.gaps.length).toBeLessThan(base.gaps.length);
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
  Object.entries(S.parts).forEach(([p, part]) => [...part.r, ...(part.f || [])].forEach((id) => expect(S.library[id], `${p} -> ${id}`).toBeTruthy()));
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
  // the two upper days share only moves with a single option (incline press, lateral raise, barbell curl)
  expect(shared(ids("upperA"), ids("upperB")).sort()).toEqual(["mua_curl", "mua_lateral", "mub_incline"]);
  expect(shared(ids("lowerA"), ids("lowerB"))).toEqual(["mcx_superman"]);
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
