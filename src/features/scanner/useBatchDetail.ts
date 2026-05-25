import { useQuery } from '@tanstack/react-query';

import { fetchBatchDetail } from '@/services/scanner/fetchBatchDetail';
import { getSiteType } from '@/services/scanner/buildFormData';
import { batchDetailQueryKey } from '@/features/scanner/queryKeys';

export function useBatchDetail(batchPk: number | undefined) {
  const siteType = getSiteType();

  return useQuery({
    queryKey: batchDetailQueryKey(batchPk, siteType),
    queryFn: () => fetchBatchDetail(batchPk!),
    enabled: !!batchPk && batchPk > 0,
    staleTime: 30_000,
  });
}
