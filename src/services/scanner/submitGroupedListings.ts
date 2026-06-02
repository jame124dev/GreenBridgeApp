import { Platform } from 'react-native';

import { greenbidz } from '@/api/greenbidzClient';
import { marketplaceToPlatform } from '@/features/scanner/constants';
import type { DraftItem } from '@/stores/scanDraftStore';
import type { BatchVisibility } from '@/types/batch';

import { getSiteType, productMetaFromItem } from './buildFormData';

const IS_WEB = Platform.OS === 'web';

async function appendFile(
  fd: FormData,
  field: string,
  uri: string,
  name: string,
  type: string,
) {
  if (IS_WEB) {
    const blob = await fetch(uri).then((r) => r.blob());
    fd.append(field, blob, name);
    return;
  }
  fd.append(field, { uri, name, type } as unknown as Blob);
}

export type SubmitGroupedListingsInput = {
  items: DraftItem[];
  sellerId: number;
  sellerName: string;
  language: string;
  visibility: BatchVisibility;
};

export type SubmitGroupedListingsResult = {
  productIds: number[];
  batchIds: number[];
  groupId: number;
  products: {
    index: number;
    product_id: number;
    batch_id: number;
    batch_number?: number;
    title: string;
  }[];
};

/**
 * W1 (scan_v3) — single multipart POST to `/wp/create-grouped-listings` that
 * atomically creates N products + N batches + 1 auction_group. Replaces the
 * legacy per-product loop (`createProduct` × N + `createBatch`) which never
 * created the auction_group row, leaving mobile grouped listings as orphans
 * not visible on the buyer-side group page.
 *
 * Web reference: `GreenBridgeSeller/src/pages/new-submission-upload/utils/submitSmartBatch.ts`.
 * Backend: `controller/wordPressGroupedSubmit.js` + `services/groupedListingSubmitService.js`.
 *
 * Failure semantics: backend rolls back products/batches/group on any failure
 * (groupedListingSubmitService.js:289-298). Caller treats any thrown error as
 * "nothing persisted" — no partial-progress messaging needed.
 *
 * `from_agent: 'true'` per scan_v3 B2 — mobile scan is an AI-agent surface by
 * the same definition web applies (the AI extracts product fields from photos).
 */
export async function submitGroupedListings(
  input: SubmitGroupedListingsInput,
): Promise<SubmitGroupedListingsResult> {
  if (input.items.length === 0) {
    throw new Error('Cannot submit an empty group');
  }

  // ── DIAG: multi-submit debugging — see grouped-review.tsx for context ────
  console.log('[multi-submit] submitGroupedListings entry', {
    itemCount: input.items.length,
    sellerId: input.sellerId,
    language: input.language,
    visibility: input.visibility,
  });
  // ── /DIAG ─────────────────────────────────────────────────────────────────

  const fd = new FormData();

  const productsMeta = input.items.map((item) =>
    productMetaFromItem(item, {
      sellerId: input.sellerId,
      sellerName: input.sellerName,
    }),
  );
  fd.append('products_json', JSON.stringify(productsMeta));

  // ── DIAG: products_json shape — confirms backend sees N entries ──────────
  console.log('[multi-submit] products_json built', {
    count: productsMeta.length,
    titles: productsMeta.map((m) => String(m.product_title ?? '')),
    json_len: JSON.stringify(productsMeta).length,
  });
  // ── /DIAG ─────────────────────────────────────────────────────────────────

  // Group-level country: take from the first item's first locationCountry.
  // Web does the same (`submitSmartBatch.ts:50-57`).
  const groupCountry = input.items[0]?.locationCountries[0] ?? '';
  if (groupCountry) {
    fd.append('auction_group_json', JSON.stringify({ country: groupCountry }));
  }
  fd.append('seller_id', String(input.sellerId));
  fd.append('country', groupCountry);
  fd.append('visibility', input.visibility);
  fd.append('from_agent', 'true');

  // Per-product files — `images_${i}` + `documents_${i}` (matches the field
  // names `services/groupedListingSubmitService.js` parses).
  // DIAG: collect per-index file counts for logging at the end of the loop.
  const fileTally: { index: number; images: number; documents: number }[] = [];
  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    for (let p = 0; p < item.photos.length; p++) {
      const photo = item.photos[p];
      await appendFile(
        fd,
        `images_${i}`,
        photo.uri,
        `product-${i}-photo-${p}.jpg`,
        'image/jpeg',
      );
    }
    for (let d = 0; d < item.documents.length; d++) {
      const doc = item.documents[d];
      await appendFile(
        fd,
        `documents_${i}`,
        doc.uri,
        doc.name || `product-${i}-doc-${d}`,
        doc.mimeType || 'application/octet-stream',
      );
    }
    fileTally.push({
      index: i,
      images: item.photos.length,
      documents: item.documents.length,
    });
  }

  // ── DIAG: per-product file counts about to be wired into multipart ───────
  console.log('[multi-submit] per-product files', fileTally);
  // ── /DIAG ─────────────────────────────────────────────────────────────────

  // ?type= sourced from the first item's marketplace. All items in a single
  // grouped submit are assumed to share a marketplace (the grouped-review UI
  // doesn't surface a per-item marketplace picker — sellers set marketplace
  // once and items inherit). W3 (scan_v3): now uses the hoisted helper from
  // constants.ts; falls back to env site type if the marketplace doesn't map
  // (defensive — all 4 known marketplaces map cleanly).
  const platform = marketplaceToPlatform(input.items[0]?.marketplace) ?? getSiteType();
  const url = `/wp/create-grouped-listings?lang=${encodeURIComponent(input.language)}&type=${encodeURIComponent(platform)}`;

  // ── DIAG: about to POST ──────────────────────────────────────────────────
  console.log('[multi-submit] POST start', { url, platform, country: groupCountry });
  // ── /DIAG ─────────────────────────────────────────────────────────────────

  const res = await greenbidz.post(
    url,
    fd,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300_000,
    },
  );

  // ── DIAG: server response shape ──────────────────────────────────────────
  // `success` flag + counts of product/batch ids backend reports. If counts
  // are smaller than what we sent, the bug is on the server side; if equal,
  // the bug is downstream (UI or recent-uploads invalidation).
  console.log('[multi-submit] POST response', {
    success: res.data?.success,
    message: res.data?.message,
    productIdCount: Array.isArray(res.data?.data?.product_ids)
      ? res.data.data.product_ids.length
      : null,
    batchIdCount: Array.isArray(res.data?.data?.batch_ids)
      ? res.data.data.batch_ids.length
      : null,
    productsRowsCount: Array.isArray(res.data?.data?.products)
      ? res.data.data.products.length
      : null,
    groupId: res.data?.data?.auction_group?.group_id,
  });
  // ── /DIAG ─────────────────────────────────────────────────────────────────

  const result = res.data;
  if (!result?.success) {
    const msg =
      (result?.message as string | undefined) ??
      'Failed to create grouped listings';
    throw new Error(msg);
  }

  const data = result.data;
  const productIds: number[] = data?.product_ids ?? [];
  const batchIds: number[] = data?.batch_ids ?? [];
  const groupId = data?.auction_group?.group_id;

  if (!productIds.length || !batchIds.length) {
    throw new Error('No product or batch IDs returned from grouped submit');
  }
  if (!groupId) {
    throw new Error('Products created but auction group id missing');
  }

  return {
    productIds,
    batchIds,
    groupId: Number(groupId),
    products: data?.products ?? [],
  };
}
