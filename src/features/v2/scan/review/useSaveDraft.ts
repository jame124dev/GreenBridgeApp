/**
 * SAVE AS DRAFT — the second half of v2's writes, and the quieter one.
 *
 * All four review steps carry a "Save as draft" control. Until now every one of
 * them committed to the device and returned, behind `TODO(v2-writes)`: the
 * draft was genuinely saved in `useScanDraft` (Zustand + MMKV) and genuinely
 * resumable — but only on that phone. Reinstall, or pick the work up on another
 * device, and it was gone.
 *
 * ── WHY THE SERVER ID LIVES IN A STORE AND NOT IN THE SCREEN ───────────────
 *
 * The shipped flow (`app/scan/detail.tsx:78`) keeps `serverDraftId` and
 * `serverUpdatedAt` in local React state, which is correct there because the
 * whole thing is ONE screen. v2 splits review across four
 * (photos → details → pricing → location), so local state would mean saving on
 * Photos, moving to Details, and the next save CREATING A SECOND DRAFT — then a
 * third, and a fourth. A seller tapping save on each step would finish with
 * four copies of one listing in their drafts list.
 *
 * So the pair lives in a tiny store scoped to the review session, and every
 * step reads the same one.
 *
 * ── OPTIMISTIC CONCURRENCY ─────────────────────────────────────────────────
 *
 * `updateDraft` takes `expectedUpdatedAt` and the server rejects a stale one.
 * We hold the value the server last returned and write back whatever it hands
 * us, so two devices editing one draft cannot silently overwrite each other.
 */
import { useCallback, useState } from 'react';
import { create } from 'zustand';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { useCreateDraft, useUpdateDraft } from '@/services/drafts/draftHooks';
import { buildScanDraftPayload } from '@/services/drafts/draftPayload';
import { getSiteType } from '@/services/scanner/buildFormData';
import { requireAuth } from '@/features/auth/requireAuth';
import { useScanDraft } from '@/stores/scanDraftStore';
import { draftsEnabled } from '@/lib/flags';

/**
 * The server's identity for the draft this review session is editing.
 *
 * Deliberately NOT persisted. It is scoped to one editing session: a cold start
 * resumes through `useResumeDraft`, which knows the id it opened and is the
 * right place to seed this if we ever need save-after-resume to update rather
 * than create.
 */
interface ServerDraftState {
  id: string | null;
  updatedAt: string | null;
  mark: (id: string, updatedAt: string) => void;
  clear: () => void;
}

export const useServerDraft = create<ServerDraftState>((set) => ({
  id: null,
  updatedAt: null,
  mark: (id, updatedAt) => set({ id, updatedAt }),
  clear: () => set({ id: null, updatedAt: null }),
}));

export interface SaveDraftState {
  /** Runs the save. Signs the person in first if they are a guest. */
  save: () => void;
  /**
   * The same write with no sign-in sheet and no toast, resolving to whether it
   * landed. For a caller that has already passed `requireAuth` and owns what
   * happens next — the submit screen's "Save to my inventory", which lands on
   * the inventory instead of staying put.
   */
  persist: () => Promise<boolean>;
  isSaving: boolean;
  /** False when the drafts feature is off — the control should not be drawn. */
  available: boolean;
}

export function useSaveDraft(): SaveDraftState {
  const { t } = useTranslation();
  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraft();
  const [isSaving, setSaving] = useState(false);

  /** The write itself — one copy, shared by `save` and `persist`. Throws on failure. */
  const write = useCallback(async () => {
    const snapshot = useScanDraft.getState().snapshotForServer();

    // The GCS map is keyed by photo URI; the payload wants pairs. Same
    // transform as the shipped screen — kept identical so a draft saved
    // from v2 resumes through exactly the same reader.
    const gcs = snapshot.gcs;
    const imagesOrdered = gcs
      ? Object.entries(gcs.objectNameByPhotoUri).map(([url, objectName]) => ({
          url,
          objectName,
        }))
      : [];
    const built = buildScanDraftPayload(snapshot, imagesOrdered);

    const { id, updatedAt } = useServerDraft.getState();

    if (id && updatedAt) {
      const res = await updateDraft.mutateAsync({
        id,
        expectedUpdatedAt: updatedAt,
        patch: {
          title: built.title,
          product_count: built.product_count,
          payload: built.payload,
        },
      });
      useServerDraft.getState().mark(id, res.updated_at);
    } else {
      const res = await createDraft.mutateAsync({
        session_uuid:
          snapshot.current?.id ?? `temp-${snapshot.mode}-${Date.now()}`,
        flow: 'ai',
        mode: built.mode,
        title: built.title,
        site_type: getSiteType(),
        product_count: built.product_count,
        payload: built.payload,
      });
      useServerDraft.getState().mark(res.id, res.updated_at);
    }
  }, [createDraft, updateDraft]);

  const save = useCallback(() => {
    if (isSaving) return;

    /*
      A draft belongs to an account — it is the one thing on this screen that
      cannot work for a guest, and `'draft'` is its own gate reason precisely so
      the sheet says "Sign in to save this draft" rather than something about
      selling. Everything else on these four screens stays open.
    */
    requireAuth('draft', () => {
      void (async () => {
        setSaving(true);
        try {
          await write();
          toast.success(t('mobile.drafts.saved', { defaultValue: 'Draft saved' }));
        } catch {
          // Says what did NOT happen. The device copy is still there either
          // way, which is why this is not an alert.
          toast.error(
            t('mobile.drafts.saveFailed', { defaultValue: 'Could not save draft' }),
          );
        } finally {
          setSaving(false);
        }
      })();
    });
  }, [isSaving, write, t]);

  const persist = useCallback(async () => {
    setSaving(true);
    try {
      await write();
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [write]);

  return { save, persist, isSaving, available: draftsEnabled() };
}
