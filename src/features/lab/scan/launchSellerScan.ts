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
// ⚠️ DELIBERATELY UNGATED. Authoring a listing is open to anyone signed in —
// photograph, run the AI, edit, save a draft. Seller approval is required to
// PUBLISH, and is enforced at the two submit choke points instead; see
// `@/features/seller/sellerSubmitGate`. Do not reintroduce a check here: sending
// a user to a company-details form before they have seen the AI do anything is
// the friction this flow exists to avoid.
import { router } from 'expo-router';

import { SMART_DETECT_ENABLED } from '@/lib/flags';
import { routes } from '@/lib/routes';
import { useScanDraft } from '@/stores/scanDraftStore';

export function launchSellerScan(): void {
  // Called from five places — lab home ×2 (`app/(lab)/(tabs)/home.tsx`
  // onPhoto/onAttach), lab chat ×2 (`app/(lab)/chat.tsx` camera/attach buttons)
  // and the chat controller (`useChatController.handleUploadPress`, behind the
  // entry card's "Upload photos / documents").
  //
  // FLUSH-ALWAYS: reset any half-finished scan draft so the flow starts clean
  // (same contract as the seller Scan tab).
  useScanDraft.getState().reset();
  // push (not replace) so the OS/back gesture returns to the chat, not the tab.
  router.push(SMART_DETECT_ENABLED ? routes.scanCamera : routes.scanListingMethod);
}
