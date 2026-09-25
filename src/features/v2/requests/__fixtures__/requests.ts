/**
 * PHASE 1 fixture. Deleted at phase 2 — the file stays, the import goes.
 *
 * Raw rows (`OrderRow` / `OfferRow`), not merged `RequestItem`s, so
 * `orderToRequestItem`/`offerToRequestItem` run on this data rather than
 * being assumed. One row per bucket, per the plan's own rule, plus the real
 * edge cases seen live against buyer 574 on 2026-09-24.
 *
 * | # | Kind | Bucket | The case it covers |
 * |---|---|---|---|
 * | 1 | offer | action (`accepted`) | the urgency line, "Your turn" |
 * | 2 | offer | action (`payment_processing`) | the OTHER accepted state |
 * | 3 | offer | awaiting (`pending`) | the common case — all 7 live rows are this |
 * | 4 | offer | completed (`sold`) | |
 * | 5 | offer | closed (`rejected`) | |
 * | 6 | offer | awaiting, **no `products` join** | seen live 3× for buyer 574 — no title, no image, no currency |
 * | 7 | buy_now | confirmed (`pending`) | **orders never carry a title/image** — bare row, by design |
 * | 8 | buy_now | in_progress (`shipped`) | |
 * | 9 | buy_now | completed (`delivered`) | |
 * | 10 | buy_now | closed (`cancelled`) | |
 * | 11 | offer | awaiting, **106-char title**, dead image URL | truncation + `onError` fallback together |
 */
import type { OfferRow, OrderRow } from '../types';

/** 8×6 solid PNG — always loads, needs no network. */
const LOADABLE_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGPwyo7CihgGUgIA4Vgy0UomEaEAAAAASUVORK5CYII=';

export const OFFER_FIXTURE: readonly OfferRow[] = [
  {
    offer_id: 301,
    batch_id: 5091,
    offer_price: '12400',
    status: 'accepted',
    createdAt: '2026-09-10T09:00:00Z',
    batch: { currency: 'USD', products: [{ title: 'Keysight EDUX1002G Oscilloscope', image1: LOADABLE_IMAGE }] },
  },
  {
    offer_id: 302,
    batch_id: 4870,
    offer_price: '8950',
    status: 'payment_processing',
    createdAt: '2026-09-08T09:00:00Z',
    batch: { currency: 'USD', products: [{ title: 'Thermo Scientific Sorvall RC-6 Plus Centrifuge', image1: LOADABLE_IMAGE }] },
  },
  {
    offer_id: 159,
    batch_id: 2760,
    offer_price: '33',
    status: 'pending',
    createdAt: '2026-09-20T11:00:00Z',
    batch: { currency: 'USD', products: [{ title: 'BUCHI KjelFlex K-360 Kjeldahl Distillation Unit', image1: LOADABLE_IMAGE }] },
  },
  {
    offer_id: 290,
    batch_id: 4402,
    offer_price: '2100',
    status: 'sold',
    createdAt: '2026-08-30T09:00:00Z',
    batch: { currency: 'USD', products: [{ title: 'Mettler Toledo XPE205 Analytical Balance', image1: LOADABLE_IMAGE }] },
  },
  {
    offer_id: 285,
    batch_id: 4310,
    offer_price: '41000',
    status: 'rejected',
    createdAt: '2026-08-25T09:00:00Z',
    batch: { currency: 'USD', products: [{ title: 'Bruker AVANCE III HD 400 MHz NMR', image1: LOADABLE_IMAGE }] },
  },
  // Real shape, seen 3× live for buyer 574: no `products` join at all.
  {
    offer_id: 178,
    batch_id: 2437,
    offer_price: '34',
    status: 'pending',
    createdAt: '2026-09-15T09:00:00Z',
    batch: { currency: null, products: [] },
  },
  {
    offer_id: 311,
    batch_id: 4655,
    offer_price: '670',
    status: 'pending',
    createdAt: '2026-09-05T09:00:00Z',
    batch: {
      currency: 'USD',
      products: [
        {
          title:
            'Waters ACQUITY UPLC H-Class Bio System with Quaternary Solvent Manager and Sample Manager FTN — spares lot',
          // Resolves to nothing. Without `onError` this is a silent empty box.
          image1: 'https://example.invalid/4655.jpg',
        },
      ],
    },
  },
];

export const ORDER_FIXTURE: readonly OrderRow[] = [
  {
    order_id: 9001,
    order_number: 'GB-9001',
    batch_id: 5044,
    total_price: '30667',
    currency: 'USD',
    status: 'pending',
    createdAt: '2026-09-18T09:00:00Z',
  },
  {
    order_id: 9002,
    order_number: 'GB-9002',
    batch_id: 4188,
    total_price: '532',
    currency: 'USD',
    status: 'shipped',
    createdAt: '2026-09-12T09:00:00Z',
  },
  {
    order_id: 9003,
    order_number: 'GB-9003',
    batch_id: 3990,
    total_price: '1500',
    currency: 'USD',
    status: 'delivered',
    createdAt: '2026-08-20T09:00:00Z',
  },
  {
    order_id: 9004,
    order_number: 'GB-9004',
    batch_id: 3801,
    total_price: '210',
    currency: 'USD',
    status: 'cancelled',
    createdAt: '2026-08-01T09:00:00Z',
  },
];
