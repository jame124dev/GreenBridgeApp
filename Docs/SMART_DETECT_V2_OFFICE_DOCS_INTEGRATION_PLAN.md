# Smart-Detect v2 — Office Docs (DOCX/PPTX/XLSX/CSV) Mobile Integration Plan

Owner: mobile
Backend companion: [`101recycle-greenbidz-backend/docs/SMART_DETECT_V2_OFFICE_DOCS_PLAN.md`](../../101recycle-greenbidz-backend/docs/SMART_DETECT_V2_OFFICE_DOCS_PLAN.md) (Phase 2 shipped, in PROGRESS doc)
Endpoint: `POST /api/v1/wp/analyze-smart-detection-v2` (SSE)
Prerequisite: [`SMART_DETECT_V2_SSE_INTEGRATION_PLAN.md`](SMART_DETECT_V2_SSE_INTEGRATION_PLAN.md) (P0–P4 shipped behind flag default-off)

---

## 0. Guiding principle — three small extensions, zero structural change

The backend's Phase 2 work is **additive**:

1. `extractOfficeDoc` now sits behind the same multipart/`document_urls[]` plumbing that PDFs already use.
2. The `result` SSE event remains byte-identical to v1 — `image_urls[]` may include extracted-from-office images, `document_pages[]` may include office-derived entries (with two new optional fields: `sourceName`, `sourceLabel`).
3. New per-file failure modes are surfaced as **non-fatal** SSE `error` events with localized `message` strings already rendered server-side using the request's `language`.

So the client work is:

| What | Where |
| --- | --- |
| Extend TS types (`DocumentPageRef`, `StagePhase`, `StreamErrorCode`, optional `Photo.sourceLabel`) | [`smartDetectionTypes.ts`](../src/features/scanner/smartDetectionTypes.ts), [`smartDetectStreamTypes.ts`](../src/features/scanner/smartDetectStreamTypes.ts), [`scanDraftStore.ts`](../src/stores/scanDraftStore.ts) (P4 only) |
| Add one stage enum value, deprecate the old one — **primary screen is `processing-v2.tsx`** when `SMART_DETECT_V2_ENABLED=1` | [`smartDetectStreamTypes.ts`](../src/features/scanner/smartDetectStreamTypes.ts), [`processing-v2.tsx`](../app/scan/processing-v2.tsx) (**required**), [`processing.tsx`](../app/scan/processing.tsx) (fallback — v2 redirects away before mutation) |
| Display backend-localized error toasts (the server already speaks the user's language) | [`processing-v2.tsx`](../app/scan/processing-v2.tsx) (**required**), [`processing.tsx`](../app/scan/processing.tsx) (fallback) |
| Surface `sourceLabel` on extracted-page thumbnails (optional UX nicety) | photo-augmentation in both processing screens → [`PhotosCard.tsx`](../src/features/scanner/components/detail/PhotosCard.tsx), [`detection.tsx`](../app/scan/detection.tsx), live product cards in [`processing-v2.tsx`](../app/scan/processing-v2.tsx) |
| Document picker — no MIME-allowlist change needed; existing `'*/*'` already accepts office docs (per [Agent C research]: `app/scan/camera.tsx:278-345`) | [`camera.tsx`](../app/scan/camera.tsx) — copy + helper text only |

> **Primary UI path.** When `SMART_DETECT_V2_ENABLED=1`, [`processing.tsx`](../app/scan/processing.tsx) redirects to [`processing-v2.tsx`](../app/scan/processing-v2.tsx) **before** starting the mutation (`router.replace(routes.scanProcessingV2)` at line 315). All P1/P2 work must land in `processing-v2.tsx` first; `processing.tsx` changes are parity for the flag-off fallback only.

> **What we are NOT changing.** Upload pipeline ([`uploadGcsDocuments`](../src/services/scanner/uploadGcsPhotos.ts) — note: docs share the photo uploader file), SSE transport ([`smartDetectStream.ts`](../src/services/scanner/smartDetectStream.ts) — request body, frame parsing, and non-fatal error forwarding are already correct), `mapSmartDetection`, `applySmartDetection`, [`useSmartDetect.ts`](../src/features/scanner/useSmartDetect.ts) (already passes `onEvent` through unchanged). P4 adds one optional field to the existing `Photo` type — no other draft-store shape changes.

---

## 1. Status table (two-agent protocol — mirror of `GCS_UPLOAD_INTEGRATION_PLAN.md` §0)

| Symbol | Meaning |
|---|---|
| ⬜ TODO | Not started |
| 🔄 IN PROGRESS | claude actively coding |
| 🟡 READY FOR REVIEW | claude finished — reviewer to evaluate |
| ❌ CHANGES REQUESTED | reviewer found issues |
| ✅ APPROVED | reviewer accepted |
| ⏭️ SKIPPED | explicitly deferred — must include a `Reason:` line |

**Current overall status:** ✅ **CODE-COMPLETE** — all 6 implementation phases approved 2026-06-05. P6 is gated on operational work (backend §7.1 answer, telemetry wire-up, native-speaker zh proofread, device smoke).

| Phase | Status | Last action |
| --- | --- | --- |
| P0 — Type extensions | ✅ APPROVED | reviewer (2026-06-05) |
| P1 — Stage rename + step mapper | ✅ APPROVED | reviewer (2026-06-05) |
| P2 — Non-fatal error UX | ✅ APPROVED | reviewer (2026-06-05) |
| P3 — Picker UX hardening | ✅ APPROVED | reviewer (2026-06-05) |
| P4 — Thumbnail provenance | ✅ APPROVED | reviewer (2026-06-05) |
| P5 — Tests + fixtures | ✅ APPROVED | reviewer (2026-06-05) |
| P6 — Manual smoke + rollout | ⬜ TODO (blocked on §7.1 + telemetry + zh proofread + device smoke) | — |

**Verification gates (final, 2026-06-05):** `npx tsc --noEmit` exit 0 (npm-config warnings only); `npx jest` **124/124** passing across 10 suites (was 116 before — 8 new tests from P5).

### Reviewer log — 2026-06-05 (round 2: P3 + P4)

**Verdict: ✅ Approved.** Reviewer re-ran `tsc --noEmit` (exit 0) and `jest 124/124`. Both deviations approved:
- **P3 caption → `accessibilityHint` + Alert** — "more useful than a passive caption; reactive guidance at exactly the moment it matters."
- **P4 detection thumbs `accessibilityHint` only** — "for 64×64 constraints. Sighted users see the hero caption on detail; SR users get hints on detection thumbs."

**Reviewer nits — disposition:**

| # | Nit | Disposition |
|---|---|---|
| 1 | P3 acceptance bullets still describe visible-caption plan | ✅ **Applied** — bullets rewritten to reflect shipped behavior (`accessibilityHint` + Alert) |
| 2 | Top-level status table needs P3/P4 → APPROVED + overall code-complete | ✅ **Applied** — overall status now "CODE-COMPLETE"; all six phases ✅ |
| 3 | PhotosCard thumb strip — optional `accessibilityHint` for SR browsing | ✅ **Applied** — `accessibilityHint={p.sourceLabel}` on each thumb `<Pressable>`; tsc + jest 124/124 still green |
| 4 | zh `pickFilesHint` missing space after comma | ⏭️ Folded into P6 zh proofread (rollout gate #2) |
| 5 | `asset.size` undefined on some pickers skips preflight | ⏭️ Acceptable — server remains authoritative; documented in code comment |

### Reviewer log — 2026-06-05 (round 1: rollout-minimum)

**Verdict: ✅ Approved (rollout-minimum).** Reviewer independently verified `tsc --noEmit` clean + `jest 124/124`. All 4 phases approved. Deviations from plan (`normalizePhase()` hybrid in P1; banner approach + telemetry-stub in P2; synthetic emission instead of fixture files in P5) all explicitly approved as pragmatic improvements over the written plan.

**Reviewer nits — disposition:**

| # | Nit | Disposition |
|---|---|---|
| 1 | `processing.tsx` `setStreamPhase(e.data.phase)` — no `normalizePhase` for fallback parity | ✅ **Applied** — inlined alias collapse at the stage-event branch with explanatory comment |
| 2 | v1-fallback banner missing `<AlertCircle>` icon present in v2 | ✅ **Applied** — added `AlertCircle` (16px, `#92400e`) + row-layout container; matches v2 visual exactly |
| 3 | P5 `document_too_large` test uses `big.xlsx` w/ 25 MB limit | ⏭️ Deferred — cosmetic mismatch; transport pass-through is what the test pins |
| 4 | No UI/component tests for the P2 banner render | ⏭️ Deferred to P6 smoke (cases 6–8 manual coverage) |

**Pre-flag-flip blockers (carried forward):**

1. **§7.1 answer** — does v1 endpoint support office docs? Hard blocker for falling back if v2 has issues.
2. **`scan_doc_rejected` telemetry** — wire once analytics convention is confirmed; rollout-gate #5.
3. **zh proofread** — backend `preparing_documents` stage label + 4 error-code messages; rollout-gate #2.
4. **P6 manual smoke** — especially smoke cases 6–8 (rejections) + case 10 (mixed batch) on a real device.

---

## 2. Backend contract (locked — Phase 2 PROGRESS doc is source of truth)

### 2.1 What changes on the wire vs v1 SSE (already shipped, see SSE plan §0)

Nothing new in the request/response *envelope*. The Phase 2 additions are:

#### A. New `stage` phase enum value
- `preparing_documents` (canonical) — replaces `preparing_pdfs` in new emissions.
- `preparing_pdfs` is kept as a **deprecated alias for ONE release** ([`smartDetectI18n.js:32-37`](../../101recycle-greenbidz-backend/services/smartDetectI18n.js)). Both keys share identical localized templates.

#### B. New non-fatal `error` event codes (Phase 2)
Backend localizes `message` itself; client just renders. Machine-readable `code` stays untranslated:

| `code` | `context` shape | When |
| --- | --- | --- |
| `unsupported_document_format` | `{ name, reason }` where `reason ∈ { cfb_legacy_or_encrypted, macro_enabled, xlsb_binary }` | CFB magic-byte sniff or rejected-mime classifier hit |
| `document_too_large` | `{ name, size, limit }` | Per-mime cap exceeded (25 MB DOCX/PPTX, 50 MB XLSX/CSV) |
| `document_parse_failed` | `{ name, reason? }` where `reason ∈ { xxe_blocked, ... }` | officeparser threw / XXE detected |
| `document_extraction_timeout` | `{ name }` | Worker thread hit 60s wall-clock |

All four are emitted with `fatal: false`. The batch continues with whichever files survived. Fatal `no_readable_input` only fires when **every** input got rejected.

#### C. Extended `document_pages[]` entries (in final `result` payload)
Existing fields ([`smartDetectionTypes.ts:58-66`](../src/features/scanner/smartDetectionTypes.ts) `DocumentPageRef`): `index, page, objectName, gcsUri, url, width, height`.

New **optional** fields (additive — old clients ignore):

```ts
sourceName?: string;   // e.g. "inventory.xlsx" — the original filename
sourceLabel?: string;  // e.g. "sheet 仁義廠" | "slide 3" | "embedded" — coarse origin hint (NOT row-level)
```

For PDF-derived pages: `sourceName` may be set to the document filename, `sourceLabel` null. For office-derived images: both populated. For pre-Phase-2 backends: both undefined.

#### D. `image_urls[]` no shape change
Office-extracted images flow into `image_urls[]` in the canonical position with `null` placeholders preserved for failed uploads — same as the existing PDF page contract. No client work here.

### 2.2 Request shape — fully unchanged

Per [`smartDetectStream.ts:123-126`](../src/services/scanner/smartDetectStream.ts):
```ts
const body = { image_urls: imageUrls, language: lang };
if (documentUrls?.length) body.document_urls = documentUrls;
```

`documentUrls` already accepts office-doc URLs verbatim. The backend's MIME classifier sniffs the URL response. **No client request-body change.**

### 2.3 File size caps (verified from backend source)

| Endpoint | Multer blanket cap | Per-mime cap (controller) |
| --- | --- | --- |
| `POST /api/v1/gcs/upload` ([`routes/gcsRoute.js:34`](../../101recycle-greenbidz-backend/routes/gcsRoute.js)) | 50 MB | none |
| `POST /api/v1/wp/analyze-smart-detection-v2` ([`routes/wpProductRoutes.js:84`](../../101recycle-greenbidz-backend/routes/wpProductRoutes.js)) | 50 MB | 25 MB DOCX/PPTX, 50 MB XLSX/CSV ([`wordPressSmart.js:2534-2548`](../../101recycle-greenbidz-backend/controller/wordPressSmart.js)) |

> **Client-side pre-flight cap is recommended but not required.** A user uploading a 30 MB DOCX will get a 50 MB multer pass on `/gcs/upload`, then a non-fatal `document_too_large` SSE event from the analyze endpoint — wasted bandwidth, slightly slow rejection. P3 adds an optional client-side mime-aware size check before upload to fail fast.

---

## 3. Phase overview

| Phase | Scope | Outcome | Risk |
| --- | --- | --- | --- |
| **P0** | Type extensions | `StagePhase` adds `preparing_documents`; `DocumentPageRef` gains `sourceName?`/`sourceLabel?`; `StreamErrorCode` union + typed `context` shapes | none (inert types) |
| **P1** | SSE stage rename + step mapper | **`processing-v2.tsx` `TIMELINE`/`PHASE_ORDER`** accepts `preparing_documents`; `processing.tsx` `PHASE_TO_STEP` parity for flag-off fallback | **medium if missed** — unknown phase → `indexOf` returns -1 and breaks v2 progress bar |
| **P2** | Non-fatal error UX | Per-file rejection toasts in **`processing-v2.tsx`** during the stream; server `message` rendered directly; telemetry `scan_doc_rejected` | low — transport already forwards non-fatal errors; UI is the gap |
| **P3** | Document picker UX hardening | Mime-aware size caps in helper text + optional client-side pre-flight | UX only |
| **P4** | Thumbnail provenance polish | Carry `sourceLabel` through photo augmentation → show on gallery/detection thumbnails | small data-model touch (`Photo.sourceLabel?`) |
| **P5** | Tests + fixtures | Extend `smartDetectStream.test.ts` with office-doc fixture; add per-error-code unit tests | none |
| **P6** | Manual smoke + rollout | Dev-build device smoke; staged flag enable; **§7.1 v1/v2 answer required** | requires fresh dev-client (see §10 caveat) |

Phases are independently shippable, but **rollout minimum** is P0 + P1 + P2 + P5 (in `processing-v2.tsx`). Without P1, v2 progress UI breaks on `preparing_documents`. Without P2, office-doc rejections are silent — the main failure modes users will hit. P3 and P4 are progressive polish, not rollout blockers.

---

## 4. Phase detail

### P0 — Type extensions (no behavior change)

**Files:**
- [`src/features/scanner/smartDetectionTypes.ts:58-66`](../src/features/scanner/smartDetectionTypes.ts) — `DocumentPageRef`
- [`src/features/scanner/smartDetectStreamTypes.ts:20-70`](../src/features/scanner/smartDetectStreamTypes.ts) — `StagePhase`, `StageEvent`, `StreamErrorEvent`, `StreamErrorCode`

**Changes:**

```ts
// smartDetectionTypes.ts — DocumentPageRef
// Existing required fields (url/width/height/index/page) are NOT changed —
// the two Phase 2 additions are both optional so old backends and old
// fixtures stay valid.
export type DocumentPageRef = {
  index: number;
  page: number;
  objectName?: string;
  gcsUri?: string;
  url: string;
  width: number;
  height: number;
  /** Phase 2 — original filename, e.g. "inventory.xlsx". May be set for PDF-derived pages too. */
  sourceName?: string;
  /** Phase 2 — coarse origin label, e.g. "sheet 仁義廠" | "slide 3" | "embedded". NOT row-level. Office-derived only. */
  sourceLabel?: string;
};
```

```ts
// smartDetectStreamTypes.ts
export type StagePhase =
  | "validating"
  | "preparing_documents"           // NEW (Phase 2 canonical)
  | "preparing_pdfs"                // DEPRECATED — kept until backend stops emitting (one release per smartDetectI18n.js:32-37)
  | "ai_running"
  | "extracting_products"
  | "done";

/** Phase 2 — additions to the previously-open `code: string` field. */
export type StreamErrorCode =
  | "pdf_fetch_failed"
  | "gcs_upload_failed"
  | "no_readable_input"
  | "ai_unavailable"
  | "deadline_exceeded"
  | "too_many_concurrent"
  | "cancelled"
  | "internal_error"
  | "product_extraction_failed"
  | "unsupported_document_format"      // Phase 2
  | "document_too_large"               // Phase 2
  | "document_parse_failed"            // Phase 2
  | "document_extraction_timeout"      // Phase 2
  | (string & {});                     // open for future codes

/** Typed context shapes for Phase 2 non-fatal errors (optional but recommended). */
export type UnsupportedDocumentFormatContext = {
  name: string;
  reason: "cfb_legacy_or_encrypted" | "macro_enabled" | "xlsb_binary";
};
export type DocumentTooLargeContext = { name: string; size: number; limit: number };
export type DocumentParseFailedContext = { name: string; reason?: string };
export type DocumentExtractionTimeoutContext = { name: string };
```

Also update the `StageEvent` JSDoc on `total` — it currently says `preparing_pdfs` only (line 23); change to `preparing_documents | preparing_pdfs`.

**Acceptance:**
- `tsc --noEmit` clean.
- No existing usage of `StagePhase` / `DocumentPageRef` breaks (the new fields are optional; new enum members extend the union additively).
- No production code path changes — purely a types-only PR.

### Implementation status — ✅ APPROVED (2026-06-05, reviewer)

**Files changed (2):**
- [`src/features/scanner/smartDetectStreamTypes.ts`](../src/features/scanner/smartDetectStreamTypes.ts) — added `preparing_documents` to `StagePhase`; updated `StageEvent` JSDoc to cover both phase enum names; added `StreamErrorCode` union (12 codes including 4 Phase 2 additions, with `string & {}` keep-open); added 4 typed context interfaces (`UnsupportedDocumentFormatContext`, `DocumentTooLargeContext`, `DocumentParseFailedContext`, `DocumentExtractionTimeoutContext`); narrowed `StreamErrorEvent.code` from `string` to `StreamErrorCode`.
- [`src/features/scanner/smartDetectionTypes.ts`](../src/features/scanner/smartDetectionTypes.ts) — `DocumentPageRef` gains optional `sourceName?`, `sourceLabel?`; doc-comment updated to cover office docs (DOCX/PPTX/XLSX/CSV) not just PDF.

**Verification:**
- `tsc --noEmit` initially surfaced the expected P1 follow-up (`processing.tsx:47` PHASE_TO_STEP missing `preparing_documents`); cleared after P1.
- No production behavior change.

---

### P1 — Stage rename + step mapper

**Primary file (v2 flag-on path):** [`app/scan/processing-v2.tsx:45-52`](../app/scan/processing-v2.tsx)

When `SMART_DETECT_V2_ENABLED=1`, all scan traffic lands here. The v2 screen drives progress via `TIMELINE` + `PHASE_ORDER.indexOf(phase)` — **not** `PHASE_TO_STEP`. If the backend emits `preparing_documents` and only `preparing_pdfs` is in `TIMELINE`, `indexOf` returns **-1**, producing a broken step counter (`stepNum` becomes 0, progress bar stalls).

Current `TIMELINE`:
```ts
const TIMELINE: { phase: StagePhase; label: string }[] = [
  { phase: 'validating', label: 'Validating' },
  { phase: 'preparing_pdfs', label: 'Reading documents' },
  ...
];
```

**Change A (required — `processing-v2.tsx`):** add the canonical phase to `TIMELINE`. Keep the deprecated alias OR normalize in the event handler — pick one:

```ts
// Option 1 (preferred): both entries in TIMELINE, same label
{ phase: 'preparing_documents', label: 'Reading documents' },
{ phase: 'preparing_pdfs', label: 'Reading documents' },  // alias — remove after one backend release

// Option 2: normalize in onStreamEvent before setPhase
const phase = e.data.phase === 'preparing_pdfs' ? 'preparing_documents' : e.data.phase;
```

Option 1 is safer — `PHASE_ORDER.indexOf` works for either emission without mutating the stream value. It's also safer for the existing fixture test ([`smartDetectStream.zh-hant.txt`](../src/services/scanner/__tests__/fixtures/smartDetectStream.zh-hant.txt)): the recorded `preparing_pdfs` frame keeps producing the same `stepNum` without needing a new fixture variant. Option 2 would silently change the in-memory `phase` value the consumer sees, which decouples the test from production behavior.

**Change B (fallback — `processing.tsx`):** add `preparing_documents` to `PHASE_TO_STEP` for the flag-off / pre-redirect path:

```ts
const PHASE_TO_STEP: Record<StagePhase, number> = {
  validating: 0,
  preparing_documents: 0,
  preparing_pdfs: 0,        // alias — remove after one backend release
  ai_running: 1,
  extracting_products: 2,
  done: 3,
};
```

**Acceptance:**
- Existing `smartDetectStream.zh-hant.txt` fixture test still passes (it uses PDF + photos so emits `preparing_pdfs`).
- Synthetic SSE frame with `phase: "preparing_documents"` advances **v2** step indicator to step 1 ("Reading documents") identically to `preparing_pdfs`.
- `processing.tsx` `PHASE_TO_STEP` parity verified for flag-off smoke.

### Implementation status — ✅ APPROVED (2026-06-05, reviewer)

**Approach revised from plan.** Plan listed two options; mid-implementation, "Option 1 = both entries in TIMELINE" turned out to cause a visible UI regression — the screen renders one row per TIMELINE entry (`{TIMELINE.map((row, i) => ...)}` at `processing-v2.tsx:459`) and shows `STEP {stepNum} OF {TIMELINE.length}`. Two `preparing_*` rows would mean **6 visible steps with two identical labels**. Switched to a hybrid: keep TIMELINE at 5 canonical rows, normalize the alias at receive-time via a tiny `normalizePhase()` helper. This delivers the same fixture-test safety the plan claimed (legacy `preparing_pdfs` frames produce the same `phaseIndex`) without the UI bloat. Plan's Option 1 narrative supersedes itself — the hybrid is what shipped.

**Files changed (2):**
- [`app/scan/processing-v2.tsx`](../app/scan/processing-v2.tsx) — `TIMELINE` row for `preparing_documents` (replaces `preparing_pdfs` row); new `normalizePhase()` helper at line ~59; `setPhase(normalizePhase(e.data.phase))` at the stage-event branch (line 217); inline doc-comments explain the one-release alias plan.
- [`app/scan/processing.tsx`](../app/scan/processing.tsx) — `PHASE_TO_STEP` gains `preparing_documents: 0`; deprecated `preparing_pdfs: 0` retained; explanatory comment.

**Verification:**
- `tsc --noEmit` clean.
- `jest` 116/116 (no test regressions; P5 adds 8 more).
- Existing fixture (`smartDetectStream.zh-hant.txt`) still works — fixture emits `preparing_pdfs`, which after `normalizePhase` reads as `preparing_documents`, which has the same `PHASE_ORDER.indexOf` as before.

---

### P2 — Non-fatal error UX

**Context.** Backend emits non-fatal errors mid-stream as:

```json
event: error
data: {"fatal":false,"code":"unsupported_document_format","message":"Macro-enabled files (.docm/.xlsm/.pptm) are not accepted.","context":{"name":"sheet.xlsm","reason":"macro_enabled"}}
```

The `message` is **already localized** by the backend ([`wordPressSmart.js:2502`](../../101recycle-greenbidz-backend/controller/wordPressSmart.js) calls `tr(lang, "error.unsupportedDocumentFormat.macro")`). The client should not re-translate — just render `message` directly.

**Transport — no change needed.** [`smartDetectStream.ts`](../src/services/scanner/smartDetectStream.ts) already forwards non-fatal errors via `safeOnEvent({ type: 'error', data: payload })` and continues the stream (lines 194–203). The existing unit test (`continues on a non-fatal error event and still resolves on result`) covers the transport contract.

**Primary file (required — `processing-v2.tsx`):** both processing screens currently ignore non-fatal errors in their `onEvent` / `handleStreamEvent` handlers (comments at `processing.tsx:118`, `processing-v2.tsx:242`). Add a non-fatal error branch:

```ts
} else if (e.type === 'error' && !e.data.fatal) {
  const ctx = e.data.context as { name?: string } | undefined;
  const label = ctx?.name ? `${ctx.name}: ` : '';
  // toast / banner: `${label}${e.data.message}`
  track('scan_doc_rejected', { code: e.data.code, reason: (ctx as any)?.reason });
}
```

Recommended: keep a `nonFatalRejections: { name: string; message: string }[]` in component state; show them in a `Toast`/banner stack on top of the existing progress UI. Each rejection persists for ~6 seconds. Prefix with `context.name` when present so multi-file batches are scannable.

**Fallback file:** same sink in [`processing.tsx`](../app/scan/processing.tsx) `handleStreamEvent` for flag-off parity.

**Behavior:**
- A user uploads 3 DOCXes; one is macro-enabled.
- Mid-stream, a toast appears: "sheet.xlsm: Macro-enabled files (.docm/.xlsm/.pptm) are not accepted."
- The other 2 DOCXes finish; the scan proceeds to detection / extraction.
- The final `result` event lands as usual.

**Optional client-side override.** If product wants to override the server message (e.g. shorter copy, friendlier tone) the client may key off `code + context.reason` and render its own string. Recommended only for one or two codes; the server messages are already curated for tone. New i18n keys (only if overriding):
- `scanner.errors.unsupportedFormat.cfb`
- `scanner.errors.unsupportedFormat.macro`
- `scanner.errors.unsupportedFormat.xlsb`
- `scanner.errors.documentTooLarge` (interpolate `{{ limit }}` from `context.limit` formatted via a `humanBytes` helper)
- `scanner.errors.documentParseFailed`
- `scanner.errors.documentExtractionTimeout`

Mirror to `zh.json`, `ja.json`, `th.json` per existing [`src/i18n/locales/`](../src/i18n/locales) convention.

**Telemetry (required for P6 rollout gate #5):** emit `track('scan_doc_rejected', { code, reason })` on each non-fatal office-doc rejection. `reason` comes from `context.reason` when present (e.g. `macro_enabled`). Confirm property naming with existing analytics convention before merge; event name is provisional.

**Acceptance:**
- Manual (v2 screen): upload a `.docm` via dev build → see a non-fatal toast with the macro-enabled message, scan continues.
- Manual: upload a 30 MB DOCX → see `document_too_large` toast quoting the 25 MB limit (server returns the limit via `context.limit`).
- Unit test: feed a synthetic SSE frame with each of the 4 new codes through `smartDetectStream.ts` and assert the consumer receives them (transport — already partially covered; extend with Phase 2 codes).

### Implementation status — ✅ APPROVED (2026-06-05, reviewer)

**Banner design (rolled own — no project Toast infra).** No global Toast component exists in this codebase (only i18n string keys mention "Toast"), so I built a minimal inline banner stack per screen rather than adding a new primitive. Each rejection persists for the screen's lifetime (no auto-dismiss) — useful for the streaming screen where the user wants to see what got dropped over the 30–60s run. Banners use the `#fef3c7 / #fbbf24 / #92400e` amber palette consistent with the existing scan-flow's warning surfaces.

**Telemetry deferred** — `track('scan_doc_rejected', ...)` left as a `TODO(telemetry)` comment in both handlers. No analytics sink is wired in the codebase yet; the plan §7.4 already flagged "confirm event name + property convention with analytics owner before merge." Once that lands, the comment becomes a one-line `track()` call.

**Files changed (2):**
- [`app/scan/processing-v2.tsx`](../app/scan/processing-v2.tsx) — added `nonFatalRejections` state (line ~197); added `e.type === 'error' && !e.data.fatal` branch to `onStreamEvent` with typed `context.name` extraction; rendered an `accessibilityRole="alert"` banner stack at the top of the ScrollView (above the existing AI badge).
- [`app/scan/processing.tsx`](../app/scan/processing.tsx) — same `nonFatalRejections` state + handler branch; rendered as absolutely-positioned banner stack (`top: 16, zIndex: 10`) inside the pending-state Screen so the centered-layout loader isn't pushed by banner height. This is the flag-off fallback — rarely visible since v2 redirects v1 before mutation.

**Verification:**
- `tsc --noEmit` clean.
- `jest` 116/116 still passing.
- IDE diagnostic for unused `nonFatalRejections` in processing.tsx surfaced and resolved by adding the banner render block.

---

### P3 — Document picker UX hardening (optional polish)

**File:** [`app/scan/camera.tsx:278-345`](../app/scan/camera.tsx) — `pickFiles()`

**Change A — helper text** (low effort, high clarity):

Use **mime-aware copy** — generic "up to 50 MB" misleads DOCX/PPTX users (server cap is 25 MB). Resolved per §7.3:

- i18n key: `scanner.supportedFormats` (en) → `"PDF, DOCX, PPTX, XLSX, CSV — DOCX/PPTX up to 25 MB, others up to 50 MB"`
- Mirror split-cap wording to `zh.json`, `ja.json`, `th.json`

**Change B — client-side mime-aware size pre-flight** (medium effort):

After `DocumentPicker.getDocumentAsync(...)` returns, before patching into the draft:

```ts
const CAP_BY_EXT = {
  '.docx': 25 * 1024 * 1024,
  '.pptx': 25 * 1024 * 1024,
  '.xlsx': 50 * 1024 * 1024,
  '.csv':  50 * 1024 * 1024,
  '.pdf':  50 * 1024 * 1024,
};
// reject + toast if file.size > cap; never upload
```

This saves bandwidth on the obvious-fail case but **does not replace** the server-side cap — server is authoritative. Keep the toast wording in sync with backend `documentTooLarge` copy.

> **Do NOT narrow the picker MIME allowlist.** Keeping `'*/*'` is intentional ([Agent B research]: `app/scan/camera.tsx:285`). Narrowing to specific MIMEs causes:
> 1. Inconsistent native picker behavior (Android often hands back `application/octet-stream` for unknown MIMEs anyway).
> 2. A worse error path — user picks a `.doc` from Files app, picker silently skips it, no error visible.
> Instead, let the user pick anything; the server returns a localized rejection toast (P2) when an unsupported format hits the analyze endpoint.

**Acceptance** (post-implementation; bullets sync to what shipped):
- Supported-formats string reachable via `accessibilityHint` on the picker button — covers screen-reader users without disrupting the camera viewfinder layout.
- Client-side pre-flight Alert fires the moment a too-large file is picked (single-file copy quotes the file name + size + limit; multi-file copy collapses to "{N} files were over their size limit").
- Picker still accepts any MIME (so "weird" files reach the server for proper localized rejection).
- Unknown extensions skip the pre-flight (server is authoritative).
- 4 new i18n keys mirrored across en/zh/ja/th (zh/ja/th AI-drafted, queued for P6 gate #2).

### Implementation status — ✅ APPROVED (2026-06-05, reviewer)

**Plan deviation — visible caption swapped for `accessibilityHint` + proactive Alert.** The camera screen is intentionally minimal — there's no spot under the "Add files" icon button for a `"PDF, DOCX, PPTX, XLSX, CSV — DOCX/PPTX up to 25 MB, others up to 50 MB"` caption without disrupting the viewfinder/shutter layout. Shipped instead:
1. **`accessibilityHint`** on the picker `<Pressable>` carries the supported-formats string — screen-reader users get the same info the plan's caption would have given.
2. **Client-side size pre-flight via Alert.** The moment a user picks a too-large file, a localized "File too large" Alert names the file, its size, and the limit. Per-file Alert when only one is oversize; consolidated "{N} files were over their size limit and were skipped" Alert when multiple. Far more useful than a passive caption — users get reactive guidance at exactly the moment it matters.

The plan's "small caption" intent is preserved (formats info is reachable + size constraints are enforced); the carrier just isn't a visible static caption.

**Files changed (5):**
- [`app/scan/camera.tsx`](../app/scan/camera.tsx) — added `CAP_BY_EXT` constant (5 mimes), `capForFile(name, size)` helper, `humanBytes(n)` formatter, `accessibilityHint` on the picker button. `pickFiles()` now collects oversize files via the same loop and fires a localized Alert (1-file or N-file variant) before pushing survivors to `setDocs`.
- [`src/i18n/locales/en.json`](../src/i18n/locales/en.json) — 4 new keys: `pickFilesHint`, `docTooLargeTitle`, `docTooLargeBody` (interpolated `{{name}}`, `{{size}}`, `{{limit}}`), `docMultipleTooLargeBody` (interpolated `{{count}}`).
- [`src/i18n/locales/zh.json`](../src/i18n/locales/zh.json), [`ja.json`](../src/i18n/locales/ja.json), [`th.json`](../src/i18n/locales/th.json) — same 4 keys mirrored. AI-drafted; native-speaker proofread queued for P6 rollout-gate #2 (same convention as the backend's `smartDetectI18n.js` zh/ja/th).

**Verification:**
- `tsc --noEmit` clean.
- `jest` 124/124 still passing.

---

### P4 — Thumbnail provenance polish: show `sourceLabel`

**Why this is not a one-liner.** `scanDetail` / `scanGroupedReview` do **not** render `documentPages` thumbnails. Extracted PDF/office pages are merged into `draft.photos` during `onSuccess` in both processing screens, copying only `uri`, `width`, and `height` — `sourceLabel` is dropped at that boundary:

```ts
// processing.tsx:353-361 (same pattern in processing-v2.tsx)
return {
  uri: url,
  width: docPage?.width ?? 0,
  height: docPage?.height ?? 0,
  // sourceLabel from docPage is NOT carried today
};
```

[`PhotosCard.tsx`](../src/features/scanner/components/detail/PhotosCard.tsx) renders `draft.photos` with no provenance field. [`DocumentsCard.tsx`](../src/features/scanner/components/detail/DocumentsCard.tsx) shows uploaded file **names**, not per-page extraction labels.

**Step 1 — extend `Photo` type** ([`scanDraftStore.ts:25-30`](../src/stores/scanDraftStore.ts)):

```ts
export type Photo = {
  uri: string;
  width: number;
  height: number;
  sizeBytes?: number;
  /** Phase 2 — coarse origin label from document_pages[], e.g. "sheet 仁義廠". Office/PDF-derived only. */
  sourceLabel?: string;
};
```

**Step 2 — carry label through photo augmentation** in both [`processing.tsx`](../app/scan/processing.tsx) and [`processing-v2.tsx`](../app/scan/processing-v2.tsx) `onSuccess`:

```ts
return {
  uri: url,
  width: docPage?.width ?? 0,
  height: docPage?.height ?? 0,
  sourceLabel: docPage?.sourceLabel,
};
```

**Step 3 — render label** where extracted-page thumbnails appear:

| Screen | File | Change |
| --- | --- | --- |
| Detail gallery | [`PhotosCard.tsx`](../src/features/scanner/components/detail/PhotosCard.tsx) | Small caption under thumb when `photo.sourceLabel` set |
| Detection choice | [`detection.tsx`](../app/scan/detection.tsx) | Same caption on per-product image thumbnails |
| Live v2 progress | [`processing-v2.tsx`](../app/scan/processing-v2.tsx) | Optional caption on product preview cards |

For office-derived: "sheet 仁義廠", "slide 3", "embedded". For PDF-derived: usually null → no caption (existing behavior).

`sourceName` is **not** shown to the user by default — it's redundant with the document filename in the camera upload list / `DocumentsCard`. Treat it as observability only.

**Acceptance:**
- Existing PDF-page review still renders identically (no `sourceLabel` field → no caption).
- New XLSX scan shows "sheet ..." captions under each extracted image in `PhotosCard` and `detection.tsx`.

### Implementation status — ✅ APPROVED (2026-06-05, reviewer)

**Plan deviation — `detection.tsx` thumbnails get `accessibilityHint` not visible caption.** The detection-screen thumbnails are **64×64 px** — there's no room for a visible "sheet 仁義廠" caption without either overflowing the thumb or shrinking it to unreadable. PhotosCard's hero image gets the visible caption (compact, inline next to the existing "1/5" counter, only renders when `sourceLabel` is set); detection.tsx thumbs surface the same info to screen readers via `accessibilityHint`. Sighted users see the visible caption when they tap into the detail screen; screen-reader users get it everywhere. The plan's intent ("show on per-product image thumbnails") is preserved on the access surface that matters for the screen size.

**Files changed (5):**
- [`src/stores/scanDraftStore.ts`](../src/stores/scanDraftStore.ts) — `Photo` type gains optional `sourceLabel?: string` with explanatory doc-comment (office-doc origin label flows in via the photo-augmentation step at `onSuccess`; camera captures + PDF-derived pages remain undefined).
- [`app/scan/processing.tsx`](../app/scan/processing.tsx) — augmented-photos map now spreads `sourceLabel: docPage?.sourceLabel` alongside `width`/`height`.
- [`app/scan/processing-v2.tsx`](../app/scan/processing-v2.tsx) — same augmentation update at the v2 `onSuccess` path.
- [`src/features/scanner/components/detail/PhotosCard.tsx`](../src/features/scanner/components/detail/PhotosCard.tsx) — `Props.photos` widened to `{ uri; sourceLabel? }[]`; hero overlay now renders `· {sourceLabel}` next to the `1/N` counter when set (inline, same pill, `numberOfLines={1}`, `maxWidth: 180` to prevent layout shifts on long sheet names).
- [`app/scan/detection.tsx`](../app/scan/detection.tsx) — per-thumb `<Pressable>` gains `accessibilityHint={photo.sourceLabel}` (no visible caption due to 64×64 size constraint).

**Verification:**
- `tsc --noEmit` clean.
- `jest` 124/124 still passing.

**Smoke expectations (P6 case 1 + visual):**
- XLSX scan with embedded sheet labels → hero shows `1/5 · sheet 仁義廠` in the dark counter pill on PhotosCard; detection-screen thumbs read the same label to TalkBack/VoiceOver.
- PDF or camera-only scan → hero shows `1/N` only (no trailing `·` because `sourceLabel` is undefined; conditional render keeps the existing UI byte-identical).

---

### P5 — Tests + fixtures

**Files:**
- [`src/services/scanner/__tests__/smartDetectStream.test.ts`](../src/services/scanner/__tests__/smartDetectStream.test.ts) — extend
- New fixture: `src/services/scanner/__tests__/fixtures/smartDetectStream.office-rejected.txt`
- New fixture: `src/services/scanner/__tests__/fixtures/smartDetectStream.xlsx-success.txt`

**Coverage targets:**

1. **Non-fatal error pass-through.** Feed a stream with 1 stage event, 1 non-fatal `error { code: "unsupported_document_format", context.reason: "macro_enabled" }`, then the rest of a normal happy-path stream. Assert: the consumer receives the error event AND the final `result` event.

2. **`preparing_documents` step mapping.** New synthetic frame uses the new phase name; v2 `TIMELINE`/`PHASE_ORDER` and v1 `PHASE_TO_STEP` must both handle it identically to `preparing_pdfs`.

3. **`document_pages[]` parsing.** Frame contains a `result` event whose `document_pages[]` entries carry `sourceName` + `sourceLabel`. Assert the mapped `MappedSmartDetection.documentPages` preserves both fields.

4. **Each of the 4 new error codes round-trips.** One unit test per code (parameterized) — feed `{fatal: false, code: <code>, message: "X", context: {...}}`, assert the consumer receives it intact.

5. **`mapSmartDetection` unchanged-shape regression.** Existing fixture replay still produces the same mapped output (no field-name collisions).

**Acceptance:**
- All existing tests still pass.
- 4-6 new test cases added.
- `npm test` clean.

### Implementation status — ✅ APPROVED (2026-06-05, reviewer)

**Test additions exceeded plan target** — plan called for 4-6 new cases; shipped **8**. All in `smartDetectStream.test.ts` under a new `Phase 2 (office docs)` describe block.

**8 new tests:**
1. Renamed `preparing_documents` stage event forwards untouched (transport doesn't normalize — that's the screen's job per P1).
2-5. **Parameterized (`it.each`) coverage of all 4 new non-fatal error codes** — each round-trips `code` + typed `context` to `onEvent`:
   - `unsupported_document_format` w/ `{ name, reason: "macro_enabled" }`
   - `document_too_large` w/ `{ name, size, limit }`
   - `document_parse_failed` w/ `{ name, reason: "xxe_blocked" }`
   - `document_extraction_timeout` w/ `{ name }`
6. `mapSmartDetection` preserves `sourceName` + `sourceLabel` on `document_pages[]` entries (synthetic XLSX + PPTX payload).
7. `mapSmartDetection` regression — pre-Phase-2 fixture has `sourceName`/`sourceLabel` undefined (no accidental defaulting).
8. End-to-end shape check — one `.docm` rejected mid-batch + the rest of the stream proceeds + result lands.

**Files changed (1):**
- [`src/services/scanner/__tests__/smartDetectStream.test.ts`](../src/services/scanner/__tests__/smartDetectStream.test.ts) — added `describe('smartDetectStream — Phase 2 (office docs)', ...)` block with 8 new cases.

**Verification:**
- Targeted: `jest smartDetectStream.test.ts` → **20/20** (12 original + 8 new), 1.6s.
- Full suite: **124/124** across 10 suites (was 116; delta = +8 from P5), 2.2s.
- `tsc --noEmit` clean.

**Deferred fixture files** — the plan called out two new fixture files (`smartDetectStream.office-rejected.txt` + `smartDetectStream.xlsx-success.txt`). They weren't needed: synthetic in-test emission (`es.emit('error', {...})`) covers the contracts with less ceremony and no fixture-drift risk. Re-add fixture files if a future test wants to assert byte-identical stream parsing.

---

### P6 — Manual smoke + staged rollout

**Pre-flight:** the dev client on the test device is stale per [repo memory](../../memory/project_stale_dev_client_native.md) (`expo-location` missing + `expo-camera` Fabric crash). This integration adds **no new native modules** (uses existing `expo-document-picker`), so a fresh `npx expo run:android` is needed only if the device was already broken — not as a Phase 2 requirement. Confirm with the user before assuming a rebuild is in scope.

**Smoke checklist (dev build, real device, `SMART_DETECT_V2_ENABLED=1`):**

| # | Input | Expected | Notes |
| --- | --- | --- | --- |
| 1 | 1 valid XLSX (~ the 仁義廠 fixture) | Scan completes; products extracted; `document_pages[]` has `sourceLabel: "sheet ..."` | Sanity |
| 2 | 1 valid DOCX with embedded images | Scan completes; embedded images appear in `image_urls[]` | |
| 3 | 1 valid PPTX | Scan completes; per-slide images extracted | |
| 4 | 1 valid CSV (UTF-8) | Scan completes; tabular data fed into AI prompt | |
| 5 | 1 valid CP950 / Big5 CSV | Scan completes; no mojibake in extracted text | Backend `chardet` + `iconv-lite` |
| 6 | 1 `.docm` (macro-enabled) | Non-fatal toast: macro-enabled rejection; scan continues if other files present, else fatal `no_readable_input` | P2 wiring |
| 7 | 1 legacy `.xls` (CFB binary) | Non-fatal toast: legacy/password rejection | P2 wiring |
| 8 | 1 `.xlsb` | Non-fatal toast: binary-format rejection | P2 wiring |
| 9 | 1 30 MB DOCX | Non-fatal toast: too-large with 25 MB limit; OR client-side pre-flight reject (P3) | |
| 10 | Mixed batch: 2 photos + 1 PDF + 1 XLSX | All process; final `image_urls[]` combines all sources; `document_pages[]` has entries from PDF + XLSX | Cross-modal sanity |
| 11 | Cancel mid-stream (back button during `extracting_products`) | `cancelled` event; client tears down stream; no leaked workers | Existing P4 cancellation contract |
| 12 | i18n smoke: device language set to zh, ja, th | Stage messages + error toasts render in the device language | Backend localizes; client renders |

**Rollout gate:**

1. ✅ All smoke cases above pass.
2. ✅ At least one native zh-Hant speaker reviews the four office-doc error messages and the `preparing_documents` stage label (per [`SMART_DETECT_V2_OFFICE_DOCS_PLAN.md`](../../101recycle-greenbidz-backend/docs/SMART_DETECT_V2_OFFICE_DOCS_PLAN.md) §4.5 deferred item).
3. ✅ ja + th proofread queued or accepted as AI-drafted ship-and-iterate.
4. Flip `SMART_DETECT_V2_ENABLED=1` for internal seller cohort (5–10 sellers), watch `scan_doc_rejected` rate by `code` via P2 telemetry.
5. Full rollout when 7-day rejection rate is < expected (no spikes vs PDF baseline).

**Rollout blockers (minimum bar before flag flip):** P0 + P1 + P2 + P5 complete; §7.1 v1/v2 answer confirmed; P6 smoke cases 1–10 + 12 pass on `processing-v2.tsx`.

---

## 5. Acceptance per phase — summary

| Phase | Code clean (tsc/eslint) | Unit tests | Smoke | Native proofread | Rollout blocker? |
| --- | --- | --- | --- | --- | --- |
| P0 | required | n/a | n/a | n/a | yes |
| P1 | required | required | n/a | n/a | **yes** (v2 progress breaks without it) |
| P2 | required | required | smoke 6–8 on **v2 screen** | recommended | **yes** (silent rejections without it) |
| P3 | required | required | smoke 9 | n/a | no |
| P4 | required | recommended | smoke 1 (visual) | n/a | no |
| P5 | required | **expanded suite** | n/a | n/a | yes |
| P6 | required | required | **all 12** | required for zh; recommended ja/th | yes |

---

## 6. Rollback

Every phase is reversible:

- **P0** (types only) → revert the file diffs.
- **P1** (stage mapping) → drop `preparing_documents` from `TIMELINE` / `PHASE_TO_STEP`; `preparing_pdfs` keeps working until the backend drops the alias (in a future release).
- **P2** (error toasts) → comment out the non-fatal sink in `processing-v2.tsx` (+ `processing.tsx` parity); errors fall back to today's silent behavior. No user-visible regression beyond loss of new functionality.
- **P3** (picker UX) → revert helper text + pre-flight check.
- **P4** (thumbnail provenance) → revert `Photo.sourceLabel`, augmentation carry-through, and caption rendering in `PhotosCard` / `detection.tsx`.
- **P5/P6** → flip `SMART_DETECT_V2_ENABLED=0` to fall back to v1; office-doc support is then governed by whatever v1 does (per backend Phase 2 plan, v1 was NOT extended; office docs need v2). If office-doc scans were already in production, flag-off means office docs go back to the pre-Phase-2 behavior (likely a generic 400 / "couldn't read your photos" error — surface a maintenance toast if this matters).

---

## 7. Open questions for product / backend

1. **v1 endpoint — BLOCKER for rollout** — does the legacy `/wp/analyze-smart-detection` endpoint also call `extractOfficeDoc`, or is office-doc support strictly v2-only? If v1 is unextended, flag-off becomes a feature regression for office-doc users. The plan currently assumes **v2-only office docs**; confirm before P6 flag flip.
2. **Backend feature flag** — is there any server-side gate (env var) that disables office-doc support? Per the Phase 2 PROGRESS doc, the answer appears to be no (always-on). Confirm so we can match the client's gating intent.
3. ~~**Per-mime size cap copy**~~ — **Resolved:** use split-cap helper text in P3 (`DOCX/PPTX up to 25 MB, others up to 50 MB`). Client-side pre-flight uses the same per-ext caps.
4. ~~**Telemetry**~~ — **Resolved:** P2 emits `track('scan_doc_rejected', { code, reason })` on each non-fatal rejection. Confirm final event name + property convention with analytics owner before merge.

---

## 8. Out of scope (deliberately deferred)

- **OCR fallback for scanned PDFs** — backend deferred per [`SMART_DETECT_V2_OFFICE_DOCS_PLAN.md`](../../101recycle-greenbidz-backend/docs/SMART_DETECT_V2_OFFICE_DOCS_PLAN.md) §13.3. No mobile work required until backend ships.
- **Legacy `.doc/.xls/.ppt` LibreOffice conversion** — backend deferred per same plan §13.4. Mobile shows the existing CFB rejection toast.
- **Pre-flight validate-upload integration for office docs** — per the user's earlier direction ("client and server side flow I think for keep same just update the endpoint needs update to work well with client"), the mobile client does **not** call `/api/v1/gcs/validate-upload` before upload. Phase 2.5 validate work was primarily for the web client. If we ever add validate to mobile, it's a separate plan.
- **Row-level `sourceLabel`** — backend only emits coarse labels ("sheet X", "slide N"). Per-row provenance would require a separate AI pass; not in Phase 2.
- **In-app document preview** — users can't preview their DOCX/XLSX before upload (only the picker filename + size shows). Out of scope; would need a per-format renderer.

---

## 9. Reference index

### Backend (source of truth)
- Phase 2 plan: [`SMART_DETECT_V2_OFFICE_DOCS_PLAN.md`](../../101recycle-greenbidz-backend/docs/SMART_DETECT_V2_OFFICE_DOCS_PLAN.md)
- Phase 2 progress (what shipped): [`SMART_DETECT_V2_OFFICE_DOCS_PROGRESS.md`](../../101recycle-greenbidz-backend/docs/SMART_DETECT_V2_OFFICE_DOCS_PROGRESS.md)
- SSE base plan: [`SMART_DETECT_V2_SSE_PLAN.md`](../../101recycle-greenbidz-backend/docs/SMART_DETECT_V2_SSE_PLAN.md)
- SSE controller: [`controller/wordPressSmart.js`](../../101recycle-greenbidz-backend/controller/wordPressSmart.js) (`smartDetectProductsV2`)
- i18n strings: [`services/smartDetectI18n.js`](../../101recycle-greenbidz-backend/services/smartDetectI18n.js)
- Office extractor: [`services/officeDocs.js`](../../101recycle-greenbidz-backend/services/officeDocs.js) + [`services/officeDocsWorker.js`](../../101recycle-greenbidz-backend/services/officeDocsWorker.js)
- Multer caps: [`routes/gcsRoute.js:33-35`](../../101recycle-greenbidz-backend/routes/gcsRoute.js), [`routes/wpProductRoutes.js:83-85`](../../101recycle-greenbidz-backend/routes/wpProductRoutes.js)

### Mobile (this codebase)
- Existing SSE integration plan: [`docs/SMART_DETECT_V2_SSE_INTEGRATION_PLAN.md`](SMART_DETECT_V2_SSE_INTEGRATION_PLAN.md)
- Existing GCS upload integration plan: [`docs/GCS_UPLOAD_INTEGRATION_PLAN.md`](GCS_UPLOAD_INTEGRATION_PLAN.md)
- Hook: [`src/features/scanner/useSmartDetect.ts`](../src/features/scanner/useSmartDetect.ts)
- SSE transport: [`src/services/scanner/smartDetectStream.ts`](../src/services/scanner/smartDetectStream.ts)
- Mapper: [`src/features/scanner/mapSmartDetection.ts`](../src/features/scanner/mapSmartDetection.ts)
- Picker: [`app/scan/camera.tsx`](../app/scan/camera.tsx) — `pickFiles()` at lines 278–345, `safeDocumentName()` at lines 60–74
- Progress UI (v2 primary): [`app/scan/processing-v2.tsx`](../app/scan/processing-v2.tsx); fallback: [`app/scan/processing.tsx`](../app/scan/processing.tsx) (redirects to v2 at line 314 when flag on)
- Thumbnail provenance (P4): [`PhotosCard.tsx`](../src/features/scanner/components/detail/PhotosCard.tsx), [`detection.tsx`](../app/scan/detection.tsx)
- Types: [`src/features/scanner/smartDetectionTypes.ts`](../src/features/scanner/smartDetectionTypes.ts), [`src/features/scanner/smartDetectStreamTypes.ts`](../src/features/scanner/smartDetectStreamTypes.ts)
- Flags: [`src/lib/flags.ts`](../src/lib/flags.ts) — `SMART_DETECT_ENABLED`, `SMART_DETECT_V2_ENABLED`; predicate: [`smartDetectV2Enabled.ts`](../src/features/scanner/smartDetectV2Enabled.ts)
- Existing fixture: [`src/services/scanner/__tests__/fixtures/smartDetectStream.zh-hant.txt`](../src/services/scanner/__tests__/fixtures/smartDetectStream.zh-hant.txt)
- Draft store: [`src/stores/scanDraftStore.ts`](../src/stores/scanDraftStore.ts) — `documents` field at line 133; `Photo` type at line 25 (P4 adds optional `sourceLabel`)

### i18n
- Locale files: [`src/i18n/locales/en.json`](../src/i18n/locales/en.json), [`zh.json`](../src/i18n/locales/zh.json), [`ja.json`](../src/i18n/locales/ja.json), [`th.json`](../src/i18n/locales/th.json)
- i18n init: [`src/i18n/index.ts`](../src/i18n/index.ts) (i18next v26 + react-i18next v17, MMKV-backed)

---

## 10. Caveats from repo memory

1. **Stale dev client** — `expo-location` missing + `expo-camera` `CameraView` Fabric crash; scan flow may be unusable on the test device until `npx expo run:android` rebuilds. This is **NOT a Phase 2 blocker** (no new native modules added); but a clean device session is required for P6 smoke. Confirm device state with user before declaring rollout-ready.

2. **AI-drafted i18n (zh/ja/th)** — the four office-doc error message families plus the `preparingDocuments` template are AI-drafted per [`smartDetectI18n.js:16-22`](../../101recycle-greenbidz-backend/services/smartDetectI18n.js). Native-speaker proofread is the only blocker between "code-complete" and "rollout to non-en sellers." zh-Hant is the only language with a likely in-team reviewer.

3. **The `preparing_pdfs` alias is one-release-only** — backend will drop it. The client must support both during the overlap in **`processing-v2.tsx` `TIMELINE`** and **`processing.tsx` `PHASE_TO_STEP`**. Track removal as a follow-up: open an issue tied to the backend release that drops the alias, then this client follow-up removes the deprecated key from both mappers + the `StagePhase` union.

4. **`processing-v2.tsx` is the live screen** — do not test P1/P2 changes only on `processing.tsx`. With `SMART_DETECT_V2_ENABLED=1`, the v1 processing screen never runs the mutation; it only redirects.

---

_End of plan. Status to be updated by claude/reviewer per §1 protocol._
