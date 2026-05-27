import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { cx } from '@/lib/cx';
import { colors, fonts, fontSize, spacing } from '@/theme';

type Props = {
  label: string;
  /** Right-aligned subtle hint next to the label (e.g. "optional", "read-only"). */
  hint?: string;
  /** Validation message rendered under the input in destructive color. */
  error?: string;
  /** Allow the field to grow horizontally when used inside a row. */
  flex?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

// Standard label + input + error layout. Pairs with Input / SelectButton.
//
//   <Field label="Email" error={errors.email?.message}>
//     <Input value={…} onChangeText={…} />
//   </Field>

export function Field({ label, hint, error, flex, children, style }: Props) {
  return (
    <View style={cx<ViewStyle>(styles.field, flex && styles.flex, style)}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, error ? styles.labelError : null]} numberOfLines={1}>
          {label}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {},
  flex: { flex: 1 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  label: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSize.base,
    color: colors.foreground,
  },
  labelError: { color: colors.destructive },
  hint: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: colors.textSubtle,
    marginLeft: spacing.md,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: fontSize.md,
    color: colors.destructive,
    marginTop: spacing.xs,
  },
});
