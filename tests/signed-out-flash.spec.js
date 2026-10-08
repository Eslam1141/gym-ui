const { test, expect } = require("@playwright/test");

test.setTimeout(45000);

// What the page shows at the last moment before ui.js's boot() runs
// (readyState "interactive" fires just before DOMContentLoaded handlers).
async function firstPaint(browser, seed) {
  const context = await browser.newContext({
    ...(process.env.PW_BASE ? { baseURL: process.env.PW_BASE } : {}), serviceWorkers: "block"
  });
  await context.addInitScript((seed) => {
    if (!sessionStorage.getItem("__seeded")) {
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("gym_onboarded", "1");
      localStorage.setItem("gym_tab", "food");
      Object.keys(seed.ls || {}).forEach((k) => localStorage.setItem(k, seed.ls[k]));
      if (seed.session) sessionStorage.setItem("gymauth_session", JSON.stringify({
        token: "t", exp: Math.floor(Date.now() / 1000) + 3000, source: "local", profile: { email: "a@b.c" } }));
    }
    document.addEventListener("readystatechange", () => {
      if (document.readyState !== "interactive") return;
      const scr = document.getElementById("screen-food");
      window.__early = scr && !scr.hidden && getComputedStyle(scr).visibility !== "hidden";
    });
  }, seed);
  await context.route("**/api/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  const page = await context.newPage();
  await page.goto("/index.html");
  await page.waitForFunction(() => window.GymUI);
  return { context, page, early: await page.evaluate(() => window.__early) };
}

test("signed out: a refresh doesn't flash the cached app screen before the login", async ({ browser }) => {
  const { context, page, early } = await firstPaint(browser, {});
  expect(early).toBe(false);
  await expect(page.locator("#onboarding")).toBeVisible();
  await context.close();
});

test("signed in: the cached tab still paints immediately", async ({ browser }) => {
  const { context, page, early } = await firstPaint(browser, { session: true });
  expect(early).toBe(true);
  await expect(page.locator("#screen-food")).toBeVisible();
  await context.close();
});

test("anon preview: the cached tab still paints immediately", async ({ browser }) => {
  const { context, page, early } = await firstPaint(browser, { ls: { gym_anon: "1" } });
  expect(early).toBe(true);
  await expect(page.locator("#screen-food")).toBeVisible();
  await context.close();
});
