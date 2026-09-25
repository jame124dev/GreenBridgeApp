/**
 * ADD A PHOTO TO A DETECTED ITEM — the half of the Accept gate that makes the
 * gate legitimate.
 *
 * ── WHY THIS FILE EXISTS AT ALL ───────────────────────────────────────────
 *
 * `photos` is one of the seven fields an item must carry before it can be
 * accepted (`features/v2/scan/review/requiredFields.ts`). The document /
 * spreadsheet lane produces rows with **no photograph at all** — a catalog row
 * gives a make, a model and a quantity, never a picture. So the gate makes
 * every document-sourced row unacceptable *unless the editor can fill the
 * field*.
 *
 * The web shipped the gate without that. Its add-photo control bailed for the
 * least-privileged user who reached it ("Please sign in again to add media"),
 * which turned a validation rule into a permanent dead end: the item could
 * never be accepted, by anyone, by any route. It is in the workspace
 * `MISTAKES.md` and in `Docs/v2/v2scanflow/phases/phase-0-decisions/README.md`
 * § "ANSWERED — V3", and it is the reason root `CLAUDE.md` says *"making a
 * field REQUIRED is only half the change — press the control that FILLS it"*.
 *
 * So this is built before the gate is enforced, and the LOCAL lane — the one a
 * guest scanning on their phone is actually on — needs **no account at all**.
 *
 * ── ⚑ THE LANE SWITCH LIVES HERE, NOT IN THE SCREEN ───────────────────────
 *
 * `app/v2/scan/item.tsx` must not learn whether it is holding a local draft or
 * a server one — the same rule `app/v2/scan/items.tsx` and
 * `services/drafts/draftItemsApi.ts` already keep. A photo is the one write
 * where the two lanes genuinely differ (a device `file://` URI means nothing to
 * the server), so the difference is resolved here and the screen calls one
 * function.
 *
 *   · LOCAL  — the object IS the device URI. `localDraftSource.reproject`
 *              re-derives `image_objects_json` + `thumbnail_object` from it and
 *              mirrors it onto the `useScanDraft` item, which is what
 *              `usePublishDraft` eventually reads. No network, no account.
 *   · SERVER — the file is uploaded to GCS first (`/gcs/upload`, the same lane
 *              the scan itself uses) and the returned OBJECT NAME is stored.
 *              Handing the server a `file://` would store a path on the phone
 *              and render a permanently broken tile everywhere it is read —
 *              the hazard `draftItemThumbUri` guards from the other side.
 */
import { patchDraftItem, isLocalDraftId, type DraftItemFull } from '@/services/drafts/draftItemsApi';
import { uploadGcsPhotos } from '@/services/scanner/uploadGcsPhotos';
import { useAuth } from '@/stores/authStore';
import type { Photo } from '@/stores/scanDraftStore';

/**
 * A failure the CALLER has to explain, rather than a raw upload error.
 *
 * `reason` is a code the screen maps to its own localized sentence, so the
 * message a seller reads is written in the screen's locale files and not
 * assembled in a service. `needsAccount` is the one the whole file exists to
 * make impossible on the lane a guest is on — it can only be reached on a
 * server draft, which a guest never has.
 */
export class ItemMediaError extends Error {
  readonly reason: 'needsAccount' | 'uploadFailed';
  constructor(reason: 'needsAccount' | 'uploadFailed', message: string) {
    super(message);
    this.name = 'ItemMediaError';
    this.reason = reason;
  }
}

/**
 * Store `next` as THE item's photo list and return the fresh row.
 *
 * The list is sent whole rather than appended to, because
 * `form_json.image_objects` is an ARRAY and both merge implementations assign
 * an array wholesale (`localDraftSource.deepMerge`, the backend's
 * `mergeFormJson`). That is what makes removal work as well as addition — the
 * caller decides the order and the membership, and one write expresses it.
 *
 * ⚠️ ENVELOPE LEVEL, not `data`. `deriveDenormFields` reads
 * `form_json.image_objects` (`helper/draftItemsQuery.js:2191`); under `data` it
 * would be stored where nothing reads it and the row's photos would never
 * change.
 */
export async function setItemPhotos(
  draftId: number | string,
  itemId: number | string,
  next: readonly string[],
  expectedRowVersion: number,
): Promise<DraftItemFull> {
  return patchDraftItem(draftId, itemId, {
    form_json_patch: { image_objects: [...next] },
    expected_row_version: expectedRowVersion,
  });
}

/**
 * Turn picked images into storable objects for THIS draft's lane, then store
 * them after the ones already on the item.
 *
 * `existing` is passed in rather than re-read, so the caller's order — which is
 * what the seller sees — is the order that gets written.
 */
export async function addItemPhotos(args: {
  draftId: number | string;
  itemId: number | string;
  existing: readonly string[];
  picked: readonly Photo[];
  expectedRowVersion: number;
}): Promise<DraftItemFull> {
  const { draftId, itemId, existing, picked, expectedRowVersion } = args;
  if (picked.length === 0) throw new ItemMediaError('uploadFailed', 'No image was picked');

  let objects: string[];

  if (isLocalDraftId(draftId)) {
    // The device URI IS the object. Nothing leaves the phone, so a guest mid-scan
    // can fill the field the gate asks for — which is the whole point.
    objects = picked.map((p) => p.uri).filter(Boolean);
  } else {
    /*
      A server draft belongs to an account by construction (`workspace_owner_id`
      scopes every items route), so a missing profile here is a broken session
      rather than a guest — and it is reported as such instead of as an upload
      failure, because the recovery is different.
    */
    const sellerId = useAuth.getState().profile?.id;
    if (!sellerId) {
      throw new ItemMediaError('needsAccount', 'No seller id for a server-draft upload');
    }
    try {
      const result = await uploadGcsPhotos([...picked], { sellerId });
      objects = result.files.map((f) => f.objectName).filter(Boolean);
    } catch (err) {
      throw new ItemMediaError('uploadFailed', (err as Error)?.message ?? 'GCS upload failed');
    }
    if (objects.length === 0) throw new ItemMediaError('uploadFailed', 'Upload returned no files');
  }

  return setItemPhotos(draftId, itemId, [...existing, ...objects], expectedRowVersion);
}
