const { test, expect } = require("@playwright/test");

test.setTimeout(45000);

function stats(total) {
  return {
    totalUsers: total, newUsers: { today: 4, d7: 40, d30: 160 }, activeUsers: { d7: 300, d30: 700 },
    blockedUsers: 2, providers: { google: 900, password: 300, both: 34 },
    signupsPerDay: [{ date: "2026-10-06", count: 3 }, { date: "2026-10-07", count: 9 }, { date: "2026-10-08", count: 4 }]
  };
}

async function openAdmin(browser) {
  const context = await browser.newContext({
    ...(process.env.PW_BASE ? { baseURL: process.env.PW_BASE } : {}),
    reducedMotion: "reduce", locale: "en-US", serviceWorkers: "block"
  });
  await context.addInitScript(() => {
    localStorage.setItem("gym_lang", "en");
    sessionStorage.setItem("gymauth_session", JSON.stringify({
      token: "tok", exp: Math.floor(Date.now() / 1000) + 3600, source: "local", profile: { name: "Admin", email: "a@example.com" }
    }));
  });
  const calls = { stats: 0, users: 0 };
  await context.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1/, "");
    const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (path === "/admin/stats") { calls.stats++; return json(stats(1000 + calls.stats)); }
    if (path === "/admin/users") {
      calls.users++;
      return json({ total: 1, page: 1, pageSize: 25, users: [{ id: "u1", email: "u" + calls.users + "@example.com", provider: "google", createdAt: "2026-10-01T00:00:00Z" }] });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto("/admin.html#overview");
  await expect(page.locator(".adm-card b").first()).toHaveText("1,001");
  return { context, page, calls };
}

test("clicking the tab you're already on doesn't reload it", async ({ browser }) => {
  const { context, page, calls } = await openAdmin(browser);
  await page.click("#tabOverview");
  await page.click("#tabOverview");
  await page.clock.runFor(1000);
  expect(calls.stats).toBe(1);
  await page.click("#tabUsers");
  await expect(page.locator(".adm-email")).toHaveText("u1@example.com");
  await page.click("#tabUsers");
  await page.clock.runFor(1000);
  expect(calls.users).toBe(1);
  await context.close();
});

test("overview refreshes itself every 30 s without a loading flash", async ({ browser }) => {
  const { context, page, calls } = await openAdmin(browser);
  await page.clock.runFor(31000);
  await expect(page.locator(".adm-card b").first()).toHaveText("1,002");
  expect(calls.stats).toBe(2);
  await expect(page.locator("#admMain .adm-msg")).toHaveCount(0); // no "Loading…" placeholder
  await expect(page.locator("#admUpdated")).toContainText("updated");
  await context.close();
});

test("the users list refreshes itself too", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  await page.click("#tabUsers");
  await expect(page.locator(".adm-email")).toHaveText("u1@example.com");
  await page.clock.runFor(31000);
  await expect(page.locator(".adm-email")).toHaveText("u2@example.com");
  await context.close();
});

test("the signups chart explains itself", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const sec = page.locator(".adm-section").first();
  await expect(sec.locator("h2")).toHaveText("New sign-ups per day — last 90 days");
  await expect(sec).toContainText("Each bar is one day");
  await expect(sec).toContainText("16 sign-ups in total");
  await expect(sec).toContainText("Busiest day: 2026-10-07 (9)");
  await expect(sec).toContainText("2026-10-06");
  await expect(sec).toContainText("2026-10-08");
  await context.close();
});
