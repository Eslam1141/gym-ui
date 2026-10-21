// Weekly muscle map: GymMuscleMap.coverage(weekKey) -> {regionId: 0|1|2} built from the
// exercises ticked done this week (gym_checks), and the card that draws it on the Plan tab.
// Fake clock: Fri 2026-10-02 10:00 Cairo. Weeks run Saturday-Friday (GymDate.weekKey),
// so this week is 2026-09-26 .. 2026-10-02.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

async function app(browser, opts) {
  const o = await openApp(browser, opts || {});
  await o.page.waitForFunction(() => window.GymMuscleMap && window.GymApp && window.GymApp.allDaySets);
  return o;
}
const cov = (page) => page.evaluate(() => window.GymMuscleMap.coverage(window.GymDate.weekKey()));

test("a region with no done session is 0, and all 20 regions are reported", async ({ browser }) => {
  const { context, page } = await app(browser, {});
  const c = await cov(page);
  expect(Object.keys(c).sort()).toEqual([...(await page.evaluate(() => window.GymMuscleArt.REGIONS))].sort());
  expect(Object.values(c).every((v) => v === 0)).toBe(true);
  await context.close();
});

test("one day is 1, two different days is 2", async ({ browser }) => {
  const { context, page } = await app(browser, { checks: { "2026-10-01_m_upper": { mua_bench: true, mua_row: false } } });
  let c = await cov(page);
  expect(c.chest_mid).toBe(1);
  expect(c.back_mid).toBe(0);   // ticked off, not done
  expect(c.quads).toBe(0);
  await context.close();

  const two = await app(browser, { checks: { "2026-10-01_m_upper": { mua_bench: true }, "2026-09-29_m_upperA": { mua_bench: true } } });
  c = await cov(two.page);
  expect(c.chest_mid).toBe(2);
  await two.context.close();
});

test("the same day twice is still 1", async ({ browser }) => {
  const { context, page } = await app(browser, {
    checks: {
      "2026-10-01_m_backbi": { bba_inclcurl: true, mub_hammer: true },   // two exercises, one session
      "2026-10-01_m_upper": { mua_bench: true },
      "2026-10-01_m_upperA": { mua_bench: true }                          // two plans, one calendar day
    }
  });
  const c = await cov(page);
  expect(c.biceps_long).toBe(1);
  expect(c.chest_mid).toBe(1);
  await context.close();
});

test("shape2 counts toward the second region", async ({ browser }) => {
  const { context, page } = await app(browser, { checks: { "2026-10-01_m_lower": { mla_rdl: true }, "2026-09-28_m_lowerA": { mla_rdl: true } } });
  const c = await cov(page);
  expect(c.hamstrings).toBe(2);
  expect(c.back_lower).toBe(2);
  await context.close();
});

test("week boundary follows GymDate across midnight and Sunday/Monday", async ({ browser }) => {
  const { context, page } = await app(browser, {
    checks: {
      "2026-09-25_m_upper": { mua_bench: true },    // Friday of the previous week: out
      "2026-09-26_m_upper": { mua_pulldown: true }, // Saturday: first day of this week
      "2026-09-27_m_upper": { mua_row: true },      // Sunday
      "2026-09-28_m_upper": { mua_row: true }       // Monday: the week does not restart here
    }
  });
  expect(await page.evaluate(() => window.GymDate.weekKey())).toBe("2026-09-26");
  let c = await cov(page);
  expect(c.chest_mid).toBe(0);
  expect(c.back_lats).toBe(1);
  expect(c.back_mid).toBe(2);
  // Local midnight into Saturday 2026-10-03 (Friday 21:00Z is already Saturday 00:00 in Cairo).
  await page.clock.fastForward("14:30:00");
  expect(await page.evaluate(() => window.GymDate.key())).toBe("2026-10-03");
  expect(await page.evaluate(() => window.GymDate.weekKey())).toBe("2026-10-03");
  c = await cov(page);
  expect(Object.values(c).every((v) => v === 0)).toBe(true);
  // The old week is still readable by its own key.
  expect(await page.evaluate(() => window.GymMuscleMap.coverage("2026-09-26").back_mid)).toBe(2);
  await context.close();
});

test("works for AI plans, tagged or matched by name", async ({ browser }) => {
  const plan = [
    { id: "ai_d1", label: "Day 1", muscles: "Chest", exercises: [
      { id: "ai_a", en: "Cable Fly", sets: 3, reps: "12", rest: 60, shape: "chest_lower", shape2: "shoulder_front" },
      { id: "ai_b", en: "Barbell Bench Press", sets: 3, reps: "8", rest: 90 }   // no tag: name lookup
    ] },
    { id: "ai_d2", label: "Day 2", muscles: "Chest", exercises: [
      { id: "ai_c", en: "Cable Fly", sets: 3, reps: "12", rest: 60, shape: "chest_lower" }
    ] }
  ];
  const { context, page } = await app(browser, {
    ls: { gym_plans_custom: plan },
    checks: { "2026-09-30_ai_d1": { ai_a: true, ai_b: true }, "2026-10-01_ai_d2": { ai_c: true } }
  });
  const c = await cov(page);
  expect(c.chest_lower).toBe(2);
  expect(c.shoulder_front).toBe(1);
  expect(c.chest_mid).toBe(1);
  await context.close();
});

test("works for built-in split day ids (sp4gm_upperA style)", async ({ browser }) => {
  const { context, page } = await app(browser, {
    checks: { "2026-09-29_sp4gm_upperA": { ex_x: true }, "2026-10-01_sp4gm_upperB": { ex_y: true } }
  });
  // The app records each ticked exercise's tags when it is ticked (see remember()).
  await page.evaluate(() => {
    window.GymMuscleMap.remember("2026-09-29_sp4gm_upperA", [{ id: "ex_x", shape: "chest_upper", shape2: "triceps_long" }]);
    window.GymMuscleMap.remember("2026-10-01_sp4gm_upperB", [{ id: "ex_y", shape: "chest_upper" }]);
  });
  const c = await cov(page);
  expect(c.chest_upper).toBe(2);
  expect(c.triceps_long).toBe(1);
  await context.close();
});

test("switch keeps checks: plan, style and AI-plan changes mid-week do not lose a tick", async ({ browser }) => {
  const { context, page } = await app(browser, { signedIn: true });
  await page.waitForSelector(".check[data-id]");
  await page.locator('.check[data-id="mua_bench"]').click();   // Classic men, Upper day
  expect((await cov(page)).chest_mid).toBe(1);

  await page.evaluate(() => document.querySelector('[data-plan-btn="female"]').click());   // other plan (button lives on another tab)
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.plan)).toBe("female");
  expect((await cov(page)).chest_mid).toBe(1);

  await page.evaluate(() => window.GymApplyCoachPlan([        // an AI plan whose ids know nothing about the tick
    { id: "ai_x", label: "X", muscles: "Legs", exercises: [{ id: "ai_sq", en: "Squat", sets: 3, reps: "8", rest: 90, shape: "quads" }] }
  ]));
  await expect.poll(() => page.evaluate(() => window.GymMuscleMap.coverage(window.GymDate.weekKey()).chest_mid)).toBe(1);
  await context.close();
});

test("the card: legend, named regions, tap and keyboard", async ({ browser }) => {
  const { context, page } = await app(browser, {
    checks: { "2026-10-01_m_upper": { mua_bench: true, mua_row: true }, "2026-09-29_m_upperA": { mua_bench: true } }
  });
  const card = page.locator("#weekMap");
  await expect(card).toBeVisible();
  await card.locator("summary").click();
  await expect(card.locator(".wm-legend")).toContainText("Trained once");
  await expect(card.locator(".wm-legend")).toContainText("Trained twice");
  const regions = card.locator("[data-region]");
  await expect(regions).toHaveCount(20);
  const mid = card.locator('[data-region="chest_mid"]');
  await expect(mid).toHaveAttribute("aria-label", /chest.*trained twice/i);
  await expect(card.locator('[data-region="back_mid"]')).toHaveAttribute("aria-label", /trained once/i);
  await expect(card.locator('[data-region="quads"]')).toHaveAttribute("aria-label", /not trained yet/i);
  await mid.locator(".ma-sh").first().click();   // a real tap on the muscle itself
  await expect(card.locator(".wm-name")).toContainText(/chest.*trained twice/i);
  await card.locator('[data-region="quads"]').focus();
  await page.keyboard.press("Enter");
  await expect(card.locator(".wm-name")).toContainText(/not trained yet/i);
  await context.close();
});

test("Arabic: legend and region names are translated, figure order follows RTL", async ({ browser }) => {
  const { context, page } = await app(browser, { lang: "ar", checks: { "2026-10-01_m_upper": { mua_bench: true } } });
  const card = page.locator("#weekMap");
  await card.locator("summary").click();
  await expect(card.locator(".wm-legend")).toContainText("مرة واحدة");
  expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
  await expect(card.locator('[data-region="chest_mid"]')).toHaveAttribute("aria-label", /[؀-ۿ]/);
  await context.close();
});

test("reduced motion: nothing animates", async ({ browser }) => {
  const { context, page } = await app(browser, { signedIn: true, contextOptions: { reducedMotion: "reduce" } });
  await page.waitForSelector(".check[data-id]");
  await page.locator("#weekMap summary").click();
  await page.locator('.check[data-id="mua_bench"]').click();   // a region rises: would pulse otherwise
  await expect(page.locator('#weekMap [data-region="chest_mid"]')).toHaveAttribute("aria-label", /trained once/i);
  const moving = await page.evaluate(() => [...document.querySelectorAll("#weekMap, #weekMap *")].filter((e) => {
    const s = getComputedStyle(e);
    return (s.animationName !== "none" && parseFloat(s.animationDuration) > 0) ||
      s.transitionDuration.split(",").some((d) => parseFloat(d) > 0.02);
  }).map((e) => e.tagName + "." + (e.getAttribute("class") || "")));
  expect(moving).toEqual([]);
  await context.close();
});

test("with motion allowed, a region that just rose pulses once (control for the test above)", async ({ browser }) => {
  const { context, page } = await app(browser, { signedIn: true });
  await page.waitForSelector(".check[data-id]");
  await page.locator("#weekMap summary").click();
  await page.locator('.check[data-id="mua_bench"]').click();
  const name = await page.evaluate(() => getComputedStyle(document.querySelector('#weekMap [data-region="chest_mid"]')).animationName);
  expect(name).toBe("wm-rise");
  await context.close();
});

for (const theme of ["dark", "light"]) {
  test(`${theme}: selecting a region glows its silhouette (no stroke) and the legend swatches use the map's fill colours`, async ({ browser }) => {
    const { context, page } = await app(browser, { theme, checks: { "2026-10-01_m_upper": { mua_bench: true } } });
    const card = page.locator("#weekMap");
    await card.locator("summary").click();
    const mid = card.locator('[data-region="chest_mid"]');
    const before = await mid.locator(".ma-sh").first().evaluate((e) => getComputedStyle(e).strokeWidth + "|" + getComputedStyle(e).stroke);
    await mid.locator(".ma-sh").first().click();
    const after = await mid.locator(".ma-sh").first().evaluate((e) => getComputedStyle(e).strokeWidth + "|" + getComputedStyle(e).stroke);
    expect(after).toBe(before);   // an outline on this thin muscle read as stray white lines
    expect(await mid.evaluate((e) => getComputedStyle(e).filter)).toContain("drop-shadow");
    const stops = await page.evaluate(() => {
      const wm = document.querySelector("#weekMap .wm"), probe = document.createElement("i");
      wm.appendChild(probe);
      const col = (v) => { probe.style.backgroundColor = "var(" + v + ")"; return getComputedStyle(probe).backgroundColor; };
      const out = { hi2a: col("--mus-hi2-a"), hi2b: col("--mus-hi2-b"), hia: col("--mus-hi-a"), hib: col("--mus-hi-b"), mhi: col("--mus-m-hi") };
      probe.remove();
      out.sw1 = getComputedStyle(document.querySelector(".wm-sw1")).backgroundImage;
      out.sw2 = getComputedStyle(document.querySelector(".wm-sw2")).backgroundImage;
      return out;
    });
    expect(stops.sw1).toContain(stops.hi2a);
    expect(stops.sw1).toContain(stops.hi2b);
    expect(stops.sw2).toContain(stops.hia);
    expect(stops.sw2).toContain(stops.hib);
    expect(stops.hi2a).not.toBe(stops.hia);
    expect(stops.hi2a).not.toBe(stops.mhi);
    await context.close();
  });
}

test("the women's plan draws the female figure, the men's plan the male one", async ({ browser }) => {
  const shape = async (plan) => {
    const { context, page } = await app(browser, { plan, signedIn: true, checks: { "2026-10-01_m_upper": { mua_bench: true } } });
    const card = page.locator("#weekMap");
    await card.locator("summary").click();
    const svg = card.locator("svg.ma-svg").first();
    const out = [await svg.getAttribute("class"), await card.locator('[data-region="chest_mid"] .ma-sh').first().getAttribute("d")];
    await context.close();
    return out;
  };
  const [mc, md] = await shape("male"), [fc, fd] = await shape("female");
  expect(mc).not.toContain("ma-female");
  expect(fc).toContain("ma-female");
  expect(fd).not.toBe(md);
});
