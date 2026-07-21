import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import RNAnimated, {
  Easing as RNEasing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AlertCircle, Check, Cog } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { AppImage, Button, Screen, Stack } from '@/components/ui';
import { manualEntryDefaults } from '@/features/scanner/constants';
import { routes } from '@/lib/routes';
import { SMART_DETECT_ENABLED, backgroundRecognitionEnabled, IS_CUSTOMER } from '@/lib/flags';
import { useAnalyzeImages } from '@/features/scanner/useAnalyzeImages';
import { useSmartDetect } from '@/features/scanner/useSmartDetect';
import { smartDetectV2Enabled } from '@/features/scanner/smartDetectV2Enabled';
import { startBackgroundRecognition } from '@/features/scanner/backgroundRecognition';
import type {
  SmartStreamEvent,
  StagePhase,
} from '@/features/scanner/smartDetectStreamTypes';
import { shouldSkipDetectionChoice } from '@/features/scanner/smartDetectionRouting';
import { haptics } from '@/lib/haptics';
import { useScanDraft } from '@/stores/scanDraftStore';
import { useAuth } from '@/stores/authStore';
import { clearStoredJobId } from '@/stores/recognitionJobStore';
import {
  uploadGcsDocuments,
  uploadGcsPhotos,
  type GcsUploadedFile,
} from '@/services/scanner/uploadGcsPhotos';
import { gcsUrlForAnalyze } from '@/services/scanner/gcsUrl';
import { getSiteType } from '@/services/scanner/buildFormData';
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

// Maps the backend's 5-phase SSE enum onto the existing 4 step rows. Static —
// module scope so it isn't a churning effect dependency.
// Phase 2 (office docs): `preparing_documents` is the canonical name, replacing
// `preparing_pdfs` (kept as a deprecated alias for one release). Both map to
// the same step. Remove `preparing_pdfs` after the backend drops emitting it.
const PHASE_TO_STEP: Record<StagePhase, number> = {
  validating: 0,
  preparing_documents: 0,
  preparing_pdfs: 0,
  ai_running: 1,
  extracting_products: 2,
  done: 3,
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
  // Scanner frame gear — rotates continuously. Driven by reanimated (not RN's
  // legacy Animated) because RN Web's Animated.timing + useNativeDriver path
  // intermittently failed to apply the rotate transform; reanimated produces
  // a real CSS animation on web and a native worklet on iOS/Android.
  const gearAngle = useSharedValue(0);

  const useSmart = SMART_DETECT_ENABLED && mode === 'single';
  const isPending = useSmart ? smart.isPending : analyze.isPending;
  const isSuccess = useSmart ? smart.isSuccess : analyze.isSuccess;

  // v2 SSE path drives the step indicator from REAL stream events instead of
  // the fake mount timer below. Only when the smart path is active AND the v2
  // flag/platform predicate says so.
  const useV2Stream = useSmart && smartDetectV2Enabled();
  const [streamPhase, setStreamPhase] = useState<StagePhase | undefined>();
  const [productProgress, setProductProgress] = useState<{ done: number; total?: number }>({
    done: 0,
  });

  // Per-file non-fatal rejections from the SSE `error` stream (Phase 2 office
  // docs). The flag-off fallback rarely runs (v2 redirects v1 before mutating),
  // but we keep parity so a future SMART_DETECT_V2_ENABLED=0 cohort still gets
  // useful feedback. Backend already localizes `message` — render directly.
  const [nonFatalRejections, setNonFatalRejections] = useState<{
    name?: string;
    code: string;
    message: string;
    key: string;
  }[]>([]);

  // SSE progress sink (passed into the v2 mutation). Heartbeats never reach
  // here (the transport consumes them for its watchdog), so this only fires on
  // real progress. Pure state updates — safe to call from the transport.
  const handleStreamEvent = useCallback((e: SmartStreamEvent) => {
    if (e.type === 'stage') {
      // Collapse the legacy `preparing_pdfs` alias to canonical `preparing_documents`
      // so this fallback path stays consistent with `processing-v2.tsx`. Safe today
      // (PHASE_TO_STEP maps both keys to step 0) but better for any future code
      // that branches on streamPhase. Drop the conditional once backend stops
      // emitting the alias.
      const phase: StagePhase =
        e.data.phase === 'preparing_pdfs' ? 'preparing_documents' : e.data.phase;
      setStreamPhase(phase);
    } else if (e.type === 'detection') {
      setProductProgress({ done: 0, total: e.data.product_count });
    } else if (e.type === 'product') {
      setProductProgress((p) => ({ ...p, done: p.done + 1 }));
    } else if (e.type === 'error' && !e.data.fatal) {
      const ctx = e.data.context as { name?: string } | undefined;
      setNonFatalRejections((prev) => [
        ...prev,
        {
          name: ctx?.name,
          code: e.data.code,
          message: e.data.message,
          key: `${e.data.code}-${prev.length}`,
        },
      ]);
      // TODO(telemetry): scan_doc_rejected — see plan §7.
    }
    // pdf_pages / fatal error: no step change in this pass.
  }, []);

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

  // Gear spin — reanimated `withRepeat` runs as a CSS animation on web and a
  // worklet on native, both of which actually drive the transform (the
  // legacy RN Animated.timing + useNativeDriver path was silently dropping
  // the transform on RN Web). Started once on mount; `withRepeat(-1)`
  // keeps it spinning until unmount.
  //
  // We deliberately IGNORE `prefers-reduced-motion` for this animation:
  // the gear is a loading indicator (the same exception spec'd for spinners
  // and progress bars in WCAG 2.3.3), not decorative parallax. Other
  // animations on this screen (active-dot pulse, row entrance) still honour
  // the preference.
  useEffect(() => {
    gearAngle.value = 0;
    gearAngle.value = withRepeat(
      withTiming(360, { duration: 4000, easing: RNEasing.linear }),
      -1,
      false,
    );
  }, [gearAngle]);

  const gearAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${gearAngle.value}deg` }],
  }));

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
    // v2 drives steps from real SSE events (effect below) — skip the fake walk.
    if (useV2Stream) return;
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
  }, [useV2Stream, reducedMotion, checkScale1, checkScale2, checkScale3, checkScale4]);

  // v2: advance the step indicator from real stream phases, and pop the
  // checkmarks for every step the backend has already passed. Steps only
  // advance on real events — no timer — so the screen reflects truth. The
  // active row keeps its pulse/laser animation (and an "Analyzing…" sub-label
  // for the extracting step) so it never looks frozen between sparse events.
  useEffect(() => {
    if (!useV2Stream || streamPhase == null) return;
    const step = PHASE_TO_STEP[streamPhase];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentStep(step);
    const checkScales = [checkScale1, checkScale2, checkScale3, checkScale4];
    for (let i = 0; i < step; i++) checkScales[i].setValue(1);
  }, [useV2Stream, streamPhase, checkScale1, checkScale2, checkScale3, checkScale4]);

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

  // Task 10 — "Continue in background": set true the instant the seller taps
  // the affordance, BEFORE navigating away. Read by (1) this effect's unmount
  // cleanup, to skip `controller.abort()` (the in-flight request is left
  // running rather than cancelled — it may still land a usable draft even
  // though nobody's watching), and (2) both mutate() onSuccess/onError
  // callbacks below, so a late-arriving result from that abandoned request
  // can't hijack navigation after the seller has already left this screen.
  const leftInBackgroundRef = useRef(false);

  useEffect(() => {
    const draftId = draft?.id;
    if (isNavigating) return;
    // Allow either photos OR documents to bring the seller here. Backend
    // smart-detect can analyze PDFs by extracting page-images; a docs-only
    // scan is a valid path. Bounce only when literally nothing was picked.
    const photoCount = draft?.photos?.length ?? 0;
    const docCount = draft?.documents?.length ?? 0;
    if (photoCount === 0 && docCount === 0) {
      router.replace(routes.scanCamera);
      return;
    }
    if (draft?.ai) {
      router.replace(routes.scanDetail);
      return;
    }
    // v2 streaming has its own screen (richer live UI). Hand off BEFORE starting
    // the mutation here so it isn't run twice. Catches every entry point —
    // camera / reorder-photos / scan-resume all land on this screen first.
    if (useV2Stream) {
      router.replace(routes.scanProcessingV2);
      return;
    }
    if (!draftId || startedForDraftRef.current === draftId) return;
    startedForDraftRef.current = draftId;

    const controller = new AbortController();
    const slowTimer = setTimeout(() => setSlowMsg(true), 30_000);
    const photos = draft.photos;
    const documents = draft.documents;
    setApplyError(null);

    if (useSmart) {
      smartRef.current.mutate(
        {
          photos,
          documents,
          language: langRef.current,
          signal: controller.signal,
          // v2 only — the hook ignores this on the v1 path. Stable (useCallback).
          onEvent: handleStreamEvent,
        },
        {
          onSuccess: async (mapped) => {
            // Seller already left for background — this result belongs to an
            // abandoned on-screen attempt; ignore it (don't navigate, don't
            // patch state). The stored job id from the background kickoff is
            // what Task 11 reattaches to, not this stale result. NOTE: this
            // callback `await`s below (applySmartDetection/updatePhotos), so
            // the seller can tap "Continue in background" AFTER this check
            // passes but BEFORE we navigate — hence the re-check immediately
            // before each `router.replace` further down, not just here.
            if (leftInBackgroundRef.current) return;
            try {
              // Augment the local photos array with any PDF-derived page
              // images the backend extracted (`mapped.responseImageUrls`
              // > `photos.length` ⇒ the extras are page-images sourced
              // from the seller's PDFs). Without this, product
              // `image_indexes` referencing PDF pages can't be resolved
              // to local files and `validateMappedDetection` throws
              // "No photos to apply smart detection to" on a docs-only
              // scan. The synthetic Photos use the GCS page-image URL
              // as their `uri` — AppImage handles http/file uniformly.
              const augmentedPhotos =
                mapped.responseImageUrls.length > photos.length
                  ? [
                      ...photos,
                      ...mapped.responseImageUrls.slice(photos.length).map((url, i) => {
                        const docPage = mapped.documentPages.find(
                          (p) => p.url === url || p.index === photos.length + i,
                        );
                        return {
                          uri: url,
                          width: docPage?.width ?? 0,
                          height: docPage?.height ?? 0,
                          // P4 — thread office-doc origin label so PhotosCard /
                          // detection thumbnails can show "sheet 仁義廠" etc.
                          sourceLabel: docPage?.sourceLabel,
                        };
                      }),
                    ]
                  : photos;
              const skip = shouldSkipDetectionChoice(mapped, augmentedPhotos.length);
              if (skip) {
                const mode = await useScanDraft
                  .getState()
                  .applySmartDetection(mapped, augmentedPhotos);
                // Re-check: the seller may have tapped "Continue in
                // background" while the `await` above was in flight — that
                // handler already toasted + navigated Home. Don't yank them
                // back into the sync flow now that they've left.
                if (leftInBackgroundRef.current) return;
                if (backgroundRecognitionEnabled()) clearStoredJobId();
                setApplyError(null);
                setIsNavigating(true);
                router.replace(
                  mode === 'single' ? routes.scanDetail : routes.scanGroupedReview,
                );
              } else {
                // Stash the augmented photos on the draft so the
                // detection screen can read them — it uses `draft.photos`
                // / `pendingPhotos` to render thumbnails per product.
                if (augmentedPhotos.length > photos.length) {
                  await useScanDraft.getState().updatePhotos(augmentedPhotos);
                }
                // Re-check for the same reason as the `skip` branch above.
                if (leftInBackgroundRef.current) return;
                useScanDraft.getState().setPendingDetection(mapped);
                if (backgroundRecognitionEnabled()) clearStoredJobId();
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
            if (leftInBackgroundRef.current) return;
            haptics.error();
            setApplyError(null);
            if (backgroundRecognitionEnabled()) clearStoredJobId();
          },
        },
      );
    } else {
      analyzeRef.current.mutate(
        { photos, language: langRef.current, signal: controller.signal },
        {
          onSuccess: (ai) => {
            if (leftInBackgroundRef.current) return;
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
              // Marketplace is LOCKED to this deployment's site (web parity:
              // `lockedMarketplace = marketplaceFromSiteType(SITE_TYPE)`). This
              // build is 101lab-only, so we never let the AI's detected
              // site_type flip the marketplace — the draft keeps its env
              // default from emptyDraft.
              // ProfitIntelligenceCard tier prices. Only patch when the AI
              // returned them — null would clobber a prior value if the user
              // navigated back into a finished draft.
              ...(ai.prices ? { aiPrices: ai.prices } : {}),
              // Category — single-product analyze path was previously dropping
              // the AI's `product_cat` / `subcategory` ids, so the detail-form
              // bridge had nothing to map to the seller's locale tree. Patch
              // only when AI returned a non-empty id; the locale bridge does
              // the rest. Empty values would clobber a prior user pick.
              ...(ai.categoryId
                ? { categoryId: ai.categoryId, categoryName: ai.categoryName ?? null }
                : {}),
              ...(ai.locations && ai.locations.length > 0
                ? {
                    locations: ai.locations,
                    locationCountries: ai.locations.map(() => ai.country ?? ''),
                  }
                : {}),
              lastStep: 'detail',
            });
            // Re-check for consistency with the useSmart branch above — this
            // callback has no `await` today (so this can't actually differ
            // from the check at the top), but mirrors the same
            // immediately-before-navigate guard defensively in case that
            // ever changes.
            if (leftInBackgroundRef.current) return;
            if (backgroundRecognitionEnabled()) clearStoredJobId();
            router.replace(routes.scanDetail);
          },
          onError: () => {
            if (leftInBackgroundRef.current) return;
            haptics.error();
            setApplyError(null);
            if (backgroundRecognitionEnabled()) clearStoredJobId();
          },
        },
      );
    }

    return () => {
      // Task 10: "Continue in background" leaves the in-flight request
      // running instead of cancelling it — see `leftInBackgroundRef` above.
      if (!leftInBackgroundRef.current) {
        controller.abort();
      }
      clearTimeout(slowTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, draft?.photos, draft?.ai, isNavigating]);

  const skipToDetail = () => {
    patch({ ...manualEntryDefaults(), lastStep: 'detail' });
    router.replace(routes.scanDetail);
  };

  const retake = () => router.replace(routes.scanCamera);

  // Task 10 — "Continue in background". Toasts + navigates Home immediately
  // (the seller shouldn't wait), then best-effort mints a server-side
  // recognition job from the same photos/documents so Task 11's reattach
  // flow has a job id to poll. Deliberately uses its OWN upload (no shared
  // AbortSignal with `controller` above, no reuse of `useSmartDetect`'s
  // internal upload) so it can't be cancelled by this screen's unmount —
  // see the brief: reuse the same GCS helpers `useSmartDetect` uses, don't
  // refactor that hook. The in-flight on-screen request (if any) is left
  // running but its result is now ignored (`leftInBackgroundRef` guards in
  // both mutate() onSuccess/onError above) — a known duplicate-upload/
  // duplicate-recognition tradeoff of not restructuring the main effect to
  // route through the background job from the start; see task-10-report.md.
  const handleContinueInBackground = useCallback(() => {
    leftInBackgroundRef.current = true;
    toast.success(
      t('mobile.processing.leftToast', { defaultValue: "We'll notify you when it's ready" }),
    );
    // Launched from the lab chat (launchSellerScan) in the customer fork, so
    // return to the lab home — the seller tab group scanHome (/(tabs)) points
    // at is disabled there. Mirrors app/scan/success.tsx.
    router.replace(IS_CUSTOMER ? '/(lab)/(tabs)/home' : routes.scanHome);

    void (async () => {
      try {
        const sellerId = useAuth.getState().profile?.id;
        if (!sellerId) return; // no auth context — nothing to upload/create with
        const photos = draft?.photos ?? [];
        const documents = draft?.documents ?? [];
        if (photos.length === 0 && documents.length === 0) return;

        let sessionId: string | undefined;
        let imageFiles: GcsUploadedFile[] = [];
        if (photos.length > 0) {
          const r = await uploadGcsPhotos(photos, { sellerId });
          sessionId = r.sessionId;
          imageFiles = r.files;
        }
        let documentFiles: GcsUploadedFile[] = [];
        if (documents.length > 0) {
          const r = await uploadGcsDocuments(documents, { sellerId, sessionId });
          documentFiles = r.files;
        }

        await startBackgroundRecognition({
          image_urls: imageFiles.map((f) => gcsUrlForAnalyze(f)),
          document_urls: documentFiles.map((f) => gcsUrlForAnalyze(f)),
          language: langRef.current,
          platform: getSiteType(),
        });
      } catch (err) {
        // Best-effort — the seller has already left this screen; there's
        // nothing left on-screen to show an error on. Worst case Task 11
        // finds no job to reattach to and the seller re-scans.
        if (__DEV__) {
          console.warn('[processing] background recognition job failed to start', err);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.photos, draft?.documents]);

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
    // v2: append a live "k/N" to the extracting-products step once detection
    // has reported a product count. Falls back to the plain label otherwise.
    const extractingLabel =
      useV2Stream && productProgress.total
        ? `${subStatuses[2]} ${productProgress.done}/${productProgress.total}`
        : subStatuses[2];

    const stepsData = [
      { id: 0, label: subStatuses[0], scale: checkScale1, opacity: rowEntrance1, translateY: rowY1 },
      { id: 1, label: subStatuses[1], scale: checkScale2, opacity: rowEntrance2, translateY: rowY2 },
      { id: 2, label: extractingLabel, scale: checkScale3, opacity: rowEntrance3, translateY: rowY3 },
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
        {/* Non-fatal Phase 2 rejection banners — floats over the centered
            loader so the user sees which files got dropped without shifting
            the animation. Rarely visible (v2 redirects this screen before
            mutating; only the SMART_DETECT_V2_ENABLED=0 cohort hits this). */}
        {nonFatalRejections.length > 0 && (
          <View
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              right: 16,
              gap: 8,
              zIndex: 10,
            }}
            pointerEvents="box-none"
          >
            {nonFatalRejections.map((r) => (
              <View
                key={r.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                  backgroundColor: '#fef3c7',
                  borderWidth: 1,
                  borderColor: '#fbbf24',
                  borderRadius: 8,
                  padding: 10,
                }}
                accessibilityRole="alert"
                accessibilityLabel={r.name ? `${r.name}: ${r.message}` : r.message}
              >
                <AlertCircle size={16} color="#92400e" style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  {r.name ? (
                    <Text
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 11,
                        color: '#92400e',
                        marginBottom: 2,
                      }}
                      numberOfLines={1}
                    >
                      {r.name}
                    </Text>
                  ) : null}
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: '#7c2d12', lineHeight: 18 }}>
                    {r.message}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

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
            marginBottom: 20,
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

        {/* Scanner frame — square with corner brackets + a rotating gear at
            the center. Mirrors the Stitch "AI Processing Insights" focal
            element. Hidden when the device prefers reduced motion (the gear
            spin would be visual noise). The corner brackets are 4 small
            absolute Views; cheaper than rendering an SVG and adapts to any
            container size. */}
        <View
          style={{
            width: 140,
            height: 140,
            marginBottom: 24,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Backdrop chip behind the gear — barely-there fill so the corner
              brackets feel like they're framing something. */}
          <View
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              bottom: 12,
              backgroundColor: 'rgba(148, 163, 184, 0.10)',
              borderRadius: 12,
            }}
          />
          {/* Four corner brackets. */}
          {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => {
            const isTop = corner.startsWith('t');
            const isLeft = corner.endsWith('l');
            return (
              <View
                key={corner}
                style={{
                  position: 'absolute',
                  width: 20,
                  height: 20,
                  borderColor: '#94a3b8',
                  ...(isTop ? { top: 0, borderTopWidth: 2.5 } : { bottom: 0, borderBottomWidth: 2.5 }),
                  ...(isLeft ? { left: 0, borderLeftWidth: 2.5 } : { right: 0, borderRightWidth: 2.5 }),
                  borderTopLeftRadius: isTop && isLeft ? 4 : 0,
                  borderTopRightRadius: isTop && !isLeft ? 4 : 0,
                  borderBottomLeftRadius: !isTop && isLeft ? 4 : 0,
                  borderBottomRightRadius: !isTop && !isLeft ? 4 : 0,
                }}
              />
            );
          })}
          {/* Reanimated wrapper — drives the rotate transform via a worklet
              on native and a CSS animation on web. Works in both. */}
          <RNAnimated.View style={gearAnimatedStyle}>
            <Cog size={72} color="#94a3b8" strokeWidth={1.5} />
          </RNAnimated.View>
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

        {backgroundRecognitionEnabled() && (
          <Pressable
            accessibilityRole="button"
            onPress={handleContinueInBackground}
            hitSlop={8}
            style={{ marginBottom: 12 }}
          >
            <Text
              className="text-center"
              style={{
                fontFamily: fonts.semibold,
                fontSize: 14,
                color: brand.primary,
              }}
            >
              {t('mobile.processing.continueInBackground', {
                defaultValue: 'Continue in background',
              })}
            </Text>
          </Pressable>
        )}

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

        {/* Powered-by footer — pinned to the bottom of the screen via
            absolute positioning so the rest of the loader stays centered
            regardless of how tall the device viewport is. */}
        <Text
          className="text-center"
          style={{
            position: 'absolute',
            bottom: 24,
            left: 24,
            right: 24,
            fontFamily: fonts.regular,
            fontSize: 10,
            letterSpacing: 1.2,
            color: '#94a3b8',
            textTransform: 'uppercase',
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {t('mobile.processing.poweredBy', {
            defaultValue: 'Powered by GreenBidz Industrial Vision AI v4.2',
          })}
        </Text>
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
