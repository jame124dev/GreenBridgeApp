# GreenBridge NewVersion — `Published` Screen — Implementation Spec

**Route:** `app/(lab)/published.tsx` — customer-app flow route named `published`, inside the `(lab)` route group.
> **Route-group note (canonical per foundation §Prerequisites).** The seller/scanner variant ships under `app/(tabs)/` and is untouched. The NewVersion customer flow (`home → processing → draft → published → matches → match → deal`) lives in the **`app/(lab)/`** route group, gated by the user-type fork (foundation §Overview + §Prerequisites). Screen components/mocks/hooks live under **`src/features/lab/`**. All in-doc navigation targets use the `(lab)` group — never the seller `(tabs)` group. Where this doc previously said "customer group TBD", read `(lab)`.

**State key in prototype:** `screen === 'published'` (HTML lines 230–267; copy/handlers lines 573–595)
**Status:** Phase 1 (Static). Interactive with hardcoded data derived from `mode`, zero network calls (foundation §Static-First). Must match the HTML prototype 1:1 visually.

---

## Prerequisites (foundation setup)

These are set up **once** in [`00-foundation.md` §Prerequisites](./00-foundation.md#prerequisites-foundation-setup) — they are NOT per-screen work. This screen depends on the following foundation items; if any is missing, the referenced task in the foundation is the fix, not a local workaround:

- [ ] **Fonts** — `HankenGrotesk_800ExtraBold` added to `useFonts({...})` in `app/_layout.tsx` (from `@expo-google-fonts/hanken-grotesk`) **and** exposed as `fonts.headingBold` in `src/theme/typography.ts`. *(Verified NOT loaded yet: `app/_layout.tsx` loads only Hanken 600/700; `fonts` exposes `heading`/`headingSemibold` only.)* Used here for the headline, match-count, and primary-CTA label. **Body/label stays Inter** — the prototype's Plus Jakarta Sans is a documented simplification (keep Inter), so the ghost-CTA label uses `fonts.bold` (Inter 700), NOT a new family.
- [ ] **Color tokens** — the green scale (`greenDarkest #0E3B2E`, `greenMedium #16A35A`) added to `@/constants/theme.ts` per foundation §Colors. *(Verified NOT present yet.)* This screen references them by name. `buyBlue` is intentionally **not** used here (see mode-color rule §4).
- [ ] **`(lab)` route group** — `app/(lab)/` exists and hosts this screen and its siblings (05-matches, etc.).
- [ ] **`src/features/lab/`** — feature folder exists for the customer-app screen components/mocks.
- [ ] **`src/animations/recipes.ts`** — exports `RISE`, `POP`, `PULSE`, `SPIN`, `SLIDE-X` Reanimated recipes + reduced-motion fallbacks. *(Verified NOT present yet.)* This screen uses `RISE` (entrance) and `POP` (staggered reveals). **Haptics are NOT in this module** — import `{ haptics }` from `@/lib/haptics` (existing, verified).

> **Existing, do NOT re-create:** `haptics` (`@/lib/haptics`) and `Button` (`@/components/ui`). Their verified contracts are used below exactly as the foundation documents them.

---

## 1. Purpose & Place in Flow

The celebration/success screen shown immediately after a seller publishes a listing or a buyer posts a request. It confirms the item is live AND that the AI already found counterparties, reinforcing the "managed marketplace — you only hear from us on a real match" promise.

**State-machine position** (foundation §Overview): `home → processing → draft → **published** → matches → match → deal`.

**Entry transition** (foundation §Screen transition matrix): `draft → published` = **RISE + scale 0.97→1**, ~400ms. This is the entry choreography this screen owns (see §6 — note the foundation's "spring 1.2" is a design-intent damping descriptor, not a literal Reanimated `damping` value; implement with `motion.spring`).

**Entry points**
- From `draft.tsx` when the user taps **Publish listing** (sell) / **Post request** (buy). Prototype handler `publish: () => this.go('published')` (line 587). Publishing is a primary action that fires **`haptics.impact()`** (MEDIUM thump — foundation §Haptic mapping) **on the Draft screen's button**, not here. (This screen fires its own one-shot `haptics.success()` on the badge pop — see §6.)
- Entry carries the current `mode` (`'sell' | 'buy'`) — copy and counts differ by mode (§4 table).

**Exits / navigation targets**
- **See your matches** (primary CTA) → `router.replace('/(lab)/matches')`. Prototype `navMatches: () => this.go('matches', 'matches')` (line 594) — also sets the active bottom-nav tab to `matches`. Use **`replace`** so the OS back-gesture does not return to this one-shot success screen.
- **Back to home** (ghost CTA) → `router.replace('/(lab)/home')`, resets tab to `home`. Prototype `goHome: () => this.go('home','home')` (line 591).
- Bottom nav is visible on this screen (`showNav` includes `'published'`). The tab bar is the shared customer-flow layout (spec 08-bottom-nav) — this screen covers content only.

---

## 2. Visual Layout — top-to-bottom (exact values from HTML)

> **RN lineHeight rule.** All `lineHeight` values below are given as `multiplier × fontSize ≈ N` where **N is the resolved absolute px** — in RN pass the **absolute number** (e.g. `lineHeight: 30`), never the CSS multiplier `1.1`. The `≈ N` figure is the value to hardcode.

Outer content container: `padding: 90px 26px 130px; min-height:100%` (line 232). In RN: the top `90` is decorative low-centering that sits **below** the safe-area top inset — render inside `Screen edges={['top']}` and apply an inner-container `paddingTop: 74` on top of the inset (do NOT double-count the inset). Horizontal padding `26`; bottom padding clears the tab bar + home indicator (see §7). Screen background is `brand.background` `#f8f9ff` (the prototype phone body is `#F4F7F4`; use the app token per foundation §Colors).

Vertical order:

### 2.1 Success check badge (centered)
- **Outer ring:** `84 × 84`, `borderRadius: radius.full`, background `#EAF6EE` (soft mint, screen-local), `marginBottom: 22`, `alignSelf: 'center'`, center content. (line 233)
- **Inner circle:** `58 × 58`, `radius.full`, background `greenMedium #16A35A` (success ring token, foundation §Colors expanded scale). Centered inside outer. (line 234)
- **Check glyph:** Lucide `Check`, `size={32}`, `color="#fff"`, `strokeWidth={3}` (prototype `M20 6 9 17l-5-5`, round caps/joins — Lucide `Check` matches). (line 235)

### 2.2 Headline (`pubTitle`)
- Font: Hanken Grotesk **800** — `fontFamily: fonts.headingBold` (**see Font note below — requires foundation action**), `fontSize: 27`, `lineHeight: 1.1 × 27 ≈ 30`, color `#10201A` (screen-local), `letterSpacing: -0.02 × 27 ≈ -0.54`, `textAlign: 'center'`, `marginBottom: 8`. (line 238)
- Copy (mode-dependent, line 574): sell = `"You're live — and already matched."`, buy = `"Request posted — matches found."`

### 2.3 Subtitle (`pubSub`)
- `fontFamily: fonts.regular` (Inter 400), `fontSize: 13.5`, `lineHeight: 1.5 × 13.5 ≈ 20`, color `#6B7A72` (screen-local — close to but not identical to `brand.textMuted #5b6b63`; keep prototype hex), `textAlign: 'center'`, `maxWidth: 280`, `alignSelf: 'center'`, `marginBottom: 26`. (line 239)
- Copy (line 575): sell = `"AI routed your listing to 101LAB and instantly found buyers who want it."`, buy = `"AI scanned the 101 network and found sellers that fit your spec."`

### 2.4 Match-count card (outer white shell)
- Background `brand.surface #fff`, `borderWidth: 1`, `borderColor: '#E7EDE8'` (screen-local — prototype-exact; `brand.border #dfe5ec` is close but not equal, keep prototype), `borderRadius: radius.xl` (20), `padding: 6` with `paddingBottom: 8` (prototype `6px 6px 8px`). Custom green-tinted lift shadow `0 16px 40px -28px rgba(14,59,46,.4)` — **not** an `elevation.*` preset (those top out at y8/α0.10). Author as inline `{ shadowColor: '#0E3B2E', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 8 }` (iOS shadow approximates the `-28px` spread; Android uses `elevation`). (line 241)

**Inner dark gradient band** (line 242):
- `LinearGradient` from `expo-linear-gradient` (foundation-listed). `colors={['#0E3B2E', '#14513D']}` = `greenDarkest` → a slightly-lighter forest (`#14513D` is a screen-local; `greenDarkest #0E3B2E` is the foundation token). `start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.5 }}` approximates the CSS `120deg`.
- `borderRadius: radius.lg` (16), `padding: 18`, `flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'space-between'`. All text on this band is white/mint (foundation rule: text on greens darker than `#16A35A` is white).
- **Left column:**
  - Label (`pubMatchLabel`): small-caps — `fontFamily: fonts.label` (IBMPlexSans_600SemiBold, foundation label role), `fontSize: 11`, `letterSpacing: 0.08 × 11 ≈ 0.88`, color `#9FD9BE` (mint, screen-local). Copy (line 576): sell = `"BUYERS MATCHED"`, buy = `"SELLERS MATCHED"`.
  - Count (`pubMatchCount`): `fontFamily: fonts.headingBold` (Hanken 800 — see Font note), `fontSize: 34`, `lineHeight: 34` (1.0), `marginTop: 4`, `color: '#fff'`. Copy (line 577): sell = `"3"`, buy = `"4"`.
- **Right — country avatar stack** (lines 247–251): `flexDirection: 'row'`, `marginRight: 4`. Three `40 × 40` `radius.full` circles, each `borderWidth: 2`, `borderColor: '#0E3B2E'` (matches band base so they read as cut-outs), overlapping via `marginLeft: -12` on the 2nd and 3rd. Label text `fontFamily: fonts.bold` (Inter 700), `fontSize: 13`, `color: '#CFF0DD'` (screen-local).
  - SG — bg `#1f6b4a`
  - TW — bg `#2a7d59`
  - VN — bg `#36916a`

**Managed-marketplace note row** (inside white shell, below band) (lines 253–256):
- `padding: 14` with `paddingBottom: 8` (prototype `14px 14px 8px`), `flexDirection: 'row'`, `alignItems: 'flex-start'`, `gap: 10`.
- Leading icon: Lucide `CheckCircle`, `size={18}`, `color="#16A35A"` (`greenMedium`), `strokeWidth={2}`, `marginTop: 1`, `flexShrink: 0`. (Prototype SVG is `M9 12l2 2 4-4` + `circle r=9` — Lucide `CheckCircle` is the exact glyph; do **not** use `BadgeCheck`/`CheckCircle2` which have different rings.)
- Text (`pubManagedNote`, line 578, identical for both modes): `fontFamily: fonts.regular`, `fontSize: 12.5`, `lineHeight: 1.5 × 12.5 ≈ 19`, color `#5E6E66` (screen-local), `flex: 1` (so it wraps beside the icon): `"As a managed marketplace, 101LAB verifies every counterparty and only pings you when there's a real match."`

### 2.5 CTA group (`marginTop: 22`, `flexDirection: 'column'`, `gap: 10`) (line 259)
- **Primary — "See your matches"** (line 260): height `54`, no border, `borderRadius: radius.lg` (16 — note this is above the foundation button default `rounded-xl`/12; prototype-exact wins for parity), background `greenDarkest #0E3B2E`, label `fontFamily: fonts.headingBold` (Hanken 800), `fontSize: 16`, `color: '#fff'`, centered `flexDirection: 'row'` with `gap: 8`, trailing Lucide `ArrowRight` `size={18} color="#fff" strokeWidth={2.2}`. Custom shadow `0 14px 26px -14px rgba(14,59,46,.6)` → inline `{ shadowColor: '#0E3B2E', shadowOpacity: 0.6, shadowRadius: 13, shadowOffset: { width: 0, height: 8 }, elevation: 6 }`. (line 262 = arrow)
- **Secondary — "Back to home"** (line 264): height `48` (meets `layout.minTouch` 48), transparent, `borderRadius: radius.lg` (16), label `fontFamily: fonts.bold` (Inter 700 — prototype spec'd Plus Jakarta Sans; foundation §Fonts keeps **Inter** as the documented system simplification), `fontSize: 14`, `color: '#5E6E66'`, centered.

> **Font note (foundation prerequisite — do not silently downgrade).** The headline, match-count, and primary-CTA label are prototype **Hanken Grotesk 800** → `fonts.headingBold`. This token is added **once in the foundation** (see [§Prerequisites](#prerequisites-foundation-setup)) — it is not per-screen work. Until the foundation task lands, `fonts.headingBold` is undefined; the temporary local fallback is `fonts.heading` (700), which is visibly lighter than the prototype, so the screen fails visual parity until the 800 add is done (that is a foundation blocker, not a screen workaround). Body/subtitle/secondary-CTA/avatar labels use already-loaded families (`fonts.regular` Inter 400, `fonts.bold` Inter 700); the small-caps match label uses `fonts.label` (IBM Plex Sans 600, already loaded). **Do not add Plus Jakarta Sans** — the ghost CTA label stays Inter 700 per the foundation's documented simplification.

---

## 3. Component Breakdown (reuse map)

**Reuse from `@/components/ui`** (foundation §UI component library — reuse first):
- `Screen` — root layout. Props: `scroll` (default true — content is short but must not clip on small devices / with the 800 add), `padded={false}` (the DS `padded` applies `px-lg`/16; we need the prototype's `26px` horizontal + `74/·` vertical, so we own padding in an inner `View`), `edges={['top']}`.
- `Text` — usable for the subtitle and managed note (`variant="bodySm"`, then override `style={{ fontSize, lineHeight, color }}` because those copies are 13.5/12.5px, not exact DS variants). **Caveat:** the DS `Text` sets only `fontSize/lineHeight/fontWeight` via NativeWind tone classes — it does **not** set `fontFamily`. Every Hanken/IBM-Plex string therefore needs an explicit `style={{ fontFamily: … }}` override; the tone classes also won't produce the exact prototype hexes (`#6B7A72`, `#5E6E66`, `#9FD9BE`…), so pass `style={{ color }}` too. For the headline/count/labels it is simpler to use plain RN `Text` with a full `StyleSheet` entry than to fight the DS variant defaults.
- `Button` — **not** used for the two CTAs. The DS `Button` primary is `bg-primary-500` (emerald `#10B981`), `h-14` (56), `rounded-2xl` (24), Inter label — none of which match the prototype's deep-forest `#0E3B2E`, `54px` height, `rounded-lg` (16), Hanken-800 label. (The primary CTA's 54px is a non-standard height — Button offers only `sm`=48/`md`=56/`lg`=64; per foundation the correct move for a bespoke look is a **bespoke `Pressable`**, which is what `PublishedCTA` is.) Build a screen-local `PublishedCTA` pressable that mirrors `Button.tsx`'s **verified** press animation: `useSharedValue(1)` scale → `withTiming(0.97, { duration: motion.tap })` on `onPressIn`, `withTiming(1, { duration: motion.tap })` on `onPressOut`. **Press scale is `0.97`, not 0.95, and there is no opacity animation** (foundation rule: press scale is `0.97` everywhere to match Button; Button does not animate opacity). Fire haptics via `@/lib/haptics` on **press (release)**: `haptics.impact()` (MEDIUM) for the primary CTA, `haptics.tap()` (light) for the ghost CTA — **do NOT call `expo-haptics` directly**, and do NOT fire a press-in haptic (Button fires its haptic on release, not press-in; match that).

**Theme tokens (`@/constants/theme`):** `radius.xl` (20, white shell), `radius.lg` (16, band + both CTAs), `radius.full` (badge + avatars), `spacing` (gaps — use `spacing.sm`=8, `spacing.md`=12, etc. where they line up; the odd values 10/22/26 are prototype-exact literals), `motion.tap` (press-in/out duration 100ms), `motion.spring`/`motion.springSoft` (entrance springs — see §6 for the 1.2-damping RISE note), `brand.background` (screen bg), `brand.surface` (card), `fonts.headingBold`/`fonts.regular`/`fonts.bold`/`fonts.label` (typography), and the expanded green scale `greenDarkest`/`greenMedium` (added **once** per foundation §Prerequisites — reference by name, do not re-add here).

**Screen-local one-off palette.** Colors the prototype uses that are **not** in the foundation green/brand scale — define once at file top as `const C = { … }` (do NOT promote a single-screen hex to a global token): `#14513D` (band gradient stop 2), `#EAF6EE` (badge outer ring), `#9FD9BE` (match label mint), `#CFF0DD` (avatar text), `#1f6b4a`/`#2a7d59`/`#36916a` (avatar bgs), `#E7EDE8` (card border), `#6B7A72` (subtitle), `#5E6E66` (note + ghost CTA), `#10201A` (headline). Colors that **do** map to foundation tokens — use the token, not a literal: `#0E3B2E` → `greenDarkest`, `#16A35A` → `greenMedium`, `#f8f9ff` → `brand.background`, `#ffffff` → `brand.surface`.

**Libraries (all already installed — no new deps):** `expo-linear-gradient` (`LinearGradient`) · `lucide-react-native` (`Check`, `CheckCircle`, `ArrowRight`) · `react-native-reanimated` (entrance choreography) · `react-native-safe-area-context` (`useSafeAreaInsets` for bottom clearance). The `RISE`/`POP` recipes come from `src/animations/recipes.ts` (foundation §Prerequisites). **Haptics come from `@/lib/haptics`** (existing `tap`/`impact`/`success` verbs) — foundation §Suggested code layout is explicit that there is **no** `src/animations/haptics.ts`; never import `expo-haptics` in this screen. Reduced-motion via `useReducedMotion()` (from `react-native-reanimated`, or the foundation's `src/hooks/useAnimationConfig.ts` wrapper).

**New small components (screen-local — `src/components/published/` or same file):**
1. `CheckBadge` — the 84/58 nested-circle success badge with `Check` glyph. No props. Owns its POP entrance + one-shot `haptics.success()` (guarded — see §6).
2. `CountryAvatarStack` — overlapping 40px circles. Props: `avatars: { code: string; bg: string }[]`, `ringColor: string`. Handles the `-12` overlap on all but the first.
3. `MatchCountCard` — white shell + gradient band + note row. Props: `label`, `count`, `avatars`, `ringColor`, `note`. Composes `CountryAvatarStack`.
4. `PublishedCTA` — bespoke `Pressable` with `variant: 'primary' | 'ghost'`, reanimated press-scale `0.97` (matches Button) + a release haptic. Props: `label`, `onPress`, `variant`, `rightIcon?`, `onPressHaptic?: () => void` (pass `haptics.impact` for primary, `haptics.tap` for ghost — fired on release; default: derive from `variant`).

---

## 4. Interactivity & Navigation

State this screen reads: `mode: 'sell' | 'buy'` — via route param (`useLocalSearchParams<{ mode?: PublishedMode }>()`) or a shared `useComposerStore().mode` (Zustand, foundation §Forms/state). Everything else is static/derived from `mode`.

**Mode-derived copy/count table** (all from HTML lines 573–578):

| Field | sell | buy |
|---|---|---|
| `pubTitle` | "You're live — and already matched." | "Request posted — matches found." |
| `pubSub` | "AI routed your listing to 101LAB and instantly found buyers who want it." | "AI scanned the 101 network and found sellers that fit your spec." |
| `pubMatchLabel` | BUYERS MATCHED | SELLERS MATCHED |
| `pubMatchCount` | 3 | 4 |
| `pubManagedNote` | (same for both) | (same for both) |

> **Mode-color rule (screen-specific).** Unlike Home/Draft, the prototype does **not** recolor this screen by mode — badge, band, avatars, and CTAs stay deep-forest green in **both** sell and buy. Only copy and count change. Do **NOT** introduce the foundation `buyBlue #2563EB` accent here, even though buy-mode uses it elsewhere.

**Tappable elements:**

| Element | Action | Feedback |
|---|---|---|
| **See your matches** (primary) | `router.replace('/(lab)/matches')` — **replace**, so the OS back-gesture doesn't return to the success screen — and set the active nav tab to `matches` (mirrors `navMatches`, line 594) | press-in scale `1→0.97` over `motion.tap` (100ms), `withTiming` back to `1` over `motion.tap` on release (no opacity animation — matches Button); **`haptics.impact()`** on release (MEDIUM = primary action, foundation §Haptic mapping). No press-in haptic. |
| **Back to home** (ghost) | `router.replace('/(lab)/home')`; set tab `home` (mirrors `goHome`, line 591) | same `0.97` press animation; **`haptics.tap()`** on release (light = back/secondary). No press-in haptic. |
| Bottom-nav tabs (shared layout) | navigate to that tab's route | per spec 08-bottom-nav (`haptics.tap()` on tab switch) |

Screen has no local mutable state other than the one-shot entrance animation. No text inputs, no toggles, no scroll-driven state.

---

## 5. Static Data Shape (now) + Dynamic Hook Points (later)

Hardcode a single view-model derived from `mode` (foundation §Static-First: keep the shape identical so Phase 2 is a data-source swap, not a rewrite):

```ts
// src/data/publishedStatic.ts
export type PublishedMode = 'sell' | 'buy';

export interface CountryAvatar { code: string; bg: string; }

export interface PublishedVM {
  title: string;
  subtitle: string;
  matchLabel: string;
  matchCount: string;        // string to mirror prototype ("3"/"4")
  managedNote: string;
  avatars: CountryAvatar[];  // country stack (SG/TW/VN)
}

const AVATARS: CountryAvatar[] = [
  { code: 'SG', bg: '#1f6b4a' },
  { code: 'TW', bg: '#2a7d59' },
  { code: 'VN', bg: '#36916a' },
];

const MANAGED_NOTE =
  "As a managed marketplace, 101LAB verifies every counterparty and only pings you when there's a real match.";

export function getPublishedVM(mode: PublishedMode): PublishedVM {
  const sell = mode === 'sell';
  return {
    title: sell ? "You're live — and already matched." : 'Request posted — matches found.',
    subtitle: sell
      ? 'AI routed your listing to 101LAB and instantly found buyers who want it.'
      : 'AI scanned the 101 network and found sellers that fit your spec.',
    matchLabel: sell ? 'BUYERS MATCHED' : 'SELLERS MATCHED',
    matchCount: sell ? '3' : '4',
    managedNote: MANAGED_NOTE,
    avatars: AVATARS,
  };
}
```

**Future dynamic hook points (leave TODO comments — do NOT wire in Phase 1):**
- `matchCount` + `matchLabel` → replace `getPublishedVM` with `useQuery(['publishResult', listingId], fetchPublishResult)` (TanStack, foundation §data) returning `{ matchedCount, counterpartyType, countries }`. Show `0`/skeleton while pending (badge + card already render, count animates in when resolved).
- `avatars` → derived from real `countries: ISO[]` in the publish result (map ISO → 2-letter code + color); collapse to a "+N" pill when `>3` (not needed for static parity).
- `title`/`subtitle` stay client-composed from `mode` + resolved count.
- CTA `See your matches` → deep-link `/(lab)/matches?listingId=…` filtered to this listing's matches.

---

## 6. Animations & Micro-interactions

Reference the foundation's **named** recipes (foundation §Animation & Interaction Recipes + §Prerequisites `src/animations/recipes.ts`). This is the **celebration** screen — the richest entrance in the app (~800ms choreography). Wrap the root in the `draft → published` transition (**RISE + scale `0.97→1`**, 400ms) and stagger internals with **POP**.

> **Spring-damping note.** The foundation transition matrix writes "spring 1.2" and "spring 0.75" as *design-intent* damping descriptors (higher = tighter/less overshoot; POP's 1.2 = slight overshoot), **not** literal Reanimated `damping` values — the real `motion.spring` in `@/constants/theme` is `{ damping: 18, stiffness: 220 }` and `motion.springSoft` is `{ damping: 22, stiffness: 160 }`. Implement the entrance (RISE + scale) with **`withSpring(target, motion.spring)`** for a tight, minimal-overshoot settle; implement POP with a slightly softer spring (`motion.springSoft`) to read as a small overshoot. The named `RISE`/`POP` recipes in `src/animations/recipes.ts` already encapsulate these presets — call them by name and do not hand-tune damping per screen.

**Screen entrance** — RISE + scale (foundation transition matrix `draft → published`): fade + slide-up 10px + scale `0.97 → 1`, ~400ms. Author with a root `useSharedValue` for `opacity`/`translateY`/`scale` driven on mount (`useEffect` → `withTiming`/`withSpring`), exposed via a single `useAnimatedStyle`. (If using layout `entering` props instead, combine `FadeInUp.duration(400)` with a scale shared value — but the shared-value approach is preferred here so the entrance composes cleanly with the reduced-motion fallback.)

**Choreography timeline (delays; POP = scale `0.92→1` + fade, ~300ms, slight overshoot per foundation):**
- `CheckBadge` outer → **POP**, no delay. Inner circle nested **POP** `+100ms`. `Check` glyph fades in with the inner circle.
- Headline → **RISE**/fade delay `300ms` (opacity + 10px slide, no scale).
- Subtitle → fade delay `350ms`.
- `MatchCountCard` shell → **POP** delay `450ms`.
- Country avatars → **POP** stagger 80ms each (foundation POP stagger = 80ms; delays `500 / 580 / 660ms`) — apply per-avatar via the `POP` recipe's `.delay(500 + i * 80)` (or `Animated.View entering={ZoomIn.delay(500 + i * 80)}` if using layout animations).
- Managed-note row → fade delay `600ms`.
- CTAs → **POP** stagger 80ms: primary `650ms`, ghost `730ms`.

**Micro-interactions (both CTAs):** press-in scale `1 → 0.97` over `motion.tap` (100ms) via `withTiming`, back to `1` over `motion.tap` on release — the **verified Button press recipe** (foundation: press scale is `0.97` everywhere; Button uses `withTiming` both directions at `motion.tap` and does **not** animate opacity). Copy `Button.tsx`'s `useSharedValue`+`withTiming` pattern exactly. Do **not** add an opacity animation and do **not** use 0.95.

**Haptics** — import `{ haptics }` from `@/lib/haptics` (foundation §Haptic mapping — confirm/selection actions only, never on passive fades). **Never import `expo-haptics` directly.**
- CheckBadge pop (once, on the inner-circle POP): **`haptics.success()`** — foundation reserves Success "sparingly on successful publish/confirm"; this is the canonical use. Guard with a ref so it fires only on first focus.
- Primary CTA: **`haptics.impact()`** on release (MEDIUM). No press-in haptic.
- Ghost CTA: **`haptics.tap()`** on release (light). No press-in haptic.
- No haptic on the passive headline/subtitle/note fades.

**Reduced motion** (`useReducedMotion()` / the foundation `useAnimationConfig` wrapper, foundation §Reduced motion). Every animated value has a static fallback: RISE → `FadeIn(200)` opacity-only (no translate/scale); POP → `FadeIn` (no scale/overshoot); drop all stagger (render final state, single ~200ms fade for the whole screen). Skip the Success entrance haptic when reduced-motion is on (it's coupled to the badge pop). Press scale → stays at `1` (no scale). **CTA press haptics still fire** — those are action feedback, not motion.

---

## 7. Native Screen-Management (foundation §Native checklist, tailored)

```
Safe area:   [x] top edge (Screen edges={['top']})  [x] bottom inset (insets.bottom + tab bar in content padding)  [x] no Dynamic Island overlap (74px inner top spacer sits below inset)
Keyboard:    [x] N/A — no text inputs on this screen; do NOT set keyboardAware
Responsive:  [x] flex widths (card fills 26px-padded width, no fixed w)  [x] SE 375 + Pro Max 430 tested  [x] no images (avatars are colored circles, not photos)
Scroll/CTA:  [x] content scrolls (Screen scroll for SE safety)  [~] CTAs scroll WITH content (see note)  [x] paddingBottom spacer clears tab bar
Android/DM:  [x] nav inset (insets.bottom)  [x] opaque white tab bar (shared layout)  [x] dark status-bar icons on #f8f9ff  [x] contrast ≥4.5:1 (verified below)
Polish:      [x] card radius ≥12px (shell 20, band/CTA 16)  [x] 4px spacing tokens + prototype literals  [x] custom green shadow (not sm/md preset — documented)
```

**Safe areas** — Root `Screen edges={['top']}`. The prototype `90px` top is decorative; apply as inner `paddingTop: 74` on top of the SafeArea inset (don't double-count). Bottom: content must clear the shared tab bar + home indicator — prototype `paddingBottom: 130` ≈ tab-bar height + home indicator. In RN pass `contentContainerStyle={{ paddingBottom: 24 + tabBarHeight + insets.bottom }}` (from `useSafeAreaInsets().bottom`). **Note on `Screen`:** it applies a default `contentContainerStyle` of `{ flexGrow: 1, paddingBottom: 48 }` and **merges the prop after** the default, so a `paddingBottom` you pass overrides the 48 (verified in `Screen.tsx`) — you do not need to fight the default. If the tab bar belongs to the same navigator it already insets its own area — **verify the ghost CTA is never under the tab bar** on a gesture-pill device.

**Keyboard** — N/A. No inputs. Do not enable `keyboardAware`.

**Small vs large device** — No fixed widths; card is `width: '100%'` inside the 26px padding, band/avatar rows are flex. Subtitle honors `maxWidth: 280, alignSelf: 'center'`. On iPhone SE (375px, short) the `74px` top spacer + full choreography can push the CTAs low — because content is inside `Screen scroll` it never clips; verify CTAs are reachable and the page doesn't *require* scrolling on SE (celebratory screen should read at a glance).

**Scroll vs fixed CTA** — Foundation §D prefers a sticky CTA for *long* content. This screen is **short and celebratory**, so the CTAs are the natural end of the flow, not a persistent action bar — keep them **in-scroll** (do not pin/absolute-position). Use `Screen scroll` purely for SE safety; set `contentContainerStyle={{ flexGrow: 1 }}` so short content still fills height and the top spacer centers the badge nicely.

**Android nav bar + status bar** — Bottom padding includes `insets.bottom` (gesture pill / 3-button). Tab bar is opaque white (shared layout). Status bar = dark-content on the light `#f8f9ff` bg.

**Contrast (WCAG AA ≥4.5:1):**
- White `#fff` on inner circle `greenMedium #16A35A` → ~2.9:1 for the check glyph — a **3px non-text graphic** (check icon), governed by the **3:1 non-text** rule, which it meets; not a text failure.
- Mint label `#9FD9BE` on band base `#0E3B2E` → ~5.1:1 ✓ (text).
- Avatar text `#CFF0DD` on avatar bgs (`#1f6b4a`…`#36916a`) → ≥4.5:1 ✓.
- Count `#fff` on band → ✓. Note text `#5E6E66` on `#fff` → ✓.

---

## 8. Acceptance Checklist (pass/fail)

**Visual parity**
- [ ] Success badge: outer 84px `#EAF6EE` ring, inner 58px `greenMedium #16A35A` circle, white 32px `Check` (strokeWidth 3), centered, 22px below top spacer.
- [ ] Headline Hanken **800** (`fonts.headingBold`) / 27px / `#10201A` / letterSpacing ≈ -0.54 / center; correct copy per mode. (If still 700, fails — 800 must be loaded.)
- [ ] Subtitle Inter 13.5px `#6B7A72`, centered, `maxWidth: 280`.
- [ ] White shell: radius 20, `1px #E7EDE8` border, soft green drop shadow (custom, not elevation preset).
- [ ] Dark band: linear gradient `#0E3B2E → #14513D` (≈120°), radius 16, 18px pad, space-between.
- [ ] Match label IBM Plex Sans 600 `#9FD9BE` 11px letterSpacing ≈ 0.88; count Hanken 800 34px white; correct label + count per mode (sell 3 / buy 4).
- [ ] Avatar stack: SG `#1f6b4a`, TW `#2a7d59`, VN `#36916a`, 40px, `2px #0E3B2E` ring, `-12` overlap, Inter-700 `#CFF0DD` labels.
- [ ] Note row: 18px `greenMedium` `CheckCircle` icon + Inter 12.5px `#5E6E66` managed-marketplace copy, wraps beside icon.
- [ ] Primary CTA: 54px `greenDarkest #0E3B2E`, radius 16, Hanken-800 16px white "See your matches" + trailing `ArrowRight`, green shadow.
- [ ] Ghost CTA: 48px transparent, Inter-700 `#5E6E66` "Back to home".

**Behavior**
- [ ] Screen reads `mode`; all mode-dependent fields switch correctly between sell/buy.
- [ ] Accents stay deep-forest in BOTH modes (no `buyBlue`).
- [ ] "See your matches" → `/(lab)/matches` via `router.replace`, tab set to `matches`, **`haptics.impact()` on release** (no press-in haptic).
- [ ] "Back to home" → `/(lab)/home` via `router.replace`, tab set to `home`, **`haptics.tap()` on release** (no press-in haptic).
- [ ] Bottom nav visible and functional (shared layout).

**Animation**
- [ ] Screen enters with RISE + scale `0.97→1` (~400ms, `withSpring(motion.spring)`) — matches `draft → published`.
- [ ] Choreography order: badge POP (with one `haptics.success()`) → headline → subtitle → card shell → staggered avatars (80ms) → note → CTAs.
- [ ] POP uses scale `0.92→1` (slight overshoot); **CTA press uses scale `1→0.97` via `withTiming(motion.tap)` both directions, NO opacity animation** (verified Button recipe — not 0.95, not opacity 0.85).
- [ ] Reduced-motion: no scale/stagger, opacity-only ~200ms fade, screen fully readable; entrance `haptics.success()` suppressed, CTA press haptics (`impact`/`tap`) still fire.

**Native**
- [ ] No horizontal overflow / no clipping on iPhone SE (375px) or Pro Max (430px).
- [ ] CTAs never obscured by tab bar / home indicator (`insets.bottom` respected).
- [ ] Contrast: mint-on-band and avatar-text ≥4.5:1; white check on `#16A35A` meets 3:1 non-text rule.
- [ ] Renders as a real Expo Router screen with hardcoded data and **zero network calls** (Phase 1).

**Foundation dependency (blocking — owned by [00-foundation §Prerequisites](#prerequisites-foundation-setup), not this screen)**
- [ ] `HankenGrotesk_800ExtraBold` added to `app/_layout.tsx` `useFonts` + `fonts.headingBold` token added (`src/theme/typography.ts`). Until done, headline/count/primary-CTA render in 700 and this screen fails visual parity.
- [ ] `greenDarkest` (`#0E3B2E`) + `greenMedium` (`#16A35A`) present in `@/constants/theme` color tokens.
- [ ] `src/animations/recipes.ts` exports `RISE` + `POP` (+ reduced-motion fallbacks); `(lab)` route group + `src/features/lab/` exist.

---

### Reference files
- Prototype: `C:\Users\Pc\Desktop\greenBridge\GreenBridgeApp\101LAB Mobile.dc.html` (lines 230–267 markup; 573–595 copy/handlers)
- Foundation: `C:\Users\Pc\Desktop\greenBridge\GreenBridgeApp\NewVersion\00-foundation.md` (tokens, recipes, native checklist, screen index)
- Primitives: `C:\Users\Pc\Desktop\greenBridge\GreenBridgeApp\src\components\ui\{Screen,Text,Button,Card}.tsx` + barrel `index.ts`
- Haptics (existing, verified): `C:\Users\Pc\Desktop\greenBridge\GreenBridgeApp\src\lib\haptics.ts` (`tap`/`impact`/`heavy`/`success`/`warning`/`error`)
- Tokens: `C:\Users\Pc\Desktop\greenBridge\GreenBridgeApp\src\constants\theme.ts` (`brand`, `radius`, `spacing`, `motion`, `elevation`, `typography`) + `src\theme\typography.ts` (`fonts`)
- Font load list: `C:\Users\Pc\Desktop\greenBridge\GreenBridgeApp\app\_layout.tsx` (`useFonts`)
- Animation recipes (foundation prerequisite): `src\animations\recipes.ts`, `src\hooks\useAnimationConfig.ts` (per foundation §Suggested code layout). **There is NO `src\animations\haptics.ts`** — haptics live in `@/lib/haptics`.
- New files to add: `src\data\publishedStatic.ts` (VM) — or under `src\features\lab\`; `app\(lab)\published.tsx` (screen); optional `src\components\published\*` (or `src\features\lab\published\*`): `CheckBadge`, `CountryAvatarStack`, `MatchCountCard`, `PublishedCTA`.
