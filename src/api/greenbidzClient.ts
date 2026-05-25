import axios from 'axios';
import Constants from 'expo-constants';

import { attachGreenbidzInterceptors } from './interceptors';

const extra = Constants.expoConfig?.extra ?? {};

const headers: Record<string, string> = {
  // Mixed-case to match what the web sends (see 101lab-2/src/config/site.ts → "LabGreenbidz")
  'x-platform': (extra.SITE_TYPE as string | undefined) ?? 'LabGreenbidz',
};

if (extra.X_SYSTEM_KEY) {
  headers['x-system-key'] = extra.X_SYSTEM_KEY as string;
}

// eslint-disable-next-line import/no-named-as-default-member
export const greenbidz = axios.create({
  baseURL: extra.GREENBIDZ_API_URL as string | undefined,
  timeout: 20_000,
  headers,
});

attachGreenbidzInterceptors(greenbidz);
