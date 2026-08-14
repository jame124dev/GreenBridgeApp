/**
 * Authoring is OPEN. `launchSellerScan()` must let anyone signed in into the
 * scan flow, and the same is true of resuming a saved draft
 * (`resumeDraftUngated.test.ts`).
 *
 * This file replaces `launchSellerScan.gate.test.ts`, which asserted the opposite
 * — approval required to ENTER. That policy sent a user to a company-details form
 * before they had seen the AI do anything, so the gate moved to the two SUBMIT
 * choke points (`submitGateTopology.test.ts`). What is pinned here is the new
 * contract plus the regression: a check reintroduced at the entry point fails.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
// ⚠️ JEST DOES NOT LOAD `.env`, so `IS_CUSTOMER` is `false` in this process while
// every shipped profile sets `EXPO_PUBLIC_USER_TYPE: "customer"`. Forced true so
// these tests exercise the customer fork — the one that is actually shipped.
jest.mock('@/lib/flags', () => ({
  ...(jest.requireActual('@/lib/flags') as typeof import('@/lib/flags')),
  IS_CUSTOMER: true,
}));
jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('@/stores/scanDraftStore', () => {
  const reset = jest.fn();
  return { useScanDraft: { getState: () => ({ reset }) } };
});

import { router } from 'expo-router';

import { launchSellerScan } from '../launchSellerScan';
import { SELLER_UPGRADE_KEY } from '@/features/seller/useSellerUpgrade';
import { queryClient } from '@/lib/queryClient';
import { useScanDraft } from '@/stores/scanDraftStore';

const push = router.push as unknown as jest.Mock;
const draftReset = () => (useScanDraft.getState() as unknown as { reset: jest.Mock }).reset;
const APPLY_ROUTE = '/(lab)/sell/apply';

const row = (status: string) => ({
  status,
  company_name: 'Acme',
  admin_notes: null,
  reviewed_at: null,
});

beforeEach(() => {
  push.mockReset();
  draftReset().mockReset();
  queryClient.clear();
});

afterEach(() => {
  // `setQueryData` on an unobserved query arms a 5-minute GC timer on the shared
  // client; without `clear()` Jest reports "did not exit one second after the
  // test run had completed".
  queryClient.clear();
});

describe('launchSellerScan — authoring is open to everyone', () => {
  // Each of these WAS a redirect to the application form before the policy moved.
  it.each([
    ['no application on file', null],
    ['a pending application', row('pending')],
    ['a rejected application', row('rejected')],
    ['an unrecognised status', row('APPROVED_PENDING_REVIEW')],
  ])('opens the scan flow with %s', (_label, cached) => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, cached);
    launchSellerScan();
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/scan/'));
    expect(push).not.toHaveBeenCalledWith(APPLY_ROUTE);
  });

  it('opens the scan flow when the status has never been fetched', () => {
    // No setQueryData at all — a cold cache used to fail closed here.
    launchSellerScan();
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/scan/'));
  });

  it('opens the scan flow for an approved seller', () => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, row('approved'));
    launchSellerScan();
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/scan/'));
  });

  it('flushes the previous scan draft so the flow starts clean', () => {
    launchSellerScan();
    expect(draftReset()).toHaveBeenCalledTimes(1);
  });

  it('navigates exactly once per call', () => {
    launchSellerScan();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('never marks the seller status stale — it does not read it', () => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, row('pending'));
    launchSellerScan();
    expect(queryClient.getQueryState(SELLER_UPGRADE_KEY)?.isInvalidated).toBe(false);
  });
});

// ── Regression: the gate must not creep back to the entry point ──────────────
const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');

describe('the entry point stays ungated', () => {
  it('launchSellerScan.ts reads no approval state', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/features/lab/scan/launchSellerScan.ts'),
      'utf8',
    );
    // Comments in that file DO name the gate (to say where it lives now), so
    // assert on the code only.
    const code = src
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');
    for (const needle of [
      'canSubmitListing',
      'useCanSell',
      'SELLER_UPGRADE_KEY',
      'redirectToSellerApplication',
    ]) {
      expect(code).not.toContain(needle);
    }
  });
});
