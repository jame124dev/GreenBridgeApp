/**
 * REST for the seller listing-edit contract, over the shared `greenbidz` axios
 * client. Auth (Bearer + refresh + x-platform) is attached by the client's
 * interceptor — never set auth headers here, and never send an owner id in the
 * body: ownership comes from the JWT server-side.
 *
 * Base URL already ends in `/api/v1` (see `.env: GREENBIDZ_API_URL`), so the
 * paths below are the contract paths minus that prefix.
 */

import { greenbidz } from '@/api/greenbidzClient';

import type {
  ListingEditPatchBody,
  ListingEditPatchResult,
  ListingEditResource,
} from './listingEditTypes';

export async function fetchListingForEdit(productId: number): Promise<ListingEditResource> {
  const res = await greenbidz.get(`/seller/listings/${productId}/edit`);
  return res.data?.data as ListingEditResource;
}

export async function patchSellerListing(
  productId: number,
  body: ListingEditPatchBody,
): Promise<ListingEditPatchResult> {
  const res = await greenbidz.patch(`/seller/listings/${productId}`, body);
  const data = (res.data?.data ?? {}) as Partial<ListingEditPatchResult>;
  // Defensive: the screen renders `applied.length` / `pending_review.length`
  // straight into sentences, so a backend that omits an empty array must not
  // crash the receipt.
  return {
    applied: Array.isArray(data.applied) ? data.applied : [],
    pending_review: Array.isArray(data.pending_review) ? data.pending_review : [],
    edit_id: typeof data.edit_id === 'number' ? data.edit_id : null,
    message: typeof data.message === 'string' ? data.message : undefined,
  };
}

/**
 * Every failure the contract names, plus the two the network gives us for free.
 * The screen maps each to a sentence and a next step — never a raw code.
 */
export type ListingEditErrorKind =
  | 'unauthorized' // 401 — no/!valid JWT
  | 'forbidden' // 403 — not the owner
  | 'sold' // 409 + code "sold" — genuinely sold, nothing to retry
  | 'saleRecordBlocked' // 409, other codes — this ONE field can't be changed; the rest can
  | 'invalid' // 400 — nothing valid to change
  | 'notFound' // 404 — listing gone
  | 'offline' // no response at all
  | 'server' // 5xx
  | 'unknown';

function statusOf(err: unknown): number | undefined {
  const e = err as { response?: { status?: number }; request?: unknown } | undefined;
  return e?.response?.status;
}

/** The server's machine-readable reason, e.g. "sold" / "no_sale_record" / "bidding_locked". */
function codeOf(err: unknown): string | undefined {
  const e = err as { response?: { data?: { code?: unknown } } } | undefined;
  const raw = e?.response?.data?.code;
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

/**
 * 409 is NOT one thing, which is where this originally went wrong. The server
 * returns it for four different situations on PATCH: `sold` (terminal), and
 * `no_sale_record` / `no_batch` / `bidding_locked` — all three of which mean
 * "this particular field can't change", not "this listing is finished".
 *
 * Mapping every 409 to 'sold' produced a dead end: editing the pickup address of
 * a perfectly live listing told the seller it was sold, the screen refetched,
 * the listing came back as editable, and they looped. So discriminate on the
 * server's `code`, and treat an unrecognised 409 as the NON-terminal kind — the
 * server's own sentence is more specific than any guess we'd make here, and
 * wrongly claiming "sold" is the worse failure.
 */
export function classifyListingEditError(err: unknown): ListingEditErrorKind {
  const status = statusOf(err);
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 409) return codeOf(err) === 'sold' ? 'sold' : 'saleRecordBlocked';
  if (status === 400 || status === 422) return 'invalid';
  if (status === 404) return 'notFound';
  if (status != null && status >= 500) return 'server';
  if (status == null && (err as { request?: unknown })?.request) return 'offline';
  if (status == null) return 'offline';
  return 'unknown';
}

/** Server-supplied detail, when it gives one. Never shown alone — only as a hint. */
export function serverMessageOf(err: unknown): string | undefined {
  const e = err as { response?: { data?: { message?: unknown; error?: unknown } } } | undefined;
  const raw = e?.response?.data?.message ?? e?.response?.data?.error;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : undefined;
}
