# D3 — Typography System

| | |
|---|---|
| **Doc ID** | D3 |
| **Layer** | Design System |
| **Status** | Draft — awaiting review |
| **Version** | 0.1.0 |
| **Owners** | Chat Platform · Design Systems |
| **Depends on** | **D1 (Design Tokens)** — type ramp; **D2 (Theme)** — color/motion access |
| **Depended on by** | F2 (messages), F3 (streaming), F4 (markdown/code), F8 (empty state), X1 (a11y), X2 (i18n/RTL) |
| **Reference implementation** | `chat/ChatMessage.tsx` `MarkdownLite` (`[Legacy]` — to `renderers/markdown`) |

> **Normative language.** MUST, MUST NOT, SHOULD, SHOULD NOT, MAY per RFC 2119.
>
> **Scope boundary (no duplication).** D3 defines **how typography is used** — text roles, their
> mapping to D1's ramp, paragraph rhythm, markdown/streaming typography, a11y/i18n/perf rules. It
> **does not** define type *values* (→ **D1 §5**), color *values or resolution* (→ **D1/D2**; D3
> names color **semantic tokens** only), motion/cursor *animation* (→ **D4/F3**; D3 defines only the
> cursor's typographic metrics), or component behavior (→ A4/F-docs).

---

## 1. Typography philosophy

1. **Readability first.** The chat is a reading surface; prose legibility outranks density or
   cleverness. The `type.body` ramp (17/32/−0.2, D1 §5) is the anchor — the single biggest
   perceived-quality lever — and every other role is calibrated around it.
2. **Hierarchy by role, not by ad-hoc size.** Emphasis and structure come from a **fixed set of
   roles** (§2), each bound to a D1 ramp token. Contributors pick a role, never a font size.
3. **Vertical rhythm.** Consistent line-height and paragraph spacing (§4), drawn from D1's `space`
   scale, give the surface a calm, article-like cadence. Rhythm values are shared, not per-component.
4. **Consistency.** The same role renders identically everywhere (committed message, streaming
   message, card, empty state). One role → one typographic result.
5. **Accessibility is intrinsic.** Dynamic Type, screen-reader semantics, and contrast are properties
   of a role, not afterthoughts (§7). A role that can't scale or can't be read isn't a valid role.

---

## 2. Text roles

The **complete, closed set** of text roles. A component picks a role; it never sets font properties
directly. Color is named as a D2 semantic token (resolved by `useColor`), never a value.

| Role | D1 ramp | Weight | Family | Default color token | Used for |
|---|---|---|---|---|---|
| `display` | `type.display` | semibold | `font.display` | `color.text.primary` | Empty-state hero, big moments |
| `title` | `type.title` | semibold | `font.display` | `color.text.primary` | Screen/section titles (chrome) |
| `heading` | `type.title` | semibold | `font.sans` | `color.text.primary` | In-prose markdown headings (reading cohesion) |
| `body` | `type.body` | regular | `font.sans` | `color.text.primary` | **AI prose, primary reading** |
| `bodyEmphasis` | `type.body` | semibold | `font.sans` | `color.text.primary` | `**bold**` inline emphasis |
| `bodyTight` | `type.bodyTight` | regular | `font.sans` | `color.text.primary` | User bubble (tighter leading) |
| `caption` | `type.caption` | medium | `font.sans` | `color.text.muted` | Small labels |
| `metadata` | `type.caption` | regular | `font.sans` | `color.text.muted` | Secondary meta |
| `timestamp` | `type.caption` | regular | `font.sans` (tabular-nums) | `color.text.muted` | Times/counters |
| `eyebrow` | `type.eyebrow` | medium | `font.sans` | `color.text.muted` | All-caps labels |
| `source` | `type.eyebrow`/`type.caption` | medium | `font.sans` | `color.text.muted` | Sources strip (label / chip) |
| `link` | inherits body | inherits | inherits | `color.accent` (underline) | Inline links |
| `codeInline` | body size, `font.mono` | regular | `font.mono` | `color.text.primary` on `color.surface.raised` | Inline `` `code` `` |
| `codeBlock` | `type.mono` | regular | `font.mono` | `color.text.primary` on `color.surface.raised` | Fenced code |
| `button` | `type.footnote` | semibold | `font.sans` | contextual (`color.text.onAccent` / `color.accent`) | Button labels |
| `input` | `type.body` | regular | `font.sans` | `color.text.primary`; placeholder `color.text.muted` | Composer input |

Rules:
- The set is **closed**. A new role requires a D3 revision; a new *value* requires a D1 revision. A
  contributor MUST NOT satisfy a need by inlining a size/weight.
- **`codeInline`** composes existing tokens (mono family at body size) — it is a *composition*, not a
  new value, so it stays legible inline with prose. **`codeBlock`** uses the smaller `type.mono`.
- **Family split:** `font.display` is reserved for chrome `display`/`title`; in-prose markdown
  headings use `font.sans` semibold so a heading inside a paragraph doesn't switch typefaces mid-read.

## 3. Mapping

The §2 table **is** the mapping — every role resolves to a D1 §5 ramp token (`type.*`), a D1 weight,
a D1 font family, and a D2 color token. No role introduces a size, line-height, tracking, or hex.
The role registry is the single lookup (contract, not implementation):

```ts
type TextRole =
  | 'display' | 'title' | 'heading' | 'body' | 'bodyEmphasis' | 'bodyTight'
  | 'caption' | 'metadata' | 'timestamp' | 'eyebrow' | 'source' | 'link'
  | 'codeInline' | 'codeBlock' | 'button' | 'input';

interface RoleSpec {
  ramp: keyof TypeRamp;          // D1 §5 token — never a raw size
  weight: keyof WeightScale;     // D1 weight token
  family: keyof FontFamilies;    // D1 font token
  color: ColorToken;             // D2 semantic token (resolved via useColor)
  features?: ('tabular-nums')[]; // typographic feature flags
}
// ROLE_SPECS: Record<TextRole, RoleSpec>   — the closed registry; the ONLY place roles are defined.
```

## 4. Paragraph rhythm

All spacing from D1's `space` scale; all line-height from the ramp. No new values.

| Rhythm | Value (D1 token) | Notes |
|---|---|---|
| Body line-height | `type.body.line` (32) | Fixed → streaming grows downward only (§6, §9). |
| Paragraph spacing | `space.2xl` (24) | Between block-level paragraphs (the F-layer's "24"). |
| Heading top / bottom | `space.xl` / `space.sm` | Air above a heading, tight to its content below. |
| List item gap | `space.xs` (4) intra-item, `space.sm` (8) between items | Marker baseline-aligns to `type.body`. |
| List indent | `space.lg` (16) | Hanging indent so wrapped lines align under text, not the marker. |
| Block quote | padding-left `space.lg`, vertical `space.sm` | Left rule uses `color.border.strong`; text `color.text.secondary`. |
| Code block | padding `space.md`, vertical margin `space.sm` | On `color.surface.raised`, `radius.code`. |
| Inline code padding | horizontal `space.xs` | Subtle pill on `color.surface.raised`; must not increase line box height. |

Rule: rhythm is defined **once** here; F2/F4 reference these, never re-pick spacing.

## 5. Markdown typography

Each markdown node maps to a role (§2) + rhythm (§4). No node introduces a value.

| Node | Role | Rhythm / notes |
|---|---|---|
| `# h1` | `heading` (`type.title`) | top `space.xl`, bottom `space.sm` |
| `## h2` | `bodyEmphasis` (semibold body) | slightly more top air (`space.lg`) |
| `### h3` | `eyebrow` (caps) or semibold body | subsection marker |
| paragraph | `body` | `space.2xl` between paragraphs |
| bullet list | `body` + list rhythm | marker `color.text.muted`; hanging indent (§4) |
| numbered list | `body` + list rhythm | numerals tabular; hanging indent |
| block quote | `body`/`bodyTight`, `color.text.secondary` | left rule `color.border.strong` (§4) |
| table | `metadata`/`codeBlock` fallback | see note below |
| inline code | `codeInline` | mono @ body size on `color.surface.raised` |
| fenced code | `codeBlock` | mono @ `type.mono`; language badge = `eyebrow`; horizontal scroll (F4) |
| link | `link` | `color.accent`, underline, tappable |
| image | — | prose image markdown is stripped (F4); rendered images are not text |

> **Heading depth vs. token supply.** D1 supplies `type.display`/`type.title` plus body/eyebrow.
> Markdown headings deeper than h1 reuse **weight/caps** differentiation on existing ramp tokens
> rather than inventing sizes. If a genuine multi-level heading hierarchy becomes common, that is a
> **D1 token addition**, not a D3 invention.
>
> **Tables** are low-frequency in chat; until F4 ships a real table renderer, a table degrades to a
> horizontally-scrollable monospaced block (`codeBlock` rhythm) — legible, never layout-breaking.

## 6. Streaming typography

Typographic rules for the live message (animation timing is D4/F3; D3 owns the *type* behavior).

- **Cursor (metrics only).** The caret is an inline glyph occupying **zero reflow width** — it MUST
  NOT shift the baseline or push text. It inherits the current line's `type.body` metrics; its color
  is `color.accent`; its blink is D4's concern. It renders only during streaming and is
  `accessibilityElementsHidden` (decorative).
- **Reveal at safe boundaries.** Text is revealed at **word/grapheme-cluster boundaries**, never mid
  cluster — so combining marks, emoji ZWJ sequences, and CJK characters never flash half-formed. (The
  reveal *mechanism* is F3; D3 mandates the boundary constraint.)
- **Wrapping.** Latin wraps on whitespace (no mid-word break); CJK wraps between characters per the
  script's line-break rules. `numberOfLines` is **never** set on streaming prose (no truncation).
- **Reflow stability.** Line-height is **fixed** (§4), so appended text grows the block **downward
  only**; already-revealed lines MUST NOT reflow or re-measure as more text arrives (§9).
- **Selection.** RN text selection does **not** cross `View` boundaries in the markdown tree, so
  reliable free selection of AI prose is **not** guaranteed. The sanctioned path is copy via the
  action row (A4 ActionRow / F6). D3 records this as a **known limitation**, not a bug to chase.
- **Interruption.** `interrupted`/`stopped` partial text keeps identical typographic treatment to
  complete text — the outcome is signaled by a separate badge (F2), never by restyling the prose
  (which would imply the text itself is different/less valid).

## 7. Accessibility

- **Dynamic Type.** `allowFontScaling` stays **on** (default). Roles scale proportionally; line-height
  scales with size (define line-height as a multiple where the platform supports it, else scale
  numerically). Layout MUST survive `a11y.fontScale.max` (D1 §16 = 1.3) without clipping.
- **Large fonts.** Prose containers grow with text; no fixed-height text boxes on `body`/`heading`;
  `bodyTight` (user bubble) expands vertically, never truncates.
- **Screen readers.** Reading order follows visual order. Markdown headings expose
  `accessibilityRole="header"`; links `accessibilityRole="link"`; code blocks carry an
  `accessibilityLabel` (e.g. "code block, <language>"). Decorative type (cursor, thinking dots) is
  hidden from the reader.
- **Contrast interaction.** Every role's default color token meets D1 §16 (`text` 4.5:1, `large`
  3.0:1) on `color.bg.canvas` — verified in D1 (`text.muted` ≈ 6.4:1). A role MUST NOT be re-colored
  to a token that fails its size class.
- **Localization pressure.** Text expansion (German, Thai) MUST NOT be clipped; never constrain a
  label to a width that assumes English length.

## 8. Internationalization

- **CJK (zh-Hant/zh-Hans/ja).** **Negative tracking is Latin-only** — it MUST be disabled for CJK
  runs (tight tracking harms CJK legibility). CJK line-height MUST be ≥ Latin; verify `type.body`
  (32 on 17) has no clipping in zh-Hant/ja and bump per-locale if a tall glyph clips. Line-break
  between characters (no whitespace dependency).
- **RTL (Arabic/Hebrew — future, X2-owned).** D3's type rules: use **logical alignment** (`start`/
  `end`, `writingDirection`), never hardcoded `left`/`right`; bubbles and list markers mirror; the
  cursor sits at the logical end. D3 sets the type constraints; X2 owns the RTL rollout decision.
- **Emoji.** Emoji use the system emoji font (never `font.mono`/tracking); line-height MUST
  accommodate emoji ascent so an emoji line isn't clipped. Emoji ZWJ sequences are single clusters
  for reveal (§6).
- **Mixed-language paragraphs.** A paragraph may mix Latin + CJK + emoji. The font **fallback chain**
  (below) resolves missing glyphs per-run; a Latin-only face MUST NOT be forced onto CJK text.
- **Fallback fonts.** Policy (not a new token): `font.sans` (Inter) for Latin → **system CJK
  fallback** (PingFang/Hiragino on iOS, Noto/system on Android) → system default. The chain is a
  platform rendering rule; D3 mandates that CJK/emoji always have a working fallback and are never
  boxed by a Latin-only family.

## 9. Performance

- **Markdown parse caching.** Parsing is memoized by `(messageId, textLength)` (A2 §15.4). D3's
  reason: re-parsing + re-measuring prose is the dominant text cost; committed messages parse once,
  the streaming message re-parses only on the coalesced tick (A2 §15.3).
- **No measurement loops.** Typography MUST NOT drive layout via `onLayout` text measurement in a
  loop; fixed line-height (§4) makes text height predictable without measuring.
- **Platform wrapping.** Let the platform wrap text; no manual width math or character counting to
  break lines (breaks i18n and reflow stability).
- **Layout stability.** Fixed line-height ⇒ downward-only growth (§6). Fonts MUST be loaded before
  first chat paint (or use a metrics-compatible fallback) to avoid FOUT/late-font layout shift.
- **Tabular numerals** on `timestamp` prevent width j/reflow as counters tick.

## 10. Anti-patterns (MUST NOT)

1. **Hardcoded `fontSize`/`lineHeight`/`fontFamily`/`letterSpacing` in a component** — pick a role
   (§2); the role owns all four.
2. **Inventing a type value** to hit a look — new sizes are D1 revisions, new roles are D3 revisions.
3. **Negative tracking on CJK** (§8) — Latin-only.
4. **Disabling `allowFontScaling`** to "fix" a layout — fix the layout, not the accessibility (§7).
5. **Per-component font styles** duplicating a role — reuse the role.
6. **`font.display` for body/reading text** — display is chrome-only; prose is `font.sans`.
7. **Raw hex text color** — name a `color.*` token (D2), never a value.
8. **Truncating AI prose** (`numberOfLines` on `body`) — prose is never clipped (§6/§7).
9. **Relying on cross-`View` text selection** for AI prose — use the copy action (§6).
10. **Restyling interrupted/stopped prose** to signal state — use a badge (§6).
11. **Manual line-breaking / width math** — platform wrapping only (§9).

## 11. Acceptance criteria

Mapped to P1 / lint.

- [ ] **No raw type props:** lint asserts no `fontSize`/`lineHeight`/`fontFamily`/`letterSpacing`
      literals in `features/chat/**`; text goes through a role.
- [ ] **Closed role set → D1 only:** a schema test asserts every `ROLE_SPECS` entry references a D1
      §5 ramp token, a D1 weight, a D1 family, and a D2 color token — no inline values.
- [ ] **Dynamic Type:** at `a11y.fontScale.max` (1.3), no clipping/overlap in messages, headings,
      code, composer (snapshot at scale).
- [ ] **CJK/Thai:** `body` renders without clipping in zh-Hant, ja, and th; tracking is disabled for
      CJK runs (rendering test).
- [ ] **Parse caching:** unrelated re-renders do not re-parse markdown (instrumented — A2 §15.4).
- [ ] **Reflow stability:** appending streamed text does not reflow prior lines (fixed line-height
      assertion).
- [ ] **Screen reader:** headings/links/code expose correct roles; cursor/dots hidden (a11y tree
      test — X1).
- [ ] **Contrast:** every role's default color meets its size-class ratio on `color.bg.canvas`
      (feeds X1).
- [ ] **Logical alignment:** no hardcoded `left`/`right` on text; alignment is `start`/`end`
      (RTL-ready — lint/X2).

## 12. Self-review

**Assumptions.**
- (a) Inter/JetBrains/Hanken are bundled (D1 §22a); the system CJK/emoji fallbacks exist per platform
  (they do). (b) The `type.body` 17/32/−0.2 ramp is comfortable for CJK at the same line-height —
  **to be verified on-device** in zh-Hant/ja/th (acceptance §11); a per-locale line-height bump is the
  contingency. (c) RTL is designed-for but rolled out by X2, not D3. (d) Copy-via-action-row is the
  accepted substitute for free text selection (A4/F6).

**Risks.**
- **CJK line-height.** The single most likely to need adjustment; 32/17 is generous for Latin but
  tall CJK + combining Thai marks can clip. Mitigation: the on-device acceptance check + a per-locale
  override seam (a line-height multiplier by script) that does **not** introduce new D1 tokens.
- **Text selection limitation.** Users may expect to select AI prose; the RN cross-`View` constraint
  makes it unreliable. Documented as a known limitation with copy as the path — but it is a genuine
  UX gap worth revisiting if a single-`Text` markdown renderer becomes viable.
- **Heading depth vs. token supply.** Reusing weight/caps for h2/h3 instead of dedicated sizes is a
  deliberate constraint; if content trends toward deep hierarchies it forces a D1 addition. Low risk
  for chat.
- **Family split (display vs sans).** Using `font.display` for chrome titles but `font.sans` for
  in-prose headings is a subtle rule a contributor could get wrong; the role table (§2) is the guard.

**Future extensions.**
- **Reasoning/artifact typography.** New content parts (A2 §18) map to existing roles (e.g. reasoning
  = `body`/`metadata` muted); a distinctive treatment would add a role here, not a value.
- **Richer markdown** (tables, footnotes, math) — new node→role mappings in §5; values only if D1
  grows.
- **Per-locale type packs.** The fallback policy (§8) can extend to locale-specific line-height
  multipliers without touching D1 or components.
- **Single-`Text` markdown renderer.** If adopted (to enable native selection), D3's role mapping and
  rhythm carry over unchanged — only F4's rendering strategy changes.
