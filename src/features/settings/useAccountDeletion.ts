import { useMutation, useQuery } from '@tanstack/react-query';

import {
  deleteOwnAccount,
  fetchDeletionPreview,
  type DeletionPreview,
} from '@/services/account/accountDeletion';
import { logout } from '@/services/auth/login';
import { useAuth } from '@/stores/authStore';

/**
 * Outstanding-obligation counts for the delete-account screen.
 *
 * `staleTime: 0` because a stale count here would understate what the user is
 * about to walk away from.
 */
export function useDeletionPreview() {
  return useQuery<DeletionPreview>({
    queryKey: ['account', 'deletion-preview'],
    queryFn: fetchDeletionPreview,
    staleTime: 0,
  });
}

/**
 * Delete the account, then tear down local state exactly as sign-out does.
 *
 * The local teardown runs even when the logout call fails: the account is
 * already gone server-side, so keeping a token in storage would strand the user
 * on a dead session.
 */
export function useDeleteAccount() {
  const reset = useAuth((s) => s.reset);

  return useMutation({
    mutationFn: async (password: string) => {
      await deleteOwnAccount(password);
      try {
        await logout();
      } catch {
        /* account is already deleted server-side — the reset below is what matters */
      }
      reset();
    },
  });
}
