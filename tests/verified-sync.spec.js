const { test, expect } = require("@playwright/test");
const { openApp, tickSets, verifiedSeed, TODAY, YESTERDAY, DAY_ID, EX_IDS } = require("./helpers");

test.setTimeout(60000);
const T = { timeout: 8000 };
const LAST = EX_IDS[EX_IDS.length - 1];
const allButLast = () => ({ [TODAY + "_" + DAY_ID]: Object.fromEntries(EX_IDS.slice(0, -1).map((id) => [id, true])) });
const posts = (server) => server.log.filter((e) => e.method === "POST" && e.path === "/workouts/complete");
const chk = (page, ex, i) => page.locator(`.set-chk[data-set-ex="${ex}"][data-set="${i}"]`);
const cell = (page, date) => page.locator(`.cal-day-cell[data-date="${date}"]`);

// A signed-in day that is one exercise short, with the other exercises' ticks already on the device.
function nearlyDone(over, seedOpts) {
  return Object.assign({ signedIn: true, checks: allButLast(), ls: verifiedSeed([LAST], seedOpts), server: { streak: 1, todayDone: false } }, over || {});
}

test.describe("completion evidence and review states", () => {
  test("completion posts evidence", async ({ browser }) => {
    const { context, page, server } = await openApp(browser, nearlyDone());
    await tickSets(page, LAST);
    await expect.poll(() => posts(server).length, T).toBe(1);
    const body = posts(server)[0].body;
    expect(body).toMatchObject({ date: TODAY, dayId: DAY_ID });
    expect(body.evidence).toMatchObject({ v: 1, kind: "live", plan: "gym" });
    expect(body.evidence.sets).toHaveLength(21);
    expect(body.evidence.sets.every((s) => typeof s.at === "string")).toBe(true);
    expect(typeof body.evidence.timerStart).toBe("string");
    await context.close();
  });

  test("flagged response shows held cell and held status", async ({ browser }) => {
    const { context, page } = await openApp(browser, nearlyDone({ server: { streak: 1, todayDone: false, nextState: "flagged" } }));
    await tickSets(page, LAST);
    await expect(cell(page, TODAY)).toHaveClass(/held/, T);
    await expect(cell(page, TODAY)).not.toHaveClass(/complete/);
    await expect(page.locator(".rest-card-state")).toHaveText("Done · awaiting review", T);
    await expect(page.locator(".rest-card .rest-btn")).toHaveCount(0);
    await cell(page, TODAY).click();
    await expect(page.locator(".cal-detail-status.held")).toHaveText("Done · awaiting review", T);
    await context.close();
  });

  test("rejected record shows not counted", async ({ browser }) => {
    const { context, page } = await openApp(browser, {
      signedIn: true,
      server: { streak: 0, todayDone: false, records: [{ date: YESTERDAY, dayId: DAY_ID, state: "rejected" }] }
    });
    await expect(cell(page, YESTERDAY)).toHaveClass(/rejected/, T);
    await expect(cell(page, YESTERDAY)).not.toHaveClass(/complete/);
    await cell(page, YESTERDAY).click();
    await expect(page.locator(".cal-detail-status.rejected")).toHaveText("Not counted", T);
    await expect(page.locator(".rest-detail .rest-btn")).toHaveCount(0);
    await context.close();
  });

  test("queued item without evidence still posts", async ({ browser }) => {
    const { context, server } = await openApp(browser, {
      signedIn: true, ls: { gymrest_pending: [{ date: YESTERDAY, dayId: DAY_ID }] }
    });
    await expect.poll(() => posts(server).length, T).toBe(1);
    expect(posts(server)[0].body).toMatchObject({ date: YESTERDAY, dayId: DAY_ID });
    expect(posts(server)[0].body.evidence).toBeUndefined();
    await context.close();
  });

  test("short day celebrates with held copy", async ({ browser }) => {
    // 18 sets a minute apart from 18 min ago: gaps are fine, the day is under the 50 min gym minimum
    const { context, page } = await openApp(browser, nearlyDone({}, { startAgoMin: 18, stepMs: 61000 }));
    await tickSets(page, LAST);
    await expect(page.locator(".celebrate-card")).toHaveClass(/show/, T);
    await expect(page.locator(".celebrate-card")).toContainText("Done! This day counts once it's reviewed.");
    await expect(page.locator(".celebrate-card")).not.toContainText(/streak|in a row/i);
    await context.close();
  });

  test("crossing midnight leaves yesterday for save-yesterday", async ({ browser }) => {
    const { context, page, server } = await openApp(browser, { signedIn: true });
    await page.clock.setSystemTime(new Date("2026-10-02T20:58:00Z")); // 23:58 in Cairo
    await expect(chk(page, "mua_bench", 0)).toBeVisible(T);
    await chk(page, "mua_bench", 0).click();
    await page.clock.fastForward(61000); // 23:59
    await chk(page, "mua_bench", 1).click();
    await page.clock.fastForward(3 * 60000); // 00:02 on the next day
    await page.evaluate(() => GymRest.maybePrompt());
    const sheet = page.locator("#saveYdaySheet");
    await expect(sheet).toBeVisible(T);
    await expect(sheet.locator(".syd-body")).toContainText("of 6");
    await sheet.locator(".syd-yes").click();
    await expect.poll(() => posts(server).length, T).toBe(1);
    const body = posts(server)[0].body;
    expect(body).toMatchObject({ date: TODAY, dayId: DAY_ID, evidence: { kind: "save_yesterday" } });
    expect(body.evidence.sets.filter((s) => s.at)).toHaveLength(2);
    await context.close();
  });

  test("a verified day keeps the streak copy", async ({ browser }) => {
    const { context, page } = await openApp(browser, nearlyDone());
    await tickSets(page, LAST);
    await expect(page.locator(".celebrate-card")).toContainText("Two days in a row", T);
    await context.close();
  });
});
