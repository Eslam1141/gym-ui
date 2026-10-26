// Force update (docs/superpowers/specs/2026-10-26-force-update-design.md): version
// logic, workout-in-progress hooks, the update-required page / bar / banner, and the
// safe auto-reload of long-open sessions.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

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
