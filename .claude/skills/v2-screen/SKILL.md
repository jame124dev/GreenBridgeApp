---
name: v2-screen
description: Use when building or editing any screen under app/v2/ — the GreenBidz mobile redesign. Carries the design tokens, the primitive kit, the RN traps that silently break this design, and the definition of done.
---

# Building a v2 screen

Eleven screens, built at different times, that must look like one app. This
file is the contract. Follow it exactly; if it is wrong or missing something,
change **this file** rather than deviating in a screen.

## ⚠️ If the screen has a field someone types into, read this first

`../../../../FORM_INPUT_RULES.md` (workspace root, alongside `UX_DESIGN_RULES.md`)
is mandatory **before** you build the screen, not at review time. It is the
form/input/auth counterpart to this file and it cites the v2 kit directly:
`Field.tsx`'s resting border and label contrast, `Screen.tsx`'s measured
`footerH`, `OtpField.tsx`'s autofill handling, `RevealToggle`.

The three that cost the most here:

- **`autoComplete="password"` is Android-only** in RN's list. Use
  `current-password` / `new-password` / `one-time-code` — all cross-platform.
- **Never hardcode the keyboard offset that clears the sticky footer.** Measure
  the footer with `onLayout` (`Screen.tsx:180`). A hardcoded number covered the
  last field of the v2 signup, and every control on it still "worked".
- **An input needs a visible RESTING border** at ≥ 3:1 — `hairlineStrong`, not
  `hairline`.

## Where the design lives

`docs/v2-design/screens/<id>.html` — the screen as drawn, extracted from
`GreenBidz Mobile.dc.html` (Claude Design project
`f76817b9-ab75-46b3-b411-13ffa61839bd`, owner Tehreem).

| id | Screen | id | Screen |
|---|---|---|---|
| `6a` | Home — selling | `7a` | Analyzing |
| `6b` | Home — buying | `7b` | Review — photos |
| `6c` | Browse | `7c` | Review — details |
| `6d` | Matches | `7d` | Review — pricing |
| `6e` | Chat | `7e` | Review — location |
| `6f` | Account | | |

Drawn at **390 × 844pt** (iPhone 14). Every px in that HTML is a logical point
at that width.

**Read the HTML for structure and hierarchy, not for values.** The canvas has
29 raw hex literals, 23 font sizes and 12 radii across these 11 screens, with
no CSS variables. Those are already normalised into tokens. Never copy a hex
or a size out of the HTML — find the token that covers it.

## Tokens

```ts
import {
  useV2Colors, type, space, radius, icon, control,
  GUTTER, CARD_PAD, HEADER_SHEET_RADIUS, MIN_TOUCH, scaleW,
  usePressFeedback, timing, duration, easing,
} from '@/theme/v2';
```

- **Colour** — `const c = useV2Colors()`, then `c.ink`, `c.accent`, `c.wash`…
  Roles only. Full list and provenance in `src/theme/v2/palette.ts`.
- **Type** — never set `fontSize`. Use `<Text variant="rowTitle">`. Variants:
  `display h1 h2 h3 action lead rowTitle row body bodyMedium bodySemi caption
  captionMedium small eyebrow micro`.
- **Space** — `space.xs`…`space['8xl']`. The screen gutter is `GUTTER` (24),
  card inner padding is `CARD_PAD` (18).
- **Radius** — `radius.xs|sm|md|lg|xl|pill`.

## Primitives

```ts
import {
  Screen, useTabBarReserve,          // shell + safe areas
  Text,                              // all type
  BrandBar, SectionHeader, SectionNote, Hairline, Tabs,   // structure
  Row, RowThumb, RowTrailing, TintedRow, PromoBanner, Chip, ProgressLine,
  PrimaryAction, QuietAction, IconAction,                 // actions
} from '@/features/v2/ui';
```

- **`Screen`** owns safe areas, the header sheet, scroll, the tab-bar reserve,
  the status-bar style and the tablet measure cap. **Never re-implement any of
  those.** For a screen that owns its own `FlatList`, pass `scroll={false}` and
  use `useTabBarReserve()` for the list's bottom padding.
- **`BrandBar`** is the top row of every tab screen — mark, wordmark, language,
  bell with unread dot. Do not rebuild it.
- **`PrimaryAction`** is the one green pill. **At most one visible per screen.**
  Everything else tappable is `QuietAction`.
- **`SectionNote`** is loading / empty / error under a `SectionHeader`.
  Explanatory copy, never a bare spinner; an empty state takes an action.
- **`Chip`** is the small pill — a match score, a count, an age. Two tones only.
- **`IconAction`** is the round icon-only button (add a want). `accessibilityLabel`
  is required — there is no visible text to fall back on.

Verified on device: 6a Home-selling, 6d Matches, 6f Account. Read one of those
before starting — they are the reference for how the kit composes.

Need something the kit does not have? **Report it as a KIT GAP with the code;
do not edit the kit.** Reconciliation happens in one hand. Three screens were
built in parallel and all three independently rebuilt the brand bar — that is
the drift this rule exists to prevent.

## The five traps

These all render fine, throw nothing, and are wrong on the phone.

1. **Function-form `style` is deleted at runtime.** NativeWind's interop
   spreads `style`; spreading a function yields `{}`.
   `style={({pressed}) => …}` on an RN primitive silently does nothing, and
   Jest cannot see it (the interop is skipped when `NODE_ENV==='test'`).
   Use `usePressFeedback()`.

2. **`letterSpacing` and `lineHeight` are POINTS in RN, not em/ratio.** The
   canvas gives `.16em` and `1.5`. Passing those raw gives a sixth of a point
   and a 1.5pt line. Already resolved inside the `type` tokens — which is why
   you must use them.

3. **`minWidth: 0` on a flex text column**, or `numberOfLines` never
   truncates and the trailing element gets pushed off-screen. AI-written
   listing titles here run to 90 characters — that is the normal case.

4. **Safe areas.** The header wash bleeds under the notch; its *content* is
   padded by `insets.top`. Android 15+ forces edge-to-edge. `Screen` does
   this — do not add your own `SafeAreaView`.

5. **A font that is not loaded falls back silently.** Poppins 400/500/600 are
   loaded in `app/_layout.tsx`. Do not reference a weight outside those three.

## Data

**Read real, write later.** Wire the existing React Query hooks from the
start, so the design meets 90-character titles, missing photos, `&amp;` in
category names, 2,029 results and empty states. Defer only the **writes** —
publish, bid, send. Never build against mock data.

Guest mode is live: gate any action needing an account through
`requireAuth(reason, action)` from `@/features/auth/requireAuth`.

## Motion

Quiet by default — the design is "space instead of boxes". Motion answers
what a person did; there is no ambient drift and no reveal-on-scroll. The one
orchestrated moment in the app is `7a` Analyzing, where the wait is the
content. Everything goes through `usePressFeedback` / `timing`, which honour
Reduce Motion.

## Definition of done — PART 1: it works

1. `npx tsc --noEmit` — clean.
2. `npx jest src/__tests__/v2Adherence.test.ts src/__tests__/v2Contrast.test.ts` — green.
   The adherence test fails on raw hex, raw type properties, direct palette
   imports, function-form styles and off-scale radius/spacing.
3. `npx jest` — no new failures.
4. **On a device or emulator, in BOTH schemes.** Force dark with
   `<V2ThemeProvider initialPreference="dark">` — `app.config.ts` pins
   `userInterfaceStyle: 'light'` to protect the old UI, so the device setting
   will not do it for you. A hairline that vanishes on dark is invisible to
   tsc and to Jest.
5. Long-content check: longest real title, missing image, empty state.

"tsc is clean and the tests pass" is not done. This app shipped guest mode
with 1,278 green tests and it still opened on the login screen.

## Definition of done — PART 2: it is any good

**This part is not optional and it is the reason screens are being built before
features are wired.** If the look, feel and usability are not interrogated NOW,
they get discovered after the functionality is attached, when changing them is
expensive. Passing Part 1 only proves the screen is not broken.

Take a screenshot and actually look at it. Then answer these in your report —
name what you found, not "checked".

**Coherence.** Does anything on screen contradict anything else? Real example:
a cold-open review step rendered "STEP 3 OF 4 · PRICING — 75%" with a
three-quarters-filled bar directly above "There is no item to review." Every
gate was green. The screen was claiming progress through a flow the person was
not in. **Chrome belonging to a state must not render outside that state.**

**Hierarchy.** Squint at it. Does the most important thing read first? Is there
exactly one obvious primary action? Two green pills means the screen has two
primary actions and needs a decision, not a component.

**The empty and long cases, not the happy one.** A screen designed around
plausible data is a screen that breaks on real data. Check: the longest real
title (AI titles here run past 90 characters), a missing photo, zero items, and
the state a guest sees. Use `EmptyState` — an empty screen is an invitation to
act, so it carries the action that would FILL it ("Scan an item"), never just a
way out.

**Dead space.** Content occupying the top fifth of the screen with the rest
blank reads as broken, not as minimal. Centring in a `flex: 1` column under a
short header is the usual cause.

**Reachability.** Is the primary action reachable one-handed? Is anything
tappable under 44pt without `hitSlop`? Does the keyboard cover the field being
typed into, or the footer? (`Screen keyboard` fixes the last one.)

**Copy.** Read it aloud. Does any sentence repeat the one above it? (Account
said "Browsing as a guest" and then "You are browsing as a guest".) Does every
button say what happens — "Publish", not "Submit"? Do errors say what to do
next?

**Both schemes, on glass.** Not because dark is a feature, but because this
design carries all its structure in hairlines and washes, and those are exactly
what stop working when the ground changes.

Then apply Chanel's rule: look once more and **remove one thing**.
