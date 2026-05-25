# Scanner Flow — Plan (Home → Camera → Processing → Review → Detail → Success)

**Scope:** Implement the 6-screen scanner / quick-listing flow in the GreenBridge mobile app, using the **existing web backend endpoints** (no new backend work) and the **Stitch UI** (recoloured to GreenBidz emerald per [STARTER_KIT.md §5](./STARTER_KIT.md)).
**Web reference:** [101lab-2/src/pages/dashboard/UploadMethod.tsx](../../101lab-2/src/pages/dashboard/UploadMethod.tsx) — the seller's "new listing" flow that already wires the same APIs.
**Stitch project:** [`10427403178230899557` — "Smart Scan AI Product Lister"](https://stitch.withgoogle.com/projects/10427403178230899557).
**Date:** 2026-05-25  
**Implementation status:** Phases A–C integrated + hardened (2026-05-25, §0.6–§0.8) — run device QA checklists below.

**All scanner endpoints require an authenticated seller** — the existing axios interceptor ([src/api/interceptors.ts](../src/api/interceptors.ts)) already attaches `Authorization: Bearer …` + `x-refresh-token` to every request, so no extra wiring needed.

---

## 0. Pre-coding fixes (do these first)

These came out of the SCANNER_FLOW.md review. Locking them now means Phase A doesn't hit silly bugs.

### 0.1 `x-platform` casing — **fixed**

Web sends mixed-case (`"LabGreenbidz"`) everywhere — confirmed in [101lab-2/src/config/site.ts:9](../../101lab-2/src/config/site.ts#L9) and 11+ direct usages in `dashboard/*.tsx`. Mobile previously sent `"labgreenbidz"` (lowercase), which the backend likely rejects or routes wrong.

Updated:

- [app.config.ts:55](../app.config.ts#L55) default → `'LabGreenbidz'`
- [src/api/greenbidzClient.ts:9](../src/api/greenbidzClient.ts#L9) default → `'LabGreenbidz'` + inline comment
- [.env.example](../.env.example) → `SITE_TYPE=LabGreenbidz`
- Local [.env](../.env) → same

**Rule:** mobile `SITE_TYPE` env value must always match a string the backend recognises. Don't lowercase it.

### 0.2 Auth dependency for `useRecentSubmissions`

`GET /batch/seller/:sellerId` needs `sellerId`. Source = `useAuth(s => s.profile?.id)` from [src/stores/authStore.ts](../src/stores/authStore.ts). Profile is hydrated from MMKV on launch, so the Home screen can safely read it synchronously after `hydrated === true`. No Phase A work needed beyond reading the store.

### 0.3 Multipart on RN (axios + FormData)

RN's `FormData` accepts file refs in this shape (different from web `File` objects):

```ts
formData.append('images', {
  uri: photo.uri,                          // 'file:///…' from expo-camera/picker
  name: 'photo.jpg',                       // filename the backend will see
  type: 'image/jpeg',                      // MIME — must match the file
} as unknown as Blob);
```

Don't set `Content-Type` manually — axios will set the `multipart/form-data; boundary=…` header automatically when it sees a `FormData` instance. **Setting it manually with no boundary breaks the upload.**

Helper to live in `src/services/scanner/buildProductFormData.ts`:

```ts
export function buildProductFormData(item: DraftItem, photos: Photo[]) {
  const fd = new FormData();
  photos.forEach((p, i) => fd.append('images', { uri: p.uri, name: `photo-${i}.jpg`, type: 'image/jpeg' } as any));
  item.documents.forEach((d) => fd.append('documents', { uri: d.uri, name: d.name, type: d.mimeType } as any));
  fd.append('title', item.title);
  fd.append('description', item.description);
  item.condition.forEach((c) => fd.append('condition[]', c));
  // …rest per §2.2 field table
  return fd;
}
```

Same shape applies to `/wp/analyze-process-images` (just `images` + `language`).

### 0.4 Web/browser target

Expo Router supports web, but **scanner calls (image upload) hit the same CORS issues as login** — the web app uses a Vite dev proxy. Mobile primary target is iOS/Android via Expo Go or a dev build. Treat web as best-effort; the camera permission flow is also worse there. Don't QA scanner on web.

### 0.5 Stitch → RN UI budget

Stitch gives layouts + design tokens, not RN components. For each Phase A screen, budget ~½ day to convert the Stitch HTML/CSS into NativeWind + RN primitives (camera/processing are simpler; detail with 8+ fields is the big one). Stitch's blue palette is replaced 1:1 with GreenBidz emerald — no other token changes.

### 0.6 Phase A hardening (2026-05-25 review) — **fixed**

| Issue | Fix | Files |
|--------|-----|--------|
| Processing stuck in dev (Strict Mode + `started` ref) | Skip API when `draft.ai` exists; removed blocking ref | `app/scan/processing.tsx` |
| Skip AI → submit validation fails | `manualEntryDefaults()` on “Continue without AI” | `constants.ts`, `processing.tsx` |
| Category chips capped at 12 | Full scrollable list (`opt.label`) | `app/scan/detail.tsx` |
| Success “View listing” | §0.7: **View batch summary** → `listing/[id]` with **batch PK**; display uses **batch_number** | `success.tsx`, `createBatch.ts` |
| Resume skips Review / wrong step | `lastStep` + `getScanResumeRoute()` | `scanDraftStore.ts`, `scanResume.ts`, `scan.tsx`, `review.tsx` |
| Photos lost after app kill | Copy to `documentDirectory/scan-drafts/` on start | `persistPhotos.ts`, `scanDraftStore.ts`, `camera.tsx` |
| Resume with missing files | `verifyDraftPhotos()` + alert | `scan.tsx` |
| Submit retry drops `productId` | Submit uses `getState().current` after `patch` | `detail.tsx` |
| Duplicate `productIds` on retry | Dedupe in `addProductId` | `scanDraftStore.ts` |
| Category fetch 20s timeout | 60s on `GET /product/lab/category` | `fetchCategories.ts` |

### 0.7 Phase B hardening (2026-05-25 review) — **fixed**

| Issue | Fix | Files |
|--------|-----|--------|
| Resume lost photo/document verify | `verifyScanSessionFiles()` on Resume (current + queued + pending) | `persistPhotos.ts`, `scan.tsx` |
| Reorder screen loses photos on kill | `pendingPhotos` copied to MMKV + `documentDirectory/scan-drafts/pending-*` | `scanDraftStore.ts`, `camera.tsx` |
| Documents not durable | `persistDocumentsForDraft()` on pick | `persistPhotos.ts`, `detail.tsx` |
| Recent list stale after submit | `invalidateRecentSubmissions()` on mutation success + success screen | `invalidateRecentSubmissions.ts`, `useCreateListing`, `useSubmitGroupedListing`, `success.tsx` |
| Listing tap → stub | `GET /batch/:batchPk/products` + summary UI + optional `WEB_APP_URL` deep link | `fetchBatchDetail.ts`, `listing/[id].tsx`, `env.ts` |
| Seller list ID mismatch | API returns `batch_pk`; UI shows `batch_id` (batch number), navigates with PK | `batchService.js`, `fetchRecentSubmissions.ts`, `RecentSubmissionsList.tsx` |
| FlashList layout | `@shopify/flash-list@2.x` auto-sizes rows — no `estimatedItemSize` | `RecentSubmissionsList.tsx` |

### 0.8 Phase C hardening (2026-05-25 review) — **fixed**

| Issue | Fix | Files |
|--------|-----|--------|
| Scan home skipped listing method | New scan + Start fresh → `/scan/listing-method` (single vs grouped) | `app/(tabs)/index.tsx` |
| Grouped partial submit / no retry | `setQueuedItemProductId` after each `createProduct`; retry skips items with `productId`; alert explains partial progress | `scanDraftStore.ts`, `useSubmitGroupedListing.ts`, `grouped-review.tsx` |
| `editingGroupedItem` lost on resume | Persisted on `PersistedScan`; explicit flag on edit / enqueue / review | `scanDraftStore.ts` |
| `reset()` left pending reorder photos | Clears `scan.pendingPhotos` MMKV key | `scanDraftStore.ts` |

---

## 1. The 6 screens (Stitch ↔ flow stage)

| # | Screen (Stitch title) | Stitch screen ID | What happens | Web equivalent step |
|---|---|---|---|---|
| 1 | **Home - Asset Capture** | `3dae20d857594bff8b98dc3a16a17d8c` | Empty/CTA state. Big "Scan equipment" button + recent submissions list. | Web has no direct equivalent — this is mobile-specific entry. |
| 2 | **Camera - Asset Capture** | `0de785e9f270457193bb5ec116f9af75` | Native camera viewfinder. Capture 1+ photos of the equipment nameplate / unit. | Web uses gallery file picker only; mobile adds live camera. |
| 3 | **Processing - Asset Capture** | `f744f8e75c98428381a55ae46257fc42` | Spinner / progress while AI extracts metadata from the photos. | `handleAIGenerate()` in [UploadMethod.tsx:923](../../101lab-2/src/pages/dashboard/UploadMethod.tsx#L923) — calls `wp/analyze-process-images`. |
| 4 | **Single Product Review - Asset Capture** | `9e624320695748a6b0c8ba916b07211a` | Shows AI-extracted fields (title, description, condition, price suggestion) + photos. User can accept/regenerate. | The `aiPreview` modal in [UploadMethod.tsx:2395](../../101lab-2/src/pages/dashboard/UploadMethod.tsx#L2395) — "Apply" pushes fields into the item form. |
| 5 | **Individual Product Detail - Asset Capture** | `530408667bca4904a8358289c080aa09` | Editable form for the single item (title, description, category, condition, price, location, quantity, currency, allow-sites). "Save and continue". | The per-item form in `UploadMethod` `<InventoryItem>` editor. |
| 6 | **Success - Asset Capture** | `03ff7eabfdec42c689c7a8b462aee202` | Confirmation screen: batch ID, "your listing is awaiting approval", links to view/edit. | The thank-you state in [UploadMethod.tsx](../../101lab-2/src/pages/dashboard/UploadMethod.tsx) when `showThankYouOnly={true}`. |

> **Theming reminder:** Stitch ships with Industrial Blue (`#0052cc`). We recolour to GreenBidz emerald (`#0a4a2f` / `#1d6647`) per [STARTER_KIT.md §5](./STARTER_KIT.md#5-theme--port-from-web) — layout, components, typography stay identical to the Stitch designs.

---

## 2. Backend endpoints (already exist — reuse as-is)

All three are battle-tested by the web. No backend changes needed.

### 2.1 AI extraction — `POST /wp/analyze-process-images`

[UploadMethod.tsx:957-970](../../101lab-2/src/pages/dashboard/UploadMethod.tsx#L957-L970)

```http
POST /api/v1/wp/analyze-process-images
Content-Type: multipart/form-data    # set automatically by axios — see §0.3
Authorization: Bearer <jwt>           # added by interceptor
x-platform: LabGreenbidz              # exact casing matters — see §0.1
x-system-key: <env>                   # already on the axios instance

Form fields:
  images: <RN FormData file ref>[]   # see §0.3 for { uri, name, type } shape
  language: "en" | "zh-hant"
```

**Response shape** (the bits we use):

```json
{
  "success": true,
  "data": {
    "name": "Agilent 1260 Infinity HPLC",
    "equipment_description": "High-performance liquid chromatograph...",
    "condition": "used" | ["usedFunctional"],
    "operation_status": ["working"],
    "price": { "reselling_price": "12500" },
    "currency": "USD" | "TWD"
  }
}
```

Used by **Processing** screen. Result powers the **Review** screen.

### 2.2 Create product — `POST /wp/create-product-direct?lang=<lang>&type=<site_type>`

[UploadMethod.tsx:815-826](../../101lab-2/src/pages/dashboard/UploadMethod.tsx#L815-L826)

Multipart upload — image files + all product fields. Returns `{ success, data: { product_id } }`. Called once **per item** at submit time. Use `buildProductFormData()` from §0.3. The `type=` query param uses the same `SITE_TYPE` string as `x-platform` (`LabGreenbidz`).

Key form fields the web sends (mobile must match):

| Field | Notes |
|---|---|
| `images[]` | One or more `File` |
| `documents[]` | Optional supporting docs |
| `title`, `description` | Strings |
| `condition[]` | Array of strings — use the normalised keys from [VALID_CONDITION_KEYS](../../101lab-2/src/pages/dashboard/UploadMethod.tsx#L121-L127): `new`, `usedFunctional`, `forParts`, `wasteDisposal`, `demolitionRemoval` |
| `operation_status[]` | Array |
| `product_category_ids[]` | Subcategory IDs |
| `price_now_enabled` | `"1"` / `"0"` |
| `price_format` | `"buyNow"` or `"offer"` |
| `price_per_unit` | String, empty if offer |
| `price_currency` | `"USD"` or `"TWD"` |
| `quantity` | Number |
| `allowed_sites[]` | Array of site type slugs |
| `locations` | Address + country |

### 2.3 Create batch — `POST /batch/create?type=<site_type>`

[productSlice.ts:248-257](../../101lab-2/src/rtk/slices/productSlice.ts#L248-L257)

JSON body: `{ productIds, sellerId, visibility, networkSellers, type, country }`. Called **once** at the end, wraps the created products into a single batch. Returns `{ data: { batch_id, is_first_listing, sellers_listing_number } }`.

`type` query value = `SITE_TYPE` (`LabGreenbidz`). `body.type` in the JSON body matches the same value (web sets it from the same constant). Keep them aligned.

For mobile Phase 1: hard-code `visibility: "PUBLIC"`, `networkSellers: []` — defer the private/network UI to a later phase.

### 2.4 Recent submissions — `GET /batch/seller/<sellerId>?page=1&type=<site_type>&limit=10`

[productSlice.ts:313](../../101lab-2/src/rtk/slices/productSlice.ts#L313)

Feeds the **Home** screen's "recent submissions" list. `sellerId` comes from `useAuth(s => s.profile?.id)` — must wait for `hydrated` (see §0.2).

### 2.5 Categories — `GET /product/lab/category?language=<lang>`

[apiSlice.ts:309](../../101lab-2/src/rtk/slices/apiSlice.ts#L309) — the language-aware one that powers `useLanguageAwareCategories` on web. Returns categories + subcategories with the right localised labels. Use this on the **Detail** screen's category picker; the fallback `/product/category` is the language-agnostic variant.

---

## 3. Mobile architecture

### 3.1 File layout

> Scanner home lives at `app/(tabs)/index.tsx` (`routes.scanHome` → `/(tabs)`). The scan stack is under `app/scan/*`.


```
GreenBridgeApp/
├── app/
│   ├── (tabs)/
│   │   └── scan.tsx                       # = Stitch "Home - Asset Capture"
│   └── scan/
│       ├── camera.tsx                     # = Stitch "Camera - Asset Capture"
│       ├── processing.tsx                 # = Stitch "Processing - Asset Capture"
│       ├── review.tsx                     # = Stitch "Single Product Review"
│       ├── detail.tsx                     # = Stitch "Individual Product Detail"
│       └── success.tsx                    # = Stitch "Success"
├── src/
│   ├── api/
│   │   └── greenbidzClient.ts             # already done
│   ├── services/
│   │   ├── scanner/
│   │   │   ├── analyzeImages.ts           # POST /wp/analyze-process-images
│   │   │   ├── createProduct.ts           # POST /wp/create-product-direct
│   │   │   ├── createBatch.ts             # POST /batch/create
│   │   │   ├── buildFormData.ts           # RN multipart (§0.3)
│   │   │   └── fetchCategories.ts         # GET /product/lab/category
│   │   └── upload/
│   │       ├── compress.ts                # expo-image-manipulator wrapper
│   │       ├── persistPhotos.ts           # documentDirectory copies for MMKV drafts
│   │       └── queue.ts                   # future — see STARTER_KIT §7a
│   ├── features/
│   │   └── scanner/
│   │       ├── schema.ts                  # zod schemas (capture, detail form)
│   │       ├── useAnalyzeImages.ts        # React Query mutation
│   │       ├── useCreateListing.ts        # orchestrates createProduct + createBatch
│   │       ├── useRecentSubmissions.ts    # React Query for Home list
│   │       └── constants.ts               # VALID_CONDITION_KEYS, currencies, etc.
│   ├── stores/
│   │   └── scanDraftStore.ts              # Zustand: in-progress scan (photos + AI result + edits)
│   └── components/
│       └── scanner/
│           ├── CameraView.tsx
│           ├── PhotoThumbStrip.tsx
│           ├── AiFieldsPreview.tsx
│           ├── ConditionPicker.tsx
│           ├── PriceFormatToggle.tsx
│           └── LocationField.tsx
```

### 3.2 State machine — the scan draft

A single Zustand store carries the work-in-progress between screens. No need to pass props through router params for anything heavy.

```ts
// src/stores/scanDraftStore.ts
type Photo = { uri: string; width: number; height: number; sizeBytes: number };

type AiResult = {
  name: string;
  description: string;
  condition: string[];           // normalised keys
  operationStatus: string[];
  suggestedPrice: string | null;
  currency: 'USD' | 'TWD';
};

type DraftItem = {
  id: string;
  photos: Photo[];
  ai: AiResult | null;
  aiSkipped?: boolean;
  lastStep?: 'processing' | 'review' | 'detail';
  productId?: number;
  productIds: number[];
  title: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  condition: string[];
  operationStatus: string[];
  pricePerUnit: string;
  priceCurrency: 'USD' | 'TWD';
  priceFormat: 'buyNow' | 'offer';
  quantity: number;
  location: { address: string; country: string } | null;
  documents: { uri: string; name: string; mimeType: string }[];
  allowedSites: string[];
  sellerVisible: boolean;
};

type ScanDraftState = {
  current: DraftItem | null;
  start: (photos: Photo[]) => Promise<void>;  // persists photos to documentDirectory
  setAi: (ai: AiResult) => void;
  setLastStep: (step: 'processing' | 'review' | 'detail') => void;
  patch: (partial: Partial<DraftItem>) => void;
  reset: () => void;
};
```

Persist to MMKV under `scan.currentDraft` so an app kill mid-flow doesn't lose work (matches [STARTER_KIT.md §7a](./STARTER_KIT.md#7a-upload--resilience-pipeline-the-real-complexity) resilience).

### 3.3 The orchestrating hook — `useCreateListing`

When user taps "Submit" on the Detail screen:

```
1. compress photos (already done at capture; re-check)
2. POST /wp/create-product-direct  → product_id    (1 call per item; mobile MVP = 1 item)
3. POST /batch/create              → batch_id      (1 call)
4. clear scanDraftStore
5. navigate to Success(batch_id)
```

Use React Query `useMutation` with `onError` that **does not** clear the draft — user can retry.

---

## 4. Screen-by-screen plan

For each: source of truth (Stitch), key components, data binding, navigation.

### 4.1 Home — `app/(tabs)/index.tsx`

- **Source:** Stitch `Home - Asset Capture`.
- **Top:** GreenBidz logo + greeting using `auth.profile.name`.
- **CTA:** big primary button → `router.push('/scan/camera')`.
- **Recent submissions list:** `useRecentSubmissions(sellerId)` via React Query, render with `<FlashList>`. Tap → `router.push('/listing/[id]')` (placeholder for now).
- **Empty state:** illustration + "Tap scan to list your first item".

### 4.2 Camera — `app/scan/camera.tsx`

- **Source:** Stitch `Camera - Asset Capture`.
- **Lib:** `expo-camera` `<CameraView>` (full-screen viewfinder).
- **Controls:** shutter button (64×64), flash toggle, flip camera, close (×) back.
- **Captured strip:** thumbnails of already-shot photos along the bottom; tap × to remove.
- **On capture:** compress (`expo-image-manipulator`, longest edge 1600, q 0.75), append to local state.
- **"Next" enabled** when ≥1 photo. On tap: `scanDraftStore.start(photos)` → `router.push('/scan/processing')`.
- **Permissions:** ask on screen mount; if denied show a friendly fallback with "Open settings" (`Linking.openSettings()`).

### 4.3 Processing — `app/scan/processing.tsx`

- **Source:** Stitch `Processing - Asset Capture`.
- **On mount:** call `useAnalyzeImages.mutate({ photos: draft.photos, language: i18n.language })`.
- **UI:** spinner + "Analyzing equipment..." + show the photos thumbnails dimmed.
- **On success:** `scanDraftStore.setAi(result)` + `scanDraftStore.patch({ title: result.name, description: result.description, ... })` → `router.replace('/scan/review')`.
- **On error:** "AI couldn't read the photos" + two buttons: **Retake** (→ camera) and **Continue without AI** (→ detail with empty fields).
- **Timeout:** 120s (matches web). Show "still working..." after 30s.

### 4.4 Review — `app/scan/review.tsx`

- **Source:** Stitch `Single Product Review - Asset Capture`.
- **Shows:** photo carousel at top + AI-extracted summary card (title, description excerpt, condition chip, suggested price).
- **Buttons:** **Regenerate** (re-fires `useAnalyzeImages` with the *same* `draft.photos` — no re-upload from the camera, just re-runs AI on the bytes we already have) and **Looks good — edit details** → `router.push('/scan/detail')`.
- **No** form editing here — this screen is for *acceptance*. Editing happens on Detail.

### 4.5 Detail — `app/scan/detail.tsx`

- **Source:** Stitch `Individual Product Detail - Asset Capture`.
- **Form:** react-hook-form + zod (`detailSchema`).
- **Fields** (initialised from `scanDraftStore.current`):
  - Title (text)
  - Description (multi-line — for now `<TextInput multiline>`; rich-text editor deferred — web uses SunEditor)
  - Category → `<Select>` populated from `useCategoriesQuery` (same as web's `useLanguageAwareCategories`)
  - Condition → multi-select chips, choices from `VALID_CONDITION_KEYS`
  - Operation status → multi-select chips
  - Price format toggle: "Buy now" vs "Make offer"
  - If buy-now: price input + currency picker
  - Quantity → stepper input (per Stitch design system spec — "Stepper inputs for quantity")
  - Location → address text + country picker (port `CountrySelect` from web)
  - Documents → optional file picker (`expo-document-picker`)
- **Submit:** `useCreateListing.mutate(draft)` → on success `router.replace({ pathname: '/scan/success', params: { batchId } })`.
- **On error:** sonner-native toast + keep form populated.
- **Skip-able fields for MVP:** documents, allowed_sites (default to `[SITE_TYPE]`), network sellers. Hard-code visibility=PUBLIC.

### 4.6 Success — `app/scan/success.tsx`

- **Source:** Stitch `Success - Asset Capture`.
- **Shows:** big checkmark + "Listing submitted!" + batch ID + "Awaiting approval" subtext.
- **CTAs:** **Scan another** → `routes.scanHome` (clears draft) and **View batch summary** → `routes.listingDetail(batchPk)`.
- **On mount:** call `scanDraftStore.reset()` and invalidate `recentSubmissions` query so Home re-fetches.

---

## 5. Field mapping — AI result → Detail form

The AI returns slightly inconsistent shapes (sometimes `condition: "used"` string, sometimes `["U","s","e","d"]` char-split). Re-use the web's normaliser verbatim:

```ts
// src/features/scanner/normalize.ts — port of UploadMethod.tsx:130-155
export function normalizeCondition(value: string | string[] | null | undefined): string[] { ... }
```

Same for parsing PHP-serialised arrays if any field comes back that way. Copy [parsePhpArray](../../101lab-2/src/pages/dashboard/UploadMethod.tsx#L108-L118) if needed.

---

## 6. Phasing (what ships, in what order)

### Phase A — "happy path single item" (target: scanner MVP demo)

- [x] Home screen — `app/(tabs)/index.tsx` (redesign dashboard + recent list + resume-draft prompt)
- [x] Camera screen (multi-photo strip; compress on capture) — `app/scan/camera.tsx`
- [x] Processing screen — `app/scan/processing.tsx` (AI + skip-without-AI fallback)
- [x] Review screen (read-only + regenerate) — `app/scan/review.tsx`
- [x] Detail screen (title, description, category chips, condition, price, location, quantity) — `app/scan/detail.tsx`
- [x] Submit → product + batch → Success — `useCreateListing` + `app/scan/success.tsx`
- [x] Zustand draft store with MMKV persistence — `src/stores/scanDraftStore.ts`
- [x] No documents, no allowed_sites picker, no visibility settings (defaults: `PUBLIC`, `[SITE_TYPE]`)
- [x] Phase A hardening fixes — see **§0.6**

**Phase A code map**

| Layer | Files |
|-------|--------|
| Routes | `app/scan/_layout.tsx`, `camera`, `processing`, `review`, `detail`, `success` |
| Services | `analyzeImages`, `createProduct`, `createBatch`, `buildFormData`, `fetchCategories`, `compress`, `persistPhotos` |
| Features | `normalize`, `constants`, `schema`, `useAnalyzeImages`, `useCreateListing`, `useLabCategories` |
| Store | `scanDraftStore` (MMKV key `scan.currentDraft`, `productIds` for batch retry, `lastStep`, `aiSkipped`) |
| Nav helpers | `src/lib/routes.ts`, `src/lib/scanResume.ts` |

**Phase B code map**

| Layer | Files |
|-------|--------|
| Routes | `app/scan/reorder-photos`, `app/activity/history` |
| Services | `fetchRecentSubmissions.ts` |
| Components | `RecentSubmissionsList`, `VisibilitySelector` |
| Features | `useRecentSubmissions` |
| Store | `scanDraftStore` — `visibility`, `networkSellers`, `pendingPhotos`, `updatePhotos` |

**Phase C code map**

| Layer | Files |
|-------|--------|
| Routes | `app/scan/listing-method`, `app/scan/grouped-review` |
| Features | `useSubmitGroupedListing` |
| Store | `scanDraftStore` — `mode`, `queuedItems`, `sessionVisibility`, `editingGroupedItem`, `setQueuedItemProductId`, grouped queue actions |

**QA checklist (device / Expo Go)**

- [ ] Sign in as seller → Scan tab → capture ≥1 photo → AI → review → detail → submit
- [ ] Kill app mid-flow → reopen → “Resume scan?” works (photos still upload)
- [ ] AI failure → “Continue without AI” → detail → submit (defaults prefilled)
- [ ] Product created but batch fails → retry submit (reuses `productId`)
- [ ] Processing in Expo dev does not hang after Strict Mode remount
- [ ] Resume returns to Review when `lastStep` was review; Detail when user was on detail or skipped AI
- [ ] Category list scrolls beyond 12 options
- [ ] Success shows batch **number**; “View batch summary” loads detail via **batch PK** (not 404)

### Phase B — match web parity

- [x] Multi-photo capture + reorder (`/scan/reorder-photos`; camera → reorder when >1 photo; review → edit order)
- [x] Documents upload (`expo-document-picker` on detail → `buildProductFormData`)
- [x] Recent submissions on Home (`GET /batch/seller/:sellerId`, FlashList)
- [x] Activity history (`/activity/history`)
- [x] Edit existing draft (`getScanResumeRoute`, rearrange photos mid-flow)
- [x] Visibility selector (PUBLIC / PRIVATE on detail; NETWORK → web-only alert; seller search deferred)
- [x] Phase B hardening fixes — see **§0.7**

**Phase B QA checklist (device / Expo Go)**

- [ ] Capture 2+ photos → reorder → AI → submit (first photo = cover)
- [ ] Kill app on reorder screen → reopen → Resume or reorder still has photos
- [ ] Add document on Detail → kill app → Resume → submit still uploads doc
- [ ] Submit → Scan home shows new batch (pull refresh or immediate after fix)
- [ ] Tap recent batch → summary loads; “Open on website” works if `WEB_APP_URL` set
- [ ] Success → “View batch summary” opens listing screen (uses batch PK)
- [ ] PRIVATE visibility submit on staging

**Phase B code map (additions)**

| Layer | Files |
|-------|--------|
| Services | `fetchRecentSubmissions.ts`, `fetchBatchDetail.ts` |
| Features | `useRecentSubmissions`, `useBatchDetail`, `invalidateRecentSubmissions`, `queryKeys.ts` |
| Components | `RecentSubmissionsList`, `VisibilitySelector` |
| Routes | `app/listing/[id].tsx`, `app/activity/history.tsx`, `app/scan/reorder-photos.tsx` |
| Backend (seller list) | `batchService.js` — `batch_pk` on seller batch summaries |

### Phase C — multi-item (grouped submission)

- [x] "Grouped Submission Review" screen (`/scan/grouped-review`)
- [x] "Listing Method" screen (`/scan/listing-method` — single vs grouped)
- [x] Multi-product batch submit (`useSubmitGroupedListing` → N× `create-product-direct`, 1× `batch/create`)
- [x] Phase C hardening fixes — see **§0.8**

**Phase C QA checklist (device / Expo Go)**

- [ ] Scan tab → **Listing method** → choose Grouped → camera
- [ ] Item A: scan → AI → detail → **Save & scan another** → Item B → **Review group** → submit 2 items
- [ ] Edit item from grouped review → **Save & return** → submit
- [ ] Kill app while editing grouped item → Resume → Detail shows **Save & return** (not “scan another” only)
- [ ] Simulate batch/create failure after products created → retry Submit → no duplicate products
- [ ] Simulate failure on 2nd product create → retry → 1st product not recreated
- [ ] Start fresh clears pending reorder photos (no ghost photos on next scan)

Phase A is the demo Jerry needs by mid next week (per meeting doc §16). Phase B and C come after the recycler pilot feedback.

---

## 7. Edge cases & resilience

| Scenario | Handling |
|---|---|
| App killed mid-scan | MMKV session + photos/docs in `documentDirectory/scan-drafts/`; pending reorder photos in MMKV `scan.pendingPhotos`; Resume runs `verifyScanSessionFiles()` |
| Recent list after submit | React Query invalidate on `useCreateListing` / grouped submit / success mount |
| Tap recent batch | Navigate with `batch_pk`; `listing/[id]` loads `GET /batch/:pk/products` |
| `/analyze-process-images` 500 | "Continue without AI" → Detail with `manualEntryDefaults()` (submittable without re-picking condition) |
| React Strict Mode on Processing | If `draft.ai` already set, navigate to Review instead of re-calling AI |
| Photo too large after compression | Re-compress with quality 0.5 once; if still over 5 MB, drop with toast |
| Network drops between product create and batch create | Single: retain `productId` on current draft. Grouped: `setQueuedItemProductId` per item; retry submit skips created products, then `batch/create` only |
| Grouped submit fails mid-loop | MMKV queue keeps `productId` per item; grouped review alert + retry |
| User taps back during Processing | Cancel the axios request via `AbortController` (per [STARTER_KIT §7a.4](./STARTER_KIT.md#7a-upload--resilience-pipeline-the-real-complexity)) |
| Permissions denied | "Open settings" CTA via `Linking.openSettings()` |

---

## 8. Open decisions before coding

1. **Single-item vs multi-item for Phase A?** Recommend **single-item** to ship faster. Backend supports many; UI complexity grows fast.
2. **Description editor.** Web uses SunEditor (rich text). For mobile MVP, use **plain multi-line `<TextInput>`** — paragraph splits saved as `\n`. Backend stores the raw HTML/text either way.
3. **Currency / locale defaulting.** Implemented in `defaultCurrencyForSite()` — `USD` for `LabGreenbidz`, `TWD` for `101it` (uses `SITE_TYPE` env).
4. **Category list source.** Implemented via `useLabCategories` → `GET /product/lab/category?language=`.
5. **AI language.** Web sends `"zh-hant"` for Chinese, else `"en"`. Mobile uses `i18n.language` similarly.

---

## 9. References

- Web seller listing flow: [101lab-2/src/pages/dashboard/UploadMethod.tsx](../../101lab-2/src/pages/dashboard/UploadMethod.tsx)
- Web AI extraction (the only thing we wire that's "AI"): [UploadMethod.tsx:923-1012](../../101lab-2/src/pages/dashboard/UploadMethod.tsx#L923-L1012)
- Web RTK slices: [101lab-2/src/rtk/slices/productSlice.ts](../../101lab-2/src/rtk/slices/productSlice.ts)
- Stitch project: `projects/10427403178230899557` ("Smart Scan AI Product Lister")
- Companion docs: [STARTER_KIT.md](./STARTER_KIT.md), [AUTH.md](./AUTH.md)
- Meeting context: [../../meeting_discuss/sop_mobile_app_scan_disscuss.md](../../meeting_discuss/sop_mobile_app_scan_disscuss.md), [../../meeting_discuss/SOP_AI_INTEGRATION_PLAN.md](../../meeting_discuss/SOP_AI_INTEGRATION_PLAN.md)
