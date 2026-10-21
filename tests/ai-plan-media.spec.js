// AI-coach plan cards always show media or a calm stand-in: a library-named move gets its
// clip + muscle picture, an AI-tagged unknown move gets the picture, and a move with
// neither shows no picture and "Video coming soon" (disabled, never a guess).
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };
const cardOf = (page, id) => page.locator('.check[data-id="' + id + '"]').locator("xpath=ancestor::div[contains(@class,'ex-card')]");
const WP = { split: "Test", daysPerWeek: 1, days: [{ day: "Day A", exercises: [
  { name: "Barbell Bench Press", sets: 3, reps: "8", restSec: 90 },
  { name: "Hammer Curl", sets: 3, reps: "10", restSec: 60 },
  { name: "Lat Pulldown", sets: 3, reps: "10", restSec: 60 },       // alias
  { name: "Zzz Pulley Thing", sets: 3, reps: "10", restSec: 60, shape: "back_lats", shape2: "biceps_short" },
  { name: "Zzz Mystery Move", sets: 3, reps: "10", restSec: 60 }
] }] };

async function load(browser, lang, opts) {
  const o = await openApp(browser, Object.assign({ signedIn: true, lang }, opts));
  const plan = await o.page.evaluate((wp) => GymCoach.mapWorkout(wp), WP);
  await o.page.evaluate((p) => GymApplyCoachPlan(p), plan);
  return Object.assign({ plan }, o);
}

for (const [lang, soon] of [["en", "Video coming soon"], ["ar", "الفيديو قريباً"]]) {
  test("three card types (" + lang + ")", async ({ browser }) => {
    const { context, page } = await load(browser, lang);
    for (const id of ["coach_0_0", "coach_0_1", "coach_0_2"]) {   // library names + alias
      const c = cardOf(page, id);
      await expect(c.locator("[data-video]")).toBeVisible(T);
      await expect(c.locator(".ex-mus")).toBeVisible();
      await expect(c.locator(".video-soon")).toHaveCount(0);
    }
    const tagged = cardOf(page, "coach_0_3");
    await expect(tagged.locator('.ex-mus [data-region="back_lats"].ma-hi')).toBeVisible(T);
    await expect(tagged.locator("[data-video]")).toHaveCount(0);
    const pill = tagged.locator(".video-soon");
    await expect(pill).toHaveText(soon);
    await expect(pill).toHaveAttribute("aria-disabled", "true");
    await expect(pill).toHaveAttribute("aria-label", soon);
    const none = cardOf(page, "coach_0_4");
    await expect(none.locator(".ex-mus, .ex-mus-chip")).toHaveCount(0);
    await expect(none.locator(".video-soon")).toHaveText(soon);
    await expect(none.locator("[data-video]")).toHaveCount(0);
    // the pill is a stand-in, not a control: it keeps the 44px row height
    expect((await pill.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await context.close();
  });
}

test("old saved plan without clips or tags: library names get both at render", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.evaluate(() => {
    localStorage.setItem("gym_plans_custom", JSON.stringify([{
      id: "coach_0", label: "Old plan", muscles: "x",
      exercises: [
        { id: "coach_0_0", en: "Barbell Bench Press", sets: 3, reps: "8", rest: 90 },
        { id: "coach_0_1", en: "Zercher Carry", sets: 3, reps: "8", rest: 90 }
      ]
    }]));
    localStorage.setItem("gym_style", "coach");
  });
  await page.reload();
  await page.waitForFunction(() => window.GymMuscleArt, null, { timeout: 15000 });
  await expect(cardOf(page, "coach_0_0").locator("[data-video]")).toBeVisible(T);
  await expect(cardOf(page, "coach_0_0").locator(".ex-mus")).toBeVisible();
  await expect(cardOf(page, "coach_0_1").locator(".video-soon")).toBeVisible(T);
  await expect(cardOf(page, "coach_0_1").locator(".ex-mus")).toHaveCount(0);
  await context.close();
});

test("AI shape ids tolerate case and hyphens; video is exact, never fuzzy", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  const r = await page.evaluate(() => ({
    plan: GymCoach.mapWorkout({ days: [{ day: "A", exercises: [{ name: "Zzz", shape: " Back-Lats ", shape2: "Biceps_Short" }] }] }),
    near: GymExerciseVideo("Incline Push-ups Variation"),
    ar: GymExerciseVideo("ضغط بنش"),
    exact: GymExerciseVideo("Leg Press")
  }));
  expect(r.plan[0].exercises[0].shape).toBe("back_lats");
  expect(r.plan[0].exercises[0].shape2).toBe("biceps_short");
  expect(r.near).toBe("");
  expect(r.exact).not.toBe("");
  await context.close();
});

test("reduced motion: the pill renders in place, no entrance class left", async ({ browser }) => {
  const { context, page } = await load(browser, "en", { contextOptions: { reducedMotion: "reduce" } });
  const c = cardOf(page, "coach_0_4");
  await expect(c.locator(".video-soon")).toBeVisible(T);
  await expect(c).not.toHaveClass(/anim-in/);
  expect(await c.locator(".video-soon").evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
  await context.close();
});
