/**
 * `/v2/dashboard/seller-orders` — Orders / checkouts (seller). **PHASE 1: UI
 * only. The status-advance flow is real UI over a simulated write — see
 * `seller-orders-screen.tsx`'s docblock.**
 *
 * Built with `Docs/Dashboard/PAGE_PLAYBOOK.md`. Screen:
 * `src/features/v2/seller-orders/seller-orders-screen.tsx`, card:
 * `order-card.tsx`, confirm sheet: the kit's `ConfirmSheet`
 * (`@/features/v2/ui/ConfirmSheet.tsx`) — shared with `seller-offers`, the
 * screen that first needed it.
 *
 * `SellerOrder.tsx` (the plan's named source) is genuinely live, third
 * seller page in a row where the FILE citation checked out. Its DATA still
 * needed checking, same as every plan this session:
 *
 * ⚠️ THE SAME SECURITY FINDING, A THIRD TIME. `GET /checkouts/seller/{id}`
 * is unauthenticated and embeds the same full `buyer` WordPress row
 * (password hash included) as the offers endpoint one screen earlier.
 * `Docs/v2/SECURITY-WISHLIST.md`'s "THIRD occurrence" entry, 2026-09-24: two
 * unrelated endpoints on two unrelated slice files with the identical shape
 * is a backend QUERY PATTERN, not two isolated bugs. This screen types the
 * buyer as a bare `buyer_id` number, nothing else.
 *
 * ⚠️ THE PLAN'S HTTP METHOD IS WRONG, SAME AS OFFERS. `README.md` says
 * `PUT /checkouts/{checkoutId}/status`; the live mutation
 * (`checkoutApiSlice.ts:92-98`) sends `PATCH`.
 *
 * ⚠️ THE ENVELOPE DIFFERS FROM ITS OWN SIBLING ENDPOINT. The buyer-facing
 * `/checkouts/buyer/{id}` returns `{success, data: Checkout[]}`; THIS one —
 * `/checkouts/seller/{id}` — returns `{success, orders: Checkout[],
 * pagination}`. Same row shape, different top-level key. Verified live
 * before building; see `src/features/v2/seller-orders/types.ts`.
 */
import React from 'react';
import { StyleSheet } from 'react-native';

import { Screen } from '@/features/v2/ui';
import { SellerOrdersScreen } from '@/features/v2/seller-orders/seller-orders-screen';
import { DashboardBar } from '@/features/v2/dashboard/DashboardBar';

export default function SellerOrdersRoute() {
  return (
    <Screen
      header={<DashboardBar title="Orders" />}
      scroll={false}
      tabBar={false}
      contentStyle={styles.fill}
      testID="v2-seller-orders"
    >
      <SellerOrdersScreen />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** A FlashList inside a non-scrolling Screen needs the flex or it collapses. */
  fill: { flex: 1 },
});
