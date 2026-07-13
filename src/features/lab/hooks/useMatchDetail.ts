// useMatchDetail — live Match Detail hook (NewVersion/dynamic/04 §8).
//
// There is NO match-detail endpoint. We COMPOSE the detail client-side: locate
// the match row (+ its parent want) by the composed id `wtb_id:product_id` the
// feed minted (`matchToMatchCard`/`matchToDetail`), then map it into the static
// `MatchDetailFixture` shape so the screen renders unchanged. `reasons`/`trust`
// are derived/static (no server producer today), and `dealId` defaults to the
// match id — the seam the Deal Room CTA uses to open/create a conversation (§9).
//
// Flag-gated: `enabled` only when `WTB_ENABLED` AND a non-empty `id` is passed.
// A missing/unknown match id resolves to `isEmpty` (screen shows "no longer
// available"), never a throw.
import { useQuery } from '@tanstack/react-query';

import { WTB_ENABLED } from '@/lib/flags';
import type { MatchDetailFixture } from '@/features/lab/data/demo';
import { labKeys } from '@/features/lab/data/labQueryKeys';
import { matchToDetail } from '@/features/lab/data/matchesFromApi';
import {
  listWants,
  listWantMatches,
  type WtbMatch,
  type WtbRequestSummary,
} from '@/features/lab/data/wtbApi';

/** Split a composed feed id `"<wtb_id>:<product_id>"` back into its parts. */
function parseMatchId(id: string): { wtbId: number; productId: number } | null {
  const [a, b] = String(id).split(':');
  const wtbId = Number(a);
  const productId = Number(b);
  if (!Number.isFinite(wtbId) || !Number.isFinite(productId)) return null;
  return { wtbId, productId };
}

/** Find the match row for `id` across the buyer's wants and compose its detail. */
async function composeMatchDetail(id: string): Promise<MatchDetailFixture | null> {
  const parsed = parseMatchId(id);
  if (!parsed) return null;

  const wants = await listWants();
  const want: WtbRequestSummary | undefined = wants.find((w) => w.id === parsed.wtbId);
  // No parent want in scope → the match id doesn't belong to this buyer.
  if (!want) return null;

  const matches = await listWantMatches(want.id).catch<WtbMatch[]>(() => []);
  const match =
    matches.find((m) => m.product_id === parsed.productId) ??
    // Fallback: a preview/sentinel row where product_id is the only anchor.
    matches.find((m) => `${m.wtb_id}:${m.product_id}` === id);
  if (!match) return null;

  return matchToDetail(match, want);
}

export interface UseMatchDetailResult {
  detail: MatchDetailFixture | null;
  isLoading: boolean;
  isError: boolean;
  /** True after a successful lookup that found no matching row (→ 404 empty state). */
  isEmpty: boolean;
  refetch: () => void;
}

/**
 * Live Match Detail for a composed match `id` (`"<wtb_id>:<product_id>"`).
 * Returns `{ detail, isLoading, isError, isEmpty, refetch }`. Disabled (→ null,
 * not loading) when `WTB_ENABLED` is false or `id` is blank.
 */
export function useMatchDetail(id: string | undefined): UseMatchDetailResult {
  const enabled = WTB_ENABLED && !!id;
  const query = useQuery({
    queryKey: labKeys.match(id ?? ''),
    queryFn: () => composeMatchDetail(id as string),
    enabled,
  });

  return {
    detail: query.data ?? null,
    isLoading: query.isLoading && enabled,
    isError: query.isError,
    isEmpty: query.isSuccess && query.data == null,
    refetch: () => {
      void query.refetch();
    },
  };
}
