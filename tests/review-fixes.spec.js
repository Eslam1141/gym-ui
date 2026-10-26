const { test, expect } = require("@playwright/test");
const { openApp, tickSets, verifiedSeed, TODAY, DAY_ID, EX_IDS } = require("./helpers");

test.setTimeout(60000);
const T = { timeout: 8000 };

test("ticking the last set of the day pops no 'already done' alert", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true, ls: verifiedSeed(["mua_facepull"]) });
  const dialogs = [];
  page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.waitForFunction(() => window.GymVerify && window.GymApp);
  // the other five exercises are ticked in the seed; mark them done the way the app would
  await page.evaluate(([d, day, ids]) => {
    const c = JSON.parse(localStorage.getItem("gym_checks") || "{}");
    c[d + "_" + day] = Object.fromEntries(ids.map((id) => [id, true]));
    localStorage.setItem("gym_checks", JSON.stringify(c));
  }, [TODAY, DAY_ID, EX_IDS.slice(0, 5)]);
  await page.reload();
  await page.waitForFunction(() => window.GymVerify && window.GymApp);
  await tickSets(page, "mua_facepull");
  expect(await page.evaluate(() => isDayComplete(activeDay))).toBe(true);
  expect(dialogs).toEqual([]);
  await context.close();
});

test.describe("swap undo never doubles an exercise", () => {
  test("swap, swap into the freed move, undo the first", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await page.waitForFunction(() => window.GymSwap && window.GymApp);
    const r = await page.evaluate((d) => {
      const DAY = "m_chesttri";
      GymSwap.apply(d, DAY, "ctb_dbbench", "mua_bench");
      const fly = GymApp.dayExercises(DAY, d).find((e) => e.id === "cta_fly");
      const offered = GymSwap.alternatives(fly, DAY).map((a) => a.id);
      // even forced (an older build, another tab), undoing the first slot is refused
      GymSwap.apply(d, DAY, "cta_fly", "ctb_dbbench");
      const undone = GymSwap.undo(d, DAY, "ctb_dbbench");
      return { offered, undone, ids: GymApp.dayExercises(DAY, d).map((e) => e.id) };
    }, TODAY);
    expect(r.offered).not.toContain("ctb_dbbench");
    expect(r.offered).not.toContain("mua_bench");
    expect(r.undone).toBe(false);
    expect(new Set(r.ids).size).toBe(r.ids.length);
    await context.close();
  });
});

test.describe("completion queue", () => {
  test("a completion is queued while its POST hangs, and posts on the next flush", async ({ browser }) => {
    let hang = true;
    const posts = [];
    const { context, page } = await openApp(browser, {
      signedIn: true,
      setup: (ctx) => ctx.route("**/api/v1/workouts/complete", async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        posts.push(route.request().postDataJSON());
        if (hang) return new Promise(() => {});
        return route.fallback();
      })
    });
    await page.waitForFunction(() => window.GymRest);
    await page.evaluate(([d, id]) => { GymRest.submit(d, id); }, [TODAY, DAY_ID]);
    await expect.poll(() => posts.length, T).toBe(1);
    const queued = () => page.evaluate(() => JSON.parse(localStorage.getItem("gymrest_pending") || "[]").map((x) => x.date + "_" + x.dayId));
    expect(await queued()).toEqual([TODAY + "_" + DAY_ID]); // app killed here: still queued
    hang = false;
    await page.reload();
    await page.waitForFunction(() => window.GymRest);
    expect(await queued()).toEqual([TODAY + "_" + DAY_ID]);
    await page.evaluate(() => GymRest.flushQueue());
    await expect.poll(queued, T).toEqual([]);
    expect(posts.length).toBeGreaterThanOrEqual(2);
    await context.close();
  });

  test("an accepted completion leaves nothing queued", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await page.waitForFunction(() => window.GymRest);
    const r = await page.evaluate(([d, id]) => GymRest.submit(d, id), [TODAY, DAY_ID]);
    expect(r).toBe("ok");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gymrest_pending") || "[]"))).toEqual([]);
    await context.close();
  });
});

test("Reset clears the set ticks, so Machine busy? is back and works", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.waitForFunction(() => window.GymVerify && window.GymSwap);
  await tickSets(page, "mua_bench", 1);
  expect(await page.evaluate(([d, day]) => GymVerify.exerciseTicked(d, day, "mua_bench"), [TODAY, DAY_ID])).toBe(true);
  await expect(page.locator('[data-swap="mua_bench"]')).toBeHidden();
  await page.locator("#resetLink").click();
  expect(await page.evaluate(([d, day]) => GymVerify.exerciseTicked(d, day, "mua_bench"), [TODAY, DAY_ID])).toBe(false);
  expect(await page.evaluate(([d, day]) => GymVerify.timerStart(d, day) > 0, [TODAY, DAY_ID])).toBe(true); // the clock keeps its start
  await expect(page.locator('[data-swap="mua_bench"]')).toBeVisible(T);
  await page.locator('[data-swap="mua_bench"]').click();
  await page.locator("#swapSheet .swap-opt").first().click();
  await expect(page.locator(".ex-swapped")).toHaveCount(1, T);
  await context.close();
});

test("a rejected day does not block a rest mark", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true, server: { restDays: [TODAY] } });
  await page.waitForFunction(() => window.GymRest);
  const r = await page.evaluate((d) => {
    const rejected = GymRest.decorate({ [d]: { complete: false, rejected: true, server: true } }, d, d)[d];
    const held = GymRest.decorate({ [d]: { complete: false, held: true, server: true } }, d, d)[d];
    return { rejected: !!rejected.rest, held: !!held.rest };
  }, TODAY);
  expect(r).toEqual({ rejected: true, held: false });
  await context.close();
});

test("Classic calisthenics offers only equipment the day's own moves use", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.waitForFunction(() => window.GymApp && window.GymApp.swapTools);
  const r = await page.evaluate(() => ({
    gym: GymApp.swapTools("m_upper"),
    cal: GymApp.swapTools("mc_push"),
    calTools: [...new Set(GymApp.dayExercises("mc_push").flatMap((e) => e.tools || ["none"]))]
  }));
  expect(r.gym).toBeNull();
  expect(r.cal).toContain("none");
  for (const t of r.calTools) expect(r.cal).toContain(t);
  expect(r.cal).not.toContain("cable");
  await context.close();
});

test("clock moved back shows the clock message, not a long wait", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.waitForFunction(() => window.GymVerify);
  await page.evaluate(([d, day]) => GymVerify.tryTick(d, day, "mua_bench", 0, Date.now() + 3600000), [TODAY, DAY_ID]);
  await page.locator('.set-chk[data-set-ex="mua_bench"]').nth(1).click();
  await expect(page.locator("#gymToast")).toContainText("Check your phone's clock", T);
  await context.close();
});
