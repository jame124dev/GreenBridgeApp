# 03 — Mobile API Contract

> **Scope.** The exact, copy‑pasteable HTTP + SSE contract the GreenBridge **customer** app (`app/(lab)/*`) calls to go dynamic: AI chat (streaming), image/PDF smart‑detect (streaming), Want‑To‑Buy (create/list/match), bids, product/listing fetch + publish, and live‑agent handoff. Every endpoint is tagged with its **base URL** (Node vs. Python assistant), required **headers/auth**, request body, and response / stream‑event examples.
>
> **Reuse first.** The seller app already ships a complete, production‑grade streaming client. This doc names the *actual* files to reuse (`src/services/scanner/smartDetectStream.ts`, `src/api/greenbidzClient.ts`, `src/services/scanner/uploadGcsPhotos.ts`, `src/features/scanner/useSmartDetect.ts`) rather than inventing new machinery. Where the customer flow needs something the seller app doesn't have (chat SSE, WTB, handoff), it's called out explicitly.
>
> **Siblings.** Screen behavior lives in [`01-home-tell-ai.md`](../01-home-tell-ai.md), [`02-processing.md`](../02-processing.md), [`03-draft-review.md`](../03-draft-review.md), [`04-published.md`](../04-published.md), [`05-matches-feed.md`](../05-matches-feed.md), [`06-match-detail.md`](../06-match-detail.md), [`07-deal-room.md`](../07-deal-room.md). Foundation tokens/stack in [`00-foundation.md`](../00-foundation.md). This file is the wire contract those screens bind to.

---

## 0. Two backends, one identity

The app talks to **two** services. Never confuse them — they have different auth models and different base URLs.

| Base URL | Alias in this doc | What lives here | Env var (Expo `extra`) |
|---|---|---|---|
| Node Express (`/api/v1/*`, `/api/v2/*`) | **NODE** | Auth/login, GCS upload, product/batch fetch + publish, buyer bids, smart‑detect v2 SSE | `GREENBIDZ_API_URL` (`src/lib/env.ts:8`) |
| Python FastAPI assistant | **ASSISTANT** | Chat stream, chat‑mode detect stream, WTB CRUD, chat tools, handoff | `AI_BASE_URL` *(new — see §11)* |

> **Today's mobile config** (`src/lib/env.ts`) only knows `GREENBIDZ_API_URL`, `X_SYSTEM_KEY`, `WEB_APP_URL`. The customer app must add an **`AI_BASE_URL`** to `app.config.ts → extra` for the ASSISTANT surface (e.g. `https://ai.greenbidz.com` prod, `https://dev-ai.greenbidz.com` dev). See §11.

### 0.1 Header matrix

There are **three** distinct auth mechanisms. Which headers you send depends on the endpoint, not the base URL.

| Header | Value | Sent to | Purpose |
|---|---|---|---|
| `Authorization: Bearer <accessToken>` | JWT, 15‑min TTL | NODE + ASSISTANT | User identity. `{ userId, email, name }` on Node; `id`/`role` claims read by assistant (`deps.py`). |
| `x-refresh-token: <refreshToken>` | JWT, 7‑day TTL | NODE + ASSISTANT | Fallback when access token expired. Assistant `deps.py` verifies this if Bearer is stale. |
| `x-platform: LabGreenbidz` | literal, mixed‑case | NODE | Site scope. **Must match the web** ("LabGreenbidz"), not lowercase — `greenbidzClient.ts:10`. |
| `x-system-key: <key>` | shared secret | NODE `/gcs/*` only | System gate on GCS upload/sign endpoints (`SYSTEM_KEY`). From `extra.X_SYSTEM_KEY`. |
| `site_type: "labgreenbidz"` | **request body** field, not a header | ASSISTANT | Marketplace scope for chat/WTB. Site 2 (federates with 5 + 6). See §1.2. |
| `X-Site-Type: labgreenbidz` | header, ASSISTANT WTB | ASSISTANT | Marketplace context on WTB REST (assistant reads this on `/wtb`). |

> **`X-System-Key` is NODE‑only.** The assistant does not gate on it. Do **not** send `x-system-key` to chat/WTB/handoff — it's meaningless there and leaks the key.

### 0.2 How the existing client already sets these

`src/api/greenbidzClient.ts` (the axios instance) + `src/api/interceptors.ts` already do the right thing for **NODE**:

```ts
// greenbidzClient.ts:8-24  — baseURL = GREENBIDZ_API_URL, x-platform + x-system-key baked in
// interceptors.ts:13-19    — request interceptor injects Bearer + x-refresh-token from secureStorage
//   const access  = await getSecureItem('auth.accessToken');
//   const refresh = await getSecureItem('auth.refreshToken');
//   if (access)  config.headers.Authorization      = `Bearer ${access}`;
//   if (refresh) config.headers['x-refresh-token'] = refresh;
// interceptors.ts:27-30    — 401 (not on /auth/login) → logout() + onUnauthorizedHandler()
```

**Reuse the `greenbidz` axios instance verbatim for every NODE call.** For SSE (chat + detect) the axios interceptor is bypassed, so headers are replicated by hand — exactly the pattern already in `smartDetectStream.ts:104-121` (reads both tokens from `getSecureItem`, sets `Accept: text/event-stream`, `x-platform`, optional `x-system-key`). **A new `AI_BASE_URL` streaming client should copy that header block, minus `x-system-key`.**

---

## 1. Chat — streaming turn (ASSISTANT)

The customer Home composer ([`01-home-tell-ai.md`](../01-home-tell-ai.md)) and any conversational surface stream a turn here. This is the assistant's `POST /chat/stream`.

### 1.1 Endpoint

| | |
|---|---|
| **Base** | **ASSISTANT** (`AI_BASE_URL`) |
| **Method / Path** | `POST /chat/stream` |
| **Content‑Type** | `application/json` |
| **Accept** | `text/event-stream` |
| **Auth** | `Authorization: Bearer` (optional; guest allowed — search/draft‑WTB only). `x-refresh-token` fallback. **No** `x-system-key`. |
| **Status** | 200 · 422 (bad `site_type`) · 429 (rate limit) · 503 (spend cap) |

There is also a **buffered** `POST /chat` (same body, JSON reply `{ reply, used_tools, conversation_id }`). Prefer the stream on mobile for the typing effect; use buffered only where a spinner is acceptable.

### 1.2 Request body

```json
{
  "conversation_id": "lab-<uuid>",
  "message": "Agilent 1260 HPLC with DAD, budget $18k",
  "site_type": "labgreenbidz",
  "mode": "buyer",
  "image_urls": ["https://storage.googleapis.com/.../a.jpg"],
  "document_urls": ["https://storage.googleapis.com/.../spec.pdf"]
}
```

| Field | Type | Notes |
|---|---|---|
| `conversation_id` | string, ≤128 | Opaque. Generate once per lab session; persist (Zustand/MMKV) so Home + downstream screens share the thread. Mirror the seller `convIdRef` pattern from the web `useAIChat`. |
| `message` | string, ≤2000 | Composer text. |
| `site_type` | string | **Always** `"labgreenbidz"` for this app. Never `"all"`/`"*"` → 422. Site 2 federates discovery across sites 2/5/6. |
| `mode` | `"buyer"` \| `"seller"` \| omit | The assistant **acts on `buyer`/`seller` only** — but server-side `ChatRequest.mode` is `str | None` (`app/schemas.py:56`), so any other value is **silently ignored, not rejected**; `_default_mode` in `app/api/chat.py:149-166` only matches roles `seller`/`buyer` and otherwise falls back to the JWT role. So the client MUST map + guard. Map the composer `ModeToggle` (`composerStore.ts`, `'sell'\|'buy'`) → `sell→seller`, `buy→buyer` **at this call-site** — sending the raw `"buy"`/`"sell"` misroutes (R6). `buyer` → recommendations + WTB tools; `seller` → listing helpers. Omit → agent decides from JWT role. |
| `image_urls` / `document_urls` | string[] \| omit | GCS HTTPS URLs from a prior `/gcs/upload` (§3). Only text‑only turns hit `/chat/stream`; image/doc turns route to `/detect/stream` (§2). |

> **Never send `user_id` in the body.** Identity comes from the JWT claims only (assistant `deps.py`). The buyer/seller `mode` is the only intent hint you pass.

### 1.3 SSE frames

Frame format is `event: <name>\ndata: <json>\n\n`. This is the **same wire shape** the seller `smartDetectStream.ts` already parses via `addEventListener('<name>', …)` (react‑native‑sse, custom events — NOT `onmessage`). Reuse that transport skeleton.

| `event:` | `data:` payload | Terminal | Client action |
|---|---|---|---|
| `token` | `{ "delta": "..." }` | no | Append delta to the streaming bot bubble (typing effect). |
| `data` | `{ "type": "<card>", "data": {…} }` | no | Render a typed card by `type` (see §1.4). |
| `warning` | `{ "code": "MAX_TURNS_EXCEEDED" }` | no | Optional toast; non‑blocking. |
| `done` | `{ "used_tools": [...], "conversation_id": "..." }` | **yes** | Finalize turn; show "Sources" chips from `used_tools`. |
| `error` | `{ "error": "detail", "code": "PREFLIGHT_ERROR" }` | **yes** | Render error bubble + Retry (re‑POST same body). |
| `heartbeat` | `{ "ts": <ms> }` | no | Reset watchdog only; no UI. |

### 1.4 `event: data` card types (customer‑relevant subset)

Each `data` frame carries a `type`. The full seller catalog is large; the **customer** surfaces care about these:

| `type` | Shape (abridged) | Customer screen use |
|---|---|---|
| `product_list` | `{ query, results: [{ id, batch_id, name, price, currency, condition, category, country, image_url }], total }` | Buy‑mode search results / match cards. Also carries optional `identified` for visual search. |
| `product` | `{ found, id, batch_id, name, post_content, price, currency, condition, category, country, image_url, batch_status, approval_status, visibility }` | Product detail. |
| `listing_draft` | `{ fields: { <field>: { value, confidence } }, image_urls, missing_required, low_confidence }` | Sell‑mode Draft screen ([`03-draft-review.md`](../03-draft-review.md)). Replaces the whole draft each frame → live build. |
| `listing_created` | `{ product_id, batch_id, title, approval_status, note, image_count }` | Published screen ([`04-published.md`](../04-published.md)). |
| `listing_gate` | `{ reason: "login" \| "seller_access" \| "guest_seller_capture", message? }` | Gate card → route to auth / seller upgrade. |
| `wtb_request` | `{ id, title, max_price, condition_wanted, status, immediate_matches: [product] }` | Buy‑mode "Want posted" + matches. |
| `wtb_request_list` | `{ requests: [{ id, title, status, match_count, created_at }], total }` | "My Wants". |
| `wtb_matches` | `{ wtb_id, title, matches: [product], match_count }` | Match feed for a saved want. |
| `handoff` | `{ thread_id, reason, priority, department, message }` | Live‑agent handover (§7). |

> **Field parity.** The `listing_draft.fields` schema (product_title, item_condition, category, brand, model, price_per_unit, price_currency, quantity, …) is identical to what the seller app's `mapSmartDetection` already normalizes. The customer Draft screen can reuse `src/features/scanner/mapSmartDetection.ts` shape mapping.

### 1.5 Reuse note

There is **no** chat‑stream client in the seller app today (it only streams detect). Build `src/services/lab/chatStream.ts` by copying `smartDetectStream.ts` structure:
- header block (`chatStream` uses `AI_BASE_URL`, drops `x-system-key`),
- `settle()` resolve‑XOR‑reject once,
- watchdog reset on `heartbeat`,
- `pollingInterval: 0` (no auto‑reconnect),
- a **new event‑type union** `LabChatEvent` modeled on `SmartStreamEvent` (`smartDetectStreamTypes.ts`) but with `token`/`data`/`warning`/`done`/`error` variants.

---

## 2. Image / PDF smart‑detect — streaming (two routes)

There are **two** detect endpoints. Pick by whether you're in a conversational context.

### 2.1 Route A — NODE smart‑detect v2 (already wired in the seller app)

This is the endpoint `src/services/scanner/smartDetectStream.ts` **already calls today**. The customer Sell flow ([`02-processing.md`](../02-processing.md)) can reuse it as‑is via `useSmartDetect()`.

| | |
|---|---|
| **Base** | **NODE** |
| **Method / Path** | `POST /wp/analyze-smart-detection-v2` |
| **Auth** | `Authorization: Bearer` + `x-refresh-token` + `x-platform` + `x-system-key` (per `smartDetectStream.ts:111-118`). |
| **Body** | `{ "image_urls": [...], "language": "en", "document_urls"?: [...], "sellerId"?: "574" }` |

**SSE events** (typed in `src/features/scanner/smartDetectStreamTypes.ts`, `SmartStreamEvent` union):

| `event:` | payload | Client action |
|---|---|---|
| `stage` | `{ phase: 'validating'\|'preparing_documents'\|'ai_running'\|'extracting_products'\|'done', message?, total?, current? }` | Drive the Processing checklist (`PHASE_TO_STEP`). |
| `pdf_pages` | `{ documentIndex, pages: [{ index, page, url, width, height }] }` | Progress only. |
| `detection` | `{ suggested_mode, confidence, summary, product_count }` | Progress only. |
| `product` | `{ index, id?, data, image_indexes, document_indexes, error? }` | Per‑product extraction. |
| `result` | full `SmartDetectionResponse` (**byte‑identical to v1**) | **Terminal.** Map with `mapSmartDetection(payload, siteType)` → Draft. |
| `error` | `{ code, message, fatal, retriable }` | Non‑fatal continues; fatal → reject with `SmartDetectStreamError`. |
| `heartbeat` | `{ ts }` | Watchdog reset (45 s, `DEFAULT_WATCHDOG_MS`). |

> **Reuse `useSmartDetect()` verbatim** (`src/features/scanner/useSmartDetect.ts`): it uploads photos+docs to `/gcs/upload`, builds `image_urls`/`document_urls` via `gcsUrlForAnalyze`, then calls `smartDetectStream` (v2) or `smartDetectFromUrls` (v1) gated by `smartDetectV2Enabled()`. The customer Processing screen only needs to pass its captured photos and pipe `onEvent` into the checklist.

### 2.2 Route B — ASSISTANT chat‑mode detect stream

When the detect happens **inside a conversation** (the AI‑first composer, not the dedicated scanner), route to the assistant so the result persists to the chat draft.

| | |
|---|---|
| **Base** | **ASSISTANT** |
| **Method / Path** | `POST /detect/stream` |
| **Auth** | `Authorization: Bearer` + `x-refresh-token`. **No** `x-system-key`. |
| **Flag** | `DETECT_STREAM_ENABLED` (assistant) — 404 when off. |

**Body:**

```json
{
  "conversation_id": "lab-<uuid>",
  "site_type": "labgreenbidz",
  "language": "en",
  "image_urls": ["https://..."],
  "document_urls": ["https://..."]
}
```

**SSE events** add chat‑mode framing on top of the detect stream:

| `event:` | payload | Client action |
|---|---|---|
| `stage` | as Route A | Optional thinking line ("Reading your photo…"). |
| `draft` | `{ fields: {…} }` (cumulative partial) | Live‑build draft card. |
| `data` | `{ type: "listing_draft" \| "listing_group_choice" \| "listing_queue", data: {…} }` | Card payload. |
| `token` | `{ delta }` | Lead‑in prose. |
| `done` | `{ used_tools: ["detect_listing_from_images"], conversation_id }` | **Terminal.** |
| `error` | `{ message }` | Error bubble + Retry. |
| `heartbeat` | `{ ts }` | Watchdog reset. |

> **Choosing a route.** If the customer app keeps the dedicated capture→Processing scanner flow, use **Route A** (zero new code). If detect is folded into the chat composer with persisted drafts + edit/publish via chat, use **Route B**. The `listing_draft` shape is identical either way.

---

## 3. Image / PDF upload → GCS (NODE)

Both detect routes need HTTPS GCS URLs first. This is `src/services/scanner/uploadGcsPhotos.ts` — reuse it directly.

| | |
|---|---|
| **Base** | **NODE** |
| **Method / Path** | `POST /gcs/upload` |
| **Content‑Type** | `multipart/form-data` |
| **Auth** | `x-system-key` (system gate) + `x-platform`; Bearer via interceptor. |
| **Body** | `files[]` (≤20, ≤50 MB each) · `sellerId` (string) · `sessionId?` (reuse across photo+doc calls) |

**Response:**

```json
{ "success": true, "data": { "sessionId": "sess_...", "files": [
  { "originalName": "photo-0.jpg", "objectName": "sellers/574/sess_.../photo-0.jpg", "url": "https://...", "size": 148213 }
]}}
```

> **Order matters.** `files[]` round‑trips input order; smart‑detect's `image_indexes` are index‑based (`uploadGcsPhotos.ts:16, 198-202`). The `objectName`s are reused at publish time via `gcs_image_paths[]` — no re‑upload. Convert `objectName` → analyze‑safe URL with `gcsUrlForAnalyze` (`src/services/scanner/gcsUrl.ts`), which routes through NODE `GET /gcs/serve`.

---

## 4. Want‑To‑Buy — create / list / match (ASSISTANT)

WTB is **assistant‑owned REST** (Python → Node only for notification delivery; the mobile client talks to the assistant). Gated by `wtb_enabled` — all routes 404 when off.

| | |
|---|---|
| **Base** | **ASSISTANT** |
| **Auth** | verified buyer `Authorization: Bearer` (or `x-refresh-token` fallback) + `X-Site-Type: labgreenbidz`. `buyer_id` is injected from the JWT — **never send it in the body.** |

| Method / Path | Purpose | Request | Response |
|---|---|---|---|
| `POST /wtb` | Create want | `{ title, description?, category?, condition?, country?, max_price?, quantity?, keywords?, notify_frequency?, site_type }` | `{ request: { id, title, status, created_at }, matches: [top‑N product] }` |
| `GET /wtb?status=&limit=&offset=` | List my wants | — | `{ requests: [{ id, title, status, match_count, created_at }], total }` |
| `GET /wtb/{id}` | Want detail | — | `{ …request, match_count }` |
| `GET /wtb/{id}/matches?status=&limit=&offset=` | Matches for a want | — | `{ wtb_id, title, matches: [product], match_count }` |
| `PATCH /wtb/{id}` | Edit / pause / resume / fulfill | partial fields | updated request |
| `DELETE /wtb/{id}` | Soft‑delete | — | `{ ok: true }` |

> **Two paths to a want.** (a) **Conversational** — send a buy‑mode chat turn; the agent calls `create_want_to_buy` and emits a `wtb_request` `data` frame (§1.4). (b) **Direct REST** — the Matches feed ([`05-matches-feed.md`](../05-matches-feed.md)) and "My Wants" call `GET /wtb` / `GET /wtb/{id}/matches` directly for a list UI without a chat turn. Prefer REST for the feed; prefer chat for the guided create.

> **Match card shape** feeds [`05-matches-feed.md`](../05-matches-feed.md) and [`06-match-detail.md`](../06-match-detail.md). Adapt each `match` to the screen view‑model exactly the way the seller `matchesView.ts` does (keep JSX stable, transform in the adapter).

---

## 5. Bids (NODE)

Buyer bids are **NODE, body‑based** (no service JWT — these are the customer‑facing endpoints; `buyer_id` comes from the body/JWT context). Bid *creation on a batch* (`/bid/create`) is a service‑JWT path used by the assistant during publish, not the mobile client.

| Method / Path | Base | Auth | Purpose | Key body/params |
|---|---|---|---|---|
| `POST /buyer/bid/place` | NODE | body‑based | Buyer places a bid (Deal Room CTA). Optional `document_image` multipart. | `batch_id`, `buyer_id`, `company_name`, `contact_person`, `country`, `amount`, `bid_quantity?`, `notes?` |
| `POST /buyer/bid/check` | NODE | body‑based | Already bid? | `{ batch_id, buyer_id }` → boolean |
| `GET /buyer/bid/batch/:batch_id` | NODE | public | All bids on a batch | — |
| `GET /buyer/bid/batch/:batch_id/top` | NODE | public | Current top bid (prevent self‑outbid) | — |
| `GET /buyer/bid/buyer/:buyer_id` | NODE | public | My placed bids | — |
| `POST /buyer/bid/offer/submit` | NODE | body‑based | Counter‑offer on make‑offer batches | `batch_id`, `buyer_id`, `amount`, `notes?` |
| `GET /bid/batch/:batch_id` | NODE | public | Bid session config for a batch | `language?` |

`POST /buyer/bid/place` response:

```json
{ "success": true, "data": { "bids": [ … ], "bidding": { … }, "server_time": "…" } }
```

> **Chat‑surfaced bids.** In chat, the agent's `get_my_bids` tool emits a `bid_list` `data` frame — read that for a conversational "my bids" view. The REST endpoints above are for a dedicated bids screen / the Deal Room confirm action.

---

## 6. Product / batch fetch + publish

### 6.1 Fetch (NODE, public — no auth)

| Method / Path | Base | Purpose | Params |
|---|---|---|---|
| `GET /batch/fetch` | NODE | Marketplace batches (paginated, cached) | `limit`, `page`, `type` (site scope), `category?`, `language?`, `ID?` (user → bypasses cache) |
| `GET /batch/:batchId` | NODE | Single batch detail | — |
| `GET /product/detail/:id` | NODE | Single product detail | — |
| `GET /product/category` | NODE | Category tree (cached, ~8 s upstream) | `language` |

> The seller app already fetches batch detail via `src/services/scanner/fetchBatchDetail.ts` + `useBatchDetail.ts` and categories via `fetchCategories.ts` + `useLabCategories.ts` — **reuse these hooks** for the customer product/detail screens.

### 6.2 Publish (ASSISTANT‑orchestrated — the mobile client does NOT call Node create directly)

Publishing goes **through the assistant chat**, not a direct Node write. The confirm‑gated write chain (`create_listing` tool → Node `POST /wp/create-product-direct` → `POST /batch/create` → `POST /bid/create`) is service‑JWT and lives server‑side. The mobile client's job is only to **send the confirmation turn**:

1. Sell‑mode draft is built (§2, `listing_draft` frames).
2. User taps **Publish** → send a `/chat/stream` turn with `message: "CONFIRM CREATE"` (buffered `/chat` also works).
3. Assistant runs the write chain and emits a `listing_created` `data` frame → Published screen.

Draft edits before publish: send field‑patch turns (the agent's `update_listing_draft` tool) or, if you build a modal editor, mirror the web `PUT /listing-draft` (assistant) — but for v1 the chat‑turn edit path is simplest and requires no new endpoint.

> **Do not** wire the customer app to Node `POST /wp/create-product-direct` directly — it requires a service JWT (`NODE_SERVICE_JWT_SECRET`) that must never ship in the app bundle. All writes are confirm‑gated through the assistant. (Also: the "local" Node writes to the **production** DB — treat CONFIRM CREATE as a real write.)

---

## 7. Live‑agent handoff (ASSISTANT → NODE)

The "Talk to a person" action escalates to a human. The mobile client triggers it **through chat** — it does not call Node's handoff endpoint directly.

- **Trigger:** send a chat turn expressing the need for a human (or a dedicated "Talk to a person" quick action that sends a canned message). The agent calls `request_handoff` (assistant, `zoho_handoff_enabled`).
- **Result frame:** `event: data` with `{ "type": "handoff", "data": { thread_id, reason, priority, department, message } }`.
- Render the `message` in‑thread and switch the composer into "connected to support" mode; keep polling the same conversation for agent replies (the current prod handover uses a ~20 s poll, no webhook).

The underlying Node `POST /request-handoff` (SalesIQ → Desk → email fallback, always HTTP 200) is a **service‑JWT** call made by the assistant — not a mobile surface.

---

## 8. Auth / login (NODE)

| Method / Path | Base | Auth | Body | Response |
|---|---|---|---|---|
| `POST /api/v2/auth/login` | NODE | public | `{ email, password }` | `{ success, accessToken, refreshToken, user: { id, email, name, agent } }` |
| `POST /api/v2/auth/signup` | NODE | public | `{ name, email, password, company }` | confirmation |
| `GET /api/v2/auth/verify` | NODE | Bearer | — | `{ success, user, agent }` (`agent`=has `ai_agent` role) |
| `POST /api/v2/auth/refresh` | NODE | body | `{ refreshToken }` | new `{ accessToken, refreshToken }` |

> On login, store `accessToken`/`refreshToken` under `auth.accessToken`/`auth.refreshToken` in `secureStorage` (the interceptor + `smartDetectStream` both read those exact keys) and `user` into the `authStore` (`profile`). The customer app reuses the seller auth store + `secureStorage` unchanged.

---

## 9. End‑to‑end sequences (mobile lens)

### 9.1 Buy‑mode composer → matches (chat + WTB)

```
Home (mode=buy, input) 
  → POST /chat/stream  {conversation_id, message, site_type:"labgreenbidz", mode:"buy"}   [ASSISTANT]
      ⇐ token…  data(product_list)  data(wtb_request)  done
  → Matches feed reads GET /wtb  +  GET /wtb/{id}/matches                                  [ASSISTANT]
  → Match detail GET /wtb/{id}/matches (or product detail GET /product/detail/:id [NODE])
  → Deal Room: POST /buyer/bid/place                                                       [NODE]
```

### 9.2 Sell‑mode photo → published (detect + publish)

```
Home (mode=sell) → capture/pick photos
  → POST /gcs/upload  (files[], sellerId)                                                  [NODE]
  → Route A: POST /wp/analyze-smart-detection-v2 (SSE)  → result → mapSmartDetection        [NODE]
     OR Route B: POST /detect/stream (SSE, conversation_id)  → listing_draft frames         [ASSISTANT]
  → Draft screen (edit via chat field-patch turns)
  → Publish: POST /chat/stream  message:"CONFIRM CREATE"  → data(listing_created)           [ASSISTANT]
  → Published screen
```

---

## 10. Errors, retries, watchdog (mobile UX)

| Condition | Where | Client behavior |
|---|---|---|
| 401 (expired) | NODE (axios) | Interceptor calls `logout()` + `onUnauthorizedHandler` (`interceptors.ts:27-30`). Re‑auth then retry. |
| SSE `error` fatal | chat/detect | `settle()` → reject with `SmartDetectStreamError(code, retriable)`. Show error bubble + **Retry** (re‑POST same body). |
| SSE `error` non‑fatal | detect | Stream continues; surface a soft note, keep waiting for `result`/`done`. |
| No `heartbeat` for 45 s | any SSE | Watchdog fires → `connection_lost` (retriable). Reuse `DEFAULT_WATCHDOG_MS` from `smartDetectStream.ts:44`. |
| 429 | ASSISTANT chat / NODE detect | `too_many_concurrent` / rate‑limited → back‑off + retry. |
| 503 | ASSISTANT chat | Daily spend cap — show a graceful "assistant busy" state, no auto‑retry storm. |
| 422 | ASSISTANT | Bad `site_type` — a code bug; must always be `"labgreenbidz"`. |

> **Processing screen fallback.** Keep the `AUTO_ADVANCE_MS` timer ceiling from [`02-processing.md`](../02-processing.md) as a stall guard even after wiring live `stage` events — if the stream hangs below the watchdog, the timer still moves the UI forward.

---

## 11. Config & feature flags to add (mobile)

| Key | Where | Purpose |
|---|---|---|
| `AI_BASE_URL` | `app.config.ts → extra`, read via `src/lib/env.ts` | ASSISTANT base URL (chat, detect Route B, WTB, handoff). **New** — not present today. |
| `GREENBIDZ_API_URL` | existing (`env.ts:8`) | NODE base URL. |
| `X_SYSTEM_KEY` | existing (`env.ts:9`) | GCS system gate. |
| `SMART_DETECT_V2_ENABLED` | `src/lib/flags.ts` | SSE detect (Route A) vs. v1 blocking POST. Already exists. |
| `LAB_CHAT_ENABLED` | new flag | Gate the ASSISTANT chat surface until wired. |
| `WTB_ENABLED` (client) | new flag | Gate WTB REST/feed UI; server also gates via `wtb_enabled`. |

Add `AI_BASE_URL` + `X-Site-Type` to `getAuthConfigError()`‑style boot validation so a missing assistant URL surfaces in dev, mirroring `env.ts:36-45`.

---

## 12. Reuse cheat‑sheet (files to copy, not reinvent)

| Need | Reuse | Notes |
|---|---|---|
| NODE axios + auth headers | `src/api/greenbidzClient.ts` + `src/api/interceptors.ts` | Verbatim for all NODE calls. |
| SSE transport skeleton | `src/services/scanner/smartDetectStream.ts` | Template for `chatStream.ts` (drop `x-system-key`, point at `AI_BASE_URL`, new event union). |
| Smart‑detect mutation | `src/features/scanner/useSmartDetect.ts` | Reuse as‑is for Sell Route A. |
| GCS upload | `src/services/scanner/uploadGcsPhotos.ts` (+ `gcsUrl.ts`) | Reuse for §3. |
| Draft field mapping | `src/features/scanner/mapSmartDetection.ts` | `listing_draft`/`result` → view model. |
| Batch/category fetch | `src/services/scanner/fetchBatchDetail.ts`, `fetchCategories.ts` + hooks | Reuse for product/detail screens. |
| Query client | `src/lib/queryClient.ts` | Shared TanStack instance. |
| Token storage | `src/lib/secureStorage.ts` (`auth.accessToken` / `auth.refreshToken`) | Keys the interceptor + SSE read. |
| Event‑type taxonomy template | `src/features/scanner/smartDetectStreamTypes.ts` | Model `LabChatEvent` on `SmartStreamEvent`. |

**Must build new:** `src/services/lab/chatStream.ts` (chat SSE), `src/services/lab/wtb.ts` (WTB REST), lab query hooks (`useLabMatches`, `useLabMatchDetail`, `useDeal`), and a Deal Room socket/poll (§7 — 20 s poll for v1, no webhook yet).
