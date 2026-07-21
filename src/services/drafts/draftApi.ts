// draftApi.ts — plain REST functions over the shared `greenbidz` axios client
// for AI-scan drafts (Node backend `/api/v1/drafts`, see
// 101recycle-greenbidz-backend/controller/draftController.js +
// routes/draftRoutes.js). Auth (Bearer + refresh + x-platform + x-system-key)
// is attached by the client's interceptor — never set auth headers here.
//
// Verified against the live backend (2026-07-21):
//  - create / get / update / publish all respond with a single-level
//    `{ success, data }` envelope — matches the `.data.data` reads below.
//  - LIST is the one place a naive `.data.data` read would be wrong: the
//    backend puts the drafts ARRAY directly on `data`, and `next_cursor` is a
//    SIBLING of `data` at the top level of the response body — NOT nested as
//    `{ drafts, next_cursor }` inside `data`. See `listDraftsController`.
//  - create/update responses are `formatDraftMetadata()` — metadata only, no
//    `payload` and no `session_uuid` (that DB column is never selected by ANY
//    read path, including `getDraft`). Only `getDraft` actually returns a
//    parsed `payload`. Callers that need the payload right after create/update
//    must follow up with `getDraft(id)`.
import { greenbidz } from '@/api/greenbidzClient';

export type PendingAiPayload = {
  kind: 'pending-ai';
  result: unknown;
  imagesOrdered: { url: string; objectName: string }[];
  language: string;
  mode: 'single' | 'multi' | 'sell' | 'buy';
};
export type FormBlobPayload = { kind?: 'form-blob'; [k: string]: unknown };
export type DraftPayload = PendingAiPayload | FormBlobPayload;

export interface DraftSummary {
  id: string;
  session_uuid: string;
  flow: 'ai' | 'manual';
  mode: string;
  title: string;
  product_count: number;
  status: 'active' | 'published' | 'discarded';
  draft_kind?: 'form-blob' | 'pending-ai';
  thumbnail_object?: string | null;
  updated_at: string;
}
export type DraftDetail = DraftSummary & { payload: DraftPayload };

export interface CreateDraftReq {
  session_uuid: string;
  flow: 'ai' | 'manual';
  mode: string;
  title: string;
  site_type: string;
  product_count: number;
  thumbnail_object?: string | null;
  payload: DraftPayload;
}

export async function createDraft(req: CreateDraftReq): Promise<DraftDetail> {
  const res = await greenbidz.post('/drafts', req);
  return res.data.data as DraftDetail;
}

export async function listDrafts(
  cursor?: string,
): Promise<{ drafts: DraftSummary[]; next_cursor: string | null }> {
  const res = await greenbidz.get('/drafts', { params: { cursor } });
  const body = res.data ?? {};
  const drafts = Array.isArray(body.data) ? (body.data as DraftSummary[]) : [];
  const next_cursor = body.next_cursor == null ? null : String(body.next_cursor);
  return { drafts, next_cursor };
}

export async function getDraft(id: string): Promise<DraftDetail> {
  const res = await greenbidz.get(`/drafts/${id}`);
  return res.data.data as DraftDetail;
}

export async function updateDraft(
  id: string,
  expectedUpdatedAt: string,
  patch: Partial<CreateDraftReq>,
): Promise<DraftDetail> {
  const res = await greenbidz.put(`/drafts/${id}`, {
    expected_updated_at: expectedUpdatedAt,
    ...patch,
  });
  return res.data.data as DraftDetail;
}

export async function deleteDraft(id: string): Promise<void> {
  await greenbidz.delete(`/drafts/${id}`);
}

export async function markDraftPublished(id: string, publishedBatchIds: string[]): Promise<void> {
  await greenbidz.patch(`/drafts/${id}/published`, { published_batch_ids: publishedBatchIds });
}
