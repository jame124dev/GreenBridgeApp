// useWantMutations — create / update / delete a Want-To-Buy request, with the
// right cache invalidations so the My Wants dashboard + the flat Matches feed
// stay in sync after each change.
//
//   create → POST /wtb   (returns the new want + its instant matches)
//   update → PATCH /wtb/{id}  (pause/resume, notify freq, edit title/cat/keywords)
//   remove → DELETE /wtb/{id} (soft-delete)
//
// On success each invalidates `labKeys.wants()` (the list) + `labKeys.matches()`
// (the flat feed); update/remove also invalidate that want's `wantMatches(id)`
// so its card refetches (an edit re-runs matching server-side).
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { labKeys } from '@/features/lab/data/labQueryKeys';
import {
  createWant,
  updateWant,
  deleteWant,
  type WtbRequestData,
  type WtbRequestSummary,
  type WtbUpdatePayload,
} from '@/features/lab/data/wtbApi';

export interface UseWantMutationsResult {
  createWant: (fields: { title: string; category_name?: string } & Record<string, unknown>) => Promise<WtbRequestData>;
  updateWant: (id: number, patch: WtbUpdatePayload) => Promise<WtbRequestSummary>;
  deleteWant: (id: number) => Promise<void>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function useWantMutations(): UseWantMutationsResult {
  const qc = useQueryClient();
  const invalidateList = () => {
    void qc.invalidateQueries({ queryKey: labKeys.wants() });
    void qc.invalidateQueries({ queryKey: labKeys.matches() });
  };

  const create = useMutation({
    mutationFn: (fields: { title: string; category_name?: string } & Record<string, unknown>) =>
      createWant(fields),
    onSuccess: invalidateList,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: WtbUpdatePayload }) => updateWant(id, patch),
    onSuccess: (_res, { id }) => {
      invalidateList();
      void qc.invalidateQueries({ queryKey: labKeys.wantMatches(id) });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteWant(id),
    onSuccess: invalidateList,
  });

  return {
    createWant: (fields) => create.mutateAsync(fields),
    updateWant: (id, patch) => update.mutateAsync({ id, patch }),
    deleteWant: (id) => remove.mutateAsync(id),
    isCreating: create.isPending,
    isUpdating: update.isPending,
    isDeleting: remove.isPending,
  };
}
