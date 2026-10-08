# Screen: Review hub, multi-item — `app/scan/grouped-review.tsx`

Where a multi-item scan is reviewed and submitted as one batch. Problems below are
**multi-marketplace only**. No fixes.

---

## 1 Mixed-marketplace batches — ✅ CORRECTED 2026-10-08, products DO file correctly

> **This section originally claimed that a mixed batch is silently collapsed to the first item's
> marketplace. That was wrong, and it was the headline finding of this audit.** I inferred the
> server's behaviour from the shape of the request instead of reading the handler. Corrected below;
> logged in `MISTAKES.md`.

**What the server actually does.** `services/groupedListingSubmitService.js:180-186`
(`resolveProductMarketplaceType`) derives each product's marketplace from **that product's own
`allowed_sites`**, falling back to its own `site_type`. `:407` then computes `site_id` per product
from it, and `:401` rejects with 400 any product that has neither.

**And the app sends it per product** — `buildFormData.ts:264`, in the grouped path
(`productMetaFromItem`):

```ts
allowed_sites: [marketplaceToAllowedSite(item.marketplace)],
```

So a batch of a lab centrifuge and a network switch **does** file each to its own marketplace.

**`?type=` is not used for routing at all.** Its only consumer is `:670`, where it becomes the
`platform` field of the admin "productAdded" notification email. So the batch-wide value taken
from `items[0]` (`submitGroupedListings.ts:172`) affects **one line in an internal email**, not
where anything lands.

### What is still wrong

- **The notification names the wrong marketplace for a mixed batch.** Cosmetic, internal, but it
  is a report someone may act on.
- **The code comment above `submitGroupedListings.ts:172` is still false** — it asserts the UI has
  no per-item marketplace picker, which it does (`grouped-edit.tsx:30`,
  `grouped-review.tsx:266-267`). It is what led to this wrong finding in the first place, and it
  will mislead the next reader the same way.

See §1b below for the one case where mixed genuinely fails.

---

## 1b ⛔ A mixed **lot** is rejected by the server, and the app only finds out at submit

Lot mode is the real constraint. `groupedListingSubmitService.js:459-468`:

```js
// A batch has one site_id, so a lot cannot span marketplaces.
if (lotMarketplace && lotMarketplace !== marketplaceType) {
  const err = new Error(
    "A combined lot must be a single marketplace; mixed marketplaces detected"
  );
  err.statusCode = 400;
```

So when `groupMode === "lot"` — the scrap-as-lot flow — a mixed selection is a hard 400.

The problem is **where the seller learns it**. Nothing on this screen prevents, warns about, or
even displays the condition. A seller combines several items into a lot, presses Submit, uploads
every photo, and receives a 400 after the upload completes. The server's message is clear and
specific; the app has no reason to wait until then to say it, because it knows each item's
marketplace the whole time.

`<VERIFY>` how this screen renders that 400 — whether the server's sentence reaches the seller or
is replaced by a generic failure. Not checked.

**This screen lets items differ.** It renders a per-item marketplace line and blocks on items that
have none:

- `grouped-review.tsx:163-165` — *"{n} products still need a marketplace."*
- `grouped-review.tsx:732-733` — per-item status *"Pick a marketplace"*
- `grouped-review.tsx:742-744` — `marketplaceLine`, the item's own marketplace label

and the per-item marketplace is genuinely settable, in the item editor
(`grouped-edit.tsx:30` imports `RoutingChip`; `grouped-review.tsx:266-267` — *"per-item marketplace
happens in the ITEM EDITOR, not on the hub"*).

**Submit then collapses them all to the first item's.** `submitGroupedListings.ts:172`:

```ts
const platform = marketplaceToPlatform(items[0]?.marketplace) ?? getSiteType();
const url = `/wp/create-grouped-listings?lang=…&type=${platform}`;
```

So a batch of a lab centrifuge (101lab) and a network switch (101it) posts **everything** to the
first item's platform.

**The code comment above that line is factually wrong and is what hides the bug:**

> `?type=` sourced from the first item's marketplace. All items in a single grouped submit are
> assumed to share a marketplace (the grouped-review UI doesn't surface a per-item marketplace
> picker — sellers set marketplace once and items inherit).

The grouped-review UI *does* surface per-item marketplace, and the item editor *does* let a seller
set it. The assumption the comment rests on is false in the current build.

**It is made harder to see by a disagreement inside one request.** `buildFormData.ts:264` writes
`allowed_sites` **per item** from that item's own marketplace, while the URL's `?type=` is
batch-wide. So a mixed batch sends per-item `allowed_sites` that contradict the single `?type=`,
and which one wins is a server question.

`<VERIFY>` what the backend does when `?type=` and a product's `allowed_sites` disagree — not
tested. Until that is known, the blast radius of a mixed batch is unknown, not zero.

**The AI actively produces mixed batches.** The backend prompt asks for per-item routing in so many
words — `controller/wordPressSmart.js:428`: *"For EACH product in the products array, set site_type
and site_type_confidence for THAT item only (mixed uploads are common)"*. So the server is designed
to detect a mixed pile, this screen is designed to show one, and submit is the only step that
cannot carry it.

---

## 2 Nothing on the hub warns that a batch is mixed

The single most useful thing this screen could say — *"these items are going to different
marketplaces"* — is not said. The per-item marketplace is rendered as a quiet line in each row, so
a seller scanning a long list has no summary.

A seller cannot reasonably be expected to notice that row 3 says 101IT while rows 1, 2 and 4 say
101LAB. For an ordinary grouped submit that is merely unhelpful — the items file correctly either
way. In **lot** mode it is the difference between a submit that works and a 400 after every photo
has uploaded (§1b), and the screen that could say so says nothing.

---

## 3 Blocking on marketplace is all-or-nothing, with no way to resolve it from here

`grouped-review.tsx:163` blocks submit while *"{n} products still need a marketplace"*, but the
marketplace cannot be set on this screen — it is deliberately only in the item editor
(`:266-267`, *"a second write path to `marketplace` re-opens the …"*).

So the hub states a blocking condition it offers no control for. With a long batch the seller must
open each flagged item, set its marketplace, come back, and re-read the list to find the next one.
The rationale for the single write path is sound; the consequence on this screen is that the error
and its remedy are on different screens.

---

## 4 The checklist card stays here, so "what is missing" differs between the two flows

`app/scan/detail.tsx:312-327` records that `RequiredChecklist` was removed from the single-item
screen but **kept here**, because this screen has no `DetailFooter` and therefore no progress
strip — the card is its only persistent account of what is missing.

For marketplaces specifically that means the two flows report a missing marketplace differently:
the single-item screen reports it through the footer's chips and `missingRouting()`, this screen
through the checklist card and `blockedAllMarketplace`. Two renderings of one rule, which have to
agree and are not derived from a shared source.
