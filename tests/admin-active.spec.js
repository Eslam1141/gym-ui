const { test, expect } = require("@playwright/test");
const fs = require("fs");

test.setTimeout(45000);

const STATS = {
  totalUsers: 1000, newUsers: { today: 5, d7: 40, d30: 160 }, activeUsers: { d7: 300, d30: 700 },
  blockedUsers: 2, providers: { google: 600, password: 300, both: 100 }, inactiveUsers: { d30: 300 },
  signupsPerDay: Array.from({ length: 90 }, (_, i) => ({ date: "2026-07-" + String((i % 28) + 1).padStart(2, "0"), count: (i * 7) % 11 }))
};
const U = (over) => Object.assign({ id: "u1", email: "ada@example.com", displayName: "Ada", provider: "google", createdAt: "2026-06-01T00:00:00Z", lastSeenAt: "2026-10-20T00:00:00Z", blocked: false }, over);
const USERS = [
  U({ id: "u1", active: true, lastWorkoutAt: "2026-10-23T08:00:00Z", workouts30d: 12, currentStreak: 3 }),
  U({ id: "u2", email: "bo@example.com", displayName: "Bo", active: false, lastWorkoutAt: null, workouts30d: 0, currentStreak: 0 })
];
const DETAIL = U({ id: "u1", active: true, lastWorkoutAt: "2026-10-23T08:00:00Z", workouts7d: 4, workouts30d: 12, currentStreak: 3, totalDaysTrained: 20, workouts: 30, meals: 9, emailVerified: true });
const SHOTS = process.env.SHOT_DIR;

async function openAdmin(browser, { lang = "en", hash = "overview", stats = STATS, users = USERS, detail = DETAIL, width = 1280, height = 900 } = {}) {
  const context = await browser.newContext({ reducedMotion: "reduce", locale: lang === "ar" ? "ar-EG" : "en-US", serviceWorkers: "block", viewport: { width, height } });
  await context.addInitScript((l) => {
    localStorage.setItem("gym_lang", l);
    localStorage.setItem("gym_theme", "dark");
    sessionStorage.setItem("gymauth_session", JSON.stringify({ token: "tok", exp: Math.floor(Date.now() / 1000) + 3600, source: "local", profile: { name: "Admin", email: "a@example.com" } }));
  }, lang);
  const calls = [];
  await context.route("**/api/v1/**", (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^.*\/api\/v1/, "");
    const ok = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    calls.push(p + url.search);
    if (p === "/admin/stats") return ok(stats);
    if (p === "/admin/users") return ok({ users, total: users.length, page: 1, pageSize: 25 });
    if (p.startsWith("/admin/users/")) return ok(detail);
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  const page = await context.newPage();
  await page.goto("/admin.html#" + hash);
  return { context, page, calls };
}
const shot = async (page, name) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: SHOTS + "/" + name + ".png", fullPage: true });
};

test("inactive tile appears with share of total and the grid has no holes", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const tile = page.locator(".adm-t-inactive");
  await expect(tile).toContainText("Inactive 30+ days");
  await expect(tile).toContainText("300");
  await expect(tile).toContainText("30% of all users");
  await expect(page.locator(".adm-card")).toHaveCount(8);
  const ok = await page.evaluate(() => {
    const g = document.querySelector(".adm-grid").getBoundingClientRect();
    const rows = {};
    document.querySelectorAll(".adm-tile").forEach((t) => { const r = t.getBoundingClientRect(); (rows[Math.round(r.top)] = rows[Math.round(r.top)] || []).push(r); });
    return Object.values(rows).every((rs) => Math.abs(Math.min(...rs.map((r) => r.left)) - g.left) < 1 && Math.abs(Math.max(...rs.map((r) => r.right)) - g.right) < 1);
  });
  expect(ok).toBe(true);
  await shot(page, "overview-en");
  await context.close();
});

test("sign-in buckets are exclusive and sum to total (AR labels too)", async ({ browser }) => {
  const { context, page } = await openAdmin(browser, { lang: "ar" });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const rows = page.locator(".adm-t-prov .adm-bars > div");
  await expect(rows.nth(0)).toContainText("البريد الإلكتروني فقط");
  await expect(rows.nth(0)).toContainText("300");
  await expect(rows.nth(1)).toContainText("Google فقط");
  await expect(rows.nth(1)).toContainText("600");
  await expect(rows.nth(2)).toContainText("كلاهما");
  await expect(rows.nth(2)).toContainText("100");
  expect(300 + 600 + 100).toBe(STATS.totalUsers);
  await expect(page.locator(".adm-t-inactive")).toContainText("غير نشط منذ 30+ يومًا");
  await shot(page, "overview-ar");
  await context.close();
});

test("overview hides the inactive tile when the backend does not send it", async ({ browser }) => {
  const s = Object.assign({}, STATS); delete s.inactiveUsers;
  const { context, page } = await openAdmin(browser, { stats: s });
  await expect(page.locator(".adm-tile")).toHaveCount(9);
  await expect(page.locator(".adm-t-inactive")).toHaveCount(0);
  await context.close();
});

test("users list shows badges and progress, and the filter sends active= only when set", async ({ browser }) => {
  const { context, page, calls } = await openAdmin(browser, { hash: "users" });
  const rows = page.locator(".adm-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator(".adm-badge.on")).toHaveText("Active");
  await expect(rows.nth(0)).toContainText("Last workout: Oct 23, 2026");
  await expect(rows.nth(0)).toContainText("12 in 30 days");
  await expect(rows.nth(0)).toContainText("3-day streak");
  await expect(rows.nth(1).locator(".adm-badge.off")).toHaveText("Inactive");
  await expect(rows.nth(1)).toContainText("No workouts yet");
  expect(calls.filter((c) => c.startsWith("/admin/users?")).every((c) => !c.includes("active="))).toBe(true);
  await shot(page, "users-en");
  await page.getByLabel("Filter by activity").selectOption("inactive");
  await expect.poll(() => calls.some((c) => c.startsWith("/admin/users?") && c.includes("&active=inactive"))).toBe(true);
  await page.getByLabel("Filter by activity").selectOption("active");
  await expect.poll(() => calls.some((c) => c.includes("&active=active"))).toBe(true);
  const n = calls.length;
  await page.getByLabel("Filter by activity").selectOption("");
  await expect.poll(() => calls.length).toBeGreaterThan(n);
  expect(calls[calls.length - 1]).not.toContain("active=");
  await context.close();
});

test("users list renders in Arabic RTL and fits a phone", async ({ browser }) => {
  const { context, page } = await openAdmin(browser, { lang: "ar", hash: "users", width: 360, height: 760 });
  await expect(page.locator(".adm-row").first()).toContainText("آخر تمرين");
  await expect(page.locator(".adm-row").first().locator(".adm-badge.on")).toHaveText("نشط");
  await expect(page.locator(".adm-row").nth(1)).toContainText("لا توجد تمارين بعد");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shot(page, "users-ar-360");
  await context.close();
});

test("list degrades gracefully without the new user fields", async ({ browser }) => {
  const { context, page } = await openAdmin(browser, { hash: "users", users: [U({ id: "u1" })] });
  await expect(page.locator(".adm-row")).toHaveCount(1);
  await expect(page.locator(".adm-badge.on, .adm-badge.off, .adm-prog")).toHaveCount(0);
  await context.close();
});

test("detail panel shows active badge, last workout and 7/30-day counts", async ({ browser }) => {
  const { context, page } = await openAdmin(browser, { hash: "users" });
  await page.locator(".adm-row").first().click();
  const panel = page.locator("#admPanel");
  await expect(panel.locator(".adm-badge.on")).toHaveText("Active");
  await expect(panel.locator(".adm-kv")).toContainText("Last workout");
  await expect(panel.locator(".adm-kv")).toContainText("Oct 23, 2026");
  await expect(panel.locator(".adm-kv")).toContainText("Workouts · 7 days");
  await expect(panel.locator(".adm-kv")).toContainText("Workouts · 30 days");
  await shot(page, "detail-en");
  await context.close();
});

test("detail panel in Arabic, and without new fields it shows none of them", async ({ browser }) => {
  let { context, page } = await openAdmin(browser, { lang: "ar", hash: "users" });
  await page.locator(".adm-row").first().click();
  await expect(page.locator("#admPanel .adm-kv")).toContainText("آخر تمرين");
  await shot(page, "detail-ar");
  await context.close();
  ({ context, page } = await openAdmin(browser, { hash: "users", detail: U({ id: "u1", totalDaysTrained: 1, workouts: 1, meals: 1 }) }));
  await page.locator(".adm-row").first().click();
  await expect(page.locator("#admPanel .adm-kv")).toBeVisible();
  await expect(page.locator("#admPanel .adm-kv")).not.toContainText("Last workout");
  await expect(page.locator("#admPanel .adm-badge.on, #admPanel .adm-badge.off")).toHaveCount(0);
  await context.close();
});
