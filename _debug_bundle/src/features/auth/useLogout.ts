import { useMutation } from '@tanstack/react-query';

import { logout } from '@/services/auth/login';
import { useAuth } from '@/stores/authStore';

export function useLogout() {
  const reset = useAuth((s) => s.reset);

  return useMutation({
    mutationFn: async () => {
      await logout();
      reset();
    },
  });
}
