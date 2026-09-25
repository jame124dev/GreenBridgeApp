/**
 * PHASE 2 — My bids, against the real API.
 *
 * Endpoint: `GET /buyer/bid/buyer/{buyerId}` — the web's
 * `nextjs-port/src/services/api/slices/buyerApiSlice.ts:274` (URL at `:315`),
 * reached here through React Query + `greenbidz` rather than RTK, because this
 * app has no Redux.
 *
 * ── THE RESPONSE SHAPE IS VERIFIED, NOT ASSUMED ──
 *
 * Curled against the local backend on 2026-09-23 before this file was written:
 *
 *     GET /buyer/bid/buyer/574?page=1&limit=3  → 200
 *     top-level keys: success, data
 *     data.data is an array, n = 3
 *     row keys: buyer_bid_id, batch_id, products, bid_amount, bid_date,
 *               end_date, batch_step, commission_percent, status, bidId,
 *               quotation_types, buyer_bid_lines, bidding
 *
 * So the rows are at `data.data` — the envelope nests `data` twice, exactly as
 * the inspections one does. Reading `res.data.data` is correct and
 * `res.data` is not; getting that wrong yields an empty list and no error.
 *
 * ⚠️ NO AUTH IS REQUIRED AND THAT IS A BUG, NOT A CONVENIENCE. This route is
 * part of the unauthenticated identity-parameter class documented in
 * `Docs/v2/SECURITY-WISHLIST.md`: it returned real rows with no Authorization
 * header, no cookie and no system key. We consume it because it is what the
 * web consumes, but nothing here should be read as the route being safe — any
 * buyer id in the path returns that buyer's bids.
 */
import { useQuery } from '@tanstack/react-query';

import { greenbidz } from '@/api/greenbidzClient';
import { useBuyerId } from '@/features/v2/dashboard/useBuyerId';

import type { BuyerBidItem } from './types';

export function useBuyerBidsQueryKey(buyerId: number | undefined) {
  return ['v2', 'buyer', 'bids', buyerId ?? null] as const;
}

export function useBuyerBids() {
  const buyerId = useBuyerId();

  return useQuery<BuyerBidItem[]>({
    queryKey: useBuyerBidsQueryKey(buyerId),
    queryFn: async () => {
      const res = await greenbidz.get(`/buyer/bid/buyer/${buyerId}`, {
        params: { page: 1, limit: 50 },
      });
      // Verified shape — see the docblock. Defensive because the web is too.
      const rows = res.data?.data?.data ?? res.data?.data;
      return Array.isArray(rows) ? (rows as BuyerBidItem[]) : [];
    },
    enabled: !!buyerId,
    staleTime: 30_000,
  });
}
