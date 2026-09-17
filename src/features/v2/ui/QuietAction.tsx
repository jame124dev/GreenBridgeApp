/**
 * `QuietAction` — a text-only button. Sign out, Try again, Delete account.
 *
 * The design allows exactly one green pill per screen (`PrimaryAction`).
 * Everything else that is tappable but not the primary action is this: type,
 * a real 44pt target, and a dim on press. No border, no fill, no second green.
 *
 * `tone="danger"` is the only warm colour in the design and is reserved for
 * destructive actions. It is still quiet — a destructive action should be
 * findable, not prominent.
 */
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native. RN's Pressable uses the
// JS responder system, which RNGH intercepts natively — inside Home's pager it
// never receives the tap. See the note in `features/v2/home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { MIN_TOUCH, space, usePressFeedback, type TypeToken } from '@/theme/v2';

import { Text, type TextColor } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function QuietAction({
  label,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  tone = 'muted',
  variant = 'bodyMedium',
  align = 'center',
  disabled = false,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  /**
   * Overrides the spoken label when the visible one is ambiguous out of
   * context. A list of five identical "Resume" buttons is five identical
   * announcements — pass "Resume Waters HPLC" for each.
   */
  accessibilityLabel?: string;
  /** What happens on activation, when it is not obvious from the label. */
  accessibilityHint?: string;
  /** `subtle` is quieter than `muted` — for an action that must be findable but not offered. */
  tone?: 'muted' | 'subtle' | 'accent' | 'danger';
  variant?: TypeToken;
  align?: 'center' | 'start';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });

  const color: TextColor =
    tone === 'accent'
      ? 'accentInk'
      : tone === 'danger'
        ? 'danger'
        : tone === 'subtle'
          ? 'inkSubtle'
          : 'inkMuted';

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[
        styles.base,
        align === 'center' ? styles.center : styles.start,
        disabled && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
      <Text variant={variant} color={color}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: space.xs },
  center: { alignItems: 'center' },
  start: { alignItems: 'flex-start' },
  disabled: { opacity: 0.45 },
});
