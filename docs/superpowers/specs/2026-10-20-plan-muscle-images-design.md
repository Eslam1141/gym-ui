# Plan tab: muscle names + muscle images — design

Date: 2026-10-20 · Owner request: "can we make the categories in the plan by muscle name + photo and each training target which part photo"

## Intent

People open the Plan tab at the gym and don't always know **where a muscle is** or **which part of it** a move works. Each workout day should show the muscles it trains (name + picture), and each exercise should show a close-up of its body area with the exact part lit up (e.g. Incline Dumbbell Press → upper chest, Barbell Bench Press → mid chest). It is educational: location + sub-part.

## Goals

1. **Day level — muscle tiles.** Day tabs keep their names (Upper, Lower, Push, Back + Biceps + Calves…). Under the selected day (where `#dayMuscles` "Upper — Chest, Back, Shoulders" sits today), show a row of tiles, one per muscle **group** trained that day (Chest, Back, Shoulders, Biceps, Triceps, Quads, Hamstrings, Glutes, Calves, Core). Each tile = a small shaded close-up of that group's area + the group name (EN/AR). Groups are derived from the day's exercises' `shape`/`shape2` via `MUSCLE_SHAPES[].group` — not from the free-text `muscles` string.
2. **Exercise level — close-up.** Every exercise card shows a close-up of its body area (owner picked "option B: zoomed close-up", not a full-body thumbnail and not tap-to-open) with the primary `shape` lit in the brand teal and a label chip with the sub-region name (`MUSCLE_SHAPES[].label` / `labelAr`, e.g. "Upper chest", "Lats (width)"). If the exercise has `shape2`, that part is lit in a lighter teal and both names are on the chip ("Hamstrings · Lower back / traps"). *(Secondary-muscle treatment = main-session call, owner can override.)*
3. **Art style — realistic-leaning anatomy, our own art.** Owner chose route 1: original, hand-built SVG (no photos, no third-party art, no licence questions). A human body (head, outline, arms, legs) front and back, with per-muscle **volume shading** and **muscle-fibre lines running the real fibre direction** (fanned pecs, diagonal obliques/lats, vertical quads/hamstrings…). Smoother and more detailed than the brainstorm spike. Close-ups are crops (viewBox) of the same full front/back figures.
4. **Female figure for women's plans.** `activePlan === "female"` plans use a female body figure (same style, same 20 regions); men's plans use a male figure. The anonymous preview plan uses the male figure *(main-session call)*.
5. **All 20 regions** in `MUSCLE_SHAPES` (app.js ~L208) are drawable and highlightable on both figures, choosing front or back view automatically (e.g. lats, rear delt, triceps, glutes, hamstrings, lower back/traps, mid-back → back view; chest, front/side delt, biceps, abs, obliques, quads → front; calves → back).
6. **Works on every plan:** men's/women's × gym/in-house (cal), the anonymous preview, and AI-coach plans (below).
7. **AI-coach plans get pictures too.**
   - **gym-assistant (separate PR):** add an optional `shape` (and optional `shape2`) field to `WorkoutExercise` (types.go) and the JSON schema in prompt.go, constrained to an enum of the 20 shape ids; prompt asks the model to tag each exercise with its primary (and optional secondary) region. Must stay backward-compatible (old cached plans without the field remain valid; stub.go updated).
   - **gym-ui:** `mapWorkout()` in coach.js copies `shape`/`shape2` when present and valid; otherwise falls back to a name lookup against the built-in exercises (same idea as the existing `window.GymExerciseVideo(name)`), e.g. a `window.GymExerciseShape(name)`. Plans already saved in `gym_plans_custom` get the same fallback at render time. **If no shape is known, the card shows no picture and no chip** — never a wrong guess.
8. Works in **EN + AR (RTL)**, **dark + light** themes (and the women's palette), at **360px** width. Images are decorative-plus-labelled: the chip text carries the meaning; the SVG gets an accessible label (e.g. `role="img"` + `aria-label` with the muscle name) or is `aria-hidden` with the chip as the text.

## Non-goals

- No photos, no stock/licensed imagery, no AI-generated raster art.
- No extra taps/sheets/pop-ups to see the muscle (always visible).
- No change to workout content (exercises, sets, reps, ids, videos, weight logs).
- No renaming of day tabs.
- The custom workout builder (workout-builder.js) is not redesigned; it may reuse the new figure later (follow-up).

## Anti-goals (would be a failure even if it "works")

- A wrong muscle lit up (better nothing than wrong).
- Cards becoming noticeably taller/cluttered at 360px, or the set checkboxes / log inputs pushed off-screen.
- Art that looks like clip-art blobs, or that breaks in light theme / RTL.
- Any image asset copied from elsewhere.

## Constraints

- Vanilla JS PWA, no build step; follow existing patterns (`GymUI.esc`, `t()` i18n with `[en, ar]`, CSS tokens in styles.css such as `--primary`, `--primary-text`, `--surface-*`, `--line`). Colours via CSS variables so theme/persona switching works without re-rendering.
- Keep SVG weight reasonable (one shared figure definition per sex, drawn per card by cropping; no per-card network requests). Must not slow the Plan tab render noticeably; service worker caches any new file (bump cache version as the repo does).
- Exercise `id`s, `checks`, weight logs untouched.
- Existing Playwright suites must stay green (snapshot/text tests may need updating deliberately, not blindly).
- Asset provenance: all art original, made in this PR; record that in the PR description and in a short comment at the top of the figure file ("original artwork, Etqadem, 2026").

## Decided by the owner (2026-10-20)

- Purpose: show where the muscle is and which part the exercise trains.
- Exercise picture = zoomed close-up of the area (option B).
- Style = more human, realistic-leaning anatomy with shading + fibre lines; route 1 (our own drawn art).
- Day "categories" = a row of muscle tiles (name + picture) per day, day names kept.
- Women's plans show a female figure.
- AI-coach plans get pictures too, including the gym-assistant change.

## Main-session calls (owner can override)

- Secondary muscle (`shape2`) in lighter teal, both names on the chip.
- Preview plan uses the male figure.
- Unknown muscle → no picture, no chip.
- **Tag audit is in scope.** `shape`/`shape2` are display metadata, not workout content, so the builder audits every built-in exercise's tags and fixes coarse/wrong ones (e.g. the arms superset gets `biceps_*` + `triceps_*`; Burpees, Mountain Climbers, Squat Jumps, Bear Crawl, Flutter Kicks get the best primary + secondary). Every changed tag is listed in the PR description for review. Mirror changes into gym-be `internal/plans/plans.seed.json` only if that file carries shape tags (check; if it does, a gym-be PR follows). Exercise ids, names, sets, reps, videos stay untouched. The custom builder reads the same tags; its tests must stay green.
- **Day tiles:** sit under the day title line (the `#dayMuscles` text line stays); groups in `MUSCLE_SHAPES` catalog order, de-duplicated; the row wraps (no horizontal scroll) at 360px; a day with no known shapes shows no tile row; the rest-day view is unchanged.
- **Figure sex for AI-coach plans** follows the same `activePlan` toggle as the built-in plans.
- **Primary and secondary on different views** (front vs back): the close-up shows the primary's view only; the chip still names both parts.
- **Biceps/triceps heads:** drawn as distinct inner/outer sub-areas of the muscle; the chip carries the head name.
- **Name fallback** for AI plans is exact or alias match only (case/space-insensitive), never a fuzzy contains-match. gym-assistant drops an unknown/invalid `shape` value (keeps the exercise and plan), never rejects the plan.
- **Tests:** the builder may update existing Playwright text/snapshot assertions that this feature legitimately changes, and must say which ones and why in the PR.

## Left to the builder

- Exact figure geometry/detail, crop boxes per region, tile and close-up sizes (suggested ~64–72px close-up on the card's start side; mirrored correctly in RTL), animation (respect `prefers-reduced-motion`).
- File layout (e.g. a new `muscle-art.js` exposing `window.GymMuscleArt.closeup(shapeId, {sex, secondary})` and `.group(groupName, {sex})`).
- Name-lookup fallback details.

## Verification

- Playwright: every built-in exercise renders a close-up with exactly its `shape` (and `shape2`) highlighted; day tiles list the right groups for each built-in day; women's plan uses the female figure; AI plan with `shape` renders it; AI plan without `shape` but a known name falls back; unknown name renders no picture/chip; AR labels present.
- Screenshots: EN + AR, dark + light, men + women, 360px and desktop, attached to the PR.
- gym-assistant: unit test that schema/enum accepts valid ids, rejects/ignores unknown ids, and old plans without `shape` still decode.
