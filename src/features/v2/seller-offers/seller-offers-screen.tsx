/**
 * COPIED from the Obytes template and adjusted in place — the list shell only.
 *
 *   source: ui_git_repo/obytes-template/src/features/feed/feed-screen.tsx
 *   repo:   https://github.com/obytes/react-native-template-obytes
 *   licence: MIT — Copyright (c) 2021 Obytes
 *
 * Same shape as every list on this dashboard. What's new here, not in the
 * template or any earlier screen: the confirm-then-mutate flow, now on the
 * kit's `ConfirmSheet` (`@/features/v2/ui`) rather than a screen-local copy
 * — see that file's docblock for why it moved into the kit and what it was
 * rebuilt from (`chat/AttachSheet.tsx`, itself from the Obytes clone's
 * `components/ui/modal.tsx`).
 *
 * ⚠️ PHASE 1's "MUTATION" IS A LOCAL STATE UPDATE, LABELLED AS SUCH. Tapping
 * Accept/Reject/Mark sold/Decline opens the sheet
 * (`phase-1-ui.md`: "the web's dialog — this is a sheet on mobile"); on
 * confirm, the row's status flips in this screen's own `useState`, not on a
 * server. This is deliberate, not a shortcut skipped by accident: a button
 * that does nothing at all when pressed is the "dead control" failure this
 * codebase keeps re-discovering, and simulating the transition proves the
 * whole interaction (confirm copy, sheet dismissal, the row re-rendering
 * with its new status and transitions) without touching the network — which
 * phase 1 is not supposed to do. Phase 2 deletes the local `setState` call
 * and puts the real `PATCH /offer/{id}/status` mutation in its place.
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

import { OfferCard } from './offer-card';
import { SELLER_OFFER_FIXTURE } from './__fixtures__/seller-offers';
import { money, type OfferStatus, type SellerOfferItem } from './types';

type PendingTransition = { offerId: number; to: OfferStatus; label: string; offer: SellerOfferItem };

export function SellerOffersScreen() {
  const bottom = useTabBarReserve({ tabBar: false });
  const sheetRef = useRef<ConfirmSheetRef>(null);

  // PHASE 1: fixture, mutated locally on confirm — see the docblock above.
  const [offers, setOffers] = useState<SellerOfferItem[]>([...SELLER_OFFER_FIXTURE]);
  const [pending, setPending] = useState<PendingTransition | null>(null);

  const isError = false;

  const requestTransition = useCallback(
    (offerId: number, to: OfferStatus, label: string) => {
      const offer = offers.find((o) => o.offer_id === offerId);
      if (offer) {
        setPending({ offerId, to, label, offer });
        // Set the props THEN present — `ConfirmSheet`'s content is static
        // per open, so the state update has to land before the sheet reads it.
        requestAnimationFrame(() => sheetRef.current?.present());
      }
    },
    [offers],
  );

  const confirmTransition = useCallback(() => {
    if (!pending) return;
    setOffers((prev) =>
      prev.map((o) => (o.offer_id === pending.offerId ? { ...o, status: pending.to } : o)),
    );
    setPending(null);
  }, [pending]);

  const renderItem = useCallback(
    ({ item }: { item: SellerOfferItem }) => (
      <OfferCard offer={item} onTransition={requestTransition} />
    ),
    [requestTransition],
  );

  if (isError) {
    return (
      <View style={styles.fill}>
        <SectionNote tone="danger">
          Your offers did not load. Pull to try again.
        </SectionNote>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Text variant="micro" color="inkSubtle" style={styles.count}>
        {offers.length === 1 ? '1 offer' : `${offers.length} offers`}
        {'  ·  Sample data — not connected'}
      </Text>

      <FlashList
        data={offers}
        renderItem={renderItem}
        keyExtractor={(o) => String(o.offer_id)}
        contentContainerStyle={{ paddingBottom: bottom + space['8xl'] }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            title="No offers received yet"
            body="When a buyer makes an offer on one of your listings, it will show up here."
            actionLabel="View my listings"
            onAction={() => router.push('/v2/listings')}
          />
        }
      />

      <ConfirmSheet
        ref={sheetRef}
        title={pending ? `${pending.label} this offer?` : ''}
        body={
          pending
            ? `${pending.label} the ${money(pending.offer.offer_price)} offer from Buyer #${pending.offer.user_id} on ${pending.offer.batch?.products?.[0]?.title || `Batch #${pending.offer.batch_id}`}. This cannot be undone.`
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
