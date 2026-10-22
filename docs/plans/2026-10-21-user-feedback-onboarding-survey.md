# Plan — user feedback: header overlap, onboarding survey, screen tours, copy cleanup

Date: 2026-10-21 · Repos: gym-ui, gym-be, gym-assistant (gym-shared: no changes)

Sources read: every `.superpowers/sdd/*/progress.md` in gym-ui, gym-be and gym-assistant,
`gym-ui/PRODUCT.md`, and the code below. `graphify-out/` is gitignored, so the graph itself
was not available in the checkout.

## Feedback → work items

| # | Feedback | Work item | Size |
|---|---|---|---|
| 1 | Workout timer pill and bell/avatar bar overlap | Fix layout of `#miniTimer` vs `#topBar` | S |
| 2 | Survey to fill the profile and build the first plan | Onboarding survey (UI + BE + assistant) | L |
| 3 | Animated onboarding that shows each screen's features | First-visit screen tours | M |
| 4 | Long notes everywhere, site feels "vibe coded" | Copy audit + note pattern | M |

Order: 1 → 4 → 2 → 3. (1 is a quick bug. 4 sets the short-copy rules that 2 and 3 must follow.)

---

## 1. Timer / header overlap (gym-ui only)

Cause: `#miniTimer` is `position:fixed; top:10px; left:50%` centered (styles.css ~603, z-index 70).
`#topBar` is `position:fixed; top:10px; right:12px` (styles.css ~2128, z-index 110). On phones
under ~420px wide the centered pill (dot + label + `00:00:06` + play button) reaches into
the right-hand bar. RTL mirrors it to the left edge, same problem.

Fix:
- Below 900px, move the pill under the header row: `top: calc(env(safe-area-inset-top) + 62px)`.
  Alternative: dock it inside `#topBar` on the inline-start side while a session runs.
  Recommended: below the bar, because it keeps both tap targets at full size.
- Shorten it on narrow screens: hide `.mini-label` ("Upper") below 380px and keep dot + time + button.
- `header.hero` already has `padding-top:72px` on phones; check the pill doesn't cover the hero
  title. Add `body:has(#miniTimer.show) header.hero{ padding-top:112px }` if it does.
- Check: 320 / 360 / 390 / 414px, EN + AR, light + dark, signed-in + anonymous (anonymous shows
  `#topPrefs` on the opposite edge instead).

## 2. Onboarding survey → profile + first plan

### What we already have
- gym-be `store.Profile`: `displayName, weightKg, heightCm` only (`internal/store/users.go:485`, PUT `/me/profile`).
- gym-assistant `assistant.Profile` (the AI coach form) already holds everything a plan needs:
  `age, sex, heightCm, weightKg, goal, activityLevel, trainingDaysPerWeek, equipment,
  dietPreference, allergies, dislikes, notes, inbody`. POST `/api/v1/assistant/assessment` returns the diet + workout plan.
- gym-ui picks a plan from `gym_plan` (male/female) + style (gym / in-house "cal") in localStorage.
- The user currently types the same data again into the coach form (coach.js fieldsets).

### Survey (one question per screen, progress bar, Back, saved after every answer)
1. Goal — lose fat / build muscle / recomp / stay fit (cards with icons)
2. Sex — male / female (sets `gym_plan` and the figure)
3. Age
4. Height + weight (metric, number steppers)
5. Experience — new / under 1 year / 1–3 years / 3+ years
6. Days per week — 2–6
7. Where you train — full gym / home with some equipment / bodyweight only (sets gym vs "cal" style)
8. Activity outside the gym — sedentary → athlete
9. Diet preference + allergies (chips, optional)
10. Ramadan mode — only shown when the Hijri date is near Ramadan (reuse `isHijriRamadan()` from coach.js)
11. Optional: upload InBody (reuses `/inbody/extract`) — skippable
12. Result: "Building your plan" animation, then a summary card: plan name, days, calories, first workout → "Start"

Each question shows one short line on why it is asked (≤ 60 characters, see item 4).

Placement: signed-in users only — shown right after sign-in, before the first `navigate("plan")`,
until `onboardingCompleted` is true.

Guests (anonymous mode) never see the survey or the screen tours. Instead they get a small,
dismissible sign-in hint: "Sign in to get a plan built for you and a quick tour of each screen".
It appears on the Plan screen and on the first visit to each screen, and once dismissed it stays
hidden for that session. Tapping it opens the sign-in screen; after sign-in the survey starts.

### Backend changes
- **gym-be**
  - Extend `store.Profile` with an `Onboarding` sub-document: `goal, sex, age, experience,
    daysPerWeek, equipment, activityLevel, dietPreference, allergies[], ramadan, completedAt, version`.
  - Extend `validateProfile` bounds (age 13–90, days 2–6, enums), and GET/PUT `/me/profile`.
  - New `onboardingCompleted` flag on GET `/me`, so the UI knows whether to show the survey on any device.
  - Admin dashboard: count of completed surveys and drop-off by step (later; needs a step event).
- **gym-assistant**
  - The onboarding plan uses the normal POST `/assessment` and **counts as one of the 5 daily
    assessments**, so no cap change. If the user has already hit the cap (e.g. a re-run on the
    same day), keep the template plan and show "Your personalised plan will be ready tomorrow".
  - Add `experience` to `Profile` as its own field (`new|under_1y|1_3y|3y_plus`), validate it, and use
    it in the prompt (it changes volume and exercise choice). It's part of the request hash, so
    cache keys for new requests change; old cached results stay valid.
  - The coach form (coach.js) pre-fills from the saved survey profile instead of asking again.
- **gym-shared**: no change.

### First plan
- Day 1 is instant: pick the closest template from `gym-be/internal/plans` (sex × style × days) so
  the user lands on a real plan straight away.
- In the background, the onboarding assessment builds the personalised plan; when it returns,
  show a notification "Your personalised plan is ready" and offer to switch.
  (Reason: Claude calls can take several seconds or fail; the user shouldn't wait on it.)

## 3. Screen tours ("what's on this screen")

On the first visit to Plan, Coach, Food, More and Profile, show 2–3 spotlight steps that point
at the real controls (e.g. Plan: day switcher → log a set → rest timer). Rules:
- Max 3 steps per screen, one sentence each, always a visible "Skip".
- Signed-in users only (guests get the sign-in hint from item 2 instead).
- Shown once per screen, after the survey is done; stored as `gym_tour_<screen>` and synced so it doesn't repeat on a new device.
- "Replay tips" entry in the More / avatar menu.
- Motion: reuse `motion.css` tokens (`--dur-*`, `--ease-*`), transform/opacity only, respect
  `prefers-reduced-motion` (no animation, just the card).
- RTL: the spotlight and arrow mirror; test in AR.
- Never during a running workout (`#miniTimer.show` or `#timerBar.show`): gym-floor first.

New file `tour.js` + `tour.css`; add both to the Dockerfile COPY/hash list and `service-worker.js` ASSETS
(same as every earlier stream).

## 4. Copy cleanup ("long notes", "vibe coded")

Found: long explanatory strings in the T dictionary in app.js (e.g. `obSub` ~170 characters), the warm-up
note in index.html (~300 characters), coach.js hints, admin.js confirmations.

- Rules: titles ≤ 4 words, helper text ≤ 1 line (~60 characters), no paragraph on a main screen.
  Long explanations move behind an ⓘ "More info" sheet or into the tour.
- Pass over every EN + AR string in app.js, coach.js, food.js, checkin.js, profile.js, header.js
  and index.html; cut or move each one that breaks the rules. Arabic gets its own edit, not a translation of the cut English.
- Remove implementation-flavoured wording in the UI (e.g. mentions of InBody on the welcome
  screen — PRODUCT.md also says not to center InBody yet).
- Visual consistency pass: one card style, one button hierarchy, consistent spacing tokens
  (DESIGN.md). This is what makes the "vibe coded" feeling go away, more than the text alone.

## About "long onboarding works best for specialized content"

Partly true. Long **question** onboarding converts well when every answer visibly shapes the result
(Noom, Fitbod and similar fitness apps), so the 10–12 question survey is the right call. Long **feature
tours** get skipped, so keep those short and contextual (item 3). Measure it: log the survey step
reached and whether the user finished day 1, and compare against users who skip.

## Decisions (2026-10-21)
1. Survey and tours are for signed-in users only; guests get a sign-in hint instead.
2. The first AI plan counts as one of the 5 daily assessments (no cap exemption).
3. Experience level is its own survey question and its own field in gym-be and gym-assistant.
4. Unfinished admin-dashboard items are out of scope; the same agent resumes them later.
