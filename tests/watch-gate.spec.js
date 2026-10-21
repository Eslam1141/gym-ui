// The watch feature renders nothing unless this is the native shell AND the
// Health plugin exists AND Health Connect is usable on the phone.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");
const { stubHealth, lsGet } = require("./watch-helpers");

test.setTimeout(45000);

async function expectHidden(page) {
  await expect(page.locator("#watchMount")).toBeHidden();
  await expect(page.locator("#watchMount")).toBeEmpty();
  await expect(page.locator("#profWatchMount")).toBeEmpty();
}

test("web: nothing is rendered and nothing stored", async ({ browser }) => {
  const { context, page, consoleErrors } = await openApp(browser, { signedIn: false });
  await expectHidden(page);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("etqwatch_")))).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await context.close();
});

test("native shell without the Health plugin (old APK): hidden", async ({ browser }) => {
  const { context, page, consoleErrors } = await openApp(browser, { signedIn: false });
  await stubHealth(page, { noHealth: true });
  await expectHidden(page);
  expect(consoleErrors).toEqual([]);
  await context.close();
});

test("plugin present but not a native platform: hidden", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false });
  await stubHealth(page, { native: false });
  await expectHidden(page);
  await context.close();
});

test("Health Connect unsupported on this Android: hidden", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false });
  await stubHealth(page, { health: { available: false, reason: "Health Connect is not supported on this Android version" } });
  await expectHidden(page);
  await context.close();
});

test("isAvailable rejects: hidden, no error, page still works", async ({ browser }) => {
  const { context, page, consoleErrors } = await openApp(browser, { signedIn: false });
  await stubHealth(page, { health: { rejectIsAvailable: true } });
  await expectHidden(page);
  await expect(page.locator("#sessionCard")).toBeVisible();
  expect(consoleErrors).toEqual([]);
  expect(await lsGet(page, "etqwatch_ask")).toBeNull();
  await context.close();
});

test("a rejecting plugin never throws out of the page", async ({ browser }) => {
  const { context, page, consoleErrors } = await openApp(browser, { signedIn: false });
  await page.evaluate(() => { localStorage.setItem("etqwatch_on", "1"); });
  await stubHealth(page, { health: { rejectReads: true } });
  await expect(page.locator("#watchMount .wt-note")).toContainText("Couldn't read your watch data");
  expect(consoleErrors).toEqual([]);
  await context.close();
});
