const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);

const TARGET = { computed: { targetKcal: 2000, proteinG: 150 } };
const TODAY = "2026-10-02";
const RICE = { id: "f_rice", nameEn: "Rice", nameAr: "أرز", per100g: { kcal: 130 }, serving: { grams: 150, labelEn: "1 cup", labelAr: "كوب" } };
const NOAR = { id: "f_oats", nameEn: "Oats", per100g: { kcal: 380 } };
const NOEN = { id: "f_koshari", nameAr: "كشري", per100g: { kcal: 180 } };
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function openSearch({ browser, lang = "en", theme = "dark", foods = [RICE], shots }) {
  const { context, page } = await openApp(browser, { signedIn: true, lang, theme, ls: { gymcoach_last: TARGET } });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls = { posts: [] };
  await page.route((u) => u.pathname.endsWith("/api/v1/meals"), (route) => {
    if (route.request().method() === "POST") {
      calls.posts.push(JSON.parse(route.request().postData()));
      return json(route, 201, { id: "m1", mealType: "lunch", foodId: "f_rice", nameEn: "Rice", nameAr: "أرز", grams: 150, nutrients: { kcal: 195 }, date: TODAY });
    }
    return json(route, 200, { meals: [] });
  });
  await page.route((u) => u.pathname.endsWith("/api/v1/foods"), (route) => json(route, 200, { foods }));
  await page.click('#appNav button[data-tab="food"]');
  await page.click('#appNav button[data-tab="food"]');
  await expect(page.locator("#foodSearchInput")).toBeVisible();
  return { context, page, calls };
}
async function search(page, q) {
  await page.fill("#foodSearchInput", q);
  await page.clock.runFor(1000);
  await expect(page.locator(".food-result-row").first()).toBeVisible();
}
const name = (page) => page.locator(".food-result-name").first();
const sub = (page) => page.locator(".food-result-sub").first();

test("Arabic query in the EN app: Arabic main name, English subtitle, each with its own lang/dir", async ({ browser }) => {
  const { context, page } = await openSearch({ browser, lang: "en" });
  await search(page, "أرز");
  await expect(name(page)).toHaveText("أرز");
  await expect(name(page)).toHaveAttribute("lang", "ar");
  await expect(name(page)).toHaveAttribute("dir", "rtl");
  await expect(sub(page)).toHaveText("Rice");
  await expect(sub(page)).toHaveAttribute("lang", "en");
  await expect(sub(page)).toHaveAttribute("dir", "ltr");
  await expect(page.locator(".food-result-meta").first()).toContainText("كوب");
  await context.close();
});

test("Latin query in the AR app: English main name, Arabic subtitle", async ({ browser }) => {
  const { context, page } = await openSearch({ browser, lang: "ar", theme: "light" });
  await search(page, "rice");
  await expect(name(page)).toHaveText("Rice");
  await expect(name(page)).toHaveAttribute("lang", "en");
  await expect(name(page)).toHaveAttribute("dir", "ltr");
  await expect(sub(page)).toHaveText("أرز");
  await expect(sub(page)).toHaveAttribute("lang", "ar");
  await expect(sub(page)).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".food-result-meta").first()).toContainText("1 cup");
  await context.close();
});

test("digits-only query follows the app language", async ({ browser }) => {
  for (const [lang, main, other] of [["en", "Rice", "أرز"], ["ar", "أرز", "Rice"]]) {
    const { context, page } = await openSearch({ browser, lang });
    await search(page, "100");
    await expect(name(page)).toHaveText(main);
    await expect(sub(page)).toHaveText(other);
    await context.close();
  }
});

test("mixed scripts: majority wins, a tie follows the app language", async ({ browser }) => {
  const a = await openSearch({ browser, lang: "en" });
  await search(a.page, "أرز rice بسمتي");
  await expect(name(a.page)).toHaveText("أرز");
  await a.context.close();
  const b = await openSearch({ browser, lang: "ar" });
  await search(b.page, "rice أرز بسمتي white");
  await expect(name(b.page)).toHaveText("Rice");
  await b.context.close();
  const c = await openSearch({ browser, lang: "ar" });
  await search(c.page, "ab أر");
  await expect(name(c.page)).toHaveText("أرز");
  await c.context.close();
});

test("a missing name falls back to the other language with no empty subtitle", async ({ browser }) => {
  const { context, page } = await openSearch({ browser, lang: "en", foods: [NOAR, NOEN] });
  await search(page, "أر");
  await expect(page.locator(".food-result-name")).toHaveText(["Oats", "كشري"]);
  await expect(page.locator(".food-result-name").first()).toHaveAttribute("lang", "en");
  await expect(page.locator(".food-result-sub")).toHaveCount(0);
  await context.close();
});

test("the logged row keeps the app language and the POST is unchanged", async ({ browser }) => {
  const { context, page, calls } = await openSearch({ browser, lang: "en" });
  await search(page, "أرز");
  await page.locator(".food-result-row").first().click();
  await page.locator("#foodSearchResultsHost button", { hasText: /^Add$/ }).click();
  await expect(page.locator(".food-meal-name")).toHaveText("Rice");
  expect(calls.posts).toHaveLength(1);
  expect(Object.keys(calls.posts[0]).sort()).toEqual(["date", "foodId", "grams", "mealType"]);
  expect(calls.posts[0].foodId).toBe("f_rice");
  await context.close();
});

test("screenshots", async ({ browser }) => {
  test.skip(!process.env.SHOT_DIR, "SHOT_DIR not set");
  for (const [lang, q, theme] of [["en", "أرز", "light"], ["en", "أرز", "dark"], ["ar", "rice", "light"], ["ar", "rice", "dark"]]) {
    const { context, page } = await openSearch({ browser, lang, theme });
    await page.setViewportSize({ width: 360, height: 700 });
    await search(page, q);
    expect(await page.evaluate(() => document.documentElement.lang + document.documentElement.dir + document.documentElement.getAttribute("data-theme")))
      .toContain(lang);
    await page.locator("#foodSearchInput").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.SHOT_DIR}/${lang}-app-${q === "rice" ? "latin" : "arabic"}-query-${theme}.png` });
    await context.close();
  }
});
