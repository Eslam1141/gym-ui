/* header.js — the shared top-right header container (#topBar).
 *
 * One container, three things, signed-in users only:
 *   [🔥N streak badge] [notification bell slot] [avatar ▾ menu]
 * The bell itself is rendered by notifications.js into slot("bell"); this
 * file only reserves the spot so both features share one piece of chrome
 * (see the profile-photo-streak and in-app-notifications specs).
 *
 * Also owns the cached GET /me document (profile.js reads the same copy)
 * and the profile photo, which GET /me/photo only serves with the Bearer
 * header — so it's fetched as a blob and turned into a data: URL (the CSP's
 * img-src allows data: but not blob:).
 *
 * Refresh cadence rides sync.js: `gym:authchange` (sign-in/out, session
 * restore, auth lost) and `gym:synctick` (2-min interval / tab visible /
 * back online / sign-in). No timer of its own. */
(function () {
  "use strict";

  var API_BASE = (window.GYM_API_BASE || "/api/v1").replace(/\/+$/, "");
  var FETCH_TIMEOUT_MS = 8000;

  // ---------------- i18n (app.js's T table via its global t()) ----------------
  function str(key, params) {
    var out = (typeof window.t === "function") ? window.t(key) : key;
    if (params) out = out.replace(/\{(\w+)\}/g, function (_, k) { return params[k] != null ? params[k] : ""; });
    return out;
  }

  // ---------------- auth + fetch (calendar.js fetchTimeout/authToken pattern) ----------------
  function isAuthed() { return !!(window.GymSync && typeof GymSync.isSignedIn === "function" && GymSync.isSignedIn()); }
  function authToken() { return window.GymSync && GymSync.token ? GymSync.token() : null; }

  function api(path, opts) {
    var token = authToken();
    if (!token) return Promise.reject(new Error("signed-out"));
    opts = opts || {};
    var headers = opts.headers || {};
    headers["Authorization"] = "Bearer " + token;
    opts.headers = headers;
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, opts.timeoutMs || FETCH_TIMEOUT_MS);
    opts.signal = ctrl.signal;
    return fetch(API_BASE + path, opts).finally(function () { clearTimeout(timer); });
  }

  // ---------------- state ----------------
  var me = null;          // last GET /me document for the signed-in user
  var photoData = null;   // data: URL of the user's photo, or null
  var photoLoadedFor = null; // user id the photo cache belongs to
  var photoLoadedURL = null; // me.photoURL the cached photo was loaded from
  var listeners = [];
  var meSeq = 0;

  function emitChange() {
    listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { if (window.console) console.warn("header listener failed", e); } });
  }

  function clearState() {
    me = null; photoData = null; photoLoadedFor = null; photoLoadedURL = null;
    meSeq++; // drop any in-flight /me response for the previous account
  }

  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }

  function reloadPhoto() {
    if (!me || !me.photoURL) { photoData = null; photoLoadedFor = me ? me.id : null; emitChange(); return Promise.resolve(null); }
    var forId = me.id, forURL = me.photoURL;
    // photoURL is either "/me/photo" (uploaded, fetched with auth and
    // converted to a data: URL) or an absolute https URL (the Google
    // picture fallback) which img-src https: lets us load directly.
    if (/^https:\/\//i.test(me.photoURL)) {
      photoData = forURL; photoLoadedFor = forId; photoLoadedURL = forURL;
      render(); emitChange();
      return Promise.resolve(photoData);
    }
    return api("/me/photo", { timeoutMs: 15000 })
      .then(function (res) {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("photo " + res.status);
        return res.blob().then(blobToDataURL);
      })
      .then(function (url) {
        if (!me || me.id !== forId) return null; // account changed meanwhile
        photoData = url; photoLoadedFor = forId; photoLoadedURL = forURL;
        render(); emitChange();
        return url;
      })
      .catch(function () { return null; });
  }

  var blockedShown = false;
  function onBlocked(removed) {
    if (blockedShown) return;
    blockedShown = true;
    if (window.GymSync && typeof GymSync.signOut === "function") GymSync.signOut();
    // Account deleted (on this or another device): drop its local data and
    // offline queue too, so nothing replays into a future account.
    if (removed === true && window.GymPrivacy && GymPrivacy.wipeLocal) GymPrivacy.wipeLocal();
    if (window.GymToast) GymToast.show({ message: str(removed === true ? "hdrRemoved" : "hdrBlocked"), duration: 10000 });
    setTimeout(function () { blockedShown = false; }, 3000);
  }

  function refreshMe() {
    if (!isAuthed()) { clearState(); render(); emitChange(); return Promise.resolve(null); }
    var seq = ++meSeq;
    return api("/me?today=" + window.GymDate.key())
      .then(function (res) {
        if (res.status === 403) {
          return res.json().catch(function () { return {}; }).then(function (b) {
            var code = b && b.error && (b.error.code || b.error);
            if (code === "account_blocked") onBlocked();
            else if (code === "account_removed") onBlocked(true);
            throw new Error("me 403");
          });
        }
        if (!res.ok) throw new Error("me " + res.status);
        return res.json();
      })
      .then(function (doc) {
        if (seq !== meSeq || !isAuthed()) return me;
        me = doc || {};
        render();
        emitChange();
        if (me.photoURL && (me.id !== photoLoadedFor || me.photoURL !== photoLoadedURL || !photoData)) reloadPhoto();
        else if (!me.photoURL && photoData) { photoData = null; render(); emitChange(); }
        return me;
      })
      .catch(function () { render(); return me; });
  }

  // Merge a local change (e.g. a successful PUT /me/profile) into the cache
  // without a round-trip.
  function setMe(patch) {
    if (!me) me = {};
    Object.keys(patch || {}).forEach(function (k) { me[k] = patch[k]; });
    render();
    emitChange();
  }

  // ---------------- DOM ----------------
  var bar, streakEl, bellSlot, avatarBtn, avatarImg, menu;

  var DEFAULT_AVATAR = "icons/avatar-default.svg";

  function displayName() {
    if (me && me.displayName) return me.displayName;
    if (me && me.name) return me.name;
    var p = window.GymSync && GymSync.profile ? GymSync.profile() : null;
    return (p && (p.name || p.email)) || "";
  }

  function build() {
    bar = document.getElementById("topBar");
    if (!bar) return false;
    bar.innerHTML =
      '<span class="tb-streak" id="tbStreak" hidden></span>' +
      '<span class="tb-slot" id="tbBellSlot"></span>' +
      '<div class="tb-avatar-wrap">' +
      '  <button type="button" class="tb-avatar" id="tbAvatar" aria-haspopup="menu" aria-expanded="false">' +
      '    <img alt="" id="tbAvatarImg" width="36" height="36">' +
      '  </button>' +
      '  <div class="tb-menu" id="tbMenu" role="menu" hidden>' +
      '    <div class="tb-menu-name" id="tbMenuName"></div>' +
      '    <button type="button" role="menuitem" id="tbMenuProfile"></button>' +
      '    <button type="button" role="menuitem" id="tbMenuAdmin" hidden></button>' +
      '    <button type="button" role="menuitem" id="tbMenuSignOut"></button>' +
      '  </div>' +
      '</div>';
    streakEl = document.getElementById("tbStreak");
    bellSlot = document.getElementById("tbBellSlot");
    avatarBtn = document.getElementById("tbAvatar");
    avatarImg = document.getElementById("tbAvatarImg");
    // Google picture URLs can expire or be rate-limited: fall back to the default.
    avatarImg.addEventListener("error", function () {
      if (avatarImg.getAttribute("src") !== DEFAULT_AVATAR) avatarImg.setAttribute("src", DEFAULT_AVATAR);
      avatarBtn.classList.add("is-default");
    });
    menu = document.getElementById("tbMenu");

    avatarBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      setMenuOpen(menu.hidden);
    });
    document.getElementById("tbMenuProfile").addEventListener("click", function () {
      setMenuOpen(false);
      if (window.GymUI && typeof GymUI.navigate === "function") {
        // profile.js reads this to send "Back" to wherever the user
        // actually came from instead of always landing on "plan".
        try { window.__gymPrevTab = (typeof GymUI.currentTab === "function") ? GymUI.currentTab() : "plan"; } catch (e) {}
        GymUI.navigate("profile");
      }
    });
    document.getElementById("tbMenuAdmin").addEventListener("click", function () {
      setMenuOpen(false);
      window.location.href = "admin.html"; // relative (app lives at /app/); same tab: sessionStorage session carries over
    });
    document.getElementById("tbMenuSignOut").addEventListener("click", function () {
      setMenuOpen(false);
      if (window.GymSync && typeof GymSync.signOut === "function") GymSync.signOut();
    });
    document.addEventListener("click", function (e) {
      if (menu && !menu.hidden && !menu.contains(e.target)) setMenuOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu && !menu.hidden) { setMenuOpen(false); avatarBtn.focus(); }
    });
    return true;
  }

  function setMenuOpen(open) {
    if (!menu) return;
    menu.hidden = !open;
    avatarBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      var first = document.getElementById("tbMenuProfile");
      if (first) first.focus();
    }
  }

  function render() {
    if (!bar && !build()) return;
    var show = isAuthed();
    bar.hidden = !show;
    document.body.classList.toggle("has-topbar", show);
    if (!show) { setMenuOpen(false); return; }

    var streak = (me && +me.currentStreak) || 0;
    if (streak > 0) {
      streakEl.hidden = false;
      streakEl.textContent = "🔥" + streak;
      // Today not trained yet: the streak is still alive (it only breaks after
      // a full missed day), so show it dimmed instead of hiding it.
      var pending = me.todayDone === false && me.todayRested !== true;
      var label = str(pending ? "hdrStreakPending" : "hdrStreak", { n: streak });
      streakEl.classList.toggle("is-pending", pending);
      streakEl.title = label;
      streakEl.setAttribute("aria-label", label);
    } else {
      streakEl.hidden = true;
      streakEl.textContent = "";
    }

    var src = photoData || DEFAULT_AVATAR;
    avatarImg.setAttribute("referrerpolicy", "no-referrer");
    if (avatarImg.getAttribute("src") !== src) avatarImg.setAttribute("src", src);
    avatarBtn.classList.toggle("is-default", !photoData);
    avatarBtn.setAttribute("aria-label", str("hdrAccountMenu"));
    document.getElementById("tbMenuName").textContent = displayName();
    document.getElementById("tbMenuProfile").textContent = str("hdrGoProfile");
    var adminItem = document.getElementById("tbMenuAdmin");
    adminItem.hidden = !(me && me.isAdmin === true);
    adminItem.textContent = str("hdrAdmin");
    document.getElementById("tbMenuSignOut").textContent = str("hdrSignOut");
  }

  // ---------------- wiring ----------------
  function onAuthChange() {
    if (!isAuthed()) { clearState(); render(); emitChange(); return; }
    var p = window.GymSync && GymSync.profile ? GymSync.profile() : null;
    // A different account than the cached /me belongs to: drop it first so
    // nothing from the previous user is shown even briefly.
    if (me && p && p.email && me.email && p.email !== me.email) clearState();
    render();
    refreshMe();
  }

  function init() {
    build();
    render();
    document.addEventListener("gym:authchange", onAuthChange);
    document.addEventListener("gym:synctick", function (e) {
      // sign-in ticks are already covered by the gym:authchange that
      // precedes them — skip the duplicate /me request.
      var reason = e && e.detail;
      if (reason === "signin" || reason === "signin-migrate") return;
      if (isAuthed()) refreshMe();
    });
    document.addEventListener("gym:workoutcomplete", function () { if (isAuthed()) refreshMe(); });
    document.addEventListener("gym:restchange", function () { if (isAuthed()) refreshMe(); });
    // Language switches rewrite <html lang>; re-render our strings then.
    try {
      new MutationObserver(function () { render(); emitChange(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    } catch (e) {}
    if (isAuthed()) refreshMe();
  }

  window.GymHeader = {
    api: api,
    str: str,
    isAuthed: isAuthed,
    me: function () { return me; },
    refreshMe: refreshMe,
    setMe: setMe,
    onBlocked: onBlocked,
    photo: function () { return photoData; },
    reloadPhoto: reloadPhoto,
    defaultAvatar: DEFAULT_AVATAR,
    onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); },
    slot: function (name) { if (!bar) build(); return name === "bell" ? bellSlot || null : null; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
