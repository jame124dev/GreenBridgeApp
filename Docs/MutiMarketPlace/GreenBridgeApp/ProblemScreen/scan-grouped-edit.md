# Screen: Item editor, multi-item — `app/scan/grouped-edit.tsx`

The per-item editor reached from the review hub. **The only place a per-item marketplace can be
set** (`grouped-review.tsx:266-267`). Problems below are **multi-marketplace only**. No fixes.

---

## 1 ⛔ The same currency bug as the single-item screen

`grouped-edit.tsx:296` spreads `CLEARED_CATEGORY_DRAFT_FIELDS` on marketplace confirm and nothing
else. As on `scan/detail.tsx`, that set contains no currency
(`routingState.ts:233-245`), so routing an item to **101it** leaves its price in **USD** on a TWD
marketplace.

This is the second of two places with the identical defect, and in a batch it is worse: a seller
can route several items to 101it one after another and every one of them keeps USD.

See [scan-detail.md](scan-detail.md) §1 for the full reasoning and the v2 twin that does it
correctly.

---

## 2 ⚠️ The marketplace lives in two places at once while this screen is open

Documented in the code itself (`grouped-edit.tsx:92-98`):

> this screen has NO reset effect (defaultValues are set once), so after the RoutingChip changes
> the form value **the store item still holds the old marketplace until Save**.

So between a marketplace change and Save, `form.watch('marketplace')` and
`queuedItems[index].marketplace` disagree. The screen works around it by reading the **form** for
the category tree, and the comment spells out the cost of getting it wrong: a store read would
resolve `categoryName` against the wrong tree, land `null`, and *"silently drop `category_name`
from the submit payload"*.

The problem is not the workaround, it is the invariant: **a marketplace change is not committed
until Save**, so every consumer on this screen has to know which of the two sources is current.
Any new code added here that reads the store is wrong by default, and the failure mode is a
silently missing field rather than an error.

Also note the ordering constraint — *"`useForm` must stay ABOVE this line"* — meaning the fix for
this is load-bearing on statement order in the component body.

---

## 3 Leaving without saving silently reverts the marketplace

Follows from §2. Because the change only reaches the store on Save, a seller who picks a
marketplace here and then backs out — or is bounced by the guard at `:102-103`
(`if (!item) router.replace(routes.scanGroupedReview)`) — returns to a hub still showing the old
marketplace, or "still needs a marketplace".

Combined with the hub blocking on exactly that condition, a seller can plausibly answer the
question, leave, and find it unanswered.

---

## 4 Changing marketplace here can silently invalidate work done on the hub

`CLEARED_CATEGORY_DRAFT_FIELDS` wipes the item's category whenever its marketplace changes — the
same unannounced clearing as the single-item screen ([scan-detail.md](scan-detail.md) §3), but on
this screen the seller may have set that category in a different session and will see it vanish
on return to the hub, one row among many, with no message.

---

## 5 Nothing here indicates the item is part of a mixed batch

This is the screen where a seller creates the mixed-marketplace condition. For an ordinary grouped
submit that is supported — each product files to its own marketplace
([scan-grouped-review.md](scan-grouped-review.md) §1).

For a **lot** it is fatal: the server rejects a mixed lot with a 400 (§1b there). Choosing 101IT
for item 3 of 5 is presented here as an ordinary per-item choice, with nothing to indicate it
differs from its siblings — or that, in lot mode, it has just made the batch unsubmittable.
