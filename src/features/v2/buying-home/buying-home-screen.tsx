/**
 * Buying home — composed directly from kit primitives, the same way
 * `order-detail-screen.tsx` is. See `./types.ts` for the full audit of what
 * was taken from `BuyerDashboard.tsx` (1,103 lines) and what was deliberately
 * left out.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CreditCard, Truck, CalendarClock } from 'lucide-react-native';

import { Row, SectionHeader, SectionNote, Text, TintedRow } from '@/features/v2/ui';
import { GUTTER, icon, space, useV2Colors } from '@/theme/v2';
import { routes } from '@/lib/routes';

import { HOME_BIDS_FIXTURE, HOME_COUNTS, HOME_INSPECTIONS_FIXTURE } from './__fixtures__/buying-home';
import { buildActionItems, type ActionItem } from './types';

const GLYPHS: Record<ActionItem['kind'], (color: string) => React.ReactNode> = {
  payment_due: (c) => <CreditCard size={icon.lg} color={c} strokeWidth={1.75} />,
  pickup_ready: (c) => <Truck size={icon.lg} color={c} strokeWidth={1.75} />,
  inspection_soon: (c) => <CalendarClock size={icon.lg} color={c} strokeWidth={1.75} />,
};

export function BuyingHomeScreen() {
  const c = useV2Colors();

  // PHASE 1: fixtures shaped to exercise the three thresholds — see the
  // fixture file's table. Phase 2 reads the real bids/inspections lists.
  const actionItems = buildActionItems(HOME_BIDS_FIXTURE, HOME_INSPECTIONS_FIXTURE);

  const openBatch = (batchId: number) => router.push(routes.v2ListingDetail(batchId));

  return (
    <View style={styles.pad}>
      {/*
        Action Required — `BuyerDashboard.tsx:330-405`, verbatim thresholds
        (see `types.ts`). The web returns `null` outright when there is
        nothing due; here the header stays (this dashboard has no other
        "nothing to report" moment) and a quiet reassurance line takes the
        list's place — never BOTH an "all caught up" state and a populated
        "At a glance" grid competing for attention below it.
      */}
      <View style={styles.section}>
        <SectionHeader title="Action needed" chip={actionItems.length > 0 ? String(actionItems.length) : undefined} />
        {actionItems.length > 0 ? (
          actionItems.map((item) => (
            <TintedRow
              key={item.key}
              title={item.label}
              glyph={GLYPHS[item.kind](c.accent)}
              onPress={() => openBatch(item.batchId)}
            />
          ))
        ) : (
          <SectionNote>You&rsquo;re all caught up — nothing needs action right now.</SectionNote>
        )}
      </View>

      {/*
        The stat-tile grid on the web (`:552-577`) becomes Rows here — the
        plan's own "Build with" list names `Row` + `Chip`, not a new tile
        component, and a 2×2 grid would be a KIT GAP invented for one screen.
        Each row IS a real, built screen — this dashboard's whole job is
        pointing at them, not re-listing their contents. See `types.ts` for
        why this is 4 rows and not the web's 4 (Won lots dropped as a filter
        of Active bids already one tap away; WTB "Open requests" has no v2
        screen and was replaced with the real Orders & requests one).
      */}
      <View style={styles.section}>
        <SectionHeader title="At a glance" />
        <Row
          title="Active bids"
          trailing={<Text variant="rowTitle">{HOME_COUNTS.activeBids}</Text>}
          onPress={() => router.push(routes.v2Bids)}
        />
        <Row
          title="Watchlist"
          trailing={<Text variant="rowTitle">{HOME_COUNTS.watchlist}</Text>}
          onPress={() => router.push(routes.v2Watchlist)}
        />
        <Row
          title="Orders & requests"
          trailing={<Text variant="rowTitle">{HOME_COUNTS.ordersRequests}</Text>}
          onPress={() => router.push(routes.v2Requests)}
        />
        <Row
          title="Inspections"
          trailing={<Text variant="rowTitle">{HOME_COUNTS.inspections}</Text>}
          onPress={() => router.push(routes.v2Inspections)}
        />
      </View>

      {/*
        No "Recent activity" list here — see `types.ts` for why the web's
        450-line tabbed reimplementation was not ported. If this screen is
        ever felt to need one, it belongs as a short, capped preview linking
        to the relevant full screen, never a second full list.
      */}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: GUTTER },
  section: { marginBottom: space.xl },
});
