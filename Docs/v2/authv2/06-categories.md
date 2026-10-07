# 06 — Equipment categories

**Web source:** step definition `SellerOnboarding.tsx:231`; render `:1070-1079`; save `:706-712`
**Shell:** `AuthShell` + `AuthStepRail index={3} total={6}`
**Step 4 of 6.** At least one required.

## What it asks

*What kind of equipment do you sell?* — *"Pick all that apply."* A wrap of selectable chips, one
per top-level category. Multi-select, no maximum.

Continue is blocked while the set is empty (`categories.length > 0`, web `:977`).

## Where the list comes from

`useLanguageAwareCategories()` — the real taxonomy, fetched, **not a hardcoded list**. The web
comments on this explicitly (`:254-256`): the design shipped with invented chip labels and they
replaced them with real slugs, because the value stored has to be a slug the rest of the system
recognises.

Chip label = `category.name`, chip value = `category.slug`. The hook is language-aware, so the
labels arrive already translated — **these particular strings must not go through the local
dictionary**, or they get double-translated.

**Top level only.** The web renders `labCategories.map(...)` with no subcategory expansion here,
unlike the old `/auth` signup which had a nested parent/child picker. Mobile matches the wizard:
flat.

## What it saves

Awaited `PUT /user/settings` with `{ interests: categories }` (web `:706-712`).
On failure: "Could not save your equipment categories. Please try again." and stay.

The same `interests` field backs the buyer's "equipment interest" on the old signup, so this is a
shared column serving two meanings — what a buyer wants to see, and what a seller sells.
`<VERIFY>` nothing downstream treats it as buyer-only before relying on it for seller matching.

## Mobile build notes

- `Chip` from the v2 kit, in a wrapping row. This is the component's purpose; do not build a
  second one.
- `StagedChip` also exists — check which of the two carries a selected state before choosing.
- Chips must be real toggles for accessibility: selected state announced, not conveyed by colour
  alone. The web uses a hidden `opacity-0` checkbox with a tinted border, which gives a screen
  reader nothing. Do not copy that.
- Touch target ≥44pt. The web chip is 41px tall — under the minimum. Raise it.
- The category list can be long. `<VERIFY>` how many top-level categories the hook actually
  returns; if it is more than fits a screen, this needs scroll inside the step with the footer
  pinned, which is a different layout from steps 04 and 05.
- Loading state: the hook is async and defaults to `[]`. An empty chip area with a disabled
  Continue and no explanation is a dead end — show a loading state, and an error state if the
  taxonomy fails. The web has neither.

## Resume mode

Prefilled from `personalInfo.interests`, mapped to slugs — the API returns either strings or
objects, and the web normalises both (`:384-386`). Keep that tolerance. Resume opens here when the
list is empty (web `:406`).

## Acceptance

Real categories render in the device's language. Multi-select works, Continue blocked at zero.
Selection survives a back-and-forward within the wizard. Saved slugs visible on the web dashboard
afterwards. Loading and failure states both seen.

---

## Progress

**2026-10-05 — BUILT as a UI mock.** `OnboardingFlow.tsx`, case `'categories'`.

**`Chip` was the wrong component and is not used.** It takes no `onPress` — it is a badge,
not a control. The kit's multi-select is **`PillButton`** with `tone="choice"` and
`role="checkbox"`, which draws its own ✓ and sets the right accessibility state. This also
resolves the 34pt touch-target concern raised in review: that number is `control.chip`, and
the chip is not what this screen uses.

**⚠️ The category list is a placeholder.** `MOCK_CATEGORIES` in `mockState.ts` — ten hardcoded
`{slug, name}` pairs. The real taxonomy is `useLanguageAwareCategories()`, which fetches, so it
is excluded under the no-API instruction. The shape matches so the swap is one line. These
strings must never reach a submit payload — the web source has a comment about exactly this
mistake.

**Not done:** loading and error states for the taxonomy fetch (there is no fetch yet), and the
real localised names.

---

## Progress — 2026-10-05, second pass

### ⚠️ This screen is UNKNOWN, not built-and-working

`PillButton` renders and announces each option as a checkbox, but **no tap has ever been seen to
register.** Under react-native-web neither a CDP click nor a full synthetic
`pointerdown`/`pointerup`/`click` sequence toggled anything, and `aria-checked` never appeared —
finding 1 in `00-introduction.md`'s first-pass entry. **It was never retried on a device**, and
the device session (role choice, account, seller type, business) stopped two steps short of here.

So the state of this screen is genuinely open:

- most likely a react-native-web harness limitation — `PillButton` ships in the app today, and it
  takes its `Pressable` from `react-native-gesture-handler` where the working screens take theirs
  from `react-native`;
- but it has **not been shown working anywhere**, and `canAdvance` for this step is
  `categories.length > 0` (`mockState.ts:311-312`), so if the tap does not register on a handset
  the Continue button never enables and **the wizard cannot be completed at all**.

That makes it the one step that can block the whole flow, and the first thing to check in the next
device session. Do not "fix" it by swapping to RN's `Pressable` before testing — that would break
the native case the component's own comment documents.

### The save is written and interlocked off

`saveStep('categories', …)` → `PUT /user/settings { interests }` (`useOnboardingApi.ts:198-200`),
awaited, holding the user on the step if it fails. Nothing has been sent: the write path needs
`EXPO_PUBLIC_ONBOARDING_API=1` **and** a `testapi.greenbidz.com` URL and no call has ever been
made — see `00-introduction.md`.

⚠️ When it is switched on, this step would post `MOCK_CATEGORIES` slugs
(`mockState.ts:188-199`) — ten hardcoded placeholders, not the real taxonomy. The header of that
file says they must never reach a submit payload; the write path as written does not stop them.
`useLanguageAwareCategories()` has to replace the list **before** the API is ever enabled, not
after.

**Step number unchanged:** this is step 4 of 6, and the rail's 6 is `steps.length`, not a literal
(`OnboardingFlow.tsx:325`).

## Progress — 2026-10-06: `PillButton` works on a handset — the UNKNOWN is resolved

The open question this file carried — *does `PillButton` respond at all?* — is answered on the
Samsung SM-G781B: tapping a chip fills it solid green with a leading tick while the rest stay
outlined (`_proof/device-17-categories-chip-selected.png`, "Analytical instruments" selected,
step 4 of 6). The non-response seen earlier was a react-native-web limitation, not a defect in
this screen. "Categories is built" can now mean it can be used, not only that it renders.

Everything else in this file stands, including the `MOCK_CATEGORIES` warning above:
`useLanguageAwareCategories()` must replace the ten hardcoded slugs **before**
`EXPO_PUBLIC_ONBOARDING_API` is switched on.
