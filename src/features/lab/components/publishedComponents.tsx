// Screen-local components for the (lab) Published celebration screen
// (NewVersion/04-published.md §3). Namespaced `published*` so parallel screen
// builders don't collide. Static/presentational only — the route file owns
// navigation + the mode-derived view-model. Nothing here fetches data.
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Check, CheckCircle } from 'lucide-react-native';
import { brand, fonts, greenDarkest, greenMedium, radius } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { pop, reducedFade, usePressScale } from '@/animations/recipes';
import type { PublishedAvatar } from '@/features/lab/data/demo';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* -------------------------------------------------------------------------- */
/*  Screen-local one-off palette (spec 04 §3 — do NOT promote to global token) */
/* -------------------------------------------------------------------------- */
export const PUB_C = {
  bandStop2: '#14513D', // gradient stop 2 (greenDarkest is stop 1 = token)
  badgeRing: '#EAF6EE', // badge outer soft-mint ring
  matchLabel: '#9FD9BE', // small-caps mint label on band
  avatarText: '#CFF0DD', // avatar 2-letter labels
  cardBorder: '#E7EDE8', // white shell border
  subtitle: '#5E6E66', // subtitle text — darkened to note ink for AA on lab.bg (spec finding: 4.99:1 on #F4F7F4)
  note: '#5E6E66', // managed note + ghost CTA label
  headline: '#10201A', // headline ink
} as const;

/* -------------------------------------------------------------------------- */
/*  CheckBadge — 84/58 nested-circle success badge with a one-shot success tap */
/* -------------------------------------------------------------------------- */
export function CheckBadge() {
  const reduced = useReducedMotion();
  // Outer ring POP (no delay) + inner circle POP (+100ms). Under reduced motion
  // both collapse to an opacity-only fade and the success haptic is suppressed
  // (it's coupled to the pop — spec §6).
  const outerEntering = reduced ? reducedFade(0) : pop(0);
  const innerEntering = reduced ? reducedFade(100) : pop(100);

  // One-shot success haptic fired with the inner-circle pop. Guarded so it fires
  // exactly once per mount (StrictMode / re-render safe).
  const firedRef = useRef(false);
  useEffect(() => {
    if (reduced || firedRef.current) return;
    firedRef.current = true;
    const t = setTimeout(() => haptics.success(), 100); // align with inner POP delay
    return () => clearTimeout(t);
  }, [reduced]);

  return (
    <Animated.View entering={outerEntering} style={styles.badgeOuter}>
      <Animated.View entering={innerEntering} style={styles.badgeInner}>
        <Check size={32} color="#fff" strokeWidth={3} />
      </Animated.View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/*  CountryAvatarStack — overlapping 40px circles (-12 overlap after the first) */
/* -------------------------------------------------------------------------- */
type AvatarStackProps = {
  avatars: PublishedAvatar[];
  ringColor: string;
  /** Base entrance delay (ms) for the first avatar; each subsequent +80ms. */
  baseDelay?: number;
};

export function CountryAvatarStack({ avatars, ringColor, baseDelay = 0 }: AvatarStackProps) {
  const reduced = useReducedMotion();
  return (
    <View style={styles.avatarRow}>
      {avatars.map((a, i) => {
        const delay = baseDelay + i * 80; // POP stagger = 80ms (spec §6)
        const entering = reduced ? reducedFade(delay) : pop(delay);
        const overlap: ViewStyle = i === 0 ? {} : { marginLeft: -12 };
        return (
          <Animated.View
            key={a.code}
            entering={entering}
            style={[styles.avatar, { backgroundColor: a.bg, borderColor: ringColor }, overlap]}
          >
            <Text style={styles.avatarLabel}>{a.code}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  MatchCountCard — white shell + dark gradient band + managed-note row        */
/* -------------------------------------------------------------------------- */
type MatchCountCardProps = {
  label: string;
  count: string;
  note: string;
  avatars: PublishedAvatar[];
  ringColor: string;
  /** Entrance delay (ms) for the country-avatar stagger start. */
  avatarBaseDelay?: number;
};

export function MatchCountCard({
  label,
  count,
  note,
  avatars,
  ringColor,
  avatarBaseDelay = 0,
}: MatchCountCardProps) {
  return (
    <View style={styles.cardShell}>
      <LinearGradient
        colors={[greenDarkest, PUB_C.bandStop2] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.band}
      >
        <View style={styles.bandLeft}>
          <Text style={styles.matchLabel}>{label}</Text>
          <Text style={styles.matchCount}>{count}</Text>
        </View>
        <CountryAvatarStack avatars={avatars} ringColor={ringColor} baseDelay={avatarBaseDelay} />
      </LinearGradient>

      <View style={styles.noteRow}>
        <CheckCircle size={18} color={greenMedium} strokeWidth={2} style={styles.noteIcon} />
        <Text style={styles.noteText}>{note}</Text>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  PublishedCTA — bespoke Pressable, 0.97 press scale + release haptic         */
/* -------------------------------------------------------------------------- */
type PublishedCTAProps = {
  label: string;
  onPress: () => void;
  variant: 'primary' | 'ghost';
  /** Release haptic — defaults derive from variant (impact primary / tap ghost). */
  onPressHaptic?: () => void;
};

export function PublishedCTA({ label, onPress, variant, onPressHaptic }: PublishedCTAProps) {
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();
  const isPrimary = variant === 'primary';

  const handlePress = () => {
    // Release haptic (matches Button — fired on release, not press-in).
    (onPressHaptic ?? (isPrimary ? haptics.impact : haptics.tap))();
    onPress();
  };

  return (
    <AnimatedPressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[pressStyle, isPrimary ? styles.ctaPrimary : styles.ctaGhost]}
    >
      <Text style={isPrimary ? styles.ctaPrimaryLabel : styles.ctaGhostLabel}>{label}</Text>
      {isPrimary ? <ArrowRight size={18} color="#fff" strokeWidth={2.2} /> : null}
    </AnimatedPressable>
  );
}

/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  // CheckBadge
  badgeOuter: {
    width: 84,
    height: 84,
    borderRadius: radius.full,
    backgroundColor: PUB_C.badgeRing,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  badgeInner: {
    width: 58,
    height: 58,
    borderRadius: radius.full,
    backgroundColor: greenMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // MatchCountCard shell
  cardShell: {
    width: '100%',
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: PUB_C.cardBorder,
    borderRadius: radius.xl,
    padding: 6,
    paddingBottom: 8,
    // Custom green-tinted lift (not an elevation preset — spec §2.4).
    shadowColor: greenDarkest,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  band: {
    borderRadius: radius.lg,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bandLeft: {
    flexShrink: 1,
  },
  matchLabel: {
    fontFamily: fonts.label,
    fontSize: 11,
    letterSpacing: 0.88,
    color: PUB_C.matchLabel,
  },
  matchCount: {
    fontFamily: fonts.headingBold,
    fontSize: 34,
    lineHeight: 34,
    marginTop: 4,
    color: '#fff',
  },

  // CountryAvatarStack
  avatarRow: {
    flexDirection: 'row',
    marginRight: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: PUB_C.avatarText,
  },

  // Managed-note row
  noteRow: {
    padding: 14,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  noteIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  noteText: {
    fontFamily: fonts.regular,
    fontSize: 14, // bodySm token — primary explanatory copy, off-scale 12.5 removed
    lineHeight: 20,
    color: PUB_C.note,
    flex: 1,
  },

  // CTAs
  ctaPrimary: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: greenDarkest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // Custom green CTA shadow (spec §2.5).
    shadowColor: greenDarkest,
    shadowOpacity: 0.6,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  ctaPrimaryLabel: {
    fontFamily: fonts.headingBold,
    fontSize: 16,
    color: '#fff',
  },
  ctaGhost: {
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaGhostLabel: {
    // Ghost is a deliberate quieter step below the primary (Hanken 800/16):
    // Inter 600 at 15 — a chosen weight/size step, not an ad-hoc 14 (finding 4).
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: PUB_C.note,
  },
});
