# AI-Scan Flow — What Web Has That Mobile Is Missing

> Two features exist on the **101lab web** seller AI-scan flow that the **mobile app does not have**:
> **(1) Continue in background** and **(2) Save as draft (+ a drafts list to resume from)**.
> This doc records exactly what each does on web and what mobile has (or lacks) today, so we can plan the port.

**Web source:** `nextjs-port/src/features/seller/pages/new-submission-upload/*`
**Mobile target:** `GreenBridgeApp/app/scan/*` + `src/features/scanner/*` (seller) and `app/(lab)/*` (customer lab)

**Key point:** both backends already exist on prod — the gap is almost entirely **mobile client** work.
- `POST /api/v1/recognition-jobs` (+ `/:id`, `/:id/stream`) — background recognition, live on greenbidz-backend.
- `/api/v1/drafts` (create/list/get/update/publish) — drafts, live on greenbidz-backend.

---

## Feature 1 — "Continue in background"

### What the web does
During AI processing the seller can leave the screen; the recognition job keeps running server-side, and the finished draft is waiting when they return.

- **Panel:** `ContinueInBackgroundPanel.tsx` — shown only in the `processing` step, gated by `BACKGROUND_RECOGNITION_ENABLED` (`NEXT_PUBLIC_BACKGROUND_RECOGNITION`, default off). First-time sellers see a reassurance card; repeat sellers a compact one-liner.
- **On click** (`handleContinueInBackground`): best-effort push subscribe → toast "we'll notify you" → navigate to `/dashboard`. The stored job id is deliberately **kept**.
- **Transport:** `smartDetectStreamBackground.ts`
  - `createRecognitionJob` → `POST recognition-jobs` `{ image_urls, document_urls, language, platform }` → `{ job_id }` (fast 202); persists id to `localStorage["recognition_job_id"]`.
  - `getRecognitionJobStatus` → `GET recognition-jobs/:id` → `queued | running | draft_ready | failed`.
  - `tailRecognitionJob` → `GET recognition-jobs/:id/stream?after_seq=N` (SSE, `openWhenHidden`), resolves on `result` (byte-identical to the sync stream).
- **Reattach-on-return effect:** on page mount, reads the job id (from `?jobId=` or storage) and:
  - `draft_ready` → clears id, routes to the draft (`?resumeDraftId=`).
  - `running/queued` → re-enters `processing`, re-tails the stream, then drops into review.
  - `failed` → surfaces a "Try again" panel.
- **Completion surfacing:** OneSignal push `recognition_draft_ready` → in-app toast with a "Review" deep link (suppressed only on the upload page itself, where the result appears inline).

### What mobile has → **ABSENT (both seller and lab flows)**
- **Seller** `app/scan/processing.tsx`: the AI request runs under an `AbortController` that is **aborted on unmount** (`:494-497`). Leaving the screen **cancels** the job. No job id, no reattach, no "working" chip.
- **Lab** `app/(lab)/processing.tsx`: stream is **aborted on unmount** (`:205-208`) and hardware-back **aborts + goes Home** (`:241-250`). Turn state is in-memory (`threadStore`), so a running turn can't be re-attached.
- Zero references to `recognition-jobs` / `smartDetectStreamBackground` / `BACKGROUND_RECOGNITION` in mobile source. The mobile design docs explicitly mark the background recognition-job transport as **"the alternative we are NOT porting"** (`NewVersion/12-…-handoff.md` §2.3) and codify the abort-on-leave behavior (`Docs/WEB_FLOW_PARITY_PLAN.md:515`).

### Gap to close (mobile)
Port `smartDetectStreamBackground` (adapted to RN fetch + Bearer + MMKV for the stored job id), add a "Continue in background" affordance on the processing screen, add a reattach effect on return, and drive completion via the already-wired OneSignal push. Flag-gate it (`EXPO_PUBLIC_BACKGROUND_RECOGNITION`).

---

## Feature 2 — "Save as draft" + a drafts list to resume from

### What the web does
The seller can save an in-progress / AI-detected listing as a draft and come back to it later from a "My Drafts" surface.

- **Buttons:** `ReviewSubmitScreen.tsx` (single) and `MultiProductReviewScreen.tsx` (multi) render a "Save as Draft" button. No feature flag — drafts are always on.
- **Handlers** (`NewSubmissionUploadPage.tsx`):
  - `handleSaveDraft` → builds `{ session_uuid, flow:"ai", mode, title, product_count:1, thumbnail_object, payload }` (payload = form + `imagesOrdered` GCS refs + whitelisted `sellerInfo`); toasts "Draft saved".
  - `handleSaveDraftMulti` → one grouped draft (`mode:"multi"`, `payload.productDrafts[]`).
  - `saveOrUpdateDraft` → `createDraft` (new) or `updateDraft` (in-place PUT, optimistic-concurrency via `expected_updated_at`).
- **Transport:** `draftApiSlice.ts` → `POST/GET/PUT /api/drafts`, `PATCH /api/drafts/:id/published` (Next route handlers forward to Node `/api/v1/drafts/**` with `x-drafts-key`).
- **Drafts list:** `DraftsPage.tsx` ("My Drafts") → `useListDraftsQuery` → `DraftCard` grid (🤖 AI / ✏️ Manual badge, product count, status pill, Continue/Share/View/Delete). "Continue" → `?resumeDraftId=<id>`.
- **Resume:** `useDraftResume.ts` reads three payload shapes — `pending-ai` (raw background result), multi, single — rebuilds previews from `imagesOrdered` (no re-upload), and routes back into detection/review.

### What mobile has → **ABSENT as a user feature; seller has PARTIAL, unused plumbing**
- **Seller:**
  - **No "Save as draft" button** — the detail footer (`DetailFooter.tsx`) only offers Preview + Submit (single) or Review group / Add another (grouped). Submit goes straight to product creation.
  - **No drafts list / Drafts tab** — seller tabs are `index, scan, history, profile, inbox`; `history` is submitted listings, not drafts.
  - **Persistence infra EXISTS but is dead code:** `src/stores/scanDraftStore.ts` auto-persists the current session to MMKV, and `src/lib/scanResume.ts` (`getScanResumeRoute`, tested) can route a resume — but **every entry point calls `reset()` on focus** (`app/(tabs)/scan.tsx:14-24`, `app/(tabs)/index.tsx:83`) with the comment *"the dedicated drafts surface (planned) will be the only way to resume."* `getScanResumeRoute` is imported by no screen.
- **Lab:**
  - **No "Save as draft" and no drafts list** — `app/(lab)/draft.tsx` is a single review screen; "Edit details" is a coming-soon stub (`:276-279`). No Drafts tab.
  - **In-memory only** — `composerStore` / `conversationStore` / `threadStore` are not persisted (`conversationStore.ts:5-10` defers resume to "Phase-2"). Only an opaque `conversationId` is persisted (MMKV).
  - A **server-side** working draft exists (`listingDraftApi.ts` `GET/PUT /listing-draft`, one per conversation) but it's used only for in-chat field editing — no save action, no list UI.

### Gap to close (mobile)
Add `draftApiSlice` (RN adaptation), a "Save as draft" action on the review/detail screen, and a **Drafts surface** that consumes the already-persisted `scanDraftStore` + `getScanResumeRoute` (seller) — flip the entry points to resume-aware instead of unconditional `reset()`. The `useDraftResume` `pending-ai` branch is what ties Feature 1's finished background job into this list.

---

## Summary

| Capability | Web (101lab) | Mobile seller `(tabs)/scan` | Mobile lab `(lab)` |
|---|---|---|---|
| Photo → AI draft | ✅ | ✅ | ✅ |
| Processing can be left running | ✅ background job + reattach | ❌ aborts on unmount | ❌ aborts on unmount/back |
| **Continue in background** | ✅ (flag) | ❌ **ABSENT** | ❌ **ABSENT** |
| **Save as draft** button | ✅ (single + multi) | ❌ **ABSENT** | ❌ **ABSENT** (edit = stub) |
| **Drafts list / resume** | ✅ "My Drafts" + `useDraftResume` | ⚠️ infra exists but **unused** (reset on every scan) | ❌ in-memory, no resume |
| Backend available on prod | ✅ | ✅ (same backend) | ✅ (same backend) |

**Bottom line:** neither "Continue in background" nor "Save as draft / drafts list" exists in mobile. The **seller** flow is the closest to closing — it already ships a persisted, resumable single-draft store and a tested resume-router; it just needs a drafts surface + a save button + flipping the `reset()`-on-entry behavior, plus the background recognition-job client. The **lab** flow would need turn/job persistence and a reattach path built from scratch. Both backends are already live on prod.
