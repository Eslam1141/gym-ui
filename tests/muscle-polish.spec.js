// Plan tab muscle pictures, polish pass: front/back cue, generic names light the
// whole muscle, and a calm one-time entrance that never replays or runs under
// reduced motion.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };
const cardOf = (page, id) => page.locator('.check[data-id="' + id + '"]').locator("xpath=ancestor::div[contains(@class,'ex-card')]");
const coach = (page, exercises) => page.evaluate((list) => GymApplyCoachPlan([{ id: "coach_0", label: "Day", muscles: "x", exercises: list }]), exercises);
const ex = (id, en, extra) => Object.assign({ id, en, sets: 3, reps: "10", rest: 60 }, extra || {});

test("front/back label on each close-up, EN and AR", async ({ browser }) => {
  const en = await openApp(browser, { signedIn: true });
  await coach(en.page, [ex("c0", "Zzz A", { shape: "chest_mid" }), ex("c1", "Zzz B", { shape: "hamstrings" })]);
  await expect(cardOf(en.page, "c0").locator(".ex-mus .ex-mus-view")).toHaveText("Front", T);
  // hamstrings live on the back of the leg
  await expect(cardOf(en.page, "c1").locator(".ex-mus .ex-mus-view")).toHaveText("Back", T);
  await en.context.close();
  const ar = await openApp(browser, { signedIn: true, lang: "ar" });
  await coach(ar.page, [ex("c0", "Zzz A", { shape: "chest_mid" }), ex("c1", "Zzz B", { shape: "hamstrings" })]);
  await expect(cardOf(ar.page, "c0").locator(".ex-mus-view")).toHaveText("أمام", T);
  await expect(cardOf(ar.page, "c1").locator(".ex-mus-view")).toHaveText("خلف", T);
  await ar.context.close();
});

test("label sits on the end corner (right in LTR, left in RTL) and stays small", async ({ browser }) => {
  for (const lang of ["en", "ar"]) {
    const { context, page } = await openApp(browser, { signedIn: true, lang, viewport: { width: 360, height: 800 } });
    const pic = cardOf(page, "mua_bench").locator(".ex-mus");
    await expect(pic).toBeVisible(T);
    await page.waitForTimeout(700);   // let the card entrance settle before measuring
    const [p, l] = await Promise.all([pic.boundingBox(), pic.locator(".ex-mus-view").boundingBox()]);
    const mid = p.x + p.width / 2, lmid = l.x + l.width / 2;
    if (lang === "en") expect(lmid).toBeGreaterThan(mid); else expect(lmid).toBeLessThan(mid);
    expect(l.y + l.height / 2).toBeGreaterThan(p.y + p.height / 2);   // bottom corner
    expect(l.width).toBeLessThanOrEqual(p.width * 0.75);
    expect(l.x).toBeGreaterThanOrEqual(p.x - 0.5);
    expect(l.x + l.width).toBeLessThanOrEqual(p.x + p.width + 0.5);
    await context.close();
  }
});

test("leg crops are wide enough to show context; hamstrings are the back view", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  const vb = await page.evaluate(() => {
    const size = (id) => +/viewBox="\S+ \S+ (\S+) /.exec(GymMuscleArt.closeup(id, { sex: "male" }))[1];
    return { quads: size("quads"), ham: size("hamstrings"), glutes: size("glutes"), calves: size("calves") };
  });
  for (const k of Object.keys(vb)) expect(vb[k]).toBeGreaterThanOrEqual(110);
  const svgs = await page.evaluate(() => ({ q: GymMuscleArt.closeup("quads", {}), h: GymMuscleArt.closeup("hamstrings", {}) }));
  expect(svgs.q).not.toBe(svgs.h);
  expect(svgs.h).toContain('data-region="glutes"');   // glute / hamstring context is drawn
  await context.close();
});

test("generic names light the whole muscle and the chip names the group", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await coach(page, [ex("c0", "Bicep Curl"), ex("c1", "Triceps Pushdown"), ex("c2", "Hammer Curls"), ex("c3", "Barbell Curl")]);
  const bi = cardOf(page, "c0");
  await expect(bi.locator(".ex-mus-chip")).toHaveText("Biceps", T);
  await expect(bi.locator('.ex-mus [data-region="biceps_long"].ma-hi')).toHaveCount(1);
  await expect(bi.locator('.ex-mus [data-region="biceps_short"].ma-hi')).toHaveCount(1);
  await expect(cardOf(page, "c1").locator(".ex-mus-chip")).toHaveText("Triceps");
  await expect(cardOf(page, "c1").locator(".ex-mus .ma-hi")).toHaveCount(2);
  // a named variation keeps its single head; so do built-in names
  await expect(cardOf(page, "c2").locator(".ex-mus-chip")).toHaveText("Long head (outer)");
  await expect(cardOf(page, "c3").locator(".ex-mus-chip")).toHaveText("Short head (inner)");
  const g = await page.evaluate(() => [GymExerciseShape("curl"), GymExerciseShape("tricep extension"), GymExerciseShape("dumbbell curl")]);
  expect(g[0]).toEqual({ shape: "biceps_long", shape2: "biceps_short" });
  expect(g[1]).toEqual({ shape: "triceps_long", shape2: "triceps_lateral" });
  expect(g[2]).toEqual({ shape: "biceps_long", shape2: "biceps_short" });
  await context.close();
  const ar = await openApp(browser, { signedIn: true, lang: "ar" });
  await coach(ar.page, [ex("c0", "Bicep Curl")]);
  await expect(cardOf(ar.page, "c0").locator(".ex-mus-chip")).toHaveText("بايسبس", T);
  await ar.context.close();
});

test("an explicitly tagged exercise with both heads of one group also reads as the group", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await coach(page, [ex("c0", "Zzz A", { shape: "triceps_lateral", shape2: "triceps_long" }),
    ex("c1", "Zzz B", { shape: "chest_mid", shape2: "chest_upper" })]);
  await expect(cardOf(page, "c0").locator(".ex-mus-chip")).toHaveText("Triceps", T);
  await expect(cardOf(page, "c1").locator(".ex-mus-chip")).toHaveText("Mid chest · Upper chest");   // 3 parts: names stay
  await context.close();
});

test("reduced motion: no animation classes or running animations on tiles or cards", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll(".m-enter, .mus-settle").length), { timeout: 4000 }).toBe(0);   // first paint's entrance is over
  await page.emulateMedia({ reducedMotion: "reduce" });
  const r = await page.evaluate(() => {
    document.querySelectorAll("#dayTabs .day-chip")[1].click();
    return {
      classes: document.querySelectorAll("#dayMuscleTiles.m-enter, #exList .mus-settle, #exList .anim-in").length,
      anims: document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest("#dayMuscleTiles, #exList") && a.playState === "running").length
    };
  });
  expect(r).toEqual({ classes: 0, anims: 0 });
  await expect(page.locator("#dayMuscleTiles .mus-tile").first()).toBeVisible(T);
  await context.close();
});

test("entrance plays on a day change and never replays on a set toggle", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await expect(page.locator(".ex-card .ex-mus").first()).toBeVisible(T);
  const onChange = await page.evaluate(() => {
    document.querySelectorAll("#dayTabs .day-chip")[1].click();
    return { tiles: document.querySelector("#dayMuscleTiles").classList.contains("m-enter"), cards: document.querySelectorAll(".ex-mus.mus-settle").length };
  });
  expect(onChange.tiles).toBe(true);
  expect(onChange.cards).toBeGreaterThan(0);
  // classes clean themselves up once the animation is done
  await expect.poll(() => page.evaluate(() => document.querySelectorAll(".m-enter, .mus-settle").length), { timeout: 4000 }).toBe(0);
  await expect(page.locator(".ex-card .ex-mus .ma-hi").first()).toBeVisible(T);
  await page.evaluate(() => { document.querySelector(".ex-card").dataset.k = "same"; });
  await page.locator(".ex-card .set-chk").first().click();
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({
    same: document.querySelector(".ex-card").dataset.k === "same",
    classes: document.querySelectorAll(".m-enter, .mus-settle").length,
    anims: document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest(".ex-mus, #dayMuscleTiles") && a.playState === "running").length
  }));
  expect(after).toEqual({ same: true, classes: 0, anims: 0 });
  await context.close();
});

test("the entrance animates only transform and opacity", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true, viewport: { width: 360, height: 800 } });
  await expect(page.locator(".ex-card .ex-mus").first()).toBeVisible(T);
  const props = await page.evaluate(() => {
    document.querySelectorAll("#dayTabs .day-chip")[1].click();
    const names = new Set();
    document.getAnimations().forEach((a) => {
      if (a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest(".ex-mus, #dayMuscleTiles")) {
        a.effect.getKeyframes().forEach((k) => Object.keys(k).forEach((p) => names.add(p)));
      }
    });
    return [...names];
  });
  const allowed = new Set(["offset", "easing", "composite", "computedOffset", "opacity", "transform"]);
  props.forEach((p) => expect(allowed.has(p), p).toBe(true));
  expect(props.length).toBeGreaterThan(0);
  await context.close();
});
