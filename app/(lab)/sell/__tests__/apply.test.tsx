/**
 * Seller status screen — four situations, and one compliance guard.
 *
 *   - no application → "selling needs a verified business account", NO form
 *   - pending        → status + a way back into the app
 *   - rejected       → the reviewer's words, and what happens next
 *   - approved       → a door into the scan flow
 *
 * ⛔ The last describe block is the important one. This screen carried a business
 * registration form (company name, tax / registration number, business type,
 * business-registration certificate) and App Review rejected the app for it under
 * Guideline 3.1.1 — TWICE, because it was reintroduced after the sign-in-only
 * build was approved. `does not ask a business to register` is what makes putting
 * it back a red test rather than a rejected submission six weeks later.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
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
// Mocked so the screen's approved-state CTA can be observed without dragging the
// real gate (and its query client + scan draft store) into this test.
jest.mock('@/features/lab/scan/launchSellerScan', () => ({ launchSellerScan: jest.fn() }));

const mockStatus = jest.fn<() => StatusResult>();
jest.mock('@/features/seller/useSellerUpgrade', () => ({
  SELLER_UPGRADE_KEY: ['seller-upgrade', 'my-status'],
  useSellerUpgradeStatus: () => mockStatus(),
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

let qc: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const renderScreen = () => render(<SellerApplyScreen />, { wrapper });

beforeEach(() => {
  mockStatus.mockReset();
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

describe('not a verified seller yet', () => {
  beforeEach(() => {
    mockStatus.mockReturnValue(result({ data: null }));
  });

  it('states the position without asking for anything', () => {
    const { getByText } = renderScreen();
    expect(getByText('Selling needs a verified business account')).toBeTruthy();
    expect(getByText('Back to browsing')).toBeTruthy();
  });

  it('is not a dead end — it names what the account can still do', () => {
    const { getByText } = renderScreen();
    // Browsing, messaging and SAVING drafts all still work; only publishing is
    // gated (sellerSubmitGate.ts). A screen that omitted this would read as a wall.
    expect(getByText(/browsing equipment, messaging sellers and saving drafts/)).toBeTruthy();
  });
});

describe('an application under review', () => {
  beforeEach(() => {
    mockStatus.mockReturnValue(result({ data: row({ status: 'pending' }) }));
  });

  it('shows the status', () => {
    const { getByText } = renderScreen();
    expect(getByText('Your application is with our team')).toBeTruthy();
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

  it('quotes the reviewer, so the user knows what the problem was', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('seller-status-notes').props.children).toBe(
      'The tax ID does not match the certificate.',
    );
  });

  it('says what happens next rather than re-opening a form', () => {
    const { getByText } = renderScreen();
    expect(getByText('Your seller account is not active')).toBeTruthy();
    expect(getByText(/Our team will follow up with you/)).toBeTruthy();
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

describe('does not ask a business to register (App Review Guideline 3.1.1)', () => {
  // Every state, because the form used to be reachable from two of them (no
  // application, and rejected) and a future edit could re-add it to either.
  const STATES: [string, StatusResult][] = [
    ['no application', result({ data: null })],
    ['rejected', result({ data: row({ status: 'rejected', admin_notes: 'No' }) })],
    ['pending', result({ data: row({ status: 'pending' }) })],
    ['approved', result({ data: row({ status: 'approved' }) })],
  ];

  it.each(STATES)('collects no business details in the "%s" state', (_name, state) => {
    mockStatus.mockReturnValue(state);
    const { queryByTestId, queryByText } = renderScreen();

    // The form's own handles.
    for (const id of [
      'apply-company',
      'apply-tax-id',
      'apply-phone',
      'apply-reason',
      'apply-submit',
      'apply-missing',
      'apply-server-error',
    ]) {
      expect(queryByTestId(id)).toBeNull();
    }

    // ...and its labels, which is what a reviewer actually reads. `admin_notes`
    // may legitimately mention a tax ID (the reviewer's own sentence), so this
    // asserts on the FIELD LABELS, not on the word "tax".
    for (const label of [
      'Company name',
      'Tax / registration number',
      'Business type',
      'Business registration certificate',
      'Your business',
      'Submit application',
      'Resend application',
      'Apply to sell equipment',
      'Documents · optional',
    ]) {
      expect(queryByText(label)).toBeNull();
    }
  });

  it('offers no outbound link to register elsewhere', () => {
    // Guideline 3.1.3's preamble forbids steering to an off-app purchase path,
    // and this app's third rejection was caused by exactly such a link (to a web
    // page with a Company field). Anything resembling one must not come back.
    mockStatus.mockReturnValue(result({ data: null }));
    const { queryByText } = renderScreen();
    expect(queryByText(/101lab\.co|greenbidz\.com|https?:/i)).toBeNull();
    expect(queryByText(/sign up|register (at|on)|open (the )?website|apply online/i)).toBeNull();
  });
});
