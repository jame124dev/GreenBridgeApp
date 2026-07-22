// draftHooks.ts — React Query hooks wrapping `draftApi` (Task 2) for
// AI-scan drafts. Downstream Tasks 9 and 11 import `draftKeys` and these
// hooks verbatim — keep names/shapes exact.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './draftApi';

export const draftKeys = {
  all: ['drafts'] as const,
  list: () => [...draftKeys.all, 'list'] as const,
  detail: (id: string) => [...draftKeys.all, 'detail', id] as const,
};

export function useListDrafts(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: draftKeys.list(),
    queryFn: () => api.listDrafts(),
    staleTime: 15_000,
    // Callers (e.g. the Home "Your items" section) gate on the drafts flag +
    // sign-in so the list isn't fetched when it can't be used / would 401.
    enabled: options?.enabled ?? true,
  });
}

export function useGetDraft(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: draftKeys.detail(id ?? '_'),
    queryFn: () => api.getDraft(id as string),
    enabled: enabled && !!id,
  });
}

export function useCreateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: api.CreateDraftReq) => api.createDraft(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: draftKeys.all }),
  });
}

export function useUpdateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; expectedUpdatedAt: string; patch: Partial<api.CreateDraftReq> }) =>
      api.updateDraft(args.id, args.expectedUpdatedAt, args.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: draftKeys.all }),
  });
}

export function useDeleteDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteDraft(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: draftKeys.all }),
  });
}

export function useMarkDraftPublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; batchIds: string[] }) => api.markDraftPublished(args.id, args.batchIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: draftKeys.all }),
  });
}
