# Buying home (buyer)

> What needs my attention right now?

| | |
|---|---|
| **Web source** | `src/shared/pages/buyer/BuyerDashboard.tsx` (1103 lines) |
| **Route (mobile)** | `/v2/buying` |
| **Web data hooks** | `useGetBuyerBidsQuery, useGetBuyerInspectionsQuery, useGetUserOffersQuery` |

This screen is the LAST to build, not the first: it is a composition of rows that the other screens define. Building it early means inventing those rows twice.

## Endpoints

| Method | URL | Defined at | Notes |
|---|---|---|---|
| `GET` | `/buyer/dashboard/{buyerId}?type=LabGreenbidz` | `buyerApiSlice.ts:265` | counts + summary |
| `GET` | `/offer/user` | `bidApiSlice.ts:641` | the buyer's own offers |

All of these are the backend the app already talks to. Site identity differs by
platform: the web appends `?type=LabGreenbidz`, this app sends the `x-platform`
header (`src/api/greenbidzClient.ts:10`). See `../../README.md` § 2.

## Phases

1. [`phase-1-ui.md`](phase-1-ui.md) — place the UI. No network.
2. [`phase-2-api.md`](phase-2-api.md) — plug the real query.
3. [`phase-3-states.md`](phase-3-states.md) — states, edges, device sign-off.
