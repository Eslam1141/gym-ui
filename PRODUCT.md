# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Installable PWA (vanilla JS, no framework), served at https://etqadem.cloider.app (the host comes from config.js / Helm `global.host`, never hardcoded). A Trusted Web Activity (TWA) APK wrapper for Google Play is planned; it wraps this same web app and does not make the design language native Android.

## Users

Beginner-to-intermediate gym-goers in Egypt and the Gulf, Arabic- or English-speaking. They train in a gym and use the app on their phone, often mid-workout between sets: following a plan, logging weights, running the rest timer, checking an exercise's form video. Outside the gym they plan their week, log food, and ask the AI coach questions.

Secondary audience (confirmed, admin only): the operator, who manages users from the admin dashboard (`admin.html`). A gym (B2B) channel is on the roadmap but not built.

## Product Purpose

Etqadem is a free, all-in-one gym tracker: one app for the plan, the logging, the timer, form guidance, food and an AI coach, so a gym-goer doesn't juggle several apps. Success means users open it every training day, finish their sessions with it, and build a streak.

## Positioning

A free all-in-one gym tracker for Arabic- and English-speaking lifters, built around local habits: local foods in food logging and a Ramadan mode for training and eating while fasting. Its competitors are regional coaching apps such as ElCoach.

Open decision: the roadmap also plans a paid Premium tier (Paymob payments, higher AI-coach quotas) and an "AI coach that reads your InBody" angle. How Premium fits with "free all-in-one" hasn't been decided. Future work must not present Etqadem as paid-only, or put InBody at the center, until that's settled.

## Operating Context

- Used one-handed on a phone in a gym: glanceable, big tap targets, quick logging between sets, works on a weak connection (service worker, offline-capable, data sync when back online).
- A planning session at home on the same phone: workout builder, calendar, check-ins, food log, AI coach chat.
- Sign-in with Google or email + password + one-time code (OTP); data syncs to the backend (`gym-be`). The AI coach (`gym-assistant`) runs on Claude.
- Ramadan (around 8 Feb 2027) is a hard yearly moment: Ramadan mode must be live by late January 2027.

## Capabilities and Constraints

- Built: workout plans (male/female day templates), workout builder, weight tracking, rest timer, exercise form videos, calendar, AI coach chat + body assessment, local food logging, weekly check-ins, Ramadan mode toggle, profile with photo and streak, in-app notifications, Google and email/OTP sign-in, admin dashboard, light and dark themes.
- Limits: AI assessments are capped at 5 a day and coach chat at 10 messages a day (`gym-assistant` config).
- Technical: plain HTML/CSS/JS, no build step or framework; deployed as an nginx container via Helm. `/icons/` is served with a one-year immutable cache, so changed icons need new filenames. No automated UI tests; checks are manual or screenshot-based.
- Planned, not built: Premium tier + Paymob, weekly adaptive plans, APK/Play release, gym (B2B) pilot.

## Brand Commitments

- Name: **Etqadem** (Latin) / **اتقدم** (Arabic), renamed 2026-10-01 from RepVane (earlier Athlex). No "RepVane" or "Athlex" in user-visible copy; the repvane.cloider.app domain and repvane.gym mailbox stay until a new domain is bought.
- Logo: the Etqadem stair-climber mark (`icons/logo-etq.svg`, cream tile, ink figure, teal head). Old Dial Vane files (`*-dv`) are kept for cache safety but unreferenced. Generators: `tools/icons/gen-etq-svgs.py` + `render-pngs-etq.mjs`. The accent is teal, picked partly because ElCoach uses orange; do not drift back to orange.

## Evidence on Hand

- Real app screenshots in `../screenshots/` and the PNGs in the parent folder; brand previews in `docs/brand/previews/`. A full-app UX audit was done on 2026-09-28, but the file isn't in this checkout.
- No testimonials, user counts, ratings, press or gym partners exist yet. Don't invent any.

## Product Principles

1. **Gym-floor first.** Every training-flow screen must work one-handed, fast, mid-set, on a phone.
2. **Two languages, both first-class.** Arabic right-to-left and English are equals; nothing ships working in only one.
3. **All-in-one, not all-at-once.** Many features, but each screen does one job; don't make the gym-goer wade through features they aren't using.
4. **Local by default.** Local foods, Ramadan and the region's habits are core, not add-ons.
5. **Honest coaching.** The AI coach gives guidance within stated limits and doesn't overclaim medical or body-composition authority.

## Accessibility & Inclusion

- Full RTL support for Arabic: layout mirroring, Arabic typography, mixed-direction numbers and units.
- Readable in bright gyms and at night (light and dark themes); large touch targets for sweaty, moving hands.
- Gendered day templates (male/female) exist; keep wording respectful and don't assume gender beyond what the user picked.
