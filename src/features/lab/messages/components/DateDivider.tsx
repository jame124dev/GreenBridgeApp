// DateDivider — a centred "Today" / "Yesterday" / "Jun 30" label with a hairline
// on each side, separating one calendar day of messages from the next.
//
// Presentational only: the SCREEN decides where a day boundary falls and what the
// label says (it owns the i18n month array + today/yesterday keys). The screen
// used to compute a single label from messages[0] and render this once at the
// top, so a multi-day thread showed one stale date and no other separators; it
// now emits one of these per day change, which is why the vertical rhythm here
// matters — the top margin has to out-space MessageBubble's group gap so a new
// day reads as a bigger break than a new sender.
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { fonts, lab, spacing } from '@/constants/theme';

export function DateDivider({ label }: { label: string }) {
  return (
    <View style={styles.row} testID={`deal-day-${label}`}>
      <View style={styles.line} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
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
