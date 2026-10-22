const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

// The onboarding survey sets the training split: days + gym/home + home tools
// go to GymSplits.applyChoice. The PUT /me/onboarding payload does not carry
// the tools (gym-be's schema has no field for them).
test.setTimeout(60000);
const T = { timeout: 10000 };
const CONSENT = { type: "onboarding", textVersion: "onboarding.v1", withdrawnAt: null };

async function setup(context, log) {
  await context.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, "");
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (p === "/me" && req.method() === "GET") {
      return json(200, { id: "u1", email: "t@example.com", displayName: "Tester", currentStreak: 0, totalDaysTrained: 0,
        todayDone: false, todayRested: false, trainingDays: [], onboardingCompleted: false });
    }
    if (p === "/me/consents" && req.method() === "GET") return json(200, { consents: [CONSENT] });
    if (p === "/me/onboarding" && req.method() === "PUT") { log.push(JSON.parse(req.postData() || "{}")); return json(200, { ok: true }); }
    return route.fallback();
  });
}
async function start(browser, opts) {
  const puts = [];
  const o = Object.assign({ signedIn: true, setup: (c) => setup(c, puts), ls: { gym_tours_seen: { plan: 2, coach: 2, food: 2, more: 2, watch: 1, watchOff: 1, bubble: 1 } } }, opts || {});
  const app = await openApp(browser, o);
  app.puts = puts;
  return app;
}
const opt = (page, name) => page.locator("#survey .svy-opt", { hasText: name }).first();
const title = (page) => page.locator("#survey #svyQ");
// goal .. equipment, ending with the equipment answer
async function toEquipment(page, days, equipment) {
  await opt(page, "Lose fat").click();
  await opt(page, "Male").click();
  await page.fill("#svyAge", "30"); await page.click("#survey .svy-next");
  await page.fill("#svyH", "178"); await page.fill("#svyW", "80"); await page.click("#survey .svy-next");
  await opt(page, "Less than a year").click();
  await page.locator("#survey .svy-opt", { hasText: new RegExp("^" + days + "$") }).click();
  await expect(title(page)).toHaveText("Where will you train?", T);
  await opt(page, equipment).click();
}
async function finish(page) {
  await opt(page, "Some walking").click();
  await page.click("#survey .svy-next"); // diet
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(title(page)).toHaveText("You're all set", T);
}
const choice = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("gym_split")));

test("home with equipment: tools step, then days + home + tools set the split", async ({ browser }) => {
  const { context, page, puts } = await start(browser);
  await toEquipment(page, 4, "Home, with some equipment");
  await expect(title(page)).toHaveText("What do you have at home?", T);
  await expect(page.locator("#survey .svy-chip")).toHaveCount(7);
  await expect(page.locator("#survey .svy-chip[role=checkbox]").first()).toHaveAttribute("aria-checked", "false");
  await page.getByRole("checkbox", { name: "Dumbbells" }).click();
  await page.getByRole("checkbox", { name: "Pull-up bar" }).click();
  await expect(page.getByRole("checkbox", { name: "Dumbbells" })).toHaveAttribute("aria-checked", "true");
  await page.click("#survey .svy-next");
  await finish(page);
  await expect(page.locator("#survey .svy-sum-val")).toHaveText("4-day split · Home");
  const c = await choice(page);
  expect(c.days).toBe(4);
  expect(c.where).toBe("home");
  expect([...c.tools].sort()).toEqual(["dumbbell", "pullup_bar"]);
  // the Plan screen's week is the generated 4-day home split
  expect(await page.evaluate(() => DAYS.length)).toBe(4);
  expect(await page.evaluate(() => DAYS.every((d) => /^sp4h/.test(d.id)))).toBe(true);
  expect(puts).toHaveLength(1);
  expect(puts[0].equipment).toBe("home_minimal");
  expect(puts[0].homeTools).toBeUndefined();
  await context.close();
});

test("home, no tools picked: bodyweight only", async ({ browser }) => {
  const { context, page } = await start(browser);
  await toEquipment(page, 3, "Home, with some equipment");
  await expect(title(page)).toHaveText("What do you have at home?", T);
  await page.click("#survey .svy-next");
  await finish(page);
  expect(await choice(page)).toEqual({ days: 3, where: "home", tools: [] });
  await context.close();
});

test("gym and no equipment skip the tools step", async ({ browser }) => {
  for (const [label, where] of [["Gym", "gym"], ["No equipment", "home"]]) {
    const { context, page } = await start(browser);
    await toEquipment(page, 5, label);
    await expect(title(page)).toHaveText("How active is your day?", T);
    await finish(page);
    const c = await choice(page);
    expect(c.days).toBe(5);
    expect(c.where).toBe(where);
    expect(c.tools).toEqual([]);
    await context.close();
  }
});

test("2 days stays Classic: no generated split, starter wording kept", async ({ browser }) => {
  const { context, page } = await start(browser);
  await toEquipment(page, 2, "Gym");
  await finish(page);
  expect((await choice(page)).days).toBe(0); // applyChoice stores 0 days = Classic
  await expect(page.locator("#survey .svy-sum-label")).toHaveText("Starter plan");
  await context.close();
});

test("back from tools and switching to Gym drops the step and the tools", async ({ browser }) => {
  const { context, page } = await start(browser);
  await toEquipment(page, 4, "Home, with some equipment");
  await page.getByRole("checkbox", { name: "Kettlebell" }).click();
  await page.click("#survey .svy-next");
  await expect(title(page)).toHaveText("How active is your day?", T);
  await page.click("#survey .svy-back");
  await expect(title(page)).toHaveText("What do you have at home?", T);
  await expect(page.getByRole("checkbox", { name: "Kettlebell" })).toHaveAttribute("aria-checked", "true");
  await page.click("#survey .svy-back");
  await expect(title(page)).toHaveText("Where will you train?", T);
  await opt(page, "Gym").click();
  await expect(title(page)).toHaveText("How active is your day?", T);
  await expect(page.locator("#survey .svy-count")).toHaveText("8 of 10");
  await finish(page);
  expect((await choice(page)).tools).toEqual([]);
  await context.close();
});

test("survives a missing GymSplits: no tools step, no crash", async ({ browser }) => {
  const { context, page } = await start(browser, { setup: async (c) => {
    await setup(c, []);
    await c.route("**/splits.js*", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  } });
  await toEquipment(page, 4, "Home, with some equipment");
  await expect(title(page)).toHaveText("How active is your day?", T);
  await finish(page);
  await expect(page.locator("#survey .svy-sum-label")).toHaveText("Starter plan");
  await context.close();
});

test("Arabic: tools step renders RTL at 360px", async ({ browser }) => {
  const { context, page } = await start(browser, { lang: "ar", viewport: { width: 360, height: 740 } });
  await page.locator("#survey .svy-opt").first().waitFor(T);
  // by position: goal, sex, age, body, experience, days (3rd = 4), equipment (2nd = home)
  await page.locator("#survey .svy-opt").first().click();
  await page.locator("#survey .svy-opt").first().click();
  await page.fill("#svyAge", "30"); await page.click("#survey .svy-next");
  await page.fill("#svyH", "178"); await page.fill("#svyW", "80"); await page.click("#survey .svy-next");
  await page.locator("#survey .svy-opt").first().click();
  await expect(title(page)).toHaveText("كم يوماً في الأسبوع تقدر تتمرن؟", T);
  await page.locator("#survey .svy-opt").nth(2).click();
  await expect(title(page)).toHaveText("أين ستتمرن؟", T);
  await page.locator("#survey .svy-opt").nth(1).click();
  await expect(title(page)).toHaveText("ماذا لديك في البيت؟", T);
  expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
  await expect(page.locator("#survey .svy-chip")).toHaveCount(7);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await context.close();
});
