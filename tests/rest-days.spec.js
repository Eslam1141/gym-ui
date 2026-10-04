const { test, expect } = require("@playwright/test");
const { openApp, TODAY, YESTERDAY, DAY_ID, EX_IDS } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };
const partial = (n) => ({ [YESTERDAY + "_" + DAY_ID]: Object.fromEntries(EX_IDS.slice(0, n).map((id) => [id, true])) });
const sheet = (page) => page.locator("#saveYdaySheet");
const posts = (server, path) => server.log.filter((r) => r.method === "POST" && r.path === path);

// Asks explicitly instead of waiting for the 2.5s startup timer.
async function settle(page) {
  await page.evaluate(() => window.GymRest.maybePrompt());
}

test.describe("rest days (signed in)", () => {
  test("mark and undo a rest day", async ({ browser }) => {
    const { context, page, server, consoleErrors } = await openApp(browser, { signedIn: true });
    const card = page.locator(".rest-card");
    await expect(card.locator(".rest-card-left")).toContainText("2 of 2 rest days left", T);
    await card.getByRole("button", { name: "Take a rest day" }).click();
    await expect(page.locator(".cal-day-cell.rest.today")).toHaveCount(1, T);
    await expect(card).toHaveClass(/is-rest/);
    await expect(card.locator(".rest-card-state")).toContainText("rest day, streak kept");
    expect(posts(server, "/workouts/rest")[0].body).toEqual({ date: TODAY });

    await card.getByRole("button", { name: "Undo rest day" }).click();
    await expect(page.locator(".cal-day-cell.rest")).toHaveCount(0, T);
    await expect(card).not.toHaveClass(/is-rest/);
    expect(server.log.some((r) => r.method === "DELETE" && r.path === "/workouts/rest/" + TODAY)).toBe(true);
    expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
    await context.close();
  });

  test("rest_day_limit shows a message and leaves the day unmarked", async ({ browser }) => {
    // The client thinks one is left; the server (another device used it) refuses.
    const { context, page, server } = await openApp(browser, { signedIn: true, server: { left: 1, forceLimit: true } });
    const card = page.locator(".rest-card");
    await card.getByRole("button", { name: "Take a rest day" }).click();
    await expect(page.locator("#gymToast")).toContainText("used both rest days", T);
    await expect(page.locator(".cal-day-cell.rest")).toHaveCount(0);
    expect(posts(server, "/workouts/rest")).toHaveLength(1);
    // With none left the button is disabled up front.
    server.left = 0;
    await page.evaluate(() => GymCalendar.reload());
    await expect(card.locator(".rest-card-left")).toContainText("0 of 2 rest days left", T);
    await expect(card.getByRole("button", { name: "Take a rest day" })).toBeDisabled();
    await context.close();
  });

  test("save-yesterday: no prompt without partial checks", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await settle(page);
    await expect(sheet(page)).toHaveCount(0);
    await context.close();
  });

  test("save-yesterday: no prompt when yesterday is fully checked", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, checks: partial(EX_IDS.length) });
    await settle(page);
    await expect(sheet(page)).toHaveCount(0);
    await context.close();
  });

  test("save-yesterday: Yes posts {date, dayId, today} and marks the day", async ({ browser }) => {
    const { context, page, server } = await openApp(browser, { signedIn: true, checks: partial(3) });
    await settle(page);
    await expect(sheet(page)).toBeVisible(T);
    await expect(sheet(page).locator(".syd-body")).toContainText("3 of 8");
    await sheet(page).locator(".syd-yes").click();
    await expect(sheet(page)).toHaveCount(0, T);
    const p = posts(server, "/workouts/complete");
    expect(p).toHaveLength(1);
    expect(p[0].body).toEqual({ date: YESTERDAY, dayId: DAY_ID, today: TODAY });
    const done = await page.evaluate(([k, ids]) => {
      const c = JSON.parse(localStorage.getItem("gym_checks"))[k];
      return ids.every((i) => c[i]);
    }, [YESTERDAY + "_" + DAY_ID, EX_IDS]);
    expect(done).toBe(true);
    await context.close();
  });

  test("save-yesterday: No never asks again", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, checks: partial(2) });
    await settle(page);
    await expect(sheet(page)).toBeVisible(T);
    await sheet(page).locator(".syd-no").click();
    await expect(sheet(page)).toHaveCount(0);
    await page.evaluate(() => window.GymRest.maybePrompt());
    await expect(sheet(page)).toHaveCount(0);
    await page.reload();
    await page.waitForFunction(() => window.GymRest, null, T);
    await settle(page);
    await expect(sheet(page)).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gymrest_syd_dismissed")))).toEqual([YESTERDAY]);
    await context.close();
  });

  test("queued completion rejected with date_out_of_window is dropped", async ({ browser }) => {
    const { context, page, server } = await openApp(browser, {
      signedIn: true,
      server: { completeStatus: 400, completeError: "date_out_of_window" },
      ls: { gymrest_pending: [{ date: "2026-09-28", dayId: DAY_ID }] }
    });
    await page.evaluate(() => window.GymRest.flushQueue());
    await expect.poll(() => page.evaluate(() => localStorage.getItem("gymrest_pending")), T).toBe("[]");
    expect(posts(server, "/workouts/complete")[0].body).toEqual({ date: "2026-09-28", dayId: DAY_ID, today: TODAY });
    const n = posts(server, "/workouts/complete").length;
    await page.evaluate(() => window.GymRest.flushQueue());
    expect(posts(server, "/workouts/complete")).toHaveLength(n); // not retried
    await context.close();
  });

  test("a 5xx keeps the item queued", async ({ browser }) => {
    const { context, page } = await openApp(browser, {
      signedIn: true,
      server: { completeStatus: 503, completeError: "unavailable" },
      ls: { gymrest_pending: [{ date: YESTERDAY, dayId: DAY_ID }] }
    });
    await page.evaluate(() => window.GymRest.flushQueue());
    const q = await page.evaluate(() => JSON.parse(localStorage.getItem("gymrest_pending")));
    expect(q).toEqual([{ date: YESTERDAY, dayId: DAY_ID }]);
    await context.close();
  });

  test("streak badge stays visible, dimmed, until today is trained", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    const badge = page.locator("#tbStreak");
    await expect(badge).toBeVisible(T);
    await expect(badge).toHaveClass(/is-pending/);
    await expect(badge).toHaveAttribute("aria-label", /today not trained yet/);
    await context.close();
  });
});

test.describe("rest days (signed out)", () => {
  test("local rest day: mark, then the month panel offers undo", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: false });
    const card = page.locator(".rest-card");
    await card.getByRole("button", { name: "Take a rest day" }).click();
    await expect(page.locator(".cal-day-cell.rest.today")).toHaveCount(1, T);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gymrest_days")))).toEqual([TODAY]);

    await page.locator("#calExpandBtn").click();
    await page.locator('.cal-grid-cell[data-date="' + YESTERDAY + '"]').click();
    await expect(page.locator(".rest-detail .rest-btn")).toHaveText("Mark as rest day", T);
    await page.locator('.cal-grid-cell[data-date="' + TODAY + '"]').click();
    await expect(page.locator(".rest-detail .rest-btn")).toHaveText("Undo rest day", T);
    // tomorrow can't be changed
    await page.locator('.cal-grid-cell[data-date="2026-10-03"]').click();
    await expect(page.locator(".rest-detail .rest-btn")).toHaveCount(0);
    await context.close();
  });
});
