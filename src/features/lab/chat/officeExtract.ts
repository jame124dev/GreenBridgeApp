/**
 * Which staged files are OFFICE/SPREADSHEET documents — the files that must NOT
 * be sent to the photo-detect engine.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * `useLabTurn` routes a sell-mode turn with ANY attachment to `/detect/stream`,
 * the seller listing-detect engine. That engine is the vision/photo lane. Hand
 * it a 9 MB spreadsheet of equipment rows and it cannot do anything useful with
 * it — which is what a real seller file produced when tested on 2026-09-17.
 *
 * The web does not do this. `nextjs-port` classifies by file type first and
 * sends DOCX/PPTX/XLS(X)/CSV down a separate **durable extract lane**
 * (`POST /gcs/resumable/create` with a `clientDedupKey`, a resumable job keyed
 * on `UNIQUE(seller_id, client_dedup_key)`), and only photos and PDFs reach
 * detect. Mobile has no extract lane at all.
 *
 * ── THIS FILE IS A PORT, NOT A NEW RULE ────────────────────────────────────
 *
 * The predicate is copied from
 * `nextjs-port/src/features/seller/pages/new-submission-upload/utils/scanv2ExtractLane.ts`
 * (`OFFICE_EXTRACT_MIMES` + `OFFICE_EXTRACT_EXT`, read 2026-09-17) so the two
 * surfaces cannot disagree about what a spreadsheet is. If that file changes,
 * change this one in the same commit.
 *
 * ⚠️ Mobile has only the FILENAME. `Attachment` is `{ uri, isImage, name }`
 * (`chat/types/message.ts:17`) — no MIME — so only the extension half of the
 * web's rule can be applied here. That is the half that matters in practice:
 * the web comment records that browsers often send `application/octet-stream`
 * for office docs anyway, which is exactly why it has the fallback.
 *
 * The MIME set is kept below, unused, so the port is visibly complete and so
 * the day `Attachment` grows a `type` there is nothing to go and look up.
 */

/**
 * The web's MIME set, verbatim. **Currently unreferenced** — see the note above
 * about `Attachment` carrying no MIME. Do not delete it to satisfy a linter;
 * export it so it stays honest.
 */
export const OFFICE_EXTRACT_MIMES: ReadonlySet<string> = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Legacy .xls — two of the three real seller spreadsheets use it.
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
]);

/**
 * Extension rule, verbatim from the web.
 *
 * `xlsx?` rather than `xls|xlsx`, and the trailing `$` is load-bearing: it is
 * what stops the alternation matching mid-name (a file called
 * `csv-export-notes.pdf` is not a CSV).
 */
const OFFICE_EXTRACT_EXT = /\.(docx|pptx|xlsx?|csv)$/i;

/** Minimal shape needed — keeps this testable without the chat types. */
export interface OfficeExtractCandidate {
  name?: string | null;
  /** Present only if a caller has a MIME. `Attachment` does not. */
  type?: string | null;
}

/** True when this one file belongs to the office/extract lane, not detect. */
export function isOfficeExtractFile(file: OfficeExtractCandidate | null | undefined): boolean {
  if (!file) return false;
  return (
    OFFICE_EXTRACT_MIMES.has(String(file.type ?? '')) ||
    OFFICE_EXTRACT_EXT.test(String(file.name ?? ''))
  );
}

/** True when ANY staged file is an office document. */
export function hasOfficeExtractFile(
  files: readonly OfficeExtractCandidate[] | null | undefined,
): boolean {
  return (files ?? []).some(isOfficeExtractFile);
}

/** The office files in a staged set — for naming them in a message. */
export function officeExtractFiles<T extends OfficeExtractCandidate>(
  files: readonly T[] | null | undefined,
): T[] {
  return (files ?? []).filter(isOfficeExtractFile);
}
