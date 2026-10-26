const { test, expect } = require("@playwright/test");
const { openApp, tickSets, TODAY, DAY_ID } = require("./helpers");

test.setTimeout(60000);
const T = { timeout: 8000 };
const swapBtn = (page, id) => page.locator(`[data-swap="${id}"]`);
const sheet = (page) => page.locator("#swapSheet");
const card = (page, id) => page.locator(`.check[data-id="${id}"]`).locator("xpath=ancestor::div[contains(@class,'ex-card')]");

test.describe("Machine busy? swap", () => {
  test("machine busy lists same-muscle alternatives for gym plan", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await expect(swapBtn(page, "mua_bench")).toBeVisible(T);
    await expect(swapBtn(page, "mua_bench")).toHaveText(/Machine busy\?/);
    await swapBtn(page, "mua_bench").click();
    await expect(sheet(page)).toBeVisible(T);
    await expect(page.locator("#swapTitle")).toHaveText("Swap Barbell Bench Press for");
    const n = await sheet(page).locator(".swap-opt").count();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(5);
    const bad = await page.evaluate(() => {
      const lib = GymSplits.library, inDay = DAYS[0].exercises.map((e) => e.id);
      return [...document.querySelectorAll("#swapSheet .swap-opt")].map((b) => b.dataset.swapTo)
        .filter((id) => lib[id].shape !== "chest_mid" || inDay.includes(id));
    });
    expect(bad).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0, T);
    await context.close();
  });

  test("home plan alternatives respect toolset", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, ls: { gym_split: { days: 4, where: "home", tools: ["dumbbell"] } } });
    const res = await page.evaluate(() => {
      const bad = [];
      let total = 0;
      DAYS.forEach((d) => d.exercises.forEach((ex) => GymSwap.alternatives(ex, d.id).forEach((a) => {
        total++;
        if (!a.tools.every((t) => t === "none" || t === "dumbbell")) bad.push(a.id + ":" + a.tools);
      })));
      return { bad, total, id: DAYS[0].id };
    });
    expect(res.id).toMatch(/^sp4h/);
    expect(res.total).toBeGreaterThan(0);
    expect(res.bad).toEqual([]);
    await context.close();
  });

  test("swap replaces card and evidence uses new id with swaps entry", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await swapBtn(page, "mua_bench").click();
    const opt = sheet(page).locator(".swap-opt").first();
    const newId = await opt.getAttribute("data-swap-to");
    const newName = await opt.locator(".swap-opt-name").textContent();
    await opt.click();
    await expect(sheet(page)).toHaveCount(0, T);
    await expect(page.locator(`.check[data-id="${newId}"]`)).toBeVisible(T);
    await expect(page.locator('.check[data-id="mua_bench"]')).toHaveCount(0);
    await expect(card(page, newId).locator(".ex-title .en")).toHaveText(newName);
    await expect(card(page, newId).locator(".ex-swapped")).toContainText("Swapped from Barbell Bench Press");
    const meta = await card(page, newId).locator(".ex-meta").textContent();
    expect(meta).toContain("4"); // the original's 4 sets are kept
    await expect(card(page, newId).locator(".set-chk")).toHaveCount(4);
    const ev = await page.evaluate(([d, id]) => GymVerify.evidence(d, id, "live"), [TODAY, DAY_ID]);
    expect(ev.sets.some((s) => s.ex === newId)).toBe(true);
    expect(ev.sets.some((s) => s.ex === "mua_bench")).toBe(false);
    expect(ev.swaps).toEqual([{ from: "mua_bench", to: newId }]);
    await page.reload();
    await expect(page.locator(`.check[data-id="${newId}"]`)).toBeVisible(T); // survives a reload
    await context.close();
  });

  test("swapped day with all sets ticked 60s apart and duration ok judges verified", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await swapBtn(page, "mua_bench").click();
    const newId = await sheet(page).locator(".swap-opt").first().getAttribute("data-swap-to");
    await sheet(page).locator(".swap-opt").first().click();
    const ids = await page.evaluate(() => DAYS[0].exercises.map((e) => e.id));
    const order = ids.map((id) => (id === "mua_bench" ? newId : id));
    for (const id of order) await tickSets(page, id, null, 160000); // 21 sets, ~53 min end to end
    await expect(page.locator(".ex-card.done")).toHaveCount(order.length, T);
    const j = await page.evaluate(([d, id]) => GymVerify.judge(GymVerify.evidence(d, id, "live")), [TODAY, DAY_ID]);
    expect(j).toEqual({ state: "verified", reasons: [] });
    await context.close();
  });

  test("swap hidden after first tick; undo before first tick restores", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await swapBtn(page, "mua_bench").click();
    const newId = await sheet(page).locator(".swap-opt").first().getAttribute("data-swap-to");
    await sheet(page).locator(".swap-opt").first().click();
    await card(page, newId).locator(".ex-swap-undo").click();
    await expect(page.locator('.check[data-id="mua_bench"]')).toBeVisible(T);
    await expect(page.locator(".ex-swapped")).toHaveCount(0);
    expect(await page.evaluate(() => GymSwap.swapsFor(GymDate.key(), "m_upper"))).toEqual([]);
    // the first tick hides the button
    await page.locator('.set-chk[data-set-ex="mua_bench"]').first().click();
    await expect(swapBtn(page, "mua_bench")).toBeHidden();
    expect(await page.evaluate(() => GymSwap.apply(GymDate.key(), "m_upper", "mua_bench", Object.keys(GymSplits.library)[0]))).toBe(false);
    // and a swapped card loses Undo once ticked
    await swapBtn(page, "mua_pulldown").click();
    const id2 = await sheet(page).locator(".swap-opt").first().getAttribute("data-swap-to");
    await sheet(page).locator(".swap-opt").first().click();
    await page.clock.fastForward(61000);
    await page.locator(`.set-chk[data-set-ex="${id2}"]`).first().click();
    await expect(card(page, id2).locator(".ex-swap-undo")).toBeHidden();
    await expect(swapBtn(page, id2)).toBeHidden();
    await context.close();
  });

  test("no alternatives shows swapNone", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await page.evaluate(() => {
      const lib = GymSplits.library;
      Object.keys(lib).forEach((k) => { if (lib[k].shape === "chest_mid") delete lib[k]; });
    });
    await swapBtn(page, "mua_bench").click();
    await expect(sheet(page).locator(".swap-none")).toHaveText("No alternative with your equipment", T);
    await expect(sheet(page).locator(".swap-opt")).toHaveCount(0);
    await context.close();
  });

  test("Arabic sheet", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, lang: "ar" });
    await expect(swapBtn(page, "mua_bench")).toHaveText(/الجهاز مشغول؟/, T);
    await swapBtn(page, "mua_bench").click();
    await expect(page.locator("#swapTitle")).toContainText("استبدل", T);
    await context.close();
  });
});
