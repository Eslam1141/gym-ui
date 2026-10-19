// Runs synchronously from <head> (no inline script: the CSP allows 'self' scripts only).
// 1. Old password-reset links (/?reset_token=...) belong to the app.
// 2. Returning users (local app state) go straight to the app, unless ?home.
//    ?home is the explicit way to see the landing (a referrer check would
//    be fragile: installed PWAs and privacy settings drop it).
// 3. Language and direction are set before first paint.
(function () {
  var d = document.documentElement;
  var ls = null;
  try { ls = window.localStorage; } catch (e) {}
  var qs = location.search;
  if (/[?&]reset_token=/.test(qs)) { location.replace("/app/" + qs); return; }
  if (ls && !/[?&]home(=|&|$)/.test(qs) && (ls.getItem("gym_user_sub") || ls.getItem("gym_anon") === "1")) {
    location.replace("/app/");
    return;
  }
  // Auth status for the header and CTAs, from local flags only (never the API).
  // Re-run on pageshow: a bfcache restore skips this script.
  function status() {
    var sub = false, anon = false, email = "";
    try { sub = !!ls.getItem("gym_user_sub"); anon = ls.getItem("gym_anon") === "1"; email = ls.getItem("gymauth_email") || ""; } catch (e) {}
    d.classList.remove("auth-signed", "auth-guest");
    if (sub) d.classList.add("auth-signed");
    else if (anon) d.classList.add("auth-guest");
    if (sub && /^[a-z0-9]/i.test(email)) d.style.setProperty("--auth-initial", '"' + email.charAt(0).toUpperCase() + '"');
    else d.style.removeProperty("--auth-initial");
  }
  status();
  window.addEventListener("pageshow", function (ev) { if (ev.persisted) status(); });
  var lang = ls && ls.getItem("gym_lang");
  if (lang !== "ar" && lang !== "en") lang = /^ar/i.test(navigator.language || "") ? "ar" : "en";
  d.lang = lang;
  d.dir = lang === "ar" ? "rtl" : "ltr";
  if (lang === "ar") d.classList.add("pending");
})();
