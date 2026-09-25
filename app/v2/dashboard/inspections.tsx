/**
 * `/v2/dashboard/inspections` — Inspections. **PHASE 1: UI only, no network.**
 *
 * Built with `Docs/Dashboard/PAGE_PLAYBOOK.md`. The screen is
 * `src/features/v2/inspections/inspections-screen.tsx` and its card is
 * `inspection-card.tsx`, both COPIED from the Obytes template (MIT) and
 * adjusted — see their headers. The tab row is reused from the bids screen.
 *
 * ── THE PLAN'S ROUTE IS STALE, AGAIN ──
 *
 * `Docs/Dashboard/buyer/inspections/README.md` gives `/v2/buying/inspections`.
 * Every dashboard page lives under `/v2/dashboard/` and is reached from
 * `DASHBOARD_GROUPS` in `src/features/v2/dashboard/nav.ts`. Same stale row as
 * the watchlist had; corrected there too.
 *
 * ⚠️ WHAT IS DELIBERATELY NOT HERE: the data. Phase 2 swaps one import for
 * `GET /inspection/buyer/{buyerId}`
 * (`nextjs-port/src/services/api/slices/buyerApiSlice.ts:332`, URL at `:352`)
 * and moves the status filter to the SERVER — the web sends it as a param and
 * the pagination totals describe the filtered set, so filtering locally would
 * make the count disagree with the list.
 */
import React from 'react';
import { StyleSheet } from 'react-native';

import { Screen } from '@/features/v2/ui';
import { InspectionsScreen } from '@/features/v2/inspections/inspections-screen';
import { DashboardBar } from '@/features/v2/dashboard/DashboardBar';

export default function InspectionsRoute() {
  return (
    <Screen
      header={<DashboardBar title="Inspections" />}
      scroll={false}
      tabBar={false}
      contentStyle={styles.fill}
      testID="v2-inspections"
    >
      <InspectionsScreen />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** A FlashList inside a non-scrolling Screen needs the flex or it collapses. */
  fill: { flex: 1 },
});
