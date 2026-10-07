# 02 — Create the account

**Web source:** `SellerOnboarding.tsx:824-945` (`screen === "account"`); validation `:441-464`;
submit `handleAgreeAndStart` `:521-613`
**Shell:** `AuthShell mode="signup"`
**The pivotal screen.** The account is created here, not at the end.

## What it asks

| Field | Required | Autofill |
|---|---|---|
| Email | yes | `email` |
| Full name | yes | `name` |
| Phone | yes | `tel` |
| Password | yes | `new-password` |
| Confirm password | yes | `new-password` |
| Marketing opt-in | no, **default on** | — |
| Seller T&C acceptance | sellers only, gates the button | — |

Full name is split on whitespace into `first_name` / `last_name` at submit (web `:534-536`); a
single-word name becomes both.

## Validation — verbatim from the web

All computed on every render into one `acctErrors` object (`:441-464`); shown per field once it has
been blurred, or all at once after a failed Continue.

| Field | Rule | Message |
|---|---|---|
| Email | non-empty, ≤254, `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` | "Enter a valid email address, e.g. name@company.com" |
| Full name | 2–100 chars, `/^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u` | "Name can only contain letters, spaces, apostrophes and hyphens" |
| Phone | `isValidPhoneNumber` for the selected country | "Enter a valid phone number for the selected country" |
| Password | 8–72, at least one letter **and** one digit | "Use at least one letter and one number" |
| Confirm | matches password | "Passwords do not match" |

Note the password rule is **8 + letter + digit** here, against 6-with-no-composition-rule on the
old `/auth`. The wizard is the stricter one; mobile follows the wizard.

## What it does on Continue

1. `POST /user/signup-with-link-v2` — `{ email, password, role, first_name, last_name, phone, lang, team_invite_code? }`
2. Best-effort `POST legal-documents/accept` for the T&C record (never blocks)
3. Then it **forks by role**:

| Role | What happens |
|---|---|
| Buyer | Session stored immediately, valuation claimed, redirect out. No wizard. |
| Seller | Account exists, but **the token is deliberately not stored yet** (web `:588-600`). Held in memory and only committed in `finishOnboarding`. |
| Invited member | Session stored, dropped into the owner's workspace, **wizard skipped entirely** (web `:562-579`) |

The seller token-withholding is intentional: an account that is only an email and a password should
not already be "signed in" before any required profile exists. Keep it — but see the mobile risk
below.

Duplicate email returns 400 "Email already registered"; the web routes to sign-in with the address
prefilled rather than showing a dead-end error (`:602-609`). Keep that behaviour.

## Invite mode (`?ref=CODE`)

Heading becomes "Join {company} on 101LAB." Email is fixed and read-only. **No marketing checkbox,
no terms box, no sign-in link.** The eyebrow reads TEAM INVITATION and the Change button is hidden.

## Mobile build notes

- `AuthShell mode="signup"`, `eyebrow` for the SELLER ACCOUNT / BUYER ACCOUNT / TEAM INVITATION
  label, `title` for the heading, `footer` for the Continue button.
- **Do not copy the web's labelling.** Only email has a real label there; full name, phone and both
  passwords use placeholders as labels, which vanish on first keystroke. `FORM_INPUT_RULES.md`
  requires a visible label above every field. Use `Field`.
- **Both passwords need a show/hide toggle.** The web wizard has none — the older `/auth` does.
- `autoComplete` tokens as tabled above. Remember `autoComplete="password"` is Android-only
  (memory `feedback-form-input-rules`) — use the documented iOS-safe pairing.
- Phone: the app must not gain a native dependency for this or the flow stops being OTA-shippable.
  `<VERIFY>` what `register.tsx` already uses for phone entry and reuse it.
- **Sticky footer vs keyboard.** Five fields and a long terms panel: tap the last field with the
  keyboard open and assert its rect does not intersect the footer's. Measure with `onLayout`.
- Seller T&C: the web renders a 300px scrollable panel of `SELLER_TERMS_CLAUSES` inline. On a phone
  that is a `<VERIFY>` — a sheet or a linked screen is likely better than a scroll-within-scroll.
  The acceptance checkbox must still gate the button.
- The hidden `opacity-0` checkbox pattern from the web gives no keyboard/screen-reader focus.
  Mobile uses real accessible controls.

## Risks specific to mobile

**Withholding the seller token is riskier on a phone than in a browser.** `pendingSignupResult`
lives in memory. A web tab survives a step; a React Native app is backgrounded and killed routinely.
If that happens mid-wizard the user has an account they cannot sign into without going back to
login, and `userId` is gone so the per-step saves silently no-op (every `save*` opens with
`if (!userId) return`, and `advance()` treats the returned `undefined` as success — web
`:986-995`). Decide one of:

- persist `userId` + token to secure storage and gate the *dashboard* on `onboarding_completed`
  instead of on having a token, or
- treat a cold start mid-wizard as resume mode.

Not optional. Backgrounding is the normal case, not the edge case.

## Acceptance

A real account created on a device in a non-English language. Every validation message seen at
least once. Keyboard open on the last field without the footer covering it. Duplicate-email attempt
lands on login with the address filled. App backgrounded and killed at this screen, reopened, and
the user is not stranded.

---

## Progress

**2026-10-05 — ~~NOT BUILT. Blocked on App Review Guideline 3.1.1.~~ WRONG — see the
correction below.** Kept verbatim because the reasoning error is the useful part; the screen was
never 3.1.1-blocked and the block below misreads which fields the rejection named.

This screen collects business identity — the exact category App Review rejected this app for
**twice** (1.0.0 (14), and 1.0.3 (19) on 2026-08-20): *"Remove the account registration
features for business and organizations."* The finding named company name, tax /
business-registration number, business type and the registration certificate upload.

The constraint is written into the code:
- `app/(lab)/sell/apply.tsx:12-48` — the ⛔⛔ "DO NOT PUT IT BACK" block, quoting the rejection
- `app/(auth)/register.tsx:13-17` — why mobile signup is deliberately three fields
- `src/__tests__/externalLinks.test.ts` — enforces the no-outbound-link aftermath

Apple said **remove, not move**: an earlier fix that shifted these fields out of signup into
another in-app form was rejected again. A feature flag is also out, under Guideline 2.3.1.
These details are collected **off-app by the team** today, with `/seller-upgrade/my-status`
gating who may publish.

**Nothing here is built, and nothing should be until someone answers: can the app collect
business identity on iOS at all?** If no, this file describes a web-only screen. If the answer
is "Android only", it can be built behind a platform split — not a flag.

The Stitch mockups for this screen exist and should be treated as unshippable as drawn.

---

## Progress — 2026-10-05, correction: this screen IS built, and was never 3.1.1 blocked

**The entry above is wrong, and the error was in the reading, not in the code.** It is corrected
here rather than deleted so the same confusion is not made a third time.

### The distinction the entry above collapsed

Guideline 3.1.1 rejected **business identity**: company name, tax / business-registration number,
business type, and the registration-certificate upload. That list is quoted verbatim in
`app/(lab)/sell/apply.tsx:14-21`, and it is the whole of what Apple named.

This screen asks for **email, full name, phone, password, confirm password** — `ACCOUNT_FIELDS` in
`src/features/v2/onboarding/mockState.ts:141`, and nothing else is read anywhere in `AccountStep`
(`OnboardingFlow.tsx:615-727`; the copy table is `ACCOUNT_COPY`, `:578-613`). Not one of the four
rejected fields appears on it. It is the same shape as `app/(auth)/register.tsx`, which is the
shape App Review **accepted**.

So: *a personal-account signup is not a business registration.* The 3.1.1-sensitive fields in this
port are on screens **04 (business details)** and **05 (location)** — those two files are correctly
flagged and stay flagged. Screen 02 is not one of them, and the "NOT BUILT, blocked on 3.1.1" line
above conflated "this wizard contains a 3.1.1 problem" with "every screen in it does".

### What is actually built

`AccountStep` in `src/features/v2/onboarding/OnboardingFlow.tsx:615`, rendered from the flow's
`roleConfirmed && !accountCreated` guard (`:295-308`). Five `Field`s, labels above every one, the
autofill tokens tabled at the top of this file, `new-password` on **both** password fields
(`:598-612`) so the OS offers to generate rather than autofilling an existing password into a
signup.

| This file asked for | State |
|---|---|
| Visible label above every field (not web's placeholder-as-label) | done — `Field`, `label={copy.label}` (`:698`) |
| Autofill tokens per the table | done (`ACCOUNT_COPY`, `:581-612`) |
| All validation messages, not one per field | done — `validateAccountField` (`mockState.ts:143-177`) returns **14** distinct non-empty messages across the five fields (2 email, 4 full name, 2 phone, 4 password, 2 confirm — counted from the source). This file's own table at the top lists **five**, one per field, and a missing message is how a user hits a blocked button with nothing on screen |
| Errors on blur, all at once after a failed Continue | done — `accountErrorFor` (`mockState.ts:334`) |
| Full name split into `first_name` / `last_name`, single word becomes both | done (`OnboardingFlow.tsx:636-647`) |
| Role fork: a buyer has no wizard | **broken, see below** — a buyer never reaches this screen at all |
| Show/hide toggle on both passwords | **not done** |
| Marketing opt-in checkbox | **not done** — still not collected, still not sent (see `03-seller-type.md`) |
| Invite mode (`?ref=CODE`) | **not done** — no invite path at all |
| Duplicate email routes to sign-in with the address prefilled | **partial** — `EMAIL_TAKEN` is classified (`services/onboarding/sellerOnboarding.ts:66-68`) and the message is shown with a "Try again", but nothing routes to login |

### ⚠️ A buyer never reaches this screen

This file's role table says a buyer creates an account here and is then redirected out. In the
built flow they are not: the role screen's Continue calls `ob.setDone(true)` straight away for a
buyer (`OnboardingFlow.tsx:316-318`), while this screen's render guard is `roleConfirmed &&
!accountCreated` (`:295`) and `confirmRole()` only runs on the seller branch. So a buyer goes role
choice → "You're all set to buy" having supplied **no email and no password**, and no account would
be created even with the API live.

Two pieces of code exist for the path that cannot run: the buyer branch of `onCreated` (`:303`) and
the `BUYER ACCOUNT` eyebrow (`:657`). Not fixed. Recorded here so it is not mistaken for a decision
— the comment at `:317` ("A buyer has no wizard, so confirming the role IS the whole signup")
confuses *having no wizard* with *having no account*.

⚠️ **The phone rule is weaker than the web's and knowingly so.** Web uses libphonenumber's
`isValidPhoneNumber` against the selected country; this uses `/^[+]?[\d\s()-]{7,20}$/`
(`mockState.ts:163`), because the app has no phone-input component and adding a native dependency
would cost OTA-shippability — the trade-off this file's build notes asked about. It is marked
`<VERIFY>` in the source and is still unresolved.

### Where the seller T&C went

Not here. The web gates "Agree and continue" on this screen; in this build the acceptance gate sits
on the **last** step, beside the submit — see `08-calibration.md`. The screen still shows the
static "By continuing you agree to the 101LAB Terms of Use and Privacy Policy" line
(`OnboardingFlow.tsx:722-724`).

### The mobile token risk this file raised — answered

This file said withholding the seller token until the wizard finishes is riskier on a phone than in
a browser, and named two acceptable answers. The first was taken: the session is established **the
moment the account exists**, via `establishSessionAfterSignup` (`useOnboardingApi.ts:126-136`), so
the tokens land in secure storage instead of RAM, and completeness is decided by
`onboarding_completed` rather than by whether a token survived a background kill. The reasoning is
written up at the head of `useOnboardingApi.ts:28-42`.

### No email-verification step — an open decision, not an oversight

Today's shipped mobile signup is a three-call triad with a 6-digit code (`services/auth/register.ts`).
`signup-with-link-v2`, which this screen calls, has no equivalent. Adopting this as *the* signup
would silently drop in-app verification. Flagged in the code at `OnboardingFlow.tsx:288-293`.
Unresolved.

### Verification — what was actually walked

Walked on a device (Samsung SM-G781B, dev client, `greenbridge://onboarding-mock`): the account
screen in full — every field, the validation messages, and the next-field focus chain to the last
field's "go". Role choice, seller type and business were walked in the same session.

**Not walked on a device:** location, categories, volume, the submitting timeline, the outcome
screens.

## Progress — 2026-10-06: the missing device capture now exists, in its buyer form

The gap flagged in the paragraph below is closed for the buyer variant. The account screen was
walked on the Samsung SM-G781B from a clean role screen and captured:
`_proof/device-14-buyer-account.png` (empty, buyer copy — eyebrow `BUYER ACCOUNT`, CTA "Agree and
start buying", the plain Terms-of-Use sentence rather than the seller terms checkbox) and
`_proof/device-15-buyer-account-valid.png` (all five fields filled, CTA enabled, confirm-password
field clear of the sticky footer).

Confirmed on hardware in that walk: the `compactOnKeyboard` header collapse (BrandBar and title
hide while typing); the per-field keyboards (numeric keypad for phone, `.com` key for email);
password masking on both password fields; and the CTA staying disabled until the last field is
valid. The seller variant of this screen was walked in the earlier session but still has no
capture of its own.

⚠️ `_proof/` carries no device screenshot of this screen. `device-01..09` are role, role-selected,
business, typing, the step-2 form, keyboard-collapsed and the three terms shots. The device walk of
the account screen is recorded here on the owner's statement; the capture is missing and should be
taken before this is cited as proof elsewhere.
