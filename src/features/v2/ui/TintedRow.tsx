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
import React, { type ReactNode } from 'react';
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
import { ChevronRight } from 'lucide-react-native';

import {
  CARD_PAD,
  GUTTER,
  ROW_SUBLINE_GAP,
  control,
  icon,
  radius,
  space,
  usePressFeedback,
  useV2Colors,
} from '@/theme/v2';

import { MaterialFill } from './Surface';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={[styles.row, { backgroundColor: c.wash }, animatedStyle, style]}
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
    </AnimatedPressable>
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
