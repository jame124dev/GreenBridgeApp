import { create } from 'zustand';

import { mmkv } from '@/lib/mmkv';

export type Profile = {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'seller' | 'buyer';
  company: string | null;
};

type AuthState = {
  profile: Profile | null;
  isPending: boolean;
  hydrated: boolean;
  setProfile: (profile: Profile | null) => void;
  setPending: (pending: boolean) => void;
  hydrate: () => void;
  reset: () => void;
  isAuthed: () => boolean;
};

export const useAuth = create<AuthState>((set, get) => ({
  profile: null,
  isPending: false,
  hydrated: false,
  setProfile: (profile) => set({ profile }),
  setPending: (isPending) => set({ isPending }),
  hydrate: () => {
    const raw = mmkv.getString('auth.profile');
    const isPending = mmkv.getBoolean('auth.pending') ?? false;
    set({
      profile: raw ? (JSON.parse(raw) as Profile) : null,
      isPending,
      hydrated: true,
    });
  },
  reset: () => set({ profile: null, isPending: false }),
  isAuthed: () => !!get().profile,
}));
