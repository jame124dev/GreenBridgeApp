// (lab) Processing — transient "AI is working" state (spec NewVersion/02-processing.md
// + dynamic wiring NewVersion/dynamic/04-mobile-integration-plan.md §4).
//
// Two behaviors, gated by LAB_CHAT_ENABLED (src/lib/flags.ts):
//   • OFF (default) — EXACT static prototype: a 3-layer spinner + title/subtitle +
//     a 3-step checklist (2 done, 1 in progress) that AUTO-ADVANCES to Draft after
//     AUTO_ADVANCE_MS (~2.6s). No on-screen taps; Android hardware-back cancels the
//     pending advance + goes Home. This path is untouched (no regression).
//   • ON — this screen OWNS the live stream open: it mints/reads the conversation
//     id (sessionStore), starts a turn (threadStore), and opens `labStream` against
//     the ASSISTANT `/chat/stream`. The checklist + spinner are driven from the P0
//     threadStore `turn` (real `stage.phase` → checklist steps). The 2600ms timer is
//     kept ONLY as a stall-ceiling fallback (advance if no frames ever arrive). On
//     `turn.status==='done'` OR a listing_draft → router.replace('/(lab)/draft');
//     on `turn.status==='error'` → inline error + Retry (re-runs the turn), no
//     auto-advance.
//
// Flow: home → processing → draft. Tab bar HIDDEN (pushed full-screen state).
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/ui';
import { fonts, greenDark, buyBlue, brand, lab, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useComposer } from '@/features/lab/stores/composerStore';
import { ProcessingSpinner } from '@/features/lab/components/ProcessingSpinner';
import { ProcessingStepRow } from '@/features/lab/components/ProcessingStepRow';

// --- Dynamic (LAB_CHAT_ENABLED) wiring -------------------------------------
import { LAB_CHAT_ENABLED } from '@/lib/flags';
import { labStream, LabStreamError } from '@/features/lab/streaming/labStream';
import { useThread } from '@/features/lab/stores/threadStore';
import { useSession } from '@/features/lab/stores/sessionStore';

/* -------------------------------------------------------------------------- */
/*  Screen-local constants (spec §5 — no magic strings inline)                 */
/* -------------------------------------------------------------------------- */

/** Auto-advance delay (prototype 2.6s). In the static path this is the advance
 *  trigger; in the live path it is retained ONLY as a stall ceiling — it fires a
 *  navigation just once and only if the stream never delivered a single frame. */
const AUTO_ADVANCE_MS = 2600;

/** Step visual states — matches the prototype 1:1 (2 done, 1 in-progress). Used
 *  verbatim by the static path; the live path derives states from `turn`. */
const STEP_STATES = ['done', 'done', 'active'] as const;

/** Ink shades — reference the shared lab.* palette (theme.ts) rather than
 *  re-declaring near-identical prototype hexes, so the greys can't drift from
 *  the rest of the (lab) screens (finding: consolidate greys onto lab tokens). */
const INK = lab.ink; // #10201A — title + done-step text
const INK_SUB = lab.inkSub; // #5E6E66 — subtitle (also ~4.9:1 on light bg)

/** Optional richer builds — off by default (1:1 prototype, spec §6). */
const ENABLE_STEP_POP = false; // pop checks in sequence instead of static
const ENABLE_SPARKLE_PULSE = false; // pulse the center sparkle

/* -------------------------------------------------------------------------- */
/*  Live stream: stage.phase → checklist progress                              */
/* -------------------------------------------------------------------------- */

/**
 * Map the live turn onto the 3-step checklist state array (same shape the static
 * path hardcodes). Steps 1 & 2 flip to `done` as the pipeline advances; step 3
 * stays the spinning `active` ring until the terminal frame. On chat turns (no
 * `stage` frames) we advance on token/data arrival + on the draft landing.
 */
function stepStatesForTurn(phase: string | undefined, hasDraft: boolean, hasText: boolean): readonly ('done' | 'active')[] {
  // How many of the first two steps are "done".
  let doneCount = 0;
  switch (phase) {
    case 'ai_running':
      doneCount = 1;
      break;
    case 'extracting_products':
    case 'done':
      doneCount = 2;
      break;
    case 'validating':
    case 'preparing_documents':
    case 'preparing_pdfs':
    default:
      doneCount = 0;
      break;
  }
  // Chat turns emit no `stage`; use prose/draft signals so the list still moves.
  if (hasDraft) doneCount = 2;
  else if (hasText && doneCount < 1) doneCount = 1;

  return [doneCount >= 1 ? 'done' : 'active', doneCount >= 2 ? 'done' : 'active', 'active'];
}

export default function LabProcessing() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { t } = useTranslation();

  // Mode is the single source of truth for copy + accent; read from the shared
  // composer store (Home wrote it). Never mutated here.
  const mode = useComposer((s) => s.mode);
  // Accent is derived from mode (spec §2 "Mode accent"): green sell / blue buy.
  const accent = mode === 'buy' ? buyBlue : greenDark;
  // Mode-varied checklist labels (i18n; static prototype copy, keyed by mode).
  const steps = [
    t(`mobile.labProcessing.step1.${mode}`),
    t(`mobile.labProcessing.step2.${mode}`),
    t(`mobile.labProcessing.step3.${mode}`),
  ];

  // Timer id in a ref so the back handler can clear the SAME timer the effect
  // scheduled — prevents a stale-timer / double-navigation race (spec §4).
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards a single navigation (fallback timer, done, draft — whichever first).
  const navigatedRef = useRef(false);

  // Dismiss the keyboard on mount so the RISE entrance is clean if we arrived
  // from a focused composer (spec §7 Keyboard).
  useEffect(() => {
    Keyboard.dismiss();
  }, []);

  const goToDraft = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    haptics.impact(); // Medium — "advancing" cue (device only)
    router.replace('/(lab)/draft');
  }, [router]);

  // ────────────────────────────── STATIC PATH ──────────────────────────────
  // When the flag is OFF, keep the prototype behavior VERBATIM: a single timer
  // that auto-advances to Draft after AUTO_ADVANCE_MS. (No stream, no turn.)
  useEffect(() => {
    if (LAB_CHAT_ENABLED) return; // live path owns navigation below
    timerRef.current = setTimeout(() => {
      haptics.impact(); // Medium — "step 3 complete / advancing" cue (device only)
      router.replace('/(lab)/draft');
    }, AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [mode, router]);

  // ─────────────────────────────── LIVE PATH ───────────────────────────────
  // Subscribe to the P0 threadStore `turn`. Only meaningful when the flag is ON;
  // when OFF the turn stays idle/empty and nothing here fires.
  const turn = useThread((s) => s.turn);

  // AbortController for the in-flight stream, so back / unmount cancels it.
  const abortRef = useRef<AbortController | null>(null);
  // Re-run trigger for Retry (bumping re-invokes the stream effect).
  const [attempt, setAttempt] = useState(0);

  // Open the stream turn. Reads the composer input + mode, mints/reads the
  // conversation id, starts the thread turn, and streams `/chat/stream`. Frames
  // are folded into the threadStore via `applyFrame` (drives the UI below).
  const start = useCallback(() => {
    if (!LAB_CHAT_ENABLED) return;
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!LAB_CHAT_ENABLED) return;

    const message = useComposer.getState().input;
    const convId = useSession.getState().getConversationId();
    useThread.getState().startTurn();

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    labStream({
      endpoint: '/chat/stream',
      body: {
        conversation_id: convId,
        message,
        site_type: 'labgreenbidz',
        mode: mode === 'sell' ? 'seller' : 'buyer',
      },
      signal: ctrl.signal,
      onEvent: (ev) => useThread.getState().applyFrame(ev),
    }).catch((err) => {
      // Abort is expected on back/unmount — the threadStore already carries any
      // terminal `error` frame (applied via onEvent) for the inline error UI.
      if (err instanceof LabStreamError && err.code === 'cancelled') return;
      // Fatal transport errors that never produced an `error` frame: surface via
      // the thread so the inline error + Retry renders.
      if (useThread.getState().turn.status !== 'error') {
        useThread.getState().applyFrame({
          type: 'error',
          data: {
            detail: err instanceof Error ? err.message : 'The assistant hit an error',
            code: err instanceof LabStreamError ? err.code : 'error',
            retriable: err instanceof LabStreamError ? err.retriable : true,
          },
        });
      }
    });

    return () => {
      ctrl.abort();
      if (abortRef.current === ctrl) abortRef.current = null;
    };
  }, [mode, attempt]);

  // Advance to Draft on the terminal `done` frame OR the moment a listing_draft
  // lands (whichever first). Never auto-advance on error.
  useEffect(() => {
    if (!LAB_CHAT_ENABLED) return;
    if (turn.status === 'error') return;
    if (turn.status === 'done' || turn.draft != null) goToDraft();
  }, [turn.status, turn.draft, goToDraft]);

  // Stall-ceiling fallback (live path only): if the stream has not delivered a
  // single frame by AUTO_ADVANCE_MS, advance anyway so a stalled/slow stream
  // still moves. Any frame (phase/text/card/draft) cancels the fallback.
  useEffect(() => {
    if (!LAB_CHAT_ENABLED) return;
    if (turn.status === 'error') return;
    const hasAnyFrame = !!turn.phase || turn.text.length > 0 || turn.cards.length > 0 || turn.draft != null;
    if (hasAnyFrame) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }
    if (timerRef.current || navigatedRef.current) return;
    timerRef.current = setTimeout(goToDraft, AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [turn.phase, turn.text, turn.cards, turn.draft, turn.status, goToDraft]);

  // Android hardware-back (decided default, spec §4/§7): cancel the pending
  // advance + any in-flight stream, go Home, and mark the event handled.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      abortRef.current?.abort();
      router.back(); // → Home
      return true;
    });
    return () => sub.remove();
  }, [router]);

  const onRetry = useCallback(() => {
    navigatedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    start();
  }, [start]);

  // RISE entrance (spec §6): fade + slide-up 350ms spring; reduced-motion →
  // opacity-only FadeIn 200ms. Exit: FadeOutDown 250ms as Draft's RISE enters.
  const entering = reducedMotion
    ? FadeIn.duration(200)
    : FadeInUp.duration(350).springify().dampingRatio(0.75);

  // Derive the checklist states + title. Static path uses STEP_STATES verbatim;
  // live path derives from the streamed `turn`.
  const liveError = LAB_CHAT_ENABLED && turn.status === 'error';
  const stepStates = LAB_CHAT_ENABLED
    ? stepStatesForTurn(turn.phase, turn.draft != null, turn.text.length > 0)
    : STEP_STATES;

  return (
    <Screen
      scroll={false}
      padded={false}
      // Paint the intentional cool-neutral surface (spec §2/§94 = brand.background
      // #f8f9ff) rather than relying on the `bg-bg` token (which maps to pure
      // white); this keeps Processing and Draft on one uniform surface so the
      // spinner/step tracks read as they were tuned.
      style={{ backgroundColor: brand.background }}
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing['2xl'], // 24 — large-screen padding token (was raw 30)
      }}
    >
      <Animated.View
        entering={entering}
        exiting={FadeOutDown.duration(250)}
        style={{ width: '100%', alignItems: 'center' }}
      >
        {liveError ? (
          /* Inline error + Retry (live path, terminal error frame). No spinner,
             no auto-advance — the user drives the re-run. */
          <View style={{ width: '100%', maxWidth: 320, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: fonts.headingBold,
                fontSize: 22,
                textAlign: 'center',
                color: INK,
                letterSpacing: -0.44,
                marginBottom: 8,
              }}
            >
              {t('mobile.labProcessing.errorTitle')}
            </Text>
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 13.5,
                lineHeight: 20, // explicit leading (≈ typography.bodySm 14/20) — no default tight RN leading
                textAlign: 'center',
                color: INK_SUB,
                marginBottom: spacing['2xl'], // 24
              }}
            >
              {turn.error?.detail ?? t('mobile.labProcessing.errorFallback')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              // Sole error-recovery affordance — clear the 48pt layout.minTouch
              // target with margin (paddingVertical 14 → ~48pt) + a hit-slop cushion.
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => ({
                backgroundColor: accent,
                paddingHorizontal: 28,
                paddingVertical: 14,
                borderRadius: 999,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: '#fff' }}>{t('mobile.labProcessing.retry')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Spinner */}
            <ProcessingSpinner
              accent={accent}
              reducedMotion={reducedMotion}
              pulse={ENABLE_SPARKLE_PULSE}
            />

            {/* Title */}
            <Text
              style={{
                fontFamily: fonts.headingBold,
                fontSize: 24,
                textAlign: 'center',
                color: INK,
                letterSpacing: -0.48,
                marginBottom: 8,
              }}
            >
              {t(`mobile.labProcessing.title.${mode}`)}
            </Text>

            {/* Subtitle */}
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 13.5,
                lineHeight: 20, // explicit leading (≈ typography.bodySm 14/20) — matches draft subcopy rhythm
                textAlign: 'center',
                color: INK_SUB,
                marginBottom: spacing['3xl'], // 32
              }}
            >
              {t('mobile.labProcessing.subtitle')}
            </Text>

            {/* Step checklist */}
            <View style={{ width: '100%', maxWidth: 280, alignSelf: 'center', gap: spacing.lg }}>
              {steps.map((label, i) => (
                <ProcessingStepRow
                  key={i}
                  state={stepStates[i]}
                  label={label}
                  accent={accent}
                  reducedMotion={reducedMotion}
                  pop={ENABLE_STEP_POP}
                  index={i}
                />
              ))}
            </View>
          </>
        )}
      </Animated.View>
    </Screen>
  );
}
