import { useMutation } from '@tanstack/react-query';

import { labKeys } from '@/features/lab/data/labQueryKeys';
import { updateWant } from '@/features/lab/data/wtbApi';
import { queryClient } from '@/lib/queryClient';

/**
 * Pause or resume a saved want. `PATCH /wtb/{id} { status }`.
 *
 * ── WHY THIS IS OPTIMISTIC ──
 *
 * Pausing is a toggle on a row the person is looking at, so it has to move
 * under the finger. The alternative — wait for the round trip, then refetch
 * the list — leaves the row visibly unchanged for as long as the network
 * takes, which reads as a dead control. That is the same class of bug as
 * `Scan it` doing nothing, just slower.
 *
 * The rollback matters as much as the update: on failure the previous list is
 * put back, so a lost request cannot leave a want showing "active" while the
 * server still has it paused. A want that lies about whether it is watching is
 * worse than one that failed to change.
 *
 * ⚠️ Every write in v2 goes to the DEV backend — `.env` has
 * `GREENBIDZ_API_URL=https://testapi.greenbidz.com/api/v1`, which is
 * `greenbidz_test`. Check that before running this against a real account.
 */
export function useWantStatus() {
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'active' | 'paused' }) =>
      updateWant(id, { status }),

    onMutate: async ({ id, status }) => {
      // Stop an in-flight list fetch from landing on top of the optimistic row.
      await queryClient.cancelQueries({ queryKey: labKeys.wants() });
      const previous = queryClient.getQueryData(labKeys.wants());

      queryClient.setQueryData(labKeys.wants(), (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((w) =>
          (w as { id?: number }).id === id ? { ...(w as object), status } : w,
        );
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(labKeys.wants(), context.previous);
      }
    },

    onSettled: () => {
      // Reconcile with the server either way — the optimistic row is a guess
      // about one field, and the response carries the rest of the record.
      void queryClient.invalidateQueries({ queryKey: labKeys.wants() });
      // Matches are derived per want, so a paused want's matches must go too.
      // The PREFIX key, not one want's: `wantMatches(id)` would leave the other
      // wants' match lists — and the Matches tab's summary — stale. That exact
      // omission is why `wantMatchesAll` exists (see `labQueryKeys.ts`).
      void queryClient.invalidateQueries({ queryKey: labKeys.wantMatchesAll() });
    },
  });
}
