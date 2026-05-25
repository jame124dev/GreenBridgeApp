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
};
