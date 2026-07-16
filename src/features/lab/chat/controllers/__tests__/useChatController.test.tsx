import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-native';

// PR-4: behavioral characterization of the extracted orchestration (the part the
// frame-replay fold test doesn't cover): send appends a user bubble + opens a
// turn + fires the view scroll hook; a settled turn commits into history; retry
// re-sends; abort cancels the transport.
const mockStart = jest.fn(() => Promise.resolve());
const mockAbort = jest.fn();
jest.mock('@/features/lab/hooks/useLabTurn', () => ({
  useLabTurn: () => ({ start: mockStart, abort: mockAbort }),
}));
jest.mock('@/features/lab/hooks/useBatchProducts', () => ({
  useBatchProducts: () => ({
    jumpTo: jest.fn(), advance: jest.fn(), combine: jest.fn(), split: jest.fn(),
    publishAll: jest.fn(), busy: false,
  }),
}));
jest.mock('@/features/lab/scan/launchSellerScan', () => ({ launchSellerScan: jest.fn() }));
jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));
jest.mock('@/lib/haptics', () => ({ haptics: { impact: jest.fn(), tap: jest.fn(), error: jest.fn() } }));
// sessionStore/composerStore persist through MMKV (a native module) — back it
// with an in-memory fake so the stores hydrate in jest.
jest.mock('@/lib/mmkv', () => {
  const store = new Map<string, string>();
  return {
    mmkv: {
      getString: (k: string) => store.get(k),
      set: (k: string, v: unknown) => store.set(k, String(v)),
      delete: (k: string) => store.delete(k),
      getBoolean: (k: string) => store.get(k) === 'true',
      getNumber: (k: string) => Number(store.get(k) ?? 0),
      contains: (k: string) => store.has(k),
      getAllKeys: () => Array.from(store.keys()),
      clearAll: () => store.clear(),
    },
  };
});

import { useThread } from '@/features/lab/stores/threadStore';
import { useComposer } from '@/features/lab/stores/composerStore';
import { messageText } from '@/features/lab/chat/types/message';
import { useChatController } from '../useChatController';

const flushEffects = async () => {
  // let the settle-commit effect run
  await act(async () => { await Promise.resolve(); });
};

beforeEach(() => {
  mockStart.mockClear();
  mockAbort.mockClear();
  useThread.getState().reset();
  useComposer.getState().clearAttachments?.();
});

describe('useChatController orchestration', () => {
  it('seeds the first user message from initialQuery', () => {
    const { result } = renderHook(() => useChatController({ initialQuery: 'hello world', onDidSend: jest.fn() }));
    expect(result.current.viewMessages).toHaveLength(1);
    expect(result.current.viewMessages[0].role).toBe('user');
    expect(messageText(result.current.viewMessages[0])).toBe('hello world');
  });

  it('send() appends a user bubble, opens a turn, and fires onDidSend', () => {
    const onDidSend = jest.fn();
    const { result } = renderHook(() => useChatController({ initialQuery: '', onDidSend }));
    act(() => result.current.send('find me a lathe'));
    expect(mockStart).toHaveBeenCalledWith('find me a lathe');
    expect(useThread.getState().turn.status).toBe('streaming');
    expect(onDidSend).toHaveBeenCalledTimes(1);
    const msgs = result.current.viewMessages;
    expect(msgs[msgs.length - 1].role).toBe('user');
    expect(messageText(msgs[msgs.length - 1])).toBe('find me a lathe');
  });

  it('an empty send with no attachments is a no-op', () => {
    const onDidSend = jest.fn();
    const { result } = renderHook(() => useChatController({ initialQuery: '', onDidSend }));
    act(() => result.current.send('   '));
    expect(mockStart).not.toHaveBeenCalled();
    expect(onDidSend).not.toHaveBeenCalled();
    expect(result.current.viewMessages).toHaveLength(0);
  });

  it('commits a settled turn into history and resets the thread', async () => {
    const { result } = renderHook(() => useChatController({ initialQuery: '', onDidSend: jest.fn() }));
    act(() => result.current.send('question'));
    act(() => {
      useThread.getState().applyFrame({ type: 'token', delta: 'answer' });
      useThread.getState().applyFrame({ type: 'done', data: {} });
    });
    await flushEffects();
    const msgs = result.current.viewMessages;
    expect(msgs[msgs.length - 1].role).toBe('assistant');
    expect(messageText(msgs[msgs.length - 1])).toBe('answer');
    expect(useThread.getState().turn.status).toBe('idle'); // reset after commit
  });

  it('marks the committed message as justSettledId after a successful settle (D3 handoff)', async () => {
    const { result } = renderHook(() => useChatController({ initialQuery: '', onDidSend: jest.fn() }));
    expect(result.current.justSettledId).toBeNull();
    act(() => result.current.send('question'));
    act(() => {
      useThread.getState().applyFrame({ type: 'token', delta: 'answer' });
      useThread.getState().applyFrame({ type: 'done', data: {} });
    });
    await flushEffects();
    const msgs = result.current.viewMessages;
    const committed = msgs[msgs.length - 1];
    expect(committed.role).toBe('assistant');
    // The view mounts THIS row with no entering animation (seamless swap).
    expect(result.current.justSettledId).toBe(committed.id);
  });

  it('a failed settle keeps justSettledId null (the error bubble keeps its POP)', async () => {
    const { result } = renderHook(() => useChatController({ initialQuery: '', onDidSend: jest.fn() }));
    act(() => result.current.send('question'));
    act(() => useThread.getState().applyFrame({ type: 'error', data: {} }));
    await flushEffects();
    const msgs = result.current.viewMessages;
    expect(msgs[msgs.length - 1].role).toBe('assistant'); // error bubble committed
    expect(result.current.justSettledId).toBeNull();
  });

  it('retry re-sends the given text', () => {
    const { result } = renderHook(() => useChatController({ initialQuery: '', onDidSend: jest.fn() }));
    act(() => result.current.onRetry('try again'));
    expect(mockStart).toHaveBeenCalledWith('try again');
  });

  it('abort cancels the transport', () => {
    const { result } = renderHook(() => useChatController({ initialQuery: '', onDidSend: jest.fn() }));
    act(() => result.current.abort());
    expect(mockAbort).toHaveBeenCalledTimes(1);
  });

  it('stop() aborts the network then commits the partial answer + resets', async () => {
    const { result } = renderHook(() => useChatController({ initialQuery: '', onDidSend: jest.fn() }));
    act(() => result.current.send('question'));
    act(() => useThread.getState().applyFrame({ type: 'token', delta: 'partial' }));
    act(() => result.current.stop());
    expect(mockAbort).toHaveBeenCalledTimes(1);
    await flushEffects();
    const msgs = result.current.viewMessages;
    expect(msgs[msgs.length - 1].role).toBe('assistant');
    expect(messageText(msgs[msgs.length - 1])).toBe('partial'); // kept the partial stream
    expect(useThread.getState().turn.status).toBe('idle'); // reset after commit
  });

  it('stop() on an empty (pre-first-token) turn commits nothing and resets', async () => {
    const { result } = renderHook(() => useChatController({ initialQuery: '', onDidSend: jest.fn() }));
    act(() => result.current.send('question'));
    const before = result.current.viewMessages.length;
    act(() => result.current.stop());
    await flushEffects();
    expect(result.current.viewMessages).toHaveLength(before); // no bot bubble committed
    expect(useThread.getState().turn.status).toBe('idle');
  });

  it('send() while a turn is streaming is a hard no-op (no silent abort-restart)', () => {
    const { result } = renderHook(() => useChatController({ initialQuery: '', onDidSend: jest.fn() }));
    act(() => result.current.send('first'));
    expect(mockStart).toHaveBeenCalledTimes(1);
    const count = result.current.viewMessages.length;
    // A programmatic send (onCardSend/onRetry) mid-stream must not stomp the turn.
    act(() => result.current.send('second while streaming'));
    expect(mockStart).toHaveBeenCalledTimes(1); // still just the first turn
    expect(result.current.viewMessages).toHaveLength(count); // no new user bubble
    expect(useThread.getState().turn.status).toBe('streaming');
  });
});
