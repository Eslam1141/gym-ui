const { test, expect } = require("@playwright/test");
const { openApp, TODAY, DAY_ID } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };
const badge = (page) => page.locator("#tbStreak");

test.describe("streak on hold", () => {
  test("held day shows on hold", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, server: { streak: 3, todayDone: false, heldDays: 1 } });
    await expect(badge(page)).toBeVisible(T);
    await expect(badge(page)).toContainText("3");
    await expect(badge(page).locator(".tb-hold")).toHaveText("on hold");
    await expect(badge(page)).toHaveAttribute("aria-label", "3-day streak, 1 day(s) on hold awaiting review");
    await context.close();
  });

  test("no held days no chip", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, server: { streak: 3, todayDone: false } });
    await expect(badge(page)).toBeVisible(T);
    await expect(badge(page).locator(".tb-hold")).toHaveCount(0);
    await expect(badge(page)).toHaveAttribute("aria-label", "3-day streak, today not trained yet");
    await context.close();
  });

  test("streak 0 with held shows badge", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, server: { streak: 0, todayDone: false, heldDays: 2 } });
    await expect(badge(page)).toBeVisible(T);
    await expect(badge(page).locator(".tb-hold")).toBeVisible();
    await expect(badge(page)).toContainText("0");
    await context.close();
  });

  test("a held day today is not shown as not-yet-trained", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, server: { streak: 2, todayDone: false, records: [{ date: TODAY, dayId: DAY_ID, state: "flagged" }] } });
    await expect(badge(page).locator(".tb-hold")).toBeVisible(T);
    await expect(badge(page)).not.toHaveClass(/is-pending/);
    await context.close();
  });

  test("Arabic chip and label", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, lang: "ar", server: { streak: 4, todayDone: true, heldDays: 1 } });
    await expect(badge(page).locator(".tb-hold")).toHaveText("معلّقة", T);
    await expect(badge(page)).toHaveAttribute("aria-label", "سلسلة 4 يوم، 1 يوم معلّق بانتظار المراجعة");
    await context.close();
  });
});
