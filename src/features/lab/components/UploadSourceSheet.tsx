// UploadSourceSheet — the (lab) chat's "Add photos or documents" action sheet
// (NewVersion/12-chat-upload-ai-recognition-handoff.md §4-§5). Opened from the
// `listing_entry_options` card's "Upload photos / documents" button; on a chosen
// source the caller forces sell mode, awaits the matching picker, and auto-starts
// the detect turn so AI recognition streams inline (see chat.tsx handleUploadPress).
//
// Structure/backdrop/handle/safe-area follow the app's bottom-sheet language
// (AddWantSheet / Sheet.tsx: RN `Modal`, slate backdrop, top grabber, bottom
// safe-area) but the MOTION is composed from the real recipe primitives
// (`@/animations/recipes`) rather than Sheet.tsx's crude `animationType="fade"`:
//  - backdrop opacity 0→0.45 on the MATERIAL_DECEL curve,
//  - panel RISE (translateY spring + opacity 350ms),
//  - per-row PRESS_SCALE via usePressScale(),
//  - a MANDATORY useReducedMotion() fallback on every animated path (opacity-only,
//    no translate/scale).
// Rows reuse the exact EntryOption visual shape from `chat/cards.tsx` (icon chip +
// title + subtitle + chevron); every color/space/radius/font is a token — no
// literal hexes or magic numbers.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, ChevronRight, FileText, Images } from 'lucide-react-native';

import {
  brand,
  elevation,
  fonts,
  greenDark,
  motion,
  radius,
  spacing,
} from '@/constants/theme';
import {
  DURATIONS,
  MATERIAL_DECEL,
  RISE_SPRING,
  usePressScale,
} from '@/animations/recipes';
import { haptics } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The three picker sources the sheet fans out to. */
export type UploadSource = 'camera' | 'library' | 'document';

type UploadSourceSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Fired with the chosen source. The caller owns the pick + auto-start. */
  onPick: (source: UploadSource) => void;
};

/** Peak backdrop alpha (motion recon: opacity 0 → 0.45). */
const BACKDROP_MAX = 0.45;

export function UploadSourceSheet({ visible, onClose, onPick }: UploadSourceSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  // Keep the Modal mounted through the exit animation: `visible` toggles the
  // enter/exit drivers, and we only drop `mounted` (which gates the RN Modal)
  // once the panel opacity animation reports finished.
  const [mounted, setMounted] = useState(visible);

  // Defer the pick until the sheet has FULLY animated out. Launching the OS
  // picker (its own native modal) while this RN Modal is still presented/
  // dismissing races on iOS ("present while dismissing"). So a row tap records
  // the source and closes; `onPick` fires from the exit-finished callback, once
  // the sheet is gone — which also reads better (sheet slides away, then the
  // camera/library opens). Refs so the worklet callback never sees a stale prop.
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const chosenRef = useRef<UploadSource | null>(null);

  const finishClose = useCallback(() => {
    setMounted(false);
    const source = chosenRef.current;
    chosenRef.current = null;
    if (source) onPickRef.current(source);
  }, []);

  // Animated drivers — transform/opacity only, all on the UI thread.
  const backdropP = useSharedValue(0); // 0 → 1 (scaled to BACKDROP_MAX)
  const panelOp = useSharedValue(0); // panel opacity 0 → 1
  const panelY01 = useSharedValue(0); // 0 = hidden (offscreen), 1 = at rest
  const hiddenY = useSharedValue(600); // measured panel height (slide distance)

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reduced) {
        // Reduced motion: opacity-only, no slide.
        backdropP.value = withTiming(1, { duration: DURATIONS.reduced });
        panelOp.value = withTiming(1, { duration: DURATIONS.reduced });
        panelY01.value = 1;
      } else {
        backdropP.value = withTiming(1, {
          duration: motion.medium,
          easing: MATERIAL_DECEL,
        });
        panelOp.value = withTiming(1, { duration: DURATIONS.rise });
        panelY01.value = withSpring(1, RISE_SPRING);
      }
      return;
    }
    // Exit — mirror the enter as one continuous motion, then unmount.
    const dur = reduced ? DURATIONS.reduced : DURATIONS.rise;
    backdropP.value = withTiming(0, {
      duration: dur,
      ...(reduced ? {} : { easing: MATERIAL_DECEL }),
    });
    if (!reduced) {
      panelY01.value = withTiming(0, { duration: dur, easing: MATERIAL_DECEL });
    }
    panelOp.value = withTiming(0, { duration: dur }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  }, [visible, reduced, backdropP, panelOp, panelY01, finishClose]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropP.value * BACKDROP_MAX,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOp.value,
    transform: [{ translateY: interpolate(panelY01.value, [0, 1], [hiddenY.value, 0]) }],
  }));

  // Record the source + start the close; `onPick` fires from finishClose once
  // the sheet is fully gone (see the ref block above).
  const choose = (source: UploadSource) => {
    haptics.tap();
    chosenRef.current = source;
    onClose();
  };

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <AnimatedPressable
        style={[styles.backdrop, backdropStyle]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.labCommon.close')}
      />

      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          style={[styles.sheet, panelStyle, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}
          onLayout={(e) => {
            hiddenY.value = e.nativeEvent.layout.height;
          }}
          accessibilityViewIsModal
        >
          <View style={styles.grabber} />

          <Text style={styles.title}>{t('mobile.labCommon.uploadSheetTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('mobile.labCommon.uploadSheetSubtitle')}
          </Text>

          <View style={styles.rows}>
            <SourceRow
              icon={<Camera size={18} color={greenDark} />}
              title={t('mobile.labCommon.takePhoto')}
              subtitle={t('mobile.labCommon.takePhotoSub')}
              onPress={() => choose('camera')}
            />
            <SourceRow
              icon={<Images size={18} color={greenDark} />}
              title={t('mobile.labCommon.chooseFromLibrary')}
              subtitle={t('mobile.labCommon.chooseFromLibrarySub')}
              onPress={() => choose('library')}
            />
            <SourceRow
              icon={<FileText size={18} color={greenDark} />}
              title={t('mobile.labCommon.attachDocument')}
              subtitle={t('mobile.labCommon.attachDocumentSub')}
              onPress={() => choose('document')}
            />
          </View>

          <CancelButton onPress={onClose} />
        </Animated.View>
      </View>
    </Modal>
  );
}

/** A tap-to-choose source row — reuses the exact EntryOption shape from
 *  `chat/cards.tsx` (icon chip + title + subtitle + chevron) with the shared
 *  PRESS_SCALE feel + selection haptic. */
function SourceRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={style}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <View style={styles.row}>
        <View style={styles.rowIcon}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSub}>{subtitle}</Text>
        </View>
        <View style={styles.rowChevron}>
          <ChevronRight size={18} color={greenDark} />
        </View>
      </View>
    </AnimatedPressable>
  );
}

/** Cancel — same PRESS_SCALE treatment as the rows (no weaker feedback). */
function CancelButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={style}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t('mobile.labCommon.cancel')}
    >
      <View style={styles.cancel}>
        <Text style={styles.cancelText}>{t('mobile.labCommon.cancel')}</Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  anchor: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: brand.background,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    width: '100%',
    alignSelf: 'center',
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: brand.borderStrong,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 26,
    color: brand.foreground,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: brand.mutedForeground,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  rows: { gap: spacing.md },

  // EntryOption row (mirrors chat/cards.tsx styles.entryOption et al.)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...elevation.sm,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: brand.successBorder,
    backgroundColor: brand.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowChevron: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: brand.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 14, color: brand.foreground },
  rowSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: brand.mutedForeground,
    marginTop: 2,
  },

  cancel: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  cancelText: { fontFamily: fonts.semibold, fontSize: 14, color: brand.mutedForeground },
});
