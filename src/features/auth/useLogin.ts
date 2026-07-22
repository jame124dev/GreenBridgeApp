import { useMutation } from '@tanstack/react-query';

import { login, recheckApproval, type LoginPayload, type LoginSuccess } from '@/services/auth/login';
import { useAuth } from '@/stores/authStore';

function useApplyAuthSuccess() {
  const setProfile = useAuth((s) => s.setProfile);
  const setPending = useAuth((s) => s.setPending);
  return (res: LoginSuccess) => {
    setPending(false);
    setProfile({
      id: res.user.id,
      email: res.user.email,
      name: res.user.name,
      role: res.user.role as 'admin' | 'seller' | 'buyer',
      company: res.company,
    });
  };
}

export function useLogin() {
  const apply = useApplyAuthSuccess();
  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: apply,
  });
}

/**
 * Re-check a pending account's approval (pending screen). On success the store
 * gets the real profile + `isPending=false`, so the RootLayout AuthGuard routes
 * the user out of `(auth)` and into the app automatically.
 */
export function useRecheckApproval() {
  const apply = useApplyAuthSuccess();
  return useMutation({
    mutationFn: () => recheckApproval(),
    onSuccess: apply,
  });
}
