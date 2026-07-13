// AiComposer — the white composer card (spec 01-home-tell-ai §2d):
// SparkleIcon + multiline TextInput + photo/attach utility buttons + the accent
// ComposerSendButton. Border / sparkle / CTA recolor by mode. The card border
// cross-fades on the UI thread; the sparkle + CTA read the resolved accent hex.
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Camera, Paperclip } from 'lucide-react-native';
import { HStack } from '@/components/ui';
import type { ComposerMode } from '@/features/lab/stores/composerStore';
import { brand, buyBlue, fonts, fontSize, greenDark, lab, motion, radius } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { SparkleIcon } from './homeSparkleIcon';
import { ComposerSendButton } from './homeComposerSendButton';

type Props = {
  mode: ComposerMode;
  value: string;
  placeholder: string;
  sendLabel: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onPhoto: () => void;
  onAttach: () => void;
};

export function AiComposer({
  mode,
  value,
  placeholder,
  sendLabel,
  onChangeText,
  onSend,
  onPhoto,
  onAttach,
}: Props) {
  const { t } = useTranslation();
  const isBuy = mode === 'buy';
  const accentColor = isBuy ? buyBlue : greenDark;
  const accentShadow = isBuy ? lab.buyShadow : lab.sellShadow;

  // Border color cross-fade (sell #BFE0CC → buy #C3D5FA).
  const progress = useSharedValue(isBuy ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(isBuy ? 1 : 0, { duration: motion.medium });
  }, [isBuy, progress]);

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [lab.sellBorder, lab.buyBorder]),
  }));

  return (
    <Animated.View
      style={[
        styles.card,
        cardStyle,
        Platform.select({
          ios: {
            shadowColor: lab.composerShadow,
            shadowOffset: { width: 0, height: 18 },
            shadowOpacity: 1,
            shadowRadius: 22,
          },
          android: { elevation: 8 },
        }),
      ]}
    >
      {/* Top row — sparkle + input */}
      <HStack align="flex-start" style={styles.topRow}>
        <View style={styles.sparkle}>
          <SparkleIcon size={20} color={accentColor} />
        </View>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={lab.inkFaint}
          multiline
          textAlignVertical="top"
        />
      </HStack>

      {/* Bottom action row */}
      <HStack justify="space-between" align="center" style={styles.bottomRow}>
        <HStack gap="md" align="center">
          <UtilButton onPress={onPhoto} label={t('mobile.labHome.addPhoto')}>
            <Camera size={18} strokeWidth={1.8} color={lab.utilIcon} />
          </UtilButton>
          <UtilButton onPress={onAttach} label={t('mobile.labHome.attachFile')}>
            <Paperclip size={18} strokeWidth={1.8} color={lab.utilIcon} />
          </UtilButton>
        </HStack>
        <ComposerSendButton
          label={sendLabel}
          accentColor={accentColor}
          accentShadow={accentShadow}
          onPress={onSend}
        />
      </HStack>
    </Animated.View>
  );
}

function UtilButton({
  onPress,
  label,
  children,
}: {
  onPress: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const handle = () => {
    haptics.tap();
    onPress();
  };
  return (
    <Pressable
      onPress={handle}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.utilBox}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: brand.surface,
    borderWidth: 1.5,
    borderRadius: radius['2xl'],
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 13,
  },
  topRow: { gap: 10 },
  sparkle: { marginTop: 2, flexShrink: 0 },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.lg, // 14 — was ad-hoc 14.5
    lineHeight: 20,
    color: lab.ink,
    backgroundColor: 'transparent',
    padding: 0,
    minHeight: 40,
  },
  bottomRow: { marginTop: 12 },
  utilBox: {
    // 44×44 meets the min visible touch target and aligns to the 44px send
    // button on the same row (was 40). radius.md snaps off the ad-hoc 13.
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.4,
    borderColor: lab.utilBorder,
    backgroundColor: lab.utilBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
