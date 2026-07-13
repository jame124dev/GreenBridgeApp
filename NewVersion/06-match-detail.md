# Match Detail Screen — Implementation Spec

**Screen:** `Match Detail` · 101LAB by GreenBridge (AI-first buy/sell mobile app)
**Route:** `app/(lab)/match/[id].tsx` (Expo Router, dynamic segment inside the foundation `(lab)` route group).
**HTML source of truth:** `c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/101LAB Mobile.dc.html` lines 312–382; state/copy logic lines 469–599.
**Foundation:** `00-foundation.md` (this screen is #06 in the Screen Index; read foundation first).
**Status:** Fully interactive with STATIC hardcoded data. No real APIs. Must match the HTML prototype 1:1 visually.

---

## Prerequisites (foundation setup)

These are **owned by `00-foundation.md`** and set up **once** there — not per-screen rework. This screen depends on the following foundation items; if they are not yet in the repo, do them per the foundation's [Prerequisites](00-foundation.md#prerequisites-foundation-setup) section before building this screen:

- [ ] **`(lab)` route group** — `app/(lab)/` exists (Expo Router), gated by the customer/seller fork. This screen's file is `app/(lab)/match/[id].tsx`.
- [ ] **`src/features/lab/`** — the customer-app feature folder exists. This screen's components + fixture live under `src/features/lab/match/` (see §3 / Files list).
- [ ] **Fonts — `HankenGrotesk_800ExtraBold`** added to the `useFonts({...})` load list in `app/_layout.tsx` (from `@expo-google-fonts/hanken-grotesk`) **and** exposed as `fonts.headingBold` in `src/theme/typography.ts`. Every headline on this screen (ring %, card titles, section title, CTA) uses `fonts.headingBold`. Hanken 700 (`fonts.heading`) / 600 (`fonts.headingSemibold`) are already loaded; body/label stays **Inter** (the prototype's Plus Jakarta Sans is a documented simplification — do NOT add it).
- [ ] **Color tokens** — the green/buy/amber tokens are added to `@/constants/theme.ts` per foundation [Colors](00-foundation.md#colors). This screen consumes `greenMedium #16A35A`, `greenDarkest #0E3B2E`, `buyBlue #2563EB`, `warnAmber #E8A21A`. They do **NOT** exist in the repo yet — treat them as "add per foundation," never "already present." (Exact accessor: see §3, "Token accessor" note — the foundation adds them to `@/constants/theme.ts`; reference by name, do not scatter hexes.)
- [ ] **`src/animations/recipes.ts`** — the motion recipes module exists, exporting `RISE`, `POP`, `PULSE`, `SPIN`, `SLIDE-X` (Reanimated entering builders) + reduced-motion fallbacks. This screen uses `RISE` (entrance) and `POP` (card/reason/chip/CTA reveals). The confidence-ring arc reveal is a screen-local helper built on the same primitives (see §6).

> **Haptics & Button already exist** — do NOT re-create them. Import `{ haptics }` from `@/lib/haptics` and `Button` from `@/components/ui`. Their verified contracts are honored throughout this spec (§3, §6).

---

## 1. Purpose & Place in Flow

The Match Detail screen is the **decision moment** of the 101LAB match funnel: after the AI has surfaced a match, the user opens it to see *why* the two sides fit, how confident the AI is, who the counterparty is, and then commits by tapping **"Confirm interest — talk to seller."** It is the bridge between passive discovery (Matches feed) and active negotiation (Deal Room). Per the foundation state machine: `… → matches → match → deal`.

**Entry points**
- `Matches` feed → tap a match card → `openMatch()` in the prototype → this screen. In RN: `router.push('/(lab)/match/${id}')` (Expo Router resolves the `(lab)` group segment; the visible path is `/match/${id}`).
- (Future) Push notification "New match found" (Expo Notifications, per foundation) → deep link straight to `/match/[id]`.

**Exits / navigation targets**
- **Back** (top-left "‹ Matches") → `router.back()` → returns to `Matches` feed (fallback `router.replace('/(lab)/matches')` if there is no history — e.g. deep-link entry). Prototype handler: `navMatches`.
- **Primary CTA** "Confirm interest — talk to seller" → navigate to Deal Room. Prototype handler: `confirm() → go('deal')`. In RN: `router.push('/(lab)/deal/${dealId}')` (deal room screen is spec #07; for now the CTA can `router.push('/(lab)/deal/4821')`, guarded with a `toast` fallback if that route does not yet exist).

**Modes.** The app has a global `mode: 'sell' | 'buy'` (foundation: Zustand UI state). The Match Detail screen itself is **mode-agnostic in structure** — it always shows both a WTS (sell/green) side and a WTB (buy/blue) side. Mode only shifts which side is framed as "you" (see §4). The confidence ring and CTA remain green (`greenMedium #16A35A`) in **both** modes because a *match* is inherently a two-sided sell⇄buy event; the buy-mode `buyBlue` accent is NOT applied to the CTA here (contrast with the Home composer, where the CTA does flip blue in buy mode). The amber variant (`warnAmber #E8A21A`) is only for lower-confidence matches (see §5 `tag`).

---

## 2. Visual Layout (top → bottom, exact values from HTML)

Root container: full-bleed, background `#F4F7F4` (prototype `surface-light`). NOTE: `brand.background` is `#f8f9ff` (cool-neutral) — this screen intentionally overrides it to `#F4F7F4` so the ring's inner mask (which also uses `#F4F7F4`) blends into the page. Apply this override on the outer `View`, not on `Screen` (which forces `bg-bg`). Prototype vertical padding block is `60px 0 130px` — top is replaced by the safe-area top inset + back-link block; bottom `130px` is reserved so the sticky CTA never overlaps content.

Horizontal gutter throughout: **22px** (prototype `padding:0 22px` / `margin: … 22px`). This falls between spacing tokens `xl` (20) and `2xl` (24), so it is NOT on the 4px scale — declare a screen-local `const GUTTER = 22` and use it explicitly rather than a token, so the divergence is documented and intentional.

### 2.1 Back link (top)
- Container padding: `0 22px`, button padding `6px 0`.
- Chevron-left icon `17×17`, stroke `#5E6E66` (= `brand.textMuted` is `#5b6b63`; prototype is `#5E6E66` — use exact hex), stroke-width `2.2`.
- Label "Matches" — `font-size 13px`, `font-weight 600`, color `#5E6E66`, gap `5px` between icon and text.

### 2.2 Confidence ring (hero)
- Column, center-aligned. Padding `14px 22px 4px`.
- Ring wrapper: `128×128px`, relative.
  - **Track/fill layer** (`position:absolute; inset:0`): `border-radius: 99px`, background `conic-gradient(#16A35A 0% 96%, #E4EBE6 96% 100%)` — green arc to 96%, remaining `#E4EBE6` track.
  - **Inner mask** (`position:absolute; inset:9px`): `border-radius:99px`, background `#F4F7F4` (matches page bg, creates the 9px-thick ring).
  - **Center text** (relative, centered):
    - "96%" — Hanken Grotesk **800** (`fonts.headingBold`), `fontSize:34`, **`lineHeight:34`** (RN needs absolute px; prototype `line-height:1` × 34 = 34), color `#0E3B2E` (= token `greenDarkest`).
    - "AI MATCH" — `fontSize:9.5`, weight `700`, `letterSpacing:1.14` (RN uses absolute px, not em; `.12em` × 9.5 ≈ 1.14), color `#16A35A` (= `greenMedium`), `marginTop:2`. Family: Inter/`fonts.bold` (small-caps label; Hanken not required here).
- **RN implementation of the conic gradient:** NativeWind and `expo-linear-gradient` cannot render a conic gradient. Build the ring with **`react-native-svg`** (foundation: `15.15.4`, already installed): an SVG `Circle` track (`stroke #E4EBE6`) + a foreground `Circle` (`stroke #16A35A`) with `strokeDasharray`/`strokeDashoffset` sized to 96% of the circumference, `strokeLinecap="round"`, rotated `-90deg` (via SVG `transform="rotate(-90 64 64)"` or a wrapping `rotate`) so the arc starts at 12 o'clock. Radius `56`, `strokeWidth 6` (56·2 + 6·2 = 124 ≈ the 128 box; the 9px prototype mask thickness reads as ~6px stroke inside the 128 box — keep `r=56, strokeWidth=6` per the foundation ring recipe). ViewBox `128×128`. Center the "96% / AI MATCH" text absolutely over the SVG. This is the exact recipe already documented in foundation → "Confidence ring (MATCH screen)".

### 2.3 Side-by-side cards (WTS / WTB)
- Row, `margin:16px 22px 0`, `gap:10px`, `align-items:stretch` (equal heights). In RN use `flexDirection:'row'` + `HStack gap={10}` (foundation `HStack`), each child `flex:1`.
- Each card: `flex:1`, `background:#fff` (= `brand.surface`), `border:1px solid #E7EDE8`, `border-radius:18px`, `padding:14px`.
- **Left (FOR SALE · WTS):**
  - Eyebrow "FOR SALE · WTS" — `fontSize:10`, weight `700`, `letterSpacing:0.5` (`.05em` × 10), color `#16A35A` (green / `greenMedium`), `marginBottom:8`.
  - Title "Agilent 1260 Infinity II HPLC" — Hanken `800` (`fonts.headingBold`), `fontSize:15`, **`lineHeight:17`** (RN absolute px; `1.15` × 15 ≈ 17), color `#10201A`, `numberOfLines={2}`.
  - Sub "Asia Surplus · Singapore" — `fontSize:12`, color `#8A988F`, `marginTop:5`.
  - Price "$13,400" — Hanken `800` (`fonts.headingBold`), `fontSize:18`, color `#10201A`, `marginTop:9`.
- **Right (WANTED · WTB):**
  - Eyebrow "WANTED · WTB" — same style but color `#2563EB` (= token `buyBlue`).
  - Title "Agilent / Waters HPLC + DAD".
  - Sub "You · pharma QC".
  - Price "up to $18,000".

### 2.4 "Why AI matched you" card
- `margin:14px 22px 0`, `background:#fff`, `border:1px solid #E7EDE8`, `border-radius:18px`, `padding:16px`.
- Header row (`gap:8px`, `margin-bottom:11px`): a 4-point **sparkle** glyph `17×17` filled `#16A35A`, then title "Why AI matched you" — Hanken `800` (`fonts.headingBold`), `fontSize:14`, color `#10201A`.
  - **Icon note:** the prototype uses a custom 4-point diamond-sparkle `<path>` (line 352), NOT lucide's multi-point `Sparkles`. To match 1:1, render the exact path as an inline `react-native-svg` `Path` (`d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z"`, `fill="#16A35A"`). Do NOT substitute `lucide-react-native` `Sparkles` (different silhouette).
- Reasons list: column, `gap:9px`. Each reason row: `gap:9px`, `fontSize:12.5`, color `#445049`, **`lineHeight:18`** (RN absolute px; `1.4` × 12.5 ≈ 18). Leading **check** icon `15×15`, stroke `#16A35A`, stroke-width `2.5`, wrapper `flexShrink:0; marginTop:1` (top-aligned to first text line). Use `lucide-react-native` `Check` `size={15} color="#16A35A" strokeWidth={2.5}` — matches the prototype `M20 6 9 17l-5-5` path exactly.
  1. "Model & detector (DAD) match the buyer's exact spec."
  2. "$13,400 sits 26% under the buyer's $18k budget."
  3. "Singapore → ships APAC, both verified accounts."

### 2.5 Trust chips
- Row, `margin:12px 22px 0`, `gap:8px`.
- Two equal chips, each `flex:1`, `background:#EAF3EC`, `border-radius:13px`, `padding:11px 12px`, row with `gap:8px`.
  - Chip 1: **shield-check** icon `17×17` stroke `#0E6B3F` sw `2` + label "Verified seller". Use `lucide-react-native` `ShieldCheck` (matches prototype shield + inner check paths).
  - Chip 2: **escrow/vault** icon `17×17` stroke `#0E6B3F` sw `2` + label "101LAB escrow". The prototype draws a custom safe/vault (`rect` + inner path, line 369) — lucide's `Vault` or `Archive` is close but not exact; to match 1:1 render the prototype paths as inline `react-native-svg` (`<Rect x=2 y=7 width=20 height=14 rx=2/>` + `<Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`). `lucide` `Vault` is an acceptable fallback if pixel-exactness is deprioritized — flag in review.
  - Labels: `fontSize:11.5`, weight `700`, color `#0E6B3F`, **`lineHeight:14`** (RN absolute px; `1.2` × 11.5 ≈ 14).

### 2.6 CTA (sticky bottom)
- Prototype renders it inline (`padding:18px 22px 0`); in RN make it a **sticky footer** (see §7 scroll strategy).
- Button: `width:100%`, `height:54`, `borderRadius:16`, `background:#16A35A`, text `#fff`, Hanken `800` (`fonts.headingBold`), `fontSize:16`, `gap:8`, centered.
  - **Height reality:** `54px` is NOT a foundation `Button` size (real sizes are `sm` 48 / `md` 56 / `lg` 64 — there is no 54px). Reuse `Button size="md"` (56, closest ≥44 target) and **override with `style={{ height:54, borderRadius:16, backgroundColor:'#16A35A', ...ctaShadow }}`**. This is a documented, prototype-exact, screen-local override — do NOT propose a new Button size. (54 > 44 min tap target, OK.)
  - **Haptic reality:** the Button `haptic` prop is a **boolean** (default `true` → fires expo-haptics **Light** internally). This CTA needs a **MEDIUM** confirm thump, so pass **`haptic={false}`** on the Button and call **`haptics.impact()`** manually first in `onPress` (see §4 / §6). Never pass `haptic="medium"` — that is not a valid prop value.
  - **Font:** the Button label renders through the `Text` primitive; the `fonts.headingBold` (Hanken 800) look is achieved by the Button's own text styling — if the shipped Button label does not render Hanken 800, use a **bespoke `Pressable`** for the CTA instead (matching the 0.97 press scale from §6) rather than fighting the Button's internal `Text`. State the chosen path in the PR.
  - Shadow (`ctaShadow`): prototype `box-shadow:0 14px 26px -12px rgba(22,163,90,.6)` → RN `{ shadowColor:'#16A35A', shadowOffset:{width:0,height:14}, shadowOpacity:0.5, shadowRadius:13, elevation:8 }`. (Foundation `elevation` tokens don't cover a colored glow — this colored shadow is screen-local and intentional.)
  - Label: "Confirm interest — talk to seller" (buy mode; see §4 for the sell-mode verb swap).
- Reassurance caption below: `textAlign:'center'`, `fontSize:11.5`, color `#90A096`, `marginTop:11`: "No commitment yet. 101LAB introduces you and manages the deal."

### Color / font quick-reference (this screen)
| Role | Hex | Foundation token | Notes |
|---|---|---|---|
| Page bg | `#F4F7F4` | — (override) | matches ring inner mask; overrides `brand.background` (`#f8f9ff`) for this screen |
| Card surface | `#fff` | `brand.surface` | |
| Card border | `#E7EDE8` | — (screen-local) | close to `brand.divider #eef2f9` but greener; use exact hex |
| Ring fill / green accent | `#16A35A` | `greenMedium` | CTA, WTS eyebrow, checks, sparkle |
| Ring track | `#E4EBE6` | — (screen-local) | |
| Ring % text | `#0E3B2E` | `greenDarkest` | Hanken 800 |
| WTB blue accent | `#2563EB` | `buyBlue` | WTB eyebrow only |
| Trust chip bg | `#EAF3EC` | — (screen-local) | soft green, distinct from `brand.primarySurface #e6f2eb` |
| Trust chip text | `#0E6B3F` | — (screen-local) | not in token set; use exact hex |
| Title text | `#10201A` | — (near `brand.foreground #121c28`; use exact) | Hanken 800 |
| Body/reason text | `#445049` | — (near `brand.textMuted`; use exact) | |
| Muted sub text | `#8A988F` | — (screen-local) | |
| CTA caption | `#90A096` | — (screen-local) | |
| Back link text | `#5E6E66` | — (near `brand.textMuted #5b6b63`; use exact) | |
| Amber ring (91–94%) | `#E8A21A` | `warnAmber` | derived, see §5 |
| Headline font | Hanken Grotesk **800** | `fonts.headingBold` (PREREQUISITE — add per foundation) | ring %, card titles, section title, CTA — requires `HankenGrotesk_800ExtraBold` loaded in `app/_layout.tsx` + `fonts.headingBold` in `src/theme/typography.ts` (see Prerequisites) |

**Token-vs-hex rule for this screen:** where a foundation token maps exactly (`greenMedium`, `greenDarkest`, `buyBlue`, `warnAmber`, `brand.surface`), **use the token**. Where the prototype hex has no exact token (`#E7EDE8`, `#E4EBE6`, `#EAF3EC`, `#0E6B3F`, `#8A988F`, `#90A096`, `#445049`, `#10201A`, `#5E6E66`, `#F4F7F4`), use the exact hex via the screen-local const block in §3 — do NOT round to a near token, since this screen must match the prototype 1:1.

---

## 3. Component Breakdown (reuse map + new components)

**Imports base:**
```ts
import { Screen, Text, Card, Button, HStack, Stack } from '@/components/ui';
import { colors, brand, fonts, radius, spacing, elevation, motion } from '@/constants/theme';
import { haptics } from '@/lib/haptics';            // semantic verbs ONLY — never import expo-haptics in a screen
import { RISE, POP } from '@/animations/recipes';    // foundation motion recipes (prerequisite)
import { ChevronLeft, Check, ShieldCheck } from 'lucide-react-native';
import Animated, { FadeIn, useReducedMotion, useAnimatedProps, useSharedValue, withTiming, withDelay, Easing } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { toast } from 'sonner-native';
```
Notes on the imports (all in the foundation stack):
- **Haptics** — import `{ haptics }` from `@/lib/haptics`; the only verbs are `tap / impact / heavy / success / warning / error` (there is no `light()`/`medium()`). Back link → `haptics.tap()` (light/selection); CTA confirm → `haptics.impact()` (medium). **Never** `import * as Haptics from 'expo-haptics'` in a screen.
- **Motion** — `RISE`/`POP` come from `@/animations/recipes.ts` (foundation prerequisite). The confidence-ring arc reveal is built inline with `useSharedValue`/`useAnimatedProps` (§6). Reanimated's `FadeInUp`/`ZoomIn` are the primitives those recipes wrap — screens cite the named recipe, not the raw entering builder.
- **Tokens** — `@/constants/theme` is the correct token source (`@/theme/*` is legacy Stitch hex and MUST NOT be used for this new screen). Token accessor: see "Token accessor" note below — the green/buy/amber tokens are added by the foundation to `@/constants/theme.ts`; reference them by name (do not scatter hexes).
- `fonts.headingBold` (Hanken 800) is the prerequisite font token from `@/constants/theme` (re-exported from `src/theme/typography.ts`).

### Reuse (existing `src/components/ui`)
| Prototype element | Reuse | How |
|---|---|---|
| Root + safe area + scroll | **`Screen`** | See §7 — because we need a **sticky CTA outside the scroll**, wrap the whole screen in an outer `View` with `backgroundColor:'#F4F7F4'`; put the scrolling content in a `ScrollView` (or `Screen scroll padded={false} edges={['top']}` for the scroll region) and the CTA footer in a sibling absolute `View`. `padded={false}` because the 22px gutter is applied per-section, not globally. |
| Back link | **`Text`** + `Pressable` | Not `Button` (Button is a filled/pill control; back link is a bare text+icon row). `lucide-react-native` `ChevronLeft size={17} color="#5E6E66"`. `haptics.tap()` (light/selection) on press. Wrap the row so the tap target is ≥44px tall (icon 17 + `paddingVertical` to reach 44). |
| WTS / WTB cards | **`Card`** variant `outlined` | Border `#E7EDE8`, radius 18 (override via `style` — Card default is `rounded-2xl` = 24). Inner content is custom `Text` rows. |
| "Why AI matched you" card | **`Card`** variant `outlined` | Same radius/border override. Header sparkle = inline `react-native-svg` `Path` (see §2.4), NOT lucide. |
| Reason check bullets | `lucide-react-native` `Check` + `Text` | `size={15} color="#16A35A" strokeWidth={2.5}`. |
| Trust chips | **`Card`** variant `flat` OR plain `View` | bg `#EAF3EC`, radius 13. Icons: `ShieldCheck` (lucide) + custom vault SVG (see §2.5). |
| Primary CTA | **`Button`** (size `md`, overridden) | `<Button label={ctaLabel} variant="primary" size="md" fullWidth haptic={false} onPress={onConfirm} style={{ height:54, borderRadius:16, backgroundColor:'#16A35A', ...ctaShadow }} />`. Real Button sizes are 48/56/64 — none is 54, so `md` (56) + a `style` height override to 54 (prototype-exact). Button's press-scale is **0.97** (matches foundation). `haptic={false}` disables Button's built-in Light haptic; fire `haptics.impact()` (MEDIUM) inside `onConfirm`. If Hanken-800 label rendering is required and the Button's internal `Text` can't produce it, drop to a bespoke `Pressable` (see §2.6). |
| Confidence ring | **NEW** `ConfidenceRing` | Do NOT use `Badge` — Badge's fixed pill tones don't match the ring. |

**Token accessor (green/buy/amber).** These tokens are a **foundation prerequisite** — they do NOT exist in `@/constants/theme.ts` yet (verified against the repo). The foundation adds them (see Prerequisites + `00-foundation.md` [Colors](00-foundation.md#colors)). The foundation's Colors block does not fix whether they land on the `colors` export or a sibling; **whichever export the foundation chooses, reference them by name** — this spec writes them as `colors.greenMedium` etc. for concreteness, but the single source of truth is the foundation. Never inline the raw green/blue/amber hexes in this screen. Tokens used here: `greenMedium #16A35A`, `greenDarkest #0E3B2E`, `buyBlue #2563EB`, `warnAmber #E8A21A`.

Only the truly-un-tokened prototype hexes go into a small screen-local const (co-located with `GUTTER`):
```ts
// screen-local ONLY for hexes with no foundation token
const GUTTER = 22;                    // applied via inline style (no gap-22 Tailwind class); see §2 note
const M = {
  bg: '#F4F7F4', cardBorder: '#E7EDE8', ringTrack: '#E4EBE6',
  trustBg: '#EAF3EC', trustText: '#0E6B3F',
  title: '#10201A', body: '#445049', sub: '#8A988F',
  ctaCaption: '#90A096', back: '#5E6E66',
} as const;
// greens/blue/amber come from @/constants/theme tokens (added per foundation):
//   colors.greenMedium (#16A35A), colors.greenDarkest (#0E3B2E),
//   colors.buyBlue (#2563EB), colors.warnAmber (#E8A21A)
```
These screen-local hexes (`#E7EDE8`, `#EAF3EC`, `#0E6B3F`, etc.) are candidates to promote into `@/constants/theme` (NOT `@/theme/*`) once a second screen needs them; for this static screen the local const keeps the diff contained.

### New small components to create (under `src/features/lab/match/components/`)
1. **`ConfidenceRing.tsx`** — props `{ percentage: number; label?: string; size?: number }` (default `size=128`). SVG ring (track `Circle` + animated foreground arc `Circle`) + centered `%`/label text. Ring color derives from `percentage` (`>=95 → greenMedium`, `91–94 → warnAmber`). Reused later on the Matches feed at smaller size. Owns the stroke-dash reveal animation (§6). Accepts `reduceMotion` (or reads `useReducedMotion()` itself) to skip the sweep.
2. **`SideCard.tsx`** — props `{ eyebrow: string; accent: string; title: string; sub: string; price: string }`. Renders one WTS/WTB card; the only difference between the two is `accent` color + copy. `title` uses `numberOfLines={2}`.
3. **`WhyMatchedCard.tsx`** — props `{ reasons: string[] }`. Sparkle header + check-bullet list.
4. **`TrustChip.tsx`** — props `{ icon: React.ReactNode; label: string }`. Single chip; render two side-by-side in the screen.

Keep these dumb/presentational; the screen file (`app/(lab)/match/[id].tsx`) owns data + navigation.

**No new dependencies required.** Every visual is achievable with the foundation stack (`react-native-svg` for the ring + custom glyphs, `lucide-react-native` for check/shield, `reanimated` for motion, `Card`/`Button`/`Text`/`HStack` for structure). Do not add a gauge/ring/progress-ring package.

---

## 4. Interactivity & Navigation

Screen local state (this static version needs almost none — data is hardcoded):
```ts
const router = useRouter();
const { id } = useLocalSearchParams<{ id: string }>();
const match = MATCH_DETAIL_FIXTURE; // static; keyed by id later
const mode = useAppMode();           // Zustand 'sell' | 'buy' — only affects the "You" framing + CTA verb
const reduceMotion = useReducedMotion();

// derived, mode-aware copy (see §4 Mode variations + §5 fixture)
const youIsBuyer = mode === 'buy';
const wtbSub  = youIsBuyer ? `You · ${match.wtb.context}`   : `Buyer · ${match.wtb.context}`;
const wtsSub  = youIsBuyer ? `${match.wts.org} · ${match.wts.location}` : `You · ${match.wts.location}`;
const ctaLabel = youIsBuyer ? 'Confirm interest — talk to seller' : 'Confirm interest — talk to buyer';

const onBack = () => { haptics.tap(); router.canGoBack() ? router.back() : router.replace('/(lab)/matches'); };
const onConfirm = () => {
  haptics.impact();                                  // MEDIUM confirm thump (Button has haptic={false})
  router.push(`/(lab)/deal/${match.dealId}`);        // guard w/ toast if route not built (§4 table)
};
```

| Element | Gesture | Action | State/nav effect |
|---|---|---|---|
| Back "‹ Matches" | tap | `haptics.tap()` → `router.back()` (fallback `router.replace('/(lab)/matches')` if `!router.canGoBack()`) → `onBack` above | slide-down/back transition |
| WTS card | tap (optional) | future: open the listing detail `router.push('/(lab)/listing/${match.wts.id}')` | For static build: **non-interactive** (no `onPress`) to match prototype, which has no handler on the cards. Because they are non-tappable, no 44px tap-target constraint applies (see §7 note) |
| WTB card | tap (optional) | future: open the buyer request | Non-interactive in static build (no `onPress`) |
| Reason rows | none | static | — |
| Trust chips | none | static (future: tap → "How escrow works" `Sheet`) | Non-tappable in static build |
| **Confirm CTA** | tap | `onConfirm` above: `haptics.impact()` (MEDIUM) then `router.push('/(lab)/deal/${match.dealId}')` | Primary conversion; prototype `confirm()→go('deal')`. Guard: if the `/(lab)/deal` route is not built yet, `toast('Deal Room coming soon')` via `sonner-native` instead of navigating. |

**Mode (sell/buy) copy variations.** The prototype's `renderVals` sets `mode` globally but the Match Detail block is hardcoded to the HPLC example and does **not** branch on `sell`. Honor that: structure is identical in both modes. The only principled mode-sensitivity is the "You ·" attribution — **computed at render time** from `mode` (the fixture stores no `who`; see the `wtbSub`/`wtsSub`/`ctaLabel` derivations in the state block above and the fixture note in §5):
- `mode==='buy'` (default) → the WTB (right) card is "you" → its sub reads "**You** · pharma QC"; WTS sub is the counterparty "Asia Surplus · Singapore". Matches the prototype exactly.
- `mode==='sell'` → the WTS (left) card is "you" → sub becomes "**You** · Singapore"; WTB sub becomes the counterparty "**Buyer** · pharma QC".
- Accent colors, ring, CTA color: **unchanged** across modes (green). Do NOT tint the CTA `buyBlue` here — a confirmed match always proceeds to the same green Deal Room.
- CTA label: derive the trailing noun from `mode` — `buy` → "…talk to **seller**", `sell` → "…talk to **buyer**". Default (buy) matches the prototype string exactly.

---

## 5. Static Data Shape + Future Hook Points

Hardcode a fixture matching the prototype's `matches[0]` (line ~496) enriched with the detail-only fields (reasons, trust, budget delta) that appear only on this screen.

```ts
// src/features/lab/match/fixtures.ts
export interface MatchDetail {
  id: string;
  dealId: string;            // e.g. '4821' → Deal Room route
  confidence: number;        // 0–100 (ring); >=95 green, 91–94 amber (see tag)
  tag: 'new' | 'worth-a-look';
  wts: { id: string; title: string; org: string; location: string; priceLabel: string };
  wtb: { id: string; title: string; context: string; budgetLabel: string };  // NOTE: no `who` — the "You"/"Buyer" prefix is computed at render time from `mode` (see §4)
  reasons: string[];         // "Why AI matched you"
  trust: { verifiedSeller: boolean; escrow: boolean };
}

export const MATCH_DETAIL_FIXTURE: MatchDetail = {
  id: 'm-1',
  dealId: '4821',
  confidence: 96,
  tag: 'new',
  wts: {
    id: 'wts-agilent-1260',
    title: 'Agilent 1260 Infinity II HPLC',
    org: 'Asia Surplus',
    location: 'Singapore',
    priceLabel: '$13,400',
  },
  wtb: {
    id: 'wtb-hplc-dad',
    title: 'Agilent / Waters HPLC + DAD',
    context: 'pharma QC',                // sub prefix ("You ·" / "Buyer ·") derived from mode at render — NOT stored
    budgetLabel: 'up to $18,000',
  },
  reasons: [
    "Model & detector (DAD) match the buyer's exact spec.",
    "$13,400 sits 26% under the buyer's $18k budget.",
    'Singapore → ships APAC, both verified accounts.',
  ],
  trust: { verifiedSeller: true, escrow: true },
};
```

Derived UI values:
- **Ring accent** = `confidence >= 95 ? colors.greenMedium /* #16A35A */ : colors.warnAmber /* #E8A21A */` (amber for the "Worth a look" 91–94% tier per prototype `matches[2]`). Track always `M.ringTrack` (`#E4EBE6`).
- **WTS eyebrow** = `"FOR SALE · WTS"` green (`colors.greenMedium`); **WTB eyebrow** = `"WANTED · WTB"` blue (`colors.buyBlue`).
- **Card subs** = mode-derived (`wtbSub` / `wtsSub` from the §4 state block) — the fixture stores no `who`.
- **CTA label** = mode-derived (`ctaLabel` from the §4 state block).
- Trust chips render conditionally on the booleans (`trust.verifiedSeller`, `trust.escrow`).

**Future dynamic hook points** (foundation Phase 2 — wire later, no code now):
- Replace the fixture import with `const { data: match, isLoading, isError } = useMatchDetail(id)` — a TanStack Query hook (`useQuery({ queryKey:['match', id], queryFn: () => api.getMatch(id) })`). Add a loading skeleton (ring shimmer via `PULSE` + two gray cards) and use `EmptyState` (foundation UI) for `404 / not found`.
- CTA `onConfirm` becomes a `useMutation` (`confirmInterest(matchId)`) that creates/returns a `dealId`, then `router.push('/(lab)/deal/${dealId}')`. Show `Button loading` while pending; `toast` on error.
- `mode` from the app Zustand store (per RN stack: Zustand + React Query + MMKV).
- "Why matched" reasons + budget delta come from the AI match engine (smart-detect / matcher service) — shape already anticipated as `string[]`.

---

## 6. Animations & Micro-interactions (foundation recipes)

Uses the named foundation recipes from `@/animations/recipes.ts` (**RISE**, **POP**) plus the screen-local **confidence-ring arc reveal**. Screen transition per foundation matrix: `matches → match` = **RISE (bottom-up modal)**, 350ms, spring 0.75; `match → deal` = slide-right + fade, 350ms, cubic out.

- **Screen entrance:** presented as a bottom-up modal — **RISE** (foundation recipe = fade + slide-up 10px, 350ms, spring 0.75 damping), or set Expo Router `presentation:'modal'` on this route for the native slide-up. **No entrance haptic** — foundation rule: never haptic on passive transitions (fade-in, scroll, entrance). Haptics fire only on the back tap and the CTA tap.
- **Confidence ring:**
  - Inner circle: **POP** (foundation recipe, spring 1.2 damping, 300ms) delay `50ms`.
  - "96%" + "AI MATCH": `FadeIn` delay `100ms`.
  - **Arc draw reveal (signature moment):** a real driven animated value, NOT a static ternary. Own a `useSharedValue(0)` `progress` that animates `0 → 1`, and derive the SVG `strokeDashoffset` via `useAnimatedProps`. On mount:
    ```tsx
    const C = 2 * Math.PI * 56;                         // circumference (r=56)
    const progress = useSharedValue(0);                 // 0 = empty, 1 = full arc
    useEffect(() => {
      if (reduceMotion) { progress.value = 1; return; } // static fallback: arc at final % instantly
      progress.value = withDelay(150,
        withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }));
    }, [reduceMotion]);
    const arcProps = useAnimatedProps(() => ({
      // offset goes full circumference (hidden) → C*(1 - pct/100) (revealed arc)
      strokeDashoffset: C - C * (percentage / 100) * progress.value,
    }));
    // <AnimatedCircle strokeDasharray={C} animatedProps={arcProps} ... />
    ```
    Worklet-driven (no JS-thread per-frame calc → 60fps). Matches foundation "Confidence ring" recipe (r=56, strokeWidth 6, `greenMedium`, 1200ms out-cubic).
- **Side cards:** left **POP** delay `200ms`, right **POP** delay `280ms`.
- **Why-matched:** title `FadeIn` delay `350ms`; each reason **POP** staggered `80ms` (foundation POP stagger) starting `~400ms` (delay `400 + i*80`).
- **Trust chips:** **POP** stagger `100ms`, delay `~600ms`.
- **CTA:** **POP** delay `750ms`.

**Micro-interactions**
- CTA press: `Button` applies press-in scale `1→0.97` over `motion.tap` (100ms), springs/times back to `1` (foundation "Button press" — the real scale is **0.97**, not 0.95). The haptic: Button is passed **`haptic={false}`** (disabling its built-in Light), and `onConfirm` calls **`haptics.impact()`** (MEDIUM = confirm match). There is no `haptic="medium"` prop.
- Back link press: opacity dip `1→0.6` (`Pressable` `({ pressed })`) + **`haptics.tap()`** (foundation: back/selection = `tap`, the light/selection feel). If a custom press-scale is added it must be **0.97** to match Button.
- Never haptic on passive entrance fades/staggers (foundation rule) — only the CTA `impact()` and back `tap()`.

**Reduced motion** (`useReducedMotion()`, foundation reduced-motion spec):
- All **POP/RISE** → `FadeIn.duration(200)` (opacity only, no scale/translate).
- Ring arc draw → **skip the sweep**: set `progress.value = 1` immediately so the arc renders at its final `percentage` with no timing (see the `useEffect` guard in the ring recipe above).
- **Staggers:** all delays → 0, but each element still fades in with `FadeIn.duration(200)` (so reasons/cards/chips appear together yet not jarringly — they are NOT rendered with a hard opacity flip). No sequential stagger.
- Press scale (0.97) → no scale; keep at `1`.

---

## 7. Native Screen-Management (foundation per-screen block)

```
Safe area:   [x] top edge  [x] bottom inset  [x] no Dynamic Island overlap
Keyboard:    [x] N/A — no text inputs on this screen
Responsive:  [x] flex widths  [x] SE + Pro Max tested  [x] no fixed-width containers
Scroll/CTA:  [x] content scrolls  [x] CTA outside scroll  [x] paddingBottom spacer
Android/DM:  [x] nav inset  [x] opaque footer bg  [x] dark icons  [x] contrast ≥4.5:1
Polish:      [x] card radius ≥12px (18/16/13)  [x] 22px gutter documented  [x] colored CTA shadow
```

**Safe area**
- Because this screen needs (a) a page-bg override to `#F4F7F4` and (b) a sticky CTA **outside** the scroll, do NOT use the `Screen` wrapper's built-in scroll here — use a bare outer `View` (bg `#F4F7F4`) + an inner `ScrollView`, and apply the top inset manually via `useSafeAreaInsets().top` (add it to the ScrollView's top padding). The prototype's `60px` top padding is replaced by `insets.top` + the back-link `~14px` block, so content clears the Dynamic Island / notch. (This is the layout shown below; it matches the §3 reuse-table decision.)
- Bottom: the sticky CTA footer adds `useSafeAreaInsets().bottom` padding so the button + caption sit above the home indicator / Android gesture pill: `paddingBottom: insets.bottom + 8`.

**Scroll vs. fixed CTA** (long content + a conversion CTA — foundation scenario D, sticky-CTA pattern)
- Ring + cards + reasons + trust live in a `ScrollView`.
- CTA + caption render **outside** the scroll as an absolute/sticky bottom `View` (do not let the CTA float into overflowed content). The scroll's bottom padding is **computed at render**, not hardcoded — it must clear the footer's total height:
```tsx
const insets = useSafeAreaInsets();
const CTA_H = 54, CAPTION_H = 28, FOOTER_PAD_TOP = 18, SPACER = 16;
const footerH = FOOTER_PAD_TOP + CTA_H + CAPTION_H + insets.bottom + 8; // matches the footer View's real height
const scrollPadBottom = footerH + SPACER;                               // ensures content never hides behind the footer

<View style={{ flex:1, backgroundColor:'#F4F7F4' }}>
  <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: scrollPadBottom }}>
    {/* back…ring…cards…reasons…trust */}
  </ScrollView>
  <View style={{ position:'absolute', left:0, right:0, bottom:0,
                 paddingHorizontal: GUTTER, paddingTop: FOOTER_PAD_TOP,
                 paddingBottom: insets.bottom + 8, backgroundColor:'#F4F7F4' }}>
    {/* CTA (haptic={false}, onPress=onConfirm) + caption */}
  </View>
</View>
```
- `scrollPadBottom` is derived from the footer's actual height (≈ CTA 54 + caption 28 + top pad 18 + `insets.bottom` + 8 + a 16 spacer) so nothing hides behind the footer on any device (SE 375 → Pro Max 430).

**Keyboard:** N/A — no text inputs on this screen (foundation scenario B not applicable).

**Small vs. large device (SE 375 → Pro Max 430)**
- Side cards use `flex:1` + `gap:10` — no fixed widths; they compress on SE (375px) and expand on Pro Max (430px).
- Ring is fixed `128px` (intentional, per prototype); comfortably centered on the narrowest device.
- Card titles use `numberOfLines={2}` with absolute `lineHeight:17` (≈1.15 × 15) so long equipment names wrap without breaking the two-column height parity (`alignItems:'stretch'` keeps both cards equal height).
- Verify at 375px: the two eyebrows ("FOR SALE · WTS" / "WANTED · WTB") don't truncate mid-word (10px caps fit at 375; if font scaling per foundation scenario C is enabled for width<400, keep eyebrows at fixed size).
- **Touch targets:** the WTS/WTB cards, reason rows, and trust chips are **non-tappable** in this static build (no `onPress`), so the 44px min-tap-target rule does not apply to them. The only tap targets are the back link (wrap to ≥44px tall) and the CTA (54px ≥ 44). When cards become tappable in Phase 2, ensure the card height ≥44px on SE (title 2 lines + sub + price already clears this).

**Android nav bar / dark mode**
- Sticky footer respects `insets.bottom` (covers 3-button + gesture-pill); footer bg is opaque `#F4F7F4`.
- Contrast: white CTA text on `#16A35A` at 16px bold clears WCAG AA for large/bold text; trust `#0E6B3F` on `#EAF3EC` clears AA for its 11.5px bold; body `#445049` on `#fff` clears AA.
- Dark mode: **v2** — light-only for now (foundation stance). Do not add dark tokens.

---

## 8. Acceptance Checklist (pass/fail)

**Visual parity (side-by-side vs. prototype lines 312–382)**
- [ ] Page background is `#F4F7F4`; 22px horizontal gutter on every section.
- [ ] Confidence ring is `128×128`, ~9px-thick, green arc fills exactly **96%**, starts at 12 o'clock, track `#E4EBE6`, center reads "96%" (Hanken 800 / `fonts.headingBold`, `fontSize:34` / `lineHeight:34`, `#0E3B2E`) with "AI MATCH" (`fontSize:9.5`, 700, `letterSpacing:1.14`, `#16A35A`).
- [ ] Two side cards: white, `1px #E7EDE8` border, `18px` radius, `14px` padding, equal height; eyebrows green `#16A35A` (WTS) / blue `#2563EB` (WTB); titles Hanken 800 15px `#10201A`; subs 12px `#8A988F`; prices Hanken 800 18px.
- [ ] "Why AI matched you" card shows the custom 4-point sparkle (green, NOT lucide Sparkles) + title + **exactly the 3 reason strings**, each with a green `Check`, `12.5px #445049`.
- [ ] Two trust chips (`#EAF3EC` bg, `13px` radius) read "Verified seller" and "101LAB escrow" in `#0E6B3F` 11.5px bold with shield-check + vault icons.
- [ ] CTA: full-width, `height:54`, `borderRadius:16`, `#16A35A`, white Hanken-800 (`fonts.headingBold`) `fontSize:16` label "Confirm interest — talk to seller" (buy mode), green glow shadow; caption below in `#90A096` `fontSize:11.5`.

**Prerequisites (foundation) present before build**
- [ ] `(lab)` route group + `src/features/lab/` exist; this screen is `app/(lab)/match/[id].tsx`.
- [ ] `HankenGrotesk_800ExtraBold` loaded in `app/_layout.tsx` and exposed as `fonts.headingBold` (headlines depend on it).
- [ ] Green/buy/amber tokens (`greenMedium`, `greenDarkest`, `buyBlue`, `warnAmber`) added to `@/constants/theme.ts` per foundation.
- [ ] `src/animations/recipes.ts` exports `RISE`, `POP` with reduced-motion fallbacks.

**Library reuse**
- [ ] No new npm dependency added; ring + custom glyphs use `react-native-svg`, icons use `lucide-react-native`, structure uses `Card`/`Button`/`Text`/`HStack`.
- [ ] Tokens imported from `@/constants/theme` (NOT legacy `@/theme/*`); `greenMedium`/`greenDarkest`/`buyBlue`/`warnAmber` referenced by name, only un-tokened prototype hexes (`M` const) are screen-local.
- [ ] Haptics imported from `@/lib/haptics` (never `expo-haptics` directly); back = `haptics.tap()`, CTA = `haptics.impact()` with Button `haptic={false}`.

**Interactivity**
- [ ] Back link fires `haptics.tap()` (light/selection) and returns to the Matches feed (`router.back()` or `replace('/(lab)/matches')`).
- [ ] CTA fires `haptics.impact()` (MEDIUM, Button `haptic={false}`) and navigates toward the Deal Room (`/(lab)/deal/4821` or guarded `toast`).
- [ ] Screen renders from the static `MATCH_DETAIL_FIXTURE` with **no network calls**.
- [ ] `sell` vs `buy` mode only changes the render-computed "You ·" attribution (and the CTA "…talk to buyer/seller" verb); structure/colors/accents unchanged. Fixture stores no `who`.

**Animation**
- [ ] Entrance runs RISE → ring-draw → POP stagger; ring arc sweeps to 96% over ~1.2s (out-cubic) via a driven `useSharedValue` `progress` + `useAnimatedProps` (60fps, no JS-thread per-frame calc — NOT a static ternary).
- [ ] Button press scale is **0.97** (matches foundation); any custom Pressable uses 0.97 too.
- [ ] With Reduced Motion on: `progress.value = 1` (arc at final 96%, no sweep), no staggers (delays → 0), opacity-only `FadeIn(200)` fades.

**Native**
- [ ] CTA stays sticky above the footer and clears the home indicator / Android gesture bar on iPhone 14 Pro, iPhone SE, Pixel 7.
- [ ] No horizontal overflow at 375px; content never hides behind the sticky CTA (scroll paddingBottom sufficient).
- [ ] Confidence ring renders crisply via `react-native-svg` (no pixelation, correct 96% arc starting at 12 o'clock).

---

### Files this spec produces
- `app/(lab)/match/[id].tsx` — the route (composition + data + nav + sticky CTA).
- `src/features/lab/match/components/ConfidenceRing.tsx`
- `src/features/lab/match/components/SideCard.tsx`
- `src/features/lab/match/components/WhyMatchedCard.tsx`
- `src/features/lab/match/components/TrustChip.tsx`
- `src/features/lab/match/fixtures.ts` — `MATCH_DETAIL_FIXTURE`.

### Foundation prerequisites this screen consumes (owned by `00-foundation.md`, NOT produced here)
- `(lab)` route group + `src/features/lab/` scaffold.
- `HankenGrotesk_800ExtraBold` in `app/_layout.tsx` `useFonts` + `fonts.headingBold` in `src/theme/typography.ts` (re-exported via `@/constants/theme`) — required for every Hanken-800 headline on this screen.
- Green/buy/amber tokens (`greenMedium`, `greenDarkest`, `buyBlue`, `warnAmber`) in `@/constants/theme.ts`.
- `src/animations/recipes.ts` (`RISE`, `POP` + reduced-motion fallbacks).
