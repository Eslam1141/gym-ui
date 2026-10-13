const { expect } = require("@playwright/test");
const { openApp } = require("./helpers");

const T = { timeout: 8000 };

// Opens the custom plan builder ("Build your plan") on the Coach screen.
async function openBuilder(browser, o) {
  o = o || {};
  const app = await openApp(browser, { signedIn: true, lang: o.lang, viewport: o.viewport, ls: o.ls, theme: o.theme, plan: o.plan });
  if (o.reducedMotion) await app.page.emulateMedia({ reducedMotion: o.reducedMotion });
  await app.page.locator('#appNav button[data-tab="coach"]').click();
  await expect(app.page.locator("body")).toHaveAttribute("data-tab", "coach", T);
  await app.page.waitForTimeout(800); // let the screen's own entrance finish
  await app.page.evaluate(() => GymWorkoutBuilder.open());
  await expect(app.page.locator(".wb-screen")).toBeVisible(T);
  return app;
}

// A palette row that can be added to the selected day.
const freeRow = (page) => page.locator(".wb-ex:not(.wb-ex-blocked):not(.wb-ex-in)").first();
const rowByName = (page, en) => page.locator(`.wb-ex[data-ex-name="${en}"]`);

module.exports = { openBuilder, freeRow, rowByName, T };
