# Plan tab muscle images: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. UI implementers invoke the `frontend-design` skill first.

**Goal:** On the Plan tab, each day shows a row of muscle tiles (name + shaded anatomy close-up), and each exercise card shows a close-up of its body area. The exact trained part is lit up, with a label chip. This covers built-in plans and AI-coach plans.

**Architecture:** A new `muscle-art.js` holds original SVG anatomy figures (male/female × front/back, 20 regions, shading + fibre lines). It exposes `window.GymMuscleArt`, which returns SVG strings for a region close-up or a group tile. `app.js` reads each exercise's `shape`/`shape2` (audited) and renders the close-up and tiles. `coach.js` carries `shape` from gym-assistant, or falls back to an exact/alias name lookup. gym-assistant gets an optional, enum-constrained `shape`/`shape2` per exercise.

**Tech Stack:** Vanilla JS (no build), inline SVG, CSS custom properties, Playwright 1.63 (`tests/`, `cd tests && npx playwright test`); Go (gym-assistant, `go test ./...`).

**Spec:** `docs/superpowers/specs/2026-10-20-plan-muscle-images-design.md` (read it fully; its "Main-session calls" section is binding).

## Global Constraints

- All art is original, made in this PR. Add a header comment in `muscle-art.js`: "Original artwork, Etqadem, 2026. Not derived from third-party images." State the same in the PR.
- No photos, raster images or network requests for art.
- Colours come only from CSS variables (`--primary`, `--primary-text`, `--surface-*`, `--line`, plus new `--mus-*` tokens defined per theme/persona in styles.css), so theme switches need no re-render.
- EN + AR (RTL), dark + light, men + women personas, 360px with no horizontal scroll.
- Exercise `id`, `en`, sets, reps, rest, `vid`, `tier` are untouched. Only `shape`/`shape2` may change (tag audit).
- An unknown shape shows no picture and no chip. Never guess fuzzily.
- `prefers-reduced-motion`: no animation on the new elements.
- PRs open as **DRAFT**. Never merge. Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Review Focus

1. A saved `gym_plans_custom` plan from before this change (no `shape` fields) must still render, with fallback pictures where names match exactly or by alias, and none otherwise (Task 5 test `legacy coach plan without shape`).
2. Switching Men/Women persona or theme must update the figure and colours on the open Plan tab without a reload (Task 3 test `persona switch swaps figure`).
3. A primary and secondary on different views must still show the primary's view, and the chip must name both (Task 3 test `cross-view secondary`).
4. Arabic RTL: the close-up sits on the start (right) side, and chip text is Arabic (Task 3 test `ar rtl closeup`).
5. A day where no exercise has a known shape must show no empty tile row or gap (Task 4 test `no tiles when no shapes`).

---

### Task 1: `muscle-art.js` anatomy figures + API

**Files:**
- Create: `muscle-art.js`
- Modify: `index.html` (add `<script src="muscle-art.js"></script>` directly **before** `app.js`, non-deferred), `service-worker.js` (add `"./muscle-art.js"` to `ASSETS`)
- Test: `tests/muscle-art.spec.js`

**Interfaces:**
- Produces: `window.GymMuscleArt = { REGIONS, viewOf(shapeId) -> "front"|"back"|null, closeup(shapeId, {sex:"male"|"female", secondary?:shapeId}) -> string /* "<svg …>" or "" */, group(groupName, {sex}) -> string, figure(view, {sex, lit?:shapeId[]}) -> string }`.
- `REGIONS` = exactly the 20 ids in `MUSCLE_SHAPES` (app.js ~L210).
- Each highlighted region path carries `data-region="<id>"` and class `ma-hi` (primary) or `ma-hi2` (secondary). Non-lit regions get class `ma-m`. Every SVG root has class `ma-svg ma-<sex>`.
- Group names = `MUSCLE_SHAPES[].group` values: Chest, Back, Shoulders, Biceps, Triceps, Quads, Hamstrings, Glutes, Calves, Core. `group()` lights every region of that group.

- [ ] **Step 1: Write failing tests** in `tests/muscle-art.spec.js` (load `/index.html`, then `page.evaluate`):
  - `every region drawable`: for each of the 20 ids and both sexes, `closeup(id,{sex})` contains `data-region="${id}"` with class `ma-hi`, and exactly one region is `ma-hi`.
  - `views`: `viewOf("back_lats")==="back"`, `viewOf("chest_upper")==="front"`, `viewOf("calves")==="back"`, `viewOf("nope")===null`.
  - `secondary`: `closeup("hamstrings",{sex:"male",secondary:"back_lower"})` has one `ma-hi` and one `ma-hi2`.
  - `unknown`: `closeup("nope",{sex:"male"})===""`.
  - `female differs`: the `closeup("glutes",{sex:"female"})` silhouette path differs from the male one, and its root has `ma-female`.
  - `no hard-coded colours`: the output has no `#` hex colour or `rgb(` inside `fill=`/`stroke=` (only `url(#…)` or `var(`).
- [ ] **Step 2: Run** `cd tests && npx playwright test muscle-art.spec.js`. Expected: FAIL (GymMuscleArt undefined).
- [ ] **Step 3: Implement** `muscle-art.js`. Use a half-body drawn once and mirrored with `transform="translate(W 0) scale(-1 1)"`. Give each muscle a radial-gradient volume and a fibre-line `<pattern>` rotated to the real fibre direction. Close-ups are viewBox crops per region. Gradient/pattern ids get a per-call unique prefix, because many SVGs share one document. The spike in the brainstorm (shape list, mirroring, fibre angles) is only a starting point. Make it smoother and more anatomical, with a distinct female figure (proportions, hips/waist/chest outline).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(plan): original anatomy figures for muscle close-ups`.

### Task 2: Tag audit + exact/alias name lookup

**Files:**
- Modify: `app.js` (exercise data `shape`/`shape2` only; add `window.GymExerciseShape` beside `window.GymExerciseVideo` ~L321)
- Test: `tests/muscle-tags.spec.js`

**Interfaces:**
- Produces: `window.GymExerciseShape(name) -> {shape, shape2?} | null`. Match only an exact `_normEx` name (EN or AR) or an `EX_ALIASES` alias. No contains-match.
- Produces: `window.GymApp.muscleShapes` = the `MUSCLE_SHAPES` array (read-only reference, for Task 4).

- [ ] **Step 1: Failing tests:**
  - `all built-in exercises tagged`: every exercise in every plan set has `shape` in REGIONS, and `shape2` is absent or in REGIONS and `!== shape`. Expose the sets through `window.GymApp.allDaySets()` for the test.
  - `arms superset`: the "Biceps Curl + Triceps Extension (superset)" and "Biceps + Triceps Superset" exercises have one `biceps_*` and one `triceps_*` tag.
  - `lookup exact`: `GymExerciseShape("barbell bench press").shape==="chest_mid"`, alias `GymExerciseShape("burpee")` is non-null, and `GymExerciseShape("bench")===null` (no fuzzy match).
- [ ] **Step 2: Run** `npx playwright test muscle-tags.spec.js`. Expected: FAIL.
- [ ] **Step 3:** Audit and fix the tags. Keep a table (exercise · old → new · why) for the PR body. Implement the lookup and the accessors.
- [ ] **Step 4: Run** `muscle-tags.spec.js` + `builder*.spec.js`. Expected: PASS. The builder reads the same tags.
- [ ] **Step 5: Commit** `fix(plan): audit exercise muscle tags; add exact name→muscle lookup`.

### Task 3: Exercise card close-up + chip

**Files:**
- Modify: `app.js` `renderExercises()` (~L1169), `styles.css` (new `.ex-mus`, `.ex-mus-chip`, `--mus-*` tokens per theme/persona)
- Test: `tests/plan-muscle-card.spec.js`

**Interfaces:**
- Consumes: `GymMuscleArt.closeup`, `GymMuscleArt.viewOf`, `MUSCLE_SHAPES` labels.
- Sex = `activePlan === "female" ? "female" : "male"`.
- Markup in `.ex-top`: `<span class="ex-mus" role="img" aria-label="{chip text}">{svg}</span>` on the start side. Under the name: `<span class="ex-mus-chip">{label}{ · label2}</span>`, using `labelAr` in AR. Neither is rendered when the shape is unknown.

- [ ] **Step 1: Failing tests:**
  - `card shows primary`: on the men's gym plan, the Upper day's "Barbell Bench Press" card `.ex-mus [data-region="chest_mid"].ma-hi` is visible, and the chip text is "Mid chest".
  - `cross-view secondary`: inject a custom plan with `shape:"quads", shape2:"glutes"`. The close-up is the front view, and the chip contains both "Quads" and "Glutes".
  - `ar rtl closeup`: in AR, the chip shows the `labelAr` text, and `.ex-mus` is to the right of the title (boundingBox x greater).
  - `persona switch swaps figure`: switch to Women without a reload. `.ex-mus svg` has the `ma-female` class.
  - `360 no overflow`: at a 360×800 viewport, `document.documentElement.scrollWidth <= 360`, and the set-checkbox row is fully inside the viewport.
- [ ] **Step 2: Run** → FAIL. **Step 3:** Implement. **Step 4: Run** this spec plus the full suite (`npx playwright test`). Update `screens-text` snapshots only where this feature changes them, and list them in the PR. **Step 5: Commit** `feat(plan): muscle close-up and label on each exercise`.

### Task 4: Day muscle tiles

**Files:**
- Modify: `app.js` (render after `dayMuscles.textContent = …` ~L1173), `index.html` (an empty `<div id="dayMuscleTiles" class="mus-tiles"></div>` right after `#dayMuscles`'s container), `styles.css`
- Test: `tests/plan-muscle-tiles.spec.js`

**Interfaces:**
- Groups = the unique `MUSCLE_SHAPES[].group` values of the day's exercises' `shape`+`shape2`, in catalog order. Each tile is `<div class="mus-tile" data-group="{group}">{GymMuscleArt.group(group,{sex})}<span>{group|groupAr}</span></div>`.
- Tiles are hidden (`hidden` attribute, empty) in rest view and when the list is empty.

- [ ] **Step 1: Failing tests:**
  - `men upper tiles`: the Men's gym "Upper" day tiles, read in order, are exactly the groups derived from its exercises. Compute the expected value in the test from `GymApp.dayExercises` + `muscleShapes`; don't hard-code it.
  - `ar tile names`: in AR, the tiles show `groupAr`.
  - `no tiles when no shapes`: a custom plan whose exercises have unknown names shows `#dayMuscleTiles` hidden.
  - `rest view hides tiles`.
  - `tiles wrap at 360`: no horizontal scroll.
- [ ] **Step 2–4:** Run → FAIL, implement, then run → PASS plus the full suite. **Step 5: Commit** `feat(plan): muscle-group tiles per day`.

### Task 5: AI-coach plans

**Files:**
- Modify: `coach.js` `mapWorkout()` (~L1567); `app.js` render path (fallback for saved plans)
- Test: `tests/plan-muscle-coach.spec.js`

**Interfaces:**
- `mapWorkout` copies `e.shape`/`e.shape2` only when the value is in `GymMuscleArt.REGIONS`. Otherwise it uses `GymExerciseShape(e.name)`. Otherwise it leaves the shape out.
- At render time, an exercise with no `shape` tries `GymExerciseShape(ex.en)`. This covers plans saved before this change.

- [ ] **Step 1: Failing tests:**
  - `coach shape used`: apply a plan via `window.GymApplyCoachPlan(mapWorkout-equivalent)`, or stub the assistant response with `shape:"back_lats"`. The card lights `back_lats`.
  - `invalid shape dropped`: `shape:"wings"` with an unknown name renders no `.ex-mus`.
  - `legacy coach plan without shape`: seed `gym_plans_custom` in localStorage with `{en:"Barbell Bench Press"}` and no shape. The card lights `chest_mid`. Also seed `{en:"Zercher Carry"}`, which renders no `.ex-mus` and no chip.
- [ ] **Step 2–4:** Run → FAIL, implement, then run → PASS plus the full suite.
- [ ] **Step 5:** Take screenshots: EN/AR × dark/light × men/women at 360px, plus one desktop. Put them in `docs/screenshots/2026-10-20-muscle/` (not committed if the repo ignores screenshots; attach to the PR either way).
- [ ] **Step 6: Commit** `feat(coach): muscle tags on AI-coach plans with exact-name fallback`. Push the branch and open a **DRAFT** PR to `Eslam1141/gym-ui` `main`. The body includes the tag-audit table, test list, which existing snapshots changed and why, the art provenance statement, and the screenshots. Commit the spec + this plan in the branch as well.

### Task 6 (gym-assistant, separate repo/PR): optional `shape`/`shape2` per exercise

**Files:**
- Modify: `gym-assistant/internal/assistant/types.go` (`WorkoutExercise`: `Shape string \`json:"shape,omitempty" bson:"shape,omitempty"\``, `Shape2` likewise), `prompt.go` (schema: `"shape": {"type":"string","enum":[…20 ids…]}`, `shape2` same; **not** in `required`; one prompt line asking the model to tag each exercise with its primary target region and, only if clearly significant, a secondary one), `stub.go` (tag the stub exercises)
- Add: `ValidMuscleShape(id string) bool` + a sanitiser that blanks an invalid `Shape`/`Shape2` (and a `Shape2 == Shape`) after decoding, before caching/returning
- Test: `internal/assistant/muscle_shape_test.go`

The 20 ids, exactly: `chest_upper chest_mid chest_lower back_lats back_mid back_lower shoulder_front shoulder_side shoulder_rear biceps_long biceps_short triceps_long triceps_lateral quads hamstrings glutes calves core_upper core_lower core_obliques`.

- [ ] **Step 1: Failing tests:** `TestValidMuscleShape` (all 20 true; `""`, `"wings"` false). `TestSanitiseDropsInvalidShape` (invalid → `""`, plan and exercise kept). `TestDecodeLegacyPlanWithoutShape` (old JSON without the field decodes, and `Shape==""`). `TestSchemaShapeEnumMatches` (the schema enum equals the Go list, so they can't drift).
- [ ] **Step 2: Run** `go test ./internal/assistant/ -run 'Shape|Legacy' -v` → FAIL. **Step 3:** Implement. **Step 4: Run** `go test ./...` → PASS, plus `go vet ./...`.
- [ ] **Step 5:** Branch `feat/workout-muscle-shape`, commit, push, and open a **DRAFT** PR to `Eslam1141/gym-assistant` (check `git remote -v` for the exact repo). Note in the body: backward compatible, field optional, and it pairs with the gym-ui PR (either can merge first).
