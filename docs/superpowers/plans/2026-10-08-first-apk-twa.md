# First APK (Trusted Web Activity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Steps marked **[USER]** are interactive or need the user's phone/passwords; an agent prepares them and stops.

**Goal:** A signed Android APK of Etqadem that opens the live PWA full-screen (no browser bar), installed and tested on the user's own phone.

**Architecture:** A Trusted Web Activity (TWA) generated with Google's Bubblewrap CLI wraps `https://etqadem.cloider.app/app/`. The app is the live web app, so every web deploy updates it without a new APK. Chrome hides its URL bar only when the site proves it owns the app: `https://etqadem.cloider.app/.well-known/assetlinks.json` must list the APK's package name and signing-key SHA-256. The Android project lives in a new private repo; gym-ui only gains the `assetlinks.json` file.

**Tech Stack:** `@bubblewrap/cli` (Node 24 is installed), JDK 17 + Android SDK (Bubblewrap downloads both; the machine only has Java 8), `adb`, gym-ui nginx image.

**Spec:** The milestone in project memory `apk-device-test-plan`: "build an APK (TWA) and test on a real device", via Bubblewrap wrapping the live PWA with `assetlinks.json` on the app domain. The user asked for the first APK on 2026-10-08, before every planned feature lands: this is a **test build**, not a Play Store release.

## Global Constraints

- Package name (permanent once on Play): **`com.etqadem.app`**. Change it here before Task 1 if you want something else; after Task 2 deploys, changing it means a new `assetlinks.json`.
- Host: `etqadem.cloider.app`; start URL `/app/`; web manifest `https://etqadem.cloider.app/app/manifest.json` (scope `./` = `/app/`).
- Colours/icons come from the existing manifest: theme and background `#10171f`, `icons/icon-512-etq.png`, `icons/icon-maskable-512-etq.png`; orientation portrait.
- Version: `appVersionCode 1`, `appVersionName "0.1.0"`.
- **Never commit the keystore or its passwords.** Losing the keystore means this app can never be updated in place (users would have to uninstall). Keep it outside every repo and back it up (password manager plus one offline copy).
- No Play Console, payments, or store listing in this plan.

## Verified facts (origin/main 63990d6 and this machine, 2026-10-08)

- The image copies `landing/` to the nginx html root (`Dockerfile`: `COPY landing/ /usr/share/nginx/html/`), and `docker/default.conf` ends with `location / { try_files $uri $uri/ =404; }`. So `landing/.well-known/assetlinks.json` would be served at `/.well-known/assetlinks.json`. There is no `.well-known` location yet (`grep well-known docker/default.conf` → none); Task 2 adds one, to pin the JSON type and no-cache.
- `frame-ancestors 'none'` in `docker/security-headers.conf` doesn't affect a TWA (it isn't a WebView/iframe; it's Chrome).
- Google sign-in uses GIS `renderButton()` + `prompt()` (`sync.js:537,613`), which run in Chrome inside a TWA. A popup returning to the TWA is the one flow that has to be proven on the device (Task 4, row 3).
- Tooling: `node -v` → v24.18.0; `java -version` → 1.8.0_451 (too old; let Bubblewrap install JDK 17); no `adb` and no Android SDK yet.
- If the app later moves to its own domain, the TWA host changes. That needs an APK update, plus `assetlinks.json` on the new domain.

## Review Focus

1. Browser bar still visible after install → asset-link verification failed (wrong fingerprint, wrong package, file not served as JSON, or a redirect). Task 3 checks it with Google's Digital Asset Links API **before** installing.
2. Google sign-in popup opens and never returns to the app. Expected: signed in inside the app. Task 4 row 3; the fallback is noted there.
3. Offline launch (airplane mode) after one online launch must open the app from the service worker cache, not Chrome's offline page. Task 4 row 5.
4. Android back button on the first screen must leave the app, not navigate to the landing page (`/` is outside scope and would show a browser bar). Task 4 row 7.
5. Links to the landing page, `/delete-account` or the privacy page open in a Custom Tab with a bar (out of scope). Expected and acceptable; record it, don't "fix" it by widening the scope to `/`.

---

### Task 1: Android project and signing key (new private repo)

**Files:**
- Create: `C:\Users\L\Downloads\Gym_repo\etqadem-android\` (new git repo; private GitHub repo `Eslam1141/etqadem-android`)
- Create: `etqadem-android/twa-manifest.json` (written by Bubblewrap, then checked against the constraints)
- Create: `etqadem-android/.gitignore`
- Keystore (outside the repo): `C:\Users\L\keys\etqadem-upload.keystore`, alias `etqadem`

**Interfaces:**
- Produces: package `com.etqadem.app`; the keystore's SHA-256 fingerprint (`XX:XX:…`, 32 bytes) used in Task 2.

- [ ] **Step 1: Install Bubblewrap**

Run: `npm i -g @bubblewrap/cli && bubblewrap --version`
Expected: a version string (1.2x or later).

- [ ] **Step 2 [USER]: Run `bubblewrap init` (interactive)**

In a terminal (it asks questions, so the agent can't answer them):

```
mkdir C:\Users\L\Downloads\Gym_repo\etqadem-android
cd C:\Users\L\Downloads\Gym_repo\etqadem-android
bubblewrap init --manifest https://etqadem.cloider.app/app/manifest.json
```

Answers:
- Install JDK 17 / Android SDK automatically: **Yes** to both.
- Domain: `etqadem.cloider.app` · URL path: `/app/`
- Application name: `Etqadem` · Short name: `Etqadem`
- Application ID: `com.etqadem.app`
- Version: code `1`, name `0.1.0`
- Display mode `standalone` · Orientation `portrait` · Status bar colour `#10171F`
- Splash colour `#10171F` · Icon URL `https://etqadem.cloider.app/app/icons/icon-512-etq.png` · Maskable icon `https://etqadem.cloider.app/app/icons/icon-maskable-512-etq.png`
- Monochrome icon: skip · Shortcuts: none · Play Billing: **No** · Location delegation: **No** · Notification delegation: **Yes**
- Key store: `C:\Users\L\keys\etqadem-upload.keystore`, alias `etqadem`; create new. Choose two strong passwords and save them in your password manager **now**.

- [ ] **Step 3: Check the generated twa-manifest.json**

Run: `node -e "const m=require('./twa-manifest.json');console.log(JSON.stringify({p:m.packageId,h:m.host,s:m.startUrl,v:[m.appVersionCode,m.appVersionName],k:m.signingKey,n:m.enableNotifications,o:m.orientation,f:m.fallbackType},null,1))"`
Expected:
`{"p":"com.etqadem.app","h":"etqadem.cloider.app","s":"/app/","v":[1,"0.1.0"],"k":{"path":"C:\\Users\\L\\keys\\etqadem-upload.keystore","alias":"etqadem"},"n":true,"o":"portrait","f":"customtabs"}`.
Fix any mismatch in `twa-manifest.json`, then run `bubblewrap update` to regenerate the project.

- [ ] **Step 4: Get the fingerprint and generate assetlinks.json**

Run: `bubblewrap fingerprint generateAssetLinks --output=assetlinks.json && type assetlinks.json`
Expected: a JSON array with `"package_name": "com.etqadem.app"` and one `sha256_cert_fingerprints` entry. (It prompts for the keystore password: **[USER]**.)

- [ ] **Step 5: Ignore secrets, commit, push to a private repo**

`.gitignore`:

```
*.keystore
*.jks
*.apk
*.aab
*.idsig
build/
app/build/
.gradle/
local.properties
```

```bash
git init -b main
git add .
git status   # confirm: no .keystore, no .apk listed
git commit -m "chore: bubblewrap TWA project for Etqadem 0.1.0"
gh repo create Eslam1141/etqadem-android --private --source . --push
```

---

### Task 2: Serve assetlinks.json from the site (gym-ui PR)

**Files:**
- Create: `landing/.well-known/assetlinks.json` (contents from Task 1 Step 4, verbatim)
- Modify: `docker/default.conf` (new location, before the final `location /`)
- Modify: `.github/workflows/docker-image.yml` (smoke curl, next to the other `localhost:8080` checks around line 74)

**Interfaces:**
- Consumes: the `assetlinks.json` from Task 1 Step 4 (package name + SHA-256).
- Produces: `https://etqadem.cloider.app/.well-known/assetlinks.json` returning 200 with `Content-Type: application/json` and no redirect.

- [ ] **Step 1: Write the failing CI check**

In `.github/workflows/docker-image.yml`, after the `service-worker.js` curl (line 74):

```yaml
          curl -fsSI localhost:8080/.well-known/assetlinks.json | tr -d '\r' | grep -qi '^content-type: application/json'
          curl -fsS localhost:8080/.well-known/assetlinks.json | grep -q '"com.etqadem.app"'
```

- [ ] **Step 2: See it fail locally**

Run (repo root): `docker build -t gym-ui:al . && docker run -d --rm -p 18080:8080 --name al gym-ui:al && sleep 2 && curl -sI localhost:18080/.well-known/assetlinks.json | head -1; docker stop al`
Expected: `HTTP/1.1 404 Not Found`.

- [ ] **Step 3: Add the file and the nginx location**

Copy `etqadem-android/assetlinks.json` to `landing/.well-known/assetlinks.json` unchanged.

In `docker/default.conf`, before `location / {`:

```nginx
    # Android TWA ownership proof (etqadem-android). Must be 200 JSON with
    # no redirect, or Chrome shows a URL bar inside the app.
    location = /.well-known/assetlinks.json {
        include /etc/nginx/snippets/security-headers.conf;
        add_header Cache-Control "no-cache";
        default_type application/json;
        types { }
    }
```

(`types { }` + `default_type` forces `application/json` regardless of the mime map.)

- [ ] **Step 4: Rebuild and pass the check**

Run: `docker build -t gym-ui:al . && docker run -d --rm -p 18080:8080 --name al gym-ui:al && sleep 2 && curl -sI localhost:18080/.well-known/assetlinks.json | tr -d '\r' | grep -i "^HTTP\|^content-type" && curl -s localhost:18080/.well-known/assetlinks.json; docker stop al`
Expected: `HTTP/1.1 200 OK`, `Content-Type: application/json`, the JSON from Task 1.

- [ ] **Step 5: Commit, push, PR, then [USER] merge**

```bash
git checkout -b feat/twa-assetlinks origin/main
git add landing/.well-known/assetlinks.json docker/default.conf .github/workflows/docker-image.yml
git commit -m "feat(android): serve assetlinks.json for the Etqadem TWA"
git push -u origin HEAD
gh pr create --base main --title "feat(android): serve assetlinks.json for the TWA" --body-file <body.md>
```

The fingerprint is public by design (it's the certificate, not the key), so it's safe in a public repo. After the user merges, the gym-ui deploy job ships it.

- [ ] **Step 6: Verify on the live domain**

Run: `curl -sI https://etqadem.cloider.app/.well-known/assetlinks.json | tr -d '\r' | grep -i "^HTTP\|^content-type\|^location"`
Expected: `200`, `application/json`, no `location:` line (a redirect breaks verification; Cloider's edge must not add one).

---

### Task 3: Build and pre-verify the APK

**Files:**
- Output (not committed): `etqadem-android/app-release-signed.apk`

- [ ] **Step 1 [USER]: Build**

```
cd C:\Users\L\Downloads\Gym_repo\etqadem-android
bubblewrap build
```

Enter the two keystore passwords when asked. Expected: `app-release-signed.apk` and `app-release-bundle.aab` created.

- [ ] **Step 2: Confirm the APK is signed with the key in assetlinks.json**

Run: `"%USERPROFILE%\.bubblewrap\android_sdk\build-tools\<ver>\apksigner.bat" verify --print-certs app-release-signed.apk`
(`dir %USERPROFILE%\.bubblewrap\android_sdk\build-tools` shows `<ver>`.)
Expected: `Signer #1 certificate SHA-256 digest:` equal to the fingerprint in `assetlinks.json` (same hex; apksigner prints it lowercase without colons).

- [ ] **Step 3: Ask Google whether the link verifies (Review Focus #1)**

Run: `curl -s "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://etqadem.cloider.app&relation=delegate_permission/common.handle_all_urls"`
Expected: a `statements` array containing `"packageName": "com.etqadem.app"` and the fingerprint. An empty result means: stop, fix Task 2, don't install yet.

- [ ] **Step 4: Tag the source**

```bash
git tag v0.1.0 && git push --tags
```

---

### Task 4 [USER]: Install on the phone and test

**Files:**
- Create: `C:\Users\L\Downloads\Gym_repo\docs\android\2026-10-08-apk-0.1.0-device-test.md` (results table below, filled in)

- [ ] **Step 1: Install**

Option A (no cable): copy `app-release-signed.apk` to the phone (Drive/Telegram to yourself), open it, allow "Install unknown apps" for that app when Android asks.
Option B (USB): phone → Settings → About → tap Build number 7× → Developer options → USB debugging on; then `"%USERPROFILE%\.bubblewrap\android_sdk\platform-tools\adb.exe" install -r app-release-signed.apk` → `Success`.

- [ ] **Step 2: Run the checklist and fill in the results file**

| # | Check | Expected | Result |
|---|---|---|---|
| 1 | Launcher icon and name | Etqadem icon (maskable, not a white square), name "Etqadem" | |
| 2 | First open | Splash in `#10171f`, then the app, **no URL bar** | |
| 3 | Google sign-in | Account chooser, returns into the app signed in | |
| 4 | Workout: log a set, start rest timer, lock the screen 60 s, unlock | Timer kept counting, no reload | |
| 5 | Airplane mode, swipe the app away, reopen | App opens from cache (offline banner OK), not Chrome's dinosaur | |
| 6 | Arabic: switch language | RTL layout, Arabic font, no clipped text | |
| 7 | Back button on the home tab | Leaves the app; doesn't show the landing page | |
| 8 | Keyboard: food search, coach chat input | Input stays visible above the keyboard | |
| 9 | Privacy → export data | File downloads (Downloads or a share sheet) | |
| 10 | Notifications (if prompted) | Android permission dialog; a test notification shows under "Etqadem" | |
| 11 | Calorie calculator: add 250 g of a food | kcal/macros update; daily total shows | |
| 12 | Rotate phone | Stays portrait | |
| 13 | Close, then reopen from recent apps | Resumes the same screen, still signed in | |

If row 3 fails (popup never returns): note the exact behaviour. The fix is a gym-ui change to GIS redirect mode (`ux_mode: "redirect"` with a `login_uri` handled by gym-be), which needs its own plan, because the current flow uses the client-side `callback` ID token (`sync.js`).

- [ ] **Step 3: Commit the results and note them in ROADMAP-PROGRESS.md**

One line per failed row, each with a proposed fix and the owning repo.

---

## Spec coverage

| Requirement | Task |
|---|---|
| APK built via TWA / Bubblewrap wrapping the live PWA | 1, 3 |
| `assetlinks.json` on the app domain | 2 |
| Uses the chosen (Etqadem) logo for icons | 1 Step 2 (icon URLs), 4 row 1 |
| Tested on a real device | 4 |
| Keystore safe (future updates possible) | Global Constraints, 1 Step 2 + 5 |

## Producer → consumer check

- Task 2 needs `package_name` + `sha256_cert_fingerprints` → produced by Task 1 Step 4 (`assetlinks.json`), generated from the same keystore that Task 3 signs with. Task 3 Step 2 re-checks this.
- Task 3 needs `twa-manifest.json` host/startUrl/package from Task 1 Step 3; its expected values match Task 2's file and nginx path.

## Later (not in this plan)

- Play Console: an internal-testing track uploads `app-release-bundle.aab`. Play App Signing adds Google's signing fingerprint, which must be appended to `assetlinks.json` as a second entry, or the store build shows a URL bar.
- Own domain: new host, then `bubblewrap update`, a new versionCode, and `assetlinks.json` on the new domain.
- Play Billing / Stripe and the streak → free Premium week reward live in the Premium plan, not here.
