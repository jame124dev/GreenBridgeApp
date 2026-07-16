# 03 · Messages — AI "no bubble" + User Bubble

> Part of [ChatUXImprove](./00-overview.md). Direction: **dark surface, green-tinted**.
> Status: Not started · Effort: M · Risk: Med · Depends on: 01, 04

## Goal

Shift AI responses from a bordered bubble to **article-like text directly on the canvas**, and
keep only **user** messages enclosed in a pill bubble — the single most recognizable Gemini move.

## Current state

`chat/ChatMessage.tsx` + the `LiveBotBubble` in `chat.tsx`:
- **Bot** text lives inside `botBubble`: `brand.surface` bg, 1px `brand.border`, `radius.lg`
  with a clipped bottom-left corner, `elevation.sm` shadow, max 92%.
- **User** text lives inside `userBubble`: filled accent (`greenDarkest` sell / `buyBlue` buy),
  `radius.lg` + clipped bottom-right, max 88%, white text.
- Both are 14px, lineHeight 20–21.
- The bubble style is duplicated between `ChatMessage.tsx` (committed) and `chat.tsx`
  (`LiveBotBubble`) — **any change must be made in both**, or extracted to a shared style.

## Target (plane.md, adapted)

### AI message → no bubble
- **Remove** `botBubble` background, border, shadow, radius for the *prose*. Text sits directly
  on `labDark.bg`.
- Text color `labDark.ink`; width **max 84%** (spec: 80–84% for readability), left-aligned.
- Larger left/right breathing (the thread padding from [02](./02-layout-and-header.md) handles
  most of it). "Feels like reading an article."
- Response **cards** (`listing_draft`, `wtb_draft`, product cards, etc.) keep their own surfaces
  — they are UI, not prose. Only the *text* loses its bubble. Cards render below the text as today.
- The `SourcesStrip` stays, recolored for dark ([08](./08-markdown-code-images.md) covers chip
  styling on dark).

### User message → keep the bubble
- Background `labDark.surfaceAlt` (`#16211B`) — **not** the green accent fill. On a dark canvas a
  bright green fill for every user line is loud; the spec uses a quiet dark-gray bubble (`#1C1C1E`).
  Keep the green accent for *interactive* elements (send button, links, cursor), not user prose.
- Radius **999** (`radius.full`) — pill, per spec. Drop the clipped-corner treatment.
- Padding H20 / V14 (spec). Max width **72%**.
- Text `labDark.ink`, 16px (see [04](./04-typography.md)).
- Entering animation: Fade + slide up 6px, 250 ms (already close — `usePop`; keep or tune to spec).

### Error bubble
- Keep as a distinct left bubble but recolor for dark: tint `rgba(220,55,55,0.14)` bg, keep the
  `AlertTriangle` + inline Retry. Legibility over brand here.

## Implementation

1. **Extract the shared bubble/prose styles** so committed (`ChatMessage.tsx`) and live
   (`LiveBotBubble` in `chat.tsx`) stay in sync. Options: a `chat/messageStyles.ts` module, or
   move `LiveBotBubble` into `ChatMessage.tsx`. Do this first — it removes the duplication trap.
2. Bot branch: drop the bubble wrapper `View` styles around `MarkdownLite`; render prose directly
   in `botWrap` with `maxWidth: '84%'`. Keep `isThinking` dots inline (no bubble either).
3. User branch: recolor `userBubble` → `labDark.surfaceAlt`, `borderRadius: radius.full`, remove
   `userBubble` clipped-corner override, `maxWidth: '72%'`, padding 20/14, text → `labDark.ink`.
4. Error branch: dark danger tint.
5. `MarkdownLite` text colors move to dark tokens (`labDark.ink`, bullets `labDark.inkMeta`,
   links `labDark.accent`). Full markdown upgrade is [08](./08-markdown-code-images.md); here just
   recolor what exists.

## Tokens used

`labDark.bg`, `labDark.surfaceAlt`, `labDark.ink`, `labDark.inkMeta`, `labDark.accent`,
`radius.full`.

## Acceptance checklist

- [ ] AI prose has **no** bubble/border/shadow — text on the bare dark canvas, max 84% width.
- [ ] User messages are pill bubbles (`radius.full`), quiet dark surface, max 72%, right-aligned.
- [ ] Response cards still render with their own surfaces below the AI text.
- [ ] Live streaming bubble and committed bubble look **identical** (shared styles — no drift).
- [ ] Error bubble legible on dark with working Retry.
- [ ] All text uses `labDark.*` tokens; no `brand.surface`/`greenDarkest` fills left in chat prose.
