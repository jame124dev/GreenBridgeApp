/**
 * Task 3 — seller-upgrade service + React Query hooks.
 *
 * Two things this file exists to protect, both of which fail SILENTLY in
 * production if they regress:
 *
 *  1. **The wire is snake_case.** The controller destructures
 *     `{ company_name, company_tax_id, business_type, reason, phone, country }`
 *     off `req.body` and reads files from `req.files.doc_business_reg_cert` /
 *     `doc_waste_disposal_permit` (verified on `origin/main`:
 *     `controller/sellerUpgradeController.js` → `submitRequestController`).
 *     A camelCase key does not error — the column is just written as NULL and
 *     the admin reviews a blank application. So the field NAMES are asserted
 *     literally here, not the shape of some intermediate object.
 *
 *  2. **`useCanSell()` is true only for `status === 'approved'`.** Approval can
 *     arrive by two routes (the seller queue, which also flips
 *     `pw_user_status`, or the plain users queue, which does not), so the
 *     session's pending-ness is not a reliable proxy. Only the upgrade status
 *     is correct in both.
 *
 * Mocking note (same pitfall documented in
 * `src/services/drafts/__tests__/draftApi.test.ts`): the `jest.mock` factory
 * must create its own `jest.fn()`s — a module-scope `const post = jest.fn()`
 * closed over by the factory is either rejected by babel-plugin-jest-hoist or
 * captured as `undefined`, because the factory runs before the assignment.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { post: jest.fn(), get: jest.fn() },
}));

import { greenbidz } from '@/api/greenbidzClient';
import {
  getSellerUpgradeStatus,
  submitSellerUpgrade,
  SellerUpgradeError,
} from '@/services/seller/sellerUpgrade';
import {
  SELLER_UPGRADE_KEY,
  useCanSell,
  useSellerUpgradeStatus,
  useSubmitSellerUpgrade,
} from '@/features/seller/useSellerUpgrade';
import { sellerApplicationSchema } from '@/features/seller/schema';

// Explicit generic — the default `jest.Mock` (T = UnknownFunction, returning
// `unknown`) makes `mockResolvedValue`'s parameter type `never`.
type AxiosLikeMock = jest.Mock<(...args: unknown[]) => Promise<{ data: unknown }>>;
const mockPost = greenbidz.post as unknown as AxiosLikeMock;
const mockGet = greenbidz.get as unknown as AxiosLikeMock;

const VALUES = {
  companyName: 'Acme',
  taxId: '1',
  businessType: 'Dealer',
  phone: '1',
  country: 'IN',
  reason: 'x',
};

/** The multipart body of the Nth `greenbidz.post` call. */
function postedForm(call = 0): FormData {
  return mockPost.mock.calls[call][1] as FormData;
}

/** First value appended under `key`, or undefined. `getAll` is the one reader
 *  present on BOTH React Native's FormData and the Node/undici one Jest runs. */
function field(fd: FormData, key: string): unknown {
  return fd.getAll(key)[0];
}

// One client per TEST, created outside the wrapper component. Constructing it
// inside the component body (as the sibling draft-hook test does) makes a brand
// new client on every render, which throws away the cache mid-test and leaves
// notify timers behind — Jest then reports "did not exit".
let qc: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
  qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      // `gcTime: 0` on MUTATIONS matters as much as on queries: a settled
      // mutation otherwise schedules a 5-minute garbage-collection timer, which
      // is a live handle Jest waits on ("did not exit one second after...").
      mutations: { retry: false, gcTime: 0 },
    },
  });
});

afterEach(() => {
  qc.clear();
});

describe('getSellerUpgradeStatus', () => {
  it('returns null when the user has never applied', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: null } });
    await expect(getSellerUpgradeStatus()).resolves.toBeNull();
    expect(mockGet.mock.calls[0][0]).toBe('/seller-upgrade/my-status');
  });

  it('maps an approved row', async () => {
    mockGet.mockResolvedValue({
      data: {
        success: true,
        data: {
          status: 'approved',
          company_name: 'Acme',
          admin_notes: null,
          reviewed_at: '2026-08-11',
        },
      },
    });
    await expect(getSellerUpgradeStatus()).resolves.toEqual({
      status: 'approved',
      company_name: 'Acme',
      admin_notes: null,
      reviewed_at: '2026-08-11',
    });
  });

  it('keeps only the four fields the UI reads, and normalises missing ones to null', async () => {
    mockGet.mockResolvedValue({
      data: {
        success: true,
        data: { id: 9, user_id: 42, status: 'rejected', admin_notes: 'Tax id unreadable' },
      },
    });
    await expect(getSellerUpgradeStatus()).resolves.toEqual({
      status: 'rejected',
      company_name: null,
      admin_notes: 'Tax id unreadable',
      reviewed_at: null,
    });
  });

  it('treats an unrecognised status as no application rather than inventing one', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: { status: 'weird' } } });
    await expect(getSellerUpgradeStatus()).resolves.toBeNull();
  });
});

describe('submitSellerUpgrade', () => {
  it('sends multipart so the optional documents can ride along', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    await submitSellerUpgrade(VALUES);

    const [url, body, config] = mockPost.mock.calls[0] as [
      string,
      FormData,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('/seller-upgrade/request');
    expect(body).toBeInstanceOf(FormData);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
  });

  it('names every text field in snake_case exactly as the controller reads it', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    await submitSellerUpgrade({
      companyName: 'Acme Recycling',
      taxId: 'TIN-42',
      businessType: 'Dealer',
      phone: '+91 555',
      country: 'IN',
      reason: 'We resell CNC machines',
    });

    const fd = postedForm();
    expect(field(fd, 'company_name')).toBe('Acme Recycling');
    expect(field(fd, 'company_tax_id')).toBe('TIN-42');
    expect(field(fd, 'business_type')).toBe('Dealer');
    expect(field(fd, 'phone')).toBe('+91 555');
    expect(field(fd, 'country')).toBe('IN');
    expect(field(fd, 'reason')).toBe('We resell CNC machines');
    // A camelCase key would be silently written as NULL server-side.
    expect(fd.getAll('companyName')).toHaveLength(0);
    expect(fd.getAll('taxId')).toHaveLength(0);
    expect(fd.getAll('businessType')).toHaveLength(0);
  });

  it('names the two optional documents as the multer fields', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    await submitSellerUpgrade(VALUES, {
      businessRegCert: { uri: 'file:///cert.pdf', name: 'cert.pdf', type: 'application/pdf' },
      wasteDisposalPermit: { uri: 'file:///permit.pdf', name: 'permit.pdf', type: 'application/pdf' },
    });

    const fd = postedForm();
    expect(fd.getAll('doc_business_reg_cert')).toHaveLength(1);
    expect(fd.getAll('doc_waste_disposal_permit')).toHaveLength(1);
  });

  it('omits a document field entirely when no file was picked', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    await submitSellerUpgrade(VALUES, {
      businessRegCert: { uri: 'file:///cert.pdf', name: 'cert.pdf', type: 'application/pdf' },
    });

    const fd = postedForm();
    expect(fd.getAll('doc_business_reg_cert')).toHaveLength(1);
    expect(fd.getAll('doc_waste_disposal_permit')).toHaveLength(0);
  });

  it('surfaces the server duplicate-submission message', async () => {
    mockPost.mockRejectedValue({
      response: {
        status: 400,
        data: { message: 'You already have a pending seller upgrade request.' },
      },
    });
    await expect(submitSellerUpgrade(VALUES)).rejects.toMatchObject({
      code: 'DUPLICATE_PENDING',
      message: 'You already have a pending seller upgrade request.',
    });
  });

  it('distinguishes an already-approved upgrade from a pending one', async () => {
    mockPost.mockRejectedValue({
      response: {
        status: 400,
        data: { message: 'Your seller upgrade has already been approved.' },
      },
    });
    await expect(submitSellerUpgrade(VALUES)).rejects.toMatchObject({
      code: 'ALREADY_APPROVED',
      message: 'Your seller upgrade has already been approved.',
    });
  });

  it('throws a typed SellerUpgradeError, so the screen can switch on the code', async () => {
    mockPost.mockRejectedValue({
      response: { status: 400, data: { message: 'Company name is required' } },
    });
    await expect(submitSellerUpgrade(VALUES)).rejects.toBeInstanceOf(SellerUpgradeError);
    mockPost.mockRejectedValue({
      response: { status: 400, data: { message: 'Company name is required' } },
    });
    await expect(submitSellerUpgrade(VALUES)).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('reports a missing response as NETWORK, not UNKNOWN', async () => {
    mockPost.mockRejectedValue({ message: 'Network Error' });
    await expect(submitSellerUpgrade(VALUES)).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('fails loudly when the server answers 200 with success:false', async () => {
    mockPost.mockResolvedValue({ data: { success: false, message: 'nope' } });
    await expect(submitSellerUpgrade(VALUES)).rejects.toMatchObject({ code: 'UNKNOWN' });
  });
});

describe('useSellerUpgradeStatus / useCanSell', () => {
  it('SELLER_UPGRADE_KEY is stable — Task 4 reads the cache under this exact key', () => {
    expect(SELLER_UPGRADE_KEY).toEqual(['seller-upgrade', 'my-status']);
  });

  it('exposes the fetched status', async () => {
    mockGet.mockResolvedValue({
      data: {
        success: true,
        data: { status: 'pending', company_name: 'Acme', admin_notes: null, reviewed_at: null },
      },
    });
    const { result } = renderHook(() => useSellerUpgradeStatus(), { wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe('pending'));
  });

  it('useCanSell is true ONLY for an approved upgrade', async () => {
    mockGet.mockResolvedValue({
      data: {
        success: true,
        data: { status: 'approved', company_name: 'Acme', admin_notes: null, reviewed_at: null },
      },
    });
    const { result } = renderHook(() => useCanSell(), { wrapper });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it.each(['pending', 'rejected'])('useCanSell is false while %s', async (status) => {
    mockGet.mockResolvedValue({
      data: {
        success: true,
        data: { status, company_name: 'Acme', admin_notes: null, reviewed_at: null },
      },
    });
    const { result } = renderHook(() => useCanSell(), { wrapper });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('useCanSell is false when there is no application at all', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: null } });
    const { result } = renderHook(() => useCanSell(), { wrapper });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('useCanSell is false while the status is still loading', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: null } });
    const { result } = renderHook(() => useCanSell(), { wrapper });
    expect(result.current).toBe(false);
    // Let the in-flight fetch settle before the test ends, so it does not
    // resolve into an unmounted tree.
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
  });

  it('useCanSell is false when the status request fails — never fail open', async () => {
    mockGet.mockRejectedValue({ response: { status: 500, data: { message: 'boom' } } });
    const { result } = renderHook(() => useCanSell(), { wrapper });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});

describe('useSubmitSellerUpgrade', () => {
  it('refetches the status after a successful submission', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    mockGet.mockResolvedValue({ data: { success: true, data: null } });

    const { result } = renderHook(
      () => ({ submit: useSubmitSellerUpgrade(), status: useSellerUpgradeStatus() }),
      { wrapper },
    );
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    mockGet.mockResolvedValue({
      data: {
        success: true,
        data: { status: 'pending', company_name: 'Acme', admin_notes: null, reviewed_at: null },
      },
    });
    await act(async () => {
      await result.current.submit.mutateAsync({ values: VALUES });
    });

    await waitFor(() => expect(result.current.status.data?.status).toBe('pending'));
  });

  it('hands the typed error to the UI instead of swallowing it', async () => {
    mockPost.mockRejectedValue({
      response: {
        status: 400,
        data: { message: 'You already have a pending seller upgrade request.' },
      },
    });
    mockGet.mockResolvedValue({ data: { success: true, data: null } });

    const { result } = renderHook(() => useSubmitSellerUpgrade(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ values: VALUES })).rejects.toMatchObject({
        code: 'DUPLICATE_PENDING',
      });
    });
  });
});

describe('sellerApplicationSchema', () => {
  it('accepts a complete application', () => {
    expect(sellerApplicationSchema.safeParse(VALUES).success).toBe(true);
  });

  it('rejects a blank required field with a translation key', () => {
    const parsed = sellerApplicationSchema.safeParse({ ...VALUES, companyName: '   ' });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe('mobile.seller.apply.companyRequired');
  });

  it('trims what it parses, so a padded value is not posted with spaces', () => {
    const parsed = sellerApplicationSchema.safeParse({ ...VALUES, companyName: '  Acme  ' });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.companyName).toBe('Acme');
  });
});
