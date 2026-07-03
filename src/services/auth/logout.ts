import { clearMarketplaceWebAuth } from '@/lib/marketplaceWebView';
import { mmkv } from '@/lib/mmkv';
import { deleteSecureItem } from '@/lib/secureStorage';

export async function logout() {
  // Clear the marketplace WebView's web session first (no-op if Browse isn't
  // mounted) so it doesn't retain the previous user's tokens in localStorage.
  clearMarketplaceWebAuth();
  await deleteSecureItem('auth.accessToken');
  await deleteSecureItem('auth.refreshToken');
  mmkv.remove('auth.profile');
  mmkv.remove('auth.userId');
  mmkv.remove('auth.pending');
}
