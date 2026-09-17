# Icon rules

---

## R1 · One library: `lucide-react-native`

**Rule.** All v2 icons come from `lucide-react-native`. Do not add a second icon
package, and do not hand-draw an SVG for something Lucide already has.

**Evidence, not assumption.** `lucide-react-native@^1.16.0` is in
[`package.json:57`](../../package.json), and v2 imports it from **22** call
sites across `app/v2/` and `src/features/v2/` (counted 2026-09-17).

**Why it matters more than taste.** Two icon sets in one app never match on
stroke weight, corner radius or optical size, and the mismatch is most visible
exactly where icons sit side by side — a tab bar, a row of chips.

---

## R2 · Sizes come from the `icon` token

```
xs 12 · sm 14 · md 16 · lg 18 · xl 20 · 2xl 22 · hero 30
```
([`scale.ts:256-264`](../../src/theme/v2/scale.ts))

Collapsed from 13 canvas sizes; the snapping is recorded at `scale.ts:255`
(`10→12, 15/17→16, 19→18, 21→20, 23→22`).

**Rule.** Never pass a raw number to `size`. If you need a size that is not
here, add it to the token with a reason.

---

## R3 · Match the icon to the text it sits beside

**Rule of thumb, checkable:** an icon next to a line of text should be about the
text's size, not larger.

| Beside | Use |
|---|---|
| `caption` / `small` (11–12) | `icon.xs` (12) or `icon.sm` (14) |
| `body` / `rowTitle` (13–14) | `icon.md` (16) |
| `action` / `h3` (15–17) | `icon.lg` (18) or `icon.xl` (20) |
| A row's leading affordance | `icon.2xl` (22) |
| Empty state / hero glyph | `icon.hero` (30) |

An icon noticeably taller than its label makes the label look like a caption of
the icon rather than the thing being labelled.

---

## R4 · Stroke width

**Rule.** Lucide's default is 2. This design uses **1.4–2.0**, chosen against
the icon's size and ground:

- **2.0** — small icons and anything on a dark scrim, where a thin stroke
  disappears. Seen on the lot hero controls and the primary footer action.
- **1.8** — the common case for `icon.lg` / `icon.xl` in a tinted row.
- **1.4** — large glyphs only (`icon.hero`), where 2.0 reads as heavy and
  cartoonish.

**Never mix two stroke widths in one cluster** — a tab bar, a row of chips, a
footer. Inconsistent stroke across adjacent icons is more visible than a wrong
size.

---

## R5 · An icon is not a touch target

**Rule.** The icon's *size* and its *tappable area* are different numbers. A
16pt icon inside a 44pt target is correct; a 16pt tappable icon is a bug.

See [touch-targets.md](touch-targets.md). `control.chipSm` (26) is documented at
`scale.ts:271` as **decorative only, never tappable** for exactly this reason.

---

## R6 · Icons are decorative unless they are the only label

**Rule.** If an icon sits beside text that already names the action, it needs no
accessibility label — the text is the label, and announcing both makes a screen
reader say everything twice.

If an icon is **alone** (a back chevron, a share glyph, a bell), it **must**
carry an `accessibilityLabel` naming the action, not the picture: "Share this
lot", not "share icon".

This is already the pattern in v2 — the lot hero's controls announce as `Back`
and `Share this lot`, which is how they were verified on device.

---

## R7 · Colour comes from the palette, at the call site

**Rule.** Pass an explicit `color` from `useV2Colors()`. Never let an icon
inherit a default, and never hardcode a hex.

Icons sitting on a photo or scrim use the `onScrim*` roles; icons on the app
ground use `ink*`. Getting this wrong is invisible in light mode and illegible
in dark — see [color-and-contrast.md](color-and-contrast.md).
