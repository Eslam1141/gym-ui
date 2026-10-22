// The coach chat grows out of the floating bubble (Messenger-style) and
// Android Back closes it before anything else.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(60000);

const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const REC = { type: "coach_ai", textVersion: "coach_ai.v1", lang: "en", grantedAt: "2026-10-17T09:00:00Z" };

async function setup(browser, { lang = "en", ls, reduced = false } = {}) {
  const app = await openApp(browser, { signedIn: true, lang, tours: false, ls });
  await app.context.route(/\/api\/v1\/me\/consents/, (route) =>
    route.request().method() === "GET" ? json(route, 200, { consents: [REC] }) : json(route, 200, REC));
  await app.context.route(/\/api\/v1\/assistant\/chat/, (route) => json(route, 200, { reply: "ok" }));
  if (reduced) await app.page.emulateMedia({ reducedMotion: "reduce" });
  await expect(app.page.locator("#bootLoader")).toBeHidden({ timeout: 8000 });
  return app;
}

async function mockShell(page) {
  await page.evaluate(() => {
    window.__shell = { exit: 0, listeners: {} };
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
      Plugins: {
        App: {
          getInfo: async () => ({ version: "1.2.3", build: "7" }),
          addListener: (name, cb) => { window.__shell.listeners[name] = cb; return Promise.resolve({ remove() {} }); },
          exitApp: () => { window.__shell.exit++; }
        }
      }
    };
    window.GymNativeShell.init();
  });
}
const back = (page) => page.evaluate(() => window.__shell.listeners.backButton({ canGoBack: false }));

for (const lang of ["en", "ar"]) {
  for (const side of ["l", "r"]) {
    test(`${lang}: panel opens from the bubble parked ${side}`, async ({ browser }) => {
      const { context, page } = await setup(browser, { lang, ls: { gymcoach_bubble_pos: { side, bottom: 200 } } });
      const r = await page.evaluate(() => { const b = document.getElementById("coachFab").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
      await page.click("#coachFab");
      await expect(page.locator("#coachChat.show.bubble")).toHaveCount(1);
      const o = await page.evaluate(() => {
        const p = document.querySelector(".coach-chat-panel");
        const [ox, oy] = getComputedStyle(p).transformOrigin.split(" ").map(parseFloat);
        return { x: p.offsetLeft + ox, y: p.offsetTop + oy };
      });
      expect(Math.abs(o.x - r.x)).toBeLessThan(2);
      expect(Math.abs(o.y - r.y)).toBeLessThan(2);
      await expect(page.locator("#coachChat.show")).toHaveCount(1);
      await context.close();
    });
  }

  test(`${lang}: reduced motion = fade only, no transform`, async ({ browser }) => {
    const { context, page } = await setup(browser, { lang, reduced: true });
    await page.click("#coachFab");
    await expect(page.locator("#coachChat.show")).toHaveCount(1);
    const s = await page.evaluate(() => { const c = getComputedStyle(document.querySelector(".coach-chat-panel")); return { t: c.transform, tp: c.transitionProperty }; });
    expect(s.t).toBe("none");
    expect(s.tp).toBe("opacity");
    await context.close();
  });

  test(`${lang}: Back closes the open chat first, without changing tab`, async ({ browser }) => {
    const { context, page } = await setup(browser, { lang });
    await page.click('#appNav button[data-tab="food"]');
    await expect(page.locator("body")).toHaveAttribute("data-tab", "food");
    await mockShell(page);
    await page.click("#coachFab");
    await expect(page.locator("#coachChat.show")).toHaveCount(1);
    await page.focus("#coachChatInput"); // keyboard-up state
    await back(page);
    await expect(page.locator("#coachChat")).toBeHidden();
    await expect(page.locator("body")).toHaveAttribute("data-tab", "food");
    expect(await page.evaluate(() => window.__shell.exit)).toBe(0);
    await back(page); // nothing open: normal behaviour resumes
    await expect(page.locator("body")).not.toHaveAttribute("data-tab", "food");
    await context.close();
  });
}

test("Back closes the video modal and an open dialog", async ({ browser }) => {
  const { context, page } = await setup(browser);
  await mockShell(page);
  await page.evaluate(() => { const m = document.getElementById("videoModal"); m.classList.add("show"); m.hidden = false; });
  await back(page);
  await expect(page.locator("#videoModal")).toBeHidden();
  await page.evaluate(() => {
    const d = document.createElement("dialog"); d.id = "tDlg"; d.textContent = "x"; document.body.appendChild(d); d.showModal();
  });
  await back(page);
  expect(await page.evaluate(() => document.getElementById("tDlg").open)).toBe(false);
  await context.close();
});
