# Plan: GCS Upload Integration (mobile)

> **Goal:** stop uploading the same photo bytes twice on the smart-detect scan flow, and fix the Wordfence 403 that hits seller listings with ≥9 photos.
> **Strategy:** upload photos to Google Cloud Storage once (`POST /gcs/upload`), then reuse the returned object names / URLs for both AI analysis (`/wp/analyze-smart-detection`) and product creation (`/wp/create-product-direct`).
> **Authority:** `react_native_marketplace_ruleset_v2.md` > backend `routes/wpProductRoutes.js` + `routes/gcsRoute.js` > this file.
> **Revisions:** v1 2026-05-29 (initial); v2 2026-05-29 (review pass — backend fact-checks + workstream gaps).

---

## 0. Handoff Status

Same two-agent protocol as `me_plan.md` / `scan_plan.md`.

| Symbol | Meaning | Who sets it |
|---|---|---|
| ⬜ TODO | Not started | (initial) |
| 🔄 IN PROGRESS | claude is actively coding | claude |
| 🟡 READY FOR REVIEW | claude finished, reviewer to evaluate | claude |
| ❌ CHANGES REQUESTED | reviewer found issues | reviewer |
| ✅ APPROVED | reviewer accepted | reviewer |
| ⏭️ SKIPPED | explicitly deferred — must include a `Reason:` line | either |

### Current overall status

- **Last action by:** claude (review-pass cleanup 2026-05-29 — hardening + doc fixes)
- **Next action by:** reviewer (evaluate workstreams) + product owner (schedule manual W6 device pass)
- **Active workstream:** — (code complete for v1; **NOT yet APPROVED**)
- **Plan status:** 🟡 **Implementation in code, pending review + device QA.** All six workstreams are 🟡 READY FOR REVIEW. Automated gates green (tsc + eslint + 103/103 jest). Manual W6 device flow ⏭️ SKIPPED — needs a live device session before workstreams flip to ✅ APPROVED. F1 (grouped `image_urls_json`) is a P1 follow-up; F2 (backend `analyze-process-images` GCS support) is a backend dependency; F3 (warm-resume short-circuit) deferred — see §8.

---

## 1. Background — what changed on the backend

### 1.1 New `POST /gcs/upload` endpoint
- File: `routes/gcsRoute.js`, controller `controller/gcsController.js:uploadDirect` (lines 187–255).
- Auth: `x-system-key` header (mobile already sends this on every WP route).
- Request: `multipart/form-data`
  - `sellerId` (required, string)
  - `sessionId` (optional — server generates one if absent)
  - Files under field name **`files`** (controller also accepts `images` or any-array, but use `files` for parity with `/wp/analyze-smart-detection`'s field). Up to 20 per request, 20 MB each.
- **Object path is permanent**: `sellers/{sellerId}/{YYYY}/{MM}/{shortSession}/{filename}` (built via `buildPermanentUploadPath` in `config/gcs.js`). **No `temp/` indirection**, no later move step needed — the URL returned IS the final URL.
- Response (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "abc123…",
      "files": [
        {
          "originalName": "front.jpg",
          "contentType": "image/jpeg",
          "objectName": "sellers/574/2026/05/abc123/0-front.jpg",
          "gcsUri": "gs://<bucket>/<objectName>",
          "url": "https://storage.googleapis.com/<bucket>/<objectName>",
          "size": 184763
        }
      ]
    }
  }
  ```

### 1.2 `POST /wp/analyze-smart-detection` now accepts URLs *(additive — multipart still works)*
- File: `controller/wordPressSmart.js:smartDetectProducts` lines 542–586.
- Two modes — multipart **OR** JSON `image_urls`. The "(new)" comment in the controller flags this.
- JSON body when using URLs:
  ```json
  { "image_urls": ["https://…/objectA.jpg", "https://…/objectB.jpg"], "language": "en" }
  ```
- Vision API fetches the URLs directly — they **must be resolvable from the public internet** (no `x-system-key`).
- `image_indexes` in the response continue to index into the input order — preserve photo order when uploading (W1 acceptance).

### 1.3 `POST /wp/create-product-direct` accepts GCS paths *(additive — multipart still works)*
- File: `controller/wordPressV2.js` ~line 573.
- Request (multipart):
  - Replace `images=@photo.jpg` (one per file) with:
    - `gcs_image_paths[]=<objectName>` (one per photo)
    - `gcs_session_id=<sessionId>`
  - **Documents stay inline** (`documents=@file.pdf`) — Wordfence 403 only hits image counts.
  - All other product fields (`product_title`, `price_per_unit`, `allowed_sites[]`, etc.) unchanged.

### 1.4 `POST /wp/create-grouped-listings` accepts URLs *(partial — different field name)*
- File: `services/groupedListingSubmitService.js` lines 207–251.
- Optional body field: `image_urls_json` — a JSON-encoded array of arrays keyed by product index: `[["url0a", "url0b"], ["url1a"], …]`. When present for index `i`, those URLs are forwarded to `createProductV2` as `image_urls`.
- Different shape from `create-product-direct`'s `gcs_image_paths[]` + `gcs_session_id` — grouped accepts **URLs only**, not object names + session.
- **Not the same migration as W4** — covered in **F1 follow-up** (see §8).

### 1.5 NOT URL-aware *(don't migrate)*
- `POST /wp/analyze-process-images` (max 10) — single-product analyze; still `req.files` only.
- `POST /wp/analyze-process-images-v2` (max 4) — same handler `secondVersion`.
- These are used only by the manual-grouped per-item flow. Keep multipart there.

---

## 2. Current vs target flow

### Smart-detect single today *(legacy — duplicate upload)*
```
Capture
  └─ POST /wp/analyze-smart-detection   [multipart: photo bytes]   ← AI reads
Detail submit (later, possibly different session)
  └─ POST /wp/create-product-direct     [multipart: photo bytes]   ← Wordfence 403 on ≥9 photos
```

Code path *before this plan* — **superseded by v1; kept here as the legacy reference path** (legacy `smartDetect` is still exported for tests / no-auth fallback inside `useSmartDetect`):
- `smartDetect` in `src/services/scanner/smartDetect.ts` → multipart.
- `createProduct` in `src/services/scanner/createProduct.ts` (called from `src/features/scanner/useCreateListing.ts`) → multipart.

### Smart-detect single after this plan
```
Capture
  └─ POST /gcs/upload                   [multipart: photo bytes once]
       ↳ { sessionId, files: [{ objectName, url, … }] }   ← persist in draft.gcs (W5)
  └─ POST /wp/analyze-smart-detection   [JSON: image_urls + language]
Detail submit
  └─ POST /wp/create-product-direct     [multipart: gcs_image_paths[] + gcs_session_id + meta]
```

One byte upload; the two downstream calls are short JSON / metadata requests. Cuts mobile upload bandwidth on the analyze step to zero.

### Smart-detect grouped *(half-fixed in v1, full fix in F1)*
- After W1–W4: analyze duplicate upload **is eliminated** for grouped too (smart-detect call is shared between single/grouped — it runs on the original pile, not per item).
- But submit (`submitGroupedListings.ts` → `/wp/create-grouped-listings`) **still uploads bytes** per product index. **Wordfence 403 on ≥9 photos in any single product within the group remains** until F1 (§8).
- Manual grouped (no smart-detect — per-item analyze via `analyze-process-images`) is fully out of scope (see §5).

---

## 3. Mobile changes — workstream list

### W1 — `uploadGcsPhotos.ts` (new service) 🟡 READY FOR REVIEW

**Landed (2026-05-29):**
- `src/services/scanner/uploadGcsPhotos.ts` — `uploadGcsPhotos(photos, { sellerId, sessionId?, signal? })` + `GcsUploadedFile` / `GcsUploadResult` types. Appends `files` in `photos[]` order, web/native branch mirrors `buildFormData.ts:appendFile`. Forwards `signal` to axios. 60s timeout. Throws on `!success`.
- **Refactor during implementation:** `gcsUrlForAnalyze` (helper for W2's URL building) split into its own `src/services/scanner/gcsUrl.ts` so it has **zero native-module imports**. The uploader needs `greenbidz` → `interceptors` → `logout` → `mmkv` (a Nitro module), which crashes jest at import time. Splitting lets the URL helper be unit-tested without mocking the axios client. `uploadGcsPhotos.ts` re-exports it for caller convenience.
- `src/services/scanner/__tests__/uploadGcsPhotos.test.ts` — 4 unit tests for `gcsUrlForAnalyze` (default proxy URL, raw-URL escape hatch, fallback when raw flag set but url empty, trailing-slash on base URL).

**Verification:**
- `npx tsc --noEmit` exit 0.
- `npx eslint src/services/scanner/{uploadGcsPhotos,gcsUrl}.ts src/services/scanner/__tests__/uploadGcsPhotos.test.ts` exit 0.
- `npx jest` — 96/96 (was 92; +4 new). No regressions.

**Notes for reviewer:**
- Wired by W3 (`useSmartDetect` runs the upload + mergeGcs) and W4.c (`useCreateListing` reads the resulting map via `getGcsRefsForItem`).
- `uploadGcsPhotos` itself isn't covered by a unit test (would need to mock `@/api/greenbidzClient` — pulls in `react-native-mmkv` which crashes Jest). Acceptance for the upload behavior moves to W6's manual flow per the plan's "OK to skip if it gets ugly" note.
- **Hardening added on review pass (2026-05-29):** `files.length === photos.length` check after parsing the response. A short backend response was a silent mis-mapping risk because callers pair by index. Throws now.
**File:** `src/services/scanner/uploadGcsPhotos.ts` (new)
**Public API:**
```ts
export type GcsUploadedFile = {
  originalName: string;
  objectName: string;
  url: string;
  size: number;
};

export async function uploadGcsPhotos(
  photos: Photo[],
  opts: { sellerId: number; sessionId?: string; signal?: AbortSignal },
): Promise<{ sessionId: string; files: GcsUploadedFile[] }>;
```
- Builds `FormData` with `sellerId`, optional `sessionId`, and N entries under field name **`files`**.
- **Append in `photos[]` order** — the smart-detect API's `image_indexes` is index-based, so caller-side order must round-trip through GCS untouched. (W6 verifies.)
- POSTs to `${GREENBIDZ_API_URL}/gcs/upload` via the existing `greenbidz` axios client (gets `x-system-key` automatically).
- Forwards `signal` to axios so a navigation-away cancels the upload — mirrors how `processing.tsx` aborts analyze today.
- Web platform handling: reuse `appendFile`'s blob-fetch pattern from `buildFormData.ts` so it works on `expo start --web`.
- Timeout: 60 s per attempt (uploads can be heavy on cellular).
- Errors propagate as thrown `Error(message)` from response `success: false`.

**Acceptance:**
- `uploadGcsPhotos([1 photo], { sellerId: 574 })` returns `{ sessionId, files: [...] }` with non-empty `objectName`.
- Three-photo upload returns `files` in the same order as the input array.
- Works on web + Android (Photo `.uri` shape handled via the platform branch).
- Aborting via `signal` rejects with `AbortError` and leaves no partial state.
- Network error / non-200 throws a usable error message.

### W2 — Switch smart-detect to URL mode 🟡 READY FOR REVIEW

**Landed (2026-05-29):**
- Added `smartDetectFromUrls(imageUrls: string[], language, signal?)` to `src/services/scanner/smartDetect.ts`. JSON body `{ image_urls, language, site_type }`, `Content-Type: application/json`, 120s timeout matching the multipart path, forwards `signal`.
- **`site_type` included in the JSON body** — backend uses it to inject the marketplace's category list into the AI prompt so the response carries a matched `product_cat.id`. Without it the category comes back empty (`{id: ""}`) and the review hub shows "category missing". See `wordPressSmart.js:677-680`.
- **Legacy `smartDetect(photos, ...)` preserved** (per plan — useful for tests/fallback; same `site_type` form-field added to the multipart path).
- No `?lang=` query param added (today's mobile client doesn't send it).
- URL construction is the caller's responsibility — uses `gcsUrlForAnalyze(file)` from W1's `gcsUrl.ts`.

**Verification:**
- `npx tsc --noEmit` exit 0.
- `npx eslint src/services/scanner/smartDetect.ts` exit 0.
- Wired via `useSmartDetect` (W3).
**File:** `src/services/scanner/smartDetect.ts`
**Prereq:** W1 done. Caller passes `{ imageUrls, language }` instead of `Photo[]`.
- Add a new entry point:
  ```ts
  export async function smartDetectFromUrls(
    imageUrls: string[],
    language: string,
    signal?: AbortSignal,
  ): Promise<MappedSmartDetection>
  ```
  …that POSTs JSON to `/wp/analyze-smart-detection`:
  ```ts
  await greenbidz.post(
    '/wp/analyze-smart-detection',
    { image_urls: imageUrls, language },
    { headers: { 'Content-Type': 'application/json' }, timeout: 90_000, signal },
  );
  ```
- **Keep the existing multipart `smartDetect(photos, …)`** exported. It's still useful for tests/fallback and for the dev-flag escape hatch in §6. Don't delete.
- URL string per photo is built by a tiny helper `gcsUrlForAnalyze(objectName)` — see §6.
- `?lang=` query param: **don't add**. Today's mobile client doesn't send it and the controller reads `req.body.language`. Sending both is harmless but adds zero parity.

**Acceptance:**
- Smart-detect run after a 3-photo upload returns a mapped detection with no multipart byte upload on the wire.
- Response shape (mapped products / image_indexes) is byte-identical to the multipart path.

### W3 — One-pipeline orchestration 🟡 READY FOR REVIEW

> **Implementation moved from `app/scan/processing.tsx` → `src/features/scanner/useSmartDetect.ts`.** Original spec called for the chain to live in the screen; the hook is the cleaner home (see "Why hook-internal" below). Screen file is unchanged.

**Landed (2026-05-29):**

The pipeline lives inside `useSmartDetect.ts` rather than `processing.tsx` — kept the hook's external surface identical so `processing.tsx` doesn't change. The whole chain runs inside one `useMutation.mutationFn`:

1. `uploadGcsPhotos(photos, { sellerId, signal })` — push bytes to GCS once.
2. Merge `{ uri → objectName }` into the draft store via `useScanDraft.getState().mergeGcs(sessionId, entries)`.
3. `smartDetectFromUrls(imageUrls, language, signal)` — analyze via JSON URL mode.

**Why hook-internal vs. screen-internal:**
- Single `isPending` covers all three steps → no loader-flash bug.
- `processing.tsx`'s existing `AbortController` is forwarded through `signal` to step 1 and step 3 — navigation-away cancels cleanly.
- `processing.tsx` reads `smart.mutate({ photos, language, signal })` and `smart.isPending` / `smart.error` exactly as before; zero call-site changes.

**Fallback behavior:**
- If `useAuth.getState().profile?.id` is null (shouldn't happen on a guarded screen, but defensive), the hook silently falls back to the legacy multipart `smartDetect`. No user-visible difference.

**Out of scope this round (deliberate):**
- Progress UI copy update ("Uploading photos · Analyzing") — the existing checklist text doesn't distinguish upload from analyze. Nice-to-have polish; defer to a follow-up if the upload phase is noticeably long on real devices.

**Verification:**
- `npx tsc --noEmit` exit 0.
- `npx eslint src/features/scanner/useSmartDetect.ts` exit 0.
- `npx jest` — 103/103 still passing (no test of this orchestration; W6 manual flow covers it).

<details>
<summary><strong>Original spec (historical — superseded by the "Landed" block above)</strong></summary>

> Two bullets in the original spec did NOT survive implementation; flagged here so future reviewers don't chase them:
> - `applySmartDetection(detection, photos)` was listed as **step 3 inside the mutation**. In practice it stays in `processing.tsx`'s `onSuccess` handler (it dispatches store + router, which is screen-layer work). The mutation now returns the mapped detection and the screen calls `applySmartDetection` on success.
> - "Persist the GCS payload between step 1 and step 2 so an exit-then-resume can skip re-upload." The persist part landed (via `mergeGcs`), but the **resume short-circuit was deferred to F3** (see §8) — `pendingDetection` is memory-only and would need to be persisted first.

**File:** `app/scan/processing.tsx` (originally targeted; implementation now lives in `useSmartDetect.ts`)
- Replace the current "kick off smart-detect" useEffect with a single mutation that runs in sequence:
  1. `uploadGcsPhotos(photos, { sellerId, signal })`
  2. `smartDetectFromUrls(imageUrls, language, signal)`
  3. `applySmartDetection(detection, photos)` *(actually stays in `processing.tsx` `onSuccess`)*
- The whole chain is **one `isPending` boolean** so the loader doesn't flash between steps.
- Persist the GCS payload into the draft (W5) **between step 1 and step 2** so an exit-then-resume can skip re-upload. *(Persist landed; short-circuit deferred to F3.)*
- Reuse the existing `AbortController` for analyze — extend it to cover upload too. ✓ landed.
- Progress UI: extend the existing 3-step checklist to include an "Uploading photos" step. *(Deferred — copy unchanged for v1.)*
- Error handling: GCS upload failure surfaces via the same `applyError` retry path. ✓ landed.

**Acceptance (original):**
- Camera → processing splits into `upload → analyze → apply` internally with no visible loader gap.
- A simulated network drop during upload shows the retry CTA the existing error block uses.
- Navigating away during upload cancels it cleanly (no hung axios call after unmount).

</details>

### W4 — Switch product creation to GCS paths 🟡 READY FOR REVIEW
**Files:**
- `src/services/scanner/buildFormData.ts` — extend `buildProductFormData(item, photos, opts)` *(done in W4.a)*
- `src/services/scanner/createProduct.ts` — pass GCS args through *(W4.b)*
- `src/features/scanner/useCreateListing.ts` — **thread `draft.gcs` from the store** into `createProduct` *(W4.c)*

**Sub-tasks:**
- **W4.a** 🟡 READY FOR REVIEW (2026-05-29) — Extended `buildProductFormData(item, photos, opts, gcs?)`. New optional 4th arg `gcs?: ProductGcsRefs = { sessionId; objectNames }`. When provided:
  - Skips the `for (let i = 0; …) await appendFile(fd, 'images', …)` loop entirely.
  - Appends `gcs_image_paths[]=<objectName>` per name (in `photos[]` order).
  - Appends one `gcs_session_id=<sessionId>`.
  - Documents loop is **untouched** (still inline).
  - All other meta fields untouched.
  - When omitted: legacy behavior unchanged (verified by test #1).
  - Exported `ProductGcsRefs` type for W4.b / W4.c consumers.
  - Tests at `src/services/scanner/__tests__/buildFormData.test.ts` (3 cases, 99/99 passing). tsc + eslint clean.
- **W4.b** 🟡 READY FOR REVIEW (2026-05-29) — `createProduct(item, photos, opts, gcs?)` now accepts an optional 4th arg of type `ProductGcsRefs` and forwards it to `buildProductFormData`. No other behavior change. tsc + eslint clean.
- **W4.c** 🟡 READY FOR REVIEW (2026-05-29) — `useCreateListing` reads the session-level `useScanDraft.getState().gcs`, runs it through `getGcsRefsForItem(draft.photos, gcs)`, and passes the result to `createProduct`. When the helper returns null (no GCS map OR any URI missing an entry — e.g. retake), submit falls back to legacy multipart. tsc + eslint clean.

**Acceptance:**
- 1-photo listing still submits.
- 9- and 12-photo listings submit without Wordfence 403.
- Documents still attached.
- Submit network tab shows `gcs_image_paths[]` count == `draft.photos.length`, **no** `images` parts.

### W5 — Draft / store integration 🟡 READY FOR REVIEW

**Landed (2026-05-29):**
- Exported `DraftGcs` type from `src/stores/scanDraftStore.ts`: `{ sessionId: string; objectNameByPhotoUri: Record<string, string> }`.
- Added `gcs: DraftGcs | null` to `ScanDraftState` and to `PersistedScan` (so it persists across hydrates).
- Added `mergeGcs(sessionId, entries)` and `clearGcs()` actions. `mergeGcs` merges into the existing map when `sessionId` matches; replaces wholesale when sessionId changes (treat as a new upload session).
- Wired lifecycle:
  - `hydrate` restores `gcs` from MMKV (legacy persisted drafts → `null`).
  - `setPendingPhotos` clears `gcs` (new capture session = old URIs irrelevant).
  - `clearPendingPhotos` clears `gcs`.
  - `reset` clears `gcs`.
  - **All other actions (`start`, `updatePhotos`, `applySmartDetection`, `enqueue*`, etc.) preserve `gcs`.** The map is monotonic within a session; consumers detect "no entry for this URI" and trigger re-upload on the next processing pass. Matches the plan's "reorder = no re-upload, retake = re-upload" acceptance criteria — a blanket `updatePhotos → clearGcs` would needlessly re-upload on reorder.
  - **Why `start()` doesn't clear `gcs`:** the call order is `start(photos)` → screen mounts `processing.tsx` → `uploadGcsPhotos` → `mergeGcs`. So `start()` runs *before* the upload populates the map for this session. Preserving `gcs` here is safe because either (a) the map is null/empty (cold start of a new session — nothing to preserve), or (b) the map carries entries from a still-current session and reorder/photo-add survives. When a brand-new capture session begins, `setPendingPhotos` clears the map upstream, so by the time `start()` runs the prior session's entries are already gone. A new `mergeGcs` call from `useSmartDetect` then either extends the existing map (same `sessionId`) or replaces it wholesale (different `sessionId`).
- Added pure helper `getGcsRefsForItem(photos, gcs)` in `src/services/scanner/gcsUrl.ts` (returns `ProductGcsRefs | null`): returns null if `gcs` is absent OR any photo URI lacks an entry; otherwise builds `objectNames` in `photos[]` order. Caller falls back to legacy multipart when null.
- Tests added for `getGcsRefsForItem` (4 cases — null gcs, missing entry, in-order names with shuffled input, empty photos array).

**Verification:**
- `npx tsc --noEmit` exit 0.
- `npx eslint` on touched files exit 0.
- `npx jest` — 103/103 (was 99; +4 new). Pre-existing `scanDraftStore.test.ts` still passes — `defaultSession()` change is additive.

**Notes for reviewer:**
- Storing `gcs` at **session level** (not per-DraftItem) was a judgment call vs. the plan's wording. Rationale: one capture session = one GCS upload, and `applySmartDetection` slices the captured photos into N draft items — keeping the map at session scope avoids duplicating the same URI→objectName entries across items. The `getGcsRefsForItem` helper handles the per-item lookup.
- No store-level test for `mergeGcs` itself — the action is trivial state shuffling and `getGcsRefsForItem` covers the consumer-side correctness. Add one if reviewer wants belt-and-braces.

**Spec recap (matches what landed):**

Shape — session-level (not per-DraftItem):
```ts
type DraftGcs = {
  sessionId: string;
  /** keyed by Photo.uri so reordering / removal can be tracked precisely */
  objectNameByPhotoUri: Record<string, string>;
};
```
Why keyed by `Photo.uri` (not by index): `applySmartDetection` slices the captured `Photo[]` into multiple `DraftItem`s (one per detected product). At create time, each `DraftItem` has its own subset of `photos[]`. Mapping by URI survives that slicing without us tracking original indexes.

Lifecycle — **monotonic map within a session, clear only on session boundaries:**
- `reset()` — clear.
- `setPendingPhotos()` — clear (new capture session = unrelated URIs).
- `clearPendingPhotos()` — clear.
- `start(photos)` — **preserve**. Call order is `start()` → screen mounts `processing.tsx` → `uploadGcsPhotos` → `mergeGcs`, so `start()` runs *before* the upload. Preserving is safe because (a) on a brand-new capture session `setPendingPhotos` upstream already cleared the map, so `start()` inherits null, and (b) on a same-session re-entry the existing entries still match the photo URIs. Clearing in `start()` would force a redundant re-upload on every same-session re-entry without ever helping the cross-session case (`setPendingPhotos` already handles that).
- `updatePhotos()`, `applySmartDetection()`, `enqueue*()`, all other actions — **preserve**. The map is uri-keyed so:
  - Reorder = no re-upload (entries still match).
  - Photo removal = no re-upload (remaining entries still match).
  - Retake = the new URI lacks an entry → `getGcsRefsForItem` returns null → submit falls back to legacy multipart, processing run re-uploads.

Consumer contract — `getGcsRefsForItem(photos, gcs)` in `gcsUrl.ts`:
- Reads `gcs.objectNameByPhotoUri[photo.uri]` for each photo in `photos[]` order.
- Returns `null` if any URI lacks an entry → caller falls back to legacy multipart.
- Returns `{ sessionId, objectNames }` in `photos[]` order when fully covered.

Acceptance:
- Cold-resume after submit completes a previously-uploaded draft (no re-upload). Manual W6.
- Reset → next scan re-uploads. Manual W6.
- Retake of one photo → next processing pass re-uploads (URI changed, no entry). Manual W6.
- Reorder photos via `reorder-photos` screen → no re-upload (we key by URI). Manual W6.

### W6 — Verification 🟡 READY FOR REVIEW (automated gates ✅, manual flow ⏭️ SKIPPED — no live device)

**Automated gates (passed 2026-05-29):**
- `npx tsc --noEmit` — exit 0 (whole project).
- `npx eslint` on all 10 touched/new files — exit 0.
- `npx jest` — 103/103 passing (was 92 before this plan; +11 new tests from W1 / W4.a / W5).

**Unit-test coverage delivered:**
- `gcsUrlForAnalyze` — 4 cases (default proxy URL, raw-URL escape hatch, fallback when raw flag is set but url empty, trailing-slash stripping).
- `getGcsRefsForItem` — 4 cases (null gcs, missing URI entry, in-order names with shuffled input, empty photos).
- `buildProductFormData` GCS branch — 3 cases (legacy path emits `images` parts, gcs path emits `gcs_image_paths[]` + `gcs_session_id` with NO `images`, documents still inline).

**Manual device flow — ⏭️ SKIPPED.**
**Reason:** no live device or emulator available in this session.
Items deferred to the next session that has one:
- 1-photo / 5-photo / 12-photo single-listing submits — verify the 12-photo case lands without Wordfence 403.
- Smart-detect 6-photo capture with 2 products detected — split + both submits succeed.
- Forced network drop during `/gcs/upload` — retry CTA fires; no hung axios after navigate-away.
- Network tab evidence — one `/gcs/upload`, `/wp/analyze-smart-detection` is JSON not multipart, `/wp/create-product-direct` carries `gcs_image_paths[]` + `gcs_session_id` and no `images` parts.

---

## 4. Sequence of work

```
W1 (uploadGcsPhotos + gcsUrl helper)
  ├─ W2 (smart-detect URL mode)         (§6 resolved with default + escape hatch)
  └─ W4 (createProduct GCS paths)
       └─ W4.c (useCreateListing wiring)
W2 ─┐
W4 ─┼─→ W3 (single-mutation pipeline inside useSmartDetect)
W5 ─┘
       └─ W6 (verification)
```

- W1 was the unblocking step; everything downstream landed in dependency order.
- W2 / W4 ran in parallel after W1; §6 was resolved up-front with serve-proxy default + dev escape hatch (no backend ack needed).
- W3 ended up living inside `useSmartDetect` rather than `processing.tsx` (see W3's "Why hook-internal vs. screen-internal" note).

---

## 5. Out of scope (don't touch in this plan)

| Area | Reason |
|---|---|
| `/wp/analyze-process-images` (manual single-product analyze, max 10) | Backend not URL-aware. Manual grouped uses this per item. |
| `/wp/analyze-process-images-v2` (max 4) | Same — `secondVersion` controller. |
| Documents upload | Wordfence 403 doesn't hit docs. Keep inline. |
| Retry queue / background upload | Fail fast with a retry CTA (W3). |

---

## 6. Open question — RESOLVED with default + escape hatch

**Which URL string does mobile put into `image_urls` for analyze-smart-detection?**

Vision API on the backend fetches each URL externally → it must resolve from the public internet without `x-system-key`.

**Default (no backend ack required):** **(b) serve-URL proxy**. In-repo `controller/gcsController.js:serve` is explicitly *"PUBLIC endpoint (no system-key) — used as a stable image URL in attachment.guid. Resolves to a fresh short-lived signed URL and 302 redirects."* This works regardless of bucket-level public-read configuration. Production GCS buckets are typically private; assume that.

**Implementation (landed):** helper in `src/services/scanner/gcsUrl.ts`:
```ts
import Constants from 'expo-constants';
export function gcsUrlForAnalyze(file: { objectName: string; url?: string }): string {
  if (process.env.EXPO_PUBLIC_GCS_USE_RAW_URL === '1' && file.url) return file.url;
  const extra = Constants.expoConfig?.extra ?? {};
  const base = String(extra.GREENBIDZ_API_URL ?? '').replace(/\/+$/, '');
  return `${base}/gcs/serve?path=${encodeURIComponent(file.objectName)}`;
}
```
- API URL comes from `Constants.expoConfig.extra.GREENBIDZ_API_URL` (matches the rest of the app — see `src/api/greenbidzClient.ts`).
- **Escape hatch (dev-only):** if `process.env.EXPO_PUBLIC_GCS_USE_RAW_URL === '1'` AND `file.url` is present, return the raw `storage.googleapis.com` URL instead. Useful when running against a dev backend with a public bucket.
- W2 calls this helper to build `image_urls`.

If backend confirms bucket is publicly readable, we can flip the default — but we **didn't block on that**.

---

## 7. Non-goals

- Migrating manual-grouped or single-product analyze (see §5).
- Changing how documents are uploaded.
- Adding background uploads / retry queues.
- Rewriting `buildProductFormData`'s field layout — only the photo-append loop changes.
- Squashing the two-flow ambiguity between smart-detect-single and manual-grouped — kept on separate paths per §1.5 / §5.

---

## 8. Follow-ups (not in v1)

### F1 — Grouped submit via `image_urls_json` ⬜ DEFERRED
- File: `src/services/scanner/submitGroupedListings.ts`
- Backend already supports `image_urls_json` on `/wp/create-grouped-listings` (`services/groupedListingSubmitService.js:207-251`). Shape: `[[url0a, url0b], [url1a], …]` keyed by product index.
- After W5 we have `draft.gcs.objectNameByPhotoUri` for every captured photo. The grouped submit packs N `DraftItem`s, each with its own `photos[]` subset. Build `image_urls_json` per-item by mapping each photo's URI → object name → `gcsUrlForAnalyze`.
- Submit becomes: JSON `image_urls_json` + meta, **no** `images_${i}[]` multipart parts.
- **Why deferred:** the v1 priority is the smart-detect single path. F1 reuses W1's upload and W5's store shape — pure incremental.

### F2 — Backend GCS support on `/wp/analyze-process-images*` ⬜ NEEDS BACKEND
- Manual-grouped per-item analyze currently re-uploads bytes per item. Would benefit from the same `image_urls` mode. Not a mobile-side task — file a backend ticket if/when this becomes a priority.

### F3 — Warm-resume short-circuit (skip upload + analyze on resume) ⬜ DEFERRED
- **Original W5 spec said:** if `pendingDetection` is present AND `gcs` covers all current photos by URI, skip upload + analyze and go straight to `applySmartDetection`.
- **Why deferred:** `pendingDetection` is **memory-only** by design (store comment: *"Never persisted — a fresh app launch falls back to staged where the user re-runs AI rather than risk applying stale grouping to edited photos."*). Adding the short-circuit would require persisting `pendingDetection` too, which the original author explicitly avoided. Worth a separate plan call (do we want to relax that rule?) rather than smuggling it into this one.
- **Today's behavior:** cold launch → fresh upload + fresh analyze. Inside a single app session, `processing.tsx` already skips processing if `draft.ai` exists (single-product path) or `pendingDetection` is held in memory (smart-detect grouped path). The fully-cold resume case is the only one without a short-circuit.

---

## 9. Priority

| Priority | Item | Why |
|---|---|---|
| **P0** | §6 default (serve-URL) + W1 + W2 + W3 | Stops double upload on analyze; unblocks the rest |
| **P0** | W4 (incl. W4.c) + W5 | Fixes ≥9-photo Wordfence on **single** submit |
| P0 | W6 | Don't ship without verifying |
| P1 | **F1** — grouped `image_urls_json` | Same bytes win + Wordfence on multi-product submit |
| P2 | F2 — backend gcs on analyze-process-images | Helps manual-grouped only; backend dependency |

---

## 10. Bottom-line summary

The plan is a small, contained mobile refactor riding additive backend changes. After v1:

- One `/gcs/upload` per scan session.
- `/wp/analyze-smart-detection` is JSON, not multipart.
- `/wp/create-product-direct` carries `gcs_image_paths[]` + `gcs_session_id` instead of raw image parts.
- Wordfence 403 on single-product submit is gone.
- Grouped submit is *partially* improved (analyze fixed, submit still multipart) — full fix in F1.
- Manual-grouped is untouched (correct — backend not URL-aware there).

Risk surface: small. Backwards-compatible (multipart paths still work server-side). Failure mode is "GCS upload errored, show retry" — no hidden corruption paths.
