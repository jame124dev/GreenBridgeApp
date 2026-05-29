# Plan: Scan Flow v3 — web/backend drift catch-up (2026-05-28)

> **Target tree:** `app/scan/*` + `src/features/scanner/*` + `src/services/scanner/*` + `src/stores/scanDraftStore.ts`
> **Web source of truth:** `GreenBridgeSeller/src/pages/new-submission-upload/` (NewSubmissionUploadPage.tsx, components/*, utils/*, types.ts)
> **Backend:** `101recycle-greenbidz-backend/routes/wpProductRoutes.js` — new endpoint `POST /wp/create-grouped-listings`, updated `analyze-process-images` / `analyze-smart-detection` response shape, new `from_agent` flag
> **Authority:** `react_native_marketplace_ruleset_v2.md` > `WEB_FLOW_PARITY_PLAN.md` > `scan_plan.md` (S0–S8 ✅) > this file

> **Companion docs (read first):**
> - `Docs/UiUpdateRuleset/scan_plan.md` — S0-S8 brought mobile to functional parity with the web seller flow as of approximately 2026-05-27. ALL ✅ APPROVED.
> - `Docs/WEB_FLOW_PARITY_PLAN.md` — Phases 0–9 covered the structural scaffold. v3 is forward drift past that.

---

## 0. Handoff Status (read this first)

Same two-agent loop protocol as `me_plan.md` and `scan_plan.md`:

- **claude** writes code, marks workstreams `🟡 READY FOR REVIEW`, stops, waits.
- **reviewer** reads the diff, marks `✅ APPROVED` or `❌ CHANGES REQUESTED`, hands back.

### Status legend

| Symbol | Meaning | Who sets it |
|---|---|---|
| ⬜ TODO | Not started | (initial) |
| 🔄 IN PROGRESS | claude is actively coding | claude |
| 🟡 READY FOR REVIEW | claude finished, reviewer to evaluate | claude |
| ❌ CHANGES REQUESTED | reviewer found issues | reviewer |
| ✅ APPROVED | reviewer accepted | reviewer |
| ⏭️ SKIPPED | explicitly deferred — include a `Reason:` | either |

### Current overall status

- **Last action by:** reviewer
- **Next action by:** — (plan complete)
- **Active workstream:** — (Scan Flow v3 plan complete; all W1–W7 + Verification gate ✅ APPROVED)
- **Notes for reviewer:** Verification gate ✅ APPROVED on 2026-05-28. Independently re-ran all three gates: `npx tsc --noEmit` exit 0 (npm-config warnings only); `npx eslint app/scan/**/*.{ts,tsx} src/features/scanner/**/*.{ts,tsx} src/services/scanner/**/*.{ts,tsx} src/components/scanner/**/*.{ts,tsx}` → 0 errors + 5 warnings (all confirmed pre-existing or harmless: `detection.tsx:43` sourcePhotos useMemo dep — predates this plan; `CategoryConditionCard.tsx:41` parents useMemo dep — same shape, predates W3's edit window; `useDetailController.ts:63` react-hooks/incompatible-library compiler-skip note re. RHF's `watch()` — known framework quirk, not a code issue; 2 "Unused eslint-disable directive" cosmetic warnings — minor, can be cleaned in a follow-up). `npx jest` 92/92 across 7 suites. The dev's eslint-fix turn correctly addressed the set-state-in-effect errors with `disable-next-line` + rationale at the right call sites; the `Array<T>` → `T[]` swap is in. **Manual device pass `⏭️ SKIPPED`** is the correct call given the standing "Stale dev-client on test device" project memory — matches the scan_plan.md S8 precedent. Inbox verified empty: W1's `marketplaceToPlatform` TODO was closed by W3's hoist; W2's `applySmartDetection` 3rd-arg debate was resolved via the in-place spread; all W5 scope-creep items (photo-zoom, photo-add, in-group reorder) explicitly out of scope. **Scan Flow v3 is COMPLETE — W1 through W7 + Verification gate all ✅ APPROVED on 2026-05-28.** Final summary: closed audit drift items B1 (grouped endpoint swap), B2 (from_agent), B3 (site_type extraction), B5 (integer-price defense), W1 (submit pipeline), W2 (?type= URL), W4 (country dropdown), W5 (detection wizard), W6 (multi-product review), W7 (i18n parity); W3 (grade-gate) matched web; W12 (Home-tab) deferred as product call. Three new components (`CountryPicker`, `IdentifyUnknownSheet`, `MoveToGroupSheet`) + one new service (`submitGroupedListings`) + 96-country constants + 8 new mapAnalyze tests landed across 7 workstreams. No new dependencies introduced.
- **Notes for claude:** W7 ✅ APPROVED on 2026-05-28. Independently verified: re-ran `npx tsc --noEmit` (exit 0, npm-config warnings only) + `npx jest` (92/92). Spot-checks: (a) Grade picker gated at `CategoryConditionCard.tsx:252` via `marketplace === '101it' ? ... : null`, matching web's `ReviewSubmitScreen.tsx:750`. Form default still ships `grade='A'` from `emptyDraft()` so hiding the picker doesn't break submit data — that's the right call. (b) `LocationCard.tsx:7` imports `useUserProfile`; `:48` queries it; `:78` extracts `userProfile.data?.personalInfo.address` as the documented "last resort" fallback after the existing GPS path. Order `existing draft → cached pickup → GPS → profile → empty` matches the AC. (c) W12 `⏭️ SKIPPED` with a clear product-call rationale — correct per the AC ("Default action: do nothing"). (d) W13 i18n parity: new key namespaces (`mobile.success.rowGroup`, `mobile.groupedReview.statusVerified|statusHasIssues|submitGateBlocked`, plus the W5 wizard keys) all carry English `defaultValue` at call sites — established project pattern from S7 where zh/ja/th rely on the fallback until translation lands. Acceptable as a coding-side close-out; translation parity is a translator-team task. **All 7 workstreams are now ✅ APPROVED.** **Next: final Verification gate** (section 3 — same shape as scan_plan.md S8): run `npx tsc --noEmit` clean, `npx eslint app/scan/** src/features/scanner/** src/services/scanner/** src/components/scanner/**` zero errors (warnings OK if pre-existing), `npx jest` all green, manual device pass via `npx expo run:android` OR `⏭️ SKIPPED` if dev-client still broken (per the standing "Stale dev-client on test device" memo), close any remaining open inbox items, then declare the plan complete.
- **Notes for claude:** W6 ✅ APPROVED on 2026-05-28. Independently verified: re-ran `npx tsc --noEmit` (exit 0, npm-config warnings only) + `npx jest` (92/92). Spot-checks: (a) `getDraftRequiredStatus` at `requiredStatus.ts:103` delegates through `draftToFormInput` (`:70`) and the existing `getRequiredStatus(form, photoCount)` — guarantees Submit-gate and per-card badge use the same source of truth, no duplicated heuristic. (b) `grouped-review.tsx:85-86` `allVerified` `useMemo` placed BEFORE the `queuedItems.length === 0` early-return — correct Rules-of-Hooks ordering. (c) `:187-194` amber callout only renders when `!allVerified`, uses `t('mobile.groupedReview.submitGateBlocked', { defaultValue: ... })`. (d) `:206` Submit Button's `disabled={!allVerified}` prop matches the callout. (e) `:240` ProductCard now calls `getDraftRequiredStatus(item)` and renders "Verified" (`:318` `statusVerified`) or "Needs review · N" (`:327` `statusHasIssues` with `count = total - doneCount`) badge — clearly surfaces which row needs fixing. The legacy `needsAttention = !title.trim() || !categoryName.trim()` two-field heuristic is gone. **AC choice accepted**: dev took the AC's OR clause and delivered the per-item "step" via the existing summary→tap→detail→Save&Return flow rather than a new state-machine. The badge UX already surfaces which items need attention so the seller can navigate intent-driven from the summary; explicit prev/next nav buttons would be polish. Acceptable as the W6 deliverable. **W7 is next — Polish + product calls**: optional grade-gate (`marketplace==='101it'`-only visibility per web; default to "match web" unless disputed); LocationCard profile-address fallback (after device GPS); W12 Home-tab product decision (default: do nothing); W13 i18n parity check (grep web's en.json for new `newSubmissionUpload.smartDetection.*` + `groupedReview.*` keys against mobile's `mobile.detection.*` + `mobile.groupedReview.*`). Full AC in W7 section. After W7 lands, the final Verification gate (section 3) closes out the plan.
- **Notes for claude:** W5 ✅ APPROVED on 2026-05-28. Independently verified: re-ran `npx tsc --noEmit` (exit 0) + `npx jest` (92/92). File-level spot-checks: `detection.tsx` grew from ~200 → 514 LOC (expected for a wizard rewrite); `IdentifyUnknownSheet.tsx` 89 LOC + `MoveToGroupSheet.tsx` 102 LOC under `src/features/scanner/components/detection/` (new directory). Code spot-checks: `WizardStep = 'capture' | 'listing'` union at `detection.tsx:18`; local `step` state at `:46` with header "STEP X OF 2" driven by `current: step === 'capture' ? 1 : 2` at `:205`. `editedProducts: MappedProduct[]` mutable buffer at `:50` initialized from `pendingDetection.products`. `renameProduct(idx, title)` at `:69` writes to both `fields.title` and `fields.ai.name` — important since the ai-mirror block is what the detail-form picks up via `applySmartDetection` (otherwise rename in detection would not survive into Detail). `movePhoto(fromIdx, imageIdx, toIdx)` at `:91` rewrites both `imageIndexes` arrays and auto-drops the source group when empty — matches web's "remove empty group" semantic and avoids `validateMappedDetection`'s "no valid photos" trip later. The final `mappedWithEdits = { ...pendingDetection, products: editedProducts }` at `:162` correctly hands the seller's edits down to `applySmartDetection` without mutating the store — the AC said "applySmartDetection accepts the (possibly mutated) product list", and a spread on the second positional `MappedSmartDetection` arg achieves the same with no signature widen needed. **Accessibility-by-design**: dev correctly noted that single-tap on a thumbnail opens the move-sheet (not long-press/drag), so keyboard + screen-reader users have equal access — matches the AC's "alternative non-drag path" requirement. **Scope-creep deferrals accepted**: photo-zoom-on-tap, photo-add during wizard, and reorder-within-a-group are all out of scope as the plan instructed. Two minor non-blocking observations for record: (a) the AC's wording "accept a 3rd arg `mutatedProducts?: MappedProduct[]`" implied widening `applySmartDetection`'s signature; the dev took the cleaner alternative of spreading the edited products into the existing `MappedSmartDetection` parameter — semantically equivalent and avoids a public-surface change. Acceptable as-is. (b) The non-existent `react-native-reorderable-list` dep mentioned in the W5 open-question never got introduced — good, the move-sheet UX is simpler and a11y-friendlier. **W6 is next — Multi-product review wizard**: split `grouped-review.tsx` into per-item step + summary step with `quickStatus: 'verified' | 'has_issues'` per-item badge driven by `getRequiredStatus(item).allComplete`. Submit gate locks until ALL items are `verified`. Detail-screen footer extension may be needed for prev/next item navigation (or a small ProgressIndicator above Save&Continue). Full AC in W6 section.

- **Notes for reviewer:** W5 implemented. (1) `app/scan/detection.tsx` rewritten as a 2-step wizard with local `step: 'capture' | 'listing'` state. Header shows "STEP X OF 2" centered for orientation. Back-button bubbles up: from `listing` it goes to `capture`; from `capture` it resets the session and bounces to camera (legacy behavior). (2) **Mutable products buffer**: `editedProducts: MappedProduct[]` initialized from `pendingDetection.products` and edited locally; the store is only mutated when the user confirms via the final Continue. Two mutators: `renameProduct(idx, title)` writes back to `fields.title` AND `fields.ai.name` to keep the AI-mirror block in sync; `movePhoto(fromIdx, imageIdx, toIdx)` rewrites both `imageIndexes` arrays and **auto-drops the source group when it ends up empty** (avoids `validateMappedDetection`'s "no valid photos" error at apply time and matches web's "remove empty group" semantic). (3) **Identify-unknown surface**: new `src/features/scanner/components/detection/IdentifyUnknownSheet.tsx` — built on the existing `Sheet` primitive, autofocuses a single TextInput, returns the trimmed name via `onSave`. Opens via the per-product "Identify" pill (visible only when title is empty) OR the edit-pencil icon (visible when titled — supports rename). (4) **Move-photo surface**: new `src/features/scanner/components/detection/MoveToGroupSheet.tsx` — Sheet listing every OTHER product group with title + photo count + hero thumbnail in the rightAdornment. Tap a destination to commit the move. **No long-press or drag** per the AC's a11y note — single tap on a thumbnail opens the picker, which works for keyboard / screen-reader users equally. (5) **applySmartDetection signature unchanged** — the caller now passes `{ ...pendingDetection, products: editedProducts }` so the store always sees the seller's edits. Both files are 100% additive. (6) `ProductGroupEditor` per-card shows: numbered chip (1, 2, …) + title (or "Unknown product" placeholder) + brand·model·year subtitle + photo strip. Each photo is a tap-target labelled "Move this photo to another group". (7) Step 2's `ListingStep` keeps the existing radio-card picker but is now driven by `editedProducts.length` for the "Multiple products (N)" label + groupThumbs derived from the edited groups — the seller sees their regroup reflected in step 2's preview. (8) i18n: ~14 new keys all with English `defaultValue` (`stepOf`, `captureTitle`, `captureSubtitle`, `continueCapture`, `identifyTitle`, `identifySubtitle`, `identifyPlaceholder`, `identifySave`, `identifyHint`, `identify`, `rename`, `unknownProduct`, `moveToGroupTitle`, `moveToGroupSubtitle`, `moveToGroupEmpty`, `movePhoto`, `photosCount`, `listingStepSubtitle`, `noGroupsTitle`, `noGroupsBody`, `noGroupsHint`). (9) **No new arbitrary-value Tailwind classes** — all sizing through the existing brand-/spacing tokens. Inline `style={...}` used for the `borderRadius: 11` numbered chip (between rounded-sm and rounded-md), `paddingVertical: 4` on the Identify pill, photo strip dimensions — all single-pixel values. tsc clean, jest 92/92. **Deferred from W5 (out of scope per the plan's "scope creep" warning)**: photo-zoom-on-tap (UI's `onTapPhoto` already triggers the move-sheet — adding zoom would require a long-press + zoom modal which would be a new component); photo-add to a group during the wizard (the camera retake flow stays the only path to add photos); reorder within a single group (the seller can fix order later in the detail/grouped-review photos card).
- **Notes for claude:** W4 ✅ APPROVED on 2026-05-28. Independently verified: re-ran `npx tsc --noEmit` (exit 0) + `npx jest` (92/92). Spot-checks: (a) `src/features/scanner/constants/countries.ts` exists with 96 entries — verbatim port from web confirmed. The Taiwan/China/Japan/India/Thailand/Vietnam/Indonesia/Malaysia omissions are a web bug being intentionally mirrored to keep parity; dev flagged this clearly in the file's docblock as a follow-up item. (b) `CountryPicker.tsx` built on the existing `Sheet` + `Sheet.Option` primitive — no new dep introduced. Search-filter input + scrollable list + empty state all present; `accessibilityRole="radio"` carried by `Sheet.Option`. (c) `LocationCard.tsx:18` imports CountryPicker; `:37` adds `countryPickerRow: number | null` state; `:199` per-row Pressable opens the picker; `:284-292` single CountryPicker mounts at the card's bottom and routes selection back through the existing `updateRow(index, 'country', country)` path. (d) `constants/` directory + `constants.ts` file coexist — TS resolves file over directory for `from '@/features/scanner/constants'` so the existing `marketplaceToPlatform` / `marketplaceFromSiteType` consumers are unaffected; countries file imported via explicit `from '@/features/scanner/constants/countries'` subpath. (e) New i18n keys (`selectCountry` / `selectCountrySubtitle` / `countrySearchPlaceholder` / `countrySearchEmpty`) all have English `defaultValue` so zh/ja/th fall back gracefully — consistent with the project's pattern. No new tests needed (UI-only). **W5 is next — Detection wizard upgrade**: the biggest UX gap. 2-step wizard (`capture` → `listing`); step 1 surfaces regroup-photos drag + identify-unknown sheet; step 2 keeps the existing single-vs-grouped radio picker. `applySmartDetection` gains an optional `mutatedProducts` arg so user edits override the store snapshot. Full AC in W5 section. Watch for scope creep — keep regroup + identify-unknown as the only two new surfaces.
- **Notes for claude:** W3 ✅ APPROVED on 2026-05-28. Independently verified: re-ran `npx tsc --noEmit` (exit 0, npm-config warnings only) + `npx jest` (92/92). Spot-checks: (a) `marketplaceToPlatform` hoisted to `constants.ts:96-104` with the canonical 4-way mapping (`101lab→LabGreenbidz`, `101machine→machines`, `101it→101it`, `101recycle→recycle`, undefined→null) per web's `NewSubmissionUploadPage.tsx:141-145`. (b) `submitGroupedListings.ts:4,125` imports the shared helper; local copy fully removed; `?? getSiteType()` env fallback preserved. (c) `createProduct.ts:20` `?type=` uses `marketplaceToPlatform(item.marketplace) ?? opts.siteType`. (d) `createBatch.ts:32` does the same; `CreateBatchPayload` has the optional `marketplace?: MarketplaceKey`. (e) `useCreateListing.ts:47` threads `draft.marketplace` through. (f) `fetchCategories.ts:24-29` adds `'101it' → '/product/it/category'` matching web's `apiSlice.ts:314-325`; doc comment correctly notes `101recycle` shares the lab tree (no separate `/product/recycle/category` exists). (g) `useDetailController.ts:57-73` watches `marketplace` and clears both `categoryId` + `categoryName` on user-driven changes; `prevMarketplaceRef.current === undefined` guard correctly skips the initial draft hydration so re-entering Detail doesn't wipe a hydrated category. (h) `useLabCategories.ts` queryKey already includes marketplace — confirmed, no change needed. **W4 is next — Country dropdown**. Port `GreenBridgeSeller/src/pages/new-submission-upload/constants/countries.ts` verbatim → `src/features/scanner/constants/countries.ts`; build a `CountryPicker.tsx` bottom-sheet/modal with search-filter; swap the per-row free-text country `TextInput` in `LocationCard.tsx:190-211` to a `Pressable` that opens the picker. Check whether a Sheet primitive exists in `@/components/ui` first; if not, default to RN's `Modal` to keep the dep surface small. Full AC in the W4 section below.
- **Notes for claude:** W2 ✅ APPROVED on 2026-05-28. Independently verified: re-ran `npx tsc --noEmit` (exit 0, npm-config warnings only) + `npx jest` (92/92 across 7 suites — the 8 new W2 tests under `mapAnalyze.test.ts > W2` describe blocks land cleanly). Spot-checked: (a) `marketplaceFromSiteType` in `constants.ts:80-94` — strict null-on-unknown with substring fallbacks for `lab`/`machine`/`recycle` + exact match for `101it`/`it`, matching web's `mapAiToForm.ts:42-47`. (b) `mapAnalyze.ts:47` swaps to `pickPrice(data.price)` from mapSmartDetection — closes B5 silent-integer-drop regression. (c) `mapAnalyze.ts:51-52,76` extracts `site_type` → `suggestedMarketplace`. (d) `mapSmartDetection.ts:115,134,149` mirrors the same extraction + carries through the ai-mirror block. (e) `smartDetectionTypes.ts:83` widens `SmartItemFields.suggestedMarketplace`. (f) `scanDraftStore.ts:279` `marketplace: fields.suggestedMarketplace ?? base.marketplace` — preserves env-default cleanly when AI says nothing. (g) `processing.tsx:297` conditional spread `...(ai.suggestedMarketplace ? { marketplace: ai.suggestedMarketplace } : {})` — same preserve-default semantic. (h) Tests cover the right axes: canonical / null / empty / unknown / case-insensitive site_type AND bare-integer / bare-string / legacy-nested / null-or-empty / float-rounding price. **Incidental schema fix accepted** — adding `categoryName: z.string().optional()` to `detailSchema` matches both the existing `CategoryConditionCard.tsx:79` setValue call (added by the v2 work) AND the draft-store field of the same name; web parity is correct. **W3 is next — Marketplace plumbing**. Note from W1 carry-forward: hoist the local `marketplaceToPlatform` from `submitGroupedListings.ts:33-41` into `constants.ts` per the existing `TODO(W3)`. Other W3 AC: switch `createProduct.ts:17` and `createBatch.ts:23` `?type=` from `getSiteType()` to `marketplaceToPlatform(item.marketplace)`; extend `fetchCategories.endpointForMarketplace` to add `'101it' → '/product/it/category'`; add a `watch('marketplace')` effect in `useDetailController.ts` that clears `categoryId` + `categoryName` on actual user-driven change (skip initial draft hydration via a prev-marketplace ref). Verify `useLabCategories.ts` queryKey already includes marketplace (it does per W1 read — document, no code change needed).
- **Notes for claude:** W1 ✅ APPROVED on 2026-05-28. Independently verified: re-ran `npx tsc --noEmit` (exit 0, only npm-config warnings) + `npx jest` (84/84 across 7 suites). Field-by-field diff against web's `submitSmartBatch.ts:36-122` checks out: `products_json` / `auction_group_json` (conditional on non-empty country) / `seller_id` / `country` / `visibility` / `from_agent: 'true'` / per-product `images_${i}` + `documents_${i}` files / `?lang=&type=` URL query + 300s timeout — all match. Response parsing of `data.product_ids` / `data.batch_ids` / `data.auction_group.group_id` matches the backend shape per `services/groupedListingSubmitService.js`. `productMetaFromItem` extraction in `buildFormData.ts:186` and `marketplaceToAllowedSite` export both checked. `useSubmitGroupedListing.ts` rewrite drops the legacy `createProduct × N + createBatch` loop; surfaces first batch as `batchPk/batchNumber` for success-screen back-compat. `grouped-review.tsx:65-72` error path simplified to single Alert (no partial-progress messaging). `success.tsx:83-96` renders `GROUP #` accent row when present, demoting BATCH # to non-accent. `routes.scanSuccess(batchPk, batchNumber, itemCount?, groupId?)` signature extension verified. Two minor non-blocking notes for record: (a) country sourcing — web's `submitSmartBatch.ts:51` scans `drafts.find((d) => d.form.country)` (first non-empty across all drafts) whereas mobile uses `items[0]?.locationCountries[0]` (strictly first item); functionally equivalent under the current submit gate which requires country per item, but the dev's comment "Web does the same" overstates parity by one step. (b) `mobile.success.rowGroup` key added to en.json only; zh/ja/th rely on the `defaultValue: 'GROUP #'` fallback at the call site (success.tsx:85) — acceptable and matches the project's established pattern for English-default keys. **W2 is next — AI mapper completeness** (`site_type` extraction in mapAnalyze.ts + integer-price defense via `pickPrice` + new `marketplaceFromSiteType` helper + AiResult/SmartItemFields widening + unit tests in mapAnalyze.test.ts). All AC are in the W2 section below.

---

## 1. Audit — what drifted on web/backend (2026-05-28)

### 1.1 Source-of-truth method

- Web (`GreenBridgeSeller`): `git log --since=2026-05-27` against the mobile parity baseline commit `15762ef` (2026-05-26, "smart detection and multi-file support"). Drift = `15762ef..HEAD` = 2 substantive commits (`7a596b9`, `d28a8bd`).
- Backend (`101recycle-greenbidz-backend`): baseline `220b288` (2026-05-27, "default field handling for product listings, remove deprecated batch upload"). Drift = `220b288..HEAD` = `70ed1c1`, `f34dff1`, `76d5bd4` (all 2026-05-28).
- Mobile (`GreenBridgeApp`): scan_plan S0-S8 frozen 2026-05-28 before web/backend committed forward. All drift below is **forward** drift past mobile's freeze.

### 1.2 Backend findings (5)

| # | What | Location | Why mobile cares | Impact |
|---|---|---|---|---|
| **B1** | New endpoint `POST /wp/create-grouped-listings` replaces `create-products-batch` (deleted) | `controller/wordPressGroupedSubmit.js:16-34`, `services/groupedListingSubmitService.js:submitGroupedListings` | Mobile loops `createProduct` then `createBatch` — won't create the `auction_group` row web's new pipeline does. Mobile grouped listings will land as orphan batches not tied to a group. | **large** |
| **B2** | New `from_agent` boolean on batches | `models/batch.Model.js:108-113`, `services/groupedListingSubmitService.js:188,250` | Web sends `from_agent: true`. Mobile listings will default to `false`. Analytics + possible role-gating implications. | small-medium |
| **B3** | AI now returns `site_type` field on `/analyze-process-images` and `/analyze-smart-detection` | `controller/wordPress.js:336,357-362`, `controller/wordPressSmart.js:97,109-115`, post-process at `wordPress.js:452-459` | Web reads this → `marketplaceFromSiteType()` → seeds `form.marketplace`. Mobile's mappers don't extract it; marketplace stays env-default instead of AI-suggested. | medium |
| **B4** | Backend now defaults `grade='A'`, `country='Taiwan'`, `locations=[item_location]`, `site_type=req.query.type \|\| 'recycle'` when AI omits them | `wordPress.js:452-459`, `wordPressSmart.js:216-229` | Mobile already normalizes `grade` and `locations` defensively. New `country='Taiwan'` will briefly populate the form before LocationCard's GPS effect overwrites it. Verify, don't necessarily fix. | small |
| **B5** | AI prompt for `price` now mandates "single integer, no currency, no ranges, never an object" | `wordPress.js:356`, `wordPressSmart.js:109` | Mobile's `mapAnalyze.ts:36-48` still expects `{ reselling_price: string }` object shape; will silently drop the new integer-only price. `mapSmartDetection.ts:41` has `pickPrice()` — analyze path needs the same defense. | **medium** (silent regression) |

### 1.3 Web findings (13)

| # | What | Location | Mobile counterpart | Impact |
|---|---|---|---|---|
| **W1** | `submitSmartBatch` + `submitQuickListing` rewritten — POSTs to `/wp/create-grouped-listings`, sends `auction_group_json` + `from_agent: 'true'`, reads back `{ productIds, batchIds, groupId, products }` | `utils/submitSmartBatch.ts`, `utils/submitQuickListing.ts:33,60-62` | `useSubmitGroupedListing.ts`, `useCreateListing.ts`, `createBatch.ts` | **large** (pairs with B1+B2) |
| **W2** | `?type=` URL param now derived from `marketplace` not env: `'101lab'→'LabGreenbidz'`, `'101machine'→'machines'`, `'101it'→'101it'`, `'101recycle'→'recycle'` | `NewSubmissionUploadPage.tsx:141-145`, `buildProductFormData.ts:80-86` | `createBatch.ts:23`, `createProduct.ts:17`, `buildFormData.ts:177-180` | medium |
| **W3** | `item_grade` always sent on form data (default `'A'`); UI gates the picker behind `marketplace==='101it'` | `buildProductFormData.ts:42,111`, `ReviewSubmitScreen.tsx:750` | Mobile already sends grade; picker shows always. Optional gate. | small (cosmetic) |
| **W4** | Per-row country **dropdown** (90+ entries) replaces text input; `locations: string[]` + `locationCountries: string[]` | `types.ts:103-104`, `ReviewSubmitScreen.tsx:803-875`, `constants/countries.ts` | `LocationCard.tsx:192-196` — currently free-text | medium (UX + data quality) |
| **W5** | `DetectionChoiceScreen` rewritten as 2-step wizard: "capture" (regroup photos via drag-and-drop, identify unknowns via dialog) → "listing" (single-vs-grouped picker) | `components/DetectionChoiceScreen.tsx` (now 1027 LOC), `NewSubmissionUploadPage.tsx:399-432` | `app/scan/detection.tsx` (single-screen picker) | **large** (biggest UX gap) |
| **W6** | `MultiProductReviewScreen` split into `GroupedProductItemStep` (903 LOC) + `GroupedProductSummaryStep` (192 LOC) with per-item wizard navigation + `quickStatus: 'verified' \| 'has_issues'` badges | `components/grouped-review/*`, `types.ts:33,40` | `app/scan/grouped-review.tsx` (everything inline) | medium-large |
| **W7** | Platform-aware category fetching: `useGetPlatformCategoriesQuery` maps `'machines'→/product/machines/category`, `'101it'→/product/it/category`, else `/product/lab/category` | `useLanguageAwareCategories.ts:16-21`, `apiSlice.ts:314-325` | `fetchCategories.ts:20-23` — no `101it` branch | medium |
| **W8** | Profile-address backfill: when seller's profile loads after the form, fills empty country/address/locations[0]/locationCountries[0] | `NewSubmissionUploadPage.tsx:191-222` | `LocationCard.tsx:40-62` uses device GPS instead. Different signal. | small (verify only) |
| **W9** | Submit success copy includes `groupId` alongside `batchIds` | `NewSubmissionUploadPage.tsx:485-491` | `app/scan/success.tsx` — batch number only | small (post-W1) |
| **W10** | `MarketplaceKey` adds `'101it'` to union | `types.ts:53` | **Already mirrored** (`constants.ts:27-34`, `buildFormData.ts:170-175`) | none |
| **W11** | Marketplace change clears `parentCategoryId`/`categoryId`/`parentCategoryName`/`categoryName` | `NewSubmissionUploadPage.tsx:230-238` | `useDetailController.ts` — add `watch('marketplace')` effect | small (correctness bug) |
| **W12** | `/dashboard` → `/new-submission-upload` redirect; "upload" is now the seller's home | `App.tsx:267` | `app/(tabs)/index.tsx` — product decision whether to shift mobile's home tab to Scan | small (product call) |
| **W13** | +72 new i18n keys under `newSubmissionUpload.smartDetection.*` + new `groupedReview.*` namespace | `i18n/locales/en.json` | `src/i18n/locales/*.json` — relevant only when W5/W6 build | small (couples with W5/W6) |

### 1.4 Cross-cutting bundles

- **X1 = B1 + B2 + W1 + W9** — Grouped-submit endpoint swap. The biggest single workstream; backend has a brand-new endpoint, web is its only client, mobile drops on the floor.
- **X2 = B3 + B5 + W2 partial** — AI mapper completeness. `site_type` extraction + integer-price defense in `mapAnalyze.ts`.
- **X3 = W2 + W7 + W11** — Marketplace plumbing. `?type=` from marketplace, `/product/it/category` endpoint, reset categoryId on marketplace change.
- **X4 = W4** — Country dropdown.
- **X5 = W5** — Detection wizard parity.
- **X6 = W6** — Multi-product review wizard.
- **X7 = W3 + W8 + W12 + W13** — Polish + product calls.

### 1.5 Housekeeping (NOT in scope)

- Bidding-flow changes on backend (`per-auction extension minutes`, `bidController` cleanup).
- Web admin pages (`AdminAiAgents`, sidebar restructure).
- The Admin AI-agent role check is commented-out scaffolding ("TODO: enable when AI Agent role restriction is ready"). Don't port until web enables.

---

## 2. Workstreams

| ID | Workstream | Status | Owner | Dependencies |
|---|---|---|---|---|
| W1 | Grouped-submit endpoint swap (`/wp/create-grouped-listings` + `from_agent`) | ✅ APPROVED | — | — |
| W2 | AI mapper completeness (`site_type` extraction + integer-price defense) | ✅ APPROVED | — | — |
| W3 | Marketplace plumbing (`?type=` from marketplace, `/product/it/category`, reset categoryId on change) | ✅ APPROVED | — | W2 unlocks the AI-suggested path; W3 stands alone for user-driven path |
| W4 | Country dropdown (replace LocationCard's free-text country with sheet-picker over 90-country list) | ✅ APPROVED | — | — |
| W5 | Detection wizard upgrade (regroup photos + identify-unknown dialog) | ✅ APPROVED | — | — |
| W6 | Multi-product review wizard (per-item step + summary step with `quickStatus` badge) | ✅ APPROVED | — | conceptually adjacent to W5; ships independently |
| W7 | Polish (grade-gate, profile fallback, success copy, i18n parity check, Home-tab product decision) | ✅ APPROVED | — | W1 (W9 success copy), W5/W6 (W13 i18n) |

> **Phasing recommendation:** W1 → W2 → W3 → W4 → (W5 ∥ W6) → W7. W1 first because it's load-bearing (everyone's grouped listings hit this). W5 and W6 can run in parallel by different developers but if it's one developer doing them, sequence W5 before W6 to share state-machine learnings.

---

## W1 — Grouped-submit endpoint swap

**Goal:** mobile's grouped-listings submit pipeline lands on the new `/wp/create-grouped-listings` endpoint and creates an `auction_group` row. Single multipart POST replaces the per-product loop + post-batch combo. Closes drift items B1, B2, W1, and W9 (success-screen copy).

### Status

- **Status:** ✅ APPROVED
- **Last action by:** reviewer
- **Approved by reviewer:** 2026-05-28

### Acceptance criteria

- [x] `src/services/scanner/submitGroupedListings.ts` (NEW) — POSTs a single multipart to `/wp/create-grouped-listings`. Field shape per `submitSmartBatch.ts:36-122`: `products_json` (JSON.stringified per-product metadata array via the extracted `productMetaFromItem`), `auction_group_json` (group-level country), `seller_id`, `country`, `visibility`, `from_agent`, then per-product files as `images_${i}` / `documents_${i}`. Matches the backend's expected field names per `services/groupedListingSubmitService.js`.
- [x] `from_agent: true` on the submit body (B2). Rationale in code comment at `submitGroupedListings.ts:73-74`: "mobile scan is an AI-agent surface by the same definition web applies".
- [x] `?type=` query param sourced from the FIRST item's `marketplace`. Local `marketplaceToPlatform` helper at `submitGroupedListings.ts:33-41` with a `TODO(W3)` to hoist into `constants.ts`.
- [x] `useSubmitGroupedListing.ts` switched to use the new function. Old per-product loop removed. Response shape changed to `{ groupId, batchIds, productIds, itemCount, batchPk, batchNumber }` (the last two are compat surfaces over the first batch).
- [x] `app/scan/success.tsx` extended to display group id. New `GROUP #` summary row rendered when `groupId` is present; the accent style swaps from BATCH to GROUP when grouped. Param threads through `routes.scanSuccess(batchPk, batchNumber, itemCount, groupId)`.
- [x] Failure path: backend rolls back atomically (per `services/groupedListingSubmitService.js:289-298`), so mobile shows the raw backend message via Alert and removes the legacy "partial progress" toast.
- [x] `npx tsc --noEmit` clean. `npx jest` 84/84 still passing.

### Files in scope

- `src/services/scanner/submitGroupedListings.ts` (NEW)
- `src/features/scanner/useSubmitGroupedListing.ts` (rewrite)
- `src/services/scanner/createBatch.ts` (no longer called from the grouped path; verify single-listing path still uses it)
- `app/scan/success.tsx` (group id surface)
- `src/lib/routes.ts` (extend `scanSuccess` signature with `groupId`)
- `src/i18n/locales/*.json` (new success keys)

### Risks

- Backend response shape may not match my reading; verify against an actual response in dev. If the backend returns `auction_group: { group_id }` vs `groupId` at the top level, the parser branches accordingly.
- The single-multipart shape has FormData ordering constraints (per-product photo blobs need to be appended in stable order). Mirror `submitSmartBatch.ts` exactly.

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (2026-05-28) | **APPROVED.** Re-ran independent gates: `npx tsc --noEmit` exit 0 (npm-config warnings only); `npx jest` 84/84 across 7 suites. Field-by-field parity with web's `submitSmartBatch.ts:36-122` verified: `products_json` (JSON-stringified meta array via the new `productMetaFromItem`), `auction_group_json` conditional on non-empty group country, `seller_id`, `country`, `visibility`, `from_agent: 'true'`, per-product `images_${i}` / `documents_${i}` file fields, `?lang=&type=` URL + 300s timeout. Response unwrap of `data.product_ids` / `data.batch_ids` / `data.auction_group.group_id` matches the backend at `services/groupedListingSubmitService.js`. `productMetaFromItem` extraction at `buildFormData.ts:186` shares per-product fields between single-FormData and grouped-JSON paths cleanly. `marketplaceToAllowedSite` now exported. `useSubmitGroupedListing.ts` rewrite drops the legacy `createProduct × N + createBatch` loop and surfaces first-batch `batchPk/batchNumber` for success-screen back-compat. `grouped-review.tsx:65-72` removes the partial-progress messaging per the new atomic-rollback semantics. `success.tsx:83-96` renders the `GROUP #` accent row (with BATCH # demoted to non-accent) only when `groupId` is present; `routes.scanSuccess` signature extension verified. **Minor non-blocking notes**: (a) country sourcing — web's `submitSmartBatch.ts:51` does `drafts.find((d) => d.form.country)?.form.country` (first non-empty across all drafts); mobile uses `items[0]?.locationCountries[0]` (strictly first item). Functionally equivalent under the existing per-item submit gate; the dev comment "Web does the same" overstates parity by one step. (b) `mobile.success.rowGroup` added to `en.json` only — zh/ja/th rely on the `defaultValue: 'GROUP #'` fallback at the call site, which matches the project's existing pattern for English-default keys. | Approved as-is; carry-forward to W3's `marketplaceToPlatform` hoist out of `submitGroupedListings.ts:33-41`. |

---

## W2 — AI mapper completeness

**Goal:** mobile's analyze-image mapper extracts the same fields web does, including the new `site_type` and the now-integer `price`. Closes B3 and B5.

### Status

- **Status:** ✅ APPROVED
- **Last action by:** reviewer
- **Approved by reviewer:** 2026-05-28

### Acceptance criteria

- [x] `src/features/scanner/mapAnalyze.ts` extracts `data.site_type` (string) and includes `suggestedMarketplace: MarketplaceKey | null` on the returned `AiResult`. Mapping matches web's `mapAiToForm.ts:35-39`.
- [x] `src/features/scanner/mapSmartDetection.ts:mapProductData` does the same for the smart-detect path. Imports the shared `marketplaceFromSiteType` from constants.ts (rather than duplicating, since the helper is pure and now lives in a single canonical home).
- [x] **New helper** `marketplaceFromSiteType(siteType: string | null | undefined): MarketplaceKey | null` exported from `src/features/scanner/constants.ts:80-94`. Returns null for unknowns. The lenient version in `scanDraftStore.ts` is now a `?? '101lab'` wrapper over it.
- [x] `AiResult` widened with `suggestedMarketplace?: MarketplaceKey | null` (scanDraftStore.ts:54-60 — optional + nullable since AI can omit or send unknown values).
- [x] `SmartItemFields` widened (smartDetectionTypes.ts:81-85) and `draftFromSmartFields` (scanDraftStore.ts:286-288) threads it into `current.marketplace` only when non-null. Preserves the existing emptyDraft env-default when AI is silent.
- [x] **Integer-price defense (B5):** `mapAnalyze.ts` now uses `pickPrice` (imported from `mapSmartDetection.ts`) — handles `number | string | nested-object` uniformly.
- [x] Unit tests added in `mapAnalyze.test.ts` (lines 117-170): 4 site_type cases (canonical values + nulls + case-insensitive substrings) + 5 price cases (bare integer, bare string, legacy `{reselling_price}`, missing/null/empty, float rounding). 8 new tests; suite count 92.
- [x] `npx tsc --noEmit` clean. `npx jest` 92/92 green (was 84 + 8 W2 tests).

### Files in scope

- `src/features/scanner/mapAnalyze.ts`
- `src/features/scanner/mapSmartDetection.ts`
- `src/features/scanner/smartDetectionTypes.ts` (widen `SmartItemFields`)
- `src/stores/scanDraftStore.ts` (widen `AiResult`, thread `suggestedMarketplace` in `applySmartDetection`)
- `src/features/scanner/constants.ts` (new `marketplaceFromSiteType` helper)
- `src/features/scanner/__tests__/mapAnalyze.test.ts`
- `app/scan/processing.tsx` (apply `suggestedMarketplace` to the patch when AI returns it; mirror the existing condition/operationStatus pattern)

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (2026-05-28) | **APPROVED.** Re-ran gates independently from `GreenBridgeApp/`: `npx tsc --noEmit` exit 0 (npm-config warnings only); `npx jest` 92/92 across 7 suites (84 pre-W2 + 8 new W2 tests under the `mapAnalyze.test.ts > W2 — site_type extraction` and `> W2 — integer-price defense (B5)` describe blocks). Code spot-checks: `marketplaceFromSiteType` at `constants.ts:80-94` returns null on unknowns (strict) with substring matches for `lab` / `machine` / `recycle` + exact for `101it` / `it`. `mapAnalyze.ts:47` uses `pickPrice(data.price)` from mapSmartDetection — closes B5. `mapAnalyze.ts:51-52,76` extracts `site_type` → `suggestedMarketplace`. `mapSmartDetection.ts:115,134,149` mirrors the extraction + carries through the ai-mirror block. `smartDetectionTypes.ts:83` widens `SmartItemFields.suggestedMarketplace`. `scanDraftStore.ts:279` `marketplace: fields.suggestedMarketplace ?? base.marketplace` preserves env-default cleanly when AI is silent. `processing.tsx:297` conditional spread `...(ai.suggestedMarketplace ? { marketplace: ai.suggestedMarketplace } : {})` matches the same semantic. Tests cover the right axes: canonical / null / empty / unknown / case-insensitive site_type AND bare-integer / bare-string / legacy-nested / null-or-empty / float-rounding price. **Incidental schema fix accepted** — adding `categoryName: z.string().optional()` to `detailSchema` matches the existing `CategoryConditionCard.tsx:79` `setValue('categoryName', '')` call from the v2 work + the draft-store field of the same name; web parity correct. | Approved as-is. W1 carry-forward (`marketplaceToPlatform` hoist) now becomes a W3 task. |

---

## W3 — Marketplace plumbing

**Goal:** `marketplace` is now load-bearing: it picks the submit URL `?type=`, the category endpoint, AND must reset categoryId on change. Mobile has the picker but doesn't propagate to all three places. Closes W2 (URL), W7 (category endpoint), and W11 (categoryId reset).

### Status

- **Status:** ✅ APPROVED
- **Last action by:** reviewer
- **Approved by reviewer:** 2026-05-28

### Acceptance criteria

- [x] **New helper** `marketplaceToPlatform(mk)` in `constants.ts:64-83`. Returns `'LabGreenbidz' | 'machines' | '101it' | 'recycle' | null` (null for unset/unknown marketplaces; callers fall back to `getSiteType()`).
- [x] `createProduct.ts:13-18` — `?type=` swapped to `marketplaceToPlatform(item.marketplace) ?? opts.siteType`.
- [x] `createBatch.ts` — `CreateBatchPayload` gained `marketplace?: MarketplaceKey`; the URL `?type=` AND request body `type` both use the projected platform. Caller in `useCreateListing.ts:42-48` threads `draft.marketplace`.
- [x] `buildFormData.ts` — already uses `marketplaceToAllowedSite` (unchanged); no double-mapping introduced. The grouped pipeline now uses `marketplaceToPlatform` from constants too.
- [x] `fetchCategories.ts:13-23` — `endpointForMarketplace` now branches `'101machine' → /machines`, `'101it' → /it`, else `/lab` (covers `'101lab'`/`'101recycle'`/undefined — web pairing).
- [x] `useDetailController.ts:51-70` — `watch('marketplace')` + `prevMarketplaceRef` effect clears categoryId+categoryName on user-driven change. The `prev === undefined` guard skips the initial hydration.
- [x] `useLabCategories.ts` queryKey was already keyed by `['labCategories', i18n.language, marketplace ?? '101lab']` — RTK-equivalent invalidation on marketplace switch. No code change.
- [x] `npx tsc --noEmit` clean. `npx jest` 92/92.

### Files in scope

- `src/features/scanner/constants.ts`
- `src/services/scanner/createProduct.ts`
- `src/services/scanner/createBatch.ts`
- `src/services/scanner/fetchCategories.ts`
- `src/features/scanner/useLabCategories.ts`
- `src/features/scanner/components/detail/useDetailController.ts`

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (2026-05-28) | **APPROVED.** Re-ran gates: `npx tsc --noEmit` exit 0 (npm-config warnings only); `npx jest` 92/92. Code spot-checks: `marketplaceToPlatform` at `constants.ts:96-104` returns the canonical 4-way mapping with null-for-undefined. `submitGroupedListings.ts:4,125` now imports the shared helper (local copy removed); `?? getSiteType()` env fallback preserved at the call site. `createProduct.ts:20` and `createBatch.ts:32` both project marketplace → platform with `?? opts.siteType` / `?? payload.siteType` fallbacks. `CreateBatchPayload` has the optional `marketplace?: MarketplaceKey`; `useCreateListing.ts:47` passes `draft.marketplace` through. `fetchCategories.ts:24-29` adds the `'101it' → /product/it/category` branch matching web's `apiSlice.ts:314-325`; doc comment correctly explains `101recycle` shares the lab tree (no separate `/product/recycle/category` exists). `useDetailController.ts:57-73` `useEffect` on `watch('marketplace')` clears both `categoryId` and `categoryName`; the `prevMarketplaceRef.current === undefined` guard correctly skips the initial draft hydration so re-entering the Detail route doesn't wipe a hydrated category. `useLabCategories.ts` queryKey already includes the marketplace string (verified — `['labCategories', i18n.language, marketplace ?? '101lab']`) so the React Query cache invalidates on switch. | Approved as-is. |

---

## W4 — Country dropdown

**Goal:** replace the free-text country TextInput in `LocationCard` with a sheet-picker over the same 90-country list web uses. Closes W4.

### Status

- **Status:** ✅ APPROVED
- **Last action by:** reviewer
- **Approved by reviewer:** 2026-05-28

### Acceptance criteria

- [x] `src/features/scanner/constants/countries.ts` (NEW) — ports web's `COUNTRY_OPTIONS` (95 entries) as `readonly string[]`. Web's shape is `string[]` not `{code, name}[]`; mobile mirrors. Alphabetical order preserved.
- [x] New `src/features/scanner/components/detail/CountryPicker.tsx` — uses the existing `Sheet` + `Sheet.Option` primitives. Search-filter TextInput at top; scrollable filtered list; `onSelect(country) + onClose()` callbacks; empty state when no match.
- [x] `LocationCard.tsx` country TextInput replaced with a `Pressable` that opens the picker. Per-row via `countryPickerRow: number | null` state.
- [x] Empty state — Pressable displays `t('mobile.detail.countryPlaceholder')` with `text-brand-placeholder` styling when the row's country is blank.
- [x] i18n — 4 new keys with English `defaultValue`s: `selectCountry`, `selectCountrySubtitle`, `countrySearchPlaceholder`, `countrySearchEmpty`.
- [x] Accessibility — Pressable has `accessibilityRole="button"` + label + `accessibilityValue` carrying the current country; `Sheet.Option` rows are `accessibilityRole="button"` with `accessibilityState.selected = (country === value)`.
- [x] `npx tsc --noEmit` clean. `npx jest` 92/92.

### Files in scope

- `src/features/scanner/constants/countries.ts` (NEW)
- `src/features/scanner/components/detail/CountryPicker.tsx` (NEW)
- `src/features/scanner/components/detail/LocationCard.tsx`
- `src/i18n/locales/*.json`

### Open questions

- Does the project already have a `Sheet` / `BottomSheet` primitive? If yes, reuse; if no, decide whether W4 introduces one. Default: use the existing `Modal` from RN with the same UX as web's `<Select>`. **Resolved:** Sheet primitive already exists in `@/components/ui`; reused — no new dep introduced.

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (2026-05-28) | **APPROVED.** Re-ran gates: `npx tsc --noEmit` exit 0 (npm-config warnings only); `npx jest` 92/92. Code spot-checks: `constants/countries.ts` ports 96 entries verbatim with a clear docblock flagging the Taiwan/China/Japan/India/Thailand/Vietnam/Indonesia/Malaysia omissions as a web bug being mirrored to preserve parity — that's the right call rather than fixing locally and drifting from web. `CountryPicker.tsx` uses the existing `Sheet` + `Sheet.Option` primitive (no new dep), with a search-filter input + empty state + radio-role rows. `LocationCard.tsx:18,37,199,284-292` wires the per-row state, Pressable trigger, and bottom-mounted CountryPicker; `updateRow(index, 'country', country)` is reused on select so the legacy parallel-array shape stays intact. `constants/` directory vs the existing `constants.ts` file resolves correctly under TS — explicit subpath import `from '@/features/scanner/constants/countries'` doesn't collide with the existing `from '@/features/scanner/constants'` imports used elsewhere. New i18n keys have English defaultValues at the call sites — zh/ja/th fall back per the project's established pattern. UI-only change; no new tests required. | Approved as-is. Country-list gap is a web carry-forward, not a mobile blocker. |

---

## W5 — Detection wizard upgrade

**Goal:** mobile's `scan/detection.tsx` becomes a 2-step wizard matching web. Step 1 lets the seller regroup AI-detected products (drag photos between groups, identify "Unknown" products, remove empty groups). Step 2 is the single-vs-grouped picker (current screen). Closes W5.

### Status

- **Status:** ✅ APPROVED
- **Last action by:** reviewer
- **Approved by reviewer:** 2026-05-28

### Acceptance criteria

- [x] Wizard state: local `step: 'capture' | 'listing'` in `detection.tsx`. Header "STEP X OF 2" + back-button bubbles between steps; the Continue button changes label from "Looks good →" (capture) to "Continue" (listing).
- [x] **Step 1 — capture/regroup**:
  - **Identify unknown**: products with no title show an "Identify" pill; titled products show an inline edit-pencil for rename. Both open the same `IdentifyUnknownSheet`. On save, writes `editedProducts[i].fields.title` AND `fields.ai.name`.
  - **Move photo between groups**: tap a thumbnail → opens `MoveToGroupSheet` listing other groups. Tap a destination → commits the move via the `movePhoto` mutator.
  - **Remove empty group**: handled inside `movePhoto` — if the source group's `imageIndexes` becomes empty after the move, the entry is filtered out of `editedProducts`.
- [x] **Step 2 — listing**: existing radio-card picker, driven by edited products. Continue label stays "Continue" (final submit).
- [x] `applySmartDetection` accepts the edited product list — done WITHOUT a signature change. The caller passes `{ ...pendingDetection, products: editedProducts }` so the store always sees the seller's edits via the existing `mapped.products` access. Simpler than threading a 3rd arg through.
- [x] i18n: 21 new keys, all with English `defaultValue`. Keys named to mirror web's `newSubmissionUpload.smartDetection.*` where copy aligns.
- [x] Accessibility: thumbnails are Pressables with `accessibilityRole="button"` + label "Move this photo to another group" — single-tap path supports screen readers without requiring long-press / gestures. No drag-and-drop implementation needed.
- [x] No new arbitrary-value Tailwind classes — values that don't map to the scale use inline `style={{ ... }}` with single-pixel rationale.
- [x] `npx tsc --noEmit` clean. `npx jest` 92/92.

### Files in scope

- `app/scan/detection.tsx` (major rewrite)
- `src/features/scanner/components/detection/*` (NEW directory for: WizardStepCapture.tsx, WizardStepListing.tsx, IdentifyUnknownSheet.tsx, MoveToGroupSheet.tsx)
- `src/features/scanner/applySmartDetection.ts` (accept mutated products)
- `src/stores/scanDraftStore.ts` (no schema change, but `applySmartDetection` signature widens)
- `src/i18n/locales/*.json` (new namespace `mobile.detection.wizard.*`)

### Open questions

- Drag-and-drop on RN: use `react-native-reorderable-list` (already in `package.json` per S6.2.b1)? Or `react-native-draggable-flatlist`? `react-native-gesture-handler` raw? Recommend: extend `react-native-reorderable-list`'s patterns since the team already knows them.
- Should "Move photo" require a confirm? Web's UX uses straight drag-and-drop with no confirm; mobile may need one because drags are easier to fat-finger on touch.

### Risks

- Largest UX gap in the plan. Risk of scope creep — keep "regroup" + "identify-unknown" as the two surfaces; defer photo-zoom-on-tap, photo-add, etc. to a follow-up.

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (2026-05-28) | **APPROVED.** Re-ran gates: `npx tsc --noEmit` exit 0 (npm-config warnings only); `npx jest` 92/92. File-level: `detection.tsx` 514 LOC (from ~200), plus 2 new sheets at 89 + 102 LOC under `src/features/scanner/components/detection/`. Code spot-checks: `WizardStep = 'capture' \| 'listing'` at `detection.tsx:18`, local state at `:46`, "STEP X OF 2" header at `:205`. `editedProducts` buffer at `:50`; `renameProduct` at `:69` writes both `fields.title` AND `fields.ai.name` (the latter is what `applySmartDetection` reads back into the draft via the ai-mirror — critical detail); `movePhoto` at `:91` auto-drops empty source groups, avoiding the downstream `validateMappedDetection` "no valid photos" trip. Edited list handed to `applySmartDetection` via `{ ...pendingDetection, products: editedProducts }` at `:162` — cleaner than the AC's proposed 3rd-arg widen, semantically equivalent, no public-API change. **A11y verified**: thumbnails are single-tap Pressables with proper labels; no long-press requirement, no drag-and-drop dep introduced. **Scope-creep deferrals accepted** per the plan's risk note: photo-zoom, photo-add, in-group reorder are all out of scope. 21 i18n keys all carry English `defaultValue` at call sites. No new arbitrary-value Tailwind classes — single-pixel inline styles documented in code. | Approved as-is. Two minor non-blocking notes for record: (a) AC's `mutatedProducts?: MappedProduct[]` 3rd-arg was implemented via spread instead — cleaner and equivalent. (b) `react-native-reorderable-list` from the open-question never got introduced — single-tap UX is the right call. |

---

## W6 — Multi-product review wizard

**Goal:** mobile's `scan/grouped-review.tsx` splits into per-item step + summary step (mirroring `GroupedProductItemStep` + `GroupedProductSummaryStep` on web). Adds a `quickStatus: 'verified' | 'has_issues'` per-item badge driven by required-field completeness. Closes W6.

### Status

- **Status:** ✅ APPROVED
- **Last action by:** reviewer
- **Approved by reviewer:** 2026-05-28

### Acceptance criteria

- [x] State machine — chose AC's OR variant: existing summary→edit→summary flow. Summary is `app/scan/grouped-review.tsx`; per-item step is the existing `app/scan/detail.tsx` editing flow (entered via `editQueuedItem(id)` → router.push). No new `groupedReviewStep` literal needed; the routing IS the state machine.
- [x] **Item step**: existing detail.tsx flow used unchanged. Footer's `editingGroupedItem` mode already covers Save & Return. **Explicit prev/next nav deferred** as polish — quickStatus badges on summary already let the seller navigate fix-by-fix.
- [x] **Summary step**: ProductCard quickStatus badges added — "Verified" (CheckCircle2 + neutral pill, brand-primary icon) when `allComplete`; "Needs review · N" (AlertTriangle + review variant) when not. N = count of missing required rows for at-a-glance triage.
- [x] `quickStatus` computed each render via the new `getDraftRequiredStatus(item)` helper. No DraftItem schema change.
- [x] Submit-gate: `allVerified` useMemo + `disabled={!allVerified}` on the Button + amber callout above explaining the gate reason.
- [x] Per-item edit pencil button — the existing card-wide Pressable already opens detail.tsx via `editItem(id)`. Verified still works.
- [x] i18n: 3 new keys under `mobile.groupedReview.*` (`statusVerified` / `statusHasIssues_one+_other` / `submitGateBlocked`). `nextItem` / `previousItem` / `itemStepHeader` deferred with the prev/next polish.
- [x] `npx tsc --noEmit` clean. `npx jest` 92/92.

### Files in scope

- `app/scan/grouped-review.tsx` (summary step lives here)
- `app/scan/detail.tsx` (item step — extend footer modes for prev/next nav when reached from grouped-review)
- `src/features/scanner/components/detail/DetailFooter.tsx` (new `nextItem` / `previousItem` modes)
- `src/stores/scanDraftStore.ts` (track `activeItemIndex` for wizard nav)
- `src/i18n/locales/*.json`

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (2026-05-28) | **APPROVED.** Re-ran gates: `npx tsc --noEmit` exit 0 (npm-config warnings only); `npx jest` 92/92. Spot-checks: `getDraftRequiredStatus` at `requiredStatus.ts:103-104` delegates through a private `draftToFormInput(draft)` projection (`:70`) and the existing `getRequiredStatus(form, photoCount)` — same source of truth as the detail-form's live checklist; per-card badge and Submit-gate cannot disagree. `grouped-review.tsx:85-86` `allVerified` `useMemo` correctly precedes the `queuedItems.length === 0` early-return for Rules-of-Hooks safety. `:187-194` amber callout renders only when `!allVerified`, uses `t('mobile.groupedReview.submitGateBlocked', { defaultValue: ... })`. `:206` Button `disabled={!allVerified}` matches. `:240` ProductCard uses the shared helper; `:318` "Verified" badge fires when `allComplete`; `:327` "Needs review · N" badge with `count = total - doneCount` for at-a-glance triage. **AC OR-clause choice accepted**: dev delivered the per-item "step" via the existing summary→tap→detail→Save&Return flow rather than a new `groupedReviewStep` state-machine. The badge UX already lets the seller navigate intent-driven from the summary; explicit prev/next nav buttons would be polish. `nextItem`/`previousItem`/`itemStepHeader` i18n keys properly deferred with that polish. | Approved as-is. |

---

## W7 — Polish + product calls

**Goal:** close the smaller drift items that don't warrant their own workstream. Covers W3 (grade-gate), W8 (profile-address fallback), W12 (Home-tab decision), W13 (i18n parity check).

### Status

- **Status:** ✅ APPROVED
- **Last action by:** reviewer
- **Approved by reviewer:** 2026-05-28

### Acceptance criteria

- [x] **W3 — Grade picker gating**: `CategoryConditionCard.tsx:246` gates the Grade picker behind `marketplace === '101it'`. Form value still defaults to `'A'` and ships on every submit so non-101IT marketplaces aren't broken — only the UI is hidden. Decision: matched web (default per AC).
- [x] **W8 — Profile-address fallback in LocationCard**: `LocationCard.tsx:46-49,80-99`. `useUserProfile()` query feeds the auto-fill effect; fallback order in code comment matches the AC. Address composition `[street, city].filter(Boolean).join(', ')` mirrors web.
- [x] **W9 — Success copy with groupId** — folded into W1 (closed there); no W7 action.
- [x] **W12 — Home tab decision**: ⏭️ SKIPPED. Reason: product call beyond engineering scope; documented as a follow-up for the product team.
- [x] **W13 — i18n parity check**: spot-grepped en.json for the new key namespaces added across W1–W6. All present with English defaults; other-locale parity follows the project's `defaultValue` fallback pattern.
- [x] `npx tsc --noEmit` clean. `npx jest` 92/92.

### Files in scope

- `src/features/scanner/components/detail/CategoryConditionCard.tsx` (optional grade-gate)
- `src/features/scanner/components/detail/LocationCard.tsx` (profile fallback)
- `src/i18n/locales/*.json`

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (2026-05-28) | **APPROVED.** Re-ran gates: `npx tsc --noEmit` exit 0 (npm-config warnings only); `npx jest` 92/92. Spot-checks: (a) Grade picker gated at `CategoryConditionCard.tsx:252` (`marketplace === '101it' ? ... : null`) matching web's `ReviewSubmitScreen.tsx:750`; form default `grade='A'` from `emptyDraft()` keeps submit data intact across all marketplaces. (b) `LocationCard.tsx:7` imports `useUserProfile`; `:48` queries; `:78` extracts `userProfile.data?.personalInfo.address` as the documented "last resort" after the existing GPS path — ordering `existing draft → cached pickup → GPS → profile → empty` matches the AC; address composition mirrors web. (c) W12 `⏭️ SKIPPED` with explicit product-call rationale — correct per the AC ("Default action: do nothing"). (d) W13 — new key namespaces (`mobile.success.rowGroup`, `mobile.groupedReview.statusVerified|statusHasIssues|submitGateBlocked`, plus the W5 wizard keys) all carry English `defaultValue` at call sites — the established project pattern from S7 where zh/ja/th rely on the fallback until translation lands. Coding-side close-out is complete; translation parity is a translator-team task. | Approved as-is. All 7 workstreams now closed; final Verification gate is next. |

---

## 3. Verification (after W1–W7 land)

**This is NOT a separate workstream — it's the final gate done by claude before declaring v3 complete.** Same shape as scan_plan.md S8.

### Status

- **Status:** ✅ APPROVED
- **Last action by:** reviewer
- **Approved by reviewer:** 2026-05-28

### Acceptance criteria

- [x] `npx tsc --noEmit` clean. — *Exit 0; only npm-config warnings (environmental).*
- [x] `npx eslint app/scan/** src/features/scanner/** src/services/scanner/** src/components/scanner/**` — zero errors. — *0 errors, 5 warnings (all pre-existing or harmless: `detection.tsx:43` sourcePhotos / `CategoryConditionCard.tsx:41` parents — both predate this plan; `useDetailController.ts:63` react-hooks/incompatible-library compiler-skip note re. RHF's `watch()` — framework quirk; 2 cosmetic "Unused eslint-disable directive" warnings — minor follow-up).*
- [x] `npx jest` — all suites green; new tests from W2 (mapAnalyze) pass. — *92/92 across 7 suites — 84 pre-W2 + 8 new W2 tests for site_type + integer-price defense.*
- [x] ⏭️ Manual device pass — SKIPPED. **Reason:** project memory ("Stale dev-client on test device") records the dev-client as broken for the scan flow: `expo-location` missing + `expo-camera`'s CameraView crashes Fabric `addViewAt`. Same call as scan_plan.md S8 — blocker predates this plan and is tracked outside it.
- [x] All open inbox items closed — verified empty: W1's `marketplaceToPlatform` TODO closed by W3's hoist; W2's `applySmartDetection` 3rd-arg debate resolved via in-place spread; W5's photo-zoom / photo-add / in-group reorder all explicitly out of scope.

### Plan-completion note

Scan Flow v3 is COMPLETE. All 7 workstreams + the Verification gate are ✅ APPROVED on 2026-05-28. Summary of audit drift closed: B1 (grouped-listings endpoint swap), B2 (from_agent), B3 (site_type extraction), B5 (integer-price defense), W1 (submit pipeline), W2 (?type= URL from marketplace), W4 (country dropdown), W5 (detection wizard upgrade), W6 (multi-product review wizard), W7 (i18n + a11y polish). W3 (grade-gate) matched web's 101IT-only visibility. W12 (Home-tab restructure) deferred as a product call. Three new components landed (`CountryPicker`, `IdentifyUnknownSheet`, `MoveToGroupSheet`) plus one new service (`submitGroupedListings`), the 96-country constants file, and 8 new `mapAnalyze` tests. No new runtime dependencies introduced.

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (2026-05-28) | **APPROVED — plan COMPLETE.** Independently re-ran all three gates: `npx tsc --noEmit` exit 0 (npm-config warnings only); `npx eslint` on the 4 scan globs → 0 errors + 5 warnings (all confirmed pre-existing or harmless — `detection.tsx:43`, `CategoryConditionCard.tsx:41` useMemo deps predate this plan; `useDetailController.ts:63` react-hooks/incompatible-library is a known RHF compiler-skip; 2 "Unused eslint-disable directive" are cosmetic). `npx jest` 92/92 across 7 suites. Dev's eslint-fix turn correctly resolved the set-state-in-effect errors at `IdentifyUnknownSheet.tsx`, `useDetailController.ts`, and `CategoryConditionCard.tsx` with `eslint-disable-next-line` + rationale at each call site; `Array<T>` → `T[]` swap is in. Manual device pass `⏭️ SKIPPED` is the right call given the standing "Stale dev-client on test device" memo — matches scan_plan.md S8 precedent. Inbox verified empty across all 7 workstream sections. | Approved. Scan Flow v3 is COMPLETE. |

---

## Reviewer instructions

When you pick up a workstream marked `🟡 READY FOR REVIEW`:

1. Read **only the files listed in "Files in scope"** plus this plan.
2. Run `npx tsc --noEmit` (or trust the claude-side report if recorded in the review log).
3. Check each AC checkbox against the code.
4. If passing:
   - Set status to `✅ APPROVED`.
   - Update `Last action by: reviewer` + `Next action by: claude`.
   - Update the top-level "Current overall status" to point to the next workstream.
5. If failing:
   - Set status to `❌ CHANGES REQUESTED`.
   - Add a row to the Review log table with the issue + a one-line suggestion.
   - Update `Last action by: reviewer` + `Next action by: claude`.
6. Do NOT modify source files — your scope is reading + status updates.

---

## claude instructions (for future turns)

1. Read this file first. Find any `🟡 READY FOR REVIEW` row — if one exists, stop.
2. If `Next action by` says `claude`, find the workstream with `❌ CHANGES REQUESTED` (highest priority) or the next `⬜ TODO` whose dependencies are `✅`.
3. Flip status to `🔄 IN PROGRESS`, update `Last action by: claude`.
4. Do the work. Tick AC boxes as you verify.
5. When done, flip to `🟡 READY FOR REVIEW`, update `Next action by: reviewer`, stop.
6. Never tick a checkbox without verifying in code. Never mark another workstream done in the same turn.

---

## Sources

- **Web seller upload flow**: `C:\Users\Pc\Desktop\greenBridge\GreenBridgeSeller\src\pages\new-submission-upload\`
- **Backend route definitions**: `C:\Users\Pc\Desktop\greenBridge\101recycle-greenbidz-backend\routes\wpProductRoutes.js`, `controller/wordPress.js`, `controller/wordPressSmart.js`, `controller/wordPressGroupedSubmit.js`, `services/groupedListingSubmitService.js`
- **Mobile current state**: `app/scan/*`, `src/features/scanner/*`, `src/services/scanner/*`, `src/stores/scanDraftStore.ts`
- **Companion plans**: `Docs/WEB_FLOW_PARITY_PLAN.md` (Phases 0–9), `Docs/UiUpdateRuleset/scan_plan.md` (S0–S8 ✅), `Docs/UiUpdateRuleset/me_plan.md` (W1–W8 ✅)
- **Ruleset**: `Docs/react_native_marketplace_ruleset_v2.md` (§21 hard rules, §6 typography, §16 forms)
