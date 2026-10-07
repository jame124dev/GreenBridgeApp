# Paste this into a fresh Claude Code session

Working directory: `C:\Users\Pc\Desktop\greenBridge\GreenBridgeApp`

---

## Task

Rework the **seller status UI** on the home screen. It works and is device-verified; it just looks
wrong. This is a visual/structural change only — **do not change the behaviour**.

**Do not run anything.** No `npm`, no `jest`, no `tsc`, no Metro, no adb, no builds, no servers.
Just write the code. We will run it and come back to you with anything that needs adjusting.

First, look at these four images and read the brief:

- `Docs/v2/authv2/_refs/README.md` — the full brief, read this first
- `Docs/v2/authv2/_refs/BEFORE-01-card-pile-dark.png` — what is wrong (dark)
- `Docs/v2/authv2/_refs/BEFORE-02-card-pile-light-three.png` — what is wrong (light, all 3 cards)
- `Docs/v2/authv2/_refs/TARGET-01-home-single-status-row.png` — **build this**
- `Docs/v2/authv2/_refs/TARGET-02-account-status-checklist.png` — already built, leave alone

---

## The change, in one sentence

Replace up to three stacked amber notice cards on the Selling home with **one quiet white row**
(progress ring + title + one caption + chevron) that opens the existing account-status screen.

---

## Files

**Rewrite** — `src/features/v2/seller/SellerStatusCards.tsx`
Currently renders 1–3 `CautionCard`s plus a `TintedRow`. It should render **at most one row**.
Keep the export name (`SellerStatusCards`) so its mount site does not change. It also exports
`ResendEmailAction`, which `app/v2/account-status.tsx` imports — **keep that export working**.

**Keep, do not touch** — `src/features/seller/useSellerStatus.ts`
Correct and tested. It gives you `{ signedIn, awaitingApproval, emailVerified, onboardingIncomplete,
loading }`. Derive the row's progress and caption from these four booleans.

**Keep, mostly** — `app/v2/account-status.tsx`
This is the detail screen and matches TARGET-02. Amber belongs here, not on the home screen.

**Do not touch** — `src/features/v2/home/SellingPane.tsx`
`<SellerStatusCards />` is already mounted at line 364 with the correct import at line 77.

---

## What the row must look like (TARGET-01)

- White card, `radius.lg`, soft `c.accentWash` hairline border, ~72px tall, **one line of content**
- Left: 40px circular progress ring, `c.accent` stroke, `2/4` style count inside
- Middle: semibold title + ONE grey caption summarising everything
- Right: chevron
- **No body paragraph. No buttons. No amber.**
- `onPress` → `router.push('/v2/account-status')`

Suggested content (adjust the copy keys as needed, see i18n below):
- title: "Finish setting up your account"
- caption: combine the live facts into one line, e.g. "Waiting for approval · 1 thing needs you"
- count: how many of the applicable items are done

Render **nothing at all** when `!signedIn`, when `loading`, or when none of the three conditions
holds. That is existing behaviour and must survive.

---

## Constraints that WILL fail the build if you ignore them

1. **Tokens only.** `useV2Colors()`, `radius`, `space` from `@/theme/v2`.
   `src/__tests__/v2Adherence.test.ts` fails on raw `borderRadius` numbers (use `radius.pill` for a
   circle) and on raw `letterSpacing` / `textTransform` (use `<Text variant="eyebrow">`).
2. **Flat grounds need a reason.** `src/__tests__/v2MaterialCoverage.test.ts` requires a `flat:`
   comment **within TWO lines** of any hand-rolled `backgroundColor: c.*`. Two lines, not three.
3. **i18n: six locales, and the key path is counter-intuitive.**
   Keys live at **`mobile.auth.onboarding.sellerStatus.*`** — NOT `mobile.auth.sellerStatus.*`.
   Existing children: `pending`, `verify`, `finish`. Add/change keys in ALL SIX of
   `src/i18n/locales/{en,zh-Hans,zh-Hant,ja,th,vi}.json`.
   ⚠️ `src/i18n/__tests__/authCoverage.test.ts` only checks that every `en` key exists in the other
   five — it CANNOT catch the component asking for a wrong path. That mistake renders the raw key
   path on screen. Double-check the path by hand.
4. **New v2 routes must be declared** in `src/__tests__/v2Inventory.test.ts` (you probably will not
   add one — reuse `/v2/account-status`).
5. `TintedRow` (`src/features/v2/ui/TintedRow.tsx`) already carries its own
   `marginHorizontal: GUTTER`. If you reuse it, do not add a second gutter on the wrapper.

## Behaviour that must not regress

- **It reports, it never gates.** Nothing here may block navigation or publishing. Routing pending
  users to a wall is what got build 1.0.3 (21) rejected under App Store Guideline 5.1.1(v); see the
  standing comments in `app/_layout.tsx` and `app/index.tsx`.
- **Publishing is decided only by `canSubmitListing()`** in
  `src/features/seller/sellerSubmitGate.ts`. Do not add a second opinion about it.
- **The row must withdraw when its reason resolves.** Today the email card disappears once the
  server reports the address verified. Keep that live-state behaviour; do not reduce it to a flag
  captured at sign-in.

---

## When you are done

Summarise: which files you changed, the final copy for each locale key you touched, and anything
you were unsure about. Do not claim it works — nobody has run it. We will run it and report back.
