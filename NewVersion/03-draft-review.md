# Draft Review Screen — Implementation Spec

**App:** 101LAB by GreenBridge (Expo Router RN, SDK 56 / RN 0.85 / React 19) · **Screen:** Draft Review · **Route:** `app/(lab)/draft.tsx` (in the customer-app `(lab)` route group — see foundation prerequisites; screen index lists it as `03-draft`) · **State:** static/hardcoded, fully interactive · **Source of truth:** `101LAB Mobile.dc.html` lines 159–228 (markup) + 469–599 (state/copy).

This screen is a 1:1 visual port of the prototype's `isDraft` block. It renders an AI-generated **listing** (sell mode) or **request** (buy mode) as a review card the user can Publish or Edit before it goes live.

---

## Prerequisites (foundation setup)

These are set up **once in [`00-foundation.md`](./00-foundation.md#prerequisites-foundation-setup)** — this screen depends on them but does NOT re-implement them. If any are missing, they are a foundation task, not per-file rework. This screen touches:

- [ ] **Fonts** — `HankenGrotesk_800ExtraBold` added to the `useFonts({...})` list in `app/_layout.tsx` (from `@expo-google-fonts/hanken-grotesk`) **and** exposed as `fonts.headingBold` in `src/theme/typography.ts`. Used here for the 26px headline, 24px price, 19px title, 15px demand title. **Not loaded yet** (only Hanken 600/700 are); until it lands, fall back to Hanken 700 (`fonts.heading`) and note the deviation. Body/label text stays **Inter** (the prototype's Plus Jakarta Sans is a documented simplification — do NOT add it).
- [ ] **Color tokens** — the green/buy tokens this screen references (`greenDarkest #0E3B2E`, `greenDark #16794A`, `greenMedium #16A35A`, `buyBlue #2563EB`, `buyBlueSurface #EEF3FE`) are **added per foundation** to `@/constants/theme.ts`. They do **NOT** exist in the repo yet — treat every reference below as "add per foundation," never "already present." (`brand.*` tokens like `brand.background`, `brand.surface`, `brand.divider`, `brand.textMuted` DO already exist.)
- [ ] **`(lab)` route group** — this screen (`draft`) lives in the `app/(lab)/` group (customer-app fork), gated by user type so seller/scanner routes are untouched.
- [ ] **`src/features/lab/`** — the mock VM (`getDraftVM`, `SPECS_*`) and the screen's local color/shadow maps live under this feature folder (co-located with the screen; see §5).
- [ ] **`src/animations/recipes.ts`** — the named recipes (`RISE`, `POP`) plus `useReducedMotion()`-aware fallbacks used in §6 are created here.

> **Haptics & Button already exist** — import `haptics` from `@/lib/haptics` and `Button` from `@/components/ui`. This spec conforms to their real, verified contracts (see §3/§6); it never asks you to modify those shared modules.

---

## 1. Purpose & Place in Flow

**Purpose:** Show the AI-drafted listing/request extracted from the user's photo/text so they can confirm before publishing. It is the "trust gate" between the AI extraction and going live.

**State machine position** (from foundation): `home → processing (2.6s) → **draft** → published → matches → match → deal`.

This screen lives in the `(lab)` route group (per foundation): `app/(lab)/draft.tsx`. All route paths below are group-relative (`/(lab)/...`).

**Entry points**
- From **Processing** screen via the auto-advance timer (`setTimeout(... 'draft', 2600)` in prototype `start()`). In RN this is either a route push after the processing animation completes, or a state flip within a shared flow store. Per foundation, the 2.6s is a static placeholder; in dynamic mode it is tied to the real AI/streaming response. `mode` is forwarded as a route param.
- Deep-link/back navigation returning to a previously generated draft (future).

**Exits / navigation targets**
- **Back** (top-left) → Home. Prototype `goHome: () => this.go('home','home')`. In Expo Router: `router.replace('/(lab)')` (Home is the `(lab)` group index) — resets the flow. `haptics.tap()` on press.
- **Publish listing / Post request** (primary CTA) → Published screen. Prototype `publish: () => this.go('published')`. Expo Router: `router.push({ pathname: '/(lab)/published', params: { mode } })`. `haptics.impact()` (MEDIUM) on press.
- **Edit details** (secondary) → v1 fires `haptics.tap()` + `toast('Editing coming soon')` via `sonner-native` (chosen v1 behavior — the button is live, not disabled). Phase 2: `router.push('/(lab)/draft/edit')` (editable form route). See §4.

**Mode carried in:** `mode: 'sell' | 'buy'` flows from Home through Processing into Draft. It controls copy + accent color throughout (see §4).

**Screen transition (foundation matrix):** `processing → draft` uses **RISE exit + enter** (350ms, spring 0.75). `draft → published` uses **RISE + scale 0.97→1** (400ms, spring 1.2). Set the `/(lab)/published` route's Expo Router screen option `animation: 'slide_from_bottom'` and let the Published screen own the scale entrance.

---

## 2. Visual Layout (top → bottom, exact values from HTML)

Screen background: `theme.brand.background` `#f8f9ff` (Screen default `bg-bg`). Prototype outer container padding `60px 0 130px` — the top 60px maps to the safe-area top inset (+ the Back row's own padding); the bottom 130px is scroll breathing room under the sticky CTA. Content max content width = phone width; horizontal gutter **22px** on all blocks (this is a per-screen value, not a spacing token — define `GUTTER = 22` locally).

### 2a. Header row (gutter 22px)
- **Back button:** transparent, no border. Chevron-left SVG (`m15 18-6-6 6-6`, `17×17`, stroke-width `2.2`) + label "Back". Text: `#5E6E66`, `13px`, weight `600`, gap `5px`, vertical padding `6px 0`. Tappable. Use `lucide-react-native` `ChevronLeft` (size 17, color `#5E6E66`, strokeWidth 2.2).

### 2b. "AI drafted" pill (margin `8px 0 14px`)
- Inline-flex pill. Background `#EAF3EC`, text color `#0E6B3F`, weight `700`, size `11.5px`, padding `6px 12px`, radius `99px` (full), gap `7px`.
- Left glyph: 4-point sparkle/star SVG (`14×14`) filled `#16A35A` (= `theme.greenMedium`, prerequisite token). **Fidelity note:** lucide `Sparkles` renders a large 4-point star *plus two small stars* (not a clean single 4-point). For an exact match to the prototype's single 4-point sparkle, use a `react-native-svg` `Path` (`fill="#16A35A"`, no stroke): `d="M7 0 L8.6 5.4 L14 7 L8.6 8.6 L7 14 L5.4 8.6 L0 7 L5.4 5.4 Z"`. lucide `Sparkles` is an acceptable fallback if the 3-star cluster is tolerable, but the single 4-point `Path` is preferred.
- Copy: **"AI drafted this for you"** (static, both modes).

### 2c. Headline + subcopy (gutter 22px)
- **Headline** `{{ draftHeadline }}`: Hanken Grotesk weight `800` (see font caveat §3), `26px`, line-height `1.08` (≈28px), color `#10201A`, letter-spacing `-0.02em` (≈`-0.52`), margin-bottom `6px`.
  - sell: "Your listing is ready to publish."
  - buy: "Your request is ready to post."
- **Subcopy** (static, both modes): `13px`, color `#6B7A72`, margin-bottom `18px` — "Tap any field to edit. Everything below was extracted automatically."

### 2d. Listing card (margin `0 22px`)
Container: background `#fff` (`theme.brand.surface`), border `1px solid #E7EDE8`, radius `22px`, `overflow:hidden`, custom shadow (not `theme.elevation.*`). **RN shadow style** (CSS `0 16px 40px -26px rgba(14,59,46,.45)` has a spread/negative-inset that RN can't express — approximate): `{ shadowColor:'#0E3B2E', shadowOffset:{ width:0, height:16 }, shadowOpacity:0.28, shadowRadius:26, elevation:8 }`. Note `overflow:'hidden'` clips iOS shadows — put the shadow on an outer wrapper `View` and `overflow:'hidden'` on the inner card, OR drop `overflow:hidden` on the shadowed node and clip the hero image separately. Define this shadow in the local `DRAFT_SHADOWS` map (see §3).

- **Gradient hero** (`height:150px`): `linear-gradient(135deg, {{draftImgFrom}}, {{draftImgTo}})`, centered glyph.
  - sell gradient: `#1f6b4a → #0E3B2E`; buy gradient: `#3b6fd4 → #1c3f8f`.
  - Center glyph: equipment SVG in a `62×62` box, `viewBox="0 0 24 24"`, stroke `#fff` width `1.2`, `strokeLinecap="round"` + `strokeLinejoin="round"` (crisp on all DPIs), group opacity `0.55`, no fill. Components (`react-native-svg`): `Rect x=5 y=3 width=14 height=18 rx=2`, `Line x1=5 y1=8 x2=19 y2=8`, `Circle cx=9 cy=13 r=1`. Do not substitute a lucide icon (shape differs). Build as a small reusable `<EquipmentGlyph size={62} />` component so it can be reused wherever the placeholder appears.
  - **Badge cluster** absolute `top:12px left:12px`, gap `6px`:
    - **Market badge** `{{draftMarket}}` = "101LAB": bg `rgba(255,255,255,.92)`, color `{{marketColor}}` = `#0E3B2E` (= `theme.greenDarkest`), weight `800`, `10px`, letter-spacing `.04em`, padding `5px 9px`, radius `7px`.
    - **Source badge** `{{draftSource}}`: bg `rgba(16,32,26,.55)` + `backdrop-filter:blur(4px)`, color `#fff`, weight `700`, `10px`, padding `5px 9px`, radius `7px`, gap `4px`, with a check-glyph (`M20 6 9 17l-5-5`, `11×11`, stroke-width `2.4`; lucide `Check` size 11 white). sell: "from your photo"; buy: "from your text". **Note:** RN has no `backdrop-filter` blur — approximate with a solid `rgba(16,32,26,0.72)` fill (see §7). Do **not** pull in a blur dependency; foundation explicitly says blur = Linear Gradient / solid fallback.
- **Card body** (padding `16px 17px 18px`):
  - **Title** `{{draftTitle}}`: Hanken `800`, `19px`, line-height `1.15` (≈22px), color `#10201A`, letter-spacing `-0.01em` (≈`-0.19`).
    - sell: "Thermo Scientific TSX −80°C Freezer"; buy: "−80°C Ultra-Low Freezer (upright)".
  - **Location row** (margin-top `7px`, gap `8px`): map-pin SVG (`14×14`, stroke `currentColor` `#7C8A82` width `2`; lucide `MapPin` size 14), text `{{draftLocation}}` color `#7C8A82` `12.5px`.
    - sell: "Bangkok, Thailand · ready to ship"; buy: "Deliver to Bangkok · 101LAB network".
  - **Specs table** (margin-top `15px`, `border-top:1px solid #EEF2EF` = `theme.brand.divider` neighbor, padding-top `14px`, column gap `11px`): each row is space-between: key left (`12.5px`, `#7C8A82`), value right (`12.5px`, weight `700`, `#10201A`, right-aligned). 4 rows (see §5).
  - **Price block** (margin-top `16px`, radius `14px`, padding `13px 15px`, space-between):
    - bg `{{priceBg}}` — sell `#F0F8F3`, buy `#EEF3FE` (= `theme.buyBlueSurface`).
    - Left: label `{{priceLabel}}` (`11px`, weight `700`, letter-spacing `.05em`, color `{{priceLabelColor}}` — sell `#16794A` = `theme.greenDark`, buy `#2563EB` = `theme.buyBlue`) + value `{{draftPrice}}` (Hanken `800`, `24px`, `#10201A`, margin-top `1px`).
      - sell: "SUGGESTED PRICE" / "$4,200"; buy: "YOUR BUDGET" / "up to $5,000".
    - Right: `{{priceHint}}` right-aligned, `11px`, `#7C8A82`, line-height `1.35`, max-width `120px`.
      - sell: "Based on 12 recent comparable sales"; buy: "We'll only surface sellers under this".

### 2e. Demand callout (margin `14px 22px 0`)
- Container: bg `{{demandBg}}`, border `1px solid {{demandBorder}}`, radius `18px`, padding `15px 16px`, gap `13px`, items centered.
  - sell: bg `#F0F8F3`, border `#CDE8D8`; buy: bg `#EEF3FE`, border `#CFE0FB`.
- **Icon tile** `42×42`, radius `13px`, bg `{{accentColor}}` (sell `#16794A` = `theme.greenDark`, buy `#2563EB` = `theme.buyBlue`), centered users-group SVG (`22×22`, stroke `#fff` width `2`; lucide `Users` size 22 white).
- **Text** (flex 1): title `{{demandTitle}}` (Hanken `800`, `15px`, `#10201A`) + sub `{{demandSub}}` (`12px`, `#5E6E66` = `theme.brand.textMuted` neighbor, margin-top `2px`).
  - sell: "3 buyers already want this" / "You'll match the moment you publish".
  - buy: "4 sellers can supply this" / "You'll match the moment you post".

### 2f. Action buttons (padding `18px 22px 0`, column, gap `10px`) — rendered in the sticky footer (see §7)
- **Primary** `{{publishLabel}}`: height `54px`, radius `16px`, bg `{{accentColor}}`, text `#fff` Hanken `800` `16px`, shadow `0 14px 26px -12px {{accentShadow}}` (sell `rgba(22,121,74,.55)`, buy `rgba(37,99,235,.45)`).
  - sell: "Publish listing"; buy: "Post request".
  - **Height note:** 54px sits between `Button` size `sm` (h-12 = 48px) and `md` (h-14 = 56px). Use `<Button>` and override `style={{ height: 54 }}` — do not force a raw `md` (56px) or the CTA reads too tall vs. the prototype.
- **Secondary** "Edit details" (static both modes): height `48px` (= `Button` size `sm` / `h-12`), border `1.4px solid #DDE5DF`, radius `16px`, bg `#fff`, text `#34503F` weight `700` `14px`.

---

## 3. Component Breakdown (reuse map)

**Imports (corrected to foundation):** UI primitives from `@/components/ui`; tokens from **`@/constants/theme`** (semantic roles — `import { theme } from '@/constants/theme'`). Do **not** import from `@/theme/*` — foundation marks that as legacy Stitch hex for old screens. Icons from `lucide-react-native`. Fonts are referenced via `theme.typography` / the font-family names registered in `app/_layout.tsx` (there is no `@/theme/typography` in the go-forward path).

| Prototype element | Reuse | Notes |
|---|---|---|
| Root screen | `Screen` (`@/components/ui`) with `scroll={false} padded={false} edges={['top']} keyboardAware={false}` wrapping an explicit `ScrollView` + a sibling footer `View` (see §7 skeleton) | `padded={false}` because the prototype gutter is 22px (not the 16px default) — apply `paddingHorizontal: GUTTER` (22) per-block. `scroll={false}` so the CTA footer can be a **sibling** of the ScrollView, not inside it (sticky CTA — see §7). `edges={['top']}` is already the `Screen` default. |
| Back button | Inline `Pressable` + `ChevronLeft` (lucide, size 17, color `#5E6E66`, strokeWidth 2.2) + `Text` | Not `Button` (that's a filled CTA). No new component needed. |
| "AI drafted" pill | Styled `View`+`Text`+`Sparkles`(lucide, 14, `#16A35A`) | `Badge` component's `ai` variant is **amber** — do **not** use it; the prototype pill is green (`#EAF3EC`/`#0E6B3F`). Build inline. |
| Headline / subcopy | `Text` with `style` override | `Text` variants top out at `title` 24/30 and `hero` 32/38 — neither is the 26/28 Hanken 800 headline. Pass `style={{ fontFamily: fonts.headingBold, fontSize:26, lineHeight:28, letterSpacing:-0.52, color:'#10201A' }}` (`fonts.headingBold` = the prerequisite Hanken 800; fall back to `fonts.heading`/700 until it lands). **`lineHeight` is absolute px (28), never a multiplier** — RN requires it. Subcopy = `Text variant="bodySm"` + color override `#6B7A72`. |
| Listing card | Plain `View` with inline style (or `Card` with heavy `style` override) | `Card variant="elevated"` **won't match** (radius 24 vs 22, and the custom `#0E3B2E` shadow + `#E7EDE8` border differ from `theme.elevation.md`). Simplest: plain styled `View`. |
| Gradient hero | `expo-linear-gradient` `LinearGradient` `colors={[from,to]}`, `start={{x:0,y:0}} end={{x:1,y:1}}` (135°) | Already in stack (`expo-linear-gradient ~56.0.4`). |
| Hero glyph | `react-native-svg` (`Svg`,`Rect`,`Line`,`Circle`) | Custom rect+line+circle → match exactly; do not swap for lucide. `react-native-svg 15.15.4` installed. |
| Pin / users / check / chevron / sparkle icons | `lucide-react-native` (`MapPin`, `Users`, `Check`, `ChevronLeft`, `Sparkles`) | `lucide-react-native ^1.16.0` installed. |
| Market/source badges | 2 small styled `View`s (`HStack` from `@/components/ui`) | Source badge blur → solid fallback fill. No new component. |
| Specs table | `data.map(...)` → space-between `HStack` per row | Simple; no new component. |
| Price block | Inline styled `View` (`HStack`) | No new component. |
| Demand callout | Plain styled `View` (`HStack`) + icon tile `View` + lucide `Users` | No new component. |
| Primary CTA | `Button size="sm"` + `style` override: `{ backgroundColor: accent, height:54, borderRadius:16, ...customShadow }`; `label={publishLabel}`; **`haptic={false}`** (fire `haptics.impact()` manually in `onPress`, see §6) | `Button` base is `bg-primary-500` + `rounded-2xl`(24) → the `style` override wins for bg/radius/height (style is applied last in the `AnimatedPressable` `style` array). 54px is between `sm` 48 and `md` 56 — start from `sm` and force `height:54` via `style` (no 44/54px size exists). Label color: `Button variant="primary"` already renders inverse (white) text ✓. |
| Secondary CTA | `Button variant="secondary" size="sm"` + `style`: `{ borderWidth:1.4, borderColor:'#DDE5DF', backgroundColor:'#fff', borderRadius:16 }` | **`Button` exposes no `borderWidth` prop** — the border must come from the `style` override (applied on top of the variant class). `size="sm"` gives the 48px height. Text color: the `secondary` variant renders `tone="primary"` (dark) — to hit the exact `#34503F` you'd need a color override, which `Button`'s label `Text` does not accept via prop; accept the variant's near-match dark text, OR build a bespoke `Pressable`+`Text` for pixel-exact `#34503F`. Prototype uses "Plus Jakarta Sans" here → per foundation, **map to Inter** (weight 700) as the documented system simplification. |

**Tokens that already exist (`@/constants/theme`, verified in repo):** `theme.brand.background` (#f8f9ff), `theme.brand.surface` (#fff), `theme.brand.divider` (#eef2f9), `theme.brand.textMuted` (#5b6b63), `theme.spacing`, `theme.radius`, `theme.motion`, `theme.typography`. Import them: `import { brand, spacing, radius, motion, typography } from '@/constants/theme'`.

**Prototype-derived green/buy tokens — ADDED PER FOUNDATION (prerequisite, NOT yet in the repo):** `greenDarkest #0E3B2E`, `greenDark #16794A`, `greenMedium #16A35A`, `buyBlue #2563EB`, `buyBlueSurface #EEF3FE`. These do **not** exist in `@/constants/theme.ts` today — the foundation owns adding them (see [Prerequisites](#prerequisites-foundation-setup) and `00-foundation.md`). Reference them by name (e.g. `theme.greenDark`) and treat them as "add per foundation," never "already present." Do not re-hardcode the hexes once the tokens land.

**Prototype-only colors NOT yet in tokens** (define a local `DRAFT_COLORS` map in `src/features/lab/draft/`, co-located with the screen — these are one-off prototype greys, not app-wide tokens): `#10201A` (near-black heading — darker than `brand.foreground` #121c28), `#5E6E66`/`#6B7A72`/`#7C8A82` (text greys), `#E7EDE8` (card border), `#EEF2EF` (spec divider), `#EAF3EC`/`#0E6B3F` (AI pill), `#F0F8F3` (sell tint), `#CDE8D8`/`#CFE0FB` (demand borders), `#DDE5DF` (secondary border), `#34503F` (secondary text), `#1f6b4a`/`#0E3B2E`/`#3b6fd4`/`#1c3f8f` (gradient stops), `rgba(22,121,74,.55)`/`rgba(37,99,235,.45)` (CTA shadow colors).

**Local shadow map** `DRAFT_SHADOWS` (also co-located; RN shadow objects, since these are custom and not in `theme.elevation`):
```ts
export const DRAFT_SHADOWS = {
  card: { shadowColor: '#0E3B2E', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.28, shadowRadius: 26, elevation: 8 },
  // accentShadow is 'rgba(22,121,74,.55)' (sell) or 'rgba(37,99,235,.45)' (buy) from the VM
  cta: (accentShadow: string) => ({ shadowColor: accentShadow, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 1, shadowRadius: 26, elevation: 10 }),
};
```

**Font caveat (prerequisite — see [Prerequisites](#prerequisites-foundation-setup)):** prototype headlines/titles/price use Hanken **800**, but `app/_layout.tsx` currently loads only `HankenGrotesk_600SemiBold` + `HankenGrotesk_700Bold` (verified). Foundation directs: **add `HankenGrotesk_800ExtraBold` to the `useFonts({...})` list in `app/_layout.tsx` and expose it as `fonts.headingBold` in `src/theme/typography.ts`**, then reference `fonts.headingBold` for the 26px headline, 24px price, 19px title, 15px demand title. Until it lands, fall back to `fonts.heading` (Hanken 700) — visually close; document as a known deviation. Body/label text = **Inter** (`fonts.regular`/`fonts.semibold`/`fonts.bold` — verified names in `src/theme/typography.ts`; there is no `fonts.body`); the prototype's "Plus Jakarta Sans" is deliberately mapped to Inter per foundation — do NOT add Plus Jakarta Sans.

**Zero new dependencies.** Everything above is already in the stack: `expo-linear-gradient`, `react-native-svg`, `lucide-react-native`, `react-native-reanimated` (v4), `expo-haptics`, `sonner-native`, `@/components/ui`, `@/constants/theme`.

---

## 4. Interactivity & Navigation

State the screen owns:
```ts
const { mode: modeParam } = useLocalSearchParams<{ mode?: 'sell' | 'buy' }>();
const [mode] = useState<'sell' | 'buy'>(modeParam ?? 'sell'); // carried from flow; read-only here
```
`mode` drives every copy + color swap below. No local mutation of the draft in v1 (static).

**Tappable elements**

| Element | Action | Haptic (`@/lib/haptics`) |
|---|---|---|
| Back | `router.replace('/(lab)')` → Home (resets flow) | `haptics.tap()` |
| Primary CTA (Publish/Post) | `router.push({ pathname: '/(lab)/published', params: { mode } })` | **`haptics.impact()`** (MEDIUM — primary action) + `Button haptic={false}` |
| Edit details | v1: `toast('Editing coming soon')` via `sonner-native` (chosen v1 behavior — see note below). Future: `router.push('/(lab)/draft/edit')` (editable form route). | `haptics.tap()` |
| Spec rows | Prototype copy says "Tap any field to edit" but rows have **no** handlers in the HTML. v1: **non-interactive** to match markup; the "tap to edit" affordance is satisfied by the Edit button (which in v1 toasts "coming soon"). Future: rows become editable fields on the Edit route. | — |

**Edit-details resolution (v1, no ambiguity):** the button IS tappable and IS wired — it fires `haptics.tap()` then `toast('Editing coming soon')`. It is **not** disabled and **not** a dead route. This keeps the "Tap any field to edit" promise honest without shipping an editor in Phase 1; Phase 2 swaps the toast for `router.push('/(lab)/draft/edit')`. Do not mark the button as non-interactive.

**Mode-driven values (single source, from prototype `renderVals`)** — build a `getDraftVM(mode)` helper (see §5) returning the full VM. Static across modes: `draftMarket` "101LAB", `marketColor` `#0E3B2E` (`theme.greenDarkest`), subcopy, "AI drafted this for you", "Edit details", center glyph.

**Accessibility (mode-sensitive):**
- Headline: `accessibilityRole="header"`.
- Primary CTA: `accessibilityRole="button"`, `accessibilityLabel={mode === 'sell' ? 'Publish listing' : 'Post request'}` (the `Button` already sets `accessibilityRole="button"` + `accessibilityLabel={label}`, so passing the mode label satisfies this automatically). Add `accessibilityHint="Publishes and starts matching"` (sell) / `"Posts your request and starts matching"` (buy).
- Back (bespoke `Pressable`): `accessibilityRole="button"`, `accessibilityLabel="Back to home"`.
- Edit `Button`: `accessibilityHint="Editing coming soon"` in v1.
- Demand callout: expose as a single node — `accessibilityLabel={demandTitle + '. ' + demandSub}` on the container, `importantForAccessibility="no-hide-descendants"` on the inner Texts so it reads once.
- AI pill + source badge: decorative context — give the pill `accessibilityLabel="AI drafted this for you"`; the equipment hero glyph and check glyph are `accessibilityElementsHidden`/`importantForAccessibility="no"`.

---

## 5. Static Data Shape + Future Hook Points

Hardcode a view-model built from `mode`. Values verbatim from HTML lines 501–571. **File location:** put `getDraftVM`, `SPECS_SELL`, `SPECS_BUY`, and the `DraftVM` type in `src/features/lab/draft/mocks.ts` (co-located with the screen under the `lab` feature folder — see Prerequisites); the screen imports `getDraftVM` from there. In Phase 2 this same file exports the query hook + mapper so the swap is a single import change.

```ts
type Spec = { k: string; v: string };

const SPECS_SELL: Spec[] = [
  { k: 'Condition', v: 'Working · Good' },
  { k: 'Year',      v: '2018' },
  { k: 'Capacity',  v: '−86°C · 728 L' },
  { k: 'Category',  v: 'Cold storage' },
];
const SPECS_BUY: Spec[] = [
  { k: 'Quantity',  v: '1 unit' },
  { k: 'Type',      v: 'Upright, −80°C' },
  { k: 'Use case',  v: 'Sample biobank' },
  { k: 'Timeline',  v: 'Within 30 days' },
];

type DraftVM = {
  headline: string; source: string;
  imgFrom: string; imgTo: string;
  title: string; location: string;
  specs: Spec[];
  priceBg: string; priceLabel: string; priceLabelColor: string;
  price: string; priceHint: string;
  demandBg: string; demandBorder: string; demandTitle: string; demandSub: string;
  publishLabel: string;
  accent: string; accentShadow: string; accentBorder: string;
};

function getDraftVM(mode: 'sell' | 'buy'): DraftVM {
  const sell = mode === 'sell';
  return {
    headline:  sell ? 'Your listing is ready to publish.' : 'Your request is ready to post.',
    source:    sell ? 'from your photo' : 'from your text',
    imgFrom:   sell ? '#1f6b4a' : '#3b6fd4',
    imgTo:     sell ? '#0E3B2E' : '#1c3f8f',
    title:     sell ? 'Thermo Scientific TSX −80°C Freezer' : '−80°C Ultra-Low Freezer (upright)',
    location:  sell ? 'Bangkok, Thailand · ready to ship' : 'Deliver to Bangkok · 101LAB network',
    specs:     sell ? SPECS_SELL : SPECS_BUY,
    priceBg:   sell ? '#F0F8F3' : '#EEF3FE',
    priceLabel: sell ? 'SUGGESTED PRICE' : 'YOUR BUDGET',
    priceLabelColor: sell ? '#16794A' : '#2563EB',
    price:     sell ? '$4,200' : 'up to $5,000',
    priceHint: sell ? 'Based on 12 recent comparable sales' : "We'll only surface sellers under this",
    demandBg:  sell ? '#F0F8F3' : '#EEF3FE',
    demandBorder: sell ? '#CDE8D8' : '#CFE0FB',
    demandTitle:  sell ? '3 buyers already want this' : '4 sellers can supply this',
    demandSub:    sell ? "You'll match the moment you publish" : "You'll match the moment you post",
    publishLabel: sell ? 'Publish listing' : 'Post request',
    accent:       sell ? '#16794A' : '#2563EB',     // theme.greenDark / theme.buyBlue
    accentShadow: sell ? 'rgba(22,121,74,0.55)' : 'rgba(37,99,235,0.45)',
    accentBorder: sell ? '#BFE0CC' : '#C3D5FA',
  };
}
```
Constant, mode-independent: `market = '101LAB'`, `marketColor = '#0E3B2E'` (`theme.greenDarkest`). Demand title, card title, headline, and price value all render in the Hanken 800 font family (`fonts.headingBold`) — the prerequisite font token (fall back to `fonts.heading` / Hanken 700 until 800 lands; see Prerequisites).

**Future dynamic hook points** (Phase 2 per foundation "Static-First, Then Dynamic")
- Replace `getDraftVM` static call with `useQuery(['draft', draftId])` from `@tanstack/react-query`; the returned draft object maps to the same `DraftVM` shape via a mapper (mirrors the smart-detect `result` JSON used elsewhere). Streaming draft can arrive via `react-native-sse` and be reduced into the same VM.
- Hero image: swap gradient placeholder for `AppImage` (`@/components/ui`, wraps `expo-image`) when a real photo URL exists (`draft.imageUrl`); keep the gradient as the fallback background.
- Publish becomes a `useMutation` → POST create listing/want; on success navigate to Published with the real match count. Per the "CONFIRM CREATE gates the write" note, gate the write behind an explicit confirm.
- `demandTitle`/`Sub` counts come from a demand/supply lookup; keep the copy templates.
- Specs become editable fields (Edit details route) backed by `react-hook-form` + `zod` (both installed).

---

## 6. Animations & Micro-interactions (foundation recipes)

Uses **React Native Reanimated 4.3.1** (v4 — the foundation's recipe worklets). Gate all entrance motion on `useReducedMotion()`.

- **Screen entrance:** **RISE** (fade + slide-up 10px, 350ms, spring 0.75 damping) on the root content; auto-scroll to top on focus.
- **Staggered reveal order** (foundation DRAFT recipe): AI pill → headline+subcopy → card image → each spec row → price → demand callout → buttons (the footer buttons are outside the ScrollView but still animate on mount). Reveal with **POP** (scale 0.92→1 + fade, 300ms, spring 1.2 damping / slight overshoot — the *named* recipe from `src/animations/recipes.ts`, applied as Reanimated `entering={POP.delay(d)}`; do not invent a raw `ZoomIn` config). Delays:
  - AI pill `+100ms`, headline+subcopy RISE `+150ms`, card image fade `+~200ms` (250ms), spec rows POP staggered **80ms** (foundation stagger constant: `base + index*80`, base ~200ms), price POP `+320ms`, demand POP `+400ms`, primary CTA POP `+450ms`, secondary CTA POP `+530ms`.
  - **Spec-row stagger skeleton** (uses the named `POP` recipe; each row gets its own `entering` delay derived from its index — this is the correct per-item pattern, not a single shared value):
    ```tsx
    import Animated from 'react-native-reanimated';
    import { POP } from '@/animations/recipes';
    import { useAnimationConfig } from '@/hooks/useAnimationConfig'; // reduced-motion wrapper

    const { reduceMotion } = useAnimationConfig();
    const SPEC_BASE = 200, SPEC_STAGGER = 80;
    // ...
    {vm.specs.map((row, i) => (
      <Animated.View
        key={row.k}
        entering={reduceMotion ? FadeIn.duration(200) : POP.delay(SPEC_BASE + i * SPEC_STAGGER)}
      >
        {/* space-between HStack: key left / value right */}
      </Animated.View>
    ))}
    ```
- **Button press** (both CTAs): the shared `Button` already runs the foundation press recipe — press-in **scale 1→0.97** over `motion.tap` (100ms) via Reanimated `withTiming`, release times back to `1` (no opacity change). Keep it; do NOT re-implement and do NOT change the scale to 0.95/0.92. Any bespoke `Pressable` on this screen uses the **same 0.97** press scale to match.
- **Haptics** (import `{ haptics }` from `@/lib/haptics` — NEVER import `expo-haptics` directly): the only exported verbs are `tap / impact / heavy / success / warning / error`; there is **no** `haptics.light()` or `haptics.medium()`.
  - Back = `haptics.tap()` (light/selection feel).
  - **Publish/Post = `haptics.impact()`** (MEDIUM thump — primary action).
  - Edit = `haptics.tap()`.
  - The shared `Button` fires its own **Light** impact on press when its boolean `haptic` prop is left at the default `true`. To avoid a double haptic and to get the correct MEDIUM weight on Publish/Post, set `haptic={false}` on the primary `Button` and call `haptics.impact()` inside `onPress`. For Back (a bespoke `Pressable`, not a `Button`) just call `haptics.tap()` in `onPress`. For the secondary Edit `Button`, either leave `haptic` default (its built-in Light matches "Edit = tap") or set `haptic={false}` + `haptics.tap()` for one consistent code path. Never haptic on passive entrance animations.
- **Exit → Published:** foundation matrix `draft → published` = RISE + scale 0.97→1, 400ms, spring 1.2. Set the `/(lab)/published` route Expo Router option `animation: 'slide_from_bottom'`; the scale entrance is owned by the Published screen.
- **Reduced motion** (foundation, via `useReducedMotion()`): RISE → `FadeIn` (200ms, opacity only); POP → `FadeIn`; no translate/scale, no stagger (all rows fade in together). The `Button` press scale is 0.97 with no opacity change — under reduced motion it stays at `1` (no scale); there is no opacity to keep.

---

## 7. Native Screen-Management (tailored checklist)

**Safe Area**
- [ ] Root uses `Screen edges={['top']}` — the prototype's 60px top padding is provided by the top inset + the Back row's own padding. Add a small extra top pad (`theme.spacing.md` = 12) so Back clears the Dynamic Island.
- [ ] Sticky CTA footer adds `useSafeAreaInsets().bottom` to its bottom padding so it clears the iOS home indicator (~34px) / Android gesture pill.

**Scroll vs Fixed CTA** (long content + a persistent primary action — foundation scenario D)
- [ ] Card + demand callout live inside an explicit `ScrollView` (root `Screen scroll={false} padded={false}`).
- [ ] The two action buttons render **outside/after** the scroll as a sticky-bottom footer `View` (absolute-bottom or a flex footer sibling of the ScrollView). Give the ScrollView `contentContainerStyle.paddingBottom` ≥ footer height + bottom inset (`~140px`, matching the prototype's `130px`) so content never hides behind the CTA.
- [ ] `decelerationRate="normal"`; bounces default.

**Sticky-footer layout skeleton** (footer is a sibling of the ScrollView, not inside it):
```tsx
const insets = useSafeAreaInsets();
const FOOTER_PAD = 140; // ScrollView bottom spacer so content clears the footer

<Screen scroll={false} padded={false} edges={['top']}>
  <ScrollView
    contentContainerStyle={{ paddingBottom: FOOTER_PAD + insets.bottom }}
    decelerationRate="normal"
  >
    {/* header, AI pill, headline, card, demand callout — all paddingHorizontal: 22 */}
  </ScrollView>

  {/* Sticky footer: opaque bg so scroll content can't bleed through */}
  <View
    style={{
      paddingHorizontal: 22,
      paddingTop: 12,
      paddingBottom: 12 + insets.bottom,   // clears iOS home indicator / Android pill
      backgroundColor: brand.background,    // #f8f9ff, opaque
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: '#EEF2EF',
      gap: 10,
    }}
  >
    <Button size="sm" haptic={false} label={vm.publishLabel}
            onPress={() => { haptics.impact(); router.push({ pathname:'/(lab)/published', params:{ mode } }); }}
            style={{ backgroundColor: vm.accent, height: 54, borderRadius: 16, ...DRAFT_SHADOWS.cta(vm.accentShadow) }} />
    <Button variant="secondary" size="sm" label="Edit details"
            onPress={() => { haptics.tap(); toast('Editing coming soon'); }}
            style={{ borderWidth: 1.4, borderColor: '#DDE5DF', backgroundColor: '#fff', borderRadius: 16 }} />
  </View>
</Screen>
```
> Note the root is `Screen scroll={false}` and the `ScrollView` is explicit — this is required to make the footer a sibling of (not a child inside) the scroll. If you instead use `Screen scroll`, render the footer via a portal/absolute `View` pinned to the bottom; either way the CTAs must NOT scroll.

**Keyboard:** No text inputs on this screen (Edit is a separate route) → `keyboardAware={false}`; no keyboard avoidance needed here.

**Small vs large device (SE 375 → Pro Max 430)** (foundation scenario C)
- [ ] No fixed widths on card/blocks — full-width minus the 22px gutter (`paddingHorizontal: 22`, never fixed px widths). Gradient hero uses fixed `height:150` (fine, it's a banner not content).
- [ ] Price hint `max-width:120px` — keep; it wraps to 2 lines on small devices as designed.
- [ ] Spec value text right-aligned with `flexShrink:1` so long values (e.g. "−86°C · 728 L") don't collide with the key; key gets `flexShrink:0` or the pair a `gap:12`.
- [ ] Optional headline font-scale down when `useWindowDimensions().width < 400` (foundation) so the 26px headline doesn't wrap awkwardly on SE.

**Android nav bar + polish** (foundation scenario E)
- [ ] Sticky CTA footer background = opaque `#f8f9ff` (screen bg) or `#fff`, so scroll content doesn't bleed through; optional top hairline `#EEF2EF`.
- [ ] Text on accent CTA is `#fff` — contrast on `#16794A`/`#2563EB` ≥ 4.5:1 ✓.
- [ ] `backdrop-filter` unsupported in RN → source hero badge uses solid `rgba(16,32,26,0.72)` (no blur), visually equivalent; no blur dependency added.
- [ ] Dark mode: light-only for v1 (per foundation stance).

**Per-screen block (foundation format):**
```
Safe area:   [x] top edge  [x] bottom inset (sticky footer)  [x] no Dynamic Island overlap
Keyboard:    [x] n/a — no inputs on this screen
Responsive:  [x] flex widths (22px gutter)  [x] SE + Pro Max  [x] no fixed content widths
Scroll/CTA:  [x] content scrolls  [x] CTA outside scroll  [x] paddingBottom ~140px spacer
Android/DM:  [x] footer inset  [x] opaque footer  [x] dark text on light  [x] contrast ≥4.5:1
Polish:      [x] card radius 22 (≥12)  [x] 4px spacing tokens + 22 gutter  [x] custom card shadow
```

---

## 8. Acceptance Checklist (pass/fail)

**Visual fidelity**
- [ ] 22px horizontal gutter on header, headline, card, demand, and CTA blocks.
- [ ] Card: `#fff`, 22px radius, `1px #E7EDE8` border, shadow `0 16px 40px -26px rgba(14,59,46,.45)`.
- [ ] Gradient hero 150px, 135° `#1f6b4a→#0E3B2E` (sell) / `#3b6fd4→#1c3f8f` (buy), centered equipment glyph (react-native-svg rect+line+circle) white @55% opacity.
- [ ] Market badge "101LAB" white pill `#0E3B2E` text; source badge dark translucent (`rgba(16,32,26,.72)` fallback) with check icon + mode text.
- [ ] Headline Hanken 800 (or 700 fallback, documented) 26px `#10201A` tight tracking; subcopy `#6B7A72` 13px.
- [ ] AI pill green `#EAF3EC`/`#0E6B3F` with sparkle `#16A35A` — **not** amber (not `Badge` `ai` variant).
- [ ] 4 spec rows, key `#7C8A82` left / value bold `#10201A` right, top divider `#EEF2EF`.
- [ ] Price block tinted (`#F0F8F3`/`#EEF3FE`), 14px radius, label in accent color, value Hanken 24px, hint right-aligned max 120px.
- [ ] Demand callout tinted + bordered, 42px accent icon tile, users glyph white.
- [ ] Primary CTA `Button size="sm"` + `style={{ height:54 }}` (explicit override — no 44/54px size exists; not raw `md`/56), radius 16, accent bg, accent-shadow glow; secondary `Button variant="secondary" size="sm"` (48px), `#fff`, `borderWidth:1.4 #DDE5DF` via `style` (no `borderWidth` prop), dark text (`#34503F` needs a bespoke Pressable for pixel-exact).

**Mode behavior**
- [ ] All copy/colors swap correctly between sell and buy per §5 (headline, source, gradient, title, location, specs, price label/value/hint, demand, publish label, accent + shadow).
- [ ] Sell accent `#16794A` (`theme.greenDark`); buy accent `#2563EB` (`theme.buyBlue`) applied to icon tile, price label, primary CTA, and its shadow.

**Interactivity & nav**
- [ ] Back → Home (`router.replace('/(lab)')`, flow reset), `haptics.tap()`.
- [ ] Publish → Published (`router.push({ pathname:'/(lab)/published', params:{ mode } })`), `haptics.impact()` (MEDIUM) with Button `haptic={false}`.
- [ ] Edit details → live button: `haptics.tap()` + `toast('Editing coming soon')` (NOT disabled; Phase 2 routes to `/(lab)/draft/edit`).
- [ ] Both CTAs show the shared `Button` press recipe: **scale 1→0.97** over `motion.tap` (no opacity change), spring/time back to 1. No screen re-implements the press; no 0.95.
- [ ] All haptics go through `@/lib/haptics` verbs (`tap`/`impact`); no direct `expo-haptics` import in the screen.

**Motion & native**
- [ ] Entrance runs RISE + staggered POP (named recipes, 80ms stagger) in the documented order; disabled/simplified under Reduced Motion (FadeIn only).
- [ ] Content scrolls; both CTAs stay pinned in the sticky footer above the home indicator on iPhone SE and 14 Pro Max; no content hidden behind the footer.
- [ ] Renders correctly with no clipped/overflowing text on 375px width (spec value flexShrink; price hint wraps).
- [ ] Reuses `@/components/ui` (`Screen`, `Text`, `Button`, `HStack`, `AppImage` for future) + `@/constants/theme` tokens + `expo-linear-gradient` + `react-native-svg` + `lucide-react-native` + `@/lib/haptics` + `sonner-native`; **zero new dependencies**.
- [ ] Prerequisites satisfied (foundation): green/buy tokens added to `@/constants/theme.ts`; Hanken 800 added to `app/_layout.tsx` loader + `fonts.headingBold` (or documented 700 fallback); `(lab)` route group + `src/features/lab/` + `src/animations/recipes.ts` exist. Body text is Inter (Plus Jakarta Sans mapped to Inter per foundation).
