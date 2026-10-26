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

// ---- Task 3: the update-required page, the workout bar, the banner ----
const MARKET = "market://details?id=com.etqadem.app";
const STORE = "https://play.google.com/store/apps/details?id=com.etqadem.app";

// Opens the app inside a faked native shell. cfg is the live app-config answer (change it to
// change what the next fetch returns). The shell's version arrives 500 ms after load, like
// App.getInfo() does after GymAppConfig.ready. native:false = a plain browser.
async function openShell(browser, cfg, o) {
  o = o || {};
  return openApp(browser, Object.assign({
    server: { verifyStrict: false },
    setup: async (ctx) => {
      await ctx.route("**/api/v1/app-config", (route) => {
        const body = { verifyStrict: false };
        if (cfg.min !== undefined) body.minAppVersion = cfg.min;
        if (cfg.latest !== undefined) body.latestAppVersion = cfg.latest;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      });
      if (o.native === false) return;
      await ctx.addInitScript((v) => {
        window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android" };
        setTimeout(() => { window.GYM_APP_VERSION = v; }, 500);
      }, o.version || "1.0.8");
    }
  }, o.open || {}));
}
const fu = {
  block: (p) => p.locator("#force-update"),
  bar: (p) => p.locator("#force-update-bar"),
  banner: (p) => p.locator("#force-update-banner")
};
const blocking = (page) => page.evaluate(() => GymForceUpdate.isBlocking());
const resume = (page) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
const recordOpens = (page) => page.evaluate(() => { window.__opened = []; GymForceUpdate.openUrl = (u) => { window.__opened.push(u); }; });

test.describe("force update: page, bar, banner", () => {
  test("below the minimum: the page shows (even though the version arrives late) and cannot be dismissed", async ({ browser }) => {
    const { context, page } = await openShell(browser, { min: "1.0.9" });
    await expect(fu.block(page)).toBeVisible(T);
    await expect(fu.block(page)).toContainText("Update required");
    expect(await blocking(page)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(fu.block(page)).toBeVisible();
    await context.close();
  });

  test("a workout in progress gets the bar; the page takes over when the day is finished", async ({ browser }) => {
    const { context, page } = await openShell(browser, { min: "1.0.9" }, { open: { signedIn: true, ls: session(ago(10 * 60000)) } });
    await expect(fu.bar(page)).toBeVisible(T);
    await expect(fu.bar(page)).toContainText("Your workout is saved");
    await expect(fu.block(page)).toBeHidden();
    expect(await blocking(page)).toBe(false);
    for (const id of EX_IDS) await page.locator(`.check[data-id="${id}"]`).click();
    await expect(fu.block(page)).toBeVisible(T);
    await expect(fu.bar(page)).toBeHidden();
    await context.close();
  });

  test("Update calls the native bridge once when it has one", async ({ browser }) => {
    const { context, page } = await openShell(browser, { min: "1.0.9" });
    await expect(fu.block(page)).toBeVisible(T);
    await page.evaluate(() => {
      window.__updates = 0;
      GymNativeShell.startUpdate = () => { window.__updates++; return Promise.resolve("started"); };
    });
    await recordOpens(page);
    await fu.block(page).getByRole("button", { name: "Update" }).click();
    await expect.poll(() => page.evaluate(() => window.__updates), T).toBe(1);
    expect(await page.evaluate(() => window.__opened)).toEqual([]);
    expect(await blocking(page)).toBe(true);
    await context.close();
  });

  test("Update without a bridge (APK 1.0.8) opens Google Play and shows the link as text; the block stays", async ({ browser }) => {
    const { context, page } = await openShell(browser, { min: "1.0.9" });
    await expect(fu.block(page)).toBeVisible(T);
    expect(await page.evaluate(() => typeof GymNativeShell.startUpdate)).toBe("undefined");
    await recordOpens(page);
    await fu.block(page).getByRole("button", { name: "Update" }).click();
    await expect.poll(() => page.evaluate(() => window.__opened), T).toEqual([MARKET]);
    await expect(fu.block(page)).toContainText("Open Google Play and update Etqadem:");
    await expect(fu.block(page)).toContainText(STORE);
    expect(await blocking(page)).toBe(true);
    await context.close();
  });

  test("Update falls back to Google Play when the in-app flow reports failure or throws", async ({ browser }) => {
    const { context, page } = await openShell(browser, { min: "1.0.9" });
    await expect(fu.block(page)).toBeVisible(T);
    await recordOpens(page);
    for (const impl of ["fail", "throw"]) {
      await page.evaluate((impl) => {
        GymNativeShell.startUpdate = impl === "fail" ? () => Promise.resolve("failed") : () => { throw new Error("x"); };
      }, impl);
      await fu.block(page).getByRole("button", { name: "Update" }).click();
      await expect.poll(() => page.evaluate(() => window.__opened.length), T).toBe(impl === "fail" ? 1 : 2);
    }
    expect(await page.evaluate(() => window.__opened)).toEqual([MARKET, MARKET]);
    expect(await blocking(page)).toBe(true);
    await context.close();
  });

  test("Check again removes the block once the server value is gone", async ({ browser }) => {
    const cfg = { min: "1.0.9" };
    const { context, page } = await openShell(browser, cfg);
    await expect(fu.block(page)).toBeVisible(T);
    await fu.block(page).getByRole("button", { name: "Check again" }).click();
    await expect(fu.block(page)).toBeVisible(); // still required: the server still says so
    cfg.min = undefined;
    await fu.block(page).getByRole("button", { name: "Check again" }).click();
    await expect(fu.block(page)).toBeHidden(T);
    expect(await blocking(page)).toBe(false);
    await context.close();
  });

  test("resuming the app re-fetches the config: a lowered minimum clears the block", async ({ browser }) => {
    const cfg = { min: "1.0.9" };
    const { context, page } = await openShell(browser, cfg);
    await expect(fu.block(page)).toBeVisible(T);
    cfg.min = "1.0.8";
    await resume(page);
    await expect(fu.block(page)).toBeHidden(T);
    await context.close();
  });

  test("banner: shows below latest, dismissal sticks across reloads, a newer latest brings it back", async ({ browser }) => {
    const cfg = { min: "", latest: "1.1.0" };
    const { context, page } = await openShell(browser, cfg, { version: "1.0.9" });
    await expect(fu.banner(page)).toBeVisible(T);
    await expect(fu.banner(page)).toContainText("A new version is available");
    expect(await blocking(page)).toBe(false);
    await fu.banner(page).getByRole("button", { name: "Close" }).click();
    await expect(fu.banner(page)).toBeHidden();
    await page.reload();
    await page.waitForFunction(() => window.GYM_APP_VERSION);
    await page.waitForTimeout(800);
    await expect(fu.banner(page)).toBeHidden();
    cfg.latest = "1.2.0";
    await page.reload();
    await expect(fu.banner(page)).toBeVisible(T);
    await context.close();
  });

  test("the bar and the banner push the page down: the header's first button sits below them", async ({ browser }) => {
    const below = async (page, strip) => {
      await expect(strip).toBeVisible(T);
      await expect(page.locator("#topBar button").first()).toBeVisible(T);
      await page.waitForTimeout(300);
      const s = await strip.boundingBox();
      const b = await page.locator("#topBar button").first().boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(s.y + s.height);
    };
    let r = await openShell(browser, { min: "1.0.9" }, { open: { signedIn: true, ls: session(ago(10 * 60000)) } });
    await below(r.page, fu.bar(r.page));
    await r.context.close();
    r = await openShell(browser, { latest: "1.1.0" }, { version: "1.0.9", open: { signedIn: true } });
    await below(r.page, fu.banner(r.page));
    await r.context.close();
  });

  test("a workout starting while the banner is up hides the banner right away", async ({ browser }) => {
    const { context, page } = await openShell(browser, { latest: "1.1.0" }, { version: "1.0.9", open: { signedIn: true } });
    await expect(fu.banner(page)).toBeVisible(T);
    await page.evaluate(() => { window.__active = 0; GymApp.onWorkoutActive(() => { window.__active++; }); });
    const btn = page.locator("#exList [data-rest]").first();
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await expect(page.locator("#timerBar")).toHaveClass(/show/, T);
    await expect(fu.banner(page)).toBeHidden();
    expect(await page.evaluate(() => window.__active)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-fu-top"))).toBe(false);
    await context.close();
  });

  test("a plain browser is never blocked, whatever the minimum says", async ({ browser }) => {
    const { context, page } = await openShell(browser, { min: "9.9.9", latest: "9.9.9" }, { native: false });
    await page.waitForTimeout(1200);
    await expect(fu.block(page)).toBeHidden();
    await expect(fu.banner(page)).toBeHidden();
    expect(await blocking(page)).toBe(false);
    await context.close();
  });

  test("Arabic: the page reads in Arabic, right to left", async ({ browser }) => {
    const { context, page } = await openShell(browser, { min: "1.0.9" }, { open: { lang: "ar" } });
    await expect(fu.block(page)).toBeVisible(T);
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
    await expect(fu.block(page)).toContainText("تحديث مطلوب");
    await expect(fu.block(page)).toContainText("إصدار جديد من اتقدم جاهز. حدّث التطبيق لمتابعة التمرين.");
    await expect(fu.block(page).getByRole("button", { name: "تحديث", exact: true })).toBeVisible();
    await expect(fu.block(page).getByRole("button", { name: "تحقق مرة أخرى" })).toBeVisible();
    await context.close();
  });
});

// ---- Task 4: auto-reload of long-open sessions ----
// A page that was already controlled by a service worker, so a controllerchange is an update and
// not the first install. location.reload is unforgeable, so force-update.js calls
// GymForceUpdate.reload(); the tests count that.
async function openReload(browser, open) {
  const r = await openApp(browser, Object.assign({
    server: { verifyStrict: false },
    setup: (ctx) => ctx.addInitScript(() => {
      try { Object.defineProperty(navigator.serviceWorker, "controller", { get: () => ({}), configurable: true }); } catch (e) {}
    })
  }, open || {}));
  await r.page.evaluate(() => { window.__reloads = 0; GymForceUpdate.reload = () => { window.__reloads++; }; });
  return r;
}
const swUpdate = (page) => page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event("controllerchange")));
const reloads = (page) => page.evaluate(() => window.__reloads);

test.describe("force update: auto-reload", () => {
  test("a new service worker reloads the page once when it is safe", async ({ browser }) => {
    const { context, page } = await openReload(browser);
    expect(await page.evaluate(() => GymForceUpdate.isSafeToReload())).toBe(true);
    await swUpdate(page);
    await expect.poll(() => reloads(page), T).toBe(1);
    await context.close();
  });

  test("the first install (no earlier controller) never reloads", async ({ browser }) => {
    const { context, page } = await openApp(browser, {});
    await page.evaluate(() => { window.__reloads = 0; GymForceUpdate.reload = () => { window.__reloads++; }; });
    await swUpdate(page);
    await page.waitForTimeout(500);
    expect(await reloads(page)).toBe(0);
    await context.close();
  });

  test("a workout in progress holds the reload off until it is finished", async ({ browser }) => {
    const { context, page } = await openReload(browser, { signedIn: true, ls: session(ago(10 * 60000)) });
    await swUpdate(page);
    await page.waitForTimeout(500);
    expect(await reloads(page)).toBe(0);
    for (const id of EX_IDS) await page.locator(`.check[data-id="${id}"]`).click();
    await expect.poll(() => reloads(page), { timeout: 15000 }).toBe(1);
    await context.close();
  });

  test("a focused text field holds it off; leaving it (or resuming) lets it through", async ({ browser }) => {
    const { context, page } = await openReload(browser);
    await page.evaluate(() => {
      const i = document.createElement("input");
      i.id = "fuProbe"; i.type = "text";
      document.body.appendChild(i);
      i.focus();
    });
    expect(await page.evaluate(() => GymForceUpdate.isSafeToReload())).toBe(false);
    await swUpdate(page);
    await page.waitForTimeout(500);
    expect(await reloads(page)).toBe(0);
    await page.evaluate(() => document.getElementById("fuProbe").blur());
    await resume(page);
    await expect.poll(() => reloads(page), T).toBe(1);
    await context.close();
  });

  test("a second controllerchange in the same tab does not reload again", async ({ browser }) => {
    const { context, page } = await openReload(browser);
    await swUpdate(page);
    await expect.poll(() => reloads(page), T).toBe(1);
    await swUpdate(page);
    await resume(page);
    await page.waitForTimeout(600);
    expect(await reloads(page)).toBe(1);
    await context.close();
  });

  test("an open sheet is not safe", async ({ browser }) => {
    const { context, page } = await openReload(browser);
    await page.evaluate(() => {
      const s = document.createElement("div");
      s.id = "fuSheet"; s.className = "syd"; s.setAttribute("role", "dialog");
      document.body.appendChild(s);
    });
    expect(await page.evaluate(() => GymForceUpdate.isSafeToReload())).toBe(false);
    await page.evaluate(() => document.getElementById("fuSheet").remove());
    expect(await page.evaluate(() => GymForceUpdate.isSafeToReload())).toBe(true);
    await context.close();
  });
});
