// Terms v2: the AI-coach acknowledgement moved from the chat footnote into the Terms + the
// sign-up line, acceptance is recorded on the server, older acceptances get one re-accept
// sheet, and Ramadan mode is asked instead of auto-ticked.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { openApp } = require("./helpers");

test.setTimeout(60000);

const SHOTS = process.env.SHOT_DIR;
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const TERMS_REC = { type: "terms", textVersion: "terms.v2", lang: "en", grantedAt: "2026-10-24T09:00:00Z" };
const COACH_REC = { type: "coach_ai", textVersion: "coach_ai.v1", lang: "en", grantedAt: "2026-10-17T09:00:00Z" };

// cs.list: what GET /me/consents returns; cs.postStatus: the answer to POST (400 = a backend that doesn't know "terms").
function consentRoutes(cs) {
  return async (context) => {
    await context.route(/\/api\/v1\/me\/consents/, (route) => {
      const req = route.request();
      const body = req.postData() ? JSON.parse(req.postData()) : null;
      cs.reqs.push({ method: req.method(), body });
      if (req.method() === "GET") return json(route, 200, { consents: cs.list });
      if (cs.postStatus !== 200) return json(route, cs.postStatus, { error: { code: "invalid_request", message: "x" } });
      const rec = { ...TERMS_REC, ...body };
      cs.list = cs.list.filter((c) => c.type !== body.type).concat(rec);
      return json(route, 200, rec);
    });
    await context.route(/\/api\/v1\/assistant\/chat/, (route) => json(route, 200, { reply: "ok" }));
  };
}
const newCs = (over) => ({ list: [], reqs: [], postStatus: 200, ...over });
const posts = (cs) => cs.reqs.filter((r) => r.method === "POST");
// A raw old acceptance, set before the app's own seeds (termsOk:false leaves the flag alone).
const oldFlag = (context) => context.addInitScript(() => { try { if (!sessionStorage.getItem("__old")) { sessionStorage.setItem("__old", "1"); localStorage.setItem("gym_terms_ok", "terms.v1"); } } catch (e) {} });
const sheet = (page) => page.locator("dialog.tu-sheet[open]");

async function shot(page, name, o) {
  if (!SHOTS) return;
  await expect(page.locator("#bootLoader")).toBeHidden({ timeout: 8000 });
  await page.waitForTimeout(900);   // entrance animations
  const el = await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir, window.innerWidth]);
  expect(el[0]).toBe(name.includes("-ar") ? "ar" : "en");
  expect(el[1]).toBe(name.includes("-ar") ? "rtl" : "ltr");
  expect(el[2]).toBe(390);
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + ".png"), ...(o || {}) });
}

// ---------------- chat: the note left the coach screen ----------------

for (const lang of ["en", "ar"]) {
  test("chat (" + lang + "): no Anthropic note; the title says it is an AI chat; no Privacy link in the chat", async ({ browser }) => {
    const cs = newCs({ list: [COACH_REC, TERMS_REC] });
    const { context, page } = await openApp(browser, { signedIn: true, lang, setup: consentRoutes(cs) });
    await expect(page.locator("#bootLoader")).toBeHidden({ timeout: 8000 });
    await page.click("#coachFab");
    await expect(page.locator("#coachChatTitle")).toHaveText(lang === "en" ? "Etqadem Coach" : "المدرّب اتقدم");
    // the note line under the messages is gone (owner 2026-10-25); the consent sheet and meal-photo notice keep their links
    await expect(page.locator("#coachChatNote")).toBeHidden();
    await shot(page, "chat-header-" + lang, { clip: { x: 0, y: 0, width: 390, height: 844 } });
    await context.close();
  });
}

// ---------------- sign-up line ----------------

for (const lang of ["en", "ar"]) {
  test("sign-up line (" + lang + "): names the AI coach and Anthropic, links to /terms#ai-coach, no checkbox", async ({ browser }) => {
    const { context, page } = await openApp(browser, { termsOk: false, lang });
    await page.evaluate(() => GymUI.promptSignIn());
    const legal = page.locator("#obLegal");
    await expect(legal).toBeVisible();
    await expect(legal).toContainText(lang === "en" ? "powered by Anthropic (US), can make mistakes and isn't medical advice" : "يعمل بتقنية Anthropic (الولايات المتحدة)، وقد يخطئ، وليس نصيحة طبية");
    await expect(legal.locator('a[href="/terms#ai-coach"]')).toHaveCount(1);
    await expect(legal.locator('a[href="/terms"]')).toHaveCount(1);
    await expect(legal.locator('a[href="/privacy"]')).toHaveCount(1);
    await expect(legal.locator("input")).toHaveCount(0);
    await shot(page, "signup-line-" + lang);
    await context.close();
  });
}

// ---------------- recording the acceptance ----------------

test("terms.v2: a fresh sign-up posts the acceptance, and the re-accept sheet does not appear", async ({ browser }) => {
  const cs = newCs();
  const { context, page } = await openApp(browser, { termsOk: false, setup: consentRoutes(cs) });
  // a brand-new visitor: nothing chosen yet (openApp seeds a returning guest)
  await context.addInitScript(() => { try { if (!sessionStorage.getItem("gymauth_session")) { localStorage.removeItem("gym_anon"); localStorage.removeItem("gym_onboarded"); } } catch (e) {} });
  await page.reload();
  await page.waitForFunction(() => window.GymUI);
  await page.evaluate(() => GymUI.promptSignIn());
  await page.click("#obContinueBtn");   // a tap on a sign-in choice accepts
  expect(await page.evaluate(() => localStorage.getItem("gym_terms_ok"))).toBe("terms.v2");
  // the account is created: the next boot (or the sign-in event) finds the flag and tells the server
  await page.evaluate(() => sessionStorage.setItem("gymauth_session", JSON.stringify({ token: "tok", exp: Math.floor(Date.now() / 1000) + 20 * 3600, source: "local", profile: { name: "T", email: "t@example.com" } })));
  await page.reload();
  await expect.poll(() => posts(cs).length).toBe(1);
  expect(posts(cs)[0].body).toEqual({ type: "terms", textVersion: "terms.v2", lang: "en" });
  await page.waitForTimeout(500);   // it already knew: no sheet
  await expect(sheet(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("gym_terms_synced"))).toBe("terms.v2");
  await context.close();
});

test("terms.v2: an old backend (400 for the unknown type) keeps the local flag, never blocks, retries next launch", async ({ browser }) => {
  const cs = newCs({ postStatus: 400 });
  const { context, page } = await openApp(browser, { signedIn: true, termsSynced: false, setup: consentRoutes(cs) });
  await expect.poll(() => posts(cs).length).toBe(1);
  await expect(sheet(page)).toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.getItem("gym_terms_ok"), localStorage.getItem("gym_terms_synced")])).toEqual(["terms.v2", null]);
  await page.reload();
  await expect.poll(() => posts(cs).length).toBe(2);
  await context.close();
});

// ---------------- the one-time re-accept sheet ----------------

test("re-accept: a signed-in account without terms.v2 on the server sees the sheet; Agree posts it and closes", async ({ browser }) => {
  const cs = newCs({ list: [COACH_REC] });
  const { context, page } = await openApp(browser, { signedIn: true, termsOk: false, setup: async (c, s) => { await consentRoutes(cs)(c); await oldFlag(c); } });
  const dlg = sheet(page);
  await expect(dlg).toBeVisible();
  await expect(dlg.locator("h2")).toHaveText("We've updated our Terms");
  await expect(dlg.locator('a[href="/terms#ai-coach"]')).toHaveCount(1);
  await expect(dlg.locator('a[href="/privacy"]')).toHaveCount(1);
  await expect(dlg.locator("input")).toHaveCount(0);   // nothing pre-ticked, nothing to tick
  await expect(dlg.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(dlg.getByRole("link", { name: "Delete my account" })).toHaveAttribute("href", "/delete-account");
  await shot(page, "reaccept-en");
  await dlg.getByRole("button", { name: "Agree and continue" }).click();
  await expect(dlg).toHaveCount(0);
  await expect.poll(() => posts(cs).length).toBe(1);
  expect(posts(cs)[0].body).toEqual({ type: "terms", textVersion: "terms.v2", lang: "en" });
  expect(await page.evaluate(() => localStorage.getItem("gym_terms_ok"))).toBe("terms.v2");
  await context.close();
});

test("re-accept (ar): same sheet in Arabic, RTL", async ({ browser }) => {
  const cs = newCs({ list: [COACH_REC] });
  const { context, page } = await openApp(browser, { signedIn: true, termsOk: false, lang: "ar", setup: async (c) => { await consentRoutes(cs)(c); await oldFlag(c); } });
  const dlg = sheet(page);
  await expect(dlg).toBeVisible();
  await expect(dlg.locator("h2")).toHaveText("حدّثنا شروط الاستخدام");
  await expect(dlg.getByRole("button", { name: "أوافق وأتابع" })).toBeVisible();
  await expect(dlg.getByRole("button", { name: "ليس الآن" })).toBeVisible();
  await shot(page, "reaccept-ar");
  await context.close();
});

test("re-accept: not shown when the server already has terms.v2 (and the flag is remembered)", async ({ browser }) => {
  const cs = newCs({ list: [COACH_REC, TERMS_REC] });
  const { context, page } = await openApp(browser, { signedIn: true, termsOk: false, setup: async (c) => { await consentRoutes(cs)(c); await oldFlag(c); } });
  await expect.poll(() => cs.reqs.filter((r) => r.method === "GET").length).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  await expect(sheet(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("gym_terms_ok"))).toBe("terms.v2");
  expect(posts(cs)).toHaveLength(0);
  await context.close();
});

test("re-accept: a guest with an older acceptance is asked; Agree records the new version locally; Not now asks again next launch", async ({ browser }) => {
  const cs = newCs();
  const { context, page } = await openApp(browser, { termsOk: false, setup: async (c) => { await consentRoutes(cs)(c); await oldFlag(c); } });
  const dlg = sheet(page);
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole("button", { name: "Sign out" })).toHaveCount(0);   // a guest has no account to leave
  await dlg.getByRole("button", { name: "Not now" }).click();
  await expect(dlg).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("gym_terms_ok"))).toBe("terms.v1");
  await page.reload();
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "Agree and continue" }).click();
  await expect(dlg).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("gym_terms_ok"))).toBe("terms.v2");
  expect(posts(cs)).toHaveLength(0);   // no account, nothing to send
  await context.close();
});

test("re-accept: the sheet traps keyboard focus, Escape means Not now, and focus goes back", async ({ browser }) => {
  const cs = newCs({ list: [COACH_REC] });
  const { context, page } = await openApp(browser, { signedIn: true, termsOk: false, setup: async (c) => { await consentRoutes(cs)(c); await oldFlag(c); } });
  const dlg = sheet(page);
  await expect(dlg).toBeVisible();
  await expect(page.locator("#tuTitle")).toBeFocused();
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement.closest("dialog.tu-sheet"))).toBe(true);
  }
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => !!document.activeElement.closest("dialog.tu-sheet"))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => !!document.activeElement.closest("dialog"))).toBe(false);
  expect(posts(cs)).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem("gym_terms_ok"))).toBe("terms.v1");   // Escape agrees to nothing
  await context.close();
});

// ---------------- Ramadan ----------------

async function ramadanForm(browser, lang) {
  const cs = newCs({ list: [COACH_REC, TERMS_REC] });
  const app = await openApp(browser, {
    signedIn: true, lang, setup: consentRoutes(cs),
    ls: { gym_coach_form_draft: { age: "30", heightCm: "175", weightKg: "80" } }
  });
  await expect(app.page.locator("#bootLoader")).toBeHidden({ timeout: 8000 });
  await app.page.clock.setSystemTime(new Date("2027-02-20T10:00:00Z"));   // 12 Ramadan 1448
  await app.page.click('#appNav button[data-tab="coach"]');
  await app.page.evaluate(() => GymCoach.newAssessment());   // re-render the form under the new date
  return app;
}

test("Ramadan: during the Hijri month it is asked, never ticked; Yes ticks it, No leaves it off", async ({ browser }) => {
  const { context, page } = await ramadanForm(browser, "en");
  const box = page.locator(".coach-ramadan input[type=checkbox]");
  const ask = page.locator(".coach-ramadan-ask");
  await expect(ask).toBeVisible();
  await expect(ask).toContainText("It's Ramadan. Are you fasting? We'll plan meals around suhoor and iftar.");
  await expect(box).not.toBeChecked();
  await ask.scrollIntoViewIfNeeded();
  await shot(page, "ramadan-en");
  await ask.getByRole("button", { name: "Yes, I'm fasting" }).click();
  await expect(box).toBeChecked();
  await expect(ask).toBeHidden();
  await context.close();
});

test("Ramadan: answering No keeps it off and the question is not asked again", async ({ browser }) => {
  const { context, page } = await ramadanForm(browser, "en");
  await page.locator(".coach-ramadan-ask").getByRole("button", { name: "No", exact: true }).click();
  await expect(page.locator(".coach-ramadan input[type=checkbox]")).not.toBeChecked();
  await page.click('#appNav button[data-tab="plan"]');
  await page.click('#appNav button[data-tab="coach"]');
  await expect(page.locator(".coach-ramadan-ask")).toBeHidden();
  await context.close();
});

test("Ramadan (ar): the question reads in Arabic", async ({ browser }) => {
  const { context, page } = await ramadanForm(browser, "ar");
  const ask = page.locator(".coach-ramadan-ask");
  await expect(ask).toContainText("حلّ شهر رمضان. هل أنت صائم؟ سنخطّط وجباتك حول السحور والإفطار.");
  await expect(page.locator(".coach-ramadan input[type=checkbox]")).not.toBeChecked();
  await ask.scrollIntoViewIfNeeded();
  await shot(page, "ramadan-ar");
  await context.close();
});

test("Ramadan: an old auto-ticked state is cleared and asked about", async ({ browser }) => {
  const cs = newCs({ list: [COACH_REC, TERMS_REC] });
  const { context, page } = await openApp(browser, {
    signedIn: true, setup: consentRoutes(cs),
    ls: { gym_coach_form_draft: { age: "30", heightCm: "175", weightKg: "80", ramadan: true, ramadanAuto: "1448-9", ramadanManual: false } }
  });
  await expect(page.locator("#bootLoader")).toBeHidden({ timeout: 8000 });
  await page.clock.setSystemTime(new Date("2027-02-20T10:00:00Z"));
  await page.click('#appNav button[data-tab="coach"]');
  await page.evaluate(() => GymCoach.newAssessment());
  await expect(page.locator(".coach-ramadan input[type=checkbox]")).not.toBeChecked();
  await expect(page.locator(".coach-ramadan-ask")).toBeVisible();
  await context.close();
});
