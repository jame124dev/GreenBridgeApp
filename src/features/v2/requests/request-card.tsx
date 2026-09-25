/**
 * Adapted from `inspections/inspection-card.tsx` — reused IN THIS CODEBASE
 * rather than pulled from Obytes a third time. The shape (square thumbnail
 * left, body right, a top row of batch-ref + status chip) is identical to the
 * inspection card; a fourth pull of the same upstream file for a shape we
 * already have and have adjusted once would be copying our own adjustments,
 * not borrowing anything new. See `inspection-card.tsx` for the original
 * Obytes provenance and licence.
 *
 * | Inspection card | This card | Why |
 * |---|---|---|
 * | one status chip | status chip + a TYPE tag (`Buy Now` / `Offer`) | the web's `TypeBadge`, `BuyerRequests.tsx:110-127` — two sources in one list need to say which |
 * | two labelled dates | one date + amount + reference | what THIS screen is for: how much, and which order/offer number |
 * | — | an urgency line when `isDueNow` | `BuyerRequests.tsx:262-263, 519-524` — "Your turn — payment due" |
 * | `first?.title \|\| '—'` | `title \|\| 'Batch #{id}'` | `BuyerRequests.tsx:499`; an order has NO title at all, so "—" would read as a missing field rather than the normal case |
 *
 * ⚠️ NO SEPARATE "Pay now" BUTTON. The web's `dueNow` row gets a second button
 * beside "View details" that opens a checkout flow. No payment screen exists
 * in v2 mobile — see `isDueNow`'s docblock in `./types.ts`. One tap target,
 * same as every other row; the urgency line says what's owed, the destination
 * (once a payment screen exists) is where you'd act on it.
 */
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';

import { Chip, MaterialFill, Text } from '@/features/v2/ui';
import { radius, space, usePressFeedback, useV2Colors } from '@/theme/v2';
import { routes } from '@/lib/routes';

import { isDueNow, requestStatusLabel, type RequestItem } from './types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Same shape as `bids/bid-card.tsx`'s local helper — not shared, both tiny. */
function shortDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function money(amount: number, currency: string): string {
  if (!amount) return '';
  const n = amount.toLocaleString('en-US');
  return currency ? `${currency} ${n}` : n;
}

export function RequestCard(item: RequestItem) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();

  const [failed, setFailed] = useState(false);
  const showImage = Boolean(item.image) && !failed;

  const pk = Number(item.batchId);
  const canOpen = Number.isFinite(pk) && pk > 0;
  const onPress = canOpen ? () => router.push(routes.v2ListingDetail(pk)) : undefined;

  const dueNow = isDueNow(item);
  const statusLabel = requestStatusLabel(item.kind, item.status);
  const kindLabel = item.kind === 'buy_now' ? 'Buy Now' : 'Offer';

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={!canOpen}
      accessibilityRole={canOpen ? 'link' : 'none'}
      accessibilityLabel={`${kindLabel} ${item.reference}, ${statusLabel}`}
      style={[
        styles.card,
        { borderColor: dueNow ? c.accent : c.hairlineStrong },
        animatedStyle,
      ]}
    >
      <View style={[styles.ground, { backgroundColor: c.surface }]}>
        <MaterialFill role="surface" ink="ink" radius={radius.lg} />
      </View>

      {showImage ? (
        <Image
          style={styles.thumb}
          resizeMode="cover"
          source={{ uri: item.image as string }}
          onError={() => setFailed(true)}
        />
      ) : (
        // flat: a placeholder where a photograph would be, not a control.
        // Also the ALWAYS case for a Buy Now row — orders carry no join.
        <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: c.fill }]}>
          <Text variant="micro" color="inkSubtle">
            No photo
          </Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.topRow}>
          {/* `minWidth: 0` or a long reference pushes the chips off the card. */}
          <Text variant="caption" color="inkSubtle" style={styles.ref}>
            {kindLabel} {item.reference}
          </Text>
          <Chip label={statusLabel} tone={dueNow ? 'accent' : 'neutral'} />
        </View>

        <Text variant="rowTitle" numberOfLines={2} style={styles.title}>
          {item.title || `Batch #${item.batchId}`}
        </Text>

        <Text variant="caption" color="inkSubtle">
          {[money(item.amount, item.currency), shortDate(item.date)].filter(Boolean).join('  ·  ')}
          {item.productCount > 1 ? `  ·  +${item.productCount - 1} more` : ''}
        </Text>

        {dueNow ? (
          <Text variant="captionMedium" color="accent" style={styles.dueNow}>
            Your turn — payment due
          </Text>
        ) : null}
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
  body: { flex: 1, minWidth: 0, padding: space.xl, gap: space.xxs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ref: { flex: 1, minWidth: 0 },
  title: { minWidth: 0, marginBottom: space.xs },
  dueNow: { marginTop: space.xxs },
});
