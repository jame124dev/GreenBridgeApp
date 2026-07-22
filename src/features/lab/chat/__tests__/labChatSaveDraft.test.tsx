// Task 17 — "Save as draft" in the live lab CHAT flow.
//
// On-device testing found that with LAB_CHAT_ENABLED=1 the reachable chat
// screen (app/(lab)/chat.tsx) has no Save-as-draft affordance — Task 12's
// button lives only on app/(lab)/draft.tsx, which that flow bypasses. This
// locks the CONTRACT of the extracted pure request-builder the screen's
// handler calls (`buildLabChatDraftReq`), so the fix is verifiable without
// mounting the whole chat screen (which pulls in the full controller/stream
// stack — explicitly out of scope per the task brief).
//
// Two things this must prove:
//   1. the top-level `mode` sent to createDraft is ALWAYS 'single' — never
//      the lab sell/buy mode (that contract is load-bearing: Task 13 tells
//      lab drafts apart from scan drafts via `payload.mode`, not top-level
//      `mode`, which the backend only ever accepts as 'single'|'multi').
//   2. the title is a REAL title pulled from the frame's nested
//      `fields.product_title.value` — not the generic "Untitled listing" /
//      "Buying request" fallback `buildLabDraftPayload` produces on its own
//      (it only reads `frame.title` at the top level, which the lab chat
//      frame never sets).
import { describe, it, expect } from '@jest/globals';
import { buildLabChatDraftReq } from '@/features/lab/chat/draftReq';

/** A `listing_draft` card payload shape, as folded into `chat.latestDraft` by
 *  `computeLatestDraft` (turnFold.ts) — fields keyed with `{ value, confidence }`. */
function labFrame(title: string) {
  return {
    fields: {
      product_title: { value: title, confidence: 0.92 },
    },
    missing_required: [],
    low_confidence: [],
  };
}

// Fixed per-conversation id these tests pass explicitly (follow-up #4) — a
// stable stand-in for `useSession.getState().getConversationId()`, which the
// real callers (chat.tsx, draft.tsx) supply from the persisted MMKV session.
const CONV_ID = 'lab-test-conv-id';

describe('buildLabChatDraftReq', () => {
  it('sends the single-product top-level mode contract, regardless of sell/buy', () => {
    const sell = buildLabChatDraftReq(labFrame('Agilent 1260 HPLC'), 'sell', '101lab', CONV_ID);
    const buy = buildLabChatDraftReq(labFrame('−80°C Freezer'), 'buy', '101lab', CONV_ID);
    expect(sell.mode).toBe('single');
    expect(buy.mode).toBe('single');
  });

  it('flags the request as an AI-flow, single-product draft', () => {
    const req = buildLabChatDraftReq(labFrame('Agilent 1260 HPLC'), 'sell', '101lab', CONV_ID);
    expect(req.flow).toBe('ai');
    expect(req.product_count).toBe(1);
  });

  it('extracts a real title from the frame nested product_title, not "Untitled…"', () => {
    const sell = buildLabChatDraftReq(labFrame('Agilent 1260 HPLC'), 'sell', '101lab', CONV_ID);
    const buy = buildLabChatDraftReq(labFrame('−80°C Freezer'), 'buy', '101lab', CONV_ID);
    expect(sell.title).toBe('Agilent 1260 HPLC');
    expect(sell.title).not.toBe('Untitled listing');
    expect(buy.title).toBe('−80°C Freezer');
    expect(buy.title).not.toBe('Buying request');
  });

  // `draftFromFrame` is TOTAL — even given an empty/missing frame it returns
  // the static `DRAFT_DATA[mode]` shell (never an empty string), so its title
  // wins over `buildLabDraftPayload`'s own "Untitled listing"/"Buying request"
  // guess in this branch too (same as the already-shipped draft.tsx Save
  // handler, which reads title the same way). Non-empty + mode-coherent is
  // what actually matters here — never the literal generic string.
  it('falls back to the static mode-shell title when the frame has no title anywhere', () => {
    const sell = buildLabChatDraftReq({}, 'sell', '101lab', CONV_ID);
    const buy = buildLabChatDraftReq(undefined, 'buy', '101lab', CONV_ID);
    expect(sell.title.length).toBeGreaterThan(0);
    expect(buy.title.length).toBeGreaterThan(0);
    expect(sell.title).not.toBe('Untitled listing');
    expect(buy.title).not.toBe('Buying request');
  });

  it('stamps the real sell/buy distinction onto payload.mode (not the top-level mode)', () => {
    const sell = buildLabChatDraftReq(labFrame('Agilent 1260 HPLC'), 'sell', '101lab', CONV_ID);
    const buy = buildLabChatDraftReq(labFrame('−80°C Freezer'), 'buy', '101lab', CONV_ID);
    expect((sell.payload as { mode: string }).mode).toBe('sell');
    expect((buy.payload as { mode: string }).mode).toBe('buy');
    expect((sell.payload as { kind: string }).kind).toBe('form-blob');
  });

  it('carries the raw frame through as payload.labDraft and passes site_type through', () => {
    const frame = labFrame('Agilent 1260 HPLC');
    const req = buildLabChatDraftReq(frame, 'sell', '101lab', CONV_ID);
    expect((req.payload as { labDraft: unknown }).labDraft).toBe(frame);
    expect(req.site_type).toBe('101lab');
  });

  // Follow-up #4: session_uuid must be the STABLE per-conversation id (not
  // `Date.now()`) so repeat "Save as draft" taps in the same conversation
  // UPSERT one backend row instead of minting duplicates.
  it('derives a stable session_uuid from the conversation id (no Date.now())', () => {
    const req = buildLabChatDraftReq(labFrame('Agilent 1260 HPLC'), 'sell', '101lab', CONV_ID);
    expect(req.session_uuid).toBe(CONV_ID); // conversation id is already lab-namespaced; used directly
    const again = buildLabChatDraftReq(labFrame('Agilent 1260 HPLC'), 'sell', '101lab', CONV_ID);
    expect(again.session_uuid).toBe(req.session_uuid); // stable across repeat calls
  });
});
