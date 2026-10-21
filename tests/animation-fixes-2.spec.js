// Animation audit findings 9-16 (2026-10-21): no animation moves a layout property, hover lifts exist only
// on hover-capable pointers, the skeleton shimmer follows reading direction, the desktop sidebar's tab
// transition is vertical, a Food day switch animates once, reduced motion leaves nothing running, and the
// old duplicate screen-fade CSS is gone.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(60000);
const PHONE = { width: 360, height: 800 };
const DESKTOP = { width: 1280, height: 800 };
const T = { timeout: 6000 };

async function open(browser, opts) {
  const app = await openApp(browser, Object.assign({ signedIn: true, viewport: PHONE }, opts || {}));
  await app.context.route(/youtube|ytimg/, (r) => r.abort());
  await expect(app.page.locator(".ex-card").first()).toBeVisible(T);
  await app.page.waitForTimeout(1400);   // first paint's entrance is over
  return app;
}
const tab = (page, name) => page.evaluate((n) => GymUI.navigate(n), name);
const count = (page) => page.evaluate(() => document.getAnimations().length);
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// meals mock for the Food tab (copied from food-progress.spec.js); `delay` holds the response back
async function mockMeals(page, meals, delay) {
  await page.route((u) => u.pathname.endsWith("/api/v1/meals") || u.pathname.includes("/api/v1/meals/"), async (route) => {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ meals }) });
  });
}
const MEAL = { id: "m1", mealType: "lunch", foodName: "Rice", grams: 100, nutrients: { kcal: 300, protein: 10, carbs: 50, fat: 2 }, date: "2026-10-02" };

test.describe("9 - nothing animates a layout property", () => {
  // Records every property any running animation or transition touches, frame by frame.
  const startRecorder = (page) => page.evaluate(() => {
    const META = new Set(["offset", "computedOffset", "easing", "composite"]);
    window.__props = new Set(); window.__kf = new Set(); window.__who = {};
    const who = (t) => t ? (t.id ? "#" + t.id : (t.tagName || "") + "." + String(t.className && t.className.baseVal !== undefined ? t.className.baseVal : t.className).trim().replace(/\s+/g, ".")) : "?";
    const grab = () => document.getAnimations().forEach((a) => {
      try {
        // the browser's own ::view-transition-group morph resizes a snapshot, it never re-lays the page out
        if (a.effect && /view-transition-group/.test(a.effect.pseudoElement || "")) return;
        if (a.transitionProperty) { window.__props.add(a.transitionProperty); window.__who[a.transitionProperty] = who(a.effect.target); }
        if (a.effect && a.effect.getKeyframes) a.effect.getKeyframes().forEach((k) => Object.keys(k).forEach((p) => {
          if (META.has(p)) return;
          window.__props.add(p); window.__who[p] = who(a.effect.target);
          if (a.animationName) window.__kf.add(p);
        }));
      } catch (e) {}
    });
    const loop = () => { grab(); requestAnimationFrame(loop); };
    loop();
    document.addEventListener("transitionrun", (e) => { window.__props.add(e.propertyName); window.__who[e.propertyName] = who(e.target); }, true);
  });
  const LAYOUT = /^(width|height|top|left|right|bottom|maxheight|minheight|maxwidth|minwidth|gridtemplaterows|gridtemplatecolumns|inlinesize|blocksize|inset.*|margin.*|padding.*|flexbasis|fontsize)$/;
  const norm = (p) => p.toLowerCase().replace(/-/g, "");

  test("set checks, sign-in 'why' list, alarm banner, tabs, chat and Food animate only compositor properties", async ({ browser }) => {
    const { context, page } = await open(browser);
    await mockMeals(page, [MEAL]);
    await startRecorder(page);
    await page.locator(".set-chk").first().click();              // check
    await page.waitForTimeout(250);
    await page.locator(".set-chk").first().click();              // and uncheck
    await page.waitForTimeout(250);
    await page.evaluate(() => { document.getElementById("alarmBanner").hidden = false; });   // a ringing alarm
    await page.waitForTimeout(1300);
    await page.evaluate(() => { document.getElementById("alarmBanner").hidden = true; });
    for (const n of ["coach", "food", "more", "plan"]) { await tab(page, n); await page.waitForTimeout(450); }
    await page.evaluate(() => GymUI.promptSignIn());              // sign-in sheet with the "Why sign in?" list
    await page.waitForTimeout(700);
    await page.click("#obWhyToggle");
    await page.waitForTimeout(450);
    await page.click("#obWhyToggle");
    await page.waitForTimeout(450);
    const { props, kf, who } = await page.evaluate(() => ({ props: [...window.__props], kf: [...window.__kf], who: window.__who }));
    expect(props.length).toBeGreaterThan(0);
    expect(props.filter((p) => LAYOUT.test(norm(p))).map((p) => p + " on " + who[p])).toEqual([]);
    // keyframe animations (not transitions) must not paint-animate either: no shadows, no masks
    expect(kf.filter((p) => /^(boxshadow|textshadow|maskimage|webkitmaskimage)$/.test(norm(p)))).toEqual([]);
    await context.close();
  });

  test("the 'Why sign in?' list opens and closes without its height animating, and stays out of the accessibility tree while closed", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.evaluate(() => GymUI.promptSignIn());
    await page.waitForTimeout(700);
    const why = page.locator("#obWhy");
    await expect(why).toBeHidden();
    await page.click("#obWhyToggle");
    await expect(why).toBeVisible(T);
    await expect(page.locator("#obWhyToggle")).toHaveAttribute("aria-expanded", "true");
    await page.click("#obWhyToggle");
    await expect(why).toBeHidden(T);
    await expect(page.locator("#obWhyToggle")).toHaveAttribute("aria-expanded", "false");
    await page.click("#obWhyToggle");                           // reopening mid-state still works
    await expect(why).toBeVisible(T);
    await context.close();
  });

  test("the sign-in link no longer glows forever", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.evaluate(() => GymUI.promptSignIn());
    await page.waitForTimeout(700);
    const names = await page.evaluate(() => document.getAnimations().map((a) => a.animationName).filter(Boolean));
    expect(names).not.toContain("ob-why-glow");
    await context.close();
  });

  test("a set check keeps its chip width stable per state and does not nudge the digit through a width animation", async ({ browser }) => {
    const { context, page } = await open(browser);
    const props = await page.evaluate(() => {
      const chk = document.querySelector(".set-chk");
      chk.click();
      const out = [];
      document.getAnimations().forEach((a) => { if (a.transitionProperty && chk.contains(a.effect.target)) out.push(a.transitionProperty); });
      return out;
    });
    expect(props).not.toContain("width");
    expect(props).toEqual(expect.arrayContaining(["opacity", "transform"]));
    await context.close();
  });

  test("the alarm ring is a transform + opacity ring, not a box-shadow animation", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.evaluate(() => { document.getElementById("alarmBanner").hidden = false; });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === "alarm-ring").map((a) => ({
      props: Object.keys(a.effect.getKeyframes()[0]).filter((p) => !["offset", "computedOffset", "easing", "composite"].includes(p)),
      pseudo: a.effect.pseudoElement
    })));
    expect(r.length).toBeGreaterThan(0);
    r.forEach((x) => expect(x.props.sort()).toEqual(["opacity", "transform"]));
    await context.close();
  });
});

test.describe("10 - hover lift is for hover-capable pointers only", () => {
  const lifted = (page, sel) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).transform);

  test("a mouse hover lifts a card on a fine pointer", async ({ browser }) => {
    const { context, page } = await open(browser);
    expect(await page.evaluate(() => matchMedia("(hover:hover) and (pointer:fine)").matches)).toBe(true);
    await page.locator(".ex-card").first().scrollIntoViewIfNeeded();
    await page.locator(".ex-card .ex-meta").first().hover();
    await page.waitForTimeout(400);
    expect(await lifted(page, ".ex-card")).not.toBe("none");
    await context.close();
  });

  test("on a touch device the same hover state does not lift the card, and a chip press does not scale it", async ({ browser }) => {
    const { context, page } = await open(browser, { contextOptions: { hasTouch: true, isMobile: true } });
    expect(await page.evaluate(() => matchMedia("(hover:hover)").matches)).toBe(false);
    await page.locator(".ex-card").first().scrollIntoViewIfNeeded();
    await page.locator(".ex-card .ex-meta").first().hover();      // what a tap leaves behind: a sticky :hover
    await page.waitForTimeout(400);
    expect(await lifted(page, ".ex-card")).toBe("none");
    expect(await lifted(page, ".warmup-card, .notes")).toBe("none");
    const chip = page.locator(".ex-card .set-chk").first();
    const box = await chip.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(300);
    expect(await lifted(page, ".ex-card")).toBe("none");          // the card itself does not flinch with the chip
    await page.mouse.up();
    await context.close();
  });

  test("no :hover rule moves anything outside a hover-capable media query", async ({ browser }) => {
    const { context, page } = await open(browser);
    const bad = await page.evaluate(() => {
      const out = [];
      const walk = (rules, guarded) => {
        for (const r of rules) {
          if (r.type === CSSRule.MEDIA_RULE) {
            walk(r.cssRules, guarded || /hover:\s*hover/.test(r.conditionText) || /reduce/.test(r.conditionText));
          } else if (r.type === CSSRule.STYLE_RULE && !guarded && /:hover/.test(r.selectorText)
                     && /(^|[^-])(transform|translate|scale)\b/.test(r.style.cssText.replace(/transition[^;]*;/g, ""))) {
            out.push(r.selectorText);
          }
        }
      };
      for (const sheet of document.styleSheets) { try { walk(sheet.cssRules, false); } catch (e) {} }
      return out;
    });
    expect(bad).toEqual([]);
    await context.close();
  });
});

test.describe("11 - skeleton shimmer follows reading direction", () => {
  const sweep = (page) => page.evaluate(() => {
    const sk = document.createElement("div");
    sk.className = "skeleton"; sk.style.cssText = "width:200px;height:20px;position:fixed;top:100px;left:20px;z-index:999";
    document.body.appendChild(sk);
    const a = sk.getAnimations({ subtree: true }).find((x) => x.animationName === "shimmer");
    const x = (t) => { a.pause(); a.currentTime = t; return new DOMMatrix(getComputedStyle(sk, "::after").transform).m41; };
    const r = { start: x(1), end: x(1390) };
    sk.remove();
    return r;
  });
  test("EN sweeps toward the end edge (left to right)", async ({ browser }) => {
    const { context, page } = await open(browser);
    const r = await sweep(page);
    expect(r.start).toBeLessThan(-150);
    expect(r.end).toBeGreaterThan(150);
    await context.close();
  });
  test("AR sweeps right to left", async ({ browser }) => {
    const { context, page } = await open(browser, { lang: "ar" });
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
    const r = await sweep(page);
    expect(r.start).toBeGreaterThan(150);
    expect(r.end).toBeLessThan(-150);
    await context.close();
  });
});

test.describe("12 - tab transition matches the nav axis", () => {
  const slide = async (page, to) => {
    await tab(page, to);
    return page.evaluate(() => {
      const a = document.getAnimations().filter((x) => x.effect && x.effect.target && x.effect.target.classList.contains("screen-slide-in"));
      return { name: a.map((x) => x.animationName).join(), tf: a.flatMap((x) => x.effect.getKeyframes().map((k) => k.transform).filter(Boolean)) };
    });
  };
  test("at 1280px the sidebar tabs swap with a vertical move, not a horizontal slide", async ({ browser }) => {
    const { context, page } = await open(browser, { viewport: DESKTOP });
    const r = await slide(page, "food");
    expect(r.name).toBe("m-nav-in");
    r.tf.forEach((t) => expect(t).toMatch(/translate3d\(0(px)?, [-\d.]+px, 0(px)?\)|none/));
    await context.close();
  });
  test("on the phone's bottom bar it is still the horizontal slide", async ({ browser }) => {
    const { context, page } = await open(browser);
    const r = await slide(page, "food");
    expect(r.name).toBe("m-slide-in");
    await context.close();
  });
});

test.describe("14 - Food day switch", () => {
  const goFood = async (browser, opts, delay) => {
    const app = await open(browser, opts);
    await mockMeals(app.page, [MEAL], delay);
    await app.page.click('#appNav button[data-tab="food"]');
    await app.page.waitForTimeout(900);
    await app.page.evaluate(() => {
      window.__a = [];
      document.addEventListener("animationstart", (e) => window.__a.push(e.animationName + "@" + (e.target.id || e.target.className)), true);
    });
    return app;
  };
  const names = (page) => page.evaluate(() => window.__a.filter((a) => /^(m-slide-in|m-rise)@/.test(a)));

  test("next and previous day slide the day's content in once, in opposite directions, and the arrival of the meals adds no second entrance", async ({ browser }) => {
    const { context, page } = await goFood(browser, {}, 350);
    const label = page.locator(".food-date-label");
    const before = await label.textContent();
    await page.click(".food-date-btn.next");
    await page.waitForTimeout(150);
    const first = await names(page);
    expect(first.length).toBeGreaterThan(0);
    const fwd = await page.evaluate(() => getComputedStyle(document.getElementById("foodMealsHost")).getPropertyValue("--nav-sign").trim());
    await expect(page.locator(".food-meal-row")).toHaveCount(1, T);   // meals arrived
    await page.waitForTimeout(700);
    expect(await names(page)).toEqual(first);                          // nothing replayed on arrival
    expect(new Set(first).size).toBe(first.length);                    // each element once
    expect(await label.textContent()).not.toBe(before);
    await page.evaluate(() => { window.__a = []; });
    await page.click(".food-date-btn.prev");
    await page.waitForTimeout(150);
    const back = await page.evaluate(() => getComputedStyle(document.getElementById("foodMealsHost")).getPropertyValue("--nav-sign").trim());
    expect(fwd).toBe("1");
    expect(back).toBe("-1");
    // the animation class is dropped afterwards, so re-showing the tab cannot replay it
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => document.querySelectorAll(".m-day-in").length)).toBe(0);
    await context.close();
  });
  test("returning to the Food tab adds no day animation of its own", async ({ browser }) => {
    const { context, page } = await goFood(browser, {});
    await tab(page, "plan"); await page.waitForTimeout(500);
    await page.evaluate(() => { window.__a = []; });
    await tab(page, "food"); await page.waitForTimeout(900);
    expect((await names(page)).filter((a) => /m-slide-in@(foodMealsHost|foodTotalsHost)/.test(a))).toEqual([]);
    await context.close();
  });
  test("reduced motion: the day changes with nothing animating", async ({ browser }) => {
    const { context, page } = await goFood(browser, {});
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => { window.__a = []; });
    const before = await page.locator(".food-date-label").textContent();
    await page.click(".food-date-btn.next");
    await expect(page.locator(".food-date-label")).not.toHaveText(before);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__a)).toEqual([]);
    expect(await count(page)).toBe(0);
    await context.close();
  });
});

test.describe("15 - reduced motion leaves nothing running", () => {
  test("across tabs, overlays, toasts, set checks, the sign-in list, the alarm, spinners and the Food day switch", async ({ browser }) => {
    const { context, page } = await open(browser);
    await mockMeals(page, [MEAL]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const left = [];
    const check = async (what) => {
      await page.waitForTimeout(120);
      const l = await page.evaluate(() => document.getAnimations().map((a) => (a.animationName || a.transitionProperty || "?") + "@" + ((a.effect.target && (a.effect.target.id || a.effect.target.className)) || "")));
      if (l.length) left.push(what + ": " + l.join(", "));
    };
    for (const n of ["coach", "food", "more", "plan"]) { await tab(page, n); await check("tab " + n); }
    await tab(page, "food"); await page.click(".food-date-btn.next"); await check("food day");
    await tab(page, "plan");
    await page.locator(".set-chk").first().click(); await check("set check");
    await page.evaluate(() => GymToast.show({ message: "Hi", duration: 20000 })); await check("toast");
    await page.evaluate(() => { document.getElementById("alarmBanner").hidden = false; }); await check("alarm");
    await page.evaluate(() => { document.getElementById("alarmBanner").hidden = true; });
    await page.evaluate(() => {
      // spinner, skeleton, typing dots and an unguarded infinite animation, as the app shows them
      const host = document.createElement("div"); host.id = "rmProbe";
      host.innerHTML = '<div class="coach-spin"></div><div class="skeleton" style="height:20px"></div>' +
        '<div class="coach-chat-msg assistant typing"><span></span><span></span><span></span></div>' +
        '<div class="coach-dots"><i></i><i></i><i></i></div>' +
        '<div id="rmLoop" style="width:10px;height:10px;animation:rmSpin 1s linear infinite"></div>' +
        '<style>@keyframes rmSpin{to{transform:rotate(360deg)}}</style>';
      document.body.appendChild(host);
    });
    await check("spinners");
    await page.evaluate(() => document.getElementById("rmProbe").remove());
    await page.evaluate(() => GymUI.promptSignIn());
    await page.click("#obWhyToggle"); await check("why list");
    await page.click("#obWhyToggle");
    await page.evaluate(() => window.openVideoModal && openVideoModal(DAYS[0].exercises.find((e) => e.vid))); await check("video modal");
    expect(left).toEqual([]);
    await context.close();
  });
  test("the catch-all rule also stops an infinite animation that has no guard of its own", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => {
      const s = document.createElement("style"); s.textContent = "@keyframes rmSpin{to{transform:rotate(360deg)}}"; document.head.appendChild(s);
      const d = document.createElement("div"); d.id = "rmLoop"; d.style.cssText = "width:10px;height:10px;animation:rmSpin 1s linear infinite";
      document.body.appendChild(d);
    });
    await settle(page);
    expect(await page.evaluate(() => getComputedStyle(document.getElementById("rmLoop")).animationIterationCount)).toBe("1");
    await context.close();
  });
  test("the Coach spinner and typing dots become a static signal, not a frozen ring", async ({ browser }) => {
    const { context, page } = await open(browser);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const r = await page.evaluate(() => {
      const host = document.createElement("div");
      host.innerHTML = '<div class="coach-spin" id="rmSpin"></div><div class="coach-chat-msg assistant typing"><span id="rmDot"></span></div>';
      document.body.appendChild(host);
      const sp = getComputedStyle(document.getElementById("rmSpin"));
      const dot = getComputedStyle(document.getElementById("rmDot"));
      return { anim: sp.animationName, borderStyle: sp.borderTopStyle, dotAnim: dot.animationName, dotOpacity: dot.opacity };
    });
    expect(r.anim).toBe("none");
    expect(r.borderStyle).toBe("dotted");
    expect(r.dotAnim).toBe("none");
    expect(Number(r.dotOpacity)).toBeGreaterThan(0.5);
    await context.close();
  });
});

test.describe("16 - dead CSS is gone", () => {
  test("the old screen-fade keyframes and their masks no longer ship; tab motion still comes from motion.css", async ({ browser }) => {
    const { context, page } = await open(browser);
    const r = await page.evaluate(() => {
      const kf = [];
      const walk = (rules) => { for (const x of rules) { if (x.type === CSSRule.KEYFRAMES_RULE) kf.push(x.name); else if (x.cssRules) walk(x.cssRules); } };
      for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch (e) {} }
      return kf;
    });
    expect(r).not.toContain("screen-fade-out");
    expect(r).not.toContain("screen-fade-in");
    expect(r).toContain("m-slide-in");
    await context.close();
  });
});
