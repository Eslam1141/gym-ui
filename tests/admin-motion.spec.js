const { test, expect } = require("@playwright/test");

test.setTimeout(45000);

const STATS = {
  totalUsers: 1234, newUsers: { today: 5, d7: 40, d30: 160 }, activeUsers: { d7: 300, d30: 700 },
  blockedUsers: 2, providers: { google: 900, password: 300, both: 34 },
  signupsPerDay: [{ date: "2026-10-06", count: 3 }, { date: "2026-10-07", count: 9 }, { date: "2026-10-08", count: 5 }]
};

async function openAdmin(browser, reducedMotion) {
  const context = await browser.newContext({
    ...(process.env.PW_BASE ? { baseURL: process.env.PW_BASE } : {}),
    reducedMotion, locale: "en-US", serviceWorkers: "block"
  });
  await context.addInitScript(() => {
    localStorage.setItem("gym_lang", "en");
    sessionStorage.setItem("gymauth_session", JSON.stringify({
      token: "tok", exp: Math.floor(Date.now() / 1000) + 3600, source: "local", profile: { name: "Admin", email: "a@example.com" }
    }));
  });
  await context.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1/, "");
    if (path === "/admin/stats") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(STATS) });
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "not_found" } }) });
  });
  const page = await context.newPage();
  await page.goto("/admin.html#overview");
  return { context, page };
}

const firstCard = (page) => page.locator(".adm-card b").first();

test("overview numbers count up to the real value", async ({ browser }) => {
  const { context, page } = await openAdmin(browser, "no-preference");
  await expect(firstCard(page)).toBeAttached();
  const first = await firstCard(page).textContent();
  expect(first).not.toBe("1,234");
  await expect(firstCard(page)).toHaveText("1,234", { timeout: 5000 });
  await expect(page.locator(".adm-card b").last()).toHaveText("2");
  await context.close();
});

test("with reduced motion the real numbers show at once", async ({ browser }) => {
  const { context, page } = await openAdmin(browser, "reduce");
  await expect(firstCard(page)).toBeAttached();
  expect(await firstCard(page).textContent()).toBe("1,234");
  await context.close();
});
