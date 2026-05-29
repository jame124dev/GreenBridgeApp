import { useCallback, useSyncExternalStore } from 'react';

import { mmkv } from '@/lib/mmkv';

// Local-only notification preferences. No backend call yet because the
// push-notifications backend isn't wired (see STARTER_KIT.md §3 — `expo-
// notifications` is in the dep list but server-side prefs API doesn't exist).
// When the backend ships, swap the MMKV-only `setPreference` for a React
// Query mutation that also persists locally for offline edits.

const KEY_PREFIX = 'settings.notifications.';

export type NotificationKey = 'bidReceived' | 'offerReceived' | 'paymentStatus';

export type NotificationPreferences = Record<NotificationKey, boolean>;

const KEYS: NotificationKey[] = ['bidReceived', 'offerReceived', 'paymentStatus'];

// Defaults: opt-in to everything on first install. The user can opt out via
// the card. This matches industry norm — Mercari/eBay both default critical
// transactional notifications on.
const DEFAULTS: NotificationPreferences = {
  bidReceived: true,
  offerReceived: true,
  paymentStatus: true,
};

function storageKey(key: NotificationKey) {
  return `${KEY_PREFIX}${key}`;
}

function readAll(): NotificationPreferences {
  const out = { ...DEFAULTS };
  for (const key of KEYS) {
    const raw = mmkv.getBoolean(storageKey(key));
    if (raw !== undefined) out[key] = raw;
  }
  return out;
}

// MMKV emits change events per-key. useSyncExternalStore gives us tear-free
// reads across multiple subscribers (e.g. if a future status pill in the
// header reads the same prefs).
//
// Critical SSR detail: Expo Router renders web routes on Node during dev,
// where MMKV's web backend (localStorage) doesn't exist and throws "Tried to
// access storage on the server. Did you forget to call this in useEffect?"
// So `cachedSnapshot` starts null and only hydrates from MMKV on the first
// client-side `getSnapshot` call. `getServerSnapshot` returns DEFAULTS so
// SSR never touches storage.
const listeners = new Set<() => void>();
let cachedSnapshot: NotificationPreferences | null = null;

function emit() {
  // Only re-read storage if we've already hydrated on the client. setPreference
  // is the only caller and it's user-event-driven (never fires during SSR),
  // so this branch is defensive.
  if (cachedSnapshot !== null) cachedSnapshot = readAll();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): NotificationPreferences {
  if (cachedSnapshot === null) cachedSnapshot = readAll();
  return cachedSnapshot;
}

function getServerSnapshot(): NotificationPreferences {
  return DEFAULTS;
}

export function useNotificationPreferences() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setPreference = useCallback((key: NotificationKey, value: boolean) => {
    mmkv.set(storageKey(key), value);
    emit();
  }, []);

  return { prefs, setPreference };
}
