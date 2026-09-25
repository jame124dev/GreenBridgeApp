# Phase 1 — UI only, no API

Goal: this screen renders on the device, in both schemes, from a fixture. No
network call exists yet.

## Open these, in this order

1. `nextjs-port/src/features/buyer/pages/order/BuyerOrder.tsx` — the screen being ported.
2. `.claude/skills/v2-screen/SKILL.md` — tokens, primitives, the five traps.
3. A built v2 screen for reference: `app/v2/matches.tsx` or `app/v2/drafts.tsx`.

## Take these

- The checkout status progression and what each state means for the buyer.
- The shipment event list shape — each event's label and timestamp.

## Leave these

- any 'book shipment' / 'cancel' control — those are the seller's, and they are out of scope

Plus the standing list: every `className` and `<div>`, `react-router`
navigation, the shadcn `<Table>`, and the web's dialogs/toasts. On these files
markup is ~76% of the lines, so most of what you are reading is not coming with
you.

**The one translation decision: the `<Table>` becomes a list of rows.** A phone
shows one row per record with the two or three fields that matter, not columns.
Write down which fields survive that cut before you start — that choice is the
screen.

## Build with

**`Timeline`** — this is exactly what it is for; the scan flow already uses it (`app/v2/scan/analyzing.tsx`) · `Row` for the line items · `SectionHeader`

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
