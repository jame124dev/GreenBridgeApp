// useChatThread — one buyer↔seller conversation. Given the counterparty +
// listing (otherPartyId + batchId), it `joinChat`s to resolve/join the server
// conversation, REST-loads the message history, then appends live
// `chat_message` events.
//
// ── SEND CONTRACT (optimistic, queued, reconciled against the server) ───────
// This USED to have no optimistic append at all: `send` emitted and waited for
// the server ECHO to paint the bubble, so tapping send made the message VANISH
// for the whole socket round trip — a silent action, the one thing a composer
// must never be. The first fix painted the bubble immediately and matched the
// echo by message BODY inside a time window. That was still wrong in three ways
// a real network produces every day, all three of which ended in the seller
// receiving the same message twice:
//
//   1. ROOM LOSS ON RECONNECT (the big one). `chat_message` is broadcast ONLY to
//      `chat_conversation_<id>`, and that room is joined ONLY inside the server's
//      `joinChat` handler. socket.io creates a brand-new server-side Socket on
//      every reconnect, so all room membership is gone and the reconnect-time
//      `joinRooms` re-joins only `buyers`/`buyer_<id>`. After any resume or
//      network flap the thread therefore received NO echoes (and none of the
//      seller's replies either): every send flipped to "Not sent", and every tap
//      on retry stored a second row server-side.
//   2. EMITTING WHILE DISCONNECTED. socket.io buffers a non-volatile emit and
//      flushes it on the next connect with no expiry, so a bubble could fail at
//      10s and then be delivered 90s later — outside any body/time window, which
//      appended the SAME message a second time, next to the failed one.
//   3. BODY MATCHING WITH TWO IDENTICAL BODIES IN FLIGHT. The oldest match won
//      even when it had already failed, so the delivered message was the one
//      reported as failed.
//
// The contract now:
//
//   • `send` appends a locally-keyed OUTBOX entry and paints in the same frame.
//     Nothing is emitted here — see `flushOutbox`.
//   • `flushOutbox` emits only while the socket is CONNECTED and this socket is
//     known to be in the conversation room. Otherwise the entry sits `queued`
//     ("waiting for connection") and is emitted by the reconnect handler. We own
//     the queue, so we always know whether a packet has actually left.
//   • On every socket `connect` we re-`joinChat` (rejoining the room), re-pull
//     the newest page (so replies received while we were away are merged) and
//     flush. Room membership and history can no longer silently rot.
//   • An echo claims the OLDEST outstanding entry with the same body, preferring
//     one that has not failed. Inbound rows are deduped by `message_id`, so a
//     row can never be appended twice however it reaches us.
//   • If no echo lands within ECHO_TIMEOUT_MS we do NOT guess: we ask the server.
//     `resync` re-joins, re-reads the thread and reconciles each entry against
//     the rows the server actually stored (only rows NEWER than what we knew when
//     the entry was emitted may claim it, one row per entry). An entry the server
//     proves it has is delivered — its bubble heals. An entry the server proves it
//     does NOT have is marked failed, and only then does tap-to-retry appear.
//     Retry re-verifies first, so a re-emit can never create a second row.
//
// Server rows are ALWAYS status 'sent': the backend has no read receipts, so the
// bubble shows ONE check — never a double check, never "Read".
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
  MOBILE_CHAT_ROLE,
  openConversation,
  sendChatMessage,
  type ChatMessageRow,
  type ChatRole,
} from './chatApi';

const PAGE = 20;

/** How long an EMITTED bubble waits for its echo before we go and ask the server
 *  what actually happened. Shorter than joinChat's 12s on purpose: by send time
 *  the conversation is already open, so this is one emit + one broadcast, not a
 *  handshake. A queued (not yet emitted) entry has no deadline — it is not late,
 *  it has not been sent. */
const ECHO_TIMEOUT_MS = 10_000;

/** Per-app-session nonce for `client_msg_id`. Forward-compat only: today's Node
 *  echo is built from the saved row and does not reflect this back, so
 *  reconciliation is against server rows (see `reconcileWithServer`). */
const CLIENT_NONCE = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export type ThreadMessageStatus = 'sent' | 'queued' | 'pending' | 'failed';

export interface ThreadMessage {
  key: string;
  text: string;
  mine: boolean;
  createdAt?: string | null;
  senderName?: string | null;
  /** Delivery state. Server rows are always 'sent' (ONE check — the backend has
   *  no read receipts, so this can never mean "read"). */
  status: ThreadMessageStatus;
  /** Set only on optimistic rows — the handle to pass back to `retrySend`. */
  pendingId?: string;
}

/** An outbox entry: on screen the instant the user taps send, replaced by the
 *  server row once the server is known to hold it. */
interface PendingMessage {
  id: string;
  /** Sent with the emit for the day the backend echoes it back. */
  clientMsgId: string;
  /** Already trimmed — this is the body we emit and the body we match on. */
  text: string;
  /** ISO of the FIRST paint, so a retry doesn't rewrite the bubble's timestamp. */
  createdAt: string;
  /** Local wall clock of the CURRENT emit, or `null` while the entry is QUEUED
   *  (socket down / room not joined / re-queued by a retry). Only an entry with a
   *  live emit can be "late". */
  emittedAt: number | null;
  /** True once this entry has been emitted at least once. Reconciliation keys on
   *  THIS, not on `emittedAt`: a retry re-queues the entry, and if that erased its
   *  eligibility the verify pass would find nothing and re-send a message the
   *  server already had — the exact duplicate this design exists to prevent. */
  everEmitted: boolean;
  failed: boolean;
  /** Highest `message_id` this client knew at emit time. Only a server row above
   *  it can be this entry's, which is what makes matching an identical body safe
   *  (message_id is auto-increment, so this needs no clock and no time window). */
  sinceMessageId: number;
}

const bodyOf = (m: ChatMessageRow): string => (m.message ?? m.text ?? '').toString().trim();
const rowKeyOf = (m: ChatMessageRow): string | null =>
  m.message_id != null ? String(m.message_id) : null;
const numericIdOf = (m: ChatMessageRow): number => {
  const n = Number(m.message_id);
  return Number.isFinite(n) ? n : 0;
};

function mapMessage(m: ChatMessageRow, userId: number | string | undefined, idx: number): ThreadMessage {
  const mine = userId != null && String(m.sender_id) === String(userId);
  return {
    key: m.message_id != null ? String(m.message_id) : `${m.sender_id ?? 'x'}-${m.created_at ?? idx}`,
    text: (m.message ?? m.text ?? '').toString(),
    mine,
    createdAt: m.created_at,
    senderName: m.sender_name,
    status: 'sent',
  };
}

export interface UseChatThreadResult {
  messages: ThreadMessage[];
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  isLoadingOlder: boolean;
  loadOlder: () => void;
  /** Paints an optimistic bubble and queues it for delivery. `false` = nothing
   *  was accepted (empty body / no open conversation) so the composer must KEEP
   *  the text. A disconnected socket is NOT a refusal: the bubble is painted and
   *  the message goes out on reconnect. */
  send: (text: string) => boolean;
  /** Re-send a FAILED bubble in place — verifies against the server first, so
   *  this can never produce a second row. Same outbox id, so no second bubble. */
  retrySend: (pendingId: string) => void;
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
  // Always 'buyer' — see MOBILE_CHAT_ROLE. Deriving this from profile.role
  // sent sender_role:'seller' for seller accounts and the server dropped
  // the message.
  const role: ChatRole = MOBILE_CHAT_ROLE;
  const qc = useQueryClient();

  const [raw, setRaw] = useState<ChatMessageRow[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const convRef = useRef<string | null>(null);
  /** Whether THIS socket connection is known to be in `chat_conversation_<id>`.
   *  Cleared on `disconnect`, re-set by a successful (re)join. Nothing is emitted
   *  while it is false — an emit into a room we have left is a message the sender
   *  never sees echoed and can only "fix" by sending it twice. */
  const roomReadyRef = useRef(false);
  // Bumped by reload() to re-run the open effect. Without it an `isError` state
  // is terminal for the life of the screen — the only escape is navigating away,
  // which is why the old error copy could only say "go back and try again".
  const [reloadNonce, setReloadNonce] = useState(0);

  /* ── Mount guard ─────────────────────────────────────────────────────────
   * Socket listeners, echo deadlines and the paging fetch all resolve after the
   * user may have left. Re-set on mount (not just cleared on unmount) so a
   * StrictMode double-invoke can't retire a live screen. */
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ── Server rows ─────────────────────────────────────────────────────────
   * `rawRef` mirrors `raw` because reconciliation has to read the CURRENT rows
   * synchronously (from a socket handler / an awaited fetch), which a functional
   * setState updater cannot do without side effects inside the updater. */
  const rawRef = useRef<ChatMessageRow[]>([]);
  const mutateRaw = useCallback((fn: (prev: ChatMessageRow[]) => ChatMessageRow[]) => {
    if (!mountedRef.current) return;
    rawRef.current = fn(rawRef.current);
    setRaw(rawRef.current);
  }, []);

  /** Append rows we don't already have, deduped by `message_id`. This is the one
   *  guarantee that a message can never render twice however it arrives (live
   *  echo, reconnect re-read, or a late flush of the same row). */
  const mergeRaw = useCallback(
    (incoming: ChatMessageRow[]) => {
      if (incoming.length === 0) return;
      mutateRaw((prev) => {
        const known = new Set(prev.map(rowKeyOf).filter((k): k is string => k != null));
        const added = incoming.filter((m) => {
          const key = rowKeyOf(m);
          if (key == null) return true; // no id to dedupe on — keep it
          if (known.has(key)) return false;
          known.add(key);
          return true;
        });
        return added.length === 0 ? prev : [...prev, ...added];
      });
    },
    [mutateRaw],
  );

  /* ── Optimistic outbox ───────────────────────────────────────────────────
   * `pendingRef` is the SYNCHRONOUS truth for the same reason as `rawRef`;
   * `pendingView` is the render copy. Every mutation goes through
   * `mutatePending`, so the two can never drift. */
  const pendingRef = useRef<PendingMessage[]>([]);
  const [pendingView, setPendingView] = useState<PendingMessage[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const seqRef = useRef(0);
  /** `message_id`s already spoken for by an outbox entry. A server row proves the
   *  delivery of exactly ONE send: without this, entry A (which genuinely never
   *  reached the server) could later claim the row that entry B's echo had already
   *  claimed, and A would vanish as "delivered" — silently losing a message the
   *  user has to send again. */
  const claimedRowsRef = useRef<Set<string>>(new Set());

  const mutatePending = useCallback((fn: (prev: PendingMessage[]) => PendingMessage[]) => {
    if (!mountedRef.current) return;
    pendingRef.current = fn(pendingRef.current);
    setPendingView(pendingRef.current);
  }, []);

  const clearEchoTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer != null) clearTimeout(timer);
    timersRef.current.delete(id);
  }, []);

  const resetPending = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    claimedRowsRef.current.clear();
    if (pendingRef.current.length === 0) return;
    mutatePending(() => []);
  }, [mutatePending]);

  // Never leave a deadline running after the screen is gone.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const isMine = useCallback(
    (m: ChatMessageRow) => userId != null && String(m.sender_id) === String(userId),
    [userId],
  );

  const highestKnownMessageId = useCallback(
    () => rawRef.current.reduce((max, m) => Math.max(max, numericIdOf(m)), 0),
    [],
  );

  /**
   * Claim every outstanding entry the SERVER now proves it stored.
   *
   * A row may claim at most one entry and an entry at most one row, so two
   * identical sends need two server rows before both bubbles resolve. Only rows
   * newer than `sinceMessageId` are eligible, which is what stops the same
   * sentence sent last week from "confirming" today's send.
   */
  const reconcileWithServer = useCallback(() => {
    const outstanding = pendingRef.current.filter((p) => p.everEmitted);
    if (outstanding.length === 0) return;
    const delivered = new Set<string>();
    for (const entry of outstanding) {
      const row = rawRef.current.find((m) => {
        const key = rowKeyOf(m);
        if (key == null || claimedRowsRef.current.has(key)) return false;
        if (numericIdOf(m) <= entry.sinceMessageId) return false;
        return isMine(m) && bodyOf(m) === entry.text;
      });
      const key = row ? rowKeyOf(row) : null;
      if (key != null) {
        claimedRowsRef.current.add(key);
        delivered.add(entry.id);
      }
    }
    if (delivered.size === 0) return;
    delivered.forEach((id) => clearEchoTimer(id));
    mutatePending((prev) => prev.filter((p) => !delivered.has(p.id)));
  }, [clearEchoTimer, isMine, mutatePending]);

  /** Fail only entries whose OWN deadline has elapsed. A reconcile pass triggered
   *  by one late entry must not condemn a sibling emitted two seconds ago. */
  const markStaleFailed = useCallback(() => {
    const now = Date.now();
    mutatePending((prev) =>
      prev.map((p) =>
        !p.failed && p.emittedAt != null && now - p.emittedAt >= ECHO_TIMEOUT_MS
          ? { ...p, failed: true }
          : p,
      ),
    );
  }, [mutatePending]);

  /** Arm the "no echo → ask the server" deadline for one emitted entry. */
  const resyncRef = useRef<(opts: { failStale: boolean }) => void>(() => {});
  const armEchoTimer = useCallback(
    (id: string) => {
      clearEchoTimer(id);
      timersRef.current.set(
        id,
        setTimeout(() => {
          timersRef.current.delete(id);
          resyncRef.current({ failStale: true });
        }, ECHO_TIMEOUT_MS),
      );
    },
    [clearEchoTimer],
  );

  /** Emit every QUEUED entry, oldest first — but only on a live socket that is
   *  in the conversation room. Anything left over stays queued for the next
   *  connect, which is strictly better than handing it to socket.io's unbounded
   *  send buffer (a delivery minutes later that nothing on screen expects). */
  const flushOutbox = useCallback(() => {
    const cid = convRef.current;
    if (cid == null || userId == null || !roomReadyRef.current) return;
    if (!getLabSocket().connected) return;
    const queued = pendingRef.current.filter((p) => p.emittedAt == null && !p.failed);
    if (queued.length === 0) return;
    // Read BEFORE the first emit: any row above this can only be one of ours.
    const since = highestKnownMessageId();
    const emitted: string[] = [];
    for (const entry of queued) {
      const ok = sendChatMessage({
        conversationId: cid,
        batchId,
        senderId: userId,
        receiverId: otherPartyId,
        senderRole: role,
        message: entry.text,
        clientMsgId: entry.clientMsgId,
      });
      if (!ok) break; // socket went down mid-flush — the rest stays queued
      emitted.push(entry.id);
    }
    if (emitted.length === 0) return;
    const now = Date.now();
    mutatePending((prev) =>
      prev.map((p) =>
        emitted.includes(p.id)
          ? { ...p, emittedAt: now, everEmitted: true, sinceMessageId: since, failed: false }
          : p,
      ),
    );
    emitted.forEach(armEchoTimer);
  }, [
    batchId,
    otherPartyId,
    role,
    userId,
    highestKnownMessageId,
    mutatePending,
    armEchoTimer,
  ]);

  /** Mark the thread read (mirrors the web) and refresh the inbox so its unread
   *  badge clears immediately instead of lingering until an unrelated message. */
  const markRead = useCallback(() => {
    if (userId == null || !Number.isFinite(otherPartyId)) return;
    void markConversationRead({
      batchId,
      buyerId: role === 'buyer' ? userId : otherPartyId,
      sellerId: role === 'buyer' ? otherPartyId : userId,
      role,
    })
      .then(() => {
        void qc.invalidateQueries({ queryKey: labKeys.conversations() });
        void qc.invalidateQueries({ queryKey: labKeys.chatUnread() });
      })
      .catch(() => {});
  }, [batchId, otherPartyId, role, userId, qc]);

  /**
   * Re-join the conversation room, re-read the newest page and reconcile.
   *
   * This is the single repair path, used by (a) every socket `connect`, (b) an
   * echo deadline expiring and (c) an explicit retry. It is what makes the outbox
   * honest: instead of inferring delivery from a missing echo, we read what the
   * server actually stored.
   */
  const resync = useCallback(
    async (opts: { failStale: boolean }) => {
      const cid = convRef.current;
      if (cid == null || userId == null) return;
      try {
        if (Number.isFinite(otherPartyId)) {
          // joinChat is idempotent server-side (getOrCreateConversation finds the
          // existing row) and is the ONLY thing that puts this socket back into
          // `chat_conversation_<id>` after a reconnect.
          await openConversation({ batchId, userId, role, otherPartyId });
          if (!mountedRef.current) return;
          roomReadyRef.current = true;
        }
        const page = await getConversationMessages(cid, { limit: PAGE });
        if (!mountedRef.current) return;
        mergeRaw(page.messages);
      } catch {
        // Couldn't reach the chat service. Nothing is assumed delivered; the
        // entry's own deadline (or the next connect) tries again.
        if (opts.failStale) markStaleFailed();
        return;
      }
      reconcileWithServer();
      if (opts.failStale) markStaleFailed();
      flushOutbox();
    },
    [
      batchId,
      otherPartyId,
      role,
      userId,
      mergeRaw,
      reconcileWithServer,
      markStaleFailed,
      flushOutbox,
    ],
  );
  /* Timers, socket listeners and the open effect call the repair/flush/read work
   * through refs so they never capture a stale copy — and so subscribing does not
   * depend on identities that change for unrelated reasons (a listener that
   * re-subscribes on every render is a listener that can miss an event). */
  const flushRef = useRef<() => void>(() => {});
  const markReadRef = useRef<() => void>(() => {});
  useEffect(() => {
    resyncRef.current = (opts) => void resync(opts);
    flushRef.current = flushOutbox;
    markReadRef.current = markRead;
  }, [resync, flushOutbox, markRead]);

  // Open (joinChat) + load history on mount / when the target changes.
  useEffect(() => {
    // A new target (or a reload) makes the previous outbox meaningless: the
    // history we are about to load IS the server truth for this thread.
    resetPending();
    roomReadyRef.current = false;
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
        roomReadyRef.current = true;
        setConversationId(cid);
        const page = await getConversationMessages(cid, { limit: PAGE });
        if (!alive) return;
        rawRef.current = page.messages;
        setRaw(page.messages);
        setHasMore(page.hasMore);
        markReadRef.current();
        // Anything the user typed before the room existed goes out now.
        flushRef.current();
      } catch {
        if (alive) setIsError(true);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, role, batchId, otherPartyId, reloadNonce, resetPending]);

  /** Retry opening the conversation after an error. */
  const reload = useCallback(() => {
    setIsError(false);
    setReloadNonce((n) => n + 1);
  }, []);

  // Live inbound + echo reconciliation + reconnect repair for THIS conversation.
  useEffect(() => {
    const s = getLabSocket();
    const onMsg = (msg: ChatMessageRow) => {
      if (convRef.current == null || String(msg.conversation_id) !== String(convRef.current)) return;
      const key = rowKeyOf(msg);
      // Already have it (merged by a resync, or a duplicate broadcast) — ignore.
      if (key != null && rawRef.current.some((m) => rowKeyOf(m) === key)) return;
      if (isMine(msg)) {
        // Claim the OLDEST outstanding entry with this body, preferring one that
        // has not failed: with two identical bodies in flight the delivered one
        // must not be the one left reported as failed. A failed entry is still
        // eligible so a late echo HEALS its bubble instead of duplicating it.
        const body = bodyOf(msg);
        const claimable = (p: PendingMessage) => p.everEmitted && p.text === body;
        const claimed =
          pendingRef.current.find((p) => claimable(p) && !p.failed) ??
          pendingRef.current.find(claimable);
        if (claimed) {
          clearEchoTimer(claimed.id);
          if (key != null) claimedRowsRef.current.add(key);
          mutatePending((prev) => prev.filter((p) => p.id !== claimed.id));
        }
      }
      // Unclaimed echoes are still real messages — merge either way (a message
      // the same account sent from the web client is real, just not ours).
      mergeRaw([msg]);
    };
    const onDisconnect = () => {
      // The server-side Socket is gone; so is its room membership. Nothing may be
      // emitted until a fresh joinChat lands.
      roomReadyRef.current = false;
    };
    const onConnect = () => {
      // Rejoin → re-read → reconcile → flush. Not `failStale`: a reconnect is not
      // evidence that anything failed.
      resyncRef.current({ failStale: false });
      markReadRef.current();
    };
    s.on('chat_message', onMsg);
    s.on('disconnect', onDisconnect);
    s.on('connect', onConnect);
    return () => {
      s.off('chat_message', onMsg);
      s.off('disconnect', onDisconnect);
      s.off('connect', onConnect);
    };
  }, [conversationId, isMine, clearEchoTimer, mutatePending, mergeRaw]);

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
        mutateRaw((prev) => [...page.messages, ...prev]);
        if (mountedRef.current) setHasMore(page.hasMore);
      } catch {
        /* keep what we have */
      } finally {
        if (mountedRef.current) setIsLoadingOlder(false);
      }
    })();
  }, [conversationId, raw, hasMore, isLoadingOlder, mutateRaw]);

  const send = useCallback(
    (text: string): boolean => {
      const body = text.trim();
      if (!body || !conversationId || userId == null) return false;
      seqRef.current += 1;
      const id = `p${seqRef.current}`;
      const now = Date.now();
      // Paint FIRST. Delivery is `flushOutbox`'s job — a disconnected socket
      // delays the message, it does not refuse it, and the bubble says so.
      mutatePending((prev) => [
        ...prev,
        {
          id,
          clientMsgId: `${CLIENT_NONCE}-${id}`,
          text: body,
          createdAt: new Date(now).toISOString(),
          emittedAt: null,
          everEmitted: false,
          failed: false,
          sinceMessageId: highestKnownMessageId(),
        },
      ]);
      flushOutbox();
      return true;
    },
    [conversationId, userId, mutatePending, highestKnownMessageId, flushOutbox],
  );

  const retrySend = useCallback(
    (pendingId: string) => {
      const target = pendingRef.current.find((p) => p.id === pendingId);
      if (!target || !conversationId || userId == null) return;
      // Back to queued, then VERIFY before anything is re-emitted: if the server
      // already has this message the entry resolves here and no second row is
      // ever created. If it does not, `resync` ends in `flushOutbox`, which
      // re-emits (or leaves it queued until the socket is back).
      clearEchoTimer(pendingId);
      mutatePending((prev) =>
        prev.map((p) => (p.id === pendingId ? { ...p, failed: false, emittedAt: null } : p)),
      );
      void resync({ failStale: false });
    },
    [conversationId, userId, clearEchoTimer, mutatePending, resync],
  );

  // Outbox entries always tail the server rows: they are, by definition, the
  // newest thing in the thread, and `loadOlder` PREPENDS.
  const messages = useMemo(() => {
    const rows = raw.map((m, i) => mapMessage(m, userId, i));
    for (const p of pendingView) {
      rows.push({
        key: `pending-${p.id}`,
        text: p.text,
        mine: true,
        createdAt: p.createdAt,
        status: p.failed ? 'failed' : p.emittedAt == null ? 'queued' : 'pending',
        pendingId: p.id,
      });
    }
    return rows;
  }, [raw, userId, pendingView]);

  return {
    messages,
    isLoading,
    isError,
    hasMore,
    isLoadingOlder,
    loadOlder,
    send,
    retrySend,
    canSend: conversationId != null,
    reload,
  };
}
