// DateDivider — a centred "Today" / date label with a hairline on each side,
// separating a day's worth of messages in the conversation thread (redesign
// mockup: `.divider`). Presentational only; the screen computes the label.
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { fonts, lab, spacing } from '@/constants/theme';

export function DateDivider({ label }: { label: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: lab.hairline },
  label: {
    fontFamily: fonts.label,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 1,
    color: lab.inkMeta,
    textTransform: 'uppercase',
  },
});
