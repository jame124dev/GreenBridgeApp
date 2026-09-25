# v2 scan flow — walked on device, step by step

Every screen of the v2 scan flow, captured on a **Realme 7 (1080 × 2400)** on **2026-09-23**,
signed in as a real seller, against the **local Node backend on :4000 → `greenbidz_test`** (the dev
database — verified before the run, not assumed).

The run finished: it published **BATCH 5096 — "Waters Alliance e2695 HPLC System"** and the
listing was confirmed present on the landing screen afterwards.

## The walk

| # | File | Screen | What it shows |
|---|---|---|---|
| 01 | `01-home.png` | Home · Selling | "Scan it" is the single primary action. 4 live listings, no unfinished drafts. |
| 02 | `02-intake-empty.png` | **Intake** (empty) | The ported `/valuation` step 1. Two doors — "Take a photo" leads, "Browse files" beneath. Accepted types and both explainers. "Extract items" is disabled and **reads as disabled**. |
| 03 | `03-file-picker.png` | System file picker | Opened from "Browse files". Gated behind an account first — documents go up through GCS, which needs a seller id. |
| 04 | `04-intake-staged.png` | **Intake** (1 file, **dark scheme**) | Zone collapses to a strip, "READY TO LIST 1", the file row with type badge / name / Ready / remove, "1 file". The camera door is **correctly absent** — see the note below. Dark mode verified here. |
| 05 | `05-analyzing.png` | Analyzing | Five phases, live progress, "Continue in background", cancel. |
| 06 | `06-detected.png` | **Detected items** | The single-item collapse: detector summary, the row with its band, then WHAT IT IS WORTH — market **USD 15,000 – 25,000**, scrap floor **USD 500 – 1,000**. |
| 07 | `07-review-photos.png` | Review 1/4 · Photos | The PDF's page became the item's photo. ADD tile, marketplace with the AI chip. |
| 08 | `08-review-details.png` | Review 2/4 · Details | Title, brand, model, year, description — every field AI-filled from the spec sheet. |
| 09 | `09-review-pricing.png` | Review 3/4 · Pricing | Profit Intelligence: scrap baseline **USD 500 – 1,000**, potential profit **+USD 14,000 – +24,500**. Consistent with step 06. |
| 10 | `10-review-location.png` | Review 4/4 · Location | Pre-filled from the seller profile. "Nothing left on this step" → **Submit listing**. |
| 11 | `11-published.png` | Published | "Sent for review · **BATCH 5096**", the three-step what-happens-next, and the listing named back. |
| 12 | `12-my-listings.png` → `12b-my-listings-loaded.png` | My listings | The loading state, then the settled list. **The new listing is at the top** — the landing is not serving a stale cache. |
| 13 | `13-camera.png` | **Shipped camera** | The other door. Folder control bottom-left, flip right, "TAKE MULTIPLE PHOTOS" hint. v2 no longer maintains its own capture camera. |
| 14 | `14-camera-doc-picker.png` | Camera → documents | The shipped camera's own document lane, reached from the v2 intake. |

## Two captures that are evidence of a defect, not of the flow

**`05a-dev-pill-intercepts-cta.png` — the dev scheme toggle steals the primary CTA's taps.**
A press aimed at "Extract items" flipped the colour scheme instead; the same press on the CTA's
right-hand side worked. The `SchemeToggleDev` pill floats over the footer and its hit area covers
the left of the button. Dev-only, but it sits on top of the primary action of every screen that has
a footer.

**`06a-error-transient-fetch-failed.png` — a transient upstream failure, and the wrong words for it.**
The first extraction died with *"We couldn't read your photos — Something went wrong on our side."*
The backend log gave the real cause: `[smartDetect] catalog admission failed: fetch failed` →
`fatal: fetch failed`, an outbound LLM call from the local Node. It was transient — pressing the
screen's own **Try again** produced `06-detected.png` on the next attempt, and all three provider
hosts were reachable from this machine when checked. Two things are still wrong with the screen:
it says **"photos"** and offers **"Retake photos"** on a run that contained no photos at all, only a
PDF.

## The one deliberate limitation visible in 04

The camera door disappears once a file is staged. That is a correctness guard: the shipped camera
runs its own `start(photos)`, which REPLACES the draft, so tapping it with documents staged would
discard them silently while the count on screen still claimed they were attached. The cost is that
one pass cannot mix a fresh photo with an uploaded spreadsheet.

## How these were taken

`scratchpad/cap.sh` — checks `adb get-state` before each item, writes every capture to its **own**
path (never a reused filename, which would let a failed `screencap` return the previous screen),
lets stderr through on the measurement, warns on a suspiciously small frame, records the foreground
activity beside each shot, and appends to `.captured` so a re-run is safe.
