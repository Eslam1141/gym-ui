// The floating coach bubble (chat.js #coachFab): visible on Plan/Food/More,
// hidden where it would be in the way, movable by pointer, and gated by the
// same AI-coach consent as every other coach entry point.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { openApp } = require("./helpers");

test.setTimeout(60000);

const SHOTS = process.env.SHOT_DIR;
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const REC = { type: "coach_ai", textVersion: "coach_ai.v1", lang: "en", grantedAt: "2026-10-17T09:00:00Z" };
const fab = (page) => page.locator("#coachFab");
const goTab = (page, tab) => page.click(`#appNav button[data-tab="${tab}"]`);
const rect = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height }; }, sel);

// granted: the account already agreed to the AI coach. chats: bodies POSTed to /assistant/chat.
async function setup(browser, { lang = "en", theme = "dark", granted = true, signedIn = true, viewport, tours = false, ls } = {}) {
  const app = await openApp(browser, { signedIn, lang, theme, tours, viewport, ls });
  const st = { consentReqs: [], chats: [], list: granted ? [REC] : [] };
  await app.context.route(/\/api\/v1\/me\/consents/, (route) => {
    const req = route.request();
    st.consentReqs.push(req.method());
    if (req.method() === "GET") return json(route, 200, { consents: st.list });
    return json(route, 200, REC);
  });
  await app.context.route(/\/api\/v1\/assistant\/chat/, (route) => {
    st.chats.push(JSON.parse(route.request().postData() || "{}"));
    return json(route, 200, { reply: "Sure thing." });
  });
  await expect(app.page.locator("#bootLoader")).toBeHidden({ timeout: 8000 }); // the loader covers the page until it fades
  return { ...app, st };
}

// Mouse drag from the bubble's centre to (x, y), in steps so pointermove fires.
async function dragTo(page, x, y) {
  const r = await rect(page, "#coachFab");
  await page.mouse.move(r.left + r.w / 2, r.top + r.h / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(450); // snap animation
}

test("visible on Plan, Food and More; hidden on the Coach tab", async ({ browser }) => {
  const { context, page, consoleErrors } = await setup(browser);
  for (const tab of ["plan", "food", "more"]) {
    await goTab(page, tab);
    await expect(fab(page)).toBeVisible();
  }
  await goTab(page, "coach");
  await expect(fab(page)).toBeHidden();
  await goTab(page, "plan");
  await expect(fab(page)).toBeVisible();
  expect(consoleErrors.filter((e) => !/404/.test(e))).toEqual([]);
  await context.close();
});

test("hidden during the first-visit tour", async ({ browser }) => {
  const { context, page } = await setup(browser, { tours: true });
  await expect(page.locator("#tour .tour-card")).toBeVisible({ timeout: 10000 });
  await expect(fab(page)).toBeHidden();
  await page.click("#tour .tour-skip");
  await expect(page.locator("#tour")).toBeHidden();
  await expect(fab(page)).toBeVisible();
  await context.close();
});

test("hidden while the survey is open, and while a dialog is open", async ({ browser }) => {
  const { context, page } = await setup(browser);
  await expect(fab(page)).toBeVisible();
  await page.evaluate(() => document.body.classList.add("survey-open")); // survey.js sets this class for as long as it is up
  await expect(fab(page)).toBeHidden();
  await page.evaluate(() => document.body.classList.remove("survey-open"));
  await expect(fab(page)).toBeVisible();
  await page.evaluate(() => { document.getElementById("videoModal").hidden = false; });
  await expect(fab(page)).toBeHidden();
  await page.evaluate(() => { document.getElementById("videoModal").hidden = true; });
  await expect(fab(page)).toBeVisible();
  await context.close();
});

test("signed out: tapping explains the coach needs sign-in", async ({ browser }) => {
  const { context, page, st } = await setup(browser, { signedIn: false });
  await expect(fab(page)).toBeVisible();
  await fab(page).click();
  await expect(page.locator("body.onboarding-open")).toHaveCount(1); // the sign-in screen
  await expect(page.locator("#coachChat")).toBeHidden();
  expect(st.chats).toEqual([]);
  await context.close();
});

test("tap opens the sheet over the current screen; Escape closes it and focus returns to the bubble", async ({ browser }) => {
  const { context, page } = await setup(browser);
  await goTab(page, "food");
  await fab(page).click();
  await expect(page.locator("#coachChat.show")).toBeVisible();
  expect(await page.evaluate(() => document.body.getAttribute("data-tab"))).toBe("food"); // still on Food underneath
  await expect(fab(page)).toBeHidden();
  const panel = await rect(page, ".coach-chat-panel");
  expect(panel.h).toBeLessThanOrEqual(844 * 0.9 + 1);
  await page.keyboard.press("Escape");
  await expect(page.locator("#coachChat")).toBeHidden();
  await expect(fab(page)).toBeVisible();
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).toBe("coachFab");
  await context.close();
});

test("keyboard: Enter opens, Tab stays inside the sheet", async ({ browser }) => {
  const { context, page } = await setup(browser);
  await fab(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#coachChat.show")).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement.closest("#coachChat"))).toBe(true);
  }
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => !!document.activeElement.closest("#coachChat"))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.locator("#coachChat")).toBeHidden();
  await fab(page).focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#coachChat.show")).toBeVisible();
  await context.close();
});

test("dragging the sheet header down closes it", async ({ browser }) => {
  const { context, page } = await setup(browser);
  await fab(page).click();
  await expect(page.locator("#coachChat.show")).toBeVisible();
  await page.waitForTimeout(350);
  const h = await rect(page, ".coach-chat-head");
  await page.mouse.move(h.left + 120, h.top + 20);
  await page.mouse.down();
  await page.mouse.move(h.left + 120, h.top + 200, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator("#coachChat")).toBeHidden();
  await context.close();
});

test("drag moves the bubble, snaps to the nearest edge, stays above the nav, and does not open the chat", async ({ browser }) => {
  const { context, page } = await setup(browser);
  const start = await rect(page, "#coachFab");
  expect(start.left).toBeGreaterThan(390 / 2); // LTR default: bottom-right
  const nav = await rect(page, "#appNav");

  await dragTo(page, 60, 300); // left half, mid screen
  await expect(page.locator("#coachChat")).toBeHidden();
  let r = await rect(page, "#coachFab");
  expect(r.left).toBeLessThan(24);               // snapped to the left edge
  expect(r.left).toBeGreaterThanOrEqual(0);
  expect(Math.abs(r.top + r.h / 2 - 300)).toBeLessThan(8);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gymcoach_bubble_pos")).side)).toBe("l");

  await dragTo(page, 200, 5000); // far below the screen: stops above the nav
  r = await rect(page, "#coachFab");
  expect(r.bottom).toBeLessThanOrEqual(nav.top);
  expect(r.left > 390 / 2 || r.left < 24).toBe(true); // always parked on an edge, never mid-screen
  await dragTo(page, 200, -500); // far above: stays on screen, below the top bar
  r = await rect(page, "#coachFab");
  expect(r.top).toBeGreaterThan(40);
  await context.close();
});

test("a tiny movement is still a tap", async ({ browser }) => {
  const { context, page } = await setup(browser);
  const r = await rect(page, "#coachFab");
  await page.mouse.move(r.left + 28, r.top + 28);
  await page.mouse.down();
  await page.mouse.move(r.left + 31, r.top + 29, { steps: 3 });
  await page.mouse.up();
  await expect(page.locator("#coachChat.show")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("gymcoach_bubble_pos"))).toBeNull();
  await context.close();
});

test("the parked spot survives a reload and a tab change", async ({ browser }) => {
  const { context, page } = await setup(browser);
  await dragTo(page, 40, 250);
  const before = await rect(page, "#coachFab");
  await page.reload();
  await expect(fab(page)).toBeVisible();
  await page.waitForTimeout(450); // the entrance animation scales it in
  const after = await rect(page, "#coachFab");
  expect(Math.abs(after.left - before.left)).toBeLessThan(2);
  expect(Math.abs(after.top - before.top)).toBeLessThan(2);
  await goTab(page, "more");
  const more = await rect(page, "#coachFab");
  expect(Math.abs(more.left - before.left)).toBeLessThan(2);
  await context.close();
});

test("a blocked localStorage does not break dragging", async ({ browser }) => {
  const { context, page, consoleErrors } = await setup(browser);
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new Error("blocked"); }; });
  await dragTo(page, 40, 250);
  await expect(fab(page)).toBeVisible();
  expect((await rect(page, "#coachFab")).left).toBeLessThan(24);
  expect(consoleErrors.filter((e) => !/404|blocked/.test(e))).toEqual([]);
  await context.close();
});

// The header pill (#topBar signed in, #topPrefs signed out) is fixed at the top; the bubble must stay below it.
const headerBottom = (page) => page.evaluate(() => Math.max(0, ...["topBar", "topPrefs"].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.height > 0 ? r.bottom : 0; })));

for (const [lang, side] of [["en", "r"], ["ar", "l"]]) {
  test(`a saved spot above the header pill is clamped below it (${lang})`, async ({ browser }) => {
    const { context, page } = await setup(browser, { lang, ls: { gymcoach_bubble_pos: { side, bottom: 5000 } } });
    await expect(fab(page)).toBeVisible();
    await page.waitForTimeout(450);
    const hb = await headerBottom(page);
    expect(hb).toBeGreaterThan(40);
    expect((await rect(page, "#coachFab")).top).toBeGreaterThanOrEqual(hb);
    await page.setViewportSize({ width: 360, height: 640 }); // re-clamped on resize
    await page.waitForTimeout(100);
    expect((await rect(page, "#coachFab")).top).toBeGreaterThanOrEqual(await headerBottom(page));
    await dragTo(page, 200, -500); // a drag past the top stops under the pill too
    expect((await rect(page, "#coachFab")).top).toBeGreaterThanOrEqual(await headerBottom(page));
    await context.close();
  });
}

test("the default spot is the bottom inline-end corner, above the nav", async ({ browser }) => {
  for (const [lang, end] of [["en", "right"], ["ar", "left"]]) {
    const { context, page } = await setup(browser, { lang, viewport: { width: 360, height: 800 } });
    await page.waitForTimeout(500);
    const f = await rect(page, "#coachFab");
    expect(f.bottom).toBeLessThanOrEqual((await rect(page, "#appNav")).top);
    expect(f.top).toBeGreaterThan(800 / 2);
    if (end === "right") expect(f.left).toBeGreaterThan(360 / 2); else expect(f.right).toBeLessThan(360 / 2);
    await context.close();
  }
});

test("scrolling dims the bubble, and it comes back after the scroll stops", async ({ browser }) => {
  const { context, page } = await setup(browser);
  await expect(fab(page)).not.toHaveClass(/scrolling/);
  await page.mouse.move(100, 400);
  await page.mouse.wheel(0, 300);
  await expect(fab(page)).toHaveClass(/scrolling/);
  await page.waitForTimeout(350);
  const dimmed = await fab(page).evaluate((el) => { const s = getComputedStyle(el); return { op: +s.opacity, tf: s.transform, pe: s.pointerEvents }; });
  expect(dimmed.op).toBeLessThan(0.6);
  expect(dimmed.tf).not.toBe("none");
  expect(dimmed.pe).not.toBe("none");
  await expect(fab(page)).not.toHaveClass(/scrolling/, { timeout: 1500 });
  await page.waitForTimeout(350);
  expect(+(await fab(page).evaluate((el) => getComputedStyle(el).opacity))).toBe(1);
  await context.close();
});

test("scrolling dim with reduced motion fades only, no scale", async ({ browser }) => {
  const { context, page } = await setup(browser);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.mouse.move(100, 400);
  await page.mouse.wheel(0, 300);
  await expect(fab(page)).toHaveClass(/scrolling/);
  await page.waitForTimeout(350);
  const s = await fab(page).evaluate((el) => { const c = getComputedStyle(el); return { op: +c.opacity, tf: c.transform }; });
  expect(s.op).toBeLessThan(0.6);
  expect(s.tf).toBe("none");
  await context.close();
});

test("page bottom padding lets the last Plan element scroll fully above a bubble parked at the bottom", async ({ browser }) => {
  const { context, page } = await setup(browser, { ls: { gymcoach_bubble_pos: { side: "r", bottom: 0 } } });
  await page.waitForTimeout(450);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(900);
  const last = await page.evaluate(() => {
    const kids = [...document.querySelectorAll("#screen-plan *")].filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.width > 0 && e.checkVisibility(); }); // closed <details> content is not shown
    return Math.max(...kids.map((e) => e.getBoundingClientRect().bottom));
  });
  const f = await rect(page, "#coachFab");
  expect(f.bottom).toBeLessThanOrEqual((await rect(page, "#appNav")).top);
  expect(last).toBeLessThanOrEqual(f.top);
  await context.close();
});

test("RTL: the default spot is the inline-end edge (left), and a drag to the right edge sticks", async ({ browser }) => {
  const { context, page } = await setup(browser, { lang: "ar" });
  expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
  const r = await rect(page, "#coachFab");
  expect(r.left + r.w / 2).toBeLessThan(390 / 2);
  await dragTo(page, 340, 300);
  const moved = await rect(page, "#coachFab");
  expect(moved.right).toBeGreaterThan(390 - 40); // the stable scrollbar gutter takes 15px off the right
  await context.close();
});

test("consent: without it the bubble opens the consent sheet, not the chat; agreeing then opens the chat", async ({ browser }) => {
  const { context, page, st } = await setup(browser, { granted: false });
  await goTab(page, "more");
  await fab(page).click();
  await expect(page.locator("dialog.cc-sheet[open]")).toBeVisible();
  await expect(page.locator("#coachChat")).toBeHidden();
  await page.locator("dialog.cc-sheet[open] label.cc-agree").click();
  await page.locator("dialog.cc-sheet[open] .pv-btn-fill").click();
  await expect(page.locator("#coachChat.show")).toBeVisible();
  expect(st.consentReqs).toContain("POST");
  await context.close();
});

test("consent: Not now leaves the chat closed", async ({ browser }) => {
  const { context, page, st } = await setup(browser, { granted: false });
  await fab(page).click();
  await page.locator("dialog.cc-sheet[open] .pv-actions .pv-btn").first().click();
  await expect(page.locator("dialog.cc-sheet[open]")).toHaveCount(0);
  await expect(page.locator("#coachChat")).toBeHidden();
  expect(st.chats).toEqual([]);
  await context.close();
});

test("screen-aware suggestions: Food and Plan chips send an ordinary chat message", async ({ browser }) => {
  const { context, page, st } = await setup(browser);
  await goTab(page, "food");
  await fab(page).click();
  const chip = page.locator(".coach-chat-chip", { hasText: "Add a meal for me" });
  await expect(chip).toBeVisible();
  expect((await rect(page, ".coach-chat-chip")).h).toBeGreaterThanOrEqual(44);
  await chip.click();
  await expect(page.locator(".coach-chat-msg.assistant").last()).toHaveText("Sure thing.");
  expect(st.chats[0].messages.at(-1)).toEqual({ role: "user", content: "Add a meal for me" });
  await expect(page.locator("#coachChatChips")).toBeHidden();
  await page.keyboard.press("Escape");

  await goTab(page, "plan");
  await fab(page).click();
  const dayChip = page.locator(".coach-chat-chip").first();
  await expect(dayChip).toContainText("workout");
  await expect(dayChip).toContainText(await page.evaluate(() => GymApp.activeDayName()));
  await context.close();
});

test("the conversation is shared: history written from one screen is there on another", async ({ browser }) => {
  const { context, page } = await setup(browser);
  await goTab(page, "more");
  await fab(page).click();
  await page.fill("#coachChatInput", "hello coach");
  await page.keyboard.press("Enter");
  await expect(page.locator(".coach-chat-msg.assistant").last()).toHaveText("Sure thing.");
  await page.keyboard.press("Escape");
  await goTab(page, "food");
  await fab(page).click();
  await expect(page.locator(".coach-chat-msg.user").last()).toHaveText("hello coach");
  await context.close();
});

test("desktop: the bubble never goes under the side rail", async ({ browser }) => {
  const { context, page } = await setup(browser, { viewport: { width: 1280, height: 800 } });
  const rail = await rect(page, "#appNav");
  await dragTo(page, 5, 400);
  const r = await rect(page, "#coachFab");
  expect(r.left).toBeGreaterThanOrEqual(rail.right);
  await context.close();
});

test("screenshots", async ({ browser }) => {
  test.skip(!SHOTS, "set SHOT_DIR to capture");
  for (const [lang, theme] of [["en", "light"], ["ar", "dark"]]) {
    const { context, page } = await setup(browser, { lang, theme, viewport: { width: 360, height: 740 } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir, document.documentElement.dataset.theme, window.innerWidth])).toEqual([lang, lang === "ar" ? "rtl" : "ltr", theme, 360]);
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, `bubble-plan-${lang}-${theme}.png`) });
    await goTab(page, "food");
    await fab(page).click();
    await expect(page.locator("#coachChat.show")).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, `sheet-food-${lang}-${theme}.png`) });
    await context.close();
  }
});
