# Force Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block APKs older than the server's `minAppVersion` (never mid-workout), nudge APKs older than `latestAppVersion`, and auto-reload long-open web sessions onto the newest deploy.

**Architecture:** One new web module `force-update.js` (pure decision logic plus the UI). It reads `GymAppConfig` (server values), `window.GYM_APP_VERSION` (native shell version) and two new `GymApp` hooks for workout state. The native shell gains a Google Play In-App Updates bridge on `GymNativeShell`. No gym-be change.

**Tech Stack:** Vanilla JS PWA (IIFE modules on `window.Gym*`), Playwright tests in `tests/`, Capacitor 8 Android shell in `native/`.

**Spec:** `docs/superpowers/specs/2026-10-26-force-update-design.md` (approved 2026-10-26; read it first, including "Settled after the builder check").

## Global Constraints

- `minAppVersion` applies only when running in the native shell (`window.Capacitor` native platform). Browser users are never blocked.
- An empty or unparseable version, a missing native version, or a failed config fetch means **no block and no banner**.
- Never block during a workout. Workout in progress = `activeSession` set and `Date.now() - activeSession.startTime < 6 h`, **or** a rest/exercise timer running (`restEndAt > 0` or `exPhase !== ""`).
- The block page can't be dismissed; Android back does nothing while it's shown. It has **Update** and **Check again**.
- The banner is dismissible per `latestAppVersion` value (localStorage `gym_update_dismissed` = that version string) and never shows during a workout.
- Auto-reload: at most once per build per tab (sessionStorage guard), and only when it's safe: no workout, no open sheet/modal/dialog (`[role=dialog]:not([hidden])`, `.sheet.open` and the repo's equivalents), no focused input/textarea.
- Play Store fallback: `market://details?id=com.etqadem.app`, then `https://play.google.com/store/apps/details?id=com.etqadem.app` shown as text.
- New JS files go into index.html, the `service-worker.js` ASSETS list, and both Dockerfile lists (COPY + HASH), mirroring `app-config.js`.
- Strings go in the `T` table in `app.js` as `[en, ar]`, with MSA Arabic. Exact copy:
  - `fuTitle`: "Update required" / "تحديث مطلوب"
  - `fuBody`: "A new version of Etqadem is ready. Update to keep training." / "إصدار جديد من اتقدم جاهز. حدّث التطبيق لمتابعة التمرين."
  - `fuUpdate`: "Update" / "تحديث"
  - `fuCheck`: "Check again" / "تحقق مرة أخرى"
  - `fuStoreText`: "Open Google Play and update Etqadem:" / "افتح Google Play وحدّث اتقدم:"
  - `fuBar`: "Update required. Your workout is saved. Update when you finish." / "التحديث مطلوب. تمرينك محفوظ. حدّث التطبيق بعد أن تنتهي."
  - `fuBanner`: "A new version is available" / "يتوفر إصدار جديد"
- UI work invokes the frontend-design skill first and follows DESIGN.md (design system tokens, RTL, light and dark themes).

## Review Focus

1. **Native version arrives late:** `App.getInfo()` resolves after `GymAppConfig.ready`, so the check must re-run when the version arrives, not decide "no native" once. (Task 3 test: version set 500 ms after load still produces the block.)
2. **Server value lowered or cleared while blocked:** "Check again", or a resume re-fetch that returns an empty/lower `minAppVersion`, must remove the block. (Task 3 test.)
3. **Stale overnight session:** an `activeSession` older than 6 h must not hold off the block forever. (Task 2 test.)
4. **Reload during typing or an open sheet:** a `controllerchange` while a text field is focused or a sheet is open must defer, then reload once it's safe. (Task 4 test.)
5. **Update bridge missing (APK 1.0.8) or the Play flow failing:** Update must fall back to `market://`, and on failure show the https text; the block stays. (Task 3 test.)

---

## Stream W: gym-ui web (frontend agent). Tasks 1-4, in order.

### Task 1: Config refresh and decision logic

**Files:**
- Modify: `app-config.js` (add `refresh()`)
- Create: `force-update.js` (logic section only in this task)
- Test: `tests/force-update.spec.js`

**Interfaces:**
- Produces:
  - `GymAppConfig.refresh(): Promise<void>`: same fetch, clean and cache rules as the startup load. Never rejects.
  - `GymForceUpdate.compare(a: string, b: string): number | null`: -1/0/1 on dotted numeric versions; a missing part counts as 0; `null` if either is empty or non-numeric.
  - `GymForceUpdate.decide({native: boolean, version: string, min: string, latest: string, inWorkout: boolean, dismissed: string}): "block" | "bar" | "banner" | "none"`

- [ ] **Step 1: Write failing tests** (run `compare`/`decide` via `page.evaluate`):
  - compare: `("1.0.10","1.0.9") === 1`, `("1.0","1.0.0") === 0`, `("1.0.8","1.0.9") === -1`, `("", "1.0") === null`, `("1.0.x","1.0") === null`
  - decide:
    - `{native:true, version:"1.0.8", min:"1.0.9"}` → "block"
    - the same with `inWorkout:true` → "bar"
    - `{native:false, version:"", min:"9.9.9"}` → "none"
    - `{native:true, version:"1.0.9", min:"1.0.9", latest:"1.1.0"}` → "banner"
    - the same with `dismissed:"1.1.0"` → "none"
    - the banner case with `inWorkout:true` → "none"
    - `min:"garbage"` → "none"
    - `version:""` with native → "none"
  - refresh: mock `/app-config` to return `{verifyStrict:false, minAppVersion:"1.0.9"}`, then change the mock to `{verifyStrict:false}`; after `await GymAppConfig.refresh()`, `minAppVersion() === ""`.
- [ ] **Step 2:** `cd tests && npx playwright test force-update.spec.js`. Expected: FAIL (GymForceUpdate undefined).
- [ ] **Step 3:** Implement `refresh()`, then `compare`/`decide`, in `force-update.js` (IIFE, `window.GymForceUpdate`). Wire the file into index.html (after app-config.js), the SW ASSETS list and both Dockerfile lists.
- [ ] **Step 4:** Re-run. Expected: PASS. Also run `npx playwright test csp-hash.spec.js` → PASS.
- [ ] **Step 5:** Commit `feat(force-update): config refresh + version decision logic`.

### Task 2: Workout-state hooks in app.js

**Files:**
- Modify: `app.js` (near `window.GymApp` ~1111; `endWorkoutSession` ~2497; `stopRestTimer` ~2066; wherever `activeSession` is cleared on abandon/reset)
- Test: `tests/force-update.spec.js`

**Interfaces:**
- Produces:
  - `GymApp.workoutInProgress(): boolean`, per the Global Constraints definition.
  - `GymApp.onWorkoutIdle(cb: () => void): void`. `cb` runs every time the app goes from in-workout to not-in-workout (session ended, abandoned or reset, or the last timer stopped with no live session).

- [ ] **Step 1: Failing tests:**
  - With no session → false.
  - Seed `gym_session_active` with `startTime = now - 10 min` → true.
  - `startTime = now - 7 h` → false.
  - Start a rest timer through the UI with no session → true; stop it → false, and the `onWorkoutIdle` callback fires once.
  - Finish a day (complete all sets) → callback fires.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Fire idle callbacks from a single `notifyIdleIfIdle()` called at the end of `endWorkoutSession`, `stopRestTimer` and the abandon/reset paths.
- [ ] **Step 4:** Run the new tests plus `rest-timer.spec.js rest-autostart.spec.js celebrate.spec.js`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(force-update): workout-in-progress + idle hooks`.

### Task 3: Block page, in-workout bar, banner, Update flow

**Files:**
- Modify: `force-update.js` (UI + controller), `app.js` (`T` strings), `styles.css` (or a new `force-update.css` wired like the other css files)
- Test: `tests/force-update.spec.js`

**Interfaces:**
- Consumes:
  - Task 1 `decide`, `GymAppConfig.refresh`
  - Task 2 hooks
  - `window.GYM_APP_VERSION` (set async by native-shell.js)
  - `GymNativeShell.startUpdate(): Promise<"started"|"unavailable"|"failed">` (Task 5; may be absent)
- Produces: `GymForceUpdate.isBlocking(): boolean` (true while the full page is shown; Task 5 makes Android back respect it) and `GymForceUpdate.check(): Promise<void>`, which re-evaluates and renders. Called on: `GymAppConfig.ready`; every 250 ms until `GYM_APP_VERSION` appears (stop after 10 s); `visibilitychange` to visible (after `refresh()`); `GymApp.onWorkoutIdle`.

- [ ] **Step 1: Failing tests.** Fake the native shell with an init script (`window.Capacitor = {isNativePlatform:()=>true, getPlatform:()=>"android"}`; set `GYM_APP_VERSION` after 500 ms), mirroring how `native-shell.spec.js` fakes Capacitor.
  - min 1.0.9 / version 1.0.8 → `#force-update` visible with `fuTitle`, `GymForceUpdate.isBlocking() === true`, and Escape doesn't hide it.
  - The same with a session in progress → `#force-update-bar` visible, no block; then finish the day → block visible.
  - Update with `GymNativeShell.startUpdate` stubbed to resolve "started" → called once.
  - Update with no `startUpdate` → navigation to `market://details?id=com.etqadem.app` is attempted (capture it via a `location.assign` stub or `page.on('request')`), and the `fuStoreText` + https URL text appear.
  - Check again after the mock returns `{verifyStrict:false}` → block removed.
  - latest 1.1.0 → banner; tap ✕ → hidden; reload → still hidden; mock latest 1.2.0 → shown again.
  - Browser (no Capacitor) with min 9.9.9 → nothing shown.
  - Arabic (`dir=rtl`) → texts in Arabic.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the UI per DESIGN.md (frontend-design skill first): full-screen layer above everything with the logo, title, body, primary Update and quiet Check again; a slim top bar; a small dismissible banner. Add the T strings with the exact copy from Global Constraints.
- [ ] **Step 4:** Run the spec plus the full suite (`npx playwright test`). Expected: PASS (the known chat-insets flake aside, which must pass on re-run).
- [ ] **Step 5:** Commit `feat(force-update): update-required page, workout bar, update banner`. Then take screenshots (360 px, EN + AR, light + dark) into `docs/screenshots/2026-10-26-force-update/`.

### Task 4: Auto-reload long-open sessions

**Files:**
- Modify: `force-update.js` (reload section)
- Test: `tests/force-update.spec.js`

**Interfaces:**
- Consumes: `GymApp.workoutInProgress`, `GymApp.onWorkoutIdle`
- Produces: `GymForceUpdate.isSafeToReload(): boolean`

- [ ] **Step 1: Failing tests.** Dispatch a synthetic `controllerchange` on `navigator.serviceWorker`, with `location.reload` stubbed to count calls:
  - safe → 1 reload
  - session in progress → 0; after finishing → 1
  - text input focused → 0; after blur and resume (`visibilitychange`) → 1
  - a second `controllerchange` in the same tab → still 1 (sessionStorage guard)
  - `isSafeToReload()` false while a sheet is open
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. On visible and every 30 min: `navigator.serviceWorker.getRegistration().then(r => r && r.update())`. On `controllerchange`: set `pending = true`, and reload when `isSafeToReload()` becomes true on resume, on workout idle, or on `focusout`. Guard key `gym_fu_reloaded` = the new `CACHE_NAME` if known, else a timestamp.
- [ ] **Step 4:** Run the spec plus the full suite. Expected: PASS.
- [ ] **Step 5:** Commit, push, and open a **draft** PR "Force update: update-required page, update banner, auto-reload". In the body, cover: "Works with any APK (1.0.8 falls back to the Play Store link). MIN_APP_VERSION must stay empty until Play is live and the new APK is at 100% rollout." Append a ROADMAP-PROGRESS.md line.

## Stream N: native shell (android-developer agent). Task 5, in parallel with Tasks 1-4 but in its OWN worktree `wt-ui-native-update` on branch `feat/native-app-update` (both streams touch the tests folder; don't share a worktree).

### Task 5: Google Play In-App Updates bridge + 1.0.9

**Files:**
- Modify: `native/package.json`, `native/android/app/build.gradle` (`versionCode 9`, `versionName "1.0.9"`), `native-shell.js` (bridge)
- Test: `tests/native-shell.spec.js` (bridge contract with a stubbed plugin); emulator run

**Interfaces:**
- Consumes: `GymForceUpdate.isBlocking()` (Task 3; may be absent, so guard it).
- Produces: `GymNativeShell.startUpdate(): Promise<"started"|"unavailable"|"failed">`
  - "started": the Play immediate flow launched.
  - "unavailable": no plugin, not installed from Play, or no update offered.
  - "failed": anything thrown.
  - Never rejects.

- [ ] **Step 1:** Pick the plugin (e.g. `@capawesome/capacitor-app-update`). Read its installed source/README in `node_modules` to confirm Capacitor 8 support and the exact method names (`getAppUpdateInfo`, `performImmediateUpdate`, availability enums) before writing code.
- [ ] **Step 2: Failing test** in `native-shell.spec.js`:
  - stubbed plugin `AppUpdate` reporting an update available → `startUpdate()` resolves "started" and calls the immediate method once;
  - no plugin → "unavailable";
  - plugin throws → "failed".
  - with `window.GymForceUpdate = {isBlocking: () => true}`, `GymNativeShell.handleBack(true)` neither navigates back nor exits.
- [ ] **Step 3:** Implement the bridge in `native-shell.js`, and make `handleBack` return early while `GymForceUpdate.isBlocking()`. Install the plugin, `npx cap sync android`, and bump the version to 1.0.9 / 9.
- [ ] **Step 4:** `cd tests && npx playwright test native-shell.spec.js` → PASS. Build a debug APK (`./gradlew assembleDebug`) → BUILD SUCCESSFUL.
- [ ] **Step 5: Emulator checks:**
  - **(a)** On the **existing 1.0.8** debug APK, run `location.href = "market://details?id=com.etqadem.app"` from the WebView (devtools or the dev proxy) and record whether Android opens the Play Store or a chooser. The spec needs this answer.
  - **(b)** On 1.0.9, `startUpdate()` returns "unavailable" for a sideloaded build, with no crash.
  - Screenshot both.
- [ ] **Step 6:** Commit, push, and open a **draft** PR "Native: Play in-app updates bridge, 1.0.9". Report the result of 5a. Send the debug APK on Telegram only if the owner asks.

## Release (me, after both PRs merge, not a task for the implementers)

Add a comment in gym-be helm values next to `MIN_APP_VERSION`: "Set only after the Play listing is live and the new APK is at 100% rollout; versionName, e.g. 1.0.9."
