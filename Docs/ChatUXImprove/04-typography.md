# 04 · Typography

> Part of [ChatUXImprove](./00-overview.md). Direction: **dark surface, green-tinted**.
> Status: Not started · Effort: S · Risk: Low · Depends on: 01

## Goal

The premium "reading" feel is 80% typography: bigger body text, generous line-height, gentle
negative letter-spacing, restrained weights.

## Font decision

plane.md: `Google Sans → Inter → System`. **Google Sans is proprietary — we cannot ship it.**
Inter is already the app's font (`fonts` from `src/theme/typography.ts`). So: **Inter, full stop.**
No new font work — just apply the spec's sizing/spacing to the Inter faces we already load.

Map spec weights → our `fonts`:
| Spec weight | Our token |
|---|---|
| 400 Normal | `fonts.regular` |
| 500 Medium | `fonts.medium` (or `fonts.label`) |
| 600 Semibold | `fonts.semibold` |
| (never heavy bold) | avoid `fonts.bold` for prose |

## Target values (plane.md)

| Element | Size | Line height | Weight | Letter spacing |
|---|---|---|---|---|
| AI body | **17** | **31–32** | 400 | **-0.2** |
| User body | **17** | 26 | 400 | -0.2 |
| Heading (markdown h) | 24–28 | 30–34 | 600 | -0.3 |
| Caption / timestamp | 13–14 | 16 | 500 | 0 |
| Small (labels) | 13 | 16 | 500 | +1.0 (eyebrows) |
| Paragraph spacing | 24px gap between blocks | | | |

Current chat prose is 14 / lineHeight 21 — noticeably tighter/smaller. Bumping AI body to
**17 / 32** is the biggest single perceived-quality win in the whole spec.

## Implementation

1. Add a small chat type scale (co-locate with the shared message styles from
   [03](./03-messages.md), or a `chat/typography.ts`):

```ts
export const chatType = {
  body:    { fontFamily: fonts.regular,  fontSize: 17, lineHeight: 32, letterSpacing: -0.2 },
  user:    { fontFamily: fonts.regular,  fontSize: 17, lineHeight: 26, letterSpacing: -0.2 },
  heading: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 30, letterSpacing: -0.3 },
  caption: { fontFamily: fonts.medium,   fontSize: 13, lineHeight: 16 },
  eyebrow: { fontFamily: fonts.label,    fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },
} as const;
```

2. Apply `chatType.body` to `MarkdownLite` `botText`, `chatType.user` to the user bubble text.
3. Paragraph spacing: `MarkdownLite`'s empty-line `gap` (currently `height: 8`) → **24**.
4. Bullet/numbered list line-height matches `chatType.body` so markers baseline-align.
5. **Respect Dynamic Type** ([09](./09-performance-a11y-empty.md)): don't hard-cap font scaling;
   let `allowFontScaling` (default true) work, or scale line-height proportionally.

## CJK caveat

Chinese/Japanese/Thai render taller than Latin. `lineHeight 32` on 17px is comfortable for CJK
too, but verify Thai (`th`) tall glyphs and combining marks aren't clipped — test the chat in
`zh-hant` and `th` (both are shipped locales). If clipping appears, nudge line-height to 34 for
CJK via the active locale.

## Acceptance checklist

- [ ] AI body is 17px / ~32 line-height / -0.2 tracking, Inter regular.
- [ ] Paragraph blocks separated by ~24px.
- [ ] No heavy bold in prose (semibold max).
- [ ] Verified legible in `en`, `zh-hant`, and `th` (no clipping).
- [ ] Font scaling / Dynamic Type still works.
