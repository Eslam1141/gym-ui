// First-visit tips (tour.js): they must run, and "Replay tips" must work,
// even though /me says onboardingCompleted:false while no survey ships.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);

const tourCard = (page) => page.locator("#tour .tour-card");

async function replayFromMenu(page) {
  await page.click("#tbAvatar");
  await page.click("#tbMenuTips");
}

test("no survey in this build: tips start on Plan and Replay shows them again", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true, server: { onboardingCompleted: false } });
  await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
  await page.click("#tour .tour-skip");
  await expect(page.locator("#tour")).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gym_tours_seen")))).toMatchObject({ plan: 1 });

  await replayFromMenu(page);
  await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
  await context.close();
});

test("a pending survey holds the automatic tips, but Replay still works", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true, server: { onboardingCompleted: false } });
  // survey.js is not on main yet; stand in for one that is about to open.
  await page.addInitScript(() => { window.GymSurvey = { isPending: () => true }; });
  await page.evaluate(() => localStorage.removeItem("gym_tours_seen"));
  await page.reload();
  await page.waitForFunction(() => window.GymTour && window.GymHeader && GymHeader.me && GymHeader.me());
  await page.waitForTimeout(3000);
  await expect(page.locator("#tour")).toHaveCount(0);

  await replayFromMenu(page);
  await expect(tourCard(page)).toBeVisible({ timeout: 10000 });
  await context.close();
});
