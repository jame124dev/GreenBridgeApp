# Offers received (seller)

> Someone offered on my listing — accept or decline?

| | |
|---|---|
| **Web source** | `src/features/buyer/pages/offer/SellerOffer.tsx` (306 lines) |
| **Route (mobile)** | `/v2/selling/offers` |
| **Web data hooks** | `useGetOwnerOffersQuery, useUpdateOfferStatusMutation` |

First screen with a **write**. It changes money state, so it needs a confirm step and a real error path — not just a spinner.

## Endpoints

| Method | URL | Defined at | Notes |
|---|---|---|---|
| `GET` | `/offer/seller?<params>` | `bidApiSlice.ts:653` | the list |
| `PUT` | `/offer/{offer_id}/status?type=LabGreenbidz` | `bidApiSlice.ts:665` | accept / decline — **the first mutation in this plan** |

All of these are the backend the app already talks to. Site identity differs by
platform: the web appends `?type=LabGreenbidz`, this app sends the `x-platform`
header (`src/api/greenbidzClient.ts:10`). See `../../README.md` § 2.

## Phases

1. [`phase-1-ui.md`](phase-1-ui.md) — place the UI. No network.
2. [`phase-2-api.md`](phase-2-api.md) — plug the real query.
3. [`phase-3-states.md`](phase-3-states.md) — states, edges, device sign-off.
