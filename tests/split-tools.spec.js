// Every library exercise declares the gear it REQUIRES (`tools`), which the
// training-splits builder uses to keep home plans free of gym-only moves.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

const ALLOWED = ["none", "dumbbell", "band", "bench", "table", "pullup_bar", "kettlebell", "jump_rope", "barbell", "cable", "machine"];
const GYM_ONLY = ["barbell", "cable", "machine"];

async function allExercises(browser) {
  const { context, page } = await openApp(browser, {});
  await page.waitForFunction(() => window.GymApp && window.GymApp.allDaySets);
  const list = await page.evaluate(() => {
    const out = [];
    window.GymApp.allDaySets().forEach((set) => set.forEach((d) => d.exercises.forEach((e) => out.push({ id: e.id, en: e.en, tools: e.tools }))));
    return out;
  });
  await context.close();
  return list;
}

test("every library exercise has non-empty tools from the allowed set", async ({ browser }) => {
  const list = await allExercises(browser);
  expect(list.length).toBeGreaterThan(100);
  const bad = list.filter((e) => !Array.isArray(e.tools) || !e.tools.length || e.tools.some((t) => !ALLOWED.includes(t)));
  expect(bad.map((e) => e.id + " " + JSON.stringify(e.tools))).toEqual([]);
});

test("'none' is never mixed with other tools, and one move has one tool set", async ({ browser }) => {
  const list = await allExercises(browser);
  expect(list.filter((e) => e.tools.includes("none") && e.tools.length > 1).map((e) => e.id)).toEqual([]);
  const byName = {};
  list.forEach((e) => { (byName[e.en] = byName[e.en] || new Set()).add([...e.tools].sort().join("+")); });
  expect(Object.entries(byName).filter(([, s]) => s.size > 1).map(([n]) => n)).toEqual([]);
});

test("barbell, cable and machine moves never land in a home pool", async ({ browser }) => {
  const list = await allExercises(browser);
  const homeTools = ALLOWED.filter((t) => !GYM_ONLY.includes(t));
  // The most generous home toolset (everything ticked) plus each single tool.
  const toolsets = [homeTools, ...homeTools.map((t) => [t])];
  toolsets.forEach((have) => {
    const pool = list.filter((e) => e.tools.every((t) => t === "none" || have.includes(t)));
    expect(pool.filter((e) => e.tools.some((t) => GYM_ONLY.includes(t))).map((e) => e.id)).toEqual([]);
  });
  const names = (have) => new Set(list.filter((e) => e.tools.every((t) => t === "none" || have.includes(t))).map((e) => e.en));
  const home = names(homeTools);
  ["Barbell Bench Press", "Barbell Back Squat", "Leg Press", "Seated Cable Row", "Hack Squat", "Cable Rope Pushdown"].forEach((n) => expect(home.has(n), n).toBe(false));
  ["Push-ups", "Goblet Squat", "Dumbbell Bench Press", "Band Face Pull", "Inverted Row (under a table)"].forEach((n) => expect(home.has(n), n).toBe(true));
  expect(names(["none"]).has("Dumbbell Bench Press")).toBe(false);
});
