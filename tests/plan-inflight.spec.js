const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { openApp } = require("./helpers");

test.setTimeout(60000);

const SHOTS = process.env.SHOT_DIR;
const DRAFT = { age: "30", heightCm: "175", weightKg: "80" };
const RESULT = {
  id: "a1", want: "both", model: "claude-haiku-4-5", createdAt: "2026-10-02T07:00:00Z",
  summary: "A steady plan.",
  computed: { bmi: 24.1, bmiClass: "normal", bmrKcal: 1700, tdeeKcal: 2600, targetKcal: 2100, proteinG: 160, fatG: 65, carbG: 210 },
  dietPlan: { styleLabel: "Balanced", hydrationL: 3, meals: [{ name: "Breakfast", kcal: 520, proteinG: 38, items: ["3 eggs"] }], swaps: [], notes: [] },
  workoutPlan: { split: "Upper/Lower", daysPerWeek: 4, days: [{ day: "Upper A", exercises: [{ name: "Bench press", sets: 3, reps: "8-10", restSec: 90 }] }] },
  disclaimers: []
};

// Opens the app signed in with a valid coach draft and a mocked assessment
// route that holds its response until release(status) is called.
async function setup(browser, opts) {
  const app = await openApp(browser, Object.assign({ signedIn: true, ls: { gym_coach_form_draft: DRAFT } }, opts));
  const posts = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  await app.context.route("**/api/v1/assistant/assessment*", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    posts.push(route.request().url());
    const status = await gate;
    if (status === 200) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RESULT) });
    return route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: { code: "upstream", message: "x" } }) });
  });
  return Object.assign(app, { posts, release });
}

async function startPlan(page) {
  await page.click('#appNav button[data-tab="coach"]');
  await page.locator("#coachBody form button[type=submit]").first().click();
  await expect(page.locator(".coach-ai-loading")).toBeVisible();
}
const tab = (page, name) => page.click(`#appNav button[data-tab="${name}"]`);
const coachBtn = (page) => page.locator('#appNav button[data-tab="coach"]');

async function shot(page, name, o) {
  if (!SHOTS) return;
  expect(await page.evaluate(() => document.documentElement.lang)).toBe(o.lang === "ar" ? "ar" : "en");
  expect(await page.evaluate(() => document.documentElement.dir)).toBe(o.lang === "ar" ? "rtl" : "ltr");
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(o.theme || "dark");
  expect(await page.evaluate(() => window.innerWidth)).toBe(390);
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}-${o.lang || "en"}-${o.theme || "dark"}.png`) });
}

test("leave and return while pending shows loading again, one POST, nav shows working", async ({ browser }) => {
  const { context, page, posts, release, consoleErrors } = await setup(browser);
  await startPlan(page);
  await expect(coachBtn(page)).toHaveClass(/is-working/);
  await tab(page, "food");
  await expect(coachBtn(page)).toHaveClass(/is-working/);
  await shot(page, "nav-working", {});
  await tab(page, "coach");
  await expect(page.locator(".coach-ai-loading")).toBeVisible();
  await expect(page.locator("#coachBody form")).toHaveCount(0);
  expect(posts.length).toBe(1);
  release(200);
  await expect(page.locator(".coach-hero")).toBeVisible();
  await expect(coachBtn(page)).not.toHaveClass(/is-working/);
  await expect(page.locator("#gymToast.show")).toHaveCount(0);
  expect(posts.length).toBe(1);
  expect(consoleErrors.filter((e) => !/404/.test(e))).toEqual([]); // unmocked endpoints answer 404
  await context.close();
});

test("finishing while away: toast, dot, dot clears on open, result is waiting", async ({ browser }) => {
  const { context, page, posts, release } = await setup(browser);
  await startPlan(page);
  await tab(page, "food");
  release(200);
  await expect(page.locator("#gymToast.show")).toContainText("Your plan is ready");
  await expect(coachBtn(page)).toHaveClass(/has-update/);
  await expect(coachBtn(page).locator(".nav-dot")).toBeVisible();
  await expect(coachBtn(page)).not.toHaveClass(/is-working/);
  await shot(page, "toast-ready", {});
  await page.locator("#gymToast .gym-toast-action").click();
  await expect(page.locator(".coach-hero")).toBeVisible();
  await expect(coachBtn(page).locator(".nav-dot")).toHaveCount(0);
  await expect(coachBtn(page)).not.toHaveClass(/has-update/);
  expect(posts.length).toBe(1);
  await context.close();
});

test("dot clears when Coach is opened from the nav, not the toast", async ({ browser }) => {
  const { context, page, release } = await setup(browser);
  await startPlan(page);
  await tab(page, "more");
  release(200);
  await expect(coachBtn(page).locator(".nav-dot")).toBeVisible();
  await tab(page, "coach");
  await expect(page.locator(".coach-hero")).toBeVisible();
  await expect(coachBtn(page).locator(".nav-dot")).toHaveCount(0);
  await context.close();
});

test("failing while away: error toast opens Coach on the error", async ({ browser }) => {
  const { context, page, posts, release } = await setup(browser);
  await startPlan(page);
  await tab(page, "food");
  release(500);
  await expect(page.locator("#gymToast.show")).toContainText("Couldn't build your plan");
  await expect(coachBtn(page).locator(".nav-dot")).toBeVisible();
  await page.locator("#gymToast .gym-toast-action").click();
  await expect(page.locator("#coachBody .coach-state h2")).toHaveText("Couldn't reach the coach");
  await expect(coachBtn(page).locator(".nav-dot")).toHaveCount(0);
  expect(posts.length).toBe(1);
  await context.close();
});

test("Arabic: ready toast is translated, RTL, dark and light", async ({ browser }) => {
  for (const theme of ["dark", "light"]) {
    const { context, page, release } = await setup(browser, { lang: "ar", theme });
    await startPlan(page);
    await tab(page, "food");
    release(200);
    await expect(page.locator("#gymToast.show")).toContainText("خطتك جاهزة");
    await expect(page.locator("#gymToast .gym-toast-action")).toHaveText("اعرض الخطة");
    await shot(page, "toast-ready", { lang: "ar", theme });
    await context.close();
  }
});

test("reduced motion: working indicator is static", async ({ browser }) => {
  const { context, page, release } = await setup(browser);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startPlan(page);
  await tab(page, "food");
  const ring = await coachBtn(page).evaluate((b) => {
    const cs = getComputedStyle(b, "::after");
    return { anim: cs.animationName, w: cs.width };
  });
  expect(ring).toEqual({ anim: "none", w: "9px" });
  release(200);
  await context.close();
});

// ---------------- bottom nav stays solid through tab transitions ----------------
// Before the fix #appNav sat in the root snapshot, underneath the sliding
// screen groups, so the outgoing screen painted over it mid-transition.
test("nav, top bar and prefs are own view-transition groups without animation", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true, theme: "light" });
  const names = await page.evaluate(() => ["appNav", "topBar", "topPrefs"].map((id) => getComputedStyle(document.getElementById(id)).viewTransitionName));
  expect(names).toEqual(["app-nav", "app-topbar", "app-topprefs"]);
  await page.evaluate(() => {
    const orig = document.startViewTransition;
    document.startViewTransition = function (cb) { window.__vt = orig.call(document, cb); return window.__vt; };
  });
  await tab(page, "food");
  await page.evaluate(() => window.__vt.ready);
  const info = await page.evaluate(() => {
    const cs = (p) => getComputedStyle(document.documentElement, p);
    return {
      group: cs("::view-transition-group(app-nav)").animationName,
      fresh: cs("::view-transition-new(app-nav)").animationName,
      old: cs("::view-transition-old(app-nav)").display,
      screen: cs("::view-transition-old(screen-plan)").animationName
    };
  });
  expect(info).toEqual({ group: "none", fresh: "none", old: "none", screen: expect.not.stringMatching(/^none$/) });
  if (SHOTS) {
    // frame frozen mid-slide: the nav must stay readable above the sliding screens
    await page.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 60; }));
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, "after-nav-mid-transition.png"), clip: await page.locator("#appNav").boundingBox() });
  }
  await context.close();
});
