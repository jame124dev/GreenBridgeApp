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
// The handshake now carries the stored access token (`auth.token`). The server
// is in "accept and observe" mode — it verifies the token and logs whether the
// `user_id` we claim matches, but still accepts tokenless clients, so this is
// forward-compat only. Once every client ships a token the server flips
// CHAT_SOCKET_AUTH_ENFORCE=true and a tokenless/forged socket is refused.
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { getSocketUrl } from '@/lib/env';
import { getSecureItem } from '@/lib/secureStorage';

let socket: Socket | null = null;

/** socket.io holds the CONNECT packet until the `auth` callback fires, and the
 *  transport stays healthy while it waits — so a secure-storage read that never
 *  settles would leave the client open-but-never-connected with no `disconnect`
 *  event to trigger reconnection. Bound the read and connect anonymously
 *  instead: that is the pre-change behaviour, and the server is still in
 *  accept-and-observe mode, so a recoverable degradation beats a silent hang. */
const TOKEN_READ_TIMEOUT_MS = 2000;

/** Reconnection is `Infinity` attempts at 1s, and each attempt re-runs the auth
 *  callback = two native bridge calls (`isAvailableAsync` + `getItemAsync`).
 *  Cache the token briefly so a reconnect storm doesn't hammer the bridge; the
 *  short TTL keeps the callback's whole point intact (a rotated token is picked
 *  up on a later attempt), and `resetLabSocket()` clears it outright so a
 *  logout/sign-in can never reuse the previous session's token. */
const TOKEN_CACHE_TTL_MS = 30_000;
let cachedToken: string | null = null;
let cachedTokenAt = 0;
/** Bumped by every `resetLabSocket()`. A storage read started BEFORE an auth
 *  transition can only settle AFTER it (reconnection re-reads once a second, so
 *  that window is open constantly while offline), and it would then write the
 *  signed-out user's token back into the cache that the reset had just cleared —
 *  re-creating the exact leak this module is fixing. Reads therefore only
 *  publish to the cache while the epoch they started in is still current. */
let tokenEpoch = 0;

async function readHandshakeToken(): Promise<string | null> {
  if (cachedToken && Date.now() - cachedTokenAt < TOKEN_CACHE_TTL_MS) return cachedToken;

  const epoch = tokenEpoch;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const token = await Promise.race([
    getSecureItem('auth.accessToken').catch(() => null),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), TOKEN_READ_TIMEOUT_MS);
    }),
  ]);
  if (timer) clearTimeout(timer);

  if (epoch !== tokenEpoch) return null;
  cachedToken = token;
  cachedTokenAt = Date.now();
  return token;
}

/** Lazily create (once) + return the shared chat socket. */
export function getLabSocket(): Socket {
  if (!socket) {
    socket = io(getSocketUrl(), {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      transports: ['websocket'],
      // Callback form, not a static object: socket.io re-invokes this before
      // EVERY connection attempt, so a reconnect after a token refresh (or a
      // re-login) picks up the current token instead of pinning the one that
      // happened to be in storage at app start.
      auth: (cb: (data: { token?: string }) => void) => {
        readHandshakeToken().then((token) => cb(token ? { token } : {}));
      },
    });
    if (__DEV__) {
      socket.on('connect', () => console.log('[chat socket] connected', socket?.id));
      socket.on('disconnect', (r) => console.log('[chat socket] disconnected', r));
      socket.on('connect_error', (e) => console.log('[chat socket] connect_error', e.message));
    }
  }
  return socket;
}

/**
 * Tear the shared socket down and drop the singleton (+ the cached token), so
 * the NEXT `getLabSocket()` opens a fresh connection whose handshake reads the
 * current token. Must run on every auth transition: socket.io only re-runs the
 * `auth` callback on a new connection attempt, so an already-open socket keeps
 * carrying the PREVIOUS user's credentials in its CONNECT packet — which today
 * fakes `[socket-auth] MISMATCH` on the server (the metric the enforcement
 * decision is gated on) and, after enforcement, would silently kill chat until
 * the app was restarted.
 */
export function resetLabSocket(): void {
  tokenEpoch += 1;
  cachedToken = null;
  cachedTokenAt = 0;
  const dead = socket;
  socket = null;
  if (!dead) return;
  // disconnect() first so live subscribers still receive `disconnect` (and can
  // drop their "connected" state) before we strip the listeners.
  dead.disconnect();
  dead.removeAllListeners();
}

/** Identify this user on the socket so the server routes their rooms. Safe to
 *  call repeatedly (e.g. after a reconnect) — the server treats it idempotently. */
export function joinRooms(userId: string | number, role: 'buyer' | 'seller'): void {
  getLabSocket().emit('joinRooms', { user_id: String(userId), role });
}

/**
 * Transport state, in the three states a UI actually has to distinguish.
 *
 * WHY NOT A BOOLEAN: `connected === false` used to mean two completely different
 * things — "the handshake hasn't finished yet" (normal, sub-second, and the
 * handshake blocks on a bounded secure-storage read, see TOKEN_READ_TIMEOUT_MS)
 * and "we have lost the connection". Screens read the boolean and told the user
 * they were OFFLINE during the cold-start window, on a device that was online.
 *
 *   connecting → no connection yet AND nothing has failed. Say "Connecting…",
 *                never "you're offline", and never refuse an action.
 *   connected  → live.
 *   offline    → we OBSERVED a failure (`disconnect`) or a failed attempt
 *                (`connect_error`). Only this state may claim a bad connection.
 *
 * `connect_error` is subscribed for exactly that reason: without it a device in
 * airplane mode sits in `connecting` forever, because `disconnect` never fires
 * for a connection that never opened.
 */
export type SocketStatus = 'connecting' | 'connected' | 'offline';

export function useSocketStatus(): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>(() =>
    getLabSocket().connected ? 'connected' : 'connecting',
  );
  useEffect(() => {
    const s = getLabSocket();
    const onConnect = () => setStatus('connected');
    const onDown = () => setStatus('offline');
    s.on('connect', onConnect);
    s.on('disconnect', onDown);
    s.on('connect_error', onDown);
    // Re-read on mount: the shared socket may have connected before this screen.
    if (s.connected) setStatus('connected');
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDown);
      s.off('connect_error', onDown);
    };
  }, []);
  return status;
}

/** Live connection state for a small "connecting…"/offline affordance.
 *  Prefer `useSocketStatus()` — a bare boolean cannot tell "not yet" from
 *  "lost it", and treating the two the same is how the composer ended up
 *  blaming the user's network during the handshake. */
export function useSocketConnected(): boolean {
  return useSocketStatus() === 'connected';
}
