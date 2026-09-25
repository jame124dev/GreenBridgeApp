/**
 * The watchlist contract, copied from the web and NOT redesigned.
 *
 * Source: `nextjs-port/src/features/buyer/pages/buyer/BuyerWatchlist.tsx`.
 * Unusually for this dashboard, there is **no RTK slice** — the page calls
 * `axiosInstance.get()` directly at `:38`, so the shapes below were read off
 * the mapper at `:48-62` rather than off a declared response type. That means
 * they are the fields the WEB consumes, which is a floor, not the full row.
 *
 * ⚠️ `GET /wishlist/{buyerId}` IS THE DOCUMENTED UNAUTHENTICATED IDOR.
 * It has no auth guard on prod: any id in the path returns that user's saved
 * items, and the same route class allows writes. See
 * `Docs/v2/SECURITY-WISHLIST.md`. This does not block phase 1 (no network),
 * but phase 2 must not ship a "saved items" screen that silently depends on
 * it without the user knowing — see `phase-2-api.md`.
 */

/**
 * The raw wishlist row, at `res.data.data.wishlist[]` (`BuyerWatchlist.tsx:39`).
 *
 * `product` is optional because the web filters on it before mapping
 * (`:50` — `.filter((i) => i.product)`). A row whose product has been deleted
 * comes back with the join empty, so this is a real state, not defensiveness.
 */
export type WishlistRow = {
  product?: {
    batch_id?: number | string;
    product_id?: number | string;
    title?: string;
    image1?: string | null;
    attachments?: { url?: string | null }[];
    categories?: { term?: string }[];
  };
};

/** The mapped card. Their interface at `BuyerWatchlist.tsx:17-22`, verbatim. */
export type WishCard = {
  id: string | number;
  title: string;
  image: string | null;
  category: string | null;
};

/**
 * Their mapper at `:48-62`, kept whole because each line is a decision about
 * real data rather than a style:
 *
 * - `batch_id || product_id` — a saved item can be either a grouped batch or a
 *   single product, and the id chosen here is what the detail route receives.
 * - `attachments[].url` first, `image1` as the fallback — two image sources
 *   exist in this DB and older rows only have the second.
 * - `&amp;` → `&` — category terms come from a WordPress-derived table with
 *   HTML entities still in them. Without this the UI reads "Lab &amp; Test".
 */
export function toWishCards(rows: readonly WishlistRow[]): WishCard[] {
  return rows
    .filter((i) => i.product)
    .map((i) => {
      const p = i.product!;
      const images =
        p.attachments?.map((a) => a.url).filter((u): u is string => Boolean(u)) ??
        (p.image1 ? [p.image1] : []);
      return {
        id: p.batch_id || p.product_id || '',
        title: p.title ?? '',
        image: images[0] ?? null,
        category: p.categories?.[0]?.term?.replace(/&amp;/g, '&') ?? null,
      };
    });
}

/**
 * `BuyerWatchlist.tsx:15`. The endpoint returns EVERYTHING and the web slices
 * it in the client (`:65-67`).
 *
 * ⚠️ Not used by the mobile screen. A phone list scrolls; numbered pages are a
 * desktop affordance, and re-creating them here would be porting the web's
 * constraint rather than its behaviour. Recorded because phase 2 needs to know
 * the response is unpaginated — a buyer with 400 saved lots gets all 400 in one
 * payload, which is a real performance question and not a hypothetical (the
 * security note measured one live wishlist at 58 KB).
 */
export const WEB_PAGE_SIZE = 12;
