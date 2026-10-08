# Solutions — Review a single item (`app/scan/detail.tsx`)

Answers [`../ProblemScreen/scan-detail.md`](../ProblemScreen/scan-detail.md), section for section.

---

## 1 Currency follows the marketplace — via one shared helper, not a third copy

**Do not** paste `priceCurrency: defaultCurrencyForSite(m)` into `detail.tsx:271`. That makes three
independent answers to the same question and is exactly how the current drift happened.

Add to `src/features/scanner/routing/routingState.ts`, beside the constants it already exports:

```ts
/**
 * Everything that must change when the seller picks a different marketplace.
 *
 * ONE answer, called from all three places that offer the choice —
 * app/scan/detail.tsx, app/scan/grouped-edit.tsx and
 * app/v2/scan/review/photos.tsx. They had drifted: all three cleared the
 * category, only the v2 one reset the currency, so routing an item to 101it
 * left a USD price on a TWD marketplace in two of the three flows.
 */
export function marketplaceChangePatch(
  next: MarketplaceKey,
  opts: { changed: boolean; fromCurrency: SupportedCurrency; typedAmount?: string },
): Partial<DraftItem> { … }
```

It returns `{ marketplace, marketplaceConfirmed: true }` always, and when `changed`:
`...CLEARED_CATEGORY_DRAFT_FIELDS` plus `priceCurrency: defaultCurrencyForSite(next)` plus a
converted `pricePerUnit` (below).

Then all three call sites become one line, and a future marketplace-sensitive rule is added once.

### The amount, not just the label — **DECISION**

Changing `priceCurrency` alone silently redenominates a number the seller already typed: 12,500
meant as USD becomes 12,500 TWD. Three options:

| option | behaviour | cost |
|---|---|---|
| **convert** (recommended) | reuse `convertPrice(amount, from, to)` — `src/features/scanner/currencyFx.ts:13` — exactly as the Currency pills already do via `handleCurrencyChange` | a rate the seller did not ask for, but consistent with the control next to it |
| clear | blank the amount and let them retype | honest, loses work, Price goes back to blocking |
| leave | today's behaviour in v2 | the number silently means something else |

**Convert** is recommended because the Currency control on this very card already converts, so
anything else makes two controls that change currency behave differently.

Whichever is chosen, say it on screen — one line under the price when the marketplace change moved
the currency.

### Test that pins it

A test asserting the patch for `101lab → 101it` carries `priceCurrency: 'TWD'`, and that all three
call sites use the helper (grep-style enumeration, not three separate unit tests — see the
`rollout needs an enumerating test` precedent).

---

## 2 Make the "no choice offered" case visible instead of silent

The fresh-install path is correct to fail closed; the problem is that it is indistinguishable from
"you have one marketplace".

Smallest honest change: when `supported.length <= 1` **and** the list came from the fallback rather
than a successful fetch, render the marketplace as a stated fact rather than nothing — a quiet
read-only line, "Listing on 101LAB", instead of an absent control.

`supportedMarketplacesCache.ts` already distinguishes the two cases internally
(`readCachedSupported()` vs `fallbackMarketplaces()`); `supportedNow()` collapses them. Return the
provenance alongside the list so the UI can tell "one marketplace is all there is" from "we could
not ask".

Do **not** block the scan on a successful fetch. An offline seller must still be able to work; the
fix is to stop the screen implying a decision was made.

---

## 3 Say that the category was cleared, and why

One line in the Category row when `categoryName` was cleared by a marketplace change in this
session — *"Pick a category for 101IT — the previous one does not exist here"*.

Requires a transient flag, not a draft field: set it in the same `onConfirm` patch, clear it when
a category is chosen. Do not persist it; it is about the last action, not the item.

Also stop clearing on a **no-op re-tap**: `RoutingChip.pick` already guards its form-side clear on
`m !== current` (`detail.tsx:229-235`), so the store patch can take the same guard. The current
argument for clearing unconditionally — that the seller has just been shown "we won't guess the
category" — does not hold when they re-confirmed the marketplace they already had.

---

## 4 Condition options per marketplace — **DECISION, then a data change**

`VALID_CONDITION_KEYS` (`src/features/scanner/constants.ts:11-17`) becomes a per-marketplace map.
Mechanically easy; the content is the decision.

Needed before code: which conditions are valid on each of 101lab, 101machine, 101it (and
101recycle when it arrives), and what happens to a draft whose condition is invalid on the
marketplace it is moved to — clear it like the category, or keep and let submit fail.

⚠️ `condition` is a **backend contract**, like `operation_status`. Changing labels is safe;
changing the `value`s is not. The installation labels were changed on 2026-10-07 with exactly that
constraint recorded in `constants.ts:65-77` — follow that pattern.

Until the decision exists, this is not an engineering task and should not be started.

---

## 5 Mark the marketplace as AI-derived

`aiProvenance.ts`'s `useAiFilled()` compares a field's current value to `useScanDraft(s =>
s.current?.ai)`. Marketplace is not in that comparison because it is a draft field, not a form
field.

Smallest change: in `RoutingChip`, render the same AI badge `FieldLabel` uses when
`marketplaceConfirmed` is false and the AI supplied a `suggestedMarketplace` — i.e. the value on
screen is still the AI's guess. Drop the badge the moment the seller confirms, because from then
on it is their answer.

This is the field where provenance matters most: routing is right about 89% of the time, and it is
currently the only unmarked AI-derived answer on the screen.

---

## 6 Name the marketplace in the category error state

`CategoryConditionCard` already renders an offline/empty label
(`__tests__/CategoryConditionCard.offlineLabel.test.tsx`). Pass the marketplace into that string so
it reads *"Couldn't load 101MACHINE categories"* rather than a generic failure.

That alone tells the seller the failure is specific to the marketplace they just picked, which is
the actionable part — switching back works.

`<VERIFY>` the current wording first; it may already do this.
