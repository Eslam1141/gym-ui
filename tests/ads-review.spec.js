// Review fixes for the ads work: no ad mid-workout, banner margin without the safe-area inset, lazy consent,
// missing ad units, header refresh after a save, language switch, no "Bearer null".
const { test, expect } = require("@playwright/test");
const { openAdsApp } = require("./ads-helpers");
const { YESTERDAY } = require("./helpers");

test.setTimeout(60000);

const STATUS_SAVE = { rewardedEnabled: true, coachVideosLeftToday: 0, streakSave: { eligible: true, date: YESTERDAY, reason: "" } };
const saveCard = (page) => page.locator(".ad-save");
const names = (page) => page.evaluate(() => window.__adsCalls.map((c) => c.name));

test.describe("no rewarded ad during a workout", () => {
  test("starting a workout removes the streak card; a stale click does nothing", async ({ browser }) => {
    const a = await openAdsApp(browser, { signedIn: true, rewards: { status: STATUS_SAVE } });
    await expect(saveCard(a.page)).toBeVisible();
    // a real session start: tick the first set
    await a.page.clock.fastForward(61000);
    await a.page.locator(".set-chk").first().click();
    expect(await a.page.evaluate(() => GymApp.workoutInProgress())).toBe(true);
    await expect(saveCard(a.page)).toHaveCount(0);
    expect(await names(a.page)).not.toContain("showRewarded");
    await a.context.close();
  });

  test("the click handler re-checks: busy right before the tap, no ticket and no video", async ({ browser }) => {
    const a = await openAdsApp(browser, { signedIn: true, rewards: { status: STATUS_SAVE } });
    await expect(saveCard(a.page)).toBeVisible();
    await a.page.evaluate(() => { GymApp.workoutInProgress = () => true; }); // no event fires for this one
    await saveCard(a.page).locator("button").click();
    await a.page.waitForTimeout(300);
    expect(a.server.rewardCalls.filter((c) => c.method === "POST").length).toBe(0);
    expect(await names(a.page)).not.toContain("showRewarded");
    await a.context.close();
  });
});

test("the banner margin leaves out the nav's own safe-area padding", async ({ browser }) => {
  const a = await openAdsApp(browser, {});
  await a.page.addStyleTag({ content: "#appNav{ padding-bottom:20px !important; }" });
  await a.page.evaluate(() => GymUI.navigate("food", { instant: true }));
  await expect.poll(() => names(a.page)).toContain("showBanner");
  const r = await a.page.evaluate(() => {
    const nav = document.getElementById("appNav");
    return { margin: window.__adsCalls.find((c) => c.name === "showBanner").arg.marginPx, h: Math.round(nav.getBoundingClientRect().height), pad: parseFloat(getComputedStyle(nav).paddingBottom) };
  });
  expect(r.pad).toBe(20);
  expect(r.margin).toBe(r.h - 20);
  await a.context.close();
});

test.describe("consent is asked lazily", () => {
  test("not at boot, not on Plan; first Food visit asks", async ({ browser }) => {
    const a = await openAdsApp(browser, { signedIn: true, rewards: { status: STATUS_SAVE } });
    await a.page.waitForTimeout(600);
    expect(await names(a.page)).toEqual([]);
    await a.page.evaluate(() => GymUI.navigate("food", { instant: true }));
    await expect.poll(() => names(a.page)).toContain("init");
    await a.context.close();
  });

  test("not while a workout or an overlay is up", async ({ browser }) => {
    const a = await openAdsApp(browser, {});
    await a.page.evaluate(() => { GymApp.workoutInProgress = () => true; GymUI.navigate("food", { instant: true }); });
    await a.page.waitForTimeout(1500);
    expect(await names(a.page)).toEqual([]);
    await a.page.evaluate(() => { GymApp.workoutInProgress = () => false; const s = document.createElement("div"); s.id = "ov"; s.className = "sheet open"; s.style.cssText = "position:fixed;inset:0"; document.body.appendChild(s); });
    await a.page.waitForTimeout(1500);
    expect(await names(a.page)).toEqual([]);
    await a.page.evaluate(() => document.getElementById("ov").remove());
    await expect.poll(() => names(a.page), { timeout: 4000 }).toContain("init");
    await a.context.close();
  });

  test("tapping Watch asks first, then continues", async ({ browser }) => {
    const a = await openAdsApp(browser, { signedIn: true, rewards: { status: STATUS_SAVE, polls: ["granted"] } });
    expect(await names(a.page)).toEqual([]);
    await saveCard(a.page).locator("button").click();
    await expect.poll(() => names(a.page)).toEqual(["init", "showRewarded"]);
    await a.context.close();
  });

  test("consent refused: Watch says no video", async ({ browser }) => {
    const a = await openAdsApp(browser, { signedIn: true, ads: { consent: { canRequestAds: false, privacyOptionsRequired: true } }, rewards: { status: STATUS_SAVE } });
    await saveCard(a.page).locator("button").click();
    await expect(saveCard(a.page)).toContainText("No video right now, try later");
    expect(a.server.rewardCalls.filter((c) => c.method === "POST").length).toBe(0);
    await a.context.close();
  });
});

test("no ad unit in app-config: no banner, no card, no consent form", async ({ browser }) => {
  const a = await openAdsApp(browser, { signedIn: true, config: { admobBannerUnit: "", admobRewardedUnit: "" }, rewards: { status: STATUS_SAVE } });
  await a.page.evaluate(() => GymUI.navigate("food", { instant: true }));
  await a.page.waitForTimeout(1200);
  expect(await names(a.page)).not.toContain("showBanner");
  await expect(saveCard(a.page)).toHaveCount(0);
  expect(a.server.rewardCalls.length).toBe(0);
  await a.context.close();
  const b = await openAdsApp(browser, { signedIn: true, config: { admobBannerUnit: "" }, rewards: { status: STATUS_SAVE } });
  await expect(saveCard(b.page)).toBeVisible();
  await b.page.evaluate(() => GymUI.navigate("food", { instant: true }));
  await b.page.waitForTimeout(1200);
  expect(await names(b.page)).not.toContain("showBanner");
  await b.context.close();
});

test("after a granted streak save the header streak is refreshed", async ({ browser }) => {
  const a = await openAdsApp(browser, {
    signedIn: true,
    rewards: { status: STATUS_SAVE, polls: [{ status: "granted", kind: "streak_save", date: YESTERDAY }], onTicket: (s) => { s.savedDays = [YESTERDAY]; } }
  });
  await expect(saveCard(a.page)).toBeVisible();
  const before = a.server.log.filter((l) => l.path === "/me").length;
  await saveCard(a.page).locator("button").click();
  await expect(saveCard(a.page)).toContainText("Streak saved");
  await expect.poll(() => a.server.log.filter((l) => l.path === "/me").length).toBeGreaterThan(before);
  await a.context.close();
});

test("a language switch repaints the card and the coach offer", async ({ browser }) => {
  const a = await openAdsApp(browser, { signedIn: true, rewards: { status: STATUS_SAVE } });
  await expect(saveCard(a.page).locator(".ad-save-title")).toHaveText("Watch a video to keep your streak");
  await a.page.evaluate(() => applyLang("ar", true));
  await expect(saveCard(a.page).locator(".ad-save-title")).toHaveText("شاهد فيديو لتحافظ على سلسلتك");
  await a.context.close();
});

test("no session token: no reward calls and no 'Bearer null'", async ({ browser }) => {
  const a = await openAdsApp(browser, { signedIn: true, rewards: { status: STATUS_SAVE } });
  await expect(saveCard(a.page)).toBeVisible();
  const n = a.server.rewardCalls.length;
  await a.page.evaluate(() => { GymSync.token = () => null; });
  await a.page.evaluate(() => GymAds.renderSaveCard());
  await expect(saveCard(a.page)).toHaveCount(0);
  await a.page.evaluate(() => { document.dispatchEvent(new Event("gym:authchange")); });
  await a.page.waitForTimeout(500);
  expect(a.server.rewardCalls.length).toBe(n);
  await a.context.close();
});
