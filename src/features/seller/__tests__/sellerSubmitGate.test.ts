/**
 * `canSubmitListing()` in the CUSTOMER fork — the predicate both submit choke
 * points read before a listing may reach the backend.
 *
 * It must fail CLOSED on everything that is not literally `approved`, including a
 * cold cache: the honest answer to "may this user publish?" before the status has
 * ever been fetched is "ask", not "yes".
 *
 * The seller fork's escape hatch is a SEPARATE file — `IS_CUSTOMER` is a
 * module-scope const, so one mock per file means one fork per file.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
jest.mock('@/lib/flags', () => ({
  ...(jest.requireActual('@/lib/flags') as typeof import('@/lib/flags')),
  IS_CUSTOMER: true,
}));
jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { get: jest.fn(), post: jest.fn() },
}));

import { router } from 'expo-router';

import { canSubmitListing, redirectToSellerApplication } from '../sellerSubmitGate';
import { SELLER_UPGRADE_KEY } from '@/features/seller/useSellerUpgrade';
import { queryClient } from '@/lib/queryClient';

const push = router.push as unknown as jest.Mock;

const row = (status: string) => ({
  status,
  company_name: 'Acme',
  admin_notes: null,
  reviewed_at: null,
});

beforeEach(() => {
  push.mockReset();
  queryClient.clear();
});
afterEach(() => queryClient.clear());

describe('canSubmitListing — customer fork', () => {
  it('allows an approved seller', () => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, row('approved'));
    expect(canSubmitListing()).toBe(true);
  });

  it('allows an EXISTING seller, who has no application row', () => {
    // The backend synthesises this from `greenbidz_user_type` meta for the 245
    // sellers who predate the upgrade flow (see the backend's
    // getUserUpgradeStatus). The extra `source` field must not disturb the read.
    queryClient.setQueryData(SELLER_UPGRADE_KEY, {
      ...row('approved'),
      source: 'existing_seller',
    });
    expect(canSubmitListing()).toBe(true);
  });

  it.each([
    ['pending', row('pending')],
    ['rejected', row('rejected')],
    ['no application', null],
    ['an unrecognised status', row('APPROVED_PENDING_REVIEW')],
  ])('blocks %s', (_label, cached) => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, cached);
    expect(canSubmitListing()).toBe(false);
  });

  it('blocks a cold cache rather than guessing', () => {
    expect(canSubmitListing()).toBe(false);
  });
});

describe('redirectToSellerApplication', () => {
  it('pushes the application screen', () => {
    redirectToSellerApplication();
    expect(push).toHaveBeenCalledWith('/(lab)/sell/apply');
  });

  it('pushes rather than replaces, so back returns to the draft', () => {
    redirectToSellerApplication();
    expect(router.replace as unknown as jest.Mock).not.toHaveBeenCalled();
  });

  it('marks the status stale so that screen renders the server’s answer', () => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, row('pending'));
    redirectToSellerApplication();
    expect(queryClient.getQueryState(SELLER_UPGRADE_KEY)?.isInvalidated).toBe(true);
  });
});
