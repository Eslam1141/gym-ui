// window.GymNativeShell.ads (native-shell.js): the contract ads.js codes against, with a stubbed
// window.Capacitor.Plugins.AdMob. Covers availability, UMP/init, banner, rewarded, test units.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(45000);

const TEST_BANNER = "ca-app-pub-3940256099942544/9214589741";
const TEST_REWARDED = "ca-app-pub-3940256099942544/5224354917";

// o.consent: object returned by requestConsentInfo / showConsentForm; o.banner: "load"|"fail"|"never";
// o.rewarded: "reward"|"dismiss"|"loadfail"|"showfail"|"never"
async function mockAdMob(page, o) {
  await page.evaluate((o) => {
    const L = {};
    const calls = (window.__ads = { order: [], initialize: 0, requestConsentInfo: 0, showConsentForm: 0, privacy: 0, removed: 0, showBanner: [], prepare: [], show: [], listeners: 0, removedListeners: 0 });
    const fire = (name, data) => setTimeout(() => (L[name] || []).slice().forEach((f) => f(data)), 5);
    const AdMob = {
      initialize: async () => { calls.initialize++; calls.order.push("initialize"); if (o.initFails) throw new Error("x"); },
      requestConsentInfo: async () => { calls.requestConsentInfo++; calls.order.push("requestConsentInfo"); return o.consent; },
      showConsentForm: async () => { calls.showConsentForm++; calls.order.push("showConsentForm"); return o.afterForm || o.consent; },
      showPrivacyOptionsForm: async () => { calls.privacy++; },
      addListener: async (name, cb) => {
        calls.listeners++;
        (L[name] = L[name] || []).push(cb);
        return { remove: async () => { calls.removedListeners++; L[name] = L[name].filter((f) => f !== cb); } };
      },
      removeBanner: async () => { calls.removed++; },
      showBanner: async (opts) => {
        calls.showBanner.push(opts);
        if (o.banner === "load") { fire("bannerAdSizeChanged", { width: 360, height: 50 }); fire("bannerAdLoaded", {}); }
        if (o.banner === "fail") fire("bannerAdFailedToLoad", { code: 3, message: "no fill" });
      },
      prepareRewardVideoAd: async (opts) => {
        calls.prepare.push(opts);
        if (o.rewarded === "loadfail") { fire("onRewardedVideoAdFailedToLoad", { code: 3 }); return new Promise(() => {}); }
        return { adUnitId: opts.adId };
      },
      showRewardVideoAd: async (opts) => {
        calls.show.push(opts);
        if (o.rewarded === "reward") { fire("onRewardedVideoAdReward", { type: "x", amount: 1 }); setTimeout(() => fire("onRewardedVideoAdDismissed"), 20); }
        if (o.rewarded === "dismiss") fire("onRewardedVideoAdDismissed");
        if (o.rewarded === "showfail") fire("onRewardedVideoAdFailedToShow", { code: 0 });
        return new Promise(() => {});   // like the plugin: settles only on a reward
      }
    };
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", Plugins: { AdMob } };
    window.GymNativeShell.init();
  }, o);
}

const OBTAINED = { status: "OBTAINED", canRequestAds: true, isConsentFormAvailable: true, privacyOptionsRequirementStatus: "REQUIRED" };
const open = () => ({ signedIn: false });

test("no AdMob plugin (web or old shell): ads is absent and nothing throws", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  expect(await page.evaluate(() => window.GymNativeShell.ads)).toBeUndefined();
  await page.evaluate(() => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", Plugins: {} };
    window.GymNativeShell.init();
  });
  expect(await page.evaluate(() => window.GymNativeShell.ads)).toBeUndefined();
  await context.close();
});

test("plugin present: available() true; init() is idempotent and reports consent + privacy options", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  await mockAdMob(page, { consent: OBTAINED });
  expect(await page.evaluate(() => window.GymNativeShell.ads.available())).toBe(true);
  const r = await page.evaluate(async () => {
    const a = window.GymNativeShell.ads;
    const p1 = a.init(), p2 = a.init();
    return { same: p1 === p2, r1: await p1, r2: await p2 };
  });
  expect(r.same).toBe(true);
  expect(r.r1).toEqual({ canRequestAds: true, privacyOptionsRequired: true });
  const c = await page.evaluate(() => window.__ads);
  expect([c.initialize, c.requestConsentInfo, c.showConsentForm]).toEqual([1, 1, 0]);
  await context.close();
});

test("init(): consent REQUIRED shows the UMP form and reports the post-form state", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  await mockAdMob(page, {
    consent: { status: "REQUIRED", canRequestAds: false, isConsentFormAvailable: true, privacyOptionsRequirementStatus: "UNKNOWN" },
    afterForm: { status: "OBTAINED", canRequestAds: true, privacyOptionsRequirementStatus: "REQUIRED" }
  });
  expect(await page.evaluate(() => window.GymNativeShell.ads.init())).toEqual({ canRequestAds: true, privacyOptionsRequired: true });
  expect(await page.evaluate(() => window.__ads.showConsentForm)).toBe(1);
  await context.close();
});

test("init(): initialize runs only after consent, and not at all when ads cannot be requested", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  await mockAdMob(page, {
    consent: { status: "REQUIRED", canRequestAds: false, isConsentFormAvailable: true, privacyOptionsRequirementStatus: "UNKNOWN" },
    afterForm: { status: "OBTAINED", canRequestAds: true, privacyOptionsRequirementStatus: "REQUIRED" }
  });
  expect(await page.evaluate(() => window.GymNativeShell.ads.init())).toEqual({ canRequestAds: true, privacyOptionsRequired: true });
  expect(await page.evaluate(() => window.__ads.order)).toEqual(["requestConsentInfo", "showConsentForm", "initialize"]);
  await context.close();
});

test("init(): consent refused (canRequestAds false) never initializes AdMob", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  await mockAdMob(page, {
    consent: { status: "REQUIRED", canRequestAds: false, isConsentFormAvailable: true, privacyOptionsRequirementStatus: "REQUIRED" },
    afterForm: { status: "REQUIRED", canRequestAds: false, privacyOptionsRequirementStatus: "REQUIRED" }
  });
  expect(await page.evaluate(() => window.GymNativeShell.ads.init())).toEqual({ canRequestAds: false, privacyOptionsRequired: true });
  const c = await page.evaluate(() => window.__ads);
  expect(c.initialize).toBe(0);
  expect(c.order).toEqual(["requestConsentInfo", "showConsentForm"]);
  await context.close();
});

test("init(): consent not required skips the form; canRequestAds false is passed through", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  await mockAdMob(page, { consent: { status: "NOT_REQUIRED", canRequestAds: true, privacyOptionsRequirementStatus: "NOT_REQUIRED" } });
  expect(await page.evaluate(() => window.GymNativeShell.ads.init())).toEqual({ canRequestAds: true, privacyOptionsRequired: false });
  expect(await page.evaluate(() => window.__ads.showConsentForm)).toBe(0);
  await context.close();
});

test("init() never rejects: plugin errors resolve to canRequestAds false", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  await mockAdMob(page, { consent: OBTAINED, initFails: true });
  expect(await page.evaluate(() => window.GymNativeShell.ads.init())).toEqual({ canRequestAds: false, privacyOptionsRequired: false });
  await context.close();
});

test("showPrivacyOptions opens the UMP privacy form and never rejects", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  await mockAdMob(page, { consent: OBTAINED });
  await page.evaluate(() => window.GymNativeShell.ads.showPrivacyOptions());
  expect(await page.evaluate(() => window.__ads.privacy)).toBe(1);
  await context.close();
});

test("showBanner: adaptive, bottom, margin, resolves {heightPx} on load and cleans up listeners", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  await mockAdMob(page, { consent: OBTAINED, banner: "load" });
  const r = await page.evaluate(() => window.GymNativeShell.ads.showBanner({ adUnitId: "ca-app-pub-1/2", marginPx: 64 }));
  expect(r).toEqual({ heightPx: 50 });
  const c = await page.evaluate(() => window.__ads);
  expect(c.showBanner).toHaveLength(1);
  expect(c.showBanner[0]).toMatchObject({ adId: "ca-app-pub-1/2", adSize: "ADAPTIVE_BANNER", position: "BOTTOM_CENTER", margin: 64 });
  expect(c.removedListeners).toBe(c.listeners);
  await context.close();
});

test("showBanner: no fill rejects and removes the half-made banner", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  await mockAdMob(page, { consent: OBTAINED, banner: "fail" });
  const msg = await page.evaluate(() => window.GymNativeShell.ads.showBanner({ adUnitId: "u", marginPx: 0 }).then(() => "ok", (e) => e.message));
  expect(msg).toBe("no_fill");
  expect(await page.evaluate(() => window.__ads.removed)).toBe(2);   // before the request + after the failure
  await context.close();
});

test("hideBanner is safe with no banner and calls removeBanner", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  await mockAdMob(page, { consent: OBTAINED });
  await page.evaluate(() => window.GymNativeShell.ads.hideBanner());
  expect(await page.evaluate(() => window.__ads.removed)).toBe(1);
  await context.close();
});

test("showRewarded: reward then dismiss resolves rewarded:true; ssv is passed to prepare", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  await mockAdMob(page, { consent: OBTAINED, rewarded: "reward" });
  const r = await page.evaluate(() => window.GymNativeShell.ads.showRewarded({ adUnitId: "ca-app-pub-1/3", customData: "tkt1", userId: "u1" }));
  expect(r).toEqual({ rewarded: true });
  const c = await page.evaluate(() => window.__ads);
  expect(c.prepare[0]).toMatchObject({ adId: "ca-app-pub-1/3", ssv: { customData: "tkt1", userId: "u1" } });
  expect(c.show).toHaveLength(1);
  expect(c.removedListeners).toBe(c.listeners);
  await context.close();
});

test("showRewarded: dismissal without reward maps to {rewarded:false, reason:'dismissed'}", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  await mockAdMob(page, { consent: OBTAINED, rewarded: "dismiss" });
  expect(await page.evaluate(() => window.GymNativeShell.ads.showRewarded({ adUnitId: "u", customData: "t", userId: "x" })))
    .toEqual({ rewarded: false, reason: "dismissed" });
  await context.close();
});

test("showRewarded: load failure -> no_fill, show failure -> error, never rejects", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  await mockAdMob(page, { consent: OBTAINED, rewarded: "loadfail" });
  expect(await page.evaluate(() => window.GymNativeShell.ads.showRewarded({ adUnitId: "u", customData: "t" })))
    .toEqual({ rewarded: false, reason: "no_fill" });
  await mockAdMob(page, { consent: OBTAINED, rewarded: "showfail" });
  expect(await page.evaluate(() => window.GymNativeShell.ads.showRewarded({ adUnitId: "u", customData: "t" })))
    .toEqual({ rewarded: false, reason: "error" });
  await context.close();
});

test("debug build (window.__etqDebug): always Google's test units, whatever id is passed", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  await page.addInitScript(() => { window.__etqDebug = true; });
  await page.reload();
  await page.waitForFunction(() => window.GymNativeShell);
  await mockAdMob(page, { consent: OBTAINED, banner: "load", rewarded: "reward" });
  await page.evaluate(async () => {
    await window.GymNativeShell.ads.showBanner({ adUnitId: "ca-app-pub-REAL/1", marginPx: 0 });
    await window.GymNativeShell.ads.showRewarded({ adUnitId: "ca-app-pub-REAL/2", customData: "t" });
  });
  const c = await page.evaluate(() => window.__ads);
  expect(c.showBanner[0].adId).toBe(TEST_BANNER);
  expect(c.prepare[0].adId).toBe(TEST_REWARDED);
  expect(c.show[0].adId).toBe(TEST_REWARDED);
  await context.close();
});

test("release build: the configured unit ids are used as given", async ({ browser }) => {
  const { context, page } = await openApp(browser, open());
  await mockAdMob(page, { consent: OBTAINED, banner: "load" });
  await page.evaluate(() => window.GymNativeShell.ads.showBanner({ adUnitId: "ca-app-pub-REAL/1", marginPx: 0 }));
  expect(await page.evaluate(() => window.__ads.showBanner[0].adId)).toBe("ca-app-pub-REAL/1");
  await context.close();
});
