import { resetLabSocket } from '@/features/lab/messages/socket';
import { clearMarketplaceWebAuth } from '@/lib/marketplaceWebView';
import { mmkv } from '@/lib/mmkv';
import { deleteSecureItem } from '@/lib/secureStorage';

export async function logout() {
  // Clear the marketplace WebView's web session first (no-op if Browse isn't
  // mounted) so it doesn't retain the previous user's tokens in localStorage.
  clearMarketplaceWebAuth();
  // Deleting the token does NOT re-authenticate the already-open chat socket —
  // it would keep this user's credentials in its handshake for the next
  // account. Drop it so the next sign-in connects with the new token.
  resetLabSocket();
  await deleteSecureItem('auth.accessToken');
  await deleteSecureItem('auth.refreshToken');
  mmkv.remove('auth.profile');
  mmkv.remove('auth.userId');
  mmkv.remove('auth.pending');
}
