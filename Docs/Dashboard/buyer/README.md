# Buyer dashboard — pages and build order

Six pages. Each has its own directory with a `README.md` (the facts) and three
phase files. Shared decisions — data layer, what copies vs rebuilds, scope —
are in [`../README.md`](../README.md); they are not repeated here.

## Build order

The order is not the order of the tabs. It is cheapest-to-learn first, and the
composition screen last.

| # | Page | Why here | Web source |
|---|---|---|---|
| 1 | [`my-bids/`](my-bids/) | The highest-value question a buyer has, and it exercises everything once: tab-filtered list, status map, pagination, empty state, detail push. **It also becomes the seller's bids screen** — see `../seller/bids/`. | `shared/pages/buyer/MyBids.tsx` (402) |
| 2 | [`inspections/`](inspections/) | Read-only, small, same list shape. Confirms the pattern from 1 generalises before anything harder. | `shared/pages/buyer/MyInspections.tsx` (343) |
| 3 | [`watchlist/`](watchlist/) | Smallest file here (187 lines, 62% markup). One trap: a `window` event that does not exist in RN. | `features/buyer/pages/buyer/BuyerWatchlist.tsx` (187) |
| 4 | [`requests/`](requests/) | Orders and offers as one list. Bigger, and the route does not render what its name suggests. | `features/buyer/pages/buyer/BuyerRequests.tsx` (570) |
| 5 | [`order-detail/`](order-detail/) | Needs 4 to navigate from. `Timeline` already exists in the kit, so the hard part is done. | `features/buyer/pages/order/BuyerOrder.tsx` (336) |
| 6 | [`dashboard/`](dashboard/) | **Last.** It is a composition of rows the five screens above define; built first, those rows get invented twice. | `shared/pages/buyer/BuyerDashboard.tsx` (1,103) |

## Already native — do not rebuild

**Wants** and **matches** are shipped: `app/v2/matches.tsx`, and the "Your
wants" / "Matched for you" sections of `src/features/v2/home/BuyingPane.tsx`.
The web's `/buyer/wants` is the same feature.

## Out of scope

`/buyer/checkout` — payment finishes on the web. `navPolicy.ts` already sends
payment redirects to the system browser, and a native payment flow in a store
app raises App Review questions this app has been rejected over twice.

`/buyer/profile-setting`, `/buyer/company-organization` — desk work, and the
app has its own account screen.

## ⚠️ Two dead files in this area

`pages/buyer/orders/BuyerOrders.tsx` (434 lines) and
`pages/buyer/offers/BuyerOffers.tsx` (449 lines) are imported by **nothing** —
checked across `src/` and `app/`. They look like the obvious sources for
orders and offers and they are not. The live route renders `BuyerRequests.tsx`.
An earlier draft of the parent plan cited `BuyerOrders.tsx` and would have sent
someone to port an orphan.
