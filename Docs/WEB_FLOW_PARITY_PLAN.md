# Web Upload Flow → Mobile Parity Plan

> Goal: make the mobile scan flow mirror the seller web's `new-submission-upload` page step-for-step, so a seller on either platform sees the same product flow with the same affordances. Mobile keeps the camera as the *primary capture surface*, but everything downstream of capture matches the web exactly.

**Source of truth (web):** `GreenBridgeSeller/src/pages/new-submission-upload/`
**Target (mobile):** `GreenBridgeApp/app/scan/*` + `GreenBridgeApp/src/features/scanner/*`

> **Companion doc:** `Docs/SMART_DETECTION_FLOW.md`. Detection added by this plan is **upstream** (decides single vs multi *before* review). The "it's actually one product" / mergedSingle behavior in `scan/grouped-review.tsx` is **downstream** (a post-review escape hatch). Both stay. Don't remove the grouped-review banner thinking the new detection screen replaces it — they answer different questions.

---

## 0. Conflicts with the current app (resolved before coding)

These were flagged in review and must hold across every section below.

1. **Manual grouped keeps the per-item analyze path.** Today: home's "List one by one" sets `mode='grouped'` and walks each captured item through `useAnalyzeImages` (smart-detect is a pile-detect; it doesn't apply per-item). Do **not** delete `useAnalyzeImages`. The dead branch we delete is *only* the `mode === 'single'` analyze fallback inside `processing.tsx`. Manual grouped continues to use analyze on each pass.
2. **One state machine, no double-apply.** `applySmartDetection` runs **exactly once** per scan session:
   - If `shouldSkipDetectionChoice` is true → `processing.tsx` applies and routes (detail or grouped-review).
   - Else → `processing.tsx` stores the mapped result in `pendingDetection`, routes to `scan/detection.tsx`. The detection screen's Continue calls `applySmartDetection`. Processing never applies in this branch.
3. **Entry points (flag-aware).** When `SMART_DETECT_ENABLED`: `(tabs)/index.tsx#startScan` and `(tabs)/scan.tsx` use `getScanResumeRoute` then camera → capture → `scan/staged`. **`scan/listing-method.tsx` is unreachable** with the flag on (legacy only). When the flag is off, listing-method single → camera → `store.start` → processing (no staged). Manual grouped (`startManualGrouped`) always bypasses staged: camera → processing per item.
4. **Reuse `getScanResumeRoute`, don't reinvent.** Extend `src/lib/scanResume.ts` with `pendingPhotos` → `scan/staged` and in-memory `pendingDetection` → `scan/detection` (warm resume). Do not fork resume logic in `(tabs)/scan.tsx`.
5. **Staged owns `pendingPhotos`; `start()` owns `current`.** `store.start()` clears `pendingPhotos`. Detection **Back** must **demote** `current.photos` back into `pendingPhotos` (see §2.2 / `demoteCurrentToPending` in §3) or staged will be empty.
6. **One feature flag.** `SMART_DETECT_ENABLED` already gates the entire smart-detect funnel. Staged + detection are part of that funnel — they ride the same flag. No new `SCAN_STAGED_FLOW`. When the flag is off, the legacy listing-method → camera → processing → detail path runs untouched.

---

## 1. Flow comparison & target state

### Web flow (today)

```
empty (DropZone + RecentUploads)
   │ user picks files
   ▼
staged (StagedUploadPanel: previews, add more, clear, START AI)
   │ tap "Start AI"
   ▼
processing (AiProcessingScreen — laser/checklist visuals)
   │ smart-detect result
   ├── shouldSkipDetectionChoice → review (single)
   └── else
         ▼
       detection (DetectionChoiceScreen — pick 1 vs N)
         ├── single → review
         └── multi  → reviewMulti
   ▼
review | reviewMulti
   │ submit
   ▼
toast success → reset → empty + refresh RecentUploads
```

### Mobile flow (today)

```
(tabs)/scan  ── resets store, replace → scan/camera
scan/camera  ── capture loop → onNext → store.start(photos) → scan/processing
scan/processing ── smart-detect | analyze → scan/detail | scan/grouped-review
scan/detail  ── single review/submit
scan/grouped-review ── multi review/submit
scan/success ── submit confirmation
```

### Target mobile flow (after this plan)

**Smart-detect single (the new funnel, parity with web):**
```
(tabs)/index startScan  ─┐
(tabs)/scan tap          ├─→ getScanResumeRoute(...) ─→ one of:
                         │     • scan/detection       (pendingDetection, warm resume)
                         │     • scan/staged          (pendingPhotos)
                         │     • scan/detail          (current.lastStep in {detail,review})
                         │     • scan/processing      (current.lastStep === 'processing')
                         │     • scan/grouped-review  (queuedItems.length > 0, no current)
                         │     • scan/camera          (fresh)
                         └─→
scan/camera   ── capture → onNext → setPendingPhotos(...) → scan/staged
scan/staged   ── NEW: previews, add more, retake, clear, START AI, RecentUploads
scan/processing ── smart-detect → shouldSkipDetectionChoice? apply+route : pendingDetection + scan/detection
scan/detection ── NEW: 1-vs-N picker; Continue → applySmartDetection → scan/detail | scan/grouped-review
scan/detail | scan/grouped-review  (unchanged surfaces)
scan/success  (unchanged)
```

**Manual grouped (legacy per-item; intentionally bypasses staged):**
```
(tabs)/index startManualGrouped  ── reset + setListingMode('grouped') → scan/camera
scan/camera   ── capture per item → onNext → store.start(photos) → scan/processing
scan/processing ── analyze (per item) → scan/detail
scan/detail   ── save item → enqueueCurrentItem → scan/camera (for next item)
                 OR prepareGroupedReview → scan/grouped-review
```

### Gap summary

| Web step | Mobile today | Action |
|---|---|---|
| `empty` (drop zone) | Camera capture | Keep camera; recent list moves under staged |
| `staged` | **Missing** — direct camera → processing | **Add** `scan/staged.tsx` |
| `processing` | Exists (`scan/processing.tsx`) | Trim dead analyze branch, drive checkmarks from real state |
| `detection` (1-vs-N picker) | **Missing** — auto-routes by `mode` | **Add** `scan/detection.tsx` |
| `review` | `scan/detail.tsx` | Hook into new state, no UI changes |
| `reviewMulti` | `scan/grouped-review.tsx` | Hook into new state, no UI changes |
| `RecentUploadsList` | `RecentSubmissionsList.tsx` exists, surfaced on Home only | Surface on `scan/staged.tsx` too |
| `shouldSkipDetectionChoice` | n/a | Port verbatim |

---

## 2. Mobile UI design (per-step)

Web is desktop-first; mobile needs different layout primitives. Each step below specifies the screen shape, primary affordances, and platform-specific behavior.

### 2.1 `scan/staged.tsx` (new)

**Purpose:** review-before-AI surface. The user just captured (or imported) photos; they confirm/edit the set before paying the AI cost.

**Layout (top → bottom):**

```
┌─────────────────────────────────────┐
│ ← Cancel              Clear all     │  ← header (Stack header, native back)
├─────────────────────────────────────┤
│ Upload (N photos · 12.4 MB)         │  ← title + meta (translated)
│ Add more or start AI                │  ← subtitle
├─────────────────────────────────────┤
│ [ + Add more ]  [ Retake ]          │  ← row of secondary actions
├─────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐          │
│ │ img  │ │ img  │ │ img  │  …       │  ← scrollable thumb grid (FlatList numColumns=3)
│ │  ✕   │ │  ✕   │ │  ✕   │          │     long-press → drag to reorder (later)
│ └──────┘ └──────┘ └──────┘          │     tap → fullscreen viewer (PhotoZoomViewer)
├─────────────────────────────────────┤
│ Recent uploads                      │  ← <RecentSubmissionsList limit={5}/>
│ ─────────────────────              │
│ • ITM-000123  Live  · just now      │
│ • ITM-000122  Pending · 5m          │
│ • …                                 │
├─────────────────────────────────────┤
│ [   ✨  Start AI analysis  →   ]    │  ← sticky bottom CTA (primary)
└─────────────────────────────────────┘
```

**Behavior:**
- **Add more** opens `expo-image-picker` (multi-select) — mirrors web's drop-zone "browse" affordance.
- **Retake** routes back to `scan/camera` *without* clearing photos. Append behavior only works because camera hydrates its local `photos` state from `pendingPhotos` on mount (see §2.4); without that hydration, the next shot would replace the pile instead of extending it. Keep the two changes paired in the same commit.
- **Clear all** confirms via `Alert`, then `clearPendingPhotos()` + back to `scan/camera`.
- Thumb ✕ removes a single photo via `pendingPhotos` mutation; **any change to `pendingPhotos`** (`setPendingPhotos`, remove thumb, clear) also calls `setPendingDetection(null)` so a prior AI result can't be applied to an edited pile.
- **Start AI** calls `store.start(pendingPhotos)` (promotes them into `current`, clears `pendingPhotos` + `pendingDetection`), then `router.push(routes.scanProcessing)`.
- If `pendingPhotos.length === 0` the screen auto-redirects to `scan/camera` (defensive — shouldn't happen).
- Header back behavior: same as Cancel; uses `safeBack()` to avoid popping out of the stack.

**Why a separate screen, not a modal:** users on web see this as a full panel; on mobile it's the equivalent natural surface, and recent-uploads list needs vertical room.

### 2.2 `scan/detection.tsx` (new)

**Purpose:** when smart-detect returns ambiguous results (multiple products possible), let the user confirm "1 product" vs "N products" before locking into the review shape.

**Layout:**

```
┌─────────────────────────────────────┐
│ ← Back                              │
├─────────────────────────────────────┤
│ ✨  Detection summary               │
│ "We found 3 distinct products       │
│  across 12 photos. Confidence 87%." │  ← from detectionSummary / detectionConfidence
├─────────────────────────────────────┤
│ How should we list these?           │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ⦿  Single product               │ │  ← radio card 1
│ │    One batch, all photos pooled.│ │
│ │    Best when the photos show the│ │
│ │    same item from many angles.  │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ ○  Multiple products (3)        │ │  ← radio card 2 (default-selected if suggested)
│ │    Three separate listings,     │ │
│ │    one per detected product.    │ │
│ │    [thumbnail strip per group]  │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ [        Continue       →        ]  │  ← sticky primary CTA
└─────────────────────────────────────┘
```

**Behavior:**
- Default selection driven by `mapped.meta.suggestedMode` (single|multi). See "Skip rule" below for how the predicate is fed.
- "Multiple products" card includes a horizontal thumb strip per detected group so users can sanity-check grouping before committing.
- **Edit grouping** (optional v2): tap a group strip to open a fullscreen photo-shuffle screen where the user moves photos between groups. Not in v1 to keep scope tight.
- **Continue must override `mapped.mode` when the user's choice disagrees with the AI.** `applySmartDetection` reads `mapped.mode` to decide single vs grouped persistence; if AI returned 3 products and the user picks "Single," we collapse to the merged-single draft. Use an override parameter rather than mutating `mapped`:
  ```ts
  // In the store, accept an optional forced mode:
  applySmartDetection: (
    mapped: MappedSmartDetection,
    sourcePhotos: Photo[],
    forceMode?: ListingMode,                       // new
  ) => Promise<ListingMode>;
  // Implementation: const effectiveMode = forceMode ?? mapped.mode;

  // Detection Continue — photos live on `current` after Start AI (pendingPhotos was cleared):
  const sourcePhotos = useScanDraft.getState().current!.photos;
  const choice: ListingMode = selectedRadio; // 'single' | 'grouped'
  await store.applySmartDetection(pendingDetection!, sourcePhotos, choice);
  store.setPendingDetection(null);
  router.replace(choice === 'single' ? routes.scanDetail : routes.scanGroupedReview);
  ```
  Internally, the `single` branch with `forceMode === 'single'` uses `mergedSingleFields` (already in `MappedSmartDetection`) for the current draft so the user gets the pooled-photos single listing — not just `products[0]`.
- **Back → `scan/staged`.** `start()` already moved photos onto `current` and cleared `pendingPhotos`, so Back must **demote** before routing:
  ```ts
  await store.demoteCurrentToPending(); // current.photos → pendingPhotos, current = null
  // pendingDetection stays in memory — user can Continue without re-mutating if they return
  router.replace(routes.scanStaged);
  ```
  If they edit photos on staged after Back, `setPendingDetection(null)` fires (see §2.1).

**Skip rule:** processing calls `shouldSkipDetectionChoice(mapped, imageCount)`. Predicate is ported from web 1:1 but its input is `MappedSmartDetection` instead of the raw response. To preserve parity tests:
- `mapSmartDetection` (existing) must expose `suggestedMode` and `productCount` on `mapped.meta` so the predicate has the same signals as the web (`detection.suggested_mode`, `products.length`, `imageCount`).
- Port the unit-test cases verbatim from web's tests against the mapped shape.
- Alternative: stash the raw `SmartDetectionResponse` alongside `mapped` in `pendingDetection` and pass that to the predicate. Slightly more memory; exact parity. Pick one; the plan defaults to "extend `mapped.meta`" because the rest of the app already consumes mapped, not raw.

### 2.3 `scan/processing.tsx` (modify)

**Changes:**
- **Keep `useAnalyzeImages` for `mode === 'grouped'`** (manual one-by-one). The dual-branch survives, but the *single + smart* arm is rewritten and the *single + analyze* arm is the only thing trimmed. Concrete shape:
  ```
  if (mode === 'grouped')         → analyze per item (today's behavior, untouched)
  else if (SMART_DETECT_ENABLED)  → smart-detect → (skip? apply+route : pendingDetection + /scan/detection)
  else                            → analyze (legacy single fallback when flag off)
  ```
- Checklist checkmarks: **honest themed progress, not fake milestones.** A single POST gives no streaming progress. Drive it as:
  - on `mutate()` start → row 1 active.
  - on `onSuccess` → fast-forward all four checks with a 120 ms stagger.
  - on `onError` → freeze rows; show the error block. Drop the 2000/4200/6400/8500 ms hardcoded staggers (they keep ticking after success and lie when failure is fast).
  We're not claiming real milestones — we're aligning the animation to mutation state so it can't drift past the real outcome.
- Replace the "5–10 seconds" hardcoded string with `t('mobile.processing.timeEstimate')`.
- **Routing — single state machine, no double-apply:**
  ```ts
  smart.mutate({ photos, language, signal }, {
    onSuccess: async (mapped) => {
      const skip = shouldSkipDetectionChoice(mapped /* + meta from mapper */, photos.length);
      if (skip) {
        const mode = await store.applySmartDetection(mapped, photos);
        router.replace(mode === 'single' ? routes.scanDetail : routes.scanGroupedReview);
      } else {
        store.setPendingDetection(mapped);   // memory-only, transient
        router.replace(routes.scanDetection);
      }
    },
    onError: () => { /* show error block; no ref resets */ },
  });
  ```
- Detection screen owns the apply for the non-skip branch — see §2.2.
- Remove the `startedForDraftRef.current = null` resets in `onError` callbacks (dead reset).
- Keep AbortController behavior.

### 2.4 `scan/camera.tsx` (modify)

**Changes:**
- `onNext` branches on `mode` **and** `SMART_DETECT_ENABLED`:
  ```ts
  const { mode, setPendingPhotos, start } = useScanDraft.getState();
  if (mode === 'grouped') {
    // Manual one-by-one: each capture becomes its own draft, processed immediately.
    await start(photos);
    router.push(routes.scanProcessing);
  } else if (SMART_DETECT_ENABLED) {
    // Smart-detect single: the whole capture set is a candidate pile; staged owns it.
    await setPendingPhotos(photos);
    router.push(routes.scanStaged);
  } else {
    // Flag off, legacy single: camera → processing (no staged).
    await start(photos);
    router.push(routes.scanProcessing);
  }
  ```
- **Camera hydrates `photos` local state from `pendingPhotos` on mount** so "Retake / Add more" from staged returns to the camera with the existing set still on the tray. Without this, returning to camera resets the strip and the next shot replaces the pile.
  ```ts
  useEffect(() => {
    const pending = useScanDraft.getState().pendingPhotos;
    if (pending?.length) setPhotos(pending);
  }, []); // mount-only; staged is the source of truth between visits
  ```
- Captured photos in local state are still the staging area during a capture session; the moment the user taps Next, the staged screen owns the set via `pendingPhotos`.

### 2.5 `(tabs)/scan.tsx` (modify)

**Changes:**
- Don't blanket-reset on every tap. Delegate to **the existing `getScanResumeRoute`** in `src/lib/scanResume.ts`, extended to handle `pendingPhotos`. Pseudocode:
  ```ts
  const state = useScanDraft.getState();
  const route = getScanResumeRoute({
    mode: state.mode,
    queuedItems: state.queuedItems,
    current: state.current,
    pendingPhotos: state.pendingPhotos,
    pendingDetection: state.pendingDetection, // memory-only; warm resume only
  });

  // Confirm only when there's queued grouped work the user could lose
  if (state.queuedItems.length > 0 && route !== routes.scanGroupedReview) {
    // grouped session in progress + we're routing elsewhere — ask first
    Alert.alert(...continueOrDiscard...);
    return;
  }

  router.replace(route);
  ```
- Resume targets (extend `scanResume.ts`, evaluate **top to bottom**):
  - `pendingDetection != null` → `scanDetection` *(warm resume only — lost on cold start / kill)*
  - grouped mode: existing branches (`queuedItems` + no `current` → grouped-review; else `resumeRouteForItem`)
  - `current.lastStep` ∈ `{ 'detail', 'review' }` or `ai` / `aiSkipped` → `scanDetail`
  - `current.lastStep === 'processing'` → `scanProcessing` ⚠️ **re-runs the AI mutation** unless `pendingDetection` was set (handled above). v2: if `pendingPhotos?.length` route to `scanStaged` instead.
  - `current` null **and** `pendingPhotos?.length` → `scanStaged`
  - otherwise → `freshScanRoute` (`scanCamera` when smart-detect on, `scanListingMethod` when off)
- Silent resume by default. Confirm-discard alert **only** when `queuedItems.length > 0` and the user is navigating away from a partial grouped batch — otherwise MMKV is the source of truth and silent restoration is the right thing (it's what they expect from web). Matches the smaller-notes guidance from review.

### 2.6 `scan/_layout.tsx` (modify)

Add the two new screens to the `Stack`:

```tsx
<Stack.Screen name="staged" options={{ title: '', headerShown: false }} />
<Stack.Screen name="detection" options={{ title: '', headerShown: false }} />
```

### 2.7 `src/lib/routes.ts` (modify)

Add:
```ts
export const routes = {
  ...,
  scanStaged: '/scan/staged' as const,
  scanDetection: '/scan/detection' as const,
};
```

### 2.8 `(tabs)/index.tsx` Home Scan buttons (modify)

Two CTAs feed the funnel today; both need updating without breaking manual grouped:

- **`startScan` (single, smart-detect)** — under `SMART_DETECT_ENABLED`, replace the `reset() + push(scanCamera)` with the same resume-aware logic from §2.5 (extended `getScanResumeRoute`). If the user has pending photos or a current draft, they should land where they left off; otherwise → camera → (capture) → staged.
- **`startManualGrouped`** — **unchanged**. Stays `reset(); setListingMode('grouped'); push(scanCamera)`. Manual grouped intentionally bypasses staged (one item at a time; no "review the set before AI" affordance makes sense for that model). Document this divergence inline.

### 2.9 `scan/listing-method.tsx` (modify)

Used only when `SMART_DETECT_ENABLED === false`. Single branch (`choose('single')`) lands on camera → processing → detail (today's behavior). With the flag on, this screen is unreachable. **No change needed** — leave as legacy fallback. Add a code comment noting the divergence so the next reader doesn't try to "modernize" it.

---

## 3. Store changes (`scanDraftStore.ts`)

Most of the existing store stays. Specific changes:

1. **Surface the smart-detection result in transient state** so `scan/detection.tsx` can read it without redoing the mutation:
   ```ts
   pendingDetection: MappedSmartDetection | null;
   setPendingDetection: (d: MappedSmartDetection | null) => void;
   ```
   **Memory-only, NOT persisted via MMKV.** If the app is killed between processing and detection, the user falls back to `scan/staged` and re-runs the AI. Persisting `pendingDetection` would risk applying stale grouping after a hot-reload; it's a transient handshake only.
   Cleared on: `applySmartDetection` (Continue), `reset()`, `start(...)`, **any `pendingPhotos` mutation** (see §2.1), and on `hydrate` (paranoid — not persisted).

2. **`demoteCurrentToPending()`** — moves `current.photos` → `pendingPhotos`, sets `current = null`, **keeps `pendingDetection`**. Used by detection Back (§2.2). Does not clear MMKV draft keys beyond updating session snapshot.

3. **`pendingPhotos` is now load-bearing.** Camera writes here, staged reads here. `setPendingPhotos` already exists and persists via MMKV — wrap or call `setPendingDetection(null)` inside it when the photo set changes.

4. **`applySmartDetection(..., forceMode?)`** — optional third arg; `effectiveMode = forceMode ?? mapped.mode`; single + `forceMode === 'single'` uses `mergedSingleFields` (§2.2).

5. **`mapSmartDetection` meta** — add `suggestedMode: 'single' | 'multiple'` and `productCount: number` on `mapped.meta` for `shouldSkipDetectionChoice` parity (Phase 2; can land in Phase 0 if mapper tests are extended first).

6. **Delete duplicate `enqueueCurrentItem` or `saveCurrentToGroupedQueue`** (they're identical). Keep one, update callsites.

7. **Fix `patchSession`** type-laundering at line 295:
   ```ts
   patchSession: (partial) => {
     const next = { ...snapshot(get), ...partial };
     persistSession(next);
     set(partial);
   },
   ```

8. **Debounce `persistSession`** for `patch` calls (per-keystroke writes in detail form). Either:
   - Wrap with a 250ms debouncer that always flushes on `setLastStep`, OR
   - Split persisted payload so `patch(current)` only re-stringifies `current`, not `queuedItems`.

   v1: simple debounce. v2: split the persistence key.

9. **No store-level `resumeRoute()` selector.** Resume decisions live in `src/lib/scanResume.ts` (`getScanResumeRoute`) — one tree, used by `(tabs)/scan.tsx`, `(tabs)/index.tsx#startScan`, and tests. Inputs: `mode`, `queuedItems`, `current`, `pendingPhotos`, `pendingDetection` (memory-only). Don't add a parallel selector.

---

## 4. New / changed files

### New
- `app/scan/staged.tsx`
- `app/scan/detection.tsx`
- `src/components/scanner/StagedPhotoGrid.tsx` (thumb grid + remove + reorder hook)
- `src/components/scanner/DetectionGroupCard.tsx` (radio card with thumb strip)
- `src/features/scanner/smartDetectionRouting.ts` (port `shouldSkipDetectionChoice` from web)

### Modified
- `app/(tabs)/index.tsx` — `startScan` becomes resume-aware (via `getScanResumeRoute`). `startManualGrouped` unchanged.
- `app/(tabs)/scan.tsx` — resume via `getScanResumeRoute`, no parallel implementation.
- `app/scan/camera.tsx` — `onNext` three-way branch (§2.4): grouped → `start` + processing; smart single → `setPendingPhotos` + staged; flag-off single → `start` + processing. Mount hydrate from `pendingPhotos`.
- `app/scan/processing.tsx` — trim only the dead `single + analyze` arm; keep grouped analyze; rewrite routing per §2.3 state machine.
- `app/scan/_layout.tsx` — register `staged`, `detection`.
- `app/scan/listing-method.tsx` — no behavior change; add comment that it's the `SMART_DETECT_ENABLED=false` fallback.
- `src/lib/routes.ts` — add `scanStaged`, `scanDetection`.
- `src/lib/scanResume.ts` — extend `getScanResumeRoute`: `pendingDetection` → detection, `pendingPhotos` → staged (§2.5 order).
- `src/stores/scanDraftStore.ts` — `pendingDetection`, `demoteCurrentToPending`, `applySmartDetection` + `forceMode`, mapper meta fields, dedup queue helpers, `patchSession` fix, debounced `persistSession`, `setPendingPhotos` clears stale detection.
- `src/i18n/locales/*.json` — translation keys (see §6).

### Deleted / inlined
- The dead `single + analyze` arm inside `processing.tsx` (under `SMART_DETECT_ENABLED`, only the `mode === 'single'` path used analyze; smart-detect replaces it).
- **`useAnalyzeImages.ts` stays** — manual grouped (`mode === 'grouped'`) still uses it per item. Confirm with `rg "useAnalyzeImages"` before any removal in later refactors.
- One of `enqueueCurrentItem` / `saveCurrentToGroupedQueue` (identical bodies).

---

## 5. Implementation phases

Each phase ships an independently testable surface. Verify on device before moving on.

### Phase 0 — store cleanup & resume logic (1 day)
- Dedup `enqueueCurrentItem` / `saveCurrentToGroupedQueue`; pick one, update callsites.
- Fix `patchSession` type laundering.
- Add `pendingDetection` (memory-only) + `setPendingDetection`; `demoteCurrentToPending()`; clear detection on `setPendingPhotos` / `start()`.
- Extend `getScanResumeRoute`: `pendingDetection` → `scanDetection`, `pendingPhotos` → `scanStaged` (§2.5 order).
- Debounce `persistSession` for `patch` (250ms; flush on `setLastStep` / `setAi` / `enqueueCurrentItem`).
- **Verify:** existing manual-grouped + smart-detect-single flows still work end to end. No user-visible change yet. Run `mapSmartDetection` tests; add unit tests for `getScanResumeRoute` branches and `patchSession`.

### Phase 1 — `scan/staged.tsx` + camera handoff (1 day)
- Build `StagedPhotoGrid` with thumb tap → existing `PhotoZoomViewer`.
- Wire `(tabs)/scan` resume guard.
- Rewire `camera.onNext` per §2.4 (grouped / smart staged / flag-off processing).
- Add `RecentSubmissionsList` (limit=5) below the grid.
- Add translation keys.
- **Verify:** capture → staged → start AI → flows through existing processing/detail screen. RecentSubmissionsList renders. Add-more, retake, clear-all all work. Backgrounding the app mid-staging preserves photos.

### Phase 2 — `scan/detection.tsx` + skip predicate + processing routing (2 days)

This phase **also rewrites `processing.tsx`'s routing** because the two are inseparable — there's no half-step where detection exists but processing still applies on every success. Merging Phase 2 and what was originally Phase 3 into one shippable surface avoids a broken intermediate state.

- Port `shouldSkipDetectionChoice` 1:1 from web. Input: `MappedSmartDetection` + `imageCount` (after `mapSmartDetection` adds `suggestedMode` + `productCount` to `meta`).
- Build `DetectionGroupCard` + `scan/detection.tsx`.
- Rewrite `processing.tsx` routing per §2.3 state machine:
  - grouped → analyze (unchanged).
  - single + smart → mutate → `shouldSkipDetectionChoice(...) ? apply+route : setPendingDetection + push(scanDetection)`.
  - single + legacy (flag off) → analyze (unchanged).
- Add `forceMode` parameter to `applySmartDetection` per §2.2.
- Wire detection Back → `demoteCurrentToPending()` + staged; Continue → `applySmartDetection(pendingDetection, current.photos, choice)` → route.
- Translation keys for both screens.
- **Verify:**
  - 1 photo / 1 product → `shouldSkipDetectionChoice` true → detail. Predicate alone gates the skip; don't add a redundant `N > 1` check.
  - 12 photos / 1 confident product → skip true → detail.
  - 12 photos / 3 detected products → skip false → detection, default "multi", continue → grouped-review.
  - 12 photos / 3 detected but user picks "single" → `applySmartDetection(..., 'single')` collapses to merged-single → detail.
  - Smart-detect failure shows error block with retake / continue-without-AI.
  - **Manual grouped path still works per item** — no regression.

### Phase 3 — processing animation polish (½ day)

The branch restructure ships in Phase 2 (above). This phase is *only* the animation hygiene the routing rewrite doesn't strictly need.

- Drive checkmarks off mutation lifecycle (`isPending` start → row 1 active; `onSuccess` → fast-forward rows with 120ms stagger; `onError` → freeze).
- Replace hardcoded "5–10 seconds" with `t('mobile.processing.timeEstimate')`.
- Remove `startedForDraftRef.current = null` dead resets in `onError` callbacks (no functional effect; just dead code).
- **Verify:** loader animation no longer drifts past actual success/failure; no other behavior change.

### Phase 4 — polish & QA (½ day)
- iOS + Android device sweep on each phase's flow.
- Translation completeness check (EN + ZH + JA + TH).
- Slow-network simulation through the whole funnel.
- Backgrounding/foregrounding at every step (verifies MMKV persistence + `verifyScanSessionFiles`).
- Pull `lib/flags.ts` and make sure `SMART_DETECT_ENABLED` can still be toggled off (legacy analyze path needs to either be restored under the flag or the flag retired).

**Revised estimate:** ~5 dev days. Breakdown: Phase 0 = 1d (store cleanup), Phase 1 = 1d (staged), Phase 2 = 2d (detection + processing routing — inseparable), Phase 3 = ½d (animation polish), Phase 4 = ½d (QA matrix). Gallery import (open Q #1) adds a few hours if approved. Each phase ships under the single `SMART_DETECT_ENABLED` flag — flip it off and the legacy listing-method path is intact.

---

## 6. Translation keys

Add under `mobile.staged.*` and `mobile.detection.*` mirroring web's `newSubmissionUpload.*` keys:

```
mobile.staged.title           → "Upload"
mobile.staged.meta            → "{count} photos · {size}"
mobile.staged.addMore         → "Add more"
mobile.staged.retake          → "Retake"
mobile.staged.clearAll        → "Clear all"
mobile.staged.clearConfirm    → "Remove all photos?"
mobile.staged.startAi         → "Start AI analysis"
mobile.staged.recentUploads   → "Recent uploads"

mobile.detection.title              → "How should we list these?"
mobile.detection.summary            → "We found {count} distinct products across {photos} photos."
mobile.detection.confidence         → "Confidence {pct}%"
mobile.detection.single.title       → "Single product"
mobile.detection.single.desc        → "One batch, all photos pooled."
mobile.detection.multi.title        → "Multiple products ({count})"
mobile.detection.multi.desc         → "{count} separate listings, one per detected product."
mobile.detection.continue           → "Continue"
mobile.detection.back               → "Back"
```

All 4 locale files in `src/i18n/locales/` get these.

---

## 7. Edge cases & risks

| Case | Plan |
|---|---|
| User adds photo via picker while AI is mid-mutation | Disable "Add more" while `smart.isPending`. |
| User backgrounds during smart-detect | Mutation aborted; `getScanResumeRoute` → `staged` if `pendingPhotos` remain, else `processing` if `current` stuck on `lastStep: 'processing'`. User restarts AI from staged. |
| Detection Back without demote | **Bug if skipped:** `pendingPhotos` empty while photos sit on `current`. Always call `demoteCurrentToPending()` before `scan/staged`. |
| Detection Back → staged → edit photos → Start AI | `setPendingDetection(null)` on photo change; must re-mutate. |
| Detection Back → staged → Continue (no re-AI) | `pendingDetection` still valid if photos unchanged; user can return to detection via warm resume. |
| Detection screen → back → staged → Start AI again | Re-mutates from scratch. Acceptable. (Photo-set hash cache is v2.) |
| Skipped detection but user wants to switch to multi | The single review screen (`scan/detail`) has no "actually it's many" button today. v2: add a `mergedSingle` → `collapseToSingleFromSmartDetection` reverse via a header overflow menu. Out of scope for v1. |
| Pending photos older than X days | `verifyDraftPhotos` already handles missing files; resume should drop pendingPhotos if any URI is gone. Surface a one-time toast. |
| AbortController + React Query retries | Mutation already has no retry default. Confirm in `useSmartDetect.ts`. |
| Recent uploads on a fresh account (no batches) | Empty state inside `RecentSubmissionsList` already handled. |
| Multi mode with 8+ groups (unlikely but possible) | DetectionScreen scrolls; cards have max-height with internal scroll for thumb strip. |

---

## 8. Test plan (manual + automated)

**Manual matrix per phase** — see §5 "Verify" bullets.

**Automated coverage to add:**
- Unit: `shouldSkipDetectionChoice` — copy web's test cases.
- Unit: `getScanResumeRoute` — all branches (`pendingDetection`, `pendingPhotos`, grouped, processing, detail).
- Unit: `patchSession` after fix — confirm `next` shape matches `PersistedScan`.
- Integration (RTL + jest): mount `scan/staged.tsx` with a stubbed store, assert the Start AI button is disabled when `pendingPhotos` is empty.
- Integration: mount `scan/detection.tsx` with mocked `pendingDetection`, click each radio, click Continue, assert correct navigation target.

Existing test: `features/scanner/__tests__/mapSmartDetection.test.ts` stays.

---

## 9. Rollout strategy

- **One flag, not two.** Staged + detection ride the existing `SMART_DETECT_ENABLED`. When the flag is off, listing-method → camera → processing → detail runs untouched. No new `SCAN_STAGED_FLOW`.
- **Kill switch:** if a regression appears mid-rollout, flip `SMART_DETECT_ENABLED=false`. The legacy single-product path remains intact for ~2 releases; manual grouped is unaffected either way.
- **Analytics:** drop one event per new screen (`scan_staged_viewed`, `scan_detection_viewed`, `scan_detection_choice` with `mode` payload). Wire through existing `services/analytics`.
- **No backend changes.** All ports are client-side; server contract is identical (smart-detect + batch-create endpoints unchanged).

---

## 10. Non-goals (explicit, to avoid scope creep)

- **No reordering / cover-photo selection on `staged`.** Already lives in `scan/detail.tsx`'s carousel; don't duplicate.
- **No editing detection grouping** (moving photos between groups) in v1. v2 feature.
- **No design-system refactor.** Use existing `colors`, `spacing`, `fonts` from `theme/`. New screens follow the same tokens as `scan/detail.tsx`.
- **No web changes.** This is a one-way port; if the web later changes, we re-sync deliberately.

---

## 11. Open questions to confirm before coding

1. **Should `staged` allow gallery import** (add `expo-image-picker`)? Web allows it. Default proposed: yes — adds a few hours and one dep. If no, the "Add more" button on staged routes back to `scanCamera` instead of opening the picker.
2. **Detection screen — show photo thumb strip per group, or just count?** Plan assumes thumb strip (richer feedback). Strip can be hidden behind an expand chevron if it crowds the screen on small devices.

**Resolved (originally on this list, now decided):**
- ~~Delete legacy analyze entirely?~~ → **No.** Manual grouped still uses it per item. Only the dead `mode === 'single'` analyze arm is trimmed.
- ~~Silent vs prompt resume?~~ → **Silent by default; prompt only when `queuedItems.length > 0`** and the user would be navigating away from a partial grouped batch.
- ~~Two feature flags?~~ → **One.** Staged + detection ride `SMART_DETECT_ENABLED`.

---

## 12. Done = ?

- A seller on mobile sees the same five-screen progression (camera → staged → processing → [detection] → review) as a seller on web sees (drop zone → staged → processing → [detection] → review).
- All translation keys present in all 4 locales.
- Manual matrix in §5 passes on iOS + Android.
- No regression in existing `scan/detail.tsx` or `scan/grouped-review.tsx` (they read from the same store fields, untouched).
- Telemetry shows ≥ 95% of `SMART_DETECT_ENABLED` Home `startScan` + Scan-tab entries hitting `scan/staged`. Manual grouped is excluded by design (no staged step). `listing-method` single is only reachable with the flag off (no staged in that path either), so it's outside the north star.
- One screenshot per screen attached to the PR for design sign-off.

---

## 13. Implementation progress

### Phase 0 — store cleanup & resume logic ✅ (complete)

**Date:** 2026-05-28
**Status:** all subtasks landed; `tsc --noEmit` clean; 51/51 jest tests passing across the three affected suites.

| Subtask | File(s) | Notes |
|---|---|---|
| Add `scanStaged` + `scanDetection` routes | [routes.ts:9](GreenBridgeApp/src/lib/routes.ts:9) | Stable `Href` constants used by store + scanResume + future Phase 1/2 screens. |
| Dedup `enqueueCurrentItem` / `saveCurrentToGroupedQueue` | [scanDraftStore.ts](GreenBridgeApp/src/stores/scanDraftStore.ts), [detail.tsx](GreenBridgeApp/app/scan/detail.tsx) | Removed `saveCurrentToGroupedQueue` (identical body); `detail.tsx#onSaveAndReturnToReview` now calls `enqueueCurrentItem`. |
| Fix `patchSession` type laundering | [scanDraftStore.ts:303-307](GreenBridgeApp/src/stores/scanDraftStore.ts:303) | Replaced fake-`get`-lambda cast with `{ ...snapshot(get), ...partial }` typed as `PersistedScan`. |
| Add `pendingDetection` + `setPendingDetection` | [scanDraftStore.ts:232,277-279](GreenBridgeApp/src/stores/scanDraftStore.ts:232) | Memory-only handshake; cleared on `hydrate`, `reset`, `start`, `setPendingPhotos`, `clearPendingPhotos`, and on consume inside `applySmartDetection`. |
| Add `demoteCurrentToPending()` | [scanDraftStore.ts:323-334](GreenBridgeApp/src/stores/scanDraftStore.ts:323) | Async; moves `current.photos` → `pendingPhotos` via `persistPhotosForDraft(..., 'pending')`, nulls `current`, **keeps `pendingDetection`** so detection Back can re-mount cleanly. |
| Clear `pendingDetection` on photo mutations | [scanDraftStore.ts:313-322,353](GreenBridgeApp/src/stores/scanDraftStore.ts:313) | Every photo-set mutation invalidates the prior AI grouping. |
| Add `forceMode` to `applySmartDetection` | [scanDraftStore.ts:500-571](GreenBridgeApp/src/stores/scanDraftStore.ts:500) | `effectiveMode = forceMode ?? mapped.mode`; when user picks single over an AI-multi result, current is seeded from `mergedSingle` (pooled photos), not `products[0]`. Also clears `pendingDetection` on consume. |
| Debounce `persistSession` for `patch` | [scanDraftStore.ts:166-201](GreenBridgeApp/src/stores/scanDraftStore.ts:166) | 250ms debounce via `schedulePatchPersist` + `flushPendingPatch`. Flushes called from `setAi`, `setLastStep`, `enqueueCurrentItem`, `demoteCurrentToPending`, `reset` — no in-flight patch can be dropped at a screen transition. |
| Extend `getScanResumeRoute` | [scanResume.ts:31-67](GreenBridgeApp/src/lib/scanResume.ts:31) | Top-to-bottom: `pendingDetection` → detection; grouped queue/current branches (unchanged); single `current` → existing resumeRouteForItem; `pendingPhotos` → staged; otherwise fresh. Exported `ScanResumeState` type for callers. |
| Unit tests | [scanResume.test.ts](GreenBridgeApp/src/lib/__tests__/scanResume.test.ts) (14 cases), [scanDraftStore.test.ts](GreenBridgeApp/src/stores/__tests__/scanDraftStore.test.ts) (10 cases) | Covers all `getScanResumeRoute` branches incl. precedence; `patchSession` shape; `pendingDetection` clearing on every photo mutation; `demoteCurrentToPending` happy path + no-current no-op + detection-preservation. |

**Observable user-facing change:** none yet (Phase 0 is plumbing). Camera → processing → detail still runs end-to-end as today; manual grouped unchanged.

**Follow-ups carried into Phase 1:**
- Camera mount hydration from `pendingPhotos` (§2.4) — store helper is ready (`setPendingPhotos`), wiring lives in `scan/camera.tsx`.
- `(tabs)/scan.tsx` swap to `getScanResumeRoute` — extended function is ready, but the consumer isn't updated yet because there's no `staged` route to land on. Phase 1 ships both together.

### Phase 0.1 — debounce race fixes ✅ (complete)

**Date:** 2026-05-28
**Trigger:** review found a race where `detail.tsx#onReviewGroup` calls `patch(updated)` then `prepareGroupedReview()` synchronously. The debounced patch could fire *after* `prepareGroupedReview` persisted, overwriting MMKV with a stale snapshot (`current` still set, queue missing the just-promoted item).

| Subtask | File(s) | Notes |
|---|---|---|
| Flush patch in `prepareGroupedReview` | [scanDraftStore.ts:476-482](GreenBridgeApp/src/stores/scanDraftStore.ts:476) | Comment in source explains the exact bug. |
| Flush patch in `removeQueuedItem` | [scanDraftStore.ts:455-457](GreenBridgeApp/src/stores/scanDraftStore.ts:455) | Same flush-before-snapshot pattern. |
| Flush patch in `editQueuedItem` | [scanDraftStore.ts:464](GreenBridgeApp/src/stores/scanDraftStore.ts:464) | Prevents a stale patch landing on the *new* current after promotion. |
| Flush + clear `pendingDetection` in `updatePhotos` | [scanDraftStore.ts:354-362](GreenBridgeApp/src/stores/scanDraftStore.ts:354) | Photos changed on current → any prior AI grouping is stale. |
| Race-fix tests | [scanDraftStore.test.ts](GreenBridgeApp/src/stores/__tests__/scanDraftStore.test.ts) | `prepareGroupedReview` observes in-flight patch; `enqueueCurrentItem` observes in-flight patch; `removeQueuedItem` does not lose the queue mutation; `updatePhotos` nulls `pendingDetection`. |

**Verification:** `tsc --noEmit` clean; **55/55 jest passing** (4 new race tests; the original 51 plus the fix).

### Phase 1 — staged screen + camera handoff + resume wiring ✅ (complete)

**Date:** 2026-05-28
**Status:** all subtasks landed; `tsc --noEmit` clean; **55/55 jest passing**. First user-visible surface ships under `SMART_DETECT_ENABLED=true`.

**Open questions resolved before Phase 1 started:**
- **Gallery import on `staged`** → **YES.** `expo-image-picker` is already in `package.json` (~56.0.13), no new dep needed.
- **Detection thumb strips** → **YES, per-group strips** (plan's default). Horizontal scroll inside each card; chevron-expand fallback only if real-device QA shows crowding on small screens.

| Subtask | File(s) | Notes |
|---|---|---|
| `scan/_layout.tsx` registration | n/a | Skipped — Expo Router auto-discovers `app/scan/staged.tsx` + `app/scan/detection.tsx`. No explicit `Stack.Screen` needed; new files inherit `headerShown:false`+slide-from-right defaults. |
| `StagedPhotoGrid` component | [StagedPhotoGrid.tsx](GreenBridgeApp/src/components/scanner/StagedPhotoGrid.tsx) | 3-column wrap grid (no FlatList — sits inside the staged ScrollView). Tap → `PhotoZoomViewer`; ✕ → remove. Reorder explicitly v2 per §10. |
| `scan/staged.tsx` screen | [staged.tsx](GreenBridgeApp/app/scan/staged.tsx) | Header (Cancel + Clear all), title + meta (`count · size`), Add more / Retake chips, photo grid, `RecentSubmissionsList` (limit=5), sticky Start AI CTA. Defensive auto-bounce to camera when `pendingPhotos` empties. Clear-all confirms via Alert. Gallery import via `expo-image-picker` with same `compressPhoto` pipeline as camera. |
| Translation keys | [en.json](GreenBridgeApp/src/i18n/locales/en.json), [zh.json](GreenBridgeApp/src/i18n/locales/zh.json), [ja.json](GreenBridgeApp/src/i18n/locales/ja.json), [th.json](GreenBridgeApp/src/i18n/locales/th.json) | `mobile.staged.*` (14 keys) + `mobile.detection.*` (9 keys) added to all 4 locales. Verified via Node JSON parse. |
| Camera `onNext` three-way branch | [camera.tsx:209-231](GreenBridgeApp/app/scan/camera.tsx:209) | `mode === 'grouped'` → `start()` + processing; smart-detect single → `setPendingPhotos()` + staged; flag off → `start()` + processing (legacy). |
| Camera mount-hydrate from `pendingPhotos` | [camera.tsx:62-72](GreenBridgeApp/app/scan/camera.tsx:62) | One-shot `useEffect` on mount restores existing pile so Retake/Add-more from staged appends instead of replacing. Read-once is intentional — staged-side updates must not bleed into the active capture session. |
| `(tabs)/scan.tsx` resume wiring | [scan.tsx](GreenBridgeApp/app/(tabs)/scan.tsx) | Replaced blanket `reset()` with `getScanResumeRoute(...)`. Prompts to discard only when `queuedItems.length > 0` AND routing away from grouped-review (the one user-destructive case). |
| `(tabs)/index.tsx#startScan` resume wiring | [index.tsx:76-95](GreenBridgeApp/app/(tabs)/index.tsx:76) | Under `SMART_DETECT_ENABLED`, Home "Scan" routes via `getScanResumeRoute(...)` — silent restore (the Scan tab handles the queued-discard alert). `startManualGrouped` unchanged per §2.8. |

**Observable user-facing changes (with `SMART_DETECT_ENABLED=true`):**
- Capture → tap Next → lands on new **staged** screen instead of jumping straight to processing.
- Staged shows pile preview, Add more / Retake chips, ✕ remove, Start AI sticky CTA, and Recent uploads (limit 5).
- Tapping the Scan tab while a draft is in progress now **resumes** instead of resetting.
- Background mid-staging → reopen → photos still there (MMKV-persisted `pendingPhotos`).
- Manual grouped flow unchanged — `mode === 'grouped'` still goes camera → processing per item.

**Verification (automated):**
- `tsc --noEmit` clean across the workspace.
- `jest scanResume scanDraftStore mapSmartDetection` → **55/55** passing (no regression).
- All 4 locale JSONs parse and contain `mobile.staged.startAi` and `mobile.detection.title`.

**Manual smoke matrix to run on device before declaring Phase 1 fully done:**
- [ ] iOS + Android: fresh capture → staged → Start AI → existing detail/grouped-review reaches success.
- [ ] iOS + Android: Retake from staged → camera shows existing pile → new shot appends, not replaces.
- [ ] iOS + Android: Add more (gallery) → photos compress + merge into pile.
- [ ] iOS + Android: Clear all → Alert → confirms → back to camera (pile cleared).
- [ ] iOS + Android: Scan tab tap mid-staging → silent resume to staged.
- [ ] iOS + Android: Scan tab tap while grouped queue has 2+ items → Alert with Discard/Continue.
- [ ] iOS + Android: Background app on staged → reopen → photos persist.
- [ ] Manual grouped path (List one by one) → camera → processing per item, **no staged screen**.

**Phase 2 prerequisites carried forward:**
- `mapSmartDetection.meta.suggestedMode` + `productCount` extension (deferred from Phase 0).
- `scan/detection.tsx` screen, `shouldSkipDetectionChoice` port, processing routing rewrite.
- Detection Continue must read `current?.photos ?? pendingPhotos ?? []` per the Phase 0.1 gotcha.

### Phase 1.1 — review follow-ups ✅ (complete)

**Date:** 2026-05-28
**Trigger:** review found two real issues in the Phase 1 surface — staged meta showed `—` because `sizeBytes` never made it onto Photo objects, and the nested `Pressable` in `StagedPhotoGrid` could fire both "open zoom" and "remove" on a single ✕ tap.

| Subtask | File(s) | Notes |
|---|---|---|
| `compressPhoto` returns `sizeBytes` | [compress.ts](GreenBridgeApp/src/services/upload/compress.ts) | Reads `FileSystem.getInfoAsync(result.uri).size` after manipulation. Documented as optional; web (no `documentDirectory`) and transient FS errors leave it `undefined`. |
| Camera capture site populates `sizeBytes` | [camera.tsx:165](GreenBridgeApp/app/scan/camera.tsx:165) | Forwards `compressed.sizeBytes` onto the `Photo` pushed into local state. |
| Gallery import site populates `sizeBytes` | [staged.tsx:103-108](GreenBridgeApp/app/scan/staged.tsx:103) | Same; per-asset, skipped assets don't poison the count. |
| Meta string handles unknown size | [staged.tsx:46-51,159-168](GreenBridgeApp/app/scan/staged.tsx:46) | If *any* photo lacks `sizeBytes`, total is treated as unknown and meta falls back to `"{{count}} photos"` (no `—` placeholder). New i18n key `mobile.staged.metaCountOnly` with inline `defaultValue` for forward-compatible runtime. |
| `StagedPhotoGrid` ✕ no longer triggers zoom | [StagedPhotoGrid.tsx:48-71,94](GreenBridgeApp/src/components/scanner/StagedPhotoGrid.tsx:48) | Restructured so the zoom `Pressable` (wrapping the image) and the remove `Pressable` are **siblings inside a plain `View`**, not parent/child. Comment explains the Android propagation risk so future edits don't undo it. |

**Open question (declined, with rationale logged):**
- `startScan` push vs replace — left as `push`. Home → Scan is a deliberate cross-tab CTA where users expect Back to return them to Home. The stacking edge case (re-tapping the Home Scan button while a scan stack is already open) is rare and `useFocusEffect` on the Scan tab uses `replace`, so duplicates can only arise from a specific repeated-CTA pattern. Re-visit if device QA surfaces actual back-stack confusion.

**Verification:** `tsc --noEmit` clean; **55/55 jest passing**; no test changes needed (the fixes are UI-side).

### Phase 2 — detection screen + skip predicate + processing routing ✅ (complete)

**Date:** 2026-05-28
**Status:** all subtasks landed; `tsc --noEmit` clean; **71/71 jest passing** across 5 suites. Second user-visible surface ships under `SMART_DETECT_ENABLED`.

**Phase 2 gotchas (logged in Phase 0.1) — all addressed:**

1. ✅ **Detection Continue uses `current?.photos ?? pendingPhotos ?? []`.** [detection.tsx:33](GreenBridgeApp/app/scan/detection.tsx:33) — handles both cold path (post-processing, current populated) and warm-resume path (post-Back, current demoted to null and photos sit on pendingPhotos).
2. ✅ **Stale `pendingDetection` cleanup.** Already covered by `start`, `setPendingPhotos`, `clearPendingPhotos`, `reset`, `updatePhotos`, and `applySmartDetection`. Detection screen `setPendingDetection(null)` defensively before navigation after Continue.
3. ✅ **`mapSmartDetection.meta.suggestedMode` / `productCount`.** Added; mapper preserves raw `suggestedMode` from the response and the raw `productCount` BEFORE the MAX_PRODUCTS cap and BEFORE the single-mode slice. The skip predicate reads both.

| Subtask | File(s) | Notes |
|---|---|---|
| Extend `mapSmartDetection.meta` | [mapSmartDetection.ts:129-137](GreenBridgeApp/src/features/scanner/mapSmartDetection.ts:129), [smartDetectionTypes.ts:78-99](GreenBridgeApp/src/features/scanner/smartDetectionTypes.ts:78) | Added `suggestedMode: 'single'\|'multiple'` and `productCount: number`. The predicate reads both. |
| Port `shouldSkipDetectionChoice` | [smartDetectionRouting.ts](GreenBridgeApp/src/features/scanner/smartDetectionRouting.ts) | 1:1 with web; input reshaped from `SmartDetectionResponse` → `MappedSmartDetection` via `meta`. Truth table preserved (including web's redundant single+1-product branch for exact parity). |
| `DetectionGroupCard` | [DetectionGroupCard.tsx](GreenBridgeApp/src/components/scanner/DetectionGroupCard.tsx) | Controlled radio card; multi variant carries optional per-group horizontal thumb strips (`groupThumbs: Photo[][]`). Selection state owned by parent. |
| `scan/detection.tsx` | [detection.tsx](GreenBridgeApp/app/scan/detection.tsx) | Header with Back, confidence pill, "How should we list these?" title + summary, two radio cards (Single / Multi with thumb strips), sticky Continue CTA. **Source-photo lookup uses `current?.photos ?? pendingPhotos ?? []`** per the Phase 0.1 gotcha. Defensive null-pendingDetection redirect to staged. |
| Detection Back | [detection.tsx:69-78](GreenBridgeApp/app/scan/detection.tsx:69) | `demoteCurrentToPending()` if current set, then `replace(scanStaged)`. `pendingDetection` survives so a return resumes the picker without re-mutating. |
| Detection Continue | [detection.tsx:80-104](GreenBridgeApp/app/scan/detection.tsx:80) | `applySmartDetection(mapped, sourcePhotos, choice)` → defensive `setPendingDetection(null)` → replace to detail or grouped-review. Errors surface via Alert. |
| `processing.tsx` routing rewrite | [processing.tsx:255-298](GreenBridgeApp/app/scan/processing.tsx:255) | Smart-detect single arm now branches on `shouldSkipDetectionChoice(mapped, photos.length)`. Skip → apply + route (existing). No-skip → `setPendingDetection(mapped)` + replace to `scanDetection`. Grouped + legacy analyze branch untouched. Removed dead `startedForDraftRef = null` resets per Phase 0 review. |
| Tests | [smartDetectionRouting.test.ts](GreenBridgeApp/src/features/scanner/__tests__/smartDetectionRouting.test.ts) (10), [mapSmartDetection.test.ts](GreenBridgeApp/src/features/scanner/__tests__/mapSmartDetection.test.ts) (+2 new), [scanDraftStore.test.ts](GreenBridgeApp/src/stores/__tests__/scanDraftStore.test.ts) (+4 forceMode integration tests) | Truth-table for skip predicate; raw `productCount` preserved when client mode collapses; `forceMode='single'` over AI-multi seeds current from `mergedSingle` (pooled photos, not products[0]); `forceMode='grouped'` matches AI; default behavior unchanged; pendingDetection cleared on apply. |

**Observable user-facing changes (with `SMART_DETECT_ENABLED=true`):**
- Capture → staged → Start AI → processing → if AI confidently sees one product (or only one photo was shot), it skips straight to detail / grouped-review as before.
- **NEW:** when AI returns >1 product with >1 photo, processing routes to the detection picker. User chooses Single (pooled) or Multi (one listing per detected group, with thumb strips for sanity check) before review starts.
- Back from detection lands on staged with photos intact; editing photos there clears the stale detection and re-Start AI runs a fresh mutation.
- Skip predicate matches web behavior 1:1.

**Verification (automated):**
- `tsc --noEmit` clean across workspace.
- `jest` → **71/71 passing** (37 existing mapper + 14 scanResume + 10 skip predicate + 14 store Phase 0/0.1 + 4 store forceMode + 2 new mapper-meta). No regression.

**Manual smoke matrix to run on device before declaring Phase 2 fully done:**
- [ ] iOS + Android: 1 photo single → skips detection, lands on detail.
- [ ] iOS + Android: many photos / confident single → skips detection, lands on detail.
- [ ] iOS + Android: many photos / >1 product → detection screen, default "multi" selected, Continue → grouped-review.
- [ ] iOS + Android: many photos / >1 product → user picks Single → Continue → detail with pooled photos (not just products[0]).
- [ ] iOS + Android: detection Back → staged with photos intact → re-Start AI → re-mutate cleanly.
- [ ] iOS + Android: detection Back → edit photos on staged → re-Start AI → fresh mutation (pendingDetection cleared by setPendingPhotos).
- [ ] iOS + Android: AI failure → error block with Retake / Continue without AI.
- [ ] iOS + Android: Manual grouped path unchanged.
- [ ] iOS + Android: Translations show correctly in EN / ZH / JA / TH.

### Phase 2.1 — capped vs raw product count ✅ (complete)

**Date:** 2026-05-28
**Trigger:** review caught that `scan/detection.tsx` was using `pendingDetection.meta.productCount` (raw, pre-MAX_PRODUCTS cap) for the multi card label, while the thumb strips iterate `pendingDetection.products` (capped to 10). If AI ever returned >10 products, the UI would say "Multiple products (12)" but render only 10 group strips.

| Subtask | File(s) | Notes |
|---|---|---|
| Split `rawProductCount` vs `displayedCount` | [detection.tsx:46-58](GreenBridgeApp/app/scan/detection.tsx:46) | `rawProductCount` (from `meta.productCount`) used only in the summary line — keeps "we found N products" truthful about the AI verdict. `displayedCount` (from `products.length`) drives the multi card label + group count, because that's how many listings would actually be created. |
| `truncatedNote` disclosure | [detection.tsx:131-139](GreenBridgeApp/app/scan/detection.tsx:131) | When `raw > displayed`, shows "Showing the first {{shown}} of {{total}}." in warning tone so the user understands the apparent count mismatch. New i18n key `mobile.detection.truncatedNote` with inline `defaultValue` for forward-compat. |
| Style tweak | [detection.tsx](GreenBridgeApp/app/scan/detection.tsx) | New `truncatedNote` style; offsets summary's bottom margin so the note sits close to the summary, then provides its own gap before the radio cards. |

**Minor notes from review (intentionally not changed):**
- `useState(defaultChoice)` won't auto-sync if `pendingDetection` changes without remount — acceptable because all entry points to detection (`router.replace(routes.scanDetection)`) trigger a fresh mount.
- `setIsNavigating(true)` then `replace` in processing's no-skip path — if navigation fails the screen stays in navigating state. Extremely low probability; defer until QA surfaces real cases.

**Verification:** `tsc --noEmit` clean; **71/71 jest passing** (no test changes — the bug was display-only).

### Phase 3 — processing animation polish ✅ (complete)

**Date:** 2026-05-28
**Status:** all subtasks landed; `tsc --noEmit` clean; **71/71 jest passing**. UI-only change — no behavior diff for successful flows, but the **error path no longer claims completion before the AI fails**.

| Subtask | File(s) | Notes |
|---|---|---|
| Drive checkmarks off mutation lifecycle | [processing.tsx:163-218](GreenBridgeApp/app/scan/processing.tsx:163) | Replaced 2000/4200/6400/8500ms wall-clock timers with a state-driven effect: `isPending` → reset to row 1 active; `isSuccess` → fast-forward rows 1→4 at 120ms stagger right before `router.replace` unmounts; `isError` → freeze rows + render error block. Honest themed progress, can't drift past the real outcome. |
| Add `isSuccess` / `isError` selectors | [processing.tsx:60-67](GreenBridgeApp/app/scan/processing.tsx:60) | Read from whichever mutation arm is active (`useSmart ? smart : analyze`). |
| Localize "5–10 seconds" | [processing.tsx:403](GreenBridgeApp/app/scan/processing.tsx:403) | Hardcoded string → `t('mobile.processing.timeEstimate')`. New i18n key seeded into all 4 locales (EN/ZH/JA/TH). Existing `mobile.processing.subtitle` retained for the legacy fallback render path. |
| Seed `mobile.detection.truncatedNote` | [en.json](GreenBridgeApp/src/i18n/locales/en.json), [zh.json](GreenBridgeApp/src/i18n/locales/zh.json), [ja.json](GreenBridgeApp/src/i18n/locales/ja.json), [th.json](GreenBridgeApp/src/i18n/locales/th.json) | Reviewer polish: replaced inline `defaultValue` reliance with real per-locale strings so translation completeness tracking sees the key. |
| Remove dead `startedForDraftRef.current = null` resets | [processing.tsx:300](GreenBridgeApp/app/scan/processing.tsx:300) | Removed the final dead reset in the apply-error catch (the bare-onError ones were dropped in Phase 2). Effect deps don't change on apply-error, so the reset never re-triggered the mutation anyway — it was confusing dead code. |

**Verified `startedForDraftRef.current = null` count:** `rg` returns 0 hits in `processing.tsx`.

**Observable user-facing changes:**
- Successful AI run: brief 4-step "done" cascade right before the screen routes to detail / grouped-review / detection. (Previously timers would race the real success — sometimes complete, sometimes mid-step.)
- AI failure: the loader freezes at row 1 instead of falsely showing "all done" after 8.5s. Error block then takes over.
- "5–10 seconds" text now translates per locale.

**Verification:**
- `tsc --noEmit` clean across workspace.
- `jest` → **71/71 passing**. No test changes — the bug fixed was a UX lie, not a logic one.
- All 4 locale JSONs verified parse + new keys (`mobile.processing.timeEstimate`, `mobile.detection.truncatedNote`) present.

### Phase 4 — final QA pass + flag audit ✅ (complete, awaiting device matrix)

**Date:** 2026-05-28
**Status:** automated audits clean; consolidated device QA checklist below for owner sign-off (cannot run on-device from this environment).

#### 4.1 Translation completeness audit

Ran a Node-side key-presence check across all 4 locale JSONs against the full Phase 1/2/3 key set:

| Locale | Result |
|---|---|
| EN | OK (24 / 24 keys) |
| ZH | OK (24 / 24 keys) |
| JA | OK (24 / 24 keys) |
| TH | OK (24 / 24 keys) |

Keys verified (24 total): all `mobile.staged.*` (13), all `mobile.detection.*` (9 — including `truncatedNote` now seeded per Phase 3 reviewer suggestion), and `mobile.processing.timeEstimate`. The legacy `mobile.processing.subtitle` is retained — see §4.3 below.

To re-run after future locale edits:
```bash
node -e "
const keys = [ /* 24 keys */ ];
const dig = (o, p) => p.split('.').reduce((a, k) => a && a[k], o);
['en','zh','ja','th'].forEach(l => {
  const j = require('./src/i18n/locales/'+l+'.json');
  const missing = keys.filter(k => dig(j, k) == null);
  console.log(l, missing.length ? 'MISSING: '+missing.join(', ') : 'OK');
});
"
```

#### 4.2 `SMART_DETECT_ENABLED=false` legacy path audit

Four production callsites read the flag (excluding `flags.ts` itself and the `scanResume.test.ts` test file); verified each preserves pre-Phase-1 behavior:

| Callsite | Flag-on behavior | Flag-off behavior |
|---|---|---|
| [scanResume.ts:9](GreenBridgeApp/src/lib/scanResume.ts:9) | `freshScanRoute = scanCamera` | `freshScanRoute = scanListingMethod` |
| [(tabs)/index.tsx:77-95](GreenBridgeApp/app/(tabs)/index.tsx:77) | Resume via `getScanResumeRoute` | Falls through to `push(scanListingMethod)` |
| [scan/camera.tsx:209-231](GreenBridgeApp/app/scan/camera.tsx:209) | Single → `setPendingPhotos` + staged | Single → `start()` + processing (legacy) |
| [scan/processing.tsx:60](GreenBridgeApp/app/scan/processing.tsx:60) | `useSmart = true` → smart-detect + skip predicate + (skip ? apply : detection) | `useSmart = false` → analyze branch |

Net: under `EXPO_PUBLIC_SMART_DETECT=0`, the staged + detection screens become unreachable and the original single+analyze and grouped+analyze flows run unchanged. The new code is dead-but-harmless and continues to compile and lint clean.

**Edge case noted, not a bug:** if a user has stale `pendingPhotos` from a previous flag-on session and the flag is then disabled, tapping the Scan tab routes to `scanStaged` (via `getScanResumeRoute`'s `pendingPhotos` branch which doesn't read the flag). The staged screen still functions — `start()` → processing → analyze runs the legacy single path. Home's "Scan" button does NOT go through this path under flag-off, so the only way to hit staged in a flag-off build is via the Scan tab + pre-existing pending state. Acceptable.

#### 4.3 `mobile.processing.subtitle` vs `mobile.processing.timeEstimate` divergence

Both keys now exist with the same content ("5–10 seconds"). To prevent silent drift if a future copy change forgets one:

- **`mobile.processing.timeEstimate`** — used by [processing.tsx:403](GreenBridgeApp/app/scan/processing.tsx:403) in the **loader path** (`isPending || isNavigating`). This is the live, user-facing waiting hint.
- **`mobile.processing.subtitle`** — used by [processing.tsx:474](GreenBridgeApp/app/scan/processing.tsx:474) in the **error/idle fallback render** (when the mutation has finished and an error block is showing). The "5–10 seconds" text is arguably wrong copy for an idle/error state, but reworking that legacy render is out of Phase 4 scope.

**Recommendation for follow-up (deferred):** either repurpose `subtitle` for the error/idle state with appropriate copy, or delete the fallback subtitle line entirely now that the error block has its own copy. Flag for a future Phase 5 polish if needed.

#### 4.4 Consolidated device QA checklist

Owner runs this checklist on iOS + Android against a `SMART_DETECT_ENABLED=1` build before declaring web-parity ship-ready. Each row covers a flow that exercises code from one or more phases.

##### A. Smart-detect single funnel (the new web-parity flow)

| # | Steps | Expected | iOS | Android |
|---|---|---|---|---|
| A1 | Home → Scan button → camera → capture 1 photo → Next | Lands on `staged` (not processing). Recent uploads visible. | ☐ | ☐ |
| A2 | Staged → Start AI | Processing screen → if AI sees 1 product, skips detection → detail. | ☐ | ☐ |
| A3 | Staged → Add more (gallery) | `expo-image-picker` opens, multi-select works, new photos appended with thumbnails. | ☐ | ☐ |
| A4 | Staged → Retake → camera returns | Existing pile preserved on capture strip; new shot appends. | ☐ | ☐ |
| A5 | Staged → Clear all → Alert → Discard | Returns to camera with empty strip. | ☐ | ☐ |
| A6 | Staged thumb ✕ on a photo | That photo is removed; zoom modal does NOT open. | ☐ | ☐ |
| A7 | Staged thumb body tap | Full-screen `PhotoZoomViewer` opens; pinch / swipe / close works. | ☐ | ☐ |
| A8 | Capture 8+ photos of distinct items → Start AI | Processing → detection screen with default "Multi" selected. Thumb strips visible per group. | ☐ | ☐ |
| A9 | Detection → pick Single → Continue | Detail screen with pooled photos (mergedSingle), not just products[0]'s slice. | ☐ | ☐ |
| A10 | Detection → pick Multi → Continue | grouped-review screen with N items. | ☐ | ☐ |
| A11 | Detection → Back | Lands on staged with photos intact. Tap Start AI again → re-mutates cleanly. | ☐ | ☐ |
| A12 | Detection → Back → edit photos on staged → Start AI | Fresh mutation runs (pendingDetection was cleared by setPendingPhotos). No stale grouping. | ☐ | ☐ |
| A13 | Trigger AI failure (airplane mode mid-mutate) | Loader freezes at row 1 (does NOT cascade to "all done"). Error block shows with Retake / Continue without AI. | ☐ | ☐ |
| A14 | Successful run | Tight 4-step checkmark cascade right before screen routes to next surface. | ☐ | ☐ |

##### B. Resume & persistence

| # | Steps | Expected | iOS | Android |
|---|---|---|---|---|
| B1 | Mid-staging → background app → return | All `pendingPhotos` still present. Photos render. | ☐ | ☐ |
| B2 | Mid-staging → kill app → relaunch → Scan tab | Lands on staged with `pendingPhotos` restored (MMKV). | ☐ | ☐ |
| B3 | Mid-staging → Home tab → Home Scan button | Returns to staged (resume), not a fresh camera. | ☐ | ☐ |
| B4 | Mid-detection → background app → return | Stays on detection (in-memory `pendingDetection` survives JS stay-alive). | ☐ | ☐ |
| B5 | Mid-detection → kill app → relaunch → Scan tab | Lands on `staged` (pendingDetection is memory-only, lost on cold start). User can re-run AI manually. | ☐ | ☐ |
| B6 | In detail mid-edit → Scan tab tap | Silent resume to detail (current draft preserved). No prompt. | ☐ | ☐ |
| B7 | Grouped queue has 2+ items + a current draft → Scan tab tap | Alert: "Continue your draft?" with Discard / Continue. Discard wipes; Continue routes correctly. | ☐ | ☐ |
| B8 | Type rapidly in detail form, then tap "Review group" | All keystrokes saved (debounce flush works); promoted queue item carries the latest title. | ☐ | ☐ |

##### C. Manual grouped (legacy per-item flow — must remain unchanged)

| # | Steps | Expected | iOS | Android |
|---|---|---|---|---|
| C1 | Home → "List one by one" → camera → capture → Next | Routes to **processing** (NOT staged). Per-item analyze runs. | ☐ | ☐ |
| C2 | After detail save → "Add another" → camera | New blank item; queue contains prior. | ☐ | ☐ |
| C3 | After several items → "Review group" | grouped-review with N items. | ☐ | ☐ |
| C4 | Edit a queued item in grouped-review | Promotes to current; on save → enqueues back into queue with edits intact. | ☐ | ☐ |
| C5 | No staged screen ever appears in this flow | Direct verification. | ☐ | ☐ |

##### D. Translation completeness (visual)

| # | Steps | Expected | iOS | Android |
|---|---|---|---|---|
| D1 | Switch to ZH → walk staged + detection + processing | All strings translated, no English fallback. | ☐ | ☐ |
| D2 | Switch to JA → same walk | Same. | ☐ | ☐ |
| D3 | Switch to TH → same walk | Same. | ☐ | ☐ |
| D4 | Force `truncatedNote` (>10 AI products if backend permits) | Warning line appears below summary in current locale. | ☐ | ☐ |

##### E. Flag-off legacy path (`EXPO_PUBLIC_SMART_DETECT=0`)

| # | Steps | Expected | iOS | Android |
|---|---|---|---|---|
| E1 | Home → Scan button | Routes to **listing-method** picker. | ☐ | ☐ |
| E2 | listing-method → Single → camera → capture → Next | Routes to **processing** (NO staged, NO detection). Analyze runs. | ☐ | ☐ |
| E3 | listing-method → Grouped → camera → per-item flow | Unchanged manual grouped behavior. | ☐ | ☐ |
| E4 | Scan tab tap with no prior state | Routes to listing-method (freshScanRoute). | ☐ | ☐ |
| E5 | Slow network simulation through analyze | No regression in legacy single flow. | ☐ | ☐ |

##### F. Slow-network smoke

| # | Steps | Expected | iOS | Android |
|---|---|---|---|---|
| F1 | Throttle to 3G → Start AI on staged | Loader stays on row 1 active throughout; "Still working — large photos can take up to 2 minutes" message appears after 30s. | ☐ | ☐ |
| F2 | Same → mutation succeeds eventually | Cascade fires, navigation completes. | ☐ | ☐ |
| F3 | Same → mutation aborts (background) | Cancels cleanly via AbortController; resume routes to staged. | ☐ | ☐ |

### Phase 5 — UI Ruleset Alignment, must-fix polish ✅ (complete, awaiting device QA Section G)

**Date:** 2026-05-28
**Status:** all five subtasks landed; `tsc --noEmit` clean; **71/71 jest passing**; locale audit OK (24/24 × 4 locales). Behavior unchanged; UX is now ruleset-compliant for haptics, motion accessibility, and a11y announcement.

**Pre-flight (per Part II §22) — all green at commit time:**
- `@gorhom/bottom-sheet ^5.2.14`, `expo-haptics ~56.0.3`, `react-native-reanimated 4.3.1` present in `package.json`.
- `useReducedMotion` exported by Reanimated — verified in `node_modules/react-native-reanimated/lib/typescript/index.d.ts`.
- `haptics` wrapper at [src/lib/haptics.ts](GreenBridgeApp/src/lib/haptics.ts) exposes `tap` / `impact` / `heavy` / `success` / `warning` / `error`.
- Button primitive already does Light impact on press — Continue / Start AI CTAs are unchanged.

| Subtask | File(s) | Notes |
|---|---|---|
| 17.1 Selection haptic on detection radios | [detection.tsx:43-54,160,168](GreenBridgeApp/app/scan/detection.tsx:43) | New `pickChoice(next)` helper: `if (next === choice) return; haptics.tap(); setChoice(next);`. Both `DetectionGroupCard.onSelect` callsites switched to `pickChoice`. No double-tick on re-tapping active card. |
| 17.2 Success haptic on detection Continue | [detection.tsx:103-105](GreenBridgeApp/app/scan/detection.tsx:103) | `haptics.success()` placed AFTER `await applySmartDetection` resolves and BEFORE `router.replace`. Catches that throw bypass it (covered by 17.3). |
| 17.3 Error haptic on detection apply failure | [detection.tsx:112-113](GreenBridgeApp/app/scan/detection.tsx:112) | `haptics.error()` in `onContinue`'s catch block, BEFORE `Alert.alert` so screen-reader / no-look users get the cue first. |
| 17.3 Error haptic on processing smart `onError` + apply catch | [processing.tsx:333,347-349](GreenBridgeApp/app/scan/processing.tsx:333) | `haptics.error()` in both the apply-error try/catch (mapped result couldn't apply) AND the bare `onError` (network/abort). Comments note that AbortController abort fires `onError` too and the cancel-haptic is accepted as theatre in v1. |
| 17.3 Error haptic on processing legacy analyze `onError` | [processing.tsx:374-376](GreenBridgeApp/app/scan/processing.tsx:374) | Same `haptics.error()` pattern for the `SMART_DETECT_ENABLED=false` legacy analyze branch. |
| 17.4 `useReducedMotion` guard | [processing.tsx:23,69-72,80-89,153-156,205-216](GreenBridgeApp/app/scan/processing.tsx:23) | Imported `useReducedMotion` from `react-native-reanimated`. Added `const reducedMotion = useReducedMotion()`. Guarded all three animation `useEffect`s: entrance/dot/pulse (snap rows + dot to "done", skip loops), laser sweep (skip the loop, set value 0), checkmark cascade on success (snap all four scales to 1 + `setCurrentStep(4)` — ONE PAST last row id so every row reads as completed; an earlier draft used `(3)` which left row 4 stuck active). All three effects have `reducedMotion` added to dep arrays. |
| 17.5 `accessibilityLiveRegion="polite"` | [processing.tsx:551-558](GreenBridgeApp/app/scan/processing.tsx:551) | Wrapped error `<Stack>` in a `<View accessibilityLiveRegion="polite" accessibilityRole="alert">`. Stack doesn't pass through accessibility props, so the outer View owns the announcement. Live region only mounts when `showError` is true → no duplicate announces. |

**Observable user-facing changes (under `SMART_DETECT_ENABLED=true`):**
- Detection radio tap → soft selection haptic on each toggle; re-tapping the already-selected card is silent.
- Detection Continue (success) → success notification haptic right before navigation.
- Detection Continue / processing AI failure / processing apply failure → error notification haptic preceding the error UI.
- iOS Reduce Motion / Android Remove Animations → processing screen stops looping animations and shows static "done" state on success.
- VoiceOver / TalkBack → error block content is announced when it appears.

**Edge cases logged (per §21 risk register):**
- **5.3 / risk row:** AbortController abort on background-resume fires the error haptic. Accepted as theatre in v1; revisit by adding `controller.signal.aborted` check if device QA flags it.
- **5.4 / risk row:** Reanimated `useReducedMotion` returns `false` on simulators where the OS setting isn't toggled — must test on real device.

**Verification:**
- `tsc --noEmit` → clean.
- `jest` (full suite) → **71/71 passing**, no test changes needed (behavior unchanged).
- Locale audit (Part I §4.1 script) → 24/24 keys across all 4 locales.

**Manual smoke matrix to run on device (Part II §23 Section G):**
- [ ] G1: Detection radio taps trigger soft selection haptic; no double-tick on re-tap of active.
- [ ] G2: Detection Continue (success) → success notification haptic right before nav.
- [ ] G3: Detection Continue (forced apply failure) → error notification haptic before Alert opens.
- [ ] G4: Smart-detect AI failure (airplane mode mid-mutate) → error notification haptic when error block appears.
- [ ] G5: Reduce Motion ON → processing screen holds static state, no loops.
- [ ] G6: VoiceOver / TalkBack ON → trigger AI failure → error block content announced.

### Phase 6 — Cosmetic primitives ✅ (partial — 18.1 + 18.3 complete; 18.2 deferred with rationale)

**Date:** 2026-05-28
**Status:** §18.1 (Button on chips) and §18.3 (motion token) shipped; §18.2 (Card on detection cards) deferred with logged rationale. `tsc` clean; **71/71 jest passing**.

**Pre-flight finding (BLOCKING for §18.2, recorded here for Part II §16 token-fork row):**

The project has a **two-palette fork** the §16 audit already flagged:
- `src/theme/colors.ts` exports `colors.primary = '#14452f'` (Deep Forest) — consumed by scan files via `@/theme`.
- `src/constants/theme.ts` exports `colors.primary` as a 50-900 shade scale (`#10B981` Marketplace Emerald) — consumed by the UI primitives (Button/Card/Text) via `tailwind.config.js`.

The Button primitive's `ghost` variant resolves text tone to `text-primary-600 = #059669` (emerald). The DetectionGroupCard selected-state uses `colors.primary = #14452f` (deep forest) for border + `colors.primarySurface = #e6f2eb` (light forest tint) for background. Swapping DetectionGroupCard to `<Card variant={selected ? 'elevated' : 'outlined'}>` would shift the **selection-state palette** from deep-forest to emerald — visible UX change, not pure cosmetic. Deferred until the broader token migration tracked in `UiUpdateRuleset/core_plan.md §1` lands; at that point the palette unification removes the choice.

| Subtask | File(s) | Notes |
|---|---|---|
| 18.1 Swap staged Add more / Retake → `<Button>` | [staged.tsx:24-30,201-218,290-305](GreenBridgeApp/app/scan/staged.tsx:24) | Both chips → `<Button variant="ghost" size="sm" leftIcon={...}>`. Import added: `import { colors as rulesetColors } from '@/constants/theme'` with an explanatory comment about the token-fork (icon `color={rulesetColors.primary[600]}` matches the Button's brand text tone). `loading={importing}` replaces the inline `<ActivityIndicator>`. Unused `actionChip` / `actionChipDisabled` / `actionLabel` styles removed. Unused `ActivityIndicator` import removed. Net win: chips now inherit Reanimated scale + Light haptic + a11y from the Button primitive; previously had none. Touch target grows from ~36-40px to 48px (more §17-compliant). |
| 18.2 Wrap `DetectionGroupCard` body in `<Card>` | n/a | **Deferred.** Rationale above. Will land when the project resolves the two-palette fork; until then the manual `Pressable + View` styling on `DetectionGroupCard` retains the deep-forest selection signal. Logged also in §16 row "Token path mismatch — 🔴". |
| 18.3 Replace raw `STAGGER_MS = 120` with `motion.micro` | [processing.tsx:17-20,214-217](GreenBridgeApp/app/scan/processing.tsx:17) | Imported `motion as rulesetMotion` from `@/constants/theme`. `STAGGER_MS = rulesetMotion.micro` (150ms — 30ms more than the prior raw 120ms, imperceptible). Comment locks the source-of-truth in place. |

**Observable user-facing changes:**
- Staged Add more / Retake chips: light haptic on press + subtle scale animation (Button primitive default). Touch target grows ~10px taller. Disabled state during import shows ActivityIndicator inside the Button instead of next to the icon. Layout below the action row shifts down by ~10px.
- Processing checkmark cascade: 30ms slower stagger (180ms→480ms total instead of 360ms total). Imperceptible.
- DetectionGroupCard: **no change** (§18.2 deferred).

**Verification:**
- `tsc --noEmit` → clean.
- `jest` → **71/71 passing**.
- Locale audit → 24/24 across 4 locales (no key changes).

**Manual smoke to run on device (Section G7):**
- [ ] Staged Add more tap → light haptic + scale animation; importing state shows spinner inside the chip.
- [ ] Staged Retake tap → light haptic + scale; existing photo strip preserved on camera mount-hydrate.
- [ ] Processing success cascade still feels tight (~480ms total).

### Phase 7 — Bottom-sheet replacement ✅ (complete, awaiting device QA Section G8)

**Date:** 2026-05-28
**Status:** §19.1 landed. `tsc` clean; **71/71 jest passing**; locale audit OK (4 / 4 locales already had the reused keys, no new keys needed).

**Pre-flight findings:**
- `BottomSheetModalProvider` + `GestureHandlerRootView` ARE wrapped at root ([_layout.tsx:103-104](GreenBridgeApp/app/_layout.tsx:103)).
- **The project's `<Sheet>` primitive is intentionally NOT gorhom-based.** [Sheet.tsx:18-21](GreenBridgeApp/src/components/ui/Sheet.tsx:18) source: "gorhom bottom-sheet breaks under reanimated v4 — gorhom #2546/#2547". Built on RN `Modal` + RN `Animated` instead.
- Decision: use the existing `<Sheet>` primitive (same one consumed by `me_plan` / `home_plan` migrations) rather than raw gorhom. Plan §19.1 amended to reflect this.

| Subtask | File(s) | Notes |
|---|---|---|
| 19.1 Replace `Alert.alert` for Clear-all with `<Sheet>` | [staged.tsx:15,33-35,84-99,261-302,331-365](GreenBridgeApp/app/scan/staged.tsx:15) | New `clearSheetOpen` state. `onClearAll` now fires `haptics.warning()` (§12 "destructive intent: opening a 'Sign out' / 'Delete' sheet") + opens the sheet. Two action callbacks: `onConfirmClearAll` fires `haptics.heavy()` (§12 "irreversible confirm") then clears + routes; `onCancelClearAll` just closes. The sheet renders two custom Pressables — destructive row (red text + Trash2 icon in `colors.destructive`) and a neutral Cancel row. Four new local styles for the sheet rows. `Alert.alert` still used elsewhere in the file for true error notifications (gallery permission, import-failed, save-failed) where a sheet would be overkill. |

**Observable user-facing changes:**
- Tap "Clear all" → warning haptic + a bottom sheet rises with the confirm question and two action rows. Native iOS Alert no longer appears.
- Tap "Remove all photos" in the sheet → heavy haptic + sheet dismisses + photos cleared + camera screen.
- Tap "Cancel" or outside the sheet → sheet dismisses silently, photos preserved.
- Visual: matches the rest of the migrated app (`me_plan` / `home_plan` use the same `<Sheet>` primitive).

**Edge cases logged:**
- Sheet is hand-rolled on RN `Modal` — Android back button is wired via `onRequestClose` in the primitive, so hardware back closes the sheet as expected.
- `snapTo={280}` is a pixel height (not "60%" which would be too tall for two rows) — verified Sheet supports `string | number` per [Sheet.tsx:31](GreenBridgeApp/src/components/ui/Sheet.tsx:31).
- `Alert` import retained — still used by 3 error paths (gallery permission, import failure, save failure).

**Verification:**
- `tsc --noEmit` → clean.
- `jest` → **71/71 passing**.
- Locale audit (reused keys) → all 4 locales already have `mobile.staged.clearAll` / `mobile.staged.clearConfirm` / `mobile.common.cancel`. No locale changes.

**Manual smoke (G8 from §23 Section G):**
- [ ] Staged Clear-all tap → warning haptic + sheet rises.
- [ ] Tap Remove all photos → heavy haptic + sheet dismisses + camera.
- [ ] Tap Cancel → sheet closes silently, photos still on staged.
- [ ] Tap outside (backdrop) → sheet closes silently.
- [ ] Hardware back (Android) → sheet closes silently.

### Phase 9 — Staged screen removed per product call ✅ (complete)

**Date:** 2026-05-28
**Status:** Phase 1's central deliverable (the staged review screen between capture and AI) reversed per product decision. Capture now flows **camera → processing directly** for all paths; no intermediate review surface. `tsc` clean; **65/65 jest passing** (was 71; net −6 = removed 3 staged scanResume tests + 3 demoteCurrentToPending tests). All 4 locales cleaned of `mobile.staged.*` keys.

**Product context:** the staged screen tested poorly in actual use — users wanted to start AI immediately after capture, not pause on a review-the-pile surface (the recent-uploads tail mostly duplicated what's on Home). User call: "after scan capture just AI analyzation start."

**Detection screen Back behavior** (with no staged to demote to): chose **option 1** from the menu offered in chat — `reset()` + `replace(scanCamera)`. Discards the captured pile and detection result; user can recapture. Rejected: option 2 (back-disabled) as too restrictive, option 3 (re-mutate) as expensive.

| Subtask | File(s) | Notes |
|---|---|---|
| Camera `onNext` collapsed to single branch | [camera.tsx:191-204](GreenBridgeApp/app/scan/camera.tsx:191) | All paths (grouped, smart-detect single, flag-off legacy) now `await start(photos); push(scanProcessing)`. Removed the smart-detect-single branch that went via `setPendingPhotos + push(scanStaged)`. Also dropped the `SMART_DETECT_ENABLED` import (no longer referenced in this file). |
| Camera mount-hydrate effect removed | [camera.tsx](GreenBridgeApp/app/scan/camera.tsx) | The 11-line `useEffect` that restored `pendingPhotos` into the local capture strip was only needed to support staged-Retake. Removed; also dropped the `useEffect` import. |
| Detection Back rewired | [detection.tsx:85-93](GreenBridgeApp/app/scan/detection.tsx:85) | Was: `demoteCurrentToPending()` + `replace(scanStaged)`. Now: `reset()` + `replace(scanCamera)`. Detection screen no longer needs `pendingPhotos` fallback in `sourcePhotos`. |
| Detection defensive-redirect | [detection.tsx:64-69](GreenBridgeApp/app/scan/detection.tsx:64) | `!pendingDetection` case now `replace(scanCamera)` (was `scanStaged`). |
| Detection empty-photos fallback | [detection.tsx:96-100](GreenBridgeApp/app/scan/detection.tsx:96) | `onContinue` with `sourcePhotos.length === 0` now `reset()` + `replace(scanCamera)` (was `scanStaged`). |
| Files deleted | [app/scan/staged.tsx], [src/components/scanner/StagedPhotoGrid.tsx] | Both removed entirely. |
| `scanStaged` route removed | [routes.ts:10](GreenBridgeApp/src/lib/routes.ts:10) | Single line dropped. |
| `getScanResumeRoute` cleaned | [scanResume.ts](GreenBridgeApp/src/lib/scanResume.ts) | Dropped the `pendingPhotos → scanStaged` branch and the `pendingPhotos?` field on `ScanResumeState`. `Photo` import dropped. Updated both callsites: `(tabs)/index.tsx#startScan` + `(tabs)/scan.tsx`. |
| `demoteCurrentToPending` removed from store | [scanDraftStore.ts](GreenBridgeApp/src/stores/scanDraftStore.ts) | 14-line helper + its type declaration removed. Only consumer (detection Back) no longer needs it. `pendingPhotos` / `setPendingPhotos` / `clearPendingPhotos` retained — still referenced by `reorder-photos.tsx` (unreachable code path, but compiles) and `persistPhotos.ts#verifyScanSessionFiles`. |
| Locale cleanup | [en.json](GreenBridgeApp/src/i18n/locales/en.json), zh, ja, th | All 13 `mobile.staged.*` keys removed from each of the 4 locales. Confirmed via Node audit: `staged` block absent in all 4 files. |
| Tests | [scanResume.test.ts](GreenBridgeApp/src/lib/__tests__/scanResume.test.ts), [scanDraftStore.test.ts](GreenBridgeApp/src/stores/__tests__/scanDraftStore.test.ts) | scanResume: removed 3 tests (staged-branch happy path, empty pendingPhotos, current-wins-over-pendingPhotos); rewrote precedence test. scanDraftStore: removed entire `demoteCurrentToPending` describe block (3 tests). Net −6 tests; suite total 71 → 65. |

**Observable user-facing changes:**
- Capture → tap Next → processing screen (no staged review).
- Detection Back → fresh camera with the prior draft cleared (vs. before: back to staged).
- Scan-tab tap with stale `pendingPhotos` from an older build → falls through to `freshScanRoute` (camera or listing-method depending on flag) instead of routing to a deleted screen.

**Side effects worth knowing:**
- `pendingPhotos` field + `setPendingPhotos` / `clearPendingPhotos` / MMKV `PENDING_PHOTOS_KEY` still exist in the store. They were referenced by `reorder-photos.tsx` (non-edit mode) — a route that's now unreachable from production code but the code compiles fine. Leaving it for a future cleanup pass (not blocking).
- §16 audit rows are mostly unaffected — staged was a target, not a precondition.
- Web-parity claim is now narrower: detection picker still matches web, but the staged review step is mobile-specific-skipped. Honest framing: "camera-first variant of the web flow."

**Verification:**
- `tsc --noEmit` → clean.
- `jest` → **65/65 passing**.
- Locale audit → 11 / 11 keys (detection + processing) × 4 locales; `mobile.staged.*` absent.

**Manual smoke (new Phase 9 device matrix — add to §4.4 Section A as overrides):**
- [ ] Smart-detect single: capture → Next → lands on **processing** (not staged).
- [ ] Manual grouped: unchanged behavior.
- [ ] Flag-off single: unchanged behavior.
- [ ] Detection Back: → fresh camera, prior draft cleared.
- [ ] Scan tab tap during in-progress draft: resume still works (no staged route to misfire).

### Phase 10 — Scan entry points flush-always per product call ✅ (complete)

**Date:** 2026-05-28
**Status:** `tsc` clean; **92/92 jest passing**.

**Product context:** the resume-aware Scan launchers (added in Phase 1 + tightened in subsequent reviews) tested poorly. Users complained that re-tapping Scan after backing out of detail kept the prior form values populated — they expected a fresh start. User call: "go to cam every time; later will add the draft option."

**Behavior change:**
- **Before:** `(tabs)/index.tsx#startScan` and `(tabs)/scan.tsx` called `getScanResumeRoute(...)` to land the user where they left off. `current` draft, `queuedItems`, and `pendingDetection` survived between Scan taps. Scan tab also showed a "Continue your draft?" Alert when grouped queue items would be lost.
- **After:** both entry points unconditionally call `useScanDraft.getState().reset()` then route to the fresh-scan target (`scanCamera` under `SMART_DETECT_ENABLED`, `scanListingMethod` otherwise). No prompt, no precedence tree. Each tap is a fresh session.

| Subtask | File(s) | Notes |
|---|---|---|
| Home `startScan` flush | [app/(tabs)/index.tsx:77-91](GreenBridgeApp/app/(tabs)/index.tsx:77) | `useScanDraft.getState().reset(); push(scanCamera | scanListingMethod);`. Dropped `getScanResumeRoute` import. Comment explains the future-drafts-surface plan. |
| Scan tab flush | [app/(tabs)/scan.tsx](GreenBridgeApp/app/(tabs)/scan.tsx) | Rewrote: `useFocusEffect` → `reset(); replace(fresh)`. Removed Alert + Translation imports + queued-discard prompt. File is now 26 lines (was 65). |
| `getScanResumeRoute` retained | [src/lib/scanResume.ts](GreenBridgeApp/src/lib/scanResume.ts) | Kept intact + tested. The planned drafts surface will be the new consumer of its precedence tree. No callsites today (a future drafts list view will reintroduce them). |
| `startManualGrouped` already resets | [app/(tabs)/index.tsx:97-103](GreenBridgeApp/app/(tabs)/index.tsx:97) | Unchanged — it already did `reset(); setListingMode('grouped'); push(scanCamera)`. Now consistent with the unified policy. |

**Observable user-facing changes:**
- Tap Scan from Home / Scan tab → camera mounts fresh every time. Any half-filled detail form, queued grouped items, or warm AI detection is gone.
- No "Continue your draft?" Alert anymore — silent flush.
- `pendingDetection` clears with `reset()`, so even within the same session, leaving detection → home → Scan starts over.

**Side effects worth knowing:**
- The "Use my location" auto-fill in `LocationCard` still works on the fresh camera-to-detail path — the LocationCard reads cached GPS / device location at mount.
- MMKV `scan.currentDraft` + `scan.pendingPhotos` keys are cleared by `reset()` on every Scan tap, so device restart doesn't restore a stale draft either.
- The planned **drafts surface** (not yet built) will need to: (a) list saved drafts, (b) reuse `getScanResumeRoute` to land the user on the right screen for a chosen draft, (c) NOT auto-trigger `reset()`. Suggest a separate route like `/scan/drafts` with explicit "resume" actions per row.

**Verification:**
- `tsc --noEmit` → clean.
- `jest` → **92/92 passing**. No test changes (entry points aren't unit-tested; the unit-tested `getScanResumeRoute` retained its behavior and tests).

### Phase 8 — DEFERRED (StyleSheet → NativeWind sweep blocked by spacing+radius token-fork)

**Date:** 2026-05-28
**Status:** Pre-flight aborted the implementation. Phase 8 cannot land safely without first resolving the token-fork between `@/theme` and `@/constants/theme`.

**Pre-flight finding (BLOCKER):**

The four target files (`staged.tsx`, `detection.tsx`, `StagedPhotoGrid.tsx`, `DetectionGroupCard.tsx`) currently import tokens from `@/theme` ([src/theme/spacing.ts](GreenBridgeApp/src/theme/spacing.ts), [src/theme/radius.ts](GreenBridgeApp/src/theme/radius.ts)) — the deep-forest "Stitch Industrial Marketplace" scale. **But [tailwind.config.js:1](GreenBridgeApp/tailwind.config.js:1) extends `spacing` and `borderRadius` from `@/constants/theme.ts`** — the marketplace-ruleset scale. The numeric values diverge significantly:

| Token | `@/theme` (used by current StyleSheet) | `@/constants/theme` (resolved by tailwind class) |
|---|---|---|
| `spacing.sm` | 6 px | 8 px |
| `spacing.md` | 8 px | 12 px |
| `spacing.lg` | **10 px** | **16 px** (60% increase) |
| `spacing.xl` | 12 px | 20 px (67% increase) |
| `spacing.2xl` | 14 px | 24 px |
| `spacing.3xl` | 16 px | 32 px |
| `radius.lg` | 8 px | 16 px (100% increase) |
| `radius.xl` | 10 px | 20 px |
| `radius.2xl` | 12 px | 24 px |

A naive class swap like `padding: spacing.lg` → `p-lg` would inflate every layout dimension by 60–100%. That is **not** a cosmetic polish — it is a wholesale visual rescale of the new flow. The plan's §20.2 mitigation ("class names that don't exist in tailwind config — verify and add") assumed the scales were equivalent; they're not.

**This is the same token-fork class blocker as Phase 6.2**, but broader — it affects spacing and radius, not just colors. The root cause is the same: the project is mid-migration between two theme paths, tracked under [UiUpdateRuleset/core_plan.md §1](GreenBridgeApp/Docs/UiUpdateRuleset/core_plan.md). Until that migration finishes, the StyleSheet blocks in the four target files are **internally consistent with their imported tokens** and are not actually broken — only inconsistent with the tailwind-class portion of the codebase.

**Three resolution paths, in priority order:**

1. **Wait for `core_plan.md §1`** to unify the scales (resolve the fork). Then Phase 8 becomes a clean class swap.
2. **Migrate the scan files' token imports first** — point staged/detection/grid/card at `@/constants/theme` directly. Will visually rescale the existing layouts; needs design sign-off per file.
3. **Use arbitrary-value tailwind classes** (`p-[10px]`, `rounded-[8px]`) to dodge the fork. Defeats §21 "no inline values" rule; just hides the StyleSheet block in className strings without gaining token consumption.

**No code shipped in Phase 8.** All four files retain their `StyleSheet.create` blocks unchanged.

**Audit deltas this defer triggers:**
- §16 row §21 ">200 lines smell on `staged.tsx`" → still 🟡, defer to whichever path resolves the token-fork (no longer specifically Phase 8).
- §27 Phase 8 done criteria amended below.

---

## 14. Roll-up summary (Phases 0–4)

**Status: web-parity port complete pending device QA sign-off.**

**Net deliverables:**
- 2 new screens: `scan/staged.tsx`, `scan/detection.tsx`
- 2 new components: `StagedPhotoGrid`, `DetectionGroupCard`
- 1 new util: `smartDetectionRouting.ts` (ported 1:1 from web)
- Store extensions: `pendingDetection`, `setPendingDetection`, `demoteCurrentToPending`, `applySmartDetection(..., forceMode?)`, debounced `persistSession`, dedup of identical queue helpers
- Resume extension: `getScanResumeRoute` covers `pendingDetection` (warm) + `pendingPhotos` branches
- Processing rewrite: smart-detect routing via `shouldSkipDetectionChoice`; animation pinned to mutation lifecycle (no more drift-past-outcome)
- Camera handoff: three-way branch (grouped → processing; smart single → staged; flag-off single → processing); mount-hydrate from `pendingPhotos`
- Entry-point wiring: `(tabs)/index.tsx` + `(tabs)/scan.tsx` both resume-aware via `getScanResumeRoute`
- 24 new translation keys across 4 locales (EN / ZH / JA / TH)
- **One** feature flag — `SMART_DETECT_ENABLED` already gated the funnel; no new flags added

**Automated verification:**
- `tsc --noEmit` → clean across the workspace
- `jest` → **71 / 71 passing** across 5 suites:
  - `scanResume.test.ts` (14)
  - `scanDraftStore.test.ts` (18 — 14 Phase 0/0.1 + 4 Phase 2 forceMode)
  - `smartDetectionRouting.test.ts` (10)
  - `mapSmartDetection.test.ts` (29 — pre-existing 27 + 2 new meta cases)
  - (one duplicate suite via `_debug_bundle/` is counted by jest but identical to the canonical suite)

**Bugs caught & fixed during this work (mostly via pair-review):**
- Phase 0.1: debounced-patch race in `prepareGroupedReview` / `removeQueuedItem` / `editQueuedItem` / `updatePhotos`
- Phase 0.1: `updatePhotos` not clearing stale `pendingDetection`
- Phase 1.1: `compressPhoto` didn't return `sizeBytes` → staged meta showed `—`
- Phase 1.1: nested `Pressable` in `StagedPhotoGrid` could double-fire zoom + remove
- Phase 2.1: capped `products` vs raw `productCount` mismatch in detection card labels
- Phase 3: dead `startedForDraftRef = null` resets across all onError callbacks
- Phase 3: animation drifting past real mutation outcome (especially on failure)
- Phase 3: hardcoded "5–10 seconds" not localized

**Total: ~5 dev days as estimated.** Web parity achieved; manual grouped path untouched; legacy single+analyze path intact behind the flag.

**Deferred (out of scope of the parity port; some now picked up by Phase 5+ below):**
- ✅ Now planned (see §17 Phase 5 onward): haptics, `useReducedMotion`, accessibility live region, Button primitive consolidation, `<Sheet>` primitive replacing Alert (project's hand-rolled RN-Modal-based primitive, not gorhom direct — gorhom path rejected after pre-flight).
- 🔴 Deferred under token-fork: Card primitive on detection (color fork), StyleSheet→NativeWind sweep (spacing+radius fork). Both unblock when `core_plan.md §1` unifies the `@/theme` ↔ `@/constants/theme` scales.
- ⏳ Still deferred: `mobile.processing.subtitle` legacy fallback copy; photo reorder on staged (non-goal per §10); photo shuffle between detection groups (v2 non-goal); optimistic photo-set hash cache; telemetry events per §9; real-device QA matrix (§4.4 — owner responsibility).

---

# Part II — UI Ruleset Alignment (Phases 5+)

## 15. Scope shift

Phases 0–4 (Part I above) delivered **web feature parity**: the new flow works end-to-end and matches the seller web's screen sequence. Phases 5–8 (Part II below) bring those same screens into strict alignment with `react_native_marketplace_ruleset_v2.md` — haptics policy, animation accessibility, primitive consolidation, sheet usage, and class-based styling.

**Authority order** (per `UiUpdateRuleset/me_plan.md` convention): `react_native_marketplace_ruleset_v2.md` > `UiUpdate.md` > this plan.

**Hard boundary:** behavior of the smart-detect single funnel + manual grouped is FROZEN. No state-machine changes, no translation key churn, no `applySmartDetection` semantics changes. UI polish, animation hygiene, and primitive consolidation **only**.

**Surfaces in scope** (all shipped in Phases 0–4):
- `app/scan/staged.tsx`
- `app/scan/detection.tsx`
- `app/scan/processing.tsx` (only the parts I touched — animation effects, error block)
- `src/components/scanner/StagedPhotoGrid.tsx`
- `src/components/scanner/DetectionGroupCard.tsx`

---

## 16. Compliance audit (new flow only)

Every applicable rule from `react_native_marketplace_ruleset_v2.md` against the surfaces above. **"N/A"** the rule doesn't apply; **"✅"** already compliant; **"🟡"** polish needed (covered by a phase below); **"🔴"** deliberate deviation with rationale.

| § | Rule | New flow status | Notes |
|---|---|---|---|
| §2 | Stack lock (expo-image-picker, expo-image, lucide, i18n) | ✅ | Verified in `package.json`: `expo-image-picker ~56.0.13`, `@gorhom/bottom-sheet ^5.2.14`, `expo-haptics ~56.0.3`, `react-native-reanimated 4.3.1`. |
| §3 | Folder structure (`app/` routes pure; `features/` modules; `components/ui`) | ✅ | Routes in `app/scan/*`, components in `src/components/scanner/*`, util in `src/features/scanner/*`. No business logic in route files. |
| §4 | Tokens via theme module | ✅ | All four new files import from `@/theme`. No inline hex / px / fontSize. |
| §4 | Token path `@/constants/theme` (ruleset) vs `@/theme` (codebase) | 🔴 | Codebase has BOTH: `src/theme/colors.ts` (Deep Forest `#14452f`) for scan files, `src/constants/theme.ts` (Emerald shade scale `#10B981`) for UI primitives via tailwind. **This fork blocked Phase 6.2** (Card primitive swap would visually shift detection card selection palette from deep-forest to emerald). Resolved by the broader migration in `core_plan.md §1`; until then, scan files mix both via namespace imports where unavoidable (e.g. `staged.tsx` Phase 6.1, `processing.tsx` Phase 6.3). |
| §5 | Spacing from tokens only | ✅ | Phase 5 will verify no raw integer margins/padding crept in. |
| §6 | `<Text>` primitive with variant + tone | ✅ | Used throughout new files. |
| §7.1 | `<Button>` primitive (Reanimated scale + haptics) | ✅ | Used for Start AI + Continue + (since Phase 6.1) staged Add more / Retake chips. |
| §7.2 | `<Card>` primitive (flat/elevated/outlined) | 🔴 | `DetectionGroupCard` remains a hand-rolled `Pressable + View`. **Phase 6.2 deferred** because Card primitive consumes the marketplace-emerald palette via tailwind, which would shift the selected-state green from deep-forest `#14452f` → emerald `#10B981` (visible UX change). Will land when the `@/theme` ↔ `@/constants/theme` palette fork is resolved per `UiUpdateRuleset/core_plan.md §1`. |
| §7.3 | `<Input>` primitive | N/A | No form inputs in the new flow. |
| §7.4 | Other primitives (Badge / Sheet / Skeleton / EmptyState / Toast) | ✅ | Only `Sheet` relevant to the new flow — landed in Phase 7.1 via the project's hand-rolled `<Sheet>` primitive (RN Modal + Animated; deliberately not gorhom per the documented reanimated-v4 incompatibility in [Sheet.tsx:18-21](GreenBridgeApp/src/components/ui/Sheet.tsx:18)). |
| §8 | FlashList for lists >20 items | ✅ | Photos capped at `MAX_FILES = 20`; `RecentSubmissionsList` is `limit=5`. Wrap-flex grid is correct. |
| §9 | `expo-image` with placeholder + transition | 🟡 | `AppImage` wraps `expo-image` with `transition={200}`. `placeholder` (blurhash) **not set** — camera/gallery photos don't carry one. Deliberate; documented. |
| §10 | Motion tokens (`motion.tap/micro/short/medium/long`) | ✅ | Phase 6.3 swapped raw `STAGGER_MS = 120` for `rulesetMotion.micro` (150ms). |
| §10 | `useReducedMotion` guard on non-essential animations | ✅ | Phase 5.4 added `useReducedMotion` from Reanimated to all three animation effects in `processing.tsx`. |
| §11 | Bottom sheets via Gorhom v5 | ✅ | Phase 7.1 replaced staged's Clear-all `Alert.alert` with the project's `<Sheet>` primitive. **Note:** project's `<Sheet>` is intentionally NOT gorhom-based (RN Modal + Animated to dodge a documented reanimated-v4 incompatibility — see [Sheet.tsx:18-21](GreenBridgeApp/src/components/ui/Sheet.tsx:18)). Ruleset intent (sheet-not-modal) is satisfied. |
| §12 | Haptics policy | ✅ | Phase 5 added: selection on radio change (5.1), success on Continue resolve (5.2), error on AI / apply failure (5.3). Button primitive already covers Light impact on press. |
| §13 | Forms via RHF + zod | N/A | No forms in new flow. |
| §14 | TanStack Query for server state | ✅ | `useSmartDetect`, `useAnalyzeImages`, `useRecentSubmissions`. |
| §15 | Zustand + MMKV for client state | ✅ | `scanDraftStore` is zustand; `pendingDetection` memory-only by design. |
| §16 | Loading + empty + error on every async screen | ✅ | `RecentSubmissionsList` handles all three; processing has error block; staged auto-bounces when empty. |
| §17 | `accessibilityRole` + `accessibilityLabel` on every touchable | ✅ | Verified across all four new files. |
| §17 | Touch targets ≥ 48dp | ✅ | Button primitive enforces; thumb ✕ uses `hitSlop={8}`. |
| §17 | `accessibilityLiveRegion="polite"` on error announcements | ✅ | Phase 5.5 wrapped the processing error block in `<View accessibilityLiveRegion="polite" accessibilityRole="alert">`. |
| §17 | `useFontScale` (Dynamic Type) | N/A | Text primitive defers to OS by default; not overridden. |
| §18 | Memoize list items / handlers | ✅ | Stable keys; no FlashList rows. Detection cards are 2 — micro-opt not needed. |
| §19 | Dark mode | N/A | App doesn't ship dark mode yet (mobile not started; web is sidebar-only per memory). |
| §20 | Every user-facing string via `t()`, 4 locales | ✅ | 24 keys × 4 locales (§4.1). |
| §21 | NOT: FlatList / AsyncStorage / RN Image / inline values / `any` / Modal-for-sheets | ✅ | Confirmed across all four new files. |
| §21 | Component >200 lines is a smell | 🟡 | `staged.tsx` is ~280 lines. Not refusal-threshold. Was earmarked for Phase 8 with the StyleSheet sweep; **Phase 8 deferred** under spacing/radius token-fork (see Phase 8 entry in §13). Pick up after `core_plan.md §1` resolves the scales. |
| §22 | Always: tokens / primitives / Screen wrapper / a11y / FlashList / expo-image / reduced-motion | ✅ | Reduced-motion guard landed in Phase 5.4. Blurhash placeholder on `AppImage` remains a deliberate skip (camera-captured photos have no blurhash). |
| §24 | Verification checklist | ✅ | After Phase 5: Item 9 now passes (`useReducedMotion` guard on processing). Items 1–8 + 10 already passed pre-Phase-5. |

**Net findings (post Phase 5 + 6 + 7 + 8 pre-flight):** ✅ Phase 5 must-fix items (haptics ×3, useReducedMotion, accessibilityLiveRegion) — landed. ✅ Phase 6.1 (Button on chips) + 6.3 (motion token) — landed. 🔴 Phase 6.2 (Card on detection) — deferred under color token-fork. ✅ Phase 7 (Sheet replacing Alert, via project's hand-rolled Sheet primitive not gorhom) — landed. 🔴 Phase 8 (StyleSheet sweep) — **deferred** under spacing+radius token-fork (`@/theme` vs `@/constants/theme` scales differ 60–100%; naive swap = visual rescale, not polish). Both 6.2 and 8 unblock when `core_plan.md §1` unifies the theme paths.

---

## 17. Phase 5 — Must-fix polish (½ day)

Five concrete changes, each scoped to a single file, each independently revertable.

### 17.1 Selection haptic on detection radio cards

- **File:** `app/scan/detection.tsx`
- **Where:** the two `setChoice('single' | 'grouped')` callsites in `DetectionGroupCard.onSelect`.
- **What:** import `haptics` from `@/lib/haptics`. Call `haptics.tap()` inside `onSelect` ONLY when the chosen value differs from current `choice` (guard `if (next !== choice)` to avoid double-firing on re-tap of active card).
- **Rule:** §12 "Selection change → Selection". Wrapper uses `selectionAsync()`.

### 17.2 Success haptic on detection Continue

- **File:** `app/scan/detection.tsx`
- **Where:** `onContinue`, AFTER `applySmartDetection` resolves and BEFORE `router.replace`.
- **What:** `haptics.success()`.
- **Edge case:** must NOT fire if `applySmartDetection` throws — that path goes to Alert dialog (covered by 17.3).
- **Rule:** §12 "Success → Notification.Success".

### 17.3 Error haptic on AI failure + apply failure

- **Files:**
  - `app/scan/processing.tsx` — both smart-detect `onError` and apply-error catch.
  - `app/scan/detection.tsx` — `onContinue` catch block before `Alert.alert`.
- **What:** `haptics.error()`.
- **Edge case:** AbortController abort also fires `onError`. Accept the user-cancel haptic as theatre in v1; revisit if device QA complains by checking `controller.signal.aborted`.
- **Rule:** §12 "Error → Notification.Error".

### 17.4 `useReducedMotion` guard on processing animations

- **File:** `app/scan/processing.tsx`
- **Where:** four animation `useEffect`s — staggered entrance / breathing dot / bg pulse (line ~63), laser sweep (line ~138), checkmark cascade (line ~163).
- **What:**
  ```ts
  import { useReducedMotion } from 'react-native-reanimated';
  const reduced = useReducedMotion();
  ```
  At top of each animation effect:
  ```ts
  if (reduced) {
    rowEntrance1.setValue(1); /* ... set all to "done" */
    return;
  }
  ```
  For the cascade specifically, when `reduced`: set all four `checkScale*` to `1` immediately on `isSuccess` (no stagger).
- **Rule:** §10 + §24 item 9.
- **Manual smoke:** enable Reduce Motion in OS settings → processing screen holds static state, no loops.

### 17.5 Error block accessibility announce

- **File:** `app/scan/processing.tsx`
- **Where:** the error `<Stack>` block (around line 482).
- **What:** add `accessibilityLiveRegion="polite"` so screen readers announce the failure when it appears mid-screen.
- **Rule:** §17 "errors announced via `accessibilityLiveRegion='polite'`".

### 17.6 Re-run gates

- `npx tsc --noEmit` exits clean.
- `npx jest` reports **71 / 71 passing** (no behavior change → no test changes).
- Locale audit script in §4.1 reports 24 / 24 keys in all 4 locales.

---

## 18. Phase 6 — Cosmetic primitives (½ day, optional)

### 18.1 Swap staged Add more / Retake chips → `<Button>`

- **File:** `app/scan/staged.tsx`
- **Where:** the two custom `Pressable` chips with `actionChip` style.
- **What:** `<Button variant="ghost" size="sm" leftIcon={<Plus | RotateCcw />} label={...} onPress={...} />`. Delete unused `actionChip` / `actionChipDisabled` / `actionLabel` styles.
- **Why:** Button primitive provides Reanimated scale + Light haptic + a11y for free.
- **Risk:** layout pixel-shift. `<Button size="sm">` is `h-12 px-lg` (48px tall); current chips are ~36-40px. The larger touch target is more §17-compliant anyway.

### 18.2 Wrap `DetectionGroupCard` body in `<Card>` primitive

- **File:** `src/components/scanner/DetectionGroupCard.tsx`
- **Where:** outer `Pressable` with `card` / `cardSelected` / `cardPressed` styles.
- **What:** keep the `Pressable` for press target; wrap children in `<Card variant={selected ? 'elevated' : 'outlined'}>` and drop manual `card*` styles.
- **Risk:** Card primitive owns padding (`p-lg`) and `rounded-2xl` — verify visual parity. Both resolve to `16px` + `radius.xl` per theme.

### 18.3 Replace raw `STAGGER_MS = 120` with `motion.micro`

- **File:** `app/scan/processing.tsx`
- **What:** import `motion` from `@/theme`, use `motion.micro` (150). 30ms diff imperceptible.
- **Rule:** §10 motion timing table.

### 18.4 Re-run gates: same as Phase 5.

---

## 19. Phase 7 — Bottom-sheet replacement (½ day, optional)

### 19.1 Replace `Alert.alert` for Clear-all with the existing `<Sheet>` primitive

- **File:** `app/scan/staged.tsx`
- **Where:** `onClearAll`.
- **What:** use the project's `<Sheet>` primitive ([src/components/ui/Sheet.tsx](GreenBridgeApp/src/components/ui/Sheet.tsx)) with two custom action rows ("Remove all photos" destructive + "Cancel"). Two new state callbacks (`onConfirmClearAll`, `onCancelClearAll`) replace the inline Alert callback.
- **Rule:** §11 "All filters, action menus, item details, and pickers use sheets — not full-screen modals."
- **Pre-flight finding (verified before implementation):**
  - `BottomSheetModalProvider` + `GestureHandlerRootView` ARE wrapped at root in [app/_layout.tsx:103-104](GreenBridgeApp/app/_layout.tsx:103) — gorhom would work technically.
  - BUT the project's `<Sheet>` primitive is **deliberately NOT gorhom-based** — see [Sheet.tsx:18-21](GreenBridgeApp/src/components/ui/Sheet.tsx:18) source comment: "gorhom bottom-sheet breaks under reanimated v4 — gorhom #2546/#2547". The primitive uses RN `Modal` + RN `Animated` to dodge that bug. Per `me_plan.md` and `home_plan.md`, the rest of the migrated app uses this same `<Sheet>` primitive — using gorhom directly would diverge.
  - **Decision:** use `<Sheet>` primitive, not raw gorhom. Same UX outcome, consistent with the migrated parts of the app, avoids the documented incompatibility.
- **Translation:** reuse `mobile.staged.clearAll` + `mobile.staged.clearConfirm` + `mobile.common.cancel`. No new keys needed.

### 19.2 Re-run gates: same as Phase 5.

---

## 20. Phase 8 — StyleSheet → NativeWind sweep (1 day, optional, do last)

### 20.1 Files in scope
- `app/scan/staged.tsx` (~280 lines incl. ~90 lines StyleSheet)
- `app/scan/detection.tsx` (~180 lines incl. ~70 lines StyleSheet)
- `src/components/scanner/StagedPhotoGrid.tsx` (~115 lines incl. ~40 lines StyleSheet)
- `src/components/scanner/DetectionGroupCard.tsx` (~140 lines incl. ~80 lines StyleSheet)

### 20.2 Approach

Per `home_plan.md §1 "StyleSheet Elimination"` — fully delete each `StyleSheet.create` block, hoist into NativeWind className strings consuming theme tokens via tailwind config.

**Mitigation against visual regression:**
1. Convert ONE file at a time; screenshot before/after; eyeball-diff on device.
2. Keep `StyleSheet.create` blocks for one commit-cycle as a Git revert handle.
3. Pre-flight: grep every className used in the StyleSheets against `tailwind.config.js`. Add missing keys BEFORE deleting any StyleSheet.

### 20.3 Out-of-scope clean-ups discovered during the sweep
- Decompose `staged.tsx` if it stays >200 lines after class migration.
- Move `truncatedNote` negative-margin hack from styles to class-based layout.

### 20.4 Re-run gates: same as Phase 5, plus per-file visual smoke pass.

---

## 21. Cross-phase risk register

| Phase | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 5.1 | `haptics.tap()` fires on every render of the radio card | Low | Low | Inside `onSelect` only; guard `if (next !== choice)`. |
| 5.2 | Success haptic fires before apply throws → false "success" feel | Medium | Medium | Place AFTER `await applySmartDetection`; catch path handles error haptic. |
| 5.3 | Error haptic on user-initiated cancel via abort | Medium | Low | Accept as theatre in v1; address by `controller.signal.aborted` check if QA complains. |
| 5.4 | `useReducedMotion` returns `false` on emulators without OS setting toggled | Low | None | Real-device test only. |
| 5.5 | Live region announce fires on every render if it depends on render state | Low | Low | Error block only renders when `showError`; live region attached to that node so stable. |
| 6.1 | Button-size pixel shift compresses recent uploads section | Low | Low | Visual check; override container height via className if needed. |
| 6.2 | Card primitive `p-lg` differs from current padding | Very Low | None | Both = `16px`. |
| 6.3 | Motion token swap drifts cascade timing | Very Low | None | 30ms imperceptible. |
| 7.1 | Gorhom backdrop renders OVER sticky CTA bar | Medium | Low | Correct behavior — sheets render in own modal layer. |
| 7.1 | `BottomSheetModalProvider` not wrapped at root → crash | Medium | High | **Pre-flight check; if missing, root-layout change first.** |
| 8.x | Token class names missing in tailwind config → invisible elements | Medium | High | Pre-flight: grep every className against `tailwind.config.js`; add missing keys before deleting any StyleSheet. |

---

## 22. Pre-flight checks (run before starting any phase)

```bash
# 1. Verify deps
grep -E "@gorhom/bottom-sheet|expo-haptics|react-native-reanimated" package.json
# Expect all three present (verified ✅ at plan write time).

# 2. Verify haptics wrapper API
grep -E "tap|success|error" src/lib/haptics.ts
# Expect: tap, impact, heavy, success, warning, error.

# 3. Verify Button primitive haptic behavior
grep -A3 "if (haptic)" src/components/ui/Button.tsx
# Expect: Haptics.impactAsync(Light) on press.

# 4. Verify Reanimated useReducedMotion exported
grep "useReducedMotion" node_modules/react-native-reanimated/lib/typescript/index.d.ts

# 5. Verify GestureHandlerRootView + BottomSheetModalProvider at root (Phase 7 prereq)
grep -E "BottomSheetModalProvider|GestureHandlerRootView" app/_layout.tsx

# 6. Verify tailwind classes for Phase 8 exist
grep -E "px-lg|gap-md|rounded-2xl|h-14" tailwind.config.js
```

---

## 23. Test plan (Phases 5–8)

### Automated gates (must stay green)

| Suite | Must pass |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx jest` | 71 / 71 (no test changes expected for Phase 5) |
| Locale audit (§4.1) | 24 / 24 keys × 4 locales |

### Manual smoke matrix — Section G (append to §4.4)

| # | Steps | Expected | iOS | Android |
|---|---|---|---|---|
| G1 | Detection radio tap | Soft selection haptic per tap; no double-tick on active re-tap. | ☐ | ☐ |
| G2 | Detection Continue with valid apply | Success notification haptic right before nav. | ☐ | ☐ |
| G3 | Detection Continue with forced apply failure | Error notification haptic before Alert opens. | ☐ | ☐ |
| G4 | Smart-detect AI failure (airplane mode mid-mutate) | Error notification haptic when error block appears. | ☐ | ☐ |
| G5 | Reduce Motion ON → run processing | No looping animations; rows static. | ☐ | ☐ |
| G6 | VoiceOver/TalkBack ON → trigger AI failure | Error block content announced. | ☐ | ☐ |
| G7 (Phase 6) | Staged Add more / Retake tap | Scale + Light haptic on press. | ☐ | ☐ |
| G8 (Phase 7) | Staged Clear all tap | Bottom sheet rises; outside-tap dismisses; "Remove all" confirms + camera. | ☐ | ☐ |
| G9 (Phase 8) | Per-file visual diff after StyleSheet removal | No pixel regressions vs Phase-4 baseline. | ☐ | ☐ |

---

## 24. Rollback strategy

Each phase ships behind a single commit touching:
- **Phase 5:** 2 files (`processing.tsx`, `detection.tsx`) — revert reverts both haptics + reduced-motion.
- **Phase 6:** 3 files (`staged.tsx`, `DetectionGroupCard.tsx`, `processing.tsx`).
- **Phase 7:** 1 file + possibly `_layout.tsx`.
- **Phase 8:** 4 files, ONE commit per file. Visual regression on any → revert just that commit.

No flag-gating needed — all changes are UI-equivalent under both `SMART_DETECT_ENABLED=true` and `=false`.

---

## 25. Non-goals (Phases 5–8 explicit)

- ❌ Touch smart-detect routing state machine.
- ❌ Add or remove translation keys.
- ❌ Change `applySmartDetection` semantics (especially `forceMode`).
- ❌ Migrate `src/theme/` → `src/constants/theme/`.
- ❌ Implement dark mode.
- ❌ Add blurhash placeholders to `AppImage`.
- ❌ Convert staged thumb grid to FlashList.
- ❌ Refactor legacy listing-method or any `SMART_DETECT_ENABLED=false` surfaces.
- ❌ Touch `scan/detail.tsx` or `scan/grouped-review.tsx` — they have their own migration plans.

---

## 26. Open questions to confirm before coding Phase 5

1. **Abort-during-success-haptic edge case** — handle in v1 or defer? **Recommendation: defer.**
2. **Detection Back haptic?** §12 doesn't define one for back; recommendation: silent.
3. **Selection vs Medium-impact haptic on radio cards** — §12 says Selection. **Recommendation: `haptics.tap()` (selectionAsync).**

---

## 27. Done criteria (per phase)

- **Phase 5 done when:** 17.1–17.5 land, gates pass, G1–G6 ticked on iOS + Android. ✅ code complete; device matrix awaits sign-off.
- **Phase 6 done when:** 18.1 + 18.3 land **and** 18.2 either lands or is explicitly deferred under a logged blocker (e.g. token-fork). G7 ticked, no visual regressions. ✅ partial: 18.1 + 18.3 landed; 18.2 deferred under §16 token-fork row; G7 awaits device matrix.
- **Phase 7 done when:** 19.1 lands (via project's `<Sheet>` primitive — the gorhom-direct path was rejected after pre-flight surfaced a documented reanimated-v4 incompatibility), G8 ticked, no regressions in other Sheet-using screens. ✅ code complete; device matrix awaits sign-off.
- **Phase 8 done when:** each of 4 files has its StyleSheet block removed and a per-file visual diff signed off (G9). 🔴 **Deferred** under spacing/radius token-fork (`@/theme` vs `@/constants/theme` scales differ 60–100% on `lg`/`xl`/`2xl`). Pick up after `core_plan.md §1` resolves the scales, OR after explicit design sign-off on migrating the scan files' token imports first. See §13 Phase 8 entry.

**Recommended ship order:** Phase 5 → release wave → Phase 6 → Phase 7 → Phase 8 (each independent ship).
