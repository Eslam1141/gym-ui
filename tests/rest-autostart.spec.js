// Ticking a set starts the rest timer (same seconds and name as the card's
// Rest button); unticking and the whole-exercise check do not.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };
const firstCard = (page) => page.locator("#exList .ex-card").first();
const sets = (page) => firstCard(page).locator(".set-chk");
const dock = (page) => page.locator("#timerBar");

test.describe("rest timer starts on set tick", () => {
  test("ticking a set shows the rest timer with the exercise name", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await expect(firstCard(page)).toBeVisible(T);
    const name = await firstCard(page).locator("[data-rest]").getAttribute("data-name");
    await expect(dock(page)).not.toHaveClass(/show/);
    await sets(page).nth(0).click();
    await expect(dock(page)).toHaveClass(/show/);
    await expect(page.locator("#timerLabel")).toHaveText(name);
    await context.close();
  });

  test("unticking does not start a timer", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await expect(firstCard(page)).toBeVisible(T);
    await sets(page).nth(0).click();
    await page.locator("#timerSkip").click();
    await expect(dock(page)).not.toHaveClass(/show/);
    await sets(page).nth(0).click(); // untick
    await expect(sets(page).nth(0)).toHaveAttribute("aria-checked", "false");
    await expect(dock(page)).not.toHaveClass(/show/);
    await context.close();
  });

  test("the whole-exercise check does not start a timer", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await expect(firstCard(page)).toBeVisible(T);
    await firstCard(page).locator(".check").click();
    await expect(firstCard(page).locator(".set-chk.on")).toHaveCount(0);
    await expect(dock(page)).not.toHaveClass(/show/);
    await context.close();
  });

  test("the Rest button still starts the timer", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await expect(firstCard(page)).toBeVisible(T);
    await firstCard(page).locator("[data-rest]").click();
    await expect(dock(page)).toHaveClass(/show/);
    await context.close();
  });
});
