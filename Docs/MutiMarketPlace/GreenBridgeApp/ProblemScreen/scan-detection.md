# Screen: Detection / "what we found" — `app/scan/detection.tsx`

The screen after a multi-photo scan, listing the products the AI found before the seller reviews
them. Problems below are **multi-marketplace only**. No fixes.

---

## 1 ⛔ The server returns a marketplace per item and this screen never shows it

The backend asks the model for per-item routing in so many words
(`controller/wordPressSmart.js:428`):

> For EACH product in the products array, set `site_type` and `site_type_confidence` for THAT item
> only (**mixed uploads are common**)

and the per-item shape is in every locale prompt (`:589`, `:614`, `:640`, `:666`) as
`{ id, label, image_indexes, site_type, site_type_confidence }`.

`app/scan/detection.tsx` contains **zero** references to `site_type` or `marketplace` — verified by
grep, count 0. The screen renders a title, an overall confidence percentage
(`detection.tsx:249`) and a rename affordance, and drops the routing entirely.

So the first screen where a seller could learn "these three items are going to two different
marketplaces" shows a single batch-level confidence number instead. The routing information exists,
crosses the wire, and is discarded at the point it would be most useful.

---

## 2 The confidence shown is the wrong confidence for the marketplace question

`confidencePct` (`:249`) comes from `pendingDetection.meta.confidence` — the **batch-level** figure
for the single-vs-multiple mode decision. The per-item `site_type_confidence` is a different
number about a different question.

A seller reading "92% confident" on this screen will reasonably take it to cover what the screen is
showing them, including where each item will be listed. It does not. Given routing is wrong about
1 item in 9, a batch-level confidence displayed next to per-item results is actively misleading
about the one dimension that is not displayed.

---

## 3 Renaming an item cannot correct its routing

`renameProduct` (`:119-129`) lets the seller overwrite a product's title and the AI's `name`. That
is the only correction this screen offers.

If the AI has labelled something correctly but routed it to the wrong marketplace, there is nothing
to press here. The seller must carry on to the item editor to discover and fix it — and the editor
is per-item, so a batch wrongly routed as a whole has to be corrected one item at a time.

---

## 4 Nothing prevents, flags, or explains a mixed batch at the moment it is formed

This is the screen where a mixed batch becomes a batch. For ordinary grouped submits that is fine
— the server files each product by its own marketplace
([scan-grouped-review.md](scan-grouped-review.md) §1).

It is **not** fine for a lot: a mixed lot is rejected outright with a 400
(`groupedListingSubmitService.js:459-468`, §1b there), and the seller discovers it only after
uploading every photo. This screen is the earliest point at which the app knows the items are
mixed, and it says nothing.
