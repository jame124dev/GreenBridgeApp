/**
 * MMKV is a Nitro/Turbo native module — there is no JS binary for it, so any
 * suite that transitively imports `@/lib/mmkv` (which now includes anything
 * touching `@/stores/authStore`) dies at import time with
 * "Failed to get NitroModules".
 *
 * Jest picks this file up automatically for the `react-native-mmkv` package
 * because it sits in a root `__mocks__/` adjacent to `node_modules` — no
 * `jest.mock()` call needed in each suite. Added when guest browsing made the
 * auth store a dependency of the seller-status hook and four suites broke at
 * once; mocking it in one place beats four copies that can drift.
 *
 * In-memory and per-process: the store resets between test files, which is what
 * a persisted-storage stub should do.
 */
function createMMKV() {
  const store = new Map();
  return {
    getString: (k) => (store.has(k) ? String(store.get(k)) : undefined),
    getNumber: (k) => (store.has(k) ? Number(store.get(k)) : undefined),
    getBoolean: (k) => (store.has(k) ? Boolean(store.get(k)) : undefined),
    set: (k, v) => void store.set(k, v),
    delete: (k) => void store.delete(k),
    contains: (k) => store.has(k),
    getAllKeys: () => Array.from(store.keys()),
    clearAll: () => void store.clear(),
  };
}

module.exports = { createMMKV, MMKV: createMMKV };
