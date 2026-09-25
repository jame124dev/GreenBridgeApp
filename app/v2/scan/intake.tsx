/**
 * Intake — step 1 of the v2 scan flow, ported from the web's `/valuation`.
 *
 * ── WHY ────────────────────────────────────────────────────────────────────
 *
 * Mobile's step 1 was a VIEWFINDER: the only way in was to photograph
 * something. The web's step 1 is an INTAKE — one door that takes photos,
 * spec-sheet PDFs, Word/PowerPoint and whole inventory spreadsheets, because a
 * seller with a 200-row XLSX cannot photograph their way out of it. Driven
 * live at 390px on 2026-09-22 (`nextjs-port` `/valuation`, `ScanV2Intake`),
 * the same two files that produced nothing on the phone produced a priced
 * listing on the web, so this is the shape being matched.
 *
 * ── WHAT IS COPIED, AND WHAT IS NOT ────────────────────────────────────────
 *
 * Copied: the headline and its promise ("Any format, any language"), the
 * add-files zone collapsing to a strip once files are staged, the "READY TO
 * LIST" card with a count, one row per file carrying type / name / size /
 * status / remove, the "N files · size" footer, the sticky "Extract items"
 * CTA, and the two explainers ("What we read", "What happens next").
 *
 * NOT copied, each for a reason:
 *
 *  · **The numbered rail.** The web draws `1 Intake — 2 Detected items — 3
 *    Valuation — 4 Review` upfront. Mobile cannot honestly draw that here:
 *    `v2SpineForDraft(null)` returns an EMPTY spine precisely because the item
 *    count is unknown until detection runs, and a one-item lot walks TWO steps,
 *    not four (`review/spine.ts`). Drawing "1 of 4" would be a guess presented
 *    as fact, which is the defect that module exists to prevent. The step is
 *    named instead of numbered.
 *
 *  · **Paste from clipboard** and the **upload@greenbidz.com** forward card.
 *    The first has no phone equivalent worth the surface; the second is a
 *    display-only address on the web too, and belongs with account settings.
 *
 *  · **Save and exit.** Mobile gates every save behind `requireAuth`
 *    (`useSaveDraft.ts`), so for a guest the control would be a dead end. The
 *    web can offer it because it has a guest-valuation record; mobile has none
 *    (see `Docs/v2/WEB-PARITY.md`).
 *
 * ── WHAT MOBILE ADDS ───────────────────────────────────────────────────────
 *
 * A CAMERA door, which the web has no equivalent for (`grep capture= ` over
 * its `src` finds nothing). A phone's best intake is the one the web cannot
 * offer, so "Take a photo" sits beside "Browse files" rather than under it.
 *
 * ⚠️ Documents are a SIGNED-IN lane. `useSmartDetect.ts` throws 'Sign in
 * required to analyze documents' with no `profile.id`, so the files door gates
 * BEFORE the picker opens — the same rule `camera.tsx` applies, named once in
 * `onAddFiles` here.
 */
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Camera,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Upload,
  X,
} from 'lucide-react-native';

import {
  Chip,
  Hairline,
  MaterialFill,
  PrimaryAction,
  QuietAction,
  Screen,
  SectionHeader,
  SectionNote,
  SoftPanel,
  Text,
} from '@/features/v2/ui';
import { GUTTER, SECTION_GAP, icon, radius, space } from '@/theme/v2';
import { useV2Colors } from '@/theme/v2/ThemeProvider';
import { requireAuth } from '@/features/auth/requireAuth';
import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { humanBytes, pickScanFiles, type DraftDoc } from '@/features/v2/scan/pickScanFiles';
import { startScanRun } from '@/features/v2/scan/startScanRun';
import { type Photo } from '@/stores/scanDraftStore';

/**
 * The web's ceiling, matched deliberately: `useFileUpload.ts MAX_FILES = 20`,
 * enforced again in its host at `.slice(0, 20)`. Per-file size caps are not
 * repeated here — `pickScanFiles` already applies them and reports refusals.
 */
const MAX_FILES = 20;

/** A staged photo carries its own preview; a document carries a type badge. */
type Staged =
  | { kind: 'photo'; id: string; photo: Photo }
  | { kind: 'doc'; id: string; doc: DraftDoc };

const extOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toUpperCase() : 'FILE';
};

/**
 * The badge glyph per family — a spreadsheet and a spec sheet are read by
 * different machinery, and the row should say which one the seller handed over.
 */
const glyphFor = (ext: string) => {
  if (ext === 'CSV' || ext === 'XLS' || ext === 'XLSX') return FileSpreadsheet;
  return FileText;
};

export default function ScanIntake() {
  const { t } = useTranslation();
  const c = useV2Colors();

  const [staged, setStaged] = useState<Staged[]>([]);
  const [picking, setPicking] = useState(false);
  const [starting, setStarting] = useState(false);

  const photos = staged.flatMap((s) => (s.kind === 'photo' ? [s.photo] : []));
  const docs = staged.flatMap((s) => (s.kind === 'doc' ? [s.doc] : []));
  const totalBytes = staged.reduce(
    (n, s) => n + (s.kind === 'photo' ? (s.photo.sizeBytes ?? 0) : 0),
    0,
  );

  const runPick = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const picked = await pickScanFiles();
      if (picked.canceled) return;

      const room = MAX_FILES - staged.length;
      const stamp = Date.now();
      const incoming: Staged[] = [
        ...picked.photos.map((photo, i) => ({
          kind: 'photo' as const,
          id: `p-${stamp}-${i}`,
          photo,
        })),
        ...picked.docs.map((doc, i) => ({ kind: 'doc' as const, id: `d-${stamp}-${i}`, doc })),
      ];

      if (incoming.length > room) {
        Alert.alert(
          t('mobile.scanv2.intake.tooManyTitle'),
          t('mobile.scanv2.intake.tooManyBody', { max: MAX_FILES }),
        );
      }
      if (room > 0 && incoming.length > 0) {
        setStaged((prev) => [...prev, ...incoming.slice(0, room)]);
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
      } else if (incoming.length === 0) {
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

  // The gate is in FRONT of the picker, not behind it — documents go up
  // through GCS, which needs a seller id. Same rule as `camera.tsx`.
  const onAddFiles = () => requireAuth('sell', () => void runPick());

  /**
   * ⚑ THE SHIPPED CAMERA, not v2's own (decided 2026-09-23).
   *
   * `app/scan/camera.tsx` already carries everything this flow needs and has
   * carried it for months: the document lane, the per-mime size pre-flight,
   * the permission and torch handling, and — the part that matters here — an
   * `onNext` that is behaviourally identical to `startScanRun`
   * (`app/scan/camera.tsx:419-423`: `start(photos)`, then
   * `patch({documents})`, then `/scan/processing`). Since `processing-v2` now
   * hands off to `routes.v2ScanItems(...)` — v2's step 2 — that shipped camera
   * already lands back inside the v2 flow, so there is nothing to port.
   *
   * v2's own camera stays for the ONE case the shipped one cannot serve: the
   * ADD tile on review/photos, which appends to a draft already under review
   * (`routes.v2CameraAppend`). The shipped camera has no append mode — it
   * always calls `start()`, which REPLACES.
   *
   * Not gated: v2's scan flow is deliberately open to a guest, and photos do
   * not take the document lane. `startV2Scan.ts` records why at length.
   */
  const onTakePhoto = () => router.push(routes.scanCamera);

  const removeAt = (id: string) => setStaged((prev) => prev.filter((s) => s.id !== id));

  const onExtract = async () => {
    if (starting || staged.length === 0) return;
    setStarting(true);
    try {
      await startScanRun({ photos, docs });
    } catch {
      haptics.error();
      Alert.alert(
        t('mobile.scanv2.intake.startFailedTitle'),
        t('mobile.scanv2.intake.startFailedBody'),
      );
    } finally {
      setStarting(false);
    }
  };

  const empty = staged.length === 0;

  return (
    <Screen
      tabBar={false}
      footer={
        <View style={styles.footer}>
          <PrimaryAction
            label={t('mobile.scanv2.intake.extract')}
            onPress={() => void onExtract()}
            icon={<Sparkles size={icon.xl} color={c.onAccent} strokeWidth={2} />}
            loading={starting}
            disabled={empty}
          />
          <Text variant="caption" color="inkSubtle" style={styles.centred}>
            {empty ? t('mobile.scanv2.intake.addToStart') : t('mobile.scanv2.intake.extractNote')}
          </Text>
        </View>
      }
    >
      <View style={styles.head}>
        {/* Named, not numbered — see the docblock. A denominator here would be
            a guess: the spine is not known until detection has counted. */}
        <Text variant="eyebrow" color="inkSubtle">
          {t('mobile.scanv2.intake.eyebrow')}
        </Text>
        <Text variant="display">{t('mobile.scanv2.intake.title')}</Text>
        <Text variant="body" color="inkMuted">
          {t('mobile.scanv2.intake.lede')}
        </Text>
      </View>

      {/* ── The door(s) ──
          Empty: a full zone, the way the web's `large` variant reads.
          Staged: the same zone collapsed to a strip, so the FILES become the
          subject of the screen and the zone stops competing with them. */}
      <SoftPanel style={[styles.zone, { borderColor: c.hairline }]}>
        <View style={empty ? styles.zoneWideInner : styles.zoneStripInner}>
          {/* A real accent ground on a page surface, so it RAMPS. The material
              rule's own example calls out exempting a file to silence a chip
              and hiding a genuine accent button in the process. */}
          <View style={styles.zoneIcon}>
            <MaterialFill role="accent" ink="onAccent" radius={radius.md} />
            <Upload size={icon.xl} color={c.onAccent} strokeWidth={2} />
          </View>
          <View style={[styles.zoneCopy, empty ? styles.centreItems : null]}>
            <Text variant="rowTitle" style={empty ? styles.centred : undefined}>
              {empty ? t('mobile.scanv2.intake.dropTitle') : t('mobile.scanv2.intake.addMore')}
            </Text>
            <Text
              variant="caption"
              color="inkSubtle"
              style={empty ? styles.centred : undefined}
            >
              {empty ? t('mobile.scanv2.intake.dropBody') : t('mobile.scanv2.intake.addMoreBody')}
            </Text>
          </View>
        </View>

        {/* Two doors. The camera is the one the web cannot offer, so it leads
            rather than hiding under an "or".

            ⚠️ THE CAMERA DOOR DISAPPEARS ONCE FILES ARE STAGED, and that is a
            correctness guard, not a layout choice. The shipped camera runs its
            own `start(photos)`, which REPLACES the draft — so tapping it with
            documents staged here would discard them silently, with the count
            on screen still claiming they were attached. Offering only "Browse
            files" once the list has something in it keeps the two lanes from
            destroying each other. The cost is that a lot cannot mix a fresh
            photo with an uploaded spreadsheet in one pass; that needs the
            camera to hand its shots BACK to this screen rather than start a
            run, which is a bigger change than reusing the shipped screen. */}
        <View style={styles.doors}>
          {empty ? (
            <PrimaryAction
              label={t('mobile.scanv2.intake.takePhoto')}
              onPress={onTakePhoto}
              icon={<Camera size={icon.xl} color={c.onAccent} strokeWidth={2} />}
            />
          ) : null}
          <QuietAction
            label={
              picking
                ? t('mobile.scanv2.intake.browsing')
                : t('mobile.scanv2.intake.browse')
            }
            onPress={onAddFiles}
            disabled={picking}
          />
        </View>

        {empty ? (
          <Text variant="caption" color="inkSubtle" style={styles.centred}>
            {t('mobile.scanv2.intake.accepts', { max: MAX_FILES })}
          </Text>
        ) : null}
      </SoftPanel>

      {/* ── Staged files ── */}
      {!empty ? (
        <View style={styles.list}>
          <SectionHeader
            title={t('mobile.scanv2.intake.readyToList')}
            chip={String(staged.length)}
          />
          <View style={[styles.listCard, { borderColor: c.hairline }]}>
            <MaterialFill role="surface" ink="ink" radius={radius.lg} />
            {staged.map((s, i) => {
              const name =
                s.kind === 'doc'
                  ? s.doc.name
                  : t('mobile.scanv2.intake.photoName', { n: i + 1 });
              const ext = s.kind === 'doc' ? extOf(s.doc.name) : 'IMG';
              const Glyph = s.kind === 'doc' ? glyphFor(ext) : ImageIcon;
              const size = s.kind === 'photo' ? s.photo.sizeBytes : undefined;
              return (
                <View key={s.id}>
                  {i > 0 ? <Hairline /> : null}
                  <View style={styles.fileRow}>
                    <View style={[styles.badge, { borderColor: c.hairline }]}>
                      <MaterialFill role="wash" ink="ink" radius={radius.sm} />
                      <Glyph size={icon.md} color={c.inkSubtle} strokeWidth={1.8} />
                      <Text variant="micro" color="inkSubtle">
                        {ext}
                      </Text>
                    </View>
                    <View style={styles.fileMeta}>
                      <Text variant="rowTitle" numberOfLines={1}>
                        {name}
                      </Text>
                      {typeof size === 'number' && size > 0 ? (
                        <Text variant="caption" color="inkSubtle">
                          {humanBytes(size)}
                        </Text>
                      ) : null}
                    </View>
                    <Chip label={t('mobile.scanv2.intake.ready')} tone="neutral" />
                    <Pressable
                      onPress={() => {
                        haptics.tap();
                        removeAt(s.id);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('mobile.scanv2.intake.remove', { name })}
                      hitSlop={space['2xl']}
                    >
                      <X size={icon.lg} color={c.inkSubtle} strokeWidth={2} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <Hairline />
            <Text variant="caption" color="inkSubtle" style={styles.listFoot}>
              {totalBytes > 0
                ? t('mobile.scanv2.intake.countWithSize', {
                    count: staged.length,
                    size: humanBytes(totalBytes),
                  })
                : t('mobile.scanv2.intake.count', { count: staged.length })}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── What we read ──
          The web leads with this because "will it understand my spreadsheet?"
          is the question that stops a seller uploading at all. */}
      <View style={styles.explain}>
        <SectionHeader title={t('mobile.scanv2.intake.whatWeRead')} />
        <SectionNote>{t('mobile.scanv2.intake.readsPhotos')}</SectionNote>
        <SectionNote>{t('mobile.scanv2.intake.readsSheets')}</SectionNote>
        <SectionNote>{t('mobile.scanv2.intake.readsPdfs')}</SectionNote>
      </View>

      <View style={styles.explain}>
        <SectionHeader title={t('mobile.scanv2.intake.whatNext')} />
        <SectionNote>{t('mobile.scanv2.intake.next1')}</SectionNote>
        <SectionNote>{t('mobile.scanv2.intake.next2')}</SectionNote>
        <SectionNote>{t('mobile.scanv2.intake.next3')}</SectionNote>
        <SectionNote>{t('mobile.scanv2.intake.privacy')}</SectionNote>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: GUTTER, gap: space.md },
  centred: { textAlign: 'center' },
  centreItems: { alignItems: 'center' },

  zone: {
    marginTop: SECTION_GAP,
    marginHorizontal: GUTTER,
    padding: space['3xl'],
    borderRadius: radius.lg,
    borderWidth: 1,
    // Dashed reads as "drop here" on the web, where dragging is possible. A
    // phone has nothing to drag, so the border stays solid and the copy
    // carries the invitation instead.
    gap: space['2xl'],
  },
  zoneWideInner: { alignItems: 'center', gap: space.lg },
  zoneStripInner: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  zoneIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    // Clips the ramp to the rounded corners — `MaterialFill` is an absolute
    // child, so without this it squares the tile off.
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneCopy: { flex: 1, gap: space.xs },
  doors: { gap: space.lg },

  list: { marginTop: SECTION_GAP, gap: space.lg },
  listCard: {
    marginHorizontal: GUTTER,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: space['2xl'],
    paddingVertical: space['2xl'],
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  fileMeta: { flex: 1, gap: space.xs },
  listFoot: { paddingVertical: space['2xl'], textAlign: 'center' },

  explain: { marginTop: SECTION_GAP, gap: space.md },

  footer: { paddingHorizontal: GUTTER, gap: space.md },
});
