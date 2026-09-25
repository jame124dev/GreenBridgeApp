# My bids (buyer)

> Am I still winning, and what did I win or lose?

| | |
|---|---|
| **Web source** | `src/shared/pages/buyer/MyBids.tsx` (402 lines, 84% markup) |
| **Route (mobile)** | `/v2/buying/bids` |
| **Web data hooks** | `useGetBuyerBidsQuery, useGetBatchTopBidQuery` |

⚠️ **This one screen serves the seller too.** `SellerMyBids.tsx` is 15 lines: `<MyBids batchBasePath="/dashboard/buying" />`. Build it once with a `mode` prop; see `seller/bids/`.

## Endpoints

| Method | URL | Defined at | Notes |
|---|---|---|---|
| `GET` | `/buyer/bid/buyer/{buyerId}?<params>&type=LabGreenbidz` | `services/api/slices/buyerApiSlice.ts:274` | the list; params carry status + pagination |
| `GET` | `/buyer/bid/batch/{batch_id}/top?type=LabGreenbidz` | `services/api/slices/bidApiSlice.ts:472` | the current top bid — this is what makes a row read OUTBID |

⚠️ Three copies of each slice exist in `nextjs-port`; the live one is
`src/services/api/slices/`. See `phase-2-api.md` for why.

All of these are the backend the app already talks to. Site identity differs by
platform: the web appends `?type=LabGreenbidz`, this app sends the `x-platform`
header (`src/api/greenbidzClient.ts:10`). See `../../README.md` § 2.

## Phases

1. [`phase-1-ui.md`](phase-1-ui.md) — place the UI. No network.
2. [`phase-2-api.md`](phase-2-api.md) — plug the real query.
3. [`phase-3-states.md`](phase-3-states.md) — states, edges, device sign-off.
