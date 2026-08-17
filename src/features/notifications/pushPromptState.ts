/**
 * "Have we already asked for push permission on this install?"
 *
 * The OS only ever shows the system prompt once; everything after that is the
 * app nagging. Persisting the ask in MMKV (the app's storage layer, same
 * pattern as `useNotificationPreferences`) means a decline is remembered across
 * launches and the automatic prompt never fires a second time — the user
 * re-enables from Settings instead.
 */
import { mmkv } from '@/lib/mmkv';

const ASKED_KEY = 'notifications.permissionAsked';

/** MMKV throws on Expo web's static prerender (no storage on the server), and a
 *  storage read must never be the reason a screen fails to mount — so both
 *  accessors fail closed: "already asked" on a read error means we stay quiet. */
export function hasAskedForPush(): boolean {
  try {
    return mmkv.getBoolean(ASKED_KEY) === true;
  } catch {
    return true;
  }
}

export function markPushAsked(): void {
  try {
    mmkv.set(ASKED_KEY, true);
  } catch {
    /* best-effort */
  }
}
