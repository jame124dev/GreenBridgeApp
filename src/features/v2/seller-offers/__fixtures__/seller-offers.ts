/**
 * PHASE 1 fixture. Deleted at phase 2 — the file stays, the import goes.
 *
 * ⚠️ No `buyer` field on any row here — see `types.ts`'s security note.
 * `SellerOfferItem.buyer` exists to type the live response's shape so
 * nothing accidentally reads it; the fixture never needs to fill it.
 *
 * | # | Status | The case it covers |
 * |---|---|---|
 * | 1 | `pending` | Accept / Reject buttons, the common live case (all 4 real rows for seller 571 are this) |
 * | 2 | `pending`, with a message | the quoted message line |
 * | 3 | `payment_processing` | Mark sold / Decline buttons — a DIFFERENT pair than pending's |
 * | 4 | `sold` | terminal — no buttons at all |
 * | 5 | `rejected` | terminal — no buttons at all |
 * | 6 | `pending`, no `batch` join, quantity 3 | title fallback, the ×N quantity suffix |
 * | 7 | `pending`, dead image URL, 104-char title | `onError` fallback + truncation together |
 */
import type { SellerOfferItem } from '../types';

const LOADABLE_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGPwyo7CihgGUgIA4Vgy0UomEaEAAAAASUVORK5CYII=';

export const SELLER_OFFER_FIXTURE: readonly SellerOfferItem[] = [
  {
    offer_id: 8,
    batch_id: 491,
    user_id: 574,
    offer_price: '455.00',
    offer_quantity: 1,
    message: null,
    status: 'pending',
    createdAt: '2026-09-20T09:00:00Z',
    batch: { batch_number: 472, products: [{ title: 'Waterjet Cutting Machine', image1: LOADABLE_IMAGE }] },
  },
  {
    offer_id: 7,
    batch_id: 5044,
    user_id: 574,
    offer_price: '28000.00',
    offer_quantity: 1,
    message: 'Would you take 28k if I pick up this week?',
    status: 'pending',
    createdAt: '2026-09-18T09:00:00Z',
    batch: { batch_number: 5044, products: [{ title: 'N9952A Handheld Spectrum Analyzer', image1: LOADABLE_IMAGE }] },
  },
  {
    offer_id: 6,
    batch_id: 4870,
    user_id: 580,
    offer_price: '8500.00',
    offer_quantity: 1,
    message: null,
    status: 'payment_processing',
    createdAt: '2026-09-12T09:00:00Z',
    batch: { batch_number: 4870, products: [{ title: 'Thermo Scientific Sorvall RC-6 Plus Centrifuge', image1: LOADABLE_IMAGE }] },
  },
  {
    offer_id: 5,
    batch_id: 4402,
    user_id: 581,
    offer_price: '2000.00',
    offer_quantity: 1,
    message: null,
    status: 'sold',
    createdAt: '2026-08-30T09:00:00Z',
    batch: { batch_number: 4402, products: [{ title: 'Bruker AVANCE III HD 400 MHz NMR', image1: LOADABLE_IMAGE }] },
  },
  {
    offer_id: 4,
    batch_id: 4310,
    user_id: 582,
    offer_price: '38000.00',
    offer_quantity: 1,
    message: null,
    status: 'rejected',
    createdAt: '2026-08-20T09:00:00Z',
    batch: { batch_number: 4310, products: [{ title: 'Waters ACQUITY UPLC H-Class Bio System', image1: LOADABLE_IMAGE }] },
  },
  {
    offer_id: 3,
    batch_id: 3801,
    user_id: 583,
    offer_price: '150.00',
    offer_quantity: 3,
    message: null,
    status: 'pending',
    createdAt: '2026-09-19T09:00:00Z',
    // No `batch` join at all — the live response can omit it entirely.
  },
  {
    offer_id: 2,
    batch_id: 3990,
    user_id: 584,
    offer_price: '1350.00',
    offer_quantity: 1,
    message: null,
    status: 'pending',
    createdAt: '2026-09-05T09:00:00Z',
    batch: {
      batch_number: 3990,
      products: [
        {
          title:
            '2025 Watson-Marlow 730 SN/R Peristaltic Pump — 720R Head, 0.12–2000 L/h, IP66 Manual, New',
          // Resolves to nothing. Without `onError` this is a silent empty box.
          image1: 'https://example.invalid/3990.jpg',
        },
      ],
    },
  },
];
