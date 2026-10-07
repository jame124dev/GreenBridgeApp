# 09 — Buyer confirmation

**Web source:** `SellerOnboarding.tsx:1091-1110` (`screen === "buyerDone"`)
**Shell:** `AuthShell`, or a plain `Screen` — no step rail, the buyer never entered the wizard
**Reached by:** buyers only, straight from screen 02.

## What it shows

| Element | Copy |
|---|---|
| Tick in a soft circle | — |
| Heading | "You're all set to buy." |
| Body | "We've sent a confirmation link to your email." |
| Primary | **Browse equipment** → `/listings` |
| Divider, then a cross-sell | "Have equipment to sell?" / "Add a seller profile to this account anytime." → **Set up selling →** `/become-seller` |

## ⚠️ On web it is usually skipped

`handleAgreeAndStart` establishes the buyer session and, if that returns a redirect URL, navigates
away immediately — `setScreen("buyerDone")` only runs when it does **not** (web `:581-587`).
`establishSession` returns a URL whenever the signup response carried a token, which is the normal
case. So this screen is the fallback for a token-less signup, not the usual ending.

Decide deliberately for mobile:

- **Match web** — buyers land in the app and never see this. Fastest path, but no confirmation
  that an email was sent, and the "add selling later" cross-sell never appears.
- **Always show it** — one tap more, but the buyer is told to check their email and learns the
  seller upgrade exists.

Recommendation: **always show it.** The web behaviour makes the body copy a lie in the common case
anyway (an email *was* sent; nobody was told), and the cross-sell is the only place in the product
where a buyer learns they can become a seller without hunting for it.

## Mobile build notes

- No step rail — the buyer answered one screen, not six. A "step 6 of 6" here would be nonsense.
- **"Browse equipment" must go to the mobile browse tab, not `/listings`.** The web route does not
  exist in the app.
- **"Set up selling" needs a mobile destination.** `/become-seller` is a web page. Options: route
  into this wizard at screen 03 with the existing session (the `?upgrade=1` equivalent), or drop
  the link on mobile. Routing into 03 is the better product answer and reuses everything already
  built — `<VERIFY>` the session is sufficient for the step saves, which need `userId`.
- The buyer's marketing opt-in from screen 02 is currently discarded — see
  [03-seller-type.md](03-seller-type.md). If it is going to be sent, this is the last moment it
  can be.

## Acceptance

Reached on a device by completing a buyer signup. Both links pressed and both land somewhere real
in the app — not a web URL and not a dead route. Copy renders in a non-English language.

---

## Progress

**2026-10-05 — BUILT, merged with screen 10 into one outcome component** that forks on role,
rather than two near-identical screens. `OnboardingFlow.tsx`, the `ob.done` branch.

Per this file's recommendation, the buyer outcome is **always shown** rather than skipped —
the web only reaches it on a token-less signup, which makes its "check your email" copy a lie
in the common case.

**Not done, and these are the real gaps:** "Browse equipment" and "Set up selling" both call
`ob.reset()` — placeholders, because wiring them means routing into the app, and the
destinations this file says to verify (`/listings`, `/become-seller`) do not exist on mobile.
The buyer marketing opt-in is still not collected or sent anywhere.

---

## Progress — 2026-10-05, second pass

### ⚠️ A buyer now reaches this screen without an account

This file assumes a buyer arrives here *"straight from screen 02"* — having supplied an email and
a password. In the built flow they do not. The role screen's Continue calls `ob.setDone(true)`
immediately for a buyer (`OnboardingFlow.tsx:316-318`) instead of `confirmRole()`, and the
account screen's render guard requires `roleConfirmed` (`:295`). So the whole buyer path is **two
taps: pick "I'm a buyer", press Continue, read "You're all set to buy."**

That makes the body copy — *"We've sent a confirmation link to your email"* — false in every case
rather than, as this file complained of web, merely the common one. No email was collected, so
none was sent, and even with the API switched on no account would be created.

Not fixed. Written up alongside the account screen in `02-account.md` § "A buyer never reaches
this screen". The two dead fragments left by it are the buyer branch of `onCreated`
(`OnboardingFlow.tsx:303`) and the `BUYER ACCOUNT` eyebrow (`:657`) — both written for the path
that was intended.

### Unchanged

Both actions still call `ob.reset()` (`:229`, `:232`), so neither "Browse equipment" nor "Go to
dashboard" goes anywhere; the seller cross-sell ("Set up selling") this file argues for was never
built, so a buyer is still never told the seller upgrade exists. The marketing opt-in is still
neither collected nor sent.

**Never walked on a device.** The buyer outcome was seen in Chrome only
(`_proof/build-06-buyer-done-light.png`). The device session stopped at the terms sheet on step 6.

## Progress — 2026-10-06: walked on a device, and the skip fix is confirmed

Samsung SM-G781B, write path OFF, from a clean role screen.

The defect this file records — a buyer reaching this screen without ever creating an account — is
**fixed and verified on hardware**. Selecting "I'm a buyer" and pressing Continue opens the
account screen in its buyer form (`_proof/device-14-buyer-account.png`): eyebrow `BUYER ACCOUNT`,
CTA "Agree and start buying", and the plain *"By continuing you agree to the 101LAB Terms of Use
and Privacy Policy."* line where a seller gets the terms checkbox. Filling all five fields enables
the CTA (`_proof/device-15-buyer-account-valid.png`), and pressing it lands directly on *"You're
all set to buy."* / *"We've sent a confirmation link to your email."* with **no wizard step in
between** (`_proof/device-16-buyer-done.png`) — the step spine is correctly empty for buyers.

Still unchanged: both CTAs call `ob.reset()`, so "Browse equipment" and "Go to dashboard" lead
nowhere and the destinations remain unchecked; the seller cross-sell this file argues for does not
exist; the marketing opt-in is neither collected nor sent. The confirmation email the subtitle
promises is also not sent by anything — the write path is off and no verification endpoint is
wired (see `02-account.md` on the missing OTP).
