// The hash suffix is substituted at Docker build time (see Dockerfile) with
// a sha256 of the actual ASSETS file contents below, so CACHE_NAME changes
// automatically whenever a precached asset's content changes — and stays
// identical across rebuilds when nothing changed, so browsers don't see
// needless churn. This replaces the old hand-maintained "repvane-vNN" bumps
// (a recurring source of "stale content after deploy" bugs when someone
// forgot to bump the literal). The activate handler below already deletes
// any cache key that isn't the current CACHE_NAME, so a changed hash cleans
// up the old cache for free.
//
// "__CACHE_HASH__" is also the literal fallback: if this file is served
// unprocessed (e.g. local testing via `python -m http.server`, no Docker
// build), CACHE_NAME is just this fixed string — still syntactically valid
// and fully functional, just not content-addressed.
const CACHE_NAME = "etqadem-__CACHE_HASH__";
const ASSETS = [
  "./index.html",
  "./styles.css",
  "./theme-boot.js",
  "./app.js",
  "./ui.js",
  "./mascot.js",
  "./coach.js",
  "./checkin.js",
  "./chat.js",
  "./food.js",
  "./sync.js",
  "./auth-email.js",
  "./auth-email.css",
  "./signin-fx.js",
  "./signin-fx.css",
  "./rest-days.js",
  "./calendar.js",
  "./workout-builder.js",
  "./header.js",
  "./notifications.js",
  "./profile.js",
  "./hero-video.js",
  "./metallic-button.js",
  "./toast.js",
  "./beams-bg.js",
  "./config.js",
  "./manifest.json",
  "./icons/logo-etq.svg",
  "./icons/coach.svg",
  "./icons/avatar-default.svg",
  "./icons/icon-192-etq.png",
  "./icons/icon-512-etq.png",
  "./icons/icon-maskable-192-etq.png",
  "./icons/icon-maskable-512-etq.png",
  "./icons/apple-touch-icon-etq.png",
  "./icons/favicon-32-etq.png",
  "./icons/favicon-16-etq.png",
  "./fonts/alexandria-var.woff2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  // Cross-origin requests (Google avatars, cdnjs, onboarding video) go
  // straight to the network: this worker's own CSP connect-src would block
  // them if it fetched them itself.
  if (url.origin !== self.location.origin) return;
  // Never intercept API or Google Identity traffic — sync freshness and auth
  // are handled in sync.js, and these must always hit the network.
  if (url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/admin") ||
      url.pathname.startsWith("/app/admin") ||
      url.hostname.endsWith("googleapis.com") ||
      url.hostname === "accounts.google.com") {
    return;
  }

  // Network-first: a fresh deploy must show up on the very next load, not one
  // refresh later. The old cache-first-with-background-update strategy served
  // last visit's stale app.js/coach.js immediately every time, which is why a
  // shipped fix could look like it "didn't happen" until a second reload.
  // Cache is now purely the offline fallback.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Never persist a password-reset URL (/?reset_token=... or
        // /reset-password?token=...) into Cache Storage: the cache key is the
        // full URL, so the live reset token would sit on disk until evicted.
        const holdsSecret = url.searchParams.has("reset_token") ||
          /\/reset-password$/.test(url.pathname);
        if (!holdsSecret && networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
