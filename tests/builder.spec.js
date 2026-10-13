const { test, expect } = require("@playwright/test");
const { openBuilder, freeRow, rowByName, T } = require("./builder-helpers");

test.setTimeout(45000);
const DESKTOP = { width: 1280, height: 900 };
const exportPlan = (page) => page.evaluate(() => GymWorkoutBuilder.exportAsWorkoutPlan());

test("search filters the palette and offers a way out when nothing matches", async ({ browser }) => {
  const { context, page } = await openBuilder(browser);
  const all = await page.locator(".wb-ex").count();
  await page.locator(".wb-search").fill("leg press");
  await expect(rowByName(page, "Leg Press")).toBeVisible(T);
  const hits = await page.locator(".wb-ex").count();
  expect(hits).toBeLessThan(all);
  expect(hits).toBeGreaterThan(0);
  await page.locator(".wb-search").fill("zzzzqq");
  await expect(page.locator(".wb-noresults")).toContainText("zzzzqq");
  await page.locator(".wb-noresults .wb-link").click();
  await expect(page.locator(".wb-search")).toHaveValue("");
  await expect(page.locator(".wb-noresults")).toHaveCount(0);
  await context.close();
});

test("a blocked row stays readable, says why, and tapping it names the blocker", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, { viewport: DESKTOP });
  await rowByName(page, "Dumbbell Bench Press").locator(".wb-add").click();
  const blocked = rowByName(page, "Barbell Bench Press");
  await expect(blocked).toHaveClass(/wb-ex-blocked/);
  await expect(blocked.locator(".wb-ex-why")).toContainText("Mid chest used");
  await expect(blocked.locator(".wb-ex-main")).toHaveAttribute("aria-disabled", "true");
  await blocked.locator(".wb-ex-main").click({ force: true }); // aria-disabled, not disabled
  await expect(page.locator(".wb-placed-ex")).toHaveCount(1);
  await expect(page.locator(".wb-reject")).toContainText("Dumbbell Bench Press");
  await expect(blocked).toHaveClass(/wb-shake/);
  await context.close();
});

test("tapping the check removes the exercise and Undo puts it back", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, { viewport: DESKTOP });
  const row = rowByName(page, "Dumbbell Bench Press");
  await row.locator(".wb-add").click();
  await expect(row).toHaveClass(/wb-ex-in/);
  await row.locator(".wb-add").click();
  await expect(page.locator(".wb-placed-ex")).toHaveCount(0);
  await expect(page.locator(".wb-undo")).toContainText("Dumbbell Bench Press");
  await page.locator(".wb-undo-btn").click();
  await expect(page.locator(".wb-placed-ex")).toHaveCount(1);
  await expect(rowByName(page, "Dumbbell Bench Press")).toHaveClass(/wb-ex-in/);
  await context.close();
});

test("save is disabled with a helper, then shows the summary; empty days are skipped", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, { viewport: DESKTOP });
  await expect(page.locator(".wb-save")).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator(".wb-save-help")).toContainText("Add at least one exercise to save");
  await page.locator(".wb-tab-add").click(); // Day 2 stays empty
  await page.locator(".wb-tab").first().click();
  await freeRow(page).locator(".wb-add").click();
  await expect(page.locator(".wb-save")).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.locator(".wb-save-sum")).toHaveText("1 day · 1 exercise");
  await expect(page.locator(".wb-save-help")).toContainText("Day 2 is empty and will be skipped");
  const plan = await exportPlan(page);
  expect(plan.split).toBe("Custom");
  expect(plan.days).toHaveLength(1);
  expect(plan.days[0].day).toBe("Day 1");
  expect(Object.keys(plan.days[0].exercises[0]).sort()).toEqual(["name", "reps", "restSec", "sets"]);
  await context.close();
});

test("plans are capped at 7 days", async ({ browser }) => {
  const { context, page } = await openBuilder(browser);
  for (let i = 0; i < 6; i++) await page.locator(".wb-tab-add").click();
  await expect(page.locator(".wb-tab:not(.wb-tab-add)")).toHaveCount(7);
  await expect(page.locator(".wb-tab-add")).toHaveCount(0);
  await context.close();
});

test("new days are named in the UI language", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, { lang: "ar" });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.locator(".wb-tab-add").click();
  await expect(page.locator(".wb-tab:not(.wb-tab-add)").nth(0).locator(".wb-tab-name")).toHaveText("اليوم 1");
  await expect(page.locator(".wb-tab:not(.wb-tab-add)").nth(1).locator(".wb-tab-name")).toHaveText("اليوم 2");
  await context.close();
});

test("the draft survives slots-full, My plans and coming back", async ({ browser }) => {
  const saved = [1, 2, 3].map((n) => ({ savedAt: n, result: { id: "old" + n, want: "workout", model: "Custom", workoutPlan: { split: "Custom", days: [] } } }));
  const { context, page } = await openBuilder(browser, { viewport: DESKTOP, ls: { gym_coach_saved: saved } });
  await rowByName(page, "Dumbbell Bench Press").locator(".wb-add").click();
  await page.locator(".wb-save").click();
  await expect(page.locator(".wb-save-err")).toContainText("3 plan slots are full");
  await page.locator(".wb-save-err .wb-link").click();
  await expect(page.locator(".coach-myplans")).toBeVisible(T);
  await page.locator(".coach-myplans .coach-secondary").first().click(); // Back
  await page.evaluate(() => GymWorkoutBuilder.open());
  await expect(page.locator(".wb-placed-ex")).toHaveCount(1);
  await expect(page.locator(".wb-placed-name")).toHaveText("Dumbbell Bench Press");
  await context.close();
});

test("preview opens the video modal and does not add the exercise", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, { viewport: DESKTOP });
  const row = rowByName(page, "Dumbbell Bench Press");
  const vid = await page.evaluate(() => [].concat(DAYS_PREVIEW, DAYS_MALE).reduce((a, d) => a.concat(d.exercises), []).filter((e) => e.en === "Dumbbell Bench Press")[0].vid);
  await expect(row.locator(".wb-preview")).toHaveAttribute("aria-label", "Watch how: Dumbbell Bench Press");
  await row.locator(".wb-preview").click();
  await expect(page.locator("#videoModal.show iframe")).toHaveAttribute("src", new RegExp(vid), T);
  await expect(page.locator(".wb-placed-ex")).toHaveCount(0);
  await expect(row).not.toHaveClass(/wb-ex-in/);
  await context.close();
});

for (const [name, viewport] of [["390px", { width: 390, height: 844 }], ["1280px", DESKTOP]]) {
  test(`layout at ${name}: no horizontal scroll and 44px targets`, async ({ browser }) => {
    const { context, page } = await openBuilder(browser, { viewport });
    await freeRow(page).locator(".wb-add").click();
    const r = await page.evaluate(() => {
      const small = [];
      document.querySelectorAll(".wb-screen button, .wb-screen input").forEach((el) => {
        const b = el.getBoundingClientRect();
        if (!b.width || el.classList.contains("wb-link")) return;
        if (b.height < 43.5) small.push(el.className + " " + Math.round(b.width) + "x" + Math.round(b.height));
      });
      return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, small };
    });
    expect(r.overflow).toBeLessThanOrEqual(0);
    expect(r.small).toEqual([]);
    await context.close();
  });
}
