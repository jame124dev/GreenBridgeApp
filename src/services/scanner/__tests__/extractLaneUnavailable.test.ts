/**
 * The document lane, when the server does not have it.
 *
 * There are TWO ways the lane can be absent and they arrive differently, which
 * is the whole reason this file exists:
 *
 *   flag off  → 2xx with a null `jobId`  (SCANV2_DURABLE_EXTRACT unset)
 *   not built → 404 from `/gcs/resumable/create`
 *
 * Both must reach the seller as the same plain sentence. The 404 used to
 * surface as axios' "Request failed with status code 404" — a sentence about
 * HTTP, shown in the middle of uploading a spreadsheet.
 *
 * Only the `create` step is exercised: both cases fail there, before any bytes
 * move, so no GCS PUT is involved and the file reader is never reached.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

/**
 * `runExtractLane` reads the file before it calls `create`, and the real reader
 * uses `fetch` + `Blob`, neither of which the jest env provides. Stubbing it to
 * a tiny blob keeps the test about the SERVER's answer.
 */
global.fetch = jest.fn(async () => ({
  // `ok` is load-bearing: `readBytes` throws "Could not read the staged file"
  // on a falsy one, which fails BEFORE the request under test and makes every
  // case in this file fail for the wrong reason.
  ok: true,
  status: 200,
  blob: async () => ({ size: 1024, type: 'application/vnd.ms-excel' }),
})) as unknown as typeof fetch;

import { greenbidz } from '@/api/greenbidzClient';
import { runExtractLane } from '../extractLane';

interface LooseMock {
  mockReset: () => void;
  mockRejectedValue: (value: unknown) => void;
  mockResolvedValue: (value: unknown) => void;
}
const api = greenbidz as unknown as { get: LooseMock; post: LooseMock; put: LooseMock };

const FILE = { uri: 'file:///tmp/seller-list.xlsx', name: 'seller-list.xlsx' };
const MESSAGE = 'The document lane is not enabled on this server.';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
});

describe('runExtractLane when the lane is absent', () => {
  it('says so in plain words when the route is NOT DEPLOYED (404)', async () => {
    api.post.mockRejectedValue({ response: { status: 404 } });

    await expect(runExtractLane(574, FILE)).rejects.toThrow(MESSAGE);
  });

  it('says the SAME thing when the flag is off (2xx, null jobId)', async () => {
    // The shape `create` returns with SCANV2_DURABLE_EXTRACT unset.
    api.post.mockResolvedValue({ data: { data: { jobId: null, sessionId: null, files: [] } } });

    await expect(runExtractLane(574, FILE)).rejects.toThrow(MESSAGE);
  });

  /**
   * The guard must not swallow real failures into a misleading "not enabled".
   * A 500 is the server being broken, not the lane being absent, and telling a
   * seller their server lacks the feature would send them to the wrong person.
   */
  it('does NOT claim "not enabled" for other failures', async () => {
    api.post.mockRejectedValue({ response: { status: 500 }, message: 'Internal Server Error' });

    await expect(runExtractLane(574, FILE)).rejects.not.toThrow(MESSAGE);
  });

  /** No probe request. The old `isExtractLaneAvailable()` added one per upload. */
  it('reaches the server exactly once before giving up', async () => {
    api.post.mockRejectedValue({ response: { status: 404 } });

    await expect(runExtractLane(574, FILE)).rejects.toThrow();
    expect((api.post as unknown as { mock: { calls: unknown[][] } }).mock.calls).toHaveLength(1);
  });
});
