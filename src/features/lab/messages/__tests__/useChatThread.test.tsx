/**
 * The send state machine — the part of Messages that can lose a buyer's message
 * or send it to the seller twice, and the part that had zero test cover.
 *
 * Every case below is a real sequence a phone produces (backgrounded app, tunnel,
 * lift doors), and each one used to end badly:
 *
 *   • socket down at send time → socket.io buffered the packet with no expiry and
 *     delivered it minutes later, after the bubble had already given up. Now the
 *     OUTBOX holds it, the bubble says so, and it goes out on reconnect.
 *   • reconnect → the server-side Socket is brand new, so `chat_conversation_<id>`
 *     membership is gone and echoes stop arriving. Now every `connect` re-joins.
 *   • echo lost but the message WAS stored → the bubble flipped to "Not sent" and
 *     tapping retry stored a second row. Now the server is asked, and the bubble
 *     heals with no re-emit.
 *   • two identical bodies in flight → the echo claimed the wrong entry, so the
 *     delivered one was reported as failed. Now a row can only ever settle one
 *     send, and a genuinely unsent message is still re-sent.
 */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// MMKV is a Nitro native module and cannot load under Jest (authStore imports it).
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

// A socket we can disconnect and fire events on, standing in for the shared one.
jest.mock('@/features/lab/messages/socket', () => {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  const socket = {
    connected: true,
    on: (event: string, handler: (...args: unknown[]) => void) => {
      (handlers[event] ??= []).push(handler);
    },
    off: (event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== handler);
    },
    emit: jest.fn(),
    fire: (event: string, ...args: unknown[]) => {
      (handlers[event] ?? []).slice().forEach((h) => h(...args));
    },
  };
  return { getLabSocket: () => socket, joinRooms: jest.fn(), __socket: socket };
});

jest.mock('@/features/lab/messages/chatApi', () => ({
  MOBILE_CHAT_ROLE: 'buyer',
  openConversation: jest.fn(),
  getConversationMessages: jest.fn(),
  sendChatMessage: jest.fn(),
  markConversationRead: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
import {
  getConversationMessages,
  markConversationRead,
  openConversation,
  sendChatMessage,
  type ChatMessageRow,
} from '@/features/lab/messages/chatApi';
import { useAuth } from '@/stores/authStore';
import { useChatThread } from '../useChatThread';

const { __socket: socket } = require('@/features/lab/messages/socket') as {
  __socket: {
    connected: boolean;
    emit: jest.Mock;
    fire: (event: string, ...args: unknown[]) => void;
  };
};

const mockOpen = openConversation as jest.MockedFunction<typeof openConversation>;
const mockMessages = getConversationMessages as jest.MockedFunction<typeof getConversationMessages>;
const mockSend = sendChatMessage as jest.MockedFunction<typeof sendChatMessage>;
const mockRead = markConversationRead as jest.MockedFunction<typeof markConversationRead>;

const ME = 7;
const SELLER = 42;
const BATCH = 100;
const CONVERSATION = 'c1';

/** What the server currently holds for this conversation. Tests push to it. */
let serverRows: ChatMessageRow[] = [];

const serverRow = (messageId: number, message: string, senderId = ME): ChatMessageRow => ({
  message_id: messageId,
  conversation_id: CONVERSATION,
  sender_id: senderId,
  message,
  created_at: '2026-08-17T10:00:00Z',
});

let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client }, children);

const renderThread = () =>
  renderHook(() => useChatThread({ batchId: BATCH, otherPartyId: SELLER }), { wrapper });

/** Mounted, joined, history loaded — the state every case below starts from. */
async function openThread() {
  const hook = renderThread();
  await waitFor(() => expect(hook.result.current.canSend).toBe(true));
  return hook;
}

const bubbles = (messages: { text: string; status: string }[], text: string) =>
  messages.filter((m) => m.text === text);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  serverRows = [];
  socket.connected = true;
  useAuth
    .getState()
    .setProfile({ id: ME, email: 'a@b.com', name: 'A', role: 'buyer', company: null });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  // joinChat only resolves on a live socket — a bare emit with an ack never
  // settles while disconnected, which is why the real one carries a timeout.
  mockOpen.mockImplementation(async () => {
    if (!socket.connected) throw new Error('joinChat timed out');
    return CONVERSATION;
  });
  mockMessages.mockImplementation(async () => ({ messages: [...serverRows], hasMore: false }));
  // Mirrors the real emitter's contract: nothing leaves a disconnected socket.
  mockSend.mockImplementation(() => socket.connected);
  mockRead.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
  client.clear();
  useAuth.getState().reset();
});

describe('useChatThread — sending while the connection comes and goes', () => {
  it('queues a message sent while the socket is down and delivers it on reconnect', async () => {
    const { result } = await openThread();

    socket.connected = false;
    act(() => socket.fire('disconnect'));

    // Accepted, not refused: the composer may clear the input.
    act(() => {
      expect(result.current.send('Is it still available?')).toBe(true);
    });
    expect(mockSend).not.toHaveBeenCalled();
    expect(result.current.messages.at(-1)).toMatchObject({
      text: 'Is it still available?',
      status: 'queued',
    });

    socket.connected = true;
    await act(async () => {
      socket.fire('connect');
      await jest.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
    expect(result.current.messages.at(-1)!.status).toBe('pending');
  });

  it('re-joins the conversation room on every reconnect (the room is lost with the old socket)', async () => {
    await openThread();
    expect(mockOpen).toHaveBeenCalledTimes(1);

    await act(async () => {
      socket.fire('connect');
      await jest.advanceTimersByTimeAsync(0);
    });

    // A second joinChat — without it the server never broadcasts to this socket
    // again: no echoes, and none of the seller's replies.
    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(2));
    // …and the thread is re-read, so anything sent while we were away is merged.
    expect(mockMessages).toHaveBeenCalledTimes(2);
  });

  it('heals a bubble whose echo was lost — the server has the row, so nothing fails and nothing re-sends', async () => {
    const { result } = await openThread();

    act(() => {
      result.current.send('ok');
    });
    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));

    // Stored server-side; the echo never arrives because the room was lost.
    serverRows.push(serverRow(5, 'ok'));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });

    await waitFor(() => expect(bubbles(result.current.messages, 'ok')).toHaveLength(1));
    expect(result.current.messages.at(-1)!.status).toBe('sent');
    expect(mockSend).toHaveBeenCalledTimes(1); // never emitted twice
  });

  it('marks a message failed only when the server proves it does not have it', async () => {
    const { result } = await openThread();

    act(() => {
      result.current.send('ok');
    });
    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });

    await waitFor(() => expect(result.current.messages.at(-1)!.status).toBe('failed'));
    // The text is still on screen — it is never silently dropped.
    expect(result.current.messages.at(-1)!.text).toBe('ok');

    const pendingId = result.current.messages.at(-1)!.pendingId!;
    await act(async () => {
      result.current.retrySend(pendingId);
      await jest.advanceTimersByTimeAsync(0);
    });

    // Still absent server-side, so re-sending is the right move — exactly once.
    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(2));
    expect(bubbles(result.current.messages, 'ok')).toHaveLength(1);
  });

  it('a retry cannot create a second server row: it verifies before it re-emits', async () => {
    const { result } = await openThread();

    act(() => {
      result.current.send('ok');
    });
    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    await waitFor(() => expect(result.current.messages.at(-1)!.status).toBe('failed'));

    // It had been delivered all along (the echo, not the message, was lost).
    serverRows.push(serverRow(9, 'ok'));

    const pendingId = result.current.messages.at(-1)!.pendingId!;
    await act(async () => {
      result.current.retrySend(pendingId);
      await jest.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => expect(result.current.messages.at(-1)!.status).toBe('sent'));
    expect(bubbles(result.current.messages, 'ok')).toHaveLength(1);
    expect(mockSend).toHaveBeenCalledTimes(1); // the seller is NOT messaged twice
  });

  it('renders a message once even if the same row arrives twice', async () => {
    const { result } = await openThread();

    act(() => socket.fire('chat_message', serverRow(12, 'hello', SELLER)));
    act(() => socket.fire('chat_message', serverRow(12, 'hello', SELLER)));

    expect(bubbles(result.current.messages, 'hello')).toHaveLength(1);
  });

  it('with two identical bodies in flight, one server row settles one send', async () => {
    const { result } = await openThread();

    // First "ok" is emitted and lost (no echo, and the server does not have it).
    act(() => {
      result.current.send('ok');
    });
    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    await waitFor(() => expect(result.current.messages.at(-1)!.status).toBe('failed'));
    const failedId = result.current.messages.at(-1)!.pendingId!;

    // The impatient user types it again; THIS one is delivered and echoed.
    act(() => {
      result.current.send('ok');
    });
    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(2));
    serverRows.push(serverRow(21, 'ok'));
    act(() => socket.fire('chat_message', serverRow(21, 'ok')));

    // The echo settles the SECOND send (the one that was actually in flight), and
    // the first is still shown as failed rather than silently healed by a row that
    // was never its own.
    await waitFor(() => {
      const ok = bubbles(result.current.messages, 'ok');
      expect(ok).toHaveLength(2);
      expect(ok.map((m) => m.status).sort()).toEqual(['failed', 'sent']);
    });

    // Retrying the failed one therefore still sends it — the delivered row is
    // already spoken for and cannot be double-claimed.
    await act(async () => {
      result.current.retrySend(failedId);
      await jest.advanceTimersByTimeAsync(0);
    });
    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(3));
  });
});
