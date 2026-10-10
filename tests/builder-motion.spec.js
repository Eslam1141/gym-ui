const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };

// Opens the custom plan builder ("Build Your Own Plan") on the Coach screen.
async function openBuilder(browser, reducedMotion) {
  const app = await openApp(browser, { signedIn: true });
  await app.page.emulateMedia({ reducedMotion });
  await app.page.locator('#appNav button[data-tab="coach"]').click();
  await expect(app.page.locator("body")).toHaveAttribute("data-tab", "coach", T);
  await app.page.waitForTimeout(800); // let the screen's own entrance finish
  await app.page.evaluate(() => GymWorkoutBuilder.open());
  await expect(app.page.locator(".wb-screen")).toBeVisible(T);
  return app;
}

const freeChip = (page) => page.locator(".wb-ex:not(.wb-ex-disabled)").first();

test("opening the builder staggers in, then cleans up", async ({ browser }) => {
  const { context, page, consoleErrors } = await openBuilder(browser, "no-preference");
  await expect(page.locator(".wb-groups")).toHaveClass(/m-enter/);
  await expect(page.locator(".wb-days")).toHaveClass(/m-enter/);
  await expect(page.locator(".wb-groups")).not.toHaveClass(/m-enter/, { timeout: 3000 });
  expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  await context.close();
});

test("adding and removing an exercise animates only that row", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, "no-preference");
  await freeChip(page).click();
  const row = page.locator(".wb-placed-ex");
  await expect(row).toHaveCount(1);
  await expect(row).toHaveClass(/wb-in/);
  await expect(page.locator(".wb-sticky-day-count")).toHaveClass(/m-pop/);

  // An unrelated rerender (filter toggle) must not replay the row's entrance.
  await page.locator(".wb-filter-btn").nth(1).click();
  await expect(page.locator(".wb-placed-ex")).not.toHaveClass(/wb-in/);
  await expect(page.locator(".wb-groups")).toHaveClass(/m-enter/);
  await page.locator(".wb-filter-btn").nth(0).click();

  // Remove: the row leaves first, then is gone.
  await page.locator(".wb-remove-btn").click();
  await expect(page.locator(".wb-placed-ex")).toHaveClass(/wb-out/);
  await expect(page.locator(".wb-placed-ex")).toHaveCount(0, { timeout: 2000 });
  await context.close();
});

test("a new day rises in and a removed day leaves", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, "no-preference");
  await page.locator(".wb-add-day").click();
  await expect(page.locator(".wb-day")).toHaveCount(2);
  await expect(page.locator(".wb-day").nth(1)).toHaveClass(/wb-in/);
  await page.locator(".wb-day").nth(1).locator(".wb-remove-day").click();
  await expect(page.locator(".wb-day").nth(1)).toHaveClass(/wb-out/);
  await expect(page.locator(".wb-day")).toHaveCount(1, { timeout: 2000 });
  await context.close();
});

test("with reduced motion nothing animates and removals are instant", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, "reduce");
  await expect(page.locator(".wb-groups")).not.toHaveClass(/m-enter/);
  await freeChip(page).click();
  await expect(page.locator(".wb-placed-ex")).toHaveCount(1);
  const anim = await page.locator(".wb-placed-ex").evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe("none");
  await page.locator(".wb-remove-btn").click();
  await expect(page.locator(".wb-placed-ex")).toHaveCount(0);
  await context.close();
});
