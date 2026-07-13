// React Query key factory for the (lab) WTB / matches / deal data layer
// (NewVersion/dynamic/04-mobile-integration-plan.md §2 `labKeys`).
//
// One namespaced root (`['lab']`) so the whole lab surface can be invalidated at
// once, with typed sub-keys per query. Mirrors the seller scanner convention
// (`src/features/scanner/queryKeys.ts`) — `as const` tuples, factory functions —
// and the exact shape the integration plan prescribes so the screen specialists
// (Matches / Match Detail / Deal Room) can bind without guessing.
//
// NOTE ON THE `matches` KEY: the legacy `matchesView.ts` uses the bare
// `['matches']` key for its static hook. This factory deliberately namespaces
// under `['lab', ...]` so the live hooks never collide with that during the
// static→dynamic transition.

const ROOT = 'lab' as const;

export const labKeys = {
  /** Root — invalidate the entire lab data surface. */
  all: [ROOT] as const,

  /** Home "N new matches" pill — a lightweight count derived from active wants. */
  matchCount: () => [ROOT, 'matchCount'] as const,

  /** The buyer's saved Want-To-Buy requests (Python `GET /wtb`). */
  wants: () => [ROOT, 'wants'] as const,

  /** Union matches feed across all active wants (Matches tab). */
  matches: () => [ROOT, 'matches'] as const,

  /** Enriched detail for a single match row (Match Detail screen). */
  match: (id: string) => [ROOT, 'match', id] as const,

  /** Matches for ONE want (Python `GET /wtb/{id}/matches`). */
  wantMatches: (wtbId: number) => [ROOT, 'wantMatches', wtbId] as const,

  /** Buyer↔seller Messages inbox (Node `GET /chat/buyer/:id/sellers`). */
  conversations: () => [ROOT, 'conversations'] as const,

  /** Deal Room conversation meta (header/counterparty). */
  deal: (id: string) => [ROOT, 'deal', id] as const,

  /** Deal Room thread messages (Node chat, polled). */
  dealMessages: (id: string) => [ROOT, 'deal', id, 'messages'] as const,
} as const;

export type LabQueryKey =
  | ReturnType<typeof labKeys.matchCount>
  | ReturnType<typeof labKeys.wants>
  | ReturnType<typeof labKeys.matches>
  | ReturnType<typeof labKeys.match>
  | ReturnType<typeof labKeys.wantMatches>
  | ReturnType<typeof labKeys.conversations>
  | ReturnType<typeof labKeys.deal>
  | ReturnType<typeof labKeys.dealMessages>;
