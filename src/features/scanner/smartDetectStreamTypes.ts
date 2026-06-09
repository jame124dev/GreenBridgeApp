/**
 * Typed payloads for the Smart-Detect v2 SSE control plane
 * (POST /api/v1/wp/analyze-smart-detection-v2).
 *
 * Mirrors the backend event taxonomy in
 * `101recycle-greenbidz-backend/docs/SMART_DETECT_V2_SSE_PLAN.md` §3.
 * Each is the parsed JSON from one SSE frame's `data:` line. The `result`
 * event's payload is the v1 `SmartDetectionResponse` (mapped via the existing
 * `mapSmartDetection`), so it isn't redeclared here.
 */

/** Phase enum carried on `stage` events (backend §3 "Phase").
 *  Phase 2 (Office docs): `preparing_documents` is the canonical name; the
 *  backend keeps `preparing_pdfs` as a deprecated alias for ONE release
 *  (`smartDetectI18n.js:32-37`). Both phases share identical localized templates
 *  and must map to the same step in the UI — see `TIMELINE` in `processing-v2.tsx`
 *  and `PHASE_TO_STEP` in `processing.tsx`. */
export type StagePhase =
  | 'validating'
  | 'preparing_documents'
  | 'preparing_pdfs'
  | 'ai_running'
  | 'extracting_products'
  | 'done';

export type StageEvent = {
  phase: StagePhase;
  message?: string;
  /** Present on `preparing_documents` / `preparing_pdfs` (doc count) and `extracting_products` (product count). */
  total?: number;
  current?: number;
  ts?: number;
};

export type DetectionEvent = {
  suggested_mode: 'single' | 'multiple';
  confidence: number;
  summary: string;
  product_count: number;
};

export type ProductEvent = {
  index: number;
  id?: string | number;
  /** null when this product's extraction failed after retries (see `error`). */
  data: unknown | null;
  image_indexes: number[];
  document_indexes: number[];
  error?: { code: string; message: string; context?: unknown };
};

export type PdfPagesEvent = {
  documentIndex: number;
  pages: {
    index: number;
    page: number;
    objectName?: string;
    gcsUri?: string;
    url: string;
    width: number;
    height: number;
  }[];
};

/**
 * Machine-readable codes emitted on `error` SSE events. The string union stays
 * open (`string & {}`) for forward-compat — backend may add new codes without
 * breaking the client. New Phase 2 (Office docs) codes are listed last.
 */
export type StreamErrorCode =
  | 'pdf_fetch_failed'
  | 'gcs_upload_failed'
  | 'no_readable_input'
  | 'ai_unavailable'
  | 'deadline_exceeded'
  | 'too_many_concurrent'
  | 'cancelled'
  | 'internal_error'
  | 'product_extraction_failed'
  // Phase 2 — Office docs (non-fatal; the stream continues to `result`):
  | 'unsupported_document_format'
  | 'document_too_large'
  | 'document_parse_failed'
  | 'document_extraction_timeout'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

/** Typed `context` shape for `unsupported_document_format` rejections. */
export type UnsupportedDocumentFormatContext = {
  name: string;
  reason: 'cfb_legacy_or_encrypted' | 'macro_enabled' | 'xlsb_binary';
};

/** Typed `context` shape for `document_too_large` rejections. */
export type DocumentTooLargeContext = {
  name: string;
  size: number;
  limit: number;
};

/** Typed `context` shape for `document_parse_failed` rejections. `reason` is
 *  open because the backend may add classifiers (`xxe_blocked`, etc.). */
export type DocumentParseFailedContext = {
  name: string;
  reason?: string;
};

/** Typed `context` shape for `document_extraction_timeout` rejections. */
export type DocumentExtractionTimeoutContext = {
  name: string;
};

/**
 * `error` SSE event. `fatal: true` terminates the stream; `fatal: false`
 * (e.g. one PDF failed to fetch, one office doc rejected, one product failed)
 * is informational and the stream continues to a `result`.
 */
export type StreamErrorEvent = {
  fatal: boolean;
  code: StreamErrorCode;
  message: string;
  retriable?: boolean;
  context?: unknown;
};

/**
 * Discriminated union handed to the optional `onEvent` sink so the UI can
 * render live progress. `result` is intentionally NOT here — it resolves the
 * transport promise, it isn't a progress tick.
 */
export type SmartStreamEvent =
  | { type: 'stage'; data: StageEvent }
  | { type: 'detection'; data: DetectionEvent }
  | { type: 'product'; data: ProductEvent }
  | { type: 'pdf_pages'; data: PdfPagesEvent }
  | { type: 'error'; data: StreamErrorEvent };

/** Named SSE events we subscribe to (backend §3). `heartbeat` resets the
 *  watchdog only — no UI, so it's handled separately, not in SmartStreamEvent. */
export const SMART_STREAM_EVENT_NAMES = [
  'stage',
  'pdf_pages',
  'detection',
  'product',
  'result',
  'error',
  'heartbeat',
] as const;
