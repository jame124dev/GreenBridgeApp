import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { colors, fonts, fontSize, radius, sizes, spacing } from '@/theme';

type Props = {
  value: string;
  /** Render `value` in the placeholder color (when no real value chosen yet). */
  placeholder?: boolean;
  onPress: () => void;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

// Button that visually mimics an Input but opens a Sheet on tap. Used for
// industry / language / timezone / currency / interests pickers.

export function SelectButton({ value, placeholder, onPress, disabled, leftIcon, style }: Props) {
  const [pressed, setPressed] = useState(false);

  const combinedStyle = StyleSheet.flatten([
    styles.base,
    pressed && !disabled && styles.pressed,
    disabled && styles.disabled,
    style,
  ]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => !disabled && setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      accessibilityRole="button"
      style={combinedStyle}
    >
      {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
      <Text
        style={[styles.value, placeholder ? styles.placeholder : null]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <ChevronDown color={colors.textSubtle} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: sizes.controlHeight,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  leftIcon: { marginRight: spacing.xs },
  value: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
    color: colors.inkSlate,
  },
  placeholder: { color: colors.placeholder },
});
