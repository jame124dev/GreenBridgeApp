/**
 * `IconAction` — a round, icon-only accent button.
 *
 *     ( + )
 *
 * Sits beside a display heading where the action is obvious from context and a
 * word would be noise: add a want (6d), and the same shape on 6b as drawn.
 *
 * Not a variant of `PrimaryAction` — that is a 54pt labelled pill, and the one
 * green pill a screen is allowed. This is a 46pt circle with no label, so the
 * two never compete for the same slot on a screen.
 *
 * Because there is no visible label, `accessibilityLabel` is REQUIRED. An
 * unlabelled icon button announces as "button" and nothing else.
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native. RN's Pressable uses the
// JS responder system, which RNGH intercepts natively — inside Home's pager it
// never receives the tap. See the note in `features/v2/home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { control, radius, usePressFeedback, useV2Colors } from '@/theme/v2';

import { MaterialFill } from './Surface';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function IconAction({
  icon,
  accessibilityLabel,
  onPress,
  accessibilityHint,
  tone = 'accent',
  disabled = false,
  style,
  testID,
}: {
  /** Size it at `icon['2xl']` for the accent tone. */
  icon: ReactNode;
  /** Required — there is no visible text to fall back on. */
  accessibilityLabel: string;
  onPress: () => void;
  accessibilityHint?: string;
  /** `quiet` is the same circle in `fill`, for a secondary icon action. */
  tone?: 'accent' | 'quiet';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[
        styles.button,
        { backgroundColor: tone === 'accent' ? c.accent : c.fill },
        disabled && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
      {/* Material. A round control, so the ramp is all it gets — a shadow on
          the composer's send button would sit over the keyboard. */}
      <MaterialFill
        role={tone === 'accent' ? 'accent' : 'fill'}
        ink={tone === 'accent' ? 'onAccent' : 'ink'}
        radius={radius.pill}
      />
      {icon}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    overflow: 'hidden',
    width: control.thumb,
    height: control.thumb,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  disabled: { opacity: 0.45 },
});
