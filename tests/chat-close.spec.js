const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(60000);

const SHOT = process.env.SHOTS || "";

async function openChat(browser, viewport) {
  const { context, page } = await openApp(browser, { signedIn: true, ls: { gymcoach_last: { computed: { targetKcal: 2000, proteinG: 150, carbG: 200, fatG: 60 } } } });
  if (viewport) await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.click('#appNav button[data-tab="more"]');
  await page.click("#coachFab");
  await expect(page.locator("#coachChat.show")).toBeVisible();
  await page.waitForTimeout(350);
  return { context, page };
}
const closed = (page) => expect(page.locator("#coachChat")).toBeHidden();
const phone = { width: 360, height: 740 };

test("tapping the dimmed area above the panel closes the chat and returns focus to the opener", async ({ browser }) => {
  const { context, page } = await openChat(browser, phone);
  await page.mouse.click(180, 30);
  await closed(page);
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).toBe("coachFab");
  expect(await page.locator("#coachFab").getAttribute("aria-expanded")).toBe("false");
  await context.close();
});

test("tapping the dimmed area beside the panel closes it on desktop", async ({ browser }) => {
  const { context, page } = await openChat(browser, { width: 1280, height: 800 });
  await page.mouse.click(1100, 300);
  await closed(page);
  await context.close();
});

test("tapping inside the panel does not close it", async ({ browser }) => {
  const { context, page } = await openChat(browser, phone);
  await page.locator(".coach-chat-head").click();
  await page.locator(".coach-chat-title").click();
  await page.locator("#coachChatInput").click();
  await expect(page.locator("#coachChat")).toBeVisible();
  await context.close();
});

test("a drag that starts inside the panel and ends outside does not close it", async ({ browser }) => {
  const { context, page } = await openChat(browser, phone);
  await page.locator("#coachChatInput").fill("select this text");
  const box = await page.locator("#coachChatInput").boundingBox();
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(180, 40, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator("#coachChat")).toBeVisible();
  await context.close();
});

test("a drag that starts outside and ends inside does not close it", async ({ browser }) => {
  const { context, page } = await openChat(browser, phone);
  const box = await page.locator("#coachChatMsgs").boundingBox();
  await page.mouse.move(180, 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, box.y + 40, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator("#coachChat")).toBeVisible();
  await context.close();
});

test("dismissing the on-screen keyboard (input blur) does not close it", async ({ browser }) => {
  const { context, page } = await openChat(browser, phone);
  await page.locator("#coachChatInput").focus();
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(300);
  await expect(page.locator("#coachChat")).toBeVisible();
  await context.close();
});

test("Escape and the close button still close it", async ({ browser }) => {
  const { context, page } = await openChat(browser, phone);
  await page.keyboard.press("Escape");
  await closed(page);
  await page.click("#coachFab");
  await expect(page.locator("#coachChat.show")).toBeVisible();
  await page.click("#coachChatClose");
  await closed(page);
  await context.close();
});

test("closing from the backdrop while a reply is in flight still lands the reply in history", async ({ browser }) => {
  const { context, page } = await openChat(browser, phone);
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route((u) => u.pathname.endsWith("/api/v1/assistant/chat"), async (route) => {
    await gate;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "late reply" }) });
  });
  await page.fill("#coachChatInput", "hi");
  await page.press("#coachChatInput", "Enter");
  await page.mouse.click(180, 30);
  await closed(page);
  release();
  await page.waitForTimeout(300);
  await page.click("#coachFab");
  await expect(page.locator(".coach-chat-msg.assistant").last()).toHaveText("late reply");
  await context.close();
});
