import { V2_UI_ENABLED } from '@/lib/flags';

/**
 * Notification type → the screen a tap should open.
 *
 * Shared by three callers, which is why the v2 mapping lives here rather than
 * at any one of them: the in-app toast (`useLabNotifications`), a OneSignal
 * push tap (`lib/onesignal.ts`), and the notifications list.
 *
 * ⚠️ THESE USED TO BE LEGACY ROUTES UNCONDITIONALLY.
 *
 * Every entry pointed at `/(lab)/(tabs)/…` or the old `/scan/…` flow. On a v2
 * build that means tapping any notification threw the user out of the new UI
 * and into the previous version — different tab bar, different home, no way
 * back except the tab bar they no longer recognise. Reported from the device
 * 2026-10-01: a chat notification arrived and the toast landed on the old
 * deals screen.
 *
 * The legacy targets are kept for builds where `EXPO_PUBLIC_V2_UI` is off, so
 * this is additive rather than a swap.
 *
 * Destinations are deliberately UNCHANGED in meaning — a chat notification
 * still opens messages, an approval still opens listings. Only the UI
 * generation differs. Changing where a notification LANDS is a product
 * decision, not part of fixing the leak.
 *
 * Unknown types return null → the tap just marks read and closes.
 */
export function routeForType(type: string): string | null {
  if (V2_UI_ENABLED) {
    if (type === 'chat') return '/v2/messages';
    if (type === 'recognition_draft_ready') return '/v2/drafts';
    if (type === 'Bid Accepted' || type === 'Offer Accepted') return '/v2/matches';
    if (
      type === 'Listing Approved' ||
      type === 'Auction Group Approved' ||
      type === 'payment_received' ||
      type === 'order_created' ||
      type === 'order_status_updated'
    ) {
      return '/v2/listings';
    }
    return null;
  }

  if (type === 'chat') return '/(lab)/(tabs)/deals';
  if (type === 'recognition_draft_ready') return '/scan/drafts';
  if (type === 'Bid Accepted' || type === 'Offer Accepted') return '/(lab)/(tabs)/matches';
  if (
    type === 'Listing Approved' ||
    type === 'Auction Group Approved' ||
    type === 'payment_received' ||
    type === 'order_created' ||
    type === 'order_status_updated'
  ) {
    return '/(lab)/(tabs)/listings';
  }
  return null;
}
