---
name: Etqadem
description: A free all-in-one gym tracker for the gym floor: dark, lively, teal-lit, coach always at hand.
colors:
  ink-night: "#0d1117"
  ink-night-alt: "#141b24"
  slate-panel: "#161d27"
  slate-panel-raised: "#1e2733"
  chalk: "#eef2f7"
  chalk-dim: "#9fb0c3"
  hairline: "#26303d"
  vane-teal: "#0B7A75"
  vane-teal-hover: "#096662"
  vane-teal-pressed: "#07534F"
  vane-teal-tint: "#3CC2B8"
  vane-teal-deep-wash: "#0f3b39"
  emerald: "#047857"
  lagoon: "#2BB3A3"
  done-green: "#3fb950"
  done-green-wash: "#123320"
  female-ink-night: "#17121a"
  female-ink-night-alt: "#20182a"
  female-slate-panel: "#241a30"
  female-slate-panel-raised: "#2e2140"
  female-chalk: "#f6ebf2"
  female-chalk-dim: "#c7abbf"
  female-hairline: "#3d2c48"
  female-rose: "#e85c9a"
  female-rose-hover: "#d4488a"
  female-rose-pressed: "#b93a74"
  female-rose-tint: "#f38bba"
  female-violet: "#b06cf0"
  female-apricot: "#f0a35c"
  female-done-green: "#5cc0a0"
  brand-ink: "#14161B"
  brand-paper: "#F3F0E8"
typography:
  display:
    fontFamily: "'Readex Pro', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: "'Readex Pro', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "tnum"
  title:
    fontFamily: "'Readex Pro', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.3
  subtitle:
    fontFamily: "'Readex Pro', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "'Readex Pro', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "'Readex Pro', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
    fontSize: "12.5px"
    fontWeight: 700
    lineHeight: 1.4
  overline:
    fontFamily: "'Readex Pro', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.6px"
rounded:
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.vane-teal}"
    textColor: "{colors.chalk}"
    typography: "{typography.subtitle}"
    rounded: "{rounded.md}"
    padding: "12px 18px"
  button-primary-hover:
    backgroundColor: "{colors.vane-teal-hover}"
  button-primary-pressed:
    backgroundColor: "{colors.vane-teal-pressed}"
  button-tool:
    backgroundColor: "{colors.slate-panel-raised}"
    textColor: "{colors.chalk}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 11px"
    height: "44px"
  button-tool-active:
    backgroundColor: "{colors.vane-teal}"
    textColor: "{colors.chalk}"
  segment:
    backgroundColor: "transparent"
    textColor: "{colors.chalk-dim}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "9px 10px"
  segment-on:
    backgroundColor: "{colors.vane-teal}"
    textColor: "{colors.chalk}"
  card-exercise:
    backgroundColor: "{colors.slate-panel}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.lg}"
    padding: "14px 14px 12px"
  card-exercise-done:
    backgroundColor: "{colors.done-green-wash}"
  input-log:
    backgroundColor: "{colors.ink-night-alt}"
    textColor: "{colors.chalk}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  input-chat:
    backgroundColor: "{colors.ink-night-alt}"
    textColor: "{colors.chalk}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  chat-bubble-user:
    backgroundColor: "{colors.vane-teal}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.lg}"
    padding: "9px 12px"
  chat-bubble-coach:
    backgroundColor: "{colors.slate-panel-raised}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.lg}"
    padding: "9px 12px"
  nav-bar:
    backgroundColor: "{colors.ink-night}"
    textColor: "{colors.chalk-dim}"
    typography: "{typography.overline}"
    height: "58px"
  nav-item-active:
    textColor: "{colors.vane-teal-tint}"
  coach-fab:
    backgroundColor: "{colors.vane-teal}"
    rounded: "{rounded.pill}"
    size: "52px"
---

# Design System: Etqadem

## Overview

**Creative North Star: "The Coach's Clipboard"**

Etqadem is the clipboard a good coach carries across the gym floor: every exercise is its own card, every set gets a checkmark, and the coach is always one tap away in the corner. The interface is practical first. A beginner standing at a rack, phone in one sweaty hand, sees what to do next, logs the weight, starts the rest timer, and moves on. Nothing on a training screen should make them think about the app instead of the lift.

The clipboard sits in a lively room. The app is dark (ink-night backgrounds, slate cards) and lit by one teal light source that warms the buttons, the active day and the coach. Depth and motion are part of the identity, not garnish: cards lift and carry a faint top sheen, the main Start button has a WebGL metallic shine, and soft light beams drift behind the screens. Liveliness serves energy and encouragement; clarity of the next action always wins when the two compete.

The system ships two official persona palettes with identical structure: **Vane Teal** (the default, and the brand) and **Rose & Violet** (applied when the user picks the female plan). Arabic right-to-left and English are equal citizens; every layout uses logical properties so it mirrors cleanly.

**Key Characteristics:**
- Dark-only, single-column, phone-first (640px content column), bottom tab bar on phones, side rail at 900px and up.
- One accent family per persona; the accent marks the next action and the current state.
- Cards are the unit of work: one exercise, one card, one checkmark.
- Lively depth: lifted cards, sheen, gradient primary fills, metallic Start button, beams backdrop, springy press feedback.
- 44px minimum tap targets everywhere, including small controls (invisible hit areas where the visual is smaller).
- Readex Pro, one family for Latin and Arabic; weight does the hierarchy (700 for controls, headings and big numbers; 400 for body). The face tops out at 700, so there is no heavier tier.

## Colors

A deep ink-and-slate night palette with one teal light source; the female plan swaps the light source to rose with violet and apricot accents.

### Primary
- **Vane Teal** (vane-teal): the brand and the fill for primary actions, the active day, toggles that are on, the user's chat bubbles and the timer progress. White text on it passes 5.18:1.
- **Vane Teal Hover / Pressed** (vane-teal-hover, vane-teal-pressed): state fills that darken rather than lighten, so white text stays above 4.5:1.
- **Lit Teal** (vane-teal-tint): teal used as *text or icon* on dark panels (active nav item, retry links, accent labels). Raw Vane Teal as text on slate is only 2.9:1; this tint is 6.9:1.
- **Deep Teal Wash** (vane-teal-deep-wash): quiet teal background for secondary teal controls such as the Rest button.

### Secondary
- **Emerald** (emerald): the far end of the primary gradient (Vane Teal → Emerald at 135°) on the Start button, the coach button and other hero actions. Carries white text at 5.48:1.
- **Lagoon** (lagoon): a lighter teal for highlights and decorative accents.

### Tertiary
- **Done Green** (done-green) and **Done Green Wash** (done-green-wash): completion only. A finished exercise card turns green-washed with a green border; a ticked checkbox fills green. Never used for actions.

### Neutral
- **Ink Night** (ink-night): page background, the bottom bar's base (at 95% with blur), and the theme color.
- **Ink Night Alt** (ink-night-alt): recessed wells: input fields, unticked checkboxes.
- **Slate Panel** (slate-panel): card surfaces.
- **Raised Slate** (slate-panel-raised): controls and elements that sit on cards: tool buttons, coach chat bubbles, the timer bar.
- **Chalk** (chalk): primary text.
- **Dim Chalk** (chalk-dim): secondary text, meta, unselected toggles, inactive nav items.
- **Hairline** (hairline): every 1px border and divider.

### Rose & Violet persona (female plan)
Applied through `:root[data-plan="female"]`, which redefines the same CSS variables. **Rose** (female-rose) replaces Vane Teal as fill, with **Rose Hover/Pressed** and **Lit Rose** (female-rose-tint) playing the same roles; **Violet** (female-violet) replaces Emerald at the gradient's end; **Apricot** (female-apricot) replaces Lagoon; the ink, slate, chalk and hairline neutrals shift to plum-tinted equivalents (the female-* tokens). Every rule in this file applies to both personas.

### Brand mark
- **Brand Ink** (brand-ink) and **Brand Paper** (brand-paper): fixed logo/wordmark colors only, with Vane Teal and Lit Teal. They don't change with the persona and are not UI surface colors.

### Named Rules
**The Light Source Rule.** Each screen has one light source: the persona accent. It marks the next action and the current state (primary button, active day, on-toggle, active tab). If two things on a screen are filled with accent, one of them is wrong.

**The Text-Tint Rule.** Accent used as text or an icon on a dark surface is always the tint (Lit Teal / Lit Rose), never the raw fill color.

**The Green Means Done Rule.** Green is reserved for completion. Never use it for a button, link or brand moment.

**The Variable Rule.** Components read colors only through the CSS variables (`--accent`, `--panel`, `--paper`...), never hard-coded hex, so both personas work without extra code.

## Typography

**Display Font:** Readex Pro (self-hosted variable woff2, wght 160-700, Latin + Arabic subset in `fonts/`, OFL)
**Body Font:** Readex Pro
**Label Font:** Readex Pro

**Character:** one geometric, reading-optimised family that carries Arabic and Latin with matching colour and proportions, so a bilingual line does not change voice mid-sentence. Personality comes from weight and size, not a second typeface. The system stack stays as the fallback while the font loads (font-display: swap).

### Hierarchy
- **Display** (900, 34px, 1.15): rare: big hero numbers and onboarding headlines.
- **Headline** (900, 28px, tabular numerals): the rest-timer countdown and stat readouts; numbers never jitter as they change.
- **Title** (900, 19px, 1.3): screen and section titles (the hero header).
- **Subtitle** (700–800, 16px): exercise names, primary button labels.
- **Body** (400, 14px, 1.55): coach chat, notes, descriptions. Content column caps at 640px.
- **Label** (700, 12.5px): tool buttons, toggles, meta values, secondary text.
- **Overline** (700, 11px, 0.6px tracking, uppercase in Latin): group labels on the More screen, nav labels, units (kg, reps).

The scale is a fixed token ramp (`--text-xs` … `--text-3xl`: 11, 12.5, 14, 16, 19, 23, 28, 34px). The 23px step (`--text-xl`) is available for in-between headings.

### Named Rules
**The Marker Weight Rule.** Hierarchy is binary in weight: 700 for anything interactive or labelled, 900 for headings and big numbers. Don't introduce 500/600 in-between weights.

**The Token Size Rule.** Font sizes come only from the `--text-*` ramp. The ramp replaced 21 ad-hoc sizes; don't reintroduce one-offs.

**The No-Caps-in-Arabic Rule.** Uppercase and letter-spacing apply to Latin overlines only; Arabic labels are never tracked out.

## Layout

A single centred column (`.wrap`, max 640px, 16px side gutter) holds every screen. Screens are siblings toggled by the navigation, not routes. On phones a fixed bottom tab bar (58px plus the safe-area inset) carries the main destinations; from 900px it becomes a 92px side rail. Each screen reserves bottom padding for the bar plus the floating coach button (nav height + safe area + 88px), so the last card's controls are never hidden behind fixed elements.

Spacing is compact and even: 8px between list items and small controls, 12px between cards and inside card rows, 14px card padding, 16px page gutters, 20px between settings groups. Exercise meta and actions indent 38px (`margin-inline-start`) to align under the title, past the checkbox.

Fixed layers stack in a deliberate order: content (z 1), timer bar (50), coach button (65), nav (120). The rest timer slides up from the bottom when it runs, never covering the nav.

**The Logical Property Rule.** Use `inline-start/end`, `inset-inline` and `text-align:start` everywhere so Arabic mirrors without overrides. Physical `left/right` are only for things that must not mirror.

**The One-Thumb Rule.** On training screens, the actions a user takes mid-set (tick, log, rest) sit in the lower two-thirds of each card and are at least 44×44px.

## Elevation & Depth

Etqadem is lifted and lively. Surfaces are tonal layers (ink night → slate panel → raised slate), and on top of that, cards cast soft shadows and carry a faint top-down white sheen (`--sheen`), so they read as physical cards on the clipboard. Hover lifts a card 2px onto a deeper shadow; pressing sinks it back. Glass appears on fixed chrome: the nav bar and top bar use a 14px backdrop blur over 95% ink. Signature effects (the WebGL metallic shine behind the Start button, the canvas light beams behind screens, the gradient glow under the coach button) give the room energy.

### Shadow Vocabulary
- **Resting lift** (`--elev-1`: `0 2px 10px rgba(0,0,0,.28)`): every card at rest.
- **Hover lift** (`--elev-2`: `0 14px 40px rgba(0,0,0,.45)`): cards on hover, sheets and dialogs.
- **Accent glow** (`0 8px 24px color-mix(in srgb, var(--accent) 45%, transparent)`): the coach button and primary hero actions only.
- **Timer shelf** (`0 -8px 24px rgba(0,0,0,.4)`): the rest timer bar, casting upward.
- **Logo lift** (`0 6px 18px rgba(0,0,0,.4)`): app logo tiles.

### Named Rules
**The Lively, Not Loud Rule.** Effects are welcome: lift, sheen, gradient, glow, springy press. But a signature effect never sits on top of text the user must read mid-set, and every effect has a `prefers-reduced-motion` fallback (beams freeze, presses stop scaling, cards stop moving).

**The Glow Follows Accent Rule.** Glows are tinted with the persona accent via `color-mix` on `--accent`, never a fixed color, so they switch with the persona.

## Shapes

Friendly, rounded rectangles throughout, with radius scaled to size: 8px for small controls and input fields, 10px for buttons, day items and toggles, 14px for cards and chat bubbles, 20px for large tiles (onboarding logo, hero cards), full pill for chat input, progress tracks and the round coach button. Chat bubbles flatten the corner nearest the speaker to 4px. Every border is a 1px Hairline; completed states swap the border color instead of adding thickness. Icons are filled (`fill: currentColor`) and inherit text color.

**The Corner Scale Rule.** Radius grows with the element: 8 → 10 → 14 → 20. A small control never gets a big radius, and a card is never sharp-cornered.

## Components

### Buttons
Confident, chunky and tactile; they compress when pressed.
- **Shape:** gently rounded (10px; tool buttons 8px).
- **Primary (Start/session):** Vane Teal → Emerald gradient at 135°, white 800-weight text, 12px 18px padding. The start button sits inside the metallic WebGL shell, which adds layered shadows and a shine; the shell's shadow tightens on hover and collapses on press.
- **Hover / Press:** darken (`filter:brightness(.88)`) and lift 1px with an accent glow; press scales to .96–.98. Never lighten a teal button: white text must stay at or above 4.5:1.
- **Tool (`btn-sm`):** Raised Slate fill, Hairline border, Chalk 700 label, 44px minimum, optional 13px leading icon. The Rest variant uses Deep Teal Wash with an accent border; the video toggle fills with accent when on.
- **Disabled / Premium (planned):** Raised Slate with Dim Chalk text, 75% opacity, not-allowed cursor.

### Segmented toggles and day list
- **Style:** transparent with a Hairline border and Dim Chalk text; the selected option fills with the accent, its border matches, and the text turns white.
- **State:** press scales to .96 (toggles) or .98 (day items); the active day fades in.

### Cards / Containers (exercise card)
- **Corner Style:** 14px.
- **Background:** Slate Panel with the sheen overlay; completed cards go Done Green Wash with a Done Green border.
- **Shadow Strategy:** Resting lift; Hover lift with a 2px rise.
- **Border:** 1px Hairline.
- **Internal Padding:** 14px 14px 12px; 12px between cards; cards animate in (slide-up) when a day loads.

### Checkbox
A 26px rounded square (8px) on Ink Night Alt with a 2px Hairline border; ticked, it fills Done Green with a white check. Its invisible hit area is 44×44px.

### Inputs / Fields
- **Log fields (weight/reps):** a recessed Ink Night Alt well with a Hairline border and 8px radius; bold 14px centred numbers and an always-visible unit suffix (kg, reps) in Overline style outside the input.
- **Chat input:** pill-shaped, Ink Night Alt, Hairline border; focus turns the border accent.
- **Focus:** every control shows a 2px accent outline with 2px offset, keyboard-only via `:focus-visible`.
- **Disabled:** 60% opacity.

### Navigation
- **Style:** fixed bottom bar, 58px, 95% Ink Night with backdrop blur and a Hairline top border; each tab is a 22px filled icon over an 11px 700-weight label.
- **States:** inactive Dim Chalk; active Lit Teal with an accent drop-shadow glow under the icon; press scales to .9.
- **Desktop (900px+):** becomes a 92px side rail.

### Coach button and chat (signature)
The coach is always in the corner. A 52px round button with the accent → secondary gradient, a 30px icon and an accent glow floats at the inline-start edge above the nav; it springs on press (overshooting cubic-bezier). It opens the coach chat panel: a Hairline-bordered header, a message list of 14px-radius bubbles (user in accent on the end side, coach in Raised Slate on the start side, system notes dashed and centred), a three-dot typing indicator, a typewriter reveal the user can tap to skip, and a pill input with a round send button.

### Rest timer bar (signature)
A slide-up shelf (Raised Slate, accent top border, upward shadow) with a 28px 900-weight tabular countdown, a dim label, Skip, and a 5px pill progress track that fills with accent.

## Do's and Don'ts

### Do:
- **Do** read every color through the CSS variables so the Vane Teal and Rose & Violet personas both work automatically.
- **Do** use the Teal → Emerald (or Rose → Violet) 135° gradient for hero primary actions, and a solid accent fill for selected states.
- **Do** use Lit Teal (`--accent-tint`) for accent text and icons on dark surfaces.
- **Do** keep every tap target at least 44×44px, with an invisible hit area if the visual is smaller.
- **Do** give every motion and effect a `prefers-reduced-motion` fallback.
- **Do** use tabular numerals for timers, weights and counts.
- **Do** use logical properties (`margin-inline-start`, `inset-inline`, `text-align:start`) so Arabic mirrors.
- **Do** make interactive things feel physical: a 2px lift on hover, a .96–.98 scale on press.

### Don't:
- **Don't** hard-code accent hex values in components; the female persona will break.
- **Don't** use green for anything except completion.
- **Don't** lighten a teal button on hover; darken it.
- **Don't** put raw Vane Teal text on slate (2.9:1); use the tint.
- **Don't** add font sizes outside the `--text-*` ramp, or weights other than 400/600/700 (Readex Pro stops at 700).
- **Don't** let a fixed element (nav, timer, coach button) cover a card's controls; keep the screen's bottom padding.
- **Don't** reintroduce orange as a brand color, or the old "Athlex" name or blue accent.
- **Don't** add a light theme ad hoc; the system is dark-only until a light theme is designed as a full persona-aware set.
