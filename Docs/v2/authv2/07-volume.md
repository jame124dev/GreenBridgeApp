# 07 — How much they sell

**Web source:** step definition `SellerOnboarding.tsx:232-237`; options `:62-73`; save `:713-719`
**Shell:** `AuthShell` + `AuthStepRail index={4} total={6}`
**Step 5 of 6.** One choice, required.

## What it asks

Both the question and the three answers change with the screen-03 answer.

**Reseller** — *"How many items do you usually have for sale?"*

| Value | Label | Sub-label |
|---|---|---|
| `a` | Under 25 items | A small, rotating inventory |
| `b` | 25–100 items | A steady catalogue |
| `c` | 100+ items | High-volume — we can help with bulk upload |

**Company** — *"How much equipment are you selling?"*

| Value | Label | Sub-label |
|---|---|---|
| `a` | Just a few items | One-off surplus |
| `b` | A lab clear-out | Roughly 10–50 items at once |
| `c` | Ongoing surplus | We regularly retire equipment |

## ⚠️ The stored value is `a`, `b` or `c`

Both sets use the same three opaque values. So `monthly_volume = "b"` means *"25–100 items"* for a
reseller and *"a lab clear-out"* for a company — **the value is meaningless without
`seller_type`**.

Consequences to respect:

- Anything reading `monthlyVolume` must read `sellerType` alongside it, or it will report nonsense.
- Changing `seller_type` later silently re-interprets an already-saved volume. Nothing on web
  re-asks. `<VERIFY>` whether that matters to whoever consumes the field.
- Do not "improve" this on mobile by storing a descriptive string. The column is shared with web
  and the two must agree. Record the concern, keep the values.

The field name is `monthly_volume`, but neither question asks about a month. Noted so nobody
reads the column name as a definition.

## What it saves

`POST /user/onboarding-details` with `{ user_id, monthly_volume }` (web `:713-719`).
Awaited; on failure "Could not save your monthly volume. Please try again." and stay.

## Mobile build notes

- Three `OptionCard`s — same component and layout as screen 03. If 03 and 07 do not look identical,
  one of them is wrong.
- Continue disabled until one is chosen.
- The option *copy* must be rebuilt from `sellerType` at render, not captured once. If someone goes
  Back to 03, changes the answer and returns, stale copy here is a visible lie about what they are
  answering.
- Longest sub-label is "High-volume — we can help with bulk upload" — check it does not clip at the
  narrowest supported width in the longest language.

## Resume mode

Prefilled from `od.monthlyVolume` (web `:400`). Resume opens here when it is missing (web `:407`).

## Acceptance

Both option sets seen on a device by switching the screen-03 answer and returning — not just the
one. Continue blocked until chosen. The stored value round-trips through `?resume=1` with the right
option pre-selected.

---

## Progress

**2026-10-05 — BUILT as a UI mock.** `OnboardingFlow.tsx`, case `'volume'`.

The option set is **rebuilt from `sellerType` at render**, not captured once — going back to
the seller-type step, changing the answer and returning changes this screen's question and all
three options. A stale copy here would ask one question while recording another.

`VOLUME_OPTIONS` in `mockState.ts` keeps the web's opaque `a` / `b` / `c` values deliberately,
with a header note that the value is meaningless without `sellerType`. The column is shared
with web; the two clients must agree.

**Not done:** no save.

---

## Progress — 2026-10-05, second pass

**The save is written.** `saveStep('volume', …)` → `POST /user/onboarding-details
{ monthly_volume }` (`useOnboardingApi.ts:201-205`), awaited, holding the user on the step if it
fails. It is interlocked off — `EXPO_PUBLIC_ONBOARDING_API=1` **and** an API URL containing
`testapi.greenbidz.com` are both required (`useOnboardingApi.ts:61-65`) — and **no call has ever
been made.** See `00-introduction.md`.

The opaque `a` / `b` / `c` values survive to the wire unchanged, as this file insists they must:
`monthly_volume: a.volume`, no translation layer. The concern stands with them — anything reading
the column still has to read `seller_type` alongside, and changing `seller_type` later still
silently re-interprets a saved volume. Nothing re-asks.

⚠️ **Correction to the entry above: this screen has not been walked on a device.** The
fork-rebuilds-from-`sellerType` behaviour was verified **in Chrome only**
(`_proof/build-04-volume-company.png`). The device session covered role choice, account, seller
type and business, and stopped before this step. This file's own acceptance criterion — "both
option sets seen **on a device**" — is unmet.

The code is right to be confident about: the options are read at render from
`VOLUME_OPTIONS[ob.sellerType ?? 'reseller']` (`OnboardingFlow.tsx:445`), never captured. But
"derived correctly in the source" is not the same claim as "seen on hardware", and only the first
has evidence.

**Step number unchanged:** step 5 of 6, the 6 derived from `steps.length`.

## Progress — 2026-10-06: the `sellerType` fork is now seen on hardware

The unmet acceptance criterion above — *"both option sets seen on a device"* — is half met, and
the half that matters most is the one that proves the fork is live rather than merely correct in
source. Walking as a **reseller** on the Samsung SM-G781B renders the reseller option set:
*Under 25 items / 25–100 items / 100+ items* with their descriptions, at step 5 of 6, the middle
option selected (`_proof/device-18-volume-reseller-set.png`).

The **own-company** set has still never been rendered on a device, so the criterion as written is
not yet fully satisfied. Reaching it needs a second walk with "I sell for my own company" chosen
at step 1.
