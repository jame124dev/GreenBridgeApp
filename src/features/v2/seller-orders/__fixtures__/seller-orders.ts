/**
 * PHASE 1 fixture. Deleted at phase 2 — the file stays, the import goes.
 *
 * ⚠️ No `buyer` field on any row — see `types.ts`'s security note.
 *
 * | # | Status | The case it covers |
 * |---|---|---|
 * | 1 | `pending` | Accept order / Cancel order — the REAL live case (all 4 real rows for seller 571 are this) |
 * | 2 | `confirmed` | Mark shipped / Cancel order — a DIFFERENT pair than pending's |
 * | 3 | `ready` | **no action buttons at all** — the web's own action UI cannot reach or leave this stage; still renders correctly via the canonical 7-stage table |
 * | 4 | `shipped` | Mark delivered — single button, no cancel |
 * | 5 | `delivered` | Complete order — single button |
 * | 6 | `completed` | terminal — no buttons |
 * | 7 | `cancelled` | terminal — no buttons |
 * | 8 | `pending`, `payment_status: manual_received`, no `batch` join, quantity 4 | the other payment label, title fallback, ×N suffix |
 * | 9 | `confirmed`, dead image URL, 110-char title | `onError` fallback + truncation together |
 */
import type { SellerCheckout } from '../types';

const LOADABLE_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGPwyo7CihgGUgIA4Vgy0UomEaEAAAAASUVORK5CYII=';

export const SELLER_ORDER_FIXTURE: readonly SellerCheckout[] = [
  {
    checkout_id: 4,
    batch_id: 484,
    buyer_id: 574,
    quantity: 1,
    total_price: 345,
    currency: 'USD',
    status: 'pending',
    payment_status: 'pending',
    createdAt: '2026-09-20T09:00:00Z',
    batch: { batch_number: 465, products: [{ title: 'T 1200 Tested Private', image1: LOADABLE_IMAGE }] },
  },
  {
    checkout_id: 88,
    batch_id: 5044,
    buyer_id: 574,
    quantity: 1,
    total_price: 30667,
    currency: 'USD',
    status: 'confirmed',
    payment_status: 'success',
    createdAt: '2026-09-18T09:00:00Z',
    batch: { batch_number: 5044, products: [{ title: 'N9952A Handheld Spectrum Analyzer', image1: LOADABLE_IMAGE }] },
  },
  {
    checkout_id: 90,
    batch_id: 4655,
    buyer_id: 580,
    quantity: 1,
    total_price: 532,
    currency: 'USD',
    status: 'ready',
    payment_status: 'success',
    createdAt: '2026-09-16T09:00:00Z',
    batch: { batch_number: 4655, products: [{ title: 'Mettler Toledo XPE205 Analytical Balance', image1: LOADABLE_IMAGE }] },
  },
  {
    checkout_id: 91,
    batch_id: 4188,
    buyer_id: 581,
    quantity: 1,
    total_price: 8950,
    currency: 'USD',
    status: 'shipped',
    payment_status: 'success',
    createdAt: '2026-09-10T09:00:00Z',
    batch: { batch_number: 4188, products: [{ title: 'Thermo Scientific Sorvall RC-6 Plus Centrifuge', image1: LOADABLE_IMAGE }] },
  },
  {
    checkout_id: 93,
    batch_id: 3990,
    buyer_id: 582,
    quantity: 2,
    total_price: 1500,
    currency: 'USD',
    status: 'delivered',
    payment_status: 'success',
    createdAt: '2026-08-20T09:00:00Z',
    batch: { batch_number: 3990, products: [{ title: 'Waters ACQUITY UPLC Column Kit', image1: LOADABLE_IMAGE }] },
  },
  {
    checkout_id: 97,
    batch_id: 4870,
    buyer_id: 583,
    quantity: 1,
    total_price: 8950,
    currency: 'USD',
    status: 'completed',
    payment_status: 'success',
    createdAt: '2026-07-15T09:00:00Z',
    batch: { batch_number: 4870, products: [{ title: 'Bruker AVANCE III HD 400 MHz NMR', image1: LOADABLE_IMAGE }] },
  },
  {
    checkout_id: 95,
    batch_id: 3801,
    buyer_id: 584,
    quantity: 1,
    total_price: 210,
    currency: 'USD',
    status: 'cancelled',
    payment_status: 'failed',
    createdAt: '2026-08-01T09:00:00Z',
    batch: { batch_number: 3801, products: [{ title: 'Rigol DP832 Power Supply', image1: LOADABLE_IMAGE }] },
  },
  {
    checkout_id: 10,
    batch_id: 484,
    buyer_id: 574,
    quantity: 4,
    total_price: 1380,
    currency: 'USD',
    status: 'pending',
    payment_status: 'manual_received',
    createdAt: null,
    // No `batch` at all — the live response can omit the join entirely.
  },
  {
    checkout_id: 99,
    batch_id: 4310,
    buyer_id: 585,
    quantity: 1,
    total_price: 41000,
    currency: 'USD',
    status: 'confirmed',
    payment_status: 'success',
    createdAt: '2026-09-14T09:00:00Z',
    batch: {
      batch_number: 4310,
      products: [
        {
          title:
            'Waters ACQUITY UPLC H-Class Bio System with Quaternary Solvent Manager and Sample Manager FTN',
          // Resolves to nothing. Without `onError` this is a silent empty box.
          image1: 'https://example.invalid/4310.jpg',
        },
      ],
    },
  },
];
