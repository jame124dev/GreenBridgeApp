# Shipments (seller)

> What is in transit?

| | |
|---|---|
| **Web source** | `(no single page — the web spreads this across the order screens)` |
| **Route (mobile)** | `/v2/selling/shipments` |
| **Web data hooks** | `—` |

⚠️ The only screen here with **no web page to copy** — the web has a `/dashboard/shipments` route but this plan has not read it. Read it before phase 1, and if it is thin, this screen may be a section inside `seller/orders` rather than its own destination.

## Endpoints

| Method | URL | Defined at | Notes |
|---|---|---|---|
| `GET` | `/shipment?<qs>` | `shipmentApiSlice.ts:163` | the list |
| `GET` | `/shipment/order/{orderId}` | `shipmentApiSlice.ts:151` | one order's events |

All of these are the backend the app already talks to. Site identity differs by
platform: the web appends `?type=LabGreenbidz`, this app sends the `x-platform`
header (`src/api/greenbidzClient.ts:10`). See `../../README.md` § 2.

## Phases

1. [`phase-1-ui.md`](phase-1-ui.md) — place the UI. No network.
2. [`phase-2-api.md`](phase-2-api.md) — plug the real query.
3. [`phase-3-states.md`](phase-3-states.md) — states, edges, device sign-off.
