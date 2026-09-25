# Phase 3 — Detected items, grid-lite for a phone

**Goal.** A 10-row lot is workable with a thumb: see what was found, fix the two fields that block
everything at once, accept in bulk, and get an honest "List N of M?" before moving on.

**Fixes:** P15. **Must not import:** W1 (dead bulk Accept). **Depends on:** Phase 1 (server-backed
`items.tsx`), Phase 2 (rows exist to bulk-edit).

## What the web's grid has, and what mobile takes (`03-web-reference.md` § Step 2)

| Web | Mobile | Why |
|---|---|---|
| Header counts "N items detected · N need review" | **take** — `items.tsx` has the counts strip | |
| Filter tabs Needs review / Accepted / All | **take** as segmented control | the three states are the whole workflow |
| Search title/brand/model | **skip** | 10–20 rows on a phone; scroll |
| Sort | **skip** | detection order is fine |
| Select → bulk toolbar | **take**: Accept · Discard · Apply to selected | the spreadsheet run needed exactly these |
| Merge into one lot · Delete | **skip** | desk work; delete is discard |
| Row: thumb, title, description, `condition · Qty`, `Needs: …`, category, location | **take**, trimmed: thumb, title, spec line, `Needs: …` chip, category | description belongs in the editor |
| Row: Edit fields / Accept | **take**: tap row → editor; swipe or button → Accept | Accept on an incomplete row opens the editor, as the web does |
| Apply to selected (field + value) | **take**: sheet with `Location · Country · Condition · Operation status` | the two blocking fields in the real run were Location and Operation status |
| Footer CTA reads the accepted count | **take**: "Continue with N" | |
| "List N of M? — M−N still need review…" confirm | **take** verbatim | the best gate in the flow |

## Scope

1. **Segmented filter** on `items.tsx` (kit: `Tabs` or `PillButton` group — report a KIT GAP if
   neither fits; do not hand-roll).
2. **Selection mode**: a "Select" `QuietAction` toggles checkboxes on rows and a bulk bar
   (`Accept · Discard · Apply to selected`) that replaces the footer while active.
3. **Apply to selected** as a bottom sheet: pick field, enter/choose value, "Apply to the N that need
   it" (the web's own label). Writes through the existing bulk endpoint if it supports field
   patches — `<VERIFY>` `draftItemsApi.ts` `DraftItemBulkOp` covers `location/operationStatus`; if
   it only covers status, this needs a backend op and goes to dev first.
4. **Bulk Accept that provably works.** Acceptance test is *the counts change*, never "the button
   responded" (the web's W1 was a button that responded). Rows that are incomplete are **not**
   accepted and the bar says how many were skipped and why.
5. **"List N of M?" confirm** before Continue when `needs_review > 0`, copy ported from the web.
6. **Row `Needs:` chip** — derive from the same completeness predicate the editor's footer uses
   (Phase 4) so the two never disagree.

## Files

`app/v2/scan/items.tsx` · `src/services/drafts/draftItemsApi.ts` · new
`src/features/v2/scan/applyToSelected.ts` (pure: field × value → bulk op) · six locale files ·
`src/features/v2/scan/__tests__/` (an enumerating test for the bulk bar's actions).

## Acceptance — device, dev DB, the 10-row xlsx

1. Land on `items.tsx` with 10 rows, "10 need review".
2. Select → Select all → Apply to selected → Location = Taipei → `No location yet` disappears from
   **all 10 rows** (count it).
3. Apply to selected → Operation status → all 10 `Needs:` chips lose it.
4. Bulk **Accept** → counts read **"Needs review 3 · Accepted 7"** (the 3 lacking Category stay),
   and a line says "3 skipped — Category missing".
5. Continue → **"List 7 of 10 items?"** → Continue with 7 → Valuation.
6. Tabs: Accepted shows 7, Needs review shows 3, All shows 10.

Both schemes. Longest real title (the KUBOTA row is 62 characters) does not push the chip off-screen.

## Exit criteria

Screenshots into `Docs/v2/v2scan/phase-3/` beside `../../v2scanweb/xlsx-05`, `-08`, `-09`, `-10`.
`tsc` clean, `jest` green including the new enumerating test.
