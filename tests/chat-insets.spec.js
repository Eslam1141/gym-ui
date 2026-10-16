const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(60000);

const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function openChat(browser) {
  const { context, page } = await openApp(browser, { signedIn: true, ls: { gymcoach_last: { computed: { targetKcal: 2000, proteinG: 150, carbG: 200, fatG: 60 } } } });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route((u) => u.pathname.endsWith("/api/v1/assistant/chat"), async (route) => {
    await gate; // hold the reply so the "sending" state is observable
    return json(route, 200, { reply: "ok" });
  });
  await page.click('#appNav button[data-tab="coach"]');
  await page.click("#coachFab");
  return { context, page, release };
}

test("chat input stays focused and enabled while sending and after the reply (keeps the soft keyboard up)", async ({ browser }) => {
  const { context, page, release } = await openChat(browser);
  const input = page.locator("#coachChatInput");
  await input.click();
  await input.fill("hello");
  await page.click("#coachChatSend"); // tapping Send must not pull focus off the input
  await expect(page.locator(".coach-chat-msg.user")).toHaveText("hello");
  expect(await input.isEnabled()).toBe(true);
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).toBe("coachChatInput");
  // a second submit while the first is in flight is ignored
  await input.fill("again");
  await page.press("#coachChatInput", "Enter");
  await expect(page.locator(".coach-chat-msg.user")).toHaveCount(1);
  release();
  await expect(page.locator(".coach-chat-msg.assistant")).toHaveText("ok");
  expect(await input.isEnabled()).toBe(true);
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).toBe("coachChatInput");
  await context.close();
});

test("chat input row clears the system navigation bar (bottom safe-area inset)", async ({ browser }) => {
  const { context, page } = await openChat(browser);
  const pad = () => page.evaluate(() => parseFloat(getComputedStyle(document.getElementById("coachChatForm")).paddingBottom));
  expect(await pad()).toBe(10); // no inset (browser): unchanged
  await page.evaluate(() => document.documentElement.style.setProperty("--sab", "48px")); // what env(safe-area-inset-bottom) resolves to on a 3-button bar
  expect(await pad()).toBe(58);
  await context.close();
});

test("a status-bar scrim covers the top safe-area inset so content never scrolls under the clock", async ({ browser }) => {
  const { context, page } = await openChat(browser);
  const h = () => page.evaluate(() => parseFloat(getComputedStyle(document.body, "::before").height));
  expect(await h()).toBe(0);
  await page.evaluate(() => document.documentElement.style.setProperty("--sat", "36px"));
  expect(await h()).toBe(36);
  await context.close();
});
