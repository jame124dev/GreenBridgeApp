# 05 — Where the equipment is

**Web source:** field list `SellerOnboarding.tsx:219-230`; validation `:153-198`; save `:696-705`
**Shell:** `AuthShell` + `AuthStepRail index={2} total={6}`
**Step 3 of 6.** All five fields required.

## What it asks

*Where is your equipment located?* — sub-heading *"Buyers only see the city and country."*

That sub-heading is doing real work: it is the reason a seller is willing to type a street address
at all. Keep it, and keep it true.

| id | Label | Width |
|---|---|---|
| `street` | Street address | full |
| `city` | City | half |
| `postal` | Postal code | half |
| `region` | State / region | half |
| `country` | Country | half |

## Validation — verbatim

| id | Rule | Message |
|---|---|---|
| `street` | 5–150 chars, contains a letter or digit | "Street address is required" / "Enter the full street address" |
| `city` | 2–80, `/^[\p{L}\p{M}][\p{L}\p{M}\s.,'’()/-]*$/u` | "City can only contain letters" |
| `postal` | `/^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/` (3–10 chars) | "Enter a valid postal code (3–10 letters, numbers, spaces or dashes)" |
| `region` | 2–80, same place regex as city | "State / region can only contain letters" |
| `country` | must be in the known country list | "Select a country from the list" |

The place regex is Unicode-aware (`\p{L}`), so 東京 and Đà Nẵng pass. Worth keeping exactly —
an ASCII-only rule would lock out most of the buyer base.

⚠️ **The postal rule is 3–10 characters with no country awareness.** Fine for most, but verify
against the priority markets before shipping — a rule that rejects a legitimate code is a hard
dead end on a required field, with no way past it.

## What it saves

One awaited `PUT /user/settings` (web `:696-705`):

```
address: { street, city, district ← region, postalCode ← postal, country }
```

Note **`region` maps to `district`** on the wire. Easy to get wrong, and wrong means the state
silently lands in the wrong column.

On failure: toast "Could not save your address. Please try again." and stay.

## Mobile build notes

- Four `Field`s plus a country picker. **`PickerRow` is the existing component** — check it before
  reaching for anything else.
- Country list comes from the shared constants the web uses (`PRIORITY_COUNTRIES` +
  `OTHER_COUNTRIES`). `<VERIFY>` whether mobile already has an equivalent list; if so, confirm the
  two agree, because the validator rejects anything not in the list.
- Autofill tokens: `street-address`, `address-level2` (city), `postal-code`,
  `address-level1` (region), `country`. These are the web names — `<VERIFY>` the RN equivalents.
- `maxLength` from the web: street 150, city/region 80, postal 10.
- Five required fields on one screen is the longest form in the flow. Keyboard-vs-footer must be
  measured here specifically, on the `country` row, which is a picker and not a text input —
  a picker opening with the keyboard already up is its own layout case.
- Errors on blur; all shown after a failed Continue.

## Resume mode

Prefilled from `personalInfo.address` (web `:392-393`), with `region` read back out of
`addr.district`. Resume opens here when **any** of the five is missing (web `:405`).

## Open question

The web collects a full street address but tells the seller buyers see only city and country.
Confirm that is actually true of the mobile listing surfaces before repeating the promise —
`<VERIFY>` what the listing detail and seller profile screens render from the address. A promise
the app breaks is worse than not making it.

## Acceptance

All five enforced. Each message seen once. A non-Latin city name accepted. `region` lands in
`district` — checked against the stored row, not against the success response. Country picker
opens and closes cleanly with the keyboard up.

---

## Progress

**2026-10-05 — BUILT as a UI mock, behind the `__DEV__` route only.**

⚠️ **This screen collects business identity — the category App Review rejected this app for
twice under Guideline 3.1.1** (`app/(lab)/sell/apply.tsx:12-48`). It exists only because the
owner asked for the remaining screens to be completed, and it is reachable *only* in a dev
build: `__DEV__` is false in every release and the branch is stripped by the bundler, so this
is not the "hidden feature" Guideline 2.3.1 forbids. **It must not be wired into a shipped
flow until someone answers whether the app may collect business identity at all.**

`OnboardingFlow.tsx` case `'location'`, rendered by the shared `FieldStack` on the kit's
`Field`. Verified in Chrome at 390×844 — `_proof/build-07-business-light.png`,
`_proof/build-08-business-validation.png`.

All five fields are required and carry the web's rules verbatim via `validateField()` —
including the Unicode-aware `PLACE_RE`, so 東京 and Đà Nẵng pass. The subhead "Buyers only see
the city and country" is kept, because this file argues it is the reason anyone types a street
address at all.

⚠️ **`region` must map to `district` on the wire** when this is saved — the mock stores it as
`region` and nothing converts it yet.

**Not done:** no save, and **`country` is a plain text field, not a picker** — the kit's
`PickerRow` should replace it, which also means sourcing the country list. Labels are
hardcoded English.

---

## Progress — 2026-10-05, second pass

**The 3.1.1 warning above stands, unchanged.** A registered business address is in the same
category as the company name and tax ID on screen 04. Reachable only from
`app/(auth)/onboarding-mock.tsx`, which redirects to login when `__DEV__` is false (`:27`).

⚠️ **That warning does not extend to screen 02.** `02-account.md`'s "NOT BUILT, blocked on 3.1.1"
header was wrong — email, name, phone and password are not business identity. **04 and 05 are the
3.1.1-sensitive screens; 02 is not.**

**`region` → `district` is now handled.** The previous entry's warning that "the mock stores it as
`region` and nothing converts it yet" is superseded: `saveStep('location', …)` writes
`district: a.values.region` inside the `address` object (`useOnboardingApi.ts:185-196`), with a
comment at `:190-191` naming the trap. Written, not exercised — the write path is interlocked off
behind `EXPO_PUBLIC_ONBOARDING_API=1` **and** a `testapi.greenbidz.com` URL, and no call has ever
been made (`00-introduction.md`).

⚠️ **The `country` rule is not the one tabled above.** This file says "must be in the known country
list" with the message "Select a country from the list". What is implemented is a **non-empty
check only** — `return v ? '' : 'Select your country'` (`mockState.ts:123-124`). With `country`
still a free-text `Field` and no list to check against, any typed string passes and reaches the
`address.country` payload. Both halves of that — the picker and the list — are still open.

⚠️ **Correction to the entry above: its proof pointers are wrong.** It cites
`_proof/build-07-business-light.png` and `_proof/build-08-business-validation.png`, which are
screenshots of the **business** step, not this one. Both files exist, neither shows this screen,
and `_proof/` contains no capture of the location step in either the browser or the device run.

### ⚠️ Not verified anywhere

**This screen has never been walked on a device.** The device session covered role choice,
account, seller type and business only. Nothing here — the five required fields, the postal rule
this file flags as country-blind, the Unicode place regex on 東京 / Đà Nẵng, or the
keyboard-vs-footer case on the `country` row that this file singles out as its own layout problem
— has been exercised on hardware. The browser cannot stand in: typed text does not render in any
`Field` under react-native-web (`00-introduction.md`, second pass).

Treat "BUILT" here as "the code renders", nothing more.
