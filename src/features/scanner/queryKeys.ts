export const recentSubmissionsQueryKey = (sellerId?: number, siteType?: string, limit?: number) =>
  ['scanner', 'recentSubmissions', sellerId, siteType, limit] as const;

export const batchDetailQueryKey = (batchPk?: number, siteType?: string) =>
  ['scanner', 'batchDetail', batchPk, siteType] as const;
