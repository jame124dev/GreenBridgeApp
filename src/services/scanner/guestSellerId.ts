import { mmkv } from '@/lib/mmkv';

/**
 * Per-device id for a scan session with no signed-in seller — the same
 * pattern `nextjs-port`'s `/valuation` guest flow already ships
 * (`src/lib/valuationApi.ts:guestSellerId`). `/gcs/upload` and the
 * smart-detect endpoints only use `sellerId` to namespace the GCS object
 * path and scope per-seller concurrency; it is never checked against a real
 * `sellers` row, so a stable fake id is enough to unblock a guest's
 * document scan (previously hard-blocked — see `useSmartDetect.ts`).
 *
 * Persisted so a guest's drafts/resumed session keep uploading under the
 * same id rather than a fresh one per app launch.
 */
const GUEST_ID_KEY = 'scan.guestSellerId';

export function guestSellerId(): string {
  const existing = mmkv.getString(GUEST_ID_KEY);
  if (existing) return existing;
  const id = 'guest-' + Math.random().toString(36).slice(2, 10);
  mmkv.set(GUEST_ID_KEY, id);
  return id;
}
