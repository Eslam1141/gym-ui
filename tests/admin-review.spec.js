const { test, expect } = require("@playwright/test");

test.setTimeout(45000);

const TODAY = new Date(2026, 9, 15, 12, 0, 0);
const base = Date.parse("2026-10-14T16:00:00Z");
const iso = (sec) => new Date(base + sec * 1000).toISOString();
const sets = (offsets) => offsets.map((o, i) => ({ ex: "mua_bench", set: i, at: o == null ? null : iso(o) }));

function item(over) {
  return Object.assign({
    userId: "u1", email: "lifter@example.com", displayName: "Lifter One",
    record: {
      date: "2026-10-14", dayId: "m_upper", state: "flagged", reasons: ["short_duration"], source: "app",
      completedAt: "2026-10-14T17:00:00Z",
      evidence: { v: 1, kind: "live", plan: "gym", timerStart: iso(0), elapsedSec: 1900, sets: sets([0, 600, 1210]) }
    }
  }, over || {});
}
function seed() {
  return [
    item({ userId: "u2", email: "newest@example.com", displayName: "", record: {
      date: "2026-10-14", dayId: "sp4gm_upperA", state: "pending", reasons: ["gap_too_short", "missing_sets"], source: "app",
      completedAt: "2026-10-14T18:00:00Z",
      evidence: { v: 1, kind: "live", plan: "gym", timerStart: iso(0), elapsedSec: 400, sets: sets([0, 30, 200, null]) }
    } }),
    item()
  ];
}

// opts.items: the queue; opts.count: badge count (defaults to the queue length);
// opts.decide: (kind, userId, body) => { status, code } to force an error answer
async function openReview(browser, opts = {}) {
  const context = await browser.newContext({
    ...(process.env.PW_BASE ? { baseURL: process.env.PW_BASE } : {}),
    reducedMotion: "reduce", locale: opts.lang === "ar" ? "ar-EG" : "en-US", viewport: opts.viewport || { width: 390, height: 844 }, serviceWorkers: "block",
    colorScheme: opts.colorScheme || "dark"
  });
  await context.addInitScript((lang) => {
    localStorage.setItem("gym_lang", lang);
    sessionStorage.setItem("gymauth_session", JSON.stringify({
      token: "tok", exp: Math.floor(Date.now() / 1000) + 3600, source: "local", profile: { name: "Admin", email: "a@example.com" }
    }));
  }, opts.lang || "en");
  const q = { items: opts.items || seed(), count: opts.count, posts: [], gets: [] };
  await context.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1/, "");
    const json = (status, b) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (p === "/admin/stats") return json(200, { totalUsers: 1, newUsers: { today: 0, d7: 0, d30: 0 }, activeUsers: { d7: 0, d30: 0 }, blockedUsers: 0, providers: { google: 1, password: 0, both: 0 }, signupsPerDay: [] });
    if (p === "/admin/feedback/count") return json(200, { count: 0 });
    if (p === "/admin/reviews/count") return json(200, { count: q.count != null ? q.count : q.items.length });
    if (p === "/admin/reviews" && req.method() === "GET") { q.gets.push(url.search); return json(200, { items: q.items }); }
    const m = /^\/admin\/reviews\/([^/]+)\/([^/]+)\/([^/]+)\/(approve|reject)$/.exec(p);
    if (m && req.method() === "POST") {
      const body = req.postData() ? JSON.parse(req.postData()) : {};
      q.posts.push({ userId: decodeURIComponent(m[1]), date: m[2], dayId: m[3], kind: m[4], body });
      const forced = opts.decide && opts.decide(m[4], m[1], body);
      if (forced) return json(forced.status, { error: { code: forced.code, message: "x" } });
      q.items = q.items.filter((i) => i.userId !== decodeURIComponent(m[1]));
      return json(200, {});
    }
    return json(404, {});
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(TODAY);
  await page.goto("/admin.html#review");
  return { context, page, q };
}
const rows = (page) => page.locator(".adm-rv");
const badge = (page) => page.locator("#rvBadge");

test("review tab lists newest first with reasons and timeline", async ({ browser }) => {
  const { context, page, q } = await openReview(browser);
  await expect(page.locator("#tabReview")).toContainText("Review");
  await expect(page.locator("#tabReview")).toHaveAttribute("aria-selected", "true");
  await expect(rows(page)).toHaveCount(2);
  expect(q.gets[0]).toBe("?limit=50");
  const first = rows(page).nth(0), second = rows(page).nth(1);
  await expect(first).toContainText("newest@example.com"); // no display name: the email stands in
  await expect(first).toContainText("sp4gm_upperA");
  await expect(first.locator(".adm-st")).toHaveText("Pending");
  await expect(first.locator(".adm-rv-reason")).toHaveText(["Sets ticked under 60 s apart", "Not every set ticked"]);
  await expect(first.locator(".adm-rv-dur")).toHaveText("3:20 (reported 6:40)");
  await expect(second).toContainText("Lifter One");
  await expect(second).toContainText("Men's plan · m_upper");
  await expect(second.locator(".adm-st")).toHaveText("Flagged");
  await expect(second.locator(".adm-rv-dur")).toHaveText("20:10 (reported 31:40)");
  // timeline: collapsed, three ticks in time order, the 30 s gap highlighted
  await expect(first.locator(".adm-rv-ticks")).toBeHidden();
  await first.locator("summary").click();
  await expect(first.locator(".adm-rv-ticks li")).toHaveCount(3);
  await expect(first.locator(".adm-rv-ticks li.is-short")).toHaveCount(1);
  await expect(first.locator(".adm-rv-ticks li.is-short .adm-rv-gap")).toHaveText("+30s");
  await expect(first.locator(".adm-rv-ticks li").nth(2).locator(".adm-rv-gap")).toHaveText("+170s");
  await expect(badge(page)).toHaveText("2");
  await context.close();
});

test("approve posts note and removes row, badge decrements", async ({ browser }) => {
  const { context, page, q } = await openReview(browser);
  await expect(rows(page)).toHaveCount(2);
  const second = rows(page).nth(1);
  await second.locator(".adm-rv-note").fill("  checked the video  ");
  await second.getByRole("button", { name: "Approve" }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  expect(q.posts).toEqual([{ userId: "u1", date: "2026-10-14", dayId: "m_upper", kind: "approve", body: { note: "checked the video" } }]);
  await expect(badge(page)).toHaveText("1");
  await rows(page).first().getByRole("button", { name: "Reject" }).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator(".adm-msg")).toHaveText("Nothing to review");
  await expect(badge(page)).toBeHidden();
  expect(q.posts[1]).toMatchObject({ userId: "u2", dayId: "sp4gm_upperA", kind: "reject", body: { note: "" } });
  await context.close();
});

test("409 already_reviewed removes row with message", async ({ browser }) => {
  const { context, page } = await openReview(browser, { decide: () => ({ status: 409, code: "already_reviewed" }) });
  await expect(rows(page)).toHaveCount(2);
  await rows(page).nth(0).getByRole("button", { name: "Approve" }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator(".adm-err").filter({ hasText: "Already reviewed by someone else" })).toBeVisible();
  await context.close();
});

test("badge 99+", async ({ browser }) => {
  const { context, page } = await openReview(browser, { count: 120 });
  await expect(rows(page)).toHaveCount(2);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(badge(page)).toHaveText("99+");
  await context.close();
});

test("workout log shows pending badge", async ({ browser }) => {
  const { context, page } = await openReview(browser);
  await page.route("**/api/v1/admin/users**", (route) => {
    const u = { id: "u1", email: "lifter@example.com", displayName: "Lifter One", provider: "google", createdAt: "2026-01-01T00:00:00Z", currentStreak: 0, totalDaysTrained: 0 };
    const url = new URL(route.request().url());
    if (/\/workouts$/.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        records: [{ date: "2026-10-14", dayId: "m_upper", completedAt: "2026-10-14T18:00:00Z", source: "app", state: "pending" }, { date: "2026-10-13", dayId: "m_lower", completedAt: "2026-10-13T18:00:00Z", source: "app", state: "verified" }],
        restDays: [], streak: { currentStreak: 0, totalDaysTrained: 1, todayDone: false, todayRested: false, restDaysLeftThisWeek: 2 }
      }) });
    }
    if (/\/users\/u1$/.test(url.pathname)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(u) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ total: 1, page: 1, pageSize: 25, users: [u] }) });
  });
  await page.locator('[data-tab="users"]').click();
  await page.locator(".adm-row").first().click();
  await page.locator('[data-act="workout-log"]').click();
  await expect(page.locator(".adm-log-list li")).toHaveCount(2);
  await expect(page.locator(".adm-log-list .adm-st-pending")).toHaveText("Pending");
  await expect(page.locator(".adm-log-list .adm-st")).toHaveCount(1); // verified days carry no badge
  await context.close();
});

test("RTL Arabic labels", async ({ browser }) => {
  const { context, page } = await openReview(browser, { lang: "ar" });
  await expect(rows(page)).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
  await expect(page.locator("#tabReview")).toContainText("المراجعة");
  const first = rows(page).nth(0);
  await expect(first.locator(".adm-st")).toHaveText("معلّق");
  await expect(first.locator(".adm-rv-reason").first()).toHaveText("جولات بفاصل أقل من 60 ثانية");
  await expect(first.getByRole("button", { name: "موافقة" })).toBeVisible();
  await expect(first.getByRole("button", { name: "رفض" })).toBeVisible();
  await expect(first.locator("label")).toHaveText("ملاحظة (اختيارية)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});
