const { test, expect } = require("@playwright/test");

// Owner report: signed in with Google, started the workout timer, the session
// ended, the app asked to sign in again and the timer was gone. An expired
// session must never destroy the same user's in-progress local work; a
// DIFFERENT account signing in still wipes the previous one's data.

test.setTimeout(60000);
const T = { timeout: 8000 };
const NOW = "2026-10-02T07:00:00Z";
const NOW_S = Math.floor(Date.parse(NOW) / 1000);
const MIN = 60 * 1000;
const REFRESH_KEY = "gymauth_refresh";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (c) => b64({ alg: "none" }) + "." + b64(c) + ".sig";

function makeBackend() {
  const s = { n: 0, clockS: 0, valid: new Set(), rt: null, user: { id: "uid-1", gsub: "g-1" }, refreshMode: "ok", log: [] };
  s.pair = () => {
    const at = jwt({ iss: "gym-be", sub: s.user.id, gsub: s.user.gsub, email: "t@example.com", name: "Tester", jti: ++s.n, exp: NOW_S + s.clockS + 900 });
    s.valid.add(at);
    s.rt = "rt-" + (++s.n);
    return { accessToken: at, accessExpiresAt: new Date((NOW_S + s.clockS + 900) * 1000).toISOString(), refreshToken: s.rt, refreshExpiresAt: new Date((NOW_S + 86400 * 60) * 1000).toISOString() };
  };
  return s;
}

async function mockBackend(context, s) {
  await context.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, "");
    let body = {};
    try { body = JSON.parse(req.postData() || "{}"); } catch (e) {}
    s.log.push({ method: req.method(), path: p });
    const json = (status, b) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    const err = (status, code) => json(status, { error: { code, message: code } });
    if (p === "/auth/session") return json(200, s.pair());
    if (p === "/auth/refresh") {
      if (s.refreshMode === "net") return route.abort("failed");
      if (s.refreshMode === "401") return err(401, "unauthorized");
      if (s.refreshMode === "500") return err(500, "internal");
      return body.refreshToken === s.rt ? json(200, s.pair()) : err(401, "unauthorized");
    }
    if (p === "/auth/logout") return route.fulfill({ status: 204 });
    const tok = (req.headers()["authorization"] || "").replace(/^Bearer /, "");
    if (!s.valid.has(tok)) return err(401, "unauthorized");
    if (p === "/me") return json(200, { id: s.user.id, email: "t@example.com", displayName: "Tester", currentStreak: 0, totalDaysTrained: 0, todayDone: false, todayRested: false, trainingDays: [] });
    if (p === "/progress") return json(200, { entries: s.progress || {} });
    if (p === "/workouts/complete" && req.method() === "GET") return json(200, { records: [], restDays: [], restDaysLeftThisWeek: 2 });
    return err(404, "not_found");
  });
}

const GIS_STUB = `
window.__gis = { cfg: null, prompts: 0 };
window.google = { accounts: { id: {
  initialize: function (c) { window.__gis.cfg = c; },
  renderButton: function () {},
  prompt: function () { window.__gis.prompts++; },
  disableAutoSelect: function () {}
} } };`;

async function open(browser, s, ls) {
  const context = await browser.newContext({ timezoneId: "Africa/Cairo", locale: "en-US", serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  await mockBackend(context, s);
  await context.route("**/config.js", (r) => r.fulfill({ contentType: "application/javascript", body: 'window.GYM_API_BASE="";window.GOOGLE_CLIENT_ID="web.apps.googleusercontent.com";window.GYM_APP_HOST="";' }));
  await context.route("https://accounts.google.com/**", (r) => r.fulfill({ contentType: "application/javascript", body: GIS_STUB }));
  await context.addInitScript((seed) => {
    try {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      const base = { gym_lang: "en", gym_onboarded: "1", gym_terms_ok: "terms.v1", gym_plan: "male", gym_style: "gym", gym_theme: "dark",
        gym_tours_seen: JSON.stringify({ plan: 2, coach: 2, food: 2, more: 2, watch: 1, watchOff: 1, bubble: 1 }) };
      Object.assign(base, seed);
      Object.keys(base).forEach((k) => { if (base[k] !== "") localStorage.setItem(k, base[k]); });
    } catch (e) {}
  }, Object.assign({ gym_anon: "1" }, ls || {}));
  const page = await context.newPage();
  await page.clock.install({ time: new Date(NOW) });
  await page.goto("/index.html");
  await page.waitForFunction(() => window.GymSync && window.GymUI && window.__gis && window.__gis.cfg);
  return { context, page };
}

const cred = (sub) => jwt({ iss: "accounts.google.com", sub: sub || "g-1", email: "t@example.com", name: "Tester", exp: NOW_S + 3000 });
const signIn = (page, sub) => page.evaluate((c) => window.__gis.cfg.callback({ credential: c }), cred(sub));
const active = (page) => page.evaluate(() => localStorage.getItem("gym_session_active"));
const elapsed = (page) => page.evaluate(() => sessionElapsedSec());

async function startTimer(page) {
  await page.waitForFunction(() => document.getElementById("sessionBtn"));
  await page.evaluate(() => document.getElementById("sessionBtn").click());
  await expect.poll(() => active(page)).not.toBeNull();
}

async function signedInWithTimer(browser, s) {
  const o = await open(browser, s);
  await signIn(o.page, "g-1");
  await o.page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  await startTimer(o.page);
  return o;
}

test("same account signs back in after the session ended: timer keeps running, elapsed time intact", async ({ browser }) => {
  const s = makeBackend();
  const { context, page } = await signedInWithTimer(browser, s);
  await page.clock.fastForward(5 * MIN);
  const before = await elapsed(page);
  expect(before).toBeGreaterThanOrEqual(299);
  s.refreshMode = "401"; s.clockS = 13 * 60;
  await page.clock.fastForward(8 * MIN);
  await expect(page.locator("#onboarding")).toBeVisible(T);
  expect(await page.evaluate(() => GymSync.isSignedIn())).toBe(false);
  expect(await active(page)).not.toBeNull(); // lost session != lost work
  s.refreshMode = "ok";
  await signIn(page, "g-1");
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  await page.clock.fastForward(5000);
  expect(await active(page)).not.toBeNull();
  expect(await elapsed(page)).toBeGreaterThanOrEqual(before + 8 * 60);
  // what the user sees: "End Workout" and a running clock, not a fresh "Start Workout"
  await expect(page.locator("#sessionBtn")).toHaveClass(/stop/);
  await expect(page.locator("#sessionTime")).not.toHaveText("00:00:00");
  await context.close();
});

test("a different account signing in still wipes the previous user's local data", async ({ browser }) => {
  const s = makeBackend();
  const { context, page } = await signedInWithTimer(browser, s);
  s.refreshMode = "401"; s.clockS = 13 * 60;
  await page.clock.fastForward(13 * MIN);
  await expect(page.locator("#onboarding")).toBeVisible(T);
  s.user = { id: "uid-2", gsub: "g-2" }; s.refreshMode = "ok";
  await Promise.all([page.waitForEvent("load"), signIn(page, "g-2")]);
  expect(await active(page)).toBeNull();
  await context.close();
});

test("cold start with a stored refresh token and no network keeps the session and the timer, no login screen", async ({ browser }) => {
  const s = makeBackend();
  s.rt = "rt-seed";
  const live = JSON.stringify({ dayId: "m_upper", startedAt: Date.parse(NOW) - 600000, running: true, accumSec: 0, segStart: Date.parse(NOW) - 600000 });
  s.refreshMode = "net";
  const { context, page } = await open(browser, s, { gym_anon: "", gym_user_sub: "g-1", gym_session_active: live, [REFRESH_KEY]: JSON.stringify({ rt: "rt-seed", rexp: (NOW_S + 86400 * 30) * 1000, method: "google" }) });
  await page.clock.fastForward(20000); // past the 8 s "resolving" cap
  await expect(page.locator("#onboarding")).toBeHidden();
  expect(await active(page)).not.toBeNull();
  expect(await page.evaluate((k) => localStorage.getItem(k), REFRESH_KEY)).not.toBeNull();
  s.refreshMode = "ok";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  expect(await active(page)).not.toBeNull();
  await context.close();
});

test("offline when the access token expires: no login screen, timer keeps running, session restores when back online", async ({ browser }) => {
  const s = makeBackend();
  const { context, page } = await signedInWithTimer(browser, s);
  s.refreshMode = "net"; s.clockS = 20 * 60;
  await context.setOffline(true);
  await page.clock.fastForward(20 * MIN);
  await expect(page.locator("#onboarding")).toBeHidden();
  expect(await active(page)).not.toBeNull();
  expect(await elapsed(page)).toBeGreaterThanOrEqual(20 * 60 - 1);
  await context.setOffline(false);
  s.refreshMode = "ok";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  await expect(page.locator("#onboarding")).toBeHidden();
  expect(await active(page)).not.toBeNull();
  await context.close();
});

test("session ended, app reopened (cold), same account signs in: timer intact", async ({ browser }) => {
  const s = makeBackend();
  const { context, page } = await signedInWithTimer(browser, s);
  await page.clock.fastForward(5 * MIN);
  s.refreshMode = "401"; s.clockS = 13 * 60;
  await page.clock.fastForward(8 * MIN);
  await expect(page.locator("#onboarding")).toBeVisible(T);
  const before = await active(page);
  await page.reload();
  await page.waitForFunction(() => window.GymSync && window.__gis && window.__gis.cfg);
  await expect(page.locator("#onboarding")).toBeVisible(T);
  expect(await active(page)).toBe(before);
  s.refreshMode = "ok";
  await signIn(page, "g-1");
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  await page.waitForTimeout(500);
  expect(await active(page)).toBe(before);
  await expect(page.locator("#sessionBtn")).toHaveClass(/stop/);
  await expect(page.locator("#sessionTime")).not.toHaveText("00:00:00");
  await context.close();
});

test("another device's newer 'current day' arrives with the sync pull: the running timer's day stays on screen", async ({ browser }) => {
  const s = makeBackend();
  const { context, page } = await signedInWithTimer(browser, s);
  await page.clock.fastForward(5 * MIN);
  const info = await page.evaluate(() => ({ key: activeDayStoreKey(), run: activeSession.dayId, other: DAYS.find((d) => d.id !== activeSession.dayId).id }));
  s.progress = { [info.key]: { value: info.other, updatedAt: new Date(Date.parse(NOW) + 3600 * 1000).toISOString() } };
  await Promise.all([page.waitForEvent("load"), page.evaluate(() => window.dispatchEvent(new Event("online")))]);
  await page.waitForFunction(() => window.GymSync && window.GymUI);
  expect(await active(page)).not.toBeNull();
  await expect(page.locator("#sessionBtn")).toHaveClass(/stop/);
  await expect(page.locator("#sessionTime")).not.toHaveText("00:00:00");
  await context.close();
});

test("a failed cold-start refresh is retried on a backoff, with no online event needed", async ({ browser }) => {
  const s = makeBackend();
  s.rt = "rt-seed";
  s.refreshMode = "net";
  const { context, page } = await open(browser, s, { gym_anon: "", gym_user_sub: "g-1", [REFRESH_KEY]: JSON.stringify({ rt: "rt-seed", rexp: (NOW_S + 86400 * 30) * 1000, method: "google" }) });
  await page.clock.fastForward(12000);
  expect(await page.evaluate(() => GymSync.isSignedIn())).toBe(false);
  s.refreshMode = "ok";
  await page.clock.fastForward(20000);
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  await context.close();
});

test("ticked sets, weights and the timer all survive a lost session and a same-account sign-in", async ({ browser }) => {
  const s = makeBackend();
  const { context, page } = await signedInWithTimer(browser, s);
  await page.evaluate(() => {
    localStorage.setItem("gym_weights", JSON.stringify({ probe: 42 }));
    localStorage.setItem("gym_setchecks", JSON.stringify({ probe: { a: [true] } }));
  });
  const snap = () => page.evaluate(() => ["gym_weights", "gym_setchecks", "gym_session_active"].map((k) => localStorage.getItem(k)));
  const before = await snap();
  s.refreshMode = "401"; s.clockS = 13 * 60;
  await page.clock.fastForward(13 * MIN);
  await expect(page.locator("#onboarding")).toBeVisible(T);
  expect(await snap()).toEqual(before);
  s.refreshMode = "ok";
  await signIn(page, "g-1");
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  expect(await snap()).toEqual(before);
  await context.close();
});

test("a 500 from /auth/refresh on cold start does not sign the user out", async ({ browser }) => {
  const s = makeBackend();
  s.rt = "rt-seed";
  s.refreshMode = "500";
  const { context, page } = await open(browser, s, { gym_anon: "", gym_user_sub: "g-1", [REFRESH_KEY]: JSON.stringify({ rt: "rt-seed", rexp: (NOW_S + 86400 * 30) * 1000, method: "google" }) });
  await page.clock.fastForward(20000);
  await expect(page.locator("#onboarding")).toBeHidden();
  expect(await page.evaluate((k) => localStorage.getItem(k), REFRESH_KEY)).not.toBeNull();
  await context.close();
});
