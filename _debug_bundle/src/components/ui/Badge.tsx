import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { cx } from '@/lib/cx';
import { colors, fonts, fontSize, letterSpacing, radius, spacing } from '@/theme';

export type BadgeVariant =
  | 'live'
  | 'pending'
  | 'sold'
  | 'review'
  | 'inspect'
  | 'inactive'
  | 'submitted'
  | 'ai'
  | 'neutral';

export type BadgeSize = 'sm' | 'md';

type Props = {
  /** Semantic meaning — drives bg, border, text, and dot colors. */
  variant: BadgeVariant;
  /** Text content (usually pre-translated). */
  label: string;
  size?: BadgeSize;
  /** Show a leading colored dot (status-pill style). */
  dot?: boolean;
  /** Render an icon node before the label (e.g. ✨ for `ai`). */
  leftIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

// Status / category pill. Variants own the visual mapping — callers don't pass
// colors directly. To add a new status: extend `BadgeVariant`, drop a row into
// `variantStyles`, and any caller can light it up immediately.

export function Badge({
  variant,
  label,
  size = 'sm',
  dot = false,
  leftIcon,
  style,
}: Props) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <View style={cx<ViewStyle>(styles.base, s.container, v.container, style)}>
      {dot ? <View style={[styles.dot, s.dot, { backgroundColor: v.dot }]} /> : null}
      {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
      <Text style={[styles.label, s.label, { color: v.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    borderWidth: 1,
  },
  dot: { borderRadius: 999 },
  leftIcon: { marginRight: 2 },
  label: {
    fontFamily: fonts.bold,
    letterSpacing: letterSpacing.capsLoose,
    includeFontPadding: false,
  },
});

const sizeStyles: Record<
  BadgeSize,
  {
    container: ViewStyle;
    label: TextStyle;
    dot: ViewStyle;
  }
> = {
  sm: {
    container: {
      paddingHorizontal: spacing.md,
      paddingVertical: 2,
      gap: spacing.xs,
    },
    label: { fontSize: fontSize.xs },
    dot: { width: 6, height: 6 },
  },
  md: {
    container: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
      gap: spacing.sm,
    },
    label: { fontSize: fontSize.sm },
    dot: { width: 7, height: 7 },
  },
};

type VariantStyle = { container: ViewStyle; text: string; dot: string };

const variantStyles: Record<BadgeVariant, VariantStyle> = {
  live: {
    container: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
    text: colors.successText,
    dot: colors.success,
  },
  pending: {
    container: { backgroundColor: colors.warningBg, borderColor: colors.warningBorder },
    text: colors.warningText,
    dot: colors.warning,
  },
  sold: {
    container: { backgroundColor: colors.successBg, borderColor: colors.primaryAccent },
    text: '#166534',
    dot: '#16a34a',
  },
  review: {
    container: { backgroundColor: colors.warningBg, borderColor: colors.warningBorder },
    text: colors.warningText,
    dot: colors.warning,
  },
  inspect: {
    container: { backgroundColor: colors.inspectBg, borderColor: colors.inspectBorder },
    text: colors.inspectText,
    dot: colors.inspect,
  },
  inactive: {
    container: { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong },
    text: colors.textMuted,
    dot: colors.textSubtle,
  },
  submitted: {
    container: { backgroundColor: colors.infoBg, borderColor: colors.infoBorder },
    text: colors.infoText,
    dot: colors.info,
  },
  ai: {
    container: { backgroundColor: colors.warningBg, borderColor: colors.warningBorder },
    text: colors.warningText,
    dot: colors.warning,
  },
  neutral: {
    container: { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong },
    text: colors.textMuted,
    dot: colors.textSubtle,
  },
};
