import type { AxiosInstance } from 'axios';

import { getSecureItem } from '@/lib/secureStorage';
import { logout } from '@/services/auth/logout';

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export function attachGreenbidzInterceptors(client: AxiosInstance) {
  client.interceptors.request.use(async (config) => {
    const access = await getSecureItem('auth.accessToken');
    const refresh = await getSecureItem('auth.refreshToken');
    if (access) config.headers.Authorization = `Bearer ${access}`;
    if (refresh) config.headers['x-refresh-token'] = refresh;
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error.response?.status;
      const url = error.config?.url ?? '';

      if (status === 401 && !url.includes('/auth/login')) {
        await logout();
        onUnauthorized?.();
      }

      return Promise.reject(error);
    },
  );
}
