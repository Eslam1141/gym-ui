const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test.setTimeout(45000);

const STATS = {
  totalUsers: 1234, newUsers: { today: 5, d7: 40, d30: 160 }, activeUsers: { d7: 300, d30: 700 },
  blockedUsers: 2, providers: { google: 900, password: 300, both: 34 },
  signupsPerDay: Array.from({ length: 90 }, (_, i) => ({ date: "2026-07-" + String((i % 28) + 1).padStart(2, "0"), count: (i * 7) % 11 }))
};
const SHOTS = process.env.SHOT_DIR;

async function openAdmin(browser, { width = 1280, height = 900, lang = "en", theme = "dark" } = {}) {
  const context = await browser.newContext({
    reducedMotion: "reduce", locale: lang === "ar" ? "ar-EG" : "en-US", serviceWorkers: "block", viewport: { width, height }
  });
  await context.addInitScript((o) => {
    localStorage.setItem("gym_lang", o.lang);
    localStorage.setItem("gym_theme", o.theme);
    sessionStorage.setItem("gymauth_session", JSON.stringify({
      token: "tok", exp: Math.floor(Date.now() / 1000) + 3600, source: "local", profile: { name: "Admin", email: "a@example.com" }
    }));
  }, { lang, theme });
  await context.route("**/api/v1/**", (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1/, "");
    if (p === "/admin/stats") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(STATS) });
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  const page = await context.newPage();
  await page.goto("/admin.html#overview");
  await expect(page.locator(".adm-tile")).toHaveCount(9);
  return { context, page };
}

// Every row of the grid must run edge to edge: no holes at any breakpoint.
async function gridIsGapFree(page) {
  return page.evaluate(() => {
    const gel = document.querySelector(".adm-grid"), gap = parseFloat(getComputedStyle(gel).columnGap), g = gel.getBoundingClientRect();
    const rows = {};
    document.querySelectorAll(".adm-tile").forEach((t) => {
      const r = t.getBoundingClientRect();
      (rows[Math.round(r.top)] = rows[Math.round(r.top)] || []).push(r);
    });
    return Object.values(rows).every((rs) =>
      Math.abs(Math.min(...rs.map((r) => r.left)) - g.left) < 1 && Math.abs(Math.max(...rs.map((r) => r.right)) - g.right) < 1 &&
      Math.abs(rs.reduce((a, r) => a + r.width, 0) - (g.width - (rs.length - 1) * gap)) < 2);
  });
}

for (const [name, width, cols] of [["desktop", 1280, 4], ["tablet", 700, 2], ["phone", 360, 2]]) {
  test(`overview is a gap-free ${cols}-column tile grid (${name})`, async ({ browser }) => {
    const { context, page } = await openAdmin(browser, { width });
    const tpl = await page.locator(".adm-grid").evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(" ").length);
    expect(tpl).toBe(cols);
    expect(await gridIsGapFree(page)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator(".adm-card")).toHaveCount(7);
    await expect(page.locator(".adm-card .adm-ico")).toHaveCount(7);
    await context.close();
  });
}

for (const lang of ["en", "ar"]) {
  test(`phone 360 (${lang}): 2-up KPI tiles, one-line scrollable tabs, no overflow`, async ({ browser }) => {
    const { context, page } = await openAdmin(browser, { width: 360, lang });
    expect(await gridIsGapFree(page)).toBe(true);
    const w = await page.evaluate(() => [...document.querySelectorAll(".adm-card:not(.adm-t-wide)")].map((c) => Math.round(c.getBoundingClientRect().width)));
    expect(new Set(w).size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const tabs = await page.evaluate(() => [...document.querySelectorAll("#admTabs button")].map((b) => Math.round(b.getBoundingClientRect().height)));
    expect(Math.max(...tabs)).toBeLessThan(60);
    expect(await page.evaluate(() => { const n = document.getElementById("admTabs"); return n.scrollWidth > n.clientWidth; })).toBe(true);
    await context.close();
  });
}

test("sign-in methods tile shows exclusive buckets that add up to the total", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const rows = page.locator(".adm-t-prov .adm-bars > div");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("E-mail only");
  await expect(rows.nth(0)).toContainText("300 · 24%");
  await expect(rows.nth(1)).toContainText("Google only");
  await expect(rows.nth(1)).toContainText("900 · 73%");
  await expect(rows.nth(2)).toContainText("Both");
  await expect(rows.nth(2)).toContainText("34 · 3%");
  expect(300 + 900 + 34).toBe(STATS.totalUsers);
  const w = await rows.nth(1).locator("i").evaluate((i) => i.style.width);
  expect(w).toBe("73%");
  await context.close();
});

test("tiles carry data-driven deltas and the Arabic page renders RTL", async ({ browser }) => {
  const { context, page } = await openAdmin(browser, { lang: "ar" });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".adm-t-prov")).toContainText("كلاهما");
  await expect(page.locator(".adm-delta").first()).toContainText("هذا الأسبوع");
  expect(await gridIsGapFree(page)).toBe(true);
  await context.close();
});

test("English deltas: weekly trend and share of users", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  await expect(page.locator(".adm-delta").first()).toHaveText("+40 this week");
  await expect(page.locator(".adm-delta.up")).toContainText("vs weekly average");
  await expect(page.locator(".adm-card").nth(4).locator(".adm-delta")).toHaveText("24% of all users");
  await context.close();
});

test("grid lines up with the header and tabs; back link stays on one line on a phone", async ({ browser }) => {
  const d = await openAdmin(browser, { width: 1440 });
  const x = await d.page.evaluate(() => ["#admBack", "#tabOverview", ".adm-grid"].map((q) => Math.round(document.querySelector(q).getBoundingClientRect().left)));
  expect(await d.page.evaluate(() => getComputedStyle(document.body).paddingLeft)).toBe("0px"); // the app's side-rail padding must not leak in
  expect(x[2] - x[0]).toBeLessThanOrEqual(20); // grid edge sits at the header's padded edge (tab has own 14px padding)
  await d.context.close();
  const m = await openAdmin(browser, { width: 360 });
  const h = await m.page.locator("#admBack").evaluate((a) => a.getBoundingClientRect().height);
  expect(h).toBeGreaterThanOrEqual(44);
  expect(h).toBeLessThan(60);
  expect(await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await m.context.close();
});

if (SHOTS) {
  for (const theme of ["dark", "light"]) {
    for (const [vp, width, height] of [["desktop", 1280, 900], ["mobile", 390, 844]]) {
      test(`screenshot ar ${vp} ${theme}`, async ({ browser }) => {
        const { context, page } = await openAdmin(browser, { width, height, theme, lang: "ar" });
        expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: path.join(SHOTS, `admin-overview-ar-${vp}-${theme}.png`), fullPage: true });
        await context.close();
      });
    }
  }
}

if (SHOTS) {
  for (const theme of ["dark", "light"]) {
    for (const [vp, width, height] of [["desktop", 1280, 900], ["mobile", 390, 844]]) {
      test(`screenshot ${vp} ${theme}`, async ({ browser }) => {
        const { context, page } = await openAdmin(browser, { width, height, theme });
        expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
        expect(await page.evaluate(() => window.innerWidth)).toBe(width);
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: path.join(SHOTS, `admin-overview-${vp}-${theme}.png`), fullPage: true });
        await context.close();
      });
    }
  }
}
