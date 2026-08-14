/**
 * Resuming a saved draft is UNGATED.
 *
 * This replaces `resumeDraftGate.test.ts`, which asserted that an unapproved user
 * resuming their own draft was redirected to the seller application. Authoring is
 * now open — a draft you were allowed to create is a draft you are allowed to
 * reopen and edit — and approval is enforced at the two SUBMIT choke points
 * instead (`submitGateTopology.test.ts`).
 *
 * Reached from three surfaces, all sharing this one core:
 *   app/scan/drafts.tsx                                   (the drafts list)
 *   src/features/lab/components/HomeRecentListings.tsx     (the Home draft rail)
 *   src/features/scanner/surfaceDraftReady.tsx             (background-ready toast)
 *
 * `EXPO_PUBLIC_DRAFTS` is "1" in all three eas.json profiles and in .env, so this
 * is live in every build we ship — it is not behind an off flag.
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
// ⚠️ jest does NOT load `.env`, so `IS_CUSTOMER` is `false` here while every
// shipped profile sets EXPO_PUBLIC_USER_TYPE=customer. `canEnterScanFlow()`
// short-circuits to `true` for the seller fork, so without this the suite would
// assert the allow-all path and prove nothing.
jest.mock('@/lib/flags', () => ({
  ...(jest.requireActual('@/lib/flags') as typeof import('@/lib/flags')),
  IS_CUSTOMER: true,
}));
jest.mock('@/api/greenbidzClient', () => ({ greenbidz: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/services/drafts/draftApi', () => ({ getDraft: jest.fn() }));
jest.mock('@/services/drafts/draftPayload', () => ({ hydrateScanDraftFromPayload: jest.fn() }));
jest.mock('@/services/drafts/pendingAiResume', () => ({ mapPendingAiDraft: jest.fn() }));
jest.mock('@/services/scanner/buildFormData', () => ({ getSiteType: () => 'LabGreenbidz' }));
// Zustand stores back onto MMKV, which has no jest binary.
jest.mock('@/stores/scanDraftStore', () => {
  const hydrateFromServer = jest.fn();
  const applySmartDetection = jest.fn();
  const start = jest.fn();
  const setPendingDetection = jest.fn();
  return {
    useScanDraft: {
      getState: () => ({
        mode: 'single',
        queuedItems: [],
        current: null,
        hydrateFromServer,
        applySmartDetection,
        start,
        setPendingDetection,
      }),
    },
  };
});
jest.mock('@/features/lab/stores/composerStore', () => ({
  useComposer: { getState: () => ({ setMode: jest.fn() }) },
}));
jest.mock('@/features/lab/stores/threadStore', () => ({
  useThread: { getState: () => ({ reset: jest.fn(), applyFrame: jest.fn() }) },
}));

import { router } from 'expo-router';
import { toast } from 'sonner-native';

import { resumeDraftById } from '@/features/scanner/useResumeDraft';
import { getDraft } from '@/services/drafts/draftApi';
import { hydrateScanDraftFromPayload } from '@/services/drafts/draftPayload';
import { mapPendingAiDraft } from '@/services/drafts/pendingAiResume';
import { SELLER_UPGRADE_KEY } from '@/features/seller/useSellerUpgrade';
import { queryClient } from '@/lib/queryClient';
import { useScanDraft } from '@/stores/scanDraftStore';

const push = router.push as unknown as jest.Mock;
const mockGetDraft = getDraft as unknown as jest.Mock<(id: string) => Promise<unknown>>;
const mockHydrate = hydrateScanDraftFromPayload as unknown as jest.Mock;
const mockMapPendingAi = mapPendingAiDraft as unknown as jest.Mock;
const toastError = (toast as unknown as { error: jest.Mock }).error;

const APPLY_ROUTE = '/(lab)/sell/apply';
const t = (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? '';

/** A SELLER draft with no photos — the worst case: `getScanResumeRoute` resolves
 *  a photo-less form-blob to `/scan/camera`. */
const SELLER_FORM_BLOB = { payload: { kind: 'form-blob', persistedScan: {}, imagesOrdered: [] } };
/** A background-recognition draft — resumes deep inside the flow. */
const PENDING_AI = {
  payload: { kind: 'pending-ai', result: {}, imagesOrdered: [], language: 'en', mode: 'single' },
};
/** A LAB draft — a buyer's saved request / unsent chat draft. */
const LAB_DRAFT = { payload: { kind: 'form-blob', mode: 'sell', labDraft: {} } };

const approve = () =>
  queryClient.setQueryData(SELLER_UPGRADE_KEY, {
    status: 'approved',
    company_name: 'Acme',
    admin_notes: null,
    reviewed_at: null,
  });

beforeEach(() => {
  push.mockReset();
  mockGetDraft.mockReset();
  mockHydrate.mockReset();
  mockMapPendingAi.mockReset();
  toastError.mockReset();
  (useScanDraft.getState().hydrateFromServer as unknown as jest.Mock).mockReset();
  queryClient.clear();
});

afterEach(() => queryClient.clear());

describe('resumeDraftById — no approval needed to keep working', () => {
  it('opens a seller form-blob draft with NO application on file', async () => {
    // The hardest case: a photo-less form-blob resolves to `/scan/camera`, which
    // the old policy treated as the flow entrance and blocked.
    queryClient.setQueryData(SELLER_UPGRADE_KEY, null);
    mockGetDraft.mockResolvedValue(SELLER_FORM_BLOB);
    mockHydrate.mockReturnValue({});

    await resumeDraftById('d1', t);

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalledWith(APPLY_ROUTE);
    expect(useScanDraft.getState().hydrateFromServer).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['pending', 'pending'],
    ['rejected', 'rejected'],
  ])('opens a draft for a %s application', async (_label, status) => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, {
      status,
      company_name: null,
      admin_notes: null,
      reviewed_at: null,
    });
    mockGetDraft.mockResolvedValue(SELLER_FORM_BLOB);
    mockHydrate.mockReturnValue({});

    await resumeDraftById('d2', t);

    expect(push).not.toHaveBeenCalledWith(APPLY_ROUTE);
    expect(useScanDraft.getState().hydrateFromServer).toHaveBeenCalledTimes(1);
  });

  it('opens a background-recognition draft with a cold status cache', async () => {
    // No setQueryData at all.
    mockGetDraft.mockResolvedValue(PENDING_AI);
    // `shouldSkipDetectionChoice` is the REAL implementation here and reads
    // `mapped.meta.productCount` — a fixture without `meta` throws inside the
    // try/catch and shows up as "navigated nowhere", not as an error.
    mockMapPendingAi.mockReturnValue({
      mapped: { meta: { productCount: 1, suggestedMode: 'single' } },
      sourcePhotos: [{ uri: 'file:///a.jpg' }],
    });

    await resumeDraftById('d3', t);

    expect(toastError).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalledWith(APPLY_ROUTE);
  });

  it('still opens a LAB draft on the buyer surface', async () => {
    // Unchanged by the policy move, and asserted so the two branches cannot be
    // conflated: a lab draft must never land in the scan flow.
    mockGetDraft.mockResolvedValue(LAB_DRAFT);

    await resumeDraftById('d4', t);

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalledWith(APPLY_ROUTE);
    expect(useScanDraft.getState().hydrateFromServer).not.toHaveBeenCalled();
  });

  it('opens the draft for an approved seller, exactly as before', async () => {
    approve();
    mockGetDraft.mockResolvedValue(SELLER_FORM_BLOB);
    mockHydrate.mockReturnValue({});

    await resumeDraftById('d5', t);

    expect(push).toHaveBeenCalledTimes(1);
    expect(useScanDraft.getState().hydrateFromServer).toHaveBeenCalledTimes(1);
  });

  it('reports a fetch failure with a toast and navigates nowhere', async () => {
    mockGetDraft.mockRejectedValue(new Error('offline'));

    await resumeDraftById('d6', t);

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });
});
