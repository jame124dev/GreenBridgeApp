/**
 * Typed payloads for the (lab) customer-app AI streams — the ASSISTANT (Python
 * FastAPI) `POST /chat/stream` and `POST /detect/stream` SSE control planes.
 *
 * Modeled on the seller scanner's `SmartStreamEvent`
 * (`src/features/scanner/smartDetectStreamTypes.ts`) but for the assistant's
 * event catalog, which adds `token` / `data` (typed cards) / `done` / `warning`
 * on top of the scanner's stage/product frames. See
 * `NewVersion/dynamic/03-api-contract.md` §1.3/§2.2 and
 * `04-mobile-integration-plan.md` §1.5.
 *
 * Two load-bearing shape notes (verified against the assistant chat_adapter):
 *  - The `stage` frame's key is **`phase`** (NOT `stage`) — matches the scanner
 *    (`StagePhase`) and `app/detect/pipeline.py`.
 *  - The AI listing draft is a **`data` sub-type** (`{ type: 'listing_draft',
 *    data }`), NOT a top-level `draft` frame. `/detect/stream` may ALSO emit a
 *    cumulative `draft` frame, so both are modeled; consumers should treat
 *    `data{type:'listing_draft'}` as the canonical draft source.
 */

/** Phase enum carried on `stage` events. Shared with the scanner taxonomy
 *  (`preparing_pdfs` is a deprecated alias for `preparing_documents`). The
 *  union stays open (`string & {}`) for forward-compat with new phases. */
export type LabStagePhase =
  | 'validating'
  | 'preparing_documents'
  | 'preparing_pdfs'
  | 'ai_running'
  | 'extracting_products'
  | 'done'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

/**
 * `data` card `type` values the customer app cares about
 * (`03-api-contract.md` §1.4 / `04-mobile-integration-plan.md` §1.5.1). Kept
 * open (`string & {}`) so unknown/seller-only cards forward through untyped and
 * the dispatch switch can ignore them (forward-compatible).
 */
export type LabCardType =
  | 'listing_draft'
  | 'listing_created'
  | 'listing_gate'
  | 'listing_group_choice'
  | 'listing_queue'
  | 'wtb_draft'
  | 'wtb_request'
  | 'wtb_request_list'
  | 'wtb_matches'
  | 'wtb_gate'
  | 'product'
  | 'product_list'
  | 'handoff'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

/**
 * One row in a multi-product `listing_queue` overview or a `listing_group_choice`
 * chooser (frozen wire contract; emitted for `source in {bulk_template,
 * document_split}` and the multi-photo image path). `image_url` is `null` for
 * document-split items (they have no page thumbnail); `missing` is the count of
 * still-required fields for that item. `index` is **1-based**.
 */
export interface QueueItem {
  index: number;
  title: string;
  image_url: string | null;
  missing: number;
}

/**
 * `data{type:'listing_group_choice'}` payload — the one-time "found N products,
 * review separately or combine?" chooser (multi-photo image path). `first_payload`
 * is a `listing_draft` payload (the active item, also arriving as its own
 * `listing_draft` frame). `mode` marks which branch the server suggests.
 */
export interface GroupChoiceData {
  total: number;
  items: QueueItem[];
  first_payload: unknown;
  mode: 'separate_default' | 'combined_default';
}

/**
 * `data{type:'listing_queue'}` payload — the multi-product overview pager.
 * `index` is the CURRENT active 1-based position; `remaining` counts items not
 * yet published/reviewed. Emitted for `source in {bulk_template, document_split}`.
 */
export interface QueueData {
  total: number;
  index: number;
  remaining: number;
  items: QueueItem[];
}

/** `event: token` — one incremental prose delta (typing effect). */
export type LabTokenEvent = { delta: string };

/** `event: data` — a typed card. `data.type` selects the renderer; `data.data`
 *  is the card payload. Extra top-level hints (`identified`, `match_count`) may
 *  ride along and are preserved as optional fields. */
export type LabDataEvent = {
  type: LabCardType;
  data: unknown;
  identified?: unknown;
  match_count?: number;
};

/** `event: stage` — pipeline progress. Key is `phase` (NOT `stage`). */
export type LabStageEvent = {
  phase: LabStagePhase;
  message?: string;
  /** Doc/product count on `preparing_documents` / `extracting_products`. */
  total?: number;
  /** Current index within `total`. Backend has used both spellings. */
  cur?: number;
  current?: number;
  ts?: number;
};

/** `event: done` — terminal. Echo `conversation_id` back into the session store. */
export type LabDoneEvent = {
  used_tools?: string[];
  conversation_id?: string;
  [k: string]: unknown;
};

/** `event: warning` — non-blocking (e.g. `MAX_TURNS_EXCEEDED`); never terminal. */
export type LabWarningEvent = {
  code?: string;
  message?: string;
  [k: string]: unknown;
};

/**
 * `event: error`. The assistant is inconsistent about the message key — it may
 * send `detail`, `error`, or `message` — so all three are optional. `retriable`
 * / `fatal` drive the transport's settle-vs-continue decision.
 */
export type LabErrorEvent = {
  detail?: string;
  error?: string;
  message?: string;
  code?: string;
  retriable?: boolean;
  fatal?: boolean;
  [k: string]: unknown;
};

/** `event: heartbeat` — watchdog reset only; no UI. */
export type LabHeartbeatEvent = { ts: number };

/**
 * Discriminated union dispatched to the transport's `onEvent` sink. `token` and
 * `data` carry their payload inline; `stage`/`done`/`warning`/`error`/`heartbeat`
 * nest the parsed frame under `data` (mirrors `SmartStreamEvent`'s shape). Note
 * `done`/`error` are terminal in the transport but still surface here so the UI
 * can render the final state.
 */
export type LabStreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'data'; data: LabDataEvent }
  | { type: 'stage'; data: LabStageEvent }
  | { type: 'done'; data: LabDoneEvent }
  | { type: 'warning'; data: LabWarningEvent }
  | { type: 'error'; data: LabErrorEvent }
  | { type: 'heartbeat'; data: LabHeartbeatEvent };

/** Named SSE events we subscribe to. `heartbeat` resets the watchdog only. */
export const LAB_STREAM_EVENT_NAMES = [
  'token',
  'data',
  'stage',
  'done',
  'warning',
  'error',
  'heartbeat',
] as const;
