// wtbApi.ts — thin fetch client for the frozen WTB REST endpoints on the
// ASSISTANT (Python FastAPI, `getAiBaseUrl()`).
//
// This is the native port of the web `101lab-2/src/components/ai/wtbApi.ts`. It
// hits the SAME endpoints on the SAME base and mirrors the web calls 1:1 so the
// two clients can never drift:
//
//   GET  /wtb                 → list the buyer's own wants        (WtbListOut)
//   GET  /wtb/{id}            → one want                          (WtbRequestOut)
//   GET  /wtb/{id}/matches    → matches for one want              (WtbMatchListOut)
//   POST /wtb                 → create a want + instant matches    (WtbCreateOut)  [not wired to a screen yet]
//   PATCH  /wtb/{id}          → edit / pause / resume              (WtbRequestOut) [not wired to a screen yet]
//   DELETE /wtb/{id}          → soft-delete (204)                                  [not wired to a screen yet]
//
// Auth + scope (NewVersion/dynamic/03-api-contract.md §0.1):
//   - `Authorization: Bearer <accessToken>` + `x-refresh-token` fallback, read
//     from `secureStorage` under the same keys the interceptor / labStream use
//     (`auth.accessToken` / `auth.refreshToken`). react-native `fetch` bypasses
//     the axios interceptor, so we attach auth by hand exactly like `labStream`.
//   - `X-Site-Type: LabGreenbidz` — the marketplace context the assistant reads
//     off the header (NEVER the body; the create schema is `extra='forbid'`).
//   - NO `x-system-key`: the assistant does not gate on it (leaks the key).
//
// The shapes below are the REAL response shapes from
// `greenbidz-ai-assistant/app/wtb/schemas.py` (WtbRequestOut / WtbMatchOut /
// WtbListOut / WtbMatchListOut / WtbCreateOut) — NOT the summarised envelopes in
// the 03-api-contract prose (which drift: prose says `{ requests, matches }`, the
// server + web client use `{ items }` and top-level fields + `matches`).
import { getAiBaseUrl } from '@/lib/env';
import { getSecureItem } from '@/lib/secureStorage';

/* ── Wire types (mirror app/wtb/schemas.py) ──────────────────────────────── */

/** Loose product snapshot on a match row — every key optional (schemas.py). */
export interface WtbProductSnapshot {
  name?: string;
  category?: string;
  country?: string;
  image_url?: string;
  price?: number | string;
  batch_id?: number;
  currency?: string;
  condition?: string | null;
  /** The listing owner's user id. NOT emitted by the backend snapshot today —
   *  reserved so "Contact seller" can open the exact seller thread the moment the
   *  assistant enriches the snapshot with it (see matchToDetail). */
  seller_id?: number | null;
}

/** = WtbMatchOut. */
export interface WtbMatch {
  id: number;
  wtb_id: number;
  product_id: number;
  score: number;
  boosted_score?: number | null;
  status: string;
  notify_eligible: boolean;
  product_snapshot?: WtbProductSnapshot | null;
  matched_at?: string | null;
}

/** = WtbRequestOut (a saved want). */
export interface WtbRequestSummary {
  id: number;
  title: string;
  description?: string | null;
  category_id?: number | null;
  category_name?: string | null;
  subcategory_id?: number | null;
  condition_wanted?: string[] | null;
  country_wanted?: string | null;
  max_price?: number | null;
  price_currency?: string;
  quantity?: number | null;
  keywords?: string[] | null;
  notify_channel?: string;
  notify_frequency?: string;
  match_threshold?: number;
  status?: string;
  site_type?: string;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** A My-Wants list row. The Python `WtbRequestOut` does NOT carry `match_count`
 *  (only the chat `list_my_wants` tool injects it); it stays optional here so a
 *  caller can enrich rows with per-want match counts if it fetches them. */
export interface WtbListItem extends WtbRequestSummary {
  match_count?: number;
}

/** = WtbCreateOut: the created request fields at top level PLUS `matches`. */
export interface WtbRequestData {
  request: WtbRequestSummary;
  matches: WtbMatch[];
}

/** Sparse PATCH body — the editable `WtbUpdate` subset a preferences panel uses. */
export interface WtbUpdatePayload {
  title?: string;
  keywords?: string[];
  category_name?: string;
  category_id?: number;
  status?: 'active' | 'paused';
  notify_frequency?: 'instant' | 'daily' | 'off';
}

/* ── HTTP plumbing ───────────────────────────────────────────────────────── */

/** Marketplace scope header value — mixed-case to match the web ("LabGreenbidz"),
 *  which the assistant lowercases + validates against its site allow-list. */
const SITE_TYPE = 'LabGreenbidz';

/** Build the headers for every WTB call: auth tokens + marketplace scope.
 *  Async because the tokens live in `secureStorage` (SecureStore / AsyncStorage). */
async function wtbHeaders(json = false): Promise<Record<string, string>> {
  const [access, refresh] = await Promise.all([
    getSecureItem('auth.accessToken'),
    getSecureItem('auth.refreshToken'),
  ]);
  const h: Record<string, string> = {
    Accept: 'application/json',
    'X-Site-Type': SITE_TYPE,
  };
  if (access) h.Authorization = `Bearer ${access}`;
  if (refresh) h['x-refresh-token'] = refresh;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

/** Error carrying the HTTP status so callers can branch (401 sign-in, 404 gone). */
export class WtbApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'WtbApiError';
    this.status = status;
  }
}

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

async function wtbFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getAiBaseUrl();
  const json = init?.method != null && init.method !== 'GET' && init.method !== 'DELETE';
  const headers = { ...(await wtbHeaders(json)), ...(init?.headers as Record<string, string>) };
  return fetch(`${base}/wtb${path}`, { ...init, headers });
}

/* ── Reads (wired to the Matches / My-Wants surfaces) ─────────────────────── */

/** List the logged-in buyer's own wants (scoped server-side by JWT buyer id).
 *  `GET /wtb` → `WtbListOut { items, total, limit, offset }`. */
export async function listWants(): Promise<WtbListItem[]> {
  const res = await wtbFetch('');
  if (!res.ok) throw new WtbApiError(`listWants failed: ${res.status}`, res.status);
  const data = (await res.json()) as { items?: unknown };
  return asArray<WtbListItem>(data?.items);
}

/** One want by id. `GET /wtb/{id}` → `WtbRequestOut`. Ownership enforced
 *  server-side (a 404 means not-found OR not-owned — no existence leak). */
export async function getWant(id: number): Promise<WtbRequestSummary> {
  const res = await wtbFetch(`/${id}`);
  if (!res.ok) throw new WtbApiError(`getWant failed: ${res.status}`, res.status);
  return (await res.json()) as WtbRequestSummary;
}

/** Matches for one want. `GET /wtb/{id}/matches` → `WtbMatchListOut { items, … }`
 *  (empty until the backend matching phase is live). */
export async function listWantMatches(id: number): Promise<WtbMatch[]> {
  const res = await wtbFetch(`/${id}/matches`);
  if (!res.ok) throw new WtbApiError(`listWantMatches failed: ${res.status}`, res.status);
  const data = (await res.json()) as { items?: unknown };
  return asArray<WtbMatch>(data?.items);
}

/* ── Mutations (not wired to a screen yet — parity with the web client) ────── */

/** Create a want. `POST /wtb` → `WtbCreateOut` (request fields + `matches`).
 *  `site_type` is NEVER in the body (schema is `extra='forbid'`) — it's the header. */
export async function createWant(
  fields: { title: string; category_name?: string } & Record<string, unknown>,
): Promise<WtbRequestData> {
  const res = await wtbFetch('', { method: 'POST', body: JSON.stringify(fields) });
  if (!res.ok) throw new WtbApiError(`createWant failed: ${res.status}`, res.status);
  const data = (await res.json()) as Record<string, unknown> & { matches?: unknown };
  const { matches, ...request } = data;
  return {
    request: request as unknown as WtbRequestSummary,
    matches: asArray<WtbMatch>(matches),
  };
}

/** Partial edit / pause / resume. `PATCH /wtb/{id}` → `WtbRequestOut`. */
export async function updateWant(id: number, patch: WtbUpdatePayload): Promise<WtbRequestSummary> {
  const res = await wtbFetch(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  if (!res.ok) throw new WtbApiError(`updateWant failed: ${res.status}`, res.status);
  return (await res.json()) as WtbRequestSummary;
}

/** Soft-delete a want. `DELETE /wtb/{id}` → 204 (idempotent, no body). */
export async function deleteWant(id: number): Promise<void> {
  const res = await wtbFetch(`/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new WtbApiError(`deleteWant failed: ${res.status}`, res.status);
}
