# Order detail & tracking (buyer)

> Where is my equipment and what happens next?

| | |
|---|---|
| **Web source** | `src/features/buyer/pages/order/BuyerOrder.tsx` (336 lines) |
| **Route (mobile)** | `/v2/buying/orders/[id]` |
| **Web data hooks** | `useGetBuyerCheckoutsQuery` |

The single best argument for this whole plan: the hardest component on the hardest screen already exists in the kit.

## Endpoints

| Method | URL | Defined at | Notes |
|---|---|---|---|
| `GET` | `/checkouts/buyer/{buyerId}` | `checkoutApiSlice.ts:65` | ⚠️ the detail is a CHECKOUT, not an order |
| `GET` | `/shipment/order/{orderId}` | `shipmentApiSlice.ts:151` | the tracking events |

All of these are the backend the app already talks to. Site identity differs by
platform: the web appends `?type=LabGreenbidz`, this app sends the `x-platform`
header (`src/api/greenbidzClient.ts:10`). See `../../README.md` § 2.

## Phases

1. [`phase-1-ui.md`](phase-1-ui.md) — place the UI. No network.
2. [`phase-2-api.md`](phase-2-api.md) — plug the real query.
3. [`phase-3-states.md`](phase-3-states.md) — states, edges, device sign-off.
