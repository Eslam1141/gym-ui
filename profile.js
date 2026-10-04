/* profile.js — the Profile screen (#screen-profile): photo, editable stats
 * (display name / weight / height), streak + total-days progress, sign-out.
 *
 * Reached only via the avatar menu in #topBar (header.js) — not a
 * bottom-nav tab. Shares header.js's cached GET /me document and photo
 * cache via window.GymHeader (same account, same round-trips, no duplicate
 * polling): GymHeader.me()/photo()/refreshMe()/setMe()/reloadPhoto()/api().
 *
 * Photo upload (POST /me/photo): a RAW body with Content-Type image/jpeg or
 * image/png (NOT multipart), 5 MiB cap, 204 on success. Photos are
 * downscaled client-side to <=1024px JPEG via FileReader -> Image -> canvas
 * before upload (fallback: the original file) so typical phone photos clear
 * the cap without the user thinking about it.
 *
 * Profile save (PUT /me/profile): body exactly {displayName, weightKg,
 * heightCm}, all three required (backend rejects a missing one); bounds
 * mirrored client-side from gym-be's validateProfile (internal/api/me.go):
 * displayName 1-50 chars trimmed, weightKg 20-400, heightCm 50-250. */
(function () {
  "use strict";

  // ---------------- pure helper: client-side bounds ----------------
  // Mirrors gym-be's validateProfile exactly (internal/api/me.go) so a
  // client-valid submission is never rejected by the server. Returns the
  // first failing field's T key, or null when all three are valid.
  function utf8Len(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }

  function validateProfile(name, weightKg, heightCm) {
    var trimmed = String(name == null ? "" : name).trim();
    // gym-be checks len(name) — Go's len() counts UTF-8 BYTES, not
    // characters — so an Arabic name (2 bytes/letter) over 25 letters is
    // rejected server-side. Mirror the byte count so the user gets the
    // specific field error instead of a generic save failure.
    var bytes = utf8Len(trimmed);
    if (bytes < 1 || bytes > 50) return "profNameErr";
    var w = Number(weightKg);
    if (!isFinite(w) || w < 20 || w > 400) return "profWeightErr";
    var h = Number(heightCm);
    if (!isFinite(h) || h < 50 || h > 250) return "profHeightErr";
    return null;
  }

  // Exposed for a plain-node smoke test of the pure validateProfile() helper
  // only; no effect in the browser (loaded as a plain <script>, not a
  // module, so `module` is undefined there).
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { validateProfile: validateProfile };
  }

  // Everything below touches the DOM/window and only runs in the browser.
  if (typeof window === "undefined") return;

  var MAX_PHOTO_BYTES = 5 * 1024 * 1024;
  var MAX_PHOTO_DIM = 1024;

  function str(key, params) {
    return (window.GymHeader && typeof GymHeader.str === "function")
      ? GymHeader.str(key, params)
      : ((typeof window.t === "function") ? window.t(key) : key);
  }
  function isAuthed() { return !!(window.GymHeader && typeof GymHeader.isAuthed === "function" && GymHeader.isAuthed()); }
  function el(id) { return document.getElementById(id); }

  var screen = null;
  var prevTab = "plan";
  var nameDirty = false, weightDirty = false, heightDirty = false;
  var saving = false;

  function template() {
    return (
      '<div class="wrap">' +
      '  <header class="hero prof-hero">' +
      '    <button type="button" class="prof-back" id="profBackBtn"></button>' +
      '    <h1 id="profHeading"></h1>' +
      '    <div class="sub" id="profSub"></div>' +
      '  </header>' +
      '  <div id="profSignedOut" hidden>' +
      '    <p class="cal-more-hint" id="profSignedOutMsg"></p>' +
      '    <button type="button" class="ob-start-btn" id="profSignInBtn"></button>' +
      '  </div>' +
      '  <div id="profSignedIn">' +
      '    <div class="more-group prof-photo-group">' +
      '      <div class="more-label" id="profPhotoLabelEl"></div>' +
      '      <div class="prof-photo-row">' +
      '        <img class="prof-photo-img" id="profPhotoImg" alt="">' +
      '        <div class="prof-photo-actions">' +
      '          <button type="button" class="prof-btn" id="profChangePhotoBtn"></button>' +
      '          <input type="file" id="profPhotoInput" accept="image/jpeg,image/png" hidden>' +
      '          <p class="cal-more-hint" id="profPhotoHintEl"></p>' +
      '          <p class="prof-status" id="profPhotoStatus" hidden></p>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '    <form class="more-group" id="profForm" novalidate>' +
      '      <div class="more-label" id="profStatsLabelEl"></div>' +
      '      <label class="prof-field">' +
      '        <span id="profNameLabelEl"></span>' +
      '        <input type="text" id="profNameInput" maxlength="50" autocomplete="name">' +
      '      </label>' +
      '      <label class="prof-field">' +
      '        <span id="profWeightLabelEl"></span>' +
      '        <input type="number" id="profWeightInput" min="20" max="400" step="0.1" inputmode="decimal">' +
      '      </label>' +
      '      <label class="prof-field">' +
      '        <span id="profHeightLabelEl"></span>' +
      '        <input type="number" id="profHeightInput" min="50" max="250" step="0.1" inputmode="decimal">' +
      '      </label>' +
      '      <p class="prof-status" id="profFormMsg" hidden></p>' +
      '      <button type="submit" class="prof-btn prof-btn-primary" id="profSaveBtn"></button>' +
      '    </form>' +
      '    <div class="more-group">' +
      '      <div class="more-label" id="profProgressLabelEl"></div>' +
      '      <div class="prof-progress-row">' +
      '        <div class="prof-progress-stat">' +
      '          <div class="prof-progress-num" id="profStreakNum"></div>' +
      '          <div class="prof-progress-cap" id="profStreakCapEl"></div>' +
      '        </div>' +
      '        <div class="prof-progress-stat">' +
      '          <div class="prof-progress-num" id="profDaysNum"></div>' +
      '          <div class="prof-progress-cap" id="profDaysCapEl"></div>' +
      '        </div>' +
      '      </div>' +
      '      <p class="cal-more-hint" id="profStreakHint" hidden></p>' +
      '    </div>' +
      '  </div>' +
      '</div>'
    );
  }

  function build() {
    if (screen) return true;
    screen = el("screen-profile");
    if (!screen) return false;
    screen.innerHTML = template();

    el("profBackBtn").addEventListener("click", function () {
      if (window.GymUI && typeof GymUI.navigate === "function") GymUI.navigate(prevTab || "plan");
    });
    el("profSignInBtn").addEventListener("click", function () {
      if (window.GymUI && typeof GymUI.promptSignIn === "function") GymUI.promptSignIn();
    });
    el("profChangePhotoBtn").addEventListener("click", function () {
      var input = el("profPhotoInput");
      if (input) input.click();
    });
    el("profPhotoInput").addEventListener("change", onPhotoChosen);
    el("profForm").addEventListener("submit", onSaveSubmit);
    el("profNameInput").addEventListener("input", function () { nameDirty = true; });
    el("profWeightInput").addEventListener("input", function () { weightDirty = true; });
    el("profHeightInput").addEventListener("input", function () { heightDirty = true; });

    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].attributeName === "hidden" && !screen.hidden) { onVisible(); break; }
        }
      }).observe(screen, { attributes: true, attributeFilter: ["hidden"] });
    } catch (e) {}

    return true;
  }

  function onVisible() {
    if (window.__gymPrevTab) prevTab = window.__gymPrevTab;
    nameDirty = weightDirty = heightDirty = false;
    setFormMsg(null);
    setPhotoStatus(null);
    refresh();
  }

  // ---------------- strings ----------------
  function renderStrings() {
    if (!screen) return;
    el("profBackBtn").textContent = str("profBack");
    el("profHeading").textContent = str("profTitle");
    el("profSub").textContent = str("profSub");
    el("profSignedOutMsg").textContent = str("profSignInPrompt");
    el("profSignInBtn").textContent = str("profSignInBtn");
    el("profPhotoLabelEl").textContent = str("profPhotoLabel");
    el("profChangePhotoBtn").textContent = saving ? el("profChangePhotoBtn").textContent : str("profChangePhoto");
    el("profPhotoHintEl").textContent = str("profPhotoHint");
    el("profStatsLabelEl").textContent = str("profStatsLabel");
    el("profNameLabelEl").textContent = str("profName");
    el("profWeightLabelEl").textContent = str("profWeight");
    el("profHeightLabelEl").textContent = str("profHeight");
    el("profProgressLabelEl").textContent = str("profProgressLabel");
    el("profStreakCapEl").textContent = str("profStreak");
    el("profDaysCapEl").textContent = str("profTotalDays");
    renderSaveBtn();
  }

  function renderSaveBtn() {
    var btn = el("profSaveBtn");
    if (!btn) return;
    btn.textContent = saving ? str("profSaving") : str("profSave");
    btn.disabled = saving;
  }

  // ---------------- data ----------------
  function renderData() {
    if (!screen) return;
    var authed = isAuthed();
    el("profSignedOut").hidden = authed;
    el("profSignedIn").hidden = !authed;
    if (!authed) return;

    var me = (window.GymHeader && typeof GymHeader.me === "function") ? GymHeader.me() : null;
    var photo = (window.GymHeader && typeof GymHeader.photo === "function") ? GymHeader.photo() : null;
    var defaultAvatar = (window.GymHeader && GymHeader.defaultAvatar) || "icons/avatar-default.svg";
    el("profPhotoImg").setAttribute("referrerpolicy", "no-referrer");
    el("profPhotoImg").src = photo || defaultAvatar;
    el("profPhotoImg").onerror = function () { if (this.getAttribute("src") !== defaultAvatar) this.src = defaultAvatar; };

    if (!nameDirty) el("profNameInput").value = (me && (me.displayName || me.name)) || "";
    if (!weightDirty) el("profWeightInput").value = (me && me.weightKg != null) ? me.weightKg : "";
    if (!heightDirty) el("profHeightInput").value = (me && me.heightCm != null) ? me.heightCm : "";

    var streak = (me && +me.currentStreak) || 0;
    var streakNum = el("profStreakNum");
    streakNum.textContent = streak > 0 ? ("🔥" + streak) : "—";
    var pending = streak > 0 && me.todayDone === false && me.todayRested !== true;
    streakNum.classList.toggle("is-pending", pending);
    streakNum.setAttribute("aria-label", streak > 0 ? str(pending ? "hdrStreakPending" : "profStreakDays", { n: streak }) : str("profStreakNone"));
    var hint = el("profStreakHint");
    hint.hidden = streak > 0 && !pending;
    if (streak <= 0) hint.textContent = str("profStreakNone");
    else if (pending) hint.textContent = str("profStreakPending");
    el("profDaysNum").textContent = String((me && +me.totalDaysTrained) || 0);
  }

  function refresh() {
    if (!build()) return;
    renderStrings();
    renderData();
    if (isAuthed() && window.GymHeader && typeof GymHeader.refreshMe === "function") {
      GymHeader.refreshMe().then(function () { renderData(); });
    }
  }

  // ---------------- photo upload ----------------
  function setPhotoStatus(text, isErr) {
    var e2 = el("profPhotoStatus");
    if (!e2) return;
    if (!text) { e2.hidden = true; e2.textContent = ""; return; }
    e2.hidden = false;
    e2.textContent = text;
    e2.classList.toggle("prof-status-err", !!isErr);
    e2.classList.toggle("prof-status-ok", !isErr);
  }

  function downscaleImage(file) {
    return new Promise(function (resolve) {
      try {
        if (typeof FileReader === "undefined" || typeof Image === "undefined") { resolve(file); return; }
        var reader = new FileReader();
        reader.onerror = function () { resolve(file); };
        reader.onload = function () {
          var img = new Image();
          img.onerror = function () { resolve(file); };
          img.onload = function () {
            try {
              var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
              if (!w || !h) { resolve(file); return; }
              var scale = Math.min(1, MAX_PHOTO_DIM / Math.max(w, h));
              var tw = Math.max(1, Math.round(w * scale));
              var th = Math.max(1, Math.round(h * scale));
              var canvas = document.createElement("canvas");
              canvas.width = tw; canvas.height = th;
              var ctx = canvas.getContext("2d");
              if (!ctx) { resolve(file); return; }
              ctx.drawImage(img, 0, 0, tw, th);
              canvas.toBlob(function (blob) { resolve(blob || file); }, "image/jpeg", 0.85);
            } catch (e) { resolve(file); }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      } catch (e) { resolve(file); }
    });
  }

  function uploadPhoto(blob) {
    if (!window.GymHeader || typeof GymHeader.api !== "function") return Promise.reject({});
    var contentType = (blob && blob.type) || "image/jpeg";
    return GymHeader.api("/me/photo", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: blob,
      timeoutMs: 20000
    }).then(function (res) {
      if (res.status === 204 || res.ok) return true;
      throw { status: res.status };
    });
  }

  function onPhotoChosen(e) {
    var input = e.target;
    var file = input.files && input.files[0];
    input.value = ""; // allow re-choosing the same file later
    if (!file) return;
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      setPhotoStatus(str("profPhotoType"), true);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES * 4) {
      // A file this far over the cap won't shrink enough via a client-side
      // JPEG re-encode alone to be worth the round trip through the canvas.
      setPhotoStatus(str("profPhotoTooBig"), true);
      return;
    }
    setPhotoStatus(str("profUploading"), false);
    downscaleImage(file)
      .then(function (blob) {
        if (blob.size > MAX_PHOTO_BYTES) throw { clientReject: true };
        return uploadPhoto(blob);
      })
      .then(function () {
        setPhotoStatus(str("profPhotoSaved"), false);
        if (window.GymHeader && typeof GymHeader.setMe === "function") GymHeader.setMe({ photoURL: "/me/photo" });
        return (window.GymHeader && typeof GymHeader.reloadPhoto === "function") ? GymHeader.reloadPhoto() : null;
      })
      .then(function () { renderData(); })
      .catch(function (err) {
        if (err && err.clientReject) { setPhotoStatus(str("profPhotoTooBig"), true); return; }
        if (err && err.status === 413) { setPhotoStatus(str("profPhotoTooBig"), true); return; }
        if (err && err.status === 422) { setPhotoStatus(str("profPhotoType"), true); return; }
        setPhotoStatus(str("profPhotoErr"), true);
      });
  }

  // ---------------- save form ----------------
  function setFormMsg(text, ok) {
    var e2 = el("profFormMsg");
    if (!e2) return;
    if (!text) { e2.hidden = true; e2.textContent = ""; return; }
    e2.hidden = false;
    e2.textContent = text;
    e2.classList.toggle("prof-status-err", !ok);
    e2.classList.toggle("prof-status-ok", !!ok);
  }

  function onSaveSubmit(e) {
    e.preventDefault();
    if (saving) return;
    var name = el("profNameInput").value;
    var weight = el("profWeightInput").value;
    var height = el("profHeightInput").value;
    var errKey = validateProfile(name, weight, height);
    if (errKey) { setFormMsg(str(errKey), false); return; }
    if (!window.GymHeader || typeof GymHeader.api !== "function") return;

    setFormMsg(null);
    saving = true;
    renderSaveBtn();
    var body = { displayName: name.trim(), weightKg: Number(weight), heightCm: Number(height) };
    var meAtStart = GymHeader.me && GymHeader.me();
    var savedFor = meAtStart ? meAtStart.id : null;
    GymHeader.api("/me/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw { status: res.status };
      return res.json().catch(function () { return body; });
    }).then(function (saved) {
      saving = false;
      nameDirty = weightDirty = heightDirty = false;
      // Don't merge this save into a different account's cached /me if the
      // user signed out / switched accounts while the PUT was in flight.
      var meNow = GymHeader.me && GymHeader.me();
      if (!isAuthed() || (savedFor && meNow && meNow.id !== savedFor)) { renderSaveBtn(); return; }
      if (window.GymHeader && typeof GymHeader.setMe === "function") GymHeader.setMe(saved || body);
      setFormMsg(str("profSaved"), true);
      renderSaveBtn();
    }).catch(function (err) {
      saving = false;
      renderSaveBtn();
      if (err && err.status === 422) {
        var againKey = validateProfile(name, weight, height);
        setFormMsg(str(againKey || "profSaveErr"), false);
      } else {
        setFormMsg(str("profSaveErr"), false);
      }
    });
  }

  // ---------------- wiring ----------------
  function init() {
    build();
    if (window.GymHeader && typeof GymHeader.onChange === "function") {
      GymHeader.onChange(function () { renderData(); });
    }
    document.addEventListener("gym:authchange", function () {
      // Unsaved edits belong to whoever typed them — never carry them over
      // a sign-out / account switch into the next account's form.
      nameDirty = weightDirty = heightDirty = false;
      renderData();
      if (screen && !screen.hidden) refresh();
    });
    // Language switches rewrite <html lang>; re-render our strings then.
    try {
      new MutationObserver(function () { renderStrings(); renderData(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    } catch (e) {}
    renderStrings();
    renderData();
  }

  window.GymProfile = { refresh: refresh };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
