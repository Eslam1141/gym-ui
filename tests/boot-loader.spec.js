const { test, expect } = require("@playwright/test");

test.setTimeout(45000);

async function open(browser, seed, initExtra) {
  const context = await browser.newContext({
    ...(process.env.PW_BASE ? { baseURL: process.env.PW_BASE } : {}), serviceWorkers: "block"
  });
  await context.addInitScript((seed) => {
    if (!sessionStorage.getItem("__seeded")) {
      sessionStorage.setItem("__seeded", "1");
      Object.keys(seed.ls || {}).forEach((k) => localStorage.setItem(k, seed.ls[k]));
    }
    // What the page shows when the parser reaches the end of <body>.
    document.addEventListener("readystatechange", () => {
      if (document.readyState !== "interactive") return;
      const el = document.getElementById("bootLoader");
      window.__early = !!el && !el.hidden && getComputedStyle(el).opacity === "1";
    });
  }, seed);
  if (initExtra) await context.addInitScript(initExtra);
  await context.route("**/api/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  const page = await context.newPage();
  await page.goto("/index.html");
  await page.waitForFunction(() => window.GymUI && window.GymBoot);
  return { context, page };
}

test("cold start: the logo loader covers the first paint, then leaves for the login", async ({ browser }) => {
  const { context, page } = await open(browser, {});
  expect(await page.evaluate(() => window.__early)).toBe(true);
  await expect(page.locator("#bootLoader")).toBeHidden({ timeout: 5000 });
  await expect(page.locator("#onboarding")).toBeVisible();
  await context.close();
});

test("anon preview: the loader leaves for the cached app", async ({ browser }) => {
  const { context, page } = await open(browser, { ls: { gym_anon: "1", gym_onboarded: "1" } });
  await expect(page.locator("#bootLoader")).toBeHidden({ timeout: 5000 });
  await expect(page.locator("#screen-plan")).toBeVisible();
  await context.close();
});

test("sign-in hold: the loader comes back with a caption and stays until released", async ({ browser }) => {
  const { context, page } = await open(browser, { ls: { gym_anon: "1", gym_onboarded: "1", gym_lang: "ar" } });
  await expect(page.locator("#bootLoader")).toBeHidden({ timeout: 5000 });
  await page.evaluate(() => GymBoot.hold("signin", 20000));
  const loader = page.locator("#bootLoader");
  await expect(loader).toBeVisible();
  await expect(loader.locator(".bl-caption")).toHaveText("جارٍ تسجيل الدخول…");
  await page.waitForTimeout(1500);
  await expect(loader).toBeVisible();
  await page.evaluate(() => GymBoot.release("signin"));
  await expect(loader).toBeHidden({ timeout: 3000 });
  await context.close();
});

test("a hold never outlives its cap", async ({ browser }) => {
  const { context, page } = await open(browser, { ls: { gym_anon: "1", gym_onboarded: "1" } });
  await expect(page.locator("#bootLoader")).toBeHidden({ timeout: 5000 });
  await page.evaluate(() => GymBoot.hold("signin", 800));
  await expect(page.locator("#bootLoader")).toBeVisible();
  await expect(page.locator("#bootLoader")).toBeHidden({ timeout: 3000 });
  await context.close();
});

test("native app: hands over from the Capacitor splash once the loader has painted", async ({ browser }) => {
  const { context, page } = await open(browser, {}, () => {
    window.__splashHidden = 0;
    window.Capacitor = { Plugins: { SplashScreen: { hide: () => { window.__splashHidden++; } } } };
  });
  await page.waitForFunction(() => window.__splashHidden > 0);
  expect(await page.evaluate(() => window.__splashHidden)).toBe(1);
  await context.close();
});
