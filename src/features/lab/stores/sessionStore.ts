// Conversation identity for the (lab) customer-app AI flow
// (NewVersion/dynamic/04-mobile-integration-plan.md §3.2,
// 06-roadmap-risks.md P1). Mirrors the web "one conversation per browser"
// model (`gb_ai_conv_id` in localStorage) — mobile persists ONE opaque
// conversation_id per install in MMKV, minted lazily on first use and reused
// across every turn (chat + detect) so Home and downstream screens share the
// thread. `reset()` starts a fresh conversation ("start over").
//
// Zustand + MMKV, same persistence pattern as `src/stores/authStore.ts`.
import { create } from 'zustand';

import { mmkv } from '@/lib/mmkv';

const CONV_KEY = 'lab.conversationId';
/** Assistant contract caps `conversation_id` at 128 chars (03-api-contract §1.2). */
const MAX_CONV_ID_LEN = 128;

/**
 * RFC-4122-ish v4 uuid. Prefers the platform CSPRNG (`crypto.getRandomValues`,
 * present on Hermes/modern RN) for real entropy; falls back to `Math.random`
 * (matches the existing `scanDraftStore.newDraftId` fallback style) when it
 * isn't available. The id is opaque to the server, so a non-crypto fallback is
 * acceptable — it only needs to be collision-free per install.
 */
function makeConversationId(): string {
  const g = globalThis as unknown as {
    crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array };
  };
  const bytes = new Uint8Array(16);
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Version (4) and variant (10xx) bits per RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  const uuid = `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
    .slice(6, 8)
    .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  return `lab-${uuid}`.slice(0, MAX_CONV_ID_LEN);
}

type SessionState = {
  /** Null until first `getConversationId()` mints + persists one. */
  conversationId: string | null;
  /** Returns the persisted conversation_id, minting + persisting on first use. */
  getConversationId: () => string;
  /** Start a fresh conversation ("start over") — mints, persists, returns it. */
  reset: () => string;
};

export const useSession = create<SessionState>((set, get) => ({
  // Hydrate synchronously from MMKV so the id survives an app restart.
  conversationId: mmkv.getString(CONV_KEY) ?? null,

  getConversationId: () => {
    const existing = get().conversationId ?? mmkv.getString(CONV_KEY);
    if (existing) {
      if (get().conversationId !== existing) set({ conversationId: existing });
      return existing;
    }
    const id = makeConversationId();
    mmkv.set(CONV_KEY, id);
    set({ conversationId: id });
    return id;
  },

  reset: () => {
    const id = makeConversationId();
    mmkv.set(CONV_KEY, id);
    set({ conversationId: id });
    return id;
  },
}));
