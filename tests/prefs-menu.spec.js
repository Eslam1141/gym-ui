// Signed in, theme + language live in the avatar menu and the floating
// top-left pill is gone; signed out, the pill is the only way to reach them.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);

async function openMenu(page) {
  await page.waitForFunction(() => document.getElementById("tbAvatar"));
  await page.click("#tbAvatar");
  await expect(page.locator("#tbMenu")).toBeVisible();
}

test("signed in: no floating prefs pill, theme + language in the avatar menu", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await expect(page.locator("#topBar")).toBeVisible();
  await expect(page.locator("#topPrefs")).toBeHidden();
  await openMenu(page);
  await expect(page.locator("#tbMenuTheme")).toHaveText("Light mode");
  await expect(page.locator("#tbMenuLang")).toHaveText("العربية");

  await page.click("#tbMenuTheme");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("#tbMenuTheme")).toHaveText("Dark mode");

  await page.click("#tbMenuLang");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("#tbMenuLang")).toHaveText("English");
  await expect(page.locator("#tbMenuTheme")).toHaveText("الوضع الداكن");
  await context.close();
});

test("signed out: the prefs pill stays", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: false });
  await expect(page.locator("#topPrefs")).toBeVisible();
  await expect(page.locator("#themeBtn")).toBeVisible();
  await expect(page.locator("#langBtn")).toBeVisible();
  await context.close();
});
