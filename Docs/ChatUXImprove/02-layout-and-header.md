# 02 · Layout, Whitespace & Header

> Part of [ChatUXImprove](./00-overview.md). Direction: **dark surface, green-tinted**.
> Status: Not started · Effort: S · Risk: Low · Depends on: 01

## Goal

Make the screen breathe. Generous vertical rhythm, a minimal borderless header, and a thread
column that never feels compressed — the "calm, spacious" half of the spec.

## Current state

`app/(lab)/chat.tsx`:
- Header is a bordered row (`borderBottomWidth: hairline`, `lab.hairline`) with back chevron,
  centered title (`fonts.bold` 16), and a spacer.
- Thread: `threadContent` = `paddingHorizontal: spacing.lg (16)`, `paddingTop: spacing.md (12)`,
  `gap: spacing.md (12)`.

## Target (plane.md, adapted)

### Layout rhythm
- Thread horizontal padding → **`spacing.xl` (20)** (spec wants large left/right breathing room).
- Inter-message `gap` → **`spacing.xl` (20)** minimum; the spec explicitly says "never compress
  content vertically". User→AI turns especially should not touch.
- Top of thread gets extra breathing space: `paddingTop: spacing['2xl'] (24)`.
- Bottom padding already accounts for composer — keep, but ensure ≥ `spacing['2xl']`.

### Header (minimal)
plane.md: avatar + model name, **no border, no shadow, no background card**, padding top 20 /
bottom 24.

Adapt to our context (we have a back button + a sell/buy title, not a "model name"):
- **Drop the bottom hairline** (`borderBottomColor`). Header floats on the dark canvas.
- Keep the back chevron (`ChevronLeft`, `labDark.inkSub`).
- Center title stays (`mobile.labChat.headerTitle.sell|buy`) but recolor → `labDark.ink`,
  and consider a small green status dot or the sell/buy accent as a subtle tint.
- Padding: top follows `insets.top` (already), add `paddingBottom: spacing.lg`–`spacing.xl`.
- No `backgroundColor` on the header → canvas shows through.

```
Safe area
┌───────────────────────────────┐
│ ‹      Sell / Buy         (sp) │  ← borderless, floats on labDark.bg
├───────────────────────────────┤
│                               │
│   (breathing space, 24)       │
│   … messages, gap 20 …        │
│                               │
├───────────────────────────────┤
│   Composer (see 06)           │
└───────────────────────────────┘
```

## Implementation

In `app/(lab)/chat.tsx` `styles`:
- `header`: remove `borderBottomWidth` + `borderBottomColor`; add `paddingBottom: spacing.lg`.
- `headerTitle.color` → `labDark.ink`.
- `threadContent`: `paddingHorizontal: spacing.xl`, `paddingTop: spacing['2xl']`, `gap: spacing.xl`.
- Back chevron color → `labDark.inkSub`.

## Acceptance checklist

- [ ] Header has no bottom border/shadow; sits directly on the dark canvas.
- [ ] Thread uses ≥20 horizontal padding and ≥20 inter-message gap.
- [ ] Nothing feels cramped at the top of the thread (≥24 top padding).
- [ ] Title + chevron are legible on dark (`labDark.ink` / `inkSub`).
- [ ] Safe-area top and bottom both respected (already via `insets`).
