/**
 * The v2 sign-in gate — the sheet a guest gets when they reach for something
 * that genuinely needs an account.
 *
 * ── Why this exists next to `features/auth/SignInPrompt` ──
 *
 * Same store, same copy, same three routes out. What differs is that this one
 * is drawn in v2 tokens. The shipped prompt uses `constants/theme` and the old
 * `Button`, so inside `app/v2/` it was the one surface that did not match:
 * white in dark mode, 20pt corners against the app's 26, and — the real
 * problem — THREE full-width buttons stacked in a column, which is three
 * primary actions and no hierarchy.
 *
 * Restyling the shipped one in place was the wrong move: it is mounted in
 * `app/(lab)/_layout.tsx` and would have changed the appearance of the app
 * people are using today, mid-coexistence, for no reason.
 *
 * ⚠️ Exactly ONE of the two may be mounted at a time. `app/v2/_layout.tsx`
 * mounts this; `app/(lab)/_layout.tsx` mounts the other. They read the same
 * store, so mounting both would open two sheets on one tap.
 *
 * ── The hierarchy ──
 *
 *   Create account              filled pill  — the one green thing   ┐ one
 *   I already have an account   tinted pill  — same shape, tinted    ┘ group
 *                                                (22pt)
 *   Keep browsing               text         — quiet, but never hidden
 *
 * The two ways IN are a group; the way OUT is not a third item in it. Measured
 * 2026-09-17, the three sat ~10pt apart inside 26pt of clearance — one cramped
 * slab in an otherwise empty sheet, reported as "the popup looks very empty".
 * The fix was rhythm, not more content: 16 within the pair, 22 before the
 * escape (`spacing-and-layout.md` R2, coarse end for distinct elements).
 *
 * Type is `h2` + `lead`, not `h3` + `body`. This sheet is the only thing on
 * screen, so it is not a card heading, and its paragraph is the long-form one
 * `typography.md` R2 gives `lead` to. 17/13 also put title and body 4pt apart,
 * which is not a hierarchy.
 *
 * The middle one is TINTED, not `variant="quiet"`: the outlined variant draws
 * its border in `hairlineStrong`, which measures 1.19:1 against this sheet's
 * surface — the outline is not perceivable, so the control would read as a
 * green label rather than the second of three ranked choices.
 *
 * "Keep browsing" is not decoration. Guideline 5.1.1(v) is why guests exist
 * here at all, and a gate with no visible way out is the wall that got 1.0.3
 * (21) rejected. It stays a labelled 44pt target, above the home indicator,
 * alongside the two other ways out (tap the scrim, press back).
 *
 * No drag handle: this sheet does not drag. A grabber that does nothing is a
 * promise the surface cannot keep.
 *
 * ⚠️ The ground behind is `c.backdrop`, NOT `c.scrim`. `scrim` is the gradient
 * over a banner photograph (0.34) and is too weak to push a whole screen back:
 * as a composite the sheet cleared only 2.04:1 against it, against 3.76:1 with
 * `backdrop`. Sampled off a device screenshot the page behind went #5E6663 →
 * #424E4A (5.56:1 → 8.17:1) — Android's Modal contributes a dialog dim of its
 * own, which iOS does not, so the token figure is the one that would have
 * shipped on iPhone. See the `backdrop` note in `palette.ts`.
 */
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
// REQUIRED inside a RN <Modal>: RNGH's gestures do not reach a modal's
// subtree without their own root view. See the note on <GestureHandlerRootView> below.
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GATE_COPY } from '@/features/auth/gateCopy';
import { useSignInPromptStore } from '@/features/auth/signInPromptStore';
import { PrimaryAction, QuietAction, Text } from '@/features/v2/ui';
import {
  GUTTER,
  HAIRLINE_WIDTH,
  duration,
  easing,
  radius,
  shadow,
  space,
  timing,
  useV2Colors,
} from '@/theme/v2';

/** How far the card travels up. Far enough to read as arriving from the edge. */
const RISE = 28;

export function SignInSheet() {
  const { t } = useTranslation();
  const reason = useSignInPromptStore((s) => s.reason);
  const close = useSignInPromptStore((s) => s.close);
  const insets = useSafeAreaInsets();
  const c = useV2Colors();
  // Read here, not inside `go`: hooks cannot run after the `if (!reason)`
  // early return below, and `go` is called from a handler, not a render.
  const pathname = usePathname();

  // Built on the JS thread and captured by the worklet below — `timing()` is
  // not a worklet and throws if it is called from the UI thread.
  const enter = timing(duration.slow, easing.standard);
  const rise = useSharedValue(0);

  useEffect(() => {
    // The Modal remounts per open (it is only rendered when `reason` is set),
    // so this runs once per appearance rather than needing a reset.
    rise.value = withTiming(1, enter);
    // `enter` is a fresh object each render; the animation must not restart on
    // an unrelated re-render, so only the mount matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const riseStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateY: (1 - rise.value) * RISE }],
  }));

  if (!reason) return null;
  const copy = GATE_COPY[reason];

  const go = (path: '/(auth)/login' | '/(auth)/register') => {
    // REMEMBER WHERE WE CAME FROM, or signing in throws the person out of v2.
    // `login.tsx` finishes with `router.replace('/(lab)/(tabs)/home')` — the
    // OLD home — so without this a guest who gates on a v2 screen signs in and
    // lands in the previous UI, with no way back except the dev door. Seen on
    // device 2026-09-16 and reported by the user before that.
    //
    // `pathname` and not `href`: query params on these screens are navigation
    // state, and re-entering a half-filled form after an auth round-trip is
    // worse than re-entering the screen clean.
    useSignInPromptStore.getState().setReturnTo(pathname);

    // PUSH FIRST, then close. The other order loses the navigation: `close()`
    // unmounts the <Modal>, and the push issued in the same tick races the
    // dismissal — on device the sheet closed and the app simply stayed on the
    // screen behind it. Pushing first lets the route land; the sheet then
    // unmounts over the top of it, which is invisible.
    router.push(path);
    close();
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={close}
      // Android: without this the scrim stops at the status bar and the sheet
      // reads as a panel inside the screen rather than over it.
      statusBarTranslucent
    >
      {/*
        ⚠️ THE SCRIM IS A SIBLING BEHIND THE CARD, NOT ITS PARENT.

        It used to wrap the card, with a no-op `<Pressable onPress={() => {}}>`
        on the card to stop a tap closing the sheet. That swallow CAPTURED every
        tap and its own children never saw one: on device the scrim dismissed
        fine while "Create account" and "I already have an account" were both
        completely dead, so a guest could open the gate and then neither sign in
        nor register from it.

        ⚠️ THE REAL CAUSE WAS THE MISSING `GestureHandlerRootView`, NOT THE
        NESTING. A RN `<Modal>` renders its subtree in a SEPARATE native view
        hierarchy, and RNGH only attaches its recogniser under a
        `GestureHandlerRootView` — the app-level one in `app/_layout.tsx` does
        not reach inside a modal. So every RNGH control here was inert while the
        scrim, which is RN's own `Pressable`, kept working. That asymmetry is
        the tell: if one control in a modal works and the rest do not, check
        WHICH `Pressable` each imports before touching the layout.

        The sibling structure below is kept anyway — it is correct regardless,
        and a no-op swallow whose only job is to fight its parent is worth not
        having.

        Siblings have no such contest. The scrim fills the screen underneath and
        the card sits on top, so a tap lands on exactly one of them and the card
        needs no swallow at all.
      */}
      <GestureHandlerRootView style={styles.root}>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.auth.gate.dismiss', { defaultValue: 'Dismiss' })}
          // flat: a backdrop scrim.
          style={[StyleSheet.absoluteFill, { backgroundColor: c.backdrop }]}
        />
        <Animated.View style={riseStyle}>
          <View
            accessibilityViewIsModal
            style={[
              styles.card,
              shadow.raised,
              {
                // flat: the sheet is a page ground, like Screen — depth would lift the whole modal.
                backgroundColor: c.surface,
                // The sheet's own top edge. In LIGHT the surface is nearly the
                // colour of the page under it and the scrim does all the
                // separating; in DARK the shadow does nothing at all, so
                // without this line the sheet's boundary is only where the
                // corners curve. 1.19:1 light / 1.60:1 dark — a visible step,
                // still under the 2:1 that would make it read as a border.
                borderTopColor: c.hairlineStrong,
                borderTopWidth: HAIRLINE_WIDTH,
                // The escape hatch is the LAST control; clipping it under the
                // system nav bar turns the 5.1.1 fix back into a wall.
                paddingBottom: insets.bottom + space['3xl'],
              },
            ]}
          >
            <Text variant="h2">
              {t(`mobile.auth.gate.${reason}.title`, { defaultValue: copy.title })}
            </Text>
            <Text variant="lead" color="inkMuted" style={styles.body}>
              {t(`mobile.auth.gate.${reason}.body`, { defaultValue: copy.body })}
            </Text>

            {/* The two ways IN. One group. */}
            <View style={styles.actions}>
              <PrimaryAction
                label={t('mobile.auth.gate.createAccount', { defaultValue: 'Create account' })}
                onPress={() => go('/(auth)/register')}
              />
              <PrimaryAction
                variant="tinted"
                label={t('mobile.auth.gate.signIn', { defaultValue: 'I already have an account' })}
                onPress={() => go('/(auth)/login')}
              />
            </View>

            {/* The way OUT — a different kind of answer, so it sits outside the
                group rather than as a third item in it. */}
            <View style={styles.escape}>
              <QuietAction
                label={t('mobile.auth.gate.keepBrowsing', { defaultValue: 'Keep browsing' })}
                onPress={close}
              />
            </View>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // The card is pinned to the bottom; the scrim fills the rest behind it.
  root: { flex: 1, justifyContent: 'flex-end' },
  card: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: GUTTER,
    paddingTop: space['6xl'],
  },
  /** Inside the text block — title and paragraph are one thing. */
  body: { marginTop: space.lg },
  /**
   * `3xl` (16), not `lg` (10).
   *
   * Measured on the rendered sheet 2026-09-17: the three controls sat ~10pt
   * apart inside 26pt of clearance, so they read as one cramped slab floating
   * in empty space — which is what "the popup looks empty" actually was. 10 is
   * in the 2–12 band `spacing-and-layout.md` R2 reserves for space INSIDE a
   * component (icon-to-label, chip padding); gaps between distinct controls
   * come from the coarse end. 16 < the 26 above it, so internal ≤ external
   * still holds.
   */
  actions: { marginTop: space['6xl'], gap: space['3xl'] },
  /**
   * The escape hatch is a different rank, so it is separated from the pair
   * rather than evenly spaced with it — 22 against the group's 16. Same R2
   * principle one level up: the two sign-in choices are the group, and this is
   * outside it.
   */
  escape: { marginTop: space['5xl'] },
});
