// Plan tab: each exercise card shows a close-up of its body area with the
// trained part lit, plus a chip naming it.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };

const cardOf = (page, id) => page.locator('.check[data-id="' + id + '"]').locator("xpath=ancestor::div[contains(@class,'ex-card')]");

test("card shows primary", async ({ browser }) => {
  const { context, page, consoleErrors } = await openApp(browser, { signedIn: true });
  const card = cardOf(page, "mua_bench");
  await expect(card).toBeVisible(T);
  await expect(card.locator('.ex-mus [data-region="chest_mid"].ma-hi')).toBeVisible(T);
  await expect(card.locator(".ex-mus .ma-hi")).toHaveCount(1);
  await expect(card.locator(".ex-mus-chip")).toHaveText("Mid chest");
  await expect(card.locator(".ex-mus")).toHaveAttribute("role", "img");
  await expect(card.locator(".ex-mus")).toHaveAttribute("aria-label", "Mid chest");
  // every built-in exercise on this day gets its own picture and chip
  const n = await page.locator(".ex-card").count();
  await expect(page.locator(".ex-card .ex-mus")).toHaveCount(n);
  await expect(page.locator(".ex-card .ex-mus-chip")).toHaveCount(n);
  expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  await context.close();
});

test("secondary muscle: lighter tint and both names on the chip", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.evaluate(() => GymApplyCoachPlan([{
    id: "coach_0", label: "Day", muscles: "Legs",
    exercises: [
      { id: "c0", en: "Zzz A", sets: 3, reps: "10", rest: 60, shape: "hamstrings", shape2: "back_lower" },
      { id: "c1", en: "Zzz B", sets: 3, reps: "10", rest: 60, shape: "quads", shape2: "glutes" }
    ]
  }]));
  const a = cardOf(page, "c0");
  await expect(a.locator('.ex-mus [data-region="hamstrings"].ma-hi')).toBeVisible(T);
  await expect(a.locator('.ex-mus [data-region="back_lower"].ma-hi2')).toHaveCount(1);
  await expect(a.locator(".ex-mus-chip")).toHaveText("Hamstrings · Lower back / traps");
  await context.close();
});

test("cross-view secondary", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.evaluate(() => GymApplyCoachPlan([{
    id: "coach_0", label: "Day", muscles: "Legs",
    exercises: [{ id: "c1", en: "Zzz B", sets: 3, reps: "10", rest: 60, shape: "quads", shape2: "glutes" }]
  }]));
  const c = cardOf(page, "c1");
  await expect(c.locator('.ex-mus [data-region="quads"].ma-hi')).toBeVisible(T);
  // glutes live on the back view; the close-up keeps the primary's (front) view
  await expect(c.locator('.ex-mus [data-region="glutes"].ma-hi2')).toHaveCount(0);
  await expect(c.locator('.ex-mus [data-region="hamstrings"]')).toHaveCount(0);   // no back-view muscles are drawn
  const chip = await c.locator(".ex-mus-chip").textContent();
  expect(chip).toContain("Quads");
  expect(chip).toContain("Glutes");
  await context.close();
});

test("ar rtl closeup", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true, lang: "ar" });
  const card = cardOf(page, "mua_bench");
  await expect(card.locator(".ex-mus-chip")).toHaveText("صدر أوسط", T);
  await expect(card.locator(".ex-mus")).toHaveAttribute("aria-label", "صدر أوسط");
  const [img, title] = await Promise.all([card.locator(".ex-mus").boundingBox(), card.locator(".ex-title .en").boundingBox()]);
  expect(img.x).toBeGreaterThan(title.x);   // the picture is on the start (right) side
  await context.close();
});

test("persona switch swaps figure", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await expect(page.locator(".ex-card .ex-mus svg").first()).toHaveClass(/ma-male/, T);
  const before = await page.evaluate(() => getComputedStyle(document.querySelector(".ex-mus")).backgroundColor);
  await page.evaluate(() => document.querySelector('[data-plan-btn="female"]').click());
  await expect(page.locator(".ex-card .ex-mus svg").first()).toHaveClass(/ma-female/, T);
  expect(await page.locator(".ex-card .ex-mus svg.ma-male").count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.dataset.plan)).toBe("female");
  // the lit colour follows the persona's palette with no re-render
  const lit = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim());
  expect(lit.toLowerCase()).toBe("#c2347a");
  expect(before).toBeTruthy();
  await context.close();
});

test("anonymous preview keeps the male figure", async ({ browser }) => {
  const { context, page } = await openApp(browser, { plan: "female" });
  await expect(page.locator(".ex-card .ex-mus svg").first()).toHaveClass(/ma-male/, T);
  await context.close();
});

test("an exercise with no tags shows no picture and no chip", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.evaluate(() => GymApplyCoachPlan([{
    id: "coach_0", label: "Day", muscles: "x",
    exercises: [{ id: "c9", en: "Zzz Nothing", sets: 3, reps: "10", rest: 60 },
      { id: "c8", en: "Zzz Bad", sets: 3, reps: "10", rest: 60, shape: "wings" }]
  }]));
  for (const id of ["c9", "c8"]) {
    await expect(cardOf(page, id)).toBeVisible(T);
    await expect(cardOf(page, id).locator(".ex-mus, .ex-mus-chip")).toHaveCount(0);
  }
  await context.close();
});

for (const lang of ["en", "ar"]) {
  test("360 no overflow (" + lang + ")", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, lang, viewport: { width: 360, height: 800 } });
    await expect(page.locator(".ex-card .ex-mus").first()).toBeVisible(T);
    await page.waitForTimeout(500);   // card entrance animation
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const boxes = await page.locator(".ex-card").first().locator(".set-chk").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
    expect(boxes.length).toBeGreaterThan(0);
    boxes.forEach((b) => { expect(b.left).toBeGreaterThanOrEqual(0); expect(b.right).toBeLessThanOrEqual(360); });
    // the picture never squeezes the title column below a readable width
    const w = await page.locator(".ex-card").first().locator(".ex-title").evaluate((e) => e.getBoundingClientRect().width);
    expect(w).toBeGreaterThan(120);
    await context.close();
  });
}
