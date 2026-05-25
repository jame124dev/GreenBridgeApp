import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const WEB_PREFIX = 'auth.secure.';

/** SecureStore is iOS/Android only; use AsyncStorage on web so login works in the browser. */
export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(WEB_PREFIX + key, value);
    return;
  }
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  await AsyncStorage.setItem(WEB_PREFIX + key, value);
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(WEB_PREFIX + key);
  }
  if (await SecureStore.isAvailableAsync()) {
    return SecureStore.getItemAsync(key);
  }
  return AsyncStorage.getItem(WEB_PREFIX + key);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(WEB_PREFIX + key);
    return;
  }
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await AsyncStorage.removeItem(WEB_PREFIX + key);
}
