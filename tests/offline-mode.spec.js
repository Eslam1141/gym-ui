const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { openApp } = require("./helpers");

// Offline behaviour (net.js): a banner while the app keeps working, a full screen only
// when there is no way into the app, "needs internet" for server features, a toast on
// reconnect, and a warning before signing out with unsynced changes. Reachability is a
// probe of /api/v1/healthz, so "offline" is both context.setOffline and an unreachable API.

test.setTimeout(45000);
const T = { timeout: 8000 };
const BANNER = "You're offline. Your progress is saved on this phone and will sync when you're back online.";

// /progress accepts the push unless server.progressStatus says otherwise.
const progressRoute = (setup) => async (context, server) => {
  server.progressStatus = 200;
  await context.route("**/api/v1/progress", (r) => server.progressStatus === -1 ? r.abort("failed") : server.progressStatus === 200
    ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ entries: {} }) })
    : r.fulfill({ status: server.progressStatus, contentType: "application/json", body: "{}" }));
  if (setup) await setup(context, server);
};
// off()/on(): the phone loses / regains its network. Mocked routes still answer while a context is offline, so /progress is made to fail too.
const signedIn = async (browser, o) => {
  const r = await openApp(browser, Object.assign({ signedIn: true, sub: "u1", setup: progressRoute() }, o));
  r.off = async () => { r.server.progressStatus = -1; await r.context.setOffline(true); };
  r.on = async () => { r.server.progressStatus = 200; await r.context.setOffline(false); };
  return r;
};
const toastText = (page) => page.locator("#gymToast.show .gym-toast-msg");
const markUnsynced = (page) => page.evaluate(() => {
  localStorage.setItem("gym_weights", JSON.stringify({ probe: 42 }));
  GymSync.onLocalWrite("gym_weights");
});

test("a drop mid-use shows the banner, keeps the app working, then toasts when synced", async ({ browser }) => {
  const { context, page, off, on } = await signedIn(browser);
  await expect(page.locator("#netBanner")).toBeHidden();
  await off();
  await expect(page.locator("#netBanner")).toBeVisible(T);
  await expect(page.locator("#netBanner .net-banner-msg")).toHaveText(BANNER);
  await expect(page.locator("#netScreen")).toBeHidden();
  // plan, timer and ticks are local: they keep working
  await page.evaluate(() => document.getElementById("sessionBtn").click());
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gym_session_active")), T).not.toBeNull();
  await markUnsynced(page);
  expect(await page.evaluate(() => GymSync.hasUnsynced())).toBe(true);
  await on();
  await expect(page.locator("#netBanner")).toBeHidden(T);
  await expect(toastText(page)).toHaveText("Back online, synced", T);
  expect(await page.evaluate(() => GymSync.hasUnsynced())).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("gym_session_active"))).not.toBeNull();
  await context.close();
});

test("back online with a push that still fails says so plainly", async ({ browser }) => {
  const { context, page, server, off, on } = await signedIn(browser);
  await off();
  await expect(page.locator("#netBanner")).toBeVisible(T);
  await markUnsynced(page);
  server.progressStatus = 500; // the network is back but the push is refused
  await context.setOffline(false);
  await expect(toastText(page)).toHaveText("Back online. Some changes aren't synced yet. We'll keep trying.", T);
  await context.close();
});

test("the banner can be dismissed and comes back on the next drop", async ({ browser }) => {
  const { context, page, off, on } = await signedIn(browser);
  await off();
  await expect(page.locator("#netBanner")).toBeVisible(T);
  await page.locator("#netBanner .net-banner-x").click();
  await expect(page.locator("#netBanner")).toBeHidden();
  await on();
  await expect(toastText(page)).toBeVisible(T);
  await off();
  await expect(page.locator("#netBanner")).toBeVisible(T);
  await context.close();
});

test("Arabic: banner copy and RTL", async ({ browser }) => {
  const { context, page, off, on } = await signedIn(browser, { lang: "ar" });
  await off();
  await expect(page.locator("#netBanner")).toBeVisible(T);
  await expect(page.locator("#netBanner .net-banner-msg")).toHaveText("أنت غير متصل. تقدمك محفوظ على هذا الهاتف وستتم مزامنته عند عودة الاتصال.");
  expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
  const box = await page.locator("#netBanner").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await context.close();
});

test("coach and chat say 'needs internet' instead of failing", async ({ browser }) => {
  const { context, page, off, on } = await signedIn(browser);
  await off();
  await expect(page.locator("#netBanner")).toBeVisible(T);
  await page.evaluate(() => GymUI.navigate("coach"));
  await expect(page.locator("#coachBody .net-card")).toBeVisible(T);
  await expect(page.locator("#coachBody .net-card-title")).toHaveText("This needs internet");
  // the chat's send button: no request, an inline note
  const asked = [];
  page.on("request", (r) => { if (/\/coach\/chat/.test(r.url())) asked.push(r.url()); });
  await page.evaluate(() => document.getElementById("coachChatSend").click());
  await expect(page.locator(".net-need")).toHaveText("Needs internet. Try again when you're back online.");
  expect(asked).toEqual([]);
  // back online: the card goes away by itself
  await on();
  await expect(page.locator("#coachBody .net-card")).toHaveCount(0, T);
  await expect(page.locator(".net-need")).toHaveCount(0);
  await context.close();
});

test("food tab says 'needs internet' while offline", async ({ browser }) => {
  const { context, page, off, on } = await signedIn(browser);
  await off();
  await expect(page.locator("#netBanner")).toBeVisible(T);
  await page.evaluate(() => GymUI.navigate("food"));
  await expect(page.locator("#foodBody .net-card")).toBeVisible(T);
  await context.close();
});

test("signing out with unsynced changes asks first; nothing unsynced signs out at once", async ({ browser }) => {
  const { context, page, off, on } = await signedIn(browser);
  const signOut = () => page.evaluate(() => { const b = document.getElementById("tbMenuSignOut"); if (b) b.click(); });
  await page.waitForFunction(() => document.getElementById("tbMenuSignOut"));
  await off();
  await expect(page.locator("#netBanner")).toBeVisible(T);
  await markUnsynced(page);
  await signOut();
  const dlg = page.locator(".net-confirm");
  await expect(dlg).toBeVisible(T);
  await expect(dlg.locator(".syd-body")).toHaveText("You have changes not synced yet. Signing out now will remove them from this phone.");
  await dlg.getByRole("button", { name: "Stay signed in" }).click();
  await expect(dlg).toHaveCount(0);
  expect(await page.evaluate(() => GymSync.isSignedIn())).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("gym_weights"))).not.toBeNull();
  await page.waitForTimeout(1100); // the sign-out button's 1 s double-tap guard
  await signOut();
  await dlg.getByRole("button", { name: "Sign out anyway" }).click();
  await expect.poll(() => page.evaluate(() => GymSync.isSignedIn()), T).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("gym_weights"))).toBeNull();
  await context.close();
});

test("signing out with everything synced does not ask", async ({ browser }) => {
  const { context, page, off, on } = await signedIn(browser);
  await page.waitForFunction(() => document.getElementById("tbMenuSignOut"));
  expect(await page.evaluate(() => GymSync.hasUnsynced())).toBe(false);
  await page.evaluate(() => document.getElementById("tbMenuSignOut").click());
  await expect.poll(() => page.evaluate(() => GymSync.isSignedIn()), T).toBe(false);
  await expect(page.locator(".net-confirm")).toHaveCount(0);
  await context.close();
});

// A lapsed session on a device with no network: nothing to open, so a full screen. The
// browser's onLine is forced (a Playwright context can't be offline AND serve the app).
async function lapsedOffline(browser, opts) {
  return openApp(browser, Object.assign({
    sub: "u1", setup: async (context, server) => {
      server.up = false;
      await context.addInitScript(() => {
        window.__onLine = false;
        Object.defineProperty(navigator, "onLine", { get: () => window.__onLine });
      });
      await context.route("**/api/v1/healthz*", (r) => (server.up ? r.fulfill({ status: 200, body: "ok" }) : r.abort("failed")));
    }
  }, opts));
}

test("first open with no way in and no network: the full offline screen, EN", async ({ browser }) => {
  const { context, page, server } = await lapsedOffline(browser);
  const screen = page.locator("#netScreen");
  await expect(screen).toBeVisible(T);
  await expect(screen.locator(".net-screen-title")).toHaveText("You're offline");
  await expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.locator("#netBanner")).toBeHidden();
  // Try again while still offline: says so
  await screen.getByRole("button", { name: "Try again" }).click();
  await expect(screen.locator(".net-screen-msg")).toHaveText("Still offline. Check your Wi-Fi or mobile data.", T);
  // the network returns: the 'online' event retries by itself and the screen leaves
  server.up = true;
  await page.evaluate(() => { window.__onLine = true; window.dispatchEvent(new Event("online")); });
  await expect(screen).toBeHidden(T);
  await context.close();
});

test("the offline screen in Arabic is RTL", async ({ browser }) => {
  const { context, page } = await lapsedOffline(browser, { lang: "ar" });
  const screen = page.locator("#netScreen");
  await expect(screen).toBeVisible(T);
  await expect(screen.locator(".net-screen-title")).toHaveText("أنت غير متصل بالإنترنت");
  await expect(screen.getByRole("button", { name: "حاول مرة أخرى" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
  await context.close();
});

test("a guest (continue without signing in) is never blocked offline: banner only", async ({ browser }) => {
  const { context, page } = await lapsedOffline(browser, { sub: undefined });
  await expect(page.locator("#netBanner")).toBeVisible(T);
  await expect(page.locator("#netScreen")).toBeHidden();
  await context.close();
});

test("cold start offline with a saved session: no screen, no login, banner, timer kept", async ({ browser }) => {
  const live = { dayId: "m_upper", startedAt: Date.parse("2026-10-02T06:50:00Z"), running: true, accumSec: 0, segStart: Date.parse("2026-10-02T06:50:00Z") };
  const { context, page } = await openApp(browser, {
    sub: "u1", ls: { gymauth_refresh: undefined, gym_session_active: live },
    setup: async (ctx) => {
      await ctx.addInitScript(() => {
        try {
          if (sessionStorage.getItem("__r")) return;
          sessionStorage.setItem("__r", "1");
          localStorage.setItem("gymauth_refresh", JSON.stringify({ rt: "rt-1", rexp: Date.now() + 86400000, method: "google" }));
        } catch (e) {}
        window.__onLine = false;
        Object.defineProperty(navigator, "onLine", { get: () => window.__onLine });
      });
      await ctx.route("**/api/v1/auth/refresh", (r) => r.abort("failed"));
      await ctx.route("**/api/v1/healthz*", (r) => r.abort("failed"));
    }
  });
  await expect(page.locator("#netBanner")).toBeVisible(T);
  await expect(page.locator("#netScreen")).toBeHidden();
  await page.clock.fastForward(20000);
  await expect(page.locator("#onboarding")).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("gym_session_active"))).not.toBeNull();
  await context.close();
});

test("a blip does not flash the banner: one failed probe while the browser says online", async ({ browser }) => {
  let failOnce = 1;
  const { context, page, off, on } = await signedIn(browser, {
    setup: progressRoute(async (ctx) => {
      await ctx.route("**/api/v1/healthz*", (r) => (failOnce-- > 0 ? r.abort("failed") : r.fulfill({ status: 200, body: "ok" })));
    })
  });
  await page.evaluate(() => GymNet.suspect());
  await page.waitForTimeout(2500);
  await expect(page.locator("#netBanner")).toBeHidden();
  expect(await page.evaluate(() => GymNet.isOnline())).toBe(true);
  await context.close();
});

test("offline.html: copy, Try again and the still-offline message", async ({ browser }) => {
  const context = await browser.newContext({ ...(process.env.PW_BASE ? { baseURL: process.env.PW_BASE } : {}), serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  await context.route("**/manifest.json*", (r) => r.abort("failed"));
  const page = await context.newPage();
  await page.goto("/offline.html");
  await expect(page.locator("#netScreenTitle")).toHaveText("You're offline");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("#netMsg")).toHaveText("Still offline. Check your Wi-Fi or mobile data.", T);
  await context.close();
});

test("the service worker precaches the offline page and falls back to it; the image build ships net.js and offline.*", () => {
  const root = path.join(__dirname, "..");
  const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
  const docker = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  for (const f of ["net.js", "offline.html", "offline.js"]) {
    expect(sw).toContain('"./' + f + '"');
    expect(docker.match(new RegExp("\\b" + f.replace(".", "\\.") + "\\b", "g")).length).toBeGreaterThanOrEqual(2); // COPY + HASH
  }
  expect(sw).toContain('caches.match("./offline.html")');
});
