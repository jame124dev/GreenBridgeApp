/**
 * The order-detail contract — and the source this plan pointed at needed more
 * checking than any page built so far this session.
 *
 * ── THE PLAN'S SOURCE FILE IS DEAD CODE ──
 *
 * `Docs/Dashboard/buyer/order-detail/README.md` says to port
 * `src/features/buyer/pages/order/BuyerOrder.tsx`. Confirmed by exhaustive
 * grep across `nextjs-port` (2026-09-24): **imported by nothing, anywhere.**
 * The live buyer-orders route (`/buyer/buy-now-orders`) renders a completely
 * different component (`BuyerBuyNowOrders.tsx`) — a plain list with NO
 * clickable rows and NO detail view at all. There is no reachable per-order
 * detail screen in the current web app. This is the fifth dead-file citation
 * in this plan (after `BuyerOrders.tsx`, `BuyerOffers.tsx` on the requests
 * page), and the worst one: the file is also `@ts-nocheck`, has a stray
 * `console.log("orders is", data)` left in, wraps itself in a SECOND
 * `DashboardLayout` (every live page's own comments warn against doing that
 * — double header, broken hydration), and invents its own THIRD checkout
 * status vocabulary (`submitted/accepted/delivered/completed/cancelled`) that
 * does not match either of the other two.
 *
 * So this file was read for STRUCTURE (a per-order card that expands into a
 * status progression), never trusted for field names, envelope shape, or
 * status values — every one of those was verified against the LIVE
 * endpoint instead. See the checkout audit below.
 *
 * ── CHECKOUT: VERIFIED LIVE, 2026-09-24 ──
 *
 *     GET /checkouts/buyer/574 → 200
 *     top-level keys: success, data
 *     `data` IS the array directly — NOT `data.orders` (`BuyerOrder.tsx`'s
 *     dead-code guess) and NOT `data.data` (the bids/inspections shape). A
 *     THIRD distinct envelope on a THIRD sibling endpoint; read every one
 *     from the server, per `bids/useBuyerBids.ts`'s note.
 *     4 real rows, all `status: "pending"`, all `created_at: null`
 *     (a real case the fixture must cover — null dates are normal here, not
 *     an error state). No `seller` object anywhere in the response —
 *     `BuyerOrder.tsx`'s `order.seller` reference would read `undefined`.
 *
 * The declared `CheckoutStatus` type (`checkoutApiSlice.ts:6-13`) —
 * `pending | confirmed | ready | shipped | delivered | completed | cancelled`
 * — matches the LIVE `BuyerBuyNowOrders.tsx` list screen's vocabulary, not
 * `BuyerOrder.tsx`'s invented one. That is the vocabulary used here.
 *
 * ── SHIPMENT: TYPES ARE REAL AND WELL-DOCUMENTED; THE ENDPOINT IS AUTH-GATED ──
 *
 * `shipmentApiSlice.ts` is the opposite of `BuyerOrder.tsx` — fully typed, no
 * `@ts-nocheck`, and its own docblock states the design intent plainly:
 * "absence is a first-class answer" — `GET /shipment/order/:id` returns
 * `{ shipment: Shipment | null, canBook: boolean, blockers: string[] }`
 * rather than a bare null. That shape is taken verbatim.
 *
 * ⚠️ UNLIKE EVERY OTHER BUYER ENDPOINT TOUCHED THIS SESSION, this one is
 * genuinely auth-gated: `GET /shipment/order/4` (a real checkout id, curled
 * live 2026-09-24) returns `{"success":false,"message":"Authentication
 * required"}`, not the open-by-design unauthenticated class the bids/
 * watchlist/inspections/checkouts endpoints are all in. Phase 2 for the
 * shipment half needs a real session, not just a buyer id — flag this in
 * `phase-2-api.md` before wiring it.
 */

/** `checkoutApiSlice.ts:6-13`, verbatim — the REAL vocabulary, live-verified. */
export type CheckoutStatus =
  | 'pending'
  | 'confirmed'
  | 'ready'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled';

/**
 * `checkoutApiSlice.ts:15-30`, trimmed to what this screen reads, plus the
 * `batch` join actually present on the live response (not in the declared
 * type, but real — same pattern as the offer row on the requests screen).
 */
export type Checkout = {
  checkout_id: number;
  batch_id: number;
  quantity: number;
  total_price: number;
  currency: string;
  shipping_address: string;
  status: CheckoutStatus;
  payment_status: 'pending' | 'manual_received' | 'success' | 'failed';
  /** Real rows for buyer 574 all have this `null` — handle it as normal, not an error. */
  created_at: string | null;
  batch?: {
    batch_number?: number;
    products?: { title?: string; image1?: string | null }[];
  };
};

/**
 * The ordered progression a checkout moves through. `cancelled` is
 * deliberately EXCLUDED — it is a terminal exception, not a position on this
 * rail. `BuyerOrder.tsx` got this one thing right even though its own
 * `steps` array used the wrong labels: "if currentStatus === 'cancelled'
 * return null" — a cancelled order does not get a 6-step progress bar
 * implying it is still moving toward delivery. Chrome belonging to a state
 * must not render outside that state (`v2-screen` skill).
 */
export const CHECKOUT_STAGES: readonly { status: CheckoutStatus; label: string }[] = [
  { status: 'pending', label: 'Placed' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'ready', label: 'Ready' },
  { status: 'shipped', label: 'Shipped' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'completed', label: 'Completed' },
];

export function checkoutStageIndex(status: CheckoutStatus): number {
  return CHECKOUT_STAGES.findIndex((s) => s.status === status);
}

/** `shipmentApiSlice.ts:20-30`, verbatim — real backend enum. */
export type ShipmentStatus =
  | 'pending_payment'
  | 'paid'
  | 'preparing'
  | 'label_created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'failed';

/** `shipmentApiSlice.ts:33-41`, verbatim. */
export type ShipmentEvent = {
  event_id: number;
  status: ShipmentStatus;
  description: string | null;
  location: string | null;
  occurred_at: string;
};

/** `shipmentApiSlice.ts:43-71`, trimmed to what this screen reads. */
export type Shipment = {
  shipment_id: number;
  carrier_name: string | null;
  tracking_number: string | null;
  status: ShipmentStatus;
  ship_to_city: string | null;
  ship_to_country: string | null;
  estimated_delivery: string | null;
  events?: ShipmentEvent[];
};

/**
 * `shipmentApiSlice.ts:76-80`, verbatim — "absence is a first-class answer."
 * A `null` shipment is not an error and not a loading state; it is a real,
 * named answer with its own reasons attached.
 */
export type ShipmentForOrder = {
  shipment: Shipment | null;
  canBook: boolean;
  blockers: string[];
};

/** `BuyerOrder.tsx:44-49`'s label map, corrected to the real status vocabulary. */
export function checkoutStatusLabel(status: CheckoutStatus): string {
  const found = CHECKOUT_STAGES.find((s) => s.status === status);
  return found ? found.label : 'Cancelled';
}

export function checkoutTone(status: CheckoutStatus): 'accent' | 'neutral' {
  return status === 'completed' ? 'accent' : 'neutral';
}

const SHIPMENT_LABELS: Record<ShipmentStatus, string> = {
  pending_payment: 'Payment pending',
  paid: 'Paid',
  preparing: 'Preparing',
  label_created: 'Label created',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

export function shipmentStatusLabel(status: ShipmentStatus): string {
  return SHIPMENT_LABELS[status] ?? status;
}

/** `BuyerOrder.tsx:26-30`'s date helper — the one thing safe to keep verbatim, it has no status opinion in it. */
export function formatOrderDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB');
}

/** Same shape as the money helper on `requests/request-card.tsx`. */
export function money(amount: number, currency: string): string {
  if (!amount) return '';
  const n = amount.toLocaleString('en-US');
  return currency ? `${currency} ${n}` : n;
}
