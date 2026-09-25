# Orders (checkouts) (seller)

> Who has paid, and what do I owe them?

| | |
|---|---|
| **Web source** | `src/features/buyer/pages/order/SellerOrder.tsx` (367 lines) |
| **Route (mobile)** | `/v2/selling/orders` |
| **Web data hooks** | `useGetSellerCheckoutsQuery, useUpdateCheckoutStatusMutation` |

⚠️ The filename says Order and the query says Checkout. An earlier draft of the parent plan cited `/order/seller/{sellerId}` for this screen and was wrong. Trust the hook, not the name.

## Endpoints

| Method | URL | Defined at | Notes |
|---|---|---|---|
| `GET` | `/checkouts/seller/{sellerId}?<params>` | `checkoutApiSlice.ts:73` | ⚠️ **checkouts, not `/order/seller`** — the page name is misleading |
| `PUT` | `/checkouts/{checkoutId}/status` | `checkoutApiSlice.ts:92` | advance the state |

All of these are the backend the app already talks to. Site identity differs by
platform: the web appends `?type=LabGreenbidz`, this app sends the `x-platform`
header (`src/api/greenbidzClient.ts:10`). See `../../README.md` § 2.

## Phases

1. [`phase-1-ui.md`](phase-1-ui.md) — place the UI. No network.
2. [`phase-2-api.md`](phase-2-api.md) — plug the real query.
3. [`phase-3-states.md`](phase-3-states.md) — states, edges, device sign-off.
