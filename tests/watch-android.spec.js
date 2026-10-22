// Hide vs install is decided by the Android version in the user agent, not by
// the plugin's reason text ("unavailable" covers both not-installed and unsupported).
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");
const { stubHealth, callsOf, goWatch } = require("./watch-helpers");

test.setTimeout(45000);

const ua = (n) => `Mozilla/5.0 (Linux; Android ${n}; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36`;
async function app(browser, major, health) {
  const a = await openApp(browser, { signedIn: false, contextOptions: major ? { userAgent: ua(major) } : {} });
  await stubHealth(a.page, { health });
  await goWatch(a.page);
  return a;
}

test("Android 8: explained, nothing to connect, and the plugin is not even asked", async ({ browser }) => {
  const { context, page } = await app(browser, 8, { available: true });
  await expect(page.locator("#watchMount")).toBeHidden();
  await expect(page.locator("#wtOldCard")).toBeVisible();
  await expect(page.locator("#wtConnect")).toHaveCount(0);
  await expect(page.locator("#profWatchMount")).toBeEmpty();
  expect(await callsOf(page, "isAvailable")).toHaveLength(0);
  await context.close();
});

test("Android 13 + unavailable: the install card with a Play link (never the permission request)", async ({ browser }) => {
  const { context, page } = await app(browser, 13, { available: false, reason: "Health Connect is unavailable on this device." });
  const card = page.locator("#wtInstallCard");
  await expect(card).toContainText("Install or update Health Connect");
  await expect(card.locator("a#wtInstallGo")).toHaveAttribute("href", /details\?id=com\.google\.android\.apps\.healthdata/);
  expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
  await context.close();
});

test("Android 14 + 'needs an update': install card", async ({ browser }) => {
  const { context, page } = await app(browser, 14, { available: false, reason: "Health Connect needs an update." });
  await expect(page.locator("#wtInstallCard")).toContainText("update it if it's already there");
  await context.close();
});

test("Android 14 + unknown availability: install card, not hidden", async ({ browser }) => {
  const { context, page } = await app(browser, 14, { available: false, reason: "Health Connect availability unknown." });
  await expect(page.locator("#wtInstallCard")).toBeVisible();
  await context.close();
});

test("Android 14 + available: the disclosure", async ({ browser }) => {
  const { context, page } = await app(browser, 14, { available: true });
  await page.click("#wtConnect");
  await expect(page.locator("#watchSheet [role=dialog]")).toContainText("Show your watch data in Etqadem");
  await context.close();
});

test("unknown Android version keeps the old behaviour (reason text decides)", async ({ browser }) => {
  const a = await app(browser, 0, { available: false, reason: "Health Connect needs an update." });
  await expect(a.page.locator("#wtInstallCard")).toBeVisible();
  await a.context.close();
});
