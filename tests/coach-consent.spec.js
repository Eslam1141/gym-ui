const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { openApp } = require("./helpers");

test.setTimeout(60000);

const SHOTS = process.env.SHOT_DIR;
const DRAFT = { age: "30", heightCm: "175", weightKg: "80" };
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const REC = { type: "coach_ai", textVersion: "coach_ai.v1", lang: "en", grantedAt: "2026-10-17T09:00:00Z" };
const RESULT = {
  id: "a1", want: "both", model: "claude-haiku-4-5", createdAt: "2026-10-02T07:00:00Z", summary: "A steady plan.",
  computed: { bmi: 24.1, bmiClass: "normal", bmrKcal: 1700, tdeeKcal: 2600, targetKcal: 2100, proteinG: 160, fatG: 65, carbG: 210 },
  dietPlan: { styleLabel: "Balanced", hydrationL: 3, meals: [{ name: "Breakfast", kcal: 520, proteinG: 38, items: ["3 eggs"] }], swaps: [], notes: [] },
  workoutPlan: { split: "Upper/Lower", daysPerWeek: 4, days: [{ day: "Upper A", exercises: [{ name: "Bench press", sets: 3, reps: "8-10", restSec: 90 }] }] },
  disclaimers: []
};

// cs.list: what GET /me/consents returns. cs.assist: per-route queue of [status, body] answers (the last one repeats).
async function setup(browser, { lang = "en", theme = "dark", granted = false } = {}) {
  const app = await openApp(browser, { signedIn: true, lang, theme, ls: { gym_coach_form_draft: DRAFT, gymcoach_last: { id: "a1" } } });
  const cs = { list: granted ? [REC] : [], reqs: [], postStatus: 200, assist: {}, calls: [] };
  await app.context.route(/\/api\/v1\/me\/consents/, (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, "");
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    cs.reqs.push({ method: req.method(), path: p, body });
    if (req.method() === "GET") return json(route, 200, { consents: cs.list });
    if (req.method() === "POST") {
      if (cs.postStatus !== 200) return json(route, cs.postStatus, { error: { code: "x", message: "x" } });
      const r = { ...REC, textVersion: body.textVersion, lang: body.lang };
      cs.list = cs.list.filter((c) => c.type !== body.type).concat(r);
      return json(route, 200, r);
    }
    cs.list = cs.list.map((c) => (c.type === p.split("/").pop() ? { ...c, withdrawnAt: "2026-10-17T10:00:00Z" } : c));
    return route.fulfill({ status: 204 });
  });
  await app.context.route(/\/api\/v1\/assistant\//, (route) => {
    const req = route.request();
    const name = new URL(req.url()).pathname.replace(/^.*\/assistant\//, "");
    if (name === "checkin/status") return json(route, 200, { submitted: false });
    if (req.method() !== "POST") return route.fulfill({ status: 404, body: "{}" });
    cs.calls.push(name);
    const q = cs.assist[name] || [[200, name === "chat" ? { reply: "Hello there." } : name === "checkin" ? { id: "c1", summary: "Nice week." } : RESULT]];
    const [status, body] = q.length > 1 ? q.shift() : q[0];
    return json(route, status, body);
  });
  await app.page.evaluate(() => document.dispatchEvent(new CustomEvent("gym:authchange")));
  return { ...app, cs };
}
const openFab = async (page) => { await page.click('#appNav button[data-tab="coach"]'); await page.click("#coachFab"); }; // the FAB only shows on the Coach tab
const sheet = (page) => page.locator("dialog.cc-sheet[open]");
const consentErr = { error: { code: "consent_required", message: "x" } };
const startPlan = async (page) => {
  await page.click('#appNav button[data-tab="coach"]');
  await page.locator("#coachBody form button[type=submit]").first().click();
};
async function shot(page, name, o) {
  if (!SHOTS) return;
  expect(await page.evaluate(() => document.documentElement.lang)).toBe(o.lang);
  expect(await page.evaluate(() => document.documentElement.dir)).toBe(o.lang === "ar" ? "rtl" : "ltr");
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(o.theme);
  expect(await page.evaluate(() => window.innerWidth)).toBe(390);
  await page.emulateMedia({ reducedMotion: "reduce" }); // the sheet slides in: shoot it settled
  await page.waitForTimeout(150);
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}-${o.lang}-${o.theme}.png`) });
}

for (const lang of ["en", "ar"]) {
  const L = lang === "ar"
    ? { title: "قبل استخدام المدرّب الذكي", go: "تفعيل المدرّب الذكي", cancel: "ليس الآن", off: "إيقاف المدرّب الذكي", note: "المدرّب الذكي يعمل بتقنية Anthropic", unavail: "تعذّر على المدرّب الذكي التحقق" }
    : { title: "Before you use the AI coach", go: "Turn on the AI coach", cancel: "Not now", off: "Turn off AI coach", note: "AI coach powered by Anthropic (US)", unavail: "The AI coach can't check your settings" };

  for (const theme of ["light", "dark"]) {
    test(`[${lang}/${theme}] first plan submit shows the sheet; Continue waits for the tick; consent is POSTed, then the plan is requested`, async ({ browser }) => {
      const { context, page, cs, consoleErrors } = await setup(browser, { lang, theme });
      await startPlan(page);
      await expect(sheet(page)).toBeVisible();
      await expect(sheet(page).locator("#ccTitle")).toHaveText(L.title);
      await expect(sheet(page).locator("#ccAgree")).not.toBeChecked();
      await expect(sheet(page).locator(".pv-btn-fill")).toBeDisabled();
      await expect(sheet(page).locator(".pv-btn-fill")).toHaveText(L.go);
      await expect(sheet(page).locator(".pv-actions .pv-btn").first()).toHaveText(L.cancel);
      expect(cs.calls).toEqual([]);
      for (const b of await sheet(page).locator("button").all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await shot(page, "sheet", { lang, theme });
      await sheet(page).locator("label.cc-agree").click();
      await expect(sheet(page).locator(".pv-btn-fill")).toBeEnabled();
      await sheet(page).locator(".pv-btn-fill").click();
      await expect(page.locator(".coach-hero")).toBeVisible();
      const post = cs.reqs.find((r) => r.method === "POST");
      expect(post.path).toBe("/me/consents");
      expect(post.body).toEqual({ type: "coach_ai", textVersion: "coach_ai.v1", lang });
      expect(cs.calls).toEqual(["assessment"]);
      expect(consoleErrors.filter((e) => !/404/.test(e))).toEqual([]);
      await context.close();
    });
  }

  test(`[${lang}] Not now sends nothing and keeps the form`, async ({ browser }) => {
    const { context, page, cs } = await setup(browser, { lang });
    await startPlan(page);
    await expect(sheet(page)).toBeVisible();
    await sheet(page).locator(".pv-actions .pv-btn").first().click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.locator("#coachBody form")).toBeVisible();
    expect(cs.calls).toEqual([]);
    expect(cs.reqs.filter((r) => r.method === "POST")).toEqual([]);
    await context.close();
  });

  test(`[${lang}] a failed save keeps the sheet open with an error and no plan request`, async ({ browser }) => {
    const { context, page, cs } = await setup(browser, { lang });
    cs.postStatus = 500;
    await startPlan(page);
    await sheet(page).locator("label.cc-agree").click();
    await sheet(page).locator(".pv-btn-fill").click();
    await expect(sheet(page).locator(".pv-err")).not.toBeEmpty();
    expect(cs.calls).toEqual([]);
    await context.close();
  });

  test(`[${lang}] existing consent: no sheet, the plan is requested straight away`, async ({ browser }) => {
    const { context, page, cs } = await setup(browser, { lang, granted: true });
    await startPlan(page);
    await expect(page.locator(".coach-hero")).toBeVisible();
    await expect(page.locator("dialog.cc-sheet")).toHaveCount(0);
    expect(cs.calls).toEqual(["assessment"]);
    expect(cs.reqs.filter((r) => r.method === "POST")).toEqual([]);
    await context.close();
  });

  test(`[${lang}] chat: opening asks once, shows the one-line notice, and the message goes out`, async ({ browser }) => {
    const { context, page, cs } = await setup(browser, { lang });
    await openFab(page);
    await expect(sheet(page)).toBeVisible();
    await sheet(page).locator("label.cc-agree").click();
    await sheet(page).locator(".pv-btn-fill").click();
    await expect(page.locator("#coachChat.show")).toBeVisible();
    await expect(page.locator("#coachChatNote")).toContainText(L.note);
    await page.fill("#coachChatInput", "hi");
    await page.press("#coachChatInput", "Enter");
    await expect(page.locator(".coach-chat-msg.assistant")).toHaveText("Hello there.");
    expect(cs.calls).toEqual(["chat"]);
    await shot(page, "chat-notice", { lang, theme: "dark" });
    await context.close();
  });

  test(`[${lang}] a 403 consent_required from chat clears the cache, asks, and retries once`, async ({ browser }) => {
    const { context, page, cs } = await setup(browser, { lang, granted: true });
    await openFab(page);
    await expect(page.locator("#coachChat.show")).toBeVisible();
    cs.assist.chat = [[403, consentErr], [200, { reply: "Back again." }]];
    cs.list = []; // withdrawn elsewhere
    await page.fill("#coachChatInput", "hi");
    await page.press("#coachChatInput", "Enter");
    await expect(sheet(page)).toBeVisible();
    expect(cs.calls).toEqual(["chat"]);
    await sheet(page).locator("label.cc-agree").click();
    await sheet(page).locator(".pv-btn-fill").click();
    await expect(page.locator(".coach-chat-msg.assistant")).toHaveText("Back again.");
    expect(cs.calls).toEqual(["chat", "chat"]);
    await context.close();
  });

  test(`[${lang}] a 403 that persists after consent is retried only once`, async ({ browser }) => {
    const { context, page, cs } = await setup(browser, { lang, granted: true });
    await openFab(page);
    cs.assist.chat = [[403, consentErr]];
    cs.list = [];
    await page.fill("#coachChatInput", "hi");
    await page.press("#coachChatInput", "Enter");
    await sheet(page).locator("label.cc-agree").click();
    await sheet(page).locator(".pv-btn-fill").click();
    await expect(page.locator(".coach-chat-msg.system")).toBeVisible();
    expect(cs.calls).toEqual(["chat", "chat"]);
    await context.close();
  });

  test(`[${lang}] 503 consent_check_unavailable shows a friendly try-again message`, async ({ browser }) => {
    const { context, page, cs } = await setup(browser, { lang, granted: true });
    cs.assist.chat = [[503, { error: { code: "consent_check_unavailable", message: "x" } }]];
    await openFab(page);
    await page.fill("#coachChatInput", "hi");
    await page.press("#coachChatInput", "Enter");
    await expect(page.locator(".coach-chat-msg.system")).toContainText(L.unavail);
    await expect(page.locator(".coach-chat-retry")).toBeVisible();
    await expect(page.locator("dialog.cc-sheet")).toHaveCount(0);
    await context.close();
  });

  test(`[${lang}] 503 on the plan shows the message with a retry`, async ({ browser }) => {
    const { context, page, cs } = await setup(browser, { lang, granted: true });
    cs.assist.assessment = [[503, { error: { code: "consent_check_unavailable", message: "x" } }]];
    await startPlan(page);
    await expect(page.locator(".coach-state")).toContainText(L.unavail);
    await context.close();
  });

  test(`[${lang}] check-in asks first, then posts`, async ({ browser }) => {
    const { context, page, cs } = await setup(browser, { lang });
    await page.click('#appNav button[data-tab="coach"]');
    await page.locator(".checkin-card .coach-primary").click();
    await page.fill('input[name="weightKg"]', "79");
    await page.fill('input[name="adherencePct"]', "80");
    await page.locator('[data-field="energy"] button[data-val="3"]').click();
    await page.locator('[data-field="soreness"] button[data-val="2"]').click();
    await page.locator('#coachBody form:has(input[name="adherencePct"]) button[type=submit]').click();
    await expect(sheet(page)).toBeVisible();
    expect(cs.calls).toEqual([]);
    await sheet(page).locator("label.cc-agree").click();
    await sheet(page).locator(".pv-btn-fill").click();
    await expect.poll(() => cs.calls).toEqual(["checkin"]);
    await context.close();
  });

  test(`[${lang}] withdrawal: More -> Privacy sends DELETE /me/consents/coach_ai`, async ({ browser }) => {
    const { context, page, cs } = await setup(browser, { lang, granted: true });
    await page.click('#appNav button[data-tab="more"]');
    await expect(page.locator("#pvCaRow")).toBeVisible();
    await expect(page.locator("#pvCaBtn")).toHaveText(L.off);
    await page.click("#pvCaBtn");
    await expect(page.locator("#pvCaStatus")).not.toHaveText("");
    expect(cs.reqs.filter((r) => r.method === "DELETE").map((r) => r.path)).toEqual(["/me/consents/coach_ai"]);
    await expect(page.locator("#pvCaBtn")).toBeDisabled();
    // withdrawn: the next coach use asks again
    await startPlan(page);
    await expect(sheet(page)).toBeVisible();
    await context.close();
  });
}
