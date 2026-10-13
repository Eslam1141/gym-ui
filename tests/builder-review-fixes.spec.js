const { test, expect } = require("@playwright/test");
const { openBuilder, rowByName, T } = require("./builder-helpers");

// Regressions from the pre-merge review of the builder redesign.
test.setTimeout(45000);
const DESKTOP = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };
const placedNames = (page) => page.locator(".wb-placed-ex").evaluateAll((els) => els.map((e) => e.getAttribute("data-ex-name") || e.textContent));

async function add(page, names) {
  // Search first: rows in collapsed muscle groups aren't visible.
  for (const n of names) {
    await page.locator(".wb-search").fill(n);
    await rowByName(page, n).locator(".wb-add").click();
    await expect(rowByName(page, n)).toHaveClass(/wb-ex-in/, T);
  }
  await page.locator(".wb-search").fill("");
}

test("two quick removes delete the rows that were tapped", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, { viewport: DESKTOP });
  await add(page, ["Incline Dumbbell Press", "Dumbbell Bench Press", "Lat Pulldown / Pull-up"]);
  await expect(page.locator(".wb-placed-ex")).toHaveCount(3);
  // Second tap lands while the first row's exit animation is still running.
  await page.evaluate(() => {
    const btns = document.querySelectorAll(".wb-panel .wb-placed-ex .wb-remove-btn");
    btns[0].click();
    btns[1].click();
  });
  await expect(page.locator(".wb-placed-ex")).toHaveCount(1, { timeout: 3000 });
  expect((await placedNames(page)).join(" ")).toContain("Lat Pulldown");
  await context.close();
});

test("the bottom nav is hidden while the Review sheet is open", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, { viewport: PHONE });
  await add(page, ["Dumbbell Bench Press"]);
  await expect(page.locator("#appNav")).toBeVisible();
  await page.locator(".wb-review").click();
  await expect(page.locator(".wb-sheet")).toBeVisible(T);
  await expect(page.locator("#appNav")).toBeHidden();
  await page.locator(".wb-sheet-close").click();
  await expect(page.locator(".wb-sheet")).toHaveCount(0, T);
  await expect(page.locator("#appNav")).toBeVisible();
  await context.close();
});

test("removing a row inside the sheet keeps focus in the sheet, so Escape still closes it", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, { viewport: PHONE });
  await add(page, ["Dumbbell Bench Press", "Lat Pulldown / Pull-up"]);
  await page.locator(".wb-review").click();
  await expect(page.locator(".wb-sheet")).toBeVisible(T);
  await page.locator(".wb-sheet .wb-remove-btn").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".wb-sheet .wb-placed-ex")).toHaveCount(1, { timeout: 3000 });
  expect(await page.evaluate(() => !!document.activeElement.closest(".wb-sheet"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator(".wb-sheet")).toHaveCount(0, T);
  await context.close();
});

test("sign-out drops the unsaved builder draft", async ({ browser }) => {
  const { context, page } = await openBuilder(browser);
  await page.evaluate(() => {
    sessionStorage.setItem("gym_wb_draft", JSON.stringify({ days: [{ name: "Old user", exercises: [] }] }));
    GymSync.signOut();
  });
  expect(await page.evaluate(() => sessionStorage.getItem("gym_wb_draft"))).toBeNull();
  await context.close();
});

test("a new day never reuses a name; a cleared name saves as its default", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, { viewport: DESKTOP });
  for (let i = 0; i < 2; i++) await page.locator(".wb-tab-add").click(); // Day 1-3
  await page.locator(".wb-tab").nth(1).click();
  await page.locator(".wb-remove-day").click(); // remove Day 2 (empty, no undo)
  await page.locator(".wb-tab-add").click();
  const tabNames = await page.locator(".wb-tab:not(.wb-tab-add)").allTextContents();
  expect(tabNames.join("|")).toMatch(/Day 4/);
  expect(tabNames.filter((t) => /Day 3/.test(t))).toHaveLength(1);

  await page.locator(".wb-tab").first().click();
  await add(page, ["Leg Press"]);
  await page.locator(".wb-day-name").fill("   ");
  const plan = await page.evaluate(() => GymWorkoutBuilder.exportAsWorkoutPlan());
  expect(plan.days[0].day).toBe("Day 1");
  await context.close();
});
