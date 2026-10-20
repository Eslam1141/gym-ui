// Anatomy figures (muscle-art.js): API contract + provenance checks.
const { test, expect } = require("@playwright/test");

const REGIONS = ["chest_upper", "chest_mid", "chest_lower", "back_lats", "back_mid", "back_lower",
  "shoulder_front", "shoulder_side", "shoulder_rear", "biceps_long", "biceps_short", "triceps_long",
  "triceps_lateral", "quads", "hamstrings", "glutes", "calves", "core_upper", "core_lower", "core_obliques"];
// Group -> ids, in catalog order (the tags spec checks this against MUSCLE_SHAPES).
const GROUP_IDS = {
  Chest: ["chest_upper", "chest_mid", "chest_lower"], Back: ["back_lats", "back_mid", "back_lower"],
  Shoulders: ["shoulder_front", "shoulder_side", "shoulder_rear"], Biceps: ["biceps_long", "biceps_short"],
  Triceps: ["triceps_long", "triceps_lateral"], Quads: ["quads"], Hamstrings: ["hamstrings"], Glutes: ["glutes"],
  Calves: ["calves"], Core: ["core_upper", "core_lower", "core_obliques"]
};

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => window.GymMuscleArt);
});

// Parses the SVG string in the page and returns what the assertions need.
function inspect(page, svg) {
  return page.evaluate((s) => {
    const host = document.createElement("div");
    host.innerHTML = s;
    return {
      root: host.firstElementChild && host.firstElementChild.getAttribute("class"),
      hi: [...host.querySelectorAll(".ma-hi")].map((n) => n.getAttribute("data-region")),
      hi2: [...host.querySelectorAll(".ma-hi2")].map((n) => n.getAttribute("data-region")),
      svgs: host.querySelectorAll("svg").length
    };
  }, svg);
}

test("REGIONS are exactly the 20 catalog ids", async ({ page }) => {
  expect(await page.evaluate(() => window.GymMuscleArt.REGIONS.slice().sort())).toEqual(REGIONS.slice().sort());
});

test("every region drawable, on both sexes, with exactly one lit region", async ({ page }) => {
  for (const sex of ["male", "female"]) {
    for (const id of REGIONS) {
      const svg = await page.evaluate(([i, x]) => window.GymMuscleArt.closeup(i, { sex: x }), [id, sex]);
      const got = await inspect(page, svg);
      expect(got.svgs, id + " " + sex).toBe(1);
      expect(got.hi, id + " " + sex).toEqual([id]);
      expect(got.root).toContain("ma-svg");
      expect(got.root).toContain("ma-" + sex);
    }
  }
});

test("views", async ({ page }) => {
  const v = await page.evaluate(() => {
    const a = window.GymMuscleArt;
    return [a.viewOf("back_lats"), a.viewOf("chest_upper"), a.viewOf("calves"), a.viewOf("nope"), a.viewOf("triceps_long"),
      a.viewOf("shoulder_side"), a.viewOf("quads"), a.viewOf("glutes"), a.viewOf("core_obliques"), a.viewOf("shoulder_rear")];
  });
  expect(v).toEqual(["back", "front", "back", null, "back", "front", "front", "back", "front", "back"]);
});

test("secondary region is lighter, same view only", async ({ page }) => {
  const svg = await page.evaluate(() => window.GymMuscleArt.closeup("hamstrings", { sex: "male", secondary: "back_lower" }));
  const got = await inspect(page, svg);
  expect(got.hi).toEqual(["hamstrings"]);
  expect(got.hi2).toEqual(["back_lower"]);
  // quads (front) + glutes (back): the close-up keeps the primary's view only
  const cross = await inspect(page, await page.evaluate(() => window.GymMuscleArt.closeup("quads", { sex: "male", secondary: "glutes" })));
  expect(cross.hi).toEqual(["quads"]);
  expect(cross.hi2).toEqual([]);
});

test("unknown region draws nothing", async ({ page }) => {
  expect(await page.evaluate(() => window.GymMuscleArt.closeup("nope", { sex: "male" }))).toBe("");
  expect(await page.evaluate(() => window.GymMuscleArt.group("Nope", { sex: "male" }))).toBe("");
});

test("female figure differs and is tagged", async ({ page }) => {
  const [m, f] = await page.evaluate(() => [window.GymMuscleArt.closeup("glutes", { sex: "male" }), window.GymMuscleArt.closeup("glutes", { sex: "female" })]);
  const sil = (s) => (s.match(/<path class="ma-sil"[^>]*d="([^"]+)"/) || [])[1];
  expect(sil(m)).toBeTruthy();
  expect(sil(f)).toBeTruthy();
  expect(sil(f)).not.toBe(sil(m));
  expect((await inspect(page, f)).root).toContain("ma-female");
});

test("group lights every region of the group", async ({ page }) => {
  for (const g of Object.keys(GROUP_IDS)) {
    const svg = await page.evaluate(([n]) => window.GymMuscleArt.group(n, { sex: "male" }), [g]);
    const got = await inspect(page, svg);
    expect(got.hi.length, g).toBeGreaterThanOrEqual(1);
    const ids = GROUP_IDS[g];
    const view = await page.evaluate((i) => window.GymMuscleArt.viewOf(i), ids[0]);
    const inView = await page.evaluate(([l, v]) => l.filter((i) => window.GymMuscleArt.viewOf(i) === v), [ids, view]);
    expect(got.hi.slice().sort(), g).toEqual(inView.slice().sort());
  }
});

test("figure() draws a whole view and lights what it is told", async ({ page }) => {
  const svg = await page.evaluate(() => window.GymMuscleArt.figure("back", { sex: "female", lit: ["glutes", "calves"] }));
  const got = await inspect(page, svg);
  expect(got.hi.sort()).toEqual(["calves", "glutes"]);
});

test("no hard-coded colours; ids are unique per call", async ({ page }) => {
  const [a, b] = await page.evaluate(() => [window.GymMuscleArt.closeup("quads", { sex: "male" }), window.GymMuscleArt.closeup("quads", { sex: "male" })]);
  for (const s of [a, b]) {
    expect(s.replace(/url\(#[\w-]+\)/g, "")).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    for (const m of s.matchAll(/\b(?:fill|stroke|stop-color)="([^"]*)"/g)) {
      expect(m[1] === "none" || /^url\(#[\w-]+\)$/.test(m[1]) || m[1].startsWith("var("), m[1]).toBe(true);
    }
    expect(s).not.toMatch(/rgb\(|rgba\(|hsl\(/);
  }
  const ids = (s) => [...s.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  expect(ids(a).length).toBeGreaterThan(0);
  expect(ids(a).some((i) => ids(b).includes(i))).toBe(false);
  expect(new Set(ids(a)).size).toBe(ids(a).length);
});

test("carries the provenance header", async ({ request }) => {
  const src = await (await request.get("/muscle-art.js")).text();
  expect(src.slice(0, 400)).toContain("Original artwork, Etqadem, 2026. Not derived from third-party images.");
});
