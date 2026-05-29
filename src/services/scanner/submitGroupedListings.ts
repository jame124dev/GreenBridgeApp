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

  const fd = new FormData();

  const productsMeta = input.items.map((item) =>
    productMetaFromItem(item, {
      sellerId: input.sellerId,
      sellerName: input.sellerName,
    }),
  );
  fd.append('products_json', JSON.stringify(productsMeta));

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
  }

  // ?type= sourced from the first item's marketplace. All items in a single
  // grouped submit are assumed to share a marketplace (the grouped-review UI
  // doesn't surface a per-item marketplace picker — sellers set marketplace
  // once and items inherit). W3 (scan_v3): now uses the hoisted helper from
  // constants.ts; falls back to env site type if the marketplace doesn't map
  // (defensive — all 4 known marketplaces map cleanly).
  const platform = marketplaceToPlatform(input.items[0]?.marketplace) ?? getSiteType();

  const res = await greenbidz.post(
    `/wp/create-grouped-listings?lang=${encodeURIComponent(input.language)}&type=${encodeURIComponent(platform)}`,
    fd,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300_000,
    },
  );

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
