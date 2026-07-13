// useWantMatches — matches for ONE want (`GET /wtb/{id}/matches`). Each WantCard
// on the My Wants dashboard owns its own instance, keyed by `wantMatches(id)`,
// so cards load + refetch independently. Flag-gated + `enabled` so a collapsed
// or off-screen card can defer its fetch.
import { useQuery } from '@tanstack/react-query';

import { WTB_ENABLED } from '@/lib/flags';
import { labKeys } from '@/features/lab/data/labQueryKeys';
import { listWantMatches, type WtbMatch } from '@/features/lab/data/wtbApi';

export interface UseWantMatchesResult {
  matches: WtbMatch[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useWantMatches(wtbId: number, enabled = true): UseWantMatchesResult {
  const active = WTB_ENABLED && enabled && Number.isFinite(wtbId);
  const query = useQuery({
    queryKey: labKeys.wantMatches(wtbId),
    queryFn: () => listWantMatches(wtbId),
    enabled: active,
  });

  return {
    matches: query.data ?? [],
    isLoading: query.isLoading && active,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}
