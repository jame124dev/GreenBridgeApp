/**
 * A dead session must end the session, whichever status code says so.
 *
 * The drafts router answers "no valid credentials" with **403**, not 401, so
 * the response interceptor used to ignore it. Observed on a real device
 * 2026-09-21: Home kept rendering a signed-in shell off a profile whose token
 * was gone, showing "your drafts did not load" forever — "Try again" re-sent
 * the same dead token every time.
 *
 * The scoping is the risky part and is what most of this file tests. A 403
 * normally means authenticated-but-not-allowed; logging someone out for one of
 * those would be a worse bug than the one being fixed.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * `mock`-prefixed on purpose. `jest.mock` factories are hoisted above the
 * imports, so they may not close over an ordinary outer variable — jest rejects
 * it with "not allowed to reference any out-of-scope variables" and allows only
 * names beginning with `mock`.
 */
const mockLogout = jest.fn(async () => {});
jest.mock('@/services/auth/logout', () => ({ logout: () => mockLogout() }));
jest.mock('@/lib/secureStorage', () => ({
  getSecureItem: jest.fn(async () => null),
  deleteSecureItem: jest.fn(async () => {}),
}));

import { attachGreenbidzInterceptors, setUnauthorizedHandler } from '../interceptors';

type Rejector = (error: unknown) => Promise<unknown>;

/**
 * Capture the rejection handler the module installs, without axios. The
 * interceptor is a plain function of the error; a real client would add HTTP
 * plumbing and test nothing extra.
 */
function install(): { reject: Rejector; onUnauthorized: jest.Mock } {
  let reject!: Rejector;
  const client = {
    interceptors: {
      request: { use: () => {} },
      response: {
        use: (_ok: unknown, err: Rejector) => {
          reject = err;
        },
      },
    },
  };
  attachGreenbidzInterceptors(client as never);

  const onUnauthorized = jest.fn();
  setUnauthorizedHandler(onUnauthorized as () => void);
  return { reject, onUnauthorized };
}

const fail = (status: number, url: string) => ({ response: { status }, config: { url } });

async function run(status: number, url: string) {
  const { reject, onUnauthorized } = install();
  await reject(fail(status, url)).catch(() => {});
  return { loggedOut: mockLogout.mock.calls.length > 0, onUnauthorized };
}

beforeEach(() => {
  mockLogout.mockClear();
});

describe('a dead session ends the session', () => {
  it('401 anywhere still signs out — unchanged behaviour', async () => {
    expect((await run(401, '/wp/some-route')).loggedOut).toBe(true);
  });

  it('403 from /drafts signs out — the bug this fixes', async () => {
    expect((await run(403, '/drafts')).loggedOut).toBe(true);
  });

  it('403 from a nested drafts route signs out too', async () => {
    expect((await run(403, '/drafts/247/items?filter=all')).loggedOut).toBe(true);
  });
});

describe('and nothing else does', () => {
  /**
   * The whole reason the clause is scoped. A 403 here means the seller may not
   * do this thing — not that they are signed out.
   */
  it('403 from another route does NOT sign out', async () => {
    expect((await run(403, '/wp/create-grouped-listings')).loggedOut).toBe(false);
  });

  /**
   * A route merely CONTAINING the word must not match — `/drafts` is a path
   * segment, not a substring. Without the boundary, a future
   * `/admin/no-drafts-allowed` would start signing people out.
   */
  it('403 from a route that only mentions drafts does NOT sign out', async () => {
    expect((await run(403, '/wp/drafts-report')).loggedOut).toBe(false);
  });

  it('a 404 on /drafts does NOT sign out', async () => {
    expect((await run(404, '/drafts')).loggedOut).toBe(false);
  });

  it('a 500 on /drafts does NOT sign out', async () => {
    expect((await run(500, '/drafts')).loggedOut).toBe(false);
  });

  /** Signing out mid-login would fight the login itself. */
  it('401 from the login route does NOT sign out', async () => {
    expect((await run(401, '/auth/login')).loggedOut).toBe(false);
  });
});
