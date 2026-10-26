const { test, expect } = require("@playwright/test");
const { openApp, tickSets, TODAY, DAY_ID } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };
const chk = (page, ex, i) => page.locator(`.set-chk[data-set-ex="${ex}"][data-set="${i}"]`);

test.describe("verified set ticks", () => {
  test("big checkbox explains and does not complete", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    const card = page.locator("#exList .ex-card").first();
    await card.locator(".check").click();
    await expect(page.locator("#gymToast")).toContainText("Tick each set as you finish it", T);
    await expect(card).not.toHaveClass(/done/);
    await expect(card.locator(".set-chk.on")).toHaveCount(0);
    await context.close();
  });

  test("tick 59s after previous is refused with message", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await expect(chk(page, "mua_bench", 0)).toBeVisible(T);
    await chk(page, "mua_bench", 0).click();
    await page.clock.fastForward(59000);
    await chk(page, "mua_bench", 1).click();
    await expect(chk(page, "mua_bench", 1)).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("#gymToast")).toContainText(/Wait \d+s before ticking the next set/, T);
    await page.clock.fastForward(2000);
    await chk(page, "mua_bench", 1).click();
    await expect(chk(page, "mua_bench", 1)).toHaveAttribute("aria-checked", "true");
    await context.close();
  });

  test("first tick starts workout timer", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await expect(chk(page, "mua_bench", 0)).toBeVisible(T);
    expect(await page.evaluate(() => localStorage.getItem("gym_session_active"))).toBeNull();
    await chk(page, "mua_bench", 0).click();
    const s = await page.evaluate(() => ({ session: JSON.parse(localStorage.getItem("gym_session_active")), start: GymVerify.timerStart(GymDate.key(), "m_upper") }));
    expect(s.session.dayId).toBe(DAY_ID);
    expect(s.session.running).toBe(true);
    expect(s.session.startedAt).toBe(s.start);
    await expect(page.locator("#sessionBtn")).toHaveClass(/stop/);
    await context.close();
  });

  test("a timer started before the first tick becomes the workout start", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await page.locator("#sessionBtn").click();
    const started = await page.evaluate(() => JSON.parse(localStorage.getItem("gym_session_active")).startedAt);
    await page.clock.fastForward(5 * 60000);
    await chk(page, "mua_bench", 0).click();
    expect(await page.evaluate(() => GymVerify.timerStart(GymDate.key(), "m_upper"))).toBe(started);
    await context.close();
  });

  test("restart after End keeps wall-clock", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await chk(page, "mua_bench", 0).click();
    const start = await page.evaluate(() => GymVerify.timerStart(GymDate.key(), "m_upper"));
    await page.clock.fastForward(10 * 60000);
    await page.locator("#sessionBtn").click(); // End
    expect(await page.evaluate(() => localStorage.getItem("gym_session_active"))).toBeNull();
    await page.clock.fastForward(600); // the Start/End button has a 500 ms cooldown
    await page.locator("#sessionBtn").click(); // Start again
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem("gym_session_active")));
    expect(s.startedAt).toBe(start);
    expect(s.segStart).toBe(start);
    expect(s.accumSec).toBe(0);
    await context.close();
  });

  test("timed exercise finish ticks the next set", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, plan: "female" });
    await page.evaluate(() => {
      activeDay = DAYS.find((x) => x.exercises.some((e) => timedSeconds(e.reps) > 0)).id;
      renderExercises();
    });
    const btn = page.locator("#exList [data-extimer]").first();
    await expect(btn).toBeVisible(T);
    const id = await btn.getAttribute("data-extimer");
    await btn.click();
    await page.clock.fastForward(120000);
    await expect(chk(page, id, 0)).toHaveAttribute("aria-checked", "true", T);
    await context.close();
  });
});
