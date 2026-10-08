# Shared DOM Helpers (dom.js) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five copy-pasted `h()` / `lang()` / `s()` helpers in the screen modules with one shared `dom.js`, without changing anything a user sees.

**Architecture:** A new classic script `dom.js` exposes `window.GymDom = { h, lang, makeT }`. It loads (deferred) immediately before the first screen module. Each screen module keeps its own `STR` table and its own `mount()` (they target different containers), and swaps its local helper definitions for aliases to `GymDom`. A characterization test captures the rendered text of every affected screen in EN and AR **before** the refactor; the refactor must leave it unchanged.

**Tech Stack:** Vanilla ES5-style JS (IIFE modules, no build step), Playwright 1.63 tests in `tests/`, nginx Docker image.

**Spec:** Agreed in the 2026-10-08 session: "the code has started repeating itself — five screens each carry their own copy of `h()` and their own translation lookup; move those into one shared module" (the cheap alternative to a React rewrite). No separate spec file.

## Global Constraints

- No build step, no npm dependency in the shipped app; plain `<script>` files only.
- No user-visible change: same DOM text, same language behaviour, same offline behaviour.
- Every new shipped file must be listed in **three** places or the image/offline cache breaks: `Dockerfile` COPY line, `Dockerfile` hash `cat` list, `service-worker.js` `ASSETS` (the Dockerfile comment says "Keep this file list in sync with ASSETS").
- Out of scope: `mount()` (each module targets a different container: `#foodBody`, `#coachBody`, …), `app.js`'s own `t()`/`T` table, `admin.js`, `privacy.js`, `calendar.js`, `rest-days.js`.

## Verified facts (checked at plan time against origin/main 63990d6)

- `function h(` exists in exactly five shipped files: `chat.js:61`, `checkin.js:93`, `coach.js:161`, `food.js:93`, `workout-builder.js:72`.
- They differ in one line: `chat.js`, `coach.js`, `workout-builder.js` append `String(x)` for children that are neither string nor node; `checkin.js` and `food.js` silently drop them. The shared version uses the `String(x)` superset. A grep of `checkin.js`/`food.js` `h(...)` calls found no numeric/boolean children, so this should change nothing; Task 1's characterization test proves it.
- `lang()` is byte-identical in all five: checks `window.activeLang`, then `localStorage.gym_lang`. Note `window.activeLang` is **always undefined**: `app.js:739` declares `let activeLang` (a global lexical binding, not a `window` property), so in practice `lang()` reads `localStorage.gym_lang`, which `applyLang(lang, persist)` (`app.js:1487`) writes via `setPref` when `persist` is true. This plan keeps that behaviour exactly; fixing it is a follow-up (see the end of this plan).
- `s(k)` is identical in all five (`chat.js:46` is a one-line form of the same body): `STR[k][ar?1:0]`, falling back to the key. In every file `var STR = {` comes before `function s(` (chat 32<46, checkin 37<82, coach 38<155, food 40<87, workout-builder 50<66), so `var s = GymDom.makeT(STR)` placed where `s` is now defined sees a populated `STR`.
- Script order in `index.html`: `app.js` is a classic script (line 363); the screen modules are `defer` (lines 371–385: checkin, mascot, coach, chat, food, …, workout-builder). Deferred scripts run in document order, so `<script src="dom.js" defer>` inserted **directly before `checkin.js` (line 371)** runs before all five.
- CI (`.github/workflows/docker-image.yml`) builds the image and curls smoke checks; it does **not** run Playwright. Tests run locally: `cd tests && npx playwright test`.

## Review Focus

1. A screen that renders a number child (e.g. a kcal total passed as a number) in `checkin.js`/`food.js`: previously dropped, now shown. Expected: no such call exists; the characterization snapshot in Task 1 must not change.
2. Language switch while a screen is open: the text must flip exactly as before (Task 1 snapshots AR via `gym_lang`, and Task 3 runs the switch test).
3. Offline launch after deploy: `dom.js` must be in the SW precache, or the screens crash offline with `GymDom is undefined` (Task 4 asserts it is listed).
4. Docker image missing `dom.js` → 404 → every screen broken in prod while local tests pass (Task 4 adds a CI curl check).
5. A screen module evaluated before `dom.js` (someone later moves a script tag) → `TypeError` at load. Each module guards with a clear error message (Task 3).

---

### Task 1: Characterization test (before touching any helper)

**Files:**
- Create: `tests/screens-text.spec.js`
- Generated: `tests/screens-text.spec.js-snapshots/*.txt` (committed)

**Interfaces:**
- Consumes: `openApp(browser, { signedIn, lang })` from `tests/helpers.js:65` (returns `{ context, page, consoleErrors }`); globals `GymCoach`, `GymFood`, `GymChat`, `GymCheckin`, `GymWorkoutBuilder` (exports at `coach.js:1249`, `food.js:721`, `chat.js:462`, `checkin.js:423`, `workout-builder.js:406`).
- Produces: committed text snapshots that Tasks 2–3 must keep green.

- [ ] **Step 1: Write the test**

```js
// Characterization: the rendered text of the five h()/s() screens, EN + AR,
// signed out and signed in. Written before the dom.js refactor; the refactor
// must not change a single snapshot.
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test.setTimeout(60000);

const text = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  return el ? el.innerText.replace(/\s+\n/g, "\n").trim() : "<missing " + s + ">";
}, sel);

for (const lang of ["en", "ar"]) {
  for (const signedIn of [false, true]) {
    const tag = `${lang}-${signedIn ? "in" : "out"}`;

    test(`coach + food tabs render the same (${tag})`, async ({ browser }) => {
      const { context, page, consoleErrors } = await openApp(browser, { lang, signedIn });
      await page.click('[data-tab="coach"]');
      await page.waitForTimeout(400);
      expect(await text(page, "#coachBody")).toMatchSnapshot(`coach-${tag}.txt`);
      await page.click('[data-tab="food"]');
      await page.waitForTimeout(400);
      expect(await text(page, "#foodBody")).toMatchSnapshot(`food-${tag}.txt`);
      expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
      await context.close();
    });
  }

  test(`chat, workout builder and check-in card render the same (${lang})`, async ({ browser }) => {
    const { context, page, consoleErrors } = await openApp(browser, { lang, signedIn: true });
    const before = await page.evaluate(() => document.body.childElementCount);
    await page.evaluate(() => window.GymChat.open());
    await page.waitForTimeout(400);
    expect(await text(page, "body")).toMatchSnapshot(`chat-${lang}.txt`);
    await page.reload();
    await page.waitForFunction(() => window.GymWorkoutBuilder);
    await page.evaluate(() => window.GymWorkoutBuilder.open());
    await page.waitForTimeout(400);
    expect(await text(page, "body")).toMatchSnapshot(`builder-${lang}.txt`);
    expect(before).toBeGreaterThan(0);
    expect(consoleErrors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
    await context.close();
  });
}
```

Note on `GymCheckin.renderCard`: it is called by `app.js` while rendering the plan screen, so its text already appears in the `body` snapshots above; don't call it directly.

- [ ] **Step 2: Generate the snapshots on unmodified code**

Run: `cd tests && npx playwright test screens-text.spec.js --update-snapshots`
Expected: 6 tests pass; 12 `.txt` files written under `tests/screens-text.spec.js-snapshots/`.

- [ ] **Step 3: Check the snapshots are stable (run twice without update)**

Run: `cd tests && npx playwright test screens-text.spec.js --repeat-each=2`
Expected: all pass. If one flakes (e.g. a relative timestamp), replace that volatile substring in `text()` with a regex mask before committing, e.g. `.replace(/\d{1,2}:\d{2}/g, "HH:MM")`, and regenerate.

- [ ] **Step 4: Open two snapshots and sanity-check them**

Read `coach-ar-out.txt` and `food-en-in.txt`. Expected: real Arabic/English UI copy, not `<missing …>` and not empty. An empty snapshot means the selector or tab name is wrong; fix the test, don't commit it.

- [ ] **Step 5: Commit**

```bash
git add tests/screens-text.spec.js tests/screens-text.spec.js-snapshots
git commit -m "test(ui): characterize screen text before dom.js refactor"
```

---

### Task 2: dom.js with its own unit test

**Files:**
- Create: `dom.js`
- Create: `tests/dom.spec.js`
- Modify: `index.html:371` (insert one line before `<script src="checkin.js" defer></script>`)

**Interfaces:**
- Produces: `window.GymDom.h(tag, attrs, ...children) → Element`; `window.GymDom.lang() → "en" | "ar"`; `window.GymDom.makeT(STR) → function s(key) → string`, where `STR` is `{ key: [en, ar] }`.

- [ ] **Step 1: Write the failing test**

```js
const { test, expect } = require("@playwright/test");
const { openApp } = require("./helpers");

test("GymDom.h builds elements like the old per-screen h()", async ({ browser }) => {
  const { context, page } = await openApp(browser, {});
  const r = await page.evaluate(() => {
    const h = window.GymDom.h;
    let clicked = 0;
    const el = h("button", { class: "a b", text: "ignored-by-children?", "data-x": "1", hidden: false, title: null,
      on: { click: () => { clicked++; } } });
    el.click();
    const p = h("p", null, "a", [h("b", null, "b"), null, false], 0, 7, undefined, "c");
    return { tag: el.tagName, cls: el.className, dx: el.getAttribute("data-x"),
      hasHidden: el.hasAttribute("hidden"), hasTitle: el.hasAttribute("title"),
      text: el.textContent, clicked, ptext: p.textContent, pkids: p.childNodes.length };
  });
  expect(r).toEqual({ tag: "BUTTON", cls: "a b", dx: "1", hasHidden: false, hasTitle: false,
    text: "ignored-by-children?", clicked: 1, ptext: "ab07c", pkids: 5 });
  await context.close();
});

test("GymDom.lang and makeT follow gym_lang and fall back to the key", async ({ browser }) => {
  const { context, page } = await openApp(browser, { lang: "ar" });
  const r = await page.evaluate(() => {
    const s = window.GymDom.makeT({ hi: ["Hello", "أهلاً"] });
    const ar = [window.GymDom.lang(), s("hi"), s("nope")];
    localStorage.setItem("gym_lang", "en");
    const en = [window.GymDom.lang(), s("hi")];
    localStorage.setItem("gym_lang", "fr");
    return { ar, en, other: window.GymDom.lang() };
  });
  expect(r).toEqual({ ar: ["ar", "أهلاً", "nope"], en: ["en", "Hello"], other: "en" });
  await context.close();
});
```

(`pkids` is 5: text "a", `<b>`, text "0", text "7", text "c". `0` is kept because the check is `x == null || x === false`, not falsiness — same as the old helpers.)

- [ ] **Step 2: Run it to see it fail**

Run: `cd tests && npx playwright test dom.spec.js`
Expected: FAIL, `Cannot read properties of undefined (reading 'h')`.

- [ ] **Step 3: Write dom.js**

```js
/* dom.js — helpers shared by the screen modules (chat, checkin, coach, food,
 * workout-builder). Loaded with `defer` just before them in index.html, so
 * window.GymDom exists when their IIFEs run.
 *
 * h()      tiny element builder: h(tag, attrs, ...children)
 * lang()   "ar" | "en" for the screen modules' own STR tables
 * makeT()  builds a module's s(key) over its { key: [en, ar] } table */
(function () {
  "use strict";

  // window.activeLang is checked first for parity with the old copies; it is
  // normally undefined (app.js declares `let activeLang`, which is not a
  // window property), so gym_lang decides.
  function lang() {
    try { if (window.activeLang === "ar") return "ar"; } catch (e) {}
    try { return localStorage.getItem("gym_lang") === "ar" ? "ar" : "en"; } catch (e) { return "en"; }
  }

  function makeT(STR) {
    return function s(k) {
      var e = STR[k];
      return e ? e[lang() === "ar" ? 1 : 0] : k;
    };
  }

  function h(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k === "on" && attrs[k]) {
          Object.keys(attrs[k]).forEach(function (ev) { node.addEventListener(ev, attrs[k][ev]); });
        } else if (attrs[k] != null && attrs[k] !== false) node.setAttribute(k, attrs[k]);
      });
    }
    var put = function (x) {
      if (x == null || x === false) return;
      if (typeof x === "string") node.appendChild(document.createTextNode(x));
      else if (x && x.nodeType) node.appendChild(x);
      else node.appendChild(document.createTextNode(String(x))); // numbers; odd model output in coach
    };
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (Array.isArray(c)) c.forEach(put);
      else put(c);
    }
    return node;
  }

  window.GymDom = { h: h, lang: lang, makeT: makeT };
})();
```

- [ ] **Step 4: Load it in index.html**

In `index.html`, directly above `<script src="checkin.js" defer></script>` (line 371), add:

```html
<script src="dom.js" defer></script>
```

- [ ] **Step 5: Run the new tests and the characterization test**

Run: `cd tests && npx playwright test dom.spec.js screens-text.spec.js`
Expected: all pass (the screens don't use GymDom yet, so snapshots are unchanged).

- [ ] **Step 6: Commit**

```bash
git add dom.js tests/dom.spec.js index.html
git commit -m "feat(ui): add shared dom.js helpers (h, lang, makeT)"
```

---

### Task 3: Switch the five screens to GymDom

**Files:**
- Modify: `chat.js` (`lang` at 28–31, `s` at 46, `h` at 61–84)
- Modify: `checkin.js` (`lang` 33–36, `s` 82–85, `h` 93–115)
- Modify: `coach.js` (`lang` 34–37, `s` 155–158, `h` 161–184)
- Modify: `food.js` (`lang` 36–39, `s` 87–90, `h` 93–115)
- Modify: `workout-builder.js` (`lang` 46–49, `s` 66–69, `h` 72–95)

(Line numbers are from origin/main 63990d6. Re-grep `function h(`, `function lang(`, `function s(` before editing; ranges shift once you edit the top of a file. Edit bottom-up within a file: `h`, then `s`, then `lang`.)

**Interfaces:**
- Consumes: `window.GymDom.{h, lang, makeT}` from Task 2.

- [ ] **Step 1: In each file, replace the three definitions**

Delete the `function h(tag, attrs) { … }` block (the comment line above it, e.g. `// ---------------- tiny DOM helper … ----------------`, stays as a section marker or goes; your choice, but be consistent across the five). In its place, nothing.

Replace the `function s(k) { … }` block with:

```js
  var s = GymDom.makeT(STR);
```

Replace the `function lang() { … }` block with:

```js
  if (!window.GymDom) throw new Error("<file>.js: dom.js must load first");
  var h = GymDom.h, lang = GymDom.lang;
```

using the real file name in the message (`chat.js`, `checkin.js`, …). The guard is the fix for Review Focus #5: a moved script tag fails loudly at load instead of with an obscure `h is not a function` later.

`function` declarations were hoisted, `var`s are not. Before moving on, confirm nothing in the file **calls** `h`, `s` or `lang` at the top level of the IIFE above these new lines:

```bash
for f in chat checkin coach food workout-builder; do echo "== $f"; awk '/var h = GymDom.h/{exit} /(^|[^.a-zA-Z_])(h|s|lang)\(/{print FILENAME":"NR": "$0}' $f.js; done
```

Expected: only lines inside `function …(){}` bodies (called later), or the STR literal. A real top-level call (e.g. `var LABEL = s("x");` above the alias) must be moved below the alias line.

- [ ] **Step 2: Confirm no copies are left**

Run: `grep -n "function h(\|function lang()\|function s(k)" chat.js checkin.js coach.js food.js workout-builder.js`
Expected: no output.

- [ ] **Step 3: Run the characterization test**

Run: `cd tests && npx playwright test screens-text.spec.js`
Expected: PASS with zero snapshot diffs. **Do not run `--update-snapshots`.** A diff means behaviour changed; most likely a number child in `checkin.js`/`food.js` (Review Focus #1). Find the call and pass `String(n)` explicitly only if the old output was actually wanted without it. More likely, the old drop was a bug, which you report rather than silently keep.

- [ ] **Step 4: Run the full suite (covers the language switch, privacy and rest-day flows that render through these screens)**

Run: `cd tests && npx playwright test`
Expected: everything passes (60+ tests including the new ones).

- [ ] **Step 5: Commit**

```bash
git add chat.js checkin.js coach.js food.js workout-builder.js
git commit -m "refactor(ui): use shared GymDom helpers in five screen modules"
```

---

### Task 4: Ship dom.js in the image and the offline cache

**Files:**
- Modify: `Dockerfile` (COPY line listing the PWA files; hash `cat` list)
- Modify: `service-worker.js` (`ASSETS`, add after `"./toast.js",` at line 42)
- Modify: `.github/workflows/docker-image.yml` (smoke curls, near line 74)
- Test: `tests/dom.spec.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/dom.spec.js`:

```js
const fs = require("fs");
const path = require("path");

test("dom.js is shipped and precached", () => {
  const root = path.join(__dirname, "..");
  const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
  const docker = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  expect(sw).toContain('"./dom.js"');
  const copyLine = docker.split("\n").find((l) => l.startsWith("COPY") && l.includes("toast.js") && l.includes("/app/"));
  expect(copyLine).toContain(" dom.js ");
  const hashBlock = docker.slice(docker.indexOf("HASH=$(cat"), docker.indexOf("sha256sum"));
  expect(hashBlock).toContain(" dom.js ");
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd tests && npx playwright test dom.spec.js -g "shipped"`
Expected: FAIL on the `service-worker.js` assertion.

- [ ] **Step 3: Add dom.js to the three lists**

- `service-worker.js`: add `"./dom.js",` after `"./toast.js",`.
- `Dockerfile` COPY line: insert ` dom.js` after `toast.js` (between `toast.js` and `service-worker.js`).
- `Dockerfile` hash list: insert ` dom.js` after `toast.js` on the `rest-days.js calendar.js … toast.js config.js manifest.json \` line.
- Workflow smoke checks, after the `service-worker.js` curl (line 74), add:

```yaml
          curl -fsS localhost:8080/app/dom.js | grep -q 'window.GymDom'
```

- [ ] **Step 4: Run tests, then build the image locally**

Run: `cd tests && npx playwright test` → all pass.
Run (from the repo root): `docker build -t gym-ui:domcheck . && docker run -d --rm -p 18080:8080 --name domcheck gym-ui:domcheck && sleep 2 && curl -fsS localhost:18080/app/dom.js | head -3 && curl -fsS localhost:18080/app/service-worker.js | grep -o 'etqadem-[0-9a-f]*' ; docker stop domcheck`
Expected: the dom.js header comment and an `etqadem-<12 hex>` cache name. If Docker isn't available locally, say so in the PR; CI's docker job runs the same curl.

- [ ] **Step 5: Commit, push, open the PR**

```bash
git add service-worker.js Dockerfile .github/workflows/docker-image.yml tests/dom.spec.js
git commit -m "build(ui): ship and precache dom.js"
git push -u origin HEAD
gh pr create --base main --title "refactor(ui): shared dom.js helpers for screen modules" --body-file <pr-body.md>
```

PR body must state what was verified (full Playwright suite incl. EN/AR characterization snapshots, docker build) and what was **not** verified (real-device offline relaunch after the SW update; test that on the phone after deploy).

---

## Spec coverage

| Requirement | Task |
|---|---|
| One shared `h()` instead of five copies | 2, 3 |
| One shared language/translation lookup | 2 (`lang`, `makeT`), 3 |
| No user-visible change (EN + AR) | 1 (snapshots), 3 step 3 |
| Works offline / in the deployed image | 4 |
| Doesn't need a framework or build step | Global Constraints; dom.js is a plain script |

## Producer → consumer check

- Task 3 needs `GymDom.h` (same signature as the old `h`: `(tag, attrs, ...children)`), `GymDom.lang()` (returns `"ar"|"en"`, used directly by e.g. `coach.js` and `food.js` for date/number locale), and `GymDom.makeT(STR)` returning `s(k)`. Task 2 produces exactly these three, with matching semantics (verified by `tests/dom.spec.js`).
- Task 4's CI check greps `window.GymDom`, which is the last line of Task 2's `dom.js`.

## Follow-up (not in this PR)

`lang()` can disagree with the app for one moment: `app.js` switches `activeLang` before it persists `gym_lang` only when `persist` is true (`applyLang(lang, persist)`, `app.js:1487`). If any call path uses `persist=false` with a language different from the stored one, the screen modules render the stored language. Now that there is one `lang()`, fixing it is a single line (read `document.documentElement.lang`, which `applyLang` always sets). Do it as its own change with a test that calls `applyLang("ar", false)`.
