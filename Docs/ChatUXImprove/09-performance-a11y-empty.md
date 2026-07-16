# 09 · Performance, Accessibility, Empty & Loading States

> Part of [ChatUXImprove](./00-overview.md). Direction: **dark surface, green-tinted**.
> Status: Not started · Effort: M · Risk: Med · Depends on: 03, 05

## Goal

Keep the thread fast under long conversations + streaming, meet accessibility floors, and give
the empty thread and loading states the same calm dark polish.

## A · Performance

### Current state
- Thread renders in a plain `ScrollView` mapping `viewMessages` → `ChatMessage`.
- `ChatMessage` is already `memo`'d ✅; card callbacks are `useCallback`-stable ✅.
- `@shopify/flash-list` **is installed** but not used here.

### Target (plane.md: FlashList, memoized, virtualized, stream without full re-render)
- **Migrate the committed history to `FlashList`.** The live streaming bubble can stay a separate
  node rendered after the list (as today) so per-token updates re-render only the live bubble, not
  the whole list — this already-good separation is worth preserving.
  - `contentContainerStyle` padding per [02](./02-layout-and-header.md).
  - `keyExtractor` = `msg.id`.
  - `maintainVisibleContentPosition` / `scrollToEnd` for the smooth autoscroll ([05]).
  - `contentInsetAdjustmentBehavior="automatic"` per Expo UI guidance.
- Keep `ChatMessage` memo boundaries tight; ensure no new inline object/style props break memo.
- Streaming: `useTypewriter` state lives in `LiveBotBubble` only → confirm token updates don't
  bubble a state change into the list. (They don't today; preserve that.)

> Trade-off: FlashList + a growing streaming node + auto-scroll can fight each other. If migration
> destabilizes autoscroll, it's acceptable to **keep `ScrollView`** for v1 and revisit — the perf
> need is real only for very long threads. Decide by measuring, not by default.

## B · Accessibility (plane.md)

- **44×44 minimum touch targets** — audit every new control (action row [07], voice/send [06],
  code copy [08]). Use `hitSlop` where the visual is smaller.
- **Dynamic Type / font scaling** — don't disable `allowFontScaling`; verify layout at large text.
- **Reduced motion** — every animation added (glow [01], cursor/stream [05], action-row reveal
  [07], focus scale [06]) must read `useReducedMotion()` and degrade. This is a hard requirement,
  not a nicety.
- **Screen reader**: AI prose is readable text (good); decorative bits (cursor, thinking dots,
  glow) marked `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"`
  (dots already do this ✅). Action buttons get real `accessibilityLabel`s + `accessibilityRole`.
- **Contrast on dark**: `labDark.ink` on `labDark.bg` and `labDark.accent` on dark must clear
  WCAG AA. Verify `#34D08C` on `#0A0F0D` for any text use (it passes for large/icon; check small).

## C · Empty state (plane.md: center logo, large spacing, suggested prompts, no clutter)

The chat screen is normally entered mid-turn (Home seeds the first message), so a true empty
thread is rare — but a direct/deep entry with no `q` can hit it. Provide:
- Centered lab logo/orbit mark (`homeOrbitLogo` exists) on the dark canvas, generous spacing.
- 3–4 **suggested prompt** chips (mode-aware: sell vs buy) that fill the composer / send on tap.
- No borders, no cards — quiet.

## D · Loading indicator (plane.md: never a spinner)

- Pre-first-token → `ThinkingDots` (already pulsing ✅) — keep, recolor dot to `labDark.inkMeta`.
- Any full-screen/skeleton wait → gradient **shimmer** on `labDark.surface`, not an
  `ActivityIndicator`. (Card skeletons, if any, follow the same rule.)

## Acceptance checklist

- [ ] Long thread (50+ messages) scrolls smoothly; streaming doesn't re-render the whole list.
- [ ] All controls ≥44×44 (with hitSlop where needed).
- [ ] Reduced motion disables glow, cursor blink, action-row delay, focus scale.
- [ ] Font scaling verified at large Dynamic Type without clipping.
- [ ] Screen reader reads AI text; decorative motion hidden; buttons labelled.
- [ ] `labDark` text/accent contrast verified AA on the dark canvas.
- [ ] Empty thread shows centered mark + mode-aware suggested prompts, no clutter.
- [ ] No `ActivityIndicator` spinners in the chat surface (dots/shimmer only).
