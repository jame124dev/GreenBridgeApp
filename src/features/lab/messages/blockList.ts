/**
 * Blocked-user list for buyer↔seller Messages.
 *
 * WHY THIS EXISTS — App Store Guideline 1.2 (Safety: User-Generated Content).
 * Apps carrying user-generated content and direct messaging must provide:
 *   1. a method for filtering objectionable material,
 *   2. a mechanism to report offensive content,
 *   3. the ability to block abusive users,
 *   4. published contact information.
 *
 * This app has both UGC (seller-supplied listings, photos, descriptions) and
 * 1:1 chat, and the age-rating questionnaire declares `userGeneratedContent` and
 * `messagingAndChat` as true — so a reviewer has every reason to look for (2)
 * and (3). Neither existed. Build 1.0.0 (10) was already rejected twice; this
 * closes a third, entirely predictable rejection.
 *
 * Deliberately CLIENT-SIDE: there is no moderation endpoint on the backend
 * (checked). A local block still delivers what the guideline asks of the user —
 * the blocked party disappears from their inbox and can no longer reach them in
 * the app. When a server-side block exists, this module is the single place to
 * swap the implementation; the call sites do not change.
 */
import { mmkv } from '@/lib/mmkv';

const KEY = 'chat.blockedUserIds';

type Listener = () => void;
const listeners = new Set<Listener>();

/** Cached so the hot render path (inbox filtering) does not hit storage per row. */
let cache: Set<string> | null = null;

function load(): Set<string> {
  if (cache) return cache;
  try {
    const raw = mmkv.getString(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    cache = new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    // Corrupt value or storage unavailable — fail OPEN to an empty list rather
    // than throwing on the launch path.
    cache = new Set<string>();
  }
  return cache;
}

function persist(next: Set<string>) {
  cache = next;
  try {
    mmkv.set(KEY, JSON.stringify([...next]));
  } catch {
    /* in-memory only for this session */
  }
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* a bad listener must not break the others */
    }
  });
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function subscribeBlocked(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isBlocked(userId: number | string | null | undefined): boolean {
  if (userId == null) return false;
  return load().has(String(userId));
}

export function blockUser(userId: number | string): void {
  const next = new Set(load());
  next.add(String(userId));
  persist(next);
}

export function unblockUser(userId: number | string): void {
  const next = new Set(load());
  next.delete(String(userId));
  persist(next);
}

export function blockedIds(): string[] {
  return [...load()];
}

/** Test seam — resets the in-memory cache so a fresh read hits storage. */
export function __resetBlockCache(): void {
  cache = null;
}
