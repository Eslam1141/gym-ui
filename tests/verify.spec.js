const { test, expect } = require("@playwright/test");
const { openApp, TODAY, DAY_ID, EX_IDS } = require("./helpers");

test.setTimeout(45000);
const T0 = Date.parse("2026-10-02T07:00:00Z");

async function open(browser) {
  const app = await openApp(browser, { signedIn: true });
  await app.page.waitForFunction(() => window.GymVerify && window.GymApp && GymApp.dayExercises);
  return app;
}

test.describe("GymVerify rules", () => {
  test("first tick accepted and starts timer", async ({ browser }) => {
    const { context, page } = await open(browser);
    const r = await page.evaluate(([d, id, ms]) => {
      const ok = GymVerify.tryTick(d, id, "mua_bench", 0, ms);
      return { ok, start: GymVerify.timerStart(d, id), has: GymVerify.hasTicks(d, id) };
    }, [TODAY, DAY_ID, T0]);
    expect(r.ok).toEqual({ ok: true });
    expect(r.start).toBe(T0);
    expect(r.has).toBe(true);
    await context.close();
  });

  test("second tick at +59s refused with waitSec 1, at +60s accepted", async ({ browser }) => {
    const { context, page } = await open(browser);
    const r = await page.evaluate(([d, id, ms]) => [
      GymVerify.tryTick(d, id, "mua_bench", 0, ms),
      GymVerify.tryTick(d, id, "mua_bench", 1, ms + 59000),
      GymVerify.tryTick(d, id, "mua_bench", 1, ms + 60000)
    ], [TODAY, DAY_ID, T0]);
    expect(r).toEqual([{ ok: true }, { ok: false, waitSec: 1 }, { ok: true }]);
    await context.close();
  });

  test("untick keeps reference", async ({ browser }) => {
    const { context, page } = await open(browser);
    const r = await page.evaluate(([d, id, ms]) => {
      GymVerify.tryTick(d, id, "mua_bench", 0, ms);
      GymVerify.untick(d, id, "mua_bench", 0);
      return GymVerify.tryTick(d, id, "mua_bench", 0, ms + 30000);
    }, [TODAY, DAY_ID, T0]);
    expect(r).toEqual({ ok: false, waitSec: 30 });
    await context.close();
  });

  test("refused tick does not move reference", async ({ browser }) => {
    const { context, page } = await open(browser);
    const r = await page.evaluate(([d, id, ms]) => {
      GymVerify.tryTick(d, id, "mua_bench", 0, ms);
      GymVerify.tryTick(d, id, "mua_bench", 1, ms + 50000); // refused
      return GymVerify.tryTick(d, id, "mua_bench", 1, ms + 60000);
    }, [TODAY, DAY_ID, T0]);
    expect(r).toEqual({ ok: true });
    await context.close();
  });

  test("clock moved back refuses", async ({ browser }) => {
    const { context, page } = await open(browser);
    const r = await page.evaluate(([d, id, ms]) => {
      GymVerify.tryTick(d, id, "mua_bench", 0, ms);
      const back = GymVerify.tryTick(d, id, "mua_bench", 1, ms - 120000);
      return [back, GymVerify.tryTick(d, id, "mua_bench", 1, ms + 60000)];
    }, [TODAY, DAY_ID, T0]);
    expect(r[0].ok).toBe(false);
    expect(r[1]).toEqual({ ok: true });
    await context.close();
  });

  test("planOf", async ({ browser }) => {
    const { context, page } = await open(browser);
    const r = await page.evaluate(() => ["sp4gm_a", "sp3hf_b", "m_upper", "m_upperA", "f_lowerA", "mc_push", "fc_legs", "custom_123", "coach_0", "preview"].map(GymVerify.planOf));
    // gym splits, home splits, then every built-in family; coach/AI/custom/preview have no marker
    expect(r).toEqual(["gym", "home", "gym", "gym", "gym", "home", "home", "", "", ""]);
    expect(await page.evaluate(() => [GymVerify.minSeconds("gym"), GymVerify.minSeconds("home"), GymVerify.minSeconds("")])).toEqual([3000, 1800, 1800]);
    await context.close();
  });

  test("evidence lists every set", async ({ browser }) => {
    const { context, page } = await open(browser);
    const ev = await page.evaluate(([d, id, ms]) => {
      GymVerify.tryTick(d, id, "mua_bench", 0, ms);
      return GymVerify.evidence(d, id, "live");
    }, [TODAY, DAY_ID, T0]);
    expect(ev.v).toBe(1);
    expect(ev.kind).toBe("live");
    expect(ev.plan).toBe("gym");
    expect(ev.timerStart).toBe(new Date(T0).toISOString());
    // m_upper: bench 4, pulldown 4, ohp 3, row 4, lateral 3, face pull 3
    expect(ev.sets).toHaveLength(21);
    expect(ev.sets[0]).toEqual({ ex: "mua_bench", set: 0, at: new Date(T0).toISOString() });
    expect(ev.sets[1].at).toBeNull();
    expect(new Set(ev.sets.map((s) => s.ex))).toEqual(new Set(EX_IDS));
    await context.close();
  });

  test("judge matches server cases", async ({ browser }) => {
    const { context, page } = await open(browser);
    const r = await page.evaluate((base) => {
      const iso = (min, sec) => new Date(base + (min * 60 + (sec || 0)) * 1000).toISOString();
      const ev = (plan, mins, extra) => Object.assign({
        v: 1, kind: "live", plan, timerStart: iso(0),
        sets: mins.map((m, i) => ({ ex: "a", set: i, at: m == null ? null : iso(m) }))
      }, extra || {});
      return {
        verified: GymVerify.judge(ev("gym", [20, 35, 51])),
        shortGym: GymVerify.judge(ev("gym", [20, 35, 49.99])),
        homeOk: GymVerify.judge(ev("home", [20, 35, 49.99])),
        none30: GymVerify.judge(ev("", [10, 30])),
        none29: GymVerify.judge(ev("", [10, 29])),
        gap: GymVerify.judge(ev("home", [31, 31.98])),
        missing: GymVerify.judge(ev("gym", [20, null, 51])),
        beforeTimer: GymVerify.judge(ev("home", [-1, 31])),
        yday: GymVerify.judge(ev("gym", [20, 35, 51], { kind: "save_yesterday" }))
      };
    }, T0);
    expect(r.verified).toEqual({ state: "verified", reasons: [] });
    expect(r.shortGym).toEqual({ state: "flagged", reasons: ["short_duration"] });
    expect(r.homeOk.state).toBe("verified");
    expect(r.none30.state).toBe("verified");
    expect(r.none29).toEqual({ state: "flagged", reasons: ["short_duration"] });
    expect(r.gap.state).toBe("pending");
    expect(r.gap.reasons).toContain("gap_too_short");
    expect(r.missing).toEqual({ state: "pending", reasons: ["missing_sets"] });
    expect(r.beforeTimer.reasons).toContain("tick_before_timer");
    expect(r.yday.state).toBe("pending");
    expect(r.yday.reasons[0]).toBe("save_yesterday");
    await context.close();
  });
});
