/**
 * Found on-device 2026-08-13: signing out of one account and into a BRAND-NEW one
 * left the previous user's Matches badge ("3") on screen, for an account with no
 * wants at all. `reset()` cleared the auth store but nothing cleared the React
 * Query caches or the lab chat stores, so the previous session's data survived.
 *
 * Memory-only, so killing the app hid it — which is why nobody saw it. On a shared
 * or demo device the next user could see the previous user's lists until each
 * query refetched.
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/services/auth/login', () => ({ logout: jest.fn().mockResolvedValue(undefined) }));
// MMKV is a Nitro native module and cannot load under Jest — same in-memory stand-in
// pendingSession.test.ts uses. Without it the whole suite fails at import time.
jest.mock('@/lib/mmkv', () => {
  const store = new Map<string, unknown>();
  return {
    mmkv: {
      set: (k: string, v: unknown) => store.set(k, v),
      getString: (k: string) => store.get(k) as string | undefined,
      getBoolean: (k: string) => store.get(k) as boolean | undefined,
      getNumber: (k: string) => store.get(k) as number | undefined,
      remove: (k: string) => store.delete(k),
    },
  };
});

import { queryClient } from '@/lib/queryClient';
import { useConversation } from '@/features/lab/stores/conversationStore';
import { useSession } from '@/features/lab/stores/sessionStore';
import { useComposer } from '@/features/lab/stores/composerStore';
import { useAuth } from '@/stores/authStore';
import { useLogout } from '../useLogout';

// `useMutation` needs a provider, and it must wrap the SAME singleton the hook
// clears. gcTime: 0 prevents the settled-mutation GC timer from holding Jest open.
queryClient.setDefaultOptions({ mutations: { gcTime: 0 }, queries: { gcTime: 0 } });
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: queryClient }, children);

describe('useLogout', () => {
  it('wipes the previous user’s cached data, not just the auth store', async () => {
    // Seed everything a signed-in session accumulates.
    queryClient.setQueryData(['wants'], [{ id: 1, title: 'someone else’s want' }]);
    useConversation.getState().seed('conv-1', [
      { id: 'm1', role: 'user', createdAt: 1, content: [{ kind: 'text', text: 'private' }] },
    ]);
    useComposer.getState().setInput('half-typed message');
    useAuth.getState().setProfile({
      id: 1, email: 'a@b.com', name: 'A', role: 'buyer', company: null,
    });

    const { result } = renderHook(() => useLogout(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });

    // The bug: each of these used to survive into the next user's session.
    expect(queryClient.getQueryData(['wants'])).toBeUndefined();
    expect(useConversation.getState().byId).toEqual({});
    expect(useComposer.getState().input).toBe('');
    expect(useAuth.getState().profile).toBeNull();
  });

  it('mints a fresh conversation id so the next user does not resume a stranger’s thread', async () => {
    const before = useSession.getState().getConversationId();
    const { result } = renderHook(() => useLogout(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(useSession.getState().getConversationId()).not.toBe(before);
  });
});
