import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { cx } from '@/lib/cx';
import { Button, type ButtonVariant } from './Button';
import { colors, fonts, fontSize, lineHeight, radius, spacing } from '@/theme';

type Props = {
  /** Icon node (e.g. `<Inbox size={28} color={colors.textSubtle} />`). */
  icon?: React.ReactNode;
  /** Background tint behind the icon. Defaults to a subtle slate surface. */
  iconBg?: string;
  title: string;
  description?: string;
  /** Optional CTA. Shown only when `onAction` is provided. */
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: ButtonVariant;
  /** Loose layout (more vertical breathing room) — use inside large empty pages. */
  loose?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Standard empty / zero / error state. Use for "no submissions yet", "no
// products in batch", offline / load-failed retries, etc.

export function EmptyState({
  icon,
  iconBg = colors.surfaceSubtle,
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = 'secondary',
  loose,
  style,
}: Props) {
  return (
    <View style={cx<ViewStyle>(styles.root, loose && styles.loose, style)}>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>{icon}</View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {onAction && actionLabel ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant={actionVariant} size="sm" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['7xl'],
    paddingHorizontal: spacing['5xl'],
  },
  loose: { paddingVertical: spacing['10xl'] },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['3xl'],
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSize['3xl'],
    color: colors.inkSlate,
    textAlign: 'center',
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: lineHeight.normal,
    maxWidth: 320,
  },
  action: { marginTop: spacing['5xl'] },
});
