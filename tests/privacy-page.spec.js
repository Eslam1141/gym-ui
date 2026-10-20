// The public /privacy page (landing/privacy.html), the in-app links to it, the
// sign-up agreement line, /terms and the assessment's age minimum. The route table serves
// landing/ at "/" (with /privacy -> privacy.html, as docker/default.conf does)
// and the repo root for /icons.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { openApp } = require("./helpers");

test.setTimeout(60000);
const REPO = path.join(__dirname, "..");
const LANDING = path.join(REPO, "landing");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
// Stable ids from the policy's Part C.2 (the Arabic block prefixes them with "ar-").
const ANCHORS = ["who-we-are", "at-a-glance", "what-we-collect", "purposes", "ai-coach", "meal-photos", "inbody", "feedback", "device-storage",
  "sharing", "transfers", "retention", "security", "rights", "export", "delete", "withdraw", "children", "regional", "changes", "contact"];
const FILLED = {
  LEGAL_ENTITY_NAME: "Etqadem LLC", STATE: "Wyoming", REGISTERED_ADDRESS: "1 Main St, Cheyenne", PRIVACY_EMAIL: "privacy@example.com",
  DPO: false, HOSTING_COUNTRY: "Germany", BACKUP_DAYS: 35, LOG_DAYS: 14,
  EFFECTIVE_DATE: { en: "20 October 2026", ar: "20 أكتوبر 2026" }, FEEDBACK_TTL_LIVE: true
};

async function openPolicy(browser, { lang = "en", hash = "", width = 1280, facts, route = "/privacy" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block", locale: lang === "ar" ? "ar-EG" : "en-US" });
  await context.addInitScript((l) => { try { if (l) localStorage.setItem("gym_lang", l); } catch (e) {} }, lang);
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== "127.0.0.1") return route.fulfill({ status: 404, body: "" });
    if (facts && u.pathname === "/privacy-facts.js") {
      return route.fulfill({ status: 200, contentType: "text/javascript", body: "window.PRIVACY_FACTS = " + JSON.stringify(facts) + ";" });
    }
    const p = u.pathname === "/privacy" ? "privacy.html" : u.pathname === "/terms" ? "terms.html" : u.pathname.slice(1);
    let file = path.join(LANDING, p);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(REPO, p);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(route + hash);
  await page.waitForFunction(() => document.querySelector("[data-doc]:not([hidden])"));
  return { context, page, errors };
}

test("EN: renders every anchor id from the policy, in LTR, with no script errors", async ({ browser }) => {
  const { context, page, errors } = await openPolicy(browser, { lang: "en" });
  expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir])).toEqual(["en", "ltr"]);
  await expect(page.locator("h1:visible")).toHaveText("Privacy Policy");
  for (const id of ANCHORS) await expect(page.locator("#" + id), id).toHaveCount(1);
  await expect(page.locator("#doc-ar")).toBeHidden();
  expect(await page.locator("#doc-en .sec").count()).toBe(18);
  expect(errors).toEqual([]);
  await context.close();
});

test("AR: renders every anchor id (ar- prefixed), in RTL, and the toggle switches language", async ({ browser }) => {
  const { context, page, errors } = await openPolicy(browser, { lang: "ar" });
  expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir])).toEqual(["ar", "rtl"]);
  await expect(page.locator("h1:visible")).toHaveText("سياسة الخصوصية");
  for (const id of ANCHORS) await expect(page.locator("#ar-" + id), id).toHaveCount(1);
  await expect(page.locator("#doc-en")).toBeHidden();
  await page.click("#langBtn");
  await expect(page.locator("h1:visible")).toHaveText("Privacy Policy");
  expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir, localStorage.getItem("gym_lang")])).toEqual(["en", "ltr", "en"]);
  expect(errors).toEqual([]);
  await context.close();
});

test("a plain #ai-coach link lands on the section of the language showing", async ({ browser }) => {
  for (const [lang, id] of [["en", "ai-coach"], ["ar", "ar-ai-coach"]]) {
    const { context, page } = await openPolicy(browser, { lang, hash: "#ai-coach", width: 390 });
    await expect.poll(() => page.evaluate((i) => { const r = document.getElementById(i).getBoundingClientRect(); return r.top >= -5 && r.top < 300; }, id)).toBe(true);
    await context.close();
  }
});

test("the page has no horizontal scroll at 360px in either language", async ({ browser }) => {
  for (const lang of ["en", "ar"]) {
    const { context, page } = await openPolicy(browser, { lang, width: 360 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), lang).toBe(true);
    await context.close();
  }
});

test("Draft banner shows while a placeholder is unfilled, in both languages", async ({ browser }) => {
  let o = await openPolicy(browser, { lang: "en" });
  await expect(o.page.locator("#doc-en [data-draft]")).toBeVisible();
  await expect(o.page.locator("#doc-en [data-draft]")).toHaveText("Draft — not yet in effect");
  await expect(o.page.locator("#doc-en .fact.is-todo").first()).toBeVisible();
  await o.context.close();
  o = await openPolicy(browser, { lang: "ar" });
  await expect(o.page.locator("#doc-ar [data-draft]")).toHaveText("مسودة — لم تسرِ بعد");
  await o.context.close();
});

test("Draft banner stays while only some facts are filled", async ({ browser }) => {
  const { context, page } = await openPolicy(browser, { facts: { ...FILLED, LOG_DAYS: "" } });
  await expect(page.locator("#doc-en [data-draft]")).toBeVisible();
  await expect(page.locator("#doc-en [data-fact=LOG_DAYS]")).toHaveText("[LOG_DAYS]");
  await expect(page.locator("#doc-en [data-fact=LEGAL_ENTITY_NAME]").first()).toHaveText("Etqadem LLC");
  await context.close();
});

test("Draft banner is hidden once every fact is filled, and the values are rendered", async ({ browser }) => {
  for (const lang of ["en", "ar"]) {
    const { context, page } = await openPolicy(browser, { lang, facts: FILLED });
    const doc = page.locator(lang === "ar" ? "#doc-ar" : "#doc-en");
    await expect(doc.locator("[data-draft]")).toBeHidden();
    await expect(doc.locator(".fact.is-todo")).toHaveCount(0);
    expect(await doc.innerText(), lang).not.toMatch(/\[[A-Z_]{3,}\]/);
    await expect(doc.locator("[data-fact=PRIVACY_EMAIL] a").first()).toHaveAttribute("href", "mailto:privacy@example.com");
    await expect(doc.locator("[data-fact=EFFECTIVE_DATE]")).toHaveText(lang === "ar" ? "20 أكتوبر 2026" : "20 October 2026");
    // DPO: false removes the line; BACKUP_DAYS: 35 fills the row
    await expect(doc.locator("[data-optional=DPO]")).toBeHidden();
    await expect(doc.locator("[data-fact=BACKUP_DAYS]")).toHaveText("35");
    await context.close();
  }
});

test("BACKUP_DAYS: false drops the backups row, FEEDBACK_TTL_LIVE switches the feedback retention text", async ({ browser }) => {
  let o = await openPolicy(browser, { facts: { ...FILLED, BACKUP_DAYS: false, FEEDBACK_TTL_LIVE: false } });
  await expect(o.page.locator("#doc-en [data-optional=BACKUP_DAYS]")).toBeHidden();
  await expect(o.page.locator("#doc-en [data-draft]")).toBeHidden();
  await expect(o.page.locator("#doc-en [data-ttl=fallback]")).toBeVisible();
  await expect(o.page.locator("#doc-en [data-ttl=live]")).toBeHidden();
  await o.context.close();
  o = await openPolicy(browser, { facts: { ...FILLED, FEEDBACK_TTL_LIVE: true } });
  await expect(o.page.locator("#doc-en [data-ttl=live]")).toBeVisible();
  await expect(o.page.locator("#doc-en [data-ttl=live]")).toContainText("deleted 90 days later");
  await expect(o.page.locator("#doc-en [data-ttl=fallback]")).toBeHidden();
  await o.context.close();
});

test("the shipped config has the feedback schedule live (gym-be TTL is merged)", async ({ browser }) => {
  const { context, page } = await openPolicy(browser);
  await expect(page.locator("#doc-en [data-ttl=live]")).toBeVisible();
  await expect(page.locator("#doc-en [data-ttl=fallback]")).toBeHidden();
  await context.close();
});

test("the shipped config really is unfilled (the owner still has to supply the facts)", async ({ browser }) => {
  const { context, page } = await openPolicy(browser);
  const facts = await page.evaluate(() => window.PRIVACY_FACTS);
  const empty = Object.keys(facts).filter((k) => k !== "FEEDBACK_TTL_LIVE" && (facts[k] === "" || (typeof facts[k] === "object" && !facts[k].en)));
  expect(empty.sort()).toEqual(["BACKUP_DAYS", "CONTACT_EMAIL", "DPO", "EFFECTIVE_DATE", "GOVERNING_VENUE", "HOSTING_COUNTRY", "LANGUAGE_PREVAILS", "LEGAL_ENTITY_NAME", "LIABILITY_CAP", "LOG_DAYS", "NOTICE_DAYS", "PRIVACY_EMAIL", "REGISTERED_ADDRESS", "STATE"]);
  await context.close();
});

// ---------------- links (Part C.3) ----------------

const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const href = (loc) => loc.getAttribute("href");

test("AI coach consent sheet links to #ai-coach in a new tab", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await context.route(/\/api\/v1\/me\/consents/, (route) => json(route, 200, { consents: [] }));
  await page.evaluate(() => { window.GymCoachConsent.ensure(); });
  const a = page.locator("dialog.cc-sheet[open] a.pol-link");
  await expect(a).toBeVisible();
  expect(await href(a)).toBe("/privacy#ai-coach");
  await expect(a).toHaveAttribute("target", "_blank");
  await expect(a).toHaveAttribute("rel", "noopener");
  await expect(a).toHaveText("Privacy Policy");
  await context.close();
});

test("InBody consent links to #inbody (AR text too)", async ({ browser }) => {
  for (const [lang, text] of [["en", "Privacy Policy"], ["ar", "سياسة الخصوصية"]]) {
    const { context, page } = await openApp(browser, { signedIn: true, lang });
    await page.addInitScript(() => localStorage.setItem("etq_ff_inbody", "1"));
    await page.reload();
    await page.waitForFunction(() => window.GymRest && window.GymDate);
    await page.route(/\/api\/v1\/me\/consents/, (route) => json(route, 200, { consents: [{ type: "coach_ai", textVersion: "coach_ai.v1", grantedAt: "2026-10-17T09:00:00Z" }] }));
    await page.click('#appNav button[data-tab="coach"]');
    await page.click(".coach-ib-toggle");
    const a = page.locator(".coach-ib-ask a.pol-link");
    await expect(a).toBeVisible();
    expect(await href(a)).toBe("/privacy#inbody");
    await expect(a).toHaveAttribute("target", "_blank");
    await expect(a).toHaveText(text);
    await context.close();
  }
});

test("chat note links to #ai-coach and the meal-photo notice to #meal-photos", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.click('#appNav button[data-tab="coach"]');
  await page.click("#coachFab");
  const note = page.locator("#coachChatNote a.pol-link");
  await expect(note).toBeVisible();
  expect(await href(note)).toBe("/privacy#ai-coach");
  await expect(note).toHaveAttribute("target", "_blank");
  const photo = page.locator("#coachPhotoNoticePrivacy");
  expect(await href(photo)).toBe("/privacy#meal-photos");
  await expect(photo).toHaveAttribute("target", "_blank");
  await expect(photo).toHaveText("Privacy");
  await context.close();
});

test("feedback sheet links to #feedback in a new tab", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.waitForFunction(() => document.getElementById("tbAvatar"));
  await page.click("#tbAvatar");
  await page.click("#tbMenuFeedback");
  const a = page.locator("#feedbackSheet a.pol-link");
  await expect(a).toBeVisible();
  expect(await href(a)).toBe("/privacy#feedback");
  await expect(a).toHaveAttribute("target", "_blank");
  await context.close();
});

test("More > Privacy & data: policy row, #export link and #withdraw links, same tab", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.click('#appNav button[data-tab="more"]');
  const pol = page.locator("#pvPolicy");
  await expect(pol).toBeVisible();
  expect(await href(pol)).toBe("/privacy");
  expect(await pol.getAttribute("target")).toBeNull();
  const links = page.locator("#morePrivacy a.pv-link");
  expect(await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(["/privacy#export", "/privacy#withdraw", "/privacy#withdraw"]);
  expect(await links.evaluateAll((as) => as.map((a) => a.getAttribute("target")))).toEqual([null, null, null]);
  // the delete sheet keeps its /delete-account details link
  await page.evaluate(() => document.getElementById("pvDelete").click());
  expect(await href(page.locator(".pv-retain a"))).toBe("/delete-account");
  await context.close();
});

test("More > Privacy & data wording: plans and check-ins stay until the account is deleted; export is a ZIP with feedback and consents", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.click('#appNav button[data-tab="more"]');
  await expect(page.locator("#morePrivacy [data-pk=dlDesc]")).toContainText("A ZIP file with your profile, workouts, meals, progress, notifications, feedback, consent records, coach data and profile photo.");
  const ca = await page.evaluate(() => { document.getElementById("pvCaRow").hidden = false; return document.querySelector("[data-pk=caDesc]").textContent; });
  expect(ca).toContain("Plans and check-ins you already have stay until you delete your account.");
  await context.close();
  const ar = await openApp(browser, { signedIn: true, lang: "ar" });
  await ar.page.click('#appNav button[data-tab="more"]');
  const t = await ar.page.evaluate(() => { document.getElementById("pvCaRow").hidden = false; return document.querySelector("[data-pk=caDesc]").textContent; });
  expect(t).toContain("وتبقى خططك ومتابعاتك الحالية إلى أن تحذف حسابك.");
  await ar.context.close();
});

test("landing footer links to /privacy, /terms and /delete-account; the landing no longer offers email sign-in", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    let file = path.join(LANDING, u.pathname === "/" ? "index.html" : u.pathname.slice(1));
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(REPO, u.pathname.slice(1));
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  const page = await context.newPage();
  await page.goto("/?home");
  await page.waitForFunction(() => !document.documentElement.classList.contains("pending"));
  const links = page.locator(".foot-links a");
  expect(await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(["/privacy", "/terms", "/delete-account"]);
  await expect(page.locator("[data-i18n=final_p]")).toHaveText("It's free. Sign in with Google, or look around without an account.");
  await context.close();
});

test("delete-account page: export is a ZIP, the coach holds plans and check-ins (no chat history), and it links to the policy", async ({ browser }) => {
  const html = fs.readFileSync(path.join(LANDING, "delete-account.html"), "utf8");
  expect(html).toContain("as a ZIP file");
  expect(html).toContain("ملف ZIP");
  expect(html).not.toMatch(/JSON/);
  expect(html).not.toMatch(/chat history|سجل المحادثات/);
  expect(html.match(/href="\/privacy#retention"/g).length).toBe(2);
});

// ---------------- sign-up agreement line (replaces the 18+ popup) ----------------

const AGREE = {
  en: { text: "By continuing, you agree to our Terms and Privacy Policy and confirm you're 18 or older.", terms: "Terms", privacy: "Privacy Policy" },
  ar: { text: "بالمتابعة، أنت توافق على شروط الاستخدام وسياسة الخصوصية وتؤكد أن عمرك 18 عامًا أو أكثر.", terms: "شروط الاستخدام", privacy: "سياسة الخصوصية" }
};

test("agreement line: shown under the sign-in buttons with Terms and Privacy links, no popup (EN and AR)", async ({ browser }) => {
  for (const lang of ["en", "ar"]) {
    const { context, page } = await openApp(browser, { termsOk: false, lang });
    expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir])).toEqual([lang, lang === "ar" ? "rtl" : "ltr"]);
    await expect(page.locator("#ageGate")).toHaveCount(0);
    await page.evaluate(() => GymUI.promptSignIn());
    const line = page.locator("#obLegal");
    await expect(line).toBeVisible();
    await expect(line).toHaveText(AGREE[lang].text);
    await expect(line.locator("a")).toHaveCount(2);
    expect(await href(line.locator("a").nth(0))).toBe("/terms");
    expect(await href(line.locator("a").nth(1))).toBe("/privacy");
    await expect(line.locator("a").nth(0)).toHaveText(AGREE[lang].terms);
    await expect(line.locator("a").nth(1)).toHaveText(AGREE[lang].privacy);
    // the app behind is not locked by a modal
    expect(await page.evaluate(() => document.getElementById("appNav").inert)).toBe(false);
    await context.close();
  }
});

test("agreement line: also shown on the email step, hidden on the start and resolving steps", async ({ browser }) => {
  const { context, page } = await openApp(browser, { termsOk: false });
  await page.evaluate(() => { GymUI.promptSignIn(); GymUI.showObStep("email"); });
  await expect(page.locator("#obLegal")).toBeVisible();
  await page.evaluate(() => GymUI.showObStep("start"));
  await expect(page.locator("#obLegal")).toBeHidden();
  await page.evaluate(() => GymUI.showObStep("resolving"));
  await expect(page.locator("#obLegal")).toBeHidden();
  await context.close();
});

test("agreement line: nothing is recorded until a sign-in choice is tapped; Continue without signing in records terms.v1", async ({ browser }) => {
  const { context, page } = await openApp(browser, { termsOk: false });
  await page.evaluate(() => GymUI.promptSignIn());
  expect(await page.evaluate(() => localStorage.getItem("gym_terms_ok"))).toBeNull();
  await page.click("#obContinueBtn");
  expect(await page.evaluate(() => localStorage.getItem("gym_terms_ok"))).toBe("terms.v1");
  await context.close();
});

test("agreement line: completing a Google sign-in from the sign-in screen records terms.v1", async ({ browser }) => {
  const { context, page } = await openApp(browser, { termsOk: false });
  await page.evaluate(() => GymUI.promptSignIn());
  expect(await page.evaluate(() => localStorage.getItem("gym_terms_ok"))).toBeNull();
  await page.evaluate(() => GymUI.completeSignIn());
  expect(await page.evaluate(() => localStorage.getItem("gym_terms_ok"))).toBe("terms.v1");
  await context.close();
});

test("agreement line: signing out keeps the agreement on the device and it is on the sync keep-list", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.evaluate(() => GymSync.signOut());
  expect(await page.evaluate(() => localStorage.getItem("gym_terms_ok"))).toBe("terms.v1");
  await context.close();
});

test("More tab: Privacy & data lists a Terms of Use link to /terms", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.click('#appNav button[data-tab="more"]');
  expect(await href(page.locator("#pvTerms"))).toBe("/terms");
  await context.close();
});

// ---------------- /terms page ----------------

test("/terms: loads in EN and AR with the Draft banner, cross-links to /privacy, no script errors", async ({ browser }) => {
  for (const lang of ["en", "ar"]) {
    const { context, page, errors } = await openPolicy(browser, { lang, route: "/terms" });
    expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir, document.title])).toEqual(
      lang === "ar" ? ["ar", "rtl", "شروط الاستخدام | اتقدم"] : ["en", "ltr", "Terms of Use | Etqadem"]);
    await expect(page.locator("h1:visible")).toHaveText(lang === "ar" ? "شروط الاستخدام" : "Terms of Use");
    await expect(page.locator("[data-draft]:visible")).toHaveCount(1);
    await expect(page.locator("[data-draft]:visible")).toContainText(lang === "ar" ? "مسودة" : "Draft");
    expect(await page.locator(".sec:visible").count()).toBe(18);
    expect(await page.locator('.foot-link[href="/privacy"]:visible').count()).toBe(1);
    expect(errors).toEqual([]);
    await context.close();
  }
});

const page_draft = (page) => page.locator("[data-draft]:visible");
const TERMS_FACTS = { ...FILLED, CONTACT_EMAIL: "help@example.com", GOVERNING_VENUE: "Cheyenne, Wyoming", LIABILITY_CAP: "USD 100", NOTICE_DAYS: 14, LANGUAGE_PREVAILS: { en: "English", ar: "الإنجليزي" } };

test("/terms: Draft banner follows the facts it shows; filling them all removes it, and /privacy is unaffected by the new keys", async ({ browser }) => {
  // privacy facts alone leave the terms-only keys empty: banner stays
  let r = await openPolicy(browser, { route: "/terms", facts: FILLED });
  await expect(page_draft(r.page)).toHaveCount(1);
  await r.context.close();
  // every terms fact filled: no banner, the values render, the mailbox is a link
  r = await openPolicy(browser, { route: "/terms", facts: TERMS_FACTS });
  await expect(page_draft(r.page)).toHaveCount(0);
  await expect(r.page.locator("#doc-en .is-todo")).toHaveCount(0);
  expect(await href(r.page.locator('#doc-en [data-fact="CONTACT_EMAIL"] a').first())).toBe("mailto:help@example.com");
  await expect(r.page.locator("#doc-en #liability")).toContainText("USD 100");
  await r.context.close();
  // /privacy with only its own facts filled: no banner (terms keys don't count)
  r = await openPolicy(browser, { facts: FILLED });
  await expect(page_draft(r.page)).toHaveCount(0);
  await r.context.close();
});

// ---------------- age minimum in the assessment ----------------

test("assessment form: age 17 is rejected (Must be 18 or older), 18 is accepted", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.click('#appNav button[data-tab="coach"]');
  const age = page.locator('#coachBody input[name="age"]');
  const field = page.locator('#coachBody [data-field="age"]');
  await expect(age).toBeVisible();
  expect(await age.getAttribute("min")).toBe("18");
  await age.fill("17");
  await expect(field).toHaveClass(/bad/);
  await expect(field.locator(".coach-fe")).toHaveText("Must be 18 or older");
  await age.fill("16");
  await expect(field.locator(".coach-fe")).toHaveText("Must be 18 or older");
  await age.fill("18");
  await expect(field).not.toHaveClass(/bad/);
  await expect(field.locator(".coach-fe")).toHaveText("");
  await context.close();
});

test("assessment form (AR): age 17 is rejected in Arabic", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true, lang: "ar" });
  await page.click('#appNav button[data-tab="coach"]');
  await page.locator('#coachBody input[name="age"]').fill("17");
  await expect(page.locator('#coachBody [data-field="age"] .coach-fe')).toHaveText("يجب أن يكون العمر 18 عاماً فأكثر");
  await context.close();
});

test("server 400 age_below_minimum (form bypassed) shows the 18+ message, EN and AR", async ({ browser }) => {
  for (const [lang, text] of [["en", "Etqadem is for people 18 and older, so the AI coach can't build a plan for this age."], ["ar", "اتقدم مخصّص لمن بلغوا 18 عامًا فأكثر، لذلك لا يستطيع المدرّب الذكي إعداد خطة لهذا العمر."]]) {
    const { context, page } = await openApp(browser, { signedIn: true, lang, ls: { gym_coach_form_draft: { age: "30", heightCm: "175", weightKg: "80" } } });
    await context.route(/\/api\/v1\/me\/consents/, (route) => json(route, 200, { consents: [{ type: "coach_ai", textVersion: "coach_ai.v1", grantedAt: "2026-10-17T09:00:00Z" }] }));
    await context.route(/\/api\/v1\/assistant\/assessment/, (route) => json(route, 400, { error: { code: "age_below_minimum", message: "age" } }));
    await page.click('#appNav button[data-tab="coach"]');
    await page.locator("#coachBody form button[type=submit]").first().click();
    await expect(page.locator("#coachBody .coach-state")).toContainText(text);
    await context.close();
  }
});
