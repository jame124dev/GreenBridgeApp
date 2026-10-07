/**
 * What a draft still needs before it can be listed — computed per inventory
 * row, so the seller reads it BEFORE pressing Submit rather than being told
 * after.
 *
 * ── WHY THE ROW HAS TO KNOW ────────────────────────────────────────────────
 *
 * Without this the row offers "Submit for listing" on every draft, and a press
 * on an unfinished one is a bounce: a toast, a jump into the editor, and the
 * seller works out for themselves what was wrong. The web list avoids that by
 * asking the server for per-draft item counts and labelling the control
 * accordingly (`Submissions.tsx`, "Submit for listing: eligibility"). Mobile
 * has no such endpoint for the scan-blob drafts it creates, but it does not
 * need one — the whole draft is in the payload, and the readiness rule is a
 * pure function of it.
 *
 * ── ONE DEFINITION OF "READY" ──────────────────────────────────────────────
 *
 * `firstIncompleteItem` is imported from `usePublishDraft`, which is the
 * function the publish itself runs. It is NOT re-implemented here. A row that
 * says "Ready to submit" by one rule while the publish refuses by another is
 * worse than no label at all, because the seller now distrusts the screen.
 *
 * ── IT DOES NOT TOUCH THE SCAN STORE ───────────────────────────────────────
 *
 * `hydrateScanDraftFromPayload` is a pure reader — it pulls `persistedScan`
 * out of the payload and returns it. Nothing here calls
 * `useScanDraft.hydrateFromServer`, which would overwrite whatever the seller
 * has open in the editor. Reading a list must never disturb an edit in
 * progress.
 */
import { useQueries } from '@tanstack/react-query';

import { draftKeys } from '@/services/drafts/draftHooks';
import { getDraft, type DraftSummary, type FormBlobPayload } from '@/services/drafts/draftApi';
import { hydrateScanDraftFromPayload } from '@/services/drafts/draftPayload';
import { mapPendingAiDraft } from '@/services/drafts/pendingAiResume';
import { getSiteType } from '@/services/scanner/buildFormData';
import {
  firstIncompleteItem,
  type PublishBlock,
} from '@/features/v2/scan/review/usePublishDraft';
import type { DraftItem } from '@/stores/scanDraftStore';

/** Why a row cannot be submitted straight from the list. */
export type DraftReadiness =
  /** Still fetching the payload — the control waits rather than guessing. */
  | { state: 'loading' }
  /**
   * Not a draft this screen can publish: a lab, pending-AI, valuation or
   * web-made ScanV2 payload, or one the app cannot read at all. The row sends
   * the seller into the draft instead of pretending it can submit it.
   */
  | { state: 'unsupported' }
  /**
   * Submittable, but only from inside the draft — a background-recognition
   * (`pending-ai`) draft, which is the shape most drafts on a real account
   * actually are. Opening it runs the apply step that turns the AI result into
   * items, and the scan flow's own ending offers Submit there.
   *
   * We deliberately do NOT compute what it still needs: the items do not exist
   * until that apply step runs, and re-deriving them here would be a second
   * copy of `processing-v2`'s success path.
   */
  | { state: 'open' }
  /** Every item passes the publish bar. */
  | { state: 'ready' }
  /** At least one item is short; `block.needs` is the human sentence. */
  | { state: 'incomplete'; block: PublishBlock };

/** The items a persisted scan would publish — the same pair `itemsToPublish` reads. */
function itemsOf(blob: { queuedItems?: DraftItem[]; current?: DraftItem | null }): DraftItem[] {
  if (blob.queuedItems && blob.queuedItems.length > 0) return blob.queuedItems;
  return blob.current ? [blob.current] : [];
}

/**
 * The whole classification, as a pure function of the stored payload.
 *
 * ⚠️ EXPORTED FOR TESTS, and that is not incidental. Which control a row shows
 * is decided entirely here, and it was wrong twice before anything caught it:
 * first `pending-ai` was treated as unsupported, which meant the submit
 * control appeared on NOTHING on a real account; the payload shapes were only
 * discovered by querying the database. `__tests__/draftReadiness.test.ts`
 * pins each shape against a payload taken from that database, so the next
 * person to touch this finds out from a test rather than from a device.
 */
export function readinessOf(payload: unknown): DraftReadiness {
  /*
   * `pending-ai` FIRST, because it is the common case and it has no
   * `persistedScan` to read — on the dev database 64 of 135 drafts are this
   * shape and none at all carry a persisted scan. Treating it as unsupported
   * (which the first cut did) meant the submit control appeared on nothing.
   *
   * `mapPendingAiDraft` is the same pure mapper `resumeDraftById` runs, so
   * "can this be opened?" is answered by the function that will do the
   * opening. `null` means still processing or no images yet.
   */
  if ((payload as { kind?: unknown } | null)?.kind === 'pending-ai') {
    return mapPendingAiDraft(payload, getSiteType())
      ? { state: 'open' }
      : { state: 'unsupported' };
  }
  try {
    const blob = hydrateScanDraftFromPayload(payload as FormBlobPayload);
    const items = itemsOf(blob);
    // An empty draft is not "ready" — publishing it would send nothing.
    if (items.length === 0) return { state: 'unsupported' };
    const block = firstIncompleteItem(items);
    return block ? { state: 'incomplete', block } : { state: 'ready' };
  } catch {
    // `hydrateScanDraftFromPayload` throws on any payload without
    // `persistedScan`. That is the normal answer for a lab / pending-AI /
    // ScanV2 draft, not an error worth surfacing.
    return { state: 'unsupported' };
  }
}

/**
 * Readiness for every draft passed in, keyed by id.
 *
 * ⚠️ ONE REQUEST PER ROW, which is why the caller passes only the rows it is
 * actually showing and only on the active tab. They are ordinary
 * `draftKeys.detail` queries, so they share the cache with `useGetDraft` and
 * with the submit itself — pressing Submit on a row whose readiness has
 * already loaded re-uses that fetch rather than making a second one.
 */
export function useDraftReadiness(drafts: readonly DraftSummary[]): Record<string, DraftReadiness> {
  const results = useQueries({
    queries: drafts.map((d) => ({
      queryKey: draftKeys.detail(d.id),
      queryFn: () => getDraft(d.id),
      // The payload only changes when the seller edits the draft, and any edit
      // goes through a mutation that invalidates `draftKeys.all`.
      staleTime: 60_000,
      retry: 0,
    })),
  });

  const out: Record<string, DraftReadiness> = {};
  drafts.forEach((d, i) => {
    const r = results[i];
    if (!r || r.isLoading) {
      out[d.id] = { state: 'loading' };
      return;
    }
    if (r.isError || !r.data) {
      out[d.id] = { state: 'unsupported' };
      return;
    }
    out[d.id] = readinessOf(r.data.payload);
  });
  return out;
}
