# authv2 — the seller onboarding wizard, ported to mobile

Mobile parity with the web `/auth2` flow. One file per screen in this folder.

## What this is

The web team replaced the single-page `/auth` signup with a wizard: pick a side, create the
account, then six steps that each save as you finish them. It is live on `101lab.co`. This folder
plans the same flow in `GreenBridgeApp`.

**Decided (2026-10-05, owner):**

| Question | Answer |
|---|---|
| How much of the wizard on a phone? | **Full parity** — all six steps plus the role-choice screen |
| What happens to `app/(auth)/register.tsx`? | **Replaced.** One signup path, not two |
| The unauthenticated backend endpoints | **Left as they are** — already deployed. Recorded below, not fixed |

## Where the web version lives

Repo `101lab-2`, merged into `101lab-main`. Checked out today at
`C:/tmp/lab-prod-merge` on branch `merge/prod-restore-1005` — **a worktree, not a fixed path**;
run `git worktree list` rather than trusting that location later.

| Thing | File |
|---|---|
| The whole flow (1137 lines) | `src/features/auth/pages/SellerOnboarding.tsx` |
| Route wrapper | `app/auth2/page.tsx` |
| Dashboard gate | `src/shared/components/layouts/SellerOnboardingGuard.tsx` |
| Dashboard banner | `src/shared/components/common/SellerOnboardingBanner.tsx` |
| Seller T&C copy | `src/features/auth/content/sellerTerms.ts` |

**None of that code ports.** It is React DOM — Radix, Tailwind class strings, `react-router`,
`react-phone-number-input`. What ports is the *flow*: the order of the questions, the validation
rules, and which endpoint each answer lands in. Every screen file below records those three things
and nothing else from the web source.

## The screens

| # | File | Web source | Mobile screen |
|---|---|---|---|
| 01 | [01-choose-role.md](01-choose-role.md) | `:756-790` | role choice |
| 02 | [02-account.md](02-account.md) | `:824-945` | email, name, phone, password, terms |
| 03 | [03-seller-type.md](03-seller-type.md) | `:949-971` | reseller or company |
| 04 | [04-business-details.md](04-business-details.md) | `:207-218` | name, website, tax ID, role, phone |
| 05 | [05-location.md](05-location.md) | `:219-230` | street, city, postal, region, country |
| 06 | [06-categories.md](06-categories.md) | `:231` | equipment category chips |
| 07 | [07-volume.md](07-volume.md) | `:232-237` | how much they sell |
| 08 | [08-calibration.md](08-calibration.md) | `:238-244` | calibration records |
| 09 | [09-buyer-done.md](09-buyer-done.md) | `:1091-1110` | buyer confirmation |
| 10 | [10-seller-done.md](10-seller-done.md) | `:1112-1126` | seller confirmation |

Line numbers are into `SellerOnboarding.tsx` as read on 2026-10-05. They will drift; the section
names in each file are the durable reference.

## Three entry modes, not one

The same screens serve three different arrivals. Each screen file says how it differs per mode.

**Fresh signup** — `/auth2`. Lands on 01, walks 01 → 10.

**Team invite** — `?ref=CODE`. The web validates the code, and if the invitee is new it skips 01,
opens 02 as a short "Join {company}" form with the email fixed and no terms box, and on success
drops the member straight into the owner's workspace — **no wizard at all** (web `:311-337`,
`:562-579`). If the invitee already has an account it redirects to sign-in instead.

**Resume** — `?resume=1` (from the dashboard banner or the gate) and `?upgrade=1` (from
`/become-seller`). Skips 01 and 02 entirely, reads back what was already saved, and opens at the
first incomplete step (web `:350-415`). Requires an existing session.

## What each step writes

Three endpoints, all on backend `origin/main` (prod). Verified present, not assumed:

| Endpoint | Registered | Used by |
|---|---|---|
| `POST /user/signup-with-link-v2` | `routes/userRoutes.js:98` | screen 02 |
| `POST /user/onboarding-details` | `routes/userRoutes.js:101` | 03, 07, 08, completion flag |
| `GET /user/onboarding-details` | `routes/userRoutes.js:102` | resume mode, dashboard gate |
| `PUT /user/settings` | existing, already used by the app | 04, 05, 06 |

Controllers: `controller/authV3.controller.js:1449` (save) and `:1501` (read).

## ⚠️ Both onboarding endpoints are unauthenticated

Neither route carries `protect` or any guard, and both controllers take the identity straight from
the request — `user_id` in the POST body, `userId` in the GET query. There is no ownership check
anywhere in either function.

So any caller can read or overwrite any user's company name, tax ID and address, and can set
`onboarding_completed: true` — the exact flag `SellerOnboardingGuard` trusts to decide whether a
seller is vetted enough to see their dashboard.

This is the same class [`../SECURITY-WISHLIST.md`](../SECURITY-WISHLIST.md) documents, and it sits
precisely in that file's stated blind spot: its count covers routes with an identity in the **path**
and explicitly excludes "routes that take an identity as a query string, in a body, or under a
different name". These take it in both.

**The owner's decision is to leave it: it is already deployed, and this port does not make it
worse.** Recorded here so the next person does not rediscover it, and so that the line in
`SECURITY-WISHLIST.md` saying this UI "must not call" such a route is not quietly contradicted
without anyone noticing. It needs an entry in [`../DECISIONS.md`](../DECISIONS.md).

## Two web defects we must not reproduce

Found while reviewing the web source. Both are in `/auth2` today.

**The calibration answer is discarded.** `saveCalibration` exists (web `:720-725`) and the backend
column is real — `authV3.controller.js:1449` accepts `calibration` and `:1501` reads it back. But
the step handler calls `finishOnboarding()` and returns *before* reaching the save for that step
(web `:986-995`), so `STEP_SAVES[4]` is never invoked. Screen 08 on mobile must save before
finishing. See [08-calibration.md](08-calibration.md).

**A failed completion flag traps the seller in a loop.** `finishOnboarding` posts
`onboarding_completed: true` inside a `try/catch` that swallows the error, then redirects anyway
(web `:728-745`). The gate sends anyone still marked incomplete back to `?resume=1`, which reopens
at the last step, whose button calls `finishOnboarding` again. One failed request and the seller can
never reach their dashboard, with nothing on screen explaining why. Mobile must surface the failure
and offer a retry. See [10-seller-done.md](10-seller-done.md).

Neither is ours to fix on web unless asked — but neither should be copied.

## What mobile already has

This is assembly, not new construction.

| Piece | Where | Note |
|---|---|---|
| `AuthShell` | `src/features/v2/auth/AuthShell.tsx` | Props: `mode`, `title?`, `subtitle?`, `eyebrow?`, `segmented?`, `email?`, `leading?`, `footer?`, `footerQuiet?`, `children`, `testID?` |
| `AuthStepRail` | `src/features/v2/auth/AuthStepRail.tsx` | `{ index, total }`; renders the count in words *and* a `ProgressLine` |
| A working 3-step wizard on both | `app/(auth)/forgot-password.tsx` | **The pattern to copy.** Already does multi-step inside `AuthShell` |
| The screen being replaced | `app/(auth)/register.tsx` (557 lines) | Already on `AuthShell`, `mode="signup"` |
| v2 kit | `src/features/v2/ui/` | `OptionCard`, `Chip`, `Field`, `PickerRow`, `ProgressLine`, `Stepper`, `SegmentedControl`, `PrimaryAction`, `QuietAction`, `Screen`, `OtpField` |
| Translation | `src/i18n/v2Auto.ts` — `useV2Copy()` | The kit's `Text` intercepts automatically; `TextInput` placeholders need the hook |

`AuthStepRail` reads `mobile.auth.register.stepOf` with `{ current, total }`, so the rail already
speaks six languages. It was built for 2- and 3-step wizards; **`<VERIFY>` it renders sensibly at
`total={7}`** before building on it.

## Non-negotiables for this work

- **`UI_SOURCING_RULES.md`** — search before writing any component. Most of these screens are
  `OptionCard` lists and `Field` stacks that already exist.
- **`FORM_INPUT_RULES.md`** — every screen here is a form. Labels above fields (the web uses
  placeholders as labels on screen 02 — do not copy that), autofill tokens, never block paste,
  validate on blur, and the sticky-footer-vs-keyboard collision measured with `onLayout`, never
  hardcoded.
- **Six languages.** The web flow has **zero** i18n — every string is a hardcoded English literal,
  and it posts `lang: "en"` regardless of the user's language (web `:539`). Mobile must not ship
  that. Copy goes through the dictionary from day one, and the signup call sends the real language.
- **`../TRAPS.md`** before touching the device.

## Acceptance for the whole flow

Not "it builds". A seller account created on a real handset, in a non-English language, walking
01 → 10 without leaving the app, whose answers are then visible on the web dashboard — and a
`?resume=1` re-entry that opens at the right step with the fields already filled.

Proof goes in `_proof/` beside this file, and the route list goes in
`src/__tests__/v2Inventory.test.ts`, not in prose here — see [`../README.md`](../README.md).

---

## Progress — 2026-10-05

**A working UI mock of the shippable subset is running.** Branch
`feat/authv2-onboarding-mock`. Dev-only route `/(auth)/onboarding-mock`;
`src/features/v2/onboarding/{mockState.ts,OnboardingFlow.tsx}`.

### ⚠️ The plan above is blocked, and the build reflects that

App Review rejected this app **twice** under **Guideline 3.1.1** for collecting business
identity in-app — company name, tax number, business type, registration certificate.
`app/(lab)/sell/apply.tsx:12-48` carries the verbatim rejection and a ⛔⛔ "DO NOT PUT IT BACK"
block; `app/(auth)/register.tsx:13-17` explains that signup is deliberately three fields for
the same reason. **Those two files were not read before this plan was written.** Apple said
*remove*, not *move*, and Guideline 2.3.1 rules out a feature flag.

So screens **02 (account), 04 (business details) and 05 (location) are NOT built**, and the
decision recorded above — "replace `register.tsx`" — is void until someone answers whether
business identity can be collected in the app at all.

Logged in `MISTAKES.md` (2026-10-05) with memories
`project_mobile_signup_31_1_constraint` and `feedback_read_what_you_would_replace`.

### Built and walked in a browser

| Screen | State |
|---|---|
| Role choice | BUILT — one select + one CTA, replacing web's two competing primaries |
| 03 seller type | BUILT, interaction verified |
| 06 categories | BUILT, renders; **tap not verifiable on web** (see below) |
| 07 volume | BUILT, interaction verified, copy switches with seller type |
| 08 calibration | BUILT, CTA becomes "Submit for review" |
| 09/10 outcomes | BUILT as one outcome screen, forks on role |
| 02 / 04 / 05 | NOT BUILT — 3.1.1 |

Proof: `_proof/build-0*.png`, Chrome at 390×844, `localhost:8081/onboarding-mock`.

**The spine is derived and it shows.** The rail reads **"STEP 1 OF 4"** — four steps, because
four render. Not a hardcoded 5 or 6.

### Verified by pressing the control, not by looking

- Role choice → Continue disabled until a role is picked, then enabled.
- Seller type → selecting fills the radio and enables Continue.
- **Choosing "Company" produced the company volume question and its three options**, not the
  reseller set — the copy rebuilds from `sellerType` rather than being captured once.
- Last step's CTA reads "Submit for review", derived from `index === steps.length - 1`.
- Outcome screen renders with the `Timeline` and two actions.

### Three findings from the browser run

**1. `PillButton` does not respond on react-native-web.** The categories step renders and
announces each option as `checkbox`, but no tap registers — neither a CDP click nor a full
synthetic `pointerdown`/`pointerup`/`click` sequence — and `aria-checked` is absent even
though the component sets `accessibilityState` correctly. The difference from the working
screens is the import: `OptionCard` uses `Pressable` from `react-native`, `PillButton` uses
`Pressable` from `react-native-gesture-handler` (`PillButton.tsx:34`, chosen deliberately for
a native reason). `GestureHandlerRootView` *is* mounted at `app/_layout.tsx:327`.
**This is very likely a web-harness limitation, not a device bug — `PillButton` ships in the
app today. It is NOT confirmed broken on device, and must be checked there before anyone
"fixes" it.** Swapping it to RN's `Pressable` would break the native case its comment
documents.

**2. ~~The app renders DARK and forcing light does not change it.~~ CORRECTED — it does.**
The first run came up dark because the colour-scheme emulation was applied *after* the page
had loaded. On a fresh load with `prefers-color-scheme: light` the whole flow renders light,
matching the Stitch mockups (`_proof/build-06-buyer-done-light.png` vs the dark
`build-0{1..5}.png`). **Both schemes therefore render and both need checking** — the UX
checklist asks for light and dark, and only dark has been walked end to end.

**3. The MCP click tool reports a timeout and the click lands anyway.** Every
`click` returned "element did not become interactive"; the screenshots show the flow
advancing. A failure message from that tool is not evidence of a failed interaction here —
screenshot after every click.

### Not done

No API anywhere, by instruction. No i18n — every string is a hardcoded English literal, which
is the exact fault this port exists to avoid repeating; the dictionary pass comes before any
device sign-off. No loading, error or permission states. No dark/light audit. The submitting
`Timeline` was not captured on camera — the flow passed through it in ~4s and the screenshot
landed on the outcome.

---

## Progress — 2026-10-05, second pass

**Business details and location are now built**, behind the same `__DEV__` route, at the
owner's instruction to complete the remaining screens. The 3.1.1 constraint is unchanged and
is restated in each of those two files: they must not be wired into a shipped flow until
someone answers whether the app may collect business identity at all. `__DEV__` is not a
feature flag — the branch does not exist in a release bundle — so it is not the thing
Guideline 2.3.1 forbids.

**The spine grew by itself.** The rail now reads **"STEP 2 OF 6"**; nothing was edited to make
that happen, because the count is `steps.length`.

**Still not built: `02-account.md`.** Mobile already has a working three-field signup with a
6-digit OTP (`app/(auth)/register.tsx`, `useRegistration.ts`), and replacing it is the
decision that is void until the iOS question is settled.

### ⚠️ Typed text does not render in ANY text field on web

Values reach React state, validation fires, error messages and `danger` borders draw
correctly — but the characters never paint in the input. `getComputedStyle` reports the right
colour (`#10221B`) on a pale field, the element is visible and correctly sized, and
`input.value` holds the text.

**It is not this feature's bug.** The shipped `app/(auth)/login.tsx` email field does exactly
the same thing: `_proof/build-09-login-same-bug.png`. It is `Field` on react-native-web,
app-wide, and it predates this work.

**Consequence for how this gets verified:** the browser can confirm layout, state, validation,
error copy, gating and navigation — all of which it did. It **cannot** confirm anything about
typing. Every text field in this flow needs a device before it is called done.

---

## Progress — 2026-10-05, on a real device

Samsung SM-G781B over USB, dev client 1.0.3 (DEBUGGABLE) attached to local Metro via
`adb reverse tcp:8081 tcp:8081`. Opened with `greenbridge://onboarding-mock`.
Proof: `_proof/device-0*.png`.

### A real bug the browser hid

**Selecting "I'm a seller" jumped straight into the wizard** — the role screen's own Continue
was dead for sellers and live for buyers. Cause: the render guard keyed off `steps.length`,
which becomes non-empty the moment a seller is *selected*, not when the choice is *confirmed*.
Fixed with an explicit `roleConfirmed` flag; re-tested on the device, selection now holds and
Continue is what advances.

**Why the browser missed it:** on web my next click after selecting was Continue anyway, so
the screen advanced and I credited the button. The bug and the expected behaviour look
identical unless you tap only once.

### The web text bug is WEB-ONLY — resolved

Placeholders render, typed text renders, the caret shows: `_proof/device-04-typing-keyboard.png`
shows "Quippy Instruments" in the field. So `Field` is fine on device, and the earlier finding
(invisible input text, including on the shipped login screen) is a react-native-web problem
only. It still makes the browser useless for verifying anything typed.

### Keyboard behaviour passes on device

With the keyboard up, `AuthShell` collapses the hero as designed, the focused field is fully
visible with clear space beneath, and the sticky Continue sits above the keyboard without
covering it. That is the `FORM_INPUT_RULES.md` §4 collision test, passing on real hardware.

⚠️ **But the focused field's own label scrolls off.** "BUSINESS NAME" is gone while typing in
that field, while the *next* field's label is visible. `FORM_INPUT_RULES.md` requires a label
above the field; a focused field with no visible label is the weaker half of the same rule.
Not fixed.

### Still unverified on device

Categories (`PillButton` tap — the web failure that may or may not be real), volume,
calibration, the submit `Timeline`, and the outcome screens. Only the first two steps and the
typing path were walked here.

---

## Progress — 2026-10-05, third pass: the account screen and the API layer

Two things changed since the entries above, and both contradict claims made in them.

### 1. The account screen is BUILT, and was never 3.1.1 blocked

The second-pass entry above says *"screens 02 (account), 04 (business details) and 05 (location)
are NOT built"*, and `02-account.md` carried a "NOT BUILT. Blocked on App Review Guideline 3.1.1"
header. **For screen 02 that was wrong, and it was a reading error, not a code one.**

Guideline 3.1.1 named four things: company name, tax / business-registration number, business type,
and the registration-certificate upload (quoted verbatim at `app/(lab)/sell/apply.tsx:14-21`). The
account screen asks for **email, full name, phone, password, confirm password** —
`ACCOUNT_FIELDS`, `src/features/v2/onboarding/mockState.ts:141` — and none of the four. That is the
same shape as `app/(auth)/register.tsx`, which is the shape App Review **accepted**. A
personal-account signup is not a business registration.

The entry above generalised "this wizard contains a 3.1.1 problem" into "every screen in it does".
The 3.1.1-sensitive screens are **04 and 05 only**, and both of those files keep their warnings
unchanged. Full correction in `02-account.md`.

Built as `AccountStep`, `OnboardingFlow.tsx:615`, reached from the `roleConfirmed &&
!accountCreated` guard at `:295`.

### 2. The step count is SIX, and the flow has eight screens

`SELLER_STEPS` (`mockState.ts:50-57`) holds six keys — `sellerType`, `business`, `location`,
`categories`, `volume`, `calibration` — and the rail renders `total={ob.steps.length}`
(`OnboardingFlow.tsx:325`). Confirmed on the device: `_proof/device-05-current.png` reads
**"STEP 2 OF 6"** over the business form.

Several entries above still quote the earlier derived counts (the first pass's "STEP 1 OF 4", when
only four steps had been written). Those were true when written and are now stale: the number is
derived, so it moves when the spine does, which is the whole point of deriving it.

What a seller actually sees, end to end, is **eight** screens: role choice → account → the six
numbered steps → the outcome. Only the six are numbered, matching web.

⚠️ **A buyer currently sees two: role choice → the outcome.** The role screen's Continue calls
`ob.setDone(true)` for a buyer without confirming the role (`OnboardingFlow.tsx:316-318`), and the
account screen's own guard is `roleConfirmed && !accountCreated` (`:295`) — so a buyer never
reaches it, and **no buyer account is ever created**. Two pieces of code written for that path are
consequently dead: the buyer branch of `onCreated` (`:303`) and the `BUYER ACCOUNT` eyebrow
(`:657`). `steps` being empty for a buyer (`mockState.ts:277-280`) is correct and separate — a
buyer has no wizard, but they do need the account screen. Not fixed; recorded so it is not read as
intentional.

### 3. The API layer exists, and has never made a call

New since the entries above:

| File | What it is |
|---|---|
| `src/services/onboarding/sellerOnboarding.ts` | the transport — `signupSellerV2`, `saveOnboardingDetails`, `fetchOnboardingDetails`, `completeOnboarding` |
| `src/features/v2/onboarding/useOnboardingApi.ts` | the per-step write path the flow calls |

So the "no API anywhere, by instruction" line in the first-pass entry is superseded: the code is
written. **It is also interlocked off, and no request has ever been sent from it.**

`isOnboardingApiLive()` (`useOnboardingApi.ts:61-65`) requires **both**:

1. `EXPO_PUBLIC_ONBOARDING_API === '1'`, and
2. the API URL to contain `testapi.greenbidz.com` — the dev backend.

Both must hold, so flipping the flag while the app still points at prod does nothing. Every entry
point opens with `if (!isOnboardingApiLive()) return true;` — `createAccount` (`:108`), `saveStep`
(`:156`), `finish` (`:225`) — and returning `true` means the UI advances exactly as the pure mock
did. The reason for the interlock is in the file header (`:1-42`) and again at
`sellerOnboarding.ts:8-16`: `signupSellerV2` creates a **real user row**, and the app's `.env`
points at prod (`api.101recycle.greenbidz.com`, DB `greenbidz`), which CLAUDE.md § "dev/staging
first" forbids without an explicit go.

⚠️ **There is a second, unintended lock.** Condition 2 reads `process.env.GREENBIDZ_API_URL`
(`useOnboardingApi.ts:63`), but nothing in this app supplies that name through `process.env` — the
API URL is read everywhere else from `Constants.expoConfig.extra.GREENBIDZ_API_URL`
(`src/lib/env.ts:9`, `src/api/greenbidzClient.ts:19`). So the check reads `undefined`, `.includes`
returns false, and the write path is inert **even with the flag set and the env pointed at dev**.
Left as found: it fails closed, and the fix belongs in the same change that first authorises a real
call. Nobody should read "the flag is on" as "requests are going out" until this line is corrected
and a request is observed.

### 4. What each step now writes, when it is eventually switched on

Matches the endpoint table above. Mapped in `saveStep` (`useOnboardingApi.ts:168-211`):

| Step | Call |
|---|---|
| account | `POST /user/signup-with-link-v2` → `userId`, then `establishSessionAfterSignup` if a token came back |
| sellerType | `POST /user/onboarding-details` `{ seller_type }` |
| business | `PUT /user/settings` `{ company, companyTaxIdNumber }` **then** `POST /user/onboarding-details` `{ website, biz_role, biz_phone }` — both awaited, unlike web's fire-and-forget second call |
| location | `PUT /user/settings` `{ address }`, with `region` → `district` on the wire (`:190-193`) |
| categories | `PUT /user/settings` `{ interests }` |
| volume | `POST /user/onboarding-details` `{ monthly_volume }` |
| calibration | `POST /user/onboarding-details` `{ calibration }` — **the save web never reaches** |
| finish | `completeOnboarding` — POST the flag, then `GET` it back and throw if it did not stick (`sellerOnboarding.ts:209-218`) |

Both web defects this file lists under "Two web defects we must not reproduce" are avoided in the
written code: calibration saves before the completion sequence (`OnboardingFlow.tsx:338-345`), and
the completion flag is awaited with its failure dropping the user back to the last step rather than
redirecting (`:183-203`). **Neither has been exercised against a server.**

### 5. Verification status, honestly

Walked on the device: **role choice, account (in full — validation and the focus chain included),
seller type, business.**

Not walked on a device: **location, categories, volume, the submitting timeline, the outcome
screens.** Categories is specifically **UNKNOWN** — `PillButton` did not respond under
react-native-web (finding 1 in the first-pass entry) and has never been retried on a handset. Until
it is, "categories is built" means it renders, not that it can be used.

Nothing in the API layer has been verified at all, because nothing has called it.

## Progress — 2026-10-06: both paths walked end to end on hardware

Samsung SM-G781B, dev client, `greenbridge://onboarding-mock`, write path OFF
(`EXPO_PUBLIC_ONBOARDING_API=0`).

**Seller, finished.** The device session that stopped at the terms sheet was resumed: the terms
checkbox ticks (`_proof/device-10-calibration-terms-accepted.png`), Submit runs the four-stage
timeline — *Saved your answers · Checked your details · Creating your seller profile · Sending it
for review*, "Step 4 of 4", CTA reading "Submitting…"
(`_proof/device-11-submitting-timeline.png`) — and lands on *"Your seller profile is in review."*
with its three-row what-happens-next list and both CTAs
(`_proof/device-12-seller-done.png`).

**Buyer, walked for the first time.** The buyer-skips-the-account-screen defect recorded in
`09-buyer-done.md` is confirmed **fixed on hardware**: selecting "I'm a buyer" and pressing
Continue now opens the account screen with its buyer face — eyebrow `BUYER ACCOUNT`, title
*"Welcome to 101LAB!"*, CTA *"Agree and start buying"*, and the plain Terms-of-Use sentence
instead of the seller terms checkbox (`_proof/device-14-buyer-account.png`). With all five fields
valid the CTA enables and does not collide with the last field
(`_proof/device-15-buyer-account-valid.png`); pressing it goes straight to *"You're all set to
buy."* with **no wizard steps in between** (`_proof/device-16-buyer-done.png`).

**Scaffolding removed.** The five `TEMP-VERIFY` seeds in `mockState.ts` that skipped the flow
forward to the categories step are reverted to `null / false / false / null / 0`; `grep -n
"TEMP-VERIFY"` across the app returns nothing, and the app now opens on the role screen with
neither option selected and Continue disabled (`_proof/device-13-role-clean-start.png`).
356 tests pass across `src/features/v2/onboarding` and `src/i18n/__tests__`.

### What remains unverified

Only the **location** step has still never been rendered on a handset — every other screen in the
spine now has a device capture. The API layer is still unexercised: `EXPO_PUBLIC_ONBOARDING_API`
has never been switched to `1` against `testapi.greenbidz.com`, which needs a dev login the device
does not have. Both outcome screens' CTAs still call `ob.reset()`, so neither destination has been
checked.

## Progress — 2026-10-06, second pass: a privilege hole in the sell gate, found and closed

Switching the write path on exposed a defect that had nothing to do with the UI, and it is the
reason the integration should not have been enabled without this read.

### The hole

Three facts that are individually reasonable and jointly wrong:

1. `signup-with-link-v2` writes `greenbidz_user_type = role` and `pw_user_status = 'pending'` in
   the SAME meta insert — `origin/dev controller/authV3.controller.js:1157-1158`.
2. `getUserUpgradeStatus` has no `SellerUpgradeRequest` row to read for a brand-new account, so it
   falls through to its derived branch and answers a hardcoded
   `{ status: 'approved', source: 'existing_seller' }` for anyone whose `greenbidz_user_type` is
   `seller`. It never reads `pw_user_status` — `origin/dev services/sellerUpgradeService.js:391-412`.
3. Mobile's publish gate is `canSubmitListing()`, and its only input was
   `status?.status === 'approved'` from that endpoint.

So a seller created by this onboarding was **derived-approved from the moment the account
existed**, and could have published a listing straight past admin review. The web never had this
hole because its gate reads `pw_user_status` directly, which is why comparing the two flows did
not surface it.

That derived branch was safe until now: the only way to hold `greenbidz_user_type = seller`
without an upgrade row used to be to predate the upgrade flow — i.e. to be an already-approved
legacy seller. This flow is the first thing that mints that meta for an unreviewed account.

### The fix (app-side, by design)

The backend is left alone — the onboarding endpoints are deployed and owned elsewhere, and
changing `getUserUpgradeStatus` would reach the web, the admin SPA and every other client. The
change is in the app:

- `services/seller/sellerUpgrade.ts` now carries the server's `source` field through instead of
  dropping it, normalising anything unrecognised to `null`.
- `features/seller/sellerSubmitGate.ts` — a **reviewed** approval still stands on its own, because
  an admin approving an upgrade does not necessarily flip `pw_user_status` and making the check
  unconditional would lock out every properly approved seller. A **derived** approval now
  additionally requires the account not to be pending.

### Tests

`src/features/seller/__tests__/` — four new gate cases (derived + pending blocked; reviewed +
pending still allowed; the same derived seller allowed once no longer pending; derived
pending/rejected blocked regardless of session) and two parser cases. The parser cases matter on
their own: the gate's tests seed the query cache directly, so they would all keep passing if the
`source` field were dropped again — which is how it came to be missing in the first place.

51 tests pass across `src/features/seller` + `src/services/seller`, `npx tsc --noEmit` is clean,
and the full suite is 1895 passing with one pre-existing unrelated failure
(`features/v2/scan/__tests__/valuationView.test.ts`, a source-grep topology test in a directory
this change does not touch).

### Still open

The fix is proven by test, **not yet on a device** — `EXPO_PUBLIC_ONBOARDING_API` has just been
set to `1` and the first real run against dev has not happened yet.

## Progress — 2026-10-06, third pass: the write path fires for the first time

Two further defects, both found only by arming the path and driving it on hardware.

### 1. The interlock could never open

`isOnboardingApiLive()` read `process.env.GREENBIDZ_API_URL`. Expo inlines only `EXPO_PUBLIC_*`;
every other `.env` key reaches the app through `app.config.ts` → `expoConfig.extra`, which is why
all its other consumers go via `getGreenbidzApiUrl()` (`src/lib/env.ts:8`). On a device the value
was `undefined`, the check was `''.includes('testapi…')`, and the function returned **false for
every possible configuration**. The whole write path was dead while appearing armed.

Nothing in the UI could reveal this: an inert write returns `true`, so the wizard advances exactly
as it would on success. The 2026-10-06 second-pass walk reached "Your seller profile is in review"
having written nothing at all.

Found by re-POSTing the signup the app had supposedly just made and watching the server create the
account **for the first time** — `{"success":true,"userId":1199}` where a duplicate was expected.

Fixed to read `getGreenbidzApiUrl()`. New test `__tests__/onboardingApiLive.test.ts` asserts the
**open** case with the config the app actually ships, which is the case the broken version could
never reach; it was confirmed to fail (3 of 10) against the old implementation before being kept.
Note that all seven "stays closed" cases passed on the broken version — closed-only tests would
never have caught this.

### 2. Creating the account ejected the seller from the wizard

With the path genuinely live, pressing "Agree and continue" created the account, established the
session — and landed on **"What are you selling today?"**. `app/_layout.tsx` replaces the route
with `homeRoute()` the moment `profile` becomes truthy while inside `(auth)`, and
`onboarding-mock` lives there. The seller was thrown out at step 1 of 6 before answering anything,
so no `saveStep` ever ran. Fixed by exempting the onboarding route, alongside the existing
`hasPendingV2Return()` escape hatch; `npx tsc --noEmit` clean.

### What is proven, and what is not

**Proven on hardware:** the app creates a real account on dev. `mobilewalk1006b@example.com` was
created by the app, and a re-POST answers `"Email already registered"`.

**Not yet proven:** the per-step writes. The routing fix is implemented and type-checks, but the
confirming walk was interrupted twice by dev-client reloads, so **no `saveStep` call has been
observed succeeding end to end**. The next run should finish the wizard and then
`GET /user/onboarding-details?user_id=<id>` to assert the stored row.

### Dev data created by this session

`greenbidz_test` now holds four throwaway sellers that should be cleaned up: **1199**
(`…1006a`, my probe), **1200** (`…1006b`, created by the app — the proof), **1201** (`…1006c`) and
**1202** (`…1006d`), the last two created by the enumeration probe that confirmed which walks had
actually reached the server.

## Progress — 2026-10-06, fourth pass: the mobile-created account, seen on the web

The account the app created (`mobilewalk1006b@example.com`, **userId 1200**) was signed in on
`https://staging-lab.greenbidz.com` — which targets the same dev backend — to compare surfaces.
Session read back from `localStorage`: `userRole=seller`, `accountStatus=pending`, `userId=1200`.

The two surfaces agree on the DATA and diverge on almost everything around it.

### What the web does that mobile does not

1. **It RESUMES.** Signing in redirected to `/auth2?resume=1&next=%2Fseller%2Foverview`
   ("Loading your progress…") and opened the wizard at the step the account had reached. After
   answering step 1 and pressing Continue, leaving and returning came back at **STEP 2 OF 6** —
   and `GET /user/onboarding-details?userId=1200` confirms `sellerType: "reseller"`,
   `onboardingCompleted: false`. Mobile has no resume: the flow is in-memory and always starts at
   the role screen. ⚠️ Note the query param is **`userId`**, not `user_id` (the POST body uses
   `user_id`); `fetchOnboardingDetails` already gets this right.
2. **A hero banner on every step** — a lab photo panel carrying "101LAB" and "Tailored seller
   tools built for individual surplus or high-volume inventory." Mobile has only the GreenBidz
   logo bar and the EN switcher.
3. **"Save & exit" on every step**, which genuinely leaves to the homepage with progress kept.
   Mobile has no exit affordance at all — only a back chevron.
4. **A persistent help/contact FAB.** Mobile has no help route out of onboarding.
5. **A richer business step.** Web step 2 asks Business name\*, Website, VAT / tax ID\*, Years in
   business, and Business phone behind a **full country selector** (geo-defaulted to India,
   prefilling `+91`). Mobile has no country picker — already tracked as an open item, alongside the
   3.1.1 constraint on what this step may ask at all.
6. **A web-push opt-in prompt** ("Turn on notifications…") fired mid-wizard. Mobile does not ask here.

### What the web does NOT show, which is the interesting half

For an incomplete pending seller there is **no profile page and no pending banner anywhere** —
every route funnels back into the wizard. Clicking the bottom-nav **Account** went
`/auth` → `/auth2` → an attempt at `/seller/overview` → straight back to `/auth2` step 2. The
signed-in homepage renders the ordinary marketing hero with no account-state banner at all.

That is the sharpest contrast with mobile, and it is deliberate on both sides: mobile drops a
pending user into the working app (guests browse, pending = working buyer, only publishing is
gated — Apple 5.1.1(v) and two rejections behind it), whereas web treats an unfinished seller as
having nowhere to be except the wizard.

### Checked and dismissed

The web shows the display name as "WalkTwoSeller WalkTwoSeller". That is **not** a mobile defect:
a single-word full name becomes both `first_name` and `last_name`, and `OnboardingFlow.tsx:861-863`
mirrors the web's own split (`SellerOnboarding.tsx:624-626`) exactly. The doubling came from the
test input — `adb input text` drops everything after a space, so the name was one word.

### Unrelated staging defect seen in passing

`staging-lab.greenbidz.com/auth` first rendered "Application error: a client-side exception has
occurred", with `ChunkLoadError: Loading chunk 1429 failed` and ten `ERR_HTTP2_PROTOCOL_ERROR`s in
the console. A cache-ignoring reload fixed it, which points at stale chunks from a deploy rather
than anything in this work.

Proof: `_proof/web-01-staging-resume-step1.png`, `web-02-staging-business-step.png`,
`web-03-staging-signed-in-home.png`.

## Progress — 2026-10-06, fifth pass: resume, Save & exit and Help, built and device-proven

Three of the six web behaviours from the comparison above are now in the app. The owner chose to
leave the other two out, for stated reasons:

- **The phone country picker** sits inside the business step — the Guideline 3.1.1 field category
  Apple rejected twice. Not worth the review risk for a prefix.
- **The hero banner** costs vertical space that `compactOnKeyboard` was added to reclaim (the
  keyboard-open form slot went from 158dp to ~355dp). A banner works against that.
- The web-push prompt was never a candidate — mobile has its own OneSignal flow.

### 1. Resume — `resume.ts`

The account is created at the end of the FIRST screen, so from that moment there is a real pending
seller whose profile is unfinished. Until now mobile kept its answers in React state only, so a
kill or a back-out stranded that person: an account they could not finish, and a wizard that always
restarted at "I'm a buyer / I'm a seller".

`loadProgress()` reads `GET /user/onboarding-details?userId=` and `GET /user/profile` in parallel
and folds them into one snapshot; `resumeIndex()` picks the first unanswered step. Both endpoints
are needed — steps 2–4 live entirely in the profile — and each is caught independently, so losing
one does not discard the other's answers.

⚠️ The ladder is a transcription of the web's (`SellerOnboarding.tsx:402-407`), not an invention.
It has to match, or an account that leaves on one surface and returns on the other is either asked
everything again or skipped past a step it never answered.

⚠️ `userId` for the GET, `user_id` in the POST body. They genuinely differ; do not "fix" either.

Every stored value is validated against the set the wizard offers rather than cast — these columns
are free-form text shared with the web, and an unrecognised value would hand a radio group
something none of its options match: a step that looks unanswered but reports itself complete.

### 2. Save & exit

⚠️ **This one actually saves, unlike the web's button of the same name.** Web's `exitWizard`
(`SellerOnboarding.tsx:511`) only navigates — the label is true there only because each earlier
step was saved by its Continue, so the step you are LOOKING at is lost. Mobile writes the current
step first whenever it is complete. An incomplete step is skipped rather than part-written: these
answers are single values, so a partial save is a wrong answer stored, not partial progress.

### 3. Help

Points at `/v2/chat`, the existing assistant, which already carries the `CHATBOT_RULES.md` care
strip and its "Talk to a person" handoff — rather than adding another dead FAQ link. `push`, not
`replace`, so Back returns to the exact step with answers intact.

### Verification

Device, Samsung SM-G781B, against dev:

1. Signed in as `mobilewalk1006b@example.com` — the account the APP created — and it logged
   straight into the working app (`_proof/device-20-signin-mobile-created-account.png`). A
   mobile-made account signs in to mobile.
2. Opened the onboarding: it skipped the role screen, the account screen and step 1, and landed on
   **STEP 2 OF 6 — "Tell us about your business"**, which is exactly what the server held
   (`sellerType: "reseller"`, saved from the web). **Help** and **Save & exit** both render in the
   header (`_proof/device-19-resume-step2-help-saveexit.png`).
3. Pressed **Save & exit** — it left to the seller home, as designed. The step was empty, so by
   design nothing was written.

Tests: `__tests__/resume.test.ts` covers all six rungs of the ladder, partial addresses, both
interest shapes, unrecognised stored values and each endpoint failing alone. 382 pass across
`src/features/v2/onboarding` + `src/i18n/__tests__` (the i18n coverage gate included, with the new
keys in all six locales); `npx tsc --noEmit` clean; full suite 1921 passing with the two
pre-existing `v2/scan` failures this change does not touch.

### Not yet verified

**Save & exit has never been seen actually SAVING** — the one press was on an empty step, which
correctly skips the write. The next run should fill the business step, press it, and read the row
back. The resume ladder past step 2 is covered by tests but has not been walked on hardware.

## Progress — 2026-10-06, sixth pass: what the WEB shows after onboarding, before verification and approval

The onboarding was driven to completion on staging-lab for user 1200, to produce the state nobody
had looked at: **onboarding finished, email unverified, admin approval not granted.** Proof:
`_proof/web-05-seller-hub-pending-unverified.png`.

The seller is no longer bounced into the wizard. They land on the Seller Hub and are shown:

1. **"Seller account pending approval"** (amber) — *"You can see your existing listings and buyer
   activity while you wait. Creating new listings, orders, payouts and messaging unlock once an
   admin approves your account — this usually takes up to 24 hours. Longer than that? Contact
   support@greenbidz.com."* It names what is blocked, why, how long, and who to ask.
2. **"Verify your email"** — *"We sent a verification link to …"* with a **Resend email** button.
3. **Padlocked navigation** — Overview, Listings and Buyer Activity are open; **Orders, Escrow &
   Payments, Fulfilment** carry a 🔒.

**Mobile shows none of this.** Same account, same state: no banner, no approval explanation, no
timeframe, no support contact, no email-verification prompt, no resend, no locked affordances. The
app looks exactly as it would for an approved seller, and the block is only discovered at the
moment of publishing. The built-but-orphaned `app/(auth)/pending.tsx` already renders an
email/documents/review checklist and nothing links to it.

Also observed in passing, both worth recording:

- The web's real category taxonomy at step 4 is **four** top-level groups (Lab Infrastructure &
  Essentials · Life Sciences & Biotech · Pharmaceutical & Analytical · Test & Measurement).
  Mobile's `MOCK_CATEGORIES` is ten invented slugs — the replacement is now a parity gap, not just
  a placeholder.
- The web's step 6 has **no terms checkbox**; web collects consent on its account screen. Mobile
  moved it to step 6 deliberately (3.1.1), so this is a known divergence, not a defect.

## Progress — 2026-10-06, seventh pass: the seller finally gets told what is happening

Designed in Stitch against the existing `GreenBidz authv2` project so the new surfaces match what
is already drawn there (`_proof/stitch-01-seller-home-status-cards.png`,
`_proof/stitch-02-account-status-screen.png`), then built the first of them.

### Built: `SellerStatusCards` on the Selling home

Three cards, each shown only when its condition holds, driven by `useSellerStatus()`:

1. **Waiting for approval** — names what still works (browse, drafts, messages), what unlocks and
   roughly when, with a way to ask.
2. **Confirm your email** — shown only when the login payload says the address is unverified.
3. **Finish your seller profile** — a `TintedRow` into the wizard, which now resumes.

⚠️ **Cards, never a gate.** Routing pending users to a wall is what made a fresh install a dead
end, and a sign-in wall in front of browsing is what App Review rejected 1.0.3 (21) for under
Guideline 5.1.1(v). A pending account is a working account that cannot publish; saying so is a
message, not a door. The standing warnings in `app/_layout.tsx` and `app/index.tsx` still stand.

⚠️ **It reports, it does not gate.** Publishing is decided by `canSubmitListing()` and nothing
else. A second predicate that could disagree is how a padlock starts lying about where you can go
— the web keeps one source of truth for exactly this reason (`restrictedRoutes.ts`: "Two things
consume this and they MUST agree").

Defaults lean quiet: unknown verification reads as verified (nagging a verified seller is worse
than silence, and nothing is gated on it), and a failed request never reads as "profile
incomplete" — that would push someone into a wizard that immediately resumes to the end.

### New palette tokens

`cautionWash` / `cautionInk` / `cautionLine`. The palette genuinely had no caution tone: `accent`
reads as success, which is wrong for a blocked account, and `danger` reads as a failure the seller
caused, which is wrong for "an admin has not got to you yet". Contrast computed, not estimated —
light `#7A5B16` on `#FDF6E3` = **5.84:1**, dark `#E8C87A` on `#2E2716` = **9.15:1**, both clearing
the 4.5:1 text floor. `cautionLine` is explicitly decorative and documented as such.

### Two defects the device caught that the tests could not

1. **Raw key paths rendered on screen.** The keys went in beside `resume`, i.e. under
   `…auth.onboarding.sellerStatus`, while the component asked for `…auth.sellerStatus`. The i18n
   suite passed throughout: `authCoverage` checks that every `en` key exists in the other five
   locales — which it did — and nothing verifies that a component asks for the path the file uses.
2. **The card ran edge to edge** while the identical row below it was inset, because `TintedRow`
   carries its own `marginHorizontal: GUTTER` and the wrapper must not add a second one.

Both are noted in the source at the point of the mistake.

### Verification

Device, signed in as the pending account (`_proof/device-21-pending-card-on-selling-home.png`):
the amber card renders above the assistant row with the correct copy and matching inset. Only the
approval card appears, which is right — user 1200 finished onboarding on the web, and the login
payload carries no unverified flag. tsc clean; 433 tests pass across the i18n, seller and
onboarding suites.

### Not built yet

The **Account status screen** (`_proof/stitch-02-…`) with the three-step checklist and a working
Resend button, and the **gate on onboarding completion**. Also still true: nothing in the app
reads `onboardingCompleted` outside the wizard, so an approved seller with an empty profile can
still publish.

## Progress — 2026-10-06, eighth pass: the publish gate, and the status screen

### The gate now covers an unfinished profile — WITHOUT touching legacy sellers

The remaining hole was that `canSubmitListing()` keyed only on approval, so an approved seller who
never finished the wizard could publish with no company, tax id or address.

⚠️ **The obvious fix would have broken every existing seller on the platform**, and the suggestion
written in the previous pass was wrong as stated. `GET /user/onboarding-details` returns a FULL
DEFAULT OBJECT when the row does not exist —
`{sellerType: null, …, onboardingCompleted: false}` (origin/dev
`controller/authV3.controller.js:1520`). So every seller who predates the v2 wizard is
byte-identical to someone who abandoned it, if you read the flag alone. Gating on
`!onboardingCompleted` would have locked all of them out of publishing.

The predicate is therefore keyed on **`sellerType`**, the one field that is non-null only once the
wizard actually recorded an answer: `ob && ob.sellerType !== null && !ob.onboardingCompleted`.

⚠️ And this half **fails OPEN**, inverting the rest of the predicate. Everything above it fails
closed because an unknown approval must not open the gate; here the unknown is "we have not asked
yet", and refusing on that lands on the legacy population again — the larger group, and the one
with nothing to fix. `SellerGatePrewarm` now warms the row on (lab) entry so unknown is rare.

`redirectToSellerApplication()` also learned a second door: someone whose problem is an unfinished
wizard is sent to the wizard (which resumes), not to a form about applying, which they already did.

Five new cases in `sellerSubmitGate.test.ts`, including the explicit "does NOT block a legacy
seller" regression. Instrument proven: with the new check disabled, exactly one test fails — the
one asserting the block — and every legacy case still passes.

### Built: the account status screen — `app/v2/account-status.tsx`

The Stitch design (`_proof/stitch-02-account-status-screen.png`), built and device-verified
(`_proof/device-22-account-status-screen.png`): the connected 3–4 step checklist off
`deriveApprovalChecklist`, and a "what you can do now" panel so the screen is not purely a list of
blockers.

It is **not** `app/(auth)/pending.tsx` revived. That screen is finished and permanently unreachable
— the RootLayout guard replaces to home for any signed-in user inside `(auth)`, as its own header
admits. This is the v2-language equivalent, living where the rest of v2 lives, opened from the
status card.

Both of that screen's invariants are carried over: **it never blocks**, and it performs **no
outbound navigation** — App Review rejected build 14 under Guideline 3.1.1 for an "Open website"
button on the equivalent screen, and this is a screen an unapproved reviewer can reach. The file is
added to `MUST_NOT_NAVIGATE` in `src/__tests__/externalLinks.test.ts` so the build fails if that
ever changes.

### Four enforcement tests caught real problems, and one caught a design bug

- `v2Inventory` — a new v2 route must be declared on the status board. Declared.
- `v2Inventory` reachability — v2 has exactly one door from outside v2, and my card was a second.
  The right fix was moving it: `SellerStatusCards` is genuinely a v2 surface, so it now lives at
  `src/features/v2/seller/`. The hook stayed in `features/seller` — it navigates nowhere.
- `v2Adherence` — raw `letterSpacing`/`textTransform` (use the `eyebrow` variant) and a raw
  `borderRadius: 14` (use `radius.pill`). Both were me forking the scale.
- `v2MaterialCoverage` — four flat grounds needed a stated reason. The marker must sit within TWO
  lines of the ground, which my first attempt missed.

The device caught one more: a padlock glyph beside the sentence "Publishing is open". The glyph is
now chosen by the sentence, not hardcoded.

### State of play

tsc clean. Full suite **1929 passing**, with only the two pre-existing `v2/scan` failures this work
does not touch.

**Still not verified:** the status screen has only been seen in a GUEST session, so the
`action`/`wait` marker states and the "{{email}}" line are covered by the checklist helper's own
tests but not by a device capture. The 15-minute dev token expired three times during this pass,
which is what made repeated signed-in verification expensive.

## Progress — 2026-10-06, ninth pass: Resend email, and the reason the card never appeared

### The card could never have shown — a second dead feature found

`emailVerified` came from `authStore.approval`, which is only populated from loginV3's
ACCOUNT_PENDING body. **That body carries no `approval` object.** Checked against dev:

```
{ success:false, code:'ACCOUNT_PENDING', message, userId, role, name, company }
```

`login.ts` already guards it (`if (body.approval)`), so nothing crashed — the value simply fell
through to its "verified" default forever, and the confirm-your-email card was built correct and
unreachable. The same shape of defect as the interlock in the third pass: no error, no failing
test, just a feature that silently cannot happen.

`GET /user/verify-user` has the fact, with the authoritative status beside it:
`{ accountStatus: 'pending', emailVerified: false }`. New service `services/auth/verifyUser.ts`,
read by `useSellerStatus`. ⚠️ Display only — `canSubmitListing()` still reads the seller-upgrade
status and the session flag, and must not gain a third opinion about publishing.

`awaitingApproval` is now `isPending || accountStatus === 'pending'`: the session flag is set at
sign-in and never refreshed, the server's word is live but costs a request, and either saying
"pending" is enough to show a card. Neither decides whether publishing is allowed.

### Resend email

`POST /user/resend-verification-link` — ⚠️ **not** `/user/resend-verification-code`. Two flows
exist side by side; the v2 onboarding signs up via `signup-with-link-v2`, so its sellers have a
24h LINK pending and no code to type. Sending the wrong one would deliver an email the person
cannot act on.

The control is shared between the card and the status screen by import, not copied — two resend
buttons that disagree about what happened is worse than one that is occasionally wrong. It never
claims success it does not have: the server answers **500 when the mail itself fails to send**
(the only awaited call in its handler is `sendMail`), so only a 2xx flips it to "sent". After a
success it is spent rather than re-armed, because a second send produces a second valid link and a
confusing inbox.

### Verified on device

Both cards render for the pending account (`_proof/device-23-both-status-cards.png`), and pressing
**Send it again** against dev returned the server's 500 and the UI showed *"That didn't send. Try
again in a moment."* with the control still tappable — the failure path, proven
(`_proof/device-24-resend-failure-handled.png`). Dark mode was toggled accidentally mid-test by
the dev scheme pill, which incidentally confirms the new `caution*` tokens read correctly on dark.

**The SUCCESS path is NOT proven and cannot be with this account:** `@example.com` will not accept
mail, which is the most likely cause of the 500 (unprovable from outside). It needs one run with a
real mailbox.

tsc clean; full suite 1929 passing, two pre-existing `v2/scan` failures untouched.

## Progress — 2026-10-06, tenth pass: Resend proven end to end, on a real mailbox

The owner supplied a working test domain (`@yopmail.com`), which closed the one gap the previous
pass could not.

`testlogin001lab@yopmail.com` was created on dev (user **1203**) and the endpoint answered
`{"success":true,"message":"Verification email resent. Please check your inbox."}`. That settles
the earlier 500 as the `@example.com` domain being refused by the mail server — previously a
hypothesis, now confirmed by contrast.

On the device, signed in as that account:

- **All three status cards render together for the first time** — waiting for approval, confirm
  your email, and finish your seller profile. 1203 never ran the wizard, which is what brings the
  third one out (`_proof/device-25-all-three-status-cards.png`).
- Pressing **Send it again** showed **"Sent — check your inbox."**
  (`_proof/device-26-resend-success.png`).

Both branches of the control are now proven on hardware: the failure path against the unreachable
address (ninth pass) and the success path here. The only thing still unseen by me is the email
landing in the inbox itself, which needs someone to open yopmail.

### Device incident during this pass

Chained adb taps for the **third** time and ended up in Android Settings → "Appear on top", where
one tap landed in the toggle column. Logged in `MISTAKES.md` with a sharper rule than before: never
put a tap in the same command as a launch or a sleep, and when a tap must land in an unverified
state prefer the LEFT half of the screen, because toggle columns and overflow menus live on the
right. Surfaced to the owner rather than silently reverted — reverting is also a device change.

## Progress — 2026-10-06, eleventh pass: the loop closes, and the card withdraws

The owner opened the resent link. The web confirmed *"Email Verified! … Account under review"*, and
`GET /user/verify-user` for user 1203 flipped to **`emailVerified: true`, `accountStatus: pending`**.

Relaunching the app on that account: the **confirm-your-email card is gone**, and the other two
remain — waiting for approval, and finish your seller profile
(`_proof/device-27-email-card-withdrawn-after-verify.png`).

That is the half that mattered and could not be faked. The cards are not static decoration keyed
off a flag set at sign-in: they read live server state and **withdraw when the thing they are
about is resolved**, while leaving the unresolved ones alone. The whole chain is now proven on
hardware end to end:

> app's Resend → mail sent → link delivered → verified on the web → server state changes → the
> app's card disappears.

Worth noting for whoever reads this next: nothing in the app triggered that last step. There is no
polling and no push — the card withdrew because the screen remounted and re-queried. A seller who
verifies on their phone while the app sits open will keep seeing the card until they leave the
screen and come back. `staleTime` is 60s, so that is the ceiling on the lag, and it is acceptable
for a nag card. It would NOT be acceptable for anything gating an action.

### Status of the web-parity list

Of the sixteen differences found against the web this session: **eight closed and device-proven**,
three declined deliberately (hero banner, phone country picker, in-wizard push prompt), and five
open — of which two are decisions rather than build work (messaging before approval; whether the
web's four real categories are the right set for mobile).

## Screenshot coverage — what `_proof/` does and does not have

60 captures, named by surface: `01-10` the web reference, `build-*` the browser build pass,
`device-*` the on-device runs, `stitch-*` the designs, `web-*` staging-lab.

Every screen and card built this session has a device capture, including both themes and both
outcomes of the resend control. Three things do NOT, and the third is the one that matters:

1. **The resume spinner** ("Picking up where you left off…") — sub-second, never caught.
2. **The resend "Sending…" state** — same reason.
3. ⚠️ **The blocked-publish redirect.** The gate that stops an unapproved or half-onboarded seller
   from publishing, and sends them to the wizard rather than the application form, has **never
   been exercised on a device**. It is covered by five unit cases and the instrument was proven
   (disabling the check fails exactly the right test), but no one has watched it happen. That is
   behaviour, not appearance, and it is the piece most worth a real run: it needs a draft taken
   through to the publish choke point by an approved-but-unfinished account.

Nothing here should be read as "the gate works on hardware". It works in test.

## Progress — 2026-10-06, twelfth pass: the card stack becomes one row (handed off, then corrected)

The card pile was reworked into a single summary row by a separate session working from
`Docs/v2/authv2/_refs/` (brief + target images + `HANDOFF-PROMPT.md`). Its code was good. Review
found **one real regression and one real inconsistency**, both of which it had flagged honestly as
uncertainties rather than hidden:

### 1. ⚠️ The resume wizard became undiscoverable again — FIXED

Collapsing the cards removed the "Finish your seller profile" row, and
`app/v2/account-status.tsx` had no profile step, so the ONLY remaining way into the wizard was
being bounced from a blocked publish (`sellerSubmitGate.ts:156`). That is precisely the
undiscoverable state the row existed to fix — the feature would have been dead again, silently,
with every test passing.

Fixed by giving the status screen a **profile step** whose action pushes `/(auth)/onboarding-mock`.
A warning now sits at that JSX explaining why it must not be removed without replacing the entry
elsewhere.

### 2. The ring and the checklist counted different things — FIXED

The ring counted account / email / profile / approval from `useSellerStatus`; the screen counted
account / email / documents / review from `deriveApprovalChecklist(approval)`. Two numbers for one
account. Worse, that helper reads `authStore.approval`, which is never populated, so its
`documents` step could never appear at all.

The screen now derives its four steps from the same hook, in the same order, so the two cannot
disagree by construction. `deriveApprovalChecklist` is untouched — `app/(auth)/pending.tsx` still
uses it.

### 3. Title said the wrong thing when nothing needed the seller — FIXED

"Finish setting up your account" asks for an action that does not exist when only OUR review is
outstanding. New `summary.titleWaiting` key in all six locales.

### 4. Two type errors

`StyleSheet.absoluteFillObject` is not in this RN version's types. The repo already documents the
workaround at `features/v2/detection/group-mosaic.tsx:188`; applied the same one.

### Verified on device, signed in as the pending account 1203

- `_proof/device-30-single-status-row-live.png` — one quiet white row, `2/4` ring, "Finish setting
  up your account", "Waiting for approval · 1 thing needs you". **"Scan it" is the loudest thing on
  the screen again, and DRAFTS *and* LIVE LISTINGS are both visible without scrolling** — the two
  things the card pile broke.
- `_proof/device-31-status-screen-four-steps.png` — four steps matching the ring: two ticks, the
  amber profile action, the review clock.
- `_proof/device-32-wizard-reached-from-status-screen.png` — "Pick up where you left off" opens the
  wizard. The resume path is discoverable again.

tsc clean; full suite 1929 passing, two pre-existing `v2/scan` failures untouched.

### Note on the handoff itself

The brief in `_refs/` worked: the returned code matched the target, used the tokens, and did not
touch the files it was told to leave. The two defects it introduced were both consequences the
brief did not anticipate — it said "replace the cards" without saying "and the finish-profile
entry point must survive somewhere". **A handoff should name the behaviours that must survive, not
only the look to achieve.**
