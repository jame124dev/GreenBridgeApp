/**
 * `/v2/dashboard/seller-bids` — Bids on my listings (seller). **PHASE 1: UI
 * only, no network.**
 *
 * Built with `Docs/Dashboard/PAGE_PLAYBOOK.md`. Screen:
 * `src/features/v2/seller-bids/seller-bids-screen.tsx`, card:
 * `seller-bid-card.tsx` — see their headers.
 *
 * ── THE PLAN WAS WRONG ABOUT WHICH DATA THIS SCREEN SHOWS ──
 *
 * `Docs/Dashboard/seller/bids/README.md` says: don't build a new screen,
 * reuse the buyer's `MyBids` with a `batchBasePath` prop — "the web proves it
 * is the buyer screen with one prop." Checked `MyBids.tsx` before trusting
 * it: that prop only changes a navigation URL, never the query. Following the
 * plan literally would have shown a seller THEIR OWN bids placed as a buyer
 * — the opposite of "bids on my listings." The real, live content is
 * `SellerAuctionBidsPanel` (`SellerBidDashboard.tsx`), reached through a
 * `@deprecated` redirect into a 3-tab parent (`SellerBuyerActivity.tsx`), on
 * a THIRD endpoint the plan never cited: `GET /buyer/bid/seller/{userId}`
 * (`batchApiSlice.ts`, verified live 2026-09-24). Full audit in
 * `src/features/v2/seller-bids/types.ts`.
 *
 * The web's other two tabs (`negotiated-offers`, `buy-now-orders`) map to
 * this dashboard's next two planned pages (Offers received, Orders) — not
 * folded into this one.
 *
 * ⚠️ WHAT IS DELIBERATELY NOT HERE: the data, and any "Edit listing" action
 * — no seller write flow is wired anywhere in the v2 dashboard section, and a
 * second tap target duplicating the card's own destination is the duplicate-
 * control failure this codebase keeps flagging.
 */
import React from 'react';
import { StyleSheet } from 'react-native';

import { Screen } from '@/features/v2/ui';
import { SellerBidsScreen } from '@/features/v2/seller-bids/seller-bids-screen';
import { DashboardBar } from '@/features/v2/dashboard/DashboardBar';

export default function SellerBidsRoute() {
  return (
    <Screen
      header={<DashboardBar title="Bids on my listings" />}
      scroll={false}
      tabBar={false}
      contentStyle={styles.fill}
      testID="v2-seller-bids"
    >
      <SellerBidsScreen />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** A FlashList inside a non-scrolling Screen needs the flex or it collapses. */
  fill: { flex: 1 },
});
