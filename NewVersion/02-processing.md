# Processing Screen — Implementation Spec

**Screen:** `app/(lab)/processing.tsx` (new AI-first 101LAB flow — separate from the existing seller `app/scan/processing.tsx`, which is a distinct richer loader and must NOT be reused as-is)
**Prototype source:** `101LAB Mobile.dc.html` lines 130–157 (markup) + 469–599 (state/copy)
**Reads foundation:** `NewVersion/00-foundation.md` — all tokens, recipes, and the native checklist below are defined there.

---

## Prerequisites (foundation setup)

These are **set up once in the foundation**, not per screen. This section restates the subset this screen depends on so the reader knows they are already-owned setup items — see [`00-foundation.md` → Prerequisites](00-foundation.md#prerequisites-foundation-setup). If any is unchecked, land it in the foundation PR first; do **not** re-implement it inside `processing.tsx`.

- [ ] **`(lab)` route group** — `app/(lab)/` exists with a `_layout.tsx` (`Stack`, `headerShown:false`). This screen is `app/(lab)/processing.tsx`. (Foundation item.)
- [ ] **`src/features/lab/`** — feature folder exists; this screen adds `src/features/lab/components/ProcessingSpinner.tsx` + `ProcessingStepRow.tsx` (see §3).
- [ ] **Fonts** — `HankenGrotesk_800ExtraBold` added to `useFonts({...})` in `app/_layout.tsx` and exposed as `fonts.headingBold` in `src/theme/typography.ts`. Today `app/_layout.tsx` loads only Hanken **600/700** (verified) → `fonts.heading` = `HankenGrotesk_700Bold`. Until `headingBold` lands, the title uses `fonts.heading` (700) as a **documented interim** (see §2b). Body/label stays **Inter** (the prototype's Plus Jakarta Sans is a documented simplification — do not add it).
- [ ] **Color tokens** — the buy/green accents this screen references are **added per foundation** to `@/constants/theme.ts` `brand` (they do **not** exist in the repo today — verified: `brand` has no `greenDark`/`buyBlue`). Add: `greenDark: '#16794A'`, `buyBlue: '#2563EB'`. Reference them as `brand.greenDark` / `brand.buyBlue`, not raw hex. The four prototype-only shades (`#E2EBE5`, `#C7D3CB`, `#34503F`, plus exact-match `#10201A`/`#6B7A72`) are **local `const`s in this screen file** — single-screen shades, not global tokens (see §2 color table).
- [ ] **`src/animations/recipes.ts`** — motion module exists exporting the named recipes. This screen consumes `useSpin(durationMs)` and (optional) `usePulse(durationMs)`; if the module ships only the raw recipe objects, add these two hooks there (see §3 + §6). `src/animations/` is empty today (verified) — this is a foundation deliverable, not per-screen inline code.

---

## 1. Purpose & Place in Flow

The **Processing** screen is the transient "AI is working" state shown immediately after the user submits their intent (typed prompt, demo chip, or photo/PDF) on the **Home** composer. It reassures the user that the AI is parsing their input, shows a 3-step checklist (2 done, 1 in-progress), then **auto-advances to Draft** after ~2.6s.

There is **no user interaction** on this screen — it is a timed hand-off. It exists purely to make the AI feel deliberate and trustworthy. Flow position (foundation state machine): `home → processing → draft → …`.

**Entry points (all set state `screen: 'processing'` in the prototype; `start()` at HTML line 479–483):**
- Home composer **Send** button (`send: () => this.start()`, line 584) — sell label = "List it", buy label = "Find it" (line 534)
- Demo chip A (`demoA`, line 585) — pre-fills example text then `start()`s
- Demo chip B (`demoB`, line 586) — pre-fills example text then `start()`s

**Exit / navigation target:**
- After `2600ms` → **Draft** screen (prototype: `this._t = setTimeout(() => this.setState({ screen: 'draft' }), 2600)`, line 482)
- No back button, no cancel in the prototype. **Native default (decided): allow Android hardware-back** → `clearTimeout` + `router.back()` to Home (cancels the pending advance). This is the single source of truth for back behavior — see §4 and §7, which restate it identically.

**Mode carries through:** the `mode` (`'sell'` | `'buy'`) selected on Home is read here to swap copy and accent color. It must be passed via route param or the shared Zustand lab store (see §5). Never mutated on this screen.

---

## 2. Visual Layout (top-to-bottom, exact values from HTML)

Root container (line 132):
- `padding: 120px 30px` (top/bottom 120, sides 30) — but see §7: on native prefer flex-centering over a hard 120px top inset.
- `min-height: 100%`, `display:flex; flex-direction:column`
- Entrance animation: `lab-rise .35s ease both` → foundation **RISE** recipe (see §6).
- Background: prototype surface `#F4F7F4` → map to `brand.background` `#f8f9ff`. The `Screen` primitive already applies `bg-bg` (= `brand.background`) on its SafeAreaView, so **no explicit backgroundColor is needed** — do not re-set it.

### 2a. Spinner (lines 133–139)
A 96×96 centered stack, `margin: 0 auto 30px`, `position: relative`. Three explicit z-layers, back to front:
1. **(back) Static track ring** (line 134): `position:absolute; inset:0; borderRadius:48 (half of 96); borderWidth:4; borderColor: TRACK` (`TRACK = '#E2EBE5'`, local const). Never animates.
2. **(middle) Spinning arc** (line 135): a second `position:absolute; inset:0` `Animated.View` — `borderWidth:4; borderColor:'transparent'; borderTopColor: accent; borderRightColor: accent`, rotated 360°/1s (foundation **SPIN**, 1000ms linear, `useSpin(1000)`). A 2-quadrant (top+right, 90°) wedge. `accent = brand.greenDark` (`#16794A`) in sell mode.
3. **(front) Center sparkle glyph** (line 137): 34×34 SVG 4-point sparkle, `fill: accent`, absolutely centered on top of the rings. Exact path: `M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z`. Solid opacity 1 by default; the optional PULSE (§6) animates **only this front layer**, never the rings.

**Icon choice (library reuse):** Lucide `Sparkles` (`import { Sparkles } from 'lucide-react-native'`, foundation line 42) is a 4-point sparkle **with two small satellite stars** — close but NOT a 1:1 match for the single clean 4-point star in the prototype. For pixel-exact match, render the path above with `react-native-svg` (`Svg`+`Path`, dep already installed — foundation line 41), size 34, `fill={accent}`. **Recommendation: use the inline `react-native-svg` path for exactness**; `Sparkles` is an acceptable fallback if you accept the satellite stars. Do NOT add a new icon dependency.

**Mode accent note:** In sell mode the accent is green `#16794A`; in buy mode Home uses blue `#2563EB` (`accent = sell ? '#16794A' : '#2563EB'`, line 490). The prototype's Processing markup hardcodes green, but for brand consistency the spinner arc + sparkle + step accents SHOULD use the mode accent. Build it accent-driven; default green. Reference these as `brand.greenDark` / `brand.buyBlue` — **added per foundation** (they are NOT in the repo `brand` object today, verified). The single `accent` value comes from `PROCESSING_COPY[mode].accent` (§5), so no component hardcodes a color.

### 2b. Title (line 140)
- Text: `processingTitle` — sell: **"Reading your equipment…"**, buy: **"Posting your request…"** (line 545)
- Font: Hanken Grotesk **800**, `fontSize: 24`, `textAlign:'center'`, `color:'#10201A'`, `letterSpacing: -0.48` (−.02em × 24px), `marginBottom: 8`
- **Font caveat:** `fonts.heading` (`@/constants/theme`) is `HankenGrotesk_700Bold` — **800 is not loaded today**. Per foundation Fonts table, add `HankenGrotesk_800ExtraBold` to the `useFonts` load list in `app/_layout.tsx` and expose a `fonts.headingBold` token, then use `fontFamily: fonts.headingBold`. Until that lands, use `fontFamily: fonts.heading` (700) as a documented interim — do NOT ship a bare `fontWeight:'800'` (Hanken renders via `fontFamily`, not numeric weight, in RN).
- **Do NOT use the `Text` primitive here.** `@/components/ui` `Text` never sets `fontFamily` (renders system font) and its `title` variant is 24/700; tone `primary` = `text-neutral-900` (#111827), not `#10201A`. Use a raw `<Text>` from `react-native` with explicit `fontFamily` + `color:'#10201A'` for a 1:1 match.

### 2c. Subtitle (line 141)
- Text (static, both modes): **"Hang tight — usually under 10 seconds."**
- Font: Inter 400 (`fontFamily: fonts.regular`), `fontSize: 13.5`, `textAlign:'center'`, `color:'#6B7A72'`, `marginBottom: 32`
- `Text` primitive's closest variant is `bodySm` (14/400) but it lacks `fontFamily` and can't hit 13.5 without an inline override — prefer a raw `<Text>` with `fontFamily: fonts.regular` for consistency with the title.

### 2d. Step checklist (lines 142–155)
Column, `gap: 14`, `maxWidth: 280`, `width: '100%'`, `alignSelf:'center'`. Three rows:

**Row style (all rows):** `flexDirection:'row'; alignItems:'center'; gap:12` — label text `fontFamily: fonts.regular`* , `fontSize:13.5`, `fontWeight:'600'` (*Inter 600 = `fonts.semibold`; use `fonts.semibold` and drop the numeric weight for a true 1:1).

| Row | Indicator (22×22 circle, `borderRadius:11`, no shrink) | Text color | Copy (sell) | Copy (buy) |
|-----|------|-----------|-------------|------------|
| **Step 1 (done)** | Solid fill `accent`, centered white check (13×13 SVG, stroke `#fff`, `strokeWidth:3`, `strokeLinecap/join:'round'`, path `M20 6 9 17l-5-5`) | `#10201A` | "Identified: −80°C ultra-low freezer" | "Understood: Agilent/Waters HPLC + DAD" |
| **Step 2 (done)** | Same as Step 1 | `#10201A` | "Pulled specs, condition & fair price" | "Created your Wanted request" |
| **Step 3 (in-progress)** | Ring only: `borderWidth:2.5; borderColor:#C7D3CB; borderTopColor: accent`, spinning 360°/900ms (SPIN @900 — slightly faster than the 1s main spinner) | `#34503F` (muted green) | "Checking live buyer demand…" | "Scanning sellers for matches…" |

Check glyph: use the inline SVG path above with `react-native-svg` (matches the seller check style), or Lucide `Check` (foundation line 42) at size 13, `color:'#fff'`, `strokeWidth:3`. Either matches acceptably — `Check` is already an approved import.

Copy tokens: `procStep1/2/3` (lines 546–548).

### Color reference (exact prototype hex → token source)
| Token | Hex | Token source | Role |
|-------|-----|--------------|------|
| green-dark | `#16794A` | `brand.greenDark` — **add per foundation** (not in repo yet) | Spinner arc, check fill, step-3 arc, sell accent |
| buy accent | `#2563EB` | `brand.buyBlue` — **add per foundation** (not in repo yet) | Buy-mode accent (spinner/steps) |
| track ring | `#E2EBE5` | local `const TRACK` (single-screen shade) | Spinner static track |
| step-3 track | `#C7D3CB` | local `const STEP_TRACK` (single-screen shade) | In-progress ring track |
| text-primary | `#10201A` | local `const` (≈`brand.foreground` #121c28, but use exact `#10201A` for 1:1) | Title, done-step text |
| text-secondary | `#6B7A72` | local `const` (≈`brand.textMuted` #5b6b63, but use exact `#6B7A72`) | Subtitle |
| step-3 text | `#34503F` | local `const` (single-screen shade) | In-progress step text |
| screen bg | `#f8f9ff` | `brand.background` (verified present in repo; applied by `Screen` as `bg-bg`) | Root background |

The two **accent** tokens (`greenDark`, `buyBlue`) are **foundation prerequisites** — reference them as `brand.greenDark` / `brand.buyBlue`, never raw hex, and treat as "add per foundation," not "already present." The five prototype-only shades (`#E2EBE5`, `#C7D3CB`, `#34503F`, `#10201A`, `#6B7A72`) have no exact foundation token — define them as local `const`s at the top of the screen file (do not invent new global tokens for a single screen).

---

## 3. Component Breakdown

### Reuse (existing primitives — import from `@/components/ui`)
- **`Screen`** — root wrapper. Use `<Screen scroll={false} padded={false} contentContainerStyle={{ flexGrow:1, alignItems:'center', justifyContent:'center', paddingHorizontal:30 }}>`. Rationale: `Screen`'s `padded` prop only applies `px-lg` (16px) — the prototype uses 30px sides, so set `padded={false}` and supply 30px yourself. With `scroll={false}`, `contentContainerStyle` is forwarded to the inner `<View>`'s `style`. SafeArea + `bg-bg` are handled by `Screen`. Default `edges={['top']}` is correct (full-screen state, no bottom nav).
- **Theme tokens** from `@/constants/theme`: `brand`, `fonts`, `spacing`, `radius`, `motion`. Import: `import { brand, fonts, spacing, radius, motion } from '@/constants/theme';` (all re-exported there — `fonts` via `theme.ts` line 126).
- **Icons** from `lucide-react-native`: `Check` (13px) — and optionally `Sparkles` if not using the inline SVG. Import: `import { Check } from 'lucide-react-native';` (foundation line 42 confirms `Check` + `Sparkles` are approved).
- **`react-native-svg`** (installed, foundation line 41): `Svg`, `Path` — for the exact 4-point sparkle and/or check. Import: `import Svg, { Path } from 'react-native-svg';`
- **Reanimated** from `react-native-reanimated` (v4.3.1, foundation line 31): `useSharedValue`, `useAnimatedStyle`, `withRepeat`, `withTiming`, `Easing`, `useReducedMotion`, and layout animations `FadeInUp`, `FadeIn`, `FadeOutDown`. Use `Animated.View` for spinner + entrance.
- **`haptics`** from `@/lib/haptics` (exists, verified). **API note:** it exposes semantic verbs, NOT an intensity arg. The only exports are `tap()` (Light/selection), `impact()` (Medium thump), `heavy()`, `success()`, `warning()`, `error()`. Use `haptics.impact()` (already Medium) for the auto-advance cue — NOT `haptics.impact('medium')` (no such signature) and there is no `haptics.medium()`/`haptics.light()`. For the optional per-step "pop" cues use `haptics.tap()`. Do not import `expo-haptics` directly (foundation rule: go through `@/lib/haptics`).
- **`react-native`**: `Text` (raw, per §2b/2c), `Keyboard` (dismiss on mount), `BackHandler` (hardware-back handler, §4). **`react`**: `useEffect`, `useRef` (timer ref, §4).

### Animation recipes (foundation prerequisite — `src/animations/recipes.ts`)
The recipes module is a **foundation deliverable** (see Prerequisites), not per-screen code — `src/animations/` is empty in the repo today (verified). This screen consumes two hooks from it; if the foundation ships only the raw recipe objects, add these hooks to the same module:
- **`useSpin(durationMs)`** → returns a `useAnimatedStyle` rotating `0→360deg` driven by a `useSharedValue` looped with `withRepeat(withTiming(360, { duration, easing: Easing.linear }), -1)`. Used at `1000` (main spinner) and `900` (step-3 ring). **Worklet-safe / UI-thread only** (no JS driver) → 60fps. Must accept a reduced-motion flag (or the caller reads `useReducedMotion()`) and return the frozen-45° transform per §6.
- **`usePulse(durationMs)`** (optional, see §6) → animates a shared opacity value `0.35↔1` on a loop; static `1` under reduced motion.
Keep the animation logic in the shared module so Draft/Published/Match reuse it — do not inline `withRepeat`/`withTiming` in the screen.

### New small components (create under `src/features/lab/components/`)
1. **`ProcessingSpinner.tsx`** — the 96×96 3-layer spinner (track + rotating arc + center sparkle). Props: `{ accent: string; reducedMotion: boolean }`. Uses `useSpin(1000)`. Reuse later on any AI-working surface.
2. **`ProcessingStepRow.tsx`** — one checklist row. Props: `{ state: 'done' | 'active'; label: string; accent: string; reducedMotion: boolean }`. Renders the solid-check circle (done) or the spinning ring (active, `useSpin(900)`). Isolates the two visual states cleanly.

Keep both tiny and presentational; all data/timing lives in the screen.

---

## 4. Interactivity & Navigation

There are **no on-screen tappable elements** on this screen — it is a passive, timed state. The only user-initiated interaction is the **Android hardware-back gesture** (decided default: cancel the timer + `router.back()` to Home — see §7). Everything else is the auto-advance + the animation choreography.

### State machine (screen-local)
```
mount → start timer → (2600ms) → navigate to Draft (router.replace)
```
- `mode: 'sell' | 'buy'` — read from route param / lab store; drives copy + accent. Never changes here.
- No local mutable UI state is required for the static build beyond a `reducedMotion` read (`useReducedMotion()`); the steps are hardcoded `['done','done','active']`. Optionally a `stepChoreo` counter to *pop* checks in sequence (§6).

### Mode variations (copy + color)
| Element | Sell | Buy |
|---------|------|-----|
| Title | "Reading your equipment…" | "Posting your request…" |
| Step 1 | "Identified: −80°C ultra-low freezer" | "Understood: Agilent/Waters HPLC + DAD" |
| Step 2 | "Pulled specs, condition & fair price" | "Created your Wanted request" |
| Step 3 | "Checking live buyer demand…" | "Scanning sellers for matches…" |
| Accent (spinner arc, checks, step-3 arc) | `#16794A` | `#2563EB` |

Subtitle is identical in both modes.

### Auto-advance + back handling
The timer id is held in a ref so the back handler can clear the **same** timer the effect scheduled (prevents a stale-timer / double-navigation race on unmount or rapid back-press):
```ts
const reducedMotion = useReducedMotion();
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// Auto-advance
useEffect(() => {
  timerRef.current = setTimeout(() => {
    haptics.impact(); // Medium — "step 3 complete / advancing" cue (device only)
    router.replace({ pathname: '/(lab)/draft', params: { mode } });
  }, AUTO_ADVANCE_MS);
  return () => {
    if (timerRef.current) clearTimeout(timerRef.current); // clear on unmount
    timerRef.current = null;
  };
}, [mode]);

// Android hardware-back (decided default): cancel the pending advance, go Home.
useEffect(() => {
  const sub = BackHandler.addEventListener('hardwareBackPress', () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    router.back(); // → Home
    return true;   // we handled it; do not also pop the navigator
  });
  return () => sub.remove();
}, []);
```
`BackHandler` from `react-native`; `useRef` from `react`. Use `router.replace` (NOT `push`) for the auto-advance so Processing is not left on the back stack — the user must never auto-return to a spinner. Forward `mode` as a param (or set it in the lab store before navigating). Clearing `timerRef` in both the unmount cleanup and the back handler guarantees no navigation fires after leaving and no double-navigation.

---

## 5. Static Data Shape & Future Hook Points

### Hardcoded now
The screen renders from a single derived copy object, keyed by `mode` — mirrors `renderVals()` lines 545–548:

```ts
type LabMode = 'sell' | 'buy';

const PROCESSING_COPY: Record<LabMode, {
  title: string;
  subtitle: string;
  steps: [string, string, string]; // [done, done, active]
  accent: string;
}> = {
  sell: {
    title: 'Reading your equipment…',
    subtitle: 'Hang tight — usually under 10 seconds.',
    steps: [
      'Identified: −80°C ultra-low freezer',
      'Pulled specs, condition & fair price',
      'Checking live buyer demand…',
    ],
    accent: brand.greenDark, // '#16794A' — add per foundation
  },
  buy: {
    title: 'Posting your request…',
    subtitle: 'Hang tight — usually under 10 seconds.',
    steps: [
      'Understood: Agilent/Waters HPLC + DAD',
      'Created your Wanted request',
      'Scanning sellers for matches…',
    ],
    accent: brand.buyBlue, // '#2563EB' — add per foundation
  },
};

const AUTO_ADVANCE_MS = 2600;
const STEP_STATES = ['done', 'done', 'active'] as const;
```

### Future dynamic hook points (foundation "Static-First, Then Dynamic")
- **`mode`** — from the Home lab store (Zustand, foundation line 46); unchanged later.
- **Step copy + states** — currently mode-static. Later replace with **live SSE stage events** (foundation lists `react-native-sse` 1.2.1, line 49). The existing seller flow already streams `stage`/`detection`/`product` events (`smartDetectStreamTypes`, `PHASE_TO_STEP` in `app/scan/processing.tsx`). The `steps` array + their `done/active` states become derived from `streamPhase` + a `productProgress {done,total}` counter. The single `setTimeout` becomes "advance on real result → navigate", identical in shape to the seller screen's success effect. Keep `AUTO_ADVANCE_MS` as a **fallback ceiling** even after wiring the API (so a stalled stream still moves on).
- **Result payload** — the AI-generated draft returned by the mutation is what Draft renders; on this screen it only gates navigation. Slot a `useMutation`/SSE hook (TanStack React Query, foundation line 48) that resolves → stash result in the lab store → `router.replace('/(lab)/draft', { params:{ mode } })`.

---

## 6. Animations & Micro-Interactions (foundation recipes)

Reference the named recipes from foundation §"Animation & Interaction Recipes". Ports of the prototype CSS keyframes into Reanimated 4 worklets, 60fps locked (all continuous animation on the UI thread via `useSharedValue` + `useAnimatedStyle`).

- **Screen entrance — RISE** (line 132 `lab-rise .35s`; foundation RISE = fade + slide-up 10px, 350ms, spring 0.75 damping): wrap root content in `<Animated.View entering={FadeInUp.duration(350).springify().dampingRatio(0.75)}>`.
  - **Token note:** the "spring 0.75 damping" in the foundation matrix is a Reanimated **damping ratio** (`.dampingRatio(0.75)` on the layout builder), NOT `motion.spring` from `@/constants/theme` (which is a physical `{ damping:18, stiffness:220 }` config for `withSpring`). Don't conflate them. For layout-animation entrances use `.springify().dampingRatio(0.75)`; reserve `motion.spring` for `withSpring()` value animations.
  - Reduced-motion → `FadeIn.duration(200)` (opacity only, per foundation reduced-motion rules).
- **Main spinner — SPIN** (line 135, 1s linear infinite): `useSpin(1000)`. Arc uses `accent`. **Do NOT honor reduced-motion for the loader itself** (WCAG 2.3.3 spinner exception — same stance as the seller screen); if `reducedMotion`, render a **static arc** instead of stopping it dead. **Exact reduced-motion state (no implementer guessing):** the same 96×96 stack — static `#E2EBE5` track ring underneath, and the arc layer frozen at rotation `45deg` (top-right diagonal) with its `borderTopColor`/`borderRightColor` = `accent`, **opacity 1.0, scale 100%**. Center sparkle renders at full opacity, no pulse. Nothing spins.
- **Step-3 ring — SPIN @900** (line 152, `.9s`): `useSpin(900)` on the in-progress ring so it reads as a distinct, quicker sub-process (visual hierarchy vs the 1s main spinner). Reduced-motion: same treatment — freeze the ring at `45deg`, `#C7D3CB` track + accent top border, opacity 1.0.
- **Optional PULSE** on the sparkle — `usePulse(1500)` (opacity 0.35→1, foundation PULSE). **Off by default** (not in the prototype markup; the sparkle renders at solid opacity 1). Turn on only for extra life, behind a local `const ENABLE_SPARKLE_PULSE = false`. The pulse sits **on the center sparkle layer (in front of the arc)**, not the track. Reduced-motion → static opacity 1 regardless.
- **Step-completion choreography — decided default = static (1:1 prototype):** Steps 1 & 2 render `done` (checked) on mount and Step 3 renders `active` (spinning ring) — this matches the prototype exactly (lines 142–155 show both checks already present). This is what the acceptance checklist verifies.
  - **Optional richer build (behind a local `const ENABLE_STEP_POP = false`):** instead of static checks, pop them in with foundation **POP** (scale 0.92→1 + fade via `ZoomIn.duration(300)`): `t=200ms` Step 1 check + `haptics.tap()`; `t=400ms` Step 2 check + `haptics.tap()`; Step 3 "completes" at advance, already covered by the `haptics.impact()` in the auto-advance effect. If you enable POP, note it in the PR — the acceptance checklist permits both (see §8). Reduced-motion → `FadeIn.duration(200)` (never a scale pop).
- **Exit — RISE reverse:** on navigate, `exiting={FadeOutDown.duration(250)}` for a fade + slide-down as Draft's RISE enters. Foundation transition matrix: `processing → draft` = RISE exit + enter, ~350ms, spring 0.75.
- **Haptics summary (via `@/lib/haptics`):** no haptic on screen entrance; `haptics.tap()` (Light) on each optional step-complete pop; `haptics.impact()` (Medium) on the final auto-advance cue. Never haptic on passive fade/scroll (foundation rule).
- **Reduced motion (`useReducedMotion()`):** SPIN → static arc (keep visible, don't animate); PULSE → static opacity 1; POP → `FadeIn` 200; RISE → `FadeIn` 200.

---

## 7. Native Screen-Management (per-screen block)

```
Safe area:   [x] top edge (Screen edges=['top'])   [x] no bottom inset needed (no nav)   [x] no Dynamic Island overlap (content centered)
Keyboard:    [x] N/A — no inputs; dismiss keyboard on mount if arriving from a focused composer
Responsive:  [x] flex-centered, maxWidth:280 checklist   [x] SE 375 + Pro Max 430 tested   [x] no aspectRatio images on this screen
Scroll/CTA:  [x] no scroll, no CTA — single centered block (scroll=false)
Android/DM:  [x] no tab bar to inset   [x] N/A opaque tab bar   [x] contrast ≥4.5:1   [x] dark mode out of scope (v1 light)
Polish:      [x] indicator radius = full (circles)   [x] 4px spacing tokens (gap 14 ≈ between md/lg; use 14 explicitly for 1:1)   [x] no shadows on this screen
```

**Safe Area**
- Root uses `Screen` (SafeAreaView, `edges={['top']}`). The prototype's `120px` top padding is generous — on native prefer flex-centering (`justifyContent:'center'`) over a fixed 120px top so the block stays vertically balanced on SE and Pro Max alike. Content is centered, well clear of the Dynamic Island.
- No bottom-nav on this screen (`showNav` is false for `processing`, HTML line 514 excludes it). No bottom inset required.

**Keyboard**
- N/A — no inputs. If arriving from a focused composer, call `Keyboard.dismiss()` on mount so the RISE transition is clean (the root `KeyboardProvider` from `react-native-keyboard-controller` is already wired, foundation line 34).

**Small vs Large device**
- Checklist column `maxWidth:280` + `width:'100%'` — fluid. On 375px (SE): 375 − 60 (30px sides) = 315px available > 280px block. OK, no overflow.
- Title 24 / step text 13.5 are safe at both extremes; no dynamic font scaling needed. Spinner fixed 96×96 (locked size = stable 60fps, no relayout).

**Scroll vs fixed CTA**
- No scroll, no CTA — single centered block. `scroll={false}`, center via flex.

**Android nav bar + back**
- No bottom bar to inset.
- **Android hardware back (decided default):** the prototype has no cancel. For native we **allow back** → the `BackHandler` listener in §4 clears the pending timer and calls `router.back()` to Home, then returns `true` (we handled it). Rationale: a passive 2.6s loader should never trap the user; a mid-flight cancel is harmless (nothing is persisted yet). This is the same behavior stated in §1 and coded in §4 — no per-PR choice remains.

**Contrast:** white check on `#16794A`/`#2563EB` fill and the accent arc on `#f8f9ff` bg both exceed 4.5:1. Title `#10201A` and subtitle `#6B7A72` on `#f8f9ff` pass.

**Dark mode:** out of scope (v1 light-only, foundation §Colors).

---

## 8. Acceptance Checklist

- [ ] New screen file exists at `app/(lab)/processing.tsx`, registered in the `(lab)` stack with `headerShown:false`.
- [ ] Reuses `Screen` (`scroll={false} padded={false}`, 30px horizontal padding, flex-centered); does NOT re-set backgroundColor (inherits `bg-bg`).
- [ ] Renders a 96×96 spinner: static `#E2EBE5` track ring, an accent (`#16794A` sell / `#2563EB` buy) top+right arc rotating 360° every 1000ms via `useSpin(1000)`, and a centered 34px accent-colored 4-point sparkle (inline `react-native-svg` path, or `Sparkles` fallback).
- [ ] Title reads **"Reading your equipment…"** (sell) / **"Posting your request…"** (buy), Hanken Grotesk (800 once `headingBold` is loaded, 700 interim via `fonts.heading`), 24px, `#10201A`, centered, `letterSpacing:-0.48`. Rendered with a raw RN `<Text>` (not the `Text` primitive) so `fontFamily` + exact color apply.
- [ ] Subtitle reads **"Hang tight — usually under 10 seconds."** (Inter 400 `fonts.regular`, 13.5px, `#6B7A72`) in both modes.
- [ ] Exactly 3 step rows in a centered `maxWidth:280` column with 14px gaps:
  - [ ] Rows 1 & 2 show a solid accent-filled 22px circle with a white check (SVG path `M20 6 9 17l-5-5` or Lucide `Check`); text `#10201A`; correct sell/buy copy.
  - [ ] Row 3 shows a 22px ring (`#C7D3CB` track, accent top border) spinning every 900ms via `useSpin(900)`; text `#34503F`; correct sell/buy copy.
- [ ] Accent switches to `#2563EB` throughout when `mode === 'buy'` (spinner arc, sparkle, check fills, step-3 arc).
- [ ] Screen animates in with RISE (`FadeInUp.duration(350).springify().dampingRatio(0.75)`); exits with `FadeOutDown.duration(250)`.
- [ ] Animation recipes live in `src/animations/recipes.ts` (`useSpin`, optional `usePulse`) — not inlined; spinner runs on the UI thread (60fps, worklet-safe).
- [ ] After `AUTO_ADVANCE_MS` (2600) the screen auto-navigates to Draft via `router.replace({ pathname:'/(lab)/draft', params:{ mode } })`; Processing is not left on the back stack.
- [ ] Timer id held in a ref; cleared on unmount **and** in the back handler. No navigation fires after leaving; no double-navigation on rapid unmount/back or mode change.
- [ ] Step choreography matches the **decided default = static**: Steps 1 & 2 render pre-checked and Step 3 renders as the spinning ring on mount (1:1 prototype). The optional POP variant (`ENABLE_STEP_POP`) is off by default; if enabled, it is noted in the PR (checklist permits both).
- [ ] A Medium haptic fires at the auto-advance moment via `haptics.impact()` (device only) — NOT `haptics.impact('medium')` (no such signature; `impact()` is already Medium). Optional step-pop cues use `haptics.tap()`.
- [ ] `useReducedMotion()` honored: RISE/POP → `FadeIn` 200; PULSE static opacity 1; the loader spinner **stays visible** as a static accent arc frozen at 45°, opacity 1.0, scale 100% (both the 96px main spinner and the step-3 ring), per WCAG 2.3.3 spinner exception.
- [ ] All copy/colors driven by a single module-level `PROCESSING_COPY[mode]` object + module-level `AUTO_ADVANCE_MS` / `STEP_STATES` constants (not inlined) — no magic strings — so the future SSE hook (§5) replaces the source without touching layout. `AUTO_ADVANCE_MS` is retained as a fallback ceiling after the API lands.
- [ ] Android hardware-back handled per the decided default: `BackHandler` listener clears the timer + `router.back()` to Home and returns `true` (§4/§7).
- [ ] Layout centered and correct on iPhone SE (375px) and Pro Max (430px); no overflow, no horizontal scroll.
- [ ] Font prerequisite tracked: `HankenGrotesk_800ExtraBold` added to `app/_layout.tsx` `useFonts` + `fonts.headingBold` token (foundation Fonts action item), OR interim 700 explicitly noted in the PR.
- [ ] Visually matches `101LAB Mobile.dc.html` lines 130–157 side-by-side (spinner, title, subtitle, 2 checks + 1 spinning ring).
