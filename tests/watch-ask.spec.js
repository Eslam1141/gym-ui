// Ask card -> disclosure -> Health Connect permission sheet.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");
const { stubHealth, callsOf, lsGet } = require("./watch-helpers");

test.setTimeout(45000);

async function ready(browser, o) {
  const app = await openApp(browser, { signedIn: false });
  await stubHealth(app.page, o);
  return app;
}

test("ask card shows once the plugin is available", async ({ browser }) => {
  const { context, page } = await ready(browser);
  const card = page.locator("#watchMount .wt-ask");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Do you have a smartwatch?");
  await expect(page.locator("#wtAskYes")).toBeVisible();
  await expect(page.locator("#wtAskLater")).toBeVisible();
  await expect(page.locator("#wtAskNo")).toBeVisible();
  expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
  await context.close();
});

test("Yes shows the disclosure BEFORE the permission sheet; Continue then requests the 6 read types", async ({ browser }) => {
  const { context, page } = await ready(browser);
  await page.click("#wtAskYes");
  const sheet = page.locator("#watchSheet [role=dialog]");
  await expect(sheet).toBeVisible();
  for (const t of ["Steps", "Active calories", "Heart rate", "Resting heart rate", "Sleep", "Weight"]) {
    await expect(sheet.locator(".wt-what li", { hasText: new RegExp("^" + t + "$") })).toHaveCount(1);
  }
  await expect(sheet).toContainText("stays on this phone");
  await expect(sheet).toContainText("not sent to our servers or to the AI coach");
  await expect(sheet).toContainText("disconnect any time in Profile");
  await expect(sheet.locator("a.pol-link")).toHaveAttribute("href", "/privacy");
  expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
  await page.click("#wtGo");
  await expect(page.locator("#watchSheet")).toHaveCount(0);
  const req = await callsOf(page, "requestAuthorization");
  expect(req).toHaveLength(1);
  expect(req[0].arg.read).toEqual(["steps", "calories", "heartRate", "restingHeartRate", "sleep", "weight"]);
  await expect(page.locator("#watchMount .wt-strip")).toBeVisible();
  expect(await lsGet(page, "etqwatch_on")).toBe("1");
  expect(await lsGet(page, "etqwatch_ask")).toBe("yes");
  await context.close();
});

test("Not now in the disclosure never calls requestAuthorization and snoozes the ask", async ({ browser }) => {
  const { context, page } = await ready(browser);
  await page.click("#wtAskYes");
  await page.click("#wtLater");
  await expect(page.locator("#watchSheet")).toHaveCount(0);
  expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
  expect(await lsGet(page, "etqwatch_on")).toBeNull();
  expect(await lsGet(page, "etqwatch_ask")).toMatch(/^later:\d+$/);
  await expect(page.locator("#watchMount")).toBeHidden();
  await context.close();
});

test("Escape closes the disclosure like Not now", async ({ browser }) => {
  const { context, page } = await ready(browser);
  await page.click("#wtAskYes");
  await page.keyboard.press("Escape");
  await expect(page.locator("#watchSheet")).toHaveCount(0);
  expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
  await context.close();
});

test("ask card Not now hides it, then it returns after 7 days", async ({ browser }) => {
  const { context, page } = await ready(browser);
  await page.click("#wtAskLater");
  await expect(page.locator("#watchMount")).toBeHidden();
  expect(await lsGet(page, "etqwatch_ask")).toMatch(/^later:\d+$/);
  await page.evaluate(() => window.GymWatch.init());
  await expect(page.locator("#watchMount")).toBeHidden();                       // same day: still quiet
  await page.evaluate(() => localStorage.setItem("etqwatch_ask", "later:" + (Date.now() - 6 * 864e5)));
  await page.evaluate(() => window.GymWatch.init());
  await expect(page.locator("#watchMount")).toBeHidden();                       // day 6
  await page.evaluate(() => localStorage.setItem("etqwatch_ask", "later:" + (Date.now() - 7 * 864e5 - 1000)));
  await page.evaluate(() => window.GymWatch.init());
  await expect(page.locator("#watchMount .wt-ask")).toBeVisible();              // day 7
  await context.close();
});

test("No never asks again, but the Profile row stays", async ({ browser }) => {
  const { context, page } = await ready(browser);
  await page.click("#wtAskNo");
  await expect(page.locator("#watchMount")).toBeHidden();
  expect(await lsGet(page, "etqwatch_ask")).toBe("no");
  await page.evaluate(() => window.GymWatch.init());
  await expect(page.locator("#watchMount")).toBeHidden();
  await expect(page.locator("#profWatchMount .wt-prof")).toContainText("Watch & Health Connect");
  await expect(page.locator("#wtProfConnect")).toHaveCount(1);   // the Profile screen itself is only reachable signed in
  await context.close();
});

test("permission refused in the system sheet: no strip, calm toast, ask snoozed", async ({ browser }) => {
  const { context, page } = await ready(browser, { health: { grantOnRequest: [], authorized: [] } });
  await page.click("#wtAskYes");
  await page.click("#wtGo");
  await expect(page.locator("#gymToast")).toContainText("No access was given");
  expect(await lsGet(page, "etqwatch_on")).toBeNull();
  expect(await lsGet(page, "etqwatch_ask")).toMatch(/^later:/);
  await expect(page.locator("#watchMount .wt-strip")).toHaveCount(0);
  await context.close();
});

test("Health Connect missing: install sheet with a Play link, no permission request", async ({ browser }) => {
  const { context, page } = await ready(browser, { health: { available: false, reason: "Health Connect is not installed" } });
  await page.click("#wtAskYes");
  const sheet = page.locator("#watchSheet [role=dialog]");
  await expect(sheet).toContainText("Install Health Connect");
  await expect(sheet.locator("a#wtGo")).toHaveAttribute("href", /play\.google\.com\/store\/apps\/details\?id=com\.google\.android\.apps\.healthdata/);
  expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
  await page.click("#wtLater");
  await expect(page.locator("#watchSheet")).toHaveCount(0);
  await context.close();
});
