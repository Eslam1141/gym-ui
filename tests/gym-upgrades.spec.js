// The 9 optional gym moves (2026-10-23): library + builder only. They never enter a built plan,
// so every split (gym and home) stays as it was. Clips: docs/approved-clips-2026-10-23-gym.md.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { openApp } = require("./helpers");
const { openBuilder, rowByName, T } = require("./builder-helpers");

const root = path.join(__dirname, "..");
const S = require(path.join(root, "splits.js"));
const appSrc = fs.readFileSync(path.join(root, "app.js"), "utf8");

// id -> [EN name, AR name, clip, tools, shape, shape2]
const GU = {
  gu_dips: ["Chest Dips", "ديبس للصدر (جهاز)", "g3o0dC_qCns", ["machine"], "chest_lower", "triceps_lateral"],
  gu_hipabd: ["Hip Abduction Machine", "جهاز تبعيد الفخذ", "G_8LItOiZ0Q", ["machine"], "glutes", null],
  gu_hipthrust: ["Barbell Hip Thrust", "دفع الحوض بالبار", "5S8SApGU_Lk", ["barbell", "bench"], "glutes", null],
  gu_shrug: ["Barbell Shrug", "رفع الأكتاف بالبار (ترابيس)", "9xGqgGFAtiM", ["barbell"], "back_lower", null],
  gu_preacher: ["Preacher Curl", "مرجحة بايسبس على جهاز بريتشر", "g7hiWfUH6i8", ["machine"], "biceps_short", null],
  gu_revpec: ["Reverse Pec Deck (Rear Delt Fly)", "تفتيح خلفي عكسي (باي دلت)", "v0rJuhEa59c", ["machine"], "shoulder_rear", null],
  gu_cablelat: ["Cable Lateral Raise", "رفرفة جانبي بالكابل", "Z5FA9aq3L6A", ["cable"], "shoulder_side", null],
  gu_cablecrunch: ["Weighted Cable Crunch (core)", "كرنش بالكابل بوزن (بطن)", "ToJeyhydUxU", ["cable"], "core_upper", null],
  gu_widepull: ["Wide-grip Lat Pulldown", "سحب أمامي قبضة واسعة", "O-_EOo6IY3U", ["cable"], "back_lats", null]
};
const HOME = ["none", "dumbbell", "band", "bench", "table", "pullup_bar", "kettlebell", "jump_rope"];

test("9 gym moves: in app.js and splits.js with the approved clip, gym-only tools and shape tags", () => {
  expect(Object.keys(GU)).toHaveLength(9);
  Object.entries(GU).forEach(([id, [en, , vid, tools, shape, shape2]]) => {
    const m = S.library[id];
    expect({ en: m.en, vid: m.vid, tools: m.tools, shape: m.shape, shape2: m.shape2 || null }, id).toEqual({ en, vid, tools, shape, shape2 });
    expect(appSrc.split(`{id:"${id}"`).length - 1, id).toBe(1);
    const line = appSrc.split("\n").find((l) => l.includes(`{id:"${id}"`));
    expect(line, id).toContain(`vid:"${vid}"`);
    expect(line, id).toContain(`en:"${en}"`);
    expect(tools.some((t) => ["barbell", "cable", "machine"].includes(t)), id).toBe(true);
  });
});

test("no split, gym or home, schedules any of them (plans are unchanged)", () => {
  for (const days of S.DAYS) for (const sex of ["male", "female"]) for (const where of ["gym", "home"]) {
    const plan = S.buildPlan({ days, where, sex, tools: where === "home" ? HOME : [] });
    const ids = plan.days.flatMap((d) => d.exercises.map((e) => e.id));
    Object.keys(GU).forEach((id) => expect(ids, `${days}d ${sex} ${where}`).not.toContain(id));
    Object.values(S.parts).forEach((p) => Object.keys(GU).forEach((id) => {
      expect([...p.r, ...(p.f || []), ...(p.x || [])]).not.toContain(id);
    }));
  }
});

test("none of them fits a home kit", () => {
  Object.keys(GU).forEach((id) => expect(S.library[id].tools.every((t) => HOME.includes(t)), id).toBe(false));
});

test("the builder offers all 9 with their EN names, a video and the right muscle tags (EN)", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, {});
  for (const [id, [en, ar, vid, , shape, shape2]] of Object.entries(GU)) {
    await expect(rowByName(page, en), id).toHaveCount(1, T);
    const r = await page.evaluate(([n, a]) => ({ v: GymExerciseVideo(n), va: GymExerciseVideo(a), s: GymExerciseShape(n), sa: GymExerciseShape(a) }), [en, ar]);
    expect(r.v, id).toBe(vid);
    expect(r.va, id + " AR").toBe(vid);
    expect(r.s.shape, id).toBe(shape);
    expect(r.s.shape2 || null, id).toBe(shape2);
    expect(r.sa.shape, id + " AR").toBe(shape);
  }
  await context.close();
});

test("the builder shows the Arabic names (AR)", async ({ browser }) => {
  const { context, page } = await openBuilder(browser, { lang: "ar" });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  for (const [id, [en, ar]] of Object.entries(GU)) {
    await expect(rowByName(page, en).locator(".wb-ex-name"), id).toContainText(ar, T);
  }
  await context.close();
});

test("a move swapped into a custom day lights its region on the weekly body map", async ({ browser }) => {
  const day = { id: "cust_gu", label: "Custom", exercises: [{ id: "gu_cablelat", en: "Cable Lateral Raise", sets: 3, reps: "12-15", rest: 30, shape: "shoulder_side" }, { id: "gu_dips", en: "Chest Dips", sets: 3, reps: "8-12", rest: 90, shape: "chest_lower", shape2: "triceps_lateral" }] };
  const { context, page } = await openApp(browser, { ls: { gym_plans_custom: [day] }, checks: { "2026-10-01_cust_gu": { gu_cablelat: true, gu_dips: true } } });
  await page.waitForFunction(() => window.GymMuscleMap && window.GymApp && window.GymApp.allDaySets);
  const c = await page.evaluate(() => window.GymMuscleMap.coverage(window.GymDate.weekKey()));
  expect(c.shoulder_side).toBe(1);
  expect(c.chest_lower).toBe(1);
  expect(c.triceps_lateral).toBe(1);
  expect(c.quads).toBe(0);
  // by library id alone (no tags saved on the plan): the library copy resolves it
  const t = await page.evaluate(() => window.GymApp.exerciseShapes("cust_gu", "gu_dips"));
  expect(t.shape).toBe("chest_lower");
  await context.close();
});
