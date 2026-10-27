// ads.js gating (ads plan FE-1): nothing touches the ad bridge unless the shell has it,
// the server switch is on and consent allows ads. isPremium() is a stub.
const { test, expect } = require("@playwright/test");
const { openAdsApp, calls } = require("./ads-helpers");

test.setTimeout(60000);

test.describe("ads gating", () => {
  test("app-config getters: off by default, sub-flags need the master switch", async ({ browser }) => {
    const { context, page } = await openAdsApp(browser, { config: null, ads: false });
    expect(await page.evaluate(() => [GymAppConfig.adsEnabled(), GymAppConfig.bannersEnabled(), GymAppConfig.rewardedEnabled(), GymAppConfig.admobUnits()]))
      .toEqual([false, false, false, { banner: "", rewarded: "" }]);
    await context.close();
    const on = await openAdsApp(browser, { config: { bannersEnabled: false }, ads: false });
    expect(await on.page.evaluate(() => [GymAppConfig.adsEnabled(), GymAppConfig.bannersEnabled(), GymAppConfig.rewardedEnabled(), GymAppConfig.admobUnits()]))
      .toEqual([true, false, true, { banner: "ca-app-pub-test/banner", rewarded: "ca-app-pub-test/rewarded" }]);
    await on.context.close();
    const noMaster = await openAdsApp(browser, { config: { adsEnabled: false }, ads: false });
    expect(await noMaster.page.evaluate(() => [GymAppConfig.bannersEnabled(), GymAppConfig.rewardedEnabled()])).toEqual([false, false]);
    await noMaster.context.close();
  });

  test("no bridge (web or old shell): no ads calls, canShowAds false, isPremium stub", async ({ browser }) => {
    const { context, page, consoleErrors } = await openAdsApp(browser, { ads: false });
    const r = await page.evaluate(async () => {
      await GymAds.start();
      return { can: GymAds.canShowAds(), premium: GymAds.isPremium(), hasAds: !!(window.GymNativeShell && window.GymNativeShell.ads) };
    });
    expect(r).toEqual({ can: false, premium: false, hasAds: false });
    expect(consoleErrors).toEqual([]);
    await context.close();
  });

  test("adsEnabled false: init() is never called", async ({ browser }) => {
    const { context, page } = await openAdsApp(browser, { config: { adsEnabled: false } });
    expect(await calls(page)).toEqual([]);
    expect(await page.evaluate(() => GymAds.canShowAds())).toBe(false);
    await context.close();
  });

  test("ads on and consent granted: init once, canShowAds true", async ({ browser }) => {
    const { context, page } = await openAdsApp(browser, { ads: { start: true } });
    await page.evaluate(() => GymAds.start());
    expect(await calls(page)).toEqual(["init"]);
    expect(await page.evaluate(() => GymAds.canShowAds())).toBe(true);
    await context.close();
  });

  test("consent says no ads: no banner, no rewarded offer", async ({ browser }) => {
    const { context, page } = await openAdsApp(browser, { ads: { consent: { canRequestAds: false, privacyOptionsRequired: true } } });
    await page.evaluate(() => GymUI.navigate("food"));
    await expect.poll(() => calls(page)).toEqual(["init"]);
    expect(await page.evaluate(() => GymAds.canShowAds())).toBe(false);
    expect(await calls(page)).toEqual(["init"]);
    await context.close();
  });
});
