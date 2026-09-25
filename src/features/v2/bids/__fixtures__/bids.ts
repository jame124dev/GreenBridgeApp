/**
 * Phase 1 fixture — one row per status so every branch renders.
 *
 * ⚠️ DELETED IN PHASE 2. The import goes; this file can stay for tests.
 *
 * ⚠️ AND IT IS NOT REPRESENTATIVE. Real titles here run past 90 characters,
 * real products arrive with `images: []`, and real `bid_amount` strings are
 * not all the same width. Two rows below are deliberately awkward for that
 * reason — do not "tidy" them. Layout is not proven until phase 3 sees the
 * real list. (`Docs/Dashboard/buyer/my-bids/phase-3-states.md`)
 */
import type { BuyerBidItem } from '../types';

export const BID_FIXTURE: BuyerBidItem[] = [
  {
    batch_id: 1042,
    products: [{ title: 'Agilent 7890B Gas Chromatograph', images: ['https://example.invalid/1.jpg'] }],
    bid_amount: '12400',
    bid_date: '2026-09-18T09:12:00Z',
    end_date: '2026-09-25T09:12:00Z',
    batch_step: 5,
    status: 'pending',
    // Outbid: the top bid is someone else's and higher. This is the single
    // most important state on the screen.
    top_bid: '13250',
  },
  {
    batch_id: 1038,
    products: [
      { title: 'Thermo Scientific Sorvall RC-6+ Centrifuge', images: [] },
      { title: 'Eppendorf 5424R Refrigerated Microcentrifuge', images: [] },
      { title: 'Rotor set, F-45-30-11', images: [] },
    ],
    bid_amount: '8950',
    bid_date: '2026-09-15T14:40:00Z',
    end_date: '2026-09-22T14:40:00Z',
    batch_step: 6,
    status: 'accepted',
    top_bid: '8950',
  },
  {
    // The 90-character case. AI-written titles do this constantly; if the row
    // pushes its status chip off-screen, `minWidth: 0` is missing.
    batch_id: 1031,
    products: [
      {
        title:
          'Waters ACQUITY UPLC H-Class Bio System with Quaternary Solvent Manager and Sample Manager FTN',
        images: [],
      },
    ],
    bid_amount: '41000',
    bid_date: '2026-09-09T08:05:00Z',
    end_date: '2026-09-16T08:05:00Z',
    batch_step: 9,
    status: 'rejected',
    top_bid: '44500',
  },
  {
    // No products at all — the API can return an empty array, and the web
    // guards it (`Array.isArray(bid?.products) ? … : []`, MyBids.tsx:281).
    batch_id: 1029,
    products: [],
    bid_amount: '2100',
    bid_date: '2026-09-04T11:00:00Z',
    end_date: '2026-09-11T11:00:00Z',
    batch_step: 8,
    status: 'accepted',
  },
];
