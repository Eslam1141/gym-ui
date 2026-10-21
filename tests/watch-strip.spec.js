// The "today" strip on the Plan tab and its non-happy states.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");
const { stubHealth, callsOf, lsGet } = require("./watch-helpers");

test.setTimeout(45000);

async function connected(browser, o) {
  const app = await openApp(browser, { signedIn: false, lang: o && o.lang, theme: o && o.theme });
  await app.page.evaluate(() => { localStorage.setItem("etqwatch_on", "1"); localStorage.setItem("etqwatch_ask", "yes"); });
  await stubHealth(app.page, o);
  return app;
}
const cells = (page) => page.locator("#watchMount .wt-cell");

test("shows today's values from the watch", async ({ browser }) => {
  const { context, page } = await connected(browser);
  const strip = page.locator("#watchMount .wt-strip");
  await expect(strip).toContainText("8,214");
  await expect(cells(page).nth(0)).toContainText("Steps");
  await expect(cells(page).nth(1)).toContainText("412");
  await expect(cells(page).nth(1)).toContainText("Active kcal");
  await expect(cells(page).nth(2)).toContainText("58");
  await expect(cells(page).nth(2)).toContainText("bpm");
  await expect(cells(page).nth(2)).toContainText("avg 71 today");
  await expect(cells(page).nth(3)).toContainText("7 h");
  await expect(strip.locator(".wt-meta")).toContainText(/Updated \d{2}:\d{2}/);
  await expect(strip).toContainText("From your watch today");
  await expect(strip).toContainText("Estimate from your watch. Not medical advice.");
  await context.close();
});

test("reads use the LOCAL day (Cairo midnight), not UTC", async ({ browser }) => {
  const { context, page } = await connected(browser);
  await expect(page.locator("#watchMount .wt-val").first()).toContainText("8,214");
  const steps = (await callsOf(page, "queryAggregated")).find((c) => c.arg.dataType === "steps").arg;
  expect(steps.startDate).toBe("2026-10-01T21:00:00.000Z");    // 2026-10-02 00:00 in Cairo (UTC+3)
  expect(steps).toMatchObject({ bucket: "day", aggregation: "sum" });
  const sleep = (await callsOf(page, "readSamples")).find((c) => c.arg.dataType === "sleep").arg;
  expect(sleep.startDate).toBe("2026-10-01T15:00:00.000Z");    // yesterday 18:00 Cairo
  await context.close();
});

test("a denied type shows 'Not allowed' and a manage link; the rest still show", async ({ browser }) => {
  const { context, page } = await connected(browser, { health: { authorized: ["steps", "calories", "sleep"] } });
  await expect(cells(page).nth(0)).toContainText("8,214");
  await expect(cells(page).nth(2)).toContainText("Not allowed");
  await expect(page.locator("#watchMount .wt-note")).toContainText("Some types are off");
  await page.click("#wtManage");
  expect(await callsOf(page, "openHealthConnectSettings")).toHaveLength(1);
  const types = (await callsOf(page, "readSamples")).map((c) => c.arg.dataType);
  expect(types).not.toContain("restingHeartRate");
  expect(types).not.toContain("weight");
  await context.close();
});

test("everything denied: explains and offers Health Connect", async ({ browser }) => {
  const { context, page } = await connected(browser, { health: { authorized: [] } });
  await expect(page.locator("#watchMount .wt-note")).toContainText("Access was removed in Health Connect");
  await expect(page.locator("#watchMount .wt-cell")).toHaveCount(0);
  await page.click("#wtOpenHc");
  expect(await callsOf(page, "openHealthConnectSettings")).toHaveLength(1);
  await context.close();
});

test("connected but the watch has not synced: empty state and Check again", async ({ browser }) => {
  const { context, page } = await connected(browser, { health: { data: { sleep: [] } } });
  await expect(page.locator("#watchMount .wt-note")).toContainText("No data from your watch yet. Open your watch app to sync.");
  await expect(cells(page).nth(0)).toContainText("No data");
  const before = (await callsOf(page, "checkAuthorization")).length;
  await page.evaluate(() => { window.__health.cfg.data = { steps: 100, calories: 5, sleep: [] }; });
  await page.click("#wtAgain");
  await expect(cells(page).nth(0)).toContainText("100");
  expect((await callsOf(page, "checkAuthorization")).length).toBe(before + 1);
  await context.close();
});

test("a failing read shows a calm error and keeps the last values", async ({ browser }) => {
  const { context, page } = await connected(browser);
  await expect(cells(page).nth(0)).toContainText("8,214");
  await page.evaluate(() => { window.__health.cfg.rejectReads = true; });
  await page.evaluate(() => window.GymWatch.refresh());
  await expect(page.locator("#watchMount .wt-note")).toContainText("Couldn't read your watch data");
  await expect(cells(page).nth(0)).toContainText("8,214");
  await context.close();
});

test("caches the last values on this phone only", async ({ browser }) => {
  const { context, page } = await connected(browser);
  await expect(cells(page).nth(0)).toContainText("8,214");
  const cache = JSON.parse(await lsGet(page, "etqwatch_cache"));
  expect(cache.vals).toMatchObject({ steps: 8214, kcal: 412, rhr: 58, sleepMin: 420, weightKg: 78.4 });
  const leaked = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("gym_") && /8214|watch/i.test(k + localStorage.getItem(k))));
  expect(leaked).toEqual([]);
  await context.close();
});

test("on resume the access check always runs, the data reads are throttled to 60 s", async ({ browser }) => {
  const { context, page } = await connected(browser);
  await expect(cells(page).nth(0)).toContainText("8,214");
  const checks = async () => (await callsOf(page, "checkAuthorization")).length;
  const reads = async () => (await callsOf(page, "queryAggregated")).length;
  const c0 = await checks(), r0 = await reads();
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(checks).toBe(c0 + 1);
  expect(await reads()).toBe(r0);
  await page.clock.fastForward(61000);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(reads).toBeGreaterThan(r0);
  await context.close();
});

test("revoked for some types: their cached values disappear on the next resume, the rest stay", async ({ browser }) => {
  const { context, page } = await connected(browser);
  await expect(cells(page).nth(2)).toContainText("58");
  expect(JSON.parse(await lsGet(page, "etqwatch_cache")).vals).toMatchObject({ rhr: 58, sleepMin: 420, weightKg: 78.4 });
  await page.evaluate(() => { window.__health.cfg.authorized = ["steps", "calories"]; });
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(cells(page).nth(2)).toContainText("Not allowed");
  await expect(cells(page).nth(0)).toContainText("8,214");
  const vals = JSON.parse(await lsGet(page, "etqwatch_cache")).vals;
  expect(vals.rhr).toBeUndefined();
  expect(vals.sleepMin).toBeUndefined();
  expect(vals.avgHr).toBeUndefined();
  expect(vals.weightKg).toBeUndefined();
  expect(vals.steps).toBe(8214);
  await context.close();
});

test("revoked entirely while the app was away: cache cleared, 'access removed' shown, Connect offered", async ({ browser }) => {
  const { context, page } = await connected(browser);
  await expect(cells(page).nth(0)).toContainText("8,214");
  await page.evaluate(() => { window.__health.cfg.authorized = []; });
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator("#watchMount .wt-note")).toContainText("Access was removed in Health Connect, so we deleted the saved watch values.");
  expect(await lsGet(page, "etqwatch_cache")).toBeNull();
  await expect(page.locator("#watchMount .wt-cell")).toHaveCount(0);
  await expect(page.locator("#profWatchMount")).toContainText("Access was removed");   // the Profile row stays, to reconnect
  await page.click("#wtReconnect");
  await expect(page.locator("#watchSheet [role=dialog]")).toBeVisible();               // still through the disclosure
  await context.close();
});

test("revoked on Plan-tab show too, and access coming back resumes reading", async ({ browser }) => {
  const { context, page } = await connected(browser);
  await expect(cells(page).nth(0)).toContainText("8,214");
  await page.evaluate(() => { window.__health.cfg.authorized = []; });
  await page.evaluate(() => { GymUI.navigate("coach"); });
  await page.evaluate(() => { GymUI.navigate("plan"); });
  await expect(page.locator("#watchMount .wt-note")).toContainText("Access was removed");
  await page.evaluate(() => { window.__health.cfg.authorized = ["steps", "calories", "heartRate", "restingHeartRate", "sleep", "weight"]; });
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(cells(page).nth(0)).toContainText("8,214");
  await context.close();
});

test("a cache older than 30 days is purged on load", async ({ browser }) => {
  const { page, context } = await openApp(browser, { signedIn: true });
  const old = JSON.stringify({ day: "2026-08-01", at: Date.now() - 31 * 864e5, vals: { steps: 1, weightKg: 70.1 }, denied: [] });
  await page.evaluate((o) => { localStorage.setItem("etqwatch_on", "1"); localStorage.setItem("etqwatch_ask", "yes"); localStorage.setItem("etqwatch_cache", o); }, old);
  await stubHealth(page, { health: { authorized: [] } });
  expect(await lsGet(page, "etqwatch_cache")).toBeNull();
  await context.close();
});

test("a cache younger than 30 days is kept and its weight shown", async ({ browser }) => {
  const { page, context } = await openApp(browser, { signedIn: true });
  const fresh = JSON.stringify({ day: "2026-09-20", at: Date.now() - 20 * 864e5, vals: { weightKg: 70.1 }, denied: [] });
  await page.evaluate((o) => { localStorage.setItem("etqwatch_on", "1"); localStorage.setItem("etqwatch_ask", "yes"); localStorage.setItem("etqwatch_cache", o); }, fresh);
  await stubHealth(page, { health: { data: { sleep: [] } } });
  await page.evaluate(() => GymUI.navigate("profile"));
  await expect(page.locator("#profWatchMount")).toContainText("70.1 kg");
  await context.close();
});
