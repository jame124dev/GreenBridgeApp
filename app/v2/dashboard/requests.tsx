/**
 * `/v2/dashboard/requests` — Orders & requests. **PHASE 1: UI only, no network.**
 *
 * Built with `Docs/Dashboard/PAGE_PLAYBOOK.md`. Screen:
 * `src/features/v2/requests/requests-screen.tsx`, card:
 * `request-card.tsx` — see their headers for what was copied vs. reused
 * in-codebase.
 *
 * ── THE PLAN DOC WAS WRONG ABOUT THE ENDPOINT SHAPE ──
 *
 * `Docs/Dashboard/buyer/requests/README.md` lists ONE endpoint
 * (`/order/buyer/{id}`) and describes it as returning "Buy Now purchases AND
 * Make Offer requests in one list". Checked against the web source before
 * building: there are TWO endpoints — `/order/buyer/{id}` (orders only,
 * `orderApiSlice.ts:85`) and `/offer/user?buyer_id={id}` (offers only,
 * `bidApiSlice.ts:641`) — merged on the CLIENT. The web's own screen
 * docblock says as much; the plan doc's summary line did not match its own
 * source. See `src/features/v2/requests/types.ts` for the full audit.
 *
 * ⚠️ ALSO WRONG: "Build with Row + RowThumb" (`phase-1-ui.md`). `Row`'s API
 * (title + subtitle + one meta line + trailing) is too thin for this data —
 * a 4-field meta strip (date/amount/type/reference) plus dual status/urgency
 * lines. Built with the card lineage from `bids/`/`inspections/` instead;
 * see `request-card.tsx`'s header for why that reuse beats a third Obytes pull.
 *
 * ⚠️ WHAT IS DELIBERATELY NOT HERE: the data, AND the "Pay now" action. Phase
 * 2 swaps two fixture imports for the two real queries, run in parallel with
 * the web's partial-load handling (`requests-screen.tsx`'s header). A
 * "Pay now" button was NOT added even for an accepted-offer row — no payment
 * or checkout screen exists anywhere in v2 mobile, so a button there would
 * open nothing. Surfaced as an urgency line instead; see `isDueNow` in
 * `types.ts`.
 */
import React from 'react';
import { StyleSheet } from 'react-native';

import { Screen } from '@/features/v2/ui';
import { RequestsScreen } from '@/features/v2/requests/requests-screen';
import { DashboardBar } from '@/features/v2/dashboard/DashboardBar';

export default function RequestsRoute() {
  return (
    <Screen
      header={<DashboardBar title="Orders & requests" />}
      scroll={false}
      tabBar={false}
      contentStyle={styles.fill}
      testID="v2-requests"
    >
      <RequestsScreen />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** A FlashList inside a non-scrolling Screen needs the flex or it collapses. */
  fill: { flex: 1 },
});
