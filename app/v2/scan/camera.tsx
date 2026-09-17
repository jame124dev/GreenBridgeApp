/**
 * 3b — Scan an item. The camera.
 *
 * Drawn in `docs/v2-design/screens/t3-full.html` (turn 3, "Camera and voice,
 * made visible"). Shape, over the live viewfinder:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │  ✕                        ⚡   ▣              │  close · flash · gallery
 *   │                                              │
 *   │        ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐               │
 *   │        │                     │  guided frame │
 *   │        └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘               │
 *   │            Frame the nameplate               │
 *   │                                              │
 *   │   ▣ 3            ( ◉ )              🎤       │  roll · shutter · voice
 *   └──────────────────────────────────────────────┘
 *
 * ── WHY THIS EXISTS WHEN A CAMERA ALREADY SHIPPED ──
 *
 * `app/scan/camera.tsx` works and keeps working — this does not replace it.
 * v2 needed its own because the drawn screen is a different one: the canvas
 * says of the shipped camera, "The camera was a 40 px grey square in your
 * build", and turn 3 is the answer to that. It also closes the v2 loop: the
 * scan flow used to hand off to the OLD camera, so pressing "Scan an item"
 * inside v2 left v2 entirely.
 *
 * ⚠️ THE CAPTURE PATH IS BORROWED, NOT REINVENTED. `takePictureAsync({quality:
 * 0.85})` → `compressPhoto` → `useScanDraft.start(photos)` is lifted from the
 * shipped screen, which has been through real use. Only the chrome is new.
 * If the capture pipeline changes, change it there first and mirror it here.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ──
 *
 * The drawing shows a LIVE read-out over the frame — "✦ Waters Alliance e2695
 * / Read from the label · chromatography" — recognising the nameplate while
 * you frame it. That is the background-recognition feature, which exists
 * behind `EXPO_PUBLIC_BACKGROUND_RECOGNITION` and is currently OFF. Drawing a
 * chip that never fills would be a control that only explains itself, so the
 * read-out renders only when the flag is on and something has actually been
 * recognised. Nothing fake sits over the viewfinder.
 *
 * The mic goes to the assistant (3a) rather than recording here — 3a is the
 * voice turn and it is not built yet, so the control is absent rather than
 * dead. See `V2_CHECKLIST.md`.
 */
import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native — see `home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { Images, X, Zap, ZapOff } from 'lucide-react-native';

import { EmptyState, MaterialFill, Screen, ScrimPill, Text } from '@/features/v2/ui';
import {
  GUTTER,
  MIN_TOUCH,
  control,
  icon,
  radius,
  space,
  useV2Colors,
  usePressFeedback,
} from '@/theme/v2';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { compressPhoto } from '@/services/upload/compress';
import { useScanDraft, type Photo } from '@/stores/scanDraftStore';

/** The guided frame. A 4:3 window the nameplate is meant to sit inside. */
const FRAME_RATIO = 0.75;
/** Shutter. Bigger than `MIN_TOUCH` on purpose — it is used one-handed, at arm's length. */
const SHUTTER = 74;

export default function V2Camera() {
  const c = useV2Colors();
  const insets = useSafeAreaInsets();
  /**
   * `append` = shoot INTO the draft already under review (7b's ADD tile).
   * Anything else = the normal path: these photos start a new scan.
   *
   * A param rather than a second screen file: the viewfinder, the guided frame,
   * the flash and the shutter are identical in both modes, and the only thing
   * that differs is the one line at the end that decides where the photos go.
   */
  const append = useLocalSearchParams<{ mode?: string }>().mode === 'append';
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [torch, setTorch] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [starting, setStarting] = useState(false);

  const shutter = usePressFeedback();

  /* ── Permission ──────────────────────────────────────────────────────────
     Asked for with a REASON, on the app's own ground rather than over a black
     viewfinder. `EmptyState` requires an action, which is right here: the
     action is granting it. */
  if (!permission) return <Screen testID="v2-camera-loading">{null}</Screen>;

  if (!permission.granted) {
    return (
      <Screen testID="v2-camera-denied">
        <EmptyState
          title="Camera access needed"
          body="The scan reads the nameplate off a photo, so it needs the camera. Nothing is uploaded until you review what it found."
          actionLabel="Allow the camera"
          onAction={() => void requestPermission()}
          secondaryLabel="Not now"
          onSecondary={() => router.back()}
        />
      </Screen>
    );
  }

  /**
   * How long to wait for the sensor before giving up.
   *
   * ⚠️ `takePictureAsync` CAN HANG FOREVER. Observed on this device
   * (2026-09-15): the first camera session after a cold start never resolved —
   * no error, no rejection, no timeout of its own. The shutter latched into its
   * disabled state and stayed there. The untouched flash control still
   * responded, so the JS thread was alive; the promise simply never settled.
   * A fresh session worked.
   *
   * Without this guard the failure is the worst kind: a dead shutter with no
   * message, on the app's primary action, and the only way out is to leave the
   * screen. 12s is generous for a phone camera — a real capture on this device
   * takes about 2 — so a timeout here means something is genuinely stuck.
   */
  const CAPTURE_TIMEOUT_MS = 12_000;

  const capture = async () => {
    if (!cameraRef.current || capturing) return;
    haptics.heavy();
    setCapturing(true);
    try {
      const shot = await Promise.race([
        cameraRef.current.takePictureAsync({ quality: 0.85 }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('capture timed out')), CAPTURE_TIMEOUT_MS),
        ),
      ]);
      if (!shot?.uri) return;
      const compressed = await compressPhoto(shot.uri);
      setPhotos((prev) => [
        ...prev,
        {
          uri: compressed.uri,
          width: compressed.width,
          height: compressed.height,
          sizeBytes: compressed.sizeBytes,
        },
      ]);
    } catch (err) {
      haptics.error();
      // A hung sensor and a failed write are different problems and the way out
      // differs, so they do not share one message. The `finally` below re-arms
      // the shutter either way — that is what makes the screen recoverable
      // rather than a dead end.
      const stuck = err instanceof Error && err.message === 'capture timed out';
      Alert.alert(
        stuck ? 'The camera did not respond' : 'That shot did not save',
        stuck
          ? 'Close the camera and open it again — this clears it. Nothing you have already taken is lost.'
          : 'Try again — nothing was lost.',
      );
    } finally {
      setCapturing(false);
    }
  };

  const onDone = async () => {
    if (starting || photos.length === 0) return;
    setStarting(true);
    try {
      if (append) {
        /*
          APPEND — add to the draft under review and go back to it.

          `updatePhotos` is a LOCAL store action: it persists the files against
          the draft's id and replaces the array. No endpoint, which is why this
          one could be wired while "save draft" and "publish" are still
          deferred — adding a photo was never a server write, it only looked
          like one because it sat next to ones that are.

          The store nulls `pendingDetection` on any photo change (a grouping
          computed from the old set is stale), and deliberately leaves `ai`
          alone: adding a photo to a listing you are already reviewing is not a
          request to re-analyse it.

          `router.back()`, not `replace`: 7b is still on the stack underneath
          with its scroll position and any unsaved field edits, and replacing
          would throw both away to rebuild the screen the person just left.
        */
        const draft = useScanDraft.getState().current;
        if (!draft) throw new Error('append with no draft under review');
        await useScanDraft.getState().updatePhotos([...draft.photos, ...photos]);
        haptics.success();
        router.back();
        return;
      }

      await useScanDraft.getState().start(photos);
      /*
        ⚠️ THIS GOES TO THE SHIPPED PROCESSING SCREEN, NOT TO v2's 7a, AND
        THAT IS NOT AN OVERSIGHT.

        There are two detection mechanisms in this app and they are not
        interchangeable:

          useSmartDetect          POST /wp/analyze-smart-detection-v2 (SSE).
                                  What `app/scan/processing.tsx` runs. Works
                                  today; it is how every real scan happens.

          recognition-jobs        POST /recognition-jobs, then tail
                                  GET /recognition-jobs/:id/stream. What 7a
                                  was built to WATCH — it takes a `?job=<id>`
                                  and follows it.

        7a only observes. Starting a run is one of the deferred writes, listed
        in its own docblock, so routing here with no job id lands on "No scan
        running" — I did exactly that and it is a dead end for anyone holding
        two photos they just took.

        So the camera hands to the mechanism that actually runs. The chrome is
        the shipped one for those two screens, which is the same compromise
        Browse already makes: a working flow in mixed chrome beats a v2-pure
        dead end. Point this at `/v2/scan/analyzing` the moment 7a can start
        its own run. See "the two detection mechanisms" in `V2_CHECKLIST.md`.
      */
      router.replace(routes.scanProcessing);
    } catch {
      haptics.error();
      Alert.alert('Could not start the scan', 'Your photos are still here. Try again.');
    } finally {
      setStarting(false);
    }
  };

  const shotCount = photos.length;

  // flat: the viewfinder is a hole in the app, not a surface of it.
  return (
    <View style={[styles.root, { backgroundColor: c.viewfinder }]}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} autofocus="on" />

      {/* ── Top row ── */}
      <View style={[styles.top, { paddingTop: insets.top + space.lg }]}>
        <RoundControl label="Close the camera" onPress={() => router.back()}>
          <X size={icon.lg} color={c.onScrim} strokeWidth={2} />
        </RoundControl>

        <View style={styles.topRight}>
          <RoundControl
            label={torch ? 'Turn the light off' : 'Turn the light on'}
            onPress={() => {
              haptics.tap();
              setTorch((t) => !t);
            }}
          >
            {torch ? (
              <Zap size={icon.lg} color={c.onScrim} strokeWidth={2} />
            ) : (
              <ZapOff size={icon.lg} color={c.onScrim} strokeWidth={2} />
            )}
          </RoundControl>
        </View>
      </View>

      {/* ── The guided frame ──
          Corner marks, not a full rectangle: a closed box reads as a viewfinder
          crop and people try to fit the whole machine inside it. The nameplate
          is what has to be in there. */}
      <View pointerEvents="none" style={styles.frameWrap}>
        <View style={styles.frame}>
          {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
            <View key={corner} style={[styles.corner, cornerStyles[corner], { borderColor: c.onScrim }]} />
          ))}
        </View>
        {/* Dark scrim, not the light pill — `t3-full.html` gives this hint
            `rgba(0,0,0,.55)` with white text. A white slab in the middle of a
            viewfinder is the brightest thing on screen and pulls the eye off
            the frame it is telling you to fill. */}
        <ScrimPill tone="scrim" label="Frame the nameplate" style={styles.frameHint} />
      </View>

      {/* ── Bottom bar ── */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + space['5xl'] }]}>
        {/* The roll, and the way forward.

            A count, not thumbnails: at this size a 46pt thumb of a nameplate is
            unreadable, and the number is what is being tracked.

            It says "Review 3", not "3". A bare count is a status, and a status
            does not tell anyone it is the way on — the first version put a
            separate "Tap the count to read it" line under the bar to explain
            it, which collided with the shutter AND was vague. Naming the
            action removes both problems: no second line, no ambiguity. */}
        <View style={styles.side}>
          {shotCount > 0 ? (
            <Pressable
              onPress={() => void onDone()}
              disabled={starting}
              accessibilityRole="button"
              accessibilityLabel={`Review ${shotCount} ${shotCount === 1 ? 'photo' : 'photos'} and start the scan`}
              style={[styles.roll, { backgroundColor: c.accent, opacity: starting ? 0.6 : 1 }]}
            >
              <MaterialFill role="accent" ink="onAccent" radius={radius.pill} />
              <Images size={icon.sm} color={c.onAccent} strokeWidth={1.8} />
              <Text variant="captionMedium" color="onAccent">
                {`Review ${shotCount}`}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => void capture()}
          onPressIn={shutter.onPressIn}
          onPressOut={shutter.onPressOut}
          disabled={capturing}
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
          style={[styles.shutterHit, { opacity: capturing ? 0.6 : 1 }]}
        >
          <View style={[styles.shutterRing, { borderColor: c.onScrim }]}>
            {/* flat: the shutter core is a plain white disc over the viewfinder. */}
            <View style={[styles.shutterCore, { backgroundColor: c.onScrim }]} />
          </View>
        </Pressable>

        {/* Balances the roll so the shutter stays centred. The drawn mic lives
            here; it is absent until 3a exists rather than present and dead. */}
        <View style={styles.side} />
      </View>

    </View>
  );
}

/** A round control over the viewfinder. Dark scrim so it survives a bright shot. */
function RoundControl({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const c = useV2Colors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      // flat: sits over the viewfinder.
      style={[styles.round, { backgroundColor: c.scrimStrong }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
  },
  topRight: { flexDirection: 'row', gap: space['2xl'] },
  round: {
    width: control.avatar,
    height: control.avatar,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  frameWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: { width: '72%', aspectRatio: 1 / FRAME_RATIO },
  corner: { position: 'absolute', width: 28, height: 28, borderWidth: 3 },
  frameHint: { marginTop: space['5xl'] },

  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
  },
  // Wide enough for "Review 10" so the shutter never shifts as shots add up.
  side: { width: 104, alignItems: 'center' },
  roll: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: MIN_TOUCH,
    paddingHorizontal: space['3xl'],
    borderRadius: radius.pill,
  },
  shutterHit: { alignItems: 'center', justifyContent: 'center' },
  shutterRing: {
    width: SHUTTER,
    height: SHUTTER,
    borderRadius: radius.pill,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterCore: { width: SHUTTER - 16, height: SHUTTER - 16, borderRadius: radius.pill },

});

const cornerStyles = StyleSheet.create({
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: radius.sm },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: radius.sm },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: radius.sm },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: radius.sm },
});
