# Phase 2 — plug the API

Goal: the fixture is gone and the screen renders real data from the backend the
web already uses.

## Endpoints

| Method | URL | Defined at | Notes |
|---|---|---|---|
| `GET` | `/buyer/bid/buyer/{buyerId}?<params>&type=LabGreenbidz` | `services/api/slices/buyerApiSlice.ts:274` (URL at :315) | the list; params carry status + pagination |
| `GET` | `/buyer/bid/batch/{batch_id}/top?type=LabGreenbidz` | `services/api/slices/bidApiSlice.ts:472` | the current top bid — this is what makes a row read OUTBID |

⚠️ **`nextjs-port` holds THREE copies of each slice** — `src/rtk/slices/`,
`src/scanflow/rtk/slices/` and `src/services/api/slices/` — all defining
`BuyerBidItem` at line 34 and differing only in how they resolve the site type.
The live one is **`src/services/api/slices/`**, which is what
`shared/pages/buyer/MyBids.tsx:25-26` imports. Always cite the directory.

⚠️ Mobile sends site identity as the **`x-platform` header**
(`src/api/greenbidzClient.ts:10`), not as the web's `?type=` query param. Copy
the endpoint, not the query string.

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
