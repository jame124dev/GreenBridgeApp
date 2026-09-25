# Bids on my listings (seller)

> What are people bidding on my equipment?

| | |
|---|---|
| **Web source** | `src/features/seller/pages/Seller/buying/SellerMyBids.tsx` (15 lines) |
| **Route (mobile)** | `/v2/selling/bids` |
| **Web data hooks** | `(delegates to MyBids)` |

⚠️ **Do not build this as its own screen.** The web proves it is the buyer screen with one prop. On mobile: one component, a `mode: 'buyer' | 'seller'` prop that chooses the endpoint and the row's emphasis. This phase is an extension of `buyer/my-bids`, not a new build.

## Endpoints

| Method | URL | Defined at | Notes |
|---|---|---|---|
| `GET` | `/seller/bids/{sellerId}?type=LabGreenbidz` | `buyerApiSlice.ts:323` | the seller's side of the same list |

All of these are the backend the app already talks to. Site identity differs by
platform: the web appends `?type=LabGreenbidz`, this app sends the `x-platform`
header (`src/api/greenbidzClient.ts:10`). See `../../README.md` § 2.

## Phases

1. [`phase-1-ui.md`](phase-1-ui.md) — place the UI. No network.
2. [`phase-2-api.md`](phase-2-api.md) — plug the real query.
3. [`phase-3-states.md`](phase-3-states.md) — states, edges, device sign-off.
