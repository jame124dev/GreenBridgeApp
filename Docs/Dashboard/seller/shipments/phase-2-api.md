# Phase 2 — plug the API

Goal: the fixture is gone and the screen renders real data from the backend the
web already uses.

## Endpoints

| Method | URL | Defined at | Notes |
|---|---|---|---|
| `GET` | `/shipment?<qs>` | `shipmentApiSlice.ts:163` | the list |
| `GET` | `/shipment/order/{orderId}` | `shipmentApiSlice.ts:151` | one order's events |

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
