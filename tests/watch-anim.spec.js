// The "From your watch today" strip is alive: count-up, goal rings, idle life,
// and all of it off under reduced motion. Also the Arabic "Health Connect" unit.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");
const { stubHealth } = require("./watch-helpers");

test.setTimeout(60000);

async function open(browser, o) {
  o = o || {};
  const app = await openApp(browser, { signedIn: false, lang: o.lang, theme: o.theme, viewport: o.viewport || { width: 360, height: 780 } });
  const { page } = app;
  await page.evaluate(() => { localStorage.setItem("etqwatch_on", "1"); localStorage.setItem("etqwatch_ask", "yes"); });
  if (o.reduceAttr) await page.evaluate(() => document.documentElement.setAttribute("data-reduce-motion", "1"));
  if (o.reduceMedia) await page.emulateMedia({ reducedMotion: "reduce" });
  // record every text the first value shows, from the first paint on
  await page.evaluate(() => {
    window.__seen = { steps: [] };
    const rec = () => { const n = document.querySelector('#watchMount .wt-cell[data-key="steps"] .wt-n'); if (n) window.__seen.steps.push(n.textContent); };
    new MutationObserver(rec).observe(document.getElementById("watchMount"), { subtree: true, childList: true, characterData: true });
    (function loop() { rec(); requestAnimationFrame(loop); })();
  });
  await stubHealth(page, o.stub);
  return app;
}
const num = (page, key) => page.locator(`#watchMount .wt-cell[data-key="${key}"] .wt-n`);
const offset = (page, key) => page.locator(`#watchMount .wt-cell[data-key="${key}"] .wt-ring-arc`).getAttribute("stroke-dashoffset").then(Number);
const stripAnims = (page) => page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest("#watchMount")).length);

test("numbers count up from 0 and land on the exact values", async ({ browser }) => {
  const { context, page } = await open(browser);
  await expect(num(page, "steps")).toHaveText("8,214");
  await expect(num(page, "kcal")).toHaveText("412");
  await expect(num(page, "rhr")).toHaveText("58");
  await expect(num(page, "sleep")).toHaveText("7 h");
  const seen = await page.evaluate(() => window.__seen.steps);
  expect(seen[0]).not.toBe("8,214");                      // it did not just appear
  const ints = seen.map((t) => Number(t.replace(/,/g, "")));
  for (let i = 1; i < ints.length; i++) expect(ints[i]).toBeGreaterThanOrEqual(ints[i - 1]);
  expect(ints[0]).toBeLessThan(8214);
  await context.close();
});

test("rings follow the goals, capped at a full ring; the text keeps the real percent", async ({ browser }) => {
  const { context, page } = await open(browser, { stub: { health: { data: { steps: 8214, calories: 250, avgHr: 71, rhr: 58, sleep: [] } } } });
  await expect(num(page, "steps")).toHaveText("8,214");
  await expect.poll(() => offset(page, "steps")).toBe(0);                     // 103% -> full ring
  await expect.poll(() => offset(page, "kcal")).toBe(50);                     // 250 / 500
  const sub = (k) => page.locator(`#watchMount .wt-cell[data-key="${k}"] .wt-sub`);
  await expect(sub("steps")).toHaveText("103% of 8,000");
  await expect(sub("kcal")).toHaveText("50% of 500 kcal");
  await context.close();
});

test("a ring fills clockwise in LTR and mirrors in RTL", async ({ browser }) => {
  for (const lang of ["en", "ar"]) {
    const { context, page } = await open(browser, { lang });
    await expect(num(page, "steps")).toHaveText("8,214");
    const t = await page.locator('#watchMount .wt-cell[data-key="kcal"] .wt-ring-arc').evaluate((n) => getComputedStyle(n).transform);
    // rotate(-90deg) = matrix(0,-1,1,0,0,0); RTL adds a vertical flip = matrix(0,-1,-1,0,0,0)
    expect(t).toBe(lang === "ar" ? "matrix(0, -1, -1, 0, 0, 0)" : "matrix(0, -1, 1, 0, 0, 0)");
    await context.close();
  }
});

for (const mode of ["reduceAttr", "reduceMedia"]) {
  test(`reduced motion (${mode}): values and rings render at once, nothing animates`, async ({ browser }) => {
    const { context, page } = await open(browser, { [mode]: true });
    // no waiting: stubHealth has already awaited the first render
    expect(await num(page, "steps").textContent()).toBe("8,214");
    expect(await offset(page, "kcal")).toBeCloseTo(100 - 100 * 412 / 500, 5);
    expect(await page.locator("#watchMount .wt-in").count()).toBe(0);
    expect(await page.locator("#watchMount .wt-live").count()).toBe(0);
    expect(await stripAnims(page)).toBe(0);
    expect(await page.evaluate(() => window.__seen.steps.every((t) => t === "8,214"))).toBe(true);
    await context.close();
  });
}

test("idle life runs on screen and stops when the page is hidden", async ({ browser }) => {
  const { context, page } = await open(browser);
  await expect(num(page, "steps")).toHaveText("8,214");
  await expect(page.locator("#watchMount .wt-strip")).toHaveClass(/wt-live/);
  await expect.poll(() => page.evaluate(() => document.getAnimations().map((a) => a.animationName).filter((n) => /wt-(beat|drift)/.test(n)).length)).toBe(2);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#watchMount .wt-strip")).not.toHaveClass(/wt-live/);
  expect(await page.evaluate(() => document.getAnimations().filter((a) => /wt-(beat|drift)/.test(a.animationName)).length)).toBe(0);
  await context.close();
});

test("idle life stops when the strip scrolls off screen", async ({ browser }) => {
  const { context, page } = await open(browser, { viewport: { width: 360, height: 420 } });
  await expect(num(page, "steps")).toHaveText("8,214");
  await page.evaluate(() => { document.body.style.minHeight = "4000px"; document.querySelector("#watchMount .wt-strip").scrollIntoView({ block: "center" }); });
  await expect(page.locator("#watchMount .wt-strip")).toHaveClass(/wt-live/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => { document.body.style.minHeight = "6000px"; window.scrollTo(0, 5000); });
  await expect(page.locator("#watchMount .wt-strip")).not.toHaveClass(/wt-live/);
  await context.close();
});

test("a refresh with the same values does not replay the entrance", async ({ browser }) => {
  const { context, page } = await open(browser);
  await expect(num(page, "steps")).toHaveText("8,214");
  await page.waitForTimeout(1500);                           // entrance done
  await page.evaluate(() => { window.__seen.steps.length = 0; return window.GymWatch.refresh(); });
  expect(await page.locator("#watchMount .wt-in").count()).toBe(0);
  expect(await num(page, "steps").textContent()).toBe("8,214");
  expect(await offset(page, "kcal")).toBeCloseTo(100 - 100 * 412 / 500, 5);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__seen.steps.every((t) => t === "8,214"))).toBe(true);
  await context.close();
});

test("a refresh that changed a value moves only the difference", async ({ browser }) => {
  const { context, page } = await open(browser);
  await expect(num(page, "steps")).toHaveText("8,214");
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__health.cfg.data.steps = 9000; window.__seen.steps.length = 0; return window.GymWatch.refresh(); });
  await expect(num(page, "steps")).toHaveText("9,000");
  const ints = (await page.evaluate(() => window.__seen.steps)).map((t) => Number(t.replace(/,/g, "")));
  expect(Math.min(...ints)).toBeGreaterThanOrEqual(8214);      // never restarts from 0
  expect(await page.locator("#watchMount .wt-in").count()).toBe(0);
  await context.close();
});

test("Arabic: Health Connect is one unbreakable LTR unit and 'و' does not glue to it", async ({ browser }) => {
  for (const width of [360, 320]) {
    const { context, page } = await open(browser, { lang: "ar", viewport: { width, height: 780 } });
    await page.evaluate(() => { localStorage.removeItem("etqwatch_on"); localStorage.removeItem("etqwatch_ask"); });
    await page.evaluate(() => GymWatch.init());
    await page.click("#wtAskYes");
    const units = page.locator("#watchSheet .wt-ltr");
    await expect(units).toHaveCount(3);                       // intro + two in bullet 4
    for (let i = 0; i < 3; i++) {
      const u = units.nth(i);
      expect(await u.evaluate((n) => [getComputedStyle(n).whiteSpace, getComputedStyle(n).unicodeBidi, n.getClientRects().length])).toEqual(["nowrap", "isolate", 1]);
    }
    const before = await units.nth(1).evaluate((n) => n.previousSibling.textContent);
    expect(before.endsWith("و ")).toBe(true);
    // the sheet title takes focus on the dialog itself, with no ring
    expect(await page.evaluate(() => document.activeElement.id === "" && document.activeElement.getAttribute("role"))).toBe("dialog");
    expect(await page.evaluate(() => { const c = getComputedStyle(document.activeElement); return c.outlineStyle === "none" || c.outlineWidth === "0px"; })).toBe(true);
    await context.close();
  }
});

test("the manage button says where it goes, in EN and AR", async ({ browser }) => {
  for (const lang of ["en", "ar"]) {
    const { context, page } = await open(browser, { lang, stub: { health: { authorized: ["steps", "calories", "sleep"] } } });
    await expect(page.locator("#wtManage")).toContainText("Health Connect");
    await expect(page.locator("#watchMount .wt-note")).toContainText(lang === "ar" ? "أذونات التطبيقات" : "App permissions");
    await page.evaluate(() => GymUI.navigate("profile"));
    await expect(page.locator("#profWatchMount .wt-hint")).toContainText(lang === "ar" ? "اتقدم" : "Etqadem");
    await context.close();
  }
});
