// Characterization: the rendered text of the five h()/s() screens, EN + AR,
// signed out and signed in. Written before the dom.js refactor; the refactor
// must not change a single snapshot.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(90000);

// Text nodes, one per line, skipping <script>/<style> and hidden subtrees.
// Unlike innerText this doesn't depend on layout (CSS still loading or
// animating can merge "Day 1" and "0 exercises" into one line).
const read = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return "<missing " + s + ">";
  const out = [];
  const walk = (n) => {
    if (n.nodeType === 3) { const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (t) out.push(t); return; }
    if (n.nodeType !== 1 || /^(SCRIPT|STYLE|TEMPLATE)$/.test(n.tagName) || n.hidden) return;
    n.childNodes.forEach(walk);
  };
  walk(el);
  return out.join("\n");
}, sel);

// The screens render async (API mocks, deferred scripts); fixed sleeps flake
// under load. Wait until the text is non-empty and unchanged for 500 ms.
async function text(page, sel) {
  let last = null, stableSince = 0;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const now = await read(page, sel);
    if (now && now === last) {
      if (Date.now() - stableSince >= 500) return now;
    } else { last = now; stableSince = Date.now(); }
    await page.waitForTimeout(100);
  }
  return last;
}

const realErrors = (errs) => errs.filter((e) => !/Failed to load resource/.test(e));

for (const lang of ["en", "ar"]) {
  for (const signedIn of [false, true]) {
    const tag = `${lang}-${signedIn ? "in" : "out"}`;

    test(`coach + food tabs render the same (${tag})`, async ({ browser }) => {
      const { context, page, consoleErrors } = await openApp(browser, { lang, signedIn });
      await page.click('[data-tab="coach"]');
      expect(await text(page, "#coachBody")).toMatchSnapshot(`coach-${tag}.txt`);
      await page.click('[data-tab="food"]');
      expect(await text(page, "#foodBody")).toMatchSnapshot(`food-${tag}.txt`);
      expect(realErrors(consoleErrors)).toEqual([]);
      await context.close();
    });
  }

  test(`chat and workout builder render the same (${lang})`, async ({ browser }) => {
    const { context, page, consoleErrors } = await openApp(browser, { lang, signedIn: true });
    await page.evaluate(() => window.GymChat.open());
    expect(await text(page, "body")).toMatchSnapshot(`chat-${lang}.txt`);
    await page.reload();
    await page.waitForFunction(() => window.GymWorkoutBuilder);
    // The builder mounts into #coachBody, which is only visible on the coach tab.
    await page.click('[data-tab="coach"]');
    await page.evaluate(() => window.GymWorkoutBuilder.open());
    expect(await text(page, "#coachBody")).toMatchSnapshot(`builder-${lang}.txt`);
    expect(realErrors(consoleErrors)).toEqual([]);
    await context.close();
  });
}
