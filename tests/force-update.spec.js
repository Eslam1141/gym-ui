// Force update (docs/superpowers/specs/2026-10-26-force-update-design.md): version
// logic, workout-in-progress hooks, the update-required page / bar / banner, and the
// safe auto-reload of long-open sessions.
const { test, expect } = require("@playwright/test");
const { openApp, NOW, EX_IDS } = require("./helpers");

test.setTimeout(60000);

test.describe("force update: version logic", () => {
  test("compare: dotted numeric versions, bad input is null", async ({ browser }) => {
    const { context, page } = await openApp(browser, {});
    const r = await page.evaluate(() => {
      const c = GymForceUpdate.compare;
      return [c("1.0.10", "1.0.9"), c("1.0", "1.0.0"), c("1.0.8", "1.0.9"), c("", "1.0"), c("1.0.x", "1.0")];
    });
    expect(r).toEqual([1, 0, -1, null, null]);
    await context.close();
  });

  test("decide: block, bar, banner, none", async ({ browser }) => {
    const { context, page } = await openApp(browser, {});
    const r = await page.evaluate(() => {
      const d = (o) => GymForceUpdate.decide(Object.assign({ native: true, version: "", min: "", latest: "", inWorkout: false, dismissed: "" }, o));
      return {
        block: d({ version: "1.0.8", min: "1.0.9" }),
        bar: d({ version: "1.0.8", min: "1.0.9", inWorkout: true }),
        browser: d({ native: false, min: "9.9.9" }),
        banner: d({ version: "1.0.9", min: "1.0.9", latest: "1.1.0" }),
        dismissed: d({ version: "1.0.9", min: "1.0.9", latest: "1.1.0", dismissed: "1.1.0" }),
        bannerWorkout: d({ version: "1.0.9", min: "1.0.9", latest: "1.1.0", inWorkout: true }),
        garbage: d({ version: "1.0.8", min: "garbage" }),
        noVersion: d({ version: "", min: "1.0.9" }),
        current: d({ version: "1.1.0", min: "1.0.9", latest: "1.1.0" })
      };
    });
    expect(r).toEqual({ block: "block", bar: "bar", browser: "none", banner: "banner", dismissed: "none", bannerWorkout: "none", garbage: "none", noVersion: "none", current: "none" });
    await context.close();
  });

  test("GymAppConfig.refresh re-fetches, so a cleared server value clears the cached one", async ({ browser }) => {
    let body = { verifyStrict: false, minAppVersion: "1.0.9" };
    const { context, page } = await openApp(browser, {
      setup: (ctx) => ctx.route("**/api/v1/app-config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }))
    });
    await page.evaluate(() => GymAppConfig.refresh());
    expect(await page.evaluate(() => GymAppConfig.minAppVersion())).toBe("1.0.9");
    body = { verifyStrict: false };
    await page.evaluate(() => GymAppConfig.refresh());
    expect(await page.evaluate(() => GymAppConfig.minAppVersion())).toBe("");
    await context.close();
  });
});

const T = { timeout: 8000 };
const ago = (ms) => Date.parse(NOW) - ms;
const session = (startedAt) => ({ gym_session_active: { dayId: "m_upper", startedAt, running: true, accumSec: 0, segStart: startedAt } });
const inWorkout = (page) => page.evaluate(() => GymApp.workoutInProgress());
const countIdle = (page) => page.evaluate(() => { window.__idle = 0; GymApp.onWorkoutIdle(() => { window.__idle++; }); });
const idleCount = (page) => page.evaluate(() => window.__idle);

test.describe("force update: workout-in-progress hooks", () => {
  test("no session is not a workout; a fresh one is; a 7 h old one is stale", async ({ browser }) => {
    let r = await openApp(browser, {});
    expect(await inWorkout(r.page)).toBe(false);
    await r.context.close();
    r = await openApp(browser, { ls: session(ago(10 * 60000)) });
    expect(await inWorkout(r.page)).toBe(true);
    await r.context.close();
    r = await openApp(browser, { ls: session(ago(7 * 3600000)) });
    expect(await inWorkout(r.page)).toBe(false);
    await r.context.close();
  });

  test("a rest timer with no session is a workout; stopping it fires the idle callback once", async ({ browser }) => {
    const { context, page } = await openApp(browser, {});
    await countIdle(page);
    const btn = page.locator("#exList [data-rest]").first();
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await expect(page.locator("#timerBar")).toHaveClass(/show/, T);
    expect(await inWorkout(page)).toBe(true);
    expect(await idleCount(page)).toBe(0);
    await page.click("#timerSkip");
    expect(await inWorkout(page)).toBe(false);
    expect(await idleCount(page)).toBe(1);
    await context.close();
  });

  test("ending the session fires the idle callback", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, ls: session(ago(10 * 60000)) });
    await countIdle(page);
    await page.click("#sessionBtn");
    await expect.poll(() => inWorkout(page), T).toBe(false);
    expect(await idleCount(page)).toBe(1);
    await context.close();
  });

  test("finishing a day fires the idle callback", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, server: { verifyStrict: false }, ls: session(ago(10 * 60000)) });
    await countIdle(page);
    for (const id of EX_IDS) await page.locator(`.check[data-id="${id}"]`).click();
    await expect.poll(() => idleCount(page), T).toBeGreaterThan(0);
    expect(await inWorkout(page)).toBe(false);
    await context.close();
  });
});
