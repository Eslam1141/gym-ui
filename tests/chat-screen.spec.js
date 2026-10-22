// The chat request carries "screen": the tab the coach bubble was opened from,
// captured when the sheet opens (not when the message is sent).
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(60000);

const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const REC = { type: "coach_ai", textVersion: "coach_ai.v1", lang: "en", grantedAt: "2026-10-17T09:00:00Z" };

async function setup(browser) {
  const app = await openApp(browser, { signedIn: true, lang: "en", theme: "dark", tours: false });
  const chats = [];
  await app.context.route(/\/api\/v1\/me\/consents/, (route) => json(route, 200, route.request().method() === "GET" ? { consents: [REC] } : REC));
  await app.context.route(/\/api\/v1\/assistant\/chat/, (route) => {
    chats.push(JSON.parse(route.request().postData() || "{}"));
    return json(route, 200, { reply: "Sure thing." });
  });
  await expect(app.page.locator("#bootLoader")).toBeHidden({ timeout: 8000 });
  return { ...app, chats };
}

async function sendFrom(page, tab, text) {
  await page.click(`#appNav button[data-tab="${tab}"]`);
  await page.locator("#coachFab").click();
  await expect(page.locator("#coachChat.show")).toBeVisible();
  await page.fill("#coachChatInput", text);
  await page.press("#coachChatInput", "Enter");
  await expect(page.locator("#coachChatMsgs")).toContainText("Sure thing.");
}

for (const tab of ["plan", "food", "more"]) {
  test(`opened from ${tab}: screen is "${tab}"`, async ({ browser }) => {
    const { context, page, chats } = await setup(browser);
    await sendFrom(page, tab, "hello");
    expect(chats).toHaveLength(1);
    expect(chats[0].screen).toBe(tab);
    await context.close();
  });
}

test("screen is the tab at open time and always an allowed value", async ({ browser }) => {
  const { context, page, chats } = await setup(browser);
  await sendFrom(page, "food", "one");
  await page.fill("#coachChatInput", "two");
  await page.press("#coachChatInput", "Enter");
  await expect.poll(() => chats.length).toBe(2);
  expect(chats[1].screen).toBe("food");   // same open sheet, same screen
  for (const c of chats) expect(["plan", "coach", "food", "watch", "more"]).toContain(c.screen);
  await context.close();
});

test("an unknown tab omits the field", async ({ browser }) => {
  const { context, page, chats } = await setup(browser);
  await page.evaluate(() => document.body.setAttribute("data-tab", "bogus"));
  await page.locator("#coachFab").evaluate((el) => el.click());
  await expect(page.locator("#coachChat.show")).toBeVisible();
  await page.fill("#coachChatInput", "hi");
  await page.press("#coachChatInput", "Enter");
  await expect.poll(() => chats.length).toBe(1);
  expect("screen" in chats[0]).toBe(false);
  await context.close();
});
