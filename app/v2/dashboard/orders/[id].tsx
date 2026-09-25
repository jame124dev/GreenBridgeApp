/**
 * `/v2/dashboard/orders/[id]` — Order detail & tracking. **PHASE 1: UI only,
 * no network.**
 *
 * `[id]` is the CHECKOUT id (`checkout_id`), matching the single-checkout
 * endpoint `GET /checkouts/:id` (`getCheckoutById`, `checkoutApiSlice.ts`) —
 * not the batch id `v2ListingDetail` takes. Reached from a "Buy Now" row on
 * `/v2/dashboard/requests`; see that route's `[wiring note]` below.
 *
 * ── THE PLAN'S SOURCE FILE WAS DEAD CODE, AND THE WEB HAS NO LIVE COUNTERPART ──
 *
 * `Docs/Dashboard/buyer/order-detail/README.md` points at
 * `BuyerOrder.tsx` — confirmed imported by NOTHING anywhere in the web app,
 * `@ts-nocheck`, with a stray `console.log` still in it. The live
 * `/buyer/buy-now-orders` route renders a plain list with no clickable rows
 * at all — there is no reachable per-order detail screen in the current web
 * app to compare against. Full audit in `src/features/v2/order-detail/types.ts`.
 * Every field name and status value here was verified against the LIVE
 * `GET /checkouts/buyer/574` response instead of trusted from that file.
 *
 * ⚠️ `GET /shipment/order/:id` IS AUTH-GATED — curled live 2026-09-24 and
 * returned `{"success":false,"message":"Authentication required"}`, unlike
 * every other buyer endpoint touched this session. The shipment fixture data
 * is therefore built from the DECLARED type only, not a live response — see
 * `types.ts` before trusting its shape as fact.
 *
 * ── NOT WIRED FROM `requests.tsx`, AND THAT WAS A DELIBERATE REVERSAL ──
 *
 * The obvious move was to send "Buy Now" rows on `/v2/dashboard/requests`
 * here instead of to `v2ListingDetail(batchId)` — a checkout looked like the
 * natural detail for a purchase you already made. It was drafted that way,
 * then checked and reverted before shipping:
 *
 *     GET /order/buyer/574   → 0 rows   (what a "Buy Now" ROW on requests.tsx is built from)
 *     GET /checkouts/buyer/574 → 4 rows (what THIS screen reads)
 *
 * Same buyer, same session, two DISJOINT tables — `order_id` (`orderApiSlice.ts`,
 * `jos_recycle_orders`) and `checkout_id` (`checkoutApiSlice.ts`, a different
 * table) are not proven to correspond to the same purchase, or to correspond
 * at all. `BuyerRequests.tsx`'s own docblock warned about exactly this: "the
 * old page reads `/checkouts/buyer/:id` — a table a marketplace Buy Now never
 * writes." Wiring a request row's `order_id` into a `checkout_id`-keyed route
 * would have been the "button that opens the wrong thing" failure this
 * session has already caught twice, just one level less obvious — it would
 * have opened SOMETHING, not nothing, and the wrong record is harder to
 * notice than a dead link.
 *
 * So: **this screen currently has no entry point anywhere in the app**,
 * matching the web's own orphaned state. It is correct in isolation — built
 * and verified against its own real endpoint — and needs either a genuine
 * join field (ask the backend: does a checkout carry an `order_id`, or vice
 * versa?) or its own reachable list (a "My orders" screen reading
 * `/checkouts/buyer/{id}` directly, sidestepping `order_id` entirely) before
 * it is reachable. That is a real decision, not a wiring afterthought —
 * flagging it rather than picking one silently.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/features/v2/ui';
import { OrderDetailScreen } from '@/features/v2/order-detail/order-detail-screen';
import { DashboardBar } from '@/features/v2/dashboard/DashboardBar';

export default function OrderDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const checkoutId = id ? Number(id) : NaN;

  return (
    <Screen
      header={<DashboardBar title="Order detail" />}
      tabBar={false}
      contentStyle={styles.fill}
      testID="v2-order-detail"
    >
      <OrderDetailScreen checkoutId={checkoutId} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
