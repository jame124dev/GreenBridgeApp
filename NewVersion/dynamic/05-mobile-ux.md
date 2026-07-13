# 05 — Mobile UX & Design for Dynamic

> **Doc:** Mobile UX & Design for the dynamic (live-data) GreenBridge customer app.
> **Scope:** Mobile-first UX for the AI-first flow once real data, streaming, and mutations replace the Phase-1 mocks. This is the design-and-feel contract that sits **on top of** the data-layer plumbing described in the sibling dynamic docs.
> **Prereq reading:** `../00-foundation.md` (tokens, recipes, haptics, native checklist) is assumed throughout. This doc never re-defines a token or recipe — it *applies* them to live-data situations.

**Sibling dynamic docs (cross-links):**

| # | File | Owns |
|---|---|---|
| 00 | `00-overview.md` | North-star: goal, current state, target architecture (fork model, `(lab)` route group), principles, phased plan |
| 01 | `01-chat-architecture.md` | As-built chat system: session/mode, the `/chat/stream` + `/detect/stream` SSE event taxonomy, tool/agent loop, Redis memory, auth/headers, data-layer reuse |
| 02 | `02-action-component-catalog.md` | The `event: data` → mobile-component map (product_list, listing_draft, wtb_*, gates, …); the SSE parser + dispatcher that feeds every card |
| 03 | `03-api-contract.md` | HTTP + SSE wire contract; GCS upload session, `image_urls`/`document_urls` handoff; WTB REST |
| 04 | `04-mobile-integration-plan.md` | Per-screen static→dynamic wiring; React Query hooks (`useMatches`, `useMatchDetail`, `useDeal`), view-model adapters; Want-To-Buy card wiring + save-once guard |
| **05** | **`05-mobile-ux.md`** | **This doc — streaming chat UX, perceived latency, motion, a11y, error/offline, keeping prototype polish while live** |
| 06 | `06-roadmap-risks.md` | Phased roadmap, risks & mitigations, test plan, feature-flag strategy |

> **The single rule of this doc:** the static prototype already nailed the *feel*. Dynamic must not degrade it. Every place a network boundary appears (SSE token gaps, GCS upload, publish mutation, socket reconnect) is a place where the app can feel *worse* than the mock. The tactics below exist to keep the live app feeling exactly as polished as `demo.ts` did.

---

## 1. The UX problem dynamic introduces

Phase 1 screens read `src/features/lab/data/demo.ts` synchronously — every screen paints fully-populated on first frame, and `processing.tsx` auto-advances after a fixed `AUTO_ADVANCE_MS = 2600`. Nothing can be slow, empty, wrong, or offline.

Dynamic replaces those synchronous reads with four kinds of latency-bearing boundary, each with its own UX failure mode:

| Boundary | Backend reality (from discovery) | Failure mode if naive | UX tactic (this doc) |
|---|---|---|---|
| **Streaming chat / detect** | `POST /chat/stream` + `POST /detect/stream` SSE; `token`/`data`/`stage`/`done`/`error`/`heartbeat` frames; 15s heartbeat, ~120s deadline. **The AI draft is not a top-level `draft` event** — it arrives inside a `data {type:'listing_draft', draft:{…}}` frame (`chat_adapter.py:203`), cumulative as fields fill in. | Blank bubble while first token loads; card "pops in" fully-formed with no build-up | Typewriter reveal, thinking indicator, stream-first paint, live-building draft card (§3, §4) |
| **File upload** | `POST /gcs/upload` (Node, `x-system-key`), multipart, up to 10 files, then URLs ride the SSE turn | Frozen composer during upload; no progress; lost files on failure | Real camera/picker + per-file upload progress + staged-file retry (§5) |
| **Query reads** | React Query `useMatches`/`useMatchDetail`/`useDeal` → Node/Python REST | Spinner-of-death; layout shift when data lands | Skeletons matching final layout, `staleTime` warm reads, optimistic nav (§6) |
| **Realtime deal room** | Socket.io `/deals/:id/messages`; optimistic send | Dropped messages on reconnect; jumpy scroll; no send feedback | Optimistic sends, autoscroll + scroll-to-bottom, reconnect banner (§3.4, §7) |

Everything below is organized by these boundaries, always through a mobile-UX lens.

---

## 2. Native chat UX foundations

The customer app has **two chat-shaped surfaces**: the AI turn stream (home → processing → draft, and any conversational follow-up) and the 1:1 **Deal Room** (`app/(lab)/deal/[id].tsx`). Both are FlashList-backed message threads. This section defines the shared native-chat mechanics; §3 layers streaming on top.

### 2.1 Message model

Mirror the web engine's `Msg` shape (from `useAIChat.ts`) but keep it RN-native. The Deal Room already uses a discriminated `DealMessage` union (`demo.ts`: `kind: 'day' | 'system' | 'them' | 'me' | 'concierge'`) — reuse that pattern for the AI thread too so one renderer serves both:

```ts
// src/features/lab/chat/types.ts
type Role = 'user' | 'bot' | 'err';
type AiMsg = {
  id: string;              // stable key for FlashList (never index)
  role: Role;
  text: string;            // grows during token stream
  streaming?: boolean;     // true until `done`/`error`
  cards?: LabCard[];       // product_list, listing_draft, wtb_* (see 02/04)
  attachments?: Attachment[];
  tools?: string[];        // from `done` frame → "Sources" strip
  retry?: string;          // original message text, set on `err`
};
```

- **Stable keys**: FlashList requires stable `keyExtractor`. Generate an `id` per message at append time (`nanoid`/counter). Never key by array index — the streaming bot bubble mutates in place and index keys cause remounts (killing the typewriter animation mid-stream).
- **One growing bubble**: a turn appends `{role:'user'}` then `{role:'bot', text:'', streaming:true}` immediately (mirrors `useAIChat.ts:setMessages` append). The bot bubble is the same object across the whole stream; only its `text`/`cards` mutate.

### 2.2 Bubbles

| Element | Spec | Token |
|---|---|---|
| User bubble | right-aligned, filled | `brand.primary` (sell) / `buyBlue` (buy) bg, white text, `rounded-2xl` with bottom-right corner tightened to `radius.sm` |
| Bot bubble | left-aligned, surface | `brand.surface` bg, `brand.foreground` text, `brand.divider` hairline border, `rounded-2xl` bottom-left tightened |
| Concierge/system (Deal Room) | centered pill / muted row | `brand.primarySurface` bg, `brand.textMuted` text — matches `DEAL_COLORS` |
| Error bubble | left-aligned, danger tint | `brand.destructive` @ ~8% bg, danger text, inline **Retry** affordance (§8) |

- **Markdown for bot text** (web renders bot text as Markdown). On native use a lightweight markdown-to-`<Text>` renderer (no new heavy dep — a small parser over `@/components/ui` `Text` covers bold/lists/links, which is all the assistant emits). User text stays plain (`pre-wrap` equivalent: `Text` with default wrapping).
- **Max width**: bubbles cap at ~82% of thread width (`flex` + `maxWidth`), never fixed px — satisfies foundation Native Checklist item C (SE 375 → Pro Max 430).
- **Bubble entrance**: new *completed* messages animate in with **POP** (`src/animations/recipes.ts`), 80ms stagger only when a batch arrives (e.g. seeded Deal Room thread). The **streaming** bot bubble does NOT POP on each token — it appears once (FadeIn) then grows; see §3.

### 2.3 FlashList virtualization

Use **Shopify FlashList `^2.3.1`** (already in stack) for both threads — chat threads and the matches feed are the two places long lists appear.

```tsx
<FlashList
  data={messages}
  renderItem={renderMessage}
  keyExtractor={(m) => m.id}
  estimatedItemSize={96}
  maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
  ListFooterComponent={streamingFooter}   // typing indicator / stream tail
  onEndReachedThreshold={0.4}
  inverted={false}
/>
```

- **`maintainVisibleContentPosition`** is mandatory for chat: when older history loads (Deal Room pagination via `GET /api/v1/chat/conversation/:id/messages?page=&limit=`), the current scroll offset must not jump. This is the native equivalent of the web thread staying put.
- **Do NOT use `inverted`** for the AI turn thread — it fights the typewriter (new content grows at the bottom). Instead pin-to-bottom explicitly (§3.3). The Deal Room may use bottom-anchored layout but `inverted` interacts badly with the sticky composer + keyboard on Android, so prefer explicit autoscroll.
- **Streaming cell perf**: while a bubble streams, it re-renders on every `token`. Keep the streaming bubble a *separate memoized component* and only that cell re-renders; completed cells are `React.memo`'d and never re-render. This is what keeps the list at the foundation's **60 FPS locked** target during a fast token stream.
- **Estimated item size**: cards (product_list grid, listing_draft) are tall and variable — set a realistic `estimatedItemSize` and let FlashList measure; do not force fixed heights on card cells.

### 2.4 Keyboard handling

Root already wraps screens in **`KeyboardProvider`** (`react-native-keyboard-controller 1.21.6`, per foundation §Keyboard checklist). Apply the controller's tools, not raw `KeyboardAvoidingView` guesswork:

- **Deal Room composer**: `KeyboardAvoidingView`/`KeyboardStickyView` from keyboard-controller so the composer rides the keyboard smoothly on both platforms (the prototype uses `KeyboardAvoidingView`; upgrade to the controller's sticky view for jank-free tracking).
- **On focus, keep the send button visible** and scroll the thread to bottom (foundation checklist B). Use `useKeyboardHandler`/`KeyboardAwareScrollView` so focus does not jar-scroll.
- **Attachments row** (staged photo/doc thumbnails) sits *above* the keyboard, between thread and text input — must never be occluded (checklist B).
- **Send button is sticky-bottom, outside the scroll**, and always tappable (foundation D). It is a **44px** composer send (bespoke `Pressable`, per foundation Button contract note that there is no 44px Button size) with press-scale **0.97**.

---

## 3. Streaming chat UX (the hero interaction)

This is the make-or-break of dynamic. The assistant streams over SSE (`01-chat-architecture.md` + `02-action-component-catalog.md` own the transport + card dispatch; here we own how it *feels*). Frame taxonomy from discovery:

| SSE event | Data | UX effect |
|---|---|---|
| `token` | `{ delta }` | Append to streaming bubble → typewriter reveal (§3.1) |
| `data` | `{ type, data }` | Materialize/replace a card (`product_list`, `listing_draft`, `wtb_*`, …) → live card build (§4) |
| `stage` (detect) | `{ stage }` | Drive Processing screen checklist (§3.5) |
| `draft` (detect) | `{ fields }` | Cumulative partial listing draft → live-building draft card (§4.2) |
| `warning` | `{ code:"MAX_TURNS_EXCEEDED" }` | Silent log; optional subtle "still working" note |
| `heartbeat` | `{ ts }` | **Ignore** for UI; reset the stream watchdog only |
| `done` | `{ used_tools, conversation_id }` | Freeze bubble (`streaming:false`), render "Sources" strip from `used_tools` |
| `error` | `{ error, code }` | Convert bubble to error row + Retry (§8) |

### 3.1 Typewriter reveal

**Goal:** text should *flow*, not chunk. SSE `token` frames arrive irregularly (bursty from the LLM, gapped by network). Rendering each delta immediately makes text stutter.

**Tactic — decoupled reveal buffer:**
- Accumulate incoming deltas into a `pendingBuffer` ref (not state).
- A reveal loop (driven by `requestAnimationFrame` or a small interval on the JS thread) moves characters from `pendingBuffer` into the rendered `text` at a steady cadence (~40–80 chars/sec, tuned so it never lags behind arrival, only smooths it).
- If the buffer is far ahead (a big burst landed), accelerate the reveal so we never fall behind the actual stream — smoothing must not add real latency.
- On `done`, flush the entire remaining buffer instantly (no artificial trailing typewriter).

```ts
// pseudo — reveal cadence smooths bursty SSE without adding latency
onToken(delta) { pending.current += delta; }         // no re-render
reveal() {                                            // rAF loop
  if (!pending.current) return;
  const take = Math.max(1, Math.ceil(pending.current.length / 6)); // catch-up
  setBotText((t) => t + pending.current.slice(0, take));
  pending.current = pending.current.slice(take);
}
onDone() { setBotText((t) => t + pending.current); pending.current = ''; }
```

- **Reduced motion**: when `useReducedMotion()` is true, **skip the reveal loop** — commit each `token` (or the whole `done` text) immediately. No character animation. (Foundation reduced-motion rule.)
- **No haptics on tokens** — foundation rule: never haptic on passive/continuous events. A single `haptics.success()` may fire once on `done` for a *listing_created*/*wtb_request* success card, not for ordinary replies.
- **Cursor**: an optional blinking caret (`▋`) at the tail while `streaming` — implement via **PULSE** recipe (opacity loop), static (hidden) under reduced motion.

### 3.2 Thinking indicator (pre-first-token)

Between send and first `token`/`data`, the bot bubble is empty. The web engine shows a "thinking" animation in that gap. Native equivalent:

- Render a **three-dot typing indicator** inside the bot bubble while `text === '' && streaming` and no card yet. Animate via **PULSE** (opacity 0.35↔1 loop, staggered per dot). Static three dots under reduced motion.
- For **detect** turns (photo/doc upload), the Processing screen (§3.5) carries the "thinking" — the bubble may be skipped and stage text shown instead.
- Watchdog: if no frame (not even `heartbeat`) arrives within the stream watchdog window (reuse the seller scanner's **45s** watchdog default from `smartDetectStream.ts`, reset on `heartbeat`), transition the bubble to an error row with Retry (§8). The backend deadline is ~120s and heartbeats are 15s, so a 45s no-frame gap is a genuine stall.

### 3.3 Autoscroll + scroll-to-bottom

Two competing needs: follow the stream when the user is at the bottom; do NOT yank them if they've scrolled up to read history.

**Rule (sticky-bottom with escape):**
- Track `isAtBottom` (via `onScroll` + a small threshold, e.g. within 80px of end).
- While `isAtBottom`, autoscroll to end on every content-size change (each token growth, each new card). Use `scrollToEnd({ animated: false })` during rapid streaming (animated scroll can't keep up and looks jittery); `animated: true` for discrete new messages.
- If the user scrolls up (`isAtBottom` false), **stop autoscrolling** and show a floating **"Scroll to bottom"** pill (down-chevron, unread-count badge if new messages arrived). Tapping it: `haptics.tap()` → `scrollToEnd({ animated:true })` → re-arm sticky-bottom.
- The pill uses **POP** entrance and the foundation's `Badge` for the count. It sits above the composer + `useSafeAreaInsets().bottom`.

### 3.4 Optimistic send

The moment the user hits send (before any network):
1. `haptics.impact()` (MEDIUM — foundation CTA haptic; the send button is bespoke so call it directly).
2. Append the user bubble **immediately** with any staged attachment thumbnails, and append the empty streaming bot bubble.
3. Clear the composer input + staged files (`clearStagedFiles` equivalent).
4. *Then* kick off upload (§5) / SSE. If the turn has files, the user bubble shows local thumbnails instantly; they're swapped to GCS URLs after upload resolves (so the bubble survives reload — mirrors `useAIChat.ts` attachment persistence).

This makes send feel *instant* regardless of network — the classic perceived-latency win.

### 3.5 Processing screen: real stages replace the timer

`app/(lab)/processing.tsx` currently fakes progress with `AUTO_ADVANCE_MS = 2600` and a hardcoded step array `['done','done','active']`. Dynamic drives it from **detect `stage` events**.

Backend `stage` values (verified in `app/detect/pipeline.py`): `validating | preparing_documents | ai_running | extracting_products | done`, carried on the frame as `{ phase, message?, total?, current? }` — the key is **`phase`**, not `stage`. (`preparing_pdfs` is a deprecated one-release alias for `preparing_documents`; there are no `reading_images`/`extracting_fields` phases.)

- Map each `stage` to one of the three visible checklist rows; flip rows `pending → active → done` as stages arrive. Row transitions use **PROGRESS** (bar fill) + **POP** (checkmark on complete).
- **Keep the 2.6s timer as a floor/ceiling fallback** (foundation "keep the timer as fallback ceiling if stream stalls"): if the first `stage`/`draft` frame lands fast, don't advance faster than the mock's minimum so the animation reads; if the stream stalls past the watchdog, the timer still moves the user forward or to an error.
- The **SPIN** recipe drives the 3-layer spinner; **PULSE** the secondary in-progress text. All static under reduced motion (spinner shows resting icon).
- When the first `draft`/`listing_draft` frame arrives, the app can **cross-fade Processing → Draft** (foundation transition `processing → draft` = RISE exit+enter, 350ms) and let the draft card finish building live (§4.2) — the user sees the result assembling rather than waiting for a fully-formed screen.

---

## 4. Response-card UX

Cards are the assistant's structured output (`event: data` → `type`). The full catalog lives in `02-action-component-catalog.md` (with WTB cards + wiring in `04-mobile-integration-plan.md`); here we own their **entrance, live-build, and interaction feel**.

### 4.1 Card entrance animations

- Each new card enters with **POP** (scale 0.92→1 + fade, spring 1.2 overshoot). In a multi-card `product_list`, stagger **80ms** per card (foundation POP-in-lists rule). Cards under reduced motion use plain **FadeIn** (no scale).
- Product grids reuse the matches-feed card pattern; a `product_list` maps to a horizontal or 2-up grid of `ProductCard`s inside the bot bubble region. Tapping a card: `haptics.tap()` → navigate to detail (`useMatchDetail`) or open the product URL.
- **Relevance banner**: when the assistant returns related-not-exact results (web `RelevanceBanner`, deterministic tier split on `_rankingScore`, EXACT ≥0.95 / FLOOR 0.40), render an honest inline notice ("No exact match — here's related gear") above the related cards, with an optional **Save a Want-To-Buy** CTA (buy mode only, WTB flag on). Keeps the app honest instead of pretending weak matches are exact.

### 4.2 Live-building draft card (the standout moment)

The detect stream emits **cumulative `draft`/`listing_draft`** frames — each carries a *more complete* field set as extraction runs (`name`, then `brand`, then `condition`, then `price`, then `market_metrics`). This is a deliberate "watch the AI fill in your listing" moment.

- **Replace, don't append**: each `listing_draft` frame does `setLast({ draft })` (web parser behavior — reuse it). The single draft card re-renders with more fields populated.
- **Field-level reveal**: when a field goes from empty → populated, that row **POP**s in (80ms stagger reads as fields "landing"). Confidence-derived styling: `low_confidence` fields (from the frame's `low_confidence[]`) get an "AI · verify" `Badge`; `missing_required[]` fields render as a subtle "needs input" affordance the user can tap to edit.
- **Do not block on `done`**: the card is interactive as soon as required fields exist. This is the perceived-latency payoff — the draft is usable before the stream fully completes.
- **Publish**: the primary CTA sends `CONFIRM CREATE` (confirm-gated write, per backend). Fire `haptics.impact()` on press; on the resulting `listing_created` card, fire `haptics.success()` once and route to the Published screen (RISE + scale, foundation `draft → published`).

### 4.3 Sources strip

On `done`, `used_tools[]` renders a small "Sources" chip strip below the bubble (web `TOOL_LABELS` maps raw names → friendly labels, e.g. `search_products` → "Searched listings"). Port the same label map. Passive, read-only, no haptic.

---

## 5. AI composer: camera, document picker, upload progress

The composer is the single input surface (foundation `AiComposer`: `SparkleIcon`, multiline `TextInput`, photo/attach utility buttons, `ComposerSendButton`). Dynamic makes photo/attach **real** and adds upload feedback.

### 5.1 Real capture (native, not `<input type=file>`)

The web composer uses an HTML file input; native must use real pickers (all already in stack — foundation §Lists, media):

| Action | Module | Behavior |
|---|---|---|
| **Camera** | `expo-camera ~56.0.7` / `expo-image-picker` `launchCameraAsync` | Take a photo of the item; `haptics.heavy()` on shutter (foundation heavy = camera shutter) |
| **Photo library** | `expo-image-picker ~56.0.13` `launchImageLibraryAsync` | Multi-select images (JPG/PNG/WEBP) |
| **Documents** | `expo-document-picker` | PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX |
| **Compress** | `expo-image-manipulator ~56.0.14` | Downscale/compress before upload to cut upload time on cellular |

- **Cap**: 10 attachments per turn total (backend `MAX_DRAFT_ATTACHMENTS` / GCS max). Enforce client-side; when hit, disable the add buttons and toast (Sonner) — do not silently drop.
- **Permission UX**: request camera/library permission at tap, not on mount. On denial, `EmptyState`-style inline explainer with a "Open Settings" affordance (`expo-linking`). This is a real mobile-only concern the web flow never had.
- **Staged thumbnails** row above the input: images show a real thumbnail (`AppImage`/`expo-image`), documents show a file-type chip + name (mirrors web). Each has an ✕ to remove (`haptics.tap()`), which revokes the local URI.

### 5.2 GCS upload + progress

Upload goes to Node `POST /api/v1/gcs/upload` (multipart, `x-system-key` header; the mobile client already sends `x-platform`/`x-system-key` via `greenbidzClient.ts`). The seller scanner's `useSmartDetect.ts` session flow is the template: **upload photos → upload docs (same session) → pass returned URLs to the SSE turn** (no re-upload on publish). Reuse it.

**Progress UX (mobile-critical — uploads on cellular are slow):**
- Use Axios `onUploadProgress` to drive a **per-file determinate progress** overlay on each staged thumbnail (a **PROGRESS**-style width bar or a radial fill). While any file uploads, the **send button shows a spinner** (`SPIN`) and is disabled, but the *composer stays interactive* (user can still edit text / add more before upload started).
- **Phase ordering** matches web: files upload *first* (Phase 1), then the SSE turn fires with the returned `image_urls`/`document_urls` (Phase 3). Show a compact stage line: "Uploading 2 of 3…" → "Analyzing…" so the user knows which phase they're in.
- **Failure → keep staged files**: on upload error, do NOT clear the staged files (web keeps them for retry). Toast the error (`haptics.error()`), leave the composer populated, and offer **Retry** (re-run upload only). This is the offline/flaky-network safety net for the most expensive user action (they just photographed their equipment).

---

## 6. Perceived-latency tactics (summary)

Consolidated playbook — every live boundary uses at least one:

| Tactic | Where | How |
|---|---|---|
| **Optimistic send** | Composer → thread | Append user + empty bot bubble before network (§3.4) |
| **Stream-first paint** | Chat/detect | Show typing indicator instantly, reveal tokens as they arrive; never wait for `done` to paint (§3.1–3.2) |
| **Live-building card** | Draft | Cumulative `draft` frames fill the card field-by-field; interactive before `done` (§4.2) |
| **Skeletons** | Query reads (matches, match detail, deal header) | Render skeleton cells that match final layout so there's **zero layout shift** when data lands (§6.1) |
| **Warm reads** | React Query | `staleTime: 30_000` (existing `queryClient.ts`) serves cached data instantly on revisit; `useMatches` count can prefetch on Home |
| **Optimistic nav** | Match → Deal | Navigate on tap; show Deal Room skeleton while `useDeal` resolves rather than blocking on the tap (§7) |
| **Upload progress** | GCS | Determinate per-file progress so the wait is legible, not a freeze (§5.2) |

### 6.1 Skeletons

- Build a `MatchesSkeleton`, `MatchDetailSkeleton`, `DealHeaderSkeleton` whose box shapes/heights equal the real cards (the matches-feed view-model already separates data from JSX — the skeleton is the same JSX with placeholder blocks). Animate with **PULSE** (shimmer via opacity loop), static under reduced motion.
- `useMatches`/`useMatchDetail`/`useDeal` `isLoading` → skeleton; `isError` → error state (§8); empty result → empty state (§8). This is exactly the branch the matches view-model comment reserves (`isLoading skeleton cards, refetch → pull-to-refresh, empty state`).
- **No full-screen spinners** on data screens — they cause the "spinner then sudden content" jank the prototype never had. Skeleton → content is the standard.

---

## 7. Deal Room realtime UX

`app/(lab)/deal/[id].tsx` is a managed 1:1 chat. Dynamic wires: `useDeal(id)` (header), `useDealMessages(id)` (seed thread, paginated), Socket.io subscription (inbound), optimistic send mutation (outbound). Retires the Phase-1 canned-reply timer.

- **Optimistic send**: append the `me` bubble immediately with a `sending` state (subtle clock/opacity), `haptics.impact()`, then POST `/api/v1/chat/send` (or the lab deal endpoint). On ack, clear the sending state; on failure, mark the bubble failed with an inline Retry (§8).
- **Inbound via socket**: `them`/`concierge`/`system` events append with **POP** + autoscroll (if at bottom, §3.3). A day-divider is inserted when the date rolls over (reuse `DealMessage` `kind:'day'`).
- **Reconnect banner**: on socket disconnect (`NetInfo` offline or socket error), show a thin top banner "Reconnecting…" (amber `warnAmber`); on reconnect, refetch `useDealMessages` to backfill anything missed while disconnected, then dismiss. Never silently drop messages.
- **Managed banner** (concierge/escrow note) stays fixed under the header — a trust signal, unchanged from static.
- **Scroll**: same sticky-bottom + scroll-to-bottom pill as §3.3; keyboard-controller sticky composer (§2.4).

---

## 8. Empty, error, offline & retry states

Live data means these states are now reachable. Design them as first-class, not afterthoughts.

| State | Trigger | UX |
|---|---|---|
| **Empty — matches** | `useMatches` returns `[]` | `EmptyState` (foundation component): icon, "No matches yet", "We'll alert you the moment supply meets your want", primary CTA back to Home composer |
| **Empty — deal / detail** | 404 from `useMatchDetail`/`useDeal` | `EmptyState` "This match is no longer available" + back |
| **Error — query** | `isError` on any `useQuery` | Inline error card with **Retry** → `refetch()`; `haptics.error()` on entry (once) |
| **Error — SSE turn** | `event: error` or watchdog stall | Convert streaming bubble to error row: danger tint, message from `{error/detail}`, inline **Retry** that re-sends the *original* message (web `retry` field pattern) |
| **Error — upload** | GCS upload fails | Toast + keep staged files + Retry upload only (§5.2) |
| **Offline** | `NetInfo` offline | Persistent thin banner "You're offline"; disable send + composer add buttons; queue nothing silently. On reconnect, banner auto-dismisses and any in-flight retry re-enables |
| **Rate limited / spend cap** | HTTP 429 / 503 (`RATE_LIMITED` / `SPEND_CAP_EXCEEDED`) | Friendly error bubble ("I'm a bit busy — try again in a moment"), Retry after a short backoff; do not expose raw codes |
| **Gate** | `listing_gate` / `wtb_gate` frame (`login` / `seller_access`) | Render a `GateCard`-equivalent with a CTA into auth/seller-upgrade; not an error — an intentional prompt |

**Retry principles:**
- Retry always re-uses the exact original input (message text, staged files) — never make the user re-type or re-photograph.
- SSE retry re-streams the same turn; query retry calls `refetch()`; upload retry re-runs only the failed phase.
- One tap, one `haptics.tap()`. Success after retry may fire `haptics.success()`.

---

## 9. Accessibility

The prototype's polish must extend to assistive tech — dynamic content (streaming, live cards) is where a11y is easiest to break.

- **Tap targets ≥44px** (foundation minimum). The 44px composer send and any icon-only utility buttons (photo/attach/remove-file, scroll-to-bottom pill) must hit 44px via `hitSlop` if the visual is smaller.
- **Screen reader (VoiceOver/TalkBack):**
  - Bot bubble: set `accessibilityRole="text"` and update `accessibilityLabel` to the **final** text — do NOT announce every token (that spams the screen reader). Use `accessibilityLiveRegion="polite"` (Android) / an `AccessibilityInfo.announceForAccessibility` on `done` so the reader announces the completed reply once, not per character.
  - When reduced motion is on, the reveal is already skipped (§3.1), which aligns with the "announce once" behavior.
  - Cards: give each a composite `accessibilityLabel` ("Product: Agilent 1260 HPLC, $13,400, Singapore, tap to view") rather than exposing raw sub-elements one by one.
  - Streaming/typing indicator: mark `accessibilityElementsHidden` / not focusable — it's decorative.
  - Live-building draft: announce field completion sparingly (e.g., only on `done`: "Draft ready, 8 fields detected"), not per field.
- **Dynamic Type / font scaling**: text uses the foundation typography variants; do not disable OS font scaling on body/labels. Bubbles are `flex`/`maxWidth` so scaled text reflows (foundation checklist C).
- **Contrast**: all bubble/text pairs meet ≥4.5:1 (foundation rule; white text on greens darker than `#16A35A`).
- **Focus order**: after send, keep focus logical (input retains focus for the next turn; the new bubble is announced via live region, not by stealing focus).
- **Reduce Transparency / Reduce Motion**: honor both via `useReducedMotion()` fallbacks already defined per recipe in the foundation.

---

## 10. Reduce-motion & haptics (applied)

Reuse `src/animations/recipes.ts` and `@/lib/haptics` exactly as the foundation defines — **do not create new recipe or haptic modules**. This section is the dynamic-specific application matrix.

### 10.1 Motion under live data

| Dynamic event | Recipe | Reduced-motion fallback |
|---|---|---|
| Bot bubble first appears | FadeIn (not POP — it will grow) | FadeIn (same) |
| Token reveal | typewriter reveal loop (§3.1) | commit instantly, no reveal |
| Card materializes (`data` frame) | POP (80ms stagger in grids) | FadeIn, no scale |
| Draft field lands (`draft` frame) | POP per row | FadeIn |
| Processing stage flips | PROGRESS + POP checkmark | set final width instantly, static check |
| Scroll-to-bottom pill | POP in / fade out | FadeIn |
| Deal Room inbound message | POP + autoscroll | FadeIn + snap scroll |
| Confidence ring (match detail) | SVG stroke draw 1200ms | set final offset instantly |
| Skeleton shimmer | PULSE | static opacity 1 |

### 10.2 Haptics under live data (verbs from `@/lib/haptics`: `tap/impact/heavy/success/warning/error`)

| Moment | Verb |
|---|---|
| Send button press | `haptics.impact()` (MEDIUM) |
| Camera shutter | `haptics.heavy()` |
| Chip / toggle / mode switch / card tap / remove file / scroll-pill | `haptics.tap()` |
| Publish/confirm success (`listing_created`, `wtb_request` saved) | `haptics.success()` (once) |
| Open destructive sheet (delete want, etc.) | `haptics.warning()` |
| Any failure (upload, SSE `error`, 429/503, send fail) | `haptics.error()` |
| Token/heartbeat/scroll/passive stream | **none** (foundation rule: no haptic on passive/continuous events) |

---

## 11. Keeping prototype polish while live — checklist

The bar: a reviewer flipping between the Phase-1 mock build and the dynamic build should not be able to tell which is "the real one" by feel — dynamic should feel *at least* as smooth.

```
Streaming:   [ ] typing indicator within 1 frame of send (optimistic)
             [ ] tokens reveal smoothly (no chunk-stutter), catch-up on bursts
             [ ] streaming bubble is the only re-rendering cell (60 FPS held)
             [ ] draft card builds field-by-field; interactive before `done`
Latency:     [ ] no full-screen spinners on data screens (skeletons only)
             [ ] skeletons match final layout → zero layout shift
             [ ] optimistic nav match→deal; upload shows determinate progress
Scroll:      [ ] sticky-bottom autoscroll; scroll-to-bottom pill w/ unread badge
             [ ] maintainVisibleContentPosition on history load (no jump)
             [ ] keyboard-controller sticky composer; attachments row above kbd
Errors:      [ ] SSE error → error bubble + Retry (re-sends original)
             [ ] upload fail keeps staged files + Retry
             [ ] offline banner + disabled send; reconnect backfills
             [ ] 429/503/gate handled with friendly copy, not raw codes
A11y:        [ ] tap targets ≥44px (hitSlop)
             [ ] bot reply announced once on `done` (not per token)
             [ ] cards have composite labels; typing indicator hidden from SR
             [ ] font scaling reflows; contrast ≥4.5:1
Motion:      [ ] every animated value has a reduced-motion fallback
             [ ] press scale 0.97 everywhere; POP stagger 80ms in lists
Haptics:     [ ] impact on send, heavy on shutter, success once on publish
             [ ] NO haptic on tokens/heartbeat/scroll
Native:      [ ] safe-area top + bottom inset on fixed chrome
             [ ] SE 375 → Pro Max 430 tested; flex widths, aspectRatio images
             [ ] Android opaque tab bar + nav inset
```

---

## 12. Reuse map (dynamic UX)

| Need | Reuse (existing) | Source |
|---|---|---|
| SSE transport | `react-native-sse@1.2.1` + `addEventListener` pattern, 45s watchdog reset-on-heartbeat | seller `src/services/scanner/smartDetectStream.ts` (template) |
| Upload session | photos→docs→URLs-to-turn flow, `onUploadProgress` | seller `src/features/scanner/useSmartDetect.ts` |
| HTTP client | `greenbidzClient.ts` (auth interceptor, `x-platform`/`x-system-key`) | `src/api/greenbidzClient.ts`, `interceptors.ts` |
| Query cache | shared `queryClient` (`retry:2`, `staleTime:30_000`) | `src/lib/queryClient.ts` |
| Motion | `RISE/POP/PULSE/SPIN/SLIDE-X` + `useReducedMotion()` | `src/animations/recipes.ts` (foundation) |
| Haptics | `tap/impact/heavy/success/warning/error` | `@/lib/haptics` (foundation) |
| UI primitives | `Screen/Card/Text/Badge/Button/Input/EmptyState/AppImage/Stack` | `@/components/ui` |
| Composer state | `useComposer` (mode/input) | `src/features/lab/.../composerStore.ts` |
| Card renderers | `product_list`/`listing_draft`/`wtb_*` mappers | see `02-action-component-catalog.md`, `04-mobile-integration-plan.md` |
| View-model adapters | `toMatchVM` pattern (API → JSX-stable input) | `src/features/lab/matches/data/matchesView.ts` |

**Must build (UX-owned):** reveal buffer/typewriter loop, thinking indicator, scroll-to-bottom pill, per-file upload-progress overlay, skeleton components, offline/reconnect banners, error-bubble + Retry wiring, screen-reader live-region announce-on-`done`.

---

*End of 05-mobile-ux.md — see `00-overview.md` for the fork/flag model and `01-chat-architecture.md` + `02-action-component-catalog.md` for the SSE frame → state contract this doc's UX sits on top of.*
