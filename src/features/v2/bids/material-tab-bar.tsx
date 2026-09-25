/**
 * COPIED from react-native-collapsible-tab-view and adjusted in place.
 *
 *   source: ui_git_repo/collapsible-tabs/src/MaterialTabBar/{TabBar,TabItem,Indicator}.tsx
 *   repo:   https://github.com/PedroBern/react-native-collapsible-tab-view
 *   licence: MIT — Copyright (c) 2020 pedrobern
 *
 * Three of their files merged into one, because the split only exists there to
 * let a consumer swap `TabItemComponent`, and we have one tab bar.
 *
 * ── WHAT THEIR VERSION DOES THAT OURS DID NOT ──
 *
 * `ui/Tabs.tsx` gives each tab its own 2pt `<View>` and switches its colour on
 * `active`. The indicator therefore JUMPS between tabs. Theirs is ONE view that
 * interpolates `translateX` and `width` across the measured item layouts, so it
 * slides and resizes. That interpolation is the reason to copy this file rather
 * than add a prop to ours, and it is kept verbatim below.
 *
 * Also kept: the two-mode layout (equal-width when the set fits, measured +
 * horizontally scrollable when it does not), the per-item opacity ramp, and
 * `keepActiveTabCentered`'s auto-scroll so an off-screen tab scrolls into view.
 *
 * ── WHAT WAS ADJUSTED ──
 *
 * | Theirs | Ours | Why |
 * |---|---|---|
 * | `indexDecimal` from `Tabs.Container`'s pager | driven here from `value` | we have no pager — the tabs filter a list in place, so there is no scroll position to read. `withTiming` on the active index gives the same 0…n-1 signal the interpolation wants |
 * | `tabNames: T[]` + `tabProps: Map` | `items: TabItem<T>[]` | same shape `ui/Tabs.tsx` already takes, so this is a drop-in and callers do not learn a second API |
 * | `style={({pressed}) => …}` | `usePressFeedback()` | function-form `style` is DELETED at runtime by the NativeWind interop, and Jest cannot see it — trap 1 in the v2 skill |
 * | RN `Pressable` | RNGH `Pressable` | RN's uses the JS responder system, which RNGH intercepts natively; the same swap is documented in `ui/Tabs.tsx` |
 * | `#2196f3`, `rgba(0,0,0,1)`, `#DDDDDD` | `c.accent`, `c.ink`, `c.inkSubtle` | `v2Adherence` forbids hex, and a fixed blue is not our accent |
 * | `styles.label` / `labelStyle` | `type.bodySemi` | ditto: no raw `fontSize` |
 * | `TABBAR_HEIGHT = 48` | `MIN_TOUCH` | 44 is our documented minimum and the rest of the kit uses it |
 * | `isRTL` from their `helpers` | `I18nManager.isRTL` | one import instead of vendoring a second file for one boolean |
 * | `android_ripple` | — | `usePressFeedback` is the app's press language; a ripple here and nowhere else reads as a different app |
 *
 * ⚠️ The indicator's `left` is NOT set. It is positioned purely by the
 * interpolated `translateX`, which is relative to the content container's
 * origin — their choice, and it only works because the indicator is the LAST
 * child of the same scroll content the items lay out in. Moving it outside that
 * container makes it land at x=0 and look like a broken measurement.
 */
import React from 'react';
import {
  I18nManager,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import {
  duration,
  easing,
  MIN_TOUCH,
  space,
  timing,
  type,
  usePressFeedback,
  useV2Colors,
} from '@/theme/v2';

import type { TabItem } from '@/features/v2/ui';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Theirs, verbatim — the indicator interpolates across these. */
type ItemLayout = { x: number; width: number };

/**
 * How far a non-active label fades. Theirs is 0.7, which on our palette makes
 * an inactive tab read as disabled rather than as unselected; the colour ramp
 * from `ink` to `inkSubtle` is already carrying that job.
 */
const INACTIVE_OPACITY = 0.85;

export function MaterialTabBar<T extends string>({
  items,
  value,
  onChange,
  scrollEnabled = false,
  keepActiveTabCentered = false,
  width: customWidth,
  style,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Measured + horizontally scrollable instead of equal-width. */
  scrollEnabled?: boolean;
  keepActiveTabCentered?: boolean;
  /** Defaults to the window. Pass the container's width inside a padded sheet. */
  width?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useV2Colors();
  const tabBarRef = useAnimatedRef<Animated.ScrollView>();
  const windowWidth = useWindowDimensions().width;
  const width = customWidth ?? windowWidth;
  const isFirstRender = React.useRef(true);
  const itemLayoutGathering = React.useRef(new Map<T, ItemLayout>());

  const tabsOffset = useSharedValue(0);
  const nTabs = items.length;

  const activeIndex = Math.max(
    0,
    items.findIndex((i) => i.value === value),
  );

  /**
   * Their pager supplies these. We do not have one, so the active index IS the
   * animation: `index` is where we are, `indexDecimal` is the eased path to it,
   * and the indicator reads the second exactly as it does upstream.
   */
  const index = useSharedValue(activeIndex);
  const indexDecimal = useSharedValue(activeIndex);

  React.useEffect(() => {
    index.value = activeIndex;
    indexDecimal.value = withTiming(activeIndex, timing(duration.base, easing.standard));
  }, [activeIndex, index, indexDecimal]);

  const [itemsLayout, setItemsLayout] = React.useState<ItemLayout[]>(
    scrollEnabled
      ? []
      : items.map((_, i) => {
          const tabWidth = width / nTabs;
          return { width: tabWidth, x: i * tabWidth };
        }),
  );

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    } else if (!scrollEnabled) {
      // update items width on window resizing
      const tabWidth = width / nTabs;
      setItemsLayout(items.map((_, i) => ({ width: tabWidth, x: i * tabWidth })));
    }
  }, [scrollEnabled, nTabs, items, width]);

  const onTabItemLayout = React.useCallback(
    (event: LayoutChangeEvent, name: T) => {
      if (!scrollEnabled) return;
      if (!event.nativeEvent?.layout) return;
      const { width: w, x } = event.nativeEvent.layout;

      itemLayoutGathering.current.set(name, { width: w, x });

      // pick out the layouts for the tabs we know about (in case they changed dynamically)
      const layout = Array.from(itemLayoutGathering.current.entries())
        .filter(([tabName]) => items.some((i) => i.value === tabName))
        .map(([, l]) => l)
        .sort((a, b) => a.x - b.x);

      if (layout.length === items.length) setItemsLayout(layout);
    },
    [scrollEnabled, items],
  );

  const onScroll = useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        tabsOffset.value = event.contentOffset.x;
      },
    },
    [],
  );

  /**
   * Theirs, minus the `currentIndexToSync` / `targetIndexToSync` pair: those
   * exist to wait out a pager swipe before auto-scrolling, and a tap has no
   * in-between state to wait for.
   */
  useAnimatedReaction(
    () => index.value,
    (i) => {
      if (!scrollEnabled || itemsLayout.length !== nTabs || !itemsLayout[i]) return;
      const halfTab = itemsLayout[i].width / 2;
      const offset = itemsLayout[i].x;
      if (
        keepActiveTabCentered ||
        offset < tabsOffset.value ||
        offset > tabsOffset.value + width - 2 * halfTab
      ) {
        scrollTo(tabBarRef, offset - width / 2 + halfTab, 0, true);
      }
    },
    [scrollEnabled, itemsLayout, nTabs, keepActiveTabCentered, width],
  );

  return (
    <Animated.ScrollView
      ref={tabBarRef}
      horizontal
      accessibilityRole="tablist"
      style={style}
      contentContainerStyle={[styles.contentContainer, !scrollEnabled && { width }]}
      keyboardShouldPersistTaps="handled"
      bounces={false}
      alwaysBounceHorizontal={false}
      scrollsToTop={false}
      showsHorizontalScrollIndicator={false}
      automaticallyAdjustContentInsets={false}
      overScrollMode="never"
      scrollEnabled={scrollEnabled}
      onScroll={scrollEnabled ? onScroll : undefined}
      scrollEventThrottle={16}
    >
      {items.map((item, i) => (
        <MaterialTabItem
          key={item.value}
          index={i}
          item={item}
          selected={item.value === value}
          onPress={() => onChange(item.value)}
          onLayout={scrollEnabled ? (e) => onTabItemLayout(e, item.value) : undefined}
          scrollEnabled={scrollEnabled}
          indexDecimal={indexDecimal}
        />
      ))}
      {itemsLayout.length === nTabs && (
        <Indicator
          indexDecimal={indexDecimal}
          itemsLayout={itemsLayout}
          color={c.accent}
          fadeIn={scrollEnabled}
        />
      )}
    </Animated.ScrollView>
  );
}

function MaterialTabItem<T extends string>({
  index,
  item,
  selected,
  onPress,
  onLayout,
  scrollEnabled,
  indexDecimal,
}: {
  index: number;
  item: TabItem<T>;
  selected: boolean;
  onPress: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  scrollEnabled: boolean;
  indexDecimal: SharedValue<number>;
}) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });
  const label = item.count === undefined ? item.label : `${item.label} ${item.count}`;

  /**
   * Theirs, verbatim apart from the palette roles. The `< 0.5` colour switch is
   * a hard swap rather than an interpolation on purpose: a half-way blend of
   * two text colours is never a colour the palette contains.
   */
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      indexDecimal.value,
      [index - 1, index, index + 1],
      [INACTIVE_OPACITY, 1, INACTIVE_OPACITY],
      Extrapolation.CLAMP,
    ),
    color: Math.abs(index - indexDecimal.value) < 0.5 ? c.ink : c.inkSubtle,
  }));

  return (
    <AnimatedPressable
      onLayout={onLayout}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.item, !scrollEnabled && styles.grow, animatedStyle]}
    >
      <Animated.Text numberOfLines={1} style={[type.bodySemi, labelStyle]}>
        {label}
      </Animated.Text>
    </AnimatedPressable>
  );
}

function Indicator({
  indexDecimal,
  itemsLayout,
  color,
  fadeIn = false,
}: {
  indexDecimal: SharedValue<number>;
  itemsLayout: ItemLayout[];
  color: string;
  fadeIn?: boolean;
}) {
  const opacity = useSharedValue(fadeIn ? 0 : 1);

  /** Theirs, verbatim. This interpolation is the whole reason for the copy. */
  const stylez = useAnimatedStyle(() => {
    const firstItemX = itemsLayout[0]?.x ?? 0;

    const transform = [
      {
        translateX:
          itemsLayout.length > 1
            ? interpolate(
                indexDecimal.value,
                itemsLayout.map((_, i) => i),
                // when in RTL mode, the X value should be inverted
                itemsLayout.map((v) => (I18nManager.isRTL ? -1 * v.x : v.x)),
              )
            : I18nManager.isRTL
              ? -1 * firstItemX
              : firstItemX,
      },
    ];

    const width =
      itemsLayout.length > 1
        ? interpolate(
            indexDecimal.value,
            itemsLayout.map((_, i) => i),
            itemsLayout.map((v) => v.width),
          )
        : itemsLayout[0]?.width;

    return { transform, width, opacity: withTiming(opacity.value) };
  }, [indexDecimal, itemsLayout]);

  React.useEffect(() => {
    if (fadeIn) opacity.value = 1;
  }, [fadeIn, opacity]);

  // flat: a 2pt rule marking the selected tab — a line, not a control ground.
  return <Animated.View style={[styles.indicator, { backgroundColor: color }, stylez]} />;
}

const styles = StyleSheet.create({
  contentContainer: { flexDirection: 'row', flexWrap: 'nowrap' },
  grow: { flex: 1 },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    height: MIN_TOUCH,
  },
  indicator: { height: space.xxs, position: 'absolute', bottom: 0 },
});
