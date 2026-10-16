// Motion batch 1: GymMotion.show/hide, pop-on-increase cues, row-level meal list updates.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);

const TARGET = { computed: { targetKcal: 2000, proteinG: 150 } };
const meal = (id, type) => ({ id, mealType: type || "lunch", foodName: "Food " + id, grams: 100, nutrients: { kcal: 100, protein: 5, carbs: 10, fat: 5 }, date: "2026-10-02" });

test("hide() keeps the element until the animation ends, then sets hidden", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.id = "probe"; d.className = "m-menu"; d.hidden = true; d.textContent = "x";
    document.body.appendChild(d);
    GymMotion.show(d);
  });
  await expect(page.locator("#probe")).toBeVisible();
  const mid = await page.evaluate(() => {
    const d = document.getElementById("probe");
    let called = 0;
    GymMotion.hide(d, () => called++);
    window.__called = () => called;
    return { hidden: d.hidden, out: d.classList.contains("m-out") };
  });
  expect(mid).toEqual({ hidden: false, out: true });
  await expect.poll(() => page.evaluate(() => document.getElementById("probe").hidden)).toBe(true);
  expect(await page.evaluate(() => window.__called())).toBe(1);
  expect(await page.evaluate(() => document.getElementById("probe").classList.contains("m-out"))).toBe(false);
  await context.close();
});

test("hide() falls back to a timeout when no animation runs", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.id = "probe"; d.textContent = "x"; // no m-* style class: nothing animates
    document.body.appendChild(d);
    GymMotion.hide(d);
  });
  await page.clock.runFor(400);
  expect(await page.evaluate(() => document.getElementById("probe").hidden)).toBe(true);
  await context.close();
});

test("reduced motion: show and hide are instant", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const r = await page.evaluate(() => {
    const d = document.createElement("div");
    d.className = "m-menu"; d.hidden = true;
    document.body.appendChild(d);
    GymMotion.show(d);
    const shown = !d.hidden && !d.classList.contains("m-in");
    let called = false;
    GymMotion.hide(d, () => { called = true; });
    return { shown, hidden: d.hidden, called, out: d.classList.contains("m-out") };
  });
  expect(r).toEqual({ shown: true, hidden: true, called: true, out: false });
  await context.close();
});

test("notification panel and header menu: Escape still closes and restores focus", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.waitForFunction(() => window.GymNotifications && document.getElementById("tbBell"));
  await page.click("#tbBell");
  await expect(page.locator(".notif-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".notif-panel")).toBeHidden();
  await expect(page.locator("#tbBell")).toBeFocused();
  await page.click(".tb-avatar");
  await expect(page.locator("#tbMenu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#tbMenu")).toBeHidden();
  await expect(page.locator(".tb-avatar")).toBeFocused();
  await context.close();
});

test("menus grow from the inline-end corner in both directions", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  const sides = await page.evaluate(() => {
    const m = document.getElementById("tbMenu"); m.hidden = false;
    const x = () => parseFloat(getComputedStyle(m).transformOrigin);
    const ltr = x(), width = m.offsetWidth;
    document.documentElement.dir = "rtl";
    const rtl = x();
    m.hidden = true;
    return { ltr, rtl, width };
  });
  expect(sides.ltr).toBeCloseTo(sides.width, 0); // right edge
  expect(sides.rtl).toBe(0); // left edge
  await context.close();
});

test("calendar modal closes after its exit animation", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.evaluate(() => document.getElementById("calExpandBtn").click());
  await expect(page.locator("#calendarModal")).toBeVisible();
  await page.click("#calendarModalClose");
  await expect(page.locator("#calendarModal")).toBeHidden();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  await context.close();
});

test("streak badge pops only when the streak increases", async ({ browser }) => {
  const { context, page, server } = await openApp(browser, { signedIn: true });
  await expect(page.locator("#tbStreak")).toContainText("3");
  const cls = () => page.evaluate(() => document.getElementById("tbStreak").classList.contains("m-pop"));
  expect(await cls()).toBe(false); // first paint
  server.streak = 4;
  await page.evaluate(() => GymHeader.refreshMe());
  await expect(page.locator("#tbStreak")).toContainText("4");
  expect(await cls()).toBe(true);
  await page.evaluate(() => document.getElementById("tbStreak").classList.remove("m-pop"));
  server.streak = 2;
  await page.evaluate(() => GymHeader.refreshMe());
  await expect(page.locator("#tbStreak")).toContainText("2");
  expect(await cls()).toBe(false); // decrease: no pop
  await context.close();
});

test("bell badge pops and the bell swings only when unread rises", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  const state = { n: 1 };
  await context.route("**/api/v1/notifications**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ items: [], unreadCount: state.n })
  }));
  await page.waitForFunction(() => window.GymNotifications && document.getElementById("tbBell"));
  await page.evaluate(() => GymNotifications.refresh());
  await expect(page.locator("#tbBellBadge")).toHaveText("1");
  const cls = () => page.evaluate(() => ({
    pop: document.getElementById("tbBellBadge").classList.contains("m-pop"),
    swing: document.getElementById("tbBell").classList.contains("m-swing")
  }));
  expect(await cls()).toEqual({ pop: false, swing: false }); // first paint
  state.n = 2;
  await page.evaluate(() => GymNotifications.refresh());
  await expect(page.locator("#tbBellBadge")).toHaveText("2");
  expect(await cls()).toEqual({ pop: true, swing: true });
  await page.evaluate(() => { document.getElementById("tbBellBadge").classList.remove("m-pop"); document.getElementById("tbBell").classList.remove("m-swing"); });
  state.n = 1;
  await page.evaluate(() => GymNotifications.refresh());
  await expect(page.locator("#tbBellBadge")).toHaveText("1");
  expect(await cls()).toEqual({ pop: false, swing: false });
  await context.close();
});

async function openFood(browser, meals, motion) {
  const { context, page } = await openApp(browser, { signedIn: true, ls: { gymcoach_last: TARGET } });
  if (motion) await page.emulateMedia({ reducedMotion: motion });
  const store = { meals };
  await page.route((u) => u.pathname.endsWith("/api/v1/meals") || u.pathname.includes("/api/v1/meals/"), (route) => {
    const req = route.request();
    if (req.method() === "DELETE") {
      const id = new URL(req.url()).pathname.split("/").pop();
      store.meals = store.meals.filter((m) => m.id !== id);
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ meals: store.meals }) });
  });
  await page.click('#appNav button[data-tab="food"]');
  await expect(page.locator("#foodMealsHost .food-error")).toBeVisible({ timeout: 10000 });
  await page.click('#appNav button[data-tab="food"]');
  await expect(page.locator("#foodMealsHost .food-meal-row")).toHaveCount(meals.length);
  return { context, page, store };
}

for (const motion of [null, "reduce"]) {
  test(`deleting a meal removes only that row (${motion || "motion"})`, async ({ browser }) => {
    const { context, page } = await openFood(browser, [meal("a"), meal("b"), meal("c")], motion);
    await page.evaluate(() => {
      document.querySelectorAll(".food-meal-row").forEach((r) => { r.__keep = r.getAttribute("data-id"); });
      window.__wrap = document.querySelector(".food-meal-groups");
    });
    await page.click('.food-meal-row[data-id="b"] .food-del-btn');
    await expect(page.locator('.food-meal-row[data-id="b"]')).toHaveCount(0);
    const kept = await page.evaluate(() => ({
      same: document.querySelector(".food-meal-groups") === window.__wrap,
      ids: [...document.querySelectorAll(".food-meal-row")].map((r) => r.__keep)
    }));
    expect(kept).toEqual({ same: true, ids: ["a", "c"] });
    await expect(page.locator("#foodMealsHost")).toBeFocused();
    await context.close();
  });
}

test("a deleted row animates out before it is removed", async ({ browser }) => {
  const { context, page } = await openFood(browser, [meal("a"), meal("b")]);
  await page.evaluate(() => {
    // hold the row long enough to observe the out class
    document.documentElement.style.setProperty("--dur-med", "600ms");
  });
  await page.click('.food-meal-row[data-id="a"] .food-del-btn');
  await expect(page.locator('.food-meal-row[data-id="a"]')).toHaveClass(/m-row-out/);
  await expect(page.locator('.food-meal-row[data-id="a"]')).toHaveCount(0);
  await context.close();
});

test("adding a meal inserts one animated row; others keep their nodes", async ({ browser }) => {
  const { context, page } = await openFood(browser, [meal("a"), meal("b")]);
  await page.evaluate(() => {
    document.querySelectorAll(".food-meal-row").forEach((r) => { r.__keep = r.getAttribute("data-id"); });
  });
  await page.route((u) => u.pathname.endsWith("/api/v1/foods"), (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ foods: [{ id: "f1", name: "Rice", per100g: { kcal: 130, protein: 3, carbs: 28, fat: 0 } }] })
  }));
  await page.route((u) => u.pathname.endsWith("/api/v1/meals"), (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(meal("n", "dinner")) });
  });
  await page.fill("#foodSearchInput", "rice");
  await page.clock.runFor(1000);
  await page.locator(".food-result-row").first().click();
  await page.locator(".food-add-panel .coach-primary").click();
  await expect(page.locator('.food-meal-row[data-id="n"]')).toHaveCount(1);
  const ids = await page.evaluate(() => [...document.querySelectorAll(".food-meal-row")].map((r) => r.__keep || "new"));
  expect(ids.sort()).toEqual(["a", "b", "new"]);
  expect(await page.locator('.food-meal-group[data-type="dinner"] .food-meal-row[data-id="n"]').count()).toBe(1);
  await context.close();
});
