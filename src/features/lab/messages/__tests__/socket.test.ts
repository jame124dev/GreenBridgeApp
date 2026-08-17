/**
 * Chat socket handshake lifecycle. The socket is a module-level singleton whose
 * `auth` callback socket.io only re-runs on a NEW connection attempt, so these
 * tests pin the two things that can go wrong around it:
 *   • an auth transition (logout / sign-in) must produce a socket that
 *     handshakes with the NEW token — otherwise the server sees the previous
 *     user's token (fake `[socket-auth] MISMATCH`) and, once enforcement is on,
 *     chat dies until the app restarts;
 *   • a secure-storage read that never settles must not hold the CONNECT packet
 *     forever (the transport stays open, so nothing would ever reconnect).
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

type AuthOptions = { auth: (cb: (data: { token?: string }) => void) => void };
type FakeSocket = {
  opts: AuthOptions;
  on: jest.Mock;
  off: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
  removeAllListeners: jest.Mock;
};

/** Every socket the module asked socket.io to create, in order. */
const mockCreated: FakeSocket[] = [];

jest.mock('socket.io-client', () => ({
  __esModule: true,
  io: (_url: string, opts: AuthOptions) => {
    const s: FakeSocket = {
      opts,
      connected: false,
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      removeAllListeners: jest.fn(),
    } as unknown as FakeSocket;
    mockCreated.push(s);
    return s;
  },
}));

/** Swappable stand-in for the native secure-storage read. */
let mockReadToken: () => Promise<string | null> = async () => null;

jest.mock('@/lib/secureStorage', () => ({
  __esModule: true,
  getSecureItem: jest.fn(() => mockReadToken()),
  setSecureItem: jest.fn(async () => undefined),
  deleteSecureItem: jest.fn(async () => undefined),
}));
jest.mock('@/lib/env', () => ({
  __esModule: true,
  getSocketUrl: () => 'https://chat.test',
  getAuthConfigError: () => null,
}));
jest.mock('@/lib/mmkv', () => ({ __esModule: true, mmkv: { set: jest.fn(), remove: jest.fn(), getString: jest.fn() } }));
jest.mock('@/lib/marketplaceWebView', () => ({ __esModule: true, clearMarketplaceWebAuth: jest.fn() }));

/* login.ts's collaborators — only needed by the `recheckApproval` case below,
   which is the one token rotation that happens with no logout in between. */
let mockPost: (url: string, body?: unknown) => Promise<unknown> = async () => ({ data: {} });
jest.mock('@/api/greenbidzClient', () => ({
  __esModule: true,
  greenbidz: { post: (url: string, body?: unknown) => mockPost(url, body) },
}));
jest.mock('@/lib/flags', () => ({ __esModule: true, IS_CUSTOMER: true }));
jest.mock('@/stores/authStore', () => ({
  __esModule: true,
  useAuth: { getState: () => ({ setProfile: jest.fn(), setPending: jest.fn() }) },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const load = () => require('../socket');

/** Run the handshake callback socket.io would run before a connection attempt. */
const handshake = (s: FakeSocket) => new Promise<{ token?: string }>((resolve) => s.opts.auth(resolve));

beforeEach(() => {
  mockCreated.length = 0;
  jest.resetModules();
  mockReadToken = async () => 'token-user-A';
});

afterEach(() => {
  jest.useRealTimers();
});

describe('lab chat socket handshake', () => {
  it('sends the stored access token in the handshake', async () => {
    load().getLabSocket();
    await expect(handshake(mockCreated[0])).resolves.toEqual({ token: 'token-user-A' });
  });

  it('connects anonymously when no token is stored', async () => {
    mockReadToken = async () => null;
    load().getLabSocket();
    await expect(handshake(mockCreated[0])).resolves.toEqual({});
  });

  it('connects anonymously when the storage read rejects', async () => {
    mockReadToken = async () => {
      throw new Error('keychain unavailable');
    };
    load().getLabSocket();
    await expect(handshake(mockCreated[0])).resolves.toEqual({});
  });
});

describe('resetLabSocket', () => {
  it('after a reset the next connection handshakes with the NEW token', async () => {
    const { getLabSocket, resetLabSocket } = load();
    const first = getLabSocket();
    await expect(handshake(mockCreated[0])).resolves.toEqual({ token: 'token-user-A' });

    // account switch: storage now holds the second user's token
    mockReadToken = async () => 'token-user-B';
    resetLabSocket();

    const second = getLabSocket();
    expect(mockCreated[0].disconnect).toHaveBeenCalled();
    expect(second).not.toBe(first);
    expect(mockCreated).toHaveLength(2);
    await expect(handshake(mockCreated[1])).resolves.toEqual({ token: 'token-user-B' });
  });

  it('does not carry a cached token past a logout that cleared it', async () => {
    const { getLabSocket, resetLabSocket } = load();
    getLabSocket();
    await handshake(mockCreated[0]);

    mockReadToken = async () => null; // logout deleted auth.accessToken
    resetLabSocket();
    getLabSocket();

    await expect(handshake(mockCreated[1])).resolves.toEqual({});
  });

  it('does not re-cache a token read that was still in flight when the reset happened', async () => {
    const { getLabSocket, resetLabSocket } = load();
    let release: ((v: string | null) => void) | undefined;
    mockReadToken = () => new Promise<string | null>((r) => { release = r; });
    getLabSocket();

    // A reconnect attempt is mid-read of secure storage (reconnection is 1s /
    // Infinity, so this window is open once a second while offline)…
    const inFlight = handshake(mockCreated[0]);
    // …and the user logs out while it is outstanding.
    resetLabSocket();
    // The read now settles with the token that was STILL in storage.
    release!('token-user-A');
    await inFlight;

    // The next socket must not be handed that token out of the cache.
    mockReadToken = async () => null;
    getLabSocket();
    await expect(handshake(mockCreated[1])).resolves.toEqual({});
  });

  it('is a no-op when no socket was ever created', () => {
    const { resetLabSocket } = load();
    expect(() => resetLabSocket()).not.toThrow();
    expect(mockCreated).toHaveLength(0);
  });

  it('reuses the in-memory token across reconnect attempts instead of re-reading storage', async () => {
    const reads = jest.fn(async () => 'token-user-A');
    mockReadToken = reads;
    load().getLabSocket();
    await handshake(mockCreated[0]);
    await handshake(mockCreated[0]);
    await handshake(mockCreated[0]);
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('re-reads storage once the cache TTL has elapsed', async () => {
    jest.useFakeTimers();
    const reads = jest.fn(async () => 'token-user-A');
    mockReadToken = reads;
    load().getLabSocket();
    await handshake(mockCreated[0]);
    // The TTL is what keeps the callback's purpose alive: a token rotated by any
    // future path that does NOT call resetLabSocket() must still be picked up.
    await jest.advanceTimersByTimeAsync(31_000);
    await handshake(mockCreated[0]);
    expect(reads).toHaveBeenCalledTimes(2);
  });
});

describe('handshake cannot hang', () => {
  it('connects tokenless when the secure-storage read never settles', async () => {
    jest.useFakeTimers();
    mockReadToken = () => new Promise<string | null>(() => {}); // never settles
    load().getLabSocket();

    let sent: { token?: string } | 'pending' = 'pending';
    mockCreated[0].opts.auth((data) => {
      sent = data;
    });
    // socket.io holds the CONNECT packet while the callback is outstanding…
    await jest.advanceTimersByTimeAsync(1000);
    expect(sent).toBe('pending');
    // …and the timeout releases it rather than hanging forever.
    await jest.advanceTimersByTimeAsync(1500);
    expect(sent).toEqual({});
  });
});

describe('logout wiring', () => {
  it('logout() tears the socket down so the next sign-in reconnects fresh', async () => {
    const { getLabSocket } = load();
    getLabSocket();
    await handshake(mockCreated[0]);

    const { logout } = require('@/services/auth/logout');
    await logout();

    expect(mockCreated[0].disconnect).toHaveBeenCalled();

    mockReadToken = async () => 'token-user-B';
    getLabSocket();
    expect(mockCreated).toHaveLength(2);
    await expect(handshake(mockCreated[1])).resolves.toEqual({ token: 'token-user-B' });
  });

  it('the pending → approved recheck rotates the handshake token with no logout', async () => {
    const { getLabSocket } = load();
    getLabSocket();
    await handshake(mockCreated[0]);

    // recheckApproval() → finalizeAuthSuccess() → persist() writes a NEW access
    // token without any logout(), so persist() is the only thing that can retire
    // the socket carrying the pending token.
    mockPost = async () => ({
      data: {
        data: {
          data: { user: { id: 7, email: 'a@b.co', name: 'A', role: 'seller' } },
          token: 'token-user-A-approved',
          refreshToken: 'refresh-2',
        },
      },
    });
    const { recheckApproval } = require('@/services/auth/login');
    await recheckApproval();

    expect(mockCreated[0].disconnect).toHaveBeenCalled();

    mockReadToken = async () => 'token-user-A-approved';
    getLabSocket();
    expect(mockCreated).toHaveLength(2);
    await expect(handshake(mockCreated[1])).resolves.toEqual({ token: 'token-user-A-approved' });
  });
});
