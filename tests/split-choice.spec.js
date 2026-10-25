const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { openApp, tickSets, TODAY } = require("./helpers");

test.setTimeout(60000);
const T = { timeout: 8000 };
const TOOLS = ["none", "dumbbell", "band", "bench", "table", "pullup_bar", "kettlebell", "jump_rope"];
const EN = ["No equipment", "Dumbbells", "Resistance bands", "Bench or chair", "Sturdy table", "Pull-up bar", "Kettlebell", "Jump rope"];
const AR = ["بدون معدات", "دمبل", "أحزمة مقاومة", "بنش أو كرسي", "طاولة ثابتة", "بار عقلة", "كيتل بيل", "حبل قفز"];

const panel = (page) => page.locator("#splitPanel");
const chip = (page, d) => page.locator('#splitPanel [data-sp-days="' + d + '"]');
const dayIds = (page) => page.evaluate(() => DAYS.map((d) => d.id));
const goMore = (page) => page.evaluate(() => GymUI.navigate("more", { instant: true }));
const stored = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), k);

test.describe("choosing a split", () => {
  test("classic untouched: no choice, no pref, the Classic plan and its ids", async ({ browser }) => {
    const { context, page, consoleErrors } = await openApp(browser, { signedIn: true });
    expect(await dayIds(page)).toEqual(["m_upper", "m_lower", "m_backbi", "m_chesttri"]);
    expect(await page.evaluate(() => localStorage.getItem("gym_split"))).toBeNull();
    await expect(page.locator("#exList .ex-tools")).toHaveCount(0);
    await goMore(page);
    await expect(chip(page, 0)).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#splitPanel .sp-tools")).toHaveCount(0);
    expect(consoleErrors.filter((e) => !/404/.test(e))).toEqual([]);
    await context.close();
  });

  test("an existing user with a saved plan and checks is not moved", async ({ browser }) => {
    const checks = { [TODAY + "_m_upper"]: { mua_bench: true } };
    const { context, page } = await openApp(browser, { signedIn: true, plan: "female", checks });
    expect(await dayIds(page)).toEqual(await page.evaluate(() => DAYS_FEMALE.map((d) => d.id)));
    expect(await stored(page, "gym_checks")).toEqual(checks);
    await page.reload();
    await page.waitForFunction(() => window.GymRest && window.GymDate);
    expect(await dayIds(page)).toEqual(await page.evaluate(() => DAYS_FEMALE.map((d) => d.id)));
    expect(await page.evaluate(() => localStorage.getItem("gym_split"))).toBeNull();
    await context.close();
  });

  test("choosing days changes the plan to the generated split; Classic switches back unchanged", async ({ browser }) => {
    const { context, page, consoleErrors } = await openApp(browser, { signedIn: true });
    const classic = await page.evaluate(() => JSON.stringify(DAYS_MALE));
    await goMore(page);
    for (const n of [3, 4, 5, 6]) {
      await chip(page, n).click();
      await expect(chip(page, n)).toHaveAttribute("aria-checked", "true");
      const expected = await page.evaluate((d) => GymSplits.buildPlan({ days: d, where: "gym", sex: "male", tools: [] }).days.map((x) => x.id), n);
      expect(await dayIds(page)).toEqual(expected);
      expect(expected).toHaveLength(n);
    }
    expect(await stored(page, "gym_split")).toEqual({ days: 6, where: "gym", tools: [] });
    await chip(page, 0).click();
    expect(await dayIds(page)).toEqual(["m_upper", "m_lower", "m_backbi", "m_chesttri"]);
    expect(await page.evaluate(() => JSON.stringify(DAYS_MALE))).toBe(classic);
    expect((await stored(page, "gym_split")).days).toBe(0);
    expect(consoleErrors.filter((e) => !/404/.test(e))).toEqual([]);
    await context.close();
  });

  test("split days render through the normal path: tools line, set ticks, Arabic day names, video-soon", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await goMore(page);
    await chip(page, 4).click();
    await page.evaluate(() => GymUI.navigate("plan", { instant: true }));
    await expect(page.locator("#dayTabs .day-chip")).toHaveText(["Upper A", "Lower A", "Upper B", "Lower B"]);
    const cards = page.locator("#exList .ex-card");
    await expect(cards.first()).toBeVisible(T);
    const n = await cards.count();
    await expect(page.locator("#exList .ex-tools")).toHaveCount(n);
    await expect(cards.first().locator(".ex-tools")).toHaveAttribute("aria-label", /^Tools: .+/);
    // a set tick goes through setExDone: gym_checks gets the exercise once every set is on
    const sets = cards.first().locator(".set-chk");
    for (let i = 0; i < (await sets.count()); i++) { await page.clock.fastForward(61000); await sets.nth(i).click(); }
    await expect(cards.first()).toHaveClass(/done/);
    const checks = await stored(page, "gym_checks");
    const key = Object.keys(checks).find((k) => /^\d{4}-\d\d-\d\d_sp4gm_upperA$/.test(k));
    expect(key).toBeTruthy();
    expect(Object.values(checks[key]).filter(Boolean)).toHaveLength(1);
    // no invented video: moves without a clip say so
    const soon = await page.locator("#exList .video-soon").count();
    const withVid = await page.locator("#exList .video-toggle").count();
    expect(soon + withVid).toBe(n);
    // Arabic labels come from the split day objects
    await page.evaluate(() => document.getElementById("langBtn").click());
    await expect(page.locator("#dayTabs .day-chip").first()).toHaveText("علوي أ");
    await expect(page.locator("#dayMuscles")).toContainText("صدر");
    await context.close();
  });

  test("the choice is a synced pref and survives a reload", async ({ browser }) => {
    const { context, page, server } = await openApp(browser, { signedIn: true });
    const puts = [];
    await context.route("**/api/v1/progress", async (route) => {
      const req = route.request();
      if (req.method() === "PUT") {
        puts.push(JSON.parse(req.postData() || "{}"));
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ entries: {} }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ entries: {} }) });
    });
    await goMore(page);
    await chip(page, 5).click();
    await page.locator('#splitPanel [data-sp-where="home"]').click();
    await page.locator('#splitPanel [data-sp-tool="dumbbell"]').click();
    const meta = await stored(page, "gym_meta_updatedAt");
    expect(typeof meta.gym_split).toBe("number"); // stamped for sync like gym_plan / gym_style
    // sync.js mirrors every gym_ key except its device-local list; gym_split is not on that list
    const src = fs.readFileSync(path.join(__dirname, "..", "sync.js"), "utf8");
    const localOnly = /LOCAL_ONLY\s*=\s*\{([^}]*)\}/.exec(src)[1];
    expect(localOnly).not.toContain("gym_split");
    await page.evaluate(() => GymSync.syncNow());
    await expect.poll(() => puts.length, T).toBeGreaterThan(0);
    const entry = puts[puts.length - 1].entries.gym_split;
    expect(JSON.parse(entry.value || entry.v || JSON.stringify(entry))).toEqual({ days: 5, where: "home", tools: ["dumbbell"] });
    const before = await dayIds(page);
    await page.reload();
    await page.waitForFunction(() => window.GymRest && window.GymDate);
    expect(await dayIds(page)).toEqual(before);
    expect(before[0]).toBe("sp5hm_upper");
    await goMore(page);
    await expect(chip(page, 5)).toHaveAttribute("aria-checked", "true");
    await expect(page.locator('#splitPanel [data-sp-where="home"]')).toHaveAttribute("aria-checked", "true");
    await expect(page.locator('#splitPanel [data-sp-tool="dumbbell"]')).toHaveAttribute("aria-checked", "true");
    expect(server).toBeTruthy();
    await context.close();
  });

  for (const lang of ["en", "ar"]) {
    test("the home tool checklist shows an icon and a name for each of the 8 tools (" + lang + ")", async ({ browser }) => {
      const { context, page } = await openApp(browser, { signedIn: true, lang, ls: { gym_split: { days: 4, where: "home", tools: [] } } });
      await goMore(page);
      const tools = page.locator("#splitPanel .sp-tool");
      await expect(tools).toHaveCount(8);
      const names = lang === "ar" ? AR : EN;
      for (let i = 0; i < 8; i++) {
        const b = tools.nth(i);
        await expect(b).toHaveAttribute("data-sp-tool", TOOLS[i]);
        await expect(b).toHaveAttribute("role", "checkbox");
        await expect(b.locator("svg.tool-ic path, svg.tool-ic circle, svg.tool-ic rect").first()).toBeAttached();
        await expect(b).toContainText(names[i]);
        expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
      // none is on until a tool is ticked; ticking a tool turns it off, and back
      await expect(tools.nth(0)).toHaveAttribute("aria-checked", "true");
      await tools.nth(1).click();
      await expect(tools.nth(1)).toHaveAttribute("aria-checked", "true");
      await expect(tools.nth(0)).toHaveAttribute("aria-checked", "false");
      await tools.nth(0).click();
      await expect(tools.nth(1)).toHaveAttribute("aria-checked", "false");
      await expect(tools.nth(0)).toHaveAttribute("aria-checked", "true");
      expect(await page.evaluate(() => document.documentElement.dir)).toBe(lang === "ar" ? "rtl" : "ltr");
      await context.close();
    });
  }

  test("a hint names the tool to tick when more tools would close gaps, and it clears once ticked", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true, ls: { gym_split: { days: 4, where: "home", tools: [] } } });
    await goMore(page);
    const hint = page.locator("#splitPanel .sp-hint");
    await expect(hint.first()).toBeVisible(T);
    const text = (await hint.allTextContents()).join(" ");
    expect(text).toMatch(/Tick .+ to cover .+\./);
    const tool = await page.evaluate(() => GymSplits.buildPlan({ days: 4, where: "home", sex: "male", tools: [] }).gaps.filter((g) => g.tick).map((g) => g.tick[0]));
    expect(tool.length).toBeGreaterThan(0);
    await expect(page.locator("#splitPanel .sp-hints")).toHaveAttribute("aria-live", "polite");
    // ticking every home tool leaves nothing the ticked tools could add
    for (const k of TOOLS.slice(1)) await page.locator('#splitPanel [data-sp-tool="' + k + '"]').click();
    const left = await page.evaluate(() => GymSplits.buildPlan({ days: 4, where: "home", sex: "male", tools: ["dumbbell", "band", "bench", "table", "pullup_bar", "kettlebell", "jump_rope"] }).gaps.filter((g) => g.tick));
    expect(left).toHaveLength(0);
    await expect(hint).toHaveCount(0);
    // Gym has every tool: no hint, and no tool checklist
    await page.locator('#splitPanel [data-sp-where="gym"]').click();
    await expect(hint).toHaveCount(0);
    await expect(page.locator("#splitPanel .sp-tools")).toHaveCount(0);
    await context.close();
  });

  test("best fit shows only when another day count leaves strictly fewer tool gaps", async ({ browser }) => {
    for (const days of [3, 4, 5, 6]) {
      const { context, page } = await openApp(browser, { signedIn: true, ls: { gym_split: { days, where: "home", tools: ["dumbbell", "bench"] } } });
      await goMore(page);
      const want = await page.evaluate((cur) => {
        const n = (d) => GymSplits.buildPlan({ days: d, where: "home", sex: "male", tools: ["dumbbell", "bench"] }).gaps.filter((g) => g.kind === "region").length;
        let best = 0, bn = n(cur);
        [4, 5, 3, 6].forEach((d) => { if (d !== cur && n(d) < bn) { best = d; bn = n(d); } });
        return best;
      }, days);
      await expect(page.locator("#splitPanel .sp-chip.rec")).toHaveCount(want ? 1 : 0);
      await expect(page.locator("#splitPanel .sp-note")).toHaveCount(want ? 1 : 0);
      if (want) {
        await expect(chip(page, want)).toHaveClass(/rec/);
        await expect(chip(page, want)).toHaveAttribute("aria-label", /best fit/);
      }
      await context.close();
    }
  });

  test("the summary lists the fixed training weekdays, localized", async ({ browser }) => {
    for (const [lang, re] of [["en", /Training days: Mon · Wed · Fri/], ["ar", /أيام التمرين: .+ · .+ · .+/]]) {
      const { context, page } = await openApp(browser, { signedIn: true, lang, ls: { gym_split: { days: 3, where: "gym", tools: [] } } });
      await goMore(page);
      await expect(page.locator("#splitPanel .sp-wk")).toHaveText(re);
      await page.locator('#splitPanel [data-sp-days="6"]').click();
      const n = (await page.locator("#splitPanel .sp-wk").textContent()).split("·").length;
      expect(n).toBe(6);
      await context.close();
    }
  });

  test("the selected Gym/Home button is visibly filled", async ({ browser }) => {
    for (const theme of ["dark", "light"]) {
      const { context, page } = await openApp(browser, { signedIn: true, theme, ls: { gym_split: { days: 4, where: "home", tools: [] } } });
      await goMore(page);
      const bg = (w) => page.locator('#splitPanel [data-sp-where="' + w + '"]').evaluate((e) => getComputedStyle(e).backgroundColor);
      const on = await bg("home"), off = await bg("gym");
      expect(on).not.toBe(off);
      expect(off).toBe("rgba(0, 0, 0, 0)");
      await context.close();
    }
  });

  test("splits.js blocked: the app still renders the Classic plan", async ({ browser }) => {
    const context = await browser.newContext({ ...(process.env.PW_BASE ? { baseURL: process.env.PW_BASE } : {}), serviceWorkers: "block", viewport: { width: 390, height: 844 } });
    await context.route("**/splits.js", (r) => r.abort());
    await context.addInitScript(() => {
      localStorage.setItem("gym_lang", "en"); localStorage.setItem("gym_onboarded", "1"); localStorage.setItem("gym_terms_ok", "terms.v2");
      localStorage.setItem("gym_plan", "male"); localStorage.setItem("gym_style", "gym");
      localStorage.setItem("gym_split", JSON.stringify({ days: 4, where: "home", tools: [] }));
      sessionStorage.setItem("gymauth_session", JSON.stringify({ token: "tok", exp: Math.floor(Date.now() / 1000) + 3600, source: "local", profile: { name: "T", email: "t@example.com" } }));
    });
    const errors = [];
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/index.html");
    await expect(page.locator("#exList .ex-card").first()).toBeVisible({ timeout: 15000 });
    expect(await page.evaluate(() => typeof window.GymSplits)).toBe("undefined");
    expect(await dayIds(page)).toEqual(["m_upper", "m_lower", "m_backbi", "m_chesttri"]);
    expect(errors).toEqual([]);
    await context.close();
  });

  test("switch keeps checks: changing days or tools mid-week never drops a recorded check", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await goMore(page);
    await chip(page, 4).click();
    const first = await page.evaluate(() => DAYS[0].exercises[0].id);
    await page.evaluate(() => GymUI.navigate("plan", { instant: true }));
    await tickSets(page, first);
    const k4 = TODAY + "_sp4gm_upperA";
    expect((await stored(page, "gym_checks"))[k4][first]).toBe(true);
    // switch to 5 days, then Home with tools, then Classic, then back to 4: the record is untouched
    await goMore(page);
    await chip(page, 5).click();
    await page.locator('#splitPanel [data-sp-where="home"]').click();
    await page.locator('#splitPanel [data-sp-tool="dumbbell"]').click();
    await chip(page, 0).click();
    await chip(page, 4).click();
    const after = await stored(page, "gym_checks");
    expect(after[k4][first]).toBe(true);
    // the calendar and "save yesterday" still resolve the earlier day by id after the switch
    expect(await dayIds(page)).toContain("sp4hm_upperA"); // the plan is now the home variant
    const ex = await page.evaluate(() => GymApp.dayExercises("sp4gm_upperA").map((e) => e.id));
    expect(ex).toContain(first);
    await page.locator('#splitPanel [data-sp-where="gym"]').click();
    await page.evaluate(() => GymUI.navigate("plan", { instant: true }));
    await expect(page.locator('#exList .check[data-id="' + first + '"]')).toHaveClass(/on/);
    await context.close();
  });

  test("applyChoice is the one entry point (for the onboarding survey)", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: true });
    await page.evaluate(() => { activeStyle = "cal"; localStorage.setItem("gym_style", "cal"); });
    const out = await page.evaluate(() => {
      const r = GymSplits.applyChoice({ days: 3, where: "home", tools: ["band", "bogus", "dumbbell"] });
      return { ids: r.days.map((d) => d.id), choice: JSON.parse(localStorage.getItem("gym_split")), style: localStorage.getItem("gym_style") };
    });
    expect(out.ids).toEqual(["sp3hm_fullA", "sp3hm_fullB", "sp3hm_fullC"]);
    expect(out.choice).toEqual({ days: 3, where: "home", tools: ["dumbbell", "band"] });
    expect(out.style).toBe("gym");
    expect(await page.evaluate(() => GymSplits.applyChoice({ days: 0 }))).toBeNull();
    await context.close();
  });

  test("women's version and Arabic RTL render at 360px without horizontal scroll", async ({ browser }) => {
    const { context, page } = await openApp(browser, {
      signedIn: true, plan: "female", lang: "ar", viewport: { width: 360, height: 780 },
      ls: { gym_split: { days: 6, where: "home", tools: ["dumbbell"] } }
    });
    expect((await dayIds(page))[0]).toBe("sp6hf_pushA");
    await goMore(page);
    await expect(page.locator("#splitPanel .sp-tool")).toHaveCount(8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    for (const b of await page.locator("#splitPanel .sp-chip").all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await context.close();
  });
});
