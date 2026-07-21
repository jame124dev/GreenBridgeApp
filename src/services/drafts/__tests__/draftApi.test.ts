// src/services/drafts/__tests__/draftApi.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// NOTE: the brief's literal test closes the jest.mock() factory over
// module-scope `const post = jest.fn()` / `const get = jest.fn()` declared
// BEFORE the mocked import. That throws two different failures in this repo's
// babel/jest setup:
//  1) babel-plugin-jest-hoist's "Invalid variable access" guard — a factory
//     may only close over names prefixed with "mock" (case-insensitive).
//  2) even renamed to `mockPost`/`mockGet`, the assignment still runs AFTER
//     the transpiled `require()` for the mocked-import chain (imports are
//     hoisted above plain `const` statements), so the factory captures the
//     `var`-hoisted-but-not-yet-assigned value (undefined) — `greenbidz.post`
//     ends up `undefined`, not the jest.fn().
// Fixed by creating the jest.fn()s INSIDE the factory (no outer closure) and
// grabbing references via the mocked `greenbidz` import itself afterwards —
// the standard jest pattern that sidesteps both hoisting pitfalls.
jest.mock('@/api/greenbidzClient', () => ({
  greenbidz: { post: jest.fn(), get: jest.fn(), put: jest.fn(), delete: jest.fn(), patch: jest.fn() },
}));

import { greenbidz } from '@/api/greenbidzClient';
import { createDraft, getDraft, listDrafts } from '@/services/drafts/draftApi';

// Explicit generic: the default `jest.Mock` (T = UnknownFunction, returning
// `unknown`) makes `mockResolvedValue`'s parameter type `never` (jest-mock's
// `ResolveType<T>` only unwraps a `PromiseLike<U>` return type). Typing the
// mock as an async function returning `{ data: unknown }` (the axios response
// shape both draftApi.ts and this test care about) fixes that.
type AxiosLikeMock = jest.Mock<(...args: unknown[]) => Promise<{ data: unknown }>>;
const mockPost = greenbidz.post as AxiosLikeMock;
const mockGet = greenbidz.get as AxiosLikeMock;

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
});

describe('draftApi', () => {
  // Real backend shape (verified against draftController.js `createDraftController` +
  // its `formatDraftMetadata()` helper, 101recycle-greenbidz-backend): the response
  // `data` is METADATA ONLY — id, share_token, title, flow, draft_kind, mode,
  // site_type, product_count, status, thumbnail_object, schema_version,
  // share_enabled, created_at, updated_at. It never includes `session_uuid`
  // (not in the whitelist) or `payload` (only `getDraft` returns a parsed
  // payload, via `formatDraftFull`). This mock intentionally omits both so the
  // test doesn't validate a shape the real backend never sends.
  it('createDraft posts to /drafts and unwraps the metadata-only response', async () => {
    mockPost.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'd1',
          flow: 'ai',
          mode: 'single',
          title: 'X',
          product_count: 1,
          status: 'active',
          draft_kind: 'form-blob',
          thumbnail_object: null,
          updated_at: 't',
        },
      },
    });
    const out = await createDraft({
      session_uuid: 's1',
      flow: 'ai',
      mode: 'single',
      title: 'X',
      site_type: 'LabGreenbidz',
      product_count: 1,
      payload: { kind: 'form-blob' },
    });
    expect(mockPost).toHaveBeenCalledWith('/drafts', expect.objectContaining({ session_uuid: 's1' }));
    expect(out.id).toBe('d1');
    // Documents the real gap: the create response has no payload/session_uuid,
    // even though the DraftDetail/DraftSummary types declare them as required.
    expect(out.payload).toBeUndefined();
    expect(out.session_uuid).toBeUndefined();
  });

  // getDraft is the ONLY endpoint whose response includes a parsed `payload`
  // (formatDraftFull = {...formatDraftMetadata(draft), payload}). This test
  // enforces that claim rather than leaving it comment-only.
  it('getDraft fetches /drafts/:id and unwraps data including payload', async () => {
    mockGet.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'd1',
          flow: 'ai',
          mode: 'single',
          title: 'X',
          product_count: 1,
          status: 'active',
          draft_kind: 'form-blob',
          thumbnail_object: null,
          updated_at: 't',
          payload: { kind: 'form-blob', title: 'X' },
        },
      },
    });
    const out = await getDraft('d1');
    expect(mockGet).toHaveBeenCalledWith('/drafts/d1');
    expect(out.id).toBe('d1');
    expect(out.payload).toEqual({ kind: 'form-blob', title: 'X' });
  });

  // Real backend shape (verified against draftController.js `listDraftsController`,
  // 101recycle-greenbidz-backend): `data` IS the drafts array itself, and
  // `next_cursor` is a SIBLING of `data` at the top level of the response body —
  // NOT nested as `{ drafts, next_cursor }` inside `data` as originally assumed.
  // The cursor is the Sequelize numeric draft PK; normalized to string here to
  // match the declared `next_cursor: string | null` type.
  it('listDrafts passes cursor and unwraps the top-level drafts array + next_cursor', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: [{ id: 1 }], next_cursor: 2 } });
    const out = await listDrafts('c1');
    expect(mockGet).toHaveBeenCalledWith('/drafts', { params: { cursor: 'c1' } });
    expect(out.drafts).toHaveLength(1);
    expect(out.next_cursor).toBe('2');
  });

  it('listDrafts returns next_cursor null on the last page (backend sends null)', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: [], next_cursor: null } });
    const out = await listDrafts();
    expect(out.drafts).toHaveLength(0);
    expect(out.next_cursor).toBeNull();
  });
});
