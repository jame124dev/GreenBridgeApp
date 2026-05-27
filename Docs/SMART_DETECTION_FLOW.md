# Smart-detection scan flow — plan

**Goal:** let the seller scan a pile of photos once and have the AI decide whether they're **one product** or **several distinct products**, then drop them into an **Item Review** screen to confirm/edit before submit. Removes the upfront "single vs grouped" choice — the AI proposes, the seller confirms.

**New flow:** `Scan → Camera → Processing (smart-detection) → Item Review → Detail (per item) → Success`

**Status:** Phases 0–4 shipped + **phase-4 review hardening** (2026-05-27): service + mapper + `applySmartDetection` + **Processing behind `EXPO_PUBLIC_SMART_DETECT`** + **Item Review** + **entry routing (flag-gated)** + post-review fixes (grouped-nav loader flash, manual-grouped → camera with `mode='grouped'`, `flags.ts` comment). Phase 5 (on-device verification, flip default flag, companion docs) pending. Flag **off** by default — legacy listing-method/`useAnalyzeImages` until `EXPO_PUBLIC_SMART_DETECT=1` or default flip after device QA. Companion docs: [SCANNER_FLOW.md](./SCANNER_FLOW.md), [CAMERA_WHATSAPP_REDESIGN.md](./CAMERA_WHATSAPP_REDESIGN.md), [LOCALIZATION.md](./LOCALIZATION.md).

---

## 1. The endpoint we're wiring

`POST /api/v1/wp/analyze-smart-detection` (backend: `controller/wordPressSmart.js`).

**Request** — `multipart/form-data`:
- **`files`** — up to **20** (⚠️ field name is `files`, **not** `images` like the old `analyze-process-images`).
- `language` — `en` / `zh` (`zh-hant` is normalized to `zh` server-side; mobile's `toAnalyzeLanguage()` already emits `zh-hant`/`en`, so we send what we send today).

**Caps (server constants):** `MAX_FILES = 20`, `MAX_PRODUCTS = 10`. The detection pass clamps to ≤10 products; if the AI proposes more they're dropped server-side. Client should still defensively cap/round and never assume `products.length ≤ 10` is enforced for it downstream.

**Response:**
```jsonc
{
  "success": true,
  "language": "en",
  "detection": { "suggested_mode": "single" | "multiple", "confidence": 0..1, "summary": "2 items detected" },
  "merged_single": { /* full product data if everything were ONE listing */ },
  "products": [
    { "id": "p-1", "image_indexes": [0,2,3], "document_indexes": [], "data": { /* full product */ } }
  ],
  "suggested_terms": { "product_cat": [...], "auc-location": [...], "auction_group": [...] }
}
```
- `image_indexes` are **global** indexes into the uploaded `files[]` → map straight back to the local `Photo[]` we sent.
- Each `data` block carries: `name`, `equipment_description`, `condition`, `price`, `currency` (always `"USD"` server-side — see §6), `weight`, `dimensions`, `co2_emissions`, `year`, plus taxonomy as `{id,name}`: `product_cat`, `subcategory`, `auc-location`, `auction_group`; `operation_status` is forced to `""`.

**Backend caveats that shape our client (from the endpoint review):**
1. **Field is `files`** — new form-data builder needed (the existing one posts `images`).
2. **Latency** — N+1 sequential OpenAI calls (1 detect + 1 per product + 1 merged in multiple mode). A 5-item batch can take 20–60 s. Our client timeout must be generous (≥120 s, matching the server) and Processing must show real progress, not a fake spinner.
3. **All-or-nothing** — one bad extraction 500s the whole request server-side; the client must handle a clean failure (offer retry / fall back to manual single).
4. **Currency hardcoded USD** — for 101it (TWD) we override client-side from `defaultCurrencyForSite(SITE_TYPE)` when mapping, same as today.
5. **Docs/videos ignored** — only send images to this endpoint; don't waste the 20-file budget on PDFs/videos.

---

## 2. Current vs. new

**Today:** the seller pre-chooses on the **Listing method** screen (Single vs Grouped). Single → one draft → `analyze-process-images` (one product) → Detail. Grouped → manual: scan each unit, queue it, repeat, then Grouped Review.

**New:** the **Listing method screen becomes optional / goes away** for the common path. The seller just scans everything, and smart-detection proposes the split:
- `suggested_mode: "single"` → one item → straight to **Detail** (skip Item Review entirely — see §8 Q3).
- `suggested_mode: "multiple"` → **Item Review** screen lists the detected items (each = grouped photos + AI title), seller confirms → edits each → submits as one batch.

The manual Grouped path can stay as a fallback ("scan items one by one") but is no longer the default for multi-item piles.

---

## 3. Data mapping → scan draft store

The store already models exactly what we need:
- `current: DraftItem` — the single in-progress item.
- `queuedItems: DraftItem[]` — multiple items staged for a grouped batch.
- `mode: 'single' | 'grouped'`.

**Mapping the response:**

| Response | Store action |
|---|---|
| `suggested_mode === "single"` | `applySmartDetection(mapped, sourcePhotos)` → one `DraftItem` (first mapped product's photos + fields), `mode='single'`, `current=<item>`, route **Detail**. |
| `suggested_mode === "multiple"` | `applySmartDetection` → `queuedItems[]` (per-product photo slices + fields), `mode='grouped'`, `current=null`, route **Item Review**. Stashes `mergedSingle` + detection meta for the override. |

### 3.1 The mapper is NOT a thin `mapAnalyze` wrapper

`mapAnalyze` only handles the old `analyze-process-images` shape (name, description, condition, `price.reselling_price`). Smart-detection's `data` is richer and **differently shaped**, so `mapSmartDetection` needs its own field logic:

- **Price** — `data.price` is a **rich object** (rounded server-side), not a flat number. Need a dedicated price reducer: pick the right sub-field → `pricePerUnit` (string) + derive `priceFormat` (`buyNow` if a concrete price, else `offer`). Don't assume `price.reselling_price`.
- **Currency** — server hardcodes `"USD"`; **override** with `defaultCurrencyForSite(SITE_TYPE)` (101it → TWD) in the mapper.
- **Taxonomy** — `product_cat` / `subcategory` / `auc-location` / `auction_group` arrive as `{id, name}` (already DB-matched). Map `product_cat.id`→`categoryId`, `product_cat.name`→`categoryName`; keep `subcategory` if we surface it. When `id === ""` (no match) the value lives in `suggested_terms` — treat as "uncategorized," leave `categoryId` null.
- **`operation_status`** — server clears it (`""`); don't rely on it. Default from `manualEntryDefaults()`/`DEFAULT_OPERATION_STATUS`.
- **Location is NOT prefilled.** The AI returns `item_location` → matched into the `auc-location` **taxonomy** (`{id,name}`), which is a different concept from the Detail form's free-text `location.address` / `location.country`. The mapper must **not** fake those as filled — leave `location` null. Sellers will still hit the REQUIRED-bar location rows on Detail, exactly as today. (If we later want to prefill, we'd parse the taxonomy name into address/country — out of scope.)
- **Prefilled values go on the item's own fields, not just `ai`.** Detail reads `title` / `description` / `categoryId` / `categoryName` / `condition` / `pricePerUnit` / `priceFormat` / `priceCurrency` from the `DraftItem` directly. So the mapper must populate **those** fields. `ai` (the narrow `AiResult`: name/description/condition/price/currency) is only what drives the "✨ AI" badges — set it too if we want the badges, but do **not** rely on `setAi` alone and skip the real fields (that would leave Detail blank). Net: map into the item fields first; `ai` is a cosmetic mirror.
- **Per-item provisioning** — each built `DraftItem` also gets: `lastStep: 'detail'`, fresh `id`, empty `documents`, site-default visibility — matching what the manual grouped path produces so the submit pipeline treats them identically.

**Mapper signature:** `mapSmartDetection(response, siteType) → MappedSmartDetection` (`mode`, `products[]` with `imageIndexes` + `SmartItemFields`, `mergedSingleFields`, `meta`).

### 3.2 Photo slicing (`applySmartDetection.ts`) — ✅ shipped

Pure helpers (unit-tested) between mapper and store:

- **`slicePhotosByIndexes`** — dedupe; drop negative, non-integer, and `index >= source.length`.
- **`buildPhotoSlices`** — one photo array per product; **orphan** source photos (never referenced) append to **group 0** (mirrors backend).
- **`validateMappedDetection`** — rejects zero source photos or zero mapped products (`SmartDetectionApplyError`).
- **`smartDetect`** — fails fast when `photos.length === 0` before POST.

### 3.3 Store apply (`scanDraftStore.applySmartDetection`) — ✅ shipped

`applySmartDetection(mapped, sourcePhotos)` (async):

1. Validates → builds slices → assembles each `DraftItem` via `emptyDraft()` + field spread + **`persistPhotosForDraft` per item** (new draft id per group).
2. Builds **`mergedSingle`** from **all** `sourcePhotos` + `mergedSingleFields` (override uses full pile).
3. Persists on store + MMKV: `mergedSingle`, `detectionSummary`, `detectionConfidence`.
4. Returns `'single'` (`current` = first item, `queuedItems` cleared) or `'grouped'` (`queuedItems`, `current` null).
5. Skips mapped products whose slice is empty; throws if none remain.

**`collapseToSingleFromSmartDetection()`** — grouped Item Review "it's one product" → `mode='single'`, `current=mergedSingle`, clears queue + meta (ready for phase 3 UI).

`reset()` clears smart-detection fields.

---

## 4. New "Item Review" screen

Purpose: confirm the AI's split **before** editing details. This is the human checkpoint on the AI's grouping decision.

Contents:
- Header: `detection.summary` ("2 items detected") + a confidence hint when low (`confidence < 0.7` → subtle "Double-check the grouping" note).
- One **card per detected item**: cover photo (first of its group) + **photo-count badge** (`item.photos.length`) + AI title + category chip. Tap → edit that item in Detail.
- Per-card actions: **Edit**, **Remove**, and (stretch) **merge into another** / **split**.
- A prominent **"It's actually one product"** toggle/button → collapse all groups into a single item using `merged_single`, switch to `mode='single'`, go to Detail. (This is why the backend returns `merged_single` — wire it to this control so the extra server call isn't wasted.)
- Primary CTA: **Submit N items** → existing grouped submit pipeline (`useSubmitGroupedListing`), which already creates N products + 1 batch with partial-failure resilience.

This is close to today's **Grouped Review** screen — we likely **extend grouped-review.tsx** rather than build net-new: it already renders item cards, edit/remove, add-another, and the plural submit. New bits: the summary/confidence header and the "it's one product" override.

For `suggested_mode === "single"` we skip Item Review and go straight to Detail (Detail already has the photo gallery from the recent change).

---

## 5. Files to touch

| File | Change |
|---|---|
| `src/services/scanner/buildFormData.ts` | Add `buildSmartDetectionFormData(photos, lang)` posting field **`files`** (mirrors the `images` builder; images only). |
| `src/services/scanner/smartDetect.ts` *(new)* | `smartDetect(photos, language, signal)` → POST `/wp/analyze-smart-detection`, returns typed response. |
| [mapSmartDetection.ts](../src/features/scanner/mapSmartDetection.ts) | ✅ Pure mapper → `MappedSmartDetection`. |
| [applySmartDetection.ts](../src/features/scanner/applySmartDetection.ts) | ✅ `slicePhotosByIndexes`, `buildPhotoSlices`, `validateMappedDetection`, `SmartDetectionApplyError`. |
| [useSmartDetect.ts](../src/features/scanner/useSmartDetect.ts) | ✅ React Query mutation wrapper. |
| [scanDraftStore.ts](../src/stores/scanDraftStore.ts) | ✅ `applySmartDetection(mapped, sourcePhotos)` + `collapseToSingleFromSmartDetection()`; MMKV fields `mergedSingle`, `detectionSummary`, `detectionConfidence`. |
| [processing.tsx](../app/scan/processing.tsx) | ✅ `useSmartDetect` when `SMART_DETECT_ENABLED && mode === 'single'`. Loader renders **before** `if (!draft) return null` so smart grouped (`current` cleared + `isNavigating`) doesn't flash blank. Camera-bounce: `if (isNavigating) return;`. Mode-gating keeps manual grouped on legacy analyze. |
| [grouped-review.tsx](../app/scan/grouped-review.tsx) | ✅ Item Review: detection summary + confidence + "it's one product" override (`mergedSingle`). |
| **Entry-routing (Phase 4):** | ✅ all flag-gated |
| [index.tsx](../app/(tabs)/index.tsx) | ✅ Scan → camera (flag on) / listing-method (off). **"One by one"** link: `reset()` + `setListingMode('grouped')` + camera (skips picker). |
| [scan.tsx](../app/(tabs)/scan.tsx) | ✅ Scan-tab launcher: `useFocusEffect` reset + → camera (flag on) / listing-method (off). |
| [scanResume.ts](../src/lib/scanResume.ts) | ✅ `freshScanRoute` by flag; grouped+queued → grouped-review. |
| [flags.ts](../src/lib/flags.ts) | ✅ `EXPO_PUBLIC_SMART_DETECT`; comment documents Phase 5 / on-device gate. |
| [listing-method.tsx](../app/scan/listing-method.tsx) | Unchanged — still used when flag off (Scan tab / home). Flag-on primary path skips it; listing-method Single still → smart-detect if chosen. |
| [_seed_keys.py](../src/i18n/_seed_keys.py) | ✅ `mobile.itemReview.*` (phase 3) + `mobile.home.scanOneByOne` (phase 4) across all 4 locales. |

---

## 6. Edge cases & decisions

- **AI over-splits / under-splits.** The whole point of Item Review is to let the seller fix this. Minimum viable: Remove + "it's one product" override. Merge/split between groups is a stretch goal (needs photo re-assignment UI).
- **Low confidence** (`< 0.7`) — surface a gentle warning on Item Review; never block.
- **Single-mode but seller wants multiple** — rare; they can use the manual Grouped path. Don't over-build a "split this" flow for v1.
- **`image_indexes` integrity** — mapper drops invalid indexes; **`buildPhotoSlices`** attaches unreferenced photos to group 0; out-of-range indexes are skipped (not a hard error).
- **Empty / degenerate API** — `products: []` maps to zero products; **`validateMappedDetection`** / **`applySmartDetection`** throw `SmartDetectionApplyError` (Processing should catch → error UI).
- **Price display** — `pickPrice` rounds with `Math.round` (e.g. 1499.6 → `"1500"`), matching server rounding.
- **Currency** — override server's hardcoded `USD` with `defaultCurrencyForSite(SITE_TYPE)` in the mapper (101it → TWD).
- **Request failure / timeout** — Processing shows the existing error block with **Retake** + **Continue without AI**. Note: "Continue without AI" today drops **all** photos onto **one** manual draft (`manualEntryDefaults()`), which is fine for a failed single but **misleading if the pile was obviously multi-item**. Acceptable for v1; optional later: add a "split manually" link from the error block into the grouped/listing-method path. Smart-detect's higher latency makes the 30 s "still working" message more important — keep it. On a repeated 500 after many images, consider surfacing a "try fewer photos" hint (the all-or-nothing extraction is more likely to fail with a big batch).
- **Documents** — don't send to this endpoint; attach them later in Detail (existing doc picker) so they don't eat the 20-file image budget.
- **Resume** — a smart-detection multi-item result populates `queuedItems`; resume logic (`scanResume.ts`) already routes a grouped draft with queued items to Grouped/Item Review.
- **Scan tab + flag on** — every Scan-tab focus runs `reset()` then camera (fresh start per tap). Tapping Scan while a resumed grouped review is open **wipes** the session; intentional, document for QA.

---

## 7. Phasing

0. **Typed response + mapper fixtures** — ✅ **DONE (2026-05-27)**
   - ✅ [smartDetectionTypes.ts](../src/features/scanner/smartDetectionTypes.ts) — typed `SmartDetectionResponse` + mapped shapes (`SmartItemFields`, `MappedProduct`, `MappedSmartDetection`).
   - ✅ [mapSmartDetection.ts](../src/features/scanner/mapSmartDetection.ts) — **pure** mapper. Returns field bundles + `imageIndexes`, *not* `DraftItem[]` (the store's `applySmartDetection` assembles DraftItems via `emptyDraft()`, keeping id/photo-persistence/site-defaults in the store and the mapper test-pure — a refinement on the original §3 signature). Includes `pickPrice()` reducer (number/string/object), currency override, `{id,name}` taxonomy → `categoryId/categoryName`, `MAX_PRODUCTS=10` clamp, "multiple-with-1-product → single" collapse.
   - ✅ [__tests__/mapSmartDetection.test.ts](../src/features/scanner/__tests__/mapSmartDetection.test.ts) — **14 tests** (mapper + `slicePhotosByIndexes` + `buildPhotoSlices` orphans + `validateMappedDetection` + MAX_PRODUCTS clamp + empty products). `@jest/globals` imports.
1. **Service + form-data + hook** — ✅ **DONE (2026-05-27)**
   - ✅ [buildFormData.ts](../src/services/scanner/buildFormData.ts) — `buildSmartDetectionFormData` (field **`files`**, images-only).
   - ✅ [smartDetect.ts](../src/services/scanner/smartDetect.ts) — POST + 120 s timeout + multipart safeguards; **rejects empty `photos`** before POST.
   - ✅ [useSmartDetect.ts](../src/features/scanner/useSmartDetect.ts) — React Query mutation.
1b. **Store apply layer** — ✅ **DONE (2026-05-27)**
   - ✅ [applySmartDetection.ts](../src/features/scanner/applySmartDetection.ts) — photo slicing + validation.
   - ✅ [scanDraftStore.ts](../src/stores/scanDraftStore.ts) — `applySmartDetection`, `collapseToSingleFromSmartDetection`, persisted detection meta.
   - **Verification:** `tsc --noEmit` clean · **14/14** jest · no screen wired yet.
2. **Processing → branch** — ✅ **DONE (2026-05-27)**
   - ✅ [flags.ts](../src/lib/flags.ts) — `SMART_DETECT_ENABLED = process.env.EXPO_PUBLIC_SMART_DETECT === '1'` (off by default).
   - ✅ [processing.tsx](../app/scan/processing.tsx) — when the flag is on, `useSmartDetect` runs instead of `useAnalyzeImages`; on success calls `applySmartDetection(mapped, photos)` **once** then `router.replace` by returned mode (`single`→Detail, `grouped`→grouped-review). Apply-layer throw → new `applyError` state surfaced in the shared error block (alongside `smart.isError` / `analyze.isError`). `isPending` + the loader/abort/slow-message UX branch on the flag. Multiple-mode never touches the old `setAi`+`patch` path.
   - ✅ **Critical hardening:** fixed grouped-route race and stale-error lifecycle. Guarded the processing effect so smart grouped transitions (`current=null` + queued items) do not misfire `router.replace(scanCamera)`, and reset `applyError` on each new run/success to avoid sticky stale messages.
3. **Item Review** — ✅ **DONE (2026-05-27)**
   - ✅ [grouped-review.tsx](../app/scan/grouped-review.tsx) — smart-detection banner (only when `detectionSummary` is set): ✨ summary line + low-confidence hint (`confidence < 0.7`) + **"It's actually one product →"** override calling `collapseToSingleFromSmartDetection()` → `router.replace(Detail)`. Banner is inert on the manual grouped path (meta empty).
   - ✅ [_seed_keys.py](../src/i18n/_seed_keys.py) — `mobile.itemReview.lowConfidenceHint` + `itsOneProduct` across all 4 locales; re-seeded into en/zh/ja/th JSON.
   - **Verification:** `tsc --noEmit` clean · eslint clean · **14/14** jest. Not yet exercised on-device (flag off).
4. **Listing-method demotion** — ✅ **DONE (2026-05-27, flag-gated)**
   - ✅ [scan.tsx](../app/(tabs)/scan.tsx) — Scan-tab launcher: when the flag is on, `useFocusEffect` resets any abandoned session (so a stale grouped mode/queue can't leak) and `router.replace`s to the camera; off → listing-method as before.
   - ✅ [index.tsx](../app/(tabs)/index.tsx) — home Scan button resets + opens camera (flag on) / listing-method (off). New **"Multiple items? Add them one by one →"** link (flag on only) routes to listing-method for the manual grouped fallback. Removed the vestigial `hasDraft()` branch (both arms went to listing-method).
   - ✅ [scanResume.ts](../src/lib/scanResume.ts) — fresh-scan fallbacks route to `freshScanRoute` (camera when flag on, listing-method off); grouped+queued still resumes to grouped-review (= Item Review).
   - ✅ [processing.tsx](../app/scan/processing.tsx) — **smart-detect now gates on `mode === 'single'`, not the build flag alone.** This is required for the flag-on world: the manual grouped path enqueues items and re-enters the camera with `queuedItems > 0` and `mode === 'grouped'`, so those per-item passes correctly use the legacy single-product `analyze`. The camera-bounce guard simplified to `if (isNavigating) return;` — the old `queuedCount > 0` clause would have wedged every manual-grouped "add another" once the flag is on (legitimately `queuedCount > 0`), and `isNavigating` alone already covers the smart grouped transition that clears `current`.
   - ✅ [_seed_keys.py](../src/i18n/_seed_keys.py) — `mobile.home.scanOneByOne` across all 4 locales; re-seeded.
   - ✅ **Post-review hardening (2026-05-27):**
     - [processing.tsx](../app/scan/processing.tsx) — loader branch runs before `!draft` early return (no blank frame on smart multi → Item Review).
     - [index.tsx](../app/(tabs)/index.tsx) — "one by one" pre-sets `mode='grouped'` and opens camera (no listing-method detour).
     - [flags.ts](../src/lib/flags.ts) — comment updated (Phase 5 / on-device gate, not "phase 3").
   - ⚠️ **Flag still off by default** — flip after on-device verification (Phase 5).
   - **Verification:** `tsc --noEmit` clean · eslint clean · 14/14 jest.
5. **Polish & ship** — on-device verification with `EXPO_PUBLIC_SMART_DETECT=1`; flip default in `flags.ts`; update `SCANNER_FLOW.md` + `LOCALIZATION.md`; merge/split stretch goals.

Each phase is shippable, **except** 2 without 3 (single path alone is fine to ship; multiple path requires Item Review).

### Definition of done
- Dev build (native module deps already present — gesture-handler etc.; no new native deps for this flow).
- Single-item pile → Detail with photos + AI-filled fields.
- Multi-item pile → Item Review listing each detected item; edit one → Detail and back.
- "It's actually one product" override → single Detail using `mergedSingle`.
- Submit N items → grouped batch (existing pipeline), partial-failure retry works.
- Resume mid-review (app killed) restores `queuedItems` + `mergedSingle` + `detectionSummary` / `detectionConfidence` → Item Review header works.
- Failure/timeout → error block with Retake + Continue without AI.

### Companion-doc drift
`SCANNER_FLOW.md` still documents the old Review screen + listing-method-first flow (and was written before Review was merged into Detail). When this ships, update SCANNER_FLOW.md's flow diagram and the listing-method section — same drift caveat noted in `INTERACTIVITY_LIBS_PLAN.md`.

---

## 8. Open questions (decide before building)

1. **Does the seller still pick Single/Grouped up front, or is smart-detect the only entry?** Recommendation: smart-detect is the default from the Scan button; keep manual Grouped reachable from a small "scan items one by one" link for power users.
2. **Do we use `products[i].data` per item, or always start from `merged_single` and let the user split?** Recommendation: use per-item `data` (that's the AI's actual proposal); `merged_single` only powers the "it's one product" override.
3. **Item Review for single mode — show it (one card) or skip to Detail?** Recommendation: skip to Detail in single mode (fewer taps, matches the "faster" goal); Item Review only when `multiple`.
4. **Backend asks:** should we (a) parallelize per-product extraction and (b) make extraction per-item resilient so one failure doesn't 500 the batch? Both materially affect this flow's reliability/latency. Flagging for the backend owner — not mobile work, but our UX depends on it.
