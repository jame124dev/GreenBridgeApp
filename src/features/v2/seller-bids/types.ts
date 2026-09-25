/**
 * Bids on my listings (seller) — and the plan pointed at the wrong DATA, not
 * just the wrong file. Worth reading in full before trusting anything here.
 *
 * ── THE PLAN SAID "DON'T BUILD A SCREEN, PORT `MyBids` WITH A PROP" — WRONG DATA ──
 *
 * `README.md`: "The web proves it is the buyer screen with one prop... this
 * phase is an extension of `buyer/my-bids`, not a new build." True about the
 * FILE (`SellerMyBids.tsx` is 14 lines, `<MyBids batchBasePath="..." />`) and
 * WRONG about what it shows. Checked `MyBids.tsx`'s query before trusting the
 * claim: `batchBasePath` only changes a navigation URL prefix
 * (`MyBids.tsx:362`); the DATA query is
 * `useGetBuyerBidsQuery({ buyerId: Number(localStorage.getItem("userId")) })`
 * — unconditional, no seller branch anywhere. `SellerMyBids` renders **the
 * signed-in person's own bids placed as a buyer**, identical to
 * `/v2/dashboard/bids`, regardless of which dashboard shell wraps it.
 *
 * That is not "bids on my listings" — a seller wants bids OTHER buyers placed
 * ON THE SELLER'S OWN LISTINGS, which is a completely different query. Had
 * this plan been followed literally, the mobile screen would show a person
 * their own outbound bids under a label that says the opposite.
 *
 * ── THE PLAN'S CITED ENDPOINT WAS ALSO WRONG — A FOURTH REAL ENDPOINT FOUND ──
 *
 * `README.md` cites `GET /seller/bids/{sellerId}` (`buyerApiSlice.ts:323`).
 * That endpoint exists and IS real, but grepped for its callers: `Bids.tsx`
 * (imported by nothing — dead, matching the session's now-familiar pattern),
 * `DashboardHome.tsx`, `SellerBidDashboard.tsx`. Traced the live seller-bids
 * ROUTE (`app/(seller)/dashboard/bids/page.tsx`) instead of trusting a name
 * match: its default export is marked `@deprecated` and immediately
 * `<Navigate to="/dashboard/buyer-activity?tab=auction-bids" replace />`.
 * The REAL content lives at a tabbed parent (`SellerBuyerActivity.tsx`, 3
 * tabs: `buy-now-orders` / `negotiated-offers` / `auction-bids`) rendering
 * the SAME FILE's other export, `SellerAuctionBidsPanel` — which calls
 * `useGetSellerBidsQuery` from **`batchApiSlice.ts`**, a THIRD slice file,
 * hitting **`GET /buyer/bid/seller/{userId}`** — not the README's endpoint at
 * all.
 *
 * The web's 3-tab split maps cleanly onto the mobile drawer's existing 3
 * separate seller pages (Bids on my listings / Offers received / Orders) —
 * so this page ports `auction-bids` only; `negotiated-offers` and
 * `buy-now-orders` belong to the next two pages, not folded in here.
 *
 * ── VERIFIED LIVE, 2026-09-24 ──
 *
 *     GET /buyer/bid/seller/571?page=1&limit=10 → 200
 *     top-level keys: success, data, dashboardSummary, pagination
 *     `data` IS the array directly (a FOURTH distinct envelope shape this
 *     session has found across sibling endpoints — read every one from the
 *     server, never assume).
 *     16 batches total for this seller; the sampled page's rows all have
 *     `summary.total: 0` — a real "listed, no bids yet" case, not an error.
 *     `dashboardSummary` is a SELLER-WIDE total across every batch, not just
 *     the current page — `{total_bids, pending, accepted, rejected, counter_offer}`.
 *
 * The declared `SellerBidResponse` type (`batchApiSlice.ts:259-275`) is a
 * FLOOR, not the truth — same pattern as the offer/watchlist endpoints
 * earlier this session: it has no `summary` field at all, yet the live panel
 * reads `batch.summary.total/accepted/pending` and the real response carries
 * it (plus `rejected` and `counter_offer`, which the declared type and the
 * web's own UI both omit — kept here since they are real fields).
 */

export type SellerBatchStatus = string;

/** `SellerBidDashboard.tsx`'s own read of the live shape, not the declared type. */
export type SellerBidBatch = {
  batch_id: number;
  batch_step?: number;
  status: SellerBatchStatus;
  products: { title: string; images: string[] }[];
  isAuction?: boolean;
  summary: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    counter_offer: number;
  };
};

/** `SellerBidDashboard.tsx:59-62` — a batch nobody bid on is not "activity". */
export function hasBidActivity(batch: SellerBidBatch): boolean {
  return (batch.summary?.total ?? 0) > 0;
}

/** Plain status label — the web shows the raw batch `status` string directly. */
export function batchStatusLabel(status: string): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Accented when there is something the seller has not yet acted on. */
export function sellerBidTone(batch: SellerBidBatch): 'accent' | 'neutral' {
  return batch.summary.pending > 0 ? 'accent' : 'neutral';
}
