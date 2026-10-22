// The Plan header names the active split instead of the program; Classic keeps "Gym" / "In-House".
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

const title = (page) => page.locator("#appTitleEl");
const split = (days, where) => ({ gym_split: { days, where, tools: where === "home" ? ["dumbbell"] : [] } });

test("English: a split shows days and place; Classic is unchanged", async ({ browser }) => {
  let o = await openApp(browser, { signedIn: true, ls: split(4, "home") });
  await expect(title(o.page)).toHaveText(/^Etqadem · Male · 4 days · Home$/);
  await o.context.close();

  o = await openApp(browser, { signedIn: true, ls: split(6, "gym") });
  await expect(title(o.page)).toHaveText(/^Etqadem · Male · 6 days · Gym$/);
  await o.context.close();

  o = await openApp(browser, { signedIn: true });
  await expect(title(o.page)).toHaveText("Etqadem · Male · Gym");
  await o.context.close();
});

test("Arabic: the same, in Arabic", async ({ browser }) => {
  let o = await openApp(browser, { signedIn: true, lang: "ar", plan: "female", ls: split(4, "home") });
  await expect(title(o.page)).toHaveText(/4 أيام · المنزل/);
  await o.context.close();

  o = await openApp(browser, { signedIn: true, lang: "ar", plan: "female" });
  await expect(title(o.page)).toHaveText(/ · جيم$/);
  await expect(title(o.page)).not.toContainText("أيام");
  await o.context.close();
});

test("choosing a split in the app updates the header live, Classic restores it", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.waitForFunction(() => window.GymSplits && window.GymSplits.applyChoice);
  await page.evaluate(() => GymSplits.applyChoice({ days: 5, where: "gym" }));
  await expect(title(page)).toHaveText(/^Etqadem · Male · 5 days · Gym$/);
  await page.evaluate(() => GymSplits.applyChoice({ days: 0 }));
  await expect(title(page)).toHaveText("Etqadem · Male · Gym");
  await context.close();
});
