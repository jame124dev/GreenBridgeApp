// Matches-feed view-model (spec 05 `05-matches-feed.md` §5).
//
// The shared demo store (`@/features/lab/data/demo` → `MATCHES: MatchCard[]`)
// is read concurrently by several screens, so this screen does NOT mutate it.
// Instead we adapt each `MatchCard` into the spec's `MatchVM` shape here —
// deriving the closed `variant` union + numeric ring colors from the stable
// `tag`/`pct` fields. Keeping the mapping in one place means the JSX renders a
// single typed shape and the Phase-2 swap is a one-line data-source change.
//
// ── FUTURE DYNAMIC HOOK POINT ──────────────────────────────────────────────
// Replace `useMatches()` with a React Query call (installed):
//   const { data = [], isLoading, refetch, isRefetching } =
//     useQuery({ queryKey: ['matches'], queryFn: fetchMatches });
//   return { matches: data.map(toMatchVM), isLoading, refetch, isRefetching };
// `time` → date-fns `formatDistanceToNowStrict(new Date(createdAt),{addSuffix:true})`;
// `variant`/`ringFill` → a `scoreBand(score)` helper (≥95 & 91–94 → 'new-match';
// <91 → 'worth-a-look'). JSX must not change between static and dynamic.
import { greenMedium, warnAmber } from '@/constants/theme';
import { MATCHES, type MatchCard } from '@/features/lab/data/demo';

/**
 * Closed variant set for the match-status chip (spec 05 §3 `StatusTag`).
 * Owned here (not in the shared demo store) so this screen stays decoupled from
 * concurrent edits to `demo.ts`. Phase 2: derive from `scoreBand(score)`.
 */
export type MatchTag = 'new-match' | 'worth-a-look';

/** Ring track (spec §3 file-local neutral). */
const RING_TRACK = '#E4EBE6';

/** Spec `Match` shape (05 §5): variant union + numeric ring colors + label data. */
export type MatchVM = {
  id: string;
  variant: MatchTag;
  time: string;
  sell: string;
  sellSub: string;
  pct: number; // 0–100
  ringFill: string;
  ringTrack: string;
  want: string;
  wantSub: string;
};

/**
 * Map a shared `MatchCard` → the feed's `MatchVM`. `variant` derives from the
 * chip label; the ring fill follows the spec's color reconciliation
 * (green matches use `greenMedium`, amber "worth a look" uses `warnAmber` —
 * NOT the legacy `#C58A1E` chip color stored on the card).
 */
function toMatchVM(m: MatchCard): MatchVM {
  const variant: MatchTag = m.tag === 'Worth a look' ? 'worth-a-look' : 'new-match';
  return {
    id: m.id,
    variant,
    time: m.time,
    sell: m.sell,
    sellSub: m.sellSub,
    pct: m.pct,
    ringFill: variant === 'worth-a-look' ? warnAmber : greenMedium,
    ringTrack: RING_TRACK,
    want: m.want,
    wantSub: m.wantSub,
  };
}

/** Static (Phase-1) matches feed. Swap the body for `useQuery` in Phase 2. */
export function useMatches(): { matches: MatchVM[] } {
  return { matches: MATCHES.map(toMatchVM) };
}
