import { create } from 'zustand';

import { mmkv } from '@/lib/mmkv';

export type Profile = {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'seller' | 'buyer';
  company: string | null;
};

/**
 * Per-step approval facts from the backend (loginV3 ACCOUNT_PENDING + the
 * recheck-approval 403). The "Awaiting approval" screen turns these into the
 * visible checklist (email / documents / admin review). Raw facts only — the
 * presentation logic lives in `deriveApprovalChecklist`.
 */
export type ApprovalState = {
  status: string; // 'pending' | 'profile_incomplete' | 'approved'
  role: 'admin' | 'seller' | 'buyer';
  email_verified: boolean;
  documents: { business_registration: boolean; waste_disposal: boolean };
};

type AuthState = {
  profile: Profile | null;
  isPending: boolean;
  approval: ApprovalState | null;
  hydrated: boolean;
  setProfile: (profile: Profile | null) => void;
  setPending: (pending: boolean) => void;
  setApproval: (approval: ApprovalState | null) => void;
  hydrate: () => void;
  reset: () => void;
  isAuthed: () => boolean;
};

export const useAuth = create<AuthState>((set, get) => ({
  profile: null,
  isPending: false,
  approval: null,
  hydrated: false,
  setProfile: (profile) => set({ profile }),
  setPending: (isPending) => set({ isPending }),
  setApproval: (approval) => {
    if (approval) mmkv.set('auth.approval', JSON.stringify(approval));
    else mmkv.remove('auth.approval');
    set({ approval });
  },
  hydrate: () => {
    const raw = mmkv.getString('auth.profile');
    const isPending = mmkv.getBoolean('auth.pending') ?? false;
    const approvalRaw = mmkv.getString('auth.approval');
    set({
      profile: raw ? (JSON.parse(raw) as Profile) : null,
      isPending,
      approval: approvalRaw ? (JSON.parse(approvalRaw) as ApprovalState) : null,
      hydrated: true,
    });
  },
  reset: () => {
    mmkv.remove('auth.approval');
    set({ profile: null, isPending: false, approval: null });
  },
  isAuthed: () => !!get().profile,
}));
