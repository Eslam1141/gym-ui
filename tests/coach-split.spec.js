// The coach's /assess request carries the Plan tab's split (not Classic) for workout/both requests.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(60000);

const REC = { type: "coach_ai", textVersion: "coach_ai.v1", lang: "en", grantedAt: "2026-10-17T09:00:00Z" };
const RESULT = {
  id: "a1", want: "workout", model: "m", createdAt: "2026-10-02T07:00:00Z", summary: "ok",
  computed: { bmi: 24, bmiClass: "normal", bmrKcal: 1700, tdeeKcal: 2600, targetKcal: 2100, proteinG: 160, fatG: 65, carbG: 210 },
  workoutPlan: { split: "x", daysPerWeek: 3, days: [{ day: "A", exercises: [{ name: "Squat", sets: 3, reps: "8", restSec: 90 }] }] },
  disclaimers: []
};
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function run(browser, { split, want, lang = "en" }) {
  const draft = { age: "30", heightCm: "175", weightKg: "80", want };
  const ls = { gym_coach_form_draft: draft };
  if (split) ls.gym_split = split;
  const app = await openApp(browser, { signedIn: true, lang, ls });
  const sent = [];
  await app.context.route(/\/api\/v1\/me\/consents/, (route) => json(route, 200, { consents: [REC] }));
  await app.context.route(/\/api\/v1\/assistant\//, (route) => {
    const req = route.request();
    const name = new URL(req.url()).pathname.replace(/^.*\/assistant\//, "");
    if (name === "checkin/status") return json(route, 200, { submitted: false });
    if (req.method() === "POST" && name.startsWith("assessment")) { sent.push(JSON.parse(req.postData())); return json(route, 200, RESULT); }
    return route.fulfill({ status: 404, body: "{}" });
  });
  await app.page.evaluate(() => document.dispatchEvent(new CustomEvent("gym:authchange")));
  await app.page.click('#appNav button[data-tab="coach"]');
  await app.page.locator("#coachBody form button[type=submit]").first().click();
  await expect.poll(() => sent.length).toBe(1);
  // what the Plan tab shows, for comparison
  const plan = await app.page.evaluate(() => DAYS.map((d) => ({ name: d.label, moves: d.exercises.map((e) => ({ name: e.en, part: e.shape })) })));
  await app.context.close();
  return { body: sent[0], plan };
}

test("gym 4-day split is sent, matching the Plan tab", async ({ browser }) => {
  const { body, plan } = await run(browser, { split: { days: 4, where: "gym" }, want: "both" });
  expect(body.split.name).toBe("4 days · Gym");
  expect(body.split.days.length).toBe(4);
  expect(body.split.days).toEqual(plan);
  for (const d of body.split.days) { expect(d.moves.length).toBeGreaterThan(0); expect(d.moves.length).toBeLessThanOrEqual(10); }
});

test("home 3-day split with tools, and Arabic UI still sends English names", async ({ browser }) => {
  const { body, plan } = await run(browser, { split: { days: 3, where: "home", tools: ["dumbbell", "band"] }, want: "workout", lang: "ar" });
  expect(body.lang).toBe("ar");
  expect(body.split.name).toBe("3 days · Home");
  expect(body.split.days).toEqual(plan);
  expect(JSON.stringify(body.split)).not.toMatch(/[\u0600-\u06FF]/);
});

test("no split field for Classic, nor for a diet request", async ({ browser }) => {
  const classic = await run(browser, { want: "both" });
  expect("split" in classic.body).toBe(false);
  const diet = await run(browser, { split: { days: 4, where: "gym" }, want: "diet" });
  expect("split" in diet.body).toBe(false);
});
