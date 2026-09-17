/**
 * 7a — Analyzing. The one screen in the app where motion IS the content.
 *
 * Shape, top to bottom (docs/v2-design/screens/7a.html):
 *
 *   ┌ green wash sheet, bleeding under the notch ─────────────┐
 *   │  ( ✦ AI ANALYZING )                                     │
 *   │  Analyzing your items                                   │
 *   │  Live results appear as we find them.                   │
 *   │  STEP 1 OF 5                                    20%     │
 *   │  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁    │
 *   └─────────────────────────────────────────────────────────┘
 *      ●  Validating                                             timeline
 *      │
 *      ○  Reading documents
 *      │
 *      ○  Uploading and detecting
 *      │
 *      ○  Identifying products
 *      │
 *      ○  Done
 *
 *      ITEMS FOUND · 2 OF 3                                      streamed in
 *      [] Waters Alliance e2695 HPLC                  $14,000
 *      [] Shimadzu LC-20AD pump set                    $9,400
 *   ┌ footer, pinned ─────────────────────────────────────────┐
 *   │  (  🔔  Continue in background  )                       │
 *   │  Keep using the app — we will notify you when it is ready. │
 *   │  ─────────────────────────────────────────────────────  │
 *   │  0:02 · GREENBIDZ VISION AI                    Cancel   │
 *   └─────────────────────────────────────────────────────────┘
 *
 * ── DATA: a real signal, never a timer ───────────────────────────────────
 *
 * The bar is driven by the backend's own SSE control plane, tailed read-only:
 *
 *     GET /recognition-jobs/:id/stream   →  tailRecognitionJob()
 *
 * `stage` frames carry the five-phase enum (`validating` →
 * `preparing_documents` → `ai_running` → `extracting_products` → `done`) that
 * `TIMELINE` below renders one-for-one; `detection` carries how many items the
 * model found; each `product` frame is one finished item, which is what makes
 * "live results appear as we find them" true rather than decorative. Inside
 * `extracting_products` the bar also advances per item (products / total), so
 * the longest phase is not a 20% dead zone. It cannot outrun the work: every
 * input is a frame the server already sent.
 *
 * THIS SCREEN NEVER STARTS A RUN. It attaches to one that is already going —
 * `?job=<id>`, else the id `processing-v2` / the background flow stored in
 * MMKV (`recognitionJobStore`). With no id it says so and offers a way out
 * rather than inventing progress. Tailing is a GET; aborting the tail does not
 * touch the job.
 *
 * STALL / FAILURE. `tailRecognitionJob` arms a 45s heartbeat watchdog and
 * rejects `connection_lost` when the stream goes quiet. That is NOT the scan
 * failing — the job keeps running server-side — so the screen says exactly
 * that and offers "Check again", which re-opens the tail from `after_seq=0`.
 * The server replays the whole event log, so a reconnect catches up, terminal
 * `result` included. A fatal backend `error` frame is the other branch: the
 * message is already localised by the backend and is shown verbatim.
 *
 * WRITES ARE DEFERRED. Starting a run (`POST /recognition-jobs`), promoting one
 * (`POST /recognition-jobs/:id/detach`, which is what actually makes "Continue
 * in background" notify) and cancelling one are all marked `TODO(v2-writes)`.
 * The controls stay visible — they are in the drawing — and do the local half
 * (stop watching, leave) so nothing is a dead button.
 *
 * ── MOTION: the whole app's budget, spent here ───────────────────────────
 *
 *   1. the progress fill eases to each new real value        (meaningful)
 *   2. the active dot grows; done dots settle back           (meaningful)
 *   3. each found item fades and rises in as it arrives      (meaningful)
 *   4. an ambient ring pulses off the active dot             (decorative)
 *   5. placeholders for items still coming shimmer           (decorative)
 *
 * 1–3 have an end state worth resolving to, so they run through `timing()` and
 * Reduce Motion resolves them instantly. 4 and 5 have none — at zero duration
 * they would strobe — so they are gated on `useMotionEnabled()` and simply do
 * not exist when Reduce Motion is on.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, ImageIcon, RefreshCw, Sparkles } from 'lucide-react-native';

import {
  Chip,
  EmptyState,
  Hairline,
  PrimaryAction,
  QuietAction,
  Row,
  RowThumb,
  Screen,
  SectionHeader,
  SectionNote,
  Text,
} from '@/features/v2/ui';
import {
  GUTTER,
  HAIRLINE_WIDTH,
  PROGRESS_TRACK_HEIGHT,
  SECTION_GAP,
  control,
  duration,
  easing,
  icon,
  radius,
  space,
  timing,
  useMotionEnabled,
  useV2Colors,
} from '@/theme/v2';
import type { SmartStreamEvent, StagePhase } from '@/features/scanner/smartDetectStreamTypes';
import type { MappedProduct, MappedSmartDetection } from '@/features/scanner/smartDetectionTypes';
import {
  RecognitionJobStreamError,
  tailRecognitionJob,
} from '@/services/scanner/recognitionJobClient';
import { getStoredJobId } from '@/stores/recognitionJobStore';
import { useScanDraft } from '@/stores/scanDraftStore';
import { routes } from '@/lib/routes';
import { haptics } from '@/lib/haptics';

// ── The five phases, exactly as the backend names them ─────────────────────

/**
 * The drawn timeline. One row per backend `stage.phase`, in the order the
 * server emits them, which is why "STEP n OF 5" is a real count and not a
 * guess. Labels are the canvas's, not `processing-v2`'s ("Uploading and
 * detecting", spelled out).
 */
const TIMELINE: readonly { phase: StagePhase; label: string }[] = [
  { phase: 'validating', label: 'Validating' },
  { phase: 'preparing_documents', label: 'Reading documents' },
  { phase: 'ai_running', label: 'Uploading and detecting' },
  { phase: 'extracting_products', label: 'Identifying products' },
  { phase: 'done', label: 'Done' },
];
const PHASE_ORDER = TIMELINE.map((r) => r.phase);

/**
 * `preparing_pdfs` is a deprecated alias the backend still emits for one
 * release. Collapsing it here keeps the timeline at five rows — without this
 * `indexOf` returns -1 and the whole bar snaps back to zero mid-run.
 */
function normalizePhase(p: StagePhase): StagePhase {
  return p === 'preparing_pdfs' ? 'preparing_documents' : p;
}

// ── Motion constants ───────────────────────────────────────────────────────

/**
 * The ambient pulse and the shimmer are slower than anything in `duration`,
 * which tops out at 320ms (a transition, not a loop). A 320ms loop reads as a
 * strobe. Both still go through `timing()` so the easing is the app's.
 */
const PULSE_MS = 1800;
const SHIMMER_MS = 900;
/** How far a streamed-in item travels. Small: it is arriving, not launching. */
const ENTER_RISE = 12;

/** Timeline rail geometry, off the space scale — these are drawn marks. */
const RAIL = 20;
const DOT_ACTIVE = 12;
const DOT_IDLE = 8;
const PULSE_SCALE = 2.4;
const PULSE_OPACITY = 0.45;

// ── Copy helpers ───────────────────────────────────────────────────────────

/** "0:02" — the footer's provenance line. */
function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

const CONDITION_LABEL: Record<string, string> = {
  new: 'New',
  usedFunctional: 'Used',
  forParts: 'For parts',
  wasteDisposal: 'Waste',
  demolitionRemoval: 'Demolition',
};

function conditionLabel(c: unknown): string | undefined {
  const v = Array.isArray(c) ? c[0] : c;
  if (typeof v !== 'string' || !v) return undefined;
  return CONDITION_LABEL[v] ?? v;
}

/** The model returns price as a number, a numeric string, or junk. Only a real number earns a chip. */
function formatPrice(price: unknown, currency: unknown): string | undefined {
  if (price == null) return undefined;
  const n = Number(String(price).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const cur = typeof currency === 'string' && currency ? currency : 'USD';
  return cur === 'USD' ? `$${n.toLocaleString()}` : `${cur} ${n.toLocaleString()}`;
}

/** Only an absolute http(s) URL is something a tile can load; an object key gives a broken box. */
function photoUri(uri?: string | null): string | undefined {
  return typeof uri === 'string' && /^https?:\/\//.test(uri) ? uri : undefined;
}

// ── Local primitives (see KIT GAPS in the build report) ────────────────────

/**
 * The tracked pill above the heading — `✦ AI ANALYZING`.
 *
 * `Chip` is the kit's pill, but it is 26pt, `micro` type and takes no glyph;
 * this is the tracked-eyebrow variant with a leading mark, on `control.chip`.
 */
function BadgePill({ label }: { label: string }) {
  const c = useV2Colors();
  // flat: a status badge — it reports, it is not pressed.
  return (
    <View style={[styles.badge, { backgroundColor: c.accentWash }]}>
      <Sparkles size={icon.xs} color={c.accentInk} strokeWidth={1.8} />
      <Text variant="eyebrow" color="accentInk">
        {label}
      </Text>
    </View>
  );
}

/**
 * The 3pt track, easing to each new real value.
 *
 * Two reasons it is not the kit's `ProgressLine`: that one is static (the
 * whole point here is that the bar moves as the work moves), and its track is
 * `fill`, which on the green header wash is a 1.02:1 step — invisible. The
 * canvas draws the track in `fillStrong` precisely because it sits on the wash.
 *
 * Width is animated in POINTS off a measured layout rather than as a
 * percentage string, so it interpolates on the UI thread with no string
 * parsing per frame.
 */
function PhaseProgress({ percent, label }: { percent: number; label: string }) {
  const c = useV2Colors();
  const [trackWidth, setTrackWidth] = useState(0);
  const filled = useSharedValue(0);
  const target = Math.max(0, Math.min(1, percent)) * trackWidth;

  useEffect(() => {
    filled.value = withTiming(target, timing(duration.slow, easing.standard));
  }, [target, filled]);

  const fillStyle = useAnimatedStyle(() => ({ width: filled.value }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent * 100) }}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      // flat: a progress track.
      style={[styles.track, { backgroundColor: c.fillStrong }]}
    >
      {/* flat: the progress fill itself. */}
      <Animated.View style={[styles.trackFill, { backgroundColor: c.accent }, fillStyle]} />
    </View>
  );
}

type StepState = 'done' | 'active' | 'pending';

/**
 * One dot on the rail.
 *
 * The size/colour change is meaningful — it is the app telling you where the
 * work got to — so it eases through `timing()` and resolves instantly under
 * Reduce Motion. The ring pulsing off the active dot is not; it has no end
 * state, so it is gated out entirely instead of running at zero duration.
 */
function StepDot({ state, pulse }: { state: StepState; pulse: boolean }) {
  const c = useV2Colors();
  const motionOn = useMotionEnabled();
  const active = state === 'active';
  // A ring pulsing off a step that is not moving would claim work is happening
  // when the run has stopped. The dot stays large — the work did reach here.
  const beating = active && pulse;

  const grow = useSharedValue(active ? 1 : DOT_IDLE / DOT_ACTIVE);
  const ring = useSharedValue(0);

  useEffect(() => {
    grow.value = withTiming(
      active ? 1 : DOT_IDLE / DOT_ACTIVE,
      timing(duration.base, easing.standard),
    );
  }, [active, grow]);

  useEffect(() => {
    if (!motionOn || !beating) return;
    ring.value = 0;
    ring.value = withRepeat(withTiming(1, timing(PULSE_MS, easing.standard)), -1, false);
    return () => {
      cancelAnimation(ring);
      ring.value = 0;
    };
  }, [motionOn, beating, ring]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: grow.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * PULSE_OPACITY,
    transform: [{ scale: 1 + ring.value * (PULSE_SCALE - 1) }],
  }));

  const color = state === 'pending' ? c.fillStrong : c.accent;

  return (
    <View style={styles.dotBox}>
      {motionOn && beating ? (
        <Animated.View
          // flat: a step dot.
          style={[styles.dot, styles.dotRing, { backgroundColor: c.accent }, ringStyle]}
        />
      ) : null}
      <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />
    </View>
  );
}

/** A timeline row: rail (dot + connector) beside the label and its live sub-line. */
function TimelineRow({
  label,
  state,
  detail,
  pulse,
  last,
}: {
  label: string;
  state: StepState;
  /** The backend's own message for the phase, or "Reading 2 of 5". */
  detail?: string;
  /** Whether the run is actually still moving. */
  pulse: boolean;
  last: boolean;
}) {
  const c = useV2Colors();
  return (
    <View style={styles.timelineRow}>
      <View style={styles.rail}>
        <StepDot state={state} pulse={pulse} />
        {/* flat: a 1pt connector between step dots. */}
        {last ? null : <View style={[styles.connector, { backgroundColor: c.fill }]} />}
      </View>

      <View style={[styles.timelineText, last && styles.timelineTextLast]}>
        <Text
          variant={state === 'active' ? 'action' : 'lead'}
          color={state === 'active' ? 'ink' : state === 'done' ? 'inkMuted' : 'inkSubtle'}
        >
          {label}
        </Text>
        {state === 'active' && detail ? (
          <Text variant="caption" color="accentInk" style={styles.timelineDetail}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Fades and rises a found item into place as its `product` frame lands. */
function EnterOnMount({ children }: { children: React.ReactNode }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(1, timing(duration.base, easing.standard));
  }, [t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * ENTER_RISE }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * A block that breathes while its item is still being read.
 *
 * Purely decorative: there is no end state to resolve to, so with Reduce Motion
 * on it is a flat block rather than a loop running at zero duration.
 */
function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useV2Colors();
  const motionOn = useMotionEnabled();
  const t = useSharedValue(0);

  useEffect(() => {
    if (!motionOn) return;
    t.value = withRepeat(withTiming(1, timing(SHIMMER_MS, easing.inOut)), -1, true);
    return () => {
      cancelAnimation(t);
      t.value = 0;
    };
  }, [motionOn, t]);

  const animated = useAnimatedStyle(() => ({ opacity: 0.5 + t.value * 0.5 }));
  // flat: a skeleton placeholder; it already carries its own moving gradient.
  const base = [styles.shimmer, { backgroundColor: c.fill }, style];

  return motionOn ? <Animated.View style={[base, animated]} /> : <View style={base} />;
}

/** The placeholder for an item the model has counted but not yet described. */
function PendingItemRow() {
  return (
    <View style={styles.pendingRow}>
      <Shimmer style={styles.pendingThumb} />
      <View style={styles.pendingText}>
        <Shimmer style={styles.pendingLine} />
        <Shimmer style={styles.pendingLineShort} />
      </View>
    </View>
  );
}

// ── Stream state ───────────────────────────────────────────────────────────

type StreamItem = {
  index: number;
  name: string;
  subtitle?: string;
  price?: string;
  imageIndexes: number[];
};

/**
 * One row built from the terminal `result` rather than from a `product` frame.
 *
 * The tail replays from `after_seq=0`, so normally every item arrives as its
 * own frame and this is never needed. It matters when the server's event log
 * has been trimmed under a reconnect: the result is still complete, so the
 * list is rebuilt from it rather than under-reporting what the run found.
 */
function itemFromResult(p: MappedProduct, index: number): StreamItem {
  const f = p.fields;
  return {
    index,
    name: f.title || `Item ${index + 1}`,
    subtitle: conditionLabel(f.condition),
    price: formatPrice(f.pricePerUnit, f.priceCurrency),
    imageIndexes: p.imageIndexes,
  };
}

/**
 * `streaming` — a live tail. `done` — the terminal `result` landed.
 * `lost` — the tail dropped; the job is very probably still running.
 * `failed` — a fatal backend `error` frame; the run is over.
 * `idle` — nothing to watch, which is what you get opening this URL cold.
 */
type Status = 'idle' | 'streaming' | 'done' | 'lost' | 'failed';

const MAX_PENDING_ROWS = 4;

// ── The screen ─────────────────────────────────────────────────────────────

export default function V2Analyzing() {
  const c = useV2Colors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ job?: string }>();

  /**
   * The run to watch. An explicit `?job=` wins; otherwise the id the shipped
   * scan flow persisted in MMKV. Resolved once — a re-render must not swap the
   * screen onto a different job mid-tail.
   */
  const [jobId] = useState<string | null>(() => params.job ?? getStoredJobId());

  const [status, setStatus] = useState<Status>(jobId ? 'streaming' : 'idle');
  const [phase, setPhase] = useState<StagePhase>('validating');
  const [phaseMessage, setPhaseMessage] = useState<string>('');
  const [itemTotal, setItemTotal] = useState<number | null>(null);
  const [items, setItems] = useState<StreamItem[]>([]);
  const [pageUrls, setPageUrls] = useState<Record<number, string>>({});
  const [dropped, setDropped] = useState<{ key: string; message: string }[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  /** Bumped by "Check again" to re-open the tail. Read-only: a replay, not a re-run. */
  const [attempt, setAttempt] = useState(0);

  /**
   * When this screen started watching. Not `useRef(Date.now())` — reading the
   * clock during render is impure and the React Compiler rejects it, so the
   * clock starts one effect later instead.
   */
  const startedAt = useRef(0);
  const resultRef = useRef<MappedSmartDetection | null>(null);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  // Local photos, if this device is the one that shot them. A reattach from a
  // cold start has none — the item rows then fall back to their PDF page or to
  // the placeholder glyph, which is the normal case, not an error.
  const localPhotos = useScanDraft((s) => s.current?.photos);

  const phaseIndex = Math.max(0, PHASE_ORDER.indexOf(phase));
  const stepNumber = Math.min(phaseIndex + 1, TIMELINE.length);
  const settled = status === 'done';

  /**
   * The bar: `(completed phases + how far into this one) / 5`.
   *
   * A phase the server has announced counts as its whole fifth, which is what
   * pairs "STEP 1 OF 5" with 20% the way the canvas draws it. The exception is
   * `extracting_products` — the long one, where the server sends a `product`
   * frame per item — so that fifth fills item by item instead of sitting still
   * for a minute. Every term is a frame the server already sent: the bar
   * reaches 100% on the terminal `done`, and not one frame earlier.
   */
  const percent = useMemo(() => {
    if (settled) return 1;
    const within =
      phase === 'extracting_products' && itemTotal ? Math.min(1, items.length / itemTotal) : 1;
    return Math.min(1, (phaseIndex + within) / TIMELINE.length);
  }, [settled, phaseIndex, phase, itemTotal, items.length]);

  // ── The tail. A GET; it starts nothing and cancels nothing. ───────────────
  const onFrame = useCallback((name: string, data: unknown) => {
    const e = { type: name, data } as SmartStreamEvent;

    if (e.type === 'stage') {
      setPhase(normalizePhase(e.data.phase));
      setPhaseMessage(e.data.message ?? '');
      return;
    }

    if (e.type === 'detection') {
      setItemTotal(e.data.product_count);
      return;
    }

    if (e.type === 'pdf_pages') {
      setPageUrls((prev) => {
        const next = { ...prev };
        for (const pg of e.data.pages ?? []) {
          if (typeof pg.index === 'number' && pg.url) next[pg.index] = pg.url;
        }
        return next;
      });
      return;
    }

    if (e.type === 'product') {
      const d = (e.data.data ?? {}) as Record<string, unknown>;
      const unreadable = e.data.data == null;
      setItems((prev) => {
        const next = prev.filter((p) => p.index !== e.data.index);
        next.push({
          index: e.data.index,
          name: unreadable
            ? 'We could not read this one'
            : (d.name as string) || `Item ${e.data.index + 1}`,
          subtitle: unreadable ? 'You can fill it in yourself' : conditionLabel(d.condition),
          price: unreadable ? undefined : formatPrice(d.price, d.currency),
          imageIndexes: Array.isArray(e.data.image_indexes) ? e.data.image_indexes : [],
        });
        return next.sort((a, b) => a.index - b.index);
      });
      return;
    }

    if (e.type === 'error' && !e.data.fatal) {
      // One file was rejected mid-run; the rest carries on to `result`. The
      // backend already localised the message.
      const ctx = e.data.context as { name?: string } | undefined;
      setDropped((prev) => [
        ...prev,
        {
          key: `${e.data.code}-${prev.length}`,
          message: ctx?.name ? `${ctx.name}: ${e.data.message}` : e.data.message,
        },
      ]);
    }
  }, []);

  useEffect(() => {
    if (!jobId) return;

    const controller = new AbortController();
    let live = true;

    tailRecognitionJob(jobId, { signal: controller.signal, onEvent: onFrame })
      .then((mapped) => {
        if (!live) return;
        resultRef.current = mapped;
        setItems((prev) =>
          prev.length >= mapped.products.length ? prev : mapped.products.map(itemFromResult),
        );
        setItemTotal(mapped.products.length);
        setPhase('done');
        setStatus('done');
        haptics.success();
      })
      .catch((err: unknown) => {
        if (!live) return;
        const e = err instanceof RecognitionJobStreamError ? err : null;
        if (e?.code === 'cancelled' || controller.signal.aborted) return;
        // `retriable` is the backend's own word for "the run is fine, the pipe
        // is not". Saying "your scan failed" there would be a lie.
        const recoverable = e ? e.retriable : true;
        setFailure(e?.message ?? (err as Error)?.message ?? null);
        setStatus(recoverable ? 'lost' : 'failed');
        haptics.error();
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [jobId, attempt, onFrame]);

  // The footer clock. Stops the moment there is nothing left to time.
  useEffect(() => {
    if (status !== 'streaming') return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt.current), 1000);
    return () => clearInterval(id);
  }, [status]);

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Re-open the tail. `after_seq=0` replays the server's whole event log, so a reconnect catches up. */
  const onCheckAgain = () => {
    haptics.tap();
    setFailure(null);
    setPhase('validating');
    setPhaseMessage('');
    setItemTotal(null);
    setItems([]);
    setPageUrls({});
    setDropped([]);
    startedAt.current = Date.now();
    setElapsed(0);
    setStatus('streaming');
    setAttempt((n) => n + 1);
  };

  const onContinueInBackground = () => {
    haptics.tap();
    // TODO(v2-writes): the server half is `POST /recognition-jobs/:id/detach`
    // (`detachRecognitionJob`), which promotes this foreground job so the
    // backend persists its draft and rings the bell on completion. Without it,
    // leaving only stops the tail: the job still finishes, but nothing
    // notifies. Wire it with the rest of the writes, alongside the toast that
    // confirms the promise this button makes.
    router.back();
  };

  const onCancel = () => {
    haptics.warning();
    // TODO(v2-writes): cancelling the RUN needs a server call; there is no
    // cancel endpoint on `/recognition-jobs` yet, and aborting the tail (which
    // unmounting does) leaves the job going. Until then this only stops
    // watching, which is the honest half of the promise.
    router.back();
  };

  const onReview = async () => {
    haptics.impact();
    const mapped = resultRef.current;
    if (!mapped) return;

    /*
      ── THE HANDOFF INTO v2's REVIEW ──

      `applySmartDetection` is the hinge: it turns a mapped detection into the
      `current` / `queuedItems` that `wizardState.useReviewItem()` reads, which
      is what 7b–7e render. Everything here is device-local — Zustand + MMKV,
      no network, nothing published.

      ⚠️ ONLY THE SINGLE-PRODUCT PATH GOES TO v2, and that is a scope decision
      rather than a limitation. When the model reports several products the old
      screen runs a grouping wizard first — assign each photo to a product,
      rename them, override single-vs-grouped — and skipping it would silently
      accept the AI's grouping for a whole batch. Whether 7b's photo step is
      meant to absorb that is a question for the canvas, not something to
      infer. So multiple products still hand back to the shipped wizard.

      `mergedSingle` is not consulted: with one product there is nothing to
      merge, and forcing a mode would override the model for no reason.
    */
    const single = mapped.meta.suggestedMode === 'single' || mapped.products.length <= 1;
    if (!single) {
      useScanDraft.getState().setPendingDetection(mapped);
      router.replace(routes.scanDetection);
      return;
    }

    try {
      await useScanDraft.getState().applySmartDetection(mapped, localPhotos ?? []);
      router.replace(routes.v2ReviewPhotos);
    } catch {
      // `applySmartDetection` validates the mapping against the photo count and
      // throws on a mismatch. Falling back to the shipped wizard is better than
      // a dead button: it reads the same detection and can recover by hand.
      useScanDraft.getState().setPendingDetection(mapped);
      router.replace(routes.scanDetection);
    }
  };

  const onLeave = () => {
    haptics.tap();
    router.back();
  };

  /** The action that would FILL this screen. Same destination the four review
   *  steps offer from their own empty state, so the two agree. */
  const onScanAgain = () => {
    haptics.tap();
    router.replace(routes.v2Camera);
  };

  // ── Derived copy ──────────────────────────────────────────────────────────

  const foundCount = items.length;
  /** Whether the run itself is still moving — drives the ambient pulse. */
  const running = status === 'streaming' || status === 'lost';

  /**
   * The badge says which of the three things is true, because it is the first
   * thing read and "AI ANALYZING" over a stopped run is the kind of small lie
   * that makes people stop trusting the whole screen.
   */
  const badgeLabel = settled ? 'AI complete' : status === 'failed' ? 'AI stopped' : 'AI analyzing';

  const heading = settled
    ? foundCount > 0
      ? `Found ${plural(foundCount, 'item', 'items')}`
      : 'Nothing to list here'
    : status === 'idle'
      ? 'Nothing is being analyzed'
      : status === 'failed'
        ? 'The scan stopped'
        : status === 'lost'
          ? 'Still working'
          : 'Analyzing your items';

  const subheading = settled
    ? foundCount > 0
      ? 'Check what we read before it goes live.'
      : 'The photos did not contain equipment we could identify.'
    : status === 'idle'
      ? // NOTHING. The heading already says "Nothing is being analyzed" and the
        // EmptyState below says "No scan running" and what to do about it — a
        // subline here made it three sentences for one fact.
        undefined
      : status === 'failed'
        ? (failure ?? 'The run ended before it finished.')
        : status === 'lost'
          ? 'The live view dropped. Your scan is still running on our side.'
          : 'Live results appear as we find them.';

  /** The active row's own line — the backend's phase message, or the real item count. */
  const activeDetail =
    phase === 'extracting_products' && itemTotal
      ? `Reading ${Math.min(items.length + 1, itemTotal)} of ${itemTotal}`
      : phaseMessage || undefined;

  const pendingRows =
    status === 'streaming' && itemTotal != null
      ? Math.max(0, Math.min(MAX_PENDING_ROWS, itemTotal - items.length))
      : 0;

  const itemsTitle =
    itemTotal != null && itemTotal > foundCount
      ? `Items found · ${foundCount} of ${itemTotal}`
      : `Items found · ${foundCount}`;

  const thumbFor = (item: StreamItem): string | undefined => {
    const i = item.imageIndexes[0];
    if (i == null) return undefined;
    return photoUri(localPhotos?.[i]?.uri) ?? photoUri(pageUrls[i]);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const header = (
    <>
      {status === 'idle' ? null : <BadgePill label={badgeLabel} />}

      <Text variant="display">{heading}</Text>
      {/* Guarded, not just empty: an empty `Text` still carries its marginTop,
          which would leave a gap where a sentence used to be. */}
      {subheading ? (
        <Text variant="body" color="inkMuted" style={styles.subheading}>
          {subheading}
        </Text>
      ) : null}

      {status === 'idle' ? null : (
        <>
          <View style={styles.progressMeta}>
            <Text variant="eyebrow" color="inkMuted">
              {`Step ${stepNumber} of ${TIMELINE.length}`}
            </Text>
            <Text variant="captionMedium" color="accentInk">
              {`${Math.round(percent * 100)}%`}
            </Text>
          </View>
          <PhaseProgress
            percent={percent}
            label={`Analysis progress, step ${stepNumber} of ${TIMELINE.length}`}
          />
        </>
      )}
    </>
  );

  return (
    <Screen header={header} scroll={false} tabBar={false} testID="v2-analyzing">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {status === 'idle' ? (
          /*
            An `EmptyState`, not a `SectionNote`.
            
            Two things were wrong with the note. The header already says
            "Nothing is being analyzed / This screen follows a scan that is
            already running", so the note repeated it a third time in different
            words. And the only control was "Back to home" — a way OUT, offered
            as the only way forward, which is exactly what `EmptyState` exists
            to stop: an empty screen carries the action that would FILL it.
            Here that is starting a scan. Same treatment as the four review
            steps, which open on this state constantly.
          */
          <EmptyState
            title="No scan running"
            body="Start a scan and this screen follows it live — each item appears as the AI reads it."
            actionLabel="Scan an item"
            onAction={onScanAgain}
            secondaryLabel="Back to home"
            onSecondary={onLeave}
          />
        ) : (
          <>
            {/*
              Explanation only — the recovery control lives once, in the
              footer, where every other action on this screen is. Two "Check
              again"s on one screen is the duplicate-control trap.
            */}
            {status === 'lost' || status === 'failed' ? (
              <SectionNote tone={status === 'failed' ? 'danger' : 'muted'}>
                {status === 'failed'
                  ? (failure ?? 'The run ended before it finished. Nothing was published.')
                  : 'We stopped receiving updates from this scan. Nothing is lost — picking it back up replays everything that happened while we were away.'}
              </SectionNote>
            ) : null}

            {dropped.map((d) => (
              <SectionNote key={d.key} tone="danger">
                {d.message}
              </SectionNote>
            ))}

            {/*
              The timeline. `accessibilityLiveRegion` so the phase change is
              spoken on Android as it happens — someone using a screen reader is
              waiting on exactly this and cannot see the dot move. On iOS, which
              ignores live regions, the progress bar above carries the same news
              through its `accessibilityValue`; a second label on this container
              would only compete with the step labels inside it.
            */}
            <View style={styles.timeline} accessibilityLiveRegion="polite">
              {TIMELINE.map((row, i) => (
                <TimelineRow
                  key={row.phase}
                  label={row.label}
                  state={
                    settled || i < phaseIndex ? 'done' : i === phaseIndex ? 'active' : 'pending'
                  }
                  detail={activeDetail}
                  pulse={running}
                  last={i === TIMELINE.length - 1}
                />
              ))}
            </View>

            {foundCount > 0 || pendingRows > 0 ? (
              <>
                <View style={styles.sectionGap} />
                <SectionHeader title={itemsTitle} />

                {items.map((item) => (
                  <EnterOnMount key={item.index}>
                    <Row
                      title={item.name}
                      subtitle={item.subtitle}
                      titleLines={2}
                      leading={
                        <RowThumb uri={thumbFor(item)}>
                          <ImageIcon size={icon.md} color={c.inkDisabled} strokeWidth={1.6} />
                        </RowThumb>
                      }
                      trailing={item.price ? <Chip label={item.price} tone="accent" /> : null}
                      accessibilityLabel={
                        item.price ? `${item.name}. Estimated ${item.price}` : item.name
                      }
                      testID={`v2-analyzing-item-${item.index}`}
                    />
                  </EnterOnMount>
                ))}

                {Array.from({ length: pendingRows }).map((_, i) => (
                  <PendingItemRow key={`pending-${i}`} />
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      {/*
        The footer is a flex sibling, not `Screen`'s absolute `footer` — the
        canvas draws it as `flex:none` under a `flex:1` scroller, and pinning it
        absolutely over the list would hide the last item behind it. With no run
        to watch there is nothing to time and nothing to stop, so it is absent
        rather than empty; the way out is in the note above.
      */}
      {status === 'idle' ? null : (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space['4xl'] }]}>
          {/*
            Exactly one control here at any moment, and only one of them is
            ever the filled green pill: the finished state, where reviewing
            what the AI wrote is genuinely the next thing to do.
          */}
          {settled ? (
            foundCount > 0 ? (
              <PrimaryAction
                label={`Review ${plural(foundCount, 'item', 'items')}`}
                onPress={onReview}
                testID="v2-analyzing-review"
              />
            ) : (
              <PrimaryAction
                label="Back to home"
                onPress={onLeave}
                variant="tinted"
                testID="v2-analyzing-leave"
              />
            )
          ) : status === 'streaming' ? (
            <>
              <PrimaryAction
                label="Continue in background"
                onPress={onContinueInBackground}
                variant="tinted"
                icon={<Bell size={icon.lg} color={c.accentInk} strokeWidth={1.8} />}
                testID="v2-analyzing-background"
              />
              <Text variant="caption" color="inkMuted" style={styles.footerHint}>
                Keep using the app — we will notify you when it is ready.
              </Text>
            </>
          ) : (
            <PrimaryAction
              label="Check again"
              onPress={onCheckAgain}
              variant="tinted"
              icon={<RefreshCw size={icon.lg} color={c.accentInk} strokeWidth={1.8} />}
              testID="v2-analyzing-check-again"
            />
          )}

          <View style={styles.metaSpacer} />
          <Hairline />
          <View style={styles.meta}>
            <Text variant="eyebrow" color="inkSubtle">
              {`${mmss(elapsed)} · GreenBidz Vision AI`}
            </Text>
            {/*
              Where destructive actions belong, per the canvas. "Cancel" only
              while there is something to cancel; a run that has already ended
              gets a plain way out instead, so no state is a cul-de-sac.
            */}
            {settled ? null : status === 'failed' ? (
              <QuietAction
                label="Back"
                onPress={onLeave}
                tone="subtle"
                variant="bodyMedium"
                testID="v2-analyzing-back"
              />
            ) : (
              <QuietAction
                label="Cancel"
                onPress={onCancel}
                tone="danger"
                variant="bodyMedium"
                accessibilityHint="Stops watching this scan and goes back"
                testID="v2-analyzing-cancel"
              />
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // ── header sheet ──
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: control.chip,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    marginBottom: space['5xl'],
  },
  subheading: {
    maxWidth: 300,
    marginTop: space.lg,
    marginBottom: space['6xl'],
  },
  progressMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  track: {
    height: PROGRESS_TRACK_HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  trackFill: { height: '100%' },

  // ── body ──
  scroll: { flex: 1 },
  scrollContent: { paddingTop: space['8xl'], paddingBottom: space['6xl'] },
  sectionGap: { height: SECTION_GAP },

  timeline: { paddingHorizontal: GUTTER },
  timelineRow: { flexDirection: 'row', gap: space['3xl'] },
  rail: { flexShrink: 0, width: RAIL, alignItems: 'center' },
  dotBox: {
    width: DOT_ACTIVE,
    height: DOT_ACTIVE,
    marginTop: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: DOT_ACTIVE, height: DOT_ACTIVE, borderRadius: radius.pill },
  /** Sits exactly over the dot — `dotBox` is one dot wide, so top/left 0 centres it. */
  dotRing: { position: 'absolute', top: 0, left: 0 },
  connector: { flex: 1, width: HAIRLINE_WIDTH },
  timelineText: { flex: 1, minWidth: 0, paddingBottom: space['6xl'] },
  timelineTextLast: { paddingBottom: 0 },
  timelineDetail: { marginTop: space.xs },

  shimmer: { borderRadius: radius.xs },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2xl'],
    paddingHorizontal: GUTTER,
    paddingVertical: space['3xl'],
  },
  pendingThumb: {
    width: control.thumb,
    height: control.thumb,
    borderRadius: radius.sm,
  },
  pendingText: { flex: 1, minWidth: 0, gap: space.md },
  pendingLine: { height: space.xl, width: '72%' },
  pendingLineShort: { height: space.lg, width: '44%' },

  // ── footer ──
  footer: { paddingHorizontal: GUTTER },
  footerHint: { textAlign: 'center', marginTop: space['2xl'] },
  metaSpacer: { height: space['5xl'] },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space['4xl'],
  },
});
