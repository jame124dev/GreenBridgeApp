/**
 * The seller fork must not be caught by the customer-fork submit gate.
 *
 * Both submit paths are shared between forks. A status-only predicate would fail
 * CLOSED for every seller-fork user, because that fork never fetches
 * `/seller-upgrade/my-status` (`SellerGatePrewarm` is mounted only in
 * `app/(lab)/_layout.tsx`), and would then push them at `/(lab)/sell/apply` — a
 * route the seller fork does not mount. Result: nobody in the seller build could
 * publish anything.
 *
 * That break would be INVISIBLE in CI and in every current build: jest reports
 * `IS_CUSTOMER === false` (it does not load `.env`), while all three eas.json
 * profiles ship `EXPO_PUBLIC_USER_TYPE: "customer"`. So the seller fork is both
 * the configuration the tests run under and the one nobody ships — the worst
 * combination for noticing. Hence this file, which pins the escape hatch instead
 * of relying on ambient env.
 *
 * NOTE: no `@/lib/flags` mock here, deliberately — the real module under jest
 * yields the seller fork.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { get: jest.fn(), post: jest.fn() },
}));

import { canSubmitListing } from '../sellerSubmitGate';
import { IS_CUSTOMER } from '@/lib/flags';
import { SELLER_UPGRADE_KEY } from '@/features/seller/useSellerUpgrade';
import { queryClient } from '@/lib/queryClient';

beforeEach(() => queryClient.clear());
afterEach(() => queryClient.clear());

describe('canSubmitListing — seller fork', () => {
  it('confirms the premise: this process IS the seller fork', () => {
    // If this ever flips, the escape hatch below stops being tested and the
    // assertions silently become a duplicate of the customer-fork suite.
    expect(IS_CUSTOMER).toBe(false);
  });

  it('allows publishing with an EMPTY cache — the fork never fetches status', () => {
    expect(canSubmitListing()).toBe(true);
  });

  it('allows publishing even when the cache says pending', () => {
    // Belt and braces: the fork check short-circuits BEFORE the status read, so a
    // stray cache entry cannot lock a seller-fork user out.
    queryClient.setQueryData(SELLER_UPGRADE_KEY, {
      status: 'pending',
      company_name: null,
      admin_notes: null,
      reviewed_at: null,
    });
    expect(canSubmitListing()).toBe(true);
  });
});
