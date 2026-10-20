const { test, expect } = require("@playwright/test");

// 2026-10-02 01:30 in Cairo (UTC+3) is 2026-10-01T22:30Z, so the UTC date is
// still "yesterday" for the user.
const LOCAL_NOW = "2026-10-01T22:30:00Z";

async function newPage(browser) {
  // Own context per test — never share state with other sessions.
  const context = await browser.newContext({ timezoneId: "Africa/Cairo", locale: "en-US", serviceWorkers: "block" });
  await context.addInitScript(() => {
    try { localStorage.setItem("gym_lang", "en"); localStorage.setItem("gym_terms_ok", "terms.v1"); } catch (e) {}
  });
  const page = await context.newPage();
  await page.clock.install({ time: new Date(LOCAL_NOW) });
  await page.goto("/index.html");
  await page.waitForFunction(() => window.GymDate);
  return { context, page };
}

test("GymDate.key is the Cairo calendar date, not the UTC one", async ({ browser }) => {
  const { context, page } = await newPage(browser);
  const r = await page.evaluate(() => ({
    key: window.GymDate.key(),
    tomorrow: window.GymDate.key(1),
    utc: new Date().toISOString().slice(0, 10)
  }));
  expect(r.utc).toBe("2026-10-01");
  expect(r.key).toBe("2026-10-02");
  expect(r.tomorrow).toBe("2026-10-03");
  await context.close();
});

test("a tab left open rolls over past local midnight", async ({ browser }) => {
  const { context, page } = await newPage(browser);
  expect(await page.evaluate(() => window.GymDate.key())).toBe("2026-10-02");
  await page.clock.fastForward("24:00:00");
  expect(await page.evaluate(() => window.GymDate.key())).toBe("2026-10-03");
  await context.close();
});

test("checking an exercise stores today's local date key", async ({ browser }) => {
  const { context, page } = await newPage(browser);
  await page.getByRole("button", { name: "Continue without signing in" }).click();
  await page.locator("#exList .check").first().click();
  const keys = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("gym_checks") || "{}")));
  expect(keys.length).toBeGreaterThan(0);
  for (const k of keys) expect(k.startsWith("2026-10-02_")).toBe(true);
  await context.close();
});
