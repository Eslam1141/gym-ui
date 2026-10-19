const { test, expect, chromium } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(60000);

// At laptop size the page must not move between tabs: same wrap/rail offset (the
// classic scrollbar shows only on tall screens) and same title / sub-line position.
const TABS = ["plan", "coach", "food", "more"];
for (const [width, height] of [[1440, 900], [1280, 800]]) {
  test(`header and wrap stay put across tabs at ${width}x${height}`, async () => {
    // Playwright hides scrollbars by default, which would hide the very shift under test.
    const browser = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
    const { context, page } = await openApp(browser, { signedIn: true, viewport: { width, height } });
    await page.waitForTimeout(800);
    const rows = [];
    for (const tab of TABS) {
      await page.evaluate((t) => GymUI.navigate(t, { instant: true }), tab);
      await expect(page.locator("body")).toHaveAttribute("data-tab", tab);
      await page.waitForTimeout(700); // entrance stagger settles
      rows.push(await page.evaluate((t) => {
        const s = document.getElementById("screen-" + t);
        const r = (e) => (e ? e.getBoundingClientRect() : null);
        const h1 = r(s.querySelector("header.hero h1")), sub = r(s.querySelector("header.hero .sub"));
        return {
          tab: t, wrapX: r(s.querySelector(".wrap")).x, wrapW: r(s.querySelector(".wrap")).width,
          navX: r(document.getElementById("appNav")).x, navW: r(document.getElementById("appNav")).width,
          h1X: h1.x, h1Y: h1.y, h1H: h1.height, subY: sub && sub.y, logo: !!s.querySelector("header.hero .hero-logo")
        };
      }, tab));
    }
    const near = (key, list) => list.forEach((v) => expect(Math.abs(v[key] - list[0][key]), key + " differs on " + v.tab).toBeLessThanOrEqual(1));
    for (const key of ["wrapX", "wrapW", "navX", "navW", "h1X", "h1Y", "h1H"]) near(key, rows);
    near("subY", rows.filter((r) => r.subY !== null));
    expect(rows.map((r) => r.logo)).toEqual([true, true, true, true]);
    await context.close();
    await browser.close();
  });
}
