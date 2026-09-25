import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { AppImage } from '@/components/ui';
/*
  v2 KIT. This screen is the first thing seen after the shutter, so it is the
  first thing that must read as the redesign. Presentation only — every hook,
  effect, mutation and `router.replace` below is untouched.

  `Screen` and `Text` shadow the old-kit exports of the same name on purpose:
  the v2 `Screen` owns safe areas, the header sheet and the tab-bar reserve,
  and the v2 `Text` refuses a raw `fontSize`.
*/
import {
  Chip,
  Hairline,
  PrimaryAction,
  QuietAction,
  Screen,
  SectionNote,
  Text,
  Timeline,
  type TimelineStep,
} from '@/features/v2/ui';
import { GUTTER, radius, space } from '@/theme/v2';
import { manualEntryDefaults, marketplaceFromSiteType } from '@/features/scanner/constants';
import { routingPatchFromAi } from '@/features/scanner/routing/routingState';
// ⚠️ `supportedMarketplacesCache`, NEVER `supportedMarketplaces` — same import
// rule as the store: the latter drags axios + the auth/socket graph in.
import { supportedNow } from '@/features/scanner/routing/supportedMarketplacesCache';
import { routes } from '@/lib/routes';
import { homeRoute } from '@/features/v2/routing/postAuthLanding';
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

/*
  REVERSED: "StyleSheet.create dissolved".

  The note that stood here described the old strategy — className for what
  mapped, inline `style={{…}}` for "one-off ornamental styles (laser sweep,
  telemetry rings, gradient pills, step-row states with shadows)". Every one of
  those ornaments is gone, and the styles are back in a single `StyleSheet` at
  the foot of the file. `ACCENT` (a fork-aware `brand.primary` / `#10b981`) and
  `checkCircleBase` went with them: the accent is `c.accent` from the palette
  now, and nothing draws its own check circle — `Timeline` does.
*/

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

// M-4 lock 3 lives in `features/scanner/routing/routingState.ts` as
// `routingPatchFromAi`, beside the two decision functions it composes. It was a
// module-scope helper HERE until the 2026-08-19 review: this file is not
// importable under jest (expo-router + the SSE client + MMKV), so with the
// function inside it, deleting the one spread that calls it removed the whole of
// lock 3 with the full suite still green. Its decision is unit-tested in
// routingState.test.ts and this CALL SITE in routingWiring.test.ts.

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

  /*
    REMOVED: eleven `Animated.Value`s — four check-pops, four row entrances, a
    pulsing dot, a laser sweep and a background pulse — plus the three effects
    that drove them. `Timeline` owns its own motion and honours Reduce Motion,
    so keeping these would be a second animation system running against a
    component that is already animating, with nothing bound to it.
  */
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

    const MAX_PENDING_STEP = 3;
    let step = 0;
    const interval = setInterval(() => {
      if (step >= MAX_PENDING_STEP) {
        clearInterval(interval);
        return;
      }
      step += 1;
      setCurrentStep(step);
    }, 1800);

    return () => clearInterval(interval);
  }, [useV2Stream]);

  // v2: advance the step indicator from real stream phases, and pop the
  // checkmarks for every step the backend has already passed. Steps only
  // advance on real events — no timer — so the screen reflects truth. The
  // active row keeps its pulse/laser animation (and an "Analyzing…" sub-label
  // for the extracting step) so it never looks frozen between sparse events.
  useEffect(() => {
    if (!useV2Stream || streamPhase == null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentStep(PHASE_TO_STEP[streamPhase]);
  }, [useV2Stream, streamPhase]);

  // On a real result, mark the final step done just before the screen
  // navigates away.
  useEffect(() => {
    if (!isSuccess) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentStep(4);
  }, [isSuccess]);

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
                // if/else, not a ternary — see the TS2590 note in `detection.tsx`.
                if (mode === 'single') {
                  router.replace(routes.scanDetail);
                } else {
                  router.replace(routes.scanGroupedReview);
                }
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
              // M-4 lock 3 — the marketplace/routing patch is NOT here. It is
              // the LAST spread in this object (just above `lastStep`), because
              // it may CLEAR the category and the `ai.categoryId` spread below
              // would otherwise overwrite the clear. See routingPatchFromAi.
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
              // ── M-4 lock 3 + §0.5 owner decision ───────────────────────
              // The analyze path (`/wp/analyze-process-images`, reached when
              // `useSmart === false`, i.e. manual GROUPED mode) now applies the
              // AI's detected marketplace too.
              //
              // LAST on purpose: when the routed tree is untrusted this spread
              // clears the five category fields, and it must therefore come
              // AFTER the `ai.categoryId` spread above.
              //
              // Shares lock 2's decision functions rather than re-deriving the
              // trigger inline: `routingNeedsAsk` and `shouldPrefillCategory`
              // live in routingState.ts and have ONE implementation
              // (blocker (d)).
              ...routingPatchFromAi({
                ai,
                supported: supportedNow(),
                fallbackMarketplace: marketplaceFromSiteType(getSiteType()) ?? '101lab',
              }),
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
    // See processing-v2.tsx — v2's Scan it lands in this flow, so "home" must
    // be the flag's answer, not a hardcoded legacy route.
    // if/else, not a ternary — see the TS2590 note in `detection.tsx`.
    if (IS_CUSTOMER) {
      router.replace(homeRoute());
    } else {
      router.replace(routes.scanHome);
    }

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
    /*
      v2: the live "k/N" is the extracting step's `detail`, not part of its
      label. `Timeline` shows `detail` only while that step is the active one,
      which is the honest placement — a count of products extracted means
      nothing next to a step that has not started, and reads as stale next to
      one that has finished. Previously it was concatenated into the label and
      so stayed on screen for the rest of the run.
    */
    const extractingDetail =
      useV2Stream && productProgress.total
        ? `${productProgress.done}/${productProgress.total}`
        : undefined;

    const timelineSteps: readonly TimelineStep[] = [
      { label: subStatuses[0] },
      { label: subStatuses[1] },
      { label: subStatuses[2], detail: extractingDetail },
      { label: subStatuses[3] },
    ];

    return (
      <Screen scroll={false} tabBar={false} testID="scan-processing">
        <View style={styles.loader}>
        {/* Non-fatal Phase 2 rejection banners — floats over the centered
            loader so the user sees which files got dropped without shifting
            the animation. Rarely visible (v2 redirects this screen before
            mutating; only the SMART_DETECT_V2_ENABLED=0 cohort hits this). */}
        {nonFatalRejections.length > 0 && (
          <View style={styles.banners} pointerEvents="box-none">
            {/*
              `SectionNote tone="danger"` instead of the hand-built amber card.
              It already carries the alert role, the danger colour and the
              spacing, so the file-name line is the only thing left to say —
              and it belongs in the same note, not in a second `<Text>` with
              its own hex.
            */}
            {nonFatalRejections.map((r) => (
              <SectionNote key={r.key} tone="danger">
                {r.name ? `${r.name}: ${r.message}` : r.message}
              </SectionNote>
            ))}
          </View>
        )}

        {/*
          REMOVED: the ambient crosshair + three pulsing rings.

          Five raw `rgba(16,185,129,…)` values drawing decoration behind the
          content. v2 is "space instead of boxes" and its motion rule is that
          motion answers what a person DID — there is no ambient drift. 7a as
          drawn has no rings and no spinning gear: the timeline IS the content
          of the wait. Dropping them is the point, not a casualty of the port.
        */}
        {/*
          The badge. `Chip` in the accent tone replaces a hand-rolled orange
          pill — `#ff9800` was the one colour on this screen that belonged to
          no palette at all, and white-on-orange at 10pt bold is the kind of
          contrast the v2 audit exists to catch.
        */}
        <Chip label={t('mobile.processing.aiWorking')} tone="accent" />

        {/*
          REMOVED: the 140pt scanner frame — four bracket Views, a grey
          backdrop and a 72pt gear spinning on a Reanimated worklet.

          It was the focal point of the old screen and it says nothing: a gear
          is not this product, and a spinner that reports no progress is the
          "generic loader" `UX_DESIGN_RULES.md` forbids. The timeline below
          says the same thing with real phases, so the gear was decoration
          competing with the content for the top of the screen.
        */}
        <View style={styles.headingGap} />

        <Text variant="h2" style={styles.center}>
          {t('mobile.processing.heading')}
        </Text>
        <Text variant="body" color="inkMuted" style={styles.subheading}>
          {t('mobile.processing.timeEstimate')}
        </Text>

        {/*
          THE STEP LIST — now the kit's `Timeline`, which is the same component
          7a uses, so the two analyzing surfaces finally agree.

          What it replaces: four cards, each with its own background, border,
          iOS shadow + Android elevation, a bespoke check circle, a pulsing
          dot, and a 40pt "laser" sweeping across the active row — about 120
          lines carrying twelve raw colours and three `rgba()` literals.

          `Timeline` takes `steps` and a `current` index and draws done /
          active / pending itself, honouring Reduce Motion. The live "k/N" on
          the extracting step survives as that step's `detail`, which is
          exactly what `detail` is for: a sub-line shown only while its step is
          the active one.
        */}
        <View style={styles.timeline}>
          <Timeline steps={timelineSteps} current={currentStep} live={isPending} />
        </View>

        {/*
          A bare `Pressable` wrapping a coloured `<Text>` was a tap target of
          whatever the text happened to measure, padded out with `hitSlop`.
          `QuietAction` is the kit's answer and carries its own 44pt box.
        */}
        {backgroundRecognitionEnabled() && (
          <QuietAction
            label={t('mobile.processing.continueInBackground', {
              defaultValue: 'Continue in background',
            })}
            onPress={handleContinueInBackground}
          />
        )}

        {/*
          "This is taking longer than usual" is an explanation, so it is a
          `SectionNote` — muted, not danger: the run has not failed, and
          colouring it amber told people something had gone wrong when nothing
          had.
        */}
        {slowMsg ? <SectionNote tone="muted">{t('mobile.processing.slow')}</SectionNote> : null}

        </View>

        {/*
          The attribution line, moved OUT of the centred column and into the
          screen's own bottom edge. It used to be `position: 'absolute'` inside
          the scroller with hard 24pt insets, which ignored the safe area — on
          a gesture-nav phone it sat under the home indicator.
        */}
        <View style={styles.attribution}>
          <Hairline />
          <Text
            variant="eyebrow"
            color="inkSubtle"
            style={styles.center}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {t('mobile.processing.poweredBy', {
              defaultValue: 'Powered by GreenBidz Industrial Vision AI v4.2',
            })}
          </Text>
        </View>
      </Screen>
    );
  }

  if (showError) {
    return (
      <Screen scroll={false} tabBar={false} testID="scan-processing-error">
        <View style={styles.error}>
          <ScrollView
            horizontal
            style={styles.photoStrip}
            contentContainerStyle={styles.photoStripContent}
            showsHorizontalScrollIndicator={false}
          >
            {draft.photos.map((p) => (
              <AppImage key={p.uri} source={{ uri: p.uri }} style={styles.photo} />
            ))}
          </ScrollView>

          {/*
            One `SectionNote tone="danger"` where there was an amber card with
            its own border, its own 36pt icon disc and two `<Text>`s at
            `#92400e`. The note owns the alert role and the colour; the title
            and the reason read as one sentence, which is how the person reads
            them anyway.

            Kept: `accessibilityLiveRegion` on the wrapper, so the failure is
            announced when it replaces the loader rather than only drawn.
          */}
          <View accessibilityLiveRegion="polite" style={styles.errorBody}>
            <Text variant="h3">
              {t('mobile.processing.errorTitle', "We couldn't read your photos")}
            </Text>
            <SectionNote tone="danger">{errorMessage}</SectionNote>
          </View>

          {/*
            ONE primary. "Continue without AI" is the action that gets the
            seller to a listing, so it is the filled pill; retaking is the
            quieter alternative. The old screen made both `Button`s full-width
            and gave the SECONDARY slot to the one that moves forward.
          */}
          <View style={styles.errorActions}>
            <PrimaryAction
              label={t('mobile.processing.continueWithoutAi')}
              onPress={skipToDetail}
            />
            <QuietAction label={t('mobile.processing.retake')} onPress={retake} />
          </View>
        </View>
      </Screen>
    );
  }

  return null;
}

/*
  Styles, in tokens.

  The file's own note said "StyleSheet.create dissolved" and every rule moved
  inline — which is how 22 raw hex values and 12 `fontSize`s accumulated here
  without anyone seeing them together. They are back in one block precisely so
  the next person can read the whole surface at once, and so the v2 adherence
  test has something to police.
*/
const styles = StyleSheet.create({
  /** The centred column. `Screen` owns the safe areas; this owns the gutter. */
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: GUTTER,
    gap: space.lg,
  },
  /** Floats over the centred column so a dropped file does not shift it. */
  banners: {
    position: 'absolute',
    top: space.lg,
    left: space.lg,
    right: space.lg,
    gap: space.sm,
    zIndex: 10,
  },
  center: { textAlign: 'center' },
  /** Replaces the 140pt gear block — the same breathing room, none of the ink. */
  headingGap: { height: space.xl },
  subheading: { textAlign: 'center', marginBottom: space.xl },
  /** The canvas caps the step column rather than letting it run the full width. */
  timeline: { width: '100%', maxWidth: 290 },
  attribution: { paddingHorizontal: GUTTER, paddingTop: space.md, gap: space.md },

  error: { flex: 1, paddingHorizontal: GUTTER, paddingTop: space.xl, gap: space['2xl'] },
  photoStrip: { maxHeight: 100, flexGrow: 0 },
  photoStripContent: { gap: space.sm },
  photo: { width: 80, height: 80, borderRadius: radius.sm, opacity: 0.5 },
  errorBody: { gap: space.sm },
  errorActions: { gap: space.sm },
});
