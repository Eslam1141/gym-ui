// Shared by the watch-*.spec.js files: a fake native shell with a fake Health
// plugin (@capgo/capacitor-health), installed after load; GymWatch.init() then
// re-reads the gate. window.__health.calls records every plugin call.
const DEFAULT_DATA = {
  steps: 8214, calories: 412, avgHr: 71, rhr: 58,
  sleep: [{ value: 420, startDate: "2026-10-01T20:30:00Z", endDate: "2026-10-02T03:30:00Z" }],
  weight: 78.44
};

async function stubHealth(page, o) {
  o = o || {};
  const health = Object.assign({}, o.health || {});
  if (!("data" in health)) health.data = DEFAULT_DATA;
  await page.evaluate((o) => {
    const ALL = ["steps", "calories", "heartRate", "restingHeartRate", "sleep", "weight"];
    const cfg = Object.assign({
      hangReads: false, hangAuth: false,   // reads / the access check never answer (the loading states)
      available: true, platform: "android", reason: "",
      authorized: ALL.slice(), grantOnRequest: ALL.slice(), data: {}, rejectIsAvailable: false, rejectReads: false, rejectOpen: false
    }, o.health);
    const calls = [];
    window.__health = { calls, cfg };
    const rec = (name, arg) => calls.push({ name, arg });
    const Health = {
      isAvailable: async () => {
        rec("isAvailable");
        if (cfg.rejectIsAvailable) throw new Error("boom");
        return { available: cfg.available, platform: cfg.platform, reason: cfg.reason };
      },
      checkAuthorization: async (a) => {
        rec("checkAuthorization", a);
        if (cfg.hangAuth) return new Promise(() => {});
        return { readAuthorized: a.read.filter((t) => cfg.authorized.includes(t)), readDenied: a.read.filter((t) => !cfg.authorized.includes(t)) };
      },
      requestAuthorization: async (a) => {
        rec("requestAuthorization", a);
        cfg.authorized = a.read.filter((t) => cfg.grantOnRequest.includes(t));
        return { readAuthorized: cfg.authorized.slice(), readDenied: a.read.filter((t) => !cfg.authorized.includes(t)) };
      },
      queryAggregated: async (a) => {
        rec("queryAggregated", a);
        if (cfg.hangReads) return new Promise(() => {});
        if (cfg.rejectReads) throw new Error("read failed");
        const DAY = 86400000;
        const week = cfg.data.week;
        if (week && Date.parse(a.endDate) - Date.parse(a.startDate) > 30 * 3600 * 1000) {   // the 7-day read: one bucket per day, empty days omitted
          const arr = week[a.dataType === "steps" ? "steps" : "kcal"] || [];
          return { samples: arr.map((n, i) => n == null ? null : { startDate: new Date(Date.parse(a.startDate) + i * DAY).toISOString(), endDate: new Date(Date.parse(a.startDate) + (i + 1) * DAY).toISOString(), value: n, unit: "count" }).filter(Boolean) };
        }
        const v = a.dataType === "steps" ? cfg.data.steps : a.dataType === "calories" ? cfg.data.calories : cfg.data.avgHr;
        return { samples: v == null ? [] : [{ startDate: a.startDate, endDate: a.endDate, value: v, unit: "count" }] };
      },
      readSamples: async (a) => {
        rec("readSamples", a);
        if (cfg.hangReads) return new Promise(() => {});
        if (cfg.rejectReads) throw new Error("read failed");
        const week = cfg.data.week, HOUR = 3600000;
        if (week && a.limit === 200 && a.dataType === "sleep") {   // 7-day sleep: minutes per day, the session ends 07:00 local that day
          return { samples: (week.sleep || []).map((m, i) => m == null ? null : { value: m, startDate: new Date(Date.parse(a.startDate) + (6 + 24 * i) * HOUR).toISOString(), endDate: new Date(Date.parse(a.startDate) + (13 + 24 * i) * HOUR).toISOString() }).filter(Boolean) };
        }
        if (week && a.limit === 30 && a.dataType === "restingHeartRate") {   // newest first
          return { samples: (week.rhr || []).map((n, i) => n == null ? null : { dataType: a.dataType, value: n, unit: "bpm", startDate: new Date(Date.parse(a.startDate) + (8 + 24 * i) * HOUR).toISOString(), endDate: new Date(Date.parse(a.startDate) + (8 + 24 * i) * HOUR).toISOString() }).filter(Boolean).reverse() };
        }
        if (a.dataType === "sleep") return { samples: cfg.data.sleep || [] };
        const v = a.dataType === "restingHeartRate" ? cfg.data.rhr : cfg.data.weight;
        return { samples: v == null ? [] : [{ dataType: a.dataType, value: v, unit: "x", startDate: a.startDate, endDate: a.endDate }] };
      },
      openHealthConnectSettings: async () => { rec("openHealthConnectSettings"); if (cfg.rejectOpen) throw new Error("nope"); },
      showPrivacyPolicy: async () => { rec("showPrivacyPolicy"); }
    };
    const Plugins = o.noHealth ? {} : { Health };
    window.Capacitor = { isNativePlatform: () => o.native !== false, getPlatform: () => "android", Plugins };
  }, { noHealth: o.noHealth, native: o.native, health });
  // noWait: the reads never finish (hangReads / hangAuth), so don't wait for init()
  if (o.noWait) await page.evaluate(() => { window.GymWatch.init(); });
  else await page.evaluate(() => window.GymWatch.init());
}

// The Watch tab is where connecting and reading now live.
const goWatch = (page) => page.evaluate(() => GymUI.navigate("watch", { instant: true }));
const callsOf = (page, name) => page.evaluate((n) => window.__health.calls.filter((c) => c.name === n), name);
const lsGet = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);

// Seven days, oldest first (the last is today); null = the watch has nothing for that day.
const WEEK = {
  steps: [4200, 6100, 8800, 3000, 9120, 7400, 8214],
  kcal: [210, 340, 520, 150, 480, 390, 412],
  sleep: [400, 455, 380, 510, 430, null, 420],
  rhr: [60, 59, null, 58, 57, 58, 58]
};
const WEEK_DATA = Object.assign({}, DEFAULT_DATA, { week: WEEK });

module.exports = { stubHealth, callsOf, lsGet, goWatch, DEFAULT_DATA, WEEK, WEEK_DATA };
