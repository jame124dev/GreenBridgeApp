// Self-service account deletion (App Store Guideline 5.1.1(v)).
//
// Both calls are authenticated by the JWT that src/api/interceptors.ts attaches
// as `Authorization: Bearer`. The backend derives WHOSE account to act on from
// that token alone — the password below re-authenticates, it never identifies.
import { greenbidz } from '@/api/greenbidzClient';

export type DeletionPreview = {
  liveListings: number;
  openOrders: number;
  unpaidWinningBids: number;
  activeWants: number;
  /** Decided server-side so the warning copy can't disagree with the counts. */
  hasOutstanding: boolean;
};

export type AccountDeletionErrorCode =
  | 'PASSWORD_REQUIRED'
  | 'INVALID_PASSWORD'
  | 'ADMIN_ACCOUNT'
  | 'UNKNOWN';

/** Counts of what the signed-in user still has open. */
export async function fetchDeletionPreview(): Promise<DeletionPreview> {
  const res = await greenbidz.get('/user/me/deletion-preview');
  return res.data.data as DeletionPreview;
}

/** Delete the signed-in user's account. */
export async function deleteOwnAccount(password: string): Promise<void> {
  // axios needs `data` to send a body on DELETE.
  await greenbidz.delete('/user/me', { data: { password } });
}

/** Map an axios failure to a code the UI turns into recovery copy. */
export function getAccountDeletionErrorCode(error: unknown): AccountDeletionErrorCode {
  const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
  if (code === 'PASSWORD_REQUIRED' || code === 'INVALID_PASSWORD' || code === 'ADMIN_ACCOUNT') {
    return code;
  }
  return 'UNKNOWN';
}
