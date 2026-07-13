# Screen Spec — Home / Tell-AI (101LAB by GreenBidz)

**Route:** `app/(lab)/home.tsx` (new AI-first flow stack, sibling to the existing `(tabs)`)
**Status:** Static / hardcoded data. No live APIs. Fully interactive: mode toggle, composer typing, send/chip → navigate to Processing.
**HTML source of truth:** `c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp/101LAB Mobile.dc.html` lines 46–128 (markup) + 469–599 (state/copy logic).
**Foundation:** `00-foundation.md` — this spec assumes its tokens, recipes, native checklist, and reuse map. **Read the foundation first.**

**Import reality (verified against the repo):** `@/constants/theme` has **no aggregate `theme` object** — it exports **named** consts (`brand`, `colors`, `radius`, `spacing`, `motion`, `elevation`, `typography`, `fonts`). Import what you use by name: `import { brand, radius, spacing, motion, elevation, fonts, greenDarkest, greenDark, greenMedium, greenLight, buyBlue, lab } from '@/constants/theme'`. Everywhere below, a token written as `greenDark`, `lab.bg`, `radius.lg`, etc. is that **named import** — there is no `theme.` prefix. `fonts` is re-exported by `@/constants/theme` from `src/theme/typography.ts`, so import `fonts` from `@/constants/theme`.

---

## 0. Prerequisites (foundation setup)

These are owned **once** by `00-foundation.md` (see its [Prerequisites](00-foundation.md) section) — they are set up there, not re-implemented in this file. This screen does not build until the following are in place. Treat each as "add per foundation," never "already present."

- [ ] **Fonts** — `HankenGrotesk_800ExtraBold` added to the `useFonts({...})` load list in `app/_layout.tsx` (imported from `@expo-google-fonts/hanken-grotesk`) **and** exposed as `fonts.headingBold` in `src/theme/typography.ts`. **Verified NOT yet loaded** — `app/_layout.tsx` currently imports only `HankenGrotesk_600SemiBold` + `HankenGrotesk_700Bold`, and `src/theme/typography.ts` has no `headingBold` key. Used here for the H1 and the `101LAB` wordmark. (`fonts.heading` = Hanken 700 for chip titles is already loaded.)
- [ ] **Green / buy color tokens** — `greenDarkest #0E3B2E`, `greenDark #16794A`, `greenMedium #16A35A`, `greenLight #34D08C`, `buyBlue #2563EB` added to `@/constants/theme.ts` as named exports. **Verified NOT yet in the repo** (the file has `brand.*`, `colors.*`, but none of these). Foundation owns adding them.
- [ ] **`lab` neutral-token sub-object** — added to `@/constants/theme.ts` (see §3 for the exact object). Holds the prototype-only light neutrals so this screen references tokens, not raw hexes. Owned by the foundation's color-token prerequisite.
- [ ] **`(lab)` route group** — `app/(lab)/` exists with `_layout.tsx` (stack, `home → processing = RISE` per foundation transition matrix) so `router.push('/(lab)/home')` resolves. **Verified NOT yet present** (only `(auth)` + `(tabs)` groups exist).
- [ ] **`src/features/lab/`** — feature folder exists for this screen's components/data/store (see §3, §5). **Verified NOT yet present.**
- [ ] **`src/animations/recipes.ts`** — exports `RISE`, `POP`, `PULSE`, `SPIN`, `SLIDE-X` + `useReducedMotion`-aware fallbacks. Used here for SLIDE-X (toggle), POP (chips), RISE (exit).
- [ ] **`haptics` + `Button` already exist** — do NOT re-create. `import { haptics } from '@/lib/haptics'` (verbs: `tap/impact/heavy/success/warning/error` — there is **no** `light()`/`medium()`). `Button` from `@/components/ui` (sizes `sm 48 / md 56 / lg 64`; press scale **0.97**; boolean `haptic` prop fires expo-haptics Light).

---

## 1. Purpose & Place in Flow

The AI-first landing screen. This is the top of the entire 8-state 101LAB state machine (`home → processing → draft → published → matches → match → deal`). Instead of forms/filters, the user tells the AI what they want to buy or sell in one composer, in one of two modes.

- **Entry points:**
  - App launch / bottom-nav "Home" tab (the persistent home; no entrance animation on tab return).
  - Back-to-home from any downstream screen (`goHome`, HTML line 591) — fade + RISE.
- **Exits / navigation targets:**
  - **Send CTA** (the composer's primary button only) → `router.push({ pathname:'/(lab)/processing', params:{ mode, input } })` (HTML `send: () => this.start()`, line 584). Note: the HTML also wires photo/attach to `send()` as a demo shortcut — the RN build does NOT (see "Does NOT navigate" below and §4).
  - **Quick-start chip A / B** → set composer text to the demo string, then → Processing (HTML `demo(text)`, lines 484–486, 585–586).
  - **"3 new matches" pill** (top-right) → `router.push('/(lab)/matches')` (HTML `navMatches`, line 594).
- **Does NOT navigate:** mode toggle (Sell/Buy), photo button, attach button, textarea focus/typing — these mutate local state only.

The 2600 ms spinner-then-draft timeout (HTML line 482) lives on the **Processing** screen, not here. Home's only job on send is to hand the composer text forward and navigate.

---

## 2. Visual Layout (top → bottom, measurements from HTML)

Screen background: `#F4F7F4` (prototype surface-light). The foundation's default `brand.background` is `#f8f9ff`, which differs — for 1:1 fidelity this screen uses the prototype surface. Expose it as a token: **add `lab.bg = '#F4F7F4'` to `@/constants/theme`** (see §3 `lab` object) and apply `style={{ backgroundColor: lab.bg }}` to `Screen`. Content-container padding from HTML line 48: `padding: 64px 22px 130px` → top `64` (folds into safe-area top inset — see §7), horizontal `22`, bottom `130` (spacer for the future bottom nav + send visibility). Use `Screen`'s built-in `scroll` (a `ScrollView` under the hood) — do **not** add a bare `ScrollView`.

### 2a. Header row (HTML 49–62) — `margin-bottom: 26px`
Flex row, `space-between`, `align-items: center` (reuse `HStack` with `justify="space-between" align="center"`).
- **Left — brand lockup** (`HStack gap={9} align="center"`):
  - Logo tile: `34×34`, `border-radius: 10px`, `background: #0E3B2E` (`greenDarkest`), centered. Inside: the `OrbitLogo` SVG mark — center dot `r=2.4` fill `#34D08C` (`greenLight`), 4 cross-lines stroke `#34D08C` width `1.5`, 4 outer node dots `r=1.7` fill `#34D08C`, top/bottom/left/right nodes `r=1.7`. Rendered `19×19`, `viewBox 0 0 24 24`.
  - Text block (tight leading — set each `Text`'s `lineHeight` equal to its `fontSize` so the two lines stack without extra gap):
    - `101LAB` — Hanken Grotesk **800** (`fonts.headingBold`), `fontSize: 16`, `lineHeight: 16`, color `#10201A` (`lab.ink`), `letterSpacing: -0.02 * 16 ≈ -0.32` (RN px, not `em`).
    - `BY GREENBIDZ` — inline style `fontSize: 8.5`, `lineHeight: 10`, `fontFamily: fonts.bold` (Inter 700 — see typography note), `letterSpacing: 0.14 * 8.5 ≈ 1.19`, color `#8A988F` (`lab.inkMeta`), `marginTop: 2`.
- **Right — "3 new matches" pill** (`Pressable` button, HTML 59–61). **Rendered only when `matchCount > 0`** (see §5 hook point) — return `null` when `0`. Because it sits in a `space-between` header row, hiding it lets the brand lockup keep its left position with no layout jump (the pill is the trailing child, not a flexed one).
  - `background: #EAF3EC` (`lab.pillBg`), color `#0E3B2E` (`greenDarkest`), **Inter 700** (see typography note) `12px`, `padding: 8px 13px`, `border-radius: 99px` (`radius.full`), `HStack gap={6} align="center"`.
  - Leading status dot: `7×7`, `border-radius: 99px`, `background: #16A35A` (`greenMedium`). The web `box-shadow: 0 0 0 3px rgba(22,163,90,.18)` soft ring is not a native concept at that size — render the dot inside a `13×13` wrapper `View` with `borderRadius: full` + `backgroundColor: 'rgba(22,163,90,0.18)'` (`lab`-adjacent; inline rgba is fine for this one wrapper) and center the solid dot inside it. This is a color-fill wrapper, not a real shadow, so it renders identically on iOS + Android.

### 2b. Hero headline + subcopy (HTML 64–65)
- **H1:** Hanken Grotesk **800** (`fonts.headingBold`), `38px`, **absolute `lineHeight: 39`** (the prototype's CSS `line-height: 1.02` × 38 ≈ 39; RN requires an absolute px value — do NOT pass the `1.02` multiplier), `letterSpacing: -0.035 × 38 ≈ -1.33` (RN `letterSpacing` is in px, not `em`), color `#10201A` (`lab.ink`), `marginBottom: 12`. On SE-width devices drop to `fontSize: 34 / lineHeight: 35` (§7-C). Two lines: `Tell us what you` / `want to ` + `buy or sell.` where **"buy or sell."** is colored `#0E3B2E` (`greenDarkest`) via a nested `<Text>` span. Preserve the hard line break with a literal `{'\n'}` (or two `Text` lines) — do not rely on wrapping.
- **Sub-paragraph:** `Text variant="bodySm"` (already 14/20) — the variant's `lineHeight: 20` matches, no override needed; color `#5E6E66` (`lab.inkSub` — differs slightly from `brand.textMuted #5b6b63`, use `lab.inkSub` for exact fidelity), `marginBottom: 22`, `maxWidth: 300`. Copy: `No forms. No filters. Snap a photo, drop a spec sheet, or just type — AI builds the listing and finds your match.`

### 2c. Mode toggle (HTML 67–77) — `margin-bottom: 14px`
Segmented control — **build directly (no new dep)** per foundation ("segmented control = Button variants + flex-row + state"). Container: flex row, `gap: 6px`, `background: #E7EDE8`, `padding: 5px`, `border-radius: 16px` (`radius.lg`), `position: relative`. Two `Pressable` halves, each `flex: 1`, `height: 42px`, `border-radius: 12px` (`radius.md`), **Inter 700** `13.5px`, flex-center, `gap: 7px`, with a 16×16 lucide stroke icon (`strokeWidth 2`).
- **Sliding thumb** (SLIDE-X, §6): an absolutely-positioned white `Animated.View`, width = half the track minus padding, `border-radius: 12px`. Shadow: RN has no CSS `box-shadow` — apply `elevation.md` (from `@/constants/theme`) for the base drop, tinted with `shadowColor: lab.toggleThumbShadow` (`rgba(14,59,46,.25)`) on iOS + `elevation: 3` on Android. It translates X between the two halves; the labels sit above it (`zIndex: 1`).
- **Active label** color = `accent` (Sell `#16794A` = `greenDark` / Buy `#2563EB` = `buyBlue`, HTML 490); **idle label** color = `#7C8A82` (`lab.inkChipSub`).
- **Sell** icon: lucide `Package`, label `I'm selling`.
- **Buy** icon: lucide `ShoppingCart`, label `I'm buying`.

### 2d. AI composer card (HTML 79–99)
- Container: `background: #fff` (`brand.surface`), `border: 1.5px solid {accentBorder}` where accentBorder = Sell `#BFE0CC` (`lab.sellBorder`) / Buy `#C3D5FA` (`lab.buyBorder`) (HTML 522), `border-radius: 24px` (`radius.2xl`), `padding: 16px 16px 13px`. Deep drop shadow — RN has no negative-spread `box-shadow`, so build it inline: `{ shadowColor: lab.composerShadow (rgba(14,59,46,.4)), shadowOffset: { width:0, height:18 }, shadowOpacity: 1, shadowRadius: 22 }` on iOS; `elevation: 8` on Android. (This is a deeper custom shadow than `elevation.lg`; do not substitute the token.)
- **Top row** (`HStack gap={10} align="flex-start"`):
  - `SparkleIcon` (react-native-svg) `20×20`, `marginTop: 2`, `flexShrink: 0`: two 4-point stars, fill `{accentColor}` (second star `opacity 0.6`). Recolors with mode. (Do **not** use lucide `Sparkles` — the prototype mark is a bespoke two-star glyph; a custom SVG matches 1:1. `Sparkles` is an acceptable fallback if fidelity is relaxed.)
  - **Composer input** (`flex: 1`): a `TextInput` with `multiline`, no border/outline, `fontFamily: fonts.regular` (**Inter**) `14.5px`, **absolute `lineHeight: 20`** (prototype CSS `1.4` × 14.5 ≈ 20; pass px, never the multiplier), color `#10201A` (`lab.ink`), `backgroundColor: 'transparent'`, `padding: 0`, `textAlignVertical: 'top'` (Android), sized to ~2 lines via `minHeight ≈ 40`. `placeholder` = mode copy (§4), `placeholderTextColor: '#90A096'` (`lab.inkFaint`).
- **Bottom action row** (`marginTop: 12`, `HStack justify="space-between" align="center"`):
  - **Left cluster** (`HStack gap={8}`): two square utility `Pressable`s. Visual box is `40×40` (radius 13, `border: 1.4px solid #E1E8E3` = `lab.utilBorder`, `background: #F6F8F6` = `lab.utilBg`, icon color `#34503F` = `lab.utilIcon`), but the **tap target must be ≥44px** (foundation `layout.minTouch: 48`): give each `Pressable` `hitSlop={6}` (extends the 40px box to a 52px touch area) so the compact prototype look is preserved without an accessibility regression. Do NOT ship a bare 40px target.
    - **Photo** button — lucide `Camera` (`size={19}`, `strokeWidth 1.8`). HTML wires it to `send` (line 87) as a prototype shortcut; the intended RN behavior is `onPhoto` → image picker (see §4), NOT navigate-on-tap.
    - **Attach** button — lucide `Paperclip` (`size={18}`, `strokeWidth 1.8`). HTML wires it to `send` (line 90) as a prototype shortcut; intended RN behavior is `onAttach` → document picker (see §4).
  - **Right — primary send CTA** (HTML 94–97), built as **`ComposerSendButton`** (new; see §3): `height: 44px` (meets the ≥44px min tap target), `paddingHorizontal: 20`, `border-radius: 14px`, no border, `background: {accentColor}`, color `#fff`, `fontFamily: fonts.bold` (**Inter 700**) `14px`, `HStack gap={8}`. Shadow (inline, no CSS `box-shadow`): `{ shadowColor: accentShadow, shadowOffset:{width:0,height:10}, shadowOpacity:1, shadowRadius:12 }` iOS + `elevation: 6` Android, where accentShadow = Sell `rgba(22,121,74,.55)` (`lab.sellShadow`) / Buy `rgba(37,99,235,.45)` (`lab.buyShadow`). Label = `sendLabel` (Sell `List it` / Buy `Find it`), then lucide `ArrowRight` (`size={17}`, `strokeWidth 2.2`).

### 2e. Trust caption (HTML 100–103) — `margin: 11px 4px 0`
`Text` `11.5px`, color `#90A096` (`lab.inkFaint`), `HStack gap={6} align="center"`. Leading lucide `CreditCard` at `size={16}` `strokeWidth 2` (lucide's card glyph has more geometry than the prototype's simplified rounded-rect; rendering it at 13px risks stroke artifacts — use `size={16}` and let the `gap` absorb the small size delta). Copy: `AI reads it, drafts everything, routes to the right marketplace.`

### 2f. Quick-start chips (HTML 105–126) — `margin-top: 24px`
- **Section label:** reuse **`SectionLabel`** primitive (`label="OR START FROM AN EXAMPLE"`) — its small-caps styling matches; override to `fontSize: 11`, weight **700**, `letterSpacing: 0.1 × 11 ≈ 1.1` (px, not `em`), color `#9AA89F` (`lab.inkLabel`), `marginBottom: 11` if the default tokens differ. Text = `chipsLabel` (same in both modes, HTML 535).
- **Chip list:** column, `gap: 9px`. Each chip is a **`QuickStartChip`** `Pressable`: `alignItems: 'center'`, `HStack gap={12}`, `background: #fff` (`brand.surface`), `border: 1px solid #E7EDE8` (`lab.hairline`), `border-radius: 16px` (`radius.lg`), `padding: 13px 15px` (row height ≈ 62px, comfortably ≥44px tap target).
  - **Icon tile:** `36×36`, `border-radius: 11px`, `background: {chipBg}` (Sell `#EAF6EE` = `lab.chipSellBg` / Buy `#EAF1FE` = `lab.chipBuyBg`), centered, `flexShrink: 0`; the emoji glyph is a `Text` at `fontSize: 18`.
  - **Text stack** (`flex: 1`, `minWidth: 0`):
    - Title — Hanken Grotesk **700** (`fonts.heading`, already loaded) `13.5px`, color `#10201A` (`lab.ink`).
    - Sub — `Text` `11.5px`, color `#7C8A82` (`lab.inkChipSub`), `marginTop: 1`, `numberOfLines={1}` (RN equivalent of `text-overflow: ellipsis`).
  - **Trailing chevron:** lucide `ChevronRight` (`size={16}`, `strokeWidth 2.2`, color `#B6C2BA` = `lab.chevron`).

### Color reference (prototype hex → token)
The foundation **owns adding** the green scale + buy accent as named tokens to `@/constants/theme` — they are a **PREREQUISITE, NOT yet in the repo** (verified: the file has `brand.*`/`colors.*` but no `greenDarkest`/`buyBlue`). Reference them by their named-import identifiers (`greenDarkest`, `greenDark`, …) once added; do **not** invent a parallel palette here. The remaining neutrals (`#F4F7F4`, `#E7EDE8`, `#E1E8E3`, `#F6F8F6`, `#8A988F`, etc.) are also new; group them under a `lab` named export on `@/constants/theme` (see §3) so this screen (and downstream lab screens) reference tokens, not literals.

| Prototype | Hex | Token (named import from `@/constants/theme`) |
|---|---|---|
| greenDarkest (logo/pill text/H1 accent) | `#0E3B2E` | **`greenDarkest`** (foundation prerequisite, L154) |
| sell accent | `#16794A` | **`greenDark`** (foundation prerequisite, L155) |
| buy accent | `#2563EB` | **`buyBlue`** (foundation prerequisite, L158) |
| green-medium (dot) | `#16A35A` | **`greenMedium`** (foundation prerequisite, L156; base `colors.success` is `#16A34A` ≈) |
| green-light (orbit nodes) | `#34D08C` | **`greenLight`** (foundation prerequisite, L157) |
| surface bg | `#F4F7F4` | **`lab.bg`** (new; differs from `brand.background`) |
| card white | `#fff` | `brand.surface` (exists) |
| text primary | `#10201A` | `lab.ink` (new; differs from `brand.foreground #121c28` — use `lab.ink` for headline fidelity) |
| text secondary | `#5E6E66` | `lab.inkSub` (new; `brand.textMuted #5b6b63` is close but not exact — use `lab.inkSub`) |
| chip border / toggle bg | `#E7EDE8` | `lab.hairline` (new) |

> **Decision (corrected — resolves the earlier "already defines" contradiction):** the greens/buy-blue are **NOT in the repo yet**; the foundation's Prerequisites section owns adding them as named exports (`greenDarkest`, `greenDark`, `greenMedium`, `greenLight`, `buyBlue`). This screen references them by name and treats them as "add per foundation." The light-neutral prototype hexes are collected in the `lab` named export (see §3). One color source, no duplication.

---

## 3. Component Breakdown (reuse map + new)

### Reuse existing primitives (`@/components/ui`)
| Primitive | Import | Use here |
|---|---|---|
| `Screen` | `@/components/ui` | Root wrapper. Props: `scroll`, `padded={false}` (we apply the exact `64/22/130` padding ourselves via `contentContainerStyle`), `keyboardAware`, `edges={['top']}`, `style={{ backgroundColor: lab.bg }}`. Set `keyboardShouldPersistTaps="handled"` on its scroll view (pass-through prop or wrap). |
| `Text` | `@/components/ui` | Sub-paragraph, trust caption, chip subs, pill label. `Text` variants map to `@/constants/theme` `typography` (**Inter** body). Headline/brand/chip-title strings that must be **Hanken 800/700** pass `style={{ fontFamily: fonts.headingBold }}` / `fonts.heading` inline (see typography note). |
| `HStack` / `Stack` | `@/components/ui` | All the flex rows/columns (header, brand lockup, composer action row, chip layout) — use `gap`, `align`, `justify` props instead of hand-rolled `flexDirection` styles. |
| `SectionLabel` | `@/components/ui` | The `OR START FROM AN EXAMPLE` small-caps label (§2f). |
| `AppImage` | `@/components/ui` | Not needed on Home (no remote images); reserve for chip photo previews later. |

> **Not used here:** `Button` (see note), `Card`, `Badge`, `Input`, `Field`, `Sheet`, `SelectButton`, `PickerSelect`, `EmptyState` — the composer/toggle/chips are visually bespoke and cheaper to build directly than to override primitive defaults. In particular `Button`'s fixed sizes (`sm h-12`=48 / `md h-14`=56 / `lg h-16`=64) don't match the `44px` (send CTA) / `42px` (toggle half) / `40px` (utility box) heights here, so the send CTA and utility buttons are custom `Pressable`s that **reuse the foundation Button-press recipe verbatim**: press-in `scale 1 → 0.97` over `motion.tap` (100ms) via Reanimated `withTiming`, spring/time back to `1` on release. **Scale is 0.97, matching `@/components/ui/Button` — NOT 0.95, and no opacity change** (Button does scale only). Haptics fire from `@/lib/haptics` on press (send = `haptics.impact()`; utility/chip/pill = `haptics.tap()`; toggle = `haptics.tap()`) — never call `expo-haptics` / `Haptics.selectionAsync()` directly in the screen.

### Theme tokens to import (`@/constants/theme` — all **named** imports; there is no `theme` object)
```ts
import {
  brand, spacing, radius, motion, elevation, typography, fonts,
  greenDarkest, greenDark, greenMedium, greenLight, buyBlue, lab,
} from '@/constants/theme';
```
- `fonts` includes the **new `headingBold` = HankenGrotesk_800ExtraBold** (defined in `src/theme/typography.ts`, re-exported by `@/constants/theme`) — see typography note; a **foundation prerequisite** (§0).
- `greenDarkest / greenDark / greenMedium / greenLight / buyBlue` are **foundation prerequisites** (not yet in the repo — §0).
- **`lab` sub-object** (a new named export) added to `@/constants/theme.ts` for the prototype-only light neutrals (keeps literals out of components):
```ts
export const lab = {
  bg: '#F4F7F4',
  ink: '#10201A', inkSub: '#5E6E66', inkMeta: '#8A988F', inkFaint: '#90A096', inkChipSub: '#7C8A82', inkLabel: '#9AA89F',
  hairline: '#E7EDE8',         // toggle track + chip border
  utilBorder: '#E1E8E3', utilBg: '#F6F8F6', utilIcon: '#34503F',
  pillBg: '#EAF3EC', chevron: '#B6C2BA',
  sellBorder: '#BFE0CC', buyBorder: '#C3D5FA',
  chipSellBg: '#EAF6EE', chipBuyBg: '#EAF1FE',
  sellShadow: 'rgba(22,121,74,.55)', buyShadow: 'rgba(37,99,235,.45)',
  toggleThumbShadow: 'rgba(14,59,46,.25)', composerShadow: 'rgba(14,59,46,.4)',
} as const;
// greenDarkest/greenDark/greenMedium/greenLight/buyBlue come from the foundation color tokens — NOT redefined here.
```

### Typography note (foundation-critical)
- **Body/label font is Inter, NOT Plus Jakarta Sans.** The prototype HTML uses `Plus Jakarta Sans` for the composer textarea, send label, and pill (a documented system simplification, foundation L122) — the **authoritative RN decision is Inter**: `fonts.regular` (Inter 400) for composer input, `fonts.bold` (Inter 700) for the pill label / toggle labels / send label / small captions. Do **not** load Plus Jakarta. This intentionally diverges from the HTML prototype; the HTML is a web reference only.
- **Display/heading font is Hanken Grotesk 800** for the H1 and `101LAB` wordmark, and **Hanken 700** (`fonts.heading`, already loaded) for chip titles. `HankenGrotesk_800ExtraBold` is a **foundation prerequisite (§0)** — added to the `app/_layout.tsx` `useFonts` list + exposed as `fonts.headingBold` in `src/theme/typography.ts` (verified: app currently loads only Hanken 600/700). Do not gate the H1 render on this beyond the standard splash `fontsLoaded` guard already in `_layout.tsx`.
- **`BY GREENBIDZ` byline (8.5px)** — there is no 8.5px size token in `typography`, so apply an inline style: `{ fontSize: 8.5, letterSpacing: 0.14 * 8.5, fontFamily: fonts.bold }` (`letterSpacing` in px, not `em`). Uses Inter 700 (`fonts.bold`) for legibility at 8.5px — the prototype's weight-600 is fine to bump to 700 at this size. This is an intentional one-off inline style, not a missing token.

### New small components to create (under `src/features/lab/components/`)
1. **`LabHeader`** — brand lockup + `OrbitLogo` + "3 new matches" pill. Props: `matchCount: number`, `onPressMatches: () => void`. Pill hidden when `matchCount === 0`.
2. **`ModeToggle`** — sell/buy segmented control with SLIDE-X sliding thumb + `haptics.tap()` on switch. Props: `mode: LabMode`, `onChange: (m: LabMode) => void`. (Foundation SLIDE-X recipe.)
3. **`AiComposer`** — white composer card: `SparkleIcon`, multiline `TextInput`, photo/attach utility buttons, `ComposerSendButton`. Props: `mode`, `value`, `onChangeText`, `onSend`, `onPhoto`, `onAttach`. Recolors border/accent/shadow/sparkle/CTA by mode.
4. **`ComposerSendButton`** — the accent send pill (44px / radius 14 / mode-colored + arrow). Props: `label`, `accentColor`, `accentShadow`, `onPress`. Reuses the foundation Button-press recipe.
5. **`QuickStartChip`** — icon tile + title/sub + chevron. Props: `icon` (emoji), `iconBg`, `title`, `sub`, `onPress`.
6. **`OrbitLogo`** — the SVG orbit/atom mark (react-native-svg), reused across the flow.
7. **`SparkleIcon`** — the two-star SVG (react-native-svg), `accent`-tinted.

**Icons:** `react-native-svg` (foundation stack) for the bespoke `OrbitLogo` + `SparkleIcon`; `lucide-react-native` (foundation stack) for standard glyphs — `Package` (sell), `ShoppingCart` (buy), `Camera` (photo), `Paperclip` (attach), `ArrowRight` (send), `ChevronRight` (chip), `CreditCard` (trust caption). **All libs are already installed — no new deps.**

---

## 4. Interactivity & Navigation

**Local screen state** — per RN stack prefs (foundation stack: Zustand for cross-screen UI state). Because the composer `mode` + `input` must be forwarded to Processing (and later to the SSE mutation), keep them in a small Zustand store `useLabComposer` (`src/features/lab/store/composer.ts`); a local `useState` is acceptable for the static build but Zustand is preferred so Processing/Draft can read the same values without prop-drilling through route params only.
```
mode: 'sell' | 'buy'   // default 'sell'
input: string          // composer text, default ''
setMode(m); setInput(t); reset();
```

All haptics go through `import { haptics } from '@/lib/haptics'`. The **only** verbs are `tap / impact / heavy / success / warning / error` — there is **no** `haptics.light()` / `haptics.medium()`, and screens **never** import `expo-haptics` directly. `haptics.tap()` = light/selection feel; `haptics.impact()` = MEDIUM thump.

| Element | Gesture | Action | State/nav effect |
|---|---|---|---|
| "3 new matches" pill | tap | `onPressMatches` | `router.push('/(lab)/matches')`. `haptics.tap()`. |
| Sell tab | tap | `setMode('sell')` | mode='sell'; SLIDE-X thumb; recolors accent→`greenDark` `#16794A`; `haptics.tap()`. |
| Buy tab | tap | `setMode('buy')` | mode='buy'; accent→`buyBlue` `#2563EB`; `haptics.tap()`. |
| Composer input | focus/type | `onChangeText` | updates `input`. On focus, keep the action row above the keyboard (§7-B). No haptic. |
| Photo button | tap | `onPhoto` | **RN (dynamic):** `ImagePicker.launchImageLibraryAsync` (or `launchCameraAsync`); store URIs in `useLabComposer`, do NOT navigate. **Static build:** set `input` to a placeholder (e.g. `Photo attached`) and stay on Home (do NOT auto-navigate — the HTML `send` wiring is a prototype shortcut, not the intended flow). `haptics.tap()`. |
| Attach button | tap | `onAttach` | **RN (dynamic):** `DocumentPicker.getDocumentAsync`; store URI, do NOT navigate. **Static build:** same as photo (set placeholder, stay). `haptics.tap()`. |
| Send CTA | tap | `onSend` | Navigate even when `input` is empty (matches HTML `start()` — intentional; validation, if ever needed, lives on Processing, not here). `router.push({ pathname:'/(lab)/processing', params:{ mode, input } })`. `haptics.impact()` (MEDIUM). |
| Quick-start chip A | tap | `demoA` | Set `input` to the mode-specific demo string, then navigate to Processing with `{ mode, input }`. `haptics.tap()`. |
| Quick-start chip B | tap | `demoB` | Same as A with chip-B demo string. `haptics.tap()`. |

> **Haptic mapping (foundation-verified):** mode toggle / chips / utility / pill / back = `haptics.tap()` (light/selection); send = `haptics.impact()` (MEDIUM). Never haptic on passive transitions (focus, scroll, fade).
> **Photo/Attach vs HTML:** the prototype wires both utility buttons to `send()` (immediate navigate) as a demo shortcut. The RN intent is: photo/attach only capture an attachment and mutate local state; **navigation happens on explicit Send only.** Do not carry the HTML shortcut into the RN build.

### Mode-driven copy & color (single source; HTML lines 490–586)
| Key | Sell | Buy |
|---|---|---|
| `accentColor` | `#16794A` (`greenDark`) | `#2563EB` (`buyBlue`) |
| `accentBorder` | `#BFE0CC` | `#C3D5FA` |
| `accentShadow` | `rgba(22,121,74,.55)` | `rgba(37,99,235,.45)` |
| toggle icon | `Package` | `ShoppingCart` |
| `composerPlaceholder` | `e.g. Selling a Thermo −80°C freezer, working, in Bangkok…` | `e.g. Need an Agilent 1260 HPLC with DAD, budget $18k…` |
| `sendLabel` | `List it` | `Find it` |
| `chipsLabel` | `OR START FROM AN EXAMPLE` | `OR START FROM AN EXAMPLE` |
| `chipBg` | `#EAF6EE` | `#EAF1FE` |
| Chip A icon / title / sub | 📷 · `Snap a photo of your equipment` · `AI reads the label & writes the listing` | 🔬 · `Agilent or Waters HPLC + DAD` · `pharma QC · budget up to $18,000` |
| Chip B icon / title / sub | 📄 · `Upload a spec sheet or invoice (PDF)` · `Bulk-draft a whole batch at once` | ❄️ · `−80°C ultra-low freezer, upright` · `qty 1 · grant-funded · Bangkok` |
| Chip A demo string (sets `input`) | `Photo: Thermo −80°C freezer, working, Bangkok` | `Agilent or Waters HPLC + DAD, pharma QC, budget $18k` |
| Chip B demo string | `Spec sheet PDF: lab equipment batch` | `−80°C ultra-low freezer, upright, qty 1, Bangkok` |

---

## 5. Static Data Shape & Future Hook Points

### Hardcoded now (place in `src/features/lab/data/home.ts`)
```ts
export type LabMode = 'sell' | 'buy';

export const LAB_HOME = {
  matchCount: 3,                        // header pill "3 new matches"
  chipsLabel: 'OR START FROM AN EXAMPLE',
  modeCopy: {
    sell: {
      accent: '#16794A', accentBorder: '#BFE0CC', accentShadow: 'rgba(22,121,74,.55)',
      placeholder: 'e.g. Selling a Thermo −80°C freezer, working, in Bangkok…',
      sendLabel: 'List it', chipBg: '#EAF6EE',
      chips: [
        { id:'a', icon:'📷', title:'Snap a photo of your equipment', sub:'AI reads the label & writes the listing', demo:'Photo: Thermo −80°C freezer, working, Bangkok' },
        { id:'b', icon:'📄', title:'Upload a spec sheet or invoice (PDF)', sub:'Bulk-draft a whole batch at once', demo:'Spec sheet PDF: lab equipment batch' },
      ],
    },
    buy: {
      accent: '#2563EB', accentBorder: '#C3D5FA', accentShadow: 'rgba(37,99,235,.45)',
      placeholder: 'e.g. Need an Agilent 1260 HPLC with DAD, budget $18k…',
      sendLabel: 'Find it', chipBg: '#EAF1FE',
      chips: [
        { id:'a', icon:'🔬', title:'Agilent or Waters HPLC + DAD', sub:'pharma QC · budget up to $18,000', demo:'Agilent or Waters HPLC + DAD, pharma QC, budget $18k' },
        { id:'b', icon:'❄️', title:'−80°C ultra-low freezer, upright', sub:'qty 1 · grant-funded · Bangkok', demo:'−80°C ultra-low freezer, upright, qty 1, Bangkok' },
      ],
    },
  },
} as const;
```
> The accent hexes above intentionally mirror the `greenDark` / `buyBlue` named tokens; **prefer the tokens for color** and keep this object for **copy + demo strings only** (avoid a second color source). `LabMode` (`'sell' | 'buy'`) is the shared type used by the store, components, and this data object.

### Future dynamic hook points (leave TODO comments; no wiring yet)
- **`matchCount`** → `useQuery({ queryKey: ['lab','matchCount'], queryFn: fetchNewMatchCount })` (TanStack React Query v5 object form, foundation stack). Pill unmounts when `0` (LabHeader renders `null`).
- **Chips** → mode-specific starter examples could come from a `/lab/starters?mode=` personalization endpoint; keep the static array as fallback.
- **Send/chip submit** → today just navigates. Later: `useMutation` POSTing `{ mode, text, attachments }` to the smart-detect **SSE** endpoint (`react-native-sse`, foundation stack); Processing subscribes to the stream. Home only forwards `{ mode, input }`.
- **Composer attachments** → wire `expo-image-picker` / `expo-document-picker` (both in the foundation stack); store URIs in the `useLabComposer` store to forward to Processing.

---

## 6. Animations & Micro-interactions (foundation recipes)

Home is a persistent screen — **no entrance choreography on tab return**. First app-launch may RISE the hero in (fade + 10px slide-up, 350ms) if desired; on tab return, none.

- **Mode toggle → SLIDE-X** (recipe, foundation): animate the white thumb's `translateX` between the two 42px-tall halves via `useSharedValue` + `useAnimatedStyle`, `motion.medium` (280ms), `Easing.bezier(0.4,0,0.2,1)` (Material decel; if on-device timing skews vs. the prototype, fall back to `Easing.out(Easing.cubic)` and record the choice in `src/animations/recipes.ts`). On toggle: `haptics.tap()`. The CTA/border/sparkle accent color cross-fades with `withTiming(accent, { duration: motion.medium })` driven by a `useSharedValue` progress `0↔1` + `interpolateColor(progress, [0,1], [sellHex, buyHex])` on the UI thread (color only, cheap).
- **Send CTA + utility buttons + chips + pill → press recipe** (matches `@/components/ui/Button`): press-in `scale 1 → 0.97` over `motion.tap` (100ms) via `withTiming`, time/spring back to `1` on release. **0.97, scale only — no opacity change.** Send = `haptics.impact()` (MEDIUM); utility / chip / pill / toggle = `haptics.tap()`.
- **Quick-start chips → POP** (recipe, foundation) with **80ms stagger** on **mount only** (`POP` recipe with `delay: index * 80`). On tap, the press-scale above. **When `mode` switches, do NOT re-POP** — the chip content cross-fades (opacity `0.6 → 1`, ~150ms) so visual weight stays on the toggle, not the chips. (Deliberate: re-POP on every toggle would over-animate.)
- **"3 new matches" dot → optional PULSE** on the ring glow (recipe, foundation), or static. A count change animates with a small POP. Pill unmounts entirely when `matchCount === 0` (§2a).
- **Exit to Processing → RISE** (screen-transition matrix, foundation: `home → processing = RISE`, 350ms, spring 0.75). Configure on the `(lab)` stack `_layout.tsx` (`animation: 'slide_from_bottom'` or a custom Reanimated transition). Processing owns the spinner.
- **Reduced motion** (`useReducedMotion()`, foundation): SLIDE-X → **thumb snaps instantly** (no translate); POP → `FadeIn(200)`; PULSE → static opacity 1; RISE → `FadeIn(200)`; press scale → stay at `1`. **The accent color cross-fade is KEPT even under reduced motion** — it is color-only (no motion), low-cost, and perceptually essential for mode clarity.

All continuous animations use `useSharedValue` + `useAnimatedStyle` (no JS-side calc in animated components) — 60 FPS locked, worklet-safe.

---

## 7. Native Screen-Management (foundation checklist, tailored)

**A. Safe area:** `Screen` wraps in `SafeAreaView edges={['top']}`. The prototype's flat `64px` top padding must fold into the top inset so the Dynamic Island / notch never overlaps the header — use `paddingTop: insets.top + 24` (via `useSafeAreaInsets()`), not a flat `64`. The `130px` bottom spacer accommodates the future bottom nav + home indicator; make it inset-aware: `paddingBottom: insets.bottom + 110` now, and when the bottom nav lands replace with `insets.bottom + navHeight + slack`.

**B. Keyboard:** the composer is the primary input. Set `keyboardAware` on `Screen` (root already wraps in `KeyboardProvider` via `react-native-keyboard-controller`, foundation stack). Keep content inside `Screen`'s `ScrollView` with `keyboardShouldPersistTaps="handled"` so tapping Send/chips while the keyboard is up registers on the **first** tap. For focus handling, rely on `react-native-keyboard-controller`'s built-in avoidance (pan/scroll the focused `TextInput` into view) — the composer's **action row (send + utility buttons)** then stays visible above the keyboard as a natural side-effect. On tall devices the composer may already sit above the keyboard, so scroll is conditional/automatic (no manual `scrollTo` needed); verify specifically on SE-height (375×667) that the send button is not covered.

**C. Small vs large device (SE 375 → Pro Max 430):** no fixed widths — composer/toggle/chips are `flex:1` / full-width within the `22px` horizontal padding. **H1 scale is a deterministic rule, not a suggestion:** `const width = useWindowDimensions().width; const h1 = width <= 375 ? { fontSize: 34, lineHeight: 35 } : { fontSize: 38, lineHeight: 39 };` — SE-class devices (≤375px) render the 34px headline (fully visible, no clip/truncation), everything else 38px. Allow the two hard-broken lines to sit as authored. Sub-paragraph `maxWidth: 300` left-aligns naturally.

**D. Scroll vs fixed CTA:** unlike downstream screens, Home's send CTA lives **inside** the composer card (not a sticky footer), so the whole page is one `ScrollView` — no separate sticky CTA needed. Ensure the inset-aware bottom padding (§7-A) keeps the last chip clear of the (future) bottom nav.

**E. Android nav bar + dark mode:** the bottom spacer adds `insets.bottom` so the last chip isn't hidden behind the gesture pill / 3-button bar. Contrast: pill text `#0E3B2E` on `#EAF3EC` (≈10:1) and white text on the accent CTA both pass AA. **Dark mode: out of scope (v1 light-only, foundation)** — surfaces stay `lab.bg` / `#fff`.

**Per-screen block:**
```
Safe area:   [x] top edge (insets.top+24)  [x] bottom inset (insets.bottom+110)  [x] no Dynamic Island overlap
Keyboard:    [x] input in ScrollView  [~] CTA inside composer (not sticky — by design)  [x] onFocus scroll to action row
Responsive:  [x] flex widths  [x] SE + Pro Max tested  [x] H1 optional scale <400px
Scroll/CTA:  [x] content scrolls  [~] CTA inside card (intentional)  [x] paddingBottom spacer inset-aware
Android/DM:  [x] nav inset  [x] opaque light surfaces  [x] dark text  [x] contrast ≥4.5:1
Polish:      [x] card radius ≥16px  [x] 4px spacing tokens  [x] shadow md/lg (+ custom deep composer shadow)
```

---

## 8. Acceptance Checklist (pass/fail)

**Prerequisites (from §0 — must be true before build)**
- [ ] `HankenGrotesk_800ExtraBold` loaded in `app/_layout.tsx` + exposed as `fonts.headingBold`; `greenDarkest/greenDark/greenMedium/greenLight/buyBlue` + the `lab` object are named exports of `@/constants/theme`; `app/(lab)/` + `src/features/lab/` + `src/animations/recipes.ts` exist.

**Visual fidelity**
- [ ] Screen bg is `#F4F7F4` (`lab.bg`); content padding `insets.top+24 / 22 / insets.bottom+110` (folds prototype `64/22/130` into insets).
- [ ] Header: 34px `#0E3B2E` (`greenDarkest`) logo tile with `OrbitLogo` SVG (mint `#34D08C` center + 4 cross-lines + 4 outer nodes); `101LAB` in **Hanken 800** (`fonts.headingBold`) 16px `#10201A` tracked ≈−0.32px; `BY GREENBIDZ` 8.5px (inline) `#8A988F` tracked ≈1.19px.
- [ ] "3 new matches" pill (only when `matchCount>0`): `#EAF3EC` bg, `#0E3B2E` **Inter 700** 12px, 7px `#16A35A` dot inside a `rgba(22,163,90,.18)` fill-ring wrapper.
- [ ] H1 **Hanken 800**: 38px/lineHeight 39 (or 34/35 on ≤375px), tracking ≈−1.33px absolute; "buy or sell." colored `#0E3B2E`; hard line break preserved.
- [ ] Sub-copy `bodySm` (14/20), color `#5E6E66` (`lab.inkSub`), maxWidth 300.
- [ ] Toggle: `#E7EDE8` track, 42px halves, white sliding thumb with `elevation.md` tinted `lab.toggleThumbShadow`, active label = accent, idle `#7C8A82`; lucide `Package`/`ShoppingCart`.
- [ ] Composer card: white, 1.5px accent border, radius 24, deep inline shadow (`lab.composerShadow`); `SparkleIcon` tinted accent; `TextInput` (Inter) placeholder = mode copy, placeholder color `#90A096`.
- [ ] Two utility buttons — 40px visual box (radius 13, `lab.utilBg`, `lab.utilBorder` border, `lab.utilIcon` icons) with `hitSlop` to ≥44px tap target = lucide `Camera` + `Paperclip`.
- [ ] Send CTA (`ComposerSendButton`): 44px, radius 14, accent bg, white **Inter 700** 14px label + `ArrowRight`, inline accent shadow; label `List it`/`Find it`.
- [ ] Trust caption 11.5px `#90A096` with leading lucide `CreditCard` (`size={16}`).
- [ ] Chips: white, radius 16, `#E7EDE8` border, 36px `chipBg` tile with 18px emoji, **Hanken 700** 13.5px title, 11.5px `#7C8A82` sub (`numberOfLines={1}`), lucide `ChevronRight` `#B6C2BA`; `SectionLabel` = `OR START FROM AN EXAMPLE`.
- [ ] Body/labels use **Inter** (NOT Plus Jakarta); no `expo-haptics` imported in the screen (only `@/lib/haptics`).

**Interactivity**
- [ ] Tapping Sell/Buy switches mode, slides the thumb (SLIDE-X 280ms), and recolors accent (border, sparkle, CTA, chip icon bg) + updates placeholder, send label, and both chips' icon/title/sub — all per §4 table; `haptics.tap()`.
- [ ] Typing updates the composer; text persists across a mode switch (state in `useLabComposer`).
- [ ] Send button navigates to Processing forwarding `{ mode, input }` (works even when empty); `haptics.impact()` (MEDIUM) fires.
- [ ] Each chip sets its mode-specific demo string then navigates to Processing; `haptics.tap()`.
- [ ] "3 new matches" pill navigates to the matches screen; `haptics.tap()`.
- [ ] Photo/attach buttons capture an attachment / set a placeholder and mutate local state WITHOUT navigating (navigation is Send-only); `haptics.tap()`; no crash.

**Motion & native**
- [ ] Chips POP-stagger on mount (80ms); no re-POP on mode switch (content cross-fades); all custom Pressables press-scale to **0.97** (matching Button); toggle/utility/chip/pill = `haptics.tap()`.
- [ ] With Reduced Motion on: thumb snaps (no slide), no press-scale, opacity-only; accent color cross-fade still runs; no jank.
- [ ] Keyboard: composer action row stays visible above the keyboard on SE-height screens; Send registers on first tap while keyboard is up.
- [ ] Safe areas respected on notch/Dynamic-Island and Android gesture-pill devices; last chip not clipped by (future) bottom nav.
- [ ] Renders correctly SE (375) → Pro Max (430) with no fixed-width overflow and no horizontal scroll.

**Data**
- [ ] All copy/colors sourced from `LAB_HOME` (copy/demo) + green/buy named tokens + `lab` neutrals — no scattered string literals; `matchCount` reads from the data object with a documented React Query TODO.
- [ ] No new dependencies introduced — every lib (react-native-svg, lucide, reanimated, haptics, keyboard-controller, zustand, react-query, image-picker, document-picker) is already in the foundation stack.
