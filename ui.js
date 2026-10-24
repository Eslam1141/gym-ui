/* ui.js — app shell: bottom/side navigation + first-run onboarding + anon state.
 *
 * Loads before app.js. Owns:
 *   - #appNav (Plan / Coach / More) and screen switching via navigate(tab)
 *   - the #onboarding screen and the gym_onboarded / gym_anon local flags
 *   - the sign-up agreement line (#obLegal) and its gym_terms_ok flag
 *
 * app.js reads gym_anon directly for content gating and exposes
 * window.GymAppRebuild() to re-render after a state change. sync.js calls
 * GymUI.completeSignIn() on a successful sign-in. coach.js (optional) exposes
 * window.GymCoach.refresh(). None of the ui.js flags are ever synced. */
(function () {
  "use strict";

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function el(id) { return document.getElementById(id); }

  function isAuthed() {
    return !!(window.GymSync && typeof GymSync.isSignedIn === "function" && GymSync.isSignedIn());
  }
  function isAnon() { return ls("gym_anon") === "1"; }
  function onboarded() { return ls("gym_onboarded") === "1"; }
  // Version of the Terms/Privacy text the user last agreed to by tapping a sign-in choice.
  var TERMS_VERSION = "terms.v1";
  function acceptTerms() { set("gym_terms_ok", TERMS_VERSION); }

  var ob = null;

  // ---------------- navigation ----------------
  // "profile" is reached only via the avatar menu in #topBar (header.js),
  // never the bottom nav — it has no data-tab button, so it's just another
  // entry in the screen-swap list (navigate()/screenEl()), not a 4th tab.
  var TABS = ["plan", "coach", "food", "watch", "more", "profile"];
  var curTab = "plan";

  function screenEl(tab) { return el("screen-" + tab); }

  // In-app Back stack (read by native-shell.js for the Android hardware Back).
  // Entries are { tab } (a tab to return to) or { tab, fn } (a sub-screen's
  // restore closure, valid only while that tab is showing). Capped.
  var NAV_MAX = 20;
  var navStack = [];
  function pushSub(fn) {
    if (typeof fn !== "function") return;
    navStack.push({ tab: curTab, fn: fn });
    if (navStack.length > NAV_MAX) navStack.shift();
  }
  // A sub-screen's own on-screen Back button calls this so the entry it
  // pushed is not left behind for the hardware Back.
  function dropSub() {
    var top = navStack[navStack.length - 1];
    if (top && top.fn && top.tab === curTab) navStack.pop();
  }
  // Returns true if it went back to a previous screen/tab.
  function back() {
    var top = navStack.pop();
    if (!top) return false;
    if (top.fn) { try { top.fn(); } catch (e) { if (window.console) console.warn("back failed", e); } return true; }
    navigate(top.tab, { noPush: true });
    return true;
  }

  // Sets aria-current="page" on the #appNav button matching `tab` and clears
  // it on the others. Shared by navigate()'s swap() (real tab-switch clicks)
  // and boot()'s skip-branch (when the inline pre-paint script already put
  // the DOM in the right state and navigate() itself is skipped), so the
  // nav-bar highlight is always correct without duplicating this logic.
  function updateNavHighlight(tab) {
    var nav = el("appNav");
    if (!nav) return;
    nav.querySelectorAll("button[data-tab]").forEach(function (b) {
      var on = b.getAttribute("data-tab") === tab;
      if (on) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
  }

  // The tab swap is one cheap step: the outgoing screen is hidden at once and only the
  // incoming screen plays a transform/opacity slide (.screen-slide-in, motion.css). It used
  // to be a View Transition, whose snapshot capture cost >1 s a frame on low-end phones.
  // A superseded slide is cut short so a quick second tap leaves no class behind: hiding
  // a screen cancels its animation without firing `animationend`.
  var slidingIn = null;
  function onSlideEnd(e) { if (e.target === slidingIn) endSlide(); }
  function endSlide() {
    if (!slidingIn) return;
    slidingIn.classList.remove("screen-slide-in");
    slidingIn.removeEventListener("animationend", onSlideEnd);
    slidingIn = null;
  }

  // Returns false (and does nothing at all: no re-render, no refetch, no
  // transition, no scroll jump) when `tab` is already the visible view, so a
  // second tap on the active nav item / menu entry is a true no-op. Pass
  // { force: true } to re-apply it anyway (boot does, to sync the DOM).
  // One exception: tapping the active Food tab after its meals failed to
  // load retries the load (it is the only way back besides the retry link).
  function navigate(tab, opts) {
    if (TABS.indexOf(tab) === -1) tab = "plan";
    opts = opts || {};
    if (!opts.force && tab === curTab && document.body.getAttribute("data-tab") === tab) {
      if (tab === "food" && window.GymFood && typeof GymFood.retryFailed === "function") {
        try { GymFood.retryFailed(); } catch (e) { if (window.console) console.warn("food retry failed", e); }
      }
      return false;
    }
    // Slide direction follows the tab order (and flips in RTL via --m-dir).
    document.documentElement.style.setProperty("--nav-sign", TABS.indexOf(tab) >= TABS.indexOf(curTab) ? 1 : -1);
    if (!opts.noPush && !opts.force && tab !== curTab) {
      // Sub-screen entries of the tab being left are dropped: coming back
      // to it re-renders its home view anyway.
      navStack = navStack.filter(function (e) { return !(e.fn && e.tab === curTab); });
      var top = navStack[navStack.length - 1];
      // Going back to where we just were (e.g. Profile's own Back) pops
      // instead of stacking A > B > A.
      if (top && !top.fn && top.tab === tab) navStack.pop();
      else { navStack.push({ tab: curTab }); if (navStack.length > NAV_MAX) navStack.shift(); }
    }
    curTab = tab;
    set("gym_tab", tab);
    endSlide();

    TABS.forEach(function (name) {
      var s = screenEl(name);
      if (s) s.hidden = (name !== tab);
    });
    updateNavHighlight(tab);
    document.body.setAttribute("data-tab", tab);

    var reduce = (window.GymMotion && GymMotion.reduced()) ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var incoming = screenEl(tab);
    if (!opts.instant && !reduce && incoming) {
      slidingIn = incoming;
      incoming.classList.add("screen-slide-in");
      incoming.addEventListener("animationend", onSlideEnd);
    }

    if (!opts.keepScroll) { try { window.scrollTo(0, 0); } catch (e) {} }
    if (tab === "coach" && window.GymCoach && typeof GymCoach.refresh === "function") {
      try { GymCoach.refresh({ nav: true }); } catch (e) { if (window.console) console.warn("coach refresh failed", e); }
    }
    if (tab === "food" && window.GymFood && typeof GymFood.refresh === "function") {
      try { GymFood.refresh(); } catch (e) { if (window.console) console.warn("food refresh failed", e); }
    }
    if (window.GymMotion && !opts.instant) GymMotion.enter(screenEl(tab));
    return true;
  }

  function wireNav() {
    var nav = el("appNav");
    if (!nav) return;
    nav.querySelectorAll("button[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { navigate(b.getAttribute("data-tab")); });
    });
  }

  // ---------------- onboarding ----------------
  // Two-step reveal: a single "Start Changing Yourself" CTA first, then a
  // smooth crossfade into the real choices (Google icon + continue-anon).
  function showObStep(step) {
    var start = el("obStepStart");
    var choices = el("obStepChoices");
    var resolving = el("obStepResolving");
    var email = el("obStepEmail");
    if (!start || !choices) return;
    var legal = el("obLegal");
    if (legal) legal.hidden = step !== "choices" && step !== "email";
    start.inert = step !== "start";
    choices.inert = step !== "choices";
    if (resolving) resolving.inert = step !== "resolving";
    // "email" step (auth-email.js) carries longer forms than the other
    // steps, so it gets a bit more width via this class instead of a fixed
    // #obStepEmail size that would clip on smaller screens.
    if (email) { email.inert = step !== "email"; }
    if (ob) ob.classList.toggle("ob-email-mode", step === "email");
  }

  function showOnboarding() {
    if (!ob) return;
    if (window.GymMotion) { GymMotion.cancel(ob); ob.classList.remove("m-out", "m-in"); }   // a fade-out still running
    ob.hidden = false;
    document.body.classList.add("onboarding-open");
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    // Choices (Google / email / continue-anon) are visible on the very
    // first screen instead of gated behind a "Start Changing Yourself" tap
    // — one fewer step between a new visitor and signing in.
    showObStep("choices");
  }
  function hideOnboarding() {
    if (ob) { if (window.GymMotion) GymMotion.hide(ob); else ob.hidden = true; }   // fades out over the app, which is already built
    document.body.classList.remove("onboarding-open");
    document.body.style.overflow = "";
  }

  function rebuild() {
    try { if (typeof window.GymAppRebuild === "function") window.GymAppRebuild(); }
    catch (e) { if (window.console) console.warn("app rebuild failed", e); }
  }
  function refreshCoach() {
    try { if (window.GymCoach && typeof GymCoach.refresh === "function") GymCoach.refresh(); }
    catch (e) { if (window.console) console.warn("coach refresh failed", e); }
    try { if (window.GymCalendar && typeof GymCalendar.refresh === "function") GymCalendar.refresh(); }
    catch (e) { if (window.console) console.warn("calendar refresh failed", e); }
    try { if (window.GymFood && typeof GymFood.refresh === "function") GymFood.refresh(); }
    catch (e) { if (window.console) console.warn("food refresh failed", e); }
  }

  function startAnon() {
    clearResolvingFallback();
    // Also drop any "a sign-in was starting" marker (sync.js) for a Google
    // button tap the user backed out of by choosing this instead — left
    // alone it could interrupt this same anon session with the resolving
    // overlay on a later reload (see sync.js's isSignInPending()).
    try { if (window.GymSync && typeof GymSync.clearSignInPending === "function") GymSync.clearSignInPending(); } catch (e) {}
    set("gym_onboarded", "1");
    set("gym_anon", "1");
    hideOnboarding();
    rebuild();
    refreshCoach();
    navigate("plan", { instant: true });
  }

  // Called by sync.js from onCredential once a Google token is in hand.
  function completeSignIn() {
    clearResolvingFallback();
    // Signing in from the sign-in screen (Google button) is the agreement tap.
    if (ob && !ob.hidden) acceptTerms();
    set("gym_onboarded", "1");
    del("gym_anon");
    hideOnboarding();
    rebuild();
    refreshCoach();
    // Signing back in after a sign-out from Profile must not reopen Profile
    // (its "Back" target and data belong to the previous visit).
    if (curTab === "profile") navigate("plan", { instant: true });
  }

  // A locked control (or a lost session) asks the user to sign in: bring the
  // hero back and skip straight past the Start splash to the actual choices,
  // so the Google button is reachable in one tap, not two.
  function promptSignIn() {
    clearResolvingFallback();
    showOnboarding();
    showObStep("choices");
  }

  // Belt-and-suspenders backstop for showResolvingSession() below: sync.js
  // already gives up on a pending sign-in after ~8s (GIS timeout, definitive
  // failure, or its own hard timeout) and routes to promptSignIn() itself —
  // but that logic lives behind `GOOGLE_CLIENT_ID` being configured at all
  // (initAuth() no-ops without one, same as every other sync.js feature). A
  // stray marker with sync disabled would otherwise hold "resolving…" with
  // nothing to ever move it forward. This timer is ui.js's own independent
  // guarantee that the hold is always brief, regardless of sync.js's state.
  var resolvingFallbackTimer = null;
  function clearResolvingFallback() {
    if (resolvingFallbackTimer) { clearTimeout(resolvingFallbackTimer); resolvingFallbackTimer = null; }
  }

  // A sign-in was mid-flight when this tab last unloaded (sync.js's
  // isSignInPending()) — hold a neutral, non-committal screen while GIS
  // gets a chance at a silent re-auth, instead of flashing the ordinary
  // login choices (which would visually contradict a sign-in that's about
  // to quietly succeed) or leaving the user on a stale cached tab.
  function showResolvingSession() {
    showOnboarding();
    showObStep("resolving");
    clearResolvingFallback();
    resolvingFallbackTimer = setTimeout(function () {
      resolvingFallbackTimer = null;
      if (!isAuthed()) { if (window.GymSync && GymSync.hasSession && GymSync.hasSession()) endResolving(); else promptSignIn(); }
    }, 9000);
  }

  // The "resolving…" hold ends without a sign-in screen: a stored session is still
  // being restored in the background (sync.js retries), so the app shows meanwhile.
  function endResolving() {
    clearResolvingFallback();
    hideOnboarding();
  }

  // The user's LOCAL calendar day as YYYY-MM-DD (never toISOString, which is
  // UTC and runs a day behind between local midnight and the UTC offset in
  // UTC+ zones). Shared by app.js, calendar.js and food.js; evaluated on every
  // call so a tab left open across midnight stays correct.
  window.GymDate = {
    key: function (offsetDays) {
      var d = new Date();
      if (offsetDays) d.setDate(d.getDate() + offsetDays);
      var m = d.getMonth() + 1, day = d.getDate();
      return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
    },
    // First day (Saturday) of the Saturday-Friday week containing a YYYY-MM-DD key,
    // the same week the rest days and the calendar strip use. Pure date arithmetic.
    weekStart: function (key) {
      var p = key.split("-"), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7));
      return d.toISOString().slice(0, 10);
    },
    // The current week's key, recomputed on every call like key().
    weekKey: function (offsetDays) { return this.weekStart(this.key(offsetDays)); }
  };

  // HTML-escape for template strings that reach innerHTML (plan/AI/server text).
  // Quotes are escaped so the result is safe in attribute values too.
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  window.GymUI = {
    esc: esc,
    isAuthed: isAuthed,
    isAnon: isAnon,
    onboarded: onboarded,
    startAnon: startAnon,
    completeSignIn: completeSignIn,
    promptSignIn: promptSignIn,
    showResolvingSession: showResolvingSession,
    endResolving: endResolving,
    showObStep: showObStep,
    navigate: navigate,
    pushSub: pushSub,
    dropSub: dropSub,
    back: back,
    currentTab: function () { return curTab; }
  };

  function boot() {
    ob = el("onboarding");
    wireNav();
    // The inline pre-paint script in index.html already applied gym_tab to
    // the DOM before this ran (to avoid a flash of #screen-plan). Only call
    // navigate() here if the DOM doesn't already reflect the target tab —
    // otherwise this is a second, redundant application of the same key
    // that itself caused a visible flash/redirect on refresh. curTab is
    // still always initialized so later same-tab clicks behave correctly.
    var targetTab = ls("gym_tab") || "plan";
    curTab = targetTab;
    if (document.body.getAttribute("data-tab") !== targetTab) {
      navigate(targetTab, { instant: true, keepScroll: true, force: true });
    } else {
      // navigate()/swap() were skipped, but swap() is also the only thing
      // that sets aria-current on the #appNav buttons — without this, the
      // nav bar would stay highlighted on "Plan" (the static HTML default)
      // until the user's first tap, even though the correct screen is shown.
      updateNavHighlight(targetTab);
    }

    var startBtn = el("obStartBtn");
    if (startBtn) {
      startBtn.addEventListener("click", function () { showObStep("choices"); });
    }
    var cont = el("obContinueBtn");
    if (cont) cont.addEventListener("click", function () { acceptTerms(); startAnon(); });
    // The web Google button is a GIS iframe whose taps can't be seen from here;
    // completeSignIn() covers it. The native button is ours, so it counts at the tap.
    var googleBtn = el("obGoogleBtn");
    if (googleBtn) googleBtn.addEventListener("click", acceptTerms);
    var emailBtn = el("obEmailBtn");
    if (emailBtn) {
      emailBtn.addEventListener("click", function () {
        acceptTerms();
        if (window.GymAuthEmail && typeof GymAuthEmail.open === "function") GymAuthEmail.open("login");
      });
    }
    var whyToggle = el("obWhyToggle");
    var why = el("obWhy");
    if (whyToggle && why) {
      whyToggle.addEventListener("click", function () {
        var open = !why.classList.contains("open") || why.classList.contains("m-reveal-out");   // a tap mid-close reopens
        // The list opens in the page flow: the card re-lays out at once and GymMotion slides what sits below.
        if (!window.GymMotion) why.classList.toggle("open", open);
        else if (open) GymMotion.expand(why, function () { why.classList.add("open"); });
        else GymMotion.collapse(why, function () { why.classList.remove("open"); });
        whyToggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    // Auth-driven routing, on top of whatever tab was just restored above.
    // Checked in this order on purpose: signed in (nothing to do — sync.js's
    // initAuth() already hid onboarding via completeSignIn() if a cached
    // session existed) beats everything; a legitimate reason to expect a
    // silent re-auth (GymSync.shouldResolveSilently() — a mid-flight sign-in,
    // an account switch, or a cold start on a previously-signed-in device)
    // is checked BEFORE the anon-preview choice, since an in-progress
    // anon-to-authed upgrade (or an account switch) must win even while
    // gym_anon is still "1" — only THEN the existing explicit anon-preview
    // choice (untouched, existing UX), or — new — "no choice made yet":
    // always route to a real login screen instead of leaving the visitor on
    // whatever tab gym_tab cached, which is the bug this replaces (a random
    // last-active tab with a sign-in prompt buried inside it, instead of a
    // dedicated screen).
    // The landing's guest "Sign in" link opens /app/?signin: show the login
    // choices for a guest, ignore it when signed in. Dropped from the URL either way.
    var wantSignIn = /[?&]signin(=|&|$)/.test(location.search);
    if (wantSignIn) {
      try { var q = new URLSearchParams(location.search); q.delete("signin"); var qs = q.toString();
        history.replaceState(history.state, "", location.pathname + (qs ? "?" + qs : "") + location.hash); } catch (e) {}
    }
    if (isAuthed()) {
      // signed in — the restored tab above is correct, nothing to route.
    } else if (window.GymSync && typeof GymSync.shouldResolveSilently === "function" && GymSync.shouldResolveSilently()) {
      // sync.js's initAuth() already put up the "resolving…" hold (it runs
      // before this, see ui.js/sync.js load order) and is racing a silent
      // GIS re-auth — don't downgrade that to the plain login/anon screen here.
      showResolvingSession();
    } else if (isAnon()) {
      // explicit "continue without signing in" choice — leave it alone, unless ?signin asked for the login.
      if (wantSignIn) promptSignIn();
    } else if (!onboarded()) {
      showOnboarding(); // first-ever visit: the full hero splash
    } else {
      promptSignIn(); // returning, signed-out, no active choice: straight to login
    }
    // Routed: the app may paint now (index.html's pre-paint hid it while signed out).
    document.documentElement.classList.remove("pre-auth");
    releaseBootLoader();
  }

  // The logo loader (boot-loader.js) covers boot. Over the app it can leave
  // right away; over the login screen it waits for the card's entrance
  // animation to finish (capped), so it never fades onto a half-drawn card
  // — that card's blur/backdrop effects are slow to first paint on weak GPUs.
  function releaseBootLoader() {
    if (!window.GymBoot) return;
    var inner = ob && !ob.hidden && ob.querySelector(".ob-inner");
    if (!inner) { GymBoot.release("boot"); return; }
    var done = false;
    function release(e) {
      if (done || (e && e.target !== inner)) return;
      done = true;
      inner.removeEventListener("animationend", release);
      GymBoot.release("boot");
    }
    inner.addEventListener("animationend", release);
    setTimeout(release, 900);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
