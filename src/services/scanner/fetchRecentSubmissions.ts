import { greenbidz } from '@/api/greenbidzClient';
import type { SellerBatch } from '@/types/batch';

function normalizeBatch(raw: Record<string, unknown>): SellerBatch | null {
  const displayId = raw.batchId ?? raw.batch_id;
  if (displayId == null) return null;
  const batchPk = raw.batchPk ?? raw.batch_pk ?? displayId;
  return {
    batchId: Number(displayId),
    batchPk: Number(batchPk),
    category: (raw.category as string) ?? undefined,
    status: (raw.status as string) ?? undefined,
    approvalStatus: (raw.approval_status as string) ?? undefined,
    postDate: (raw.post_date as string) ?? (raw.postDate as string) ?? undefined,
    step: raw.step != null ? Number(raw.step) : undefined,
  };
}

export async function fetchRecentSubmissions(
  sellerId: number,
  siteType: string,
  limit = 10,
): Promise<SellerBatch[]> {
  const res = await greenbidz.get(`/batch/seller/${sellerId}`, {
    params: { page: 1, limit, type: siteType },
  });

  const payload = res.data?.data;
  const list: unknown[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.batches)
        ? payload.batches
        : [];

  return list
    .map((item) => normalizeBatch(item as Record<string, unknown>))
    .filter((b): b is SellerBatch => b != null);
}
