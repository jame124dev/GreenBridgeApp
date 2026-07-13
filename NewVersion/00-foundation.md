# GreenBridge Customer App — Screen Spec Foundation

> Shared foundation & reference for the NewVersion customer-app screen specs.
> Read this first, then the numbered screen files. Every screen spec assumes the tokens, recipes, and checklists defined here.

---

## Prerequisites (foundation setup)

These are set up **once, here, in the foundation** — every screen spec depends on them and must NOT re-implement them per file. When a screen spec lists items under its own `## Prerequisites (foundation setup)` section, it is pointing back to this master checklist so the reader knows they are already-owned setup steps, not per-screen rework.

- [ ] **Fonts** — add `HankenGrotesk_800ExtraBold` to the `useFonts({...})` load list in `app/_layout.tsx` (imported from `@expo-google-fonts/hanken-grotesk`) **and** expose it as `fonts.headingBold` in `src/theme/typography.ts`. (Hanken 700 = `fonts.heading` and 600 = `fonts.headingSemibold` are **already loaded**. Body/label stays **Inter** — the prototype's Plus Jakarta Sans is a documented simplification, do not add it.)
- [ ] **Color tokens** — add the green / buy / lab tokens listed in [Colors](#colors) to `@/constants/theme.ts` (the `brand` object or a new sibling export). They do **NOT** exist in the repo yet; treat them as "add per foundation," never "already present." Do not scatter raw hexes in screens — reference the token names.
- [ ] **`(lab)` route group** — create the `app/(lab)/` route group (Expo Router) that hosts the customer-app screens, gated by the `VITE_SITE_TYPE` / user-type fork so seller/scanner routes are untouched.
- [ ] **`src/features/lab/`** — create the feature folder for customer-app screen components, mocks, and hooks (keeps the variant isolated from seller code).
- [ ] **`src/animations/recipes.ts`** — create the motion recipes module exporting the named recipes (`RISE`, `POP`, `PULSE`, `SPIN`, `SLIDE-X`) plus `useReducedMotion()`-aware fallbacks. See [Animation & Interaction Recipes](#animation--interaction-recipes).

> **Haptics & Button already exist** — do NOT re-create them. Import `haptics` from `@/lib/haptics` and `Button` from `@/components/ui`. Their real, verified contracts are documented below; conform to them exactly.

---

## Overview

**GreenBridge NewVersion** is an **AI-first buy/sell marketplace** built as a customer-facing app that lives inside the existing GreenBridge Expo project.

- **Fork model**: The customer app is a **variant of the same codebase**, selected at runtime by an `.env` user type (`customer` vs. the existing seller/scanner variant). The **seller app is untouched** — we add customer screens and route to them when the user type is `customer`; we do not modify or regress the seller/scanner flows.
- **Product premise**: A single AI composer lets a user say what they want to **buy or sell**. AI drafts a listing (or a buy request), matches supply to demand, and hands matched parties into a managed chat "deal room." The whole experience is one guided AI flow, not a traditional form-based marketplace.
- **App flow (state machine)**:
  ```
  home → processing → draft → published → matches → match → deal
  ```
  plus a persistent **bottom nav** across the primary tabs. Each transition has defined entrance/exit choreography (see Animation Recipes).

---

## Tech Stack & Reuse Map

### Core framework
- **Expo** ~56.0.4 (SDK 56), **React** 19.2.3, **React Native** 0.85.3
- **Expo Router** ~56.2.6 (file-based routing, web support)
- **NativeWind** 4.2.4 + **Tailwind CSS** 3.4.19
- **TypeScript** ~6.0.3

### Animation & interaction
- **React Native Reanimated** 4.3.1 — shared values, gesture-driven micro-interactions
- **React Native Gesture Handler** ~2.31.1 — touch + swipe
- **Expo Haptics** ~56.0.3 — impact feedback on presses/actions
- **React Native Keyboard Controller** 1.21.6 — keyboard avoidance (wired at root)

### Lists, media, icons
- **Shopify FlashList** ^2.3.1 — virtualized long lists (matches/chat feeds)
- **React Native Reorderable List** ^0.18.0 — draggable/reorderable items
- **Gorhom Bottom Sheet** ^5.2.14 — native bottom-sheet primitives
- **Expo Image** ~56.0.9 (memory+disk cache, fade-in), **Image Picker** ~56.0.13, **Image Manipulator** ~56.0.14, **Camera** ~56.0.7
- **React Native SVG** 15.15.4, **Expo Linear Gradient** ~56.0.4
- **Lucide React Native** ^1.16.0 — icons (`import { ChevronDown, Sparkles, Send, Check } from 'lucide-react-native'`)

### Forms, state, data
- **React Hook Form** ^7.76.1 + **Zod** ^4.4.3 + **Hookform Resolvers** ^5.4.0
- **Zustand** ^5.0.13 — UI state (mode toggle, filters, preferences)
- **React Native MMKV** ^4.3.1 + **Async Storage** ^3.1.0 — persistence
- **TanStack React Query** ^5.100.14 — data fetching + caching (wire in Dynamic phase)
- **Axios** ^1.16.1, **Socket.io Client** ^4.8.3, **React Native SSE** 1.2.1 — HTTP / realtime / streaming
- **Sonner Native** ^0.25.1 — toasts; **Expo Notifications** ~56.0.13 — push

### Platform / a11y
- **Safe Area Context** ~5.7.0, **React Native Screens** 4.25.2, **Zoom Toolkit** ^5.1.0, **Expo Dev Client** ~56.0.18
- **i18next** 26.2.0 + **react-i18next** 17.0.8, **date-fns** ^4.3.0, **Currency Input** ^1.1.1, **Netinfo** 12.0.1, **Expo Constants/Linking/Location/Secure Store/Document Picker**

### UI component library (reuse first — import from `@/components/ui`)

| Component | Purpose | Key props / variants |
|---|---|---|
| **Button** | CTA, form submit | variants `primary`/`secondary`/`ghost`/`destructive`/`danger`; sizes `sm` **48px** (`h-12`) / `md` **56px** (`h-14`) / `lg` **64px** (`h-16`); `leftIcon`/`rightIcon`, `loading`, `fullWidth`, boolean `haptic` (default `true` → Light). Press scale **0.97**. For a MEDIUM CTA haptic: `haptic={false}` + `haptics.impact()` in `onPress`. For 44/54px heights: `style={{height:N}}` override or bespoke Pressable. See [contract](#button--haptics-contract-componentsuibutton-libhaptics--verified). |
| **Card** | Container | variants `flat`/`elevated`/`outlined`; compound `Card.Header` (icon+title+desc), `Card.Body` |
| **Input** | Text/number/email | `label`, `error`, `hint`, `leftIcon`/`rightIcon` (+`onPressRightIcon`), focus/error states |
| **Text** | Typography primitive | variants `caption`/`bodySm`/`body`/`bodyMd`/`subtitle`/`title`/`hero`; tones `primary`/`secondary`/`tertiary`/`inverse`/`danger`/`brand` |
| **Badge** | Status/label pills | `live`/`success`, `pending`/`review`/`ai`/`warning`, `inspect`/`submitted`/`info`, `danger`, `inactive`/`neutral`; sizes `sm`/`md`; `dot`, `leftIcon` |
| **Field** | Label+control+error wrapper | `label`, `hint`, `error`, `flex` |
| **Screen** | Root layout (SafeArea+scroll) | `scroll`, `padded`, `keyboardAware`, `edges` (default `['top']`) |
| **Sheet** | Bottom-sheet modal | `visible`, `onClose`, `title`, `subtitle`, `maxHeight`; compound `Sheet.Option` |
| **SelectButton** | Dropdown trigger (read-only) | `value`, `leftIcon`, animated press |
| **PickerSelect** | Dropdown + modal picker | `value`, `options`, `onChange`, `title`; auto-scroll to selection |
| **Stack / HStack** | Flex shortcuts | `gap`, `align`, `justify`, `flex`, `wrap` |
| **AppImage** | Cached image | wraps `expo-image`; memory-disk cache, 200ms fade, `contentFit: cover` |
| **EmptyState** | Empty/error message | `icon`, `title`, `description`, `actionLabel`, `onAction` |
| **SectionLabel** | Small-caps section header | `label`, `required` (red asterisk), `ai` (✨ badge) |

**Do NOT add new deps** for: segmented control (Button variants + `flex-row` + state), progress bars (Reanimated `Animated.View` width), avatars (AppImage + `rounded-full`), rings/badges (Badge), blur (Linear Gradient), chat (FlashList + Card + Text).

### New-screen template
```tsx
import { Screen, Text, Button, Card, Badge, Input, EmptyState } from '@/components/ui';
import { theme } from '@/constants/theme';
import { ChevronRight, Search } from 'lucide-react-native';

export default function Example() {
  return (
    <Screen padded scroll>
      <Text variant="title" tone="primary">Your Matches</Text>
      {/* ... */}
    </Screen>
  );
}
```
Imports: UI `@/components/ui`, icons `lucide-react-native`, tokens `@/constants/theme`, data `@tanstack/react-query`, nav `expo-router`.

---

## Design Tokens

Two token sources exist. **New customer screens use `@/constants/theme`** (semantic roles); `@/theme/*` is legacy Stitch hex for old screens.

### Fonts
Load families and map to roles:

| Role | Family / weight | Notes |
|---|---|---|
| Display H1 (28–34px) | Hanken Grotesk **800** | **PREREQUISITE — must add** (see [Prerequisites](#prerequisites-foundation-setup)): add `HankenGrotesk_800ExtraBold` to the `useFonts` load list in `app/_layout.tsx` **and** expose as `fonts.headingBold` in `src/theme/typography.ts`. App currently loads only Hanken 600/700 — 800 is NOT loaded yet. |
| Heading H2–H4 (20–24px) | Hanken Grotesk 700 | existing `fonts.heading` (already loaded) |
| Subheading (16–18px) | Hanken 600 (`fonts.headingSemibold`, already loaded) or Inter 700 | |
| Body (13–16px) | **Inter** 400/600/700 | prototype spec'd Plus Jakarta Sans; **keep Inter** as a documented system simplification (better RN small-screen rendering) |
| Label / small-caps (10–12px) | IBM Plex Sans 500/600 | uppercase caps e.g. "FOR SALE", "WANTED"; letter-spacing 0.04–0.12em |
| Code / numeric | JetBrains Mono 400 | |

Typography variants (`@/constants/theme.typography`):
```
caption  12/16 500   bodySm 14/20 400   body 16/24 400   bodyMd 16/24 500
subtitle 18/26 600   title  24/30 700   hero 32/38 700
```

<a id="colors"></a>
### Colors (`@/constants/theme` — brand overrides, light theme)

> **All NEW colors live in `@/constants/theme.ts`** — NOT `src/theme/colors.ts` (that is legacy Stitch hex for old screens). Reference tokens by name; never scatter raw hexes in screens.
```
brand.primary        #14452f  primary button / active state
brand.primaryDim     #1f7a4d  success text / AI badge
brand.primarySurface #e6f2eb  soft green chip bg / Sheet active
brand.primaryBorder  #bfe3cd  edge accent / Sheet option border
brand.foreground     #121c28  primary text
brand.background     #f8f9ff  screen bg (cool-neutral "clean floor")
brand.surface        #ffffff  cards, inputs
brand.divider        #eef2f9
brand.textMuted      #5b6b63
brand.destructive    #dc3737
brand.warning        #f59e0b
brand.tertiary       #f4b400  amber accent (progress/highlights)
```
Base scales: `primary` (emerald, #10B981 @500), `neutral` (0–950), `success` #16A34A, `warning` #F59E0B, `danger` #DC2626, `info` #0EA5E9.

**PREREQUISITE — green / buy / lab tokens to ADD to `@/constants/theme.ts`.** These do **NOT** exist in the repo yet (verified). The foundation owns adding them (see [Prerequisites](#prerequisites-foundation-setup)); every screen spec references them by name and treats them as "add per foundation," never "already present." Exact names + hexes to add:
```
greenDarkest   #0E3B2E  dark brand accent (buttons, primary CTA)
greenDark      #16794A  rings, toggle state, processing
greenMedium    #16A35A  success / match ring / progress
greenLight     #34D08C  glows, icon highlights
buyBlue        #2563EB  BUY mode, WTB labels, demand UI
buyBlueDim     #3B82F6  hover / progress
buyBlueSurface #EEF3FE  buy-mode card bg
warnAmber      #E8A21A  "worth a look", match 91–94%
```
(The `brand.*` tokens listed above — `primary #14452f`, `primaryDim`, `primarySurface`, `primaryBorder`, `tertiary #f4b400`, etc. — DO already exist in `@/constants/theme.ts`. Only the eight green/buy tokens in this block are new.)

**Application rules:**
- Primary action: `greenMedium`/`brand.primary` in **sell** mode, `buyBlue` in **buy** mode.
- Text on greens darker than `#16A35A`: always white.
- Card backgrounds: `surface`/`surfaceMuted` only, never tinted.
- Status edges on card rows: green = live, amber = pending, blue = inspect.
- **Dark mode**: not in v1 (light only). Documented as v2; when added, desaturate greens and flip surfaces, keep ≥4.5:1 contrast.

### Spacing (`@/constants/theme.spacing`, 4px base)
```
xs 4  sm 8  md 12  lg 16  xl 20  2xl 24  3xl 32  4xl 40  5xl 56  6xl 72
```
NativeWind classes: `gap-md`, `p-lg`, `px-xl`, `py-2xl`. Patterns: screen padding 16px (small) / 24px (large); section gap 24px; card padding ~18px; icon↔text gap 8px.

### Radius (`@/constants/theme.radius`)
```
sm 8  md 12  lg 16  xl 20  2xl 24  hero 40  full 9999
```
Cards/sheets `rounded-2xl` (24px), buttons/inputs `rounded-xl` (12px), pills `rounded-full`. Prototype favors rounder cards — prefer `lg`+ (≥16px), never below 12px on containers.

### Elevation / shadows (`@/constants/theme.elevation`)
```
none | sm (y1, α0.05) | md (y4, α0.08, default cards) | lg (y8, α0.10, modals)
```
NativeWind has no elevation class — use `elevation` from constants inline or Card's variant.

### Motion timing (`@/constants/theme.motion`)
```
tap 100  micro 150  short 220  medium 280  long 360
spring { damping 18, stiffness 220 }   springSoft { damping 22, stiffness 160 }
```

---

<a id="animation--interaction-recipes"></a>
## Animation & Interaction Recipes

Named, referenceable recipes live in **`src/animations/recipes.ts`** (a PREREQUISITE to create — see [Prerequisites](#prerequisites-foundation-setup)). The canonical named recipe set is **RISE, POP, PULSE, SPIN, SLIDE-X**; `PROGRESS` and the confidence ring below are screen-specific helpers built on the same primitives. Screen specs cite these by name. Ports of the web prototype's CSS keyframes into Reanimated worklets, targeting **60 FPS locked**. All continuous animations use `useSharedValue` + `useAnimatedStyle` (no JS-side calc in animated components).

> **Press scale is `0.97` everywhere** — custom `Pressable`s must use the same press-in scale as `@/components/ui/Button` (0.97 over `motion.tap`, spring back). Never 0.95/0.92 for press feedback.

| Recipe | Type | Duration | Easing | Use |
|---|---|---|---|---|
| **RISE** | entrance fade + slide-up 10px | 350ms | spring (0.75 damping) | screen entries, drawers |
| **SPIN** | infinite rotation 360° | 1000ms | linear | processing spinner, loading |
| **PULSE** | opacity 0.35↔1 loop | 1500ms | inOut cubic | secondary "in-progress" indicator |
| **POP** | scale 0.92→1 + fade | 300ms | spring (1.2 damping, slight overshoot) | card/chip reveals, confirmations; **stagger 80ms** in lists |
| **SLIDE-X** | horizontal translate | 280ms | Material decel `bezier(.4,0,.2,1)` | sell/buy mode toggle, tab switch |
| **PROGRESS** | width 6%→100% | 800ms | out cubic | step-completion bars |

**Confidence ring** (MATCH screen): SVG `Circle` with `strokeDasharray`/animated `strokeDashoffset`, draw to % over 1200ms out-cubic, stroke `greenMedium` (`#16A35A`), r=56 in 128px box. (`conic-gradient` from the prototype is NOT native — use the SVG ring.)

**Button press** — the shipping `@/components/ui/Button` already does this; do NOT re-implement:
- press-in `scale 1 → 0.97` over `motion.tap` (100ms) via Reanimated `withTiming`; release springs/times back to `1`. **Scale is 0.97, not 0.95.**
- The `haptic` prop is a **boolean** (default `true`) and fires `expo-haptics` **Light** (`impactAsync(Light)`) internally on press.
- Custom `Pressable`s in screens use the **same `0.97`** press scale to match Button.

### Button + haptics contract (`@/components/ui/Button`, `@/lib/haptics`) — VERIFIED

Real `Button` sizes (there is **NO** 44px or 54px size):

| size | height | class |
|---|---|---|
| `sm` | **48px** | `h-12` |
| `md` | **56px** | `h-14` (default) |
| `lg` | **64px** | `h-16` |

- **Default press haptic is Light** (boolean `haptic` prop → `impactAsync(Light)`).
- **To fire a MEDIUM haptic on a primary CTA** (Publish, Confirm, Send): pass `haptic={false}` on the Button and call `haptics.impact()` manually inside `onPress`.
- **Non-standard heights** (e.g. 44px composer send, 54px hero CTA): apply an explicit `style={{ height: N }}` override on top of the nearest size, **OR** build a bespoke `Pressable` — the screen spec must state which. (Min tap target stays ≥44px.)

### Haptic mapping — import `{ haptics }` from `@/lib/haptics` (NEVER import `expo-haptics` directly in a screen)

The ONLY exported verbs are `tap`, `impact`, `heavy`, `success`, `warning`, `error`. There is **no** `haptics.light()` or `haptics.medium()`.

| Verb | Feel | Use |
|---|---|---|
| `haptics.tap()` | light / selection | chips, toggles, tab/mode switch, list picks, card tap, back button, secondary taps |
| `haptics.impact()` | **MEDIUM** thump | primary CTA press: Send, Publish, Confirm match (paired with Button `haptic={false}`) |
| `haptics.heavy()` | heavy / shutter | camera shutter, irreversible confirm |
| `haptics.success()` | positive notification | successful publish / save / confirm (use sparingly) |
| `haptics.warning()` | caution notification | destructive-intent surface (open Sign-out / Delete sheet) |
| `haptics.error()` | failure notification | submit failed, network error |

- **Map any legacy naming**: `light()` → `tap()`, `medium()` → `impact()`, `selectionAsync` → `tap()`.
- Rule: never haptic on passive transitions (fade-in, scroll). Confirm/selection actions only.

### Reduced motion (`useReducedMotion()`)
Every animated value MUST specify a static fallback:
- **RISE** → `FadeIn` (200ms, opacity only, no translate).
- **POP** → `FadeIn` (no scale).
- **SLIDE-X** → instant snap (no translate).
- **SPIN** → static (no rotation; show the resting icon / checkmark).
- **PULSE** → static opacity `1`.
- **PROGRESS** → set final width instantly (no animated fill).
- **Press scale (0.97)** → no scale; keep at `1`.

### Suggested code layout
```
src/animations/recipes.ts        (RISE, POP, PULSE, SPIN, SLIDE-X  + PROGRESS helper)
src/hooks/useAnimationConfig.ts  (wraps useReducedMotion → static fallbacks)
```
> Haptics do **not** live here — they are the existing `@/lib/haptics` module (`tap/impact/heavy/success/warning/error`). Do not create a second haptics file under `src/animations`.

### Screen transition matrix
| From → To | Animation | Duration | Easing |
|---|---|---|---|
| home → processing | RISE | 350ms | spring 0.75 |
| processing → draft | RISE exit + enter | 350ms | spring 0.75 |
| draft → published | RISE + scale 0.97→1 | 400ms | spring 1.2 |
| home → matches | fade | 250ms | linear |
| matches → match | RISE (bottom-up modal) | 350ms | spring 0.75 |
| match → deal | slide-right + fade | 350ms | cubic out |

---

## Native Screen-Management Checklist

Every screen spec must pass these five scenarios. Copy the per-screen block into each spec.

**A. Safe area (notch / Dynamic Island / home indicator)**
- Fixed headers wrap in `SafeAreaView edges={['top']}` (or explicit top inset).
- Bottom nav / sticky elements add `useSafeAreaInsets().bottom` to height+padding.
- Floating modals use `edges={['top','bottom']}`. No absolute-bottom element ignores the ~34px iOS home indicator.
- Test: iPhone SE, iPhone 14 Pro (Dynamic Island), Pixel 7 (gesture pill).

**B. Keyboard avoidance (composer / chat)**
- Inputs inside a scrollable `ScrollView`; root already wraps screens in `KeyboardProvider`.
- Send button sticky-bottom (outside scroll or absolute), never obscured.
- Initial focus does not jar-scroll; on focus scroll to keep button visible; attachments row stays above keyboard.

**C. Small vs. large device (SE 375px → Pro Max 430px)**
- No fixed widths on containers — use `flex:1` / `max-width` + padding.
- Images use `aspectRatio`, not fixed w/h. Padding scales 16px (small) / 24px (large).
- Optional font scaling by `useWindowDimensions().width < 400`.

**D. Long content + scroll vs. fixed CTA**
- Long content in `ScrollView`; primary CTA outside scroll (sticky/absolute bottom).
- ScrollView `paddingBottom ≥ button height + insets` (spacer view) so content never hides under the CTA.

**E. Android nav bar + dark-mode stance**
- Bottom nav adds `useSafeAreaInsets().bottom`; tab bar is opaque white (not transparent), dark icons/labels.
- Dark mode is a v2 feature — light only in v1; when added keep ≥4.5:1 contrast, desaturate greens, flip surfaces.

**Per-screen block to paste:**
```
Safe area:   [ ] top edge  [ ] bottom inset  [ ] no Dynamic Island overlap
Keyboard:    [ ] input in ScrollView  [ ] CTA sticky  [ ] onFocus scroll (if input)
Responsive:  [ ] flex widths  [ ] SE + Pro Max tested  [ ] aspectRatio images
Scroll/CTA:  [ ] content scrolls  [ ] CTA outside scroll  [ ] paddingBottom spacer
Android/DM:  [ ] nav inset  [ ] opaque tab bar  [ ] dark icons  [ ] contrast ≥4.5:1
Polish:      [ ] card radius ≥12px  [ ] 4px spacing tokens  [ ] shadow sm/md
```

---

## Static-First, Then Dynamic

**Build every screen with hardcoded data first; wire APIs later.**

- **Phase 1 (Static)**: Implement full layout, tokens, animations, haptics, and native robustness using in-file mock data (mock listings, mock matches, mock chat messages). No network calls. This lets us nail visual + motion polish and validate the flow end-to-end on device before backend contracts are final.
- **Phase 2 (Dynamic)**: Swap mocks for real data via **TanStack React Query** (`useQuery`/`useMutation`), realtime via **Socket.io** / **React Native SSE** (streaming AI draft, deal-room messages), and Zustand for cross-screen UI state. Keep component shapes identical so the swap is a data-source change, not a rewrite.
- The processing timing (2.6s in the prototype) is a static placeholder — in dynamic mode tie it to the actual AI/streaming response.

---

## Screen Index

App-flow order. Each file follows this foundation.

| # | File | Screen | Role in flow | Key recipes |
|---|---|---|---|---|
| 01 | `01-home-tell-ai.md` | Home / Tell-AI composer | Entry: mode toggle (sell/buy) + AI composer + quick-start chips | SLIDE-X (toggle), POP (chips), press-scale |
| 02 | `02-processing.md` | Processing | AI working: spinner + 3-step choreography → auto-advance | RISE, SPIN, PULSE, PROGRESS |
| 03 | `03-draft.md` | Draft | Review AI-generated listing (specs, price, demand callout) | RISE, POP (staggered spec list) |
| 04 | `04-published.md` | Published | Celebration + "matched" badge after publish | RISE+scale, POP (checkmark, avatars) |
| 05 | `05-matches.md` | Matches | Feed of match cards | fade-in, POP stagger, FlashList |
| 06 | `06-match.md` | Match detail | Confidence ring, why-matched, side-by-side FOR SALE/WANTED, CTA | RISE (modal), confidence ring, POP |
| 07 | `07-deal.md` | Deal room | Managed chat between matched parties | slide-in messages, scroll-to-latest |
| 08 | `08-bottom-nav.md` | Bottom nav | Persistent tab bar across primary tabs | POP (badge count), Android inset handling |
