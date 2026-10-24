const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

// App-session client: the app trades its Google / password sign-in for a
// gym-be session (15 min access JWT + rotating refresh token). Mocked API,
// fake clock, stub Google Identity Services.

test.setTimeout(45000);
const T = { timeout: 8000 };
const NOW = "2026-10-02T07:00:00Z";
const NOW_S = Math.floor(Date.parse(NOW) / 1000);
const TODAY = "2026-10-02";
const REFRESH_KEY = "gymauth_refresh";
const MIN = 60 * 1000;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (claims) => b64({ alg: "none" }) + "." + b64(claims) + ".sig";

// In-memory gym-be: /auth/session, /auth/refresh, /auth/logout plus a few
// token-checked endpoints. `s` is mutable from the test.
function makeBackend(over) {
  const s = Object.assign({
    n: 0, clockS: 0, valid: new Set(), rt: null, prevRt: null, prevAt: 0, lastResult: null,
    dropNextRefresh: 0, refreshStatus: 0, sessionResponses: [], user: { id: "uid-1", gsub: "g-1", email: "t@example.com", name: "Tester" },
    deleteReauth: false, log: []
  }, over || {});
  s.mintAccess = () => {
    const t = jwt({ iss: "gym-be", sub: s.user.id, gsub: s.user.gsub || undefined, email: s.user.email, name: s.user.name, sid: "s1", jti: ++s.n, exp: NOW_S + s.clockS + 900 });
    s.valid.add(t);
    return t;
  };
  s.mintPair = () => {
    const result = {
      accessToken: s.mintAccess(), accessExpiresAt: new Date((NOW_S + s.clockS + 900) * 1000).toISOString(),
      refreshToken: "rt-" + (++s.n), refreshExpiresAt: new Date((NOW_S + 86400 * 60) * 1000).toISOString()
    };
    s.prevRt = s.rt; s.rt = result.refreshToken; s.lastResult = result;
    return result;
  };
  return s;
}

async function mockBackend(context, s) {
  await context.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1/, "");
    let body = {};
    try { body = JSON.parse(req.postData() || "{}"); } catch (e) {}
    const auth = req.headers()["authorization"] || "";
    s.log.push({ method: req.method(), path: p, body, auth });
    const json = (status, b, headers) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b), headers });
    const err = (status, code) => json(status, { error: { code, message: code } });

    if (p === "/auth/session") {
      const forced = s.sessionResponses.shift();
      if (forced) return forced.status === 200 ? json(200, s.mintPair()) : err(forced.status, forced.code);
      const raw = body.idToken || auth.replace(/^Bearer /, "");
      const claims = JSON.parse(Buffer.from(raw.split(".")[1] || "e30", "base64url").toString() || "{}");
      if (claims.stale) return err(401, "stale_token");
      return json(200, s.mintPair());
    }
    if (p === "/auth/refresh") {
      if (s.dropNextRefresh > 0) {
        s.dropNextRefresh--;
        if (body.refreshToken === s.rt) s.mintPair(); // the server rotated; only the response is lost
        return route.abort("failed");
      }
      if (s.refreshStatus) return err(s.refreshStatus, "unauthorized");
      if (body.refreshToken === s.rt) return json(200, s.mintPair());
      if (body.refreshToken === s.prevRt) return json(200, s.lastResult); // 10 s grace window
      return err(401, "unauthorized");
    }
    if (p === "/auth/logout") return route.fulfill({ status: 204 });
    if (p === "/auth/login") return json(200, { token: jwt({ sub: s.user.id, email: s.user.email, name: s.user.name, exp: NOW_S + s.clockS + 3600 }) });

    const tok = auth.replace(/^Bearer /, "");
    if (!s.valid.has(tok)) return err(401, "unauthorized");
    if (p === "/me" && req.method() === "DELETE") {
      if (s.deleteReauth) { s.deleteReauth = false; return err(401, "reauth_required"); }
      return route.fulfill({ status: 204 });
    }
    if (p === "/me") return json(200, { id: s.user.id, email: s.user.email, displayName: "Tester", currentStreak: 0, totalDaysTrained: 0, todayDone: false, todayRested: false, trainingDays: [] });
    if (p === "/progress") return json(200, { entries: {} });
    if (p === "/workouts/complete" && req.method() === "POST") return json(200, { ok: true });
    if (p === "/workouts/complete") return json(200, { records: [], restDays: [], restDaysLeftThisWeek: 2 });
    return err(404, "not_found");
  });
}

const GIS_STUB = `
window.__gis = { cfg: null, prompts: 0, buttons: 0 };
window.google = { accounts: { id: {
  initialize: function (c) { window.__gis.cfg = c; },
  renderButton: function () { window.__gis.buttons++; },
  prompt: function () { window.__gis.prompts++; },
  disableAutoSelect: function () {}
} } };`;

// opts: ls / ss (raw strings seeded once), native, store (in-memory GymSessionStore), clientId
async function open(browser, s, opts) {
  opts = opts || {};
  const context = await browser.newContext({
    ...(process.env.PW_BASE ? { baseURL: process.env.PW_BASE } : {}),
    timezoneId: "Africa/Cairo", locale: "en-US", serviceWorkers: "block", viewport: { width: 390, height: 844 }
  });
  await mockBackend(context, s);
  await context.route("**/config.js", (r) => r.fulfill({
    contentType: "application/javascript",
    body: 'window.GYM_API_BASE="";window.GOOGLE_CLIENT_ID="' + (opts.clientId === undefined ? "web-client.apps.googleusercontent.com" : opts.clientId) + '";window.GYM_APP_HOST="";'
  }));
  await context.route("https://accounts.google.com/**", (r) => r.fulfill({ contentType: "application/javascript", body: GIS_STUB }));
  await context.addInitScript((o) => {
    window.__events = [];
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "gymauth_refresh") window.__events.push("persist:" + JSON.parse(v).rt);
      return setItem.apply(this, arguments);
    };
    document.addEventListener("gym:tokenaccepted", () => window.__events.push("accepted:" + (window.GymSync && GymSync.token())));
    if (o.store) {
      let mem = null;
      window.GymSessionStore = { get: () => mem, set: (r) => { mem = r; window.__memStore = r; }, clear: () => { mem = null; window.__memStore = null; } };
    }
    if (o.native) {
      window.__calls = [];
      window.Capacitor = {
        isNativePlatform: () => true, getPlatform: () => "android",
        Plugins: {
          SocialLogin: {
            initialize: () => Promise.resolve(),
            login: (x) => { window.__calls.push(["login", x]); return Promise.resolve({ provider: "google", result: { responseType: "online", idToken: window.__nativeIdToken } }); },
            logout: () => Promise.resolve()
          },
          SplashScreen: { hide: () => {} }
        }
      };
    }
    try {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("gym_lang", "en"); localStorage.setItem("gym_onboarded", "1"); localStorage.setItem("gym_terms_ok", "terms.v2");
      localStorage.setItem("gym_plan", "male"); localStorage.setItem("gym_style", "gym"); localStorage.setItem("gym_theme", "dark");
      Object.keys(o.ls || {}).forEach((k) => localStorage.setItem(k, o.ls[k]));
      Object.keys(o.ss || {}).forEach((k) => sessionStorage.setItem(k, o.ss[k]));
    } catch (e) {}
  }, { ls: opts.ls, ss: opts.ss, native: opts.native, store: opts.store });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.install({ time: new Date(NOW) });
  await page.goto("/index.html");
  await page.waitForFunction(() => window.GymSync && window.GymUI && window.GymRest);
  return { context, page, errors };
}

const calls = (s, p) => s.log.filter((r) => r.path === p);
const refreshRec = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), REFRESH_KEY);
const googleCred = (claims) => jwt(Object.assign({ iss: "accounts.google.com", sub: "g-1", email: "t@example.com", name: "Tester", exp: NOW_S + 3000 }, claims));
const seedRec = (rt, method) => JSON.stringify({ rt, rexp: (NOW_S + 86400 * 30) * 1000, method: method || "google" });
const fireCredential = (page, cred) => page.evaluate((c) => window.__gis.cfg.callback({ credential: c }), cred);
const signedIn = (page) => page.evaluate(() => GymSync.isSignedIn());

test("web Google sign-in exchanges for a session: access in memory, refresh stored", async ({ browser }) => {
  const s = makeBackend();
  const { context, page } = await open(browser, s, { ls: { gym_anon: "1" } });
  await page.waitForFunction(() => window.__gis && window.__gis.cfg);
  const cred = googleCred();
  await fireCredential(page, cred);
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  const call = calls(s, "/auth/session")[0];
  expect(call.body.idToken).toBe(cred);
  expect(typeof call.body.device).toBe("string");
  expect(call.body.device.length).toBeGreaterThan(0);
  expect(call.body.device.length).toBeLessThanOrEqual(64);
  expect(await page.evaluate(() => GymSync.token())).toBe(s.lastResult.accessToken);
  expect((await refreshRec(page)).rt).toBe(s.lastResult.refreshToken);
  const cached = await page.evaluate(() => JSON.parse(sessionStorage.getItem("gymauth_session")));
  expect(cached.token).toBe(s.lastResult.accessToken);
  expect(await page.evaluate(() => localStorage.getItem("gym_user_sub"))).toBe("g-1");
  // the refresh token never reaches the synced gym_ keys
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.indexOf("gym_") === 0 && /refresh/.test(localStorage.getItem(k)))))
    .toEqual([]);
  await context.close();
});

test("password sign-in exchanges the local JWT via the Authorization header", async ({ browser }) => {
  const s = makeBackend({ user: { id: "uid-9", gsub: "", email: "p@example.com", name: "P" } });
  const { context, page } = await open(browser, s, { ls: { gym_anon: "1" } });
  const local = jwt({ sub: "uid-9", email: "p@example.com", name: "P", exp: NOW_S + 3600 });
  expect(await page.evaluate((t) => GymSync.signInWithToken(t), local)).toBe(true);
  await page.waitForFunction(() => GymSync.isSignedIn() && GymSync.token().split(".").length === 3 && !!localStorage.getItem("gymauth_refresh"), null, T);
  const call = calls(s, "/auth/session")[0];
  expect(call.auth).toBe("Bearer " + local);
  expect(call.body.idToken).toBeUndefined();
  expect(call.body.device.length).toBeLessThanOrEqual(64);
  expect(await page.evaluate(() => GymSync.token())).toBe(s.lastResult.accessToken);
  expect(await page.evaluate(() => GymSync.authMethod())).toBe("local");
  expect((await refreshRec(page)).method).toBe("local");
  await context.close();
});

test("scheduled refresh rotates the token and persists it before the new access token is used", async ({ browser }) => {
  const s = makeBackend();
  const { context, page } = await open(browser, s, { ls: { gym_anon: "1" } });
  await page.waitForFunction(() => window.__gis && window.__gis.cfg);
  await fireCredential(page, googleCred());
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  const first = s.lastResult;
  await page.evaluate(() => { window.__events.length = 0; });
  s.clockS = 13 * 60;
  await page.clock.fastForward(13 * MIN); // ~2 min before the 15 min expiry
  await expect.poll(() => calls(s, "/auth/refresh").length, T).toBe(1);
  expect(calls(s, "/auth/refresh")[0].body).toEqual({ refreshToken: first.refreshToken });
  const second = s.lastResult;
  expect(second.refreshToken).not.toBe(first.refreshToken);
  await page.waitForFunction((t) => GymSync.token() === t, second.accessToken, T);
  expect((await refreshRec(page)).rt).toBe(second.refreshToken);
  const events = await page.evaluate(() => window.__events);
  const persisted = events.indexOf("persist:" + second.refreshToken);
  const accepted = events.indexOf("accepted:" + second.accessToken);
  expect(persisted).toBeGreaterThanOrEqual(0);
  expect(accepted).toBeGreaterThan(persisted);
  // the new access token is the one sync uses
  await expect.poll(() => s.log.some((r) => r.path === "/progress" && r.auth === "Bearer " + second.accessToken), T).toBe(true);
  await context.close();
});

test("a 401 on an API call triggers one refresh and retries the original request once", async ({ browser }) => {
  const s = makeBackend();
  const { context, page } = await open(browser, s, { ls: { gym_anon: "1" } });
  await page.waitForFunction(() => window.__gis && window.__gis.cfg);
  await fireCredential(page, googleCred());
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  await page.waitForTimeout(300);
  const old = s.lastResult.accessToken;
  s.valid.delete(old); // the server no longer accepts it
  s.log.length = 0;
  const status = await page.evaluate(() => fetch("/api/v1/me", { headers: { Authorization: "Bearer " + GymSync.token() } }).then((r) => r.status));
  expect(status).toBe(200);
  expect(calls(s, "/auth/refresh")).toHaveLength(1);
  const me = calls(s, "/me");
  expect(me[0].auth).toBe("Bearer " + old);
  expect(me.map((r) => r.auth)).toContain("Bearer " + s.lastResult.accessToken);
  // two concurrent 401s share one refresh
  s.valid.delete(s.lastResult.accessToken);
  s.log.length = 0;
  const both = await page.evaluate(() => {
    const go = () => fetch("/api/v1/me", { headers: { Authorization: "Bearer " + GymSync.token() } }).then((r) => r.status);
    return Promise.all([go(), go()]);
  });
  expect(both).toEqual([200, 200]);
  expect(calls(s, "/auth/refresh")).toHaveLength(1);
  await context.close();
});

test("a lost refresh response is retried once, immediately, with the same token", async ({ browser }) => {
  const s = makeBackend();
  const { context, page } = await open(browser, s, { ls: { gym_anon: "1" } });
  await page.waitForFunction(() => window.__gis && window.__gis.cfg);
  await fireCredential(page, googleCred());
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  const first = s.lastResult;
  s.dropNextRefresh = 1;
  s.clockS = 13 * 60;
  await page.clock.fastForward(13 * MIN);
  await expect.poll(() => calls(s, "/auth/refresh").length, T).toBe(2);
  expect(calls(s, "/auth/refresh").map((r) => r.body.refreshToken)).toEqual([first.refreshToken, first.refreshToken]);
  await page.waitForFunction((t) => GymSync.token() === t, s.lastResult.accessToken, T);
  expect((await refreshRec(page)).rt).toBe(s.lastResult.refreshToken);
  expect(await signedIn(page)).toBe(true);
  // and it stops at one retry
  expect(calls(s, "/auth/refresh")).toHaveLength(2);
  await context.close();
});

test("a refresh rejected with 401 wipes the session and shows the login screen", async ({ browser }) => {
  const s = makeBackend({ refreshStatus: 401 });
  const { context, page } = await open(browser, s, { ls: { gym_anon: "1" } });
  await page.waitForFunction(() => window.__gis && window.__gis.cfg);
  await fireCredential(page, googleCred());
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  s.clockS = 13 * 60;
  await page.clock.fastForward(13 * MIN);
  await expect.poll(() => refreshRec(page), T).toBeNull();
  expect(await signedIn(page)).toBe(false);
  expect(await page.evaluate(() => sessionStorage.getItem("gymauth_session"))).toBeNull();
  await expect(page.locator("#onboarding")).toBeVisible(T);
  expect(calls(s, "/auth/refresh")).toHaveLength(1); // 401 is final: no retry
  await context.close();
});

test("cold start with a refresh token refreshes at once and never prompts Google", async ({ browser }) => {
  const s = makeBackend();
  s.rt = "rt-seed";
  const { context, page } = await open(browser, s, { ls: { gym_user_sub: "g-1", [REFRESH_KEY]: seedRec("rt-seed") } });
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  expect(calls(s, "/auth/refresh")[0].body).toEqual({ refreshToken: "rt-seed" });
  expect(calls(s, "/auth/session")).toHaveLength(0);
  expect(await page.evaluate(() => GymSync.token())).toBe(s.lastResult.accessToken);
  await page.waitForFunction(() => window.__gis && window.__gis.cfg, null, T);
  await page.clock.fastForward(20 * MIN); // the hourly One Tap prompt is gone too
  expect(await page.evaluate(() => window.__gis.prompts)).toBe(0);
  await expect(page.locator("#onboarding")).toBeHidden();
  await context.close();
});

test("migration: a still-valid Google token in sessionStorage is exchanged once", async ({ browser }) => {
  const s = makeBackend();
  const old = googleCred();
  const { context, page } = await open(browser, s, {
    ls: { gym_user_sub: "g-1" },
    ss: { gymauth_session: JSON.stringify({ token: old, exp: NOW_S + 3000, source: "google", profile: { email: "t@example.com", name: "Tester" } }) }
  });
  await expect.poll(() => refreshRec(page), T).not.toBeNull();
  expect(calls(s, "/auth/session")[0].body.idToken).toBe(old);
  await page.waitForFunction((t) => GymSync.token() === t, s.lastResult.accessToken, T);
  expect(await page.evaluate(() => window.__gis.prompts)).toBe(0);
  await context.close();
});

test("migration: stale_token falls back to a silent Google sign-in, then exchanges the fresh token", async ({ browser }) => {
  const s = makeBackend();
  const old = googleCred({ stale: true });
  const { context, page } = await open(browser, s, {
    ls: { gym_user_sub: "g-1" },
    ss: { gymauth_session: JSON.stringify({ token: old, exp: NOW_S + 3000, source: "google", profile: { email: "t@example.com", name: "Tester" } }) }
  });
  await expect.poll(() => page.evaluate(() => window.__gis && window.__gis.prompts), T).toBeGreaterThan(0);
  expect(calls(s, "/auth/session")).toHaveLength(1);
  const fresh = googleCred({ fresh: 1 });
  await fireCredential(page, fresh);
  await expect.poll(() => calls(s, "/auth/session").length, T).toBe(2);
  expect(calls(s, "/auth/session")[1].body.idToken).toBe(fresh);
  await expect.poll(() => refreshRec(page), T).not.toBeNull();
  expect(await signedIn(page)).toBe(true);
  await context.close();
});

test("migration: stale_token and no silent sign-in shows the normal login", async ({ browser }) => {
  const s = makeBackend();
  const { context, page } = await open(browser, s, {
    ls: { gym_user_sub: "g-1" },
    ss: { gymauth_session: JSON.stringify({ token: googleCred({ stale: true }), exp: NOW_S + 3000, source: "google", profile: { email: "t@example.com", name: "Tester" } }) }
  });
  await expect.poll(() => page.evaluate(() => window.__gis && window.__gis.prompts), T).toBeGreaterThan(0);
  await page.clock.fastForward(12000);
  await expect(page.locator("#onboarding")).toBeVisible(T);
  expect(await signedIn(page)).toBe(false);
  expect(await refreshRec(page)).toBeNull();
  await context.close();
});

test("sign-out revokes the session server-side and wipes the refresh token and cache", async ({ browser }) => {
  const s = makeBackend();
  const { context, page } = await open(browser, s, { ls: { gym_anon: "1" } });
  await page.waitForFunction(() => window.__gis && window.__gis.cfg);
  await fireCredential(page, googleCred());
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  const rt = s.lastResult.refreshToken;
  await page.evaluate(() => GymSync.signOut());
  await expect.poll(() => calls(s, "/auth/logout").length, T).toBe(1);
  expect(calls(s, "/auth/logout")[0].body).toEqual({ refreshToken: rt });
  expect(await refreshRec(page)).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem("gymauth_session"))).toBeNull();
  expect(await signedIn(page)).toBe(false);
  await context.close();
});

test("DELETE /me reauth_required asks for a real re-login, then the delete succeeds on the fresh session", async ({ browser }) => {
  const s = makeBackend({ user: { id: "uid-9", gsub: "", email: "p@example.com", name: "P" }, deleteReauth: true });
  s.rt = "rt-seed";
  const { context, page } = await open(browser, s, { ls: { gym_user_sub: "uid-9", gymauth_method: "local", gymauth_email: "p@example.com", [REFRESH_KEY]: seedRec("rt-seed", "local"), gym_checks: JSON.stringify({ x: { a: true } }) } });
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  await page.waitForFunction(() => document.getElementById("pvDelete"), null, T);
  await page.evaluate(() => document.getElementById("pvDelete").click());
  await page.fill("#pvInput", "DELETE");
  await page.click("#pvGo");
  await expect(page.locator("#pvRaForm")).toBeVisible(T);
  expect(calls(s, "/auth/refresh")).toHaveLength(1); // only the cold-start one; reauth_required never triggers a refresh
  await page.fill("#pvRaPw", "hunter22");
  await page.click("#pvRaGo");
  await expect.poll(() => calls(s, "/auth/session").length, T).toBe(1);
  await expect(page.locator("#pvGo")).toBeEnabled(T);
  await page.click("#pvGo");
  await expect.poll(() => calls(s, "/me").filter((r) => r.auth === "Bearer " + s.lastResult.accessToken && !r.body.x).length, T).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gym_checks")), T).toBeNull();
  await context.close();
});

test("an existing Google user is not treated as an account switch (session sub is the users-doc id)", async ({ browser }) => {
  const s = makeBackend(); // access token: sub "uid-1", gsub "g-1"
  s.rt = "rt-seed";
  const { context, page } = await open(browser, s, {
    ls: { gym_user_sub: "g-1", [REFRESH_KEY]: seedRec("rt-seed"), gym_checks: JSON.stringify({ keep: { me: true } }) }
  });
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => localStorage.getItem("gym_checks"))).toBe('{"keep":{"me":true}}');
  expect(await page.evaluate(() => localStorage.getItem("gym_user_sub"))).toBe("g-1");
  expect(await page.evaluate(() => sessionStorage.getItem("gym_switch"))).toBeNull();
  await context.close();
});

test("a genuinely different account still wipes", async ({ browser }) => {
  const s = makeBackend({ user: { id: "uid-2", gsub: "g-2", email: "o@example.com", name: "O" } });
  s.rt = "rt-seed";
  const { context, page } = await open(browser, s, {
    ls: { gym_user_sub: "g-1", [REFRESH_KEY]: seedRec("rt-seed"), gym_checks: JSON.stringify({ mine: { a: true } }) }
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gym_user_sub")), T).toBe("g-2");
  expect(await page.evaluate(() => localStorage.getItem("gym_checks"))).toBeNull();
  await context.close();
});

test("a completion queued while the session lapsed is sent when a refresh lands", async ({ browser }) => {
  const s = makeBackend();
  s.rt = "rt-seed";
  const queued = JSON.stringify([{ date: TODAY, dayId: "m_upper" }]);
  const { context, page } = await open(browser, s, { ls: { gym_user_sub: "g-1", [REFRESH_KEY]: seedRec("rt-seed"), gymrest_pending: queued } });
  // no access token exists until the refresh lands, so nothing can be sent before it
  await expect.poll(() => calls(s, "/auth/refresh").length, T).toBe(1);
  await expect.poll(() => s.log.filter((r) => r.path === "/workouts/complete" && r.method === "POST").length, T).toBe(1);
  expect(s.log.find((r) => r.path === "/workouts/complete" && r.method === "POST").auth).toBe("Bearer " + s.lastResult.accessToken);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("gymrest_pending") || "[]")), T).toEqual([]);
  await context.close();
});

test("native app: SocialLogin token is exchanged; cold start refreshes without the picker", async ({ browser }) => {
  const s = makeBackend();
  const { context, page } = await open(browser, s, { native: true, ls: { gym_anon: "1" } });
  const cred = googleCred();
  await page.evaluate((c) => { window.__nativeIdToken = c; }, cred);
  await page.evaluate(() => GymUI.promptSignIn());
  await page.locator("#obGoogleBtn .native-gbtn").click();
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  const call = calls(s, "/auth/session")[0];
  expect(call.body.idToken).toBe(cred);
  expect(call.body.device).toBe("Etqadem app (Android)");
  expect((await refreshRec(page)).rt).toBe(s.lastResult.refreshToken);
  // cold start: new tab-session (sessionStorage gone), same localStorage
  const rec = await page.evaluate(() => localStorage.getItem("gymauth_refresh"));
  const s2 = makeBackend();
  s2.rt = JSON.parse(rec).rt;
  const b = await open(browser, s2, { native: true, ls: { gym_user_sub: "g-1", [REFRESH_KEY]: rec } });
  await b.page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  expect(calls(s2, "/auth/refresh")).toHaveLength(1);
  expect(await b.page.evaluate(() => window.__calls.filter((c) => c[0] === "login").length)).toBe(0);
  await b.context.close();
  await context.close();
});

test("a GymSessionStore supplied by the host replaces localStorage for the refresh token", async ({ browser }) => {
  const s = makeBackend();
  const { context, page } = await open(browser, s, { ls: { gym_anon: "1" }, store: true });
  await page.waitForFunction(() => window.__gis && window.__gis.cfg);
  await fireCredential(page, googleCred());
  await page.waitForFunction(() => GymSync.isSignedIn(), null, T);
  expect(await page.evaluate(() => window.__memStore && window.__memStore.rt)).toBe(s.lastResult.refreshToken);
  expect(await refreshRec(page)).toBeNull();
  await context.close();
});

test("service worker never intercepts the cross-origin API or /auth/ calls", async () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "service-worker.js"), "utf8");
  expect(src).toMatch(/url\.origin !== self\.location\.origin\) return;/);
  expect(src).toMatch(/pathname\.startsWith\("\/api\/"\)/);
  expect(src).toMatch(/event\.request\.method !== "GET"\) return;/); // POST /auth/* is never handled
  expect(src).not.toMatch(/\/auth\//);
});
