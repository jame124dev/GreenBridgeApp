# Interactivity upgrade — input fields & gallery

**Goal:** make the seller-facing flow feel solid and tactile by replacing hand-rolled inputs/carousels with battle-tested libraries — focused on two areas the user called out: **form input fields** and the **photo gallery**. Keep changes additive; reuse the gesture/animation infra already in the stack.

**Status:** 🟡 All three batches implemented in code (keyboard-controller, `expo-image`, REQUIRED-bar fix, tap-to-zoom viewer, drag-to-reorder, currency input) — **pending dev-client rebuild + on-device verification**. See [§7 Implementation progress](#7-implementation-progress). Companion docs: [SCANNER_FLOW.md](./SCANNER_FLOW.md), [CAMERA_WHATSAPP_REDESIGN.md](./CAMERA_WHATSAPP_REDESIGN.md), [DESIGN_DELTA_v7.md](./DESIGN_DELTA_v7.md).

> ⚠️ **Companion-doc drift:** [SCANNER_FLOW.md](./SCANNER_FLOW.md) (§4.4, file tree, checklist) and [LOCALIZATION.md](./LOCALIZATION.md) still reference `app/scan/review.tsx`, which no longer exists — Review was merged into Detail. Don't plan work against that removed screen.

**Primary surfaces touched:** [detail.tsx](../app/scan/detail.tsx) (merged Detail/Review — form + carousel + zoom), [reorder-photos.tsx](../app/scan/reorder-photos.tsx), [PhotoZoomViewer.tsx](../src/components/scanner/PhotoZoomViewer.tsx), [AppImage.tsx](../src/components/ui/AppImage.tsx), [app/_layout.tsx](../app/_layout.tsx).

---

## 1. Why now — what was hand-rolled (and current state)

| Area | Was / still | Status |
|---|---|---|
| Keyboard handling | Plain `ScrollView`, keyboard covered lower fields | ✅ Batch 1: `KeyboardAwareScrollView` + `KeyboardProvider` — verify on-device (Android focus/scroll) |
| Image rendering | Plain RN `<Image>` via temporary `AppImage` | ✅ Batch 1: `expo-image` wrapper — verify cache + fade-in on device |
| Photo zoom | No way to inspect condition up close | ✅ Batch 2: tap carousel → full-screen `PhotoZoomViewer` (pinch/double-tap/swipe); **inline carousel unchanged** |
| Reorder photos | Up/down arrow buttons | ✅ Batch 3: long-press drag (`react-native-reorderable-list`) — verify drag + cover label on device |
| Price input | Raw `decimal-pad` `TextInput` | ✅ Batch 3: `CurrencyInput` for buy-now — verify USD/TWD prefix + grouping on device |

**What we already had (don't re-add):** Reanimated 4.3 + worklets, `react-native-gesture-handler` 2.31, `@shopify/flash-list` 2.3, `@gorhom/bottom-sheet` 5, `sonner-native`, `expo-image-picker`, `expo-image-manipulator`.

---

## 2. Recommended libraries

### A. `react-native-keyboard-controller` — keyboard-aware forms ✅ Batch 1

Provides `KeyboardAwareScrollView` + optional `KeyboardToolbar` for multi-field forms (title, description, price, address, country).

- **Shipped:** Detail `ScrollView` → `KeyboardAwareScrollView`; `KeyboardProvider` in [app/_layout.tsx](../app/_layout.tsx).
- **Risk:** native module — dev-client rebuild required.

### B. `expo-image` — image wrapper ✅ Batch 1

- **Shipped:** [AppImage.tsx](../src/components/ui/AppImage.tsx) on `expo-image` (`contentFit="cover"`, `transition={200}`, `cachePolicy="memory-disk"`); plugin in [app.config.ts](../app.config.ts).
- **Risk:** native module — dev-client rebuild required.

### C. `react-native-zoom-toolkit` — tap-to-zoom overlay ✅ Batch 2

**Product decision (implemented):** tap → full-screen zoom; **do not** replace the hand-rolled paging carousel on Detail.

- **Shipped:** [PhotoZoomViewer.tsx](../src/components/scanner/PhotoZoomViewer.tsx) — `Modal` + toolkit `Gallery` (pinch, double-tap, swipe between photos); wired from [detail.tsx](../app/scan/detail.tsx) `PhotoGallery` + `ZoomIn` hint.
- **Not shipped:** inline carousel replacement (heavier; not needed for a few listing photos).
- **Alternatives considered:** `@likashefqet/react-native-image-zoom` (lighter single-image only), `react-native-gallery-toolkit` (overkill).
- **Risk:** medium on Reanimated 4.3 — verify gestures on a dev build.

### D. `react-native-reorderable-list` — drag-to-reorder ✅ Batch 3

- **Shipped:** [reorder-photos.tsx](../app/scan/reorder-photos.tsx) — long-press drag; `moveItem` kept for `onReorder`; list owns scroll (`Screen scroll={false}`).
- **Risk:** low–medium — verify autoscroll while dragging on device.

### E. `react-native-currency-input` — price polish ✅ Batch 3

- **Shipped:** buy-now price in [detail.tsx](../app/scan/detail.tsx); number↔string bridge so `detailSchema` stays string-based.
- **Risk:** low.

---

## 3. Phased rollout (original plan → what shipped)

| Batch | Planned | Shipped |
|---|---|---|
| **1** | keyboard-controller + `expo-image` | ✅ + zero-dep REQUIRED-bar fix (`getRequiredStatus` → `detailSchema`) |
| **2** | zoom (was ambiguous: carousel vs tap) | ✅ tap-to-zoom overlay only (`PhotoZoomViewer`) |
| **3** | reorder + currency | ✅ |
| **Deferred** | category searchable bottom-sheet (§6, zero deps) | not started — own PR when prioritized |

Ship order matched plan: 1–2 safe batch, 2 isolated, 3 polish. Category bottom-sheet deliberately **not** bundled into batch 1.

---

## 4. ⚠️ Compatibility caveat — read before installing

We're on **Reanimated 4.3 + RN 0.85 (new architecture)**. Zoom/reorder libs often document Reanimated v2/v3; verify on a dev-client build. **Every native lib in this plan** (`keyboard-controller`, `expo-image`, `zoom-toolkit`, `reorderable-list`) requires a **rebuilt dev client** (`npx expo run:android`) — *not* Expo Go. This is the exact failure mode that caused the earlier `expo-image` revert.

---

## 5. Per-file change map

| File | Status |
|---|---|
| [detail.tsx](../app/scan/detail.tsx) | ✅ `KeyboardAwareScrollView`; ✅ tap-to-open `PhotoZoomViewer`; ✅ `CurrencyInput` (buy-now) |
| [PhotoZoomViewer.tsx](../src/components/scanner/PhotoZoomViewer.tsx) | ✅ Batch 2 — new full-screen zoom viewer |
| [AppImage.tsx](../src/components/ui/AppImage.tsx) | ✅ Batch 1 — `expo-image` |
| [reorder-photos.tsx](../app/scan/reorder-photos.tsx) | ✅ Batch 3 — `ReorderableList` drag reorder |
| [requiredStatus.ts](../src/features/scanner/requiredStatus.ts) | ✅ Batch 1 — REQUIRED bar + submit gate |
| [app/_layout.tsx](../app/_layout.tsx) | ✅ Batch 1 — `KeyboardProvider` inside `GestureHandlerRootView` |
| [app.config.ts](../app.config.ts) | ✅ Batch 1 — `expo-image` plugin |
| [package.json](../package.json) | ✅ All five deps installed: `react-native-keyboard-controller`, `expo-image`, `react-native-zoom-toolkit`, `react-native-reorderable-list`, `react-native-currency-input` |

---

## 6. Open questions / follow-ups

- ✅ **REQUIRED bar vs submit (Batch 1):** fixed via `getRequiredStatus` — bar rows + `allRequired` driven by `detailSchema.safeParse`; grouped CTAs use the same gate. *(Historical bug: bar only counted photos/condition/price while schema also required title, description, category, address, country — especially empty location.)*
- ✅ **Zoom shape (Batch 2):** resolved — tap → full-screen viewer; carousel stays hand-rolled paging `ScrollView`.
- **Out of scope — confirm with product:** "Regenerate AI" after Review→Detail merge; no `useAnalyzeImages` on Detail (retake → reprocess only).
- **Optional, deferred:** category picker → searchable `@gorhom/bottom-sheet` (zero new deps; [detail.tsx](../app/scan/detail.tsx) still uses 200px chip scroll).
- **Companion-doc drift:** update `SCANNER_FLOW.md` / `LOCALIZATION.md` to drop `review.tsx` references when someone touches those docs.

---

## 7. Implementation progress

### Batch 1 — done in code ✅ (pending dev-client rebuild + on-device verify)

| Item | Status | Files |
|---|---|---|
| `react-native-keyboard-controller@1.21.6` installed | ✅ | [package.json](../package.json) |
| `expo-image@~56.0.9` installed + plugin registered | ✅ | [package.json](../package.json), [app.config.ts](../app.config.ts) |
| `KeyboardProvider` at app root (inside `GestureHandlerRootView`) | ✅ | [app/_layout.tsx](../app/_layout.tsx) |
| Detail `ScrollView` → `KeyboardAwareScrollView` (`bottomOffset={24}`) | ✅ | [detail.tsx](../app/scan/detail.tsx) |
| `AppImage` re-enabled on `expo-image` | ✅ | [AppImage.tsx](../src/components/ui/AppImage.tsx) |
| REQUIRED-bar single source of truth (`getRequiredStatus` → `detailSchema`) | ✅ | [requiredStatus.ts](../src/features/scanner/requiredStatus.ts), [detail.tsx](../app/scan/detail.tsx) |
| Bar shows 7 rows; Submit + grouped CTAs use `allRequired` | ✅ | [detail.tsx](../app/scan/detail.tsx), [en.json](../src/i18n/locales/en.json) |

**Still verify on device:** keyboard scroll to Address/Country; image cache/fade; REQUIRED bar cannot show complete while Submit disabled (empty location); price modes (`buyNow` empty price blocked, `offer` ok without amount).

---

### Batch 2 — done in code ✅ (pending dev-client rebuild + on-device verify)

**Decision:** tap → full-screen zoom; carousel unchanged.

| Item | Status | Files |
|---|---|---|
| `react-native-zoom-toolkit@^5.1.0` installed | ✅ | [package.json](../package.json) |
| `PhotoZoomViewer` (`Modal` + `Gallery`, pinch/double-tap/swipe) | ✅ | [PhotoZoomViewer.tsx](../src/components/scanner/PhotoZoomViewer.tsx) |
| Sizing via `useImageResolution` + `fitContainer`; pages use `expo-image` | ✅ | [PhotoZoomViewer.tsx](../src/components/scanner/PhotoZoomViewer.tsx) |
| Tap-to-open + `ZoomIn` affordance on Detail carousel | ✅ | [detail.tsx](../app/scan/detail.tsx) |

**Implementation notes:**
- `GestureHandlerRootView` **inside** the `Modal` — Android Modal is a separate hierarchy; app-root provider does not reach it.
- Parent keys viewer (`key={viewerIndex ?? 'closed'}`) so `initialIndex` is fresh per open without `setState` in an effect.

**Still verify on device:** tap opens at correct index; pinch/double-tap/swipe; close returns to Detail; Rearrange still works (does not open viewer).

**Optional polish (not blocking):** `ZoomImage` uses `contentFit="cover"` after `fitContainer` — may crop edges when zoomed; try `contentFit="contain"` if condition inspection needs full frame visible.

**Verification (static):** Batch-2 files pass `eslint`; full-project `npx tsc --noEmit` clean at last check.

---

### Batch 3 — done in code ✅ (pending dev-client rebuild + on-device verify)

| Item | Status | Files |
|---|---|---|
| `react-native-reorderable-list@^0.18.0` installed | ✅ | [package.json](../package.json) |
| `react-native-currency-input@^1.1.1` installed | ✅ | [package.json](../package.json) |
| Reorder: arrows → long-press drag; `moveItem` in `onReorder` | ✅ | [reorder-photos.tsx](../app/scan/reorder-photos.tsx) |
| Buy-now → `CurrencyInput` (prefix/delimiter/2dp), string bridge for schema | ✅ | [detail.tsx](../app/scan/detail.tsx) |
| `reorder.dragToReorder` i18n | ✅ | [en.json](../src/i18n/locales/en.json) |

**Implementation notes:**
- `ReorderableList` cannot nest in `ScrollView` — screen uses `<Screen scroll={false}>`; list owns scroll.
- `keyExtractor` uses stable `photo.uri` for correct drag animations.

**Still verify on device:** long-press drag + autoscroll; cover label tracks index; currency formatting for USD and TWD.

**Verification (static):** full-project `tsc --noEmit` clean; `eslint` clean (pre-existing react-hook-form `watch()` React-Compiler warning on Detail only).

---

## 8. Done — full sweep remaining before merge

All plan code is written. What's left is **not coding**:

1. ⚠️ **Rebuild the dev client** (`npx expo run:android`) — five native modules across batches; Expo Go will not work.
2. **On-device verification** — use per-batch checklists in §7.
3. **i18n:** seed/translate new `mobile.detail.required.*` and `mobile.reorder.dragToReorder` into `ja` / `th` / `zh` ([LOCALIZATION.md](./LOCALIZATION.md)); English-only keys fall back via `fallbackLng: 'en'`.
4. **Product:** Regenerate-AI — in or out?
5. **Optional:** category bottom-sheet (§6); companion-doc drift cleanup.
