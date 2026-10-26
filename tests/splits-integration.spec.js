// The split choice (#156) and the weekly body map (#149) working together, end to end.
// Fake clock: Fri 2026-10-02 10:00 Cairo; weeks run Saturday-Friday, so this week is 2026-09-26 .. 2026-10-02.
// The map-dependent tests skip while either piece is missing: they run once #149 and #156 are together.
const { test, expect } = require("@playwright/test");
const { openApp, tickSets } = require("./helpers");

test.setTimeout(60000);
const YESTERDAY_AT = "2026-10-01T07:00:00Z";
const TODAY_AT = "2026-10-02T07:00:00Z";

const goTab = (page, tab) => page.evaluate((t) => GymUI.navigate(t, { instant: true }), tab);
const cov = (page) => page.evaluate(() => window.GymMuscleMap.coverage(window.GymDate.weekKey()));
const level = async (page, id) => {   // the card is a closed <details> until opened; its figures draw on open
  const card = page.locator("#weekMap");
  if (!(await card.evaluate((el) => el.querySelector("details").open))) await card.locator("summary").click();
  return card.locator('[data-region="' + id + '"]').first().getAttribute("aria-label");
};

async function open(browser, opts) {
  const o = await openApp(browser, Object.assign({ signedIn: true }, opts || {}));
  const ready = await o.page.evaluate(() => !!(window.GymMuscleMap && window.GymSplits && document.getElementById("weekMap") && document.getElementById("splitPanel")));
  return Object.assign({ ready }, o);
}
async function chooseHome4(page) {
  await goTab(page, "more");
  await page.locator('#splitPanel [data-sp-days="4"]').click();
  await page.locator('#splitPanel [data-sp-where="home"]').click();
  await page.locator('#splitPanel [data-sp-tool="dumbbell"]').click();
  await goTab(page, "plan");
}
// Tick every set of day tab `i` through the normal UI (setExDone runs per exercise).
async function tickDay(page, i) {
  await page.locator("#dayTabs .day-chip").nth(i).click();
  const cards = page.locator("#exList .ex-card");
  await expect(cards.first()).toBeVisible({ timeout: 8000 });
  const n = await cards.count();
  for (let c = 0; c < n; c++) {
    const sets = cards.nth(c).locator(".set-chk");
    for (let s = 0; s < (await sets.count()); s++) { await page.clock.fastForward(61000); await sets.nth(s).click(); }
    await expect(cards.nth(c)).toHaveClass(/done/);
  }
  return page.evaluate(() => window.GymApp && DAYS.find((d) => d.id === activeDay).id);
}
// Regions a day trains, from the same tags the app uses.
const regionsOf = (page, dayId) => page.evaluate((id) => {
  const out = new Set();
  DAYS.find((d) => d.id === id).exercises.forEach((ex) => {
    const sh = GymApp.exerciseShapes(id, ex.id);
    if (sh) [sh.shape, sh.shape2].forEach((r) => r && out.add(r));
  });
  return [...out];
}, dayId);

test("4-day Home + dumbbells: a ticked split day lights its regions half, a second day on the same regions lights them full", async ({ browser }) => {
  const { context, page, ready } = await open(browser);
  test.skip(!ready, "needs the body map (#149) and the split choice (#156) together");
  await chooseHome4(page);
  await expect(page.locator("#dayTabs .day-chip")).toHaveText(["Upper A", "Lower A", "Upper B", "Lower B"]);
  await expect(page.locator("#weekMap")).toBeVisible();
  expect(Object.values(await cov(page)).every((v) => v === 0)).toBe(true);

  // Upper A yesterday, Upper B today: two different calendar days
  await page.clock.setSystemTime(new Date(YESTERDAY_AT));
  await page.reload();
  await page.waitForFunction(() => window.GymMuscleMap && window.GymApp.allDaySets);
  const a = await tickDay(page, 0);
  expect(a).toMatch(/^sp4hm_upperA$/);
  const aRegions = await regionsOf(page, a);
  expect(aRegions.length).toBeGreaterThan(2);
  let c = await cov(page);
  aRegions.forEach((r) => expect(c[r], r).toBe(1));
  Object.keys(c).filter((r) => !aRegions.includes(r)).forEach((r) => expect(c[r], r).toBe(0));
  expect(await level(page, aRegions[0])).toContain("trained once");

  await page.clock.setSystemTime(new Date(TODAY_AT));
  await page.reload();
  await page.waitForFunction(() => window.GymMuscleMap && window.GymApp.allDaySets);
  const b = await tickDay(page, 2);
  expect(b).toBe("sp4hm_upperB");
  const bRegions = await regionsOf(page, b);
  const both = aRegions.filter((r) => bRegions.includes(r));
  expect(both.length).toBeGreaterThan(0);
  c = await cov(page);
  both.forEach((r) => expect(c[r], r).toBe(2));
  aRegions.filter((r) => !bRegions.includes(r)).forEach((r) => expect(c[r], r).toBe(1));
  expect(await level(page, both[0])).toContain("trained twice");
  await context.close();
});

test("a Classic user sees the map working as before", async ({ browser }) => {
  const { context, page, ready } = await open(browser);
  test.skip(!ready, "needs the body map (#149) and the split choice (#156) together");
  expect(await page.evaluate(() => localStorage.getItem("gym_split"))).toBeNull();
  await expect(page.locator("#weekMap")).toBeVisible();
  await tickSets(page, "mua_bench");
  expect((await cov(page)).chest_mid).toBe(1);
  expect(await level(page, "chest_mid")).toContain("trained once");
  await context.close();
});

test("switching split mid-week keeps the map's counts", async ({ browser }) => {
  const { context, page, ready } = await open(browser);
  test.skip(!ready, "needs the body map (#149) and the split choice (#156) together");
  await tickSets(page, "mua_bench");   // Classic Upper, today
  const before = await cov(page);
  expect(before.chest_mid).toBe(1);
  await chooseHome4(page);                                      // Classic -> 4-day Home split
  expect(await cov(page)).toEqual(before);
  await page.locator('#splitPanel').evaluate(() => {});          // panel still mounted
  await goTab(page, "more");
  await page.locator('#splitPanel [data-sp-days="0"]').click(); // and back to Classic
  await goTab(page, "plan");
  expect(await cov(page)).toEqual(before);
  await expect.poll(() => level(page, "chest_mid")).toContain("trained once");
  await context.close();
});
