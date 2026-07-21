// src/features/lab/labResumeRoute.ts
//
// Task 13 (scope-changed): distinguishes lab drafts from seller drafts by the
// FETCHED payload, not the shared drafts summary's top-level `mode`.
//
// Task 2 established that every draft row — seller AND lab — carries a
// top-level `mode: 'single' | 'multi'` (the backend 400s on anything else at
// create time). The real lab sell/buy distinction only lives one level down,
// inside `payload.mode` (stamped by `buildLabDraftPayload`,
// `src/services/drafts/draftPayload.ts`, Task 6/12): `{ kind: 'form-blob',
// labDraft: frame, mode: 'sell' | 'buy' }`.
//
// The drafts LIST (`useListDrafts` → `GET /drafts`) only returns
// `DraftSummary` rows — no `payload` (see `listDraftsController`'s
// `formatDraftMetadata`, which never selects it). So `isLabDraft` cannot run
// on a list row. It's meant to run on the result of `getDraft(id)`
// (`GET /drafts/:id` → `formatDraftFull`), which DOES include the parsed
// `payload` — exactly what `app/scan/drafts.tsx`'s `onResume` already fetches
// before branching seller vs lab.
export function isLabDraft(detail: { payload?: unknown }): boolean {
  const payload = detail.payload as
    | { kind?: unknown; mode?: unknown; labDraft?: unknown }
    | null
    | undefined;
  if (!payload || typeof payload !== 'object') return false;
  // `PendingAiPayload['mode']` is typed `'single' | 'multi' | 'sell' | 'buy'`
  // for forward-compat, but a `pending-ai` (background-recognition, Task
  // 10/11) draft never carries a `labDraft` frame — guard the `kind` first so
  // a hypothetical future pending-ai draft stamped `mode: 'sell'|'buy'` is
  // never misrouted to the lab draft screen.
  if (payload.kind === 'pending-ai') return false;
  return payload.mode === 'sell' || payload.mode === 'buy' || payload.labDraft !== undefined;
}

/** Where a resumed lab draft lands — always the lab draft screen. */
export function labResumeRoute(): string {
  return '/(lab)/draft';
}
