// "Mark all as read" in the notifications panel: optimistic, guarded, restores
// on failure, falls back to per-item reads while /notifications/read-all is 404.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);

const AGO = (m) => new Date(Date.parse("2026-10-02T07:00:00Z") - m * 60000).toISOString();
function seed(unread) {
  return [
    { id: "n1", title: "Upper A today", body: "Bench, rows, shoulders.", createdAt: AGO(5), readAt: unread >= 1 ? null : AGO(1) },
    { id: "n2", title: "Streak at risk", body: "Log a workout to keep it.", createdAt: AGO(90), readAt: unread >= 2 ? null : AGO(1) },
    { id: "n3", title: "Welcome", body: "Glad you are here.", createdAt: AGO(2000), readAt: unread >= 3 ? null : AGO(1) }
  ];
}

// readAll: 200 | 404 | 500 ; perItem: status for /{id}/read
async function setup(browser, o) {
  const app = await openApp(browser, { signedIn: true, lang: o.lang });
  const state = { items: seed(o.unread), posts: [] };
  await app.context.route("**/api/v1/notifications**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, "");
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (req.method() === "GET") {
      return json(200, { items: state.items, unreadCount: state.items.filter((i) => !i.readAt).length });
    }
    state.posts.push(path);
    if (path === "/notifications/read-all") {
      if (o.readAll === 200) return json(200, { updated: 3 });
      return json(o.readAll, { error: { code: "x", message: "x" } });
    }
    return json(o.perItem || 200, { ok: true });
  });
  await app.page.reload();
  await app.page.waitForFunction(() => window.GymNotifications && document.getElementById("tbBell"));
  return Object.assign(app, { state });
}

async function openPanel(page) {
  await page.click("#tbBell");
  await expect(page.locator(".notif-panel")).toBeVisible();
  await expect(page.locator(".notif-item")).toHaveCount(3);
}

test("hidden at 0 unread, visible with unread", async ({ browser }) => {
  const a = await setup(browser, { unread: 0, readAll: 200 });
  await openPanel(a.page);
  await expect(a.page.locator("#notifReadAllBtn")).toBeHidden();
  await a.context.close();
  const b = await setup(browser, { unread: 2, readAll: 200 });
  await openPanel(b.page);
  await expect(b.page.locator("#notifReadAllBtn")).toBeVisible();
  await expect(b.page.locator("#notifReadAllBtn")).toHaveText("Mark all as read");
  const box = await b.page.locator("#notifReadAllBtn").boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await b.context.close();
});

test("tap clears badge and dots and POSTs read-all once", async ({ browser }) => {
  const { context, page, state } = await setup(browser, { unread: 3, readAll: 200 });
  await expect(page.locator("#tbBellBadge")).toHaveText("3");
  await openPanel(page);
  await expect(page.locator(".notif-dot")).toHaveCount(3);
  await page.locator("#notifReadAllBtn").dblclick();
  await expect(page.locator("#tbBellBadge")).toBeHidden();
  await expect(page.locator(".notif-dot")).toHaveCount(0);
  await expect(page.locator("#notifReadAllBtn")).toBeHidden();
  await expect(page.locator("#notifLive")).toHaveText("All notifications marked as read");
  expect(state.posts).toEqual(["/notifications/read-all"]);
  await context.close();
});

test("failure restores badge and dots and shows a toast", async ({ browser }) => {
  const { context, page, state } = await setup(browser, { unread: 3, readAll: 500 });
  await openPanel(page);
  await page.click("#notifReadAllBtn");
  await expect(page.locator("#gymToast")).toContainText("Couldn't mark notifications as read");
  await expect(page.locator("#tbBellBadge")).toHaveText("3");
  await expect(page.locator(".notif-dot")).toHaveCount(3);
  await expect(page.locator("#notifReadAllBtn")).toBeVisible();
  expect(state.posts).toEqual(["/notifications/read-all"]);
  await context.close();
});

test("404 falls back to per-item reads", async ({ browser }) => {
  const { context, page, state } = await setup(browser, { unread: 2, readAll: 404 });
  await openPanel(page);
  await page.click("#notifReadAllBtn");
  await expect(page.locator("#tbBellBadge")).toBeHidden();
  await expect.poll(() => state.posts.length).toBe(3);
  expect(state.posts.slice().sort()).toEqual(["/notifications/n1/read", "/notifications/n2/read", "/notifications/read-all"]);
  await expect(page.locator(".notif-dot")).toHaveCount(0);
  await context.close();
});

test("404 fallback failing restores state", async ({ browser }) => {
  const { context, page } = await setup(browser, { unread: 2, readAll: 404, perItem: 500 });
  await openPanel(page);
  await page.click("#notifReadAllBtn");
  await expect(page.locator("#gymToast")).toContainText("Couldn't mark");
  await expect(page.locator("#tbBellBadge")).toHaveText("2");
  await expect(page.locator(".notif-dot")).toHaveCount(2);
  await context.close();
});
