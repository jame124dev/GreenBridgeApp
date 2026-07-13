# 00 — Overview & Target Architecture

> **North-star doc + index** for making the GreenBridge mobile **customer (lab) app** dynamic against the live buyer/seller chat + Want-To-Buy (WTB) + listing system.
>
> **Audience:** the mobile team wiring Phase 2 (dynamic data) on top of the Phase-1 static screens in `GreenBridgeApp/NewVersion/`.
> **Reading order:** start here, then work through `01`–`06` (linked in the [Index](#index)).

---

## 1. Goal

Turn the 101LAB customer app from a **static, demo-fed screen flow** into a **live, streaming, AI-first marketplace client** — driven end-to-end by the same backends the web frontend and the seller app already talk to:

- the **Python AI assistant** (`greenbidz-ai-assistant`, live at `https://ai.greenbidz.com`) over **SSE** (`/chat/stream`, `/detect/stream`), and
- the **Node backend** (`101recycle-greenbidz-backend`, `/api/v1/*`, `/api/v2/*`) for auth, GCS uploads, batches, bids, and product/category reads.

Concretely, "dynamic" means every screen in the Phase-1 flow

```
home → processing → draft → published → matches → match → deal
```

reads **real API responses in the exact TypeScript shapes** the static `demo.ts` module already defines, streams live progress where the backend streams, and turns every user action (send composer, publish, save want, confirm interest, send message) into a **real mutation** against Node or the assistant.

The customer app is the **buyer-and-seller-in-one** surface: a single AI composer with a Sell/Buy toggle. In assistant terms that maps to `mode: "buyer" | "seller"` on every `/chat/stream` turn — the same `mode` plumbing the web chat already uses.

---

## 2. Current State

### 2.1 The customer app is static-complete

Phase 1 is done: every screen renders, animates, and navigates, but reads **read-only demo fixtures** from `/src/features/lab/data/demo.ts` (`ComposerMode`-keyed copy, `MATCHES`, `MATCH_DETAIL_FIXTURE`, `DEAL_ROOM`, etc.). Each screen carries an explicit `// FUTURE DYNAMIC HOOK POINT` comment marking exactly where Phase 2 injects the real call. The demo module is the **swap contract**: real responses must match its shapes so the JSX and view-models stay stable.

| Screen | Route | Static source | Hook point |
|--------|-------|---------------|------------|
| Home (composer) | `app/(lab)/(tabs)/home.tsx` | `COMPOSER_COPY[mode]`, `MATCH_COUNT = 3` | `home.tsx:31-34` → `useQuery(['lab','matchCount'])` |
| Processing | `app/(lab)/processing.tsx` | `PROCESSING_COPY[mode]`, `AUTO_ADVANCE_MS = 2600` | `processing.tsx:17-20` → SSE `stage` events |
| Draft | `app/(lab)/draft.tsx` | `DRAFT_DATA[mode]` | draft payload from detect SSE result |
| Published | (via draft flow) | `PUBLISHED_DATA[mode]` | real match counts from publish response |
| Matches feed | `app/(lab)/(tabs)/matches.tsx` | `MATCHES` → `matchesView.ts:toMatchVM` | `matchesView.ts:12-16` → `useQuery(['matches'])` |
| Match detail | `app/(lab)/match/[id].tsx` | `MATCH_DETAIL_FIXTURE` | `match/[id].tsx:26-30` → `useMatchDetail(id)` |
| Deal room | `app/(lab)/deal/[id].tsx` | `DEAL_ROOM`, `DEAL_CANNED_REPLY` | `deal/[id].tsx:44-49` → `useQuery` + socket |

### 2.2 The seller app already talks to these backends over SSE

The **seller app's smart-detect scanner is a complete, production SSE pipeline** — it is the exact template for the customer data layer, not a thing to reinvent:

- **HTTP client** — `/src/api/greenbidzClient.ts` (axios + `x-platform`/`x-system-key`), `/src/api/interceptors.ts` (Bearer + refresh injection, 401 → `logout()`).
- **Auth store** — `/src/stores/authStore.ts` (Zustand + MMKV + `secureStorage.ts`), carrying `{ id, email, name, role, company }`.
- **React Query** — single shared `queryClient` (`/src/lib/queryClient.ts`, `retry: 2`, `staleTime: 30s`).
- **SSE transport** — `react-native-sse@1.2.1`, driven by `/src/services/scanner/smartDetectStream.ts` and `/src/features/scanner/useSmartDetect.ts`, with a discriminated-union event taxonomy in `/src/features/scanner/smartDetectStreamTypes.ts` and a pure mapper `mapSmartDetection.ts`.
- **Feature flags** — `/src/lib/flags.ts` (`SMART_DETECT_V2_ENABLED`, `USER_TYPE` fork), `smartDetectV2Enabled.ts` (plain function gate).

The seller scanner POSTs to `/wp/analyze-smart-detection-v2` (the Node v2 smart-detect SSE endpoint) via a v2/v1 fallback pattern; the customer app POSTs to the **assistant's** `/chat/stream` and `/detect/stream` using the **same client, auth, and SSE-parsing muscle**.

### 2.3 The backends are already live and battle-tested

- **Assistant** — `/chat/stream` and `/detect/stream` emit `event: <name>\ndata: <json>\n\n` frames (`token`, `data`, `warning`, `done`, `error`, `heartbeat`). Every rich card is a `data` frame `{ type, data }` (product_list, listing_draft, wtb_request, bid_list, …). Mode/site/auth are all request-body/header driven. See **`01-chat-architecture.md`** and **`02-action-component-catalog.md`**.
- **Node** — mobile-facing endpoints exist today: `POST /api/v2/auth/login`, `GET /api/v2/auth/verify`, `POST /api/v2/auth/refresh`, `POST /api/v1/gcs/upload` (system-key gated), `GET /api/v1/batch/fetch`, `POST /api/v1/buyer/bid/place`, product/category reads. WTB REST + notifications live in the Python service and Node's notification bridge.
- **Feature flags** gate everything: `wtb_enabled`, `detect_stream_enabled` (assistant), `VITE_DETECT_STREAM` (web) — the mobile equivalent is a build-time flag in `flags.ts`.

---

## 3. Target Architecture (diagram-in-prose)

```
┌──────────────────────────────────────────────────────────────────────┐
│  GreenBridge Mobile — Customer (lab) app  (Expo Router / RN 0.85)      │
│                                                                        │
│  Screens (app/(lab)/*)  ──read──▶  React Query hooks + Zustand stores  │
│     home / processing / draft / published / matches / match / deal     │
│                              │                                         │
│         ┌────────────────────┼─────────────────────┐                   │
│         ▼                    ▼                     ▼                   │
│   useLabChat (SSE)     useMatches / etc.     useComposer / useLabDraft │
│   (react-native-sse)   (React Query)         (Zustand + MMKV)          │
│         │                    │                                         │
│         └──────── greenbidzClient.ts (axios) + interceptors ───────────┤
│                    Authorization: Bearer <access>                      │
│                    X-Refresh-Token: <refresh>                          │
│                    x-platform / x-system-key (uploads only)            │
└───────────────────────────┬────────────────────────┬──────────────────┘
                            │ SSE + JSON             │ JSON / multipart
                            ▼                        ▼
        ┌───────────────────────────────┐  ┌───────────────────────────────┐
        │  Python AI assistant          │  │  Node backend                 │
        │  ai.greenbidz.com             │  │  /api/v1/* , /api/v2/*        │
        │                               │  │                               │
        │  POST /chat/stream   (SSE)    │  │  /api/v2/auth/{login,verify,  │
        │  POST /detect/stream (SSE)    │  │        refresh}               │
        │  GET/POST/PATCH /wtb  (REST)  │  │  /api/v1/gcs/upload           │
        │                               │  │  /api/v1/batch/fetch          │
        │  Redis session + history      │──│  /api/v1/buyer/bid/place      │
        │  Meilisearch (products+wtb)   │  │  /api/v1/wp/create-product…   │
        │  read-only MySQL gb_ai_ro     │  │  service-JWT for writes       │
        └───────────────┬───────────────┘  └───────────────┬───────────────┘
                        │  service JWT (sub=ai-service)     │
                        └────────────── writes ─────────────┘
                              (Python → Node for listing/batch/bid create,
                               WTB notification delivery)
```

### 3.1 Two backends, clear division of labor

| Concern | Talks to | Transport | Notes |
|---------|----------|-----------|-------|
| Conversational turn (Sell/Buy), tool cards | Assistant `/chat/stream` | SSE | Carries `mode`, `site_type`, `conversation_id`, optional `image_urls`/`document_urls` |
| Image/document listing detection (live draft) | Assistant `/detect/stream` | SSE | Flag-gated (`detect_stream_enabled`); progressive `draft` frames |
| WTB create / list / matches | Assistant `/wtb` REST | JSON | Flag-gated (`wtb_enabled`); also reachable as chat tools |
| Login / session verify / refresh | Node `/api/v2/auth/*` | JSON | Feeds the auth store; `verify` also returns `agent` (AI role) |
| File upload (photos/docs) | Node `/api/v1/gcs/upload` | multipart | `x-system-key` gated; returns HTTPS URLs passed into SSE turns |
| Marketplace reads (batches, product, category) | Node `/api/v1/batch/fetch`, `/api/v1/product/*` | JSON | Public, cacheable |
| Placing a bid | Node `/api/v1/buyer/bid/place` | multipart/JSON | Body-based `buyer_id` |

**Key rule:** the mobile client **never mints service JWTs and never calls Node's write endpoints directly** for listing/batch/bid *creation*. Those writes are owned by the assistant (service-JWT → Node). The mobile app drives them by **sending the right conversational turn** (e.g. `"CONFIRM CREATE"` → assistant `create_listing` tool → Node `/wp/create-product-direct` + `/batch/create`). Mobile calls Node **directly only** for auth, GCS upload, public reads, and buyer bid placement — mirroring the "Which Endpoints Python Calls vs Mobile" split in the Node reference.

### 3.2 Streaming, session, and auth

- **Streaming (SSE).** Both `/chat/stream` and `/detect/stream` emit `event: <name>\ndata: <json>\n\n`. The customer app reuses the seller's `react-native-sse` `addEventListener` pattern (not `onmessage`), a watchdog (~45s, reset on `heartbeat`), and `pollingInterval=0` (no auto-reconnect). Detail: **`01-chat-architecture.md`** + **`02-action-component-catalog.md`**.
- **Session identity.** Conversation continuity is a single opaque `conversation_id` (≤128 chars) per user, persisted locally (the web uses `localStorage` key `gb_ai_conv_id`; mobile mirrors it in MMKV). The assistant keys Redis history on `{identity}:{site_type}:{conversation_id}`; **the client never sends `user_id`** — identity comes from the JWT only.
- **Auth.** `Authorization: Bearer <accessToken>` (15 min) with `X-Refresh-Token: <refreshToken>` (7 day) fallback. Tokens live in `secureStorage.ts`; the interceptor injects them and handles 401 → `logout()`. The assistant verifies HS256, reads `id`/`role` (authV3), and resolves buyer/seller mode from `mode` in the body **or** the JWT `role` claim.

### 3.3 The `.env` fork now, per-user role later

Today the app-shell fork is a **build-time constant** — `USER_TYPE` in `flags.ts` (`'seller'` default vs `'customer'`). That's how we ship the customer app as its own binary/variant immediately. The **conversational** buyer/seller split, however, is a **runtime per-turn `mode`** driven by the composer's Sell/Buy toggle (`useComposer.mode` → request-body `mode`, mapping **`sell`→`seller`, `buy`→`buyer`** at the call-site — see `03-api-contract.md` §1.2; sending raw `sell`/`buy` misroutes). So the migration path is:

- **Now:** `USER_TYPE=customer` selects the lab shell; `mode` toggled per turn in-app.
- **Later:** as the JWT `role` claim becomes authoritative and per-user, the assistant already falls back to `identity["role"]` when no explicit `mode` is sent — so tightening from "env fork + toggle" to "role-driven" requires **no protocol change**, only trusting the JWT.

---

## 4. Guiding Principles

1. **Reuse the seller app's SSE + React Query patterns verbatim.** The customer data layer is not new infrastructure — it is the seller scanner's stack (`greenbidzClient.ts`, `interceptors.ts`, `queryClient.ts`, `react-native-sse`, `useSmartDetect.ts`) pointed at new endpoints. Where the customer flow streams the *same* smart-detect result, reuse `smartDetectStreamTypes.ts` and `mapSmartDetection.ts`; where it streams *chat* (multi-card turns), define a sibling `LabStreamEvent` taxonomy modeled on the same discriminated-union shape.

2. **Every assistant action has a mobile response component.** The web chat proved a strict 1:1 map: each `event: data` frame `type` renders a dedicated card. The mobile app must own the same mapping — a `product_list` frame → a product card list, a `listing_draft` frame → the Draft screen's live-building card, a `wtb_request`/`wtb_matches` frame → the Buy-side match cards, a `listing_gate`/`wtb_gate` → a login/upgrade CTA, an `error` frame → the retry affordance. **No card type ships without its mobile renderer.** The full catalog and mobile mapping live in **`02-action-component-catalog.md`**.

3. **Static-first components stay; only the data source swaps.** The Phase-1 screens, animations, view-models (`matchesView.ts:toMatchVM`), and `demo.ts` **shapes** are the contract. Phase 2 replaces the *body* of each `useX()` (static return → React Query / SSE) and feeds identical shapes back. JSX, styling, and animation recipes (SLIDE-X, POP, RISE, press-scale, haptics) do not change. When a real response shape diverges from `demo.ts`, adapt it in the view-model layer, never in the screen.

4. **`.env` fork now → per-user role later.** Ship the customer variant behind `USER_TYPE=customer`; drive buyer/seller intent per turn via `mode`; leave the door open to make it JWT-`role`-authoritative with zero protocol change (see §3.3).

5. **Feature flags are hard gates, mirrored from the backend.** `wtb_enabled` and `detect_stream_enabled` on the assistant have mobile-side twins in `flags.ts`. WTB cards and detect-streaming must be flag-gated on-device so the app degrades to plain chat when a backend flag is off (exactly as the web `wtbEnabled()`/`detectStreamEnabled()` gates do). Never render a WTB card when the flag is off.

6. **Mobile-UX lens on everything.** Streaming maps to motion: `stage` frames drive the Processing spinner's step checklist; `token` frames drive a typing effect; `draft` frames rebuild the Draft card in place; `heartbeat` is invisible. Latency is covered by React Query `isLoading` skeletons (already scaffolded in `matches.tsx`), the Processing timer as a **fallback ceiling** if the stream stalls, and optimistic sends in the Deal room. Errors surface as inline retry, never a dead screen.

---

## 5. Index

Sibling docs (all in `NewVersion/dynamic/`). Build them in order; each is self-contained but assumes this overview.

| # | File | One-line summary |
|---|------|------------------|
| 00 | `00-overview.md` | **(this doc)** North-star: goal, current state, target architecture, principles, phased plan. |
| 01 | `01-chat-architecture.md` | The as-built chat system the mobile client mirrors: session/mode resolution, send flow, the SSE protocol (event types + payloads) for `/chat/stream` and `/detect/stream`, the tool/agent loop, Redis memory, auth/headers, WTB + handoff, and the mobile reuse map. Also covers the reused data layer (`greenbidzClient`/`interceptors`, secure-storage tokens, `react-native-sse`, `conversation_id` persistence, `site_type` scoping). |
| 02 | `02-action-component-catalog.md` | The full SSE `event: data` → mobile-component map (product_list, listing_draft, wtb_*, bid_list, listing_gate, identify, platform_info, error) with the RN renderer for each, split into shared / buyer / seller sections, plus the mode (Sell/Buy) plumbing from `useComposer`. |
| 03 | `03-api-contract.md` | The copy-pasteable HTTP + SSE wire contract: base URLs (Node vs assistant), the header matrix, `/chat/stream`, `/detect/stream` (Routes A + B), `/gcs/upload`, WTB REST, bids, product/batch fetch + publish, handoff, auth/login, error/watchdog handling, and the config/flag additions. |
| 04 | `04-mobile-integration-plan.md` | Per-screen static→dynamic wiring (home→processing→draft→published→matches→match→deal): feeding endpoint/stream, React Query/SSE data layer, store changes, `demo.ts`→live-payload mapping, and loading/empty/error/offline/optimistic behavior. Honest about the match/deal domain gaps. |
| 05 | `05-mobile-ux.md` | Mobile UX for dynamic: streaming chat UX (typewriter, thinking indicator, live-building draft card), perceived-latency tactics, composer camera/upload progress, deal-room realtime, empty/error/offline states, a11y, reduced-motion + haptics. |
| 06 | `06-roadmap-risks.md` | Phased roadmap (P0–P5), risks & mitigations, the test plan (unit mappers + on-device smoke), the Windows emulator run recipe, and the feature-flag strategy/table. |
| 07 | `07-review-and-hardening.md` | Bulletproof review of 00–06: per-doc verdicts, well-covered list, the 3 confirmed gaps, correctness/UX watch-items, next actions. |
| 08 | `08-hardening-addendum.md` | Build-ready design for the 3 gaps: **Deep Links**, **Push Notifications**, and the **Stream Lifecycle Contract**. |

**Cross-reference to the static specs** (Phase-1 source of truth for layout/animation): `../00-foundation.md` (tokens, recipes), `../01-home-tell-ai.md`, `../02-processing.md`, `../03-draft-review.md`, `../04-published.md`, `../05-matches-feed.md`, `../06-match-detail.md`, `../07-deal-room.md`, `../08-bottom-nav.md`. The `dynamic/` docs describe the **data source swap** only; the static docs remain authoritative for pixels and motion.

---

## 6. Phased Plan at a Glance

Ordered so each phase ships a visibly-more-dynamic app and de-risks the next. Every phase stays behind the relevant flag until verified on a real device.

| Phase | Deliverable | Backends touched | Reuses / creates | Exit criteria |
|-------|-------------|------------------|------------------|---------------|
| **P0 — Data layer** | Point `greenbidzClient` at the assistant + Node; wire login/verify/refresh into `authStore`; confirm `react-native-sse` reaches `/chat/stream`. | Node `/api/v2/auth/*`; assistant `/chat/stream` | Reuse `greenbidzClient.ts`, `interceptors.ts`, `queryClient.ts`, `secureStorage.ts` | Authenticated device can open an SSE stream and receive `token`/`done` frames. |
| **P1 — Chat engine** | Port `useAIChat` → `useLabChat`; plumb `mode` from `useComposer`; persist `conversation_id` in MMKV; render `token` streaming text. | assistant `/chat/stream` | Create `useLabChat`, `LabStreamEvent` types | Sending composer text streams a real assistant reply on-device. Architecture in **`01`**; per-frame components in **`02`**. |
| **P2 — Sell flow** | home→processing→draft→published on real detect SSE; Processing steps from `stage`, Draft from `listing_draft`, publish via `CONFIRM CREATE` → `listing_created`. | assistant `/detect/stream`, `/chat/stream`; Node `/gcs/upload` (+ assistant→Node writes) | Reuse `mapSmartDetection.ts` where shapes align | Real photo → live draft → published listing with real batch id + match count. Covered by **`04`**. |
| **P3 — Buy + WTB** | Buy mode search cards; `draft_want_to_buy`/`create_want_to_buy` with save-once guard; Matches feed + Match detail from real matches. | assistant `/chat/stream`, `/wtb` REST | Reuse `matchesView.ts` view-model | Buyer can save a Want and see real matches in the feed/detail screens. Gated by `wtb_enabled`. Covered by **`05`**. |
| **P4 — Deal room realtime** | Real seed thread + optimistic sends; replace canned-reply timer with socket/poll; handoff to live agent. | Node chat/deal endpoints, `/api/v1/request-handoff` | Create deal socket/poll layer | Two participants exchange real messages; handoff reaches Zoho. Covered by **`06`**. |
| **P5 — Polish + rollout** | Skeletons, error/retry, empty states, reduced-motion, flag cleanup; staff → GA. | all | — | On-device smoke of the full `home→…→deal` flow; flags flipped per environment. |

**Dependency note:** P0 → P1 → P2 is the critical path (chat transport must exist before any flow). P3 (Buy/WTB) can start once P1 lands and `wtb_enabled` is on. P4 is independent of P2/P3 but shares P0's client. P5 is continuous.

---

### Non-negotiables (carry into every sibling doc)

- Never send `user_id` in a request body — identity is JWT-only.
- Always set a valid `site_type` (never `"all"`/`"*"` — the assistant 422s).
- Parse SSE `event:` and `data:` lines separately; handle `token`/`data`/`done`/`error`/`warning`/`heartbeat`.
- Gate WTB and detect-streaming on-device flags mirrored from the backend.
- Keep `demo.ts` shapes as the swap contract; adapt divergence in view-models, not screens.
