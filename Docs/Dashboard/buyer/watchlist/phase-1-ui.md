# Phase 1 — UI only, no API

Goal: this screen renders on the device, in both schemes, from a fixture. No
network call exists yet.

## Open these, in this order

1. `nextjs-port/src/features/buyer/pages/buyer/BuyerWatchlist.tsx` — the screen being ported.
2. `.claude/skills/v2-screen/SKILL.md` — tokens, primitives, the five traps.
3. A built v2 screen for reference: `app/v2/matches.tsx` or `app/v2/drafts.tsx`.

## Take these

- The card's field set — it is the same lot identity used everywhere else.
- Client-side pagination: the web pages this in the client, so the endpoint returns everything.

## Leave these

- ⚠️ `window.addEventListener("wishlist-changed", …)` at **BuyerWatchlist.tsx:44** — there is no `window` in React Native. This becomes a React Query `invalidateQueries`. It is the one place in this plan where copying the logic verbatim compiles and silently never fires.

Plus the standing list: every `className` and `<div>`, `react-router`
navigation, the shadcn `<Table>`, and the web's dialogs/toasts. On these files
markup is ~76% of the lines, so most of what you are reading is not coming with
you.

**The one translation decision: the `<Table>` becomes a list of rows.** A phone
shows one row per record with the two or three fields that matter, not columns.
Write down which fields survive that cut before you start — that choice is the
screen.

## Build with

~~`Row` + `RowThumb`~~ · `EmptyState` (with the action that fills it — 'Browse equipment')

⚠️ **CORRECTED AT BUILD TIME, 2026-09-23 — this said rows and rows are wrong
here.** The web page is not a table and not a list: it is a 4:3 image-card
grid, 2–4 columns by breakpoint (`BuyerWatchlist.tsx:95-110`). A watchlist is
answered by *looking* — the photograph is the record, and a row would reduce it
to a thumbnail beside a title. Built as a **2-up grid** instead:

- `src/features/v2/watchlist/watch-tile.tsx` — copied from
  `obytes-template/src/features/feed/components/post-card.tsx` (MIT)
- `src/features/v2/watchlist/watchlist-screen.tsx` — copied from the same
  template's `feed-screen.tsx`, with `numColumns={2}`

The "Row + RowThumb" line came from the section's generic advice rather than
from this page's source. Check the source before following a "build with" line.

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
