// React Query bindings for the seller-upgrade application.
//
// `SELLER_UPGRADE_KEY` is exported as the cache key because the sell gate is a
// plain function (`launchSellerScan`) called from several screens, so it reads
// the cached status off the query client directly instead of turning every call
// site into a hook.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  getSellerUpgradeStatus,
  submitSellerUpgrade,
  type SellerApplicationInput,
  type SellerDocs,
  type SellerUpgradeError,
  type SellerUpgradeStatus,
} from '@/services/seller/sellerUpgrade';

/** The one cache key for `GET /seller-upgrade/my-status`. */
export const SELLER_UPGRADE_KEY = ['seller-upgrade', 'my-status'] as const;

/** The signed-in user's latest application, or `null` if they never applied. */
export function useSellerUpgradeStatus(): UseQueryResult<
  SellerUpgradeStatus | null,
  SellerUpgradeError
> {
  return useQuery<SellerUpgradeStatus | null, SellerUpgradeError>({
    queryKey: SELLER_UPGRADE_KEY,
    queryFn: getSellerUpgradeStatus,
    staleTime: 60_000,
  });
}

/**
 * THE sell gate — the single source of truth for "may this user list?".
 *
 * True **only** for `status === 'approved'`. Deliberately NOT derived from
 * whether the session is pending: approval reaches an account by two different
 * routes — the seller-upgrade queue (which on production also flips
 * `pw_user_status` to `approved`, so the session stops being pending) and the
 * plain admin users queue (which flips `pw_user_status` but creates no upgrade
 * row). Only the upgrade status is correct in both, and it is also correct on
 * `dev`, where the backend does not flip `pw_user_status` at all.
 *
 * Fails CLOSED: loading, error, no application and any unrecognised status all
 * return false.
 */
export function useCanSell(): boolean {
  const { data } = useSellerUpgradeStatus();
  return data?.status === 'approved';
}

export type SubmitSellerUpgradeVars = {
  values: SellerApplicationInput;
  /** Both documents optional — the application is accepted without them. */
  files?: SellerDocs;
};

/**
 * Submit the application. Rejects with a `SellerUpgradeError` whose `code` the
 * screen must surface — in particular `DUPLICATE_PENDING` / `ALREADY_APPROVED`,
 * which carry the server's own sentence and must not be swallowed.
 */
export function useSubmitSellerUpgrade(): UseMutationResult<
  void,
  SellerUpgradeError,
  SubmitSellerUpgradeVars
> {
  const qc = useQueryClient();
  return useMutation<void, SellerUpgradeError, SubmitSellerUpgradeVars>({
    mutationFn: ({ values, files }) => submitSellerUpgrade(values, files),
    onSuccess: () => {
      // The status the gate reads has just changed to `pending` server-side.
      void qc.invalidateQueries({ queryKey: SELLER_UPGRADE_KEY });
    },
  });
}
