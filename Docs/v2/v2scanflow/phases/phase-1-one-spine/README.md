# Phase 1 — One spine: one step-2 screen, one data model

**Goal.** A fresh scan and a resumed draft take the same path. After detection, there is one
step-2 screen, reading one data model, and it can reach Valuation and Review & submit.

**Fixes:** P1, P2, P5 (partly), P6, P11. **Depends on:** Phase 0 V1, V2.

---

## ⚠️ REWRITTEN 2026-09-23 — the original premise was wrong

This phase used to say *"detection lands in the **server** draft"*. That is **not what the web
reference does**, and building it would have meant a backend change this workspace does not need.

### What was measured

| Claim | Evidence | Verdict |
|---|---|---|
| No client-callable route creates `gb_listing_draft_items` rows | The only `ListingDraftItem.create` calls are `services/recognitionExtractWorker.js:631,686,708`. `draftItemsController.js` and `durablePublishController.js` contain **zero** create/bulkCreate/findOrCreate/upsert calls — they read and update only | **VERIFIED** |
| The sole entry to that writer is the durable-extract lane | `controller/gcsResumableController.js:653` (`runExtractJob(jobId)`), fire-and-forget inside `resumableFinalize`, gated on `scanV2DurableExtractEnabled()` **and** a client-echoed `jobId`. Routes: `routes/gcsRoute.js:75,81` | **VERIFIED** |
| **The web's `/valuation` never writes server item rows at all** | `GBValuationPro.tsx:894` — `const id = seedGuestDraft(...)` then `setDraftId(id)`. `seedGuestDraft` is **client-side** (`src/rtk/api/guestDraftStore.ts:164`) and returns a **local integer** | **VERIFIED** |
| The grid's required `draftId: number` prop (`ScanV2ReviewGrid.tsx:266`) is therefore a synthetic id | same | **VERIFIED** |

### ✅ PREMISE PINNED ON THE LIVE SITE, by a different method (2026-09-23)

The table above was derived by reading code. Per `CLAUDE.md` (*"pin a premise with a DIFFERENT
method than the one that found it"*), it was then confirmed with a **network trace** of two complete
10-item xlsx runs on **prod `101lab.co/valuation`**, via Chrome DevTools MCP. Read-only — the
existing session was still parked on Review, so nothing new was written.

The complete XHR/fetch set (43 requests, `includePreservedRequests`):

| Endpoint | Role |
|---|---|
| `POST /gcs/upload` | the spreadsheet |
| `POST /wp/analyze-smart-detection-v2` | detection |
| **`POST /guest-valuations` ×~20** | **autosave — 201 on create, 200 per edit** |
| `POST /wp/valuation-comps-stream` | market bands |
| `GET /product/lab/category`, `/product/category`, `open.er-api.com/v6/latest/USD` | taxonomy, FX |
| `GET /user/verify-user` → **401** | guest |

**Zero `/drafts/` requests of any kind** — no `POST /drafts`, no `GET /drafts/:id/items`, no
`PATCH`, no `:bulk` — across detection, the ten-row grid, Valuation and Review & submit.
*Positive control:* the same listing captured many requests to that identical API host, so a
`/drafts/` call would have appeared the same way. The absence is evidence, not a dead selector.

Client state at the same moment (`localStorage`): `gb_valuation_mirror` holding
`{last_step:"review", item_count:10, items_json:[…]}` — **12,468 characters of item data living in
the browser**, plus `gb_valuation_token` and `gb_guest_seller_id`.
Screenshot: `../../web-premise-proof-review-step.png`.

### ⚠️ Nuance this trace adds — the web DOES persist, just not as item rows

`POST /guest-valuations` fires after **every** edit. So the web is not purely in-memory: it mirrors
the client store into a server-side **record blob** (`gb_guest_valuations`, the `:4055`
guest-valuation store — see memory `project_guest_valuation_4055_backend`). Items become real
`gb_listing_draft_items` rows only when the visitor signs in and the claim path converts the record.

**What that means for mobile.** Phase 1's `localDraftSource` + MMKV is the correct analogue of the
*client store* half. It has **no analogue of the record-blob half**, so a mobile scan is currently
device-local: it will not survive a reinstall and cannot resume on another device. That is
acceptable for Phase 1 and is **not** a reason to add the item-rows route — if cross-device resume is
wanted later, the thing to copy is `POST /guest-valuations`, not `POST /drafts/:id/items`.
Logged here so a later phase does not "fix" this by reaching for the wrong endpoint.

### How the web actually does it — and this is the thing to copy

`nextjs-port/src/rtk/api/guestDraftStore.ts`, docblock lines 1–34, verbatim:

> The seller app's Scan V2 components are copied into this project VERBATIM, and every one of them
> reads its data through `draftApiSlice`: `GET /drafts/:id/items`, `PATCH /drafts/:id/items/:itemId`,
> `POST /drafts/:id/items:bulk`, and so on. Those endpoints need a real draft row, which needs a
> seller account […] So **this module IS the draft**: it answers the same URLs with the same shapes
> […] Their components are not modified — not one line — because **the substitution happens
> underneath them, at the base query**.

It deliberately reproduces `row_version` bumps and 409s on a stale `expected_row_version`,
`{ updated: n }` from a bulk op, and server-side filter/search/sort/cursor paging — so the grid
"pages exactly as it does against the real API". Its exported surface is the draft-items API:
`listItems:506` · `itemCounts:531` · `getItem:544` · `patchItem:635` · `bulk:683` ·
`convertCurrency:784`.

Honest differences it states: ids are local, and publish is not implemented (a guest cannot publish).

### What this means for mobile

- **No backend route is needed.** The Phase 1 agent's proposed `POST /drafts/:draftId/items` is a
  real gap in the API, but it is **not** how the reference flow works and **not** what this phase
  should build. Do not touch the backend in Phase 1.
- Mobile already owns the local half (`useScanDraft` + MMKV) and the server half
  (`src/services/drafts/draftItemsApi.ts`). What it lacks is the **adapter between them** — the
  `guestDraftStore` equivalent.
- The user's instruction for the spreadsheet lane — *"we already have everything built on the web
  version, just copy the way"* — applies to exactly this module.

---

## Scope (revised)

1. **Build `src/services/drafts/localDraftSource.ts`** — mobile's `guestDraftStore`. It answers the
   same six calls `draftItemsApi.ts` exposes (`listItems`, `itemCounts`, `getItem`, `patchItem`,
   `bulk`, `convertCurrency`), backed by `useScanDraft`. Port the web module's semantics, not its
   code: bump `row_version`, reject a stale `expected_row_version` with the same 409 shape, return
   `{ updated: n }` from a bulk op, and filter/sort/page locally.
   **Read `guestDraftStore.ts` before writing it.** It is ~800 lines and already solved every edge.
2. **One switch at the data boundary, not in the screen.** `items.tsx` must not learn about two
   worlds. Give `draftItemsApi.ts` (or a thin `useDraftItemsSource` hook) the substitution: a
   **local** draft id routes to `localDraftSource`, a **server** draft id to the network. This is the
   web's "substitution happens underneath them, at the base query" — the whole point.
3. **`processing-v2` hands off to `items.tsx?draftId=<local id>`** for both lanes and both shapes,
   after seeding the local source from `mapped.products`. The `routes.scanDetail` /
   `routes.scanGroupedReview` exits go.
   ⚠️ **Preserve `mergedSingleFields`/`mergedSingle` through the seed** — Phase 0 D2 found it is the
   only "these are actually one product" path, and dropping `detection.tsx` removes its entry point.
4. **`detected.tsx` is retired** — `items.tsx` is the detected screen. Its single-item head copy and
   "worth" block move to the Phase 4 collapse.
5. **`items.tsx` hooks bug** (P11) — ✅ **DONE 2026-09-23**: hooks moved above the `if (!draftId)`
   return. Same pattern check still owed on `valuation.tsx` / `submit.tsx`.
6. **`startV2Scan.ts:49` → `routes.v2Intake`** (P6) — ✅ **DONE 2026-09-23**.
7. **`items.tsx` → `valuation.tsx` for N > 1; → item collapse for N = 1** (collapse built in Phase 4;
   until then N = 1 goes to `valuation.tsx` too).

## Corrections to this doc's own history

- The claim that `processing-v2` still exits to `scanGroupedReview` was **stale**: `scanGroupedReview`
  survives only in a comment at `processing-v2.tsx:362`, and the detection hand-off was repointed to
  `routes.v2Detected` on 2026-09-22.
- **Live pre-existing bug, found by the Phase 1 agent, unrelated to this phase but landing in it:**
  `buildPendingAiDraftFields` sets `product_count: products.length`
  (`backend/services/recognitionRunner.js:245`), and `resumeDraftById` routes `product_count > 1` to
  `items.tsx` (`useResumeDraft.ts:83`, predicate `:205-207`) **before** its `kind === 'pending-ai'`
  branch. So a seller who backgrounds a multi-product scan and reopens it **lands on an empty grid
  today** — because no item rows exist. The Phase 1 adapter fixes this case only if the pending-ai
  branch is evaluated first; otherwise it needs its own one-line reorder. **Verify on device.**

## Files

`src/services/drafts/localDraftSource.ts` (new) · `src/services/drafts/draftItemsApi.ts` (the
substitution) · `app/scan/processing-v2.tsx` · `app/v2/scan/items.tsx` ·
`app/v2/scan/detected.tsx` (delete) · `src/lib/routes.ts` (drop `v2Detected`) ·
`src/features/v2/scan/startScanRun.ts` (docblock) · `src/__tests__/v2Inventory.test.ts`.

**No backend files. If this phase finds itself editing `101recycle-greenbidz-backend/`, it has gone
wrong — stop and re-read the premise above.**

## Acceptance — on the device, against the dev DB

1. Home → Scan it → PDF → Extract → lands on **`items.tsx`** showing 1 row, count badge, thumbnail.
2. Continue → **`valuation.tsx`** → **`submit.tsx`** → Publish → Published. Record the batch id.
3. Home → tap a **saved server** draft → **the same `items.tsx`**, now on the network source.
4. `drafts.tsx` empty state → "Scan an item" → **intake**, not the v2 camera. *(landed; press it)*
5. Cold-open `items.tsx` without `draftId` (deep link) → EmptyState, **no hooks crash**. *(landed; press it)*
6. `grep -rn "scanDetail\|scanGroupedReview" app/scan/processing-v2.tsx` → 0.
7. A 10-row xlsx seeds 10 local rows; accept 7; the count badge and Continue agree.

## Exit criteria

`npx tsc --noEmit` clean · `npx jest` no new failures (baseline **163 suites / 1704 tests**,
measured 2026-09-23) · `v2Inventory` lists no `scan/detected` · the seven steps screenshotted into
`Docs/v2/v2scan/phase-1/`.

## Not in this phase

Any change to what an item *looks* like on `items.tsx`. Bulk tools. The editor. Spreadsheets.
Any backend change.
