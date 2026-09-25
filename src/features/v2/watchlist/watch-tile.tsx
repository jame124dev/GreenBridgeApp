/**
 * COPIED from the Obytes template and adjusted in place.
 *
 *   source: ui_git_repo/obytes-template/src/features/feed/components/post-card.tsx
 *   repo:   https://github.com/obytes/react-native-template-obytes
 *   licence: MIT — Copyright (c) 2021 Obytes
 *
 * The same file `bids/bid-card.tsx` came from, taken a second time rather than
 * forked from our copy: the two cards diverge (a bid row is full-width and
 * money-led, a watch tile is half-width and image-led), and starting from the
 * template again keeps both diffs readable against one origin.
 *
 * Their shape, kept: `<Link asChild><Pressable>` wrapping an image above a
 * text block in a rounded, bordered card.
 *
 * | Theirs | Ours | Why |
 * |---|---|---|
 * | `className="m-2 rounded-xl border …"` | `StyleSheet` + `radius`/`space`/`c.*` | NativeWind classes fail `v2Adherence`, and `bg-white` has no dark answer |
 * | a random Unsplash image per render | `image` from the row, with a placeholder | theirs is demo data; ours must survive a null and a dead URL |
 * | `h-56` (224dp), full width | 4:3, half width | the web card is `aspect-[4/3]` and a 2-up grid; 224dp tiles would show one and a half items per screen |
 * | `title` 2xl + `body` 3 lines | title 2 lines + category | a watchlist answers "what am I keeping an eye on", so identity is the whole content — there is no body on this record |
 * | `<Link href={`/feed/${id}`}>` | `routes.v2ListingDetail(id)` | our typed route |
 * | RN `Pressable` | RNGH `Pressable` + `usePressFeedback` | RN's is intercepted inside a pager, and the press state must animate like the rest of the app |
 *
 * ⚠️ THE DESTINATION IS UNVERIFIED. `/v2/listing/[id]` fetches
 * `/batch/:batchPk/products`, and this tile passes `batch_id` from the
 * wishlist row. Two independent places say those are the same identifier —
 * the web's own `listingUrl.ts` header (":id = batchId → still drives the data
 * fetch") and our fetcher taking a batch pk against the same backend — but
 * neither is the server agreeing, and that needs a login we do not have.
 * Wiring it anyway is safe because the destination degrades properly: an
 * unparseable or unknown id renders a `SectionNote`, not a white screen
 * (`app/v2/listing/[id].tsx:132-151`). Prove it in phase 2.
 */
import React, { useState } from 'react';
// `Pressable` from REACT-NATIVE, not gesture-handler — the RNGH one does not
// apply this tile's `borderRadius` + `overflow: 'hidden'` on Android. See the
// measured A/B in `features/v2/ui/ListCard.tsx`.
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';

import { MaterialFill, Text } from '@/features/v2/ui';
import { radius, space, usePressFeedback, useV2Colors } from '@/theme/v2';
import { routes } from '@/lib/routes';

import type { WishCard } from './types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function WatchTile({ card }: { card: WishCard }) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();

  /**
   * A dead image URL renders an EMPTY BOX in React Native — no error, no
   * event, nothing on screen to explain it. Found on the bids screen, where a
   * fixture URL produced a grey rectangle that read as a layout bug. A failed
   * load falls back to the same placeholder a missing image gets.
   */
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(card.image) && !failed;

  /** `Number()` here, not at the call site: an unparseable id must not navigate. */
  const pk = Number(card.id);
  const canOpen = Number.isFinite(pk) && pk > 0;

  /**
   * ⚠️ `router.push` IN AN `onPress`, NOT THE TEMPLATE'S `<Link asChild>`.
   *
   * Their version wraps the card in `<Link href={...} asChild>`. Ported
   * literally it fails to compile: `TS2590: Expression produces a union type
   * that is too complex to represent`. Expo-router's `Href` is a union over
   * every route in the app, and this app has grown past the point where tsc
   * will distribute it through a conditional (the same error reached
   * `src/lib/scanResume.ts` on 2026-09-23 from an unrelated direction).
   *
   * Annotating `Href | null` moves the error rather than fixing it — it then
   * fails inside the JSX instead. `router.push` takes the value without the
   * generic, so the union is never built. `accessibilityRole="link"` keeps
   * the semantics `<Link>` was providing.
   */
  const onPress = canOpen ? () => router.push(routes.v2ListingDetail(pk)) : undefined;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole={canOpen ? 'link' : 'image'}
      accessibilityLabel={card.title || 'Saved item'}
      /**
       * No `onPress` when the id cannot open anything — not a handler that
       * does nothing. A control that looks live and is not is the failure
       * mode this codebase keeps rediscovering.
       */
      disabled={!canOpen}
      style={[styles.card, { borderColor: c.hairlineStrong }, animatedStyle]}
    >
      {showImage ? (
        <Image
          style={styles.cover}
          resizeMode="cover"
          source={{ uri: card.image as string }}
          onError={() => setFailed(true)}
        />
      ) : (
        // flat: a placeholder where a photograph would be, not a control.
        <View style={[styles.cover, styles.coverEmpty, { backgroundColor: c.fill }]}>
          <Text variant="caption" color="inkSubtle">
            No photo
          </Text>
        </View>
      )}

      {/*
        The ramp goes on the TEXT BLOCK, not on the card. `MaterialFill` is
        absolutely filled, so wrapping the whole tile would run a gradient
        over the photograph — the case `Row.tsx:248` calls out ("A photograph
        is not a surface"). The body is the only palette ground here, so it is
        the only thing that ramps.
      */}
      <View style={[styles.body, { backgroundColor: c.surface }]}>
        <MaterialFill role="surface" ink="ink" radius={0} />
        {/* `minWidth: 0` or a 90-character title pushes the tile out of its column. */}
        <Text variant="rowTitle" numberOfLines={2} style={styles.title}>
          {card.title || 'Untitled item'}
        </Text>
        {card.category ? (
          <Text variant="caption" color="inkSubtle" numberOfLines={1}>
            {card.category}
          </Text>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radius.lg,
    /**
     * The grid's gutters live HERE, not on the list. `FlashList` has no
     * column-gap prop, and padding on the content container insets the whole
     * grid instead of separating its two columns. So each tile carries half a
     * gap on each side and the screen subtracts that from its own padding —
     * `GUTTER - space.sm` outside, `space.sm * 2` between. Change one and the
     * other stops adding up to `GUTTER`.
     */
    marginHorizontal: space.sm,
    marginBottom: space.lg,
  },
  /**
   * The web's `aspect-[4/3]`, kept — it is the shape these photographs are
   * cropped to.
   *
   * ⚠️ THE TOP RADIUS IS REPEATED HERE AND THAT IS NOT REDUNDANT. The card
   * already has `borderRadius: radius.lg` and `overflow: 'hidden'`, which is
   * enough on iOS and is NOT enough on Android: the parent's clip does not
   * apply to a child `<Image>`, so the photograph rendered with square top
   * corners inside a rounded card. It looks like a 2px detail and reads as
   * unfinished at a glance.
   *
   * Caught by sampling the corner, not by looking — the first image pixel was
   * 3px along the diagonal from the card's corner, where a 22dp radius should
   * keep it clear for ~16px (`0.293 × 22dp × 1080/423`). Re-measure that way
   * if this style is ever touched; at phone scale the eye cannot call it.
   */
  cover: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.md, gap: space.xxs },
  title: { minWidth: 0 },
});
