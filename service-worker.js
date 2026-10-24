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
const NETWORK_TIMEOUT_MS = 4000;
const ASSETS = [
  "./index.html",
  "./styles.css",
  "./theme-boot.js",
  "./boot-loader.js",
  "./app.js",
  "./muscle-art.js",
  "./muscle-map.js",
  "./splits.js",
  "./ui.js",
  "./mascot.js",
  "./coach-consent.js",
  "./coach.js",
  "./checkin.js",
  "./chat.js",
  "./food.js",
  "./sync.js",
  "./auth-email.js",
  "./auth-email.css",
  "./privacy.js",
  "./privacy.css",
  "./onboarding.js",
  "./onboarding.css",
  "./survey.js",
  "./survey.css",
  "./terms-update.js",
  "./motion.js",
  "./motion.css",
  "./tour.js",
  "./tour.css",
  "./celebrate.js",
  "./rest-days.js",
  "./calendar.js",
  "./workout-builder.js",
  "./header.js",
  "./feedback.js",
  "./native-shell.js",
  "./notifications.js",
  "./profile.js",
  "./watch.js",
  "./watch.css",
  "./watch-screen.js",
  "./watch-screen.css",
  "./toast.js",
  "./dom.js",
  "./config.js",
  "./manifest.json",
  "./vendor/html2canvas.min.js",
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
  "./fonts/readex-pro-var.woff2"
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

// A web-push notification tap: reuse an open window (the app routes the url
// itself, see notifications.js) instead of opening a duplicate.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = new URL(data.url || "./", self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const win = list.find((c) => "focus" in c);
      if (!win) return self.clients.openWindow(url);
      win.postMessage({ type: "gym:route", url });
      return win.focus();
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  // Cross-origin requests (Google avatars) go
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
  const cachedFallback = () =>
    caches.match(event.request).then((hit) => {
      if (hit) return hit;
      // Offline launch/refresh of the app shell: start_url "./" and the
      // password-reset route are not cache keys themselves (the ASSETS
      // list holds ./index.html), so serve the cached shell for any
      // page navigation instead of the browser's offline error page.
      if (event.request.mode === "navigate") return caches.match("./index.html");
      return hit;
    });

  const network = fetch(event.request).then((networkResponse) => {
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
  });

  // A dead-but-connected network (captive portal, black hole) makes fetch()
  // hang rather than fail, which would strand the app on a blank screen. If
  // the network has not answered within NETWORK_TIMEOUT_MS and we hold a
  // cached copy, serve that; the fetch keeps going and refreshes the cache.
  const timeout = new Promise((resolve) => {
    setTimeout(() => {
      cachedFallback().then((hit) => { if (hit) resolve(hit); });
    }, NETWORK_TIMEOUT_MS);
  });

  event.respondWith(
    Promise.race([network, timeout]).catch(() => cachedFallback())
  );
});
