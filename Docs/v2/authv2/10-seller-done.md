# 10 — Seller confirmation

**Web source:** `SellerOnboarding.tsx:1112-1126` (`screen === "sellerDone"`);
completion `finishOnboarding` `:728-745`
**Shell:** `AuthShell` or plain `Screen`, no step rail
**Reached by:** sellers, after screen 08.

## What it should show

| Element | Copy |
|---|---|
| Tick in a soft circle | — |
| Heading | "Your seller profile is in review." |
| Body | "We'll email you once it's approved. You can start drafting listings now." |
| Primary | **Draft your first listing** → the scan/sell flow |
| Secondary | **Go to dashboard** |

## ⚠️ On web this screen is dead code

Nothing ever sets `screen` to `"sellerDone"`. It is in the `ScreenKey` union (web `:58`) and it is
rendered (`:1112`), but `finishOnboarding` always ends in `window.location.href = redirectUrl`
(`:744`). Grep confirms one occurrence outside the type and the render — none of them a setter.

So a web seller finishes the wizard and is thrown straight at the dashboard, never told their
profile is in review. **Mobile should show it.** The seller has just answered seven screens;
ending on a hard redirect with no acknowledgement is the worst moment in the flow to go silent.

## The completion sequence

This is where the flow actually commits. Order matters.

| # | What | Web | Must mobile block on it? |
|---|---|---|---|
| 1 | Save the calibration answer | never runs — see [08](08-calibration.md) | **yes**, await it |
| 2 | `POST /user/onboarding-details { onboarding_completed: true }` | `:733`, errors swallowed | **yes** — see below |
| 3 | Store the session token held since screen 02 | `:739-742` via `establishSession` | yes |
| 4 | Claim any guest valuation | inside `establishSession`, `:648` | no, best-effort |
| 5 | Navigate | `:744` | — |

## ⚠️ Step 2 cannot stay best-effort

The web wraps it in `try { } catch { }` and redirects regardless. The dashboard gate
(`SellerOnboardingGuard`) sends anyone with `onboardingCompleted === false` back to `?resume=1`,
which reopens at the last step, whose button runs this same sequence again.

One failed request and the seller is in a closed loop between dashboard and wizard, with nothing on
screen explaining it. The guard is careful to **fail open** on an error in its own read — the write
has no equivalent protection.

Mobile must:

- **await** the completion POST and check the response
- on failure, stay on screen 08 with a visible message and a retry — never navigate as if it worked
- on success, verify by reading the stored row before trusting it (`GET /user/onboarding-details`
  returning `onboardingCompleted: true`), because a 200 on the write is not proof the flag persisted

That last point is the workspace rule about mutating calls, and this is the single flag the whole
gate depends on.

## Mobile build notes

- **"Draft your first listing"** → the v2 scan flow. The web sends `/sell`, which does not exist in
  the app. This is the highest-intent moment in the product — the button has to land somewhere that
  works, verified by pressing it.
- **"Go to dashboard"** → the v2 home. `<VERIFY>` what a freshly-created, not-yet-approved seller
  actually sees there. The account is created `pending`, so the destination must be checked as a
  pending seller, not as an approved test account — "changing where a flow lands means re-verifying
  the destination".
- No step rail.
- The screen must survive being the first thing shown after a cold start, if the completion
  sequence is resumed rather than run fresh.

## Interaction with the dashboard gate

Once `onboarding_completed` is true the gate lets the seller through. Until then every dashboard
entry bounces to `?resume=1`. So this screen and the gate are two halves of one mechanism — a
change to either needs the other re-checked.

Mobile `<VERIFY>`: does the app have an equivalent gate at all, or does it rely on the web one?
If the app has no gate, a mobile seller who abandons at screen 05 gets into the app with half a
profile, which web prevents. That is a product decision, not an oversight to inherit silently.

## Acceptance

A seller account completed end-to-end on a real device, in a non-English language, landing here —
then the flag confirmed by reading the row back, not by the write's 200. Both buttons pressed and
both reaching a real mobile screen. The failure path proven too: force the completion POST to fail
and confirm the user is told and offered a retry, rather than dropped into the loop.

---

## Progress

**2026-10-05 — BUILT, including the screen web never shows.** `OnboardingFlow.tsx`, `ob.done`
branch with `role === 'seller'`. Verified in Chrome (`_proof/build-05-done.png`).

Web's `sellerDone` is unreachable — `finishOnboarding` always hard-redirects. Here it renders:
"Your seller profile is in review." plus the kit's `Timeline` showing review → email →
listings live, with the first step active and the rest pending. No step rail, per this file.

**The submission sequence is mocked.** Phases advance on a `setTimeout` so the `Timeline` can
be seen working; there is no request. When this is wired, the order in this file's table
stands — and **step 2, the completion flag, must be awaited and its failure surfaced**, which
is the loop this file documents. The mock cannot prove that; it can only avoid designing it
away.

**Correction to this file:** it calls web's dashboard loop "closed". An audit found every
wizard step carries a "Save & exit" control routing out to a team workspace or home
(`SellerOnboarding.tsx:124` → `:511` → `:505-510`). The seller cannot reach the dashboard, but
is not trapped in the app. The overstatement was mine.

**Not done:** both buttons call `ob.reset()`. "Draft your first listing" must reach the v2 scan
flow and "Go to dashboard" the v2 home, and the destination has to be checked as a *pending*
seller — the account is created `pending`.

---

## Progress — 2026-10-05, second pass

### The completion sequence is now written, and designed the way this file demanded

The entry above says *"the mock cannot prove that; it can only avoid designing it away"*. The
design is now in code:

| # | This file's requirement | Where it is |
|---|---|---|
| 1 | Save the calibration answer first, awaited | `OnboardingFlow.tsx:338-345` — `setSubmitPhase(0)` runs only on a true return |
| 2 | **Await** the completion POST, do not swallow | `useOnboardingApi.ts:224-246`, called from `:183-203` |
| 2b | **Read the row back** — a 200 is not proof the flag persisted | `completeOnboarding`, `sellerOnboarding.ts:209-218`: POST, then `GET`, then throw if `onboardingCompleted` is still false |
| 3 | Store the session token | moved **earlier** — established the moment the account exists (`useOnboardingApi.ts:126-136`), not held in memory to the end. Reasoning at `useOnboardingApi.ts:28-42` |
| on failure | Stay on the last step with a message and a retry, never navigate as if it worked | `OnboardingFlow.tsx:196-198` — `setSubmitPhase(null)` drops back; the error box and "Try again" are at `:369-376` |

So the closed-loop defect this file documents is avoided by construction rather than by luck.

### ⚠️ None of it has run

The write path is interlocked off: `isOnboardingApiLive()` requires `EXPO_PUBLIC_ONBOARDING_API=1`
**and** an API URL containing `testapi.greenbidz.com` (`useOnboardingApi.ts:61-65`), and with it
off `finish()` returns `true` without calling anything (`:225`). **No request has ever been made
from this code.** The submitting `Timeline` still advances on a 900 ms `setTimeout`
(`OnboardingFlow.tsx:204`), so what has been seen is four phases on a timer, not four phases
tracking four requests.

This file's acceptance — the flag confirmed by reading the row back — is therefore **unmet**, and
so is its harder half: *force the completion POST to fail and confirm the user is told and offered
a retry.* The failure branch exists and has never been exercised.

### Still unverified on hardware

**This screen has never been walked on a device**, nor has the submitting timeline before it. Both
were seen in Chrome only (`_proof/build-05-done.png`). The device session covered role choice,
account, seller type, business and the terms sheet on step 6.

Both buttons still call `ob.reset()` (`OnboardingFlow.tsx:229`, `:232`), so the destination check
this file insists on — *as a pending seller, not an approved test account* — has not begun. The
mobile-gate `<VERIFY>` above (does the app have an equivalent of `SellerOnboardingGuard` at all?)
is also still unanswered.

## Progress — 2026-10-06: this screen, and the timeline before it, are now device-verified

Samsung SM-G781B, write path OFF. The device session resumed at the terms sheet on step 6.

Ticking the terms checkbox clears the soft gate
(`_proof/device-10-calibration-terms-accepted.png`), and Submit runs the submitting timeline on
hardware for the first time (`_proof/device-11-submitting-timeline.png`): title *"Setting up your
account"*, the four rows — Saved your answers · Checked your details · Creating your seller
profile · **Sending it for review** (the active row in bold) — the live-region line *"Step 4 of 4:
Sending it for review"*, and a disabled CTA reading "Submitting…" with its spinner.

It then lands here (`_proof/device-12-seller-done.png`): *"Your seller profile is in review."*,
the subtitle, the three-row list with only the first row active, the primary "Draft your first
listing" and the secondary "Go to dashboard".

**Still unverified, unchanged by this walk:** the failure branch has never been exercised (nothing
can fail while the write path is off); both CTAs still call `ob.reset()`, so neither destination
has been opened as a pending seller; and the mobile-gate `<VERIFY>` above is still unanswered.
