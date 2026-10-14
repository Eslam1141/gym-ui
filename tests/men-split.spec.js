const { test, expect } = require("@playwright/test");
const { openApp, TODAY, YESTERDAY } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };
const EN_WEEK = ["Upper", "Lower", "Rest", "Back + Biceps + Calves", "Chest + Triceps", "Rest", "Rest"];
const AR_WEEK = ["علوي", "سفلي", "راحة", "ظهر + بايسبس + سمانة", "صدر + ترايسبس", "راحة", "راحة"];
const WEEK_IDS = ["m_upper", "m_lower", null, "m_backbi", "m_chesttri", null, null];

const chips = (page) => page.locator("#dayTabs .day-chip");
const chipTexts = (page) => chips(page).allTextContents();
const activeChip = (page) => page.locator("#dayTabs .day-chip.active");
const cardOf = (page, id) => page.locator('.check[data-id="' + id + '"]').locator("xpath=ancestor::div[contains(@class,'ex-card')]");

// Seed raw localStorage after the app's own seeding, then reload so boot (and the migration) sees it.
async function seedAndReload(page, entries) {
  await page.evaluate((e) => Object.keys(e).forEach((k) => localStorage.setItem(k, typeof e[k] === "string" ? e[k] : JSON.stringify(e[k]))), entries);
  await page.reload();
  await page.waitForFunction(() => window.GymRest && window.GymDate, null, { timeout: 15000 });
  await expect(page.locator("#exList .ex-card, #exList .rest-panel").first()).toBeVisible(T);
}

test.describe("men's gym 4-day split", () => {
  test("the week runs Upper, Lower, rest, Back + Biceps + Calves, Chest + Triceps, rest, rest", async ({ browser }) => {
    const { context, page, consoleErrors } = await openApp(browser, { signedIn: true });
    await expect(chips(page)).toHaveCount(7);
    expect(await chipTexts(page)).toEqual(EN_WEEK);
    const days = await page.evaluate(() => DAYS_MALE.map((d) => ({ id: d.id, ids: d.exercises.map((e) => e.id), en: d.exercises.map((e) => e.en), vids: d.exercises.map((e) => !!e.vid) })));
    expect(days.map((d) => d.id)).toEqual(["m_upper", "m_lower", "m_backbi", "m_chesttri"]);
    days.forEach((d) => {
      expect(d.ids.length).toBeGreaterThanOrEqual(6);
      expect(d.ids.length).toBeLessThanOrEqual(7);
      expect(new Set(d.ids).size).toBe(d.ids.length);
      expect(d.vids.every(Boolean)).toBe(true);
    });
    // Back-to-back training days (Back, then Chest) share no exercise.
    expect(days[2].en.filter((n) => days[3].en.includes(n))).toEqual([]);
    for (let i = 0; i < 7; i++) {
      await chips(page).nth(i).click();
      if (WEEK_IDS[i] === null) {
        await expect(page.locator(".rest-panel")).toBeVisible(T);
        await expect(page.locator(".ex-card")).toHaveCount(0);
      } else {
        await expect(page.locator(".ex-card").first()).toBeVisible(T);
        await expect(page.locator(".rest-panel")).toHaveCount(0);
        await expect(page.locator(".ex-card")).toHaveCount(days.find((d) => d.id === WEEK_IDS[i]).ids.length);
      }
    }
    expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
    await context.close();
  });

  test("a rest slot shows rest, hides the workout blocks, and taking it celebrates", async ({ browser }) => {
    const { context, page, server } = await openApp(browser, { signedIn: true });
    await chips(page).nth(2).click();
    await expect(page.locator(".rest-panel h3")).toHaveText("Rest day", T);
    await expect(page.locator(".rest-panel-body")).toContainText("Day 3 of 7");
    await expect(page.locator(".rest-panel-next")).toHaveText("Next up: Back + Biceps + Calves");
    await expect(page.locator("#sessionCard")).toBeHidden();
    await expect(page.locator(".warmup-card")).toBeHidden();
    await page.locator(".rest-panel .rest-btn").click();
    await expect(page.locator(".celebrate-card")).toHaveClass(/show/, T);
    await expect(page.locator(".celebrate-card")).toContainText("Rest is part of training");
    expect(server.log.some((r) => r.method === "POST" && r.path === "/workouts/rest" && r.body.date === TODAY)).toBe(true);
    await expect(page.locator(".rest-panel .rest-btn")).toHaveText("Undo rest day", T);
    await chips(page).nth(0).click();
    await expect(page.locator("#sessionCard")).toBeVisible(T);
    await expect(page.locator(".ex-card").first()).toBeVisible(T);
    await context.close();
  });

  test("the last rest slot points back to Upper", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await chips(page).nth(6).click();
    await expect(page.locator(".rest-panel-next")).toHaveText("Next up: Upper", T);
    await context.close();
  });

  test("kept exercise ids keep their history", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await seedAndReload(page, {
      gym_weights: {
        mua_bench: [{ date: YESTERDAY, w: 82.5, r: 6 }],
        mub_hammer: [{ date: YESTERDAY, w: 18, r: 12 }],
        ctb_dbbench: [{ date: YESTERDAY, w: 34, r: 9 }]
      }
    });
    await expect(cardOf(page, "mua_bench")).toContainText("82.5", T);
    await chips(page).nth(3).click();
    await expect(cardOf(page, "mub_hammer")).toContainText("18", T);
    await chips(page).nth(4).click();
    await expect(cardOf(page, "ctb_dbbench")).toContainText("34", T);
    await context.close();
  });

  test("mid-cycle: in-progress workout and rotation marker move to the new split", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await seedAndReload(page, {
      gym_active_day_male_gym: "m_upperA",
      gym_session_active: { dayId: "m_upperA", startedAt: Date.now(), running: true, accumSec: 0, segStart: Date.now() },
      gym_checks: { [TODAY + "_m_upperA"]: { mua_bench: true, mua_ohp: true, mua_curl: true, mua_pushdown: true } }
    });
    await expect(activeChip(page)).toHaveText("Upper", T);
    const state = await page.evaluate(() => ({
      checks: JSON.parse(localStorage.getItem("gym_checks")),
      live: JSON.parse(localStorage.getItem("gym_session_active"))
    }));
    expect(state.live.dayId).toBe("m_upper");
    expect(state.checks[TODAY + "_m_upper"]).toEqual({ mua_bench: true, mua_ohp: true });
    expect(state.checks[TODAY + "_m_chesttri"]).toEqual({ mua_pushdown: true });
    expect(state.checks[TODAY + "_m_upperA"].mua_curl).toBe(true); // no home in the new plan; stays under the old key
    await expect(page.locator('.check[data-id="mua_bench"]')).toHaveClass(/on/, T);
    await expect(page.locator('.check[data-id="mua_ohp"]')).toHaveClass(/on/);
    await expect(page.locator('.check[data-id="mua_row"]')).not.toHaveClass(/on/);
    await context.close();
  });

  test("a rotation marker left by the old plan advances to the right new day", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await seedAndReload(page, { gym_active_day_male_gym: "m_upperB", gymday_last_completed: { date: YESTERDAY, dayId: "m_lowerA" } });
    // Lower A finished yesterday -> next is the 3rd training day.
    await expect(activeChip(page)).toHaveText("Back + Biceps + Calves", T);
    expect(await page.evaluate(() => localStorage.getItem("gymday_last_completed"))).toBeNull();
    await context.close();
  });

  test("each old remembered tab lands on the same step of the rotation", async ({ browser }) => {
    const map = { m_upperA: ["Upper", "m_upper"], m_lowerA: ["Lower", "m_lower"], m_upperB: ["Back + Biceps + Calves", "m_backbi"], m_lowerB: ["Chest + Triceps", "m_chesttri"] };
    for (const [oldId, [label, newId]] of Object.entries(map)) {
      const { context, page } = await openApp(browser, { signedIn: true });
      await seedAndReload(page, { gym_active_day_male_gym: oldId });
      await expect(activeChip(page)).toHaveText(label, T);
      expect(await page.evaluate(() => localStorage.getItem("gym_active_day_male_gym"))).toBe(newId);
      await context.close();
    }
  });

  test("an unknown remembered tab falls back to the first day; migration is idempotent", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await seedAndReload(page, { gym_active_day_male_gym: "m_gone", gym_sessions: { m_upperA: [{ date: "2026-09-20", durationSec: 3000 }] } });
    await expect(activeChip(page)).toHaveText("Upper", T);
    const again = await page.evaluate(() => [GymMigrations.maleV3(), JSON.parse(localStorage.getItem("gym_sessions"))]);
    expect(again[0]).toBe(false);
    expect(again[1].m_upper).toEqual([{ date: "2026-09-20", durationSec: 3000 }]);
    await context.close();
  });

  test("corrupt stored state never breaks boot", async ({ browser }) => {
    const { context, page, consoleErrors } = await openApp(browser, { signedIn: true });
    await seedAndReload(page, { gym_checks: "[1,2]", gym_sessions: "7", gym_session_active: "null", gymday_last_completed: "{bad" });
    await expect(activeChip(page)).toHaveText("Upper", T);
    expect(consoleErrors.filter((e) => !/Failed to load resource|Unexpected token|JSON/.test(e))).toEqual([]);
    await context.close();
  });

  test("old completed days still resolve through the legacy plan", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    const r = await page.evaluate(() => ({
      b: GymApp.dayExercises("m_upperB").length, l: GymApp.dayExercises("m_lowerB").length,
      name: GymApp.dayName("m_upperA"), none: GymApp.dayExercises("nope").length
    }));
    expect(r).toEqual({ b: 8, l: 7, name: "Upper A", none: 0 });
    await context.close();
  });

  test("the women's plan is unchanged: no rest slots", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, plan: "female" });
    expect(await chipTexts(page)).toEqual(["Lower A", "Upper A", "Lower B", "Upper B"]);
    await context.close();
  });

  test("Arabic: RTL week, Arabic rest panel, no horizontal scroll at 360px", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, lang: "ar", viewport: { width: 360, height: 780 } });
    expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir])).toEqual(["ar", "rtl"]);
    expect(await chipTexts(page)).toEqual(AR_WEEK);
    await chips(page).nth(2).click();
    await expect(page.locator(".rest-panel h3")).toHaveText("يوم راحة", T);
    await expect(page.locator(".rest-panel-body")).toContainText("اليوم 3 من 7");
    await expect(page.locator(".rest-panel-next")).toHaveText("التالي: ظهر + بايسبس + سمانة");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator(".rest-panel .rest-btn").click();
    await expect(page.locator(".celebrate-card")).toHaveClass(/show/, T);
    await chips(page).nth(3).click();
    await expect(page.locator(".ex-card").first()).toBeVisible(T);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await context.close();
  });
});
