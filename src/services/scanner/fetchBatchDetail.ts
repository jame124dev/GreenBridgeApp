import { greenbidz } from '@/api/greenbidzClient';
import { getSiteType } from '@/services/scanner/buildFormData';

export type BatchDetail = {
  batchPk: number;
  batchNumber: number;
  status?: string;
  approvalStatus?: string;
  visibility?: string;
  step?: number;
  category?: string;
  productCount: number;
  productTitles: string[];
};

function mapBatch(raw: Record<string, unknown>, productTitles: string[]): BatchDetail {
  const batchPk = Number(raw.batch_id ?? raw.batchId);
  const batchNumber = Number(raw.batch_number ?? raw.batchNumber ?? batchPk);
  const productIds = raw.product_ids as number[] | undefined;

  return {
    batchPk,
    batchNumber,
    status: raw.status as string | undefined,
    approvalStatus: (raw.approval_status as string) ?? (raw.approvalStatus as string),
    visibility: raw.visibility as string | undefined,
    step: raw.step != null ? Number(raw.step) : undefined,
    category: (raw.category as string) ?? undefined,
    productCount: productIds?.length ?? productTitles.length,
    productTitles,
  };
}

/** Load batch summary for listing detail (uses internal batch PK, not display batch number). */
export async function fetchBatchDetail(batchPk: number): Promise<BatchDetail> {
  const siteType = getSiteType();

  const productsRes = await greenbidz.get(`/batch/${batchPk}/products`, {
    params: { type: siteType, page: 1, pageSize: 20 },
    timeout: 60_000,
  });

  const payload = productsRes.data?.data as Record<string, unknown> | undefined;
  if (!payload) {
    throw new Error('Batch not found');
  }

  const products = (payload.products ?? []) as { title?: string; post_title?: string }[];
  const titles = products
    .map((p) => p.title ?? p.post_title)
    .filter((t): t is string => Boolean(t));

  const batchRaw = payload.batch as Record<string, unknown> | undefined;
  if (batchRaw) {
    return mapBatch(batchRaw, titles);
  }

  throw new Error('Batch not found');
}
