const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

test.setTimeout(45000);

// 90 days ending 2026-10-21; sparse like production (7 sign-ups in total).
const DAYS = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 21) - (89 - i) * 864e5);
  return { date: d.toISOString().slice(0, 10), count: 0 };
});
const at = (date, n) => { DAYS.find((d) => d.date === date).count = n; };
at("2026-09-08", 1); at("2026-09-30", 2); at("2026-10-07", 1); at("2026-10-14", 1); at("2026-10-19", 1); at("2026-10-21", 1);
const sparse = (providers) => ({
  totalUsers: 40, newUsers: { today: 1, d7: 3, d30: 6 }, activeUsers: { d7: 12, d30: 20 }, blockedUsers: 0,
  providers: providers || { google: 30, password: 8, both: 2 }, signupsPerDay: DAYS
});
const SHOTS = path.join(__dirname, "..", "docs", "screenshots", "2026-10-21-admin-chart");

async function openAdmin(browser, { stats = sparse(), width = 1280, lang = "en", theme = "dark", mode } = {}) {
  const context = await browser.newContext({
    reducedMotion: "reduce", locale: lang === "ar" ? "ar-EG" : "en-US", serviceWorkers: "block", viewport: { width, height: 900 }
  });
  await context.addInitScript((o) => {
    localStorage.setItem("gym_lang", o.lang);
    localStorage.setItem("gym_theme", o.theme);
    if (o.mode && !localStorage.getItem("adm_chart_mode")) localStorage.setItem("adm_chart_mode", o.mode);
    sessionStorage.setItem("gymauth_session", JSON.stringify({
      token: "tok", exp: Math.floor(Date.now() / 1000) + 3600, source: "local", profile: { name: "Admin", email: "a@example.com" }
    }));
  }, { lang, theme, mode });
  await context.route("**/api/v1/**", (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1/, "");
    if (p === "/admin/stats") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stats) });
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  const page = await context.newPage();
  await page.goto("/admin.html#overview");
  await expect(page.locator(".adm-chart")).toBeVisible();
  return { context, page };
}

test("weekly view: 13 bars, 7-day buckets ending today, counts add up", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  await expect(page.locator(".adm-t-chart h2")).toHaveText("New sign-ups per week — last 90 days");
  await expect(page.locator(".adm-col")).toHaveCount(13);
  const tips = await page.locator(".adm-col").evaluateAll((c) => c.map((x) => x.title));
  expect(tips[12]).toBe("Oct 15 – Oct 21: 2");
  expect(tips[11]).toBe("Oct 8 – Oct 14: 1");
  expect(tips[10]).toBe("Oct 1 – Oct 7: 1");
  expect(tips[9]).toBe("Sep 24 – Sep 30: 2");
  expect(tips[0]).toBe("Jul 24 – Jul 29: 0"); // partial first bucket of 6 days
  expect(tips.reduce((a, t) => a + Number(t.split(": ")[1]), 0)).toBe(7);
  // counts are printed on non-empty bars only; empty bars keep a baseline tick
  expect(await page.locator(".adm-val").allTextContents()).toEqual(["1", "2", "1", "1", "2"]);
  await expect(page.locator(".adm-col .bar.zero")).toHaveCount(8);
  await context.close();
});

test("Y axis has integer ticks only, with gridlines, and no 'max' label", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const ticks = await page.locator(".adm-y span").allTextContents();
  expect(ticks).toEqual(["0", "1", "2"]);
  await expect(page.locator(".adm-gl")).toHaveCount(ticks.length);
  await expect(page.locator(".adm-t-chart")).not.toContainText("max ");
  const dense = sparse(); dense.signupsPerDay = dense.signupsPerDay.map((d, i) => ({ ...d, count: (i * 7) % 23 }));
  const b = await openAdmin(browser, { stats: dense });
  const t2 = await b.page.locator(".adm-y span").allTextContents();
  t2.forEach((t) => expect(t).toMatch(/^\d+$/));
  expect(t2.length).toBeLessThanOrEqual(6);
  await b.context.close(); await context.close();
});

test("Daily/Weekly toggle switches the view and is remembered", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  await page.getByRole("button", { name: "Daily" }).click();
  await expect(page.locator(".adm-col")).toHaveCount(90);
  await expect(page.locator(".adm-t-chart h2")).toHaveText("New sign-ups per day — last 90 days");
  await expect(page.getByRole("button", { name: "Daily" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("adm_chart_mode"))).toBe("day");
  expect(await page.locator(".adm-x").allTextContents()).toEqual(expect.arrayContaining(["Aug", "Sep", "Oct"]));
  await page.reload();
  await expect(page.locator(".adm-col")).toHaveCount(90);
  await page.getByRole("button", { name: "Weekly" }).click();
  await expect(page.locator(".adm-col")).toHaveCount(13);
  await context.close();
});

test("tapping a bar shows its date range and count", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  await page.locator(".adm-col").nth(12).click();
  await expect(page.locator(".adm-read")).toHaveText("Oct 15 – Oct 21: 2");
  await context.close();
});

test("sign-in rows: E-mail, Google, Both; Apple only when the API sends it", async ({ browser }) => {
  const a = await openAdmin(browser);
  const rows = a.page.locator(".adm-t-prov .adm-bars > div");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("E-mail");
  await expect(rows.nth(0)).toContainText("8 · 20%");
  await expect(rows.nth(1)).toContainText("Google");
  await expect(rows.nth(1)).toContainText("30 · 75%");
  await expect(rows.nth(2)).toContainText("Both");
  await expect(rows.nth(2)).toContainText("2 · 5%");
  await expect(a.page.locator(".adm-t-prov")).not.toContainText("Can use");
  await expect(a.page.locator(".adm-t-prov")).not.toContainText("Apple");
  await a.context.close();
  const b = await openAdmin(browser, { stats: sparse({ google: 30, password: 8, both: 2, apple: 4 }) });
  const rowsB = b.page.locator(".adm-t-prov .adm-bars > div");
  await expect(rowsB).toHaveCount(4);
  await expect(rowsB.nth(2)).toContainText("Apple");
  await expect(rowsB.nth(2)).toContainText("4 · 10%");
  await b.context.close();
});

test("no horizontal scroll at 375px in either view", async ({ browser }) => {
  for (const mode of ["week", "day"]) {
    const { context, page } = await openAdmin(browser, { width: 375, mode });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await context.close();
  }
});

test("screenshots", async ({ browser }) => {
  test.skip(!process.env.SHOTS, "set SHOTS=1 to capture");
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const lang of ["en", "ar"]) for (const theme of ["light", "dark"]) for (const [vp, width] of [["desktop", 1280], ["375", 375]]) {
    for (const mode of ["week", "day"]) {
      const { context, page } = await openAdmin(browser, { lang, theme, width, mode });
      expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir])).toEqual([lang, lang === "ar" ? "rtl" : "ltr"]);
      await page.locator(".adm-t-chart").screenshot({ path: path.join(SHOTS, `${lang}-${theme}-${vp}-${mode}-chart.png`) });
      if (mode === "week") await page.screenshot({ path: path.join(SHOTS, `${lang}-${theme}-${vp}-overview.png`), fullPage: true });
      await context.close();
    }
  }
});
