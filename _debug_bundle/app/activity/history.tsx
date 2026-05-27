import { Redirect } from 'expo-router';

// History lives in the (tabs) group so the bottom tab bar stays visible.
// This route remains for back-compat with any older deep links.
export default function ActivityHistoryRedirect() {
  return <Redirect href="/(tabs)/history" />;
}
