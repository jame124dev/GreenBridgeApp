// useWants — the buyer's saved Want-To-Buy list for the My Wants dashboard.
// `GET /wtb` → `WtbListItem[]`. Flag-gated on `WTB_ENABLED`; with the flag OFF
// the query is disabled (no fetch, no 404) and the screen shows the unavailable
// state. Mirrors the shape of `useMatches` so the screen binds without guessing.
import { useQuery } from '@tanstack/react-query';

import { WTB_ENABLED } from '@/lib/flags';
import { labKeys } from '@/features/lab/data/labQueryKeys';
import { listWants, type WtbListItem } from '@/features/lab/data/wtbApi';

export interface UseWantsResult {
  wants: WtbListItem[];
  isLoading: boolean;
  isRefetching: boolean;
  isError: boolean;
  /** True after a successful fetch that returned zero wants (distinct from loading). */
  isEmpty: boolean;
  refetch: () => void;
}

export function useWants(): UseWantsResult {
  const query = useQuery({
    queryKey: labKeys.wants(),
    queryFn: listWants,
    enabled: WTB_ENABLED,
  });

  const wants = query.data ?? [];
  return {
    wants,
    isLoading: query.isLoading && WTB_ENABLED,
    isRefetching: query.isRefetching,
    isError: query.isError,
    isEmpty: query.isSuccess && wants.length === 0,
    refetch: () => {
      void query.refetch();
    },
  };
}
