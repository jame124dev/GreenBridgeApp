/**
 * Listing card — adapted from the `seller-bid-card.tsx` lineage.
 *
 * Left thumbnail (with +N multi-item badge for multi-lot batches), top row
 * with batch reference number and status chip, two-line title, and bottom
 * commercial summary (status, items count, bids/offers).
 *
 * Uses `MaterialFill` for surface depth and `usePressFeedback` for tactile
 * spring press animation.
 */
import React, { useState } from 'react';
// `Pressable` from REACT-NATIVE, not gesture-handler: the RNGH one does not
// apply this card's `borderRadius` + `overflow: 'hidden'` to its native view on
// Android, so the card drew square around its rounded ground — a visible
// stepped edge, obvious in dark mode. Measured on device 2026-09-25; the full
// note and the A/B are in `features/v2/ui/ListCard.tsx`.
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Chip, MaterialFill, Text } from '@/features/v2/ui';
import { radius, space, usePressFeedback, useV2Colors } from '@/theme/v2';
import {
  STATUS_LABEL,
  listingSubtitle,
  listingTitle,
  photoUri,
} from './presentation';
import { classifyStatus } from '@/features/scanner/batchStatus';
import type { SellerBatch } from '@/types/batch';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ListingCard({
  listing,
  onPress,
}: {
  listing: SellerBatch;
  onPress: () => void;
}) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();
  const [failed, setFailed] = useState(false);

  const cover = photoUri(listing.thumbnailUrl);
  const showImage = Boolean(cover) && !failed;
  const extra = Math.max(0, (listing.itemsCount ?? 0) - 1);

  const statusToneKey = classifyStatus(listing);
  const statusLabel = STATUS_LABEL[statusToneKey] || 'Submitted';
  const chipTone = statusToneKey === 'live' || (listing.bidsCount ?? 0) > 0 ? 'accent' : 'neutral';

  const title = listingTitle(listing);
  const subtitle = listingSubtitle(listing);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="link"
      accessibilityLabel={`Batch ${listing.batchId}, ${title}, ${statusLabel}`}
      style={[styles.card, { borderColor: c.hairlineStrong }, animatedStyle]}
      testID={`v2-listing-${listing.batchPk}`}
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
          <Text variant="caption" color="inkSubtle" style={styles.ref} numberOfLines={1}>
            Batch #{listing.batchId}
          </Text>
          <Chip label={statusLabel} tone={chipTone} />
        </View>

        <Text variant="rowTitle" numberOfLines={2} style={styles.title}>
          {title}
        </Text>

        <Text
          variant="caption"
          color={(listing.bidsCount ?? 0) > 0 ? 'accent' : 'inkSubtle'}
          numberOfLines={1}
        >
          {subtitle}
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
