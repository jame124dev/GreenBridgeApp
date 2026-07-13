import { useMutation } from '@tanstack/react-query';

import { login, type LoginPayload } from '@/services/auth/login';
import { useAuth } from '@/stores/authStore';

export function useLogin() {
  const setProfile = useAuth((s) => s.setProfile);
  const setPending = useAuth((s) => s.setPending);

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (res) => {
      setPending(false);
      setProfile({
        id: res.user.id,
        email: res.user.email,
        name: res.user.name,
        role: res.user.role as 'admin' | 'seller' | 'buyer',
        company: res.company,
      });
    },
  });
}
