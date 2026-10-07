# 04 — Business details

**Web source:** field list `SellerOnboarding.tsx:207-218`; validation `:153-198`; save `:685-695`
**Shell:** `AuthShell` + `AuthStepRail index={1} total={6}`
**Step 2 of 6.** Heading and one field depend on screen 03.

## What it asks

| id | Label (reseller / company) | Required | Width |
|---|---|---|---|
| `bizName` | Business name / Company name | **yes** | full |
| `website` | Website | no | half |
| `taxId` | VAT / tax ID | **yes** | half |
| `bizRole` | Years in business / Your job title | no | half |
| `bizPhone` | Business phone | no | half |

Sub-heading: *"This appears on your seller profile."* — which is the reason the required two are
required.

Required set is `REQUIRED_FIELDS` (web `:202`), shared with screen 05.

## Validation — verbatim

| id | Rule | Message |
|---|---|---|
| `bizName` | 2–120 chars, must contain a letter or digit | "Business name is required" / "Company name is required" / "Must be at least 2 characters" |
| `website` | blank ok; else parses as a URL with a real TLD, no whitespace | "Enter a valid website, e.g. www.example.com" |
| `taxId` | `/^[A-Za-z0-9][A-Za-z0-9 ./-]{2,29}$/` | "Use 3–30 letters, numbers, spaces, dots, dashes or slashes" |
| `bizRole` reseller | 1–2 digits | "Enter whole years, e.g. 5" |
| `bizRole` company | ≤80, letters/digits/punctuation | "Enter a valid job title" |
| `bizPhone` | blank ok; else `isValidPhoneNumber` | "Enter a valid phone number with its country code" |

`website` is normalised with an implicit `https://` before parsing, so `www.example.com` passes
(web `:145-151`).

The reseller `bizRole` input also strips non-digits on every keystroke and clamps to 2 characters
(web `:1059`) — belt and braces over the regex.

## What it saves

Two calls, one awaited and one not (web `:685-695`):

| Target | Fields |
|---|---|
| `PUT /user/settings` — **awaited**, blocks advance on failure | `company` ← `bizName`, `companyTaxIdNumber` ← `taxId` |
| `POST /user/onboarding-details` — fire-and-forget | `website`, `biz_role`, `biz_phone` |

So the two required fields are durable and the three optional ones are best-effort. That is a
reasonable split, but note the consequence: **a user can see "Saving…" succeed while their website
and job title silently failed.** Worth a `<VERIFY>` on whether mobile should await both.

On failure of the awaited call: toast "Could not save your business details. Please try again." and
stay on the step.

## Mobile build notes

- Five fields; the web's half/full grid collapses to a single column on a phone. Keep field
  *order*, drop the widths.
- `Field` for the four text inputs. `bizPhone` reuses whatever screen 02 settled on for phone —
  not a second phone implementation.
- `maxLength` per field, copied from the web (`:1058`): bizName 120, taxId 30, bizRole 80,
  website 200.
- `inputMode`: numeric for reseller `bizRole`, url for `website`.
- Autofill: `organization` for `bizName`, `url` for `website`, `tel` for `bizPhone`.
  `<VERIFY>` the RN equivalents — these are web token names.
- Errors appear on blur, or all at once after a failed Continue. `Field` should already support
  an error slot; check before adding one.
- **Optional fields must be visibly optional.** The web appends "(optional)" to the label; mobile
  must too, or the three unmarked fields read as required.
- Five fields plus a footer: measure the keyboard collision on the last one.

## Resume mode

Prefilled from the profile, not the onboarding row (web `:391-394`):
`bizName` ← `personalInfo.company`, `taxId` ← `personalInfo.companyTaxIdNumber`, and
`website` / `bizRole` / `bizPhone` ← the onboarding row. Resume opens here when either required
field is missing (web `:404`).

## Acceptance

Both required fields enforced; each of the six validation messages seen once. A reseller sees a
numeric years field, a company sees a text job-title field — proven by switching the answer on
screen 03 and coming back. Saved values appear on the web dashboard afterwards.

---

## Progress

**2026-10-05 — BUILT as a UI mock, behind the `__DEV__` route only.**

⚠️ **This screen collects business identity — the category App Review rejected this app for
twice under Guideline 3.1.1** (`app/(lab)/sell/apply.tsx:12-48`). It exists only because the
owner asked for the remaining screens to be completed, and it is reachable *only* in a dev
build: `__DEV__` is false in every release and the branch is stripped by the bundler, so this
is not the "hidden feature" Guideline 2.3.1 forbids. **It must not be wired into a shipped
flow until someone answers whether the app may collect business identity at all.**

`OnboardingFlow.tsx` case `'business'`, rendered by the shared `FieldStack` on the kit's
`Field`. Verified in Chrome at 390×844 — `_proof/build-07-business-light.png`,
`_proof/build-08-business-validation.png`.

**Validation is the web's, rule for rule** — `validateField()` in `mockState.ts` carries the
same regexes and the same message strings, including `TAX_ID_RE` and the `https://`
normalisation for `website`. Verified live: an invalid tax ID shows *"Use 3–30 letters,
numbers, spaces, dots, dashes or slashes"* with the field in `danger`, and Continue stays
disabled. Errors appear on blur, or all at once after a failed Continue.

**The reseller/company fork works:** picking Reseller gives "Tell us about your business" and a
numeric "Years in business"; Company gives "…your company" and a text "Your job title".

**Fixed vs the Stitch mockup:** optional fields now say "(optional)" in the label, so the three
unmarked ones no longer read as required. The mockup's error text said "3–50" where the regex
is 3–30; the built screen takes its message from the validator, so they cannot drift.

**Not done:** no save. No country picker on `location`. Labels are hardcoded English.

---

## Progress — 2026-10-05, second pass

**The 3.1.1 warning above stands, unchanged and deliberately so.** This screen collects company
name and tax ID — two of the four fields Apple named (`app/(lab)/sell/apply.tsx:14-21`). It is
reachable only from `app/(auth)/onboarding-mock.tsx`, which returns a `Redirect` to login whenever
`__DEV__` is false (`:27`), so the branch is not in a release bundle. Do not wire it into a
shipped flow.

⚠️ **Do not generalise that warning to screen 02.** `02-account.md` carried a "NOT BUILT, blocked
on 3.1.1" header that was wrong: the account screen asks for email, name, phone and password only
(`mockState.ts:141`) and contains none of the four rejected fields. **04 and 05 are the
3.1.1-sensitive screens in this port; 02 is not.** Keeping the distinction sharp is the point of
this note.

**The save is now written, and is interlocked off.** `saveStep('business', …)` does the two calls
this file tables (`useOnboardingApi.ts:174-184`) — but **both are awaited**, where web fires the
second unawaited. That answers the `<VERIFY>` this file raised about a user seeing "saved" while
their website and job title were silently dropped: they cannot. Nothing has been sent; the
interlock needs `EXPO_PUBLIC_ONBOARDING_API=1` **and** a `testapi.greenbidz.com` URL, and no call
has ever been made — see `00-introduction.md`.

**Walked on a device.** `_proof/device-03-business.png`, `_proof/device-04-typing-keyboard.png`,
`_proof/device-05-current.png` (the rail reading **"STEP 2 OF 6"**, the company fork, and the
three "(optional)" labels). Typing, the keyboard-vs-sticky-footer collision and the
next-field focus chain all pass on hardware — the collision test `FORM_INPUT_RULES.md` §4
requires.

⚠️ **One failure found there and not fixed:** the *focused* field's own label scrolls out of view
while typing in it, while the next field's label stays visible. A focused field with no visible
label is the weaker half of the labels-above-fields rule.

**Still not done:** no `<VERIFY>` yet on `bizPhone` reusing a shared phone implementation — it is
a plain `Field` with `keyboardType="phone-pad"` (`OnboardingFlow.tsx:101-108`) and the validator
has no rule for it at all (`validateField` has no `bizPhone` case, `mockState.ts:85-127`), so the
web rule this file tables — "blank ok; else `isValidPhoneNumber`" — is **not implemented**: any
string passes. Labels are still hardcoded English.
