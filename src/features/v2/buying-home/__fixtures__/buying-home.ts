/**
 * PHASE 1 fixture. Deleted at phase 2 — the file stays, the import goes.
 *
 * Unlike every other page's fixture, this one is not one row per status —
 * it is shaped to exercise `buildActionItems()`'s three thresholds
 * specifically, since that derivation is this screen's one real logic:
 *
 * | Row | Triggers |
 * |---|---|
 * | bid, `batch_step: 6` | payment_due |
 * | bid, `batch_step: 7` | pickup_ready |
 * | bid, `batch_step: 3` | neither — the common case, must NOT appear in Action Required |
 * | inspection, 3 days out, `scheduled` | inspection_soon ("in 3 days") |
 * | inspection, 9 days out, `scheduled` | outside the 7-day window — must NOT appear |
 * | inspection, 1 day out, `attended` | already attended — must NOT appear even though it is soon |
 */
import type { BuyerBidItem } from '@/features/v2/bids/types';
import type { InspectionItem } from '@/features/v2/inspections/types';

const LOADABLE_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGPwyo7CihgGUgIA4Vgy0UomEaEAAAAASUVORK5CYII=';

const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

export const HOME_BIDS_FIXTURE: readonly BuyerBidItem[] = [
  {
    buyer_bid_id: 701,
    batch_id: 5091,
    bid_amount: '12400',
    end_date: '2026-09-25T09:00:00Z',
    bid_date: '2026-09-10T09:00:00Z',
    status: 'accepted',
    batch_step: 6,
    products: [{ title: 'Keysight EDUX1002G Oscilloscope', images: [LOADABLE_IMAGE] }],
  },
  {
    buyer_bid_id: 702,
    batch_id: 4870,
    bid_amount: '8950',
    end_date: '2026-09-20T09:00:00Z',
    bid_date: '2026-09-05T09:00:00Z',
    status: 'accepted',
    batch_step: 7,
    products: [{ title: 'Thermo Scientific Sorvall RC-6 Plus Centrifuge', images: [LOADABLE_IMAGE] }],
  },
  {
    buyer_bid_id: 703,
    batch_id: 5044,
    bid_amount: '30667',
    end_date: '2026-09-30T09:00:00Z',
    bid_date: '2026-09-18T09:00:00Z',
    status: 'pending',
    batch_step: 3,
    products: [{ title: 'N9952A Handheld Spectrum Analyzer', images: [LOADABLE_IMAGE] }],
  },
];

export const HOME_INSPECTIONS_FIXTURE: readonly InspectionItem[] = [
  {
    batch_id: 4655,
    inspection_number: 'INS-2026-0501',
    inspection_date: inDays(3),
    registered_date: '2026-09-20T09:00:00Z',
    status: 'scheduled',
    products: [{ title: 'Mettler Toledo XPE205 Analytical Balance', images: [], category: 'Balances' }],
  },
  {
    batch_id: 4310,
    inspection_number: 'INS-2026-0502',
    inspection_date: inDays(9),
    registered_date: '2026-09-19T09:00:00Z',
    status: 'scheduled',
    products: [],
  },
  {
    batch_id: 4188,
    inspection_number: 'INS-2026-0503',
    inspection_date: inDays(1),
    registered_date: '2026-09-01T09:00:00Z',
    status: 'attended',
    products: [{ title: 'Waters ACQUITY UPLC H-Class Bio System', images: [], category: 'Liquid Chromatography' }],
  },
];

/** Summary counts — phase 2 reads these from the dashboard-summary endpoint. */
export const HOME_COUNTS = {
  activeBids: 11,
  watchlist: 6,
  ordersRequests: 11,
  inspections: 7,
};
