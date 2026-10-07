# 08 — Calibration records

**Web source:** step definition `SellerOnboarding.tsx:238-244`; options `:75-79`;
save `:720-725`; advance `:986-995`
**Shell:** `AuthShell` + `AuthStepRail index={5} total={6}`
**Step 6 of 6.** The last question. Its button submits the whole flow.

## What it asks

*Do your items come with calibration records?* — *"You can attach certificates to each listing
later."*

| Value | Label | Sub-label |
|---|---|---|
| `most` | Yes, most items | Calibrated within the last 12 months |
| `some` | Some items | A mix of calibrated and as-is |
| `none` | No, sold as-is | Listed without calibration |

Same three-`OptionCard` layout as screens 03 and 07. The button reads **"Submit for review"**, not
Continue (web `:1084`).

## ⚠️ On web this answer is thrown away. Fix it here.

The save function is real:

```
saveCalibration → POST /user/onboarding-details { user_id, calibration }   // web :720-725
```

It is in the step-save table as `STEP_SAVES[4]` (web `:726`). It is **never called.** `advance()`
checks `if (idx === 5) { void finishOnboarding(); return; }` *before* reaching
`STEP_SAVES[idx - 1]` (web `:986-995`), and `idx === 5` is exactly this step. So the branch that
would save it is unreachable.

This is not a missing backend column — the column exists and works:

| Evidence | Where |
|---|---|
| Controller accepts and stores `calibration` | backend `controller/authV3.controller.js:1449` |
| Controller reads it back | backend `:1501` |
| Resume mode prefills from `od.calibration` | web `:395` |

So the web collects the answer, has somewhere to put it, reads it back on resume — and never
writes it. The resume prefill is therefore always empty.

Note also that the file's own header comment lists calibration among the fields that "genuinely
have nowhere to be saved", and the resume comment at `:370-372` repeats it. Both are wrong.
Three places in one file disagree; the controller settles it.

**Mobile must save before finishing.** Await `saveCalibration`, then run the completion sequence.
That is the single behavioural difference from web in this whole flow, and it is deliberate.

## What it saves

Two writes, in order:

1. `POST /user/onboarding-details` `{ user_id, calibration }` — the answer
2. the completion sequence — see [10-seller-done.md](10-seller-done.md)

If (1) fails: it is one optional-feeling answer against a finished signup. Do **not** block the
user — but do not pretend either. Log it and carry on; the flow has already taken enough of their
time to lose it at the last step.

## Mobile build notes

- Identical to 03 and 07. Three `OptionCard`s, required, Continue disabled until chosen.
- The button label changes to "Submit for review" and must show a pending state while the two
  writes run — the web shows "Submitting…" (web `:1084`). A tap that appears to do nothing while
  two sequential requests run is the most likely place a user double-taps.
- Guard against the double tap. Two completion sequences racing is worse here than anywhere else
  in the flow.

## Resume mode

Prefilled from `od.calibration` — which, on web, is always empty for the reason above. Once mobile
starts writing it, this becomes a real prefill. Resume **lands here by default** once everything
else is filled (web `:402`, `screenKey = "6"`), so for most returning sellers this is the first
screen they see.

## Acceptance

Answer chosen, then **read back from the stored row** — `GET /user/onboarding-details` returns the
value that was picked. Not the 200 from the POST: the stored artefact. This is the one finding in
the whole port that only shows up if you check the row, which is exactly why web shipped without
noticing.

---

## Progress

**2026-10-05 — BUILT as a UI mock**, and the web's data-loss bug is **not** reproduced.

The CTA label switches to "Submit for review" on the last step, derived from
`ob.index === ob.steps.length - 1` rather than a hardcoded index — so it stays correct if the
spine changes.

**The bare spinner is gone.** Submission renders the kit's **`Timeline`** with four named
phases — "Saved your answers → Checked your details → Creating your seller profile → Sending it
for review" — which is the design system's "named phases, never a bare spinner". `Timeline`
already existed; it was not built for this.

**Not done:** the phases advance on a `setTimeout` because there is no API. Wired for real,
each phase awaits its request, and the calibration value must be saved **before**
`finishOnboarding` — that is the specific web bug this file documents.

### The Platform Terms gate lives on this step

Added 2026-10-05, verified on-device (`_proof/device-07..09`). The web puts the seller terms on
its account screen, gating "Agree and continue"; that screen is blocked here (3.1.1), and this
step is the seller's real commitment point, so the gate moved rather than being dropped.
`Submit for review` requires **both** a calibration answer and acceptance — confirmed by
watching it stay disabled with only one of the two.

**The terms text was copied byte-identical**, not retyped: `content/sellerTerms.ts` from the
web's `src/features/auth/content/sellerTerms.ts` — 188 lines, 21 clauses, GIH Co., Ltd.
Platform Terms v1.0-condensed, `SELLER_TERMS_VERSION = "1.0-condensed"`. The file's own header
says the content/UI split exists "so legal can update the wording without touching the UI", so
paraphrasing a clause to fit a phone would break the point of it. `diff` verified identical.

**Full-screen sheet, not the web's inline panel.** Web renders the clauses in a 300px scroll
box inside the form — on a phone that is a scroll inside a scroll inside a keyboard-aware
scroll, and 21 clauses through a 300px window is unreadable. The row is the control; the text
gets the screen.

⚠️ **When this is wired, record `SELLER_TERMS_VERSION` with the acceptance.** The web posts
`legal-documents/accept`. A consent with no version against it is not evidence of anything.

**Two device-only bugs found and fixed while verifying, both silent:**
- A bare `<Modal>` is outside the app's SafeAreaView, so the title sat under the status clock
  and "I agree" was behind the gesture bar. The modal must ask for insets itself.
- **`PrimaryAction` uses RNGH's `Pressable` (`PrimaryAction.tsx:26`), so inside a `<Modal>`
  without its own `GestureHandlerRootView` the "I agree" button rendered perfectly and did
  nothing.** No error, no warning — the sheet just stayed open. `FORM_INPUT_RULES.md` §8 names
  this exact trap, and it still caught me because I guarded my own pressables and not the kit's.

---

## Progress — 2026-10-05, second pass

### The web's discarded-calibration bug is fixed in code

The "Not done" line above — *"the phases advance on a `setTimeout` because there is no API"* — is
now half out of date. The save exists, and it runs in the order this file demands:

```
saveStep('calibration', …)   →  POST /user/onboarding-details { calibration }
   ↓  only if it returned true
setSubmitPhase(0)            →  the completion sequence
```

`OnboardingFlow.tsx:336-345` is the branch, `useOnboardingApi.ts:206-210` is the call. So the
web's unreachable `STEP_SAVES[4]` is reachable here, which is the single deliberate behavioural
difference this whole port records.

**One departure from this file's advice.** It says a failed calibration save should not block —
"log it and carry on". The built code **does** block: `if (ok) setSubmitPhase(0)`, so a failure
keeps the user on this step with the message and a "Try again". That is stricter than this file
asked for, and it is a decision, not an oversight: if the answer is worth a step it is worth not
pretending. Revisit if it is ever observed failing on a real network.

**Nothing has been sent.** The write path is interlocked off — `EXPO_PUBLIC_ONBOARDING_API=1`
**and** an API URL containing `testapi.greenbidz.com`, both required
(`useOnboardingApi.ts:61-65`) — and no call has ever been made. The acceptance criterion at the
top of this file, *"read back from the stored row, not the 200 from the POST"*, is therefore
**completely unmet**. `completeOnboarding` (`sellerOnboarding.ts:209-218`) is written to do
exactly that read-back, and it has never run.

**The double-tap guard this file asks for exists:** the submit button carries
`disabled={!ob.canAdvance || api.saving}` and `loading={api.saving}` (`OnboardingFlow.tsx:332-334`),
so the control is dead while a write is in flight.

### What is still unverified

**The calibration step itself has never been walked on a device.** What *was* walked on hardware
is the terms gate that lives on this step — `_proof/device-07-terms-row.png`,
`device-08-terms-sheet.png`, `device-09-terms-gate-released.png` — which is why the two Modal
bugs above were found. The device session stopped there; the three `OptionCard`s, the
"Submit for review" label, the submitting `Timeline` and the outcome screen after it were seen in
Chrome only.

**`SELLER_TERMS_VERSION` is still not recorded with the acceptance.** `content/sellerTerms.ts`
exports it (188 lines, verified present), `mockState.ts:259-271` carries the warning, and nothing
writes it — there is no `legal-documents/accept` call in `useOnboardingApi.ts`. An acceptance with
no version against it is not evidence of anything, and that is now a gap in a write path that
otherwise exists.

**Step number unchanged:** step 6 of 6, the last entry in `SELLER_STEPS` (`mockState.ts:50-57`),
and the "Submit for review" label is still derived from `ob.index === ob.steps.length - 1`
(`OnboardingFlow.tsx:329`) rather than a hardcoded index.

## Progress — 2026-10-06: the soft gate and the submit are device-verified

On the Samsung SM-G781B, step 6 of 6, write path OFF.

The soft gate behaves as specified and **narrows as conditions are met**: with neither the answer
chosen nor the terms accepted, a blocked Submit reported *"Choose an answer, and accept the
Seller Platform Terms, to submit."*; after choosing "No, sold as-is" the same press reported
*"Please accept the Seller Platform Terms to submit."* Ticking the checkbox fills it solid green
with a tick and clears the gate (`_proof/device-10-calibration-terms-accepted.png` — the radio
selected, the checkbox ticked, the three-part consent sentence with "Platform Terms & Conditions"
as the only link, and an enabled "Submit for review").

Submit then runs the four-stage timeline and reaches the in-review screen; both are recorded in
`10-seller-done.md` with their captures.

**The version gap above is unchanged by this walk.** `SELLER_TERMS_VERSION` is still recorded
nowhere — the acceptance that was just proven on a handset would, with the write path on, be
stored as a bare boolean.
