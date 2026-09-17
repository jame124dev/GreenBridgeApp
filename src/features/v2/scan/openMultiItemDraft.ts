/**
 * Where a MULTI-ITEM draft opens in v2.
 *
 * Passed to `useResumeDraft(routeFor, onMultiItem)` by the two v2 surfaces that
 * list drafts — Home's preview rows and the full drafts screen. Defined once so
 * the two cannot drift: a seller who taps the same draft from Home and from
 * "See all" must land in the same place.
 *
 * ⚠️ Deliberately NOT the default inside `useResumeDraft`. That hook is shared
 * with the shipped UI, and a `/v2` push from inside it would walk an old-UI
 * seller into v2 mid-journey — the same defect class as the sign-in ejection
 * fixed on 2026-09-16. The old callers pass nothing and keep their behaviour.
 */
import { router } from 'expo-router';

import type { MultiItemHandler } from '@/features/scanner/useResumeDraft';

/**
 * `push`, not `replace`: Back should return to the list the seller tapped from,
 * not skip past it to Home.
 *
 * The count travels in the params purely so the screen can render its header
 * before the first fetch resolves — it refetches the authoritative counts
 * itself and never trusts this number for anything else.
 */
export const openMultiItemDraft: MultiItemHandler = (draftId, itemCount) => {
  router.push({
    pathname: '/v2/scan/items',
    params: { draftId, count: String(itemCount) },
  } as never);
};
