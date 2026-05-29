import { greenbidz } from '@/api/greenbidzClient';
import { marketplaceToPlatform } from '@/features/scanner/constants';
import type { MarketplaceKey } from '@/stores/scanDraftStore';
import type { BatchVisibility } from '@/types/batch';

export type CreateBatchPayload = {
  productIds: number[];
  sellerId: number;
  /**
   * W3 (scan_v3): the batch's `?type=` query param now derives from this
   * marketplace, mirroring web's `getCreateProductUrl(lang, platform)`
   * pattern. `siteType` retained as a fallback for callers that haven't
   * been wired to pass `marketplace` (none in scope today, but kept for
   * defensive resilience).
   */
  marketplace?: MarketplaceKey;
  siteType: string;
  country: string;
  visibility?: BatchVisibility;
  networkSellers?: number[];
};

export type CreateBatchResult = {
  /** Internal PK — use for `/batch/:pk/products` and listing detail route. */
  batchPk: number;
  /** Seller-facing batch number shown in UI (e.g. Batch #4821). */
  batchNumber: number;
  isFirstListing?: boolean;
};

export async function createBatch(payload: CreateBatchPayload): Promise<CreateBatchResult> {
  const platform = marketplaceToPlatform(payload.marketplace) ?? payload.siteType;
  const res = await greenbidz.post(
    `/batch/create?type=${encodeURIComponent(platform)}`,
    {
      productIds: payload.productIds,
      sellerId: payload.sellerId,
      visibility: payload.visibility ?? 'PUBLIC',
      networkSellers:
        payload.visibility === 'NETWORK' ? (payload.networkSellers ?? []) : [],
      type: platform,
      country: payload.country,
    },
    { timeout: 60_000 },
  );

  const data = res.data?.data;
  const batchPk = Number(data?.batch_id);
  if (!res.data?.success || !Number.isFinite(batchPk)) {
    throw new Error(res.data?.message ?? 'Failed to create batch');
  }

  const batchNumber = Number(data?.batch_number ?? batchPk);

  return {
    batchPk,
    batchNumber,
    isFirstListing: data?.is_first_listing,
  };
}
