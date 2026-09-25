# Phase 1 — UI only, no API

Goal: this screen renders on the device, in both schemes, from a fixture. No
network call exists yet.

## Open these, in this order

1. `nextjs-port/src/features/buyer/pages/buyer/BuyerRequests.tsx` — the screen being ported.
2. `.claude/skills/v2-screen/SKILL.md` — tokens, primitives, the five traps.
3. A built v2 screen for reference: `app/v2/matches.tsx` or `app/v2/drafts.tsx`.

## Take these

- The fact that this is ONE list of two different things (a purchase and a request). The web merged them deliberately — keep that.
- The row's identity line and how a request is distinguished from a completed purchase.

## Leave these

- ⚠️ **`pages/buyer/orders/BuyerOrders.tsx` (434 lines) — it is imported by NOTHING.** Do not port it. Same for `pages/buyer/offers/BuyerOffers.tsx` (449 lines).
- the route comment's history about `MyOrders` duplicating `/buyer/winning-bids` — useful context, dead code

Plus the standing list: every `className` and `<div>`, `react-router`
navigation, the shadcn `<Table>`, and the web's dialogs/toasts. On these files
markup is ~76% of the lines, so most of what you are reading is not coming with
you.

**The one translation decision: the `<Table>` becomes a list of rows.** A phone
shows one row per record with the two or three fields that matter, not columns.
Write down which fields survive that cut before you start — that choice is the
screen.

## Build with

`Tabs` if the two types need splitting · `Row` + `RowThumb` · `Chip` · `EmptyState`

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
