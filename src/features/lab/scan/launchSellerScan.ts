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
// ⚠️ THIS FUNCTION IS ONE OF TWO SELL GATES. It covers the five chat/home entry
// points; `resumeDraftById` covers resuming a saved draft. Both share ONE
// predicate — `canEnterScanFlow()` in `@/features/seller/scanFlowGate` — so there
// is a single definition of "may this user reach the scan flow".
import { router } from 'expo-router';

import { canEnterScanFlow, redirectToSellerApplication } from '@/features/seller/scanFlowGate';
import { SMART_DETECT_ENABLED } from '@/lib/flags';
import { routes } from '@/lib/routes';
import { useScanDraft } from '@/stores/scanDraftStore';

export function launchSellerScan(): void {
  // Gated HERE, not at the call sites: this is a plain function called from five
  // places — lab home ×2 (`app/(lab)/(tabs)/home.tsx` onPhoto/onAttach), lab chat
  // ×2 (`app/(lab)/chat.tsx` camera/attach buttons) and the chat controller
  // (`useChatController.handleUploadPress`, behind the entry card's "Upload photos
  // / documents"). One check covers all five; a check per call site would leave
  // the next new one ungated.
  if (!canEnterScanFlow()) {
    redirectToSellerApplication();
    return;
  }

  // FLUSH-ALWAYS: reset any half-finished scan draft so the flow starts clean
  // (same contract as the seller Scan tab). Deliberately AFTER the gate — a
  // blocked attempt must not destroy work belonging to a flow the user never
  // entered.
  useScanDraft.getState().reset();
  // push (not replace) so the OS/back gesture returns to the chat, not the tab.
  router.push(SMART_DETECT_ENABLED ? routes.scanCamera : routes.scanListingMethod);
}
