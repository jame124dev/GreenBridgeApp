// WhyMatchedCard — the "Why AI matched you" card (spec 06-match-detail §2.4).
// Custom 4-point sparkle glyph (inline react-native-svg Path — NOT lucide
// Sparkles, whose silhouette differs) + a check-bulleted reasons list.
//
// Each reason POPs in staggered (delay 400 + i*80) per spec §6; the header title
// fades in at 350ms. Reduced-motion collapses the stagger to a 200ms fade.
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { fonts, greenMedium } from '@/constants/theme';
import { usePop } from '@/animations/recipes';

const M = {
  cardBorder: '#E7EDE8',
  title: '#10201A',
  body: '#445049',
} as const;

export type WhyMatchedCardProps = {
  reasons: string[];
};

export function WhyMatchedCard({ reasons }: WhyMatchedCardProps) {
  const reduceMotion = useReducedMotion();
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <Animated.View
        entering={FadeIn.duration(reduceMotion ? 200 : 300).delay(reduceMotion ? 0 : 350)}
        style={styles.header}
      >
        {/* Custom 4-point diamond sparkle (prototype path, filled green) */}
        <Svg width={17} height={17} viewBox="0 0 24 24">
          <Path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" fill={greenMedium} />
        </Svg>
        <Text style={styles.title}>{t('mobile.labMatch.whyMatched')}</Text>
      </Animated.View>

      <View style={styles.reasons}>
        {reasons.map((reason, i) => (
          <ReasonRow key={reason} reason={reason} index={i} reduceMotion={reduceMotion} />
        ))}
      </View>
    </View>
  );
}

function ReasonRow({
  reason,
  index,
  reduceMotion,
}: {
  reason: string;
  index: number;
  reduceMotion: boolean;
}) {
  // POP stagger (delay 400 + i*80), or a flat 200ms fade under reduced motion.
  const entering = usePop(reduceMotion ? 0 : 400 + index * 80);
  return (
    <Animated.View entering={entering} style={styles.reasonRow}>
      <View style={styles.checkWrap}>
        <Check size={15} color={greenMedium} strokeWidth={2.5} />
      </View>
      <Text style={styles.reasonText}>{reason}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: M.cardBorder,
    borderRadius: 18,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 11,
  },
  title: {
    fontFamily: fonts.headingBold, // Hanken 800
    fontSize: 14,
    color: M.title,
  },
  reasons: {
    flexDirection: 'column',
    gap: 9,
  },
  reasonRow: {
    flexDirection: 'row',
    gap: 9,
  },
  checkWrap: {
    flexShrink: 0,
    marginTop: 1, // top-align to first text line
  },
  reasonText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18, // 1.4 × 12.5 ≈ 18
    color: M.body,
  },
});
