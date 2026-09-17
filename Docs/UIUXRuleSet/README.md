# UI/UX rule set — GreenBridgeApp

One file per concern. Each rule is **checkable** (a number, a token name, or a
yes/no), and each one says where it comes from.

**Working on a screen? Start with [SCREEN-WORKFLOW.md](SCREEN-WORKFLOW.md)** —
the whole loop in order, ending in a no-context fresh-eyes review. Hand a
session that one file and the screen name; it should need nothing else.

| File | Covers |
|---|---|
| [SCREEN-WORKFLOW.md](SCREEN-WORKFLOW.md) | **how to work a screen, start to finish** |
| [typography.md](typography.md) | type scale, weights, line height, tracking, Dynamic Type |
| [spacing-and-layout.md](spacing-and-layout.md) | the grid, gutters, section rhythm, safe areas, max width |
| [icons.md](icons.md) | which library, sizes, stroke, pairing with text |
| [touch-targets.md](touch-targets.md) | minimum sizes, spacing between targets, hitSlop |
| [color-and-contrast.md](color-and-contrast.md) | palette roles, contrast ratios, dark mode |
| [motion.md](motion.md) | durations, easing, springs, reduced motion |
| [responsiveness.md](responsiveness.md) | how fast a touch is acknowledged, press feedback, haptics |

## Where the rules come from, and which wins

Three sources, in this order of authority:

1. **Accessibility law/standard — WCAG 2.2.** Non-negotiable. If a design
   decision conflicts with a WCAG success criterion, the design changes.
2. **Platform guidance — Apple HIG and Material 3.** Strong defaults. We may
   deviate, but the deviation gets written down in the relevant file with a
   reason.
3. **Our own tokens — `src/theme/v2/scale.ts` and `palette.ts`.** These were
   measured off the design canvas. Where they disagree with (2), the file says
   so explicitly rather than quietly picking one.

⚠️ **Never invent a value.** Every number in these files is either quoted from a
source with a link, or read out of our token file with a `file:line`. If you
need a value that is not here, add it here first — with its source — then use it.

## How these relate to what already exists

- **`UX_DESIGN_RULES.md`** (workspace root) is mandatory per the root
  `CLAUDE.md` and covers *flow* — one primary CTA, loading states, error
  recovery, feedback on every action. It has **no** spacing, typography, grid or
  colour section; that gap is what this folder fills. Both apply.
- **`.claude/skills/v2-screen`** carries the tokens, the primitive kit and the
  React Native traps for building a v2 screen. It is the *how*; this folder is
  the *what and why*. If the two ever disagree, fix both in the same change.
- **`src/theme/v2/scale.ts`** is the source of truth for values at runtime.
  These docs must never restate a number without citing its line, because a doc
  that drifts from the token file is worse than no doc.

## Scope

These describe **v2** (`app/v2/`, `src/features/v2/`). The old UI predates them
and is not being retrofitted — it is being replaced.

## Verification

A screen is not "done" against these rules because it compiles or because a
screenshot looks right. See the root `CLAUDE.md` rule *"done means proven on the
real surface"*: press the controls on the device. The rules here tell you what
to look for; they do not replace looking.
