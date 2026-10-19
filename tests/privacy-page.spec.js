// The public /privacy page (landing/privacy.html), the in-app links to it, the
// 18+ confirmation and the assessment's age minimum. The route table serves
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

async function openPolicy(browser, { lang = "en", hash = "", width = 1280, facts } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block", locale: lang === "ar" ? "ar-EG" : "en-US" });
  await context.addInitScript((l) => { try { if (l) localStorage.setItem("gym_lang", l); } catch (e) {} }, lang);
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== "127.0.0.1") return route.fulfill({ status: 404, body: "" });
    if (facts && u.pathname === "/privacy-facts.js") {
      return route.fulfill({ status: 200, contentType: "text/javascript", body: "window.PRIVACY_FACTS = " + JSON.stringify(facts) + ";" });
    }
    const p = u.pathname === "/privacy" ? "privacy.html" : u.pathname.slice(1);
    let file = path.join(LANDING, p);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(REPO, p);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/privacy" + hash);
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
  expect(empty.sort()).toEqual(["BACKUP_DAYS", "DPO", "EFFECTIVE_DATE", "HOSTING_COUNTRY", "LEGAL_ENTITY_NAME", "LOG_DAYS", "PRIVACY_EMAIL", "REGISTERED_ADDRESS", "STATE"]);
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

test("sign-in screen: the 'By continuing' line links to /privacy (EN and AR)", async ({ browser }) => {
  for (const [lang, text] of [["en", "By continuing, you confirm you have read our Privacy Policy."], ["ar", "بالمتابعة، فإنك تؤكد أنك قرأت سياسة الخصوصية."]]) {
    const { context, page } = await openApp(browser, { lang });
    await page.evaluate(() => GymUI.promptSignIn());
    const line = page.locator("#obStepChoices .ob-legal");
    await expect(line).toBeVisible();
    await expect(line).toHaveText(text);
    expect(await href(line.locator("a"))).toBe("/privacy");
    await context.close();
  }
});

test("landing footer links to /privacy and /delete-account; the landing no longer offers email sign-in", async ({ browser }) => {
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
  expect(await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(["/privacy", "/delete-account"]);
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

// ---------------- 18+ gate (C3) ----------------

test("18+ gate: shows on first launch, Exit does not proceed, confirming stores gym_age_ok and it never shows again", async ({ browser }) => {
  const { context, page } = await openApp(browser, { ageOk: false });
  const gate = page.locator("#ageGate");
  await expect(gate).toBeVisible();
  await expect(page.locator("#ageTitle")).toHaveText("Etqadem is for people 18 and older");
  await expect(page.locator("#ageYes")).toHaveText("I'm 18 or older");
  await expect(page.locator("#ageExit")).toHaveText("Exit");
  expect(await gate.getAttribute("role")).toBe("alertdialog");
  expect(await gate.getAttribute("aria-modal")).toBe("true");
  expect(await page.evaluate(() => document.activeElement.id)).toBe("ageTitle");
  // everything behind it is unreachable
  expect(await page.evaluate(() => document.getElementById("appNav").inert)).toBe(true);
  // Exit (web): says why, keeps the gate, stores nothing
  await page.click("#ageExit");
  await expect(page.locator("#ageBlocked")).toBeVisible();
  await expect(gate).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("gym_age_ok"))).toBeNull();
  // Confirm
  await page.click("#ageYes");
  await expect(gate).toBeHidden();
  expect(await page.evaluate(() => [localStorage.getItem("gym_age_ok"), document.getElementById("appNav").inert])).toEqual(["1", false]);
  // once only: a reload and a fresh boot don't ask again
  await page.reload();
  await page.waitForFunction(() => window.GymUI);
  await expect(page.locator("#ageGate")).toBeHidden();
  await context.close();
});

test("18+ gate: not shown when gym_age_ok is already set", async ({ browser }) => {
  const { context, page } = await openApp(browser, {});
  await expect(page.locator("#ageGate")).toBeHidden();
  await context.close();
});

test("18+ gate: Exit in the Android app closes the app", async ({ browser }) => {
  const { context, page } = await openApp(browser, { ageOk: false });
  await page.evaluate(() => {
    window.__exited = 0;
    window.Capacitor = { isNativePlatform: () => true, Plugins: { App: { exitApp: () => { window.__exited++; } } } };
  });
  await page.click("#ageExit");
  expect(await page.evaluate(() => window.__exited)).toBe(1);
  await expect(page.locator("#ageGate")).toBeVisible();
  await context.close();
});

test("18+ gate: Arabic, RTL, and it covers the sign-in screen for a first-time visitor", async ({ browser }) => {
  const { context, page } = await openApp(browser, { ageOk: false, lang: "ar" });
  expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir])).toEqual(["ar", "rtl"]);
  await expect(page.locator("#ageTitle")).toHaveText("اتقدم مخصّص لمن بلغوا 18 عامًا فأكثر");
  await expect(page.locator("#ageYes")).toHaveText("عمري 18 عامًا أو أكثر");
  await expect(page.locator("#ageExit")).toHaveText("خروج");
  await page.evaluate(() => GymUI.promptSignIn());
  expect(await page.evaluate(() => document.getElementById("onboarding").inert || !!document.getElementById("onboarding").closest("[inert]"))).toBe(true);
  await context.close();
});

test("18+ gate: signing out keeps the confirmation on the device", async ({ browser }) => {
  const { context, page } = await openApp(browser, { signedIn: true });
  await page.evaluate(() => GymSync.signOut());
  expect(await page.evaluate(() => localStorage.getItem("gym_age_ok"))).toBe("1");
  await context.close();
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
