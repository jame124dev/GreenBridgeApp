# 00 · Overview & Build Order

> Implementation breakdown of [`plane.md`](./plane.md) — the "Gemini-inspired" chat spec —
> split into buildable areas, each with its own file.

## Direction (decided)

**Dark chat surface, GreenBidz-tinted.** We adopt Gemini's *feel* — the dark canvas,
generous whitespace, motion-first streaming, no-AI-bubble reading, delayed action row —
but the accent and glow are **GreenBidz green**, never Gemini blue (`#5C7CFA`).

- The dark surface is scoped to the **chat screen only** (`app/(lab)/chat.tsx`). The rest
  of the lab app stays light (Home, Browse, Matches, Deals). Chat becomes a deliberate,
  focused "conversation mode" — not a dark theme applied app-wide.
- Blue → green everywhere the spec says blue. Accent = `greenLight #34D08C`, glow =
  `rgba(52,208,140,0.18)`. See [`01-theme-and-background.md`](./01-theme-and-background.md).
- `Google Sans` is proprietary → keep **Inter** (already the app font). See
  [`04-typography.md`](./04-typography.md).

## Current baseline (what exists today)

Grounded in the real code so each area knows its starting point:

| Concern | Today | File |
|---|---|---|
| Chat surface theme | **Light** (`lab.bg`, `brand.surface`, dark ink text) | `app/(lab)/chat.tsx` |
| AI text | **In a bordered bubble** (`botBubble`), left-aligned, max 92% | `chat/ChatMessage.tsx`, `chat.tsx` |
| User text | Filled accent bubble, right, `radius.lg` + clipped corner | `chat/ChatMessage.tsx` |
| Streaming | **Character-by-character** catch-up (`src.slice(0, len)`) | `chat/useTypewriter.ts` |
| Cursor | None | — |
| Markdown | **Lite** — bold, bullet/numbered lists, links only | `chat/ChatMessage.tsx` (`MarkdownLite`) |
| Code blocks / tables | **Not supported** | — |
| Thinking state | 3 pulsing dots ✅ (already matches spec) | `chat/ThinkingDots.tsx` |
| AI action row | **None** | — |
| Composer | Camera + paperclip + input + send; send dims when empty | `chat.tsx` |
| Voice button | None | — |
| List rendering | Plain `ScrollView` (not FlashList) | `chat.tsx` |
| Background motion | Static `lab.bg`; `LabScreenBg` wash exists but unused here | `chat.tsx`, `components/LabScreenBg.tsx` |
| Reduced motion | Respected in bubbles + dots ✅ | `ChatMessage.tsx`, `ThinkingDots.tsx` |
| Haptics | Send = medium impact ✅; error ✅ | `chat.tsx` |

Already-installed deps we can lean on: `react-native-reanimated`, `expo-linear-gradient`,
`@shopify/flash-list`, `lucide-react-native`, `expo-haptics`, `react-native-keyboard-controller`.
**Not** installed: a markdown renderer, `expo-blur` (optional), `expo-clipboard` (needed for copy).

## The area files

Build roughly top-to-bottom — earlier files unblock later ones.

| # | Area | Effort | Risk | Depends on |
|---|---|---|---|---|
| [01](./01-theme-and-background.md) | Theme tokens + animated background | M | Med | — |
| [02](./02-layout-and-header.md) | Layout, whitespace, header | S | Low | 01 |
| [03](./03-messages.md) | AI no-bubble text + user bubble | M | Med | 01, 04 |
| [04](./04-typography.md) | Type system (Inter, sizes, spacing) | S | Low | 01 |
| [05](./05-streaming-and-motion.md) | Word streaming, cursor, autoscroll, motion | M | Med | 03 |
| [06](./06-input-and-buttons.md) | Input area, send/voice/attachment | M | Low | 01 |
| [07](./07-action-row.md) | AI action row (copy/share/speak/like) | M | Low | 03 |
| [08](./08-markdown-code-images.md) | Markdown, code blocks, images | L | Med | 03, 04 |
| [09](./09-performance-a11y-empty.md) | FlashList, a11y, empty/loading states | M | Med | 03, 05 |

Effort: S ≈ <½ day · M ≈ ½–1 day · L ≈ 1–2 days (single dev, incl. on-device verify).

## Shared conventions (apply to every area)

1. **Never hardcode a hex in a screen.** Add the dark-chat tokens to `src/constants/theme.ts`
   (proposed `labDark` object in [01](./01-theme-and-background.md)) and import by name.
2. **Reduced motion is not optional.** Every new animation reads `useReducedMotion()` and
   degrades to an instant/opacity fallback — matching `ThinkingDots`/`ChatMessage` today.
3. **Feature-flag the redesign.** Gate the new chat look behind a flag (e.g.
   `CHAT_UI_V2` in `src/lib/flags.ts`) so it can ship dark-off and be toggled on-device.
   The current light chat stays the fallback until V2 is signed off.
4. **Verify on device, not just tsc.** Metro gotcha still applies: run with `CI=1`, no hot
   reload → restart Metro `--clear` per change (see project memory).
5. **i18n:** any new visible string goes through `t()` with an English default, in all 6
   locales (en, zh-hant, zh-hans, ja, th, vi).

## Out of scope / deliberately dropped from plane.md

- **Gemini blue** (`#5C7CFA`) and the **navy/purple** gradient → replaced with green (01).
- **Google Sans** → Inter (04).
- App-wide dark theme → chat-only (this file).
