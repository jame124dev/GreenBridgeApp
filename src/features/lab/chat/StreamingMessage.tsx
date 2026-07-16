// StreamingMessage — the live turn's render driver (A4 §2.1 / §4 Tier 1). It is
// the ONLY component that subscribes to `activeTurn` token-level fields (A2 I10),
// so a token burst re-renders THIS node and nothing else in the committed list.
// It renders the SHARED `AssistantMessage` (same subtree the committed path uses,
// A4 §12.7) with the typewriter-revealed buffer + live cards, so streaming and
// committed can never drift. PR-8 deleted the forked `LiveBotBubble`.
//
// R3 (behind CHAT_UI_V2): word-by-word reveal + a blinking caret + a soft ambient
// accent glow behind the streaming bubble that fades when the turn settles. All
// gated on the flag, so the flag-off path is the exact Phase-1 render (the shared
// AssistantMessage, char reveal, no glow/caret) — snapshots stay byte-identical.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radius } from '@/constants/theme';
import { CHAT_UI_V2 } from '@/lib/flags';
import { useThread } from '@/features/lab/stores/threadStore';
import { useStreamReveal } from './hooks/useStreamReveal';
import { AssistantMessage, type CardActionHandlers } from './ChatMessage';
import { streamSafeText } from './streamSanitizer';
import { useColor } from './theme';

/** Left-aligned row (layout-only; mirrors ChatMessage's `rowLeft`). */
const ROW_LEFT = { alignItems: 'flex-start', width: '100%' } as const;

/** R3 caret — a block cursor appended to the live text while streaming. */
const CARET = '▋';

export type StreamingMessageProps = CardActionHandlers & {
  mode: 'buyer' | 'seller';
};

export function StreamingMessage({ mode, ...handlers }: StreamingMessageProps) {
  // Sole token-level subscriber (A2 I10). Reveal is leaf-local (A2 rows 5/6) —
  // the raw buffer stays in the store; the revealed substring lives only here.
  // The real settled flag lets the hook flush any reveal backlog IN PLACE while
  // this leaf is still mounted through the done/error window (D3 handoff).
  const turn = useThread((s) => s.turn);
  const revealed = useStreamReveal(turn.text, turn.status !== 'streaming', CHAT_UI_V2);
  const streaming = turn.status === 'streaming';
  // ORDERING CONSTRAINT: sanitize the REVEALED substring, never turn.text
  // upstream of useStreamReveal — the strips shrink the text when a field
  // bullet completes, which would make the hook's source non-monotonic and trip
  // its shrink-reset, wiping the visible bubble mid-answer. Plain expression is
  // fine (this leaf re-renders per reveal frame anyway); turn.cards rides the
  // existing whole-turn subscription — no new token-level subscriber (A2 I10).
  //
  // `settled` only once the reveal has CAUGHT UP: at the terminal frame's own
  // render `revealed` still lags turn.text (the instant flush lands a rAF tick
  // later), and streamSafeText's settled path skips sanitizeStreamTail — passing
  // bare !streaming painted the lagging prefix UNSANITIZED for that one frame
  // (raw "**bol" / half-URL / partial fence at every settle; review MAJOR-1).
  // Once revealed === turn.text the final paint still converges to
  // resolveBotText, keeping the D3 swap pixel-identical.
  const safe = streamSafeText(revealed, turn.cards, !streaming && revealed === turn.text);

  // Ambient glow (R3): a slow opacity pulse while streaming, cancelled on settle.
  // Hooks run unconditionally (Rules of Hooks) — inert when the flag is off.
  const glowColor = useColor('glow');
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (CHAT_UI_V2 && streaming) {
      pulse.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [streaming, pulse]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.28 + pulse.value * 0.34 }));

  // Render through the transient done/error window too (D3): the reducer always
  // pairs commit with reset, so a settled turn lives exactly one effect-pass —
  // the controller's append+reset batch then nulls this leaf and mounts the
  // committed row in the SAME render (no blank gap frame, no double scroll pin).
  // Only idle (never-started or already-reset) renders nothing. Hooks run
  // unconditionally above; the early return is after them so hook order is
  // stable. NOTE: the JSX below keeps the literal `streaming` attr through the
  // done window — switching it to the computed status would swap the cards
  // wrapper Animated.View→View and remount the cards for one frame.
  if (turn.status === 'idle') return null;

  // Flag OFF → the exact Phase-1 render (shared bubble, char reveal, no chrome).
  if (!CHAT_UI_V2) {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={ROW_LEFT}>
        <AssistantMessage streaming phase={turn.phase} text={safe} cards={turn.cards} mode={mode} {...handlers} />
      </Animated.View>
    );
  }

  // Flag ON → append the caret (only while streaming AND there is text — the
  // thinking dots own the pre-first-token state, and the caret must vanish at
  // settle; appended AFTER sanitizing so it never sits inside a held token) and
  // lay a soft accent halo behind the bubble.
  const shown = streaming && safe ? `${safe}${CARET}` : safe;
  return (
    <Animated.View entering={FadeIn.duration(200)} style={ROW_LEFT}>
      <View style={styles.host}>
        <Animated.View
          pointerEvents="none"
          style={[styles.glow, glowStyle, { boxShadow: `0 0 22px 2px ${glowColor}` }]}
        />
        <AssistantMessage streaming phase={turn.phase} text={shown} cards={turn.cards} mode={mode} {...handlers} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { width: '100%', position: 'relative' },
  // Left-aligned soft halo sized to sit behind the text bubble (which caps at
  // 92% and hugs left). Pure shadow — no hard fill — so it reads as ambient glow.
  glow: {
    position: 'absolute',
    left: 0,
    top: 2,
    bottom: 2,
    width: '80%',
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
  },
});
