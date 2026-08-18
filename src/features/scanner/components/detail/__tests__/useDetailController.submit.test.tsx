import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Alert } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

import type { DraftItem } from '@/stores/scanDraftStore';

/**
 * M-9 — "no press may silently no-op". Both halves of this were revertible with a
 * fully green suite before this file existed:
 *
 *   1. `, onInvalid` on all FOUR `handleSubmit(...)` calls. Without it a press on
 *      the (now never-disabled, S9) Submit button runs zod, fails, and does
 *      NOTHING — the dead end moved from the button to the press.
 *   2. `if (missingPhotos()) return;` on the single-submit VALID path. Photos are
 *      not in `detailSchema`, so with Submit un-gated a zero-photo draft would
 *      otherwise reach `createListing.mutate` and be POSTed.
 *
 * Everything the controller reaches outside the form is mocked at the module
 * seam: the real store/hooks pull in MMKV (a Nitro native module with no jest
 * binary) and the axios client.
 */
const mockDraftState: {
  current: DraftItem | null;
  patch: jest.Mock;
  setLastStep: jest.Mock;
  updatePhotos: jest.Mock;
  enqueueCurrentItem: jest.Mock;
  prepareGroupedReview: jest.Mock;
} = {
  current: null,
  patch: jest.fn(),
  setLastStep: jest.fn(),
  updatePhotos: jest.fn(),
  enqueueCurrentItem: jest.fn(),
  prepareGroupedReview: jest.fn(),
};
const mockMutate = jest.fn();
const mockRouter = { replace: jest.fn(), push: jest.fn() };

jest.mock('@/stores/scanDraftStore', () => {
  const useScanDraft = (selector: (s: typeof mockDraftState) => unknown) =>
    selector(mockDraftState);
  (useScanDraft as unknown as { getState: () => typeof mockDraftState }).getState = () =>
    mockDraftState;
  return { useScanDraft };
});
jest.mock('@/features/scanner/useCreateListing', () => ({
  useCreateListing: () => ({ mutate: mockMutate, isPending: false }),
}));
jest.mock('@/features/scanner/useLabCategories', () => ({
  useLabCategories: () => ({ data: { options: [] } }),
}));
jest.mock('@/features/seller/sellerSubmitGate', () => ({
  canSubmitListing: () => true,
  redirectToSellerApplication: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: mockRouter }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

import { useDetailController } from '@/features/scanner/components/detail/useDetailController';

function validDraft(overrides: Partial<DraftItem> = {}): DraftItem {
  return {
    id: 'd1',
    photos: [{ uri: 'file:///a.jpg', width: 10, height: 10 }],
    ai: null,
    productIds: [],
    title: 'Benchtop centrifuge',
    description: 'Working, single owner',
    categoryId: '5371',
    categoryName: 'Lab Infrastructure & Essentials',
    customSubcategory: '',
    parentCategoryId: '',
    parentCategoryName: '',
    condition: ['usedFunctional'],
    operationStatus: ['working'],
    pricePerUnit: '4500',
    priceCurrency: 'USD',
    priceFormat: 'buyNow',
    quantity: 1,
    locations: ['Taipei'],
    locationCountries: ['Taiwan'],
    documents: [],
    allowedSites: [],
    sellerVisible: true,
    visibility: 'PUBLIC',
    networkSellers: [],
    brand: '',
    model: '',
    year: '',
    weight: '',
    dimensions: '',
    co2Emissions: '',
    grade: 'A',
    serialNumber: '',
    marketplace: '101lab',
    installation: 'deinstalled',
    listingDurationDays: 90,
    aiPrices: null,
    ...overrides,
  } as DraftItem;
}

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

beforeEach(() => {
  alertSpy.mockClear();
  mockMutate.mockClear();
  mockDraftState.patch.mockClear();
  mockDraftState.enqueueCurrentItem.mockClear();
  mockDraftState.prepareGroupedReview.mockClear();
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
});

/** Renders the controller against `draft` and returns it plus the scroll spy. */
function mount(draft: DraftItem) {
  mockDraftState.current = draft;
  const scrollToRow = jest.fn();
  const { result } = renderHook(() => useDetailController({ scrollToRow }));
  return { result, scrollToRow };
}

type SubmitKey =
  | 'onSubmitSingle'
  | 'onAddAnother'
  | 'onReviewGroup'
  | 'onSaveAndReturnToReview';
const SUBMIT_PATHS: SubmitKey[] = [
  'onSubmitSingle',
  'onAddAnother',
  'onReviewGroup',
  'onSaveAndReturnToReview',
];

describe('useDetailController — onInvalid answers every submit path (M-9)', () => {
  it.each(SUBMIT_PATHS)(
    '%s on an invalid draft alerts and scrolls to the offending card',
    async (key) => {
      // Title empty: `detailSchema` fails on a field that DOES own a visible row.
      const { result, scrollToRow } = mount(validDraft({ title: '' }));
      await act(async () => {
        result.current[key]();
      });
      expect(alertSpy).toHaveBeenCalled();
      expect(scrollToRow).toHaveBeenCalledWith('title');
      // Nothing moved: no publish, no enqueue, no navigation.
      expect(mockMutate).not.toHaveBeenCalled();
      expect(mockDraftState.enqueueCurrentItem).not.toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    },
  );

  it('names every missing row, in screen order', async () => {
    const { result, scrollToRow } = mount(
      validDraft({ title: '', pricePerUnit: '', photos: [] }),
    );
    await act(async () => {
      result.current.onSubmitSingle();
    });
    // photos → title → price is REQUIRED_ROWS order; the first one is where the
    // seller is sent.
    expect(scrollToRow).toHaveBeenCalledWith('photos');
    expect(alertSpy).toHaveBeenCalled();
  });
});

describe('useDetailController — the zero-photos guard on the valid path (M-9)', () => {
  it('a schema-valid draft with no photos does NOT reach createListing', async () => {
    const { result, scrollToRow } = mount(validDraft({ photos: [] }));
    await act(async () => {
      result.current.onSubmitSingle();
    });
    // `detailSchema` knows nothing about photos, so this is the ONLY thing
    // standing between an un-gated Submit and a photo-less listing.
    expect(mockMutate).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
    expect(scrollToRow).toHaveBeenCalledWith('photos');
  });

  it('a complete draft still submits', async () => {
    const { result } = mount(validDraft());
    await act(async () => {
      result.current.onSubmitSingle();
    });
    expect(mockMutate).toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
