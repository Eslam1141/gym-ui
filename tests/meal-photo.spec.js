const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { openApp, TODAY } = require("./helpers");

test.setTimeout(90000);

const SHOTS = process.env.SHOT_DIR;
const TARGET = { computed: { targetKcal: 2000, proteinG: 150, carbG: 200, fatG: 60 } };
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

// A 2000x1400 noisy PNG (about 8 MB): bigger than the 900 KB / 1568 px limits, so the re-encode has to do real work.
function bigPng() {
  const w = 2000, h = 1400, row = 1 + w * 3;
  const raw = Buffer.alloc(row * h);
  let seed = 12345;
  for (let y = 0; y < h; y++) {
    raw[y * row] = 0;
    for (let x = 0; x < w * 3; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      raw[y * row + 1 + x] = ((x / 3 / w) * 160 + (seed >> 16) % 96) & 255;
    }
  }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const t = Buffer.from(type), len = Buffer.alloc(4), c = Buffer.alloc(4);
    len.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 1 })), chunk("IEND", Buffer.alloc(0))]);
}
const PNG = bigPng();
const photo = () => ({ name: "lunch.png", mimeType: "image/png", buffer: PNG });

// Minimal multipart reader: field name -> string, plus the image part as a Buffer.
function parseMultipart(req) {
  const ct = req.headers()["content-type"] || "";
  const boundary = "--" + ct.split("boundary=")[1];
  const buf = req.postDataBuffer();
  const out = { fields: {}, image: null };
  let pos = buf.indexOf(boundary);
  while (pos >= 0) {
    const next = buf.indexOf(boundary, pos + boundary.length);
    if (next < 0) break;
    const part = buf.subarray(pos + boundary.length + 2, next - 2);
    const split = part.indexOf("\r\n\r\n");
    const head = part.subarray(0, split).toString("latin1");
    const body = part.subarray(split + 4);
    const name = /name="([^"]+)"/.exec(head)[1];
    if (name === "image") out.image = { head, body }; else out.fields[name] = body.toString("utf8");
    pos = next;
  }
  return out;
}
function jpegSize(b) {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

const OK = {
  reply: "Looks like grilled chicken with rice, around 640 kcal.",
  meals: [
    { text: "Grilled chicken", grams: 150, kcalApprox: 250, proteinG: 40, slot: "dinner" },
    { text: "Cooked rice", grams: 200, kcalApprox: 260, proteinG: 5, slot: "dinner" }
  ],
  totalKcal: 510, fits: "under", remainingKcal: 900
};

// meals: what GET /meals answers (default: nothing logged); mealsStatus: make that GET fail; ls: replaces the stored plan target.
async function openChat({ browser, lang, theme, status, body, acked, viewport, meals, mealsStatus, ls }) {
  const { context, page } = await openApp(browser, { signedIn: true, lang, theme, viewport, ls: ls || { gymcoach_last: TARGET } });
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (acked) await page.evaluate(() => localStorage.setItem("etq_mealphoto_ack", "1"));
  const calls = { photo: [], posts: [], chat: [] };
  await page.route((u) => u.pathname.endsWith("/api/v1/meals"), (route) => {
    const req = route.request();
    if (req.method() === "POST") { calls.posts.push(JSON.parse(req.postData())); return json(route, 201, { id: "n1", date: TODAY }); }
    if (mealsStatus) return json(route, mealsStatus, { error: { code: "x", message: "x" } });
    return json(route, 200, { meals: meals || [] });
  });
  await page.route((u) => u.pathname.endsWith("/api/v1/foods"), (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") || "";
    return json(route, 200, { foods: [{ id: "f_" + q.replace(/\W+/g, "_"), nameEn: "Catalog " + q, nameAr: "كتالوج " + q }] });
  });
  await page.route((u) => u.pathname.endsWith("/api/v1/assistant/chat"), (route) => {
    calls.chat.push(JSON.parse(route.request().postData()));
    return json(route, 200, { reply: "ok" });
  });
  await page.route((u) => u.pathname.endsWith("/api/v1/assistant/meal-photo"), (route) => {
    const req = route.request();
    calls.photo.push({ auth: req.headers().authorization, ...parseMultipart(req) });
    return json(route, status || 200, body || OK);
  });
  await page.click('#appNav button[data-tab="coach"]');
  await page.click("#coachFab");
  await expect(page.locator("#coachChat.show")).toBeVisible();
  return { context, page, calls };
}
async function choose(page, note) {
  await page.setInputFiles("#coachPhotoGallery", photo());
  await expect(page.locator("#coachPhotoChip")).toBeVisible({ timeout: 30000 });
  if (note) await page.fill("#coachChatInput", note);
}
async function shot(page, name, o) {
  if (!SHOTS) return;
  expect(await page.evaluate(() => document.documentElement.lang)).toBe(o.lang);
  expect(await page.evaluate(() => document.documentElement.dir)).toBe(o.lang === "ar" ? "rtl" : "ltr");
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(o.theme);
  expect(await page.evaluate(() => window.innerWidth)).toBe(390);
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `mealphoto-${name}-${o.lang}-${o.theme}.png`) });
}

test("the inputs are real file inputs: the camera one has capture=environment, the gallery one does not", async ({ browser }) => {
  const { context, page } = await openChat({ browser });
  await expect(page.locator("#coachPhotoCamera")).toHaveAttribute("capture", "environment");
  await expect(page.locator("#coachPhotoCamera")).toHaveAttribute("accept", "image/*");
  await expect(page.locator("#coachPhotoGallery")).not.toHaveAttribute("capture", /.*/);
  await expect(page.locator("#coachPhotoGallery")).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
  await context.close();
});

test("on a touch device the photo button opens a menu with Take photo and Choose from gallery", async ({ browser }) => {
  const { context, page } = await openChat({ browser });
  await page.evaluate(() => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/pointer:\s*coarse/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q)); });
  await page.click("#coachPhotoBtn");
  await expect(page.locator("#coachPhotoMenu")).toBeVisible();
  await expect(page.locator("#coachPhotoTake")).toHaveText("Take photo");
  await expect(page.locator("#coachPhotoPick")).toHaveText("Choose from gallery");
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("#coachPhotoTake")]);
  expect(chooser.isMultiple()).toBe(false);
  await expect(page.locator("#coachPhotoMenu")).toBeHidden();
  await page.click("#coachPhotoBtn");
  await page.keyboard.press("Escape"); // closes the menu first, not the chat
  await expect(page.locator("#coachPhotoMenu")).toBeHidden();
  await expect(page.locator("#coachChat.show")).toBeVisible();
  await context.close();
});

test("photo is re-encoded to a small JPEG and sent as multipart with lang, note, targetKcal and eatenKcal (and no plan or food text); reply, badge and confirm card render; Add logs the meals", async ({ browser }) => {
  const egg = { id: "m1", mealType: "breakfast", nameEn: "Boiled egg", grams: 100, nutrients: { kcal: 155, protein: 13, carbs: 1, fat: 11 }, date: TODAY };
  const { context, page, calls } = await openChat({ browser, acked: true, meals: [egg, { ...egg, id: "m2", nutrients: { kcal: 100.4 } }] });
  await page.evaluate(() => { window.GymCoach.planSummary = () => "Plan: 4 days"; });
  await choose(page, "half portion");
  await page.press("#coachChatInput", "Enter");

  await expect(page.locator(".coach-chat-msg.assistant")).toHaveText(OK.reply);
  expect(calls.photo).toHaveLength(1);
  const c = calls.photo[0];
  expect(c.auth).toBe("Bearer tok");
  expect(c.fields.lang).toBe("en");
  expect(c.fields.note).toBe("half portion");
  expect(Object.keys(c.fields).sort()).toEqual(["eatenKcal", "lang", "note", "targetKcal"]); // no planSummary, no foodToday
  expect(c.fields.targetKcal).toBe("2000");
  expect(c.fields.eatenKcal).toBe("255"); // whole kcal: 155 + 100.4 rounded
  expect(c.image.head).toContain("image/jpeg");
  expect(c.image.body[0]).toBe(0xff); expect(c.image.body[1]).toBe(0xd8); // JPEG, not the PNG we picked
  expect(c.image.body.length).toBeLessThanOrEqual(900 * 1024);
  const dim = jpegSize(c.image.body);
  expect(Math.max(dim.w, dim.h)).toBeLessThanOrEqual(1568);
  expect(PNG.length).toBeGreaterThan(900 * 1024);

  await expect(page.locator(".coach-chat-msg.user img")).toBeVisible();
  await expect(page.locator(".coach-chat-msg.user")).toContainText("half portion");
  await expect(page.locator(".coach-mp-total")).toHaveText("About 510 kcal");
  await expect(page.locator(".coach-mp-fit")).toHaveText("Under target, 900 kcal left");
  await expect(page.locator(".coach-mp-fit")).toHaveClass(/under/);
  const rows = page.locator(".coach-chat-pm .coach-chat-pm-item");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Catalog Grilled chicken");
  expect(await page.evaluate(() => document.activeElement.id)).toBe("coachChatInput"); // #123: keyboard stays up
  expect(await page.locator("#coachChatInput").isEnabled()).toBe(true);
  await page.locator(".coach-chat-pm-add").click();
  await expect(page.locator("#gymToast")).toContainText("Added 2 to today's log");
  // the model said "dinner"; the card uses the user's local time of day (10:00 in the test clock = breakfast)
  expect(calls.posts.map((p) => [p.mealType, p.grams])).toEqual([["breakfast", 150], ["breakfast", 200]]);
  await shot(page, "result", { lang: "en", theme: "dark" });
  await context.close();
});

test("fits badge: on_track is green, over shows +X over, unknown is neutral", async ({ browser }) => {
  for (const [body, cls, text] of [
    [{ ...OK, fits: "on_track", remainingKcal: 40 }, /on_track/, "On track"],
    [{ ...OK, fits: "over", remainingKcal: -120 }, /over/, "+120 over"],
    [{ ...OK, fits: "unknown", remainingKcal: null }, /unknown/, "Estimate only"]
  ]) {
    const { context, page } = await openChat({ browser, acked: true, body });
    await choose(page);
    await page.press("#coachChatInput", "Enter");
    await expect(page.locator(".coach-mp-fit")).toHaveText(text);
    await expect(page.locator(".coach-mp-fit")).toHaveClass(cls);
    await context.close();
  }
});

test("first-time notice shows once: Cancel keeps the photo unsent, Continue sends and remembers", async ({ browser }) => {
  const { context, page, calls } = await openChat({ browser });
  await choose(page);
  await page.press("#coachChatInput", "Enter");
  await expect(page.locator("#coachPhotoNotice")).toBeVisible();
  await expect(page.locator("#coachPhotoNoticeText")).toHaveText("Your photo goes to Anthropic (US) to estimate calories. We don't save it, and Anthropic normally deletes it within 30 days. Photograph only your food: keep people, faces (especially children), medicines and documents out of the frame. Estimates can be well off, especially for oil, sauces and hidden ingredients.");
  expect(calls.photo).toHaveLength(0);
  await page.click("#coachPhotoNoticeCancel");
  await expect(page.locator("#coachPhotoNotice")).toBeHidden();
  await expect(page.locator("#coachPhotoChip")).toBeVisible();
  expect(calls.photo).toHaveLength(0);
  await page.press("#coachChatInput", "Enter");
  await page.click("#coachPhotoNoticeOk");
  await expect(page.locator(".coach-chat-msg.assistant")).toHaveText(OK.reply);
  expect(calls.photo).toHaveLength(1);
  await choose(page);
  await page.press("#coachChatInput", "Enter");
  await expect(page.locator("#coachPhotoNotice")).toBeHidden();
  await expect.poll(() => calls.photo.length).toBe(2);
  await context.close();
});

test("only known numbers are sent: no plan target and a failing meals lookup send neither field; an empty log sends eatenKcal 0", async ({ browser }) => {
  let o = await openChat({ browser, acked: true, ls: {}, mealsStatus: 500 });
  await choose(o.page);
  await o.page.press("#coachChatInput", "Enter");
  await expect(o.page.locator(".coach-chat-msg.assistant")).toHaveText(OK.reply);
  expect(Object.keys(o.calls.photo[0].fields).sort()).toEqual(["lang"]);
  await o.context.close();
  o = await openChat({ browser, acked: true, ls: {} });
  await choose(o.page);
  await o.page.press("#coachChatInput", "Enter");
  await expect(o.page.locator(".coach-chat-msg.assistant")).toHaveText(OK.reply);
  expect(o.calls.photo[0].fields).toEqual({ lang: "en", eatenKcal: "0" });
  await o.context.close();
});

test("the target comes from the Food screen's source, including the cached server plan (gymcoach_target)", async ({ browser }) => {
  const o = await openChat({ browser, acked: true, ls: { gymcoach_target: { computed: { targetKcal: 2350.4 }, createdAt: "2026-10-01T00:00:00Z", sub: null } } });
  await choose(o.page);
  await o.page.press("#coachChatInput", "Enter");
  await expect(o.page.locator(".coach-chat-msg.assistant")).toHaveText(OK.reply);
  expect(o.calls.photo[0].fields.targetKcal).toBe("2350");
  await o.context.close();
});

test("the chip carries the food-only tip, in English and Arabic", async ({ browser }) => {
  for (const [lang, tip] of [["en", "Food only, no people."], ["ar", "الطعام فقط، من دون أشخاص."]]) {
    const o = await openChat({ browser, lang, acked: true });
    await choose(o.page);
    await expect(o.page.locator("#coachPhotoChipTip")).toContainText(tip);
    await o.context.close();
  }
});

// In-memory /me/consents for the combined flow with the real GymCoachConsent sheet.
async function mockConsents(page, cs) {
  await page.route((u) => u.pathname.includes("/api/v1/me/consents"), (route) => {
    const req = route.request();
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    cs.reqs.push({ method: req.method(), body });
    if (req.method() === "GET") return json(route, 200, { consents: cs.list });
    cs.list = [{ type: body.type, textVersion: body.textVersion, lang: body.lang, grantedAt: "2026-10-17T09:00:00Z" }];
    return json(route, 200, cs.list[0]);
  });
}
const REC = [{ type: "coach_ai", textVersion: "coach_ai.v1", lang: "en", grantedAt: "2026-10-17T09:00:00Z" }];
const sheet = (page) => page.locator("dialog.cc-sheet[open]");

test("missing consent at send shows the real consent sheet first, then sends the photo once and renders the result", async ({ browser }) => {
  const { context, page, calls } = await openChat({ browser, acked: true });
  const cs = { list: REC, reqs: [] };
  await mockConsents(page, cs);
  await page.evaluate(() => GymCoachConsent.reset());
  await choose(page);
  cs.list = []; // withdrawn on another device after the chat opened
  let n = 0;
  await page.route((u) => u.pathname.endsWith("/api/v1/assistant/meal-photo"), (route) => { n++; return json(route, 200, OK); });
  await page.press("#coachChatInput", "Enter");
  await expect(sheet(page)).toBeVisible();
  expect(n).toBe(0); // the pre-check found no consent, so nothing was sent yet
  await sheet(page).locator("label.cc-agree").click();
  await sheet(page).locator(".pv-btn-fill").click();
  await expect(page.locator(".coach-chat-msg.assistant")).toHaveText(OK.reply);
  expect(n).toBe(1);
  expect(cs.reqs.filter((r) => r.method === "POST").map((r) => r.body.type)).toEqual(["coach_ai"]);
  await context.close();
});

test("a stale-cache 403 from the server clears the cache, asks, and retries exactly once", async ({ browser }) => {
  const { context, page } = await openChat({ browser, acked: true });
  const cs = { list: REC, reqs: [] };
  await mockConsents(page, cs);
  await page.evaluate(() => GymCoachConsent.reset());
  await choose(page);
  await page.evaluate(() => GymCoachConsent.ensure()); // cache now says granted
  cs.list = [];
  let n = 0;
  await page.route((u) => u.pathname.endsWith("/api/v1/assistant/meal-photo"), (route) => {
    n++;
    return n === 1 ? json(route, 403, { error: { code: "consent_required", message: "x" } }) : json(route, 200, OK);
  });
  await page.press("#coachChatInput", "Enter");
  await expect(sheet(page)).toBeVisible();
  expect(n).toBe(1);
  await sheet(page).locator("label.cc-agree").click();
  await sheet(page).locator(".pv-btn-fill").click();
  await expect(page.locator(".coach-chat-msg.assistant")).toHaveText(OK.reply);
  expect(n).toBe(2);
  await context.close();
});

test("Not now on the consent sheet sends nothing and keeps the photo ready", async ({ browser }) => {
  const { context, page, calls } = await openChat({ browser, acked: true });
  const cs = { list: REC, reqs: [] };
  await mockConsents(page, cs);
  await page.evaluate(() => GymCoachConsent.reset());
  await choose(page);
  cs.list = [];
  await page.evaluate(() => GymCoachConsent.reset());
  await page.press("#coachChatInput", "Enter");
  await expect(sheet(page)).toBeVisible();
  await sheet(page).locator(".pv-actions .pv-btn").first().click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.locator("#coachPhotoChip")).toBeVisible();
  expect(calls.photo).toHaveLength(0);
  await context.close();
});

test("the result carries the estimate footer and the note placeholder steers away from health detail, in English and Arabic", async ({ browser }) => {
  for (const [lang, foot, ph] of [
    ["en", "Estimate from a photo. Check it before adding it to your log.", "Optional: portion size, cooking method or ingredients"],
    ["ar", "تقدير من صورة؛ راجعه قبل إضافته إلى سجلك.", "اختياري: حجم الحصة أو طريقة الطهي أو المكوّنات"]
  ]) {
    const { context, page } = await openChat({ browser, lang, acked: true });
    await choose(page);
    await expect(page.locator("#coachChatInput")).toHaveAttribute("placeholder", ph);
    await page.press("#coachChatInput", "Enter");
    await expect(page.locator(".coach-mp-foot")).toHaveText(foot);
    await context.close();
  }
});

test("errors use the {error:{code}} envelope: not_food and rate_limited become friendly bubbles", async ({ browser }) => {
  const nf = await openChat({ browser, acked: true, status: 422, body: { error: { code: "not_food", message: "no food" } } });
  await choose(nf.page);
  await nf.page.press("#coachChatInput", "Enter");
  await expect(nf.page.locator(".coach-chat-msg.system")).toHaveText("I couldn't see food in that photo. Try a closer shot.");
  await expect(nf.page.locator(".coach-chat-pm")).toHaveCount(0);
  expect(await nf.page.locator("#coachChatInput").isEnabled()).toBe(true);
  await shot(nf.page, "not-food", { lang: "en", theme: "dark" });
  await nf.context.close();

  const rl = await openChat({ browser, acked: true, status: 429, body: { error: { code: "rate_limited", message: "slow down" } } });
  await choose(rl.page);
  await rl.page.press("#coachChatInput", "Enter");
  await expect(rl.page.locator(".coach-chat-msg.system")).toHaveText("You've used today's 5 meal photos. Try again tomorrow.");
  await rl.context.close();
});

test("a failing server gives a retryable bubble; the thread stays usable", async ({ browser }) => {
  const { context, page, calls } = await openChat({ browser, acked: true, status: 503, body: { error: { code: "coach_busy", message: "busy" } } });
  await choose(page);
  await page.press("#coachChatInput", "Enter");
  await expect(page.locator(".coach-chat-msg.system")).toContainText("unavailable right now");
  await page.locator(".coach-chat-retry").click();
  await expect.poll(() => calls.photo.length).toBe(2);
  await context.close();
});

test("unsupported file type is refused before upload", async ({ browser }) => {
  const { context, page, calls } = await openChat({ browser, acked: true });
  await page.setInputFiles("#coachPhotoGallery", { name: "a.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await expect(page.locator(".coach-chat-msg.system")).toHaveText("Use a JPEG, PNG or WebP photo.");
  expect(calls.photo).toHaveLength(0);
  await context.close();
});

test("the thumbnail is not persisted: history keeps a text placeholder and no image after reload", async ({ browser }) => {
  const { context, page } = await openChat({ browser, acked: true });
  await choose(page);
  await page.press("#coachChatInput", "Enter");
  await expect(page.locator(".coach-chat-msg.assistant")).toHaveText(OK.reply);
  const stored = await page.evaluate(() => localStorage.getItem("gymcoach_chat_history"));
  expect(stored).toContain("📷 Meal photo");
  expect(stored).not.toContain("blob:");
  expect(stored).not.toContain("data:image");
  await page.reload();
  await page.click('#appNav button[data-tab="coach"]');
  await page.click("#coachFab");
  await expect(page.locator(".coach-chat-msg.user").first()).toContainText("📷 Meal photo");
  await expect(page.locator("#coachChatMsgs img")).toHaveCount(0);
  await context.close();
});

for (const [lang, theme] of [["en", "light"], ["ar", "dark"], ["ar", "light"]]) {
  test(`screenshots ${lang}/${theme}: chip, notice and result fit at 390px without overflow`, async ({ browser }) => {
    const { context, page } = await openChat({ browser, lang, theme });
    await choose(page, lang === "ar" ? "نصف حصة" : "half portion");
    await shot(page, "chip", { lang, theme });
    await page.press("#coachChatInput", "Enter");
    await shot(page, "notice", { lang, theme });
    await page.click("#coachPhotoNoticeOk");
    await expect(page.locator(".coach-mp-sum")).toBeVisible();
    await shot(page, "result", { lang, theme });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (lang === "ar") await expect(page.locator(".coach-mp-total")).toContainText("حوالي");
    await context.close();
  });
}
