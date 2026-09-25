# Seller dashboard — pages and build order

Four pages, and the first one is not a build. Shared decisions are in
[`../README.md`](../README.md).

The web has **44** routes under `(seller)/dashboard`. Four are here. The test
applied: *would someone do this standing up, away from their desk?*

## Build order

| # | Page | Why here | Web source |
|---|---|---|---|
| 1 | [`bids/`](bids/) | **Not a new screen.** `SellerMyBids.tsx` is 15 lines: `<MyBids batchBasePath="/dashboard/buying" />`. It is the buyer's screen with a prop. Do this as an extension of `../buyer/my-bids/` and the seller side costs a day, not a week. | `Seller/buying/SellerMyBids.tsx` (15) |
| 2 | [`offers/`](offers/) | The first **write** in the whole plan — accept/decline changes money state, so it needs a confirm step and a real error path. | `features/buyer/pages/offer/SellerOffer.tsx` (306) |
| 3 | [`orders/`](orders/) | Needs the confirm-sheet pattern from 2. ⚠️ Queries **checkouts**, not orders. | `features/buyer/pages/order/SellerOrder.tsx` (367) |
| 4 | [`shipments/`](shipments/) | Last, and the least certain — the only page here with no web page confirmed as its source. | *(unread — see below)* |

## Out of scope, and why

| Area | Why not |
|---|---|
| `team`, `users`, `permissions`, `invitations`, `seller-network` | Org admin. Nobody invites a teammate from a phone. |
| `reports`, `sales-sync`, `buyer-activity` | Analysis. Small screen, wide tables, no. |
| `storefront`, `auto-approval`, `company-organization`, `settings` | Configuration — set once, at a desk. |
| `bulk-upload`, `new-listing`, `new-submission-upload` | The app's create path is the camera, deliberately. See `Docs/v2/WEB-PARITY.md` § "ONE DOOR vs TWO". |
| `auction-groups`, `batch-groups` | Structural seller tooling. |
| **`listings`** | **The app already has this natively** — `app/v2/listings.tsx` and `app/v2/drafts.tsx`. Do not port the web's. |

All of the above stay reachable on the phone through the marketplace WebView
if someone genuinely needs them.

## ⚠️ Before phase 1 of `shipments/`

This plan has **not read** `app/(seller)/dashboard/shipments/page.tsx`. The
endpoints are cited (`shipmentApiSlice.ts:163` and `:151`) but the screen is
not. Read it first. If it turns out thin, shipments should be a section inside
[`orders/`](orders/) rather than its own destination — decide that before
building, not after.
