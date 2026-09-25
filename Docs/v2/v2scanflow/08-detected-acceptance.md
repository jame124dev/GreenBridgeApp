# Detected items — the bar. Loop until every row is ✅.

Judged against `Docs/v2/v2scanweb/xlsx-04-detected-grid.png` (the web, prod, 390×844) and
`xlsx-07-item-detail-drawer.png` (the web's item drawer), using the SAME fixture:
`Docs/v2/v2scan/web-harness/inventory-fixture.xlsx` → 10 items.

**Rule for every row: the evidence is a control PRESSED and the result observed. A screenshot
proves appearance, not function. For anything whose job is to change a list, the test is
"the returned set or order CHANGED", never "the control responded" — `normalizeFilter` and
`normalizeSort` both fail silently to their default, so a mis-wired control looks dead, not broken.**

## A. The grid (`app/v2/scan/items.tsx`)

| # | Must be true | How it is proven | State |
|---|---|---|---|
| A1 | Row names its gaps — `Needs: Operation status, Location` | seen on all 10 rows | ✅ 2026-09-23 |
| A2 | Accept REFUSES an incomplete row and opens the editor on the first gap | pressed; landed on the missing field | ✅ 2026-09-23 |
| A3 | Accept SUCCEEDS on a complete row; counts move | fill the gap, press Accept, counts change | ☐ |
| A4 | Filter tabs Needs review / Accepted / All, with counts | press each; **row set changes** | ☐ |
| A5 | Search finds by title/brand/model | type a term; **set shrinks**; clear restores | ☐ |
| A6 | Sort changes the ORDER | pick two sorts; **diff the first 3 titles** | ☐ |
| A7 | Bulk select → Accept / Discard | select 2, run, counts move by 2 | ☐ |
| A8 | **Merge into one lot** | select 2 same-marketplace; rows share a lot | ☐ |
| A9 | Mixed-marketplace merge is REFUSED with a message, not a silent no-op | force it; the 400 is surfaced | ☐ |
| A10 | Apply to selected (Location / Condition) — ONE bulk call | select 2, apply, both rows show it | ☐ |
| A11 | Row shows the AI description and Qty | compare against the web row | ☐ |
| A12 | TOTALS still correct after filtering | totals must not follow the filtered subset silently | ☐ |

## B. The item editor (`app/v2/scan/item.tsx`)

| # | Must be true | State |
|---|---|---|
| B1 | No stepper; one scroll | ✅ |
| B2 | Footer names what is left + Accept & next / Done | ✅ |
| B3 | **Field text is VISIBLE** (values are in the a11y tree but render blank) | ☐ |
| B4 | No app tab bar on a full-screen editor | ☐ |
| B5 | Primary CTA not under the dev pill | ☐ |
| B6 | Keyboard open: bottom field does NOT intersect the sticky footer — **measured** | ☐ |
| B7 | Every control pressed, both schemes | ☐ |
| B8 | Accept & next advances; last item says Accept | ☐ |

## C. Correctness, not cosmetics

| # | Must be true | State |
|---|---|---|
| C1 | `npx tsc --noEmit` = 0 | ✅ |
| C2 | No NEW jest failures beyond the 8 known (from moving 8 screens to `bkp/scan-old/`) | ☐ |
| C3 | Works on BOTH lanes — `local-N` and a resumed server draft — with the switch inside `draftItemsApi.ts`; `items.tsx` never branches on source | ☐ |
| C4 | Six locales, keys resolved BY PATH, no `json.dumps` | ☐ |
| C5 | No kit edits (`src/features/v2/ui/*`); gaps reported instead | ☐ |

## Open questions — answer, do not paper over

1. **The grid and the editor disagree.** Row says `Needs: Location`; editor says `Operation status, Location`, same item. The store holds `operationStatus: ['working']` — neither canonical value. "Does it work" and "is it still installed" are being conflated. Root-cause it.
2. **`constants.ts:77` writes `needDeinstall`**, which is in neither `VALID_OPERATION_STATUS`
   (`["deinstalled","need-deinstall"]`) nor `GRANDFATHERED_OPERATION_STATUS`
   (`["working","functional","idle, powers on"]`) — the server 400s on it wherever
   `SCANV2_ITEM_VALIDATION` is on, which is the default on dev. The new editor avoids it; the rest
   of the app does not.
3. **Dev pill** (`src/features/v2/ui/SchemeToggleDev.tsx`) has now covered four real controls.
   Owner's call, because it is a kit file.
