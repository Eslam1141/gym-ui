const { test, expect } = require("@playwright/test");

test.setTimeout(45000);

function fakeJwt(claims) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return b64({ alg: "none" }) + "." + b64(claims) + ".sig";
}

async function open(browser, { native }) {
  const context = await browser.newContext({
    ...(process.env.PW_BASE ? { baseURL: process.env.PW_BASE } : {}), serviceWorkers: "block"
  });
  const token = fakeJwt({ sub: "g-123", email: "a@b.c", name: "A", exp: Math.floor(Date.now() / 1000) + 3600 });
  if (native) {
    await context.addInitScript((token) => {
      window.__calls = [];
      window.Capacitor = {
        isNativePlatform: () => true,
        Plugins: {
          SocialLogin: {
            initialize: (o) => { window.__calls.push(["initialize", o]); return Promise.resolve(); },
            login: (o) => { window.__calls.push(["login", o]); return Promise.resolve({ provider: "google", result: { responseType: "online", idToken: token } }); },
            logout: (o) => { window.__calls.push(["logout", o]); return Promise.resolve(); }
          },
          SplashScreen: { hide: () => {} }
        }
      };
    }, token);
  }
  await context.route("**/config.js", (r) => r.fulfill({
    contentType: "application/javascript",
    body: 'window.GYM_API_BASE="";window.GOOGLE_CLIENT_ID="web-client.apps.googleusercontent.com";window.GYM_APP_HOST="";'
  }));
  await context.route("https://accounts.google.com/**", (r) => r.abort());
  await context.route("**/api/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  const page = await context.newPage();
  await page.goto("/index.html");
  await page.waitForFunction(() => window.GymUI && window.GymSync);
  return { context, page };
}

test("native app: Google sign-in uses the system picker, not GIS", async ({ browser }) => {
  const { context, page } = await open(browser, { native: true });
  await page.evaluate(() => GymUI.showObStep("choices"));
  const btn = page.locator("#obGoogleBtn .native-gbtn");
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText("Continue with Google");
  expect(await page.locator("#gymGsiScript").count()).toBe(0);

  await btn.click();
  await page.waitForFunction(() => window.GymSync.isSignedIn());
  const calls = await page.evaluate(() => window.__calls);
  expect(calls[0]).toEqual(["initialize", { google: { webClientId: "web-client.apps.googleusercontent.com" } }]);
  expect(calls[1][0]).toBe("login");
  expect(calls[1][1].provider).toBe("google");
  await expect(page.locator("#onboarding")).toBeHidden();
  await expect(page.locator("#bootLoader")).toBeHidden({ timeout: 8000 });

  await page.evaluate(() => window.GymSync.signOut && window.GymSync.signOut());
  await page.waitForFunction(() => window.__calls.some((c) => c[0] === "logout"));
  await context.close();
});

test("browser: still loads GIS, no native button", async ({ browser }) => {
  const { context, page } = await open(browser, { native: false });
  await page.waitForFunction(() => document.getElementById("gymGsiScript"));
  expect(await page.locator(".native-gbtn").count()).toBe(0);
  await context.close();
});
