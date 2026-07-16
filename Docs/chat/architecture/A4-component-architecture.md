# A4 — Component Architecture

| | |
|---|---|
| **Doc ID** | A4 |
| **Layer** | Architecture |
| **Status** | Draft — awaiting review |
| **Version** | 0.1.0 |
| **Owners** | Chat Platform |
| **Depends on** | **A2 (State Architecture)**, **A3 (Streaming Protocol)** |
| **Depended on by** | A5 (Lifecycle), all F-docs (feature guides), X1/X3 (a11y/perf), P1 (testing) |
| **Reference implementation** | `app/(lab)/chat.tsx`, `chat/ChatMessage.tsx`, `chat/cards.tsx`, `chat/ThinkingDots.tsx`, `chat/useTypewriter.ts`, `hooks/useLabTurn.ts` |

> **Normative language.** MUST, MUST NOT, SHOULD, SHOULD NOT, MAY per RFC 2119.
>
> **Maturity tags.** **`[Impl]`** exists · **`[Target]`** target design, not yet built ·
> **`[Legacy]`** current shape this RFC replaces.
>
> **Boundary with A2/A3.** A4 defines *components*: their responsibilities, contracts, composition,
> and render discipline. It does **not** define state ownership (A2) or protocol behavior (A3).
> Where a component reads or mutates state, A4 cites the A2 row; where it reacts to a frame, A4
> cites the A3 clause. A4 introduces no new state and no new protocol.

---

## 1. Component philosophy

1. **Single responsibility.** Every component does one thing: layout, presentation of one datum
   kind, or orchestration — never a mix. A component that both fetches/streams *and* renders is
   split.
2. **Presentation vs. orchestration separation.** Exactly one orchestration seam exists
   (`useChatController`, the A2 §7.2 effect executor). All other components are **presentational** —
   pure functions of props + narrow store selectors. Presentational components MUST NOT execute
   effects (no commit, no cancel POST, no persistence, no protocol parsing).
3. **Stateless where possible.** A component owns state only if A2 assigns it (input text, reveal
   buffer, pre-submit feedback, scroll). Otherwise it is a pure function of props/selectors.
4. **State ownership follows A2, verbatim.** No component introduces a store, a second copy of
   messages, or animation state in React. Ownership disputes are resolved by A2 §8, not here.
5. **Protocol awareness is confined.** Only the transport (A3 §10.12) and `useChatController` know
   frames exist. No presentational component imports `labStream`, `LabStreamEvent`, or parses a
   frame. Components consume **derived** state (A2), not wire events.
6. **Composition over inheritance / configuration over branching.** New content kinds and card
   types are added by **registering a renderer** (§9), not by editing a `switch` inside a component.
7. **Unify presentation, isolate subscription.** The streaming message and a committed message
   render through the **same** presentational subtree (`AssistantMessage`) so they can never drift
   visually; they differ only in their **data driver** (§2.1) so token-level re-render stays
   isolated to one leaf (A2 I10). This is the central structural decision of A4.

---

## 2. Complete component tree

```
ChatProvider                         orchestration + context (theme scope, controller)
└─ ChatScreen                        layout shell only — no logic, no state
   ├─ BackgroundLayer                glow (SharedValue-driven; A2 row 21)          [Tier 2]
   ├─ ChatHeader                     title / back / (overflow)                     [Tier 0]
   ├─ MessageList                    list abstraction; subscribes messages (A2 #2) [Tier 0]
   │  └─ MessageItem                 pure; dispatches by role; React.memo          [Tier 0]
   │     ├─ UserMessage
   │     │  └─ AttachmentPreview
   │     ├─ AssistantMessage ◄───────── SHARED presentational subtree ─────────┐  [Tier 0 committed]
   │     │  ├─ MessageRenderer        content-part dispatch (registry, §9)      │
   │     │  │  ├─ MarkdownRenderer    swappable interface (ADR-009)             │
   │     │  │  │  ├─ CodeBlock                                                  │
   │     │  │  │  ├─ ImageBlock                                                 │
   │     │  │  │  └─ InlineNodes (link/bold/inline-code)                        │
   │     │  │  └─ (future: ReasoningPart · ArtifactPart · …  §9)                │
   │     │  ├─ StreamCursor           streaming only (SharedValue; A2 row 20)   │  [Tier 2]
   │     │  ├─ CardStack              → CardRenderer (registry dispatch, §9)    │
   │     │  ├─ SourcesStrip           used_tools (A2 row 10)                    │
   │     │  └─ ActionRow              last + settled only (§9, F6)              │
   │     └─ ErrorMessage              failed/interrupted notice + Retry         │
   │                                                                            │
   ├─ StreamingMessage ──────────────── subscribes activeTurn (A2 I10) ────────┘  [Tier 1]
   │     └─ AssistantMessage(isStreaming)   ← same subtree, different driver
   │
   ├─ ThinkingIndicator              pre-first-token dots (A2 row 23, derived)     [Tier 1]
   ├─ ScrollToLatestPill             derived from scroll (A2 row 19)               [Tier 0]
   ├─ EmptyState                     suggested prompts; mode-aware                 [Tier 0]
   └─ ChatComposer                   input region                                 [Tier 0 shell]
      ├─ AttachmentTray              staged attachments (A2 row 15)
      ├─ AttachmentButtons           camera / file (subtle)
      ├─ ChatInput                   owns input text (A2 row 17)                   [Tier 0*]
      └─ SendVoiceStopButton         derived mode (A2 row 24)                      [Tier 0*]

KeyboardLayer                        wrapper (react-native-keyboard-controller) around ChatScreen body
```

Render tiers are defined in §4. `[Tier 0*]` = re-renders on local input state only, never on tokens.

### 2.1 The two data drivers (unify presentation, isolate subscription)

- **Committed path:** `MessageList` subscribes to `conversationStore.messages` (A2 #2), which
  changes **only on commit**. It maps each message to a pure `MessageItem`. Assistant messages
  render `AssistantMessage` from props.
- **Streaming path:** `StreamingMessage` is a thin wrapper that subscribes to `activeTurn`
  (A2 I10) via narrow selectors and renders the **same** `AssistantMessage` with `isStreaming`. It
  is the *only* component that re-renders on the coalesced token tick.

`AssistantMessage` is presentation; the driver is where the data comes from. This is how ADR-005
(no forked rendering) and A2 I10 (isolated subscription) coexist.

---

## 3. Component contracts

Format per component: **R**esponsibility · **In** (props) · **Out** (callbacks) · **Dep** ·
**State** (owns/subscribes per A2) · **Freq** (render frequency) · **Memo**.

### Orchestration

**ChatProvider** — R: instantiate `useChatController` once; expose actions via context; wrap the
theme scope. In: `conversationId`, `mode`. Out: —. Dep: A2 stores, `useChatController`. State: none
(hosts the controller). Freq: mount only. Memo: n/a (provider).

**useChatController** *(hook, not a component)* — R: the sole effect executor (A2 §7.2) — `send`,
`cancel`, `retry`, and the reducer effect interpreter (commit/reset/cancelPost/haptic). Owns the
`AbortController` ref (A2 row 30) and single-flight (A3 G11). In: —. Out: `{ send, cancel, retry }`.
Dep: transport (A3), reducer (A2 §9), stores. State: refs only. Freq: n/a. Memo: actions are
`useCallback`-stable.

### Shell

**ChatScreen** — R: compose the shell (background, header, list, streaming region, composer);
own no logic. In: —. Out: —. Dep: child components, controller context. State: none. Freq: rare
(mount/layout). Memo: not required (renders rarely).

**ChatHeader** — R: title + back + optional overflow. In: `mode`, `onBack`. Out: `onBack`. State:
none. Freq: rare. Memo: `React.memo`.

**BackgroundLayer** — R: render the glow, driven by a `SharedValue` set from `activeTurn.state`
transitions (A2 row 21) via an effect in the controller/provider. In: —. Out: —. State: SharedValue
(UI thread). Freq: **never re-renders on tokens** (animation is UI-thread). Memo: `React.memo`.

**KeyboardLayer** — R: keyboard avoidance wrapper (react-native-keyboard-controller). In:
`children`. State: none. Freq: on keyboard events (layout). Memo: n/a.

### List & message

**MessageList** — R: abstract the scrollable list; subscribe to `conversationStore.messages`
(A2 #2); render `MessageItem`s; own scroll refs (A2 rows 18–19) via `useChatScroll`. In:
`onReachTop?`. Out: scroll events. Dep: `useChatScroll`. State: subscribes messages; scroll refs.
Freq: on commit only (never per token — A2 I10). Memo: list is virtualization-agnostic (X3 chooses
ScrollView vs FlashList); items are memoized.

**MessageItem** — R: dispatch one message by `role` to `UserMessage`/`AssistantMessage`/
`ErrorMessage`; nothing else. In: `message: Message` (A2 §12), `isLast: boolean`, handlers. Out:
forwards handlers. State: none (pure). Freq: only when its `message` identity changes. Memo:
`React.memo` keyed on `message.id` + `isLast` (stable handlers required).

**StreamingMessage** — R: subscribe to `activeTurn` (A2 I10) and render `AssistantMessage`
(`isStreaming`) from the live buffer/cards. In: —. Out: —. Dep: `activeTurnStore` selectors. State:
subscribes activeTurn (coalesced §A2 15.3). Freq: **Tier 1** — per coalesced tick, only node that
does. Memo: internal; not memoized (it must react).

**UserMessage** — R: present a user message (text parts + attachment previews). In: `message`. Out:
—. State: none. Freq: on identity change. Memo: `React.memo`.

**AssistantMessage** — R: present an assistant message: content parts, cards, sources, cursor
(streaming), action row (last+settled). In: `message | liveProjection`, `isStreaming`, `isLast`,
handlers. Out: card/action callbacks. Dep: `MessageRenderer`, `CardStack`, `ActionRow`,
`StreamCursor`. State: none. Freq: committed→on identity change; streaming→Tier 1 via its driver.
Memo: `React.memo` (committed instances).

**MessageRenderer** — R: dispatch `Message.content: ContentPart[]` (A2 §12) to per-kind renderers
via the **ContentPartRegistry** (§9). In: `parts`, `isStreaming`. Out: —. Dep: registry. State:
none. Freq: follows parent. Memo: memoize parsed output by `(messageId, textLength)` (A2 §15.4).

**MarkdownRenderer** — R: render a text part as markdown via a **swappable interface** (ADR-009).
In: `text`. Out: link taps. Dep: `CodeBlock`, `ImageBlock`, inline nodes. State: none. Freq:
committed→once; streaming→coalesced. Memo: parse memoized (A2 §15.4); component `React.memo`.

**CodeBlock** — R: fenced code (language badge, horizontal scroll, copy). In: `code`, `language?`.
Out: `onCopy`. Dep: clipboard service. State: none. Freq: rare. Memo: `React.memo`. Boundary: §7.

**ImageBlock** — R: an inline/card image (tap-to-fullscreen). In: `uri`, `alt?`. Out: `onOpen`.
State: none. Freq: rare. Memo: `React.memo`. Boundary: §7.

**InlineNodes** — R: inline bold/link/inline-code within a paragraph. In: `text`. Out: link taps.
State: none. Memo: pure; parsing memoized upstream.

**StreamCursor** — R: blinking caret during streaming. In: `visible`. State: SharedValue (A2 row
20). Freq: **UI thread only** — no React re-render. Memo: `React.memo`.

**CardStack** — R: render `cards[]` via **CardRegistry** (§9); wrap each in a card error boundary
(§7). In: `cards`, handlers, `mode`. Out: card actions → `onSend`. Dep: `CardRenderer`, registry.
State: none. Freq: on cards change. Memo: `React.memo`; per-card keyed.

**CardRenderer** — R: look up a single card's renderer by `type` in the registry; render or ignore
(A3 §10.4 open union). In: `card`, handlers. Out: card action. State: none. Memo: `React.memo`.

**SourcesStrip** — R: present `used_tools`/sources (A2 row 10). In: `sources`. State: none. Memo:
`React.memo`.

**ActionRow** — R: copy/share/speak/feedback for the **last, settled** assistant message (F6). In:
`text`, `messageId`, `onFeedback`. Out: `onFeedback` → X5. State: local pre-submit selection
(A2 row 25). Freq: mounts after settle (delayed reveal is F6's concern). Memo: `React.memo`.

**ErrorMessage** — R: present `failed`/`interrupted` reason + Retry (A2 §10.9). In: `message`
(carries `reason`, `retry`), `onRetry`. Out: `onRetry`. State: none. Memo: `React.memo`.

**ThinkingIndicator** — R: pulsing dots pre-first-token; shown when `activeTurn.state ∈
{CONNECTED, THINKING}` (A2 row 23, derived). In: —. State: SharedValues (UI). Freq: Tier 1 mount/
unmount; dots animate on UI thread. Memo: `React.memo`.

### Composer

**ChatComposer** — R: compose the input region (tray, buttons, input, send/voice/stop). In: —.
Out: —. Dep: controller actions (context), composer selectors. State: none (shell). Freq: on
attachment/mode change; **never on tokens**. Memo: `React.memo`.

**ChatInput** — R: own the text input (A2 row 17). In: `placeholder`, `inputRef`. Out:
`onChangeText` (local), `onSubmit`. State: local text. Freq: per keystroke (local only). Memo: n/a.

**AttachmentTray** — R: present staged attachments (A2 row 15). In: `attachments`. Out: `onRemove`.
State: subscribes composer attachments. Memo: `React.memo`.

**AttachmentButtons** — R: camera/file affordances. In: `mode`. Out: `onCamera`, `onAttach`. State:
none. Memo: `React.memo`.

**SendVoiceStopButton** — R: render the correct action by **derived** mode (send/voice/stop — A2
row 24) from input length + `activeTurn.state`. In: `hasText`, `turnState`. Out: `onSend`,
`onVoice`, `onStop`. State: none (derived). Memo: `React.memo`.

### Aux

**ScrollToLatestPill** — R: jump-to-latest affordance; visibility derived from scroll (A2 row 19).
In: `visible`, `onPress`. State: none. Memo: `React.memo`.

**EmptyState** — R: suggested prompts (mode-aware) when the thread is empty. In: `mode`,
`onPrompt`. Out: `onPrompt`. State: none. Memo: `React.memo`.

---

## 4. Rendering boundaries (strict isolation)

Three tiers. This section is normative and is the UI-side enforcement of A2 I10.

- **Tier 0 — MUST NOT re-render on token updates.** `ChatScreen`, `ChatHeader`, `MessageList`, all
  committed `MessageItem`/`UserMessage`/`AssistantMessage`, `ChatComposer`, `AttachmentTray`,
  `ScrollToLatestPill`, `EmptyState`, `SourcesStrip`. These subscribe only to commit-frequency or
  layout state. A token burst MUST produce **zero** renders here (measured — §13).
- **Tier 1 — MAY re-render at the coalesced token cadence (~30–60 fps).** `StreamingMessage` and its
  `AssistantMessage(isStreaming)` subtree; `ThinkingIndicator` (mount/unmount). These are the
  **only** React components allowed to update during streaming. Their cost is bounded by A2 §15.3
  coalescing + A2 §15.4 memoized parse.
- **Tier 2 — Never a React render (UI thread only).** `BackgroundLayer` glow, `StreamCursor` blink,
  input focus scale. Driven by `SharedValue`s; JS is not involved per frame (A2 I4).

**Isolation rules (MUST):**
1. Only `StreamingMessage` subscribes to `activeTurn.buffer`/`.state` (A2 I10). No other component
   may select token-level fields.
2. `SendVoiceStopButton` selects only the coarse `turnState` (not buffer) — it changes at most a few
   times per turn, not per token.
3. Committed `MessageItem`s are `React.memo` with stable handlers; a new streaming tick MUST NOT
   change their props.
4. Animations never cross into React state (Tier 2).

---

## 5. Component communication

One mechanism per concern; no hidden coupling.

| Concern | Mechanism | Rule |
|---|---|---|
| Actions (send/cancel/retry/card actions) | **Context** (from `ChatProvider`) | Components call `useChatActions()`; no prop-drilling the controller through the tree. |
| Domain state (messages, cards, sources) | **Zustand selectors** (narrow) | Subscribe to the minimal field (A2 §15.1). Never pass the whole store down as props. |
| Live turn (streaming) | **Zustand selector**, one subscriber | Only `StreamingMessage` (A2 I10). |
| Per-item data | **Props** | `MessageItem` is pure-from-props; parent (list) owns the data source. |
| Animations | **SharedValue** | Passed by reference to Tier-2 components; never through React state. |
| Imperative focus/scroll | **Refs** | `inputRef`, `scrollRef` via `useChatScroll`; no state for imperative acts. |

**Prohibited couplings:** a presentational component importing a store's setter directly (must go
through controller actions); a child reaching into a sibling's ref; passing `LabStreamEvent`s as
props (protocol stays below the controller — §1.5).

---

## 6. Composition rules

- **May contain children (containers):** `ChatProvider`, `ChatScreen`, `MessageList`,
  `AssistantMessage`, `CardStack`, `ChatComposer`, `KeyboardLayer`. These compose; they hold minimal
  or no state.
- **Must remain leaf nodes:** `CodeBlock`, `ImageBlock`, `StreamCursor`, `SourcesStrip`,
  `ScrollToLatestPill`, `SendVoiceStopButton`, `AttachmentButtons`. They render a single concern and
  take no `children`.
- **Reusable primitives (feature-agnostic, live in `shared/`):** buttons, pills, icon buttons,
  pressables, shimmer — no chat knowledge; safe to reuse app-wide.
- **Feature-specific (live in `features/chat/`):** everything that knows about messages, turns,
  cards, or the controller. A feature component MUST NOT be imported outside the chat feature; if it
  needs to be, extract a primitive.
- **Renderers are registry entries, not hardcoded branches** (§9): `MarkdownRenderer` node handlers,
  `CardRenderer` entries, `MessageRenderer` content-part entries.

---

## 7. Error boundaries

One failure MUST never crash the chat screen (A3 G5 at the UI layer). Boundaries, innermost-first:

| Boundary | Wraps | Fallback |
|---|---|---|
| **CardErrorBoundary** `[Impl]` | each `CardRenderer` | render nothing (drop the bad card) |
| **MarkdownErrorBoundary** | `MarkdownRenderer` output per message | render the raw text as plain paragraphs |
| **CodeBlock / ImageBlock local guards** | a single code/image node | inline "couldn't render" placeholder; never throws upward |
| **StreamingBoundary** | `StreamingMessage` | drop the live node, keep committed history; controller still settles the turn |
| **MessageBoundary** | each `MessageItem` | skip the one message; the list survives |
| **ChatErrorBoundary** (top) | `ChatScreen` | full-screen recoverable error with "reload chat"; last resort only |

Rules (MUST): a card/markdown/media failure is contained at its own boundary and never reaches
`MessageBoundary`. Boundaries render deterministic fallbacks (no rethrow). The existing
`CardBoundary` in `ChatMessage.tsx` is the seed for `CardErrorBoundary`.

---

## 8. Performance contracts

Per component (consolidated; enforced by §13 tests). "memo" = wrapped in `React.memo` with stable
props.

| Component | memo | selectors | useMemo | useCallback | lazy | virtualization |
|---|---|---|---|---|---|---|
| MessageList | — | `messages` (narrow) | derived `viewMessages` | — | — | X3 decides (ScrollView default; FlashList only if measured) |
| MessageItem | ✓ | — | — | handlers stable (parent) | — | — |
| AssistantMessage | ✓ (committed) | — | parsed content | — | — | — |
| MessageRenderer / MarkdownRenderer | ✓ | — | **parse memo (id,len)** | — | — | — |
| CodeBlock | ✓ | — | tokenize once | onCopy | MAY lazy-load a highlighter | — |
| ImageBlock | ✓ | — | — | onOpen | lazy fullscreen viewer | — |
| StreamingMessage | — (must react) | `activeTurn` (coalesced) | parse memo | — | — | — |
| StreamCursor / BackgroundLayer | ✓ | — | — | — | — | UI-thread (no render) |
| CardStack / CardRenderer | ✓ | — | — | handlers stable | MAY lazy-load rare card types | — |
| ChatComposer | ✓ | `mode`,`attachments` | — | actions from context | — | — |
| ChatInput | — | — | — | onSubmit | — | — |
| SendVoiceStopButton | ✓ | `turnState` (coarse) | derived mode | — | — | — |

Global rules: no selector returns a fresh object without shallow-eq or memo; no inline lambdas in
hot props; no non-trivial work in render without `useMemo`.

---

## 9. Extension points (add by registering, not redesigning)

The tree supports future capability through **registries + slots**, so a new type is a registration,
never an edit to a component `switch`.

- **ContentPartRegistry** — `kind → renderer`. Today: `text`. Future: `image`, `audio` (voice
  playback), `reasoning` (chain-of-thought), `artifact` (rich generated docs). `MessageRenderer`
  dispatches through it. Adding a kind = one registry entry + one leaf renderer. (Maps to A2 §12
  `ContentPart[]` + A2 §18.)
- **CardRegistry** — `card.type → renderer`. Today: listing/wtb/product/handoff/etc. Future:
  citations card, plugin cards, new marketplace cards. `CardRenderer` looks up here; unknown types
  render nothing (A3 §10.4 open union). Adding a marketplace/plugin card = one entry.
- **ComposerModeRegistry** — `mode → {label, route, capabilities}`. Today: sell/buy. Future: voice
  mode. Adding voice = a mode entry + an audio content part + an STT service (§services); no tree
  change.
- **ActionRow slot** — actions are a registered list, so like/dislike/copy/share/speak/artifact-open
  extend without editing the row.
- **Header overflow slot** — model switch, regenerate, share-conversation attach here later.
- **Citations** — when A3 promotes `used_tools` → structured `sources`, `SourcesStrip` swaps its
  renderer via the same registry pattern; no consumer change.

**Guarantee:** each capability in the primary objective (streaming, multimodal, markdown, voice,
attachments, reasoning, artifacts, multi-conversation) maps to an existing seam — none requires
redesigning an existing component. Multi-conversation is A2 §18.1 (store container change; `MessageList`/
`StreamingMessage` bind to the active `conversationId`).

---

## 10. File structure

```
features/chat/
  index.ts                      public barrel (only stable exports)
  ChatProvider.tsx              context + controller host
  screens/
    ChatScreen.tsx              shell composition
  components/                   presentational (feature-specific)
    header/ChatHeader.tsx
    list/MessageList.tsx  MessageItem.tsx  StreamingMessage.tsx
    message/UserMessage.tsx  AssistantMessage.tsx  ErrorMessage.tsx
    message/SourcesStrip.tsx  StreamCursor.tsx  ThinkingIndicator.tsx
    cards/CardStack.tsx  CardRenderer.tsx
    composer/ChatComposer.tsx  ChatInput.tsx  AttachmentTray.tsx
             AttachmentButtons.tsx  SendVoiceStopButton.tsx
    overlay/ScrollToLatestPill.tsx  EmptyState.tsx  BackgroundLayer.tsx
  renderers/                    content-part + markdown
    MessageRenderer.tsx  contentPartRegistry.ts
    markdown/MarkdownRenderer.tsx  CodeBlock.tsx  ImageBlock.tsx  InlineNodes.tsx  markdownAdapter.ts
  controllers/
    useChatController.ts        effect executor (A2 §7.2)
    turnReducer.ts              pure reducer (A2 §9)
    effects.ts                  effect interpreter
  hooks/
    useChatScroll.ts  useStreamReveal.ts  useChatActions.ts (context accessor)
  stores/                       (A2-owned; referenced here)
    conversationStore.ts  activeTurnStore.ts  composerStore.ts  sessionStore.ts
  streaming/                    (A3-owned; referenced here)
    labStream.ts  labStreamTypes.ts
  registries/
    cardRegistry.ts  composerModeRegistry.ts
  boundaries/
    ChatErrorBoundary.tsx  CardErrorBoundary.tsx  MarkdownErrorBoundary.tsx  StreamingBoundary.tsx
  services/
    clipboard.ts  share.ts  speech.ts (voice, future)
  types/
    message.ts  card.ts  contentPart.ts   (A2 §12 contracts)
  utils/
    normalizeError.ts (A3 §10.8)  ids.ts
```

Rules: `components/` is presentation only; `controllers/` is the sole home of effects/protocol
wiring; `renderers/` owns all markdown/content parsing (no parsing elsewhere — §12); `stores/` and
`streaming/` are owned by A2/A3 and merely referenced. Nothing outside `features/chat/` imports a
chat internal except through `index.ts`.

---

## 11. Public interfaces

Stable component APIs (interface-level; no implementation). Types reference A2 §12.

```ts
// Context actions — the only way components trigger effects (§5).
interface ChatActions {
  send(text: string): void;                 // opens a turn (A2 START)
  cancel(): void;                           // Stop (A3 §10.7 → A2 CANCEL)
  retry(messageId: string): void;           // re-send from a failed/interrupted message
  submitFeedback(messageId: string, v: 'up' | 'down'): void;  // → X5
}

interface MessageItemProps {
  message: Message;            // A2 §12
  isLast: boolean;             // gates ActionRow (§9/F6)
  actions: Pick<ChatActions, 'retry'>;   // card actions arrive via CardStack handlers
}

interface AssistantMessageProps {
  message: Message;            // committed
  live?: LiveProjection;       // streaming driver supplies this instead of `message`
  isStreaming: boolean;
  isLast: boolean;
}
// LiveProjection is a read-only view of activeTurn (buffer, cards, phase) — NOT the store itself.
interface LiveProjection { text: string; cards: Card[]; phase?: string; }

interface MarkdownRendererProps { text: string; onLinkPress?(url: string): void; }
interface CodeBlockProps { code: string; language?: string; }
interface CardStackProps { cards: Card[]; mode: 'buyer' | 'seller'; onCardAction(text: string): void; }
interface ComposerProps { mode: 'sell' | 'buy'; }   // reads composer/turn state via selectors

// Registries (extension points, §9)
interface ContentPartRenderer<K extends ContentPart['kind']> {
  kind: K;
  render(part: Extract<ContentPart, { kind: K }>, ctx: RenderCtx): React.ReactNode;
}
interface CardRendererEntry {
  type: string;                                   // A3 open union
  render(data: unknown, ctx: CardCtx): React.ReactNode;
}
```

Stability: `ChatActions`, `Message`/`Card`/`ContentPart` (A2), and the registry entry shapes are the
**stable** surface. Everything else is internal and may change without a version bump.

---

## 12. Anti-patterns (MUST NOT)

Contributors MUST NOT introduce any of the following; each maps to a §13 guard where feasible:

1. **Business logic / effects in presentational components** — no commit, cancel, persistence, or
   navigation inside a component; go through `ChatActions` (§1.2, §5).
2. **Protocol parsing in UI** — no component imports `labStream`/`LabStreamEvent` or reads a raw
   frame (§1.5). Only the transport + controller know frames.
3. **Duplicated markdown parsing** — parsing lives only in `renderers/markdown` and is memoized
   (A2 §15.4). No second parser, no per-render re-parse.
4. **Direct store mutation** — components never call a store setter; state changes flow through the
   reducer/effects (A2 §7.2).
5. **Inline streaming logic** — no component owns its own reveal loop except `useStreamReveal` at the
   one streaming leaf (A2 rows 5/6).
6. **Animation state in Zustand / reducer / render-triggering refs** — Tier-2 only (A2 I4).
7. **Forked live/committed rendering** — the streaming and committed messages MUST share
   `AssistantMessage` (§2.1); duplicating its markup is the `[Legacy]` bug and is prohibited.
8. **Subscribing to a whole store object** — narrow selectors only (A2 §15.1).
9. **Array index as React key** — message `id` only (A2 §15.5).
10. **Prop-drilling the controller** — actions come from context (§5).
11. **Hardcoded `switch` for card/content types** — use the registry (§9), so extension needs no
    component edit.
12. **Cross-feature import of a chat internal** — only via `index.ts` (§10).

---

## 13. Acceptance criteria

Measurable, mapped to P1.

- [ ] **Render isolation (§4, A2 I10):** an instrumented token burst produces **0** renders in any
      Tier-0 component; only `StreamingMessage` re-renders (render-count assertion).
- [ ] **Single subscriber:** a static check asserts only `StreamingMessage` selects
      `activeTurn.buffer`.
- [ ] **Protocol confinement (§1.5, §12.2):** a lint/deps rule asserts no file under `components/`
      or `renderers/` imports `streaming/` or `LabStreamEvent`.
- [ ] **No effects in presentation (§12.1/§12.4):** a deps rule asserts `components/` never imports a
      store setter or `controllers/effects`.
- [ ] **Single markdown parser (§12.3):** exactly one module under `renderers/markdown` performs
      parsing; parse is memoized (perf test shows no re-parse on unrelated renders).
- [ ] **Error containment (§7):** injected failures in a card, a markdown block, an image, and the
      streaming node each leave the rest of the thread mounted (boundary tests).
- [ ] **Unified subtree (§2.1/§12.7):** committed and streaming assistant messages resolve to the
      same `AssistantMessage` (snapshot/DOM-tree equivalence for identical content).
- [ ] **Registry dispatch (§9/§12.11):** adding a mock card/content kind requires only a registry
      entry (test registers a fake type and it renders with no component edit).
- [ ] **Memo coverage (§8):** every component marked ✓ is `React.memo` and holds under stable props
      (props-equality test).
- [ ] **Keys (§12.9):** no list uses index keys (lint).

---

## 14. Self-review

**Risks.**
- **Dual-driver subtlety (§2.1).** Unifying presentation while forking the data source is powerful
  but non-obvious; a contributor may "simplify" by making the list render the live turn too,
  re-introducing per-token list re-renders. §12.7 + the §13 render-isolation test are the guardrails,
  but this needs to be called out in onboarding.
- **Registry indirection cost.** Registries buy extensibility at the price of a layer of lookup and
  slightly harder "jump to definition." Justified for cards/content parts (genuinely open sets);
  would be over-engineering for fixed sets — so it is scoped to exactly the open unions A3 defines.
- **Provider/context for actions.** Context is the right call to avoid prop-drilling, but a too-broad
  context value would re-render consumers; the value MUST be a stable actions object (memoized), not
  live state — flagged so it isn't misused as a state bus.

**Complexity hotspots.**
- `MessageRenderer` + `MarkdownRenderer` is the densest area (parsing, memoization, code/image
  boundaries, streaming re-parse). It concentrates the most logic and the most perf sensitivity; F4
  will need the most care and the best test coverage here.
- `StreamingMessage` is small but load-bearing for perf; it is the one component where a careless
  selector or a missing `useMemo` regresses the whole streaming experience.

**Future refactoring risks.**
- **Multi-conversation (A2 §18.1)** turns the single `activeTurn` into a per-conversation map;
  `StreamingMessage` and `MessageList` must bind to the active `conversationId`. Designed for, but
  the binding indirection is a real (small) future change — not zero.
- **Markdown library swap (ADR-009)** is isolated behind `markdownAdapter`, but if we later need
  streaming-aware incremental parsing, the adapter interface may need a streaming variant. The seam
  exists; its shape may evolve.
- **Virtualization decision deferred to X3.** If ScrollView proves insufficient at scale and we adopt
  FlashList, `MessageList` internals change while its public contract holds — contained, but real.

**Assumptions.**
- A2's controller (`useChatController`) exists as the sole effect executor before components are
  built (Phase-1 refactor). A4's presentational purity depends on it.
- ScrollView is the v1 list (X3 to confirm); `MessageList` hides this so the choice is reversible.
- The theme scope is provided by `ChatProvider` (D2 theme architecture) — A4 assumes the provider
  exists but does not define theming.
- Voice/reasoning/artifacts arrive as registered content parts/cards; the primary-objective
  "no major refactor" guarantee holds **only if** contributors extend via registries (§9), enforced
  by §13.

---

## Appendix A — Traceability

| A4 element | Source | Reference code |
|---|---|---|
| Unified `AssistantMessage`, dual driver | ADR-005 + A2 I10 | `ChatMessage.tsx` + `LiveBotBubble` (to merge) |
| `useChatController` = effect executor | A2 §7.2 | `useLabTurn.ts` (to evolve) |
| CardStack/CardRenderer + registry | A3 §10.4 open union | `cards.tsx` `renderCard` (to registry) |
| Card error boundary | A3 G5 | `ChatMessage.tsx` `CardBoundary` `[Impl]` |
| StreamCursor / reveal leaf | A2 rows 5/6/20 | `useTypewriter.ts` |
| ThinkingIndicator | A2 row 23 | `ThinkingDots.tsx` `[Impl]` |
| MessageList / scroll | A2 rows 2/18/19 | `chat.tsx` ScrollView + scroll refs |
| MarkdownRenderer (swappable) | ADR-009 | `ChatMessage.tsx` `MarkdownLite` (to renderers/) |
