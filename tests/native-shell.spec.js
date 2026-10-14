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
