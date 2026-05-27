import axios from 'axios';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

// eslint-disable-next-line import/no-named-as-default-member
export const quippy = axios.create({
  baseURL: extra.QUIPPY_API_URL as string | undefined,
  timeout: 20_000,
});
