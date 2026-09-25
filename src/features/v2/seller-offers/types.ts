/**
 * Offers received (seller) — the first screen on this dashboard with a
 * WRITE. Source: `nextjs-port/src/features/buyer/pages/offer/SellerOffer.tsx`
 * (305 lines) — genuinely live this time (imported by exactly one route,
 * `app/(seller)/dashboard/seller/offers/page.tsx`, no redirect indirection),
 * unlike the previous seller page's plan. Checked anyway, per the pattern
 * that is now three-for-three this session.
 *
 * ── ⚠️ A SECURITY FINDING, NOT JUST A DATA SHAPE ──
 *
 * The live endpoint (`GET /offer/seller?sellerID={id}`) is unauthenticated
 * (curled with no token, 200, real rows — same class as
 * `Docs/v2/SECURITY-WISHLIST.md`) AND its response embeds each buyer's FULL
 * WordPress user record in a nested `buyer` object — **including
 * `user_pass` (the password hash) and `user_activation_key`.** Full
 * write-up: `Docs/v2/SECURITY-WISHLIST.md`, 2026-09-24 entry.
 *
 * **`SellerBuyer` below models ONLY `id` and `displayName`.** No type in
 * this feature reads, stores, logs, or passes through `user_pass`,
 * `user_email`, `user_login`, or any other field of the raw `buyer` object —
 * not because they are unused by the UI (though they are: the live
 * `SellerOffer.tsx` itself never reads `offer.buyer` either, only the bare
 * `offer.user_id`), but because handling them at all, even to discard them
 * one line later, is the wrong shape for a response this dangerous. Extend
 * this type only after the backend response has been fixed to stop
 * returning the raw row.
 *
 * ── ENDPOINTS: THE PLAN'S METHOD WAS WRONG BY ONE WORD ──
 *
 * `README.md` says `PUT /offer/{offer_id}/status`. The live mutation
 * (`bidApiSlice.ts:665-675`) sends **`PATCH`**, not PUT. Small, but a wrong
 * HTTP method is a wrong request — phase 2 must use PATCH.
 */

export type OfferStatus = 'pending' | 'accepted' | 'payment_processing' | 'sold' | 'rejected';

/**
 * `SellerOffer.tsx:69-84`'s own comment, verbatim: "Accept → payment_processing
 * (reserved); then Mark Sold → sold, or Decline → rejected (re-lists the
 * batch). Reject from pending also uses 'rejected'." The mutation NEVER
 * writes the literal string `'accepted'` — that status value exists to be
 * READ (set by some other path) but not written by this screen's own
 * buttons. Kept as a real member of `OfferStatus` for that reason.
 */
export const OFFER_TRANSITIONS: Readonly<Record<OfferStatus, readonly { to: OfferStatus; label: string; primary: boolean }[]>> = {
  pending: [
    { to: 'payment_processing', label: 'Accept', primary: true },
    { to: 'rejected', label: 'Reject', primary: false },
  ],
  payment_processing: [
    { to: 'sold', label: 'Mark sold', primary: true },
    { to: 'rejected', label: 'Decline', primary: false },
  ],
  accepted: [],
  sold: [],
  rejected: [],
};

/** The live response shape (`offer/seller`), trimmed to non-sensitive fields. */
export type SellerOfferItem = {
  offer_id: number;
  batch_id: number;
  user_id: number;
  offer_price: string;
  offer_quantity: number;
  message: string | null;
  status: OfferStatus;
  createdAt: string;
  batch?: {
    batch_number?: number;
    products?: { title?: string; image1?: string | null }[];
  };
  /**
   * Present on the live response as a full user row. NEVER typed further —
   * see the docblock. This screen reads `user_id` for identity, exactly as
   * the live web screen does, and never touches this field.
   */
  buyer?: unknown;
};

export function offerStatusLabel(status: OfferStatus): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'accepted': return 'Accepted';
    case 'payment_processing': return 'Payment processing';
    case 'sold': return 'Sold';
    case 'rejected': return 'Rejected';
    default: return status;
  }
}

/** Accent for anything the seller has not yet acted on. */
export function offerTone(status: OfferStatus): 'accent' | 'neutral' {
  return status === 'pending' || status === 'payment_processing' ? 'accent' : 'neutral';
}

export function money(amount: string | number): string {
  const n = Number(amount);
  if (!n) return '';
  return `USD ${n.toLocaleString('en-US')}`;
}
