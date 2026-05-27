import { useQuery } from '@tanstack/react-query';

import { recentSubmissionsQueryKey } from '@/features/scanner/queryKeys';
import { fetchRecentSubmissions } from '@/services/scanner/fetchRecentSubmissions';
import { getSiteType } from '@/services/scanner/buildFormData';
import { useAuth } from '@/stores/authStore';

export function useRecentSubmissions(limit = 10, options?: { enabled?: boolean }) {
  const profile = useAuth((s) => s.profile);
  const siteType = getSiteType();

  return useQuery({
    queryKey: recentSubmissionsQueryKey(profile?.id, siteType, limit),
    queryFn: () => {
      if (!profile?.id) throw new Error('Not signed in');
      return fetchRecentSubmissions(profile.id, siteType, limit);
    },
    enabled: (options?.enabled ?? true) && !!profile?.id,
    staleTime: 60_000,
  });
}
