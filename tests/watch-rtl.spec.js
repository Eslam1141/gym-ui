// Arabic / RTL and both themes: layout holds, no horizontal scroll, copy is Arabic.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");
const { stubHealth, goWatch } = require("./watch-helpers");

test.setTimeout(60000);

for (const theme of ["dark", "light"]) {
  test(`Arabic RTL, ${theme}: connect card, sheet, today, profile row`, async ({ browser }) => {
    const { context, page, consoleErrors } = await openApp(browser, { signedIn: false, lang: "ar", theme, viewport: { width: 360, height: 780 } });
    expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir, document.documentElement.dataset.theme])).toEqual(["ar", "rtl", theme]);
    await stubHealth(page);
    await goWatch(page);
    const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

    await expect(page.locator("#wtConnectCard")).toContainText("اربط ساعتك");
    expect(await noScroll()).toBe(true);
    await page.click("#wtConnect");
    await expect(page.locator("#watchSheet [role=dialog]")).toContainText("الخطوات");
    const panel = await page.locator("#watchSheet .wt-panel").boundingBox();
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(360);
    expect(await noScroll()).toBe(true);
    await page.click("#wtGo");
    await expect(page.locator("#watchBody .wt-head .wt-title")).toContainText("اليوم");
    await expect(page.locator('#watchBody .wt-leg[data-key="sleep"]')).toContainText("7 س");
    expect(await noScroll()).toBe(true);
    // rows follow reading order: the label is on the right in RTL, the value on the left
    const lab = await page.locator('#watchBody .wt-leg[data-key="steps"] .wt-leg-l').boundingBox();
    const val = await page.locator('#watchBody .wt-leg[data-key="steps"] .wt-leg-v').boundingBox();
    expect(lab.x).toBeGreaterThan(val.x);

    await page.evaluate(() => GymUI.navigate("profile"));
    await expect(page.locator("#profWatchMount")).toContainText("الساعة الذكية");
    expect(consoleErrors).toEqual([]);
    await context.close();
  });
}

test("tap targets on the Connect card and in the sheet are at least 44px tall", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false, viewport: { width: 360, height: 780 } });
  await stubHealth(page);
  await goWatch(page);
  expect((await page.locator("#wtConnect").boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect((await page.locator("#wtConnectCard .pol-link").boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.click("#wtConnect");
  for (const id of ["#wtGo", "#wtLater"]) expect((await page.locator(id).boundingBox()).height).toBeGreaterThanOrEqual(44);
  await context.close();
});
