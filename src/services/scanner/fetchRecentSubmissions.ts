import { greenbidz } from '@/api/greenbidzClient';
import type { SellerBatch } from '@/types/batch';

function normalizeBatch(raw: Record<string, unknown>): SellerBatch | null {
  const displayId = raw.batchId ?? raw.batch_id;
  if (displayId == null) return null;
  const batchPk = raw.batchPk ?? raw.batch_pk ?? displayId;

  const images = (raw.firstProductImages ?? raw.first_product_images) as
    | string[]
    | undefined;
  const thumbnailUrl = Array.isArray(images) && images.length ? images[0] : undefined;

  const itemsCount = (raw.itemsCount ?? raw.items_count) as number | undefined;
  const bidsCount = (raw.bids ?? raw.bidsCount ?? raw.bids_count) as number | undefined;
  const commissionPercent = (raw.commission_percent ?? raw.commissionPercent) as
    | number
    | string
    | undefined;

  return {
    batchId: Number(displayId),
    batchPk: Number(batchPk),
    category: (raw.category as string) ?? undefined,
    status: (raw.status as string) ?? undefined,
    approvalStatus: (raw.approval_status as string) ?? undefined,
    postDate: (raw.post_date as string) ?? (raw.postDate as string) ?? undefined,
    step: raw.step != null ? Number(raw.step) : undefined,
    title: (raw.title as string) ?? (raw.title_en as string) ?? undefined,
    titleI18n: {
      en: raw.title_en as string | undefined,
      zh: raw.title_zh as string | undefined,
      ja: raw.title_ja as string | undefined,
      th: raw.title_th as string | undefined,
    },
    thumbnailUrl,
    itemsCount: itemsCount != null ? Number(itemsCount) : undefined,
    bidsCount: bidsCount != null ? Number(bidsCount) : undefined,
    commissionPercent:
      commissionPercent != null && commissionPercent !== ''
        ? Number(commissionPercent)
        : undefined,
  };
}

export async function fetchRecentSubmissions(
  sellerId: number,
  siteType: string,
  limit = 10,
): Promise<SellerBatch[]> {
  const res = await greenbidz.get(`/batch/seller/${sellerId}`, {
    // `marketplace: 'all'` is a forward-compat signal: once the backend honors
    // it, this endpoint returns the seller's listings across EVERY marketplace
    // in one call (today's `type` filter only returns the current site, which
    // hides listings created under a different marketplace pill). `type` is
    // kept so behavior is unchanged until the backend implements `all`.
    params: { page: 1, limit, type: siteType, marketplace: 'all' },
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
