/**
 * The bid list's shape and vocabulary, copied from the web rather than
 * re-derived — see `Docs/Dashboard/buyer/my-bids/`.
 *
 * `BuyerBidItem` is verbatim from
 * `nextjs-port/src/services/api/slices/buyerApiSlice.ts:34`. Do not "improve"
 * the field names: phase 2 binds this straight onto
 * `GET /buyer/bid/buyer/{buyerId}`, and a rename here is a silent mismatch
 * there.
 *
 * ⚠️ One inconsistency carried over knowingly: the web component keys its
 * rows on `bid.buyer_bid_id ?? bid.batch_id` (`MyBids.tsx:289`) but
 * `BuyerBidItem` does not declare `buyer_bid_id`. Either the API returns a
 * field the type omits, or that branch never fires. `buyer_bid_id` is
 * declared optional here so the same key expression is possible, and phase 2
 * must look at one real response and settle it.
 */

export type BidProduct = {
  title: string;
  images: string[];
};

/** `buyerApiSlice.ts:34`. */
export type BuyerBidItem = {
  batch_id: number;
  products: BidProduct[];
  /** A STRING in the API, not a number. Format it, never arithmetic it. */
  bid_amount: string;
  bid_date: string;
  end_date: string;
  batch_step: number;
  status: string;
  /** See the header note. */
  buyer_bid_id?: number;
  /**
   * NOT part of the list response. The web fetches it per batch from
   * `GET /buyer/bid/batch/{batch_id}/top` (`bidApiSlice.ts:472`) — it is what
   * makes a row read "outbid". Optional here so phase 1 can show the state
   * and phase 2 can fill it from the real call.
   */
  top_bid?: string;
};

/** `buyerApiSlice.ts:44` — the list is nested two `data` deep. */
export type BuyerBidListResponse = {
  success: boolean;
  data: {
    data: BuyerBidItem[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  };
};

/**
 * The filter set, verbatim from `MyBids.tsx`'s `FILTER_TABS`.
 *
 * The keys ARE the API's status values, which is why the tab set and the
 * query param are one vocabulary — `null` means "no status param".
 */
export type BidFilter = 'all' | 'pending' | 'accepted' | 'rejected';

export const BID_FILTERS: readonly { value: BidFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Won' },
  { value: 'rejected', label: 'Lost' },
];

/** `all` carries no status param — `MyBids.tsx` uses `key: null` for it. */
export function statusParam(f: BidFilter): string | undefined {
  return f === 'all' ? undefined : f;
}

/**
 * Status → label, verbatim from `STATUS_CONFIG` at `MyBids.tsx:73`.
 *
 * The web's colours do not come with it. This kit has exactly two chip tones
 * and no third is coming — `Chip.tsx` says so in its header: "the design has
 * exactly one warm colour (`danger`) and it is not for chips". So `accepted`
 * is the accent chip and everything else is neutral, with the word carrying
 * the rest. A lost bid reads as "Lost", not as red.
 */
export const BID_STATUS_LABEL: Record<string, string> = {
  accepted: 'Won',
  rejected: 'Lost',
  pending: 'Pending',
};

export function bidStatusLabel(status: string | undefined): string {
  return BID_STATUS_LABEL[(status ?? 'pending').toLowerCase()] ?? 'Pending';
}

export function isWon(status: string | undefined): boolean {
  return (status ?? '').toLowerCase() === 'accepted';
}

export function isLost(status: string | undefined): boolean {
  return (status ?? '').toLowerCase() === 'rejected';
}

/**
 * Still live. The API's default when `status` is missing is `pending` — the
 * web applies the same fallback (`bid.status ?? "pending"`, MyBids.tsx:284).
 */
export function isPending(status: string | undefined): boolean {
  return (status ?? 'pending').toLowerCase() === 'pending';
}

/**
 * The batch state machine, from `ProcessStepper` at `MyBids.tsx:94`.
 *
 * These step NUMBERS are the contract — `batch_step` is compared against them
 * directly. The web also folds `>= 8 && < 9` into 9, which is preserved in
 * `batchStepIndex` below; without it a batch sitting at 8.x renders as
 * "Completed" when it is actually closed.
 */
export const BATCH_STEPS: readonly { step: number; label: string }[] = [
  { step: 5, label: 'Bidding' },
  { step: 6, label: 'Payment' },
  { step: 7, label: 'Pickup' },
  { step: 8, label: 'Completed' },
  { step: 9, label: 'Closed' },
];

/** Index into `BATCH_STEPS` for a raw `batch_step`, or -1 before bidding. */
export function batchStepIndex(batchStep: number): number {
  const step = batchStep >= 8 && batchStep < 9 ? 9 : batchStep;
  return BATCH_STEPS.findIndex((s) => s.step === step);
}
