import { Redirect } from 'expo-router';
import { routes } from '@/lib/routes';

export default function HistoryTabRedirect() {
  return <Redirect href={routes.activityHistory} />;
}
