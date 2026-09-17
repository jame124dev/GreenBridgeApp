/**
 * `Tabs` — underline tabs.
 *
 * Two screens built this separately: 6a's Selling/Buying mode switch and 6d's
 * All/Active/Paused filter. They differ only in whether a rule runs the full
 * width beneath them, so that is a prop, not a second component.
 *
 * The active indicator is 2pt of `accent` under the label. Where `rule` is on,
 * the tab's `marginBottom: -HAIRLINE_WIDTH` sits that indicator ON the hairline
 * rather than 1pt above it — without it the indicator floats and the rule
 * shows through underneath.
 *
 * ⚠️ IT IS A `<View>`, NOT A `borderBottom`, AND THAT IS NOT A STYLE CHOICE.
 *
 * It was `borderBottomWidth: 2` on this `AnimatedPressable` with the colour
 * passed in the style array. On device the WIDTH applied and the COLOUR never
 * painted: 6a's active tab measured 28.2dp tall (label 19.2 + padding 6 + the
 * 2pt border) while every pixel under the label sampled `wash` #EDF6F1 — no
 * accent anywhere in rows 375-412 of the screenshot. So Selling/Buying rendered
 * with NO active indicator at all, and the mode switch read as a heading
 * followed by a greyed-out word rather than as a tab set.
 *
 * Border painting on an `Animated.createAnimatedComponent(RNGH Pressable)` is
 * the thing that failed; a background-filled child View is not subject to it.
 * Every gate was green throughout — tsc, v2Adherence and v2Contrast all pass on
 * the broken version, because the token was correct and only the paint was
 * missing. Pin it with a pixel check, not a style assertion.
 *
 * Counts belong IN the label ("Active 3"), not in a separate badge: the count
 * is part of what the tab is, and a badge would be a second thing to align.
 */
import React from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native. RN's Pressable uses the
// JS responder system, which RNGH intercepts natively — inside Home's pager it
// never receives the tap. See the note in `features/v2/home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import {
  GUTTER,
  HAIRLINE_WIDTH,
  space,
  usePressFeedback,
  useV2Colors,
} from '@/theme/v2';

import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type TabItem<T extends string> = {
  value: T;
  label: string;
  /** Appended to the label, e.g. `Active 3`. Omit for a mode switch. */
  count?: number;
};

/**
 * The Selling / Buying switch shared by 6a and 6b.
 *
 * These are two routes rendering one conceptual screen, so the tab row must be
 * byte-identical on both. Declared once here because a copy in each file is
 * the single thing that can drift between them without anyone noticing.
 */
export type HomeMode = 'selling' | 'buying';
export const HOME_MODE_TABS: readonly TabItem<HomeMode>[] = [
  { value: 'selling', label: 'Selling' },
  { value: 'buying', label: 'Buying' },
];

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  rule = false,
  gutter = false,
  style,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Draws a hairline across the full width beneath the tabs (6d). */
  rule?: boolean;
  /** Pads to the screen gutter. Off inside an already-padded header sheet (6a). */
  gutter?: boolean;
  /** Outer spacing. Tabs sit at different heights on 6a and 6d, so the caller owns it. */
  style?: StyleProp<ViewStyle>;
}) {
  const c = useV2Colors();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.row,
        gutter && styles.gutter,
        rule && { borderBottomWidth: HAIRLINE_WIDTH, borderBottomColor: c.hairline },
        style,
      ]}
    >
      {items.map((item) => (
        <Tab
          key={item.value}
          item={item}
          active={item.value === value}
          rule={rule}
          onPress={() => onChange(item.value)}
        />
      ))}
    </View>
  );
}

function Tab<T extends string>({
  item,
  active,
  rule,
  onPress,
}: {
  item: TabItem<T>;
  active: boolean;
  rule: boolean;
  onPress: () => void;
}) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });
  const label = item.count === undefined ? item.label : `${item.label} ${item.count}`;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      hitSlop={{ top: space['3xl'], bottom: space['3xl'], left: space.lg, right: space.lg }}
      style={[styles.tab, rule && { marginBottom: -HAIRLINE_WIDTH }, animatedStyle]}
    >
      <Text variant={active ? 'bodySemi' : 'body'} color={active ? 'ink' : 'inkSubtle'}>
        {label}
      </Text>
      <View style={[styles.indicator, { backgroundColor: active ? c.accent : 'transparent' }]} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space['5xl'] },
  gutter: { paddingHorizontal: GUTTER },
  tab: { alignItems: 'stretch' },
  /** The active indicator. A VIEW, not a border — see the note at the top. */
  indicator: { height: space.xxs, marginTop: space.sm },
});
