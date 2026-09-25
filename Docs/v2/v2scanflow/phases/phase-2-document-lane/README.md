# Phase 2 — The document lane completes (spreadsheet, CSV, PDF)

**Goal.** The same 8.7 MB spreadsheet that the web turned into 10 items does the same on the phone.
Port the web's mechanism; do not invent one.

**Fixes:** P7, P8, P9, P10. **Depends on:** Phase 1 (detection lands in the server draft — a
photo-less item then has somewhere to live), Phase 0 V3.

## What the web does that mobile does not (`03-web-reference.md` § Upload + extract)

1. Splits files by extension into `imageUrls` / `documentUrls` and sends **both** to
   `analyze-smart-detection-v2`. Mobile already does this (`startScanRun` → `processing-v2` →
   `useSmartDetect` with `documents`).
2. **Accepts items with no photo** from the result — `seedGuestDraft(result.products, imageUrls)`
   excludes documents from the thumbnail fallback on purpose. **Mobile refuses them**: `applySmartDetection.ts:70`
   throws when there are no page-images. This one line is P7.
3. Backend returns a per-row `thumbnail_object` for rows that had an embedded image
   (`xlsx-04`) and none for text-only rows. Mobile's `items.tsx:283` already renders either.

## Scope

1. **Remove the page-image requirement from the apply step.** `applySmartDetection.ts:70` must
   tolerate a product with no images when the product came from a document. Keep the throw for the
   photo lane (a photo scan that maps to zero images IS broken). After Phase 1 the products are
   seeded into the server draft, so this may reduce to: seed rows, thumbnails optional.
2. **Publish gate for photo-less rows** (P8) — per Phase 0 V3. `usePublishDraft.ts:190`
   `(it.photos?.length ?? 0) > 0` becomes conditional on the item's source, or on the web's rule.
   Cite the web predicate in the code comment.
3. **Copy, both surfaces' tic** (P9): the failure state says "files", not "photos", when the run
   contained documents. `mobile.processing.errorTitle` and the `Retake photos` action get a
   documents variant; the action becomes "Change files" → intake.
4. **Backend MIME fallback** (P10) — `101recycle-greenbidz-backend/services/officeDocs.js`:
   `isOfficeDocMime()` falls back to extension when the mime is unknown, as its own comment at `:30`
   asks. **Backend change → dev first, owner's go before prod.** Keep the client normalisation; it is
   harmless once the server is fixed.
5. **Intake copy for the lane**: the "up to 20 files" line and per-file caps already match the web
   (`pickScanFiles.ts CAP_BY_EXT` mirrors `wordPressSmart.js:2534-2548` per its comment — `<VERIFY>`
   those lines still hold).

## Files

`src/features/scanner/applySmartDetection.ts` · `src/stores/scanDraftStore.ts` (`applySmartDetection`
action, `:942`) · `src/features/v2/scan/review/usePublishDraft.ts:184-200` · `app/scan/processing-v2.tsx`
(error copy) · six locale files · backend `services/officeDocs.js`.

## Acceptance — on the device, dev DB, then the same on web for parity

1. Intake → Browse → `gb_lot_v2.csv` (the proven-uniform fixture in the scratchpad; **parse it first**,
   see MISTAKES.md 2026-09-22) → Extract → `items.tsx` shows **5 rows**, no crash, no "No photos".
2. Intake → Browse → `SOTW04060設備清單對照表0705 (1).xlsx` → Extract → **10 rows with thumbnails**,
   matching `../../v2scanweb/xlsx-04-detected-grid.png` row for row (titles listed there).
3. A text-only row (no thumbnail) can be accepted, valued and **published**, per the V3 rule.
4. Force a document failure → copy says files, action returns to intake.
5. `curl` a `.csv` upload with mime `text/comma-separated-values` to the dev backend → classified
   as `csv`, not rejected.

## Exit criteria

Both fixtures reach `items.tsx` with the right row count; screenshots into `Docs/v2/v2scan/phase-2/`
side by side with the web's `xlsx-04`. `tsc` clean, `jest` green.

## Not in this phase

Bulk tools on the grid (Phase 3). The editor (Phase 4). Making the 3 "Unidentified" rows acceptable
— that is data, and the web holds them back too.
