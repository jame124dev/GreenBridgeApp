# 01 · Theme Tokens & Animated Background

> Part of [ChatUXImprove](./00-overview.md). Direction: **dark surface, green-tinted**.
> Status: Not started · Effort: M · Risk: Med · Depends on: —

## Goal

Give the chat a calm dark canvas that reads unmistakably as GreenBidz (green accent + green
glow, never Gemini blue), plus a very subtle background that warms slightly while the AI
responds and settles back when it's done.

## plane.md → brand mapping

The spec is black + blue. We keep the darkness, swap the palette to green:

| plane.md role | plane.md value | **Our value (green-tinted)** |
|---|---|---|
| Primary background | `#000000` | `#0A0F0D` (deep forest-black, not pure OLED) |
| Response-glow tint | Navy → dark blue → soft purple | Deep green wash → soft green glow |
| Input bg | `#1A1A1A` | `#111A15` |
| User bubble | `#1C1C1E` | `#16211B` |
| Primary text | `#FFFFFF` | `#F1F5F2` (off-white, softer on dark) |
| Secondary text | `#A8A8A8` | `#9AA89F` (reuse `lab.inkLabel` family) |
| Accent | `#5C7CFA` (blue) | `#34D08C` (`greenLight`) |
| Glow | `rgba(92,124,250,0.18)` | `rgba(52,208,140,0.18)` |
| Hairline/border | (implied) | `rgba(255,255,255,0.08)` |

## Implementation

### 1. Add a `labDark` token block to `src/constants/theme.ts`

Keep it beside the existing `lab` object; do **not** touch the light tokens. Chat is the only
consumer, so this is additive and safe.

```ts
// Dark "conversation mode" surface — chat screen only (Docs/ChatUXImprove/01).
// Green-tinted dark: mirrors plane.md's dark canvas but every blue → GreenBidz green.
export const labDark = {
  bg:          '#0A0F0D', // deep forest-black canvas (not pure #000)
  surface:     '#111A15', // input, code block, raised chip
  surfaceAlt:  '#16211B', // user bubble, pressed state
  border:      'rgba(255,255,255,0.08)',
  borderStrong:'rgba(255,255,255,0.14)',
  ink:         '#F1F5F2', // primary text
  inkSub:      '#B4C0B8', // secondary text
  inkMeta:     '#8A988F', // captions, timestamps, muted
  accent:      '#34D08C', // greenLight — CTA, links, cursor, active
  accentDim:   '#16A35A', // greenMedium — pressed accent
  glow:        'rgba(52,208,140,0.18)', // response glow + soft focus ring
} as const;

// Response-glow gradient (top → bottom), used by the animated backdrop.
export const chatGlowGradient = ['#0E1A14', '#0B130F', '#0A0F0D'] as const;
```

> If we later want a barely-perceptible ambient gradient at rest (like `LabScreenBg`'s wash),
> reuse `chatGlowGradient` at low opacity — but at rest the spec wants *near-flat*, so default
> to a solid `labDark.bg` and only animate opacity on response.

### 2. Repaint `app/(lab)/chat.tsx` root + chrome

- `styles.root.backgroundColor` → `labDark.bg`.
- Header: remove the light hairline look; border → `labDark.border`, title → `labDark.ink`,
  back chevron → `labDark.inkSub`. (Header detail lives in [02](./02-layout-and-header.md).)
- Bubbles/composer recolor is owned by [03](./03-messages.md) and [06](./06-input-and-buttons.md)
  — this file only establishes the canvas + tokens they consume.

### 3. Animated background during AI response

Follow plane.md's sequence (400–700 ms, opacity interpolation — never a hard color switch),
but green:

```
Send → glow fades IN (deep green wash, ~600 ms)
     → holds subtly while streaming
Done → glow fades OUT back to flat labDark.bg (~600 ms)
```

Build it as a **fixed, absolutely-positioned `LinearGradient`** behind the `ScrollView`
(sibling of the thread, `pointerEvents="none"`), with an animated `opacity` driven by
Reanimated:

```tsx
// ChatBackdrop.tsx — sits behind the thread; opacity animates on turn state.
const glow = useSharedValue(0);
useEffect(() => {
  if (reduced) { glow.value = 0; return; }           // reduced motion → no glow
  glow.value = withTiming(active ? 1 : 0, { duration: 600, easing: Easing.out(Easing.ease) });
}, [active, reduced]);
const style = useAnimatedStyle(() => ({ opacity: glow.value }));
// <LinearGradient colors={chatGlowGradient} .../> under an Animated.View style={style}
```

- Gradient moves *upward* per spec: animate a small `translateY` (e.g. 12→0) alongside opacity
  so light appears to "spread behind the content". Keep it barely visible.
- `active = turn.status === 'streaming'` (from `useThread`).
- **Reduced motion → glow disabled entirely** (flat canvas).

## Tokens introduced

`labDark.*`, `chatGlowGradient` in `src/constants/theme.ts`.

## Acceptance checklist

- [ ] `labDark` + `chatGlowGradient` exported from `theme.ts`; no new hex literals in screens.
- [ ] Chat root renders on `labDark.bg`; rest of the lab app unchanged (still light).
- [ ] On Send, the backdrop warms with a **green** (not blue/purple) glow, then settles on Done.
- [ ] Transition is opacity/translate interpolation ≥400 ms — no hard color jump.
- [ ] `useReducedMotion()` → glow stays off; canvas is flat.
- [ ] No blue (`#5C7CFA`) anywhere.

## Notes

The riskiest, most "off-brand-if-wrong" piece in the whole spec is this animated background —
keep it *under*-done. plane.md's own rule applies: "If the user notices the animation, it's too
strong." If in doubt, ship the flat dark canvas first and add the glow as a follow-up.
