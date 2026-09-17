# Typography rules

Our type is defined as **finished `TextStyle` objects** in
[`src/theme/v2/scale.ts:130-251`](../../src/theme/v2/scale.ts). Screens pick a
token. They never set `fontSize`, `fontFamily`, `lineHeight` or `letterSpacing`
themselves.

---

## R1 · Use a token, never a raw number

**Rule.** Every piece of text uses one of the 17 tokens in `type`
(`scale.ts:130`). No inline `fontSize`.

**Why this is stricter than "be consistent".** React Native has two silent
failures that this closes, both documented at `scale.ts:8-20`:

- `letterSpacing` in RN is in **points**, not `em`. The canvas specifies `.16em`
  for the tracked eyebrow. Passing `0.16` gives a sixth of a point — invisible.
- `lineHeight` in RN is in **points**, not a multiplier. Passing `1.5` collapses
  the line to 1.5pt.

Both compile and render. They just look wrong. The tokens are pre-resolved to
points, which is the entire reason they exist.

---

## R2 · The scale

Read off `scale.ts:130-251`. Poppins only, three weights — 400/500/600
(`scale.ts:98-102`). **Nothing is bold (700) and nothing is light.**

| Token | Size / weight | Use |
|---|---|---|
| `display` | 27 / 600, −0.02em | The screen's one big line. At most one per screen. |
| `h1` | 22 / 600 | Screen title where there is no display line. |
| `h2` | 20 / 600 | A price, a total, a step heading. |
| `h3` | 17 / 600 | Card heading, banner headline. |
| `action` | 15 / 500 | Primary button label. |
| `lead` | 15 / 400 | Long-form paragraph. |
| `rowTitle` | 14 / 500 | List-row title — the most used title style in the app. |
| `row` | 14 / 400 | Row title where the row is not the subject. |
| `body` | 13 / 400 | Body copy. |
| `bodyMedium` | 13 / 500 | Body copy carrying emphasis. |
| `bodySemi` | 13 / 600 | Tab label, selected segment. |
| `caption` | 12 / 400 | Secondary line under a row title, metadata. |
| `captionMedium` | 12 / 500 | Inline link ("See all 7"), chip label. |
| `small` | 11 / 500 | Dense metadata, tab-bar label. |
| `eyebrow` | 10 / 600, +0.16em, UPPERCASE | Section label — `DRAFTS`, `FOR SELLERS`. |
| `label` | 12 / 600, +0.16em, UPPERCASE | Wordmark, top-level tracked label. |
| `micro` | 10 / 600, +0.06em | Tracked label inside dense chips. |

---

## R3 · Hierarchy comes from weight and space before size

**Rule.** Reach for a weight change or more space before a bigger size. Do not
introduce a size that is not in the table.

**Source.** Material 3's baseline scale carries only **Regular and Medium** for
every role, using weight — not extra sizes — to separate Title Large (22sp
Regular) from Title Medium (16sp Medium) and Title Small (14sp Medium)
([material-components-android Typography.md](https://github.com/material-components/material-components-android/blob/master/docs/theming/Typography.md)).
Our scale follows the same instinct: `body` / `bodyMedium` / `bodySemi` are one
size at three weights.

**The eyebrow is the workhorse.** With no boxes around sections, the tracked
uppercase `eyebrow` plus `SECTION_GAP` *is* the grouping (`scale.ts:219-231`,
`scale.ts:304-314`). Reach for it before inventing a heading size.

---

## R4 · Minimum sizes, and where we are below standard

**Rule.** Body copy renders at 13pt (`type.body`). The smallest text in the app
is 10pt (`eyebrow`, `micro`).

**⚠️ Deviation, stated openly.** Material 3's smallest baseline role is **Label
Small at 11sp**, and its Body Small is **12sp**
([source](https://github.com/material-components/material-components-android/blob/master/docs/theming/Typography.md)).
Our `body` is 13 (fine), but `eyebrow` and `micro` at **10pt sit below any
Material baseline role**.

That is accepted for `eyebrow` specifically because it is a short, uppercase,
heavily tracked *label* — not reading text — and it carries no information that
is unavailable elsewhere on the screen. It is **not** accepted for anything a
person has to read to make a decision.

**Checkable:** no sentence, value, price, name or error message may use
`eyebrow` or `micro`.

---

## R5 · Contrast applies to type, and small type has no exemption

**Rule.** Normal text needs **4.5:1**; large text needs **3:1**. Large is
defined as **18pt, or 14pt bold**
([WCAG 2.2 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).

**Consequence for this scale — read this carefully.** Only `display` (27),
`h1` (22) and `h2` (20) clear the 18pt "large" bar. Poppins 600 is semibold, so
the "14pt bold" route is arguable at best; do not rely on it. **Everything from
`h3` (17) down must hit 4.5:1**, including every caption, chip and eyebrow.

W3C is explicit that the computed ratio **is not rounded** — 4.499:1 fails.

---

## R6 · Respect the OS text size — do not fight it

**Rule.** Type does not scale with screen width. A 13pt line is 13pt on an
iPhone SE and on a Pro Max (`scale.ts:399-413`).

**Why.** Scaling type by device width makes small phones illegible and large
phones cartoonish, and it fights the OS accessibility text setting — which is
the control that *should* be moving type size.

**Open gap, not yet solved.** Our tokens are fixed point values, so they do not
currently respond to the OS text-size setting at all. Apple's guidance is to
support Dynamic Type. Before shipping v2 broadly, decide whether to adopt
`allowFontScaling` with a clamp, or to document this as a known limitation.
Do not silently leave it undecided.

---

## R7 · Line length

**Rule.** Content stops widening at **560pt** (`MAX_CONTENT_WIDTH`,
`scale.ts:426`); beyond that it centres rather than stretching.

Without it the 24pt gutter would let body copy run to a full tablet width, past
a comfortable measure.
