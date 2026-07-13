# Matches Feed — Implementation-Ready Design Spec
**Screen:** `MatchesFeed` — AI Match Center list
**App:** 101LAB by GreenBridge (Expo Router RN, SDK 56)
**Route:** `app/(lab)/matches.tsx` (customer-app `(lab)` route group — see §0 Prerequisites and §7)
**Prototype source:** `101LAB Mobile.dc.html` lines 269–310 (markup) + 469–599 (state/copy)
**Status:** Static/hardcoded data, fully interactive. No live API yet (Phase 1 of foundation "Static-First, Then Dynamic").

> **Filename note:** the foundation Screen Index (`00-foundation.md`) lists this as `05-matches.md`; this file is delivered as `05-matches-feed.md` per the build request. The two refer to the same screen — keep one canonical file and update the index if you rename.

---

## 0. Prerequisites (foundation setup)

These are **owned by the foundation** (`00-foundation.md` → [Prerequisites (foundation setup)](00-foundation.md#prerequisites-foundation-setup)) and are set up **once**, not per screen. This screen depends on the checked items below. Do **not** re-implement them here; this list only tells the reader what must already be in place before building this screen.

- [ ] **Fonts — Hanken Grotesk 800.** Add `HankenGrotesk_800ExtraBold` to `useFonts({…})` in `app/_layout.tsx` (from `@expo-google-fonts/hanken-grotesk`, already a dependency) **and** expose it as `fonts.headingBold` in `src/theme/typography.ts`. The app currently loads only Hanken **600** (`fonts.headingSemibold`) + **700** (`fonts.heading`). Until this lands, `fonts.headingBold` is **undefined** and the title / ring label / card titles silently fall back to the system font. This is a foundation prerequisite, **not** per-file work.
- [ ] **Color tokens — green/buy/warn.** Add `greenDarkest #0E3B2E`, `greenMedium #16A35A`, `greenLight #34D08C`, `buyBlue #2563EB`, `warnAmber #E8A21A` (foundation [Colors](00-foundation.md#colors)) to `@/constants/theme.ts`. These do **NOT** exist in the repo yet — treat them as "add per foundation," never "already present." This screen references them **by token name**; do not scatter raw hexes. (The neutral text/border greys below in §3 that the foundation does not name — `#10201A`, `#6B7A72`, `#8A988F`, `#9AA89F`, `#E7EDE8`, `#E4EBE6` — stay as file-local consts, documented in §3.)
- [ ] **`(lab)` route group.** `app/(lab)/` exists (customer-app screens, gated by the user-type fork). This screen is `app/(lab)/matches.tsx`. The persistent bottom tab bar is its own spec (`08-bottom-nav.md`) — this file does **not** register or restyle the tab bar; it only assumes the Matches tab routes here.
- [ ] **`src/features/lab/`** feature folder exists. This screen's components + mock live under `src/features/lab/matches/…`.
- [ ] **`src/animations/recipes.ts`** exports `POP`, `RISE` (+ `useReducedMotion`-aware fallbacks). This screen uses `POP` (staggered card reveal) and a `fade` transition; the % ring is a screen-local SVG helper built on the same Reanimated primitives (see §6).

> **Haptics & Button already exist — do NOT re-create them.** Import `{ haptics }` from `@/lib/haptics` and `Button` from `@/components/ui`. Their verified contracts (haptic verbs, Button sizes, 0.97 press scale) are in the foundation and restated inline where used below.

**No new npm dependency is required for this screen.** `react-native-svg` (15.15.4), `@shopify/flash-list` (^2.3.1), `@tanstack/react-query` (^5.100.14), `date-fns` (^4.3.0), `expo-haptics` (via `@/lib/haptics`), and `react-native-reanimated` (**4.3.1**) are all already in `package.json`. Do **not** add `react-native-progress`, `react-native-circular-progress`, an SVG conic-gradient lib, or Plus Jakarta Sans.

---

## 1. Purpose & Place in Flow

The Matches Feed is the **AI Match Center** — the payoff screen of the whole app. It shows a list of AI-generated pairings where **a FOR SALE listing meets a WANTED request**, each scored with a circular **% match ring**. The product promise (prototype copy) is: *"You only show up when there's a real match. Confirm interest to talk."*

**Entry points (who navigates here):**
- Bottom-nav **Matches** tab (`navMatches` → `go('matches', 'matches')` in prototype; primary entry). Tab bar itself is spec 08.
- **PUBLISHED** screen → *"See your matches"* CTA (`viewMatches` → `go('matches', 'matches')`, prototype line 260/588).
- Deep link / notification tap ("3 new matches").

**Exits (navigation targets):**
- Each card's **View match** button → **MATCH detail** screen (`openMatch` → `go('match')`, prototype line 302/589). This is the only outbound action on the screen body → `router.push({ pathname: '/match', params: { id: match.id } })`.
- Bottom nav → Home / History / Me (tab switch, owned by spec 08 / the tab layout, out of scope here).

**Prototype note:** In the prototype, `isMatches` is `true` for `screen === 'matches' | 'browse' | 'deals'` (line 518) — Browse and Deals reuse this same feed as a placeholder. For this build we implement the **Matches** case only; Browse/Deals get their own screens later.

---

## 2. Visual Layout (top-to-bottom, exact values from HTML)

Container outer padding (prototype line 271): `padding: 60px 22px 130px`.
- Top `60px` = status bar + breathing room → in RN this is `SafeAreaView edges={['top']}` (via `Screen`) + `paddingTop: 16` on the content.
- Sides `22px` → `paddingHorizontal: 22`. (Foundation's default `Screen` padding is `px-lg` = 16; 22 is intentional here — see §7C. Set `padded={false}` and pass `paddingHorizontal:22` in `contentContainerStyle`.)
- Bottom `130px` = clearance for the fixed bottom nav → `paddingBottom: 96 + insets.bottom` (the tab bar defined in spec 08 is `68 + insets.bottom` tall; see §7A).

Screen background: **`brand.background`** (`#f8f9ff`). *(Prototype phone body is `#F4F7F4`; use the app token `brand.background` per foundation color reconciliation. `Screen` paints `bg-bg` via NativeWind; if that token does not resolve to `#f8f9ff`, set `style={{ backgroundColor: brand.background }}` on the root `Screen`.)*

### 2a. Header block
| Element | Spec (from HTML) |
|---|---|
| Eyebrow label | Text `"AI MATCH CENTER"`, `fontSize:11`, `letterSpacing:1.32` (≈.12em × 11 — RN uses absolute px, not em), color **`warnAmber`** (`#E8A21A`; the prototype's `#C58A1E` is the darker amber — use the foundation `warnAmber` token for the eyebrow + amber tag, see §3 decision), `marginBottom:4`. Font family: `fonts.label` (IBM Plex Sans 600 — a 700 weight is not loaded, so `fonts.label` at 11px is the closest loaded caps face). |
| Title (`h2`) | `"Where supply\nmeets demand."` — hard line break after "supply" (`\n` in the string, `numberOfLines` unset). Font **`fonts.headingBold`** (Hanken 800, see §0), `fontSize:30`, `lineHeight:31.5` (absolute px = 1.05 × 30 pre-computed; RN forbids multipliers), color **`#10201A`**, `letterSpacing:-0.75` (−.025em × 30, absolute px), `marginBottom:6`. |
| Subcopy (`p`) | `"You only show up when there's a real match. Confirm interest to talk."` `fontSize:13`, `lineHeight:18` (absolute px), color **`#6B7A72`**, `marginBottom:20`. Font: `fonts.regular` (Inter 400). |

### 2b. Match list
Vertical stack, `flexDirection:'column'`, `gap:14` (prototype line 276). Renders `MATCHES[]` (3 items, §5).

### 2c. Match card (repeated) — prototype lines 278–306
Card container (`View`, not `Card` — see §3):
- Background **`brand.surface`** (`#fff`), border `1px solid #E7EDE8`, `borderRadius:20` (`radius.xl`).
- Padding `{ paddingTop:16, paddingHorizontal:16, paddingBottom:14 }` (top/sides 16 = `spacing.lg`, bottom 14).
- **Shadow — do NOT use `elevation.md`.** The `elevation.md` token uses `shadowColor:'#000'` (theme.ts line 173–179), which reads grey. The prototype shadow is green-tinted (`box-shadow: 0 12px 32px -26px rgba(14,59,46,.4)`; the `-26px` spread is not expressible in RN). Apply this inline object on the card container instead:
  ```ts
  const cardShadow = {
    shadowColor: '#0E3B2E',           // greenDarkest token once added; literal until then
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 3,                     // Android parity (matches elevation.md's elevation:3)
  } as const;
  ```

**Card row 1 — status header** (`justifyContent:'space-between'`, `alignItems:'center'`, `marginBottom:13`):
- **Tag chip** (left, `StatusTag`): `flexDirection:'row'`, `alignItems:'center'`, `gap:6`, `paddingVertical:5`, `paddingHorizontal:10`, `borderRadius:99` (`radius.full`). Color + bg are per-variant (§3 `StatusTag`). Leading dot `6×6`, `borderRadius:99`, filled with the variant color. Chip label: `fonts.bold` (Inter 700), `fontSize:11`.
  - "New match" → color **`greenMedium`** (`#16A35A`), bg **`#EAF6EE`**.
  - "Worth a look" → color **`warnAmber`** (`#E8A21A`), bg **`#FBF1DD`**.
- **Timestamp** (right): `m.time`, `fontSize:11.5`, `fonts.semibold` (Inter 600), color **`#9AA89F`**.

**Card row 2 — the pairing** (`flexDirection:'row'`, `alignItems:'center'`, `gap:12`):
- **Left column (FOR SALE)** `flex:1; minWidth:0`:
  - Kicker `"FOR SALE"` `fontSize:10`, `letterSpacing:0.5` (.05em × 10, absolute px), color **`greenMedium`** (`#16A35A`), `marginBottom:3`. Font: `fonts.label`.
  - Title `m.sell` — `fonts.heading` (Hanken 700), `fontSize:14`, color **`#10201A`**, `lineHeight:16` (absolute px = 1.15 × 14), `numberOfLines={2}`.
  - Sub `m.sellSub` `fontSize:11.5`, `lineHeight:15`, color **`#8A988F`**, `marginTop:2`, `numberOfLines={1}`. Font: `fonts.regular`.
- **Center — % match ring** (`MatchRing`) `flexShrink:0`, `width:58`, `height:58`, centered.
  - Prototype draws it as a CSS `conic-gradient` outer ring + a 5px-inset white inner disc + centered label. In RN this is **SVG** (see §3 `MatchRing`) — no `conic-gradient` primitive exists in RN.
  - Label: `m.pct` formatted `` `${pct}%` `` — `fonts.headingBold` (Hanken 800), `fontSize:15`, color **`greenDarkest`** (`#0E3B2E`), centered.
- **Right column (WANTED)** `flex:1; minWidth:0` with `alignItems:'flex-end'` on the column `View` (RN has no `text-align:right` on a container; also set `textAlign:'right'` on each `Text`):
  - Kicker `"WANTED"` `fontSize:10`, `letterSpacing:0.5`, color **`buyBlue`** (`#2563EB`), `marginBottom:3`. Font: `fonts.label`.
  - Title `m.want` — `fonts.heading` (Hanken 700), `fontSize:14`, color **`#10201A`**, `lineHeight:16`, `numberOfLines={2}`, `textAlign:'right'`.
  - Sub `m.wantSub` `fontSize:11.5`, `lineHeight:15`, color **`#8A988F`**, `marginTop:2`, `numberOfLines={1}`, `textAlign:'right'`.

**Card row 3 — CTA button** (prototype line 302): full-width, **44px** tall, `borderRadius:13`, background **`greenDarkest`** (`#0E3B2E`), no border, `marginTop:14`.
- Label `"View match"` — `fontSize:13.5`, color `#fff`, centered, `gap:7` before a right-arrow icon.
- Icon: Lucide `ArrowRight` (equivalent to the prototype's `M5 12h14 / m12 5 7 7-7 7`), `size={15}`, `strokeWidth={2.2}`, `color="#fff"`.
- **Build decision (44px is NOT a `Button` size):** `Button` only offers `sm`=48 / `md`=56 / `lg`=64 (there is no 44px). To hit the prototype's 44px height **and** the 13.5px label exactly, build this CTA as a **bespoke `Pressable`** (not `Button`) — see §3 `MatchCard`. The bespoke Pressable reuses Button's contract verbatim: press-in `scale → 0.97` over `motion.tap` (100ms) via Reanimated, and a **`haptics.tap()`** call on press (card/CTA tap = `tap()` per foundation haptic map). 44px meets the ≥44px min tap-target rule. *(Alternative if you must reuse `Button`: `size="sm"` + `style={{ height:44, backgroundColor:'#0E3B2E', borderRadius:13 }}` + `rightIcon`; but `Button`'s label is fixed to the `bodySm` 14px variant and its built-in `haptic` fires Light internally — acceptable but off-spec by 0.5px. **We use the bespoke Pressable** for fidelity.)*

> **Color reconciliation (foundation):** Prototype `#0E3B2E` (CTA + `%` label) = the `greenDarkest` token; `#16A35A` (FOR SALE, green ring) = `greenMedium`; `#2563EB` (WANTED) = `buyBlue`; the amber `#E8A21A`/`#C58A1E` family = `warnAmber`. **These four are foundation-owned tokens to add** (§0) — reference them by name, not raw hex. Note the theme's existing `brand.primary` (`#14452f`) and `colors.primary.500` (`#10B981`, the emerald base `Button` bg) are **different greens** — do **not** substitute either for the card CTA / ring; the card is intentionally `greenDarkest`.

---

## 3. Component Breakdown (reuse map)

### Reuse existing primitives (`import { … } from '@/components/ui'`)
Confirmed exported by the barrel (`src/components/ui/index.ts`): `Screen`, `Text`, `Button`, `Card`, `Badge`, `EmptyState`, `Stack`, `HStack`, `AppImage`, `SectionLabel`.

| Primitive | Used for | Notes / verified props |
|---|---|---|
| `Screen` | Root wrapper | `<Screen scroll padded={false} edges={['top']} style={{ backgroundColor: brand.background }} contentContainerStyle={{ paddingTop:16, paddingHorizontal:22, paddingBottom: 96 + insets.bottom }}>`. **Must** set `padded={false}` — the default adds `px-lg` (16) which fights the 22px sides. **Merge order (verified `Screen.tsx` lines 42–46):** the ScrollView `contentContainerStyle` is `[{ flexGrow:1, paddingBottom:48 }, yourStyle]`, so your `paddingBottom` **overrides** the default 48 — you must pass the full `96 + insets.bottom` (not a delta). |
| `Text` | Every text node | `Text` supports `variant` (caption/bodySm/body/bodyMd/subtitle/title/hero) + `tone`, and forwards `style`. No variant matches Hanken-800@30 or the 10/11.5px micro sizes, so pass explicit `style` with an **absolute `lineHeight`** (never a multiplier): e.g. title → `style={{ fontFamily: fonts.headingBold, fontSize:30, lineHeight:31.5, letterSpacing:-0.75, color:'#10201A' }}`. Eyebrow/kickers → explicit `fontFamily: fonts.label` + color. (Do not rely on `tone="brand"` — it maps to `text-primary-600` = `#059669`, not our greens.) |
| `Badge` | ❌ **not used for the tag chip** | `Badge` variants are class-based (`bg-green-50`, brand tones) and cannot produce the exact `#EAF6EE`/`greenMedium` and `#FBF1DD`/`warnAmber` pairs. **Decision: new `StatusTag`** (below) for 1:1 fidelity. |
| `EmptyState` | Zero-match fallback (future, Phase 2) | Verified props: `icon`, `iconBg`, `title`, `description`, `actionLabel`, `onAction`, `actionVariant`. `onAction` is a **plain callback** — the component is navigation-agnostic (correct); **wire nav at the call site**. Shown when `matches.length === 0`: `title="No matches yet"`, `description="Publish a listing or post a request — you'll appear here the moment there's a real match."`, `actionLabel="Get started"`, `onAction={() => router.push('/(lab)')}`. Its action renders a `size="sm"` Button internally. |
| `FlashList` (`@shopify/flash-list` ^2.3.1) | The list (scale path, Phase 2) | v2 API — **no `estimatedItemSize` needed** (v2 self-measures). For 3 static items a `.map()` inside `Screen`'s ScrollView is correct for Phase 1. Spec `FlashList` now so the swap is free once matches paginate. **Do not** nest a `FlashList` inside `Screen`'s `ScrollView` (nested-VirtualizedList warning) — when you switch, set `Screen scroll={false}` and let `FlashList` own scrolling + `contentContainerStyle`. |

> **`Button` is intentionally NOT reused for the card CTA** — the prototype's 44px height + 13.5px label are outside `Button`'s size table, so §2c builds a bespoke `Pressable` that mirrors Button's 0.97 press-scale + a `haptics.tap()` call. `Button` **is** reused indirectly by `EmptyState` (its `size="sm"` action button, Phase 2 only).

### Theme tokens (`import { brand, spacing, radius, fonts, motion, colors } from '@/constants/theme'`)
All re-exported from `@/constants/theme` (`fonts` re-exports from `../theme/typography`; `colors`/`brand`/`spacing`/`radius`/`elevation`/`motion` defined in `theme.ts`).
- `brand.background` (#f8f9ff) screen bg, `brand.surface` (#fff) card bg.
- `fonts.headingBold` (Hanken 800 — **add per §0**), `fonts.heading` (Hanken 700) card titles, `fonts.bold` (Inter 700) chip label, `fonts.semibold` (Inter 600) timestamp, `fonts.label` (IBM Plex 600) caps kickers, `fonts.regular` (Inter 400) subcopy + CTA label.
- `motion.tap` (100ms) for the CTA press scale; `motion.spring` (`{damping:18, stiffness:220, mass:1}`) available if a spring is preferred over the layout-animation `POP`.
- **Font simplification (foundation Typography):** the prototype names *Plus Jakarta Sans* for the CTA — **it is not loaded**; use **Inter** (`fonts.regular`/`fonts.bold`) per the documented system simplification. Do not add Plus Jakarta. **This is a deliberate decision, not an omission.**
- **Green/buy/warn colors** (`greenDarkest`, `greenMedium`, `greenLight`, `buyBlue`, `warnAmber`) are **foundation-owned tokens to add** (§0). Reference them by name in this screen. Until they land in `@/constants/theme.ts`, they will not resolve — the foundation prerequisite gates this screen.

### File-local color consts (neutrals the foundation does not name — keep as `const` in the screen)
`#10201A` (near-black title), `#6B7A72` (subcopy), `#8A988F` (card subs), `#9AA89F` (timestamp), `#E7EDE8` (card border), `#E4EBE6` (ring track), plus the two chip backgrounds `#EAF6EE` / `#FBF1DD`. These are muted neutrals with no foundation token — group them in one `const NEUTRALS = { … }` object at the top of the screen file. (The four brand colors above are tokens, not file-local — see §0.)

### New small components to create (co-located under `src/features/lab/matches/components/`)
1. **`MatchRing`** — the % ring, drawn with **`react-native-svg`** (15.15.4, installed). Props: `{ pct: number; index: number; fillColor: string; trackColor?: string; size?: number /*=58*/; stroke?: number /*=5*/ }`.
   - Layout: `<Svg width={size} height={size}>` with two `<Circle>`s at center `(size/2, size/2)`, `r = size/2 - stroke/2` (≈26.5 for 58/5): a background track (`trackColor`, default `#E4EBE6`) and a foreground arc (`stroke={fillColor}`, `strokeLinecap="round"`). Foreground uses `strokeDasharray={C}` where `C = 2πr`, and animated `strokeDashoffset`. Rotate the arc `-90°` so it starts at 12 o'clock like the conic-gradient (`transform={\`rotate(-90 ${size/2} ${size/2})\`}` on the animated `<Circle>`, or rotate a wrapping `<G>`).
   - White inner face: the prototype's 5px-inset white disc is achieved **automatically** because the ring is a **stroked circle** — only the 5px stroke is colored, the interior is transparent over the white card. No separate disc needed. If the card bg ever differs from white, add a filled center `<Circle fill="#fff" r={size/2 - stroke} />`.
   - Label: absolutely-positioned `<Text>` centered over the SVG (`position:'absolute'`, `left:0, right:0, top:0, bottom:0`, `textAlign:'center'`, `textAlignVertical:'center'`), `fonts.headingBold`, `fontSize:15`, `lineHeight:15`, color `greenDarkest` (`#0E3B2E`), content `` `${pct}%` ``.
   - Animation: see §6 (uses `useSharedValue` + `useAnimatedProps` on `Animated.createAnimatedComponent(Circle)`, with a `useReducedMotion()` static fallback).
2. **`StatusTag`** — pill chip with a **closed variant set** (only two states exist). Props:
   ```ts
   type StatusTagVariant = 'new-match' | 'worth-a-look';
   const TAG_VARIANTS: Record<StatusTagVariant, { label: string; color: string; bg: string }> = {
     'new-match':    { label: 'New match',    color: '#16A35A' /* greenMedium */, bg: '#EAF6EE' },
     'worth-a-look': { label: 'Worth a look', color: '#E8A21A' /* warnAmber  */, bg: '#FBF1DD' },
   };
   // props: { variant: StatusTagVariant }
   ```
   Renders a 6px dot + label in a `flexDirection:'row'` `View`: `borderRadius:99`, `paddingVertical:5`, `paddingHorizontal:10`, `backgroundColor:variant.bg`; dot `6×6`, `borderRadius:99`, `marginRight:6`, `backgroundColor:variant.color`; label `fontFamily:fonts.bold`, `fontSize:11`, `color:variant.color`. Using a variant union (not open `color`/`bg` strings) prevents arbitrary color pairs. (Once `greenMedium`/`warnAmber` tokens land, swap the `color` hexes for the tokens.)
3. **`MatchCard`** — composes a styled `View` (card container styles + `cardShadow` from §2c; `Card` from the barrel is `rounded-2xl`=24px, so a plain `View` gives the exact 20px radius + green shadow) + `StatusTag` + timestamp + FOR SALE column + `MatchRing` + WANTED column + the **bespoke CTA Pressable**. Props: `{ match: Match; index: number; onPress: (id: string) => void }`.
   - **Bespoke CTA Pressable** (44px, replaces `Button` — see §2c decision):
     ```tsx
     const scale = useSharedValue(1);
     const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
     // press-in: scale.value = withTiming(0.97, { duration: motion.tap });
     // press-out: scale.value = withTiming(1, { duration: motion.tap });
     // onPress: haptics.tap(); onPress(match.id);
     <Animated.View style={aStyle}>
       <Pressable
         onPressIn={handleIn} onPressOut={handleOut}
         onPress={() => { haptics.tap(); onPress(match.id); }}
         accessibilityRole="button" accessibilityLabel="View match"
         style={{ height:44, borderRadius:13, backgroundColor:'#0E3B2E', /* greenDarkest */
                  marginTop:14, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:7 }}>
         <Text style={{ fontFamily: fonts.bold, fontSize:13.5, color:'#fff' }}>View match</Text>
         <ArrowRight size={15} color="#fff" strokeWidth={2.2} />
       </Pressable>
     </Animated.View>
     ```
     Import `{ haptics }` from `@/lib/haptics` — **never** `expo-haptics` directly.

---

## 4. Interactivity & Navigation

| Element | Interaction | Result |
|---|---|---|
| **View match** button (per card) | Tap → bespoke Pressable press-scale `1 → 0.97` over `motion.tap` (§3) + **`haptics.tap()`** (card/CTA tap = `tap()` per foundation haptic map) | `router.push({ pathname: '/match', params: { id: match.id } })`. Screen transition = **RISE (bottom-up modal)** per the foundation matrix (matches → match). |
| **Card body** (non-button area) | **Not tappable.** | The card body outside the button does **not** navigate. Only the inline **View match** button navigates. This keeps the affordance unambiguous and avoids any double-fire between an outer card Pressable and the CTA. (Firm decision — no whole-card tap.) |
| **Bottom nav** | Tab taps | Owned by the `(lab)` tab layout / spec `08-bottom-nav.md`, **not** this screen. This screen does not register or restyle the tab bar. |
| **Pull-to-refresh** (future, Phase 2) | Swipe down | No-op now. Wire to `refetch()` when the query lands (§5): add `refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#16A35A" />}` to the ScrollView/FlashList. |

**State the screen owns:** none beyond the static `MATCHES` array (Phase 1). No mode toggle here. (`isRefetching` boolean arrives in Phase 2 with React Query.)

**Mode (sell/buy) variations:** The Matches feed is **mode-agnostic**. The home-screen `sell`/`buy` accent does **not** re-skin this screen. Each card is *intrinsically* two-sided: the FOR SALE column is always green (`greenMedium`), the WANTED column always blue (`buyBlue`), regardless of the user's mode. **No copy or color changes by mode here** — this is the one screen where both accents always coexist.

---

## 5. Static Data Shape & Future Hook Points

### Hardcoded data (verbatim from prototype lines 495–499)
```ts
// src/features/lab/matches/data/matches.mock.ts
export type MatchTag = 'new-match' | 'worth-a-look';   // matches StatusTagVariant (§3)

export type Match = {
  id: string;
  tag: MatchTag;
  time: string;          // relative label, e.g. '2h ago'
  sell: string;          // FOR SALE title
  sellSub: string;       // FOR SALE subtitle (location · price)
  pct: number;           // 0–100 match score (prototype stores '96%' string; store number, format at render)
  ringFill: string;      // ring foreground color (token hex)
  ringTrack: string;     // ring background/track color (default '#E4EBE6')
  want: string;          // WANTED title
  wantSub: string;       // WANTED subtitle
};

export const MATCHES: Match[] = [
  { id: 'm1', tag: 'new-match',    time: '2h ago',
    sell: 'Agilent 1260 HPLC', sellSub: 'Singapore · $13.4k', pct: 96,
    ringFill: '#16A35A' /* greenMedium */, ringTrack: '#E4EBE6', want: 'HPLC + DAD', wantSub: 'pharma QC · $18k' },
  { id: 'm2', tag: 'new-match',    time: '5h ago',
    sell: 'Haas VF-2 Mill', sellSub: 'Taiwan · $18.9k', pct: 94,
    ringFill: '#16A35A' /* greenMedium */, ringTrack: '#E4EBE6', want: '3-axis CNC mill', wantSub: 'Vietnam · $20k' },
  { id: 'm3', tag: 'worth-a-look', time: '1d ago',
    sell: 'Mixed Copper · 22t', sellSub: 'Kaohsiung', pct: 91,
    ringFill: '#E8A21A' /* warnAmber */,  ringTrack: '#E4EBE6', want: 'Bare bright copper', wantSub: '20 t/mo · recurring' },
];
```
The chip color/bg derive from `tag` via `TAG_VARIANTS` (§3) — they are **not** stored on the `Match`. The prototype stores `pct` as `'96%'` and `ring` as a conic string; we normalize to numeric `pct` + `ringFill`/`ringTrack` so `MatchRing` can both draw the arc and render the label as `` `${pct}%` ``.

### Future dynamic hook points (leave TODO comments, do not wire now)
- Replace the `MATCHES` import with a query (React Query is installed; wire in Phase 2):
  ```ts
  const { data: matches = [], isLoading, refetch, isRefetching } =
    useQuery({ queryKey: ['matches'], queryFn: fetchMatches }); // @tanstack/react-query
  ```
  `refetch` → pull-to-refresh; `isLoading` → skeleton cards; empty → `EmptyState`. **JSX must not change** between static and dynamic — only the data-source line.
- `time` will come from a real timestamp → format with `date-fns` (installed): `formatDistanceToNowStrict(new Date(match.createdAt), { addSuffix: true })`.
- `tag`/`ringFill` derive from `match.score` via a single `scoreBand(score)` helper once scores are live (≥95 & 91–94 → green `'new-match'`; <91 → amber `'worth-a-look'` — confirm exact bands with product; prototype shows 96/94 green, 91 amber).
- Match-count badge ("3 new matches") on the nav/header binds to `matches.filter(m => m.tag === 'new-match').length`.

---

## 6. Animations & Micro-Interactions (foundation recipes — Reanimated **4.3.1**)

Reference: foundation "Animation & Interaction Recipes" (POP, RISE) + "Confidence ring". Use `src/animations/recipes.ts` (foundation prerequisite, §0) for the named recipes; the ring is a screen-local helper on the same primitives.

- **Screen entrance:** header block fades in — `FadeIn.duration(250)` (foundation "home → matches: fade, 250ms").
- **Card reveal — POP with stagger:** each `MatchCard` enters with **POP** (`scale 0.92→1` + fade, ~300ms, spring damping ~1.2 slight overshoot) delayed by `index * 80ms` (foundation "POP … stagger 80ms in lists"). Delays: 0 / 80 / 160ms. Use the `recipes.POP(index)` wrapper, or a layout-animation `entering={FadeInDown.springify().damping(14).delay(index*80)}` — keep it a worklet layout-animation on the UI thread.
- **% ring stroke-draw:** `MatchRing` animates `strokeDashoffset` from full circumference → target on mount via `useSharedValue` + `useAnimatedProps`. Import from **`react-native-reanimated`** (NOT `react-native`):
  ```tsx
  import Animated, {
    Easing, useSharedValue, useAnimatedProps, useReducedMotion, withDelay, withTiming,
  } from 'react-native-reanimated';
  import { Circle } from 'react-native-svg';
  const AnimatedCircle = Animated.createAnimatedComponent(Circle);

  // inside MatchRing:
  const C = 2 * Math.PI * r;                       // circumference, r = size/2 - stroke/2
  const target = C * (1 - pct / 100);              // final strokeDashoffset
  const offset = useSharedValue(C);                // start empty (full offset)
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      offset.value = target;                       // static fallback: appear filled instantly
    } else {
      offset.value = withDelay(
        index * 80 + 150,                          // begin after the card's POP settles
        withTiming(target, { duration: 1000, easing: Easing.out(Easing.cubic) }),
      );
    }
  }, []);                                          // mount only

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  // <AnimatedCircle … strokeDasharray={C} animatedProps={animatedProps} />
  ```
  (Foundation "Confidence ring" is r=56/1200ms in a 128px box on the MATCH screen; this list uses the smaller/shorter r≈26.5, 58px, 1000ms variant.) All UI-thread; no JS work per frame.
- **Tag chip entering:** **Phase 1 = render with no separate animation** (it rides its card's POP). If added in Phase 2, use a layout-animation `entering={FadeIn.delay(index*80 + 60)}` (worklet, no per-frame cost). Not a Phase-1 requirement.
- **View match press:** the bespoke Pressable (§3) — `scale 1 → 0.97` over `motion.tap` (100ms) via `withTiming` + `haptics.tap()` on press.
- **Reduced motion** (`useReducedMotion()` / foundation `useAnimationConfig`): POP → `FadeIn.duration(200)` (opacity only, **no stagger**); the ring branch above sets `strokeDashoffset` straight to `target` (no `withTiming`); header fade may stay (shortened) or be removed; the press scale stays at `1` (no scale). Haptics still fire (they are not "motion").

**Perf:** ring uses worklet `useAnimatedProps` (no JS-thread per-frame work); card layout is fixed (no measure-at-animate). For 3 static items no virtualization is needed; when the list grows switch to `FlashList` (§3), which recycles rows automatically (v2).

---

## 7. Native Screen-Management (foundation checklist, tailored)

**Routing:** New file `app/(lab)/matches.tsx` in the customer-app `(lab)` route group (foundation prerequisite). The **Matches tab** that routes here — its capsule styling, active/inactive states, icon (Lucide `Sparkles`), and Android inset handling — is owned by **`08-bottom-nav.md`** and the `(lab)` tab layout, **not** this screen. Do not register or restyle the tab bar in this file.

The **`/match` detail** route lives as a **modal-presentation** stack screen (foundation "matches → match: RISE bottom-up modal") — `app/match.tsx` or `app/match/[id].tsx` with `presentation:'modal'` (iOS) / matching animation on its `Stack.Screen`. That route is a separate spec (`06-match.md`); this screen only `router.push`es to it.

**Per-screen block (foundation §"Native Screen-Management Checklist"):**
```
Safe area:   [x] top edge (Screen edges=['top'])  [x] bottom inset (paddingBottom 96+insets.bottom)  [x] no Dynamic Island overlap
Keyboard:    [n/a] no text input on this screen → keyboardAware={false}
Responsive:  [x] flex:1 columns + fixed 58px ring  [x] SE 375 + Pro Max 430  [x] numberOfLines truncation (no images to aspectRatio)
Scroll/CTA:  [x] whole feed scrolls  [x] NO screen-level fixed CTA (each card owns its inline CTA)  [x] paddingBottom clears tab bar
Android/DM:  [x] tab inset handled by (lab) tab layout (spec 08)  [x] opaque white tab bar  [x] dark icons  [x] contrast (see E)
Polish:      [x] card radius 20 (≥12)  [x] 4px spacing tokens  [x] green-tinted soft shadow
```

- **A — Safe area:** `Screen` wraps `SafeAreaView edges={['top']}`. Prototype `60px` top → `paddingTop:16` on content (SafeArea covers the status bar). Prototype `130px` bottom → the tab bar (spec 08) is `68 + insets.bottom` tall; set the content `paddingBottom: 96 + insets.bottom` (via `useSafeAreaInsets()`) so the last card clears the bar. Verify on Pixel 7 gesture pill + 3-button and iPhone home-indicator.
- **B — Keyboard:** No text input → `keyboardAware={false}`. N/A. (Revisit when search/filter is added.)
- **C — Small vs large device:** Cards are two `flex:1` columns + a fixed 58px ring center — no fixed widths; scales SE (375) → Pro Max (430). Long titles on SE: `numberOfLines={2}` on `sell`/`want`, `numberOfLines={1}` on subs, `minWidth:0` on the columns so they shrink (prevents ring squeeze/overlap). Keep the 22px horizontal padding; optionally drop to `spacing.xl` (20) when `useWindowDimensions().width < 400`.
- **D — Scroll vs fixed CTA:** The whole feed scrolls; there is **no** screen-level fixed CTA (each card owns its inline CTA). A plain `ScrollView` (via `Screen scroll`) — or `FlashList` at scale — is correct; no absolute-bottom button. Only requirement: `paddingBottom` clears the tab bar (see A).
- **E — Android nav bar + dark mode:** The tab bar (spec 08) adds `insets.bottom`. Contrast: white-on-`greenDarkest` (`#0E3B2E`) CTA ≈ 12.5:1 (AAA). FOR SALE `greenMedium` (`#16A35A`) and WANTED `buyBlue` (`#2563EB`) kickers on white pass AA. Amber tag text `warnAmber` (`#E8A21A`) on `#FBF1DD` is decorative 11px **bold** on a pill — passes AA for large/bold text; acceptable. **Dark mode: out of scope (v1 light-only per foundation).**

---

## 8. Acceptance Checklist (pass/fail)

**Prerequisites (foundation — §0)**
- [ ] `HankenGrotesk_800ExtraBold` loaded in `app/_layout.tsx` `useFonts` **and** aliased as `fonts.headingBold` in `src/theme/typography.ts` (title, ring label, card titles render Hanken 800, not a fallback).
- [ ] `greenDarkest / greenMedium / greenLight / buyBlue / warnAmber` tokens exist in `@/constants/theme.ts` and are referenced by name (no raw brand hexes scattered in the screen).
- [ ] `app/(lab)/` route group + `src/features/lab/matches/` folder exist; `src/animations/recipes.ts` exports `POP`.
- [ ] No new npm dependency added (svg / flashlist / react-query / date-fns / reanimated already present).

**Visual fidelity**
- [ ] Eyebrow reads "AI MATCH CENTER" in amber (`warnAmber`), 11px, tracked ≈1.32px, IBM Plex Sans (`fonts.label`).
- [ ] Title "Where supply / meets demand." breaks onto 2 lines exactly, Hanken **800**, 30px / lineHeight **31.5 absolute**, `#10201A`, letterSpacing −0.75.
- [ ] Subcopy `#6B7A72`, 13px, Inter 400.
- [ ] Exactly 3 cards render from static data, 14px gaps, prototype order (Agilent → Haas → Copper).
- [ ] Each card: white bg, `#E7EDE8` 1px border, 20px radius, green-tinted (`#0E3B2E`) soft shadow — **not** the grey `elevation.md`.
- [ ] Cards 1 & 2 show green "New match" chip (`greenMedium` on `#EAF6EE`); card 3 shows amber "Worth a look" (`warnAmber` on `#FBF1DD`); each chip has a leading 6px dot in the chip color.
- [ ] Timestamps "2h ago / 5h ago / 1d ago" right-aligned, `#9AA89F`, Inter 600.
- [ ] FOR SALE kicker `greenMedium`; WANTED kicker `buyBlue`; WANTED column right-aligned.
- [ ] Ring is 58px, 5px stroke, transparent/white center; label centered Hanken 800 15px `greenDarkest`; fills to 96% / 94% (green `greenMedium`) and 91% (amber `warnAmber`); track `#E4EBE6`.
- [ ] View match CTA: bespoke Pressable, full-width, **44px** tall, 13px radius, `greenDarkest` bg, white 13.5px Inter label + right arrow.

**Interactivity**
- [ ] Tapping any "View match" navigates to `/match` with the match `id` param, fires `haptics.tap()` + press-scale 0.97. Never imports `expo-haptics` directly.
- [ ] Card body (non-button) is not tappable; no double-fire.
- [ ] Screen scrolls; last card fully visible above the bottom tab bar on iOS and Android — verified with `paddingBottom: 96 + insets.bottom` overriding Screen's default 48.

**Data / future-proofing**
- [ ] Screen renders from the single typed `MATCHES: Match[]` mock; swapping to `useQuery` changes only the data-source line, not JSX.
- [ ] `pct` stored as number; ring arc + label both derive from it. Chip color/bg derive from `tag` via `TAG_VARIANTS` (variant union, not open strings). `EmptyState` (with `onAction` callback → `router.push('/(lab)')`) shows when the array is empty.

**Motion / native**
- [ ] Cards enter with staggered POP (0/80/160ms); rings draw their stroke on mount (~1000ms out-cubic, after each card settles), `Easing` imported from `react-native-reanimated`.
- [ ] Reduced Motion on: no stagger, opacity-only fade, rings appear filled instantly (`offset.value = target`), press scale stays 1; haptics still fire.
- [ ] Verified iPhone SE (375) — no column overlap/truncation — and Pro Max (430); Pixel 7 nav-bar clearance correct.
- [ ] No `VirtualizedList nested in ScrollView` warning (either `.map()` in ScrollView, or `FlashList` owning scroll with `Screen scroll={false}`). 60fps scroll on mid-range Android.

---

### Key file paths
- New screen: `C:\Users\Pc\Desktop\greenBridge\GreenBridgeApp\app\(lab)\matches.tsx`
- Detail target (separate spec `06-match.md`): `...\app\match.tsx` (or `app\match\[id].tsx`), modal presentation
- New components: `...\src\features\lab\matches\components\{MatchRing,StatusTag,MatchCard}.tsx`
- Mock data: `...\src\features\lab\matches\data\matches.mock.ts`
- Reused primitives (barrel `@/components/ui`): `...\src\components\ui\{Screen,Text,EmptyState}.tsx` (Card exists but a plain `View` gives the exact 20px radius; `Button` is used only inside `EmptyState`)
- Haptics: `...\src\lib\haptics.ts` (`haptics.tap()` for the CTA — never `expo-haptics` directly)
- Tokens: `...\src\constants\theme.ts` (`brand`, `colors`, `spacing`, `radius`, `motion`; add `greenDarkest/greenMedium/greenLight/buyBlue/warnAmber` per §0; `fonts` re-exported from `...\src\theme\typography.ts`)
- Tab registration (Matches tab): owned by `08-bottom-nav.md` + the `(lab)` tab layout — **not** this file
- Font loader (add Hanken 800): `...\app\_layout.tsx` (`useFonts`) + `...\src\theme\typography.ts` (`fonts.headingBold`) — foundation prerequisite
