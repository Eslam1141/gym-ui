// The app logo links back to the landing page (/?home) on the web, and is a
// plain image in the Android app. The test server serves the repo root, so a
// route table recreates the deployed layout: /app/* = app files, / = landing/.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test.setTimeout(45000);
const ROOT = path.join(__dirname, "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg" };

async function open(browser, o) {
  o = o || {};
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await context.addInitScript((o) => {
    try {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("gym_lang", o.lang || "en");
      localStorage.setItem("gym_theme", o.theme || "dark");
      localStorage.setItem("gym_onboarded", "1"); localStorage.setItem("gym_terms_ok", "terms.v2");
      localStorage.setItem("gym_anon", "1");
    } catch (e) {}
    if (o.native) window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", Plugins: {} };
  }, o);
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith("/api/") || u.hostname !== "127.0.0.1") return route.fulfill({ status: 404, body: "{}" });
    let p = u.pathname;
    let file;
    if (p === "/app" || p === "/app/") file = path.join(ROOT, "index.html");
    else if (p.startsWith("/app/")) file = path.join(ROOT, p.slice(5));
    else file = path.join(ROOT, "landing", p === "/" ? "index.html" : p.slice(1));
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, p.slice(1));
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  const page = await context.newPage();
  await page.goto("/app/");
  await page.waitForFunction(() => window.GymRest && window.GymDate, null, { timeout: 15000 });
  return { context, page };
}

test("web: Plan logo is a link to /?home and shows the landing for a guest", async ({ browser }) => {
  const { context, page } = await open(browser);
  const link = page.locator("#screen-plan a.home-link");
  await expect(link).toHaveAttribute("href", "/?home");
  await expect(link).toHaveAccessibleName("Etqadem home");
  expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await link.click();
  await page.waitForURL("**/?home");
  await page.waitForTimeout(500);
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.locator('a[href="/app/"]').first()).toBeVisible();
  await context.close();
});

test("web: More logo is a link to /?home (Arabic name)", async ({ browser }) => {
  const { context, page } = await open(browser, { lang: "ar" });
  await page.click('#appNav [data-tab="more"]');
  const link = page.locator("#screen-more a.home-link");
  await expect(link).toHaveAttribute("href", "/?home");
  await expect(link).toHaveAccessibleName("الصفحة الرئيسية لاتقدم");
  await link.click();
  await page.waitForURL("**/?home");
  await page.waitForTimeout(500);
  expect(new URL(page.url()).pathname).toBe("/");
  await context.close();
});

test("native: logo is not a link", async ({ browser }) => {
  const { context, page } = await open(browser, { native: true });
  await expect(page.locator("a.home-link")).toHaveCount(0);
  await expect(page.locator("#screen-plan img.hero-logo")).toBeVisible();
  await page.click('#appNav [data-tab="more"]');
  await expect(page.locator("#screen-more a.home-link")).toHaveCount(0);
  await expect(page.locator("#screen-more img.hero-logo")).toBeVisible();
  await context.close();
});

test("landing: Start free from ?home goes back to /app/", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.goto("/?home");
  await page.waitForTimeout(400);
  expect(new URL(page.url()).pathname).toBe("/");
  await page.locator('a.btn-primary[href="/app/"]').first().click();
  await page.waitForURL("**/app/");
  await expect(page.locator("#appNav")).toBeVisible();
  await context.close();
});
