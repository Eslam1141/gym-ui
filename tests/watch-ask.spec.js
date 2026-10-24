// Watch tab Connect -> disclosure -> Health Connect permission sheet.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");
const { stubHealth, callsOf, lsGet, goWatch } = require("./watch-helpers");

test.setTimeout(45000);

async function ready(browser, o) {
  const app = await openApp(browser, { signedIn: false });
  await stubHealth(app.page, o);
  await goWatch(app.page);
  return app;
}

test("the Connect card shows once the plugin is available, and nothing asks on the Plan tab", async ({ browser }) => {
  const { context, page } = await ready(browser);
  const card = page.locator("#wtConnectCard");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Connect your watch");
  await expect(card).toContainText("It stays on your phone.");
  await expect(page.locator("#wtConnect")).toBeVisible();
  expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
  await page.evaluate(() => GymUI.navigate("plan", { instant: true }));
  await expect(page.locator("#watchMount")).toBeHidden();
  await expect(page.locator(".wt-ask")).toHaveCount(0);
  await context.close();
});

test("Connect shows the disclosure BEFORE the permission sheet; Continue then requests the 6 read types", async ({ browser }) => {
  const { context, page } = await ready(browser);
  await page.click("#wtConnect");
  const sheet = page.locator("#watchSheet [role=dialog]");
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("What we read (read-only): steps, active calories, heart rate, resting heart rate, sleep and weight.");
  await expect(sheet).toContainText("Why: to show your activity next to your plan.");
  await expect(sheet).toContainText("It stays on this phone. We don't send it to our servers, Etqadem Coach or anyone else.");
  await expect(sheet).toContainText("disconnect any time in Profile");
  await expect(sheet).toContainText("not medical advice");
  await expect(sheet.locator("a.pol-link")).toHaveAttribute("href", "/privacy#health-connect");
  expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
  await page.click("#wtGo");
  await expect(page.locator("#watchSheet")).toHaveCount(0);
  const req = await callsOf(page, "requestAuthorization");
  expect(req).toHaveLength(1);
  expect(req[0].arg.read).toEqual(["steps", "calories", "heartRate", "restingHeartRate", "sleep", "weight"]);
  await expect(page.locator("#wtDial")).toBeVisible();
  expect(await lsGet(page, "etqwatch_on")).toBe("1");
  expect(await lsGet(page, "etqwatch_ask")).toBe("yes");
  await context.close();
});

test("Not now in the disclosure never calls requestAuthorization and snoozes the ask", async ({ browser }) => {
  const { context, page } = await ready(browser);
  await page.click("#wtConnect");
  await page.click("#wtLater");
  await expect(page.locator("#watchSheet")).toHaveCount(0);
  expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
  expect(await lsGet(page, "etqwatch_on")).toBeNull();
  expect(await lsGet(page, "etqwatch_ask")).toMatch(/^later:\d+$/);
  await expect(page.locator("#wtConnectCard")).toBeVisible();   // still one tap away
  await context.close();
});

test("Escape, tap-outside and hardware Back on the disclosure all mean Not now and never request access", async ({ browser }) => {
  const { context, page } = await ready(browser);
  const dismiss = {
    Escape: () => page.keyboard.press("Escape"),
    "tap outside": () => page.locator("#watchSheet .syd-backdrop").click({ position: { x: 5, y: 5 } }),
    "hardware Back": () => page.evaluate(() => window.GymNativeShell.handleBack(false))
  };
  for (const [name, fn] of Object.entries(dismiss)) {
    await page.evaluate(() => localStorage.removeItem("etqwatch_ask"));
    await page.evaluate(() => window.GymWatch.init());
    await page.waitForSelector("#wtConnect:not([disabled])");
    await page.click("#wtConnect");
    await expect(page.locator("#watchSheet [role=dialog]"), name).toBeVisible();
    await fn();
    await expect(page.locator("#watchSheet"), name).toHaveCount(0);
    expect(await callsOf(page, "requestAuthorization"), name).toHaveLength(0);
    expect(await lsGet(page, "etqwatch_on"), name).toBeNull();
    expect(await lsGet(page, "etqwatch_ask"), name).toMatch(/^later:/);
  }
  await context.close();
});

test("the old Not now / No answers no longer hide anything: Connect stays on the Watch tab and in Profile", async ({ browser }) => {
  const { context, page } = await ready(browser);
  for (const answer of ["no", "later:" + Date.now()]) {
    await page.evaluate((a) => localStorage.setItem("etqwatch_ask", a), answer);
    await page.evaluate(() => window.GymWatch.init());
    await expect(page.locator("#wtConnectCard")).toBeVisible();
    await expect(page.locator("#profWatchMount .wt-prof")).toContainText("Watch & Health Connect");
    await expect(page.locator("#wtProfConnect")).toHaveCount(1);   // the Profile screen itself is only reachable signed in
  }
  await context.close();
});

test("permission refused in the system sheet: no dial, calm toast and inline note", async ({ browser }) => {
  const { context, page } = await ready(browser, { health: { grantOnRequest: [], authorized: [] } });
  await page.click("#wtConnect");
  await page.click("#wtGo");
  await expect(page.locator("#gymToast")).toContainText("No permission was given");
  expect(await lsGet(page, "etqwatch_on")).toBeNull();
  expect(await lsGet(page, "etqwatch_ask")).toMatch(/^later:/);
  await expect(page.locator("#wtDial")).toHaveCount(0);
  await expect(page.locator("#wtConnectCard .wt-note")).toContainText("No permission was given");
  await context.close();
});

test("Health Connect missing: the card on the tab, and the install sheet from Connect, both with a Play link and no permission request", async ({ browser }) => {
  const { context, page } = await ready(browser, { health: { available: false, reason: "Health Connect is not installed" } });
  await expect(page.locator("#wtInstallCard a#wtInstallGo")).toHaveAttribute("href", /play\.google\.com\/store\/apps\/details\?id=com\.google\.android\.apps\.healthdata/);
  await page.evaluate(() => { window.GymWatch.connect(); });   // Profile's Connect takes this path
  const sheet = page.locator("#watchSheet [role=dialog]");
  await expect(sheet).toContainText("Install or update Health Connect");
  await expect(sheet.locator("a#wtGo")).toHaveAttribute("href", /play\.google\.com\/store\/apps\/details\?id=com\.google\.android\.apps\.healthdata/);
  expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
  await page.click("#wtLater");
  await expect(page.locator("#watchSheet")).toHaveCount(0);
  await context.close();
});
