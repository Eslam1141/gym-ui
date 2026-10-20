// Plan tab: a row of muscle-group tiles (picture + name) under the day title.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };
const chips = (page) => page.locator("#dayTabs .day-chip");
const tiles = (page) => page.locator("#dayMuscleTiles .mus-tile");

// Groups a day trains, in catalog order, computed from the app's own data.
const expected = (page, dayId, lang) => page.evaluate(([id, l]) => {
  const cat = window.GymApp.muscleShapes, byId = {};
  cat.forEach((s) => { byId[s.id] = s; });
  const used = new Set();
  window.GymApp.dayExercises(id).forEach((e) => [e.shape, e.shape2].forEach((s) => { if (byId[s]) used.add(byId[s].group); }));
  const out = [];
  cat.forEach((s) => { if (used.has(s.group) && !out.some((g) => g[0] === s.group)) out.push([s.group, l === "ar" ? s.groupAr : s.group]); });
  return out;
}, [dayId, lang]);

test("men upper tiles", async ({ browser }) => {
  const { context, page, consoleErrors } = await openApp(browser, { signedIn: true });
  await chips(page).first().click();
  const want = await expected(page, "m_upper", "en");
  expect(want.map((g) => g[0])).toEqual(["Chest", "Back", "Shoulders"]);
  await expect(tiles(page)).toHaveCount(want.length, T);
  expect(await tiles(page).evaluateAll((els) => els.map((e) => e.dataset.group))).toEqual(want.map((g) => g[0]));
  expect(await tiles(page).evaluateAll((els) => els.map((e) => e.textContent.trim()))).toEqual(want.map((g) => g[1]));
  // each tile carries a lit picture of its group
  await expect(page.locator("#dayMuscleTiles .mus-tile svg .ma-hi").first()).toBeVisible(T);
  expect(await page.locator("#dayMuscleTiles").getAttribute("hidden")).toBeNull();
  // the day title line stays
  await expect(page.locator("#dayMuscles")).toHaveText("Upper — Chest, Back, Shoulders");
  expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  await context.close();
});

test("tiles follow every built-in day", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  for (const [i, id] of [[0, "m_upper"], [1, "m_lower"], [3, "m_backbi"], [4, "m_chesttri"]]) {
    await chips(page).nth(i).click();
    const want = await expected(page, id, "en");
    await expect(tiles(page)).toHaveCount(want.length, T);
    expect(await tiles(page).evaluateAll((els) => els.map((e) => e.dataset.group))).toEqual(want.map((g) => g[0]));
  }
  await context.close();
});

test("ar tile names", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true, lang: "ar" });
  await chips(page).first().click();
  const want = await expected(page, "m_upper", "ar");
  await expect(tiles(page)).toHaveCount(want.length, T);
  expect(await tiles(page).evaluateAll((els) => els.map((e) => e.textContent.trim()))).toEqual(want.map((g) => g[1]));
  expect(want.map((g) => g[1])).toEqual(["صدر", "ظهر", "أكتاف"]);
  await context.close();
});

test("women's plan tiles use the female figure", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true, plan: "female" });
  await expect(tiles(page).first()).toBeVisible(T);
  await expect(page.locator("#dayMuscleTiles svg").first()).toHaveClass(/ma-female/);
  await context.close();
});

test("no tiles when no shapes", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.evaluate(() => GymApplyCoachPlan([{
    id: "coach_0", label: "Day", muscles: "x",
    exercises: [{ id: "c9", en: "Zzz Nothing", sets: 3, reps: "10", rest: 60 }]
  }]));
  await expect(page.locator(".ex-card")).toHaveCount(1, T);
  await expect(page.locator("#dayMuscleTiles")).toBeHidden();
  expect(await page.locator("#dayMuscleTiles").evaluate((e) => e.childElementCount)).toBe(0);
  expect(await page.locator("#dayMuscleTiles").evaluate((e) => e.getBoundingClientRect().height)).toBe(0);
  await context.close();
});

test("rest view hides tiles", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await expect(tiles(page).first()).toBeVisible(T);
  await chips(page).nth(2).click();
  await expect(page.locator(".rest-panel")).toBeVisible(T);
  await expect(page.locator("#dayMuscleTiles")).toBeHidden();
  expect(await page.locator("#dayMuscleTiles").evaluate((e) => e.childElementCount)).toBe(0);
  await chips(page).nth(0).click();
  await expect(tiles(page).first()).toBeVisible(T);
  await context.close();
});

for (const lang of ["en", "ar"]) {
  test("tiles wrap at 360 (" + lang + ")", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, lang, viewport: { width: 360, height: 800 } });
    // a day with all ten groups is the worst case for wrapping
    await page.evaluate(() => GymApplyCoachPlan([{
      id: "coach_0", label: "All", muscles: "all",
      exercises: window.GymApp.muscleShapes.map((s, i) => ({ id: "t" + i, en: "Zzz " + i, sets: 3, reps: "10", rest: 60, shape: s.id }))
    }]));
    await expect(tiles(page)).toHaveCount(10, T);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const boxes = await tiles(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
    boxes.forEach((b) => { expect(b.left).toBeGreaterThanOrEqual(0); expect(b.right).toBeLessThanOrEqual(360); });
    expect(new Set(boxes.map((b) => Math.round(b.top))).size).toBeGreaterThan(1);   // it wrapped onto more than one row
    await context.close();
  });
}
