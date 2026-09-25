/**
 * `SegmentedControl` — a filled track with one raised selected segment.
 *
 * KIT GAP, filled here rather than inlined in the screen that needed it. The
 * kit already had `Tabs`, but that is an UNDERLINE tab set: a label with a 2pt
 * accent rule beneath it, for switching what a section shows (6a Selling /
 * Buying, 6d All / Active / Paused). Auth needs the other device — two equal,
 * mutually exclusive destinations shown as a track with a raised thumb — and
 * the difference is not cosmetic: an underline says "this list, filtered", a
 * segmented track says "this form, or that one". Forcing auth through `Tabs`
 * would have read as a filter over a single form.
 *
 * ── Three things that are deliberate ──
 *
 * 1. **The thumb is a background on the selected segment, not an absolutely
 *    positioned sliding view.** The design slides a `w-[calc(50%-4px)]`
 *    indicator; in RN that needs a measured width and an animation, and both
 *    fail quietly (a zero-width thumb during the first layout pass reads as no
 *    selection at all). `Tabs` already documents the same class of bug the
 *    other way round — a border that measured but never painted. A background
 *    on the segment itself cannot be half-applied.
 *
 * 2. **The thumb colour forks by scheme, and it has to.** In light the track
 *    is `fill` and the thumb is `base` — the thumb is LIGHTER than its track.
 *    In dark, `base` (#08150F) is the darkest colour in the palette, so the
 *    same token would paint a hole rather than a raised chip. Dark uses
 *    `fillStrong`, which is the one step lighter than `fill`. The rule is
 *    "the thumb is one step toward the foreground", and that is a different
 *    token at each end.
 *
 * 2b. **AND THAT FORK IS NOT ENOUGH — the thumb needs an OUTLINE.** Measured
 *    after the first build: `base` on `fill` is **1.14:1** in light and
 *    `fillStrong` on `fill` is **1.10:1** in dark, against the 3:1 that
 *    WCAG 1.4.11 asks of a control boundary. The chip was not a shape; the
 *    selection was carried entirely by the label going from `bodyMedium`
 *    /`inkMuted` to `bodySemi`/`ink`. The Stitch drawing separated it with a
 *    `shadow-sm`, and this design language has no shadows.
 *
 *    So: a 1pt `accentInk` border on the selected segment — 6.32:1 against the
 *    track and 7.21:1 against the thumb in light, 7.13:1 and 9.66:1 in dark.
 *    `accent` was the first instinct and it FAILS dark at 2.76:1 against the
 *    track, which is the kind of thing that only shows up if you compute it.
 *    The unselected segments carry the same border in `transparent` so the
 *    row does not resize by 2pt when the selection moves.
 *
 * 3. **`Pressable` from gesture-handler, not react-native.** Same reason as
 *    `Tabs` and `Field`: RN's Pressable uses the JS responder system, which
 *    RNGH intercepts natively, so inside a pager or a portal the tap never
 *    arrives. See `features/v2/home/HomePager.tsx`.
 *
 * The whole control is `accessibilityRole="tablist"` with each segment a
 * `tab`, so a screen reader announces "Sign in, tab, 1 of 2, selected".
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
// `Pressable` from GESTURE HANDLER — see note 3 above.
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import {
  HAIRLINE_WIDTH,
  MIN_TOUCH,
  radius,
  space,
  usePressFeedback,
  useV2Colors,
  useV2Theme,
} from '@/theme/v2';

import { MaterialFill } from './Surface';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type SegmentItem<T extends string> = {
  value: T;
  label: string;
};

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  style,
  testID,
}: {
  items: readonly SegmentItem<T>[];
  value: T;
  onChange: (next: T) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useV2Colors();

  return (
    <View
      accessibilityRole="tablist"
      testID={testID}
      style={[styles.track, { backgroundColor: c.fill }, style]}
    >
      {items.map((item) => (
        <Segment
          key={item.value}
          item={item}
          selected={item.value === value}
          onPress={() => onChange(item.value)}
        />
      ))}
    </View>
  );
}

function Segment<T extends string>({
  item,
  selected,
  onPress,
}: {
  item: SegmentItem<T>;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useV2Colors();
  const { scheme } = useV2Theme();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });

  // One step toward the foreground — a different token at each end. See note 2.
  const thumbRole = scheme === 'dark' ? 'fillStrong' : 'base';

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={item.label}
      testID={`v2-segment-${item.value}`}
      style={[
        styles.segment,
        // The border is always present so the row cannot resize on selection;
        // only its colour changes. See note 2b.
        { borderColor: selected ? c.accentInk : 'transparent' },
        selected && { backgroundColor: c[thumbRole] },
        animatedStyle,
      ]}
    >
      {/*
        Material on the THUMB only. The track is a recess — the same reason
        `ProgressLine` is exempt from the ramp — and lighting a groove is what
        makes a segmented control read as two buttons instead of one switch.
      */}
      {selected ? <MaterialFill role={thumbRole} ink="ink" radius={radius.pill} /> : null}
      <Text variant={selected ? 'bodySemi' : 'bodyMedium'} color={selected ? 'ink' : 'inkMuted'}>
        {item.label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: space.xs,
    gap: space.xs,
  },
  segment: {
    flex: 1,
    // 4 + 36 + 4 clears the 44pt target without a hitSlop, which a control
    // this wide should never need.
    minHeight: MIN_TOUCH - space.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: HAIRLINE_WIDTH,
  },
});
