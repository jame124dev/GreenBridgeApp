# Screen: Review a single item — `app/scan/detail.tsx`

The legacy one-screen review form. Header reads **ITEM · REVIEW**. This is the screen that
rendered on the device on 2026-10-08, so it is live, not dead code.

Problems below are **multi-marketplace only**. No fixes.

---

## 1 ⛔ The price currency does not follow the marketplace

`defaultCurrencyForSite` (`src/features/scanner/constants.ts:93`) returns **TWD for 101it** and USD
for everything else. The currency is applied when the draft is first built
(`src/stores/scanDraftStore.ts:273` and `:368`) — that is, against the marketplace the draft
*started* with.

When the seller then changes the marketplace on this screen, the confirm handler patches:

```tsx
useScanDraft.getState().patch({
  marketplace,
  marketplaceConfirmed: true,
  ...CLEARED_CATEGORY_DRAFT_FIELDS,     // app/scan/detail.tsx:271
})
```

`CLEARED_CATEGORY_DRAFT_FIELDS` (`routingState.ts:233-245`) contains **only** `categoryId`,
`categoryName`, `parentCategoryId`, `parentCategoryName`, `customSubcategory`. No currency.

So a seller who routes an item to **101it** keeps a **USD** price field on a TWD marketplace, and
nothing on screen says so. The v2 twin does the opposite — it resets the currency explicitly
(`app/v2/scan/review/photos.tsx:462`) with the comment *"the currency follows the market — which is
exactly what the footnote below promises"*. So the intended behaviour is documented, and this
screen does not do it.

**Worse than a wrong default:** the Currency control converts an already-typed amount
(`PricingCard.tsx`, `handleCurrencyChange`). A seller who typed 12,500 meaning USD and later
switches marketplace does **not** get a conversion — the number stays and only its meaning changes.

`<VERIFY>` what the backend stores when `priceCurrency` disagrees with the target site's expected
currency — not checked.

---

## 2 The marketplace chip is invisible whenever the allow-list has one entry

`routingNeedsAsk` returns false when `supported.length <= 1`
(`src/features/scanner/routing/routingState.ts:136`), and `RoutingChip` renders nothing in that
case.

That is correct behaviour, but it makes this screen's marketplace affordance **silently
conditional on a server response**. The allow-list comes from `GET /mobile-config`, cached in MMKV
and falling back to the build's own site type. So on a fresh install with no successful fetch, the
seller sees a review screen with **no marketplace control at all** and the item is routed to
101lab without being asked.

The launch prefetch in `app/_layout.tsx` is what normally prevents it, and
`supportedMarketplacesCache.ts:62-70` says so explicitly: *"on a FRESH INSTALL the cache is empty,
so this returns ONE marketplace … the first scan would behave exactly like 1.0.3"*.

So the failure is: first scan after install, on a cold or offline network, silently single-market.
There is no on-screen indication that a choice was skipped.

---

## 3 Changing the marketplace silently discards the category the seller already picked

By design — the four marketplace category trees share no ids, so the old `categoryId` is
meaningless against the new tree. `CLEARED_CATEGORY_DRAFT_FIELDS` is spread on every confirm, and
`detail.tsx:219-236` explains why it must ride in the same patch (a patch carrying only
`marketplace` would let the form's reset effect restore the old category and submit it against the
new tree).

The **problem is that the seller is not told**. The Category row simply returns to
"Not set — pick a category" with no explanation that their earlier answer was dropped because they
changed marketplace. On a screen where Category is one of the blocking required fields, work
disappearing without a sentence is the kind of thing that reads as a bug.

Note it clears unconditionally, including when the seller re-confirms the **same** marketplace —
`detail.tsx:229-235` argues that is the honest outcome, but it means an accidental re-tap of the
current marketplace also wipes the category.

---

## 4 Condition options are identical across all four marketplaces

`VALID_CONDITION_KEYS` (`src/features/scanner/constants.ts:11-17`) is one flat list —
`new`, `usedFunctional`, `forParts`, `wasteDisposal`, `demolitionRemoval` — used whatever the
marketplace.

"Waste disposal" and "Demolition / removal" are recycle vocabulary; "New" and "For parts" are
equipment vocabulary. A seller listing a lab centrifuge on 101lab is offered two conditions that do
not apply to it, and the same five options appear on 101it where "demolition" is meaningless.

This was already identified as a product decision ("condition taxonomy split") and is unowned.

---

## 5 The AI badge does not distinguish "the AI chose this marketplace" from "you did"

`aiProvenance.ts` marks fields the AI filled, and `FieldLabel` renders an AI badge for them. The
marketplace is not one of those fields — it is a draft field (`marketplaceConfirmed`), invisible to
`detailSchema`.

So the screen shows AI provenance for Title, Brand, Model and Category, but a seller cannot tell
from this screen whether the marketplace was the AI's 89%-accurate guess or their own choice.
Given routing is wrong roughly 1 item in 9, the one field whose provenance most deserves marking is
the one that is not marked.

---

## 6 Category load failures are per-marketplace and read as generic

`useLabCategories(marketplace)` fetches a different endpoint per marketplace
(`fetchCategories.ts:55-69` — `/product/lab/category`, `/product/machines/category`,
`/product/it/category`, `/product/category`). Each is a separate backend surface that can fail
independently.

If the 101machine tree fails while 101lab's is cached, the seller sees an empty or offline category
state with no indication that it is specific to the marketplace they just chose — and switching
back would fix it. `CategoryConditionCard.offlineLabel.test.tsx` exists, so an offline label is
rendered, but `<VERIFY>` whether it names the marketplace.
