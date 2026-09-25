/**
 * Sixth pull of the `inspection-card.tsx`/`offer-card.tsx` lineage — thumb,
 * ref + status chip, title, meta line, action row.
 *
 * ⚠️ NO FULL `Timeline` ON THE ROW, DESPITE THE PLAN SAYING "Build with:
 * Timeline for the state." A 6-dot progress rail repeated on every row of a
 * SCANNING list is heavy — every row would draw the same rail shape at a
 * different position, which is a lot of chrome to say one word ("Shipped").
 * `Timeline` is the right primitive for a SINGLE order's own detail page
 * (already built — `order-detail/order-detail-screen.tsx` uses exactly this
 * component for exactly this vocabulary) and the wrong one for a list of N
 * orders. A compact status chip + payment chip carries the same information
 * at list density; the full rail is one tap away.
 *
 * Two chips, not one — `offer-card.tsx`/`seller-bid-card.tsx` only needed
 * one. A checkout genuinely has two independent axes here: fulfilment
 * (`pending → … → completed`) and payment (`pending/manual_received/
 * success/failed`), and collapsing them into one chip would hide whichever
 * axis lost.
 */
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Chip, MaterialFill, PillButton, Text } from '@/features/v2/ui';
import { radius, space, useV2Colors } from '@/theme/v2';

import {
  ORDER_TRANSITIONS,
  checkoutStatusLabel,
  checkoutTone,
  formatOrderDate,
  money,
  paymentStatusLabel,
  type CheckoutStatus,
  type SellerCheckout,
} from './types';

export function OrderCard({
  order,
  onTransition,
}: {
  order: SellerCheckout;
  onTransition: (checkoutId: number, to: CheckoutStatus, label: string) => void;
}) {
  const c = useV2Colors();
  const [failed, setFailed] = useState(false);

  const first = order.batch?.products?.[0];
  const cover = first?.image1;
  const showImage = Boolean(cover) && !failed;
  const transitions = ORDER_TRANSITIONS[order.status] ?? [];

  return (
    <View style={[styles.card, { borderColor: c.hairlineStrong }]}>
      <View style={[styles.ground, { backgroundColor: c.surface }]}>
        <MaterialFill role="surface" ink="ink" radius={radius.lg} />
      </View>

      <View style={styles.row}>
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

        <View style={styles.body}>
          <View style={styles.topRow}>
            <Text variant="caption" color="inkSubtle" style={styles.ref}>
              Order #{order.checkout_id}
            </Text>
            <Chip label={checkoutStatusLabel(order.status)} tone={checkoutTone(order.status)} />
          </View>

          <Text variant="rowTitle" numberOfLines={2} style={styles.title}>
            {first?.title || `Batch #${order.batch_id}`}
          </Text>

          <Text variant="caption" color="inkSubtle">
            Buyer #{order.buyer_id}
            {'  ·  '}
            {money(order.total_price, order.currency)}
            {order.quantity > 1 ? `  ·  ×${order.quantity}` : ''}
          </Text>

          <View style={styles.metaRow}>
            <Chip label={paymentStatusLabel(order.payment_status)} tone="neutral" />
            {order.createdAt ? (
              <Text variant="micro" color="inkSubtle">
                {formatOrderDate(order.createdAt)}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {transitions.length > 0 ? (
        <View style={styles.actions}>
          {transitions.map((t) => (
            <PillButton
              key={t.to}
              label={t.label}
              tone={t.primary ? 'filled' : 'ghost'}
              onPress={() => onTransition(order.checkout_id, t.to, t.label)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radius.lg,
    marginBottom: space.lg,
    padding: space.lg,
  },
  ground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  row: { flexDirection: 'row' },
  thumb: { width: space['8xl'] * 2, height: space['8xl'] * 2, borderRadius: radius.md },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, marginLeft: space.lg, gap: space.xxs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ref: { flex: 1, minWidth: 0 },
  title: { minWidth: 0, marginBottom: space.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xxs },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
});
