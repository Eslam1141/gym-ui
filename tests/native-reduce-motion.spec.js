// Android "Remove animations" (animator scale 0): the WebView does not set prefers-reduced-motion for it, so
// the native shell sets html[data-reduce-motion="1"] and the web app treats that exactly like the media query.
const { test, expect } = require("@playwright/test");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { openApp } = require("./helpers");

test.setTimeout(60000);
const T = { timeout: 6000 };
const MEAL = { id: "m1", mealType: "lunch", foodName: "Rice", grams: 100, nutrients: { kcal: 300, protein: 10, carbs: 50, fat: 2 }, date: "2026-10-02" };
const tab = (page, name) => page.evaluate((n) => GymUI.navigate(n), name);
const running = (page) => page.evaluate(() => document.getAnimations().map((a) => (a.animationName || a.transitionProperty || "?") + "@" + ((a.effect && a.effect.target && (a.effect.target.id || a.effect.target.className)) || "")));

async function open(browser) {
  const app = await openApp(browser, { signedIn: true, viewport: { width: 360, height: 800 } });
  await app.context.route(/youtube|ytimg/, (r) => r.abort());
  await app.page.route((u) => u.pathname.endsWith("/api/v1/meals") || u.pathname.includes("/api/v1/meals/"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ meals: [MEAL] }) }));
  await expect(app.page.locator(".ex-card").first()).toBeVisible(T);
  await app.page.waitForTimeout(1400);
  return app;
}

test("the generated data-reduce-motion mirror in motion.css is up to date", () => {
  execFileSync(process.execPath, [path.join(__dirname, "..", "tools", "mirror-reduced-motion.mjs"), "--check"]);
});

test("data-reduce-motion=1 makes GymMotion.reduced() true; without it (and no media query) it is false", async ({ browser }) => {
  const { context, page } = await open(browser);
  expect(await page.evaluate(() => GymMotion.reduced())).toBe(false);
  await page.evaluate(() => document.documentElement.setAttribute("data-reduce-motion", "1"));
  expect(await page.evaluate(() => GymMotion.reduced())).toBe(true);
  await page.evaluate(() => document.documentElement.removeAttribute("data-reduce-motion"));
  expect(await page.evaluate(() => GymMotion.reduced())).toBe(false);
  await context.close();
});

test("with the attribute set nothing animates across tab switches, sheets and the Food day switch", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.evaluate(() => document.documentElement.setAttribute("data-reduce-motion", "1"));
  const left = [];
  const check = async (what) => {
    await page.waitForTimeout(120);
    const l = await running(page);
    if (l.length) left.push(what + ": " + l.join(", "));
  };
  for (const n of ["coach", "food", "more", "plan"]) { await tab(page, n); await check("tab " + n); }
  await tab(page, "food");
  const before = await page.locator(".food-date-label").textContent();
  await page.click(".food-date-btn.next");
  await expect(page.locator(".food-date-label")).not.toHaveText(before);
  await check("food day");
  await tab(page, "plan");
  await page.evaluate(() => GymFeedback.open());
  await expect(page.locator("#feedbackSheet")).toBeVisible(T);
  await check("feedback sheet open");
  await page.keyboard.press("Escape");
  await expect(page.locator("#feedbackSheet")).toHaveCount(0, T);
  await check("feedback sheet closed");
  await page.evaluate(() => GymUI.promptSignIn());
  await page.click("#obWhyToggle"); await check("why list");
  await page.click("#obWhyToggle");
  await page.evaluate(() => window.openVideoModal && openVideoModal(DAYS[0].exercises.find((e) => e.vid)));
  await check("video modal open");
  await page.evaluate(() => { const d = document.querySelector("dialog.pv-sheet"); if (d) GymMotion.closeDialog ? GymMotion.closeDialog(d) : d.close(); });
  await check("video modal closed");
  expect(left).toEqual([]);
  await context.close();
});

test("an animation the no-preference rules would start does not run under the attribute", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.evaluate(() => document.documentElement.setAttribute("data-reduce-motion", "1"));
  const r = await page.evaluate(() => {
    const d = document.createElement("div"); d.id = "rmProbe"; d.className = "m-reveal-in";
    document.body.appendChild(d);
    return getComputedStyle(d).animationName;
  });
  expect(r).toBe("none");
  await page.evaluate(() => document.documentElement.removeAttribute("data-reduce-motion"));
  expect(await page.evaluate(() => getComputedStyle(document.getElementById("rmProbe")).animationName)).toBe("m-rise");
  await context.close();
});

test("native-shell.js reads EtqMotion synchronously and keeps the attribute in step", async ({ browser }) => {
  const { context, page } = await open(browser);
  const on = await page.evaluate(() => {
    window.EtqMotion = { reduced: () => true };
    GymNativeShell.syncReduceMotion();
    return document.documentElement.getAttribute("data-reduce-motion");
  });
  expect(on).toBe("1");
  const off = await page.evaluate(() => {
    window.EtqMotion = { reduced: () => false };
    GymNativeShell.syncReduceMotion();
    return document.documentElement.hasAttribute("data-reduce-motion");
  });
  expect(off).toBe(false);
  await context.close();
});
