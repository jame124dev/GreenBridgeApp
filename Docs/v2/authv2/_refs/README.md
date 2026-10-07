# Seller status UI — redesign brief

**For:** whoever picks this up next. You should not need the rest of this folder's history.

The seller status surfaces were built on 2026-10-06, work correctly, and are **device-verified**
(see `../_proof/`). The owner's judgement is that they look wrong, and I agree. This is a
**visual/structural rework of something that already functions** — do not break the behaviour
while changing the look. The logic is in:

- `src/features/v2/seller/SellerStatusCards.tsx` — the home-screen cards (the thing to replace)
- `src/features/seller/useSellerStatus.ts` — the data (keep; it is correct and tested)
- `app/v2/account-status.tsx` — the detail screen (keep; it is close to the target already)

---

## What is wrong today

Look at `BEFORE-01-card-pile-dark.png` and `BEFORE-02-card-pile-light-three.png`.

1. **The notice is louder than the primary action.** An amber block sits directly under "Scan it"
   and out-shouts it. In dark mode the brown-on-dark-green reads muddy — more like a broken or
   disabled surface than a deliberate warning.
2. **They stack.** Up to three full-width cards, each with title + two-line body + an action.
   Together they push DRAFTS and LISTINGS — the seller's own work — off the screen.
3. **Card weight for banner content.** These are status messages, not a flow to complete, so they
   should not carry card weight at all.
4. **Three left edges inside one card.** Glyph/title, body, and "Send it again" each start at a
   different x.
5. **"Send it again" has no button shape** — a bare text link floating in space reads as a label.

`BEFORE-03-rejected-three-card-design.png` is the original Stitch design that led here. It has the
same fault, worse. Do not use it.

---

## The target

### `TARGET-01-home-single-status-row.png` — the home screen

Replace the whole stack with **ONE quiet row**:

- 40px circular progress ring, green stroke, `2/4` inside it
- Title: "Finish setting up your account"
- One grey caption that summarises everything: "Waiting for approval · 1 thing needs you"
- Chevron. **No body paragraph, no buttons, no amber.**
- Tapping it opens the account-status screen.

The test for this screen: the green "Scan it" button is the loudest thing on it, and the seller's
drafts are visible without scrolling. Both are true in the target and false today.

### `TARGET-02-account-status-checklist.png` — the detail screen

Already built and close. This is where the detail belongs: the connected checklist, the per-step
copy, and the actions (Resend email, finish the wizard). **Amber lives here only**, on the one row
that needs action — not on the home screen.

---

## Rules for the rework

- **Tokens only.** `useV2Colors()`; the caution tone is `cautionWash` / `cautionInk` /
  `cautionLine` (added 2026-10-06, contrast computed: 5.84:1 light, 9.15:1 dark). Radii from
  `radius`, spacing from `space`. `v2Adherence` fails the build on raw `borderRadius` numbers and
  raw `letterSpacing`/`textTransform` — use `<Text variant>`.
- **Flat grounds need a reason.** `v2MaterialCoverage` requires a `flat:` comment within TWO lines
  of any hand-rolled palette ground.
- **Reuse `TintedRow`** for the summary row if it fits — it is already the app's "one offer per
  screen" row and carries its own `marginHorizontal: GUTTER`. Do not add a second gutter around it.
- **Do not make it a gate.** These surfaces report; they never block. Routing pending users to a
  wall is what got build 1.0.3 (21) rejected under Guideline 5.1.1(v). See the standing warnings in
  `app/_layout.tsx` and `app/index.tsx`.
- **Do not add a second opinion about publishing.** `canSubmitListing()` decides that, alone.
- **Keep the withdraw behaviour.** Cards disappear when their issue resolves — proven on device in
  `../_proof/device-27-email-card-withdrawn-after-verify.png`. Do not regress it to a static flag.
- Six locales. `authCoverage` enforces it. ⚠️ The existing keys live under
  `mobile.auth.onboarding.*`, NOT `mobile.auth.*` — getting that wrong renders the raw key path on
  screen and no test catches it.

## Why this shape — the research

- Banners suit status that affects you but needs no immediate action; cards suit a focused flow you
  are meant to complete. Today's build uses card weight for banner content.
  <https://baymard.com/learn/banner-ui>
- The established pattern for this exact problem is an **onboarding checklist**: one container,
  4–7 items, a progress indicator, auto-completion, and a **collapsible** container rather than
  separate blocks. On a phone the collapsed state is the single row (`TARGET-01`) and the expanded
  state is the dedicated screen (`TARGET-02`).
  <https://kompassify.com/blog/onboarding-checklist-examples>
- A ready-made component exists but was **not** vendored: licence listed as unknown, and it is
  web-only (Radix + Framer Motion). The pattern was taken, the code was not.
  <https://21st.dev/@chowlol202/components/onboarding-checklist>

## Provenance

`TARGET-*` were generated in the Stitch project "GreenBidz authv2 — Mobile seller onboarding"
(`projects/5758832084927049751`) from prompts carrying the app's own tokens — they are our own
artwork, not third-party shots. `BEFORE-*` are real device captures of the current build.
