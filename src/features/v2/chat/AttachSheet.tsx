/**
 * `AttachSheet` — the one "＋" in the composer, opened into a choice of sources.
 *
 * ── WHY ONE CONTROL INSTEAD OF TWO ──
 *
 * The composer carried a camera glyph AND a paperclip, side by side, each eating
 * horizontal room from the field between them. ChatGPT's composer collapses the
 * same choice behind a single `＋` that opens a menu, which buys the text field
 * its width back and leaves one thing to aim at instead of two.
 *
 * It also fixes an omission: the old pair offered camera and documents but no
 * way to pick an existing PHOTO. `useAttachmentPicker` has had `pickLibrary`
 * all along and nothing in v2 called it.
 *
 * ── WHY @gorhom/bottom-sheet AND NOT A HAND-ROLLED MODAL ──
 *
 * The smoothness is the feature: drag-to-dismiss that tracks the finger, a
 * backdrop that fades with the gesture rather than on a timer, velocity-aware
 * settling, and content-height sizing. That is a lot of behaviour to get wrong,
 * and it is already a dependency here with `BottomSheetModalProvider` mounted
 * in `app/_layout.tsx`, already driving `LabListingEditSheet`. This file
 * follows that screen's prop-for-prop setup and changes only the skin.
 *
 * v2's own `SignInSheet` was the other candidate. It is a plain RN `Modal` with
 * a timed rise and NO pan-to-dismiss — right for a sheet that must be answered,
 * wrong for a casual menu you flick away.
 *
 * ⚠️ RNGH inside a sheet: `Row` presses work here because the library renders
 * its content inside its own gesture context. This is NOT true of a raw RN
 * `<Modal>`, where a `GestureHandlerRootView` has to be added by hand or every
 * control inside is silently dead.
 */
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import { StyleSheet, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackgroundProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, FileText, Images } from "lucide-react-native";

import {
  GUTTER,
  V2ThemeBridge,
  icon,
  radius,
  space,
  useV2Colors,
  useV2Theme,
} from "@/theme/v2";
import { Hairline, MaterialFill, Row, Text } from "../ui";

export type AttachSheetRef = { present: () => void; dismiss: () => void };

export type AttachSource = "camera" | "library" | "file";

/**
 * The three sources, in the order a seller reaches for them.
 *
 * Camera first because the whole product is "point it at the nameplate". The
 * subtitles say what each one is FOR, not what it is — a row reading "Files"
 * tells someone nothing about the spreadsheet lane.
 */
const SOURCES: readonly {
  key: AttachSource;
  title: string;
  subtitle: string;
  Glyph: typeof Camera;
}[] = [
  {
    key: "camera",
    title: "Take a photo",
    subtitle: "Point at the nameplate and we read it",
    Glyph: Camera,
  },
  {
    key: "library",
    title: "Choose from photos",
    subtitle: "Pick one or several you already have",
    Glyph: Images,
  },
  {
    key: "file",
    title: "Add a file",
    subtitle: "A spec sheet or a list — PDF, Word, Excel",
    Glyph: FileText,
  },
];

export const AttachSheet = forwardRef<
  AttachSheetRef,
  { onPick: (source: AttachSource) => void }
>(function AttachSheet({ onPick }, ref) {
  const c = useV2Colors();
  // Read OUTSIDE the portal and carry it in — see `V2ThemeBridge`.
  const theme = useV2Theme();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

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

  const choose = useCallback(
    (source: AttachSource) => {
      // Dismiss FIRST, then hand back. Launching the camera from under a
      // sheet that is still animating out leaves the sheet re-presented on
      // top of the picker's result on Android.
      sheetRef.current?.dismiss();
      onPick(source);
    },
    [onPick],
  );

  /**
   * The sheet's own ground, ramped.
   *
   * `backgroundStyle` takes a plain style and would have left this the one
   * flat plane in a screen where every other filled surface ramps —
   * `v2MaterialCoverage` caught exactly that. The library's
   * `backgroundComponent` is the supported way to own the ground, so the
   * ramp goes here rather than into an exemption list.
   */
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
      <BottomSheetView
        style={[styles.body, { paddingBottom: insets.bottom + space["3xl"] }]}
      >
        <V2ThemeBridge value={theme}>
          <Text variant="h3" style={styles.title}>
            Add to your message
          </Text>

          {SOURCES.map((s, i) => (
            <React.Fragment key={s.key}>
              {i > 0 ? <Hairline /> : null}
              <Row
                title={s.title}
                subtitle={s.subtitle}
                leading={
                  <View
                    style={[styles.coin, { backgroundColor: c.accentWash }]}
                  >
                    <MaterialFill
                      role="accentWash"
                      ink="accent"
                      radius={radius.pill}
                    />
                    <s.Glyph
                      size={icon.lg}
                      color={c.accent}
                      strokeWidth={1.9}
                    />
                  </View>
                }
                onPress={() => choose(s.key)}
                testID={`v2-attach-${s.key}`}
              />
            </React.Fragment>
          ))}
        </V2ThemeBridge>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  grabber: { width: 36, height: 4 },
  sheetGround: {
    // Clips the ramp to the sheet's rounded top.
    overflow: "hidden",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  body: { paddingTop: space.xl },
  title: { paddingHorizontal: GUTTER, paddingBottom: space["3xl"] },
  coin: {
    overflow: "hidden",
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
