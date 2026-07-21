// src/features/scanner/__tests__/backgroundStart.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock factories may only close over out-of-scope names prefixed "mock"
// (babel-plugin-jest-hoist rule) — same idiom used across this repo's other
// jest.mock sites (recognitionJobClient.test.ts, smartDetectStream.test.ts).
// Explicitly typed — jest-mock's default `jest.fn()` generic collapses
// `mockResolvedValue`'s param type to `never` (same pitfall documented in
// recognitionJobClient.test.ts / draftApi.test.ts).
const mockCreate = jest.fn<(...args: unknown[]) => Promise<{ job_id: string }>>();
const mockStore = jest.fn<(...args: unknown[]) => void>();
jest.mock('@/services/scanner/recognitionJobClient', () => ({
  createRecognitionJob: (...a: unknown[]) => mockCreate(...a),
  tailRecognitionJob: jest.fn(),
}));
jest.mock('@/stores/recognitionJobStore', () => ({
  storeJobId: (...a: unknown[]) => mockStore(...a),
  clearStoredJobId: jest.fn(),
}));

import { startBackgroundRecognition } from '@/features/scanner/backgroundRecognition';

beforeEach(() => {
  mockCreate.mockReset();
  mockStore.mockReset();
});

describe('startBackgroundRecognition', () => {
  it('creates a job and persists its id', async () => {
    mockCreate.mockResolvedValue({ job_id: 'job-9' });
    const id = await startBackgroundRecognition({
      image_urls: ['u1'],
      document_urls: [],
      language: 'en',
      platform: 'LabGreenbidz',
    });
    expect(mockCreate).toHaveBeenCalled();
    expect(mockStore).toHaveBeenCalledWith('job-9');
    expect(id).toBe('job-9');
  });
});
