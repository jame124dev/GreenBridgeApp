// (lab) Deal Room — 5-role message renderer + entrance choreography. Spec 07
// §2c + §6. Roles map to the demo `DealMessage` discriminated union:
//   day       → centered divider          (FadeIn)
//   system    → centered "confirmed" pill  (POP)
//   them      → left seller bubble         (SlideInLeft)
//   me        → right user bubble          (SlideInRight)
//   concierge → centered dashed card       (SlideInLeft)
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  SlideInLeft,
  SlideInRight,
  ZoomIn,
  useReducedMotion,
} from 'react-native-reanimated';
import { fonts, greenDarkest, greenMedium, greenLight, brand, radius } from '@/constants/theme';
import { DEAL_COLORS, type DealMessage } from '@/features/lab/data/demo';
import { DealSparkle } from './dealIcons';

const DEFAULT_DURATION = 300;

/**
 * Resolve the mount entrance for a message row, honoring reduced motion.
 * `delayMs` staggers seed messages ~80ms each on first mount (spec 07 §6).
 * Reduced motion → plain fade for every role; stagger disabled by the caller.
 */
function useEntering(role: DealMessage['kind'], delayMs: number) {
  const reduced = useReducedMotion();
  if (reduced) return FadeIn.duration(200).delay(delayMs);
  switch (role) {
    case 'day':
      return FadeIn.duration(250).delay(delayMs);
    case 'system':
      // POP feel: scale 0.92→1 + fade, slight overshoot; ~200ms lead.
      return ZoomIn.duration(DEFAULT_DURATION).delay(delayMs + 200);
    case 'me':
      return SlideInRight.duration(DEFAULT_DURATION).delay(delayMs);
    case 'them':
    case 'concierge':
      return SlideInLeft.duration(DEFAULT_DURATION).delay(delayMs);
  }
}

export function DealMessageBubble({ msg, delayMs = 0 }: { msg: DealMessage; delayMs?: number }) {
  const entering = useEntering(msg.kind, delayMs);

  if (msg.kind === 'day') {
    return (
      <Animated.View entering={entering} style={styles.dayWrap}>
        <Text style={styles.dayText}>{msg.text}</Text>
      </Animated.View>
    );
  }

  if (msg.kind === 'system') {
    return (
      <Animated.View entering={entering} style={styles.confirmPill}>
        <DealSparkle size={13} color={greenMedium} />
        <Text style={styles.confirmText}>{msg.text}</Text>
      </Animated.View>
    );
  }

  if (msg.kind === 'them') {
    return (
      <Animated.View entering={entering} style={styles.sellerBubble}>
        <Text style={styles.sellerBody}>{msg.text}</Text>
        <Text style={styles.sellerMeta}>{msg.meta}</Text>
      </Animated.View>
    );
  }

  if (msg.kind === 'me') {
    return (
      <Animated.View entering={entering} style={styles.userBubble}>
        <Text style={styles.userBody}>{msg.text}</Text>
        <Text style={styles.userMeta}>{msg.meta}</Text>
      </Animated.View>
    );
  }

  // concierge
  return (
    <Animated.View entering={entering} style={styles.conciergeCard}>
      <View style={styles.conciergeChip}>
        <DealSparkle size={15} color={greenLight} />
      </View>
      <Text style={styles.conciergeBody}>
        <Text style={styles.conciergeLead}>{msg.who} </Text>
        {msg.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // day divider
  dayWrap: { alignSelf: 'stretch' },
  dayText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    // AA fix: DEAL_COLORS.divider (#A5B1A9) is only ~2.1:1 on the thread bg;
    // brand.textMuted clears AA on both the bg and white surfaces.
    color: brand.textMuted,
    textAlign: 'center',
  },
  // confirmation pill
  confirmPill: {
    alignSelf: 'center',
    backgroundColor: DEAL_COLORS.confirmBg,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confirmText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: DEAL_COLORS.confirmInk },
  // seller (left)
  sellerBubble: {
    alignSelf: 'flex-start',
    maxWidth: '78%',
    backgroundColor: DEAL_COLORS.sellerBg,
    borderWidth: 1,
    borderColor: DEAL_COLORS.sellerBorder,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  sellerBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: DEAL_COLORS.sellerInk },
  // AA fix: meta snaps to caption 12/16; DEAL_COLORS.metaInk (#A5B1A9) is only
  // ~2.2:1 on the white seller bubble, so use brand.textMuted (clears AA).
  sellerMeta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: brand.textMuted, marginTop: 5 },
  // user (right)
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '78%',
    backgroundColor: greenDarkest,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  userBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: DEAL_COLORS.userInk },
  userMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: DEAL_COLORS.userMeta,
    marginTop: 5,
    textAlign: 'right',
  },
  // concierge (center, dashed)
  conciergeCard: {
    alignSelf: 'center',
    maxWidth: '88%',
    backgroundColor: DEAL_COLORS.conciergeBg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: DEAL_COLORS.conciergeBorder,
    borderRadius: radius.lg,
    paddingVertical: 11,
    paddingHorizontal: 13,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  conciergeChip: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: greenDarkest,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  conciergeBody: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: DEAL_COLORS.conciergeInk,
  },
  conciergeLead: { fontFamily: fonts.bold, color: greenDarkest },
});
