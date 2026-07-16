// Card-payload data contracts (A4 §10 / §12.2). These describe the SHAPE of the
// multi-product card `data` (`listing_queue` / `listing_group_choice`) — they are
// card presentation contracts, not the streaming transport. They live here (not
// in `streaming/`) so presentational components (`cards.tsx`) can type their
// props WITHOUT importing `streaming/` (A4 §12.2). The wire module
// (`labStreamTypes`) re-exports them for the transport layer.
//
// Frozen wire contract; emitted for `source in {bulk_template, document_split}`
// and the multi-photo image path. `index` is 1-based; `image_url` is null for
// document-split items (no page thumbnail); `missing` counts still-required fields.

export interface QueueItem {
  index: number;
  title: string;
  image_url: string | null;
  missing: number;
}

/** `data{type:'listing_group_choice'}` — the one-time "found N products, review
 *  separately or combine?" chooser. `first_payload` is a `listing_draft` payload
 *  (the active item). `mode` marks the server-suggested branch. */
export interface GroupChoiceData {
  total: number;
  items: QueueItem[];
  first_payload: unknown;
  mode: 'separate_default' | 'combined_default';
}

/** `data{type:'listing_queue'}` — the multi-product overview pager. `index` is
 *  the CURRENT active 1-based position; `remaining` counts items not yet
 *  published/reviewed. */
export interface QueueData {
  total: number;
  index: number;
  remaining: number;
  items: QueueItem[];
}
