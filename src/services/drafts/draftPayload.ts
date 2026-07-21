// draftPayload.ts — pure payload builders/hydrators for the shared
// `pending-ai` / `form-blob` draft contract (Node backend `/api/v1/drafts`).
// No React Query, no I/O — these are plain functions so the round-trip is
// trivially unit-testable. Consumed by the draft-sync hooks (Tasks 7/8/9/12)
// to serialize the scanner/lab in-memory state into `CreateDraftReq.payload`
// and to hydrate it back out (`hydrateFromServer`).
import type { PendingAiPayload, FormBlobPayload } from './draftApi';
import type { PersistedScan } from '@/stores/scanDraftStore';

export function pendingAiPayload(args: {
  result: unknown;
  imagesOrdered: { url: string; objectName: string }[];
  language: string;
  mode: PendingAiPayload['mode'];
}): PendingAiPayload {
  return {
    kind: 'pending-ai',
    result: args.result,
    imagesOrdered: args.imagesOrdered,
    language: args.language,
    mode: args.mode,
  };
}

export function buildScanDraftPayload(
  snapshot: PersistedScan,
  imagesOrdered: { url: string; objectName: string }[],
): { title: string; product_count: number; mode: 'single' | 'multi'; payload: FormBlobPayload } {
  const isMulti = snapshot.mode === 'grouped';
  const title = isMulti
    ? (snapshot.queuedItems?.[0]?.title || 'Untitled group')
    : (snapshot.current?.title || 'Untitled listing');
  const product_count = isMulti ? Math.max(1, snapshot.queuedItems?.length ?? 1) : 1;
  return {
    title,
    product_count,
    mode: isMulti ? 'multi' : 'single',
    payload: { kind: 'form-blob', persistedScan: snapshot, imagesOrdered },
  };
}

export function hydrateScanDraftFromPayload(payload: FormBlobPayload): PersistedScan {
  const blob = (payload as { persistedScan?: PersistedScan }).persistedScan;
  if (!blob) throw new Error('draft payload missing persistedScan');
  return blob;
}

export function buildLabDraftPayload(
  draftFrame: unknown,
  mode: 'sell' | 'buy',
): { title: string; payload: FormBlobPayload } {
  const frame = (draftFrame ?? {}) as { title?: string };
  return {
    title: frame.title || (mode === 'sell' ? 'Untitled listing' : 'Buying request'),
    payload: { kind: 'form-blob', labDraft: frame, mode },
  };
}
