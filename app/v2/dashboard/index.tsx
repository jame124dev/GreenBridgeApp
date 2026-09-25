/**
 * `/v2/dashboard` — Buying home. **PHASE 1: UI only, no network.**
 *
 * ⚠️ WAS a bare `<Redirect href={DASHBOARD_HOME} />` to `/v2/dashboard/bids`
 * (`routes.ts:157-166`'s own note explains why: expo-router's typed routes
 * have no bare `/v2/dashboard` href under a Drawer layout, so this file is
 * what makes the path resolve at all). It now IS the buying-home screen
 * instead of redirecting past it — the redirect only existed because this
 * screen did not exist yet.
 *
 * Built LAST, per its own plan (`Docs/Dashboard/buyer/dashboard/README.md`):
 * "a composition of rows that the other screens define. Building it early
 * means inventing those rows twice." Full audit of what was taken from the
 * 1,103-line web source and what was deliberately left out is in
 * `src/features/v2/buying-home/types.ts`.
 */
import React from 'react';
import { StyleSheet } from 'react-native';

import { Screen } from '@/features/v2/ui';
import { BuyingHomeScreen } from '@/features/v2/buying-home/buying-home-screen';
import { DashboardBar } from '@/features/v2/dashboard/DashboardBar';

export default function DashboardHomeRoute() {
  return (
    <Screen
      header={<DashboardBar title="Buying" />}
      tabBar={false}
      contentStyle={styles.fill}
      testID="v2-buying-home"
    >
      <BuyingHomeScreen />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** Gutter lives in `BuyingHomeScreen`'s own styles, matching every sibling dashboard route. */
  fill: { flex: 1 },
});
