// Banners on Food and More only (ads plan FE-2).
const { test, expect } = require("@playwright/test");
const { openAdsApp, calls } = require("./ads-helpers");

test.setTimeout(60000);

const shown = (page) => page.evaluate(() => document.body.classList.contains("has-ad-banner"));
const last = (page, name) => page.evaluate((n) => { const c = window.__adsCalls.filter((x) => x.name === n); return c.length ? c[c.length - 1].arg : null; }, name);
const go = async (page, tab) => { await page.evaluate((t) => GymUI.navigate(t, { instant: true }), tab); };
const pad = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".screen:not([hidden])")).paddingBottom));

test.describe("banner placement", () => {
  test("shows on food and more, not on plan / coach / watch", async ({ browser }) => {
    const { context, page } = await openAdsApp(browser, { ads: { bannerHeight: 60 } });
    for (const tab of ["plan", "coach", "watch"]) {
      await go(page, tab);
      await page.waitForTimeout(150);
      expect(await shown(page), tab).toBe(false);
    }
    expect(await calls(page)).not.toContain("showBanner");
    for (const tab of ["food", "more"]) {
      await go(page, tab);
      await expect.poll(() => shown(page), { message: tab }).toBe(true);
    }
    expect(await last(page, "showBanner")).toMatchObject({ adUnitId: "ca-app-pub-test/banner" });
    expect(typeof (await last(page, "showBanner")).marginPx).toBe("number");
    await go(page, "plan");
    await expect.poll(() => shown(page)).toBe(false);
    expect(await calls(page)).toContain("hideBanner");
    await context.close();
  });

  test("page padding grows by exactly the banner height", async ({ browser }) => {
    const { context, page } = await openAdsApp(browser, { ads: { bannerHeight: 60 } });
    await go(page, "food");
    await page.waitForTimeout(150);
    await expect.poll(() => shown(page)).toBe(true);
    const withBanner = await pad(page);
    await go(page, "plan");
    await expect.poll(() => shown(page)).toBe(false);
    await go(page, "food");
    await page.evaluate(() => document.body.classList.remove("has-ad-banner"));
    const without = await pad(page);
    expect(withBanner - without).toBe(60);
    await context.close();
  });

  test("hidden while a sheet is open, back when it closes", async ({ browser }) => {
    const { context, page } = await openAdsApp(browser, {});
    await go(page, "more");
    await expect.poll(() => shown(page)).toBe(true);
    await page.evaluate(() => { const s = document.createElement("div"); s.id = "testSheet"; s.className = "sheet open"; s.style.cssText = "position:fixed;inset:0;"; document.body.appendChild(s); });
    await expect.poll(() => shown(page), { timeout: 4000 }).toBe(false);
    await page.evaluate(() => document.getElementById("testSheet").remove());
    await expect.poll(() => shown(page), { timeout: 4000 }).toBe(true);
    await context.close();
  });

  test("hidden while a text field has focus (keyboard open)", async ({ browser }) => {
    const { context, page } = await openAdsApp(browser, {});
    await go(page, "food");
    await expect.poll(() => shown(page)).toBe(true);
    await page.evaluate(() => { const i = document.createElement("input"); i.id = "tmpIn"; document.querySelector("#screen-food").appendChild(i); i.focus(); });
    await expect.poll(() => shown(page), { timeout: 4000 }).toBe(false);
    await page.evaluate(() => document.getElementById("tmpIn").blur());
    await expect.poll(() => shown(page), { timeout: 4000 }).toBe(true);
    await context.close();
  });

  test("hidden when a workout starts", async ({ browser }) => {
    const { context, page } = await openAdsApp(browser, {});
    await go(page, "food");
    await expect.poll(() => shown(page)).toBe(true);
    await page.evaluate(() => { window.__busy = true; GymApp.workoutInProgress = () => window.__busy; });
    await expect.poll(() => shown(page), { timeout: 4000 }).toBe(false);
    await page.evaluate(() => { window.__busy = false; });
    await expect.poll(() => shown(page), { timeout: 4000 }).toBe(true);
    await context.close();
  });

  test("hidden when the force-update screen blocks", async ({ browser }) => {
    const { context, page } = await openAdsApp(browser, {});
    await go(page, "food");
    await expect.poll(() => shown(page)).toBe(true);
    await page.evaluate(() => { GymForceUpdate.isBlocking = () => true; });
    await expect.poll(() => shown(page), { timeout: 4000 }).toBe(false);
    await context.close();
  });

  test("no fill: no class, no error, no retry storm", async ({ browser }) => {
    const { context, page, consoleErrors } = await openAdsApp(browser, { ads: { bannerReject: true } });
    await go(page, "food");
    await page.waitForTimeout(2500);
    expect(await shown(page)).toBe(false);
    expect((await calls(page)).filter((n) => n === "showBanner").length).toBe(1);
    expect(consoleErrors).toEqual([]);
    await context.close();
  });

  test("banners off in app-config: never shown even with ads on", async ({ browser }) => {
    const { context, page } = await openAdsApp(browser, { config: { bannersEnabled: false } });
    await go(page, "food");
    await page.waitForTimeout(300);
    expect(await shown(page)).toBe(false);
    expect(await calls(page)).not.toContain("showBanner");
    await context.close();
  });

  test("a dragged coach bubble is kept above the banner", async ({ browser }) => {
    const { context, page } = await openAdsApp(browser, { ads: { bannerHeight: 60 }, ls: { gymcoach_bubble_pos: { side: "r", bottom: 70 } } });
    await go(page, "food");
    await expect.poll(() => shown(page)).toBe(true);
    const r = await page.evaluate(() => {
      const nav = document.getElementById("appNav").getBoundingClientRect();
      const fab = document.getElementById("coachFab").getBoundingClientRect();
      return { fabBottom: fab.bottom, bannerTop: nav.top - 60 };
    });
    expect(r.fabBottom).toBeLessThanOrEqual(r.bannerTop);
    await context.close();
  });
});
