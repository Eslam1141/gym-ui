// First-visit tips (tour.js): they must run, and "Replay tips" must work,
// while /me says onboardingCompleted:false (the survey isn't done) unless a
// survey is actually about to open. Works with or without survey.js.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);

const tourCard = (page) => page.locator("#tour .tour-card");

async function replayFromMenu(page) {
  await page.click("#tbAvatar");
  await page.click("#tbMenuTips");
}

test("no survey pending: tips start on Plan and Replay shows them again", async ({ browser }) => {
  // gym_survey_dismissed = "Not now" was tapped (no-op where survey.js isn't shipped).
  const { context, page } = await openApp(browser, {
    signedIn: true, tours: true, server: { onboardingCompleted: false }, ls: { gym_survey_dismissed: 1 }
  });
  await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
  await page.click("#tour .tour-skip");
  await expect(page.locator("#tour")).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gym_tours_seen")))).toMatchObject({ plan: 2 });

  await replayFromMenu(page);
  await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
  await context.close();
});

test("a pending survey holds the automatic tips, but Replay still works", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true, tours: true, server: { onboardingCompleted: false } });
  // Stand-in where survey.js isn't shipped; survey.js replaces it where it is.
  await page.addInitScript(() => { window.GymSurvey = { isPending: () => true, close: () => {} }; });
  await page.evaluate(() => localStorage.removeItem("gym_tours_seen"));
  await page.reload();
  await page.waitForFunction(() => window.GymTour && window.GymHeader && GymHeader.me && GymHeader.me());
  // Close the survey without "Not now": it stays pending.
  await page.waitForTimeout(1500);
  await page.evaluate(() => GymSurvey.close());
  expect(await page.evaluate(() => GymSurvey.isPending())).toBe(true);
  await page.waitForTimeout(3000);
  await expect(page.locator("#tour")).toHaveCount(0);

  await replayFromMenu(page);
  await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
  await context.close();
});

// ---------------------------------------------------------------------------
// Per-screen tour versions (gym_tours_seen = { screen: version }; a legacy 1 is v1),
// the coach-bubble step, the Watch tab tours and the one-time hint.
// ---------------------------------------------------------------------------
const { stubHealth, goWatch, WEEK_DATA } = require("./watch-helpers");

const V1 = { plan: 1, coach: 1, food: 1, more: 1 };
const seenOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("gym_tours_seen") || "{}"));
const goTab = (page, tab) => page.evaluate((t) => GymUI.navigate(t, { instant: true }), tab);

// Reads every step's text by pressing Next to the end (Got it on the last step).
async function walk(page) {
  const texts = [];
  for (let i = 0; i < 12; i++) {
    await expect(tourCard(page)).toBeVisible();
    texts.push(await page.locator("#tour .tour-text").textContent());
    const last = await page.locator("#tour .tour-skip").isHidden();
    await page.click("#tour .tour-next");
    if (last) break;
  }
  await expect(page.locator("#tour")).toBeHidden();
  return texts;
}
const has = (texts, frag) => texts.some((t) => t.includes(frag));

test.describe("tour versions", () => {
  test("a new account sees the first-visit list on Plan, bubble included, and never the returning-only steps", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, tours: true });
    await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
    const total = await page.locator("#tour .tour-count").textContent();
    const texts = await walk(page);
    expect(total).toBe(`1 of ${texts.length}`);
    expect(texts.length).toBeLessThanOrEqual(6);
    expect(has(texts, "Pick today's workout here. Your days follow your training split.")).toBe(true);
    expect(has(texts, "Tap the bubble to chat with the coach from any screen. Drag it")).toBe(true);
    expect(has(texts, "Tap a day to see or fix what you did")).toBe(true);
    expect(has(texts, "New: the Watch tab")).toBe(false);
    expect(has(texts, "See which muscles you trained this week")).toBe(false);
    expect(await seenOf(page)).toMatchObject({ plan: 2, bubble: 1 });
    await context.close();
  });

  test("a returning user (stored v1) sees only the new Plan steps, once, and then never again", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, tours: true, ls: { gym_tours_seen: V1 } });
    await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
    const texts = await walk(page);
    expect(has(texts, "Pick today's workout")).toBe(false);          // old steps stay quiet
    expect(has(texts, "Start the timer")).toBe(false);
    expect(has(texts, "See which muscles you trained this week")).toBe(true);
    expect(has(texts, "New: the Watch tab shows your steps, sleep and heart rate.")).toBe(true);
    expect(has(texts, "Tap the bubble")).toBe(true);
    expect(texts.length).toBeLessThanOrEqual(5);
    expect(await seenOf(page)).toMatchObject({ plan: 2, coach: 1, food: 1, more: 1, bubble: 1 });
    await page.reload();
    await page.waitForTimeout(3500);
    await expect(page.locator("#tour")).toBeHidden();
    await context.close();
  });

  test("only one returning-user tour per cold start; the next screen waits for the next one", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, tours: true, ls: { gym_tours_seen: V1 } });
    await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
    await walk(page);
    await goTab(page, "food");
    await page.waitForTimeout(3500);
    await expect(page.locator("#tour")).toBeHidden();
    expect((await seenOf(page)).food).toBe(1);
    // a new cold start (a fresh session) lets the next screen run
    await page.evaluate(() => sessionStorage.removeItem("etqtour_ret"));
    await goTab(page, "plan");
    await goTab(page, "food");
    await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
    const texts = await walk(page);
    expect(texts).toHaveLength(1);                                    // Food 2 adds one step
    expect(texts[0]).toContain("Tell the coach what you ate");
    expect((await seenOf(page)).food).toBe(2);
    await context.close();
  });

  test("More and Coach: returning users get exactly the steps added in v2", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, tours: true, ls: { gym_tours_seen: { plan: 2, coach: 1, food: 2, more: 1, bubble: 1 } } });
    await goTab(page, "more");
    await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
    const more = await walk(page);
    expect(has(more, "Choose how many days a week you train")).toBe(true);
    expect(has(more, "Download or delete your data")).toBe(true);
    expect(has(more, "Switch between the male and female plans")).toBe(false);
    expect(has(more, "Tap the bubble")).toBe(false);                  // already explained once
    await page.evaluate(() => sessionStorage.removeItem("etqtour_ret"));
    await goTab(page, "coach");
    await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
    const coach = await walk(page);
    expect(has(coach, "Prefer your own plan?")).toBe(true);
    expect(has(coach, "InBody")).toBe(true);
    expect(has(coach, "Fill in your numbers")).toBe(false);
    await context.close();
  });

  test("a stored version is never lowered (an older device writing 1 cannot reset a 2)", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, ls: { gym_tours_seen: { plan: 2 } } });
    await page.evaluate(() => GymTour.record("plan", 1));
    expect((await seenOf(page)).plan).toBe(2);
    await page.evaluate(() => GymTour.record("coach", 1));
    expect((await seenOf(page)).coach).toBe(1);
    await page.evaluate(() => GymTour.record("coach", 2));
    expect((await seenOf(page)).coach).toBe(2);
    await context.close();
  });

  test("steps whose target is missing drop out; if none is left nothing is marked seen", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, tours: true, ls: { gym_tours_seen: { plan: 2, coach: 2, food: 1, more: 2 } } });
    await page.addStyleTag({ content: "#coachFab{display:none !important}" });
    await goTab(page, "food");
    await page.waitForTimeout(4500);
    await expect(page.locator("#tour")).toBeHidden();
    expect((await seenOf(page)).food).toBe(1);
    await context.close();
  });

  test("Replay tips starts from scratch and the avatar-menu hint shows once", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, tours: true, server: { onboardingCompleted: true } });
    await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
    await page.click("#tour .tour-skip");
    await expect(page.locator("#gymToast")).toContainText("Tips live in your avatar menu: Replay tips.");
    expect(await page.evaluate(() => localStorage.getItem("etqtour_hint"))).toBe("1");
    await page.evaluate(() => { const t = document.getElementById("gymToast"); if (t) t.remove(); });
    await replayFromMenu(page);
    await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
    expect(await seenOf(page)).toEqual({});
    await page.click("#tour .tour-skip");
    await expect(page.locator("#gymToast")).toHaveCount(0);           // not a second time
    await context.close();
  });
});

test.describe("coach bubble step", () => {
  test("the spotlight is on the bubble, which stays put and inert", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, tours: true, ls: { gym_tours_seen: { plan: 1, coach: 1, food: 2, more: 2 } }, viewport: { width: 360, height: 780 } });
    await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
    for (let i = 0; i < 8; i++) {
      if ((await page.locator("#tour .tour-text").textContent()).includes("Tap the bubble")) break;
      await page.click("#tour .tour-next");
    }
    await expect(page.locator("#tour .tour-text")).toContainText("Tap the bubble to chat with the coach from any screen. Drag it where it is out of your way.");
    await page.waitForTimeout(600);                                   // the spotlight glides in
    const spot = await page.locator("#tour .tour-spot").boundingBox();
    const fab = await page.locator("#coachFab").boundingBox();
    expect(spot.x).toBeLessThanOrEqual(fab.x);
    expect(spot.y).toBeLessThanOrEqual(fab.y);
    expect(spot.x + spot.width).toBeGreaterThanOrEqual(fab.x + fab.width);
    expect(spot.y + spot.height).toBeGreaterThanOrEqual(fab.y + fab.height);
    expect(await page.locator("#coachFab").evaluate((n) => getComputedStyle(n).pointerEvents)).toBe("none");
    const box = await tourCard(page).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    await page.click("#tour .tour-next");
    await expect(page.locator("#tour")).toBeHidden();
    await expect(page.locator("#coachFab")).toBeVisible();
    await context.close();
  });
});

test.describe("Watch tab tours", () => {
  const SEEN = { plan: 2, coach: 2, food: 2, more: 2, bubble: 1 };
  async function open(browser, o) {
    o = o || {};
    const app = await openApp(browser, { signedIn: true, tours: true, lang: o.lang, theme: o.theme, ls: { gym_tours_seen: Object.assign({}, SEEN, o.seen || {}) }, viewport: { width: 360, height: 780 } });
    if (o.on) await app.page.evaluate(() => localStorage.setItem("etqwatch_on", "1"));
    if (!o.web) await stubHealth(app.page, { health: { data: WEEK_DATA } });
    await goWatch(app.page);
    return app;
  }

  test("not connected: one step that points at Connect, then the connected tour after connecting", async ({ browser }) => {
    const { context, page } = await open(browser);
    await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#tour .tour-text")).toHaveText("Connect your watch to fill this screen. It takes about a minute.");
    await expect(page.locator("#tour .tour-count")).toHaveText("");
    // The spotlight glides in (CSS transition on transform/width/height), so
    // poll until it has settled around the button instead of reading it mid-glide.
    await expect(async () => {
      const spot = await page.locator("#tour .tour-spot").boundingBox();
      const btn = await page.locator("#wtConnect").boundingBox();
      expect(spot.x).toBeLessThanOrEqual(btn.x);
      expect(spot.x + spot.width).toBeGreaterThanOrEqual(btn.x + btn.width);
    }).toPass({ timeout: 5000 });
    await page.click("#tour .tour-next");
    expect((await seenOf(page)).watchOff).toBe(1);
    expect((await seenOf(page)).watch).toBeUndefined();
    await page.click("#wtConnect");
    await page.click("#wtGo");
    await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
    const texts = await walk(page);
    expect(has(texts, "Your day at a glance")).toBe(true);
    expect(has(texts, "Switch between steps, calories, sleep and heart rate")).toBe(true);
    expect(has(texts, "Your watch data stays on this phone. You can disconnect any time.")).toBe(true);
    expect((await seenOf(page)).watch).toBe(1);
    await context.close();
  });

  test("connected: dial, chart tabs, workout dots, privacy", async ({ browser }) => {
    const { context, page } = await open(browser, { on: true });
    await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
    const texts = await walk(page);
    expect(texts).toHaveLength(4);
    expect(texts[2]).toContain("Dots mark the days you finished a workout");
    await context.close();
  });

  test("Arabic: the same steps in Arabic, the card inside the 360px screen", async ({ browser }) => {
    const { context, page } = await open(browser, { on: true, lang: "ar" });
    await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#tour .tour-text")).toHaveText("يومك في لمحة: الخطوات والسعرات النشطة والنوم. وتمتلئ الحلقات كلما اقتربت من هدفك.");
    const box = await tourCard(page).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    const lines = await page.locator("#tour .tour-text").evaluate((n) => n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).lineHeight));
    expect(lines).toBeLessThanOrEqual(5.5);
    await context.close();
  });

  test("web / PWA: there is nothing to point at, so no tour on the Watch tab", async ({ browser }) => {
    const { context, page } = await open(browser, { web: true });
    await page.waitForTimeout(4000);
    await expect(page.locator("#tour")).toBeHidden();
    expect((await seenOf(page)).watch).toBeUndefined();
    expect((await seenOf(page)).watchOff).toBeUndefined();
    await context.close();
  });

  test("anonymous users get no tours (unchanged)", async ({ browser }) => {
    const app = await openApp(browser, { signedIn: false, tours: true });
    await stubHealth(app.page, { health: { data: WEEK_DATA } });
    await goWatch(app.page);
    await app.page.waitForTimeout(3500);
    await expect(app.page.locator("#tour")).toHaveCount(0);
    await app.context.close();
  });
});
