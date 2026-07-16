# A2 — State Architecture

| | |
|---|---|
| **Doc ID** | A2 |
| **Layer** | Architecture |
| **Status** | Draft — awaiting review |
| **Version** | 0.1.0 |
| **Owners** | Chat Platform |
| **Depends on** | **A3 (Streaming Protocol)** |
| **Depended on by** | A4 (Components), A5 (Lifecycle & Persistence), F2/F3/F6/F7 (rendering), X3 (Performance), X5 (Analytics) |
| **Reference implementation** | `stores/threadStore.ts`, `stores/composerStore.ts`, `stores/sessionStore.ts`, `chat/types.ts`, `chat/useTypewriter.ts`, `hooks/useLabTurn.ts` |

> **Normative language.** MUST, MUST NOT, SHOULD, SHOULD NOT, MAY per RFC 2119.
>
> **Maturity tags.** **`[Impl]`** exists in reference code · **`[Target]`** this RFC's target
> design, not yet built · **`[Legacy]`** current shape this RFC replaces.
>
> **Relationship to A3.** A3 owns the *wire* and the *turn state machine*. A2 owns *where every
> piece of state lives, how long it lives, and how it changes*. A2 consumes A3's state machine
> verbatim; it does not redefine it.

---

## 1. Purpose

Establish the single source of truth for all state in the chat feature: its ownership, lifetime,
persistence, consistency rules, and update discipline. This document decides — for every datum the
feature touches — **who owns it, where it is stored, when it changes, and what may read it.** Every
component and hook in the feature derives its state contract from this document.

## 2. Scope

**In scope:** state ownership matrix; the turn reducer (built on A3); store boundaries (Zustand /
local / refs / Reanimated / derived / memoized); the conversation and streaming lifecycles; the
persistence model; state-level performance and consistency rules; system invariants; extensibility
seams.

**Out of scope:** UI appearance and layout (F-layer); rendering mechanics of reveal/markdown
(F3/F4); the wire protocol itself (A3); component tree and props (A4); analytics event schemas
(X5). A2 defines *where selection/feedback/scroll state lives*, not how they look or animate.

## 3. Non-goals

- A2 does not define visual behavior, animation curves, or component structure.
- A2 does not re-specify the protocol; it references A3 for all turn states and completion reasons.
- A2 does not mandate a specific persistence library beyond the boundary rules (MMKV is the chosen
  mechanism, consistent with the app; the boundary is what's normative, not the vendor).

## 4. Dependencies

| Dependency | Why |
|---|---|
| **A3 §7.2** (protocol state machine) | Source of every turn-lifecycle state. |
| **A3 §10.9** (completion reasons) | Source of the message `reason` field and commit policy. |
| **A3 §10.10** (`LabStreamEvent`) | The reducer's frame input alphabet. |
| **A3 §11** (guarantees G1–G12) | Constrain the reducer (determinism, single-flight, append-only). |
| Zustand | Store primitive (matches app stack). |
| MMKV | Persistence mechanism for durable stores. |
| Reanimated `SharedValue` | UI-thread animation state (never Zustand). |

---

## 5. State philosophy

Six principles, in priority order. Every later section is an application of these.

1. **Single source of truth.** Each datum has exactly one owner. No datum is copied into a second
   store or into component state that then diverges. (This directly repairs the current defect where
   `messages[]` lives in component `useState` — see §10, `[Legacy]`.)
2. **Derived over duplicated.** If a value is computable from owned state, it MUST be derived
   (selector/memo), never stored. Stored state is the *minimal* set from which everything else is
   derived. Examples: "thinking", "send-vs-stop", "is-last-message" are derived, never stored.
3. **Immutable domain state.** Committed conversation messages are append-only and immutable once
   written. A change produces new state; it never mutates a prior message in place. This is what
   makes persistence, resumption, and future collaboration tractable.
4. **Ephemeral UI state stays local.** Anything meaningful only to one mounted view (input text,
   scroll position, pill visibility, pre-submit feedback selection) lives in local component state
   or refs, never in a global store, never persisted.
5. **Animation state is not application state.** High-frequency visual values (cursor blink, glow,
   focus scale) live in Reanimated `SharedValue`s on the UI thread. They are NEVER in Zustand, the
   reducer, a ref that triggers renders, or persistence.
6. **Explicit persistence boundaries.** What survives navigation / reload / restart / logout /
   app-kill is enumerated (§14). A datum is persisted only if it appears in that table. Silence
   means ephemeral.

---

## 6. Derivation from A3 (no invented states)

A2's turn reducer state set is **exactly** A3 §7.2:

`IDLE · CONNECTING · CONNECTED · THINKING · STREAMING · COMPLETED · STOPPED · INTERRUPTED · FAILED · CANCELLED_EMPTY`

- **No protocol state is added.** The reducer's `turn.state` is one of the above, always.
- The `[Legacy]` coarse `turn.status` (`idle|streaming|done|error`) is retained during migration
  only as a **derived** projection of `turn.state` (§11 mapping), not as a second source of truth.
- The message `reason` (`complete|stopped|interrupted|failed`) is derived **solely** from the
  terminal `turn.state` per A3 §10.9 — never set independently.
- The "meaningful content" predicate (`≥1 token with non-empty cumulative text OR ≥1 data card`) is
  A3's; A2 uses it verbatim to choose INTERRUPTED-vs-FAILED and STOPPED-vs-CANCELLED_EMPTY.

Any state A2 introduces that is **not** a turn state (composer mode, scroll, network status, etc.)
is explicitly a *non-protocol* concern and is justified individually in the ownership matrix (§8).

---

## 7. Architecture overview

### 7.1 Store topology

```
┌───────────────────────────────────────────────────────────────────────┐
│ DURABLE (MMKV-persisted, Zustand)                                       │
│  conversationStore   Map<conversationId, Conversation>                  │
│                        └ messages[]  (append-only, immutable)           │
│  sessionStore        { conversationId, lastProtocolVersion }            │
├───────────────────────────────────────────────────────────────────────┤
│ EPHEMERAL GLOBAL (memory, Zustand)                                      │
│  activeTurnStore     the ONE in-flight turn  (reducer target)           │
│  composerStore       { mode, attachments[] }                            │
│  connectivityStore   { online, since }                                  │
├───────────────────────────────────────────────────────────────────────┤
│ PER-VIEW (local component state + refs)                                 │
│  ChatInput text · scroll refs · reveal buffer · pill/height · feedback  │
├───────────────────────────────────────────────────────────────────────┤
│ UI THREAD (Reanimated SharedValues)                                     │
│  cursorOpacity · glowProgress · inputFocusScale                         │
└───────────────────────────────────────────────────────────────────────┘
```

### 7.2 Pure reducer + effects model

To satisfy A3 G12 (determinism) and principle 5 (no side effects in state), the turn lifecycle is a
**pure reducer** that returns the next state plus a list of *effects*; the **orchestrator**
(`useChatController`, A4) is the only place that executes effects (commit to store, reset, POST
cancel, fire haptic). The reducer contains no I/O, no clock, no randomness.

```
Inputs (commands · transport signals · A3 frames)
        │
        ▼
   reduce(turnState, input) ──► { nextTurnState, effects[] }        ← PURE, deterministic
        │                                    │
        │                                    ▼
        │                        orchestrator executes effects:
        │                          COMMIT(reason) → conversationStore.append
        │                          RESET          → activeTurnStore = IDLE
        │                          CANCEL_POST     → POST /chat/{id}/cancel
        │                          HAPTIC(kind)
        ▼
   activeTurnStore holds the current turnState (observable read model)
```

This is the load-bearing decision of A2: **domain mutation and side effects are separated from the
deterministic transition function.** Everything else follows from it.

---

## 8. Complete state ownership matrix

Owner legend: `conv`=conversationStore, `turn`=activeTurnStore, `comp`=composerStore,
`sess`=sessionStore, `net`=connectivityStore, `local`=component state, `ref`=React ref,
`SV`=Reanimated SharedValue, `derived`=selector/memo (no storage).

| # | State | Owner | Lifetime | Persistence | Synchronization | Update freq | Thread | Storage |
|---|---|---|---|---|---|---|---|---|
| 1 | Conversation (entity) | conv | app-install | MMKV | none (local-authoritative) | on turn commit | JS | MMKV |
| 2 | messages[] | conv | conversation | MMKV | none | on commit only | JS | MMKV |
| 3 | conversationId | sess | conversation | MMKV | echoed from `done` (A3) | rare | JS | MMKV |
| 4 | Turn state (A3 §7.2) | turn | one turn | **never** | reducer over A3 frames | per input | JS | memory |
| 5 | Streaming raw buffer (`turn.text`) | turn | one turn | **never** | append on `token` (A3 G3) | per token (coalesced §15) | JS | memory |
| 6 | Revealed text | local (live leaf) | while leaf mounted | **never** | derived from #5 | ~30 fps | JS | component state |
| 7 | Markdown parsed output | derived (memo) | per message render | **never** | memo(id, len) | on text change | JS | memo cache |
| 8 | Cards (live) | turn | one turn | **never** | `data` frame, latest-wins (A3 G4) | per frame | JS | memory |
| 9 | Cards (committed) | conv (on message) | conversation | MMKV | copied at commit | on commit | JS | MMKV |
| 10 | Sources (`used_tools`) | turn→conv | one turn→conversation | MMKV (on message) | from `done` | once | JS | memory→MMKV |
| 11 | Phase (`turn.phase`) | turn | one turn | **never** | `stage` frame | per stage | JS | memory |
| 12 | Draft mirror (`turn.draft`) | turn | one turn | **never** | `data{listing/wtb_draft}` | per frame | JS | memory |
| 13 | Completion reason | derived→conv | terminal→conversation | MMKV (on message) | from terminal state (A3 §10.9) | once | JS | memory→MMKV |
| 14 | Retry payload (user text) | conv (on message) | conversation | MMKV | set at commit of failed/interrupted | once | JS | MMKV |
| 15 | Attachments (staged) | comp | until turn consumes | **never** (local URIs) | cleared on send | user action | JS | memory |
| 16 | Composer mode (sell/buy) | comp | session | MMKV (SHOULD) | user toggle | rare | JS | MMKV |
| 17 | Composer input text | local (ChatInput) | while mounted | **never** | none | keystroke | JS | component state |
| 18 | Scroll position / atBottom | ref + local | while mounted | **never** | scroll events | scroll | JS | ref/state |
| 19 | Scroll-pill visibility / composer height | local | while mounted | **never** | derived from #18 | scroll/layout | JS | component state |
| 20 | Cursor blink | SV | while streaming leaf mounted | **never** | animation loop | ~1 Hz | **UI** | SharedValue |
| 21 | Background glow | SV | while chat mounted | **never** | driven by turn.state effect | ~60 fps (600ms) | **UI** | SharedValue |
| 22 | Input focus scale | SV | while mounted | **never** | focus event | one-shot | **UI** | SharedValue |
| 23 | Thinking indicator | derived | — | **never** | `state ∈ {CONNECTED,THINKING}` (A3) | per state | JS | derived |
| 24 | Send / Voice / Stop mode | derived | — | **never** | input length + turn.state | on change | JS | derived |
| 25 | Action-row feedback (pre-submit) | local (ActionRow) | while row mounted | **never** | user tap | user action | JS | component state |
| 26 | Action-row feedback (submitted) | X5 sink | — | server | mutation | user action | JS | network (X5) |
| 27 | Network status | net | app | **never** (live) | OS connectivity | on change | JS | memory |
| 28 | Protocol version (negotiated) | turn (live) + sess (last-known) | one turn / session | MMKV (last-known) | `ready` frame / header (A3) | once/turn | JS | memory + MMKV |
| 29 | Heartbeat interval | turn | one turn | **never** | `ready` frame (A3 §10.6) | once/turn | JS | memory |
| 30 | AbortController | ref (controller) | one turn | **never** | single-flight (A3 G11) | per turn | JS | ref |
| 31 | Text selection | OS | transient | **never** | OS gesture | user action | JS/native | not app state |

**Notes on non-obvious rows:**
- **#5/#6 split** is the core performance decision: the *raw* accumulation is owned state (in the
  store, deterministic, testable); the *revealed* substring is presentation (leaf-local, discarded
  on unmount). Never merge them.
- **#28** distinguishes the *per-connection negotiated* version (ephemeral, on the turn) from the
  *last-known* version cached in session for pre-first-frame decisions.
- **#31** text selection is deliberately *not* application state — it is OS-managed and transient;
  F2 documents the selection limitation, A2 only records that we store nothing for it.

---

## 9. Reducer architecture

### 9.1 Input alphabet

The reducer consumes three input classes (a superset of A3 frames, because two A3 states —
CONNECTING, CONNECTED — are entered on transport signals, not frames):

- **Commands** (from orchestrator): `START`, `CANCEL`.
- **Transport signals** (from the A3 binding): `OPENED`, `TRANSPORT_FAILURE(code, retriable)`.
  (Abort is modeled as `CANCEL`; watchdog trip maps to `TRANSPORT_FAILURE('connection_lost')`.)
- **Protocol frames** (A3 §10.10 via `onEvent`): `READY`, `STAGE`, `TOKEN`, `DATA`, `WARNING`,
  `DONE`, `ERROR{fatal?}`. (`HEARTBEAT` is consumed by the transport for liveness and MUST NOT
  reach the reducer — A3 G8.)

### 9.2 Transition table

`hasContent` = A3 meaningful-content predicate over the accumulated buffer/cards.
Effects: **C**=COMMIT(reason), **R**=RESET→IDLE, **X**=issue CANCEL POST, **H**=haptic.

| From | Input | To | Effects | Why |
|---|---|---|---|---|
| IDLE | START | CONNECTING | — | Orchestrator opens the stream; single-flight already enforced. |
| CONNECTING | OPENED | CONNECTED | — | SSE `open`; awaiting first frame. |
| CONNECTING | TRANSPORT_FAILURE | FAILED | C(failed),R | Pre-content failure — no partial to keep. |
| CONNECTING | CANCEL | CANCELLED_EMPTY | X,R | User backed out before anything arrived; discard. |
| CONNECTED | READY | CONNECTED | — | Store negotiated protocol + heartbeat; size watchdog. |
| CONNECTED | STAGE | THINKING | — | Pipeline progress before any content. |
| CONNECTED | TOKEN\|DATA | STREAMING | — | First meaningful content. |
| CONNECTED | DONE | COMPLETED | C(complete),R | Empty-but-successful turn (rare). |
| CONNECTED | ERROR(fatal)\|TRANSPORT_FAILURE | FAILED | C(failed),R | No content yet. |
| CONNECTED | CANCEL | CANCELLED_EMPTY | X,R | No content yet → discard. |
| THINKING | STAGE | THINKING | — | Update `phase`; still no content. |
| THINKING | TOKEN\|DATA | STREAMING | — | First content. |
| THINKING | DONE | COMPLETED | C(complete),R | Agent finished with no prose/cards. |
| THINKING | ERROR(fatal)\|TRANSPORT_FAILURE | FAILED | C(failed),R | No content. |
| THINKING | CANCEL | CANCELLED_EMPTY | X,R | No content → discard. |
| STREAMING | TOKEN | STREAMING | — | Append (A3 G3). |
| STREAMING | DATA | STREAMING | — | Add/replace card (A3 G4). |
| STREAMING | STAGE | STREAMING | — | Update `phase`. |
| STREAMING | WARNING | STREAMING | — | Non-blocking; MAY record a notice. |
| STREAMING | DONE | COMPLETED | C(complete),R,H | Full success. |
| STREAMING | ERROR(fatal)\|TRANSPORT_FAILURE | INTERRUPTED | C(interrupted),R,H | Content exists → keep partial + Retry. |
| STREAMING | CANCEL | STOPPED | X,C(stopped),R,H | User stop after content → keep partial, no error. |
| any non-terminal | ERROR(fatal:false) | (unchanged) | — | A3: non-fatal error is non-terminal. |
| any non-terminal | WARNING | (unchanged) | — | Non-blocking. |
| any non-terminal | READY | (state kept) | — | Idempotent version/heartbeat capture. |

**Accumulator updates** (applied alongside the transition, pure):
`TOKEN`→append `delta` to buffer; `DATA`→apply card (latest-wins for A3 §10.4 singletons, else
append) + mirror draft; `STAGE`→set `phase` (read `current ?? cur`); `READY`→set protocolVersion +
heartbeatMs; `DONE`→capture `used_tools`→sources; `ERROR`/`TRANSPORT_FAILURE`→capture `{message,
code, retriable}` via the isolated `normalizeErrorMessage()` (A3 §10.8).

### 9.3 Reducer invariants
- **Total function.** Every `(state, input)` pair has a defined result; undefined pairs are
  no-ops (return state unchanged) — never throw. Satisfies A3 G5 (unknown frames) at state level.
- **Purity.** No I/O, clock, or randomness. Timestamps/ids for committed messages are supplied by
  the effect executor, not the reducer (keeps determinism; mirrors A3's "stamp after" rule).
- **Single terminal.** Terminal states emit exactly one COMMIT-or-discard + RESET (A3 G2).
- **Replayable.** Feeding a recorded input log reproduces the identical final state (A3 G12) — the
  basis of the P1 determinism test.

---

## 10. Store boundaries

Unambiguous assignment. If a datum is not listed under a mechanism, it MUST NOT use it.

| Mechanism | Holds | MUST NOT hold |
|---|---|---|
| **Zustand (durable): conv, sess** | messages, conversation metadata, conversationId, last-known protocol version | any in-flight turn state; any animation value; input text |
| **Zustand (ephemeral): turn, comp, net** | active turn state + accumulators; composer mode + attachments; network status | committed messages; revealed text; animation values; scroll |
| **Local component state** | input text, revealed reveal-buffer, pill visibility, composer height, pre-submit feedback | anything another view needs; anything persisted |
| **Refs** | AbortController, scroll refs, reveal internal counters/raf handle, commit-once guard | anything that must trigger a render |
| **Reanimated SharedValue** | cursor opacity, glow progress, input focus scale | any value a JS component branches on for logic; any persisted value |
| **Derived (selector/memo)** | thinking, send/voice/stop, is-last, viewMessages, markdown output, latestDraft, gap count | — (derived never stores) |

**Migration from `[Legacy]`:** today `messages[]` lives in `chat.tsx` `useState` and `threadStore`
is the ephemeral turn. Target: rename/relocate `threadStore`→`activeTurnStore` (unchanged shape +
the reducer/effects split), and move `messages[]` into `conversationStore` keyed by
`conversationId`. `composerStore` keeps `mode`+`attachments`; its `input` field is removed in favor
of per-surface local text (removes the current cross-surface ambiguity).

---

## 11. Legacy status projection

During migration, the coarse status is a **pure projection** of `turn.state` (never stored twice):

| `turn.state` | derived `status` |
|---|---|
| IDLE | `idle` |
| CONNECTING, CONNECTED, THINKING, STREAMING | `streaming` |
| COMPLETED, STOPPED | `done` |
| INTERRUPTED, FAILED | `error` |
| CANCELLED_EMPTY | `idle` (post-RESET) |

Consumers SHOULD migrate to read `turn.state` directly; the projection is removed once none remain.

---

## 12. Data model (public contracts)

Interface-level only (no implementation). These are the stable shapes downstream binds to.

```ts
type CompletionReason = 'complete' | 'stopped' | 'interrupted' | 'failed';

// A message is append-only + immutable once committed (principle 3).
interface Message {
  id: string;                       // stable, monotonic; never the array index
  role: 'user' | 'assistant';       // NOTE: replaces legacy 'user'|'bot'|'err'
  createdAt: number;                // stamped by the effect executor, not the reducer
  content: ContentPart[];           // extensible (multimodal-ready) — see §18
  cards?: Card[];                   // committed cards (A3 §10.4)
  sources?: string[];               // used_tools (A3 done)
  reason?: CompletionReason;        // assistant only; from terminal turn.state (A3 §10.9)
  retry?: string;                   // user text to re-send (set on failed/interrupted)
  attachments?: Attachment[];       // user only; local display URIs
}

// Extensible content model: text today; image/audio/reasoning parts later (§18).
type ContentPart = { kind: 'text'; text: string } /* | future kinds */;

interface Conversation {
  id: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  lifecycle: 'active' | 'archived';   // §13
}

// The single in-flight turn (ephemeral; never persisted).
interface ActiveTurn {
  state: ProtocolState;               // A3 §7.2 — the ONLY lifecycle
  phase?: string;                     // from stage
  buffer: string;                     // raw accumulation (A3 G3)
  cards: Card[];
  draft?: unknown;
  sources?: string[];
  error?: { message: string; code: string; retriable: boolean };
  protocolVersion?: number;           // from ready/header
  heartbeatMs?: number;               // from ready
}

// Reducer signature (pure).
type TurnInput = Command | TransportSignal | LabStreamEvent;   // §9.1; LabStreamEvent from A3
function reduce(turn: ActiveTurn, input: TurnInput): { turn: ActiveTurn; effects: Effect[] };
type Effect =
  | { kind: 'commit'; reason: CompletionReason }
  | { kind: 'reset' }
  | { kind: 'cancelPost' }
  | { kind: 'haptic'; of: 'success' | 'error' };
```

Store surfaces are **selector-first**: consumers subscribe to the narrowest field (§15), never the
whole store object.

---

## 13. Conversation lifecycle

The conversation *entity* lifecycle (distinct from a turn). Per-turn outcomes (Completed /
Interrupted / Cancelled) are recorded *within* Active and do not change the entity state.

```
   Create ──► Active ──────────────────────────► Archived ──► Destroyed
     ▲          │  ▲                                 ▲            ▲
     │          │  │ turn commit (any reason)        │ TTL / cap  │ logout / app data clear
   Resume ──────┘  └─────────(loop: many turns)──────┘            │
     (hydrate from MMKV on mount)                                 └── (irreversible)
```

- **Create** — first user turn on a fresh `conversationId` (minted by `sessionStore`). Entity
  written to `conversationStore`.
- **Resume** — on chat mount, hydrate the conversation + messages from MMKV by `conversationId`
  (A5 owns the mechanism). An in-flight turn is NOT resumed (activeTurn is ephemeral, §14);
  resumption restores *committed* history only.
- **Active** — normal use; each committed turn appends a message and bumps `updatedAt`.
- **Interrupted / Completed / Cancelled** — turn *outcomes* (A3), recorded as message `reason`s;
  the conversation stays Active.
- **Archived** — aged-out or over a retention cap; retained in MMKV but excluded from the active
  working set. (Policy owned by A5.)
- **Destroyed** — purged on logout or app-data clear. Irreversible. MUST also clear `sessionStore`
  `conversationId` and any cached tokens (privacy — §14).

## 14. Persistence model

Normative table. A datum survives a boundary **only** if marked ✓.

| State | Navigation (unmount) | JS reload | App restart | Logout | App kill |
|---|---|---|---|---|---|
| Conversation + messages (conv) | ✓ | ✓ | ✓ | ✗ (purged) | ✓ |
| conversationId (sess) | ✓ | ✓ | ✓ | ✗ | ✓ |
| last-known protocol version (sess) | ✓ | ✓ | ✓ | ✗ | ✓ |
| Composer mode (comp) | ✓ | ✓ (MMKV) | ✓ | ✗ | ✓ |
| Active turn (turn) | ✗ (aborted) | ✗ | ✗ | ✗ | ✗ |
| Streaming buffer / revealed text | ✗ | ✗ | ✗ | ✗ | ✗ |
| Attachments (staged) | ✗ | ✗ | ✗ | ✗ | ✗ |
| Composer input text | ✗ | ✗ | ✗ | ✗ | ✗ |
| Scroll / animations / feedback selection | ✗ | ✗ | ✗ | ✗ | ✗ |

Rules:
- **In-flight is never durable.** Navigating away or reloading during a turn aborts it (A3 G11
  single-flight + unmount abort). Any *meaningful content* already accumulated is committed as
  `interrupted` **before** teardown (A3 §10.9), so it survives via the conversation record — the
  turn object itself does not.
- **Logout is a hard purge** of conv + sess + tokens. No chat content may outlive a logout.
- **MMKV writes are debounced** on commit (not per token) — see §15.

## 15. Performance rules

State-level rules that prevent unnecessary renders (rendering mechanics are F3/X3; these are the
*state* constraints that make them possible).

1. **Narrow selectors only.** Components MUST subscribe to the minimal field via a selector with
   shallow equality. Subscribing to a whole store object is prohibited (causes render on any field
   change).
2. **Token-level isolation.** ONLY the single live-message leaf may subscribe to
   `activeTurn.buffer`/`state`. The committed `MessageList` subscribes to `conversationStore.messages`,
   which changes **only on commit** — never per token. (Invariant I10.)
3. **Coalesced turn notifications.** The reducer applies each `token` synchronously (determinism),
   but store *notifications* for the active turn SHOULD be coalesced to ≤ display cadence
   (e.g. flush on rAF) so even the one subscribed leaf updates at ~30–60 fps, not per raw frame.
   Final accumulated text is unchanged (still deterministic).
4. **Derived + memoized.** Markdown parse output MUST be memoized by `(messageId, textLength)`.
   Committed messages parse once; the live message re-parses only on the coalesced tick (F3 caps
   this). No selector may perform non-trivial work without memoization.
5. **Stable identities.** Message `id`s are stable and never the array index; handlers passed to
   `MessageItem` are `useCallback`-stable so `React.memo` holds (A4).
6. **Persistence is not on the render path.** MMKV writes happen on commit/lifecycle transitions,
   debounced; never per token, never inside the reducer, never in a selector.
7. **Animation never triggers React renders.** SharedValue changes stay on the UI thread; no JS
   component re-renders because the cursor blinked or the glow moved (principle 5).

## 16. Invariants

Enforced and tested (P1). Violation is a bug.

- **I1 — Exactly one active turn.** At most one `ActiveTurn` in non-IDLE state exists at any time
  (A3 G11). `START` while non-IDLE MUST first drive the current turn terminal (via CANCEL) and RESET.
- **I2 — One source of truth for messages.** `conversationStore.messages` is the sole message store.
  No component holds a second, mutable copy. (Repairs the `[Legacy]` `useState` defect.)
- **I3 — Revealed text is never persisted and never in the reducer/store.** It is leaf-local only.
- **I4 — Animation values never enter Zustand, the reducer, persistence, or render-triggering refs.**
- **I5 — The reducer is pure and deterministic.** No I/O, clock, randomness, or side effects; all
  effects are returned, not performed (A3 G12).
- **I6 — The active turn is never persisted.** In-flight state is strictly ephemeral (§14).
- **I7 — Committed messages are immutable and append-only.** Edits produce new state.
- **I8 — Completion reason derives solely from the terminal turn state** (A3 §10.9). It is never set
  by any other path.
- **I9 — `conversationId` is the only cross-turn identity.** Identity is never derived from body
  fields or `user_id` (A3 §10.2).
- **I10 — Only the single live leaf subscribes to token-level fields.** Nothing else re-renders per
  token.
- **I11 — Every transition is triggered by a defined input.** No implicit/time-based transitions
  (heartbeat liveness is the transport's concern, not a reducer transition — A3 G8).
- **I12 — Meaningful content is committed before teardown.** Unmount/abort/reload during STREAMING
  commits `interrupted`/`stopped` first (I2 + §14).

## 17. Acceptance criteria

Each maps to a P1 test.

- [ ] **Ownership:** no datum in §8 is stored in two owners; a lint/architecture test asserts
      `messages` exists only in `conversationStore`.
- [ ] **Reducer determinism (I5, A3 G12):** replaying a recorded input log yields byte-identical
      `ActiveTurn` + committed `Message`.
- [ ] **Transition coverage:** every row of §9.2 has a test; undefined `(state,input)` pairs no-op.
- [ ] **Single-flight (I1):** `START` during a live turn cancels + resets before opening.
- [ ] **Partial commit (I12, A3 §10.9):** STREAMING + TRANSPORT_FAILURE commits `interrupted` with
      `retry`; STREAMING + CANCEL commits `stopped`; pre-content CANCEL discards.
- [ ] **Render isolation (I10):** a token burst re-renders only the live leaf; `MessageList` render
      count is unchanged (instrumented test).
- [ ] **Persistence (§14):** messages survive reload/restart; active turn does not; logout purges
      conv + sess + tokens.
- [ ] **Reason integrity (I8):** message `reason` always equals the mapping from the terminal state;
      no code path sets it otherwise.
- [ ] **Immutability (I7):** attempting to mutate a committed message is caught (frozen in dev).
- [ ] **No animation in stores (I4):** an architecture test asserts no `SharedValue` is referenced by
      any Zustand store or the reducer.

## 18. Future extensibility

Each future capability maps to an existing seam — **no architectural change required**:

1. **Multiple conversations.** `conversationStore` is already `Map<id, Conversation>`; multi-thread
   UI reads different keys. Active-turn single-flight becomes single-flight *per conversation* (the
   `ActiveTurn` becomes `Map<conversationId, ActiveTurn>` — a container change, not a model change).
2. **Multimodal messages.** `Message.content` is `ContentPart[]`, not a string. Adding
   `{kind:'image'|'audio'|'file'}` parts is additive; the reducer's `token` append targets the
   current text part.
3. **Voice.** Input becomes an additional composer mode + an audio `ContentPart`; STT output feeds
   the same `START` command. No new turn states (A3 covers streaming).
4. **Reasoning / chain-of-thought.** Arrives as a new A3 frame type (forward-compatible, A3 G7) →
   a new accumulator on `ActiveTurn` (`reasoning: string`) and a `ContentPart` kind. Reducer default
   branch already tolerates unknown frames until wired.
5. **Resumable streams.** `ActiveTurn` gains `turnId`/`lastEventId` (A3 §14); RESUME becomes a
   command that re-opens and *continues* the buffer instead of clearing it. Persistence table would
   add the interrupted turn as resumable — the only §14 change, gated by a flag.
6. **Offline mode.** Add an outbound `queueStore` + `connectivityStore` gate; committed messages are
   already durable (§14). Queued `START`s flush on reconnect. No change to the reducer or message
   model.
7. **Collaborative editing.** Message immutability (I7) + append-only (principle 3) are exactly the
   properties a CRDT/OT sync layer needs; `conversationStore` becomes the local replica of a synced
   log. The reducer and ownership matrix are unchanged.

---

## 19. Open questions

1. **Composer mode persistence.** Persist sell/buy across restarts (row 16 SHOULD), or reset to a
   default each session? (Recommend persist — matches user's last intent.)
2. **Conversation retention/archival policy.** Count cap, TTL, or both before Archived? Owned by A5,
   but A2 needs the trigger defined to size the working set. (Recommend a soft cap, e.g. last N
   conversations hot, older archived.)
3. **Coalescing granularity (§15.3).** rAF flush vs. a fixed 30 fps timer for active-turn
   notifications — pick one and standardize so F3 and X3 agree.
4. **Multi-conversation timing.** Ship `ActiveTurn` as a single object now (single conversation) and
   promote to a per-conversation map when multi-thread lands (§18.1), or model the map from day one?
   (Recommend single now; the container promotion is mechanical and I1 already scopes single-flight.)

## 20. Self-review

**Assumptions.** (a) MMKV is the persistence mechanism (app-standard). (b) A3's completion reasons
and meaningful-content predicate are stable — A2 binds tightly to them. (c) Single conversation at a
time for v1 (multi is §18.1). (d) The orchestrator (A4) is the sole effect executor — A2 assumes
this boundary exists before the reducer can be pure.

**Remaining risks.** (a) The `[Legacy]`→`[Target]` migration (messages out of `useState`) touches
the highest-traffic component; it MUST land behind the flag as a behavior-neutral refactor (Phase 1)
before any visual work, or it will be redone. (b) Coalescing (§15.3) trades a hair of determinism in
*timing* (not final state) for render economy — acceptable, but must be documented so it isn't
mistaken for a reducer bug. (c) The pure-reducer/effects split is more ceremony than the current
inline `applyFrame`; the payoff (testability, determinism, A3 conformance) justifies it, but it is a
real change reviewers must buy into.

**Unresolved.** The four in §19; none block A4. Q3 (coalescing) is the only one F3/X3 will need
resolved before their build.

**Future-proofing confidence.** The two decisions that carry the five-year weight are the
**#5/#6 raw-vs-revealed split** and **`Message.content` as parts** — together they absorb
multimodal, voice, reasoning, resumability, and collaboration without reshaping the model.

---

## Appendix A — Traceability

| A2 element | A3 source | Reference code |
|---|---|---|
| Turn states | A3 §7.2 | `threadStore.ts` (coarse status → to enrich) |
| Reducer frame inputs | A3 §10.10 | `threadStore.applyFrame` |
| Completion reasons + commit policy | A3 §10.9 | `chat.tsx` `turnToMessage` (to relocate) |
| Single-flight / abort | A3 G11 | `useLabTurn.ts` |
| Raw-vs-revealed split | — (A2 decision) | `useTypewriter.ts` (revealed) + `threadStore.text` (raw) |
| Message model | A3 §10.9 reason | `chat/types.ts` (`AiMsg` → `Message`) |
