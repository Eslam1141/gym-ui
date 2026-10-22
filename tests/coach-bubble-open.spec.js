// The coach chat opens like a Messenger chat head (see below) and
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

// The coach chat opens like a Messenger chat head: the bubble travels to the top
// inline-end corner and the panel unfolds under it; closing reverses that.
const fabRect = (page) => page.evaluate(() => { const b = document.getElementById("coachFab").getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width }; });
const settled = (page) => page.waitForFunction(() => !document.getElementById("coachFab").classList.contains("flying"));
const near = (a, b, d = 2) => expect(Math.abs(a - b)).toBeLessThan(d);

for (const lang of ["en", "ar"]) {
  for (const side of ["l", "r"]) {
    test(`${lang}: bubble parked ${side} travels to the top inline-end corner, panel hangs under it with a caret, and it returns on close`, async ({ browser }) => {
      const { context, page } = await setup(browser, { lang, ls: { gymcoach_bubble_pos: { side, bottom: 200 } } });
      const parked = await fabRect(page);
      await page.click("#coachFab");
      await expect(page.locator("#coachChat.show.bubble")).toHaveCount(1);
      await settled(page);
      const rtl = lang === "ar";
      const head = await fabRect(page);
      const hdr = await page.evaluate(() => Math.max(...["topBar", "topPrefs"].map((id) => { const e = document.getElementById(id); return e ? e.getBoundingClientRect().bottom : 0; })));
      expect(head.t).toBeGreaterThanOrEqual(hdr);
      expect(head.t).toBeLessThan(hdr + 20);
      await expect(page.locator("#coachFab")).toBeVisible();
      // the panel starts below the head, fills to the bottom, and has the caret
      const p = await page.evaluate(() => {
        const e = document.querySelector(".coach-chat-panel"), r = e.getBoundingClientRect();
        const c = getComputedStyle(e, "::before");
        return { t: r.top, b: r.bottom, l: r.left, r: r.right, caret: c.content, origin: getComputedStyle(e).transformOrigin };
      });
      expect(p.t).toBeGreaterThan(head.b);
      expect(p.t).toBeLessThan(head.b + 16);
      near(p.b, 844 - 8);
      near(rtl ? head.l - p.l : p.r - head.r, 4);   // head sits 12px, panel 8px from the same edge
      if (rtl) expect(head.l).toBeLessThan(60); else expect(head.r).toBeGreaterThan(300);
      expect(p.caret).not.toBe("none");
      // the caret points at the head: transform-origin sits under the head's centre
      const ox = parseFloat(p.origin.split(" ")[0]);
      near(p.l + ox, (head.l + head.r) / 2);
      // closing returns the bubble to its parked spot
      await page.click("#coachFab");
      await expect(page.locator("#coachChat")).toBeHidden();
      await settled(page);
      const back = await fabRect(page);
      near(back.l, parked.l, 1); near(back.t, parked.t, 1);
      expect(await page.evaluate(() => document.getElementById("coachFab").classList.contains("head"))).toBe(false);
      await context.close();
    });
  }

  test(`${lang}: close button, backdrop and Escape all fold the chat and park the bubble`, async ({ browser }) => {
    const { context, page } = await setup(browser, { lang, ls: { gymcoach_bubble_pos: { side: "r", bottom: 300 } } });
    const parked = await fabRect(page);
    for (const how of ["#coachChatClose", "backdrop", "Escape"]) {
      await page.click("#coachFab");
      await expect(page.locator("#coachChat.show")).toHaveCount(1);
      if (how === "Escape") await page.keyboard.press("Escape");
      else if (how === "backdrop") await page.mouse.click(10, 450);
      else await page.click(how);
      await expect(page.locator("#coachChat")).toBeHidden();
      await settled(page);
      near((await fabRect(page)).t, parked.t, 1);
    }
    await context.close();
  });

  test(`${lang}: drag-to-park is off while the chat is open`, async ({ browser }) => {
    const { context, page } = await setup(browser, { lang });
    await page.click("#coachFab");
    await expect(page.locator("#coachChat.show")).toHaveCount(1);
    await settled(page);
    const a = await fabRect(page);
    await page.mouse.move(a.l + 28, a.t + 28);
    await page.mouse.down();
    await page.mouse.move(a.l + 28, a.t + 300, { steps: 8 });
    await page.mouse.up();
    near((await fabRect(page)).t, a.t, 4);   // the press shrinks it a little
    expect(await page.evaluate(() => localStorage.getItem("gymcoach_bubble_pos"))).toBeNull();
    await context.close();
  });

  test(`${lang}: reduced motion = no travel, panel only fades`, async ({ browser }) => {
    const { context, page } = await setup(browser, { lang, reduced: true });
    const parked = await fabRect(page);
    await page.click("#coachFab");
    await expect(page.locator("#coachChat.show")).toHaveCount(1);
    const s = await page.evaluate(() => {
      const p = getComputedStyle(document.querySelector(".coach-chat-panel")), f = document.getElementById("coachFab");
      return { t: p.transform, tp: p.transitionProperty, flying: f.classList.contains("flying"), ft: getComputedStyle(f).transform };
    });
    expect(s.t).toBe("none");
    expect(s.tp).toBe("opacity");
    expect(s.flying).toBe(false);
    expect(s.ft).toBe("none");
    expect((await fabRect(page)).t).toBeLessThan(parked.t);   // it jumped to the head spot
    await page.click("#coachFab");
    await expect(page.locator("#coachChat")).toBeHidden();
    near((await fabRect(page)).t, parked.t, 1);
    await context.close();
  });

  test(`${lang}: Back closes the open chat first, without changing tab`, async ({ browser }) => {
    const { context, page } = await setup(browser, { lang });
    await page.click('#appNav button[data-tab="food"]');
    await expect(page.locator("body")).toHaveAttribute("data-tab", "food");
    await mockShell(page);
    const parked = await fabRect(page);
    await page.click("#coachFab");
    await expect(page.locator("#coachChat.show")).toHaveCount(1);
    await page.focus("#coachChatInput"); // keyboard-up state
    await back(page);
    await expect(page.locator("#coachChat")).toBeHidden();
    await settled(page);
    near((await fabRect(page)).t, parked.t, 1);
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
