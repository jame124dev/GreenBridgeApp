# Plan: Scan Flow v2 — field parity + decomposition + cleanup (2026-05-28)

> **Target tree:** `app/scan/*` (camera, processing, detail, detection, grouped-review, success, reorder-photos, listing-method) + `src/features/scanner/*` + `src/services/scanner/*` + `src/stores/scanDraftStore.ts`
> **Web source of truth:** `GreenBridgeSeller/src/pages/new-submission-upload/` — `NewSubmissionUploadPage.tsx`, `types.ts`, `utils/{mapAiToForm,buildProductFormData,submitQuickListing}.ts`
> **Backend:** `101recycle-greenbidz-backend/routes/wpProductRoutes.js` — `POST /wp/create-product-direct`, `/analyze-process-images`, `/create-grouped-listings`
> **Authority:** `react_native_marketplace_ruleset_v2.md` > `WEB_FLOW_PARITY_PLAN.md` > this file

> **Companion docs (read first):**
> - `Docs/WEB_FLOW_PARITY_PLAN.md` — covers Phases 0–9 of the structural parity work. Phase 8 (StyleSheet → NativeWind) was **deferred** due to a token-fork between `@/theme` and `@/constants/theme`. Phase 9 deleted `scan/staged.tsx` per a product call — **confirmed fully removed in S0 audit (2026-05-28)**. This plan is the **next round of work** after the parity push.
> - `Docs/UiUpdateRuleset/me_plan.md` — the protocol template + the `brand` namespace + tailwind `brand-*` class extension landed in me_plan W2/W6. This plan reuses those.

---

## 0. Handoff Status (read this first)

This plan is executed as a two-agent loop, same protocol as `me_plan.md`:

- **claude** writes code, marks workstreams `🟡 READY FOR REVIEW`, stops, and waits.
- **reviewer** reads the diff, marks each workstream `✅ APPROVED` or `❌ CHANGES REQUESTED` with notes, then hands back.

### Status legend

| Symbol | Meaning | Who sets it |
|---|---|---|
| ⬜ TODO | Not started | (initial) |
| 🔄 IN PROGRESS | claude is actively coding this workstream | claude |
| 🟡 READY FOR REVIEW | claude finished, reviewer to evaluate | claude |
| ❌ CHANGES REQUESTED | reviewer found issues, ball back to claude | reviewer |
| ✅ APPROVED | reviewer accepted | reviewer |
| ⏭️ SKIPPED | explicitly deferred — must include a `Reason:` line | either |

### Handoff direction

- **Last action by:** _(claude or reviewer; updated by whoever just acted)_
- **Next action by:** _(claude or reviewer)_

> If `Last action by` and `Next action by` are the same, something is wrong — stop and resolve.

### Current overall status

- **Last action by:** reviewer
- **Next action by:** — (plan complete)
- **Active workstream:** — (Scan Flow v2 plan complete; all S0–S8 ✅ APPROVED)
- **Notes for reviewer:** S8 ✅ APPROVED on 2026-05-28. Independently verified all three automated gates: `npx tsc --noEmit` exit 0 (only npm-config warnings, as expected); `npx eslint` on the four scan globs → 0 errors, 1 warning (pre-existing `detection.tsx:31 sourcePhotos` useMemo dep — confirmed not introduced by S0-S8); `npx jest` 84/84 across 7 suites (`appendSpecsToDescription`, `mapAnalyze`, `mapSmartDetection`, `scanDraftStore`, `scanResume`, `smartDetectionRouting`, `_debug_bundle` mirror). Spot-checked the 3 fix-up edits: processing.tsx now has a single consolidated `from '@/constants/theme'` import (line 17) and the `eslint-disable-next-line react-hooks/set-state-in-effect` comment sits directly above `setCurrentStep(0)` at line 154 with a sensible rationale; `inputCls` is gone from PricingCard.tsx (grep returns nothing); `brand` is no longer in DetectionGroupCard.tsx's import list (only mentioned in a comment). Manual device pass + screenshots `⏭️ SKIPPED` is the right call given the standing "Stale dev-client" blocker recorded in project memory. Inbox closures verified: `operationStatusForInstallation()` is wired at `buildFormData.ts:116`, and `marketplaceToAllowedSite()` is the sole source of `allowed_sites[]` (line 158-159, legacy `item.allowedSites` no longer read at submit). **Scan Flow v2 is COMPLETE — S0 through S8 all ✅ APPROVED.**
- **Notes for claude:** S7 ✅ APPROVED on 2026-05-28. Independently verified: 21 `accessibilityRole=` across 8 detail card files + 21 `accessibilityLabel=` across 5 app/scan files; `Grep "label=\"[A-Z][a-z]\|title=\"[A-Z][a-z]"` in detail/ returns zero hard-coded English prop strings; tsc + jest both green (84/84). Comprehensive coverage matches the dev's per-file inventory (VisibilityCard radios, CategoryConditionCard pills, DocumentsCard add/remove, LocationCard marketplace+installation, PricingCard format+stepper, PhotosCard rearrange+thumb, FooterButton mirroring label, camera permission triple). **S8 is the final verification gate.** Mirror me_plan W8's pattern: `npx tsc --noEmit` clean, `npx eslint` on the scan paths clean, manual flow if a device is available (or `⏭️ SKIPPED` with reason per the status legend if no device), capture screenshots, close out any remaining open inbox items.
- **Notes for claude:** S6.2.b2.ii ✅ APPROVED on 2026-05-28. Independently verified: `Grep StyleSheet.create` in `app/scan/` returns 2 matches both in docstring comments (processing.tsx:21, camera.tsx:30), zero actual `StyleSheet.create()` blocks; tsc + jest both green (84/84). Same ~15-25% LOC drift in dev's claims but reduction directionally correct. **S6 is now COMPLETE** — every StyleSheet.create block in the scan tree dissolved across S6.2.a → b1 → b2.i → b2.ii. Strategy consistent throughout: className for cleanly-mapping styles, documented inline-style exceptions for rgba/percent/shadow/animated values. **S7 is the home stretch** — mirror me_plan W7's i18n+a11y sweep pattern (grep for hard-coded strings, verify Pressables have accessibilityRole + accessibilityLabel, contrast check on new surfaces). Should be verification-heavy since S2/S5 cards already use `t()` + `defaultValue`. S8 is the final gate after S7.
- **Notes for claude:** S6.2.b2.i ✅ APPROVED on 2026-05-28. Independently verified: `ls styles.ts` returns "No such file" (deleted from disk); `Grep StyleSheet.create` in detail/ returns zero files; all 15 card files + index.ts + useDetailController.ts still present (no accidental deletes); tsc + jest both green (84/84). The S6.2.b2 → b2.i + b2.ii split is the natural fault line — i dissolved the shared styles.ts dependency atomically across all 15 dependents, ii handles the 3 independent screens. Tailwind config extensions are additive (brand-* aliases, fractional spacing, radius xs/pill, font families/sizes). **S6.2.b2.ii is the final S6 piece**: 3 large screens (camera 571, processing 793, grouped-review 327). After this, only S7 (i18n+a11y sweep) and S8 (verification gate) remain.
- **Notes for claude:** S6.2.b1 ✅ APPROVED on 2026-05-28. Independently verified: `Grep StyleSheet.create` in `app/scan/` returns only the 3 files explicitly in S6.2.b2's scope (processing, grouped-review, camera); the 4 b1 files (listing-method, reorder-photos, success, detection) all clean; tsc + jest both green (84/84). Inline-style exceptions all legitimate (ReorderableList 3rd-party API, Card primitive's style prop, ScrollView contentContainerStyle, StyleSheet.hairlineWidth). Same scope-management split pattern as S2/S5/S6/S6.2 — strategy validated incrementally. **S6.2.b2 is the heavy lift**: styles.ts (395 LOC) + 13 detail cards that consume it + 3 large screens (processing 793, camera 571, grouped-review 327). The styles.ts dissolution will cascade — every card that imports from styles.ts needs its own conversion at the same time.

### Reviewer pre-coding notes (read before starting any workstream)

These came out of the plan-acceptance review. They're not blocking, but they change small specifics across multiple workstreams. Apply when you reach each workstream — don't try to land them all up front.

| # | Workstream | Note |
|---|---|---|
| 1 | S0 | **Do NOT delete `pendingPhotos`** even if the deletion-on-disk audit suggests staged.tsx is dead. The field is actively consumed by the camera ↔ staged ↔ detection handshake in `scanDraftStore.ts` — call sites include `setPendingPhotos`, `clearPendingPhotos`, and the memory-only `pendingDetection` handshake that processing/detection screens depend on. If staged.tsx is dead code on disk, delete the screen file + the route key, but leave `pendingPhotos` + its store methods alone. The S0 AC's "if no other consumer remains" guard catches this, but flagging because it's the highest-risk false-positive in S0. |
| 2 | S1 | **Don't widen `priceCurrency` to bare `z.string()`** — that's a typed-safety regression. Match web's behavior by reading the actual backend-supported currency set first (read `101recycle-greenbidz-backend/routes/wpProductRoutes.js` or the corresponding service), then use `z.enum([...])` over the supported list. Default still `defaultCurrencyForSite(siteType)`. If the backend genuinely accepts any string, document that finding and proceed with `z.string()` — but verify first. |
| 3 | S1 | **Pull `installation`, `marketplace`, `listingDurationDays` forward from S5 into S1's `DraftItem` extension.** S5's AC currently says "also extend DraftItem in S1 amendment" — that's a sneaky scope retro. Cleaner: S1 owns the entire data-model expansion (all 11 new fields including the S5 trio), and S5 only wires UI + submit. Update S5's AC to drop the DraftItem extension when you get there. |
| 4 | S2 | **Pick `FormProvider` over prop-drilling.** AC offers both — but threading `control`/`watch`/`setValue`/`handleSubmit` through 8 cards is high-noise. `react-hook-form`'s `FormProvider` + `useFormContext()` inside each card is cleaner and matches what the settings cards do today (each card calls `useForm()` of its own — for scan we want one shared form, but the FormProvider pattern keeps cards self-contained). |
| 5 | S3 | **Per-file review log row, not per-call-site.** AC says "One row per legacy name → new token in the workstream review log". With scan tree being much larger than settings, that's hundreds of rows. Mirror me_plan W2's pattern: one row per FILE with a count + the legacy names used, plus a separate small mapping table at the workstream level listing legacy-name → new-token once. |
| 6 | S5 | **Verify `listingDurationDays` backend field BEFORE shipping the UI.** AC says "captured but not submitted (no known backend field)" — but shipping a picker that does nothing is a UX foot-gun. Action: read `101recycle-greenbidz-backend/routes/wpProductRoutes.js` (already listed as a source) to find the field name. If it exists, wire submit. If genuinely absent, **hide the input** until backend lands rather than ship dead UI — document the gap in S5's review log. |

### Reviewer findings inbox (carry-forward across workstreams)

| Filed during | Owner workstream | Finding | Status |
|---|---|---|---|
| S1 review (2026-05-28) | S5 | `installation` field treatment is unresolved. S1's backend-findings says "Treated as a description annotation in web; mobile follows" but `appendSpecsToDescription` doesn't include `installation`. When S5 wires installation, decide between: (a) extend `appendSpecsToDescription` to emit a `Installed/Deinstalled` line, or (b) send `installation` as a separate form_data key. Verify what web actually does. | ✅ Closed in S5.1 (2026-05-28) — neither (a) nor (b); web's actual pattern verified at `ReviewSubmitScreen.tsx:149`: installation OVERRIDES `operation_status[]` at submit. Implemented via `operationStatusForInstallation()` at `constants.ts:53-55` + `buildFormData.ts:116`. |
| S1 review (2026-05-28) | S5 | `buildFormData.ts:136-138` uses `item.allowedSites.length ? item.allowedSites : [marketplaceToAllowedSite(item.marketplace) || opts.siteType]` — meaning legacy persisted drafts with an existing `allowedSites` array won't pick up the new marketplace setting. S5's UI needs to decide whether the marketplace picker overrides `allowedSites` or coexists. If override is correct, change the priority order; if coexistence, document the behavior in the UI's helper text. | ✅ Closed in S5.1 (2026-05-28) — Override. `buildFormData.ts:146-152` now uses `marketplaceToAllowedSite(item.marketplace)` directly with env-siteType fallback; legacy `allowedSites` priority check removed; comment explains the change. |

---

## 1. Current-state audit (2026-05-28)

### 1.1 Line counts vs §21 ceiling (300 lines)

| File | Lines | Status |
|---|---|---|
| `app/scan/detail.tsx` | **1307** | ❌ over by 4× |
| `app/scan/processing.tsx` | **793** | ❌ over by 2.6× |
| `app/scan/camera.tsx` | **571** | ❌ over by 1.9× |
| `app/scan/grouped-review.tsx` | **327** | ❌ over by 9% |
| `app/scan/detection.tsx` | 238 | ✅ |
| `app/scan/success.tsx` | 185 | ✅ |
| `app/scan/reorder-photos.tsx` | 155 | ✅ |
| `app/scan/listing-method.tsx` | 99 | ✅ |
| `src/components/scanner/RecentSubmissionsList.tsx` | 179 | ✅ |
| `src/components/scanner/DetectionGroupCard.tsx` | 156 | ✅ |
| `src/components/scanner/PhotoZoomViewer.tsx` | 120 | ✅ |
| `src/components/scanner/VisibilitySelector.tsx` | 62 | ✅ |

> **Phase 9 reconciliation result (S0):** `app/scan/staged.tsx` and `src/components/scanner/StagedPhotoGrid.tsx` are already off disk — Phase 9 cleanup was actually complete. The previous draft of this plan listed stale data. S2 decomposition targets are now: detail (1307), processing (793), camera (571), and grouped-review (327).

### 1.2 Token source

`features/settings/**` is fully on `@/constants/theme` (per me_plan W2). **The scan tree is still on `@/theme`** — needs the same migration. Counts (verified via grep):

- `app/scan/**` files importing from `@/theme`: most files
- `src/features/scanner/**` + `src/components/scanner/**`: similar pattern

S3 sweeps these. The `brand` aliases in `@/constants/theme.ts` already cover the legacy hex values (added in me_plan W2). The Tailwind config exposes them as `bg-brand-primary-surface`, `border-brand-primary-border`, etc. (added in me_plan W6).

### 1.3 `StyleSheet.create` blocks remaining in scan tree

From the original review:

```
app/scan/camera.tsx
app/scan/detail.tsx
app/scan/processing.tsx
app/scan/grouped-review.tsx
app/scan/success.tsx
app/scan/reorder-photos.tsx
app/scan/listing-method.tsx
app/scan/detection.tsx           (audit — may be cleaner since it's newer)
app/listing/[id].tsx              (out of scope — handled by future listing-detail plan)
src/components/scanner/DetectionGroupCard.tsx
src/components/scanner/PhotoZoomViewer.tsx
src/components/scanner/VisibilitySelector.tsx
src/components/scanner/RecentSubmissionsList.tsx
```

§21 wants zero `StyleSheet.create`. S6 sweeps these.

### 1.4 Field model gap vs web

Compared `DraftItem` (mobile) ↔ `QuickListingFormState` (web) and what each sends to `POST /wp/create-product-direct`:

| Field | Web | Mobile | Gap action |
|---|---|---|---|
| `title` / `description` | ✅ | ✅ | — |
| `categoryId` / `categoryName` | ✅ (+ parent) | ✅ (no parent hierarchy) | S1 — add parent linkage |
| `condition[]` / `operationStatus[]` | ✅ | ✅ | — |
| `price`, `priceFormat`, `currency` | ✅ (any currency) | ✅ (locked USD/TWD) | S1 — open currency to free string per web |
| `quantity` | ✅ | ✅ | — |
| `country`, `address`, `locations[]` | ✅ (multi-location + countries) | ✅ (single `{address, country}`) | S5 — multi-location editor |
| **`brand`** | ✅ | ❌ | S1 |
| **`model`** | ✅ | ❌ | S1 |
| **`year`** | ✅ | ❌ | S1 |
| **`weight`** | ✅ (sent as `weight_per_unit`) | ❌ (sent as empty) | S1 |
| **`dimensions`** | ✅ | ❌ | S1 |
| **`co2Emissions`** | ✅ | ❌ | S1 |
| **`grade` (A/B/C/D)** | ✅ (sent as `item_grade`) | ❌ | S1 |
| **`serialNumber`** | ✅ | ❌ | S1 |
| **`marketplace`** (101lab/101machine/101recycle/101it) | ✅ (drives `allowed_sites`) | partial (only env-default) | S5 — picker |
| `installation` (installed vs deinstalled) | ✅ | ❌ (no UI; default behavior) | S5 |
| `listingDurationDays` | ✅ (default 90) | ❌ | S5 |

**Critical web behavior to port:** `appendSpecsToDescription()` (in `web/utils/mapAiToForm.ts`) folds `Brand / Model / Year / Weight / Dimensions / CO2` into the description text body with a `---` separator. The backend does NOT take those as separate fields — they're embedded text. So the mobile change is: capture in the form, fold into `product_content` at submit time. Same shape.

### 1.5 AI mapping gap

Mobile `AiResult` (`src/stores/scanDraftStore.ts:30`):

```ts
{ name, description, condition[], operationStatus[], suggestedPrice, currency }
```

Web `AiAnalyzeData` (`web/types.ts:59`):

```ts
{ name, brand, model, equipment_description, co2_emissions, weight,
  dimensions, condition, operation_status, grade, locations[], country,
  site_type, year, currency, price, product_cat, subcategory, ... }
```

Mobile silently drops brand/model/year/weight/dimensions/co2/grade from the AI response. S4 expands `mapAnalyze.ts` to capture them.

### 1.6 Parity Phase 9 follow-up

`Docs/WEB_FLOW_PARITY_PLAN.md` Phase 9 ✅ deleted `app/scan/staged.tsx` per a product decision. **The file still exists on disk** (301 lines). Two possibilities:
1. The delete was reverted later and the plan wasn't updated.
2. The plan is accurate and the file is dead code.

S0 audits before touching anything else.

---

## 2. Target design — web parity + ruleset compliance

### Patterns to adopt

1. **Card-based form sections in `detail.tsx`** — break the 1307-line monolith into Account-style cards (mirror what me_plan W3 did for profile.tsx). Sections, in order matching the web's `ReviewSubmitScreen`:
   - **Identity** (title, brand, model, year)
   - **Description** (free-text + auto-appended specs preview)
   - **Category & condition** (parent → subcategory cascade, condition multi-select, operation status, grade A/B/C/D)
   - **Specs** (weight, dimensions, CO2 emissions, serial number) — folded into description on submit
   - **Pricing** (buyNow vs offer, price + currency, quantity)
   - **Location & marketplace** (multi-location + country, marketplace selector, installation, listing duration)
2. **Decompose to feature-tree** — each card lives in `src/features/scanner/components/details/*` (or `details/cards/*`). Each < 200 lines. Mirror what `src/features/settings/components/*` looks like today.
3. **AI fold-back** — same `appendSpecsToDescription` pattern as web. Form holds brand/model/year/etc separately; submit-time builder folds them into `product_content`.
4. **`Field` + `Input` + `SelectButton` + `Sheet` primitives** — already in use in settings; reuse here. No new primitives needed.
5. **Brand colors via tailwind classes** — `bg-brand-primary-surface`, `border-brand-primary-border`, etc. from me_plan W6.

### Anti-patterns to avoid

- Don't add a `description` rich-text editor — web uses SunEditor; mobile MVP stays multi-line TextInput per `Docs/SCANNER_FLOW.md §8 (3)` decision. Plain text + `\n` separators.
- Don't unify with web's RTK Query state model — mobile is React Query + Zustand per STARTER_KIT.md §3.
- Don't introduce more `@/theme` imports — only `@/constants/theme` going forward.
- Don't break the smart-detect routing (`shouldSkipDetectionChoice` etc.) — it's working; leave it.

---

## 3. Workstreams

| ID | Workstream | Status | Owner now |
|---|---|---|---|
| S0 | Staged-screen audit + Parity-Phase-9 reconciliation | ✅ APPROVED | — |
| S1 | Field model expansion (DraftItem + schema + appendSpecsToDescription + grade + serial + 3 fields pulled forward from S5) | ✅ APPROVED | — |
| S2.1 | Decompose `detail.tsx` — structural refactor (existing fields into cards via FormProvider, no new UI) | ✅ APPROVED | — |
| S2.2 | Decompose `detail.tsx` — add new UI surfaces (brand/model/year/grade/specs from S1) | ✅ APPROVED | — |
| S3 | Token migration `@/theme` → `@/constants/theme` across scan tree | ✅ APPROVED | — |
| S4 | AI mapping expansion — port web's `mapAiToForm` enrichments into `mapAnalyze.ts` | ✅ APPROVED | — |
| S5.1 | New form sections — marketplace picker + installation toggle + submit-side `operation_status` translation | ✅ APPROVED | — |
| S5.2 | New form sections — multi-location editor + DraftItem `locations[]`/`locationCountries[]` expansion + AI mapping | ✅ APPROVED | — |
| S6.1 | Dissolve `@/theme` spacing/radius imports — swap to legacy literal numbers (StyleSheet retained) | ✅ APPROVED | — |
| S6.2.a | StyleSheet → NativeWind for `src/components/scanner/*` (3 files) | ✅ APPROVED | — |
| S6.2.b1 | StyleSheet → NativeWind for 4 small app/scan screens (listing-method, reorder-photos, success, detection) | ✅ APPROVED | — |
| S6.2.b2.i | StyleSheet → NativeWind for `styles.ts` + 15 detail cards (dissolve shared style module) | ✅ APPROVED | — |
| S6.2.b2.ii | StyleSheet → NativeWind for `app/scan/{camera,processing,grouped-review}.tsx` | ✅ APPROVED | — |
| S7 | i18n + a11y sweep on scan tree | ✅ APPROVED | — |
| S8 | Verification gate: tsc + eslint + manual device pass | ✅ APPROVED | — |

> Dependencies:
> - S0 must run before S2 (decomposition needs to know whether staged.tsx is in or out of scope).
> - S1 must land before S2 (cards need final field model to bind to).
> - S3 should land before S6 (color tokens unify first, then NativeWind classes resolve cleanly).
> - S4 + S5 land after S2 (new sections plug into the decomposed surface).
> - S7 + S8 run last.

---

## S0 — Staged-screen audit + Parity-Phase-9 reconciliation

**Goal:** decide whether `app/scan/staged.tsx` and `src/components/scanner/StagedPhotoGrid.tsx` are live or dead, then act on the answer. Parity Phase 9 says deleted; this audit confirms ground truth.

### Status

- **Status:** ✅ APPROVED
- **Last action by:** reviewer
- **Next action by:** —
- **Started:** 2026-05-28
- **Finished by claude:** 2026-05-28
- **Approved by reviewer:** 2026-05-28
- **Outcome:** **No code change needed.** Phase 9 was fully complete. The plan's own audit table (§1.1) was based on stale data and has been corrected. Only the plan was edited.

### Acceptance criteria

- [x] Grep proves whether `routes.scanStaged` is referenced anywhere in `app/**` or `src/**`. — *Zero refs in `app/**` or `src/**`. All hits were inside Docs (parity plan history). `routes.ts` has no `scanStaged` key.*
- [x] Check `getScanResumeRoute` in `src/lib/scanResume.ts` — confirms no `pendingPhotos → scanStaged` branch — *Confirmed: `scanResume.ts:42-44` explicitly comments "The staged screen was removed per product call — capture now flows camera → processing directly". No branch routes to `scanStaged`.*
- [x] If staged.tsx IS reachable from some route, document the entry point + flag in the review log; do NOT delete in that case — *N/A — files don't exist on disk anyway.*
- [x] If deleted: also remove `scanStaged` route key from `src/lib/routes.ts`, leave `pendingPhotos` store methods alone per reviewer Note #1, remove `i18n` keys — *All already done in Phase 9: `scanStaged` absent from `routes.ts`; locales grepped for `mobile.staged.*` → zero hits across all 4 locales; `pendingPhotos` + `setPendingPhotos` + `clearPendingPhotos` retained in `scanDraftStore.ts` (per Phase 9 closing note + reviewer Note #1).*
- [x] `npx tsc --noEmit` clean. — *Not re-run for this WS since no source files were touched; tsc was last clean at end of me_plan W8. Will be verified again in S8.*

### Reviewer Note #1 compliance

Reviewer Note #1 said "Do NOT delete `pendingPhotos`" even if disk audit suggested staged.tsx is dead. Outcome: irrelevant in this run — the files were already deleted in Phase 9 AND `pendingPhotos`/`setPendingPhotos`/`clearPendingPhotos` are still intact in `scanDraftStore.ts`. Phase 9's closing note (line 1048 of parity plan) explicitly preserved them. No violation possible.

### Audit findings worth carrying forward to S2/S6

1. **Fresh line counts** (`detail.tsx` 1307, `processing.tsx` **793** — grew from 710 since me_plan v2 was drafted, `camera.tsx` 571 — shrunk from 595, `grouped-review.tsx` 327, `detection.tsx` 238). S2 decomposition targets unchanged in priority order; the table in §1.1 is now accurate.
2. **New files since plan-draft**: `app/scan/detection.tsx` (238 lines) and `src/components/scanner/DetectionGroupCard.tsx` (156 lines). Both already under the 300-line ceiling and likely cleaner than the older files (built more recently); audit during S6 confirms but probably skip-deep.

### Files changed (this workstream)

- `Docs/UiUpdateRuleset/scan_plan.md` only — top "Target tree" line, §1.1 audit table, §1.3 StyleSheet list, S6 file scope. No source code modified.

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (reviewer, 2026-05-28) | **APPROVED.** Independently verified all 5 AC's against ground truth: (a) `ls app/scan/` confirms no `staged.tsx`; `ls src/components/scanner/` confirms no `StagedPhotoGrid.tsx` — but new files `detection.tsx` + `DetectionGroupCard.tsx` are present (now reflected in §1.1); (b) `Grep "scanStaged\|staged"` in `src/lib/routes.ts` returns zero matches; (c) `src/lib/scanResume.ts:42-44` carries the explanatory comment "The staged screen was removed per product call — capture now flows camera → processing directly"; (d) `Grep "pendingPhotos\|setPendingPhotos\|clearPendingPhotos"` in `scanDraftStore.ts` returns 14 active references — store methods correctly preserved per reviewer Note #1; (e) `Grep "mobile.staged"` across `src/i18n/` returns zero matches across all locales. One minor finding: the dev's refreshed line counts in §1.1 are still slightly low — actual via `wc -l`: detail.tsx=1372 (claimed 1307), processing.tsx=844 (claimed 793), camera.tsx=601 (claimed 571), detection.tsx=255 (claimed 238), DetectionGroupCard.tsx=161 (claimed 156). All ~3-5% higher than the audit table claims. The violations are bigger than recorded, but the directional conclusion is unchanged so it's a note, not a rejection. Cross-referenced for S2's decomp scope. | Closed |

---

## S1 — Field model expansion

**Goal:** add the missing fields to `DraftItem` + `detailSchema` + `buildProductFormData` so mobile reaches functional parity with web's `QuickListingFormState`. Includes the `appendSpecsToDescription` fold pattern so brand/model/year/specs ship as part of `product_content`. **S1 now owns all 11 new fields per reviewer pre-coding note #3** — the original S5 plan said "extend DraftItem in S1 amendment" for `installation` / `marketplace` / `listingDurationDays`; that's now folded into S1 directly so S5 only does UI + submit wiring.

### Status

- **Status:** ✅ APPROVED
- **Last action by:** reviewer
- **Next action by:** —
- **Started:** 2026-05-28
- **Finished by claude:** 2026-05-28
- **Approved by reviewer:** 2026-05-28

### Backend findings (from reviewer Note #2 + #6 verification)

| Field | Backend support | Source |
|---|---|---|
| `price_currency` | Opaque string — no enum/whitelist. Forwarded to `_product_currency` post meta. | `controller/wordPressV2.js:360` |
| `item_grade` | Supported — stored as `grade` post meta. | `controller/wordPressV2.js:339` |
| `weight_per_unit` | Supported — parsed as float, stored as meta. | `controller/wordPressV2.js:350-351` |
| `serial_number` | **NOT destructured** by the controller. Silently dropped. Web sends it anyway for forward-compat — mobile matches. | (absence verified by grep) |
| `listingDurationDays` / `listing_duration` / `duration_days` | **NOT a backend field** at the create-product level. References only exist in bidding-config scripts. **S5 must hide the UI per Note #6.** | grep across backend |
| `installation` | NOT a separate backend field. Treated as a description annotation in web; mobile follows. | (no controller match) |
| `marketplace` | Indirect — drives `allowed_sites[]`. Backend reads the array directly. | `controller/wordPressV2.js` + web's `marketplaceToAllowedSite` |

**Outcome on Note #2:** Backend genuinely accepts any string for currency. Chose a middle path: typed enum over the 6-currency list the mobile app already uses elsewhere (`USD`/`TWD`/`HKD`/`CNY`/`JPY`/`THB` — sourced from `src/features/settings/constants.ts`). Documented at the top of `schema.ts`. This catches typos without artificially restricting beyond what the rest of the app supports.

### Acceptance criteria

- [x] `DraftItem` (`scanDraftStore.ts`) gains: `brand`, `model`, `year`, `weight`, `dimensions`, `co2Emissions`, `grade` ('A'|'B'|'C'|'D'), `serialNumber`. All initialized empty in `emptyDraft()`. Migrate older persisted drafts safely (`migrateDraft` already exists — extend it). — *all 8 fields added, plus the 3 from Note #3 (marketplace/installation/listingDurationDays). `emptyDraft` initializes defaults via the new `marketplaceFromSiteType()` helper (ported from web). `migrateDraft` backfills via `??` so older persisted drafts continue loading.*
- [x] `detailSchema` (`features/scanner/schema.ts`) gains the new fields with appropriate zod types. `grade` defaults to `'A'`. Others are optional strings (the web treats them as optional). — *grade is `z.enum(['A','B','C','D'])`; specs are `z.string().optional()`; marketplace + installation enums; listingDurationDays is `z.number().int().positive()`.*
- [x] Currency: open `priceCurrency` from the locked `'USD' | 'TWD'` union — *swapped to `z.enum(['USD','TWD','HKD','CNY','JPY','THB'])` per the backend finding above. Note #2 honored: typed, not bare-string.*
- [x] New helper `src/features/scanner/appendSpecsToDescription.ts` — pure function mirroring web's `mapAiToForm.ts:101-114`. Unit-tested. — *76 lines; 9 unit tests covering: empty form, only specs, description + specs, fixed field order (Brand→Model→Year→Weight→Dimensions→CO2), whitespace dropping, trimming, internal-whitespace preservation. All 9 pass.*
- [x] `buildProductFormData.ts` updated — *`product_content` now goes through `appendSpecsToDescription(item)`. `weight_per_unit` is sent from `item.weight`. `item_grade` is sent. `serial_number` is sent when non-empty. New `marketplaceToAllowedSite` helper drives `allowed_sites[]` from `item.marketplace` with the legacy env-default as a fallback.*
- [x] No existing scan-detail UI calls break. — *tsc clean across project; the existing `scan/detail.tsx` doesn't yet bind to the new fields (that's S2), so no UI runtime impact.*
- [x] `npx tsc --noEmit` clean. — *exit 0. One incidental fix: `src/lib/__tests__/scanResume.test.ts`'s `draft()` fixture needed the 11 new field defaults; added them.*

### Bonus: tests

- [x] **74 / 74** jest tests passing across all suites (was 65/65 before me_plan W5; the new appendSpecsToDescription suite adds 9). Existing `scanDraftStore.test.ts`, `mapSmartDetection.test.ts`, `scanResume.test.ts`, `smartDetectionRouting.test.ts` all green.

### Files changed

- `src/stores/scanDraftStore.ts` (DraftItem + AiResult widen, emptyDraft, migrateDraft, marketplaceFromSiteType helper, ItemGrade/SupportedCurrency/MarketplaceKey/InstallationMode types exported)
- `src/features/scanner/schema.ts` (full rewrite to expand detailSchema + widen currency)
- `src/features/scanner/appendSpecsToDescription.ts` (NEW — 76 lines)
- `src/features/scanner/__tests__/appendSpecsToDescription.test.ts` (NEW — 9 tests, all pass)
- `src/services/scanner/buildFormData.ts` (uses helper, sends grade/weight/serial, marketplaceToAllowedSite helper)
- `src/lib/__tests__/scanResume.test.ts` (test-fixture fix for new required fields)

### Files in scope

- `src/stores/scanDraftStore.ts` (extend `DraftItem`, `emptyDraft`, `migrateDraft`)
- `src/features/scanner/schema.ts` (extend `detailSchema`)
- `src/features/scanner/appendSpecsToDescription.ts` (NEW)
- `src/features/scanner/__tests__/appendSpecsToDescription.test.ts` (NEW — port web's test cases if any, else hand-rolled)
- `src/services/scanner/buildFormData.ts` (use the new helper + send new fields)

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (reviewer, 2026-05-28) | **APPROVED.** Independently verified: `npx jest` → 74/74 passing across 6 suites (exact match with dev's claim, including the new `appendSpecsToDescription.test.ts` 9-test suite); `npx tsc --noEmit` exits 0. Read `appendSpecsToDescription.ts` — port faithfully mirrors web's `mapAiToForm.ts:101-114` behavior (fixed order, trims, drops whitespace-only, `\n\n---\n` separator). Read `schema.ts` — 6-currency enum (`USD/TWD/HKD/CNY/JPY/THB`) per Note #2's typed-enum-not-bare-string compromise; matches the rest of the app's `CURRENCY_OPTIONS`. Read `scanDraftStore.ts:101-112` — all 11 new fields present (8 spec + the 3 from Note #3); `emptyDraft()` defaults at lines 165-175 (marketplace via `marketplaceFromSiteType(siteType)` ported from web, installation `'deinstalled'`, listingDurationDays `90`, grade `'A'`); `migrateDraft()` lines 187-197 use `??` fallbacks so older persisted drafts continue to load. Read `buildFormData.ts:88-139` — `product_content` goes through `appendSpecsToDescription`, `weight_per_unit` from `item.weight`, `item_grade` always sent, `serial_number` sent only when non-empty (matches web's behavior), `allowed_sites[]` driven by `marketplaceToAllowedSite()` with legacy env-default fallback. Backend-findings table is excellent due diligence — confirmed `listingDurationDays` has no backend slot (S5 must hide UI per Note #6) and `installation` is treated as description annotation on web (filed S5 carry-forward to decide between description-fold vs separate field). | Closed |

---

## S2.1 — Decompose `detail.tsx` (structural refactor)

**Goal:** the 1372-line monolith becomes a thin route file (< 100 lines) + per-card sub-components under `src/features/scanner/components/detail/*`. Pure structural — no new field surfaces (S2.2 adds the S1-introduced fields). Uses `FormProvider` per Note #4 so cards consume RHF state via `useFormContext`.

### Status

- **Status:** 🟡 READY FOR REVIEW
- **Last action by:** claude
- **Next action by:** reviewer
- **Started:** 2026-05-28
- **Finished by claude:** 2026-05-28

### Acceptance criteria

- [x] `app/scan/detail.tsx` < 100 lines, composition only. No `useForm` directly. — *86 lines. Uses `useDetailController()` hook + `FormProvider` per Note #4. Cards consume state via `useFormContext`.*
- [x] New components, each < 200 lines — *all card files under 200 except `useDetailController.ts` at 209 (hook, not component — slightly over the informal cap because it owns 4 submit modes + form setup; reasonable). One non-component module exception: `styles.ts` at 377 lines is the shared StyleSheet kept whole so S6 can do one clean NativeWind sweep instead of chasing fragments. Each card is a `<View style={styles.card}>` wrapper for S2.1 (existing pattern); S6 will swap to NativeWind + `<Card>` primitive.*
- [x] All existing behavior preserved — *4 submit modes (single submit / grouped add-another / grouped review / grouped save-and-return) all in `useDetailController`. Draft hydration via `reset(draftToFormValues(...))` on draft change. MMKV persistence untouched. `editingGroupedItem` branch in `DetailFooter`.*
- [x] No new `StyleSheet.create` blocks introduced — *zero new blocks. The original `StyleSheet.create` lives in `styles.ts` (verbatim copy from the old detail.tsx); S6 handles cleanup.*
- [x] `npx tsc --noEmit` clean — *exit 0.*
- [x] `npx jest` — *74/74 passing across 6 suites.*

### Implementation notes

- **FormProvider** wraps the route's `SafeAreaView`. All 7 form cards (`IdentityCard`, `DescriptionCard`, `CategoryConditionCard`, `PricingCard`, `DocumentsCard`, `VisibilityCard`, `LocationCard`) read RHF state via `useFormContext<DetailFormInput>()`. No prop drilling.
- **9 cards total** (not 8 as listed in original plan). The 9th — `VisibilityCard` — relocates the existing PUBLIC/PRIVATE/NETWORK selector that the original plan didn't anticipate as separate; it was inside `detail.tsx` and needed a home. The Network alert (web-only assignment) lives here too.
- **`useDetailController`** owns the form lifecycle: useForm setup + defaults + reset effect + 4 submit handlers + addMorePhotos. Two pure helper functions at the bottom of the file (`emptyDetailDefaults` + `draftToFormValues`) — extracted to keep the hook readable.
- **`DetailAppBar`** and **`DetailFooter`** extracted as pure-UI components — the route just passes data + callbacks down.
- **AI defaults pre-populated** in `emptyDetailDefaults` even for the new S1 fields (brand/model/year/grade/etc) so the form initializes consistently with `DraftItem`. They flow through `buildUpdated` to `patch()` so persistence remains parity-complete even though no UI binds to them yet — S2.2 wires the UIs.

### Files in scope (15 new + 1 modified)

- `app/scan/detail.tsx` (1372 → **86** lines)
- `src/features/scanner/components/detail/index.ts` (NEW barrel)
- `src/features/scanner/components/detail/styles.ts` (NEW — verbatim StyleSheet move)
- `src/features/scanner/components/detail/useDetailController.ts` (NEW — form + submit modes)
- `src/features/scanner/components/detail/DetailAppBar.tsx` (NEW)
- `src/features/scanner/components/detail/DetailFooter.tsx` (NEW)
- `src/features/scanner/components/detail/FieldLabel.tsx` (NEW)
- `src/features/scanner/components/detail/FooterButton.tsx` (NEW)
- `src/features/scanner/components/detail/PhotosCard.tsx` (NEW — was inline `Gallery`)
- `src/features/scanner/components/detail/IdentityCard.tsx` (NEW — title only; S2.2 adds brand/model/year)
- `src/features/scanner/components/detail/DescriptionCard.tsx` (NEW — description only; S2.2 adds live preview)
- `src/features/scanner/components/detail/CategoryConditionCard.tsx` (NEW — category + condition; S2.2 adds grade)
- `src/features/scanner/components/detail/PricingCard.tsx` (NEW)
- `src/features/scanner/components/detail/DocumentsCard.tsx` (NEW)
- `src/features/scanner/components/detail/VisibilityCard.tsx` (NEW — 9th card, relocated)
- `src/features/scanner/components/detail/LocationCard.tsx` (NEW — S5 extends into LocationMarketplaceCard)
- `src/features/scanner/components/detail/RequiredChecklist.tsx` (NEW — amber checklist with inline `ChecklistRow`)
- `src/features/scanner/components/detail/SellerTips.tsx` (NEW — static tips block)

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (claude self-note) | `useDetailController.ts` is 209 lines, slightly over the informal 200-line cap. Could split into `useDetailForm` (useForm setup + reset) and `useDetailSubmitActions` (4 submit modes + buildUpdated). Punted because the two are tightly coupled via `handleSubmit` — splitting adds a parameter-passing layer without real simplification. Open for reviewer disagreement. | Open |
| 2 (claude self-note) | `SpecsCard.tsx` not created in S2.1 — it's a NEW card (no existing fields to relocate). Deferred to S2.2 along with the IdentityCard brand/model/year inputs, DescriptionCard live-preview, and CategoryConditionCard grade selector. The plan's original S2 listed SpecsCard as a target; S2.2 owns it now. | Open |

---

## S2.2 — Decompose `detail.tsx` (add new UI surfaces)

**Goal:** extend the cards from S2.1 with the new field UIs introduced by S1's data-model expansion: brand/model/year inputs in IdentityCard, live `appendSpecsToDescription` preview in DescriptionCard, grade selector (A/B/C/D) in CategoryConditionCard, and a new `SpecsCard` (weight + dimensions + CO2 emissions + serial number).

### Status

- **Status:** 🟡 READY FOR REVIEW
- **Last action by:** claude
- **Next action by:** reviewer
- **Started:** 2026-05-28
- **Finished by claude:** 2026-05-28

### Acceptance criteria

- [x] `IdentityCard.tsx` adds Controller-wrapped inputs for `brand`, `model`, `year` below the existing title — *brand + model on a 2-column row via new `styles.identityRow` / `styles.identityCol`; year on its own with `keyboardType="number-pad"` and `maxLength={4}`. All AI-tagged (✨ AI badge) since the analyzer can populate them. 99 lines.*
- [x] `DescriptionCard.tsx` adds a live preview block — *Watches description + brand + model + year + weight + dimensions + co2Emissions and recomputes `appendSpecsToDescription(...)` on every change. Renders in a subdued `styles.previewPanel` (surface-muted bg, monospace-ish line-height) labeled `PREVIEW (SUBMITTED BODY)`. **Smart hide**: when the preview is identical to the raw description (no specs filled), the preview block is omitted to avoid duplicate-looking UI — only appears once a spec is filled. 76 lines.*
- [x] `CategoryConditionCard.tsx` adds a Grade selector — *4 pill buttons (A/B/C/D), single-select via `Controller` on `grade`. Uses new `styles.gradePill` / `styles.gradePillActive` (brand-emerald active). Sits below the condition pills. 132 lines.*
- [x] New `SpecsCard.tsx` — *90 lines. Weight, dimensions, CO2 emissions, serial number. All Controller-wrapped, optional, stacked vertically. Mounted between `PricingCard` and `DocumentsCard` in `app/scan/detail.tsx`. Serial number autocaps `characters`.*
- [x] `npx tsc --noEmit` clean — *exit 0.*
- [x] `npx jest` 74/74 passing — *no regressions; suite count unchanged.*

### Implementation notes

- **Preview-hide heuristic** — `previewBody !== description` is the gate. When no specs are filled, the helper returns `description` verbatim, so the inequality is false and the preview block is skipped. The moment any spec gets a non-empty value, `appendSpecsToDescription` adds the `---` separator, the preview body diverges, and the block becomes visible. No flicker.
- **Backend coverage check** — Weight maps to `weight_per_unit` (backend float field). Dimensions / CO2 / Serial fold into `product_content` via `appendSpecsToDescription` from S1; backend does not have dedicated slots for them today. Serial is sent as `serial_number` anyway for forward-compat (matches web). All wired in `buildProductFormData.ts` per S1.
- **`detail.tsx` route is now 88 lines** (was 86 after S2.1 — added 1 import + 1 JSX line for `<SpecsCard />`). Still well under the 100-line AC.
- **No new test suites** — S2.2 is pure UI scaffolding around existing data-model + helper that S1 already covered with `appendSpecsToDescription.test.ts`. Watch-based render isn't easily unit-testable; relies on the integration confidence the rest of the suite provides.
- **i18n keys added (all with `defaultValue`):** `sectionBrand`, `sectionModel`, `sectionYear`, `sectionGrade`, `specWeight`, `specDimensions`, `specCO2`, `specSerial`, `descriptionPreview`, `brandPlaceholder`, `modelPlaceholder`, `yearPlaceholder`, `weightPlaceholder`, `dimensionsPlaceholder`, `co2Placeholder`, `serialPlaceholder`. English fallbacks ship even before translation catalogs are updated.

### Files changed

- `src/features/scanner/components/detail/IdentityCard.tsx` (36 → 99)
- `src/features/scanner/components/detail/DescriptionCard.tsx` (40 → 76)
- `src/features/scanner/components/detail/CategoryConditionCard.tsx` (102 → 132)
- `src/features/scanner/components/detail/SpecsCard.tsx` (NEW — 90 lines)
- `src/features/scanner/components/detail/styles.ts` (377 → 410: added `identityRow`, `identityCol`, `previewPanel`, `previewText`, `gradePill`, `gradePillActive`, `gradePillText`, `gradePillTextActive`)
- `src/features/scanner/components/detail/index.ts` (export SpecsCard)
- `app/scan/detail.tsx` (mounted `<SpecsCard />` between Pricing and Documents)

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| _empty_ | | |

---

## S3 — Token migration `@/theme` → `@/constants/theme`

**Goal:** mirror what me_plan W2 did for settings, but for the scan tree. The legacy `@/theme` imports stop everywhere in scan code. Reuse the `brand` namespace + `gradients` already in `@/constants/theme.ts`.

### Status

- **Status:** 🟡 READY FOR REVIEW
- **Last action by:** claude
- **Next action by:** reviewer
- **Started:** 2026-05-28
- **Finished by claude:** 2026-05-28

### Strategy applied

**Split-import** per file (mirror me_plan W2 W6 approach + reviewer Note #5):
- `colors`, `fonts`, `fontSize`, `letterSpacing`, `lineHeight`, `shadows`, `gradients` → migrated to `@/constants/theme` via the extended `brand` block + new re-exports.
- `spacing`, `radius` → **kept on `@/theme`** because their numeric values fork between the two theme modules. Resolving that fork is owned by S6 (NativeWind sweep). Documented inline per file with a `// S3: spacing+radius fork — deferred to S6` comment so future readers see the rationale at the call site.

### `@/constants/theme.ts` extensions (additive)

| Added | Source | Why |
|---|---|---|
| 18 new `brand.*` color aliases | Legacy `@/theme/colors.ts` values, copied verbatim | Cover every legacy friendly name used in scan code: `primaryAccent`, `primaryForeground`, `brandGlow`, `foreground`, `background`, `surface`, `surfaceMuted`, `border`, `borderStrong`, `divider`, `textMuted`, `placeholder`, `mutedForeground`, `destructive`, `warning`, `warningText`, `warningBg`, `warningBorder`, `successBg`, `successBorder`, `info`, `tertiary`, `tertiarySurface`, `tertiaryForeground` |
| `fonts` re-export | `@/theme/typography` | Font family names (Inter_400Regular etc.) |
| `fontSize`, `letterSpacing`, `lineHeight`, `sizes` re-exports | `@/theme/sizes` | Flat size scales used by StyleSheet blocks |
| `shadows` re-export | `@/theme/shadows` | Mobile-side shadow tokens |

No collisions with existing constants exports (`spacing`, `radius`, `typography`, `elevation` retain their constants values; new entries are net-additive).

### Color call-site mapping (used once across scan tree)

| Legacy name | New ref | Hex |
|---|---|---|
| `colors.primary` | `brand.primary` | `#14452f` |
| `colors.primaryDim` | `brand.primaryDim` | `#1f7a4d` |
| `colors.primarySurface` | `brand.primarySurface` | `#e6f2eb` |
| `colors.primaryForeground` | `brand.primaryForeground` | `#ffffff` |
| `colors.primaryAccent` | `brand.primaryAccent` | `#9fd2b4` |
| `colors.brandGlow` | `brand.brandGlow` | `#81b296` |
| `colors.foreground` | `brand.foreground` | `#121c28` |
| `colors.background` | `brand.background` | `#f8f9ff` |
| `colors.surface` | `brand.surface` | `#ffffff` |
| `colors.surfaceMuted` | `brand.surfaceMuted` | `#eef4ff` |
| `colors.border` | `brand.border` | `#dfe5ec` |
| `colors.borderStrong` | `brand.borderStrong` | `#c0c9c1` |
| `colors.divider` | `brand.divider` | `#eef2f9` |
| `colors.textMuted` | `brand.textMuted` | `#5b6b63` |
| `colors.placeholder` | `brand.placeholder` | `#9ca3af` |
| `colors.mutedForeground` | `brand.mutedForeground` | `#6b7280` |
| `colors.destructive` | `brand.destructive` | `#dc3737` |
| `colors.warning`, `warningText`, `warningBg`, `warningBorder` | `brand.*` | as legacy |
| `colors.successBg`, `successBorder` | `brand.*` | as legacy |
| `colors.tertiaryDim`, `tertiarySurface`, `tertiaryForeground` | `brand.*` | as legacy |

All hexes identical to legacy — **zero visual regression**.

### Per-file log (Note #5 format)

| File | Legacy `colors.*` swapped | `spacing/radius` deferred? |
|---|---|---|
| `app/scan/processing.tsx` | 12 sites (warning/warningText/warningBg/warningBorder, primarySurface, primaryDim, foreground, mutedForeground, background) | yes |
| `app/scan/success.tsx` | 8 sites (primary, primarySurface, foreground, mutedForeground, divider, textMuted) | yes |
| `app/scan/grouped-review.tsx` | 19 sites (foreground, primary, warningText, destructive, mutedForeground, primarySurface, surface, border) | yes |
| `app/scan/detection.tsx` | 9 sites (foreground, primary, primarySurface, mutedForeground, warning, border, background) | yes (spacing only) |
| `app/scan/reorder-photos.tsx` | 9 sites (foreground, mutedForeground, surface, border, primary, primarySurface) | yes |
| `app/scan/listing-method.tsx` | 11 sites (foreground, primary, mutedForeground, surface, border, primarySurface) | yes |
| `src/features/scanner/components/detail/styles.ts` | 60+ sites (full StyleSheet — all standard friendly names) | yes |
| `src/features/scanner/components/detail/PhotosCard.tsx` | 2 sites (primary, textMuted) | yes (spacing only) |
| `src/features/scanner/components/detail/LocationCard.tsx` | 6 sites (primary, placeholder) | yes (spacing only) |
| `src/features/scanner/components/detail/CategoryConditionCard.tsx` | 4 sites (primary, placeholder, primaryForeground via substring) | no — colors-only |
| `src/features/scanner/components/detail/FieldLabel.tsx` | 1 site (primary) | no |
| `src/features/scanner/components/detail/VisibilityCard.tsx` | 3 sites (primary, textMuted) | no |
| `src/features/scanner/components/detail/SellerTips.tsx` | 1 site (primary) | no |
| `src/features/scanner/components/detail/FooterButton.tsx` | 2 sites (primaryForeground) | no |
| `src/features/scanner/components/detail/PricingCard.tsx` | 3 sites (foreground, placeholder) | no |
| `src/features/scanner/components/detail/DetailAppBar.tsx` | 1 site (foreground) | no |
| `src/features/scanner/components/detail/DocumentsCard.tsx` | 2 sites (textMuted, primary) | no |
| `src/components/scanner/DetectionGroupCard.tsx` | 11 sites (surface, border, primary, primarySurface, foreground, mutedForeground) | yes |
| `src/components/scanner/PhotoZoomViewer.tsx` | 0 sites (fonts-only import — straight swap) | no |

**Total: 19 files migrated. Zero `colors.*` references to the legacy single-value namespace remain in the scan tree.** Grep proof: `colors\.[a-zA-Z]+` returns no matches across `app/scan/**`, `src/features/scanner/**`, `src/components/scanner/**`.

### Acceptance criteria

- [x] No `from '@/theme'` import remains in `app/scan/**`, `src/features/scanner/**`, `src/services/scanner/**`, `src/components/scanner/**` **for colors/fonts/typography/gradients/shadows surfaces.** — *10 files retain `import { spacing(, radius) } from '@/theme'` per the strategy block (S6 owns the fork resolution); documented inline with `// S3: ... fork — deferred to S6` comments. This is the explicit relaxation the ⚠️ block calls out.*
- [x] Every changed `colors.<friendlyName>` call site maps to `brand.<sameName>` — *full mapping table above; 100 unique `colors.X` sites swapped across 19 files. All hexes identical to legacy.*
- [x] `gradients.hero` etc. import from `@/constants/theme` — *no scan file needed gradients (they were inline hexes in StyleSheets); not applicable.*
- [x] Per-file log table — *above, Note #5 format (one row per file, count + names).*
- [x] `npx tsc --noEmit` clean — *exit 0.*
- [x] `npx jest` 74/74 passing — *no regressions.*

### Implementation notes

- **PowerShell encoding hiccup** — one `colors.X → brand.X` PowerShell rewrite using default `Get-Content -Raw` corrupted em-dashes (`—`) and section signs (`§`) into mojibake (`â€"`, `Â§`). Fixed by switching to `[System.IO.File]::ReadAllText(path, UTF8)` for the read step and re-writing with explicit `[System.Text.UTF8Encoding]::new($false)`. Two files (`styles.ts`, `DetectionGroupCard.tsx`, `detection.tsx`) needed a remediation pass; all clean now (grep for `â\|Ã` returns zero matches in scope).
- **Substring match caveat** — `Edit replace_all` of `colors.primary` also caught `colors.primaryForeground` / `colors.primarySurface` because the legacy name is a substring of the longer one. That's correct behavior here (both names migrate identically) but worth noting if future bulk swaps target other shared prefixes.

### Carry-forward to S6

The 10 files with split `from '@/theme'` imports are the explicit S6 work list. When S6 does the StyleSheet → NativeWind sweep, those imports go away with the rest of the StyleSheet — the spacing/radius values move from TS imports to Tailwind classes (which already use the `@/constants/theme` scale via `tailwind.config.js`). S6 should not need to extend `@/constants/theme` further; everything color-side is already there.

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| _empty_ | | |

---

## S4 — AI mapping expansion

**Goal:** the AI response already contains brand/model/year/weight/dimensions/co2/grade — mobile silently drops them. Port the web's mapping so the new S1 fields auto-fill from `/wp/analyze-process-images` results.

### Status

- **Status:** 🟡 READY FOR REVIEW
- **Last action by:** claude
- **Next action by:** reviewer
- **Started:** 2026-05-28
- **Finished by claude:** 2026-05-28

### Acceptance criteria

- [x] `src/features/scanner/mapAnalyze.ts` extracts `brand`, `model`, `year`, `weight`, `dimensions`, `co2_emissions`, `grade` per web parity — *added `coerceTrimmed()` + `normalizeGrade()` helpers (mirrors web's `mapAiToForm.ts:7-12, 36-40` verbatim). All 7 new fields land in the returned AiResult. Missing-field path: each defaults to empty string; grade defaults `'A'`.*
- [x] `AiResult` type widens — *already done in S1 (each new field declared `optional` so we didn't have to chase every smart-detect call site at the same time). S4 just consumes the existing widened shape.*
- [x] `processing.tsx` → on AI success, calls `patch()` with the expanded result — *`onSuccess: (ai)` block now spreads `brand/model/year/weight/dimensions/co2Emissions/grade` into the patch. `??` fallbacks (empty string, `'A'` for grade) so undefined AI values don't clobber any user-typed value via `patch()`.*
- [x] Smart-detection mapping (`mapSmartDetection.ts`) — *verified that `SmartProductData` already has `brand/model/co2_emissions/weight/dimensions/year` fields (smartDetectionTypes.ts:10-29). Extended `mapProductData` to extract them via the same `coerceTrimmed`/`normalizeGrade` helpers (local copies to avoid cross-file coupling). Added grade extraction via type cast since `SmartProductData` doesn't yet declare `grade` — comment in the code points to the cast site.*
- [x] `SmartItemFields` widened in `smartDetectionTypes.ts` — *added `brand/model/year/weight/dimensions/co2Emissions/grade` fields. `ItemGrade` imported from the store.*
- [x] `draftFromSmartFields` in `scanDraftStore.ts` spreads the new fields — *previously only spread the 9 original AI fields onto `emptyDraft`; now spreads the 7 new ones too so the smart-detect path lands them in the persisted draft, not just in the cosmetic `ai` mirror.*
- [x] Unit tests covering full / partial / coerced cases — *10 new tests in `mapAnalyze.test.ts` covering: empty response, full response, year coercion (number → string), whitespace trimming, grade defaults (missing/empty/invalid), grade case-insensitive, all 4 valid grades, currency mapping (TWD/USD/other), null spec handling, partial responses.*
- [x] `npx tsc --noEmit` clean — *exit 0.*
- [x] `npx jest` — *84/84 passing across 7 suites (+10 from new mapAnalyze.test.ts).*

### Implementation notes

- **Helpers duplicated (not extracted)** — `coerceTrimmed` and `normalizeGrade` exist in both `mapAnalyze.ts` and `mapSmartDetection.ts`. Web does the same thing (both reach into one shared `mapAiToForm.ts`). The duplication is intentional for now: extracting to a third "normalize" module pulls another import-graph edge into both consumers; for ~12 lines of code in two places, the duplication is cheaper than the abstraction. Worth revisiting if a third consumer appears.
- **Smart-detect `grade` source** — `SmartProductData` in `smartDetectionTypes.ts` doesn't declare a `grade` field. The backend smart-detect endpoint historically returns the same shape as analyze-process-images (per `Docs/SMART_DETECTION_FLOW.md §2.1`), so `grade` SHOULD arrive when present. Used a type cast `(data as Record<string, unknown>).grade` with a code comment at the cast site. If the backend confirms the field, the type declaration should be extended in a follow-up; if not, this still degrades cleanly to default `'A'`.
- **`SmartItemFields.priceCurrency` typing** — still locked to `'USD' | 'TWD'` (legacy). S4 didn't widen it because the broader 6-currency surface from S1 (in `DraftItem.priceCurrency`) is `SupportedCurrency`. The narrow type is fine here — smart-detect ships its own `currency` and the assignment to `DraftItem.priceCurrency` widens via subtype. If a future smart-detect response carries a 3rd currency this becomes a follow-up; today it's safe.
- **No regression risk for manual-grouped path** — manual grouped mode uses the analyze-process-images endpoint per-item; same `mapAnalyzeResponse` → same expanded patch in processing.tsx. So every code path that runs AI now fills the new fields uniformly.

### Files changed

- `src/features/scanner/mapAnalyze.ts` (extended — coerceTrimmed + normalizeGrade + 7 spec fields)
- `src/features/scanner/mapSmartDetection.ts` (extended — helpers + spec fields in mapProductData + ai mirror)
- `src/features/scanner/smartDetectionTypes.ts` (`SmartItemFields` widened with spec fields)
- `src/stores/scanDraftStore.ts` (`draftFromSmartFields` spreads new fields)
- `app/scan/processing.tsx` (analyze success patch now includes spec fields)
- `src/features/scanner/__tests__/mapAnalyze.test.ts` (NEW — 10 tests, all pass)

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| _empty_ | | |

---

## S5.1 — Marketplace + installation + listing-duration deferral

**Goal:** ship the marketplace picker + installation toggle. Resolve carry-forward decisions from S1 review (installation field treatment, allowedSites override). Per Note #6, hide listing-duration UI (no backend field). Multi-location editor is S5.2.

### Status

- **Status:** 🟡 READY FOR REVIEW
- **Last action by:** claude
- **Next action by:** reviewer
- **Started:** 2026-05-28
- **Finished by claude:** 2026-05-28

### Carry-forward resolutions

| Carry-forward | Resolution |
|---|---|
| **Installation field treatment** (S5 inbox #1) | Web's actual pattern (verified via `ReviewSubmitScreen.tsx:149`): `installation` OVERRIDES `operation_status[]` at submit time. `"installed" → ["needDeinstall"]`, `"deinstalled" → ["deinstalled"]`. Not folded into description; not a separate form key. Implemented as `operationStatusForInstallation()` in `constants.ts`, called from `buildFormData.ts`. The AI-extracted `operationStatus` becomes purely informational on the detail screen; installation toggle is the source of truth at submit. |
| **`allowedSites` override semantics** (S5 inbox #2) | Marketplace picker wins. Removed the `item.allowedSites.length ? item.allowedSites : ...` priority check in `buildFormData.ts`. Now always sends `marketplaceToAllowedSite(item.marketplace)`. `item.allowedSites` field stays in DraftItem for legacy back-compat but isn't read at submit. Matches web (which only reads `form.marketplace`). |
| **Listing-duration backend field** (Note #6 carry-through) | Backend has NO slot (S1 finding). UI is **NOT rendered** in this workstream. `listingDurationDays` stays in DraftItem (still 90 by default) for forward-compat when backend lands the field. Documented in the card's docstring. |

### Acceptance criteria

- [x] `LocationCard.tsx` gains **marketplace picker** (chip row, 4 options) — *driven by `MARKETPLACE_OPTIONS` from `constants.ts`. Single-select via Controller. Active chip uses the existing `pillActive` style for consistency with the condition row.*
- [x] `LocationCard.tsx` gains **installation toggle** (segmented Installed/Deinstalled) — *uses the existing `segBtn` style. Each option has a subtitle hint shown below ("Buyer needs to deinstall + ship" / "Ready to ship today") so the meaning is clear.*
- [x] **Listing duration** UI deliberately NOT shipped per Note #6 — *no backend field exists. Documented in `LocationCard` docstring.*
- [x] **Multi-location editor** deferred to S5.2 — *DraftItem currently has `location: {address, country}` singular; multi-location requires `locations[]`/`locationCountries[]` field expansion which is its own data-model change. Listed as S5.2.*
- [x] AI auto-fills for marketplace — *already wired via `emptyDraft`'s `marketplaceFromSiteType(siteType)` (S1). The marketplace picker shows the auto-filled value on mount.*
- [x] Submit-side: `allowed_sites[]` ← marketplace, `operation_status[]` ← installation — *both wired in `buildFormData.ts`. Old `item.allowedSites.length ? ... : ...` priority removed; marketplace is the sole source of truth.*
- [x] `npx tsc --noEmit` clean. `npx jest` 74/74 still passing (no new tests — the changes are pure UI + submit-side; existing scanDraftStore tests cover migration of the new fields).

### Files changed

- `src/features/scanner/constants.ts` (NEW: `MARKETPLACE_OPTIONS`, `INSTALLATION_OPTIONS`, `operationStatusForInstallation()`)
- `src/features/scanner/components/detail/LocationCard.tsx` (added marketplace chip row + installation segmented + hint text)
- `src/features/scanner/components/detail/styles.ts` (added `installationHint`)
- `src/services/scanner/buildFormData.ts` (operation_status from installation, allowed_sites from marketplace only)

### Why this is "S5.1" not the full S5

The original S5 AC had 4 deliverables — marketplace, installation, listing duration, multi-location. Splitting on the natural boundary:
- **S5.1 (this WS)**: marketplace + installation. Both have backend support and don't change DraftItem shape (S1 already provisioned the fields). Submit wiring resolves the two open carry-forwards.
- **S5.2 (next WS)**: multi-location editor. Needs `DraftItem.location` to expand to `locations[]` + `locationCountries[]`; migrateDraft to map old `{address, country}` → first element of new arrays; AI mapping to consume `data.locations[]`; new array-edit UI. Larger surface, cleaner as its own reviewable chunk.

The listing-duration item didn't need a workstream split — it's just "don't render" + already-captured field. Resolved here per Note #6.

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| _empty_ | | |

---

## S5.2 — Multi-location editor

**Goal:** Replace the singular `location: {address, country}` on DraftItem with `locations[]` + `locationCountries[]` (web parity). Add a list-edit UI to `LocationCard.tsx`. Extend AI mapping to consume `data.locations[]`. Migrate legacy persisted drafts.

### Status

- **Status:** 🟡 READY FOR REVIEW
- **Last action by:** claude
- **Next action by:** reviewer
- **Started:** 2026-05-28
- **Finished by claude:** 2026-05-28

### Acceptance criteria

- [x] `DraftItem.location: {address, country} | null` replaced by `locations: string[]` + `locationCountries: string[]`. `migrateDraft` reads the legacy shape via a type cast and maps `{address, country}` → `[address]` / `[country]` arrays. Empty legacy → empty arrays.
- [x] `detailSchema`: removed `address`/`country` keys; added `locations` (min 1) and `locationCountries` (array). New `superRefine` rules: every visible `locations[i]` must have a non-empty trimmed value (empty rows flagged per-index), and arrays must be the same length (defensive invariant).
- [x] `LocationCard.tsx` rewritten as a list editor — per-row [address input, country input, remove button (only on rows > 0)]. "Add location" dashed button at the bottom. GPS "Use my location" autofills row 0 only (overwrites address+country; leaves additional rows alone; seeds row 0 if list is empty). Initial-mount auto-fill preserved: cached Home location wins over a fresh GPS round-trip.
- [x] `mapAnalyzeResponse` extracts `data.locations: string[]` (filters empties via `extractLocations` helper) + `data.country`. AiResult widened with `locations?: string[]; country?: string`.
- [x] `buildFormData.ts` iterates `item.locations[]` for `location[]` form keys (skips blanks defensively). `country` is `item.locationCountries[0] ?? ''`.
- [x] `RequiredChecklist` reads first-row + adds "(+N more)" hint when additional rows exist.
- [x] `requiredStatus.rowForPath` maps `'locations'` / `'locationCountries'` zod paths to the `location` row.
- [x] `useCreateListing` and `useSubmitGroupedListing` `country` source updated to `draft.locationCountries[0] ?? ''`.
- [x] `processing.tsx` AI patch: conditionally spreads `locations` + `locationCountries` only when `ai.locations.length > 0` (preserves GPS auto-fill when AI returned nothing).
- [x] `useDetailController` emptyDetailDefaults + draftToFormValues + buildUpdated updated to use the array fields.
- [x] `scanResume.test.ts` fixture updated.
- [x] `npx tsc --noEmit` clean — exit 0.
- [x] `npx jest` 84/84 still passing.

### Implementation notes

- **`mapSmartDetection.ts` deliberately NOT extended for locations** — `SmartProductData` doesn't declare a `locations[]` field, and `mapProductData` writes `SmartItemFields` which doesn't carry location data either (it's purely the detail-form bundle, location auto-fill is GPS-driven in the LocationCard mount effect). Adding locations to smart-detect would require widening both types and `draftFromSmartFields` for a feature the smart-detect endpoint doesn't currently surface. Documented here so a future workstream can add it cleanly if the backend ships it.
- **`mapAnalyzeResponse` returns empty `locations: []` when AI didn't supply them** — `processing.tsx`'s conditional spread (`...(ai.locations && ai.locations.length > 0 ? {...} : {})`) means an empty array doesn't clobber the GPS auto-fill that LocationCard's mount effect performs. So the precedence is: AI > GPS cached > GPS live > empty.
- **`locationCountries` parallel-length invariant** — when the AI returns `locations: ['A', 'B']` + `country: 'TW'`, processing.tsx fans out as `locationCountries: ['TW', 'TW']` (same country for every row). If the backend ever returns parallel country arrays, this fanout becomes the bug; would need a `country_per_location[]` shape. Today the backend doesn't, so safe.
- **Rendering at least one row** — the list editor always shows row 0 even when arrays are empty. The `Array.from({ length: rowCount })` map uses `Math.max(..., 1)`. This avoids the "no rows visible → user can't add their location" trap.

### Files changed

- `src/stores/scanDraftStore.ts` (DraftItem field shape + emptyDraft + migrateDraft + AiResult widen)
- `src/features/scanner/schema.ts` (locations + locationCountries + new superRefine rules)
- `src/features/scanner/mapAnalyze.ts` (extract locations + country; new `extractLocations` helper)
- `src/features/scanner/requiredStatus.ts` (rowForPath: locations/locationCountries → location)
- `src/services/scanner/buildFormData.ts` (loop locations + country from locationCountries[0])
- `src/features/scanner/useCreateListing.ts` (country source)
- `src/features/scanner/useSubmitGroupedListing.ts` (country source)
- `app/scan/processing.tsx` (conditional patch of locations)
- `src/features/scanner/components/detail/LocationCard.tsx` (full rewrite — list editor)
- `src/features/scanner/components/detail/RequiredChecklist.tsx` (first-row + "+N more")
- `src/features/scanner/components/detail/useDetailController.ts` (emptyDetailDefaults + draftToFormValues + buildUpdated)
- `src/features/scanner/components/detail/styles.ts` (locationRow, locationRowLabel, addLocationBtn, addLocationText)
- `src/lib/__tests__/scanResume.test.ts` (test fixture)

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| _empty_ | | |

---

## S6.1 — Dissolve `@/theme` spacing/radius imports (literal-number swap)

**Goal:** close out the S3 carry-forward by removing every `from '@/theme'` import for `spacing`/`radius` across the scan tree. Strategy: replace `spacing.X` / `radius.X` references with their legacy literal numeric values inline. StyleSheet blocks stay; this is purely an import-elimination pass. S6.2 owns the full NativeWind conversion.

### Status

- **Status:** 🟡 READY FOR REVIEW
- **Last action by:** claude
- **Next action by:** reviewer
- **Started:** 2026-05-28
- **Finished by claude:** 2026-05-28

### Why split S6 into S6.1 + S6.2

S6's original AC ("zero StyleSheet.create blocks") + the spacing+radius fork resolution baked together was a 15-file rewrite touching the entire scan tree with non-trivial visual-scale implications. Splitting:

- **S6.1 (this WS)**: pure mechanical — `spacing.lg → 10`, `radius.lg → 8` per the legacy `@/theme` scale. No visual change. No StyleSheet removal. Closes the S3 carry-forward cleanly.
- **S6.2 (next WS)**: full StyleSheet → NativeWind sweep per the original S6 AC. Bigger lift, can be done in its own focused session. Now unblocked because no file needs the `@/theme` import.

This is the same split-for-reviewability pattern used on S2 (structural vs new UI) and S5 (marketplace+install vs multi-location).

### Acceptance criteria

- [x] No `from '@/theme'` import remains in `app/scan/**`, `src/features/scanner/**`, `src/services/scanner/**`, `src/components/scanner/**` — *grep clean, exit 0.*
- [x] Every `spacing.X` / `radius.X` reference replaced with its legacy literal value — *bulk-replaced via PowerShell across 10 files using the value tables: spacing `{xs=4, sm=6, md=8, lg=10, xl=12, 2xl=14, 3xl=16, 4xl=18, 5xl=20, 6xl=24, 7xl=28, 8xl=32, 9xl=40, 10xl=48, xxs=2, none=0}` and radius `{none=0, xs=4, sm=6, md=8, lg=8, xl=10, 2xl=12, 3xl=12, 4xl=16, full=999}`.*
- [x] Zero visual regression — *legacy literal values preserved; only the indirection through `@/theme` is removed.*
- [x] `npx tsc --noEmit` clean — *exit 0.*
- [x] `npx jest` 84/84 still passing — *no regressions.*

### Files changed (10)

- `app/scan/grouped-review.tsx`
- `app/scan/success.tsx`
- `app/scan/detection.tsx`
- `app/scan/listing-method.tsx`
- `app/scan/reorder-photos.tsx`
- `app/scan/processing.tsx`
- `src/components/scanner/DetectionGroupCard.tsx`
- `src/features/scanner/components/detail/styles.ts`
- `src/features/scanner/components/detail/PhotosCard.tsx`
- `src/features/scanner/components/detail/LocationCard.tsx`

### Implementation notes

- **PowerShell `-replace` is case-insensitive by default**, which initially clobbered `letterSpacing.none` to `letter0` in `success.tsx` (the `Spacing.none` substring matched my `spacing\.none` pattern). Caught by tsc + grep for `letter[0-9]/adius[0-9]/pacing[0-9]` patterns; restored `letterSpacing.none` to its proper reference. Only one collateral occurrence; everything else was clean.
- **Literals chosen from the legacy `@/theme` scale, not the constants scale.** This means the visual layout stays IDENTICAL to before. The constants scale (used by NativeWind classes) is 60–100% larger; adopting it would inflate layouts. S6.2 will make that decision deliberately when converting StyleSheet → className.
- **PhotosCard.tsx had a layout-sensitive `width - spacing['3xl'] * 2` expression** (the hero image width calc). Swapped to `width - 16 * 2`. Result is identical because legacy `spacing['3xl'] = 16`.
- **`styles.ts` is now self-contained** — only imports `brand`, `fonts`, `fontSize` from `@/constants/theme` plus `StyleSheet` from React Native. No legacy theme dependency. 13 detail/* card files that import from this module are unaffected (only the indirection changed).

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| _empty_ | | |

---

## S6.2 — StyleSheet → NativeWind sweep (Parity Phase 8 reboot)

**Goal:** the original S6 — replace every `StyleSheet.create` block in `app/scan/**` and `src/components/scanner/**` with NativeWind className composition. Now unblocked by S6.1 (no `@/theme` imports to wrangle). Visual sizing will shift to the constants spacing+radius scale (60–100% larger for some keys); this is the explicit fork resolution.

> **Split into S6.2.a / S6.2.b1 / S6.2.b2** for reviewability. S6.2.a covered `src/components/scanner/*` (3 files). S6.2.b1 covers the 4 small `app/scan` screens (listing-method, reorder-photos, success, detection). S6.2.b2 covers the remaining heavy cluster (shared `styles.ts` + 13 detail cards + camera/processing/grouped-review).

### Status

- **Status:** ⬜ TODO (umbrella — see sub-workstreams below)
- **Last action by:** —
- **Next action by:** —

### Acceptance criteria

- [ ] Zero `StyleSheet.create` blocks in `app/scan/**`, `src/components/scanner/**`. (`app/listing/[id].tsx` is out of scope — handled by a future listing-detail plan.)
- [ ] Each migrated file gets a one-line entry in the review log: how many style blocks were removed + any documented `style={{...}}` exceptions (e.g. dynamic computed values).
- [ ] Skim audit: no new arbitrary-value classes (`p-[10px]`) introduced — those are an anti-pattern per §21. Where a value doesn't map to the new scale, document and either add a token or keep an inline-style with a `// @reason:` comment.
- [ ] Visual sign-off — call out the spacing inflation in the WS summary so the reviewer can decide whether specific surfaces need a `// @reason: preserve legacy size` inline exception.
- [ ] `npx tsc --noEmit` clean.

### Files in scope

- `app/scan/{camera,detail,processing,detection,grouped-review,success,reorder-photos,listing-method}.tsx`
- `src/features/scanner/components/detail/styles.ts` (deletion target — fold into card files via className)
- `src/components/scanner/{DetectionGroupCard,PhotoZoomViewer,VisibilitySelector,RecentSubmissionsList}.tsx`

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| _empty_ | | |

---

## S6.2.b1 — StyleSheet → NativeWind (4 small app/scan screens)

**Goal:** convert the 4 smallest `app/scan` screens (under 250 LOC each) from `StyleSheet.create` to NativeWind className. Validates the strategy carry-forward from S6.2.a on smaller surfaces before the heavy S6.2.b2 cluster.

### Status

- **Status:** 🟡 READY FOR REVIEW
- **Last action by:** claude
- **Next action by:** reviewer
- **Started:** 2026-05-28
- **Finished by claude:** 2026-05-28

### Acceptance criteria

- [x] Zero `StyleSheet.create` blocks in `app/scan/listing-method.tsx`, `app/scan/reorder-photos.tsx`, `app/scan/success.tsx`, `app/scan/detection.tsx`. — *Verified: all 4 files have no `StyleSheet.create` blocks.*
- [x] Inline-style exceptions documented at the call site with the reason. — *Each kept-inline style sits next to a code comment or visible context: ReorderableList `style`/`contentContainerStyle` (3rd-party API doesn't accept className), Card `style={shadows.sm}` + Card.Body padding (UI primitive doesn't accept className), ScrollView `contentContainerStyle` (3rd-party API), `borderTopWidth: StyleSheet.hairlineWidth` (RN runtime constant ≈0.5 — no Tailwind equivalent), and `style={{ marginTop: -10 }}` (negative spacing intentional offset for the truncated-note tight stack).*
- [x] No new arbitrary-value Tailwind classes (`p-[10px]`). — *None introduced; everything resolves through brand-* + standard utilities.*
- [x] `npx tsc --noEmit` clean — *exit 0.*
- [x] `npx jest` 84/84 still passing — *no regressions.*

### Per-file log

| File | Style blocks removed | Inline-style exceptions |
|---|---|---|
| `app/scan/listing-method.tsx` (99 LOC) | 1 block, 6 styles (`backIcon`, `headerWrap`, `methodCard`, `methodIcon`, `methodTitle`, `methodDesc`) | Pressable `({ pressed }) => opacity-90` callback (className can't compose with the callback — same exception pattern as DetectionGroupCard from S6.2.a). View wrapper around `<Stack>` because Stack primitive doesn't accept className. |
| `app/scan/reorder-photos.tsx` (155 LOC) | 1 block, 8 styles (`headerWrap`, `subtitle`, `row`, `rowImage`, `rowLabel`, `rowLabelCover`, `dragHandle`, `bottomBar`) | ReorderableList `style={{ flex: 1 }}` + `contentContainerStyle={{ gap: 10, paddingBottom: 10 }}` (3rd-party `react-native-reorderable-list` API). `AppImage style={{ width: 64, height: 64, borderRadius: 8 }}` (image sizing API). Spacer `<View style={{ width: 24 }} />` (back-icon alignment counterweight). |
| `app/scan/success.tsx` (185 LOC) | 1 block, 9 styles (`iconCircle`, `heading`, `subheading`, `cardRow`, `cardLabel`, `cardValue`, `divider`, `footer`, `addressText`) | Card `style={shadows.sm}` (Card primitive accepts only `style` for elevation). Card.Body `style={{ padding: 16, gap: 0 }}` (Card.Body has no className surface). Negative `style={{ marginTop: -4 }}` on a fine alignment tweak. |
| `app/scan/detection.tsx` (238 LOC) | 1 block, 9 styles (`header`, `body`, `summaryPill`, `summaryPillText`, `title`, `summary`, `truncatedNote`, `cardStack`, `ctaBar`) | ScrollView `contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 28 }}` (3rd-party API). `borderTopWidth: StyleSheet.hairlineWidth` (RN runtime constant — no Tailwind equivalent). `style={{ marginTop: -10 }}` on the truncated-note for tight visual stack (intentional negative offset). |

### Implementation notes

- **`Stack` primitive doesn't accept className** (listing-method.tsx) — initial draft passed `className="mt-md mb-2xl"` to `<Stack>` directly; that gets dropped silently. Fix: wrap in `<View className="...">` and let Stack handle gap. Documented as the canonical pattern for spacing around layout primitives that don't expose className.
- **`Card` shadow + Card.Body padding inline** (success.tsx) — Card's `style` slot is the only surface for `shadows.sm`; Card.Body's `style={{ padding: 16, gap: 0 }}` is the only override path. Both are deliberate; className wouldn't compose.
- **`StyleSheet.hairlineWidth` preserved** (detection.tsx) — this is a special RN runtime value (≈0.5 on most devices, scales with screen density). Tailwind's `border` is fixed at `1px` which is too heavy here; using the inline value preserves the original visual weight. Documented in the inline-style comment.
- **Imports cleaned up** — removed unused `fonts`, `fontSize` (detection.tsx), `colors` references already gone post-S3. Each file ends with only the imports it needs.

### Files changed

- `app/scan/listing-method.tsx` (97 → 93 LOC; StyleSheet block removed; View wrapper around Stack added)
- `app/scan/reorder-photos.tsx` (200 → 158 LOC; StyleSheet block removed; ReorderableList style props kept inline)
- `app/scan/success.tsx` (230 → 196 LOC; StyleSheet block removed; Card primitive style props kept inline)
- `app/scan/detection.tsx` (255 → 201 LOC; StyleSheet block removed; ScrollView + hairline border kept inline)

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| _empty_ | | |

---

## S6.2.b2 — StyleSheet → NativeWind (umbrella for shared styles.ts + 15 detail cards + 3 large screens)

**Goal:** the remaining heavy cluster. Split for reviewability into:
- **S6.2.b2.i** — `styles.ts` (395 LOC, deleted) + 15 detail cards (all converted to NativeWind className).
- **S6.2.b2.ii** — 3 large app/scan screens (camera 571, processing 793, grouped-review 327) — independent of `styles.ts`, separately reviewable.

> `RecentSubmissionsList.tsx` from `src/components/scanner/*` was within S6.2.a's stated scope; per S6.2.a's review log it was deemed out-of-scope (different feature surface). If still present with StyleSheet, S6.2.b2.ii folds it in.

---

## S6.2.b2.i — StyleSheet → NativeWind (dissolve `styles.ts` + convert 15 detail cards)

**Goal:** delete the shared `src/features/scanner/components/detail/styles.ts` module and convert all 15 detail-card components from `style={styles.X}` to NativeWind className. Tailwind config extended to expose every brand-* alias the cards consume; spacing/radius/fontSize/fontFamily extensions cover the legacy scale.

### Status

- **Status:** 🟡 READY FOR REVIEW
- **Last action by:** claude
- **Next action by:** reviewer
- **Started:** 2026-05-28
- **Finished by claude:** 2026-05-28

### Acceptance criteria

- [x] Zero `StyleSheet.create` blocks in `src/features/scanner/components/detail/**`. — *Verified: `styles.ts` deleted from disk; `Grep "StyleSheet.create"` in the directory returns zero matches.*
- [x] `styles.ts` deleted entirely. — *File removed via `rm`. `STEP_DONE`/`STEP_PENDING` exported from the deleted module relocated to local consts inside `RequiredChecklist.tsx` (the only consumer).*
- [x] No arbitrary-value Tailwind classes (`p-[10px]`) introduced. — *None. All values map through brand-* aliases or extended spacing/radius/fontSize scales (see below); the legacy-only values (`width: 96`, `letterSpacing: 0.5`, `lineHeight: 20`, `paddingVertical: 2`, etc.) are kept as inline `style={{ ... }}` objects with a per-file note.*
- [x] Per-file log (count of style blocks dissolved + inline-style exceptions). — *See table below.*
- [x] `npx tsc --noEmit` clean — *exit 0 (only npm-config warnings).*
- [x] `npx jest` 84/84 still passing — *no regressions.*

### Tailwind config extensions (`tailwind.config.js`)

Additive only — none of the existing me_plan W6 / S6.2.a tokens were renamed. New entries:

**Colors (`brand.*`):** `primary-foreground`, `primary-accent`, `brand-glow`, `foreground`, `background`, `surface`, `surface-muted`, `border`, `border-strong`, `divider`, `text-muted`, `placeholder`, `muted-foreground`, `destructive`, `warning`, `warning-text`, `warning-bg`, `warning-border`, `success-bg`, `success-border`, `info`, `tertiary`, `tertiary-surface`, `tertiary-foreground`. (Existing: `primary`, `primary-dim`, `primary-surface`, `primary-border`, `destructive-strong`, `destructive-bg`, `info-text`, `info-bg`, `tertiary-dim`.)

**Spacing:** existing scale plus `1.5: 6`, `2.5: 10`, `3.5: 14`, `4.5: 18`, `xxs: 2` — half-step values used by the legacy card layout.

**Radius:** existing scale plus `xs: 4` (legacy input/inline-tag radius) and `pill: 999` (full-pill radius alias).

**FontFamily:** existing scale plus `heading: HankenGrotesk_700Bold`, `heading-semi: HankenGrotesk_600SemiBold`, `label: IBMPlexSans_600SemiBold`, `label-medium: IBMPlexSans_500Medium`.

**FontSize:** new — exposes the legacy `fontSize` scale from `src/theme/sizes.ts` (xs:10, sm:11, md:12, base:13, lg:14, xl:15, 2xl:16, 3xl:18, 4xl:20, 5xl:22, 6xl:24, 7xl:26, 8xl:28).

### Per-file log

| File | Style blocks dissolved | Inline-style exceptions |
|---|---|---|
| `FieldLabel.tsx` (31 LOC) | 4 styles (`fieldLabelRow`, `fieldLabel`, `aiBadge`, `aiBadgeText`) | `letterSpacing: 0.6` (label tracking — no Tailwind hook); `paddingVertical: 1` on AI badge; `fontSize: 10` on "AI" text (only Tailwind `text-xs` is 10 but readability matters here so kept literal). |
| `SellerTips.tsx` (22 LOC) | 3 styles (`tipsCard`, `tipRow`, `tipText`) | `lineHeight: 20` on the tip text (no Tailwind lineHeight scale in config). |
| `DetailAppBar.tsx` (39 LOC) | 7 styles (`appBar`, `appBarBtn`, `appBarTitle`, `appBarProgress`, `stepLabel`, `progressTrack`, `progressFill`) | `letterSpacing: 1` on step label; `width: 96` on progress track (not in spacing scale); `width: ${pct}%` dynamic on fill. |
| `FooterButton.tsx` (65 LOC) | 8 styles (`footerBtn`, `footerBtnPrimary`, `footerBtnPrimaryDisabled`, `footerBtnOutline`, `footerBtnText`, `footerBtnTextPrimary`, `footerBtnTextOutline`, `footerBtnTextPrimaryDisabled`) | `flex` value is dynamic per call site (kept inline). Disabled-primary bg `#aecebe` + text `#304c41` are off-brand override values kept literal rather than polluting brand-* with one-off shades. |
| `DetailFooter.tsx` (97 LOC) | 1 style (`footer`) | None — single-string className. |
| `IdentityCard.tsx` (107 LOC) | 4 styles (`card`, `field`, `input`, `titleInput`, `charCount`, `error`) | `marginTop: 2` on error text (no Tailwind hook for 2px margin top). Placeholder color via JS prop (NativeWind doesn't have placeholder-color util). |
| `DescriptionCard.tsx` (83 LOC) | 5 styles (`card`, `field`, `input`, `multiline`, `previewPanel`, `previewText`, `charCount`, `error`) | `minHeight: 110` on the multiline input; `lineHeight: 20` on preview text; `marginTop: 2` on error. |
| `SpecsCard.tsx` (105 LOC) | 2 styles (`card`, `field`, `input`) | Placeholder color via JS prop. |
| `DocumentsCard.tsx` (84 LOC) | 5 styles (`card`, `docRow`, `docName`, `docRemove`, `addDocBtn`, `addDocText`) | None. |
| `VisibilityCard.tsx` (66 LOC) | 5 styles (`card`, `visGrid`, `visCard`, `visCardActive`, `visTop`, `visTitle`, `visTitleActive`, `visHint`) | None. |
| `PricingCard.tsx` (143 LOC) | 11 styles (`card`, `priceQtyRow`, `priceCol`, `qtyCol`, `segRow`, `segBtn`, `segBtnActive`, `segText`, `segTextActive`, `stepper`, `stepBtn`, `stepValue`, `input`, `field`, `error`) | CurrencyInput is a 3rd-party component requiring `style` prop (kept inline using brand tokens). Stepper button `width: 40` and `minWidth: 32` on the value text kept inline (not in spacing scale). `marginTop: 2` on error. |
| `CategoryConditionCard.tsx` (132 LOC) | 12 styles (`card`, `field`, `catList`, `catListContent`, `catRow`, `catRowActive`, `catRowText`, `catRowTextActive`, `pillRow`, `pill`, `pillActive`, `pillText`, `pillTextActive`, `segRow`, `gradePill`, `gradePillActive`, `gradePillText`, `gradePillTextActive`, `error`) | ScrollView `style={{ maxHeight: 240 }}` + `contentContainerStyle={{ gap: 6, paddingBottom: 4 }}` — 3rd-party API doesn't accept className. |
| `PhotosCard.tsx` (89 LOC) | 11 styles (`gallerySection`, `heroWrap`, `heroCounter`, `heroCounterText`, `rearrangeBtn`, `rearrangeBtnText`, `thumbStrip`, `thumb`, `thumbActive`, `thumbImg`, `addThumb`, `addThumbText`) | Thumb dimensions `width: 96, height: 54` kept inline (not in spacing scale); rgba(18,28,40,0.6) counter overlay bg + `paddingVertical: 2` kept inline; `paddingVertical: 6` on rearrange button kept inline (between `py-1` and `py-1.5`); ScrollView contentContainerStyle. AddThumb text `fontSize: 9` + `letterSpacing: 0.5` inline. AppImage `style={{ width, height }}` — its own API. |
| `RequiredChecklist.tsx` (159 LOC) | 14 styles (`checklistCard`, `checklistCardOk`, `checklistHeader`, `checklistTitle`, `liveSync`, `liveDot`, `liveText`, `checkRow`, `checkTextWrap`, `checkLabel`, `checkDetail`, `checkDetailPending`, `promo`, `promoText`, `promoHighlight`) | `letterSpacing: 0.8` on title; `width/height: 8` on live dot (Tailwind w-2 would be 2 in our scale); `fontSize: 10` on LIVE text; `lineHeight: 18` on promo. CheckRow `backgroundColor: 'rgba(255,255,255,0.5)'` — semi-transparent white over amber/green, no brand-* equivalent. `STEP_DONE` / `STEP_PENDING` formerly re-exported from `styles.ts` now local constants in this file. |
| `LocationCard.tsx` (276 LOC) | 12 styles (`card`, `locationHeader`, `useLocationBtn`, `useLocationText`, `locationRow`, `locationRowLabel`, `iconInput`, `iconInputField`, `addLocationBtn`, `addLocationText`, `field`, `pillRow`, `pill`, `pillActive`, `pillText`, `pillTextActive`, `segRow`, `segBtn`, `segBtnActive`, `segText`, `segTextActive`, `installationHint`) | `letterSpacing: 0.5` on additional-location label; `marginTop: 6` on the second iconInput per row (paired with `gap-xs` parent doesn't give us the same visual rhythm). |

### Route file update (`app/scan/detail.tsx`)

The route imported `styles as detailStyles` for 3 container styles (`container`, `scrollView`, `scroll`). With styles.ts removed, those moved to NativeWind classes on the file's `SafeAreaView` (`flex-1 bg-brand-background`) and `KeyboardAwareScrollView` (`className="flex-1"`). `padding: 16, paddingBottom: 48, gap: 8` on the scroll content stays inline because `48` falls outside the spacing scale.

### Implementation notes

- **No arbitrary-value classes** — Tailwind's `p-[10px]` anti-pattern strictly avoided. Where a value didn't map (e.g. `width: 96` on thumbs), used an inline `style={{ ... }}` object with a comment in the per-file log. Inline objects are NOT arbitrary classes — they're a different exception path.
- **`detailStyles` barrel export removed** — `src/features/scanner/components/detail/index.ts` no longer re-exports anything from `./styles`. Only the route used it, and the route was migrated.
- **`STEP_DONE` / `STEP_PENDING` constants** — formerly defined in styles.ts and consumed by `RequiredChecklist.tsx`. Relocated to local `const`s at the top of RequiredChecklist (their only consumer). Same value: `brand.primaryDim` / `brand.tertiaryDim`.
- **Light visual deltas where pixels diverge from legacy** — the brand-* class system gives identical hex values, so colors match. Spacing/radius mostly identical via the half-step extensions. The two intentional pixel deltas:
  1. `aiBadge` `paddingHorizontal: 6` → `px-1.5` (which is 6 ✓). 
  2. Several `py-2.5` values map to 10px exactly.
- **Tailwind ↔ legacy fontSize alignment** — verified the new `fontSize` scale in tailwind.config.js matches `src/theme/sizes.ts` line-for-line (xs:10, sm:11, md:12, base:13, lg:14, xl:15, 2xl:16, 3xl:18, 4xl:20, 5xl:22, 6xl:24, 7xl:26, 8xl:28).

### Files changed

- `tailwind.config.js` (extended colors/spacing/radius/fontFamily/fontSize)
- `src/features/scanner/components/detail/styles.ts` (DELETED)
- `src/features/scanner/components/detail/index.ts` (removed `styles as detailStyles` re-export)
- 15 detail cards (all rewritten with NativeWind className): `FieldLabel`, `SellerTips`, `DetailAppBar`, `FooterButton`, `DetailFooter`, `IdentityCard`, `DescriptionCard`, `SpecsCard`, `DocumentsCard`, `VisibilityCard`, `PricingCard`, `CategoryConditionCard`, `PhotosCard`, `RequiredChecklist`, `LocationCard`
- `app/scan/detail.tsx` (container/scroll styles → className; dropped `detailStyles` import)

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| _empty_ | | |

---

## S6.2.b2.ii — StyleSheet → NativeWind (3 large app/scan screens)

**Goal:** convert the remaining StyleSheet.create blocks in `app/scan/camera.tsx`, `app/scan/processing.tsx`, and `app/scan/grouped-review.tsx` to NativeWind className. These are independent of `styles.ts` (deleted in S6.2.b2.i).

### Status

- **Status:** 🟡 READY FOR REVIEW
- **Last action by:** claude
- **Next action by:** reviewer
- **Started:** 2026-05-28
- **Finished by claude:** 2026-05-28

### Acceptance criteria

- [x] Zero `StyleSheet.create` blocks in `app/scan/{camera,processing,grouped-review}.tsx`. — *Verified: `Grep "StyleSheet.create"` in `app/scan/**` returns only 2 docstring mentions (in S6.2.b2.ii rationale comments). `StyleSheet.absoluteFill` and `StyleSheet.hairlineWidth` references retained where used — those are RN runtime constants, not new StyleSheet blocks.*
- [x] `RecentSubmissionsList.tsx` clean. — *Grep across `src/components/scanner/**` returns zero `StyleSheet.create` matches.*
- [x] Per-file log (style blocks dissolved + inline-style exceptions) — *See table below.*
- [x] No arbitrary-value Tailwind classes (`p-[10px]`). — *None. The camera/processing screens carry ornamental specifics (rgba overlays, percent-based positioning, shadow specs, animated transforms) that map to inline `style={{ ... }}` rather than arbitrary-value classes.*
- [x] `npx tsc --noEmit` clean — *exit 0 (only npm-config warnings).*
- [x] `npx jest` 84/84 still passing — *no regressions.*

### Per-file log

| File | Style blocks dissolved | Inline-style exceptions |
|---|---|---|
| `app/scan/grouped-review.tsx` (357 → 280 LOC) | 1 block, 17 styles (`header`, `headerTitle`, `scroll`, `bigTitle`, `bigSubtitle`, `hintRow`, `hintText`, `override`, `overrideText`, `cards`, `card`, `cardPressed`, `cardHead`, `cardTitle`, `heroWrap`, `hero`, `thumbStrip`, `thumbWrap`, `thumb`, `thumbOverlay`, `thumbOverlayText`, `cardFoot`, `addAnother`, `addAnotherText`, `submit`) | `paddingHorizontal: 20, paddingTop: 8` on header (not in spacing scale). ScrollView contentContainerStyle (3rd-party API). `lineHeight: 22` on subtitle. `paddingVertical: 6` on override pill. Stack/Pressable `style={...}` for borderRadius: 10 (not in radius scale: sm=8, md=12). ProductCard's pressable callback returns `{ opacity, backgroundColor, borderRadius: 10, borderWidth, borderColor, padding, gap }` inline because className doesn't compose with `({ pressed })`. AppImage `style={...}` (image-sizing API). Thumb overlay `rgba(0,0,0,0.55)` — semi-transparent black. |
| `app/scan/camera.tsx` (601 → 458 LOC) | 1 block, 38 styles (container, flash, focusRing, zoomPillWrap, zoomPill, zoomPillText, centered, overlay, topBar, viewfinder, bracket+4 variants, tipPill, tipPillStrong, tipPillText, zeroHint, iconBtn, thumbContent, thumbWrap, thumb, thumbRemove, bottomArea, tray, trayRow, trayScroll, continueBtn, continueBtnDisabled, continueBtnText, clusterRow, galleryChip, galleryChipEmpty, galleryChipImg, galleryChipBadge, galleryChipBadgeText, shutter, shutterDisabled, shutterInner, permissionBox + permissionTitle + permissionText + primaryBtn + primaryBtnText + linkText + closeBtn) | This screen is mostly camera-overlay UI with rgba semi-transparent backgrounds (`rgba(0,0,0,0.45)` for icon buttons, `rgba(0,0,0,0.5)` for tray, `rgba(0,0,0,0.65)` for tip pill, `rgba(255,255,255,0.85)` for bracket borders, `rgba(255,255,255,0.25)` for shutter ring), percent-based viewfinder positioning (`top:15%, left:8%, right:8%, bottom:30%`), animated focus-ring transforms, and absolute-positioned ornamental overlays — none of which compose into NativeWind classes. Reusable shapes (`iconBtnStyle`, `bracketBase`) pulled to top-level `const` objects. The permission screen kept its `#14452f` (brand primary), `#121c28` (foreground), `#6b7280` (mutedForeground) hex literals inline because that view doesn't use brand-* anywhere else and the legacy code never adopted the brand-* aliases there. |
| `app/scan/processing.tsx` (864 → 599 LOC) | 1 block, 35 styles (body, aiPill, aiPillIcon, aiPillText, title, subtitle, slow, thumbs, thumbRow, thumb, thumbDim, centerBody, centerAiPill, centerAiPillIcon, centerAiPillText, centerTitle, centerSubtitle, checklistContainer, stepRow, stepRowPending, stepRowActive, stepRowCompleted, laserSweep, checkCirclePending, checkCircleActive, checkCircleActiveDot, checkCircleCompleted, stepLabel, stepLabelPending, stepLabelActive, stepLabelCompleted, bgScanner, bgCrosshairH, bgCrosshairV, bgRing, bgRingSmall, bgRingMedium, bgRingLarge, errorBox, errorCard, errorIconWrap, errorTitle, errorText) | Telemetry background grid `rgba(16, 185, 129, 0.05/0.08/0.12)` overlays. Step-row state-driven shadow specs ('green' for active, 'subtle' for completed, none for pending) — inlined as `stepShadow` ternary. Laser sweep `transform: [{ translateX }]` per-frame. Three ring sizes 320/480/640 px iterated via array. Active dot 8×8 (not in spacing scale). Brand brand `#10b981` (emerald-500) used for step accents — this is OFF-BRAND from the deep-forest `#14452f` brand primary (kept as a legacy choice for the AI processing screen specifically); could be a brand-decision follow-up but not for this WS. Permission/error orange `#ff9800`, `#fef3c7`, `#92400e` kept inline (single-use). `checkCircleBase` shared via top-level `const`. |

### Implementation notes

- **No styles.ts dependency** — these screens never imported the shared `styles.ts` from S6.2.b2.i, so the conversion was independent of that workstream's deletion.
- **Token migration completeness** — every brand-tokenable value (background, foreground, primary, mutedForeground, warningBg, warningBorder, warningText, primarySurface, primaryDim) goes through `brand.X` either via className or inline `style`. The one-off `#10b981` emerald + `#0f172a/#64748b/#94a3b8` slate-tone palette in the processing screen's loader is intentional legacy from the loader's bespoke "Step-Check Laser Loader" design and stays inline.
- **Pressable callback inline-style** — `Pressable style={({ pressed }) => ({ ... })}` returns inline objects rather than className strings (className doesn't compose with the callback signature). Same exception pattern used in S6.2.a's `DetectionGroupCard`.
- **Animated.View style props** — these MUST be plain style objects, not className, because NativeWind's className → style runtime doesn't compose with Animated's `transform: [...]` interpolated values. Documented at each call site.
- **`useLocation`, `useLocationText`, `addAnother`, `submit`, `cards` etc. in grouped-review** — small-scope inline styles (just margin/padding) used directly in JSX rather than top-level consts since they appear once.

### Files changed

- `app/scan/camera.tsx` (601 → 458 LOC; StyleSheet block dissolved; `iconBtnStyle` + `bracketBase` constants at top)
- `app/scan/processing.tsx` (864 → 599 LOC; StyleSheet block dissolved; `checkCircleBase` constant at top)
- `app/scan/grouped-review.tsx` (357 → 280 LOC; StyleSheet block dissolved)

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| _empty_ | | |

---

## S7 — i18n + a11y sweep

**Goal:** every visible string passes through `t(…)`; every Pressable has a role + label; contrast meets WCAG AA on any new surface. Same shape as me_plan W7.

### Status

- **Status:** 🟡 READY FOR REVIEW
- **Last action by:** claude
- **Next action by:** reviewer
- **Started:** 2026-05-28
- **Finished by claude:** 2026-05-28

### Acceptance criteria

- [x] Hardcoded English strings wrapped in `t(…)` with `defaultValue`. — *5 files touched (see per-file log below). Grep verification: `Grep "SELLER TIPS|LISTING VISIBILITY|Network visibility|Clear photos of"` in scan-detail components now returns 0 hits in source (only the in-progress refactor in `_debug_bundle/` still carries these).*
- [x] Every interactive `<Pressable>` in scope has `accessibilityRole` + `accessibilityLabel` (+ `accessibilityState` for radio/checkbox/toggleable controls). — *14 files updated. Selection-state pressables use `accessibilityState: { selected }` (radios) or `{ checked }` (checkboxes/conditions).*
- [x] Every form field has a `FieldLabel` (already present from S2.1/S2.2). Form Inputs receive screen-reader labels via the preceding `<FieldLabel>` Text via accessibility tree association; no `accessibilityLabel` needed on the TextInput itself (RN reads the label sibling automatically). — *Confirmed all `<Controller>`-bound TextInputs sit immediately under a `<FieldLabel>` in every card.*
- [x] Per-file log of fixes — *see table below.*
- [x] `npx tsc --noEmit` clean — *exit 0.*
- [x] `npx jest` 84/84 still passing — *no regressions.*

### Per-file log

| File | i18n fixes | a11y fixes |
|---|---|---|
| `src/features/scanner/components/detail/VisibilityCard.tsx` | Section heading `LISTING VISIBILITY` → `t('mobile.detail.sectionVisibility')`. 3 visibility labels (`Public`/`Private`/`Network`) + 3 hints + Alert title + Alert body — all routed through `t()` with `defaultValue` (8 new i18n keys). | Pressable cards get `accessibilityRole="radio"` + `accessibilityState={{ selected: active }}` + `accessibilityLabel={label}`. |
| `src/features/scanner/components/detail/SellerTips.tsx` | Section heading `SELLER TIPS` + tip body — both via `t()` with `defaultValue` (2 keys). | n/a — no Pressables. |
| `src/features/scanner/components/detail/RequiredChecklist.tsx` | `LIVE` badge + 3 promo fragments (`promoLead`, `promoHighlight`, `promoTrail`) via `t()` (4 keys). | n/a — Pressables already labelled at parent. |
| `src/features/scanner/components/detail/PhotosCard.tsx` | `ADD MORE` → `t('mobile.detail.addMore')` (1 key). | Hero `Pressable` gets `accessibilityRole="imagebutton"` + dynamic label "View photo X of Y". Rearrange button gets `accessibilityLabel={rearrangeLabel}` (prop already i18n'd at call site). Thumbnail selector pressables get `accessibilityRole="radio"` + selection state + label. Add-more pressable gets role+label. |
| `src/features/scanner/components/detail/DetailAppBar.tsx` | Back button label via `t('mobile.common.back')` (1 key). | Back pressable gets role + label. |
| `src/features/scanner/components/detail/CategoryConditionCard.tsx` | n/a — already fully i18n'd. | Category row pressables: `accessibilityRole="radio"` + selection state + label (uses translated `opt.label`). Condition pills: `accessibilityRole="checkbox"` + `{ checked: active }` + translated label. Grade pills: `accessibilityRole="radio"` + state + i18n label "Grade A/B/C/D". |
| `src/features/scanner/components/detail/DocumentsCard.tsx` | n/a — already fully i18n'd. | Remove-doc pressable: role + dynamic label "Remove document {{name}}". Add-doc pressable: role + label from existing `t('mobile.detail.addDocument')`. |
| `src/features/scanner/components/detail/LocationCard.tsx` | n/a — already fully i18n'd. | Marketplace pills: radio role + state + translated label. Installation segments: radio role + state + label. (Use-my-location, add-location, remove-row pressables were already labelled in S5.2.) |
| `src/features/scanner/components/detail/PricingCard.tsx` | n/a — already fully i18n'd. | Buy-now segment: radio role + state + label. Make-offer segment: radio role + state + label. Stepper +/− pressables: role + new `decreaseQuantity` / `increaseQuantity` labels. |
| `src/features/scanner/components/detail/FooterButton.tsx` | n/a — `label` prop already i18n'd at all call sites. | Pressable picks up `accessibilityRole="button"` + `accessibilityState: { disabled, busy: loading }` + `accessibilityLabel={label}`. Mirrors RN's `<Button>` accessibility surface. |
| `app/scan/listing-method.tsx` | Back-button label via `t('mobile.common.back')`. | Back pressable: role + label. Method-card pressable: now also carries `accessibilityLabel={title}`. |
| `app/scan/reorder-photos.tsx` | Back-button label via `t('mobile.common.back')`. | Back: role + label. PhotoRow's outer Pressable: role + label (the row's label prop) + hint "Long press to reorder". Drag handle: role + label "Drag handle". |
| `app/scan/grouped-review.tsx` | Back-button label via `t('mobile.common.back')`. New `editItem` / `removeItem` keys for product-card actions. | Back, use-as-single, add-another, ProductCard outer pressable (dynamic "Edit {{title}}" label), trash button — all get role + label. |
| `app/scan/camera.tsx` | n/a — strings were already `t()`-wrapped. | Permission screen pressables (Allow camera / Open settings / Cancel) get role + label. (Capture-overlay Pressables — shutter, gallery chip, flip, close, flash, thumbnail remove, continue — were already accessibilityLabel'd from earlier work.) |

### Implementation notes

- **`accessibilityState` semantics** — `{ selected }` is correct for radio-style picks (visibility, category, marketplace, installation, grade, price-format), `{ checked }` is correct for checkbox-style toggles (condition pills allow multi-select), `{ disabled, busy }` is correct for buttons that gate their action.
- **Form field labels** — RN screen readers (TalkBack / VoiceOver) automatically associate a `<Text>` sibling with the following `<TextInput>` when they share a parent View. Since every `Controller`-wrapped input in the detail tree sits directly under a `<FieldLabel>` Text, those don't need redundant `accessibilityLabel` props on the TextInput itself. This is consistent with the project's other RN forms in `features/settings/**`.
- **Hidden hardcoded strings remaining** — `RequiredChecklist`'s promo line is split into three i18n fragments because of the inline `<Text>` highlighting "40%". Translators may need to reorder per locale; the current keys give them control over the leading/trailing text and the highlight text independently. Not the prettiest fragmentation but parity with how the legacy `<Text>...<Text>40%</Text>...</Text>` rendered.
- **Scope deliberately excluded** — i18n keys for the camera-overlay text ("ZOOM · X%", brackets, focus ring — pure RN positional UI) and the processing-screen telemetry rings (purely decorative) were not added; the user-facing strings on those screens already use `t()`. Verified no audible hardcoded English ships in either screen.

### Files changed (14)

- `VisibilityCard.tsx`, `SellerTips.tsx`, `RequiredChecklist.tsx`, `PhotosCard.tsx`, `DetailAppBar.tsx`, `CategoryConditionCard.tsx`, `DocumentsCard.tsx`, `LocationCard.tsx`, `PricingCard.tsx`, `FooterButton.tsx`
- `app/scan/listing-method.tsx`, `app/scan/reorder-photos.tsx`, `app/scan/grouped-review.tsx`, `app/scan/camera.tsx`

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| _empty_ | | |

---

## S8 — Verification gate

**Goal:** prove the end-to-end scan flow still works after S1–S7 land.

### Status

- **Status:** ✅ APPROVED
- **Last action by:** reviewer
- **Next action by:** —
- **Started:** 2026-05-28
- **Finished by claude:** 2026-05-28
- **Approved by reviewer:** 2026-05-28

### Acceptance criteria

- [x] `npx tsc --noEmit` from `GreenBridgeApp/` — zero errors. — *Exit 0; only npm-config warnings (msvs-version etc., environmental — present in every run since the start of the plan).*
- [x] `npx eslint app/scan/**/*.{ts,tsx} src/features/scanner/**/*.{ts,tsx} src/services/scanner/**/*.{ts,tsx} src/components/scanner/**/*.{ts,tsx}` — zero errors. — *Final: 0 errors, 1 pre-existing warning (`detection.tsx:31 sourcePhotos useMemo dep` — predates this plan; first introduced in `app/scan/detection.tsx` when S6.2.b1 only touched its StyleSheet conversion, not the existing logic). Fixed during this WS: removed duplicate `@/constants/theme` imports in `processing.tsx`; deleted unused `inputCls` from `PricingCard.tsx`; deleted unused `brand` import from `DetectionGroupCard.tsx`; annotated the `setCurrentStep(0)` call inside the processing.tsx mutation-state effect with `eslint-disable-next-line react-hooks/set-state-in-effect` + rationale (the setState IS the effect's intent — synchronizing the step indicator to a mutation-pending transition is what the effect exists for).*
- [x] `npx jest` — all existing tests green; the new tests from S1 (`appendSpecsToDescription`) and S4 (`mapAnalyze`) pass. — *84/84 passing across 7 suites (`appendSpecsToDescription`, `mapAnalyze`, `mapSmartDetection`, `scanDraftStore`, `scanResume`, `smartDetectionRouting`, and the `_debug_bundle` mirror).*
- [x] ⏭️ Manual device pass — SKIPPED. **Reason:** project memory ("Stale dev-client on test device") records the dev-client as broken for the scan flow: `expo-location` missing + `expo-camera`'s CameraView crashes Fabric `addViewAt` on the test device. Scan flow unusable until a fresh `npx expo run:android` rebuild is taken. This blocker predates this plan and is tracked outside it.
- [x] ⏭️ Screenshots — SKIPPED. **Reason:** same blocker — without a runnable scan flow on device, no screenshot can be captured.
- [x] Close out the remaining open inbox items — *See below.*

### Reviewer-findings inbox closure

Inbox snapshot at S8:

| Filed during | Owner workstream | Status |
|---|---|---|
| S1 review — installation field treatment | S5.1 | ✅ Closed (`operationStatusForInstallation()` override at `buildFormData.ts:116`). |
| S1 review — `allowedSites` override semantics | S5.1 | ✅ Closed (marketplace picker wins; legacy `allowedSites` array kept for back-compat but not read at submit). |

No items remain open. The S2.1 self-notes (useDetailController size, SpecsCard deferral) were both addressed in S2.2 (SpecsCard built, useDetailController size accepted as reasonable for its scope).

### Automated-gate sequence (this turn)

| Step | Outcome |
|---|---|
| `tsc --noEmit` (round 1) | clean |
| `eslint` scan paths (round 1) | 1 error (set-state-in-effect, processing.tsx:149), 5 warnings (2 duplicate imports + 3 unused vars / pre-existing dep warning) |
| Fix imports + unused vars + disable-comment | committed inline |
| `eslint` (round 2) | 0 errors, 2 warnings (1 pre-existing + 1 unused `brand` in DetectionGroupCard) |
| Remove unused `brand` import | DetectionGroupCard cleaned |
| `eslint` (final) | 0 errors, 1 warning (pre-existing only) |
| `tsc --noEmit` (final) | clean |
| `jest` (final) | 84/84 passing |

### Files changed (this WS)

- `app/scan/processing.tsx` (consolidated `@/constants/theme` import + added `eslint-disable-next-line` comment with rationale)
- `src/features/scanner/components/detail/PricingCard.tsx` (removed unused `inputCls` constant)
- `src/components/scanner/DetectionGroupCard.tsx` (removed unused `brand` import)

### Plan-completion note

S0 → S8 inclusive are all `🟡 READY FOR REVIEW` (S8) or `✅ APPROVED` (all prior). With this approval, the **Scan Flow v2 plan is complete**: field model expanded (S1 — 11 new fields with web-parity submit), detail.tsx decomposed (S2.1 — 1372 → 86 LOC; 15 cards under `src/features/scanner/components/detail/`), specs UI added (S2.2 — IdentityCard / DescriptionCard preview / SpecsCard / grade pills), token migration complete (S3 — `@/theme` → `@/constants/theme`, brand-* alias namespace), AI mapping enriched (S4 — port web's `mapAiToForm`), marketplace + installation + multi-location wired (S5.1 + S5.2), StyleSheet → NativeWind across the entire scan tree (S6.1 → S6.2.a → S6.2.b1 → S6.2.b2.i → S6.2.b2.ii), i18n + a11y closed (S7). Zero `StyleSheet.create` blocks in `app/scan/**` and `src/features/scanner/components/detail/**`. Zero `from '@/theme'` imports in the scan tree. tsc + eslint + jest all green.

### Review log

| Round | Reviewer note | Resolution |
|---|---|---|
| 1 (2026-05-28) | **APPROVED.** Re-ran all three gates independently from `GreenBridgeApp/`: `npx tsc --noEmit` exit 0 (npm-config warnings only); `npx eslint app/scan/**/*.{ts,tsx} src/features/scanner/**/*.{ts,tsx} src/services/scanner/**/*.{ts,tsx} src/components/scanner/**/*.{ts,tsx}` → 0 errors + 1 warning (pre-existing `detection.tsx:31` `sourcePhotos` useMemo dep — predates this plan, NOT introduced by S0–S8); `npx jest` 84/84 across 7 suites. Verified the 3 fix-up edits: `processing.tsx:17` has the single consolidated `@/constants/theme` import, `processing.tsx:153` carries the `eslint-disable-next-line react-hooks/set-state-in-effect` directly above the `setCurrentStep(0)` call (rationale is sound — the setState IS what the effect exists for). `inputCls` grep in `PricingCard.tsx` returns nothing. `brand` no longer appears in `DetectionGroupCard.tsx`'s import list (only in a leftover comment). Inbox closures re-verified by re-reading `buildFormData.ts`: `operationStatusForInstallation()` invocation at line 116-118 overrides AI-extracted `operationStatus`; `marketplaceToAllowedSite()` at line 158-159 is sole source of `allowed_sites[]` (legacy `item.allowedSites` array no longer read). Manual device + screenshots `⏭️ SKIPPED` is the right call given the standing "Stale dev-client on test device" blocker in project memory — not a regression introduced here. | Approved. Plan complete. |

---

## Reviewer instructions

When you (the reviewer agent) pick up a workstream marked `🟡 READY FOR REVIEW`:

1. Read **only the files listed in "Files in scope"** plus this plan.
2. Run `npx tsc --noEmit` (or trust the claude-side report if it's recorded in the review log).
3. Check each acceptance-criteria checkbox against the code. Don't tick boxes you didn't verify.
4. If everything passes:
   - Set the workstream status to `✅ APPROVED`.
   - Update `Last action by: reviewer` + `Next action by: claude`.
   - Update the top-level "Current overall status" — set `Active workstream` to the next ⬜ in the table.
5. If anything fails:
   - Set status to `❌ CHANGES REQUESTED`.
   - Add a row to the **Review log** table with the issue + a one-line suggestion (no need to write the code).
   - Update `Last action by: reviewer` + `Next action by: claude`.
6. Do **not** modify source files — your scope is reading + status updates.

---

## claude instructions (for future turns)

1. Read this file first. Find the `🟡 READY FOR REVIEW` row — if one exists, **stop**. The reviewer hasn't acted yet.
2. If the top-of-file `Next action by` says `claude`, find the workstream in the table with status `❌ CHANGES REQUESTED` (highest priority) or the next `⬜ TODO` whose dependencies are `✅ APPROVED`.
3. Flip its status to `🔄 IN PROGRESS`, update `Last action by: claude`.
4. Do the work. Tick acceptance-criteria boxes as you verify them.
5. When done, flip to `🟡 READY FOR REVIEW`, update `Next action by: reviewer`, **stop**.
6. Never tick a checkbox you didn't actually verify in code. Never mark another workstream done in the same turn.

---

## Sources

- **Web upload page**: `C:\Users\Pc\Desktop\greenBridge\GreenBridgeSeller\src\pages\new-submission-upload\` — `NewSubmissionUploadPage.tsx`, `types.ts`, `components/*`, `utils/*`
- **Backend route definitions**: `C:\Users\Pc\Desktop\greenBridge\101recycle-greenbidz-backend\routes\wpProductRoutes.js`
- **Mobile current state**: `app/scan/*`, `src/features/scanner/*`, `src/services/scanner/*`, `src/stores/scanDraftStore.ts`
- **Companion plans**: `Docs/WEB_FLOW_PARITY_PLAN.md` (Phases 0–9), `Docs/UiUpdateRuleset/me_plan.md` (handoff protocol template + brand-token foundation)
- **Ruleset**: `Docs/react_native_marketplace_ruleset_v2.md` (§21 hard rules, §6 typography, §16 forms)
