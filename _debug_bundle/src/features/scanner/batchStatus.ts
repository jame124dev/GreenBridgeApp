import type { SellerBatch } from '@/types/batch';

// Single source of truth for batch → semantic-tone mapping. Both
// `RecentSubmissionsList` (Home) and `history.tsx` (History tab) previously
// duplicated this logic; centralizing it keeps the two screens in lockstep
// when backend status values change.
//
// The 7 tones drive the <Badge variant> on each row and the colored edge
// strip on the left of the card. Adding a new backend status only needs an
// edit here.

export type StatusTone =
  | 'live'
  | 'pending'
  | 'sold'
  | 'review'
  | 'inspect'
  | 'inactive'
  | 'submitted';

export function classifyStatus(batch: SellerBatch): StatusTone {
  if (batch.approvalStatus === 'pending') return 'pending';
  const s = (batch.status ?? '').toLowerCase();
  if (s.includes('live') || s === 'publish') return 'live';
  if (s === 'sold') return 'sold';
  if (s === 'under_review') return 'review';
  if (s.startsWith('inspection')) return 'inspect';
  if (s.startsWith('deactive')) return 'inactive';
  return 'submitted';
}
