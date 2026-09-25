# Detected items — mobile vs web, feature by feature

Both captured at **390 × 844**, same file (`SOTW04060…0705.xlsx`, 10 items).
Web: `Docs/v2/v2scanweb/xlsx-04-detected-grid.png` (prod `101lab.co/valuation`, 2026-09-23).
Mobile: `Docs/v2/v2scan/web-harness/05-FIXED-items-10-rows.png` (Expo web harness, seller 574, dev DB).

Both agree on the headline: **10 items detected, 10 need review**, same titles, same order.

## Screen-level controls

| Feature | Web | Mobile | Gap |
|---|---|---|---|
| Count header | "10 items detected / 10 need review" | "10 found" + "10 to review" chips | ✅ parity |
| **Search** (title/brand/model) | ✅ | ❌ | **MISSING** |
| **Filter tabs** Needs review / Accepted / All | ✅ (with counts) | ❌ hardcoded `filter:'all'` (`items.tsx:188-193`) | **MISSING** |
| **Sort** ("Detection order") | ✅ | ❌ passes no `sort` | **MISSING** |
| **Select / bulk mode** | ✅ → Accept · Discard · Merge into one lot · Delete · Apply to selected | ❌ | **MISSING** |
| Copy share link | ✅ | ❌ | missing (low value on mobile) |
| Guidance line | "Accept the items you want to publish — none are accepted yet." | lede only | minor |
| **TOTALS** (asking / market band / scrap floor) | ❌ not on this step | ✅ USD 18,600 · market 13,750–25,350 · scrap 650–1,650 | **mobile AHEAD** |
| Stepper (1 Intake — 2 Detected — 3 Valuation) | ✅ | ❌ | **deliberate** — owner asked for it gone |
| Footer CTA | "Submit listings →" | "Review Remaining Items" + "Please decide on all items…" | ✅ parity |

## Row-level

| Feature | Web | Mobile | Gap |
|---|---|---|---|
| Thumbnail from inside the workbook | ✅ | ✅ | ✅ parity |
| Title | ✅ | ✅ | ✅ parity |
| **AI description paragraph** | ✅ full paragraph on the row | ❌ | **MISSING** |
| Condition | "Used — working" | "Used — functional" | ✅ parity (wording differs) |
| Category | chip | inline text | ✅ parity |
| **Qty** | "Qty 1" | ❌ | **MISSING** |
| Price | ❌ not on row | ✅ "USD 1,200" | mobile ahead |
| Grade | ❌ | ✅ "Grade C" | mobile ahead |
| **`Needs: …` chip** (amber, names each missing field) | ✅ "Needs: Operation status, Location" | ❌ | **MISSING — the validation surface** |
| "No location yet" chip | ✅ | ❌ | **MISSING** |
| Accept | ✅ ✓ button, **blocked when incomplete** | ✅ but **NO validation** (`items.tsx:214` bare status change) | **BEHAVIOUR DIFFERS** |
| Discard | ✅ | ✅ | ✅ parity |
| **Edit (pencil), separate from accept** | ✅ | ❌ (row chevron opens editor) | partial |

## The one that matters — validation

The web gates Accept on **7 fields** (`reviewBulk.ts:1131`): title, category, condition,
**operationStatus**, description, **location**, photos. An incomplete row cannot be accepted; the
row shows `Needs: …` naming the gaps, and pressing Accept opens the editor **scrolled to the first
one**. The drawer footer states "2 more to publish: Operation status, Location".

**Mobile has none of this today.** Accept is a status change with no predicate.
→ Being built now (Phase 4): the gate, the `Needs:` surface, the scroll-to-first-gap, Accept & next.

## Not covered by Phase 4 — needs Phase 3

Search · filter tabs · sort · bulk select (incl. Merge into one lot) · row description · Qty.
⚠️ `sort` IS honoured by the server (15 values, `helper/draftItemsQuery.js:86-91`) but
`normalizeSort` **fails silently** to the default, so a mis-wired control looks dead rather than
erroring. Assert the returned ORDER changed, never that the control changed.

## Defect visible in the mobile capture

The **`SYS → DARK` dev pill overlaps row 3's price** ("USD 1,200" is partly covered). Known as P16;
it has now sat on top of four real controls. It must move before any UI sign-off.
