# 02 — Target structure

One flow, one data model after detection, one route into each step. Mirrors the web's
`/valuation` step machine (`03-web-reference.md`) with three deliberate mobile divergences, stated
at the end.

## The steps

```
Home ── Scan it ──► 1 INTAKE ──► (scanning) ──► 2 DETECTED ──► 3 VALUATION ──► 4 REVIEW & SUBMIT ──► PUBLISHED
                                                    │                 ▲
                                                    └── one item ─────┘   (single-item collapse: Detected+Valuation
                                                                            render as one "Review your item" screen,
                                                                            exactly as the web's ScanV2SingleItemStep)

Any row, on any of 2/3/4 ──► ITEM EDITOR (one mobile-native sheet) ──► back to the same step, counts updated
```

Numbered exactly like the web: `1 Intake · 2 Detected items · 3 Valuation · 4 Review`. The rail is
drawn **only after detection has counted** — `spine.ts` returns an empty spine for an unknown count
on purpose, and that stays.

## Screens — keep, change, new, remove

| Step | Screen | Fate | Why |
|---|---|---|---|
| Home | `SellingPane.tsx` | keep | already routes to intake |
| 1 | `app/v2/scan/intake.tsx` | keep | ported from web this week; two doors |
| capture | `app/scan/camera.tsx` (shipped) | keep | has the document lane; `onNext` ≡ `startScanRun` |
| capture | `app/v2/scan/camera.tsx` (v2) | **remove** after Phase 4 | only remaining use is append (`photos.tsx:506`); the new editor's photo strip will call the shipped camera |
| scanning | `app/scan/processing-v2.tsx` | keep, re-route exits | the mechanism that runs; only its hand-offs change |
| scanning | `app/v2/scan/analyzing.tsx` | decide in Phase 0 | wire it as the scanning screen, or delete it — not leave it orphaned |
| 2 | `app/v2/scan/items.tsx` | **becomes THE detected screen** | server-backed, has statuses, has counts; grows the grid-lite features |
| 2 | `app/v2/scan/detected.tsx` | **remove** in Phase 1 | store-backed twin; superseded once detection lands in the server draft |
| 3 | `app/v2/scan/valuation.tsx` | keep, fix, wire | reachable from 2 for N>1; hidden for N=1 |
| 4 | `app/v2/scan/submit.tsx` | keep, fix, wire | publish what is shown, from the server rows |
| editor | **new** `app/v2/scan/item.tsx` (one sheet) | **new** in Phase 4 | mobile-native; replaces the four wizard screens |
| editor | `review/photos.tsx`, `details.tsx`, `pricing.tsx`, `location.tsx`, `wizardState.ts`, `reviewKit.tsx` step chrome | **remove** in Phase 4 | owner decision |
| done | `app/v2/scan/published.tsx` | keep | |
| old | `app/scan/detail.tsx`, `grouped-review.tsx`, `detection.tsx` | **remove** in Phase 6 | hooks bug in `detail.tsx:117`; the chooser's one job ("how should we list these?") becomes a sheet on Detected |
| helper | `openDetectedItem.ts` | **remove** | it exists to jump into the old wizard by clobbering the store |
| helper | `startScanRun.ts` | keep | one hand-off point; its target changes in Phase 1 |
| helper | `startV2Scan.ts` | change | → `routes.v2Intake`, same as Home |

## One data model after detection: the server draft

This is the web's way, and it is what makes steps 2–4 coherent: the draft has **items with a
status** (`needs_review / accepted / discarded`), thumbnails, prices, and it survives the app being
killed. Every screen from step 2 on reads and writes the server draft. The device store keeps its
job for the moments before a draft exists (staged files, photos in flight) and for the editor's
in-progress edits.

Concretely:

- Detection **creates or seeds the server draft** and hands off with a `draftId`. The
  recognition-job lane already does this on the backend (`processing-v2` comment: *"backend DEFERS
  its draft + bell"*); the direct-SSE lane must do the same client-side, the way the web's
  `seedGuestDraft` does (`GBValuationPro.tsx:880-892`).
- `items.tsx`, `valuation.tsx`, `submit.tsx` and the new editor all take `draftId` and read
  `/drafts/:id/items`. No `hydrateFromServer` bridges, no `openDetectedItem`.
- **Publish reads the server draft's accepted rows** — the same set the screen shows. `usePublishDraft`
  gets a server-draft entry point (or a sibling) so P3 cannot recur.

`<VERIFY>` before Phase 1: `items.tsx:30-32` says `testapi` returns 404 for `/drafts/:id/items` and
`/items/counts` because the server runs an older build. That comment is from ~2026-09-17. If still
true on the target environment, Phase 1 is blocked on a backend deploy, not on app code.

## The route graph, target

```
intake ─(photo)─► shipped camera ─┐
intake ─(files)─► Extract ────────┴─► processing-v2 ──► creates/seeds server draft ──► items.tsx?draftId
                                                                                            │
                                                          N = 1 ──────────────────────────► item.tsx (collapse: item + worth) ──► submit
                                                          N > 1 ──► accept/discard/bulk ──► valuation ──► submit ──► published
                                                                        │                       │            │
                                                                        └───── row tap ─────────┴────────────┴──► item.tsx (editor) ──► back
```

- `processing-v2`'s **only** exits become `items.tsx?draftId=…` and the error state. The
  `scanDetection` / `scanDetail` / `scanGroupedReview` exits go.
- Resume (`useResumeDraft`) already lands on `items.tsx?draftId` — so a fresh scan and a resumed
  draft finally share one path.

## The item editor — one sheet, mobile-native

Replaces four screens. It is not the web's drawer copied; it is designed for a thumb under
`UX_DESIGN_RULES.md`. What it must carry (from what both surfaces already show):

- **Photos** strip with the cover, reorder, remove, and ADD → shipped camera / picker.
- **Item details**: title, brand, model, category + subcategory, year, quantity — AI-filled and
  marked so ("Filled by AI" chip, as both surfaces do).
- **Condition & handling**: condition, *installed / removed* (the field that blocked every item on
  the web run), operation status.
- **Where it is**: location + country, "use my location".
- **Worth**: market band, scrap floor, and the asking price with **"Use market price"** — the web's
  one-tap that mobile lacks.
- **Footer**: a live *"N more to publish: Location, Operation status"* line (the web's — the single
  best piece of copy in the flow), **Accept & next**, **Done**.

Reached by tapping a row on steps 2, 3 or 4; returns to the same step with the row's status and
the counts updated. Keyboard-safe: the footer must not cover the field being typed into
(`UX_DESIGN_RULES.md`; the v2 signup shipped with exactly that bug).

## Three deliberate divergences from the web

1. **A camera door on intake.** The web has none. Kept.
2. **No rail before detection.** The web draws `1–2–3–4` on intake. Mobile draws the step name only
   until the count is known (`spine.ts` contract), then the honest 2- or 4-step rail.
3. **No sort, no merge-into-lot, no search on Detected.** The web grid exists for "hundreds/
   thousands of items" with server paging (`ScanV2ReviewGrid.tsx:4-6`). A phone list keeps accept,
   discard, bulk select, Apply-to-selected, and the "List N of M?" confirm — the parts the
   spreadsheet run actually used.

## Guest mode

Out of scope for this plan. Mobile gates at publish (`usePublishDraft` → `requireAuth('sell')`); the
web gates at submit. Same moment, different presentation. The web's durable guest-valuation record
(`guestValuationRecord.ts`) is a separate programme.
