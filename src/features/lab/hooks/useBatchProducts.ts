// useBatchProducts — imperative controller for the (lab) multi-product review
// UX. Fires the batch REST calls (`batchProductApi`) and APPENDS fresh committed
// bot messages via the caller's `appendMessages` — exactly the way `chat.tsx`'s
// `onSaved` appends a listing_draft after an edit save. It does NOT route through
// the turn-scoped `threadStore` (that owns only the in-flight SSE turn); these
// actions run while the thread is idle, so a plain append is correct and avoids
// any live-turn conflict.
//
// The queue+draft pair is appended as ONE bot message (cards:[queue, draft]) so
// the two collapse together as a unit (listing_queue + listing_draft are both in
// LATEST_WINS_CARD_TYPES) and the overview never orphans from its active item.
//
// Single-flight via a ref (mirrors `useLabTurn`): a second tap while a request is
// in flight is dropped. `busy` disables the pager/CTAs in the cards.
//
// Only ever mounted behind DETECT_STREAM_ENABLED (the caller gates it); with the
// flag off the callbacks are passed as `undefined` and the cards render read-only.
import { useCallback, useRef, useState } from 'react';

import {
  combineProducts,
  hasAuthToken,
  loadProduct,
  nextProduct,
  publishBatch,
  splitProducts,
  type NextProductResponse,
  type PublishBatchResult,
  type SplitResponse,
} from '@/features/lab/data/batchProductApi';
import type { DraftPayload } from '@/features/lab/data/listingDraftApi';
import type { QueueData, QueueItem } from '@/features/lab/streaming/labStreamTypes';
import { newMsgId } from '@/features/lab/chat/types';
import { textContent, type Message } from '@/features/lab/chat/types/message';
import type { TurnCard } from '@/features/lab/stores/threadStore';

export type UseBatchProducts = {
  /** True while a batch request is in flight (disables pager + CTAs). */
  busy: boolean;
  /** Jump to a specific 1-based item (random-access). */
  jumpTo: (index: number) => void;
  /** Move the pager forward (`next`) or back (`prev`) from the current index. */
  advance: (dir: 'prev' | 'next', currentIndex: number, total: number) => void;
  /** Collapse the multi-product batch into ONE combined listing. */
  combine: () => void;
  /** Split a combined draft back into N separate products. */
  split: () => void;
  /** Publish every ready item (DESTRUCTIVE — gate behind a confirm in the card). */
  publishAll: () => void;
};

/** Build the grouped {queue, draft} bot message from a next/load/split response
 *  so the overview pager + active draft collapse together as one unit. */
function queueDraftMessage(queue: QueueData, payload: DraftPayload): Message {
  const cards: TurnCard[] = [
    { type: 'listing_queue', data: queue },
    { type: 'listing_draft', data: payload },
  ];
  return {
    id: newMsgId('assistant'),
    role: 'assistant',
    createdAt: Date.now(),
    reason: 'complete',
    content: textContent(''),
    cards,
  };
}

/** A single-card assistant message (used for combine → one listing, and the gate). */
function cardMessage(type: string, data: unknown): Message {
  return {
    id: newMsgId('assistant'),
    role: 'assistant',
    createdAt: Date.now(),
    reason: 'complete',
    content: textContent(''),
    cards: [{ type, data }],
  };
}

export function useBatchProducts(
  conversationId: string,
  appendMessages: (msgs: Message[]) => void,
): UseBatchProducts {
  const [busy, setBusy] = useState(false);
  // Single-flight: one live request at a time. A boolean ref is enough — these
  // are short imperative POSTs, not a cancellable stream.
  const inFlightRef = useRef(false);

  /** Run one batch action under the single-flight guard. `fn` returns the
   *  message(s) to append (or null to append nothing). */
  const run = useCallback(
    async (fn: () => Promise<Message[] | null>) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setBusy(true);
      try {
        const msgs = await fn();
        if (msgs && msgs.length) appendMessages(msgs);
      } catch {
        // Transport failure — surface a gate/soft card rather than throwing into
        // the thread (05-mobile-ux "never crash the thread").
        appendMessages([cardMessage('listing_gate', { reason: 'network' })]);
      } finally {
        inFlightRef.current = false;
        setBusy(false);
      }
    },
    [appendMessages],
  );

  /** Map a next/load 200 to the grouped message; `done`/401/miss → gate/no-op. */
  const messagesFromNext = useCallback(
    (res: {
      status: number;
      body: NextProductResponse | Record<string, unknown> | null;
    }): Message[] | null => {
      if (res.status === 401) return [cardMessage('listing_gate', { reason: 'login' })];
      const body = res.body as NextProductResponse | null;
      if (!body) return null;
      if ('done' in body && body.done) return null; // nothing more to advance to
      const b = body as Extract<NextProductResponse, { payload: DraftPayload }>;
      const queue: QueueData = {
        total: b.total,
        index: b.index,
        remaining: b.remaining,
        items: (b.items ?? []) as QueueItem[],
      };
      return [queueDraftMessage(queue, b.payload)];
    },
    [],
  );

  const jumpTo = useCallback(
    (index: number) => {
      void run(async () => messagesFromNext(await loadProduct(conversationId, index)));
    },
    [run, messagesFromNext, conversationId],
  );

  const advance = useCallback(
    (dir: 'prev' | 'next', currentIndex: number, total: number) => {
      if (dir === 'next') {
        // Advance forward — omit index so the server moves to the next item.
        void run(async () => messagesFromNext(await nextProduct(conversationId)));
        return;
      }
      // Prev is a random-access load of index-1, NOT advance() (advance only
      // moves forward). Guard the 0/total bounds — index is 1-based.
      const target = currentIndex - 1;
      if (target < 1 || target > total) return;
      void run(async () => messagesFromNext(await loadProduct(conversationId, target)));
    },
    [run, messagesFromNext, conversationId],
  );

  const combine = useCallback(() => {
    void run(async () => {
      const res = await combineProducts(conversationId);
      if (res.status === 401) return [cardMessage('listing_gate', { reason: 'login' })];
      const body = res.body as { payload?: DraftPayload } | null;
      if (!body?.payload) return null;
      return [cardMessage('listing_draft', body.payload)];
    });
  }, [run, conversationId]);

  const split = useCallback(() => {
    void run(async () => {
      const res = await splitProducts(conversationId);
      if (res.status === 401) return [cardMessage('listing_gate', { reason: 'login' })];
      const body = res.body as SplitResponse | null;
      if (!body?.first_payload) return null;
      // A fresh split → the active item is #1 of `total`; nothing published yet.
      const queue: QueueData = {
        total: body.total,
        index: 1,
        remaining: body.total,
        items: (body.items ?? []) as QueueItem[],
      };
      return [queueDraftMessage(queue, body.first_payload)];
    });
  }, [run, conversationId]);

  const publishAll = useCallback(() => {
    void run(async () => {
      // Gate guests before the destructive write.
      if (!(await hasAuthToken())) {
        return [cardMessage('listing_gate', { reason: 'login' })];
      }
      const res = await publishBatch(conversationId);
      if (res.status === 401) return [cardMessage('listing_gate', { reason: 'login' })];
      const body = res.body as PublishBatchResult | null;
      if (!body) return null;
      return [cardMessage('listing_batch_result', body)];
    });
  }, [run, conversationId]);

  return { busy, jumpTo, advance, combine, split, publishAll };
}
