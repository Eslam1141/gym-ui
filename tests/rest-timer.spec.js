// Rest timer survives the screen turning off: phones freeze setInterval while
// the screen is off, so the timer must count from a wall-clock end time and
// alert (beep + vibrate) as soon as the page is visible again.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

async function stubAlerts(page) {
  await page.evaluate(() => {
    window.__vibrations = [];
    window.__beeps = 0;
    navigator.vibrate = (p) => { window.__vibrations.push(p); return true; };
    class FakeCtx {
      constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; }
      resume() { return Promise.resolve(); }
      createOscillator() { return { connect() {}, frequency: {}, start() { window.__beeps++; }, stop() {} }; }
      createGain() { return { connect() {}, gain: { setValueAtTime() {} } }; }
    }
    window.AudioContext = FakeCtx;
    window.webkitAudioContext = FakeCtx;
  });
}

async function startRest(page) {
  const btn = page.locator("#exList [data-rest]").first();
  await btn.scrollIntoViewIfNeeded();
  const secs = parseInt(await btn.getAttribute("data-rest"), 10);
  await btn.click();
  await expect(page.locator("#timerBar")).toHaveClass(/show/);
  return secs;
}

async function screenOffFor(page, ms) {
  // Timers don't run while the screen is off: move the wall clock without
  // firing them, then report the page visible again.
  await page.clock.pauseAt(Date.parse(await page.evaluate(() => new Date().toISOString())));
  const now = await page.evaluate(() => Date.now());
  await page.clock.setSystemTime(now + ms);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
}

test("time left is correct after the screen was off mid-rest", async ({ browser }) => {
  const { page, context } = await openApp(browser);
  await stubAlerts(page);
  const secs = await startRest(page);
  await screenOffFor(page, (secs - 10) * 1000);
  await expect(page.locator("#timerTime")).toHaveText("00:10");
  await context.close();
});

test("rest that ended while the screen was off alerts on return", async ({ browser }) => {
  const { page, context } = await openApp(browser);
  await stubAlerts(page);
  const secs = await startRest(page);
  await screenOffFor(page, (secs + 5) * 1000);
  await expect(page.locator("#timerBar")).not.toHaveClass(/show/);
  expect(await page.evaluate(() => window.__beeps)).toBe(1);
  expect(await page.evaluate(() => window.__vibrations.length)).toBe(1);
  await context.close();
});

test("skip stops the timer without alerting", async ({ browser }) => {
  const { page, context } = await openApp(browser);
  await stubAlerts(page);
  const secs = await startRest(page);
  await page.click("#timerSkip");
  await page.clock.runFor((secs + 2) * 1000);
  expect(await page.evaluate(() => window.__beeps)).toBe(0);
  await context.close();
});

test("native app schedules an end-of-rest notification and cancels it on skip", async ({ browser }) => {
  const { page, context } = await openApp(browser);
  await stubAlerts(page);
  await page.evaluate(() => {
    window.__notif = { scheduled: [], cancelled: [] };
    window.Capacitor = {
      isNativePlatform: () => true,
      Plugins: { LocalNotifications: {
        checkPermissions: async () => ({ display: "granted" }),
        requestPermissions: async () => ({ display: "granted" }),
        createChannel: async () => {},
        schedule: async (o) => { window.__notif.scheduled.push(o); },
        cancel: async (o) => { window.__notif.cancelled.push(o); }
      } }
    };
  });
  const secs = await startRest(page);
  await expect.poll(() => page.evaluate(() => window.__notif.scheduled.length)).toBe(1);
  const n = await page.evaluate(() => window.__notif.scheduled[0].notifications[0]);
  const fireIn = Date.parse(n.schedule.at) - await page.evaluate(() => Date.now());
  expect(Math.abs(fireIn - secs * 1000)).toBeLessThan(1500);
  const before = await page.evaluate(() => window.__notif.cancelled.length);
  await page.click("#timerSkip");
  await expect.poll(() => page.evaluate(() => window.__notif.cancelled.length)).toBe(before + 1);
  await context.close();
});
