// useChatController — the (lab) chat orchestration seam (A2 §7.2), lifted
// VERBATIM out of `app/(lab)/chat.tsx` (PR-4). Owns send / commit / abort / retry,
// the committed message history, card-action handlers, the multi-product batch
// wiring, and the draft/gap derivations. The screen becomes presentational: it
// consumes this hook and keeps only view concerns (scroll, layout, refs).
//
// Behavior is unchanged. The one entanglement — send() scrolling the thread to
// the bottom — is preserved by an injected `onDidSend` callback the view supplies
// (scroll bookkeeping stays a view concern; the data orchestration lives here).
// Messages remain component-local `useState` here until PR-7 moves them into
// `conversationStore`; the reducer/effches split lands in PR-5.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { haptics } from '@/lib/haptics';
import { DETECT_STREAM_ENABLED } from '@/lib/flags';
import { useComposer } from '@/features/lab/stores/composerStore';
import { LATEST_WINS_CARD_TYPES, useThread } from '@/features/lab/stores/threadStore';
import { useConversation, selectMessages } from '@/features/lab/stores/conversationStore';
import { useSession } from '@/features/lab/stores/sessionStore';
import { useLabTurn } from '@/features/lab/hooks/useLabTurn';
import { useBatchProducts } from '@/features/lab/hooks/useBatchProducts';
import { launchSellerScan } from '@/features/lab/scan/launchSellerScan';
import type { DraftPayload } from '@/features/lab/data/listingDraftApi';
import { newMsgId } from '@/features/lab/chat/types';
import { textContent, type Message } from '@/features/lab/chat/types/message';
import {
  collapseSupersededCards,
  computeLatestDraft,
  draftGapCount,
  turnToMessage,
} from '@/features/lab/chat/controllers/turnFold';

export type UseChatControllerArgs = {
  /** The `q` param Home seeds the first user turn with (empty for a bare entry). */
  initialQuery: string;
  /** View side-effect fired after a send is accepted — scroll-to-bottom
   *  bookkeeping. Must be identity-stable so `send` stays memoized. */
  onDidSend?: () => void;
  /** Present the native edit sheet (the view owns its ref). Fired by onEditDraft
   *  after the seed is set — the ref stays a view concern (refs must not flow
   *  through the render-time hook return). */
  onPresentEditSheet?: () => void;
};

export function useChatController({
  initialQuery,
  onDidSend,
  onPresentEditSheet,
}: UseChatControllerArgs) {
  const mode = useComposer((s) => s.mode);
  const apiMode: 'seller' | 'buyer' = mode === 'sell' ? 'seller' : 'buyer';

  const labTurn = useLabTurn();
  const turn = useThread((s) => s.turn);

  // PR-7: committed history lives in `conversationStore` (A2 I2 single source of
  // truth), keyed by the persisted conversationId. Seed once per mount (the old
  // per-mount `useState` init) so re-entry starts fresh — in-memory, no resume.
  const conversationId = useMemo(() => useSession.getState().getConversationId(), []);
  useState(() => {
    useConversation
      .getState()
      .seed(
        conversationId,
        initialQuery
          ? [{ id: newMsgId('user'), role: 'user', createdAt: Date.now(), content: textContent(initialQuery) }]
          : [],
      );
    return null;
  });
  const messages = useConversation(selectMessages(conversationId));
  const appendMessages = useCallback(
    (msgs: Message[]) => useConversation.getState().append(conversationId, msgs),
    [conversationId],
  );
  const [input, setInput] = useState('');

  // D3 settle handoff: the id of the message a commit just appended, so the view
  // can mount that committed row with NO entering animation (it is replacing the
  // pixel-identical streaming bubble in the same frame). Set once per settle —
  // never per token — inside the commit effect, where React 18 batches it with
  // append+reset into ONE render (render isolation holds). A lingering id is
  // harmless: `entering` only applies at mount and rows are keyed by stable ids.
  const [justSettledId, setJustSettledId] = useState<string | null>(null);

  // Retry re-runs the errored turn's original text (turn errors don't carry the
  // outgoing message), seeded from the first `q`.
  const lastUserTextRef = useRef<string>(initialQuery);

  // Effect executor (A2 §7.2): drain the reducer's emitted effects. The pure
  // reducer decides WHAT happens on a terminal frame (commit/reset/haptic); the
  // orchestrator is the only place they're EXECUTED. Runs once per emission (the
  // reducer emits a terminal batch exactly once, then RESET clears the turn).
  const pendingEffects = useThread((s) => s.pendingEffects);
  useEffect(() => {
    if (pendingEffects.length === 0) return;
    for (const e of pendingEffects) {
      if (e.kind === 'commit') {
        // Read the terminal turn synchronously BEFORE the reset effect runs.
        const msg = turnToMessage(useThread.getState().turn, lastUserTextRef.current);
        if (msg) appendMessages([msg]);
        // complete/stopped get the seamless swap; a failed commit keeps the
        // attention-grabbing POP on the error bubble.
        if (msg && e.reason !== 'failed') setJustSettledId(msg.id);
      } else if (e.kind === 'reset') {
        useThread.getState().reset();
      } else if (e.kind === 'haptic') {
        if (e.of === 'error') haptics.error();
      }
      // 'cancelPost' has no Phase-1 counterpart (no cancel endpoint today) → no-op.
    }
    useThread.getState().drainEffects();
  }, [pendingEffects, appendMessages]);

  // Send a follow-up turn. Commits any in-flight (rare — normally settled first),
  // appends the user bubble, opens a new turn against the same conversation_id.
  const send = useCallback(
    (text: string) => {
      if (useThread.getState().turn.status === 'streaming') return; // no silent abort-restart
      const message = text.trim();
      const staged = useComposer.getState().attachments;
      if (!message && staged.length === 0) return;
      haptics.impact(); // MEDIUM — primary CTA
      lastUserTextRef.current = message;
      const sentAttachments = staged.map((a) => ({ uri: a.uri, isImage: a.isImage, name: a.name }));
      appendMessages([
        {
          id: newMsgId('user'),
          role: 'user',
          createdAt: Date.now(),
          content: textContent(message),
          attachments: sentAttachments.length ? sentAttachments : undefined,
        },
      ]);
      setInput('');
      useThread.getState().startTurn();
      void labTurn.start(message);
      onDidSend?.();
    },
    [labTurn, onDidSend, appendMessages],
  );

  const onRetry = useCallback(
    (text: string) => {
      haptics.tap();
      send(text);
    },
    [send],
  );

  const onCardSend = useCallback((text: string) => send(text), [send]);

  const abort = useCallback(() => labTurn.abort(), [labTurn]);

  // User-initiated Stop (composer). Distinct from `abort` (navigation-away):
  // kill the network FIRST so labStream's catch runs with isAbort=true and never
  // emits a terminal frame, THEN dispatch the stop command so the reducer
  // deterministically commits the partial answer (or resets if empty). A late
  // token arriving after reset folds into an IDLE turn — never renders/commits.
  const stop = useCallback(() => {
    labTurn.abort();
    useThread.getState().dispatch({ kind: 'stop' });
  }, [labTurn]);

  // "Edit details" → open the native edit sheet, seeded from the tapped card's
  // draft. The view owns the sheet ref; we set the seed then ask it to present.
  const [editSeed, setEditSeed] = useState<unknown>(null);
  const onEditDraft = useCallback(
    (data: unknown) => {
      setEditSeed(data);
      onPresentEditSheet?.();
    },
    [onPresentEditSheet],
  );

  // Entry-card "Upload photos / documents" → native seller scan flow.
  const handleUploadPress = useCallback(() => {
    haptics.tap();
    launchSellerScan();
  }, []);

  // On a successful save: append a fresh committed listing_draft assistant message.
  const onSaved = useCallback(
    (payload: DraftPayload) => {
      appendMessages([
        {
          id: newMsgId('assistant'),
          role: 'assistant',
          createdAt: Date.now(),
          reason: 'complete',
          content: textContent(''),
          cards: [{ type: 'listing_draft', data: payload }],
        },
      ]);
    },
    [appendMessages],
  );

  // Multi-product batch controller. Appends fresh committed messages while the
  // thread is idle (no live-turn conflict). Only wired behind the flag.
  const batch = useBatchProducts(conversationId, appendMessages);
  const onJumpProduct = useCallback((index: number) => batch.jumpTo(index), [batch]);
  const onAdvanceProduct = useCallback(
    (dir: 'prev' | 'next', currentIndex: number, total: number) => batch.advance(dir, currentIndex, total),
    [batch],
  );
  const onCombineProducts = useCallback(() => batch.combine(), [batch]);
  const onSplitProducts = useCallback(() => batch.split(), [batch]);
  const onPublishBatch = useCallback(() => batch.publishAll(), [batch]);
  const batchCtx = DETECT_STREAM_ENABLED
    ? { onJumpProduct, onAdvanceProduct, onCombineProducts, onSplitProducts, onPublishBatch, batchBusy: batch.busy }
    : {};

  // Kick the first turn on mount if Home didn't already open it (direct/deep
  // entry with a `q` param).
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    const t = useThread.getState().turn;
    if (initialQuery && t.status === 'idle') {
      useThread.getState().startTurn();
      void labTurn.start(initialQuery);
    }
  }, [initialQuery, labTurn]);

  const liveActive = turn.status === 'streaming';

  // Singleton card types the live turn currently carries — they supersede every
  // committed copy. Keyed as a stable string so the collapse memo only recomputes
  // when the set changes, not on every token.
  const liveSingletonKey = liveActive
    ? turn.cards
        .filter((c) => LATEST_WINS_CARD_TYPES.has(c.type))
        .map((c) => c.type)
        .sort()
        .join(',')
    : '';
  const viewMessages = useMemo(
    () => collapseSupersededCards(messages, new Set(liveSingletonKey ? liveSingletonKey.split(',') : [])),
    [messages, liveSingletonKey],
  );

  const latestDraft = useMemo(() => computeLatestDraft(turn.cards, messages), [turn.cards, messages]);
  const showGapFiller =
    DETECT_STREAM_ENABLED && apiMode === 'seller' && draftGapCount(latestDraft) >= 1;

  return {
    mode,
    apiMode,
    turn,
    liveActive,
    justSettledId,
    input,
    setInput,
    viewMessages,
    send,
    onRetry,
    onCardSend,
    abort,
    stop,
    onEditDraft,
    editSeed,
    onSaved,
    handleUploadPress,
    batchCtx,
    latestDraft,
    showGapFiller,
  };
}
