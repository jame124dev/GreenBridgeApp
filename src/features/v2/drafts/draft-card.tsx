/**
 * Draft card — adapted from the `seller-bid-card.tsx` lineage.
 *
 * Left thumbnail (with +N multi-item badge for bulk scans), top row with
 * draft flow label ('AI Draft' / 'Manual Draft') and age chip (or resuming
 * spinner), two-line title, and bottom stats line.
 *
 * Uses `MaterialFill` for surface depth and `usePressFeedback` for tactile
 * spring press animation.
 */
import React, { useState } from 'react';
// `Pressable` from REACT-NATIVE, not gesture-handler — the RNGH one does not
// apply this card's `borderRadius` + `overflow: 'hidden'` to its native view on
// Android, so the card drew square around a rounded ground. Measured on device
// 2026-09-25; see the full note in `features/v2/ui/ListCard.tsx`.
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Chip, MaterialFill, Text } from '@/features/v2/ui';
import { radius, space, usePressFeedback, useV2Colors } from '@/theme/v2';
import { compactAgo, draftTitle, photoUri, plural } from '@/features/v2/listings/presentation';
import type { DraftSummary } from '@/services/drafts/draftApi';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function DraftCard({
  draft,
  isResuming,
  onPress,
}: {
  draft: DraftSummary;
  isResuming?: boolean;
  onPress: () => void;
}) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();
  const [failed, setFailed] = useState(false);

  const cover = photoUri(draft.thumbnail_object);
  const showImage = Boolean(cover) && !failed;
  const count = Number(draft.product_count) || 0;
  const extra = Math.max(0, count - 1);

  const ago = compactAgo(draft.updated_at);
  const title = draftTitle(draft);
  const modeLabel = draft.flow === 'ai' ? 'AI Draft' : 'Manual Draft';
  const stats = count > 1 ? `${plural(count, 'item', 'items')}  ·  Tap to resume` : 'Tap to resume';

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isResuming}
      accessibilityRole="button"
      accessibilityLabel={ago ? `${title}. ${modeLabel}. ${ago}` : `${title}. ${modeLabel}`}
      style={[styles.card, { borderColor: c.hairlineStrong }, animatedStyle]}
      testID={`v2-drafts-${draft.id}`}
    >
      <View style={[styles.ground, { backgroundColor: c.surface }]}>
        <MaterialFill role="surface" ink="ink" radius={radius.lg} />
      </View>

      <View>
        <View style={styles.thumbClip}>
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
        </View>
        {extra > 0 ? (
          // flat: a count badge, 20pt — too small to carry a ramp.
          <View style={[styles.badge, { backgroundColor: c.accent }]}>
            <Text variant="micro" color="onAccent">
              +{extra}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text variant="caption" color="inkSubtle" style={styles.ref} numberOfLines={1}>
            {modeLabel}
          </Text>
          {isResuming ? (
            <ActivityIndicator size="small" color={c.accent} />
          ) : ago ? (
            <Chip label={ago} tone="accent" />
          ) : null}
        </View>

        <Text variant="rowTitle" numberOfLines={2} style={styles.title}>
          {title}
        </Text>

        <Text variant="caption" color="inkSubtle" numberOfLines={1}>
          {stats}
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
  ground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /*
    The radii live on a wrapper `View`, not on the `<Image>`: Android drops
    per-corner radii on an Image (measured 2026-09-25 — a uniform `borderRadius`
    rounded all four corners while the per-corner pair rounded none). A View
    clips its children, so they work here. See `ListCard.tsx` for the test.
  */
  thumbClip: {
    width: space['8xl'] * 3,
    height: space['8xl'] * 3,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: '100%' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: space.xs,
    right: space.xs,
    minWidth: space['3xl'],
    height: space['3xl'],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  body: { flex: 1, minWidth: 0, padding: space.xl, gap: space.xxs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ref: { flex: 1, minWidth: 0 },
  title: { minWidth: 0, marginBottom: space.xs },
});
