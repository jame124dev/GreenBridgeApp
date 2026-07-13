// socket.ts — the buyer↔seller Messages socket (mobile port of the web
// `101lab-2/src/services/socket.ts`). ONE shared socket.io connection for the
// whole app, connecting to the Node chat server (`getSocketUrl()` — the API
// host without `/api/v1`). websocket-only transport + infinite reconnection,
// exactly like the web client so the event contract can't drift.
//
// Event contract (Node buyer↔seller chat), all mirrored from the web:
//   emit  joinRooms       { user_id, role }                      (identify on connect)
//   emit  joinChat        { batch_id:'batch-<id>', user_id, role, other_party_id, platform }, cb→{ conversation_id }
//   emit  chat_message    { conversation_id, batch_id, sender_id, receiver_id, sender_role, message, platform }
//   emit  notification_read{ sellerId, buyerId, batchId }
//   on    chat_message     (inbound message on a joined conversation)
//   on    new_conversation_buyer / new_conversation_seller       (refresh the inbox)
//
// The socket carries NO auth token (the web client doesn't either) — identity is
// established by `joinRooms` with the logged-in user's id + role.
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { getSocketUrl } from '@/lib/env';

let socket: Socket | null = null;

/** Lazily create (once) + return the shared chat socket. */
export function getLabSocket(): Socket {
  if (!socket) {
    socket = io(getSocketUrl(), {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      transports: ['websocket'],
    });
    if (__DEV__) {
      socket.on('connect', () => console.log('[chat socket] connected', socket?.id));
      socket.on('disconnect', (r) => console.log('[chat socket] disconnected', r));
      socket.on('connect_error', (e) => console.log('[chat socket] connect_error', e.message));
    }
  }
  return socket;
}

/** Identify this user on the socket so the server routes their rooms. Safe to
 *  call repeatedly (e.g. after a reconnect) — the server treats it idempotently. */
export function joinRooms(userId: string | number, role: 'buyer' | 'seller'): void {
  getLabSocket().emit('joinRooms', { user_id: String(userId), role });
}

/** Live connection state for a small "connecting…"/offline affordance. */
export function useSocketConnected(): boolean {
  const [connected, setConnected] = useState(() => getLabSocket().connected);
  useEffect(() => {
    const s = getLabSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    setConnected(s.connected);
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);
  return connected;
}
