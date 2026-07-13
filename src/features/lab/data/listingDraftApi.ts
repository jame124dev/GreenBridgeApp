// listingDraftApi — GET/PUT client for the assistant's shared listing-draft
// REST contract, used by the mobile "Edit details" editor sheet
// (`LabListingEditSheet`). Mirrors the web `ListingEditModal` REST plumbing but
// speaks to the assistant on `getAiBaseUrl()` with the SAME auth-header
// assembly the SSE chat uses (`labStream.ts` lines 124-134): Bearer access +
// x-refresh-token + x-platform, NO x-system-key (the assistant does not gate on
// it — sending it leaks the key).
//
// Contract (both 200):
//   GET  /listing-draft?conversation_id=<id>&site_type=LabGreenbidz
//   PUT  /listing-draft  { conversation_id, site_type:"LabGreenbidz",
//                          fields:{ <name>:<value> }, image_urls?:string[] }
//   200 -> { draft:{ fields:{ <name>:{ value, source } }, image_urls:string[] },
//            missing_required:string[], low_confidence:string[],
//            ready_to_create:boolean }
//   422 -> { detail:{ errors:{ <field>:<message> } } }  (tolerate bare {errors})
//   401 -> guest / not signed in.
//
// Both fetchers return `{ status, body }` so the sheet branches on the HTTP
// status without exceptions for the expected 401/422 cases. A thrown error is
// reserved for transport failures (no connection) — the sheet treats that as
// its network-retry state.
import { getAiBaseUrl } from '@/lib/env';
import { getSecureItem } from '@/lib/secureStorage';

/** site_type for the customer (lab) app. MUST match the value the chat sends in
 *  its request body (`useLabTurn` → 'labgreenbidz', lowercase) — the assistant
 *  keys the listing-draft store by (user_id, site_type, conversation_id), so a
 *  case mismatch here reads/writes a DIFFERENT (empty) draft than the chat built.
 *  The `x-platform` header stays 'LabGreenbidz' (that's platform routing, not the
 *  store key). */
export const LAB_SITE_TYPE = 'labgreenbidz';

/* ── Draft shapes (mirror the REST contract; ported from the web modal) ────── */

export interface DraftField {
  value: unknown;
  source?: string;
}

export interface DraftPayload {
  draft?: { fields?: Record<string, DraftField>; image_urls?: string[] };
  missing_required?: string[];
  low_confidence?: string[];
  ready_to_create?: boolean;
  // Tolerate a flatter shape too (the in-chat card seed may not nest image_urls).
  fields?: Record<string, DraftField>;
  image_urls?: string[];
}

/** The in-chat card's draft data shape (subset we can seed from). */
export type SeedDraft = DraftPayload;

/** Pull `fields` from either the nested `draft.fields` or the flat `fields`. */
export const fieldsOf = (
  d?: SeedDraft | DraftPayload | null,
): Record<string, DraftField> =>
  (d?.draft?.fields || d?.fields || {}) as Record<string, DraftField>;

/** Pull `image_urls` from either the nested or flat shape. */
export const imagesOf = (d?: SeedDraft | DraftPayload | null): string[] =>
  (d?.draft?.image_urls || d?.image_urls || []) as string[];

/** Coerce an arbitrary field value to a string for a text input. Ported verbatim
 *  from the web modal — arrays surface their first element. */
export const asString = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.length ? asString(v[0]) : '';
  return '';
};

/* ── Auth headers (copied VERBATIM from labStream.ts:124-134) ──────────────── */

/**
 * Assemble the assistant auth headers exactly as `labStream` does: read the
 * Bearer access + refresh tokens from SecureStore, set `x-platform` +
 * `Authorization` + `x-refresh-token`. NO `x-system-key`.
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

/** True when there is no access token stashed — the caller is a guest and
 *  neither GET nor PUT will authenticate (the server would 401). */
export async function hasAuthToken(): Promise<boolean> {
  const access = await getSecureItem('auth.accessToken');
  return Boolean(access);
}

export type DraftResponse = {
  /** HTTP status (0 only if the body parse of a 2xx failed — treated as error). */
  status: number;
  /** Parsed JSON body, or null when the body was empty / unparseable. */
  body: DraftPayload | Record<string, unknown> | null;
};

/**
 * GET the freshest draft. Throws only on a transport failure (no network) —
 * the caller catches that to keep the seeded form. 401/422/other statuses come
 * back in `{ status, body }`.
 */
export async function getListingDraft(
  conversationId: string,
): Promise<DraftResponse> {
  const params = new URLSearchParams({
    conversation_id: conversationId,
    site_type: LAB_SITE_TYPE,
  });
  const resp = await fetch(
    `${getAiBaseUrl()}/listing-draft?${params.toString()}`,
    { method: 'GET', headers: await authHeaders() },
  );
  let body: DraftResponse['body'] = null;
  try {
    body = (await resp.json()) as DraftResponse['body'];
  } catch {
    body = null;
  }
  return { status: resp.status, body };
}

/**
 * PUT the changed fields (+ image_urls when photos changed). Throws only on a
 * transport failure. The body carries `conversation_id`, `site_type`, `fields`,
 * and optionally `image_urls`.
 */
export async function putListingDraft(
  conversationId: string,
  fields: Record<string, unknown>,
  imageUrls?: string[],
): Promise<DraftResponse> {
  const resp = await fetch(`${getAiBaseUrl()}/listing-draft`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({
      conversation_id: conversationId,
      site_type: LAB_SITE_TYPE,
      fields,
      ...(imageUrls ? { image_urls: imageUrls } : {}),
    }),
  });
  let body: DraftResponse['body'] = null;
  try {
    body = (await resp.json()) as DraftResponse['body'];
  } catch {
    body = null;
  }
  return { status: resp.status, body };
}

/** Extract the per-field error map from a 422 body, tolerating both
 *  `{ detail:{ errors } }` (FastAPI HTTPException) and a bare `{ errors }`. */
export function extractFieldErrors(
  body: DraftResponse['body'],
): Record<string, string> {
  const b = (body || {}) as {
    errors?: Record<string, string>;
    detail?: { errors?: Record<string, string> };
  };
  return b.detail?.errors ?? b.errors ?? {};
}
