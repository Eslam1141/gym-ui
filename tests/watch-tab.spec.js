// The Watch tab: nav slot, every state (web, old Android, install, not connected,
// loading, connected, partial, empty, denied, error), the 7-day chart, the Plan
// link, RTL, reduced motion and the accessible names.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");
const { stubHealth, callsOf, lsGet, WEEK_DATA } = require("./watch-helpers");

test.setTimeout(60000);

const ua = (n) => `Mozilla/5.0 (Linux; Android ${n}; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36`;
const goWatch = (page) => page.evaluate(() => GymUI.navigate("watch", { instant: true }));
const body = (page) => page.locator("#watchBody");
const leg = (page, key) => page.locator(`#wtDial ~ .wt-legend .wt-leg[data-key="${key}"], .wt-legend .wt-leg[data-key="${key}"]`).first();

// connected = etqwatch_on seeded, a stubbed plugin, the Watch tab open
async function connected(browser, o) {
  o = o || {};
  const app = await openApp(browser, { signedIn: false, lang: o.lang, theme: o.theme, viewport: o.viewport || { width: 360, height: 780 }, contextOptions: o.contextOptions });
  await app.page.evaluate(() => { localStorage.setItem("etqwatch_on", "1"); localStorage.setItem("etqwatch_ask", "yes"); });
  await stubHealth(app.page, { health: Object.assign({ data: WEEK_DATA }, o.health || {}) });
  await goWatch(app.page);
  return app;
}
async function settled(page) {   // the dial entrance (800 ms + stagger) is over
  await page.waitForFunction(() => document.querySelector("#wtDial") && !document.querySelector(".wt-skel"));
  await page.clock.runFor(2500);
}

test.describe("nav", () => {
  test("five tabs in order Plan, Coach, Food, Watch, More; labels fit in EN and AR", async ({ browser }) => {
    for (const lang of ["en", "ar"]) {
      const { context, page } = await openApp(browser, { signedIn: false, lang, viewport: { width: 360, height: 780 } });
      const tabs = await page.locator("#appNav button").evaluateAll((bs) => bs.map((b) => b.dataset.tab));
      expect(tabs).toEqual(["plan", "coach", "food", "watch", "more"]);
      const label = await page.locator('#appNav button[data-tab="watch"] [data-i18n="navWatch"]').textContent();
      expect(label).toBe(lang === "ar" ? "ساعتي" : "Watch");
      for (const b of await page.locator("#appNav button").all()) {
        const r = await b.evaluate((n) => { const t = n.querySelector("span"); return [t.scrollWidth <= t.clientWidth + 1, n.getBoundingClientRect().width]; });
        expect(r[0]).toBe(true);
        expect(r[1]).toBeGreaterThan(60);
      }
      await context.close();
    }
  });

  test("the nav dot says new until the tab is first opened; the choice survives a reload", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: false });
    const dot = page.locator('#appNav button[data-tab="watch"] .nav-dot');
    await expect(dot).toHaveCount(1);
    await expect(dot).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator('#appNav button[data-tab="watch"]')).toContainText("(new)");
    await page.click('#appNav button[data-tab="watch"]');
    await expect(page.locator("#screen-watch")).toBeVisible();
    await expect(dot).toHaveCount(0);
    expect(await lsGet(page, "etqwatch_tabseen")).toBe("1");
    expect(await page.evaluate(() => localStorage.getItem("gym_tab"))).toBe("watch");
    await page.reload();
    await expect(page.locator("#screen-watch")).toBeVisible();
    await expect(page.locator('#appNav button[data-tab="watch"]')).toHaveAttribute("aria-current", "page");
    await expect(dot).toHaveCount(0);
    await context.close();
  });
});

test.describe("states", () => {
  test("web / PWA: an honest explainer, no button", async ({ browser }) => {
    const { context, page, consoleErrors } = await openApp(browser, { signedIn: false, viewport: { width: 360, height: 780 } });
    await goWatch(page);
    const c = page.locator("#wtWebCard");
    await expect(c).toContainText("Watch data works in the Android app");
    await expect(c.locator("button, a.wt-btn")).toHaveCount(0);
    await expect(c.locator(".wt-ghost")).toHaveAttribute("aria-hidden", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(consoleErrors).toEqual([]);
    await context.close();
  });

  test("Android 8: 'your phone can't share', and the plugin is never asked", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: false, contextOptions: { userAgent: ua(8) } });
    await stubHealth(page, { health: { available: true } });
    await goWatch(page);
    await expect(page.locator("#wtOldCard")).toContainText("Watch data needs Android 9 or newer.");
    await expect(page.locator("#wtOldCard button")).toHaveCount(0);
    expect(await callsOf(page, "isAvailable")).toHaveLength(0);
    await context.close();
  });

  test("Health Connect missing: install card with a Play link and Check again", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: false, contextOptions: { userAgent: ua(13) } });
    await stubHealth(page, { health: { available: false, reason: "Health Connect is unavailable on this device." } });
    await goWatch(page);
    const c = page.locator("#wtInstallCard");
    await expect(c).toContainText("Install or update Health Connect");
    await expect(c.locator("a#wtInstallGo")).toHaveAttribute("href", /details\?id=com\.google\.android\.apps\.healthdata/);
    await page.evaluate(() => { window.__health.cfg.available = true; });
    await page.click("#wtRecheck");
    await expect(page.locator("#wtConnectCard")).toBeVisible();
    expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
    await context.close();
  });

  test("not connected: Connect reaches the permission request in two taps (Connect, Continue)", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: false, viewport: { width: 360, height: 780 } });
    await stubHealth(page, { health: { data: WEEK_DATA } });
    await goWatch(page);
    const c = page.locator("#wtConnectCard");
    await expect(c).toContainText("Connect your watch");
    await expect(c.locator(".wt-ghost")).toHaveAttribute("aria-hidden", "true");
    await expect(c.locator("a.pol-link")).toHaveAttribute("href", /\/privacy#health-connect/);
    expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
    await page.click("#wtConnect");
    await expect(page.locator("#watchSheet [role=dialog]")).toContainText("Show your watch data in Etqadem");
    await page.click("#wtGo");
    const req = await callsOf(page, "requestAuthorization");
    expect(req).toHaveLength(1);
    expect(req[0].arg.read.slice().sort()).toEqual(["calories", "heartRate", "restingHeartRate", "sleep", "steps", "weight"]);
    await expect(page.locator("#wtDial")).toBeVisible();
    await context.close();
  });

  test("permission screen declined: stays on Connect with an inline note", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: false });
    await stubHealth(page, { health: { grantOnRequest: [] } });
    await goWatch(page);
    await page.click("#wtConnect");
    await page.click("#wtGo");
    await expect(page.locator("#wtConnectCard .wt-note")).toContainText("No permission was given");
    await expect(page.locator("#wtDial")).toHaveCount(0);
    await context.close();
  });

  test("Not now in the disclosure is not the 'declined' note", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: false });
    await stubHealth(page);
    await goWatch(page);
    await page.click("#wtConnect");
    await page.click("#wtLater");
    await expect(page.locator("#wtConnectCard")).toBeVisible();
    await expect(page.locator("#wtConnectCard .wt-note")).toHaveCount(0);
    expect(await callsOf(page, "requestAuthorization")).toHaveLength(0);
    await context.close();
  });

  test("connected with data: dial, legend, heart cells, chart and footer all read as text", async ({ browser }) => {
    const { context, page, consoleErrors } = await connected(browser);
    await settled(page);
    await expect(leg(page, "steps")).toContainText("8,214");
    await expect(leg(page, "steps")).toContainText("103% of 8,000");
    await expect(leg(page, "kcal")).toContainText("412");
    await expect(leg(page, "kcal")).toContainText("82% of 500 kcal");
    await expect(leg(page, "sleep")).toContainText("7 h");
    await expect(leg(page, "sleep")).toContainText("88% of 8 h");
    await expect(leg(page, "steps").locator(".wt-chip")).toHaveText("Goal reached");
    await expect(page.locator('.wt-stat[data-key="rhr"]')).toContainText("58");
    await expect(page.locator('.wt-stat[data-key="avgHr"]')).toContainText("71");
    await expect(page.locator(".wt-head .wt-meta")).toContainText(/Updated \d{2}:\d{2}/);
    await expect(page.locator("#wtMetricTabs [role=tab]")).toHaveCount(4);
    await expect(page.locator("#wtPrivacy")).toContainText("Your watch data stays on this phone.");
    await expect(page.locator("#wtPrivacy")).toContainText("estimates, not medical advice");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(consoleErrors).toEqual([]);
    await context.close();
  });

  test("the dial label is one sentence of the same numbers the legend shows", async ({ browser }) => {
    const { context, page } = await connected(browser);
    await settled(page);
    const label = await page.locator("#wtDial").getAttribute("aria-label");
    expect(label).toContain("Steps: 8,214, 103% of 8,000");
    expect(label).toContain("Active kcal: 412 kcal, 82% of 500 kcal");
    expect(label).toContain("Sleep last night: 7 h");
    expect(await page.locator("#wtDial").getAttribute("role")).toBe("img");
    await expect(page.locator("#wtDial .wt-n, #wtDial .wt-c-n")).toHaveAttribute("aria-hidden", "true");
    await context.close();
  });

  test("partial: a denied type shows 'Not allowed', its ring stays empty, no NaN or undefined", async ({ browser }) => {
    const { context, page, consoleErrors } = await connected(browser, { health: { authorized: ["steps", "calories"] } });
    await settled(page);
    await expect(leg(page, "steps")).toContainText("8,214");
    await expect(leg(page, "sleep")).toContainText("Not allowed");
    await expect(page.locator('.wt-stat[data-key="rhr"]')).toContainText("Not allowed");
    await expect(page.locator(".wt-note-card")).toContainText("Some types are off");
    await page.click("#wtManage");
    expect(await callsOf(page, "openHealthConnectSettings")).toHaveLength(1);
    const off = await page.locator(".wt-arc-sleep").getAttribute("stroke-dashoffset");
    expect(Number(off)).toBe(100);
    // chart tabs without data are disabled, with the reason in the readout
    await expect(page.locator("#wtTab-sleep")).toHaveAttribute("aria-disabled", "true");
    await expect(page.locator("#wtTab-hr")).toHaveAttribute("aria-disabled", "true");
    await page.click("#wtTab-sleep", { force: true });   // aria-disabled: Playwright would wait forever
    await expect(page.locator("#wtReadout")).toContainText("No Sleep data in the last 7 days");
    await expect(page.locator("#wtTab-steps")).toHaveAttribute("aria-selected", "true");
    const text = await body(page).innerText();
    expect(text).not.toMatch(/NaN|undefined|null/);
    expect(consoleErrors).toEqual([]);
    await context.close();
  });

  test("connected but the watch has not synced: empty state and Check again", async ({ browser }) => {
    const { context, page } = await connected(browser, { health: { data: {} } });
    await expect(page.locator("#wtEmptyCard")).toContainText("No data from your watch yet");
    await expect(page.locator("#wtDial")).toHaveCount(0);
    await page.click("#wtAgain");
    await expect.poll(async () => (await callsOf(page, "checkAuthorization")).length).toBeGreaterThan(1);
    await context.close();
  });

  test("access removed in Health Connect: says so and offers Connect and settings", async ({ browser }) => {
    const { context, page } = await connected(browser, { health: { authorized: [] } });
    await expect(page.locator("#wtDeniedCard")).toContainText("Access was removed in Health Connect");
    await expect(page.locator("#wtReconnect")).toBeVisible();
    await page.click("#wtOpenHc");
    expect(await callsOf(page, "openHealthConnectSettings")).toHaveLength(1);
    expect(await lsGet(page, "etqwatch_week")).toBeNull();
    await context.close();
  });

  test("a failing read: calm error, 'Try again', no throw", async ({ browser }) => {
    const { context, page, consoleErrors } = await connected(browser, { health: { rejectReads: true } });
    await expect(page.locator(".wt-note-card")).toContainText("Couldn't read your watch data");
    await expect(page.locator("#wtRetry")).toBeVisible();
    expect(consoleErrors.filter((e) => !/read failed/.test(e))).toEqual([]);
    await context.close();
  });

  test("loading with a cache paints the cached values at once; without one it shows the skeleton", async ({ browser }) => {
    const app = await openApp(browser, { signedIn: false, viewport: { width: 360, height: 780 } });
    const { page } = app;
    await page.evaluate(() => {
      localStorage.setItem("etqwatch_on", "1");
      localStorage.setItem("etqwatch_cache", JSON.stringify({ day: GymDate.key(), at: Date.now(), vals: { steps: 5000, kcal: 250, rhr: 60, avgHr: 70, sleepMin: 400 }, denied: [] }));
    });
    await stubHealth(page, { noWait: true, health: { data: WEEK_DATA, hangReads: true } });   // the reads never finish: only the cache can be on screen
    await goWatch(page);
    await expect(leg(page, "steps")).toContainText("5,000");
    await expect(page.locator(".wt-head .wt-meta")).toContainText("Updating...");
    await app.context.close();

    const b = await openApp(browser, { signedIn: false });
    await b.page.evaluate(() => localStorage.setItem("etqwatch_on", "1"));
    await stubHealth(b.page, { noWait: true, health: { data: WEEK_DATA, hangAuth: true } });
    await goWatch(b.page);
    await expect(b.page.locator("#wtSkel")).toBeVisible();
    await expect(b.page.locator("#watchBody")).toHaveAttribute("aria-busy", "true");
    await b.context.close();
  });
});

test.describe("the last 7 days", () => {
  test("reads: one day bucket per day from 6 days ago (local midnight), sessions assigned to the day they ended", async ({ browser }) => {
    const { context, page } = await connected(browser);
    await settled(page);
    const agg = (await callsOf(page, "queryAggregated")).filter((c) => c.arg.dataType === "steps");
    expect(agg).toHaveLength(2);
    expect(agg[1].arg).toMatchObject({ bucket: "day", aggregation: "sum", startDate: "2026-09-25T21:00:00.000Z" });   // 2026-09-26 00:00 Cairo
    const rhr = (await callsOf(page, "readSamples")).find((c) => c.arg.dataType === "restingHeartRate" && c.arg.limit === 30);
    expect(rhr.arg.startDate).toBe("2026-09-25T21:00:00.000Z");
    const sleep = (await callsOf(page, "readSamples")).find((c) => c.arg.dataType === "sleep" && c.arg.limit === 200);
    expect(sleep.arg.startDate).toBe("2026-09-25T15:00:00.000Z");   // 2026-09-25 18:00 Cairo
    const week = await page.evaluate(() => JSON.parse(localStorage.getItem("etqwatch_week")).days);
    expect(week.map((d) => d.steps)).toEqual([4200, 6100, 8800, 3000, 9120, 7400, 8214]);
    expect(week.map((d) => d.sleepMin)).toEqual([400, 455, 380, 510, 430, null, 420]);
    expect(week.map((d) => d.rhr)).toEqual([60, 59, null, 58, 57, 58, 58]);
    expect(week[6].d).toBe("2026-10-02");
    await context.close();
  });

  test("seven bars, today highlighted, a goal line with its value, a readout that follows the selection", async ({ browser }) => {
    const { context, page } = await connected(browser);
    await settled(page);
    await expect(page.locator(".wt-bar")).toHaveCount(7);
    await expect(page.locator(".wt-bar.is-today")).toHaveCount(1);
    await expect(page.locator(".wt-goal-l")).toHaveText("Goal 8,000");
    await expect(page.locator("#wtReadout")).toHaveText("Today: 8,214 steps");
    await page.locator(".wt-hit").nth(4).click();
    await expect(page.locator("#wtReadout")).toHaveText("Wednesday: 9,120 steps");   // 2026-09-30
    await expect(page.locator(".wt-hit").nth(4)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".wt-sum")).toContainText("Average 6,691 steps a day. Best day: Wednesday.");
    await context.close();
  });

  test("four metric tabs switch the chart; the choice is remembered on this phone only", async ({ browser }) => {
    const { context, page } = await connected(browser);
    await settled(page);
    await page.click("#wtTab-sleep");
    await expect(page.locator("#wtTab-sleep")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".wt-goal-l")).toHaveText("Goal 8 h");
    await expect(page.locator("#wtReadout")).toHaveText("Today: 7 h");
    await page.click("#wtTab-hr");
    await expect(page.locator(".wt-line-p")).toHaveCount(1);
    await expect(page.locator(".wt-dot")).toHaveCount(7);
    await expect(page.locator(".wt-dot-gap")).toHaveCount(1);
    await expect(page.locator(".wt-sum")).toContainText("Average resting heart rate 58 bpm.");
    expect(await lsGet(page, "etqwatch_metric")).toBe("hr");
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /^gym_/.test(k) && /etqwatch|"hr"/.test(localStorage.getItem(k) || "")))).toEqual([]);
    await context.close();
  });

  test("arrow keys move between tabs and between days (roving tabindex)", async ({ browser }) => {
    const { context, page } = await connected(browser);
    await settled(page);
    await page.locator("#wtTab-steps").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#wtTab-kcal")).toHaveAttribute("aria-selected", "true");
    await page.locator(".wt-hit.is-sel").focus();
    expect(await page.locator('.wt-hit[tabindex="0"]').count()).toBe(1);
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(".wt-hit").nth(5)).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Home");
    await expect(page.locator(".wt-hit").nth(0)).toHaveAttribute("aria-pressed", "true");
    await context.close();
  });

  test("trained dots follow the workouts done on this phone, and open the Plan tab", async ({ browser }) => {
    const app = await openApp(browser, { signedIn: false, viewport: { width: 360, height: 780 } });
    const { page } = app;
    await page.evaluate(() => localStorage.setItem("etqwatch_on", "1"));
    // complete every exercise of a real plan day on 2026-10-01 (yesterday)
    await page.evaluate(() => {
      const ids = GymApp.dayExercises("m_upperA").map((e) => e.id);
      const checks = JSON.parse(localStorage.getItem("gym_checks") || "{}");
      checks["2026-10-01_m_upperA"] = Object.fromEntries(ids.map((i) => [i, true]));
      localStorage.setItem("gym_checks", JSON.stringify(checks));
    });
    await stubHealth(page, { health: { data: WEEK_DATA } });
    await goWatch(page);
    await settled(page);
    const on = await page.locator(".wt-tdot").evaluateAll((d) => d.map((x) => x.classList.contains("is-on")));
    expect(on).toEqual([false, false, false, false, false, true, false]);
    await expect(page.locator("#wtTrained")).toHaveAttribute("aria-label", /Days you finished a workout: Thursday/);
    await page.click("#wtTrained");
    await expect(page.locator("#screen-plan")).toBeVisible();
    await app.context.close();
  });

  test("a visually hidden table mirrors the chart for screen readers", async ({ browser }) => {
    const { context, page } = await connected(browser);
    await settled(page);
    const t = page.locator(".wt-panel-chart table");
    await expect(t.locator("caption")).toHaveText("Steps, last 7 days");
    await expect(t.locator("tbody tr")).toHaveCount(7);
    await expect(t.locator("tbody tr").last()).toContainText("8,214 steps");
    await expect(page.locator(".wt-chart")).not.toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(".wt-days")).toHaveAttribute("aria-hidden", "true");
    await context.close();
  });
});

test.describe("Plan tab", () => {
  test("no ask card; a one-line link only when connected with data, and it opens the Watch tab", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: false, viewport: { width: 360, height: 780 } });
    await stubHealth(page);
    await expect(page.locator("#watchMount")).toBeHidden();
    await expect(page.locator(".wt-ask")).toHaveCount(0);
    await page.evaluate(() => { localStorage.setItem("etqwatch_on", "1"); return GymWatch.init(); });
    const link = page.locator("#wtPlanLink");
    await expect(link).toBeVisible();
    await expect(link).toContainText("8,214 steps");
    await expect(link).toContainText("412 kcal");
    await expect(link).toHaveAttribute("aria-label", "Watch: 8,214 steps, 412 kcal. Open");
    const box = await link.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeLessThanOrEqual(56);
    await link.click();
    await expect(page.locator("#screen-watch")).toBeVisible();
    await context.close();
  });

  test("connected without any steps or kcal: the Plan row stays hidden", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: false });
    await page.evaluate(() => localStorage.setItem("etqwatch_on", "1"));
    await stubHealth(page, { health: { data: {} } });
    await expect(page.locator("#watchMount")).toBeHidden();
    await context.close();
  });
});

test.describe("privacy", () => {
  test("etqwatch_week is local only: never in a request, wiped on disconnect and on sign-out", async ({ browser }) => {
    const { context, page } = await openApp(browser, { signedIn: false });
    const seen = [];
    page.on("request", (r) => seen.push((r.url() + (r.postData() || "")).toString()));
    await page.evaluate(() => localStorage.setItem("etqwatch_on", "1"));
    await stubHealth(page, { health: { data: WEEK_DATA } });
    await goWatch(page);
    await settled(page);
    expect(await lsGet(page, "etqwatch_week")).not.toBeNull();
    expect(seen.filter((u) => /9120|7400|8214|etqwatch/.test(u))).toEqual([]);
    await page.click("#wtDisc");
    await page.click("#wtGo");
    expect(await lsGet(page, "etqwatch_week")).toBeNull();
    expect(await lsGet(page, "etqwatch_on")).toBeNull();
    await expect(page.locator("#wtConnectCard")).toBeVisible();

    await page.evaluate(() => { localStorage.setItem("etqwatch_week", "{}"); localStorage.setItem("etqwatch_tabseen", "1"); document.dispatchEvent(new CustomEvent("gym:authchange", { detail: false })); });
    expect(await lsGet(page, "etqwatch_week")).toBeNull();
    expect(await lsGet(page, "etqwatch_tabseen")).toBeNull();
    await context.close();
  });

  test("revoking one type drops its column from the cached week", async ({ browser }) => {
    const { context, page } = await connected(browser);
    await settled(page);
    await page.evaluate(() => { window.__health.cfg.authorized = ["steps", "calories", "heartRate", "restingHeartRate", "weight"]; });
    await page.evaluate(() => GymWatch.refresh());
    await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem("etqwatch_week")).days.map((d) => d.sleepMin))).every((x) => x == null)).toBe(true);
    const days = await page.evaluate(() => JSON.parse(localStorage.getItem("etqwatch_week")).days);
    expect(days.map((d) => d.steps)).toEqual([4200, 6100, 8800, 3000, 9120, 7400, 8214]);
    await context.close();
  });
});

test.describe("RTL and themes", () => {
  for (const theme of ["dark", "light"]) {
    test(`Arabic, ${theme}: mirrored dial and chart, Latin numerals, no horizontal scroll`, async ({ browser }) => {
      const { context, page, consoleErrors } = await connected(browser, { lang: "ar", theme });
      expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir, document.documentElement.dataset.theme])).toEqual(["ar", "rtl", theme]);
      await settled(page);
      await expect(page.locator("#screen-watch h1")).toHaveText("ساعتي");
      await expect(page.locator(".wt-head .wt-title")).toHaveText("اليوم");
      await expect(leg(page, "steps")).toContainText("8,214");
      await expect(leg(page, "steps")).toContainText("103% من 8,000");
      // the arcs run counter-clockwise: scaleY(-1) after the 12 o'clock rotation
      const tf = await page.locator(".wt-arc-steps").evaluate((n) => getComputedStyle(n).transform);
      expect(tf).toBe("matrix(0, -1, -1, 0, 0, 0)");
      // oldest day on the right, today on the left
      const a = await page.locator(".wt-hit").nth(0).boundingBox();
      const z = await page.locator(".wt-hit").nth(6).boundingBox();
      expect(a.x).toBeGreaterThan(z.x);
      await page.click("#wtTab-hr");
      const dots = await page.locator(".wt-dot").evaluateAll((d) => d.map((x) => x.getBoundingClientRect().x));
      expect(dots[0]).toBeGreaterThan(dots[6]);
      await expect(page.locator(".wt-sum")).toContainText("متوسط نبض الراحة");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(consoleErrors).toEqual([]);
      await context.close();
    });
  }

  test("tap targets: refresh, tabs, days, Connect and the Plan link are at least 44px", async ({ browser }) => {
    const { context, page } = await connected(browser);
    await settled(page);
    for (const sel of ["#wtRefresh", "#wtTab-steps", "#wtTab-hr", ".wt-hit", "#wtOpenHc", "#wtDisc"]) {
      const b = await page.locator(sel).first().boundingBox();
      expect(b.height, sel).toBeGreaterThanOrEqual(43.5);
      expect(b.width, sel).toBeGreaterThanOrEqual(43.5);
    }
    await context.close();
  });
});

test.describe("motion", () => {
  test("the entrance counts up from 0 and lands on the exact values, rings capped at a full turn", async ({ browser }) => {
    const { context, page } = await connected(browser);
    await page.waitForFunction(() => document.querySelector("#wtDial"));
    const start = await page.locator(".wt-c-n").textContent();
    expect(start).not.toBe("8,214");
    await page.clock.runFor(2500);
    await expect(page.locator(".wt-c-n")).toHaveText("8,214");
    expect(Number(await page.locator(".wt-arc-steps").getAttribute("stroke-dashoffset"))).toBe(0);
    expect(Number(await page.locator(".wt-arc-kcal").getAttribute("stroke-dashoffset"))).toBeCloseTo(100 - 82.4, 0);
    await context.close();
  });

  test("a second visit within the session does not replay it", async ({ browser }) => {
    const { context, page } = await connected(browser);
    await settled(page);
    await page.evaluate(() => GymUI.navigate("plan", { instant: true }));
    await goWatch(page);
    await expect(page.locator(".wt-c-n")).toHaveText("8,214");
    expect(Number(await page.locator(".wt-arc-steps").getAttribute("stroke-dashoffset"))).toBe(0);
    await expect(page.locator(".wt-bar.wt-grow")).toHaveCount(0);
    await context.close();
  });

  test("reduced motion (OS): final values at once, no running animation anywhere on the screen", async ({ browser }) => {
    const { context, page } = await connected(browser, { contextOptions: { reducedMotion: "reduce" } });
    await expect(page.locator(".wt-c-n")).toHaveText("8,214");
    expect(Number(await page.locator(".wt-arc-steps").getAttribute("stroke-dashoffset"))).toBe(0);
    const anims = await page.evaluate(() => [...document.querySelectorAll("#screen-watch *")].filter((n) => { const a = getComputedStyle(n).animationName; return a && a !== "none"; }).length);
    expect(anims).toBe(0);
    await expect(page.locator("#watchBody")).not.toHaveClass(/wt-live/);
    await context.close();
  });

  test("reduced motion (in-app 'Remove animations') does the same", async ({ browser }) => {
    const app = await openApp(browser, { signedIn: false, viewport: { width: 360, height: 780 } });
    const { page } = app;
    await page.evaluate(() => { document.documentElement.setAttribute("data-reduce-motion", "1"); localStorage.setItem("etqwatch_on", "1"); });
    await stubHealth(page, { health: { data: WEEK_DATA } });
    await goWatch(page);
    await expect(page.locator(".wt-c-n")).toHaveText("8,214");
    const anims = await page.evaluate(() => [...document.querySelectorAll("#screen-watch *")].filter((n) => { const a = getComputedStyle(n).animationName; return a && a !== "none"; }).length);
    expect(anims).toBe(0);
    await app.context.close();
  });

  test("the heart beats only while the screen is on show and the page visible", async ({ browser }) => {
    const { context, page } = await connected(browser);
    await settled(page);
    await expect(page.locator("#watchBody")).toHaveClass(/wt-live/);
    const name = await page.locator(".wt-stat .wt-ic").first().evaluate((n) => getComputedStyle(n).animationName);
    expect(name).toBe("wt-beat");
    await page.evaluate(() => GymUI.navigate("plan", { instant: true }));
    await expect(page.locator("#watchBody")).not.toHaveClass(/wt-live/);
    await context.close();
  });
});

test("data stays fresh: the screen repaints when a refresh brings new values", async ({ browser }) => {
  const { context, page } = await connected(browser);
  await settled(page);
  await page.evaluate(() => { window.__health.cfg.data = Object.assign({}, window.__health.cfg.data, { steps: 9500 }); });
  await page.evaluate(() => GymWatch.refresh());
  await page.clock.runFor(1500);
  await expect(leg(page, "steps")).toContainText("9,500");
  await expect(page.locator(".wt-c-n")).toHaveText("9,500");
  await context.close();
});
