// Tab switch without the View Transitions API: the outgoing screen hides at once and only the
// incoming screen runs a short transform/opacity slide (vertical on the >= 900px sidebar).
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(60000);
const PHONE = { width: 360, height: 800 };
const DESKTOP = { width: 1280, height: 800 };
const T = { timeout: 6000 };

async function open(browser, opts) {
  const app = await openApp(browser, Object.assign({ signedIn: true, viewport: PHONE }, opts || {}));
  await app.context.route(/youtube|ytimg/, (r) => r.abort());
  await expect(app.page.locator(".ex-card").first()).toBeVisible(T);
  await app.page.waitForTimeout(1400);
  return app;
}
const countVt = (page) => page.evaluate(() => {
  window.__vt = 0;
  const o = document.startViewTransition;
  if (o) document.startViewTransition = function () { window.__vt++; return o.apply(document, arguments); };
});
// Animations that target the screen element itself (not its staggered children).
const screenAnims = (page, tab) => page.evaluate((t) => document.getAnimations()
  .filter((a) => a.effect && a.effect.target && a.effect.target.id === "screen-" + t && !a.effect.pseudoElement)
  .map((a) => ({
    name: a.animationName,
    props: [...new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k)))].filter((p) => !["offset", "computedOffset", "easing", "composite"].includes(p)).sort(),
    transforms: a.effect.getKeyframes().map((k) => k.transform).filter(Boolean)
  })), tab);

test.describe("fast tab switch", () => {
  test("a tab switch does not start a view transition", async ({ browser }) => {
    const { context, page } = await open(browser);
    await countVt(page);
    await page.locator('#appNav button[data-tab="food"]').click();
    await expect(page.locator("body")).toHaveAttribute("data-tab", "food", T);
    await page.locator('#appNav button[data-tab="plan"]').click();
    await expect(page.locator("body")).toHaveAttribute("data-tab", "plan", T);
    expect(await page.evaluate(() => window.__vt)).toBe(0);
    await context.close();
  });

  test("the outgoing screen is hidden at once and the incoming one animates transform and opacity, once", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.evaluate(() => { window.__starts = []; document.addEventListener("animationstart", (e) => { if (e.target.id && e.target.id.indexOf("screen-") === 0) window.__starts.push(e.animationName + "@" + e.target.id); }, true); });
    await page.evaluate(() => GymUI.navigate("food"));
    expect(await page.evaluate(() => document.getElementById("screen-plan").hidden)).toBe(true);
    const a = await screenAnims(page, "food");
    expect(a).toHaveLength(1);
    expect(a[0].name).toBe("m-slide-in");
    expect(a[0].props).toEqual(["opacity", "transform"]);
    await page.waitForTimeout(800);
    expect(await screenAnims(page, "food")).toHaveLength(0);
    expect(await page.evaluate(() => window.__starts)).toEqual(["m-slide-in@screen-food"]);
    expect(await page.evaluate(() => document.querySelectorAll(".screen-slide-in").length)).toBe(0);
    await context.close();
  });

  test("EN slides in from the right when moving forward, AR from the left", async ({ browser }) => {
    for (const lang of ["en", "ar"]) {
      const { context, page } = await open(browser, { lang });
      await page.evaluate(() => GymUI.navigate("food"));
      const a = await screenAnims(page, "food");
      const x = parseFloat(a[0].transforms[0].match(/translate3d\((-?[\d.]+)px/)[1]);
      if (lang === "en") expect(x).toBeGreaterThan(0); else expect(x).toBeLessThan(0);
      await page.waitForTimeout(600);
      await page.evaluate(() => GymUI.navigate("plan"));   // backwards: opposite way
      const b = await screenAnims(page, "plan");
      const y = parseFloat(b[0].transforms[0].match(/translate3d\((-?[\d.]+)px/)[1]);
      expect(Math.sign(y)).toBe(-Math.sign(x));
      await context.close();
    }
  });

  test("at 1280px the move is vertical", async ({ browser }) => {
    const { context, page } = await open(browser, { viewport: DESKTOP });
    await page.evaluate(() => GymUI.navigate("food"));
    const a = await screenAnims(page, "food");
    expect(a).toHaveLength(1);
    expect(a[0].name).toBe("m-nav-in");
    expect(a[0].transforms[0]).toMatch(/translate3d\(0(px)?, [1-9][\d.]*px, 0(px)?\)/);
    await context.close();
  });

  test("under reduced motion nothing animates on the screen", async ({ browser }) => {
    const { context, page } = await open(browser, { contextOptions: { reducedMotion: "reduce" } });
    await countVt(page);
    await page.evaluate(() => GymUI.navigate("food"));
    expect(await page.evaluate(() => document.getElementById("screen-plan").hidden)).toBe(true);
    expect(await screenAnims(page, "food")).toHaveLength(0);
    expect(await page.evaluate(() => document.querySelectorAll(".screen-slide-in").length)).toBe(0);
    expect(await page.evaluate(() => window.__vt)).toBe(0);
    await context.close();
  });

  test("three quick switches end on the last tab with nothing stuck", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.evaluate(() => { GymUI.navigate("food"); GymUI.navigate("more"); GymUI.navigate("coach"); });
    await expect(page.locator("body")).toHaveAttribute("data-tab", "coach", T);
    const visible = await page.evaluate(() => [...document.querySelectorAll(".screen")].filter((s) => !s.hidden).map((s) => s.id));
    expect(visible).toEqual(["screen-coach"]);
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => document.querySelectorAll(".screen-slide-in, .m-enter").length)).toBe(0);
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.classList && a.effect.target.classList.contains("screen")).length)).toBe(0);
    await context.close();
  });
});
