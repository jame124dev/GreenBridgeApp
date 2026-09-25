import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { Bell, FileText, Sparkles, Timer } from 'lucide-react-native';

/*
  v2 KIT. This is the screen a scan actually lands on — `processing.tsx`
  redirects here whenever `EXPO_PUBLIC_SMART_DETECT_V2=1`, which is the default
  — so it is the one that has to read as the redesign.

  Presentation only: every hook, effect, mutation, SSE handler and
  `router.replace` below is untouched.

  `Screen` and `Text` deliberately shadow the old-kit exports of the same name.
  The four local helpers this file grew — `Shimmer`, `PulseDot`, `FadeInUp`,
  `AnimatedBar` — are replaced by the kit's `Shimmer`, `Timeline`'s own active
  dot, `EnterOnMount` and `ProgressLine`.
*/
import {
  Chip,
  EnterOnMount,
  Hairline,
  PrimaryAction,
  ProgressLine,
  QuietAction,
  Row,
  RowThumb,
  Screen,
  SectionHeader,
  SectionNote,
  Shimmer,
  SoftPanel,
  Text,
  Timeline,
  type TimelineStep,
} from '@/features/v2/ui';
import { GUTTER, icon, radius, space, useV2Colors } from '@/theme/v2';
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
import { homeRoute } from '@/features/v2/routing/postAuthLanding';
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

// `ACCENT` (a fork-aware `brand.primary` / `#10b981`) is gone — the accent is
// `c.accent` from the palette now, which flips with the colour scheme.

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

/*
  ── FOUR LOCAL PRIMITIVES DELETED ──────────────────────────────────────────

  `Shimmer`, `PulseDot`, `FadeInUp` and `AnimatedBar` were ~80 lines of
  hand-rolled `Animated` built here because the kit was not in reach when this
  screen was written. All four now come from `@/features/v2/ui`:

    Shimmer      → `Shimmer`        (same job, theme-aware, honours Reduce Motion)
    AnimatedBar  → `ProgressLine`
    FadeInUp     → `EnterOnMount`
    PulseDot     → `Timeline` draws its own active dot

  None of them honoured Reduce Motion, and all four hard-coded `#e3e7ee` or
  `ACCENT` — so they were invisible on a dark ground.
*/

export default function ProcessingV2Screen() {
  const c = useV2Colors();
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
  // Bumped by `retry()` to re-arm the run-once effect on the SAME photos after a
  // (often transient) failure — so a network blip doesn't force a re-shoot.
  const [retryNonce, setRetryNonce] = useState(0);
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

  /** Past the last phase — the timeline stops pulsing. */
  const settled = phaseIndex >= TIMELINE.length - 1;

  /*
    The timeline's rows. `detail` is a sub-line `Timeline` shows only while its
    step is the ACTIVE one, which is where the live "Analyzing 3 of 7…" and the
    server's own phase message belong — the old rows rendered that sub-line
    themselves, per row, with a spinning icon beside it.
  */
  const timelineSteps: readonly TimelineStep[] = TIMELINE.map((row) => {
    const productSub =
      row.phase === 'extracting_products' && productTotal
        ? t('mobile.processingV2.analyzingCount', {
            current: Math.min(products.length + 1, productTotal),
            total: productTotal,
            defaultValue: 'Analyzing {{current}} of {{total}}…',
          })
        : null;
    return {
      label: t(`mobile.processingV2.phase.${row.key}`, row.label),
      detail: productSub ?? phaseMsg ?? undefined,
    };
  });

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
          // if/else, not a ternary — see the TS2590 note in `detection.tsx`.
          if (m === 'single') {
            router.replace(routes.scanDetail);
          } else {
            router.replace(routes.scanGroupedReview);
          }
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
  }, [draft?.id, draft?.ai, isNavigating, retryNonce]);

  const cancel = () => {
    controllerRef.current?.abort();
    router.replace(routes.scanCamera);
  };

  // Re-run the AI on the SAME photos after a failure. Reset the stream state +
  // the once-guard so the timeline restarts clean, clear the mutation error,
  // then bump the nonce to re-fire the run-once effect.
  const retry = () => {
    haptics.tap();
    controllerRef.current?.abort();
    setApplyError(null);
    setPhase('validating');
    setPhaseMsg('');
    setDetection(null);
    setProducts([]);
    setDocInfo(null);
    setPageUrls({});
    setNonFatalRejections([]);
    smart.reset();
    startedForDraftRef.current = null;
    setRetryNonce((n) => n + 1);
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
    // `homeRoute()` — v2's "Scan it" pushes into THIS old scan flow, so a
    // hardcoded legacy home here ejects a v2 seller the moment their scan
    // finishes. Identical to before when the v2 flag is off.
    // if/else, not a ternary — see the TS2590 note in `detection.tsx`.
    if (IS_CUSTOMER) {
      router.replace(homeRoute());
    } else {
      router.replace(routes.scanHome);
    }
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
      <Screen scroll={false} tabBar={false} testID="scan-processing-v2-error">
        <View style={styles.errorPage}>
          <View accessibilityLiveRegion="polite" style={styles.errorBody}>
            <Text variant="h3">
              {t('mobile.processing.errorTitle', "We couldn't analyze your items")}
            </Text>
            <SectionNote tone="danger">{errorMessage}</SectionNote>
          </View>

          {/*
            THREE full-width buttons of equal weight was three primary actions.
            "Try again" is the one that resumes what the seller asked for, so it
            is the only filled pill; the other two are quiet alternatives.
          */}
          <View style={styles.errorActions}>
            <PrimaryAction
              label={t('mobile.processing.tryAgain', { defaultValue: 'Try again' })}
              onPress={retry}
            />
            <QuietAction label={t('mobile.processing.continueWithoutAi')} onPress={skipToDetail} />
            <QuietAction label={t('mobile.processing.retake')} onPress={retake} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} tabBar={false} testID="scan-processing-v2">
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          // Clear the sticky footer — taller when the background action shows.
          { paddingBottom: (offerBackground ? 190 : 96) + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Non-fatal rejection banners (Phase 2 — office docs rejected mid-stream). */}
        {nonFatalRejections.map((r) => (
          <SectionNote key={r.key} tone="danger">
            {r.name ? `${r.name}: ${r.message}` : r.message}
          </SectionNote>
        ))}

        <Chip label={t('mobile.processingV2.aiAnalyzing', 'AI ANALYZING')} tone="accent" />

        <Text variant="h1" style={styles.heading}>
          {t('mobile.processing.heading', 'Analyzing your items')}
        </Text>
        <Text variant="body" color="inkMuted" style={styles.subheading}>
          {t('mobile.processingV2.subtitle', 'Live results appear as we find them')}
        </Text>

        {/*
          Progress. `ProgressLine` replaces the local `AnimatedBar` — same eased
          fill, but theme-aware and Reduce-Motion-aware, and it carries the
          `accessibilityValue` the hand-rolled bar never had, so the percentage
          is available to a screen reader instead of being pixels only.
        */}
        <View style={styles.progressBlock}>
          {/*
            The "20%" that sat on the right is GONE, on the component's own
            instruction: "the design has no chunky progress bar and no
            percentage label beside it: the count lives in the heading above
            ('STEP 1 OF 5'), and this is the visual echo." Two numbers for one
            fact, one of them rounded, is the duplicate-control rule applied to
            readouts.
          */}
          <Text variant="eyebrow" color="inkMuted">
            {t('mobile.processingV2.stepOf', {
              current: stepNum,
              total: TIMELINE.length,
              defaultValue: 'STEP {{current}} OF {{total}}',
            })}
          </Text>
          <ProgressLine
            value={stepNum}
            total={TIMELINE.length}
            label={t('mobile.processing.heading', 'Analyzing your items')}
            animated
          />
        </View>

        {/* Document chip */}
        {docInfo ? (
          <SoftPanel style={styles.docPanel}>
            <View style={styles.docRow}>
              <FileText size={icon.md} color={c.inkMuted} strokeWidth={1.8} />
              <Text variant="bodyMedium" style={styles.docText}>
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
          </SoftPanel>
        ) : null}

        {/*
          Phase timeline — the kit's `Timeline`, replacing ~60 lines that drew
          their own rail, their own three dot states and their own active
          sub-line.

          Two things go with it. The DONE rows were struck through
          (`textDecorationLine: 'line-through'`) — a completed phase is not a
          cancelled one, and strikethrough reads as "this did not happen".
          And the pending rows sat at `#9aa1ad` on `#f8f9ff`, which is about
          2.4:1 — under the 4.5:1 floor. `Timeline` renders both states from
          palette roles that the contrast suite checks.
        */}
        <View style={styles.timeline} accessibilityLiveRegion="polite">
          <Timeline steps={timelineSteps} current={phaseIndex} live={!settled} />
        </View>

        {/* "Continue in background" moved OUT of the scroll flow into the
            sticky footer action bar below (it drifted here as products
            streamed in, and read as a bare link). */}

        {/* Detection banner */}
        {detection ? (
          <EnterOnMount>
            <SoftPanel style={styles.detectionPanel}>
              <View style={styles.detectionRow}>
                <View style={styles.detectionText}>
                  <Text variant="rowTitle">
                    {t('mobile.processingV2.foundCount', {
                      count: detection.count,
                      defaultValue: `Found ${detection.count} ${detection.count === 1 ? 'item' : 'items'}`,
                    })}
                  </Text>
                  {detection.summary ? (
                    <Text variant="caption" color="inkMuted" numberOfLines={2}>
                      {detection.summary}
                    </Text>
                  ) : null}
                </View>
                {/*
                  Confidence as a `Chip`, not a 22pt number over an 8pt caption.
                  At 8pt "CONFIDENT" was below every legibility floor we hold
                  elsewhere, and the pair gave a model's self-reported score the
                  largest type on the screen — louder than the item names it is
                  describing.
                */}
                <Chip
                  label={`${Math.round(detection.confidence * 100)}% ${t('mobile.processingV2.confident', 'confident')}`}
                  tone="accent"
                />
              </View>
            </SoftPanel>
          </EnterOnMount>
        ) : null}

        {/* Live product list */}
        {(products.length > 0 || remainingSkeletons > 0) ? (
          <View style={styles.productsBlock}>
            <SectionHeader
              title={t('mobile.processingV2.productsFound', 'Products found')}
              trailing={
                productTotal != null ? (
                  <Chip label={`${products.length} / ${productTotal}`} tone="neutral" />
                ) : undefined
              }
            />

            <View>
              {/*
                One `Row` per product, the same component the rest of v2 uses
                for a list item — so a detected product looks like a product
                everywhere it appears, instead of like a card invented here.

                `titleLines={2}` matters: AI-written titles here run past 90
                characters, and without a bounded title the trailing price gets
                pushed off-screen (trap 3 in the v2 skill).

                The three metadata chips collapse into ONE subtitle. Three
                bordered pills for "Used · LabGreenbidz · Grade B" is three
                boxes drawn around text that reads perfectly well as a line,
                and it left no room for the price on a narrow phone.
              */}
              {products.map((p) => {
                const uri = thumbnailFor(p);
                const meta = [p.condition, p.siteType, p.grade ? `Grade ${p.grade}` : undefined]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <EnterOnMount key={p.index}>
                    <Row
                      title={p.name}
                      titleLines={2}
                      subtitle={meta || undefined}
                      leading={
                        <RowThumb uri={uri}>
                          <Sparkles size={icon.md} color={c.inkDisabled} strokeWidth={1.6} />
                        </RowThumb>
                      }
                      trailing={
                        p.price ? (
                          <Chip
                            label={t('mobile.processingV2.est', {
                              price: p.price,
                              defaultValue: `Est. ${p.price}`,
                            })}
                            tone="accent"
                          />
                        ) : null
                      }
                    />
                  </EnterOnMount>
                );
              })}

              {/*
                Skeletons for products still being analyzed. Shaped like the
                `Row` above so the list does not reflow when a real one lands —
                same 56pt thumb, same two text lines, same left inset.
              */}
              {Array.from({ length: remainingSkeletons }).map((_, i) => (
                <View key={`sk-${i}`} style={styles.skeletonRow}>
                  <Shimmer style={styles.skeletonThumb} />
                  <View style={styles.skeletonText}>
                    <Shimmer style={styles.skeletonLine1} />
                    <Shimmer style={styles.skeletonLine2} />
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
        style={[
          styles.footer,
          { backgroundColor: c.surface, paddingBottom: insets.bottom + space.xl },
        ]}
      >
        <Hairline />

        {offerBackground ? (
          <View style={styles.footerAction}>
            {/*
              `PrimaryAction variant="tinted"` — the same tinted pill the rest
              of v2 uses for "let this keep running", replacing a hand-built
              `Pressable` with two `rgba(16,185,129,…)` literals. It carries its
              own 44pt height and press feedback; the old one had neither.
            */}
            <PrimaryAction
              label={t('mobile.processing.continueInBackground', {
                defaultValue: 'Continue in background',
              })}
              onPress={handleContinueInBackground}
              variant="tinted"
              icon={<Bell size={icon.lg} color={c.accentInk} strokeWidth={1.8} />}
            />
            <Text variant="caption" color="inkMuted" style={styles.footerHint}>
              {t('mobile.processing.backgroundHint', {
                defaultValue: "Keep using the app — we'll notify you when it's ready.",
              })}
            </Text>
          </View>
        ) : null}

        {/* Meta row — timer + provenance (muted) · Cancel (quiet). */}
        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <Timer size={icon.sm} color={c.inkSubtle} strokeWidth={1.8} />
            <Text variant="eyebrow" color="inkSubtle">
              {`${mmss(elapsed)} · GREENBIDZ VISION AI`}
            </Text>
          </View>
          <QuietAction
            label={t('common.cancel', 'Cancel')}
            onPress={cancel}
            tone="danger"
            variant="bodyMedium"
          />
        </View>
      </View>
    </Screen>
  );
}

/*
  Styles, in tokens. Previously every rule was an inline object, which is how 19
  raw hex values and 26 `fontSize`s accumulated in one file without anyone
  seeing them together.
*/
const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: GUTTER, paddingTop: space.md, gap: space.md },
  heading: { marginTop: space.md },
  subheading: { marginTop: space.xxs },

  progressBlock: { marginTop: space['2xl'], gap: space.sm },

  docPanel: { marginTop: space.lg },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  docText: { flex: 1, minWidth: 0 },

  timeline: { marginTop: space['2xl'] },

  detectionPanel: { marginTop: space['2xl'] },
  detectionRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  /** `minWidth: 0` or the title never truncates and the chip is pushed off. */
  detectionText: { flex: 1, minWidth: 0, gap: space.xxs },

  productsBlock: { marginTop: space['2xl'] },

  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  skeletonThumb: { width: 56, height: 56, borderRadius: radius.md },
  skeletonText: { flex: 1, gap: space.sm },
  skeletonLine1: { height: 14, width: '75%', borderRadius: radius.xs },
  skeletonLine2: { height: 10, width: '45%', borderRadius: radius.xs },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: GUTTER,
    gap: space.md,
  },
  footerAction: { gap: space.sm },
  footerHint: { textAlign: 'center' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },

  errorPage: { flex: 1, paddingHorizontal: GUTTER, paddingTop: space['2xl'], gap: space['2xl'] },
  errorBody: { gap: space.sm },
  errorActions: { gap: space.sm },
});
