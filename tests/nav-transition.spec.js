const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(60000);

// The bottom nav must stay solid while a tab switch runs the screen View Transition.
// Regression: the nav's view-transition group painted underneath the sliding screen
// groups (groups stack in document order), so screen content showed through the bar.
test.describe("bottom nav during a tab switch", () => {
  test("items are the same nodes and the bar never shows screen content through it", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    // The active-tab pill slides on purpose; freeze it so only unwanted change is measured.
    await page.addStyleTag({ content: "#appNav button, #appNav button::before{ transition:none !important; }" });
    await page.waitForTimeout(800);
    const hasVt = await page.evaluate(() => typeof document.startViewTransition === "function");
    test.skip(!hasVt, "View Transitions unavailable in this browser");

    await page.evaluate(() => { window.__navNodes = Array.from(document.querySelectorAll("#appNav button")); });
    const box = await page.locator("#appNav").boundingBox();
    const seq = ["more", "coach", "food", "plan"];
    for (const tab of seq) {
      await page.evaluate((t) => GymUI.navigate(t), tab);
      const frames = [];
      for (let i = 0; i < 10; i++) frames.push(await page.screenshot({ clip: box }));
      await page.waitForTimeout(700);
      const settled = await page.screenshot({ clip: box });
      // Decode in the page and count clearly different pixels against the settled bar.
      const diffs = await page.evaluate(async (shots) => {
        const px = async (b64) => {
          const bmp = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
          const c = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d");
          c.drawImage(bmp, 0, 0);
          return c.getImageData(0, 0, bmp.width, bmp.height).data;
        };
        const ref = await px(shots.settled);
        return Promise.all(shots.frames.map(async (f) => {
          const d = await px(f);
          let n = 0;
          for (let i = 0; i < d.length; i += 4) {
            if (Math.abs(d[i] - ref[i]) + Math.abs(d[i + 1] - ref[i + 1]) + Math.abs(d[i + 2] - ref[i + 2]) > 24) n++;
          }
          return n / (d.length / 4);
        }));
      }, { frames: frames.map((f) => f.toString("base64")), settled: settled.toString("base64") });
      diffs.forEach((d) => expect(d, "share of nav pixels changed mid-transition (" + tab + ")").toBeLessThan(0.003));
    }
    const same = await page.evaluate(() => {
      const now = Array.from(document.querySelectorAll("#appNav button"));
      return now.length === window.__navNodes.length && now.every((b, i) => b === window.__navNodes[i]);
    });
    expect(same).toBe(true);
    await context.close();
  });

  test("the nav's transition groups are stacked above the screen groups", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    const hasVt = await page.evaluate(() => typeof document.startViewTransition === "function");
    test.skip(!hasVt, "View Transitions unavailable in this browser");
    const z = await page.evaluate(async () => {
      const t = document.startViewTransition(() => GymUI.navigate("more", { instant: true }));
      await t.ready;
      const g = (n) => getComputedStyle(document.documentElement, "::view-transition-group(" + n + ")").zIndex;
      const out = { nav: g("app-nav"), top: g("app-topbar"), prefs: g("app-topprefs") };
      await t.finished;
      return out;
    });
    expect(z).toEqual({ nav: "1", top: "1", prefs: "1" });
    await context.close();
  });
});
