# 03 — Web reference: what `/valuation` does at each step

The source being copied. `nextjs-port/app/valuation/page.tsx` mounts `GBValuationPro`
(`src/valuation/pages/GBValuationPro.tsx`). Alias note: `@/pages/*` → `./src/valuation/pages/*` — there
are three copies of `ScanV2Intake.tsx` in the repo; **only `src/valuation/` is the one `/valuation`
renders.**

Lines were read on 2026-09-22/23. Open them before acting; the tree is dirty.

## The step machine

`type Step = "intake" | "scanning" | "detected" | "valuation" | "route" | "inspection" | "review"`
(`GBValuationPro.tsx:91`), one `useState<Step>("intake")` (`:103`), no routing. `route` and
`inspection` are off: `const routeInspectionEnabled = false` (`:920`), so the live rail is
`Intake · Detected items · Valuation · Review`. One item collapses `detected + valuation` into
`ScanV2SingleItemStep` and the rail becomes `Intake · Review item · Review` (`:958 isSingleItemReview`,
`:1004-1013` relabel) — seen live in `../v2scanweb/04-review-item.png`.

## Step 1 — Intake (`ScanV2Intake.tsx`)

- **One input, everything.** `ACCEPT` at `:99-106`: `image/*, application/pdf, .docx, .xlsx, .xls,
  .pptx, text/csv, application/csv, .csv, video/mp4, video/quicktime, video/webm`. Bound to a single
  `<input type="file" accept multiple>` at `:195`. On prod the DOM renders **two** inputs; only the
  one owned by the "Upload files" control is wired (`../v2scanweb/README.md` § Reproducing).
- Caps: `useFileUpload.ts:6 MAX_FILES = 20`, re-enforced in the host at `GBValuationPro.tsx:790`.
- Staged list: "READY TO LIST N", per-file type badge / name / size / `Ready` / remove, "N files · size".
- CTA "Extract items" disabled until a file exists. Rendered twice at phone width (inline + sticky
  footer) — see W2 in `01-problems.md`.

## Upload + extract (`GBValuationPro.tsx:799-905 run()`, `src/lib/valuationApi.ts`)

1. `uploadFiles(list, {onProgress})` → `POST {API_BASE}gcs/upload` (`valuationApi.ts:150`), headers
   `x-system-key` + `x-platform`, form field `sellerId = guestSellerId()` (`:36-66`).
2. Split by extension: `/\.(pdf|docx?|pptx?|xlsx?|csv)$/i` (`:826`) → `imageUrls` / `documentUrls`.
3. `extractItems({imageUrls, documentUrls, language})` → `POST {API_BASE}wp/analyze-smart-detection-v2`
   as an SSE `fetch` (`valuationApi.ts:312-450`, endpoint at `:346`). `onStage / onDetection /
   onProduct` drive the scanning screen.
4. Result → `seedGuestDraft(result.products, imageUrls)` (`:880-892`). **Documents are deliberately
   excluded from the thumbnail fallback**, so a PDF/XLSX-only lot yields items with no thumbnail
   rather than a broken one. This is the line mobile must copy: **an item is allowed to have no
   photo at this stage.**

Backend side, for the spreadsheet: `services/officeDocs.js` accepts xlsx/xls/csv (`:46-47`, `:92-93`),
maps to `'csv'` etc. (`:162-163`) and hands to a recognition split that picks `csv_row` for
row-based files (comment at `:158`). Per-row embedded images are extracted and become
`thumbnail_object` on each row — visible as thumbnails in `../v2scanweb/xlsx-04`, `-09`, `-12`.
`controller/wordPressSmart.js:2078 admitCatalogRows` asks the LLM whether a table is an item list
before splitting it.

## Step 2 — Detected items (`ScanV2ReviewGrid.tsx`, 6,800 lines)

Built for "hundreds/thousands of items" (`:4-6`). What the spreadsheet run used:

- Header: "10 items detected · 10 need review"; search; filter tabs **Needs review / Accepted / All**
  with counts; sort; **Select**.
- Row: thumbnail (from the workbook), title, AI description, `condition · Qty`, **`Needs: Operation
  status, Location`**, category, location or "No location yet"; **Edit fields**; **Accept**.
- Row **Accept on an incomplete item opens the Item detail drawer** rather than accepting
  (`xlsx-07`). The drawer footer: *"2 more to publish: Operation status, Location"* · **Accept &
  next** · Done.
- Bulk toolbar after Select: **Accept · Discard · Merge into one lot · Delete · Apply to selected**.
  Apply-to-selected dialog: field (`location | condition | operationStatus | country`) + value
  (`xlsx-08`). This is what made 10 rows tractable: two applies, then accept.
- Footer CTA reads the accepted count: **"Submit 7 listings"**. Pressing it with rows still in
  review shows **"List 7 of 10 items? — 3 still need review. Only accepted items are listed — the rest
  stay in this draft, so you can come back to them."** → Continue with 7 / Keep reviewing (`xlsx-10`).
- Statuses are server state: `needs_review → accepted / discarded` (`:2226`, `draftItemsQuery.js`).

Do **not** copy W1 (bulk Accept dead) — verify mobile's bulk accept actually changes counts.

## Step 3 — Valuation (`ScanV2ValuationStep.tsx`, 3,419 lines)

Seen live in `xlsx-11`: currency switcher (USD/EUR/JPY/GBP/THB/CNY); **SELL AS PRODUCTS $6,025 –
$36,553** as a band; "7 of 7 priced"; **Your asking total $12,668**; est. time to sell; a **5 TO LIST /
2 TO CHECK** split; per item: YOUR PRICE (AI suggested) vs MARKET VALUE band, "Priced within market",
HOT LEVEL, EST. TIME. Prices are **ranges, never midpoints** (docblock ll.1-42). Scrap selling is off:
`:238 SCRAP_SELLING_ENABLED = false`. Continue → review.

Mobile already has the arithmetic: `valuationSummary.ts` (`summariseItems`, `formatBand`, refuses to
total mixed currencies) and `valuationView.ts` — both ported from `scanv2Valuation.ts` and cited in
their docblocks.

## Single-item collapse (`ScanV2SingleItemStep.tsx`)

`04-review-item.png`. Head *"Review your listing — The scan found one item. Check what it read, then
send it for publishing."* Then the item panel (photos, AI-filled fields, condition, installed?,
location, description), then **WHAT IT IS WORTH** (`:315-330`): market band, **BASIS** sentence
("category estimate — model identified / No comparables detected"), **HOT LEVEL** (4 of 5), **EST.
TIME TO SELL**, **YOUR ASKING PRICE** with **"Use market price ($20,000)"**; then **WHAT HAPPENS TO
THIS ITEM** (List as product / Scrap · 101 RECYCLE, scrap "being built"); **Continue to review and
submit**. Basis, hot level and time-to-sell are NOT in the mobile payload (`AiResult`,
`scanDraftStore.ts:49-95`) — mobile shows what it has.

## Step 4 — Review and submit (`ScanV2ReviewSubmitStep.tsx`)

`05-review-submit.png`, `xlsx-12`. *"Last look before your items go for listing. Nothing is
submitted until you press the button."* — **"3 items will not be submitted → Go back and accept
them"** — Items to be submitted (thumb, title, category, Edit) — "N listings ready to submit · Total
asking price" — **Submit N listings**. `canSubmit` gates the real CTA (`GBValuationPro.tsx:2142`);
`onSubmit` opens the sign-in gate and does not navigate (`:2143-2151`).

## Scanning (`ScanV2Scanning.tsx`)

`03-scanning.png`, `xlsx-03`. "Reading N items from your upload" → "Scanning your inventory…" →
progress "N of N" → items appearing live with `Ready` → **Cancel scan** → "Draft saved automatically
— leave and resume any time." Mobile's `analyzing.tsx` is the better version of this screen and is
currently unreachable (P4).
