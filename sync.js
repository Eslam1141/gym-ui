/* sync.js — offline-first background sync for workout progress.
 *
 * localStorage stays the source of truth. This layer mirrors gym_* keys to the
 * gym-be backend when the user is signed in with Google and online. Every
 * network path fails silently: with no GOOGLE_CLIENT_ID, or offline, or on any
 * error, the app behaves exactly as it does without this file. */
(function () {
  "use strict";

  var API_BASE = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var CLIENT_ID = window.GOOGLE_CLIENT_ID || "";
  // P0-3: the One Tap/FedCM prompt's language comes from the `hl` the
  // gsi/client script was first loaded with (initAuth() below) and isn't
  // changeable per-call, but a rendered button's language is — via
  // GsiButtonConfiguration.locale, passed fresh on every renderButton() call
  // in renderGoogleButton(). gisLang holds the language later toggles should
  // use for that per-button locale; it starts at the script's own initial
  // `hl` and refreshLocale() below just updates it and re-renders.
  var gisLang = null;
  // Last signedIn value gym:authchange was emitted with, so a renderAuthUI()
  // call that doesn't actually change auth state (e.g. a language toggle)
  // doesn't re-fire the event and trigger listeners' (header.js, etc.)
  // unconditional re-fetches for no reason.
  var lastAuthEmit = null;
  function appLang() {
    try { return document.documentElement.lang === "ar" ? "ar" : "en"; } catch (e) { return "en"; }
  }

  // P1-7: this box's own strings, hardcoded English with no data-i18n hook
  // for applyStaticI18n() to reach (it's built via innerHTML at render time,
  // not present in index.html's markup) — "Sign in to back up progress
  // across devices." was the one the audit spotted in AR, but its siblings
  // here (Sync/Signed in as/Sign out) had the exact same gap.
  var STR = {
    syncLabel:  { en: "Sync",              ar: "المزامنة" },
    signedInAs: { en: "Signed in as",      ar: "تم تسجيل الدخول باسم" },
    syncHint:   { en: "Sign in to back up progress across devices.", ar: "سجّل الدخول لحفظ تقدمك عبر الأجهزة." }
  };
  function s(key) { return STR[key][appLang()]; }
  // _debug.onCredential lets a caller hand sync.js an arbitrary, unverified
  // credential string and have it trusted as a real signed-in identity (real
  // sign-in only ever gets here via a signature Google's own SDK already
  // checked) — invaluable for testing, but not something to leave reachable
  // by any script on the real site real users visit. Gate it (and the
  // account-data wipe it can trigger) off the production origin.
  // The production hostname comes from config.js (APP_HOST / Helm
  // global.host); DEFAULT_PROD_HOST is only the fallback when it's unset.
  var DEFAULT_PROD_HOST = "etqadem.cloider.app";
  var IS_PROD = (function () {
    try { return location.hostname === (window.GYM_APP_HOST || DEFAULT_PROD_HOST); } catch (e) { return false; }
  })();
  var META_KEY = "gym_meta_updatedAt";
  // Device-local cache of the last Google ID token (NOT gym_-prefixed => never
  // synced). Without this, every reload started signed-out and waited on a
  // fresh Google round-trip (GIS auto-select / One Tap) to sign back in —
  // slow, and unreliable on mobile browsers that restrict third-party/FedCM
  // prompts, so it looked like "asks me to sign in again on every refresh."
  // Restoring it instantly on load fixes that; GIS still silently renews it
  // in the background before it expires.
  var SESSION_KEY = "gymauth_session";
  // sessionStorage marker for "a sign-in was just started on this tab" — set
  // right as the user taps the real Google button (renderGoogleButton()
  // below), cleared once onCredential() resolves either way. Not gym_-
  // prefixed, same single-device/never-synced convention as SESSION_KEY:
  // without this, sign-in has ZERO persisted representation until
  // onCredential() finishes (it's the first thing to write anything, at the
  // very end of that function), so a refresh at any point during the
  // Google popup/FedCM round-trip wiped the whole in-flight attempt with
  // nothing to recover from — the app just cold-booted back to signed-out,
  // which reads to the user as "it redirected me back". This marker gives
  // boot() something to hold onto: a brief "resolving…" state instead of an
  // immediate, possibly-wrong "you're signed out" screen. PENDING_MAX_AGE_MS
  // is a hard safety net so a marker that somehow never gets cleared (tab
  // closed mid-flow, callback never fires) can't wedge a future load on
  // "resolving" forever.
  var PENDING_KEY = "gymauth_pending";
  var PENDING_MAX_AGE_MS = 120000;
  // A much tighter window used only when deciding whether a pending marker
  // should override an ACTIVE anon-preview session (shouldResolveSilently()
  // below). The marker is set on any pointerdown near a Google button
  // (renderGoogleButton()) — including the More→Sync panel's button, which
  // sits in plain view during ordinary anon browsing with no overlay up at
  // all, so a touch-scroll that grazes it or a tap immediately backed out
  // of sets the same marker a real sign-in does. A genuine popup/FedCM
  // round trip settles within a few seconds; capping the anon-override
  // window this tight means a marker that never led anywhere stops
  // interrupting anon browsing almost immediately instead of for the full
  // PENDING_MAX_AGE_MS (2 minutes). The non-anon case still uses the longer
  // window — there's no anon session to protect there.
  var PENDING_ANON_OVERRIDE_MAX_AGE_MS = 12000;
  // Device-local keys that must NEVER round-trip through the server. gym_user_sub
  // especially: if a stale value comes back down it flips the "account switched"
  // check on the next load and can wedge the app in a reload loop.
  // gym_session_active is a single-device, right-now runtime fact (is a timer
  // ticking on THIS device), not shareable user data — and ending a workout
  // clears it with a raw localStorage.removeItem (app.js), which never goes
  // through onLocalWrite. Since this sync protocol has no delete/tombstone
  // concept (a PUT only ever adds/overwrites keys it's given), syncing this
  // key meant an ended session's stale "still running" blob could never be
  // deleted server-side — the next pull (interval/focus/reload) would merge
  // it straight back into localStorage, making "End Workout" look broken.
  // gym_push_endpoint: web push has been removed (see notifications.js's
  // in-app inbox), and calendar.js now clears this key on load — but it
  // stays listed here so a stale value lingering on some other, not-yet-
  // updated device never syncs onto a device that already cleared it.
  var LOCAL_ONLY = { gym_meta_updatedAt: 1, gym_user_sub: 1, gym_tab: 1, gym_anon: 1, gym_session_active: 1, gym_push_endpoint: 1 };
  function syncable(k) { return k && k.indexOf("gym_") === 0 && !LOCAL_ONLY[k]; }
  var FETCH_TIMEOUT_MS = 8000;
  var DEBOUNCE_MS = 1500;
  var INTERVAL_MS = 120000;

  var idToken = null;        // current bearer token (Google ID token OR gym-be local JWT)
  var tokenExpEpoch = 0;     // seconds since epoch
  // Which sign-in method produced idToken: "google" (GIS ID token, silently
  // renewable via prompt()) or "local" (gym-be-issued JWT from email/password
  // sign-in — 1h lifetime, NO refresh endpoint, so expiry = log in again).
  var source = null;
  // Device-local (not gym_-prefixed => never synced, and untouched by
  // clearUserData) markers for the email/password path: METHOD_KEY remembers
  // that the last session on this device was a local one (a cold start
  // must not hold on the GIS "resolving…" screen — Google can't restore it),
  // EMAIL_KEY prefills the re-login form. Both cleared by signOut().
  var METHOD_KEY = "gymauth_method";
  var EMAIL_KEY = "gymauth_email";
  var profile = null;        // { email, name }
  var debounceTimer = null;
  var intervalId = null;
  var refreshTimer = null;
  var syncing = false;
  var triggersStarted = false;

  function log() {
    if (window.console && console.debug) console.debug.apply(console, arguments);
  }

  // sessionStorage, not localStorage: this holds a live bearer credential.
  // sessionStorage still survives a reload (fixes "signs out on refresh")
  // but is cleared when the tab/browser closes, instead of sitting on disk
  // indefinitely on a shared/public device.
  function loadCachedSession() {
    try {
      var s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      // 30s safety margin, same as isSignedIn()'s own check
      if (s && s.token && s.exp && s.exp * 1000 > nowMs() + 30000) return s;
    } catch (e) {}
    return null;
  }
  function saveCachedSession() {
    try {
      if (idToken && tokenExpEpoch) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: idToken, exp: tokenExpEpoch, profile: profile, source: source || "google" }));
      }
    } catch (e) {}
  }
  function clearCachedSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function markSignInPending() {
    try { sessionStorage.setItem(PENDING_KEY, String(nowMs())); } catch (e) {}
  }
  function clearSignInPending() {
    try { sessionStorage.removeItem(PENDING_KEY); } catch (e) {}
  }
  // Milliseconds since the marker was set, or -1 if there isn't one / it's
  // unreadable. Shared by isSignInPending() (the general PENDING_MAX_AGE_MS
  // window) and shouldResolveSilently()'s tighter anon-override check
  // (PENDING_ANON_OVERRIDE_MAX_AGE_MS) so both read the exact same marker
  // the exact same way.
  function pendingMarkerAgeMs() {
    try {
      var raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return -1;
      var ts = parseInt(raw, 10);
      return isFinite(ts) ? (nowMs() - ts) : -1;
    } catch (e) { return -1; }
  }
  function isSignInPending() {
    var age = pendingMarkerAgeMs();
    return age >= 0 && age < PENDING_MAX_AGE_MS;
  }

  function readMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function writeMeta(m) {
    try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) {}
  }

  // Every syncable gym_* key currently in localStorage (device-local keys excluded).
  function gymKeys() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (syncable(k)) out.push(k);
    }
    return out;
  }

  function nowMs() { return Date.now(); }

  // Wipe this browser's per-user data so a different account doesn't inherit it.
  // Keeps device/UI-only prefs. Called on sign-out and on an account switch.
  function clearUserData() {
    clearCachedSession(); // don't let a stale cached token restore the old account
    var keep = { gym_onboarded: 1, gym_lang: 1, gym_tab: 1, gym_anon: 1 };
    try {
      var rm = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        if ((k.indexOf("gym_") === 0 && !keep[k]) || k.indexOf("gymcoach_") === 0) rm.push(k);
      }
      rm.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  }

  function isSignedIn() {
    return !!idToken && (tokenExpEpoch === 0 || tokenExpEpoch * 1000 > nowMs() + 30000);
  }

  // ---- called by app.js on every gym_* write ----
  function onLocalWrite(key) {
    var m = readMeta();
    m[key] = nowMs();
    writeMeta(m);
    scheduleDebouncedSync();
  }

  function scheduleDebouncedSync() {
    if (!isSignedIn()) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { syncNow("debounce"); }, DEBOUNCE_MS);
  }

  // ---- reconcile ----
  function buildEntries() {
    var m = readMeta();
    var entries = {};
    var metaChanged = false;
    gymKeys().forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v === null) return;
      // Backfill when meta has no record for this key at all (a key
      // genuinely never recorded must not collapse to epoch 0 the way
      // `m[k] || 0` did — that made a stale/deleted meta entry look ancient
      // and lose to any remote value), AND when a meta record exists but its
      // value is garbled (e.g. hand-edited in DevTools into a non-numeric
      // string). A garbled value must never reach `new Date(ts)` below:
      // syncNow() calls buildEntries() synchronously before any promise
      // chain exists, so a thrown RangeError here would escape before the
      // .finally() that resets `syncing` ever attaches, wedging sync off for
      // the rest of the page's life. Self-heal right here: treat it as
      // just-written and persist that backfill, so this is the sole
      // backfill authority for every syncable key with a non-null local
      // value (covers both syncNow() and flushOnHide(), which calls
      // buildEntries() directly).
      var raw = Object.prototype.hasOwnProperty.call(m, k) ? m[k] : undefined;
      var ts = (typeof raw === "number" && isFinite(raw) && raw > 0) ? raw : nowMs();
      if (ts !== raw) { m[k] = ts; metaChanged = true; }
      entries[k] = { value: v, updatedAt: new Date(ts).toISOString() };
    });
    if (metaChanged) writeMeta(m);
    return entries;
  }

  function applyMerged(entries) {
    if (!entries) return false;
    var m = readMeta();
    var changed = false;
    var metaChanged = false;
    Object.keys(entries).forEach(function (k) {
      if (!syncable(k)) return;
      var remote = entries[k];
      var remoteMs = Date.parse(remote.updatedAt) || 0;
      var hasLocalMeta = Object.prototype.hasOwnProperty.call(m, k);
      var localMs = hasLocalMeta ? m[k] : undefined;
      var hasUsableLocalMeta = typeof localMs === "number" && isFinite(localMs) && localMs > 0;
      var localVal = localStorage.getItem(k);
      // No usable local meta for this key — either no record at all, or a
      // garbled non-numeric value (e.g. hand-edited in DevTools; left as-is
      // it would make every comparison below false and silently freeze
      // reconciliation for that key forever) — but a local value already
      // exists. That's "meta missing/corrupt, data didn't", not "never
      // synced": don't let a (possibly stale) remote value stomp real local
      // data. Keep local and backfill meta from now, so future syncs compare
      // correctly. Only take remote outright when there's no local value at
      // all.
      //
      // This branch is unreachable via syncNow() today: buildEntries()
      // already backfills/repairs meta for every syncable key with a
      // non-null local value before applyMerged() ever runs. It's retained
      // as defense-in-depth for the case where a prior writeMeta() call
      // silently failed (e.g. storage quota, private mode).
      if (!hasUsableLocalMeta && localVal !== null) {
        m[k] = nowMs();
        metaChanged = true;
        return;
      }
      var effectiveLocalMs = hasUsableLocalMeta ? localMs : 0;
      if (remoteMs > effectiveLocalMs || (remoteMs === effectiveLocalMs && localVal !== remote.value)) {
        try { localStorage.setItem(k, remote.value); } catch (e) { return; }
        m[k] = remoteMs;
        changed = true;
      }
    });
    if (changed || metaChanged) writeMeta(m);
    return changed;
  }

  function fetchWithTimeout(url, opts) {
    opts = opts || {};
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
    opts.signal = ctrl.signal;
    return fetch(url, opts).finally(function () { clearTimeout(t); });
  }

  // header.js/notifications.js refresh /me and the inbox on this same
  // cadence (interval / tab visible / online / sign-in) instead of running
  // their own timer. Debounced per-write syncs and manual calls don't tick.
  function emit(name, detail) {
    try { document.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {}
  }

  function syncNow(reason) {
    if (reason !== "debounce" && reason !== "manual" && isSignedIn()) emit("gym:synctick", reason);
    if (syncing || !isSignedIn()) return Promise.resolve(false);
    syncing = true;
    log("[sync] start", reason);
    var body = JSON.stringify({ entries: buildEntries() });
    return fetchWithTimeout(API_BASE + "/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + idToken },
      body: body
    })
      .then(function (res) {
        if (res.status === 401) { handleAuthLost("expired"); return null; }
        if (res.status === 403) {
          return res.json().catch(function () { return {}; }).then(function (b) {
            var code = b && b.error && (b.error.code || b.error);
            if ((code === "account_blocked" || code === "account_removed") && window.GymHeader && GymHeader.onBlocked) GymHeader.onBlocked(code === "account_removed");
            return null;
          });
        }
        if (!res.ok) throw new Error("progress PUT " + res.status);
        return res.json();
      })
      .then(function (doc) {
        if (!doc) return false;
        var changed = applyMerged(doc.entries);
        // A device still running an older app.js (pre male-plan-id rewrite)
        // can push old-id gym_checks/gym_weights/gym_sessions data at any
        // time — applyMerged() above may have just pulled exactly that onto
        // this device. Re-run the migration on whatever just landed so it
        // never sits here un-migrated (data-driven: a no-op when nothing
        // old-id-shaped came down). If it changed anything, schedule a
        // follow-up push so the migrated data reaches the server too,
        // rather than waiting on this device's next unrelated write.
        var migrated = false;
        try { migrated = !!(window.GymMigrations && window.GymMigrations.maleV2 && window.GymMigrations.maleV2()); } catch (e) {}
        if (migrated) { changed = true; scheduleDebouncedSync(); }
        if (changed && typeof window.GymApplyExternalUpdate === "function") {
          window.GymApplyExternalUpdate();
        } else if (changed) {
          location.reload();
        }
        log("[sync] ok, changed=", changed);
        return changed;
      })
      .catch(function (e) { log("[sync] failed", e && e.message); return false; })
      .finally(function () { syncing = false; });
  }

  // Best-effort flush right as the page goes away — closes the small window
  // where a write's debounce timer hadn't fired yet when the tab closed/was
  // backgrounded. fetch's keepalive keeps the request alive past unload the
  // same way sendBeacon does, but (unlike sendBeacon) still lets us set the
  // Authorization header this endpoint requires. Fire-and-forget: nothing
  // meaningful to do with the response during teardown, same as every other
  // sync path in this file.
  function flushOnHide() {
    if (!isSignedIn()) return;
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    try {
      fetch(API_BASE + "/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + idToken },
        body: JSON.stringify({ entries: buildEntries() }),
        keepalive: true
      });
    } catch (e) {}
  }

  function startTriggers() {
    if (triggersStarted) return;
    triggersStarted = true;
    window.addEventListener("online", function () { syncNow("online"); });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") syncNow("visible");
      else if (document.visibilityState === "hidden") flushOnHide();
    });
    document.addEventListener("pagehide", flushOnHide);
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(function () {
      if (document.visibilityState === "visible") syncNow("interval");
    }, INTERVAL_MS);
  }

  // ---- auth (Google Identity Services) ----
  function parseJwt(jwt) {
    try {
      var payload = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return { exp: payload.exp || 0, email: payload.email || "", name: payload.name || "", sub: payload.sub || "" };
    } catch (e) { return { exp: 0, email: "", name: "", sub: "" }; }
  }

  function onCredential(response) {
    // Definitive resolution of whatever sign-in attempt was in flight —
    // success or a malformed callback either way, so this can never get
    // stuck (see PENDING_KEY comment above).
    clearSignInPending();
    if (!response || !response.credential) return;
    acceptToken(response.credential, "google");
  }

  // Email/password sign-in (auth-email.js) hands over the gym-be-issued JWT
  // here. It carries the same claims this file reads from a Google token
  // (sub, email, exp), so it goes through the exact same account-switch
  // detection + first-sign-in migration below. Returns false for a token
  // that's unparseable or already (nearly) expired.
  function signInWithToken(token) {
    var p = parseJwt(token || "");
    if (!p.sub || !p.exp || p.exp * 1000 <= nowMs() + 30000) return false;
    clearSignInPending();
    acceptToken(token, "local");
    return true;
  }

  // Shared tail of both sign-in methods: install the token as THE session,
  // detect an account switch by JWT `sub` (gym_user_sub), migrate anon data
  // on first sign-in, and start syncing.
  function acceptToken(token, src) {
    idToken = token;
    source = src;
    var p = parseJwt(idToken);
    tokenExpEpoch = p.exp;
    profile = { email: p.email, name: p.name };
    try {
      if (src === "local") {
        localStorage.setItem(METHOD_KEY, "local");
        if (p.email) localStorage.setItem(EMAIL_KEY, p.email);
      } else {
        localStorage.removeItem(METHOD_KEY);
      }
    } catch (e) {}

    var storedSub = null;
    try { storedSub = localStorage.getItem("gym_user_sub"); } catch (e) {}

    // Account switch on a shared browser: the previous user's data is still in
    // localStorage and would otherwise be shown to — and pushed up for — the
    // new account. Wipe it and reload once; GIS auto-select signs the new
    // account straight back in and its data is pulled fresh. A sessionStorage
    // flag prevents a second wipe+reload if GIS bounces between accounts.
    if (p.sub && storedSub && storedSub !== p.sub) {
      var justSwitched = false;
      try { justSwitched = sessionStorage.getItem("gym_switch") === "1"; } catch (e) {}
      if (justSwitched) {
        try { localStorage.setItem("gym_user_sub", p.sub); } catch (e) {}
        try { sessionStorage.removeItem("gym_switch"); } catch (e) {}
      } else if (src === "local") {
        // A local JWT isn't silently re-issued after a reload the way GIS
        // auto-select re-issues a Google one, so skip the gym_switch
        // round-trip: wipe the previous account's data, then persist THIS
        // session (clearUserData() just dropped the cache) so initAuth()
        // restores it on the reload and pulls this account's data fresh.
        clearUserData();
        try { localStorage.setItem("gym_user_sub", p.sub); } catch (e) {}
        try { localStorage.removeItem("gym_anon"); } catch (e) {}
        saveCachedSession();
        location.reload();
        return;
      } else {
        clearUserData();
        try { localStorage.setItem("gym_user_sub", p.sub); } catch (e) {}
        try { localStorage.removeItem("gym_anon"); } catch (e) {}
        try { sessionStorage.setItem("gym_switch", "1"); } catch (e) {}
        location.reload();
        return;
      }
    } else {
      try { sessionStorage.removeItem("gym_switch"); } catch (e) {}
    }

    // First sign-in on this browser: record the account and push whatever local
    // (anonymous) progress exists up to it — a safe one-way LWW migration.
    var firstSignIn = false;
    try {
      if (p.sub && storedSub !== p.sub) {
        localStorage.setItem("gym_user_sub", p.sub);
        firstSignIn = true;
      }
    } catch (e) {}

    saveCachedSession();
    if (window.GymUI && typeof GymUI.completeSignIn === "function") GymUI.completeSignIn();
    renderAuthUI();
    startTriggers();
    syncNow(firstSignIn ? "signin-migrate" : "signin");
    scheduleTokenRefresh();
  }

  function scheduleTokenRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    if (!tokenExpEpoch) return;
    if (source === "local") {
      // No refresh endpoint for gym-be's own JWT: when it runs out (the same
      // 30s margin isSignedIn() uses), treat it exactly like a 401 — ask the
      // user to log in again.
      var left = tokenExpEpoch * 1000 - nowMs() - 30000;
      refreshTimer = setTimeout(function () {
        if (source === "local") handleAuthLost("expired");
      }, left > 0 ? left : 0);
      return;
    }
    var ms =tokenExpEpoch * 1000 - nowMs() - 120000;
    if (ms < 10000) ms = 10000;
    refreshTimer = setTimeout(function () {
      if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.prompt();
      }
    }, ms);
  }

  // reason "expired" = the session died on its own (401 / token ran out), as
  // opposed to an explicit sign-out. For a LOCAL session that means typing
  // the password again — auth-email.js opens its login view pre-filled
  // (GymAuthEmail.onSessionExpired) on top of the usual login screen.
  function handleAuthLost(reason) {
    var wasLocal = source === "local";
    var lostEmail = (profile && profile.email) || "";
    // Google keeps its pending GIS re-prompt timer exactly as before; a local
    // session's expiry timer is meaningless once the session is gone.
    if (wasLocal && refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
    idToken = null; tokenExpEpoch = 0; profile = null; source = null;
    if (wasLocal) clearCachedSession(); // dead local token: nothing to restore on reload
    renderAuthUI(); // flips any "Signed in as X" / sign-out button back to the Google button immediately, no refresh needed
    // Same pattern coach.js/chat.js/calendar.js already use on their own
    // 401s: a signed-out user gets sent to the real, dedicated login screen
    // (ui.js's onboarding overlay, jumped straight to the sign-in choices)
    // instead of being left on whatever tab happens to be cached.
    if (window.GymUI && typeof GymUI.promptSignIn === "function") GymUI.promptSignIn();
    if (reason === "expired" && wasLocal && window.GymAuthEmail && typeof GymAuthEmail.onSessionExpired === "function") {
      try { GymAuthEmail.onSessionExpired(lostEmail); } catch (e) {}
    }
  }

  function signOut() {
    handleAuthLost();                            // updates the auth UI + routes to the login screen, see above
    clearUserData();                             // don't leave this account's data for the next person
    try { localStorage.removeItem("gym_user_sub"); } catch (e) {}
    try { localStorage.removeItem(METHOD_KEY); localStorage.removeItem(EMAIL_KEY); } catch (e) {}
    // Deliberately NOT re-granting gym_anon="1" here: sign-out used to drop
    // the user straight back into the gated anon preview, which is a silent
    // third choice nobody made. It now leaves both isAuthed() and isAnon()
    // false, which ui.js's boot()/promptSignIn() routes to the same login
    // screen a signed-out, never-chosen visitor lands on (see ui.js boot()).
    // Anon mode is still available — just only via its own explicit
    // "Continue without signing in" button on that screen.
    try {
      if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
      }
    } catch (e) {}
    if (typeof window.GymAppRebuild === "function") window.GymAppRebuild();
    try { if (window.GymCalendar && typeof GymCalendar.refresh === "function") GymCalendar.refresh(); } catch (e) {}
  }

  function ensureAuthContainer() {
    var host = document.getElementById("moreAccount");
    if (!host) return null;
    var box = document.getElementById("gymSyncBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "gymSyncBox";
      host.appendChild(box);
    }
    return box;
  }

  function renderGoogleButton(target, opts) {
    if (!target || !(window.google && google.accounts && google.accounts.id)) return;
    try {
      target.innerHTML = "";
      // GsiButtonConfiguration supports its own `locale`, independent of the
      // ?hl= the gsi/client script was originally loaded with — this is what
      // lets refreshLocale() below just re-render instead of reloading the
      // script. Every render gets the current gisLang so a language toggle
      // never leaves a stale-language button up.
      var buttonOpts = opts;
      if (gisLang) {
        buttonOpts = {};
        for (var k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k)) buttonOpts[k] = opts[k]; }
        buttonOpts.locale = gisLang;
      }
      google.accounts.id.renderButton(target, buttonOpts);
      // GIS renders the actual button inside a cross-origin iframe, so
      // there's no real "onclick" of ours to hook before the popup/FedCM
      // prompt opens. A capturing pointerdown on this wrapping container
      // still reaches us — hit-testing starts in the parent document before
      // the iframe takes over — and fires right as the user taps, which is
      // the earliest reliable moment to record "a sign-in is starting" (see
      // PENDING_KEY / markSignInPending). Wired once per container, since
      // renderAuthUI() re-renders the button (and wipes its innerHTML) on
      // every auth-state change but the container element itself persists.
      if (!target._gymPendingWired) {
        target.addEventListener("pointerdown", markSignInPending, true);
        target._gymPendingWired = true;
      }
    } catch (e) {}
  }

  function renderAuthUI() {
    var signedIn = isSignedIn();
    // Every auth transition (session restore, sign-in, auth lost, sign-out)
    // passes through here — header.js listens to show/hide the top bar. But
    // renderAuthUI() is also called for reasons that aren't an auth
    // transition (e.g. refreshLocale() on a language toggle), so only emit
    // when signedIn actually changed — listeners like header.js's
    // onAuthChange() unconditionally refetch on every event.
    if (signedIn !== lastAuthEmit) {
      lastAuthEmit = signedIn;
      emit("gym:authchange", signedIn);
    }

    // The onboarding hero's Google button — full-width dark pill with the
    // logo and label (filled_black is the closest Google's own renderer
    // gets to a bordered near-black button; GIS renders inside an iframe,
    // so it can't be restyled with our own CSS beyond these options),
    // revealed alongside "Continue without signing in" after the Start
    // step (see ui.js).
    var ob = document.getElementById("obGoogleBtn");
    if (ob && !signedIn) {
      renderGoogleButton(ob, { theme: "filled_black", size: "large", type: "standard", text: "continue_with", shape: "pill", logo_alignment: "left", width: 280 });
    }

    var box = ensureAuthContainer();
    if (!box) return;
    if (signedIn) {
      box.innerHTML =
        '<div class="sp-label">' + s("syncLabel") + '</div>' +
        '<div class="sync-signed">' + s("signedInAs") + ' <b></b></div>';
      box.querySelector(".sync-signed b").textContent = (profile && profile.email) || "";
    } else {
      box.innerHTML =
        '<div class="sp-label">' + s("syncLabel") + '</div>' +
        '<div id="gymSyncBtn"></div>' +
        '<p class="sync-hint">' + s("syncHint") + '</p>';
      renderGoogleButton(box.querySelector("#gymSyncBtn"),
        { theme: "outline", size: "medium", type: "standard" });
    }
  }

  // True when there's a real, legitimate reason to hold on a "resolving…"
  // screen and let GIS attempt a silent re-auth, instead of either an
  // immediate login screen or (just as importantly) instead of silently
  // doing nothing to an unrelated anon-preview visitor's session. Three
  // distinct signals, each covering a different refresh-mid-flow gap:
  //  - isSignInPending(): a sign-in the user just started on this tab
  //    (Google button tapped). Overrides an existing anon choice — the user
  //    is actively mid-upgrade from anon to authed right now, and that
  //    in-progress action outranks whatever they'd picked before it started
  //    — but ONLY within PENDING_ANON_OVERRIDE_MAX_AGE_MS, a much tighter
  //    window than the marker's general PENDING_MAX_AGE_MS lifetime. The
  //    marker is set on any pointerdown near a Google button, including the
  //    More→Sync panel's, which is reachable mid ordinary anon browsing
  //    with no overlay up at all — a graze or a backed-out tap sets the
  //    same marker a real sign-in does, and without this tighter window
  //    that alone could hold an anon session's login overlay open for up to
  //    2 minutes on an unrelated refresh. A genuine popup/FedCM round trip
  //    settles within a few seconds, so this doesn't meaningfully shrink
  //    the real "refresh mid-upgrade" case it exists for. Outside anon mode
  //    there's no anon session to protect, so the full window still applies.
  //  - gym_switch: sync.js's own account-switch reload (onCredential()'s
  //    storedSub-mismatch branch) — a real credential just verified for a
  //    *different* account than the one on this device; always an active
  //    authed transition, never something an anon visitor triggers, so no
  //    shortened window is needed here.
  //  - gym_user_sub with no explicit anon choice: this device has signed in
  //    before (localStorage survives a browser restart; the session cache
  //    and the two markers above are sessionStorage and don't) and never
  //    said "continue without signing in" since — a cold start, not a
  //    fresh/anon visitor, so it's worth a moment for auto_select/FedCM to
  //    silently restore the session before falling to the login screen.
  //    Gated on gym_anon so an explicit anon choice made after a session
  //    lapsed is respected on every later cold start, not just this tab.
  function shouldResolveSilently() {
    if (isSignedIn()) return false;
    var anon = false;
    try { anon = localStorage.getItem("gym_anon") === "1"; } catch (e) {}
    if (isSignInPending()) {
      if (!anon) return true;
      var age = pendingMarkerAgeMs();
      return age >= 0 && age < PENDING_ANON_OVERRIDE_MAX_AGE_MS;
    }
    try { if (sessionStorage.getItem("gym_switch") === "1") return true; } catch (e) {}
    try {
      // ...except when the last session here was an email/password one: GIS
      // can't silently restore a gym-be local JWT, so "resolving…" would just
      // be an 8s dead wait (auth-email.js opens its login view instead).
      if (!anon && localStorage.getItem("gym_user_sub") && localStorage.getItem(METHOD_KEY) !== "local") return true;
    } catch (e) {}
    return false;
  }

  // Give up on resuming a mid-flight sign-in/switch/cold-start and fall back
  // to the ordinary login screen. Shared by the prompt() moment-listener,
  // error_callback, s.onerror, and the hard timeout below, so "give up"
  // always means the same things: stop treating any of the three signals
  // above as live, stop showing "resolving…", and put the user somewhere
  // real instead of leaving them stuck on a hold screen.
  //
  // Gating this on shouldResolveSilently() (re-checked fresh at call time,
  // not just "was a marker ever set") is also what keeps it from firing on
  // routine GIS chatter that has nothing to do with any of this: `prompt()`
  // runs unconditionally for every non-signed-in visitor including
  // anon-preview ones, and error_callback fires routinely for those
  // (opt_out_or_no_session, unknown, ...) — with no pending marker, no
  // switch, and gym_anon="1", shouldResolveSilently() is false and this is
  // a complete no-op instead of forcing the login overlay open over an
  // untouched anon session.
  function abandonPendingSignIn() {
    if (!shouldResolveSilently()) return;
    clearSignInPending();
    try { sessionStorage.removeItem("gym_switch"); } catch (e) {}
    if (!isSignedIn() && window.GymUI && typeof GymUI.promptSignIn === "function") GymUI.promptSignIn();
  }

  function initAuth() {
    // Restore a still-valid session immediately, before the Google script even
    // loads — the app should look signed-in on the very first paint of a
    // reload, not flash "signed out" while GIS does a network round-trip.
    // Read before the CLIENT_ID gate: an email/password (local) session
    // doesn't depend on Google being configured at all.
    var cached = loadCachedSession();
    if (!CLIENT_ID && !(cached && cached.source === "local")) {
      log("[sync] no GOOGLE_CLIENT_ID, sync disabled");
      return;
    }
    if (cached) {
      idToken = cached.token;
      tokenExpEpoch = cached.exp;
      profile = cached.profile || null;
      source = cached.source || "google";
      if (window.GymUI && typeof GymUI.completeSignIn === "function") GymUI.completeSignIn();
      renderAuthUI();
      startTriggers();
      scheduleTokenRefresh();
      if (!CLIENT_ID) return; // local session, Google not configured: no GIS to load
    } else if (shouldResolveSilently()) {
      // No completed session, but one of the three legitimate reasons above
      // to expect a silent re-auth might still land. Nothing to literally
      // resume — the whole JS context reloaded — but hold a neutral
      // "resolving…" screen instead of dropping straight to "signed out"
      // while GIS's own auto_select/prompt() below gets a chance. A hard
      // timeout guarantees this never outlives a few seconds even if the
      // GIS script hangs and neither onload nor onerror ever fires.
      if (window.GymUI && typeof GymUI.showResolvingSession === "function") GymUI.showResolvingSession();
      setTimeout(abandonPendingSignIn, 8000);
    }

    var s = document.createElement("script");
    s.id = "gymGsiScript";
    gisLang = appLang();
    s.src = "https://accounts.google.com/gsi/client?hl=" + gisLang;
    s.async = true; s.defer = true;
    s.onload = function () {
      try {
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: onCredential,
          auto_select: true,
          use_fedcm_for_prompt: true,
          hl: gisLang, // harmless if GIS ignores it; the script's own ?hl= above is what actually governs the UI language
          // A definitive failure of a button-triggered flow (popup closed,
          // FedCM aborted, third-party sign-in blocked, ...) — onCredential
          // never fires for these. Also fires routinely for ordinary
          // anon/first-visit prompts with nothing pending at all; the
          // shouldResolveSilently() gate inside abandonPendingSignIn() is
          // what keeps those a no-op instead of surfacing the login screen.
          error_callback: function () { abandonPendingSignIn(); }
        });
        renderAuthUI();
        // Only auto-prompt (One Tap) when we don't already have a live
        // session. Firing it unconditionally alongside the onboarding
        // screen's own explicit "Sign in with Google" button is what made a
        // first-time visit show two separate sign-in prompts.
        if (!isSignedIn()) {
          google.accounts.id.prompt(function (notification) {
            // Only worth interpreting when we're actually holding for one of
            // the reasons above — an ordinary anonymous/first-visit prompt
            // has its own onboarding screen already and none of this
            // applies. Note: isNotDisplayed()/isSkippedMoment() are
            // partial/unsupported under FedCM (use_fedcm_for_prompt above),
            // so this often won't fire before the 8s timeout does instead —
            // that's fine, the timeout is the real backstop either way.
            if (!shouldResolveSilently()) return;
            var settled = false;
            try {
              settled = (notification.isNotDisplayed && notification.isNotDisplayed()) ||
                        (notification.isSkippedMoment && notification.isSkippedMoment()) ||
                        (notification.isDismissedMoment && notification.isDismissedMoment());
            } catch (e) { settled = true; }
            if (settled) abandonPendingSignIn();
          });
        }
      } catch (e) { log("[sync] GIS init failed", e && e.message); }
    };
    s.onerror = function () {
      log("[sync] GIS script failed to load");
      abandonPendingSignIn();
    };
    document.head.appendChild(s);
  }

  // P0-3: called from app.js's applyLang() on every language toggle (the
  // same spot that already re-triggers GymCoach/GymCalendar). GIS buttons
  // take a per-render `locale` (GsiButtonConfiguration.locale), so a toggle
  // just updates gisLang and re-renders through renderAuthUI() ->
  // renderGoogleButton() — no script reload, no throwing away and
  // re-running google.accounts.id.initialize() (which used to risk a
  // double-init if a toggle landed before the first load finished).
  function refreshLocale(lang) {
    if (!CLIENT_ID) return; // no GIS ever loaded, nothing to refresh
    gisLang = lang === "ar" ? "ar" : "en";
    renderAuthUI();
  }

  window.GymSync = {
    onLocalWrite: onLocalWrite,
    syncNow: function (r) { return syncNow(r || "manual"); },
    isSignedIn: isSignedIn,
    // Current Google ID token for auth..."Bearer" calls to gym-be / gym-assistant.
    // null when signed out or the token is within 30s of expiry.
    token: function () { return isSignedIn() ? idToken : null; },
    // "google" | "local" (email/password gym-be JWT) | null when signed out.
    authMethod: function () { return isSignedIn() ? source : null; },
    // Email/password sign-in success (auth-email.js): install a gym-be JWT as
    // the session — same switch detection / migration / sync as Google.
    signInWithToken: signInWithToken,
    profile: function () { return profile ? { email: profile.email, name: profile.name } : null; },
    signOut: signOut,
    // True when a sign-in was started on this tab (Google button tapped)
    // and hasn't yet resolved (success or definitive failure) — see
    // PENDING_KEY.
    isSignInPending: isSignInPending,
    // True when there's a legitimate reason (a mid-flight sign-in, an
    // account-switch reload, or a cold start on a device that's signed in
    // before and hasn't explicitly gone anon) to hold ui.js's boot() on a
    // "resolving…" screen instead of either an immediate login screen or a
    // silent no-op over an anon-preview session. See shouldResolveSilently().
    shouldResolveSilently: shouldResolveSilently,
    // Lets ui.js's startAnon() clean up a marker for a sign-in the user
    // backed out of before it resolved (tapped the Google button, then
    // chose "Continue without signing in" instead) — otherwise it could
    // still be fresh enough to interrupt this same anon session with the
    // resolving overlay on a later reload within PENDING_MAX_AGE_MS.
    clearSignInPending: clearSignInPending,
    // P0-3: re-renders the Google Sign-In button(s) with the app's own
    // EN/AR toggle as the locale, instead of the browser/OS locale. Safe to
    // call even when Google isn't configured (no-op).
    refreshLocale: refreshLocale,
    _debug: {
      gymKeys: gymKeys, readMeta: readMeta, buildEntries: buildEntries,
      loadCachedSession: loadCachedSession, clearCachedSession: clearCachedSession,
      flushOnHide: flushOnHide,
      markSignInPending: markSignInPending, clearSignInPending: clearSignInPending,
      abandonPendingSignIn: abandonPendingSignIn,
      // identity-forging / data-wiping hooks: test builds only, never on the
      // real production origin (see IS_PROD above).
      onCredential: IS_PROD ? undefined : onCredential,
      clearUserData: IS_PROD ? undefined : clearUserData
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuth);
  } else {
    initAuth();
  }
})();
