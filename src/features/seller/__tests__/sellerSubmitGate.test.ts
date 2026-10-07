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
import { ONBOARDING_DETAILS_KEY } from '@/features/seller/useSellerStatus';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/stores/authStore';

/**
 * The onboarding row as the SERVER returns it.
 *
 * ⚠️ `sellerType: null` is what a seller with NO ROW AT ALL gets — the
 * controller answers a full default object rather than 404 (origin/dev
 * `authV3.controller.js:1520`). That is the legacy population, and it is
 * byte-identical to "started the wizard and quit" if you only read
 * `onboardingCompleted`.
 */
const obRow = (over: Partial<Record<string, unknown>> = {}) => ({
  sellerType: null,
  monthlyVolume: null,
  onboardingCompleted: false,
  website: null,
  bizRole: null,
  bizPhone: null,
  calibration: null,
  ...over,
});

const push = router.push as unknown as jest.Mock;

const row = (status: string) => ({
  status,
  company_name: 'Acme',
  admin_notes: null,
  reviewed_at: null,
});

/** The shape the server sends when NO ONE reviewed anything — see the type. */
const derivedRow = (status = 'approved') => ({ ...row(status), source: 'existing_seller' });

beforeEach(() => {
  push.mockReset();
  queryClient.clear();
  useAuth.setState({ isPending: false });
});
afterEach(() => {
  queryClient.clear();
  useAuth.setState({ isPending: false });
});

describe('canSubmitListing — customer fork', () => {
  it('allows an approved seller', () => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, row('approved'));
    expect(canSubmitListing()).toBe(true);
  });

  it('allows an EXISTING seller, who has no application row', () => {
    // The backend synthesises this from `greenbidz_user_type` meta for the
    // sellers who predate the upgrade flow (see the backend's
    // getUserUpgradeStatus). Their session is not pending, so they still pass.
    queryClient.setQueryData(SELLER_UPGRADE_KEY, derivedRow());
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

/**
 * The hole the v2 onboarding opened.
 *
 * `signup-with-link-v2` writes `greenbidz_user_type = 'seller'` and
 * `pw_user_status = 'pending'` in ONE insert, and the backend's
 * `getUserUpgradeStatus` derives `approved` from the first of those without
 * ever reading the second. So the moment a v2 seller account exists, the sell
 * gate's only input says "approved" for an account no human has reviewed.
 *
 * The distinguishing fact is `source`: a REVIEWED row is an admin's decision
 * and stands on its own; a DERIVED one is an inference, and an inference must
 * not outrank "this account is still awaiting approval".
 */
describe('canSubmitListing — a DERIVED approval on a pending account', () => {
  it('blocks a v2 seller whose account is still awaiting approval', () => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, derivedRow());
    useAuth.setState({ isPending: true });
    expect(canSubmitListing()).toBe(false);
  });

  it('still allows a REVIEWED approval while the account is pending', () => {
    // An admin approving the upgrade does not necessarily flip `pw_user_status`.
    // Blocking this case would lock out every properly approved seller, which is
    // why the pending check is scoped to the derived branch alone.
    queryClient.setQueryData(SELLER_UPGRADE_KEY, row('approved'));
    useAuth.setState({ isPending: true });
    expect(canSubmitListing()).toBe(true);
  });

  it('allows the same derived seller once the account is no longer pending', () => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, derivedRow());
    useAuth.setState({ isPending: true });
    expect(canSubmitListing()).toBe(false);
    useAuth.setState({ isPending: false });
    expect(canSubmitListing()).toBe(true);
  });

  it.each([
    ['pending', 'pending'],
    ['rejected', 'rejected'],
  ])('a derived row that is %s is blocked whatever the session says', (_l, s) => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, derivedRow(s));
    useAuth.setState({ isPending: false });
    expect(canSubmitListing()).toBe(false);
  });
});

/**
 * The empty-profile case, and the much larger population it must not touch.
 *
 * The web stops a half-onboarded seller with `SellerOnboardingGuard`. Mobile
 * had nothing, so an approved account with no company, tax id or address could
 * publish. Closing that is easy; closing it WITHOUT blocking every seller who
 * predates the wizard is the actual work, and it is what these cases pin.
 */
describe('canSubmitListing — an unfinished seller profile', () => {
  beforeEach(() => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, row('approved'));
  });

  it('blocks an approved seller who started the wizard and did not finish', () => {
    queryClient.setQueryData(ONBOARDING_DETAILS_KEY, obRow({ sellerType: 'reseller' }));
    expect(canSubmitListing()).toBe(false);
  });

  it('allows them once the wizard is finished', () => {
    queryClient.setQueryData(
      ONBOARDING_DETAILS_KEY,
      obRow({ sellerType: 'reseller', onboardingCompleted: true }),
    );
    expect(canSubmitListing()).toBe(true);
  });

  it('⚠️ does NOT block a legacy seller, who has no row at all', () => {
    // The regression this whole design is shaped around. `sellerType: null`
    // plus `onboardingCompleted: false` IS the no-row answer; reading the flag
    // alone would lock out every existing approved seller on the platform.
    queryClient.setQueryData(ONBOARDING_DETAILS_KEY, obRow());
    expect(canSubmitListing()).toBe(true);
  });

  it('fails OPEN on a cold cache, unlike the rest of the predicate', () => {
    // Inverted deliberately: "we have not asked yet" must not read as "your
    // profile is empty", because that lands on the legacy population again.
    queryClient.removeQueries({ queryKey: ONBOARDING_DETAILS_KEY });
    expect(canSubmitListing()).toBe(true);
  });

  it('still defers to approval — an unfinished profile cannot un-block a pending account', () => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, row('pending'));
    queryClient.setQueryData(
      ONBOARDING_DETAILS_KEY,
      obRow({ sellerType: 'reseller', onboardingCompleted: true }),
    );
    expect(canSubmitListing()).toBe(false);
  });
});

describe('redirectToSellerApplication', () => {
  it('pushes the application screen', () => {
    redirectToSellerApplication();
    expect(push).toHaveBeenCalledWith('/(lab)/sell/apply');
  });

  it('pushes the WIZARD instead when the onboarding is the unfinished thing', () => {
    // Someone who already applied does not need a form about applying.
    queryClient.setQueryData(ONBOARDING_DETAILS_KEY, obRow({ sellerType: 'company' }));
    redirectToSellerApplication();
    expect(push).toHaveBeenCalledWith('/(auth)/onboarding-mock');
  });

  it('still pushes the application screen for a legacy seller', () => {
    queryClient.setQueryData(ONBOARDING_DETAILS_KEY, obRow());
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
