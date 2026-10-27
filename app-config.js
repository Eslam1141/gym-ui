/* app-config.js - server-driven switches, fetched once at startup from the public
 * GET /app-config (see gym-be). Cached in localStorage so the last answer is used
 * straight away on the next launch and offline.
 *
 *   verifyStrict      false (the default) = every training day counts; the on-device
 *                     60 s gap and the held/review UI are off. Evidence is collected and
 *                     sent either way. true = verified training days are enforced.
 *   minAppVersion / latestAppVersion   read by force-update.js (the update-required page
 *                     and the update banner).
 *
 * A failed fetch with nothing cached means strict is off. */
(function () {
  "use strict";

  var LS_KEY = "gym_app_config";
  var API_BASE = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var TIMEOUT_MS = 6000;

  function clean(v) {
    var o = v && typeof v === "object" && !Array.isArray(v) ? v : {};
    var out = { verifyStrict: o.verifyStrict === true };
    if (typeof o.minAppVersion === "string") out.minAppVersion = o.minAppVersion;
    if (typeof o.latestAppVersion === "string") out.latestAppVersion = o.latestAppVersion;
    out.adsEnabled = o.adsEnabled === true;
    out.bannersEnabled = o.bannersEnabled === true;
    out.rewardedEnabled = o.rewardedEnabled === true;
    if (typeof o.admobBannerUnit === "string") out.admobBannerUnit = o.admobBannerUnit;
    if (typeof o.admobRewardedUnit === "string") out.admobRewardedUnit = o.admobRewardedUnit;
    return out;
  }

  var cfg;
  var fresh = false; // true once a fetch has succeeded in this page session
  try { cfg = clean(JSON.parse(localStorage.getItem(LS_KEY))); } catch (e) { cfg = clean(null); }

  function load() {
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT_MS);
    return fetch(API_BASE + "/app-config", { cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(function (res) { if (!res.ok) throw new Error("app-config " + res.status); return res.json(); })
      .then(function (doc) {
        cfg = clean(doc);
        fresh = true;
        try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch (e) {}
      })
      .catch(function () { /* keep the cached (or default) values */ })
      .then(function () { clearTimeout(timer); });
  }

  window.GymAppConfig = {
    strict: function () { return cfg.verifyStrict === true; },
    minAppVersion: function () { return cfg.minAppVersion || ""; },
    latestAppVersion: function () { return cfg.latestAppVersion || ""; },
    adsEnabled: function () { return cfg.adsEnabled === true; },
    bannersEnabled: function () { return cfg.adsEnabled === true && cfg.bannersEnabled === true; },
    rewardedEnabled: function () { return cfg.adsEnabled === true && cfg.rewardedEnabled === true; },
    admobUnits: function () { return { banner: cfg.admobBannerUnit || "", rewarded: cfg.admobRewardedUnit || "" }; },
    // A cached answer is fine for verifyStrict, but the version fields only count after a real fetch:
    // an offline old app must not be blocked by a stale cached minAppVersion.
    fresh: function () { return fresh; },
    refresh: load, // the same fetch again (force-update.js calls it on resume); never rejects
    ready: load() // resolves once the one startup fetch has settled (never rejects)
  };
})();
