import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { AlertCircle, Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppImage, Button, Screen, Stack } from '@/components/ui';
import { manualEntryDefaults } from '@/features/scanner/constants';
import { routes } from '@/lib/routes';
import { SMART_DETECT_ENABLED } from '@/lib/flags';
import { useAnalyzeImages } from '@/features/scanner/useAnalyzeImages';
import { useSmartDetect } from '@/features/scanner/useSmartDetect';
import { shouldSkipDetectionChoice } from '@/features/scanner/smartDetectionRouting';
import { haptics } from '@/lib/haptics';
import { useScanDraft } from '@/stores/scanDraftStore';
import { brand, fonts } from '@/constants/theme';

/**
 * S6.2.b2.ii — StyleSheet.create dissolved. The processing screen has many
 * one-off ornamental styles (laser sweep, telemetry rings, gradient pills,
 * step-row states with shadows) that don't compose into className cleanly.
 * Strategy: className for layout/colors that map; inline `style={{...}}` for
 * the rest. Shared values pulled to `const` objects at top.
 */
const checkCircleBase = {
  width: 22,
  height: 22,
  borderRadius: 11,
  marginRight: 8,
};

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
  const [applyError, setApplyError] = useState<string | null>(null);

  const subStatuses = [
    t('mobile.processing.subStatus_detect'),
    t('mobile.processing.subStatus_ocr'),
    t('mobile.processing.subStatus_specs', 'Looking up model specs…'),
    t('mobile.processing.subStatus_draft'),
  ];

  const laserSweepVal = useMemo(() => new Animated.Value(0), []);
  const checkScale1 = useMemo(() => new Animated.Value(0), []);
  const checkScale2 = useMemo(() => new Animated.Value(0), []);
  const checkScale3 = useMemo(() => new Animated.Value(0), []);
  const checkScale4 = useMemo(() => new Animated.Value(0), []);

  const rowEntrance1 = useMemo(() => new Animated.Value(0), []);
  const rowEntrance2 = useMemo(() => new Animated.Value(0), []);
  const rowEntrance3 = useMemo(() => new Animated.Value(0), []);
  const rowEntrance4 = useMemo(() => new Animated.Value(0), []);

  const activeDotOpacity = useMemo(() => new Animated.Value(0.4), []);
  const bgPulse = useMemo(() => new Animated.Value(0), []);

  const useSmart = SMART_DETECT_ENABLED && mode === 'single';
  const isPending = useSmart ? smart.isPending : analyze.isPending;
  const isSuccess = useSmart ? smart.isSuccess : analyze.isSuccess;

  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isPending) return;

    if (reducedMotion) {
      rowEntrance1.setValue(1);
      rowEntrance2.setValue(1);
      rowEntrance3.setValue(1);
      rowEntrance4.setValue(1);
      activeDotOpacity.setValue(1);
      bgPulse.setValue(0);
      return;
    }

    rowEntrance1.setValue(0);
    rowEntrance2.setValue(0);
    rowEntrance3.setValue(0);
    rowEntrance4.setValue(0);
    activeDotOpacity.setValue(0.4);
    bgPulse.setValue(0);

    Animated.stagger(150, [
      Animated.timing(rowEntrance1, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(rowEntrance2, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(rowEntrance3, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(rowEntrance4, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    const activeDotAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(activeDotOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(activeDotOpacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ]),
    );
    activeDotAnim.start();

    const bgPulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(bgPulse, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(bgPulse, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ]),
    );
    bgPulseAnim.start();

    return () => {
      activeDotAnim.stop();
      bgPulseAnim.stop();
    };
  }, [isPending, reducedMotion, rowEntrance1, rowEntrance2, rowEntrance3, rowEntrance4, activeDotOpacity, bgPulse]);

  useEffect(() => {
    if (!isPending) return;
    if (reducedMotion) {
      laserSweepVal.setValue(0);
      return;
    }

    const laserLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(laserSweepVal, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(laserSweepVal, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    );
    laserLoop.start();

    return () => {
      laserLoop.stop();
    };
  }, [isPending, reducedMotion, laserSweepVal]);

  // Themed step walk — driven by a plain mount timer, NOT the mutation state.
  // The loader is on screen from mount until navigation, but `isPending`
  // doesn't span that window cleanly (it's false pre-mutation and can flip
  // false during the async onSuccess work), which left the indicator frozen on
  // step 1. So we advance on our own cadence and cap at the last step, leaving
  // it "active" until the screen navigates away. Real completion (all four
  // checks) is claimed in the success effect below.
  useEffect(() => {
    const checkScales = [checkScale1, checkScale2, checkScale3, checkScale4];
    const complete = (val: Animated.Value) => {
      if (reducedMotion) {
        val.setValue(1);
        return;
      }
      Animated.spring(val, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }).start();
    };

    const MAX_PENDING_STEP = 3;
    let step = 0;
    const interval = setInterval(() => {
      if (step >= MAX_PENDING_STEP) {
        clearInterval(interval);
        return;
      }
      // The active step just "completed" — pop its checkmark so the now-
      // completed row actually shows a check (its scale is otherwise 0).
      complete(checkScales[step]);
      step += 1;
      setCurrentStep(step);
    }, 1800);

    return () => clearInterval(interval);
  }, [reducedMotion, checkScale1, checkScale2, checkScale3, checkScale4]);

  // On a real result, fill in every check and mark the final step done just
  // before the screen navigates away.
  useEffect(() => {
    if (!isSuccess) return;
    [checkScale1, checkScale2, checkScale3, checkScale4].forEach((s) => s.setValue(1));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentStep(4);
  }, [isSuccess, checkScale1, checkScale2, checkScale3, checkScale4]);

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
      smartRef.current.mutate(
        { photos, language: langRef.current, signal: controller.signal },
        {
          onSuccess: async (mapped) => {
            try {
              const skip = shouldSkipDetectionChoice(mapped, photos.length);
              if (skip) {
                const mode = await useScanDraft
                  .getState()
                  .applySmartDetection(mapped, photos);
                setApplyError(null);
                setIsNavigating(true);
                router.replace(
                  mode === 'single' ? routes.scanDetail : routes.scanGroupedReview,
                );
              } else {
                useScanDraft.getState().setPendingDetection(mapped);
                setApplyError(null);
                setIsNavigating(true);
                router.replace(routes.scanDetection);
              }
            } catch (err) {
              haptics.error();
              setApplyError(
                (err as Error)?.message ?? t('mobile.processing.errorFallback'),
              );
            }
          },
          onError: () => {
            haptics.error();
            setApplyError(null);
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
              brand:        ai.brand ?? '',
              model:        ai.model ?? '',
              year:         ai.year ?? '',
              weight:       ai.weight ?? '',
              dimensions:   ai.dimensions ?? '',
              co2Emissions: ai.co2Emissions ?? '',
              grade:        ai.grade ?? 'A',
              // W2 (scan_v3): only override marketplace when the AI gave a
              // recognized value. Null/undefined means "AI said nothing
              // useful" — preserve whatever marketplace is already on the
              // draft (env default from emptyDraft).
              ...(ai.suggestedMarketplace ? { marketplace: ai.suggestedMarketplace } : {}),
              // ProfitIntelligenceCard tier prices. Only patch when the AI
              // returned them — null would clobber a prior value if the user
              // navigated back into a finished draft.
              ...(ai.prices ? { aiPrices: ai.prices } : {}),
              ...(ai.locations && ai.locations.length > 0
                ? {
                    locations: ai.locations,
                    locationCountries: ai.locations.map(() => ai.country ?? ''),
                  }
                : {}),
              lastStep: 'detail',
            });
            router.replace(routes.scanDetail);
          },
          onError: () => {
            haptics.error();
            setApplyError(null);
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

  const laserTranslateX = laserSweepVal.interpolate({
    inputRange: [0, 1],
    outputRange: [-45, 305],
  });

  const rowY1 = rowEntrance1.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const rowY2 = rowEntrance2.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const rowY3 = rowEntrance3.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const rowY4 = rowEntrance4.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  const bgPulseScale = bgPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.04],
  });

  const mutationError = useSmart ? smart.error : analyze.error;
  const showError = (useSmart ? smart.isError : analyze.isError) || !!applyError;
  const errorMessage =
    applyError ??
    (mutationError as Error | null)?.message ??
    t('mobile.processing.errorFallback');

  if (!draft) return null;

  // Single "AI working" surface. The animated loader below is the only
  // working-state UI — we no longer flash a second static "AI working" screen
  // before the mutation kicks in. It covers pre-mutation, in-flight, and the
  // post-success navigating frame. Errors get their own layout (no fake
  // working chrome); any other state is a transient pre-nav frame → null.
  const showLoader = isPending || isNavigating || (!draft.ai && !showError);

  if (showLoader) {
    const stepsData = [
      { id: 0, label: subStatuses[0], scale: checkScale1, opacity: rowEntrance1, translateY: rowY1 },
      { id: 1, label: subStatuses[1], scale: checkScale2, opacity: rowEntrance2, translateY: rowY2 },
      { id: 2, label: subStatuses[2], scale: checkScale3, opacity: rowEntrance3, translateY: rowY3 },
      { id: 3, label: subStatuses[3], scale: checkScale4, opacity: rowEntrance4, translateY: rowY4 },
    ];

    return (
      <Screen
        scroll={false}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: brand.background,
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: -1,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
          pointerEvents="none"
        >
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 1.5,
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 1.5,
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
            }}
          />
          {[
            { w: 320, h: 320 },
            { w: 480, h: 480 },
            { w: 640, h: 640 },
          ].map((d, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                width: d.w,
                height: d.h,
                borderRadius: 9999,
                borderWidth: 1.5,
                borderColor: 'rgba(16, 185, 129, 0.08)',
                transform: [{ scale: bgPulseScale }],
              }}
            />
          ))}
        </View>

        <View
          className="flex-row items-center"
          style={{
            backgroundColor: '#ff9800',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            gap: 4,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 10 }}>✨</Text>
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 10,
              color: '#ffffff',
              letterSpacing: 0.4,
            }}
          >
            {t('mobile.processing.aiWorking')}
          </Text>
        </View>

        <Text
          className="text-center"
          style={{
            fontFamily: fonts.heading,
            fontSize: 26,
            color: brand.foreground,
            marginBottom: 4,
          }}
        >
          {t('mobile.processing.heading')}
        </Text>
        <Text
          className="text-center"
          style={{
            fontFamily: fonts.regular,
            fontSize: 13,
            color: brand.mutedForeground,
            marginBottom: 28,
          }}
        >
          {t('mobile.processing.timeEstimate')}
        </Text>

        <View
          className="self-center"
          style={{ width: '100%', maxWidth: 290, gap: 10, marginBottom: 24 }}
        >
          {stepsData.map((step) => {
            const isCompleted = currentStep > step.id;
            const isActive = currentStep === step.id;

            const stepBg = isCompleted
              ? 'rgba(255, 255, 255, 0.95)'
              : isActive
              ? '#ffffff'
              : 'rgba(255, 255, 255, 0.4)';
            const stepBorder = isCompleted ? '#e2e8f0' : isActive ? '#10b981' : '#f1f5f9';
            const stepShadow = isActive
              ? {
                  shadowColor: '#10b981',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 10,
                  elevation: 3,
                }
              : isCompleted
              ? {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.02,
                  shadowRadius: 4,
                  elevation: 1,
                }
              : null;

            return (
              <Animated.View
                key={step.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  position: 'relative',
                  overflow: 'hidden',
                  borderWidth: 1.5,
                  backgroundColor: stepBg,
                  borderColor: stepBorder,
                  ...(stepShadow ?? {}),
                  opacity: step.opacity,
                  transform: [{ translateY: step.translateY }],
                }}
              >
                {isCompleted ? (
                  <Animated.View
                    style={{
                      ...checkCircleBase,
                      backgroundColor: '#10b981',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: [{ scale: step.scale }],
                    }}
                  >
                    <Check size={12} color="#ffffff" strokeWidth={3.5} />
                  </Animated.View>
                ) : isActive ? (
                  <View
                    style={{
                      ...checkCircleBase,
                      borderWidth: 2.5,
                      borderColor: '#10b981',
                      backgroundColor: 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Animated.View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#10b981',
                        opacity: activeDotOpacity,
                      }}
                    />
                  </View>
                ) : (
                  <View
                    style={{
                      ...checkCircleBase,
                      borderWidth: 2,
                      borderColor: '#cbd5e1',
                      backgroundColor: 'transparent',
                    }}
                  />
                )}

                <Text
                  style={{
                    fontFamily: fonts.semibold,
                    fontSize: 14,
                    flex: 1,
                    color: isCompleted ? '#64748b' : isActive ? '#0f172a' : '#94a3b8',
                  }}
                >
                  {step.label}
                </Text>

                {isActive && (
                  <Animated.View
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: 40,
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      borderRightWidth: 2,
                      borderRightColor: '#10b981',
                      transform: [{ translateX: laserTranslateX }],
                    }}
                  />
                )}
              </Animated.View>
            );
          })}
        </View>

        {slowMsg ? (
          <Text
            className="text-center"
            style={{
              fontFamily: fonts.regular,
              fontSize: 13,
              color: brand.warning,
              marginTop: 10,
            }}
          >
            {t('mobile.processing.slow')}
          </Text>
        ) : null}
      </Screen>
    );
  }

  if (showError) {
    return (
      <Screen scroll={false} contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
        <ScrollView
          horizontal
          style={{ marginTop: 24, maxHeight: 100 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {draft.photos.map((p) => (
            <AppImage
              key={p.uri}
              source={{ uri: p.uri }}
              style={{ width: 80, height: 80, borderRadius: 8, opacity: 0.5 }}
            />
          ))}
        </ScrollView>

        <View accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Stack gap="xl" style={{ marginTop: 24 }}>
            <View
              style={{
                backgroundColor: brand.warningBg,
                borderWidth: 1,
                borderColor: brand.warningBorder,
                borderRadius: 10,
                padding: 16,
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <View
                className="items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#fef3c7',
                }}
              >
                <AlertCircle color={brand.warningText} size={22} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#92400e' }}>
                {t('mobile.processing.errorTitle', "We couldn't read your photos")}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  color: brand.warningText,
                  fontSize: 13,
                  lineHeight: 18,
                }}
              >
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
        </View>
      </Screen>
    );
  }

  return null;
}
