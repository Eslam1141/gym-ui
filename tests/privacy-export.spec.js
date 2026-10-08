const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

// ZIP export: GET /me/export?format=zip (see privacy.js).
test.setTimeout(45000);
const T = { timeout: 8000 };
const ZIP = Buffer.from("PK\u0003\u0004zip");
const zipRoute = (headers) => (route) => route.fulfill({
  status: 200, body: ZIP,
  headers: Object.assign({ "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="etqadem-export-2026-10-08.zip"' }, headers || {})
});
const errRoute = (status, code, headers) => (route) => route.fulfill({
  status, contentType: "application/json", headers: headers || {}, body: JSON.stringify({ error: { code, message: "x" } })
});
const EXPORT = "**/api/v1/me/export*";
const openExport = async (browser, lang) => {
  const app = await openApp(browser, { signedIn: true, lang });
  await app.page.waitForFunction(() => document.getElementById("pvDownload"), null, T);
  return app;
};
const clickDownload = (page) => page.evaluate(() => document.getElementById("pvDownload").click());

test("filenameFrom parses Content-Disposition and falls back to a dated .zip", async ({ browser }) => {
  const { context, page } = await openExport(browser);
  const names = await page.evaluate(() => {
    const f = (cd) => GymPrivacy._test.filenameFrom({ headers: new Headers(cd ? { "Content-Disposition": cd } : {}) });
    return [
      f('attachment; filename="etqadem-export-2026-10-08.zip"'),
      f("attachment; filename=etqadem-export-2026-10-08.zip"),
      f("attachment; filename*=UTF-8''my%20data.zip"),
      f('attachment; filename="../../evil.zip"'),
      f('attachment; filename="data.json"'),
      f("")
    ];
  });
  expect(names.slice(0, 4)).toEqual(["etqadem-export-2026-10-08.zip", "etqadem-export-2026-10-08.zip", "my data.zip", "evil.zip"]);
  expect(names[4]).toMatch(/^etqadem-export-\d{4}-\d{2}-\d{2}\.zip$/);
  expect(names[5]).toMatch(/^etqadem-export-\d{4}-\d{2}-\d{2}\.zip$/);
  await context.close();
});

test("export requests format=zip with the bearer token and saves the server filename", async ({ browser }) => {
  const { context, page } = await openExport(browser);
  let req;
  await page.route(EXPORT, (route) => { req = route.request(); return zipRoute()(route); });
  const dl = page.waitForEvent("download", T);
  await clickDownload(page);
  expect((await dl).suggestedFilename()).toBe("etqadem-export-2026-10-08.zip");
  expect(new URL(req.url()).searchParams.get("format")).toBe("zip");
  expect(req.headers()["authorization"]).toBe("Bearer tok");
  await expect(page.locator("#pvStatus")).toHaveClass(/is-ok/);
  await expect(page.locator("#pvDownload")).toBeEnabled();
  await context.close();
});

test("button is disabled with a preparing state while the export runs, and re-entry is ignored", async ({ browser }) => {
  const { context, page } = await openExport(browser);
  let hits = 0, release;
  const gate = new Promise((r) => { release = r; });
  await page.route(EXPORT, async (route) => { hits++; await gate; return zipRoute()(route); });
  const dl = page.waitForEvent("download", T);
  await clickDownload(page);
  await expect(page.locator("#pvDownload")).toBeDisabled();
  await expect(page.locator("#pvDownload")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#pvStatus")).toContainText("Preparing your file");
  await page.evaluate(() => { const b = document.getElementById("pvDownload"); b.disabled = false; b.click(); });
  release();
  await dl;
  expect(hits).toBe(1);
  await context.close();
});

test("assistant-unavailable and truncated headers show a warning after saving", async ({ browser }) => {
  const cases = [
    ["X-Export-Assistant-Unavailable", /AI coach data couldn't be included/],
    ["X-Export-Truncated", /only the newest part is included/]
  ];
  for (const [header, text] of cases) {
    const { context, page } = await openExport(browser);
    await page.route(EXPORT, zipRoute({ [header]: "1" }));
    const dl = page.waitForEvent("download", T);
    await clickDownload(page);
    await dl;
    await expect(page.locator("#pvStatus")).toHaveClass(/is-warn/);
    await expect(page.locator("#pvStatus")).toHaveText(text);
    await context.close();
  }
});

test("429 rate_limited rounds Retry-After up to minutes; export_busy speaks seconds; no auto-retry", async ({ browser }) => {
  const { context, page } = await openExport(browser);
  let hits = 0;
  const answer = (code, ra) => page.route(EXPORT, (route) => { hits++; return errRoute(429, code, ra ? { "Retry-After": ra } : {})(route); });
  await answer("rate_limited", "410");
  await clickDownload(page);
  await expect(page.locator("#pvStatus")).toHaveText("You've reached the export limit. Try again in 7 minutes.");
  await expect(page.locator("#pvStatus")).toHaveClass(/is-err/);
  await page.unroute(EXPORT);
  await answer("export_busy", "20");
  await clickDownload(page);
  await expect(page.locator("#pvStatus")).toHaveText("An export is already running. Try again in 20 seconds.");
  await page.unroute(EXPORT);
  await answer("export_busy");
  await clickDownload(page);
  await expect(page.locator("#pvStatus")).toHaveText("An export is already running. Try again shortly.");
  await page.waitForTimeout(300);
  expect(hits).toBe(3);   // one request per click, never an automatic retry
  await context.close();
});

test("429 wait text is natural Arabic (dual, few, many)", async ({ browser }) => {
  const { context, page } = await openExport(browser, "ar");
  const texts = await page.evaluate(() => [60, 120, 180, 660].map((s) => GymPrivacy._test.waitText(s, false)));
  expect(texts).toEqual(["دقيقة", "دقيقتين", "3 دقائق", "11 دقيقة"]);
  await page.route(EXPORT, errRoute(429, "rate_limited", { "Retry-After": "420" }));
  await clickDownload(page);
  await expect(page.locator("#pvStatus")).toHaveText("وصلت إلى حد التصدير. حاول مرة أخرى بعد 7 دقائق.");
  await context.close();
});

test("502 keeps the coach-data message", async ({ browser }) => {
  const { context, page } = await openExport(browser);
  await page.route(EXPORT, errRoute(502, "assistant_export_failed"));
  await clickDownload(page);
  await expect(page.locator("#pvStatus")).toContainText("stopped instead of giving you an incomplete file");
  await context.close();
});

test("a download that dies mid-body shows the interrupted message and saves nothing", async ({ browser }) => {
  const { context, page } = await openExport(browser);
  await page.evaluate(() => {
    const real = window.fetch;
    window.fetch = (u, o) => /\/me\/export/.test(String(u))
      ? Promise.resolve({ ok: true, status: 200, headers: new Headers(), blob: () => Promise.reject(new TypeError("network error")) })
      : real(u, o);
  });
  let saved = false;
  page.on("download", () => { saved = true; });
  await clickDownload(page);
  await expect(page.locator("#pvStatus")).toHaveText("The download was interrupted, so no file was saved. Try again.");
  await expect(page.locator("#pvDownload")).toBeEnabled();
  expect(saved).toBe(false);
  await context.close();
});

// ---- review fixes: stalled body, language switch, both buttons, cross-origin ----
const http = require("http");
const startServer = (handler) => new Promise((resolve) => {
  const sockets = new Set();
  const srv = http.createServer(handler);
  srv.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  srv.listen(0, "localhost", () => resolve({
    base: "http://localhost:" + srv.address().port + "/x",
    close: () => { sockets.forEach((s) => s.destroy()); srv.close(); }
  }));
});
const cors = (req, extra) => Object.assign({
  "Access-Control-Allow-Origin": req.headers.origin || "*",
  "Access-Control-Allow-Headers": "Authorization",
  "Access-Control-Allow-Methods": "GET"
}, extra || {});

test("a body that stalls after the headers hits the export timeout and lands on the interrupted message", async ({ browser }) => {
  const srv = await startServer((req, res) => {
    if (req.method === "OPTIONS") { res.writeHead(204, cors(req)); return res.end(); }
    res.writeHead(200, cors(req, { "Content-Type": "application/zip" }));
    res.write("PK\u0003\u0004");   // headers + a few bytes, then never finishes
  });
  const { context, page } = await openExport(browser);
  await page.evaluate((b) => { GymPrivacy._test.setApiBase(b); GymPrivacy._test.setExportTimeout(1200); }, srv.base);
  let saved = false;
  page.on("download", () => { saved = true; });
  await clickDownload(page);
  await expect(page.locator("#pvDownload")).toBeDisabled();
  await expect(page.locator("#pvStatus")).toHaveText("The download was interrupted, so no file was saved. Try again.", T);
  await expect(page.locator("#pvDownload")).toBeEnabled();
  expect(saved).toBe(false);
  await context.close(); srv.close();
});

test("the 429 message re-translates when the language is switched", async ({ browser }) => {
  const { context, page } = await openExport(browser);
  await page.route(EXPORT, errRoute(429, "rate_limited", { "Retry-After": "420" }));
  await clickDownload(page);
  await expect(page.locator("#pvStatus")).toHaveText("You've reached the export limit. Try again in 7 minutes.");
  await page.evaluate(() => document.getElementById("langBtn").click());
  await expect(page.locator("#pvStatus")).toHaveText("وصلت إلى حد التصدير. حاول مرة أخرى بعد 7 دقائق.");
  await context.close();
});

test("while an export runs both export buttons are busy and both places show the status", async ({ browser }) => {
  const { context, page } = await openExport(browser);
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route(EXPORT, async (route) => { await gate; return zipRoute()(route); });
  await clickDownload(page);
  await expect(page.locator("#pvDownload")).toBeDisabled();
  await page.evaluate(() => document.getElementById("pvDelete").click());
  await expect(page.locator("#pvShDl")).toBeDisabled();
  await expect(page.locator("#pvShDl")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#pvShStatus")).toContainText("Preparing your file");
  await expect(page.locator("#pvStatus")).toContainText("Preparing your file");
  const dl = page.waitForEvent("download", T);
  release();
  await dl;
  await expect(page.locator("#pvShDl")).toBeEnabled();
  await expect(page.locator("#pvShStatus")).toHaveClass(/is-ok/);
  await expect(page.locator("#pvStatus")).toHaveClass(/is-ok/);
  await context.close();
});

test("cross-origin: the UI reads Retry-After and X-Export-* only when the server exposes them", async ({ browser }) => {
  const EXPOSE = "Retry-After, X-Export-Truncated, X-Export-Assistant-Unavailable, Content-Disposition";
  for (const exposed of [true, false]) {
    let limited = false;
    const srv = await startServer((req, res) => {
      if (req.method === "OPTIONS") { res.writeHead(204, cors(req)); return res.end(); }
      const h = cors(req, exposed ? { "Access-Control-Expose-Headers": EXPOSE } : {});
      if (limited) {
        res.writeHead(429, Object.assign(h, { "Content-Type": "application/json", "Retry-After": "420" }));
        return res.end(JSON.stringify({ error: { code: "rate_limited", message: "x" } }));
      }
      res.writeHead(200, Object.assign(h, {
        "Content-Type": "application/zip", "X-Export-Truncated": "1",
        "Content-Disposition": 'attachment; filename="etqadem-export-2026-10-08.zip"'
      }));
      res.end("PK\u0003\u0004zip");
    });
    const { context, page } = await openExport(browser);
    await page.evaluate((b) => GymPrivacy._test.setApiBase(b), srv.base);
    const dl = page.waitForEvent("download", T);
    await clickDownload(page);
    await dl;
    if (exposed) await expect(page.locator("#pvStatus")).toHaveText(/only the newest part is included/);
    else await expect(page.locator("#pvStatus")).toHaveClass(/is-ok/);   // headers hidden by CORS: proves the test is meaningful
    limited = true;
    await clickDownload(page);
    if (exposed) await expect(page.locator("#pvStatus")).toHaveText("You've reached the export limit. Try again in 7 minutes.");
    else await expect(page.locator("#pvStatus")).not.toContainText("7 minutes");
    await context.close(); srv.close();
  }
});
