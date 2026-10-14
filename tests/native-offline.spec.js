// Offline launch screen (native/www/index.html, Capacitor errorPath) and the
// service worker's network timeout. The offline page is served by the static
// server like any file; the live server URL is intercepted so nothing leaves
// the machine.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const PAGE = "/native/www/index.html";
const SERVER = "https://etqadem.cloider.app/app/";

async function open(browser, { hash = "", locale = "en-US", stamp = null, probeOk = false } = {}) {
  const context = await browser.newContext({ locale, serviceWorkers: "block" });
  const nav = [];
  const probes = [];
  await context.route("https://etqadem.cloider.app/**", (r) => {
    const u = r.request().url();
    if (r.request().isNavigationRequest()) {
      nav.push(u);
      return r.fulfill({ contentType: "text/html", body: "<!doctype html><title>app</title><p id=app>app</p>" });
    }
    probes.push(u);
    return probeOk ? r.fulfill({ body: "{}" }) : r.abort();
  });
  if (stamp !== null) {
    await context.addInitScript((s) => { try { localStorage.setItem("etq_offline_try", s); } catch (e) {} }, String(stamp));
  }
  const page = await context.newPage();
  await page.goto(PAGE + hash);
  return { context, page, nav, probes };
}

test("#timeout shows the offline screen at once (EN, LTR)", async ({ browser }) => {
  const { context, page, nav } = await open(browser, { hash: "#timeout" });
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("#title")).toHaveText("You're offline");
  await expect(page.locator("#retry")).toHaveText("Try again");
  expect(await page.evaluate(() => document.documentElement.dir)).toBe("ltr");
  expect(nav).toEqual([]);
  await context.close();
});

test("#lang=ar renders Arabic copy, RTL", async ({ browser }) => {
  const { context, page } = await open(browser, { hash: "#timeout&lang=ar" });
  await expect(page.locator("#title")).toHaveText("أنت غير متصل بالإنترنت");
  await expect(page.locator("#retry")).toHaveText("حاول مرة أخرى");
  expect(await page.evaluate(() => [document.documentElement.dir, document.documentElement.lang])).toEqual(["rtl", "ar"]);
  await context.close();
});

test("Arabic device locale selects Arabic; #lang=en overrides it", async ({ browser }) => {
  let o = await open(browser, { hash: "#timeout", locale: "ar-EG" });
  expect(await o.page.evaluate(() => document.documentElement.dir)).toBe("rtl");
  await o.context.close();
  o = await open(browser, { hash: "#timeout&lang=en", locale: "ar-EG" });
  await expect(o.page.locator("#title")).toHaveText("You're offline");
  expect(await o.page.evaluate(() => document.documentElement.dir)).toBe("ltr");
  await o.context.close();
});

test("a fresh failure silently retries the server once before showing the screen", async ({ browser }) => {
  const { context, page, nav } = await open(browser);
  await page.waitForURL(SERVER);
  expect(nav).toEqual([SERVER]);
  await context.close();
});

test("a recent attempt stamp (the retry also failed) shows the screen instead of looping", async ({ browser }) => {
  const { context, page, nav } = await open(browser, { stamp: Date.now() });
  await expect(page.locator("body")).toBeVisible();
  expect(nav).toEqual([]);
  await context.close();
});

test("Try again navigates to the server and shows the busy state", async ({ browser }) => {
  const { context, page, nav } = await open(browser, { hash: "#timeout" });
  // The page is gone once the navigation commits, so report the button state
  // from a listener registered after the page's own click handler.
  const seen = [];
  await page.exposeFunction("__report", (disabled, text) => seen.push([disabled, text]));
  await page.evaluate(() => document.getElementById("retry").addEventListener("click", () => {
    const b = document.getElementById("retry"); window.__report(b.disabled, b.textContent);
  }));
  await page.locator("#retry").click();
  await page.waitForURL(SERVER);
  expect(nav).toEqual([SERVER]);
  expect(seen).toEqual([[true, "Trying…"]]);
  await context.close();
});

test("recovery: the reachability probe loads the app once the server answers", async ({ browser }) => {
  test.setTimeout(20000);
  const { context, page, nav, probes } = await open(browser, { hash: "#timeout", probeOk: true });
  await page.waitForURL(SERVER, { timeout: 9000 });
  expect(probes.some((u) => u.endsWith("/app/manifest.json"))).toBe(true);
  expect(nav).toEqual([SERVER]);
  await context.close();
});

test("recovery: the browser 'online' event loads the app", async ({ browser }) => {
  const { context, page, nav } = await open(browser, { hash: "#timeout" });
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForURL(SERVER);
  expect(nav).toEqual([SERVER]);
  await context.close();
});

// ---- service worker network timeout -------------------------------------

function loadWorker({ networkHangs, cacheHit }) {
  const src = fs.readFileSync(path.join(__dirname, "..", "service-worker.js"), "utf8");
  const handlers = {};
  const timers = [];
  const cached = { put: () => Promise.resolve() };
  const sandbox = {
    URL,
    Promise,
    self: {
      location: { origin: "https://app.test" },
      addEventListener: (t, fn) => { handlers[t] = fn; },
      skipWaiting() {}, clients: { claim() {} }
    },
    caches: {
      match: (req) => Promise.resolve(cacheHit ? { cached: true, req } : undefined),
      open: () => Promise.resolve(cached),
      keys: () => Promise.resolve([])
    },
    fetch: () => networkHangs ? new Promise(() => {}) : Promise.resolve({ status: 200, clone() { return this; }, live: true }),
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    console
  };
  vm.runInNewContext(src, sandbox);
  const run = (req) => {
    let responded;
    handlers.fetch({ request: req, respondWith: (p) => { responded = p; } });
    return responded;
  };
  return { run, timers };
}

const GET = (p) => ({ method: "GET", url: "https://app.test" + p, mode: "navigate" });

test("SW: a hung network serves the cached copy after the timeout", async () => {
  const { run, timers } = loadWorker({ networkHangs: true, cacheHit: true });
  const p = run(GET("/app.js"));
  expect(timers.length).toBe(1);
  expect(timers[0].ms).toBe(4000);
  timers[0].fn();
  expect(await p).toMatchObject({ cached: true });
});

test("SW: a hung network with nothing cached keeps waiting (no bogus response)", async () => {
  const { run, timers } = loadWorker({ networkHangs: true, cacheHit: false });
  const p = run(GET("/app.js"));
  timers[0].fn();
  const winner = await Promise.race([p.then(() => "settled"), new Promise((r) => setImmediate(() => r("pending")))]);
  expect(winner).toBe("pending");
});

test("SW: a healthy network response wins over the cache", async () => {
  const { run } = loadWorker({ networkHangs: false, cacheHit: true });
  expect(await run(GET("/app.js"))).toMatchObject({ live: true });
});
