import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

/**
 * Persist Supabase auth tokens in the OS keystore/keychain via Expo SecureStore.
 * Sensitive tokens must NEVER go in AsyncStorage.
 */
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  (extra.supabaseUrl as string) ?? '',
  (extra.supabaseAnonKey as string) ?? '',
  {
    auth: {
      storage: SecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

export const config = {
  apiBaseUrl: (extra.apiBaseUrl as string) ?? 'http://localhost:3001',
  cdnBaseUrl: (extra.cdnBaseUrl as string) ?? '',
};
