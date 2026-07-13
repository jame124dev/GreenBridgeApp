# 04 · Per-Screen Integration Plan — Static → Dynamic Wiring (101LAB Customer App)

**Scope:** Screen-by-screen wiring of the `(lab)` customer app from the Phase-1 static
`demo.ts` build to the live GreenBridge backend + Python AI assistant. Covers the eight
screens of the home→deal state machine plus a real streaming chat surface. For each
screen: the feeding endpoint/stream, the React Query / SSE data layer, the store changes,
the `demo.ts → live payload` mapping, and the loading / empty / error / offline /
optimistic-update behavior.

**Sibling docs (this `dynamic/` folder):** cross-reference `00-foundation.md` (tokens,
component library, animation recipes) and the per-screen static specs in
`../` — `01-home-tell-ai.md`, `02-processing.md`, `03-draft-review.md`,
`04-published.md`, `05-matches-feed.md`, `06-match-detail.md`, `07-deal-room.md`,
`08-bottom-nav.md`. This doc is the *dynamic contract*; those are the *visual/interaction
contracts*. **JSX must not change** between static and dynamic — every swap point below
keeps the component input shape identical.

**Grounding:** All mobile citations are real files in `GreenBridgeApp/src`. All endpoint
citations are from the Node backend (`101recycle-greenbidz-backend`) and Python assistant
(`greenbidz-ai-assistant`) discovery. The SSE hook is modeled on the already-shipped
seller scanner pipeline `src/services/scanner/smartDetectStream.ts` +
`src/features/scanner/useSmartDetect.ts`.

---

## 0 · Reality Check — What Actually Exists Server-Side

The customer flow's screens (`matches`, `match/[id]`, `deal/[id]`) imply a **match/deal
domain** that does **not** exist as a first-class REST surface today. Be honest about this
in the plan so we don't invent APIs:

| Screen need | Exists today? | What we build on |
|---|---|---|
| Home composer → AI turn | ✅ Yes | Python `POST /chat/stream` + `POST /detect/stream` (SSE) |
| Processing (live stages) | ✅ Yes | SSE `stage`/`detection`/`draft`/`product` frames (detect stream) |
| Draft (AI listing/WTB) | ✅ Yes | `listing_draft` frame (sell) / `wtb_draft` frame (buy) |
| Publish listing | ✅ Yes | `CONFIRM CREATE` turn → `listing_created` frame (Node create-product-direct + batch) |
| Post WTB request | ✅ Yes | `create_want_to_buy` tool → `wtb_request` frame (Python `POST /wtb`) |
| Matches feed | ⚠️ Partial | `list_my_wants` + `get_want_matches` chat tools + Python `GET /wtb`, `GET /wtb/{id}/matches` |
| Match detail | ❌ No dedicated endpoint | Composed client-side from a WTB match row + `get_product` (see §7) |
| Deal room | ❌ No 1:1 deal API | Node `POST /chat/send` + `GET /chat/conversation/:id/messages` (generic chat), NOT a deal-specific API |
| Deal room real-time | ⚠️ Socket exists (frontend) | Node emits socket events for WTB in-app notifications; no per-deal room protocol yet |

**Consequence for phasing:** Home / Processing / Draft / Published are fully wireable now
(the seller scanner already proves the exact SSE path against the same backend). Matches
lands on the WTB surface. **Match Detail and Deal Room have no backing API** — they need a
thin backend addition (documented as an open dependency in §11), or ship as
composed/degraded views in the interim. Do not fabricate `/lab/*` endpoints; the discovery
shows the real surface is the assistant chat/WTB stack plus Node chat.

---

## 1 · Shared Data Layer (build once, reuse everywhere)

Everything below is created once and consumed by every screen. Reuse the seller app's
plumbing verbatim where noted.

### 1.1 · Reuse map (do NOT rebuild)

| Building block | File | Action |
|---|---|---|
| Axios client + base URL + `x-platform`/`x-system-key` | `src/api/greenbidzClient.ts` | **Reuse as-is** |
| Request/response interceptors (Bearer + `x-refresh-token` inject, 401→`logout()`) | `src/api/interceptors.ts` | **Reuse as-is** — see `attachGreenbidzInterceptors` (lines 12-35) |
| Query client (`retry:2`, `staleTime:30_000`) | `src/lib/queryClient.ts` | **Reuse as-is** |
| Secure token storage | `src/lib/secureStorage.ts` (`getSecureItem`) | **Reuse as-is** |
| MMKV | `src/lib/mmkv.ts` | **Reuse as-is** |
| Auth store (Zustand + MMKV) | `src/stores/authStore.ts` (`useAuth`) | **Reuse** — `useAuth.getState().profile?.id` |
| SSE transport | `react-native-sse@1.2.1` | **Reuse** — pinned behavior documented in `smartDetectStream.ts` header |
| SSE reference implementation | `src/services/scanner/smartDetectStream.ts` | **Template** for the new `useLabChatStream` |
| Mutation-with-stream reference | `src/features/scanner/useSmartDetect.ts` | **Template** for `useLabComposerTurn` |
| Composer store | `src/features/lab/stores/composerStore.ts` (`useComposer`) | **Extend** (see §3) |
| Matches VM adapter | `src/features/lab/matches/data/matchesView.ts` (`toMatchVM`) | **Reuse mapper**, swap source |

### 1.2 · New files to create

```
src/features/lab/data/
  labQueryKeys.ts        # centralized query-key factory (§1.3)
  labErrors.ts           # SSE/HTTP → LabError mapping (§1.6)
src/services/lab/
  labChatStream.ts       # react-native-sse hook body, modeled on smartDetectStream.ts
  labChat.ts             # buffered/non-stream helpers (send turn, upload)
  labWtb.ts              # WTB REST wrappers (list wants, matches)
  labDeal.ts             # Node chat wrappers (messages, send)
src/features/lab/hooks/
  useLabChatStream.ts    # the SSE hook (the core new primitive)
  useLabComposerTurn.ts  # composer send → stream orchestration (mutation)
  useMatches.ts          # replaces matchesView.useMatches() body
  useMatchDetail.ts
  useDeal.ts / useDealMessages.ts / useSendDealMessage.ts
src/features/lab/stores/
  sessionStore.ts        # conversation_id + last draft + last result (§3.2)
  chatStore.ts           # streaming message thread + status (§3.3)
```

### 1.3 · Query-key factory (`labQueryKeys.ts`)

Single source of truth so invalidation is greppable. Mirrors the hook-point comments
already in the code (e.g. `matchesView.ts:11-14` uses `['matches']`).

```ts
export const labKeys = {
  all: ['lab'] as const,
  matchCount: () => [...labKeys.all, 'matchCount'] as const,          // home pill
  wants: (status?: string) => [...labKeys.all, 'wants', status] as const,
  matches: () => [...labKeys.all, 'matches'] as const,                // matches feed
  matchDetail: (id: string) => [...labKeys.all, 'match', id] as const,
  product: (id: number) => [...labKeys.all, 'product', id] as const,
  deal: (id: string) => [...labKeys.all, 'deal', id] as const,
  dealMessages: (id: string) => [...labKeys.all, 'deal', id, 'messages'] as const,
};
```

### 1.4 · Auth interceptor (already solved — reuse, don't duplicate)

REST calls go through `greenbidzClient` and inherit `attachGreenbidzInterceptors`
(`interceptors.ts:12-35`): access token + `x-refresh-token` injected on every request; a
`401` (except `/auth/login`) triggers `logout()` + the app's `onUnauthorized` handler.
**The SSE transport bypasses axios**, so — exactly as `smartDetectStream.ts:104-118` does —
the SSE hook must replicate those headers by hand:

```
Accept: text/event-stream
Content-Type: application/json
x-platform: <extra.SITE_TYPE ?? 'LabGreenbidz'>          // note: assistant wants site_type in BODY too
Authorization: Bearer <auth.accessToken>                  // getSecureItem
x-refresh-token: <auth.refreshToken>                      // getSecureItem
x-system-key: <extra.X_SYSTEM_KEY>                        // only for /gcs/upload
```

> **site_type contract:** The Python assistant reads `site_type` from the **JSON body**
> (`ChatRequest.site_type`), allowed value `"labgreenbidz"` (ID 2, federated with 5+6). The
> Node smart-detect header uses `x-platform`. Send **both**: header `x-platform:
> LabGreenbidz` and body `site_type: "labgreenbidz"`.

### 1.5 · The SSE hook (`useLabChatStream`) — modeled on `smartDetectStream.ts`

The seller scanner's `smartDetectStream()` is a battle-tested one-shot SSE consumer.
Generalize it for the chat/detect streams. **Keep every hard-won behavior** from the
reference:

| Reference behavior (`smartDetectStream.ts`) | Keep for lab | Why |
|---|---|---|
| Custom events via `addEventListener('<name>', …)`, not `onmessage` (line 279-281) | ✅ | assistant sends named frames `token`/`data`/`done`/`error`/`heartbeat`/`warning` |
| `pollingInterval: 0` (line 268) | ✅ | one-shot turn; never auto-reconnect (would re-run the AI turn) |
| `settle()` resolve-XOR-reject-once (line 146-151) | ✅ | terminal `done`/`error` exactly once |
| 45s heartbeat watchdog, re-armed on any frame (line 44, 156-163) | ✅ | assistant emits `heartbeat {ts}` every 10s (`detect_heartbeat_seconds`, `config.py:130`) |
| Disambiguate backend `event:error` vs transport error on `typeof ev.data==='string'` (line 187) | ✅ | identical framing |
| `429 → retriable` mapping (line 218) | ✅ | assistant rate-limit + per-seller stream cap |
| `removeAllEventListeners()+close()` on settle (line 137-142) | ✅ | no dangling XHR |
| `signal.aborted` re-check after listener attach (line 258-261) | ✅ | abort race on fast back-press |

**Frame-type differences from the scanner stream** — the lab chat/detect streams add
`token`, `data` (typed cards), `done`, `warning` on top of the scanner's
`stage`/`detection`/`product`/`pdf_pages`/`result`. The event catalog to handle:

| Event | Payload | Handler in hook | Notes |
|---|---|---|---|
| `token` | `{delta}` | append to streaming bot text | typing effect |
| `data` | `{type, data, identified?, match_count?}` | dispatch by `data.type` | the rich-card firehose (§1.5.1) |
| `stage` | `{phase, message?, total?, current?}` — key is `phase`, NOT `stage` | forward to Processing screen | `phase` ∈ `validating\|preparing_documents\|ai_running\|extracting_products\|done` (`app/detect/pipeline.py`) |
| `draft` | `{fields}` | cumulative partial listing draft | detect stream only; live card build |
| `detection` | `{suggested_mode, confidence, summary, product_count}` | Processing progress | detect stream only |
| `pdf_pages` | `{documentIndex, pages:[{index,page,url,width,height,...}]}` | Processing progress | detect stream only |
| `product` | per-product final | multi-item queue | detect stream only |
| `warning` | `{code:"MAX_TURNS_EXCEEDED"}` | non-blocking toast | do not settle |
| `done` | `{used_tools, conversation_id}` | **terminal** — resolve | echo `conversation_id` into session store |
| `error` | `{error\|detail\|message, code, fatal?, retriable?}` | fatal→reject, non-fatal→forward | `PREFLIGHT_ERROR`, `SPEND_CAP_EXCEEDED`, etc. |
| `heartbeat` | `{ts}` | re-arm watchdog only | no UI |
| `result` | detect final (byte-compat Node v2) | detect stream terminal | maps via existing `mapSmartDetection` |

#### 1.5.1 · `data` card dispatch (the shared card taxonomy)

The assistant emits `event: data` frames whose `data.type` selects a card renderer — this
is the same taxonomy the web frontend's `useAIChat.streamInto()` dispatches. The lab app
only needs a **subset** (customer-facing sell + buy):

| `data.type` | Feeds screen | Store slot |
|---|---|---|
| `listing_draft` | Draft (sell) | `sessionStore.draft` |
| `listing_created` | Published (sell) | `sessionStore.created` |
| `listing_gate` (`login`/`seller_access`) | Draft gate | `chatStore.gate` |
| `listing_group_choice` / `listing_queue` | Draft multi-item (later) | `chatStore.queue` |
| `wtb_draft` | Draft (buy) | `sessionStore.wtbDraft` |
| `wtb_request` | Published (buy) | `sessionStore.wtbRequest` |
| `wtb_request_list` | Matches / My Wants | React Query cache |
| `wtb_matches` | Matches / Match Detail | React Query cache |
| `product_list` | (search results, buy) | `chatStore` message cards |
| `product` | Match Detail enrichment | `labKeys.product(id)` |
| `wtb_gate` (`login`) | Draft gate | `chatStore.gate` |
| `platform_info`, `overview`, `catalog_summary` | optional info cards | `chatStore` |

> The lab app deliberately does **not** render seller-dashboard cards (`bid_list`,
> `received_bids`, `seller_summary`) in the customer flow — those belong to the seller app.
> The dispatch switch simply ignores unhandled types (forward-compatible).

#### 1.5.2 · Hook signature

```ts
// useLabChatStream.ts — one active stream at a time (a chat turn)
type LabStreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'data'; cardType: string; data: unknown; identified?: unknown }
  | { type: 'stage'; phase: string }
  | { type: 'draft'; fields: Record<string, unknown> }
  | { type: 'detection'; confidence: number; summary: string; productCount: number }
  | { type: 'warning'; code: string }
  | { type: 'done'; usedTools: string[]; conversationId: string };

function openLabStream(opts: {
  endpoint: 'chat' | 'detect';          // /chat/stream vs /detect/stream
  body: LabChatBody;                     // conversation_id, message, site_type, mode, image_urls, document_urls, language
  signal?: AbortSignal;
  onEvent: (e: LabStreamEvent) => void;  // live UI sink (same pattern as onEvent in useSmartDetect.ts:61)
}): Promise<{ conversationId: string; usedTools: string[] }>;  // resolves on `done`
```

Endpoint selection mirrors the web `useAIChat` rule: **attachments present → `/detect/stream`**
(live draft build), **text-only → `/chat/stream`** (agent reasoning + tools).

### 1.6 · Error mapping (`labErrors.ts`)

Map both SSE and HTTP failures to one `LabError { title, body, retriable, action }` so
every screen's error state is consistent. Reuse `SmartDetectStreamError`'s `{code,
retriable}` shape (`smartDetectStream.ts:48-57`).

| Source | Code | User-facing | Retriable | Action |
|---|---|---|---|---|
| SSE `error` frame | `SPEND_CAP_EXCEEDED` (503) | "AI is busy right now." | no (backoff) | Retry later |
| SSE `error` frame | `RATE_LIMITED` (429) | "Too many requests — one sec." | yes | Auto-retry |
| SSE transport | `too_many_concurrent` (429) | "Still finishing your last one." | yes | Retry |
| SSE `error` frame | `PREFLIGHT_ERROR` / 413 | "That was a bit much to process." | no | Trim input |
| SSE watchdog | `connection_lost` | "Connection dropped." | yes | Retry |
| SSE `error` frame | `VALIDATION_ERROR` (400/422) | "Something's off with that request." | no | Edit |
| HTTP 401 | (handled by interceptor) | → `logout()` + sign-in | — | Re-auth |
| Gate frame | `listing_gate:seller_access` | "Sellers only — upgrade to list." | no | Upgrade CTA |
| Gate frame | `*_gate:login` | "Sign in to save this." | no | Sign-in CTA |

The retriable branch feeds the existing `retry` message pattern (web `useAIChat` stores
`retry:message` on the error bubble; lab mirrors it into `chatStore`).

### 1.7 · Offline behavior (app-wide policy)

- **Detect a lack of connectivity** before opening a stream; if offline, do **not** open
  the SSE (it would hang to the 45s watchdog). Show an offline banner + queue the intent.
- React Query: `staleTime: 30_000` (already set) means Matches/My-Wants render from cache
  when offline. Set `networkMode: 'offlineFirst'` on the lab read queries so cached data
  shows immediately and refetch resumes on reconnect.
- Composer sends and deal messages are **optimistic** (§7, §8); on offline they stay in a
  local "pending" state and flush on reconnect rather than erroring.

---

## 2 · Home (Composer) — `app/(lab)/(tabs)/home.tsx`

**Static today:** reads `COMPOSER_COPY[mode]` (`demo.ts:21-60`) and a hardcoded
`MATCH_COUNT = 3` pill (home.tsx:31-34). Send/chip actions navigate to `/(lab)/processing`
with `{mode, input}` captured from `useComposer`.

**Dynamic wiring:**

| Element | Source | Query/Action |
|---|---|---|
| "N new matches" pill | live count of new WTB matches | `useQuery(labKeys.matchCount(), fetchNewMatchCount)` |
| Composer copy/chips | **stays static** (`COMPOSER_COPY`) | copy is product content, not server data |
| Send / chip → navigate | opens a chat turn on the next screen | pass `{mode, input, attachments}` params |

- **matchCount query:** derive from `list_my_wants` (sum of `match_count` for `status:active`)
  or a lightweight `GET /wtb` count. Poll on focus (`refetchOnWindowFocus`-equivalent via
  screen focus). Empty/zero → hide the pill (per `01-home-tell-ai.md`).
- **The Send action itself does not stream here.** It navigates to Processing carrying
  `mode` + `input` (and any staged photo/PDF). The stream is opened *by Processing* so the
  spinner and the SSE lifecycle share one screen (matches the current
  `home.tsx:73-82 → router.push('/(lab)/processing')` structure).
- **Loading:** pill shows nothing until first fetch (no skeleton — it's a nicety).
- **Error/offline:** pill silently hides; composer is always usable.

---

## 3 · Store Changes

### 3.1 · `composerStore.ts` — extend (do not replace)

Current shape (`composerStore.ts:18-25`) is `mode/input` + setters, UI-only, no
persistence. Add the staged-attachment fields the send flow needs, keeping it UI-only:

```ts
type ComposerState = {
  mode: 'sell' | 'buy';
  input: string;
  attachments: { uri: string; name: string; isImage: boolean }[];  // NEW (staged, pre-upload)
  setMode; toggleMode; setInput;
  addAttachment; removeAttachment;                                   // NEW
  reset;  // also clears attachments
};
```

Attachments here are **local** (object URIs / picked files) — GCS upload happens inside the
turn, exactly like the scanner uploads in `useSmartDetect.ts:78-95` before streaming.

### 3.2 · `sessionStore.ts` — NEW (conversation identity + last artifacts)

The web keeps `conversation_id` in `localStorage` (`CONV_KEY = "gb_ai_conv_id"`,
`useAIChat.ts:369`). Mobile mirrors this with a persisted Zustand+MMKV store (same pattern
as `authStore.ts`).

```ts
type SessionState = {
  conversationId: string;        // opaque, ≤128 chars (assistant contract); persisted via MMKV
  draft: ListingDraft | null;    // last listing_draft frame (sell)
  wtbDraft: WtbDraft | null;     // last wtb_draft frame (buy)
  created: ListingCreated | null;// last listing_created (sell publish)
  wtbRequest: WtbRequest | null; // last wtb_request (buy post)
  newConversation();             // fresh id (e.g. uuid) — "start over"
  applyFrame(cardType, data);    // setLast()-equivalent
};
```

- One conversation per install (matches web "one conversation per browser"). Draft/Published
  screens read from here so a back-navigation re-renders the same artifact without a refetch.
- `applyFrame` is the mobile analog of the web `setLast({...})` dispatch.

### 3.3 · `chatStore.ts` — NEW (the streaming thread)

Backs the real chat surface (§9) and the transient card stream. Not persisted (ephemeral
per session; history is reconstructed from Redis server-side on demand).

```ts
type Msg =
  | { role: 'user'; text: string; attachments?: Attachment[] }
  | { role: 'bot'; text: string; cards?: Card[]; tools?: string[]; streaming?: boolean }
  | { role: 'err'; text: string; retry?: string; code?: string };

type ChatState = {
  messages: Msg[];
  status: 'idle' | 'streaming' | 'error';
  gate: null | { kind: 'login' | 'seller_access' };
  appendUser; appendBotShell; appendTokenToLast; setLastCard; setError; setGate;
};
```

`appendTokenToLast` is the token-stream sink; `setLastCard` handles `event: data` frames.
This is the mobile port of the web `useAIChat` message model — same fields (`text`,
`cards`, `tools`, `retry`) from the discovery's *Core Message Props* table.

---

## 4 · Processing — `app/(lab)/processing.tsx`

**Static today:** 3-layer spinner, `PROCESSING_COPY[mode]` (`demo.ts:68-84`), steps
hardcoded `['done','done','active']`, auto-advances after `PROCESSING_DURATION_MS = 2600`
(`demo.ts:84`), Android back cancels + returns Home.

**Dynamic wiring — this screen owns the stream open.**

| Static | Live source |
|---|---|
| `PROCESSING_COPY[mode].title` | keep as initial title; refine from `stage` frames |
| 3 hardcoded steps | derive step status from `stage` + `detection`/`product` progress |
| `PROCESSING_DURATION_MS` timer | **keep as a fallback ceiling** if the stream stalls (per hook-point comment) |
| auto-advance → Draft | advance when the `draft`/`listing_draft` (sell) or `wtb_draft` (buy) frame lands |

Flow (via `useLabComposerTurn`, modeled on `useSmartDetect.ts:36-128`):

1. On mount, read `{mode, input, attachments}` from route params + `composerStore`.
2. If attachments present → **upload to `/gcs/upload`** first (reuse
   `uploadGcsPhotos`/`uploadGcsDocuments` from `src/services/scanner/`, same as scanner
   `useSmartDetect.ts:78-95`), get `image_urls`/`document_urls`.
3. Open the stream:
   - **attachments → `/detect/stream`** (`endpoint:'detect'`), body `{conversation_id,
     site_type:'labgreenbidz', language:'en', image_urls, document_urls}`.
   - **text-only → `/chat/stream`** (`endpoint:'chat'`), body `{conversation_id, message:
     input, site_type, mode}` — map the composer's `'sell'|'buy'` → **`'seller'|'buyer'`**
     at this call-site (the assistant's `ChatRequest.mode` accepts only `buyer`/`seller`;
     sending raw `sell`/`buy` misroutes — R6).
4. Map incoming frames → step checklist:

| Step | Sell (detect) | Buy (chat) |
|---|---|---|
| Step 1 | `stage: validating/preparing` → "Reading your equipment" | `token` starting → "Understanding your request" |
| Step 2 | `detection` frame → "Pulled specs, condition & price" | `wtb_draft` frame → "Created your Wanted request" |
| Step 3 | `draft`/`listing_draft` frame → "Checking buyer demand" | `product_list`/`wtb_draft.preview_matches` → "Scanning sellers" |

5. On the first substantive draft frame → persist to `sessionStore` and
   `router.replace('/(lab)/draft')`.
6. **Cancel:** Android back / leaving screen → `signal.abort()` (the hook's `onAbort`,
   `smartDetectStream.ts:165` pattern) so no orphan AI run; return Home.

**States:**
- **Loading:** the spinner *is* the loading state; steps light up from real frames.
- **Stall:** watchdog (45s) or the fallback timer → show "Taking longer than usual — keep
  waiting / cancel".
- **Error:** SSE `error` (fatal) → route to an error state with `LabError` copy + Retry
  (re-open the same turn). Non-fatal errors forwarded as inline notices, stream continues.
- **Offline:** never open the stream offline (§1.7); show offline banner + Retry.

---

## 5 · Draft — `app/(lab)/draft.tsx`

**Static today:** `DRAFT_DATA[mode]` (`demo.ts:107-146`) — `{headline, market, source,
title, location, specs[], priceLabel, price, priceHint, demandTitle, demandSub,
publishLabel}`, picked by `useComposer.mode`.

**Dynamic source:** the draft artifact already sitting in `sessionStore` from Processing —
**no new fetch on entry** (it streamed in on the previous screen). A `getListingDraft` /
`get_listing_draft` refetch is only the recovery path (cold entry / app resume).

### 5.1 · Mapping `DRAFT_DATA` → live payload

**Sell** — from the `listing_draft` frame (`data.fields` are `{value, confidence}` pairs;
schema in the Python protocol §3 `get_listing_draft`):

| `DraftData` field | Live source |
|---|---|
| `title` | `fields.product_title.value` |
| `location` | `fields.location.value` (+ `country`) |
| `specs[]` | derived rows from `fields`: Condition ← `item_condition` (via `condLabel`), Year ← `year`, Category ← `category`, Brand/Model ← `brand`/`model`, Dimensions ← `dimensions` |
| `price` | `fields.price_per_unit.value` + `fields.price_currency.value` |
| `priceLabel` | static "SUGGESTED PRICE" |
| `priceHint` | from `market_metrics` (`pricing_basis`) if present, else omit |
| `demandTitle`/`demandSub` | preview match count if the draft carries it, else static copy |
| `source` | "from your photo" if detect path, "from your text" if chat path |
| `market` | "101LAB" (constant) |

Also surface `missing_required` + `low_confidence` (from the draft frame) as
field-level "needs review" badges — the customer app's lightweight analog of the web
`ListingEditModal` field badges.

**Buy** — from the `wtb_draft` frame (`WtbDraftData`):

| `DraftData` field | Live source |
|---|---|
| `title` | `draft.title` |
| `specs[]` | Quantity ← `quantity`, Type/category ← `category`, condition pills ← `condition_wanted`, timeline ← keywords/notes |
| `price` | `max_price` → "up to $X" |
| `priceLabel` | "YOUR BUDGET" |
| `demandTitle`/`demandSub` | `preview_matches` count → "N sellers can supply this" |

### 5.2 · Editing (optional, phase-in)

The customer app spec is lightweight — inline field edits map to the assistant's
`update_listing_draft` tool via a natural-language turn (web sends a `PUT /listing-draft`;
mobile can start by sending a short chat turn like "change condition to used" which the
agent applies and re-emits `listing_draft`). Full modal parity with the web
`ListingEditModal` is out of scope for v1.

### 5.3 · Publish CTA (the mutation)

| Mode | Action | Server path | Terminal frame |
|---|---|---|---|
| Sell | send `"CONFIRM CREATE"` turn on `/chat/stream` | assistant `create_listing` → Node `create-product-direct` + `batch/create` | `listing_created` |
| Buy | send confirm turn (or `create_want_to_buy`) | assistant `create_want_to_buy` → Python `POST /wtb` | `wtb_request` |

- **Optimistic:** flip the Publish button to a spinner immediately; the confirm-gated write
  is idempotent server-side (draft-hash dedup per the Python "Idempotency" pattern) so a
  double-tap is safe — but still guard with a local `publishing` flag (mirror the web
  `wtbSavedRef` create-once guard).
- **Gate:** if the turn returns `listing_gate:seller_access` (non-seller) or `*_gate:login`
  (guest) → render the gate card + CTA instead of navigating. This is the real-world reason
  a customer might be blocked from selling.
- **Success:** persist `listing_created`/`wtb_request` to `sessionStore`,
  `router.replace('/(lab)/published')`.

**States:** loading = button spinner; error = inline `LabError` + keep the draft intact for
retry; offline = disable Publish + banner (never fire the write offline).

---

## 6 · Published — `app/(lab)/published.tsx`

**Static today:** `PUBLISHED_DATA[mode]` (`demo.ts:174-193`) + `PUBLISHED_AVATARS`
(SG/TW/VN). Match count hardcoded ("3"/"4").

**Dynamic source:** the `listing_created` (sell) / `wtb_request` (buy) artifact already in
`sessionStore` from the publish turn — again, **no fetch on entry**.

| `PublishedData` field | Live source |
|---|---|
| `title`/`sub` | static celebration copy (keep) |
| `matchCount` | sell → count from the created listing's immediate matches (if returned); buy → `wtb_request.immediate_matches.length` |
| `matchLabel` | static per mode |
| `avatars` | Phase-2 comment already says "derive from real `countries: ISO[]`"; map `immediate_matches[].country` → ISO chips, fall back to `PUBLISHED_AVATARS` if empty |
| `managedNote` | static |

- The "view matches" affordance deep-links to the Matches tab (§7).
- **Empty matches** (published but zero immediate matches): show "We'll ping you the moment
  a match appears" instead of a count — the managed-marketplace promise, honestly stated.
- **Error/offline:** this screen only reads local artifact state, so it always renders; the
  match count degrades to the empty message if the create response omitted matches.

---

## 7 · Matches Feed — `app/(lab)/(tabs)/matches.tsx`

**Static today:** `MATCHES: MatchCard[]` (`demo.ts:212-249`) adapted by `toMatchVM`
(`matchesView.ts:51-65`). The hook-point comment (`matchesView.ts:10-17`) already specifies
the swap: replace `useMatches()` body with `useQuery({queryKey:['matches'], queryFn:
fetchMatches})`, keep `toMatchVM`, keep JSX.

**Dynamic source:** the WTB match surface. There is **no `/lab/matches` endpoint** — the
real data is a buyer's saved wants and their matches:

- **My Wants:** Python `GET /wtb` (or `list_my_wants` chat tool → `wtb_request_list` frame).
- **Matches per want:** Python `GET /wtb/{id}/matches` (or `get_want_matches` →
  `wtb_matches` frame).

The feed is the **union of recent matches across all active wants**, newest first. Fetch
via REST (cleaner for a pull-to-refresh list than a chat turn):

```ts
// useMatches.ts — replaces matchesView.useMatches() body
const { data = [], isLoading, refetch, isRefetching } = useQuery({
  queryKey: labKeys.matches(),
  queryFn: fetchMatches,          // GET /wtb → for each active want, GET /wtb/{id}/matches; flatten+sort
  networkMode: 'offlineFirst',
});
return { matches: data.map(toMatchVM), isLoading, refetch, isRefetching };
```

### 7.1 · Mapping `MatchCard` → WTB match payload

| `MatchCard` field | Live source (WTB match row + parent want) |
|---|---|
| `id` | `match.id` (or `wtb_id:product_id`) |
| `tag` | derived from score: `≥0.95`→"New match", `0.8–0.95`→"New match", else "Worth a look" (the `scoreBand` helper in `matchesView.ts:16`); note server `boosted_score` is 0..1 → ×100 for `pct` |
| `time` | `match.matched_at` → `formatDistanceToNowStrict` (per hook-point comment) |
| `pct` | `round(boosted_score * 100)` |
| `sell`/`sellSub` | product side: `product_snapshot.name` / `country · price` |
| `want`/`wantSub` | parent want: `title` / context (category · budget) |
| `tagColor`/`tagBg` | **not needed** — `toMatchVM` already derives ring colors from `variant` |

`toMatchVM` stays untouched; only the *source* of the `MatchCard`-shaped rows changes. The
score→variant band (`≥91 pct` thresholds in the comment) reconciles with the WTB two-tier
model (retrieval floor 0.4, notify floor 0.8): the feed shows the *retrieval* set (0.4+),
so "Worth a look" ≈ 0.4–0.8, "New match" ≈ 0.8+.

**States** (all already scaffolded per the discovery — "isLoading skeleton cards, refetch →
pull-to-refresh, empty state"):
- **Loading:** skeleton match cards.
- **Empty:** "No matches yet — post a Want or listing and we'll find them" (this is the
  *common* first-run state; make it a real, encouraging empty state, not an error).
- **Error:** inline retry banner; keep any cached rows visible.
- **Offline:** `offlineFirst` renders cache; pull-to-refresh queues until reconnect.

---

## 8 · Match Detail — `app/(lab)/match/[id].tsx`

**Static today:** `MATCH_DETAIL_FIXTURE` (`demo.ts:311-335`) — `{id, dealId, confidence,
tag, wts{...}, wtb{...}, reasons[], trust{verifiedSeller, escrow}}`. The hook-point
(`match/[id].tsx:26-30`) says: replace import with `useMatchDetail(id)` + loading skeleton +
404 empty state. CTA → `/(lab)/deal/${dealId}`.

**Honest gap:** there is **no match-detail endpoint** and **no `reasons`/`trust`/`dealId`
producer** server-side. Options, cheapest first:

1. **Compose client-side (v1):** pull the match row already in the Matches cache (§7) for
   `wts`/`wtb`/`confidence`/`tag`, and enrich the product side with `get_product` /
   Node `GET /product/detail/:id` for full spec. `reasons` and `trust` are **not** produced
   by the assistant today → render `reasons` from the score breakdown we *do* have (e.g.
   "96% match", "under budget" derived from `max_price` vs `price`, "same category") and
   show `trust` as static managed-marketplace chips. `dealId` does not exist → the CTA
   creates/opens a conversation on demand (§9).
2. **Backend addition (proper):** a `GET /wtb/matches/{match_id}` that returns the enriched
   pair + a `deal`/conversation id. **Flag this as an open dependency (§11).**

```ts
// useMatchDetail.ts
const { data, isLoading, isError } = useQuery({
  queryKey: labKeys.matchDetail(id),
  queryFn: () => composeMatchDetail(id),   // read matches cache + get_product enrichment
});
```

### 8.1 · Mapping `MatchDetailFixture` → composed payload

| Fixture field | Live source |
|---|---|
| `confidence` | `round(boosted_score*100)` from the match row |
| `tag` | `scoreBand` (same as feed) |
| `wts` | product side: `get_product`/`product_snapshot` → `{title, org(seller), location, priceLabel}` |
| `wtb` | parent want → `{title, context, budgetLabel}`; "You ·"/"Buyer ·" prefix derived from `composerStore.mode` at render (per demo comment `demo.ts:326`) |
| `reasons` | derived (see above) — NOT server-provided today |
| `trust` | static managed-marketplace chips today |
| `dealId` | none today → minted when CTA opens the conversation (§9) |

**States:** loading skeleton (per hook-point); **404/empty** when the match id isn't in
cache and enrichment fails → "This match is no longer available"; error → retry.

**CTA (Confirm interest):** optimistic — flip to a spinner, open/create the deal
conversation, then `router.push('/(lab)/deal/{id}')`. No server "confirm" primitive exists
yet; the honest v1 behavior is "opens a managed conversation with the counterparty via Node
chat" (§9).

---

## 9 · Deal Room — `app/(lab)/deal/[id].tsx`

**Static today:** `DEAL_ROOM` (`demo.ts:358-384`) seed thread + `DEAL_CANNED_REPLY`
(`demo.ts:391`) pushed ~900ms after each user send. The hook-point (`deal/[id].tsx:44-49`)
specifies: `useQuery(['deal', id])` header, `useQuery(['deal', id, 'messages'])` thread,
socket subscription to retire the canned reply, optimistic append on send.

**Honest gap:** there is **no deal/room API**. The closest real surface is Node's generic
mobile chat (discovery Feature 13): `POST /api/v1/chat/send`, `GET
/api/v1/chat/conversation/:id/messages`, `GET /api/v1/chat/list/:role/:user_id`. These are
**body-based `user_id`, no auth, no per-deal semantics, no concierge role, no escrow
banner**. So the Deal Room maps onto a Node chat *conversation*, with the "managed /
concierge" framing rendered client-side.

| Static piece | Live source |
|---|---|
| header (`counterparty`, `initials`, `subtitle`) | `useQuery(labKeys.deal(id))` → conversation meta (counterparty from the match); `managedNote` static |
| thread messages | `useQuery(labKeys.dealMessages(id))` → `GET /chat/conversation/:id/messages` (paginated) |
| `me`/`them` bubbles | map Node message `sender`/`role` → `kind:'me'\|'them'` |
| `system`/`day`/`concierge` | client-synthesized (day dividers, "introduced by 101LAB"); **concierge is not a real server role today** |
| send | `POST /chat/send {conversation_id, user_id, role, message}` |

### 9.1 · Optimistic send + real-time

- **Optimistic append** (already the Phase-1 behavior at `deal/[id].tsx:54-79`): on send,
  append a `kind:'me'` message with a temp id immediately, scroll to end, fire `POST
  /chat/send`; on success reconcile the temp id with the server id, on failure mark the
  bubble as failed with a retry affordance. Keep this — just swap the target from local
  state to the mutation.
- **Retire the canned reply** (`DEAL_CANNED_REPLY`, `demo.ts:391` TODO): replace the 900ms
  timer with a real subscription. A socket layer exists on the frontend side
  (`101lab-2/src/services/socket.ts`) and Node already emits socket events for WTB in-app
  notifications — but **no per-deal room event contract exists**. Until it does, the honest
  interim is **polling** `GET /chat/conversation/:id/messages` (React Query
  `refetchInterval` while the screen is focused), not a fabricated socket API.
- `useSubscription`/Socket.io is the *target* (per hook-point comment) but is an **open
  backend dependency (§11)** — document it, don't pretend it's there.

**States:** loading skeleton thread; empty → seed "Introduced by 101LAB" divider only;
send error → failed bubble + retry; offline → messages queue locally (pending state) and
flush on reconnect (§1.7).

---

## 10 · Real Streaming Chat Surface (the "tell AI" thread)

Beyond the linear home→deal machine, the discovery's AI-chat architecture is a genuine
**streaming conversational surface** (the web `useAIChat` engine). The mobile equivalent is
`chatStore` (§3.3) + `useLabChatStream` (§1.5) rendered as a message list. This is what
powers the Home composer when the user keeps talking rather than taking the linear path,
and it's the substrate the Draft/Published cards actually stream from.

**Composer → stream (mobile port of web `AIChatComposer` + `useAIChat.send`):**

1. Stage files in `composerStore.attachments`; on send, upload via `/gcs/upload`
   (`uploadGcsPhotos`/`uploadGcsDocuments`) → `image_urls`/`document_urls`.
2. `chatStore.appendUser(text, attachments)` + `appendBotShell()` (empty streaming bot msg).
3. Open `useLabChatStream` (detect if attachments, else chat).
4. `token` → `appendTokenToLast`; `data` → `setLastCard` (dispatch by type, §1.5.1);
   `done` → mark `streaming:false`, store `tools`, echo `conversationId` to `sessionStore`;
   `error` → `chatStore.setError(text, retry)`.
5. Cards render with the same taxonomy as the web (product cards → tap to product;
   `wtb_draft` → editable buy card → save turn; `listing_draft` → draft card → publish
   turn; gate → gate CTA).

**Retry:** the `err` message carries `retry:<message>` (web parity) → re-open the same turn.

**One conversation per install** (`sessionStore.conversationId`), reconstructed server-side
from Redis history keyed by `identity:site_type:conversation_id`. No client-side history
persistence beyond the id (the web persists messages in `localStorage`; mobile can add an
MMKV mirror later, but v1 relies on server history + the live `chatStore`).

---

## 11 · Endpoint Summary & Open Backend Dependencies

### 11.1 · Endpoints the lab app calls (all real, from discovery)

| Purpose | Method + path | Auth | Notes |
|---|---|---|---|
| Login | `POST /api/v2/auth/login` | none | tokens → secureStorage |
| Verify session | `GET /api/v2/auth/verify` | Bearer | `agent` role flag |
| Refresh | `POST /api/v2/auth/refresh` | body | interceptor-adjacent |
| Upload files | `POST /api/v1/gcs/upload` | `x-system-key` | reuse `uploadGcsPhotos` |
| Chat stream | `POST /chat/stream` (assistant) | Bearer/refresh | SSE; body `site_type,mode,message` |
| Detect stream | `POST /detect/stream` (assistant) | Bearer/refresh | SSE; attachments path; flag `DETECT_STREAM_ENABLED` |
| List wants | `GET /wtb` (assistant) | Bearer | flag `wtb_enabled` |
| Want matches | `GET /wtb/{id}/matches` (assistant) | Bearer | Matches feed |
| Create want | `POST /wtb` (assistant) | Bearer | buy publish (or via `create_want_to_buy` turn) |
| Product detail | `GET /api/v1/product/detail/:id` or `get_product` turn | none | Match Detail enrichment |
| Deal messages | `GET /api/v1/chat/conversation/:id/messages` | none (body) | generic chat |
| Deal send | `POST /api/v1/chat/send` | none (body) | generic chat |

### 11.2 · Open dependencies (do NOT ship as if these exist)

| Screen | Missing | Interim (honest) | Proper fix |
|---|---|---|---|
| Match Detail | enriched match endpoint + `reasons`/`trust`/`dealId` | compose client-side from match row + `get_product`; derive reasons; static trust | `GET /wtb/matches/{match_id}` returning enriched pair + conversation id |
| Deal Room | per-deal room + concierge role | Node generic chat + client-synthesized concierge/system rows | deal-scoped conversation model with roles |
| Deal Room real-time | per-deal socket event contract | focused polling (`refetchInterval`) | Socket.io room subscription (frontend socket layer exists, protocol doesn't) |
| Feature flags | `wtb_enabled`, `DETECT_STREAM_ENABLED` are **default-OFF** on prod | gate lab reads behind them; graceful empty states when off | enable per rollout |

### 11.3 · Feature-flag gating (mobile side)

Mirror the seller app's build-time flag pattern (`src/lib/flags.ts`,
`smartDetectV2Enabled.ts`). Add:
- `LAB_DETECT_STREAM` → route attachment turns to `/detect/stream` (else `/chat/stream`).
- `LAB_WTB` → enable Matches/My-Wants + buy-mode WTB draft/publish; when off, buy mode
  degrades to search-only and Matches shows the empty state.

Because the backend flags default OFF, **every lab read must degrade gracefully** (empty
state, hidden pill) rather than error when a flagged endpoint 404s.

---

## 12 · Phasing (dependency-ordered)

| Phase | Deliverable | Blocked on |
|---|---|---|
| P0 | Shared data layer: `labQueryKeys`, `useLabChatStream` (port of `smartDetectStream.ts`), `labErrors`, session/chat stores, flag wiring | — |
| P1 | Home pill + Processing stream + Draft(sell)/Published(sell) via `/detect/stream` + `CONFIRM CREATE` | P0; `DETECT_STREAM_ENABLED` on |
| P2 | Buy path: Draft(buy)/Published(buy) via `wtb_draft`/`create_want_to_buy` | P0; `wtb_enabled` on |
| P3 | Matches feed via `GET /wtb` + `/wtb/{id}/matches` (swap `matchesView` source, keep `toMatchVM`) | P2 |
| P4 | Match Detail (composed) | P3 + `get_product` |
| P5 | Deal Room via Node chat + polling; optimistic send | P4 |
| P6 | Real chat surface polish + card taxonomy parity | P0–P2 |
| P7 (backend) | Enriched match endpoint + deal-room model + socket contract | product decision |

---

## Appendix · The Static→Dynamic Swap, in one line per screen

- **Home:** `MATCH_COUNT=3` → `useQuery(labKeys.matchCount())`; copy stays static.
- **Processing:** `PROCESSING_DURATION_MS` timer → `stage`/`detection`/`draft` SSE frames (timer kept as fallback ceiling).
- **Draft:** `DRAFT_DATA[mode]` → `sessionStore.draft` (`listing_draft`) / `sessionStore.wtbDraft` (`wtb_draft`).
- **Published:** `PUBLISHED_DATA[mode]` → `sessionStore.created` / `sessionStore.wtbRequest`.
- **Matches:** `MATCHES` → `useQuery(labKeys.matches())` over `GET /wtb` + `/wtb/{id}/matches`; `toMatchVM` unchanged.
- **Match Detail:** `MATCH_DETAIL_FIXTURE` → `useMatchDetail(id)` (composed from match cache + `get_product`).
- **Deal Room:** `DEAL_ROOM` + `DEAL_CANNED_REPLY` → `useQuery(labKeys.deal/dealMessages)` + `POST /chat/send` + polling (socket later).

In every case the component's input shape is preserved — the swap is a data-source change,
not a JSX change (per the discovery's "mechanical swap points" and the in-code
`FUTURE DYNAMIC HOOK POINT` markers).
