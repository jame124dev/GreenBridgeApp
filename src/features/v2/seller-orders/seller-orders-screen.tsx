/**
 * COPIED from the Obytes template and adjusted in place — the list shell only.
 *
 *   source: ui_git_repo/obytes-template/src/features/feed/feed-screen.tsx
 *   repo:   https://github.com/obytes/react-native-template-obytes
 *   licence: MIT — Copyright (c) 2021 Obytes
 *
 * Same shape as `seller-offers-screen.tsx`, including the confirm-then-
 * "mutate" flow, now on the kit's `ConfirmSheet` (`@/features/v2/ui`) — see
 * that file's docblock for why it moved into the kit and its provenance
 * (`chat/AttachSheet.tsx`, itself from the Obytes clone's
 * `components/ui/modal.tsx`).
 */
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';

import {
  ConfirmSheet,
  EmptyState,
  SectionNote,
  Text,
  useTabBarReserve,
  type ConfirmSheetRef,
} from '@/features/v2/ui';
import { GUTTER, space } from '@/theme/v2';

import { OrderCard } from './order-card';
import { SELLER_ORDER_FIXTURE } from './__fixtures__/seller-orders';
import { checkoutStatusLabel, money, type CheckoutStatus, type SellerCheckout } from './types';

type PendingTransition = { checkoutId: number; to: CheckoutStatus; label: string; order: SellerCheckout };

export function SellerOrdersScreen() {
  const bottom = useTabBarReserve({ tabBar: false });
  const sheetRef = useRef<ConfirmSheetRef>(null);

  // PHASE 1: fixture, mutated locally on confirm — see `seller-offers-screen.tsx`'s docblock.
  const [orders, setOrders] = useState<SellerCheckout[]>([...SELLER_ORDER_FIXTURE]);
  const [pending, setPending] = useState<PendingTransition | null>(null);

  const isError = false;

  const requestTransition = useCallback(
    (checkoutId: number, to: CheckoutStatus, label: string) => {
      const order = orders.find((o) => o.checkout_id === checkoutId);
      if (order) {
        setPending({ checkoutId, to, label, order });
        // Set the props THEN present — see `seller-offers-screen.tsx`'s note.
        requestAnimationFrame(() => sheetRef.current?.present());
      }
    },
    [orders],
  );

  const confirmTransition = useCallback(() => {
    if (!pending) return;
    setOrders((prev) =>
      prev.map((o) => (o.checkout_id === pending.checkoutId ? { ...o, status: pending.to } : o)),
    );
    setPending(null);
  }, [pending]);

  const renderItem = useCallback(
    ({ item }: { item: SellerCheckout }) => (
      <OrderCard order={item} onTransition={requestTransition} />
    ),
    [requestTransition],
  );

  if (isError) {
    return (
      <View style={styles.fill}>
        <SectionNote tone="danger">
          Your orders did not load. Pull to try again.
        </SectionNote>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Text variant="micro" color="inkSubtle" style={styles.count}>
        {orders.length === 1 ? '1 order' : `${orders.length} orders`}
        {'  ·  Sample data — not connected'}
      </Text>

      <FlashList
        data={orders}
        renderItem={renderItem}
        keyExtractor={(o) => String(o.checkout_id)}
        contentContainerStyle={{ paddingBottom: bottom + space['8xl'] }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            title="No orders yet"
            body="Buy Now purchases on your listings will appear here."
            actionLabel="View my listings"
            onAction={() => router.push('/v2/listings')}
          />
        }
      />

      <ConfirmSheet
        ref={sheetRef}
        title={pending ? `${pending.label}?` : ''}
        body={
          pending
            ? `${pending.label} for the ${money(Number(pending.order.total_price), pending.order.currency)} order from Buyer #${pending.order.buyer_id} on ${pending.order.batch?.products?.[0]?.title || `Batch #${pending.order.batch_id}`}. Status will change from ${checkoutStatusLabel(pending.order.status)} to ${checkoutStatusLabel(pending.to)}.`
            : ''
        }
        confirmLabel={pending?.label ?? 'Confirm'}
        onConfirm={confirmTransition}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: GUTTER },
  count: { marginTop: space.lg, marginBottom: space.lg },
});
