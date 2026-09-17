# Spacing and layout rules

Values live in [`src/theme/v2/scale.ts:37-66`](../../src/theme/v2/scale.ts) and
`:293-323`.

---

## R1 · The scale, as it actually is

```
none 0 · xxs 2 · xs 4 · sm 6 · md 8 · lg 10 · xl 12 · 2xl 14
3xl 16 · 4xl 18 · 5xl 22 · 6xl 26 · 7xl 30 · 8xl 34
```

Fourteen steps (`scale.ts:37-52`). Steps of **2** up to 18, then **4** to 34.

Plus three named layout constants that are deliberately **not** steps:

| Constant | Value | What it is |
|---|---|---|
| `GUTTER` | **24** | The screen gutter. 71 uses in the canvas; the left edge every screen aligns to. (`scale.ts:60`) |
| `CARD_PAD` | **18** | Inner padding of a filled card or tinted row — one step in from the gutter. (`scale.ts:66`) |
| `SECTION_GAP` | **34** | The space between two sections. (`scale.ts:314`) |

---

## R2 · We are not on an 8pt grid, and that is a known deviation

**The industry rule.** Use multiples of 8 for dimensions, padding and margin,
optionally with a 4pt baseline grid under the type
([8-point grid](https://spec.fm/specifics/8-pt-grid)). Apple's layout guidance
is also built on 8pt multiples.

**What we actually have.** Of the 14 steps above, only `md 8`, `3xl 16` and
`8xl 34`-adjacent values land on 8. `GUTTER` is 24 (on-grid), `CARD_PAD` is 18
(off), `SECTION_GAP` is 34 (off). The scale was **measured off the design
canvas and snapped** — `scale.ts:35` records the snapping: `3→4, 7→6, 9→10,
11→12, 13→12, 15→16, 20→18, 28→26`.

**So this is a deliberate deviation, not an accident.** It buys fidelity to the
canvas and costs the rhythm an 8pt grid gives you for free.

**The practical risk, and the rule that manages it.** With `sm 6`, `md 8` and
`lg 10` only 2pt apart, choosing between them is close to arbitrary, and
arbitrary choices are what make a screen look *subtly* off rather than obviously
broken. So:

> **Prefer the coarse end.** For gaps between distinct elements use `3xl (16)`,
> `4xl (18)`, `5xl (22)`, `6xl (26)` or `SECTION_GAP (34)`. Reserve `xxs`–`xl`
> (2–12) for **inside** a component — icon-to-label, title-to-subtitle, chip
> padding.

This is the *internal ≤ external* principle: space inside a thing must be
smaller than the space around it, or the grouping reads wrong.

---

## R3 · Sections are separated by space, not boxes

**Rule.** A new section = `SECTION_GAP` (34) + an `eyebrow` label. Do not add a
card, border or divider to group content that space already groups.

`scale.ts:304-314` states this directly: with no boxes, the gap plus the eyebrow
*is* the grouping — it does the job a card border would do elsewhere.

---

## R4 · Two horizontal rhythms, and only two

**Rule.** Content aligns to **24** (`GUTTER`) or, inside a card, to **18**
(`CARD_PAD`). There is no third horizontal position.

This is the single most visible alignment rule in the app: every screen's left
edge is the same line. A one-off `paddingHorizontal: 20` breaks it in a way that
is hard to name but easy to feel.

---

## R5 · Safe areas are mandatory, and the tab bar is not one of them

**Rule.** Respect `useSafeAreaInsets()` top and bottom. The tab bar measure is
**78** (`control.tabBar`, `scale.ts:287`) and it **excludes the home indicator**
— add `insets.bottom` yourself.

**This has bitten twice, both times the same way:** the last element of a scroll
(a "Create account" row, a Terms link) sat behind the Android 3-button nav bar,
so taps landed on Back/Home instead of the control. Both are recorded in
`app/(auth)/login.tsx` and `register.tsx`. A flat `paddingBottom: 24` is not
enough; it must carry the inset.

---

## R6 · Only pictures scale with the screen

**Rule.** Type, spacing and touch targets are fixed points. Only *pictorial*
dimensions — hero banners, photo tiles, illustration blocks — use `scaleW()`,
which is clamped to **0.9–1.15** of the 390pt reference frame
(`scale.ts:414-420`).

---

## R7 · Radius

```
xs 8 · sm 14 · md 16 · lg 22 · xl 26 · pill 999
```
(`scale.ts:70-77`)

Plus `HEADER_SHEET_RADIUS = 34` (`scale.ts:86`) — the green wash curving away
from the status bar, on 11 of 11 canvas screens. It is not a radius step; it is
the shape of the app. Do not substitute `xl (26)` for it, and do not use 34 as a
general radius.

---

## R8 · Hairlines are 1pt, not `StyleSheet.hairlineWidth`

**Rule.** Use `HAIRLINE_WIDTH` = **1** (`scale.ts:323`).

`StyleSheet.hairlineWidth` resolves to ~0.33–0.5pt and, at this palette's
contrast, reads as a smudge rather than a line.

---

## R9 · Three optical values that are not layout

Do not "tidy" these onto the scale — they are deliberate:

- `ROW_SUBLINE_GAP` = **3** — kerning between a row title and its sub-line, not layout (`scale.ts:320`).
- `PROGRESS_TRACK_HEIGHT` = **3** (`scale.ts:302`).
- `badgeDot` = **7** with a **1.5** ring (`scale.ts:299`) — the ring is what stops the unread dot reading as a smudge on the bell icon.
