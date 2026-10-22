// "It stays on your phone" proof: with distinctive watch values, record every
// request the page makes through connect, refresh, tab changes, the coach screen
// and a sync upload, and assert none carries a watch value or an etqwatch_ key.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");
const { stubHealth, callsOf, goWatch } = require("./watch-helpers");

test.setTimeout(60000);

const DATA = {
  steps: 98765, calories: 54321, avgHr: 123, rhr: 47, sleep: [{ value: 391, startDate: "2026-10-01T20:30:00Z", endDate: "2026-10-02T03:00:00Z" }], weight: 87.3,
  // the 7-day chart's numbers are watch data too
  week: { steps: [11111, 22222, 33333, 44444, 55555, 66666, 98765], kcal: [1357, 2468, 3579, 4680, 5791, 6802, 54321], sleep: [301, 302, 303, 304, 305, null, 391], rhr: [41, 42, 43, 44, 45, 46, 47] }
};
const NEEDLES = ["98765", "54321", "87.3", "etqwatch", "391", "11111", "55555", "1357", "6802", "305"];

test("no request body, URL or header carries watch values; sync never uploads etqwatch_ keys", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  const seen = [];
  context.on("request", (r) => seen.push({ method: r.method(), url: r.url(), body: r.postData() || "", headers: JSON.stringify(r.headers()) }));
  await stubHealth(page, { health: { data: DATA } });

  await goWatch(page);
  await page.click("#wtConnect");
  await page.click("#wtGo");
  await expect(page.locator('.wt-leg[data-key="steps"]')).toContainText("98,765");
  await expect(page.locator("#watchBody")).toContainText("54,321");
  await page.click("#wtTab-kcal");
  await page.click("#wtTab-hr");
  await page.evaluate(() => window.GymWatch.refresh());
  for (const tab of ["coach", "food", "plan", "watch", "profile"]) {
    await page.evaluate((t) => GymUI.navigate(t), tab);
    await page.waitForTimeout(150);
  }
  await expect(page.locator("#profWatchMount")).toContainText("87.3 kg");
  // a sync upload while watch data is on the phone, with a gym_ key to send
  await page.evaluate(() => { localStorage.setItem("gym_checks", JSON.stringify({ probe: 1 })); });
  await page.evaluate(() => window.GymSync.syncNow("manual").catch(() => {}));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(500);

  const synced = seen.filter((r) => /\/progress/.test(r.url));
  expect(synced.length).toBeGreaterThan(0);           // the upload path really ran
  for (const r of seen) {
    for (const n of NEEDLES) {
      expect(r.url, `${r.method} ${r.url}`).not.toContain(n);
      expect(r.body, `${r.method} ${r.url} body`).not.toContain(n);
      expect(r.headers, `${r.method} ${r.url} headers`).not.toContain(n);
    }
  }
  expect((await callsOf(page, "readSamples")).length).toBeGreaterThan(0);   // the values were really read
  await context.close();
});

test("the watch values never appear in a feedback submission either", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  const posts = [];
  context.on("request", (r) => { if (/\/feedback/.test(r.url())) posts.push(r.postData() || ""); });
  await stubHealth(page, { health: { data: DATA } });
  await goWatch(page);
  await page.click("#wtConnect");
  await page.click("#wtGo");
  await expect(page.locator('.wt-leg[data-key="steps"]')).toContainText("98,765");
  await page.click("#feedbackBtn", { force: true }).catch(() => {});
  await page.evaluate(() => window.GymFeedback && GymFeedback.open());
  await page.locator("#feedbackSheet textarea").fill("hello");
  await page.locator("#feedbackSheet .fb-send").click();
  await expect.poll(() => posts.length).toBeGreaterThan(0);
  for (const p of posts) for (const n of NEEDLES) expect(p).not.toContain(n);
  await context.close();
});
