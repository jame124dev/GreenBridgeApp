# Web `/valuation` — the same document, walked step by step

The **same spec-sheet PDF** used for the mobile walk in [`../v2scan`](../v2scan), run against
**production — https://101lab.co/valuation** on **2026-09-23**, as a signed-out guest, in Chrome
via the devtools MCP at **390 × 844** (the width the app captures were taken at, so the two folders
compare like for like).

Stopped at **Review and submit**, as asked — "Submit 1 listing" was never pressed.

## The walk

| # | File | Screen | What it shows |
|---|---|---|---|
| 01 | `01-intake.png` | Intake | One door for everything: `JPG, PNG, MP4, PDF, DOCX, PPTX, XLS, XLSX, CSV — up to 20 files`. Paste-from-clipboard and the `upload@greenbidz.com` forward card. "Extract items" disabled until a file exists. |
| 02 | `02-staged.png` | Intake, staged | Drop zone collapses to a strip. "READY TO LIST 1", a "Translate everything to EN" toggle, `gb_test_spec.pdf · 2 KB · Ready`, "1 file · 2 KB". |
| 03 | `03-scanning.png` | Scanning | "Reading 1 items from your upload", a 1-of-1 progress bar, and the item appearing live — "Waters Alliance e2695 HPLC System · Ready" — with "Cancel scan" and "Draft saved automatically". |
| 04 | `04-review-item.png` | Review item | The one-item collapse. AI-filled title/brand/model/category/year/description, then **WHAT IT IS WORTH** — market **$15,000 – $25,000**, basis *"category estimate — model identified / No comparables detected"*, **HOT LEVEL 4/5**, **EST. TIME TO SELL 3–6 wks**, an asking-price field with "Use market price ($20,000)", and **WHAT HAPPENS TO THIS ITEM** (List as product / Scrap · 101 RECYCLE, scrap "being built"). |
| 05 | `05-review-submit.png` | **Review and submit** | "Last look before your items go for listing. Nothing is submitted until you press the button." One item listed with an Edit control, "1 listing ready to submit", a total, and **Submit 1 listing**. |

## What this confirms against the app

The figure the two surfaces agree on is the one that matters: **market value $15,000 – $25,000**,
from the same PDF, on both. The app's detected screen (`../v2scan/06-detected.png`) and this
page's Review item (`04`) read identically, and the app's Pricing step independently showed the
matching scrap floor.

Where the web is **ahead** of the app, visible in `04`: a written **basis** sentence, a **demand**
rating, an **est. time to sell**, a one-tap "use market price", an explicit **product-vs-scrap**
route control, and a **share link**. The mobile payload carries none of those (`AiResult` in
`scanDraftStore.ts`), so the app shows the two price tiers only — absent rather than invented.

Where the **app** is ahead: a camera.

## Three things found while doing this

**1. The sticky-footer "Extract items" did nothing.** At 390px the CTA exists twice — once in the
card, once in the sticky footer. The footer copy reported as enabled and clicked cleanly, but
produced **no network request at all**; clicking the in-card copy immediately fired
`POST gcs/upload [200]` and `POST wp/analyze-smart-detection-v2 [200]`. Seen once, not yet
re-confirmed — but the thumb-reachable control is the one that appeared dead.

**2. "Continue to review and submit" correctly blocks.** First press held on step 2 with
*"Is it still installed?" — Needed to accept* and an empty required Location. Good behaviour,
worth recording as the intended gate.

**3. A price number I could not account for.** I typed `20000` into the asking-price field
(without pressing its adjacent Save), and the submit screen totals **$18,500** — which matches
neither the input, nor the market midpoint ($20,000), nor the low end ($15,000); the local mirror
recorded `total_used: 15000`. **I did not chase this down**, so treat it as an open question rather
than a defect: the likely innocent explanation is that my un-saved edit never committed and $18,500
is a derived suggested ask. It is worth one look by someone who knows the pricing path, because
"what the screen shows vs what the write path sends" has bitten this flow before.

---

# Run 2 — a real 8.7 MB spreadsheet (`xlsx-*`)

`SOTW04060設備清單對照表0705 (1).xlsx`, the multi-item case: one upload, **10 items detected**, each
with its own photo pulled from inside the workbook. Same page, same guest, same day. Walked all the
way to **Review and submit**; Submit was not pressed.

| # | File | Screen | What it shows |
|---|---|---|---|
| 01 | `xlsx-01-staged.png` | Intake, staged | `XLSX · 8.7 MB · Ready`. Same one-door intake as the PDF run. |
| 02 | `xlsx-02-uploading.png` | Uploading | A real progress state for a large file — "Uploading your photos 100%", CTA becomes "Working…". |
| 03 | `xlsx-03-scanning.png` | Scanning | "Reading your upload", "Pulling out models and serial numbers". |
| 04 | `xlsx-04-detected-grid.png` | **Detected items** | The grid the PDF run never reaches: **10 items detected · 10 need review**, search, filter tabs (Needs review / Accepted / All), sort, Select. Every row has an AI-written description, category, condition, qty, a per-row thumbnail **taken from inside the spreadsheet**, and its own `Needs:` list. |
| 05 | `xlsx-05-bulk-selected.png` | Bulk toolbar | "10 selected" → Accept · Discard · **Merge into one lot** · Delete · Apply to selected. |
| 06 | `xlsx-06-bulk-accept-no-op.png` | After bulk Accept | Counts unchanged — see the defect below. |
| 07 | `xlsx-07-item-detail-drawer.png` | Item detail | The per-item editor, reached by accepting an incomplete row. Footer states exactly what is missing: "2 more to publish: Operation status, Location". |
| 08 | `xlsx-08-bulk-apply-dialog.png` | Apply to selected | Field (Location / Condition / Operation status / Country) + value, applied across the selection. This is what makes a 10-row lot tractable. |
| 09 | `xlsx-09-accepted-7of10.png` | 7 accepted | After bulk-filling Location = Taipei and Operation status, then accepting per row. 3 rows still short (one is literally "Unidentified item", missing Category and Condition). |
| 10 | `xlsx-10-confirm-list-7-of-10.png` | Confirm | **"List 7 of 10 items? — 3 still need review. Only accepted items are listed — the rest stay in this draft, so you can come back to them."** A genuinely good gate. |
| 11 | `xlsx-11-valuation.png` | **Valuation** | The lot step, which a single item never shows: currency switcher (USD/EUR/JPY/GBP/THB/CNY), **SELL AS PRODUCTS $6,025 – $36,553**, "7 of 7 priced", **asking total $12,668**, est. time to sell, a 5 TO LIST / 2 TO CHECK split, and per-item YOUR PRICE vs MARKET VALUE with "Priced within market". |
| 12 | `xlsx-12-review-submit.png` | **Review and submit** | 7 items with thumbnails and categories, "7 listings ready to submit · Total asking price: $12,668", plus an explicit **"3 items will not be submitted → Go back and accept them"**. |

## What the spreadsheet run proves

- **The document lane genuinely reads a workbook.** 10 distinct machines, each with brand, model,
  specs and a category, from one file — and **per-row images extracted from inside the xlsx**,
  visible as thumbnails in `04`, `09` and `12`.
- **Valuation is a real step, not a label.** It only appears for a lot; the single-PDF run collapses
  straight past it. Prices are per item and roll up to a lot total.
- **The AI says when it does not know.** One row is "Unidentified item"; another two carry
  "Model needs review". They are held out of the submission rather than guessed at.

## Defect found in run 2

**Bulk "Accept" does nothing.** With all 10 rows selected, pressing Accept in the selection toolbar
left the counts at `Needs review 10 / Accepted 0`, with no toast, no error and no change — twice,
once via a real click and once via a dispatched click. The first time this could be explained away
("the rows were incomplete"), but it repeated **after** Location and Operation status had been
bulk-applied to all 10 and every row's `Needs:` list was empty. The per-row Accept on the same data
worked immediately (`Needs review 10 → 9`, `Accepted 0 → 1`), which is what makes this a defect
rather than a gate: **the bulk path is dead while the single path works.** The 7 accepted items in
`09` were all accepted one at a time.

Consequence: a seller with a 200-row spreadsheet — the exact customer this screen is built for — has
no working way to accept in bulk, and the control gives no sign that it failed.

Two smaller notes: `xlsx-12` shows the sticky footer **overlapping the item rows** at this width,
and `xlsx-02` calls a spreadsheet upload "Uploading your **photos**".

## Reproducing

Chrome devtools MCP, mobile viewport, `localStorage.clear()` before the run so the page does not
resume a saved guest lot and skip intake. Upload through the **"Upload files"** control (which owns
the file chooser) rather than by setting files on a hidden input — prod renders **two** file inputs
and only one is wired, so targeting "the first input" silently stages nothing.
