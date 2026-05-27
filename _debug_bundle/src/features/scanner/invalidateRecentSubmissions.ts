import { queryClient } from '@/lib/queryClient';
import { getSiteType } from '@/services/scanner/buildFormData';
import { useAuth } from '@/stores/authStore';

export function invalidateRecentSubmissions(sellerId?: number) {
  const id = sellerId ?? useAuth.getState().profile?.id;
  const siteType = getSiteType();
  return queryClient.invalidateQueries({
    queryKey: ['scanner', 'recentSubmissions', id, siteType],
  });
}
