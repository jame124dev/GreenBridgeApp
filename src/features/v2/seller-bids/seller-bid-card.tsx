/**
 * Adapted from `inspections/inspection-card.tsx`'s shape, reused IN THIS
 * CODEBASE — the fourth time this session (after `bids/bid-card.tsx`,
 * `requests/request-card.tsx`). Thumb left, body right, top row of a
 * reference + status chip: the same composition, because this is the same
 * KIND of record (a batch, read at a glance) as every other row this
 * dashboard shows. See `inspection-card.tsx` for the original Obytes
 * provenance and licence — a fourth pull of that upstream file for a shape
 * already adjusted three times would be copying our own adjustments.
 *
 * | Inspection card | This card | Why |
 * |---|---|---|
 * | one status chip | status chip + a bid-count trailing figure | what a SELLER scans for here: is anyone bidding, and how many |
 * | two labelled dates | three inline stat words (total/accepted/pending) | `SellerBidDashboard.tsx:180-217`'s own stat grid, condensed to one line — a 2×2 grid of boxes at 423dp would be four squares for three numbers |
 * | — | product-count badge on the thumbnail | `SellerBidDashboard.tsx:139-143`'s "+N" badge — a batch's OWN listing can hold several products |
 *
 * ⚠️ NO "Edit listing" BUTTON. The web's edit button opens the seller's
 * upload/resume wizard (`SellerBidDashboard.tsx:227-234`) — no such flow is
 * wired from the v2 dashboard section, and a second tap target duplicating
 * the card's own destination is the failure this codebase keeps flagging.
 */
import React, { useState } from 'react';
// `Pressable` from REACT-NATIVE, not gesture-handler — the RNGH one does not
// apply this card's `borderRadius` + `overflow: 'hidden'` on Android. See the
// measured A/B in `features/v2/ui/ListCard.tsx`.
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';

import { Chip, MaterialFill, Text } from '@/features/v2/ui';
import { radius, space, usePressFeedback, useV2Colors } from '@/theme/v2';
import { routes } from '@/lib/routes';

import { batchStatusLabel, sellerBidTone, type SellerBidBatch } from './types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SellerBidCard(batch: SellerBidBatch) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();

  const [failed, setFailed] = useState(false);
  const first = batch.products?.[0];
  const cover = first?.images?.[0];
  const showImage = Boolean(cover) && !failed;
  const extra = Math.max(0, (batch.products?.length ?? 0) - 1);

  const pk = Number(batch.batch_id);
  const canOpen = Number.isFinite(pk) && pk > 0;
  const onPress = canOpen ? () => router.push(routes.v2ListingDetail(pk)) : undefined;

  const stats = [
    `${batch.summary.total} bid${batch.summary.total === 1 ? '' : 's'}`,
    batch.summary.accepted > 0 ? `${batch.summary.accepted} accepted` : null,
    batch.summary.pending > 0 ? `${batch.summary.pending} pending` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={!canOpen}
      accessibilityRole={canOpen ? 'link' : 'none'}
      accessibilityLabel={`Batch ${batch.batch_id}, ${batch.summary.total} bid${batch.summary.total === 1 ? '' : 's'}, ${batchStatusLabel(batch.status)}`}
      style={[styles.card, { borderColor: c.hairlineStrong }, animatedStyle]}
    >
      <View style={[styles.ground, { backgroundColor: c.surface }]}>
        <MaterialFill role="surface" ink="ink" radius={radius.lg} />
      </View>

      <View>
        {showImage ? (
          <Image
            style={styles.thumb}
            resizeMode="cover"
            source={{ uri: cover as string }}
            onError={() => setFailed(true)}
          />
        ) : (
          // flat: a placeholder where a photograph would be, not a control.
          <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: c.fill }]}>
            <Text variant="micro" color="inkSubtle">
              No photo
            </Text>
          </View>
        )}
        {extra > 0 ? (
          // flat: a count badge, 20pt — too small to carry a ramp.
          <View style={[styles.badge, { backgroundColor: c.accent }]}>
            <Text variant="micro" color="onAccent">
              +{extra}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text variant="caption" color="inkSubtle" style={styles.ref}>
            Batch #{batch.batch_id}
          </Text>
          <Chip label={batchStatusLabel(batch.status)} tone={sellerBidTone(batch)} />
        </View>

        <Text variant="rowTitle" numberOfLines={2} style={styles.title}>
          {first?.title || `Batch #${batch.batch_id}`}
        </Text>

        <Text variant="caption" color={batch.summary.pending > 0 ? 'accent' : 'inkSubtle'}>
          {stats}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radius.lg,
    marginBottom: space.lg,
  },
  ground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /** Same Android corner-clip note as `inspection-card.tsx` — see there. */
  thumb: {
    width: space['8xl'] * 3,
    height: space['8xl'] * 3,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: space.xs,
    right: space.xs,
    minWidth: space['3xl'],
    height: space['3xl'],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  body: { flex: 1, minWidth: 0, padding: space.xl, gap: space.xxs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ref: { flex: 1, minWidth: 0 },
  title: { minWidth: 0, marginBottom: space.xs },
});
