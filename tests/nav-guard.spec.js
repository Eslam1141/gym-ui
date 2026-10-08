const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };

test.describe("no-op navigation", () => {
  test("tapping the active tab does not re-render, refetch or restart anything", async ({ browser }) => {
    const { context, page, consoleErrors } = await openApp(browser, { signedIn: true });
    await page.locator('#appNav button[data-tab="coach"]').click();
    await expect(page.locator("body")).toHaveAttribute("data-tab", "coach", T);

    await page.waitForTimeout(1200); // let the entrance stagger finish and clean up
    // Count screen-level DOM churn and coach refreshes from here on.
    await page.evaluate(() => {
      window.__mut = 0; window.__refresh = 0;
      new MutationObserver((m) => { window.__mut += m.length; })
        .observe(document.getElementById("screen-coach"), { childList: true, subtree: true, attributes: true });
      const orig = GymCoach.refresh;
      GymCoach.refresh = function () { window.__refresh++; return orig.apply(this, arguments); };
      window.__vt = 0;
      const svt = document.startViewTransition;
      if (svt) document.startViewTransition = function () { window.__vt++; return svt.apply(document, arguments); };
    });

    const coachBtn = page.locator('#appNav button[data-tab="coach"]');
    await coachBtn.click();
    await coachBtn.dblclick();
    await page.waitForTimeout(500);

    expect(await page.evaluate(() => window.__refresh)).toBe(0);
    expect(await page.evaluate(() => window.__mut)).toBe(0);
    expect(await page.evaluate(() => window.__vt)).toBe(0);
    expect(await page.evaluate(() => GymUI.navigate("coach"))).toBe(false);

    // A different tab still navigates (and reports it).
    expect(await page.evaluate(() => GymUI.navigate("plan"))).toBe(true);
    await expect(page.locator("body")).toHaveAttribute("data-tab", "plan", T);
    expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
    await context.close();
  });

  test("the Profile menu entry while on Profile keeps the real back target", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await page.evaluate(() => { window.__gymPrevTab = "food"; GymUI.navigate("profile"); });
    await expect(page.locator("body")).toHaveAttribute("data-tab", "profile", T);
    await page.evaluate(() => document.getElementById("tbMenuProfile").click());
    expect(await page.evaluate(() => window.__gymPrevTab)).toBe("food");
    await context.close();
  });
});

test.describe("double-submit guard (GymAct)", () => {
  test("once() ignores re-entry until the promise settles", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    const r = await page.evaluate(async () => {
      let calls = 0, release;
      const g = GymAct.once(() => { calls++; return new Promise((res) => { release = res; }); });
      g(); g(); g();
      const during = calls;
      release();
      await new Promise((res) => setTimeout(res, 10));
      g();
      return { during, after: calls };
    });
    expect(r).toEqual({ during: 1, after: 2 });
    await context.close();
  });

  test("once() with a cooldown swallows a synchronous double tap", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    const r = await page.evaluate(async () => {
      let calls = 0;
      const g = GymAct.once(() => { calls++; }, { cooldown: 60 });
      g(); g();
      const during = calls;
      await new Promise((res) => setTimeout(res, 100));
      g();
      return { during, after: calls };
    });
    expect(r).toEqual({ during: 1, after: 2 });
    await context.close();
  });

  test("run() marks the button busy while in flight and releases on failure", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    const r = await page.evaluate(async () => {
      const b = document.createElement("button");
      document.body.appendChild(b);
      let calls = 0, rej;
      GymAct.run(b, () => { calls++; return new Promise((_, no) => { rej = no; }); });
      GymAct.run(b, () => { calls++; });
      const busy = b.getAttribute("aria-busy");
      rej(new Error("x"));
      await new Promise((res) => setTimeout(res, 10));
      return { calls, busy, after: b.getAttribute("aria-busy") };
    });
    expect(r).toEqual({ calls: 1, busy: "true", after: null });
    await context.close();
  });

  test("a double-clicked session button starts one session, not start+stop", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await page.locator("#sessionBtn").dblclick();
    await page.waitForTimeout(150);
    const active = await page.evaluate(() => !!localStorage.getItem("gym_session_active"));
    expect(active).toBe(true);
    await context.close();
  });
});
