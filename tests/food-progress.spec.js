const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { openApp } = require("./helpers");

test.setTimeout(45000);

const SHOTS = process.env.SHOT_DIR;
const TARGET = { computed: { targetKcal: 2000, proteinG: 150 } };
const meal = (id, kcal, protein) => ({ id, mealType: "lunch", foodName: "Food " + id, grams: 100, nutrients: { kcal, protein, carbs: 10, fat: 5 }, date: "2026-10-02" });

async function openFood(opts, meals) {
  const { browser, lang, theme, viewport, motion } = opts;
  const { context, page } = await openApp(browser, { signedIn: true, lang, theme, viewport, ls: { gymcoach_last: TARGET } });
  if (motion) await page.emulateMedia({ reducedMotion: motion });
  const store = { meals };
  await page.route((u) => u.pathname.endsWith("/api/v1/meals") || u.pathname.includes("/api/v1/meals/"),(route) => {
    const req = route.request();
    if (req.method() === "DELETE") {
      const id = new URL(req.url()).pathname.split("/").pop();
      store.meals = store.meals.filter((m) => m.id !== id);
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ meals: store.meals }) });
  });
  // the boot-time meals load ran before the mock existed and failed; re-tapping the active Food tab retries it
  await page.click('#appNav button[data-tab="food"]');
  await expect(page.locator("#foodMealsHost .food-error")).toBeVisible({ timeout: 10000 });
  await page.click('#appNav button[data-tab="food"]');
  await expect(page.locator("#foodMealsHost .food-error")).toHaveCount(0);
  await expect(page.locator(".food-progress")).toBeVisible();
  return { context, page, store };
}

const bar = (page) => page.locator(".food-progress-track").first();

test("under target: accent fill, progressbar semantics", async ({ browser }) => {
  const { context, page } = await openFood({ browser, motion: "reduce" }, [meal("a", 600, 40)]);
  await expect(page.locator(".food-progress")).toHaveAttribute("data-state", "under");
  await expect(bar(page)).toHaveAttribute("role", "progressbar");
  await expect(bar(page)).toHaveAttribute("aria-valuemin", "0");
  await expect(bar(page)).toHaveAttribute("aria-valuemax", "2000");
  await expect(bar(page)).toHaveAttribute("aria-valuenow", "600");
  await expect(page.locator(".food-progress-num")).toHaveText("600");
  await expect(page.locator(".food-progress-over")).toBeHidden();
  const p = await bar(page).locator(".food-progress-fill").evaluate((f) => f.style.getPropertyValue("--p"));
  expect(Number(p)).toBeCloseTo(0.3, 2);
  await expect(page.locator(".food-progress-prot .food-progress-track")).toHaveAttribute("aria-valuemax", "150");
  await expect(page.locator(".food-progress-pnum")).toHaveText("40");
  await context.close();
});

test("near target (>=90%) turns success, over turns warm with +X kcal over", async ({ browser }) => {
  const near = await openFood({ browser, motion: "reduce" }, [meal("a", 1900, 120)]);
  await expect(near.page.locator(".food-progress")).toHaveAttribute("data-state", "near");
  await near.context.close();
  const over = await openFood({ browser, motion: "reduce" }, [meal("a", 2000, 100), meal("b", 350, 20)]);
  await expect(over.page.locator(".food-progress")).toHaveAttribute("data-state", "over");
  await expect(over.page.locator(".food-progress-over")).toHaveText("+350 kcal over");
  await expect(bar(over.page)).toHaveAttribute("aria-valuenow", "2350");
  await over.context.close();
});

test("removing food updates the same bar: state, value and over label", async ({ browser }) => {
  const { context, page } = await openFood({ browser, motion: "reduce" }, [meal("a", 2000, 100), meal("b", 350, 20)]);
  await expect(page.locator(".food-progress")).toHaveAttribute("data-state", "over");
  await page.evaluate(() => { window.__bar = document.querySelector(".food-progress"); });
  await page.locator(".food-del-btn").last().click();
  await expect(page.locator(".food-progress")).toHaveAttribute("data-state", "near");
  await expect(page.locator(".food-progress-num")).toHaveText("2000");
  expect(await page.evaluate(() => window.__bar === document.querySelector(".food-progress"))).toBe(true); // same node, so the fill can slide
  await context.close();
});

test("with motion, the number counts up and the fill transitions", async ({ browser }) => {
  const { context, page } = await openFood({ browser, motion: "no-preference" }, [meal("a", 1500, 100)]);
  const tr = await page.locator(".food-progress-fill").first().evaluate((f) => getComputedStyle(f).transitionDuration);
  expect(tr).not.toBe("0s");
  await page.clock.runFor(1500); // openApp installs a fake clock, so rAF only ticks when told to
  await expect(page.locator(".food-progress-num")).toHaveText("1500");
  await context.close();
});

test("reduced motion: no transition", async ({ browser }) => {
  const { context, page } = await openFood({ browser, motion: "reduce" }, [meal("a", 1500, 100)]);
  const tr = await page.locator(".food-progress-fill").first().evaluate((f) => getComputedStyle(f).transitionDuration);
  expect(parseFloat(tr)).toBeLessThan(0.01);
  await context.close();
});

if (SHOTS) {
  for (const [name, meals] of [["under", [meal("a", 800, 50)]], ["near", [meal("a", 1850, 120)]], ["over", [meal("a", 2000, 100), meal("b", 350, 20)]]]) {
    for (const theme of ["dark", "light"]) {
      test(`screenshot food ${name} ${theme}`, async ({ browser }) => {
        const { context, page } = await openFood({ browser, motion: "reduce", theme }, meals);
        expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
        expect(await page.evaluate(() => window.innerWidth)).toBe(390);
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.locator(".food-totals").screenshot({ path: path.join(SHOTS, `food-bar-${name}-${theme}.png`) });
        await context.close();
      });
    }
  }
}
