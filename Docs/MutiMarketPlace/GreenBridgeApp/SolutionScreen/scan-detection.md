# Solutions — Detection / "what we found" (`app/scan/detection.tsx`)

Answers [`../ProblemScreen/scan-detection.md`](../ProblemScreen/scan-detection.md).

The data for all of this already arrives. Nothing here needs a backend change.

---

## 1 Show each item's marketplace

The server returns `site_type` and `site_type_confidence` **per product**
(`controller/wordPressSmart.js:428` and the four locale prompts). The app already has
`marketplaceFromSiteType()` (`constants.ts:139`) to turn that into a `MarketplaceKey`, and
`MARKETPLACE_OPTIONS` (`constants.ts:49-58`) to label it.

Add the label to each found-product row. A small marketplace tag beside the title is enough — this
screen is a list, not an editor.

Where the mapper returns `null` (the AI named something this build does not support), show nothing
rather than guessing. `marketplaceFromSiteType` returns `null` precisely so callers can tell
"AI suggested X" from "AI said nothing"; do not `?? '101lab'` it here, which is the fallback the
submit paths use and would be a lie on a screen whose job is to report what was found.

---

## 2 Use the right confidence, or no confidence

`confidencePct` (`detection.tsx:249`) is `pendingDetection.meta.confidence` — the **batch-level**
single-vs-multiple figure. Displayed beside per-item results it reads as though it covers them.

Two acceptable outcomes:

- **label it for what it is** — tie the percentage to the mode decision in the copy, so it cannot
  be read as per-item accuracy; or
- **move to per-item** — show each item's own `site_type_confidence` on its row, and drop the
  batch number.

⚠️ If per-item confidence is shown, it must not become a gate. `routingState.ts:163-167` records
that **no confidence threshold may gate the routing ask**, because every measured routing error
arrived at high confidence, so a cut-off would have caught none of them — and `noThreshold` in
`routingState.test.ts` pins that. Displaying a number is fine; branching on it is not.

---

## 3 Let the marketplace be corrected here

`renameProduct` (`:119-129`) establishes the pattern: this screen can already correct the AI
in place. Extend the same affordance to routing — tapping the marketplace tag opens the same
`OptionSheet` the `RoutingChip` uses and writes the item's marketplace.

This is the cheapest correction point in the whole flow: the seller is already looking at a list
of what was found, with photos, and can fix three items in three taps instead of opening three
editors.

If this lands, it becomes a **second write path to `marketplace`**, which
`grouped-review.tsx:266-267` deliberately avoided. Route it through the same helper as everything
else (`marketplaceChangePatch`, [`scan-detail.md`](scan-detail.md) §1) so "second path" means a
second caller, not a second set of rules.

---

## 4 Flag a mixed batch at the moment it is formed

With §1 in place this is nearly free: if the found items span more than one marketplace, say so
once above the list.

What that line should say depends on the decision in
[`scan-grouped-review.md`](scan-grouped-review.md) §1 — informational if mixed batches become
supported, a warning if they are to be refused. Write it after that decision, not before, or the
copy will have to change twice.
