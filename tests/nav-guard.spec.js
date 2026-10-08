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

test.describe("review fixes", () => {
  test("re-tapping the active Food tab retries a failed meals load, and is a no-op otherwise", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    let hits = 0, fail = true;
    await page.route("**/api/v1/meals*", (route) => {
      hits++;
      return fail
        ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
        : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ meals: [] }) });
    });
    const foodBtn = page.locator('#appNav button[data-tab="food"]');
    await foodBtn.click();
    await expect(page.locator("#foodMealsHost .food-error")).toBeVisible(T);
    const afterFail = hits;
    fail = false;
    await foodBtn.click();   // active tab + last load failed: retries
    await expect(page.locator("#foodMealsHost .food-error")).toHaveCount(0, T);
    expect(hits).toBe(afterFail + 1);
    await foodBtn.click();   // loaded fine: true no-op
    await page.waitForTimeout(400);
    expect(hits).toBe(afterFail + 1);
    await context.close();
  });

  test("without View Transitions the entrance stagger starts only after the screen is revealed", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await page.evaluate(() => { document.startViewTransition = undefined; });
    const r = await page.evaluate(() => new Promise((resolve) => {
      const scr = document.getElementById("screen-coach");
      const t0 = Date.now();
      let shown = 0, entered = 0;
      const poll = setInterval(() => {
        const now = Date.now();
        if (!shown && !scr.hidden) shown = now;
        if (shown && !entered && scr.classList.contains("m-enter")) entered = now;
        if (entered && !scr.classList.contains("m-enter")) {
          clearInterval(poll);
          resolve({ lead: shown - t0, enterFor: now - shown });
        }
      }, 20);
      GymUI.navigate("coach");
    }));
    expect(r.lead).toBeGreaterThan(100);        // the fallback swap really is delayed
    expect(r.enterFor).toBeGreaterThan(450);    // and the stagger runs its full length after the reveal
    await context.close();
  });

  test("a new rest timer starts the bar full without animating it back up", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    const x = await page.evaluate(async () => {
      const f = document.getElementById("timerFill");
      document.getElementById("timerBar").classList.add("show");
      f.style.setProperty("--p", 0.2);
      await new Promise((r) => setTimeout(r, 1300));
      startRestTimer(60, "Test");
      return new DOMMatrix(getComputedStyle(f).transform).a;
    });
    expect(x).toBeGreaterThan(0.99);
    await context.close();
  });
});
