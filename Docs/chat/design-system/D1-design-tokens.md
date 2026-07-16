# D1 — Design Tokens

| | |
|---|---|
| **Doc ID** | D1 |
| **Layer** | Design System (root of the D-layer) |
| **Status** | Draft — awaiting review |
| **Version** | 0.1.0 |
| **Owners** | Chat Platform · Design Systems |
| **Depends on** | A2 (State), A3 (Protocol), A4 (Components) — for boundaries only |
| **Depended on by** | D2 (Theme), D3 (Typography), D4 (Motion), all F-docs, X1 (a11y) |
| **Reference implementation** | `src/constants/theme.ts` (`brand`, `lab`, green/buy scales, `spacing`, `radius`, `elevation`, `motion`) |

> **Normative language.** MUST, MUST NOT, SHOULD, SHOULD NOT, MAY per RFC 2119.
>
> **Scope boundary (no duplication).** D1 defines token **values and structure** — the tiers and
> every scale, including raw motion durations/easings. It does **not** define: the resolution
> mechanism / provider (→ **D2**), motion choreography or the reduced-motion policy (→ **D4**),
> the type ramp usage rules (→ **D3**), or any component behavior (→ A4/F-docs). D1 is data; the
> D-siblings are the machinery that consumes it.

---

## 1. Token philosophy

1. **Three tiers, one direction of reference.** `primitive → semantic → theme`. Primitives are raw
   values with no meaning. Semantic tokens are role names. Themes map semantic → primitive. Reference
   flows one way only; a component reads **semantic** tokens exclusively.
2. **Single source of truth.** Every visual value originates in exactly one token. There are no
   literal colors, spacings, radii, durations, or z-indexes anywhere else (A4 §12 anti-patterns are
   the enforcement).
3. **Semantic over raw in consumers.** Components MUST NOT reference primitives (`palette.green.400`)
   or theme maps directly — only semantic tokens (`color.accent`). This is what lets a theme swap
   change zero component code.
4. **Theme-independent scales stay flat.** Spacing, radius, motion, z-index, icon/avatar/input sizes,
   and opacity are **not** per-theme — they are constants shared by all themes. Only *color* (and
   *elevation*, which degrades to color on dark) varies per theme.
5. **No magic numbers.** A number that affects layout, timing, or depth MUST be a named token. A
   number is allowed inline only when it is intrinsically local and meaningless elsewhere (e.g. a
   `flex: 1`), and even then SHOULD be justified.
6. **Additive evolution.** New tokens are added; existing token *values* change only via a versioned
   token release. Renames are breaking and require a migration note.

---

## 2. Token tiers

```
Tier 1  PRIMITIVES   palette.green.400 = #34D08C     (raw; no meaning; never used by components)
                     space.5 = 20 · radius.md = 12 · dur.base = 250 · z.overlay = 40
          │  mapped per theme
          ▼
Tier 2  SEMANTIC     color.accent · color.bg.canvas · color.text.primary · elevation.raised
                     (role names; the ONLY vocabulary components use)
          │  a theme binds semantic → primitive
          ▼
Tier 3  THEME        chatDarkTheme = { color.accent → palette.green.400, ... }
                     lightTheme    = { color.accent → palette.green.700, ... }   (future; D2)
```

- **Primitives** live in one module and are frozen constants.
- **Semantic tokens** are the public surface. D2 defines how a component resolves them (provider);
  D1 defines their *names* and their *dark-theme values* (the shipping theme).
- **Themes** are plain data maps. Adding light mode = one new map (§17), no token additions, no
  component change.

The token object shape (contract; not implementation):

```ts
interface Tokens {
  color: SemanticColor;        // theme-dependent (resolved by D2)
  space: SpaceScale;           // flat
  radius: RadiusScale;         // flat
  elevation: ElevationScale;   // semantic; degrades to color on dark (§7)
  motion: { duration: DurationScale; easing: EasingScale };  // flat (D4 composes)
  blur: BlurScale;             // flat
  opacity: OpacityScale;       // flat
  z: ZScale;                   // flat
  size: { icon: IconScale; avatar: AvatarScale; input: InputScale; touch: number };  // flat
  a11y: A11yTokens;            // flat
}
```

---

## 3. Color system (Tier 1 — primitives)

Raw palettes, grounded in the app's existing hues (`theme.ts`). **Components never touch these.**

**Brand green** (the identity accent; `greenLight/medium/dark/darkest` today):
| Token | Hex | Origin |
|---|---|---|
| `palette.green.300` | `#6EE7B7` | tint |
| `palette.green.400` | `#34D08C` | `greenLight` — dark-canvas accent |
| `palette.green.500` | `#16A35A` | `greenMedium` — success/pressed |
| `palette.green.600` | `#16794A` | `greenDark` — rings/state |
| `palette.green.800` | `#0E3B2E` | `greenDarkest` — deep brand |
| `palette.green.900` | `#14452F` | `brand.primary` — deep forest |

**Forest-black canvas** (dark surface ramp; new, for the chat dark theme):
| Token | Hex | Role hint |
|---|---|---|
| `palette.forest.950` | `#0A0F0D` | canvas |
| `palette.forest.900` | `#111A15` | raised surface |
| `palette.forest.850` | `#16211B` | alt surface / user bubble |
| `palette.forest.800` | `#1E2A23` | hover/pressed surface |

**Neutral / ink** (text + light-theme surfaces; from `theme.ts` neutral + lab):
`palette.neutral.{0:#FFFFFF, 50:#F9FAFB, 100:#F3F4F6, 200:#E5E7EB, 400:#9CA3AF, 500:#6B7280, 700:#374151, 900:#111827}`,
plus dark inks `palette.ink.{primary:#F1F5F2, secondary:#B4C0B8, muted:#8A988F}`.

**Buy/demand accent** (marketplace buyer surfaces): `palette.blue.500 = #2563EB` (`buyBlue`),
`palette.blue.400 = #3B82F6`.

**Status:** `palette.status.{success:#16A35A, warning:#F59E0B, danger:#DC2626, info:#2563EB}`.

**Alpha primitives** (for borders/glow/scrim on dark, where opaque hues fail):
`palette.alpha.white.{08:rgba(255,255,255,.08), 14:rgba(255,255,255,.14)}`,
`palette.alpha.green.{18:rgba(52,208,140,.18)}`, `palette.alpha.black.{40:rgba(0,0,0,.4)}`.

> Primitive ramps are intentionally broader than today's use so future themes/surfaces draw from the
> same well rather than adding one-off hexes.

---

## 4. Semantic color tokens (Tier 2)

The **only** color vocabulary components use. Values shown are the **chat dark theme** (shipping).
Light-theme values are a future map (§17) — the *names* do not change.

| Semantic token | Dark value (primitive) | Purpose |
|---|---|---|
| `color.bg.canvas` | `forest.950` | Chat background. |
| `color.bg.elevated` | `forest.900` | Sheets, elevated panels. |
| `color.surface.raised` | `forest.900` | Input field, code block. |
| `color.surface.alt` | `forest.850` | User bubble, pressed rows. |
| `color.surface.hover` | `forest.800` | Pressed/hover state. |
| `color.text.primary` | `ink.primary` | Body / AI prose. |
| `color.text.secondary` | `ink.secondary` | Supporting text. |
| `color.text.muted` | `ink.muted` | Captions, timestamps, eyebrows. |
| `color.text.onAccent` | `neutral.0` | Text on an accent fill. |
| `color.accent` | `green.400` | CTAs, links, cursor, active. |
| `color.accent.pressed` | `green.500` | Pressed accent. |
| `color.border.subtle` | `alpha.white.08` | Hairlines on dark. |
| `color.border.strong` | `alpha.white.14` | Emphasized separators. |
| `color.glow` | `alpha.green.18` | Response glow, focus ring. |
| `color.scrim` | `alpha.black.40` | Modal/sheet backdrop. |
| `color.status.success` | `status.success` | Success. |
| `color.status.warning` | `status.warning` | Warnings (non-blocking A3 `warning`). |
| `color.status.danger` | `status.danger` | Errors (`failed`/`interrupted` A2). |
| `color.status.info` | `status.info` | Info. |
| `color.mode.buy` | `blue.500` | Buyer-mode marketplace accent. |
| `color.mode.sell` | `green.800` | Seller-mode accent. |

**Notes.** `color.accent` is the single interactive green (send, links, cursor). Mode accents
(`color.mode.*`) are for marketplace/mode signaling only, not general interactivity — this keeps the
dark surface from becoming a two-accent (green+blue) mess. Every color a component uses maps to a row
here; there is no other color surface.

---

## 5. Typography tokens

D1 owns the **type ramp values**; D3 owns *usage rules* (which role goes where, CJK/Dynamic-Type
policy). Fonts are the app's existing families — **Inter is primary** (Google Sans is proprietary and
MUST NOT be added — §18).

**Families** (`palette`→`font`): `font.sans` (Inter), `font.mono` (JetBrains Mono),
`font.display` (Hanken Grotesk, headings only).

**Weights:** `weight.regular 400 · weight.medium 500 · weight.semibold 600` (no heavy bold in prose).

**Ramp** (size / lineHeight / tracking) — the chat-tuned scale, superseding the tighter legacy
`typography` in `theme.ts` for chat surfaces:

| Token | Size | Line | Tracking | Role hint |
|---|---|---|---|---|
| `type.caption` | 13 | 16 | 0 | timestamps, meta |
| `type.footnote` | 14 | 20 | 0 | secondary |
| `type.body` | 17 | 32 | −0.2 | **AI prose / messages** |
| `type.bodyTight` | 17 | 26 | −0.2 | user bubble |
| `type.title` | 22 | 30 | −0.3 | markdown headings |
| `type.display` | 28 | 34 | −0.3 | empty-state hero |
| `type.eyebrow` | 11 | 14 | +1.2 | labels, sources |
| `type.mono` | 14 | 20 | 0 | code |

> The 17/32/−0.2 body ramp is the single biggest perceived-quality lever (F-layer) and is fixed here
> so every surface uses the same values. D3 refines CJK line-height and Dynamic-Type scaling.

---

## 6. Spacing scale

Reuse the app's 4pt-based scale (`theme.ts spacing`) verbatim — do not invent a parallel scale.

`space.xs 4 · space.sm 8 · space.md 12 · space.lg 16 · space.xl 20 · space.2xl 24 · space.3xl 32 · space.4xl 40 · space.5xl 56 · space.6xl 72`

Rules: all padding/margin/gap MUST come from this scale. The chat thread's horizontal padding and
inter-message gap are `space.xl` (20) per the F-layer; defined once here, referenced there.

## 7. Radius scale + elevation/shadow

**Radius** (reuse `theme.ts radius`, add `xs` for brand-sharp accents):
`radius.xs 4 · radius.sm 8 · radius.md 12 · radius.lg 16 · radius.xl 20 · radius.2xl 24 · radius.full 9999`

Semantic radius roles: `radius.bubble.user = radius.full` (pill), `radius.surface = radius.md`,
`radius.code = radius.md`, `radius.chip = radius.full`. `borderCurve: 'continuous'` is the default for
non-pill rounded corners (Apple HIG; A4/F-layer applies it).

**Elevation (semantic; the dark-mode fix).** Shadows are nearly invisible on `color.bg.canvas`, so
elevation is a **semantic** token that resolves differently per theme:

| `elevation.*` | Light theme (future) | **Dark theme (shipping)** |
|---|---|---|
| `elevation.flat` | no shadow | no border, no glow |
| `elevation.raised` | soft shadow (`theme.ts sm`) | `color.border.subtle` 1px |
| `elevation.overlay` | shadow `md` | `color.border.strong` + faint `color.glow` |
| `elevation.modal` | shadow `lg` | `color.border.strong` + `color.scrim` behind |

This is why `elevation` sits in the theme-dependent set: on dark, depth is expressed with borders and
glow, not drop shadows. Components ask for `elevation.raised` and get the right treatment per theme.

## 8. Motion — duration tokens

Canonical scale (resolves the plane.md 150/250/400/600 vs legacy `theme.ts` 220/280/360 conflict).
**This scale is authoritative**; the legacy `motion` durations in `theme.ts` are deprecated for chat.

| Token | ms | Use hint (D4 composes) |
|---|---|---|
| `dur.instant` | 0 | reduced-motion target |
| `dur.fast` | 150 | micro (button, chip, crossfade) |
| `dur.base` | 250 | standard enter/exit |
| `dur.slow` | 400 | large transitions |
| `dur.ambient` | 600 | background glow, ambient |
| `dur.blink` | 530 | cursor blink half-cycle (classic terminal cadence) |

> Streaming reveal cadence (~30–60 fps coalesced) is **not** a motion token — it is a state/perf
> concern owned by A2 §15.3 / X3, not D1.

## 9. Motion — easing tokens

Bezier curves; D4 maps them to choreography. Never bounce/overshoot (plane.md motion principles).

| Token | Curve | Use |
|---|---|---|
| `ease.standard` | `cubic-bezier(0.2, 0, 0, 1)` | most transitions |
| `ease.decelerate` | `cubic-bezier(0, 0, 0, 1)` | enters (ease-out) |
| `ease.accelerate` | `cubic-bezier(0.3, 0, 1, 1)` | exits |
| `ease.emphasized` | `cubic-bezier(0.2, 0, 0, 1)` (long) | hero/first-response |
| `ease.linear` | `linear` | glow opacity, blink |

## 10. Blur tokens

For iOS glass/`expo-blur` chrome (optional; Android falls back to a solid `color.bg.elevated`).

| Token | Intensity | Use |
|---|---|---|
| `blur.none` | 0 | default |
| `blur.chrome` | 20 | header/composer glass (iOS) |
| `blur.modal` | 40 | sheet backdrop (iOS) |

Rule: blur is progressive enhancement; a token consumer MUST provide a solid-color fallback for
platforms/reduced-transparency (X1).

## 11. Opacity tokens

Replaces magic numbers like the current `0.45` disabled send button.

| Token | Value | Use |
|---|---|---|
| `opacity.disabled` | 0.40 | disabled controls |
| `opacity.pressed` | 0.70 | pressed feedback |
| `opacity.ghost` | 0.60 | subtle/secondary icons |
| `opacity.scrimVeil` | 0.40 | (paired with `color.scrim`) |
| `opacity.full` | 1 | default |

## 12. Z-index / layer tokens

Maps to A4's layers (BackgroundLayer behind content; pill above list; sheets; toasts).

| Token | Value | Layer |
|---|---|---|
| `z.background` | −1 | `BackgroundLayer` glow (behind thread) |
| `z.base` | 0 | thread content |
| `z.sticky` | 10 | header, composer |
| `z.overlay` | 40 | `ScrollToLatestPill`, floating affordances |
| `z.sheet` | 60 | bottom sheets (edit, pickers) |
| `z.toast` | 80 | notifications |
| `z.modal` | 100 | fullscreen (image viewer) |

Rule: stacking order MUST come from this scale; no ad-hoc `zIndex` literals.

## 13. Icon sizing tokens

| Token | px | Use |
|---|---|---|
| `size.icon.xs` | 14 | inline, dense |
| `size.icon.sm` | 16 | captions, chips |
| `size.icon.md` | 20 | **action row, composer** (A4 "no large icons") |
| `size.icon.lg` | 24 | header back, primary |

Touch targets are independent of icon size (§16): a 20px icon still sits in a ≥48px target via
`hitSlop`/padding.

## 14. Avatar sizing tokens

For AI/user avatars (header, future multi-agent, message attribution).

| Token | px | Use |
|---|---|---|
| `size.avatar.sm` | 24 | inline attribution |
| `size.avatar.md` | 32 | header |
| `size.avatar.lg` | 44 | empty-state / profile |

## 15. Input sizing tokens

| Token | value | Use |
|---|---|---|
| `size.input.min` | 44 | composer min height (≥ iOS 44) |
| `size.input.max` | 120 | multiline cap before internal scroll |
| `size.input.button` | 44 | send/voice/stop circular button |
| `size.input.util` | 44 | attachment buttons |

## 16. Accessibility tokens

Consumed by X1; defined here so a11y values are not magic numbers either.

| Token | Value | Meaning |
|---|---|---|
| `a11y.touch.min` | 48 | min touch target (cross-safe: > iOS 44, ≥ Android 48) |
| `a11y.hitSlop` | 8 | default hit-slop to reach `touch.min` from smaller visuals |
| `a11y.contrast.text` | 4.5 | min ratio, body text (WCAG AA) |
| `a11y.contrast.large` | 3.0 | min ratio, ≥18pt/large or icons |
| `a11y.focusRing` | `color.glow` + 2px | keyboard/focus indicator |
| `a11y.fontScale.max` | 1.3 | layout must survive at least this Dynamic-Type scale |

**Verified (approximate, dark theme; X1 confirms):** `text.primary` on `bg.canvas` ≈ 15:1;
`text.muted` on `bg.canvas` ≈ 6.4:1 (AA pass); `accent` on `bg.canvas` ≈ 9.7:1 (AA/AAA — safe for
text and icons). All meet `a11y.contrast.text`.

## 17. Dark theme strategy

- **Dark is the shipping theme for the chat surface** (scoped to chat per the approved architecture;
  the rest of the app stays light). Semantic color + elevation tokens resolve to their dark values
  now.
- **Light mode is a future map, not a rewrite.** Because components use only semantic tokens, adding
  light mode = authoring `lightTheme` (semantic → light primitives) in D2. **Zero component changes,
  zero new semantic tokens.** The light column in §7 (elevation) is the placeholder for that map.
- **Elevation degrades to color on dark** (§7): depth via borders + glow, never drop shadows.
- **Only color + elevation are theme-dependent.** All other scales are shared, so a theme swap can
  never shift spacing/motion/z-order (prevents theme-specific layout drift).

## 18. Brand adaptation strategy (Gemini feel, GreenBidz identity)

The chat borrows Gemini's *feel* (dark, calm, spacious) but its *identity is GreenBidz*. Tokens encode
that intentionally:

- **Accent is brand green, never Gemini blue.** `color.accent = palette.green.400 (#34D08C)`; the
  spec's `#5C7CFA` is explicitly rejected.
- **Canvas is forest-tinted black, not pure OLED.** `palette.forest.950 (#0A0F0D)` carries a green
  undertone — brand identity even in the dark.
- **Glow is green** (`color.glow = alpha.green.18`), not navy/purple.
- **Type is Inter** (Google Sans is proprietary — MUST NOT ship). D3 applies the ramp.
- **Radius carries brand** via `radius.xs (4)` for sharp accents alongside the pill user bubble —
  matching the marketplace's sharp-radius identity while keeping the Gemini pill for user turns.
- **Mode accents** (`color.mode.buy/sell`) preserve the marketplace's buyer-blue / seller-green
  language for card/mode signaling without polluting the single interactive accent.

Result: a surface that reads as premium-dark *and* unmistakably GreenBidz. The brand lives in the
token *values*; the structure is theme-agnostic, so a future all-brand-light or a partner white-label
is a new theme map, not a redesign.

## 19. Token naming conventions

- **Path form:** `namespace.category.role[.variant]`, dot-delimited in docs, nested objects in code.
  e.g. `color.text.primary`, `space.xl`, `motion.duration.base`, `size.icon.md`.
- **Primitives are named by value/scale** (`palette.green.400`, `space.5`), **never by role**.
  **Semantics are named by role** (`color.accent`), **never by value** (no `color.green`).
- **camelCase** for multi-word keys (`bg.elevated`, `border.subtle`). No abbreviations except the
  established `bg`.
- **Scales use t-shirt or numeric sizing** consistently within a scale (`xs/sm/md/lg/xl/2xl…` for
  spacing/radius/icons; numeric ms for durations).
- **No component names in tokens.** A token is `color.surface.raised`, never `color.codeBlockBg`.
  Component-specific composition happens in the component using semantic tokens, not by minting a
  bespoke token.
- **Deprecations** are marked `@deprecated → replacement` and removed on a version bump, never
  silently repurposed.

## 20. Anti-patterns (MUST NOT)

1. **Hardcoded hex / rgba in a component.** Every color comes from a semantic token.
2. **Hardcoded spacing / radius / duration / zIndex literals.** All from a scale.
3. **Consuming primitives or theme maps in components** (`palette.*`, `chatDarkTheme.*`). Semantic
   only (§1.3).
4. **Value-named semantic tokens** (`color.green`, `color.darkBg`). Role-named only (§19).
5. **Component-specific one-off tokens** (`color.sendButtonBg`). Compose from roles instead (§19).
6. **Hardcoding dark values** so light mode later needs component edits. Go through semantic (§17).
7. **Animating with raw ms / inline beziers.** Use `motion.duration.*` / `ease.*` (D4 composes).
8. **Per-theme spacing/motion/z drift.** Those scales are theme-independent (§1.4).
9. **Duplicating a value across tokens** (two names, same purpose). One role, one token.
10. **Bypassing `a11y.touch.min`** with a smaller tappable and no `hitSlop`.

## 21. Acceptance criteria

Mapped to P1 / lint.

- [ ] **No literals in components:** a lint rule (color/number) asserts no hex, rgba, or raw
      spacing/radius/duration/zIndex in `features/chat/components/**` and `renderers/**`.
- [ ] **Semantic-only consumption:** a deps/lint rule asserts components import from the semantic
      token surface, never `palette.*` or a theme map.
- [ ] **Single source:** every value in §§3–16 exists once; a test asserts no duplicate
      value-with-two-names within a scale.
- [ ] **Theme swap is data-only:** swapping the active theme changes only `color.*` and `elevation.*`
      resolution; a snapshot proves spacing/motion/z/size are identical across themes.
- [ ] **Contrast:** `text.primary`, `text.muted`, and `accent` on `bg.canvas` meet
      `a11y.contrast.text`/`large` (automated contrast check — X1).
- [ ] **Motion canonicalization:** no chat animation references the legacy `theme.ts motion`
      durations; all use `motion.duration.*`.
- [ ] **Touch targets:** every interactive token consumer resolves to ≥ `a11y.touch.min` (audit).
- [ ] **Naming:** a schema test asserts primitives are value-named and semantics are role-named.

## 22. Self-review

**Assumptions.** (a) Inter/JetBrains/Hanken are already bundled (they are, per `theme.ts`). (b) The
chat ships dark; light is deferred but designed-for. (c) Reusing the app's `spacing`/`radius` scales
is preferable to a fresh numeric scale (less churn, one system) — accepted trade-off vs. a "cleaner"
0–N scale. (d) D2 will implement resolution; D1's semantic values are inert until then.

**Risks.**
- **Two motion scales during migration.** D1 canonicalizes 150/250/400/600, but `theme.ts motion`
  (220/280/360) still exists app-wide. Until non-chat surfaces migrate, both live; the acceptance
  test scopes enforcement to chat to avoid a false app-wide failure. Reconciling app-wide is an open
  question (below), not a D1 blocker.
- **Elevation-as-color on dark** is the most novel decision; if a component author expects a literal
  shadow, they'll get a border/glow. This is intended and documented, but is a mindset shift worth
  calling out in D2/onboarding.
- **Primitive ramp breadth.** I defined more primitive stops than are used today (forest ramp, alpha
  set). Slight over-provisioning, deliberately, so future surfaces don't add one-off hexes — but it
  must not tempt components to reach for primitives (guarded by §20.3 lint).

**Complexity hotspots.** The `color` semantic set (§4) is where future themes and marketplace
surfaces will pressure the model; keeping mode accents (`color.mode.*`) separate from `color.accent`
is the decision that most affects whether the dark surface stays visually disciplined.

**Future-proofing confidence.** The load-bearing decisions are **semantic-only consumption** (§1.3)
and **only color+elevation are theme-dependent** (§1.4/§17). Together they guarantee light mode,
marketplace theming, and white-label are new theme maps — not redesigns — which is exactly the
five-year requirement.

**Open questions (for review).**
1. **App-wide motion reconciliation.** Migrate the whole app to the D1 duration scale, or keep chat
   canonical and leave legacy `theme.ts motion` for non-chat surfaces? (Recommend: chat canonical
   now; app-wide migration as a separate, later token release.)
2. **Radius identity.** Confirm the pill user-bubble (Gemini) + `radius.xs 4` brand-sharp accent
   combination reads as GreenBidz, or should the user bubble also be sharp? (Recommend pill for the
   user bubble — it's the one Gemini cue worth keeping — sharp elsewhere.)
3. **Numeric vs named spacing.** Keep the app's `xs…6xl` names (chosen) or introduce a numeric
   `space.1..12`? (Recommend keep names — one system, no churn.)
