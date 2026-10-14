// One-time "Allow precise rest alerts?" opt-in (native Android 14+ only).
// changeExactNotificationSetting opens system Settings, so it may run only
// from the Allow tap.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

const KEY = "etq_precise_alerts_v1";

// o: platform ("android"|"ios"), native (default true), api (major version), exact ("denied"|"granted")
async function mockNative(page, o) {
  await page.evaluate((o) => {
    window.__calls = { change: 0, scheduled: [] };
    window.__exact = o.exact;
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      value: { getHighEntropyValues: async () => ({ platformVersion: String(o.api) + ".0.0" }) }
    });
    const ln = {
      checkPermissions: async () => ({ display: "granted" }),
      requestPermissions: async () => ({ display: "granted" }),
      createChannel: async () => {},
      checkExactNotificationSetting: async () => ({ exact_alarm: window.__exact }),
      changeExactNotificationSetting: async () => { window.__calls.change++; return { exact_alarm: window.__exact }; },
      schedule: async (x) => { window.__calls.scheduled.push(x); },
      cancel: async () => {}
    };
    window.Capacitor = {
      isNativePlatform: () => o.native !== false,
      getPlatform: () => o.platform || "android",
      Plugins: { LocalNotifications: ln }
    };
  }, o);
}

async function startRest(page) {
  const btn = page.locator("#exList [data-rest]").first();
  await btn.scrollIntoViewIfNeeded();
  const secs = parseInt(await btn.getAttribute("data-rest"), 10);
  await btn.click();
  await expect(page.locator("#timerBar")).toHaveClass(/show/);
  return secs;
}

async function finishRest(page) {
  const secs = await startRest(page);
  await page.clock.fastForward((secs + 2) * 1000);
  await page.waitForTimeout(300); // real time: the async gating checks settle
  await page.clock.runFor(1200);
}

const sheet = (page) => page.locator("#preciseSheet");
const stored = (page) => page.evaluate((k) => localStorage.getItem(k), KEY);
const changeCalls = (page) => page.evaluate(() => window.__calls.change);

async function setup(browser, native, app, seed) {
  const r = await openApp(browser, app);
  if (seed) await r.page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, seed]);
  await mockNative(r.page, native);
  return r;
}

const gates = [
  ["web / PWA", { native: false, api: 15, exact: "denied" }],
  ["native but not android", { platform: "ios", api: 15, exact: "denied" }],
  ["android 13", { api: 13, exact: "denied" }],
  ["exact alarms already granted", { api: 15, exact: "granted" }]
];
for (const [name, native] of gates) {
  test(`no prompt: ${name}`, async ({ browser }) => {
    const { page, context } = await setup(browser, native);
    await finishRest(page);
    await expect(sheet(page)).toHaveCount(0);
    expect(await changeCalls(page)).toBe(0);
    expect(await stored(page)).toBeNull();
    await context.close();
  });
}

test("no prompt on launch or when a rest starts, only after it ends", async ({ browser }) => {
  const { page, context } = await setup(browser, { api: 14, exact: "denied" });
  await page.clock.runFor(5000);
  await expect(sheet(page)).toHaveCount(0);
  await startRest(page);
  await page.clock.runFor(1500);
  await expect(sheet(page)).toHaveCount(0);
  await context.close();
});

test("android 14: Not now never calls Settings and is remembered", async ({ browser }) => {
  const { page, context } = await setup(browser, { api: 14, exact: "denied" });
  await finishRest(page);
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByRole("dialog")).toHaveAccessibleName("Allow precise rest alerts?");
  expect(await changeCalls(page)).toBe(0);
  await sheet(page).getByRole("button", { name: "Not now" }).click();
  await expect(sheet(page)).toHaveCount(0);
  expect(await changeCalls(page)).toBe(0);
  expect(await stored(page)).toBe("later");
  await finishRest(page);
  await expect(sheet(page)).toHaveCount(0);
  await context.close();
});

for (const how of ["Escape", "backdrop"]) {
  test(`${how} closes as Not now without calling Settings`, async ({ browser }) => {
    const { page, context } = await setup(browser, { api: 15, exact: "denied" });
    await finishRest(page);
    await expect(sheet(page)).toBeVisible();
    if (how === "Escape") await page.keyboard.press("Escape");
    else await page.locator("#preciseSheet .syd-backdrop").click({ position: { x: 5, y: 5 } });
    await expect(sheet(page)).toHaveCount(0);
    expect(await changeCalls(page)).toBe(0);
    expect(await stored(page)).toBe("later");
    await context.close();
  });
}

test("focus is trapped inside the prompt", async ({ browser }) => {
  const { page, context } = await setup(browser, { api: 14, exact: "denied" });
  await finishRest(page);
  const allow = sheet(page).getByRole("button", { name: "Allow", exact: true });
  const later = sheet(page).getByRole("button", { name: "Not now" });
  await expect(allow).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(later).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(allow).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(later).toBeFocused();
  await context.close();
});

test("Allow calls changeExactNotificationSetting exactly once, then never prompts again", async ({ browser }) => {
  const { page, context } = await setup(browser, { api: 14, exact: "denied" });
  await finishRest(page);
  expect(await changeCalls(page)).toBe(0);
  await sheet(page).getByRole("button", { name: "Allow", exact: true }).click();
  await expect(sheet(page)).toHaveCount(0);
  expect(await changeCalls(page)).toBe(1);
  expect(await stored(page)).toBe("allow");
  await finishRest(page);
  await expect(sheet(page)).toHaveCount(0);
  expect(await changeCalls(page)).toBe(1);
  await context.close();
});

test("already answered earlier: no prompt", async ({ browser }) => {
  const { page, context } = await setup(browser, { api: 14, exact: "denied" }, null);
  await page.evaluate((k) => localStorage.setItem(k, "later"), KEY);
  await finishRest(page);
  await expect(sheet(page)).toHaveCount(0);
  await context.close();
});

test("back from Settings, the running timer is rescheduled as an exact alarm", async ({ browser }) => {
  const { page, context } = await setup(browser, { api: 14, exact: "denied" });
  await finishRest(page);
  await sheet(page).getByRole("button", { name: "Allow", exact: true }).click();
  await startRest(page); // started while Settings is open: inexact
  await expect.poll(() => page.evaluate(() => window.__calls.scheduled.length)).toBeGreaterThan(0);
  const before = await page.evaluate(() => window.__calls.scheduled.length);
  expect(await page.evaluate((i) => window.__calls.scheduled[i].notifications[0].isExactNotification, before - 1)).toBe(false);
  await page.evaluate(() => { window.__exact = "granted"; document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(() => page.evaluate(() => window.__calls.scheduled.length)).toBe(before + 1);
  expect(await page.evaluate((i) => window.__calls.scheduled[i].notifications[0].isExactNotification, before)).toBe(true);
  expect(await changeCalls(page)).toBe(1);
  await context.close();
});

test("Arabic: RTL, Egyptian copy, feminine on the women plan", async ({ browser }) => {
  for (const [plan, title, allow] of [
    ["male", "تسمح بتنبيهات الراحة بالثانية؟", "اسمح"],
    ["female", "تسمحي بتنبيهات الراحة بالثانية؟", "اسمحي"]
  ]) {
    const { page, context } = await setup(browser, { api: 14, exact: "denied" }, { lang: "ar", plan });
    await finishRest(page);
    await expect(sheet(page).locator(".syd-title")).toHaveText(title);
    await expect(sheet(page).locator(".syd-yes")).toHaveText(allow);
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
    await context.close();
  }
});
