// batchProductApi — imperative REST client for the assistant's multi-product
// batch endpoints, used by `useBatchProducts` to drive the (lab) multi-product
// document/image review UX (listing_queue overview + group_choice chooser).
//
// Auth + site_type plumbing is COPIED VERBATIM from `listingDraftApi.ts`: Bearer
// access + x-refresh-token + x-platform:'LabGreenbidz' (NO x-system-key), and the
// body `site_type` stays lowercase 'labgreenbidz' (`LAB_SITE_TYPE`) — the
// assistant keys the batch store by (user_id, site_type, conversation_id), so a
// case mismatch reads/writes a DIFFERENT (empty) batch than the SSE chat built.
//
// Every fetcher returns `{ status, body }` so the controller branches on the HTTP
// status without exceptions for the expected 401 case; a thrown error is reserved
// for transport failures (no connection).
//
// Contract (all POST, all 200 on success; auth = the SSE + listing-draft REST):
//   /detect/next-product    { conversation_id, site_type, index?(1-based; omit=advance) }
//        → { payload, index, total, remaining, items:[summaries], label } | { done:true, remaining:0 }
//   /detect/load-product    = alias of next-product (always sends index; random-access jump)
//   /detect/combine-products { conversation_id, site_type } → { payload }
//   /detect/split-products   { conversation_id, site_type } → { first_payload, items:[summaries], total }
//   /detect/publish-batch    { conversation_id, site_type } → { published:[{index,title,product_id,batch_id}],
//                                skipped:[{index,title,needs:[...]}], published_count, skipped_count, total }
import { getAiBaseUrl } from '@/lib/env';
import { getSecureItem } from '@/lib/secureStorage';
import type {
  DraftPayload,
} from '@/features/lab/data/listingDraftApi';
import { LAB_SITE_TYPE } from '@/features/lab/data/listingDraftApi';
import type { QueueItem } from '@/features/lab/streaming/labStreamTypes';

/* ── Response shapes (mirror the frozen contract) ──────────────────────────── */

/** A `next-product` / `load-product` 200. `done` variant when there are no more
 *  items to advance to (the batch is exhausted). */
export type NextProductResponse =
  | {
      payload: DraftPayload;
      index: number;
      total: number;
      remaining: number;
      items: QueueItem[];
      label?: string;
      done?: false;
    }
  | { done: true; remaining: 0 };

export type CombineResponse = { payload: DraftPayload };

export type SplitResponse = {
  first_payload: DraftPayload;
  items: QueueItem[];
  total: number;
};

/** One published item in a `publish-batch` result. */
export interface PublishedItem {
  index: number;
  title: string;
  product_id: number | string;
  batch_id: number | string | null;
}
/** One skipped item — `needs` lists the still-required field names. */
export interface SkippedItem {
  index: number;
  title: string;
  needs: string[];
}
export interface PublishBatchResult {
  published: PublishedItem[];
  skipped: SkippedItem[];
  published_count: number;
  skipped_count: number;
  total: number;
}

/** Generic envelope so callers branch on `status` without try/catch for 401. */
export type BatchResponse<T> = {
  /** HTTP status. */
  status: number;
  /** Parsed JSON body, or null when the body was empty / unparseable. */
  body: T | Record<string, unknown> | null;
};

/* ── Auth headers (copied VERBATIM from listingDraftApi.ts:81-94) ──────────── */

/**
 * Assemble the assistant auth headers exactly as `listingDraftApi` /`labStream`
 * do: Bearer access + refresh from SecureStore, `x-platform:'LabGreenbidz'`.
 * NO `x-system-key`.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const [access, refresh] = await Promise.all([
    getSecureItem('auth.accessToken'),
    getSecureItem('auth.refreshToken'),
  ]);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-platform': 'LabGreenbidz',
  };
  if (access) headers.Authorization = `Bearer ${access}`;
  if (refresh) headers['x-refresh-token'] = refresh;
  return headers;
}

/** True when there is no access token stashed — the caller is a guest and the
 *  batch POSTs would 401. Re-exported convenience mirroring `listingDraftApi`. */
export async function hasAuthToken(): Promise<boolean> {
  const access = await getSecureItem('auth.accessToken');
  return Boolean(access);
}

/** POST a batch endpoint with the shared body base + auth. Throws only on a
 *  transport failure; 401/other statuses come back in `{ status, body }`. */
async function post<T>(
  path: string,
  extra: Record<string, unknown>,
  conversationId: string,
): Promise<BatchResponse<T>> {
  const resp = await fetch(`${getAiBaseUrl()}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      conversation_id: conversationId,
      site_type: LAB_SITE_TYPE,
      ...extra,
    }),
  });
  let body: BatchResponse<T>['body'] = null;
  try {
    body = (await resp.json()) as BatchResponse<T>['body'];
  } catch {
    body = null;
  }
  return { status: resp.status, body };
}

/* ── Endpoints ─────────────────────────────────────────────────────────────── */

/** Advance to the next product (omit `index`) or jump to a specific 1-based
 *  `index`. `/detect/next-product`. */
export function nextProduct(
  conversationId: string,
  index?: number,
): Promise<BatchResponse<NextProductResponse>> {
  return post<NextProductResponse>(
    '/detect/next-product',
    index != null ? { index } : {},
    conversationId,
  );
}

/** Random-access jump to a specific 1-based `index`. Alias of next-product that
 *  ALWAYS sends `index`. `/detect/load-product`. */
export function loadProduct(
  conversationId: string,
  index: number,
): Promise<BatchResponse<NextProductResponse>> {
  return post<NextProductResponse>('/detect/load-product', { index }, conversationId);
}

/** Collapse the multi-product batch into ONE combined listing. `/detect/combine-products`. */
export function combineProducts(
  conversationId: string,
): Promise<BatchResponse<CombineResponse>> {
  return post<CombineResponse>('/detect/combine-products', {}, conversationId);
}

/** Split a combined draft back into N separate products. `/detect/split-products`. */
export function splitProducts(
  conversationId: string,
): Promise<BatchResponse<SplitResponse>> {
  return post<SplitResponse>('/detect/split-products', {}, conversationId);
}

/** Publish every ready item in the batch (DESTRUCTIVE — writes real rows).
 *  `/detect/publish-batch`. */
export function publishBatch(
  conversationId: string,
): Promise<BatchResponse<PublishBatchResult>> {
  return post<PublishBatchResult>('/detect/publish-batch', {}, conversationId);
}
