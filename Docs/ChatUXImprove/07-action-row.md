# 07 · AI Action Row

> Part of [ChatUXImprove](./00-overview.md). Direction: **dark surface, green-tinted**.
> Status: Not started · Effort: M · Risk: Low · Depends on: 03

## Goal

After a response settles, reveal a quiet row of actions under the AI text — copy, share, speak,
like/dislike — that fades/slides in with a short delay, exactly like Gemini.

## Current state

**None.** There is no action row on AI messages today.

## Target (plane.md)

- Appears **only on the last, settled AI message** (not while streaming, not on every historical
  message — that would be visual noise). Reveal with a **300 ms delay** after settle, then fade +
  slide up.
- Icons (spec): Like, Dislike, Copy, Share, Speak, More. Trim to what's meaningful for us:

| Icon | Action | Notes |
|---|---|---|
| Copy | Copy the message text to clipboard | needs `expo-clipboard` (not installed) |
| Share | `Share.share({ message })` | RN built-in `Share`, no dep |
| Speak | Read aloud | `expo-speech` (check if installed) or stub |
| Like / Dislike | Feedback signal | wire to a lightweight endpoint or local no-op + toast |
| More | Overflow (optional) | defer |

- Style: small ghost icon buttons, `labDark.inkSub` idle, `labDark.accent` on active/pressed.
  Icon size ≤ 20 (spec: "no large icons"). 44×44 touch targets via `hitSlop`. Row gap ~16.
- Haptic on press (`haptics.tap()`); success haptic + toast on Copy ("Copied").

## Implementation

1. Add `expo-clipboard` (`npx expo install expo-clipboard`). Confirm `expo-speech` availability
   before promising Speak; otherwise stub it.
2. New component `chat/ChatActionRow.tsx`:
   - Props: `text: string`, `onFeedback?: (v: 'up'|'down') => void`.
   - Reanimated entering: `FadeInDown.delay(300).duration(250)`; reduced-motion → `FadeIn` no delay.
   - Copy → `Clipboard.setStringAsync(text)` + toast (reuse `NotificationToast`/sonner-native
     pattern already in the app) + success haptic.
   - Share → `Share.share({ message: text })`.
   - Like/Dislike → local selected state (green tint when active) + `onFeedback`.
3. Render it in `ChatMessage.tsx` bot branch **only when** `msg` is the last message and the turn
   is settled. The screen already knows the live vs committed split — pass an `isLast` prop from
   `chat.tsx` (compute from `viewMessages` index) so the row shows on the freshest answer only.
4. Do **not** render on the live streaming bubble.

## i18n

New a11y labels + toast: `mobile.labChat.action.copy|share|speak|like|dislike`,
`mobile.labChat.copied`. All 6 locales.

## Acceptance checklist

- [ ] Action row appears only on the latest settled AI message, ~300 ms after it finishes.
- [ ] Fades + slides in; reduced-motion → simple fade.
- [ ] Copy actually copies + confirms (toast + haptic).
- [ ] Share opens the native share sheet with the message text.
- [ ] Speak works or is an explicit stub (no dead button).
- [ ] Icons ≤20px, ghost style, `labDark.accent` on active; 44×44 targets.
- [ ] Never shown while streaming.
