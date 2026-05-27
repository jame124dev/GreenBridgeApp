import { greenbidz } from '@/api/greenbidzClient';
import { getSiteType } from '@/services/scanner/buildFormData';

// Mirrors the data the web SellerBatchDetails.tsx pulls from the same endpoint
// `/batch/:batchPk/products?type=SITE_TYPE`. Keep field names close to the web's
// runtime shape so reading the two side-by-side is easy.

export type ProductAttachment = {
  url: string;
  type: string; // 'image' | 'pdf' | etc.
};

export type ProductCategory = {
  term?: string;
};

export type ProductDetail = {
  productId: number;
  title?: string;
  description?: string;
  condition?: string;
  operationStatus?: string;
  sellerName?: string;
  brand?: string;
  model?: string;
  year?: string;
  weight?: string;
  category?: string;
  images: string[]; // ordered, first is cover
  docs: string[];   // pdf urls
};

export type BiddingDetails = {
  status?: string;
  startDate?: string;
  endDate?: string;
  type?: string; // 'make_offer' | other
  targetPrice?: number;
  currency?: string;
  location?: string;
  allowWholePrice?: boolean;
  allowWeightPrice?: boolean;
  buyerBidCount?: number;
};

export type InspectionSlot = {
  date?: string;
  times: string[];
};

export type InspectionCompany = {
  companyName: string;
  status?: string;
  skipped?: boolean;
};

export type InspectionDetails = {
  schedule: InspectionSlot[];
  companies: InspectionCompany[];
};

export type BatchDetail = {
  batchPk: number;
  batchNumber: number;
  status?: string;
  approvalStatus?: string;
  visibility?: string;
  step?: number;
  category?: string;
  commissionPercent?: number;
  createdAt?: string;
  productCount: number;
  productTitles: string[]; // kept for back-compat with prior call sites
  products: ProductDetail[];
  bidding?: BiddingDetails;
  inspection?: InspectionDetails;
};

// PHP-serialized values look like: a:1:{i:0;s:9:"like_new";} or s:9:"like_new";
// Web does the same with extractValuesFromPhpSerialized.
function extractValuesFromPhpSerialized(value?: unknown): string[] {
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (/^https?:\/\//i.test(trimmed)) return [trimmed];
  const re = /s:\d+:"(.*?)"/g;
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    if (m[1]) results.push(m[1]);
  }
  return results;
}

function getMeta(meta: unknown, key: string): string | undefined {
  if (!Array.isArray(meta)) return undefined;
  const row = (meta as { meta_key?: string; meta_value?: unknown }[]).find(
    (m) => m.meta_key === key,
  );
  if (!row) return undefined;
  const raw = row.meta_value;
  if (typeof raw === 'string') {
    const parsed = extractValuesFromPhpSerialized(raw);
    return parsed[0] ?? raw;
  }
  return undefined;
}

function mapProduct(raw: Record<string, unknown>): ProductDetail {
  const meta = raw.meta;
  const attachments = (raw.attachments as { url?: string; type?: string }[] | undefined) ?? [];
  const images = attachments
    .filter((a) => a.type !== 'pdf' && a.url)
    .map((a) => a.url as string);
  const docs = attachments
    .filter((a) => a.type === 'pdf' && a.url)
    .map((a) => a.url as string);
  const categories = raw.categories as { term?: string }[] | undefined;

  return {
    productId: Number(raw.product_id ?? raw.productId ?? 0),
    title: (raw.title as string) ?? (raw.post_title as string) ?? undefined,
    description: (raw.description as string) ?? undefined,
    condition: getMeta(meta, 'condition'),
    operationStatus: getMeta(meta, 'operation_status'),
    sellerName: getMeta(meta, 'seller_name'),
    brand: getMeta(meta, 'brand'),
    model: getMeta(meta, 'model'),
    year: getMeta(meta, 'year_of_manufacture'),
    weight: getMeta(meta, 'weight'),
    category: categories?.[0]?.term,
    images,
    docs,
  };
}

function mapBidding(raw?: Record<string, unknown> | null): BiddingDetails | undefined {
  if (!raw) return undefined;
  const buyerBids = raw.buyer_bids as unknown[] | undefined;
  return {
    status: (raw.status as string) ?? undefined,
    startDate: (raw.start_date as string) ?? undefined,
    endDate: (raw.end_date as string) ?? undefined,
    type: (raw.type as string) ?? undefined,
    targetPrice: raw.target_price != null ? Number(raw.target_price) : undefined,
    currency: (raw.currency as string) ?? undefined,
    location: (raw.location as string) ?? undefined,
    allowWholePrice: Boolean(raw.allowWholePrice),
    allowWeightPrice: Boolean(raw.allowWeightPrice),
    buyerBidCount: Array.isArray(buyerBids) ? buyerBids.length : undefined,
  };
}

function mapInspection(raw?: Record<string, unknown> | null): InspectionDetails | undefined {
  if (!raw) return undefined;
  const scheduleRaw = (raw.schedule as { date?: string; slots?: { time?: string }[] }[] | undefined) ?? [];
  const companiesRaw = (raw.companies as { company_name?: string; status?: string; skipped?: boolean }[] | undefined) ?? [];
  const schedule: InspectionSlot[] = scheduleRaw.map((s) => ({
    date: s.date,
    times: (s.slots ?? []).map((slot) => slot.time ?? '').filter(Boolean),
  }));
  const companies: InspectionCompany[] = companiesRaw.map((c, i) => ({
    companyName: c.company_name || `Company ${i + 1}`,
    status: c.status,
    skipped: c.skipped,
  }));
  if (schedule.length === 0 && companies.length === 0) return undefined;
  return { schedule, companies };
}

function mapBatch(
  raw: Record<string, unknown>,
  products: ProductDetail[],
  bidding?: BiddingDetails,
  inspection?: InspectionDetails,
): BatchDetail {
  const batchPk = Number(raw.batch_id ?? raw.batchId);
  const batchNumber = Number(raw.batch_number ?? raw.batchNumber ?? batchPk);
  const productIds = raw.product_ids as number[] | undefined;
  const commission = raw.commission_percent ?? raw.commissionPercent;

  return {
    batchPk,
    batchNumber,
    status: raw.status as string | undefined,
    approvalStatus: (raw.approval_status as string) ?? (raw.approvalStatus as string),
    visibility: raw.visibility as string | undefined,
    step: raw.step != null ? Number(raw.step) : undefined,
    category: (raw.category as string) ?? undefined,
    commissionPercent: commission != null && commission !== '' ? Number(commission) : undefined,
    createdAt: (raw.createdAt as string) ?? (raw.created_at as string) ?? undefined,
    productCount: productIds?.length ?? products.length,
    productTitles: products.map((p) => p.title ?? '').filter(Boolean),
    products,
    bidding,
    inspection,
  };
}

/** Load batch detail for the listing screen (uses internal batch PK, not display batch number). */
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

  const productsRaw = (payload.products ?? []) as Record<string, unknown>[];
  const products = productsRaw.map(mapProduct);
  // Note: the web uses `insepction` (typo from the API). Tolerate either key.
  const bidding = mapBidding(payload.biddingDetails as Record<string, unknown> | undefined);
  const inspection = mapInspection(
    (payload.inspection ?? payload.insepction) as Record<string, unknown> | undefined,
  );

  const batchRaw = payload.batch as Record<string, unknown> | undefined;
  if (batchRaw) {
    return mapBatch(batchRaw, products, bidding, inspection);
  }

  throw new Error('Batch not found');
}
