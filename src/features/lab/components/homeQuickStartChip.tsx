// QuickStartChip — one "start from an example" row (spec 01-home-tell-ai §2f):
// emoji icon tile + title/sub text stack + trailing chevron. Press-scales to
// 0.97 (foundation recipe); caller fires `haptics.tap()` + navigates on press.
// POP-stagger entrance is applied by the parent via `entering` (mount only).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { HStack } from '@/components/ui';
import { brand, fonts, fontSize, lab, radius } from '@/constants/theme';
import { usePressScale } from '@/animations/recipes';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  icon: string;
  iconBg: string;
  title: string;
  sub: string;
  onPress: () => void;
};

export function QuickStartChip({ icon, iconBg, title, sub, onPress }: Props) {
  const { style, onPressIn, onPressOut } = usePressScale();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[styles.chip, style]}
    >
      <HStack gap="xl" align="center">
        <View style={[styles.iconTile, { backgroundColor: iconBg }]}>
          <Text style={styles.emoji}>{icon}</Text>
        </View>
        <View style={styles.textStack}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        </View>
        <ChevronRight size={16} strokeWidth={2.2} color={lab.chevron} />
      </HStack>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: lab.hairline,
    borderRadius: radius.lg,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emoji: { fontSize: 18 },
  textStack: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSize.lg, // 14 — was ad-hoc 13.5
    color: lab.ink,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: fontSize.md, // 12 — was ad-hoc 11.5
    // inkChipSub (#7C8A82) was ~3.6:1 on white — below AA. inkSub (#5E6E66) is
    // ~5:1 for this secondary line.
    color: lab.inkSub,
    marginTop: 1,
  },
});
