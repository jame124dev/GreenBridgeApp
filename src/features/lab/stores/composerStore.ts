// Shared composer state for the (lab) customer-app AI flow
// (NewVersion/00-foundation.md, spec 01-home-tell-ai). The Home composer sets
// `mode` (sell|buy) and `input`; downstream screens (processing/draft/…) read
// `mode` to pick sell vs buy copy/accents. UI state only — no persistence in v1.
import { create } from 'zustand';

export type ComposerMode = 'sell' | 'buy';

/**
 * A staged, pre-upload attachment (object URI / picked file). Local only —
 * GCS upload happens inside the turn (NewVersion/dynamic/04 §3.1). `isImage`
 * routes to `image_urls` vs `document_urls` at upload/stream time.
 */
export type ComposerAttachment = { uri: string; name: string; isImage: boolean };

type ComposerState = {
  mode: ComposerMode;
  input: string;
  /** Staged local attachments (pre-upload). Drives detect-vs-chat endpoint. */
  attachments: ComposerAttachment[];
  setMode: (mode: ComposerMode) => void;
  toggleMode: () => void;
  setInput: (input: string) => void;
  addAttachment: (attachment: ComposerAttachment) => void;
  removeAttachment: (uri: string) => void;
  /** Drop all staged attachments (called right after a turn reads them, so they
   *  don't leak into the next text-only turn). */
  clearAttachments: () => void;
  /**
   * What the most recent turn actually SENT, recorded as `clearAttachments()`
   * empties the staging area.
   *
   * Exists because the Home composer starts its turn and then navigates to the
   * chat screen, whose mount-time `seed()` OVERWRITES the conversation — so the
   * chat cannot learn what was sent from the staged list (already cleared) and
   * Home cannot pre-append it (would be wiped). See `seedMessages.ts`: without
   * this, an image sent from Home with no caption vanished entirely.
   */
  lastSentAttachments: ComposerAttachment[];
  reset: () => void;
};

export const useComposer = create<ComposerState>((set) => ({
  mode: 'sell',
  input: '',
  attachments: [],
  lastSentAttachments: [],
  setMode: (mode) => set({ mode }),
  toggleMode: () => set((s) => ({ mode: s.mode === 'sell' ? 'buy' : 'sell' })),
  setInput: (input) => set({ input }),
  addAttachment: (attachment) => set((s) => ({ attachments: [...s.attachments, attachment] })),
  removeAttachment: (uri) =>
    set((s) => ({ attachments: s.attachments.filter((a) => a.uri !== uri) })),
  // Hand the staged list over to `lastSentAttachments` rather than dropping it:
  // the turn that just consumed them is the one the chat screen must render.
  clearAttachments: () => set((s) => ({ attachments: [], lastSentAttachments: s.attachments })),
  reset: () => set({ mode: 'sell', input: '', attachments: [], lastSentAttachments: [] }),
}));
