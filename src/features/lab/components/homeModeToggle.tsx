// ModeToggle — sell/buy segmented control (spec 01-home-tell-ai §2c).
// Built directly (no dep) per foundation: a track + two Pressable halves + an
// absolutely-positioned white sliding thumb driven by SLIDE-X (280ms Material
// decel). The active label color cross-fades between the sell/buy accents on
// the UI thread (interpolateColor) — this cross-fade is KEPT even under reduced
// motion (color only, no motion). `haptics.tap()` on switch is fired here.
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Package, ShoppingCart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ComposerMode } from '@/features/lab/stores/composerStore';
import { buyBlue, elevation, fonts, fontSize, greenDark, lab, motion, radius } from '@/constants/theme';
import { useSlideX } from '@/animations/recipes';
import { haptics } from '@/lib/haptics';

const TRACK_PADDING = 5;
const GAP = 6;
const THUMB_HEIGHT = 42;

type Props = {
  mode: ComposerMode;
  onChange: (m: ComposerMode) => void;
};

export function ModeToggle({ mode, onChange }: Props) {
  const { t } = useTranslation();
  const [trackWidth, setTrackWidth] = useState(0);
  const { style: slideStyle, slideTo } = useSlideX(0);

  // Half-track inner width = (track - 2*padding - gap) / 2 ; thumb sits at
  // padding for sell, and padding + halfWidth + gap for buy.
  const halfWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2 - GAP) / 2 : 0;
  const buyOffset = halfWidth + GAP;

  // Accent color cross-fade progress (0 = sell, 1 = buy). Driven independently
  // of SLIDE-X so it stays under reduced motion.
  const accentProgress = useSharedValue(mode === 'buy' ? 1 : 0);

  useEffect(() => {
    accentProgress.value = withTiming(mode === 'buy' ? 1 : 0, { duration: motion.medium });
  }, [mode, accentProgress]);

  // Reposition the thumb whenever mode OR measured width changes.
  useEffect(() => {
    if (trackWidth === 0) return;
    slideTo(mode === 'buy' ? buyOffset : 0);
  }, [mode, trackWidth, buyOffset, slideTo]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const select = (m: ComposerMode) => {
    if (m === mode) return;
    haptics.tap();
    onChange(m);
  };

  const sellColor = useDerivedValue(() =>
    interpolateColor(accentProgress.value, [0, 1], [greenDark, lab.inkChipSub]),
  );
  const buyColor = useDerivedValue(() =>
    interpolateColor(accentProgress.value, [0, 1], [lab.inkChipSub, buyBlue]),
  );

  const sellLabelStyle = useAnimatedStyle(() => ({ color: sellColor.value }));
  const buyLabelStyle = useAnimatedStyle(() => ({ color: buyColor.value }));

  return (
    <View style={styles.track} onLayout={onTrackLayout}>
      {/* Sliding white thumb */}
      {trackWidth > 0 ? (
        <Animated.View
          style={[
            styles.thumb,
            { width: halfWidth, left: TRACK_PADDING },
            slideStyle,
            Platform.select({
              ios: {
                shadowColor: lab.toggleThumbShadow,
                shadowOffset: elevation.md.shadowOffset,
                shadowOpacity: 1,
                shadowRadius: elevation.md.shadowRadius,
              },
              android: { elevation: 3 },
            }),
          ]}
          pointerEvents="none"
        />
      ) : null}

      {/* Sell half */}
      <Pressable
        style={styles.half}
        onPress={() => select('sell')}
        hitSlop={{ top: 6, bottom: 6 }}
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'sell' }}
        accessibilityLabel={t('mobile.labHome.imSelling')}
      >
        <Package size={16} strokeWidth={2} color={mode === 'sell' ? greenDark : lab.inkChipSub} />
        <Animated.Text style={[styles.label, sellLabelStyle]}>{t('mobile.labHome.imSelling')}</Animated.Text>
      </Pressable>

      {/* Buy half */}
      <Pressable
        style={styles.half}
        onPress={() => select('buy')}
        hitSlop={{ top: 6, bottom: 6 }}
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'buy' }}
        accessibilityLabel={t('mobile.labHome.imBuying')}
      >
        <ShoppingCart size={16} strokeWidth={2} color={mode === 'buy' ? buyBlue : lab.inkChipSub} />
        <Animated.Text style={[styles.label, buyLabelStyle]}>{t('mobile.labHome.imBuying')}</Animated.Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: GAP,
    backgroundColor: lab.hairline,
    padding: TRACK_PADDING,
    borderRadius: radius.lg,
    position: 'relative',
    marginBottom: 14,
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    height: THUMB_HEIGHT,
    backgroundColor: '#fff',
    borderRadius: radius.md,
  },
  half: {
    flex: 1,
    height: THUMB_HEIGHT,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    zIndex: 1,
  },
  label: {
    // fonts.bold (Inter 700) matches ComposerSendButton + TabBarItem — the
    // shell's control-label family is standardized on Inter bold.
    fontFamily: fonts.bold,
    fontSize: fontSize.lg, // 14 — was ad-hoc 13.5
  },
});
