const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { openApp } = require("./helpers");

test.setTimeout(45000);

const SHOTS = process.env.SHOT_DIR;
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const SERVER_ITEM = { id: "s1", want: "both", createdAt: "2026-09-30T07:00:00Z", computed: { targetKcal: 2350, proteinG: 170 } };

// historyReply(route) answers /assistant/history; every assistant call is logged.
async function openFood({ browser, signedIn = true, ls, lang, theme, history, assessment }) {
  const { context, page, consoleErrors } = await openApp(browser, { signedIn, ls, lang, theme });
  const calls = [];
  await page.route((u) => u.pathname.includes("/api/v1/assistant/"), (route) => {
    const p = new URL(route.request().url());
    if (p.pathname.endsWith("/checkin/status")) return json(route, 404, {});
    calls.push(p.pathname.replace(/^.*\/api\/v1/, "") + p.search);
    if (p.pathname.endsWith("/history")) return history(route);
    return assessment ? assessment(route) : json(route, 404, {});
  });
  // openApp's boot-time Food load ran before the route existed (and used up the once-per-session fetch); reload under the mock
  await page.reload();
  await page.waitForFunction(() => window.GymRest && window.GymDate, null, { timeout: 15000 });
  await page.click('#appNav button[data-tab="food"]');
  return { context, page, calls, consoleErrors };
}

async function shot(page, name) {
  if (!SHOTS) return;
  await page.waitForTimeout(1200); // let the tab-swap animation finish
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + ".png") });
}

test("server target: bar shows the account's targetKcal and is cached", async ({ browser }) => {
  const { context, page, calls } = await openFood({ browser, history: (r) => json(r, 200, { items: [SERVER_ITEM] }) });
  await expect(page.locator(".food-progress")).toBeVisible();
  await expect(page.locator(".food-progress-track").first()).toHaveAttribute("aria-valuemax", "2350");
  await expect(page.locator(".food-target-hint")).toHaveCount(0);
  expect(calls).toEqual(["/assistant/history?limit=1"]);
  const cached = await page.evaluate(() => JSON.parse(localStorage.getItem("gymcoach_target")));
  expect(cached.computed.targetKcal).toBe(2350);
  expect(cached.createdAt).toBe(SERVER_ITEM.createdAt);
  expect(await page.evaluate(() => localStorage.getItem("gymcoach_last"))).toBeNull();
  await shot(page, "bar-server-target-en");
  await context.close();
});

test("history item without computed: falls back to /assessment/{id}", async ({ browser }) => {
  const { context, page, calls } = await openFood({
    browser,
    history: (r) => json(r, 200, { items: [{ id: "s1", createdAt: SERVER_ITEM.createdAt }] }),
    assessment: (r) => json(r, 200, SERVER_ITEM)
  });
  await expect(page.locator(".food-progress-track").first()).toHaveAttribute("aria-valuemax", "2350");
  expect(calls).toEqual(["/assistant/history?limit=1", "/assistant/assessment/s1"]);
  await context.close();
});

test("local gymcoach_last target: bar shows and no history request is made", async ({ browser }) => {
  const { context, page, calls } = await openFood({
    browser, ls: { gymcoach_last: { computed: { targetKcal: 2000, proteinG: 150 } } },
    history: (r) => json(r, 200, { items: [SERVER_ITEM] })
  });
  await expect(page.locator(".food-progress-track").first()).toHaveAttribute("aria-valuemax", "2000");
  await page.waitForTimeout(500);
  expect(calls).toEqual([]);
  await context.close();
});

test("cached server target is newer than an older local plan", async ({ browser }) => {
  const { context, page } = await openFood({
    browser,
    ls: {
      gymcoach_last: { createdAt: "2026-09-01T00:00:00Z", computed: { targetKcal: 1800 } },
      gymcoach_target: { createdAt: "2026-09-30T00:00:00Z", computed: { targetKcal: 2350 } }
    },
    history: (r) => json(r, 500, {})
  });
  await expect(page.locator(".food-progress-track").first()).toHaveAttribute("aria-valuemax", "2350");
  await context.close();
});

test("signed in, empty history: hint shown and its button opens Coach", async ({ browser }) => {
  const { context, page } = await openFood({ browser, history: (r) => json(r, 200, { items: [] }) });
  const hint = page.locator(".food-target-hint");
  await expect(hint).toBeVisible();
  await expect(hint).toContainText("Generate a plan in Coach to see your daily target");
  await expect(page.locator(".food-progress")).toHaveCount(0);
  await shot(page, "hint-en");
  await hint.getByRole("button", { name: "Open Coach" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-tab", "coach");
  await context.close();
});

test("hint in Arabic (RTL)", async ({ browser }) => {
  const { context, page } = await openFood({ browser, lang: "ar", history: (r) => json(r, 200, { items: [] }) });
  const hint = page.locator(".food-target-hint");
  await expect(hint).toContainText("أنشئ خطة في المدرب لترى هدفك اليومي");
  await expect(hint.getByRole("button", { name: "افتح المدرب" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
  await shot(page, "hint-ar");
  await context.close();
});

test("signed out: no assistant request, teaser instead of a bar", async ({ browser }) => {
  const { context, page, calls } = await openFood({ browser, signedIn: false, history: (r) => json(r, 200, { items: [SERVER_ITEM] }) });
  await expect(page.locator(".coach-teaser")).toBeVisible();
  await page.waitForTimeout(500);
  expect(calls).toEqual([]);
  await expect(page.locator(".food-progress")).toHaveCount(0);
  await context.close();
});

test("history 500: hint only, no error and no script errors; fetched once", async ({ browser }) => {
  const { context, page, calls, consoleErrors } = await openFood({ browser, history: (r) => json(r, 500, { error: { code: "x", message: "x" } }) });
  await expect(page.locator(".food-target-hint")).toBeVisible();
  await page.click('#appNav button[data-tab="food"]');
  await page.waitForTimeout(300);
  expect(calls).toEqual(["/assistant/history?limit=1"]);
  await expect(page.locator(".food-target-hint")).toBeVisible();
  // browser logs the 500 itself as a "Failed to load resource" error; script errors are what matter
  expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  await context.close();
});
