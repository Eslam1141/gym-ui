// AI-coach plans: a tag from the assistant is used when valid; otherwise an
// exact/alias name match against the built-in exercises; otherwise nothing.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };
const cardOf = (page, id) => page.locator('.check[data-id="' + id + '"]').locator("xpath=ancestor::div[contains(@class,'ex-card')]");

const WP = (exercises) => ({ split: "Test", daysPerWeek: 1, days: [{ day: "Day A", exercises }] });

test("coach shape used", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  const plan = await page.evaluate((wp) => GymCoach.mapWorkout(wp), WP([
    { name: "Zzz Pulley Thing", sets: 3, reps: "10", restSec: 60, shape: "back_lats", shape2: "biceps_short" }
  ]));
  expect(plan[0].exercises[0].shape).toBe("back_lats");
  expect(plan[0].exercises[0].shape2).toBe("biceps_short");
  await page.evaluate((p) => GymApplyCoachPlan(p), plan);
  const c = cardOf(page, "coach_0_0");
  await expect(c.locator('.ex-mus [data-region="back_lats"].ma-hi')).toBeVisible(T);
  await expect(c.locator(".ex-mus-chip")).toHaveText("Lats (width) · Short head (inner)");
  await context.close();
});

test("invalid shape dropped", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  const plan = await page.evaluate((wp) => GymCoach.mapWorkout(wp), WP([
    { name: "Zzz Wings", sets: 3, reps: "10", restSec: 60, shape: "wings", shape2: "quads" },
    { name: "Zzz Half", sets: 3, reps: "10", restSec: 60, shape: "calves", shape2: "wings" },
    { name: "Zzz Same", sets: 3, reps: "10", restSec: 60, shape: "calves", shape2: "calves" }
  ]));
  expect(plan[0].exercises[0].shape).toBeUndefined();
  expect(plan[0].exercises[0].shape2).toBeUndefined();
  expect(plan[0].exercises[1].shape).toBe("calves");
  expect(plan[0].exercises[1].shape2).toBeUndefined();
  expect(plan[0].exercises[2].shape2).toBeUndefined();
  await page.evaluate((p) => GymApplyCoachPlan(p), plan);
  await expect(cardOf(page, "coach_0_0")).toBeVisible(T);
  await expect(cardOf(page, "coach_0_0").locator(".ex-mus, .ex-mus-chip")).toHaveCount(0);
  await expect(cardOf(page, "coach_0_1").locator(".ex-mus-chip")).toHaveText("Calves");
  await context.close();
});

test("name fallback in mapWorkout: exact or alias only", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  const plan = await page.evaluate((wp) => GymCoach.mapWorkout(wp), WP([
    { name: "Barbell Bench Press", sets: 3, reps: "8", restSec: 90 },
    { name: "Bench Press", sets: 3, reps: "8", restSec: 90 },
    { name: "Bench", sets: 3, reps: "8", restSec: 90 }
  ]));
  expect(plan[0].exercises[0].shape).toBe("chest_mid");
  expect(plan[0].exercises[1].shape).toBe("chest_mid");
  expect(plan[0].exercises[2].shape).toBeUndefined();
  await context.close();
});

test("legacy coach plan without shape", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  // a plan saved before tags existed: names only
  await page.evaluate(() => {
    localStorage.setItem("gym_plans_custom", JSON.stringify([{
      id: "coach_0", label: "Old plan", muscles: "x",
      exercises: [
        { id: "coach_0_0", en: "Barbell Bench Press", sets: 3, reps: "8", rest: 90 },
        { id: "coach_0_1", en: "Zercher Carry", sets: 3, reps: "8", rest: 90 },
        { id: "coach_0_2", en: "Bench Press", sets: 3, reps: "8", rest: 90 },
        { id: "coach_0_3", en: "Bench", sets: 3, reps: "8", rest: 90 }
      ]
    }]));
    localStorage.setItem("gym_style", "coach");
  });
  await page.reload();
  await page.waitForFunction(() => window.GymRest && window.GymDate && window.GymMuscleArt, null, { timeout: 15000 });
  await expect(cardOf(page, "coach_0_0")).toBeVisible(T);
  await expect(cardOf(page, "coach_0_0").locator('.ex-mus [data-region="chest_mid"].ma-hi')).toBeVisible(T);
  await expect(cardOf(page, "coach_0_0").locator(".ex-mus-chip")).toHaveText("Mid chest");
  await expect(cardOf(page, "coach_0_2").locator('.ex-mus [data-region="chest_mid"].ma-hi')).toBeVisible(T);   // alias
  for (const id of ["coach_0_1", "coach_0_3"]) {   // unknown, and a fuzzy near-miss
    await expect(cardOf(page, id)).toBeVisible(T);
    await expect(cardOf(page, id).locator(".ex-mus, .ex-mus-chip")).toHaveCount(0);
  }
  // only the tagged exercises feed the day tiles
  expect(await page.locator("#dayMuscleTiles .mus-tile").evaluateAll((els) => els.map((e) => e.dataset.group))).toEqual(["Chest"]);
  await context.close();
});
