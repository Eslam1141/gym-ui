const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);

async function openMenu(page) {
  await page.waitForFunction(() => document.getElementById("tbAvatar"));
  await page.click("#tbAvatar");
  await expect(page.locator("#tbMenu")).toBeVisible();
}

test("non-admins don't see the Admin dashboard menu item", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await openMenu(page);
  await expect(page.locator("#tbMenuProfile")).toBeVisible();
  await expect(page.locator("#tbMenuAdmin")).toBeHidden();
  await context.close();
});

test("admins see the Admin dashboard menu item", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true, server: { isAdmin: true } });
  await openMenu(page);
  await expect(page.locator("#tbMenuAdmin")).toBeVisible();
  await expect(page.locator("#tbMenuAdmin")).toHaveText("Admin dashboard");
  await context.close();
});
