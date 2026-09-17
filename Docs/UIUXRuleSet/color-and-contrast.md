# Colour and contrast rules

Palette: [`src/theme/v2/palette.ts`](../../src/theme/v2/palette.ts).
Enforcement: [`src/__tests__/v2Contrast.test.ts`](../../src/__tests__/v2Contrast.test.ts).

---

## R1 · Use a role, never a hex

**Rule.** Colour comes from `useV2Colors()`. No hex literal in a screen or
component, ever.

The palette is a set of **named roles**, and the role is what forks between
light and dark — which is why a hardcoded colour is not "a shortcut", it is a
dark-mode bug that light-mode review cannot see.

The roles: `base`, `surface`, `fill`, `fillStrong`, `wash`, `accentWash`,
`accent`, `onAccent`, `accentInk`, `ink`, `inkMuted`, `inkSubtle`,
`inkDisabled`, `hairline`, `hairlineStrong`, `danger`, `scrim`, `scrimStrong`,
`onScrim`, `onScrimTint`, `scrimPill`, `onScrimPill`, `scrimFallback`,
`viewfinder`, `backdrop`.

---

## R2 · The ratios

| Content | Minimum | Source |
|---|---|---|
| Normal text | **4.5 : 1** | [WCAG 2.2 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) |
| Large text (≥18pt, or ≥14pt bold) | **3 : 1** | same |
| UI component boundaries, icons | **3 : 1** | WCAG 1.4.11 |

**Do not round.** W3C is explicit: *"The computed values should not be rounded
(e.g., 4.499:1 would not meet the 4.5:1 threshold)."*

**What counts as "large" in our scale** is narrower than people assume — only
`display` (27), `h1` (22) and `h2` (20) clear 18pt. See
[typography.md](typography.md) R5.

Exempt: disabled controls, purely decorative text, logos.

---

## R3 · ⚠️ `inkSubtle` is currently below AA — an open decision, not a settled one

**The fact.** `inkSubtle` is `#8B9A92` in light
([`palette.ts:178`](../../src/theme/v2/palette.ts)). Against the app's grounds it
measures **2.94:1** — below AA (4.5) *and* below AA-large (3.0), on all three
grounds. It has **60 uses**.

**The fix, already computed.** `#65736B` clears 4.5:1 everywhere — base 4.98,
surface 4.69, wash 4.52 — at the same hue and saturation as the canvas colour.

**A near-miss worth remembering.** `#68766E` was proposed as "clears AA
(4.77:1)". It clears AA **only against `base`**; on `surface` it is 4.49 and on
`wash` 4.52. One ground is not three grounds — always check a candidate against
every background it will actually sit on.

**Status: undecided.** This is open decision #9 in `Docs/v2/DECISIONS.md`
("Ship below WCAG AA: yes or no?"). Until it is answered, do not add new uses of
`inkSubtle` for text that carries meaning.

---

## R4 · A contrast number is not the whole answer

**Rule.** Relative luminance answers "can this text be read". It does **not**
answer "is this the right colour" or "does this panel read as a panel".

`v2Contrast.test.ts:53` makes the point: a pale green panel on white can pass a
text-contrast check while being invisible as a *surface*. Panel and border
separation is SC 1.4.11's 3:1 job, against the colour it actually abuts.

---

## R5 · Check against every ground, in both schemes

**Rule.** A foreground role is only approved once it clears its ratio on **every
background it can appear on** — `base`, `surface` and `wash` at minimum — in
**both** light and dark.

Dark is not a re-tint of light. `inkSubtle` is `#8B9A92` in light and `#6E9683`
in dark (`palette.ts:178` and `:244`) — different hue relationships, so a light
pass tells you nothing about dark.

---

## R6 · Text on photographs uses the scrim roles

**Rule.** Any text or icon over an image uses `onScrim` / `onScrimTint` /
`onScrimPill` over a `scrim`/`scrimStrong` ground. Never place `ink` directly on
a photo.

**And provide a fallback ground.** When there is no photograph, use
`scrimFallback` — not `fill`. The chrome on a hero (white round controls, a dark
counter) is drawn *for a photograph*; on a light `fill` the white discs all but
disappear. This is why `app/v2/lot.tsx` uses `scrimFallback` for its empty hero.

---

## R7 · The contrast test is the gate, and it is not optional

**Rule.** `v2Contrast.test.ts` runs in the suite. A new colour pairing that
fails it does not ship — you change the colour, not the test.

If a pairing genuinely must be exempt, add it to the test's exempt list **with a
comment naming why**, so the exemption is reviewable. A silently loosened
threshold is how 60 uses of a 2.94:1 grey got in.
