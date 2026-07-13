# 01 — Chat System Architecture (As-Built)

**Status:** Reference / authoritative
**Audience:** Mobile engineers wiring the GreenBridge customer app's dynamic data layer
**Scope:** How buyer/seller AI chat works **today** end-to-end across the web frontend, the Node backend, and the Python assistant — session start + mode resolution, the message send flow, the SSE streaming protocol (event types + payloads), the tool/agent loop, Redis memory, auth/headers, and how Want-To-Buy (WTB) and human handoff plug in.

This is the contract the mobile client **mirrors**. Everything here is grounded in the real code. Where the mobile app should reuse an existing pattern, the actual file is named.

**Sibling docs (this folder):** `00-foundation.md` (tokens/stack), `01-home-tell-ai.md` (composer), `02-processing.md`, `03-draft-review.md`, `04-published.md`, `05-matches-feed.md`, `06-match-detail.md`, `07-deal-room.md`, `08-bottom-nav.md`. Mobile mechanical swap points (static demo → real API) are inventoried in the Phase-2 discovery; see `../08-bottom-nav.md` and the screen docs for per-screen hook points.

---

## 0. The One-Paragraph Model

A chat "surface" holds a single **conversation** identified by an opaque `conversation_id`. Each user turn is a POST to the Python assistant that streams back **Server-Sent Events (SSE)**: prose arrives as `token` deltas (typing effect), structured UI comes as `data` frames each carrying a typed **card envelope** (`{ type, data }`), and the turn ends with a terminal `done` (or `error`). Two endpoints exist: `/chat/stream` (the agent — reasoning + tools) and `/detect/stream` (image/document smart-detect — live draft building). **Mode** (buyer vs seller) is resolved per turn and shapes which tools the agent may call. Auth is JWT-in-headers; identity (user_id/role) is decoded server-side from the token — **never** sent in the body. Redis holds prose history + listing drafts, keyed by identity + site + conversation, and fails open.

```
[client turn]
   │  POST /chat/stream  (or /detect/stream if files attached + flag on)
   ▼
[Python assistant]  resolve mode → load Redis history → run agent loop
   │  SSE frames: token* → data* → (warning?) → done | error
   ▼
[client renderer]  append prose deltas; on `data`, render a card by `type`
```

---

## 1. Session Lifecycle & Mode Resolution

### 1.1 Conversation identity

- One conversation = one opaque `conversation_id` (max 128 chars). The client owns it; the platform partitions all history/draft state by it.
- **Web today:** one conversation per browser, persisted in `localStorage` under `gb_ai_conv_id` (`useAIChat.ts:369`, key `CONV_KEY`), with messages under `gb_ai_msgs_<id>` (`getMsgsKey`). The dashboard drawer and the home page share the same thread via this key (`useAIChat.ts:94-96, 154-159`).
- **Hand-off:** a forced `conversationId` (e.g. `?c=<id>&q=<msg>` from a landing page → `AIChatPage.tsx:19,37-40` → `HomeAIChat.tsx:82`) starts fresh under that id.

**Mobile mapping.** Mint/persist the id in MMKV (reuse the store pattern in `src/stores/authStore.ts`; a new `src/features/lab/stores/` store is the natural home). One conversation per install is fine for v1. The Deal Room (`app/(lab)/deal/[id].tsx`) is a **separate** 1:1 thread concept and is NOT this AI conversation — see §9.

### 1.2 Mode plumbing

`mode` is `"buyer" | "seller" | undefined` and is injected per turn, not baked into the conversation.

| Source of `mode` | Web today | Mobile today |
|---|---|---|
| Explicit prop from host surface | Dashboard layouts inject `mode="seller"` / `"buyer"` into `AIAssistantWidget` (`useAIChat.ts:142-145`, read from a ref so it's never stale) | The Lab composer store `mode: 'sell' \| 'buy'` (`src/features/lab/stores/composerStore.ts:18-25`) — note **sell/buy**, must map to **seller/buyer** |
| Injected into request body | `...(modeRef.current ? { mode } : {})` (`useAIChat.ts:347-348`) | Send `mode` on every `/chat/stream` body |
| Neutral (home/public) | no `mode` passed → agent decides | Lab home with no explicit intent |

**Server-side resolution** (`app/api/chat.py:149-166`), a strict precedence:

```
if request.mode set      → use it verbatim
elif identity.role set    → use JWT role ("seller" | "buyer")
else                      → None  (base prompt only, both tool sets exposed)
```

**Why mode matters — tool gating** (`assistant.py:874-897`). The **only** tools actually removed by mode are the two ambiguous bid tools; everything else is in `ALL_TOOLS` (`app/tools/registry.py`) and stays registered in every variant — mode is expressed as a **prompt addendum** that *steers* which tools the model chooses (e.g. buyer mode's prompt instructs "call `search_from_image`"), not by adding/removing those tools:

| Mode | Prompt steers toward | Tool actually hidden |
|---|---|---|
| SELLER | listing builder (`present_listing_options`, `detect_listing_from_images`, `get_listing_draft`, `update_listing_draft`, `create_listing`), `get_bids_on_my_listings`, `get_seller_summary` | `get_my_bids` (a seller's "my bids" = received bids) |
| BUYER | `search_from_image` (visual search), WTB tools (`draft_want_to_buy`, `create_want_to_buy`, `list_my_wants`, `get_want_matches`) | `get_bids_on_my_listings` (buyer has no listings) |
| none | both bid tools available | — |

> The listing-builder + WTB tools are gated at *registration* time by config flags (`auth_enabled`, `node_base_url`, `wtb_enabled` in `registry.py`), not by per-turn mode. `search_from_image` is always registered and **unauthenticated** — it is exposed in every mode, and only the BUYER prompt actively routes photo turns to it.

> **Mobile UX note.** The Lab home uses a Sell/Buy segmented toggle (`01-home-tell-ai.md`). Translate `sell→seller`, `buy→buyer` at the API boundary. Because the assistant re-reads `mode` per turn, the toggle can change mid-conversation without resetting the thread.

---

## 2. The Message Send Flow

This is the exact sequence the mobile client must reproduce. Web reference: `useAIChat.ts` `send()` (`564-622`) → `streamInto()` (`300-562`).

### Phase 0 — Compose
User types text and optionally stages up to **10** attachments (`MAX_DRAFT_ATTACHMENTS`). Images: JPG/PNG/WEBP. Documents: PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX. Validated client-side by MIME + extension (`useAIChat.ts:201-234`).

### Phase 1 — Upload attachments to GCS (only if files staged)
`POST {NODE_BASE}/api/v1/gcs/upload` (multipart). Returns HTTPS URLs split into `{ image_urls, document_urls }`.

| Field | Value |
|---|---|
| Endpoint | `POST /api/v1/gcs/upload` (`routes/gcsRoute.js:52`) |
| Auth | **`x-system-key: <SYSTEM_KEY>`** (system-key gated, NOT bearer) + web also sends bearer/refresh |
| Body | `images: File[]` (≤10), `sellerId`, `sessionType` (site type lowercase), `validate=false` |
| Response | `{ success, data: { files: [{ url }] } }` → mapped to `image_urls` / `document_urls` |

Web helper: `uploadListingImages.ts:116-160`. On failure: keep staged files, toast, allow retry.

> **Mobile reuse.** The seller app already uploads to `/gcs/upload` before smart-detect — reuse `src/services/scanner/uploadGcsPhotos.ts` and `src/services/scanner/gcsUrl.ts` verbatim. Seller id comes from `useAuth.getState().profile?.id` (`src/stores/authStore.ts`). The `x-system-key` header is wired via `src/api/greenbidzClient.ts` (baseURL + `x-platform` + `x-system-key`).

### Phase 2 — Optimistic append
Append the user message (with an attachment list — images carry their HTTPS URL so they survive reload, documents carry only a filename) and an empty bot placeholder, then clear staged files (`useAIChat.ts` append block ~`612-620`).

### Phase 3 — Stream the turn
Choose the endpoint, POST JSON, parse SSE, mutate the last (bot) message as frames arrive.

**Endpoint selection** (`useAIChat.ts` in `streamInto`):

```
useDetect = hasAttachments && detectStreamEnabled()
endpoint  = useDetect ? `${CHAT_BASE}/detect/stream` : `${CHAT_BASE}/chat/stream`
```

- **Text-only turn** → `/chat/stream` (agent: reasoning + tools).
- **Image/document turn (flag on)** → `/detect/stream` (Python smart-detect, live `draft` building).

**Request bodies:**

`/chat/stream`:
```json
{
  "conversation_id": "<id>",
  "message": "<text>",
  "site_type": "<site>",
  "mode": "buyer|seller",            // omit if neutral
  "image_urls":  ["https://…"],       // omit if none
  "document_urls": ["https://…"]      // omit if none
}
```

`/detect/stream`:
```json
{
  "conversation_id": "<id>",
  "site_type": "<site>",
  "language": "en",
  "image_urls":  ["https://…"],
  "document_urls": ["https://…"]
}
```

Schemas are frozen: `ChatRequest` (`app/schemas.py:36-75`), `ChatContext` (`assistant.py:37-89`). **Never** put `user_id` in the body — it comes from the JWT.

---

## 3. The Streaming Protocol (SSE)

**Wire format:** `event: <name>\ndata: <json>\n\n` (frames separated by a blank line). Web parser: `useAIChat.ts:374-545`. Server emitters: `app/agent/runner.py:238-270`, `app/detect/sse.py:16-18`.

**Response header:** `Content-Type: text/event-stream`. Deadline ~120s; `heartbeat` frames keep the connection alive when idle.

### 3.1 `/chat/stream` events (agent)

| Event | Payload | Meaning | Terminal | Client action |
|---|---|---|---|---|
| `token` | `{ "delta": "…" }` | prose text delta | no | append to current bot bubble (typing effect) |
| `data` | `{ "type": "<card>", "data": {…} }` (+ optional `identified`, `match_count`) | one typed card | no | render/patch a card by `type` (§4) |
| `warning` | `{ "code": "MAX_TURNS_EXCEEDED" }` | agent hit `max_turns=12` | no | optional subtle notice |
| `done` | `{ "used_tools": [...], "conversation_id": "…" }` | turn complete | **yes** | finalize; show "Sources" badges from `used_tools` |
| `error` | `{ "error"/"detail"/"message": "…", "code": "PREFLIGHT_ERROR" }` | preflight/validation/unhandled | **yes** | show error bubble + Retry |
| `heartbeat` | `{ "ts": <ms> }` | keep-alive | no | ignore |

### 3.2 `/detect/stream` events (smart-detect)

Progress frames are largely internal; the ones the UI acts on are **`stage`**, **`draft`**, and the chat-mode `data`/`done`/`error`.

| Event | Payload | Meaning | Client action |
|---|---|---|---|
| `stage` | `{ "phase": "validating" \| "preparing_documents" \| "ai_running" \| "extracting_products" \| "done", message?, total?, current? }` | phase progress (note: the key is **`phase`**, not `stage`; `app/detect/pipeline.py`) | drive a "Reading your photo…" line / step checklist |
| `pdf_pages` | `{ count, extracted }` (or per-page metadata) | document progress | optional progress |
| `detection` | `{ suggested_mode, confidence, summary, product_count }` | detection summary | optional |
| `draft` | `{ "fields": {…} }` | **cumulative partial draft** (fields fill in as extraction runs) | replace the draft card each frame → live build |
| `data` | `{ "type": "listing_draft" \| "listing_group_choice" \| "listing_queue", "data": {…} }` | chat-mode card | render/patch card |
| `result` | `{ products, merged_single, … }` | final detection payload | finalize draft |
| `token` | `{ "delta": "…" }` | lead-in prose (chat mode) | append |
| `done` | `{ used_tools: ["detect_listing_from_images"], conversation_id }` | terminal | finalize |
| `error` | `{ "message": "…" }` | extraction failure (fatal or per-file) | error bubble + Retry |
| `heartbeat` | `{ "ts": <ms> }` | keep-alive | ignore |

> **Mobile reuse — this is the crown jewel.** The seller app already parses this exact `/detect/stream` shape today. Reuse:
> - Transport: `react-native-sse@1.2.1` with `addEventListener()` (NOT `onmessage`), `pollingInterval=0` (no auto-reconnect), 45s watchdog reset on `heartbeat` — see `src/services/scanner/smartDetectStream.ts`.
> - Event taxonomy: the discriminated union `SmartStreamEvent` in `src/features/scanner/smartDetectStreamTypes.ts` (`stage | detection | product | pdf_pages | error`). For the customer Lab you'll extend this with the **chat** frames (`token`, `data`, `draft`, `done`) since the seller scanner never streams prose or cards — see §11.
> - Hook shape: `src/features/scanner/useSmartDetect.ts` (a `useMutation` that takes an `onEvent` callback and resolves with a mapped result). This is the template for `useLabTurn()`.
> - Flag gate: `src/features/scanner/smartDetectV2Enabled.ts` (plain function, reads a build-time flag) mirrors the web `detectStreamEnabled()`.

### 3.3 Parsing rules (both endpoints)

1. Split the byte stream on `\n\n` into frames.
2. Per frame, read `event:` and `data:` lines separately. A frame may carry multiple `data:` lines (concatenate).
3. Dispatch on `event`. For `event: data`, dispatch again on the inner `data.type`.
4. `done` and `error` are terminal — close the stream and finalize UI.
5. Ignore `heartbeat`. Keep a client-side watchdog (45s) and treat silence past it as a stream stall (fall back to the Processing screen's timer ceiling — see `02-processing.md`).

---

## 4. Card Envelope Catalog (`event: data` types)

Every tool result is a **tool envelope** `{ type, data }` (§8 of the Python reference). The renderer switches on `type`. This is the complete set the mobile client must be prepared to receive. Web components are named for parity; mobile builds native equivalents driven by the same payloads.

### 4.1 Discovery & read cards

| `type` | Payload (essentials) | Emitting tool | Web component | Mobile use |
|---|---|---|---|---|
| `product_list` | `{ query, results: [{ id, batch_id, name, price, currency, condition, category, country, image_url }], total }` | `search_products` | ProductCard grid | search results; product tap → detail |
| `product` | `{ found, id, batch_id, name, post_content, price, … }` | `get_product` | ProductDetailCard | single product detail |
| `overview` | `{ live_lots, sold_lots }` | `get_marketplace_overview` | MarketplaceOverviewCard | stat card |
| `catalog_summary` | `{ total_products, categories[], countries[], conditions[] }` | `get_catalog_summary` | CatalogSummaryCard | browse stats |
| `batch_list` | `{ batches: [{ id, title, live_for_bids, product_count, image_url }], total }` | `get_recent_batches` | BatchListCard | recent auctions |
| `bid_list` | `{ status? , bids: [{ id, product_id, amount, currency, status, … }] }` | `get_my_bids` (buyer) | BidListCard | buyer's placed bids |
| `received_bids` | seller-side bids | `get_bids_on_my_listings` (seller) | ReceivedBidsCard | seller's incoming bids |
| `seller_summary` | `{ status?, listings: [{ id, title, approval_status, status, bid_count, image_url }] }` | `get_seller_summary` | SellerActivityCard | seller's listings |
| `platform_info` | `{ topic, title, sections/steps[] }` | `get_platform_info` | PlatformInfoCard | how-it-works explainer |

### 4.2 Listing builder cards (seller)

| `type` | Payload (essentials) | Web component | User action → next turn |
|---|---|---|---|
| `listing_entry_options` | `{ options: [upload, manual] }` | ListingEntryOptionsCard | tap → open picker OR send "I'll enter details manually" |
| `listing_draft` | `{ fields: { name: { value, confidence }, … }, image_urls, missing_required, low_confidence }` | ListingDraftCard | Edit → draft modal; Publish → send `"CONFIRM CREATE"` |
| `listing_group_choice` | `{ total, items, first_payload, mode }` | GroupChoiceCard | Separate / Combine → `POST /detect/split-products` \| `/detect/combine-products` |
| `listing_queue` | `{ total, index, items, remaining }` | MultiProductQueueRail | tap item → `POST /detect/load-product`; Publish all → `/detect/publish-batch` |
| `listing_created` | `{ product_id, batch_id, title, approval_status, note }` | ListingCreatedCard | "View listing" → navigate |
| `listing_gate` | `{ reason: "login" \| "seller_access" \| "guest_seller_capture" }` | GateCard | CTA → auth / seller upgrade |

**Draft field schema** (from `get_listing_draft`): `product_title, item_condition[], category, location, price_per_unit, quantity, brand, model, serial_number, operation_status[], item_grade, dimensions, weight_per_unit, year, country, price_format (buyNow|offer), price_currency (USD|EUR|JPY|CNY|TWD|THB), product_content`. Each is `{ value, confidence }`. `missing_required` and `low_confidence` drive completion UI.

> **Mobile mapping.** The Lab Draft screen (`03-draft-review.md`, route `app/(lab)/draft.tsx`) is the native `ListingDraftCard`. The seller app already maps this exact detection shape via `src/features/scanner/mapSmartDetection.ts` (`SmartDetectionResponse → MappedSmartDetection`, price coercion in `pickPrice()`/`pickAiPrices()`). Reuse that mapper — the `/detect/stream` `draft`/`result` payloads and the seller v2 payload are the same family.

### 4.3 Want-To-Buy cards (buyer, flag-gated)

| `type` | Payload (essentials) | Web component | User action |
|---|---|---|---|
| `wtb_draft` | `{ draft, preview_matches, … }` | WtbDraftCard (editable) | edit condition/budget/qty → Save & alert |
| `wtb_request` | `{ id, title, max_price, status, immediate_matches[] }` | WtbRequestCard | "View in My Wants" → navigate |
| `wtb_request_list` | `{ requests: [{ id, title, status, match_count }], total }` | WtbListCard | "View matches" → send matches message |
| `wtb_matches` | `{ wtb_id, title, matches[], match_count }` | WtbMatchesCard | product tap → navigate |
| `wtb_gate` | `{ reason: "login" \| "guest_lead_capture" }` | GateCard | sign-in CTA |

### 4.4 Image-search confirm & handoff

| `type` / signal | Payload | Web component | User action |
|---|---|---|---|
| `product_list` + `identified: { name, brand, model, keywords }` (and no in-stock cards) | vision recognized item | IdentifyConfirmCard (`IdentifyConfirmCard.tsx:15-51`) | Confirm → send `"Yes, that's the item."`; Reject → send correction |
| `handoff` | `{ thread_id, reason, priority, department, message }` | (handoff UI) | connected-to-human state (§10) |

> **Key pattern — the agent owns tool calls.** The client never calls a tool directly. To trigger `get_want_matches`, the client **sends a natural-language message** (`viewWantMatches` → `send(wantMatchesMessage(id, title))`, `useAIChat.ts:937-943`) and the agent decides to call the tool. Mobile must do the same: user actions on cards become new turns, not direct RPCs. (The exceptions are the multi-product `/detect/*` REST helpers and WTB REST CRUD in §5.)

---

## 5. Endpoint Reference (client-facing)

Base for chat/detect is the Python assistant (`CHAT_BASE`, e.g. `/ai-chat` on web via nginx proxy). Base for uploads/auth is the Node backend.

| Purpose | Method + Path | Auth | Notes |
|---|---|---|---|
| Streaming chat turn | `POST /chat/stream` | Bearer (+ refresh fallback) | SSE; §3.1 |
| Streaming detect turn | `POST /detect/stream` | Bearer (+ refresh) | SSE; flag `detect_stream_enabled`; 404 when off |
| Buffered chat (batch) | `POST /chat` | Bearer | JSON `ChatResponse { reply, used_tools, conversation_id }`; use only if you can't stream |
| Multi-product ops | `POST /detect/load-product` \| `/split-products` \| `/combine-products` \| `/publish-batch` | Bearer | drive `listing_queue`/`listing_group_choice` cards |
| Listing draft edit | `GET`/`PUT` `/listing-draft` | Bearer | out-of-band field edit → re-emits `listing_draft` |
| WTB CRUD | `POST`/`GET` `/wtb`, `GET /wtb/{id}`, `GET /wtb/{id}/matches`, `PATCH`/`DELETE /wtb/{id}` | verified buyer JWT | flag `wtb_enabled`; 404 when off |
| File upload | `POST /api/v1/gcs/upload` (Node) | `x-system-key` | §2 Phase 1 |
| Login | `POST /api/v2/auth/login` (Node) | public | `{ accessToken, refreshToken, user }` |
| Verify session | `GET /api/v2/auth/verify` (Node) | Bearer | returns `{ user, agent }` |
| Refresh token | `POST /api/v2/auth/refresh` (Node) | body `refreshToken` | new token pair |

Server status codes worth handling: `401` (auth missing), `404` (feature flag off), `413` (token/history too large), `422` (bad `site_type` — never send `"all"`), `429` (rate limited), `503` (daily spend cap). Errors use `ErrorEnvelope { detail, code }`.

---

## 6. Auth & Headers

**Token model (mobile client → assistant/Node):**

| Header | Value | Used on |
|---|---|---|
| `Authorization` | `Bearer <accessToken>` (15-min TTL) | chat/detect/WTB, verify |
| `X-Refresh-Token` | `<refreshToken>` (7-day TTL) | fallback when access expired |
| `x-platform` | `LabGreenbidz` (mixed-case literal, per `src/api/greenbidzClient.ts:10`; must match the web's `"LabGreenbidz"`) | Node calls |
| `x-system-key` | `<SYSTEM_KEY>` | **only** `/api/v1/gcs/*` |

**Server-side identity** (`app/deps.py:65-213`): decode Bearer (HS256, `alg=none` blocked); claim `id` (authV3) or `userId` (authV2) → `user_id: int`; `role` claim (authV3 only) → drives mode. On any decode failure returns `None` (guest) — never raises. **`user_id`/`role` are derived from the token, never trusted from the body.**

Web reference for header assembly: `authHeaders()` (`aiChatShared.tsx:72-83`) — reads `accessToken`/`refreshToken` from `localStorage`.

> **Mobile reuse.** Tokens live in SecureStore (`src/lib/secureStorage.ts` `getSecureItem`). The axios request interceptor already injects Bearer + refresh and handles `401 → logout()` (`src/api/interceptors.ts:12-35`). Reuse `src/api/greenbidzClient.ts` for REST (upload, WTB, auth). **Caveat:** SSE goes through `react-native-sse`'s `EventSource`, which does **not** run through axios interceptors — pass the headers explicitly when opening the stream, and read tokens from `useAuth`/SecureStore at open time. Handle `401` on the stream by refreshing then reopening.

---

## 7. Site Type & Multi-Tenancy

Always send a valid `site_type`; never `"all"`/`"*"` (rejected at schema, `422`).

| `site_type` | ID | Federation |
|---|---|---|
| `recycle` | 1 | standalone |
| `labgreenbidz` / `send` | 2 | public trio [5,2,6] |
| `greenbidz` | 3 | standalone |
| `greenx` | 4 | standalone |
| `machines` | 5 | public trio |
| `101it` | 6 | public trio |
| `null`/`""` | [5,2,6] | default public trio |

Buyers on 2/5/6 see federated inventory (`resolve_marketplace_site_ids`, `app/db/site_scope.py`). For the customer Lab app the site type is fixed per build (the 101LAB customer flow → `labgreenbidz`). Pin it once in config alongside `x-platform=lab`.

---

## 8. The Tool / Agent Loop

Per `/chat/stream` turn (`app/agent/runner.py:304-472`):

1. **Preflight:** validate body; token-budget the history (o200k_base). Over budget → `error` (`PREFLIGHT_ERROR` / 413).
2. **Resolve mode** (§1.2) → select the exposed tool set (§1.2 gating table).
3. **Load history** from Redis (§9), prose-only, trimmed to budget.
4. **Agent runs** (gpt-4o-mini, `max_turns=12`, `agent_max_output_tokens=1024`): interleaves prose (`token`) and tool calls. Each tool returns an envelope → emitted as a `data` frame. Exceeding `max_turns` emits `warning: MAX_TURNS_EXCEEDED`.
5. **Terminate:** `done { used_tools, conversation_id }`.

**Design invariants the mobile client depends on:**
- **Confirm-gated writes:** `create_listing` requires `confirmation="CONFIRM CREATE"`; a first call previews/gates. The client publishes by sending the literal message `"CONFIRM CREATE"`.
- **Idempotent create:** duplicate draft hash → returns the stored `product_id` (safe to retry).
- **Auth-gated tools** emit a `*_gate` card instead of failing when the caller isn't logged in / lacks role — render the gate, don't crash.

Full tool catalog with I/O shapes is in the Python protocol reference (search/get_product/overview/catalog/batches/bids/seller_summary/platform_info + listing builder + WTB + handoff).

---

## 9. Redis Memory (Session State)

`app/memory/redis_store.py`. Keys are partitioned by identity + site + conversation:

```
chat:history:{identity}:{site_type}:{conversation_id}   List — prose turns
listing:draft:{identity}:{site_type}:{conversation_id}  String — JSON draft
listing:created:{identity}:{site_type}:{conversation_id} String — idempotency marker
listing_queue / listing_batch / listing_split :{user_id}:{conversation_id}  multi-product
rate:{ip}:{minute} · spend:{YYYY-MM-DD}                counters
```

- `identity` = `"guest"` or the string user_id. History is **prose-only** (no tool JSON), trimmed to `token_budget` (default 8000), capped at `history_max_messages` (50), TTL 86400s.
- **Fail-open:** Redis down → history skipped, chat still streams. (Multi-turn context is lost when Redis is down — a known gotcha.)

**Mobile implication:** the client does NOT reconstruct server history — it only replays its own locally-stored message list for display. Continuity across turns comes from sending the same `conversation_id`; the server rehydrates context from Redis. Persist the local transcript in MMKV for offline display (mirror web's `gb_ai_msgs_<id>`), but treat it as a view cache, not the source of truth.

---

## 10. Human Handoff

Tool `request_handoff` (flag `zoho_handoff_enabled`) → Node `POST /api/v1/request-handoff`. Layered fallback: SalesIQ conversation → Zoho Desk ticket → email-only (always succeeds; endpoint always returns 200). Emits a `handoff` card `{ thread_id, reason, priority, department, message }`. Auth-free tool; Python sends `user_id` only (email resolved Node-side). When the flag is off the endpoint returns `{ skipped: "flag_off" }`.

**Mobile:** render a "connecting you with our team" state on the `handoff` card. Live replies currently poll (~20s); no push webhook yet. This is distinct from the Lab **Deal Room** (§below).

---

## 11. How This Maps to the Mobile Lab (Reuse Map)

The Lab customer flow (`app/(lab)/…`) is currently static demo data (`src/features/lab/data/demo.ts`) with `// FUTURE DYNAMIC HOOK POINT` markers. The chat system above is the backing engine for the Home → Processing → Draft → Published path. The Matches/Match-detail/Deal-room screens are WTB + matching outputs and a separate messaging surface.

| Lab screen | Backing chat/API mechanism | Reuse |
|---|---|---|
| Home composer (`01-home-tell-ai.md`) | one turn to `/chat/stream` (text) or `/detect/stream` (photo); `mode` from `sell/buy` toggle | `composerStore.ts`; new `useLabTurn()` modeled on `useSmartDetect.ts` |
| Processing (`02-processing.md`) | `/detect/stream` `stage`/`draft` frames | `smartDetectStream.ts` transport + watchdog; keep the 2600ms timer as a stall ceiling |
| Draft (`03-draft-review.md`) | `listing_draft` card; Publish → send `"CONFIRM CREATE"` | `mapSmartDetection.ts` mapper; draft field schema §4.2 |
| Published (`04-published.md`) | `listing_created` card + immediate WTB matches | listing_created payload |
| Matches feed (`05-matches-feed.md`) | WTB `wtb_request_list` / `get_want_matches`, or REST `/wtb`, `/wtb/{id}/matches` | `matchesView.ts` `toMatchVM` adapter → React Query |
| Match detail (`06-match-detail.md`) | `wtb_matches` payload | `useMatchDetail(id)` (TanStack Query) |
| Deal room (`07-deal-room.md`) | **NOT the AI conversation** — 1:1 messaging (Node chat + future socket) | reuse SSE-less; socket subscription is new |

**Build order for the mobile chat client:**
1. `conversation_id` mint/persist (MMKV) + `mode` mapping (`sell→seller`).
2. SSE client: extend `smartDetectStreamTypes.ts` with chat frames (`token`, `data`, `draft`, `done`, `warning`, `error`, `heartbeat`); reuse `react-native-sse` transport from `smartDetectStream.ts`.
3. `useLabTurn()` mutation (template: `useSmartDetect.ts`) — Phase 1: uploads via `uploadGcsPhotos.ts`; Phase 2: choose `/chat/stream` vs `/detect/stream`; stream `onEvent`.
4. Card dispatcher: switch on `data.type` → native components (§4). Start with `product_list`, `listing_draft`, `listing_created`, `wtb_*`, and gates.
5. Auth headers on the stream open (SecureStore, NOT via interceptors); `401` → refresh + reopen.
6. Feature-flag parity: `detect_stream_enabled`, `wtb_enabled`, `zoho_handoff_enabled` server-side; mirror with `src/lib/flags.ts` / `smartDetectV2Enabled.ts` client-side.

---

## 12. Gotchas / Non-Obvious Rules (Checklist)

- **Never** send `user_id`/`role` in the body — server derives from JWT.
- **Never** send `site_type: "all"` — `422`. Pin the Lab's site type in config.
- **`sell/buy` ≠ `seller/buyer`** — translate at the API boundary.
- **`x-system-key`** is for `/gcs/*` **only**; chat/detect use Bearer.
- **SSE bypasses axios interceptors** — attach auth headers manually and handle `401` on the stream yourself.
- **Client never calls tools directly** — card actions become new natural-language turns (except `/detect/*` and WTB REST helpers).
- **Publish = send literal `"CONFIRM CREATE"`**; creates are idempotent by draft hash.
- **Terminal frames** are `done` and `error` — everything else is mid-stream; ignore `heartbeat` but reset a 45s watchdog on it.
- **Redis fails open** — a turn can succeed with no prior context if Redis is down; don't assume server memory is guaranteed.
- **Flags gate endpoints to 404** — `detect_stream_enabled` / `wtb_enabled` off returns 404, not an error frame; handle before opening the stream.
