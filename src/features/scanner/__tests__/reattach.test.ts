// src/features/scanner/__tests__/reattach.test.ts
//
// Task 11 — reattach-on-return. Note: the task brief's literal test closes
// jest.mock() factories over outer `const getStored = jest.fn()`-style
// consts. That throws babel-plugin-jest-hoist's "invalid variable access"
// in this repo (only names prefixed `mock` may be referenced from inside a
// factory — see draftApi.test.ts / draftHooks.test.tsx for the same
// documented pitfall + fix). Following that established pattern here: the
// jest.fn()s are created INSIDE the factory and reached afterwards via the
// mocked module namespace.
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/stores/recognitionJobStore', () => ({
  getStoredJobId: jest.fn(),
  clearStoredJobId: jest.fn(),
}));
jest.mock('@/services/scanner/recognitionJobClient', () => ({
  getRecognitionJobStatus: jest.fn(),
  tailRecognitionJob: jest.fn(),
}));

import * as jobStore from '@/stores/recognitionJobStore';
import * as jobClient from '@/services/scanner/recognitionJobClient';
import { reattachRecognition } from '@/features/scanner/reattachRecognition';

// Explicit generics — the default `jest.Mock` pitfall (documented repeatedly
// elsewhere in this repo's tests) collapses `mockResolvedValue`'s parameter
// type to `never` otherwise.
type SyncMock = jest.Mock<(...args: unknown[]) => unknown>;
type AsyncMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

const mockGetStoredJobId = jobStore.getStoredJobId as SyncMock;
const mockClearStoredJobId = jobStore.clearStoredJobId as SyncMock;
const mockGetStatus = jobClient.getRecognitionJobStatus as AsyncMock;
const mockTail = jobClient.tailRecognitionJob as AsyncMock;

beforeEach(() => {
  mockGetStoredJobId.mockReset();
  mockClearStoredJobId.mockReset();
  mockGetStatus.mockReset();
  mockTail.mockReset();
});

describe('reattachRecognition', () => {
  it('returns none when no job stored', async () => {
    mockGetStoredJobId.mockReturnValue(null);
    expect(await reattachRecognition({})).toBe('none');
    expect(mockGetStatus).not.toHaveBeenCalled();
  });

  it('clears + returns ready when the job produced a draft', async () => {
    mockGetStoredJobId.mockReturnValue('job-1');
    mockGetStatus.mockResolvedValue({ status: 'draft_ready', draft_id: 'd9' });
    expect(await reattachRecognition({})).toBe('ready');
    expect(mockClearStoredJobId).toHaveBeenCalled();
  });

  it('clears + returns failed when the job failed server-side', async () => {
    mockGetStoredJobId.mockReturnValue('job-2');
    mockGetStatus.mockResolvedValue({ status: 'failed', error: 'boom' });
    expect(await reattachRecognition({})).toBe('failed');
    expect(mockClearStoredJobId).toHaveBeenCalled();
  });

  it('re-tails a running job to completion, clears the id, and hands the result up', async () => {
    mockGetStoredJobId.mockReturnValue('job-3');
    mockGetStatus.mockResolvedValue({ status: 'running' });
    const mapped = { mode: 'single' } as const;
    mockTail.mockResolvedValue(mapped);
    const onResult = jest.fn();

    const outcome = await reattachRecognition({ onResult });

    expect(outcome).toBe('running');
    expect(mockTail).toHaveBeenCalledWith('job-3', expect.objectContaining({ afterSeq: 0 }));
    expect(mockClearStoredJobId).toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith(mapped);
  });

  it('keeps the stored id and still returns running when the tail rejects', async () => {
    mockGetStoredJobId.mockReturnValue('job-4');
    mockGetStatus.mockResolvedValue({ status: 'queued' });
    mockTail.mockRejectedValue(new Error('connection_lost'));

    const outcome = await reattachRecognition({});

    expect(outcome).toBe('running');
    expect(mockClearStoredJobId).not.toHaveBeenCalled();
  });

  it('keeps the stored id and returns running when the status check itself throws', async () => {
    mockGetStoredJobId.mockReturnValue('job-5');
    mockGetStatus.mockRejectedValue(new Error('network down'));

    const outcome = await reattachRecognition({});

    expect(outcome).toBe('running');
    expect(mockClearStoredJobId).not.toHaveBeenCalled();
    expect(mockTail).not.toHaveBeenCalled();
  });
});
