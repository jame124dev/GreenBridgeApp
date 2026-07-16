# D4 — Motion System

| | |
|---|---|
| **Doc ID** | D4 |
| **Layer** | Design System (final foundation doc) |
| **Status** | Draft — awaiting review |
| **Version** | 0.1.0 |
| **Owners** | Chat Platform · Design Systems |
| **Depends on** | **D1** (motion tokens), **D2** (`useMotion` + `reduceMotion`), **D3** (cursor metrics), **A2** (state lifecycle), **A3** (protocol), **A4** (render tiers/components) |
| **Depended on by** | F1–F9 (all feature guides), X1 (a11y), X3 (performance) |
| **Reference implementation** | `chat/ThinkingDots.tsx` (`[Impl]` pulse), `chat/useTypewriter.ts` (`[Impl]` reveal), `animations/recipes` (`usePop`) |

> **Normative language.** MUST, MUST NOT, SHOULD, SHOULD NOT, MAY per RFC 2119.
>
> **Scope boundary (no duplication).** D4 defines **choreography and animation behavior** — what
> animates, when, in what order, on which thread, and how it degrades. It **does not** define
> durations/easings *values* (→ **D1 §8–9**), theme access or the `reduceMotion` source (→ **D2 §5**),
> type/cursor *metrics* (→ **D3 §6**), state *transitions* (→ **A2 §9**), or component *structure*
> (→ **A4**). D4 composes those; it restates none of them.

---

## 1. Motion philosophy

1. **Motion communicates state.** Every animation maps to an A2 state transition or an A3 event. If
   an animation cannot name the state it expresses, it MUST NOT exist.
2. **Never decorative.** Movement earns its place by conveying progress, causality, or continuity —
   not spectacle (plane.md: "if the user notices the animation, it's too strong").
3. **Preserve focus.** Motion directs attention to the one thing that changed (the arriving answer),
   never competes with it. At most one salient motion at a time.
4. **Continuity over spectacle.** Elements enter, transform, and leave along continuous paths (fade,
   slide, cross-fade) — never hard cuts, never bounces.
5. **Latency masking.** The glow, thinking dots, and reveal exist largely to make model/network
   latency feel intentional and alive — motion is the app "thinking out loud."
6. **Accessibility is first-class.** Reduced motion removes *movement*, never *meaning* (§7). Every
   animation has a defined degraded form.
7. **UI-thread by default.** Continuous motion runs off the JS thread (§4/§8). The single exception —
   the word reveal — is explicitly bounded and isolated.

---

## 2. Motion vocabulary

Every animation category, its token binding (D1), and its owner (§4). These are the only motion
primitives; features compose from them.

| Category | What | Tokens (D1) | Owner / thread |
|---|---|---|---|
| **fade** | opacity in/out | `dur.base`/`fast`, `ease.decelerate`/`accelerate` | Reanimated / UI |
| **scale** | subtle grow/settle (≤1.02) | `dur.fast`, `ease.decelerate` | Reanimated / UI |
| **translate** | slide ≤ small offset (6–12px) | `dur.base`, `ease.decelerate` | Reanimated / UI |
| **reveal** | progressive text appearance (word-by-word) | cadence (§5); `dur.instant` on reduced | **React / JS, Tier-1, coalesced** |
| **pulse** | opacity loop (thinking dots) | `dur.base` loop, `ease.standard` | Reanimated / UI |
| **shimmer** | gradient sweep (skeleton) | `dur.ambient` loop, `ease.linear` | Reanimated / UI |
| **glow** | ambient background opacity + slight translateY | `dur.ambient`, `ease.standard` | Reanimated / UI |
| **cursor** | blink opacity (D3 metrics) | `dur.blink`, `ease.linear` | Reanimated / UI |
| **transition** | screen/component enter-exit | `dur.base`/`slow`, `ease.emphasized` | Reanimated / native |
| **collapse / expand** | height/reveal of a region | `dur.base`, `ease.standard` | Reanimated layout / UI |

Rule: no category uses a spring with overshoot; all curves are D1's non-overshooting easings (§9).

---

## 3. Motion timeline

Each step names its **A2 state / A3 event**, its **motion** (§2), its **token** (D1), and its
**owner** (§4). Reduced-motion variants in §7.

### 3.1 First response (master sequence: send → complete)

```
USER TAPS SEND
  │  haptic: impact (light)                                   [native]
  ▼
A2: IDLE→CONNECTING          user bubble ENTER: fade + translate 6px   dur.base / decelerate   [UI]
                             send→stop crossfade                        dur.fast                [UI]
                             glow FADE-IN (+translateY)                 dur.ambient / standard  [UI]
  ▼
A3: open → A2 CONNECTED       thinking dots PULSE (loop)                dur.base loop           [UI]
A3: stage → A2 THINKING       (glow holds; dots continue)
  ▼
A3: first token → A2 STREAMING
                             dots CROSS-FADE out ↔ text FADE-IN         dur.base                [UI+Tier1]
                             cursor appears, BLINK (loop)               dur.blink               [UI]
                             words REVEAL (coalesced cadence §5)         ~30 fps                 [JS Tier-1]
                             auto-scroll FOLLOWS (smooth)               (throttled §5)          [UI scroll]
  ▼
A3: done → A2 COMPLETED       cursor FADE-OUT                           dur.fast                [UI]
                             haptic: selection (soft)                   [native]
                             glow FADE-OUT                              dur.ambient             [UI]
                             action row REVEAL after 300ms: fade+translate  dur.base / decelerate [UI]
```

### 3.2 Other lifecycles (compact)

| Lifecycle | A2 / A3 trigger | Motion | Token | Owner |
|---|---|---|---|---|
| **Open chat** | screen mount | canvas paints instantly (no flash, X4); composer + empty-state fade-in | `dur.base` | UI + native transition |
| **Thinking** | CONNECTING/CONNECTED/THINKING | dots pulse loop; glow held | `dur.base` loop / `dur.ambient` | UI |
| **Interruption** | STREAMING + transport failure → INTERRUPTED | cursor fade-out; glow fade-out; **partial text stays** (no exit); interrupted badge fade-in; haptic: warning | `dur.fast` / `dur.ambient` / `dur.base` | UI + native |
| **Cancellation (Stop)** | STREAMING + CANCEL → STOPPED | cursor removed at once; glow fade-out **quick** (feels responsive); partial text stays, no error styling; haptic: selection | `dur.fast` | UI + native |
| **Cancel empty** | pre-content CANCEL → CANCELLED_EMPTY | live bubble + dots fade-out; return to idle | `dur.fast` | UI |
| **Error (no content)** | FAILED | dots/live removed; error message ENTER fade+translate; haptic: error | `dur.base` | UI + native |
| **Retry** | user retry | identical to §3.1 send (new turn, same conversation) | — | — |
| **Completion** | COMPLETED | see §3.1 tail | — | — |

Rule: the glow fade-**out** on STOPPED is intentionally faster (`dur.fast`) than on COMPLETED
(`dur.ambient`) so a user-initiated stop feels immediate, while a natural finish feels settled.

---

## 4. Animation ownership

Unambiguous assignment. The governing rule: **exactly one JS/React-thread animation exists (the word
reveal); everything continuous is UI-thread.**

| Animation | Owner | Thread | Mechanism (contract, not impl) |
|---|---|---|---|
| Background glow | Reanimated `SharedValue` | **UI** | `withTiming` opacity + translateY, driven by an A2 `turn.state` effect (A4 BackgroundLayer) |
| Stream cursor blink | Reanimated `SharedValue` | **UI** | `withRepeat` opacity (D3 metrics) |
| Thinking dots pulse | Reanimated `SharedValue` | **UI** | `withRepeat` staggered (`ThinkingDots` `[Impl]`) |
| Shimmer (skeleton) | Reanimated `SharedValue` | **UI** | `withRepeat` gradient position |
| Message enter/exit | Reanimated entering/exiting | **UI** | declarative `FadeIn`/`SlideInDown`/`FadeOut` |
| List insert/reflow | Reanimated **layout** transition | **UI** | `LinearTransition` — **not** `LayoutAnimation` |
| Action-row reveal | Reanimated entering | **UI** | `FadeInDown.delay(300)` |
| Send/voice/stop crossfade | Reanimated entering/exiting | **UI** | opacity/scale swap |
| Input focus scale (if kept) | Reanimated `SharedValue` | **UI** | `withTiming` scale (≤1.02); F6 may drop it |
| **Word reveal** | **React state** | **JS (Tier-1)** | coalesced rAF-driven substring growth; the ONE exception (§5) |
| Auto-scroll follow | imperative `scrollTo({animated})` | **UI** (native scroll) | throttled to the coalesced tick (§5) |
| Screen transition | native navigator (expo-router) | **native** | fade + slight; D4 sets params, not impl |
| Theme cross-fade (future) | Reanimated | **UI** | brief opacity cross-fade on `colorScheme` change |

**Prohibitions:**
- **`LayoutAnimation` MUST NOT be used** — it's imperative/global, Android-inconsistent, and can't be
  coordinated with Reanimated. Use Reanimated layout transitions.
- **No JS-thread frame callbacks** (`setInterval`/`requestAnimationFrame` driving `setState`) for any
  animation **except** the coalesced reveal, which is ≤30 fps and isolated to the A4 Tier-1 streaming
  leaf — it is not a per-frame animation.
- Continuous motion (glow/cursor/pulse/shimmer) MUST be `SharedValue`-driven; it MUST NOT cause a
  Tier-0 React render (A4 §4).

---

## 5. Streaming choreography

The most important choreography; built on A2 §15.3 (coalescing) and D3 §6 (reveal metrics).

- **Cursor.** Blink `dur.blink` (530 ms half-cycle), `ease.linear`, UI-thread loop. Present only in
  STREAMING; removed on any terminal state. Zero reflow (D3). Reduced motion → steady, no blink (§7).
- **Reveal cadence.** Words appear at a **naturally varied** rate (not constant) so it reads as
  thinking, not a ticker. Target perceived ~30–60 wpm-feel; the reveal never lags arrival — when far
  behind (a burst), it reveals more per tick to catch up (masking latency without adding it). The
  reveal is **word/grapheme-boundary safe** (D3 §6).
- **Token batching.** Raw `token` frames are coalesced (A2 §15.3) so the Tier-1 leaf updates at ≤ the
  display cadence, **not** per frame. D4's rule: the reveal reads from the coalesced buffer; it never
  subscribes to raw per-token store writes. Final text is deterministic (A3 G3/G12).
- **Glow timing.** Fade-in begins on send (CONNECTING) over `dur.ambient`; holds subtly through
  streaming; fades out on terminal (`dur.ambient` on COMPLETED, `dur.fast` on STOPPED). A single
  `SharedValue` (`glowProgress`) — never two sources animating it (§9).
- **Toolbar (action row) appearance.** On COMPLETED only, after a **300 ms** delay, `FadeInDown`
  `dur.base`. Never during streaming; never on INTERRUPTED/FAILED (those show Retry, not the row).
- **Auto-scroll timing.** While the user is pinned to bottom, new content triggers a **smooth**
  `scrollTo` throttled to the coalesced tick — never a per-token jump. If the user has scrolled up,
  auto-scroll is suppressed (the pill appears instead). Auto-scroll MUST NOT fight a user drag.

---

## 6. Transition rules

| Transition | Behavior | Token | Owner |
|---|---|---|---|
| **Screen** (into/out of chat) | push with a **slight** fade; no dramatic slide (plane.md) | `dur.slow` / `ease.emphasized` | native navigator |
| **Message** (enter) | user bubble & committed messages: fade + translate 6px; streaming bubble: fade-in once (never per token) | `dur.base` / `ease.decelerate` | Reanimated entering |
| **Message** (reflow on insert) | list settles via layout transition, no jump | `dur.base` / `ease.standard` | Reanimated layout |
| **Composer** (send↔voice↔stop) | crossfade + subtle scale | `dur.fast` | Reanimated |
| **Composer** (focus) | optional scale ≤1.02 + placeholder fade | `dur.fast` | Reanimated (may be dropped, F6) |
| **Keyboard** | height change follows the keyboard curve via `react-native-keyboard-controller`; content is **not** independently animated (avoids double-animation with the OS) | OS-driven | keyboard-controller |
| **Theme** (future switch) | brief cross-fade of the surface on `colorScheme` change; flat scales don't animate (D2) | `dur.base` | Reanimated |

Keyboard rule (important): D4 defers to the keyboard controller's native curve; components MUST NOT
run their own translate animation for keyboard avoidance (it desyncs from the OS animation).

---

## 7. Reduced motion (policy — D4 owns this; D2 §5 deferred it)

Consume `useMotion().reduceMotion` (D2). The policy has three tiers; the rule is **remove movement,
keep meaning**:

**Disabled entirely (no movement):**
- Background glow (all opacity + translateY) → off; canvas stays flat.
- Cursor blink → steady (or omitted); no oscillation.
- Thinking-dots pulse → **static full-opacity dots** (still shown — progress is still communicated).
- Input focus scale, shimmer sweep → off (skeleton shows as a static muted block).

**Shortened / de-motioned (movement → instant or pure opacity):**
- Word reveal → **full text appears at once** (`dur.instant`) — matches `useTypewriter` reduced path.
- Message enter → instant appear or a `dur.fast` opacity-only fade (no translate).
- Action row → appears **immediately** (no 300 ms delay, no slide) once settled.
- Screen/message/theme transitions → opacity-only, `dur.fast` (no slide/scale).

**Preserved (MUST remain, regardless of reduced motion):**
- All **haptics** (send/complete/stop/error) — non-visual state feedback.
- The **presence** of the thinking indicator, cursor (steady), messages, badges, Retry — state is
  always legible.
- **Auto-scroll** still keeps the latest content visible (it may be instant rather than smooth).
- Error/stop/interrupted **signaling** (badges, colors) — never removed.

Rule: `reduceMotion` MUST be read **before** starting any loop/entering animation, and every
animation MUST have a defined degraded form here — no animation may be "forgotten."

---

## 8. Performance

- **60 fps target** on the low-end Android reference device (X3 owns the device matrix + budget).
- **No JS-thread animation** except the coalesced reveal (§4/§5), which is ≤30 fps text growth on the
  isolated Tier-1 leaf — not a per-frame animation.
- **UI-thread ownership.** Glow/cursor/pulse/shimmer/enter/exit/layout run as Reanimated worklets on
  the UI thread; JS jank (e.g. a markdown re-parse) MUST NOT stutter them.
- **Batching.** The reveal reads the coalesced buffer (A2 §15.3); the glow/cursor are single
  `SharedValue`s (cheap); no animation fans out into many per-frame React updates.
- **Interruption safety.** Every turn-scoped animation MUST be **cancelable**: on turn RESET, unmount,
  or a new `START` (single-flight, A3 G11), all prior animations (glow, cursor, reveal, dots) are
  cancelled (`cancelAnimation`) and the glow transitions to the **new** state's target rather than
  restarting from zero. No orphaned loops may survive a turn (leak test, §10).
- **No layout animation on the JS thread; no measurement-driven animation** (§9). Fixed line-height
  (D3) keeps reveal growth measurement-free.

---

## 9. Motion anti-patterns (MUST NOT)

1. **Bounce / spring overshoot** — use D1's non-overshooting easings; no springs that pass their
   target.
2. **Elastic / rubber-band** decorative curves.
3. **Competing animations** — two sources animating the same property (e.g. glow opacity from both a
   state effect and a loop). One property, one driver.
4. **Uncancelled loops** — a `withRepeat` that isn't cancelled on unmount/settle/reset (orphan loop,
   battery + jank).
5. **Layout thrashing** — animating `width`/`height`/layout on the JS thread or via measure loops;
   use opacity/transform, or Reanimated layout transitions.
6. **Decorative movement** — motion with no state meaning (violates §1.2).
7. **Per-token React animation** beyond the single coalesced reveal.
8. **`LayoutAnimation`** (§4) — banned.
9. **Independent keyboard-avoidance animation** competing with the OS curve (§6).
10. **Animating while `reduceMotion` is set** — every path MUST check the flag first (§7).
11. **Blocking input during entrance animations** — animations are non-blocking; the user can always
    type/scroll/stop mid-animation.

---

## 10. Acceptance criteria

Mapped to P1 / X3.

- [ ] **UI-thread ownership:** a profiler check shows no JS-thread frame loop except the coalesced
      reveal (≤30 fps) during streaming.
- [ ] **Render isolation (A4 §4):** glow/cursor/pulse cause **0** Tier-0 re-renders; only the Tier-1
      leaf updates on reveal (render-count assertion).
- [ ] **Reduced motion:** with `reduceMotion` set, glow/blink/pulse/shimmer/focus-scale are off,
      reveal is instant, transitions are opacity-only; haptics + indicators + badges still present
      (flag test across every animation).
- [ ] **Cancellation safety:** a new `START` mid-stream cancels prior glow/cursor/reveal/dots with no
      orphaned loop; glow retargets (leak + identity test).
- [ ] **No overshoot:** an easing audit asserts every animation uses a D1 non-overshooting curve; no
      spring passes its target.
- [ ] **Glow timing:** fade-out is `dur.ambient` on COMPLETED and `dur.fast` on STOPPED (timeline
      test).
- [ ] **Action row:** appears only on COMPLETED, after 300 ms; never during streaming or on
      INTERRUPTED/FAILED.
- [ ] **Auto-scroll:** follows while pinned (smooth), suppressed when the user scrolls up, never
      fights a drag.
- [ ] **Keyboard:** no independent translate animation competes with the OS keyboard curve.
- [ ] **60 fps:** streaming holds ~60 fps on the X3 reference device (perf-trace).

---

## 11. Self-review

**Assumptions.**
- (a) Reanimated is available and the app runs the New Architecture (worklets on UI thread) — it does.
- (b) The coalesced reveal (A2 §15.3) is the settled mechanism; D4's cadence sits on top of it. If A2
  §19 Q3 (rAF vs fixed-30fps) resolves differently, D4's cadence description still holds — only the
  tick source changes.
- (c) `react-native-keyboard-controller` provides the native keyboard curve D4 defers to (it's in the
  stack).
- (d) The glow (F9) is the one animation the product may cut for v1; D4 defines it fully but its
  timeline steps are removable without touching any other choreography (isolated `SharedValue`).

**Risks.**
- **Reveal is the one JS-thread animation.** It's bounded (≤30 fps, Tier-1, coalesced, memoized parse
  per D3 §9), but it is the most likely source of streaming jank on low-end Android. X3 must profile
  it specifically; the fallback is lowering the coalesce cadence, not moving it off-thread (text
  reveal can't be a pure worklet since it mutates the React tree).
- **Glow ↔ state coupling.** Driving `glowProgress` from an A2 `turn.state` effect crosses JS→UI once
  per state change (cheap), but a rapid retry/stop sequence could stack transitions; the cancellation
  rule (§8) is the guard and must be tested (§10).
- **Auto-scroll vs. user drag** is a classic fight; the "suppressed when scrolled up" rule + throttle
  are the mitigation, but the interaction is subtle and worth a dedicated F3/X3 test.
- **Keyboard double-animation.** Deferring to the OS curve is correct but means D4 gives up fine
  control of composer motion during keyboard open; acceptable, and safer than desync.

**Future extension points.**
- **Tool-transparency motion** (A3 §14 `tool` frames) → a small pulse/label transition reusing
  `pulse`/`fade`; new timeline row, no new vocabulary.
- **Reasoning stream** → could reveal in a distinct muted cadence; reuses `reveal` with a different
  perceived rate, still Tier-1/coalesced.
- **Artifacts / rich media** → expand/collapse reuse the `collapse/expand` category and layout
  transitions.
- **Resumable streams** (A3 §14) → reveal resumes from the persisted offset; the cadence logic is
  unchanged (it reads a buffer, not the socket).
- **Shared-element / zoom transitions** (image fullscreen) → a `transition` variant via the native
  navigator; additive, no change to streaming choreography.
