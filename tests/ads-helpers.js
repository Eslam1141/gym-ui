// Shared setup for the ads specs: app-config with the ad switches, a stubbed
// window.GymNativeShell.ads (the NA-1 bridge), and a route mock for /rewards/*.
const { openApp } = require("./helpers");

const UNITS = { admobBannerUnit: "ca-app-pub-test/banner", admobRewardedUnit: "ca-app-pub-test/rewarded" };

function adsConfig(over) {
  return Object.assign({ verifyStrict: false, adsEnabled: true, bannersEnabled: true, rewardedEnabled: true }, UNITS, over || {});
}

// opts: everything openApp takes, plus
//   config (app-config override, null = no ad fields), ads (stub behaviour, false = no bridge),
//   rewards (handlers for /rewards/*, see mockRewards)
async function openAdsApp(browser, opts) {
  opts = opts || {};
  const rewards = opts.rewards || {};
  const app = await openApp(browser, Object.assign({}, opts, {
    setup: async (context, server) => {
      const cfg = opts.config === null ? { verifyStrict: false } : adsConfig(opts.config);
      await context.route("**/api/v1/app-config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cfg) }));
      await mockRewards(context, server, rewards);
      if (opts.setup) await opts.setup(context, server);
    }
  }));
  if (opts.ads !== false) await installBridge(app.page, opts.ads || {});
  return app;
}

// Stand-in for the NA-1 bridge. a: { consent, bannerHeight, bannerReject, rewarded (result or fn name), calls }
async function installBridge(page, a) {
  await page.evaluate(async (a) => {
    const calls = (window.__adsCalls = []);
    const rec = (name, arg) => calls.push({ name, arg });
    const consent = a.consent || { canRequestAds: true, privacyOptionsRequired: false };
    window.GymNativeShell.ads = {
      available: () => true,
      init: () => { rec("init"); return Promise.resolve(consent); },
      showPrivacyOptions: () => { rec("showPrivacyOptions"); return Promise.resolve(); },
      showBanner: (o) => {
        rec("showBanner", o);
        return a.bannerReject ? Promise.reject(new Error("no_fill")) : Promise.resolve({ heightPx: a.bannerHeight || 50 });
      },
      hideBanner: () => { rec("hideBanner"); return Promise.resolve(); },
      showRewarded: (o) => { rec("showRewarded", o); return Promise.resolve(a.rewarded || { rewarded: true }); }
    };
    await window.GymAds.start();
  }, a);
}

// Route mock for the reward endpoints. h: { status (body), ticketStatus (409/503 or 201), polls (array of ticket statuses, last repeats) }
async function mockRewards(context, server, h) {
  server.rewardCalls = [];
  let polls = 0;
  await context.route("**/api/v1/rewards/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^.*\/api\/v1/, "");
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    server.rewardCalls.push({ method: req.method(), path, query: url.search, body: req.method() === "POST" ? JSON.parse(req.postData() || "{}") : null });
    if (path === "/rewards/status") {
      return json(200, h.status || { rewardedEnabled: true, coachVideosLeftToday: 2, streakSave: { eligible: false, date: "2026-10-01", reason: "no_streak" } });
    }
    if (path === "/rewards/ticket" && req.method() === "POST") {
      if (h.ticketStatus && h.ticketStatus !== 201) return json(h.ticketStatus, h.ticketBody || { error: "limit_reached" });
      if (h.onTicket) h.onTicket(server);
      return json(201, { ticketId: "tk1", kind: JSON.parse(req.postData() || "{}").kind, expiresAt: "2026-10-02T08:00:00Z", ssvUserId: "u1" });
    }
    if (path.startsWith("/rewards/ticket/")) {
      const seq = h.polls || [{ status: "granted", messages: 3 }];
      const r = seq[Math.min(polls++, seq.length - 1)];
      return json(200, Object.assign({ kind: "coach_messages" }, typeof r === "string" ? { status: r } : r));
    }
    return json(404, { error: { code: "not_found", message: "mock" } });
  });
}

const calls = (page) => page.evaluate(() => window.__adsCalls.map((c) => c.name));

module.exports = { openAdsApp, installBridge, adsConfig, calls, UNITS };
