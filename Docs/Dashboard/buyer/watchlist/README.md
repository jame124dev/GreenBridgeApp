# Watchlist (buyer)

> What am I keeping an eye on?

| | |
|---|---|
| **Web source** | `src/features/buyer/pages/buyer/BuyerWatchlist.tsx` (187 lines, 62% markup) |
| **Route (mobile)** | `/v2/dashboard/watchlist` ✅ built (phase 1) |
| **Web data hooks** | `(none — raw axios)` |

Smallest page here (187 lines, 62% markup). Good candidate for whoever is new to the kit.

## Endpoints

| Method | URL | Defined at | Notes |
|---|---|---|---|
| `GET` | `/wishlist/{buyerId}` | `BuyerWatchlist.tsx:38` | ⚠️ NOT in any RTK slice — a direct axios call. Items at `res.data.data.wishlist`. |

All of these are the backend the app already talks to. Site identity differs by
platform: the web appends `?type=LabGreenbidz`, this app sends the `x-platform`
header (`src/api/greenbidzClient.ts:10`). See `../../README.md` § 2.

## Phases

1. [`phase-1-ui.md`](phase-1-ui.md) — place the UI. No network.
2. [`phase-2-api.md`](phase-2-api.md) — plug the real query.
3. [`phase-3-states.md`](phase-3-states.md) — states, edges, device sign-off.
