# Watch compatibility (Health Connect)

Etqadem does not talk to watches. The Android app reads **Health Connect** (read-only: steps, active
calories, heart rate, resting heart rate, sleep, weight). A watch works if its own phone app writes those
record types into Health Connect. Health Connect is built in on Android 14+ and is a Play Store app on
Android 9-13; below Android 9 the feature is hidden (the APK itself installs from Android 8 / API 26).

Last checked: 2026-10-21. Nothing below has been tested with a real watch.

## Status legend

- **Verified**: tested by us. Today the only verified setup is the **Android 15 (API 35) emulator with
  seeded test records** written through the plugin in a debug build. It proves our read path
  (permission sheet, `readSamples`, `queryAggregated`, denial error), not any vendor's sync.
- **Expected**: the vendor says (or credible reporting says) its app writes to Health Connect, but we have
  not seen it work with our app.
- **Unconfirmed / no**: we could not find a current vendor statement.

## Brands

| Brand / watch | Verified? | What the vendor app writes to Health Connect | Notes |
|---|---|---|---|
| Emulator, seeded data (Android 15, Google Play image) | **Yes (2026-10-21)** | steps, active calories, heart rate, resting HR, sleep session, weight (written by our debug build) | Proves the six read types, aggregates and the denial error. Sleep had no stage data. |
| Samsung Galaxy Watch (Samsung Health) | Expected | Steps, exercise, heart rate and sleep ([Samsung developer docs](https://developer.samsung.com/health/blog/accessing-samsung-health-data-through-health-connect)); Samsung Health 6.22.5+ | Continuous watch heart rate reaches the phone with a delay to save battery; manual measurements sync at once. The user must grant Health Connect permissions in Samsung Health settings. Community reports of missing records ([forum](https://forum.developer.samsung.com/t/syncing-data-is-unreliable-between-samsung-health-and-health-connect/24850)). |
| Fitbit, Pixel Watch (Fitbit app) | Expected | The Fitbit app has a Health Connect setting with per-metric control ([9to5Google](https://9to5google.com/2024/04/02/fitbit-app-health-connect-2/)); Google's [Fitbit help](https://support.google.com/fitbit/answer/14506680) says some data types need a Google Account. No official full type list found. | A third-party list (not official) says steps, heart rate, sleep, SpO2, calories. Data appears only after the watch syncs to the Fitbit app. |
| Google Fit | No new data | Google Fit has been replaced by Health Connect / Fitbit ([Oura notes the same](https://support.ouraring.com/hc/en-us/articles/10786105824531)). | Do not list as a source. |
| Garmin (Garmin Connect) | Expected | Reporting says activity (calories, distance, heart rate, steps, speed) and wellness (weight, body fat, floors, sleep stages) ([Wearify](https://thewearify.com/garmin-unveils-google-health-connect-support-for-its-smartwatches/)); secondary sources disagree on the list and on a minimum of Android 14. Garmin's own support page not found. | One-way (Garmin to Health Connect). Check Garmin's own page before promising anything. |
| Zepp / Amazfit (Zepp app) | Expected | Heart rate, sleep, weight, blood pressure etc., selectable under Profile > 3rd-party account linking > Health Connect ([Notebookcheck](https://www.notebookcheck.net/Amazfit-smartwatches-get-new-Health-Connect-data-sync-feature.951489.0.html)) | Write-only. Early users reported heart-rate problems. Older models (Bip 3, GTR 3, GTS 2) reportedly unsupported ([FitMesh, vendor claim](https://www.fitmesh.fit/fr/sync/amazfit-zepp)). |
| Xiaomi Mi Band / Watch (Mi Fitness) | Expected | Steps, heart rate, sleep, calories per a third-party source ([FitMesh](https://www.fitmesh.fit/tr/sync/xiaomi-mi-band)); Xiaomi's [Smart Band 9 FAQ](https://www.mi.com/global/support/faq/details/KA-230357/) only confirms third-party data sync exists. | Needs a Mi Fitness version with Health Connect; setting is under Mi Fitness settings > Health Connect ([HeiaHeia](https://support.heiaheia.com/connecting-xiaomi-to-heiaheia)). Exact types: unconfirmed by Xiaomi. |
| Huawei (Huawei Health) | Unconfirmed / probably no | Sources conflict; one vendor page says Huawei Health does not write to Health Connect ([FitMesh](https://www.fitmesh.fit/en/blog/huawei-health-health-connect-sync)). | Treat as unsupported. Huawei phones without Google services also lack Health Connect. |
| Oura Ring (Oura app) | Expected | Heart rate, HRV, height, weight, sleep (times, duration, stages, night RHR), steps, distance, calories, workouts ([Oura support](https://support.ouraring.com/hc/en-us/articles/10786105824531), [Oura blog](https://ouraring.com/blog/data-sharing-partner-integrations/)) | Two-way; the user chooses data under Settings > Data Sharing > Health Connect. A ring, not a watch. |
| Withings (Withings app, formerly Health Mate) | Expected | Integrated Health Connect in 2023 ([Android Developers Blog](https://android-developers.googleblog.com/2023/03/withings-reduces-data-sync-code-with--health-and-fitness-api-health-connect.html)); exact types written not checked. | Scales (weight) and watches. |
| Polar (Flow app) | Expected | Exercise sessions, workout heart rate, sleep with stages, steps, calories ([Polar support](https://support.polar.com/en/flow-app-health-connect)) | Enable in Flow app > General settings. |
| Coros | Unconfirmed | Not found in current vendor docs. | Do not claim. |
| Whoop | Unconfirmed | Not found in current vendor docs. | Do not claim. |

## Cross-vendor caveats

- A vendor only writes what the user has allowed in the vendor app **and** only after the watch has synced to
  the phone. "No data yet" is common right after pairing.
- Data from different vendors can overlap (two sources for steps). Health Connect de-duplicates aggregates by
  its own priority list; individual `readSamples` rows do not.
- `readSamples` rows carry `sourceName` / `sourceId` (the package name when the vendor gives no device name)
  and, on Android, `deviceType` when Health Connect reports one.
- Only the last 30 days are readable (we do not request the history permission).
- Re-test per brand on a real device before listing it as verified in the app, the Play listing or the
  privacy policy.
