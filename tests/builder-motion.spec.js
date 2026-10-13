const { test, expect } = require("@playwright/test");
const { openBuilder, freeRow, T } = require("./builder-helpers");

test.setTimeout(45000);
const DESKTOP = { width: 1280, height: 900 };

test("opening the builder staggers in, then cleans up", async ({ browser }) => {
  const { context, page, consoleErrors } = await openBuilder(browser, { reducedMotion: "no-preference" });
  await expect(page.locator(".wb-groups")).toHaveClass(/m-enter/);
  await expect(page.locator(".wb-head")).toHaveClass(/m-enter/);
  await expect(page.locator(".wb-groups")).not.toHaveClass(/m-enter/, { timeout: 3000 });
  expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  await context.close();
});

test("adding and removing an exercise animates only that row", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, { reducedMotion: "no-preference", viewport: DESKTOP });
  await freeRow(page).locator(".wb-add").click();
  const row = page.locator(".wb-placed-ex");
  await expect(row).toHaveCount(1);
  await expect(row).toHaveClass(/wb-in/);
  await expect(page.locator(".wb-added-row")).toHaveCount(1);
  await expect(page.locator(".wb-panel-count")).toHaveClass(/m-pop/);

  // An unrelated rerender (filter toggle) must not replay the row's entrance.
  await page.locator(".wb-chip").nth(1).click();
  await expect(page.locator(".wb-placed-ex")).not.toHaveClass(/wb-in/);
  await expect(page.locator(".wb-groups")).toHaveClass(/m-enter/);
  await page.locator(".wb-chip").nth(0).click();

  // Remove: the row leaves first, then is gone.
  await page.locator(".wb-remove-btn").click();
  await expect(page.locator(".wb-placed-ex")).toHaveClass(/wb-out/);
  await expect(page.locator(".wb-placed-ex")).toHaveCount(0, { timeout: 2000 });
  await context.close();
});

test("on a phone the tray count pops when an exercise is added", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, { reducedMotion: "no-preference" });
  await freeRow(page).locator(".wb-add").click();
  await expect(page.locator(".wb-tray-count")).toHaveClass(/m-pop/);
  await expect(page.locator(".wb-tray-count")).toContainText("1");
  await context.close();
});

test("a new day rises in and removing a day offers Undo", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, { reducedMotion: "no-preference", viewport: DESKTOP });
  await page.locator(".wb-tab-add").click();
  await expect(page.locator(".wb-tab:not(.wb-tab-add)")).toHaveCount(2);
  await expect(page.locator(".wb-tab:not(.wb-tab-add)").nth(1)).toHaveClass(/wb-in/);
  await freeRow(page).locator(".wb-add").click();
  await page.locator(".wb-remove-day").click();
  await expect(page.locator(".wb-tab:not(.wb-tab-add)")).toHaveCount(1);
  await expect(page.locator(".wb-undo")).toBeVisible(T);
  await page.locator(".wb-undo-btn").click();
  await expect(page.locator(".wb-tab:not(.wb-tab-add)")).toHaveCount(2);
  await context.close();
});

test("the Review sheet slides in and out on a phone", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, { reducedMotion: "no-preference" });
  await page.locator(".wb-review").click();
  await expect(page.locator(".wb-sheet")).toHaveClass(/wb-sheet-in/);
  await expect(page.locator(".wb-sheet-title")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".wb-sheet")).toHaveCount(0, { timeout: 2000 });
  await expect(page.locator(".wb-review")).toBeFocused();
  await context.close();
});

test("with reduced motion nothing animates and removals are instant", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, { reducedMotion: "reduce", viewport: DESKTOP });
  await expect(page.locator(".wb-groups")).not.toHaveClass(/m-enter/);
  await freeRow(page).locator(".wb-add").click();
  await expect(page.locator(".wb-placed-ex")).toHaveCount(1);
  const anim = await page.locator(".wb-placed-ex").evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe("none");
  const addAnim = await page.locator(".wb-added-row .wb-add").evaluate((el) => getComputedStyle(el).animationName);
  expect(addAnim).toBe("none");
  await page.locator(".wb-remove-btn").click();
  await expect(page.locator(".wb-placed-ex")).toHaveCount(0);
  await context.close();
});
