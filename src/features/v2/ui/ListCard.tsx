/**
 * `ListCard` — the bordered, full-bleed-thumb card the seller dashboard
 * uses for bids/offers/orders, promoted into the kit.
 *
 * Home's Drafts and Live Listings rows shipped as plain `Row`s (matching
 * `6a.html`'s "plain rows on white, two each"), then the dashboard pages
 * built a heavier card treatment independently — thumb bleeding to the
 * card's own edge, a bordered `MaterialFill` surface, title + status chip
 * on one line. Asked to bring that same look to Home 2026-09-24: this is
 * `seller-bids/seller-bid-card.tsx`'s shape (the simplest of the three —
 * no action-button row, pure navigation card) with its bid-specific stats
 * line generalised into a plain `subtitle`, so Drafts/Listings can use it
 * without inheriting bid vocabulary.
 *
 * Not a redeclaration of `order-card.tsx`/`offer-card.tsx`/
 * `seller-bid-card.tsx`'s own `styles.card`/`styles.ground` — those three
 * already diverge (actions row, two-chip meta line, badge) enough that
 * folding them into this one generic component would cost more in props
 * than it saves. This is for the plain "thumb, title, one status chip,
 * tap to open" shape specifically; a screen needing the richer shape goes
 * back to a screen-local card like those three.
 */
import React, { useState, type ReactNode } from 'react';
/*
  ⚠️ `Pressable` FROM REACT-NATIVE, NOT FROM GESTURE-HANDLER. THIS IS THE
  CORNER BUG.

  The RNGH `Pressable` does not apply this card's own `borderRadius` +
  `overflow: 'hidden'` to its native view on Android. The card therefore drew
  as a SQUARE rectangle while the `MaterialFill` ground inside it drew rounded
  — a doubled, stepped edge around every card. On a white page that is
  invisible; in dark mode it is obvious, which is how it was finally reported.

  MEASURED on a Pixel 3a, 2026-09-25, by changing ONLY this import and
  screenshotting the same 200×170 crop of a card's right edge:
    gesture-handler → square outer rect, visible step against the rounded ground
    react-native    → one clean rounded corner, no step
  And the card still navigates (tapped it; opened Batch #5101), so the gesture
  is not lost inside Home's pager — which is presumably why RNGH was reached
  for in the first place.

  Why earlier attempts missed it: they went after the radius VALUES, the
  `elevation`/`shadow*` zeroing and the Reanimated wrapper (see the note in
  `styles.card`). All reasonable, none of them the component doing the
  clipping. The Reanimated fix removed one non-clipping wrapper and left this
  one.

  Same family as `OptionCard`'s dead press (2026-09-24): the RNGH Pressable
  behaves differently from RN's in ways that are invisible until measured.
  Take it only when the control sits inside an RNGH gesture subtree AND you
  have checked it still clips.
*/
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ImageIcon } from 'lucide-react-native';

import { GUTTER, icon, press, radius, space, useV2Colors } from '@/theme/v2';

import { MaterialFill } from './Surface';
import { Text } from './Text';

export function ListCard({
  uri,
  title,
  subtitle,
  /** Top-right of the title line — an age `Chip`, a status `Chip`, a spinner. */
  trailing,
  onPress,
  testID,
  accessibilityLabel,
}: {
  uri?: string | null;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const c = useV2Colors();
  const [failed, setFailed] = useState(false);
  const [pressed, setPressed] = useState(false);
  const showImage = Boolean(uri) && !failed;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join('. ')}
      style={[
        styles.card,
        { borderColor: c.hairlineStrong, opacity: pressed ? press.opacity : 1 },
      ]}
    >
      {/*
        `fillStrong`, not `fill` — a second fresh-eyes pass (2026-09-24) still
        read `fill` as "nearly the same near-black-green as the page" in dark
        mode. `fillStrong` is this system's next step up specifically for
        that: light #DCE7E1 vs `base` #FFFFFF and dark #243830 vs `base`
        #08150F are both roughly double `fill`'s step off the page ground.
      */}
      <View style={[styles.ground, { backgroundColor: c.fillStrong }]}>
        <MaterialFill role="fillStrong" ink="ink" radius={radius.lg} />
      </View>

      {/*
        THE CLIP LIVES ON THIS VIEW, NOT ON THE IMAGE. A `View` clips its
        children; an `<Image>` is a leaf, so `overflow: 'hidden'` on it does
        nothing to its own bitmap. See `thumbClip` for the measurement that
        settled this.
      */}
      <View style={styles.thumbClip}>
        {showImage ? (
          <Image
            style={styles.thumbFill}
            resizeMode="cover"
            source={{ uri: uri as string }}
            onError={() => setFailed(true)}
          />
        ) : (
          // Tinted, not flat grey — a plain grey box + a generic icon read as
          // a FAILED image load on the same fresh-eyes pass, not an
          // intentional "no photo yet" state. `accentWash`/`accentInk` is this
          // system's own branded-empty-state pairing (see `Chip`'s `accent`
          // tone), so this now reads as designed rather than broken.
          <View style={[styles.thumbFill, styles.thumbEmpty, { backgroundColor: c.accentWash }]}>
            <ImageIcon size={icon.md} color={c.accentInk} strokeWidth={1.6} />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text variant="rowTitle" numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          {trailing}
        </View>
        {subtitle ? (
          <Text variant="caption" color="inkSubtle" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radius.lg,
    marginBottom: space.xl,
    // `MaterialFill` never adds a shadow of its own (see its own docblock —
    // deliberately, for jank reasons), so this zeroes out whatever the OS
    // would otherwise supply. Was masking a DIFFERENT bug until 2026-09-24:
    // this card used to be wrapped in `Animated.createAnimatedComponent`
    // for press feedback, which on Android promotes a view to its own
    // hardware layer — that layer's anti-aliased rounded-corner clip
    // composited a visible double-edge/halo around the card, worst on a
    // dark ground, that `elevation`/`shadow*` zeroing alone never fixed
    // (a shadow and a layer-compositing artifact are different things).
    // Fixed at the root by dropping the Reanimated wrapper entirely — see
    // `pressed` state below, same pattern as `TintedRow`'s own fix.
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    // This kit's other elements that sit directly in Home's ungutted pane
    // body — `TintedRow`, `PromoBanner` — both self-apply this; a caller that
    // already wraps its own container in `paddingHorizontal: GUTTER` (the
    // dashboard's list screens) never puts a `ListCard` inside that padding,
    // so there is no double-gutter risk today. Missing here, this card rendered
    // edge-to-edge, off the same left/right line as everything above it on Home.
    marginHorizontal: GUTTER,
  },
  ground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // `seller-bid-card.tsx`'s own thumb size — the card this shape was built
  // from — not `order-card.tsx`'s smaller one. A fresh-eyes review flagged
  // the thumb as undersized against the card's own padding; matching the
  // card this WAS explicitly modelled on fixes that directly.
  /*
    ── WHY THE RADII ARE ON A WRAPPER AND NOT ON THE IMAGE ───────────────────

    These two radii used to live on the `<Image>` itself, next to an
    `overflow: 'hidden'` added to "force this view's own clip". Neither works
    on a leaf Image on Android:

      • `overflow: 'hidden'` clips CHILDREN. An `Image` has none, so it does
        nothing to the Image's own bitmap.
      • per-corner radii (`borderTopLeftRadius` etc.) are dropped.

    MEASURED on a Pixel 3a, 2026-09-25, by swapping the two per-corner radii
    for one uniform `borderRadius` and changing nothing else:
      per-corner  → all four corners SQUARE
      uniform     → all four corners ROUNDED
    So radius on the Image is honoured; only the per-corner form is not. That
    is why several previous attempts failed — the style block read as correct
    and the `overflow` line looked like a safety net, but nothing in it could
    ever have rounded only the left side.

    A `View` does clip its children, so the radii work here. The visible
    symptom was a white wedge poking past the card's rounded corner: the
    listing photos are shot on white, invisible on a white card in light mode
    and the brightest thing on the screen in dark mode.
  */
  thumbClip: {
    width: space['8xl'] * 3,
    height: space['8xl'] * 3,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
    overflow: 'hidden',
  },
  /** Fills `thumbClip`; carries no radius of its own — the wrapper clips it. */
  thumbFill: { width: '100%', height: '100%' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, padding: space.xl, gap: space.xxs, justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  title: { flex: 1, minWidth: 0 },
});
