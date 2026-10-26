# Force update — design

Date: 2026-10-26. Status: draft, waiting for owner approval.

## Intent (owner's words, paraphrased)

When a new feature ships and someone is still on an old version, **make them
update**. Never stop someone mid-workout: save their work, tell them to update,
and block only once the workout is over.

## Why this matters now

The Android app is a Capacitor shell that loads the PWA from
`https://etqadem.cloider.app/app/` (`native/capacitor.config.ts` `server.url`).
So there are two different kinds of "old version":

1. **Old web code.** The service worker is network-first (`service-worker.js`),
   so a fresh load already gets the new code. The gap is a session that stays
   open for days: Android keeps the WebView alive in the background, and a
   browser tab can stay open too. Those users keep running old JS until they
   reload.
2. **Old native shell (APK).** Features that need a new native plugin can't
   reach users until they install a new APK from Play. Ads are next on the
   roadmap (AdMob plugin), and billing and notifications are likely after that.

## Goals

- An APK older than the server's `minAppVersion` is blocked by an
  "Update required" screen until it is updated. The update happens through
  Google Play In-App Updates (immediate flow).
- An APK older than `latestAppVersion` (but not below the minimum) gets a
  dismissible "Update available" banner.
- A long-open web session picks up a new web deploy without the user doing
  anything, at a safe moment.
- **Never interrupt a workout in progress.** Progress is already saved on
  every tick. During a workout the app shows a non-blocking "Update required"
  bar instead. The full block appears when the workout ends (completed or
  abandoned) or on the next app open.

## Non-goals

- No minimum version for the web app itself. Web code is always current
  after a reload, so a reload is the fix.
- No iOS (there is no iOS shell).
- No changes to gym-be. `MIN_APP_VERSION` and `LATEST_APP_VERSION` are
  already served by `GET /api/v1/app-config` (gym-be#58, live) and read by
  `GymAppConfig.minAppVersion()` / `latestAppVersion()` (gym-ui#188, live).

## Anti-goals (failure even if it "works")

- Losing workout data, or blocking during a workout or a rest timer.
- Locking out users with no working update path. The Play flow fails for
  sideloaded or debug builds, Play Store missing, or no network. There must
  always be a fallback.
- Blocking a user because of a bad or missing config value. An empty or
  unparseable version, or a failed fetch, means **no block**.
- Blocking browser users (not the APK) because of `minAppVersion`. That
  value applies to the native shell only.
- A reload loop.

## Behaviour

### Version check (native shell only)

- Native version = `@capacitor/app` `App.getInfo().version` (the Gradle
  `versionName`, currently `1.0.8`). `native-shell.js` already reads it into
  `window.GYM_APP_VERSION`.
- Compare it as dotted numeric semver (`1.0.10 > 1.0.9`). A missing part
  counts as 0, and any non-numeric value means "unknown, don't block".
- Run the check after both `GymAppConfig.ready` and the version are known, and
  again on every resume (`visibilitychange` to visible, or the Capacitor
  `App` `resume` event). On resume, re-fetch app-config so a server change
  reaches open apps. This also gives the strict-mode switch the re-fetch it
  will need.

### When the APK is below `minAppVersion`

- **No workout in progress:** a full-screen "Update required" page appears
  above everything. It cannot be dismissed, and Android back does nothing.
  It shows:
  - the Etqadem logo
  - a title: "Update required" / "تحديث مطلوب"
  - one line: "A new version of Etqadem is ready. Update to keep training."
  - a primary **Update** button.
- **Workout in progress** (`activeSession` set, or a rest/exercise timer
  running): show a persistent, non-blocking bar: "Update required. Your
  workout is saved. Update when you finish." The block takes over when the
  session ends: on completion, on abandon/reset, or on the next app open.
- **Update button:** start the Google Play In-App Updates *immediate* flow.
  If it isn't available, or it fails or is cancelled, open the Play Store
  listing (`market://details?id=<appId>`, then the https fallback). The
  page stays up after a cancel.

### When the APK is below `latestAppVersion` (and not below the minimum)

- A small banner: "A new version is available" with **Update** and **✕**.
- Dismissing it hides it for that `latestAppVersion` value (remembered in
  localStorage), so it comes back for the next version.
- Update uses the same Play flow; the builder may pick *flexible* or
  *immediate* for this one.
- Never shown during a workout.

### Long-open web sessions

- On resume, and at most every 30 min while open, call
  `navigator.serviceWorker.getRegistration()` then `.update()`.
- When a new service worker takes control (`controllerchange`), or the
  deployed build differs from the running one, reload at a safe moment:
  no workout in progress, and the app was just resumed or the user is on the
  home screen. A guard stops repeated reloads (e.g. one reload per build per
  session, kept in sessionStorage).
- "Different build" detection is the builder's choice. One option is the
  service worker's `CACHE_NAME` hash, which changes on every deploy that
  touches an asset.

## Parts

| Part | Where | Who |
|---|---|---|
| `force-update.js` (version compare, block page, in-workout bar, banner, reload logic) and wiring (index.html, SW precache, Dockerfile COPY + hash) | gym-ui | frontend agent |
| EN/AR strings in the `T` table | gym-ui `app.js` | frontend agent |
| Google Play In-App Updates plugin, a JS bridge (e.g. `GymNative.startUpdate()`), Play Store fallback, `versionCode`/`versionName` bump, release build | gym-ui `native/` | android-developer agent |
| Release runbook: set `MIN_APP_VERSION` / `LATEST_APP_VERSION` in helm values after the new APK is live on Play | gym-be helm values comment + docs | me |

## Release order (important)

1. Ship the web part. It's harmless while `MIN_APP_VERSION` is empty.
2. Ship APK 1.0.9 (or later) with the update plugin to Play.
3. Only after that is live on Play, raise `MIN_APP_VERSION`.

**Known limitation:** APK 1.0.8 and older have no update plugin, so for them
**Update** falls back to opening the Play Store page. That works, just less
smoothly.

## Tests

- Playwright: version compare (including bad input); block page shown or not
  for each combination of min/latest/version/no-native; workout-in-progress
  shows the bar, then the block after finishing; banner dismissal per version;
  failed config means no block; Update calls the native bridge, and falls
  back when the bridge is missing; reload guard (no loop, no reload during a
  workout).
- Android: emulator test of the immediate flow, using Play's internal app
  sharing or FakeAppUpdateManager where possible, plus the sideloaded
  fallback path.

## Calls I made (owner, please check)

- `minAppVersion` applies to the APK only; browser users are never blocked.
- In-workout means an active session or a running rest/exercise timer.
- The "Update available" banner (latest) is included and dismissible per
  version.
- Web sessions auto-reload on resume or on the home screen, never during a
  workout.

## Settled after the builder check (my calls unless noted)

- **Play isn't live yet** (APKs are sideloaded or debug). So `MIN_APP_VERSION`
  stays empty until the Play listing is live and the new APK is at **100%
  rollout**. Play compares `versionCode`, not `versionName`, so a staged
  rollout would block users who haven't been offered the update yet. This
  goes in the helm comment and the release runbook. The code needs no
  "Play live" flag: the empty value is the switch.
- **Version numbers:** `versionName` and `versionCode` are always bumped
  together (`1.0.N` ↔ `N`). The server values use `versionName`.
- **No "continue anyway" on the block page** (owner: "make them update").
  Below **Update** it has a quieter **Check again** link that re-fetches
  app-config and the version and re-checks; this rescues a mistaken server
  value. If both Play paths fail, it shows the https Play URL as text.
- **Opening the Play Store from a 1.0.8 shell:** unverified. Capacitor
  normally hands non-allowed schemes (`market://`, https off-host) to Android
  as an intent. The android-developer must test this on 1.0.8 before the web
  part ships with any `MIN_APP_VERSION` set. If it doesn't work, 1.0.8 users
  get the text URL.
- **Workout in progress** = `activeSession` set **and** less than 6 h old,
  **or** a rest/exercise timer running. A paused session counts. An older
  `activeSession` is stale and doesn't hold off the block.
- **Auto-reload applies inside the APK too.** "Safe" means: no workout in
  progress, no open sheet/modal/dialog, no focused text input, and either just
  resumed or on the home screen.
- **Strict switch:** already merged (gym-ui#188), so build on main.
  `app-config.js` gains a `refresh()` (re-fetch, same cache rules) that this
  feature calls on resume.
- **Copy:** I write the EN and AR strings (MSA, like the neighbouring
  strings); the owner checks the Arabic later, alongside the existing Arabic
  review to-do.

## Left to the builder

- The plugin choice: e.g. `@capawesome/capacitor-app-update`. Verify
  Capacitor 8 support in its source/README before using it.
- Visual details of the page and banner, following the existing design system
  (DESIGN.md) and the frontend-design skill.
- How to detect a new web build.
