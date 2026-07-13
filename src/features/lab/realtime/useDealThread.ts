// useDealThread — Deal Room message hook (NewVersion/dynamic/04 §9).
//
// There is NO deal/room API. The Deal Room maps onto Node's GENERIC mobile chat
// (a conversation), with the "managed / concierge" framing rendered client-side:
//
//   GET  /chat/conversation/:id/messages   → thread (paginated)   [NODE]
//   POST /chat/send  { conversation_id, user_id, role, message }  [NODE]
//
// (paths are relative to the greenbidz axios `baseURL`, which already includes
// `/api/v1` — see `GREENBIDZ_API_URL`. Auth + `x-platform` are attached by the
// shared interceptor.)
//
// REAL-TIME = POLLING. Node emits socket events for WTB in-app notifications but
// there is NO per-deal room event contract yet, so the honest interim is a React
// Query `refetchInterval` (~15s) while the screen is mounted — NOT a fabricated
// socket. Sends are optimistic: a temp `me` bubble appends immediately and is
// reconciled by the next poll.
//
// TODO(socket upgrade): when Node ships a per-deal room event contract, replace
// the `refetchInterval` poll with a socket.io subscription (mirror
// `101lab-2/src/services/socket.ts`) — invalidate `labKeys.dealMessages(id)` on
// an inbound event and drop the interval. Tracked as an open backend dependency
// (04 §11). Do NOT build sockets now.
import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { greenbidz } from '@/api/greenbidzClient';
import { WTB_ENABLED } from '@/lib/flags';
import type { DealMessage } from '@/features/lab/data/demo';
import { labKeys } from '@/features/lab/data/labQueryKeys';
import { useAuth } from '@/stores/authStore';

/** Poll cadence while the Deal Room is mounted (04 §9.1: "~20s poll, no webhook";
 *  we use 15s to feel a touch more live). */
const POLL_INTERVAL_MS = 15_000;

/** The buyer's role in Node chat. The customer app is always the buyer side. */
const BUYER_ROLE = 'buyer';

/* ── Node wire shape (generic chat message) ──────────────────────────────────
 * Node's chat message shape is loose across deploys; we read defensively and map
 * to the demo `DealMessage` union the Deal Room screen already renders. */
interface RawDealMessage {
  id?: number | string;
  message?: string;
  text?: string;
  sender_id?: number | string;
  user_id?: number | string;
  role?: string;
  sender_name?: string;
  created_at?: string;
  timestamp?: string;
}

/** A thread message + the stable id/pending flags the screen needs for keys and
 *  optimistic reconciliation. Extends the demo `DealMessage` union. */
export type DealThreadMessage = DealMessage & {
  /** Stable React key. Temp (optimistic) sends carry a `tmp-…` id until reconciled. */
  _id: string;
  /** True while an optimistic send is in flight (screen renders a pending tick). */
  _pending?: boolean;
  /** True when a send failed (screen renders a retry affordance). */
  _failed?: boolean;
};

const timeMeta = (iso?: string, who = ''): string => {
  if (!iso) return who;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return who;
  const hhmm = new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return who ? `${who} · ${hhmm}` : hhmm;
};

/** Map a raw Node message → the demo `DealMessage` (me/them) shape. */
function toDealMessage(raw: RawDealMessage, myUserId: number | null): DealThreadMessage {
  const text = raw.message ?? raw.text ?? '';
  const senderId = raw.sender_id ?? raw.user_id;
  const isMe =
    (raw.role && raw.role.toLowerCase() === BUYER_ROLE) ||
    (myUserId != null && senderId != null && Number(senderId) === myUserId);
  const iso = raw.created_at ?? raw.timestamp;
  const id = raw.id != null ? String(raw.id) : `srv-${iso ?? text.slice(0, 8)}`;
  if (isMe) {
    return { _id: id, kind: 'me', text, meta: timeMeta(iso, 'You') };
  }
  return { _id: id, kind: 'them', text, meta: timeMeta(iso, raw.sender_name ?? 'Seller') };
}

export type DealThreadStatus = 'disabled' | 'loading' | 'ready' | 'error';

export interface UseDealThreadResult {
  /** Thread messages, oldest→newest, incl. any in-flight optimistic sends. */
  messages: DealThreadMessage[];
  /** Fire-and-forget send; optimistically appends a `me` bubble. No-op on blank. */
  send: (text: string) => void;
  status: DealThreadStatus;
  isSending: boolean;
  refetch: () => void;
}

/**
 * Deal Room thread for a conversation `id`. Polls `GET /chat/conversation/:id/
 * messages` every ~15s while mounted and exposes `{ messages, send, status,
 * isSending, refetch }`. `send(text)` optimistically appends a pending `me`
 * bubble and reconciles on the next poll; a failed send marks the bubble
 * `_failed` for retry. Disabled (→ `status:'disabled'`, empty messages) when
 * `WTB_ENABLED` is false or `id` is blank.
 */
export function useDealThread(id: string | undefined): UseDealThreadResult {
  const qc = useQueryClient();
  const myUserId = useAuth((s) => s.profile?.id ?? null);
  const enabled = WTB_ENABLED && !!id;

  // Optimistic outbox: temp `me` bubbles not yet confirmed by a poll.
  const [outbox, setOutbox] = useState<DealThreadMessage[]>([]);

  const query = useQuery({
    queryKey: labKeys.dealMessages(id ?? ''),
    enabled,
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
    queryFn: async (): Promise<DealThreadMessage[]> => {
      const res = await greenbidz.get(`/chat/conversation/${id}/messages`);
      // Node envelopes vary: accept `{ data: [] }`, `{ messages: [] }`, or a bare array.
      const body = res.data;
      const rows: RawDealMessage[] = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : Array.isArray(body?.messages)
            ? body.messages
            : [];
      return rows.map((r) => toDealMessage(r, myUserId));
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      await greenbidz.post('/chat/send', {
        conversation_id: id,
        user_id: myUserId,
        role: BUYER_ROLE,
        message: text,
      });
    },
  });

  const send = useCallback(
    (text: string) => {
      const body = text.trim();
      if (!enabled || !body) return;
      const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const optimistic: DealThreadMessage = {
        _id: tmpId,
        _pending: true,
        kind: 'me',
        text: body,
        meta: timeMeta(new Date().toISOString(), 'You'),
      };
      setOutbox((prev) => [...prev, optimistic]);
      sendMutation.mutate(body, {
        onSuccess: () => {
          // Server has the message now; drop the temp bubble and pull the truth.
          setOutbox((prev) => prev.filter((m) => m._id !== tmpId));
          void qc.invalidateQueries({ queryKey: labKeys.dealMessages(id ?? '') });
        },
        onError: () => {
          setOutbox((prev) =>
            prev.map((m) => (m._id === tmpId ? { ...m, _pending: false, _failed: true } : m)),
          );
        },
      });
    },
    [enabled, id, qc, sendMutation],
  );

  const messages = useMemo(
    () => [...(query.data ?? []), ...outbox],
    [query.data, outbox],
  );

  const status: DealThreadStatus = !enabled
    ? 'disabled'
    : query.isLoading
      ? 'loading'
      : query.isError
        ? 'error'
        : 'ready';

  return {
    messages,
    send,
    status,
    isSending: sendMutation.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
}
