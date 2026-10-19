const { test, expect } = require("@playwright/test");

// Native session store (native-shell.js): the Keystore-backed SessionVault
// plugin + the synchronous window.EtqSessionVault.getSync read are mocked.

test.setTimeout(45000);
const KEY = "gymauth_refresh";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (c) => b64({ alg: "none" }) + "." + b64(c) + ".sig";

// opts: native (default true), vault (record already in the vault), sync (expose getSync),
//       ls (raw localStorage[KEY]), setFails
async function open(browser, opts) {
  opts = Object.assign({ native: true, sync: true }, opts);
  const context = await browser.newContext({
    ...(process.env.PW_BASE ? { baseURL: process.env.PW_BASE } : {}), serviceWorkers: "block"
  });
  const api = { refreshBodies: [], n: 0 };
  await context.route("**/api/v1/**", (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, "");
    const json = (status, b) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (p === "/auth/refresh") {
      api.refreshBodies.push(JSON.parse(req.postData() || "{}"));
      const exp = Math.floor(Date.now() / 1000) + 900;
      return json(200, {
        accessToken: jwt({ iss: "gym-be", sub: "u1", email: "t@example.com", name: "T", sid: "s", jti: ++api.n, exp }),
        accessExpiresAt: new Date(exp * 1000).toISOString(),
        refreshToken: "rt-new-" + api.n, refreshExpiresAt: new Date(Date.now() + 86400e3 * 30).toISOString()
      });
    }
    if (p === "/auth/logout") return route.fulfill({ status: 204 });
    return json(404, { error: { code: "not_found", message: "x" } });
  });
  await context.route("**/config.js", (r) => r.fulfill({
    contentType: "application/javascript",
    body: 'window.GYM_API_BASE="";window.GOOGLE_CLIENT_ID="web-client.apps.googleusercontent.com";window.GYM_APP_HOST="";'
  }));
  await context.route("https://accounts.google.com/**", (r) => r.abort());
  await context.addInitScript((o) => {
    window.__vault = { value: o.vault ? JSON.stringify(o.vault) : null, log: [] };
    window.__order = [];
    if (o.native) {
      const plugins = {
        SplashScreen: { hide: () => {} },
        SocialLogin: { initialize: () => Promise.resolve(), logout: () => Promise.resolve() },
        SessionVault: {
          get: () => Promise.resolve({ value: window.__vault.value }),
          set: (a) => { window.__vault.log.push(["set", a.value]); if (o.setFails) return Promise.reject(new Error("keystore")); window.__vault.value = a.value; return Promise.resolve(); },
          clear: () => { window.__vault.log.push(["clear"]); window.__vault.value = null; return Promise.resolve(); }
        }
      };
      window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", Plugins: plugins };
      if (o.sync) {
        // returns "" like the real interface when the vault is empty / unreadable
        window.EtqSessionVault = { getSync: () => { window.__order.push("getSync"); return window.__vault.value || ""; } };
      }
    }
    try {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("gym_lang", "en"); localStorage.setItem("gym_onboarded", "1"); localStorage.setItem("gym_age_ok", "1");
      localStorage.setItem("gym_plan", "male"); localStorage.setItem("gym_style", "gym"); localStorage.setItem("gym_theme", "dark");
      if (o.ls) localStorage.setItem("gymauth_refresh", o.ls);
    } catch (e) {}
  }, opts);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/index.html");
  await page.waitForFunction(() => window.GymSync && window.GymUI);
  return { context, page, api, errors };
}

const REC = { rt: "rt-vault", rexp: Date.now() + 86400e3 * 30, method: "google" };
const vaultVal = (page) => page.evaluate(() => window.__vault.value);
const lsVal = (page) => page.evaluate((k) => localStorage.getItem(k), KEY);

test("hydrated before sync.js: boots signed in from the vault with the stored token", async ({ browser }) => {
  const { context, page, api, errors } = await open(browser, { vault: REC });
  await page.waitForFunction(() => GymSync.isSignedIn(), null, { timeout: 15000 });
  expect(api.refreshBodies[0].refreshToken).toBe("rt-vault");
  expect(await page.evaluate(() => window.__order[0])).toBe("getSync");
  // rotated token was written through to the vault, never to localStorage
  await expect.poll(async () => JSON.parse((await vaultVal(page)) || "{}").rt).toMatch(/^rt-new-/);
  expect(await lsVal(page)).toBeNull();
  expect(errors).toEqual([]);
  await context.close();
});

test("sign-out clears the vault", async ({ browser }) => {
  const { context, page } = await open(browser, { vault: REC });
  await page.waitForFunction(() => GymSync.isSignedIn(), null, { timeout: 15000 });
  await page.evaluate(() => GymSync.signOut());
  await expect.poll(() => vaultVal(page)).toBeNull();
  expect(await page.evaluate(() => window.GymSessionStore.get())).toBeNull();
  expect(await page.evaluate(() => window.__vault.log.some((e) => e[0] === "clear"))).toBe(true);
  await context.close();
});

test("set then clear keep their order", async ({ browser }) => {
  const { context, page } = await open(browser, {});
  await page.evaluate(() => { GymSessionStore.set({ rt: "a", rexp: 1, method: "local" }); GymSessionStore.clear(); });
  await expect.poll(() => page.evaluate(() => window.__vault.log.map((e) => e[0]).join(","))).toBe("set,clear");
  expect(await vaultVal(page)).toBeNull();
  await context.close();
});

test("migration: localStorage token moves into the vault and is deleted", async ({ browser }) => {
  const { context, page, api } = await open(browser, { ls: JSON.stringify({ rt: "rt-legacy", rexp: Date.now() + 1e9, method: "local" }) });
  await page.waitForFunction(() => GymSync.isSignedIn(), null, { timeout: 15000 });
  expect(api.refreshBodies[0].refreshToken).toBe("rt-legacy");
  await expect.poll(() => lsVal(page)).toBeNull();
  expect(await page.evaluate(() => window.__vault.log[0][0])).toBe("set");
  expect(JSON.parse(await vaultVal(page)).rt).toMatch(/^rt-new-|^rt-legacy$/);
  await context.close();
});

test("migration: a stale localStorage copy is dropped when the vault already has a session", async ({ browser }) => {
  const { context, page, api } = await open(browser, { vault: REC, ls: JSON.stringify({ rt: "rt-stale", rexp: 1, method: "local" }) });
  await page.waitForFunction(() => GymSync.isSignedIn(), null, { timeout: 15000 });
  expect(api.refreshBodies[0].refreshToken).toBe("rt-vault");
  expect(await lsVal(page)).toBeNull();
  await context.close();
});

test("keystore write failure: plaintext copy still removed, no crash", async ({ browser }) => {
  const { context, page, errors } = await open(browser, { setFails: true, ls: JSON.stringify({ rt: "rt-legacy", rexp: Date.now() + 1e9, method: "local" }) });
  await expect.poll(() => lsVal(page)).toBeNull();
  await page.evaluate(() => GymSessionStore.set({ rt: "x", rexp: 1, method: "local" }));
  expect(await vaultVal(page)).toBeNull();
  expect(errors).toEqual([]);
  await context.close();
});

test("keystore read failure (native returns empty): app is signed out cleanly", async ({ browser }) => {
  const { context, page, api, errors } = await open(browser, {});
  expect(await page.evaluate(() => GymSessionStore.get())).toBeNull();
  expect(await page.evaluate(() => GymSync.isSignedIn())).toBe(false);
  expect(api.refreshBodies).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});

test("getSync throwing is treated as signed out", async ({ browser }) => {
  const context = await browser.newContext({ ...(process.env.PW_BASE ? { baseURL: process.env.PW_BASE } : {}), serviceWorkers: "block" });
  await context.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true, Plugins: { SplashScreen: { hide() {} }, SessionVault: { get: () => Promise.resolve({}), set: () => Promise.resolve(), clear: () => Promise.resolve() } } };
    window.EtqSessionVault = { getSync: () => { throw new Error("boom"); } };
  });
  await context.route("**/config.js", (r) => r.fulfill({ contentType: "application/javascript", body: 'window.GYM_API_BASE="";window.GOOGLE_CLIENT_ID="";window.GYM_APP_HOST="";' }));
  const page = await context.newPage();
  await page.goto("/index.html");
  await page.waitForFunction(() => window.GymSync);
  expect(await page.evaluate(() => GymSessionStore.get())).toBeNull();
  await context.close();
});

test("native without the JS interface falls back to localStorage (no GymSessionStore)", async ({ browser }) => {
  const { context, page } = await open(browser, { sync: false });
  expect(await page.evaluate(() => typeof window.GymSessionStore)).toBe("undefined");
  await context.close();
});

test("web: no GymSessionStore, localStorage token untouched", async ({ browser }) => {
  const rec = JSON.stringify({ rt: "rt-web", rexp: Date.now() + 1e9, method: "google" });
  const { context, page } = await open(browser, { native: false, ls: rec });
  expect(await page.evaluate(() => typeof window.GymSessionStore)).toBe("undefined");
  await expect.poll(async () => JSON.parse((await lsVal(page)) || "{}").rt).toMatch(/^rt-(web|new-)/); // web keeps using localStorage (rotates)
  await context.close();
});
