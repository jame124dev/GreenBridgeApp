import { Redirect } from 'expo-router';

// Kept for back-compat with older deep links. It used to point at the seller
// fork's `(tabs)/history`; that fork is deleted, so it now lands on the lab
// app's "My listings", which is the equivalent destination (and where
// scan/success sends a multi-item submit).
export default function ActivityHistoryRedirect() {
  return <Redirect href="/(lab)/(tabs)/listings" />;
}
