// Exercise timer (holds measured in seconds) and the finish alarm shared with
// the rest timer: detection, ready count, countdown, +15 s, mutual exclusion,
// logged-seconds autofill, alarm repeat / Stop / 30 s auto-stop, no double
// ring, and the native timer-alarm channel.
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
      createGain() { return { connect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime() {} } }; }
    }
    window.AudioContext = FakeCtx;
    window.webkitAudioContext = FakeCtx;
  });
}

async function mockNative(page) {
  await page.evaluate(() => {
    window.__n = { channels: [], scheduled: [], cancelled: 0 };
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
      Plugins: { LocalNotifications: {
        checkPermissions: async () => ({ display: "granted" }),
        requestPermissions: async () => ({ display: "granted" }),
        createChannel: async (c) => { window.__n.channels.push(c); },
        checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
        schedule: async (o) => { window.__n.scheduled.push(o); },
        cancel: async () => { window.__n.cancelled++; }
      } }
    };
  });
}

// Only the women's gym plan (Upper B has a plank) ships a timed exercise on
// the default style, so open that and jump to the day that has it.
async function openTimed(browser, opts) {
  const r = await openApp(browser, Object.assign({ plan: "female" }, opts || {}));
  const page = r.page;
  await page.evaluate(() => {
    const d = DAYS.find((x) => x.exercises.some((e) => timedSeconds(e.reps) > 0));
    activeDay = d.id;
    renderExercises();
  });
  await stubAlerts(page);
  return r;
}

const startBtn = (page) => page.locator("#exList [data-extimer]").first();
const dock = (page) => page.locator("#timerBar");
const banner = (page) => page.locator("#alarmBanner");

async function startEx(page) {
  const b = startBtn(page);
  await b.scrollIntoViewIfNeeded();
  await b.click();
  await expect(dock(page)).toHaveClass(/show/);
}

test("timed target detection", async ({ browser }) => {
  const { page, context } = await openApp(browser);
  const got = await page.evaluate(() => ["30s", "45 sec", "30-45s", "45-60s", "25–40s", "1 min", "40s/side", "12/side", "10-12", "10-15", "12-15/arm", "", null, "8 seconds"].map(timedSeconds));
  expect(got).toEqual([30, 45, 45, 60, 40, 60, 40, 0, 0, 0, 0, 0, 0, 8]);
  await context.close();
});

test("every plan's seconds-based exercise gets a Start button; rep exercises do not", async ({ browser }) => {
  const { page, context } = await openApp(browser);
  const res = await page.evaluate(() => {
    const out = { timed: [], mismatches: [] };
    for (const d of [].concat(DAYS_PREVIEW, DAYS_MALE, DAYS_FEMALE, DAYS_MALE_CAL, DAYS_FEMALE_CAL)) for (const e of d.exercises) {
      const looksTimed = /\d\s*(s|sec)\b/i.test(String(e.reps));
      if (looksTimed) out.timed.push(e.id + ":" + e.reps);
      if (looksTimed !== (timedSeconds(e.reps) > 0)) out.mismatches.push(e.id);
    }
    return out;
  });
  expect(res.timed.length).toBe(12);
  expect(res.mismatches).toEqual([]);
  await context.close();
});

test("timed card shows Start with the target, a seconds field, no reps unit", async ({ browser }) => {
  const { page, context } = await openTimed(browser);
  const b = startBtn(page);
  await expect(b).toBeVisible();
  await expect(b).toHaveText(/Start \d+ s/);
  const card = b.locator("xpath=ancestor::div[contains(@class,'ex-card')]");
  await expect(card.locator(".log-field .unit").last()).toHaveText("sec");
  // a rep exercise in the same render has no timer button
  expect(await page.locator("#exList .ex-card").count()).toBeGreaterThan(await page.locator("#exList [data-extimer]").count());
  await context.close();
});

test("3-2-1 ready count, then the hold counts down from the upper bound", async ({ browser }) => {
  const { page, context } = await openTimed(browser);
  const target = parseInt(await startBtn(page).getAttribute("data-sec"), 10);
  await startEx(page);
  await expect(dock(page)).toHaveClass(/ready/);
  await expect(page.locator("#timerTime")).toHaveText("3");
  await expect(page.locator("#timerAdd")).toBeDisabled();
  await page.clock.runFor(1100);
  await expect(page.locator("#timerTime")).toHaveText("2");
  await page.clock.runFor(2200);
  await expect(dock(page)).not.toHaveClass(/ready/);
  const mm = String(Math.floor(target / 60)).padStart(2, "0"), ss = String(target % 60).padStart(2, "0");
  await expect(page.locator("#timerTime")).toHaveText(new RegExp(`^(${mm}:${ss}|${mm}:${String(target % 60 - 1).padStart(2, "0")})$`));
  await expect(page.locator("#timerAdd")).toBeEnabled();
  await context.close();
});

test("+15 s lengthens the hold", async ({ browser }) => {
  const { page, context } = await openTimed(browser);
  const target = parseInt(await startBtn(page).getAttribute("data-sec"), 10);
  await startEx(page);
  await page.clock.runFor(3500);
  await page.click("#timerAdd");
  const left = await page.evaluate(() => { const [m, s] = document.getElementById("timerTime").textContent.split(":").map(Number); return m * 60 + s; });
  expect(left).toBeGreaterThanOrEqual(target + 15 - 2);
  expect(left).toBeLessThanOrEqual(target + 15);
  await context.close();
});

test("finishing fills the seconds held and rings the alarm; Save logs them", async ({ browser }) => {
  const { page, context } = await openTimed(browser);
  const target = parseInt(await startBtn(page).getAttribute("data-sec"), 10);
  await startEx(page);
  await page.clock.fastForward((3 + target) * 1000 + 600);
  await expect(banner(page)).toBeVisible();
  await expect(page.locator("#alarmTitle")).toHaveText("Time's up");
  await expect(dock(page)).not.toHaveClass(/show/);
  const input = page.locator("#exList .ex-card:has([data-extimer])").first().locator("[data-r]");
  await expect(input).toHaveValue(String(target));
  const exId = await input.getAttribute("data-r");
  await page.click("#alarmStop");
  await page.locator(`[data-w="${exId}"]`).fill("0");
  await page.locator(`[data-save="${exId}"]`).click();
  const saved = await page.evaluate((id) => JSON.parse(localStorage.getItem("gym_weights"))[id].slice(-1)[0], exId);
  expect(saved.r).toBe(String(target));
  await context.close();
});

test("Stop early logs the seconds actually held", async ({ browser }) => {
  const { page, context } = await openTimed(browser);
  await startEx(page);
  await page.clock.runFor(3000 + 12000 + 300);
  await page.click("#timerSkip");
  await expect(dock(page)).not.toHaveClass(/show/);
  await expect(banner(page)).toBeHidden();
  const v = parseInt(await page.locator("#exList [data-r]").evaluateAll((els) => els.find((e) => e.value).value), 10);
  expect(v).toBeGreaterThanOrEqual(11);
  expect(v).toBeLessThanOrEqual(13);
  await context.close();
});

test("exercise timer and rest timer never run at once", async ({ browser }) => {
  const { page, context } = await openTimed(browser);
  await startEx(page);
  await page.clock.runFor(4000);
  await page.locator("#exList [data-rest]").first().click();
  await expect(dock(page)).not.toHaveClass(/ex/);
  await expect(dock(page)).toHaveAttribute("aria-label", /^Rest — /);
  await expect(page.locator("#timerAdd")).toBeEnabled();
  // and back: the exercise timer replaces the rest, which can no longer ring
  await startEx(page);
  await expect(dock(page)).toHaveClass(/ex/);
  await expect(dock(page)).toHaveClass(/ready/);
  await page.click("#timerSkip");
  await page.clock.runFor(200000);
  await expect(banner(page)).toBeHidden(); // the replaced timer never rings
  await context.close();
});

test("alarm repeats until Stop, then goes quiet", async ({ browser }) => {
  const { page, context } = await openTimed(browser);
  await page.locator("#exList [data-rest]").first().click();
  const ms = await page.evaluate(() => restEndAt - Date.now());
  await page.clock.fastForward(ms + 400); // jump: ticking a 2-minute rest frame by frame is slow
  await expect(banner(page)).toBeVisible();
  const first = await page.evaluate(() => window.__beeps);
  expect(first).toBe(4);
  await page.clock.runFor(2300);
  expect(await page.evaluate(() => window.__beeps)).toBe(8);
  expect(await page.evaluate(() => window.__vibrations.length)).toBe(2);
  await page.clock.runFor(6600);
  expect(await page.evaluate(() => window.__beeps)).toBe(20);
  await page.click("#alarmStop");
  await expect(banner(page)).toBeHidden();
  const after = await page.evaluate(() => window.__beeps);
  await page.clock.runFor(10000);
  expect(await page.evaluate(() => window.__beeps)).toBe(after);
  await context.close();
});

test("alarm stops itself after 30 s", async ({ browser }) => {
  const { page, context } = await openTimed(browser);
  await page.locator("#exList [data-rest]").first().click();
  const ms = await page.evaluate(() => restEndAt - Date.now());
  await page.clock.fastForward(ms + 400); // jump: ticking a 2-minute rest frame by frame is slow
  await expect(banner(page)).toBeVisible();
  await page.clock.runFor(29000);
  await expect(banner(page)).toBeVisible();
  await page.clock.runFor(1500);
  await expect(banner(page)).toBeHidden();
  const n = await page.evaluate(() => window.__beeps);
  await page.clock.runFor(8000);
  expect(await page.evaluate(() => window.__beeps)).toBe(n);
  await context.close();
});

test("tapping the banner, or Escape, stops the alarm", async ({ browser }) => {
  for (const how of ["tap", "escape"]) {
    const { page, context } = await openTimed(browser);
    await page.locator("#exList [data-rest]").first().click();
    const ms = await page.evaluate(() => restEndAt - Date.now());
    await page.clock.fastForward(ms + 400); // jump: ticking a 2-minute rest frame by frame is slow
    await expect(banner(page)).toBeVisible();
    if (how === "tap") await banner(page).locator(".alarm-text").click(); else await page.keyboard.press("Escape");
    await expect(banner(page)).toBeHidden();
    await context.close();
  }
});

test("starting a new timer silences a ringing alarm", async ({ browser }) => {
  const { page, context } = await openTimed(browser);
  await page.locator("#exList [data-rest]").first().click();
  const ms = await page.evaluate(() => restEndAt - Date.now());
  await page.clock.fastForward(ms + 400); // jump: ticking a 2-minute rest frame by frame is slow
  await expect(banner(page)).toBeVisible();
  await startEx(page);
  await expect(banner(page)).toBeHidden();
  await context.close();
});

test("a second finish while ringing never stacks a second alarm", async ({ browser }) => {
  const { page, context } = await openTimed(browser);
  await page.evaluate(() => { startAlarm("a"); startAlarm("b"); });
  expect(await page.evaluate(() => window.__beeps)).toBe(4);
  await page.clock.runFor(2300);
  expect(await page.evaluate(() => window.__beeps)).toBe(8); // one repeating loop, not two
  await context.close();
});

test("native: finish alert uses the timer-alarm channel for exercise and rest alike", async ({ browser }) => {
  const { page, context } = await openTimed(browser);
  await mockNative(page);
  const target = parseInt(await startBtn(page).getAttribute("data-sec"), 10);
  await startEx(page);
  await expect.poll(() => page.evaluate(() => window.__n.scheduled.length)).toBe(1);
  const ch = await page.evaluate(() => window.__n.channels[0]);
  expect(ch).toMatchObject({ id: "timer-alarm", importance: 5, vibration: true, sound: "timer_alarm.wav" });
  const n = await page.evaluate(() => window.__n.scheduled[0].notifications[0]);
  expect(n.channelId).toBe("timer-alarm");
  expect(n.title).toBe("Time's up");
  expect(n.isExactNotification).toBe(true);
  const fireIn = Date.parse(n.schedule.at) - (await page.evaluate(() => Date.now()));
  expect(Math.abs(fireIn - (3 + target) * 1000)).toBeLessThan(1500); // end of the HOLD, not of the 3-2-1
  await page.click("#timerSkip");
  await page.locator("#exList [data-rest]").first().click();
  await expect.poll(() => page.evaluate(() => window.__n.scheduled.length)).toBe(2);
  expect(await page.evaluate(() => window.__n.scheduled[1].notifications[0].channelId)).toBe("timer-alarm");
  await context.close();
});

test("native: back after the notification rang, the in-app alarm does not ring again", async ({ browser }) => {
  const { page, context } = await openTimed(browser);
  await mockNative(page);
  await page.locator("#exList [data-rest]").first().click();
  await expect.poll(() => page.evaluate(() => window.__n.scheduled.length)).toBe(1);
  const secs = await page.evaluate(() => Math.ceil((restEndAt - Date.now()) / 1000));
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
  await page.clock.setSystemTime(now + (secs + 20) * 1000);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(dock(page)).not.toHaveClass(/show/);
  await expect(banner(page)).toBeHidden();
  expect(await page.evaluate(() => window.__beeps)).toBe(0);
  await context.close();
});

test("native: finishing in the foreground cancels the pending notification and rings in-app once", async ({ browser }) => {
  const { page, context } = await openTimed(browser);
  await mockNative(page);
  await page.locator("#exList [data-rest]").first().click();
  await expect.poll(() => page.evaluate(() => window.__n.scheduled.length)).toBe(1);
  const before = await page.evaluate(() => window.__n.cancelled);
  const secs = await page.evaluate(() => Math.ceil((restEndAt - Date.now()) / 1000));
  await page.clock.fastForward(secs * 1000 + 400);
  await expect(banner(page)).toBeVisible();
  expect(await page.evaluate(() => window.__n.cancelled)).toBe(before + 1);
  expect(await page.evaluate(() => window.__beeps)).toBe(4);
  await context.close();
});

test("exercise timer survives the screen turning off (wall-clock end time)", async ({ browser }) => {
  const { page, context } = await openTimed(browser);
  const target = parseInt(await startBtn(page).getAttribute("data-sec"), 10);
  await startEx(page);
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
  await page.clock.setSystemTime(now + (3 + target - 10) * 1000);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator("#timerTime")).toHaveText("00:10");
  await context.close();
});

test("Arabic copy, RTL, women variant", async ({ browser }) => {
  for (const [plan, body] of [["female", "دوسي حفظ"], ["male", "دوس حفظ"]]) {
    const { page, context } = await openTimed(browser, { lang: "ar" });
    await page.evaluate((p) => { document.documentElement.dataset.plan = p; }, plan); // the copy follows the root plan
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
    await expect(startBtn(page)).toHaveText(/ابدأ \d+ ثانية/);
    await startEx(page);
    await page.clock.runFor(3000 + 100);
    const target = parseInt(await startBtn(page).getAttribute("data-sec"), 10);
    await page.clock.fastForward(target * 1000 + 600);
    await expect(page.locator("#alarmTitle")).toHaveText("انتهى الوقت");
    await expect(page.locator("#alarmStop")).toHaveText("إيقاف");
    await expect(page.locator("#alarmSub")).toContainText(body);
    await context.close();
  }
});
