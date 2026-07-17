// Bulletproof keyboard inset — a single SharedValue every keyboard-aware layout
// reads, reconciled from THREE independent signals so no single missed native
// callback can strand the UI (glitch-audit-2026-07-17 G1/G2).
//
// Why one channel isn't enough (researched + reproduced on device/emulator):
//   • The per-frame channel (`useReanimatedKeyboardAnimation`, backed by
//     WindowInsetsAnimationCompat on Android) only fires when the IME hides
//     WITH an animation. Hardware-key dismissals (emulator/scrcpy, external
//     keyboards, some OEM IMEs) skip the animation → the value sticks at the
//     open height → dead gap under a mid-screen composer (G1).
//   • The discrete channel (`KeyboardEvents` didShow/didHide) comes from a
//     different native source and was observed to miss independently → a
//     boolean derived from it stranded the composer's safe-area inset (G2).
//   Because they fail independently, cross-clamping one with the other fixes
//   both; an AppState resync via `KeyboardController.state()` backstops the
//   (rare) case where both miss across a background/foreground hop.
//
// Consumers get ONE value: `inset.value` = current keyboard height, 0 when
// closed. Derive padding as `Math.max(inset.value, safeArea.bottom)` in an
// animated style — never gate a safe-area inset behind a keyboard boolean.
import { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  KeyboardController,
  KeyboardEvents,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import {
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Clamp-animation duration — long enough to read as motion, short enough that
 *  a missed-frame correction feels instant. */
const CLAMP_MS = 160;

export function useKeyboardInset(): SharedValue<number> {
  const kb = useReanimatedKeyboardAnimation();
  const inset = useSharedValue(0);

  // Channel 1 — per-frame animation (the smooth path). The library reports the
  // height as a negative translation on some platforms; mirror its magnitude.
  useAnimatedReaction(
    () => Math.abs(kb.height.value),
    (h, prev) => {
      if (h !== prev) inset.value = h;
    },
  );

  useEffect(() => {
    // Channel 2 — discrete events clamp the missed terminal frames. When both
    // channels work they agree on the same target, so the clamp is a no-op.
    const hide = KeyboardEvents.addListener('keyboardDidHide', () => {
      inset.value = withTiming(0, { duration: CLAMP_MS });
    });
    const show = KeyboardEvents.addListener('keyboardDidShow', (e) => {
      if (e.height > 0) inset.value = withTiming(e.height, { duration: CLAMP_MS });
    });

    // Channel 3 — background/foreground resync. On 'active', ask the native
    // side for the CURRENT truth (sync queries, not events) and converge.
    const app = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      try {
        const target = KeyboardController.isVisible()
          ? Math.abs(KeyboardController.state()?.height ?? 0)
          : 0;
        inset.value = withTiming(target, { duration: CLAMP_MS });
      } catch {
        // Older library / detached native module — channels 1+2 still stand.
      }
    });

    return () => {
      hide.remove();
      show.remove();
      app.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return inset;
}
