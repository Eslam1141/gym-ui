const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const { openApp } = require("./helpers");

// First-run survey consent (lawyer review 2026-10-22): consent before any
// PUT, "Not now" sends nothing, 403 consent_required asks again, and Withdraw
// deletes the consent + the answers. gym-be's new endpoints aren't deployed
// yet, so they are mocked here.
test.setTimeout(60000);
const T = { timeout: 10000 };
const SHOTS = path.join(__dirname, "..", "docs", "screenshots", "2026-10-22-survey-consent");

const CONSENT = { type: "onboarding", textVersion: "onboarding.v1", withdrawnAt: null };

function backend(over) {
  const b = Object.assign({
    onboardingCompleted: false, consents: [], putQueue: [], postStatus: 201, deleteStatus: 204, log: []
  }, over || {});
  b.setup = async (context) => {
    await context.route("**/api/v1/**", async (route) => {
      const req = route.request();
      const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, "");
      const m = req.method();
      const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      const data = () => { try { return JSON.parse(req.postData() || "{}"); } catch (e) { return {}; } };
      if (p === "/me" && m === "GET") {
        return json(200, { id: "u1", email: "t@example.com", displayName: "Tester", currentStreak: 0, totalDaysTrained: 0,
          todayDone: false, todayRested: false, trainingDays: [], onboardingCompleted: b.onboardingCompleted });
      }
      if (!p.startsWith("/me/consents") && p !== "/me/onboarding") return route.fallback();
      b.log.push({ m, p, body: m === "PUT" || m === "POST" ? data() : null });
      if (p === "/me/consents" && m === "GET") return json(200, { consents: b.consents });
      if (p === "/me/consents" && m === "POST") {
        if (b.postStatus !== 201) return json(b.postStatus, { error: { code: "internal", message: "x" } });
        b.consents.push(Object.assign({}, CONSENT, { textVersion: data().textVersion }));
        return json(201, {});
      }
      if (p === "/me/onboarding" && m === "PUT") {
        const next = b.putQueue.length ? b.putQueue.shift() : 200;
        if (next === 403) return json(403, { error: { code: "consent_required", message: "x" } });
        b.onboardingCompleted = true;
        return json(200, { ok: true });
      }
      if (m === "DELETE") return route.fulfill({ status: b.deleteStatus, body: "" });
      return json(404, { error: { code: "not_found", message: "x" } });
    });
  };
  return b;
}
const writes = (b) => b.log.filter((r) => r.m !== "GET");
const idx = (b, m, p) => b.log.findIndex((r) => r.m === m && r.p === p);

async function open(browser, b, opts) {
  opts = opts || {};
  // the screen tours (tour.js) would sit on top of the Plan and More screens
  const ls = Object.assign({ gym_tours_seen: { plan: 2, coach: 2, food: 2, more: 2, watch: 1, watchOff: 1, bubble: 1 } }, opts.ls);
  return openApp(browser, Object.assign({ signedIn: true, setup: b.setup }, opts, { ls }));
}
async function answerAll(page, inbody) {
  const tap = (name) => page.locator("#survey .svy-opt", { hasText: name }).first().click();
  await tap("Lose fat");
  await tap("Male");
  await page.fill("#svyAge", "30"); await page.click("#survey .svy-next");
  await page.fill("#svyH", "178"); await page.fill("#svyW", "80"); await page.click("#survey .svy-next");
  await tap("Less than a year");
  await page.locator("#survey .svy-opt", { hasText: /^4$/ }).click();
  await tap("Gym");
  await tap("Some walking");
  await page.click("#survey .svy-next"); // diet: Balanced
  await expect(page.locator("#survey #svyQ")).toHaveText("Have InBody results?", T);
  if (inbody) { await page.fill("#svyIb_bodyFatPct", String(inbody)); await page.click("#survey .svy-next"); }
  else await page.getByRole("button", { name: "Skip" }).click();
}

test("consent comes first: nothing is sent until Agree, the PUT only after a successful POST", async ({ browser }) => {
  const b = backend();
  const { context, page } = await open(browser, b);
  await expect(page.locator("#survey #svyQ")).toHaveText("Before we start", T);
  expect(writes(b)).toEqual([]);
  await page.getByRole("button", { name: "Agree and continue" }).click();
  await expect(page.locator("#survey #svyQ")).toHaveText("What's your main goal?", T);
  const post = b.log.find((r) => r.m === "POST");
  expect(post.body).toEqual({ type: "onboarding", textVersion: "onboarding.v1", lang: "en" });
  expect(idx(b, "PUT", "/me/onboarding")).toBe(-1);
  await answerAll(page);
  await expect(page.locator("#survey .svy-check")).toBeVisible(T);
  expect(idx(b, "POST", "/me/consents")).toBeLessThan(idx(b, "PUT", "/me/onboarding"));
  const put = b.log.find((r) => r.m === "PUT").body;
  expect(put).not.toHaveProperty("allergies");
  expect(put).not.toHaveProperty("ramadan");
  expect(put.dietPreference).toBe("balanced");
  expect(put.age).toBe(30);
  await context.close();
});

test("InBody step: only after consent; numbers stay out of the PUT, reach the coach form, and Withdraw clears them", async ({ browser }) => {
  const b = backend();
  const { context, page } = await open(browser, b);
  await expect(page.locator("#survey #svyQ")).toHaveText("Before we start", T); // the InBody step is behind the same consent
  await page.getByRole("button", { name: "Agree and continue" }).click();
  await answerAll(page, 22);
  await expect(page.locator("#survey .svy-check")).toBeVisible(T);
  expect(idx(b, "POST", "/me/consents")).toBeLessThan(idx(b, "PUT", "/me/onboarding"));
  expect(JSON.stringify(b.log.find((r) => r.m === "PUT").body)).not.toMatch(/inbody|bodyFat/i);
  const form = await page.evaluate(() => JSON.parse(localStorage.getItem("gym_coach_form_draft")));
  expect(form.bodyFatPct).toBe("22");
  expect(form.inbodyOpen).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gym_survey_filled")).bodyFatPct)).toBe("22");
  await page.evaluate(() => GymSurvey.afterWithdraw());
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("gym_coach_form_draft")));
  expect(after.bodyFatPct).toBe("");
  expect(after.inbodyOpen).toBe(false);
  await context.close();
});

test("the survey has no allergies field, no Ramadan question and no Halal chip", async ({ browser }) => {
  const b = backend({ consents: [CONSENT] });
  const { context, page } = await open(browser, b);
  await expect(page.locator("#survey #svyQ")).toHaveText("What's your main goal?", T);
  await page.evaluate(() => localStorage.setItem("gym_survey_draft", JSON.stringify({ step: 8, a: { dietPreference: "halal" } })));
  await page.reload();
  await expect(page.locator("#survey #svyQ")).toHaveText("How do you like to eat?", T);
  await expect(page.locator("#survey #svyAll")).toHaveCount(0);
  await expect(page.locator("#survey .svy-chip")).toHaveCount(7);
  await expect(page.locator("#survey")).not.toContainText(/halal|allerg|ramadan/i);
  await context.close();
});

test("a failed consent POST shows the error, stays put and sends no PUT", async ({ browser }) => {
  const b = backend({ postStatus: 500 });
  const { context, page } = await open(browser, b);
  await page.getByRole("button", { name: "Agree and continue" }).click();
  await expect(page.locator("#survey .svy-err")).toHaveText("Couldn't save your choice. Check your connection and try again.", T);
  await expect(page.locator("#survey #svyQ")).toHaveText("Before we start");
  expect(idx(b, "PUT", "/me/onboarding")).toBe(-1);
  b.postStatus = 201;
  await page.getByRole("button", { name: "Agree and continue" }).click();
  await expect(page.locator("#survey #svyQ")).toHaveText("What's your main goal?", T);
  await context.close();
});

test("an account that already has the consent skips step 0", async ({ browser }) => {
  const b = backend({ consents: [CONSENT] });
  const { context, page } = await open(browser, b);
  await expect(page.locator("#survey #svyQ")).toHaveText("What's your main goal?", T);
  expect(writes(b)).toEqual([]);
  await context.close();
});

test("Not now sends nothing, never auto-opens again, and leaves a Plan card that reopens it", async ({ browser }) => {
  const b = backend();
  const { context, page } = await open(browser, b);
  await expect(page.locator("#survey #svyQ")).toHaveText("Before we start", T);
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.locator("#survey")).toBeHidden(T);
  expect(writes(b)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("gym_plan"))).toBe("male"); // default starter plan untouched
  const card = page.locator("#setupCard");
  await expect(card).toBeVisible(T);
  await expect(card).toContainText("Set up your plan");
  // a new session (reload, then a fresh load of the app) does not reopen it
  await page.reload();
  await expect(card).toBeVisible(T);
  await page.waitForTimeout(800);
  await expect(page.locator("#survey")).toBeHidden();
  expect(await page.evaluate(() => sessionStorage.getItem("etq_survey_later"))).toBeNull();
  // the card reopens it, still asking for consent first
  await card.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#survey #svyQ")).toHaveText("Before we start", T);
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(card).toBeVisible();
  // closing the card sticks
  await card.getByRole("button", { name: "Close" }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(800);
  await expect(page.locator("#setupCard")).toHaveCount(0);
  expect(writes(b)).toEqual([]);
  await context.close();
});

test("a 403 consent_required from the PUT shows the consent step again, then saves", async ({ browser }) => {
  const b = backend({ consents: [CONSENT], putQueue: [403] });
  const { context, page } = await open(browser, b);
  await expect(page.locator("#survey #svyQ")).toHaveText("What's your main goal?", T);
  await answerAll(page);
  await expect(page.locator("#survey #svyQ")).toHaveText("Before we start", T);
  expect(b.log.filter((r) => r.m === "PUT")).toHaveLength(1);
  b.consents = [];
  await page.getByRole("button", { name: "Agree and continue" }).click();
  await expect(page.locator("#survey .svy-check")).toBeVisible(T);
  const order = b.log.filter((r) => r.m !== "GET").map((r) => r.m);
  expect(order).toEqual(["PUT", "POST", "PUT"]);
  await context.close();
});

async function openPrivacy(page) {
  await page.evaluate(() => GymUI.navigate("more"));
  await page.locator("#morePrivacy").scrollIntoViewIfNeeded();
}

test("More > Privacy: the First-run row shows only with a consent or answers", async ({ browser }) => {
  const none = await open(browser, backend({ onboardingCompleted: false }), { ls: { gym_survey_dismissed: 1 } });
  await openPrivacy(none.page);
  await expect(none.page.locator("#pvDownload")).toBeVisible(T);
  await expect(none.page.locator("#pvFrRow")).toBeHidden();
  await none.context.close();
  const withConsent = await open(browser, backend({ onboardingCompleted: false, consents: [CONSENT] }), { ls: { gym_survey_dismissed: 1 } });
  await openPrivacy(withConsent.page);
  await expect(withConsent.page.locator("#pvFrRow")).toBeVisible(T);
  await withConsent.context.close();
  const withAnswers = await open(browser, backend({ onboardingCompleted: true }));
  await openPrivacy(withAnswers.page);
  await expect(withAnswers.page.locator("#pvFrRow")).toBeVisible(T);
  await withAnswers.context.close();
});

test("Withdraw: confirm, both DELETEs, clears only what the survey filled into the coach form", async ({ browser }) => {
  const b = backend({ onboardingCompleted: true, consents: [CONSENT] });
  const form = { want: "both", age: "30", sex: "male", heightCm: "178", weightKg: "75", goal: "lose_fat",
    goalChecks: { lose_fat: true, gain_muscle: false, maintain: false }, activityLevel: "light", trainingDaysPerWeek: "4",
    equipment: "full_gym", dietPreference: "balanced", allergies: ["nuts"], dislikes: [], notes: "my note", experience: "under_1y" };
  const filled = { age: "30", heightCm: "178", weightKg: "80", activityLevel: "light", experience: "under_1y" }; // weight was edited to 75 since
  const { context, page } = await open(browser, b, { ls: { gym_coach_form_draft: form, gym_survey_filled: filled } });
  await openPrivacy(page);
  await expect(page.locator("#pvFrRow")).toBeVisible(T);
  await page.locator("#pvFrBtn").click();
  await expect(page.locator("#pvFrShTitle")).toBeVisible(T);
  expect(writes(b)).toEqual([]); // the confirm sheet alone deletes nothing
  await page.locator("#pvFrCancel").click();
  await expect(page.locator("#pvFrShTitle")).toBeHidden(T);
  expect(writes(b)).toEqual([]);
  await page.locator("#pvFrBtn").click();
  await page.locator("#pvFrGo").click();
  await expect(page.locator("#pvFrStatus")).toContainText("Withdrawn", T);
  const dels = b.log.filter((r) => r.m === "DELETE").map((r) => r.p).sort();
  expect(dels).toEqual(["/me/consents/onboarding", "/me/onboarding"]);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("gym_coach_form_draft")));
  expect(after.age).toBe("");            // survey-filled, untouched since: cleared
  expect(after.heightCm).toBe("");
  expect(after.weightKg).toBe("75");     // the user edited it: kept
  expect(after.notes).toBe("my note");   // never the survey's: kept
  expect(after.allergies).toEqual(["nuts"]);
  expect(await page.evaluate(() => localStorage.getItem("gym_survey_filled"))).toBeNull();
  // the starter plan stays, and the survey stays quiet
  expect(await page.evaluate(() => localStorage.getItem("gym_plan"))).toBe("male");
  await expect(page.locator("#survey")).toBeHidden();
  // gym-be now reports onboardingCompleted:false: that must not bring the survey back (same flag as "Not now")
  expect(await page.evaluate(() => localStorage.getItem("gym_survey_dismissed"))).toBe("1");
  b.onboardingCompleted = false;
  await page.reload();
  await page.waitForTimeout(1000);
  await expect(page.locator("#survey")).toBeHidden();
  expect(b.log.filter((r) => r.m === "POST" || r.m === "PUT")).toEqual([]);
  await context.close();
});

test("Withdraw failing keeps the row and says so", async ({ browser }) => {
  const b = backend({ onboardingCompleted: true, consents: [CONSENT], deleteStatus: 500 });
  const { context, page } = await open(browser, b);
  await openPrivacy(page);
  await page.locator("#pvFrBtn").click();
  await page.locator("#pvFrGo").click();
  await expect(page.locator("#pvFrStatus")).toContainText("Couldn't withdraw", T);
  await expect(page.locator("#pvFrBtn")).toBeEnabled();
  await context.close();
});

// ---- AR / RTL at 360px, both themes ----
const AR = {
  title: "قبل أن نبدأ",
  l1: "أسئلة سريعة عن هدفك وجسمك وتمرينك. بعض الإجابات، مثل وزنك، معلومات صحية.",
  l2: "نحفظها في حسابك (على خوادمنا خارج بلدك) لنختار خطتك المبدئية ونملأ نموذج المدرّب. ولا يُرسَل شيء إلى المدرّب الذكي إلا بعد أن تشغّله.",
  l3: "لا تريد الآن؟ يمكنك استخدام التطبيق كالمعتاد. وتستطيع سحب موافقتك في أي وقت من المزيد ← الخصوصية والبيانات.",
  statement: "أوافق على أن يحفظ اتقدم هذه الإجابات، بما فيها المعلومات الصحية، لهذه الأغراض.",
  link: "كيف نستخدم إجاباتك", agree: "أوافق وأتابع", later: "ليس الآن"
};
const EN = {
  title: "Before we start",
  l1: "A few quick questions about your goal, body and training. Some answers, like your weight, are health information.",
  l2: "We save them to your account (on our servers outside your country) to pick your starter plan and fill in your coach form. Nothing goes to the AI coach until you turn it on.",
  l3: "Not now? You can still use the app. You can withdraw any time in More → Privacy & data.",
  statement: "I agree that Etqadem saves these answers, including health information, for these purposes.",
  link: "How we use your answers", agree: "Agree and continue", later: "Not now"
};

for (const [lang, theme] of [["en", "light"], ["en", "dark"], ["ar", "light"], ["ar", "dark"]]) {
  test(`consent screen at 360px: ${lang} ${theme} (${lang === "ar" ? "rtl" : "ltr"})`, async ({ browser }) => {
    const b = backend();
    const { context, page, consoleErrors } = await open(browser, b, { lang, theme, viewport: { width: 360, height: 740 } });
    await expect(page.locator("#survey #svyQ")).toBeVisible(T);
    await page.waitForTimeout(700); // entrance animation
    const t = lang === "ar" ? AR : EN;
    const env = await page.evaluate(() => ({
      lang: document.documentElement.lang, dir: document.documentElement.dir || getComputedStyle(document.documentElement).direction,
      theme: document.documentElement.getAttribute("data-theme") || localStorage.getItem("gym_theme"), w: innerWidth
    }));
    expect(env).toMatchObject({ lang, dir: lang === "ar" ? "rtl" : "ltr", theme, w: 360 });
    await expect(page.locator("#svyQ")).toHaveText(t.title);
    const texts = await page.locator("#survey .svy-body p:not(.svy-err), #survey .svy-clink").allInnerTexts();
    expect(texts).toEqual([t.l1, t.l2, t.l3, t.statement, t.link]);
    await expect(page.locator("#survey .svy-next")).toHaveText(t.agree);
    await expect(page.locator("#survey .svy-ghost")).toHaveText(t.later);
    const href = await page.locator("#survey .svy-clink").getAttribute("href");
    expect(href).toBe(lang === "ar" ? "/privacy#ar-first-run" : "/privacy#first-run");
    // no horizontal scroll, everything inside the viewport, tap targets >= 44px
    const geo = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const card = document.querySelector("#survey .svy-card");
      return {
        scrollW: document.documentElement.scrollWidth, cardScrollW: card.scrollWidth,
        agree: r("#survey .svy-next"), later: r("#survey .svy-ghost"), link: r("#survey .svy-clink"), state: r("#survey .svy-cstate")
      };
    });
    expect(geo.scrollW).toBeLessThanOrEqual(360);
    expect(geo.cardScrollW).toBeLessThanOrEqual(360);
    for (const k of ["agree", "later", "link"]) {
      expect(geo[k].height, k).toBeGreaterThanOrEqual(44);
      expect(geo[k].left, k).toBeGreaterThanOrEqual(0);
      expect(geo[k].right, k).toBeLessThanOrEqual(360);
    }
    // the statement sits directly above the primary button
    expect(geo.state.bottom).toBeLessThanOrEqual(geo.agree.top);
    expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]); // the shared mock 404s unrelated endpoints
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `consent-${lang}-${theme}-360.png`) });
    await context.close();
  });
}
