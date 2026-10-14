// Feedback: the user-side sheet (feedback.js) and the admin Feedback tab (admin.js).
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);

const OK = { status: 201, contentType: "application/json", body: JSON.stringify({ id: "f1" }) };

// Records every POST /feedback; `reply` decides the response.
async function mockFeedback(page, reply) {
  const posts = [];
  await page.route("**/api/v1/feedback", async (route) => {
    const req = route.request();
    posts.push({ headers: req.headers(), body: JSON.parse(req.postData() || "{}") });
    await route.fulfill(typeof reply === "function" ? reply(posts.length) : (reply || OK));
  });
  return posts;
}

async function openSheet(page, signedIn) {
  if (signedIn) {
    await page.waitForFunction(() => document.getElementById("tbAvatar"));
    await page.click("#tbAvatar");
    await page.click("#tbMenuFeedback");
  } else {
    await page.click("#feedbackBtn");
  }
  await expect(page.locator("#feedbackSheet [role=dialog]")).toBeVisible();
}

test("guest: sheet from the pill, payload has the email and no Authorization", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false });
  const posts = await mockFeedback(page);
  await openSheet(page, false);
  await expect(page.locator("#fbEmail")).toBeVisible();
  await page.click('.fb-chip[data-type="idea"]');
  await page.fill("#fbMsg", "Add a rest timer sound");
  await page.fill("#fbEmail", "guest@example.com");
  await page.click(".fb-send");
  await expect(page.locator("#fbTitle")).toHaveText("Thanks! The team will read it.");
  expect(posts).toHaveLength(1);
  expect(posts[0].headers.authorization).toBeUndefined();
  const b = posts[0].body;
  expect(b.type).toBe("idea");
  expect(b.message).toBe("Add a rest timer sound");
  expect(b.email).toBe("guest@example.com");
  expect(b.context.platform).toBe("web");
  expect(b.context.lang).toBe("en");
  expect(b.context.screen).toBeTruthy();
  expect(b.context.userAgent.length).toBeLessThanOrEqual(256);
  expect(await page.evaluate(() => localStorage.getItem("gym_feedback_draft"))).toBeNull();
  await page.click(".syd-yes");
  await expect(page.locator("#feedbackSheet")).toHaveCount(0);
  await context.close();
});

test("signed in: Authorization sent, no email field, no email in the body", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  const posts = await mockFeedback(page);
  await openSheet(page, true);
  await expect(page.locator("#fbEmail")).toHaveCount(0);
  await page.fill("#fbMsg", "Bug on the plan tab");
  await page.click(".fb-send");
  await expect(page.locator("#fbTitle")).toHaveText("Thanks! The team will read it.");
  expect(posts[0].headers.authorization).toBe("Bearer tok");
  expect(posts[0].body.email).toBeUndefined();
  expect(posts[0].body.type).toBe("bug");
  await context.close();
});

test("counter, empty guard and the 2000 cap", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false });
  await openSheet(page, false);
  await expect(page.locator(".fb-count")).toHaveText("0/2000");
  await expect(page.locator(".fb-send")).toBeDisabled();
  await page.fill("#fbMsg", "hello");
  await expect(page.locator(".fb-count")).toHaveText("5/2000");
  await expect(page.locator(".fb-send")).toBeEnabled();
  await page.fill("#fbMsg", "x".repeat(2000));
  await expect(page.locator(".fb-count")).toHaveText("2000/2000");
  await page.type("#fbMsg", "y");
  await expect(page.locator(".fb-count")).toHaveText("2000/2000");
  await context.close();
});

test("422 shows the server message, 429 says minutes, both keep the draft", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await mockFeedback(page, (n) => n === 1
    ? { status: 422, contentType: "application/json", body: JSON.stringify({ error: { code: "invalid_request", message: "message is too short" } }) }
    : { status: 429, headers: { "Retry-After": "150" }, contentType: "application/json", body: JSON.stringify({ error: { code: "rate_limited", message: "x" } }) });
  await openSheet(page, true);
  await page.fill("#fbMsg", "hi");
  await page.click(".fb-send");
  await expect(page.locator(".fb-status")).toHaveText("message is too short");
  await expect(page.locator(".fb-send")).toBeEnabled();
  await page.click(".fb-send");
  await expect(page.locator(".fb-status")).toHaveText("Too many messages. Try again in 3 minutes.");
  await expect(page.locator("#fbMsg")).toHaveValue("hi");
  await context.close();
});

test("offline: says so, sends nothing, keeps the draft across a reload", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false });
  const posts = await mockFeedback(page);
  await openSheet(page, false);
  await page.fill("#fbMsg", "draft text");
  await page.fill("#fbEmail", "a@b.co");
  await page.click('.fb-chip[data-type="other"]');
  await context.setOffline(true);
  await page.click(".fb-send");
  await expect(page.locator(".fb-status")).toContainText("offline");
  expect(posts).toHaveLength(0);
  await context.setOffline(false);
  await page.reload();
  await page.waitForFunction(() => window.GymFeedback);
  await page.click("#feedbackBtn");
  await expect(page.locator("#fbMsg")).toHaveValue("draft text");
  await expect(page.locator("#fbEmail")).toHaveValue("a@b.co");
  await expect(page.locator('.fb-chip[data-type="other"]')).toHaveAttribute("aria-checked", "true");
  await context.close();
});

test("dialog: labelled, Esc closes, Tab stays inside", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await openSheet(page, true);
  await expect(page.locator("#feedbackSheet [role=dialog]")).toHaveAttribute("aria-labelledby", "fbTitle");
  await expect(page.locator("#fbTitle")).toHaveText("Send feedback");
  await expect(page.locator("#fbMsg")).toBeFocused();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement.closest("#feedbackSheet"))).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => !!document.activeElement.closest("#feedbackSheet"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#feedbackSheet")).toHaveCount(0);
  await context.close();
});

test("Arabic: RTL sheet, Arabic strings, lang in the payload", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false, lang: "ar" });
  const posts = await mockFeedback(page);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await openSheet(page, false);
  await expect(page.locator("#fbTitle")).toHaveText("ابعت رأيك");
  await page.fill("#fbMsg", "مشكلة في التايمر");
  await page.click(".fb-send");
  await expect(page.locator("#fbTitle")).toHaveText("شكرًا! الفريق هيقرأ رأيك.");
  expect(posts[0].body.context.lang).toBe("ar");
  await context.close();
});

test("female plan, Arabic: feminine thanks", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true, lang: "ar", plan: "female" });
  await mockFeedback(page);
  await openSheet(page, true);
  await page.fill("#fbMsg", "تمام");
  await page.click(".fb-send");
  await expect(page.locator("#fbTitle")).toHaveText("شكرًا ليكي! الفريق هيقرأ رأيك.");
  await context.close();
});

// ---------------- admin ----------------

function makeItems(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: "id" + i, type: ["bug", "idea", "other"][i % 3], status: i < 4 ? "new" : "done",
      message: "message " + i, createdAt: "2026-10-10T10:00:00Z",
      ...(i % 2 ? { userId: "u" + i, userName: "User " + i, userEmail: "u" + i + "@example.com" } : { email: "g" + i + "@example.com" }),
      context: { platform: "web", lang: "en", screen: "plan", userAgent: "UA" }, adminNote: ""
    });
  }
  return out;
}

async function openAdmin(browser, opts) {
  opts = opts || {};
  const context = await browser.newContext({
    ...(process.env.PW_BASE ? { baseURL: process.env.PW_BASE } : {}),
    locale: opts.lang === "ar" ? "ar-EG" : "en-US", serviceWorkers: "block",
    viewport: opts.viewport || { width: 1280, height: 900 }
  });
  await context.addInitScript((lang) => {
    localStorage.setItem("gym_lang", lang);
    sessionStorage.setItem("gymauth_session", JSON.stringify({
      token: "tok", exp: Math.floor(Date.now() / 1000) + 3600, source: "local", profile: { name: "Admin", email: "a@example.com" }
    }));
  }, opts.lang || "en");
  const items = opts.items || makeItems(30);
  const s = { items, log: [], patchStatus: 200 };
  await context.route("**/api/v1/**", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^.*\/api\/v1/, "");
    const json = (status, b) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    s.log.push({ method: req.method(), path, query: url.search, body: req.postData() ? JSON.parse(req.postData()) : null });
    const newCount = () => s.items.filter((x) => x.status === "new").length;
    if (path === "/admin/stats") {
      return json(200, { totalUsers: 1, newUsers: { today: 0, d7: 0, d30: 0 }, activeUsers: { d7: 0, d30: 0 }, blockedUsers: 0, providers: { google: 1, password: 0, both: 0 }, signupsPerDay: [] });
    }
    if (path === "/admin/feedback/count") return json(200, { count: newCount() });
    if (path === "/admin/feedback" && req.method() === "GET") {
      const q = url.searchParams, page = +q.get("page") || 1, size = +q.get("pageSize") || 25;
      let list = s.items.filter((x) => (!q.get("status") || x.status === q.get("status")) && (!q.get("type") || x.type === q.get("type")));
      return json(200, { items: list.slice((page - 1) * size, page * size), total: list.length, page, pageSize: size, newCount: newCount() });
    }
    if (path.startsWith("/admin/feedback/") && req.method() === "PATCH") {
      if (s.patchStatus !== 200) return json(s.patchStatus, { error: { code: "internal", message: "x" } });
      const it = s.items.find((x) => "/admin/feedback/" + x.id === path);
      Object.assign(it, JSON.parse(req.postData()));
      return json(200, it);
    }
    return json(404, { error: { code: "not_found", message: "mock" } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/admin.html#feedback");
  await expect(page.locator(".adm-fb").first()).toBeVisible();
  return { context, page, s, errors };
}

test("admin: list, badge, filters and pagination", async ({ browser }) => {
  const { context, page, s } = await openAdmin(browser);
  await expect(page.locator("#fbBadge")).toHaveText("4");
  await expect(page.locator(".adm-fb")).toHaveCount(25);
  await expect(page.locator(".adm-pager .adm-sub")).toContainText("Page 1 of 2");
  await expect(page.locator(".adm-fb").first().locator(".adm-fb-who")).toContainText("g0@example.com");
  await expect(page.locator(".adm-fb").nth(1).locator(".adm-fb-who")).toContainText("User 1");
  await expect(page.locator(".adm-fb").first().locator(".adm-fb-ctx")).not.toHaveAttribute("open", "");
  await page.click(".adm-pager .adm-btn >> text=Next");
  await expect(page.locator(".adm-fb")).toHaveCount(5);
  await page.locator(".adm-tools select").first().selectOption("new");
  await expect(page.locator(".adm-fb")).toHaveCount(4);
  await page.locator(".adm-tools select").nth(1).selectOption("bug");
  await expect(page.locator(".adm-fb")).toHaveCount(2);
  const last = s.log.filter((l) => l.path === "/admin/feedback").pop();
  expect(last.query).toContain("status=new");
  expect(last.query).toContain("type=bug");
  expect(last.query).toContain("page=1");
  await context.close();
});

test("admin: status PATCH is optimistic and rolls back on error", async ({ browser }) => {
  const { context, page, s } = await openAdmin(browser);
  const card = page.locator(".adm-fb").first();
  await card.locator(".adm-fb-act select").selectOption("done");
  await expect(card.locator(".adm-st")).toHaveText("Done");
  await expect(page.locator("#fbBadge")).toHaveText("3");
  expect(s.log.filter((l) => l.method === "PATCH").pop().body).toEqual({ status: "done" });
  s.patchStatus = 500;
  const card2 = page.locator(".adm-fb").nth(1);
  await card2.locator(".adm-fb-act select").selectOption("wont_do");
  await expect(card2.locator(".adm-st")).toHaveText("New");
  await expect(card2.locator(".adm-fb-act select")).toHaveValue("new");
  await expect(card2.locator(".adm-err")).not.toBeEmpty();
  await expect(page.locator("#fbBadge")).toHaveText("3");
  await context.close();
});

test("admin: note saves via PATCH and rolls back on error", async ({ browser }) => {
  const { context, page, s } = await openAdmin(browser);
  const card = page.locator(".adm-fb").first();
  await card.locator("textarea").fill("called them");
  await card.getByRole("button", { name: "Save note" }).click();
  await expect(card.locator(".adm-ok")).toHaveText("Note saved.");
  expect(s.log.filter((l) => l.method === "PATCH").pop().body).toEqual({ adminNote: "called them" });
  s.patchStatus = 500;
  await card.locator("textarea").fill("changed");
  await card.getByRole("button", { name: "Save note" }).click();
  await expect(card.locator("textarea")).toHaveValue("called them");
  await expect(card.locator(".adm-err")).not.toBeEmpty();
  await context.close();
});

test("admin: hostile content is rendered as literal text and nothing runs", async ({ browser }) => {
  const evil = "<img src=x onerror=window.__xss=1>";
  const rlo = "safe‮gnp.exe";
  const items = [{
    id: "x1", type: "bug", status: "new", createdAt: "2026-10-10T10:00:00Z",
    message: evil + "\n" + rlo, userId: "u1", userName: evil, userEmail: "<b>e@x.co</b>",
    context: { platform: evil, lang: rlo, screen: evil, appVersion: evil, userAgent: evil }, adminNote: evil
  }, {
    id: "x2", type: "idea", status: "new", createdAt: "2026-10-10T10:00:00Z",
    message: "guest", email: evil, context: {}, adminNote: ""
  }];
  const { context, page, errors } = await openAdmin(browser, { items });
  const card = page.locator(".adm-fb").first();
  await card.locator(".adm-fb-ctx summary").click();
  await expect(card.locator(".adm-fb-msg")).toHaveText(evil + "\n" + rlo);
  await expect(card.locator(".adm-fb-msg")).toHaveAttribute("dir", "auto");
  await expect(card.locator("textarea")).toHaveValue(evil);
  await expect(card.locator(".adm-fb-who")).toContainText(evil);
  await expect(card.locator(".adm-kv dd").first()).toHaveText(evil);
  await expect(page.locator(".adm-fb").nth(1).locator(".adm-fb-who")).toContainText(evil);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator("#admMain img, #admMain b").count()).toBe(0);
  expect(await page.locator("#admMain [onerror]").count()).toBe(0);
  expect(await page.locator("#admMain a[href]").count()).toBe(0);
  expect(await card.locator(".adm-fb-msg").evaluate((n) => getComputedStyle(n).whiteSpace)).toBe("pre-wrap");
  expect(errors).toEqual([]);
  await context.close();
});

test("admin: Arabic RTL feedback tab", async ({ browser }) => {
  const { context, page } = await openAdmin(browser, { lang: "ar" });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("#tabFeedback")).toContainText("الآراء");
  await expect(page.locator(".adm-fb").first().locator(".adm-st")).toHaveText("جديد");
  await context.close();
});
