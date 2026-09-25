# Inspections (buyer)

> What did the inspection find?

| | |
|---|---|
| **Web source** | `src/shared/pages/buyer/MyInspections.tsx` (343 lines, 78% markup) |
| **Route (mobile)** | `/v2/buying/inspections` |
| **Web data hooks** | `useGetBuyerInspectionsQuery` |

Read-mostly and small: a good second screen once `my-bids` has settled the list pattern.

## Endpoints

| Method | URL | Defined at | Notes |
|---|---|---|---|
| `GET` | `/inspection/buyer/{buyerId}?<params>&type=LabGreenbidz` | `buyerApiSlice.ts:332` | list + filters |

All of these are the backend the app already talks to. Site identity differs by
platform: the web appends `?type=LabGreenbidz`, this app sends the `x-platform`
header (`src/api/greenbidzClient.ts:10`). See `../../README.md` § 2.

## Phases

1. [`phase-1-ui.md`](phase-1-ui.md) — place the UI. No network.
2. [`phase-2-api.md`](phase-2-api.md) — plug the real query.
3. [`phase-3-states.md`](phase-3-states.md) — states, edges, device sign-off.
