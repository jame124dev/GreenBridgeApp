import { mmkv } from '@/lib/mmkv';
import { deleteSecureItem } from '@/lib/secureStorage';

export async function logout() {
  await deleteSecureItem('auth.accessToken');
  await deleteSecureItem('auth.refreshToken');
  mmkv.remove('auth.profile');
  mmkv.remove('auth.userId');
  mmkv.remove('auth.pending');
}
