// Rewarded flows (ads plan FE-3): +3 coach messages after the chat limit, the streak-save card,
// the Privacy options row. The reward endpoints and the native bridge are mocked.
const { test, expect } = require("@playwright/test");
const { openAdsApp } = require("./ads-helpers");
const { YESTERDAY, EX_IDS, DAY_ID } = require("./helpers");

test.setTimeout(60000);

const STATUS_COACH = { rewardedEnabled: true, coachVideosLeftToday: 2, streakSave: { eligible: false, date: YESTERDAY, reason: "no_streak" } };
const STATUS_SAVE = { rewardedEnabled: true, coachVideosLeftToday: 0, streakSave: { eligible: true, date: YESTERDAY, reason: "" } };

async function openChatAt429(browser, opts) {
  const app = await openAdsApp(browser, Object.assign({ signedIn: true }, opts, {
    setup: async (context) => {
      await context.route("**/api/v1/assistant/chat", (route) => route.fulfill({ status: 429, contentType: "application/json", headers: opts.reset === null ? {} : { "X-RateLimit-Reset": opts.reset || "2026-10-03T00:00:00Z" }, body: JSON.stringify({ error: { code: "rate_limited", message: "x" } }) }));
    }
  }));
  const { page } = app;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.click('#appNav button[data-tab="more"]');
  await page.click("#coachFab");
  await expect(page.locator("#coachChat.show")).toBeVisible();
  await page.fill("#coachChatInput", "hello");
  await page.press("#coachChatInput", "Enter");
  await expect(page.locator(".coach-chat-msg.system").first()).toBeVisible();
  return app;
}
const offer = (page) => page.locator("#coachChat .ad-offer-btn");
const reqs = (server, path) => server.rewardCalls.filter((c) => c.path === path);
// The ticket poll waits on timers; the clock is fake, so move it along while real fetches settle.
const videoShown = (page) => expect.poll(() => page.evaluate(() => window.__adsCalls.some((c) => c.name === "showRewarded"))).toBe(true);
async function tick(page, n) { for (let i = 0; i < n; i++) { await page.clock.fastForward(1000); await page.waitForTimeout(40); } }

test.describe("coach video", () => {
  test("button after the 429 when videos are left; none at zero", async ({ browser }) => {
    const a = await openChatAt429(browser, { rewards: { status: STATUS_COACH } });
    await expect(offer(a.page)).toHaveText("Watch a short video for 3 more messages");
    expect(await offer(a.page).evaluate((b) => b.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await a.context.close();
    const z = await openChatAt429(browser, { rewards: { status: Object.assign({}, STATUS_COACH, { coachVideosLeftToday: 0 }) } });
    await z.page.waitForTimeout(500);
    await expect(offer(z.page)).toHaveCount(0);
    await z.context.close();
  });

  test("only the daily quota (reset at the next UTC midnight) earns the offer, not the per-minute throttle", async ({ browser }) => {
    const minute = await openChatAt429(browser, { reset: "2026-10-02T07:01:00Z", rewards: { status: STATUS_COACH } });
    await minute.page.waitForTimeout(500);
    await expect(offer(minute.page)).toHaveCount(0);
    await minute.context.close();
    const none = await openChatAt429(browser, { reset: null, rewards: { status: STATUS_COACH } });
    await none.page.waitForTimeout(500);
    await expect(offer(none.page)).toHaveCount(0);
    await none.context.close();
  });

  test("no button without the bridge or with rewarded off", async ({ browser }) => {
    const a = await openChatAt429(browser, { ads: false, rewards: { status: STATUS_COACH } });
    await a.page.waitForTimeout(500);
    await expect(offer(a.page)).toHaveCount(0);
    expect(a.server.rewardCalls.length).toBe(0);
    await a.context.close();
    const b = await openChatAt429(browser, { config: { rewardedEnabled: false }, rewards: { status: STATUS_COACH } });
    await b.page.waitForTimeout(500);
    await expect(offer(b.page)).toHaveCount(0);
    expect(b.server.rewardCalls.length).toBe(0);
    await b.context.close();
  });

  test("happy path: ticket, video with the ticket as custom data, poll, +3 messages", async ({ browser }) => {
    const a = await openChatAt429(browser, { rewards: { status: STATUS_COACH, polls: ["pending", { status: "granted", messages: 3 }] } });
    await offer(a.page).click();
    await videoShown(a.page);
    await tick(a.page, 3);
    await expect(a.page.locator("#coachChat .ad-offer")).toContainText("+3 messages");
    expect(reqs(a.server, "/rewards/ticket")[0].body).toEqual({ kind: "coach_messages" });
    const arg = await a.page.evaluate(() => window.__adsCalls.find((c) => c.name === "showRewarded").arg);
    expect(arg).toEqual({ adUnitId: "ca-app-pub-test/rewarded", customData: "tk1", userId: "u1" });
    expect(await a.page.locator("#coachChatInput").isEnabled()).toBe(true);
    await a.context.close();
  });

  test("never granted in 10 s: says it could not confirm", async ({ browser }) => {
    const a = await openChatAt429(browser, { rewards: { status: STATUS_COACH, polls: ["pending"] } });
    await offer(a.page).click();
    await videoShown(a.page);
    await tick(a.page, 14);
    await expect(a.page.locator("#coachChat .ad-offer")).toContainText("We couldn't confirm the video. Try again later.");
    expect(reqs(a.server, "/rewards/ticket/tk1").length).toBeLessThanOrEqual(11);
    await a.context.close();
  });

  test("409 and 503 say no video; so does no fill; closing the video early just re-arms the button", async ({ browser }) => {
    const lim = await openChatAt429(browser, { rewards: { status: STATUS_COACH, ticketStatus: 409, ticketBody: { error: "limit_reached", reason: "" } } });
    await offer(lim.page).click();
    await expect(lim.page.locator("#coachChat .ad-offer")).toContainText("You've watched all of today's videos. Try again tomorrow.");
    await lim.context.close();
    const off = await openChatAt429(browser, { rewards: { status: STATUS_COACH, ticketStatus: 503, ticketBody: { error: "rewards_disabled" } } });
    await offer(off.page).click();
    await expect(off.page.locator("#coachChat .ad-offer")).toContainText("No video right now, try later");
    await off.context.close();
    const nf = await openChatAt429(browser, { ads: { rewarded: { rewarded: false, reason: "no_fill" } }, rewards: { status: STATUS_COACH } });
    await offer(nf.page).click();
    await expect(nf.page.locator("#coachChat .ad-offer")).toContainText("No video right now, try later");
    expect(reqs(nf.server, "/rewards/ticket/tk1").length).toBe(0);
    await nf.context.close();
    const d = await openChatAt429(browser, { ads: { rewarded: { rewarded: false, reason: "dismissed" } }, rewards: { status: STATUS_COACH } });
    await offer(d.page).click();
    await expect(offer(d.page)).toBeEnabled();
    await expect(d.page.locator("#coachChat .ad-offer")).not.toContainText("No video");
    await d.context.close();
  });

  test("Arabic copy in RTL", async ({ browser }) => {
    const a = await openChatAt429(browser, { lang: "ar", rewards: { status: STATUS_COACH } });
    expect(await a.page.evaluate(() => document.documentElement.dir)).toBe("rtl");
    await expect(offer(a.page)).toHaveText("شاهد فيديو قصيراً لتحصل على 3 رسائل إضافية");
    await a.context.close();
  });
});

const saveCard = (page) => page.locator(".ad-save");
const partial = (n) => ({ [YESTERDAY + "_" + DAY_ID]: Object.fromEntries(EX_IDS.slice(0, n).map((id) => [id, true])) });

test.describe("streak save card", () => {
  test("shows when eligible, not when not", async ({ browser }) => {
    const a = await openAdsApp(browser, { signedIn: true, rewards: { status: STATUS_SAVE } });
    await expect(saveCard(a.page)).toBeVisible();
    await expect(saveCard(a.page).locator(".ad-save-title")).toHaveText("Watch a video to keep your streak");
    expect(await saveCard(a.page).locator("button").evaluate((b) => b.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(reqs(a.server, "/rewards/status")[0].query).toBe("?today=2026-10-02");
    await a.context.close();
    const n = await openAdsApp(browser, { signedIn: true, rewards: { status: STATUS_COACH } });
    await n.page.waitForTimeout(600);
    await expect(saveCard(n.page)).toHaveCount(0);
    await n.context.close();
    const off = await openAdsApp(browser, { signedIn: true, config: { rewardedEnabled: false }, rewards: { status: STATUS_SAVE } });
    await off.page.waitForTimeout(600);
    await expect(saveCard(off.page)).toHaveCount(0);
    expect(off.server.rewardCalls.length).toBe(0);
    await off.context.close();
  });

  test("not while the save-yesterday prompt asks about the same day; appears after No", async ({ browser }) => {
    const a = await openAdsApp(browser, { signedIn: true, checks: partial(3), rewards: { status: STATUS_SAVE } });
    await expect(a.page.locator("#saveYdaySheet")).toBeVisible({ timeout: 15000 });
    await expect(saveCard(a.page)).toHaveCount(0);
    await a.page.locator("#saveYdaySheet .syd-no").click();
    await expect(saveCard(a.page)).toBeVisible();
    await a.context.close();
  });

  test("happy path: ticket for yesterday, then Streak saved and the calendar shows the saved day", async ({ browser }) => {
    const a = await openAdsApp(browser, {
      signedIn: true,
      rewards: { status: STATUS_SAVE, polls: [{ status: "granted", kind: "streak_save", date: YESTERDAY }], onTicket: (s) => { s.savedDays = [YESTERDAY]; } }
    });
    await saveCard(a.page).locator("button").click();
    await expect(saveCard(a.page)).toContainText("Streak saved");
    expect(reqs(a.server, "/rewards/ticket")[0].body).toEqual({ kind: "streak_save", date: YESTERDAY });
    await expect(a.page.locator(`.cal-day-cell.saved[data-date="${YESTERDAY}"]`)).toHaveCount(1);
    await expect(a.page.locator(`.cal-day-cell.saved[data-date="${YESTERDAY}"] .sr-only`)).toHaveText("Saved");
    await a.context.close();
  });

  test("409 week_used says the week's save is used; other not_eligible drops the card", async ({ browser }) => {
    const a = await openAdsApp(browser, { signedIn: true, rewards: { status: STATUS_SAVE, ticketStatus: 409, ticketBody: { error: "not_eligible", reason: "week_used" } } });
    await saveCard(a.page).locator("button").click();
    await expect(saveCard(a.page)).toContainText("You've already saved a day this week.");
    await a.context.close();
    const b = await openAdsApp(browser, { signedIn: true, rewards: { status: STATUS_SAVE, ticketStatus: 409, ticketBody: { error: "not_eligible", reason: "held" } } });
    await saveCard(b.page).locator("button").click();
    await expect(saveCard(b.page)).toHaveCount(0);
    await b.context.close();
    const c = await openAdsApp(browser, { signedIn: true, rewards: { status: STATUS_SAVE, ticketStatus: 503, ticketBody: { error: "rewards_disabled" } } });
    await saveCard(c.page).locator("button").click();
    await expect(saveCard(c.page)).toContainText("No video right now, try later");
    await c.context.close();
  });

  test("Arabic copy in RTL, and a phone-width card does not overflow", async ({ browser }) => {
    const a = await openAdsApp(browser, { signedIn: true, lang: "ar", viewport: { width: 360, height: 740 }, rewards: { status: STATUS_SAVE } });
    await expect(saveCard(a.page).locator(".ad-save-title")).toHaveText("شاهد فيديو لتحافظ على سلسلتك");
    expect(await a.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await a.context.close();
  });
});

test.describe("privacy options row", () => {
  test("shown only when consent says it is required; opens the form", async ({ browser }) => {
    const a = await openAdsApp(browser, { ads: { consent: { canRequestAds: true, privacyOptionsRequired: true } } });
    await a.page.evaluate(() => GymUI.navigate("more", { instant: true }));
    await expect(a.page.locator("#moreAdPrivacy")).toBeVisible();
    await expect(a.page.locator("#moreAdPrivacy .pv-title")).toHaveText("Privacy options");
    await a.page.click("#adPrivacyBtn");
    expect(await a.page.evaluate(() => window.__adsCalls.map((c) => c.name))).toContain("showPrivacyOptions");
    await a.context.close();
    const n = await openAdsApp(browser, {});
    await n.page.evaluate(() => GymUI.navigate("more", { instant: true }));
    await expect(n.page.locator("#moreAdPrivacy")).toBeHidden();
    await n.context.close();
    const w = await openAdsApp(browser, { ads: false });
    await expect(w.page.locator("#moreAdPrivacy")).toBeHidden();
    await w.context.close();
  });
});
