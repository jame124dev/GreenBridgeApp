import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchUserProfile,
  updateUserSettings,
  type UpdateUserSettingsPayload,
  type UserProfile,
} from '@/services/auth/userProfile';
import { useAuth } from '@/stores/authStore';

const PROFILE_QUERY_KEY = ['user', 'profile'] as const;

export function userProfileQueryKey(userId: number | undefined) {
  return [...PROFILE_QUERY_KEY, userId ?? null] as const;
}

export function useUserProfile() {
  const profile = useAuth((s) => s.profile);

  return useQuery<UserProfile>({
    queryKey: userProfileQueryKey(profile?.id),
    queryFn: () => {
      if (!profile?.id) throw new Error('Not signed in');
      return fetchUserProfile(profile.id);
    },
    enabled: !!profile?.id,
    staleTime: 60_000,
  });
}

export function useUpdateUserSettings() {
  const profile = useAuth((s) => s.profile);
  const setProfile = useAuth((s) => s.setProfile);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateUserSettingsPayload) => {
      if (!profile?.id) throw new Error('Not signed in');
      await updateUserSettings(profile.id, payload);
      return payload;
    },
    onSuccess: (payload) => {
      // Keep the slim cached profile in sync where there's overlap.
      if (profile && (payload.company !== undefined || payload.firstName !== undefined)) {
        setProfile({
          ...profile,
          name: payload.firstName ?? profile.name,
          company: payload.company !== undefined ? payload.company || null : profile.company,
        });
      }
      void qc.invalidateQueries({ queryKey: userProfileQueryKey(profile?.id) });
    },
  });
}
