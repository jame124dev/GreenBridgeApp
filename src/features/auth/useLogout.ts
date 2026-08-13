import { useMutation } from '@tanstack/react-query';

import { logout } from '@/services/auth/login';
import { queryClient } from '@/lib/queryClient';
import { useComposer } from '@/features/lab/stores/composerStore';
import { useConversation } from '@/features/lab/stores/conversationStore';
import { useSession } from '@/features/lab/stores/sessionStore';
import { useAuth } from '@/stores/authStore';

export function useLogout() {
  const reset = useAuth((s) => s.reset);

  return useMutation({
    mutationFn: async () => {
      await logout();
      reset();

      // ⚠️ WIPE THE PREVIOUS USER'S DATA. Found on-device 2026-08-13: after
      // signing out and signing in as a brand-new account, the Matches tab still
      // showed the PREVIOUS user's badge count of 3 — a fresh account with no
      // wants at all. `reset()` only clears the auth store, so every React Query
      // cache entry (wants, matches, listings, seller-upgrade status, messages)
      // survived into the next session, as did the lab chat thread and the
      // conversation id.
      //
      // It is memory-only, so killing the app hid it — which is exactly why it
      // went unnoticed. On a shared or demo device the second user could see the
      // first user's lists until each query refetched.
      queryClient.clear();
      useConversation.setState({ byId: {} });
      useSession.getState().reset();
      useComposer.getState().reset();
    },
  });
}
