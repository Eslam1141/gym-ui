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
  // The installed clock keeps running between evaluate() and pauseAt(), so a
  // target equal to "now" can already be in the past; pause a safe second ahead.
  const now = await page.evaluate(() => Date.now());
  const pausedAt = now + 1000;
  await page.clock.pauseAt(pausedAt);
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

for (const [state, expectExact] of [["denied", false], ["granted", true], ["unavailable", false]]) {
  test(`native rest alert never opens system settings (exact alarms ${state})`, async ({ browser }) => {
    const { page, context } = await openApp(browser);
    await stubAlerts(page);
    await page.evaluate((state) => {
      window.__notif = { scheduled: [], settingsCalls: 0 };
      const ln = {
        checkPermissions: async () => ({ display: "granted" }),
        requestPermissions: async () => ({ display: "granted" }),
        createChannel: async () => {},
        // The real plugin opens "Alarms & reminders" if this is ever called.
        changeExactNotificationSetting: async () => { window.__notif.settingsCalls++; return { exact_alarm: "granted" }; },
        schedule: async (o) => {
          // ...and also from schedule() when an exact alarm is requested without the permission.
          if (state !== "granted" && o.notifications.some(n => n.isExactNotification !== false)) window.__notif.settingsCalls++;
          window.__notif.scheduled.push(o);
        },
        cancel: async () => {}
      };
      if (state !== "unavailable") ln.checkExactNotificationSetting = async () => ({ exact_alarm: state });
      window.Capacitor = { isNativePlatform: () => true, Plugins: { LocalNotifications: ln } };
    }, state);
    await startRest(page);
    await expect.poll(() => page.evaluate(() => window.__notif.scheduled.length)).toBe(1);
    const n = await page.evaluate(() => window.__notif.scheduled[0].notifications[0]);
    expect(n.isExactNotification).toBe(expectExact);
    expect(n.schedule.allowWhileIdle).toBe(true);
    expect(await page.evaluate(() => window.__notif.settingsCalls)).toBe(0);
    await context.close();
  });
}

// ---- circular ring ----
const ringOffset = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.getElementById("timerFill")).strokeDashoffset.replace(/^calc\(/, "")));

test("ring drains smoothly as time passes", async ({ browser }) => {
  const { page, context } = await openApp(browser);
  await stubAlerts(page);
  const secs = await startRest(page);
  const start = await ringOffset(page);
  expect(start).toBeCloseTo(0, 0);
  await page.clock.runFor(2000);
  const quarter = await ringOffset(page);
  expect(quarter).toBeLessThan(-100 * 1.5 / secs);
  await page.clock.runFor(2000);
  expect(await ringOffset(page)).toBeLessThan(quarter - 100 * 1.5 / secs);
  // continuous: moves between whole seconds
  const a = await ringOffset(page);
  await page.clock.runFor(100);
  expect(await ringOffset(page)).toBeLessThan(a);
  await context.close();
});

test("widget has timer role, a named label and skip hides it", async ({ browser }) => {
  const { page, context } = await openApp(browser);
  await stubAlerts(page);
  await startRest(page);
  await expect(page.locator("#timerBar")).toHaveAttribute("role", "timer");
  await expect(page.locator("#timerBar")).toHaveAttribute("aria-label", /^Rest — .+/);
  await page.click("#timerSkip");
  await expect(page.locator("#timerBar")).not.toHaveClass(/show/);
  await expect(page.locator("#timerBar")).toBeHidden();
  await context.close();
});

test("final seconds state applies at 5s or less and the time is announced at 10s", async ({ browser }) => {
  const { page, context } = await openApp(browser);
  await stubAlerts(page);
  const secs = await startRest(page);
  await screenOffFor(page, (secs - 10) * 1000 - 400);
  await page.clock.resume();
  await page.clock.runFor(600);
  await expect(page.locator("#timerLive")).toHaveText("10 seconds left");
  await expect(page.locator("#timerBar")).not.toHaveClass(/ending/);
  await page.clock.runFor(5000);
  await expect(page.locator("#timerBar")).toHaveClass(/ending/);
  await expect(page.locator("#timerTime")).toHaveText("00:05");
  await page.clock.runFor(5500);
  await expect(page.locator("#timerBar")).not.toHaveClass(/show/);
  await expect(page.locator("#timerLive")).toHaveText("Rest is over");
  expect(await page.evaluate(() => window.__beeps)).toBe(1);
  await context.close();
});

test("+15 s extends the end time and reschedules the native alert", async ({ browser }) => {
  const { page, context } = await openApp(browser);
  await stubAlerts(page);
  await page.evaluate(() => {
    window.__notif = { scheduled: [] };
    window.Capacitor = {
      isNativePlatform: () => true,
      Plugins: { LocalNotifications: {
        checkPermissions: async () => ({ display: "granted" }),
        requestPermissions: async () => ({ display: "granted" }),
        createChannel: async () => {},
        schedule: async (o) => { window.__notif.scheduled.push(o); },
        cancel: async () => {}
      } }
    };
  });
  const secs = await startRest(page);
  await expect.poll(() => page.evaluate(() => window.__notif.scheduled.length)).toBe(1);
  await page.click("#timerAdd");
  await expect.poll(() => page.evaluate(() => window.__notif.scheduled.length)).toBe(2);
  const n = await page.evaluate(() => window.__notif.scheduled[1].notifications[0]);
  const fireIn = Date.parse(n.schedule.at) - await page.evaluate(() => Date.now());
  expect(Math.abs(fireIn - (secs + 15) * 1000)).toBeLessThan(1500);
  const mm = String(Math.floor((secs + 15) / 60)).padStart(2, "0"), ss = String((secs + 15) % 60).padStart(2, "0");
  await expect(page.locator("#timerTime")).toHaveText(`${mm}:${ss}`);
  await context.close();
});

test("reduced motion: no pulse or transitions, ring steps with the displayed second", async ({ browser }) => {
  const { page, context } = await openApp(browser);
  await stubAlerts(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const secs = await startRest(page);
  await screenOffFor(page, (secs - 4) * 1000);
  await page.clock.resume();
  await page.clock.runFor(200);
  await expect(page.locator("#timerBar")).toHaveClass(/ending/);
  const info = await page.evaluate(() => {
    const cs = (sel) => getComputedStyle(document.querySelector(sel));
    return { pulse: cs("#timerTime").animationName, trans: cs("#timerBar").transitionDuration, time: document.getElementById("timerTime").textContent };
  });
  expect(info.pulse).toBe("none");
  expect(parseFloat(info.trans)).toBeLessThan(0.001);
  const [m, sec] = info.time.split(":").map(Number);
  expect(await ringOffset(page)).toBeCloseTo(-(1 - (m * 60 + sec) / secs) * 100, 1);
  await context.close();
});
