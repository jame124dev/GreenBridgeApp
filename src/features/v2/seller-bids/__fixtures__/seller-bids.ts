/**
 * PHASE 1 fixture. Deleted at phase 2 — the file stays, the import goes.
 *
 * | # | The case it covers |
 * |---|---|
 * | 1 | `summary.total: 0` — the REAL live shape (seller 571's sampled page).
 *       Must be filtered OUT by `hasBidActivity`, not just shown as "0 bids". |
 * | 2 | pending only — the accent tone, "N pending" in the stat line |
 * | 3 | accepted only |
 * | 4 | mixed: pending + accepted + rejected + counter_offer, all four real fields |
 * | 5 | multi-product batch (3 products) — the "+2" badge on the thumbnail |
 * | 6 | no image, no title — the placeholder + batch-number fallback |
 * | 7 | dead image URL — `onError` fallback |
 * | 8 | 108-character title, single bid |
 */
import type { SellerBidBatch } from '../types';

const LOADABLE_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGPwyo7CihgGUgIA4Vgy0UomEaEAAAAASUVORK5CYII=';

export const SELLER_BID_FIXTURE: readonly SellerBidBatch[] = [
  {
    batch_id: 3043,
    status: 'publish',
    products: [{ title: '三菱變頻除濕機', images: [LOADABLE_IMAGE] }],
    isAuction: false,
    summary: { total: 0, pending: 0, accepted: 0, rejected: 0, counter_offer: 0 },
  },
  {
    batch_id: 5091,
    status: 'publish',
    products: [{ title: 'Keysight EDUX1002G Oscilloscope', images: [LOADABLE_IMAGE] }],
    isAuction: true,
    summary: { total: 2, pending: 2, accepted: 0, rejected: 0, counter_offer: 0 },
  },
  {
    batch_id: 4870,
    status: 'sold',
    products: [{ title: 'Thermo Scientific Sorvall RC-6 Plus Centrifuge', images: [LOADABLE_IMAGE] }],
    isAuction: true,
    summary: { total: 1, pending: 0, accepted: 1, rejected: 0, counter_offer: 0 },
  },
  {
    batch_id: 4655,
    status: 'publish',
    products: [{ title: 'Mettler Toledo XPE205 Analytical Balance', images: [LOADABLE_IMAGE] }],
    isAuction: true,
    summary: { total: 5, pending: 1, accepted: 1, rejected: 2, counter_offer: 1 },
  },
  {
    batch_id: 4402,
    status: 'publish',
    products: [
      { title: 'Bruker AVANCE III HD 400 MHz NMR', images: [LOADABLE_IMAGE] },
      { title: 'NMR Sample Tubes (Box of 100)', images: [] },
      { title: 'NMR Probe Head, Broadband', images: [] },
    ],
    isAuction: true,
    summary: { total: 3, pending: 3, accepted: 0, rejected: 0, counter_offer: 0 },
  },
  {
    batch_id: 4310,
    status: 'publish',
    products: [],
    isAuction: true,
    summary: { total: 1, pending: 1, accepted: 0, rejected: 0, counter_offer: 0 },
  },
  {
    batch_id: 4188,
    status: 'publish',
    products: [
      {
        title: 'Waters ACQUITY UPLC H-Class Bio System',
        // Resolves to nothing. Without `onError` this is a silent empty box.
        images: ['https://example.invalid/4188.jpg'],
      },
    ],
    isAuction: true,
    summary: { total: 1, pending: 1, accepted: 0, rejected: 0, counter_offer: 0 },
  },
  {
    batch_id: 3990,
    status: 'publish',
    products: [
      {
        title:
          '2025 Watson-Marlow 730 SN/R Peristaltic Pump — 720R Head, 0.12–2000 L/h, IP66 Manual — New — Taiwan',
        images: [LOADABLE_IMAGE],
      },
    ],
    isAuction: true,
    summary: { total: 1, pending: 1, accepted: 0, rejected: 0, counter_offer: 0 },
  },
];
