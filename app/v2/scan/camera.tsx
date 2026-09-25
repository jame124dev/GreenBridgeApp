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
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native — see `home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { FileText, Images, X, Zap, ZapOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { requireAuth, useIsGuest } from '@/features/auth/requireAuth';
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

import { humanBytes, pickScanFiles, type DraftDoc } from '@/features/v2/scan/pickScanFiles';
import { startScanRun } from '@/features/v2/scan/startScanRun';

/** The guided frame. A 4:3 window the nameplate is meant to sit inside. */
const FRAME_RATIO = 0.75;
/** Shutter. Bigger than `MIN_TOUCH` on purpose — it is used one-handed, at arm's length. */
const SHUTTER = 74;

export default function V2Camera() {
  const c = useV2Colors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  /**
   * Only for the HINT on the file control — never for hiding it.
   *
   * A control that disappears for a guest teaches them the app cannot do the
   * thing. The control stays; pressing it opens the gate, and the hint says so
   * before the press. See `onAddFile`.
   */
  const isGuest = useIsGuest();
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
  /**
   * Files picked from the device that are NOT images — a spec sheet, a manual,
   * a parts list. They ride alongside the photos into the same draft; the
   * detector reads a PDF's page-images the way it reads a nameplate shot.
   *
   * Images picked from the same dialog are compressed and merged into `photos`
   * instead, so the pipeline cannot tell them from a captured frame.
   */
  const [docs, setDocs] = useState<DraftDoc[]>([]);
  const [picking, setPicking] = useState(false);
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

  /**
   * Open the system file picker and take what comes back.
   *
   * The sorting, the size caps and the filename flattening are in
   * `pickScanFiles` — ported from the shipped camera so the two cannot drift.
   * What is left here is what to SAY, which is the part that belongs to a
   * screen.
   *
   * A refusal names the file and both numbers. "File too large" on its own
   * leaves the person with nothing to do; "X is 63.2 MB — over the 50.0 MB
   * limit for this format" tells them which file and by how much.
   */
  const runPick = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const picked = await pickScanFiles();
      if (picked.canceled) return;

      if (picked.photos.length > 0) setPhotos((prev) => [...prev, ...picked.photos]);
      if (picked.docs.length > 0) {
        setDocs((prev) => [...prev, ...picked.docs]);
        haptics.tap();
      }

      if (picked.oversize.length === 1) {
        const o = picked.oversize[0];
        Alert.alert(
          t('mobile.scanv2.camera.tooLargeTitle'),
          t('mobile.scanv2.camera.tooLargeBody', {
            name: o.name,
            size: humanBytes(o.size),
            limit: humanBytes(o.limit),
          }),
        );
      } else if (picked.oversize.length > 1) {
        Alert.alert(
          t('mobile.scanv2.camera.tooLargeTitle'),
          t('mobile.scanv2.camera.tooLargeManyBody', { count: picked.oversize.length }),
        );
      } else if (picked.photos.length === 0 && picked.docs.length === 0) {
        // Picked something, got nothing usable — silence here would read as
        // the control being dead.
        Alert.alert(
          t('mobile.scanv2.camera.pickFailedTitle'),
          t('mobile.scanv2.camera.pickFailedBody'),
        );
      }
    } catch {
      haptics.error();
      Alert.alert(
        t('mobile.scanv2.camera.pickFailedTitle'),
        t('mobile.scanv2.camera.pickFailedBody'),
      );
    } finally {
      setPicking(false);
    }
  };

  /**
   * ⚠️ THE GATE IS IN FRONT OF THE PICKER, NOT BEHIND IT.
   *
   * `useSmartDetect.ts:63-71` throws `'Sign in required to analyze documents'`
   * when there is no `profile.id` — documents go up through GCS, which needs a
   * seller id, and the legacy multipart fallback carries images only. v2's
   * scan flow is deliberately open to guests (`startV2Scan.ts`), so without
   * this a guest can attach a spec sheet, press Review, and be thrown at the
   * processing screen — after the picking, with the file already chosen.
   *
   * So the account is asked for at the moment of reaching for the control.
   * `'sell'` is the closest existing reason ("Sign in to list equipment") and
   * the reason set is closed — see the KIT GAP note in the task report.
   */
  const onAddFile = () => requireAuth('sell', () => void runPick());

  const removeDoc = (index: number) => {
    setDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const onDone = async () => {
    // Photos OR documents, or both. A documents-only scan is a real path —
    // the backend analyses PDF page-images, and the shipped camera has allowed
    // it since the office-docs work (`app/scan/camera.tsx:409-416`).
    if (starting || (photos.length === 0 && docs.length === 0)) return;
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
        if (photos.length > 0) {
          await useScanDraft.getState().updatePhotos([...draft.photos, ...photos]);
        }
        if (docs.length > 0) {
          // Re-read: `updatePhotos` replaced `current` with a new object, so
          // `draft` above is a stale snapshot. MERGE — a draft under review
          // may already carry documents from the scan that created it.
          const after = useScanDraft.getState().current;
          useScanDraft.getState().patch({ documents: [...(after?.documents ?? []), ...docs] });
        }
        haptics.success();
        router.back();
        return;
      }

      /*
        Create the draft, attach the documents, route to the detector.

        All three moved to `startScanRun` on 2026-09-22 when the intake screen
        became a second door into the same run. Both the load-bearing ordering
        (`patch()` silently no-ops before `start()` has created `current`) and
        the reason the hand-off is the SHIPPED processing screen rather than
        v2's `analyzing.tsx` are written out there, once, instead of in each
        door.
      */
      await startScanRun({ photos, docs });
    } catch {
      haptics.error();
      Alert.alert('Could not start the scan', 'Your photos are still here. Try again.');
    } finally {
      setStarting(false);
    }
  };

  /**
   * What is on the way forward — photos AND documents.
   *
   * One number rather than two: the roll is the way ON, and splitting it into
   * "2 photos · 1 file" makes the person work out whether either of them is
   * the button.
   */
  const attachmentCount = photos.length + docs.length;

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

      {/* ── Attached documents ──

          A picked PDF or spreadsheet has no thumbnail to show in the roll, so
          without a strip the only feedback for "Add files" is the count going
          up by one — indistinguishable from a shot being taken. Each chip
          names its file and carries its own remove control, because the roll
          cannot undo a document and a wrong attachment would otherwise be
          unremovable short of leaving the camera. */}
      {/* ── The guest's warning, BEFORE the tap ──
          `onAddFile` gates with `requireAuth`, so a guest who reaches for the
          files control gets a sign-in sheet. Saying so first is the difference
          between a gate and an ambush: the shutter beside it is genuinely open
          to them, so without this the two controls look equally available and
          only one is. Occupies the doc strip's slot, which a guest can never
          fill — they cannot attach a document without the account this pill is
          telling them about. */}
      {isGuest && docs.length === 0 ? (
        <ScrimPill
          tone="scrim"
          label={t('mobile.scanv2.camera.addFileGuestHint')}
          style={[
            styles.guestHint,
            { bottom: insets.bottom + space['5xl'] + SHUTTER + space['3xl'] },
          ]}
        />
      ) : null}

      {docs.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.md }}
          /* Clears the SHUTTER, not the round controls. The bottom bar's tallest
             child is the shutter (`SHUTTER` = 74), not `control.avatar` (40) —
             offsetting by the latter puts the strip 18pt INSIDE the shutter,
             which is what the first version did and the device showed. Measured
             off the constants rather than nudged until it looked right:
             the bar's padding is `insets.bottom + space['5xl']`, so the shutter
             top is that + SHUTTER, and the strip sits one `3xl` above it. */
          style={[styles.docStrip, { bottom: insets.bottom + space['5xl'] + SHUTTER + space['3xl'] }]}
        >
          {docs.map((d, i) => (
            // flat: sits ON the viewfinder, so the ground is photography — the
            // same reason `ScrimPill` is exempt. A ramp tints the frame behind.
            <View key={`${d.uri}-${i}`} style={[styles.docChip, { backgroundColor: c.scrimStrong }]}>
              <FileText size={icon.sm} color={c.onScrim} strokeWidth={1.8} />
              <Text variant="captionMedium" color="onScrim" numberOfLines={1} style={styles.docChipText}>
                {d.name}
              </Text>
              <Pressable
                onPress={() => {
                  haptics.tap();
                  removeDoc(i);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('mobile.scanv2.camera.removeFile', { name: d.name })}
                hitSlop={space['2xl']}
              >
                <X size={icon.sm} color={c.onScrim} strokeWidth={2} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

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
          {attachmentCount > 0 ? (
            <Pressable
              onPress={() => void onDone()}
              disabled={starting}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.scanv2.camera.reviewA11y', { count: attachmentCount })}
              style={[styles.roll, { backgroundColor: c.accent, opacity: starting ? 0.6 : 1 }]}
            >
              <MaterialFill role="accent" ink="onAccent" radius={radius.pill} />
              <Images size={icon.sm} color={c.onAccent} strokeWidth={1.8} />
              <Text variant="captionMedium" color="onAccent">
                {`Review ${attachmentCount}`}
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

        {/* ── The document door ──

            The slot that balances the roll, which until now held nothing. It is
            the OTHER way in: a seller whose nameplate is painted over, or who
            already has the spec sheet as a PDF or the lot as a spreadsheet,
            cannot use the shutter at all. `nextjs-port`'s `/valuation` takes
            photos and documents through ONE picker (`ScanV2Intake.tsx` ACCEPT),
            and the shipped camera has had this control since the office-docs
            work (`app/scan/camera.tsx`) — v2 dropped it, which is the gap the
            user reported as *"last time we have upload document option"*.

            Round, scrimmed, same size as the torch: it is a viewfinder control,
            so it uses the viewfinder's own primitive rather than a new shape.
            `onAddFile` gates BEFORE the picker opens — see its docblock. */}
        <View style={styles.side}>
          {picking ? (
            // flat: the busy twin of `RoundControl`, which sits over the
            // viewfinder — photography, not a surface of the app.
            <View style={[styles.round, { backgroundColor: c.scrimStrong }]}>
              <ActivityIndicator color={c.onScrim} />
            </View>
          ) : (
            <RoundControl label={t('mobile.scanv2.camera.addFile')} onPress={onAddFile}>
              <FileText size={icon.lg} color={c.onScrim} strokeWidth={2} />
            </RoundControl>
          )}
        </View>
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

  // Attached documents ride ABOVE the bottom bar: a document has no thumbnail
  // in the roll, so without this a picked file is invisible and the only
  // feedback is the count going up.
  docStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: GUTTER,
    gap: space.md,
  },
  /** Same slot as `docStrip`, but centred — it is one sentence, not a row. */
  guestHint: { position: 'absolute', alignSelf: 'center' },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: MIN_TOUCH,
    paddingHorizontal: space['2xl'],
    borderRadius: radius.pill,
  },
  // Keeps a long spec-sheet filename from pushing the remove control off-screen.
  docChipText: { maxWidth: 180 },
});

const cornerStyles = StyleSheet.create({
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: radius.sm },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: radius.sm },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: radius.sm },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: radius.sm },
});
