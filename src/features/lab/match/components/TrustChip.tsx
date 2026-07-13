// TrustChip — one soft-green trust pill (spec 06-match-detail §2.5). The screen
// renders two side-by-side ("Verified seller" + "101LAB escrow"), each flex:1.
// Icon is passed in by the parent (lucide ShieldCheck for the seller chip;
// an inline react-native-svg vault for escrow, to match the prototype 1:1).
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '@/constants/theme';

const M = {
  trustBg: '#EAF3EC',
  trustText: '#0E6B3F',
} as const;

export type TrustChipProps = {
  icon: React.ReactNode;
  label: string;
};

export function TrustChip({ icon, label }: TrustChipProps) {
  return (
    <View style={styles.chip}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: M.trustBg,
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  iconWrap: {
    flexShrink: 0,
  },
  label: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 11.5,
    lineHeight: 14, // 1.2 × 11.5 ≈ 14
    color: M.trustText,
  },
});
