/**
 * Orders (checkouts) — seller. Source:
 * `nextjs-port/src/features/buyer/pages/order/SellerOrder.tsx` (366 lines) —
 * genuinely live (one importer, no redirect), but `@ts-nocheck` with a stray
 * `console.log` and the now-familiar envelope guess (`orders?.orders`).
 * Checked before trusting it, same as every plan this session.
 *
 * ── ⚠️ THE SAME SECURITY FINDING, A THIRD TIME ──
 *
 * `GET /checkouts/seller/{sellerId}` is unauthenticated AND embeds the same
 * full `buyer` WordPress row (`user_pass`, `user_activation_key`, …) as the
 * offers endpoint. Full write-up: `Docs/v2/SECURITY-WISHLIST.md`'s
 * "THIRD occurrence" entry, 2026-09-24. **This screen types the buyer as a
 * bare `buyer_id` number — nothing else, ever.**
 *
 * ── VERIFIED LIVE, 2026-09-24 ──
 *
 *     GET /checkouts/seller/571?page=1&limit=10 → 200
 *     top-level keys: success, orders, pagination
 *     `orders` — NOT `data` — is the array. A FIFTH distinct envelope shape
 *     this session has found. The BUYER-facing checkout endpoint
 *     (`order-detail/types.ts`) uses `data`; this SELLER-facing one uses
 *     `orders`. Same underlying `Checkout` row shape, different key at the
 *     top — read every sibling endpoint from the server, never generalise.
 *     4 real rows for this seller, all `status: pending`.
 *
 * The web's own guess (`orders?.orders`) turns out to be RIGHT this time —
 * the declared `CheckoutPaginatedResponse` type
 * (`checkoutApiSlice.ts:36-46`) already says `orders: Checkout[]` at the top
 * level, and the live response matches it. Verified anyway rather than
 * assumed, because the LAST `@ts-nocheck` envelope guess this session found
 * (`BuyerOrder.tsx`'s `data.orders`) was wrong.
 *
 * ── THE STATUS VOCABULARY, REUSED, NOT RE-DECLARED ──
 *
 * `CheckoutStatus`/`CHECKOUT_STAGES`/`checkoutStageIndex`/
 * `checkoutStatusLabel`/`checkoutTone`/`money` all come from
 * `order-detail/types.ts` — the canonical 7-stage checkout vocabulary
 * (`pending → confirmed → ready → shipped → delivered → completed`, plus
 * terminal `cancelled`), already verified live once. A third hand-copy of
 * the same enum would be a third source of truth to drift.
 *
 * ⚠️ THIS SELLER SCREEN'S OWN ACTION BUTTONS NEVER OFFER "ready".
 * `SellerOrder.tsx`'s local `OrderStatus` type is missing that stage
 * entirely (6 values, not 7) — its own action UI only ever writes
 * pending→confirmed→shipped→delivered→completed, cancel from
 * pending/confirmed. That is a real gap in the WEB screen (a checkout that
 * reaches `ready` some other way — buyer- or admin-set — would hit an
 * `undefined` lookup in its hand-rolled `statusColors`/`statusLabels` maps),
 * not something to replicate: the canonical 7-stage table renders `ready`
 * correctly if a fixture or real row is ever at that stage, even though no
 * button here writes it.
 */
export {
  type CheckoutStatus,
  CHECKOUT_STAGES,
  checkoutStageIndex,
  checkoutStatusLabel,
  checkoutTone,
  money,
  formatOrderDate,
} from '@/features/v2/order-detail/types';

import type { CheckoutStatus } from '@/features/v2/order-detail/types';

/** `checkoutApiSlice.ts:32`, the sibling enum to `CheckoutStatus`. */
export type PaymentStatus = 'pending' | 'manual_received' | 'success' | 'failed';

export function paymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case 'pending': return 'Payment pending';
    case 'manual_received': return 'Manual payment received';
    case 'success': return 'Paid';
    case 'failed': return 'Payment failed';
    default: return status;
  }
}

/** The live response row, trimmed to non-sensitive fields — see the docblock. */
export type SellerCheckout = {
  checkout_id: number;
  batch_id: number;
  buyer_id: number;
  quantity: number;
  total_price: number;
  currency: string;
  status: CheckoutStatus;
  payment_status: PaymentStatus;
  createdAt?: string | null;
  batch?: {
    batch_number?: number;
    products?: { title?: string; image1?: string | null }[];
  };
  /** Present on the live response as a full user row. NEVER typed further — see the docblock. */
  buyer?: unknown;
};

/**
 * `SellerOrder.tsx:180-210`, verbatim transitions — the SELLER's own action
 * set, which is narrower than the canonical stage list (see the docblock's
 * note on the missing `ready` stage). `cancel` is available from `pending`
 * and `confirmed` only, matching the web exactly.
 */
export const ORDER_TRANSITIONS: Readonly<Record<CheckoutStatus, readonly { to: CheckoutStatus; label: string; primary: boolean }[]>> = {
  pending: [
    { to: 'confirmed', label: 'Accept order', primary: true },
    { to: 'cancelled', label: 'Cancel order', primary: false },
  ],
  confirmed: [
    { to: 'shipped', label: 'Mark shipped', primary: true },
    { to: 'cancelled', label: 'Cancel order', primary: false },
  ],
  ready: [],
  shipped: [
    { to: 'delivered', label: 'Mark delivered', primary: true },
  ],
  delivered: [
    { to: 'completed', label: 'Complete order', primary: true },
  ],
  completed: [],
  cancelled: [],
};
