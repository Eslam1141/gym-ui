// Coach icon "Pacer": three steps + an accent dot. Idle = dot rests on the top step;
// is-working (plan request in flight) and the hero loading view run the climb.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { openApp } = require("./helpers");

test.setTimeout(60000);

const SHOTS = process.env.SHOT_DIR;
const DRAFT = { age: "30", heightCm: "175", weightKg: "80" };
const icon = (page) => page.locator('#appNav button[data-tab="coach"] svg.etq-pacer');

async function climbState(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('#appNav button[data-tab="coach"] svg.etq-pacer');
    const dot = svg.querySelector(".p-dot"), steps = [...svg.querySelectorAll(".p-step")];
    const d = dot.getBoundingClientRect(), top = steps[2].getBoundingClientRect();
    return {
      dotAnim: getComputedStyle(dot).animationName,
      stepAnim: getComputedStyle(steps[0]).animationName,
      dotOnTop: d.left + d.width / 2 >= top.left - 0.5 && d.left + d.width / 2 <= top.right + 0.5 && d.bottom <= top.top + 0.5,
      mirror: getComputedStyle(svg.querySelector(".p-art")).transform,
      steps: steps.length
    };
  });
}

async function holdPlan(app) {
  let release;
  const gate = new Promise((r) => { release = r; });
  await app.context.route("**/api/v1/assistant/assessment*", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await gate;
    return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "upstream", message: "x" } }) });
  });
  return release;
}

async function shot(page, name, lang, theme) {
  if (!SHOTS) return;
  expect(await page.evaluate(() => document.documentElement.lang)).toBe(lang);
  expect(await page.evaluate(() => document.documentElement.dir)).toBe(lang === "ar" ? "rtl" : "ltr");
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}-${lang}-${theme}.png`) });
}

test("nav Coach icon is the Pacer svg, dot on the top step, no animation when idle", async ({ browser }) => {
  const { context, page, consoleErrors } = await openApp(browser, { signedIn: true });
  await expect(icon(page)).toBeVisible();
  const box = await icon(page).boundingBox();
  expect(Math.round(box.width)).toBe(22);
  const st = await climbState(page);
  expect(st.steps).toBe(3);
  expect(st.dotAnim).toBe("none");
  expect(st.dotOnTop).toBe(true);
  expect(st.mirror).toBe("none");
  expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  await context.close();
});

for (const lang of ["en", "ar"]) for (const theme of ["dark", "light"]) {
  test(`is-working runs the climb; reduced motion rests on top (${lang}, ${theme})`, async ({ browser }) => {
    const app = await openApp(browser, { signedIn: true, lang, theme, ls: { gym_coach_form_draft: DRAFT } });
    const { context, page } = app;
    const release = await holdPlan(app);
    await page.waitForFunction(() => {
      const l = document.getElementById("bootLoader");
      if (!l) return true;
      const cs = getComputedStyle(l);
      return cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0;
    });
    await expect(page.locator("#appNav")).toBeVisible();
    await page.waitForTimeout(500);
    if (SHOTS) {
      expect(await page.evaluate(() => document.documentElement.lang)).toBe(lang);
      expect(await page.evaluate(() => document.documentElement.dir)).toBe(lang === "ar" ? "rtl" : "ltr");
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, `nav-idle-${lang}-${theme}.png`), clip: { x: 0, y: 664, width: 390, height: 180 } });
    }
    await page.click('#appNav button[data-tab="coach"]');
    await page.locator("#coachBody form button[type=submit]").first().click();
    await expect(page.locator(".coach-ai-loading")).toBeVisible();
    await expect(page.locator('#appNav button[data-tab="coach"]')).toHaveClass(/is-working/);
    const st = await climbState(page);
    expect(st.dotAnim).toBe("pacer-climb");
    expect(st.stepAnim).toBe("pacer-land");
    const hero = await page.evaluate(() => {
      const d = document.querySelector(".coach-loading .etq-pacer .p-dot");
      return { anim: getComputedStyle(d).animationName };
    });
    expect(hero.anim).toBe("pacer-climb");
    if (lang === "ar") expect((await climbState(page)).mirror).toBe("matrix(-1, 0, 0, 1, 0, 0)");
    else expect((await climbState(page)).mirror).toBe("none");
    await shot(page, "nav-working", lang, theme);
    await page.locator(".coach-loading").screenshot({ path: SHOTS ? path.join(SHOTS, `hero-loading-${lang}-${theme}.png`) : undefined });

    await page.emulateMedia({ reducedMotion: "reduce" });
    const rm = await climbState(page);
    expect(rm.dotAnim).toBe("none");
    expect(rm.stepAnim).toBe("none");
    expect(rm.dotOnTop).toBe(true);
    release();
    await context.close();
  });
}
