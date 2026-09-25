/**
 * COPIED from the Obytes template and adjusted in place.
 *
 *   source: ui_git_repo/obytes-template/src/features/feed/components/post-card.tsx
 *   repo:   https://github.com/obytes/react-native-template-obytes
 *   licence: MIT — Copyright (c) 2021 Obytes
 *
 * Third time from this file (after `bids/bid-card.tsx` and
 * `watchlist/watch-tile.tsx`), and the first time the LAYOUT genuinely
 * differs: those two put the image above the text, this one puts it beside.
 *
 * | Theirs | Ours | Why |
 * |---|---|---|
 * | image on top, `h-56` | image at the LEFT, square, `space['8xl']*3` | the web card is `flex` with a `w-28 h-28` thumbnail beside the text (`MyInspections.tsx:220-235`) — an inspection is read as a diary entry, and the dates matter more than the photograph |
 * | a random Unsplash image | `products[0].images[0]`, with a placeholder | theirs is demo data |
 * | `title` + 3-line `body` | batch ref + status chip + title + two dates | what the screen is for: when is the visit, and did it happen |
 * | `className="..."` | `StyleSheet` + tokens | NativeWind fails `v2Adherence` |
 * | RN `Pressable` | RNGH `Pressable` + `usePressFeedback` | RN's is intercepted inside a pager |
 * | `<Link href={`/feed/${id}`}>` | `router.push(routes.v2ListingDetail(...))` | a copied `<Link>` does not compile here — see the note on `onPress` below |
 *
 * ── WHAT THE WEB DOES THAT WE DO NOT ──
 *
 * **The `border-l-4` status stripe** (`:212`). A 4px coloured left edge is a
 * desktop table idiom; at 423dp it reads as a rendering artefact next to a
 * thumbnail, and the status is already carried by the chip. Dropped.
 *
 * **The nested "Items in this batch" product grid** (`:285+`). That is a
 * second list inside every row, which is a disclosure on a phone, not a
 * default. The count goes on the meta line instead ("3 items"); expanding is a
 * later decision, not a silent omission.
 *
 * **The "View Batch" button.** A button inside a row that is itself tappable
 * gives two targets for one destination — `UX_DESIGN_RULES.md` calls that a
 * duplicate control. The whole card navigates.
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

import {
  inspectionDate,
  inspectionStatusLabel,
  inspectionTone,
  type InspectionItem,
} from './types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function InspectionCard(item: InspectionItem) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();

  /** A dead URL renders an empty box with no error — see `watchlist/watch-tile.tsx`. */
  const [failed, setFailed] = useState(false);

  const first = item.products?.[0];
  const cover = first?.images?.[0];
  const showImage = Boolean(cover) && !failed;
  const count = item.products?.length ?? 0;

  const pk = Number(item.batch_id);
  const canOpen = Number.isFinite(pk) && pk > 0;

  /**
   * `router.push`, not the template's `<Link asChild>`: expo-router's `Href`
   * is a union over every route and tsc will not distribute it through a
   * conditional any more (`TS2590`). Same call as `watchlist/watch-tile.tsx`.
   */
  const onPress = canOpen ? () => router.push(routes.v2ListingDetail(pk)) : undefined;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={!canOpen}
      accessibilityRole={canOpen ? 'link' : 'none'}
      accessibilityLabel={`Inspection for batch ${item.batch_id}, ${inspectionStatusLabel(item.status)}`}
      style={[styles.card, { borderColor: c.hairlineStrong }, animatedStyle]}
    >
      {/* The card ground. The thumbnail is photography and must not be ramped. */}
      <View style={[styles.ground, { backgroundColor: c.surface }]}>
        <MaterialFill role="surface" ink="ink" radius={radius.lg} />
      </View>

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
          {/* `minWidth: 0` or a long title pushes the chip off the card. */}
          <Text variant="caption" color="inkSubtle" style={styles.batchRef}>
            Batch #{item.batch_id}
          </Text>
          <Chip label={inspectionStatusLabel(item.status)} tone={inspectionTone(item.status)} />
        </View>

        <Text variant="rowTitle" numberOfLines={2} style={styles.title}>
          {first?.title || '—'}
        </Text>

        {/*
          Two dates, LABELLED, on their own lines. The web puts them side by
          side with icons; at this width that truncates to "Site Visit: 31/1…".
          The labels stay because "31/12/2026 · 04/11/2026" is two numbers and
          no meaning — which of them you have to turn up for is the whole point
          of this screen.
        */}
        <Text variant="caption" color="inkSubtle">
          Site visit{'  '}
          <Text variant="captionMedium" color="ink">
            {inspectionDate(item.inspection_date)}
          </Text>
        </Text>
        <Text variant="caption" color="inkSubtle">
          Registered {inspectionDate(item.registered_date)}
          {count > 0 ? `  ·  ${count} item${count === 1 ? '' : 's'}` : ''}
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
  /** Absolutely filled so the ramp sits UNDER the thumbnail, never over it. */
  ground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /**
   * Square, and the left radius is repeated here on purpose: on Android the
   * parent's `overflow: 'hidden'` does not clip a child `<Image>`, so the
   * corners render square inside the rounded card (measured on the watchlist,
   * 2026-09-23 — 3px into the corner instead of ~16px).
   */
  thumb: {
    width: space['8xl'] * 3,
    height: space['8xl'] * 3,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, padding: space.xl, gap: space.xxs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  batchRef: { flex: 1, minWidth: 0 },
  title: { minWidth: 0, marginBottom: space.xs },
});
