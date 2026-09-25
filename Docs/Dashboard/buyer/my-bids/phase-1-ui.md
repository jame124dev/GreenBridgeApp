# Phase 1 — UI only, no API

Goal: this screen renders on the device, in both schemes, from a fixture. No
network call exists yet.

## Open these, in this order

1. `nextjs-port/src/shared/pages/buyer/MyBids.tsx` — the screen being ported.
2. `.claude/skills/v2-screen/SKILL.md` — tokens, primitives, the five traps.
3. A built v2 screen for reference: `app/v2/matches.tsx` or `app/v2/drafts.tsx`.

## Take these

- `STATUS_CONFIG` at **MyBids.tsx:73** — the status → label map, verbatim: `accepted` → "Won", `rejected` → "Lost", `pending` → "Pending". Take the LABELS and the semantics; leave the Tailwind class strings behind.
- `FILTER_TABS` — `All Bids` / `Pending` / `Won` / `Lost`, with `key: null` for All. The keys are the API's status values, so the tab set and the query param are the same vocabulary.
- Row anatomy: lot/batch identity, the buyer's bid amount, the current top bid, the status, the time. The comparison of those two numbers IS the screen.

## Leave these

- the left border-colour trick (`borderCls`) — that is a web card affordance; use a `Chip` for status instead
- `lucide-react` icon imports — the RN package is `lucide-react-native` and the kit already picks sizes from `icon`

Plus the standing list: every `className` and `<div>`, `react-router`
navigation, the shadcn `<Table>`, and the web's dialogs/toasts. On these files
markup is ~76% of the lines, so most of what you are reading is not coming with
you.

**The one translation decision: the `<Table>` becomes a list of rows.** A phone
shows one row per record with the two or three fields that matter, not columns.
Write down which fields survive that cut before you start — that choice is the
screen.

## Build with

`Tabs` (the four filters) · `Row` + `RowTrailing` (bid vs top bid) · `Chip` (status) · `SectionNote` (error) · `EmptyState`

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

---

## Phase 1 outcome — 2026-09-23

**Built and verified on device (RMX2151, both schemes).**

| File | |
|---|---|
| `app/v2/bids.tsx` | the screen — route is `/v2/bids`, flat |
| `src/features/v2/bids/types.ts` | `BuyerBidItem` verbatim, the status vocabulary, `BATCH_STEPS` |
| `src/features/v2/bids/BidRow.tsx` | the row, with the translation decision in its docblock |
| `src/features/v2/bids/__fixtures__/bids.ts` | four rows, one per status |
| `src/__tests__/v2Inventory.test.ts` | `'bids'` declared |

Gates: `tsc` clean · `jest` 1731/1731 · adherence, contrast and material green.

### Three things the device found that review did not

1. **The outbid amount truncated.** The subtitle read `Your bid USD 12,400 ·
   outbid at USD 13,…` — `Row`'s subtitle is one line, and the half that got
   cut was the top bid, the one number the screen exists to show. Fixed by
   moving the word "Outbid" into the chip (where it cannot truncate, and where
   it says more than "Pending") and dropping the redundant second `USD`.
2. **A lost bid said "Outbid".** The derivation was `!isWon && top > yours`,
   which is true of a rejected bid too. A finished bid has an outcome, not a
   race — now gated on `isPending`. Caught by reading the view tree, not the
   screenshot: both words are the same size and colour.
3. **The row's destination was wrong.** `router.push('/v2/listing/{batch_id}')`
   landed on the scan **Intake** screen, because a batch id is not a listing id.
   The web goes to `{batchBasePath}/batch/{batch_id}`, a route this app does
   not have. **The row is now not pressable at all** — `Row` renders
   unpressable without `onPress`, which is honest, where a control that lands
   somewhere wrong is not.

### Carried into later phases

- **The batch-detail screen is a real dependency.** Until it exists this list
  is read-only. It is not in the plan's scope list; decide whether it joins.
- The empty state is **not reachable from the fixture** — every filter has at
  least one row. Phase 3 must force it.
- `buyer_bid_id` is still unresolved: the web keys rows on it, the type does
  not declare it. Phase 2 looks at one real response and settles it.
