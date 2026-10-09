# First APK (Capacitor, local test build) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps marked **[USER]** need the user's Google Cloud account or phone; an agent prepares them and stops.

**Goal:** A debug APK of Etqadem, built with Capacitor, installed on the user's own phone by sideloading. No Play Store, no release keystore, no store listing.

**Status (2026-10-08):** Tasks 0-2 done, Task 3 code done (PR #91), native picker verified on the emulator; full sign-in not yet verified on a device. **Supersedes for now:** `2026-10-08-first-apk-twa.md`. The TWA plan stays as a fallback. Capacitor was chosen because the same project later builds iOS and gives native plugins (push, health, billing).

**Architecture:** A Capacitor project in this repo's `native/` folder (decided 2026-10-08: same repo as the web app, since the shell and `sync.js`/`boot-loader.js` change together) in **remote mode**: `server.url = https://etqadem.cloider.app/app/`. The Android WebView loads the live PWA, so:
- the web code and the deploy pipeline don't change, and every web deploy updates the app;
- API calls stay same-origin (`/api/v1`), so there are **no CORS changes**;
- the Capacitor bridge is still injected, so native plugins work.

Remote mode is fine for local testing and for Android. Before an App Store release, switch to a bundled `www/` (Apple rejects thin remote wrappers). That's out of scope here.

**Tech stack:** Node 24 (installed), `@capacitor/core` + `@capacitor/cli` + `@capacitor/android` (latest major), `@capgo/capacitor-social-login` (native Google sign-in), JDK 21, Android SDK (platform-tools, build-tools, latest platform), Gradle (via the wrapper).

## Verified facts (2026-10-08)

- Machine: Node v24.18.0. Java is 1.8 (too old: Capacitor needs JDK 21). No Android SDK, no `adb`, no `JAVA_HOME`/`ANDROID_HOME`. `winget` is available.
- `sync.js` signs in with GIS `renderButton()`/`prompt()` (`sync.js:787`). **Google blocks Sign in with Google inside Android WebViews**, so in the APK the GIS button fails. The APK needs native Google sign-in (Task 3).
- The backend checks a Google ID token against **one** audience, the web client ID (`gym-shared/authz/verifier.go`). If native sign-in sets `webClientId` = the existing web client ID, the token's `aud` is the web client ID, so **no backend change**.
- `config.js` sets `GOOGLE_CLIENT_ID` at container start, so the APK reads the same value from the live site.

## Global constraints

- Package / appId: `com.etqadem.app` (same as the TWA plan).
- Debug build only: signed automatically with the Android debug key (`~/.android/debug.keystore`). The release keystore (`C:\Users\L\keys\etqadem-upload.keystore`) is **not** used here and never goes in a repo.
- No changes to gym-be, gym-shared or helm. Nothing in `native/` reaches the web image (`.dockerignore`) or triggers its CI (`paths-ignore`).

---

### Task 0 [USER-approve]: Install the toolchain (~3 GB)

- `winget install Microsoft.OpenJDK.21`
- Android SDK, either Android Studio (`winget install Google.AndroidStudio`, easiest, includes an emulator) or command-line tools only. Then `sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"` (or the newest that the Capacitor version asks for).
- Set `JAVA_HOME` and `ANDROID_HOME` (`%LOCALAPPDATA%\Android\Sdk`) and add `platform-tools` to PATH.
- Verify: `java -version` → 21, `adb version` works.

### Task 1: Capacitor project

- Create `native/` in gym-ui, `npm init -y`, then `npm i @capacitor/core @capacitor/cli @capacitor/android`.
- `npx cap init Etqadem com.etqadem.app --web-dir www`, with a placeholder `www/index.html` (required even in remote mode).
- `capacitor.config.json`:
  ```json
  {
    "appId": "com.etqadem.app",
    "appName": "Etqadem",
    "webDir": "www",
    "server": { "url": "https://etqadem.cloider.app/app/", "androidScheme": "https" },
    "android": { "allowMixedContent": false }
  }
  ```
- `npx cap add android`. Icons and splash come from `icons/icon-512-etq.png` / `icon-maskable-512-etq.png` via `npx @capacitor/assets generate --android`, with background `#10171f`.
- `native/.gitignore`: `node_modules/`, `android/app/build/`, `*.keystore`, `*.jks`, `local.properties`.

### Task 2: First build (without native sign-in): smoke APK

- `npx cap sync android`, then `cd android && .\gradlew assembleDebug`.
- Output: `android/app/build/outputs/apk/debug/app-debug.apk`.
- This APK is enough to check layout, navigation, offline, and email sign-in if it's enabled. Google sign-in is **expected to fail** in this build.

### Task 3: Native Google sign-in

- **[USER] Google Cloud Console** (same project as the web client ID): Credentials → Create OAuth client → **Android**, package `com.etqadem.app`, SHA-1 of the debug keystore (the agent prints it with `keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android`). No secret is produced and nothing goes in code. The client only has to exist.
- `native/`: `npm i @capgo/capacitor-social-login`, then `npx cap sync`.
- Web side (`sync.js`, same PR): when `window.Capacitor && Capacitor.isNativePlatform()`, render our own "Sign in with Google" button instead of the GIS button. On tap, call `Capacitor.Plugins.SocialLogin.initialize({ google: { webClientId: CLIENT_ID } })` and then `login({ provider: 'google' })`, and pass the returned `idToken` to the existing `acceptToken(idToken, "google")`. Skip loading `gsi/client` on native. Sign-out also calls `SocialLogin.logout`. In the browser nothing changes (gate on `isNativePlatform`). Tests: unit test on the platform gate. web-tester regression on the web sign-in flow.
- Rebuild the debug APK (Task 2 commands).

### Task 4: Deliver and install

- Copy `app-debug.apk` to `C:\Users\L\Downloads\Gym_repo\apk\etqadem-debug-<date>.apk`.
- **[USER] Install**, either:
  - **USB:** phone Developer options → USB debugging, connect, then `adb install -r etqadem-debug-<date>.apk`; or
  - **No cable:** send the file to the phone (Drive, Telegram or WhatsApp "document", email), open it, and allow "Install unknown apps" for that app when asked.
- Play Protect may warn "unknown developer": tap "Install anyway". That's normal for debug builds.

### Task 5 [USER]: Device test checklist

| # | Check | Expected |
|---|---|---|
| 1 | Launch | Splash, then app full-screen, no browser bar |
| 2 | Google sign-in | Native Google account picker, then signed in, and data syncs |
| 3 | Sign out / sign in again | Works, no stale account |
| 4 | Arabic / RTL + dark/light | Same as web |
| 5 | Airplane mode after one online launch | App opens from the service-worker cache |
| 6 | Android back button | Navigates inside the app, then exits on the first screen |
| 7 | External links (privacy, delete-account) | Open in the system browser |
| 8 | Notifications | **Known gap:** web push doesn't work in a WebView. Needs `@capacitor/push-notifications` + FCM (follow-up plan, needs backend) |
| 9 | Rotate / keyboard | Inputs not hidden behind the keyboard |

Record results in this file; bugs go to gym-ui issues.

## Follow-ups (not in this plan)

- Native push (FCM + APNs) with backend support.
- Release-signed AAB + Play internal testing track (uses the upload keystore).
- iOS: `npx cap add ios` (needs a Mac or a cloud Mac CI and an Apple Developer account, $99/yr) and switch to a bundled `www/`.
- Billing: Play Billing / Apple IAP vs Stripe decision before Premium.
