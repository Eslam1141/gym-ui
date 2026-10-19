// Landing header and CTAs reflect the locally stored auth status (boot.js sets
// auth-signed / auth-guest on <html>). The route table recreates the deployed
// layout: / = landing/, /app/* = app files.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test.setTimeout(45000);
const ROOT = path.join(__dirname, "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg" };

async function open(browser, o) {
  o = o || {};
  const context = await browser.newContext({ viewport: { width: o.width || 390, height: 844 }, serviceWorkers: "block" });
  await context.addInitScript((o) => {
    try {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("gym_lang", o.lang || "en");
      if (o.sub) localStorage.setItem("gym_user_sub", "u1");
      if (o.anon) localStorage.setItem("gym_anon", "1");
      if (o.email) localStorage.setItem("gymauth_email", o.email);
    } catch (e) {}
  }, o);
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== "127.0.0.1" || u.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "{}" });
    const p = u.pathname;
    let file;
    if (p === "/app" || p === "/app/") file = path.join(ROOT, "index.html");
    else if (p.startsWith("/app/")) file = path.join(ROOT, p.slice(5));
    else file = path.join(ROOT, "landing", p === "/" ? "index.html" : p.slice(1));
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, p.slice(1));
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  const page = await context.newPage();
  await page.goto("/?home");
  await page.waitForLoadState("load");
  return { context, page };
}

const nav = (p) => p.locator(".nav-end");
const heroCta = (p) => p.locator(".hero .btn-primary");
const finalCta = (p) => p.locator(".final .btn-primary");
const avatarContent = (p) => p.evaluate(() => getComputedStyle(document.querySelector(".auth-av"), "::before").content);

test("new visitor: Sign in and Start free, unchanged", async ({ browser }) => {
  const { context, page } = await open(browser);
  await expect(nav(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "Open app" })).toHaveCount(0);
  await expect(heroCta(page)).toHaveText("Start free", { useInnerText: true });
  await expect(finalCta(page)).toHaveText("Start free", { useInnerText: true });
  await context.close();
});

test("signed in: chip with Open app, no Sign in, CTAs say Open app", async ({ browser }) => {
  const { context, page } = await open(browser, { sub: true, email: "sam@example.com" });
  await expect(nav(page).getByRole("link", { name: "Open app" })).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await expect(page.locator(".auth-av")).toBeVisible();
  expect(await avatarContent(page)).toBe('"S"');
  expect((await page.locator(".auth-main").boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(page.locator(".auth-main")).toHaveAttribute("href", "/app/");
  await expect(heroCta(page)).toHaveText("Open app", { useInnerText: true });
  await expect(finalCta(page)).toHaveText("Open app", { useInnerText: true });
  await context.close();
});

test("signed in without a stored email: generic avatar, no letter", async ({ browser }) => {
  const { context, page } = await open(browser, { sub: true });
  expect(await avatarContent(page)).toBe('""');
  await expect(page.locator(".auth-av")).toBeVisible();
  await context.close();
});

test("guest: Open app plus Sign in, CTAs say Continue", async ({ browser }) => {
  const { context, page } = await open(browser, { anon: true });
  await expect(nav(page).getByRole("link", { name: "Open app" })).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.locator(".auth-av")).toBeHidden();
  await expect(heroCta(page)).toHaveText("Continue", { useInnerText: true });
  await expect(finalCta(page)).toHaveText("Continue", { useInnerText: true });
  await context.close();
});

test("Arabic: signed in and guest strings, RTL", async ({ browser }) => {
  let r = await open(browser, { lang: "ar", sub: true });
  await expect(r.page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(nav(r.page).getByRole("link", { name: "افتح التطبيق" })).toBeVisible();
  await expect(nav(r.page).getByRole("link", { name: "تسجيل الدخول" })).toHaveCount(0);
  await expect(heroCta(r.page)).toHaveText("افتح التطبيق", { useInnerText: true });
  await r.context.close();
  r = await open(browser, { lang: "ar", anon: true });
  await expect(nav(r.page).getByRole("link", { name: "افتح التطبيق" })).toBeVisible();
  await expect(nav(r.page).getByRole("link", { name: "تسجيل الدخول" })).toBeVisible();
  await expect(heroCta(r.page)).toHaveText("تابع", { useInnerText: true });
  await r.context.close();
});

test("language toggle keeps the signed-in labels", async ({ browser }) => {
  const { context, page } = await open(browser, { sub: true });
  await page.click("#langBtn");
  await expect(heroCta(page)).toHaveText("افتح التطبيق", { useInnerText: true });
  await expect(nav(page).getByRole("link", { name: "افتح التطبيق" })).toBeVisible();
  await context.close();
});

test("pageshow (bfcache restore) re-evaluates after sign-in and sign-out", async ({ browser }) => {
  const { context, page } = await open(browser);
  await expect(heroCta(page)).toHaveText("Start free", { useInnerText: true });
  const restore = () => page.evaluate(() => {
    const e = new Event("pageshow"); e.persisted = true; window.dispatchEvent(e);
  });
  await page.evaluate(() => localStorage.setItem("gym_user_sub", "u1"));
  await restore();
  await expect(heroCta(page)).toHaveText("Open app", { useInnerText: true });
  await expect(nav(page).getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await page.evaluate(() => { localStorage.removeItem("gym_user_sub"); localStorage.setItem("gym_anon", "1"); });
  await restore();
  await expect(heroCta(page)).toHaveText("Continue", { useInnerText: true });
  await page.evaluate(() => localStorage.removeItem("gym_anon"));
  await restore();
  await expect(heroCta(page)).toHaveText("Start free", { useInnerText: true });
  await expect(nav(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  await context.close();
});

test("back from the app shows the new status", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.evaluate(() => localStorage.setItem("gym_user_sub", "u1"));
  await page.goto("/app/");
  await page.goBack();
  await page.waitForLoadState("load");
  await expect(heroCta(page)).toHaveText("Open app", { useInnerText: true });
  await context.close();
});

test("no flash: status class is set before first paint", async ({ browser }) => {
  const { context, page } = await open(browser, { sub: true });
  // The head script must have set the class by every readystatechange.
  await page.addInitScript(() => {
    window.__seen = [];
    document.addEventListener("readystatechange", () => window.__seen.push(document.documentElement.className));
  });
  await page.reload();
  await page.waitForLoadState("load");
  const seen = await page.evaluate(() => window.__seen);
  expect(seen.length).toBeGreaterThan(0);
  for (const s of seen) expect(s).toContain("auth-signed");
  await context.close();
});

test("no horizontal overflow at 360px for guest, EN and AR", async ({ browser }) => {
  for (const lang of ["en", "ar"]) {
    const { context, page } = await open(browser, { lang, anon: true, width: 360 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await context.close();
  }
});
