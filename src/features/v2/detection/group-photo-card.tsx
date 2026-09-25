/**
 * COPIED from our own `src/features/v2/bids/bid-card.tsx` and adjusted in place.
 *
 *   source: src/features/v2/bids/bid-card.tsx  (level 1 — already in this codebase)
 *   which was itself COPIED from:
 *   source: ui_git_repo/obytes-template/src/features/feed/components/post-card.tsx
 *   repo:   https://github.com/obytes/react-native-template-obytes
 *   licence: MIT — Copyright (c) 2021 Obytes
 *
 * ── WHY THIS FILE EXISTS (UI_SOURCING_RULES.md) ────────────────────────────
 *
 * The first version of this card was HAND-BUILT from `SoftPanel` + `Chip` +
 * `Text` with no search run at any level. It kept a 64pt thumbnail in a
 * full-width row — about 75% empty — which is the emptiness it was written to
 * fix. This is the same card done by the rule.
 *
 * Search actually run this time:
 *   L1  `bids/bid-card.tsx` — ANSWERED. A media-across-the-top card, already on
 *       v2 tokens, already carrying the dead-URL lesson. Taken.
 *   L2  the v2 kit — primitives only. A kit of primitives is not a layout.
 *   L3  web — `react-native-photo-browser`, `react-native-thumbnail-grid`
 *       (MIT, confirmed in its package.json), and the RN image pickers. All
 *       are for CHOOSING images; this screen's photos already exist and need
 *       moving and removing. Its split-ratio grid is also more than a wrap of
 *       1–5 thumbs needs, and the global rule says copy the piece rather than
 *       take a dependency for it. Not used — recorded so the next person does
 *       not repeat the search.
 *
 * Their shape, kept: one bordered, rounded, `overflow: 'hidden'` card; media
 * spanning the full width across the top; a padded text block beneath. That
 * shape is the whole point of the copy — it is what fills the card.
 *
 * | Theirs (bid-card) | Ours | Why |
 * |---|---|---|
 * | one `cover` image | a horizontal strip of full-height tiles | a bid has one machine; a detection GROUP has 1..N photos and the seller must see all of them to judge the grouping |
 * | cover is inert | each tile is pressable, with a × badge | this screen's whole job is moving a photo to another group and dropping a bad one |
 * | `height: space['8xl'] * 3` (102dp) | same | a checking format, not a browsing one — the reasoning in their comment holds here |
 * | money line + meta line | chips (category · condition) + price + photo count | what answers "did the AI understand this group?" |
 * | `+N more` in the meta | the count line under the chips | the strip scrolls, so it cannot show its own length |
 * | no leading element | an index badge in the title row | groups are referred to by number by the move-photo sheet |
 * | not pressable | still not pressable as a whole | the tiles and the rename glyph are the controls; a whole-card press has no destination |
 */
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native — RN's is intercepted by
// RNGH and the tap never lands. Kept from the kit's convention.
import { Pressable } from 'react-native-gesture-handler';
import { Edit3, X } from 'lucide-react-native';

import { Chip, GlyphButton, QuietAction, Text } from '@/features/v2/ui';
import { icon, MIN_TOUCH, radius, space, useV2Colors } from '@/theme/v2';
import type { Photo } from '@/stores/scanDraftStore';

/*
 * ⚠️ NOT `DetectionGroupCard` — that name is taken by
 * `@/components/scanner/DetectionGroupCard`, the single-vs-grouped MODE PICKER
 * on step 2 of this same screen. Two components called the same thing, one file
 * apart, in one screen, is a trap for whoever edits next.
 */
export type GroupPhotoCardProps = {
  index: number;
  /**
   * Total group count. The badge stays a bare number — "3 of 37" in a 24pt
   * disc is unreadable — but the spoken label says the position, which is the
   * only way a screen-reader user knows how far down a long scan they are.
   */
  total?: number;
  title: string;
  /** brand · model · year, already joined. Empty string when the AI gave none. */
  subtitle: string;
  /** Category and condition, already resolved to display strings. */
  metaChips: string[];
  /** Formatted estimate, e.g. `$1,200`. Omitted when there is none. */
  priceText?: string;
  /** The group's photos, in order. */
  photos: Photo[];
  /** Count line under the chips — photos, and documents when there are any. */
  countLabel: string;
  /** No AI title ⇒ the rename control becomes a labelled prompt. */
  unnamed: boolean;
  identifyLabel: string;
  renameLabel: string;
  movePhotoLabel: string;
  removePhotoLabel: string;
  onIdentify: () => void;
  onTapPhoto: (imageIdx: number) => void;
  onDeletePhoto: (imageIdx: number) => void;
  /** Global indexes into the source photo array, parallel to `photos`. */
  imageIndexes: number[];
};

export function GroupPhotoCard({
  index,
  total,
  title,
  subtitle,
  metaChips,
  priceText,
  photos,
  countLabel,
  unnamed,
  identifyLabel,
  renameLabel,
  movePhotoLabel,
  removePhotoLabel,
  onIdentify,
  onTapPhoto,
  onDeletePhoto,
  imageIndexes,
}: GroupPhotoCardProps) {
  const c = useV2Colors();

  /**
   * ⚠️ A URL IS NOT A PICTURE — inherited from bid-card and it applies harder
   * here. These are local `file://` captures, which go stale when the OS clears
   * its cache, and a failed load rendered a silent grey hole where the machine
   * should be. Tracked per tile, not per card: one bad photo must not blank the
   * others.
   */
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  /*
    ── HOW WIDE A TILE IS, AND WHY IT IS NOT A CONSTANT ──────────────────────

    `post-card`'s media is `width: '100%'` — a cover. Copying it as a fixed
    132pt tile is what left this card looking empty: one photo filled about a
    third of the band and the rest was blank surface, which is the exact
    complaint the rebuild was for.

    So the tile adapts to how many photos the group actually has:

      1 photo   → the full card width. A cover, as copied.
      2 photos  → half each, so both are visible with no scrolling.
      3+        → 60% of the card, which leaves the next tile half-showing.
                  That sliver IS the affordance: `showsHorizontalScrollIndicator`
                  is off, so without it nothing says the strip continues.

    Measured against the card's inner width, taken from `onLayout` rather than
    assumed — the card sits inside a gutter this component does not own, and a
    hardcoded 375 would silently stop being right if the gutter changed.
  */
  const [cardW, setCardW] = useState(0);
  const tileWidth =
    cardW <= 0 ? undefined : photos.length === 1 ? cardW : photos.length === 2 ? cardW / 2 : cardW * 0.6;

  /*
    ⚠️ THE CHIPS ARE INVISIBLE TO SCREEN READERS. `Chip` sets
    `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`
    (Chip.tsx:49-50), and its own docblock says: when the chip is the only place
    a value appears, pass that value into the PARENT's `accessibilityLabel`.

    On this card the chips carry the category, the condition and the price —
    the three fields this card exists to show — so without this the one user who
    most needs them read aloud is told none of them. The label is assembled in
    the order a person would say it.
  */
  const a11yLabel = [
    total && total > 1 ? `${index + 1} of ${total}.` : `${index + 1}.`,
    title,
    subtitle || null,
    metaChips.length ? metaChips.join(', ') : null,
    priceText ? `estimated ${priceText}` : null,
    countLabel,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    // flat: a content card, not a control — the tiles and the glyph are the controls.
    <View
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairlineStrong }]}
      onLayout={(e) => setCardW(e.nativeEvent.layout.width)}
    >
      {/*
        MEDIA ACROSS THE TOP — the copied shape, widened from one cover to the
        group's whole strip. Tiles are the card's full height rather than 64pt
        thumbs floating in a row, which is what left three quarters of the old
        card empty.
      */}
      {photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {photos.map((photo, i) => {
            const imageIdx = imageIndexes[i];
            const dead = failed[imageIdx];
            return (
              <View key={`img-${imageIdx}`} style={[styles.tile, { width: tileWidth }]}>
                <Pressable
                  onPress={() => onTapPhoto(imageIdx)}
                  accessibilityRole="button"
                  /*
                    ⚠️ EVERY TILE USED TO ANNOUNCE THE SAME SENTENCE. Five
                    photos across two groups gave ten identical "Move this
                    photo to another group" nodes with no way to tell which
                    photo or which product. The position and the product name
                    make each one addressable.
                  */
                  accessibilityLabel={`${movePhotoLabel}. ${i + 1} of ${photos.length}, ${title}`}
                  // P4 — office-doc origin is exposed to screen readers only;
                  // a tile has no room for a visible caption.
                  accessibilityHint={photo.sourceLabel}
                  style={styles.tilePress}
                >
                  {dead ? (
                    // flat: a placeholder where a photograph would be.
                    <View style={[styles.tileFill, { backgroundColor: c.fill }]}>
                      <Text variant="caption" color="inkSubtle">
                        No photo
                      </Text>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.tileFill}
                      resizeMode="cover"
                      onError={() => setFailed((p) => ({ ...p, [imageIdx]: true }))}
                    />
                  )}
                </Pressable>

                {/*
                  `scrim` / `onScrim` are the palette's roles for a control laid
                  over imagery. The badge was `#111827` on `#FFFFFF`, which
                  stayed dark-on-white in dark mode with the ring glowing.
                */}
                {/*
                  ⚠️ THE × WAS 22pt SITTING ON THE MOVE TARGET WITH NO GAP.
                  Its `hitSlop={12}` extended past the tile, and the card is
                  `overflow: 'hidden'`, so Android clipped it — the real target
                  was ~40pt, under both 44 and 48, and it covered roughly 30%
                  of the photo it shared. A thumb aiming at the top-right of a
                  photo to MOVE it deleted it instead (and, on a one-photo
                  group, deleted the product).

                  Now a full `MIN_TOUCH` control, inset so its whole target is
                  inside the tile, on an OPAQUE ground: `scrim` is
                  `rgba(6,28,20,0.34)`, which over a bright lab photo composites
                  to roughly 2.2:1 against white — under the 3:1 WCAG 1.4.11
                  asks of a control boundary. `scrimDeep` does not depend on
                  what is behind it.
                */}
                <Pressable
                  onPress={() => onDeletePhoto(imageIdx)}
                  accessibilityRole="button"
                  accessibilityLabel={`${removePhotoLabel}. ${i + 1} of ${photos.length}, ${title}`}
                  // flat: a scrim over a photograph, not a surface — a ramp here
                  // would gradient across the image (Row.tsx:248).
                  style={[styles.remove, { backgroundColor: c.scrimDeep, borderColor: c.onScrim }]}
                >
                  <X color={c.onScrim} size={14} strokeWidth={3} />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      {/*
        One accessible node for the whole summary, so the category, condition
        and price the chips hide are actually spoken. The chips, title and count
        stay visible; only the grouping changes for assistive tech.
      */}
      <View style={styles.body} accessible accessibilityLabel={a11yLabel}>
        <View style={styles.titleRow}>
          {/* flat: a 22pt counter, far below the size at which a ramp reads. */}
          <View style={[styles.indexBadge, { backgroundColor: c.accent }]}>
            <Text variant="micro" color="onAccent">
              {index + 1}
            </Text>
          </View>
          {/* `minWidth: 0` or a 90-character AI title never truncates and
              pushes the rename control off the row. */}
          <View style={styles.title}>
            <Text variant="rowTitle" color={unnamed ? 'inkMuted' : 'ink'} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="caption" color="inkMuted" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {/* `Chip` is display-only — it has no `onPress` — so the prompt is a
              `QuietAction`, which also gives it a real 44pt target. */}
          {unnamed ? (
            <QuietAction label={identifyLabel} onPress={onIdentify} tone="accent" />
          ) : (
            <GlyphButton onPress={onIdentify} accessibilityLabel={renameLabel}>
              <Edit3 color={c.inkMuted} size={icon.md} strokeWidth={1.8} />
            </GlyphButton>
          )}
        </View>

        {metaChips.length > 0 || priceText ? (
          <View style={styles.metaRow}>
            <View style={styles.metaChips}>
              {metaChips.map((label) => (
                <Chip key={label} label={label} tone="neutral" />
              ))}
            </View>
            {priceText ? <Chip label={priceText} tone="accent" /> : null}
          </View>
        ) : null}

        <Text variant="caption" color="inkSubtle">
          {countLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Their `m-2 rounded-xl border overflow-hidden`, on our scale. */
  card: {
    marginBottom: space['3xl'],
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  /**
   * ⚠️ TILE WIDTH IS SET AT THE CALL SITE, NOT HERE.
   *
   * A fixed 132pt tile was the whole reason this card still read as empty. On a
   * ONE-photo group — a typical detection result, and every card in the device
   * shot — 132pt of a ~375pt card left roughly two thirds of the media band
   * blank. `post-card`'s cover spans the FULL width; narrowing it broke the one
   * property the card was copied for. See `tileWidth` in the component.
   */
  strip: { gap: space.xxs },
  tile: { height: space['8xl'] * 3 },
  tilePress: { flex: 1 },
  tileFill: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  remove: {
    position: 'absolute',
    /*
      INSIDE the tile, and a full MIN_TOUCH box. It was 22pt at `top/right: -6`
      with `hitSlop={12}` — the slop spilled past a parent with
      `overflow: 'hidden'`, which Android clips, so the real target was ~40pt
      and it sat on ~30% of the move surface with no gap.
    */
    top: space.sm,
    right: space.sm,
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  /** Their `p-2`, at our gutter. */
  body: { padding: space['4xl'], gap: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  indexBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xxs,
  },
  title: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  /** `flex: 1` + wrap so a long category pushes the price down, not off. */
  metaChips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
