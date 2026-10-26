const { test, expect } = require("@playwright/test");
const { openApp, tickSets, TODAY, YESTERDAY, DAY_ID, EX_IDS } = require("./helpers");

test.setTimeout(60000);
const T = { timeout: 8000 };
const chk = (page, ex, i) => page.locator(`.set-chk[data-set-ex="${ex}"][data-set="${i}"]`);
const posts = (server) => server.log.filter((e) => e.method === "POST" && e.path === "/workouts/complete");
const partial = (n) => ({ [YESTERDAY + "_" + DAY_ID]: Object.fromEntries(EX_IDS.slice(0, n).map((id) => [id, true])) });
// A signed-out (anonymous) user trains the one-day preview plan.
const PV = "preview";
const pvChecks = { [YESTERDAY + "_" + PV]: { pv_legpress: true, pv_dbbench: true, pv_cablerow: true } };
const sheet = (page) => page.locator("#saveYdaySheet");

test.describe("verify strict switch: off", () => {
  const off = { signedIn: true, server: { verifyStrict: false } };

  test("fast ticks are accepted and still recorded as evidence", async ({ browser }) => {
    const { context, page } = await openApp(browser, off);
    await expect(chk(page, "mua_bench", 0)).toBeVisible(T);
    await chk(page, "mua_bench", 0).click();
    await page.clock.fastForward(5000);
    await chk(page, "mua_bench", 1).click();
    await expect(chk(page, "mua_bench", 1)).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#gymToast")).toHaveCount(0);
    const ticks = await page.evaluate(() => GymVerify.evidence(GymDate.key(), "m_upper", "live").sets.filter((s) => s.at));
    expect(ticks).toHaveLength(2);
    const timer = await page.evaluate(() => JSON.parse(localStorage.getItem("gym_session_active")));
    expect(timer.running).toBe(true); // the workout timer still starts on the first tick
    await context.close();
  });

  test("big checkbox completes the exercise", async ({ browser }) => {
    const { context, page } = await openApp(browser, off);
    const card = page.locator("#exList .ex-card").first();
    await card.locator(".check").click();
    await expect(card).toHaveClass(/done/, T);
    expect(await card.locator(".set-chk.on").count()).toBe(await card.locator(".set-chk").count());
    await card.locator(".check").click();
    await expect(card).not.toHaveClass(/done/, T);
    await context.close();
  });

  test("finishing a day with fast ticks counts it, with evidence in the request", async ({ browser }) => {
    const { context, page, server } = await openApp(browser, off);
    for (const id of EX_IDS) await page.locator(`.check[data-id="${id}"]`).click();
    await expect.poll(() => posts(server).length, T).toBe(1);
    const body = posts(server)[0].body;
    expect(body.evidence).toMatchObject({ v: 1, kind: "live", plan: "gym" });
    expect(body.evidence.sets.every((s) => typeof s.at === "string")).toBe(true);
    expect(await page.evaluate(([d, id]) => GymVerify.localState(d, id), [TODAY, DAY_ID])).toBe("verified");
    await expect(page.locator(`.cal-day-cell[data-date="${TODAY}"]`)).toHaveClass(/complete/, T);
    await expect(page.locator(`.cal-day-cell[data-date="${TODAY}"]`)).not.toHaveClass(/held/);
    await context.close();
  });

  test("save yesterday counts with no review wording", async ({ browser }) => {
    const { context, page, server } = await openApp(browser, { ...off, checks: partial(3) });
    await page.evaluate(() => window.GymRest.maybePrompt());
    await expect(sheet(page)).toBeVisible(T);
    await expect(sheet(page)).not.toContainText(/review/i);
    await sheet(page).locator(".syd-yes").click();
    await expect(sheet(page)).toHaveCount(0, T);
    await expect(page.locator("#gymToast")).not.toContainText(/review/i);
    const p = posts(server);
    expect(p).toHaveLength(1);
    expect(p[0].body.evidence).toMatchObject({ kind: "save_yesterday", plan: "gym" });
    expect(await page.evaluate(([d, id]) => GymVerify.localState(d, id), [YESTERDAY, DAY_ID])).toBe("verified");
    await expect(page.locator(`.cal-day-cell[data-date="${YESTERDAY}"]`)).toHaveClass(/complete/, T);
    await expect(page.locator(`.cal-day-cell[data-date="${YESTERDAY}"]`)).not.toHaveClass(/held|pending/);
    await context.close();
  });

  test("save yesterday signed out counts as a normal trained day", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: false, server: { verifyStrict: false }, checks: pvChecks });
    await page.evaluate(() => window.GymRest.maybePrompt());
    await expect(sheet(page)).toBeVisible(T);
    await sheet(page).locator(".syd-yes").click();
    await expect(sheet(page)).toHaveCount(0, T);
    expect(await page.evaluate(([d, id]) => GymVerify.localState(d, id), [YESTERDAY, PV])).toBe("verified");
    await expect(page.locator(`.cal-day-cell[data-date="${YESTERDAY}"]`)).toHaveClass(/complete/, T);
    await expect(page.locator(`.cal-day-cell[data-date="${YESTERDAY}"]`)).not.toHaveClass(/held|pending/);
    await context.close();
  });

  test("a locally counted yesterday does not prompt again", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: false, server: { verifyStrict: false }, checks: pvChecks, ls: { gymday_verify: { [YESTERDAY + "_" + PV]: { start: 0, last: 0, ticks: {}, state: "verified" } } } });
    await page.evaluate(() => window.GymRest.maybePrompt());
    await expect(sheet(page)).toHaveCount(0);
    await context.close();
  });

  test("untick then re-tick with the big checkbox posts the completion once", async ({ browser }) => {
    const { context, page, server } = await openApp(browser, off);
    for (const id of EX_IDS) await page.locator(`.check[data-id="${id}"]`).click();
    await expect.poll(() => posts(server).length, T).toBe(1);
    const first = page.locator(`.check[data-id="${EX_IDS[0]}"]`);
    await first.click();
    await expect(first).not.toHaveClass(/on/, T);
    await first.click();
    await expect(first).toHaveClass(/on/, T);
    await page.clock.fastForward(3000);
    expect(posts(server)).toHaveLength(1);
    await context.close();
  });

  test("a leftover local held state is not shown as held", async ({ browser }) => {
    const { context, page } = await openApp(browser, { ...off, ls: { gymday_verify: { [TODAY + "_" + DAY_ID]: { start: 0, last: 0, ticks: {}, state: "pending" } } }, checks: { [TODAY + "_" + DAY_ID]: Object.fromEntries(EX_IDS.map((id) => [id, true])) } });
    await expect(page.locator(`.cal-day-cell[data-date="${TODAY}"]`)).not.toHaveClass(/held/, T);
    await context.close();
  });

  test("a failed app-config fetch with no cache defaults to off", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, server: { appConfigFail: true } });
    expect(await page.evaluate(() => GymAppConfig.strict())).toBe(false);
    await chk(page, "mua_bench", 0).click();
    await page.clock.fastForward(1000);
    await chk(page, "mua_bench", 1).click();
    await expect(chk(page, "mua_bench", 1)).toHaveAttribute("aria-checked", "true");
    await context.close();
  });

  test("a failed fetch keeps the cached value", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, server: { appConfigFail: true }, ls: { gym_app_config: { verifyStrict: true, minAppVersion: "1.2.0" } } });
    expect(await page.evaluate(() => [GymAppConfig.strict(), GymAppConfig.minAppVersion(), GymAppConfig.latestAppVersion()])).toEqual([true, "1.2.0", ""]);
    await context.close();
  });
});

test.describe("verify strict switch: on", () => {
  const on = { signedIn: true, server: { verifyStrict: true } };

  test("tick 59s after the previous is still refused", async ({ browser }) => {
    const { context, page } = await openApp(browser, on);
    expect(await page.evaluate(() => GymAppConfig.strict())).toBe(true);
    await chk(page, "mua_bench", 0).click();
    await page.clock.fastForward(59000);
    await chk(page, "mua_bench", 1).click();
    await expect(chk(page, "mua_bench", 1)).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("#gymToast")).toContainText(/Wait \d+s before ticking the next set/, T);
    await context.close();
  });

  test("big checkbox still only explains", async ({ browser }) => {
    const { context, page } = await openApp(browser, on);
    const card = page.locator("#exList .ex-card").first();
    await card.locator(".check").click();
    await expect(page.locator("#gymToast")).toContainText("Tick each set as you finish it", T);
    await expect(card).not.toHaveClass(/done/);
    await context.close();
  });

  test("save yesterday still goes to review", async ({ browser }) => {
    const { context, page } = await openApp(browser, { ...on, checks: partial(3) });
    await page.evaluate(() => window.GymRest.maybePrompt());
    await expect(sheet(page).locator(".syd-yes")).toHaveText("Send for review", T);
    await sheet(page).locator(".syd-yes").click();
    await expect(page.locator("#gymToast")).toContainText("Sent for review", T);
    expect(await page.evaluate(([d, id]) => GymVerify.localState(d, id), [YESTERDAY, DAY_ID])).toBe("pending");
    await context.close();
  });
});
