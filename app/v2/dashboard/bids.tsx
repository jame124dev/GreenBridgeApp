/**
 * `/v2/dashboard/bids` — My bids. **PHASE 2: wired to the real API.**
 *
 * The route is a wrapper; the screen is
 * `src/features/v2/bids/bids-screen.tsx`, which was COPIED from the Obytes
 * template (MIT) and adjusted — see its header for what changed. The card
 * beside it, `bid-card.tsx`, came from the same template's `post-card.tsx`.
 * That route/screen split is the template's own.
 *
 * ── THE HEADER IS COMPACT, AND NOTHING WAS COPIED FOR IT ──
 *
 * First version: `DashboardBar` + a 27pt `display` title + a `lead` subtitle
 * + the tabs. On the device that was ~500px — a quarter of the screen — of
 * chrome before the first bid, and it fitted two cards.
 *
 * Three template repos were checked for a header worth copying and none has
 * one: Obytes has no header component at all, and
 * `collapsible-tabs/example/src/Shared/Header.tsx` is eight lines wrapping a
 * title and a description in a fixed-height box. The thing in that repo that
 * IS worth having is the collapse-on-scroll behaviour, and that needs the
 * library, not a file.
 *
 * So this is a deletion, not a port:
 *
 * • The page name moved INTO `DashboardBar`, which was already rendering the
 *   word "Dashboard" — a label that told you nothing you could not see from
 *   the menu you just used. One title, in the bar, where a title belongs.
 * • The subtitle went. "Where you stand on everything you have bid on"
 *   explains a screen called My bids to someone who chose My bids.
 * • The tabs sit directly under the bar, inside the wash, so the sheet's
 *   curve starts at the content rather than 300px below it.
 *
 * ── PHASE 2 LANDED 2026-09-23, AND THE "BLOCKER" WAS NOT REAL ──
 *
 * This screen was held at a fixture for three sessions on the stated grounds
 * that phase 2 needed a dev/staging test login. It did not. The endpoint
 * answers **200 with real rows and no credentials at all** — it is part of the
 * unauthenticated identity-parameter route class in
 * `Docs/v2/SECURITY-WISHLIST.md`. The thing actually missing was never auth,
 * it was knowing WHICH buyer to ask for, and in dev that is one constant
 * (`DEV_BUYER_ID` in `useBuyerBids.ts`, `__DEV__`-gated so a release build
 * queries nothing rather than someone else's bids).
 *
 * The lesson is in `../../../MISTAKES.md`: a blocker asserted three times
 * without once curling the endpoint is a guess wearing a blocker's clothes.
 *
 * STILL A FIXTURE-ERA GAP: the **per-batch top bid**. `BuyerBidItem.top_bid`
 * is what makes a row read "Outbid", and the list endpoint does not carry it —
 * the web fetches it per batch (`bidApiSlice.ts:472`). Until that is wired,
 * "Outbid" can only appear when the list happens to include `top_bid`. The
 * derivation is already correct; the input is missing.
 *
 * ⚠️ THREE copies of each slice exist in `nextjs-port` (`src/rtk/slices/`,
 * `src/scanflow/rtk/slices/`, `src/services/api/slices/`), all defining
 * `BuyerBidItem` at line 34. The LIVE one is `src/services/api/slices/` —
 * that is what `shared/pages/buyer/MyBids.tsx:25-26` imports. So:
 * `services/api/slices/buyerApiSlice.ts:274` (query; URL at :315) and
 * `services/api/slices/bidApiSlice.ts:472`.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/features/v2/ui';
import { BidsScreen } from '@/features/v2/bids/bids-screen';
import { DashboardBar } from '@/features/v2/dashboard/DashboardBar';

export default function BidsRoute() {
  return (
    <Screen
      header={
        <View>
          <DashboardBar title="My bids" />
        </View>
      }
      scroll={false}
      tabBar={false}
      contentStyle={styles.fill}
      testID="v2-bids"
    >
      <BidsScreen />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** A FlashList inside a non-scrolling Screen needs the flex or it collapses. */
  fill: { flex: 1 },
});
