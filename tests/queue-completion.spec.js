const { test, expect } = require("@playwright/test");
const { openApp, TODAY, YESTERDAY, DAY_ID, EX_IDS } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };
const full = (date) => ({ [date + "_" + DAY_ID]: Object.fromEntries(EX_IDS.map((id) => [id, true])) });
const posts = (server) => server.log.filter((r) => r.method === "POST" && r.path === "/workouts/complete");
const queueOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("gymrest_pending") || "[]"));
const complete = (page, date) => page.evaluate(([d, day]) => window.GymCalendar.onCheckChanged(day, d), [date, DAY_ID]);

// A gym-be style JWT for `sub`, valid for 10h on the page's (fake) clock.
function signIn(page, sub) {
  return page.evaluate((s) => {
    const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    const tok = b64({ alg: "none" }) + "." + b64({ sub: s, email: "t@example.com", exp: Math.floor(Date.now() / 1000) + 36000 }) + ".x";
    return window.GymSync.signInWithToken(tok);
  }, sub);
}

// The toast is on screen AND nothing (onboarding, loader) is painted over it.
async function toastVisible(page, text) {
  const toast = page.locator("#gymToast");
  await expect(toast).toContainText(text, T);
  await expect.poll(() => page.evaluate(() => {
    const el = document.getElementById("gymToast");
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return Number(getComputedStyle(el).opacity) > 0.9 && !!hit && el.contains(hit);
  }), T).toBe(true);
}

test.describe("completion while the session lapsed", () => {
  test("queued without a network call, sent the moment sign-in lands, cell turns green", async ({ browser }) => {
    const { context, page, server } = await openApp(browser, { sub: "sub1", checks: full(TODAY) });
    await complete(page, TODAY);
    expect(await queueOf(page)).toEqual([{ date: TODAY, dayId: DAY_ID }]);
    expect(posts(server)).toHaveLength(0);
    // Not green until the server confirms: shown as syncing.
    await page.evaluate(() => GymCalendar.reload());
    await expect(page.locator("#calendarStrip .cal-day-cell.today")).toHaveClass(/pending/, T);
    await expect(page.locator("#calendarStrip .cal-day-cell.today")).not.toHaveClass(/complete/);

    expect(await signIn(page, "sub1")).toBe(true);
    await expect.poll(() => posts(server).length, { timeout: 3000 }).toBe(1);
    expect(posts(server)[0].body).toEqual({ date: TODAY, dayId: DAY_ID, today: TODAY });
    await expect.poll(() => queueOf(page), T).toEqual([]);
    await expect(page.locator("#calendarStrip .cal-day-cell.today")).toHaveClass(/complete/, T);
    await context.close();
  });

  test("a 401 on the POST keeps it queued; a fresh token retries at once", async ({ browser }) => {
    const { context, page, server } = await openApp(browser, {
      signedIn: true, sub: "sub1", checks: full(TODAY),
      server: { completeStatus: 401, completeError: "unauthorized" }
    });
    await complete(page, TODAY);
    await expect.poll(() => posts(server).length, T).toBe(1);
    await expect.poll(() => queueOf(page), T).toEqual([{ date: TODAY, dayId: DAY_ID }]);
    await expect(page.locator("#gymToast.show")).toHaveCount(0); // queued, not "rejected"

    server.completeStatus = 200;
    expect(await signIn(page, "sub1")).toBe(true);
    await expect.poll(() => posts(server).length, { timeout: 3000 }).toBe(2);
    await expect.poll(() => queueOf(page), T).toEqual([]);
    expect(server.records).toEqual([{ date: TODAY, dayId: DAY_ID }]);
    await context.close();
  });

  test("opening on the next day while signed out asks to sign in to save yesterday's workout", async ({ browser }) => {
    const { context, page, server } = await openApp(browser, {
      sub: "sub1", checks: full(YESTERDAY),
      ls: { gymrest_pending: [{ date: YESTERDAY, dayId: DAY_ID }] }
    });
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await toastVisible(page, "Sign in to save yesterday's workout");
    expect(posts(server)).toHaveLength(0);
    await context.close();
  });

  test("the next-day prompt is Egyptian Arabic in AR", async ({ browser }) => {
    const { context, page } = await openApp(browser, {
      sub: "sub1", lang: "ar", checks: full(YESTERDAY),
      ls: { gymrest_pending: [{ date: YESTERDAY, dayId: DAY_ID }] }
    });
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(page.locator("#gymToast")).toContainText("سجّل دخولك", T);
    await context.close();
  });

  test("an out-of-window rejection on flush shows the toast on screen", async ({ browser }) => {
    const { context, page } = await openApp(browser, {
      signedIn: true, sub: "sub1",
      server: { completeStatus: 400, completeError: "date_out_of_window" },
      ls: { gymrest_pending: [{ date: "2026-09-28", dayId: DAY_ID }] }
    });
    await page.evaluate(() => window.GymRest.flushQueue());
    await toastVisible(page, "wasn't saved");
    expect(await queueOf(page)).toEqual([]);
    await context.close();
  });

  test("anon preview never enqueues", async ({ browser }) => {
    const { context, page, server } = await openApp(browser, { checks: full(TODAY) });
    await complete(page, TODAY);
    expect(await page.evaluate(() => localStorage.getItem("gymrest_pending"))).toBeNull();
    expect(posts(server)).toHaveLength(0);
    await context.close();
  });

  test("an anon choice made after a lapse never enqueues either", async ({ browser }) => {
    const { context, page } = await openApp(browser, { checks: full(TODAY), ls: {} });
    await page.evaluate(() => localStorage.setItem("gym_user_sub", "sub1")); // sub kept, gym_anon=1
    await complete(page, TODAY);
    expect(await page.evaluate(() => localStorage.getItem("gymrest_pending"))).toBeNull();
    await context.close();
  });
});
