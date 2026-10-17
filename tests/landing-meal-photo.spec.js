// The landing advertises the AI coach meal-photo feature: a highlight card in
// the features grid with an illustrative estimate, in English and Arabic.
// Routes serve landing/ at "/" so the test does not depend on the server root.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test.setTimeout(45000);
const ROOT = path.join(__dirname, "..", "landing");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg" };

async function openLanding(browser, lang, width, reduce) {
  const context = await browser.newContext({
    viewport: { width: width || 390, height: 844 }, serviceWorkers: "block",
    reducedMotion: reduce ? "reduce" : "no-preference"
  });
  await context.addInitScript((l) => { try { localStorage.setItem("gym_lang", l); } catch (e) {} }, lang);
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== "127.0.0.1") return route.fulfill({ status: 404, body: "" });
    const file = path.join(ROOT, u.pathname === "/" ? "index.html" : u.pathname.slice(1));
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/?home");
  await page.waitForFunction(() => !document.documentElement.classList.contains("pending"));
  return { context, page, errors };
}

const COPY = {
  en: { dir: "ltr", h: "Snap your meal, see the calories", badge: "New", left: "310 kcal left", add: "Add to food log" },
  ar: { dir: "rtl", h: "صوّر أكلك واعرف سعراته", badge: "جديد", left: "باقي 310 سعرة", add: "أضف لسجل الأكل" }
};

for (const lang of ["en", "ar"]) {
  test(`landing: meal-photo card renders in ${lang}`, async ({ browser }) => {
    const { context, page, errors } = await openLanding(browser, lang);
    const c = COPY[lang];
    await expect(page.locator("html")).toHaveAttribute("dir", c.dir);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    const card = page.locator("#features .cell-photo");
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator("h3")).toHaveText(c.h);
    await expect(card.locator(".new")).toHaveText(c.badge);
    await expect(card.locator(".scan-fit span").last()).toHaveText(c.left);
    await expect(card.locator(".scan-add")).toHaveText(c.add);
    await expect(card.locator(".scan")).toHaveAttribute("role", "img");
    expect(await card.locator(".scan").getAttribute("aria-label")).toContain("640");
    // Copy promises estimates and never mentions a limit.
    const text = (await card.innerText()).toLowerCase();
    expect(text).not.toMatch(/limit|حد يومي/);
    // No horizontal scroll at phone width.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test("landing: meal-photo card stays visible with reduced motion and at desktop width", async ({ browser }) => {
  const { context, page } = await openLanding(browser, "en", 1280, true);
  const card = page.locator("#features .cell-photo");
  await expect(card).toBeVisible();
  await expect(card.locator(".scan")).toBeVisible();
  const [t, s] = await Promise.all([card.locator(".cell-text").boundingBox(), card.locator(".scan").boundingBox()]);
  expect(t.x).toBeLessThan(s.x);
  await context.close();
});
