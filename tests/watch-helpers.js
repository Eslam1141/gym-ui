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
        return { readAuthorized: a.read.filter((t) => cfg.authorized.includes(t)), readDenied: a.read.filter((t) => !cfg.authorized.includes(t)) };
      },
      requestAuthorization: async (a) => {
        rec("requestAuthorization", a);
        cfg.authorized = a.read.filter((t) => cfg.grantOnRequest.includes(t));
        return { readAuthorized: cfg.authorized.slice(), readDenied: a.read.filter((t) => !cfg.authorized.includes(t)) };
      },
      queryAggregated: async (a) => {
        rec("queryAggregated", a);
        if (cfg.rejectReads) throw new Error("read failed");
        const v = a.dataType === "steps" ? cfg.data.steps : a.dataType === "calories" ? cfg.data.calories : cfg.data.avgHr;
        return { samples: v == null ? [] : [{ startDate: a.startDate, endDate: a.endDate, value: v, unit: "count" }] };
      },
      readSamples: async (a) => {
        rec("readSamples", a);
        if (cfg.rejectReads) throw new Error("read failed");
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
  await page.evaluate(() => window.GymWatch.init());
}

const callsOf = (page, name) => page.evaluate((n) => window.__health.calls.filter((c) => c.name === n), name);
const lsGet = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);

module.exports = { stubHealth, callsOf, lsGet, DEFAULT_DATA };
