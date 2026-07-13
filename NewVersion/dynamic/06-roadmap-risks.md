# 06 — Phased Roadmap, Risks & Testing

**Doc set:** GreenBridge mobile customer app — going dynamic (Phase 2).
**Siblings:** [00-foundation.md](../00-foundation.md) · [01-home-tell-ai.md](../01-home-tell-ai.md) · [02-processing.md](../02-processing.md) · [03-draft-review.md](../03-draft-review.md) · [04-published.md](../04-published.md) · [05-matches-feed.md](../05-matches-feed.md) · [06-match-detail.md](../06-match-detail.md) · [07-deal-room.md](../07-deal-room.md) · [08-bottom-nav.md](../08-bottom-nav.md)
**Dynamic-doc siblings (this folder):** `00-overview.md`, `01-chat-architecture.md`, `02-action-component-catalog.md`, `03-api-contract.md`, `04-mobile-integration-plan.md`, `05-mobile-ux.md` — this doc is the delivery/testing/risk wrapper over all of them.

---

## 0. Framing

The customer Lab app (`app/(lab)/…`) is **statically complete**: every screen renders from `src/features/lab/data/demo.ts` behind explicit `// FUTURE DYNAMIC HOOK POINT` markers. This doc is the delivery plan to swap those static reads for real backend calls, reusing the seller app's already-proven SSE + auth + React Query plumbing wherever possible.

Three anchor principles carry through every phase:

1. **Static shapes are the swap contract.** `demo.ts` TypeScript types (`DraftData`, `MatchCard`, `MatchDetailFixture`, `DealRoom`, …) are frozen. Real API responses get adapted into these shapes by view-model mappers (the `matchesView.ts:toMatchVM` pattern), so JSX never changes when we go dynamic.
2. **The seller app is the template, not a dependency.** We reuse `greenbidzClient`, `interceptors`, `authStore`, `queryClient`, `react-native-sse`, `secureStorage`, and `mmkv`. We do **not** reuse scanner-specific event taxonomies verbatim — the Lab has its own event flows.
3. **Everything ships behind a flag, default OFF, and degrades to the static/demo path** so a broken backend never bricks the app. This mirrors the backend's own `wtb_enabled` / `detect_stream_enabled` gating discipline.

**Stack (locked, per [[feedback_rn_stack_preferences]]):** Zustand (UI/app state) + `@tanstack/react-query` (server state) + MMKV (hot paths) + `expo-secure-store` (tokens only). No RTK. FlashList for lists. Build the end-to-end network/upload/retry pipeline as a first-class concern, not a polish phase.

---

## 1. Phased Roadmap

Phases are **strictly ordered** — each unblocks the next. P0 is pure plumbing (no visible change); P1 is the first user-visible dynamic surface; P5 is the org-model flip that touches everything.

### Phase overview

| Phase | Theme | User-visible? | Blocks |
|-------|-------|---------------|--------|
| **P0** | Data layer + auth + SSE hook | No (plumbing) | everything |
| **P1** | Streaming composer → chat/detect surface | Yes (Home → Processing) | P2 |
| **P2** | detect → draft → publish | Yes (Draft, Published) | P3 |
| **P3** | Matches feed + WTB | Yes (Matches, Match detail) | P4 |
| **P4** | Deal room + human handoff | Yes (Deal Room) | P5 |
| **P5** | Flip `.env` fork → per-user role | No (behavior/routing) | GA |

---

### P0 — Data layer + Auth + SSE hook

**Goal:** all the invisible scaffolding; no screen changes yet. When P0 lands, the app looks identical but has a live authed client, a shared query client, a reusable SSE hook, and flags to gate everything downstream.

**Scope**

- **Config (new — verified absent today):** add `AI_BASE_URL` to `app.config.ts` `extra` (default `https://ai.greenbidz.com`) + surface it via `env.ts` — the assistant surface (`/chat/stream`, `/detect/stream`, `/wtb`) has **no** base URL today (`extra` only has `GREENBIDZ_API_URL`/`X_SYSTEM_KEY`/`WEB_APP_URL`). Also add the lab feature flags to `src/lib/flags.ts` (`LAB_CHAT_ENABLED`, `WTB_ENABLED`, `DETECT_STREAM_ENABLED` — all default-off), following the existing `SMART_DETECT` pattern. These are hard P0 prerequisites; nothing downstream works without them.
- **HTTP client:** reuse `src/api/greenbidzClient.ts` (axios + `x-platform`/`x-system-key`) and `src/api/interceptors.ts` (Bearer + `X-Refresh-Token` inject, 401 → `logout()` + `onUnauthorizedHandler`) **as-is**. Confirm baseURL (`GREENBIDZ_API_URL` from `env.ts`) points at the correct fork target.
- **Auth store:** reuse `src/stores/authStore.ts` (Zustand + MMKV, `profile:{id,email,name,role,company}`, `hydrate()`, `isAuthed()`). Wire the login screen to `POST /api/v2/auth/login` (public) → store `accessToken`/`refreshToken` in `secureStorage`, `user` in the store. Wire `GET /api/v2/auth/verify` on boot to confirm session + surface the `agent` flag.
- **React Query:** reuse the shared `src/lib/queryClient.ts` (`retry:2`, `staleTime:30_000`). No per-app clients.
- **SSE hook (new, the P0 keystone):** build `src/features/lab/hooks/useLabStream.ts` — a generic wrapper over `react-native-sse` modeled on `smartDetectStream.ts` (custom `addEventListener` per event name, **not** `onmessage`; `pollingInterval:0`; watchdog ~45s reset on `heartbeat`; typed `error` with `retriable`). It parses `event:`/`data:` frames and dispatches a typed callback. This one hook backs P1 (chat/detect stream) and P3/P4 reuse its parser.
- **Lab event taxonomy (new):** `src/features/lab/streaming/labStreamTypes.ts` — a discriminated union mirroring the assistant's `/chat/stream` + `/detect/stream` frames: `token`, `data` (with `{type,data}` sub-dispatch — `listing_draft`, `product_list`, `wtb_*`, etc.), `stage`, `product`, `done`, `warning`, `error`, `heartbeat`. **Note:** the AI listing draft is a `data` sub-type (`{type:'listing_draft'}`), **not** a top-level `draft` frame (`chat_adapter.py:203`). Model the shape on the frontend `useAIChat` streamInto parser and the Python SSE catalog, not the scanner's `SmartStreamEvent`.
- **Flags:** add Lab flags to `src/lib/flags.ts` (build-time `EXPO_PUBLIC_*`, inlined at bundle time). See §4 for the full flag table. All default **OFF**.

**Dependencies:** none (foundation). Backend already exposes `/api/v2/auth/*` (public/JWT); assistant `/chat/stream` is live at `https://ai.greenbidz.com`.

**Done-criteria**

- App boots, `authStore.hydrate()` restores a session from MMKV; a cold login round-trips `login` → `verify` and stores tokens in SecureStore.
- A throwaway dev screen can open `useLabStream` against `/chat/stream` and log `token`/`done` frames end-to-end (device or emulator).
- 401 from any authed call triggers the interceptor's logout path (verified by expiring/clobbering the access token).
- All new flags exist and read OFF by default; app behaves exactly as the static build with flags off.

**Mobile-UX note:** P0 must make the **unauthed** path graceful — the Lab Home composer is usable before login (guest can compose); auth is only forced at write/save boundaries (matches the assistant's guest→gate model: guests can search/draft-WTB, cannot publish/save).

---

### P1 — Streaming chat surface (Home → Processing)

**Goal:** the composer Send actually calls the assistant and streams. Home → Processing stops being a 2600ms timer and becomes a live SSE.

**Scope**

- **Send action** (`app/(lab)/(tabs)/home.tsx:73-82`): on Send/chip, capture `{mode,input}` from `useComposer` (`composerStore.ts`), navigate to Processing, and kick a `useLabStream` turn against `POST /chat/stream` with body `{ conversation_id, message, site_type, mode }`. `mode` maps Lab `'sell'|'buy'` → assistant `'seller'|'buyer'` (see §3 mode-misrouting risk — this mapping is load-bearing).
- **Conversation identity:** mint/persist an opaque `conversation_id` (≤128 chars) in MMKV, one per device (mirror the web `gb_ai_conv_id` single-conversation model). Reuse across turns.
- **Processing screen** (`app/(lab)/processing.tsx:17-20`, `:31`): replace the static 3-step copy with **live `stage` events** driving the checklist (`['done','done','active']` becomes per-phase derived). **Keep** the `AUTO_ADVANCE_MS = 2600` timer as a fallback ceiling if the stream stalls (documented intent — do not delete it).
- **Token rendering:** accumulate `token` deltas for the assistant prose; ignore `heartbeat`; on `done` capture `used_tools`; on `error` show a retry affordance (reuse the assistant's `retry`-on-error contract).
- **site_type:** always send a valid value (never `"all"`/`""` → HTTP 422). Default to the fork's site (`labgreenbidz` today). Federation ([5,2,6]) is server-side; the client just passes its own `site_type`.

**Dependencies:** P0 (client, auth, `useLabStream`, flags). Backend `/chat/stream` live.

**Done-criteria**

- Typing "Agilent 1260 HPLC…" and pressing Send streams tokens visible on Processing, then transitions on `done`.
- Stage checklist advances from real `stage` frames; if the stream stalls > timer ceiling, the fallback advance still fires (no dead-end spinner).
- Guest and authed both stream (text turns need no auth); `mode` is correctly plumbed (a Buy-mode turn never returns a seller listing draft — see §3).
- Flag `EXPO_PUBLIC_LAB_CHAT` OFF → Processing falls back to the static timer path unchanged.

**Mobile-UX note:** SSE on flaky mobile networks needs the watchdog + a visible "still working…" state. Never let a stalled socket look like a frozen app — the timer ceiling + a heartbeat-driven "reading your photo…" line keep it honest.

---

### P2 — detect → draft → publish

**Goal:** photo/file turns build a real listing draft live, the Draft screen shows it, and Publish creates a real listing.

**Scope**

- **Upload:** on Send-with-attachments, upload to Node `POST /api/v1/gcs/upload` (multipart, `x-system-key` gated, ≤10 files, JPG/PNG/WEBP + PDF/Office). Reuse the seller GCS session pattern from `useSmartDetect.ts` (upload photos → docs same session → pass URLs on). Returns HTTPS `image_urls`/`document_urls`.
- **Endpoint selection:** if attachments present **and** `EXPO_PUBLIC_LAB_DETECT` on → `POST /detect/stream` with `{ conversation_id, site_type, language, image_urls, document_urls }`; else text-only `/chat/stream`. This mirrors the web `useAIChat` `useDetect` branch.
- **Live draft:** consume `draft`/`listing_draft` frames → replace the draft view-model on each frame (live card build; the shape is byte-compatible with the terminal `result`, so one mapper serves streaming + final). Map into `DraftData` (`demo.ts:107-146`) via a new `draftView.ts` adapter (reuse `mapSmartDetection.ts` field logic: `pickPrice`, `pickAiPrices`, spec extraction).
- **Multi-product:** handle `listing_group_choice` (separate vs combine → `POST /detect/split-products` | `/combine-products`) and `listing_queue` (queue rail). MVP may collapse to single-product (`merged_single`) and defer multi to a P2.5.
- **Edit:** field edits go through `update_listing_draft` (the agent tool via a chat turn) or a `PUT /listing-draft` equivalent; re-render from the returned draft.
- **Publish** (`app/(lab)/draft.tsx` Publish CTA): send `"CONFIRM CREATE"` (confirm-gated write). Handle `listing_gate` frames: `reason:"login"` → auth gate; `reason:"seller_access"` → upgrade gate. On `listing_created` → navigate to Published (`app/(lab)/published.tsx`) with real `product_id`/`name`/matches.
- **Published screen** (`demo.ts:165-193`): real match counts from the publish/create response, not static.

**Dependencies:** P0, P1. Backend: `detect_stream_enabled=True` on the assistant + Node `analyze-smart-detection-v2` reachable; `auth_enabled=True` + `node_base_url` set for writes; seller identity resolvable.

**Done-criteria**

- A photo turn streams a live-building draft card; the Draft screen fills field-by-field.
- Publish with all required fields → `listing_created` → Published shows the real listing; retry with same draft is idempotent (backend hash-dedups; no duplicate row).
- Non-seller/guest publish → correct gate card (never a silent failure). **Test-safety:** local Node writes to the PROD DB ([[project_local_node_writes_prod.md]]) — capture and delete any `product_id` created during publish testing.
- Flag OFF → Draft/Published fall back to `demo.ts`.

**Mobile-UX note:** the confirm-gated write is the app's most dangerous action. The Publish CTA must show an unambiguous confirm state and disable-on-inflight (mirror the WTB create-once guard) so a double-tap can't double-publish.

---

### P3 — Matches + WTB

**Goal:** the Matches feed and Match detail read real data; Buy-mode saves a real Want-To-Buy.

**Scope**

- **Matches feed** (`matches.tsx:22-103`, `matchesView.ts:12-16`): replace the static `useMatches()` body with `useQuery({queryKey:['matches'], queryFn})`, transform via `toMatchVM()` (JSX unchanged). Add skeleton loading, pull-to-refresh (`refetch`), and empty state — all already stubbed in the view-model.
- **Home match pill** (`home.tsx:31-34`): `MATCH_COUNT=3` → `useQuery(['lab','matchCount'])`.
- **Match detail** (`match/[id].tsx:26-30`): `useMatchDetail(id)` (TanStack Query) + loading skeleton + 404 empty state → maps to `MatchDetailFixture` shape.
- **WTB (Buy mode):** wire the buyer demand flow. A Buy-mode compose can produce a `wtb_draft` (via `draft_want_to_buy`) → editable draft card (condition/budget/qty) → Save → `create_want_to_buy` (or REST `POST /wtb`). Reuse the web `saveWant` **create-once guard** (`wtbSavedRef` synchronous check) so a re-render/double-tap can't double-create. Handle `wtb_gate` (`reason:"login"`). "My Wants" list via `list_my_wants` / `GET /wtb`; matches via `get_want_matches` / `GET /wtb/{id}/matches`.
- **Federation:** matches/search federate public sites server-side ([5,2,6]); client passes its `site_type` only.

**Dependencies:** P0–P2. Backend: `wtb_enabled=True` on the assistant (default OFF — currently ON only on prod lab per [[project_wtb_prod_enabled.md]]); WTB matching phases live server-side.

**Done-criteria**

- Matches feed renders from a live query with working skeleton/refresh/empty states.
- Match detail resolves by `id`, shows a 404 empty state for a bad id.
- A Buy-mode Save creates exactly one WTB (verified: rapid double-tap → one row); a guest Save shows the login gate and rolls back so retry works.
- Flag `EXPO_PUBLIC_LAB_WTB` OFF → all WTB branches no-op, feed falls back to `demo.ts`.

**Mobile-UX note:** WTB thresholds are two-tier (retrieval 0.4 / notify 0.8). The in-app match list is intentionally noisier than notifications — surface a "related, not exact" affordance (mirror the web relevance banner) so a 0.4-band match doesn't read as a broken exact-match promise.

---

### P4 — Deal room + human handoff

**Goal:** the Deal Room becomes a real conversation, and "talk to a person" escalates to a live agent.

**Scope**

- **Deal header + thread** (`deal/[id].tsx:44-49`): `useQuery(['deal',id])` (header) + `useQuery(['deal',id,'messages'])` (seed thread), mapped to `DealRoom`/`DealMessage` shapes.
- **Send:** optimistic append on send (keep the existing optimistic UI + scroll-to-end), POST to the deal send endpoint. **Retire** the Phase-1 canned-reply-after-900ms mechanism.
- **Real-time:** subscribe via socket (`useSubscription`/socket.io) for inbound counterparty + concierge events → append to thread. This is the one Lab surface with **no seller-app equivalent** to copy — new build.
- **Human handoff:** wire "Talk to a person" to the assistant `request_handoff` tool (→ Node `POST /api/v1/request-handoff`, Zoho Desk/SalesIQ). Handoff is flag-gated (`zoho_handoff_enabled`) and always returns 200 (skipped when off) — render the returned status/thread in-window (mirror the live-agent handover already LIVE on prod, [[project_handover_live_prod.md]]).

**Dependencies:** P0–P3. Backend: deal endpoints + socket channel (may not exist yet — see §2 risk R7); `zoho_handoff_enabled=True` for handoff.

**Done-criteria**

- Deal Room loads real header + seed messages; a sent message persists and appears on reload.
- An inbound event (concierge/counterparty) arrives via socket without a manual refresh.
- "Talk to a person" produces a real handoff status in-window; with the flag off it degrades to a graceful "we'll email you" message (never an error).
- Flag OFF → Deal Room falls back to the static thread + canned reply.

**Mobile-UX note:** mobile sockets drop on background/foreground and network changes. The thread must reconcile on resume (refetch messages on `AppState` active) so a backgrounded deal doesn't miss messages; optimistic sends must reconcile against server truth to avoid ghost/duplicate bubbles.

---

### P5 — Flip `.env` fork → per-user role

**Goal:** stop hard-forking the app by build (`USER_TYPE` in `flags.ts:38`) and start deriving buyer/seller behavior from the authenticated user's role.

**Scope**

- **Mode source of truth:** today `mode` is a build-time fork and a per-compose toggle. P5 makes the **JWT `role` claim** (from `GET /api/v2/auth/verify` → `agent` + role) the default, matching the assistant's mode-resolution decision tree: explicit request `mode` > identity role > none.
- **Composer toggle stays**, but its default derives from role (seller-role users default Sell; buyer-role default Buy). Guests default per fork/site.
- **Single build, two experiences:** collapse the `USER_TYPE` fork so one binary serves both roles; the Lab shell decides surfaces by role, not by build flag.
- **Tool/surface gating** aligns with the backend: seller-role hides buyer-only surfaces (WTB save on their own listings), buyer-role hides seller-only (received bids). This is server-enforced in tool gating — the client mirrors it for UX only, never as the security boundary.

**Dependencies:** P0–P4 all live and role-tested. `auth_enabled=True` with `jwt_auth_flavor=authV3` (role claim only exists in authV3).

**Done-criteria**

- One build; a seller-role login lands in a seller-defaulted Lab, a buyer-role login in a buyer-defaulted Lab, with no rebuild.
- The compose `mode` still lets either role switch intent per-turn; the value sent to `/chat/stream` matches the resolved role/mode.
- Guest (no role) behaves as neutral (agent decides) and hits gates at write boundaries.
- Removing `USER_TYPE` from `flags.ts` does not change behavior for a logged-in user.

**Mobile-UX note:** role can change mid-session (a buyer upgrades to seller). The app must re-resolve role on `verify`/token-refresh and re-default the composer without forcing a restart, so an in-app seller upgrade immediately unlocks seller surfaces.

---

## 2. Risks & Mitigations

Ranked by likelihood × blast-radius, grounded in the mobile memory gotchas.

| # | Risk | Where it bites | Mitigation |
|---|------|----------------|------------|
| **R1** | **Dev-client rebuild needed for any new native dep** | Any phase that adds a native module (e.g. socket lib with native code in P4, camera in scan). Stale APK → "Cannot find native module" red crash ([[project_stale_dev_client_native.md]]). | Prefer **pure-JS** libs (like `react-native-sse` — no rebuild). `EXPO_PUBLIC_*` flags are inlined at bundle time → **Metro restart, not hot-reload, applies them** ([[project_smart_detect_v2_sse.md]]). Only rebuild (`npx expo run:android`) when a truly native dep changes; batch native additions to minimize rebuilds. Document per-phase whether a rebuild is required (see §3 table). |
| **R2** | **react-native-sse quirks** | P1–P4 streaming. | Use `addEventListener(<name>)` per event, **not** `onmessage` (custom event names). Set `pollingInterval:0` (no auto-reconnect — reconnect logic is ours). Keep a **watchdog** (~45s, reset on `heartbeat`) and a **timer ceiling** so a silent stall never freezes the UI. Parse `event:`/`data:` frames splitting on `\n\n`. Model on `smartDetectStream.ts`. |
| **R3** | **Fast Refresh does not work on the Windows dev setup** | Every JS edit during dev — edits silently don't reach the device (stale bundle looks like "not applied"). | Run Metro with **`CI=1`** (watcher crashes Metro on Windows). The landing recipe: restart Metro → `adb reverse tcp:8081 tcp:8081` → `adb shell am force-stop com.greenbidz.bridge` → relaunch via monkey intent (re-downloads fresh bundle). See §3 emulator recipe. |
| **R4** | **Auth / JWT + CORS** | Login, verify, refresh, GCS upload, all authed calls. | Access token 15m, refresh 7d; interceptor injects `Authorization: Bearer` + `X-Refresh-Token`, 401 → logout. JWT `role` only exists in **authV3** (P5 depends on it). GCS upload is `x-system-key`-gated and posts **direct** (bypasses any proxy) → CORS-checked: the Node CORS allowlist must include the dev origin (bit us before — localhost:8095 missing, [[project_buyer_image_widget_mode.md]]). Emulator hits backend via `adb reverse tcp:4000 tcp:4000`. |
| **R5** | **Redis-down degradation** | Chat history, listing drafts, rate-limit, WTB context. | Backend is **fail-open**: Redis down → chat still streams, history skipped, rate-limit/spend allow. Client must tolerate **contextless multi-turn** (the assistant may "forget" prior turns) — don't assume server-side memory; keep the last draft in MMKV so the user's work survives a contextless turn. Never block the UI on a history-dependent assumption. |
| **R6** | **Mode misrouting** | P1–P3 — a Buy-mode photo returns a seller listing draft. Root cause on web: widget mounted with bare `useAIChat()`, no `mode`; text masked it, images exposed it ([[project_buyer_image_widget_mode.md]]). | **Always** send `mode` on every turn. Map Lab `'sell'|'buy'` → `'seller'|'buyer'` at the single stream call-site; never rely on the agent inferring intent from an image (there's no text to infer from). Make the file-only fallback caption mode-aware. In P5, `mode` derives from role but the per-turn value must still be explicit in the body. |
| **R7** | **Deal-room backend may not exist yet** | P4 — no seller-app equivalent to copy; endpoints/socket may be unbuilt. | Treat P4 as **backend-gated**: keep the static thread behind the flag until the deal endpoints + socket channel ship. Build the client against the documented shapes (`DealRoom`/`DealMessage`) so the swap is mechanical when the backend lands. Do not block P1–P3 on P4. |
| **R8** | **Local backend writes to PROD** | P2 publish, P3 WTB create — "local" Node + GCS are wired to the production DB ([[project_local_node_writes_prod.md]]). | `detect→draft→edit` is safe (CONFIRM CREATE gates the write). For any create test: **capture the `product_id`/WTB id and delete it** after. Prefer the isolated **dev stack** ([[project_dev_ai_stack.md]]: dev Node `:6000` + `dev-ai.greenbidz.com` on `greenbidz_test`) for destructive testing. |
| **R9** | **SSE / proxy 120s timeout wall** | P2 PDF/multi-product scans take 30–90s. | Streaming is the mitigation (dodges the axios/proxy timeout by keeping the connection alive with `heartbeat`); the whole reason v2 exists. Ensure the watchdog > longest expected extraction, and the deadline aligns with the backend's ~120s. |
| **R10** | **site_type validation (HTTP 422)** | Any stream/search call. | Never send `"all"`/`"*"`/`""` — schema-rejected (422). Always a frozen value (`labgreenbidz` for the lab fork). Federation is server-side; client sends its own site only. |

---

## 3. Test Plan

### 3.1 Unit tests (mappers & guards — pure, fast, run in CI)

The mappers are the highest-value unit targets because they're the static↔dynamic swap contract. No device needed.

| Target | What to test | Model on |
|--------|--------------|----------|
| `draftView.ts` (new) | `listing_draft`/`result` → `DraftData`: price coercion (number/string/object → string), tier prices (scrap/used/new), spec extraction (brand/model/year/weight/dimensions/co2/grade), currency fallback USD (TWD override), single-vs-grouped mode derive. | `mapSmartDetection.ts:231-286` (`pickPrice`, `pickAiPrices`) |
| `matchesView.ts:toMatchVM` | API match → `MatchVM`: variant derive (`new-match`/`worth-a-look`), ring fill/track colors from tag/pct, time formatting. | existing `matchesView.ts:51-65` |
| `matchDetailView.ts` (new) | API → `MatchDetailFixture`: confidence ring, WTS/WTB card mapping, reasons, trust chips, `dealId` route. | `demo.ts:311-335` shape |
| `labStreamTypes.ts` parser | SSE frame splitting (`\n\n`), `event:`/`data:` extraction, discriminated dispatch per type, malformed-JSON tolerance (never throw), `heartbeat` ignore, terminal `done`/`error`. | `smartDetectStreamTypes.ts:131-136`, web `streamInto` |
| WTB create-once guard | double-invoke `saveWant(idx)` fires create exactly once; failure rolls back the index for retry. | web `useAIChat.ts:897-935`, `wtb.ts:157-158` |
| mode mapping | `'sell'→'seller'`, `'buy'→'buyer'`; body always contains `mode`; file-only fallback caption is mode-aware. | R6 |
| flag readers | each `labXxxEnabled()` reads its `EXPO_PUBLIC_*` constant; OFF default. | `smartDetectV2Enabled.ts:17` (plain fn, not hook) |

**Tooling:** jest + the existing RN test setup; fixtures = captured real SSE frames per phase (save a `.jsonl` of frames from a live turn as the golden input).

### 3.2 On-device (or emulator) smoke, per phase

Run the phase's happy path plus its one nastiest failure mode on a real device/emulator with the flag ON, then confirm the flag OFF still renders the static build.

| Phase | Smoke |
|-------|-------|
| P0 | Cold login → verify → token in SecureStore; kill token → next authed call 401 → logout. Boot with stored session → hydrated, no re-login. |
| P1 | Send text → tokens stream on Processing → `done` transition. Kill network mid-stream → watchdog/timer ceiling fires (no frozen spinner). Buy-mode turn → not a seller draft (R6). |
| P2 | Photo turn → live draft build → Publish (`CONFIRM CREATE`) → Published with real id. Double-tap Publish → one listing (idempotent). Guest publish → seller_access gate. **Delete the created `product_id`** (R8). |
| P3 | Matches feed live + pull-to-refresh + empty state. Bad match id → 404 empty state. Buy-mode Save → one WTB (rapid double-tap → one row); guest Save → login gate + rollback. |
| P4 | Deal loads real thread; send persists across reload; inbound socket event appears without refresh; background→foreground reconciles (no missed/dup messages). Handoff → in-window status; flag off → graceful email fallback. |
| P5 | Seller-role login → seller-defaulted Lab; buyer-role → buyer-defaulted; per-turn mode toggle still works; in-app role change re-resolves on refresh without restart. |

### 3.3 Emulator / device run recipe (Windows — the load-bearing gotchas)

From [[project_stale_dev_client_native.md]] and [[project_smart_detect_v2_sse.md]]:

```bash
# 1. Metro MUST run with CI=1 (watcher crashes Metro on Windows; also disables Fast Refresh)
#    Set the phase flags here — EXPO_PUBLIC_* is inlined at bundle time, so restart to apply.
CI=1 EXPO_PUBLIC_LAB_CHAT=1 npx expo start --dev-client --port 8081

# 2. Bridge device ports to the machine
adb reverse tcp:8081 tcp:8081     # Metro bundle
adb reverse tcp:4000 tcp:4000     # local Node backend (:4000)  — or :6000 for the dev stack

# 3. Force a fresh bundle download (Fast Refresh does NOT work here — a plain save won't land)
adb shell am force-stop com.greenbidz.bridge
adb shell monkey -p com.greenbidz.bridge -c android.intent.category.LAUNCHER 1
```

Notes:
- **adb** is at `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe` (not on PATH). On Git Bash, `MSYS_NO_PATHCONV=1` before any `/sdcard`-style path.
- **Rebuild only when native changes** (`npx expo run:android`). `react-native-sse` is pure JS → **no rebuild** for any streaming work; a Metro restart is enough.
- Test devices used: Xiaomi/HyperOS (`QSEICYIV49QSWSS8`) — Fabric camera crash reproduces; Realme RMX2151 (`BQCA9TNVEY4PSSSK`) — scan flow worked. Don't assume the Fabric camera bug is universally fixed.
- **CORS for GCS upload:** the emulator's origin must be in the Node CORS allowlist, and the upload posts direct (not via proxy). Add the dev origin locally; **do not commit** that CORS edit unless it's meant for prod (R4).

### 3.4 Which phases need a native rebuild

| Phase | New native dep? | Rebuild? |
|-------|-----------------|----------|
| P0 | none (axios, zustand, react-query, mmkv, secure-store already native-present) | No — Metro restart |
| P1 | `react-native-sse` (pure JS) | **No** |
| P2 | GCS upload (fetch/multipart, JS) | No |
| P3 | none | No |
| P4 | socket lib — **if it has native code (e.g. some socket.io transports), rebuild** | **Maybe** — pick a JS-only transport to avoid it |
| P5 | none | No |

---

## 4. Feature-Flagging Strategy

**Principle:** every dynamic surface is gated, default OFF, and falls back to the `demo.ts` static path. Flags are build-time (`EXPO_PUBLIC_*`, inlined by Expo, read via plain functions like `smartDetectV2Enabled.ts:17` — not hooks, zero runtime cost), consistent with the seller app and the backend's own gating discipline.

### Flag table

| Flag | Gates | Default | Backend counterpart |
|------|-------|---------|---------------------|
| `EXPO_PUBLIC_LAB_CHAT` | P1 streaming composer/Processing | OFF | `/chat/stream` (always live) |
| `EXPO_PUBLIC_LAB_DETECT` | P2 detect→draft (photo/file turns → `/detect/stream`) | OFF | `detect_stream_enabled` (assistant) + `OFFICE_DOCS_ENABLED` (Node) |
| `EXPO_PUBLIC_LAB_PUBLISH` | P2 Publish (CONFIRM CREATE write) | OFF | `auth_enabled` + `node_base_url` |
| `EXPO_PUBLIC_LAB_MATCHES` | P3 Matches feed + match detail (live query) | OFF | — (read endpoints) |
| `EXPO_PUBLIC_LAB_WTB` | P3 Want-To-Buy save/list/matches | OFF | `wtb_enabled` (assistant) |
| `EXPO_PUBLIC_LAB_DEAL` | P4 Deal room live thread + socket | OFF | deal endpoints + socket (R7) |
| `EXPO_PUBLIC_LAB_HANDOFF` | P4 human handoff | OFF | `zoho_handoff_enabled` (assistant + Node) |
| `USER_TYPE` (existing, `flags.ts:38`) | app-shell fork seller/customer | `seller` | — (P5 **removes** this as the fork mechanism) |

**Rules**

1. **OFF = static.** With a flag off, the corresponding screen reads `demo.ts` exactly as the Phase-1 static build. No half-wired states.
2. **Client flag ⊆ backend flag.** Never turn a client flag ON before its backend counterpart is enabled on the target environment — else the endpoint 404s (e.g. `/detect/stream`, `/wtb/*` return 404 when their server flag is off). Match the pairs in the table.
3. **Staged rollout.** Enable per environment: dev stack ([[project_dev_ai_stack.md]]) → 101lab-dev → prod. WTB, for instance, is currently ON only on prod lab as a global flag ([[project_wtb_prod_enabled.md]]) — align the client flag to whatever environment the build points at.
4. **Restart to apply.** `EXPO_PUBLIC_*` is inlined at bundle time — flipping a flag needs a Metro restart + fresh bundle download (R3 recipe), not a hot-reload.
5. **P5 retires `USER_TYPE`** as a build fork: role comes from the JWT (authV3 `role` claim). Keep the flag only long enough to A/B the transition, then delete it (its removal must be a no-op for a logged-in user — a P5 done-criterion).

---

## 5. Cross-References

- Screen specs & static shapes: [01-home-tell-ai.md](../01-home-tell-ai.md), [02-processing.md](../02-processing.md), [03-draft-review.md](../03-draft-review.md), [04-published.md](../04-published.md), [05-matches-feed.md](../05-matches-feed.md), [06-match-detail.md](../06-match-detail.md), [07-deal-room.md](../07-deal-room.md), [08-bottom-nav.md](../08-bottom-nav.md).
- Foundation (tokens, stack, patterns): [00-foundation.md](../00-foundation.md).
- Sibling dynamic docs (this folder): data layer, auth/session, streaming chat, detect/publish, matches/WTB — this doc is the delivery/testing/risk wrapper over all of them.
