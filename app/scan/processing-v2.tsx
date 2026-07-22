import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import {
  AlertCircle,
  Bell,
  Check,
  FileText,
  RefreshCw,
  Sparkles,
  Timer,
} from 'lucide-react-native';

import { AppImage, Button, Screen, Stack } from '@/components/ui';
import { brand, fonts } from '@/constants/theme';
import { manualEntryDefaults } from '@/features/scanner/constants';
import { shouldSkipDetectionChoice } from '@/features/scanner/smartDetectionRouting';
import { shouldOfferBackground } from '@/features/scanner/backgroundAffordance';
import type {
  SmartStreamEvent,
  StagePhase,
} from '@/features/scanner/smartDetectStreamTypes';
import type { MappedSmartDetection } from '@/features/scanner/smartDetectionTypes';
import { useSmartDetect } from '@/features/scanner/useSmartDetect';
import { backgroundRecognitionEnabled, IS_CUSTOMER } from '@/lib/flags';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { useScanDraft, type Photo } from '@/stores/scanDraftStore';
import { useAuth } from '@/stores/authStore';
import { clearStoredJobId, storeJobId } from '@/stores/recognitionJobStore';
import {
  uploadGcsDocuments,
  uploadGcsPhotos,
  type GcsUploadedFile,
} from '@/services/scanner/uploadGcsPhotos';
import {
  createRecognitionJob,
  detachRecognitionJob,
  tailRecognitionJob,
  RecognitionJobStreamError,
} from '@/services/scanner/recognitionJobClient';
import { gcsUrlForAnalyze } from '@/services/scanner/gcsUrl';
import { getSiteType } from '@/services/scanner/buildFormData';

/**
 * Scan processing — v2 (SSE streaming).
 *
 * Routed to from `processing.tsx` when `smartDetectV2Enabled()`. Runs the same
 * smart-detect mutation (v2 transport) but renders a LIVE-streaming UI driven
 * by the SSE events: a phase timeline, a detection banner, and product cards
 * that fade in (with real thumbnails + estimated price) as each product is
 * extracted. Design follows the Stitch "AI Analysis in Progress" screen,
 * mapped to the app's brand tokens.
 *
 * On success it performs the IDENTICAL navigation as the v1 smart path (the
 * mapped result is byte-identical between v1 and v2).
 */

const EMERALD = '#10b981'; // AI / active accent (matches the rest of the scan flow)

// 5-phase timeline, mapped from the backend SSE `stage.phase` enum. Phase 2
// (office docs) renamed `preparing_pdfs` → `preparing_documents`; the backend
// still emits the legacy alias for ONE release. We normalize at receive-time
// (see `normalizePhase` below) so TIMELINE stays at 5 visible rows. Drop the
// alias from `normalizePhase` after the backend stops emitting it.
const TIMELINE: { phase: StagePhase; key: string; label: string }[] = [
  { phase: 'validating', key: 'validating', label: 'Validating' },
  { phase: 'preparing_documents', key: 'readingDocuments', label: 'Reading documents' },
  { phase: 'ai_running', key: 'uploadingDetecting', label: 'Uploading & detecting' },
  { phase: 'extracting_products', key: 'identifyingProducts', label: 'Identifying products' },
  { phase: 'done', key: 'done', label: 'Done' },
];
const PHASE_ORDER = TIMELINE.map((t) => t.phase);

/** Collapse the legacy `preparing_pdfs` alias to its canonical Phase 2 name
 *  so `PHASE_ORDER.indexOf()` finds a hit and the existing fixture test (which
 *  still emits `preparing_pdfs`) keeps passing. Remove after backend drops the
 *  alias (see `smartDetectI18n.js:32-37`). */
function normalizePhase(p: StagePhase): StagePhase {
  return p === 'preparing_pdfs' ? 'preparing_documents' : p;
}

const CONDITION_LABEL: Record<string, string> = {
  new: 'New',
  usedFunctional: 'Used',
  forParts: 'For parts',
  wasteDisposal: 'Waste',
  demolitionRemoval: 'Demolition',
};

type StreamProduct = {
  index: number;
  name: string;
  condition?: string;
  siteType?: string;
  grade?: string;
  price?: string;
  imageIndexes: number[];
};

function conditionLabel(c: unknown): string | undefined {
  const v = Array.isArray(c) ? c[0] : c;
  if (typeof v !== 'string' || !v) return undefined;
  return CONDITION_LABEL[v] ?? v;
}

function formatPrice(price: unknown, currency: unknown): string | undefined {
  if (price == null) return undefined;
  const n = Number(String(price).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const cur = typeof currency === 'string' && currency ? currency : 'USD';
  return cur === 'USD' ? `$${n.toLocaleString()}` : `${cur} ${n.toLocaleString()}`;
}

function mmss(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Small animated primitives ────────────────────────────────────────────────

function Shimmer({ style }: { style?: object }) {
  const v = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.4, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ backgroundColor: '#e3e7ee', borderRadius: 4, opacity: v }, style]} />;
}

function PulseDot() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  const ringScale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const ringOpacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  return (
    <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: EMERALD,
          transform: [{ scale: ringScale }],
          opacity: ringOpacity,
        }}
      />
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: EMERALD }} />
    </View>
  );
}

/** Mount fade-in-up wrapper — used as each product card streams in. */
function FadeInUp({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 480,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();
  }, [v]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return <Animated.View style={{ opacity: v, transform: [{ translateY }] }}>{children}</Animated.View>;
}

/** Progress bar whose fill width eases smoothly toward `progress` (0..1). */
function AnimatedBar({ progress }: { progress: number }) {
  const v = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: progress,
      duration: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress, v]);
  const width = v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={{ height: 8, borderRadius: 999, backgroundColor: '#e3e7ee', overflow: 'hidden' }}>
      <Animated.View style={{ height: '100%', width, borderRadius: 999, backgroundColor: EMERALD }} />
    </View>
  );
}

export default function ProcessingV2Screen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const draft = useScanDraft((s) => s.current);
  const smart = useSmartDetect();

  // ── Live stream state ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState<StagePhase>('validating');
  const [phaseMsg, setPhaseMsg] = useState<string>('');
  const [docInfo, setDocInfo] = useState<{ count: number; pages: number } | null>(null);
  const [pageUrls, setPageUrls] = useState<Record<number, string>>({});
  const [detection, setDetection] = useState<{ count: number; confidence: number; summary: string } | null>(null);
  const [products, setProducts] = useState<StreamProduct[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  // Per-file non-fatal rejections from the SSE `error` stream (e.g. one .docm
  // rejected mid-batch; the scan continues with the survivors). Banner stack
  // persists for the lifetime of the screen so the user sees what got dropped.
  // Backend already localizes `message` — we render it verbatim, prefixed with
  // `context.name` when present.
  const [nonFatalRejections, setNonFatalRejections] = useState<{
    name?: string;
    code: string;
    message: string;
    key: string;
  }[]>([]);

  const t0 = useRef(Date.now());
  const controllerRef = useRef<AbortController | null>(null);
  const startedForDraftRef = useRef<string | null>(null);

  // Task 10 — "Continue in background": flipped true the instant the seller
  // taps the affordance, BEFORE navigating away. Read by (1) the run-once
  // effect's unmount cleanup, to SKIP `controller.abort()` so the in-flight
  // stream is left running server-side (a later reattach can pick it up), and
  // (2) the mutation's onSuccess/onError below, so a late result from that
  // abandoned on-screen attempt can't hijack navigation after the seller left.
  const leftInBackgroundRef = useRef(false);

  // Follow-up #2 (transport-swap): when the flag is on, the on-screen scan runs
  // AS a foreground recognition job we tail. This holds its id so
  // `handleContinueInBackground` can `detach` the SAME job (persist its draft +
  // stop tailing) instead of starting a duplicate. Null until the job is created.
  const jobIdRef = useRef<string | null>(null);

  const phaseIndex = PHASE_ORDER.indexOf(phase);
  const productTotal = detection?.count;
  const stepNum = Math.min(phaseIndex + 1, TIMELINE.length);
  const progress = stepNum / TIMELINE.length;

  // Elapsed timer.
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - t0.current), 1000);
    return () => clearInterval(id);
  }, []);

  const onStreamEvent = useCallback((e: SmartStreamEvent) => {
    if (e.type === 'stage') {
      setPhase(normalizePhase(e.data.phase));
      if (e.data.message) setPhaseMsg(e.data.message);
    } else if (e.type === 'pdf_pages') {
      setDocInfo((prev) => ({
        count: (prev?.count ?? 0) + 1,
        pages: (prev?.pages ?? 0) + (e.data.pages?.length ?? 0),
      }));
      // Remember each extracted page's URL by its global image index, so
      // product cards that reference a PDF page can show its thumbnail.
      setPageUrls((prev) => {
        const next = { ...prev };
        for (const pg of e.data.pages ?? []) {
          if (typeof pg.index === 'number' && pg.url) next[pg.index] = pg.url;
        }
        return next;
      });
    } else if (e.type === 'detection') {
      setDetection({ count: e.data.product_count, confidence: e.data.confidence, summary: e.data.summary });
    } else if (e.type === 'product') {
      const d = (e.data.data ?? {}) as Record<string, unknown>;
      const failed = e.data.data == null;
      setProducts((prev) => {
        const next = prev.filter((p) => p.index !== e.data.index);
        next.push({
          index: e.data.index,
          name: failed
            ? t('mobile.processing.productFailed', "Couldn't read this item")
            : (d.name as string) || `Item ${e.data.index + 1}`,
          condition: conditionLabel(d.condition),
          siteType: typeof d.site_type === 'string' ? d.site_type : undefined,
          grade: typeof d.grade === 'string' ? d.grade : undefined,
          price: failed ? undefined : formatPrice(d.price, d.currency),
          imageIndexes: Array.isArray(e.data.image_indexes) ? e.data.image_indexes : [],
        });
        return next.sort((a, b) => a.index - b.index);
      });
    } else if (e.type === 'error' && !e.data.fatal) {
      // Phase 2 non-fatal rejections (`unsupported_document_format`,
      // `document_too_large`, `document_parse_failed`, `document_extraction_timeout`)
      // — one file got dropped, but the stream continues toward `result`.
      // Server already localized `message`; we render it directly.
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
      // TODO(telemetry): wire `scan_doc_rejected` event once the analytics
      // sink is confirmed (see SMART_DETECT_V2_OFFICE_DOCS_INTEGRATION_PLAN.md §7).
    }
    // pdf_fetch / gcs fatal errors: surfaced on the final result, not here.
  }, [t]);

  // Apply a mapped detection to the scan store + route — SHARED by both
  // transports (sync stream and foreground recognition job) so they behave
  // identically. Extracted verbatim from the old `smart.mutate` onSuccess. The
  // `leftInBackgroundRef` re-checks stop a late apply from yanking the seller
  // back after they tapped "Continue in background"; `clearStoredJobId()` on
  // success drops the stored id (the run finished on-screen — nothing to reattach).
  const applyMappedAndRoute = useCallback(
    async (mapped: MappedSmartDetection, basePhotos: Photo[]) => {
      if (leftInBackgroundRef.current) return;
      try {
        const augmentedPhotos =
          mapped.responseImageUrls.length > basePhotos.length
            ? [
                ...basePhotos,
                ...mapped.responseImageUrls.slice(basePhotos.length).map((url, i) => {
                  const docPage = mapped.documentPages.find(
                    (p) => p.url === url || p.index === basePhotos.length + i,
                  );
                  return {
                    uri: url,
                    width: docPage?.width ?? 0,
                    height: docPage?.height ?? 0,
                    sourceLabel: docPage?.sourceLabel,
                  };
                }),
              ]
            : basePhotos;
        const skip = shouldSkipDetectionChoice(mapped, augmentedPhotos.length);
        if (skip) {
          const m = await useScanDraft.getState().applySmartDetection(mapped, augmentedPhotos);
          if (leftInBackgroundRef.current) return;
          if (backgroundRecognitionEnabled()) clearStoredJobId();
          setIsNavigating(true);
          router.replace(m === 'single' ? routes.scanDetail : routes.scanGroupedReview);
        } else {
          if (augmentedPhotos.length > basePhotos.length) {
            await useScanDraft.getState().updatePhotos(augmentedPhotos);
          }
          if (leftInBackgroundRef.current) return;
          useScanDraft.getState().setPendingDetection(mapped);
          if (backgroundRecognitionEnabled()) clearStoredJobId();
          setIsNavigating(true);
          router.replace(routes.scanDetection);
        }
      } catch (err) {
        if (leftInBackgroundRef.current) return;
        haptics.error();
        setApplyError((err as Error)?.message ?? t('mobile.processing.errorFallback'));
      }
    },
    [t],
  );

  // Follow-up #2 — the FOREGROUND recognition-job transport (flag ON). Uploads
  // to GCS ONCE, creates the job as `foreground` (backend DEFERS its draft +
  // bell), stores its id, then tails it to drive the SAME on-screen progress
  // UI. "Continue in background" later just `detach`es this job + stops
  // tailing — no duplicate upload, no duplicate recognition. If the seller
  // backgrounds before the job exists, we promote it the moment it's created.
  // The upload is NOT tied to `signal` (the job must survive a background-leave
  // that aborts the tail); aborting the tail never kills the server-side job.
  const runViaRecognitionJob = useCallback(
    async (
      basePhotos: Photo[],
      documents: { uri: string; name: string; mimeType: string }[],
      signal: AbortSignal,
    ) => {
      try {
        const sellerId = useAuth.getState().profile?.id;
        if (!sellerId) {
          setApplyError(t('mobile.processing.errorFallback'));
          return;
        }
        let sessionId: string | undefined;
        let imageFiles: GcsUploadedFile[] = [];
        if (basePhotos.length > 0) {
          const r = await uploadGcsPhotos(basePhotos, { sellerId });
          sessionId = r.sessionId;
          imageFiles = r.files;
        }
        let documentFiles: GcsUploadedFile[] = [];
        if (documents.length > 0) {
          const r = await uploadGcsDocuments(documents, { sellerId, sessionId });
          documentFiles = r.files;
        }
        if (sessionId && imageFiles.length > 0) {
          const entries: Record<string, string> = {};
          for (let i = 0; i < basePhotos.length; i++) {
            const f = imageFiles[i];
            if (f) entries[basePhotos[i].uri] = f.objectName;
          }
          if (Object.keys(entries).length > 0) {
            useScanDraft.getState().mergeGcs(sessionId, entries);
          }
        }
        if (imageFiles.length === 0 && documentFiles.length === 0) {
          if (!leftInBackgroundRef.current) setApplyError(t('mobile.processing.errorFallback'));
          return;
        }

        const { job_id } = await createRecognitionJob({
          image_urls: imageFiles.map((f) => gcsUrlForAnalyze(f)),
          document_urls: documentFiles.map((f) => gcsUrlForAnalyze(f)),
          language: i18n.language,
          platform: getSiteType(),
          foreground: true,
        });
        jobIdRef.current = job_id;
        storeJobId(job_id);

        // Backgrounded before/while the job was created → promote it now (so its
        // draft persists) and skip tailing.
        if (leftInBackgroundRef.current) {
          void detachRecognitionJob(job_id).catch(() => {});
          return;
        }

        let mapped: MappedSmartDetection;
        try {
          mapped = await tailRecognitionJob(job_id, {
            signal,
            onEvent: (name, data) => onStreamEvent({ type: name, data } as SmartStreamEvent),
          });
        } catch (e) {
          const code = (e as RecognitionJobStreamError)?.code;
          if (code === 'cancelled' || signal.aborted || leftInBackgroundRef.current) return;
          throw e;
        }
        await applyMappedAndRoute(mapped, basePhotos);
      } catch (err) {
        if (leftInBackgroundRef.current || signal.aborted) return;
        haptics.error();
        setApplyError((err as Error)?.message ?? t('mobile.processing.errorFallback'));
        if (backgroundRecognitionEnabled()) clearStoredJobId();
      }
    },
    [applyMappedAndRoute, i18n.language, onStreamEvent, t],
  );

  // ── Run the mutation once per draft ─────────────────────────────────────────
  useEffect(() => {
    const draftId = draft?.id;
    if (isNavigating || !draftId) return;
    const photos = draft?.photos ?? [];
    const documents = draft?.documents ?? [];
    if (photos.length === 0 && documents.length === 0) {
      router.replace(routes.scanCamera);
      return;
    }
    if (draft?.ai) {
      router.replace(routes.scanDetail);
      return;
    }
    if (startedForDraftRef.current === draftId) return;
    startedForDraftRef.current = draftId;

    const controller = new AbortController();
    controllerRef.current = controller;
    setApplyError(null);

    if (backgroundRecognitionEnabled() && useAuth.getState().profile?.id) {
      // Follow-up #2 transport-swap: run the on-screen scan AS a foreground
      // recognition job and tail it. "Continue in background" then detaches +
      // stops tailing — the SAME job finishes server-side, no duplicate upload
      // or recognition. (Needs a seller to upload as; falls back to the sync
      // stream below when there's none — same guard as `useSmartDetect`.)
      void runViaRecognitionJob(photos, documents, controller.signal);
    } else {
      // Synchronous SSE stream — UNCHANGED. Used when the flag is off (the
      // default) or there's no seller profile to upload as.
      smart.mutate(
        {
          photos,
          documents,
          language: i18n.language,
          signal: controller.signal,
          onEvent: onStreamEvent,
        },
        {
          onSuccess: (mapped) => {
            // Late result from an attempt the seller abandoned for background is
            // ignored inside `applyMappedAndRoute` (leftInBackgroundRef guard).
            void applyMappedAndRoute(mapped, photos);
          },
          onError: (err) => {
            // Late failure of an attempt the seller already abandoned for
            // background — swallow it (no error UI, no state churn).
            if (leftInBackgroundRef.current) return;
            haptics.error();
            setApplyError((err as Error)?.message ?? null);
            if (backgroundRecognitionEnabled()) clearStoredJobId();
          },
        },
      );
    }

    return () => {
      // "Continue in background" aborts the tail itself (job survives); every
      // other unmount path aborts here. Aborting a foreground job's tail never
      // kills the server-side job, so this is always safe.
      if (!leftInBackgroundRef.current) {
        controller.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, draft?.ai, isNavigating]);

  const cancel = () => {
    controllerRef.current?.abort();
    router.replace(routes.scanCamera);
  };

  const retake = () => router.replace(routes.scanCamera);
  const skipToDetail = () => {
    useScanDraft.getState().patch({ ...manualEntryDefaults(), lastStep: 'detail' });
    router.replace(routes.scanDetail);
  };

  // Follow-up #2 — "Continue in background". The on-screen scan IS already a
  // foreground recognition job (`runViaRecognitionJob` created it + stored its
  // id), so this just: (1) flags the leave so a late tail result can't hijack
  // nav, (2) `detach`es the job → the backend now persists its pending-ai draft
  // + fires the bell on completion, (3) aborts the tail (the job keeps running
  // server-side), (4) navigates home. NO re-upload, NO duplicate job. If the
  // job id isn't ready yet (still uploading), `runViaRecognitionJob` sees
  // `leftInBackgroundRef` right after it creates the job and detaches there.
  const handleContinueInBackground = useCallback(() => {
    leftInBackgroundRef.current = true;
    toast.success(
      t('mobile.processing.leftToast', { defaultValue: "We'll notify you when it's ready" }),
    );
    const jobId = jobIdRef.current;
    if (jobId) {
      // Persist-on-completion (best-effort) + stop tailing now.
      void detachRecognitionJob(jobId).catch(() => {});
      controllerRef.current?.abort();
    }
    // Launched from the lab chat (launchSellerScan) in the customer fork, so
    // return to the lab home — the seller tab group scanHome (/(tabs)) points
    // at is disabled there. Mirrors app/scan/success.tsx.
    router.replace(IS_CUSTOMER ? '/(lab)/(tabs)/home' : routes.scanHome);
  }, [t]);

  // Resolve a product's thumbnail: the first local photo it references, else
  // the GCS URL of the first PDF page it references. Falls back to a sparkle.
  const thumbnailFor = useCallback(
    (p: StreamProduct): string | undefined => {
      const idx = p.imageIndexes[0];
      if (idx == null) return undefined;
      return draft?.photos?.[idx]?.uri ?? pageUrls[idx];
    },
    [draft?.photos, pageUrls],
  );

  const showError = (smart.isError && !isNavigating) || !!applyError;
  const errorMessage =
    applyError ?? (smart.error as Error | null)?.message ?? t('mobile.processing.errorFallback');

  const remainingSkeletons = useMemo(() => {
    if (productTotal == null) return phase === 'extracting_products' ? 1 : 0;
    return Math.max(0, Math.min(4, productTotal - products.length));
  }, [productTotal, products.length, phase]);

  // Offer "Continue in background" only while streaming (steps 1-4), before we
  // navigate to results, and only when the flag is on. Drives the sticky footer
  // action (see the footer below) — flag-off ⇒ footer shows just timer + Cancel.
  const offerBackground = shouldOfferBackground({
    flagEnabled: backgroundRecognitionEnabled(),
    phase,
    isNavigating,
  });

  if (!draft) return null;

  if (showError) {
    return (
      <Screen scroll={false} contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
        <View accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Stack gap="xl" style={{ marginTop: 24 }}>
            <View
              style={{
                backgroundColor: brand.warningBg,
                borderWidth: 1,
                borderColor: brand.warningBorder,
                borderRadius: 10,
                padding: 16,
                gap: 8,
              }}
            >
              <AlertCircle color={brand.warningText} size={22} />
              <Text style={{ fontFamily: fonts.heading, fontSize: 16, color: '#92400e' }}>
                {t('mobile.processing.errorTitle', "We couldn't analyze your items")}
              </Text>
              <Text style={{ fontFamily: fonts.regular, color: brand.warningText, fontSize: 13, lineHeight: 18 }}>
                {errorMessage}
              </Text>
            </View>
            <Button label={t('mobile.processing.retake')} onPress={retake} variant="secondary" fullWidth />
            <Button label={t('mobile.processing.continueWithoutAi')} onPress={skipToDetail} fullWidth />
          </Stack>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentContainerStyle={{ flex: 1, backgroundColor: brand.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: 12,
          // Clear the sticky footer — taller when the background action shows.
          paddingBottom: (offerBackground ? 190 : 96) + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Non-fatal rejection banners (Phase 2 — office docs rejected mid-stream). */}
        {nonFatalRejections.length > 0 && (
          <View style={{ marginBottom: 12, gap: 8 }}>
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
                  <Text
                    style={{ fontFamily: fonts.regular, fontSize: 13, color: '#7c2d12', lineHeight: 18 }}
                  >
                    {r.message}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* AI badge */}
        <View
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: 'rgba(16,185,129,0.10)',
            borderWidth: 1,
            borderColor: 'rgba(16,185,129,0.25)',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
          }}
        >
          <Sparkles size={13} color={EMERALD} />
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.5, color: '#0f9b6c' }}>
            {t('mobile.processingV2.aiAnalyzing', 'AI ANALYZING')}
          </Text>
        </View>

        <Text style={{ fontFamily: fonts.heading, fontSize: 28, color: brand.foreground, marginTop: 12 }}>
          {t('mobile.processing.heading', 'Analyzing your items')}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: brand.mutedForeground, marginTop: 2 }}>
          {t('mobile.processingV2.subtitle', 'Live results appear as we find them')}
        </Text>

        {/* Progress bar */}
        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.5, color: brand.mutedForeground }}>
              {t('mobile.processingV2.stepOf', {
                current: stepNum,
                total: TIMELINE.length,
                defaultValue: 'STEP {{current}} OF {{total}}',
              })}
            </Text>
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: brand.primary }}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
          <AnimatedBar progress={progress} />
        </View>

        {/* Document chip */}
        {docInfo ? (
          <View
            style={{
              marginTop: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: brand.surface,
              borderWidth: 1,
              borderColor: brand.border,
              borderRadius: 10,
              padding: 12,
            }}
          >
            <View style={{ padding: 6, borderRadius: 8, backgroundColor: '#f1f5f9' }}>
              <FileText size={18} color={brand.mutedForeground} />
            </View>
            <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: brand.foreground }}>
              {t('mobile.processingV2.documentsReady', {
                count: docInfo.count,
                pages: docInfo.pages,
                defaultValue:
                  docInfo.count === 1
                    ? 'Document ready · {{pages}} pages'
                    : '{{count}} documents ready · {{pages}} pages',
              })}
            </Text>
          </View>
        ) : null}

        {/* Phase timeline */}
        <View style={{ marginTop: 24, paddingLeft: 4, borderLeftWidth: 2, borderLeftColor: '#e3e7ee' }}>
          {TIMELINE.map((row, i) => {
            const done = phaseIndex > i;
            const current = phaseIndex === i;
            const productSub =
              current && row.phase === 'extracting_products' && productTotal
                ? t('mobile.processingV2.analyzingCount', {
                    current: Math.min(products.length + 1, productTotal),
                    total: productTotal,
                    defaultValue: 'Analyzing {{current}} of {{total}}…',
                  })
                : null;
            return (
              <View key={row.phase} style={{ paddingLeft: 22, marginBottom: i === TIMELINE.length - 1 ? 0 : 22 }}>
                {/* dot */}
                <View style={{ position: 'absolute', left: done ? -17 : -11, top: done ? 0 : 4 }}>
                  {done ? (
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: EMERALD,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 3,
                        borderColor: brand.background,
                      }}
                    >
                      <Check size={14} color="#fff" strokeWidth={3.5} />
                    </View>
                  ) : current ? (
                    <PulseDot />
                  ) : (
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#c4c9d2' }} />
                  )}
                </View>
                <Text
                  style={{
                    fontFamily: current ? fonts.semibold : fonts.regular,
                    fontSize: 15,
                    color: current ? brand.foreground : done ? brand.mutedForeground : '#9aa1ad',
                    textDecorationLine: done ? 'line-through' : 'none',
                  }}
                >
                  {t(`mobile.processingV2.phase.${row.key}`, row.label)}
                </Text>
                {current && (phaseMsg || productSub) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <RefreshCw size={12} color={EMERALD} />
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: EMERALD }}>
                      {productSub ?? phaseMsg}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* "Continue in background" moved OUT of the scroll flow into the
            sticky footer action bar below (it drifted here as products
            streamed in, and read as a bare link). */}

        {/* Detection banner */}
        {detection ? (
          <FadeInUp>
            <View
              style={{
                marginTop: 24,
                backgroundColor: brand.successBg,
                borderWidth: 1,
                borderColor: brand.successBorder,
                borderRadius: 10,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Sparkles size={18} color={EMERALD} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: brand.foreground }}>
                  {t('mobile.processingV2.foundCount', {
                    count: detection.count,
                    defaultValue: `Found ${detection.count} ${detection.count === 1 ? 'item' : 'items'}`,
                  })}
                </Text>
                {detection.summary ? (
                  <Text
                    numberOfLines={2}
                    style={{ fontFamily: fonts.regular, fontSize: 13, color: brand.mutedForeground, marginTop: 2 }}
                  >
                    {detection.summary}
                  </Text>
                ) : null}
              </View>
              {/* Prominent confidence */}
              <View style={{ alignItems: 'center', minWidth: 52 }}>
                <Text style={{ fontFamily: fonts.heading, fontSize: 22, color: EMERALD, lineHeight: 24 }}>
                  {Math.round(detection.confidence * 100)}%
                </Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 8, letterSpacing: 0.5, color: brand.mutedForeground }}>
                  {t('mobile.processingV2.confident', 'CONFIDENT')}
                </Text>
              </View>
            </View>
          </FadeInUp>
        ) : null}

        {/* Live product list */}
        {(products.length > 0 || remainingSkeletons > 0) ? (
          <View style={{ marginTop: 24 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: brand.border,
                paddingBottom: 8,
                marginBottom: 12,
              }}
            >
              <Text style={{ fontFamily: fonts.headingSemibold, fontSize: 18, color: brand.foreground }}>
                {t('mobile.processingV2.productsFound', 'Products found')}
              </Text>
              {productTotal != null ? (
                <View
                  style={{
                    backgroundColor: '#f1f5f9',
                    borderWidth: 1,
                    borderColor: brand.border,
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: brand.mutedForeground }}>
                    {products.length} / {productTotal}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={{ gap: 12 }}>
              {products.map((p) => {
                const uri = thumbnailFor(p);
                return (
                  <FadeInUp key={p.index}>
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: 12,
                        backgroundColor: brand.surface,
                        borderWidth: 1,
                        borderColor: brand.border,
                        borderRadius: 10,
                        padding: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 8,
                          overflow: 'hidden',
                          backgroundColor: '#f1f5f9',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {uri ? (
                          <AppImage source={{ uri }} style={{ width: 64, height: 64 }} contentFit="cover" />
                        ) : (
                          <Sparkles size={20} color={EMERALD} />
                        )}
                      </View>
                      <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Text
                          numberOfLines={2}
                          style={{ fontFamily: fonts.semibold, fontSize: 14, color: brand.foreground, lineHeight: 18 }}
                        >
                          {p.name}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6, alignItems: 'center' }}>
                          {[p.condition, p.siteType, p.grade ? `Grade ${p.grade}` : undefined]
                            .filter(Boolean)
                            .map((chip, ci) => (
                              <View
                                key={ci}
                                style={{
                                  backgroundColor: '#f1f5f9',
                                  borderWidth: 1,
                                  borderColor: brand.border,
                                  borderRadius: 4,
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                }}
                              >
                                <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: brand.foreground }}>
                                  {chip}
                                </Text>
                              </View>
                            ))}
                          {p.price ? (
                            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: brand.primaryDim, marginLeft: 'auto' }}>
                              {t('mobile.processingV2.est', { price: p.price, defaultValue: `Est. ${p.price}` })}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </FadeInUp>
                );
              })}

              {/* Skeletons for products still being analyzed */}
              {Array.from({ length: remainingSkeletons }).map((_, i) => (
                <View
                  key={`sk-${i}`}
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    backgroundColor: brand.surface,
                    borderWidth: 1,
                    borderColor: brand.border,
                    borderStyle: 'dashed',
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <Shimmer style={{ width: 64, height: 64, borderRadius: 8 }} />
                  <View style={{ flex: 1, justifyContent: 'center', gap: 8 }}>
                    <Shimmer style={{ height: 14, width: '75%' }} />
                    <Shimmer style={{ height: 10, width: '45%' }} />
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <Shimmer style={{ height: 14, width: 36 }} />
                      <Shimmer style={{ height: 14, width: 48 }} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer — sticky action bar. The "Continue in background" escape is the
          prominent (but not pushy) affordance here; Cancel stays a quiet
          destructive text; the timer + provenance drop to a muted meta row. */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 20,
          paddingTop: 14,
          // Lift above the Android nav bar / home indicator.
          paddingBottom: insets.bottom + 12,
          backgroundColor: brand.surface,
          borderTopWidth: 1,
          borderTopColor: brand.border,
          gap: 12,
        }}
      >
        {offerBackground ? (
          <View style={{ gap: 6 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mobile.processing.continueInBackground', {
                defaultValue: 'Continue in background',
              })}
              accessibilityHint={t('mobile.processing.backgroundHint', {
                defaultValue: "Keep using the app — we'll notify you when it's ready.",
              })}
              onPress={handleContinueInBackground}
              // Emerald-tinted outline ties the action to this screen's AI accent
              // (progress bar / checks / detection), reading as "let the AI keep
              // working" rather than a generic CTA.
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderWidth: 1,
                borderColor: 'rgba(16,185,129,0.35)',
                backgroundColor: 'rgba(16,185,129,0.08)',
                borderRadius: 10,
                paddingVertical: 13,
              }}
            >
              <Bell size={16} color={EMERALD} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: '#0f9b6c' }}>
                {t('mobile.processing.continueInBackground', {
                  defaultValue: 'Continue in background',
                })}
              </Text>
            </Pressable>
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 12,
                lineHeight: 16,
                color: brand.mutedForeground,
                textAlign: 'center',
              }}
            >
              {t('mobile.processing.backgroundHint', {
                defaultValue: "Keep using the app — we'll notify you when it's ready.",
              })}
            </Text>
          </View>
        ) : null}

        {/* Meta row — timer + provenance (muted) · Cancel (quiet destructive). */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Timer size={12} color={brand.mutedForeground} />
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: brand.mutedForeground }}>
              {mmss(elapsed)}
            </Text>
            <Text style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.8, color: brand.placeholder }}>
              · GREENBIDZ VISION AI
            </Text>
          </View>
          <Pressable
            onPress={cancel}
            accessibilityRole="button"
            hitSlop={8}
            style={{ paddingHorizontal: 10, paddingVertical: 6 }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: brand.destructive }}>
              {t('common.cancel', 'Cancel')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
