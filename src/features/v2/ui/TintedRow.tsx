/**
 * `TintedRow` — a filled `wash` block with a round accent glyph.
 *
 *     ( ✦ )  Ask the assistant                              ›
 *            "What is my Waters HPLC worth?"
 *
 * The one place the design fills a block rather than separating with a rule.
 * That is what makes it read as an offer rather than as a list item, so it is
 * used sparingly — one per screen, for the thing you would like the person to
 * try next. On 6a it is the assistant; 6b uses the same shape.
 *
 * Not a variant of `Row`: `Row` is a list member and full-bleed, this is an
 * inset card with its own ground. Sharing them would mean a `filled` prop that
 * changes the margins, padding, radius and leading shape — i.e. a different
 * component wearing the same name.
 */
import React, { useState, type ReactNode } from 'react';
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
import { ChevronRight } from 'lucide-react-native';

import {
  CARD_PAD,
  GUTTER,
  ROW_SUBLINE_GAP,
  control,
  icon,
  press,
  radius,
  space,
  useV2Colors,
} from '@/theme/v2';

import { MaterialFill } from './Surface';
import { Text } from './Text';

export function TintedRow({
  title,
  subtitle,
  glyph,
  onPress,
  style,
  testID,
}: {
  title: string;
  /** One line, truncated. A quoted example works well here. */
  subtitle?: string;
  /** Rendered inside the 40pt accent circle. Size it at `icon.lg`. */
  glyph?: ReactNode;
  onPress: () => void;
  /** Outer spacing — the block sits at a different height on each screen. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useV2Colors();
  /**
   * ⚠️ PLAIN STATE, NOT `usePressFeedback` / `Animated.createAnimatedComponent`.
   *
   * Investigated 2026-09-24 as a suspect in a Home-screen collapse bug (this
   * row and the promo banner below it painting as a blank void after a scroll
   * gesture, `uiautomator` reporting `y2 < y1` — an inverted rect). The ACTUAL
   * root cause was `HomePager.tsx`'s `TabView` seeding `tabViewLayout.height`
   * at 0 until its own `onLayout` corrected it, which fed a 0 `minHeight` into
   * `RTVScrollView`'s content container (see the `tabView: { width, height }`
   * fix and its comment there). Once that was fixed, a scripted repro —
   * scroll away and back, twice — showed this row painting correctly every
   * time, with `uiautomator` back to normal bounds and React Native's own
   * `onLayout` reporting an unchanged, valid layout throughout (it never
   * refires on scroll, only on real layout change) — proof the row itself was
   * never broken.
   *
   * The switch away from `Animated.createAnimatedComponent` here was a
   * plausible-but-unconfirmed suspect tried while root-causing, not the fix —
   * kept because it is simpler (no Reanimated nesting inside `RTVScrollView`'s
   * own Reanimated stack), not because it was proven necessary. It does mean
   * press feedback here is an instant opacity snap instead of `usePressFeedback`'s
   * timed fade; reintroduce that ONE nesting level up (a value computed outside
   * this component driving a plain `Pressable`'s style) if the fade is wanted
   * back, rather than re-wrapping this component in `Animated.createAnimatedComponent`.
   */
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={[
        styles.row,
        { backgroundColor: c.wash, opacity: pressed ? press.opacity : 1 },
        style,
      ]}
    >
      {/* Material. No shadow: this row sits inside Home's swiping pane. */}
      <MaterialFill role="wash" ink="ink" radius={radius.lg} />

      {glyph ? (
        <View style={[styles.glyph, { backgroundColor: c.accent }]}>
          <MaterialFill role="accent" ink="onAccent" radius={radius.pill} />
          {glyph}
        </View>
      ) : null}

      <View style={styles.text}>
        <Text variant="rowTitle">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="inkMuted" numberOfLines={1} style={styles.sub}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <ChevronRight size={icon.md} color={c.inkSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2xl'],
    marginHorizontal: GUTTER,
    paddingVertical: space['3xl'],
    paddingHorizontal: CARD_PAD,
    borderRadius: radius.lg,
  },
  glyph: {
    overflow: 'hidden',
    width: control.avatar,
    height: control.avatar,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: { flex: 1, minWidth: 0 },
  sub: { marginTop: ROW_SUBLINE_GAP },
});
