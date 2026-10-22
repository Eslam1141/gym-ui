// First-visit tips (tour.js): they must run, and "Replay tips" must work,
// while /me says onboardingCompleted:false (the survey isn't done) unless a
// survey is actually about to open. Works with or without survey.js.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);

const tourCard = (page) => page.locator("#tour .tour-card");

async function replayFromMenu(page) {
  await page.click("#tbAvatar");
  await page.click("#tbMenuTips");
}

test("no survey pending: tips start on Plan and Replay shows them again", async ({ browser }) => {
  // gym_survey_dismissed = "Not now" was tapped (no-op where survey.js isn't shipped).
  const { context, page } = await openApp(browser, {
    signedIn: true, tours: true, server: { onboardingCompleted: false }, ls: { gym_survey_dismissed: 1 }
  });
  await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
  await page.click("#tour .tour-skip");
  await expect(page.locator("#tour")).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gym_tours_seen")))).toMatchObject({ plan: 1 });

  await replayFromMenu(page);
  await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
  await context.close();
});

test("a pending survey holds the automatic tips, but Replay still works", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true, tours: true, server: { onboardingCompleted: false } });
  // Stand-in where survey.js isn't shipped; survey.js replaces it where it is.
  await page.addInitScript(() => { window.GymSurvey = { isPending: () => true, close: () => {} }; });
  await page.evaluate(() => localStorage.removeItem("gym_tours_seen"));
  await page.reload();
  await page.waitForFunction(() => window.GymTour && window.GymHeader && GymHeader.me && GymHeader.me());
  // Close the survey without "Not now": it stays pending.
  await page.waitForTimeout(1500);
  await page.evaluate(() => GymSurvey.close());
  expect(await page.evaluate(() => GymSurvey.isPending())).toBe(true);
  await page.waitForTimeout(3000);
  await expect(page.locator("#tour")).toHaveCount(0);

  await replayFromMenu(page);
  await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
  await context.close();
});
