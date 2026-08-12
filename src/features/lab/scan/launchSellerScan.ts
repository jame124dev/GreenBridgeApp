// launchSellerScan — hand a SELL-mode "upload photos / documents" intent from
// the (lab) customer chat OFF to the native seller scan flow (camera → AI detect
// → review → submit), instead of streaming a listing_draft inline in the chat.
//
// Decision (NewVersion/12 §4, revised): reuse the existing seller scan flow
// (app/scan/*) and REPLACE the inline detect-in-chat path for sell-mode uploads.
// Mirrors the seller tab launcher (app/(tabs)/scan.tsx): flush any in-progress
// scan draft, then open the camera (or the legacy listing-method picker when
// smart-detect is off). Buyer-mode image uploads are NOT routed here — they stay
// inline for image search (useLabTurn keeps buyer attachments on /chat/stream).
//
// ⚠️ THIS FUNCTION IS ALSO THE SELL GATE — the single choke point in front of
// every entry to the listing flow. Listing requires an APPROVED seller-upgrade
// request; anyone else is sent to the application screen instead.
import { router } from 'expo-router';

import { SELLER_UPGRADE_KEY } from '@/features/seller/useSellerUpgrade';
import { SMART_DETECT_ENABLED } from '@/lib/flags';
import { queryClient } from '@/lib/queryClient';
import { routes } from '@/lib/routes';
import type { SellerUpgradeStatus } from '@/services/seller/sellerUpgrade';
import { useScanDraft } from '@/stores/scanDraftStore';

/**
 * True only when the cached `/seller-upgrade/my-status` says `approved`.
 *
 * Reads the query CACHE rather than `useCanSell()` because this is a plain
 * function, not a hook, called from five places — lab home ×2
 * (`app/(lab)/(tabs)/home.tsx` onPhoto/onAttach), lab chat ×2
 * (`app/(lab)/chat.tsx` camera/attach buttons) and the chat controller
 * (`useChatController.handleUploadPress`, behind the entry card's "Upload
 * photos / documents"). Gating HERE covers all five at once; adding a check at
 * each call site would leave the next new one ungated.
 *
 * Fails CLOSED: `undefined` (never fetched), `null` (never applied), `pending`,
 * `rejected` and any unrecognised value all mean "not approved".
 */
function isApprovedSeller(): boolean {
  const status = queryClient.getQueryData<SellerUpgradeStatus | null>(SELLER_UPGRADE_KEY);
  return status?.status === 'approved';
}

export function launchSellerScan(): void {
  if (!isApprovedSeller()) {
    // Mark the status stale so `apply.tsx` renders the SERVER's answer rather
    // than whatever the cache held — this is what makes the gate self-correcting
    // for someone approved a minute ago (and for a cold cache, where the only
    // honest answer is "ask"). Inactive queries are not refetched by an
    // invalidate, so this costs no request until the screen mounts and observes.
    void queryClient.invalidateQueries({ queryKey: SELLER_UPGRADE_KEY });
    // push (not replace): back returns to whatever they tapped Sell from.
    router.push(routes.labSellApply);
    return;
  }

  // FLUSH-ALWAYS: reset any half-finished scan draft so the flow starts clean
  // (same contract as the seller Scan tab).
  useScanDraft.getState().reset();
  // push (not replace) so the OS/back gesture returns to the chat, not the tab.
  router.push(SMART_DETECT_ENABLED ? routes.scanCamera : routes.scanListingMethod);
}
