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
