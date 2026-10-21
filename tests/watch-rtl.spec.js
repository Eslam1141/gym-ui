// Arabic / RTL and both themes: layout holds, no horizontal scroll, copy is Arabic.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");
const { stubHealth } = require("./watch-helpers");

test.setTimeout(60000);

for (const theme of ["dark", "light"]) {
  test(`Arabic RTL, ${theme}: ask card, sheet, strip, profile row`, async ({ browser }) => {
    const { context, page, consoleErrors } = await openApp(browser, { signedIn: false, lang: "ar", theme, viewport: { width: 360, height: 780 } });
    expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir, document.documentElement.dataset.theme])).toEqual(["ar", "rtl", theme]);
    await stubHealth(page);
    const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

    await expect(page.locator("#watchMount .wt-ask")).toContainText("عندك ساعة ذكية؟");
    expect(await noScroll()).toBe(true);
    await page.click("#wtAskYes");
    await expect(page.locator("#watchSheet [role=dialog]")).toContainText("الخطوات");
    const panel = await page.locator("#watchSheet .wt-panel").boundingBox();
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(360);
    expect(await noScroll()).toBe(true);
    await page.click("#wtGo");
    await expect(page.locator("#watchMount .wt-strip")).toContainText("من ساعتك اليوم");
    await expect(page.locator("#watchMount .wt-cell").nth(3)).toContainText("7 س");
    expect(await noScroll()).toBe(true);
    // cells follow reading order: steps (first) sits on the right in RTL
    const a = await page.locator("#watchMount .wt-cell").nth(0).boundingBox();
    const b = await page.locator("#watchMount .wt-cell").nth(1).boundingBox();
    expect(a.x).toBeGreaterThan(b.x);

    await page.evaluate(() => GymUI.navigate("profile"));
    await expect(page.locator("#profWatchMount")).toContainText("الساعة الذكية");
    expect(consoleErrors).toEqual([]);
    await context.close();
  });
}

test("tap targets in the card and sheet are at least 44px tall", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false, viewport: { width: 360, height: 780 } });
  await stubHealth(page);
  for (const id of ["#wtAskYes", "#wtAskLater", "#wtAskNo"]) {
    expect((await page.locator(id).boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  await page.click("#wtAskYes");
  for (const id of ["#wtGo", "#wtLater"]) expect((await page.locator(id).boundingBox()).height).toBeGreaterThanOrEqual(44);
  await context.close();
});
