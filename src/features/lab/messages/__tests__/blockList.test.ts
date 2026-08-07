/**
 * Blocked-user list — App Store Guideline 1.2 (UGC + messaging must let users
 * block abusive users). These tests pin the behaviour a reviewer would check:
 * blocking sticks, it survives a reload, and it can be undone.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockStore = new Map<string, string>();
jest.mock('@/lib/mmkv', () => ({
  __esModule: true,
  mmkv: {
    getString: (k: string) => mockStore.get(k),
    set: (k: string, v: string) => void mockStore.set(k, v),
    remove: (k: string) => void mockStore.delete(k),
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const load = () => require('../blockList');

beforeEach(() => {
  mockStore.clear();
  jest.resetModules();
});

describe('blockList', () => {
  it('reports nobody blocked initially', () => {
    const { isBlocked } = load();
    expect(isBlocked(877)).toBe(false);
  });

  it('blocks a user and reports them blocked', () => {
    const { blockUser, isBlocked } = load();
    blockUser(574);
    expect(isBlocked(574)).toBe(true);
    // numeric and string ids must agree — the API returns ids as both
    expect(isBlocked('574')).toBe(true);
  });

  it('leaves other users unaffected', () => {
    const { blockUser, isBlocked } = load();
    blockUser(574);
    expect(isBlocked(877)).toBe(false);
  });

  it('persists across a reload (survives app restart)', () => {
    const first = load();
    first.blockUser(574);
    // simulate a fresh launch: new module instance, same storage
    jest.resetModules();
    const second = load();
    expect(second.isBlocked(574)).toBe(true);
  });

  it('unblocks', () => {
    const { blockUser, unblockUser, isBlocked } = load();
    blockUser(574);
    unblockUser(574);
    expect(isBlocked(574)).toBe(false);
  });

  it('notifies subscribers so open screens update immediately', () => {
    const { blockUser, subscribeBlocked } = load();
    const seen = jest.fn();
    const off = subscribeBlocked(seen);
    blockUser(574);
    expect(seen).toHaveBeenCalledTimes(1);
    off();
    blockUser(999);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('treats null/undefined ids as not blocked rather than throwing', () => {
    const { isBlocked } = load();
    expect(isBlocked(null)).toBe(false);
    expect(isBlocked(undefined)).toBe(false);
  });

  it('fails open on a corrupt stored value instead of throwing on launch', () => {
    mockStore.set('chat.blockedUserIds', '{not json');
    const { isBlocked, blockedIds } = load();
    expect(isBlocked(574)).toBe(false);
    expect(blockedIds()).toEqual([]);
  });
});
