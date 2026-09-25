# 00 — Current structure

The mobile scan flow as it stands on 2026-09-23, after the intake and detected screens were added
and the shipped camera was reinstated for capture. Every route below was read from the code, not
recalled.

## The screens

| Screen | File | Reads | Reached from |
|---|---|---|---|
| Home · Selling | `src/features/v2/home/SellingPane.tsx` | store (drafts/listings queries) | tab |
| **Intake** | `app/v2/scan/intake.tsx` | local `useState` (staged files) | `SellingPane.onScan` → `routes.v2Intake` |
| Shipped camera | `app/scan/camera.tsx` | — | intake "Take a photo" → `routes.scanCamera` (`intake.tsx`, `onTakePhoto`) |
| v2 camera | `app/v2/scan/camera.tsx` | — | **append only**: `review/photos.tsx:506` → `routes.v2CameraAppend()`; also `startV2Scan.ts:49` (see problems) |
| Processing | `app/scan/processing-v2.tsx` | store + SSE / recognition-jobs | `startScanRun.ts` → `routes.scanProcessing`; `EXPO_PUBLIC_SMART_DETECT_V2=1` (`.env:30`) selects `-v2` |
| **Detected** (store) | `app/v2/scan/detected.tsx` | `useScanDraft` — `mode`, `current`, `queuedItems` | `processing-v2` after `applySmartDetection` → `routes.v2Detected` |
| Detected (server) | `app/v2/scan/items.tsx` | `/drafts/:id/items`, `/items/counts` | `openMultiItemDraft.ts:28` ← `useResumeDraft` (Home / `/v2/drafts` tap) |
| Valuation | `app/v2/scan/valuation.tsx` | `/drafts/:id/items` (server) | `items.tsx:314` **only** |
| Review & submit | `app/v2/scan/submit.tsx` | `/drafts/:id/items` (server) for rows; `useScanDraft` for publish | `valuation.tsx:92` **only** |
| Review wizard 1/4 Photos | `app/v2/scan/review/photos.tsx` | store via `useReviewItem()` | `detected.tsx:155,159,245` → `reviewStepHref('photos', i)` |
| 2/4 Details | `app/v2/scan/review/details.tsx` | store | wizard |
| 3/4 Pricing | `app/v2/scan/review/pricing.tsx` | store | wizard |
| 4/4 Location | `app/v2/scan/review/location.tsx` | store; publishes via `usePublishDraft` | wizard |
| Published | `app/v2/scan/published.tsx` | route params | `usePublishDraft.ts` after success |
| Analyzing (v2) | `app/v2/scan/analyzing.tsx` | `recognition-jobs/:id/stream` | **nothing** — only self-reference at `analyzing.tsx:732` |
| Old detail | `app/scan/detail.tsx` | store | `processing.tsx` (flag-off path); `processing-v2` non-skip branch → `routes.scanDetection` → old chooser |
| Old grouped review | `app/scan/grouped-review.tsx` | store | old chooser |
| Old detection chooser | `app/scan/detection.tsx` | `pendingDetection` | `processing-v2` when `shouldSkipDetectionChoice()` is false (`smartDetectionRouting.ts:19-28`) |

## The route graph, as it runs

```
Home ── Scan it ──► Intake
                      ├─ Take a photo ──► SHIPPED camera ──┐
                      └─ Browse files → Extract ───────────┴─► processing-v2
                                                                  │
                                    ┌─────────────────────────────┴──────────────────────────┐
                                    │ skip choice (≤1 product, or ≤1 image)                  │ else
                                    ▼                                                        ▼
                             detected.tsx (STORE)                                   /scan/detection (OLD chooser)
                                    │ row / Continue                                          │
                                    ▼                                                        ▼
                  review/photos → details → pricing → location ──► publish ──► published   old detail / grouped-review
                                                            (usePublishDraft reads STORE)


Home ── tap a saved draft ──► items.tsx (SERVER) ──► valuation.tsx ──► submit.tsx ──► publish (reads STORE)
                                    ▲                       │                 │
                                    └───── row tap ─────────┴─── openDetectedItem (hydrates STORE with ONE item) ───► review/photos
```

Two facts to hold onto from that picture:

1. **Two step-2 screens, two data models, no bridge.** A fresh scan lands on `detected.tsx`, which
   reads the Zustand/MMKV store and continues into the per-item wizard. A resumed draft lands on
   `items.tsx`, which reads the server draft and continues into Valuation → Submit. Nothing routes
   `detected.tsx → valuation.tsx`. Nothing routes `items.tsx → review/photos` except the row-tap
   helper that replaces the store with a single item.
2. **Publish reads the store, whatever screen it is pressed on.** `usePublishDraft.ts:174-178`
   (`itemsToPublish`) returns `queuedItems` or `[current]`. `submit.tsx` renders server rows and
   labels its CTA from them (`submit.tsx:143`), then calls this.

## The data models

| | Store (`useScanDraft`) | Server draft (`/drafts/:id/items`) |
|---|---|---|
| Lives | Zustand + MMKV, device-local | `gb_listing_drafts` + items, backend |
| Item shape | `DraftItem` (`scanDraftStore.ts:130`) — photos as `Photo[]`, `aiPrices`, no status | `DraftItem` (`draftItemsApi.ts:~93`) — `status: needs_review/accepted/discarded`, `thumbnail_object`, `fmv_used`, `scrap_value` |
| Written by | `applySmartDetection` (after detection), wizard `patch()` | backend on recognition-job completion; `items.tsx` bulk status ops |
| Read by | `detected.tsx`, the 4 wizard screens, `usePublishDraft` | `items.tsx`, `valuation.tsx`, `submit.tsx` |
| Bridge | `items.tsx:277-315` maps server rows → store items via `hydrateFromServer` **on Continue**; `openDetectedItem.ts:169-195` maps ONE row → store, replacing everything | — |

The same type name, `DraftItem`, is used for both shapes. `items.tsx` imports the server one;
`detected.tsx` imports the store one. Easy to confuse when reading.

## The detection lanes

| Lane | Endpoint | Started by | Watched by |
|---|---|---|---|
| Direct SSE | `POST /wp/analyze-smart-detection-v2` | `useSmartDetect` inside `processing-v2` | `processing-v2` |
| Recognition job | `POST /recognition-jobs` → `GET /recognition-jobs/:id/stream` | `processing-v2.runViaRecognitionJob` when `backgroundRecognitionEnabled()` | `processing-v2`; `analyzing.tsx` was built to watch this but is unreachable |

Observed on device 2026-09-23 (`../v2scan/06a`): the local run took the recognition-job lane
(`POST /recognition-jobs 202`, then `.../stream`).

## What a document does today

`intake.tsx` / `camera.tsx` stage documents → `startScanRun.ts` does `start(photos)` then
`patch({documents})` → `processing-v2` uploads and analyses → **`applySmartDetection`
(`src/features/scanner/applySmartDetection.ts:70`) throws `'No photos to apply smart detection to'`
when the result carries no page-images.** A PDF renders to page-images and survives (the whole
`../v2scan` walk is a PDF). A CSV was tested on device and died here. An XLSX is the same row-data
lane — expected to fail identically, **not tested on the phone**.

## MIME note (fixed, but relevant)

Android reports `.csv` as `text/comma-separated-values`; the backend's `OFFICE_MIMES`
(`101recycle-greenbidz-backend/services/officeDocs.js:46-47`) has only `text/csv` /
`application/csv`, and `isOfficeDocMime()` is mime-only. `pickScanFiles.ts` now normalises by
extension (`mimeForDocument`). The durable fix — an extension fallback in `officeDocs.js`, which its
own comment at `:30` already asks for — is still open.
