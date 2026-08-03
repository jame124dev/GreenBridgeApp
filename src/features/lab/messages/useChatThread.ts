// useChatThread — one buyer↔seller conversation. Given the counterparty +
// listing (otherPartyId + batchId), it `joinChat`s to resolve/join the server
// conversation, REST-loads the message history, then appends live inbound
// `chat_message` events. Sends mirror the web: emit `chat_message` and let the
// server ECHO it back onto the thread (no optimistic append → no dedup bug).
//
// Both entry points supply the same two ids: the inbox row (`seller.ID` +
// `seller.batch_id`) and the match "Contact seller" CTA (sellerId + product
// batch). `conversationId` is resolved by joinChat, not required as input.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/stores/authStore';
import { labKeys } from '@/features/lab/data/labQueryKeys';
import { getLabSocket } from './socket';
import {
  getConversationMessages,
  markConversationRead,
  openConversation,
  sendChatMessage,
  type ChatMessageRow,
  type ChatRole,
} from './chatApi';

const PAGE = 20;

export interface ThreadMessage {
  key: string;
  text: string;
  mine: boolean;
  createdAt?: string | null;
  senderName?: string | null;
}

function mapMessage(m: ChatMessageRow, userId: number | string | undefined, idx: number): ThreadMessage {
  const mine = userId != null && String(m.sender_id) === String(userId);
  return {
    key: m.message_id != null ? String(m.message_id) : `${m.sender_id ?? 'x'}-${m.created_at ?? idx}`,
    text: (m.message ?? m.text ?? '').toString(),
    mine,
    createdAt: m.created_at,
    senderName: m.sender_name,
  };
}

export interface UseChatThreadResult {
  messages: ThreadMessage[];
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  isLoadingOlder: boolean;
  loadOlder: () => void;
  send: (text: string) => void;
  canSend: boolean;
  /** Retry opening the conversation after `isError`. */
  reload: () => void;
}

export function useChatThread(params: {
  batchId: number;
  otherPartyId: number;
}): UseChatThreadResult {
  const { batchId, otherPartyId } = params;
  const profile = useAuth((s) => s.profile);
  const userId = profile?.id;
  const role: ChatRole = profile?.role === 'seller' ? 'seller' : 'buyer';
  const qc = useQueryClient();

  const [raw, setRaw] = useState<ChatMessageRow[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const convRef = useRef<string | null>(null);
  // Bumped by reload() to re-run the open effect. Without it an `isError` state
  // is terminal for the life of the screen — the only escape is navigating away,
  // which is why the old error copy could only say "go back and try again".
  const [reloadNonce, setReloadNonce] = useState(0);

  // Open (joinChat) + load history on mount / when the target changes.
  useEffect(() => {
    if (userId == null || !Number.isFinite(batchId) || !Number.isFinite(otherPartyId)) {
      setIsLoading(false);
      return;
    }
    let alive = true;
    setIsLoading(true);
    setIsError(false);
    (async () => {
      try {
        const cid = await openConversation({ batchId, userId, role, otherPartyId });
        if (!alive) return;
        convRef.current = cid;
        setConversationId(cid);
        const page = await getConversationMessages(cid, { limit: PAGE });
        if (!alive) return;
        setRaw(page.messages);
        setHasMore(page.hasMore);
        // Mark the thread read on open (mirrors the web), then refresh the
        // inbox so its unread badge clears immediately instead of lingering
        // until an unrelated inbound message arrives.
        void markConversationRead({
          batchId,
          buyerId: role === 'buyer' ? userId : otherPartyId,
          sellerId: role === 'buyer' ? otherPartyId : userId,
          role,
        })
          .then(() => qc.invalidateQueries({ queryKey: labKeys.conversations() }))
          .catch(() => {});
      } catch {
        if (alive) setIsError(true);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, role, batchId, otherPartyId, reloadNonce]);

  /** Retry opening the conversation after an error. */
  const reload = useCallback(() => {
    setIsError(false);
    setReloadNonce((n) => n + 1);
  }, []);

  // Live inbound — append messages that belong to THIS conversation.
  useEffect(() => {
    const s = getLabSocket();
    const onMsg = (msg: ChatMessageRow) => {
      if (convRef.current != null && String(msg.conversation_id) === String(convRef.current)) {
        setRaw((prev) => [...prev, msg]);
      }
    };
    s.on('chat_message', onMsg);
    return () => {
      s.off('chat_message', onMsg);
    };
  }, [conversationId]);

  const loadOlder = useCallback(() => {
    if (!conversationId || raw.length === 0 || !hasMore || isLoadingOlder) return;
    setIsLoadingOlder(true);
    const oldest = raw[0]?.message_id;
    void (async () => {
      try {
        const page = await getConversationMessages(conversationId, {
          limit: PAGE,
          beforeMessageId: oldest,
        });
        setRaw((prev) => [...page.messages, ...prev]);
        setHasMore(page.hasMore);
      } catch {
        /* keep what we have */
      } finally {
        setIsLoadingOlder(false);
      }
    })();
  }, [conversationId, raw, hasMore, isLoadingOlder]);

  const send = useCallback(
    (text: string) => {
      const body = text.trim();
      if (!body || !conversationId || userId == null) return;
      // No optimistic append — the server echoes `chat_message` back to the
      // sender, which appends via the listener above (matches the web client).
      sendChatMessage({
        conversationId,
        batchId,
        senderId: userId,
        receiverId: otherPartyId,
        senderRole: role,
        message: body,
      });
    },
    [conversationId, batchId, otherPartyId, role, userId],
  );

  const messages = useMemo(() => raw.map((m, i) => mapMessage(m, userId, i)), [raw, userId]);

  return {
    messages,
    isLoading,
    isError,
    hasMore,
    isLoadingOlder,
    loadOlder,
    send,
    canSend: conversationId != null,
    reload,
  };
}
