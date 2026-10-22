// Muscle tags on the built-in exercises (the tag audit) and the exact/alias
// name -> muscle lookup that AI-coach plans fall back to.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

async function app(browser) {
  const o = await openApp(browser, {});
  await o.page.waitForFunction(() => window.GymMuscleArt && window.GymApp && window.GymApp.allDaySets);
  return o;
}

test("catalog and art agree on the 20 regions and their groups", async ({ browser }) => {
  const { context, page } = await app(browser);
  const r = await page.evaluate(() => {
    const cat = window.GymApp.muscleShapes;
    return {
      ids: cat.map((s) => s.id),
      art: window.GymMuscleArt.REGIONS,
      groups: [...new Set(cat.map((s) => s.group))].map((g) => [g, window.GymMuscleArt.group(g, { sex: "male" }) !== ""])
    };
  });
  expect(r.ids).toEqual(r.art);
  expect(r.ids.length).toBe(20);
  r.groups.forEach(([g, ok]) => expect(ok, g).toBe(true));
  await context.close();
});

test("all built-in exercises tagged", async ({ browser }) => {
  const { context, page } = await app(browser);
  const bad = await page.evaluate(() => {
    const ids = window.GymMuscleArt.REGIONS, out = [];
    window.GymApp.allDaySets().forEach((set) => set.forEach((d) => d.exercises.forEach((e) => {
      if (!ids.includes(e.shape)) out.push(e.id + ": shape " + e.shape);
      if (e.shape2 !== undefined && (!ids.includes(e.shape2) || e.shape2 === e.shape)) out.push(e.id + ": shape2 " + e.shape2);
    })));
    return out;
  });
  expect(bad).toEqual([]);
  await context.close();
});

test("same exercise name carries the same tags in every plan", async ({ browser }) => {
  const { context, page } = await app(browser);
  const clash = await page.evaluate(() => {
    const seen = {}, out = [];
    window.GymApp.allDaySets().forEach((set) => set.forEach((d) => d.exercises.forEach((e) => {
      const tag = e.shape + "|" + (e.shape2 || "");
      if (seen[e.en] && seen[e.en] !== tag) out.push(e.en + ": " + seen[e.en] + " vs " + tag);
      seen[e.en] = tag;
    })));
    return out;
  });
  expect(clash).toEqual([]);
  await context.close();
});

test("arms superset", async ({ browser }) => {
  const { context, page } = await app(browser);
  const found = await page.evaluate(() => {
    const out = [];
    window.GymApp.allDaySets().forEach((set) => set.forEach((d) => d.exercises.forEach((e) => {
      if (/biceps.*triceps/i.test(e.en)) out.push({ en: e.en, tags: [e.shape, e.shape2] });
    })));
    return out;
  });
  expect(found.length).toBeGreaterThan(0);
  found.forEach((f) => {
    expect(f.tags.filter((t) => /^biceps_/.test(t)).length, f.en).toBe(1);
    expect(f.tags.filter((t) => /^triceps_/.test(t)).length, f.en).toBe(1);
  });
  await context.close();
});

test("audited tags (see the tag-audit table in the PR)", async ({ browser }) => {
  const { context, page } = await app(browser);
  const got = await page.evaluate(() => {
    const m = {};
    window.GymApp.allDaySets().forEach((set) => set.forEach((d) => d.exercises.forEach((e) => { m[e.en] = [e.shape, e.shape2 || null]; })));
    return m;
  });
  expect(got["Hammer Curl"]).toEqual(["biceps_long", null]);
  expect(got["Dead Bug (core)"]).toEqual(["core_lower", null]);
  expect(got["Hollow Body Hold"]).toEqual(["core_lower", "core_upper"]);
  expect(got["Mountain Climbers"]).toEqual(["core_lower", "shoulder_front"]);
  expect(got["Burpees"]).toEqual(["quads", "chest_mid"]);
  expect(got["Squat Jumps"]).toEqual(["quads", "glutes"]);
  expect(got["Bear Crawl"]).toEqual(["core_obliques", "shoulder_front"]);
  expect(got["Flutter Kicks"]).toEqual(["core_lower", "quads"]);
  expect(got["Dumbbell Sumo Squat"]).toEqual(["quads", "glutes"]);
  expect(got["Biceps Curl + Triceps Extension (superset)"]).toEqual(["biceps_short", "triceps_long"]);
  await context.close();
});

test("lookup exact", async ({ browser }) => {
  const { context, page } = await app(browser);
  const r = await page.evaluate(() => {
    const f = window.GymExerciseShape;
    return {
      exact: f("barbell bench press"),
      spaced: f("  Barbell   Bench Press "),
      ar: f("بنش بريس بالبار"),
      alias: f("burpee"),
      aliasHit: f("Bench Press"),
      fuzzy: f("bench"),
      contains: f("incline dumbbell press for chest"),
      empty: f(""),
      nul: f(null),
      sidePlank: f("side plank"),
      two: f("Romanian Deadlift")
    };
  });
  expect(r.exact).toEqual({ shape: "chest_mid" });
  expect(r.spaced).toEqual({ shape: "chest_mid" });
  expect(r.ar).toEqual({ shape: "chest_mid" });
  expect(r.alias).not.toBeNull();
  expect(r.alias.shape).toBe("quads");
  expect(r.aliasHit).toEqual({ shape: "chest_mid" });
  expect(r.fuzzy).toBeNull();
  expect(r.contains).toBeNull();
  expect(r.empty).toBeNull();
  expect(r.nul).toBeNull();
  expect(r.sidePlank).toEqual({ shape: "core_obliques" });   // its own move now (gm_sideplank), not an alias of "Plank"
  expect(r.two).toEqual({ shape: "hamstrings", shape2: "back_lower" });
  await context.close();
});
