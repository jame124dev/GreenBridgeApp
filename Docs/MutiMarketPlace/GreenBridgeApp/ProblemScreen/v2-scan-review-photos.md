# Screen: v2 review — photos & marketplace — `app/v2/scan/review/photos.tsx`

The first of the v2 flow's four review screens, and where the v2 flow puts the marketplace choice.
Problems below are **multi-marketplace only**. No fixes.

---

## 1 This screen is correct — and that is the problem

Unlike its legacy twin, this screen resets the currency when the marketplace changes
(`photos.tsx:455-466`):

```ts
const next: Partial<DraftItem> = {
  marketplace: m,
  marketplaceConfirmed: true,
  // The four category trees share no ids, and the currency follows the
  // market — which is exactly what the footnote below promises.
  ...(changed ? CLEARED_CATEGORY_DRAFT_FIELDS : null),
  ...(changed ? { priceCurrency: defaultCurrencyForSite(m) } : null),
};
```

The legacy screens do the first half and not the second — `scan/detail.tsx:271` and
`scan/grouped-edit.tsx:296` spread `CLEARED_CATEGORY_DRAFT_FIELDS` alone.

So **the same seller action produces different data depending on which flow they are in**: route
an item to 101it in v2 and the price becomes TWD; do it in the legacy flow and it stays USD. The
comment here even states the intent as a promise made to the user by a footnote on this screen.

The problem is not this file. It is that marketplace behaviour is implemented twice and the two
implementations have already diverged on the first behaviour anyone looked at.

---

## 2 Both flows are reachable, so which behaviour a seller gets is not determined by the flag

`EXPO_PUBLIC_V2_UI=1` makes `/v2` the home (`postAuthLanding.ts:homeRoute`), but the screen that
rendered on the device on 2026-10-08 was the **legacy** `app/scan/detail.tsx` — identifiable
because `DetailAppBar`, which draws the "ITEM · REVIEW" header, is imported by that file and no
other.

So the flag does not cleanly select a flow; entry point does. A seller can reach the legacy
review screen in a v2 build, which means the currency behaviour they get depends on how they
started the scan, not on configuration.

`<VERIFY>` the full set of entry points into each flow — not mapped in this pass. Until it is, it
cannot be said which flow a given seller actually uses, and therefore which of the two marketplace
behaviours is the one in production.

---

## 3 The split across four screens gives marketplace a different neighbourhood

In the legacy flow the marketplace chip sits on the same screen as category, price and currency,
so the consequences of changing it are visible in place. Here the choice is on **photos** while
category is on `details.tsx` and price on `pricing.tsx`.

A seller changing the marketplace on this screen cannot see the category being cleared or the
currency being switched — both happen to fields on screens they are not looking at. The v2 flow
does the more correct thing and shows less of it.

---

## 4 Two implementations means every future marketplace rule has to be written twice

Stated as a standing problem rather than a specific defect. Marketplace-sensitive behaviour
currently includes: which category endpoint to fetch, clearing the category on change, defaulting
the currency, confirming the routing, and gating submit on `marketplaceConfirmed`.

Each of those exists in both flows. One has already drifted. There is no shared helper that both
call for "what happens when the marketplace changes" — `CLEARED_CATEGORY_DRAFT_FIELDS` is shared,
but the decision about what else accompanies it is duplicated at each call site
(`scan/detail.tsx:271`, `scan/grouped-edit.tsx:296`, `v2/scan/review/photos.tsx:455`).
