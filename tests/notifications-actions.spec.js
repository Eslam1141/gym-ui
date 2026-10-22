// Tapping a notification opens the screen it is about (plan day, check-in, tab)
// instead of only marking it read. Also: the same routing from location.hash.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(60000);

// Frozen clock is 2026-10-02T07:00Z (Cairo 10:00); yesterday = 2026-10-01.
const CREATED = "2026-10-02T04:00:00.000Z";
const mk = (id, title, url) => ({ id, title, body: "b", url, createdAt: CREATED, readAt: null });

async function setup(browser, items, o) {
  o = o || {};
  const app = await openApp(browser, { signedIn: true, lang: o.lang, theme: o.theme });
  const state = { items, posts: [], checkin: o.checkin || { submitted: false, latest: { weightKg: 80 } } };
  await app.context.route("**/api/v1/notifications**", async (route) => {
    const req = route.request();
    const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (req.method() === "GET") return json({ items: state.items, unreadCount: state.items.length });
    state.posts.push(new URL(req.url()).pathname.replace(/^.*\/api\/v1/, ""));
    return json({ ok: true });
  });
  await app.context.route("**/assistant/checkin/status", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state.checkin) }));
  await app.page.reload();
  await app.page.waitForFunction(() => window.GymNotifications && window.GymCalendar && window.GymCheckin && document.getElementById("tbBell"));
  await app.page.evaluate(() => { window.__marker = "alive"; });
  return Object.assign(app, { state });
}

async function tapFirst(page) {
  await page.click("#tbBell");
  await expect(page.locator(".notif-item").first()).toBeVisible();
  await page.locator(".notif-item").first().click();
}
const tab = (page) => page.evaluate(() => GymUI.currentTab());

async function expectDay(page, key) {
  await expect(page.locator("#calendarModal")).toBeVisible();
  await expect(page.locator(".cal-grid-cell.selected")).toHaveAttribute("data-date", key);
  await expect(page.locator("#calendarModal .cal-detail-date").first()).toBeVisible();
}

test("url forms route to the right screen; read, close, no reload", async ({ browser }) => {
  const forms = [
    ["./#plan", async (p) => expect(await tab(p)).toBe("plan")],
    ["./#plan?day=2026-10-01", async (p) => { expect(await tab(p)).toBe("plan"); await expectDay(p, "2026-10-01"); }],
    ["./#checkin", async (p) => { await expect(p.locator(".coach-form")).toBeVisible(); expect(await tab(p)).toBe("coach"); }],
    ["./#coach", async (p) => expect(await tab(p)).toBe("coach")],
    ["./#food", async (p) => expect(await tab(p)).toBe("food")],
    ["./#profile", async (p) => expect(await tab(p)).toBe("profile")]
  ];
  for (const [url, check] of forms) {
    const a = await setup(browser, [mk("n1", "Anything", url)]);
    await a.page.evaluate(() => GymUI.navigate("more"));
    await tapFirst(a.page);
    await check(a.page);
    await expect(a.page.locator(".notif-panel")).toBeHidden();
    expect(a.state.posts).toContain("/notifications/n1/read");
    expect(await a.page.evaluate(() => window.__marker)).toBe("alive");
    expect(a.consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
    await a.context.close();
  }
});

for (const lang of ["en", "ar"]) {
  const titles = {
    en: { plan: ["Workout reminder", "No workout logged"], checkin: ["Weekly check-in"] },
    ar: { plan: ["تذكير بالتمرين", "لم يُسجَّل تمرين"], checkin: ["الفحص الأسبوعي"] }
  }[lang];
  test("legacy './' url routes by title (" + lang + ")", async ({ browser }) => {
    for (const t of titles.plan) {
      const a = await setup(browser, [mk("n1", t, "./")], { lang });
      await a.page.evaluate(() => GymUI.navigate("more"));
      await tapFirst(a.page);
      expect(await tab(a.page)).toBe("plan");
      await expectDay(a.page, "2026-10-01"); // yesterday relative to createdAt
      expect(a.state.posts).toContain("/notifications/n1/read");
      await a.context.close();
    }
    for (const t of titles.checkin) {
      const a = await setup(browser, [mk("n1", t, "./")], { lang });
      await tapFirst(a.page);
      await expect(a.page.locator(".coach-form")).toBeVisible();
      expect(await tab(a.page)).toBe("coach");
      await a.context.close();
    }
  });
}

test("yesterday is relative to createdAt, not today", async ({ browser }) => {
  const a = await setup(browser, [Object.assign(mk("n1", "Workout reminder", "./"), { createdAt: "2026-09-29T08:00:00.000Z" })]);
  await tapFirst(a.page);
  await expectDay(a.page, "2026-09-28");
  await a.context.close();
});

test("unknown title with './' falls back to the Plan tab", async ({ browser }) => {
  const a = await setup(browser, [mk("n1", "Welcome", "./")]);
  await a.page.evaluate(() => GymUI.navigate("more"));
  await tapFirst(a.page);
  expect(await tab(a.page)).toBe("plan");
  await a.context.close();
});

test("cross-origin url never navigates", async ({ browser }) => {
  const a = await setup(browser, [mk("n1", "Welcome", "https://evil.example/#checkin")]);
  const before = a.page.url();
  await a.page.evaluate(() => GymUI.navigate("more"));
  await tapFirst(a.page);
  expect(a.page.url()).toBe(before);
  expect(await a.page.evaluate(() => window.__marker)).toBe("alive");
  expect(await tab(a.page)).toBe("plan"); // title fallback, in-app only
  await a.context.close();
});

test("check-in not available: calm toast and Plan", async ({ browser }) => {
  const a = await setup(browser, [mk("n1", "Weekly check-in", "./#checkin")], { checkin: { submitted: true, latest: { weightKg: 80 } } });
  await tapFirst(a.page);
  await expect(a.page.locator(".gym-toast")).toContainText("already done");
  expect(await tab(a.page)).toBe("plan");
  await a.context.close();
});

test("location.hash routes on hashchange and on load, then clears itself", async ({ browser }) => {
  const a = await setup(browser, []);
  await a.page.evaluate(() => { location.hash = "#plan?day=2026-10-01"; });
  await expectDay(a.page, "2026-10-01");
  expect(await a.page.evaluate(() => window.__marker)).toBe("alive");
  expect(await a.page.evaluate(() => location.hash)).toBe("");
  await a.page.evaluate(() => GymUI.navigate("more"));
  await a.page.evaluate(() => { location.hash = "#food"; });
  await expect.poll(() => tab(a.page)).toBe("food");
  await a.page.goto("/index.html?x=1#checkin");
  await expect(a.page.locator(".coach-form")).toBeVisible({ timeout: 15000 });
  expect(await tab(a.page)).toBe("coach");
  await a.context.close();
});

test("external routing entry (service-worker message) ignores cross-origin", async ({ browser }) => {
  const a = await setup(browser, []);
  await a.page.evaluate(() => GymNotifications.route("./#food"));
  await expect.poll(() => tab(a.page)).toBe("food");
  await a.page.evaluate(() => GymNotifications.route("https://evil.example/#coach"));
  expect(await tab(a.page)).toBe("food");
  await a.context.close();
});

test("rows show an action hint and chevron, 44px targets, EN and AR", async ({ browser }) => {
  for (const lang of ["en", "ar"]) {
    const a = await setup(browser, [mk("n1", "x", "./#plan?day=2026-10-01"), mk("n2", "y", "./#checkin")], { lang });
    await a.page.click("#tbBell");
    await expect(a.page.locator(".notif-item")).toHaveCount(2);
    const hints = await a.page.locator(".notif-item-hint").allTextContents();
    expect(hints).toEqual(lang === "ar" ? ["سجّل أو خذ راحة", "افتح التسجيل الأسبوعي"] : ["Log or rest", "Open check-in"]);
    await expect(a.page.locator(".notif-chev")).toHaveCount(2);
    await a.page.evaluate(() => Promise.all(document.querySelector(".notif-panel").getAnimations().map((x) => x.finished)));
    for (const b of await a.page.locator(".notif-item").all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await a.context.close();
  }
});
