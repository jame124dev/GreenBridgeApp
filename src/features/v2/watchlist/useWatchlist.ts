/**
 * PHASE 2 — Watchlist, against the real API.
 *
 * Endpoint: `GET /wishlist/{buyerId}`. The web calls it with a bare
 * `axiosInstance.get()` rather than through a slice
 * (`BuyerWatchlist.tsx:38`), so there is no declared response type upstream —
 * the shape below was read off the live server, not off a `.d.ts`.
 *
 * ── SHAPE, VERIFIED 2026-09-24 ──
 *
 *     GET /wishlist/574 → 200, 58,739 bytes
 *     top-level keys: success, message, data
 *     data.wishlist is an array, n = 6
 *     row keys:     wishlist_id, added_at, product
 *     product keys: product_id, batch_id, title, slug, description, status,
 *                   meta, attachments, documents, image1, document1, categories
 *
 * So the rows are at `data.wishlist` — NOT `data.data` like the bids and
 * inspections endpoints. Three sibling endpoints, three different envelopes;
 * this is why each one gets read from the server rather than assumed.
 *
 * ⚠️ THIS IS THE ROUTE IN `Docs/v2/SECURITY-WISHLIST.md`. No auth, no token,
 * any id. 58 KB of one person's buying intent for anyone who increments a
 * number. Shipping a screen on it is a decision the owner has to make with
 * their eyes open — see `Docs/Dashboard/buyer/watchlist/phase-2-api.md`.
 * Nothing here should be read as the route being safe.
 */
import { useQuery } from '@tanstack/react-query';

import { greenbidz } from '@/api/greenbidzClient';
import { useBuyerId } from '@/features/v2/dashboard/useBuyerId';

import { toWishCards, type WishCard, type WishlistRow } from './types';

export function useWatchlistQueryKey(buyerId: number | undefined) {
  return ['v2', 'buyer', 'watchlist', buyerId ?? null] as const;
}

export function useWatchlist() {
  const buyerId = useBuyerId();

  return useQuery<WishCard[]>({
    queryKey: useWatchlistQueryKey(buyerId),
    queryFn: async () => {
      const res = await greenbidz.get(`/wishlist/${buyerId}`);
      const rows = res.data?.data?.wishlist;
      /**
       * Mapped HERE, not in the screen. `toWishCards` drops rows whose
       * `product` join is empty (a deleted lot) and unescapes `&amp;` in
       * category terms — both are properties of the payload, so they belong
       * on the way in rather than in render.
       */
      return toWishCards(Array.isArray(rows) ? (rows as WishlistRow[]) : []);
    },
    enabled: !!buyerId,
    staleTime: 30_000,
  });
}
