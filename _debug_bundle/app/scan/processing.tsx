import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppImage, Button, Screen, Stack } from '@/components/ui';
import { manualEntryDefaults } from '@/features/scanner/constants';
import { routes } from '@/lib/routes';
import { SMART_DETECT_ENABLED } from '@/lib/flags';
import { useAnalyzeImages } from '@/features/scanner/useAnalyzeImages';
import { useSmartDetect } from '@/features/scanner/useSmartDetect';
import { useScanDraft } from '@/stores/scanDraftStore';
import { colors, fonts, fontSize, letterSpacing, radius, spacing } from '@/theme';

export default function ProcessingScreen() {
  const { t, i18n } = useTranslation();
  const draft = useScanDraft((s) => s.current);
  const mode = useScanDraft((s) => s.mode);
  const setAi = useScanDraft((s) => s.setAi);
  const patch = useScanDraft((s) => s.patch);
  const analyze = useAnalyzeImages();
  const smart = useSmartDetect();
  const [slowMsg, setSlowMsg] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  // Surfaced when smart-detection succeeds but the result can't be applied to
  // the store (e.g. no products with valid photos) — shown via the error block.
  const [applyError, setApplyError] = useState<string | null>(null);

  const subStatuses = [
    t('mobile.processing.subStatus_detect'),
    t('mobile.processing.subStatus_ocr'),
    t('mobile.processing.subStatus_specs', 'Looking up model specs…'),
    t('mobile.processing.subStatus_draft'),
  ];

  // Animated values for Step-Check Laser Loader
  const laserSweepVal = useMemo(() => new Animated.Value(0), []);
  const checkScale1 = useMemo(() => new Animated.Value(0), []);
  const checkScale2 = useMemo(() => new Animated.Value(0), []);
  const checkScale3 = useMemo(() => new Animated.Value(0), []);
  const checkScale4 = useMemo(() => new Animated.Value(0), []);

  // Entrance slide-in values
  const rowEntrance1 = useMemo(() => new Animated.Value(0), []);
  const rowEntrance2 = useMemo(() => new Animated.Value(0), []);
  const rowEntrance3 = useMemo(() => new Animated.Value(0), []);
  const rowEntrance4 = useMemo(() => new Animated.Value(0), []);

  // Active breathing indicator values
  const activeDotOpacity = useMemo(() => new Animated.Value(0.4), []);
  const bgPulse = useMemo(() => new Animated.Value(0), []);

  // Smart-detection runs only for a fresh single-mode session. Manual grouped
  // (mode set to 'grouped' up front via listing-method) keeps the per-item
  // single-product analyze — running smart-detect on one manually-queued item
  // would be incoherent, and its photos already belong to a known item.
  const useSmart = SMART_DETECT_ENABLED && mode === 'single';
  const isPending = useSmart ? smart.isPending : analyze.isPending;

  // Staggered entrance, pulsing dot, and background telemetry animations
  useEffect(() => {
    if (!isPending) return;

    rowEntrance1.setValue(0);
    rowEntrance2.setValue(0);
    rowEntrance3.setValue(0);
    rowEntrance4.setValue(0);
    activeDotOpacity.setValue(0.4);
    bgPulse.setValue(0);

    // Staggered row slide-in
    Animated.stagger(150, [
      Animated.timing(rowEntrance1, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(rowEntrance2, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(rowEntrance3, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(rowEntrance4, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Loop active dot breathing
    const activeDotAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(activeDotOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(activeDotOpacity, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    activeDotAnim.start();

    // Loop telemetry background ring pulse
    const bgPulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(bgPulse, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(bgPulse, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    );
    bgPulseAnim.start();

    return () => {
      activeDotAnim.stop();
      bgPulseAnim.stop();
    };
  }, [isPending, rowEntrance1, rowEntrance2, rowEntrance3, rowEntrance4, activeDotOpacity, bgPulse]);

  // Continuous laser sweep loop across active card width
  useEffect(() => {
    if (!isPending) return;

    const laserLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(laserSweepVal, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(laserSweepVal, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    laserLoop.start();

    return () => {
      laserLoop.stop();
    };
  }, [isPending, laserSweepVal]);

  // Staggered timer sequence to transition steps and trigger checkmark spring pops
  useEffect(() => {
    if (!isPending) return;

    checkScale1.setValue(0);
    checkScale2.setValue(0);
    checkScale3.setValue(0);
    checkScale4.setValue(0);

    const triggerStepCompletion = (
      checkScale: Animated.Value,
      nextStepIndex: number
    ) => {
      // Pop checkmark with spring bounce
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }).start(() => {
        // Move to next step
        setCurrentStep(nextStepIndex);
      });
    };

    // Staggered timers matching the 5-10s extraction period
    const t1 = setTimeout(() => {
      triggerStepCompletion(checkScale1, 1);
    }, 2000);

    const t2 = setTimeout(() => {
      triggerStepCompletion(checkScale2, 2);
    }, 4200);

    const t3 = setTimeout(() => {
      triggerStepCompletion(checkScale3, 3);
    }, 6400);

    const t4 = setTimeout(() => {
      Animated.spring(checkScale4, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }, 8500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [isPending, checkScale1, checkScale2, checkScale3, checkScale4]);

  // Stash unstable refs so the analyze effect can stay keyed on draft.id only.
  const analyzeRef = useRef(analyze);
  const smartRef = useRef(smart);
  const setAiRef = useRef(setAi);
  const patchRef = useRef(patch);
  const langRef = useRef(i18n.language);
  useEffect(() => {
    analyzeRef.current = analyze;
    smartRef.current = smart;
    setAiRef.current = setAi;
    patchRef.current = patch;
    langRef.current = i18n.language;
  }, [analyze, smart, setAi, patch, i18n.language]);

  const startedForDraftRef = useRef<string | null>(null);

  useEffect(() => {
    const draftId = draft?.id;
    // Once we've kicked off navigation, stop. This also covers the smart grouped
    // path, which clears `current` (→ draft null) before routing to grouped
    // review — without this guard the null draft would bounce us to the camera.
    if (isNavigating) return;
    if (!draft?.photos?.length) {
      router.replace(routes.scanCamera);
      return;
    }
    if (draft.ai) {
      router.replace(routes.scanDetail);
      return;
    }
    if (!draftId || startedForDraftRef.current === draftId) return;
    startedForDraftRef.current = draftId;

    const controller = new AbortController();
    const slowTimer = setTimeout(() => setSlowMsg(true), 30_000);
    const photos = draft.photos;
    setApplyError(null);

    if (useSmart) {
      // Smart-detection: AI decides single vs multiple. Apply the mapped result
      // to the store, then route by mode (single → Detail, multiple → Item
      // Review). All store hydration lives in applySmartDetection.
      smartRef.current.mutate(
        { photos, language: langRef.current, signal: controller.signal },
        {
          onSuccess: async (mapped) => {
            try {
              const mode = await useScanDraft.getState().applySmartDetection(mapped, photos);
              setApplyError(null);
              setIsNavigating(true);
              router.replace(
                mode === 'single' ? routes.scanDetail : routes.scanGroupedReview,
              );
            } catch (err) {
              // Mapped result couldn't be applied (e.g. no valid photos) — show
              // the error block and let the user retake / continue manually.
              setApplyError(
                (err as Error)?.message ?? t('mobile.processing.errorFallback'),
              );
              startedForDraftRef.current = null;
            }
          },
          onError: () => {
            setApplyError(null);
            startedForDraftRef.current = null;
          },
        },
      );
    } else {
      analyzeRef.current.mutate(
        { photos, language: langRef.current, signal: controller.signal },
        {
          onSuccess: (ai) => {
            setIsNavigating(true);
            setAiRef.current(ai);
            patchRef.current({
              title: ai.name,
              description: ai.description,
              condition: ai.condition,
              operationStatus: ai.operationStatus,
              pricePerUnit: ai.suggestedPrice ?? '',
              priceCurrency: ai.currency,
              priceFormat: ai.suggestedPrice ? 'buyNow' : 'offer',
              lastStep: 'detail',
            });
            router.replace(routes.scanDetail);
          },
          onError: () => {
            setApplyError(null);
            startedForDraftRef.current = null;
          },
        },
      );
    }

    return () => {
      controller.abort();
      clearTimeout(slowTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, draft?.photos, draft?.ai, isNavigating]);

  const skipToDetail = () => {
    patch({ ...manualEntryDefaults(), lastStep: 'detail' });
    router.replace(routes.scanDetail);
  };

  const retake = () => router.replace(routes.scanCamera);

  // Interpolate laser horizontal sweep position
  const laserTranslateX = laserSweepVal.interpolate({
    inputRange: [0, 1],
    outputRange: [-45, 305],
  });

  // Entrance translations
  const rowY1 = rowEntrance1.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const rowY2 = rowEntrance2.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const rowY3 = rowEntrance3.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const rowY4 = rowEntrance4.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  // Telemetry grid ring scaling
  const bgPulseScale = bgPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.04],
  });

  // Surface failures from whichever path ran, plus apply-layer failures.
  const mutationError = useSmart ? smart.error : analyze.error;
  const showError = (useSmart ? smart.isError : analyze.isError) || !!applyError;
  const errorMessage =
    applyError ??
    (mutationError as Error | null)?.message ??
    t('mobile.processing.errorFallback');

  // Smart grouped apply clears `current` before navigation — render the loader
  // first so we don't flash a blank frame while `isNavigating` is true.
  if (isPending || isNavigating) {
    const stepsData = [
      { id: 0, label: subStatuses[0], scale: checkScale1, opacity: rowEntrance1, translateY: rowY1 },
      { id: 1, label: subStatuses[1], scale: checkScale2, opacity: rowEntrance2, translateY: rowY2 },
      { id: 2, label: subStatuses[2], scale: checkScale3, opacity: rowEntrance3, translateY: rowY3 },
      { id: 3, label: subStatuses[3], scale: checkScale4, opacity: rowEntrance4, translateY: rowY4 },
    ];

    return (
      <Screen scroll={false} contentContainerStyle={styles.centerBody}>
        {/* Immersive Background Telemetry Grid */}
        <View style={styles.bgScanner} pointerEvents="none">
          <View style={styles.bgCrosshairH} />
          <View style={styles.bgCrosshairV} />
          <Animated.View style={[styles.bgRing, styles.bgRingSmall, { transform: [{ scale: bgPulseScale }] }]} />
          <Animated.View style={[styles.bgRing, styles.bgRingMedium, { transform: [{ scale: bgPulseScale }] }]} />
          <Animated.View style={[styles.bgRing, styles.bgRingLarge, { transform: [{ scale: bgPulseScale }] }]} />
        </View>

        {/* Centered AI Working Pill */}
        <View style={styles.centerAiPill}>
          <Text style={styles.centerAiPillIcon}>✨</Text>
          <Text style={styles.centerAiPillText}>{t('mobile.processing.aiWorking')}</Text>
        </View>

        {/* Centered Titles */}
        <Text style={styles.centerTitle}>{t('mobile.processing.heading')}</Text>
        <Text style={styles.centerSubtitle}>5–10 seconds</Text>

        {/* Staged Checklist Container */}
        <View style={styles.checklistContainer}>
          {stepsData.map((step, idx) => {
            const isCompleted = currentStep > step.id;
            const isActive = currentStep === step.id;

            return (
              <Animated.View
                key={step.id}
                style={[
                  styles.stepRow,
                  isCompleted
                    ? styles.stepRowCompleted
                    : isActive
                    ? styles.stepRowActive
                    : styles.stepRowPending,
                  {
                    opacity: step.opacity,
                    transform: [{ translateY: step.translateY }],
                  },
                ]}
              >
                {/* Left Circle Checkbox */}
                {isCompleted ? (
                  <Animated.View
                    style={[
                      styles.checkCircleCompleted,
                      { transform: [{ scale: step.scale }] },
                    ]}
                  >
                    <Check size={12} color="#ffffff" strokeWidth={3.5} />
                  </Animated.View>
                ) : isActive ? (
                  <View style={styles.checkCircleActive}>
                    <Animated.View
                      style={[
                        styles.checkCircleActiveDot,
                        { opacity: activeDotOpacity },
                      ]}
                    />
                  </View>
                ) : (
                  <View style={styles.checkCirclePending} />
                )}

                {/* Right Step Label */}
                <Text
                  style={[
                    styles.stepLabel,
                    isCompleted
                      ? styles.stepLabelCompleted
                      : isActive
                      ? styles.stepLabelActive
                      : styles.stepLabelPending,
                  ]}
                >
                  {step.label}
                </Text>

                {/* Laser Sweep Line Overlay (rendered LAST so it sits on top) */}
                {isActive && (
                  <Animated.View
                    style={[
                      styles.laserSweep,
                      {
                        transform: [{ translateX: laserTranslateX }],
                      },
                    ]}
                  />
                )}
              </Animated.View>
            );
          })}
        </View>

        {slowMsg ? <Text style={styles.slow}>{t('mobile.processing.slow')}</Text> : null}
      </Screen>
    );
  }

  if (!draft) return null;

  return (
    <Screen scroll={false} contentContainerStyle={styles.body}>
      {/* AI WORKING pill — page-specific styling stays inline */}
      <View style={styles.aiPill}>
        <Text style={styles.aiPillIcon}>✨</Text>
        <Text style={styles.aiPillText}>{t('mobile.processing.aiWorking')}</Text>
      </View>

      <Text style={styles.title}>{t('mobile.processing.heading')}</Text>
      <Text style={styles.subtitle}>{t('mobile.processing.subtitle')}</Text>

      <ScrollView horizontal style={styles.thumbs} contentContainerStyle={styles.thumbRow}>
        {draft.photos.map((p) => (
          <AppImage key={p.uri} source={{ uri: p.uri }} style={[styles.thumb, styles.thumbDim]} />
        ))}
      </ScrollView>

      {showError ? (
        <Stack gap="xl" style={styles.errorBox}>
          <View style={styles.errorCard}>
            <View style={styles.errorIconWrap}>
              <AlertCircle color={colors.warningText} size={22} />
            </View>
            <Text style={styles.errorTitle}>
              {t('mobile.processing.errorTitle', "We couldn't read your photos")}
            </Text>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
          <Button
            label={t('mobile.processing.retake')}
            onPress={retake}
            variant="secondary"
            fullWidth
          />
          <Button
            label={t('mobile.processing.continueWithoutAi')}
            onPress={skipToDetail}
            fullWidth
          />
        </Stack>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing['6xl'], flexGrow: 1 },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySurface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: spacing.xs,
    marginBottom: spacing['3xl'],
  },
  aiPillIcon: { fontSize: fontSize.sm },
  aiPillText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: colors.primaryDim,
    letterSpacing: letterSpacing.capsLoose,
  },
  title: { fontFamily: fonts.heading, fontSize: fontSize['7xl'], color: colors.foreground },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  slow: {
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    color: colors.warning,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  thumbs: { marginTop: spacing['6xl'], maxHeight: 100 },
  thumbRow: { gap: spacing.md },
  thumb: { width: 80, height: 80, borderRadius: radius.md },
  thumbDim: { opacity: 0.5 },
  centerBody: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['6xl'],
    backgroundColor: colors.background,
  },
  centerAiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff9800',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  centerAiPillIcon: {
    fontSize: fontSize.xs,
  },
  centerAiPillText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: '#ffffff',
    letterSpacing: letterSpacing.capsLoose,
  },
  centerTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSize['7xl'],
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  centerSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing['7xl'],
  },
  checklistContainer: {
    width: '100%',
    maxWidth: 290,
    alignSelf: 'center',
    gap: spacing.lg,
    marginBottom: spacing['6xl'],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  stepRowPending: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderColor: '#f1f5f9',
  },
  stepRowActive: {
    backgroundColor: '#ffffff',
    borderColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  stepRowCompleted: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  laserSweep: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRightWidth: 2,
    borderRightColor: '#10b981',
  },
  checkCirclePending: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    marginRight: spacing.md,
    backgroundColor: 'transparent',
  },
  checkCircleActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    borderColor: '#10b981',
    marginRight: spacing.md,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  checkCircleCompleted: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stepLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    flex: 1,
  },
  stepLabelPending: {
    color: '#94a3b8',
  },
  stepLabelActive: {
    color: '#0f172a',
  },
  stepLabelCompleted: {
    color: '#64748b',
    textDecorationLine: 'none',
  },
  bgScanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bgCrosshairH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  bgCrosshairV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  bgRing: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.08)',
  },
  bgRingSmall: {
    width: 320,
    height: 320,
  },
  bgRingMedium: {
    width: 480,
    height: 480,
  },
  bgRingLarge: {
    width: 640,
    height: 640,
  },
  errorBox: { marginTop: spacing['6xl'] },
  errorCard: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: radius.xl,
    padding: spacing['3xl'],
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  errorIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xl,
    color: '#92400e',
  },
  errorText: {
    fontFamily: fonts.regular,
    color: colors.warningText,
    fontSize: fontSize.base,
    lineHeight: 18,
  },
});
