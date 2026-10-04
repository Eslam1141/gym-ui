const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };
const userKeys = (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k !== "gym_lang" && k !== "gym_theme"));

test("DELETE /me answering 404 (already deleted) counts as done and wipes", async ({ browser }) => {
  const { context, page, consoleErrors } = await openApp(browser, { signedIn: true, ls: { gym_checks: { x: { a: true } } } });
  await page.route("**/api/v1/me", (route) => route.request().method() === "DELETE"
    ? route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "not_found" } }) })
    : route.fallback());
  await page.waitForFunction(() => document.getElementById("pvDelete"), null, T);
  await page.evaluate(() => document.getElementById("pvDelete").click());
  await page.fill("#pvInput", "DELETE");
  await page.click("#pvGo");
  await expect.poll(() => userKeys(page), T).toEqual([]);
  await expect(page.locator("#pvErr")).toHaveText("");
  expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  await context.close();
});

test("403 account_removed from /me (second device) signs out and wipes local data", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true, ls: { gym_checks: { x: { a: true } } } });
  expect((await userKeys(page)).length).toBeGreaterThan(0);
  await page.route(/\/api\/v1\/me(\?.*)?$/, (route) => route.fulfill({
    status: 403, contentType: "application/json", body: JSON.stringify({ error: { code: "account_removed" } })
  }));
  await page.evaluate(() => GymHeader.refreshMe().catch(() => {}));
  await expect.poll(() => userKeys(page), T).toEqual([]);
  await context.close();
});
