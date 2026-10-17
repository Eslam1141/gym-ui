const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { openApp, TODAY } = require("./helpers");

test.setTimeout(60000);

const SHOTS = process.env.SHOT_DIR;
const TARGET = { computed: { targetKcal: 2000, proteinG: 150, carbG: 200, fatG: 60 } };
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const RESULT = {
  id: "a1", want: "both", model: "claude-haiku-4-5", createdAt: "2026-10-02T07:00:00Z",
  summary: "A steady deficit built around lean protein and familiar Egyptian staples, with a training split that fits four days a week. ".repeat(3),
  computed: { bmi: 24.1, bmiClass: "normal", bmrKcal: 1700, tdeeKcal: 2600, targetKcal: 2100, proteinG: 160, fatG: 65, carbG: 210 },
  dietPlan: {
    styleLabel: "Balanced", hydrationL: 3,
    meals: [
      { name: "Breakfast", kcal: 520, proteinG: 38, items: ["3 eggs, boiled", { text: "Ful medames", gramsApprox: 200 }, "Whole-wheat baladi bread"] },
      { name: "Lunch", kcal: 760, proteinG: 55, items: ["Grilled chicken breast", "Rice", "Salad"] },
      { name: "Dinner", kcal: 640, proteinG: 48, items: ["Tuna", "Sweet potato"] }
    ],
    swaps: ["Swap rice for bulgur to add fibre and keep portions the same size.", "Swap chicken for lean beef twice a week.", "Swap ful for lentils on rest days."],
    notes: ["Eat protein at every meal.", "Drink water before each meal, not only with it, to keep hunger in check during the day.", "Weigh yourself weekly, not daily.", "Plan Friday lunch ahead.", "Sleep seven hours."]
  },
  workoutPlan: {
    split: "Upper/Lower", daysPerWeek: 4, progression: "Add one rep a week.", cardio: "20 min easy after lifting.",
    notes: ["Warm up every lift."],
    days: [{ day: "Upper A", exercises: [{ name: "Bench press", sets: 3, reps: "8-10", restSec: 90 }] },
      { day: "Lower A", exercises: [{ name: "Squat", sets: 3, reps: "6-8", restSec: 120 }] }]
  },
  disclaimers: ["Not medical advice."]
};

async function openCoachResult({ browser, lang, theme, motion, viewport }) {
  const { context, page, consoleErrors } = await openApp(browser, { signedIn: true, lang, theme, viewport, ls: { gymcoach_last: RESULT } });
  if (motion) await page.emulateMedia({ reducedMotion: motion });
  await page.click('#appNav button[data-tab="coach"]');
  await expect(page.locator(".coach-hero")).toBeVisible();
  return { context, page, consoleErrors };
}

async function shot(page, name, o, locator) {
  if (!SHOTS) return;
  expect(await page.evaluate(() => document.documentElement.lang)).toBe(o.lang === "ar" ? "ar" : "en");
  expect(await page.evaluate(() => document.documentElement.dir)).toBe(o.lang === "ar" ? "rtl" : "ltr");
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(o.theme);
  expect(await page.evaluate(() => window.innerWidth)).toBe(390);
  fs.mkdirSync(SHOTS, { recursive: true });
  const file = path.join(SHOTS, `${name}-${o.lang}-${o.theme}.png`);
  if (locator) await locator.screenshot({ path: file });
  else await page.screenshot({ path: file, fullPage: true });
}

// ---------------- S2: result layout ----------------
test("result: hero tiles, ring, chips, meal cards, tips and details", async ({ browser }) => {
  const { context, page, consoleErrors } = await openCoachResult({ browser, motion: "reduce" });
  await expect(page.locator(".coach-hero > .coach-stat")).toHaveCount(4);
  await expect(page.locator(".coach-hero .coach-stat-v").first()).toContainText("2100");
  await expect(page.locator(".coach-stat--macro")).toHaveCount(3);
  await expect(page.locator(".coach-stat--chip")).toHaveCount(3);
  await expect(page.locator(".coach-ring-arc")).toHaveCount(3);
  await expect(page.locator(".coach-ring")).toHaveAttribute("aria-label", /protein \d+%, carbs \d+%, fat \d+%/);
  const tips = await page.locator(".coach-tips li").count();
  expect(tips).toBeGreaterThanOrEqual(3);
  expect(tips).toBeLessThanOrEqual(5);
  await expect(page.locator(".coach-mcard")).toHaveCount(3);
  await expect(page.locator(".coach-mcard").first()).toContainText("520");
  await expect(page.locator(".coach-mcard").first().locator("li")).toHaveCount(3);
  // long text and workout are collapsed, but every item is still in the DOM
  const wk = page.locator("details.coach-workout");
  await expect(wk).not.toHaveAttribute("open", "");
  await expect(wk.locator(".coach-ex")).toHaveCount(2);
  await wk.locator("summary").click();
  await expect(wk.locator(".coach-ex-n").first()).toBeVisible();
  await expect(page.locator("details", { hasText: "Easy swaps" }).locator("li")).toHaveCount(3);
  await expect(page.locator("details", { hasText: "Notes" }).locator("li")).toHaveCount(5);
  await expect(page.locator("details", { hasText: "Summary" }).first()).not.toHaveAttribute("open", "");
  await expect(page.locator(".coach-disc")).toContainText("Not medical advice.");
  expect(consoleErrors.filter((e) => !/status of 404/.test(e))).toEqual([]); // 404s are unmocked endpoints/fonts
  await context.close();
});

test("result: grids have no gaps (macro row spans full width, odd meal count fills the row)", async ({ browser }) => {
  const { context, page } = await openCoachResult({ browser, motion: "reduce", viewport: { width: 900, height: 900 } });
  const gap = await page.evaluate(() => {
    const hero = document.querySelector(".coach-hero").getBoundingClientRect();
    const macro = [...document.querySelectorAll(".coach-stat--macro")].map((e) => e.getBoundingClientRect());
    const kcal = document.querySelector(".coach-stat--kcal").getBoundingClientRect();
    const meals = document.querySelector(".coach-meals").getBoundingClientRect();
    const cards = [...document.querySelectorAll(".coach-mcard")].map((e) => e.getBoundingClientRect());
    return {
      kcalW: Math.abs(kcal.width - hero.width),
      macroSpan: Math.abs(macro[2].right - macro[0].left - hero.width),
      lastW: Math.abs(cards[2].width - meals.width),
      cols: cards.filter((c) => Math.abs(c.top - cards[0].top) < 2).length
    };
  });
  expect(gap.kcalW).toBeLessThan(1.5);
  expect(gap.macroSpan).toBeLessThan(1.5);
  expect(gap.cols).toBe(2);
  expect(gap.lastW).toBeLessThan(1.5);
  await context.close();
});

test("result: ring arcs animate in with motion and are drawn finished with reduced motion", async ({ browser }) => {
  const reduced = await openCoachResult({ browser, motion: "reduce" });
  const fin = await reduced.page.locator(".coach-ring-p").getAttribute("stroke-dasharray");
  expect(parseFloat(fin)).toBeGreaterThan(5);
  expect(await reduced.page.locator(".coach-ring-arc").first().evaluate((e) => parseFloat(getComputedStyle(e).transitionDuration))).toBeLessThan(0.01);
  await reduced.context.close();
  const moving = await openCoachResult({ browser, motion: "no-preference" });
  await expect.poll(async () => parseFloat(await moving.page.locator(".coach-ring-p").getAttribute("stroke-dasharray"))).toBeGreaterThan(5);
  expect(await moving.page.locator(".coach-ring-arc").first().evaluate((e) => parseFloat(getComputedStyle(e).transitionDuration))).toBeGreaterThan(0.3);
  await moving.context.close();
});

for (const lang of ["en", "ar"]) {
  test(`result: no horizontal overflow at 360px (${lang}, rtl aware)`, async ({ browser }) => {
    const { context, page } = await openCoachResult({ browser, lang, motion: "reduce", viewport: { width: 360, height: 780 } });
    expect(await page.evaluate(() => document.documentElement.dir)).toBe(lang === "ar" ? "rtl" : "ltr");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await context.close();
  });
}

// ---------------- S1: chat ----------------
async function openChat({ browser, lang, theme, reply }) {
  const { context, page } = await openApp(browser, { signedIn: true, lang, theme, ls: { gymcoach_last: TARGET } });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls = { chat: [], posts: [], foodQs: [], mealsGets: 0 };
  const meals = [{ id: "m1", mealType: "breakfast", nameEn: "Boiled egg", grams: 100, nutrients: { kcal: 155, protein: 13, carbs: 1, fat: 11 }, date: TODAY }];
  await page.route((u) => u.pathname.endsWith("/api/v1/meals"), (route) => {
    const req = route.request();
    if (req.method() === "POST") { calls.posts.push(JSON.parse(req.postData())); return json(route, 201, { ...meals[0], id: "n" + calls.posts.length, date: TODAY }); }
    calls.mealsGets++;
    return json(route, 200, { meals });
  });
  await page.route((u) => u.pathname.endsWith("/api/v1/foods"), (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") || "";
    calls.foodQs.push(q);
    if (/mystery/i.test(q)) return json(route, 200, { foods: [] });
    return json(route, 200, { foods: [{ id: "f_" + q.replace(/\W+/g, "_"), nameEn: "Catalog " + q, nameAr: "كتالوج " + q }] });
  });
  await page.route((u) => u.pathname.endsWith("/api/v1/assistant/chat"), (route) => {
    calls.chat.push(JSON.parse(route.request().postData()));
    return json(route, 200, reply);
  });
  await page.click('#appNav button[data-tab="coach"]'); // the coach FAB only shows on the Coach tab
  await page.click("#coachFab");
  return { context, page, calls };
}
async function say(page, text) {
  await page.fill("#coachChatInput", text);
  await page.press("#coachChatInput", "Enter");
}

const PROPOSED = {
  reply: "Here is breakfast as you described it.",
  proposedMeals: [
    { text: "Boiled eggs", grams: 100, kcalApprox: 155, proteinG: 13, slot: "breakfast" },
    { text: "Cooked rice", grams: 200, kcalApprox: 260, proteinG: 5, slot: "lunch" },
    { text: "Mystery stew", grams: 250, kcalApprox: 300, proteinG: 20, slot: "dinner" }
  ]
};

test("chat sends foodToday: target, eaten totals and logged items, within 2000 chars", async ({ browser }) => {
  const { context, page, calls } = await openChat({ browser, reply: { reply: "ok" } });
  await say(page, "how am I doing?");
  await expect(page.locator(".coach-chat-msg.assistant")).toHaveText("ok");
  expect(calls.chat).toHaveLength(1);
  const ft = calls.chat[0].foodToday;
  expect(typeof ft).toBe("string");
  expect(ft.length).toBeLessThanOrEqual(2000);
  expect(ft).toContain("Target 2000 kcal, protein 150g, carbs 200g, fat 60g");
  expect(ft).toContain("Eaten 155 kcal");
  expect(ft).toContain("breakfast: Boiled egg 100g 155kcal");
  expect(ft).toContain(TODAY);
  await context.close();
});

test("chat foodToday is capped at 2000 chars with a huge log", async ({ browser }) => {
  const { context, page, calls } = await openChat({ browser, reply: { reply: "ok" } });
  const many = Array.from({ length: 300 }, (_, i) => ({ id: "x" + i, mealType: "snack", nameEn: "Item number " + i + " with a long name", grams: 50, nutrients: { kcal: 10 }, date: TODAY }));
  await page.route((u) => u.pathname.endsWith("/api/v1/meals"), (route) => json(route, 200, { meals: many }));
  await say(page, "hi");
  await expect(page.locator(".coach-chat-msg.assistant")).toHaveText("ok");
  expect(calls.chat[0].foodToday.length).toBeLessThanOrEqual(2000);
  await context.close();
});

test("proposed meals: card matches the catalog, logs nothing until Add, then POSTs only ticked items with edited grams", async ({ browser }) => {
  const { context, page, calls } = await openChat({ browser, reply: PROPOSED });
  await say(page, "add my meals");
  const card = page.locator(".coach-chat-pm");
  await expect(card).toBeVisible();
  const rows = card.locator(".coach-chat-pm-item");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Catalog Boiled eggs");
  await expect(rows.nth(0)).toContainText("Breakfast");
  await expect(rows.nth(0)).toContainText("155 kcal");
  await expect(rows.nth(2)).toContainText("Not found in the catalog. Add it manually in Food.");
  await expect(rows.nth(2).locator("input[type=checkbox]")).toBeDisabled();
  expect(calls.posts).toHaveLength(0); // nothing logged by merely showing the card

  await rows.nth(1).locator("input[type=checkbox]").uncheck();
  const g = rows.nth(0).locator(".coach-chat-pm-grams");
  await g.fill("150");
  await expect(rows.nth(0)).toContainText("233 kcal"); // 155 * 150/100, rounded
  const getsBefore = calls.mealsGets;
  await card.locator(".coach-chat-pm-add").click();
  await expect(page.locator("#gymToast")).toContainText("Added 1 to today's log");
  expect(calls.posts).toEqual([{ date: TODAY, mealType: "breakfast", foodId: "f_Boiled_eggs", grams: 150 }]);
  await expect(rows.nth(0)).toHaveClass(/is-done/);
  expect(calls.mealsGets).toBeGreaterThan(getsBefore - 1); // food view refresh is requested
  await context.close();
});

test("proposed meals: the Add button stays disabled with nothing ticked and rejects bad grams", async ({ browser }) => {
  const { context, page, calls } = await openChat({ browser, reply: PROPOSED });
  await say(page, "add my meals");
  const card = page.locator(".coach-chat-pm");
  const add = card.locator(".coach-chat-pm-add");
  await expect(add).toBeEnabled();
  await card.locator(".coach-chat-pm-item").nth(0).locator("input[type=checkbox]").uncheck();
  await card.locator(".coach-chat-pm-item").nth(1).locator("input[type=checkbox]").uncheck();
  await expect(add).toBeDisabled();
  await card.locator(".coach-chat-pm-item").nth(1).locator("input[type=checkbox]").check();
  await card.locator(".coach-chat-pm-item").nth(1).locator(".coach-chat-pm-grams").fill("0");
  await add.click();
  await expect(card.locator(".coach-chat-pm-status")).toContainText("Check the amounts");
  expect(calls.posts).toHaveLength(0);
  await context.close();
});

test("proposed meals: model text is inert (textContent only)", async ({ browser }) => {
  const evil = '<img src=x onerror="window.__xss=1"><b>bold</b>';
  const { context, page } = await openChat({
    browser,
    reply: { reply: evil, proposedMeals: [{ text: evil + " eggs", grams: 100, kcalApprox: 100, slot: "<script>window.__xss=2</script>" }] }
  });
  await say(page, "add");
  const card = page.locator(".coach-chat-pm");
  await expect(card).toBeVisible();
  await expect(card.locator(".coach-chat-pm-text")).toContainText("<img src=x onerror=");
  expect(await page.locator("#coachChatMsgs img, #coachChatMsgs b, #coachChatMsgs script").count()).toBe(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await context.close();
});

// ---------------- S3: InBody upload ----------------
const CONSENT_V = "2026-10-16";
const rec = (over) => Object.assign({ type: "inbody_ai", textVersion: CONSENT_V, lang: "en", grantedAt: "2026-10-10T09:00:00Z" }, over || {});
const coachRec = (over) => rec(Object.assign({ type: "coach_ai", textVersion: "coach_ai.v1" }, over || {}));
// In-memory stand-in for GET/POST/DELETE /me/consents (one record per type).
async function mockConsents(page, cs) {
  await page.route((u) => u.pathname.endsWith("/api/v1/me/consents") || u.pathname.includes("/api/v1/me/consents/"), (route) => {
    const req = route.request();
    const entry = { method: req.method(), path: new URL(req.url()).pathname.replace(/^.*\/api\/v1/, ""), body: req.postData() ? JSON.parse(req.postData()) : null, auth: req.headers().authorization };
    cs.reqs.push(entry);
    if (req.method() === "GET") return json(route, cs.getStatus || 200, { consents: cs.list });
    if (req.method() === "POST") {
      if (cs.postStatus !== 200) return json(route, cs.postStatus, { error: { code: "x", message: "x" } });
      const r = rec({ type: entry.body.type, textVersion: entry.body.textVersion, lang: entry.body.lang, grantedAt: "2026-10-16T12:00:00Z" });
      cs.list = cs.list.filter((c) => c.type !== r.type).concat(r);
      return json(route, 200, r);
    }
    if (cs.deleteStatus !== 204) return json(route, cs.deleteStatus, { error: { code: "x", message: "x" } });
    const gone = entry.path.split("/").pop();
    cs.list = cs.list.map((c) => (c.type === gone ? { ...c, withdrawnAt: "2026-10-16T13:00:00Z" } : c));
    return route.fulfill({ status: 204 });
  });
}
async function openForm({ browser, lang, theme, motion, flag = true, consent = true, consents, coach = true }) {
  const o = await openApp(browser, { signedIn: true, lang, theme });
  if (motion) await o.page.emulateMedia({ reducedMotion: motion });
  await o.page.addInitScript((on) => { if (on) localStorage.setItem("etq_ff_inbody", "1"); }, flag);
  await o.page.addInitScript(() => {
    window.__blobs = [];
    const orig = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, type, q) {
      window.__blobs.push({ w: this.width, h: this.height, type, q });
      return orig.call(this, cb, type, q);
    };
  });
  await o.page.reload();
  await o.page.waitForFunction(() => window.GymRest && window.GymDate);
  // The AI Coach consent (coach_ai) gates the whole coach, so every InBody fixture also carries it.
  const cs = { list: (consents || (consent ? [rec()] : [])).concat(coach ? [coachRec()] : []), reqs: [], postStatus: 200, deleteStatus: 204 };
  await mockConsents(o.page, cs);
  await o.page.click('#appNav button[data-tab="coach"]');
  await o.page.click(".coach-ib-toggle");
  if (flag && consent) await expect(o.page.locator("#coachIbFile")).toBeEnabled(); // the stored agreement was found
  const state = { status: 200, body: null, reqs: [] };
  await o.page.route((u) => u.pathname.endsWith("/api/v1/assistant/inbody/extract"), (route) => {
    const req = route.request();
    state.reqs.push({ headers: req.headers(), data: req.postDataBuffer() });
    if (state.status !== 200) return json(route, state.status, { error: { code: "x", message: "x" } });
    return json(route, 200, state.body);
  });
  return { ...o, state, cs };
}
async function bigPng(page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 3200; c.height = 2400;
    const x = c.getContext("2d");
    for (let i = 0; i < 60; i++) { x.fillStyle = `hsl(${i * 6},70%,50%)`; x.fillRect((i * 53) % 3200, (i * 37) % 2400, 400, 300); }
    return c.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(b64, "base64");
}
const FULL = { bodyFatPct: 22.4, skeletalMuscleMassKg: 33.1, visceralFatLevel: 7, bmrKcal: 1710, weightKg: 82.5 };

test("InBody: privacy note shows first; upload is resized, sent as multipart `image` with auth, and prefills + highlights fields", async ({ browser }) => {
  const { context, page, state } = await openForm({ browser, motion: "reduce" });
  state.body = FULL;
  await expect(page.locator(".coach-ib-notice")).toContainText("Anthropic, our AI provider in the United States");
  await expect(page.locator(".coach-ib-crop")).toContainText("Keep only the results table");
  await expect(page.locator(".coach-ib-pick")).toHaveText("Choose photo");
  await expect(page.locator("#coachIbFile")).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
  await page.evaluate(() => { window.__blobs = []; });
  await page.setInputFiles("#coachIbFile", { name: "inbody.png", mimeType: "image/png", buffer: await bigPng(page) });
  await expect(page.locator(".coach-ib-status")).toContainText("Filled 5 fields");
  await expect(page.locator(".coach-ib-status")).toContainText("AI can misread them");
  const blobs = await page.evaluate(() => window.__blobs);
  expect(blobs.length).toBeGreaterThanOrEqual(1);
  expect(blobs[0].type).toBe("image/jpeg");
  expect(blobs[0].q).toBeCloseTo(0.85, 2);
  expect(Math.max(blobs[0].w, blobs[0].h)).toBeLessThanOrEqual(1568);
  expect(Math.max(blobs[0].w, blobs[0].h)).toBe(1568);
  expect(state.reqs).toHaveLength(1);
  const { headers, data } = state.reqs[0];
  expect(headers["content-type"]).toMatch(/^multipart\/form-data; boundary=/);
  expect(headers.authorization).toBe("Bearer tok");
  expect(data.length).toBeLessThanOrEqual(900 * 1024);
  const text = data.toString("latin1");
  expect(text).toContain('name="image"');
  expect(text).toContain("Content-Type: image/jpeg");
  expect(text.indexOf("\xff\xd8\xff")).toBeGreaterThan(0); // JPEG SOI: re-encoded, not the PNG passed through
  expect(text).not.toContain("PNG");
  for (const [k, v] of Object.entries(FULL)) await expect(page.locator(`input[name="${k}"]`)).toHaveValue(String(v));
  await expect(page.locator(".coach-field.is-prefilled")).toHaveCount(5);
  await expect(page.locator(".coach-prefill-tag")).toHaveCount(5);
  // editing a field counts as reviewed: its highlight goes away
  await page.fill('input[name="bmrKcal"]', "1700");
  await expect(page.locator(".coach-field.is-prefilled")).toHaveCount(4);
  await context.close();
});

test("InBody: quality steps down when the first encode is over 880 KB", async ({ browser }) => {
  const { context, page, state } = await openForm({ browser, motion: "reduce" });
  state.body = FULL;
  await page.evaluate(() => {
    window.__blobs = [];
    const orig = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, type, q) {
      window.__blobs.push({ w: this.width, q });
      if (q > 0.8) return cb(new Blob([new Uint8Array(900 * 1024)], { type: "image/jpeg" })); // pretend q.85 is too big
      return orig.call(this, cb, type, q);
    };
  });
  await page.setInputFiles("#coachIbFile", { name: "inbody.png", mimeType: "image/png", buffer: await bigPng(page) });
  await expect(page.locator(".coach-ib-status")).toContainText("Filled 5 fields");
  const blobs = await page.evaluate(() => window.__blobs);
  expect(blobs.map((b) => b.q).slice(0, 2)).toEqual([0.85, 0.7]);
  expect(state.reqs[0].data.length).toBeLessThanOrEqual(900 * 1024);
  await context.close();
});

const ERRORS = [
  [413, "That photo is too large"],
  [415, "Use a JPEG, PNG or WebP photo"],
  [422, "We couldn't read that photo"],
  [429, "reached today's limit"],
  [503, "busy right now"]
];
for (const [status, text] of ERRORS) {
  test(`InBody: ${status} shows a friendly message and leaves the fields alone`, async ({ browser }) => {
    const { context, page, state } = await openForm({ browser, motion: "reduce" });
    state.status = status;
    await page.setInputFiles("#coachIbFile", { name: "i.png", mimeType: "image/png", buffer: await bigPng(page) });
    await expect(page.locator(".coach-ib-status.is-error")).toContainText(text);
    await expect(page.locator('input[name="bodyFatPct"]')).toHaveValue("");
    await expect(page.locator(".coach-field.is-prefilled")).toHaveCount(0);
    await expect(page.locator("#coachIbFile")).toBeEnabled();
    await context.close();
  });
}

test("InBody: Arabic error copy, empty reading and a non-image file", async ({ browser }) => {
  const { context, page, state } = await openForm({ browser, lang: "ar", motion: "reduce" });
  expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
  state.status = 429;
  await page.setInputFiles("#coachIbFile", { name: "i.png", mimeType: "image/png", buffer: await bigPng(page) });
  await expect(page.locator(".coach-ib-status.is-error")).toContainText("بلغت حدّ اليوم");
  state.status = 200; state.body = {};
  await page.setInputFiles("#coachIbFile", { name: "i.png", mimeType: "image/png", buffer: await bigPng(page) });
  await expect(page.locator(".coach-ib-status.is-error")).toContainText("لم نجد أي أرقام");
  const n = state.reqs.length;
  await page.setInputFiles("#coachIbFile", { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.locator(".coach-ib-status.is-error")).toContainText("JPEG");
  expect(state.reqs.length).toBe(n); // rejected before any upload
  await context.close();
});

test("InBody: upload is hidden without the etq_ff_inbody flag, manual fields stay", async ({ browser }) => {
  const { context, page } = await openForm({ browser, flag: false });
  await expect(page.locator(".coach-ib-upload")).toHaveCount(0);
  await expect(page.locator("#coachIbFile")).toHaveCount(0);
  await expect(page.locator('input[name="bodyFatPct"]')).toBeVisible();
  await context.close();
});

test("InBody consent: ticking POSTs type, version and language, then enables upload; reopening shows the date", async ({ browser }) => {
  const { context, page, state, cs } = await openForm({ browser, consent: false, motion: "reduce" });
  state.body = FULL;
  const agree = page.locator("#coachIbAgree");
  await expect(agree).not.toBeChecked();
  await expect(page.locator("#coachIbFile")).toBeDisabled();
  await expect(page.locator(".coach-ib-agree")).toContainText("health information");
  await expect(page.locator(".coach-ib-agree")).toContainText("Anthropic in the United States");
  await agree.check();
  await expect(page.locator("#coachIbFile")).toBeEnabled();
  const post = cs.reqs.find((r) => r.method === "POST");
  expect(post.path).toBe("/me/consents");
  expect(post.body).toEqual({ type: "inbody_ai", textVersion: "2026-10-16", lang: "en" });
  expect(post.auth).toMatch(/^Bearer /);
  await expect(page.locator(".coach-ib-meta")).toContainText("You agreed on");
  await page.click('#appNav button[data-tab="food"]'); // leave and come back: the form re-renders and re-reads the server
  await page.click('#appNav button[data-tab="coach"]');
  await expect(page.locator("#coachIbAgree")).toBeChecked();
  await expect(page.locator(".coach-ib-meta")).toContainText("You agreed on Oct 16, 2026");
  await expect(page.locator("#coachIbFile")).toBeEnabled();
  await page.click(".coach-ib-type");
  await expect(page.locator(".coach-ib-upload")).toBeHidden();
  await context.close();
});

test("InBody consent: an active record for the current wording shows the box ticked with its date and no POST", async ({ browser }) => {
  const { context, page, cs } = await openForm({ browser, consents: [rec()], motion: "reduce" });
  await expect(page.locator("#coachIbAgree")).toBeChecked();
  await expect(page.locator(".coach-ib-meta")).toContainText("You agreed on Oct 10, 2026");
  await expect(page.locator("#coachIbFile")).toBeEnabled();
  expect(cs.reqs.filter((r) => r.method === "POST")).toHaveLength(0);
  await context.close();
});

test("InBody consent: Arabic language is sent, and an old wording version or a withdrawn record needs a fresh agreement", async ({ browser }) => {
  for (const list of [[rec({ textVersion: "2026-01-01" })], [rec({ withdrawnAt: "2026-10-12T00:00:00Z" })]]) {
    const { context, page, cs } = await openForm({ browser, lang: "ar", consents: list, consent: false, motion: "reduce" });
    await expect(page.locator("#coachIbAgree")).not.toBeChecked();
    await expect(page.locator("#coachIbFile")).toBeDisabled();
    await expect(page.locator(".coach-ib-meta")).toBeHidden();
    await page.check("#coachIbAgree");
    await expect(page.locator("#coachIbFile")).toBeEnabled();
    expect(cs.reqs.find((r) => r.method === "POST").body).toEqual({ type: "inbody_ai", textVersion: "2026-10-16", lang: "ar" });
    await expect(page.locator(".coach-ib-meta")).toContainText("وافقت بتاريخ");
    await context.close();
  }
});

test("InBody consent: a failed POST unticks the box, shows an inline error and keeps upload disabled", async ({ browser }) => {
  const { context, page, cs } = await openForm({ browser, consent: false, motion: "reduce" });
  cs.postStatus = 500;
  await page.check("#coachIbAgree", { noWaitAfter: true }).catch(() => {});
  await expect(page.locator(".coach-ib-cmsg")).toContainText("Couldn't save your agreement");
  await expect(page.locator("#coachIbAgree")).not.toBeChecked();
  await expect(page.locator("#coachIbFile")).toBeDisabled();
  cs.postStatus = 200; // retry works
  await page.check("#coachIbAgree");
  await expect(page.locator("#coachIbFile")).toBeEnabled();
  await expect(page.locator(".coach-ib-cmsg")).toHaveText("");
  await context.close();
});

test("InBody consent: unticking or the Withdraw link sends DELETE, disables upload and confirms; a failed DELETE keeps it on", async ({ browser }) => {
  const { context, page, cs } = await openForm({ browser, motion: "reduce" });
  cs.deleteStatus = 500;
  await page.click(".coach-ib-meta .coach-link");
  await expect(page.locator(".coach-ib-cmsg")).toContainText("Couldn't withdraw");
  await expect(page.locator("#coachIbAgree")).toBeChecked();
  await expect(page.locator("#coachIbFile")).toBeEnabled();
  cs.deleteStatus = 204;
  await page.click(".coach-ib-meta .coach-link");
  await expect(page.locator(".coach-ib-cmsg")).toContainText("Consent withdrawn");
  await expect(page.locator("#coachIbAgree")).not.toBeChecked();
  await expect(page.locator("#coachIbFile")).toBeDisabled();
  expect(cs.reqs.filter((r) => r.method === "DELETE").pop().path).toBe("/me/consents/inbody_ai");
  await page.check("#coachIbAgree"); // grant again, then untick the box itself
  await expect(page.locator("#coachIbFile")).toBeEnabled();
  await page.uncheck("#coachIbAgree");
  await expect(page.locator("#coachIbFile")).toBeDisabled();
  await expect(page.locator(".coach-ib-cmsg")).toContainText("Consent withdrawn");
  await context.close();
});

test("InBody consent: a 403 from extract shows the consent box again with its own message, not the generic error", async ({ browser }) => {
  const { context, page, state } = await openForm({ browser, motion: "reduce" });
  state.status = 403;
  await page.setInputFiles("#coachIbFile", { name: "inbody.png", mimeType: "image/png", buffer: await bigPng(page) });
  await expect(page.locator(".coach-ib-cmsg")).toContainText("We need your agreement before we can read photos");
  await expect(page.locator(".coach-ib-cmsg.is-error")).toBeVisible();
  await expect(page.locator(".coach-ib-upload > .coach-ib-status")).toHaveText("");
  await expect(page.locator("#coachIbAgree")).not.toBeChecked();
  await expect(page.locator("#coachIbAgree")).toBeFocused();
  await expect(page.locator("#coachIbFile")).toBeDisabled();
  await context.close();
});

test("InBody upload also needs the AI coach consent: the sheet comes first, then the photo is sent once", async ({ browser }) => {
  const { context, page, state, cs } = await openForm({ browser, coach: false });
  state.body = { bodyFatPct: 20 };
  await page.setInputFiles("#coachIbFile", { name: "inbody.png", mimeType: "image/png", buffer: await bigPng(page) });
  const dlg = page.locator("dialog.cc-sheet[open]");
  await expect(dlg).toBeVisible();
  expect(state.reqs).toHaveLength(0);
  await dlg.locator("label.cc-agree").click();
  await dlg.locator(".pv-btn-fill").click();
  await expect(page.locator('[name="bodyFatPct"]')).toHaveValue("20");
  expect(state.reqs).toHaveLength(1);
  expect(cs.reqs.filter((r) => r.method === "POST").map((r) => r.body.type)).toEqual(["coach_ai"]);
  await context.close();
});

test("Privacy: the withdraw entry is hidden without the flag or a consent, and withdraws an active one", async ({ browser }) => {
  // flag off, no consent: hidden
  let o = await openForm({ browser, flag: false, consent: false });
  await o.page.click('#appNav button[data-tab="more"]');
  await expect(o.page.locator("#pvIbRow")).toBeHidden();
  await o.context.close();
  // flag off but an active consent: shown; withdraw
  o = await openForm({ browser, flag: false, consent: true });
  await o.page.evaluate(() => document.dispatchEvent(new CustomEvent("gym:authchange")));
  await o.page.click('#appNav button[data-tab="more"]');
  await expect(o.page.locator("#pvIbRow")).toBeVisible();
  await expect(o.page.locator("#pvIbRow .pv-title")).toHaveText("Withdraw InBody photo consent");
  await o.page.click("#pvIbBtn");
  await expect(o.page.locator("#pvIbStatus")).toContainText("Consent withdrawn");
  expect(o.cs.reqs.filter((r) => r.method === "DELETE")).toHaveLength(1);
  await expect(o.page.locator("#pvIbBtn")).toBeDisabled();
  await o.context.close();
  // flag on, no consent: shown but nothing to withdraw
  o = await openForm({ browser, flag: true, consent: false });
  await o.page.click('#appNav button[data-tab="more"]');
  await expect(o.page.locator("#pvIbRow")).toBeVisible();
  await expect(o.page.locator("#pvIbBtn")).toBeDisabled();
  await o.context.close();
});

test("InBody: consent, crop and review text exist in Arabic", async ({ browser }) => {
  const { context, page, state } = await openForm({ browser, lang: "ar", consent: false, motion: "reduce" });
  state.body = FULL;
  await expect(page.locator(".coach-ib-h")).toHaveText("قراءة الأرقام من صورة (اختياري)");
  await expect(page.locator(".coach-ib-notice")).toContainText("Anthropic، مزوّد الذكاء الاصطناعي لدينا في الولايات المتحدة الأمريكية");
  await expect(page.locator(".coach-ib-agree")).toContainText("أوافق على إرسال هذه الصورة");
  await expect(page.locator(".coach-ib-crop")).toContainText("أبقِ جدول النتائج فقط");
  await expect(page.locator(".coach-ib-pick")).toHaveText("اختر صورة");
  await page.check("#coachIbAgree");
  await page.setInputFiles("#coachIbFile", { name: "i.png", mimeType: "image/png", buffer: await bigPng(page) });
  await expect(page.locator(".coach-ib-status")).toContainText("فقد يخطئ الذكاء الاصطناعي");
  await context.close();
});

// ---------------- screenshots (SHOT_DIR) ----------------
if (SHOTS) {
  for (const lang of ["en", "ar"]) {
    for (const theme of ["light", "dark"]) {
      const o = { lang, theme };
      test(`screenshot result ${lang} ${theme}`, async ({ browser }) => {
        const { context, page } = await openCoachResult({ browser, lang, theme, motion: "reduce" });
        await shot(page, "result", o);
        await context.close();
      });
      test(`screenshot chat card ${lang} ${theme}`, async ({ browser }) => {
        const { context, page } = await openChat({ browser, lang, theme, reply: PROPOSED });
        await say(page, "add my meals");
        await expect(page.locator(".coach-chat-pm-item.is-pending")).toHaveCount(0);
        await shot(page, "chat-meals", o);
        await context.close();
      });
      test(`screenshot inbody ${lang} ${theme}`, async ({ browser }) => {
        const { context, page, state } = await openForm({ browser, lang, theme, motion: "reduce" });
        state.body = FULL;
        await page.setInputFiles("#coachIbFile", { name: "i.png", mimeType: "image/png", buffer: await bigPng(page) });
        await expect(page.locator(".coach-field.is-prefilled")).toHaveCount(5);
        await page.locator(".coach-ib-upload").scrollIntoViewIfNeeded();
        await shot(page, "inbody", o);
        await context.close();
      });
      test(`screenshot inbody consent ${lang} ${theme}`, async ({ browser }) => {
        const { context, page, state } = await openForm({ browser, lang, theme, motion: "reduce" });
        await page.locator(".coach-ib-upload").scrollIntoViewIfNeeded();
        await shot(page, "consent-granted", o, page.locator(".coach-ib-upload"));
        state.status = 403;
        await page.setInputFiles("#coachIbFile", { name: "i.png", mimeType: "image/png", buffer: await bigPng(page) });
        await expect(page.locator(".coach-ib-cmsg.is-error")).toBeVisible();
        await shot(page, "consent-needed", o, page.locator(".coach-ib-upload"));
        await context.close();
      });
    }
  }
}

test("result: New assessment opens the form (the click event is not taken as saved form state)", async ({ browser }) => {
  const { context, page, consoleErrors } = await openCoachResult({ browser, motion: "reduce" });
  await page.locator(".coach-actions .coach-secondary").first().click();
  await expect(page.locator("#coachBody form.coach-form")).toBeVisible();
  await expect(page.locator(".coach-hero")).toHaveCount(0);
  expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]); // no script errors
  await context.close();
});
