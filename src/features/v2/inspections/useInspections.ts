/**
 * PHASE 2 — Inspections, against the real API.
 *
 * Endpoint: `GET /inspection/buyer/{buyerId}?page&limit&status`
 * (`nextjs-port/src/services/api/slices/buyerApiSlice.ts:332`, URL at `:352`).
 *
 * ── SHAPE, VERIFIED 2026-09-24 ──
 *
 *     GET /inspection/buyer/574?page=1&limit=3 → 200
 *     {"success":true,"data":{"data":[],"pagination":
 *       {"total":0,"page":1,"limit":3,"totalPages":0}}}
 *
 * Rows at `data.data`, exactly as the declared type says — the envelope really
 * does nest `data` twice. (The watchlist next door uses `data.wishlist`
 * instead. Do not generalise between them.)
 *
 * ⚠️ BUYER 574 HAS ZERO INSPECTIONS, so this screen renders its empty state
 * on dev and the card layout is still unproven against real rows. That is a
 * gap in the DATA, not in the wiring: it needs a buyer who has actually
 * registered for a site visit before anyone can say the screen is verified.
 *
 * ── THE STATUS FILTER IS SERVER-SIDE, AND THAT IS THE POINT ──
 *
 * The web sends `status` as a query param and resets to page 1
 * (`MyInspections.tsx:120-127`); the pagination totals then describe the
 * FILTERED set. Phase 1 filtered the fixture in the client as a stand-in, and
 * keeping that would make the count disagree with the list the moment there
 * is more than one page. So the filter is a query input here, not a `.filter()`
 * in render.
 */
import { useQuery } from '@tanstack/react-query';

import { greenbidz } from '@/api/greenbidzClient';
import { useBuyerId } from '@/features/v2/dashboard/useBuyerId';

import {
  INSPECTIONS_LIMIT,
  INSPECTION_FILTERS,
  type InspectionFilter,
  type InspectionItem,
} from './types';

/** The wire value for a tab — `null` means "no `status` param at all". */
function statusParam(filter: InspectionFilter): string | null {
  return INSPECTION_FILTERS.find((f) => f.value === filter)?.status ?? null;
}

export function useInspectionsQueryKey(
  buyerId: number | undefined,
  filter: InspectionFilter,
) {
  return ['v2', 'buyer', 'inspections', buyerId ?? null, filter] as const;
}

export type InspectionsPage = {
  rows: InspectionItem[];
  total: number;
};

export function useInspections(filter: InspectionFilter) {
  const buyerId = useBuyerId();

  return useQuery<InspectionsPage>({
    // The filter is IN the key: a server-filtered response is a different
    // resource, not the same list rendered differently.
    queryKey: useInspectionsQueryKey(buyerId, filter),
    queryFn: async () => {
      const status = statusParam(filter);
      const res = await greenbidz.get(`/inspection/buyer/${buyerId}`, {
        params: {
          page: 1,
          limit: INSPECTIONS_LIMIT,
          ...(status ? { status } : {}),
        },
      });
      const rows = res.data?.data?.data;
      return {
        rows: Array.isArray(rows) ? (rows as InspectionItem[]) : [],
        total: Number(res.data?.data?.pagination?.total ?? 0),
      };
    },
    enabled: !!buyerId,
    staleTime: 30_000,
  });
}
