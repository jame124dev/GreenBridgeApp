# 01 — Choose role

**Web source:** `SellerOnboarding.tsx:756-790` (`screen === "choose"`)
**Mobile route:** `app/(auth)/register.tsx` — the first thing the replaced screen shows
**Shell:** none. The web renders this full-bleed *outside* the two-column layout, and mobile should
do the same — `AuthShell` starts at screen 02.

## What it asks

One question: *How would you like to use 101LAB?* Two cards, each with an icon, a heading, a
sentence, and two buttons.

| Card | Copy | Buttons |
|---|---|---|
| I'm a buyer | "Looking for test and lab equipment? Log in or create a free account to browse and buy calibrated instruments." | **Log in** · Register as a buyer |
| I'm a seller | "Have surplus or inventory to move? Register to list your equipment and reach buyers who value calibration." | **Log in** · Register to sell on 101LAB |

Copy is verbatim from the web so the two products say the same thing. It still goes through the
translation dictionary — see `00-introduction.md`.

## Where the buttons go

| Button | Web | Mobile |
|---|---|---|
| Log in (either card) | `/auth?type={role}&mode=signin` (`:476`) | `app/(auth)/login.tsx` |
| Register | sets role, advances to screen 02 (`:477`) | same — local state, no navigation |

Register does **not** navigate. It sets `role` and swaps to screen 02, so Back from 02 returns
here without a round trip.

## When it is skipped

- `?role=seller` or `?role=buyer` — jumps straight to 02 (web `:431-437`). This is how the
  valuation email and the old `/auth?type=seller&mode=signup` link arrive.
- `?ref=CODE` with a valid invite — jumps to 02 in invite mode (web `:330`).
- `?resume=1` / `?upgrade=1` — skipped entirely; the wizard opens mid-flow (web `:350-415`).

## Mobile build notes

- Two `OptionCard`s, or two `Surface`/`SoftPanel` blocks with a `PrimaryAction` +
  `QuietAction` pair each. **Check `OptionCard` first** — it already renders
  heading + description + selection state.
- This is a *choice*, not a selection: tapping a button acts immediately, there is no Continue.
  So `OptionCard`'s radio affordance may be wrong here. `<VERIFY>` against the component before
  using it; a plain `Surface` with two buttons is the fallback.
- Vertical stack on a phone, not the web's two-up grid.
- One obvious primary per card (`UX_DESIGN_RULES.md`): the web makes **Log in** solid and Register
  outlined. Keep that — most arrivals here already have an account.

## Open questions

- **Does mobile need this screen at all?** The app's entry points are the guest sell-gate and
  `SignInPrompt`, both of which already know whether the user wants to buy or sell. If every real
  path into registration sets `role`, this screen is only ever reached by someone tapping a bare
  "Create account". Worth deciding before building it — it may be one card, or none.
- Mobile has no deep-link equivalent of `?role=` yet. `<VERIFY>` whether the valuation email and
  any push notification can route here with a role, or whether that is web-only.

## Acceptance

Both Log in buttons reach the existing login screen. Both Register buttons reach screen 02 with
the right role, and Back from 02 returns here. Rendered and tapped on a device in a non-English
language, with all four buttons pressed — not two.

---

## Progress

**2026-10-05 — BUILT, and changed from the web design.** `OnboardingFlow.tsx` → `RoleChoice`.
Verified in Chrome at 390×844 (`_proof/build-01-role.png`).

**Not two cards with a solid "Log in" each.** That is two competing primaries on one screen,
which `UX_DESIGN_RULES.md` forbids and which the fresh-eyes review flagged. It is now a
single-select of two `OptionCard`s with one sticky Continue — the same pattern as every other
step, so the flow opens the way it continues.

The open question in this file — *does mobile need this screen at all?* — is still open. It is
reachable today only by typing the dev route.

**Verified:** Continue is disabled until a role is chosen, then enables. Both options announce
title + description to the accessibility tree as `radio`.

**Not done:** the "Log in" route out. The web offers it per card; here there is none, because
this mock is not wired into the real auth stack.

---

## Progress — 2026-10-05, second pass

**Where Continue now goes.** It no longer drops a seller into step 1. Selecting *seller* and
pressing Continue sets `roleConfirmed` and renders the **account screen**
(`OnboardingFlow.tsx:295-308`) — screen 02, which is now built. See `02-account.md`; the earlier
"NOT BUILT / 3.1.1" note there was wrong. Back from the account screen calls `ob.reset()`
(`:300`), which returns here but **clears every answer** rather than preserving them the way this
file's acceptance criterion ("Back from 02 returns here") implies.

⚠️ **The buyer branch bypasses the account screen entirely.** `onContinue` calls `ob.setDone(true)`
for a buyer (`:316-318`) instead of `confirmRole()`, so a buyer reaches "You're all set to buy"
without ever entering an email or a password. That is a defect, not the web's behaviour — on web a
buyer creates the account on screen 02 and *then* skips the wizard. Written up in `02-account.md`.

**Walked on a device** (Samsung SM-G781B, dev client, `greenbridge://onboarding-mock`):
`_proof/device-01-role.png`, `_proof/device-02-role-selected-fix.png`. Selection holds, Continue
is what advances. That device run is what caught the `roleConfirmed` bug the browser hid — see
`00-introduction.md`.

**Still open, unchanged:** whether mobile needs this screen at all; no `?role=` deep-link
equivalent; no "Log in" route out.
