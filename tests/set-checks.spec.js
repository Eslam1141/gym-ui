const { test, expect } = require("@playwright/test");
const { openApp, TODAY } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };
const firstCard = (page) => page.locator("#exList .ex-card").first();
const sets = (page) => firstCard(page).locator(".set-chk");

async function tickAll(page) {
  const n = await sets(page).count();
  for (let i = 0; i < n; i++) await sets(page).nth(i).click();
  return n;
}

test.describe("per-set checkboxes", () => {
  test("each set is a 44px+ checkbox with a rep label", async ({ browser }) => {
    const { context, page, consoleErrors } = await openApp(browser, { signedIn: true });
    await expect(firstCard(page)).toBeVisible(T);
    const n = await sets(page).count();
    expect(n).toBeGreaterThanOrEqual(2);
    await expect(sets(page).first()).toHaveAttribute("role", "checkbox");
    await expect(sets(page).first()).toHaveText(/Set 1 · ⁦\d+(-\d+)?⁩ reps/);
    const box = await sets(page).first().boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(consoleErrors.filter((e) => !/404/.test(e))).toEqual([]);
    await context.close();
  });

  test("tick all sets marks the exercise done; unticking one undoes it", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    const n = await tickAll(page);
    await expect(firstCard(page)).toHaveClass(/done/);
    await expect(firstCard(page).locator(".check")).toHaveClass(/on/);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("gym_checks")));
    const key = Object.keys(stored).find((k) => k.startsWith(TODAY + "_"));
    expect(Object.values(stored[key]).filter(Boolean)).toHaveLength(1);
    await sets(page).nth(n - 1).click();
    await expect(firstCard(page)).not.toHaveClass(/done/);
    await expect(firstCard(page).locator(".check")).not.toHaveClass(/on/);
    await context.close();
  });

  test("the big checkbox ticks every set", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await firstCard(page).locator(".check").click();
    await expect(firstCard(page).locator(".set-chk.on")).toHaveCount(await sets(page).count());
    await firstCard(page).locator(".check").click();
    await expect(firstCard(page).locator(".set-chk.on")).toHaveCount(0);
    await context.close();
  });

  test("partial ticks survive a reload", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await sets(page).nth(0).click();
    await sets(page).nth(1).click();
    await page.reload();
    await expect(firstCard(page)).toBeVisible(T);
    await expect(sets(page).nth(0)).toHaveAttribute("aria-checked", "true");
    await expect(sets(page).nth(1)).toHaveAttribute("aria-checked", "true");
    await expect(firstCard(page).locator(".set-chk.on")).toHaveCount(2);
    const raw = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("gym_setchecks"))));
    expect(raw[0]).toMatch(new RegExp("^" + TODAY + "_"));
    await context.close();
  });

  test("a new day starts with no sets ticked", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await tickAll(page);
    await page.clock.setSystemTime(new Date("2026-10-05T07:00:00Z")); // Monday
    await page.reload();
    await expect(page.locator("#exList .ex-card").first()).toBeAttached(T);
    await expect(page.locator(".set-chk.on")).toHaveCount(0);
    await expect(page.locator(".ex-card.done")).toHaveCount(0);
    await context.close();
  });

  test("reset checklist clears the sets too", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await tickAll(page);
    await page.locator("#resetLink").click();
    await expect(page.locator(".set-chk.on")).toHaveCount(0);
    await context.close();
  });

  test("Arabic labels, RTL, timed exercises show seconds", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, lang: "ar", plan: "female" });
    await expect(firstCard(page)).toBeVisible(T);
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
    await expect(sets(page).first()).toHaveText(/المجموعة 1 · /);
    const lbl = await page.evaluate(() => [setLabel({ sets: 3, reps: "30-45s" }, 2), setLabel({ sets: 3, reps: "12" }, 1)]);
    expect(lbl).toEqual(["المجموعة 2 · ⁦30-45⁩ ث", "المجموعة 1 · ⁦12⁩ تكرار"]);
    await context.close();
  });
});
