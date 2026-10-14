const { test, expect } = require("@playwright/test");
const { openApp, TODAY, DAY_ID, EX_IDS } = require("./helpers");

test.setTimeout(45000);
const T = { timeout: 8000 };
const allButLast = () => ({ [TODAY + "_" + DAY_ID]: Object.fromEntries(EX_IDS.slice(0, -1).map((id) => [id, true])) });
const lastCheck = (page) => page.locator('.check[data-id="' + EX_IDS[EX_IDS.length - 1] + '"]');
const card = (page) => page.locator(".celebrate-card");

async function ready(page, signedIn) {
  if (signedIn) await page.waitForFunction(() => window.GymHeader && GymHeader.me() && GymHeader.me().currentStreak != null, null, T);
  await expect(lastCheck(page)).toBeVisible(T);
}

test.describe("day celebration", () => {
  test("finishing the day shows streak copy once; reload and re-check stay quiet", async ({ browser }) => {
    const { context, page, consoleErrors } = await openApp(browser, { signedIn: true, checks: allButLast(), server: { streak: 1, todayDone: false } });
    await ready(page, true);
    await expect(page.locator(".celebrate-card.show")).toHaveCount(0);
    await lastCheck(page).click();
    await expect(card(page)).toHaveClass(/show/, T);
    await expect(card(page)).toContainText("Two days in a row. Keep it going");
    await expect(page.locator(".celebrate [role=status]")).toHaveText("Two days in a row. Keep it going");
    await card(page).click();
    await expect(card(page)).not.toHaveClass(/show/);

    await lastCheck(page).click(); // uncheck
    await lastCheck(page).click(); // re-check: complete again
    await page.waitForTimeout(300);
    await expect(card(page)).not.toHaveClass(/show/);

    await page.reload();
    await ready(page, true);
    await page.waitForTimeout(300);
    await expect(page.locator(".celebrate-card.show")).toHaveCount(0);
    expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
    await context.close();
  });

  test("Escape and the timer dismiss", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, checks: allButLast(), server: { streak: 3, todayDone: false } });
    await ready(page, true);
    await lastCheck(page).click();
    await expect(card(page)).toContainText("4 days in a row. You're building a habit", T);
    await page.keyboard.press("Escape");
    await expect(card(page)).not.toHaveClass(/show/);
    await page.evaluate(() => { GymCelebrate.rest(); });
    await expect(card(page)).toHaveClass(/show/, T);
    await page.clock.runFor(3500);
    await expect(card(page)).not.toHaveClass(/show/);
    await context.close();
  });

  test("a full week is a milestone", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, checks: allButLast(), server: { streak: 6, todayDone: false } });
    await ready(page, true);
    await lastCheck(page).click();
    await expect(card(page)).toContainText("A full week in a row. You deserve the best", T);
    await context.close();
  });

  test("already counted today uses the streak as is", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, checks: allButLast(), server: { streak: 2, todayDone: true } });
    await ready(page, true);
    await lastCheck(page).click();
    await expect(card(page)).toContainText("Two days in a row", T);
    await context.close();
  });

  test("anonymous gets the generic line", async ({ browser }) => {
    const { context, page } = await openApp(browser);
    const checks = page.locator(".check");
    await expect(checks.first()).toBeVisible(T);
    for (let i = await checks.count(); i > 0; i--) await checks.nth(i - 1).click();
    await expect(card(page)).toContainText("Great job. See you tomorrow", T);
    await context.close();
  });

  test("Arabic copy uses Arabic numerals", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, lang: "ar", checks: allButLast(), server: { streak: 2, todayDone: false } });
    await ready(page, true);
    await lastCheck(page).click();
    await expect(card(page)).toContainText("٣ أيام، ربنا ما يقطعها عادة", T);
    await context.close();
  });

  test("female plan gets the feminine Arabic line, male plan does not", async ({ browser }) => {
    for (const [plan, week, rest] of [["female", "إنتي تستاهلي الأفضل", "اشحني طاقتك وارجعي أقوى"], ["male", "إنت تستاهل الأفضل", "اشحن طاقتك وارجع أقوى"]]) {
      const { context, page } = await openApp(browser, { signedIn: true, lang: "ar", plan, server: { streak: 6, todayDone: false } });
      await page.waitForFunction(() => window.GymHeader && GymHeader.me() && GymHeader.me().currentStreak != null, null, T);
      await page.evaluate(() => { GymCelebrate.day("t"); });
      await expect(card(page)).toContainText(week, T);
      await page.evaluate(() => { GymCelebrate.rest(); });
      await expect(card(page)).toContainText(rest, T);
      await context.close();
    }
  });

  test("animated emoji is decorative, loads on demand, falls back to the character", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, checks: allButLast(), server: { streak: 1, todayDone: false } });
    await ready(page, true);
    expect(await page.locator(".celebrate-emoji img").count()).toBe(0);
    await lastCheck(page).click();
    const img = page.locator(".celebrate-emoji img");
    await expect(img).toHaveAttribute("src", "icons/emoji/fire.webp", T);
    await expect(img).toHaveAttribute("alt", "");
    await expect(page.locator(".celebrate-emoji")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(".celebrate [role=status]")).toHaveText("Two days in a row. Keep it going");
    await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0), T).toBe(true);
    await page.evaluate(() => { document.querySelector(".celebrate-emoji img").dispatchEvent(new Event("error")); });
    await expect(page.locator(".celebrate-emoji")).toHaveText("\u{1F525}");
    await expect(page.locator(".celebrate-emoji img")).toHaveCount(0);
    await context.close();
  });

  test("a partly done day never celebrates", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, checks: allButLast() });
    await ready(page, true);
    await lastCheck(page).click();
    await lastCheck(page).click();
    await page.locator('.check[data-id="' + EX_IDS[0] + '"]').click(); // now incomplete
    await page.waitForTimeout(200);
    await expect(page.locator(".celebrate-card.show")).toHaveCount(0);
    await context.close();
  });
});

test.describe("rest celebration", () => {
  test("taking a rest day shows the calm variant, undo does not", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    const rc = page.locator(".rest-card");
    await rc.getByRole("button", { name: "Take a rest day" }).click();
    await expect(card(page)).toHaveClass(/is-rest/, T);
    await expect(card(page)).toContainText("Rest is part of training. Recharge and come back stronger");
    await card(page).click();
    await expect(card(page)).not.toHaveClass(/show/);
    await rc.getByRole("button", { name: "Undo rest day" }).click();
    await expect(page.locator("#gymToast")).toContainText("Rest day removed", T);
    await expect(page.locator(".celebrate-card.show")).toHaveCount(0);
    await context.close();
  });

  test("a refused rest day shows the error, not the celebration", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, server: { left: 1, forceLimit: true } });
    await page.locator(".rest-card").getByRole("button", { name: "Take a rest day" }).click();
    await expect(page.locator("#gymToast")).toContainText("used both rest days", T);
    await expect(page.locator(".celebrate-card.show")).toHaveCount(0);
    await context.close();
  });
});

test.describe("reduced motion", () => {
  test("card is shown without animation", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, checks: allButLast(), server: { streak: 1, todayDone: false } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ready(page, true);
    await lastCheck(page).click();
    await expect(card(page)).toHaveClass(/show/, T);
    const names = await page.evaluate(() => [".celebrate-mascot", ".celebrate-card"].map((s) => getComputedStyle(document.querySelector(s)).animationName));
    expect(names).toEqual(["none", "none"]);
    await context.close();
  });
});
