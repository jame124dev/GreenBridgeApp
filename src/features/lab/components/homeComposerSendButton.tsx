// ComposerSendButton — the accent-colored send pill inside the AI composer
// (spec 01-home-tell-ai §2d, §3). 44px tall / radius.md / mode-colored bg +
// white Inter-700 label + ArrowRight. Reuses the foundation Button press recipe
// (scale 1 → 0.97, `haptics.impact()` MEDIUM fired by the caller's onPress).
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { ArrowRight } from 'lucide-react-native';
import { fonts, radius } from '@/constants/theme';
import { usePressScale } from '@/animations/recipes';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  label: string;
  accentColor: string;
  accentShadow: string;
  onPress: () => void;
  /** Nothing to send (no text + no attachments) → dim + non-interactive so an
   *  empty tap can't dead-fire (flag on) or navigate to an empty flow (off). */
  disabled?: boolean;
};

export function ComposerSendButton({ label, accentColor, accentShadow, onPress, disabled = false }: Props) {
  const { style, onPressIn, onPressOut } = usePressScale();

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : onPressIn}
      onPressOut={disabled ? undefined : onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[
        styles.btn,
        style,
        { backgroundColor: accentColor, opacity: disabled ? 0.45 : 1 },
        Platform.select({
          ios: {
            shadowColor: accentShadow,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 1,
            shadowRadius: 12,
          },
          android: { elevation: 6 },
        }),
      ]}
    >
      <Text style={styles.label}>{label}</Text>
      <ArrowRight size={17} strokeWidth={2.2} color="#fff" />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: radius.md, // 12 — was ad-hoc 14; matches the util tiles

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#fff',
  },
});
