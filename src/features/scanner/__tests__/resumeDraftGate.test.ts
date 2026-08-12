/**
 * The SECOND sell gate: resuming a saved draft.
 *
 * `launchSellerScan()` covers the five chat/home entry points. This covers the
 * other door, which the Phase 3 review caught: `resumeDraftById` lands on
 * `/scan/detail`, `/scan/grouped-review`, `/scan/detection` — and, for a draft
 * with no photos, `/scan/camera` (`src/lib/scanResume.ts:15`). It is reached from
 * three surfaces, all sharing this one core:
 *
 *   app/scan/drafts.tsx:54                              (the drafts list)
 *   src/features/lab/components/HomeRecentListings.tsx:323 (the Home draft rail)
 *   src/features/scanner/surfaceDraftReady.tsx:104       (background-ready toast)
 *
 * `EXPO_PUBLIC_DRAFTS` is "1" in all three eas.json profiles and in .env, so all
 * of this is live in every build we ship — it is not behind an off flag.
 *
 * What must hold:
 *   - unapproved → the seller application, and NOTHING is hydrated or mapped;
 *   - a LAB draft is untouched by the gate (it resumes to `/(lab)/draft`, a buyer
 *     surface — a saved buy request or an unsent chat draft);
 *   - approved → the scan flow opens exactly as before.
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

afterEach(() => {
  // setQueryData on an unobserved query arms a 5-minute GC timer on the shared
  // client; clear() destroys it so Jest is not left holding an open handle.
  queryClient.clear();
});

describe('resuming a draft is gated for an unapproved user', () => {
  it('sends a seller form-blob draft to the application instead of the scan flow', async () => {
    mockGetDraft.mockResolvedValue(SELLER_FORM_BLOB);
    await resumeDraftById('d1', t);
    expect(push).toHaveBeenCalledWith(APPLY_ROUTE);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('does not hydrate the scan store on a blocked resume', async () => {
    // Redirecting but still loading the draft into the scan store would leave the
    // flow primed for the next ungated push.
    mockGetDraft.mockResolvedValue(SELLER_FORM_BLOB);
    await resumeDraftById('d1', t);
    expect(mockHydrate).not.toHaveBeenCalled();
    expect(useScanDraft.getState().hydrateFromServer).not.toHaveBeenCalled();
  });

  it('blocks a background-recognition draft without mapping it', async () => {
    mockGetDraft.mockResolvedValue(PENDING_AI);
    await resumeDraftById('d2', t);
    expect(push).toHaveBeenCalledWith(APPLY_ROUTE);
    expect(mockMapPendingAi).not.toHaveBeenCalled();
  });

  it('fails closed when the status was never fetched', async () => {
    // No setQueryData — the cold-cache case, which is every app launch.
    mockGetDraft.mockResolvedValue(SELLER_FORM_BLOB);
    await resumeDraftById('d1', t);
    expect(push).toHaveBeenCalledWith(APPLY_ROUTE);
  });

  it.each(['pending', 'rejected'])('blocks while the application is %s', async (status) => {
    queryClient.setQueryData(SELLER_UPGRADE_KEY, {
      status,
      company_name: 'Acme',
      admin_notes: null,
      reviewed_at: null,
    });
    mockGetDraft.mockResolvedValue(SELLER_FORM_BLOB);
    await resumeDraftById('d1', t);
    expect(push).toHaveBeenCalledWith(APPLY_ROUTE);
  });

  it('redirects rather than erroring — no scary toast on a gated resume', async () => {
    mockGetDraft.mockResolvedValue(SELLER_FORM_BLOB);
    await resumeDraftById('d1', t);
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe('the gate does not touch buyer surfaces', () => {
  it('still resumes a LAB draft to the lab draft screen while unapproved', async () => {
    // A saved buy request / unsent chat draft is a BUYER's own content. Gating it
    // would take away something they are entitled to.
    mockGetDraft.mockResolvedValue(LAB_DRAFT);
    await resumeDraftById('d3', t);
    expect(push).toHaveBeenCalledWith('/(lab)/draft');
    expect(push).not.toHaveBeenCalledWith(APPLY_ROUTE);
  });
});

describe('an approved seller resumes exactly as before', () => {
  it('opens the scan flow for a form-blob draft', async () => {
    approve();
    mockGetDraft.mockResolvedValue(SELLER_FORM_BLOB);
    mockHydrate.mockReturnValue({});
    await resumeDraftById('d1', t);
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/scan/'));
    expect(push).not.toHaveBeenCalledWith(APPLY_ROUTE);
  });

  it('proves the hazard: a photo-less draft resumes to the CAMERA', async () => {
    // This is the exact line the gate exists for — `scanResume.ts:15` returns
    // `routes.scanCamera` when a draft has no photos. Approved, it is correct
    // behaviour; unapproved (above) it was an ungated route into the sell flow.
    approve();
    mockGetDraft.mockResolvedValue(SELLER_FORM_BLOB);
    mockHydrate.mockReturnValue({});
    await resumeDraftById('d1', t);
    expect(push).toHaveBeenCalledWith('/scan/camera');
  });
});
