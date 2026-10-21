// Animation audit findings 1-8 (2026-10-21): overlays and sheets get enter + exit motion, the inline
// video reveals without animating layout, toast/timer/celebration never overlap, nothing animates
// while hidden, the ambient background pauses, Coach states and Plan entrances play once.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(60000);
const PHONE = { width: 360, height: 800 };
const T = { timeout: 6000 };

const RESULT = {
  id: "a1", want: "both", model: "claude-haiku-4-5", createdAt: "2026-10-02T07:00:00Z",
  summary: "Short summary.",
  computed: { bmi: 24.1, bmiClass: "normal", bmrKcal: 1700, tdeeKcal: 2600, targetKcal: 2100, proteinG: 160, fatG: 65, carbG: 210 },
  dietPlan: { styleLabel: "Balanced", hydrationL: 3, meals: [{ name: "Lunch", kcal: 760, proteinG: 55, items: ["Rice"] }], swaps: [], notes: [] },
  disclaimers: ["Not medical advice."]
};

async function open(browser, opts) {
  const app = await openApp(browser, Object.assign({ signedIn: true, viewport: PHONE }, opts || {}));
  await app.context.route(/youtube|ytimg/, (r) => r.abort());
  await expect(app.page.locator(".ex-card").first()).toBeVisible(T);
  await app.page.waitForTimeout(1400);   // first paint's entrance is over
  return app;
}
// names of running animations whose target (or pseudo-element origin) is inside `sel`
const running = (page, sel) => page.evaluate((s) =>
  document.getAnimations().filter((a) => {
    const t = a.effect && a.effect.target;
    return a.playState === "running" && t && t.closest && t.closest(s);
  }).map((a) => a.animationName || a.transitionProperty || "anim"), sel);
const showVideoModal = (page) => page.evaluate(() => openVideoModal(DAYS[0].exercises.find((e) => e.vid)));

test.describe("1 - video modal", () => {
  test("enters with the overlay classes and leaves through an exit before it is hidden", async ({ browser }) => {
    const { context, page } = await open(browser);
    await showVideoModal(page);
    const m = page.locator("#videoModal");
    await expect(m).toHaveClass(/m-ovl/);
    await expect(m).toHaveClass(/m-in/);
    expect(await running(page, "#videoModal")).toEqual(expect.arrayContaining(["m-fade-in", "m-card-in"]));
    await page.waitForTimeout(500);
    await page.click("#modalClose");
    await expect(m).toHaveClass(/m-out/);                       // the exit is playing, not an instant cut
    expect(await page.evaluate(() => getComputedStyle(document.getElementById("videoModal")).pointerEvents)).toBe("none");
    expect(await page.evaluate(() => document.getElementById("modalFrame").innerHTML)).toBe("");   // playback already stopped
    await expect(m).toBeHidden(T);
    expect(await page.evaluate(() => document.getElementById("videoModal").hidden)).toBe(true);
    await context.close();
  });
  test("tapping the scrim closes it, and reopening mid-exit brings it back", async ({ browser }) => {
    const { context, page } = await open(browser);
    await showVideoModal(page);
    await page.waitForTimeout(400);
    await page.mouse.click(4, 4);
    await expect(page.locator("#videoModal")).toHaveClass(/m-out/);
    await showVideoModal(page);
    await expect(page.locator("#videoModal")).toHaveClass(/m-in/);
    await page.waitForTimeout(600);
    await expect(page.locator("#videoModal")).toBeVisible();
    await context.close();
  });
  test("reduced motion: no animation at all, instant show and hide", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await showVideoModal(page);
    await expect(page.locator("#videoModal")).toBeVisible();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await page.click("#modalClose");
    expect(await page.evaluate(() => document.getElementById("videoModal").hidden)).toBe(true);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await context.close();
  });
});

test.describe("2 - inline video", () => {
  test("opens without animating layout, moves the cards below with transform, keeps the scroll position", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => ({ y: scrollY, top: document.querySelectorAll(".ex-card")[1].getBoundingClientRect().top }));
    const r = await page.evaluate(() => {
      document.querySelector("[data-video]").click();
      const props = [];
      document.getAnimations().forEach((a) => {
        if (a.effect && a.effect.getKeyframes) a.effect.getKeyframes().forEach((k) => Object.keys(k).forEach((p) => props.push(p)));
        if (a.transitionProperty) props.push(a.transitionProperty);
      });
      const wrap = document.querySelector(".video-wrap.open");
      return {
        y: scrollY, props,
        wrapAnim: !!wrap && wrap.classList.contains("m-reveal-in"),
        below: document.getAnimations().some((a) => a.effect.target === document.querySelectorAll(".ex-card")[1])
      };
    });
    expect(r.y).toBe(before.y);
    expect(r.wrapAnim).toBe(true);
    expect(r.below).toBe(true);                                 // the next card slides instead of jumping
    const layout = ["height", "width", "top", "left", "marginTop", "gridTemplateRows", "maxHeight", "grid-template-rows", "max-height"];
    expect(r.props.filter((p) => layout.includes(p))).toEqual([]);
    expect(r.props).toEqual(expect.arrayContaining(["transform"]));
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => scrollY)).toBe(before.y);
    expect(await page.evaluate(() => document.querySelectorAll(".ex-card")[1].getBoundingClientRect().top)).toBeGreaterThan(before.top + 100);
    await context.close();
  });
  test("closes with a fade, then collapses; a tap mid-close reopens", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.click("[data-video]");
    await page.waitForTimeout(600);
    await page.click("[data-video]");
    await expect(page.locator(".video-wrap.m-reveal-out")).toHaveCount(1);
    await expect(page.locator(".video-wrap.open")).toHaveCount(0, T);
    await page.click("[data-video]");
    await page.waitForTimeout(500);
    await page.click("[data-video]");                           // close ...
    await page.click("[data-video]");                           // ... and straight back
    await page.waitForTimeout(700);
    await expect(page.locator(".video-wrap.open")).toHaveCount(1);
    await expect(page.locator(".video-wrap.m-reveal-out")).toHaveCount(0);
    await context.close();
  });
  test("reduced motion: opens and closes instantly with nothing running", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.click("[data-video]");
    await expect(page.locator(".video-wrap.open")).toHaveCount(1);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await page.click("[data-video]");
    await expect(page.locator(".video-wrap.open")).toHaveCount(0);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await context.close();
  });
});

test.describe("3 - toast vs rest timer and celebration card (360x800)", () => {
  const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const toast = (page) => page.evaluate(() => GymToast.show({ message: "Checklist reset", actionLabel: "Undo", onAction() {}, duration: 20000 }));
  for (const lang of ["en", "ar"]) {
    test("toast sits clear of the rest timer (" + lang + ")", async ({ browser }) => {
      const { context, page } = await open(browser, { lang });
      await page.evaluate(() => startRestTimer(90, "Bench"));
      await expect(page.locator("#timerBar.show")).toBeVisible(T);
      await toast(page);
      await expect(page.locator(".gym-toast.show")).toBeVisible();
      await page.waitForTimeout(700);
      const t = await page.locator("#gymToast").boundingBox();
      const b = await page.locator("#timerBar").boundingBox();
      expect(overlap(t, b)).toBe(false);
      expect(t.y + t.height).toBeLessThanOrEqual(b.y);
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width).toBeLessThanOrEqual(360);
      await context.close();
    });
  }
  test("toast sits clear of the celebration card", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.evaluate(() => GymCelebrate.rest());
    await expect(page.locator(".celebrate-card.show")).toBeVisible(T);
    await toast(page);
    await page.waitForTimeout(700);
    const t = await page.locator("#gymToast").boundingBox();
    const c = await page.locator(".celebrate-card").boundingBox();
    expect(overlap(t, c)).toBe(false);
    await context.close();
  });
  test("with neither up, the toast keeps its normal spot", async ({ browser }) => {
    const { context, page } = await open(browser);
    await toast(page);
    await page.waitForTimeout(700);
    const t = await page.locator("#gymToast").boundingBox();
    expect(t.y + t.height).toBeGreaterThan(700);
    await context.close();
  });
  test("reduced motion: still lifted clear of the timer", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => startRestTimer(90, "Bench"));
    await expect(page.locator("#timerBar.show")).toBeVisible(T);
    await toast(page);
    await page.waitForTimeout(300);
    const t = await page.locator("#gymToast").boundingBox();
    const b = await page.locator("#timerBar").boundingBox();
    expect(overlap(t, b)).toBe(false);
    await context.close();
  });
});

test.describe("4 - mini timer pulse", () => {
  const infiniteHidden = (page) => page.evaluate(() =>
    document.getAnimations().filter((a) => {
      const t = a.effect && a.effect.target;
      if (!t || a.effect.getTiming().iterations !== Infinity) return false;
      const cs = getComputedStyle(t);
      return cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0 || !!t.closest("[hidden]") ||
        (!!t.closest("#miniTimer") && !t.closest("#miniTimer.show"));
    }).map((a) => a.animationName));
  test("nothing infinite runs on a hidden element on any tab", async ({ browser }) => {
    const { context, page } = await open(browser);
    for (const tab of ["plan", "coach", "food", "more", "plan"]) {
      await page.evaluate((t) => GymUI.navigate(t, { instant: true }), tab);
      await page.waitForTimeout(300);
      expect(await infiniteHidden(page), tab).toEqual([]);
    }
    expect(await running(page, "#miniTimer")).toEqual([]);
    await context.close();
  });
  test("the pulse runs only while the pill is shown and ticking, as a transform ring", async ({ browser }) => {
    const { context, page } = await open(browser);
    const pulses = () => page.evaluate(() => document.getAnimations().filter((a) => a.animationName === "pulseDot").map((a) => ({
      pseudo: a.effect.pseudoElement, props: a.effect.getKeyframes().flatMap((k) => Object.keys(k))
    })));
    await page.evaluate(() => document.getElementById("miniTimer").classList.add("show"));
    await page.waitForTimeout(200);
    const on = await pulses();
    expect(on.length).toBe(1);
    expect(on[0].pseudo).toBe("::after");
    expect(on[0].props).not.toContain("boxShadow");
    await page.evaluate(() => document.getElementById("miniTimer").classList.add("paused"));
    expect(await pulses()).toEqual([]);
    await page.evaluate(() => document.getElementById("miniTimer").classList.remove("paused", "show"));
    expect(await pulses()).toEqual([]);
    await context.close();
  });
  test("reduced motion: no pulse and no strobe even when the pill is shown", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => document.getElementById("miniTimer").classList.add("show"));
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await context.close();
  });
});

test.describe("5 - ambient background", () => {
  const bg = (page) => page.evaluate(() => document.getAnimations().filter((a) => a.effect.target.closest("#bgfx")).map((a) => a.playState));
  test("no blur filter, drifting while visible", async ({ browser }) => {
    const { context, page } = await open(browser);
    expect(await page.evaluate(() => [...document.querySelectorAll("#bgfx span")].map((s) => getComputedStyle(s).filter))).toEqual(["none", "none", "none"]);
    expect(await bg(page)).toEqual(["running", "running", "running"]);
    await context.close();
  });
  test("pauses while the tab is hidden and resumes", async ({ browser }) => {
    const { context, page } = await open(browser);
    const setHidden = (h) => page.evaluate((v) => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => v });
      document.dispatchEvent(new Event("visibilitychange"));
    }, h);
    await setHidden(true);
    expect(await bg(page)).toEqual(["paused", "paused", "paused"]);
    await setHidden(false);
    expect(await bg(page)).toEqual(["running", "running", "running"]);
    await context.close();
  });
  test("pauses while an overlay covers the app", async ({ browser }) => {
    const { context, page } = await open(browser);
    await showVideoModal(page);
    await page.waitForTimeout(100);
    expect(await bg(page)).toEqual(["paused", "paused", "paused"]);
    await page.click("#modalClose");
    await expect(page.locator("#videoModal")).toBeHidden(T);
    expect(await bg(page)).toEqual(["running", "running", "running"]);
    await context.close();
  });
  test("reduced motion: static render, nothing animating", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await bg(page)).toEqual([]);
    expect(await page.evaluate(() => [...document.querySelectorAll("#bgfx span")].every((s) => s.getBoundingClientRect().width > 100))).toBe(true);
    await context.close();
  });
});

test.describe("6 - Coach", () => {
  const seed = { ls: { gymcoach_last: RESULT } };
  test("result rings do not sweep again when the tab is re-entered", async ({ browser }) => {
    const { context, page } = await open(browser, seed);
    await page.evaluate(() => {
      window.__ring = [];
      document.addEventListener("transitionrun", (e) => { if (e.target.classList && e.target.classList.contains("coach-ring-arc")) window.__ring.push(e.propertyName); }, true);
    });
    await page.evaluate(() => GymUI.navigate("coach", { instant: true }));
    await expect(page.locator(".coach-ring-arc")).toHaveCount(3, T);
    await page.waitForTimeout(1500);
    await page.evaluate(() => GymUI.navigate("plan", { instant: true }));
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.__ring = []; });
    await page.evaluate(() => GymUI.navigate("coach", { instant: true }));
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__ring.length)).toBe(0);                // re-entry: no replay
    const arcs = await page.evaluate(() => [...document.querySelectorAll(".coach-ring-arc")].map((a) => a.getAttribute("stroke-dasharray")));
    expect(arcs.every((d) => !d.startsWith("0 "))).toBe(true);                      // drawn at its final length
    await context.close();
  });
  test("repainting the same result (GymCoach.refresh) does not sweep the rings again", async ({ browser }) => {
    const { context, page } = await open(browser, seed);
    await page.evaluate(() => GymUI.navigate("coach", { instant: true }));
    await expect(page.locator(".coach-ring-arc")).toHaveCount(3, T);
    await page.waitForTimeout(1300);
    await page.evaluate(() => { window.__ring = 0; document.addEventListener("transitionrun", (e) => { if (e.target.classList && e.target.classList.contains("coach-ring-arc")) window.__ring++; }, true); });
    await page.evaluate(() => GymCoach.refresh());
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.__ring)).toBe(0);
    await context.close();
  });
  test("a view change inside Coach rises in; entering the tab adds no second entrance", async ({ browser }) => {
    const { context, page } = await open(browser);                                  // no saved result: the form
    await page.evaluate(() => {
      window.__a = [];
      document.addEventListener("animationstart", (e) => window.__a.push(e.animationName + "@" + (e.target.className || e.target.id)), true);
    });
    await page.evaluate(() => GymUI.navigate("coach"));
    await expect(page.locator("#coachBody form")).toBeVisible(T);
    await page.waitForTimeout(900);
    expect((await page.evaluate(() => window.__a)).filter((a) => a.includes("coach-in"))).toEqual([]);
    await page.evaluate((r) => { window.__a = []; GymCoach.showResult(r); }, RESULT);
    await page.waitForTimeout(150);
    expect((await page.evaluate(() => window.__a)).some((a) => a.startsWith("m-rise@coach-result"))).toBe(true);
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => document.querySelectorAll(".coach-in").length)).toBe(0);   // class dropped, so a re-show cannot replay it
    await context.close();
  });
  test("the In-Body panel fades in and slides what is below, instead of a hard flip", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.evaluate(() => GymUI.navigate("coach", { instant: true }));
    const toggle = page.locator(".coach-ib-toggle");
    await expect(toggle).toBeVisible(T);
    const r = await page.evaluate(() => {
      document.querySelector(".coach-ib-toggle").click();
      const b = document.querySelector(".coach-ib-body");
      return { hidden: b.hidden, cls: b.classList.contains("m-reveal-in"), anims: document.getAnimations().length };
    });
    expect(r.hidden).toBe(false);
    expect(r.cls).toBe(true);
    expect(r.anims).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    await toggle.click();
    await expect(page.locator(".coach-ib-body.m-reveal-out")).toHaveCount(1);
    await expect(page.locator(".coach-ib-body")).toBeHidden(T);
    await context.close();
  });
  test("reduced motion: nothing animates on Coach, rings are drawn at once", async ({ browser }) => {
    const { context, page } = await open(browser, seed);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => GymUI.navigate("coach"));
    await expect(page.locator(".coach-ring-arc")).toHaveCount(3, T);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await context.close();
  });
});

test.describe("7 - returning to Plan", () => {
  test("one entrance (the screen's), not the screen's plus a card replay", async ({ browser }) => {
    const { context, page } = await open(browser);
    expect(await page.evaluate(() => document.querySelectorAll(".ex-card.anim-in").length)).toBe(0);   // played and cleaned up
    await page.evaluate(() => GymUI.navigate("coach", { instant: true }));
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__a = [];
      document.addEventListener("animationstart", (e) => { if (e.target.closest && e.target.closest("#screen-plan")) window.__a.push(e.animationName + "@" + (e.target.classList.contains("ex-card") ? "ex-card" : e.target.className)); }, true);
    });
    await page.evaluate(() => GymUI.navigate("plan"));
    await page.waitForTimeout(1200);
    const log = await page.evaluate(() => window.__a);
    expect(log.filter((l) => l.endsWith("@ex-card"))).toEqual([]);
    expect(log.some((l) => l.startsWith("m-rise@wrap"))).toBe(true);                 // the screen entrance still plays
    await context.close();
  });
  test("cards still enter on a real context change (language switch) and then clean up", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.evaluate(() => { window.__a = 0; document.addEventListener("animationstart", (e) => { if (e.animationName === "m-rise" && e.target.classList.contains("ex-card")) window.__a++; }, true); });
    await page.evaluate(() => applyLang("ar", true));
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__a)).toBeGreaterThan(0);
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => document.querySelectorAll(".ex-card.anim-in").length)).toBe(0);
    await context.close();
  });
});

test.describe("8 - sheets and dialogs exit", () => {
  for (const lang of ["en", "ar"]) {
    test("feedback sheet fades and drops out, then leaves the DOM (" + lang + ")", async ({ browser }) => {
      const { context, page } = await open(browser, { lang });
      await page.evaluate(() => GymFeedback.open());
      const s = page.locator("#feedbackSheet");
      await expect(s).toHaveClass(/m-ovl/);
      await expect(s).toHaveClass(/m-in/);
      expect(await running(page, "#feedbackSheet")).toEqual(expect.arrayContaining(["m-fade-in", "m-card-in"]));
      await page.waitForTimeout(500);
      await page.keyboard.press("Escape");
      await expect(s).toHaveClass(/m-out/);
      expect(await page.evaluate(() => getComputedStyle(document.getElementById("feedbackSheet")).pointerEvents)).toBe("none");
      expect(await running(page, "#feedbackSheet")).toEqual(expect.arrayContaining(["m-fade-out"]));
      await expect(s).toHaveCount(0, T);
      await context.close();
    });
  }
  test("a sheet fading out does not count as an open layer for Back", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.evaluate(() => GymFeedback.open());
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => document.querySelectorAll(".syd:not(.m-out)").length)).toBe(0);
    await expect(page.locator("#feedbackSheet")).toHaveCount(0, T);
    await context.close();
  });
  test("delete-account dialog plays an exit before it closes, Escape included", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.evaluate(() => GymUI.navigate("more", { instant: true }));
    const del = page.locator("#pvDelete");
    await del.scrollIntoViewIfNeeded();
    await del.click();
    const d = page.locator("dialog.pv-sheet");
    await expect(d).toBeVisible(T);
    await page.waitForTimeout(500);
    await page.keyboard.press("Escape");
    await expect(d).toHaveClass(/m-dlg-out/);
    expect(await page.evaluate(() => document.querySelector("dialog.pv-sheet").open)).toBe(true);      // still showing its exit
    expect(await running(page, "dialog.pv-sheet")).toEqual(expect.arrayContaining(["m-dlg-out"]));
    await expect(d).toBeHidden(T);
    expect(await page.evaluate(() => document.querySelector("dialog.pv-sheet").className)).not.toMatch(/m-dlg-out/);
    await del.click();                                                                                 // and it opens again
    await expect(d).toBeVisible(T);
    await page.click("#pvCancel");
    await expect(d).toBeHidden(T);
    await context.close();
  });
  test("delete-account dialog, reduced motion: closes at once with nothing animating", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => GymUI.navigate("more", { instant: true }));
    await page.locator("#pvDelete").scrollIntoViewIfNeeded();
    await page.click("#pvDelete");
    await expect(page.locator("dialog.pv-sheet")).toBeVisible(T);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => document.querySelector("dialog.pv-sheet").open)).toBe(false);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await context.close();
  });
  test("sign-in screen fades out over the app instead of cutting", async ({ browser }) => {
    const { context, page } = await open(browser, { signedIn: false });
    await page.evaluate(() => GymUI.promptSignIn());
    await expect(page.locator("#onboarding")).toBeVisible(T);
    await page.evaluate(() => GymUI.startAnon());
    const ob = page.locator("#onboarding");
    await expect(ob).toHaveClass(/m-out/);
    expect(await page.evaluate(() => getComputedStyle(document.getElementById("onboarding")).pointerEvents)).toBe("none");
    expect(await page.evaluate(() => document.body.classList.contains("onboarding-open"))).toBe(false);
    await expect(ob).toBeHidden(T);
    await context.close();
  });
});

test.describe("reduced motion: nothing is left running after each action", () => {
  test("getAnimations() is empty after every action", async ({ browser }) => {
    const { context, page } = await open(browser, { ls: { gymcoach_last: RESULT } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const empty = async (label) => {
      await page.waitForTimeout(150);
      const left = await page.evaluate(() => document.getAnimations().map((a) => (a.animationName || a.transitionProperty || "?") + "@" + ((a.effect.target && (a.effect.target.id || a.effect.target.className)) || "")));
      expect(left, label).toEqual([]);
    };
    await empty("idle");
    for (const tab of ["coach", "food", "more", "plan"]) { await page.evaluate((t) => GymUI.navigate(t), tab); await empty("tab " + tab); }
    await page.click("[data-video]"); await empty("inline video open");
    await page.click("[data-video]"); await empty("inline video close");
    await showVideoModal(page); await empty("modal open");
    await page.click("#modalClose"); await empty("modal close");
    await page.evaluate(() => startRestTimer(90, "Bench")); await empty("rest timer");
    await page.evaluate(() => GymToast.show({ message: "x", actionLabel: "Undo", onAction() {} })); await empty("toast");
    await page.evaluate(() => GymFeedback.open()); await empty("sheet open");
    await page.keyboard.press("Escape"); await empty("sheet close");
    await context.close();
  });
});

// A closed sheet must leave nothing behind: not visible, no exit class, and it must not catch a click.
test.describe("closed overlays leave nothing behind (clean page, no patching)", () => {
  const under = (page) => page.evaluate(() => {
    const out = [];
    for (const [x, y] of [[180, 200], [180, 400], [180, 600], [180, 740]]) {
      const el = document.elementFromPoint(x, y);
      out.push(!!(el && el.closest(".syd, .m-ovl:not([hidden]), dialog[open], .m-out")));
    }
    return out;
  });
  const clean = async (page) => {
    await page.waitForTimeout(700);
    expect(await under(page)).toEqual([false, false, false, false]);
    expect(await page.evaluate(() => document.querySelectorAll(".syd, .m-out, .m-in, dialog[open]").length)).toBe(0);
  };
  for (const how of ["cancel", "backdrop", "escape"]) {
    test("feedback sheet closed by " + how + " is gone and clicks reach the page", async ({ browser }) => {
      const { context, page } = await open(browser);
      await page.evaluate(() => GymFeedback.open());
      await expect(page.locator("#feedbackSheet")).toBeVisible(T);
      await page.waitForTimeout(500);
      if (how === "cancel") await page.click(".fb-cancel");
      else if (how === "backdrop") await page.mouse.click(180, 20);
      else await page.keyboard.press("Escape");
      await expect(page.locator("#feedbackSheet")).toHaveCount(0, T);
      await clean(page);
      await page.click("#dayTabs .day-chip >> nth=1");              // a real click reaches the page beneath
      await context.close();
    });
  }
  test("video modal closed by button, scrim and a second open/close ends hidden and inert to clicks", async ({ browser }) => {
    const { context, page } = await open(browser);
    for (const how of ["button", "scrim"]) {
      await showVideoModal(page);
      await page.waitForTimeout(500);
      if (how === "button") await page.click("#modalClose"); else await page.mouse.click(4, 4);
      await page.waitForTimeout(700);
      const s = await page.evaluate(() => { const m = document.getElementById("videoModal"); return { hidden: m.hidden, cls: m.className, vis: m.getBoundingClientRect().width > 0 }; });
      expect(s).toEqual({ hidden: true, cls: "m-ovl", vis: false });
      await clean(page);
    }
    await context.close();
  });
  test("pv-sheet dialog closed by Cancel, backdrop and Escape is closed and not stuck inert", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.evaluate(() => GymUI.navigate("more", { instant: true }));
    await page.locator("#pvDelete").scrollIntoViewIfNeeded();
    for (const how of ["cancel", "backdrop", "escape"]) {
      await page.click("#pvDelete");
      await expect(page.locator("dialog.pv-sheet")).toBeVisible(T);
      await page.waitForTimeout(500);
      if (how === "cancel") await page.click("#pvCancel");
      else if (how === "backdrop") await page.mouse.click(180, 20);
      else await page.keyboard.press("Escape");
      await page.waitForTimeout(700);
      const s = await page.evaluate(() => { const d = document.querySelector("dialog.pv-sheet"); return { open: d.open, cls: d.className, inert: d.inert }; });
      expect(s).toEqual({ open: false, cls: "pv-sheet", inert: false });
      await clean(page);
    }
    await context.close();
  });
  test("quick toggles: open > close > open within 100ms ends open; open > close while entering ends closed", async ({ browser }) => {
    const { context, page } = await open(browser);
    // video modal
    await page.evaluate(() => { openVideoModal(DAYS[0].exercises.find((e) => e.vid)); closeVideoModal(); openVideoModal(DAYS[0].exercises.find((e) => e.vid)); });
    await page.waitForTimeout(700);
    let s = await page.evaluate(() => { const m = document.getElementById("videoModal"); return { hidden: m.hidden, out: m.classList.contains("m-out") }; });
    expect(s).toEqual({ hidden: false, out: false });
    await page.evaluate(() => closeVideoModal());
    await page.waitForTimeout(80);                                  // close while it is still entering ...
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => document.getElementById("videoModal").hidden)).toBe(true);
    await page.evaluate(() => { openVideoModal(DAYS[0].exercises.find((e) => e.vid)); setTimeout(() => closeVideoModal(), 60); });
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => document.getElementById("videoModal").hidden)).toBe(true);
    await clean(page);
    // feedback sheet: open > close > open
    await page.evaluate(() => { GymFeedback.open(); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); setTimeout(() => GymFeedback.open(), 50); });
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => document.querySelectorAll("#feedbackSheet").length)).toBe(1);
    expect(await page.evaluate(() => document.querySelector("#feedbackSheet").classList.contains("m-out"))).toBe(false);
    await page.keyboard.press("Escape");
    await expect(page.locator(".syd")).toHaveCount(0, T);
    await clean(page);
    // feedback: close while the enter animation is still running
    await page.evaluate(() => { GymFeedback.open(); setTimeout(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })), 60); });
    await expect(page.locator(".syd")).toHaveCount(0, T);
    await clean(page);
    await context.close();
  });
});
