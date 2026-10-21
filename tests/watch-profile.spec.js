// Profile row + sign-out / disconnect clearing.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");
const { stubHealth, callsOf, lsGet } = require("./watch-helpers");

test.setTimeout(45000);

async function profile(browser, o) {
  const app = await openApp(browser, { signedIn: true });
  if (o && o.on) await app.page.evaluate(() => { localStorage.setItem("etqwatch_on", "1"); localStorage.setItem("etqwatch_ask", "yes"); });
  await stubHealth(app.page, o);
  await app.page.evaluate(() => GymUI.navigate("profile"));
  await expect(app.page.locator("#screen-profile")).toBeVisible();
  return app;
}
const watchKeys = (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("etqwatch_")));

test("not connected: Connect runs the disclosure then the permission request", async ({ browser }) => {
  const { context, page } = await profile(browser);
  const row = page.locator("#profWatchMount .wt-prof");
  await expect(row).toContainText("Watch & Health Connect");
  await expect(row).toContainText("Not connected");
  await page.click("#wtProfConnect");
  await expect(page.locator("#watchSheet [role=dialog]")).toBeVisible();
  expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
  await page.click("#wtGo");
  await expect(row).toContainText(/Connected\. Last updated \d{2}:\d{2}/);
  await expect(row).toContainText("Latest weight from your watch: 78.4 kg");
  await expect(page.locator("#wtProfManage")).toBeVisible();
  await expect(page.locator("#wtProfDisc")).toBeVisible();
  await context.close();
});

test("connected: Manage opens Health Connect; a failure toasts", async ({ browser }) => {
  const { context, page } = await profile(browser, { on: true });
  await page.click("#wtProfManage");
  expect(await callsOf(page, "openHealthConnectSettings")).toHaveLength(1);
  await page.evaluate(() => { window.__health.cfg.rejectOpen = true; });
  await page.click("#wtProfManage");
  await expect(page.locator("#gymToast")).toContainText("Couldn't open Health Connect");
  await context.close();
});

test("Disconnect asks first; Cancel keeps everything, confirming stops reading and clears the cache", async ({ browser }) => {
  const { context, page } = await profile(browser, { on: true });
  await expect(page.locator("#profWatchMount")).toContainText("78.4 kg");
  const reads = (await callsOf(page, "checkAuthorization")).length;
  await page.click("#wtProfDisc");
  const sheet = page.locator("#watchSheet [role=dialog]");
  await expect(sheet).toContainText("Disconnect your watch?");
  await expect(sheet).toContainText("delete the watch values saved on this phone");
  await expect(sheet).toContainText("open Health Connect");
  await page.click("#wtLater");                                   // Cancel
  await expect(page.locator("#watchSheet")).toHaveCount(0);
  expect(await lsGet(page, "etqwatch_on")).toBe("1");
  expect(await lsGet(page, "etqwatch_cache")).not.toBeNull();

  await page.click("#wtProfDisc");
  await page.click("#wtGo");                                      // Disconnect
  await expect(page.locator("#gymToast")).toContainText("Watch disconnected");
  expect(await lsGet(page, "etqwatch_on")).toBeNull();
  expect(await lsGet(page, "etqwatch_cache")).toBeNull();
  expect(await lsGet(page, "etqwatch_ask")).toBe("no");
  const row = page.locator("#profWatchMount .wt-prof");
  await expect(row).toContainText("Not connected");
  await expect(page.locator("#wtProfConnect")).toBeVisible();
  await expect(row).not.toContainText("78.4");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  expect((await callsOf(page, "checkAuthorization")).length).toBe(reads);   // no more reading
  await context.close();
});

test("Profile Connect always goes through the disclosure, even after an earlier Yes or No", async ({ browser }) => {
  for (const ask of ["yes", "no", "later:1"]) {
    const { context, page } = await profile(browser);
    await page.evaluate((a) => { localStorage.setItem("etqwatch_ask", a); }, ask);
    await page.evaluate(() => window.GymWatch.init());
    await page.click("#wtProfConnect");
    await expect(page.locator("#watchSheet [role=dialog]")).toContainText("Show your watch data in Etqadem");
    expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
    await page.click("#wtLater");
    expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
    await context.close();
  }
});

test("permission revoked in Health Connect: the row says so", async ({ browser }) => {
  const { context, page } = await profile(browser, { on: true, health: { authorized: [] } });
  await expect(page.locator("#profWatchMount")).toContainText("Access was removed in Health Connect");
  await context.close();
});

test("sign-out clears the watch cache and flags", async ({ browser }) => {
  const { context, page } = await profile(browser, { on: true });
  await expect(page.locator("#profWatchMount")).toContainText("78.4 kg");
  expect((await watchKeys(page)).length).toBeGreaterThan(0);
  await page.evaluate(() => GymSync.signOut());
  await expect.poll(() => watchKeys(page)).toEqual([]);
  await context.close();
});

test("a sign-out event clears them even before the sync layer wipes, and a late read cannot write them back", async ({ browser }) => {
  const { context, page } = await profile(browser, { on: true });
  await expect(page.locator("#profWatchMount")).toContainText("78.4 kg");
  await page.evaluate(() => {
    window.GymWatch.refresh();                                            // read in flight...
    document.dispatchEvent(new CustomEvent("gym:authchange", { detail: false }));   // ...then sign-out
  });
  await page.waitForTimeout(300);
  expect(await watchKeys(page)).toEqual([]);
  await context.close();
});

test("no gym_ key (those sync to the server) ever holds watch data", async ({ browser }) => {
  const { context, page } = await profile(browser, { on: true });
  await expect(page.locator("#profWatchMount")).toContainText("78.4 kg");
  const leaked = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("gym_") && (/watch|health/i.test(k) || /8214|78\.4/.test(localStorage.getItem(k)))));
  expect(leaked).toEqual([]);
  await context.close();
});
