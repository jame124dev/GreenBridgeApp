# Phase 5 — Valuation and Review & submit: reachable, correct, translated

**Goal.** Steps 3 and 4 do what the web's do, from the server draft, and Publish sends exactly the
set the screen shows.

**Fixes:** P3, P12, P13, P14. **Depends on:** Phase 1 (reachable), Phase 4 (row tap → editor).

## Valuation (`valuation.tsx`) — what changes

Already has: accepted-row list, `summariseItems` totals, mixed-currency refusal, market band per
row. Add / fix:

1. **Reached from `items.tsx` for N > 1 only.** N = 1 goes to the editor collapse (Phase 4).
2. **Lot head**, ported from `xlsx-11`: "N items, valued from the scan" · **band total** ("Sell as
   products $6,025 – $36,553") · "N of N priced" · **asking total** · a **TO LIST / TO CHECK** split
   (priced-and-accepted vs. accepted-but-unpriced). `valuationView.ts` already exposes `pricedCount`
   / `countedCount` / `unpriced`.
3. **Per row**: YOUR PRICE vs MARKET VALUE, "Priced within market" when inside the band, the
   `needsClearerPhoto` flag. Row tap → editor (`returnTo=valuation`).
4. **Back = `router.back()`**, not a push to `items` (P14).
5. No currency switcher unless Phase 0 D3 says otherwise.

## Review & submit (`submit.tsx`) — what changes

1. **Publish what is shown.** The CTA count and the published set must come from the same source:
   the server draft's accepted rows. `usePublishDraft` gets an entry point that takes those rows (or
   a sibling hook), so `itemsToPublish()` reading `useScanDraft` (`usePublishDraft.ts:174-178`)
   is no longer on this path. Gate the fix with a test that mounts Submit with 5 server rows, has
   the store hold 1, and asserts 5 are sent.
2. **"N items will not be submitted → Go back and accept them"** block when `needs_review > 0`
   (`xlsx-12`), plus "Items not submitted · N · View all".
3. **Recovery control works for one item** (P12): drop the `itemIndex < 0` return; open the editor
   on the blocked item at the blocked section (`step` is used, not ignored).
4. **Translations** (P13): `mobile.scanv2.valuation.*` and `mobile.scanv2.submit.*` authored in all
   six locales; every literal (`'Opening…'`, `'Submitting…'`, `'Dismiss'`, `'PRODUCT'/'SCRAP'`,
   `MARKETPLACE_LABELS`) moved behind `t()`. Add both blocks to `scanv2Keys.test.ts`'s enumeration
   **first**, so the test fails until the keys exist.
5. **Back = `router.back()`** (P14).
6. **Total asking price** shown; must equal the sum of the rows shown — assert it in the test
   (W4 on the web was an unexplained total; do not inherit it).

## Files

`app/v2/scan/valuation.tsx` · `app/v2/scan/submit.tsx` · `src/features/v2/scan/review/usePublishDraft.ts`
(new server-rows entry point) · `src/features/v2/scan/valuationView.ts` · six locale files ·
`src/i18n/__tests__/scanv2Keys.test.ts` · new `__tests__/publishSet.test.ts`.

## Acceptance — device, dev DB

1. 10-row xlsx, 7 accepted → Continue → **Valuation** shows band total, "7 of 7 priced", asking
   total, 5/2 split, per-row price vs market.
2. Tap a row → editor → change price → Done → row and totals update **without manual refresh**.
3. Continue → **Review & submit** shows 7 items, "3 items will not be submitted", total = sum of
   the 7 (compute it from the rows on screen and compare).
4. Tap row 2 → editor → **Done** → back on Submit → **still says 7** → Publish → **7** batches /
   items land in `greenbidz_test` (query the DB by seller and time; count, do not eyeball).
5. Single-item draft with a blocked field → "Go to Location" **opens the editor at Location**.
6. Switch the app to `ja` → both screens fully translated, no raw keys, no English fallbacks.

## Exit criteria

Screenshots (both schemes) into `Docs/v2/v2scan/phase-5/` beside `../../v2scanweb/xlsx-11`,
`xlsx-12`. `tsc` clean; `jest` green including `publishSet.test.ts` and the extended
`scanv2Keys.test.ts`.
