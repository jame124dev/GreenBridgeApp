/**
 * The seller fork must not be caught by the customer-fork sell gate.
 *
 * `resumeDraftById` is shared between both forks (`app/scan/drafts.tsx` is one
 * screen serving both). A status-only predicate would have failed CLOSED for every
 * seller-fork user, because that fork never fetches `/seller-upgrade/my-status` —
 * `SellerGatePrewarm` is mounted only in `app/(lab)/_layout.tsx` — and it would
 * then have pushed them at `/(lab)/sell/apply`, a route the seller fork does not
 * mount. Result: nobody in the seller build could ever open a saved draft.
 *
 * That break would have been INVISIBLE in CI and in every current build: jest
 * reports `IS_CUSTOMER === false` (it does not load `.env`), and all three
 * eas.json profiles ship `EXPO_PUBLIC_USER_TYPE: "customer"`. So the seller fork
 * is simultaneously the configuration the tests run under and the one nobody
 * ships — the worst combination for noticing. Hence this file, which pins the
 * escape hatch explicitly rather than relying on ambient env.
 *
 * A separate file from the customer-fork suites because `IS_CUSTOMER` is a
 * module-scope const: the mock is per-file, so the two forks need two files.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
jest.mock('sonner-native', () => ({
  toast: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn(), info: jest.fn() }),
}));
jest.mock('@/lib/haptics', () => ({
  haptics: { tap: jest.fn(), error: jest.fn(), success: jest.fn(), warning: jest.fn() },
}));
// The seller fork — the value jest would pick up anyway, stated explicitly so the
// intent of this file cannot be misread as an accident of the environment.
jest.mock('@/lib/flags', () => ({
  ...(jest.requireActual('@/lib/flags') as typeof import('@/lib/flags')),
  IS_CUSTOMER: false,
}));
jest.mock('@/api/greenbidzClient', () => ({ greenbidz: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/services/drafts/draftApi', () => ({ getDraft: jest.fn() }));
jest.mock('@/services/drafts/draftPayload', () => ({ hydrateScanDraftFromPayload: jest.fn() }));
jest.mock('@/services/drafts/pendingAiResume', () => ({ mapPendingAiDraft: jest.fn() }));
jest.mock('@/services/scanner/buildFormData', () => ({ getSiteType: () => 'LabGreenbidz' }));
jest.mock('@/stores/scanDraftStore', () => ({
  useScanDraft: {
    getState: () => ({
      mode: 'single',
      queuedItems: [],
      current: null,
      hydrateFromServer: jest.fn(),
      applySmartDetection: jest.fn(),
      start: jest.fn(),
      setPendingDetection: jest.fn(),
    }),
  },
}));
jest.mock('@/features/lab/stores/composerStore', () => ({
  useComposer: { getState: () => ({ setMode: jest.fn() }) },
}));
jest.mock('@/features/lab/stores/threadStore', () => ({
  useThread: { getState: () => ({ reset: jest.fn(), applyFrame: jest.fn() }) },
}));

import { router } from 'expo-router';

import { canEnterScanFlow } from '@/features/seller/scanFlowGate';
import { resumeDraftById } from '@/features/scanner/useResumeDraft';
import { getDraft } from '@/services/drafts/draftApi';
import { hydrateScanDraftFromPayload } from '@/services/drafts/draftPayload';
import { queryClient } from '@/lib/queryClient';

const push = router.push as unknown as jest.Mock;
const mockGetDraft = getDraft as unknown as jest.Mock<(id: string) => Promise<unknown>>;
const mockHydrate = hydrateScanDraftFromPayload as unknown as jest.Mock;
const t = (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? '';

beforeEach(() => {
  push.mockReset();
  mockGetDraft.mockReset();
  mockHydrate.mockReset();
  queryClient.clear();
});

afterEach(() => {
  queryClient.clear();
});

describe('canEnterScanFlow in the seller fork', () => {
  it('is true with an EMPTY status cache — the fork has no upgrade row to read', () => {
    expect(canEnterScanFlow()).toBe(true);
  });

  it('does not consult the seller-upgrade status at all', () => {
    // Even an explicitly rejected row must not lock a seller-fork user out of
    // their own product.
    queryClient.setQueryData(['seller-upgrade', 'my-status'], {
      status: 'rejected',
      company_name: null,
      admin_notes: null,
      reviewed_at: null,
    });
    expect(canEnterScanFlow()).toBe(true);
  });
});

describe('resuming a draft in the seller fork', () => {
  it('opens the scan flow and never the customer application screen', async () => {
    mockGetDraft.mockResolvedValue({
      payload: { kind: 'form-blob', persistedScan: {}, imagesOrdered: [] },
    });
    mockHydrate.mockReturnValue({});
    await resumeDraftById('d1', t);
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/scan/'));
    expect(push).not.toHaveBeenCalledWith('/(lab)/sell/apply');
  });
});
