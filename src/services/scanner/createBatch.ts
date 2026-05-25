import { greenbidz } from '@/api/greenbidzClient';
import type { BatchVisibility } from '@/types/batch';

export type CreateBatchPayload = {
  productIds: number[];
  sellerId: number;
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
  const res = await greenbidz.post(
    `/batch/create?type=${encodeURIComponent(payload.siteType)}`,
    {
      productIds: payload.productIds,
      sellerId: payload.sellerId,
      visibility: payload.visibility ?? 'PUBLIC',
      networkSellers:
        payload.visibility === 'NETWORK' ? (payload.networkSellers ?? []) : [],
      type: payload.siteType,
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
