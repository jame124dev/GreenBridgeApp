// Minimal, safe notification-type → lab-tab routing (shared by the bell + the
// dedicated page). v1 lands on the right tab; the web resolves exact deep links.
// Unknown types return null → tap just marks read + closes.
export function routeForType(type: string): string | null {
  if (type === 'chat') return '/(lab)/(tabs)/deals';
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
