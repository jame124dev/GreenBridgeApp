/**
 * `/v2/dashboard/seller-offers` — Offers received (seller). **PHASE 1: UI
 * only, no network. The Accept/Reject/Mark sold/Decline flow is real UI over
 * a simulated write — see `seller-offers-screen.tsx`'s docblock.**
 *
 * Built with `Docs/Dashboard/PAGE_PLAYBOOK.md`. Screen:
 * `src/features/v2/seller-offers/seller-offers-screen.tsx`, card:
 * `offer-card.tsx`, confirm sheet: the kit's `ConfirmSheet`
 * (`@/features/v2/ui/ConfirmSheet.tsx`) — see their headers. The confirm
 * sheet started as a screen-local copy and was promoted into the kit
 * 2026-09-24 once a second screen (`seller-orders`) needed the identical
 * shape; see `ConfirmSheet.tsx`'s own docblock for its real provenance
 * (`chat/AttachSheet.tsx`, from the Obytes clone).
 *
 * Unlike the previous seller page, `SellerOffer.tsx` (the plan's named
 * source) is genuinely live — imported by exactly one route, no redirect
 * indirection. Checked anyway, per this session's now-standard discipline,
 * and found two real things:
 *
 * ⚠️ A SECURITY FINDING: the live endpoint
 * (`GET /offer/seller?sellerID={id}`) is unauthenticated AND its response
 * embeds each buyer's password hash (`user_pass`) and
 * `user_activation_key` in a nested `buyer` object that the web UI itself
 * never even reads. Full write-up: `Docs/v2/SECURITY-WISHLIST.md`,
 * 2026-09-24 entry. This screen's types model ONLY `user_id` — see
 * `src/features/v2/seller-offers/types.ts`'s docblock for why that field is
 * typed `unknown` rather than modelled further.
 *
 * ⚠️ THE PLAN'S HTTP METHOD IS WRONG. `README.md` says `PUT
 * /offer/{offer_id}/status`; the live mutation
 * (`bidApiSlice.ts:665-675`) sends `PATCH`. Phase 2 must use PATCH.
 */
import React from 'react';
import { StyleSheet } from 'react-native';

import { Screen } from '@/features/v2/ui';
import { SellerOffersScreen } from '@/features/v2/seller-offers/seller-offers-screen';
import { DashboardBar } from '@/features/v2/dashboard/DashboardBar';

export default function SellerOffersRoute() {
  return (
    <Screen
      header={<DashboardBar title="Offers received" />}
      scroll={false}
      tabBar={false}
      contentStyle={styles.fill}
      testID="v2-seller-offers"
    >
      <SellerOffersScreen />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** A FlashList inside a non-scrolling Screen needs the flex or it collapses. */
  fill: { flex: 1 },
});
