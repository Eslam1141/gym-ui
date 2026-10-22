# Training splits by days per week, home tool picker, and weekly muscle map: design

Date: 2026-10-21. Owner request: "what is the best training schedule to follow to make the user feel he has trained every muscle twice and targets all aspects of the muscle from the professional trainers POV", followed by "you can make all the split you shared".

## Intent

Users should feel, and see, that every muscle was trained **twice a week**, with **every part of the muscle** covered: upper, mid and lower chest; back width and thickness; all three delt heads; both biceps heads plus the brachialis; both triceps heads; the quads, including the rectus femoris; the hamstrings, through both a hip hinge and a knee bend; the glute max and medius; the gastrocnemius and soleus; and core flexion, anti-extension and anti-rotation. The plans must follow professional coaching practice:
- each muscle trained twice a week;
- about 10–20 hard sets per muscle per week, starting near 10 for beginners;
- no more than about 8–10 sets for one muscle in a single session;
- 1–3 reps in reserve;
- 5–8 reps on compound lifts, 8–12 on secondary moves, 12–20 on isolation work;
- the A and B versions of a day use different angles, so the two sessions together cover every part.

## Decided by the owner

1. **Pick by days per week.** The user says how many days a week they can train (3, 4, 5 or 6) and where (gym or home). The app gives the matching split:
   - **3 days:** full body three times (A/B/C, Mon/Wed/Fri).
   - **4 days:** Upper/Lower, A and B versions.
   - **5 days:** Upper / Lower / Push / Pull / Legs.
   - **6 days:** Push/Pull/Legs twice, A and B versions.
2. **There are men's and women's versions** of every split. Women's versions weight glutes and legs more, in line with the current women's plans.
3. **Existing plans stay** as an extra choice ("Classic"), so current users keep their plan, their exercise ids and their weight logs. Nobody is moved automatically.
4. **Home: the user ticks the tools they have.** The tools are none (bodyweight), dumbbells, resistance bands, a bench or sturdy chair, a table (for inverted rows), a pull-up bar, a kettlebell and a jump rope. The app recommends the best version of the split using only moves those tools allow, and shows which tools each move needs.
5. **Missing moves come back to the owner.** When covering a muscle part with a given toolset needs a move the library doesn't have, the builder lists it, and the owner supplies the demo video. Until a video exists, the card uses "Video coming soon" (gym-ui#144). Don't invent videos, and don't use clips the owner hasn't supplied.
6. **A weekly body map.** It shows each muscle region filling in after its first session of the week, and fills fully after the second, using the 20 muscle tags and the existing muscle-art.js figure (male/female). It's built from logged or ticked sessions this week (local week, as in GymDate).

## Main-session calls (owner can override)

- **Where the choice lives:** onboarding and the Plan settings get "Days per week" (3/4/5/6) and "Where" (Gym/Home). Home also gets the tool checklist. The existing Program toggle (Gym / In-house / Coach) keeps working; "Classic" is the current plans.
- **Weekday layout per split:**
  - 3 days: Mon/Wed/Fri.
  - 4 days: Mon/Tue/Thu/Fri.
  - 5 days: Mon/Tue/Wed/Fri/Sat.
  - 6 days: Mon–Sat.
  - The existing rest-day logic (rest-days.js) still applies.
- **Volume:** each built-in split starts at the beginner end (about 10 sets per muscle per week). No automatic progression in this version.
- **Picking moves for a toolset:**
  - Each day has slots, and each slot is defined by its target muscle part and movement pattern.
  - A slot is filled with the best library move whose tool needs are a subset of the user's tools.
  - The ranking is fixed per slot (for example, chest upper: incline DB press → feet-elevated push-up → …).
  - If a slot can't be filled, the next-best part of the same muscle covers it and the gap is recorded. No empty slot is shown.
- **Body map scope:** counts any exercise on the plan the user ticked done this week, across built-in, Classic and AI-coach plans, using each exercise's shape and shape2. A muscle region needs a done exercise in two different sessions (days) to count as fully trained.
- **AI coach:** out of scope for this version. A follow-up can make gym-assistant's split block use the same templates.

## Non-goals

- No change to Classic plans' exercises or ids.
- No automatic weekly progression or deloads.
- No new AI behaviour.
- No new native code; it's all web, so APK v1.0.8 gets it after deploy.

## Anti-goals

- A split that trains any muscle once a week, or skips a part of a muscle the toolset could cover.
- A home plan recommending a move that needs a tool the user didn't tick.
- Changing a current user's plan without their action.
- Exercise ids reused for different moves, which would corrupt weight logs.

## Data

- **Each library exercise gains `tools`:** an array drawn from `none, dumbbell, band, bench, table, pullup_bar, kettlebell, jump_rope, barbell, cable, machine`. Gym-only gear is barbell, cable and machine.
- **New split templates** are data: days → slots `{part, pattern, sets, reps, rest, ranked: [exerciseIds…]}`.
- **Per-user settings** in localStorage, synced like other prefs:
  - `gym_split_days` (3–6)
  - `gym_split_where` (gym|home)
  - `gym_home_tools` (array)
- **New exercise ids:** each new library move gets a fresh, stable id. A generated day reuses an exercise's existing id, so "last time" weights carry over between splits for the same move.

## Missing moves (preliminary; the builder's Task 1 produces the final list for the owner)

- **Pull-up bar:** Pull-ups, Chin-ups, Hanging Knee Raise.
- **Kettlebell:** Kettlebell Swing, Kettlebell Goblet Squat (or reuse Goblet Squat), Kettlebell Romanian Deadlift, Kettlebell Overhead Press.
- **Jump rope:** Jump Rope (calves/conditioning).
- **Bands:** Band Row, Band Lat Pulldown, Band Chest Press, Band Lateral Raise, Band Curl, Band Triceps Pushdown, Band Hip Abduction.
- **Dumbbells:** Dumbbell Fly, Dumbbell Overhead Triceps Extension, Dumbbell Shrug, Dumbbell Rear Delt Fly, Dumbbell Pullover.
- **Bodyweight:** Decline (feet-elevated) Push-ups, Diamond Push-ups, Single-Leg Calf Raise, Side Plank, Sliding/Nordic Leg Curl.
- **Gym gaps for full coverage:** Dips (chest/lower), Barbell or Dumbbell Shrug, Hip Abduction Machine, Preacher Curl, Reverse Pec Deck, Cable Lateral Raise, Weighted Cable Crunch. Some of these already have Arabic names in AR_EX but no exercise or video.

## Verification

- **Per split:** every muscle region is hit in at least two different sessions per week. Weekly sets per muscle are between 8 and 20, and no session exceeds about 10 sets for one muscle.
- **Per toolset:** no move needs an unticked tool. The coverage report lists the gaps.
- Classic plans are unchanged, with byte-identical exercise data.
- The body map fills after ticked sessions; two sessions mean full.
- EN/AR, dark/light, men/women, 360px.
