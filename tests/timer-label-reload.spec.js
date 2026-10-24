const { test, expect } = require("@playwright/test");
const { openApp, NOW } = require("./helpers");
const DAY = "m_upper"; // a real day of the signed-in default male gym split

// Owner report: reopening the app with a workout running showed "Start Workout"
// and "Not started yet", as if the timer had been reset. auth-email.js (a
// deferred script) re-runs applyStaticI18n() after app.js has drawn the card,
// and the button/hint carried data-i18n, so the static labels overwrote the
// running state. A tap on that "Start Workout" then ENDED the running workout.

test("a running timer still reads End Workout / In progress after a reload", async ({ browser }) => {
  const start = Date.parse(NOW) - 19 * 60 * 1000;
  const { context, page } = await openApp(browser, {
    signedIn: true,
    ls: {
      gym_session_active: { dayId: DAY, startedAt: start, running: true, accumSec: 0, segStart: start }
    }
  });
  // Let every deferred script (auth-email.js among them) finish its first pass.
  await page.waitForFunction(() => window.GymAuthEmail !== undefined, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  await expect(page.locator("#sessionBtn")).toHaveText("End Workout");
  await expect(page.locator("#sessionHint")).toHaveText("In progress…");
  await expect(page.locator("#sessionCard")).toHaveClass(/active/);
  await expect(page.locator("#sessionTime")).not.toHaveText("00:00:00");

  // Switching language must keep the running labels too (applyLang path).
  await page.evaluate(() => window.GymPrefs.toggleLang());
  await expect(page.locator("#sessionBtn")).toHaveText("أنهِ التمرين");
  await context.close();
});
