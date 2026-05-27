export type BatchVisibility = 'PUBLIC' | 'PRIVATE' | 'NETWORK';

export type SellerBatch = {
  /** Display batch number (shown in UI). */
  batchId: number;
  /** Internal PK for API routes (`/batch/:batch_pk`). */
  batchPk: number;
  category?: string;
  status?: string;
  approvalStatus?: string;
  postDate?: string;
  step?: number;
  /** Primary title (English). Localized variants live on titleI18n. */
  title?: string;
  titleI18n?: { en?: string; zh?: string; ja?: string; th?: string };
  /** First product thumbnail URL (used in row list). */
  thumbnailUrl?: string;
  /** Number of products in this batch. */
  itemsCount?: number;
  /** Number of bids received across all products in this batch. */
  bidsCount?: number;
  commissionPercent?: number;
};
