# Etqadem native app (Capacitor)

Android (later iOS) shell for the Etqadem web app in this repo. It runs in
**remote mode**: the app loads `https://etqadem.cloider.app/app/` (see
`capacitor.config.ts`), so every web deploy updates the app without a new
build. `www/` only holds an offline fallback page.

Web-side pieces the shell relies on live in the repo root: `boot-loader.js`
(hands over from the native splash) and the native Google sign-in branch in
`sync.js`. Nothing in `native/` reaches the web image (`.dockerignore`) or
triggers its CI (`paths-ignore`).

Plan: `../docs/superpowers/plans/2026-10-08-first-apk-capacitor.md`.

## Requirements

- Node 24, JDK 21 (`JAVA_HOME`), Android SDK (`ANDROID_HOME`, platform 36).

## Build a debug APK

```sh
cd native
npm ci
npx cap sync android
cd android && ./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

## Test unmerged web changes in the app

`tools/dev-proxy.mjs` serves this checkout's web app under `/app/` and
proxies the API (and `config.js`, with the API base rewritten to the proxy so
there's no CORS) to production:

```sh
node tools/dev-proxy.mjs                 # http://localhost:8090/app/
adb reverse tcp:8090 tcp:8090
ETQ_DEV_URL=http://localhost:8090/app/ npx cap sync android   # then build + install
```

Run `npx cap sync android` without `ETQ_DEV_URL` before building anything you
hand to someone, or the app points at your laptop.

## Run on the emulator

```sh
emulator -avd etqadem-test &
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell monkey -p com.etqadem.app 1
```

## Google sign-in

Uses `@capgo/capacitor-social-login` with the **web** client ID (from the
live `config.js`). Each signing key needs an **Android** OAuth client
(package `com.etqadem.app` + that key's SHA-1) in the same Google Cloud
project. The debug key's client exists; add one for the release key before
shipping a release build.

## Icons and splash

Source PNGs live in `assets/` (rendered from `../icons/logo-etq-*.svg`). The
Android 12+ splash icon is `android/app/src/main/res/drawable/splash_logo.xml`
(the reversed mark on `#10171f`, matching the web loader). Regenerate icons:

```sh
npx capacitor-assets generate --android --iconBackgroundColor '#F3F0E8' --splashBackgroundColor '#10171f' --splashBackgroundColorDark '#10171f'
```

Never commit a keystore. Release signing uses `C:\Users\L\keys\etqadem-upload.keystore`.

## Timer alarm, Back button, app version

- `TimerAlarmPlugin` / `TimerAlarmReceiver` (in `android/app/src/main/java/com/etqadem/app/`) are a tiny
  in-app Capacitor plugin: the rest / exercise timer end is scheduled with `AlarmManager`
  (`setAlarmClock` when "Alarms & reminders" is granted, else `setAndAllowWhileIdle`) and fires an
  insistent notification (`FLAG_INSISTENT`, 30 s cap, "Stop" action) on the `timer-alarm` channel
  (`USAGE_ALARM`). It stays silent while the app is on screen (the in-app alarm rings instead) and is
  cancelled when the app returns to the foreground. No new permission: `SCHEDULE_EXACT_ALARM` is already
  declared by `@capacitor/local-notifications` (Play "Alarms & reminders" declaration, same as before);
  no foreground service and no `USE_FULL_SCREEN_INTENT`.
- `native-shell.js` (web) wires `@capacitor/app`: hardware Back closes the top sheet / ringing banner,
  then goes back, then exits; `window.GYM_APP_VERSION` = versionName (sent as `context.appVersion` in
  feedback); deletes the old `rest-timer` channel at startup.

## Health Connect (watch data, read-only)

`@capgo/capacitor-health` (pinned) is registered as `window.Capacitor.Plugins.Health`. Android 14+ has
Health Connect built in; Android 9-13 needs the Play app. minSdk is 26 because the plugin requires it.

- The plugin's manifest declares READ+WRITE for ~25 record types. `src/main/AndroidManifest.xml` strips
  everything except six READ permissions (steps, active calories, heart rate, resting heart rate, sleep,
  weight) with `tools:node="remove"`. After `./gradlew processReleaseMainManifest processDebugMainManifest`,
  `node tools/check-manifest.mjs` asserts the merged manifests.
- `src/debug/AndroidManifest.xml` adds the six matching WRITE permissions to **debug builds only**, so the
  emulator can be seeded with the plugin's own `saveSample()`. Release builds merge `src/main` only and have
  no WRITE permissions. Never move them into `src/main`.
- The rationale activity, the Android 14 permission-usage alias and the `<queries>` entry come from the
  plugin; the privacy link is `health_connect_privacy_policy_url` in `strings.xml`.
- Brand compatibility: `../docs/watch-compatibility.md`.

Emulator test (API 34+ Google Play image): install the debug APK, forward the WebView debug port
(`adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`) and drive `Capacitor.Plugins.Health`
over the DevTools protocol. In a debug build, call `requestAuthorization({write:[...]})` then `saveSample()` to seed.

## Remove animations (reduced motion)

Android's "Remove animations" (animator / transition animation scale = 0) does not set
`prefers-reduced-motion` in the WebView. `MainActivity` reads `Settings.Global.ANIMATOR_DURATION_SCALE`
and `TRANSITION_ANIMATION_SCALE`; if either is 0 it sets `html[data-reduce-motion="1"]` (otherwise clears
it). It does so synchronously through the `EtqMotion` JS interface (read by `native-shell.js` at parse time,
so the first paint is already still) and again by `evaluateJavascript` on every page load / first paint and on
resume (the setting can change while the app is in the background). Web side: `GymMotion.reduced()` honours
the attribute, and `motion.css` ends with a generated mirror of every `prefers-reduced-motion: reduce` rule plus
a rule that stops animations and transitions under the attribute. After editing any reduce block run
`node tools/mirror-reduced-motion.mjs` (a Playwright test checks it with `--check`). Test on the emulator:
`adb shell settings put global animator_duration_scale 0`, relaunch, then check the attribute over CDP.
