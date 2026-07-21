import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/lib/mmkv', () => {
  const store = new Map<string, string>();
  return { mmkv: { set: (k: string, v: string) => store.set(k, v), getString: (k: string) => store.get(k), remove: (k: string) => store.delete(k) } };
});

import { storeJobId, getStoredJobId, clearStoredJobId } from '@/stores/recognitionJobStore';

beforeEach(() => clearStoredJobId());

describe('recognitionJobStore', () => {
  it('round-trips a job id', () => {
    expect(getStoredJobId()).toBeNull();
    storeJobId('job-123');
    expect(getStoredJobId()).toBe('job-123');
    clearStoredJobId();
    expect(getStoredJobId()).toBeNull();
  });
});
