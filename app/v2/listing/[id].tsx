/**
 * Listing detail — a published batch, opened from `/v2/listings` or from 6a
 * Home's LIVE LISTINGS rows.
 *
 * ⚠️ NOT IN THE CANVAS, and unlike the two list screens this one had no Home
 * section to derive from either. So the composition below is a design decision,
 * and these are the three calls made:
 *
 * 1. **No hero image.** The obvious move is a big photo at the top, and the old
 *    screen does exactly that. But the kit has no hero primitive — adding one
 *    would be inventing a component to fill a screen, which is the drift the
 *    `v2-screen` skill exists to stop. It is also wrong on the data: a batch is
 *    N products, and picking product[0]'s first photo as "the" image is a lie
 *    about a 12-item lot. The items carry their own thumbnails instead.
 *
 * 2. **Facts as rows, not as a stat strip.** The old screen renders a 4-up
 *    strip (Items / Bids / 14% / Comm.). At 423dp that is four columns of
 *    ~95dp, which truncates the moment a number has a unit. Rows are the
 *    design's own device — "space instead of boxes" — and they do not break.
 *
 * 3. **Status is a Chip, once, next to the title.** Not repeated per section.
 *
 *     [G] GREENBIDZ                                   EN   bell•
 *     Batch #5091                            [ In review ]
 *     1 item · Lab equipment
 *
 *     ITEMS 1
 *     ┌──────────────────────────────────────────────────────┐
 *     │ [ img ]  Keysight EDUX1002G oscilloscope              │  card
 *     │          Keysight · EDUX1002G                         │
 *     └──────────────────────────────────────────────────────┘
 *
 *     BIDDING
 *     Offers                                               0
 *     Asking                                     $1,500 USD
 *     Location                                      Taiwan
 *
 *     ( View on greenbidz.com )
 *
 * ITEMS moved from a plain `Row` to the kit's `ListCard`
 * (`@/features/v2/ui/ListCard.tsx`) 2026-09-24, matching the card treatment
 * Home's Drafts/Live Listings picked up the same day — see that file's
 * docblock for the shape's provenance. `Bidding`'s fact rows stay plain
 * `Row`s: those are label/value pairs, not a list of tappable records, and
 * were never part of that change.
 *
 * DATA — `useBatchDetail`, the same hook and endpoint the old screen uses. Read
 * only: nothing here writes, and the actions that WOULD write (edit, pause,
 * relist) are not built — `TODO(v2-writes)`.
 */
import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  BrandBar,
  Chip,
  ListCard,
  QuietAction,
  Row,
  Screen,
  SectionHeader,
  SectionNote,
  Text,
} from '@/features/v2/ui';
import { GUTTER, SECTION_GAP, space } from '@/theme/v2';
import { requireAuth } from '@/features/auth/requireAuth';
import { useBatchDetail } from '@/features/scanner/useBatchDetail';
import { useLabNotifications } from '@/features/lab/notifications/useLabNotifications';
import { getSellerListingWebUrl } from '@/lib/env';
import { routes } from '@/lib/routes';
import { haptics } from '@/lib/haptics';

/** The batch's own status, worded for a seller rather than for the database. */
function statusLabel(approval?: string, status?: string): string {
  const a = (approval ?? '').toLowerCase();
  if (a === 'approved') return 'Live';
  if (a === 'pending' || a === 'in_review') return 'In review';
  if (a === 'rejected') return 'Needs changes';
  const s = (status ?? '').toLowerCase();
  if (s === 'sold') return 'Sold';
  if (s) return s.charAt(0).toUpperCase() + s.slice(1);
  return 'Submitted';
}

function money(amount?: number, currency?: string): string | undefined {
  if (amount == null) return undefined;
  const prefix = currency === 'TWD' ? 'NT$' : '$';
  return `${prefix}${amount.toLocaleString()}${currency ? ` ${currency}` : ''}`;
}

/**
 * A label/value line. `Row`'s trailing slot, so it stays on the kit's rhythm.
 *
 * ⚠️ Renders NOTHING when the value is missing or is just the field's own name.
 * Measured on device 2026-09-17, batch 5091 came back with
 * `bidding.location === "Location"` — the API passes `raw.location` straight
 * through (`fetchBatchDetail.ts:147`), so an unfilled field arrives as its own
 * label and the row read "Location            Location".
 *
 * A row that states a non-fact is worse than an absent row: the seller cannot
 * tell it apart from a real answer. Absence at least reads as "not set".
 * This guards the SYMPTOM only — the upstream data is still wrong, and the old
 * listing screen still shows it.
 */
function FactRow({ label, value }: { label: string; value?: string }) {
  const v = value?.trim();
  if (!v || v.toLowerCase() === label.toLowerCase()) return null;
  return <Row title={label} tone="muted" trailing={<Text variant="rowTitle">{v}</Text>} />;
}

export default function V2ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { unreadCount } = useLabNotifications();

  const batchPk = id ? Number(id) : NaN;
  const valid = Number.isFinite(batchPk);
  const { data, isLoading, isError } = useBatchDetail(valid ? batchPk : undefined);

  const webUrl = getSellerListingWebUrl(valid ? batchPk : undefined);

  const header = (
    <BrandBar
      unread={unreadCount}
      onNotifications={() => {
        haptics.tap();
        requireAuth('notifications', () => router.push(routes.labNotifications));
      }}
    />
  );

  /*
    Chrome belonging to a state must not render outside that state (skill
    § Coherence). So the title block is only drawn once there IS a batch —
    otherwise this screen would announce "Batch #NaN · 0 items" above "that
    listing did not load", claiming detail about a thing it does not have.
  */
  if (!valid || isError) {
    return (
      <Screen header={header} headerFlush testID="v2-listing-detail">
        <View style={styles.pad}>
          <Text variant="display">Listing</Text>
          <SectionNote>
            That listing did not load. Go back to your listings and open it again.
          </SectionNote>
          <QuietAction
            label="Back to my listings"
            onPress={() => {
              haptics.tap();
              router.replace(routes.v2Listings);
            }}
            style={styles.backAction}
          />
        </View>
      </Screen>
    );
  }

  if (isLoading || !data) {
    return (
      <Screen header={header} headerFlush testID="v2-listing-detail">
        <View style={styles.pad}>
          <SectionNote>Opening this listing…</SectionNote>
        </View>
      </Screen>
    );
  }

  const bidding = data.bidding;
  const items = data.products ?? [];
  const asking = money(bidding?.targetPrice, bidding?.currency);
  const offers = Number(bidding?.buyerBidCount) || 0;
  const meta = [
    `${data.productCount} ${data.productCount === 1 ? 'item' : 'items'}`,
    data.category,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen header={header} headerFlush testID="v2-listing-detail">
      <View style={styles.pad}>
        <View style={styles.titleRow}>
          <Text variant="display" style={styles.title}>
            Batch #{data.batchNumber}
          </Text>
          <Chip label={statusLabel(data.approvalStatus, data.status)} tone="accent" />
        </View>
        <Text variant="body" color="inkMuted" style={styles.meta}>
          {meta}
        </Text>
      </View>

      <View style={styles.section} />
      <SectionHeader title="Items" chip={String(data.productCount)} />
      {items.length === 0 ? (
        <SectionNote>No items are attached to this batch.</SectionNote>
      ) : (
        items.map((p, i) => (
          <ListCard
            key={p.productId}
            uri={p.images?.[0]}
            title={p.title || `Item ${i + 1}`}
            subtitle={[p.brand, p.model].filter(Boolean).join(' · ') || p.category}
          />
        ))
      )}

      <View style={styles.section} />
      <SectionHeader title="Bidding" />
      {/* `FactRow` drops anything empty or placeholder, so no guards here. */}
      <FactRow label="Offers" value={String(offers)} />
      <FactRow label="Asking" value={asking} />
      <FactRow label="Location" value={bidding?.location} />
      <FactRow
        label="Commission"
        value={data.commissionPercent != null ? `${data.commissionPercent}%` : undefined}
      />

      {webUrl ? (
        <>
          <View style={styles.section} />
          <QuietAction
            label="View on the web"
            onPress={() => {
              haptics.tap();
              void Linking.openURL(webUrl);
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: GUTTER, paddingTop: space['5xl'] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space['3xl'] },
  /** `flexShrink` so a long batch number cannot push the status chip off-screen. */
  title: { flexShrink: 1 },
  meta: { marginTop: space.lg },
  section: { height: SECTION_GAP },
  backAction: { marginTop: space['5xl'] },
});
