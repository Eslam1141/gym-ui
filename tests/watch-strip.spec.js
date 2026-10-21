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
  await expect(page.locator("#watchMount .wt-note")).toContainText("Some data types are turned off");
  await page.click("#wtManage");
  expect(await callsOf(page, "openHealthConnectSettings")).toHaveLength(1);
  const types = (await callsOf(page, "readSamples")).map((c) => c.arg.dataType);
  expect(types).not.toContain("restingHeartRate");
  expect(types).not.toContain("weight");
  await context.close();
});

test("everything denied: explains and offers Health Connect", async ({ browser }) => {
  const { context, page } = await connected(browser, { health: { authorized: [] } });
  await expect(page.locator("#watchMount .wt-note")).toContainText("doesn't have permission");
  await expect(page.locator("#watchMount .wt-cell")).toHaveCount(0);
  await page.click("#wtOpenHc");
  expect(await callsOf(page, "openHealthConnectSettings")).toHaveLength(1);
  await context.close();
});

test("connected but the watch has not synced: empty state and Check again", async ({ browser }) => {
  const { context, page } = await connected(browser, { health: { data: { sleep: [] } } });
  await expect(page.locator("#watchMount .wt-note")).toContainText("No data from your watch yet");
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
  await expect(page.locator("#watchMount .wt-note")).toContainText("Couldn't read Health Connect");
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

test("refresh is throttled on tab show / resume", async ({ browser }) => {
  const { context, page } = await connected(browser);
  await expect(cells(page).nth(0)).toContainText("8,214");
  const n = (await callsOf(page, "checkAuthorization")).length;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  expect((await callsOf(page, "checkAuthorization")).length).toBe(n);
  await page.clock.fastForward(61000);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(async () => (await callsOf(page, "checkAuthorization")).length).toBe(n + 1);
  await context.close();
});
