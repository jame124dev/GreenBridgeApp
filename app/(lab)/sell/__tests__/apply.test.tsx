/**
 * Task 5 — the seller application screen.
 *
 * The screen is one component answering four situations, so what is asserted
 * here is that each one is COMPLETE, not merely that it renders:
 *
 *   - no application → the form, with the CTA and a live completion count
 *   - pending        → status, no form (a second submission is a server 400)
 *   - rejected       → the reviewer's words AND a prefilled form to resend
 *   - approved       → a door into the scan flow
 *
 * Plus the two error paths that used to be swallowed: a rejected local validation
 * (which must name what is missing, not silently do nothing) and a server
 * duplicate/approved message (which must be shown verbatim and must make the
 * screen re-read the real status).
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
}));
jest.mock('sonner-native', () => ({
  toast: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/lib/haptics', () => ({
  haptics: {
    tap: jest.fn(),
    impact: jest.fn(),
    heavy: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));
// `@/i18n` reads the persisted language out of MMKV, which has no jest binary.
jest.mock('@/lib/mmkv', () => ({ mmkv: { getString: () => undefined, set: () => {} } }));
// Button animates its press with reanimated; the native Worklets module is not
// initialized under jest (same stub as the account-deletion screen test).
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
  };
});
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
// Mocked so the screen's approved-state CTA can be observed without dragging the
// real gate (and its query client + scan draft store) into this test.
jest.mock('@/features/lab/scan/launchSellerScan', () => ({ launchSellerScan: jest.fn() }));

// Explicit generics: the default `jest.fn()` is typed `UnknownFunction`, which
// neither accepts a two-parameter implementation nor a typed return value.
type MutateVars = { values: Record<string, string>; files?: unknown };
type MutateOpts = {
  onSuccess?: () => void;
  onError?: (err: { code: string; message: string }) => void;
};

const mockStatus = jest.fn<() => StatusResult>();
const mockMutate = jest.fn<(vars: MutateVars, opts?: MutateOpts) => void>();
jest.mock('@/features/seller/useSellerUpgrade', () => ({
  SELLER_UPGRADE_KEY: ['seller-upgrade', 'my-status'],
  useSellerUpgradeStatus: () => mockStatus(),
  useSubmitSellerUpgrade: () => ({ mutate: mockMutate, isPending: false }),
}));

import '@/i18n'; // real resources, so assertions read the shipped copy

import { launchSellerScan } from '@/features/lab/scan/launchSellerScan';
import SellerApplyScreen from '../apply';

type StatusResult = {
  data?: unknown;
  isLoading?: boolean;
  isError?: boolean;
  isFetching?: boolean;
  error?: { message: string } | null;
  refetch?: () => void;
};

const result = (over: StatusResult): StatusResult => ({
  data: null,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: jest.fn(),
  ...over,
});

const row = (over: Record<string, unknown> = {}) => ({
  status: 'pending',
  company_name: 'Acme Recycling',
  admin_notes: null,
  reviewed_at: null,
  ...over,
});

// ONE client per test, built outside the wrapper component: a client constructed
// in the component body is recreated on every render, and a settled mutation then
// leaves a 5-minute GC timer behind — Jest reports "did not exit" for it.
let qc: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const renderScreen = () => render(<SellerApplyScreen />, { wrapper });

beforeEach(() => {
  mockStatus.mockReset();
  mockMutate.mockReset();
  (launchSellerScan as unknown as jest.Mock).mockReset();
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } },
  });
});

afterEach(() => {
  qc.clear();
});

describe('while the status is unknown', () => {
  it('says what it is checking instead of showing a bare spinner', () => {
    mockStatus.mockReturnValue(result({ isLoading: true, data: undefined }));
    const { getByText } = renderScreen();
    expect(getByText('Checking whether you can list yet…')).toBeTruthy();
  });

  it('offers a retry and a way onwards when the check fails', () => {
    mockStatus.mockReturnValue(
      result({ isError: true, data: undefined, error: { message: 'Network error' } }),
    );
    const { getByText } = renderScreen();
    expect(getByText('We could not check your status')).toBeTruthy();
    expect(getByText('Network error')).toBeTruthy();
    expect(getByText('Try again')).toBeTruthy();
    expect(getByText('Back to browsing')).toBeTruthy();
  });
});

describe('no application yet', () => {
  beforeEach(() => {
    mockStatus.mockReturnValue(result({ data: null }));
  });

  it('shows the form with one dominant CTA and says why it is asking', () => {
    const { getByText, getByTestId } = renderScreen();
    expect(getByText('Apply to sell equipment')).toBeTruthy();
    expect(getByTestId('apply-submit')).toBeTruthy();
    expect(getByText('Submit application')).toBeTruthy();
  });

  it('tracks completion so the sticky footer says what is left', () => {
    const { getByText, getByTestId } = renderScreen();
    expect(getByText('0 of 6 details complete')).toBeTruthy();
    fireEvent.changeText(getByTestId('apply-company'), 'Acme');
    expect(getByText('1 of 6 details complete')).toBeTruthy();
  });

  it('marks the documents optional rather than implying they are needed', () => {
    const { getByText } = renderScreen();
    expect(getByText('Documents · optional')).toBeTruthy();
    expect(
      getByText(
        'Attaching these usually gets you approved faster, but you can submit without them and send them later.',
      ),
    ).toBeTruthy();
  });

  it('names what is missing instead of failing silently', async () => {
    const { getByTestId, queryByTestId } = renderScreen();
    await act(async () => {
      fireEvent.press(getByTestId('apply-submit'));
    });
    await waitFor(() => expect(queryByTestId('apply-missing')).toBeTruthy());
    expect(mockMutate).not.toHaveBeenCalled();
  });
});

describe('an application under review', () => {
  beforeEach(() => {
    mockStatus.mockReturnValue(result({ data: row({ status: 'pending' }) }));
  });

  it('shows the status and does NOT offer the form again', () => {
    const { getByText, queryByTestId } = renderScreen();
    expect(getByText('Your application is with our team')).toBeTruthy();
    // A second submission while one is pending is a 400 — no CTA may lead there.
    expect(queryByTestId('apply-submit')).toBeNull();
    expect(queryByTestId('apply-company')).toBeNull();
  });

  it('never implies the account is unusable', () => {
    const { getByText } = renderScreen();
    expect(
      getByText(
        'Meanwhile your account works as normal: browse equipment, ask the AI assistant, post what you are looking for and message sellers.',
      ),
    ).toBeTruthy();
  });

  it('lets the user pull a fresh answer', () => {
    const { getByText } = renderScreen();
    expect(getByText('Check for an update')).toBeTruthy();
  });
});

describe('a rejected application', () => {
  const rejected = row({
    status: 'rejected',
    admin_notes: 'The tax ID does not match the certificate.',
    reviewed_at: '2026-08-10',
  });

  beforeEach(() => {
    mockStatus.mockReturnValue(result({ data: rejected }));
  });

  it('quotes the reviewer, so the user knows what to change', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('seller-status-notes').props.children).toBe(
      'The tax ID does not match the certificate.',
    );
  });

  it('is a way forward, not a dead end: the form is right there', () => {
    const { getByTestId, getByText } = renderScreen();
    expect(getByTestId('apply-company')).toBeTruthy();
    expect(getByText('Resend application')).toBeTruthy();
    expect(getByText('Update your application')).toBeTruthy();
  });

  it('prefills the company so a correction is an edit, not a retype', async () => {
    const { getByTestId } = renderScreen();
    await waitFor(() =>
      expect(getByTestId('apply-company').props.value).toBe('Acme Recycling'),
    );
  });
});

describe('an approved seller', () => {
  beforeEach(() => {
    mockStatus.mockReturnValue(result({ data: row({ status: 'approved' }) }));
  });

  it('opens the scan flow rather than asking again', () => {
    const { getByText } = renderScreen();
    expect(getByText('You can list equipment')).toBeTruthy();
    fireEvent.press(getByText('Start a listing'));
    expect(launchSellerScan).toHaveBeenCalled();
  });
});

describe('server rejections are surfaced, not swallowed', () => {
  /** Fill every required field so `handleSubmit` reaches the mutation. */
  async function fillForm(api: ReturnType<typeof renderScreen>) {
    const { getByTestId, getByText } = api;
    await act(async () => {
      fireEvent.changeText(getByTestId('apply-company'), 'Acme Recycling');
      fireEvent.changeText(getByTestId('apply-tax-id'), 'TIN-42');
      fireEvent.changeText(getByTestId('apply-phone'), '+66 123');
      fireEvent.changeText(getByTestId('apply-reason'), 'Used CNC machines');
      fireEvent.press(getByText('Dealer'));
      fireEvent.press(getByText('Thailand'));
    });
  }

  it('shows the duplicate-pending sentence verbatim and re-reads the status', async () => {
    mockStatus.mockReturnValue(result({ data: null }));
    const message = 'You already have a pending seller upgrade request.';
    mockMutate.mockImplementation((_vars, opts) => {
      opts?.onError?.({ code: 'DUPLICATE_PENDING', message });
    });
    const invalidate = jest.spyOn(qc, 'invalidateQueries');

    const api = renderScreen();
    await fillForm(api);
    await act(async () => {
      fireEvent.press(api.getByTestId('apply-submit'));
    });

    await waitFor(() => expect(api.queryByTestId('apply-server-error')).toBeTruthy());
    expect(api.getByText(message)).toBeTruthy();
    // The cached status was stale — the screen must go and find out the truth.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['seller-upgrade', 'my-status'] });
  });

  it('shows the already-approved sentence verbatim', async () => {
    mockStatus.mockReturnValue(result({ data: null }));
    const message = 'Your seller upgrade has already been approved.';
    mockMutate.mockImplementation((_vars, opts) => {
      opts?.onError?.({ code: 'ALREADY_APPROVED', message });
    });

    const api = renderScreen();
    await fillForm(api);
    await act(async () => {
      fireEvent.press(api.getByTestId('apply-submit'));
    });

    await waitFor(() => expect(api.getByText(message)).toBeTruthy());
  });

  it('posts snake-case-mapped values and the optional files only when picked', async () => {
    mockStatus.mockReturnValue(result({ data: null }));
    const api = renderScreen();
    await fillForm(api);
    await act(async () => {
      fireEvent.press(api.getByTestId('apply-submit'));
    });

    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    const [vars] = mockMutate.mock.calls[0];
    expect(vars.values).toEqual({
      companyName: 'Acme Recycling',
      taxId: 'TIN-42',
      businessType: 'Dealer',
      phone: '+66 123',
      country: 'Thailand',
      reason: 'Used CNC machines',
    });
    // No document picked → the key is omitted entirely rather than sent empty.
    expect(vars.files).toBeUndefined();
  });
});
