# 12 — Chat "Upload" → AI-recognition handoff (lab customer app)

**Status:** PLAN ONLY — not built. The transport, GCS upload, `/detect/stream` routing, and
the recognition card layer **already exist and work** on mobile; the single missing wire is
the `listing_entry_options` card's **"Upload photos / documents"** button, which today sends a
plain text message instead of opening a picker + starting a detect turn. This doc specifies
the wiring and calls out the one architecture decision (inline vs dedicated screen).

**Recommendation (see §4):** ship **inline (option a)** — reuse the existing composer
→ GCS → `/detect/stream` → streamed `listing_draft` cards path. The pipeline already exists;
the new code is a picker sheet + an additive callback + a ~10-line handler. A dedicated
recognition screen (option b, mirroring web) is a larger lift for a UX the mobile design
docs deliberately chose **not** to build (in-thread streaming, per
`NewVersion/dynamic/02-action-component-catalog.md §3.1`).

> **Before coding Phase 2, read the "Silent-failure traps" callout in §5.** Two one-line
> mistakes (wrong composer mode, un-awaited picker) each break this flow *silently* — no
> error, just no draft. They are the only two things likely to go wrong.

**Sibling docs:** `dynamic/01-chat-architecture.md` (SSE contract), `dynamic/02-action-component-catalog.md`
(card catalog + the `{onUpload,onManual}` spec at line 147), `dynamic/09-chat-components-report.md`
(the same gap flagged at lines 90/125), `11-marketplace-webview-adaptation.md` (house style).

---

## 1 · Goal & exact user-visible behavior

**What we are adding:** when a signed-in user in the lab chat taps **"Upload photos /
documents"** on the entry-options card, the app should immediately open a native picker
(camera / library / document), and the moment files are chosen it should upload them to GCS
and start an AI-recognition turn — streaming a live `listing_draft` the user can review and
submit — **with zero extra taps**. This is the mobile equivalent of the web's
chat → `/dashboard/new-submission-upload` handoff.

| | Web today | Mobile today | Mobile target |
|---|---|---|---|
| Entry affordance | Chat "Upload" quick-reply calls `openUploadPickerAndGo(navigate)` (`src/shared/lib/uploadHandoff.ts`) | `LabListingEntryOptionsCard` "Upload" button calls `onSend?.("I'd like to upload photos or documents.")` (`cards.tsx:1005`) — a **no-op text bubble** | Entry button opens a native picker sheet |
| After pick | Files stashed in a module var, `navigate('/dashboard/new-submission-upload')` | *(never picks)* | Files staged → GCS upload → detect turn auto-starts |
| Where recognition happens | A dedicated full-screen state machine (`NewSubmissionUploadPage.tsx`) auto-uploads + streams | Inline in the chat thread **when reached via the composer's own camera/paperclip icons** — but NOT reachable from the entry card | Inline in the chat thread (recommended) |
| Auto-start AI | Yes — `handoffAutoStart` effect fires `handleStartProcessing()` (`NewSubmissionUploadPage.tsx ~L1503`) | **No** — staging an attachment never starts a turn; the user must tap Send (`chat.tsx:484`) | Yes — picker `onFinish` calls `labTurn.start()` |

The gap is narrow and specific: **the working pipeline exists but is unreachable from the
card, and picking never auto-starts.** Both `useAttachmentPicker` and `useLabTurn` are
already correct — see §3.

---

## 2 · Web reference — the full event + backend contract

Two web surfaces implement this. The **chat SSE** contract (`useAIChat.ts`) is what mobile
already mirrors; the **dedicated upload page** contract (`NewSubmissionUploadPage.tsx` +
`utils/*`) is the alternative we are choosing *not* to fully port. Both are documented here
because §4's decision rests on the contrast.

Web root = `C:/Users/Pc/Desktop/greenBridge/nextjs-port`.

### 2.1 · Chat SSE event / `data.type` table

The chat speaks a hand-rolled SSE grammar (`event: token|data|done|error` + `data: <json>`,
`\n\n`-separated), parsed by a raw `fetch()`+`ReadableStream` loop in `streamInto()`
(`src/shared/components/ai/useAIChat.ts:939-1229`) — **not** `EventSource` (which can't POST
a body). `/chat/stream` and `/detect/stream` emit the **identical** grammar
(`useAIChat.ts:904-907`, `aiChatShared.tsx:53-56`), so one parser serves both.

| Frame | `data.type` | Payload → target | Web cite |
|---|---|---|---|
| `token` | — | `{delta}` appended to bot text | `useAIChat.ts:979-981` |
| `data` | `listing_draft` | `{draft{fields,image_urls}, missing_required, low_confidence, detection_summary, ready_to_create, market_metrics, price_suggestions}` → `Msg.draft` (**replaces** prior draft) | `useAIChat.ts:1023-1027`; type `aiChatShared.tsx:110-130` |
| `data` | `listing_entry_options` | `{prompt?}` → upload-vs-manual fork | `useAIChat.ts:1037-1040` |
| `data` | `listing_created` | `{product_id,name,url,note}` → `Msg.created` | `useAIChat.ts:1028-1036` |
| `data` | `listing_gate` | `{reason:'login'|'seller_access'}` | `useAIChat.ts:1041-1045` |
| `data` | `listing_group_choice` | `{total,items,first_payload,mode}` (multi-product fork) | `useAIChat.ts:1107-1114` |
| `data` | `listing_queue` | `{total,index,remaining,items[]}` (multi-product pager) | `useAIChat.ts:1115-1145` |
| `data` | `product` / `product_list` | detail / `Card[]` | `useAIChat.ts:986-1002` |
| `data` | `wtb_draft` / `wtb_request` / `wtb_gate` / `wtb_request_list` / `wtb_matches` | buyer WTB cards | `useAIChat.ts:1051-1076` |
| `data` | `handoff` | live-agent escalation (raw `status` remapped) | `useAIChat.ts:1077-1106` |
| `done` | — | `{used_tools[]}` → finalize turn + WTB synth guard | `useAIChat.ts:1163-1191` |
| `error` | — | `{detail?\|message?}` → `err` bubble + retry | `useAIChat.ts:1192-1198` |

**Contract notes that matter for mobile:** `conversation_id` is minted client-side
(`newConvId()`, `aiChatShared.tsx:405`), persisted to `localStorage`, and threaded on every
turn/substep (`useAIChat.ts:920-937`). No heartbeat/comment type is special-cased — an
unrecognized frame is silently dropped. No auto-reconnect; retry is manual
(`useAIChat.ts:1315-1326`).

### 2.2 · Endpoints (chat SSE side — what mobile uses)

| Method | Path | Purpose | Body / headers | Web cite |
|---|---|---|---|---|
| POST | `/ai-chat/chat/stream` | Text-turn agent SSE | `{conversation_id, message, site_type, mode?, image_urls?, document_urls?}` | `useAIChat.ts:918-937` |
| POST | `/ai-chat/detect/stream` | Image/doc listing-detect SSE (flag-gated `detectStreamEnabled()`) | `{conversation_id, site_type, language, image_urls?, document_urls?}` | `useAIChat.ts:917-926` |
| POST | `/ai-chat/detect/load-product` | Jump/advance in multi-product queue (JSON) | resends `conversation_id` | `useAIChat.ts:1345-1394` |
| POST | `/ai-chat/detect/publish-batch` | Publish all "ready" queue items | — | `useAIChat.ts:1400-1432` |
| POST | `/ai-chat/detect/split-products` | Group-choice "separate" → N drafts | — | `useAIChat.ts:1479-1521` |
| POST | `/ai-chat/detect/combine-products` | Group-choice "one product" → single draft | — | `useAIChat.ts:1524-1560` |

### 2.3 · Dedicated-page endpoints (the alternative we are NOT porting)

The web upload page (`src/features/seller/pages/new-submission-upload/`) uses a **different**
recognition transport (`wp/analyze-smart-detection-v2` SSE via `@microsoft/fetch-event-source`)
and its own submit stack. Cataloged for completeness; **not** on the mobile critical path.

| Method | Path | Purpose | Web cite |
|---|---|---|---|
| POST | `${API_BASE_URL}gcs/upload` | Auto-upload staged files to GCS `temp/` (multipart: `sellerId`+`sessionId`+`files[]`); returns `objectName/readUrl/kind` + rejected list | `utils/gcsUpload.ts:153` |
| POST | `${API_BASE_URL}wp/analyze-smart-detection-v2` | v2 SSE recognition over already-uploaded URLs; events `stage/pdf_pages/detection/product/result/error/heartbeat` | `utils/smartDetectStream.ts:107` |
| POST | `${API_BASE_URL}wp/analyze-smart-detection` | v1 blocking fallback (only path that accepts raw `File[]`) | `utils/analyzeSmartDetection.ts:124` |
| POST | `${API_BASE_URL}recognition-jobs` (+ `/:id`, `/:id/stream`) | Background detached job (survives closed tab), flag `NEXT_PUBLIC_BACKGROUND_RECOGNITION` | `utils/smartDetectStreamBackground.ts:40-80` |
| POST | `${API_BASE_URL}gcs/finalize` / `gcs/abort` | Move temp→final after create / cleanup on failure | `utils/gcsUpload.ts:240,261` |
| POST | `getCreateProductUrl(lang)` → batch create → `createBidForBatch` | Submit path | `utils/submitQuickListing.ts` |

**Web headers (Node-direct AI/GCS calls):** `Authorization: Bearer <accessToken>` +
`x-refresh-token` read straight from `localStorage` (raw axios/fetch bypasses the shared
interceptor), plus `x-system-key` (`NEXT_PUBLIC_X_SYSTEM_KEY`) and `x-platform`
(`NEXT_PUBLIC_SITE_TYPE`, default `LabGreenbidz`). Base URL: dev via same-origin
`/proxy-api/` rewrite; prod `NEXT_PUBLIC_PRODUCTION_URL` (default
`https://api.101recycle.greenbidz.com/api/v1/`).

### 2.4 · Web GCS upload mechanics (the "handoff" itself)

1. Chat "Upload" → `openUploadPickerAndGo(navigate)` builds a detached `<input type=file
   multiple accept=UPLOAD_ACCEPT>`, `.click()`s it (must be a user gesture), and on `change`
   with ≥1 file stashes `File[]` into a **module-level variable** (`setPendingUploadFiles`,
   not serialized), toasts "Preparing…", and `navigate('/dashboard/new-submission-upload')`
   (`uploadHandoff.ts`).
2. The page's hand-off-consume effect (`NewSubmissionUploadPage.tsx ~L1510-1536`) calls
   `takePendingUploadFiles()` once, stages the files, sets `handoffAutoStart=true`.
3. A GCS auto-upload effect (`~L698-776`) fires on any files change → `uploadFilesToGcs()`
   POST multipart to `gcs/upload`, records `{objectName, readUrl, kind}` per file.
4. `handoffAutoStart` → `handleStartProcessing()` (`~L1268-1501`): waits (200ms poll, 60s cap)
   for GCS to finish, splits into `image_urls`/`document_urls`, calls the v2 SSE stream,
   maps `stage` events into a 5-step progress UI, resolves to `SmartDetectionResponse`, then
   routes single → `ReviewSubmitScreen` or multi → `DetectionChoiceScreen`.

**Key web trick that mobile does NOT need:** the module-variable file heap survives the nav
only because it's a client-side SPA navigation (no page reload). See §4.

---

## 3 · Current mobile state — what exists and the exact gap

Mobile root = `C:/Users/Pc/Desktop/greenBridge/GreenBridgeApp`.

### 3.1 · Already built and correct (do not rebuild)

| Capability | File | Status |
|---|---|---|
| SSE transport (react-native-sse, named-event listeners, 45s heartbeat watchdog, settle-once) | `src/features/lab/streaming/labStream.ts` | ✅ Complete — mirrors web contract |
| Typed frame catalog (`token/data/stage/done/warning/error/heartbeat`, `phase` not `stage`, `LabCardType` open union) | `src/features/lab/streaming/labStreamTypes.ts` | ✅ Complete |
| Fold-into-turn reducer (`applyFrame`, `LATEST_WINS_CARD_TYPES` dedup, draft-mirroring for `listing_draft` + `wtb_draft`) | `src/features/lab/stores/threadStore.ts` | ✅ Complete |
| Turn orchestration (single-flight AbortController, GCS upload, `/detect/stream` vs `/chat/stream` routing) | `src/features/lab/hooks/useLabTurn.ts:61-154` | ✅ Complete |
| Attachment picker (camera / library / document, permission checks, stages to composer) | `src/features/lab/hooks/useAttachmentPicker.ts` | ✅ Complete — but `pickLibrary` (72-89) has **zero callers** |
| GCS one-shot upload | `src/services/scanner/uploadGcsPhotos.ts` (photos + `uploadGcsDocuments`) | ✅ Complete, reusable |
| Recognition cards (`LabListingDraftCard`, queue/group_choice/batch pager) | `src/features/lab/chat/cards.tsx` | ✅ Complete |
| Composer staged-attachment chips | `src/features/lab/components/AttachmentChips.tsx` | ✅ Complete |
| Build-time flags | `src/lib/flags.ts` (`LAB_CHAT_ENABLED`, `DETECT_STREAM_ENABLED`, `WTB_ENABLED`) | ✅ Present, default OFF |

The routing brain is already web-parity: `useLabTurn.start()` uploads staged attachments to
GCS then picks `/detect/stream` iff `hasAttachments && DETECT_STREAM_ENABLED && mode==='sell'`
(`useLabTurn.ts:87-88,130-154`) — buyer-mode attachments deliberately ride `/chat/stream`
(the comment at `:81-86` documents this was "the bug" when done wrong).

### 3.2 · The exact gap (three disconnected facts)

1. **The entry card can't reach the picker.** `LabListingEntryOptionsCard`
   (`cards.tsx:998-1015`) takes only `onSend`; its "Upload" button fires
   `onSend?.("I'd like to upload photos or documents.")` (`cards.tsx:1005`) — behaviorally
   identical to the manual-entry button apart from the string. `CardProps` (`cards.tsx:63-85`)
   has **no** upload-trigger callback slot at all.
2. **Nothing threads a picker callback down.** `renderCard` (`cards.tsx:1382-1419`) and
   `ChatMessageProps` + its `renderCard` call (`ChatMessage.tsx:144-163, 258-268`) don't pass
   any picker handler through `ctx`; `chat.tsx` owns `picker = useAttachmentPicker()`
   (`chat.tsx:140`) but wires it only to the composer's own camera/paperclip icons
   (`chat.tsx:465-470`), never to `ChatMessage`/`LiveBotBubble`.
3. **Picking never auto-starts a turn.** `send()` (`chat.tsx:194-228`) is the only thing that
   calls `useLabTurn.start()`; staging an attachment via `composerStore.addAttachment` has no
   auto-send side effect (`composerStore.ts:39`). So even a correctly-wired card would leave
   the user staring at chips until they manually tap Send.

Also: `pickLibrary` (`useAttachmentPicker.ts:72-89`) is fully implemented but never called —
mobile offers Camera + Document only, no gallery multi-select — and **no dedicated recognition
screen exists** anywhere in `app/(lab)/`.

### 3.3 · Seller-scan reuse inventory (`app/scan/*`)

A mature seller scan pipeline exists. If §4 chose the dedicated-screen route, these are the
lift-and-shift candidates. Verdicts from the code review:

| Asset | File | Verdict |
|---|---|---|
| Camera capture UI | `app/scan/camera.tsx` | 🟡 Lab-usable — pure capture, but hard-navigates to seller `scanProcessing`; needs a lab route param. **CameraView crashes on stale dev-client (Fabric addViewAt) — rebuild first.** |
| v2 streaming "AI in progress" UI | `app/scan/processing-v2.tsx` | 🟢 Best reuse candidate — consumes `useSmartDetect`/`SmartStreamEvent` purely; only `onSuccess` nav is seller-shaped |
| v1 fallback processing shell | `app/scan/processing.tsx` | 🟡 Loading shell reusable; nav targets are seller routes |
| Regroup / identify-unknown wizard | `app/scan/detection.tsx` | 🟡 Step1 (reassign photos across groups) reusable; Step2 "single vs grouped listing" is seller framing |
| Recognition mutation hook | `src/features/scanner/useSmartDetect.ts` | 🟢 Lab-usable as-is — only coupling is reading `useAuth.getState().profile?.id` for the GCS path |
| SSE transport | `src/services/scanner/smartDetectStream.ts` | 🟢 Lab-usable as-is |
| GCS upload | `src/services/scanner/uploadGcsPhotos.ts` | 🟢 Lab-usable as-is (needs a user id for scoping) |
| Pure mappers | `mapSmartDetection.ts`/`normalize.ts`/`smartDetectionRouting.ts` | 🟢 Lab-usable as pure functions |
| Regroup sheets | `IdentifyUnknownSheet.tsx`/`MoveToGroupSheet.tsx`/`DetectionGroupCard.tsx` | 🟢 Lab-usable as-is |
| Review hub / per-item editor | `grouped-review.tsx`/`grouped-edit.tsx`/`detail.tsx` | 🔴 Seller-coupled — listing form fields (marketplace/category/pricing/location), required-status predicate |
| Draft store | `src/stores/scanDraftStore.ts` | 🔴 Seller-coupled — `DraftItem` has marketplace/visibility/networkSellers/categoryId; only `current.photos`/`pendingDetection`/`setPendingDetection`/`updatePhotos` are the reusable subset |
| Required-status predicate | `src/features/scanner/requiredStatus.ts` | 🔴 Seller-coupled (listing-required fields) |
| Submit stack | `useSubmitGroupedListing.ts`/`createProduct.ts`/`submitGroupedListings.ts` | 🔴 Seller-coupled — hits seller listing-create endpoints; a lab flow submits via the chat `CONFIRM CREATE` turn instead |

**Takeaway:** the recognition/streaming layer is generic and reusable; everything downstream
of the review is seller-listing-shaped. This is a second reason to prefer the inline path
(§4) — the chat already owns the review+submit surface (`listing_draft` card + `CONFIRM
CREATE` turn), so we don't touch the seller submit stack at all.

---

## 4 · Target design for mobile

### Option (a) — inline: reuse the composer → `/detect/stream` path  ✅ RECOMMENDED

Wire the entry card's "Upload" button to open a picker; on pick, stage the files (existing
`composerStore`) and **immediately** call `labTurn.start('')`. The turn uploads to GCS and
routes to `/detect/stream` (sell mode) exactly as the composer icons already do
(`useLabTurn.ts:87-154`); the `listing_draft`/`listing_queue` frames stream inline as cards.
No new screen, no new transport, no seller-submit code.

**Why this is the right v1 call:**
- Mostly built. The transport, GCS upload, detect routing, and cards all exist; the genuinely
  new code is small and bounded — a picker action sheet (`UploadSourceSheet`, net-new UI), an
  additive `onUploadPress` callback threaded through the card layer, and a ~10-line
  `handleUploadPress`. No new transport, no new backend, no seller-submit code.
- The mobile design docs explicitly chose in-thread streaming over a dedicated screen
  (`dynamic/02-action-component-catalog.md §3.1`); a separate screen would fight that.
- The review + submit surface already lives in the thread (`LabListingDraftCard` +
  `CONFIRM CREATE`), so we avoid the seller-coupled scan submit stack (§3.3).
- Single code path = one thing to test and keep parity with the backend contract.

### Option (b) — dedicated recognition screen mirroring web

Build a new `app/(lab)/recognition.tsx` target, reuse `processing-v2.tsx` streaming UI +
`useSmartDetect`, then a lab-specific review screen. **Not recommended for v1:** it duplicates
the review/submit surface the chat already has, drags in (or forces new lab equivalents of)
the seller-coupled review/submit/required-status layer (§3.3), and contradicts the in-thread
design decision. Revisit only if product wants a distinct full-screen "scan" feel separate
from chat.

### The mobile difference vs web (important)

Web needs the **module-variable file heap + SPA nav trick** (`uploadHandoff.ts`) because it
crosses a client route into a fresh page component. **Mobile does not need this** — expo-router
navigation keeps JS objects in memory, and in the inline design we don't even navigate: the
files sit in `composerStore` (already the source of truth for the composer) and the turn
starts on the same screen. So the entire `uploadHandoff.ts` mechanism has **no mobile
equivalent to port** — it's replaced by "stage in composerStore + call start()".

**Real constraints that do apply on mobile (call these out, don't hand-wave):**
- **User gesture / permissions:** camera + library need runtime permission grants
  (`useAttachmentPicker` already handles this); a denied permission must fall back gracefully,
  not dead-end.
- **Auth required for GCS:** `useLabTurn.start()` throws `'Sign in required to analyze
  attachments'` if `useAuth.getState().profile?.id` is null (`useLabTurn.ts:100-101`). The
  entry card path must ensure the user is signed in (or surface that error as a friendly card).
- **Sell mode only for detect — MUST force it, not assume it.** `/detect/stream` routing
  requires `mode==='sell'`, and `useLabTurn.start()` reads the composer mode **live at tap
  time** (`useLabTurn.ts:64,88`), NOT the card's render-time mode. So it is *not enough* that
  the card was emitted in sell context — if the composer mode is `buy` when the user taps
  Upload (e.g. a later toggle), `useDetect` is false and the files silently ride
  `/chat/stream` → **no listing draft, no error**. `handleUploadPress` MUST call
  `useComposer.getState().setMode('sell')` before starting the turn (treat "Upload for a
  listing" as an explicit sell intent). See §5 step 5 and the silent-failure callout.
- **No auto-reconnect:** `pollingInterval:0` disables react-native-sse reconnect
  (`labStream.ts`); a mid-stream network blip fails the turn and the user re-taps. Same as web.
- **Cancel:** a new turn aborts the previous (single-flight, `useLabTurn.ts:74`); leaving the
  screen should abort the in-flight detect.

---

## 5 · File-by-file build plan (phased)

### Phase 1 — Primitives (picker action sheet + auto-start helper)
1. **Add** `src/features/lab/components/UploadSourceSheet.tsx` — a bottom action sheet with
   **Take photo** / **Choose from library** / **Attach document**, mapping to
   `picker.pickCamera()` / `picker.pickLibrary()` / `picker.pickDocument()`. This finally
   gives `pickLibrary` (`useAttachmentPicker.ts:72-89`) a caller.
2. **Edit** `src/features/lab/hooks/useAttachmentPicker.ts` — add an optional `onPicked`
   callback fired after a successful stage (or return the staged result) so the caller can
   auto-start a turn. (Today it only stages via `composerStore.addAttachment` with no
   completion signal.)

### Phase 2 — Wire the entry card to the picker + auto-start
3. **Edit** `src/features/lab/chat/cards.tsx`
   - `CardProps` (`63-85`): add `onUploadPress?: () => void` (additive, optional — same
     pattern as the existing `onEditDraft`/`onJumpProduct` additive callbacks).
   - `LabListingEntryOptionsCard` (`998-1015`): "Upload" button → `onUploadPress?.()` instead
     of `onSend?.(...)`. Keep the manual button on `onSend`.
   - `renderCard` (`1382-1419`): thread `onUploadPress` from `ctx` into the entry card.
4. **Edit** `src/features/lab/chat/ChatMessage.tsx` — add `onUploadPress?` to
   `ChatMessageProps` (`144-163`) and pass it into the `renderCard` ctx (`258-268`).
5. **Edit** `app/(lab)/chat.tsx`
   - Build `handleUploadPress` from the existing `picker` (`chat.tsx:140`): open
     `UploadSourceSheet`; on the chosen source, **`await` the picker, then** call `send('')`
     (attachments-only send is already allowed, `chat.tsx:200-201`) so the detect turn
     auto-starts. Two safeguards are mandatory (both fail SILENTLY if omitted — see the
     callout below):

     ```ts
     // in chat.tsx — the ONLY correct shape
     const handleUploadPress = () => openUploadSourceSheet({
       onPick: async (source: 'camera' | 'library' | 'document') => {
         // 1) Upload = a listing intent. Force sell mode BEFORE start(), because
         //    useLabTurn reads composer mode live (useLabTurn.ts:64,88). Without this,
         //    a buy-mode composer silently routes to /chat/stream (no draft).
         useComposer.getState().setMode('sell');
         // 2) AWAIT the pick before send(''). Fire-and-forget calls send() against an
         //    empty attachments store → early-return → orphan chips, no turn.
         if (source === 'camera')   await picker.pickCamera();
         if (source === 'library')  await picker.pickLibrary();
         if (source === 'document') await picker.pickDocument();
         send(''); // no-op if the user cancelled (nothing staged) — safe
       },
     });
     ```
   - Pass `onUploadPress={handleUploadPress}` into `ChatMessage` (`407-417`) and the
     `LiveBotBubble` renderCard ctx (`420-428, 514-550`).

At the end of Phase 2 the recommended (inline) flow works end-to-end. Phases 3–4 are optional
hardening / the alternative screen.

### ⚠️ Silent-failure traps (read before coding Phase 2)

Both of these produce **no error, no crash — just no listing draft**, which makes them
expensive to debug. They are the two ways this plan breaks if built naïvely:

| Trap | Wrong code | Symptom | Fix |
|---|---|---|---|
| **Mode race** | rely on the composer already being in sell mode | Upload in buy mode → files POST to `/chat/stream` → buyer image tools reply, no `listing_draft` card ever streams | `setMode('sell')` at the top of `onPick`, before `send('')` (`useLabTurn.ts:88` reads mode live) |
| **Await ordering** | `onPress={() => { picker.pickLibrary(); send(''); }}` | `send('')` runs first against an empty store → `chat.tsx:201` early-returns; files stage *after* as orphan chips; nothing happens until the user manually taps Send | `await picker.pickX(); send('')` inside an `async` handler |

Cancel path is safe *only because* of the await: a cancelled picker stages nothing, so the
following `send('')` early-returns harmlessly (`chat.tsx:201`).

### Phase 3 — (OPTIONAL) dedicated recognition screen — only if §8 decision picks option (b)
6. **Add** `app/(lab)/recognition.tsx` reusing `processing-v2.tsx`'s streaming UI +
   `useSmartDetect`; swap `onSuccess` nav for an in-app lab review.
7. **Add** a lab review screen + lab-specific required-status predicate (do **not** reuse the
   seller `requiredStatus.ts`/`grouped-review.tsx`).
   *Skip this phase entirely under the recommended option (a).*

### Phase 4 — Multi-product parity
8. Confirm the existing multi-product cards (`listing_queue`/`listing_group_choice` pager in
   `cards.tsx`, behind `DETECT_STREAM_ENABLED`) render correctly when reached via the entry
   card — they already handle the frames; this is a **verification** step, not new code,
   under option (a). The `detect/load-product`/`publish-batch`/`split`/`combine` substeps
   (web §2.2) must be confirmed wired on mobile (**pre-build confirmation** — the findings
   only verified `/detect/stream` itself on mobile, not these substep endpoints).

---

## 6 · Flags / backend / header prerequisites

| Prereq | Where | Requirement |
|---|---|---|
| `EXPO_PUBLIC_LAB_CHAT_ENABLED` | `src/lib/flags.ts` (`LAB_CHAT_ENABLED`) | ON for the lab chat to run at all |
| `EXPO_PUBLIC_DETECT_STREAM_ENABLED` | `src/lib/flags.ts` (`DETECT_STREAM_ENABLED`) | ON to route attachments to `/detect/stream`; **client flag must be ⊆ backend flag** |
| Backend detect flag | Python assistant `detect/stream` gate | Must be enabled server-side (web gate is `detectStreamEnabled()`) — confirm the lab build target's backend has it on |
| `EXPO_PUBLIC_USER_TYPE=customer` | lab app fork | Already set for the lab app |
| Auth (Bearer + `x-refresh-token`) | `src/api/interceptors.ts` | Injected by the shared axios interceptor; GCS upload needs `profile.id` (`useLabTurn.ts:100`) |
| `x-system-key` + `x-platform` | `src/api/greenbidzClient.ts` | Must match web's `NEXT_PUBLIC_X_SYSTEM_KEY` / `SITE_TYPE=LabGreenbidz` parity |

**Confirmations required before building (marked unknown by the findings):**
- **C1 — Composer mode when the entry card shows.** *(Downgraded from a blocker to a
  belt-and-suspenders check — §5 step 5 now forces `setMode('sell')` in `handleUploadPress`,
  so this no longer gates correctness.)* Still worth confirming the `listing_entry_options`
  card is only emitted in a sell context, so the forced mode-flip never surprises a user who
  was mid buy-conversation. The coded safeguard (`useLabTurn.ts:88` reads mode live) is the
  real fix; this confirmation is defense-in-depth.
- **C2 — detect substep endpoints on mobile.** Web has `detect/load-product`,
  `publish-batch`, `split-products`, `combine-products` (§2.2). The mobile findings verified
  only `/detect/stream`; confirm the multi-product substeps are wired (they back the
  `listing_queue`/`group_choice` card actions) before promising full multi-product parity.
- **C3 — `event: draft` frame.** `labStreamTypes.ts` notes `/detect/stream` *may* also emit a
  cumulative top-level `draft` frame separate from `data{type:'listing_draft'}`, but
  `LAB_STREAM_EVENT_NAMES` does not subscribe to a `draft` event — if the backend emits it,
  mobile silently drops it. Confirm `data{type:'listing_draft'}` is the sole canonical draft
  source on the live lab backend.
- **C4 — Backend detect flag state** for the lab build target (see table).

---

## 7 · Verification plan

**Pre-req (blocking):** the attachment path can hit the camera, and **`expo-camera`'s
`CameraView` crashes under Fabric (`addViewAt`) on a stale/un-rebuilt dev-client** (per
project memory + `app/scan/camera.tsx` caveat). Any camera path is unusable until
`npx expo run:android` rebuilds the native dev-client on the target device. `expo-location`
was also missing on the stale client — fold both into the same rebuild. Run Metro with
`CI=1` (the watcher crashes Metro otherwise) and restart Metro per edit.

**Emulator (fast loop, library/document only — avoids the camera crash):**
1. `CI=1 npx expo start --clear`; open the lab chat in sell mode.
2. Trigger the `listing_entry_options` card (the AI's create-listing fork).
3. Tap **Upload photos / documents** → the `UploadSourceSheet` opens.
4. Pick **Choose from library** (multi-select) → files stage → turn auto-starts (no manual
   Send) → GCS upload → `stage`/`listing_draft` frames stream into the thread.
5. Confirm the draft card renders; edit + `CONFIRM CREATE` produces a `listing_created` card.
6. Multi-image: verify `listing_group_choice`/`listing_queue` pager (Phase 4 / C2).
7. Buyer mode sanity: confirm a buyer-mode attachment still routes to `/chat/stream` (no
   seller listing draft) — regression guard for the routing bug (`useLabTurn.ts:81-86`).

**On-device (after `npx expo run:android` rebuild — required for camera):**
8. Repeat 3–5 using **Take photo** → confirm `CameraView` no longer crashes and capture →
   detect works.
9. Cancel mid-stream (navigate away) → confirm the turn aborts (single-flight).
10. Signed-out / no `profile.id` → confirm the friendly "Sign in required" path, not a crash
    (`useLabTurn.ts:100-101`).
11. Permission-denied (camera/library) → confirm graceful fallback, no dead-end.

**Do not** submit test listings against a prod backend without capturing + deleting the
created product id afterward (per project memory: local Node + GCS write to the prod DB).

---

## 8 · Open decisions

1. **Inline vs dedicated screen** — recommend **(a) inline** (§4). Confirm before Phase 1;
   Phase 3 is only built under (b).
2. **Picker sources** — ship all three (Camera / Library / Document) via `UploadSourceSheet`,
   or match the web's single file-chooser more literally? Recommend all three (mobile-native
   expectation; also finally uses the dead `pickLibrary`).
3. **Entry-card copy** — keep "Upload photos / documents" or split into distinct affordances?
   Recommend keeping one CTA that fans out via the sheet.
4. **C1–C4 confirmations** (§6) — who verifies the composer mode, detect substep endpoints,
   the `event: draft` question, and the backend flag state? These gate Phases 2/4.
5. **Multi-product scope for v1** — ship single-product inline first (Phases 1–2) and defer
   multi-product pager parity (Phase 4) if C2 is unresolved, or block v1 on full parity?
6. **Auto-start UX** — auto-start the turn the instant files are picked (web parity), or stage
   chips + require an explicit confirm tap? Recommend auto-start to match the web's
   zero-extra-click handoff; the single-flight abort makes a mistaken pick recoverable.
