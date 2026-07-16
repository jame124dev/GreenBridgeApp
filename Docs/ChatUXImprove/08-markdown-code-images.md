# 08 · Markdown, Code Blocks & Images

> Part of [ChatUXImprove](./00-overview.md). Direction: **dark surface, green-tinted**.
> Status: Not started · Effort: L · Risk: Med · Depends on: 03, 04

## Goal

Render richer AI content — headings, lists, code blocks with copy, inline code, tables, quotes,
links — consistently on the dark canvas, without dropping the lightweight feel.

## Current state

`chat/ChatMessage.tsx` → `MarkdownLite` is a hand-rolled line parser that handles **only**:
- `**bold**`, bullet (`- `/`* `), numbered (`1. `), links `[text](url)`, and drops image markdown.

It does **not** handle: headings (`#`), code fences (```` ``` ````), inline code (`` `x` ``),
tables, block quotes. There is **no markdown library** installed.

## Decision: extend `MarkdownLite`, don't adopt a heavy lib (yet)

plane.md's recommended `react-native-markdown-display` is capable but heavy and styling it to the
dark brand + our link/image rules (we deliberately strip image markdown and long GCS URLs) is
fiddly. The assistant's output is fairly constrained. **Recommended path:** grow `MarkdownLite`
incrementally to cover code + headings + inline code + quotes, keeping full control of dark
styling and our URL-stripping rules. Revisit a library only if tables/nested lists become common.

> If we do want the library: install `react-native-markdown-display`, feed it a dark `style`
> object built from `labDark` + `chatType`, and port the image/URL-strip rules into a custom
> `rules`/`renderer`. Heavier, but less parser code to own. Flag this as an alternative, not the
> default.

## Target (plane.md) — coverage & styling

All typography from [`04-typography.md`](./04-typography.md) `chatType`; all colors from
`labDark`.

| Element | Treatment |
|---|---|
| Headings `#`/`##`/`###` | `chatType.heading`, `labDark.ink`, extra top margin |
| Bullet / numbered lists | existing, recolored: marker `labDark.inkMeta`, text `labDark.ink` |
| **Inline code** `` `x` `` | mono (`fonts.mono` / JetBrains Mono), `labDark.surface` bg pill, `labDark.accent` text |
| **Code block** ```` ```lang ```` | see below |
| Block quote `>` | left green rule (`labDark.accent`), indented, `labDark.inkSub` text |
| Links `[t](u)` | `labDark.accent`, underline, tappable (existing behavior) |
| Tables | low priority — render as monospace preformatted block if present; proper table = follow-up |
| Images `![]()` | keep **dropping** raw image markdown in prose (cards show the photo) — see Images below |

### Code blocks (spec: rounded, dark bg, horizontal scroll, copy button, language badge)
New `chat/CodeBlock.tsx`:
- Container: `labDark.surface` bg, 1px `labDark.border`, `radius.md`, `borderCurve: 'continuous'`.
- Header row: language badge (`chatType.eyebrow`, `labDark.inkMeta`) + a **Copy** button
  (`expo-clipboard`, added in [07](./07-action-row.md)) with toast + haptic.
- Body: `fonts.mono`, horizontal `ScrollView` (`overflow-x` equivalent) so long lines scroll
  rather than wrap/clip. Never let a code line break the layout width.
- Parse fences in `MarkdownLite`: detect ```` ``` ````-delimited spans, capture optional language,
  route to `CodeBlock` instead of the inline-text path.

### Images
- **Prose:** continue to strip `![alt](url)` (avoids ugly long GCS URLs) — unchanged.
- **Rendered images** (product photos etc.) live in **cards**, which already use `AppImage`. Spec
  wants: rounded corners (have), **tap to fullscreen + zoom**. Add a fullscreen viewer on tap
  (route or modal with pinch-zoom via gesture-handler) — this is a card enhancement, low priority;
  track as follow-up unless in scope.

## Implementation order

1. Recolor existing `MarkdownLite` output to `labDark` + `chatType` (fast; overlaps [03]/[04]).
2. Add inline code + headings + block quote to the parser.
3. Add code-fence detection + `CodeBlock` component (needs `expo-clipboard`).
4. (Optional/follow-up) tables, image fullscreen viewer, or swap to a markdown library.

## Acceptance checklist

- [ ] Headings, lists, inline code, block quotes, links all render styled on dark.
- [ ] Code blocks: dark card, language badge, horizontal scroll, working Copy (toast + haptic).
- [ ] Long code lines scroll horizontally — never widen or clip the thread.
- [ ] Raw image markdown / long GCS URLs never leak into prose.
- [ ] Typography matches `chatType`; colors all `labDark.*`.
- [ ] (If lib chosen instead) dark styles + URL-strip rules ported and verified.
