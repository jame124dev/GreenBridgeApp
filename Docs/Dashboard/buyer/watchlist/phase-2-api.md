# Phase 2 — plug the API

Goal: the fixture is gone and the screen renders real data from the backend the
web already uses.

## 🛑 STOP — this endpoint is the unauthenticated IDOR

`GET /wishlist/{buyerId}` **has no auth guard on prod.** Any id in the path
returns that user's saved items, and the same route class allows writes. It is
one of 21 unguarded identity routes enumerated in
`Docs/v2/SECURITY-WISHLIST.md` (confirmed by request against dev, and by code
inspection of `origin/main` for prod).

Phase 1 shipped without it — the screen renders a fixture and makes no call.
**Phase 2 does not.** Wiring this is a decision about shipping a "saved items"
screen on a route that leaks buying intent, and it is the user's to make, not a
wiring task to tick off. Two things to settle before writing the query:

1. Does the backend fix land first? The fix is a coordinated backend + web
   release, already scoped, not yet scheduled.
2. If mobile ships first, does it go behind `__DEV__` like the bids row, so the
   app is not a third client depending on an unguarded route?

Everything below assumes that decision has been made.

## Endpoints

| Method | URL | Defined at | Notes |
|---|---|---|---|
| `GET` | `/wishlist/{buyerId}` | `BuyerWatchlist.tsx:38` | ⚠️ NOT in any RTK slice — a direct axios call. Items at `res.data.data.wishlist`. |

The response type and its mapper are **already transcribed** — phase 1 did it:
`src/features/v2/watchlist/types.ts` carries `WishlistRow`, `WishCard` and
`toWishCards()` (the `attachments` → `image1` fallback, the `&amp;` unescape
and the `batch_id || product_id` choice, all from `BuyerWatchlist.tsx:48-62`).
Phase 2 replaces one import, not the mapping.

## How

- **React Query, not RTK.** This app has no Redux (`@reduxjs/toolkit` and
  `react-redux` are both absent; `@tanstack/react-query@^5` and `axios@^1` are
  present). Copy the URL, the params and the response TYPE verbatim out of the
  web slice into a `useQuery` in `src/services/`. That transcription is ~10
  lines and is where the copying pays off.
- Use the existing `greenbidzClient` — auth and the `x-platform` header are
  already on it.
- Keep the query key namespaced to the screen so phase 3 can invalidate it.

## Watch for

- The web sends `?type=LabGreenbidz`; this app sends `x-platform`. If a route
  answers differently, that is the first thing to check.
- Pagination params copy verbatim — do not re-derive them.
- If a mutation is involved, `invalidateQueries` is not optional: a list that
  does not refresh after a write is the "stale landing" failure recorded in the
  workspace `CLAUDE.md`.

## Done when

- Real rows render on the device, signed in as a real account.
- Loading and error paths both reachable and both handled.
- The request is visible in the network log with the expected URL and params.
