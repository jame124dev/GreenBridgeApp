/**
 * `ConfirmSheet` — the confirm step before a WRITE. Accept an offer, cancel
 * an order: an action that changes money or state and deserves a pause, not
 * a spinner.
 *
 * ── PROVENANCE — this is the one piece of today's work that was never
 * actually borrowed until now ──
 *
 * Two screens (`seller-offers`, `seller-orders`) each grew their own copy of
 * a confirm sheet, and both traced back to `auth/SignInSheet.tsx` — a plain
 * RN `<Modal>` with a timed fade, hand-built with no external source at all.
 * That was the gap: everything else this session traced to a clone; this
 * chain's root never did.
 *
 * Rebuilt from `chat/AttachSheet.tsx` instead — a REAL, already-v2-adapted
 * `@gorhom/bottom-sheet` implementation already in this codebase, which is
 * itself Obytes' `components/ui/modal.tsx`
 * (`ui_git_repo/obytes-template/src/components/ui/modal.tsx`) — the
 * `useModal()` present/dismiss hook, the `BottomSheetModal` +
 * `backdropComponent` + a header, adjusted from NativeWind to v2 tokens and
 * from Obytes' own icon/backdrop chrome to ours. `AttachSheet.tsx`'s
 * docblock already made the case against `SignInSheet`'s pattern: "a plain
 * RN Modal with NO pan-to-dismiss — right for a sheet that must be
 * answered, wrong for a casual menu you flick away." A confirm sheet sits
 * between those two: it should be easy to dismiss (swiping away is the same
 * as Cancel — nothing is lost) but the content itself should feel weighed,
 * not flicked past, which is what the explicit Cancel button underneath the
 * primary action is for.
 *
 * This is a genuine promotion into the kit, not a third copy: TWO screens
 * needed the identical shape before this was built, which is the KIT GAP
 * threshold this codebase's own convention sets (see `ConfirmOrderSheet.tsx`,
 * now deleted, which named this exact threshold and then met it).
 *
 * ⚠️ THE THEME-BRIDGING TRAP, TWICE. `BottomSheetModalProvider` is mounted
 * in `app/_layout.tsx`, above `V2ThemeProvider` (`app/v2/_layout.tsx`), so
 * anything the portal renders is OUTSIDE the v2 theme context and needs
 * `V2ThemeBridge` — read `useV2Theme()` OUTSIDE the portal and carry it in,
 * wrapping BOTH `backgroundComponent` and the body content, not just one.
 */
import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackgroundProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GUTTER,
  V2ThemeBridge,
  radius,
  space,
  useV2Colors,
  useV2Theme,
} from '@/theme/v2';

import { MaterialFill } from './Surface';
import { PrimaryAction } from './PrimaryAction';
import { QuietAction } from './QuietAction';
import { Text } from './Text';

export type ConfirmSheetRef = { present: () => void; dismiss: () => void };

export const ConfirmSheet = forwardRef<
  ConfirmSheetRef,
  { title: string; body: string; confirmLabel: string; onConfirm: () => void }
>(function ConfirmSheet({ title, body, confirmLabel, onConfirm }, ref) {
  const c = useV2Colors();
  // Read OUTSIDE the portal and carry it in — see the docblock.
  const theme = useV2Theme();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const confirm = useCallback(() => {
    // Dismiss FIRST, then act — same ordering `AttachSheet` uses and for the
    // same reason: a caller that navigates or shows a toast from `onConfirm`
    // should not do it while the sheet is still animating out.
    sheetRef.current?.dismiss();
    onConfirm();
  }, [onConfirm]);

  const renderBackdrop = useCallback(
    (p: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...p}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  );

  /** The sheet's own ground, ramped — see `AttachSheet.tsx`'s note on `backgroundComponent`. */
  const renderBackground = useCallback(
    ({ style }: BottomSheetBackgroundProps) => (
      <View style={[style, styles.sheetGround, { backgroundColor: c.surface }]}>
        <V2ThemeBridge value={theme}>
          <MaterialFill role="surface" ink="ink" radius={radius.xl} />
        </V2ThemeBridge>
      </View>
    ),
    [c.surface, theme],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      handleIndicatorStyle={[
        styles.grabber,
        // flat: a 4pt drag indicator is a line, not a ground.
        { backgroundColor: c.hairlineStrong },
      ]}
      backgroundComponent={renderBackground}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView style={[styles.body, { paddingBottom: insets.bottom + space['3xl'] }]}>
        <V2ThemeBridge value={theme}>
          <Text variant="h2" style={styles.title}>
            {title}
          </Text>
          <Text variant="lead" color="inkMuted">
            {body}
          </Text>

          <View style={styles.actions}>
            <PrimaryAction label={confirmLabel} onPress={confirm} />
            <QuietAction label="Cancel" onPress={() => sheetRef.current?.dismiss()} />
          </View>
        </V2ThemeBridge>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  grabber: { width: 36, height: 4 },
  sheetGround: {
    overflow: 'hidden',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  body: { paddingHorizontal: GUTTER, paddingTop: space.xl },
  title: { marginBottom: space.lg },
  actions: { marginTop: space['6xl'], gap: space['3xl'] },
});
