# Orders & requests (buyer)

> What have I bought or asked for, and where is it?

| | |
|---|---|
| **Web source** | `src/features/buyer/pages/buyer/BuyerRequests.tsx` (570 lines) |
| **Route (mobile)** | `/v2/buying/orders` |
| **Web data hooks** | `useGetMyOrdersQuery` |

Read `app/(buyerdash)/buyer/orders/page.tsx:4-8` first — it records why this route no longer renders what its name suggests.

## Endpoints

| Method | URL | Defined at | Notes |
|---|---|---|---|
| `GET` | `/order/buyer/{buyerId}?page=1&limit={limit}` | `orderApiSlice.ts:85` | Buy Now purchases AND Make Offer requests in one list |

All of these are the backend the app already talks to. Site identity differs by
platform: the web appends `?type=LabGreenbidz`, this app sends the `x-platform`
header (`src/api/greenbidzClient.ts:10`). See `../../README.md` § 2.

## Phases

1. [`phase-1-ui.md`](phase-1-ui.md) — place the UI. No network.
2. [`phase-2-api.md`](phase-2-api.md) — plug the real query.
3. [`phase-3-states.md`](phase-3-states.md) — states, edges, device sign-off.
