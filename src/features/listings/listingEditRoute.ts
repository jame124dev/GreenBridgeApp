import type { Href } from 'expo-router';

/**
 * Href builder for the seller listing editor.
 *
 * Kept in the feature rather than `src/lib/routes.ts` so this work adds no edit
 * to a file every other flow imports.
 *
 * Either identifier works:
 *  - `productId` — go straight to the editor (the contract is product-scoped).
 *  - `batchPk`   — the seller's lists are batch-scoped, so the screen resolves
 *                  the product first and asks which item when a batch holds
 *                  more than one.
 */
export function listingEditHref(params: {
  productId?: number;
  batchPk?: number;
  title?: string;
}): Href {
  return {
    pathname: '/(lab)/listing-edit',
    params: {
      productId: params.productId != null ? String(params.productId) : undefined,
      batchPk: params.batchPk != null ? String(params.batchPk) : undefined,
      title: params.title,
    },
  } as unknown as Href;
}
