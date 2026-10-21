# Training splits + home tools + weekly muscle map: implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. UI tasks invoke `frontend-design` first. Steps use `- [ ]`.

**Goal:** The user picks 3–6 days a week and gym or home (with a home tool checklist), and gets a professional twice-a-week split covering every part of every muscle. Current plans stay as "Classic", and a weekly body map shows each muscle trained once, then twice.

**Architecture:** The library exercises gain `tools`. A new `splits.js` holds data-only templates (days → slots ranked by exercise id) plus a pure `buildPlan({days, where, sex, tools})` that returns days in the same shape app.js already renders (`{id,label,muscles,exercises:[…]}`), together with a `gaps` list. app.js `pickDays()` uses it when the user has chosen a split. A new `muscle-map.js` computes weekly coverage from `gym_checks` and renders it with muscle-art.js.

**Spec:** `docs/superpowers/specs/2026-10-21-training-splits-design.md` (binding, including the "Main-session calls").

## Global constraints
- Classic plans (DAYS_MALE, DAYS_FEMALE, DAYS_MALE_CAL, DAYS_FEMALE_CAL, LEGACY_MALE_DAYS) and their exercise ids stay byte-identical.
- No invented videos. New moves get `vid` only from the owner. Until then the card shows "Video coming soon".
- Use the motion system and tokens only. EN + AR (RTL), dark/light, men/women, 360px. No native changes.
- Draft PRs only. Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Review focus
1. A user on a Classic plan sees no change until they choose a split (test `classic untouched`).
2. A home user with only "none" ticked gets a full split with no tool violations, and the gaps are listed (test `bodyweight only`).
3. The same move in two splits keeps one id, so weight history carries over (test `id reuse`).
4. Body map week boundaries follow the local week (GymDate) across midnight and Sunday/Monday (test `week boundary`).
5. Switching days or tools mid-week doesn't lose that week's checks (test `switch keeps checks`).

---

### Task 1: Tools tags and the gap report (output goes to the owner)
**Files:** modify `app.js` (add `tools:[…]` to every library exercise; no other field changes), create `tools/split-gaps.mjs`, test `tests/split-tools.spec.js`.
- [ ] Tests: every exercise has non-empty `tools` from the allowed set. Barbell, cable and machine moves never appear in a home pool.
- [ ] Tag all 57 moves.
- [ ] `tools/split-gaps.mjs` prints, per split × sex × toolset (bodyweight; dumbbell; band; dumbbell+band+bench; all home tools; gym), any slot that can't be filled from the library, with the missing move named. Commit its output as `docs/split-gaps-2026-10-21.md`.
- [ ] Commit. **Send the gap list to the owner** (main session + Telegram), as the list of videos needed.

### Task 2: `splits.js` templates and buildPlan
**Files:** create `splits.js` (before app.js in index.html, plus service-worker ASSETS and the Dockerfile COPY and hash lists), test `tests/splits.spec.js`.
**Produces:** `window.GymSplits = { DAYS:[3,4,5,6], templates, buildPlan({days, where, sex, tools}) -> {days:[…], gaps:[…]} }`. Day ids look like `sp{days}{where[0]}{sex[0]}_{dayKey}`, for example `sp4gm_upperA`.
- [ ] Tests, for every (days, where, sex, toolset):
  - each of the 20 regions is hit in ≥2 different days;
  - weekly sets per group are within 8–20;
  - no group exceeds 10 sets in one day;
  - no exercise needs an unticked tool;
  - reps follow pattern rules (compound 5–8 or 6–10, isolation 12–20);
  - the same exercise id is used across splits.
- [ ] Write the templates from the spec's sample week (4-day) and design the 3-, 5- and 6-day ones to the same rules. Women's versions weight glutes and legs more.
- [ ] Fill slots by ranked fallback. Record gaps, and never leave a slot empty.
- [ ] Commit.

### Task 3: Choosing a split (UI)
**Files:** `app.js` (`pickDays()`, settings), `ui.js`/onboarding (choice step), `styles.css`, i18n `T`, test `tests/split-choice.spec.js`.
- [ ] Tests:
  - a choice of days/where/tools changes the plan to the generated one;
  - Classic stays selectable and is unchanged;
  - an existing user isn't moved;
  - the tool checklist shows each tool's icon and name in EN and AR;
  - a recommendation hint appears if more tools would close gaps;
  - the choice syncs like other prefs (sync.js key allowlist).
- [ ] Build it: "Days per week" chips, Gym/Home, the home tools checklist (8 tools), and a short "What this split trains" summary. Each exercise card shows a small tools line.
- [ ] Screenshots (EN/AR, dark/light, 360px) go to the side-session notes folder, `splits-screens/`.
- [ ] Commit.

### Task 4: Weekly body map
**Files:** create `muscle-map.js`; modify `app.js` (render on Plan, above the day tiles or in a collapsible card) and `styles.css`; test `tests/muscle-map.spec.js`.
**Produces:** `GymMuscleMap.coverage(weekKey) -> {regionId: 0|1|2}` and `GymMuscleMap.render(el, {sex})`.
- [ ] Tests:
  - a region with no done session is 0;
  - one day with a ticked exercise hitting it is 1;
  - two different days is 2;
  - the same day twice is still 1;
  - shape2 counts;
  - the week boundary follows GymDate;
  - it works for Classic, split and AI plans;
  - nothing animates under reduced motion.
- [ ] Render the front and back figures: 0 = base, 1 = half tint, 2 = full lit, with a legend ("trained once" / "trained twice") in EN/AR. A tap on a region names it.
- [ ] Commit.

### Task 5: PR
- [ ] Full Playwright suite; report changed specs. Open a DRAFT PR with the coverage table per split and the gap list. Report to the main session, which sends the Telegram line and asks the owner for the merge OK. ci-fixer merges.

### Follow-ups (separate)
- Owner-supplied videos for gap moves: add them as library exercises (new ids), re-run split-gaps, and remove the gaps.
- gym-assistant: use the same templates in `workoutSplitBlock`.
