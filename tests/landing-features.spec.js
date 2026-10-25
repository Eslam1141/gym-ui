// The landing advertises training splits, the weekly muscle map, exercise
// videos, the rest timer, the coach bubble and the Watch tab, in English and
// Arabic. Routes serve landing/ at "/" so the test does not depend on the server root.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test.setTimeout(45000);
const ROOT = path.join(__dirname, "..", "landing");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg" };

async function openLanding(browser, lang, width) {
  const context = await browser.newContext({ viewport: { width: width || 390, height: 844 }, serviceWorkers: "block" });
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
  en: { dir: "ltr", splits: "A split built around your equipment", map: "See which muscles you trained",
    bubble: "Etqadem Coach, on every screen", watch: "Your watch, in the Watch tab", watchP: /Android app only/, desc: /training splits/ },
  ar: { dir: "rtl", splits: "تقسيمة تتبنى على معداتك", map: "شوف أي عضلات تمرّنت",
    bubble: "المدرّب اتقدم في كل شاشة", watch: "ساعتك في تبويب ساعتي", watchP: /أندرويد فقط/, desc: /تقسيمات تمرين/ }
};

for (const lang of ["en", "ar"]) {
  for (const width of [360, 1280]) {
    test(`landing: new feature cards render in ${lang} at ${width}px`, async ({ browser }) => {
      const { context, page, errors } = await openLanding(browser, lang, width);
      const c = COPY[lang];
      await expect(page.locator("html")).toHaveAttribute("dir", c.dir);
      for (const [sel, h] of [[".cell-splits", c.splits], [".cell-map", c.map], [".cell-bubble", c.bubble], [".cell-watch", c.watch]]) {
        const card = page.locator("#features " + sel);
        await card.scrollIntoViewIfNeeded();
        await expect(card.locator("h3")).toHaveText(h);
        await expect(card.locator("[role=img]")).toHaveAttribute("aria-label", /.{10}/);
      }
      await expect(page.locator(".cell-watch .cell-text p")).toHaveText(c.watchP);
      expect(await page.locator('meta[name="description"]').getAttribute("content")).toMatch(c.desc);
      // No untranslated English copy left in the Arabic page's cards.
      if (lang === "ar") expect(await page.locator("#features .cell-splits").innerText()).not.toMatch(/Upper|Bodyweight/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(errors).toEqual([]);
      await context.close();
    });
  }
}

test("landing: no claim of unbuilt features", async ({ browser }) => {
  const { context, page } = await openLanding(browser, "en", 1280);
  const text = (await page.locator("main").innerText()).toLowerCase();
  expect(text).not.toMatch(/ios|apple watch|iphone/);
  // The streak reward stays a "coming soon" promise.
  await expect(page.locator(".cell-streak .soon")).toContainText("Coming soon");
  await context.close();
});
