# 03 — Reseller or company

**Web source:** `SellerOnboarding.tsx:949-971` (`screen === "1"`, the only hand-written step)
**Shell:** `AuthShell` + `AuthStepRail index={0} total={6}`
**Step 1 of 6.** Sellers only — buyers never reach it.

## What it asks

*Are you a reseller, or selling for your own company?* Two options, one choice, required.

| Value | Label | Sub-label |
|---|---|---|
| `reseller` | Reseller | I sell on a regular basis |
| `company` | Company | Selling for my own company |

## Why it is first

It is not just a demographic — **it rewrites the next three screens** (web `buildSteps`, `:204-246`):

| Downstream | `reseller` | `company` |
|---|---|---|
| Screen 04 heading | "Tell us about your business" | "Tell us about your company" |
| 04 first field | Business name | Company name |
| 04 fourth field | Years in business (numeric, 2 digits) | Your job title (text, ≤80) |
| 07 question | "How many items do you usually have for sale?" | "How much equipment are you selling?" |
| 07 options | Under 25 / 25–100 / 100+ items | Just a few / a lab clear-out / ongoing surplus |

So nothing after this can be built until it is answered, and changing it later must re-derive the
later screens rather than keep stale copy.

## What it saves

`POST /user/onboarding-details` with `{ user_id, seller_type, marketing_opt_in }` (web `:677-684`).

**This is the only place the marketing opt-in is ever sent** — and only for sellers. The buyer path
never posts it at all, so a buyer's consent choice is collected on screen 02 and silently dropped.
Mobile should either send it on the buyer path too or stop showing buyers the checkbox. Showing a
default-on consent toggle and then discarding it is the worst of the three options.

The save is deliberately non-blocking — it swallows errors so a hiccup cannot strand someone on an
account that already exists (web `:683`). Keep that, but see screen 10 for where swallowing is
*not* acceptable.

## Mobile build notes

- Two `OptionCard`s in a column. This is the canonical `OptionCard` case: label, description,
  selected state, one of two.
- Continue disabled until one is chosen (`disabled={!sellerType || isSaving}`).
- Back from here goes to screen 02 on a fresh signup, but **must not** in resume mode — there is no
  account screen to return to. The web routes it through `backFromStepOne` (`:512`), which exits to
  a workspace or the marketplace instead. Mirror that.
- The rail says "Step 1 of 6". Note the wizard has seven screens if you count role-choice, which is
  deliberately not numbered. Keep the numbering as-is so mobile and web agree.

## Resume mode

Prefilled from `od.sellerType` when it is `reseller` or `company`, otherwise blank (web `:388`).
If blank, resume opens *here* — it is the first incomplete step by definition, because everything
after it depends on the answer.

## Acceptance

Both options selectable, Continue blocked until one is. The value survives to screen 04 and visibly
changes its heading and fourth field. Re-entering with `?resume=1` shows the saved choice already
selected.

---

## Progress

**2026-10-05 — BUILT as a UI mock.** `src/features/v2/onboarding/OnboardingFlow.tsx`,
case `'sellerType'`. Reachable in dev only at `/(auth)/onboarding-mock`.

| What | How |
|---|---|
| Both options | `OptionCard` from the kit — already `accessibilityRole="radio"` with `selected` |
| Continue gating | `canAdvance` in `mockState.ts`; disabled until one is chosen |
| Back from step 1 | `ob.back()` returns false at index 0, so the caller leaves the flow |
| "This changes what we ask next" | kept as the subtitle — the answer rewrites the volume step |

**Not done:** no save. `POST /user/onboarding-details` is not called — mock only, by
instruction. The marketing opt-in that web piggybacks on this save does not exist here yet.

---

## Progress — 2026-10-05, second pass

**"No save" is now out of date — but nothing is being sent.** The call is written:
`saveStep('sellerType', …)` posts `/user/onboarding-details` with `{ seller_type }`
(`src/features/v2/onboarding/useOnboardingApi.ts:169-173`), and the step only advances if it
returns true (`OnboardingFlow.tsx:169-176`). It is interlocked off — `isOnboardingApiLive()`
(`useOnboardingApi.ts:61-65`) needs `EXPO_PUBLIC_ONBOARDING_API=1` **and** an API URL containing
`testapi.greenbidz.com`, and when off every call returns `true` immediately so the flow behaves as
the pure mock. **No request has ever been made.** Details and a second, accidental lock in
`00-introduction.md` § "The API layer exists, and has never made a call".

**One deliberate difference from web.** This file notes the web makes the save non-blocking and
swallows errors. Here it blocks: a failed save holds the user on the step and shows the message
with a "Try again" control (`OnboardingFlow.tsx:369-376`). The reasoning for not advancing past a
write that did not happen is in `useOnboardingApi.ts:146-153`.

**The marketing opt-in is still not collected and still not sent**, on either path. The concern
raised above — that showing a default-on consent toggle and discarding it is the worst of the
three options — is sidestepped rather than answered: there is no toggle, so nothing is shown and
nothing is dropped. It remains a gap against web parity.

**This step is now step 1 of 6, and the rail says so.** `total={ob.steps.length}` with
`SELLER_STEPS` at six entries (`mockState.ts:50-57`) — this file's "Step 1 of 6" heading is
correct as written. The screen it backs out to has changed: `ob.back()` returns false at index 0
and the caller leaves the flow (`OnboardingFlow.tsx:326-328`), which now means the account screen
exists behind it but is not returned to with its values intact.

**Walked on a device**, selection and gating confirmed. The downstream claim this file makes —
that the answer visibly rewrites screens 04 and 07 — is proven for 04 on the device
(`_proof/device-05-current.png` shows the *company* heading and "Your job title"); **07 was
verified in the browser only.**
