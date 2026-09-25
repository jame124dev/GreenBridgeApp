/**
 * `/v2/dashboard/watchlist` — Watchlist. **PHASE 1: UI only, no network.**
 *
 * Built with `Docs/Dashboard/PAGE_PLAYBOOK.md`. The route is a wrapper; the
 * screen is `src/features/v2/watchlist/watchlist-screen.tsx` and its tile is
 * `watch-tile.tsx`, both COPIED from the Obytes template (MIT) and adjusted —
 * see their headers.
 *
 * ── TWO PLACES THE PLAN WAS WRONG, CHECKED BEFORE BUILDING ──
 *
 * `Docs/Dashboard/buyer/watchlist/README.md` gives the route as
 * `/v2/buying/watchlist`. That predates the dashboard drawer; every dashboard
 * page lives under `/v2/dashboard/` and is reached from
 * `DASHBOARD_GROUPS` in `src/features/v2/dashboard/nav.ts`. Corrected there.
 *
 * `phase-1-ui.md` says "build with `Row` + `RowThumb`". The web page is not a
 * table and not a list of rows — it is a 4:3 image-card grid
 * (`BuyerWatchlist.tsx:95-110`), 2–4 columns by breakpoint. A watchlist is
 * answered by looking, so the image is the record and rows would bury it.
 * Two columns here; the plan's line was written from the section's generic
 * advice rather than from this page.
 *
 * ⚠️ WHAT IS DELIBERATELY NOT HERE: the data. Phase 2 swaps one import for
 * `GET /wishlist/{buyerId}` — **which is the documented unauthenticated
 * IDOR** (`Docs/v2/SECURITY-WISHLIST.md`): no auth guard on prod, any id in
 * the path returns that user's saved items. Shipping a "saved items" screen
 * on it is a decision, not a wiring task. See `phase-2-api.md`.
 */
import React from 'react';
import { StyleSheet } from 'react-native';

import { Screen } from '@/features/v2/ui';
import { WatchlistScreen } from '@/features/v2/watchlist/watchlist-screen';
import { DashboardBar } from '@/features/v2/dashboard/DashboardBar';

export default function WatchlistRoute() {
  return (
    <Screen
      header={<DashboardBar title="Watchlist" />}
      scroll={false}
      tabBar={false}
      contentStyle={styles.fill}
      testID="v2-watchlist"
    >
      <WatchlistScreen />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** A FlashList inside a non-scrolling Screen needs the flex or it collapses. */
  fill: { flex: 1 },
});
