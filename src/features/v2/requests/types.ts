/**
 * The Orders & requests contract — copied from the web and NOT redesigned.
 *
 * Source: `nextjs-port/src/features/buyer/pages/buyer/BuyerRequests.tsx`.
 *
 * ⚠️ THE PLAN DOC (`Docs/Dashboard/buyer/requests/README.md`) IS WRONG ABOUT
 * THE SHAPE. It lists ONE endpoint ("Buy Now purchases AND Make Offer
 * requests in one list"). There are TWO, merged on the client — the screen's
 * own docblock says as much:
 *
 *   Buy Now → GET /order/buyer/{id}   → `orderApiSlice.ts:85`  (orders ONLY)
 *   Offers  → GET /offer/user?buyer_id={id} → `bidApiSlice.ts:641` (offers ONLY)
 *
 * Verified live against buyer 574 on 2026-09-24: `/order/buyer/574` returns
 * `data: []` (0 orders) and `/offer/user?buyer_id=574` returns 7 offers, all
 * `status: "pending"`. So real data exercises the offer half and the
 * "nothing here yet" order half — but no bucket except "awaiting" comes from
 * real rows. The fixture below still needs every bucket, per the plan's own
 * "one row per status" rule — that is what a fixture is FOR.
 */

/**
 * `orderApiSlice.ts:19-32`, trimmed to what this screen reads.
 *
 * ⚠️ BARE ROW, NO BATCH JOIN. `/order/buyer/:id` does not return a product
 * title or image — only the batch id and the order reference. A Buy Now row
 * therefore NEVER has a title or a photo; that is real, not a missing field.
 */
export type OrderRow = {
  order_id: number;
  order_number: string;
  batch_id: number;
  total_price: string;
  currency: string;
  status: string;
  createdAt: string;
};

/**
 * The offer row, read off the live response (no declared type upstream — the
 * web widens this to `any`). `batch.products[0]` is the join that gives an
 * offer its title and photo; it is missing on 3 of the 7 live rows for buyer
 * 574 (an empty `products` array), which is why `title`/`image` stay optional.
 */
export type OfferRow = {
  offer_id: number;
  batch_id: number;
  offer_price: string;
  currency?: string | null;
  status: string;
  createdAt: string;
  batch?: {
    currency?: string | null;
    products?: { title?: string; image1?: string | null }[];
  } | null;
};

export type RequestKind = 'buy_now' | 'offer';

/**
 * `BuyerRequests.tsx:83-99` — `bucketOf()`, verbatim. The two sources do not
 * share a status vocabulary (an order's "pending" and an offer's "pending"
 * mean opposite things — not yet approved vs. not yet answered), so filtering
 * runs on this DERIVED bucket, never the raw `status` string. The raw status
 * still prints on the row; only filtering reads the bucket.
 */
export type RequestBucket =
  | 'action'
  | 'awaiting'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'closed';

export function bucketOf(kind: RequestKind, status?: string): RequestBucket {
  const s = String(status || '').toLowerCase();
  if (kind === 'offer') {
    // An accepted offer reserves the batch for payment — the buyer's move.
    if (s === 'accepted' || s === 'payment_processing') return 'action';
    if (s === 'pending') return 'awaiting';
    if (s === 'sold') return 'completed';
    if (s === 'rejected') return 'closed';
    return 'awaiting';
  }
  if (s === 'delivered') return 'completed';
  if (s === 'processing' || s === 'shipped') return 'in_progress';
  if (s === 'rejected' || s === 'cancelled') return 'closed';
  // pending / approved — the sale is agreed, nothing for the buyer to do yet.
  return 'confirmed';
}

/** `BuyerRequests.tsx:84-91`, verbatim labels. */
export const REQUEST_BUCKETS: readonly { value: RequestBucket; label: string }[] = [
  { value: 'action', label: 'Action needed' },
  { value: 'awaiting', label: 'Awaiting seller' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Declined / cancelled' },
];

/** The type-tab row. `all` is not a `RequestKind` — it means no filter. */
export const REQUEST_TYPES: readonly { value: 'all' | RequestKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'buy_now', label: 'Buy Now' },
  { value: 'offer', label: 'Offers' },
];

/**
 * The one merged shape the screen renders — `BuyerRequests.tsx:163-193`.
 *
 * ⚠️ `rowId`, NOT `key`. React reserves `key` — spreading a `{...item}` whose
 * own field is named `key` into JSX triggers "A props object containing a
 * 'key' prop is being spread into JSX", visibly, on screen. Caught by
 * actually looking at the web verification pass, not by any gate: `tsc` and
 * every jest test were green with the bug in place.
 */
export type RequestItem = {
  rowId: string;
  kind: RequestKind;
  batchId: number;
  title: string | null;
  image: string | null;
  productCount: number;
  /** "GB-1042" for an order, "#159" for an offer — `BuyerRequests.tsx:174, 191`. */
  reference: string;
  amount: number;
  currency: string;
  status: string;
  bucket: RequestBucket;
  date: string | null;
};

/** `BuyerRequests.tsx:163-176`. */
export function orderToRequestItem(o: OrderRow): RequestItem {
  return {
    rowId: `order-${o.order_id}`,
    kind: 'buy_now',
    batchId: o.batch_id,
    title: null,
    image: null,
    productCount: 0,
    reference: o.order_number,
    amount: Number(o.total_price) || 0,
    currency: o.currency || '',
    status: o.status,
    bucket: bucketOf('buy_now', o.status),
    date: o.createdAt ?? null,
  };
}

/** `BuyerRequests.tsx:178-192`. */
export function offerToRequestItem(o: OfferRow): RequestItem {
  const product = o.batch?.products?.[0];
  return {
    rowId: `offer-${o.offer_id}`,
    kind: 'offer',
    batchId: o.batch_id,
    title: product?.title ?? null,
    image: product?.image1 ?? null,
    productCount: o.batch?.products?.length ?? 0,
    reference: `#${o.offer_id}`,
    amount: Number(o.offer_price) || 0,
    currency: o.batch?.currency || o.currency || '',
    status: o.status,
    bucket: bucketOf('offer', o.status),
    date: o.createdAt ?? null,
  };
}

/**
 * `BuyerRequests.tsx:262-263` — an accepted offer is the buyer's turn, the
 * batch is reserved for payment.
 *
 * ⚠️ NOT WIRED TO A "Pay now" BUTTON HERE. The web sends this state to a
 * checkout flow that does not exist anywhere in v2 mobile yet — no payment or
 * checkout screen is built. A button that opens nothing is the exact failure
 * this codebase keeps re-discovering (`MISTAKES.md`, repeatedly). So `dueNow`
 * only surfaces as an urgency line; the row's one action is "view details",
 * same as every other row, until a payment screen exists to send it to.
 */
export function isDueNow(item: RequestItem): boolean {
  return item.kind === 'offer' && (item.status === 'accepted' || item.status === 'payment_processing');
}

/** Status label shown on the chip — plain English, not the raw enum. */
export function requestStatusLabel(kind: RequestKind, status: string): string {
  const s = status.toLowerCase();
  if (kind === 'offer') {
    if (s === 'accepted') return 'Accepted';
    if (s === 'payment_processing') return 'Payment due';
    if (s === 'pending') return 'Awaiting seller';
    if (s === 'sold') return 'Sold';
    if (s === 'rejected') return 'Rejected';
    return status;
  }
  if (s === 'pending') return 'Pending';
  if (s === 'approved') return 'Approved';
  if (s === 'processing') return 'Processing';
  if (s === 'shipped') return 'Shipped';
  if (s === 'delivered') return 'Delivered';
  if (s === 'rejected') return 'Rejected';
  if (s === 'cancelled') return 'Cancelled';
  return status;
}
