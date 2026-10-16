// Web side of the Capacitor shell (native-shell.js, plus the TimerAlarm branch
// in app.js): hardware Back, app version, startup channel cleanup. window.Capacitor
// is stubbed after load and GymNativeShell.init() is run again.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);

async function mockShell(page, o) {
  o = o || {};
  await page.evaluate((o) => {
    window.__shell = { exit: 0, deleted: [], listeners: {}, back: 0 };
    const App = {
      getInfo: async () => ({ version: o.version || "1.2.3", build: "7" }),
      addListener: (name, cb) => { window.__shell.listeners[name] = cb; return Promise.resolve({ remove() {} }); },
      exitApp: () => { window.__shell.exit++; }
    };
    const ln = {
      deleteChannel: async (x) => { window.__shell.deleted.push(x.id); if (o.deleteFails) throw new Error("nope"); },
      checkPermissions: async () => ({ display: "granted" }),
      requestPermissions: async () => ({ display: "granted" }),
      createChannel: async () => {},
      checkExactNotificationSetting: async () => ({ exact_alarm: "denied" }),
      schedule: async (x) => { window.__shell.lnScheduled = x; },
      cancel: async () => {}
    };
    const Plugins = { LocalNotifications: ln };
    if (!o.noApp) Plugins.App = App;
    if (o.timerAlarm) {
      window.__ta = { scheduled: [], cancelled: [] };
      Plugins.TimerAlarm = {
        schedule: async (x) => { window.__ta.scheduled.push(x); },
        cancel: async (x) => { window.__ta.cancelled.push(x); }
      };
    }
    window.Capacitor = {
      isNativePlatform: () => o.native !== false,
      getPlatform: () => o.platform || "android",
      Plugins
    };
    window.GymNativeShell.init();
  }, o);
}

const back = (page, canGoBack) => page.evaluate((c) => window.__shell.listeners.backButton({ canGoBack: c }), !!canGoBack);

test("Back closes the open sheet first, then exits the app", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false });
  await mockShell(page);
  await page.click("#feedbackBtn");
  await expect(page.locator("#feedbackSheet [role=dialog]")).toBeVisible();
  await back(page);
  await expect(page.locator("#feedbackSheet")).toHaveCount(0);
  expect(await page.evaluate(() => window.__shell.exit)).toBe(0);
  await back(page);
  expect(await page.evaluate(() => window.__shell.exit)).toBe(0); // first Back on Plan only warns
  await back(page);
  expect(await page.evaluate(() => window.__shell.exit)).toBe(1);
  await context.close();
});

test("Back closes the precise-alerts sheet (and remembers 'later')", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false });
  await mockShell(page);
  await page.evaluate(() => window.openPreciseSheet(window.Capacitor.Plugins.LocalNotifications));
  await expect(page.locator("#preciseSheet")).toBeVisible();
  await back(page);
  await expect(page.locator("#preciseSheet")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("etq_precise_alerts_v1"))).toBe("later");
  expect(await page.evaluate(() => window.__shell.exit)).toBe(0);
  await context.close();
});

test("Back with no layer open goes back in history when it can", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false });
  await mockShell(page);
  await page.evaluate(() => { window.__hb = 0; history.back = () => { window.__hb++; }; });
  await back(page, true);
  expect(await page.evaluate(() => [window.__hb, window.__shell.exit])).toEqual([1, 0]);
  await context.close();
});

const tabNow = (page) => page.evaluate(() => GymUI.currentTab());
const goTab = (page, t) => page.click('#appNav button[data-tab="' + t + '"]');

test("Back returns through tab switches, then Plan, then asks before exiting", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false });
  await mockShell(page);
  await goTab(page, "food");
  await goTab(page, "more");
  expect(await tabNow(page)).toBe("more");
  await back(page);
  expect(await tabNow(page)).toBe("food");
  await back(page);
  expect(await tabNow(page)).toBe("plan");
  expect(await page.evaluate(() => window.__shell.exit)).toBe(0);
  await expect(page.locator("#gymToast")).toHaveCount(0);
  await context.close();
});

test("Back from a non-home tab with no history goes to Plan", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false });
  await page.evaluate(() => localStorage.setItem("gym_tab", "food"));
  await page.reload();
  await page.waitForFunction(() => window.GymUI && window.GymNativeShell);
  await mockShell(page);
  expect(await tabNow(page)).toBe("food");
  await back(page);
  expect(await tabNow(page)).toBe("plan");
  expect(await page.evaluate(() => window.__shell.exit)).toBe(0);
  await context.close();
});

test("Back out of a sub-screen returns to its parent, then the previous tab", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await mockShell(page);
  await goTab(page, "coach");
  await expect(page.locator("#coachBody")).toBeVisible();
  await page.evaluate(() => GymCoach.myPlans());
  await expect(page.locator(".coach-myplans-head")).toBeVisible();
  await back(page);
  await expect(page.locator(".coach-myplans-head")).toHaveCount(0);
  expect(await tabNow(page)).toBe("coach");
  await back(page);
  expect(await tabNow(page)).toBe("plan");
  expect(await page.evaluate(() => window.__shell.exit)).toBe(0);
  await context.close();
});

test("on-screen Back of a sub-screen leaves no stale entry for hardware Back", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await mockShell(page);
  await goTab(page, "coach");
  await page.evaluate(() => GymCoach.myPlans());
  await page.click(".coach-myplans-head .coach-secondary");
  await expect(page.locator(".coach-myplans-head")).toHaveCount(0);
  await back(page);
  expect(await tabNow(page)).toBe("plan");
  await context.close();
});

test("Back on Plan: toast first, exit on the second press within 2 s, re-arms after", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false });
  await mockShell(page);
  await back(page);
  await expect(page.locator("#gymToast")).toContainText("Press back again to exit");
  expect(await page.evaluate(() => window.__shell.exit)).toBe(0);
  await page.screenshot({ path: process.env.BACK_SHOT || "test-results/exit-toast.png" });
  await back(page);
  expect(await page.evaluate(() => window.__shell.exit)).toBe(1);
  // a lone press after the window only warns again
  await page.evaluate(() => { window.__now = Date.now; });
  await page.evaluate(() => { const t = Date.now(); Date.now = () => t + 5000; });
  await back(page);
  expect(await page.evaluate(() => window.__shell.exit)).toBe(1);
  await context.close();
});

test("exit warning is in Arabic when the app is", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false, lang: "ar" });
  await mockShell(page);
  await back(page);
  await expect(page.locator("#gymToast")).toContainText("اضغط رجوع مرة أخرى للخروج");
  await context.close();
});

test("a sheet closes before any tab or sub-screen Back", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false });
  await mockShell(page);
  await goTab(page, "food");
  await page.click("#feedbackBtn");
  await expect(page.locator("#feedbackSheet [role=dialog]")).toBeVisible();
  await back(page);
  await expect(page.locator("#feedbackSheet")).toHaveCount(0);
  expect(await tabNow(page)).toBe("food");
  await back(page);
  expect(await tabNow(page)).toBe("plan");
  await context.close();
});

test("Back stops a ringing timer banner before anything else", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false });
  await mockShell(page);
  await page.evaluate(() => window.startAlarm("x"));
  await expect(page.locator("#alarmBanner")).toBeVisible();
  await back(page);
  await expect(page.locator("#alarmBanner")).toBeHidden();
  expect(await page.evaluate(() => window.__shell.exit)).toBe(0);
  await context.close();
});

test("web / PWA: no listeners, no version, nothing crashes", async ({ browser }) => {
  const { context, page, consoleErrors } = await openApp(browser, { signedIn: false });
  await page.evaluate(() => window.GymNativeShell.init());
  expect(await page.evaluate(() => window.GYM_APP_VERSION)).toBeUndefined();
  await context.close();
});

test("app version reaches the feedback payload (native) and is absent on web", async ({ browser }) => {
  for (const native of [true, false]) {
    const { context, page } = await openApp(browser, { signedIn: false });
    const posts = [];
    await page.route("**/api/v1/feedback", async (route) => {
      posts.push(JSON.parse(route.request().postData() || "{}"));
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "f1" }) });
    });
    if (native) {
      await mockShell(page, { version: "1.4.0" });
      await expect.poll(() => page.evaluate(() => window.GYM_APP_VERSION)).toBe("1.4.0");
    }
    await page.click("#feedbackBtn");
    await page.fill("#fbMsg", "hello there");
    await page.fill("#fbEmail", "g@example.com");
    await page.click(".fb-send");
    await expect(page.locator("#fbTitle")).toHaveText("Thanks! The team will read it.");
    expect(posts).toHaveLength(1);
    if (native) expect(posts[0].context.appVersion).toBe("1.4.0");
    else expect(posts[0].context.appVersion).toBeUndefined();
    await context.close();
  }
});

test("deletes the superseded rest-timer channel on Android only, ignoring errors", async ({ browser }) => {
  let r = await openApp(browser, { signedIn: false });
  await mockShell(r.page, { deleteFails: true });
  expect(await r.page.evaluate(() => window.__shell.deleted)).toEqual(["rest-timer"]);
  await r.page.evaluate(() => window.GymNativeShell.init()); // idempotent: not repeated
  expect(await r.page.evaluate(() => window.__shell.deleted)).toEqual(["rest-timer"]);
  await r.context.close();
  r = await openApp(browser, { signedIn: false });
  await mockShell(r.page, { platform: "ios" });
  expect(await r.page.evaluate(() => window.__shell.deleted)).toEqual([]);
  await r.context.close();
});

test("timer end uses the TimerAlarm plugin (insistent alarm) instead of a plain notification", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false });
  await mockShell(page, { timerAlarm: true });
  const btn = page.locator("#exList [data-rest]").first();
  await btn.scrollIntoViewIfNeeded();
  const secs = parseInt(await btn.getAttribute("data-rest"), 10);
  const before = await page.evaluate(() => Date.now());
  await btn.click();
  await expect.poll(() => page.evaluate(() => window.__ta.scheduled.length)).toBe(1);
  const s = await page.evaluate(() => window.__ta.scheduled[0]);
  expect(s.id).toBe(4242);
  expect(Math.abs(s.at - (before + secs * 1000))).toBeLessThan(5000);
  expect(s.title).toBeTruthy();
  expect(s.stopLabel).toBe("Stop");
  expect(await page.evaluate(() => window.__shell.lnScheduled)).toBeUndefined();
  await context.close();
});
