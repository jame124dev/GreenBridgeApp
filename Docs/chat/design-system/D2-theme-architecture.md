# D2 — Theme Architecture

| | |
|---|---|
| **Doc ID** | D2 |
| **Layer** | Design System |
| **Status** | Draft — awaiting review |
| **Version** | 0.1.0 |
| **Owners** | Chat Platform · Design Systems |
| **Depends on** | **D1 (Design Tokens)**; A4 (ChatProvider host), X4 (platform behavior — consumer) |
| **Depended on by** | D3, D4, all F-docs, X1 (a11y), X4 (platform) |
| **Reference implementation** | none yet (`[Target]`); today `theme.ts` values are imported directly (`[Legacy]`) |

> **Normative language.** MUST, MUST NOT, SHOULD, SHOULD NOT, MAY per RFC 2119.
>
> **Scope boundary (no duplication).** D2 defines the **runtime machinery** — resolution pipeline,
> provider, hooks, switching, composition, platform adaptation, performance. It **does not** define
> token values (→ **D1**), motion choreography or reduced-motion policy (→ **D4**), type usage rules
> (→ **D3**), or component behavior (→ A4/F-docs). D2 is *how tokens reach a component*; D1 is *what
> the tokens are*.

---

## 1. Theme philosophy

**Why themes exist.** A theme is a *binding* from D1's semantic token names to concrete values.
Isolating that binding behind a runtime object is what lets the same components render as chat-dark
today, light tomorrow, and a partner white-label later — with **zero component edits**. The theme is
the one place a "what does `color.accent` mean here?" question is answered.

**Why components never touch primitives.** If a component read `palette.green.400`, it would encode
one theme's decision forever; a second theme could not change it without editing the component. By
forcing components to read **semantic** tokens only (D1 §1.3), the decision lives in theme data, not
in the tree. This is the single rule the entire D-layer exists to protect.

**Theme-dependent vs. theme-independent (the key split).** Only **color**, **elevation**, and
**blur** vary by theme (D1 §1.4, §7). Those resolve **through the provider**. Everything else —
`space`, `radius`, `motion`, `opacity`, `z`, `size`, `a11y`, `type` — is a shared constant and is
**imported directly**, never through context. Providerizing invariant values would add re-render
surface for no benefit. This split is normative.

---

## 2. Theme resolution pipeline

```
D1 Tier 1  PRIMITIVES        palette.green.400 = #34D08C            (module constant, internal)
                │  a theme maps semantic → primitive (composition, §8)
                ▼
D1 Tier 2  SEMANTIC NAMES     color.accent, color.bg.canvas, elevation.raised
                │  a Theme is the resolved binding for one context
                ▼
D2         THEME OBJECT       chatDarkTheme  (frozen; color.accent → '#34D08C')
                │  provided to a subtree
                ▼
D2         THEME PROVIDER     React context holding the active frozen Theme (§3)
                │  narrow, typed access
                ▼
D2         HOOKS              useColor() · useElevation() · useTheme() · useBlur()   (§5)
                │  resolved value (stable string / style object)
                ▼
           COMPONENTS         read semantic tokens only; never primitives

  ── bypass lane (theme-INDEPENDENT) ──────────────────────────────────────────
  space · radius · motion · opacity · z · size · a11y · type
        └── imported directly from the D1 constants module (no provider, §1)
```

**Step by step.**
1. **Primitives** are frozen constants in one module; nothing outside the theme composition reads
   them.
2. **Semantic names** (D1 §4) are the stable vocabulary; they have no value until a theme binds them.
3. **Theme object** is the resolved binding for one scope (chat-dark ships; light is a future map).
   Built once, frozen, cached by `id` (§8/§9).
4. **Provider** supplies the active theme to a subtree via context; nesting scopes themes (§7).
5. **Hooks** give components typed, narrow access to the resolved values; they never expose the raw
   map or primitives.
6. **Components** consume semantic values only. Theme-independent scales skip 4–5 entirely.

---

## 3. Theme provider architecture

**Responsibilities (only these).**
- Hold the **active, frozen** `Theme` for its subtree and publish it via context.
- Expose a stable switch action (`setTheme(id)`) for future light/white-label (§7).
- Nothing else: the provider performs **no** side effects, no I/O, no persistence, no status-bar
  mutation (that is X4, which *reads* the theme — §6).

**Lifecycle.**
- **Initialization is synchronous.** The initial theme is known at mount (chat is always `chat-dark`),
  resolved from the theme registry before first paint — **no async load, no flash-of-wrong-theme**.
- **Provision:** the provider's context value is `{ theme, setTheme }`, memoized so its reference is
  stable across renders that don't change the active theme id.
- **Updates:** a theme switch (rare) sets a new active `id`; the provider looks up the cached frozen
  theme for that id and publishes it. Consumers re-render **once**.
- **Unmount:** nothing to tear down (pure).

**Memoization & performance (summary; full rules §9).**
- The `Theme` object for an id is built once and cached; its reference is **stable between switches**.
- Because the theme is referentially stable, context consumers do **not** re-render except on an
  actual switch.
- Hooks return **primitive-stable** values (a color string, a frozen style object), so a
  `React.memo` component only re-renders when the specific value it reads actually changes.

> **Provider placement.** The app root provides the **light** theme (default, `[Target]`). A4's
> `ChatProvider` wraps the chat subtree in a nested D2 provider scoped to **chat-dark** (§7). D2
> supplies the provider; A4 decides where it sits.

---

## 4. Runtime theme object

The public, **read-only** object a component may reach (via hooks). Interface-level contract:

```ts
type ColorScheme = 'dark' | 'light';

interface Theme {
  readonly id: string;                 // 'chat-dark' | 'app-light' | 'tenant-x' …
  readonly colorScheme: ColorScheme;   // drives StatusBar/nav-bar (X4 reads this)

  // THEME-DEPENDENT (resolved per theme) — the only truly theme-varying surface
  readonly color: ResolvedColor;                    // semantic name → concrete value (D1 §4)
  elevation(level: ElevationLevel): ElevationStyle; // theme+platform-resolved (D1 §7, §6)
  blur(kind: BlurKind): BlurResolution;             // platform-resolved (D1 §10, §6)

  // THEME-INDEPENDENT (mirrored for convenience; identical across all themes)
  readonly space: SpaceScale;
  readonly radius: RadiusScale;
  readonly motion: MotionTokens;   // { duration, easing } — D4 composes; reduced-motion is D4
  readonly opacity: OpacityScale;
  readonly z: ZScale;
  readonly size: SizeScale;        // icon/avatar/input/touch
  readonly type: TypeRamp;         // D3 governs usage
  readonly a11y: A11yTokens;
}
```

**Public vs internal.**
- **Public:** everything on `Theme` above — all *resolved* semantic values and the flat scales.
- **Internal (never exposed):** the D1 primitive palette, the raw semantic→primitive **map** that
  produced the theme, and the theme registry. A component MUST NOT be able to reach a primitive
  through the theme (no `theme.palette`, no `theme.raw`).
- The object is **frozen** (`Object.freeze`, deep in dev) — mutation is a bug (§11).

> The flat scales are mirrored onto `Theme` **only** so a component that already holds the theme can
> read `theme.space.xl` conveniently; the canonical path for theme-independent values is still a
> direct constant import (§1). Both resolve to the identical value; neither is a second source.

---

## 5. Theme hooks (contracts only)

Interface-level; no implementation. Hooks are the **only** component-facing access.

```ts
// Whole theme — use sparingly (e.g. a component reading many tokens). Prefer narrow hooks below.
function useTheme(): Theme;

// Narrowest, preferred for color. Returns a STABLE resolved string; re-renders only if the
// resolved value changes (i.e. on a theme switch that changes THIS token).
function useColor(token: ColorToken): string;                 // e.g. useColor('color.accent')
function useColors<T extends ColorToken[]>(...tokens: T): Record<T[number], string>;  // batch

// Theme + platform resolved depth. Returns a frozen style descriptor (shadow on light,
// border/glow on dark — D1 §7; platform branch inside, §6). Never a raw shadow literal.
function useElevation(level: ElevationLevel): ElevationStyle;

// Motion tokens (theme-INDEPENDENT). Returns D1's duration/easing scale verbatim + the OS
// reduced-motion flag for D4 to act on. D2 does NOT apply the reduced-motion policy (that is D4).
function useMotion(): { duration: DurationScale; easing: EasingScale; reduceMotion: boolean };

// Platform-resolved blur (iOS intensity vs Android/reduced-transparency solid fallback — §6).
function useBlur(kind: BlurKind): BlurResolution;

// Convenience: colorScheme for components that must branch (e.g. keyboard appearance).
function useColorScheme(): ColorScheme;
```

Contract rules:
- `useColor` MUST return a referentially usable value that changes **only** when the resolved token
  changes — so memoized consumers stay put across unrelated renders.
- `useElevation`/`useBlur` MUST return **frozen** descriptors resolved for the active theme **and**
  platform; the caller never branches on `Platform.OS` for depth/blur (§6, §11).
- `useMotion` returns tokens only; it MUST NOT collapse durations for reduced motion — it exposes the
  `reduceMotion` flag and D4 decides (keeps the D1/D4 boundary clean).
- Theme-independent scales (`space`, `radius`, `z`, `opacity`, `size`, `type`, `a11y`) have **no
  dedicated hook** — import them directly (§1). Providing hooks for constants would imply they vary.

---

## 6. Platform adaptations

Platform branching lives **inside the theme resolvers/hooks**, never in components. A component asks
for `elevation.raised` or `blur.chrome` and receives the platform-correct result.

| Concern | iOS | Android | Web (future) |
|---|---|---|---|
| **Elevation** (D1 §7) | dark → border+glow; light → `boxShadow` | dark → border+glow (same); light → `boxShadow` (NOT the `elevation` prop, which can't express our soft look) | `box-shadow` / border+glow |
| **Blur** (D1 §10) | `expo-blur` intensity token | **solid fallback** `color.bg.elevated` (blur unreliable/costly) | `backdrop-filter` |
| **Reduced transparency** (OS a11y) | blur → solid fallback | already solid | solid |
| **StatusBar** | style from `theme.colorScheme` | style from `theme.colorScheme` | n/a |
| **Navigation bar / window bg** | n/a | MUST be set to `theme.color.bg.canvas` (prevents the dark-mount white flash) | n/a |
| **Safe areas** | insets (layout, not theme) | insets | n/a |

Integration rules:
- **X4 owns applying** StatusBar/nav-bar/window background; **D2 owns exposing** the values it needs
  (`colorScheme`, `color.bg.canvas`). D2 never calls the platform APIs itself (keeps the provider
  pure — §3).
- **Blur is progressive enhancement.** `useBlur` MUST always yield a usable solid fallback so a
  screen is correct without blur (Android, reduced-transparency).
- **Safe-area insets are not theme.** The theme provides the *color behind* a safe area; the inset
  math is layout (F1/X4).

---

## 7. Scoped themes

Themes are scoped by **nesting providers**. Because components read semantic tokens, scoping changes
nothing in the tree.

```
AppRoot
└─ ThemeProvider(app-light)                    ← rest of app: light  [Target]
   ├─ (marketplace screens)                     future: ThemeProvider(marketplace) scope
   └─ ChatProvider (A4)
      └─ ThemeProvider(chat-dark)               ← chat subtree: dark  (ships)
         └─ ChatScreen … (reads semantic tokens; unaware of which theme)
```

- **Chat theme:** the chat subtree is wrapped in `chat-dark`. Scoped, so the dark surface is an
  intentional island (approved architecture) without darkening the app.
- **Future marketplace theme:** another scoped provider around marketplace screens; same components,
  different binding.
- **Light mode:** switch the chat scope's `id` to a `chat-light` map (or the app default) — a data
  change, no component edits.
- **White-label:** select a tenant theme at the root (§8 composition); the whole tree re-binds.

**Nested-scope rule:** the nearest provider wins. A component resolves against the closest
`ThemeProvider` ancestor. Scopes MUST NOT leak (a chat token never resolves against the app-light
provider).

---

## 8. Theme composition

Themes **compose**; they never copy the full map (that would duplicate D1's decisions and drift).

```ts
// A theme is a base semantic default + a sparse override of only what differs.
function createTheme(base: ThemeMap, overrides?: Partial<ThemeMap>): Theme;

const darkBase   = createTheme(SEMANTIC_DEFAULTS_DARK);          // maps every D1 §4 name → dark primitive
const chatDark   = createTheme(darkBase, { /* chat specifics, if any */ });
const lightBase  = createTheme(SEMANTIC_DEFAULTS_LIGHT);         // future: the ONLY new authoring
const tenantX    = createTheme(chatDark, { 'color.accent': PALETTE.tenant.accent });  // white-label
```

Rules (no duplication):
- A theme MUST define **every** semantic token (completeness test, §10) — but via composition from a
  base, overriding only deltas. A white-label theme overriding one accent authors **one** line.
- **Flat scales are not part of composition** — they are shared constants, identical in every theme,
  and are attached by reference (not copied).
- Composition is **build-time-pure**: `createTheme` produces a frozen object; it performs no I/O and
  is deterministic (same input → same theme), enabling caching (§9) and snapshot testing (§10).
- The primitive palette is the **only** place raw values live; every theme references primitives,
  never inlines a hex.

---

## 9. Performance

- **Stable references.** Each theme is built **once** per `id` and cached in a registry; its object
  reference is stable for the app's lifetime. `createTheme` is never called in render.
- **Minimal re-renders.**
  - Theme-independent scales bypass the provider entirely (§1) → they cause **zero** context
    re-renders, ever.
  - The context value `{ theme, setTheme }` is memoized; unchanged between switches → no consumer
    re-render on unrelated updates.
  - `useColor` returns a stable resolved string; with `React.memo` on consumers, a component
    re-renders only when the specific token it reads changes (i.e. only on a switch affecting it).
  - A theme switch (rare) costs exactly **one** re-render of the scope's consumers.
- **Memoization boundaries.** `useElevation`/`useBlur` MUST memoize their frozen descriptor by
  `(theme.id, level/kind, platform)` so repeated calls return the same reference.
- **Lazy theme loading.** Only the active theme(s) are resolved at startup. Non-active themes
  (light, tenant white-labels) are built **on first selection**, not eagerly — a multi-tenant build
  never pays for themes it doesn't show.
- **No provider in hot paths.** The streaming leaf (A4 Tier 1) reads color via `useColor` once per
  render, not per token; theme access is never on the per-token coalesced path.

---

## 10. Testing

Verifies theme *correctness* (values are D1's job; D2 tests the machinery).

- **Completeness.** Every theme resolves **every** semantic token in D1 §4 (no `undefined`); a
  contract test iterates the semantic key set against each registered theme.
- **Resolution.** `useColor('color.accent')` under `chat-dark` returns D1's shipping value
  (`#34D08C`); a table test covers a representative token set per theme.
- **Scoping.** A probe component under `ThemeProvider(chat-dark)` resolves dark; the same component
  outside resolves the app default — asserts nearest-provider-wins and no leakage (§7).
- **Reference stability.** The theme object and `useColor` outputs are referentially stable across
  re-renders with no switch (render-count/identity assertion — §9).
- **Switch isolation.** A theme switch changes only `color`/`elevation`/`blur` resolutions; a
  snapshot proves `space`/`radius`/`motion`/`z`/`size` are byte-identical across themes (mirrors
  D1's acceptance test).
- **Platform resolution.** `useElevation('raised')` on dark returns border/glow (no shadow);
  `useBlur('chrome')` on Android returns the solid fallback (mocked `Platform.OS`).
- **No primitive escape.** A deps/lint test asserts components import only the hooks / flat
  constants, never `palette.*`, a theme map, or `theme.raw` (there is no such field).
- **Freeze.** Attempting to mutate a resolved theme throws in dev (frozen-object test).
- **Contrast handoff.** The resolved `color.*` for each theme feeds X1's automated contrast check
  (D1 §16 ratios).

---

## 11. Anti-patterns (MUST NOT)

1. **Importing primitive tokens in a component** (`palette.green.400`) — semantic hooks only (§1, D1
   §20.3).
2. **Reading a theme map or `theme.raw`** — there is no raw surface; use `useColor`/`useElevation`.
3. **Mutating a theme object** — themes are frozen; a "temporary tweak" is a new composed theme (§8).
4. **Creating tokens/colors inside a component** (`const bg = '#111'` or a local palette) — compose
   from semantic tokens (D1 §20.5).
5. **Building a theme in render** (`createTheme(...)` inside a component/`useMemo`-less) — themes are
   registry-cached (§9).
6. **Providerizing flat scales** — `space`/`radius`/etc. MUST NOT be put behind context (adds
   re-render surface for invariants — §1).
7. **Branching on `Platform.OS` in a component for depth/blur/color** — platform resolution lives in
   the resolvers (§6).
8. **An over-broad context value** carrying live state (e.g. streaming) alongside the theme — the
   theme context carries **only** `{ theme, setTheme }`, both stable (§3/§9).
9. **Applying platform side effects in the provider** (StatusBar, nav bar) — that is X4; the provider
   stays pure (§3/§6).
10. **Duplicating a theme by copying the full map** instead of composing from a base (§8).

---

## 12. Acceptance criteria

Mapped to P1 / lint.

- [ ] **Semantic-only access:** deps/lint asserts `features/chat/**` reaches color/elevation/blur
      only through D2 hooks; no `palette.*` or theme-map import (D1 §21 alignment).
- [ ] **Provider purity:** the theme provider has no import of StatusBar/SystemUI/persistence; a
      static check enforces it.
- [ ] **Completeness:** every registered theme resolves every D1 §4 semantic token (contract test).
- [ ] **Reference stability:** theme object + `useColor` outputs stable across no-switch re-renders
      (identity test); a switch triggers exactly one consumer re-render (render-count test).
- [ ] **Flat-scale bypass:** a test proves `space`/`radius`/`motion`/`z`/`size` are not read from
      context and are identical across themes.
- [ ] **Platform resolution:** elevation on dark = border/glow (no shadow); blur on Android = solid
      fallback (mocked-platform tests).
- [ ] **Scoping:** nearest-provider-wins and no cross-scope leakage (probe test).
- [ ] **Freeze:** themes are immutable at runtime (dev throws on mutation).
- [ ] **Lazy loading:** non-active themes are not built until first selected (instrumentation).
- [ ] **No flash:** initial theme resolves synchronously at mount (no async theme fetch on the boot
      path).

---

## 13. Self-review

**Assumptions.**
- (a) Chat ships `chat-dark`; app default is light and provided at the root (`[Target]` — the current
  app imports `theme.ts` directly, so D2 introduces the provider layer as part of the Phase-1
  refactor).
- (b) Theme switches are **rare** (light mode, white-label), so context is an appropriate delivery
  mechanism; a Zustand-backed theme (selector-fine-grained) is the fallback **only** if a future
  feature needs frequent/live theme changes (e.g. in-app theme preview) — noted, not adopted.
- (c) X4 exists to apply platform chrome from the values D2 exposes; D2 assumes that boundary.
- (d) Flat scales are genuinely theme-invariant (D1 §1.4) — the whole "bypass lane" rests on this.

**Risks.**
- **Nested-provider scoping bugs.** A component rendered *outside* the chat scope (e.g. a shared
  primitive accidentally themed) resolves against the app-light theme, which is correct — but a
  chat-specific component leaking outside the scope would mis-resolve. Guard: chat feature components
  stay under `ChatProvider` (A4 §10 import boundary) + the scoping test (§10).
- **Two access paths for flat scales** (direct import *and* `theme.space`) could confuse
  contributors into thinking they differ. They are the same reference; documented (§4), but worth a
  lint note that prefers the direct import for invariants.
- **Elevation/blur resolver complexity.** These carry the platform + theme branch; they are the only
  non-trivial resolvers and the most likely place a platform regression hides — hence the explicit
  platform-resolution tests (§10).
- **Migration from `[Legacy]` direct imports.** Today components import `theme.ts` values directly;
  introducing the provider + hooks is a mechanical but broad change. It MUST land in the Phase-1
  behavior-neutral refactor (with the light theme mapped to today's values) so nothing shifts
  visually when the provider is introduced.

**Future extension points.**
- **Light mode / white-label:** new `createTheme` maps only (§8); no component or hook change.
- **Per-conversation or A/B themes:** the registry + `setTheme(id)` already support it; would only
  need the switch wired to a source.
- **Zustand-backed theme:** if live theme editing arrives, swap the context delivery for a
  selector-based store — the *hook contracts* (§5) stay identical, so components are unaffected.
- **CSS-variable web binding:** a web build can map the same semantic names to CSS custom properties;
  the hook layer abstracts it, so RN and web share the token vocabulary.
- **Design-token export:** because primitives + semantic maps are pure data, they can be exported to
  a Style Dictionary / Figma sync without touching the runtime.
