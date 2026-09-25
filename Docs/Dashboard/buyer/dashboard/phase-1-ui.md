# Phase 1 — UI only, no API

Goal: this screen renders on the device, in both schemes, from a fixture. No
network call exists yet.

## Open these, in this order

1. `nextjs-port/src/shared/pages/buyer/BuyerDashboard.tsx` — the screen being ported.
2. `.claude/skills/v2-screen/SKILL.md` — tokens, primitives, the five traps.
3. A built v2 screen for reference: `app/v2/matches.tsx` or `app/v2/drafts.tsx`.

## Take these

- `statusColors` and `statusLabel` (two maps in the same file) — the offer status vocabulary.
- `PaymentStatusBanner` keyed on `batchStep` — the escalation logic for 'you won, now pay'. The logic, not the banner.
- Which three things the web decided are worth surfacing first. Copy that editorial judgement; it is the whole value of this page.

## Leave these

- the 1,103-line layout — this is by far the biggest file and almost none of its size is decision-making
- desktop multi-column grids — on a phone it is one column of sections

Plus the standing list: every `className` and `<div>`, `react-router`
navigation, the shadcn `<Table>`, and the web's dialogs/toasts. On these files
markup is ~76% of the lines, so most of what you are reading is not coming with
you.

**The one translation decision: the `<Table>` becomes a list of rows.** A phone
shows one row per record with the two or three fields that matter, not columns.
Write down which fields survive that cut before you start — that choice is the
screen.

## Build with

`SectionHeader` + `Row` per section · `Chip` for counts · `PromoBanner` or `TintedRow` for the payment nudge · `EmptyState`

## Fixture

Derive it from the response type in the web slice, and include **one row per
status** so every branch renders. Keep it in `__fixtures__/` next to the
screen, not inline — phase 2 deletes the import, not the file.

## Done when

- Renders on the device in **light and dark**, with every status represented.
- `npx tsc --noEmit` clean · `npx jest src/__tests__/v2Adherence.test.ts src/__tests__/v2Contrast.test.ts` green.
- No raw hex, no raw font sizes — the adherence test enforces both.
- ⚠️ Fixtures are not real data. Titles here are short and every image exists.
  Phase 3 re-checks layout on the real thing; do not treat phase 1 as proof the
  layout holds.
