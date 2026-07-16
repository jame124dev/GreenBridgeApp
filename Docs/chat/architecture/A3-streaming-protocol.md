# A3 — Streaming Protocol

| | |
|---|---|
| **Doc ID** | A3 |
| **Layer** | Architecture (root contract) |
| **Status** | Draft — revised, awaiting review |
| **Version** | 0.2.0 |
| **Protocol version** | `x-chat-protocol: 1` |
| **Owners** | Chat Platform |
| **Depends on** | — (root; depends on no other spec) |
| **Depended on by** | A2 (State), A4 (Components), F2/F3/F4/F7 (rendering), X3 (Performance), X5 (Analytics) |
| **Reference implementation** | `src/features/lab/streaming/labStream.ts`, `labStreamTypes.ts`, `stores/threadStore.ts`, `hooks/useLabTurn.ts` |

> **Normative language.** MUST, MUST NOT, SHOULD, SHOULD NOT, MAY per RFC 2119.
>
> **Maturity tags.** Every contract clause is tagged:
> **`[Impl]`** shipped in the reference code · **`[v1]`** required by protocol 1, not yet
> implemented (client and/or server work item) · **`[Legacy]`** transitional compatibility that
> the future protocol removes.
>
> **Changelog.** 0.2.0 — true cancellation, partial-response policy, error normalization + legacy
> layer, protocol versioning, advertised heartbeat, naming normalization (`current`), full state
> machine, Protocol Guarantees, Protocol Principles, self-review. 0.1.0 — initial contract.

---

## 1. Purpose

Define the contract between the GreenBridge client and the AI Assistant streaming endpoints, and
the client-side transport guarantees on top of it. This is the single source of truth for:

- protocol **versioning and negotiation**;
- what the client sends to open an AI turn;
- every event the client understands and their **ordering + terminal** semantics;
- **cancellation** semantics (generation, tools, billing, conversation validity);
- **partial-response** policy on interruption;
- the **error taxonomy** and its normalization;
- the **heartbeat/liveness** contract;
- the typed event union every downstream consumer binds to.

If the wire format changes, it changes **here first**, with a version bump. Every other document
treats this contract as fixed.

## 2. Scope

**In scope:** the logical event protocol (events, state machine, guarantees), its current SSE
transport binding, request construction, versioning/negotiation, cancellation, partial-response,
error taxonomy, heartbeat, and the typed union + transport API.

**Out of scope (owned elsewhere):** how frames mutate UI state → **A2**; how cards/tokens render →
**F3/F7**; server-internal pipeline, model selection, spend caps; non-streaming REST.

## 3. Protocol Principles

The protocol is designed to be, in priority order:

1. **Deterministic.** Given the same ordered frame sequence, the client MUST reach the same final
   state. The reducer is pure; there is no hidden timing dependence in the contract.
2. **Resilient to partial failure.** Meaningful generated content is never silently lost. Failure
   is a first-class outcome with a defined commit + retry path, not an exception.
3. **Cancellation-aware.** Stopping is an explicit, well-defined protocol event with guarantees
   about generation, tool execution, billing, and conversation validity — not merely a dropped
   socket.
4. **Forward compatible.** New events, card types, phases, and fields are additive and non-breaking;
   consumers ignore what they don't understand.
5. **Backward compatible (bounded).** The client tolerates specified legacy shapes for a defined
   window, documented explicitly as legacy — not as protocol.
6. **Observable.** The frame stream is the audit log of a turn. Every state transition is
   attributable to a frame (or a defined transport condition).
7. **Transport-agnostic (logical layer).** The event contract, state machine, and guarantees are
   independent of SSE. SSE is the current *binding* (§10.12); a future WebSocket/gRPC binding MUST
   preserve the logical contract unchanged.
8. **Resumable (target).** The design admits resuming an interrupted turn (frame ids +
   `Last-Event-ID`) without contract breakage — see §14.

## 4. Responsibilities

The transport layer (`labStream`) is responsible for, and ONLY for:

1. Negotiating protocol version and opening exactly one connection per turn to the correct endpoint.
2. Attaching authentication at open (the SSE client bypasses the axios interceptor).
3. Parsing each frame into a typed `LabStreamEvent` and forwarding it to a sink.
4. Enforcing terminal semantics — resolve on `done`, reject on fatal error/transport failure/
   watchdog, settle on cancellation — **exactly once**.
5. Classifying failures into the stable error taxonomy (`code` + `retriable`).
6. Deriving the liveness watchdog from the advertised heartbeat and tearing down all resources on
   every terminal path.

It is NOT responsible for interpreting card payloads, accumulating prose, retry UX, persistence,
or anything React.

## 5. Non-goals

- Automatic reconnect of a live turn (one-shot; resumption is a future extension).
- Frame de-duplication or reordering (applied in arrival order).
- Persistence (A5).
- Defining the server pipeline.

## 6. Dependencies

| Dependency | Why | Notes |
|---|---|---|
| `react-native-sse` (`RNEventSource`) | POST-capable SSE binding | Custom `addEventListener('<name>')`, not `onmessage`. |
| `AI_BASE_URL` | Endpoint host | Environment-scoped. |
| Secure storage (`auth.accessToken`/`auth.refreshToken`) | Auth headers | Read at open. |
| `sessionStore.getConversationId()` | Continuity + cancel target | Persisted; identity is JWT-derived. |

The transport core has **no UI-framework dependency** and MUST stay that way — it is what makes
the reveal/parse performance (A2/F3) and unit-testing (injected `eventSourceFactory`) possible.

---

## 7. Architecture

### 7.1 Layered view

```
┌──────────────────────────────────────────────────────────────┐
│ UI (F2/F3/F7)          renders turn.{text,cards,phase,status}  │
├──────────────────────────────────────────────────────────────┤
│ State (A2)             reducer: applyFrame(LabStreamEvent)     │
├──────────────────────────────────────────────────────────────┤
│ Orchestration          useChatController: body, upload, route, │
│                        single-flight, cancel                   │
├──────────────────────────────────────────────────────────────┤
│ Transport binding      labStream(): SSE open/parse/settle,     │  ← SSE binding
│ (§10.12)               watchdog, error taxonomy                │
├──────────────────────────────────────────────────────────────┤
│ LOGICAL PROTOCOL       events · state machine · guarantees     │  ← THIS DOC (transport-agnostic)
├──────────────────────────────────────────────────────────────┤
│ Wire                   POST SSE  /chat/stream | /detect/stream │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Protocol State Machine

The **logical** turn lifecycle. Each transition is labelled with the triggering protocol event or
transport condition. Terminal states are double-bordered `‖`.

```
                          user send
        ┌──── IDLE ──────────────────────► CONNECTING
        │       ▲                              │  │
        │       │ commit + reset               │  │ open error / HTTP 4xx·5xx
        │       │                              │  ▼
        │       │                  sse 'open'  │  ‖FAILED‖ ◄──────────────┐
        │       │                              │      ▲                    │
        │       │                              ▼      │ err/timeout        │
        │       │                          CONNECTED  │ BEFORE content     │
        │       │                              │      │                    │
        │       │                stage (no content)   │                    │
        │       │                              ▼      │                    │
        │       │                          THINKING ──┤                    │
        │       │                              │      │                    │
        │       │            first token/data  │      │                    │
        │       │                              ▼      │                    │
        │       │        ┌───────────────► STREAMING ─┘                    │
        │       │        │  token/data/stage    │                          │
        │       │        └──────(self)──────────┤                          │
        │       │                               │                          │
        │       │   done                        │  err/timeout/transport   │
        │       │◄────────────► ‖COMPLETED‖     │  AFTER content           │
        │       │                               ▼                          │
        │       │                          ‖INTERRUPTED‖ (commit partial)──┤ Retry
        │       │                                                           │ (new turn,
        │       │   client abort BEFORE content                            │  same
        │       └────────────── ‖CANCELLED_EMPTY‖ (discard)                 │  conversation_id)
        │                                                                   │
        │           client abort AFTER content                             │
        └──────────────────── ‖STOPPED‖ (commit partial, no error) ────────┘
```

**State → `turn.status` mapping** (A2 stores the coarse status; the protocol distinguishes more):

| Protocol state | `turn.status` | Completion reason | Committed message? |
|---|---|---|---|
| CONNECTING / CONNECTED / THINKING / STREAMING | `streaming` | — | no (in-flight) |
| COMPLETED | `done` | `complete` | yes |
| STOPPED | `done` | `stopped` | yes (partial, no error UI) |
| INTERRUPTED | `error` | `interrupted` | yes (partial) + **Retry** |
| FAILED | `error` | `failed` | no content + **Retry** |
| CANCELLED_EMPTY | `idle` (reset) | `cancelled` | no |

"**Meaningful content**" (the INTERRUPTED-vs-FAILED and STOPPED-vs-CANCELLED_EMPTY discriminator)
is defined as: **≥1 `token` with non-empty cumulative text OR ≥1 `data` card**. This predicate is
normative (§10.9) and owned by A2 for storage.

---

## 8. Data flow — one turn

```
User sends
  │  useChatController: (attachments) upload GCS; route endpoint; build body
  ▼
labStream(endpoint, body, signal, onEvent)   header: x-chat-protocol: 1
  │  read auth → headers; open POST SSE; await advertised heartbeat → size watchdog
  ▼
── frame loop (each frame re-arms watchdog) ─────────────────────────────
  ready{protocol,heartbeat_ms}  → negotiate + size watchdog        [v1]
  stage{phase,current}          → turn.phase
  token{delta}                  → turn.text += delta   (append-only, many)
  data{type,data}               → turn.cards (latest-wins for singletons)
  warning{...}                  → non-blocking notice (no status change)
  heartbeat{ts}                 → watchdog reset ONLY (never forwarded)
─────────────────────────────────────────────────────────────────────────
  done{used_tools,conversation_id}  → status done → resolve
  | error{...}                      → status error → reject (taxonomy)
  | (client abort)                  → cancellation (§10.7)
  │
  ▼
useChatController commits per completion reason (§10.9) → messages[] (A2)
```

Ordering is defined normatively in §11 (G1). Beyond "`done`/`error` is last," consumers MUST NOT
assume an order between `stage`/`data`/`token`.

---

## 9. (reserved — merged into §10/§11)

---

## 10. Public contracts

### 10.1 Protocol versioning & negotiation `[v1]`

- The client MUST send `x-chat-protocol: <major>` on every request (currently `1`), declaring the
  **maximum** major it supports.
- The server MUST reply with the negotiated major, via **both** a response header
  `x-chat-protocol` and the opening `ready` frame's `protocol` field (whichever the client observes
  first wins). The negotiated version is `min(client_max, server_max)`.
- **Legacy fallback `[Legacy]`:** if neither the header nor a `ready` frame is present, the client
  MUST assume **protocol 0** and enable the legacy compatibility layer (tri-key errors §10.8,
  `cur` spelling §10.5, fixed-45s watchdog §10.6, no cancellation guarantees §10.7).
- **Compatibility policy:** within one major, additions (new events/cards/phases/fields) are
  non-breaking and require no negotiation. Removing/renaming a field, changing a terminal rule, or
  changing an existing field's meaning is **breaking** → new major → negotiation. The client MUST
  remain functional against a protocol-0 (unversioned) server for at least two client releases.

### 10.2 Request contract

**Endpoints** (both on `AI_BASE_URL`, `POST`, `Accept: text/event-stream`): `[Impl]`

| Endpoint | When | Purpose |
|---|---|---|
| `/detect/stream` | SELL **and** attachments **and** `DETECT_STREAM_ENABLED` | Seller listing-detect; always emits `listing_draft`. |
| `/chat/stream` | all other turns (incl. buyer attachments) | Agent reasoning + tools; mode-aware. |

> **Routing invariant (MUST) `[Impl]`:** buyer-mode attachments MUST route to `/chat/stream`.
> `/detect/stream` returns a seller draft regardless of mode — routing buyer images there is a
> known past defect and MUST NOT recur.

**Headers:**

| Header | Value | Maturity |
|---|---|---|
| `Accept` | `text/event-stream` | `[Impl]` MUST |
| `Content-Type` | `application/json` | `[Impl]` MUST |
| `x-platform` | `LabGreenbidz` | `[Impl]` MUST |
| `x-chat-protocol` | `1` | `[v1]` MUST |
| `Authorization` | `Bearer <accessToken>` | `[Impl]` if present |
| `x-refresh-token` | `<refreshToken>` | `[Impl]` if present |
| `x-system-key` | — | `[Impl]` MUST NOT send (leaks key; unused) |

**Body** (verbatim; caller owns `mode` mapping + `site_type`): `[Impl]`

| Field | Type | Endpoint | Notes |
|---|---|---|---|
| `conversation_id` | string | both | From `sessionStore`; continuity + cancel target. Not the user id. |
| `site_type` | `"labgreenbidz"` | both | Fixed (site 2). |
| `mode` | `"seller" \| "buyer"` | both | Mapped from UI `sell\|buy`; raw values rejected. |
| `language` | `en\|zh-hant\|zh-hans\|ja\|th\|vi` | both | Lowercase i18n code. |
| `message` | string | `/chat/stream` | User text. |
| `image_urls` / `document_urls` | string[] | both | Only when uploaded. |

### 10.3 Frame catalog (normative)

Each frame's `data` is a JSON string parsed by the transport. An unparseable **non-terminal**
frame MUST be skipped (not fatal); an **unknown named** frame MUST be ignored (forward-compat).

| Event | Terminal? | Payload | Effect | Maturity |
|---|---|---|---|---|
| `ready` | no | `{ protocol: number, heartbeat_ms: number }` | Negotiate version; size watchdog. | `[v1]` |
| `stage` | no | `{ phase, message?, total?, current?, ts? }` | Set `turn.phase`. Key is **`phase`**. | `[Impl]` |
| `token` | no | `{ delta: string }` | Append to `turn.text`. | `[Impl]` |
| `data` | no | `{ type, data, identified?, match_count? }` | Add/replace card (10.4). | `[Impl]` |
| `warning` | no | `{ code?, message?, ... }` | No status change; MAY surface notice. | `[Impl]` |
| `heartbeat` | no | `{ ts: number }` | Watchdog reset ONLY; MUST NOT forward. | `[Impl]` |
| `done` | **yes** | `{ used_tools?, conversation_id?, ... }` | `status='done'`; resolve. | `[Impl]` |
| `error` | **yes**¹ | `{ detail?, code?, retriable?, fatal?, ... }` | `status='error'`; reject. | `[Impl]` |

¹ terminal unless `fatal === false`.

### 10.4 `data` card semantics `[Impl]`

- `data.type` selects the renderer (F7); `data.data` is opaque. `LabCardType` is **open** —
  unknown types MUST forward untyped and be ignored by the dispatcher.
- **Latest-wins singletons** (new frame REPLACES prior same-type in place): `listing_draft`,
  `listing_entry_options`, `listing_queue`, `wtb_draft`. All others append in arrival order.
- **Draft mirroring:** `listing_draft` (sell) and `wtb_draft` (buy) mirror into `turn.draft`
  (latest wins). `data{listing_draft}` is canonical even if a cumulative top-level `draft` also
  arrives.

### 10.5 Stage phases & naming normalization

`LabStagePhase` (open): `validating`, `preparing_documents`, `ai_running`,
`extracting_products`, `done`. New phases MUST be tolerated, never errored.

**Index field naming `[v1]`:** the canonical field is **`current`** (with `total`). The client
MUST read `current ?? cur` during the transition. `cur` is **`[Legacy]`** and MUST be removed
server-side in protocol 1; `preparing_pdfs` remains a legacy alias of `preparing_documents`.

### 10.6 Heartbeat contract

- The server SHOULD emit `heartbeat` frames at a fixed interval and advertise that interval via
  the `ready` frame's `heartbeat_ms` (and/or `x-chat-heartbeat-ms` header). `[v1]`
- The client MUST derive its liveness watchdog as **`max(WATCHDOG_FLOOR, N × heartbeat_ms)`** with
  `N = 4` and `WATCHDOG_FLOOR = 15_000` ms. `[v1]`
- **Legacy fallback `[Legacy]`:** if no interval is advertised, the watchdog defaults to
  **45_000 ms** (current behavior).
- Every received frame re-arms the watchdog. `heartbeat` MUST NOT be forwarded to `onEvent`
  (pure liveness). Watchdog expiry → `connection_lost` (retriable).

### 10.7 Cancellation contract (Approved decision #1) `[v1]`

Cancellation is a **first-class protocol operation**, not a bare disconnect.

**Client obligations (MUST):**
- Initiate cancellation by aborting the turn's `AbortSignal`, which closes the connection.
- Additionally issue an explicit cancel signal **`POST /chat/{conversation_id}/cancel`** so
  cancellation is reliable even when proxy/infra buffering delays server-side disconnect detection.
  `[v1]` (Disconnect alone is the `[Legacy]` fallback.)
- Treat connection close following an abort as a **clean cancellation** (`code: 'cancelled'`) and
  MUST NOT render it as an error (§10.9, STOPPED/CANCELLED_EMPTY).

**Server obligations (MUST), upon abort/cancel:**
- Stop LLM token generation **immediately**.
- Cancel any in-flight tool execution.
- Stop billing/token consumption **wherever the model provider supports mid-request cancellation**
  (SHOULD; provider-dependent — see §16 risks).
- Emit **no further stream frames** for the turn.
- Leave the conversation in a **valid, resumable state** (a subsequent turn on the same
  `conversation_id` MUST work).

**Guarantee:** after a client abort, the turn reaches exactly one terminal outcome (STOPPED if
meaningful content was already received, else CANCELLED_EMPTY) and the conversation remains valid.

### 10.8 Error taxonomy & normalization (Approved decision #3)

The transport produces `LabStreamError { message, code, retriable }` for every rejection.

**Canonical error frame (protocol 1) `[v1]`:** `{ "detail": "...", "code"?, "retriable"?, "fatal"? }`.
The server MUST emit the human-readable message under **`detail`**.

**Legacy compatibility layer `[Legacy]` (NOT part of the future protocol):** the client MUST
resolve the message as **`detail || error || message`** for protocol-0 servers. This layer exists
only to tolerate the historical inconsistency and is slated for removal once all servers emit
`detail`. It MUST be clearly isolated in code (a single `normalizeErrorMessage()` helper), not
scattered.

**Failure-source mapping** (all collapse into the taxonomy) `[Impl]`:

| Source | `code` | `retriable` |
|---|---|---|
| Backend `error` frame | `payload.code` ?? `error` | `payload.retriable` |
| HTTP 429 | `too_many_concurrent` | true |
| HTTP 503 | `spend_cap_exceeded` | true |
| HTTP ≥500 | `http_<status>` | true |
| HTTP other | `http_<status>` | false |
| No status | `connection_lost` | true |
| Transport `timeout` | `timeout` | true |
| Transport `exception` | `exception` | true |
| Watchdog trip | `connection_lost` | true |
| Client abort | `cancelled` | false (not an error — §10.7) |

`error` with `fatal === false` is **non-terminal** — the client keeps waiting.

### 10.9 Partial-response policy (Approved decision #2)

Meaningful generated content MUST NOT be discarded. On turn termination, the completion reason and
commit behavior are:

| Termination | Meaningful content? | Reason | Commit | UI |
|---|---|---|---|---|
| `done` | — | `complete` | full message | normal |
| network loss / timeout / transport / server failure | **yes** | `interrupted` | **partial message** | interrupted badge + **Retry** |
| network loss / timeout / transport / server failure | no | `failed` | none | error + **Retry** |
| user abort | **yes** | `stopped` | **partial message** | "stopped" (no error styling); MAY offer Retry |
| user abort | no | `cancelled` | none | silent; return to idle |

The committed message carries its `reason`. **A2 owns the message model + storage**; this table is
the normative source for *which* reason applies. Retry opens a **new turn** on the same
`conversation_id` (§11 G11).

### 10.10 Canonical typed union

```ts
type LabStreamEvent =
  | { type: 'ready';     data: { protocol: number; heartbeat_ms: number } }  // [v1]
  | { type: 'token';     delta: string }
  | { type: 'data';      data: LabDataEvent }
  | { type: 'stage';     data: LabStageEvent }   // { phase, current?, total?, message?, ts? }
  | { type: 'done';      data: LabDoneEvent }
  | { type: 'warning';   data: LabWarningEvent }
  | { type: 'error';     data: LabErrorEvent }   // canonical: { detail, ... }
  | { type: 'heartbeat'; data: LabHeartbeatEvent };
```

Consumers MUST switch on `type` with a `default` no-op branch (forward-compat). Adding a frame type
is a minor bump here + a default-safe branch downstream — never a breaking change.

### 10.11 Transport public API

```ts
function labStream(opts: {
  endpoint: '/chat/stream' | '/detect/stream';
  body: Record<string, unknown>;
  onEvent?: (e: LabStreamEvent) => void;
  signal?: AbortSignal;               // abort → cancellation (§10.7)
  eventSourceFactory?: SseFactory;    // test seam
  watchdogMs?: number;                // override; else derived from advertised heartbeat (§10.6)
}): Promise<{ conversationId?: string; usedTools: string[] }>;
```

**Guarantees (MUST):** resolve on `done`; reject on fatal error / transport failure / watchdog;
settle on cancellation — **exactly once**; late frames after settle dropped; full teardown on every
terminal path; a throwing `onEvent` MUST NOT poison the run; abort registered before open with a
synchronous re-check.

### 10.12 SSE transport binding (informative)

The current binding uses `react-native-sse` POST streaming with `pollingInterval: 0` (no
auto-reconnect), custom `addEventListener('<name>')` per event in `LAB_STREAM_EVENT_NAMES`, and the
`error` channel disambiguated by `typeof ev.data === 'string'` (backend error frame) vs. transport
error (`xhrStatus`). A future WebSocket/gRPC binding MUST preserve §10.3/§10.10/§11 unchanged.

---

## 11. Protocol Guarantees (normative invariants)

- **G1 — Frame ordering.** Within a turn, `token` frames MUST arrive in generation order and be
  applied append-only. `done`/`error` MUST be the last frame. No ordering is guaranteed among
  `stage`/`data`/`token`; the client MUST apply in arrival order.
- **G2 — Exactly one terminal.** A turn MUST resolve to exactly one terminal outcome
  (COMPLETED XOR STOPPED XOR INTERRUPTED XOR FAILED XOR CANCELLED_EMPTY). The server MUST emit at
  most one terminal frame; the client MUST settle exactly once and drop post-terminal frames.
- **G3 — Append-only streaming.** `token.delta` MUST only append. The server MUST NOT retract or
  rewrite previously sent text within a turn.
- **G4 — Singleton replacement.** For latest-wins card types (§10.4), a new frame MUST replace the
  prior same-type card in place; all other card types MUST append. The server MAY re-emit
  singletons freely.
- **G5 — Unknown-event handling.** The client MUST ignore unknown named frames and unknown card
  types and MUST NOT error or terminate on them.
- **G6 — Backward compatibility.** The client MUST accept documented legacy shapes (tri-key error
  message; `cur`; absent versioning/heartbeat) for the compatibility window; these are isolated and
  removable.
- **G7 — Forward compatibility.** Adding events, card types, phases, or optional fields MUST be
  non-breaking. Removing/renaming/redefining an existing field MUST bump the major version and
  requires negotiation.
- **G8 — Heartbeat.** The server SHOULD emit heartbeats at the advertised interval; the client
  watchdog MUST derive from it (§10.6); `heartbeat` MUST NOT reach the UI; expiry MUST yield a
  retriable `connection_lost`.
- **G9 — Cancellation.** On client abort the server MUST stop generation, cancel tools, emit no
  further frames, and keep the conversation valid; billing SHOULD stop where the provider supports
  it. The client MUST treat post-abort close as clean cancellation (§10.7).
- **G10 — Partial preservation.** Meaningful content MUST NOT be discarded on failure; it MUST be
  committed as `interrupted` with Retry, or `stopped` on user abort (§10.9).
- **G11 — Continuity.** Thread continuity is by `conversation_id`. Retry MUST open a new turn on the
  same `conversation_id`. Single-flight: opening a turn MUST abort any in-flight turn first.
- **G12 — Determinism.** Given the same ordered frame sequence, the client MUST reach the same final
  state (pure reducer; no timing dependence in the contract).

---

## 12. Acceptance criteria

Each maps to a P1 test.

- [ ] **Versioning:** request carries `x-chat-protocol: 1`; negotiated version taken from `ready`
      /header; absent → protocol-0 legacy path engaged.
- [ ] **Routing:** SELL+attachments+flag → `/detect/stream`; buyer attachments & text-only →
      `/chat/stream`.
- [ ] **Headers/body:** as §10.2; `x-system-key` never sent.
- [ ] **Frame parsing:** `ready` negotiates+sizes watchdog; `token` appends; `data` add/replace per
      singleton set; `stage` sets `phase`, reads `current ?? cur`; `warning` no-ops; `heartbeat`
      never forwarded.
- [ ] **Terminal (G2):** `done` resolves once; a second terminal frame is ignored.
- [ ] **Error normalization:** protocol-1 `detail` read; legacy `error`/`message` still resolved
      via the isolated helper; `fatal:false` keeps stream open; taxonomy mapping correct.
- [ ] **Heartbeat watchdog:** derived `max(15s, 4×heartbeat_ms)`; legacy default 45s; a heartbeat
      before the deadline prevents the trip.
- [ ] **Cancellation (G9):** abort → `POST …/cancel` issued; no error surfaced; no leaked
      listeners/timers; a subsequent turn on the same conversation succeeds.
- [ ] **Partial policy (G10):** failure after content → `interrupted` commit + Retry; failure with
      no content → `failed`; user abort after content → `stopped` commit; abort before content →
      `cancelled` discard.
- [ ] **Single-flight (G11):** starting a turn aborts the previous.
- [ ] **Append-only (G3) & determinism (G12):** replaying a recorded frame log yields identical
      final state; no token retraction observed.
- [ ] **Handler isolation:** a throwing `onEvent` does not reject the stream.

---

## 13. (reserved)

---

## 14. Future extensibility

Addable as minor, backward-compatible changes:

1. **Resumable streams.** Server frame ids + `Last-Event-ID` + `turn_id` to resume an INTERRUPTED
   turn instead of retrying from scratch. Relaxes the no-reconnect non-goal behind a flag.
2. **`turn_id`.** Per-turn identifier for precise cancel targeting and future multiplexed
   conversations (today single-flight makes `conversation_id` a sufficient cancel target).
3. **Tool-transparency frames.** A `tool` event (`{name, status}`) for inline "searching…/reading…"
   progress, richer than post-hoc `used_tools`.
4. **Structured citations.** Promote `used_tools` into a typed `sources` payload (url/title).
5. **Alternate transport binding.** WebSocket/gRPC binding preserving §10.3/§10.10/§11.
6. **New card types & phases.** Already supported by open unions — renderer only, no contract change.

---

## 15. Open questions (for review)

1. **Explicit cancel endpoint shape.** `POST /chat/{conversation_id}/cancel` vs. a `turn_id`-scoped
   endpoint. Recommend conversation-scoped now (single-flight), turn-scoped when multiplexing lands.
2. **Provider billing-stop coverage.** Which LLM provider(s) back `/chat/stream`, and do they
   support mid-request cancellation that actually stops billing? Determines whether G9's billing
   clause is MUST or SHOULD per provider. (Currently SHOULD — provider-dependent.)
3. **`ready` frame vs. header for negotiation.** Ship both, or pick one? Recommend both initially
   (header for pre-first-frame sizing, `ready` for in-band record), collapse later.
4. **Compatibility-window length.** How many releases must the client keep the legacy error/`cur`
   layer? Recommend ≥2 client releases after all servers emit protocol 1.

---

## 16. Self-review

### 16.1 Assumptions
- **Server implements cancellation (G9).** The mobile code can only *initiate* abort; "stop
  generation/tools/billing, emit no more frames, stay valid" is a **server work item** assumed, not
  verified. `[v1]`
- **Server will advertise heartbeat and protocol** (`ready` frame / headers). Not yet implemented on
  either side.
- **The LLM provider supports mid-generation cancellation** with billing stop. Provider-dependent;
  assumed best-effort.
- **Single active turn per conversation** (single-flight) — makes `conversation_id` a valid cancel
  target and lets us defer `turn_id`.
- **`data.data` payloads are opaque to this layer** — their schemas live with F7/card owners.

### 16.2 Remaining risks
- **Cancellation latency via disconnect-only.** Proxies/load-balancers may buffer or delay
  disconnect detection, so pure socket-close cancellation is not guaranteed "immediate." Mitigation:
  the explicit cancel endpoint (§10.7) — but that adds a coordinated client+server rollout.
- **Billing-stop not universally guaranteed.** Some providers bill the full completion once started;
  G9's billing clause is therefore SHOULD, and real savings depend on §15 Q2.
- **Coordinated rollout hazard.** `ready`/versioning/cancel endpoint require server + client to ship
  together; the legacy fallback (§10.1) is what keeps a version-skewed client working — it MUST be
  tested, not assumed.
- **"Meaningful content" is a heuristic.** A turn that emits only a `stage`/`warning` then fails
  commits nothing (FAILED) even though the user saw a phase label — acceptable, but a product call.
- **Watchdog derived from advertised heartbeat** trusts the server's number; a misreported tiny
  interval could make the watchdog too aggressive. The `WATCHDOG_FLOOR` (15s) caps this downside.

### 16.3 Unresolved questions
- The four in §15 (cancel endpoint shape, provider billing coverage, negotiation channel,
  compatibility-window length) remain open pending server-team input; none block A2, but #2 changes
  whether the Stop control advertises "billing stops" to users.

### 16.4 Future protocol extensions
- Resumable turns (frame ids + `Last-Event-ID` + `turn_id`); tool-transparency frames; structured
  citations; alternate transport binding; multiplexed concurrent turns; server-driven backpressure.
  All are additive under the compatibility policy (§10.1) and require no break to §10.10/§11.

---

## Appendix A — Traceability & implementation status

| Contract element | Source of truth | Status |
|---|---|---|
| Frame catalog, payload shapes, open unions | `labStreamTypes.ts` | `[Impl]` (minus `ready`) |
| Transport guarantees, error taxonomy, watchdog, abort | `labStream.ts` | `[Impl]` (fixed 45s; disconnect-only cancel) |
| Reducer (frame → state), latest-wins, draft mirroring | `stores/threadStore.ts` | `[Impl]` |
| Routing, body, GCS upload, single-flight | `hooks/useLabTurn.ts` | `[Impl]` |
| `ready` frame, `x-chat-protocol`, advertised heartbeat, explicit cancel endpoint, `current` rename, `detail`-only errors, completion reasons | — | **`[v1]` — planned; server + client work items** |

> Where a MUST clause and the reference code disagree on an **`[Impl]`** item, this document is
> authoritative and the code is the bug. **`[v1]`** items are forward requirements not yet built and
> are tracked as work, not defects.
