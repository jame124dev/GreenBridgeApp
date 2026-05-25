import { Redirect } from 'expo-router';
import { routes } from '@/lib/routes';

export default function ScanTabRedirect() {
  return <Redirect href={routes.scanListingMethod} />;
}
