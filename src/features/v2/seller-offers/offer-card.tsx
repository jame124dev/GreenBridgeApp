/**
 * Adapted from the `inspection-card.tsx`/`request-card.tsx`/`seller-bid-card.tsx`
 * lineage — the fifth pull of that same thumb-left/body-right composition
 * this session. See `inspection-card.tsx` for the original Obytes provenance.
 *
 * The genuine addition here, not present on any earlier card: an ACTION ROW
 * (`PillButton` × 2, `tone="filled"`/`"ghost"`) when the offer's status has a
 * transition (`OFFER_TRANSITIONS`, `./types.ts`). Terminal statuses
 * (`sold`/`rejected`) get none — `types.ts`'s table returns an empty array,
 * which this component trusts rather than re-deriving.
 *
 * ⚠️ THE CARD ITSELF DOES NOT NAVIGATE. Every earlier card in this dashboard
 * is one tap target to a destination; this one is genuinely different — its
 * job is the two (or zero) action buttons, and giving the card ALSO an
 * `onPress` to the listing would make two things tappable with two different
 * meanings inside one row, which is worse than the "duplicate control"
 * pattern flagged elsewhere (there, two controls did the SAME thing; here
 * they would do DIFFERENT things and neither would be obviously primary).
 * A future "view offer detail" affordance belongs on its own explicit
 * control, not layered onto the whole card.
 */
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Chip, MaterialFill, PillButton, Text } from '@/features/v2/ui';
import { radius, space, useV2Colors } from '@/theme/v2';

import {
  OFFER_TRANSITIONS,
  money,
  offerStatusLabel,
  offerTone,
  type OfferStatus,
  type SellerOfferItem,
} from './types';

export function OfferCard({
  offer,
  onTransition,
}: {
  offer: SellerOfferItem;
  /** Called with the TARGET status after the confirm sheet is accepted. */
  onTransition: (offerId: number, to: OfferStatus, label: string) => void;
}) {
  const c = useV2Colors();
  const [failed, setFailed] = useState(false);

  const first = offer.batch?.products?.[0];
  const cover = first?.image1;
  const showImage = Boolean(cover) && !failed;
  const transitions = OFFER_TRANSITIONS[offer.status] ?? [];

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
              Offer #{offer.offer_id}
            </Text>
            <Chip label={offerStatusLabel(offer.status)} tone={offerTone(offer.status)} />
          </View>

          <Text variant="rowTitle" numberOfLines={2} style={styles.title}>
            {first?.title || `Batch #${offer.batch_id}`}
          </Text>

          {/*
            "Buyer #{id}" — the live web screen itself never resolves a name
            (`SellerOffer.tsx` reads `offer.user_id`, never `offer.buyer`).
            Matched deliberately, not just for parity: the real `buyer`
            object on this endpoint is a security hazard — see `types.ts`'s
            docblock and `Docs/v2/SECURITY-WISHLIST.md`. Nothing in this
            component ever touches it.
          */}
          <Text variant="caption" color="inkSubtle">
            Buyer #{offer.user_id}
            {'  ·  '}
            {money(offer.offer_price)}
            {offer.offer_quantity > 1 ? `  ·  ×${offer.offer_quantity}` : ''}
          </Text>

          {offer.message ? (
            <Text variant="caption" color="inkSubtle" numberOfLines={1} style={styles.message}>
              &ldquo;{offer.message}&rdquo;
            </Text>
          ) : null}
        </View>
      </View>

      {transitions.length > 0 ? (
        <View style={styles.actions}>
          {transitions.map((t) => (
            <PillButton
              key={t.to}
              label={t.label}
              tone={t.primary ? 'filled' : 'ghost'}
              onPress={() => onTransition(offer.offer_id, t.to, t.label)}
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
  message: { fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
});
