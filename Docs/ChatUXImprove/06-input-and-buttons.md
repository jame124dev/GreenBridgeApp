# 06 · Input Area, Send / Voice / Attachment Buttons

> Part of [ChatUXImprove](./00-overview.md). Direction: **dark surface, green-tinted**.
> Status: Not started · Effort: M · Risk: Low · Depends on: 01

## Goal

A calm dark composer: rounded input on a dark field, subtle attachment button, and a
send/voice pair that crossfades based on whether there's text.

## Current state

`app/(lab)/chat.tsx` composer:
- Row: `ComposerUtilButton` (camera) + `ComposerUtilButton` (paperclip) + multiline `TextInput`
  + `SendButton`.
- Input: light — `brand.surface` bg, `lab.hairline` border 1.5, `radius.xl`, 14px `lab.ink`.
- Util buttons: 44×44, `lab.utilBg`/`lab.utilBorder`, `lab.utilIcon` glyph.
- Send: 44×44 circle, filled `accent` (green sell / blue buy), dims to 0.45 opacity when empty.
- No voice button.
- `AttachmentChips` render staged uploads above the row.
- Composer wrap: top hairline, `brand.surface` bg.

## Target (plane.md, adapted)

### Input field
- Background `labDark.surface` (`#111A15`), border `labDark.border`, text `labDark.ink`,
  placeholder `labDark.inkMeta`. Large corner radius (keep `radius.xl`).
- On focus: subtle **scale 1 → 1.02** (spec) + placeholder fade. Keep it barely perceptible;
  reduced-motion → no scale.
- Composer wrap: bg `labDark.bg` (or `labDark.surface` for a slight lift); replace the light
  `lab.hairline` top border with `labDark.border` — or drop the border entirely for the
  borderless feel (match the header decision in [02](./02-layout-and-header.md)).

### Attachment button (camera + paperclip)
- Spec: "always visible, very subtle, no background." Soften the util boxes: drop the filled
  `lab.utilBg` + border → transparent, icon `labDark.inkSub`. Keep 44×44 touch target.
- Sell mode routes both to `launchSellerScan()`, buyer to picker — unchanged behavior.

### Send ⇄ Voice crossfade
- **Send** appears only when there's text (or staged attachments); **Voice** shows when input is
  empty. Crossfade the two, 180 ms scale+opacity (spec).
- Send: filled `labDark.accent` circle, white `ArrowUp`. (Not the mode accent — on dark, the
  green accent is the single CTA color. Buyer/sell distinction can move to the header tint.)
- Voice: mic glyph (`lucide` `Mic`), `labDark.inkSub`, no fill. Tapping it can be a **stub** for
  now (haptic + toast "coming soon") if speech-to-text isn't in scope — the spec wants the
  *affordance* and the crossfade, not necessarily working dictation on day one. Flag it clearly.

```
input empty        →   [ 🎤 mic ]   (voice, ghost)
input has text     →   [ ⬆ send ]   (green filled)   ← 180ms crossfade
```

## Implementation

1. Recolor `composerWrap`, `input`, `utilBox` styles → `labDark.*`.
2. Make util buttons background-less.
3. Add a `Mic` button; conditionally render Send vs Voice on `input.trim().length || hasAttachments`;
   wrap both in a crossfade (`Animated`, `FadeIn/FadeOut` or shared opacity).
4. Add focus scale 1.02 (reduced-motion aware).
5. If voice dictation is out of scope, stub `onVoicePress` with haptic + i18n toast and leave a
   `// TODO: wire speech-to-text` — do not ship a dead silent button.

## i18n

New strings: `mobile.labChat.voice` (a11y label), optional `mobile.labChat.voiceComingSoon`.
Add to all 6 locales.

## Acceptance checklist

- [ ] Composer is dark; input `labDark.surface`, legible text + placeholder.
- [ ] Attachment buttons are subtle/background-less, still 44×44.
- [ ] Empty input shows Voice; typing crossfades to Send (~180 ms).
- [ ] Send is the green accent CTA; disabled/hidden logic intact.
- [ ] Focus scale is subtle and reduced-motion-safe.
- [ ] Voice button either works or is an explicitly-labelled stub (never a dead button).
