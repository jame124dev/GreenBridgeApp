// (lab) Deal Room — amber "101LAB is managing this deal" banner. Fixed sibling
// below the header, above the scrolling thread (NOT inside the scroll body).
// Spec 07 §2b. Custom because no Card variant offers this amber bg/border pair.
import { View, Text, StyleSheet } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { fonts, radius } from '@/constants/theme';
import { DEAL_COLORS } from '@/features/lab/data/demo';

export function DealManagedBanner({ note }: { note: string }) {
  return (
    <View style={styles.banner}>
      <ShieldCheck size={17} color={DEAL_COLORS.bannerIcon} strokeWidth={2} style={styles.icon} />
      <Text style={styles.text}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: DEAL_COLORS.bannerBg,
    borderWidth: 1,
    borderColor: DEAL_COLORS.bannerBorder,
    borderRadius: radius.lg,
    paddingVertical: 11,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: { flexShrink: 0 },
  text: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: DEAL_COLORS.bannerInk,
  },
});
