# 101LAB Mobile — Bottom Navigation (Frosted Tab Bar) Design Spec

Implementation-ready spec for the persistent frosted bottom navigation bar. Built as a real Expo Router custom `tabBar` that renders on the "shell" screens and is absent on the "flow" screens, fully interactive on static data (no APIs). Matches `101LAB Mobile.dc.html` lines 436–463 1:1.

> **Prototype provenance.** In the HTML this is a single absolutely-positioned bar (`position:absolute; bottom:0`) gated by `<sc-if value="{{ showNav }}">`, where `showNav = ['home','matches','browse','deals'].includes(s) || s === 'published'`. Active tint is `#0E3B2E`, idle is `#9AA89F`, the Matches tab carries a static orange `3` badge (`#E8841A`), and the bar is frosted glass (`rgba(255,255,255,.92)` + `backdrop-filter:blur(14px)`). Verified against source lines 438–461 (markup) and the state block 469–599.

---

## Prerequisites (foundation setup)

These are owned by [`00-foundation.md` → Prerequisites](./00-foundation.md#prerequisites-foundation-setup) and set up **once** there — this screen only *references* them by token/recipe name; it does NOT re-implement them. Confirm they are in place before building the tab bar:

- [ ] **Color tokens** — the green/lab tokens are added to `@/constants/theme.ts` per the foundation ([Colors](./00-foundation.md#colors)). This screen uses `greenDarkest #0E3B2E` (active tint) and `greenLight #34D08C` (dark-mode active, v2). **`navBorder #E8EEE9` and `badgeOrange #E8841A` are NOT yet in the foundation token list** → they are added by this screen as part of the same foundation `@/constants/theme.ts` block (see §2.5 / §3.4). Treat ALL of these as "add to `@/constants/theme.ts` per foundation," never "already present."
- [ ] **Fonts** — Inter is already loaded (`fonts.bold` = `Inter_700Bold`, `fonts.regular`, `fonts.semibold`). This screen needs **only Inter** — it does not use Hanken 800. (The prototype's Plus Jakarta Sans and its badge "800" weight are documented simplifications; render label + badge with `fonts.bold`. See §2.6.)
- [ ] **`(lab)` route group** — the customer-app route group exists. This screen's tab group lives at `app/(lab)/(tabs)/` (or the project's chosen `(tabs)` group inside the customer fork). Route names below (`index`, `browse`, `matches`, `deals`, `account`) are relative to that group.
- [ ] **`src/features/lab/`** — the customer-app feature folder exists. Nav chrome components (§3.3) may live under `src/components/nav/` (shared chrome) or `src/features/lab/nav/` per the project's layering — state which; this spec uses `src/components/nav/`.
- [ ] **`src/animations/recipes.ts`** — the motion recipes module exists (`POP` used here for the badge; press-scale uses the shared **0.97** press feel documented in the foundation, NOT a bespoke value). See §6.

> **Haptics & Button already exist** — do NOT re-create them. This screen imports `{ haptics }` from `@/lib/haptics` and uses only the verified verbs. It does NOT use `@/components/ui/Button` (the tab item is a bespoke `Pressable`, §3), and it NEVER imports `expo-haptics` directly.

---

## 1. Purpose & Place in Flow

**What it is:** A persistent, frosted bottom tab bar with five destinations — **Home / Browse / Matches / Deals / Account** — that anchors the app's "shell" screens. It is the primary way users move between the main areas of the managed marketplace.

**Where it appears (SHOW nav):**
- `home` — AI composer landing
- `browse` — catalog/search (reuses matches feed layout in prototype)
- `matches` — match feed (the orange badge count lives here)
- `deals` — deals list
- `published` — the celebration screen keeps the nav visible so the user can jump straight to Matches

**Where it is hidden (HIDE nav):**
- `processing` — full-screen spinner, no chrome
- `draft` — AI listing review, sticky publish CTA owns the bottom
- `match` — modal-style detail (bottom-up), no tab bar
- `deal` — chat room, composer owns the bottom

**Entry points into the nav-bearing screens:**
- App launch → `home`
- `published` → tapping "See your matches" → `matches` (tab flips to Matches)
- Any tab press → its destination

**Exits / navigation targets (per tab):**
| Tab | Route | Prototype handler | Notes |
|-----|-------|-------------------|-------|
| Home | `/(tabs)` (`index`) | `navHome → go('home','home')` | |
| Browse | `/(tabs)/browse` | `navBrowse → go('browse','browse')` | |
| Matches | `/(tabs)/matches` | `navMatches → go('matches','matches')` | orange count badge |
| Deals | `/(tabs)/deals` | `navDeals → go('deal','deals')` | ⚠️ In the prototype "Deals" navigates to the single `deal` chat screen (`go('deal','deals')`) — the tab highlights `deals` but the destination is the deal room. In the RN app, Deals is a proper list screen at `/(tabs)/deals`; the deal *room* is a pushed detail route `/deal/[id]` that HIDES the bar. |
| Account | `/(tabs)/account` | `onClick={{ navHome }}` (stub) | ⚠️ Prototype wires Account's tap to `navHome` (line 458) and hard-codes its color to idle `#9AA89F` (never active). Treat as an unfinished stub: in the RN build, wire it to its own `/(tabs)/account` route with proper active tint. |

---

## 2. Visual Layout (exact, from HTML lines 438–461)

Top-to-bottom / left-to-right structure of the bar container and its five items.

### 2.1 Bar container (line 438)
```
position:        absolute; bottom:0; left:0; right:0;  (spans full width, pinned to bottom)
background:      rgba(255,255,255,0.92)     ← frosted white
backdrop-filter: blur(14px)                 ← 14px gaussian blur behind (SEE §6 blur note — NOT reproduced natively)
border-top:      1px solid #E8EEE9          ← hairline top divider (cool green-gray)
padding:         9px 14px 26px              ← top 9 / sides 14 / bottom 26 (26 = home-indicator allowance in mock)
display:         flex; align-items:center; justify-content:space-between
z-index:         30                         ← floats above scroll content
```
Content row height ≈ **icon 23 + gap 4 + label ~12 = ~39px**, plus 9px top pad. In RN the `26px` bottom pad is replaced by `9 + safeAreaInsets.bottom` (see §7).

### 2.2 Tab item (repeated ×5, e.g. lines 439–442)
```
layout:      flex:1  (equal width, 5 columns)
button:      background:none; border:none; cursor:pointer
stack:       display:flex; flex-direction:column; align-items:center; gap:4px
icon:        <svg 23×23> stroke=currentColor stroke-width:2 (round caps/joins)
label:       <span> font-size:9.5px; font-weight:700
color:       {{ navXColor }}  → active #0E3B2E / idle #9AA89F  (drives both icon stroke + label via currentColor)
```

### 2.3 Icons (Lucide equivalents — `lucide-react-native` ^1.16.0, installed)
| Tab | Prototype SVG path | Lucide RN icon | size | stroke |
|-----|--------------------|----------------|------|--------|
| Home | house outline `m3 9 9-7 9 7v11…` + `M9 22V12h6v10` | `Home` | 23 | 2 |
| Browse | magnifier `circle r7 + m21 21-4.3-4.3` | `Search` | 23 | 2 |
| Matches | 4-point sparkle/star `M12 3l1.6 4.4…` | `Sparkles` | 23 | 2 |
| Deals | speech bubble `M21 15a2 2 0 0 1-2 2H7l-4 4V5…` | `MessageSquare` | 23 | 2 |
| Account | person `circle cx12 cy8 r4 + M4 21v-1a6 6…` | `User` | 23 | 2 |

> Lucide RN icons already default to `strokeWidth={2}`, round caps/joins, `viewBox 0 0 24 24` — 1:1 with the prototype's inline SVGs. Pass `size={23}` and `color={…}` only.

### 2.4 Matches badge (lines 448–450)
Positioned relative to the icon, not the whole button:
```
wrapper:     <View position:relative>  around the icon only
badge:       position:absolute; top:-4px; right:-6px
size:        minWidth:15px; height:15px; paddingHorizontal:3px
radius:      99px (full)
background:  #E8841A            ← orange (count/attention accent) → token badgeOrange
color:       #fff
font:        8.5px / weight 800  → fonts.bold (Inter_700Bold; 800 not loaded, see §2.6); lineHeight 12 (absolute px, RN-required)
border:      1.5px solid #fff   ← white ring separates badge from icon
content:     "3" (static)
align:       center / center
```

### 2.5 Color tokens (canonical source = `@/constants/theme.ts`, verified)
> **All NEW colors live in `@/constants/theme.ts`** per the foundation ([Colors](./00-foundation.md#colors)) — NOT `src/theme/colors.ts` (that is legacy Stitch hex for the old seller screens). Reference tokens by name via `import { theme } from '@/constants/theme'` (or the `brand`/green token exports); never scatter raw hexes. The two nav-specific tokens below (`navBorder`, `badgeOrange`) are added to that same `@/constants/theme.ts` block as part of the foundation prerequisite (see §3.4).

| Purpose | Prototype hex | Token (in `@/constants/theme.ts`) | Status |
|---------|---------------|-----------------------------------|--------|
| Active icon + label | `#0E3B2E` | `greenDarkest` | **foundation prerequisite** — already in the foundation green-token block ([Colors](./00-foundation.md#colors)); do NOT invent a `navActive` token, reuse `greenDarkest`. |
| Idle icon + label | `#9AA89F` | `navIdle '#9AA89F'` | **add** — nearest existing `textMuted '#5b6b63'` is too dark and `neutral.400 '#9CA3AF'` too blue; add exact `#9AA89F` (see §3.4). |
| Bar fill | `rgba(255,255,255,0.92)` | `surface` (`#ffffff`) @ 0.92–0.96 alpha (inline `rgba`, §6) | reuse `brand.surface` / white. |
| Top border | `#E8EEE9` | `navBorder '#E8EEE9'` | **add** — nearest existing `divider '#eef2f9'` is cooler; add exact (see §3.4). |
| Badge fill | `#E8841A` | `badgeOrange '#E8841A'` | **add** — distinct from `tertiary '#f4b400'` / `warning '#f59e0b'`; add exact (see §3.4). |
| Badge text / ring | `#fff` | `surface` / white | reuse. |
| Dark-mode active (v2) | `#34D08C` | `greenLight` | **foundation prerequisite** — already in the foundation green-token block; used only when dark mode ships (§7E). |

### 2.6 Fonts (verified against `src/theme/typography.ts`)
Labels are 9.5px / 700 in the prototype (Plus Jakarta 700). App substitutes **Inter** for body → use `fonts.bold` (`Inter_700Bold`), which is loaded at startup in `app/_layout.tsx`. This is a **documented, deliberate simplification** (Inter renders better than Plus Jakarta at small RN sizes) — do NOT add Plus Jakarta.
- ⚠️ The legacy tab layout uses `fontFamily: 'Inter_500Medium'` inline — that weight is **explicitly NOT loaded** per `typography.ts`. Do NOT copy it. Use `fonts.bold` for the 700 label.
- Badge "800" weight is not loaded either (the app only loads Hanken 800 as `fonts.headingBold`, and that's a headline face — wrong family for a numeric badge). Render the badge with `fonts.bold` (Inter 700). The visual delta at 8.5px is imperceptible; do not add an Inter 800 just for the badge.
- **lineHeight is mandatory and absolute (px):** label `lineHeight: 12` at 9.5px, badge text `lineHeight: 12` at 8.5px. RN requires absolute px lineHeight (never a CSS multiplier / `normal`) for correct vertical centering and to prevent clipping.

---

## 3. Component Breakdown

This is **navigation chrome**, not a content screen — build it as an Expo Router custom `tabBar`, NOT a `<Screen>`-wrapped page. It does not use the `@/components/ui` content primitives.

### 3.1 Reuse (all already installed — no new deps except the blur decision in §6)
| Piece | Source | Import | Installed? |
|-------|--------|--------|-----------|
| Icons | Lucide | `import { Home, Search, Sparkles, MessageSquare, User } from 'lucide-react-native'` | ✅ `^1.16.0` |
| Color tokens | theme | `import { brand } from '@/constants/theme'` (+ the green/nav tokens from that module) | ✅ (nav tokens added per foundation, §3.4) |
| Fonts | typography | `import { fonts } from '@/constants/theme'` (re-exported there from `src/theme/typography`) | ✅ |
| Safe area | RN safe-area | `import { useSafeAreaInsets } from 'react-native-safe-area-context'` | ✅ `~5.7.0` |
| Haptics | `@/lib/haptics` | `import { haptics } from '@/lib/haptics'` — call `haptics.tap()` (tab switch). **NEVER** `import * as Haptics from 'expo-haptics'` in a screen. | ✅ |
| Reanimated | animation | `import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, useReducedMotion, ZoomIn, FadeIn } from 'react-native-reanimated'` (+ `useEffect` from `react` to drive the tint value on focus change) | ✅ `4.3.1` (+ `react-native-worklets` `0.8.3`) |
| Tab bar props type | expo-router / react-navigation | `import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'` | ✅ transitive via `expo-router ~56.2.6`. If TS can't resolve it, use the inline fallback in the skeleton (`type BottomTabBarProps = { state: any; navigation: any; descriptors?: any }`) — the runtime shape is what `<Tabs tabBar={...}>` supplies. |
| Gradient (blur fallback) | expo | `import { LinearGradient } from 'expo-linear-gradient'` | ✅ `~56.0.4` |

> **⚠️ `expo-blur` is NOT installed** and the Foundation guide (§"Do NOT add new deps") explicitly says **blur → use Linear Gradient**, native doesn't blur well. Therefore the SOLID / gradient fallback is the DEFAULT path here, not a maybe. Do not add `expo-blur` for this bar. See §6.

> **Do NOT reuse** the existing capsule tab bar in `app/(tabs)/_layout.tsx` (green `#14452f` pill + white icon capsule, `tabBarShowLabel:false`). The prototype's frosted, flat, 5-tab, tinted-icon design is a different visual system. This spec **replaces** that layout's `screenOptions.tabBarStyle`/`tabBarIcon` with a custom `tabBar` renderer.

### 3.2 Migration from the current tab set — IMPORTANT
The live `app/(tabs)/_layout.tsx` currently declares **five `Tabs.Screen`s**: `index`, `scan` (`href:null`, camera crash), `history`, `profile`, `inbox` (`href:null`). The new spec is a different five: `index`, `browse`, `matches`, `deals`, `account`.
- Keep `index` (Home).
- Rename/repurpose `history` → and `profile` → account, or add fresh `browse`/`matches`/`deals`/`account` screen files and retire `history`/`profile`.
- `scan` stays `href:null` (still crashing — see MEMORY: stale dev-client) so it has no tab button but the `/scan/camera` route stays reachable. It renders the bar behind it only if it lives inside `(tabs)`; the camera should HIDE the bar (push it as a flow route or keep `href:null` + full-screen).
- `inbox` (`href:null`) → fold into `deals`/`deal/[id]` or keep hidden.

### 3.3 New components to create
```
src/components/nav/
  FrostedTabBar.tsx     — custom tabBar for <Tabs tabBar={props => <FrostedTabBar {...props} />}>
                          renders the frosted container + maps 5 routes → TabBarItem
  TabBarItem.tsx        — single tab: icon + 9.5px label + press scale + active tint cross-fade
  TabBadge.tsx          — the orange count pill (minWidth 15, h 15, #E8841A, white 1.5 border)
  tabConfig.ts          — static TAB_CONFIG + STATIC_BADGES (§5)
```
- **FrostedTabBar** owns: the frosted container (gradient/solid, §6), top hairline, `paddingBottom = 9 + insets.bottom`, `flexDirection:'row' + justifyContent:'space-between'`, and derives `focused` from `state.index`.
- **TabBarItem** props: `{ Icon: LucideIcon; label: string; focused: boolean; badgeCount?: number; onPress: () => void }`. Cross-fades active/idle icon by opacity (§6) and press-scales `1 ↔ 0.97` (§6 — the foundation press-scale, NOT 0.95).
- **TabBadge** props: `{ count: number }`. Renders nothing when `count <= 0`; caps display at `99+` (prototype only ever shows `3`).

### 3.4 Token additions (add to `@/constants/theme.ts` — foundation-owned)
Add these to `@/constants/theme.ts` (the canonical NEW-screen token source — NOT `src/theme/colors.ts`), as part of the foundation color-token prerequisite. Two of the four prototype colors are **already** covered by the foundation green tokens (`greenDarkest` for active, `greenLight` for dark-mode active) — do NOT duplicate them under `nav*` names. Only the two below are net-new and specific to the tab bar:
```ts
// in @/constants/theme.ts — nav-chrome accents (extend the brand/green token block)
navIdle:     '#9AA89F',   // idle icon + label (no existing near-match)
navBorder:   '#E8EEE9',   // top hairline (warmer than divider #eef2f9)
badgeOrange: '#E8841A',   // Matches count pill (distinct from tertiary/warning)
```
Active tint = the existing foundation token **`greenDarkest` (`#0E3B2E`)**; dark-mode active (v2) = **`greenLight` (`#34D08C`)**. Reference all of these by name in the components; never inline the hex.

---

## 4. Interactivity & Navigation

### 4.1 Tappable elements (5 tabs)
Every tab is a full-height `Pressable` (`flex:1`), min touch target 48px tall (§7C).

| Tab | On press | Active tint | Badge |
|-----|----------|-------------|-------|
| **Home** | `navigation.navigate('index')` + `haptics.tap()` | `greenDarkest` when focused | — |
| **Browse** | `navigation.navigate('browse')` + `haptics.tap()` | `greenDarkest` | — |
| **Matches** | `navigation.navigate('matches')` + `haptics.tap()` | `greenDarkest` | orange `3` |
| **Deals** | `navigation.navigate('deals')` + `haptics.tap()` | `greenDarkest` | — |
| **Account** | `navigation.navigate('account')` + `haptics.tap()` | `greenDarkest` (fix the prototype stub which never highlights it) | — |

- **Active detection:** derive `focused` from the custom tabBar's `state.index` (`focused = state.index === i`). Do NOT keep a separate `tab` state string as the prototype does — the router IS the source of truth.
- **Navigate target:** use the route `name` from `state.routes[i].name` and `navigation.navigate(name)`. This dedupes automatically — re-tapping the focused tab is a no-op (no double-push). Optional nice-to-have (not in prototype): re-tap focused tab → scroll-to-top.
- **Haptic:** `haptics.tap()` on every tab press — the Foundation Haptic Mapping classes **tab/mode switch as `haptics.tap()`** (the light/selection feel, `[00-foundation.md → Haptic mapping]`). There is **no** `haptics.light()`/`haptics.medium()`; `impact()` (MEDIUM) is reserved for primary CTAs, not tab switches. Import `{ haptics }` from `@/lib/haptics` — never `expo-haptics` directly. Never haptic on the destination screen entrance / passive re-render.

### 4.2 Show/Hide logic (which screens render the bar)
The bar is **only** rendered inside the `(tabs)` group. Flow screens live **outside** `(tabs)` as pushed stack routes, so the bar is naturally absent there:

```
app/
  (tabs)/_layout.tsx    → renders <FrostedTabBar>   [SHOW: home, browse, matches, deals, account]
    index.tsx           (home)
    browse.tsx
    matches.tsx
    deals.tsx
    account.tsx
    published.tsx       (href:null — shows bar, no tab button; see below)
  processing.tsx        [HIDE — pushed, full-screen]
  draft.tsx             [HIDE — pushed, sticky CTA]
  match/[id].tsx        [HIDE — modal presentation]
  deal/[id].tsx         [HIDE — chat, composer owns bottom]
```

**`published` special case:** the prototype keeps the nav visible on `published` even though it is not one of the four "tab" screens. Two valid implementations:
1. **Preferred:** make `published` a screen *inside* `(tabs)` (`(tabs)/published.tsx` with `options={{ href:null }}` so it has no tab button but still gets the bar). No tab is highlighted (all idle) — matching the prototype where `published` sets no active `tab`. To render all-idle, guard: if `state.routes[state.index].name === 'published'`, force every item's `focused=false`.
2. Alternative: render `<FrostedTabBar>` manually at the bottom of a standalone `published.tsx`.

Use option 1 for a single source of truth.

**No active tab on published:** when the focused route is `published`, all five items render idle (`#9AA89F`). The badge still shows on Matches.

### 4.3 Mode (sell/buy) variations
**The bottom nav itself has ZERO sell/buy variation** — the prototype's nav colors (`navHomeColor` etc.) depend only on the active `tab`, never on `mode`. Icons, labels, active/idle tints, and the badge are identical in both modes. (Sell/buy accent lives elsewhere — composer, draft, price — but **not** in the tab bar.) Do not tint the bar by mode.

---

## 5. Static Data Shape & Future Hook Points

### 5.1 Hardcoded config (ships now)
```ts
// src/components/nav/tabConfig.ts
import { Home, Search, Sparkles, MessageSquare, User } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

export type BadgeKey = 'matches' | 'deals';

export const TAB_CONFIG: ReadonlyArray<{
  name: string; label: string; Icon: LucideIcon; badgeKey?: BadgeKey;
}> = [
  { name: 'index',    label: 'Home',    Icon: Home },
  { name: 'browse',   label: 'Browse',  Icon: Search },
  { name: 'matches',  label: 'Matches', Icon: Sparkles, badgeKey: 'matches' },
  { name: 'deals',    label: 'Deals',   Icon: MessageSquare },
  { name: 'account',  label: 'Account', Icon: User },
] as const;

// Static badge counts — matches the prototype's hardcoded "3".
export const STATIC_BADGES: Record<BadgeKey, number> = { matches: 3, deals: 0 };
```
`TabBadge` reads `STATIC_BADGES.matches → 3`. Deals/others are `0` (hidden).

### 5.2 Future dynamic hook points
- **Badge count** → replace `STATIC_BADGES.matches` with a Zustand selector or React Query (`@tanstack/react-query ^5.100.14` is installed):
  ```ts
  // later: const { data } = useQuery({ queryKey:['matches','unseen'], queryFn: fetchUnseenMatchCount });
  // or:    const matchesBadge = useNavBadgeStore(s => s.unseenMatches);  // zustand ^5.0.13 installed
  ```
  Keep `TabBadge` pure (`count` prop) so the swap is a one-line change in `FrostedTabBar`.
- **Deals badge** (unread deal messages) → same pattern, `STATIC_BADGES.deals` → live unread count.
- **Tab visibility / gating** (e.g. hide Browse for unverified sellers) → a `useTabAccess()` hook returning a filtered `TAB_CONFIG`. Not needed now.

---

## 6. Animations & Micro-Interactions (Foundation recipes)

Reference: **`00-foundation.md` §"Animation & Interaction Recipes"**. Reanimated 4 + worklets are installed; all continuous animation via `useSharedValue`/`useAnimatedStyle`, 60 FPS locked.

| Interaction | Recipe | Spec |
|-------------|--------|------|
| **Bar entrance** | none (persistent) | The bar is persistent chrome inside `(tabs)`; it does NOT animate in/out per screen. It only mounts/unmounts when entering/leaving the `(tabs)` group (native stack transition handles that). |
| **Tab press feedback** | **Button press** (foundation press-scale) | On `pressIn`: inner stack `scale 1 → 0.97` + `opacity → 0.85` @`motion.tap` (100ms) `withTiming`. On `pressOut`: spring back to `1`/`1` (`withSpring`). Apply to the item's inner icon+label stack, NOT the whole 48px hit area. (**Scale is 0.97 — the same value `@/components/ui/Button` uses; the foundation mandates 0.97 everywhere, NOT 0.95/0.92.**) |
| **Active tint change** | color cross-fade | Lucide's `color` prop is not directly animatable via a Reanimated style. Use the **opacity cross-fade** approach: stack two absolutely-positioned copies of the icon — idle (`color=navIdle`) at `opacity: 1 - t`, active (`color=greenDarkest`) at `opacity: t` — where **`t` is a Reanimated animated value** driven by `withTiming(focused ? 1 : 0, { duration: 200 })` on every focus change (a `useDerivedValue`/`useSharedValue` + `useEffect` — NOT a plain `focused ? 1 : 0` number, which would snap instantly). Cross-fade the label the same way (two stacked `<Text>` copies) for a true 200ms fade; the robust RN path is opacity cross-fade of the two Texts. SLIDE-X easing (`bezier(.4,0,.2,1)`) is the "tab switch" motion but applies to the SCREEN transition, not the tint. |
| **Badge appear / count change** | **POP** (foundation recipe) | When count goes 0→N or changes, mount with `ZoomIn.duration(300)` (scale 0.92→1 + fade; spring 1.2 damping). Static `3` mounts with POP on first render for a subtle reveal. |
| **Badge idle** | (none) | No pulse in prototype. Keep static. |
| **Haptics** | `haptics.tap()` | `haptics.tap()` on tab tap (tab-switch class, foundation Haptic mapping). Import from `@/lib/haptics`; never call `expo-haptics` directly, and never `impact()`/`heavy()` here. Never on passive re-render or screen entrance. |

**Reduced motion (`useReducedMotion()`, foundation reduced-motion mapping):**
- Press-scale (0.97) → disabled (hold scale at `1`, no opacity dip); keep `Pressable`'s default press feedback.
- Active-tint cross-fade → instant snap (set `t` directly to `focused ? 1 : 0` with no `withTiming`, or duration 0).
- Badge POP → `FadeIn.duration(200)` (opacity only) per the foundation reduced-motion mapping (POP → FadeIn).

**Blur note (perf + dep policy):** The prototype's `backdrop-filter:blur(14px)` frosted look is **not reproduced with a blur library**. `expo-blur` is not installed, and the Foundation ("Do NOT add new deps") mandates "blur → Linear Gradient; native doesn't blur well." Ship the frosted illusion as either:
1. **Solid (simplest, recommended default):** `backgroundColor: 'rgba(255,255,255,0.96)'` — visually near-identical over the app's light `#f8f9ff` background.
2. **Gradient (optional):** a subtle top-to-bottom `LinearGradient` from `rgba(255,255,255,0.90)` → `rgba(255,255,255,0.98)` behind the row for a faint frosted gradient.
Do NOT add `expo-blur`.

---

## 7. Native Screen-Management (tailored checklist)

### A. Safe Area Insets (home indicator / Android nav bar) — CRITICAL
The bar is the bottom-most element, so it MUST absorb the bottom inset (prototype hard-codes `26px`; replace with dynamic inset).
```ts
const insets = useSafeAreaInsets();
// container:
paddingTop: 9,
paddingBottom: 9 + insets.bottom,   // replaces the prototype's fixed 26
paddingHorizontal: 14,
```
- [ ] Bottom pad = `9 + insets.bottom` (iPhone home indicator ~34, Android gesture pill ~48, 3-button ~56). The legacy layout already used this `+ insets.bottom` pattern (`_layout.tsx` lines 12–13) — reuse it.
- [ ] Top hairline `1px #E8EEE9` visible above content.
- [ ] Screens inside `(tabs)` add `contentContainerStyle.paddingBottom ≈ 68 + insets.bottom` so their last row isn't hidden behind the frosted bar (translucent, so content peeking through is expected, but the last item must be reachable/tappable).

### B. Keyboard Avoidance
- [ ] The tab bar has no inputs. Screens with a keyboard-driven composer (home composer, deal chat) are the concern. The **deal room HIDES the bar** (outside `(tabs)`), so its composer never fights the bar.
- [ ] On `home`, when the keyboard opens, the absolute bar would float over the keyboard. `react-native-keyboard-controller` (`1.21.6`, installed) is available. Mitigation options: (a) let the composer scroll above the bar and accept the bar behind the keyboard, or (b) hide the tab bar while the keyboard is up (`KeyboardController`/`Keyboard` listeners → animate bar `translateY` down or set `display:'none'`). Prototype doesn't address this; recommend (a) for simplicity, revisit if the composer send button is obscured.
- [ ] Never let the bar overlap an active send button.

### C. Small vs Large Device (SE 375 → Pro Max 430)
- [ ] Five `flex:1` columns — no fixed widths; scales cleanly across widths.
- [ ] Icon fixed 23px, label 9.5px both devices (do NOT scale the label up — 9.5px is intentional; clamp min 9px so it never wraps).
- [ ] Label single-line, `numberOfLines={1}`; at 375px width each column ≈ 69px, ample for "Matches"/"Account".
- [ ] Each `Pressable` min hit height 48px (`flex:1` fills the ~48px content row + inset pad); do not shrink below 48.
- [ ] Badge absolute offsets (`top:-4, right:-6`) are density-independent (dp) — same on all devices.

### D. Long Content + Scroll vs Fixed CTA
- [ ] Bar is `position:absolute` (Expo Router's custom `tabBar` handles this) — it never scrolls with content.
- [ ] Flow screens that need a sticky bottom CTA (draft's Publish, deal's composer) are OUTSIDE `(tabs)` so they own the full bottom edge with no tab-bar conflict — handled by the show/hide routing (§4.2).

### E. Android Nav Bar + Dark Mode
- [ ] Bottom pad includes `insets.bottom` so the bar clears the gesture pill / 3-button bar.
- [ ] Bar fill is light frosted white; icons/labels are dark `#0E3B2E` / gray `#9AA89F` — no white-on-white. Contrast: `#9AA89F` on `rgba(255,255,255,.96)` ≈ 2.3:1 (idle label is decorative/secondary; the icon shape carries meaning — acceptable, but if WCAG AA is required for the label text, darken idle to `#6B7A72` ≈ 4.6:1). Active `#0E3B2E` on white ≈ 11:1 (pass).
- [ ] Add subtle Android `elevation` (e.g. 8) OR a top shadow so the bar reads above content (the legacy layout used `elevation:8` / iOS top shadow — reuse the pattern).
- [ ] Dark mode: v2 feature (app is light-only today). When added: bar → `rgba(26,28,31,0.92)`, active `greenLight` (`#34D08C`), idle `#8A988F`, border `#2a2a2e`, badge unchanged.

---

## 8. Acceptance Checklist (pass/fail vs prototype)

**Structure & layout**
- [ ] Bar is pinned bottom, spans full width, floats above scroll content (absolute custom tabBar).
- [ ] Frosted look: solid `rgba(255,255,255,0.96)` (or optional gradient) — NOT `expo-blur`.
- [ ] Top hairline `1px #E8EEE9` (`navBorder` token).
- [ ] Exactly 5 equal-width tabs in order: Home, Browse, Matches, Deals, Account.
- [ ] Each tab: 23px Lucide icon (stroke 2, round caps) above 9.5px/700 label (`fonts.bold`, absolute `lineHeight: 12`), 4px gap, centered.

**Color & state**
- [ ] Focused tab renders icon+label in `greenDarkest` (`#0E3B2E`); all others `navIdle` (`#9AA89F`).
- [ ] Icon and label share the same color (single source, like `currentColor`).
- [ ] Active tint follows the CURRENT ROUTE (`state.index`, router-driven), not an internal string.
- [ ] Nav colors are identical in sell and buy mode (no accent tint).
- [ ] Tokens sourced from `@/constants/theme.ts` (NOT `src/theme/colors.ts`): reuses foundation `greenDarkest` for active; adds `navIdle/navBorder/badgeOrange` there. No `primaryDark`/legacy substitution.

**Matches badge**
- [ ] Orange `#E8841A` (`badgeOrange` token) pill top-right of the Matches icon (not the button), `top:-4/right:-6`.
- [ ] Badge: minWidth 15, height 15, radius 99, 8.5px/700 white text (absolute `lineHeight: 12`), 1.5px white border.
- [ ] Shows static `3`; hidden when count is 0; caps at `99+`.

**Show / hide**
- [ ] Bar VISIBLE on: home, browse, matches, deals, published.
- [ ] Bar HIDDEN on: processing, draft, match, deal (all outside `(tabs)`).
- [ ] `published` (`href:null` inside `(tabs)`) shows the bar with no tab highlighted (all idle) + Matches badge present.

**Interactivity**
- [ ] Tapping a tab navigates to its route (`navigation.navigate(name)`) and updates the active tint.
- [ ] `haptics.tap()` fires on tab press (imported from `@/lib/haptics`); no direct `expo-haptics`, no `impact()`/`heavy()`.
- [ ] Re-tapping the active tab is a no-op (no double-push).
- [ ] Press-in scales the tapped item's inner stack to 0.97 + opacity 0.85, springs back (0.97, matching Button).
- [ ] Active-tint cross-fade is driven by a Reanimated animated `t` (`withTiming` 200ms), not a static `focused ? 1 : 0` snap.

**Native**
- [ ] Bottom padding = `9 + safeAreaInsets.bottom` on iPhone (notch + SE), Pixel (gesture + 3-button).
- [ ] Labels never wrap or truncate on 375px width (`numberOfLines={1}`).
- [ ] Screen content inside `(tabs)` is not permanently hidden behind the bar (adequate `paddingBottom`).
- [ ] Reduced-motion: no press scale, instant tint snap, badge `FadeIn` only.
- [ ] Keyboard on `home` does not obscure the composer send button.

**Wiring / architecture**
- [ ] Implemented as a custom `<Tabs tabBar={…}>` renderer, replacing the legacy capsule tab bar in `app/(tabs)/_layout.tsx`.
- [ ] Existing `history`/`profile` tabs migrated to the new 5-tab set; `scan`/`inbox` handled (`href:null` or hidden).
- [ ] Flow screens (processing/draft/match/deal) live outside `(tabs)` so the bar is structurally absent.
- [ ] `TabBadge` is a pure `count`-prop component ready for a React Query / Zustand swap.
- [ ] No new dependency added (`expo-blur` explicitly avoided).

---

## Appendix — Reference implementation skeleton

```tsx
// src/components/nav/FrostedTabBar.tsx
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Type resolves transitively via expo-router. If TS can't find it, swap for the
// inline fallback: type BottomTabBarProps = { state: any; navigation: any; descriptors?: any };
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { haptics } from '@/lib/haptics';        // semantic verbs only — NEVER import expo-haptics here
import { TabBarItem } from './TabBarItem';
import { TAB_CONFIG, STATIC_BADGES } from './tabConfig';
// nav tokens live in @/constants/theme.ts (foundation), NOT src/theme/colors.ts:
import { navBorder } from '@/constants/theme';  // navIdle/navBorder/badgeOrange + green tokens added per foundation §3.4

export function FrostedTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;
  const isPublished = activeName === 'published';

  return (
    <View style={[styles.bar, { paddingBottom: 9 + insets.bottom }]}>
      {TAB_CONFIG.map((tab, i) => {
        // published shows the bar with NO tab highlighted (all idle).
        const focused = !isPublished && state.index === i;
        const routeName = state.routes[i]?.name ?? tab.name;
        return (
          <TabBarItem
            key={tab.name}
            Icon={tab.Icon}
            label={tab.label}
            focused={focused}
            badgeCount={tab.badgeKey ? STATIC_BADGES[tab.badgeKey] : 0}
            onPress={() => {
              haptics.tap();                               // tab switch = tap() (light/selection feel)
              if (!focused) navigation.navigate(routeName); // dedupes re-taps
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 9, paddingHorizontal: 14,
    borderTopWidth: 1, borderTopColor: navBorder,          // #E8EEE9
    backgroundColor: 'rgba(255,255,255,0.96)',             // solid frosted (NOT expo-blur)
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.05, shadowRadius: 5 },
      android: { elevation: 8 },
      web: { boxShadow: '0 -3px 10px rgba(0,0,0,0.03)' },
    }),
  },
});
```

```tsx
// src/components/nav/TabBarItem.tsx
import { useEffect } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, useReducedMotion,
} from 'react-native-reanimated';
import type { LucideIcon } from 'lucide-react-native';
// nav tokens from @/constants/theme.ts (foundation), NOT legacy src/theme/colors.ts.
// greenDarkest is the foundation active-tint token; navIdle is added per §3.4.
import { fonts, greenDarkest, navIdle } from '@/constants/theme';
import { TabBadge } from './TabBadge';

const AView = Animated.createAnimatedComponent(View);
const AIcon = Animated.createAnimatedComponent(View); // wrapper — Lucide's own color prop isn't Reanimated-animatable
const AText = Animated.Text;

export function TabBarItem({
  Icon, label, focused, badgeCount = 0, onPress,
}: { Icon: LucideIcon; label: string; focused: boolean; badgeCount?: number; onPress: () => void }) {
  const reduced = useReducedMotion();
  const press = useSharedValue(0);                 // 0 = rest, 1 = pressed
  const t = useSharedValue(focused ? 1 : 0);       // active-tint amount — a REAL animated value

  // Drive the 200ms cross-fade whenever focus changes (instant snap under reduced motion).
  useEffect(() => {
    t.value = reduced ? (focused ? 1 : 0) : withTiming(focused ? 1 : 0, { duration: 200 });
  }, [focused, reduced, t]);

  // Press feedback: scale 1 → 0.97 (the foundation/Button value, NOT 0.95) + opacity dip.
  const stackStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : withTiming(1 - press.value * 0.03, { duration: 100 }) }], // 1 - 0.03 = 0.97
    opacity: reduced ? 1 : withTiming(1 - press.value * 0.15, { duration: 100 }),
  }));

  // Two stacked icons cross-faded by opacity: idle fades out (1 - t), active fades in (t).
  const idleIconStyle = useAnimatedStyle(() => ({ opacity: 1 - t.value }));
  const activeIconStyle = useAnimatedStyle(() => ({ opacity: t.value }));
  // Two stacked labels cross-faded the same way (Text color can't animate cleanly in RN).
  const idleLabelStyle = useAnimatedStyle(() => ({ opacity: 1 - t.value }));
  const activeLabelStyle = useAnimatedStyle(() => ({ opacity: t.value }));

  return (
    <Pressable
      style={styles.item}
      onPressIn={() => { press.value = 1; }}
      onPressOut={() => { press.value = withSpring(0, { damping: 15 }); }} // damping 15 ≈ the out-cubic release feel
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <AView style={[styles.stack, stackStyle]}>
        <View style={styles.iconWrap}>
          <AIcon style={[StyleSheet.absoluteFill, idleIconStyle]}>
            <Icon size={23} color={navIdle} />
          </AIcon>
          <AIcon style={[StyleSheet.absoluteFill, activeIconStyle]}>
            <Icon size={23} color={greenDarkest} />
          </AIcon>
          {badgeCount > 0 && <TabBadge count={badgeCount} />}
        </View>
        <View style={styles.labelWrap}>
          <AText numberOfLines={1} style={[styles.label, styles.labelAbs, { color: navIdle }, idleLabelStyle]}>
            {label}
          </AText>
          <AText numberOfLines={1} style={[styles.label, { color: greenDarkest }, activeLabelStyle]}>
            {label}
          </AText>
        </View>
      </AView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  stack: { alignItems: 'center', gap: 4 },
  iconWrap: { position: 'relative', width: 23, height: 23 },
  labelWrap: { position: 'relative', alignItems: 'center' },
  labelAbs: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  label: { fontSize: 9.5, lineHeight: 12, fontFamily: fonts.bold }, // Inter_700Bold; lineHeight absolute px (RN)
});
```

```tsx
// src/components/nav/TabBadge.tsx
import Animated, { ZoomIn, FadeIn, useReducedMotion } from 'react-native-reanimated';
import { Text, StyleSheet } from 'react-native';
// nav tokens from @/constants/theme.ts (foundation), NOT legacy src/theme/colors.ts:
import { fonts, badgeOrange } from '@/constants/theme';

const WHITE = '#ffffff';

export function TabBadge({ count }: { count: number }) {
  const reduced = useReducedMotion();
  if (count <= 0) return null;
  const entering = reduced ? FadeIn.duration(200) : ZoomIn.duration(300); // POP (FadeIn under reduced motion)
  return (
    <Animated.View entering={entering} style={styles.badge}>
      <Text style={styles.text}>{count > 99 ? '99+' : count}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', top: -4, right: -6,
    minWidth: 15, height: 15, paddingHorizontal: 3, borderRadius: 99,
    backgroundColor: badgeOrange, borderWidth: 1.5, borderColor: WHITE,
    alignItems: 'center', justifyContent: 'center',
  },
  text: { color: WHITE, fontSize: 8.5, lineHeight: 12, fontFamily: fonts.bold }, // lineHeight absolute px (RN)
});
```

```tsx
// app/(lab)/(tabs)/_layout.tsx  (customer-fork tab group; replaces the legacy capsule layout)
// NOTE: path is relative to the (lab) route group prerequisite (00-foundation.md). If the
// project mounts these tabs directly at app/(tabs)/, use that path instead — the renderer is identical.
// import { Tabs } from 'expo-router';
// import { FrostedTabBar } from '@/components/nav/FrostedTabBar';
//
// <Tabs tabBar={(props) => <FrostedTabBar {...props} />} screenOptions={{ headerShown:false }}>
//   <Tabs.Screen name="index" />    <Tabs.Screen name="browse" />
//   <Tabs.Screen name="matches" />  <Tabs.Screen name="deals" />
//   <Tabs.Screen name="account" />
//   <Tabs.Screen name="published" options={{ href:null }} />  // shows bar, no tab button
//   <Tabs.Screen name="scan" options={{ href:null }} />        // camera crash — keep hidden
// </Tabs>
```

**Files verified for import paths & installed deps:** `GreenBridgeApp/package.json` (no `expo-blur`; `expo-linear-gradient`, `expo-haptics`, `react-native-reanimated` 4, `react-native-safe-area-context`, `lucide-react-native`, `react-native-keyboard-controller` all present), `GreenBridgeApp/src/constants/theme.ts` (canonical token source — `brand`, `fonts` re-export, `motion.tap`; the `greenDarkest`/`greenLight` green tokens are foundation prerequisites, and `navIdle`/`navBorder`/`badgeOrange` are added here per §3.4 — NONE of the nav tokens live in the legacy `src/theme/colors.ts`), `GreenBridgeApp/src/theme/typography.ts` (`fonts.bold = Inter_700Bold`; `Inter_500Medium` NOT loaded), `GreenBridgeApp/src/lib/haptics.ts` (verbs `tap/impact/heavy/success/warning/error` only — no `light()`/`medium()`; tab switch uses `tap()`), `GreenBridgeApp/src/components/ui/Button.tsx` (press scale 0.97; not reused here — bespoke Pressable), `GreenBridgeApp/app/(tabs)/_layout.tsx` (legacy capsule + current 5-screen set index/scan/history/profile/inbox), `GreenBridgeApp/NewVersion/00-foundation.md` (Prerequisites, recipe names, blur→gradient policy, `haptics.tap()` tab-switch mapping, reduced-motion mapping, 0.97 press-scale mandate). Prototype source of truth: `GreenBridgeApp/101LAB Mobile.dc.html` lines 436–463 (markup) and 469–599 (state/copy).
