/**
 * ScanV2 DURABLE EXTRACT LANE — spreadsheets and office documents → a draft.
 *
 * This is the lane the WEB has used all along and mobile never had. Without it,
 * `useLabTurn` sent every attachment to `/detect/stream` — the vision/photo
 * engine — so a seller's inventory spreadsheet was handed to a service that
 * cannot read one. See `features/lab/chat/officeExtract.ts` for the classifier
 * that decides what belongs here.
 *
 * ── THE CONTRACT, MEASURED NOT ASSUMED ─────────────────────────────────────
 *
 * Driven end to end against the live backend on 2026-09-17 with a real 9 MB
 * seller file (`SOTW04060設備清單對照表0705.xlsx`), which produced draft 246 with
 * **18 items**. Four steps:
 *
 *   1. POST `/gcs/resumable/create`
 *        { sellerId, clientDedupKey, files:[{ originalName, size, mimeType }] }
 *      → { sessionId, jobId, files:[{ seq, objectName, sessionUri, chunkSize,
 *          expectedSize }] }
 *
 *   2. PUT the bytes straight to `sessionUri` (GCS), with `Content-Range`.
 *
 *   3. POST `/gcs/resumable/finalize`
 *        { sellerId, sessionId, jobId, files:[{ seq, objectName, originalName }] }
 *
 *   4. GET `/recognition-jobs/{jobId}` until `draft_ready`.
 *      Observed states: uploading → splitting → extracting → draft_ready.
 *
 * ⚠️ STEP 3 MUST ECHO BACK `jobId`, AND THIS IS THE WHOLE TRICK.
 * `gcsResumableController.js:521` reads `req.body?.jobId`, and line 635 only
 * calls `advanceExtractJobToSplitting` / `splitJobIntoUnits` / `runExtractJob`
 * **if that field is present**. Omit it and every visible signal still says
 * success — `finalize` returns `ok:true`, `finalized:1`, `rejected:0`, a real
 * `contentHash` and a signed `readUrl` — while the job sits at `uploading`
 * forever and no draft is ever created. That exact mistake cost a debugging
 * round and was initially misread as a backend bug. It is not: the client owns
 * the link.
 *
 * ⚠️ `/recognition-jobs/:id` needs a USER JWT, not the system key. The system
 * key alone returns `403 Forbidden`. The axios interceptor attaches the bearer.
 *
 * ── DEPLOYMENT ─────────────────────────────────────────────────────────────
 *
 * `testapi.greenbidz.com` currently **404s** on both resumable routes: the
 * backend commit that adds them (`aa4d7c6`) is merged to `dev` but the dev
 * server is running an older build. Until it is redeployed this lane only works
 * against a local backend. `isExtractLaneAvailable()` exists so a caller can
 * find that out without a failed upload.
 */
import { greenbidz } from '@/api/greenbidzClient';

/** One file to push through the lane. */
export interface ExtractLaneInput {
  /** `blob:`/`data:`/`file:` uri of the staged attachment. */
  uri: string;
  name: string;
  /** Best-known MIME. The backend re-sniffs, so an approximate value is fine. */
  mimeType?: string;
}

interface CreatedFile {
  seq: number;
  objectName: string;
  sessionUri: string;
  chunkSize: number;
  expectedSize: number;
}

export interface ExtractJobState {
  status: 'uploading' | 'splitting' | 'extracting' | 'draft_ready' | 'failed' | string;
  draftId: number | null;
  error: string | null;
}

/** Terminal states — stop polling. */
export function isTerminalExtractStatus(status: string): boolean {
  return status === 'draft_ready' || status === 'failed' || status === 'error';
}

/**
 * A stable-per-attempt, fresh-per-file-set key.
 *
 * The backend keys the job on `UNIQUE(seller_id, client_dedup_key)` and derives
 * the upload session id — and therefore every GCS object path — from
 * `(sellerId, clientDedupKey)`. So a double-tap must reuse the key (resume the
 * same job, not start a second) and a different file set must not.
 */
export function extractDedupKey(files: readonly ExtractLaneInput[], nonce = Date.now()): string {
  const signature = files
    .map((f) => f.name)
    .sort()
    .join('|');
  return `m-${nonce}-${signature}`.slice(0, 120);
}

/** Read a staged attachment's bytes. Web reads the blob behind the uri. */
async function readBytes(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`Could not read the staged file (${res.status})`);
  return res.blob();
}

/**
 * Run the whole lane for ONE document and return the finished job.
 *
 * `onStatus` fires on every poll so a caller can show which phase it is in —
 * "splitting" and "extracting" are slow enough on a real spreadsheet that a
 * single spinner reads as a hang.
 */
export async function runExtractLane(
  sellerId: number | string,
  file: ExtractLaneInput,
  opts: {
    signal?: AbortSignal;
    onStatus?: (state: ExtractJobState) => void;
    pollMs?: number;
    maxPolls?: number;
  } = {},
): Promise<ExtractJobState & { jobId: string }> {
  const { signal, onStatus, pollMs = 4000, maxPolls = 150 } = opts;

  const blob = await readBytes(file.uri);
  const size = blob.size;

  // ── 1. create ────────────────────────────────────────────────────────────
  const created = await greenbidz.post(
    '/gcs/resumable/create',
    {
      sellerId,
      clientDedupKey: extractDedupKey([file]),
      files: [{ originalName: file.name, size, mimeType: file.mimeType ?? blob.type }],
    },
    { signal, timeout: 60_000 },
  );

  const data = created.data?.data;
  const jobId: string | undefined = data?.jobId;
  const sessionId: string | undefined = data?.sessionId;
  const target: CreatedFile | undefined = data?.files?.[0];

  if (!jobId || !sessionId || !target?.sessionUri) {
    // jobId is null when SCANV2_DURABLE_EXTRACT is off server-side. Without it
    // there is no job to advance, so uploading would be pointless work.
    throw new Error('The document lane is not enabled on this server.');
  }

  // ── 2. PUT the bytes to GCS ──────────────────────────────────────────────
  //
  // Single request: the backend hands back a 16 MB `chunkSize`, and real seller
  // spreadsheets measured so far sit well inside it (the 9 MB test file did).
  // Anything larger needs the web's chunked loop with `Range` resume — not
  // built here, so it is refused loudly rather than truncated silently.
  if (size > target.chunkSize) {
    throw new Error(
      `This file is ${Math.round(size / 1048576)} MB. Documents over ` +
        `${Math.round(target.chunkSize / 1048576)} MB are not supported in the app yet.`,
    );
  }

  const put = await fetch(target.sessionUri, {
    method: 'PUT',
    headers: { 'Content-Range': `bytes 0-${size - 1}/${size}` },
    body: blob,
    signal,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);

  // ── 3. finalize — WITH jobId, see the file header ────────────────────────
  await greenbidz.post(
    '/gcs/resumable/finalize',
    {
      sellerId,
      sessionId,
      jobId,
      files: [{ seq: target.seq, objectName: target.objectName, originalName: file.name }],
    },
    { signal, timeout: 120_000 },
  );

  // ── 4. poll ──────────────────────────────────────────────────────────────
  let last: ExtractJobState = { status: 'uploading', draftId: null, error: null };

  for (let i = 0; i < maxPolls; i += 1) {
    if (signal?.aborted) throw new Error('Cancelled');

    const res = await greenbidz.get(`/recognition-jobs/${jobId}`, { signal, timeout: 30_000 });
    last = {
      status: String(res.data?.status ?? 'unknown'),
      draftId: res.data?.draft_id ?? null,
      error: res.data?.error ?? null,
    };
    onStatus?.(last);

    if (isTerminalExtractStatus(last.status)) return { ...last, jobId };
    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error('The document is taking longer than expected. It will finish in the background.');
}

/**
 * Is the lane deployed on the server this build talks to?
 *
 * `testapi` 404s today (see the header). A caller can check once and fall back
 * rather than uploading megabytes into a route that does not exist.
 */
export async function isExtractLaneAvailable(): Promise<boolean> {
  try {
    await greenbidz.post('/gcs/resumable/create', {}, { timeout: 15_000 });
    return true; // a 2xx on an empty body would be surprising, but it exists
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    // 400 = route exists and validated the empty body. 404 = not deployed.
    return status !== undefined && status !== 404;
  }
}
