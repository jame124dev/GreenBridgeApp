// useConversations — the buyer↔seller Messages inbox hook. REST-loads the
// conversation list (`GET /chat/buyer/:id/sellers`) and keeps it live over the
// shared socket: re-emits `joinRooms` on (re)connect, refetches on
// `new_conversation_buyer`, and bumps ordering on any inbound `chat_message`.
// Mirrors the web `BuyerAllChatList` socket wiring.
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/stores/authStore';
import { labKeys } from '@/features/lab/data/labQueryKeys';
import { getLabSocket, joinRooms } from './socket';
import {
  listBuyerConversations,
  MOBILE_CHAT_ROLE,
  type ChatRole,
  type ConversationRow,
} from './chatApi';

export interface UseConversationsResult {
  conversations: ConversationRow[];
  isLoading: boolean;
  isRefetching: boolean;
  isError: boolean;
  isEmpty: boolean;
  refetch: () => void;
}

export function useConversations(): UseConversationsResult {
  const profile = useAuth((s) => s.profile);
  const userId = profile?.id;
  // Always 'buyer' — see MOBILE_CHAT_ROLE. Deriving this from profile.role
  // sent sender_role:'seller' for seller accounts and the server dropped
  // the message.
  const role: ChatRole = MOBILE_CHAT_ROLE;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: labKeys.conversations(),
    queryFn: () => listBuyerConversations(userId as number),
    enabled: userId != null,
  });

  useEffect(() => {
    if (userId == null) return;
    const s = getLabSocket();
    // Identify now + on every (re)connect so the server keeps routing our rooms.
    joinRooms(userId, role);
    const onConnect = () => joinRooms(userId, role);
    const refresh = () => void qc.invalidateQueries({ queryKey: labKeys.conversations() });
    s.on('connect', onConnect);
    s.on('new_conversation_buyer', refresh);
    s.on('new_conversation_seller', refresh);
    s.on('chat_message', refresh); // bump last-message ordering / unread
    return () => {
      s.off('connect', onConnect);
      s.off('new_conversation_buyer', refresh);
      s.off('new_conversation_seller', refresh);
      s.off('chat_message', refresh);
    };
  }, [userId, role, qc]);

  const conversations = query.data ?? [];
  return {
    conversations,
    isLoading: query.isLoading && userId != null,
    isRefetching: query.isRefetching,
    isError: query.isError,
    isEmpty: query.isSuccess && conversations.length === 0,
    refetch: () => {
      void query.refetch();
    },
  };
}
