/**
 * `GroupCoverStrip` — every detected group as ONE uniform mosaic tile, in a
 * single horizontal row.
 *
 *     ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌──
 *     │ ▦1 │ │ ▦2 │ │ ▦3 │ │ ▦4 │ │ ▦
 *     └────┘ └────┘ └────┘ └────┘ └──
 *
 * ── WHAT THIS REPLACES, AND WHY ───────────────────────────────────────────
 *
 * `DetectionGroupCard` rendered one ROW per group — a `#N` label plus a
 * horizontal scroller of 56pt thumbs — stacked vertically inside the radio
 * card. On the 10-group scan the seller screenshotted, that is ten labelled
 * rows of ragged, differently-shaped thumbnails: the card grew until the
 * option it was describing had scrolled off the top, the two options stopped
 * being comparable side by side, and the tile sizes never lined up because
 * each row's scroller was independent.
 *
 * The fix is to change what one tile MEANS. A tile is no longer a photo, it is
 * a GROUP — `GroupMosaic` composes the group's photos into one square — so the
 * preview is one row of N identical squares whatever N is. Height stops
 * depending on the data, the squares are directly comparable, and "10 separate
 * listings" is legible in one glance instead of ten.
 *
 * Detail per group is one tap away on step 1, which is the screen whose job
 * that is. This is a sanity check, not a review.
 */
import { ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/features/v2/ui';
import { GUTTER, radius, space, useV2Colors } from '@/theme/v2';
import type { Photo } from '@/stores/scanDraftStore';

import { GroupMosaic } from './group-mosaic';

/** Square edge of one group tile. Four-and-a-bit fit across a phone. */
const TILE = 76;

export function GroupCoverStrip({ groups }: { groups: Photo[][] }) {
  const c = useV2Colors();
  if (groups.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      /*
        The padding is the card's — the strip is rendered into a slot that has
        already cancelled the card's own padding with a negative margin, so
        that the row bleeds to the card edge and the last tile is visibly cut
        rather than ending in dead space. Without the bleed nothing says the
        row continues.
      */
      contentContainerStyle={styles.content}
    >
      {groups.map((photos, i) => (
        <View key={`g-${i}`} style={styles.item}>
          <GroupMosaic uris={photos.map((p) => p.uri)} size={TILE} />
          <View style={styles.caption}>
            {/* flat: an 18pt counter. */}
            <View style={[styles.badge, { backgroundColor: c.accent }]}>
              <Text variant="micro" color="onAccent">
                {i + 1}
              </Text>
            </View>
            <Text variant="micro" color="inkMuted">
              {photos.length}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: space.md, gap: space.sm },
  item: { width: TILE, gap: space.xxs },
  caption: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  badge: {
    minWidth: 18,
    height: 18,
    // `sm` (6), so a two-digit group number still has air inside the pill.
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
