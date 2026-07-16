# 05 · Streaming, Cursor, Auto-scroll & Motion

> Part of [ChatUXImprove](./00-overview.md). Direction: **dark surface, green-tinted**.
> Status: Not started · Effort: M · Risk: Med · Depends on: 03

## Goal

Make the response *arrive* beautifully: word-by-word reveal (not char-by-char), a blinking green
cursor while streaming, buttery auto-scroll, and motion that eases — never bounces.

## Current state

- `chat/useTypewriter.ts` reveals **by character** — `src.slice(0, shownLenRef.current)`, catching
  up ~1/6 of the backlog per frame. Smooth, but the spec explicitly forbids char-by-char.
- No cursor.
- Auto-scroll: `onContentSizeChange` → `scrollToEnd(false)` while pinned; a scroll-down pill
  appears when the user scrolls up. Works, but jumps rather than glides.
- `ThinkingDots` already **pulses** (opacity 0.35↔1, staggered) — matches spec ✅.

## Target (plane.md)

### Word-by-word streaming
Reveal on **word boundaries**, with naturally varied cadence (not perfectly constant).

Rework `useTypewriter` to advance by words:

```ts
// Instead of a char count, track a revealed WORD count.
// Split source into tokens that keep trailing whitespace so joins are lossless:
//   "Hello there, today" -> ["Hello ", "there, ", "today"]
const tokens = src.match(/\S+\s*/g) ?? [];
// Per frame, reveal ceil(remainingWords / 5) words (min 1); jitter the divisor a
// little (e.g. 4–6 by index) so speed varies naturally. Never add latency: if far
// behind (burst), reveal more per frame so rendered text keeps up with arrival.
return tokens.slice(0, shownWordCount).join('');
```

- Keep the existing "instant on reduced-motion or settled" behavior.
- Keep the "source shrank → new turn → reset" guard.
- Cadence: aim ~30–60 ms per word visually; vary it. The catch-up divisor already gives natural
  acceleration under bursts — preserve that.

### Blinking cursor
While a turn is `streaming` and not settled, render a thin cursor glyph after the revealed text:
`Hello there▌`. Green (`labDark.accent`), blinks (opacity 1↔0, ~1 s). Disappears on settle and
under reduced motion (show steady or omit).

- Implement as a trailing `<Text>▌</Text>` with a Reanimated opacity, appended by the live bubble
  only (`LiveBotBubble`), never on committed messages.

### Auto-scroll
- Replace the hard `scrollToEnd(false)` on content growth with a **smooth** keep-latest-visible
  scroll. Since it's a `ScrollView` today, `scrollToEnd({ animated: true })` throttled is the
  cheap win; if it stutters during fast streaming, switch to FlashList
  ([09](./09-performance-a11y-empty.md)) and `scrollToEnd`/`maintainVisibleContentPosition`.
- Never yank the view if the user has scrolled up (already handled via `atBottomRef`). Keep.

### First-response sequence (spec's "most important animation")
Orchestrate on Send:
```
Send → backdrop glow fades in (01)     [~600ms, parallel]
     → thread scrolls to bottom
     → thinking dots (pre-first-token)
     → first token: dots cross-fade to text
     → words stream in
     → on settle: action row fades/slides in (07), glow fades out (01)
```
Each step eases out; nothing bounces or overshoots (spec Motion Principles).

### Motion tokens (plane.md timing)
| Kind | Duration |
|---|---|
| Tiny | 150 ms |
| Normal | 250 ms |
| Large | 400 ms |
| Background | 600 ms |

We already have `motion` in `theme.ts` (`micro 150`, `short 220`, `medium 280`, `long 360`).
Either reuse those or add `motion.background = 600`. Use `Easing.out(...)` — never spring bounce
for these.

## Implementation order

1. Rework `useTypewriter` to word-based (unit-testable in isolation).
2. Add the blinking cursor to `LiveBotBubble`.
3. Smooth the auto-scroll.
4. Wire the first-response sequence (ties in 01 glow + 07 action row).

## Acceptance checklist

- [ ] Text reveals **word-by-word**, cadence visibly varies, never lags behind arrival.
- [ ] A green blinking cursor trails streaming text; gone on settle.
- [ ] Auto-scroll glides (no hard jump); respects user scroll-up.
- [ ] Thinking dots pulse (unchanged) before first token.
- [ ] All motion eases out; nothing bounces.
- [ ] Reduced motion: instant reveal, no cursor blink, no glow.
