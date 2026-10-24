# Etqadem / اتقدم: pre-launch checklist audit (2026-10-24)

**Disclaimer.** An AI reviewer wrote this. It is not legal advice, and I am not your lawyer. Items marked ⚖️ need a licensed lawyer: US (contract, FTC, state law) and Egypt/KSA/UAE (data protection, consumer law).

Scope: gym-ui `origin/main` @9ebbf16 and gym-be `origin/main` @5207c72. I only read code; nothing was changed. "Fact" means I saw it in code or on a live DNS lookup. "Assumption" and "Unknown" are labelled where they apply.

---

## 0. Fix list, in priority order

### Must fix before the Play launch

| # | Fix | Why | Where |
|---|---|---|---|
| M1 | **Register a domain you control for the contact and privacy email, or switch the address to one that works.** `privacy@etqadem.app` does not exist: `etqadem.app` returns NXDOMAIN (checked through Google DNS today). Users who can't sign in have no way to ask for deletion, and anyone could register the domain and receive those emails. | Play's account-deletion rule requires a working web path ("functional"). Privacy rights requests would be lost. | `landing/delete-account.html:64,104` |
| M2 | **Fill in `PRIVACY_FACTS`** (legal entity, state, address, privacy and contact email, hosting country, log and backup days, effective date, venue, liability cap, notice days, prevailing language). Until you do, `/privacy` and `/terms` show "Draft — not yet in effect", but sign-up already says the user agrees to them. | You can't take the Terms to court, and Play reviewers see a draft policy. | `landing/privacy-facts.js:21-37`, `landing/privacy-page.js:52-53` |
| M3 | **Put business details on the public site**: legal name, registered address and contact email in the landing footer and on `/terms#contact`. Today the footer says only "© 2026 Etqadem". | FTC §5 transparency; the Egypt consumer law requires supplier identity on consumer documents ⚖️; the Play developer profile must match. | `landing/index.html:252` |
| M4 | **Make the Facebook SDK question go away.** `@capgo/capacitor-social-login` adds `com.facebook.android:facebook-login` unless `socialLogin.facebook.include=false` is set in gradle.properties, and it isn't set. Check the release APK (`./gradlew :app:dependencies`), then exclude it. | If it ships, the Data safety form and the privacy policy must disclose it, and privacy scanners will flag it. | `native/node_modules/@capgo/capacitor-social-login/android/build.gradle:9,110-111`; `native/android/gradle.properties` |
| M5 | **Record Terms acceptance on the server and add re-acceptance.** Today `gym_terms_ok` is only written to localStorage. It is never read and never sent to the server, so there's no proof of acceptance and no way to bring users onto a new version. Also needed for the AI-coach change in §11. | Contract formation evidence; the change process in Terms §15. | `ui.js:26-27`, `sync.js:239` |
| M6 | **Fix the landing claims that the code doesn't support.** (a) "a video for every exercise": not true for AI-coach plans. (b) The ful medames example: the app gives different numbers. (c) "earn Premium" headline: the reward isn't built. | FTC §5 deceptive advertising; Egypt consumer law on misleading ads ⚖️. | §5 below |
| M7 | **Complete the Play forms**: Data safety, Health apps declaration (Health Connect), and the account-deletion URL. Their answers must match §4 of this report. | Play policy. | Play Console (owner) |

### Should fix soon after

- S1. Stop auto-ticking Ramadan mode during the Hijri month. Ask instead (`coach.js:486,545-549`). See §2.
- S2. Make the phone number optional, or drop it, for email sign-up (`auth-email.js:261,384`). See §3.
- S3. Self-host html2canvas instead of loading it from cdnjs on every app open (`index.html:528`). See §4.
- S4. Delete-account page: say clearly that it works in a browser with no app install, and fix the Arabic brand spelling (إتقدم → اتقدم). See §10.
- S5. Arabic Terms §4 is missing the watch/Health Connect paragraph that the English has (`landing/terms.html:48` vs `:121`).
- S6. Put the word "AI" in the chat header once the footnote is removed (EU AI Act Art. 50(1)). See §11.

### Nice to have (owner wants the site to be 100% ours)

- N1. Replace the hero photo, the animated emoji, the Material-style nav icons and the YouTube clips with your own (§9).
- N2. Add an "Open-source licences & credits" screen in the app (More → About) for anything third-party that remains.
- N3. Load Google Sign-In only when needed (on the sign-in screen and for returning signed-in users), not for every guest.

---

## 1. Privacy policy, Terms, refund policy, cookie policy, cookie banner

| Item | Status | Evidence | What to change |
|---|---|---|---|
| Privacy policy | **Exists, detailed, still a draft** | `landing/privacy.html` (18 sections, EN+AR). Placeholders are unfilled: `privacy-facts.js:21-37` | M2. Also add Resend only if you ever switch email provider (prod uses Gmail SMTP: `.deploy-values/gym-dryrun.yaml:554`). Add the Google sign-in `g_state` cookie line (below). |
| Terms of Use | **Exists, still a draft** | `landing/terms.html` (18 sections). AI coach §5 at `:52-55` | M2, M5, and the new §5 text in §11. |
| Refund policy | **Not needed today** | Nothing is sold. Premium is a disabled "Coming soon" card (`index.html:343-356`). The privacy policy says "Etqadem doesn't take payments today" (`landing/privacy.html:124`). Terms §8 promises the price, renewal, cancellation and refund terms before purchase (`terms.html:65`). | Publish a refund & cancellation policy **before** any Stripe or Play product goes live. It must cover: Play purchases follow Google Play's refund rules; web (Stripe) refunds; cancelling auto-renewal online in the same medium as sign-up (California ARL); the annual reminder; the 14-day withdrawal right for EU/UK if you market there ⚖️; and Egypt consumer-law return rights for services ⚖️. Free streak-reward weeks have no cash value (already in Terms §8). |
| Cookie policy | **No separate policy needed.** The privacy policy §9 covers it. | §9 "Storage on your device…" (`privacy.html:113-118`) lists localStorage/sessionStorage, the service-worker cache, Google Sign-In, cdnjs and YouTube-nocookie. | Add one line on Google's sign-in cookie (below). Don't create a separate cookie page. |
| Cookie consent banner | **Not needed (my view; ⚖️ EU only)** | Fact: no first-party cookies or analytics. `document.cookie` appears nowhere, and gym-be sets no cookies. Storage is localStorage, IndexedDB cleanup only (`privacy.js:269`), and the SW cache (`service-worker.js:78`). Third parties: Google Identity Services with One Tap/auto-select (`sync.js:1164,1171-1172`), which can set a `g_state` cookie for sign-in cooldown; YouTube-nocookie loads only after the user taps play (`app.js:1263`). | Everything stored is either strictly necessary for a service the user asked for (sign-in, their plan, their settings) or loads only on the user's tap. The EU ePrivacy Art. 5(3) exemption covers storage "strictly necessary" for a service "explicitly requested by the subscriber or user", so no banner is needed. Egypt, KSA, UAE and US law have no general cookie-banner rule (unverified for KSA/UAE secondary rules ⚖️). **A banner becomes mandatory the day you add analytics, ads, pixels or Firebase.** |

Line to add to privacy §9, under "Google Sign-In":

- EN: "Google may also set a small cookie on our site (for example `g_state`) that remembers whether you closed its sign-in prompt, so it doesn't show again too soon. We don't read or use it."
- AR: «وقد تضع Google أيضًا ملف تعريف ارتباط صغيرًا على موقعنا (مثل `g_state`) يتذكر إن كنت أغلقت نافذة تسجيل الدخول، حتى لا تظهر مجددًا بسرعة. نحن لا نقرؤه ولا نستخدمه.»

---

## 2. Form consent

| Form | Status | Evidence | Verdict / change |
|---|---|---|---|
| Sign-up line | One line, no checkbox; tapping a button accepts | `index.html:149`; `ui.js:352-361`; text `app.js:424` | Acceptable "sign-in-wrap" if it's clearly shown next to the buttons (it is). It bundles Terms, Privacy and 18+, which is fine because none of these is a data-processing consent. Keep it free of any health-data consent. New wording in §11. |
| First-run survey | Separate consent screen, "Agree and continue" or "Not now"; nothing pre-selected; recorded server-side with a text version | `survey.js:4-13,124-132,362-378` | Good. |
| AI coach consent | Native `<dialog>`, unticked checkbox, button disabled until ticked, reset on close, server record with version | `coach-consent.js:85-89,118,137`; text `:31-34` | Good. Minor point: "I'm 18 or older" is inside the health-data consent sentence. Fine, but you could move it out. |
| InBody photo consent | Separate unticked checkbox | `coach.js:943,988`; text `:88-91` | Good. Keep it separate. |
| Meal photo | One-time notice with OK (`photoAcked`), relying on the AI coach consent | `chat.js:77-79,933-941` | Good. Privacy §6 says meal photos are covered by the coach consent. |
| Watch / Health Connect | Prominent disclosure, then "Continue", then Android's per-type permission | `watch.js:90-103,578` | Good. Matches Play's prominent-disclosure pattern. |
| **Ramadan mode** | **Auto-ticked** during the Hijri month (`coach.js:545-549`) and then sent to Anthropic with plan requests (`coach.js:1118`) | — | **Change (S1).** It reveals religious practice, and fasting advice is a health risk for people who shouldn't fast. Replace the auto-tick with a one-tap question: EN "It's Ramadan. Are you fasting? We'll plan meals around suhoor and iftar." [Yes, I'm fasting] [No]. AR «حلّ شهر رمضان. هل أنت صائم؟ سنخطّط وجباتك حول السحور والإفطار.» [نعم، أنا صائم] [لا]. |

No pre-ticked consent boxes were found anywhere else.

---

## 3. Data minimisation

| Field | Needed? | Evidence | Change |
|---|---|---|---|
| **Phone number (email sign-up, mandatory)** | **No.** No SMS is sent; the policy says it's only "to identify your account" | `auth-email.js:261,380-388`; gym-be `internal/localauth/service.go`; privacy §3.1 | Make it optional or remove it before email sign-in goes live (it's paused: `index.html:129-131`). If it stays, explain why on the form. |
| Ramadan flag sent to the AI | Only if the user is actually fasting | `coach.js:1118` | S1. |
| Google profile picture URL, name | Fine (sign-in display) | privacy §3.1 | — |
| Age, sex, height, weight, InBody, allergies | Needed for calorie and BMR maths and safety | survey, coach form | — |
| Feedback user agent, screen | Fine and disclosed | privacy §8 | — |
| GIS script on every app open (Google sees the IP of guests too) | Not strictly needed for guests | `sync.js:1164` | N3. |

---

## 4. Third-party services, SDKs, CDNs and embeds

| Service | What it gets | Disclosed? | Evidence | Note / "make it ours" |
|---|---|---|---|---|
| Anthropic (Claude) | Coach profile, check-ins, chat, meal and InBody photos; no name, email or ID | Yes, §5-7, §10 | `coach-consent.js:31`, `chat.js:77`, `coach.js:88` | Keep. Needs a DPA in the LLC's name ⚖️. |
| Google Identity Services (web) | IP, browser, Google account on sign-in; possibly the `g_state` cookie | Yes, §9-10 (add the cookie line) | `sync.js:1164,1171` | Keep. Consider lazy-loading (N3). |
| Google sign-in on Android (`@capgo/capacitor-social-login`, play-services-auth, credentials) | Google account | Yes | `native/package.json:21` | **Facebook SDK probably bundled (M4).** |
| Cloudflare cdnjs: html2canvas 1.4.1 (MIT) | IP, user agent on **every** app open | Yes, §9 | `index.html:528` | **Self-host it** with its MIT licence (S3). Then remove Cloudflare from §9-11. |
| YouTube-nocookie embeds | IP, browser; YouTube storage after the user taps play | Yes, §9 | `app.js:1263` | Third-party videos. See §9. |
| Google Play (distribution) | Play's own data | Yes, §10 | — | — |
| Health Connect (`@capgo/capacitor-health`) | Six read types, kept on the device | Yes, §3.12 | `AndroidManifest.xml` (write types removed) | Health apps declaration (M7). |
| Capacitor app / haptics / local-notifications / splash-screen | No network use | Not necessary | `native/package.json:15-20` | — |
| Gmail SMTP (OTP and password reset) | Email address, code | Yes, §10 | `.deploy-values/gym-dryrun.yaml:554`; gym-be `cmd/server/main.go:136-138` | ⚖️/owner: sending from a consumer Gmail account for a business. Move to the LLC's domain mail. |
| Cloider (hosting) | Everything stored | Yes, `[HOSTING_COUNTRY]` blank | `privacy.html:120` | Fill in the country (M2). |
| Android Auto Backup | Device data except the session vault | Not mentioned | `AndroidManifest.xml` `allowBackup=true`; `backup_rules.xml` | Low. Either exclude the watch cache from backup too, or add a sentence to §9. |

Fonts: Readex Pro is self-hosted (`styles.css:128`, `landing/landing.css:5-13`). No Google Fonts CDN. Landing page: no third-party requests found (`landing/index.html` loads only local assets).

---

## 5. Dark patterns, hidden fees, reviews, marketing claims

| Claim / item | Verdict | Evidence | Fix (EN / AR) |
|---|---|---|---|
| "Free", "Start free", "It's free", "Free with a Google account" | **True today.** No payments; coach free with daily limits | `landing.js:8-14,53,61`; Premium disabled `index.html:355` | Keep for now. When Premium launches, change "one free app" to "Free to use. Optional Premium extras." / «مجاني للاستخدام، مع مزايا Premium اختيارية.» and show the price before any paywall. |
| "a video for every exercise" / "Every exercise has a short video demo, up to 90 seconds" | **Partly unsupported.** All 141 + 73 built-in exercises have a `vid` (`app.js`, `splits.js:44-76`). AI-coach plans attach a clip only "when the move matches" (`coach.js:1625-1626`). I couldn't verify clip lengths offline (assumption: the owner's 90-second rule was applied). | `landing.js:9,14,24` (+AR `:68,73,83`), `landing/index.html:7,45` | "a video for every exercise in our plans" / «فيديو لكل تمرين في خططنا». f3_p: "Every exercise in our plans has a short video demo, up to 90 seconds, one tap away." / «لكل تمرين في خططنا فيديو توضيحي قصير، لحد 90 ثانية، بضغطة واحدة.» |
| Ful medames example: "250 g … 275 kcal, 19 g protein, 37 g carbs, 8 g fat" | **Wrong against our own database.** The seed has 101 kcal, 6 P, 15 C, 3 F per 100 g, which gives about 253 kcal, 15 g P, 38 g C, 8 g F for 250 g | gym-be `internal/food/foods.seed.json` (ful_medames); `landing.js:26,85`; `landing/index.html:123-128` | "Example: 250 g of ful medames is about 253 kcal, with 15 g protein, 38 g carbs and 8 g fat" / «مثال: 250 جرام فول مدمس فيها حوالي 253 سعرة، و15 جرام بروتين و38 جرام كارب و8 جرام دهون». Update the visible numbers as well. |
| "Egyptian and Gulf foods" | Supported (kabsa, machboos, mandi… in the seed) | `foods.seed.json` (category `gulf_dish`) | — |
| "Keep the streak, earn Premium" + "Coming soon: every 4-week streak earns you a free week of Premium" | **Headline overstates.** The reward isn't built, and Premium doesn't exist | `landing.js:49-50,108-109` | Headline: "Keep your streak going" / «حافظ على استمرارك». Keep the "Coming soon" line. Before it ships, publish the reward rules (Terms §8 already reserves this). |
| Premium perk "Ramadan mode adjustments" | Ramadan mode is free today, so this suggests it might be paywalled later | `app.js:632` | Remove it, or say exactly what extra Premium adds. |
| Testimonials, ratings, user counts | **None found.** The chat sample is labelled "Example conversation" | `landing/index.html:197` | Keep it that way: only real, consented reviews (FTC 16 CFR 465). |
| Hidden fees / dark patterns | None. Consent dialogs have equal Cancel and Not now options | §2 | — |

---

## 6. Accessibility (legal angle: aim for WCAG 2.1 AA)

**Contrast (computed, WCAG formula):** every main pair passes AA (4.5:1 for text).

| Pair | Ratio |
|---|---|
| Landing text `#f3f0e8` on `#0d1117` | 16.6 |
| Landing muted `#a9b5ba` on `#0d1117` / panel `#171f2a` | 9.0 / 7.9 |
| Landing primary button white on `#0b7a75` / `#0b7a5a` (gradient) | 5.2 / 5.3 |
| Landing link `#3cc2b8` on `#0d1117` | 8.7 |
| App dark men: text on surface / muted on surface-3 / white on primary / primary-text on surface-2 | 16.6 / 6.8 / 5.2 / 7.0 |
| App dark women: text / muted on surface-2 / white on `#C2347A` / `#f38bba` on surface | 15.7 / 8.5 / 5.2 / 7.8 |
| App light men: text / muted `#545A64` on `#E8E4D8` / primary-text `#0A6B67` / warn `#8A5A00` | 15.9 / 5.5 / 5.6 / 5.2 |
| App light women: text / muted / white on primary / primary-text `#A8286A` | 16.1 / 5.7 / 5.2 / 5.9 |
| Non-text: dark `--line` `#3d4e63` on `#10171f` | **2.1 (below 3:1)** |

Fix: wherever `--line` is the **only** visible edge of an input or control, use `--line-strong` (4.95:1 dark, 3.2:1 light, 3.4:1 light women). Tokens are in `styles.css:34-124`. I didn't measure text over the hero photo.

**Alt text:** fine. Landing images use `data-i18n-alt` (`landing/index.html:55-58,70,77,215,219`). Decorative logos and emoji use `alt=""` (`celebrate.js:147`, `index.html` none missing).

**Keyboard and focus:** the landing has a skip link and a global `:focus-visible` ring (`landing.css:60,68`). The app has 35 `:focus-visible` rules. Most `outline:none` cases have a replacement (`styles.css:357-358,478-479,1018`). Dialogs use `aria-modal`/native `<dialog>`. I didn't run a full manual keyboard pass; do one on: draggable chat bubble (`chat.js`), workout builder drag, survey chips, video modal. No axe tests in `tests/`; add `@axe-core/playwright` to CI.

Law: no Egypt/KSA/UAE statute that requires WCAG for private apps was verified (unverified). EU EAA could apply to e-commerce if you sell to EU consumers and aren't a micro-enterprise ⚖️.

---

## 7. Business details

| Detail | Shown today | Where to show |
|---|---|---|
| Legal name, state, address | Placeholders only (`privacy-facts.js:22-24`) | Landing footer, `/terms#agreement`, `/terms#contact`, `/privacy#who-we-are`, Play listing |
| Contact / privacy email | Placeholder, or a dead domain (`delete-account.html:64`) | Same places, plus the in-app More screen |
| Footer | "© 2026 Etqadem" (`landing/index.html:252`) | Change to "© 2026 {Legal name}. {Address}. {email}" |

Draft footer: EN "© 2026 {{LEGAL_ENTITY_NAME}}, {{REGISTERED_ADDRESS}}. Contact: {{CONTACT_EMAIL}}". AR «© 2026 {{LEGAL_ENTITY_NAME}}، {{REGISTERED_ADDRESS}}. للتواصل: {{CONTACT_EMAIL}}».

---

## 8. Emails and unsubscribe

gym-be sends exactly two emails, both from `internal/localauth/service.go`:

1. Sign-up verification code (`sendOTP`, `:497-511`), **transactional**.
2. Password-reset link (`:815-834`), **transactional**.

There are no marketing or newsletter emails, and `marketing` consent is rejected by the API (`internal/api/consents_test.go:215`). **No unsubscribe link is needed.** The FTC CAN-SPAM guide says messages whose primary purpose is transactional are exempt from most provisions, but routing info must be accurate. Keep the content purely transactional: no promotions in these emails. If you ever send newsletters, tips or "come back" emails, they need opt-in consent (Egypt PDPL and GDPR ⚖️) plus an unsubscribe link and a postal address (CAN-SPAM). In-app notifications aren't emails and are out of scope.

---

## 9. Fonts, images, animation, audio: licences and "make it ours"

| Asset | Owner / licence | Where | Action |
|---|---|---|---|
| Landing hero photo | Nenad Stojkovic, Wikimedia, **CC BY 2.0**, credited | `landing/assets/hero-1600.webp`, `hero-900.webp`; credit `landing/index.html:244-247` | **Replace with our own.** Shoot a lifter in a gym you have permission to film in, with a signed model release. Or generate one (no real person) with the image-gen tool and keep the prompt as a record. Then remove the credit line. |
| Animated emoji (muscle, fire, sprout, rocket, trophy, medal, crown, battery) | Google Noto Emoji Animation, **CC BY 4.0** | `icons/emoji/*.webp`, `LICENSE.txt`; used in `celebrate.js:145-150`; credited only on the landing page (`index.html:248-251`) | **Replace with our own.** Draw 8 small Lottie/WebP animations in the Etqadem style (the Pacer steps and dot already exist in `mascot.js`). Until then, the **app** (Android especially) also needs the CC BY credit (N2). |
| Nav and close icons (dumbbell, restaurant, close, chevron) | Paths match Google Material Icons (Apache 2.0). **Assumption from path shape, unverified** | `index.html:155,163,435,467,479,498` | **Replace with our own.** Draw the icons on the same 24-pixel grid as the Pacer icon. Apache 2.0 allows use either way. |
| Exercise demo clips | Third-party YouTube channels; we embed and don't host | `app.js` / `splits.js` `vid` fields; `app.js:1263` | **Replace with our own.** Film the moves (about 214 entries, fewer unique moves), host them on our storage as short MP4/WebM, and drop YouTube from privacy §9-10. Until then, embedding through YouTube's player is allowed by YouTube's terms, and Terms §9 already says the videos belong to their owners. |
| Readex Pro font | Google Fonts, **SIL OFL 1.1** | `fonts/readex-pro-var.woff2` + `fonts/OFL-ReadexPro.txt`; `landing/assets/readex-pro-*.woff2` (no licence file next to them) | OFL allows commercial use and self-hosting. Copy the OFL text next to the landing subsets. To be fully ours you'd need a commissioned typeface. Not necessary, as OFL is permanent and free. |
| html2canvas | MIT, loaded from cdnjs | `index.html:528` | Self-host it and keep the MIT notice in the credits screen. |
| Capacitor and plugins | MIT | `native/package.json` | Credits screen (N2). |
| Logo, Pacer mascot, coach.svg, avatar, muscle-map art | **Ours** (headers say "Original artwork, Etqadem, 2026") | `muscle-art.js:1-2`, `mascot.js:1`, `icons/logo-etq*.svg` | Keep. Remove leftover `*-dv*` RepVane icons from `icons/` if unused. |
| Rest-timer alarm sound | **Ours** (synthesised by our script) | `native/tools/make-timer-alarm.py`; `res/raw/timer_alarm.wav`; web beep is WebAudio (`app.js:2012`) | Keep. |
| App screenshots on landing | Ours (screenshots of our app) | `landing/assets/app-*.webp` | Keep. Re-shoot after any emoji or icon change. |

---

## 10. Data deletion (in-app + web)

| Path | Status | Evidence |
|---|---|---|
| In-app | **Works.** More → Privacy & data → Delete my account; type DELETE; re-auth if older than 10 min; `DELETE /me` | `privacy.js:5-6,70,85,323` |
| Web page | **Exists, public, no sign-in needed to read it** | `landing/delete-account.html`, `delete-account.js` (deliberately not redirected) |
| Users without the Android app | **Works in practice.** The steps point to `/app/` (`delete-account.html:109`), the same web app, so a browser is enough. **But the page doesn't say so**, and the fallback for users who can't sign in is a dead email address (M1). | — |

Play's Help Center says the web resource must let users request deletion "without being sent back to the app or made to re-download it". Your flow meets that because the web app runs in a browser, but say it explicitly. Replace the first step with:

- EN: "Open **etqadem.cloider.app/app** in any web browser (you don't need to install the app) and sign in with the same account."
- AR: «افتح **etqadem.cloider.app/app** من أي متصفح (لا تحتاج إلى تثبيت التطبيق) وسجّل الدخول بالحساب نفسه.»

Also fix «إتقدم» → «اتقدم» (`delete-account.html` AR title and steps, `delete-account.js:18`).

---

## 11. Owner request: move the coach footnote into the Terms and acknowledge it at sign-up

Today: `chat.js:38` shows "AI coach powered by Anthropic (US). Not medical advice." with a Privacy link (`chat.js:472-473`). The chat title is "Nutrition & fitness chat" (`chat.js:42`).

### (a) New Terms §5, replacing `landing/terms.html:52-55` (EN) and `:124-127` (AR). Same anchors (`#ai-coach`, `#ar-ai-coach`) and same style.

**EN**

> **5. The AI Coach**
>
> The AI Coach builds plans, answers chat messages, runs weekly check-ins and estimates calories from meal photos. **It is an artificial-intelligence system, not a person.** It is powered by Claude, a model made by Anthropic, PBC, an AI company in the United States, which processes your requests for us as our service provider.
>
> - **Optional, and only with your consent.** The AI Coach works only after you give the separate in-app AI Coach consent. Photos of InBody results need their own consent too. You can withdraw either at any time in More → Privacy & data. What we send to Anthropic, and what we don't, is explained in the [Privacy Policy](/privacy#ai-coach).
> - **AI answers can be wrong.** The AI Coach's answers, plans and calorie estimates can be wrong, incomplete, out of date or unsuitable for you, even when they sound confident. No person at Etqadem checks them before you see them.
> - **Not medical advice.** The AI Coach gives general fitness and nutrition information only (see section 4). It is not a doctor, dietitian or physiotherapist, and it can't examine you or know your full medical history. Don't use it to diagnose or treat a condition, to decide on medicines, or for allergy or safety decisions.
> - **See a professional.** Talk to a doctor or registered dietitian before following an AI plan if you have a medical condition, an injury, an allergy, an eating disorder, are pregnant or breastfeeding, or plan to fast (including in Ramadan). In an emergency, call your local emergency number. Don't ask the AI Coach.
> - **Your decision.** You decide whether to follow anything the AI Coach suggests. You are responsible for checking it against your own body, your equipment and your surroundings.
> - **Use it fairly.** Don't try to get harmful or illegal content from it, don't enter other people's personal or health information, and don't try to get around its usage limits. We may limit how often you can use it.

**AR**

> **5. المدرّب الذكي**
>
> يبني المدرّب الذكي الخطط، ويرد على رسائل المحادثة، ويجري متابعة أسبوعية، ويقدّر السعرات من صور الوجبات. **وهو نظام ذكاء اصطناعي وليس إنسانًا.** ويعمل بنموذج Claude من شركة Anthropic, PBC، وهي شركة ذكاء اصطناعي في الولايات المتحدة الأمريكية تعالج طلباتك لصالحنا بصفتها مزوّد خدمة لدينا.
>
> - **اختياري، وبموافقتك فقط.** لا يعمل المدرّب الذكي إلا بعد أن تمنح موافقة منفصلة داخل التطبيق، كما تحتاج صور نتائج InBody إلى موافقة خاصة بها. ويمكنك سحب أيٍّ منهما في أي وقت من: المزيد ← الخصوصية والبيانات. وما نرسله إلى Anthropic وما لا نرسله موضّح في [سياسة الخصوصية](/privacy#ai-coach).
> - **قد تكون إجابات الذكاء الاصطناعي خاطئة.** قد تكون إجابات المدرّب الذكي وخططه وتقديراته للسعرات خاطئة أو ناقصة أو قديمة أو غير مناسبة لك، حتى لو بدت واثقة. ولا يراجعها أي شخص في اتقدم قبل أن تراها.
> - **ليست نصيحة طبية.** يقدّم المدرّب الذكي معلومات عامة عن اللياقة والتغذية فقط (انظر القسم 4). وهو ليس طبيبًا ولا أخصائي تغذية ولا معالجًا فيزيائيًا، ولا يستطيع فحصك أو معرفة تاريخك الطبي كاملًا. فلا تستخدمه لتشخيص حالة أو علاجها، أو لاتخاذ قرارات بشأن الأدوية، أو في قرارات تتعلق بالحساسية أو السلامة.
> - **استشر مختصًا.** تحدّث إلى طبيب أو أخصائي تغذية معتمد قبل اتباع خطة من الذكاء الاصطناعي إذا كان لديك مرض أو إصابة أو حساسية أو اضطراب في الأكل، أو كنتِ حاملًا أو مرضعًا، أو كنت تنوي الصيام (ومنه صيام رمضان). وفي حالات الطوارئ اتصل برقم الطوارئ في بلدك، ولا تسأل المدرّب الذكي.
> - **القرار قرارك.** أنت من يقرر اتباع ما يقترحه المدرّب الذكي أو عدم اتباعه، وأنت مسؤول عن التحقق من مناسبته لجسمك ومعداتك ومكان تمرينك.
> - **استخدمه بإنصاف.** لا تحاول الحصول منه على محتوى ضار أو غير قانوني، ولا تُدخل بيانات شخصية أو صحية لأشخاص آخرين، ولا تحاول تجاوز حدود الاستخدام. ويجوز لنا تقييد عدد مرات استخدامه.

Also update `docs/compliance/2026-10-20-terms-of-use-v1.md` Parts A and B, and bump the version to v2 in the page header.

### (b) New sign-up line (`index.html:149` and `app.js:424`)

- EN: "By continuing, you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>, confirm you're 18 or older, and understand that the <a href="/terms#ai-coach">AI coach</a> is powered by Anthropic (US), can make mistakes and isn't medical advice."
- AR: «بالمتابعة، أنت توافق على <a href="/terms">شروط الاستخدام</a> و<a href="/privacy">سياسة الخصوصية</a>، وتؤكد أن عمرك 18 عامًا أو أكثر، وتُقرّ بأن <a href="/terms#ai-coach">المدرّب الذكي</a> يعمل بتقنية Anthropic (الولايات المتحدة)، وقد يخطئ، وليس نصيحة طبية.»

Keep it as one line with no checkbox, next to the buttons (the current design). It's an acknowledgement, not a data consent.

**On the coach screen after the sentence is removed:** rename the chat title so the user still sees it's an AI. This is a two-word label, not the old sentence, and it covers EU AI Act Art. 50(1) (in force since 2 Aug 2026) wherever EU users are reached. Keep the small Privacy link (`chat.js:473`).

- `title`: EN "AI coach chat" · AR «دردشة المدرّب الذكي»

### (c) Do existing users need to re-accept? Yes, and the code can't do it yet.

- Facts: `TERMS_VERSION = "terms.v1"` exists (`ui.js:26`), but `acceptTerms()` only writes localStorage (`ui.js:27`). Nothing reads it, and nothing records it on the server. Returning users never see the sign-up line again. Users who joined before 2026-10-20 never saw it at all.
- Also, the current Terms show "Draft — not yet in effect" (M2). Nobody has accepted a Terms that is in force yet.
- **How:**
  1. Bump to `terms.v2` when the final Terms with the new §5 go live.
  2. Record acceptance in gym-be through the existing consents API as a new type, e.g. `POST /me/consents {type:"terms", textVersion:"terms.v2", lang}`. gym-be currently rejects unknown types, so it needs a small backend change. Guests: keep the localStorage flag.
  3. On boot, if the user is onboarded and their accepted version isn't the current one, show a one-time sheet before the app. It has two buttons, "Agree" and "Not now, sign me out", plus a "Delete my account" link. It must not be a pre-ticked checkbox.

Sheet text:

- EN title "We've updated our Terms". Body: "We've added a section on the AI coach: it's powered by Anthropic (US), its answers can be wrong, and it isn't medical advice. Please read the [Terms](/terms) and [Privacy Policy](/privacy). By tapping Agree, you accept them and confirm you're 18 or older." Buttons: "Agree" · "Not now".
- AR title «حدّثنا شروط الاستخدام». Body: «أضفنا قسمًا عن المدرّب الذكي: يعمل بتقنية Anthropic (الولايات المتحدة)، وقد تكون إجاباته خاطئة، وليس نصيحة طبية. يُرجى قراءة [شروط الاستخدام](/terms) و[سياسة الخصوصية](/privacy). وبالضغط على «أوافق» فإنك تقبلهما وتؤكد أن عمرك 18 عامًا أو أكثر.» Buttons: «أوافق» · «ليس الآن».

If you instead wipe tester data at the LLC hand-over (rescope doc §0A.2 H1), everyone signs up fresh and sees the new line. You still need step 3 for future versions.

### (d) What must stay where it is

- **Keep the AI-coach consent in `coach-consent.js` and the InBody photo consent in `coach.js`, and keep naming Anthropic in them.** Agreeing to Terms is a contract. It is not permission to send someone's health information abroad. That permission has to be a separate, specific and freely given "yes" at the moment it's needed: GDPR Art. 7(2) and 7(4) and Art. 9; Egypt PDPL explicit consent for sensitive data and cross-border transfer ⚖️; WA My Health My Data. A consent hidden in the sign-up line would not count, and it would force people who never use the coach to "agree".
- **Keep the meal-photo notice too** (`chat.js:77-79`). It's the moment the user's photo actually leaves for the US. It's information at the point of collection, not a disclaimer, so it belongs on that screen.
- I found no legal route to move these into the Terms. Only the general "not medical advice / AI can be wrong" sentence can move, and only together with the AI label in the chat header above.

---

## 12. Questions for the owner

1. Which domain will be the official one (for the privacy and contact email)? Until it exists, which working mailbox should the pages show?
2. LLC status: name, state and registered address. Is the Play developer account an organization account in the LLC's name?
3. Is the release APK built with `socialLogin.facebook.include=false`? (Run `./gradlew :app:dependencies | grep facebook`.)
4. Is the Gmail SMTP sender a personal Gmail account? Can you move it to the LLC's domain?
5. Do you want the Ramadan auto-tick replaced by a question (S1)?
6. Should email sign-up keep the phone number? If so, what is it for?
7. Budget and timeline for filming our own exercise clips and drawing our own emoji and icons?

## 13. Questions for licensed lawyers ⚖️

**US:**
- Is the sign-in-wrap line (no checkbox) enough to form the contract for app users? Is a pop-up re-acceptance for Terms v2 enough for existing users?
- Will the disclaimer and liability limits in Terms §§4, 5, 12 and 13 hold for injury claims?
- Which state auto-renewal laws apply to Premium? Need refund-policy wording.

**Egypt:**
- Does the PDPC licence or permit cover the transfer to Anthropic (US) based on in-app explicit consent?
- Do Consumer Protection Law 181/2018 rules on supplier identity and the Arabic language apply to a free foreign-operated app now, or only once something is sold?
- Return and refund rights for digital subscriptions?

**KSA / UAE:**
- Do the transfer-safeguard texts in privacy §11 fit current SDAIA and UAE rules?
- Is any cookie or local-storage notice rule in force?

**EU (only if you market there):**
- Confirm the ePrivacy "strictly necessary" view for GIS `g_state` and localStorage.
- Does EU AI Act Art. 50(1) apply, and is the "AI coach" label enough?
- The 14-day withdrawal right for Premium.

---

## Sources

- Google Play Console Help, account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- FTC, CAN-SPAM Act compliance guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- GDPR Art. 7 (text via gdpr-info.eu): https://gdpr-info.eu/art-7-gdpr/
- ePrivacy Directive Art. 5(3) "strictly necessary" exemption, as amended by 2009/136/EC. EUR-Lex wouldn't load this session; text reproduced in the GESTE/SRI submission: https://geste.fr/wp-content/uploads/2024/01/GESTE-SRI-SubmissionDraftGuidelinesArticle53ePrivacy.docx.pdf (check against EUR-Lex)
- UK PECR reg. 6: https://www.legislation.gov.uk/uksi/2003/2426/regulation/6
- CC BY 2.0 legal code §4(b): https://creativecommons.org/licenses/by/2.0/legalcode
- EU AI Act Art. 50 in force from 2 Aug 2026: https://www.goodwinlaw.com/en/insights/publications/2026/08/alerts-technology-dpc-eu-ai-act-transparency-obligations-now-in-force · https://www.ropesgray.com/en/insights/viewpoints/2026/08/102nfqm/you-talkin-to-me-operationalising-the-eu-ai-acts-transparency-obligations
- Egypt Consumer Protection Law 181/2018 (English translation, secondary): https://eg.andersen.com/wp-content/uploads/2025/07/Law-No.-181-of-2018.pdf · https://www.mondaq.com/Article/820956/New-Egyptian-Consumer-Protection-Law
- DNS check: `https://dns.google/resolve?name=etqadem.app&type=MX` returned Status 3 (NXDOMAIN) on 2026-10-24.
