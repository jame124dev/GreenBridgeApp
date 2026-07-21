// buildLabChatDraftReq — pure builder for the `CreateDraftReq` the live chat
// screen's "Save as draft" affordance (Task 17) sends. Extracted out of
// chat.tsx so the request shape is unit-testable without mounting the whole
// chat screen (which pulls in the full controller/stream stack).
//
// Two contracts this MUST hold (see src/features/lab/__tests__/labSaveDraft.test.ts
// for the sibling draft.tsx coverage of the same rules):
//   - the top-level `mode` field the backend's createDraft endpoint accepts is
//     ONLY 'single' | 'multi' (a lab listing/request is always one product) —
//     the real sell/buy distinction rides inside `payload.mode`, stamped by
//     `buildLabDraftPayload`. Never put 'sell'/'buy' at the top level.
//   - `buildLabDraftPayload` only reads `frame.title` (top level), but the lab
//     chat frame (a `listing_draft`/`wtb_draft` card payload) nests the title at
//     `draft.fields.product_title.value` — so its own title guess falls through
//     to "Untitled listing"/"Buying request". `draftFromFrame` already
//     defensively extracts a real display title off that nested shape (it's
//     what feeds the Draft Review screen's title), so we prefer ITS title and
//     only fall back to buildLabDraftPayload's guess if that's somehow empty.
import type { CreateDraftReq } from '@/services/drafts/draftApi';
import { buildLabDraftPayload } from '@/services/drafts/draftPayload';
import { draftFromFrame } from '@/features/lab/data/draftFromFrame';
import type { ComposerMode } from '@/features/lab/stores/composerStore';

export function buildLabChatDraftReq(
  frame: unknown,
  mode: ComposerMode,
  siteType: string,
): CreateDraftReq {
  const built = buildLabDraftPayload(frame, mode);
  const title = draftFromFrame(frame, mode)?.title || built.title;
  return {
    session_uuid: `lab-${mode}-${Date.now()}`,
    flow: 'ai',
    mode: 'single', // top-level contract — NOT the lab sell/buy mode, see note above
    title,
    site_type: siteType,
    product_count: 1,
    payload: built.payload,
  };
}
