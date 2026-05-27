import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { cx } from '@/lib/cx';
import { colors, fonts, fontSize, letterSpacing, radius, spacing } from '@/theme';

type Props = {
  label: string;
  /** Red asterisk after the label. */
  required?: boolean;
  /** Show the ✨ AI badge to the right of the label. */
  ai?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Small-caps section label used across the scanner Detail screen.
//
//   <SectionLabel label="TITLE" ai />
//   <SectionLabel label="CONDITION" required />

export function SectionLabel({ label, required, ai, style }: Props) {
  return (
    <View style={cx<ViewStyle>(styles.row, style)}>
      <Text style={styles.label}>{label}</Text>
      {required ? <Text style={styles.required}>*</Text> : null}
      {ai ? (
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>✨ AI</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing['4xl'],
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.label,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    letterSpacing: letterSpacing.caps,
  },
  required: {
    color: colors.destructive,
    fontFamily: fonts.bold,
    fontSize: fontSize.lg,
    marginLeft: -2,
  },
  aiBadge: {
    backgroundColor: colors.primarySurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  aiBadgeText: {
    fontFamily: fonts.label,
    fontSize: 9,
    color: colors.primaryDim,
    letterSpacing: letterSpacing.capsLoose,
  },
});
