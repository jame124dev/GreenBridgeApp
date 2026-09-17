// useLabTurn — opens one (lab) customer-app AI turn over P0's `labStream`
// (NewVersion/dynamic/01-chat-architecture.md §2/§11, 04-mobile-integration-plan.md
// §1.5/§4). This is the mobile port of the web `useAIChat.send()` orchestration,
// modeled on the seller scanner's `useSmartDetect` (`src/features/scanner/`).
//
// Responsibilities:
//  - Map the composer's `sell|buy` → the assistant's `seller|buyer` at the API
//    boundary (the assistant rejects raw `sell`/`buy` — 01 §1.2 / §12).
//  - Choose `/detect/stream` when attachments are staged AND `DETECT_STREAM_ENABLED`
//    (live draft build), else `/chat/stream` (agent reasoning + tools) — same rule
//    as web `useAIChat` (01 §2 Phase 3).
//  - Send `{ conversation_id, message | image_urls/document_urls, mode, site_type }`;
//    `conversation_id` comes from the persisted `sessionStore`, never the body's
//    user_id (identity is JWT-derived — 01 §6/§12).
//  - Pipe every `LabStreamEvent` into `threadStore.applyFrame` (the read model the
//    processing/draft screens render from).
//  - Single-flight: abort the previous turn's `AbortController` before starting a
//    new one, so a fast re-tap never runs two AI turns at once (01 §3.2 one-shot).
//
// This hook is only ever mounted behind `LAB_CHAT_ENABLED` (the caller gates it);
// with the flag off the Home screen keeps its exact static behavior.
import { useCallback, useEffect, useRef } from 'react';

import i18n from '@/i18n';
import { DETECT_STREAM_ENABLED } from '@/lib/flags';
import { useAuth } from '@/stores/authStore';
import type { Photo } from '@/stores/scanDraftStore';
import {
  type GcsDocumentInput,
  gcsUrlForAnalyze,
  uploadGcsDocuments,
  uploadGcsPhotos,
} from '@/services/scanner/uploadGcsPhotos';
import { labStream, type LabStreamEndpoint } from '@/features/lab/streaming/labStream';
import { useComposer } from '@/features/lab/stores/composerStore';
import { useSession } from '@/features/lab/stores/sessionStore';
import { useThread } from '@/features/lab/stores/threadStore';
import { hasOfficeExtractFile } from '@/features/lab/chat/officeExtract';
import { runExtractLane } from '@/services/scanner/extractLane';

/**
 * What to say for each job phase. Only the phases a person waits through get a
 * line; `uploading` is covered by the "Reading …" line already emitted, and an
 * unknown status deliberately prints nothing rather than leaking a raw enum.
 */
const EXTRACT_PHASE: Record<string, string> = {
  splitting: 'Splitting the document into items…',
  extracting: 'Reading the details of each item…',
};

/** Fixed per this build — the 101LAB customer flow is site 2 (01 §7). */
const SITE_TYPE = 'labgreenbidz';

/** The user's selected UI language, sent to the assistant so its natural-language
 *  replies match the app language (previously hardcoded 'en' for detect and
 *  omitted for chat, so the AI always answered in English). Values are the
 *  lowercase i18n codes: en | zh-hant | zh-hans | ja | th | vi. */
function assistantLanguage(): string {
  return i18n.language || 'en';
}

export type UseLabTurn = {
  /** Open a turn. Pass explicit text (e.g. a quick-chip prompt), else the
   *  composer's current `input` is used. Aborts any in-flight turn first. */
  start: (input?: string) => Promise<void>;
  /** Cancel the in-flight turn (Android back / leaving the screen). */
  abort: () => void;
};

export function useLabTurn(): UseLabTurn {
  // Single-flight: one live AbortController at a time.
  const ctrlRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
  }, []);

  // Never leave an orphan AI run when the hook unmounts.
  useEffect(() => () => ctrlRef.current?.abort(), []);

  const start = useCallback(async (input?: string) => {
    // Read stores imperatively (no re-render coupling) — same pattern as
    // `useSmartDetect` reading `useAuth.getState()`.
    const { mode, input: composerInput, attachments } = useComposer.getState();
    const message = (input ?? composerInput ?? '').trim();
    const apiMode = mode === 'sell' ? 'seller' : 'buyer';

    // Consume the staged attachments for THIS turn only — clear immediately so a
    // subsequent text-only send doesn't re-upload them / re-route to /detect/stream.
    // The local `attachments` snapshot above still drives this turn's upload.
    if (attachments.length > 0) useComposer.getState().clearAttachments();

    // Single-flight: cancel the previous turn before opening a new one.
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    const conversationId = useSession.getState().getConversationId();
    const applyFrame = useThread.getState().applyFrame;

    // `/detect/stream` is the SELLER listing-detect engine (it gates non-sellers
    // and always maps its output to a `listing_draft`). Only route there in SELL
    // mode. In BUY mode, attachments ride on `/chat/stream` — which accepts
    // image_urls/document_urls AND honors `mode`, so a buyer image reaches the
    // buyer image tools (search / WTB), matching the web. Routing buyer images to
    // /detect/stream was the bug: it returned a seller listing draft in buy mode.
    const hasAttachments = attachments.length > 0;

    /**
     * ⚑ OFFICE DOCUMENTS DO NOT GO TO `/detect/stream`.
     *
     * `/detect/stream` is the vision/photo lane. The web never sends it a
     * spreadsheet: `nextjs-port` classifies DOCX/PPTX/XLS(X)/CSV first and runs
     * them through a separate DURABLE EXTRACT job
     * (`POST /gcs/resumable/create` + a `clientDedupKey`, keyed on
     * `UNIQUE(seller_id, client_dedup_key)`), and only photos and PDFs reach
     * detect. Mobile has no extract lane, so until it does, the least wrong
     * thing is to keep documents away from the engine that cannot read them.
     *
     * Tested 2026-09-17 with a real 9 MB seller spreadsheet
     * (`SOTW04060設備清單對照表0705.xlsx`): the GCS upload succeeded and the
     * turn then went to detect, which is the wrong lane for that file.
     *
     * Falling through to `/chat/stream` is deliberate and is NOT a fix — it is
     * the honest degradation. That endpoint already accepts `document_urls`
     * and honours `mode` (see the note below), so the assistant at least SEES
     * the file instead of the photo engine choking on it. Extracting N drafts
     * from a spreadsheet still needs the durable lane ported.
     *
     * The predicate is a port of the web's, kept byte-comparable on purpose —
     * `features/lab/chat/officeExtract.ts`.
     */
    const hasOfficeDoc = hasOfficeExtractFile(attachments);
    const useDetect =
      hasAttachments && !hasOfficeDoc && DETECT_STREAM_ENABLED && mode === 'sell';

    try {
      let endpoint: LabStreamEndpoint;
      let body: Record<string, unknown>;

      // Upload any staged attachments to GCS first — both the seller detect path
      // and the buyer chat path send the resulting URLs. Needs a user id for GCS
      // scoping (reuses the scanner's one-shot upload).
      let imageUrls: string[] | undefined;
      let documentUrls: string[] | undefined;
      if (hasAttachments) {
        const sellerId = useAuth.getState().profile?.id;
        if (!sellerId) throw new Error('Sign in required to analyze attachments');

        const images = attachments.filter((a) => a.isImage);
        const docs = attachments.filter((a) => !a.isImage);
        let sessionId: string | undefined;

        if (images.length > 0) {
          // `uploadGcsPhotos` only reads `uri`; dims are unused for upload but
          // satisfy the `Photo` type without an unsafe cast.
          const photos: Photo[] = images.map((a) => ({ uri: a.uri, width: 0, height: 0 }));
          const r = await uploadGcsPhotos(photos, { sellerId, signal: ctrl.signal });
          sessionId = r.sessionId;
          imageUrls = r.files.map((f) => gcsUrlForAnalyze(f));
        }
        if (docs.length > 0) {
          const documents: GcsDocumentInput[] = docs.map((a) => ({
            uri: a.uri,
            name: a.name,
            mimeType: 'application/octet-stream',
          }));
          const r = await uploadGcsDocuments(documents, {
            sellerId,
            sessionId,
            signal: ctrl.signal,
          });
          documentUrls = r.files.map((f) => gcsUrlForAnalyze(f));
        }
      }

      /**
       * ── OFFICE DOCUMENT → THE DURABLE EXTRACT LANE ───────────────────────
       *
       * Not a stream at all: `create` → PUT → `finalize` → poll a job. So it
       * returns here rather than falling through to `labStream`, and reports
       * progress by emitting the same frames the stream would, which is why
       * the existing chat UI renders it with no changes.
       *
       * Proven against the backend 2026-09-17 with a 9 MB seller spreadsheet:
       * draft 246, 18 items. See `services/scanner/extractLane.ts` for the
       * contract — in particular that `finalize` MUST echo back `jobId`.
       */
      if (hasOfficeDoc) {
        const sellerId = useAuth.getState().profile?.id;
        if (!sellerId) throw new Error('Sign in to upload a document');

        const doc = attachments.find((a) => !a.isImage) ?? attachments[0];

        applyFrame({ type: 'token', delta: `Reading ${doc.name}…\n` });

        const seen = new Set<string>();
        const result = await runExtractLane(
          sellerId,
          { uri: doc.uri, name: doc.name },
          {
            signal: ctrl.signal,
            onStatus: (s) => {
              // One line per phase, not per poll — `splitting` and
              // `extracting` take minutes on a real spreadsheet and a silent
              // spinner reads as a hang.
              if (seen.has(s.status)) return;
              seen.add(s.status);
              const label = EXTRACT_PHASE[s.status];
              if (label) applyFrame({ type: 'token', delta: `${label}\n` });
            },
          },
        );

        if (result.status !== 'draft_ready' || !result.draftId) {
          throw new Error(result.error ?? 'The document could not be read.');
        }

        applyFrame({
          type: 'token',
          delta: `Done — draft #${result.draftId} is ready to review.`,
        });
        applyFrame({ type: 'done', data: {} as never });
        return;
      }

      if (useDetect) {
        // SELL + attachments → the seller listing-detect engine (live draft).
        endpoint = '/detect/stream';
        body = {
          conversation_id: conversationId,
          site_type: SITE_TYPE,
          language: assistantLanguage(),
          mode: apiMode,
          ...(imageUrls?.length ? { image_urls: imageUrls } : {}),
          ...(documentUrls?.length ? { document_urls: documentUrls } : {}),
        };
      } else {
        // Text turn, OR a BUY-mode turn with attachments → the agent (reasoning
        // + tools). Carry any uploaded URLs so a buyer image is analyzed by the
        // mode-aware agent instead of the seller detect engine.
        endpoint = '/chat/stream';
        body = {
          conversation_id: conversationId,
          message,
          site_type: SITE_TYPE,
          language: assistantLanguage(),
          mode: apiMode,
          ...(imageUrls?.length ? { image_urls: imageUrls } : {}),
          ...(documentUrls?.length ? { document_urls: documentUrls } : {}),
        };
      }

      // Resolves on the terminal `done` frame (`res.conversationId`/`usedTools`
      // are surfaced there). Our conversation_id is persisted in the session
      // store (minted on first use), so the next turn continues the same thread
      // without further bookkeeping here — 01 §9 "continuity via conversation_id".
      await labStream({
        endpoint,
        body,
        signal: ctrl.signal,
        onEvent: (ev) => applyFrame(ev),
      });
    } catch (err) {
      // `labStream` already funnels a fatal `error` frame into `applyFrame`
      // (status→'error'), but transport/watchdog/abort rejections that never
      // produced an `error` frame must still land the turn in the error state
      // for the screen to render. Ignore aborts (user-initiated cancel).
      const isAbort = (err as { code?: string })?.code === 'cancelled';
      if (!isAbort) {
        applyFrame({
          type: 'error',
          data: {
            message: (err as Error)?.message ?? 'Something went wrong',
            code: (err as { code?: string })?.code,
            retriable: (err as { retriable?: boolean })?.retriable,
          },
        });
      }
    } finally {
      // Clear the controller only if it's still the current turn (a newer turn
      // may have replaced it).
      if (ctrlRef.current === ctrl) ctrlRef.current = null;
    }
  }, []);

  return { start, abort };
}
